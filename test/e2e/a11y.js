// axe-core over a page and every frame of its own origin: violations per rule, as nodes summed across frames.
const fs = require("node:fs");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"];

async function axeCounts(page) {
  const origin = new URL(page.url()).origin;
  const counts = {};
  for (const frame of page.frames()) {
    if (!frame.url().startsWith(origin)) continue;
    let violations;
    try {
      await frame.evaluate(AXE);
      violations = await frame.evaluate((runOnly) => axe.run(document, { runOnly, resultTypes: ["violations"] }).then((r) => r.violations.map((v) => [v.id, v.nodes.length])), TAGS);
    } catch {
      continue; // a frame Sitecore removed while axe ran
    }
    for (const [id, n] of violations) counts[id] = (counts[id] || 0) + n;
  }
  return counts;
}

module.exports = { axeCounts };
