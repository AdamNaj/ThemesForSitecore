// Dev tool: CSS that puts Sitecore 10.5's stylesheets back to their 10.4 values.
// Every output rule carries the theme prefix, so it beats the 10.5 rule with the same selector. Per rule:
// - a property 10.5 changed or dropped gets its 10.4 value; a rule 10.5 dropped comes back whole;
// - a property 10.5 added gets the value 10.4 had there: the 10.4 shorthand in the same rule, else the value of the
//   strongest 10.4 rule whose subject covers this one (classes, then the classes of the selectors 10.5 grouped with it,
//   then a Bootstrap base class), else `unset`;
// - the prefix also lifts restored rules over 10.4 rules that used to beat them (`.scEditorQuickInfo input`
//   over `input[type="text"]`), so those stronger 10.4 rules for the same element are restated too ("closure").
// Files are walked in the order Sitecore pages load them (Default.css first), declarations keep 10.4's order.
// Checked by rendering 10.5 pages with their stylesheets swapped for the stock 10.4.1 files and diffing computed styles.
// Never hand-edit the output; hand-written fixes live in extension/themes/sitecore104/glyphs.css.
//
// Usage: node tools/css-diff.mjs [flags] <stock-10.4-root> <10.5-root> <prefix> [glob...] > out.css
// Sitecore 10.4 theme, OLD=<stock 10.4.1 webroot>, NEW=<stock 10.5.0 webroot> (sitecore.local.json webroots),
// P='html[data-sct-theme="sitecore104"]', OUT="sitecore/shell/Applications/Page Modes/Output":
//   shell.css:     node tools/css-diff.mjs $OLD $NEW
//   speak.css:     node tools/css-diff.mjs --no-closure --assets=extension/themes/sitecore104/glyphs "--pair=$OLD/$OUT/<10.4 ribbon bundle>.css=$OUT/<10.5 ribbon bundle>.css"
//                    $OLD $NEW "$P" "sitecore/shell/client/**/*.css"
//   launchpad.css: node tools/css-diff.mjs --page --cross-closure $OLD $NEW "$P"
//                    sitecore/shell/client/Speak/Assets/css/speak-default-theme.css sitecore/shell/client/Applications/LaunchPad/LaunchPad.css
//   ee.css:        node tools/css-diff.mjs --pairs-only --page --cross-closure --chrome
//                    "--pair=$OLD/$OUT/12847890318263804295.css=$OUT/5538856292437293975.css" $OLD $NEW "$P"
//   (bundle hashes today: ribbon 10.4 10013497012240091407.css / 10.5 1729761776899644558.css, page chrome
//    10.4 12847890318263804295.css / 10.5 5538856292437293975.css; Sitecore renames them on rebuild)
// --pairs-only: no globs, only the --pair sheets. --chrome: see isChrome below (the EE page is the website).
//
// --to-10.5: the reverse, for the Sitecore 10.5 theme (10.5's look on 10.4): the roots swap, so "10.4" above reads
// "the look wanted" and "10.5" reads "the sheets on the page". The --pair target may then be an absolute path.
// Sitecore 10.5 theme, same OUT, P='html[data-sct-theme="sitecore105"]', D=extension/themes/sitecore105,
// W=$NEW (stock 10.5), S=$OLD (stock 10.4.1):
//   (each command also takes --assets=$D/glyphs, and writes to $D/<file>)
//   shell.css:     node tools/css-diff.mjs --to-10.5 $W $S "$P"
//   speak.css:     node tools/css-diff.mjs --to-10.5 --no-closure "--pair=$W/$OUT/1729761776899644558.css=$S/$OUT/2409741280493854548.css"
//                    $W $S "$P" "sitecore/shell/client/**/*.css"
//   launchpad.css: node tools/css-diff.mjs --to-10.5 --page --cross-closure $W $S "$P"
//                    sitecore/shell/client/Speak/Assets/css/speak-default-theme.css sitecore/shell/client/Applications/LaunchPad/LaunchPad.css
//   ee.css:        node tools/css-diff.mjs --to-10.5 --pairs-only --page --cross-closure --chrome
//                    "--pair=$W/$OUT/5538856292437293975.css=$S/$OUT/16980713487153227243.css" $W $S "$P"
//   10.5 rules read ColorVariables.css's custom properties, which 10.4 has no file for: vars.css carries them (hand-copied); fixes.css holds the hand-written fixes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postcss from "postcss";

// --no-closure / --cross-closure (lift only over rules of other files): within SPEAK's Bootstrap sheets the closure chains
// every .btn variant to every other (+180 KB) and measured worse.
// --page: the globs are exactly the sheets one page loads (Launchpad), so every file counts as core.
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const closure = !flags.has("--no-closure");
const crossOnly = flags.has("--cross-closure");
const toNew = flags.has("--to-10.5");
const [oldRoot, newRoot, prefix = `html[data-sct-theme="${toNew ? "sitecore105" : "sitecore104"}"]`, ...globArgs] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const globs = flags.has("--pairs-only") ? [] : globArgs.length ? globArgs : ["sitecore/shell/Themes/Standard/**/*.css", "sitecore/shell/Applications/**/*.css", "sitecore/shell/Controls/*/*.css"];
const SKIP = [/\.min\.css$/i, /\.old\.css$/i, /\/(lib|deps|testing)\//i, /page modes\/output/i];
// Load order on Sitecore pages: base sheets first (SPEAK 2 speak-components before SPEAK 1 speak-default-theme, so the
// SPEAK 1 values win where both restore a selector: Control Panel and the Experience Editor ribbon are SPEAK 1), GlobalHeader.css last.
const rank = (rel) => (/\/Standard\/Default\/Default\.css$|\/speak-default-theme\.css$|\/speak-components\.css$/i.test(rel) ? 0 : /\/Ribbon\.css$/i.test(rel) ? 1 : /\/GlobalHeader\.css$/i.test(rel) ? 3 : 2);

// Specificity as one number, and the subject compound's tag / classes / pseudo-classes.
function specificity(sel) {
  let s = sel.replace(/:not\(([^)]*)\)/g, " $1").replace(/\[[^\]]*\]/g, ".a");
  let elems = 0;
  s = s.replace(/::?(before|after|first-line|first-letter|placeholder|selection|-[\w-]+)\b/gi, () => (elems++, ""));
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const cls = (s.match(/\.[\w-]+|:[\w-]+(\([^)]*\))?/g) || []).length;
  const tags = (s.replace(/[.#:][\w-]+(\([^)]*\))?/g, "").match(/[a-z][\w-]*/gi) || []).length;
  return ids * 1e6 + cls * 1e3 + tags + elems;
}
function subject(sel) {
  const last = sel.replace(/\[[^\]]*\]/g, "[]").trim().split(/\s*[>+~]\s*|\s+/).pop().replace(/::?(before|after)\b.*/i, "");
  return { tag: (last.match(/^[a-z][\w-]*/i) || [""])[0].toLowerCase(), classes: (last.match(/\.[\w-]+/g) || []).map((c) => c.slice(1)), ids: last.match(/#[\w-]+/g) || [], pseudo: (last.match(/:[\w-]+/g) || []).sort().join("") };
}
const family = (p) => (/^border-.*radius$/.test(p) ? "border-radius" : (p.match(/^(border|background|padding|margin|font|outline|list-style)\b/) || [p])[0]);

const FALLBACK = "\u0000";
// The rules of one stylesheet, in source order: { key: "@media x || selector", sel, decls: Map(prop -> value) }
function rules(file, base) {
  const out = new Map();
  const root = postcss.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  const dir = "/" + path.posix.dirname(path.relative(base, file).replaceAll("\\", "/"));
  root.walkRules((rule) => {
    const chain = [];
    for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
      if (p.type === "atrule") {
        if (/keyframes|font-face/i.test(p.name)) return;
        chain.unshift(`@${p.name} ${p.params}`);
      }
    }
    for (const raw of rule.selectors) {
      const sel = raw.trim().replace(/\s+/g, " ");
      const key = [...chain, sel].join(" || ");
      const r = out.get(key) || { key, sel, group: rule.selectors.map((x) => x.trim()), decls: new Map() };
      const seen = new Set();
      rule.each((d) => {
        if (d.type !== "decl" || d.prop.startsWith("--")) return; // custom properties: 10.5 rules read them, never reset
        // Relative image URLs resolve against the original stylesheet, not the extension.
        const value = d.value.replace(/url\(\s*(['"]?)(?!data:|\/|https?:)([^'")]+)\1\s*\)/gi, (_, q, rel) => `url("${path.posix.join(dir, rel)}")`);
        // Repeats inside one rule are fallback chains (background: #e6e6e6; background: -webkit-gradient(...)); keep them all.
        const prop = d.prop.toLowerCase(), v = value + (d.important ? " !important" : "");
        // A repeated selector merges like the cascade: a later normal value never beats an earlier !important one.
        if (!seen.has(prop) && /!important$/.test(r.decls.get(prop) || "") && !d.important) return;
        r.decls.set(prop, seen.has(prop) ? r.decls.get(prop) + FALLBACK + v : v);
        seen.add(prop);
      });
      out.delete(key); // a repeated selector takes the later position, like the cascade
      out.set(key, r);
    }
  });
  return out;
}

// The 10.4 shorthand in `decls` that sets longhand `prop` (border-top-color: border-top, border-color, border).
function shorthandOf(prop, decls) {
  const m = prop.match(/^border-(top|right|bottom|left)-(color|style|width)$/);
  const cands = m ? [`border-${m[1]}`, `border-${m[2]}`, "border"] : /^border-.*-radius$/.test(prop) ? ["border-radius"]
    : /^border-(top|right|bottom|left|color|style|width)$/.test(prop) ? ["border"] : /^border/.test(prop) ? [] // border-radius is no part of border
    : prop.split("-").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("-")).reverse();
  return cands.find((c) => decls.has(c));
}
const valueIn = (prop, decls) => (decls.has(prop) ? [prop, decls.get(prop)] : (shorthandOf(prop, decls) && [shorthandOf(prop, decls), decls.get(shorthandOf(prop, decls))]));

// Same element, judged by selector: shares a subject class that names a component (state classes such as
// .active or .open are shared by unrelated components), or (classless subject) the same tag.
const STATE = /^(active|disabled|open|focus|hover|in|show|selected|checked|collapsed|expanded|sc|ui-state-.*|is-.*|has-.*)$/;
const sameElement = (a, b) => (a.classes.length ? a.classes.some((c) => !STATE.test(c) && b.classes.includes(c)) : !!a.tag && a.tag === b.tag);

// node tools/css-diff.mjs --self-test: the selector helpers on cases that broke once.
if (flags.has("--self-test")) {
  const { strict: assert } = await import("node:assert");
  assert.ok(specificity("ul.sc-accountInformation li:last-child:after") > specificity("ul.sc-accountInformation li:after"));
  assert.ok(specificity(".scEditorQuickInfo input") === specificity('input[type="text"]'));
  assert.deepEqual(subject(".a > b.c.d:hover::after"), { tag: "b", classes: ["c", "d"], ids: [], pseudo: ":hover" });
  assert.equal(shorthandOf("border-radius", new Map([["border", "0"]])), undefined); // border-radius is no part of border
  assert.equal(shorthandOf("border-top-color", new Map([["border", "0"]])), "border");
  assert.equal(shorthandOf("background-position", new Map([["background", "none"]])), "background");
  console.log("css-diff self-test ok");
  process.exit(0);
}

// ---- read every stylesheet pair, in load order ----
const files = [];
for (const g of globs) {
  const rels = fs.globSync(g, { cwd: newRoot }).map((r) => r.replaceAll("\\", "/")).filter((r) => !SKIP.some((x) => x.test(r)) && fs.existsSync(path.join(oldRoot, r)));
  rels.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const rel of rels) {
    const a = fs.readFileSync(path.join(oldRoot, rel), "utf8"), b = fs.readFileSync(path.join(newRoot, rel), "utf8");
    files.push({ rel, changed: a !== b, before: rules(path.join(oldRoot, rel), oldRoot), after: a === b ? null : rules(path.join(newRoot, rel), newRoot) });
  }
}
// --pair=<10.4 file>=<10.5 rel path>: sheets whose names differ, such as the Experience Editor ribbon bundles that
// Sitecore builds per install under Page Modes/Output/<hash>.css.
for (const flag of flags) {
  const m = flag.match(/^--pair=(.+\.css)=(.+\.css)$/i);
  if (!m) continue;
  const oldFile = m[1].replaceAll("\\", "/"), base = oldFile.slice(0, oldFile.toLowerCase().indexOf("/sitecore/"));
  const newFile = path.resolve(newRoot, m[2]), rel = path.relative(newRoot, newFile).replaceAll("\\", "/");
  files.push({ rel, changed: true, before: rules(oldFile, base), after: rules(newFile, newRoot) });
}
// Sheets most Sitecore pages load. Rules from other files only count as competitors for rules of their own file:
// a bare `a:visited` in an app's sheet must not be restated on every page.
const CORE_RE = /\/Standard\/Default\/(Default|Content Manager|Ribbon|GlobalHeader|Shell|Startbar|Dialogs)\.css$|\/speak-default-theme\.css$|\/speak-components\.css$/i;
const CORE = { test: (rel) => flags.has("--page") || CORE_RE.test(rel) };
const near = (file, r) => r.file === file || CORE.test(r.file.rel);

const old = []; // every 10.4 rule, in global order
for (const f of files) for (const r of f.before.values()) old.push(Object.assign(r, { file: f, order: old.length, spec: specificity(r.sel), subj: subject(r.sel) }));

// The 10.4 value for a property 10.5 added to selector `sel`: the strongest same-element 10.4 rule that sets it.
// Nothing found: the selectors 10.5 grouped with it name the same kind of element (`a.scEditorHeaderVersionsLanguage`
// sits next to `a.scEditorHeaderNavigator.scEditorHeaderButton.scButton`), so their classes are tried too.
function inherited10_4(file, sel, prop, group = []) {
  const own = byClasses(file, subject(sel), prop);
  if (own) return own;
  const subj = subject(sel);
  subj.classes = [...new Set(group.flatMap((g) => subject(g).classes))];
  const grouped = byClasses(file, subj, prop);
  if (grouped) return grouped;
  // Bootstrap modifiers sit on their base class: .btn-default is always a .btn.
  subj.classes = subj.classes.map((c) => c.replace(/-[^-]+$/, "")).filter((c) => BASES.has(c));
  const based = subj.classes.length && byClasses(file, subj, prop);
  // Last, for a subject named by id alone (#TreeSearch): global element rules (input[type="text"]). A classed subject
  // (Telerik's .rfdSkinnedButton) is styled by sheets this tool never sees, so element defaults would be guesses.
  const own0 = subject(sel);
  return based || (!own0.classes.length && byClasses(file, own0, prop, false)) || [prop, "unset"];
}
const BASES = new Set(["btn", "label", "badge", "alert", "panel", "list-group-item", "table", "progress-bar", "nav", "navbar"]);
// Every element `subj` matches also matches rule subject `r` (as far as classes, ids and tag tell).
const covers = (subj, r) => (r.classes.length || r.ids.length || r.tag) && r.classes.every((c) => subj.classes.includes(c))
  && r.ids.every((i) => subj.ids.includes(i)) && (!r.tag || r.tag === subj.tag);
function byClasses(file, subj, prop, classed = true) {
  let best = null;
  for (const r of old) {
    if (classed && (subj.classes.length || subj.ids.length) && !r.subj.classes.length && !r.subj.ids.length) continue;
    if (!near(file, r) || !covers(subj, r.subj) || !r.subj.pseudo.split(":").every((p) => !p || subj.pseudo.includes(":" + p))) continue;
    if (r.key.includes(" || ")) continue; // media-conditional rules are no evidence for the base value
    if (!subj.classes.length && /[\s>+~]/.test(r.sel)) continue; // a bare `li` only inherits from global element rules, not `.sc-menu li`
    const v = valueIn(prop, r.decls);
    // A rule without ancestors applies wherever the element is; `.input-group .btn` only in one context.
    const rank = [Number(!/[\s>+~]/.test(r.sel)), r.spec, r.order];
    if (v && (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && (rank[1] > best.rank[1] || (rank[1] === best.rank[1] && rank[2] > best.rank[2]))))) best = { r, v, rank };
  }
  return best && best.v;
}

// ---- what to emit: Map(file -> { fresh: Map(key -> {sel, decls}), restated: Map(order -> {rule, decls}) }) ----
const out = new Map(files.map((f) => [f, { fresh: new Map(), restated: new Map() }]));
// Output is injected on every page, not only where the app's sheet loads: an app sheet's rule for a component the core
// sheets style (Personalization.css's `.scDialogContentContainer`) would restyle every dialog, so it is left out.
const coreClasses = new Set(old.filter((r) => CORE.test(r.file.rel)).flatMap((r) => r.sel.match(/\.[\w-]+/g) || []).map((c) => c.slice(1)));
const local = (file, sel) => CORE.test(file.rel) || /#[\w-]/.test(sel) || subject(sel).classes.some((c) => !coreClasses.has(c));
const restate = (r, prop, value) => {
  if (!local(r.file, r.sel)) return false;
  const o = out.get(r.file).restated;
  const e = o.get(r.order) || { rule: r, decls: new Map() };
  if (e.decls.get(prop) === value) return false;
  e.decls.set(prop, value);
  // A restored shorthand resets its longhands: the rule's own longhands (background-position after background) follow it.
  for (const [p, v] of r.decls) if (p.startsWith(prop + "-") && value !== "unset") { const kept = e.decls.get(p) ?? v; e.decls.delete(p); e.decls.set(p, kept); }
  o.set(r.order, e);
  return true;
};
for (const f of files) {
  if (!f.changed) continue;
  for (const [key, { decls }] of f.after) {
    const was = f.before.get(key);
    if (!was) { // only 10.5 has this rule
      const e = { file: f, sel: key.split(" || ").pop(), decls: new Map() };
      // 10.5's !important must be outranked too: an `unset` without it leaves 10.5's value in place (the rules
      // editor's search glyph tiled when its no-repeat was unset but its !important image was not)
      for (const [p, nv] of decls) {
        const [q, v] = inherited10_4(f, e.sel, p, f.after.get(key).group);
        e.decls.set(q, /!important$/.test(nv) && !/!important$/.test(v) ? `${v} !important` : v);
      }
      if (local(f, e.sel)) out.get(f).fresh.set(key, e);
      continue;
    }
    const r = was;
    for (const [p, v] of decls) {
      if (was.decls.get(p) === v) continue;
      const [q, w] = was.decls.has(p) ? [p, was.decls.get(p)] : valueIn(p, was.decls) || inherited10_4(f, was.sel, p, f.after.get(key).group);
      restate(r, q, /!important$/.test(v) && !/!important$/.test(w) && w !== "unset" ? `${w} !important` : w); // outrank 10.5's !important
    }
    for (const [p, v] of was.decls) if (!decls.has(p)) restate(r, p, v); // dropped by 10.5
  }
  for (const r of old) if (r.file === f && !f.after.has(r.key)) for (const [p, v] of r.decls) restate(r, p, v); // rule dropped by 10.5
}
// Closure: a restated rule now outranks 10.4 rules that beat it in 10.4; restate those too (same element, same property family).
// State variants of the same selector (`li:after` -> `li:last-child:after`) are always lifted, whatever the mode.
const stem = (sel) => sel.replace(/::?[\w-]+(\([^)]*\))?/g, "");
for (let changed = true, round = 0; changed && round < 6; round++) {
  changed = false;
  const seeds = [];
  for (const o of out.values()) {
    for (const e of o.restated.values()) seeds.push({ stem: stem(e.rule.sel), file: e.rule.file, spec: e.rule.spec, order: e.rule.order, subj: e.rule.subj, fams: new Set([...e.decls.keys()].map(family)) });
    for (const e of o.fresh.values()) seeds.push({ stem: stem(e.sel), file: e.file, spec: specificity(e.sel), order: -1, subj: subject(e.sel), fams: new Set([...e.decls.keys()].map(family)) });
  }
  for (const s of seeds) {
    if (!s.subj.tag && !s.subj.classes.length) continue;
    for (const r of old) {
      if (!(r.spec > s.spec || (r.spec === s.spec && r.order > s.order))) continue;
      // Same file, same selector refined by state or an extra class (.row1 -> .row1.no-breadcrumb, li:after -> li:last-child:after).
      const variant = r.file === s.file && (stem(r.sel) === s.stem || (stem(r.sel).startsWith(s.stem) && stem(r.sel)[s.stem.length] === "."));
      if (!variant && (!closure || !near(s.file, r) || (crossOnly && r.file === s.file) || !sameElement(s.subj, r.subj))) continue;
      if (!s.subj.classes.length && r.subj.classes.length) continue; // a tag rule (input[type=text]) only lifts over classless tag rules
      for (const [p, v] of r.decls) if (s.fams.has(family(p)) && restate(r, p, v)) changed = true;
    }
  }
}

// ---- print ----
const scoped = (sel) => (/^html\b/i.test(sel) ? prefix + sel.slice(4) : /^:root\b/.test(sel) ? prefix + sel.slice(5) : `${prefix} ${sel}`);
// `order`: the 10.4 rule's own declaration order, kept so shorthands and longhands stack as they did in 10.4.
// --chrome (the Experience Editor page, which is the website): only rules whose subject carries a Sitecore chrome
// class or id (.scChromeToolbar, #scFieldValues; sc + capital, sc-, scpm) and no sibling combinator, never color-scheme.
// `.scEnabledChrome img` is the website's own image and is left out.
const CHROME = /[.#](sc[A-Z]|sc-|scpm\b)/;
const isChrome = (sel) => !/[+~]/.test(sel) && CHROME.test(sel.replace(/\[[^\]]*\]/g, "[]").trim().split(/\s*>\s*|\s+/).pop());
// --assets=<extension dir>/themes/<id>/glyphs: an image the output points at that the page's install lacks (or has with other
// bytes; 10.4 has no 10.5 glyphs), and every embedded image, is served from the extension (sct-ext:, web_accessible_resources)
// as our own drawing there, never as Sitecore's file: a stock <name>.<ext> becomes <name>.svg, an embedded one the name
// EMBEDDED gives its bytes (md5, first 8). tools/build-sitecore-glyphs.mjs draws them.
const EMBEDDED = {
  "62d7bc56": "speak_restore", cf01c937: "speak_restore_h", "1921d2ca": "speak_maximize", "406e6b26": "speak_maximize_h", // 10.4 SPEAK
  "0ccbaa21": "dialog_restore_v2", "0c250476": "dialog_maximize_v2", // 10.5 SPEAK
};
const assets = [...flags].find((x) => x.startsWith("--assets="))?.slice(9).replaceAll("\\", "/");
const glyph = (name) => {
  if (!assets) throw new Error(`${name}: an image to serve from the extension needs --assets`);
  if (!fs.existsSync(path.join(assets, `${name}.svg`))) throw new Error(`no ${name}.svg in ${assets}: draw it in tools/build-sitecore-glyphs.mjs`);
  return `url("sct-ext:${assets.slice(assets.indexOf("themes/"))}/${name}.svg")`;
};
const assetUrl = (v) => v
  .replace(/url\(\s*(['"]?)data:image\/[^;]+;base64,([^'")]+)\1\s*\)/gi, (_, q, b64) => {
    const h = crypto.createHash("md5").update(Buffer.from(b64, "base64")).digest("hex").slice(0, 8);
    if (!EMBEDDED[h]) throw new Error(`embedded image ${h}: draw it in tools/build-sitecore-glyphs.mjs and name it in EMBEDDED`);
    return glyph(EMBEDDED[h]);
  })
  .replace(/url\(\s*(['"]?)(\/[^'")?#]+)[^'")]*\1\s*\)/gi, (all, q, rel) => {
    if (!assets) return all;
    const from = path.join(oldRoot, decodeURIComponent(rel)), at = path.join(newRoot, decodeURIComponent(rel));
    if (!fs.existsSync(from) || (fs.existsSync(at) && fs.readFileSync(at).equals(fs.readFileSync(from)))) return all;
    return glyph(path.basename(from, path.extname(from)).toLowerCase());
  });
// Rules for old Internet Explorer (.ie9, .lt-ie9: classes Sitecore adds there) never match; their gradients are embedded SVGs.
const IE = /\.(lt-)?ie\d+\b/;
const print = (key, decls, order = []) => {
  if (IE.test(key)) return null;
  if (flags.has("--chrome")) {
    if (!isChrome(key.split(" || ").pop())) return null;
    decls = new Map([...decls].filter(([p]) => p !== "color-scheme"));
    if (!decls.size) return null;
  }
  const at = (p) => order.indexOf(p);
  const list = [...decls].sort((x, y) => at(x[0]) - at(y[0])).flatMap(([p, v]) => v.split(FALLBACK).map((x) => `${p}: ${assetUrl(x)}`));
  // Resets first, so a reset shorthand (border: unset) never wipes a restored longhand (border-top).
  const reset = (d) => /: unset( !important)?$/.test(d);
  list.sort((x, y) => Number(!reset(x)) - Number(!reset(y)));
  const parts = key.split(" || ");
  const body = `${scoped(parts.pop())} {\n  ${list.join(";\n  ")};\n}`;
  return parts.length ? `${parts.join(" { ")} {\n${body}\n${"}".repeat(parts.length)}` : body;
};
console.log(toNew ? `/* Sitecore 10.5: puts the stock 10.5 values over Sitecore 10.4's stylesheets.
   Generated with tools/css-diff.mjs --to-10.5 from stock 10.5 and 10.4.1 installs. Hand-written rules live in vars.css and fixes.css. */`
  : `/* Sitecore 10.4: restores the stock 10.4 values that Sitecore 10.5 changed.
   Generated with tools/css-diff.mjs against a stock 10.4.1 install. Hand-written rules live in glyphs.css. */`);
for (const f of files) {
  const o = out.get(f);
  const lines = [...[...o.fresh].map(([k, e]) => print(k, e.decls)), ...[...o.restated.keys()].sort((a, b) => a - b).map((n) => print(o.restated.get(n).rule.key, o.restated.get(n).decls, [...o.restated.get(n).rule.decls.keys()]))].filter(Boolean);
  if (lines.length) console.log(`\n/* ---- ${f.rel} ---- */\n${lines.join("\n")}`);
}
