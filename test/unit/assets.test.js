const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "extension");

function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? cssFiles(p) : e.name.endsWith(".css") ? [p] : [];
  });
}

test("every root-relative url() points into Sitecore", () => {
  const bad = [];
  for (const file of cssFiles(ROOT)) {
    const css = fs.readFileSync(file, "utf8");
    for (const m of css.matchAll(/url\(\s*["']?(\/(?!\/)[^"')]*)/g)) {
      if (!/^\/(sitecore|-\/)/i.test(m[1])) bad.push(`${path.relative(ROOT, file)}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("themes never hide Sitecore's dialog buttons", () => {
  const bad = [];
  for (const file of cssFiles(path.join(ROOT, "themes"))) {
    const css = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (/display:\s*none/.test(m[2]) && /ui-dialog-titlebar-(close|collapse|maximize|minimize|restore)\s*$/m.test(m[1].trim())) {
        bad.push(`${path.relative(ROOT, file)}: ${m[1].trim()}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("every sct-ext: url() is a file the manifest lets pages load", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const globs = (manifest.web_accessible_resources || []).flatMap((r) => r.resources);
  const exposed = (p) => globs.some((g) => new RegExp(`^${g.replace(/[.]/g, "\.").replace(/\*/g, "[^/]*")}$`).test(p));
  const bad = [];
  for (const file of cssFiles(ROOT)) {
    for (const m of fs.readFileSync(file, "utf8").matchAll(/url\(\s*["']?sct-ext:([^"')]*)/g)) {
      if (!fs.existsSync(path.join(ROOT, m[1]))) bad.push(`${path.relative(ROOT, file)}: ${m[1]} is missing`);
      else if (!exposed(m[1])) bad.push(`${path.relative(ROOT, file)}: ${m[1]} is not in web_accessible_resources`);
    }
  }
  assert.deepEqual(bad, []);
});
