// Language: <html lang> from Sitecore's UI language, so a screen reader speaks the page in it. Sitecore keeps it in
// the shell#lang cookie, puts it in the address as sc_lang, and classes its forms lang_<code>. A page that says its
// own language keeps it.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

  function uiLanguage(doc) {
    const cookie = doc.cookie.split(/;\s*/).find((c) => c.startsWith("shell#lang="));
    const form = doc.querySelector('form[class*="lang_"]');
    const found = [
      cookie && decodeURIComponent(cookie.slice(11)),
      new URL(doc.URL).searchParams.get("sc_lang"),
      form && (form.className.match(/\blang_([\w-]+)/) || [])[1],
    ];
    return found.find((v) => v && CODE.test(v)) || null;
  }

  SCT.registerAid("lang", {
    apply(ctx) {
      const html = ctx.doc.documentElement;
      if (html.hasAttribute("lang")) return;
      const lang = uiLanguage(ctx.doc);
      if (lang) ctx.setAttr(html, "lang", lang);
    },
  });
})(globalThis);
