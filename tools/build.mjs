// Builds the release packages from extension/:
//   dist/themes-for-sitecore-<v>-chrome.zip          Chrome Web Store, Edge Add-ons, and testers (Load unpacked)
//   dist/themes-for-sitecore-<v>-firefox-listed.zip  AMO listing
//   dist/themes-for-sitecore-<v>-source.zip          the sources AMO's review asks for (git archive of HEAD)
//   dist/firefox-unlisted/                           signed with `npm run sign:firefox` for self-hosted testers
// Every package is staged from a copy whose lib/dev.js switches the development hooks off.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "extension");
const dist = path.join(root, "dist");
const webExt = path.join(root, "node_modules", "web-ext", "bin", "web-ext.js");

// Copies the extension to dest with the development hooks switched off.
export function stage(dest) {
  fs.cpSync(src, dest, { recursive: true });
  for (const f of ["LICENSE", "NOTICE"]) fs.copyFileSync(path.join(root, f), path.join(dest, f)); // Apache 2.0 travels with every copy
  fs.writeFileSync(
    path.join(dest, "lib", "dev.js"),
    "// Packaged build: development hooks are off.\n(function (root) {\n  (root.SCT = root.SCT || {}).devHooks = false;\n})(globalThis);\n",
  );
  return dest;
}

function zip(dir, filename) {
  execFileSync(process.execPath, [webExt, "build", "-s", dir, "-a", dist, "--filename", filename, "--overwrite-dest"], { stdio: "inherit" });
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8"));
  const version = manifest.version;

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist);

  const packaged = stage(path.join(dist, "staging"));
  zip(packaged, `themes-for-sitecore-${version}-chrome.zip`);

  // Firefox runs no extension service workers: its packages load the background as scripts, the libraries
  // background.js imports with importScripts first. Chrome warns about background.scripts in Manifest V3, so only
  // the Firefox copies carry it.
  const firefox = { ...manifest, background: { ...manifest.background, scripts: ["lib/dev.js", "lib/detect.js", "lib/settings.js", "themes/themes.js", "lib/files.js", "background.js"] } };
  fs.writeFileSync(path.join(packaged, "manifest.json"), JSON.stringify(firefox, null, 2) + "\n");
  zip(packaged, `themes-for-sitecore-${version}-firefox-listed.zip`);

  // Unlisted Firefox build: same files plus an update_url so signed sideloads update themselves.
  const unlisted = path.join(dist, "firefox-unlisted");
  fs.cpSync(packaged, unlisted, { recursive: true });
  const base = pkg.config && pkg.config.updateBase;
  if (base) {
    const m = JSON.parse(JSON.stringify(firefox));
    m.browser_specific_settings.gecko.update_url = `${base}/updates.json`;
    fs.writeFileSync(path.join(unlisted, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
    const updates = {
      addons: {
        [manifest.browser_specific_settings.gecko.id]: {
          updates: [{ version, update_link: `${base}/themes-for-sitecore-${version}-firefox.xpi` }],
        },
      },
    };
    fs.writeFileSync(path.join(dist, "updates.json"), JSON.stringify(updates, null, 2) + "\n");
  } else {
    console.warn("package.json config.updateBase is empty: the unlisted Firefox build has no update_url.");
  }
  fs.rmSync(packaged, { recursive: true, force: true });

  // AMO asks for the sources of the generated files with every version: the committed tree, as the tag builds it
  execFileSync("git", ["archive", "-o", path.join(dist, `themes-for-sitecore-${version}-source.zip`), "HEAD"], { cwd: root, stdio: "inherit" });
  if (execFileSync("git", ["status", "--porcelain", "--", "extension", "tools"], { cwd: root, encoding: "utf8" }).trim())
    console.warn("Uncommitted changes under extension/ or tools/: the source zip holds HEAD, not what was packaged.");
  console.log(`Built ${version} into ${path.relative(root, dist)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
