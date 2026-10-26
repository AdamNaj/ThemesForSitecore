// Dev tool: writes extension/themes/workgroups311/{shell,speak,launchpad,login}.css and the glyph images in
// extension/themes/workgroups311/glyphs. The bevels and glyphs are drawn from code, so they are generated
// here rather than written by hand.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const T = (surface) => `html[data-sct-theme="workgroups311"][data-sct-surface="${surface}"]`;
const P = T("shell");
// :not(#sct-wg) matches every page; its id weight lets hand-written rules beat Sitecore's own.
const W = (surface) => `${T(surface)}:not(#sct-wg)`;
const FONT = '"MS Sans Serif", "Microsoft Sans Serif", Arial, sans-serif';
// Glyphs are shapes on an 18px grid, centred in whatever box they paint: triangles, bars and the check box's
// cross. ico() writes each glyph into themes/workgroups311/glyphs twice, as a PNG and as an SVG. image-set()
// gives a 100% screen the PNG, rasterised the way a hard colour stop is (a pixel is filled when its centre
// is inside the shape) and kept exact by pixelate(); every other scale gets the SVG, drawn at the screen's
// resolution. Hard stops drawn straight onto a 125% screen snap every edge to device pixels, so triangles
// stair-step and one-pixel bars come out one or two pixels thick. The CSS names the files sct-ext:<path>,
// which background.js points at the extension's own URL, so a page CSP without data: in img-src (some installs send one)
// still loads them. The button bevel stays a set of bands along the box's own edges.
const HEX = { K: "#000", W: "#fff", G: "#808080", C: "#c0c0c0" };
const LETTER = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [v, k]));
// a w-wide triangle pointing down or up is (w + 1) / 2 tall; one pointing left or right the other way round
const tri = {
  down: (x, y, w, c = "#000") => ({ kind: "down", x, y, w, h: (w + 1) / 2, c }),
  up: (x, y, w, c = "#000") => ({ kind: "up", x, y, w, h: (w + 1) / 2, c }),
  left: (x, y, h, c = "#000") => ({ kind: "left", x, y, w: (h + 1) / 2, h, c }),
  right: (x, y, h, c = "#000") => ({ kind: "right", x, y, w: (h + 1) / 2, h, c }),
};
const bar = (x, y, w, h, c = "#000") => ({ kind: "bar", x, y, w, h, c });
// 3.1's check mark: a cross corner to corner in an s-pixel square
const cross = (x, y, s, c = "#000") => ({ kind: "cross", x, y, w: s, h: s, c });

function rasterize(shapes, w, h) {
  const px = Array.from({ length: h }, () => Array(w).fill("."));
  const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) px[y][x] = LETTER[c]; };
  for (const s of shapes) {
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      const d = s.kind === "left" || s.kind === "right" ? Math.abs(j - (s.h - 1) / 2) : 0;
      const on = {
        bar: true,
        down: i >= j && i <= s.w - 1 - j,
        up: i >= s.h - 1 - j && i <= s.w - 1 - (s.h - 1 - j),
        left: i >= d,
        right: i <= s.w - 1 - d,
        cross: i === j || i === s.w - 1 - j,
      }[s.kind];
      if (on) set(s.x + i, s.y + j, s.c);
    }
  }
  return px.map((r) => r.join(""));
}
// The same shapes as vectors. A triangle's sides run through the middle of each pixel step, so it covers
// the same area as its pixels. Bars keep their edges on device pixels (crispEdges): smoothed, a 1px gap
// between two of them turns grey at 125% and the grid icon's squares run together.
function vectorize(shapes) {
  return shapes.map(({ kind, x, y, w, h, c }) => {
    const poly = (...p) => `<path d="M${p.join("L")}Z" fill="${c}"/>`;
    if (kind === "bar") return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" shape-rendering="crispEdges"/>`;
    if (kind === "down") return poly(`${x - 0.5} ${y}`, `${x + w + 0.5} ${y}`, `${x + w / 2} ${y + h}`);
    if (kind === "up") return poly(`${x - 0.5} ${y + h}`, `${x + w + 0.5} ${y + h}`, `${x + w / 2} ${y}`);
    if (kind === "left") return poly(`${x + w} ${y - 0.5}`, `${x + w} ${y + h + 0.5}`, `${x} ${y + h / 2}`);
    if (kind === "right") return poly(`${x} ${y - 0.5}`, `${x} ${y + h + 0.5}`, `${x + w} ${y + h / 2}`);
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="hidden"><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="${c}" stroke-width="1.4"/></svg>`;
  }).join("");
}
const GLYPHS = path.join(__dirname, "..", "extension", "themes", "workgroups311", "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
// One background layer: the glyph on a w x h canvas (18px by default), centred unless placed otherwise.
// Both images get a transparent 1px margin: Chrome softens the edge of an image placed between device
// pixels, and the margin keeps that softening off the art.
function ico(shapes, { w = 18, h = 18, pos = "center" } = {}) {
  const rows = rasterize(shapes, w, h);
  const svg = vectorize(shapes);
  const name = crypto.createHash("sha1").update(rows.join("|") + svg).digest("hex").slice(0, 10);
  const pad = ".".repeat(w + 2);
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), png([pad, ...rows.map((r) => `.${r}.`), pad]));
  fs.writeFileSync(path.join(GLYPHS, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}">${svg}</svg>\n`);
  const url = (ext) => `url("sct-ext:themes/workgroups311/glyphs/${name}.${ext}")`;
  return `image-set(${url("png")} 1x, ${url("svg")} 2x) ${pos} / ${w + 2}px ${h + 2}px no-repeat`;
}
function png(rows) {
  const h = rows.length, w = rows[0].length;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === ".") return;
    const hex = HEX[c].replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3");
    raw.writeUInt32BE(((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0, y * (w * 4 + 1) + 1 + x * 4);
  }));
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
// At exactly 100% the glyphs' PNGs are drawn nearest-neighbour, so a glyph centred between pixels stays
// exact: every rule whose background draws one gets image-rendering: pixelated in one @media block. The
// property inherits, so a zero-specificity reset keeps it off the element's children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*sct-ext:/.test(m[2]))
    .map((m) => m[1].trim());
  if (!sels.length) return text;
  const all = ':where(html[data-sct-theme="workgroups311"] *)';
  return `${text}
/* glyphs at exactly 100%: their PNGs, nearest-neighbour (see pixelate()) */
@media (resolution: 1dppx) {
  ${all}, ${all}::before, ${all}::after { image-rendering: auto; }
${sels.map((s) => `  ${s} { image-rendering: pixelated; }`).join("\n")}
}
`;
}
// 3.1's raised face: white top and left, a grey right edge and a two-pixel grey bottom
const bevel = ["linear-gradient(270deg, #808080 1px, transparent 0)", "linear-gradient(0deg, #808080 2px, transparent 0)",
  "linear-gradient(#fff 1px, transparent 0)", "linear-gradient(90deg, #fff 1px, transparent 0)", "linear-gradient(#c0c0c0, #c0c0c0)"];
const btn = (...glyph) => [ico(glyph), ...bevel].join(", ");
// Hides an <img>'s own picture so the painted background shows instead.
const paint = (g) => `object-fit: none; object-position: -999px -999px; background: ${g};`;

const G = {
  up: btn(tri.up(5, 7, 7)),
  down: btn(tri.down(5, 7, 7)),
  left: btn(tri.left(6, 5, 7)),
  right: btn(tri.right(6, 5, 7)),
  updown: btn(tri.up(6, 3, 5), tri.down(6, 11, 5)),
  switcher: btn(bar(5, 5, 8, 1), bar(5, 8, 8, 1), bar(5, 11, 8, 1)),
  dots: btn(bar(5, 9, 2, 2), bar(8, 9, 2, 2), bar(11, 9, 2, 2)),
  closeBox: btn(bar(4, 7, 10, 4), bar(5, 8, 8, 2, "#fff")),
  ctrl: [ico([bar(3, 7, 12, 4), bar(4, 8, 10, 2, "#fff"), bar(5, 11, 10, 1, "#808080")]), "linear-gradient(#c0c0c0, #c0c0c0)"].join(", "),
  first: btn(bar(5, 5, 1, 7), tri.left(7, 5, 7)),
  last: btn(bar(12, 5, 1, 7), tri.right(7, 5, 7)),
  // 3.1's combo box button: a down arrow over a bar
  combo: btn(tri.down(5, 5, 7), bar(5, 11, 7, 2)),
  // Program Manager's group icon: nine black squares
  grid: ico([0, 4, 8].flatMap((y) => [0, 4, 8].map((x) => bar(3 + x, 3 + y, 3, 3)))),
};
// The combo button flush with the right edge of a select: a black line on its left, then the bevel.
const comboRight = [
  ico([tri.down(0, 0, 7), bar(0, 6, 7, 2)], { w: 7, h: 8, pos: "right 5px center" }),
  "linear-gradient(#fff 1px, transparent 1px calc(100% - 2px), #808080 calc(100% - 2px)) right 0 / 18px 100% no-repeat",
  "linear-gradient(90deg, #000 1px, #fff 1px 2px, #c0c0c0 2px calc(100% - 1px), #808080 calc(100% - 1px)) right 0 / 19px 100% no-repeat",
].join(", ");
// Bare glyphs (no button face) for drop-down arrows and submenu arrows.
const triDown = (c = "#000") => ico([tri.down(5, 7, 7, c)]);
const triRight = (c = "#000") => ico([tri.right(7, 5, 7, c)]);
// 3.1's check box: a white square in a black frame, crossed when checked; the radio button a black ring.
const crossed = ico([cross(0, 0, 7)], { w: 7, h: 7, pos: "1px 1px" });

const raised = "border: 1px solid #000; box-shadow: inset 2px 2px #fff, inset -2px -2px #808080;";
const sunken = "box-shadow: inset 2px 2px #808080, inset -2px -2px #fff;";
// 3.1's edit control: white inside a one-pixel black frame.
const edit = "background: #fff; color: #000; border: 1px solid #000; border-radius: 0; box-shadow: none;";
const button = `background: #c0c0c0; color: #000; font: bold 12px ${FONT}; text-transform: none; text-shadow: none; border-radius: 2px; ${raised}`;
// A tab: raised, rounded at the top, open at the bottom where it meets its page.
const tabFace = `background: #c0c0c0; color: #000; border: 1px solid #000; border-bottom: 0; border-radius: 3px 3px 0 0; box-shadow: inset 1px 1px #fff, inset -1px 0 #808080; text-transform: none; text-shadow: none; font-family: ${FONT}; font-size: 12px;`;

// ---- Shared by every area: the global header is the active window's caption. Its launchpad button is a
// raised 3.1 button with Program Manager's group glyph, the portrait sits in a bevelled frame, and the
// account links stay white. ----
const header = (S, bar) => `${S}:not(#sct-wg) .sc-globalHeader {
  background: #000080 !important;
  border-bottom: 1px solid #000;
  box-shadow: none;
  color: #fff;
  font-family: ${FONT};
}
${S}:not(#sct-wg) .sc-globalHeader :is(span, a, li, .sc-globalheader-appName),
${S}:not(#sct-wg) .sc-globalHeader .sc-accountInformation li::after {
  color: #fff;
  font-family: ${FONT};
  font-size: 12px;
  font-weight: bold;
}
${S}:not(#sct-wg) .sc-globalHeader a.sc-global-logo,
${S}:not(#sct-wg) .sc-globalHeader a.sc-global-logo:hover {
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  margin-top: 12px;
  border-radius: 2px;
  /* the token layer cuts 10.5's glyph out of the header colour with a mask */
  mask: none;
  background: ${G.grid}, #c0c0c0;
  ${raised}
}
${S}:not(#sct-wg) .sc-globalHeader a.sc-global-logo:active { ${sunken} }
/* every item centred on the bar: the account list is a row of flex items centred on its own height */
${S}:not(#sct-wg) .sc-globalHeader ul.sc-accountInformation {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  /* the bar's height above its 1px bottom border: 50px in the shell, 49px on SPEAK pages, 47px on
     the Launchpad */
  height: ${bar}px;
}
${S}:not(#sct-wg) .sc-globalHeader ul.sc-accountInformation > li {
  display: flex;
  align-items: center;
  line-height: normal;
}
${S}:not(#sct-wg) .sc-globalHeader .sc-ext-dbName {
  align-self: center;
  margin-top: 0;
  margin-bottom: 0;
  color: #fff;
  font: bold 12px ${FONT};
  line-height: normal;
  vertical-align: middle;
}
${S}:not(#sct-wg) .sc-globalHeader .sc-accountInformation img {
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  padding: 2px;
  border-radius: 0;
  background: #c0c0c0;
  ${raised}
}`;

// ---- Shell: details 10.x's markup and inline styles need ----
const shellHand = `${W("shell")} {
  /* ---- Desktop search box: a 3.1 edit control ---- */
  #SearchBox {
    height: 22px;
    min-height: 0;
    margin: 0 4px 0 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }
  #SearchBox::placeholder { color: #595959; }
  .scStartbarTray td { vertical-align: middle; }

  /* ---- Menus (context menus, start menu fly-outs, drop-downs): white, a black frame with 3.0's drop
     shadow, bold system text, the highlighted item navy. ---- */
  .scPopup:not(:has(> .scStartMenu)) {
    padding: 0;
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: 2px 2px 0 #000;
    background: #fff;
  }
  .scPopup:has(> .scStartMenu) {
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }
  .scMenu {
    border: 0;
    border-collapse: collapse;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    color: #000;
  }
  .scMenu tr > td:is([class^="scMenuItem"], [class^="scMenuPanelItem"]) {
    height: 20px;
    padding-top: 0;
    padding-bottom: 0;
    border: 0;
    background: #fff;
    color: #000;
    font: bold 12px ${FONT};
    line-height: 20px;
  }
  .scMenu td[class^="scMenuItemIcon"] {
    width: 18px;
    padding: 0 2px 0 4px;
  }
  .scMenu td[class^="scMenuItemCaption"] { padding: 0 8px 0 4px; }
  .scMenu td[class^="scMenuItemHotkey"] { padding: 0 4px; }
  .scMenu tr > td[class^="scMenuItem"][class$="_Disabled"] { color: #808080; }
  .scMenu td[class$="_Disabled"] img { opacity: 0.5; }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td,
  .scMenu tr > td[class$="_Hover"] {
    background: #000080;
    color: #fff;
  }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td * { color: #fff; }
  /* separators: one black line across the menu */
  .scMenu tr > td[class^="scMenuDivider"] {
    height: 7px;
    padding: 0;
    border: 0;
    background: linear-gradient(transparent 3px, #000 3px 4px, transparent 4px), #fff;
  }
  .scMenu img[src*="Submenu16x16" i] { ${paint(triRight())} }
  .scMenu tr:hover img[src*="Submenu16x16" i] { background: ${triRight("#fff")}; }

  /* ---- Content tree search: a grey strip, a square edit field and two bevelled buttons of its
     height (fixed border-box heights keep their edges level at any zoom) ---- */
  #SearchPanel {
    margin: 0;
    padding: 3px 4px;
    background: #c0c0c0;
    border-bottom: 1px solid #000;
  }
  #SearchPanel > table {
    width: 100%;
    border-spacing: 0;
  }
  #SearchPanel > table > tbody > tr > td {
    height: auto;
    padding: 0;
    vertical-align: middle;
  }
  #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
  #SearchPanel > table > tbody > tr > td > div {
    float: none !important;
    padding: 0 !important;
  }
  #SearchPanel .scElementHover {
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
  }
  #TreeSearch {
    box-sizing: border-box;
    width: 100%;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }
  :is(a.scSearchButton, a.scSearchOptionsButton) {
    display: block;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    margin: 0 0 0 2px;
    padding: 0;
    background: #c0c0c0;
    border-radius: 2px;
    ${raised}
  }
  :is(a.scSearchButton, a.scSearchOptionsButton):active { ${sunken} }
  :is(a.scSearchButton, a.scSearchOptionsButton) img {
    display: block;
    width: 16px;
    height: 16px;
    margin: 2px;
    padding: 0;
  }
  a.scSearchOptionsButton img { ${paint(triDown())} }
  #TreeSearchOptions {
    width: 100%;
    margin: 3px 0 0;
  }
  #TreeSearchOptions td {
    height: auto;
    padding: 1px 0;
    vertical-align: middle;
  }
  #TreeSearchOptions .scElementHover {
    margin: 0;
    padding: 0 4px 0 0;
    border: 0;
    background: none;
  }
  #TreeSearchOptions :is(a.scSearchOptionName, a.scSearchAddCriteria, a.scSearchAddCriteria span) {
    color: #000;
    font: bold 12px ${FONT};
  }
  #TreeSearchOptions img.arrowDown { ${paint(triDown())} }
  #TreeSearchOptions input.scSearchOptionsInput {
    box-sizing: border-box;
    width: 100%;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }

  /* ---- The language, version and navigator drop-downs above the editor: 3.1 combo boxes, a white
     field with the arrow button at its right end ---- */
  .scEditorTabControls a.scEditorHeaderButton {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    min-width: 0;
    margin: 0 0 0 4px;
    padding: 0 0 0 4px;
    ${edit}
    font: 12px ${FONT};
    line-height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton span {
    display: inline-flex;
    align-items: center;
    height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton img:not([class*="Glyph"]) { margin: 0 2px 0 0; }
  .scEditorTabControls :is(.scEditorHeaderNavigatorGlyph, .scEditorHeaderVersionsLanguageGlyph, .scEditorHeaderVersionsVersionGlyph) {
    width: 18px;
    height: 20px;
    margin: 0 0 0 4px;
    padding: 0;
    border-left: 1px solid #000;
    ${paint(G.combo)}
  }

  /* ---- The chunk's rows sit inside its 1px outline and 2px bevel, as the Experience Editor's do: a 1px
     gap, the 46px panel, a 1px gap, the 18px caption. A raised or pressed button never reaches the
     bevel or covers the caption. 10.4's stock panel padding (10px 8px) would push the buttons over the
     caption; both versions get 10.5's, with the buttons 4px in from the sides rather than 16px. ---- */
  .scRibbonToolbar .chunk { padding-bottom: 2px; }
  .scRibbonToolbar .chunk > .panel {
    box-sizing: border-box;
    height: 46px;
    margin-top: 3px;
    padding: 0 4px 10px;
  }
  .scRibbonToolbar .chunk > .caption {
    height: 18px;
    margin-top: 1px;
    padding: 0 4px;
    line-height: 18px;
  }
  .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) {
    box-sizing: border-box;
    height: 46px;
    padding: 2px 6px 1px;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) {
    box-sizing: border-box;
    height: 46px;
    padding: 0;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonTopDisabled) {
    height: auto;
    padding: 2px 6px 0;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonBottom, .scRibbonToolbarLargeComboButtonBottomDisabled) {
    height: auto;
    padding: 1px 6px;
  }
  /* Sitecore pads the label 4px above and below; under a 24px icon that ran 3px past the 46px button and
     through its hover frame */
  .scRibbonToolbar [class^="scRibbonToolbarLarge"] .header {
    display: block;
    padding: 2px 0 1px;
    line-height: 14px;
  }
  .scRibbonToolbar [class^="scRibbonToolbarLargeComboButtonBottom"] .header { display: inline; }
  /* two small buttons to a column, centred in the panel */
  .scRibbonToolbar .scRibbonToolbarSmallButtons {
    box-sizing: border-box;
    height: 46px;
    padding-top: 2px;
  }
  /* the gallery (Insert, Presets): its list box and scroll buttons inside the panel */
  .scRibbonToolbar .scRibbonGallery {
    box-sizing: border-box;
    height: 46px;
    padding-top: 1px;
    padding-bottom: 0;
  }
  .scRibbonToolbar .scRibbonGalleryList {
    box-sizing: border-box;
    height: 44px;
    margin-top: 0;
  }
  /* the gallery's three scroll buttons share the panel's height */
  .scRibbonToolbar .scRibbonPanelButtons {
    box-sizing: border-box;
    height: 45px;
    margin-top: 0;
    padding: 0;
  }
  .scRibbonToolbar :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) {
    display: block;
    height: 15px;
  }
  /* gallery buttons (Review > Reminder, Archive) end their caption in the arrow, as Subscribe does */
  .scRibbonToolbar [class^="scRibbonToolbarLargeGalleryButton"] .header { display: inline; }
  .scRibbonToolbar [class^="scRibbonToolbarLargeGalleryButton"] > img:first-child {
    display: block;
    margin: 0 auto 4px;
  }

  /* ---- Tabs, all of them (dialog and application tab strips, the ISE's script tabs, Read-Variable's
     pages, the editor tabs): the selected tab is raised 3px taller, bold, and stands over its page's
     top edge so the two join; the others sit lower. Hovering a tab lightens it; keyboard focus is
     3.1's dotted frame. Sitecore swaps the classes to *_Hover under the mouse. ---- */
  .scTabstrip,
  .scTabstrip > nobr {
    display: flex;
    align-items: flex-end;
    overflow: visible;
  }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover)::after { content: none; display: none; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover) {
    position: relative;
    box-sizing: border-box;
    height: 21px;
    /* only the right margin: the ISE reserves room before its first tab with a left one */
    margin-right: 1px;
    padding: 0 10px;
    ${tabFace}
    font-weight: normal;
    line-height: 20px;
    cursor: default;
  }
  :is(.scTabActive, .scTabActive_Hover) {
    top: 1px;
    z-index: 2;
    height: 24px;
    font-weight: bold;
    line-height: 23px;
  }
  :is(.scTab_Hover, .scTab:hover) { background: #dfdfdf; }
  /* over a page, the open tab also covers the white line inside the page's black top edge, so its face runs
     on into the page as one surface (the strip aligns tabs to its bottom, so the extra pixel comes from top) */
  .scTabstripContainer:has(> .scTabs) > .scTabstrip :is(.scTabActive, .scTabActive_Hover) { top: 2px; height: 25px; }
  /* the ISE's script tabs have no page under them: the strip draws the line the open tab stands on, from the
     first tab on (SPE's 52px reserve holds the script tree and variables toggles, with no line under them) */
  #TabsPanel .scTabstrip { background-image: linear-gradient(#000 0 0); background-position: 52px 100%; background-size: 100% 1px; background-repeat: no-repeat; }
  /* SPE pulls a script tab's close X 10px into the tab's 20px right padding; with these 10px it touched the edge */
  .scTabstrip .closeTab { margin: 0 -3px 0 6px; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus { outline: none; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  /* the page: grey, as a 3.1 dialog, inside a black frame with a raised edge */
  .scTabs {
    box-sizing: border-box;
    border: 1px solid #000;
    background: #c0c0c0;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #808080;
  }
  /* Sitecore sets the open tab 1px left (left: -1px) over its neighbours: the page starts there too, so an open
     first tab's black edge and white highlight run straight on down the page's left side */
  .scTabstripContainer > .scTabs { left: -1px; }
  /* the page inside keeps its 1px border, as layout, but unpainted: Sitecore's grey line covered the frame's
     white edge */
  .scTabs > .scTabPage { background: transparent; border-color: transparent; }
  /* list boxes on a page (item trees, lists) stay white */
  .scTabs .scScrollbox { ${edit} }

  /* the Content Editor's editor tabs stand on the tab row's black line */
  #EditorTabs {
    height: 57px;
    border-bottom: 1px solid #000;
  }
  #EditorTabs > a:is(.scRibbonEditorTabNormal, .scRibbonEditorTabActive) {
    position: relative;
    box-sizing: border-box;
    height: 21px;
    margin: 35px 1px 0 0;
    ${tabFace}
  }
  #EditorTabs > a.scRibbonEditorTabActive {
    top: 1px;
    z-index: 2;
    height: 24px;
    margin-top: 32px;
  }
  #EditorTabs > a.scRibbonEditorTabNormal:hover { background: #dfdfdf; }
  #EditorTabs > a:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  #EditorTabs > a#BTAddNewSearch { width: 32px; }
  :is(.scEditorTabHeaderNormal, .scEditorTabHeaderActive) {
    height: auto;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: #000;
    font-weight: normal;
    line-height: 20px;
  }
  .scEditorTabHeaderActive {
    font-weight: bold;
    line-height: 23px;
  }

  /* jQuery UI tab strips */
  .ui-tabs .ui-tabs-nav {
    display: flex;
    align-items: flex-end;
    padding: 0 2px;
    border: 0;
    border-bottom: 1px solid #000;
    border-radius: 0;
    background: transparent;
  }
  .ui-tabs .ui-tabs-nav li {
    position: relative;
    top: 1px;
    height: 21px;
    margin: 0 1px 0 0;
    ${tabFace}
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active { height: 24px; z-index: 2; }
  .ui-tabs .ui-tabs-nav li.ui-state-hover:not(.ui-tabs-active) { background: #dfdfdf; }
  .ui-tabs .ui-tabs-nav li a {
    padding: 0 10px;
    color: #000;
    line-height: 20px;
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active a { font-weight: bold; line-height: 23px; }
  .ui-tabs .ui-tabs-panel { background: #c0c0c0; }

  /* tooltips drawn as markup (SPE's qTip, jQuery UI): Windows' pale yellow tip in a black frame */
  :is(.qtip, .ui-tooltip) {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: none;
    background: #ffffe1;
    color: #000;
    font: 12px ${FONT};
  }
  :is(.qtip, .ui-tooltip) * { color: #000; }

  /* the columns table laid out as a grid: the left list box spans both rows but only as tall as its
     items; the right one, then All Applications under it */
  .scStartMenuContent {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto 1fr;
    align-items: start;
    gap: 6px;
    box-sizing: border-box;
    height: calc(100% - 20px);
    padding: 6px;
  }
  :is(.scStartMenuContentColumns, .scStartMenuContentColumns > tbody, .scStartMenuContentColumns > tbody > tr) { display: contents; }
  :is(.scStartMenuLeft, .scStartMenuRight) {
    display: block;
    width: auto;
    padding: 2px;
    ${edit}
  }
  .scStartMenuLeft { grid-column: 1; grid-row: 1 / span 2; }
  .scStartMenuRight { grid-column: 2; grid-row: 1; }
  .scStartMenuPrograms {
    display: block;
    grid-column: 2;
    grid-row: 2;
    padding: 0;
    border: 0;
    background: transparent;
  }
  .scStartMenuPrograms .scStartMenuDivider { display: none; }
  /* rows: the 32px icon beside its bold name and grey description */
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 2px 4px;
    color: #000;
  }
  :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) {
    float: none;
    flex: none;
    width: 32px;
    height: 32px;
    margin: 0;
  }
  .scStartMenuLeftOptionDescription {
    display: block;
    min-width: 0;
  }
  :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) {
    padding: 0;
    color: #000;
    font: bold 12px / 15px ${FONT};
    white-space: nowrap;
  }
  .scStartMenuLeftOptionTooltip {
    color: #404040;
    font: 12px / 15px ${FONT};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scStartMenuRightFolderDisplayName { flex: 1; }
  /* the folders open fly-outs: 3.1's black arrow at the row's end */
  img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) {
    float: none;
    order: 9;
    width: 16px;
    height: 16px;
    margin: 0;
    ${paint(triRight())}
  }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder):hover { background: #000080; }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder):hover :is(div, span) { color: #fff !important; }
  :is(.scStartMenuRightFolder, .scStartMenuProgramsMenu):hover img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) { background: ${triRight("#fff")}; }
  .scStartMenuDivider {
    height: 1px;
    margin: 2px 4px;
    background: #c0c0c0;
  }
  /* All Applications: a push button */
  a.scStartMenuProgramsMenu {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 26px;
    padding: 0 6px 0 10px;
    ${button}
  }
  a.scStartMenuProgramsMenu:active {
    background: #c0c0c0;
    ${sunken}
  }
  .scStartMenuProgramsMenu .scStartMenuProgramsMenuText {
    flex: 1;
    padding: 0;
    color: #000;
    font: bold 12px ${FONT};
  }
  .scStartMenuProgramsMenu:hover img.scStartMenuProgramsGlyph { background: ${triRight()}; }
  /* 10.4 still has the user band at the top and Log off at the bottom */
  :is(.scStartMenuTop, .scStartMenuBottom) {
    background: #c0c0c0;
    color: #000;
  }
  :is(.scStartMenuTop, .scStartMenuBottom) * { color: #000; }

  /* ---- Fields on tab pages (SPE Read-Variable and other tabbed dialogs): 3.1's 24px edit controls ---- */
  .scTabs :is(input:not([type]), input[type="text"], input[type="password"], input[type="number"], input[type="search"], select:not([multiple]):not([size]:not([size="1"]))) {
    box-sizing: border-box;
    height: 24px;
    min-height: 0;
    padding: 2px 4px;
    font: 12px ${FONT};
  }
  .scTabs select:not([multiple]):not([size]:not([size="1"])) { padding-right: 22px; }
  /* the ribbon's input boxes (the SPE ListView's Filter) too, not 10.5's 34px box */
  :is(.scRibbonToolbarSmallInputBoxInput, .scRibbonToolbarSmallInputBoxInputDisabled) {
    box-sizing: border-box;
    height: 24px;
    min-height: 0;
    padding: 2px 4px;
    border-radius: 0;
    font: 12px ${FONT};
  }
  /* check lists, multilists and their trees are list boxes; radio groups 3.1's etched group box */
  :is(.scContentControlChecklist, .scContentControlMultilistBox, .scBucketListBox, .scBucketListSelectedBox, .scContentControlTree.scScrollbox, .varRule) {
    ${edit}
  }
  .scContentControlChecklist label,
  .scRadioGroup label { font: 12px ${FONT}; color: #000; }
  .scRadioGroup {
    border: 1px solid #808080;
    border-radius: 0;
    box-shadow: inset 1px 1px #fff, 1px 1px #fff;
  }
  :is(.scContentControlMultilistHelp, .scContentControlTreeListHelp) {
    border: 0;
    background: transparent;
    color: #000;
  }
  /* list navigation: bevelled arrow buttons in place of 10.x's blue chevrons */
  :is(img.scNavButton, img[id^="btnRight"], img[id^="btnLeft"], img[id^="btnUp"], img[id^="btnDown"]) {
    width: 18px;
    height: 18px;
    margin: 0 0 4px;
  }
  :is(img.scNavButton, img[id^="btnRight"])[id*="right" i],
  img[id^="btnRight"] { ${paint(G.right)} }
  :is(img.scNavButton, img[id^="btnLeft"])[id*="left" i],
  img[id^="btnLeft"] { ${paint(G.left)} }
  img.scNavButton[id*="_up"], img[id^="btnUp"] { ${paint(G.up)} }
  img.scNavButton[id*="_down"], img[id^="btnDown"] { ${paint(G.down)} }
  img.scNavButton:not([id]):nth-of-type(1) { ${paint(G.right)} }
  img.scNavButton:not([id]):nth-of-type(2) { ${paint(G.left)} }
  td:last-child > img.scNavButton:not([id]):nth-of-type(1) { ${paint(G.up)} }
  td:last-child > img.scNavButton:not([id]):nth-of-type(2) { ${paint(G.down)} }
  :is(img.scNavButton, img[id^="btnRight"], img[id^="btnLeft"], img[id^="btnUp"], img[id^="btnDown"]):active { filter: invert(0.15); }
  .scMultilistNav a.hovertext { color: #000; }
  /* combo tables (date and time pickers, item pickers): one black frame around the field and its button */
  table.scCombobox {
    box-sizing: border-box;
    height: auto;
    min-height: 0;
    border: 1px solid #000;
    border-collapse: collapse;
    border-radius: 0;
    background: #fff;
  }
  table.scCombobox :is(tbody, tr) { height: auto; }
  table.scCombobox td {
    height: auto;
    padding: 0;
    border: 0;
    vertical-align: middle;
  }
  table.scCombobox td input.scComboboxEdit[type] {
    box-sizing: border-box;
    width: 100%;
    /* the dialog field rule sets 24px with !important; inside the combo's frame it is 22px */
    height: 22px !important;
    margin: 0;
    padding: 2px 4px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    font: 12px ${FONT};
  }
  table.scCombobox img.scComboboxDropDown {
    display: block;
    box-sizing: border-box;
    width: 19px;
    height: 22px;
    margin: 0;
    padding: 0;
    border: 0;
    border-left: 1px solid #000;
    border-radius: 0;
    ${paint(G.combo)}
  }
  /* the date picker's calendar: a navy caption with the month between two arrow buttons, the chosen day
     navy as a selection, the other months' days grey */
  table.scCalendar {
    margin: 0;
    border-collapse: collapse;
    color: #000;
    font: 12px ${FONT};
  }
  table.scCalendar td {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    color: #000;
    font: 12px ${FONT};
    text-transform: none;
  }
  table.scCalendar .scCalendarYearRow td {
    height: 22px;
    padding: 0 2px;
    background: #000080;
    color: #fff;
    font-weight: bold;
  }
  .scCalendarYearRow img {
    width: 18px;
    height: 18px;
    vertical-align: middle;
  }
  .scCalendarYearLeftCell img { ${paint(G.left)} }
  .scCalendarYearRightCell img { ${paint(G.right)} }
  table.scCalendar td.scCalendarDay {
    border-bottom: 1px solid #000;
    font-weight: bold;
  }
  table.scCalendar td:is(.scCalendarCell, .scCalendarCellOtherMonth, .scCalendarSelected, .scCalendarToday) {
    height: 18px;
    padding: 1px 5px;
    background: #fff;
    text-align: center;
  }
  table.scCalendar td.scCalendarCellOtherMonth { color: #595959; }
  table.scCalendar td.scCalendarToday { font-weight: bold; }
  table.scCalendar td:is(.scCalendarCell, .scCalendarCellOtherMonth, .scCalendarToday):hover { outline: 1px dotted #000; outline-offset: -3px; }
  table.scCalendar td.scCalendarSelected {
    background: #000080;
    color: #fff;
  }
  table.scCalendar td.scCalendarTodayCell {
    height: 20px;
    text-align: center;
    border-top: 1px solid #000;
    background: #c0c0c0;
  }
  /* the time picker's list: a list box with a navy selection */
  ul.scTimePicker { margin: 0; padding: 0; background: #fff; }
  ul.scTimePicker a {
    display: block;
    padding: 1px 6px;
    border: 0;
    border-radius: 0;
    outline: none;
    box-shadow: none;
    color: #000;
    font: 12px ${FONT};
    text-decoration: none;
  }
  ul.scTimePicker a:is(:hover, :focus, .selected, [aria-selected="true"]) {
    background: #000080;
    color: #fff;
  }

  /* the user and role pickers: a read-only grey field and its ... button at the field's height */
  input.scUserPickerEdit {
    border: 1px solid #000;
    background: #c0c0c0;
    color: #000;
  }
  button.scUserPickerButton {
    width: 30px;
    min-width: 0;
    height: 24px;
    padding: 0;
  }
  /* links in prompts (check list actions, rule text): navy and underlined, as in Help */
  :is(.checkListActions a, .varRule a, .varRule .scLine span[style*="color"], .varRule .scLine a) { color: #000080; text-decoration: underline; }
  .varRule .scLine span { color: #000080; }
  .varTitle { color: #000; font-weight: bold; }
  .varHint { color: #000; }

  /* ---- Drop-down galleries (Edit's workflow box...) open in a frame: a menu's black frame and shadow ---- */
  iframe.scGalleryFrame {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: 2px 2px 0 #000;
  }

  /* ---- Desktop windows are bare frames in 10.x: one that isn't maximised gets 3.1's sizing frame,
     black, grey and black again. The padding's background draws the inner line. ---- */
  .DesktopArea > iframe[id^="FRAME"]:not([style*="width: 100%"]) {
    box-sizing: border-box;
    padding: 1px;
    border: 3px solid #c0c0c0;
    outline: 1px solid #000;
    background: #000;
  }

  /* ---- Taskbar: running applications are 3.1 push buttons, the open one held down ---- */
  #StartbarApplications { border-spacing: 3px 0; }
  :is(.scActiveApplication, .scInactiveApplication) {
    box-sizing: border-box;
    height: 30px;
    padding: 0 8px;
    border-radius: 2px;
    background: #c0c0c0;
    color: #000;
    ${raised}
  }
  .scActiveApplication { ${sunken} }
  :is(.scActiveApplication, .scInactiveApplication) * {
    color: #000;
    font-weight: bold;
  }
  .scActiveApplication .scStartBarApplication { position: relative; top: 1px; left: 1px; }

  /* ---- Bucket search (search tab, Media Library): a 3.1 edit field with square button ends, the
     search terms as framed tokens ---- */
  .search-box {
    min-height: 0;
    ${edit}
  }
  :is(.sb_down, .sb_up),
  :is(.sb_down, .sb_up):hover {
    border-right: 1px solid #000;
    border-radius: 0;
    background-color: #c0c0c0;
    box-shadow: inset 2px 2px #fff, inset -2px -2px #808080;
  }
  .btn-search,
  .btn-search:is(:hover, :active) {
    border-left: 1px solid #000;
    border-radius: 0;
    background-color: #c0c0c0;
    background-image: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png");
    box-shadow: inset 2px 2px #fff, inset -2px -2px #808080;
  }
  .btn-search:active { box-shadow: inset 2px 2px #808080, inset -2px -2px #fff; }
  .filters .filter {
    border: 1px solid #000;
    border-radius: 0;
    background: #fff;
    color: #000;
  }
  .filters .filter :is(.icon, .remove):hover { border-radius: 0; background-color: #c0c0c0; }
  :is(.side .sb_filter, #results table th) { text-transform: none; }

  /* ---- Ribbon drop-down arrows: 3.1's solid black triangle ---- */
  .scRibbon :is(.scRibbonToolbarLargeComboButtonGlyph, .scRibbonToolbarLargeGalleryButtonGlyph, .scRibbonToolbarSmallGalleryButtonGlyph, .scRibbonToolbarSmallComboButtonGlyph) {
    width: 12px;
    height: 12px;
    border: 0;
    vertical-align: middle;
    ${paint(triDown())}
  }
  .scRibbon [class*="Disabled"] :is([class*="ComboButtonGlyph"], [class*="GalleryButtonGlyph"]) { background: ${triDown("#808080")}; }
  /* a large combo button's drop-down: 3.1's combo box arrow, the triangle over a bar */
  .scRibbon .scRibbonToolbarLargeComboButtonGlyph { background: ${ico([tri.down(5, 7, 7), bar(5, 12, 7, 1)])}; }
  .scRibbon [class*="Disabled"] .scRibbonToolbarLargeComboButtonGlyph { background: ${ico([tri.down(5, 7, 7, "#808080"), bar(5, 12, 7, 1, "#808080")])}; }
  .scRibbonToolbar [class*="ButtonDisabled"] .header { color: #808080; }

  /* ---- Ribbon galleries (Home > Insert, Security > Presets): list boxes, the hovered row navy ---- */
  .scRibbonGalleryList {
    ${edit}
  }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"],
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:is(:hover, :active) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
  }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover { background: #000080; }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover * { color: #fff; }
  .scRibbonGalleryList > a.scRibbonToolbarLargeTextButton {
    display: block;
    float: none;
    box-sizing: border-box;
    height: 21px;
    padding: 4px 6px 3px;
    text-align: left;
    white-space: nowrap;
  }
  .scRibbonGalleryList > a.scRibbonToolbarLargeTextButton .scRibbonToolbarLargeTextButtonText {
    display: inline;
    height: auto;
    padding: 0;
    border: 0;
    background: none;
  }
  .scRibbonGalleryList > a.scRibbonToolbarLargeTextButton br { display: none; }

  /* ---- Push buttons in dialogs: 3.1's 23px buttons; the default button has the heavier frame ---- */
  :is(button, input[type="button"], input[type="submit"]).scButton,
  .scFormDialogFooter button {
    box-sizing: border-box;
    min-width: 75px;
    height: 24px;
    min-height: 0;
    margin: 0;
    padding: 0 10px;
    ${button}
    line-height: 20px;
    vertical-align: middle;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:is(:hover, :focus),
  .scFormDialogFooter button:is(:hover, :focus) {
    background: #c0c0c0;
    color: #000;
    border-color: #000;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton.scButtonPrimary {
    border-width: 2px;
    box-shadow: inset 1px 1px #fff, inset -1px -1px #808080, inset 2px 2px #fff, inset -2px -2px #808080;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:active {
    ${sunken}
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:disabled { color: #808080; }
  /* ---- Dialog insets: controls close to the frame, as 3.1's (and Copenhagen's) were, not 10.x's 28px in;
     the buttons end 8px from the corner in a footer as tall as they need ---- */
  .scDialogContentContainer { padding: 8px; }
  .scFormDialogFooter {
    height: 40px;
    padding: 8px;
    line-height: normal;
  }
  .scFormDialogFooter .footerOkCancel {
    position: static;
    float: right;
    display: flex;
    gap: 6px;
  }
  /* SPE's help (?) floats left 8px down for 10.x's taller footer: level with the 24px buttons instead */
  .scFormDialogFooter img#Copyright { margin: 0; }
  /* a dialog's tab strip is as tall as its open tab, not 10.x's 42px with the tabs at the bottom, and draws no
     line of its own: the page's top edge is the line, and the open tab (1px lower) covers it */
  .scDialogContentContainer .scTabstripContainer > .scTabstrip { height: 24px; border-bottom: 0; }
  .scDialogContentContainer .scTabstripContainer > .scTabs { top: 24px; }

  /* ---- Any other text field keeps its size but loses 10.x's rounded frame ---- */
  input:is(:not([type]), [type="text"], [type="search"], [type="password"], [type="number"], [type="email"], [type="url"]):not([readonly], .ace_editor *, .terminal *),
  textarea:not([readonly], .ace_editor *, .terminal *) {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: none;
  }

  /* ---- Drop-down lists: 3.1's combo box, the arrow button flush right ---- */
  select:not([multiple]):not([size]:not([size="1"])) {
    appearance: none;
    padding-right: 22px;
    ${edit}
    background: ${comboRight}, #fff;
  }

  /* ---- The Workbox's caption band is a menu bar, like the Content Editor's; a
     Desktop window's is its title bar instead ---- */
  .scWorkboxWindowCaption:not([data-sct-window-title] *) {
    background: #fff;
    border-bottom: 1px solid #000;
  }

  /* ---- Grids (User Manager, Role Manager...): a list box under raised column headings, the selected
     row navy ---- */
  .Grid {
    border: 1px solid #000;
    background: #fff;
  }
  .HeadingCell {
    padding: 3px 8px;
    border: 0;
    background: #c0c0c0;
    color: #000;
    font-weight: bold;
    ${raised}
  }
  .HeadingCell::after { content: none; }
  .HeadingCell * { color: #000; }
  :is(.Row, .Row:nth-child(odd), .Row:hover) { background: #fff; }
  :is(.Row, .SelectedRow) td.DataCell {
    padding: 2px 8px;
    border: 0;
    color: #000;
  }
  .SelectedRow td.DataCell,
  .SelectedRow td.DataCell * {
    background: #000080;
    color: #fff;
  }
  .GridFooter img[src*="/grid/pager/"] {
    width: 22px;
    height: 22px;
    padding: 0;
  }
  .GridFooter img[src*="/grid/pager/first"] { ${paint(G.first)} }
  .GridFooter img[src*="/grid/pager/prev"] { ${paint(G.left)} }
  .GridFooter img[src*="/grid/pager/next"] { ${paint(G.right)} }
  .GridFooter img[src*="/grid/pager/last"] { ${paint(G.last)} }
  .GridFooter.scGridFooter img:active { width: 22px; height: 22px; padding: 0; }

  /* ---- Fields in dialogs: edit controls of 3.1's height ---- */
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) :is(input:not([type]), input[type="text"], input[type="password"], input[type="search"], input[type="number"], select:not([multiple]):not([size])) {
    box-sizing: border-box;
    height: 24px !important;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 12px ${FONT};
  }
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) textarea {
    ${edit}
    font: 12px ${FONT};
  }
}`;

// ---- Check boxes and radio buttons, everywhere: 3.1's crossed square and black-dotted ring. Focus is a
// dotted frame, as 3.1 drew it around the label. ----
const checks = (S) => `${S}:not(#sct-wg) :is(input[type="checkbox"], input[type="radio"]) {
  appearance: none;
  flex: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  padding: 0;
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: none;
  outline: none;
  background: #fff;
  vertical-align: -2px;
}
${S}:not(#sct-wg) input[type="radio"] { border-radius: 50%; }
${S}:not(#sct-wg) input[type="checkbox"]:checked { background: ${crossed}, #fff; }
${S}:not(#sct-wg) input[type="radio"]:checked { background: radial-gradient(circle, #000 0 2.5px, transparent 3px), #fff; }
${S}:not(#sct-wg) :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px dotted #000; outline-offset: 1px; }
${S}:not(#sct-wg) :is(input[type="checkbox"], input[type="radio"]):disabled { border-color: #808080; opacity: 1; }`;

// ---- SPEAK and Launchpad: fonts, push buttons, check boxes ----
const speakCommon = (S) => `${S} body, ${S} input, ${S} button, ${S} select, ${S} textarea,
${S} :is(h1, h2, h3, h4, h5, h6, p, a, span, label, li, td, th, div) {
  font-family: ${FONT};
}
${S} { scrollbar-color: auto; }
${S} ::-webkit-scrollbar { width: 18px; height: 18px; background: #e0e0e0; }
${S} ::-webkit-scrollbar-thumb { background: #c0c0c0; ${raised} }
${S} ::-webkit-scrollbar-button:single-button { display: block; width: 18px; height: 18px; }
${S} ::-webkit-scrollbar-button:vertical:decrement { background: ${G.up}; }
${S} ::-webkit-scrollbar-button:vertical:increment { background: ${G.down}; }
${S} ::-webkit-scrollbar-button:horizontal:decrement { background: ${G.left}; }
${S} ::-webkit-scrollbar-button:horizontal:increment { background: ${G.right}; }
${header(S, S.includes('launchpad') ? 47 : 49)}
/* push buttons: 3.1's, the default one with the heavier frame */
${S}:not(#sct-wg) .btn.sc-button {
  box-sizing: border-box;
  min-width: 75px;
  height: 24px;
  margin: 0;
  padding: 0 10px;
  ${button}
  line-height: 20px;
}
${S}:not(#sct-wg) .btn.sc-button:is(:hover, :focus) { background: #c0c0c0; color: #000; border-color: #000; }
${S}:not(#sct-wg) .btn.sc-button.btn-primary {
  border-width: 2px;
  box-shadow: inset 1px 1px #fff, inset -1px -1px #808080, inset 2px 2px #fff, inset -2px -2px #808080;
}
${S}:not(#sct-wg) .btn.sc-button:active { ${sunken} }
${S}:not(#sct-wg) .btn.sc-button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${S}:not(#sct-wg) .btn.sc-button:is(:disabled, .disabled) { color: #808080; opacity: 1; }
${S}:not(#sct-wg) .btn.sc-button .sc-button-text { color: inherit; font: inherit; }
${checks(S)}`;

// ---- SPEAK pages ----
const S = T("speak");
const speak = `/* Redmond 3.11: SPEAK pages. Generated by tools/build-workgroups-css.cjs. */
${speakCommon(S)}

/* ---- Experience Editor ribbon: dressed as the Content Editor's ribbon in this theme. The tabs are
   the white menu bar, the strip a grey toolbar of raised groups, buttons flat until hovered. ---- */
${W("speak")} .sc-pageeditbar {
  font: 12px ${FONT};
  color: #000;

  .sc-quickbar {
    display: flow-root;
    height: auto;
    padding: 0 4px;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: none;
    background: #fff;
  }
  .sc-quickbar-item {
    float: left;
    box-sizing: border-box;
    height: 30px;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    font: bold 12px ${FONT};
    line-height: 30px;
    text-transform: none;
    text-decoration: none;
    cursor: default;
  }
  .sc-quickbar-item:focus { outline: none; }
  .sc-quickbar-item:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
  .sc-quickbar-tab { padding: 0 14px; }
  .sc-quickbar-tab:hover,
  .sc-quickbar-tab.sc-quickbar-tab-selected {
    background: #000080;
    color: #fff;
  }
  .sc-quickbar-button {
    width: 24px;
    height: 24px;
    margin: 3px 1px;
    padding: 3px;
    border: 1px solid transparent;
    opacity: 1;
  }
  .sc-quickbar-button > .sprite-speak-ribbon-clean-ee {
    display: block;
    margin: 0;
  }
  .sc-quickbar-button:not(.disabled):hover {
    border-radius: 2px;
    background: #c0c0c0;
    ${raised}
  }
  .sc-quickbar-button:not(.disabled):active { ${sunken} }
  .sc-quickbar-button.disabled > * { opacity: 0.45; }

  .sc-ribbon {
    margin: 0;
    padding: 0;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: none;
    background: #c0c0c0;
  }
  /* no display here: Sitecore switches strips with jQuery hide and show */
  .sc-strip {
    height: 76px;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
  .sc-chunk {
    display: block;
    float: left;
    box-sizing: border-box;
    height: 72px;
    margin: 2px 1px;
    padding: 0 15px;
    background: #c0c0c0;
    white-space: nowrap;
    ${raised}
  }
  .sc-chunk::before,
  .sc-chunk::after { content: none; }
  /* inside the chunk's 1px outline and 2px bevel: a 1px gap, 46px of buttons, a 1px gap, the 18px
     caption; a raised or pressed button never reaches the bevel or the caption */
  .sc-chunk-button-list {
    display: flow-root;
    height: 46px;
    margin: 3px 0 0;
    padding: 0;
  }
  .sc-chunk-label {
    height: 18px;
    margin: 1px 0 0;
    padding: 0;
    color: #000;
    font: 12px ${FONT};
    line-height: 18px;
    text-align: center;
    text-transform: none;
  }

  /* large buttons */
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
    float: left;
    box-sizing: border-box;
    height: 46px;
    margin: 0;
    padding: 2px 6px 1px;
    border: 1px solid transparent;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    text-align: center;
    white-space: nowrap;
    cursor: default;
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) > .sprite-speak-ribbon-clean-ee {
    display: block;
    margin: 0 auto 2px;
  }
  .sc-chunk-button-label {
    margin: 0;
    padding: 0;
    color: inherit;
    font: 12px ${FONT};
    line-height: 14px;
    text-transform: none;
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover {
    background: #c0c0c0;
    ${raised}
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed {
    background: #c0c0c0;
    border-color: #000;
    ${sunken}
  }
  .disabled :is(.sc-chunk-button-label, .sc-chunk-check-small-label),
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small).disabled {
    color: #808080;
  }

  /* small buttons, two to a column */
  .sc-chunk-button-small-list {
    float: left;
    margin: 2px 0 0;
    padding: 0;
  }
  .sc-chunk-check-list {
    display: flow-root;
    float: left;
    height: 42px;
    margin: 2px 0 0;
    padding: 0;
  }
  .sc-chunk-button-small,
  .sc-chunk-check-small {
    display: block;
    box-sizing: border-box;
    height: 21px;
    margin: 0;
    padding: 2px 4px;
    border: 1px solid transparent;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    line-height: 15px;
    text-align: left;
    white-space: nowrap;
    cursor: default;
  }
  .sc-chunk-button-small > .sprite-speak-ribbon-clean-ee {
    display: inline-block;
    float: none;
    margin: 0 4px 0 0;
    vertical-align: -3px;
  }
  .sc-chunk-button-small .sc-chunk-button-label,
  .sc-chunk-check-small-label {
    display: inline;
    float: none;
    color: inherit;
    font: 12px ${FONT};
    line-height: 15px;
  }
  /* drop-down buttons end in 3.1's solid arrow */
  :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton)::after { content: none; }
  :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton) .sc-chunk-button-label::after {
    content: "";
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-left: 2px;
    vertical-align: -2px;
    background: ${triDown()};
  }

  /* the preview date: a white box between two bevelled arrow buttons, inside the 46px row */
  .sc-chunk-panel {
    height: 46px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
  }
  .sc-chunk-datepanel {
    display: flex;
    align-items: center;
    gap: 2px;
    box-sizing: border-box;
    height: 46px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
  }
  a.sc-chunk-datepanel-changedate {
    display: block;
    flex: none;
    box-sizing: border-box;
    width: 18px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: 1px solid #000;
    border-radius: 0;
  }
  a.sc-chunk-datepanel-changedate[data-sc-adddays^="-"] { background: ${G.left}; }
  a.sc-chunk-datepanel-changedate:not([data-sc-adddays^="-"]) { background: ${G.right}; }
  a.sc-chunk-datepanel-changedate:active { filter: invert(0.15); }
  a.sc-chunk-datepanel-changedate > .sprite-speak-ribbon-clean-ee { display: none; }
  .sc-chunk-datepanel-datetime {
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .sc-chunk-datepanel-selector {
    display: flex;
    box-sizing: border-box;
    height: 40px;
    min-height: 0;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    ${edit}
    font: 12px ${FONT};
    line-height: 1.1;
    text-decoration: none;
  }
  .sc-chunk-datepanel-selector * {
    height: auto;
    margin: 0;
    padding: 0;
    color: #000;
    font: 12px ${FONT};
    line-height: 1.15;
  }
  .sc-chunk-datepanel-selector:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
  .sc-chunk-datepanel-day { display: none; }
  .sc-chunk-datepanel-date { font: bold 16px ${FONT}; }
  .sc-chunk-datepanel-monthyear { text-align: center; }
  .sc-chunk-datepanel-time { font-weight: bold; }

  /* the item path under the ribbon: a grey strip with 3.1 push buttons */
  /* 31px with its border, so 24px buttons centre on whole pixels */
  .sc-breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    height: 31px;
    min-height: 0;
    margin: 0;
    padding: 0 4px;
    border: 0;
    border-bottom: 1px solid #000;
    box-shadow: none;
    background: #c0c0c0;
  }
  .sc-breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 2px;
    float: none;
    height: auto;
    padding: 0;
  }
  .sc-breadcrumb .scContentButton { padding: 0 0 0 4px; }
  .sc-breadcrumb-item-path {
    color: #000;
    font: bold 12px ${FONT};
  }
  .sc-breadcrumb-item-button,
  .sc-breadcrumb-item-action {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    margin: 0;
    padding: 2px;
    border: 1px solid transparent;
    border-radius: 0;
  }
  :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover {
    background: #c0c0c0;
    ${raised}
  }
}

/* ---- SPEAK dialogs (the EE's Preview Date and Time, ...): a dialog-page header, and the date and time
   pickers as 3.1 combo boxes whose arrow button replaces the calendar and clock icons ---- */
/* the header is the window's caption, as the shell's dialog pages draw it: the title centred in a navy
   band under the frame's control-menu box, the description below it on the dialog grey */
${W("speak")} .sc-dialogWindow-header {
  height: auto;
  padding: 0;
  border: 0;
  background: #c0c0c0;
  color: #000;
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title {
  display: block;
  float: none;
  box-sizing: border-box;
  width: auto;
  height: 19px;
  margin: 0;
  padding: 0 46px;
  border-bottom: 1px solid #000;
  background: #000080;
  text-align: center;
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title .sc-text {
  display: block;
  height: 18px;
  margin: 0;
  padding: 0;
  color: #fff;
  font: bold 12px / 18px ${FONT};
}
${W("speak")} .sc-dialogWindow-header > .sc-text-title {
  display: block;
  padding: 6px 10px;
  color: #000;
  font: 12px / 16px ${FONT};
}
${W("speak")} .sc-dialogWindow-buttons {
  border-top: 0;
  background: #c0c0c0;
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker) {
  box-sizing: border-box;
  height: 24px;
  min-height: 0;
  padding: 2px 22px 2px 4px;
  ${edit}
  background: ${comboRight}, #fff;
  font: 12px ${FONT};
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker):focus { outline: 1px dotted #000; outline-offset: -3px; box-shadow: none; }
/* jQuery UI's calendar: as the Content Editor's date picker, a navy caption with the month in white bold
   between two arrow buttons, the chosen day navy, the other months' days grey */
${W("speak")} #ui-datepicker-div.ui-datepicker {
  padding: 0;
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: 2px 2px 0 #000;
  background: #fff;
  color: #000;
  font: 12px ${FONT};
}
${W("speak")} .ui-datepicker .ui-datepicker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 2px;
  border: 0;
  border-radius: 0;
  background: #000080;
}
${W("speak")} .ui-datepicker .ui-datepicker-title {
  order: 1;
  margin: 0;
  color: #fff;
  font: bold 12px / 22px ${FONT};
  text-transform: none;
}
${W("speak")} .ui-datepicker .ui-datepicker-title * { color: #fff; font: inherit; text-transform: none; }
${W("speak")} .ui-datepicker :is(.ui-datepicker-prev, .ui-datepicker-next) {
  position: static;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 0;
  cursor: default;
}
${W("speak")} .ui-datepicker .ui-datepicker-prev,
${W("speak")} .ui-datepicker .ui-datepicker-prev:hover { order: 0; background: ${G.left}; }
${W("speak")} .ui-datepicker .ui-datepicker-next,
${W("speak")} .ui-datepicker .ui-datepicker-next:hover { order: 2; background: ${G.right}; }
${W("speak")} .ui-datepicker :is(.ui-datepicker-prev, .ui-datepicker-next) span { display: none; }
${W("speak")} .ui-datepicker table.ui-datepicker-calendar { margin: 0; border-collapse: collapse; border-spacing: 0; background: #fff; }
${W("speak")} .ui-datepicker tr { height: auto; }
${W("speak")} .ui-datepicker th {
  height: auto;
  padding: 2px 4px;
  line-height: 16px;
  border: 0;
  background: #fff;
  border-bottom: 1px solid #000;
  color: #000;
  font: bold 12px ${FONT};
  text-transform: none;
}
${W("speak")} .ui-datepicker td { height: auto; padding: 0; border: 0; }
${W("speak")} .ui-datepicker td :is(a, span) {
  display: block;
  width: auto;
  height: auto;
  margin: 0;
  padding: 2px 5px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: #fff;
  color: #000;
  font: 12px / 16px ${FONT};
  text-align: center;
}
${W("speak")} .ui-datepicker td.ui-datepicker-other-month :is(a, span) { color: #595959; }
${W("speak")} .ui-datepicker td.ui-datepicker-today a { font-weight: bold; }
${W("speak")} .ui-datepicker td a:hover { outline: 1px dotted #000; outline-offset: -3px; background: #fff; }
${W("speak")} .ui-datepicker td.ui-datepicker-current-day a,
${W("speak")} .ui-datepicker td a.ui-state-active {
  background: #000080;
  color: #fff;
}
/* the time picker's list: a list box with a navy selection */
${W("speak")} .ui-timepicker-wrapper {
  border: 1px solid #000;
  border-radius: 0;
  box-shadow: 2px 2px 0 #000;
  background: #fff;
}
${W("speak")} .ui-timepicker-list li {
  padding: 1px 6px;
  color: #000;
  font: 12px ${FONT};
}
${W("speak")} .ui-timepicker-list li:hover,
${W("speak")} .ui-timepicker-list li.ui-timepicker-selected {
  background: #000080;
  color: #fff;
}

/* ---- Control Panel: a Program Manager window. The page title is its caption, Back its menu bar, and
   each group a group window: a framed window with a white caption that turns navy when active, its
   tasks listed as in a list box. ---- */
${W("speak")} body:has(.sc-controlpanel-box) {
  background: #fff;

  .sc-applicationContent {
    min-height: 100vh;
    background: #fff;
    color: #000;
    font: 12px ${FONT};
  }
  .sc-applicationHeader {
    border: 0;
    box-shadow: none;
    background: none;
  }
  .sc-applicationHeader-row1 {
    box-sizing: border-box;
    height: 20px;
    border-bottom: 1px solid #000;
    background: #000080;
  }
  .sc-applicationHeader-row1 .sc-applicationHeader-content {
    height: 19px;
    padding: 0 15px;
  }
  .sc-applicationHeader-title {
    float: none;
    margin: 0;
    padding: 0;
    text-align: center;
  }
  .sc-applicationHeader-title,
  .sc-applicationHeader-title .sc-text {
    display: block;
    height: 19px;
    color: #fff;
    font: bold 12px ${FONT};
    line-height: 19px;
  }
  .sc-applicationHeader-row2 {
    box-sizing: border-box;
    height: 21px;
    padding: 0 4px;
    border: 0;
    border-bottom: 1px solid #000;
    background: #fff;
  }
  .sc-applicationHeader-back { height: 20px; margin: 0; padding: 0; }
  .btn.sc-backbutton {
    display: block;
    height: 20px;
    margin: 0;
    padding: 0 8px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
  }
  .btn.sc-backbutton::before { content: none; }
  .sc-backbutton-text {
    position: static;
    height: 20px;
    margin: 0;
    padding: 0;
    color: inherit;
    font: bold 12px ${FONT};
    line-height: 20px;
  }
  .btn.sc-backbutton:is(:hover, :focus-visible) {
    background: #000080;
    color: #fff;
    outline: none;
  }
  .sc-applicationContent-main {
    margin-top: 8px;
    background: none;
  }
  .sc-controlpanel-box {
    margin: 8px 0 0;
    padding: 3px;
    border: 1px solid #000;
    background: #c0c0c0;
    box-shadow: inset 0 0 0 2px #c0c0c0, inset 0 0 0 3px #000;
  }
  .sc-controlpanel-box-header h4 {
    height: 19px;
    margin: 0;
    border-bottom: 1px solid #000;
    background: #fff;
    color: #000;
    font: bold 12px ${FONT};
    line-height: 19px;
    text-align: center;
    text-transform: none;
  }
  .sc-controlpanel-box-header h4 img { display: none; }
  .sc-controlpanel-box:is(:hover, :focus-within) .sc-controlpanel-box-header h4 {
    background: #000080;
    color: #fff;
  }
  .sc-controlpanel-box-content {
    padding: 2px;
    border: 0;
    box-shadow: none;
    background: #fff;
  }
  .sc-controlpanel-box-content li {
    height: auto;
    padding: 0;
    border: 0;
  }
  .sc-controlpanel-box-content a {
    display: block;
    padding: 1px 4px;
    color: #000;
    font: 12px ${FONT};
    line-height: 16px;
    text-decoration: none;
    white-space: nowrap;
  }
  .sc-controlpanel-box-content a:is(:hover, :focus) {
    background: #000080;
    color: #fff;
    outline: none;
  }
}`;

// ---- Launchpad: sitting in front of Windows for Workgroups 3.11. The page is the desktop in the Windows
// Default scheme's grey (Background=192 192 192); on it Program Manager, a framed window under its navy
// caption whose client is the white application workspace (AppWorkspace=255 255 255). The groups are its
// child windows, arranged as Window > Tile leaves them: abutting, two to a row. Each is a framed group
// window, its caption white (InactiveTitle) and navy for the active one: the first, or the one under
// the mouse or holding the focus. Icons sit on 3.1's icon grid, 32px with the title wrapping under it,
// the selected one's title navy (Hilight). Custom Analytics is a message box child window. Program
// Manager's menu bar and caption buttons are left out: none of them would do anything here. ----
const L = T("launchpad");
const icon = (href, url) => `  .sc-launchpad-item${href} .icon img { content: url("${url}"); }`;
// 3.1's sizing frame: a black outline, a 3px band of the border colour, a black inner line
const frame = "border: 1px solid #000; padding: 4px; box-shadow: inset 0 0 0 3px #c0c0c0, inset 0 0 0 4px #000;";
const caption = `height: 18px; margin: 0; padding: 0 8px; border: 0; border-bottom: 1px solid #000; font: bold 12px / 18px ${FONT}; text-align: center; text-transform: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
const launchpad = `/* Redmond 3.11: Launchpad. Generated by tools/build-workgroups-css.cjs. */
${speakCommon(L)}
${W("launchpad")} {
  /* the desktop */
  body,
  .sc-applicationContent {
    background: #c0c0c0;
    color: #000;
    font: 12px ${FONT};
  }
  .sc-applicationContent {
    box-sizing: border-box;
    min-height: 100vh;
    padding: 0 8px 8px;
  }
  .sc-applicationHeader {
    border: 0;
    box-shadow: none;
    background: none;
  }
  .sc-applicationHeader-title,
  .sc-applicationHeader-title .sc-text {
    color: #fff;
    font-family: ${FONT};
    font-size: 12px;
    font-weight: bold;
  }
  /* XM's logo is drawn dark for 10.x's white header */
  .sc-applicationHeader-title::before { filter: brightness(0) invert(1); }
  /* the header here is 48px with the button 7px down */
  .sc-globalHeader a.sc-global-logo,
  .sc-globalHeader a.sc-global-logo:hover { margin-top: 4px; }

  /* Program Manager */
  /* the window fills the desktop under the header, its white workspace down to the frame */
  .sc-applicationContent-main {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    min-height: calc(100vh - 65px);
    max-width: none;
    margin: 8px 0 0;
    ${frame}
    background: #c0c0c0;
  }
  .sc-applicationContent-main::before {
    content: "Program Manager";
    display: block;
    ${caption}
    background: #000080;
    color: #fff;
  }
  /* Tile fills the workspace: the group windows share its height, Custom Analytics under them */
  .sc-applicationContent-main > .row {
    display: flex;
    flex-direction: column;
    flex: 1;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .sc-applicationContent-main > .row > div {
    float: none;
    width: auto;
    padding: 0;
  }
  div[data-sc-id="ColumnPanel1"] {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 0;
  }

  /* the group windows, tiled */
  .sc-launchpad {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: 1fr;
    flex: 1;
    float: none;
    width: auto;
    max-width: none;
    margin: 0;
    padding: 0;
  }
  .sc-launchpad-group {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    box-sizing: border-box;
    min-width: 0;
    margin: 0;
    ${frame}
    background: linear-gradient(#fff, #fff) content-box, #c0c0c0;
  }
  .sc-launchpad-group-title {
    flex: 0 0 100%;
    box-sizing: border-box;
    ${caption}
    margin-bottom: 4px;
    background: #fff;
    color: #000;
  }
  .sc-launchpad:not(:has(.sc-launchpad-group:is(:hover, :focus-within))) .sc-launchpad-group:first-child .sc-launchpad-group-title,
  .sc-launchpad-group:is(:hover, :focus-within) .sc-launchpad-group-title {
    background: #000080;
    color: #fff;
  }

  /* program items on the icon grid */
  .sc-launchpad-item,
  .sc-launchpad-item:is(:hover, :active, :focus) {
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    width: 76px;
    height: auto;
    min-height: 64px;
    margin: 2px 0 4px;
    padding: 2px 0 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
    outline: none;
    text-decoration: none;
  }
  .sc-launchpad-item .icon {
    display: block;
    width: 32px;
    height: 32px;
    margin: 0 0 3px;
    padding: 0;
    border-radius: 0;
    background: none;
  }
  .sc-launchpad-item .icon img {
    display: block;
    width: 32px;
    height: 32px;
    margin: 0;
  }
  .sc-launchpad-item .sc-launchpad-text {
    float: none;
    max-width: 72px;
    padding: 0 2px;
    color: #000;
    font: 12px / 14px ${FONT};
    text-align: center;
    white-space: normal;
  }
  .sc-launchpad-item:is(:hover, :focus-visible) .sc-launchpad-text {
    background: #000080;
    color: #fff;
  }
  /* keyboard focus: 3.1's dotted rectangle around the selected title */
  .sc-launchpad-item:focus-visible .sc-launchpad-text {
    outline: 1px dotted #fff;
    outline-offset: -1px;
  }
  /* applications the start menu also lists take its colour icons, as Program Manager's did */
${icon('[href*="Content Editor.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/pencil.png")}
${icon('[href*="Media/MediaShop.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/pictures.png")}
${icon('[href*="Workbox.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/workbox.png")}
${icon('[href*="Recycle Bin.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/refresh.png")}
${icon('[href*="PowerShell/PowerShellIse"]', "/sitecore/shell/~/icon/PowerShell/32x32/ise8.png")}
${icon('[href*="PowerShell/PowerShellReports"]', "/sitecore/shell/~/icon/PowerShell/32x32/powershell_runner.png")}
${icon('[href*="ControlPanel.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/setting.png")}
${icon('[href*="shell/default.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/monitor.png")}
${icon('[href*="User Manager.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/user (1).png")}
${icon('[href*="Security Editor.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/shield.png")}
${icon('[href*="Access Viewer.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/lock.png")}
${icon('[href*="Domain Manager.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/routes.png")}
${icon('[href*="Role Manager.aspx"]', "/sitecore/shell/~/icon/Apps/32x32/account.png")}
${icon('[href*="FormsBuilder"]', "/sitecore/shell/~/icon/Apps/32x32/forms.png")}
${icon(':is([href="/"], [href^="/?"])', "/sitecore/shell/~/icon/Apps/32x32/paint.png")}
  /* Custom Analytics: a message box child window under the tiles. Its caption is the label before the
     box, laid into the box's frame. */
  .sc-text[data-sc-id="CustomAnalyticsLabel"] {
    position: relative;
    z-index: 1;
    display: block;
    float: none;
    box-sizing: border-box;
    ${caption}
    margin: 0 4px -23px;
    background: #fff;
    color: #000;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] {
    float: none;
    box-sizing: border-box;
    width: auto;
    margin: 0;
    ${frame}
    padding-top: 23px;
    background: #c0c0c0;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) {
    float: none;
    width: auto;
    margin: 0;
    padding: 0;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border {
    min-height: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
  }
  .sc-border[data-sc-id="FallbackMessageWrap"] {
    position: static;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 14px 16px;
  }
  /* MessageBox's information icon: an "i" in a white disc */
  .sc-border[data-sc-id="FallbackMessageWrap"]::before {
    content: "i";
    flex: none;
    box-sizing: border-box;
    width: 32px;
    height: 32px;
    border: 1px solid #000;
    border-radius: 50%;
    background: #fff;
    color: #000080;
    font: bold 22px / 30px "Times New Roman", serif;
    text-align: center;
  }
  .sc-text[data-sc-id="FallBackMessage"] {
    position: static;
    display: block;
    color: #000;
    font: 12px / 16px ${FONT};
    text-align: left;
  }
}`;

// ---- Login: WfW's logon dialog. A grey desktop without wallpaper, the box a framed dialog under a navy
// caption, 3.1 edit fields and an OK-sized default button. ----
const LG = W("login");
const login = `/* Redmond 3.11: login. Generated by tools/build-workgroups-css.cjs. */
${LG} body {
  background: #c0c0c0;
  color: #000;
  font: 12px ${FONT};
}
${LG} :is(label, a, input, button, span, div, p, li) {
  font-family: ${FONT};
  text-shadow: none;
}
${LG} .main {
  max-width: 440px;
  padding: 3px;
  border: 1px solid #000;
  border-radius: 0;
  background: #c0c0c0;
  box-shadow: inset 0 0 0 2px #c0c0c0, inset 0 0 0 3px #000;
}
${LG} .main::before {
  content: "Welcome to Sitecore";
  display: block;
  height: 19px;
  border-bottom: 1px solid #000;
  background: #000080;
  color: #fff;
  font: bold 12px / 19px ${FONT};
  text-align: center;
}
${LG} .logo-wrap {
  margin: 16px 0 12px;
}
/* the white logo, drawn black on the grey dialog */
${LG} .logo-wrap img {
  height: 36px;
  width: auto;
  filter: brightness(0);
}
${LG} :is(.login-page, .logged-out, .main > :not(.logo-wrap)) {
  padding: 0 16px 12px;
}
${LG} label {
  margin: 0 0 3px;
  color: #000;
  font-size: 12px;
  font-weight: normal;
}
${LG} .form-control {
  box-sizing: border-box;
  height: 24px;
  margin: 0 0 8px;
  padding: 2px 4px;
  ${edit}
  font-size: 12px;
}
${LG} .form-control:focus {
  border-color: #000;
  box-shadow: none;
  outline: 1px dotted #000;
  outline-offset: 1px;
}
${LG} .btn {
  display: block;
  box-sizing: border-box;
  width: auto;
  min-width: 75px;
  height: 24px;
  margin: 4px 0 0 auto;
  padding: 0 14px;
  ${button}
  line-height: 20px;
}
${LG} .btn.btn-primary {
  border-width: 2px;
  box-shadow: inset 1px 1px #fff, inset -1px -1px #808080, inset 2px 2px #fff, inset -2px -2px #808080;
}
${LG} .btn:is(:hover, :focus) {
  background: #c0c0c0;
  color: #000;
  border-color: #000;
}
${LG} .btn:active { ${sunken} }
${LG} .btn:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${LG} a,
${LG} a:is(:hover, :focus) {
  color: #000080;
  text-decoration: underline;
}
${LG} .remember-me + .forgot-password::before,
${LG} .vertical-separator {
  border-left-color: #000;
}
${checks(T("login"))}
${LG} input[type="checkbox"] { margin-top: 2px; }
${LG} .warning {
  ${edit}
}
${LG} .top {
  border: 1px solid #000;
  box-shadow: none;
  background: #c0c0c0;
}
${LG} .top > a { color: #000; }
`;

const css = `/* Redmond 3.11: classic shell. Generated by tools/build-workgroups-css.cjs.
   Default colour scheme of Windows for Workgroups 3.11, 2px white/#808080 bevels inside black
   outlines, navy captions. */

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: "MS Sans Serif", "Microsoft Sans Serif", Arial, sans-serif;
}
${P} {
  scrollbar-color: auto;
}

/* ---- Scrollbars (Chrome and Edge; Firefox only takes colours) ---- */
${P} ::-webkit-scrollbar { width: 18px; height: 18px; background: #e0e0e0; }
/* list boxes and text areas too: the token layer colours their thumbs (as caption navy here) one selector
   weight higher, and Sitecore rounds them */
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 0; ${raised} }
${P} ::-webkit-scrollbar-button:single-button { display: block; width: 18px; height: 18px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${G.up}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${G.down}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${G.left}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${G.right}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar, 12px with a rounded thumb in a
   white ring, which outranks the rules above: the 3.1 bar again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 18px; height: 18px; background: #e0e0e0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-track { background: transparent; border-radius: 0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 0; ${raised} }

/* ---- Global header: the active window's title bar ---- */
${P} .sc-globalHeader {
  background: #000080;
  border-bottom: 1px solid #000;
  color: #fff;
  font-weight: bold;
}
${P} .sc-globalHeader .sc-accountInformation li,
${P} .sc-globalHeader .sc-accountInformation span,
${P} .sc-globalHeader .sc-accountInformation a,
${P} .sc-globalHeader a { color: #fff; }

/* ---- Ribbon tabs: the menu bar ---- */
${P} .scRibbonNavigator { background: #fff; border-bottom: 1px solid #000; }
${P} .scRibbon a.scRibbonNavigatorButtonsNormal,
${P} .scRibbon a.scRibbonNavigatorButtonsActive {
  font-weight: bold;
  text-transform: none;
  border: 0;
  border-radius: 0;
  color: #000;
  background: transparent;
}
${P} .scRibbon a.scRibbonNavigatorButtonsNormal:hover,
${P} .scRibbon a.scRibbonNavigatorButtonsActive {
  background: #000080;
  color: #fff;
}

/* ---- Ribbon toolbar: grey toolbar with bevelled groups ---- */
${P} .scRibbonToolbar { background: #c0c0c0; border-bottom: 1px solid #000; }
${P} .scRibbonToolbar .chunk { height: auto; background: #c0c0c0; ${raised} margin: 2px 1px; }
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #000; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; }
/* Only the buttons themselves: icons, captions and the small-button columns carry "Button" in their
   class names too. A small combo button raises as one piece, as 3.1's split controls did. A large one
   is flat until hovered, then shows its command and its drop-down as two faces, each pressed on its own. */
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"], span[class^="scRibbonToolbar"][class*="Disabled"], .scRibbonToolbarLargeComboButton, .scRibbonToolbarSmallComboButton) { border: 1px solid transparent; border-radius: 0; box-shadow: none; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):hover { background: #c0c0c0; ${raised} }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):active,
${P} .scRibbonToolbar a[class^="scRibbonToolbar"][class*="ButtonDown"] { background: #c0c0c0; border: 1px solid #000; ${sunken} }
${P} .scRibbonToolbar a[class*="ComboButton"]:is(:hover, :active) { background: transparent; border-color: transparent; box-shadow: none; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom) { background: #c0c0c0; border-color: #000; box-shadow: inset 1px 1px #fff, inset -1px -1px #808080; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom):active { background: #c0c0c0; border-color: #000; box-shadow: inset 1px 1px #808080, inset -1px -1px #fff; }
${P} a.scSystemMenu {
  background: ${G.ctrl};
}
${P} a.scSystemMenu:hover { background-color: transparent; }

/* ---- Content tree: File Manager ---- */
${P} .scContentTree { background: #fff; }
/* the selected node is navy in every tree, the dialogs' item pickers too */
${P} a.scContentTreeNodeActive { background: #000080; color: #fff; border-radius: 0; }
${P} a.scContentTreeNodeActive span { color: #fff !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; outline: 1px dotted #000; }
/* The [+]/[-] box is a real 9px bordered box, margined out to the stock 16px footprint: at 125% scaling
   gradient edges and inset shadows land between device pixels and smear, borders snap. */
${P} img[src*="/treemenu_"] {
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  margin: 4px 3px 3px 4px;
  border: 1px solid #000;
  object-fit: none;
  object-position: -999px -999px;
}
/* Default.css gives tree glyphs a 5px 0 margin */
${P} .scContentTreeNode > img[src*="/treemenu_"] { margin: 9px 3px 8px 4px; }
${P} img[src*="/treemenu_collapsed"] {
  background: linear-gradient(#000, #000) center / 1px 5px no-repeat, linear-gradient(#000, #000) center / 5px 1px no-repeat, #fff;
}
${P} img[src*="/treemenu_expanded"] { background: linear-gradient(#000, #000) center / 5px 1px no-repeat, #fff; }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font-weight: bold; font-size: 14px; color: #000; }
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  background: #c0c0c0;
  color: #000;
  font-weight: bold;
  line-height: 20px;
  padding: 0 0 0 8px;
  margin: 0 0 2px;
  ${raised}
}
${P} img.scEditorSectionCaptionGlyph { width: 18px; height: 18px; margin: 1px 2px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(G.up)} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(G.down)} }
${P} .scEditorFieldLabel { color: #000; font-weight: bold; }
/* The marker bar only shows validation colours, as in 10.x; 3.1 had no gutter. */
${W("shell")} td.scEditorFieldMarkerBarCell { background: transparent; border-left-color: transparent; }
${P} .scContentControl,
${P} .scEditorSections input:not([type="checkbox"]):not([type="radio"]),
${P} .scEditorSections textarea,
${P} .scEditorSections select {
  ${edit}
}

${P} .scSearchInput { ${edit} }

/* ---- Buttons ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] {
  ${button}
}
${P} .scButton:active, ${P} button:not(.ui-button):active { box-shadow: inset 2px 2px #808080, inset -1px -1px #fff; }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }

/* ---- Bottom application tabs ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 2px; background: #c0c0c0; border-top: 1px solid #fff; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive { color: #000; font-weight: bold; background: #c0c0c0; ${raised} border-radius: 0; margin: 1px; }
${P} .scPagerButtonActive { box-shadow: inset 2px 2px #808080, inset -2px -2px #fff; }
/* 10.5 draws the pager's links white once visited (the page links to itself); computed styles hide it */
${W("shell")} a:is(.scPagerButtonNormal, .scPagerButtonActive):is(:link, :visited) { color: #000; }

/* ---- Dialog windows (jQuery UI frames around Sitecore dialogs) ---- */
${P} .ui-dialog {
  background: #c0c0c0;
  border: 1px solid #000;
  border-radius: 0;
  padding: 3px;
  box-shadow: inset 0 0 0 2px #c0c0c0, inset 0 0 0 3px #000;
}
/* Sitecore stacks a 15px jQuery title bar above the dialog page, whose header is the navy caption.
   Laid over the caption, the bar keeps dragging and carries the buttons into the caption. */
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 3px;
  left: 3px;
  right: 3px;
  height: 18px;
  min-height: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background-size: 18px 18px;
  background-repeat: no-repeat;
  background-color: transparent;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
/* The button pane spans the title bar; the close button becomes the control-menu box on the left.
   Sitecore pins the pane with !important and writes the close button's position inline. */
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  left: 0;
  right: 0 !important;
  top: 0 !important;
  width: auto;
  display: flex;
  justify-content: flex-end;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: -1;
  margin-right: auto !important;
  background: ${G.ctrl};
  border-right: 1px solid #000;
}
/* 3.1 never dimmed the screen behind a dialog; a faint shade still marks the dialog as modal. */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.12); opacity: 1; }
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: ${G.up}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: ${G.down}; }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: ${G.updown}; }

/* Inside a dialog page: its header is the navy title bar. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #c0c0c0; padding: 0; border: 0; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  background: #000080;
  color: #fff;
  font-weight: bold;
  font-size: 12px;
  text-align: center;
  line-height: 18px;
  height: 18px;
  margin: 0;
  padding: 0 46px;
  border-bottom: 1px solid #000;
}
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 6px 10px; margin: 0; }
/* SPE puts a 32px icon in the caption; 3.1 captions were one line of text. */
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin-right: 4px; vertical-align: -3px; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter { background: #c0c0c0; }

/* ---- Window buttons: 3.1's bevelled ▼ ▲ buttons; close is the control-menu bar ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { width: 18px; height: 18px; margin: 0 0 0 1px; padding: 0; vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { ${paint(G.switcher)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { ${paint(G.down)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { ${paint(G.up)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { ${paint(G.updown)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { ${paint(G.closeBox)} }
/* Standard windows (ISE, Console, Package Designer...): a 3.1 title bar; the close button is the control-menu box. */
${P} .standardWindowCaption { height: 20px; background: #000080; border-bottom: 1px solid #000; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 21px; }
${P} .standardWindowCaption .scWindowCaption { display: block; line-height: 20px; font-size: 12px; font-weight: bold; color: #fff; text-align: center; padding: 0 44px; }
${P} .standartWindowButtons { top: 1px; left: 1px; right: 1px; display: flex; justify-content: flex-end; pointer-events: none; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. 3.11's navy caption bar, as on every other window, is
   drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), the window's
   buttons on it and the ribbon's menu button moved below it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 21px; background: #000080; border-bottom: 1px solid #000; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 20px; padding: 0 80px; color: #fff; font: bold 12px/20px ${FONT}; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 1px; right: 1px; margin-right: 0; height: 19px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 21px; height: 31px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }

${P} .standartWindowButtons img { pointer-events: auto; }
/* SPE's ISE (ise.js) gives its title the room the .standartWindowButtons box leaves; here that box spans the
   bar (the control box on the left, the arrows on the right), so the title would get none. The caption's
   own padding already keeps the title clear of the buttons. */
${P} .standardWindowCaption #WindowCaption { max-width: 100% !important; margin-left: 0 !important; }
${P} .standartWindowButtons img[src*="_close"] { order: -1; margin: 0 auto 0 0; }

/* ---- Insert gallery scroller: bevelled buttons ---- */
${P} .scRibbonPanelButtons { background: #c0c0c0; }
${P} img.scRibbonPanelUp { ${paint(G.up)} width: 18px; height: 18px; filter: none; }
${P} img.scRibbonPanelDown { ${paint(G.down)} width: 18px; height: 18px; filter: none; }
${P} img.scRibbonPanelOpen { ${paint(G.dots)} width: 18px; height: 18px; filter: none; }

/* ---- Desktop ---- */
${P} #Startbar, ${P} #Startbar > table { background: #c0c0c0; border-top: 1px solid #fff; box-shadow: inset 0 1px #dfdfdf; }
${P} .scStartButton, ${P} .scStartButton.scPopupOpener, ${P} .scStartButton:hover {
  background: url("/sitecore/shell/themes/standard/images/homebutton2.png") center / 24px 24px no-repeat, #c0c0c0;
  ${raised}
}
${P} .scStartBarScroller a, ${P} .scStartBarScroller div[class*="Button"] { color: #000; font-weight: bold; }
${P} .scStartbarTray, ${P} .scStartbarTray * { color: #000; background-color: transparent; }
/* ---- Start menu: Program Manager. A framed window under its navy caption, its grey client holding
   two list boxes only as tall as their items, All Applications a push button under the right one. ---- */
${P} #StartMenu {
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid #000;
  background: #c0c0c0;
  box-shadow: inset 0 0 0 3px #c0c0c0, inset 0 0 0 4px #000;
}
${P} #StartMenu::before {
  content: "Program Manager";
  display: block;
  height: 19px;
  border-bottom: 1px solid #000;
  background: #000080;
  color: #fff;
  font: bold 12px / 19px ${FONT};
  text-align: center;
}

/* ==== Hand-written details ==== */
${header(P, 50)}
/* the shell's header: the button centred in its 50px bar */
${W("shell")} .sc-globalHeader .sc-globalHeader-startButton {
  display: flex;
  align-items: center;
  height: 50px;
}
${W("shell")} .sc-globalHeader a.sc-global-logo,
${W("shell")} .sc-globalHeader a.sc-global-logo:hover { margin-top: 0; }
${checks(P)}
${shellHand}`;

const out = { shell: css, speak, launchpad, login };
for (const [name, text] of Object.entries(out)) {
  fs.writeFileSync(path.join(__dirname, "..", "extension", "themes", "workgroups311", `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
