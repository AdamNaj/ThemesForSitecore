// Builds the Sitecore-deployed version: the extension's shared engine, picker, themes and surface CSS, plus
// sitecore/, as a folder to copy over a Sitecore 10.4 or 10.5 Content Management webroot.
//   dist-sitecore/files/                               the webroot overlay
//   dist-sitecore/themes-for-sitecore-<v>-sitecore.zip  the same, zipped
// The DLL is compiled once, against a 10.4 install's Sitecore.Kernel (see sitecore/SitecoreThemes.csproj).
// node tools/build-sitecore.mjs [<10.4 webroot>]   (default: sitecore.local.json webroots.10.4)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const ext = path.join(root, "extension");
const out = path.join(root, "dist-sitecore");
const MODULE = path.join("sitecore modules", "SitecoreThemes");
const webroot = () => process.argv[2] || createRequire(import.meta.url)("./local.cjs").need("webroots", "10.4");

// The page code in one file, in the order the extension's background injects it, then the picker the popup
// shares and its CSS, with sitecore/host.js last.
export function bundle() {
  const themes = createRequire(import.meta.url)(path.join(ext, "themes", "themes.js"));
  const files = [
    "lib/detect.js", "lib/settings.js", "themes/themes.js", "lib/files.js", "lib/dom-kit.js", "lib/color-map.js", "lib/live-map.js",
    ...themes.filter((t) => t.hasDom).map((t) => `themes/${t.id}/dom.js`),
    "lib/engine.js",
    "popup/swatch.js", "popup/picker.js",
  ].map((f) => path.join(ext, f));
  const head = "// Themes for Sitecore, built by tools/build-sitecore.mjs from extension/ and sitecore/host.js. Do not edit.\n"
    + "(function (root) {\n  (root.SCT = root.SCT || {}).devHooks = false;\n})(globalThis);\n";
  const css = `SCT.pickerCss = ${JSON.stringify(fs.readFileSync(path.join(ext, "popup", "popup.css"), "utf8"))};\n`;
  return head + files.map((f) => fs.readFileSync(f, "utf8")).join("\n") + "\n" + css + fs.readFileSync(path.join(root, "sitecore", "host.js"), "utf8");
}

// What the engine and the picker fetch: surfaces/*.css, every theme's files (its CSS, glyphs and preview
// screenshots) except its DOM module and theme.json, and the logo.
function copyAssets(dest) {
  const skip = (f) => /\.(js|json)$/.test(f);
  for (const dir of ["surfaces", "themes"]) {
    fs.cpSync(path.join(ext, dir), path.join(dest, dir), { recursive: true, filter: (f) => fs.statSync(f).isDirectory() || !skip(f) });
  }
  fs.mkdirSync(path.join(dest, "icons"));
  fs.copyFileSync(path.join(ext, "icons", "icon.svg"), path.join(dest, "icons", "icon.svg"));
}

function main() {
  const version = JSON.parse(fs.readFileSync(path.join(ext, "manifest.json"), "utf8")).version;
  fs.rmSync(out, { recursive: true, force: true });
  const dir = path.join(out, "files");
  const module = path.join(dir, MODULE);
  fs.mkdirSync(module, { recursive: true });
  copyAssets(module);
  // The module's cache stamp is sct.js's time on the server, so sct.js changes whenever any file it serves does:
  // its first line is a hash of them all, and a deploy that only changes a theme's CSS still gets a new stamp.
  const code = bundle();
  const hash = createHash("sha256").update(code);
  for (const f of fs.readdirSync(module, { recursive: true }).sort()) {
    const file = path.join(module, f);
    if (fs.statSync(file).isFile()) hash.update(f).update(fs.readFileSync(file));
  }
  fs.writeFileSync(path.join(module, "sct.js"), `// build ${hash.digest("hex").slice(0, 16)}\n${code}`);
  fs.cpSync(path.join(root, "sitecore", "App_Config"), path.join(dir, "App_Config"), { recursive: true });
  const obj = path.join(out, "obj");
  execFileSync("dotnet", ["build", path.join(root, "sitecore", "SitecoreThemes.csproj"), "-c", "Release",
    `-p:SitecoreBin=${path.join(webroot(), "bin")}`, "-o", obj, "--nologo", "-v", "q"], { stdio: "inherit" });
  fs.mkdirSync(path.join(dir, "bin"));
  fs.copyFileSync(path.join(obj, "SitecoreThemes.dll"), path.join(dir, "bin", "SitecoreThemes.dll"));
  fs.rmSync(obj, { recursive: true });
  // Windows' own tar (bsdtar) writes zips; Git's GNU tar would read C: as a remote host
  execFileSync(path.join(process.env.SystemRoot, "System32", "tar.exe"), ["-a", "-c", "-f", `../themes-for-sitecore-${version}-sitecore.zip`, "*"], { cwd: dir });
  console.log(`Built ${version} for Sitecore into ${path.relative(root, out)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
