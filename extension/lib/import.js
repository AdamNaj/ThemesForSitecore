// Validates an imported CSS theme. Runs in the popup, using the browser's own CSS and URL parsers.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const MAX = 1024 * 1024;
  const META = /^\s*\/\*\s*@sct-theme\b([\s\S]*?)\*\//;
  const PROBE = "https://sitecore-host.invalid/sitecore/shell/";

  const fail = (error) => ({ ok: false, error });

  function readMeta(text) {
    const m = META.exec(text);
    if (!m) return { error: "Missing the /* @sct-theme ... */ metadata block at the top of the file." };
    const meta = {};
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^\s*([A-Za-z]+)\s*:\s*(.*?)\s*$/.exec(line);
      if (kv) meta[kv[1]] = kv[2];
    }
    if (!/^[a-z0-9-]{1,40}$/.test(meta.id || "")) return { error: "The id must be 1-40 lowercase letters, digits or dashes." };
    if (!meta.name) return { error: "The metadata block needs a name." };
    const versions = (meta.versions || "").split(",").map((v) => v.trim()).filter(Boolean);
    if (!versions.length || !versions.every((v) => /^\d+\.\d+$/.test(v))) {
      return { error: "versions must list Sitecore versions, for example: 10.4, 10.5" };
    }
    return { id: meta.id, name: meta.name, versions, usesTokens: /^(true|yes|1)$/i.test(meta.usesTokens || "") };
  }

  function unescapeCss(s) {
    return s.replace(/\\([0-9a-fA-F]{1,6}) ?|\\([\s\S])/g, (_, hex, ch) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch));
  }

  // Every resource reference in a serialized rule: url()/src() arguments and image-set() strings.
  function references(cssText) {
    const refs = [];
    const fn = /\b(?:url|src)\(\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|([^)]*))\s*\)/gi;
    for (const m of cssText.matchAll(fn)) refs.push(unescapeCss(m[1] ?? m[2] ?? m[3] ?? "").trim());
    for (const set of cssText.matchAll(/image-set\(([^;]*)/gi)) {
      for (const s of set[1].matchAll(/"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'/g)) refs.push(unescapeCss(s[1] ?? s[2]));
    }
    return refs;
  }

  // Allowed: data: URIs and anything that stays on the Sitecore host itself.
  function allowed(ref) {
    let url;
    try {
      url = new URL(ref, PROBE);
    } catch {
      return false;
    }
    return url.protocol === "data:" || url.origin === new URL(PROBE).origin;
  }

  // Rule types a theme may contain. Anything else (@import, @property, @function, @counter-style,
  // @namespace, rule types a future browser adds) is refused rather than inspected.
  const ALLOWED_RULES = new Set([
    "CSSStyleRule", "CSSNestedDeclarations", "CSSMediaRule", "CSSSupportsRule", "CSSContainerRule",
    "CSSLayerBlockRule", "CSSLayerStatementRule", "CSSScopeRule", "CSSStartingStyleRule",
    "CSSFontFaceRule", "CSSKeyframesRule", "CSSKeyframeRule",
  ]);

  function allRules(list, out = []) {
    for (const rule of list) {
      out.push(rule);
      if (rule.cssRules) allRules(rule.cssRules, out);
    }
    return out;
  }

  // The whole declaration block: shorthands that use var() only show their raw text here,
  // their longhands read as empty.
  function values(style) {
    return style ? [style.cssText] : [];
  }

  // Declarations that use var() or env() are stored as raw tokens and re-parsed later, so escapes,
  // dashed-function calls and every string or url() in any value are checked, not just in url().
  function valueProblem(value) {
    if (value.includes("\\")) return "Backslash escapes aren't allowed in values";
    if (/--[\w-]*\(/.test(value)) return "Custom functions aren't allowed";
    if (/(?:image-set|\bsrc)\([^;]*\b(?:var|env)\(/i.test(value)) return "var() and env() can't be used inside image-set() or src()";
    for (const m of value.matchAll(/"([^"]*)"|'([^']*)'/g)) {
      if (!allowed(m[1] ?? m[2])) return `Only data: URLs and URLs on the Sitecore host are allowed. Found "${m[1] ?? m[2]}"`;
    }
    const bad = references(value).find((ref) => !allowed(ref));
    if (bad !== undefined) return `Only data: URLs and URLs on the Sitecore host are allowed. Found "${bad}"`;
    return null;
  }

  async function parse(text) {
    if (text.length > MAX) return fail("The theme is larger than 1 MB.");
    const meta = readMeta(text);
    if (meta.error) return fail(meta.error);

    // An inert document parses the CSS without loading anything it references.
    const doc = document.implementation.createHTMLDocument("");
    const style = doc.createElement("style");
    style.textContent = text;
    doc.head.append(style);
    const rules = [...style.sheet.cssRules];

    for (const rule of allRules(rules)) {
      const where = rule.cssText.slice(0, 200);
      if (!ALLOWED_RULES.has(rule.constructor.name)) return fail(`This kind of rule isn't allowed: ${where}`);
      for (const value of values(rule.style)) {
        const problem = valueProblem(value);
        if (problem) return fail(`${problem}: ${where}`);
      }
    }

    return {
      ok: true,
      theme: { id: `import:${meta.id}`, name: meta.name, versions: meta.versions, usesTokens: meta.usesTokens, css: rules.map((r) => r.cssText).join("\n") },
    };
  }

  SCT.importTheme = { parse };
})(globalThis);
