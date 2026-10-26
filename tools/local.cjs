// The local Sitecore installs the dev tools and the Sitecore e2e suite work against, from sitecore.local.json at
// the repository root (gitignored; start from sitecore.example.json, which documents every field). Nothing in
// extension/ or sitecore/ reads it.
const fs = require("node:fs");
const path = require("node:path");

const FILE = path.join(__dirname, "..", "sitecore.local.json");

function load() {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
}

// One value from the file, by its keys (need("webroots", "10.5")); a tool that needs it fails with what to set.
function need(...keys) {
  const value = keys.reduce((o, k) => o?.[k], load());
  if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) {
    throw new Error(`sitecore.local.json: set ${keys.map((k) => `["${k}"]`).join("")} (see sitecore.example.json)`);
  }
  return value;
}

module.exports = { load, need, FILE };
