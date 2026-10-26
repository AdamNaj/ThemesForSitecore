const test = require("node:test");
const assert = require("node:assert/strict");
const { surfaceFromUrl, surface, parseVersionXml, versionFromDocument } = require("../../extension/lib/detect.js");

const urls = [
  ["https://cm/sitecore/shell/default.aspx", "shell"],
  ["https://cm/sitecore/shell/Applications/Content%20Editor.aspx?sc_bw=1", "shell"],
  ["https://cm/sitecore/shell/default.aspx?xmlcontrol=Gallery.Languages", "shell"],
  ["https://cm/sitecore%20modules/Shell/PowerShell/PowerShellIse.aspx", "shell"],
  ["https://cm/sitecore modules/Shell/PowerShell/PowerShellIse.aspx", "shell"],
  ["https://cm/sitecore/shell/client/Applications/FormsBuilder", "speak"],
  // the desktop opens Control Panel through a shell URL that serves the SPEAK page
  ["https://cm/sitecore/shell/Applications/Control%20panel.aspx?sc_bw=1", "speak"],
  ["https://cm/sitecore/client/Applications/Launchpad", "launchpad"],
  ["https://cm/sitecore/client/Applications/Launchpad?sc_lang=en", "launchpad"],
  // Sitecore's own Launchpad links (header button, start menu) go through the shell path
  ["https://cm/sitecore/shell/sitecore/client/Applications/Launchpad", "launchpad"],
  ["https://cm/sitecore/shell/sitecore/client/Applications/ControlPanel.aspx?sc_bw=1", "speak"],
  ["https://cm/sitecore/client/Applications/MarketingAutomation", "speak"],
  ["https://ids/Account/Login?ReturnUrl=x", "login"],
  ["https://cm/sitecore/login", "login"],
  ["https://cm/sitecore/client/Applications/ExperienceEditor/Ribbon.aspx", "speak"],
  ["https://cm/?sc_mode=edit", "ee"],
  ["https://cm/about-us?sc_mode=edit&sc_lang=en", "ee"],
  ["https://cm/", null],
  ["https://cm/about-us", null],
  ["https://cm/sitecore/admin/cache.aspx", "admin"],
  // Sitecore serves the desktop at the bare folder URL
  ["https://cm/sitecore/shell?sc_lang=en", "shell"],
  ["https://cm/sitecore/client", "speak"],
  ["https://cm/sitecore/admin/PowerShell.aspx", "admin"],
  ["about:blank", null],
  ["https://cm/sitecore/shell/Controls/Rich%20Text%20Editor/EditorPage.aspx", "shell"],
  ["https://cm/sitecore/shell/Controls/Rich%20Text%20Editor/Preview.aspx?da=core", null],
];

for (const [href, expected] of urls) {
  test(`surfaceFromUrl ${href} => ${expected}`, () => {
    assert.equal(surfaceFromUrl(href), expected);
  });
}

// Minimal stand-ins for the parts of Document that detect.js reads.
function fakeDoc({ sheets = [], purple = "", selectors = [], bodyClasses = [] } = {}) {
  return {
    styleSheets: sheets.map((href) => ({ href, cssRules: [] })),
    documentElement: {},
    defaultView: { getComputedStyle: () => ({ getPropertyValue: (n) => (n === "--color-purple" ? purple : "") }) },
    querySelector: (sel) => (selectors.some((s) => sel.includes(s)) ? {} : null),
    body: { classList: { contains: (c) => bodyClasses.includes(c) } },
  };
}

test("surface confirms an ee URL only with Experience Editor markup", () => {
  assert.equal(surface("https://cm/?sc_mode=edit", fakeDoc({ selectors: ["#scWebEditRibbon"] })), "ee");
  assert.equal(surface("https://cm/?sc_mode=edit", fakeDoc()), null);
});

test("surface ignores the Rich Text Editor content frame", () => {
  const rte = fakeDoc({ bodyClasses: ["RadEContentBordered"] });
  assert.equal(surface("https://cm/sitecore/shell/Controls/Rich%20Text%20Editor/EditorPage.aspx", rte), null);
});

test("surface without a document falls back to the URL", () => {
  assert.equal(surface("https://cm/sitecore/shell/default.aspx", null), "shell");
});

const xml105 = `<?xml version="1.0" encoding="utf-8"?>
<information><version><major>10</major><minor>5</minor><build>0</build><revision>014188</revision></version></information>`;
const xml104 = `<information><version><major>10</major><minor>4</minor><build>1</build><revision>012149</revision></version></information>`;

test("parseVersionXml reads major.minor", () => {
  assert.equal(parseVersionXml(xml105), "10.5");
  assert.equal(parseVersionXml(xml104), "10.4");
});

test("parseVersionXml returns null for a login page or error", () => {
  assert.equal(parseVersionXml("<html>403</html>"), null);
  assert.equal(parseVersionXml(""), null);
});

test("versionFromDocument: Content Manager.css without ColorVariables means 10.4", () => {
  const doc = fakeDoc({ sheets: ["https://cm/sitecore/shell/Themes/Standard/Default/Content Manager.css"] });
  assert.equal(versionFromDocument(doc), "10.4");
});

test("versionFromDocument: ColorVariables.css means 10.5", () => {
  const doc = fakeDoc({ sheets: ["https://cm/x/Content Manager.css", "https://cm/x/ColorVariables.css"] });
  assert.equal(versionFromDocument(doc), "10.5");
});

test("versionFromDocument ignores --color-purple, which the extension's own CSS defines", () => {
  assert.equal(versionFromDocument(fakeDoc({ purple: " #6e3fff" })), null);
  const doc104 = fakeDoc({ purple: " #9d86ff", sheets: ["https://cm/x/Content Manager.css"] });
  assert.equal(versionFromDocument(doc104), "10.4");
});

test("versionFromDocument: no signals means unknown", () => {
  assert.equal(versionFromDocument(fakeDoc()), null);
});

test("an /account/ page is login only with Identity Server markup", () => {
  assert.equal(surface("https://cm/account/profile", fakeDoc()), null);
  assert.equal(surface("https://ids/Account/Login?ReturnUrl=x", fakeDoc({ selectors: ["#AccountPrefix"] })), "login");
  assert.equal(surface("https://cm/sitecore/login", fakeDoc()), "login");
});

test("needsDom flags URL candidates that only the DOM can confirm", () => {
  const { needsDom } = require("../../extension/lib/detect.js");
  assert.equal(needsDom("https://cm/?sc_mode=edit"), true);
  assert.equal(needsDom("https://ids/Account/Login"), true);
  assert.equal(needsDom("https://cm/sitecore/login"), false);
  assert.equal(needsDom("https://cm/sitecore/shell/default.aspx"), false);
});
