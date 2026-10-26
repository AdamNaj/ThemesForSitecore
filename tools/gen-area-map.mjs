// Dev tool: builds extension/surfaces/<area>.gen.css from Sitecore's own stylesheets.
// Every literal colour in a stock rule is re-pointed at a --sct-* role, so token themes
// recolour the whole UI. Hand-tuned mappings live in surfaces/<area>.css and win over this.
//
// Usage: node tools/gen-area-map.mjs [--report]
//   reads the installs in sitecore.local.json `webroots`; --report prints colour statistics instead.
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import colorMap from "../extension/lib/color-map.js";
import local from "./local.cjs";

const { ruleDecls, BAD_SELECTOR, scoped, first } = colorMap;

// Stock 10.5 and 10.4 webroots: a customised install would put its project CSS into every theme.
const ROOTS = [local.need("webroots", "10.5"), local.need("webroots", "10.4")];
// 10.0 to 10.3: their webroots' UI files, unpacked from the installers (no databases, they don't run).
// Their SPEAK stylesheets are the Bootstrap build 10.4 replaced, and 10.0's Launchpad is the older icon grid.
const LEGACY_ROOTS = local.need("webroots", "legacy");
const IDS_ROOTS = local.need("webroots", "identity");
for (const root of [...ROOTS, ...LEGACY_ROOTS, ...IDS_ROOTS]) {
  if (!fs.existsSync(root)) throw new Error(`${root} (sitecore.local.json webroots) does not exist`);
}
const OUT = path.join(import.meta.dirname, "..", "extension", "surfaces");

const SPE = ["ListView", "Dialogs", "VariablePrompt", "Runner", "ise", "reports", "Gallery", "IFrame"]
  .map((n) => `sitecore modules/PowerShell/Styles/${n}.css`);

const AREAS = {
  shell: {
    roots: ROOTS,
    globs: [
      "sitecore/shell/Themes/Standard/Default/*.css",
      "sitecore/shell/Themes/Standard/*.css",
      "sitecore/shell/Applications/**/*.css",
      "sitecore/shell/Controls/**/*.css",
      "sitecore/shell/Controls/Lib/jQuery/jQueryUI/1.13.2/smoothness/jquery-ui.min.css",
      ...SPE,
    ],
  },
  speak: { roots: ROOTS, globs: ["sitecore/shell/client/**/*.css"] },
  // The Experience Editor's top document is the website, so only Sitecore's own chrome selectors are kept.
  ee: { roots: ROOTS, globs: ["sitecore/shell/Applications/Page Modes/Output/*.css"], keepOutput: true, requireSc: true },
  login: {
    roots: [...ROOTS, ...IDS_ROOTS],
    globs: ["sitecore/login/*.css", "sitecore/Sitecore.Plugin.IdentityServer/Content/css/site.css"],
  },
};
AREAS.launchpad = AREAS.speak;
// /sitecore/admin: WebFramework.css, the folder's own sheets, SPE's console page and each page's inline <style>.
AREAS.admin = {
  roots: ROOTS,
  globs: [
    "sitecore/shell/Themes/Standard/Default/WebFramework.css",
    "sitecore/admin/*.css",
    "sitecore/admin/*.aspx",
    "sitecore modules/PowerShell/Styles/Dialogs.css",
    "sitecore modules/PowerShell/Styles/Console.css",
  ],
};

// ee keeps a selector when it names one of Sitecore's sc classes, unless it reaches past the wrappers
// Sitecore puts around the website's own markup (.scWebEditInput img is a field's content image).
const scChrome = (s) => /[.#]sc[A-Za-z]/.test(s) && !/\.sc(WebEditInput|EnabledChrome)\b[^,]*\s/.test(s);

// /help/: Path Analyzer's help pages carry a stock Bootstrap of their own (XP only).
const EXCLUDE = [/\.old\.css$/i, /\/page modes\/output\//i, /\/testing\//i, /\/(lib|deps|help)\//i, /DatasourceCleanup/i];
const ALWAYS = [/smoothness\/jquery-ui\.min\.css$/i];

function files(area, roots) {
  const found = new Map();
  for (const root of roots) {
    for (const g of area.globs) {
      for (const rel of fs.globSync(g, { cwd: root })) {
        const norm = rel.replaceAll("\\", "/");
        const excluded = EXCLUDE.filter((r) => !(area.keepOutput && String(r).includes("page modes")));
        const keep = ALWAYS.some((r) => r.test(norm)) || !excluded.some((r) => r.test(norm));
        if (!keep) continue;
        if (/\.min\.css$/i.test(norm) && fs.existsSync(path.join(root, norm.replace(/\.min\.css$/i, ".css")))) continue;
        if (!found.has(norm)) found.set(norm, []);
        found.get(norm).push(path.join(root, norm));
      }
    }
  }
  return found;
}

function wrappers(node) {
  const chain = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "atrule") {
      if (/keyframes|font-face|page/i.test(p.name)) return null;
      chain.unshift(`@${p.name} ${p.params}`);
    }
  }
  return chain;
}

// 10.0 to 10.3's own rules apply only on their pages (the engine marks those data-sct-legacy, without adding
// specificity), with only the properties no 10.4 or 10.5 rule maps for the same selector (10.0's Launchpad tiles keep
// 10.4's colour and lose their own white gradient). They go first, below every newer rule.
function generate(areaName) {
  const area = AREAS[areaName];
  const stats = new Map();
  const current = rules(areaName, area.roots, stats);
  const key = (r, decl) => `${r.wrap.join(" ")}|${r.selector}|${decl.slice(0, decl.indexOf(":"))}`;
  const mapped = new Set([...current.values()].flatMap((r) => r.decls.map((d) => key(r, d))));
  const legacy = new Set();
  for (const r of rules(areaName, LEGACY_ROOTS, stats, ":where([data-sct-legacy])").values()) {
    const decls = r.decls.filter((d) => !mapped.has(key(r, d)));
    if (decls.length) legacy.add(render(r.wrap, r.scopedSelector, decls));
  }
  return { css: [...legacy, ...current.keys()], stats };
}

function render(wrap, sel, decls) {
  const body = `${sel} { ${decls.join("; ")}; }`;
  return wrap.length ? `${wrap.join(" { ")} { ${body} ${"}".repeat(wrap.length)}` : body;
}

function rules(areaName, roots, stats, gate = "") {
  const area = AREAS[areaName];
  const prefix = `html[data-sct-tokens][data-sct-surface="${areaName}"]${gate}`;
  const seen = new Map(); // css text -> the rule's parts, dedupes identical rules across versions
  for (const [rel, paths] of files(area, roots)) {
    for (const file of paths) {
      let root;
      try {
        let text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
        // admin pages carry their styles inline
        if (/\.aspx$/i.test(file)) text = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
        root = postcss.parse(text);
      } catch {
        continue;
      }
      root.walkRules((rule) => {
        const wrap = wrappers(rule);
        if (!wrap) return;
        const decls = ruleDecls(
          rule.nodes.filter((d) => d.type === "decl").map((d) => [d.prop, d.value, d.important]),
          (prop, value) => {
            const k = `${prop}:${first(value)}`;
            stats.set(k, (stats.get(k) || 0) + 1);
          },
        );
        if (!decls.length) return;
        const selectors = rule.selectors
          .filter((s) => !BAD_SELECTOR.test(s))
          .filter((s) => !area.requireSc || scChrome(s.trim()));
        for (const selector of selectors) {
          const scopedSelector = scoped(prefix, selector);
          seen.set(render(wrap, scopedSelector, decls), { wrap, selector: selector.trim(), scopedSelector, decls });
        }
      });
    }
  }
  return seen;
}

if (process.argv.includes("--report")) {
  for (const name of Object.keys(AREAS)) {
    const { css, stats } = generate(name);
    const top = [...stats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    console.log(`\n== ${name}: ${css.length} rules, ${files(AREAS[name], AREAS[name].roots).size} files`);
    for (const [k, n] of top) console.log(`  ${n}\t${k}`);
  }
} else {
  for (const name of Object.keys(AREAS)) {
    const { css } = generate(name);
    const header = `/* Generated by tools/gen-area-map.mjs from Sitecore's stock stylesheets. Do not edit. */\n`;
    fs.writeFileSync(path.join(OUT, `${name}.gen.css`), header + css.join("\n") + "\n");
    console.log(`${name}.gen.css: ${css.length} rules, ${(fs.statSync(path.join(OUT, `${name}.gen.css`)).size / 1024).toFixed(0)} KB`);
  }
}
