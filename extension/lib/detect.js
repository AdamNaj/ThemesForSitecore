// Decides which Sitecore UI area a frame belongs to, and which Sitecore version serves it.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const EE_MARKERS = '#scWebEditRibbon, [id^="scWebEdit"], .scChromeData, code[chrometype]';
  // /account/ also exists on ordinary websites; only Sitecore Identity Server's page counts as login.
  const LOGIN_MARKERS = "#AccountPrefix, .login-page, form[action*='/Account/Login' i]";

  // Content Hub tenants; the popup asks for this host pattern (popup.js CONTENT_HUB)
  const CONTENT_HUB = /\.sitecorecontenthub\.cloud$/;

  const SPEAK_AT_SHELL_URLS = [
    "/sitecore/shell/applications/control panel.aspx",
    "/sitecore/shell/applications/dialogs/internal link.aspx",
    "/sitecore/shell/applications/dialogs/mail link.aspx",
    "/sitecore/shell/applications/dialogs/anchor link.aspx",
    "/sitecore/shell/applications/item browser.aspx",
  ];

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
    return { host: url.hostname.toLowerCase(), path: path.toLowerCase(), editMode: url.searchParams.get("sc_mode") === "edit", control: (url.searchParams.get("xmlcontrol") || "").toLowerCase() };
  }

  function surfaceFromUrl(href) {
    const u = parse(href);
    if (!u) return null;
    // Sitecore's own links (the header's Launchpad button, the start menu) serve SPEAK apps under the
    // shell path, /sitecore/shell/sitecore/client/...; they are the same pages as /sitecore/client/...
    // The trailing slash lets the prefixes below match bare folder URLs: Sitecore serves the desktop at /sitecore/shell.
    const p = `${u.path}/`.replace(/^\/sitecore\/shell(?=\/sitecore\/client\/)/, "");
    // Content Hub's DAM Connect pages (/en-us/sitecore-dam-connect/approved-assets), which the DAM connector's
    // pickers show in a frame, served by the Content Hub tenant: they take the Sitecore site's theme (content.js)
    if (CONTENT_HUB.test(u.host)) return /^\/[a-z]{2}(-[a-z0-9]+)*\/sitecore-dam-connect\//.test(p) ? "contenthub" : null;
    if (p.startsWith("/sitecore/admin")) return "admin";
    // The Rich Text Editor's preview renders item content with the site's own styles.
    if (p.startsWith("/sitecore/shell/controls/rich text editor/preview.aspx")) return null;
    if (p.startsWith("/sitecore/client/applications/launchpad")) return "launchpad";
    if (p.startsWith("/sitecore/client/") || p.startsWith("/sitecore/shell/client/")) return "speak";
    // Sitecore serves some SPEAK pages at the shell URLs they replace (Sitecore.Speak.Applications.config's
    // overrideDialogs and overrideXmlControls): Control Panel, and the media, link and item pickers fields open
    if (SPEAK_AT_SHELL_URLS.some((s) => p.startsWith(s)) || u.control === "sitecore.shell.applications.media.mediabrowser") return "speak";
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

  // The kinds of page a URL serves, for <html data-sct-page>: themes style a gallery or the Control Panel by it rather
  // than with body:has(.scGalleryGrip), which makes Chrome search the whole document again for every element inserted.
  // The galleries that render a plain menu, with no grip, are not galleries here: themes style them as menus.
  const MENU_GALLERIES = ["gallery.menu", "gallery.archives", "gallery.reminder", "gallery.subitems", "gallery.workflowedit"];
  function pageKinds(href) {
    const u = parse(href);
    if (!u) return [];
    const p = `${u.path.replace(/\/+$/, "")}/`.replace(/^\/sitecore\/shell(?=\/sitecore\/client\/)/, "");
    const kinds = [];
    if (u.control.startsWith("gallery.") && !MENU_GALLERIES.includes(u.control)) kinds.push("gallery");
    if (/^\/sitecore\/client\/applications\/controlpanel(\.aspx)?\//.test(p) ||p.startsWith("/sitecore/shell/applications/control panel.aspx")) kinds.push("control-panel");
    if (!u.control && (p === "/sitecore/shell/" || p === "/sitecore/shell/default.aspx/")) kinds.push("desktop");
    if (u.control === "workbox" || p.startsWith("/sitecore/shell/applications/workbox")) kinds.push("workbox");
    if (/^\/sitecore(\/shell\/applications| modules\/shell)\/powershell\/powershellise/.test(p)) kinds.push("ise");
    return kinds;
  }

  // URL candidates that only the page's markup can confirm, so the engine waits for the DOM.
  function needsDom(href) {
    const s = surfaceFromUrl(href);
    return s === "ee" || (s === "login" && parse(href).path.startsWith("/account/"));
  }

  // The Sitecore site an Identity Server page signs in to, or null: the login's ReturnUrl carries the OpenID Connect
  // request, whose redirect_uri is the site's /identity/signin. The page takes that site's settings.
  function signInSite(href) {
    try {
      const url = new URL(href);
      if (!url.pathname.toLowerCase().startsWith("/account/")) return null;
      const param = (u, name) => ([...u.searchParams].find(([k]) => k.toLowerCase() === name) || [])[1];
      const back = new URL(param(new URL(param(url, "returnurl"), href), "redirect_uri"));
      return /^https?:$/.test(back.protocol) && back.pathname.toLowerCase() === "/identity/signin" ? back.origin : null;
    } catch {
      return null;
    }
  }

  // Where a Sitecore site's Identity Server would be, going by the names installs get: the site's role (cm or sc,
  // a label of its own or the end of one: specm, xp0.sc, x-cm, cm.x.localhost) swapped for the identity server's,
  // and the identity server's name added to the first label, for a site with no role in its name (spe). Guesses:
  // the popup keeps the one whose discovery document says it is this site's (popup.js findIdentity). An identity
  // server named any other way is enabled from its own login page.
  function identityCandidates(origin) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      return [];
    }
    const labels = url.hostname.toLowerCase().split(".");
    if (labels.length < 2 || /^[\d.]+$/.test(url.hostname)) return [];
    const hosts = [];
    const swap = (i, label) => hosts.push(labels.map((l, j) => (j === i ? label : l)).join("."));
    for (const i of [0, 1]) {
      const role = /^(.*?)(-?)(cm|sc)$/.exec(labels[i]);
      if (!role) continue;
      // short names only where a separator or the dot sets them apart
      const names = role[1] && !role[2] ? ["identityserver", "identity"] : ["identityserver", "identity", "id", "si"];
      for (const name of names) swap(i, role[1] + role[2] + name);
    }
    for (const name of ["identityserver", "-identityserver", ".identityserver"]) swap(0, labels[0] + name);
    return hosts.filter((h, i) => hosts.indexOf(h) === i).map((h) => `${url.protocol}//${h}`);
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

  SCT.detect = { surfaceFromUrl, surface, pageKinds, needsDom, signInSite, identityCandidates, parseVersionXml, versionFromDocument };
  if (typeof module !== "undefined") module.exports = SCT.detect;
})(globalThis);
