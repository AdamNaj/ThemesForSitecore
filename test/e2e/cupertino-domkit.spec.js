const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const fixture = pathToFileURL(path.join(__dirname, "fixtures", "cupertino-desktop.html")).href;

test("Cupertino groups the taskbar into one Dock item per app, forwards clicks, and reverts cleanly", async ({ page }) => {
  await page.goto(fixture);
  await page.evaluate(() => { applyTheme(); applyTheme(); }); // applying twice changes nothing more
  expect(await page.locator(".sct-cu-dock").count()).toBe(1);
  // two Content Editor windows share an item; the closed Workbox window's leftover entry is ignored
  expect(await page.evaluate(() => dock())).toEqual(["Content Editor and 1 more/2", "Media Library/0*"]);
  // opening a label reads each window's selected item from its tree; a window without one shows none
  await page.locator(".sct-cu-app").first().dispatchEvent("mouseenter");
  expect(await page.evaluate(() => [...document.querySelectorAll(".sct-cu-stack-row .sct-cu-path")].map((s) => s.textContent))).toEqual(["/sitecore/Content/Home", ""]);
  // the item asks for the 32px version of Sitecore's icon; on this file:// page that fails, so it falls
  // back to the 16px icon the taskbar shows
  await expect.poll(() => page.locator(".sct-cu-app-icon img").first().getAttribute("src")).toBe("/temp/iconcache/apps/16x16/pencil.png");

  // clicks and right-clicks reach Sitecore's own buttons; the taskbar strip's menu does not answer too
  await page.evaluate(() => document.querySelectorAll(".sct-cu-stack-row")[1].click());
  await page.evaluate(() => document.querySelectorAll(".sct-cu-app-icon")[1].click());
  await page.evaluate(() => document.querySelectorAll(".sct-cu-stack-row")[0].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  expect(await page.evaluate(() => log)).toEqual(["focus FRAME2", "focus FRAME3", "app menu FRAME1"]);

  // a focus change only swaps the entries' classes; the Dock follows it, and the app's icon then
  // brings forward its most recently active window
  await page.evaluate(() => focusWindow("FRAME1"));
  await expect.poll(() => page.evaluate(() => dock())).toEqual(["Content Editor and 1 more/2*", "Media Library/0"]);
  await page.evaluate(() => { log.length = 0; document.querySelectorAll(".sct-cu-app-icon")[0].click(); });
  expect(await page.evaluate(() => log)).toEqual(["focus FRAME1"]);

  // a window that goes away leaves the Dock
  await page.evaluate(() => { document.getElementById("FRAME2").remove(); applyTheme(); });
  expect(await page.evaluate(() => dock())).toEqual(["Content Editor/0*", "Media Library/0"]);

  // revert removes the Dock and stops following the taskbar
  await page.evaluate(() => revertTheme());
  expect(await page.locator(".sct-cu-dock, [data-sct-owned]").count()).toBe(0);
  await page.evaluate(() => focusWindow("FRAME3"));
  await page.waitForTimeout(200);
  expect(await page.locator(".sct-cu-dock").count()).toBe(0);
  expect(await page.locator("#StartbarApplications td").count()).toBe(4); // Sitecore's entries untouched
});
