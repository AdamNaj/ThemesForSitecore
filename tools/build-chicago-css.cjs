// Dev tool: writes extension/themes/chicago/{shell,speak,launchpad,login}.css and the glyph images in
// extension/themes/chicago/glyphs. The bevels and glyphs are drawn from code, so they are generated
// here rather than written by hand. Started from tools/build-workgroups-css.cjs (Chicago).
//
// Windows 95/98 standard scheme, measured from the 98 system metrics at 100%:
//   face #c0c0c0, 3D light #dfdfdf, highlight #fff, shadow #808080, dark shadow #0a0a0a, desktop #008080
//   push button: outer white top-left / dark shadow bottom-right, inner #dfdfdf / #808080 (2px per side)
//   window frame: outer #dfdfdf / #0a0a0a, inner #fff / #808080, then 1px of face before the caption
//   sunken field: outer #808080 / #fff, inner #0a0a0a / #dfdfdf; white inside
//   caption: 18px, gradient #000080 to #1084d0 (inactive #808080 to #b5b5b5), bold white, text left
//   caption buttons: 16x14, minimise and maximise touching, 2px gap, close; 2px from the frame's right
//   menus: face grey in a window frame, rows 20px (text) or 26px+ (start menu), highlight #000080
//   tabs: 18px, the open one 2px taller and 2px wider each side, joined to its page; corners 2px
//   scrollbar: 16px, track dither #fff/#c0c0c0, thumb and buttons raised, arrows 7x4
//   taskbar: 28px, a white line on top; Start button bold; app buttons 160px; tray sunken 1px
//   font: MS Sans Serif 8pt; Tahoma 11px stands in (the bitmap font can't be bundled)
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const ID = "chicago";
const T = (surface) => `html[data-sct-theme="${ID}"][data-sct-surface="${surface}"]`;
const P = T("shell");
// :not(#sct-chi) matches every page; its id weight lets hand-written rules beat Sitecore's own.
const W = (surface) => `${T(surface)}:not(#sct-chi)`;
const FONT = 'Tahoma, "Microsoft Sans Serif", Arial, sans-serif';
// Glyphs are shapes on a small grid, centred in whatever box they paint: triangles, bars and pixel maps.
// ico() writes each glyph into themes/chicago/glyphs twice, as a PNG and as an SVG. image-set() gives a
// 100% screen the PNG, kept exact by pixelate(); every other scale gets the SVG, drawn at the screen's
// resolution. The CSS names the files sct-ext:<path>, which background.js points at the extension's own
// URL, so a page CSP without data: in img-src (some installs send one) still loads them. Button bevels are bands along
// the box's own edges.
const HEX = { K: "#000", W: "#fff", G: "#808080", C: "#c0c0c0", D: "#dfdfdf", B: "#0a0a0a" };
const LETTER = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [v, k]));
// a w-wide triangle pointing down or up is (w + 1) / 2 tall; one pointing left or right the other way round
const tri = {
  down: (x, y, w, c = "#000") => ({ kind: "down", x, y, w, h: (w + 1) / 2, c }),
  up: (x, y, w, c = "#000") => ({ kind: "up", x, y, w, h: (w + 1) / 2, c }),
  left: (x, y, h, c = "#000") => ({ kind: "left", x, y, w: (h + 1) / 2, h, c }),
  right: (x, y, h, c = "#000") => ({ kind: "right", x, y, w: (h + 1) / 2, h, c }),
};
const bar = (x, y, w, h, c = "#000") => ({ kind: "bar", x, y, w, h, c });
// a pixel map for the PNG, with the intended shape as an SVG fragment (local coordinates) for other scales
const map = (x, y, rows, vec, c = "#000") => ({ kind: "map", x, y, w: rows[0].length, h: rows.length, rows, vec, c });
// 95's close glyph: two 2px diagonals, 8 by 7
const closeX = (x, y, c = "#000") => map(x, y, ["##....##", ".##..##.", "..####..", "...##...", "..####..", ".##..##.", "##....##"],
  `<path d="M0.6 0.5L7.4 6.5M7.4 0.5L0.6 6.5" stroke="${c}" stroke-width="1.7" fill="none"/>`, c);
// 95's check mark, 7 by 7
const tick = (x, y, c = "#000") => map(x, y, ["......#", ".....##", "#...###", "##.###.", "#####..", ".###...", "..#...."],
  `<path d="M0 2L2.5 4.6L7 0.1V2.6L2.5 7.1L0 4.6Z" fill="${c}"/>`, c);

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
        map: s.rows && s.rows[j][i] === "#",
      }[s.kind];
      if (on) set(s.x + i, s.y + j, s.c);
    }
  }
  return px.map((r) => r.join(""));
}
// The same shapes as vectors. A triangle's sides run through the middle of each pixel step, so it covers
// the same area as its pixels. Bars keep their edges on device pixels (crispEdges).
function vectorize(shapes) {
  return shapes.map(({ kind, x, y, w, h, c, vec }) => {
    const poly = (...p) => `<path d="M${p.join("L")}Z" fill="${c}"/>`;
    if (kind === "bar") return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" shape-rendering="crispEdges"/>`;
    if (kind === "down") return poly(`${x - 0.5} ${y}`, `${x + w + 0.5} ${y}`, `${x + w / 2} ${y + h}`);
    if (kind === "up") return poly(`${x - 0.5} ${y + h}`, `${x + w + 0.5} ${y + h}`, `${x + w / 2} ${y}`);
    if (kind === "left") return poly(`${x + w} ${y - 0.5}`, `${x + w} ${y + h + 0.5}`, `${x} ${y + h / 2}`);
    if (kind === "right") return poly(`${x} ${y - 0.5}`, `${x} ${y + h + 0.5}`, `${x + w} ${y + h / 2}`);
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="hidden">${vec}</svg>`;
  }).join("");
}
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
// One background layer: the glyph on a w x h canvas, centred unless placed otherwise. Both images get a
// transparent 1px margin: Chrome softens the edge of an image placed between device pixels.
function ico(shapes, { w = 16, h = 16, pos = "center" } = {}) {
  const rows = rasterize(shapes, w, h);
  const svg = vectorize(shapes);
  const name = crypto.createHash("sha1").update(rows.join("|") + svg).digest("hex").slice(0, 10);
  const pad = ".".repeat(w + 2);
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), png([pad, ...rows.map((r) => `.${r}.`), pad]));
  fs.writeFileSync(path.join(GLYPHS, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}">${svg}</svg>\n`);
  const url = (ext) => `url("sct-ext:themes/${ID}/glyphs/${name}.${ext}")`;
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
// At exactly 100% the glyphs' PNGs are drawn nearest-neighbour: every rule whose background draws one gets
// image-rendering: pixelated in one @media block. A zero-specificity reset keeps it off the children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*sct-ext:/.test(m[2]))
    .map((m) => m[1].trim());
  if (!sels.length) return text;
  const all = `:where(html[data-sct-theme="${ID}"] *)`;
  return `${text}
/* glyphs at exactly 100%: their PNGs, nearest-neighbour (see pixelate()) */
@media (resolution: 1dppx) {
  ${all}, ${all}::before, ${all}::after { image-rendering: auto; }
${sels.map((s) => `  ${s} { image-rendering: pixelated; }`).join("\n")}
}
`;
}
// A two-pixel bevel as background bands along the box's edges (for glyph buttons drawn as backgrounds:
// scrollbar buttons, caption buttons). o1/o2 outer top-left/bottom-right, i1/i2 inner.
const bands = (o1, o2, i1, i2, fill = "#c0c0c0") => [
  `linear-gradient(270deg, ${o2} 1px, transparent 0)`, `linear-gradient(0deg, ${o2} 1px, transparent 0)`,
  `linear-gradient(${o1} 1px, transparent 0)`, `linear-gradient(90deg, ${o1} 1px, transparent 0)`,
  `linear-gradient(270deg, transparent 1px, ${i2} 1px 2px, transparent 0)`, `linear-gradient(0deg, transparent 1px, ${i2} 1px 2px, transparent 0)`,
  `linear-gradient(transparent 1px, ${i1} 1px 2px, transparent 0)`, `linear-gradient(90deg, transparent 1px, ${i1} 1px 2px, transparent 0)`,
  `linear-gradient(${fill}, ${fill})`];
const upBands = bands("#fff", "#0a0a0a", "#dfdfdf", "#808080");
const downBands = bands("#0a0a0a", "#fff", "#808080", "#dfdfdf");
// a 16x16 raised button with a glyph (scrollbar and spin buttons)
const btn = (...glyph) => [ico(glyph), ...upBands].join(", ");
// pressed: the glyph one pixel right and down
const shift = (shapes) => shapes.map((s) => ({ ...s, x: s.x + 1, y: s.y + 1 }));
const btnDown = (...glyph) => [ico(shift(glyph)), ...downBands].join(", ");
// a 16x14 caption button
const cap = (...glyph) => [ico(glyph, { w: 16, h: 14 }), ...upBands].join(", ");
const capDown = (...glyph) => [ico(shift(glyph), { w: 16, h: 14 }), ...downBands].join(", ");
// Hides an <img>'s own picture so the painted background shows instead.
const paint = (g) => `object-fit: none; object-position: -999px -999px; background: ${g};`;

const GL = {
  up: [tri.up(4, 6, 7)],
  down: [tri.down(4, 6, 7)],
  left: [tri.left(6, 4, 7)],
  right: [tri.right(6, 4, 7)],
  min: [bar(4, 9, 6, 2)],
  max: [bar(3, 2, 9, 2), bar(3, 4, 1, 7), bar(11, 4, 1, 7), bar(3, 10, 9, 1)],
  restore: [bar(5, 1, 6, 2), bar(10, 3, 1, 4), bar(9, 6, 1, 1), bar(5, 3, 1, 1),
    bar(3, 4, 6, 2), bar(3, 6, 1, 4), bar(8, 6, 1, 4), bar(3, 9, 6, 1)],
  close: [closeX(4, 3)],
  // the page switcher: three lines, as a list
  switcher: [bar(4, 3, 8, 1), bar(4, 6, 8, 1), bar(4, 9, 8, 1)],
  dots: [bar(4, 8, 2, 2), bar(7, 8, 2, 2), bar(10, 8, 2, 2)],
};
const G = {
  up: btn(...GL.up), upDown: btnDown(...GL.up),
  down: btn(...GL.down), downDown: btnDown(...GL.down),
  left: btn(...GL.left), leftDown: btnDown(...GL.left),
  right: btn(...GL.right), rightDown: btnDown(...GL.right),
  dots: btn(...GL.dots),
  first: btn(bar(4, 4, 1, 7), tri.left(6, 4, 7)),
  last: btn(bar(10, 4, 1, 7), tri.right(5, 4, 7)),
  // caption buttons
  min: cap(...GL.min), minDown: capDown(...GL.min),
  max: cap(...GL.max), maxDown: capDown(...GL.max),
  restore: cap(...GL.restore), restoreDown: capDown(...GL.restore),
  close: cap(...GL.close), closeDown: capDown(...GL.close),
  switcher: cap(...GL.switcher), switcherDown: capDown(...GL.switcher),
  // a combo box's arrow button, 16 wide, the arrow centred
  combo: btn(tri.down(4, 6, 7)), comboDown: btnDown(tri.down(4, 6, 7)),
};
// the Launchpad button's glyph: nine black squares
const GRID = [0, 4, 8].flatMap((y) => [0, 4, 8].map((x) => bar(2 + x, 2 + y, 3, 3)));
G.grid = ico(GRID, { w: 15, h: 15 });
G.gridDown = ico(shift(GRID), { w: 15, h: 15 });
// The combo button inside the right end of a select's sunken frame: 1px in from the padding edge, as
// tall as the field's inner white.
const comboAt = "right 1px top 1px / 16px calc(100% - 2px) no-repeat";
const comboRight = [ico([tri.down(0, 0, 7)], { w: 7, h: 4, pos: "right 5px center" }),
  ...upBands.map((b) => `${b} ${comboAt}`)].join(", ");
// Bare glyphs (no button face) for drop-down arrows and submenu arrows.
const triDown = (c = "#000") => ico([tri.down(4, 6, 7, c)]);
const triRight = (c = "#000") => ico([tri.right(6, 4, 7, c)]);
const checked = (c = "#000") => ico([tick(0, 0, c)], { w: 7, h: 7, pos: "1px 1px" });

// ---- Bevels as CSS: 1px borders plus a 1px inset shadow, so every box keeps a 1px border's geometry ----
// a push button
const raised = "border: 1px solid; border-color: #fff #0a0a0a #0a0a0a #fff; box-shadow: inset 1px 1px #dfdfdf, inset -1px -1px #808080;";
// a push button held down
const sunken = "border: 1px solid; border-color: #0a0a0a #fff #fff #0a0a0a; box-shadow: inset 1px 1px #808080, inset -1px -1px #dfdfdf;";
// a window's frame (menus, dialogs, the start menu)
const frameWin = "border: 1px solid; border-color: #dfdfdf #0a0a0a #0a0a0a #dfdfdf; box-shadow: inset 1px 1px #fff, inset -1px -1px #808080;";
// a field's well
const well = "border: 1px solid; border-color: #808080 #fff #fff #808080; box-shadow: inset 1px 1px #0a0a0a, inset -1px -1px #dfdfdf;";
// a one-pixel sunken edge (status bar panes, the tray)
const thin = "border: 1px solid; border-color: #808080 #fff #fff #808080; box-shadow: none;";
// 98's flat toolbar buttons: a one-pixel raised edge under the mouse, sunken while pressed
const hot = "border: 1px solid; border-color: #fff #808080 #808080 #fff; box-shadow: none;";
const hotDown = "border: 1px solid; border-color: #808080 #fff #fff #808080; box-shadow: none;";
// the default push button: a black frame around the bevel
const defaultBtn = "border: 1px solid #0a0a0a; box-shadow: inset 1px 1px #fff, inset -1px -1px #0a0a0a, inset 2px 2px #dfdfdf, inset -2px -2px #808080;";
// the dither of a toggled taskbar button and the scrollbar track; at other scales a flat tone (a 2px
// checkerboard turns into moire between device pixels)
const DITHER = "repeating-conic-gradient(#fff 0 25%, #c0c0c0 0 50%) 0 0 / 2px 2px";
// 95's edit control: white in a sunken well
const edit = `background: #fff; color: #000; border-radius: 0; ${well}`;
const button = `background: #c0c0c0; color: #000; font: 11px ${FONT}; text-transform: none; text-shadow: none; border-radius: 0; ${raised}`;
// a property-sheet tab: raised, white and #dfdfdf on the left and top, dark on the right, open at the bottom
const tabFace = `background: #c0c0c0; color: #000; border: 1px solid; border-color: #fff #0a0a0a transparent #fff; border-bottom: 0; border-radius: 3px 3px 0 0; box-shadow: inset 1px 1px #dfdfdf, inset -1px 0 #808080; text-transform: none; text-shadow: none; font-family: ${FONT}; font-size: 11px;`;
// the caption gradient
const CAPTION = "linear-gradient(90deg, #000080, #1084d0)";
const CAPTION_OFF = "linear-gradient(90deg, #808080, #b5b5b5)";

// ---- Shared by every area: the global header is the active window's caption, the 98 gradient with bold
// white text. Its Launchpad button is a raised push button with the nine-square glyph, the portrait sits
// in a sunken well, and the account links stay white. ----
const header = (S, bar) => `${S}:not(#sct-chi) .sc-globalHeader {
  background: ${CAPTION} !important;
  border-bottom: 1px solid #0a0a0a;
  box-shadow: none;
  color: #fff;
  font-family: ${FONT};
}
${S}:not(#sct-chi) .sc-globalHeader :is(span, a, li, .sc-globalheader-appName),
${S}:not(#sct-chi) .sc-globalHeader .sc-accountInformation li::after {
  color: #fff;
  font-family: ${FONT};
  font-size: 11px;
  font-weight: bold;
}
${S}:not(#sct-chi) .sc-globalHeader a.sc-global-logo,
${S}:not(#sct-chi) .sc-globalHeader a.sc-global-logo:hover {
  box-sizing: border-box;
  width: 28px;
  height: 26px;
  margin-top: 12px;
  border-radius: 0;
  /* the token layer cuts 10.5's glyph out of the header colour with a mask */
  mask: none;
  background: ${G.grid}, #c0c0c0;
  ${raised}
}
${S}:not(#sct-chi) .sc-globalHeader a.sc-global-logo:active { background: ${G.gridDown}, #c0c0c0; ${sunken} }
${S}:not(#sct-chi) .sc-globalHeader a.sc-global-logo:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
/* every item centred on the bar: the account list is a row of flex items centred on its own height */
${S}:not(#sct-chi) .sc-globalHeader ul.sc-accountInformation {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  /* the bar's height above its 1px bottom border: 50px in the shell, 49px on SPEAK pages, 47px on
     the Launchpad */
  height: ${bar}px;
}
${S}:not(#sct-chi) .sc-globalHeader ul.sc-accountInformation > li {
  display: flex;
  align-items: center;
  line-height: normal;
}
${S}:not(#sct-chi) .sc-globalHeader .sc-ext-dbName {
  align-self: center;
  margin-top: 0;
  margin-bottom: 0;
  color: #fff;
  font: bold 11px ${FONT};
  line-height: normal;
  vertical-align: middle;
}
${S}:not(#sct-chi) .sc-globalHeader .sc-accountInformation img {
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  padding: 2px;
  border-radius: 0;
  background: #c0c0c0;
  ${well}
}`;

// ---- Shell: details 10.x's markup and inline styles need ----
const shellHand = `${W("shell")} {
  /* ---- Desktop search box: a sunken edit field in the tray ---- */
  #SearchBox {
    box-sizing: border-box;
    height: 20px;
    min-height: 0;
    margin: 0 4px 0 0;
    padding: 1px 4px;
    ${edit}
    font: 11px ${FONT};
  }
  #SearchBox::placeholder { color: #595959; }
  .scStartbarTray td { vertical-align: middle; }

  /* ---- Menus (context menus, start menu fly-outs, drop-downs): 95's popup menu, face grey inside a
     window frame, the highlighted row navy, separators etched, disabled rows embossed. ---- */
  .scPopup:not(:has(> .scStartMenu)) {
    padding: 2px;
    border-radius: 0;
    background: #c0c0c0;
    ${frameWin}
  }
  .scPopup:has(> .scStartMenu) {
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }
  .scMenu {
    border: 0;
    border-collapse: collapse;
    border-radius: 0;
    box-shadow: none;
    background: #c0c0c0;
    color: #000;
  }
  .scMenu tr > td:is([class^="scMenuItem"], [class^="scMenuPanelItem"]) {
    height: 20px;
    padding-top: 0;
    padding-bottom: 0;
    border: 0;
    background: #c0c0c0;
    color: #000;
    font: 11px ${FONT};
    line-height: 20px;
  }
  .scMenu td[class^="scMenuItemIcon"] {
    width: 18px;
    padding: 0 2px 0 4px;
  }
  .scMenu td[class^="scMenuItemCaption"] { padding: 0 8px 0 4px; }
  .scMenu td[class^="scMenuItemHotkey"] { padding: 0 4px; }
  .scMenu tr > td[class^="scMenuItem"][class$="_Disabled"] { color: #808080; text-shadow: 1px 1px #fff; }
  .scMenu td[class$="_Disabled"] img { opacity: 0.5; }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td,
  .scMenu tr > td[class$="_Hover"] {
    background: #000080;
    color: #fff;
  }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td * { color: #fff; }
  /* separators: an etched line, grey over white */
  .scMenu tr > td[class^="scMenuDivider"] {
    height: 8px;
    padding: 0;
    border: 0;
    background: linear-gradient(transparent 3px, #808080 3px 4px, #fff 4px 5px, transparent 5px) 1px 0 / calc(100% - 2px) 100% no-repeat, #c0c0c0;
  }
  /* keyboard: the focused row is the highlighted one, not 10.x's purple ring */
  .scMenu tr:focus { outline: none; }
  .scMenu tr:focus-visible > td { background: #000080; color: #fff; }
  .scMenu img[src*="Submenu16x16" i] { ${paint(triRight())} }
  .scMenu tr:hover img[src*="Submenu16x16" i] { background: ${triRight("#fff")}; }

  /* ---- Content tree search: a grey strip, a square edit field and two bevelled buttons of its
     height (fixed border-box heights keep their edges level at any zoom) ---- */
  #SearchPanel {
    margin: 0;
    padding: 3px 4px;
    background: #c0c0c0;
    border-bottom: 0;
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
    font: 11px ${FONT};
  }
  :is(a.scSearchButton, a.scSearchOptionsButton) {
    display: block;
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    margin: 0 0 0 2px;
    padding: 0;
    background: #c0c0c0;
    border-radius: 0;
    ${raised}
  }
  :is(a.scSearchButton, a.scSearchOptionsButton):active { ${sunken} }
  :is(a.scSearchButton, a.scSearchOptionsButton):active img { transform: translate(1px, 1px); }
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
    font: 11px ${FONT};
  }
  #TreeSearchOptions img.arrowDown { ${paint(triDown())} }
  #TreeSearchOptions input.scSearchOptionsInput {
    box-sizing: border-box;
    width: 100%;
    height: 22px;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 11px ${FONT};
  }

  /* ---- The language, version and navigator drop-downs above the editor: 95 combo boxes, a sunken
     white field with the arrow button inside its right end ---- */
  .scEditorTabControls a.scEditorHeaderButton {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 22px;
    min-width: 0;
    margin: 0 0 0 4px;
    padding: 0 0 0 4px;
    ${edit}
    font: 11px ${FONT};
    line-height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton span {
    display: inline-flex;
    align-items: center;
    height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton img:not([class*="Glyph"]) { margin: 0 2px 0 0; }
  .scEditorTabControls :is(.scEditorHeaderNavigatorGlyph, .scEditorHeaderVersionsLanguageGlyph, .scEditorHeaderVersionsVersionGlyph) {
    width: 16px;
    height: 18px;
    margin: 0 1px 0 4px;
    padding: 0;
    border: 0;
    ${paint(G.combo)}
  }

  /* ---- The chunk's rows sit inside its 1px outline and 2px bevel, as the Experience Editor's do: a 1px
     gap, the 46px panel, a 1px gap, the 18px caption. A raised or pressed button never reaches the
     bevel or covers the caption. 10.4's stock panel padding (10px 8px) would push the buttons over the
     caption. Both versions get the same compact strip: 4px panel sides (10.5's 16px left the groups
     loose) and 3px above and below the chunks instead of Ribbon.css's 12px and 80px minimum. ---- */
  .scRibbonToolbar :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip) {
    min-height: 0;
    padding: 3px 0;
  }
  /* Sitecore shows a strip with an inline display, so contain the floated chunks without one */
  .scRibbonToolbar :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip)::after {
    content: "";
    display: block;
    clear: both;
  }
  .scRibbonToolbar .chunk { padding-bottom: 2px; }
  .scRibbonToolbar .chunk > .panel {
    box-sizing: border-box;
    height: 46px;
    margin-top: 3px;
    padding: 0 4px;
  }
  .scRibbonToolbar .chunk > .caption {
    height: 18px;
    margin-top: 1px;
    line-height: 18px;
  }
  .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) {
    box-sizing: border-box;
    height: 46px;
    padding: 2px 5px 1px;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) {
    box-sizing: border-box;
    height: 46px;
    padding: 0;
  }
  /* the two faces split the 44px inside the button's 1px frame exactly, the icon level with the plain
     buttons' icons; with auto heights the drop-down ran into the caption */
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonTopDisabled) {
    box-sizing: border-box;
    height: 27px;
    padding: 1px 5px 0;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonBottom, .scRibbonToolbarLargeComboButtonBottomDisabled) {
    box-sizing: border-box;
    height: 17px;
    padding: 0 5px;
    line-height: 15px;
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
    padding: 2px 5px 0;
  }
  /* the gallery (Insert, Presets): its list box and scroll buttons inside the panel */
  .scRibbonToolbar .scRibbonGallery {
    box-sizing: border-box;
    height: 46px;
    padding: 1px 5px 0;
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
  /* Versions > Translate: Ribbon.css pads the Compare row 8px below (!important), which pushed the two
     drop-downs through the caption; the two rows fit the 46px panel */
  .scRibbonToolbar .scRibbonTranslatePanel { padding: 0 5px; }
  .scRibbonToolbar .scRibbonTranslatePanelRow { padding: 0; }
  .scRibbonToolbar .scRibbonTranslatePanel table td { padding-top: 1px; padding-bottom: 0; }
  .scRibbonToolbar td.scRibbonTranslatePanelCompare { padding-bottom: 0 !important; }
  .scRibbonToolbar .scRibbonTranslatePanel select { box-sizing: border-box; height: 21px; padding-top: 0; padding-bottom: 0; }
  /* Review > Workflow: the state text's well ran 4px past the panel and made its group taller */
  .scRibbonToolbar .scRibbonToolbarText { box-sizing: border-box; height: 44px; margin-top: 1px; overflow: hidden; }

  /* ---- Tabs, all of them (dialog and application tab strips, the ISE's script tabs, Read-Variable's
     pages, the editor tabs): 95's property-sheet tabs. The selected tab is 3px taller and stands over
     its page's top edge so the two join; the others sit lower. 95 had no hover look, so the *_Hover
     classes Sitecore swaps in under the mouse look like the resting ones; keyboard focus is the dotted
     frame. ---- */
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
    line-height: 22px;
  }
  /* over a page, the open tab also covers the white line inside the page's black top edge, so its face runs
     on into the page as one surface (the strip aligns tabs to its bottom, so the extra pixel comes from top) */
  .scTabstripContainer:has(> .scTabs) > .scTabstrip :is(.scTabActive, .scTabActive_Hover) { top: 2px; height: 25px; box-shadow: inset 1px 1px #dfdfdf, inset -1px 0 #808080, 0 2px 0 -1px #c0c0c0; }
  /* (the last shadow: at a fractional zoom the tab stands only part of a device pixel over the page's white line,
     which showed as a faint line under it; a pixel of the face below the tab, inside its side borders, covers it) */
  /* the ISE's script tabs have no page under them: the strip draws the line the open tab stands on, from the
     first tab on (SPE's 52px reserve holds the script tree and variables toggles, with no line under them) */
  #TabsPanel .scTabstrip { background-image: linear-gradient(#fff 0 0); background-position: 52px 100%; background-size: 100% 1px; background-repeat: no-repeat; }
  /* the strip stands on 95's grey face, as a property sheet's tabs do, not on the white the colour map gives the
     script pane (the editor below keeps its own white) */
  :is(#ScriptPane, table.scScrollbox:has(#ScriptPane)) { background-color: #c0c0c0; }
  /* SPE pulls a script tab's close X 10px into the tab's 20px right padding; with these 10px it touched the edge */
  .scTabstrip .closeTab { margin: 0 -3px 0 6px; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus { outline: none; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  /* the page: grey and raised, white and #dfdfdf on the left and top, dark on the right and bottom */
  .scTabs {
    box-sizing: border-box;
    background: #c0c0c0;
    ${raised}
  }
  /* Sitecore sets the open tab 1px left (left: -1px) over its neighbours: the page starts there too, so an open
     first tab's black edge and white highlight run straight on down the page's left side */
  .scTabstripContainer > .scTabs { left: -1px; }
  /* the page inside keeps its 1px border, as layout, but unpainted: Sitecore's grey line covered the frame's
     white edge */
  .scTabs > .scTabPage { background: transparent; border-color: transparent; }
  /* list boxes on a page (item trees, lists) stay white */
  .scTabs .scScrollbox { ${edit} }

  /* the Content Editor's editor tabs stand on the tab row's white line, the editor's raised top edge */
  #EditorTabs {
    height: 57px;
    border-bottom: 1px solid #fff;
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
  #EditorTabs > a.scRibbonEditorTabNormal:hover { background: #c0c0c0; }
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
  .scEditorTabHeaderActive { line-height: 23px; }

  /* jQuery UI tab strips */
  .ui-tabs .ui-tabs-nav {
    display: flex;
    align-items: flex-end;
    padding: 0 2px;
    border: 0;
    border-bottom: 1px solid #fff;
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
  .ui-tabs .ui-tabs-nav li.ui-state-hover:not(.ui-tabs-active) { background: #c0c0c0; }
  .ui-tabs .ui-tabs-nav li a {
    padding: 0 10px;
    color: #000;
    line-height: 20px;
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active a { line-height: 23px; }
  .ui-tabs .ui-tabs-panel { background: #c0c0c0; }

  /* the ribbon group's launcher (the small arrow in its caption): black, as 95's glyphs */
  .scRibbonChunkEndLink img.glyph { filter: brightness(0); }
  /* the ISE's tip of the day: a 95 tooltip */
  .ui-state-highlight { border: 1px solid #000; border-radius: 0; background: #ffffe1; color: #000; }
  .ui-state-highlight :is(p, b, span, strong) { color: #000; }
  /* tooltips drawn as markup (SPE's qTip, jQuery UI): Windows' pale yellow tip in a black frame */
  :is(.qtip, .ui-tooltip) {
    border: 1px solid #000;
    border-radius: 0;
    box-shadow: none;
    background: #ffffe1;
    color: #000;
    font: 11px ${FONT};
  }
  :is(.qtip, .ui-tooltip) * { color: #000; }

  /* ---- Start menu: 95's. One column of rows beside the side banner (drawn by #StartMenu::before), the
     left list, then the right, then All Applications as the Programs row; folders open fly-outs. ---- */
  .scStartMenuContent {
    display: block;
    box-sizing: border-box;
    height: auto;
    padding: 0;
    background: transparent;
  }
  :is(.scStartMenuContentColumns, .scStartMenuContentColumns > tbody, .scStartMenuContentColumns > tbody > tr) { display: contents; }
  :is(.scStartMenuLeft, .scStartMenuRight, .scStartMenuPrograms) {
    display: block;
    width: auto;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }
  /* rows: a 24px icon and the name; the description stays a tooltip (title) */
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu) {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    height: 30px;
    min-height: 0;
    margin: 0;
    padding: 0 6px 0 6px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    color: #000;
    text-decoration: none;
  }
  :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) {
    float: none;
    flex: none;
    width: 24px;
    height: 24px;
    margin: 0;
  }
  .scStartMenuLeftOptionDescription {
    display: block;
    flex: 1;
    min-width: 0;
  }
  :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) {
    padding: 0;
    color: #000;
    font: 11px / 15px ${FONT};
    white-space: nowrap;
  }
  .scStartMenuLeftOptionTooltip { display: none; }
  .scStartMenuRightFolderDisplayName { flex: 1; }
  /* the folders open fly-outs: 95's black arrow at the row's end */
  img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) {
    float: none;
    flex: none;
    order: 9;
    width: 16px;
    height: 16px;
    margin: 0;
    ${paint(triRight())}
  }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu):is(:hover, :focus-visible, .scPopupOpener) { background: #000080; outline: none; }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, a.scStartMenuProgramsMenu):is(:hover, :focus-visible, .scPopupOpener) :is(div, span) { color: #fff !important; }
  :is(.scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, :focus-visible, .scPopupOpener) img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) { background: ${triRight("#fff")}; }
  /* separators: etched */
  .scStartMenuDivider {
    height: 0;
    margin: 3px 2px;
    border-top: 1px solid #808080;
    border-bottom: 1px solid #fff;
    background: none;
  }
  .scStartMenuPrograms .scStartMenuDivider { display: block; }
  /* All Applications: the Programs row, a menu row with its arrow */
  a.scStartMenuProgramsMenu { padding-left: 38px; }
  .scStartMenuProgramsMenu .scStartMenuProgramsMenuText {
    flex: 1;
    padding: 0;
    color: #000;
    font: 11px ${FONT};
  }
  /* 10.4 still has the user band at the top and Log off at the bottom: menu rows too */
  :is(.scStartMenuTop, .scStartMenuBottom) {
    background: #c0c0c0;
    color: #000;
  }
  :is(.scStartMenuTop, .scStartMenuBottom) * { color: #000; font-family: ${FONT}; }

  /* ---- Fields on tab pages (SPE Read-Variable and other tabbed dialogs): 95's edit controls ---- */
  .scTabs :is(input:not([type]), input[type="text"], input[type="password"], input[type="number"], input[type="search"], select:not([multiple]):not([size]:not([size="1"]))) {
    box-sizing: border-box;
    height: 24px;
    min-height: 0;
    padding: 2px 4px;
    font: 11px ${FONT};
  }
  .scTabs select:not([multiple]):not([size]:not([size="1"])) { padding-right: 22px; }
  /* check lists, multilists and their trees are list boxes; radio groups 95's etched group box */
  :is(.scContentControlChecklist, .scContentControlMultilistBox, .scBucketListBox, .scBucketListSelectedBox, .scContentControlTree.scScrollbox, .varRule) {
    ${edit}
  }
  .scContentControlChecklist label,
  .scRadioGroup label { font: 11px ${FONT}; color: #000; }
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
    width: 16px;
    height: 16px;
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
  :is(:is(img.scNavButton, img[id^="btnRight"])[id*="right" i], img[id^="btnRight"]):active { background: ${G.rightDown}; }
  :is(:is(img.scNavButton, img[id^="btnLeft"])[id*="left" i], img[id^="btnLeft"]):active { background: ${G.leftDown}; }
  :is(img.scNavButton[id*="_up"], img[id^="btnUp"]):active { background: ${G.upDown}; }
  :is(img.scNavButton[id*="_down"], img[id^="btnDown"]):active { background: ${G.downDown}; }
  .scMultilistNav a.hovertext { color: #000; }
  /* combo tables (date and time pickers, item pickers): one sunken well around the field and its button */
  table.scCombobox {
    box-sizing: border-box;
    height: auto;
    min-height: 0;
    padding: 1px;
    border-collapse: separate;
    border-spacing: 0;
    background: #fff;
    ${well}
    border-radius: 0;
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
    /* the dialog field rule sets 24px with !important; inside the combo's well it is 20px */
    height: 20px !important;
    margin: 0;
    padding: 2px 4px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
    font: 11px ${FONT};
  }
  table.scCombobox img.scComboboxDropDown {
    display: block;
    box-sizing: border-box;
    width: 16px;
    height: 20px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    ${paint(G.combo)}
  }
  table.scCombobox img.scComboboxDropDown:active { background: ${G.comboDown}; }
  /* the date picker's calendar: a navy caption with the month between two arrow buttons, the chosen day
     navy as a selection, the other months' days grey */
  table.scCalendar {
    margin: 0;
    border-collapse: collapse;
    color: #000;
    font: 11px ${FONT};
  }
  table.scCalendar td {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    color: #000;
    font: 11px ${FONT};
    text-transform: none;
  }
  table.scCalendar .scCalendarYearRow td {
    height: 22px;
    padding: 0 2px;
    background: ${CAPTION};
    color: #fff;
    font-weight: bold;
  }
  .scCalendarYearRow img {
    width: 16px;
    height: 16px;
    vertical-align: middle;
  }
  .scCalendarYearLeftCell img { ${paint(G.left)} }
  .scCalendarYearRightCell img { ${paint(G.right)} }
  table.scCalendar td.scCalendarDay {
    border-bottom: 1px solid #808080;
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
    border-top: 1px solid #808080;
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
    font: 11px ${FONT};
    text-decoration: none;
  }
  ul.scTimePicker a:is(:hover, :focus, .selected, [aria-selected="true"]) {
    background: #000080;
    color: #fff;
  }

  /* the user and role pickers: a read-only grey field and its ... button at the field's height */
  input.scUserPickerEdit {
    ${well}
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

  /* ---- Drop-down galleries (Edit's workflow box...) open in a frame: a menu's window frame ---- */
  iframe.scGalleryFrame {
    border-radius: 0;
    ${frameWin}
  }

  /* ---- Desktop windows are bare frames in 10.x: one that isn't maximised gets 95's window frame, the
     two-pixel bevel and a pixel of face grey ---- */
  .DesktopArea > iframe[id^="FRAME"]:not([style*="width: 100%"]) {
    box-sizing: border-box;
    padding: 2px;
    background: #c0c0c0;
    ${frameWin}
  }

  /* ---- Taskbar: running applications are 95's fixed-width task buttons, the active one held down over
     the dither, its title bold ---- */
  #StartbarApplications { height: 22px; border-spacing: 3px 0; }
  :is(.scActiveApplication, .scInactiveApplication) {
    box-sizing: border-box;
    width: 160px;
    min-width: 0;
    max-width: 160px;
    height: 22px;
    padding: 0 4px;
    overflow: hidden;
    border-radius: 0;
    background: #c0c0c0;
    color: #000;
    text-align: left;
    white-space: nowrap;
    ${raised}
  }
  .scActiveApplication { background: #dfdfdf; ${sunken} }
  /* 10.x draws separators between the buttons */
  :is(.scActiveApplication, .scInactiveApplication)::before,
  :is(.scActiveApplication, .scInactiveApplication)::after { content: none; display: none; }
  :is(.scActiveApplication, .scInactiveApplication) * {
    color: #000;
    font: 11px / 20px ${FONT};
  }
  .scActiveApplication * { font-weight: bold; }
  .scActiveApplication .scStartBarApplication { position: relative; top: 1px; left: 1px; }
  :is(.scActiveApplication, .scInactiveApplication) img { width: 16px; height: 16px; vertical-align: -4px; }

  /* ---- Bucket search (search tab, Media Library): a sunken edit field with raised button ends, the
     search terms as framed tokens ---- */
  .search-box {
    min-height: 0;
    ${edit}
  }
  /* one frame per field: the text input inside the box draws none of its own */
  .search-box :is(input:not([type="checkbox"]):not([type="radio"]), .scSearchInput) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    outline: none;
  }
  :is(.sb_down, .sb_up),
  :is(.sb_down, .sb_up):hover {
    border-radius: 0;
    background-color: #c0c0c0;
    ${raised}
  }
  .btn-search,
  .btn-search:is(:hover, :active) {
    border-radius: 0;
    background-color: #c0c0c0;
    background-image: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png");
    ${raised}
  }
  .btn-search:active { ${sunken} }
  .filters .filter {
    border: 1px solid #808080;
    border-radius: 0;
    background: #fff;
    color: #000;
  }
  .filters .filter :is(.icon, .remove):hover { border-radius: 0; background-color: #c0c0c0; }
  :is(.side .sb_filter, #results table th) { text-transform: none; }

  /* ---- Ribbon drop-down arrows: 95's solid black triangle ---- */
  .scRibbon :is(.scRibbonToolbarLargeComboButtonGlyph, .scRibbonToolbarLargeGalleryButtonGlyph, .scRibbonToolbarSmallGalleryButtonGlyph, .scRibbonToolbarSmallComboButtonGlyph) {
    width: 12px;
    height: 12px;
    border: 0;
    vertical-align: middle;
    ${paint(triDown())}
  }
  .scRibbon [class*="Disabled"] :is([class*="ComboButtonGlyph"], [class*="GalleryButtonGlyph"]) { background: ${triDown("#808080")}; }

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

  /* ---- Push buttons in dialogs: 95's 23px buttons; the default button has the black frame ---- */
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
    border-color: #fff #0a0a0a #0a0a0a #fff;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:is(.scButtonPrimary, :focus-visible),
  .scFormDialogFooter button:is(.scButtonPrimary, :focus-visible) { ${defaultBtn} }
  :is(button, input[type="button"], input[type="submit"]).scButton:focus-visible,
  .scFormDialogFooter button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
  :is(button, input[type="button"], input[type="submit"]).scButton:active,
  .scFormDialogFooter button:active {
    border: 1px solid #0a0a0a;
    box-shadow: inset 1px 1px #808080, inset -1px -1px #808080;
  }
  :is(button, input[type="button"], input[type="submit"]).scButton:disabled { color: #808080; text-shadow: 1px 1px #fff; }
  /* ---- Dialog insets: controls close to the frame, as 95's (and Copenhagen's) were, not 10.x's 28px in;
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
    border-radius: 0;
    ${well}
  }

  /* ---- Drop-down lists: 95's combo box, the arrow button inside the well's right end ---- */
  select:not([multiple]):not([size]:not([size="1"])) {
    appearance: none;
    padding-right: 22px;
    ${edit}
    background: ${comboRight}, #fff;
  }

  /* ---- SPEAK-style application headers on shell pages (SPE Reports): the window's caption ---- */
  .sc-applicationHeader { height: auto; min-height: 0; border: 0; box-shadow: none; background: #c0c0c0; }
  .sc-applicationHeader-row1 {
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    background: ${CAPTION};
  }
  .sc-applicationHeader-row1 .sc-applicationHeader-content { height: 18px; min-height: 0; padding: 0 4px; }
  .sc-applicationHeader-title,
  .sc-applicationHeader-title .sc-text {
    float: none;
    height: 18px;
    margin: 0;
    padding: 0;
    color: #fff;
    font: bold 11px / 18px ${FONT};
  }
  /* ---- Window edges and docks the token layer paints in the chrome colour: face grey ---- */
  :is(.scWindowBorder3, .scDockBottomContainer) { background: #c0c0c0; }
  /* ISE's unsaved-script dot, darkened from Sitecore's red so it reads on the grey tab */
  .scTabstrip .scriptModified { color: #a00000; }
  /* ---- Workbox (10.4): the workflow header a caption, each state's bar a raised grey band, the commands
     push buttons ---- */
  :is(table.scWorkBoxMainHeader, td.scGrayGradient, .scGrayGradientLightShadow) { background: ${CAPTION}; }
  td:is(.scSectionCenter, .scSectionRight) {
    border-top: 1px solid #fff;
    border-bottom: 1px solid #808080;
    background: #c0c0c0;
    color: #000;
  }
  .scWorkboxToolbarButtons span.scRollover {
    border-radius: 0;
    background: #c0c0c0;
    color: #000;
    ${raised}
  }
  .scWorkboxToolbarButtons span.scRollover:active { ${sunken} }
  /* ---- The Workbox's caption band is a menu bar, like the Content Editor's; a
     Desktop window's is its title bar instead ---- */
  .scWorkboxWindowCaption:not([data-sct-window-title] *) {
    background: #c0c0c0;
    border-bottom: 1px solid #808080;
    box-shadow: 0 1px #fff;
  }

  /* ---- Grids (User Manager, Role Manager...): a list box under raised column headings, the selected
     row navy ---- */
  .Grid {
    ${well}
    background: #fff;
  }
  .HeadingCell {
    padding: 2px 6px;
    background: #c0c0c0;
    color: #000;
    font-weight: normal;
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
    width: 16px;
    height: 16px;
    padding: 0;
  }
  .GridFooter img[src*="/grid/pager/first"] { ${paint(G.first)} }
  .GridFooter img[src*="/grid/pager/prev"] { ${paint(G.left)} }
  .GridFooter img[src*="/grid/pager/next"] { ${paint(G.right)} }
  .GridFooter img[src*="/grid/pager/last"] { ${paint(G.last)} }
  .GridFooter.scGridFooter img:active { width: 16px; height: 16px; padding: 0; }

  /* ---- Fields in dialogs: edit controls of 95's height ---- */
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) :is(input:not([type]), input[type="text"], input[type="password"], input[type="search"], input[type="number"], select:not([multiple]):not([size])) {
    box-sizing: border-box;
    height: 24px !important;
    min-height: 0;
    padding: 2px 4px;
    ${edit}
    font: 11px ${FONT};
  }
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) textarea {
    ${edit}
    font: 11px ${FONT};
  }
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) select:not([multiple]):not([size]) { background: ${comboRight}, #fff; }
}`;

// ---- Check boxes and radio buttons, everywhere: 95's sunken white square with its check mark, and the
// sunken round well with a black dot. Focus is a dotted frame, as 95 drew it around the label. ----
const checks = (S) => `${S}:not(#sct-chi) :is(input[type="checkbox"], input[type="radio"]) {
  appearance: none;
  flex: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  padding: 0;
  border-radius: 0;
  outline: none;
  background: #fff;
  vertical-align: -2px;
  ${well}
}
${S}:not(#sct-chi) input[type="radio"] { width: 12px; height: 12px; border-radius: 50%; }
${S}:not(#sct-chi) input[type="checkbox"]:checked { background: ${checked()}, #fff; }
${S}:not(#sct-chi) input[type="radio"]:checked { background: radial-gradient(circle, #000 0 2px, transparent 2.5px), #fff; }
${S}:not(#sct-chi) :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px dotted #000; outline-offset: 1px; }
${S}:not(#sct-chi) :is(input[type="checkbox"], input[type="radio"]):disabled { background-color: #c0c0c0; opacity: 1; }
${S}:not(#sct-chi) input[type="checkbox"]:checked:disabled { background: ${checked("#808080")}, #c0c0c0; }`;

// ---- 95's scrollbar: 16px, raised thumb and arrow buttons, the track dithered (a flat light grey at
// other scales, where a 2px checkerboard turns into moire) ----
const scrollbars = (S) => `${S} { scrollbar-color: auto; }
${S} ::-webkit-scrollbar, ${S} :is(select, textarea)::-webkit-scrollbar { width: 16px; height: 16px; background: #dfdfdf; }
${S} ::-webkit-scrollbar-track { background: transparent; border-radius: 0; box-shadow: none; }
${S} ::-webkit-scrollbar-corner { background: #c0c0c0; }
${S} ::-webkit-scrollbar-thumb, ${S} :is(select, textarea)::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 0; min-height: 8px; ${raised} }
${S} ::-webkit-scrollbar-button:single-button { display: block; width: 16px; height: 16px; }
${S} ::-webkit-scrollbar-button:vertical:decrement { background: ${G.up}; }
${S} ::-webkit-scrollbar-button:vertical:increment { background: ${G.down}; }
${S} ::-webkit-scrollbar-button:horizontal:decrement { background: ${G.left}; }
${S} ::-webkit-scrollbar-button:horizontal:increment { background: ${G.right}; }
${S} ::-webkit-scrollbar-button:vertical:decrement:active { background: ${G.upDown}; }
${S} ::-webkit-scrollbar-button:vertical:increment:active { background: ${G.downDown}; }
${S} ::-webkit-scrollbar-button:horizontal:decrement:active { background: ${G.leftDown}; }
${S} ::-webkit-scrollbar-button:horizontal:increment:active { background: ${G.rightDown}; }
@media (resolution: 1dppx) {
  ${S} ::-webkit-scrollbar, ${S} :is(select, textarea)::-webkit-scrollbar { background: ${DITHER}; }
}`;

// ---- SPEAK and Launchpad: fonts, push buttons, check boxes ----
const speakCommon = (S) => `${S} body, ${S} input, ${S} button, ${S} select, ${S} textarea,
${S} :is(h1, h2, h3, h4, h5, h6, p, a, span, label, li, td, th, div) {
  font-family: ${FONT};
}
${scrollbars(S)}
${header(S, S.includes('launchpad') ? 47 : 49)}
/* push buttons: 95's, the default one in a black frame */
${S}:not(#sct-chi) .btn.sc-button {
  box-sizing: border-box;
  min-width: 75px;
  height: 24px;
  margin: 0;
  padding: 0 10px;
  ${button}
  line-height: 20px;
}
${S}:not(#sct-chi) .btn.sc-button:is(:hover, :focus) { background: #c0c0c0; color: #000; border-color: #fff #0a0a0a #0a0a0a #fff; }
${S}:not(#sct-chi) .btn.sc-button:is(.btn-primary, :focus-visible) { ${defaultBtn} }
${S}:not(#sct-chi) .btn.sc-button:active { border: 1px solid #0a0a0a; box-shadow: inset 1px 1px #808080, inset -1px -1px #808080; }
${S}:not(#sct-chi) .btn.sc-button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${S}:not(#sct-chi) .btn.sc-button:is(:disabled, .disabled) { color: #808080; text-shadow: 1px 1px #fff; opacity: 1; }
${S}:not(#sct-chi) .btn.sc-button .sc-button-text { color: inherit; font: inherit; }
${checks(S)}`;

// ---- SPEAK pages ----
const S = T("speak");
const speak = `/* Chicago: SPEAK pages. Generated by tools/build-chicago-css.cjs. */
${speakCommon(S)}

/* ---- Experience Editor ribbon: dressed as the Content Editor's ribbon in this theme. The tabs are
   property-sheet tabs over the toolbar, which is their page; the groups are split by etched lines and
   the buttons are flat until the mouse is over them, as in 98's toolbars. ---- */
${W("speak")} .sc-pageeditbar {
  font: 11px ${FONT};
  color: #000;

  .sc-quickbar {
    display: flow-root;
    height: auto;
    padding: 0 4px;
    overflow: visible;
    border: 0;
    box-shadow: none;
    background: #c0c0c0;
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
    font: 11px ${FONT};
    line-height: 30px;
    text-transform: none;
    text-decoration: none;
    cursor: default;
  }
  .sc-quickbar-item:focus { outline: none; }
  .sc-quickbar-item:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  /* tabs stand on the toolbar's white top edge; the open one is taller and covers it */
  .sc-quickbar-tab,
  .sc-quickbar-tab:hover {
    position: relative;
    top: 1px;
    height: 21px;
    margin: 9px 0 0;
    padding: 0 12px;
    ${tabFace}
    line-height: 19px;
  }
  .sc-quickbar-tab.sc-quickbar-tab-selected {
    z-index: 2;
    height: 24px;
    margin: 6px -2px 0;
    padding: 0 14px;
    line-height: 21px;
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
    border-radius: 0;
    background: #c0c0c0;
    ${hot}
  }
  .sc-quickbar-button:not(.disabled):active { ${hotDown} }
  .sc-quickbar-button.disabled > * { opacity: 0.45; }

  .sc-ribbon {
    margin: 0;
    padding: 0;
    border: 0;
    border-top: 1px solid #fff;
    border-bottom: 1px solid #808080;
    box-shadow: 0 1px #fff;
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
    padding: 0 4px;
    background: #c0c0c0;
    white-space: nowrap;
    border: 1px solid transparent;
    border-right-color: #808080;
    border-radius: 0;
    box-shadow: 1px 0 #fff;
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
    font: 11px ${FONT};
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
    padding: 2px 5px 1px;
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
    font: 11px ${FONT};
    line-height: 14px;
    text-transform: none;
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover {
    background: #c0c0c0;
    ${hot}
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active {
    background: #c0c0c0;
    ${hotDown}
  }
  /* a button that is switched on: sunken over the dither, as 98's toggled toolbar buttons */
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed {
    background: #dfdfdf;
    ${hotDown}
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
    font: 11px ${FONT};
    line-height: 15px;
  }
  /* drop-down buttons end in 95's solid arrow */
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
    width: 16px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
  }
  a.sc-chunk-datepanel-changedate[data-sc-adddays^="-"] { background: ${G.left}; }
  a.sc-chunk-datepanel-changedate:not([data-sc-adddays^="-"]) { background: ${G.right}; }
  a.sc-chunk-datepanel-changedate[data-sc-adddays^="-"]:active { background: ${G.leftDown}; }
  a.sc-chunk-datepanel-changedate:not([data-sc-adddays^="-"]):active { background: ${G.rightDown}; }
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
    font: 11px ${FONT};
    line-height: 1.1;
    text-decoration: none;
  }
  .sc-chunk-datepanel-selector * {
    height: auto;
    margin: 0;
    padding: 0;
    color: #000;
    font: 11px ${FONT};
    line-height: 1.15;
  }
  .sc-chunk-datepanel-selector:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
  .sc-chunk-datepanel-day { display: none; }
  .sc-chunk-datepanel-date { font: bold 16px ${FONT}; }
  .sc-chunk-datepanel-monthyear { text-align: center; }
  .sc-chunk-datepanel-time { font-weight: bold; }

  /* the item path under the ribbon: a grey strip with flat toolbar buttons */
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
    border-bottom: 1px solid #808080;
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
    font: 11px ${FONT};
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
    ${hot}
  }
  :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):active { ${hotDown} }
}

/* ---- SPEAK dialogs (the EE's Preview Date and Time, ...): a dialog-page header, and the date and time
   pickers as 95 combo boxes whose arrow button replaces the calendar and clock icons ---- */
/* the header is the window's caption, as the shell's dialog pages draw it: the title on the left of the
   gradient band, the close button on its right, the description below it on the dialog grey */
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
  height: 18px;
  margin: 0;
  padding: 0 40px 0 4px;
  border: 0;
  background: ${CAPTION};
  text-align: left;
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title .sc-text {
  display: block;
  height: 18px;
  margin: 0;
  padding: 0;
  color: #fff;
  font: bold 11px / 18px ${FONT};
}
${W("speak")} .sc-dialogWindow-header > .sc-text-title {
  display: block;
  padding: 6px 10px;
  color: #000;
  font: 11px / 16px ${FONT};
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
  font: 11px ${FONT};
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker):focus { outline: 1px dotted #000; outline-offset: -4px; }
/* jQuery UI's calendar: as the Content Editor's date picker, a navy caption with the month in white bold
   between two arrow buttons, the chosen day navy, the other months' days grey */
${W("speak")} #ui-datepicker-div.ui-datepicker {
  padding: 2px;
  border-radius: 0;
  ${frameWin}
  background: #c0c0c0;
  color: #000;
  font: 11px ${FONT};
}
${W("speak")} .ui-datepicker .ui-datepicker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
  padding: 0 2px;
  border: 0;
  border-radius: 0;
  background: ${CAPTION};
}
${W("speak")} .ui-datepicker .ui-datepicker-title {
  order: 1;
  margin: 0;
  color: #fff;
  font: bold 11px / 22px ${FONT};
  text-transform: none;
}
${W("speak")} .ui-datepicker .ui-datepicker-title * { color: #fff; font: inherit; text-transform: none; }
${W("speak")} .ui-datepicker :is(.ui-datepicker-prev, .ui-datepicker-next) {
  position: static;
  width: 16px;
  height: 16px;
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
  border-bottom: 1px solid #808080;
  color: #000;
  font: 11px ${FONT};
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
  font: 11px / 16px ${FONT};
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
  border-radius: 0;
  ${well}
  background: #fff;
}
${W("speak")} .ui-timepicker-list li {
  padding: 1px 6px;
  color: #000;
  font: 11px ${FONT};
}
${W("speak")} .ui-timepicker-list li:hover,
${W("speak")} .ui-timepicker-list li.ui-timepicker-selected {
  background: #000080;
  color: #fff;
}

/* ---- Control Panel: 95's Control Panel window. The page title is its caption, Back a flat toolbar
   button under it, and each group an etched group box (as on a property sheet) listing its tasks. ---- */
${W("speak")} body:has(.sc-controlpanel-box) {
  background: #c0c0c0;

  .sc-applicationContent {
    min-height: 100vh;
    background: #c0c0c0;
    color: #000;
    font: 11px ${FONT};
  }
  .sc-applicationHeader {
    border: 0;
    box-shadow: none;
    background: none;
  }
  .sc-applicationHeader-row1 {
    box-sizing: border-box;
    height: 18px;
    border: 0;
    background: ${CAPTION};
  }
  .sc-applicationHeader-row1 .sc-applicationHeader-content {
    height: 18px;
    padding: 0 4px;
  }
  .sc-applicationHeader-title {
    float: none;
    margin: 0;
    padding: 0;
    text-align: left;
  }
  .sc-applicationHeader-title,
  .sc-applicationHeader-title .sc-text {
    display: block;
    height: 18px;
    color: #fff;
    font: bold 11px ${FONT};
    line-height: 18px;
  }
  .sc-applicationHeader-row2 {
    box-sizing: border-box;
    height: 28px;
    padding: 2px 2px;
    border: 0;
    border-bottom: 1px solid #808080;
    box-shadow: 0 1px #fff;
    background: #c0c0c0;
  }
  .sc-applicationHeader-back { height: 24px; margin: 0; padding: 0; }
  .btn.sc-backbutton {
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    height: 24px;
    margin: 0;
    padding: 0 8px 0 4px;
    border: 1px solid transparent;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: #000;
  }
  /* Explorer's Back arrow */
  /* 10.4's red swoosh and its own back arrow */
  .sc-applicationHeader-row1::after,
  .btn.sc-backbutton::after { content: none; display: none; }
  .btn.sc-backbutton::before {
    content: "";
    position: static;
    transform: none;
    display: block;
    width: 16px;
    height: 16px;
    margin: 0;
    mask: none;
    background: ${ico([tri.left(2, 3, 9), bar(7, 6, 7, 3)])};
  }
  .sc-backbutton-text {
    position: static;
    height: 20px;
    margin: 0;
    padding: 0;
    color: inherit;
    font: 11px ${FONT};
    line-height: 20px;
  }
  .btn.sc-backbutton:hover { ${hot} }
  .btn.sc-backbutton:active { ${hotDown} }
  .btn.sc-backbutton:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
  .sc-applicationContent-main {
    margin-top: 8px;
    background: none;
  }
  /* group boxes: an etched frame, the group name laid over its top line */
  .sc-controlpanel-box {
    position: relative;
    margin: 14px 0 0;
    padding: 10px 6px 6px;
    border: 1px solid #808080;
    border-radius: 0;
    box-shadow: inset 1px 1px #fff, 1px 1px #fff;
    background: #c0c0c0;
  }
  .sc-controlpanel-box-header h4 {
    position: absolute;
    top: -8px;
    left: 8px;
    height: 14px;
    margin: 0;
    padding: 0 3px;
    border: 0;
    background: #c0c0c0;
    color: #000;
    font: 11px ${FONT};
    line-height: 14px;
    text-align: left;
    text-transform: none;
  }
  .sc-controlpanel-box-header h4 img { display: none; }
  .sc-controlpanel-box-content {
    padding: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
  }
  .sc-controlpanel-box-content li {
    height: auto;
    padding: 0;
    border: 0;
  }
  /* tasks: links, as in 95's help windows */
  .sc-controlpanel-box-content a {
    display: inline-block;
    padding: 1px 2px;
    color: #000080;
    font: 11px ${FONT};
    line-height: 16px;
    text-decoration: underline;
    white-space: nowrap;
  }
  .sc-controlpanel-box-content a:is(:hover, :focus-visible) {
    background: #000080;
    color: #fff;
    outline: 1px dotted #000;
    outline-offset: 0;
  }
}`;

// ---- Launchpad: 95's Start menu, open. The page is the teal desktop; the global header is the taskbar,
// docked at the top as 95 allowed, its Launchpad button the Start button (held down while the menu is
// open) and the account links in the tray. Under Start hangs the Start menu with its side banner: one row
// per group, each a cascade; the group under the mouse or holding the focus opens its programs as a
// fly-out to the right (the Content Editing group when none is), 16px icons as 95's Programs menu had.
// Custom Analytics is a message box on the desktop. Every row is Sitecore's own link; nothing is fake. ----
const L = T("launchpad");
// the open group: the one under the mouse, else the one holding the focus, else Content Editing
const OPEN = (tail) => [
  `.sc-launchpad-group:hover${tail}`,
  `.sc-launchpad:not(:has(.sc-launchpad-group:hover)) .sc-launchpad-group:focus-within${tail}`,
  `.sc-launchpad:not(:has(.sc-launchpad-group:is(:hover, :focus-within))) .sc-launchpad-group:has(a[href*="Content Editor"])${tail}`,
].map((x) => `  ${x}`).join(",\n");

const icon = (href, url) => `  .sc-launchpad-item${href} .icon img { content: url("${url}"); }`;
const launchpad = `/* Chicago: Launchpad. Generated by tools/build-chicago-css.cjs. */
${speakCommon(L)}
${W("launchpad")} {
  /* the desktop */
  body,
  .sc-applicationContent {
    background: #008080;
    color: #000;
    font: 11px ${FONT};
  }
  /* the body is the desktop, so the content needs no height of its own: LaunchPad.css's 100vh on the main
     section plus any padding scrolled the page. The fixed taskbar is 31px tall; the content starts below
     it, or the first group (Marketing Applications, with Forms) hides under it. */
  html, body { background: #008080; }
  .sc-applicationContent {
    box-sizing: border-box;
    min-height: 0;
    padding: 31px 8px 0;
  }
  /* the product name: the Start menu's banner carries it */
  .sc-applicationHeader { display: none; }

  /* ---- the taskbar, docked at the top ---- */
  .sc-globalHeader {
    box-sizing: border-box;
    height: 31px;
    min-height: 0;
    background: #c0c0c0 !important;
    border-bottom: 1px solid #0a0a0a;
    box-shadow: inset 0 1px #fff, inset 0 -1px #808080;
  }
  .sc-globalHeader .sc-globalHeader-content {
    height: 30px;
    margin: 0;
  }
  .sc-globalHeader .sc-globalHeader-content > div {
    display: flex;
    align-items: center;
    height: 30px;
  }
  .sc-globalHeader .sc-globalHeader-startButton {
    display: flex;
    align-items: center;
    height: 30px;
    margin: 0;
    padding: 0;
  }
  .sc-globalHeader :is(span, a, li, .sc-globalheader-appName),
  .sc-globalHeader .sc-accountInformation li::after {
    color: #000;
    font-weight: normal;
  }
  /* Start: the red disc stands in for the flag, the word in bold; held down, since its menu is open */
  .sc-globalHeader a.sc-global-logo,
  .sc-globalHeader a.sc-global-logo:hover,
  .sc-globalHeader a.sc-global-logo:active {
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    width: auto;
    height: 22px;
    margin: 0;
    padding: 1px 6px 0 5px;
    background: #c0c0c0;
    text-decoration: none;
    ${sunken}
  }
  .sc-globalHeader a.sc-global-logo::before {
    content: "";
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #ff8a7a, #c4120a 70%);
    box-shadow: inset -1px -1px rgba(0, 0, 0, 0.35);
  }
  .sc-globalHeader a.sc-global-logo::after {
    content: "Start";
    color: #000;
    font: bold 11px / 14px ${FONT};
  }
  .sc-globalHeader a.sc-global-logo:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
  /* the tray: the account links in a one-pixel sunken box */
  .sc-globalHeader ul.sc-accountInformation {
    box-sizing: border-box;
    height: 22px;
    margin: 0;
    padding: 0 8px;
    ${thin}
  }
  .sc-globalHeader .sc-accountInformation a:is(:hover, :focus-visible) { text-decoration: underline; }
  .sc-globalHeader .sc-accountInformation img {
    width: 16px;
    height: 16px;
    padding: 0;
    border: 0;
    box-shadow: none;
  }

  /* ---- the Start menu ---- */
  .sc-applicationContent-main {
    max-width: none;
    margin: 0;
    padding: 0;
    background: none;
  }
  .sc-applicationContent-main > .row {
    margin: 0;
    padding: 0;
    background: none;
  }
  .sc-applicationContent-main > .row > div {
    float: none;
    width: auto;
    padding: 0;
  }
  div[data-sc-id="ColumnPanel1"] {
    position: relative;
    padding: 0;
  }
  .sc-launchpad {
    position: relative;
    z-index: 2;
    display: block;
    float: none;
    box-sizing: border-box;
    width: 210px;
    max-width: none;
    margin: 0;
    padding: 3px 3px 3px 27px;
    background: #c0c0c0;
    ${frameWin}
  }
  /* the side banner */
  .sc-launchpad::before {
    content: "Sitecore";
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: 21px;
    box-sizing: border-box;
    padding: 6px 0;
    background: linear-gradient(0deg, #000080, #1084d0);
    color: #fff;
    font: bold 18px / 21px Arial, sans-serif;
    letter-spacing: 0.5px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: left;
  }
  /* a group is a menu row; its programs are the fly-out */
  /* each group reaches over the menu's right padding and frame, so the mouse keeps it open on the way
     into its fly-out */
  .sc-launchpad-group {
    position: relative;
    display: block;
    box-sizing: border-box;
    min-width: 0;
    margin: 0 -4px 0 0;
    padding: 0 4px 0 0;
    border: 0;
    background: none;
  }
  .sc-launchpad-group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    height: 30px;
    margin: 0;
    padding: 0 22px 0 6px;
    border: 0;
    background: ${ico([tri.right(6, 4, 7)])};
    background-position: right 4px center;
    color: #000;
    font: 11px / 30px ${FONT};
    text-align: left;
    text-transform: none;
    white-space: nowrap;
    cursor: default;
  }
  /* 95's program group: a folder */
  .sc-launchpad-group-title::before {
    content: "";
    flex: none;
    width: 24px;
    height: 24px;
    background: url("/sitecore/shell/~/icon/Applications/24x24/folder.png") center / 24px 24px no-repeat;
  }
${OPEN(" .sc-launchpad-group-title")} {
    background: ${ico([tri.right(6, 4, 7, "#fff")])}, #000080;
    background-position: right 4px center, 0 0;
    color: #fff;
  }
  /* the fly-out: the programs stacked right of the menu, the first level with the group's row, inside a
     window frame the group's ::after draws to their count (up to 20) */
  .sc-launchpad-group .sc-launchpad-item,
  .sc-launchpad-group .sc-launchpad-item:is(:hover, :active, :focus) {
    position: absolute;
    left: calc(100% + 2px);
    z-index: 3;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    width: 180px;
    height: 20px;
    min-height: 0;
    margin: 0;
    padding: 0 12px 0 6px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #c0c0c0;
    color: #000;
    outline: none;
    text-decoration: none;
    /* closed fly-outs stay in the focus order: tabbing into one opens it */
    opacity: 0;
    pointer-events: none;
  }
${Array.from({ length: 20 }, (_, k) => `  .sc-launchpad-group .sc-launchpad-item:nth-of-type(${k + 1}) { top: ${k * 20}px; }`).join("\n")}
  .sc-launchpad-group::after {
    content: "";
    position: absolute;
    top: -3px;
    left: calc(100% - 1px);
    z-index: 2;
    display: none;
    box-sizing: border-box;
    width: 186px;
    background: #c0c0c0;
    ${frameWin}
  }
${Array.from({ length: 20 }, (_, k) => `  .sc-launchpad-group:has(> .sc-launchpad-item:nth-of-type(${k + 1}):last-of-type)::after { height: ${(k + 1) * 20 + 6}px; }`).join("\n")}
${OPEN(" > .sc-launchpad-item")} {
    z-index: 4;
    opacity: 1;
    pointer-events: auto;
  }
${OPEN("::after")} {
    z-index: 3;
    display: block;
  }
  .sc-launchpad-item .icon {
    display: block;
    flex: none;
    width: 16px;
    height: 16px;
    margin: 0;
    padding: 0;
    border-radius: 0;
    background: none;
  }
  .sc-launchpad-item .icon img {
    display: block;
    width: 16px;
    height: 16px;
    margin: 0;
  }
  .sc-launchpad-item .sc-launchpad-text {
    float: none;
    max-width: none;
    padding: 0;
    color: inherit;
    font: 11px / 20px ${FONT};
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sc-launchpad-group .sc-launchpad-item:is(:hover, :focus-visible) {
    background: #000080;
    color: #fff;
  }
  .sc-launchpad-group .sc-launchpad-item:is(:hover, :focus-visible) .sc-launchpad-text { color: #fff; }
  /* the programs Sitecore also lists in the start menu take its 16px icons */
${icon('[href*="Content Editor.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/pencil.png")}
${icon('[href*="Media/MediaShop.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/pictures.png")}
${icon('[href*="Workbox.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/workbox.png")}
${icon('[href*="Recycle Bin.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/refresh.png")}
${icon('[href*="PowerShell/PowerShellIse"]', "/sitecore/shell/~/icon/PowerShell/16x16/ise8.png")}
${icon('[href*="PowerShell/PowerShellReports"]', "/sitecore/shell/~/icon/PowerShell/16x16/powershell_runner.png")}
${icon('[href*="ControlPanel.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/setting.png")}
${icon('[href*="shell/default.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/monitor.png")}
${icon('[href*="User Manager.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/user (1).png")}
${icon('[href*="Security Editor.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/shield.png")}
${icon('[href*="Access Viewer.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/lock.png")}
${icon('[href*="Domain Manager.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/routes.png")}
${icon('[href*="Role Manager.aspx"]', "/sitecore/shell/~/icon/Apps/16x16/account.png")}
${icon(':is([href="/"], [href^="/?"])', "/sitecore/shell/~/icon/Apps/16x16/paint.png")}

  /* ---- Custom Analytics: a message box on the desktop, right of the menu ---- */
  .sc-text[data-sc-id="CustomAnalyticsLabel"] {
    position: absolute;
    top: 3px;
    left: 460px;
    z-index: 1;
    display: block;
    box-sizing: border-box;
    width: 354px;
    height: 18px;
    margin: 0;
    padding: 0 4px;
    background: ${CAPTION};
    color: #fff;
    font: bold 11px / 18px ${FONT};
    text-align: left;
    text-transform: none;
  }
  .sc-border[data-sc-id="FallBackMessageBorder"] {
    position: absolute;
    top: 0;
    left: 457px;
    float: none;
    box-sizing: border-box;
    width: 360px;
    margin: 0;
    padding: 21px 3px 3px;
    background: #c0c0c0;
    ${frameWin}
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
    gap: 14px;
    padding: 12px 12px 10px;
  }
  /* MessageBox's information icon: a white speech disc with a navy "i" */
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
    font: 11px / 16px ${FONT};
    text-align: left;
  }
}
/* a narrow window stacks the message box under the menu */
@media (max-width: 900px) {
  ${W("launchpad")} :is(.sc-text[data-sc-id="CustomAnalyticsLabel"], .sc-border[data-sc-id="FallBackMessageBorder"]) { position: relative; top: auto; left: auto; margin-top: 16px; }
  ${W("launchpad")} .sc-text[data-sc-id="CustomAnalyticsLabel"] { margin: 16px 0 -18px 3px; }
}`;

// ---- Login: 95's logon dialog on the teal desktop. A window frame under the gradient caption, sunken
// fields and an OK-sized default button. No caption buttons: they would have nothing to do here. ----
const LG = W("login");
const login = `/* Chicago: login. Generated by tools/build-chicago-css.cjs. */
${LG} body {
  background: #008080;
  color: #000;
  font: 11px ${FONT};
}
${LG} :is(label, a, input, button, span, div, p, li) {
  font-family: ${FONT};
  text-shadow: none;
}
${LG} .main {
  max-width: 440px;
  padding: 3px;
  border-radius: 0;
  background: #c0c0c0;
  ${frameWin}
}
${LG} .main::before {
  content: "Welcome to Sitecore";
  display: block;
  height: 18px;
  padding: 0 4px;
  background: ${CAPTION};
  color: #fff;
  font: bold 11px / 18px ${FONT};
  text-align: left;
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
  font-size: 11px;
  font-weight: normal;
}
${LG} .form-control {
  box-sizing: border-box;
  height: 22px;
  margin: 0 0 8px;
  padding: 2px 4px;
  ${edit}
  font-size: 11px;
}
${LG} .form-control:focus {
  ${well}
  outline: none;
}
${LG} .form-control::placeholder { color: #595959; }
${LG} .btn {
  display: block;
  box-sizing: border-box;
  width: auto;
  min-width: 75px;
  height: 23px;
  margin: 4px 0 0 auto;
  padding: 0 14px;
  ${button}
  line-height: 19px;
}
${LG} .btn.btn-primary { ${defaultBtn} }
${LG} .btn:is(:hover, :focus) {
  background: #c0c0c0;
  color: #000;
}
${LG} .btn:active { border: 1px solid #0a0a0a; box-shadow: inset 1px 1px #808080, inset -1px -1px #808080; }
${LG} .btn:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }
${LG} a,
${LG} a:is(:hover, :focus) {
  color: #000080;
  text-decoration: underline;
}
${LG} .remember-me + .forgot-password::before,
${LG} .vertical-separator {
  border-left-color: #808080;
}
${checks(T("login"))}
/* the check box sits in the label's text flow, not laid over its first letters */
${LG} label.remember-me { padding-left: 0; }
${LG} label.remember-me input[type="checkbox"] { position: static; margin: 0 5px 0 0; vertical-align: -2px; }
${LG} .warning {
  ${edit}
}
${LG} .top {
  ${frameWin}
  background: #c0c0c0;
}
${LG} .top > a { color: #000; }
`;

// the control-menu icon (the Content Editor's ribbon menu button, the dialogs' system menu): a window
const WINDOW_ICON = [bar(1, 2, 14, 1), bar(1, 12, 14, 1), bar(1, 2, 1, 11), bar(14, 2, 1, 11),
  bar(2, 3, 12, 3, "#000080"), bar(2, 6, 12, 6, "#fff")];
const css = `/* Chicago: classic shell. Generated by tools/build-chicago-css.cjs.
   Windows 95/98 standard scheme: #c0c0c0 face, two-pixel bevels, gradient captions, teal desktop. */

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}

/* ---- Scrollbars (Chrome and Edge; Firefox only takes colours) ---- */
${scrollbars(P)}
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar, 12px with a rounded thumb in a
   white ring, which outranks the rules above: the 95 bar again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 16px; height: 16px; background: #dfdfdf; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-track { background: transparent; border-radius: 0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 0; ${raised} }

/* ---- Ribbon tabs: property-sheet tabs over the toolbar, which is their page ---- */
${P} .scRibbonNavigator { background: #c0c0c0; border-bottom: 0; }
/* the tabs stand on the toolbar's white top line; the open one is 3px taller and covers it */
${P} .scRibbonNavigatorButtonsGroupButtons { display: flex; align-items: flex-end; height: 31px; }
${P} .scRibbon a:is(.scRibbonNavigatorButtonsNormal, .scRibbonNavigatorButtonsActive) {
  position: relative;
  top: 1px;
  box-sizing: border-box;
  height: 21px;
  margin: 0;
  padding: 0 10px;
  ${tabFace}
  font-weight: normal;
  line-height: 19px;
}
${P} .scRibbon a.scRibbonNavigatorButtonsActive {
  z-index: 2;
  height: 24px;
  margin: 0 -2px;
  padding: 0 12px;
  line-height: 21px;
}
${P} .scRibbon a.scRibbonNavigatorButtonsActive:first-child { margin-left: 0; }
${P} .scRibbon a:is(.scRibbonNavigatorButtonsNormal, .scRibbonNavigatorButtonsActive):is(:hover, :focus) { background: #c0c0c0; color: #000; }
${P} .scRibbon a:is(.scRibbonNavigatorButtonsNormal, .scRibbonNavigatorButtonsActive):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }

/* ---- Ribbon toolbar: one grey toolbar, the groups split by etched lines, buttons flat until hovered ---- */
${P} .scRibbonToolbar { position: relative; background: #c0c0c0; border-top: 1px solid #fff; border-bottom: 1px solid #808080; }
${P} .scRibbonToolbar .chunk { height: auto; background: #c0c0c0; margin: 2px 1px; border: 1px solid transparent; border-right-color: #808080; border-radius: 0; box-shadow: 1px 0 #fff; }
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #000; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; }
/* Only the buttons themselves: icons, captions and the small-button columns carry "Button" in their
   class names too. A small combo button raises as one piece. A large one is flat until hovered, then
   shows its command and its drop-down as two faces, each pressed on its own. */
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"], span[class^="scRibbonToolbar"][class*="Disabled"], .scRibbonToolbarLargeComboButton, .scRibbonToolbarSmallComboButton) { border: 1px solid transparent; border-radius: 0; box-shadow: none; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):hover { background: #c0c0c0; ${hot} }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):active { background: #c0c0c0; ${hotDown} }
${P} .scRibbonToolbar a[class^="scRibbonToolbar"][class*="ButtonDown"] { background: #dfdfdf; ${hotDown} }
${P} .scRibbonToolbar a[class*="ComboButton"]:is(:hover, :active) { background: transparent; border-color: transparent; box-shadow: none; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom) { background: #c0c0c0; ${hot} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom):active { background: #c0c0c0; ${hotDown} }
/* the ribbon's menu button: 95's control-menu icon */
${P} a.scSystemMenu { background: ${ico(WINDOW_ICON)}; }
${P} a.scSystemMenu:hover { background-color: transparent; }
${P} a.scSystemMenu > img { opacity: 0; }

/* ---- Content trees: a white list in a sunken well, the selected node navy ---- */
${P} .scContentTree { background: #fff; }
${P} a.scContentTreeNodeActive { background: #000080; color: #fff; border-radius: 0; }
${P} a.scContentTreeNodeActive span { color: #fff !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; }
${P} a:is(.scContentTreeNodeNormal, .scContentTreeNodeActive):focus-visible { outline: 1px dotted #000; outline-offset: -1px; }
/* The [+]/[-] box is a real 9px bordered box, margined out to the stock 16px footprint: at 125% scaling
   gradient edges and inset shadows land between device pixels and smear, borders snap. 95's is grey. */
${P} img[src*="/treemenu_"] {
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  margin: 4px 3px 3px 4px;
  border: 1px solid #808080;
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
${P} .scEditorHeaderTitle { font-weight: bold; font-size: 13px; color: #000; }
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  background: #c0c0c0;
  color: #000;
  font-weight: bold;
  line-height: 20px;
  padding: 0 0 0 6px;
  margin: 0 0 2px;
  ${raised}
}
${P} img.scEditorSectionCaptionGlyph { width: 16px; height: 16px; margin: 2px 2px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(G.up)} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(G.down)} }
${P} .scEditorFieldLabel { color: #000; font-weight: normal; }
/* The marker bar only shows validation colours, as in 10.x */
${W("shell")} td.scEditorFieldMarkerBarCell { background: transparent; border-left-color: transparent; }
${P} .scContentControl,
${P} .scEditorSections input:not([type="checkbox"]):not([type="radio"]),
${P} .scEditorSections textarea,
${P} .scEditorSections select {
  ${edit}
}
${P} .scEditorSections select:not([multiple]):not([size]:not([size="1"])) { background: ${comboRight}, #fff; }

${P} .scSearchInput { ${edit} }

/* ---- Buttons ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] {
  ${button}
}
${P} .scButton:active, ${P} button:not(.ui-button):active { border: 1px solid #0a0a0a; box-shadow: inset 1px 1px #808080, inset -1px -1px #808080; }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px dotted #000; outline-offset: -5px; }

/* ---- Bottom application tabs: task buttons, the open one held down over the dither ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 2px; background: #c0c0c0; border-top: 1px solid #fff; box-shadow: inset 0 1px #dfdfdf; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive { color: #000; font-weight: normal; background: #c0c0c0; ${raised} border-radius: 0; margin: 1px; }
${P} .scPagerButtonActive { background: #dfdfdf; font-weight: bold; ${sunken} }
/* 10.5 draws the pager's links white once visited (the page links to itself); computed styles hide it */
${W("shell")} a:is(.scPagerButtonNormal, .scPagerButtonActive):is(:link, :visited) { color: #000; }

/* ---- Dialog windows (jQuery UI frames around Sitecore dialogs): 95's window frame ---- */
${P} .ui-dialog {
  background: #c0c0c0;
  border-radius: 0;
  padding: 3px;
  ${frameWin}
}
/* Sitecore stacks a 15px jQuery title bar above the dialog page, whose header is the caption. Laid over
   the caption, the bar keeps dragging and carries the buttons into the caption's right end. */
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 3px;
  left: 3px;
  right: 3px;
  height: 18px;
  min-height: 0;
  z-index: 2;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  width: 16px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
/* The button pane spans the title bar, the buttons at its right end. Sitecore pins the pane with
   !important and writes the close button's position inline. */
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  left: 0;
  right: 2px !important;
  top: 2px !important;
  width: auto;
  height: 14px;
  display: flex;
  justify-content: flex-end;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: 9;
  margin: 0 0 0 2px !important;
  background: ${G.close};
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button:active { background: ${G.closeDown}; }
/* 95 never dimmed the screen behind a dialog; a faint shade still marks the dialog as modal. */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.12); opacity: 1; }
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: ${G.max}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: ${G.min}; }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: ${G.restore}; }
${P} .ui-dialog .ui-dialog-titlebar-maximize:active { background: ${G.maxDown}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize:active { background: ${G.minDown}; }
${P} .ui-dialog .ui-dialog-titlebar-restore:active { background: ${G.restoreDown}; }

/* Inside a dialog page: its header is the caption, the title on the left. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #c0c0c0; padding: 0; border: 0; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  background: ${CAPTION};
  color: #fff;
  font-weight: bold;
  font-size: 11px;
  text-align: left;
  line-height: 18px;
  height: 18px;
  margin: 0;
  padding: 0 60px 0 4px;
  border: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 6px 8px; margin: 0; }
/* SPE puts a 32px icon in the caption; 95 captions carry a 16px one. */
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin-right: 4px; vertical-align: -3px; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter { background: #c0c0c0; }

/* ---- Window buttons: 95's 16x14 caption buttons, minimise and maximise together, close 2px apart ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { box-sizing: border-box; width: 16px; height: 14px; margin: 0; padding: 0; border: 0; vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { ${paint(G.switcher)} margin-right: 2px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { ${paint(G.min)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { ${paint(G.max)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { ${paint(G.restore)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { ${paint(G.close)} margin-left: 2px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"]:active { background: ${G.switcherDown}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"]:active { background: ${G.minDown}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"]:active { background: ${G.maxDown}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"]:active { background: ${G.restoreDown}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"]:active { background: ${G.closeDown}; }
/* Standard windows (ISE, Console, Package Designer...): the gradient caption, title left, buttons right. */
${P} .standardWindowCaption { height: 18px; background: ${CAPTION}; border: 0; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 18px; }
/* the window's 16px icon at the caption's left, as Windows 95 drew it, the title beside it */
${P} .standardWindowCaption .windowCaptionIcon { float: left; width: 16px; height: 16px; margin: 1px 0 0 2px; }
${P} .standardWindowCaption .scWindowCaption { display: block; line-height: 18px; font-size: 11px; font-weight: bold; color: #fff; text-align: left; padding: 0 60px 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P} .standartWindowButtons { top: 2px; right: 2px; height: 14px; display: flex; align-items: center; justify-content: flex-end; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. 95's title bar, as on every other window, is
   drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), the window's
   buttons on it and the ribbon's menu button moved below it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 18px; background: ${CAPTION}; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 18px; padding: 0 76px 0 22px; background: var(--sct-window-icon, none) 2px 1px / 16px 16px no-repeat; color: #fff; font: bold 11px/18px ${FONT}; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 2px; right: 2px; margin-right: 0; height: 14px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 18px; height: 27px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* and the tab row shrinks to the open tab and a 2px gap above it */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigatorButtonsGroupButtons { height: 27px; }
/* the same 4px on a standard window (the ISE...), whose ribbon is in the page inside the window's chrome */
${P}[data-sct-window-content] .scRibbonNavigator { padding-top: 0; } /* its tabs already stand 4px down in their row */
${P}[data-sct-window-content] .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
${P}[data-sct-window-content] .scRibbonNavigatorButtonsGroupButtons { height: 27px; }
html[data-sct-theme="${ID}"][data-sct-window="inactive"][data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, html[data-sct-theme="${ID}"][data-sct-window="inactive"][data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { background: ${CAPTION_OFF}; }


/* ---- Insert gallery scroller: arrow buttons ---- */
${P} .scRibbonPanelButtons { background: #c0c0c0; }
${P} img.scRibbonPanelUp { ${paint(G.up)} width: 16px; height: 15px; filter: none; }
${P} img.scRibbonPanelDown { ${paint(G.down)} width: 16px; height: 15px; filter: none; }
${P} img.scRibbonPanelOpen { ${paint(G.dots)} width: 16px; height: 15px; filter: none; }

/* ---- Desktop: the teal desktop and 95's 28px taskbar ---- */
${P} .DesktopArea { bottom: 28px; background: #008080 !important; }
${P} .scStartbar { height: 28px; overflow: hidden; background: #c0c0c0; }
${P} #Startbar, ${P} #Startbar > table { height: 28px !important; background: #c0c0c0; }
${P} #Startbar { box-sizing: border-box; border-top: 1px solid #dfdfdf; box-shadow: inset 0 1px #fff; }
${P} #Startbar > table { height: 27px !important; }
${P} #Startbar > table > tbody > tr > td { height: 27px; padding: 0; vertical-align: middle; }
${P} .scStartButtonContainer { display: flex; align-items: center; height: 27px; padding: 0 2px; }
/* Start: the red disc stands in for the flag */
${P} .scStartButton, ${P} .scStartButton:hover {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  width: auto;
  height: 22px;
  margin: 0;
  padding: 0 6px 0 5px;
  background: #c0c0c0;
  ${raised}
}
${W("shell")} .scStartButton.scPopupOpener { background: #c0c0c0; padding: 1px 5px 0 6px; ${sunken} }
${P} .scStartButton::before {
  content: "";
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ff8a7a, #c4120a 70%);
  box-shadow: inset -1px -1px rgba(0, 0, 0, 0.35);
}
${P} .scStartButton::after { content: "Start"; color: #000; font: bold 11px / 14px ${FONT}; }
${P} .scStartButton:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
${P} .scStartBarScroller { height: 27px; padding: 0; border: 0; background: transparent; display: flex; align-items: center; }
@media (resolution: 1dppx) {
  ${W("shell")} :is(.scActiveApplication, .scPagerButtonActive) { background: ${DITHER}; }
}
${P} .scStartBarScroller a, ${P} .scStartBarScroller div[class*="Button"] { color: #000; }
/* the tray: search and database in a one-pixel sunken box */
${P} #StartbarTray { box-sizing: border-box; height: 22px; margin: 0 2px; border-collapse: separate; border-spacing: 0; ${thin} }
${P} #StartbarTray td { height: 20px; padding: 0 4px 0 2px; }
${P} .scStartbarTray, ${P} .scStartbarTray * { color: #000; background-color: transparent; }
${P} #Tray { line-height: 20px !important; }
${P} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 3px 0 0 !important; vertical-align: -4px; }
${P} #DatabaseSelector { font: 11px ${FONT}; }
/* the clock (dom.js adds the cell) */
${P} #StartbarTray td.sct-chicago-clock { padding: 0 6px 0 4px; color: #000; font: 11px / 20px ${FONT}; white-space: nowrap; }

/* ---- An inactive desktop window's caption: 98's grey gradient (dom.js marks the window's document) ---- */
html[data-sct-theme="${ID}"][data-sct-window="inactive"] .standardWindowCaption { background: ${CAPTION_OFF}; }
html[data-sct-theme="${ID}"][data-sct-window="inactive"] .standardWindowCaption .scWindowCaption { color: #fff; }

/* ---- Start menu: 95's. A window frame, the side banner down its left edge. ---- */
${P} #StartMenu {
  position: relative;
  box-sizing: border-box;
  min-width: 200px;
  padding: 3px 3px 3px 27px;
  background: #c0c0c0;
  ${frameWin}
}
${P} #StartMenu::before {
  content: "Sitecore";
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: 21px;
  box-sizing: border-box;
  padding: 6px 0;
  background: linear-gradient(0deg, #000080, #1084d0);
  color: #fff;
  font: bold 18px / 21px Arial, sans-serif;
  letter-spacing: 0.5px;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  text-align: left;
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
  fs.writeFileSync(path.join(__dirname, "..", "extension", "themes", ID, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
