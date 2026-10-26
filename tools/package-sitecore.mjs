// Packages the Sitecore-deployed version that tools/build-sitecore.mjs left in dist-sitecore/files/, twice:
//   dist-sitecore/themes-for-sitecore-<v>.zip        a Sitecore package: Development Center > Installation Wizard,
//                                                    or /sitecore/admin's package installer (files only, no items)
//   dist-sitecore/themes-for-sitecore-<v>.scwdp.zip  a Web Deploy package for Azure and other msdeploy pipelines
// <v> is package.json's version. npm run package:sitecore builds first. Needs Web Deploy (msdeploy.exe) for the
// second; Sitecore's Azure Toolkit lays its module packages out the same way (Content/Website, "Application Path").
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist-sitecore");
const files = path.join(out, "files");
const MSDEPLOY = ["C:\\Program Files\\IIS\\Microsoft Web Deploy V3\\msdeploy.exe", "C:\\Program Files (x86)\\IIS\\Microsoft Web Deploy V3\\msdeploy.exe"];

// every file under dir, as forward-slash paths relative to it
function list(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? list(p, base) : [path.relative(base, p).replace(/\\/g, "/")];
  });
}

// A zip of the given entries, deflated, with no directory entries: Sitecore's installer reads every entry under
// files/ as a file. ponytail: no zip64, so no entry or archive over 4 GB
export function zip(entries) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const n = Buffer.from(name, "utf8");
    const packed = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4); // version needed: 2.0
    head.writeUInt16LE(0x0800, 6); // names in UTF-8
    head.writeUInt16LE(8, 8); // deflate
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(packed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    locals.push(head, n, packed);
    centrals.push(dir, n);
    offset += head.length + n.length + packed.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A Sitecore package, as Sitecore's own are built: package.zip inside the zip, holding the installer's project
// (the file list), its metadata, and each file under files/ with its install options under properties/files/.
export function sitecorePackage(paths, read, meta) {
  const bom = (s) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(s, "utf8")]);
  const project = `<project>
  <Metadata>
    <metadata>
      <PackageName>${xml(meta.name)}</PackageName>
      <Author>${xml(meta.author)}</Author>
      <Version>${xml(meta.version)}</Version>
      <Revision />
      <License>${xml(meta.license)}</License>
      <Comment />
      <Attributes />
      <Readme>${xml(meta.readme)}</Readme>
      <Publisher>${xml(meta.author)}</Publisher>
      <PostStep />
      <PackageID />
    </metadata>
  </Metadata>
  <SaveProject>True</SaveProject>
  <Sources>
    <xfiles>
      <Entries>
${paths.map((p) => `        <x-item>/${xml(p)}</x-item>`).join("\n")}
      </Entries>
      <Converter>
        <FileToEntryConverter>
          <Root>/</Root>
          <Transforms>
            <InstallerConfigurationTransform>
              <Options>
                <BehaviourOptions>
                  <ItemMode>Overwrite</ItemMode>
                  <ItemMergeMode>Undefined</ItemMergeMode>
                </BehaviourOptions>
              </Options>
            </InstallerConfigurationTransform>
          </Transforms>
        </FileToEntryConverter>
      </Converter>
      <Include />
      <Exclude />
      <Name>${xml(meta.name)} Files</Name>
    </xfiles>
  </Sources>
  <Converter>
    <TrivialConverter>
      <Transforms />
    </TrivialConverter>
  </Converter>
  <Include />
  <Exclude />
  <Name />
</project>`;
  const text = (name, s) => ({ name, data: Buffer.from(s, "utf8") });
  const inner = zip([
    text("installer/version", "16.00.000000.000000"),
    text("installer/project", project),
    text("metadata/sc_author.txt", meta.author),
    text("metadata/sc_comment.txt", ""),
    text("metadata/sc_license.txt", meta.license),
    text("metadata/sc_name.txt", meta.name),
    text("metadata/sc_packageid.txt", ""),
    text("metadata/sc_poststep.txt", ""),
    text("metadata/sc_publisher.txt", meta.author),
    text("metadata/sc_readme.txt", meta.readme),
    text("metadata/sc_revision.txt", ""),
    text("metadata/sc_version.txt", meta.version),
    ...paths.flatMap((p) => [
      { name: `files/${p}`, data: read(p) },
      { name: `properties/files/${p}`, data: bom("type=file\r\nid_InstallMode=Overwrite\r\nid_VersionMergeMode=Undefined\r\n") },
    ]),
  ]);
  return zip([{ name: "package.zip", data: inner }]);
}

// The same files as a Web Deploy package: msdeploy syncs a staged Website folder into Content/Website, with the
// "Application Path" parameter Sitecore's module packages carry.
function webDeployPackage(dest) {
  const msdeploy = MSDEPLOY.find((p) => fs.existsSync(p));
  if (!msdeploy) throw new Error("Web Deploy's msdeploy.exe is missing: install Web Deploy 3.6 or later for the .scwdp.zip");
  // msdeploy rejects an argument that is quoted as a whole, which is how an argument with a space reaches it, so
  // none has one: the parameter comes from a file, and everything is staged in the temp folder (a short path on
  // Windows). The source must be an absolute path (a relative one names an IIS site); the replace rule turns it
  // into Website.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "sct-scwdp-"));
  if (/\s/.test(stage)) throw new Error(`the temp folder has a space in it (${stage}); set TEMP to one without`);
  const web = path.join(stage, "Website");
  fs.cpSync(files, web, { recursive: true });
  fs.writeFileSync(path.join(stage, "parameters.xml"), `<parameters>
  <parameter name="Application Path" tags="iisapp">
    <parameterEntry kind="ProviderPath" scope="iisApp" match="^Website$" />
  </parameter>
</parameters>
`);
  const re = "^" + web.replace(/\\/g, "\\\\").replace(/[.$^(){}+?*[\]|]/g, "\\$&") + "$";
  const built = path.join(stage, "package.scwdp.zip");
  const r = spawnSync(msdeploy, ["-verb:sync", `-source:iisApp=${web}`, `-dest:package=${built}`,
    `-declareParamFile=${path.join(stage, "parameters.xml")}`, `-replace:match=${re},replace=Website`], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`msdeploy failed (exit ${r.status}):\n${r.stdout}${r.stderr}`);
  fs.copyFileSync(built, dest);
  fs.rmSync(stage, { recursive: true, force: true });
}

function main() {
  if (!fs.existsSync(files)) throw new Error("dist-sitecore/files is missing: run npm run build:sitecore first");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  // The Installation Wizard shows this as the licence: NOTICE (copyright, third-party material), then LICENSE.
  const license = ["NOTICE", "LICENSE"].map((f) => fs.readFileSync(path.join(root, f), "utf8")).join("\n\n");
  const meta = {
    name: "Themes for Sitecore",
    version: pkg.version,
    author: (typeof pkg.author === "string" ? pkg.author : pkg.author?.name) || "Themes for Sitecore",
    license,
    readme: "Themes for the Sitecore 10.0 to 10.5 Content Management UIs: the extension's themes, deployed into Sitecore."
      + " Each user picks a theme from the logo in Sitecore's top bar. See sitecore/README.md in the project.",
  };
  const paths = list(files).sort();
  const installer = path.join(out, `themes-for-sitecore-${pkg.version}.zip`);
  fs.writeFileSync(installer, sitecorePackage(paths, (p) => fs.readFileSync(path.join(files, p)), meta));
  const scwdp = path.join(out, `themes-for-sitecore-${pkg.version}.scwdp.zip`);
  webDeployPackage(scwdp);
  for (const f of [installer, scwdp]) console.log(`${path.relative(root, f)} (${Math.round(fs.statSync(f).size / 1024)} KB)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
