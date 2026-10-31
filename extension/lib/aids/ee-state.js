// Remember Experience Editor state: the Experience Editor, opened on the site's start page (the Launchpad's tile,
// a typed address), goes on to the page you last had open in it, in its language. Pages you reach inside it (a link,
// the ribbon's Navigate) stay where they are, and so does an editor opened on an item (sc_itemid in its address, as
// the Content Editor opens it). The page lives in the site's own localStorage.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const KEY = "sct-ee-state";
  // ponytail: a start page is / or a language's /en/; a site with two-letter page names at its root would match too
  const START = /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/?)?$/i;
  const done = new WeakSet();

  const braced = (id) => (/^[0-9a-f]{32}$/i.test(id) ? `{${id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")}}` : id);

  // reached from outside the site's pages: the Launchpad and the rest of /sitecore, another host, or nowhere
  function opened(doc) {
    try {
      const r = new URL(doc.referrer);
      return r.origin !== doc.location.origin || r.pathname.toLowerCase().startsWith("/sitecore/");
    } catch {
      return true;
    }
  }

  SCT.registerAid("ee-state", {
    apply({ doc }) {
      if (done.has(doc)) return;
      done.add(doc);
      const win = doc.defaultView;
      const val = (id) => doc.getElementById(id)?.value || "";
      const here = { id: braced(val("scItemID")), lang: val("scLanguage"), site: val("scSite") };
      if (!here.id) return;
      let saved = null;
      try {
        saved = JSON.parse(win.localStorage.getItem(KEY) || "null");
      } catch {
        // storage blocked: nothing is remembered
      }
      const u = new URL(win.location.href);
      if (saved && saved.id && (saved.id !== here.id || saved.lang !== here.lang) && saved.site === here.site
        && !u.searchParams.has("sc_itemid") && START.test(u.pathname) && opened(doc)) {
        u.pathname = "/";
        u.searchParams.delete("sc_resolvelanguage");
        u.searchParams.set("sc_itemid", saved.id);
        if (saved.lang) u.searchParams.set("sc_lang", saved.lang);
        if (saved.site) u.searchParams.set("sc_site", saved.site);
        return win.location.replace(u.href);
      }
      try {
        win.localStorage.setItem(KEY, JSON.stringify(here));
      } catch {
        // as above
      }
    },
  });
})(globalThis);
