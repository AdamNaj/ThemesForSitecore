// Points literal colours at --sct-* roles. tools/gen-area-map.mjs runs it over Sitecore's stock
// stylesheets at build time; lib/live-map.js runs it in the page over everything that build never saw.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const NAMED = {
    white: "#ffffff", black: "#000000", silver: "#c0c0c0", gray: "#808080", grey: "#808080",
    red: "#ff0000", blue: "#0000ff", navy: "#000080", yellow: "#ffff00", green: "#008000",
    maroon: "#800000", lightgray: "#d3d3d3", lightgrey: "#d3d3d3", darkgray: "#a9a9a9",
    darkgrey: "#a9a9a9", whitesmoke: "#f5f5f5", gainsboro: "#dcdcdc", dimgray: "#696969", dimgrey: "#696969",
  };
  const COLOR_RE = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black|silver|gr[ae]y|red|blue|navy|yellow|green|maroon|light(?:gr[ae]y)|dark(?:gr[ae]y)|whitesmoke|gainsboro|dimgr[ae]y|transparent)\b/gi;

  function parseColor(text) {
    const t = text.toLowerCase();
    if (t === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const hex = NAMED[t] || (t.startsWith("#") ? t : null);
    if (hex) {
      let h = hex.slice(1);
      if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
      if (h.length !== 6 && h.length !== 8) return null;
      const n = (i) => parseInt(h.slice(i, i + 2), 16);
      return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
    }
    const hm = /hsla?\(([^)]*)\)/.exec(t);
    if (hm) {
      const [h, sat, lig, a = 1] = hm[1].split(/[\s,/%]+/).filter(Boolean).map(parseFloat);
      if ([h, sat, lig].some(Number.isNaN)) return null;
      const S = sat / 100, L = lig / 100;
      const k = (n) => (n + h / 30) % 12;
      const f = (n) => L - S * Math.min(L, 1 - L) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
      return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a };
    }
    const m = /rgba?\(([^)]*)\)/.exec(t);
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  function hsl({ r, g, b }) {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    return { h: h * 60, s, l };
  }

  // kind: "bg" | "fg" | "border". Returns a CSS value or null (leave the original alone).
  function role(colorText, kind) {
    const c = parseColor(colorText);
    if (!c || c.a === 0) return null;
    const { h, s, l } = hsl(c);
    if (c.a < 1) {
      const pct = Math.round(c.a * 100);
      if (l < 0.5) return `color-mix(in srgb, var(--sct-app-fg) ${pct}%, transparent)`;
      return `color-mix(in srgb, var(--sct-panel-bg) ${pct}%, transparent)`;
    }
    const saturated = s >= 0.2 && l > 0.08 && l < 0.97;
    if (saturated) {
      const brand = h >= 190 && h <= 300;
      if (brand) {
        if (kind === "bg") return l >= 0.85 ? "var(--sct-selected-bg)" : "var(--sct-accent)";
        if (kind === "fg") return "var(--sct-link)";
        return "var(--sct-accent)";
      }
      if (kind === "bg" && l >= 0.85) return `color-mix(in srgb, ${colorText} 25%, var(--sct-panel-bg))`;
      return null; // status colours (errors, warnings, success) keep their meaning
    }
    if (kind === "bg") {
      if (l >= 0.985) return "var(--sct-panel-bg)";
      if (l >= 0.88) return "var(--sct-app-bg)";
      if (l >= 0.7) return "var(--sct-raised-bg)";
      return "var(--sct-chrome-bg)";
    }
    if (kind === "fg") {
      if (l < 0.45) return "var(--sct-app-fg)";
      if (l < 0.8) return "var(--sct-muted-fg)";
      return "var(--sct-chrome-fg)";
    }
    return l >= 0.55 ? "var(--sct-border)" : "var(--sct-border-strong)";
  }

  const first = (value) => (value.match(COLOR_RE) || [])[0];

  // Rewrites one declaration into themed declarations (possibly several, possibly none).
  function rewrite(prop, value) {
    const out = [];
    const add = (p, v) => v && out.push([p, v]);
    const hasGradient = /gradient\(/i.test(value);
    switch (prop) {
      case "color":
        add("color", first(value) && role(first(value), "fg"));
        break;
      case "background-color":
        add("background-color", first(value) && role(first(value), "bg"));
        break;
      case "background":
      case "background-image": {
        const c = first(value);
        let bare = value;
        while (/\([^()]*\)/.test(bare)) bare = bare.replace(/\([^()]*\)/g, "");
        if (hasGradient && /\//.test(bare)) {
          // A sized gradient (`... / 1px 12px`) draws a line, not a fill: keep it, recoloured as a border.
          // ponytail: only the shorthand's own size is seen; a separate background-size still flattens.
          add(prop, value.replace(COLOR_RE, (m) => role(m, "border") || m));
        } else if (hasGradient) {
          // Only flatten gradients drawn from literal colours; leave var()-based and image-only ones alone.
          const r = c && role(c, "bg");
          if (r) {
            // A gradient layered under an icon (url()) keeps the icon; only the colour changes.
            if (!/url\(/i.test(value)) add("background-image", "none");
            add("background-color", r);
          }
        } else if (prop === "background" && c) {
          add("background-color", role(c, "bg"));
        }
        break;
      }
      case "border":
      case "border-top":
      case "border-right":
      case "border-bottom":
      case "border-left":
      case "outline": {
        const c = first(value);
        add(`${prop}-color`, c && role(c, "border"));
        break;
      }
      case "border-color":
      case "border-top-color":
      case "border-right-color":
      case "border-bottom-color":
      case "border-left-color":
      case "outline-color": {
        const colors = value.match(COLOR_RE) || [];
        if (colors.length === 1) add(prop, role(colors[0], "border"));
        else if (colors.length > 1) {
          const mapped = colors.map((c) => role(c, "border") || c);
          add(prop, mapped.join(" "));
        }
        break;
      }
      case "text-shadow": {
        const c = first(value);
        const parsed = c && parseColor(c);
        if (parsed && hsl(parsed).l > 0.7) add("text-shadow", "none");
        break;
      }
    }
    return out;
  }

  // One rule's declarations ([prop, value, important]) as themed "prop: value" strings.
  function ruleDecls(decls, onMapped) {
    const out = [];
    for (const [prop, value, important] of decls) {
      for (const [p, v] of rewrite(prop.toLowerCase(), value)) {
        out.push(`${p}: ${v}${important ? " !important" : ""}`);
        if (onMapped) onMapped(prop, value);
      }
    }
    // Text that shares a rule with an accent background sits on that accent (buttons, active tabs).
    if (out.some((d) => /^background-color: var\(--sct-accent\)/.test(d))) {
      for (let i = 0; i < out.length; i++) out[i] = out[i].replace(/^color: var\(--sct-chrome-fg\)/, "color: var(--sct-accent-fg)");
    }
    return out;
  }

  const BAD_SELECTOR = /::?-(moz|ms|o)-|\*\s*html|\*\+html|:-ms-|expression\(/i;

  // Sitecore's selectors may start at <html> itself (SPEAK pages put .sc-flx on it), so the original
  // selector goes inside :is(), whose ancestors can be anywhere, including <html>. :is() keeps the
  // selector's own specificity. Pseudo-elements aren't allowed inside :is() and stay outside.
  function scoped(prefix, part) {
    const p = part.trim();
    if (/^html\b/i.test(p)) return prefix + p.slice(4);
    if (/^:root\b/i.test(p)) return prefix + p.slice(5);
    const m = /^(.*?)(::?(?:before|after|placeholder|selection|first-line|first-letter|marker|-webkit-[\w-]+)(?:\([^)]*\))?)$/i.exec(p);
    return m && m[1] ? `${prefix} :is(${m[1]})${m[2]}` : `${prefix} :is(${p})`;
  }

  SCT.colorMap = { NAMED, COLOR_RE, parseColor, hsl, role, first, rewrite, ruleDecls, BAD_SELECTOR, scoped };
  if (typeof module !== "undefined") module.exports = SCT.colorMap;
})(globalThis);
