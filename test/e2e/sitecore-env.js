// Shared setup for the suite that runs against the local Sitecore installs named in sitecore.local.json.
const path = require("node:path");
const { extensionCopy, launchWithExtension } = require("./helpers");
const local = require("../../tools/local.cjs").load();

// { "10.5": origin, "10.4": origin }; empty without sitecore.local.json, so the Sitecore suite has nothing to run
const HOSTS = local.hosts || {};
const IDENTITY = local.identityHosts || [];
// SCT_PROFILE points a worktree at the main checkout's sign-in
const PROFILE = process.env.SCT_PROFILE || path.join(__dirname, "..", "..", ".auth", "profile");

// One persistent profile keeps the Sitecore sign-in between runs.
async function launchSitecore(options) {
  const ext = extensionCopy([...Object.values(HOSTS), ...IDENTITY].map((o) => `${o}/*`));
  return launchWithExtension(ext, PROFILE, options);
}

module.exports = { HOSTS, IDENTITY, PROFILE, launchSitecore };
