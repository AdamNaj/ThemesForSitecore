const { test, expect } = require("@playwright/test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const fixture = pathToFileURL(path.join(__dirname, "fixtures", "domkit.html")).href;

test("revertAll restores the document exactly", async ({ page }) => {
  await page.goto(fixture);
  const r = await page.evaluate(() => {
    const before = document.body.innerHTML;
    const kit = SCT.createDomKit(document);
    const win = document.getElementById("window");
    const glyph = document.getElementById("glyph");

    const bar = kit.own(document.createElement("div"));
    bar.className = "sct-titlebar";
    bar.appendChild(document.createElement("span"));
    win.prepend(bar);
    kit.addClass(win, "sct-framed");
    kit.addClass(win, "sct-framed"); // second call is a no-op
    kit.setAttr(glyph, "src", "/sitecore/shell/themes/standard/images/hamburgermenu_default.png");
    kit.setAttr(win, "data-x", "1"); // absent before: removed on revert
    kit.move(document.getElementById("buttons"), document.getElementById("elsewhere"), null);

    const changed = document.body.innerHTML !== before;
    const owned = kit.isOwned(bar) && kit.isOwned(bar.firstChild) && !kit.isOwned(win);
    kit.revertAll();
    return { changed, owned, same: document.body.innerHTML === before };
  });

  expect(r.changed).toBe(true);
  expect(r.owned).toBe(true);
  expect(r.same).toBe(true);
});

test("addClass refuses classes without the sct- prefix", async ({ page }) => {
  await page.goto(fixture);
  const message = await page.evaluate(() => {
    try {
      SCT.createDomKit(document).addClass(document.body, "bad");
      return "no error";
    } catch (e) {
      return e.message;
    }
  });
  expect(message).toContain("sct-");
});

test("revertAll keeps a class the element already had", async ({ page }) => {
  await page.goto(fixture);
  const kept = await page.evaluate(() => {
    const win = document.getElementById("window");
    win.classList.add("sct-preexisting");
    const kit = SCT.createDomKit(document);
    kit.addClass(win, "sct-preexisting");
    kit.revertAll();
    return win.classList.contains("sct-preexisting");
  });
  expect(kept).toBe(true);
});
