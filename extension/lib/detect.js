// Decides which Sitecore UI area a frame belongs to, and which Sitecore version serves it.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const EE_MARKERS = '#scWebEditRibbon, [id^="scWebEdit"], .scChromeData, code[chrometype]';
  // /account/ also exists on ordinary websites; only Sitecore Identity Server's page counts as login.
  const LOGIN_MARKERS = "#AccountPrefix, .login-page, form[action*='/Account/Login' i]";

  function parse(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    let path = url.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {
      // keep the raw path
    }
    return { path: path.toLowerCase(), editMode: url.searchParams.get("sc_mode") === "edit" };
  }

  function surfaceFromUrl(href) {
    const u = parse(href);
    if (!u) return null;
    // Sitecore's own links (the header's Launchpad button, the start menu) serve SPEAK apps under the
    // shell path, /sitecore/shell/sitecore/client/...; they are the same pages as /sitecore/client/...
    // The trailing slash lets the prefixes below match bare folder URLs: Sitecore serves the desktop at /sitecore/shell.
    const p = `${u.path}/`.replace(/^\/sitecore\/shell(?=\/sitecore\/client\/)/, "");
    if (p.startsWith("/sitecore/admin")) return "admin";
    // The Rich Text Editor's preview renders item content with the site's own styles.
    if (p.startsWith("/sitecore/shell/controls/rich text editor/preview.aspx")) return null;
    if (p.startsWith("/sitecore/client/applications/launchpad")) return "launchpad";
    if (p.startsWith("/sitecore/client/") || p.startsWith("/sitecore/shell/client/")) return "speak";
    // the desktop opens Control Panel through a shell URL that serves the SPEAK page
    if (p.startsWith("/sitecore/shell/applications/control panel.aspx")) return "speak";
    if (p.startsWith("/sitecore/shell/") || p.startsWith("/sitecore modules/shell/")) return "shell";
    if (p.startsWith("/sitecore/login") || p.startsWith("/account/")) return "login";
    if (u.editMode) return "ee";
    return null;
  }

  function surface(href, doc) {
    const s = surfaceFromUrl(href);
    if (!doc || s === null) return s;
    if (doc.body && doc.body.classList.contains("RadEContentBordered")) return null;
    // ee means the website page in edit mode: only themed once Sitecore's chrome is on it.
    // The ribbon itself is a SPEAK page and gets the speak area.
    if (s === "ee" && !doc.querySelector(EE_MARKERS)) return null;
    if (s === "login" && needsDom(href) && !doc.querySelector(LOGIN_MARKERS)) return null;
    return s;
  }

  // URL candidates that only the page's markup can confirm, so the engine waits for the DOM.
  function needsDom(href) {
    const s = surfaceFromUrl(href);
    return s === "ee" || (s === "login" && parse(href).path.startsWith("/account/"));
  }

  function parseVersionXml(text) {
    const m = /<major>\s*(\d+)\s*<\/major>\s*<minor>\s*(\d+)\s*<\/minor>/i.exec(text || "");
    return m ? `${m[1]}.${m[2]}` : null;
  }

  function stylesheetHrefs(doc) {
    const hrefs = [];
    const walk = (sheet, depth) => {
      if (!sheet || depth > 4) return;
      if (sheet.href) hrefs.push(sheet.href.toLowerCase());
      let rules;
      try {
        rules = sheet.cssRules || [];
      } catch {
        return; // cross-origin sheet
      }
      for (const rule of rules) if (rule.styleSheet) walk(rule.styleSheet, depth + 1);
    };
    for (const sheet of doc.styleSheets || []) walk(sheet, 0);
    return hrefs;
  }

  function versionFromDocument(doc) {
    const hrefs = stylesheetHrefs(doc);
    if (hrefs.some((h) => h.includes("colorvariables.css"))) return "10.5";
    // Computed styles are no evidence: the extension's own CSS defines Sitecore's 10.5 variables.
    if (hrefs.some((h) => h.includes("content manager.css") || h.includes("content%20manager.css"))) return "10.4";
    return null;
  }

  SCT.detect = { surfaceFromUrl, surface, needsDom, parseVersionXml, versionFromDocument };
  if (typeof module !== "undefined") module.exports = SCT.detect;
})(globalThis);
