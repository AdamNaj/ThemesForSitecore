const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const fixture = pathToFileURL(path.join(__dirname, "fixtures", "metal-desktop.html")).href;

test("Metal Steel mirrors the taskbar's active window onto each window, and reverts cleanly", async ({ page }) => {
  await page.goto(fixture);
  await page.waitForFunction(() => [...document.querySelectorAll("iframe")].every((f) => f.contentDocument.readyState === "complete"));

  await page.evaluate(() => { applyTheme(); applyTheme(); }); // applying twice changes nothing more
  expect(await page.evaluate(() => states())).toEqual(["inactive/inactive", "active/active"]);

  // a focus change only swaps the entries' classes; the taskbar observer follows it
  await page.evaluate(() => focusWindow("FRAME1"));
  await expect.poll(() => page.evaluate(() => states())).toEqual(["active/active", "inactive/inactive"]);

  // a window that navigates gets a new document, marked again
  await page.evaluate(() => { document.getElementById("FRAME1").srcdoc = "<p>Workbox</p>"; });
  await expect.poll(() => page.evaluate(() => states())).toEqual(["active/active", "inactive/inactive"]);

  // revert removes every attribute and stops listening
  await page.evaluate(() => revertTheme());
  expect(await page.evaluate(() => states())).toEqual(["null/null", "null/null"]);
  await page.evaluate(() => focusWindow("FRAME2"));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => states())).toEqual(["null/null", "null/null"]);
});
