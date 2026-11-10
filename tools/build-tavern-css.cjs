// The Tavern's frame art: writes extension/themes/tavern/glyphs/*.svg from the measured construction of the
// classic fantasy-game frames (rail widths, colour stacks, chamfers; our own drawing, no game pixels), then
// renders each at 1x to a PNG beside it (image-set: the PNG at 100%, the SVG at every other scale).
// The illustrated pieces (the gryphons, the eye, the emblems) are artwork, kept in glyphs/ as delivered.
// node tools/build-tavern-css.cjs
const fs = require("fs");
const path = require("path");
const GLYPHS = path.join(__dirname, "..", "extension", "themes", "tavern", "glyphs");
fs.mkdirSync(GLYPHS, { recursive: true });
const art = {};
const svg = (w, h, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${extra}>${body}</svg>\n`;
const put = (name, w, h, body, extra) => { art[name] = { w, h, s: svg(w, h, body, extra) }; };

// Iron rail, outer to inner, 7px; the soft black outside it.
const RAIL = ["#1b1918", "#524d4a", "#363331", "#6b6563", "#292926", "#4a4744", "#080c08"];
const SHADOW = [0.07, 0.13, 0.27, 0.47];

// A faceted diamond rivet centred on (cx, cy), half-diagonal r, lit from the top left.
function stud(cx, cy, r) {
  const c = `${cx},${cy}`, k = r * 0.45, ic = (dx, dy) => `${cx + dx * k},${cy + dy * k}`;
  return `<g shape-rendering="geometricPrecision">
    <polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="#000"/>
    <polygon points="${cx},${cy - r + 1} ${cx + r - 1},${cy} ${c}" fill="#8e8984"/>
    <polygon points="${cx},${cy - r + 1} ${cx - r + 1},${cy} ${c}" fill="#d6d2cc"/>
    <polygon points="${cx - r + 1},${cy} ${cx},${cy + r - 1} ${c}" fill="#6a6662"/>
    <polygon points="${cx + r - 1},${cy} ${cx},${cy + r - 1} ${c}" fill="#2c2a28"/>
    <polygon points="${ic(0, -1)} ${ic(1, 0)} ${ic(0, 1)} ${ic(-1, 0)}" fill="#a9a49e"/></g>`;
}

// The window and dialog frame: a 9-slice of 14px slices. The rail is the inner 7px; the outer 7px holds the
// shadow and the rivets' overhang (border-image-outset 7px).
{
  const S = 36; let b = "";
  SHADOW.forEach((a, i) => { const d = 3 + i; b += `<rect x="${d + 0.5}" y="${d + 0.5}" width="${S - 2 * d - 1}" height="${S - 2 * d - 1}" fill="none" stroke="#000" stroke-opacity="${a}"/>`; });
  RAIL.forEach((c, i) => { const d = 7 + i; b += `<rect x="${d + 0.5}" y="${d + 0.5}" width="${S - 2 * d - 1}" height="${S - 2 * d - 1}" fill="none" stroke="${c}"/>`; });
  b += `<rect x="8" y="8" width="${S - 16}" height="1" fill="#8a847e" opacity=".55"/>`;
  for (const [x, y] of [[10.5, 10.5], [S - 10.5, 10.5], [10.5, S - 10.5], [S - 10.5, S - 10.5]]) b += stud(x, y, 5.5);
  put("frame", S, S, b, ' shape-rendering="crispEdges"');
  // the same rail without rivets, for frames that meet others (the taskbar, inner panels)
  put("rail", S, S, b.replace(/<g shape-rendering="geometricPrecision">[\s\S]*?<\/g>/g, ""), ' shape-rendering="crispEdges"');
}

// The title plaque: rail on top 6px, a rounded recess, rail below 5px, a rivet on each corner. 9-slice, 16px ends.
{
  const W = 60, H = 36, y0 = 4, y1 = 32;
  let b = `<defs><linearGradient id="rec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#100c08"/><stop offset=".3" stop-color="#2e2a23"/><stop offset=".55" stop-color="#393029"/><stop offset=".85" stop-color="#292420"/><stop offset="1" stop-color="#100c08"/></linearGradient></defs>`;
  SHADOW.forEach((a, i) => { b += `<rect x="${7 + i + 0.5}" y="${i + 0.5}" width="${W - 14 - 2 * i - 1}" height="${H - 2 * i - 1}" rx="2" fill="none" stroke="#000" stroke-opacity="${a}"/>`; });
  ["#343231", "#9c9694", "#000400", "#262426", "#393439", "#000400"].forEach((c, d) => { b += `<rect x="${8 + d + 0.5}" y="${y0 + d + 0.5}" width="${W - 16 - 2 * d - 1}" height="${y1 - y0 - 2 * d - 1}" fill="none" stroke="${c}"/>`; });
  b += `<rect x="14" y="${y0 + 6}" width="${W - 28}" height="${y1 - y0 - 12}" rx="3" fill="url(#rec)"/>`;
  b += `<rect x="9" y="${y1 - 4}" width="${W - 18}" height="1" fill="#7b7d7b"/><rect x="9" y="${y1 - 2}" width="${W - 18}" height="1" fill="#9c9a9c"/><rect x="9" y="${y1 - 1}" width="${W - 18}" height="1" fill="#000"/>`;
  for (const [x, y] of [[10.5, y0 + 2.5], [W - 10.5, y0 + 2.5], [10.5, y1 - 2.5], [W - 10.5, y1 - 2.5]]) b += stud(x, y, 4.5);
  put("plaque", W, H, b, ' shape-rendering="crispEdges"');
}

// Tabs: chamfered top corners, a 4px rail (outer to inner), open at the bottom. 9-slice, 8px slices.
function tab(name, fill, top) {
  const W = 32, H = 28, c = 5;
  let b = `<polygon points="0,${H} 0,${c} ${c},0 ${W - c},0 ${W},${c} ${W},${H}" fill="${fill}"/>`;
  ["#474642", "#6b6963", "#2b292b", top, "#080408"].forEach((col, d) => {
    const o = d + 0.5, k = c + o * 0.414;
    b += `<polyline points="${o},${H} ${o},${k} ${k},${o} ${W - k},${o} ${W - o},${k} ${W - o},${H}" fill="none" stroke="${col}"/>`;
  });
  put(name, W, H, b);
}
tab("tab-on", "#141311", "#737573");
tab("tab-off", "#000000", "#737573");
tab("tab-hover", "#0c0b0a", "#a8a49c");

// Window buttons: an 18px red face lit at the bottom right, black rim, gold glyph. Hover brightens, pressed darkens.
const FACES = { "": ["#8a0000", "#4a0000"], "-hover": ["#c21a00", "#6e0a00"], "-down": ["#5a0000", "#300000"] };
const GLYPH = {
  close: (s) => `<path d="M5.2 5.2 12.8 12.8M12.8 5.2 5.2 12.8" stroke="#2a1800" stroke-width="3.6" stroke-linecap="square"/><path d="M5.2 5.2 12.8 12.8M12.8 5.2 5.2 12.8" stroke="${s}" stroke-width="2.4" stroke-linecap="square"/>`,
  min: (s) => `<rect x="4.5" y="11" width="9" height="3" fill="${s}" stroke="#2a1800" stroke-width=".8"/>`,
  max: (s) => `<rect x="4.6" y="4.6" width="8.8" height="8.8" fill="none" stroke="#2a1800" stroke-width="3"/><rect x="4.6" y="4.6" width="8.8" height="8.8" fill="none" stroke="${s}" stroke-width="1.6"/><rect x="4" y="4" width="10" height="2.4" fill="${s}"/>`,
  restore: (s) => `<rect x="7" y="3.6" width="7.4" height="7.4" fill="none" stroke="#2a1800" stroke-width="2.6"/><rect x="7" y="3.6" width="7.4" height="7.4" fill="none" stroke="${s}" stroke-width="1.4"/>
    <rect x="3.6" y="7" width="7.4" height="7.4" fill="#4a0000" stroke="#2a1800" stroke-width="2.6"/><rect x="3.6" y="7" width="7.4" height="7.4" fill="#4a0000" stroke="${s}" stroke-width="1.4"/>`,
};
for (const [suffix, [hi, lo]] of Object.entries(FACES)) {
  for (const [g, draw] of Object.entries(GLYPH)) {
    put(`btn-${g}${suffix}`, 18, 18, `<defs><radialGradient id="f" cx=".75" cy=".8" r=".9"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${lo}"/><stop offset="1" stop-color="#2c0000"/></radialGradient></defs>
      <rect x=".5" y=".5" width="17" height="17" rx="4" fill="url(#f)" stroke="#080000"/><rect x="1.5" y="1.5" width="15" height="15" rx="3" fill="none" stroke="#5a0000" stroke-opacity=".8"/>
      ${draw(suffix === "-hover" ? "#f0d84a" : "#c6aa08")}`);
  }
}

// The check: a gold tick with a dark edge. The radio dot: a gold bead.
put("check", 14, 14, `<path d="M2 7.2 5.4 10.4 12.2 2.6" fill="none" stroke="#3a2800" stroke-width="3.6"/><path d="M2 7.2 5.4 10.4 12.2 2.6" fill="none" stroke="#e6c21a" stroke-width="2.2"/><path d="M2.4 6.6 5.4 9.4 11.6 2.4" fill="none" stroke="#fff27a" stroke-width=".7"/>`);
put("radio", 14, 14, `<circle cx="7" cy="7" r="3.6" fill="#e6c21a" stroke="#3a2800" stroke-width="1"/><circle cx="6" cy="6" r="1.2" fill="#fff27a"/>`);
// Drop-down and fly-out arrows in gold.
put("arrow-down", 9, 6, `<path d="M.5 .5h8L4.5 5.5z" fill="#ffd100" stroke="#3a2800" stroke-width=".8"/>`);
put("arrow-right", 6, 9, `<path d="M.5 .5v8L5.5 4.5z" fill="#ffd100" stroke="#3a2800" stroke-width=".8"/>`);

// The action bar's twelve empty slots, drawn under the window entries (4px apart, each 38px with the entries'
// three rings), each with its key in the corner: 1 to 9, 0, - and =, as the entries' counter numbers them.
{
  const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
  let b = `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1d1d"/><stop offset="1" stop-color="#292829"/></linearGradient></defs>`;
  KEYS.forEach((k, i) => {
    const x = 4 + i * 42;
    b += `<rect x="${x}" y="0" width="38" height="38" rx="3" fill="#100c08"/><rect x="${x + 1}" y="1" width="36" height="36" rx="2" fill="#414041"/><rect x="${x + 2}" y="2" width="34" height="34" rx="2" fill="#100c08"/><rect x="${x + 3}" y="3" width="32" height="32" rx="1" fill="url(#f)"/>`;
    b += `<text x="${x + 33}" y="12" text-anchor="end" font-family="Palatino Linotype, Book Antiqua, serif" font-weight="600" font-size="10" fill="#000">${k}</text><text x="${x + 32}" y="11" text-anchor="end" font-family="Palatino Linotype, Book Antiqua, serif" font-weight="600" font-size="10" fill="#9a9a9a">${k}</text>`;
  });
  put("slots", 4 + 12 * 42, 38, b);
}

// Texture: dark stone, our own turbulence rendered to a tile laid over the stone colours. A low-contrast
// mottle lighter and darker by turns, and a fine speckle, so the stone reads as rock and never as clouds.
put("grain-stone", 256, 256, `<filter id="m" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="5" seed="3" stitchTiles="stitch"/><feColorMatrix values=".7 0 0 0 0  .68 0 0 0 0  .64 0 0 0 0  0 0 0 0 .13"/></filter><filter id="s" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11" stitchTiles="stitch"/><feColorMatrix values=".9 0 0 0 0  .9 0 0 0 0  .9 0 0 0 0  0 0 0 0 .07"/></filter><rect width="256" height="256" filter="url(#m)"/><rect width="256" height="256" filter="url(#s)"/>`);

for (const [n, a] of Object.entries(art)) fs.writeFileSync(path.join(GLYPHS, `${n}.svg`), a.s);

// 1x PNGs, rendered by Chromium from the SVGs above.
(async () => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [n, a] of Object.entries(art)) {
    await page.setViewportSize({ width: a.w, height: a.h });
    await page.setContent(`<body style="margin:0;background:transparent"><img style="display:block" width="${a.w}" height="${a.h}" src="data:image/svg+xml;base64,${Buffer.from(a.s).toString("base64")}"></body>`);
    await page.waitForFunction(() => document.images[0].complete);
    await page.screenshot({ path: path.join(GLYPHS, `${n}.png`), omitBackground: true });
  }
  await browser.close();
  console.log(`wrote ${Object.keys(art).length} glyphs (svg + png)`);
})();
