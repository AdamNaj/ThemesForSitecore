// Safety net for token themes: maps the colours the build never saw with lib/color-map.js, in the page.
// Covers stylesheets outside Sitecore's stock files (modules, styles scripts write) and inline style
// attributes. Everything goes into one owned <style>; stop() takes it all back out.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const OWNED = "data-sct-owned";
  const INK = "data-sct-ink";
  const PREFIX = ":where(html[data-sct-tokens])";
  // The files tools/gen-area-map.mjs reads (its AREAS and EXCLUDE); <area>.gen.css already maps them.
  const STOCK = /\/sitecore\/(shell\/(themes\/standard|applications|controls|client)\/|login\/|admin\/[^/]+\.css$)|\/sitecore modules\/powershell\/styles\/(listview|dialogs|variableprompt|runner|ise|reports|gallery|iframe)\.css$|\/sitecore\.plugin\.identityserver\/content\/css\/site\.css$|^\/content\/css\/site\.css$/i;
  const NOT_STOCK = /\.old\.css$|\/testing\/|\/(lib|deps)\/(?!jquery\/jqueryui\/1\.13\.2\/smoothness\/)/i;
  // Ace's light editor is flipped by --sct-editor-filter (surfaces/shell.css), so it keeps its own colours.
  const KEEP_SELECTOR = /\.ace[-_]/i;
  const KEEP = ".ace_editor, [data-sct-owned]";
  const PROPS = [
    "color", "background-color", "background-image", "border-top-color", "border-right-color",
    "border-bottom-color", "border-left-color", "outline-color", "text-shadow",
  ];
  // SVG text without a fill of its own paints black; on a token theme it follows the text colour (charts' axes, legends).
  const SVG_TEXT = `:where(html[data-sct-tokens] svg text:not([fill], [fill] *)) { fill: currentColor; }`;

  // SVG paints in stylesheets (inline ones are chart data, left alone). Coloured ones carry data and
  // stay; greys follow the theme: strokes as borders, dark fills as text, light fills as backgrounds
  // unless the rule is about text (white labels on chart slices).
  function paints(st, selector) {
    const { role, first, parseColor, hsl } = SCT.colorMap;
    const out = [];
    for (const prop of ["fill", "stroke"]) {
      const c = first(st.getPropertyValue(prop));
      const parsed = c && parseColor(c);
      if (!parsed || parsed.a === 0) continue;
      const { s, l } = hsl(parsed);
      if (s >= 0.2) continue;
      const kind = prop === "stroke" ? "border" : l < 0.5 ? "fg" : /text/i.test(selector) ? null : "bg";
      const v = kind && role(c, kind);
      if (v) out.push(`${prop}: ${v}${st.getPropertyPriority(prop) === "important" ? " !important" : ""}`);
    }
    return out;
  }

  function isStock(href) {
    if (!href) return false;
    let path;
    try {
      path = decodeURIComponent(new URL(href).pathname);
    } catch {
      return false;
    }
    return STOCK.test(path) && !NOT_STOCK.test(path);
  }

  // Commas inside :is(), :not() or [attr="a,b"] don't separate selectors.
  function splitSelectors(text) {
    const out = [];
    let depth = 0, start = 0, quote = null;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth--;
      else if (c === "," && !depth) {
        out.push(text.slice(start, i));
        start = i + 1;
      }
    }
    out.push(text.slice(start));
    return out;
  }

  function createLiveMap(doc, note) {
    const { ruleDecls, BAD_SELECTOR, scoped, COLOR_RE, first, parseColor, hsl } = SCT.colorMap;
    const hint = new RegExp(COLOR_RE.source, "i");
    const html = doc.documentElement;
    // ponytail: rules a script adds with insertRule() to a sheet already mapped are not seen; drop the
    // cache entry on a CSSOM hook if a module turns out to build its styles that way.
    const sheets = new WeakMap(); // CSSStyleSheet -> mapped CSS text
    const inks = new Map(); // themed declarations -> rule for elements carrying that ink
    const style = doc.createElement("style");
    style.setAttribute(OWNED, "");
    let observer = null;
    let rendered = 0; // inks already in the <style>

    // The build maps every stock colour; here only light-scheme ones are (light backgrounds and borders,
    // dark text), so what is already drawn dark, like SPE's console, keeps its colours.
    function lightScheme([prop, value]) {
      const c = value && first(value);
      const parsed = c && parseColor(c);
      if (!parsed) return false;
      const { l } = hsl(parsed);
      return prop === "color" ? l < 0.5 : l >= 0.5;
    }

    const decls = (st, important) =>
      PROPS.map((p) => [p, st.getPropertyValue(p), important || st.getPropertyPriority(p) === "important"]).filter(lightScheme);

    function mapRules(rules, wrap, out) {
      for (const r of rules) {
        if (r.styleSheet) {
          if (!isStock(r.styleSheet.href)) mapSheet(r.styleSheet, wrap, out); // @import
        } else if (r.selectorText !== undefined) {
          if (!hint.test(r.style.cssText)) continue;
          const d = ruleDecls(decls(r.style, false)).concat(paints(r.style, r.selectorText));
          if (!d.length) continue;
          for (const s of splitSelectors(r.selectorText)) {
            if (BAD_SELECTOR.test(s) || KEEP_SELECTOR.test(s)) continue;
            const body = `${scoped(PREFIX, s)} { ${d.join("; ")}; }`;
            out.push(wrap.length ? `${wrap.join(" { ")} { ${body} ${"}".repeat(wrap.length)}` : body);
          }
        } else if (r.cssRules && (r.media || r.conditionText !== undefined)) {
          // @media, @supports, @container; @layer and @keyframes are left alone
          mapRules(r.cssRules, [...wrap, r.cssText.slice(0, r.cssText.indexOf("{")).trim()], out);
        }
      }
    }

    // Returns false while the sheet is still loading (Firefox throws InvalidAccessError then).
    function mapSheet(sheet, wrap, out) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (err) {
        return err.name === "SecurityError"; // cross-origin: nothing to read, ever
      }
      mapRules(rules, wrap, out);
      return true;
    }

    function sheetText(sheet) {
      let text = sheets.get(sheet);
      if (text === undefined) {
        const out = [];
        // A <link media="print"> keeps its media.
        const media = sheet.media && sheet.media.mediaText;
        if (!mapSheet(sheet, media ? [`@media ${media}`] : [], out)) return "";
        sheets.set(sheet, (text = out.join("\n")));
      }
      return text;
    }

    // Inline colours only lose to !important, so every themed one carries it.
    function ink(el) {
      const attr = el.getAttribute("style");
      // A theme's own elements (dom-kit) keep the colours the theme gave them.
      const d = attr && hint.test(attr) && !el.closest(KEEP) ? ruleDecls(decls(el.style, true)) : [];
      if (!d.length) {
        if (el.hasAttribute(INK)) el.removeAttribute(INK);
        return;
      }
      const key = d.join("; ");
      let rule = inks.get(key);
      if (!rule) {
        const id = inks.size.toString(36);
        rule = { id, css: `${PREFIX} [${INK}="${id}"] { ${key}; }` };
        inks.set(key, rule);
      }
      if (el.getAttribute(INK) !== rule.id) el.setAttribute(INK, rule.id);
    }

    function render() {
      const parts = [];
      for (const sheet of doc.styleSheets) {
        const node = sheet.ownerNode;
        if (sheet.disabled || (node && node.nodeType === 1 && node.hasAttribute(OWNED)) || isStock(sheet.href)) continue;
        parts.push(sheetText(sheet));
      }
      for (const rule of inks.values()) parts.push(rule.css);
      const text = [SVG_TEXT, ...parts].filter(Boolean).join("\n");
      if (style.textContent !== text) style.textContent = text;
      // Last child of <html>: after every sheet in <head> and <body>, so it wins at equal specificity.
      if (html.lastElementChild !== style) html.appendChild(style);
      rendered = inks.size;
    }

    function timed(fn) {
      const t0 = performance.now();
      fn();
      note(performance.now() - t0);
    }

    const isSheet = (n) => n.nodeName === "STYLE" || (n.nodeName === "LINK" && /stylesheet/i.test(n.rel));
    const onLoad = (e) => e.target && isSheet(e.target) && !e.target.hasAttribute(OWNED) && timed(render);

    function onMutations(records) {
      let sheetsChanged = false;
      for (const r of records) {
        if (r.type === "attributes") {
          ink(r.target);
          continue;
        }
        if (r.target.nodeName === "STYLE" && r.target !== style) sheetsChanged = true; // its text changed
        for (const list of [r.addedNodes, r.removedNodes]) {
          for (const n of list) {
            if (n.nodeType !== 1 || n === style) continue;
            if (isSheet(n) || (list === r.addedNodes && n.querySelector("style, link"))) sheetsChanged = true;
            if (list !== r.addedNodes) continue;
            if (n.hasAttribute("style")) ink(n);
            for (const el of n.querySelectorAll("[style]")) ink(el);
          }
        }
      }
      // ink() only adds rules, so a render is needed whenever the rule list grew too.
      if (sheetsChanged || inks.size !== rendered) render();
    }

    function start() {
      timed(() => {
        for (const el of doc.querySelectorAll("[style]")) ink(el);
        render();
      });
      observer = new MutationObserver((records) => timed(() => onMutations(records)));
      observer.observe(html, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
      doc.addEventListener("load", onLoad, true);
    }

    function stop() {
      if (observer) observer.disconnect();
      observer = null;
      doc.removeEventListener("load", onLoad, true);
      style.remove();
      for (const el of doc.querySelectorAll(`[${INK}]`)) el.removeAttribute(INK);
    }

    return { start, stop };
  }

  SCT.createLiveMap = createLiveMap;
  if (typeof module !== "undefined") module.exports = { createLiveMap, isStock, splitSelectors, paints };
})(globalThis);
