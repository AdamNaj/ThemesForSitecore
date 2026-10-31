// Shared helpers for tests that load the extension into Chromium.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("@playwright/test");

// SCT_EXTENSION_DIR: another copy of extension/, such as the last commit's, to compare a change against
const EXTENSION_DIR = process.env.SCT_EXTENSION_DIR || path.join(__dirname, "..", "..", "extension");

// A throwaway copy of the extension with extra host permissions baked in,
// because Playwright can't click the browser's permission prompt.
function extensionCopy(hostPermissions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sct-ext-"));
  fs.cpSync(EXTENSION_DIR, dir, { recursive: true });
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = hostPermissions;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

async function launchWithExtension(extDir, userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sct-profile-")), { headless = true, ...options } = {}) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    ...options,
    channel: "chromium",
    headless,
    ignoreHTTPSErrors: true,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  return { context, worker };
}

// Serves test/e2e/fixtures/<site>/<path> for any request path, e.g. /sitecore/shell/default.aspx, and the
// extension's own files at /ext/<path>, for fixture pages that run the engine without the extension.
// /slow.png answers after a delay, so tests can catch work done before the window's load event.
function fixtureServer(port, site = "site") {
  const sites = path.join(__dirname, "fixtures", site);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/slow.png") {
      setTimeout(() => res.writeHead(404).end(), 1500);
      return;
    }
    const ext = urlPath.startsWith("/ext/");
    const root = ext ? EXTENSION_DIR : sites;
    const file = path.join(root, ext ? urlPath.slice(4) : urlPath);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    const type = file.endsWith(".css") ? "text/css" : file.endsWith(".xml") ? "text/xml" : file.endsWith(".js") ? "text/javascript" : "text/html";
    res.writeHead(200, { "content-type": type }).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

module.exports = { EXTENSION_DIR, extensionCopy, launchWithExtension, fixtureServer };
