const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");

// the entries of a zip, read back from its central directory
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    const size = buf.readUInt32LE(at + 20), nameLen = buf.readUInt16LE(at + 28), offset = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    const local = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
    entries.set(name, zlib.inflateRawSync(buf.subarray(local, local + size)));
    at += 46 + nameLen + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return entries;
}

test("the Sitecore package holds package.zip with the project, metadata, files and their install options", async () => {
  const { sitecorePackage } = await import("../../tools/package-sitecore.mjs");
  const files = { "bin/SitecoreThemes.dll": Buffer.from([1, 2, 3]), "sitecore modules/SitecoreThemes/sct.js": Buffer.from("// <js> & co") };
  const meta = { name: "Themes for Sitecore", version: "1.2.3", author: "A & B", license: "MIT", readme: "Read me" };
  const outer = unzip(sitecorePackage(Object.keys(files), (p) => files[p], meta));
  assert.deepEqual([...outer.keys()], ["package.zip"]);
  const inner = unzip(outer.get("package.zip"));
  assert.ok(![...inner.keys()].some((n) => n.endsWith("/")), "no directory entries");
  assert.equal(inner.get("installer/version").toString(), "16.00.000000.000000");
  assert.equal(inner.get("metadata/sc_version.txt").toString(), "1.2.3");
  const project = inner.get("installer/project").toString();
  for (const p of Object.keys(files)) {
    assert.ok(project.includes(`<x-item>/${p}</x-item>`), p);
    assert.deepEqual(inner.get(`files/${p}`), files[p]);
    assert.equal(inner.get(`properties/files/${p}`).toString(), "﻿type=file\r\nid_InstallMode=Overwrite\r\nid_VersionMergeMode=Undefined\r\n");
  }
  assert.ok(project.includes("<Author>A &amp; B</Author>"));
});
