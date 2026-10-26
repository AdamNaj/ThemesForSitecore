// Dev tool: writes extension/themes/losgatos/{shell,speak,launchpad,login}.css and the glyph images in
// extension/themes/losgatos/glyphs. Los Gatos recreates the Amiga Workbench 1.3: its gadgets and arrows are
// pixel art, so they are drawn here rather than written by hand. Run: node tools/build-losgatos-css.cjs
//
// Measured from Workbench 1.3 (640x256, non-square pixels, so read as 1:1 here at twice the size):
// - palette: blue #0055aa (screen, window interiors), white #ffffff (frames, text, menus), black #000000
//   (shadows, gadget art), orange #ff8800 (selection, the complement of blue). Orange on blue fails AA for
//   text (2.97:1), so orange is only ever a fill, with black text on it (8.7:1).
// - font: Topaz 8, an 8x8 bitmap monospace; here a system monospace stack at 12px.
// - window: a 2px white frame; the title bar 20px, striped white and blue 2px lines on blue, the title in a
//   solid white gap, blue text; the close gadget at the left (white box, a black dot), the depth gadgets at
//   the right (two overlapping squares), the sizing gadget at the bottom right.
// - gadgets: 24x20 boxes, white face, 2px blue frame. Buttons, fields and tabs: 2px white outlines on blue.
// - screen title bar: white, 24px, blue text, on top of the screen.
// - menus: white, blue text, a 2px black frame; the highlighted item inverted (blue, white text).
// - scrollbars (proportional gadgets): a white-framed blue track, a white knob.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const ID = "losgatos";
const T = (surface) => `html[data-sct-theme="${ID}"][data-sct-surface="${surface}"]`;
const P = T("shell");
// :not(#sct-lg) matches every page; its id weight lets hand-written rules beat Sitecore's own.
const W = (surface) => `${T(surface)}:not(#sct-lg)`;
const FONT = '"Cascadia Mono", Consolas, monospace';
const B = "#0055aa", WH = "#ffffff", K = "#000000", O = "#ff8800";

// ---- Glyphs. Shapes on a small grid (triangles, bars, rings), written by art() into themes/losgatos/glyphs
// twice: as a PNG, rasterised the way a hard colour stop is (a pixel is filled when its centre is inside the
// shape) and kept exact at 100% by pixelate(); and as a vector SVG of the intended shape for every other
// scale. Triangles' sides run through the middle of each pixel step; bars keep crispEdges. The CSS names the
// files sct-ext:<path>, which background.js points at the extension's own URL, so a page CSP without data:
// in img-src (some installs send one) still loads them. ----
const HEX = { B, W: WH, K, O };
const LETTER = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [v, k]));
const tri = {
  down: (x, y, w, c = WH) => ({ kind: "down", x, y, w, h: (w + 1) / 2, c }),
  up: (x, y, w, c = WH) => ({ kind: "up", x, y, w, h: (w + 1) / 2, c }),
  left: (x, y, h, c = WH) => ({ kind: "left", x, y, w: (h + 1) / 2, h, c }),
  right: (x, y, h, c = WH) => ({ kind: "right", x, y, w: (h + 1) / 2, h, c }),
};
const bar = (x, y, w, h, c = WH) => ({ kind: "bar", x, y, w, h, c });
// a one-pixel rectangle outline, as four bars
const box = (x, y, w, h, c = K) => [bar(x, y, w, 1, c), bar(x, y + h - 1, w, 1, c), bar(x, y, 1, h, c), bar(x + w - 1, y, 1, h, c)];
// a check mark: two strokes, drawn pixel by pixel on the grid and as a polyline
const check = (x, y, c = WH) => ({ kind: "check", x, y, w: 9, h: 7, c });
const CHECK = ["........#", ".......##", "#.....##.", "##...##..", ".##.##...", "..###....", "...#....."];

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
        check: CHECK[j] && CHECK[j][i] === "#",
      }[s.kind];
      if (on) set(s.x + i, s.y + j, s.c);
    }
  }
  return px.map((r) => r.join(""));
}
function vectorize(shapes) {
  return shapes.map(({ kind, x, y, w, h, c }) => {
    const poly = (...p) => `<path d="M${p.join("L")}Z" fill="${c}"/>`;
    if (kind === "bar") return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" shape-rendering="crispEdges"/>`;
    if (kind === "down") return poly(`${x - 0.5} ${y}`, `${x + w + 0.5} ${y}`, `${x + w / 2} ${y + h}`);
    if (kind === "up") return poly(`${x - 0.5} ${y + h}`, `${x + w + 0.5} ${y + h}`, `${x + w / 2} ${y}`);
    if (kind === "left") return poly(`${x + w} ${y - 0.5}`, `${x + w} ${y + h + 0.5}`, `${x} ${y + h / 2}`);
    if (kind === "right") return poly(`${x} ${y - 0.5}`, `${x} ${y + h + 0.5}`, `${x + w} ${y + h / 2}`);
    // the check: a 2px stroke through the pixel centres
    return `<path d="M${x + 0.5} ${y + 2.5}L${x + 3.5} ${y + 5.5}L${x + 8.5} ${y + 0.5}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="square"/>`;
  }).join("");
}
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
// One background layer: the shapes on a w x h canvas, centred unless placed otherwise. Both images get a
// transparent 1px margin: Chrome softens the edge of an image placed between device pixels.
function art(shapes, { w = 16, h = 16, pos = "center" } = {}) {
  shapes = shapes.flat();
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
    raw.writeUInt32BE(((parseInt(HEX[c].slice(1), 16) << 8) | 0xff) >>> 0, y * (w * 4 + 1) + 1 + x * 4);
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
// At exactly 100% the PNGs are drawn nearest-neighbour: every rule whose background draws a glyph gets
// image-rendering: pixelated in one @media block, and a zero-specificity reset keeps it off the children.
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
// Hides an <img>'s own picture so the painted background shows instead.
const paint = (g) => `object-fit: none; object-position: -999px -999px; background: ${g};`;

// ---- The gadgets' insides, on a 20x16 face (a 24x20 gadget less its 2px blue frame) ----
const G = {
  // close: a black dot in the middle of the white face
  close: art([bar(8, 6, 4, 4, K)], { w: 20, h: 16 }),
  // depth, to front (maximise): the back square blue, the front one white in a black line over it
  front: art([bar(3, 2, 10, 8, B), bar(7, 6, 10, 8, WH), box(7, 6, 10, 8)], { w: 20, h: 16 }),
  // depth, to back (minimise): the outlined square first, the blue one over it
  back: art([bar(3, 2, 10, 8, WH), box(3, 2, 10, 8), bar(7, 6, 10, 8, B)], { w: 20, h: 16 }),
  // zoom (restore): a small blue square in a large outline
  zoom: art([box(3, 2, 14, 12), bar(5, 4, 6, 4, B)], { w: 20, h: 16 }),
  // the Content Editor's page switcher: three lines
  lines: art([bar(5, 3, 10, 2, K), bar(5, 7, 10, 2, K), bar(5, 11, 10, 2, K)], { w: 20, h: 16 }),
  // the Launchpad gadget: nine blue squares
  grid: art([0, 4, 8].flatMap((y) => [0, 4, 8].map((x) => bar(3 + x, 2 + y, 3, 3, B))), { w: 15, h: 13 }),
  // the sizing gadget: two nested corners
  size: art([box(2, 2, 10, 9, B), bar(2, 2, 6, 5, B)], { w: 14, h: 13 }),
};
// Arrows: white on blue (scrollbars, fields, ribbon), blue on white (menus, section headers), black on orange
const triDown = (c = WH) => art([tri.down(4, 6, 7, c)], { w: 15, h: 15 });
const triUp = (c = WH) => art([tri.up(4, 5, 7, c)], { w: 15, h: 15 });
const triLeft = (c = WH) => art([tri.left(5, 4, 7, c)], { w: 15, h: 15 });
const triRight = (c = WH) => art([tri.right(6, 4, 7, c)], { w: 15, h: 15 });
const checked = (c = WH) => art([check(0, 0, c)], { w: 9, h: 7 });
// a field's drop-down end: the arrow right-aligned, then a 2px white divider down the field
const comboRight = [
  art([tri.down(0, 0, 7)], { w: 7, h: 4, pos: "right 5px center" }),
  `linear-gradient(${WH}, ${WH}) right 18px top 0 / 2px 100% no-repeat`,
].join(", ");

// ---- Recipes ----
const frame = `border: 2px solid ${WH}; border-radius: 0; box-shadow: none;`;
// a field: blue, white text, a 2px white outline; focused, an orange outline outside it and an orange caret
const edit = `background: ${B}; color: ${WH}; ${frame} caret-color: ${O};`;
const editFocus = `outline: 2px solid ${O}; outline-offset: 0; box-shadow: none; border-color: ${WH};`;
// a push button: blue, white text, a 2px white outline; hovered it inverts, pressed it is the orange fill
const button = `background: ${B}; color: ${WH}; ${frame} font: 12px ${FONT}; text-transform: none; text-shadow: none;`;
const buttonHover = `background: ${WH}; color: ${B}; border-color: ${WH};`;
const buttonDown = `background: ${O}; color: ${K}; border-color: ${WH};`;
// the default button: a second white outline inside, as Workbench drew its OK
const primary = `box-shadow: inset 0 0 0 2px ${B}, inset 0 0 0 4px ${WH};`;
// a tab: 2px white outline open at the bottom
const tabFace = `background: ${B}; color: ${WH}; border: 2px solid ${WH}; border-bottom: 0; border-radius: 0; box-shadow: none; text-transform: none; text-shadow: none; font: 12px ${FONT};`;
const tabOpen = `background: ${O}; color: ${K};`;
// a menu: white, blue text, a 2px black frame; the highlighted row inverted
const menuFrame = `border: 2px solid ${K}; border-radius: 0; box-shadow: none; background: ${WH};`;
// The title bar's stripes: 2px white lines 2px apart, on blue, 2px in from the top and bottom. At 125% two
// CSS pixels are 2.5 device pixels and the lines alternate 2 and 3 pixels thick; there they are 2.4px
// (three device pixels) instead. The variable is set once per area (see stripesVars).
const stripes = (h = 20) => `var(--lg-stripes) 0 2px / 100% ${h - 4}px no-repeat, ${B}`;
const stripesVars = `html[data-sct-theme="${ID}"] { --lg-stripes: repeating-linear-gradient(${WH} 0 2px, ${B} 2px 4px); }
@media (resolution: 1.25dppx) {
  html[data-sct-theme="${ID}"] { --lg-stripes: repeating-linear-gradient(${WH} 0 2.4px, ${B} 2.4px 4.8px); }
}`;
// a gadget: the face white in a 2px blue frame, its art inside
const gadget = (g) => `box-sizing: border-box; width: 24px; height: 20px; margin: 0; padding: 0; border: 2px solid ${B}; border-radius: 0; background: ${g}, ${WH}; filter: none; opacity: 1;`;
const gadgetDown = `background-color: ${O};`;
// the white gap the title sits in
const titleGap = `display: inline-block; height: 16px; margin: 2px 0; padding: 0 6px; background: ${WH}; color: ${B}; font: 12px / 16px ${FONT}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: top;`;

// ---- Shared by every area: the global header is the screen's title bar, white with blue text. The
// Launchpad button is a gadget with nine squares; the portrait is left out (Workbench had none). ----
const header = (S, h) => `${S}:not(#sct-lg) .sc-globalHeader {
  background: ${WH} !important;
  border-bottom: 0;
  box-shadow: none;
  color: ${B};
  font-family: ${FONT};
}
${S}:not(#sct-lg) .sc-globalHeader :is(span, a, li, .sc-globalheader-appName),
${S}:not(#sct-lg) .sc-globalHeader .sc-accountInformation li::after {
  color: ${B};
  font-family: ${FONT};
  font-size: 12px;
  font-weight: normal;
  text-decoration: none;
}
${S}:not(#sct-lg) .sc-globalHeader .sc-accountInformation :is(.logout, a.logout):is(:hover, :focus-visible) {
  background: ${B};
  color: ${WH};
  outline: none;
}
${S}:not(#sct-lg) .sc-globalHeader a.sc-global-logo,
${S}:not(#sct-lg) .sc-globalHeader a.sc-global-logo:hover {
  box-sizing: border-box;
  width: 24px;
  height: 20px;
  min-width: 24px;
  margin: 0;
  padding: 0;
  border: 2px solid ${B};
  border-radius: 0;
  /* the token layer cuts 10.5's glyph out of the header colour with a mask */
  mask: none;
  background: ${G.grid}, ${WH};
}
${S}:not(#sct-lg) .sc-globalHeader a.sc-global-logo:active { background-color: ${O}; }
${S}:not(#sct-lg) .sc-globalHeader a.sc-global-logo:focus-visible { outline: 2px solid ${O}; outline-offset: 0; }
/* every item centred on the bar */
${S}:not(#sct-lg) .sc-globalHeader .sc-globalHeader-startButton {
  display: flex;
  align-items: center;
  height: ${h}px;
  margin: 0;
}
${S}:not(#sct-lg) .sc-globalHeader ul.sc-accountInformation {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: ${h}px;
}
${S}:not(#sct-lg) .sc-globalHeader ul.sc-accountInformation > li {
  display: flex;
  align-items: center;
  line-height: normal;
}
${S}:not(#sct-lg) .sc-globalHeader .sc-accountInformation :is(.logout, a.logout) { padding: 0 4px; }
${S}:not(#sct-lg) .sc-globalHeader .sc-ext-dbName {
  align-self: center;
  margin-top: 0;
  margin-bottom: 0;
  color: ${B};
  font: 12px ${FONT};
  line-height: normal;
  vertical-align: middle;
}
${S}:not(#sct-lg) .sc-globalHeader .sc-accountInformation img { display: none; }`;

// ---- Check boxes and radio buttons, everywhere: a blue box in a 2px white frame with a white check; the
// radio button a white ring with a white dot. ----
const checks = (S) => `${S}:not(#sct-lg) :is(input[type="checkbox"], input[type="radio"]) {
  appearance: none;
  flex: none;
  box-sizing: border-box;
  width: 15px;
  height: 15px;
  margin: 0 5px 0 0;
  padding: 0;
  border: 2px solid ${WH};
  border-radius: 0;
  box-shadow: none;
  outline: none;
  background: ${B};
  vertical-align: -3px;
}
${S}:not(#sct-lg) input[type="radio"] { border-radius: 50%; }
${S}:not(#sct-lg) input[type="checkbox"]:checked { background: ${checked()}, ${B}; }
${S}:not(#sct-lg) input[type="radio"]:checked { background: radial-gradient(circle, ${WH} 0 2.5px, ${B} 3px); }
${S}:not(#sct-lg) :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 2px solid ${O}; outline-offset: 1px; }
${S}:not(#sct-lg) :is(input[type="checkbox"], input[type="radio"]):disabled { opacity: 0.5; }`;

// ---- Scrollbars: Workbench's proportional gadget. The track blue inside a white line, the knob white,
// arrow gadgets white on blue. ----
const scrollbars = (S) => `${S} { scrollbar-color: auto; }
${S} ::-webkit-scrollbar { width: 16px; height: 16px; background: ${B}; }
${S} ::-webkit-scrollbar-track { background: ${B}; box-shadow: inset 0 0 0 2px ${WH}; border-radius: 0; }
${S} ::-webkit-scrollbar-thumb, ${S} :is(select, textarea, div)::-webkit-scrollbar-thumb { background: ${WH}; border: 4px solid ${B}; border-radius: 0; box-shadow: inset 0 0 0 0 transparent; background-clip: padding-box; }
${S} ::-webkit-scrollbar-corner { background: ${B}; }
${S} ::-webkit-scrollbar-button:single-button { display: block; width: 16px; height: 16px; border: 2px solid ${WH}; box-sizing: border-box; }
${S} ::-webkit-scrollbar-button:vertical:decrement { background: ${triUp()}, ${B}; }
${S} ::-webkit-scrollbar-button:vertical:increment { background: ${triDown()}, ${B}; }
${S} ::-webkit-scrollbar-button:horizontal:decrement { background: ${triLeft()}, ${B}; }
${S} ::-webkit-scrollbar-button:horizontal:increment { background: ${triRight()}, ${B}; }
${S} ::-webkit-scrollbar-button:active { background-color: ${O}; }`;

// ---- Shell: details 10.x's markup and inline styles need ----
const shellHand = `${W("shell")} {
  /* ---- Menus (context menus, start menu fly-outs, drop-downs): Workbench's white menu, blue text in a
     black frame, the highlighted item inverted ---- */
  .scPopup:not(:has(> .scStartMenu)) {
    padding: 0;
    ${menuFrame}
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
    background: ${WH};
    color: ${B};
  }
  .scMenu tr > td:is([class^="scMenuItem"], [class^="scMenuPanelItem"]) {
    height: 20px;
    padding-top: 0;
    padding-bottom: 0;
    border: 0;
    background: ${WH};
    color: ${B};
    font: 12px ${FONT};
    line-height: 20px;
  }
  .scMenu td[class^="scMenuItemIcon"] {
    width: 18px;
    padding: 0 2px 0 4px;
  }
  .scMenu td[class^="scMenuItemCaption"] { padding: 0 8px 0 4px; }
  .scMenu td[class^="scMenuItemHotkey"] { padding: 0 4px; }
  /* Workbench ghosted a disabled item; the 4-colour palette has no grey, so the text stays blue at half
     strength (the item cannot be chosen, and it does not highlight) */
  .scMenu tr > td[class^="scMenuItem"][class$="_Disabled"] { color: ${B}; opacity: 0.55; }
  .scMenu td[class$="_Disabled"] img { opacity: 0.5; }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td,
  .scMenu tr > td[class$="_Hover"] {
    background: ${B};
    color: ${WH};
  }
  .scMenu tr:not(:has(td[class$="_Disabled"])):hover > td * { color: ${WH}; }
  /* separators: one blue line across the menu */
  .scMenu tr > td[class^="scMenuDivider"] {
    height: 6px;
    padding: 0;
    border: 0;
    background: linear-gradient(transparent 2px, ${B} 2px 4px, transparent 4px), ${WH};
  }
  .scMenu img[src*="Submenu16x16" i] { ${paint(triRight(B))} filter: none; }
  .scMenu tr:hover img[src*="Submenu16x16" i] { background: ${triRight()}; }

  /* ---- Content tree search: a field and two gadgets of its height ---- */
  #SearchPanel {
    margin: 0;
    padding: 4px;
    background: ${B};
    border-bottom: 2px solid ${WH};
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
    height: 24px;
    min-height: 0;
    padding: 2px 6px;
    ${edit}
    font: 12px ${FONT};
  }
  :is(a.scSearchButton, a.scSearchOptionsButton) {
    display: block;
    box-sizing: border-box;
    width: 24px;
    height: 24px;
    margin: 0 0 0 4px;
    padding: 0;
    ${button}
  }
  :is(a.scSearchButton, a.scSearchOptionsButton):hover { ${buttonHover} }
  :is(a.scSearchButton, a.scSearchOptionsButton):active { ${buttonDown} }
  :is(a.scSearchButton, a.scSearchOptionsButton) img {
    display: block;
    width: 16px;
    height: 16px;
    margin: 2px;
    padding: 0;
    filter: var(--sct-glyph-filter);
  }
  a.scSearchButton:hover img { filter: none; }
  a.scSearchOptionsButton img { ${paint(triDown())} filter: none; }
  a.scSearchOptionsButton:hover img { background: ${triDown(B)}; }
  #TreeSearchOptions {
    width: 100%;
    margin: 4px 0 0;
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
    color: ${WH};
    font: 12px ${FONT};
  }
  #TreeSearchOptions img.arrowDown { ${paint(triDown())} filter: none; }
  #TreeSearchOptions input.scSearchOptionsInput {
    box-sizing: border-box;
    width: 100%;
    height: 24px;
    min-height: 0;
    padding: 2px 6px;
    ${edit}
    font: 12px ${FONT};
  }

  /* ---- The language, version and navigator drop-downs above the editor: fields with a drop-down end ---- */
  .scEditorTabControls a.scEditorHeaderButton {
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 24px;
    min-width: 0;
    margin: 0 0 0 4px;
    padding: 0 0 0 6px;
    ${edit}
    font: 12px ${FONT};
    line-height: 20px;
  }
  .scEditorTabControls a.scEditorHeaderButton:hover { background: ${B}; outline: 2px solid ${O}; outline-offset: 0; }
  .scEditorTabControls a.scEditorHeaderButton span {
    display: inline-flex;
    align-items: center;
    height: 20px;
    color: ${WH};
  }
  .scEditorTabControls a.scEditorHeaderButton img:not([class*="Glyph"]) { margin: 0 4px 0 0; }
  .scEditorTabControls :is(.scEditorHeaderNavigatorGlyph, .scEditorHeaderVersionsLanguageGlyph, .scEditorHeaderVersionsVersionGlyph) {
    width: 18px;
    height: 20px;
    margin: 0 0 0 6px;
    padding: 0;
    border-left: 2px solid ${WH};
    filter: none;
    ${paint(triDown())}
  }

  /* ---- The chunk's rows: a 2px gap, the 46px panel, the caption under it. 10.4's stock panel padding
     (10px 8px) would push the buttons over the caption; both versions get the same. ---- */
  .scRibbonToolbar .chunk { padding-bottom: 2px; }
  .scRibbonToolbar .chunk > .panel {
    box-sizing: border-box;
    height: 46px;
    margin-top: 3px;
    padding: 0 5px 10px;
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
    padding: 2px 5px 1px;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) {
    box-sizing: border-box;
    height: 46px;
    padding: 0;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonTopDisabled) {
    height: auto;
    padding: 2px 5px 0;
  }
  .scRibbonToolbar :is(.scRibbonToolbarLargeComboButtonBottom, .scRibbonToolbarLargeComboButtonBottomDisabled) {
    height: auto;
    padding: 1px 5px;
  }
  .scRibbonToolbar [class^="scRibbonToolbarLarge"] .header {
    display: block;
    padding: 2px 0 1px;
    line-height: 14px;
  }
  .scRibbonToolbar [class^="scRibbonToolbarLargeComboButtonBottom"] .header { display: inline; }
  .scRibbonToolbar .scRibbonToolbarSmallButtons {
    box-sizing: border-box;
    height: 46px;
    padding-top: 1px;
  }
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
  .scRibbonToolbar .scRibbonPanelButtons {
    box-sizing: border-box;
    height: 44px;
    margin-top: 0;
    padding: 0;
  }
  .scRibbonToolbar :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) {
    display: block;
    height: 14px;
  }
  .scRibbonToolbar [class^="scRibbonToolbarLargeGalleryButton"] .header { display: inline; }
  .scRibbonToolbar [class^="scRibbonToolbarLargeGalleryButton"] > img:first-child {
    display: block;
    margin: 0 auto 4px;
  }

  /* ---- Tabs, all of them (dialog and application tab strips, the ISE's script tabs, Read-Variable's
     pages, the editor tabs): 2px white outlines open at the bottom; the open one is the orange fill with
     black text, 3px taller, standing over its page's top line so the two join. Hovering a closed tab
     inverts it. Sitecore swaps the classes to *_Hover under the mouse. ---- */
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
    height: 22px;
    margin-right: 2px;
    padding: 0 10px;
    ${tabFace}
    line-height: 20px;
    cursor: default;
  }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover) * { color: inherit; }
  :is(.scTabActive, .scTabActive_Hover) {
    top: 2px;
    z-index: 2;
    height: 25px;
    ${tabOpen}
    line-height: 23px;
  }
  :is(.scTab_Hover, .scTab:hover) { ${buttonHover} }
  /* the ISE's script tabs have no page under them: the strip draws the line the open tab stands on, from the
     first tab on (SPE's 52px reserve holds the script tree and variables toggles, with no line under them) */
  #TabsPanel .scTabstrip { background-image: linear-gradient(${WH} 0 0); background-position: 52px 100%; background-size: 100% 2px; background-repeat: no-repeat; }
  .scTabstrip .closeTab { margin: 0 -3px 0 6px; filter: var(--sct-glyph-filter); }
  :is(.scTabActive, .scTabActive_Hover, .scTab_Hover, .scTab:hover) .closeTab { filter: none; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus { outline: none; }
  :is(.scTab, .scTab_Hover, .scTabActive, .scTabActive_Hover):focus-visible { outline: 2px solid ${WH}; outline-offset: -5px; }
  /* the page: blue in a 2px white frame */
  .scTabs {
    box-sizing: border-box;
    border: 2px solid ${WH};
    background: ${B};
    box-shadow: none;
  }
  /* Sitecore sets the open tab 1px left (left: -1px) over its neighbours: the page starts there too */
  .scTabstripContainer > .scTabs { left: -1px; }
  .scTabs > .scTabPage { background: transparent; border-color: transparent; }
  .scTabs .scScrollbox { ${edit} }

  /* the Content Editor's editor tabs stand on the tab row's white line */
  #EditorTabs {
    height: 57px;
    border-bottom: 2px solid ${WH};
  }
  #EditorTabs > a:is(.scRibbonEditorTabNormal, .scRibbonEditorTabActive) {
    position: relative;
    box-sizing: border-box;
    height: 22px;
    margin: 35px 2px 0 0;
    ${tabFace}
  }
  #EditorTabs > a.scRibbonEditorTabActive {
    top: 2px;
    z-index: 2;
    height: 25px;
    margin-top: 32px;
    ${tabOpen}
  }
  #EditorTabs > a.scRibbonEditorTabNormal:hover { ${buttonHover} }
  #EditorTabs > a:focus-visible { outline: 2px solid ${WH}; outline-offset: -5px; }
  #EditorTabs > a#BTAddNewSearch { width: 32px; }
  #EditorTabs > a img { filter: var(--sct-glyph-filter); }
  #EditorTabs > a:is(.scRibbonEditorTabActive, :hover) img { filter: none; }
  :is(.scEditorTabHeaderNormal, .scEditorTabHeaderActive) {
    height: auto;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: inherit;
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
    border-bottom: 2px solid ${WH};
    border-radius: 0;
    background: transparent;
  }
  .ui-tabs .ui-tabs-nav li {
    position: relative;
    top: 2px;
    height: 22px;
    margin: 0 2px 0 0;
    ${tabFace}
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active { height: 25px; z-index: 2; ${tabOpen} }
  .ui-tabs .ui-tabs-nav li.ui-state-hover:not(.ui-tabs-active) { ${buttonHover} }
  .ui-tabs .ui-tabs-nav li a {
    padding: 0 10px;
    color: inherit;
    line-height: 20px;
  }
  .ui-tabs .ui-tabs-nav li.ui-tabs-active a { line-height: 23px; }
  .ui-tabs .ui-tabs-panel { background: ${B}; }

  /* tooltips drawn as markup (SPE's qTip, jQuery UI): a small white Workbench requester */
  :is(.qtip, .ui-tooltip) {
    ${menuFrame}
    color: ${B};
    font: 12px ${FONT};
  }
  :is(.qtip, .ui-tooltip) * { color: ${B}; }

  /* ---- Start menu: Workbench's menu. White, blue text, a black frame; the columns table laid out as a
     grid: the left list spans both rows but only as tall as its items, the right one with All
     Applications under it. A row highlights inverted. ---- */
  .scStartMenuContent {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto 1fr;
    align-items: start;
    gap: 0 2px;
    box-sizing: border-box;
    height: auto;
    padding: 2px;
    background: ${WH};
  }
  :is(.scStartMenuContentColumns, .scStartMenuContentColumns > tbody, .scStartMenuContentColumns > tbody > tr) { display: contents; }
  :is(.scStartMenuLeft, .scStartMenuRight) {
    display: block;
    width: auto;
    padding: 0;
    border: 0;
    background: ${WH};
  }
  .scStartMenuLeft { grid-column: 1; grid-row: 1 / span 2; border-right: 2px solid ${B}; }
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
  /* rows: the 32px icon beside its name and description */
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 2px 6px;
    border: 0;
    border-radius: 0;
    background: ${WH};
    color: ${B};
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
    color: ${B};
    font: 12px / 15px ${FONT};
    white-space: nowrap;
  }
  .scStartMenuLeftOptionTooltip {
    color: ${B};
    font: 11px / 14px ${FONT};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scStartMenuRightFolderDisplayName { flex: 1; }
  img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) {
    float: none;
    order: 9;
    width: 16px;
    height: 16px;
    margin: 0;
    filter: none;
    ${paint(triRight(B))}
  }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):hover { background: ${B}; }
  :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):hover :is(div, span) { color: ${WH} !important; }
  :is(.scStartMenuRightFolder, .scStartMenuProgramsMenu):hover img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) { background: ${triRight()}; }
  .scStartMenuDivider {
    height: 2px;
    margin: 2px 0;
    background: ${B};
  }
  a.scStartMenuProgramsMenu {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 26px;
    margin: 2px 0 0;
    padding: 0 6px 0 10px;
    border: 0;
    border-top: 2px solid ${B};
    border-radius: 0;
    background: ${WH};
    color: ${B};
  }
  .scStartMenuProgramsMenu .scStartMenuProgramsMenuText {
    flex: 1;
    padding: 0;
    color: ${B};
    font: 12px ${FONT};
  }
  /* 10.4 still has the user band at the top and Log off at the bottom */
  :is(.scStartMenuTop, .scStartMenuBottom) {
    background: ${WH};
    color: ${B};
  }
  :is(.scStartMenuTop, .scStartMenuBottom) * { color: ${B}; }

  /* ---- Fields on tab pages (SPE Read-Variable and other tabbed dialogs) ---- */
  .scTabs :is(input:not([type]), input[type="text"], input[type="password"], input[type="number"], input[type="search"], select:not([multiple]):not([size]:not([size="1"]))) {
    box-sizing: border-box;
    height: 24px;
    min-height: 0;
    padding: 2px 6px;
    font: 12px ${FONT};
  }
  .scTabs select:not([multiple]):not([size]:not([size="1"])) { padding-right: 24px; }
  :is(.scContentControlChecklist, .scContentControlMultilistBox, .scBucketListBox, .scBucketListSelectedBox, .scContentControlTree.scScrollbox, .varRule) {
    ${edit}
  }
  .scContentControlChecklist label,
  .scRadioGroup label { font: 12px ${FONT}; color: ${WH}; }
  .scRadioGroup {
    border: 2px solid ${WH};
    border-radius: 0;
    box-shadow: none;
  }
  :is(.scContentControlMultilistHelp, .scContentControlTreeListHelp) {
    border: 0;
    background: transparent;
    color: ${WH};
  }
  /* list navigation: arrow gadgets in place of 10.x's blue chevrons */
  :is(img.scNavButton, img[id^="btnRight"], img[id^="btnLeft"], img[id^="btnUp"], img[id^="btnDown"]) {
    box-sizing: border-box;
    width: 20px;
    height: 20px;
    margin: 0 0 4px;
    border: 2px solid ${WH};
    filter: none;
  }
  :is(img.scNavButton, img[id^="btnRight"])[id*="right" i],
  img[id^="btnRight"] { ${paint(triRight())} }
  :is(img.scNavButton, img[id^="btnLeft"])[id*="left" i],
  img[id^="btnLeft"] { ${paint(triLeft())} }
  img.scNavButton[id*="_up"], img[id^="btnUp"] { ${paint(triUp())} }
  img.scNavButton[id*="_down"], img[id^="btnDown"] { ${paint(triDown())} }
  img.scNavButton:not([id]):nth-of-type(1) { ${paint(triRight())} }
  img.scNavButton:not([id]):nth-of-type(2) { ${paint(triLeft())} }
  td:last-child > img.scNavButton:not([id]):nth-of-type(1) { ${paint(triUp())} }
  td:last-child > img.scNavButton:not([id]):nth-of-type(2) { ${paint(triDown())} }
  :is(img.scNavButton, img[id^="btnRight"], img[id^="btnLeft"], img[id^="btnUp"], img[id^="btnDown"]):active { background-color: ${O}; }
  .scMultilistNav a.hovertext { color: ${WH}; }
  /* combo tables (date and time pickers, item pickers): one white frame around the field and its button */
  table.scCombobox {
    box-sizing: border-box;
    height: auto;
    min-height: 0;
    border: 2px solid ${WH};
    border-collapse: collapse;
    border-radius: 0;
    background: ${B};
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
    height: 20px !important;
    margin: 0;
    padding: 2px 6px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    background: ${B};
    font: 12px ${FONT};
  }
  table.scCombobox:focus-within { ${editFocus} }
  table.scCombobox img.scComboboxDropDown {
    display: block;
    box-sizing: border-box;
    width: 20px;
    height: 20px;
    margin: 0;
    padding: 0;
    border: 0;
    border-left: 2px solid ${WH};
    border-radius: 0;
    filter: none;
    ${paint(triDown())}
  }
  table.scCombobox img.scComboboxDropDown:hover { background-color: ${K}; }
  /* the date picker's calendar: a striped caption with the month between two arrow gadgets, the chosen day
     orange */
  table.scCalendar {
    margin: 0;
    border-collapse: collapse;
    color: ${WH};
    font: 12px ${FONT};
    background: ${B};
  }
  table.scCalendar td {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    outline: none;
    color: ${WH};
    font: 12px ${FONT};
    text-transform: none;
  }
  table.scCalendar .scCalendarYearRow td {
    height: 22px;
    padding: 0 2px;
    background: ${WH};
    color: ${B};
  }
  .scCalendarYearRow img {
    box-sizing: border-box;
    width: 20px;
    height: 18px;
    vertical-align: middle;
    border: 2px solid ${B};
    filter: none;
  }
  .scCalendarYearLeftCell img { ${paint(triLeft(B))} }
  .scCalendarYearRightCell img { ${paint(triRight(B))} }
  table.scCalendar td.scCalendarDay { border-bottom: 2px solid ${WH}; }
  table.scCalendar td:is(.scCalendarCell, .scCalendarCellOtherMonth, .scCalendarSelected, .scCalendarToday) {
    height: 18px;
    padding: 1px 5px;
    background: ${B};
    text-align: center;
  }
  table.scCalendar td.scCalendarCellOtherMonth { opacity: 0.7; }
  table.scCalendar td.scCalendarToday { text-decoration: underline; }
  table.scCalendar td:is(.scCalendarCell, .scCalendarCellOtherMonth, .scCalendarToday):hover { outline: 2px solid ${WH}; outline-offset: -2px; }
  table.scCalendar td.scCalendarSelected { ${tabOpen} }
  table.scCalendar td.scCalendarTodayCell {
    height: 20px;
    text-align: center;
    border-top: 2px solid ${WH};
    background: ${B};
  }
  ul.scTimePicker { margin: 0; padding: 0; background: ${B}; }
  ul.scTimePicker a {
    display: block;
    padding: 1px 6px;
    border: 0;
    border-radius: 0;
    outline: none;
    box-shadow: none;
    color: ${WH};
    font: 12px ${FONT};
    text-decoration: none;
  }
  ul.scTimePicker a:is(:hover, :focus, .selected, [aria-selected="true"]) { ${tabOpen} }

  /* the user and role pickers: a read-only field and its ... button at the field's height */
  input.scUserPickerEdit { ${edit} }
  button.scUserPickerButton {
    width: 30px;
    min-width: 0;
    height: 24px;
    padding: 0;
  }
  :is(.checkListActions a, .varRule a, .varRule .scLine span[style*="color"], .varRule .scLine a) { color: ${WH} !important; text-decoration: underline; }
  .varRule .scLine span,
  .varRule :is(div, span):not(:has(*)) { color: ${WH}; }
  :is(.varTitle, .varHint) { color: ${WH}; }

  /* ---- Drop-down galleries (Edit's workflow box...) open in a frame: a menu's frame ---- */
  iframe.scGalleryFrame { ${menuFrame} }
  /* Sitecore sizes the frame for its own font: the wider monospace labels made the Insert gallery scroll
     both ways (10.4). The list takes the frame's width and a label too long for it ends in an ellipsis. */
  body:has(.scGalleryGrip) .scGalleryMenu .scScrollbox { width: 0; min-width: 100%; }
  body:has(.scGalleryGrip) .scGalleryMenu .scScrollbox > a.scRibbonToolbarSmallButton { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ---- Desktop windows are bare frames in 10.x: one that isn't maximised gets Workbench's 2px white
     frame ---- */
  .DesktopArea > iframe[id^="FRAME"]:not([style*="width: 100%"]) {
    box-sizing: border-box;
    border: 2px solid ${WH};
    background: ${B};
  }

  /* ---- Bucket search (search tab, Media Library): one field with square button ends, the search terms
     as framed tokens ---- */
  .search-box {
    min-height: 0;
    ${edit}
  }
  :is(.sb_down, .sb_up, .btn-clear, .btn-search),
  :is(.sb_down, .sb_up, .btn-clear, .btn-search):hover {
    border-color: ${WH};
    border-radius: 0;
    /* transparent, so the inverting glyph filter turns only the dark glyph white over the field's blue */
    background-color: transparent;
    box-shadow: none;
    filter: var(--sct-glyph-filter);
  }
  .btn-clear { background-image: url("/sitecore/shell/Applications/Buckets/images/clear.png"); }
  .btn-search { background-image: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png"); }
  :is(.sb_down, .sb_up, .btn-clear, .btn-search):is(:hover, :active) { background-color: transparent; outline: 2px solid ${WH}; outline-offset: -2px; }
  .filters .filter {
    border: 2px solid ${WH};
    border-radius: 0;
    background: ${B};
    color: ${WH};
  }
  .filters .filter :is(.icon, .value .display-value) { background-color: transparent; color: ${WH}; }
  .filters .filter :is(.icon, .remove):hover { border-radius: 0; background-color: ${K}; }
  .filters .filter .remove { filter: var(--sct-glyph-filter); }
  .raw-user-input { background-color: transparent; }
  :is(.side .sb_filter, #results table th) { text-transform: none; }
  #views a { opacity: 0.6; }
  #views a:is(.active, :hover) { opacity: 1; filter: var(--sct-glyph-filter); }

  /* ---- Ribbon drop-down arrows: Workbench's white triangle ---- */
  .scRibbon :is(.scRibbonToolbarLargeComboButtonGlyph, .scRibbonToolbarLargeGalleryButtonGlyph, .scRibbonToolbarSmallGalleryButtonGlyph, .scRibbonToolbarSmallComboButtonGlyph) {
    width: 12px;
    height: 12px;
    border: 0;
    vertical-align: middle;
    filter: none;
    ${paint(art([tri.down(2, 4, 7)], { w: 10, h: 10 }))}
  }
  .scRibbon [class*="Disabled"] :is([class*="ComboButtonGlyph"], [class*="GalleryButtonGlyph"]) { opacity: 0.5; }
  .scRibbon :is(a, span):is(:hover, :active, [class*="ButtonDown"]) :is(.scRibbonToolbarLargeComboButtonGlyph, .scRibbonToolbarLargeGalleryButtonGlyph, .scRibbonToolbarSmallGalleryButtonGlyph, .scRibbonToolbarSmallComboButtonGlyph) {
    background: ${art([tri.down(2, 4, 7, K)], { w: 10, h: 10 })};
  }
  .scRibbonToolbar [class*="ButtonDisabled"] { opacity: 0.55; }

  /* ---- Ribbon galleries (Home > Insert, Security > Presets): list boxes, the hovered row orange ---- */
  .scRibbonGalleryList {
    ${edit}
  }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"],
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:is(:hover, :active) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: ${B};
  }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover { ${tabOpen} }
  .scRibbonGalleryList > a[class^="scRibbonToolbar"]:hover * { color: ${K}; }
  .scRibbonGalleryList > a.scRibbonToolbarLargeTextButton {
    display: block;
    float: none;
    box-sizing: border-box;
    height: 20px;
    padding: 3px 6px 2px;
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

  /* ---- Push buttons in dialogs ---- */
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
  :is(button, input[type="button"], input[type="submit"]).scButton:hover,
  .scFormDialogFooter button:hover { ${buttonHover} }
  :is(button, input[type="button"], input[type="submit"]).scButton:focus-visible,
  .scFormDialogFooter button:focus-visible { outline: 2px solid ${O}; outline-offset: 0; }
  :is(button, input[type="button"], input[type="submit"]).scButton.scButtonPrimary { ${primary} }
  :is(button, input[type="button"], input[type="submit"]).scButton:active,
  .scFormDialogFooter button:active { ${buttonDown} }
  :is(button, input[type="button"], input[type="submit"]).scButton:disabled { opacity: 0.5; background: ${B}; color: ${WH}; }
  /* ---- Dialog insets: controls close to the frame; the buttons end 8px from the corner ---- */
  .scDialogContentContainer { padding: 8px; }
  /* the right end keeps clear of the sizing gadget jQuery UI's dialog frame puts in the corner */
  .scFormDialogFooter {
    height: 40px;
    padding: 8px 24px 8px 8px;
    line-height: normal;
    border-top: 2px solid ${WH};
    border-radius: 0;
  }
  .scFormDialogFooter .footerOkCancel {
    position: static;
    float: right;
    display: flex;
    gap: 8px;
  }
  .scFormDialogFooter img#Copyright { margin: 0; filter: var(--sct-glyph-filter); }
  .scDialogContentContainer .scTabstripContainer > .scTabstrip { height: 25px; border-bottom: 0; }
  .scDialogContentContainer .scTabstripContainer > .scTabs { top: 25px; }

  /* ---- Any other text field keeps its size but takes Workbench's frame ---- */
  input:is(:not([type]), [type="text"], [type="search"], [type="password"], [type="number"], [type="email"], [type="url"]):not(.ace_editor *, .terminal *),
  textarea:not(.ace_editor *, .terminal *) {
    border: 2px solid ${WH};
    border-radius: 0;
    box-shadow: none;
    caret-color: ${O};
  }
  input:is(:not([type]), [type="text"], [type="search"], [type="password"], [type="number"], [type="email"], [type="url"]):not(.ace_editor *, .terminal *):focus,
  textarea:not(.ace_editor *, .terminal *):focus { ${editFocus} }
  :is(input, textarea)::placeholder { color: ${WH}; opacity: 0.8; }

  /* ---- Drop-down lists: a field with the arrow end ---- */
  select:not([multiple]):not([size]:not([size="1"])) {
    appearance: none;
    padding-right: 24px;
    ${edit}
    background: ${comboRight}, ${B};
  }
  select:focus { ${editFocus} }
  select[multiple], select[size]:not([size="1"]) { ${edit} }
  option:checked { background: ${O}; color: ${K}; }

  /* ---- The Workbox's caption band ---- */
  .scWorkboxWindowCaption {
    background: ${B};
    border-bottom: 2px solid ${WH};
  }

  /* ---- Grids (User Manager, Role Manager...): a list under white column headings, the selected row
     orange ---- */
  .Grid {
    border: 2px solid ${WH};
    background: ${B};
  }
  .HeadingCell {
    padding: 3px 8px;
    border: 0;
    border-right: 2px solid ${B};
    background: ${WH};
    color: ${B};
  }
  .HeadingCell::after { content: none; }
  .HeadingCell * { color: ${B}; }
  :is(.Row, .Row:nth-child(odd)) { background: ${B}; }
  .Row:hover { background: ${K}; }
  :is(.Row, .SelectedRow) td.DataCell {
    padding: 2px 8px;
    border: 0;
    color: ${WH};
  }
  .SelectedRow td.DataCell,
  .SelectedRow td.DataCell * { ${tabOpen} }
  .GridFooter img[src*="/grid/pager/"] {
    box-sizing: border-box;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 2px solid ${WH};
    filter: none;
  }
  .GridFooter img[src*="/grid/pager/first"] { ${paint(art([bar(4, 4, 2, 7), tri.left(7, 4, 7)], { w: 15, h: 15 }))} }
  .GridFooter img[src*="/grid/pager/prev"] { ${paint(triLeft())} }
  .GridFooter img[src*="/grid/pager/next"] { ${paint(triRight())} }
  .GridFooter img[src*="/grid/pager/last"] { ${paint(art([tri.right(4, 4, 7), bar(9, 4, 2, 7)], { w: 15, h: 15 }))} }
  .GridFooter.scGridFooter img:active { width: 22px; height: 22px; padding: 0; background-color: ${O}; }
  :is([style*="slider_bg" i], [background*="slider_bg" i]) {
    background: linear-gradient(${WH}, ${WH}) center / 100% 2px no-repeat !important;
  }

  /* ---- Fields in dialogs ---- */
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) :is(input:not([type]), input[type="text"], input[type="password"], input[type="search"], input[type="number"], select:not([multiple]):not([size])) {
    box-sizing: border-box;
    height: 24px !important;
    min-height: 0;
    padding: 2px 6px;
    ${edit}
    font: 12px ${FONT};
  }
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) select:not([multiple]):not([size]) { background: ${comboRight}, ${B}; padding-right: 24px; }
  :is(.scFormDialogContent, .scDialogContentContainer, .scWizardPageContainer) textarea {
    ${edit}
    font: 12px ${FONT};
  }

  /* ---- Light leftovers Sheer UI writes inline in spellings the shared map does not know ---- */
  :is([style*="background:white" i], [style*="background: white" i], [style*="background-color:white" i], [style*="background-color: white" i], [style*="background:window" i], [style*="background: window" i], [style*="background-color:window" i], [style*="background-color: window" i]) {
    background-color: ${B} !important;
  }
  :is([style*="background:#e3e3e3" i], [style*="background: #e3e3e3" i], [style*="background-color:#e3e3e3" i]) { background-color: ${WH} !important; }
  /* hidden and system items in the trees are marked with an inline #666 */
  :is([style*="color:#666666" i], [style*="color: #666666" i]) { color: ${WH} !important; opacity: 0.75; }
  /* soft glows round the tree and editor panes become the 2px white frame */
  #ContentTreePanel > div[style*="box-shadow"] { box-shadow: none !important; }
  /* SPEAK's application header in shell pages (PowerShell Reports): the striped title bar */
  .sc-applicationHeader-row1 {
    box-sizing: border-box;
    height: 24px;
    padding: 2px 0 2px 8px;
    border-bottom: 2px solid ${WH};
    background: var(--lg-stripes) 0 4px / 100% 16px no-repeat, ${B};
  }
  .sc-applicationHeader-row1 .sc-applicationHeader-content { height: 20px; padding: 0; }
  .sc-applicationHeader-row1 .sc-applicationHeader-title { float: none; margin: 0; padding: 0; }
  .sc-applicationHeader-row1 .sc-applicationHeader-title .sc-text { ${titleGap} margin: 0; height: 20px; line-height: 20px; }
  /* the Rich Text preview and Ace scrollbars inside the editor filter */
  .ace_editor { scrollbar-color: #888888 #ffffff; }
}`;

// ---- SPEAK and Launchpad: fonts, push buttons, check boxes ----
const speakCommon = (S, h) => `${S} body, ${S} input, ${S} button, ${S} select, ${S} textarea,
${S} :is(h1, h2, h3, h4, h5, h6, p, a, span, label, li, td, th, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${scrollbars(S)}
${header(S, h)}
${S}:not(#sct-lg) .btn.sc-button {
  box-sizing: border-box;
  min-width: 75px;
  height: 24px;
  margin: 0;
  padding: 0 10px;
  ${button}
  line-height: 20px;
}
${S}:not(#sct-lg) .btn.sc-button:hover { ${buttonHover} }
${S}:not(#sct-lg) .btn.sc-button:focus { background: ${B}; color: ${WH}; border-color: ${WH}; }
${S}:not(#sct-lg) .btn.sc-button.btn-primary { ${primary} }
${S}:not(#sct-lg) .btn.sc-button:active { ${buttonDown} }
${S}:not(#sct-lg) .btn.sc-button:focus-visible { outline: 2px solid ${O}; outline-offset: 0; }
${S}:not(#sct-lg) .btn.sc-button:is(:disabled, .disabled) { opacity: 0.5; }
${S}:not(#sct-lg) .btn.sc-button .sc-button-text { color: inherit; font: inherit; }
${S}:not(#sct-lg) :is(input:not([type]), input[type="text"], input[type="search"], input[type="password"], textarea, .form-control) {
  border: 2px solid ${WH};
  border-radius: 0;
  box-shadow: none;
  caret-color: ${O};
}
${S}:not(#sct-lg) :is(input:not([type]), input[type="text"], input[type="search"], input[type="password"], textarea, .form-control):focus { ${editFocus} }
${checks(S)}`;

// ---- SPEAK pages ----
const S = T("speak");
const speak = `/* Los Gatos: SPEAK pages. Generated by tools/build-losgatos-css.cjs. */
${stripesVars}
${speakCommon(S, 49)}

/* ---- Experience Editor ribbon: dressed as the Content Editor's ribbon in this theme. The tabs are
   outlined, the open one orange; the strip blue with white lines between the groups. ---- */
${W("speak")} .sc-pageeditbar {
  font: 12px ${FONT};
  color: ${WH};

  .sc-quickbar {
    display: flow-root;
    height: auto;
    padding: 4px 4px 0;
    border: 0;
    border-bottom: 2px solid ${WH};
    box-shadow: none;
    background: ${B};
  }
  .sc-quickbar-item {
    float: left;
    box-sizing: border-box;
    height: 24px;
    margin: 0 2px 0 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: ${WH};
    font: 12px ${FONT};
    line-height: 22px;
    text-transform: none;
    text-decoration: none;
    cursor: default;
  }
  .sc-quickbar-item:focus { outline: none; }
  .sc-quickbar-item:focus-visible { outline: 2px solid ${WH}; outline-offset: -5px; }
  .sc-quickbar-tab {
    position: relative;
    top: 2px;
    padding: 0 12px;
    ${tabFace}
  }
  .sc-quickbar-tab:hover { ${buttonHover} }
  .sc-quickbar-tab.sc-quickbar-tab-selected { ${tabOpen} }
  .sc-quickbar-button {
    width: 24px;
    height: 24px;
    margin: 0 1px;
    padding: 2px;
    border: 2px solid transparent;
    opacity: 1;
  }
  .sc-quickbar-button > .sprite-speak-ribbon-clean-ee {
    display: block;
    margin: 0;
  }
  .sc-quickbar-button:not(.disabled):hover { border-color: ${WH}; }
  .sc-quickbar-button:not(.disabled):active { background: ${O}; }
  .sc-quickbar-button.disabled > * { opacity: 0.45; }

  .sc-ribbon {
    margin: 0;
    padding: 0;
    border: 0;
    border-bottom: 2px solid ${WH};
    box-shadow: none;
    background: ${B};
  }
  /* no display here: Sitecore switches strips with jQuery hide and show */
  .sc-strip {
    height: 72px;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
  .sc-chunk {
    display: block;
    float: left;
    box-sizing: border-box;
    height: 72px;
    margin: 0;
    padding: 0 5px;
    border: 0;
    border-right: 2px solid ${WH};
    border-radius: 0;
    box-shadow: none;
    background: ${B};
    white-space: nowrap;
  }
  .sc-chunk::before,
  .sc-chunk::after { content: none; }
  .sc-chunk-button-list {
    display: flow-root;
    height: 46px;
    margin: 3px 0 0;
    padding: 0;
  }
  .sc-chunk-label {
    height: 18px;
    margin: 2px 0 0;
    padding: 0;
    color: ${WH};
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
    padding: 2px 5px 1px;
    border: 2px solid transparent;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: ${WH};
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
    background: ${B};
    border-color: ${WH};
  }
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed {
    ${tabOpen}
    border-color: ${WH};
  }
  .disabled :is(.sc-chunk-button-label, .sc-chunk-check-small-label),
  :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small).disabled {
    opacity: 0.55;
  }

  /* small buttons, two to a column */
  .sc-chunk-button-small-list {
    float: left;
    margin: 1px 0 0;
    padding: 0;
  }
  .sc-chunk-check-list {
    display: flow-root;
    float: left;
    height: 44px;
    margin: 1px 0 0;
    padding: 0;
  }
  .sc-chunk-button-small,
  .sc-chunk-check-small {
    display: block;
    box-sizing: border-box;
    height: 22px;
    margin: 0;
    padding: 1px 4px;
    border: 2px solid transparent;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: ${WH};
    line-height: 16px;
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
    line-height: 16px;
  }
  :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton)::after { content: none; }
  :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton) .sc-chunk-button-label::after {
    content: "";
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-left: 2px;
    vertical-align: -2px;
    background: ${art([tri.down(2, 4, 7)], { w: 10, h: 10 })};
  }
  :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton):is(:active, .pressed) .sc-chunk-button-label::after {
    background: ${art([tri.down(2, 4, 7, K)], { w: 10, h: 10 })};
  }

  /* the preview date: a field between two arrow gadgets, inside the 46px row */
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
    width: 20px;
    height: 40px;
    margin: 0;
    padding: 0;
    border: 2px solid ${WH};
    border-radius: 0;
  }
  a.sc-chunk-datepanel-changedate[data-sc-adddays^="-"] { background: ${triLeft()}, ${B}; }
  a.sc-chunk-datepanel-changedate:not([data-sc-adddays^="-"]) { background: ${triRight()}, ${B}; }
  a.sc-chunk-datepanel-changedate:active { background-color: ${O}; }
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
    color: ${WH};
    font: 12px ${FONT};
    line-height: 1.15;
  }
  .sc-chunk-datepanel-selector:focus-visible { outline: 2px solid ${O}; outline-offset: 0; }
  .sc-chunk-datepanel-day { display: none; }
  .sc-chunk-datepanel-date { font: bold 16px ${FONT}; }
  .sc-chunk-datepanel-monthyear { text-align: center; }

  /* the item path under the ribbon: a blue strip with outlined buttons */
  .sc-breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    height: 32px;
    min-height: 0;
    margin: 0;
    padding: 0 4px;
    border: 0;
    border-bottom: 2px solid ${WH};
    box-shadow: none;
    background: ${B};
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
    color: ${WH};
    font: 12px ${FONT};
  }
  .sc-breadcrumb-item-button,
  .sc-breadcrumb-item-action {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 24px;
    margin: 0;
    padding: 2px;
    border: 2px solid transparent;
    border-radius: 0;
  }
  :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { border-color: ${WH}; }
  .sc-breadcrumb .separator_7 { filter: var(--sct-glyph-filter); }
}

/* ---- SPEAK dialogs (the EE's Preview Date and Time, ...): the header is a window's striped title bar
   with the title in its white gap ---- */
${W("speak")} .sc-dialogWindow-header {
  height: auto;
  padding: 0;
  border: 0;
  background: ${B};
  color: ${WH};
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title {
  display: block;
  float: none;
  box-sizing: border-box;
  width: auto;
  height: 20px;
  margin: 0;
  padding: 0 0 0 32px;
  border-bottom: 2px solid ${WH};
  background: ${stripes()};
  box-sizing: content-box;
}
${W("speak")} .sc-dialogWindow-header .sc-dialogWindow-header-title .sc-text {
  ${titleGap}
  max-width: calc(100% - 70px);
}
${W("speak")} .sc-dialogWindow-header > .sc-text-title {
  display: block;
  padding: 6px 10px;
  color: ${WH};
  font: 12px / 16px ${FONT};
}
${W("speak")} .sc-dialogWindow-buttons {
  border-top: 2px solid ${WH};
  background: ${B};
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker) {
  box-sizing: border-box;
  height: 24px;
  min-height: 0;
  padding: 2px 24px 2px 6px;
  ${edit}
  background: ${comboRight}, ${B};
  font: 12px ${FONT};
}
${W("speak")} :is(input.sc-datepicker, input.sc-timepicker):focus { ${editFocus} }
${W("speak")} #ui-datepicker-div.ui-datepicker {
  padding: 0;
  border: 2px solid ${WH};
  border-radius: 0;
  box-shadow: none;
  background: ${B};
  color: ${WH};
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
  background: ${WH};
}
${W("speak")} .ui-datepicker .ui-datepicker-title {
  order: 1;
  margin: 0;
  color: ${B};
  font: 12px / 22px ${FONT};
  text-transform: none;
}
${W("speak")} .ui-datepicker .ui-datepicker-title * { color: ${B}; font: inherit; text-transform: none; }
${W("speak")} .ui-datepicker :is(.ui-datepicker-prev, .ui-datepicker-next) {
  position: static;
  box-sizing: border-box;
  width: 20px;
  height: 18px;
  border: 2px solid ${B};
  border-radius: 0;
  cursor: default;
}
${W("speak")} .ui-datepicker .ui-datepicker-prev,
${W("speak")} .ui-datepicker .ui-datepicker-prev:hover { order: 0; background: ${triLeft(B)}, ${WH}; }
${W("speak")} .ui-datepicker .ui-datepicker-next,
${W("speak")} .ui-datepicker .ui-datepicker-next:hover { order: 2; background: ${triRight(B)}, ${WH}; }
${W("speak")} .ui-datepicker :is(.ui-datepicker-prev, .ui-datepicker-next) span { display: none; }
${W("speak")} .ui-datepicker table.ui-datepicker-calendar { margin: 0; border-collapse: collapse; border-spacing: 0; background: ${B}; }
${W("speak")} .ui-datepicker tr { height: auto; }
${W("speak")} .ui-datepicker th {
  height: auto;
  padding: 2px 4px;
  line-height: 16px;
  border: 0;
  border-bottom: 2px solid ${WH};
  background: ${B};
  color: ${WH};
  font: 12px ${FONT};
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
  background: ${B};
  color: ${WH};
  font: 12px / 16px ${FONT};
  text-align: center;
}
${W("speak")} .ui-datepicker td.ui-datepicker-other-month :is(a, span) { opacity: 0.7; }
${W("speak")} .ui-datepicker td.ui-datepicker-today a { text-decoration: underline; }
${W("speak")} .ui-datepicker td a:hover { outline: 2px solid ${WH}; outline-offset: -2px; background: ${B}; }
${W("speak")} .ui-datepicker td.ui-datepicker-current-day a,
${W("speak")} .ui-datepicker td a.ui-state-active { ${tabOpen} }
${W("speak")} .ui-timepicker-wrapper {
  border: 2px solid ${WH};
  border-radius: 0;
  box-shadow: none;
  background: ${B};
}
${W("speak")} .ui-timepicker-list li {
  padding: 1px 6px;
  color: ${WH};
  font: 12px ${FONT};
}
${W("speak")} .ui-timepicker-list li:hover,
${W("speak")} .ui-timepicker-list li.ui-timepicker-selected { ${tabOpen} }

/* ---- Control Panel: a Workbench window. The page title sits in the striped title bar, Back is a
   gadget-row button, and each group a drawer window with its tasks as a list. ---- */
${W("speak")} body:has(.sc-controlpanel-box) {
  background: ${B};

  .sc-applicationContent {
    min-height: 100vh;
    background: ${B};
    color: ${WH};
    font: 12px ${FONT};
  }
  .sc-applicationHeader {
    border: 0;
    box-shadow: none;
    background: none;
  }
  .sc-applicationHeader-row1 {
    box-sizing: border-box;
    height: 24px;
    padding: 2px 0;
    border-bottom: 2px solid ${WH};
    background: ${stripes(20)};
    background-position: 0 4px, 0 0;
  }
  .sc-applicationHeader-row1 .sc-applicationHeader-content {
    height: 20px;
    padding: 0 15px;
  }
  .sc-applicationHeader-title {
    float: none;
    margin: 0;
    padding: 0;
  }
  .sc-applicationHeader-title .sc-text { ${titleGap} margin: 0; height: 20px; line-height: 20px; }
  .sc-applicationHeader-row2 {
    display: flow-root;
    box-sizing: border-box;
    height: auto;
    padding: 4px;
    border: 0;
    background: ${B};
  }
  .sc-applicationHeader-back { height: auto; margin: 0; padding: 0; }
  .btn.sc-backbutton {
    display: inline-block;
    box-sizing: border-box;
    height: 24px;
    margin: 0;
    padding: 0 10px;
    ${button}
  }
  .btn.sc-backbutton::before,
  .btn.sc-backbutton::after,
  .sc-applicationHeader-row1::after { content: none; }
  .sc-backbutton-text {
    position: static;
    height: 20px;
    margin: 0;
    padding: 0;
    color: inherit;
    font: 12px ${FONT};
    line-height: 20px;
  }
  .btn.sc-backbutton:is(:hover, :focus-visible) { ${buttonHover} outline: none; }
  .btn.sc-backbutton:active { ${buttonDown} }
  .sc-applicationContent-main {
    margin-top: 8px;
    background: none;
  }
  .sc-controlpanel-box {
    margin: 8px 0 0;
    padding: 0;
    border: 2px solid ${WH};
    background: ${B};
    box-shadow: none;
  }
  .sc-controlpanel-box-header h4 {
    box-sizing: border-box;
    height: 22px;
    margin: 0;
    padding: 0 0 0 8px;
    border-bottom: 2px solid ${WH};
    background: ${stripes(20)};
    color: ${B};
    font: 12px ${FONT};
    line-height: 20px;
    text-transform: none;
  }
  .sc-controlpanel-box-header h4 { padding-top: 2px; line-height: 16px; white-space: nowrap; overflow: hidden; }
  .sc-controlpanel-box-header h4::first-line { background: ${WH}; }
  .sc-controlpanel-box-header h4::before,
  .sc-controlpanel-box-header h4::after { content: "\\a0"; }
  .sc-controlpanel-box-header h4 img { display: none; }
  .sc-controlpanel-box-content {
    padding: 4px;
    border: 0;
    box-shadow: none;
    background: ${B};
  }
  .sc-controlpanel-box-content li {
    height: auto;
    padding: 0;
    border: 0;
  }
  .sc-controlpanel-box-content a {
    display: block;
    padding: 1px 4px;
    color: ${WH};
    font: 12px ${FONT};
    line-height: 16px;
    text-decoration: none;
    white-space: nowrap;
  }
  .sc-controlpanel-box-content a:is(:hover, :focus) { ${tabOpen} outline: none; }
}`;

// ---- Launchpad: Workbench itself. The page is the blue screen under the white screen title bar; each
// group a drawer, opened as a Workbench window: a 2px white frame, its striped title bar with the group's
// name in the white gap, the applications inside as icons with their names under them. A drawer window's
// gadgets are left out: none of them would do anything here. The icon under the mouse or the focus is
// selected: its name in Workbench's orange. ----
const L = T("launchpad");
const icon = (href, url) => `  .sc-launchpad-item${href} .icon img { content: url("${url}"); }`;
const launchpad = `/* Los Gatos: Launchpad. Generated by tools/build-losgatos-css.cjs. */
${stripesVars}
${speakCommon(L, 47)}
${W("launchpad")} {
  body,
  .sc-applicationContent {
    background: ${B};
    color: ${WH};
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
    color: ${B};
    font-family: ${FONT};
    font-size: 12px;
    font-weight: normal;
  }
  .sc-globalHeader a.sc-global-logo,
  .sc-globalHeader a.sc-global-logo:hover { margin-top: 0; }

  .sc-applicationContent-main {
    max-width: none;
    margin: 8px 0 0;
    padding: 0;
    background: none;
  }
  .sc-applicationContent-main > .row {
    margin: 0;
    padding: 0;
  }
  .sc-applicationContent-main > .row > div {
    float: none;
    width: auto;
    padding: 0;
  }

  /* 10.x lays the column out as a grid with the groups in a narrow first track */
  div[data-sc-id="ColumnPanel1"] { display: block; }
  /* the drawers, side by side as windows opened on the screen */
  .sc-launchpad {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    float: none;
    width: 100% !important;
    box-sizing: border-box;
    max-width: none;
    margin: 0 0 8px;
    padding: 0;
  }
  .sc-launchpad-group {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    box-sizing: border-box;
    min-width: 0;
    margin: 0;
    padding: 0 4px 6px;
    border: 2px solid ${WH};
    background: ${B};
  }
  .sc-launchpad-group-title {
    flex: 0 0 calc(100% + 8px);
    box-sizing: border-box;
    height: 22px;
    margin: 0 -4px 6px;
    padding: 0 8px;
    border-bottom: 2px solid ${WH};
    background: ${stripes(20)};
    color: ${B};
    font: 12px / 16px ${FONT};
    text-transform: none;
    white-space: nowrap;
    overflow: hidden;
  }
  /* the name in the white gap: the title is a text node, so its first line carries the gap */
  .sc-launchpad-group-title::first-line { background: ${WH}; }
  .sc-launchpad-group-title::before,
  .sc-launchpad-group-title::after { content: "\\a0"; }
  .sc-launchpad-group-title { padding-top: 2px; }

  /* applications as Workbench icons: the 32px icon, its name under it */
  .sc-launchpad-item,
  .sc-launchpad-item:is(:hover, :active, :focus) {
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    width: 96px;
    height: auto;
    min-height: 64px;
    margin: 2px 0 4px;
    padding: 2px 0 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: none;
    color: ${WH};
    outline: none;
    text-decoration: none;
  }
  .sc-launchpad-item .icon {
    display: block;
    width: 32px;
    height: 32px;
    margin: 0 0 4px;
    padding: 0;
    border-radius: 0;
    background: none;
  }
  .sc-launchpad-item .icon img {
    display: block;
    width: 32px;
    height: 32px;
    margin: 0;
    filter: none;
  }
  .sc-launchpad-item .sc-launchpad-text {
    float: none;
    max-width: 92px;
    padding: 0 2px;
    color: ${WH};
    font: 12px / 14px ${FONT};
    text-align: center;
    white-space: normal;
  }
  .sc-launchpad-item:is(:hover, :focus-visible) .sc-launchpad-text { ${tabOpen} }
  .sc-launchpad-item:active .icon img { filter: invert(1); }
  .sc-launchpad-item:focus-visible .sc-launchpad-text { outline: 2px solid ${WH}; outline-offset: 0; }
  /* applications the start menu also lists take its colour icons */
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
  /* Custom Analytics: a requester window under the drawers, its label the title */
  .sc-text[data-sc-id="CustomAnalyticsLabel"] {
    position: relative;
    z-index: 1;
    display: block;
    float: none;
    box-sizing: border-box;
    height: 22px;
    margin: 0 0 -24px;
    padding: 2px 8px 0;
    border: 2px solid ${WH};
    border-bottom: 2px solid ${WH};
    background: ${stripes(20)};
    color: ${B};
    font: 12px / 16px ${FONT};
    text-transform: none;
    white-space: nowrap;
    overflow: hidden;
  }
  .sc-text[data-sc-id="CustomAnalyticsLabel"]::first-line { background: ${WH}; }
  .sc-text[data-sc-id="CustomAnalyticsLabel"]::before,
  .sc-text[data-sc-id="CustomAnalyticsLabel"]::after { content: "\\a0"; }
  .sc-border[data-sc-id="FallBackMessageBorder"] {
    float: none;
    box-sizing: border-box;
    width: auto;
    margin: 0;
    padding: 24px 0 0;
    border: 2px solid ${WH};
    background: ${B};
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
  .sc-text[data-sc-id="FallBackMessage"] {
    position: static;
    display: block;
    color: ${WH};
    font: 12px / 16px ${FONT};
    text-align: left;
  }
}`;

// ---- Login: the Workbench screen with a requester window: the striped title bar, fields and an OK
// button in Workbench's outlines. ----
const LG = W("login");
const login = `/* Los Gatos: login. Generated by tools/build-losgatos-css.cjs. */
${stripesVars}
${LG} body {
  background: ${B};
  color: ${WH};
  font: 12px ${FONT};
}
${LG} :is(label, a, input, button, span, div, p, li) {
  font-family: ${FONT};
  text-shadow: none;
}
${LG} .main {
  max-width: 440px;
  padding: 0;
  border: 2px solid ${WH};
  border-radius: 0;
  background: ${B};
  box-shadow: none;
}
${LG} .main::before {
  content: "\\a0Sitecore Workbench\\a0";
  display: block;
  box-sizing: border-box;
  height: 22px;
  padding: 2px 0 0 32px;
  border-bottom: 2px solid ${WH};
  background: ${stripes(20)};
  color: ${B};
  font: 12px / 16px ${FONT};
}
${LG} .main::first-line { background: ${WH}; }
${LG} .logo-wrap { margin: 16px 0 12px; }
${LG} .logo-wrap img {
  height: 36px;
  width: auto;
  filter: brightness(0) invert(1);
}
${LG} :is(.login-page, .logged-out, .main > :not(.logo-wrap)) { padding: 0 16px 12px; }
${LG} label {
  margin: 0 0 3px;
  color: ${WH};
  font-size: 12px;
  font-weight: normal;
}
${LG} .form-control {
  box-sizing: border-box;
  height: 26px;
  margin: 0 0 8px;
  padding: 2px 6px;
  ${edit}
  font-size: 12px;
}
${LG} .form-control::placeholder { color: ${WH}; opacity: 0.8; }
${LG} .form-control:focus { ${editFocus} }
${LG} .btn {
  display: block;
  box-sizing: border-box;
  width: auto;
  min-width: 75px;
  height: 26px;
  margin: 4px 0 0 auto;
  padding: 0 14px;
  ${button}
  line-height: 22px;
}
${LG} .btn.btn-primary { ${primary} }
${LG} .btn:hover { ${buttonHover} }
${LG} .btn:focus { background: ${B}; color: ${WH}; border-color: ${WH}; }
${LG} .btn:active { ${buttonDown} }
${LG} .btn:focus-visible { outline: 2px solid ${O}; outline-offset: 0; }
${LG} a,
${LG} a:is(:hover, :focus) {
  color: ${WH};
  text-decoration: underline;
}
${LG} .remember-me + .forgot-password::before,
${LG} .vertical-separator { border-left-color: ${WH}; }
${checks(T("login"))}
${LG} .remember-me input[type="checkbox"] { position: static; margin: 0 6px 0 0; vertical-align: -3px; }
${LG} .warning { ${edit} }
${LG} .top {
  border: 2px solid ${WH};
  box-shadow: none;
  background: ${B};
}
${LG} .top > a { color: ${WH}; }
`;

// ---- Shell ----
const css = `/* Los Gatos: classic shell. Generated by tools/build-losgatos-css.cjs.
   Amiga Workbench 1.3: four colours, 2px white frames, striped title bars, gadgets. */
${stripesVars}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${scrollbars(P)}
/* the rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 16px; height: 16px; background: ${B}; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-track { background: ${B}; box-shadow: inset 0 0 0 2px ${WH}; border-radius: 0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { background: ${WH}; border: 4px solid ${B}; border-radius: 0; background-clip: padding-box; }

/* ---- Ribbon tabs: outlined tabs on the blue, the open one the orange fill ---- */
${P} .scRibbonNavigator { background: ${B}; border-bottom: 2px solid ${WH}; }
${P} .scRibbon a.scRibbonNavigatorButtonsNormal,
${P} .scRibbon a.scRibbonNavigatorButtonsActive,
${P} .scRibbon a.scRibbonNavigatorButtonsContextualNormal,
${P} .scRibbon a.scRibbonNavigatorButtonsContextualActive {
  position: relative;
  top: 2px;
  margin-right: 2px;
  ${tabFace}
}
${P} .scRibbon a.scRibbonNavigatorButtonsNormal:hover,
${P} .scRibbon a.scRibbonNavigatorButtonsContextualNormal:hover { ${buttonHover} }
${P} .scRibbon :is(a.scRibbonNavigatorButtonsActive, a.scRibbonNavigatorButtonsContextualActive) { ${tabOpen} z-index: 2; }
${P} .scRibbon :is(a.scRibbonNavigatorButtonsNormal, a.scRibbonNavigatorButtonsActive, a.scRibbonNavigatorButtonsContextualNormal, a.scRibbonNavigatorButtonsContextualActive) * { color: inherit; }
${P} .scRibbon :is(a.scRibbonNavigatorButtonsNormal, a.scRibbonNavigatorButtonsActive):focus-visible { outline: 2px solid ${WH}; outline-offset: -5px; }

/* ---- Ribbon toolbar: blue, the groups divided by 2px white lines; a button gets the white outline under
   the mouse and the orange fill pressed or toggled on ---- */
${P} .scRibbonToolbar { background: ${B}; border-bottom: 2px solid ${WH}; }
${P} .scRibbonToolbar .chunk { height: auto; background: ${B}; border: 0; border-right: 2px solid ${WH}; border-radius: 0; box-shadow: none; margin: 0; }
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: ${WH}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: ${WH}; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"], span[class^="scRibbonToolbar"][class*="Disabled"], .scRibbonToolbarLargeComboButton, .scRibbonToolbarSmallComboButton) { border: 2px solid transparent; border-radius: 0; box-shadow: none; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):hover { background: ${B}; border-color: ${WH}; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:not([class*="ComboButton"]), .scRibbonToolbarSmallComboButton):active,
${P} .scRibbonToolbar a[class^="scRibbonToolbar"][class*="ButtonDown"],
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButtonDown { ${tabOpen} border-color: ${WH}; }
${P} .scRibbonToolbar :is(a[class^="scRibbonToolbar"]:active, a[class*="ButtonDown"], .scRibbonToolbarLargeComboButtonDown) :is(span, div, .header) { color: ${K}; }
${P} .scRibbonToolbar a[class*="ComboButton"]:is(:hover, :active) { background: transparent; border-color: transparent; box-shadow: none; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom) { background: ${B}; border-color: ${WH}; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom):active { ${tabOpen} border-color: ${WH}; }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > :is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom):active * { color: ${K}; }
${P} a.scSystemMenu { filter: var(--sct-glyph-filter); }

/* ---- Content tree: blue, the selected node the orange fill with black text ---- */
${P} .scContentTree { background: ${B}; }
${P} a.scContentTreeNodeActive { background: ${O}; color: ${K}; border-radius: 0; outline: none; }
${P} a.scContentTreeNodeActive:focus-visible { outline: 2px solid ${WH}; outline-offset: 0; }
${P} :is(a.scContentTreeNodeActive, a.scContentTreeNodeActive *) { color: ${K} !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; outline: 2px solid ${WH}; outline-offset: -2px; }
/* The [+]/[-] box is a real 9px bordered box, margined out to the stock 16px footprint: borders snap to
   device pixels at 125%, gradient edges smear. */
${P} img[src*="/treemenu_"] {
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  margin: 4px 3px 3px 4px;
  border: 1px solid ${WH};
  object-fit: none;
  object-position: -999px -999px;
  filter: none;
}
/* Default.css gives tree glyphs a 5px 0 margin */
${P} .scContentTreeNode > img[src*="/treemenu_"] { margin: 9px 3px 8px 4px; }
${P} img[src*="/treemenu_collapsed"] {
  background: linear-gradient(${WH}, ${WH}) center / 1px 5px no-repeat, linear-gradient(${WH}, ${WH}) center / 5px 1px no-repeat, ${B};
}
${P} img[src*="/treemenu_expanded"] { background: linear-gradient(${WH}, ${WH}) center / 5px 1px no-repeat, ${B}; }

/* ---- Editor: section headers are white bars with blue text, as Workbench's screen title ---- */
${P} .scEditorHeaderTitle { font-size: 14px; color: ${WH}; }
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  background: ${WH};
  color: ${B};
  line-height: 20px;
  padding: 0 0 0 6px;
  margin: 0;
  border: 0;
}
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed) * { color: ${B}; }
${P} img.scEditorSectionCaptionGlyph { width: 16px; height: 16px; margin: 2px 4px 0 0; filter: none; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(triUp(B))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(triDown(B))} }
${P} .scEditorSectionPanel { border: 2px solid ${WH}; border-top: 0; }
${P} .scEditorFieldLabel { color: ${WH}; }
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
${P} .scButton:hover, ${P} button:not(.ui-button):hover { ${buttonHover} }
${P} .scButton:active, ${P} button:not(.ui-button):active { ${buttonDown} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 2px solid ${O}; outline-offset: 0; }

/* ---- Bottom application tabs ---- */
${P} .scPager { display: flex; align-items: center; box-sizing: border-box; width: auto; height: 40px; margin: 0; border: 0; border-radius: 0; padding: 0 4px; background: ${B}; border-top: 2px solid ${WH}; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive { box-sizing: border-box; height: 26px; padding: 0 10px; ${button} line-height: 22px; margin: 0 4px 0 0; }
${P} .scPagerButtonNormal:hover { ${buttonHover} }
${P} .scPagerButtonActive { ${tabOpen} }
${W("shell")} a.scPagerButtonNormal:is(:link, :visited) { color: ${WH}; }
${W("shell")} a.scPagerButtonNormal:is(:link, :visited):hover { color: ${B}; }
${W("shell")} a.scPagerButtonActive:is(:link, :visited) { ${tabOpen} }

/* ---- Dialog windows (jQuery UI frames around Sitecore dialogs): a Workbench window. The 2px white
   frame; the dialog page's header is the striped title bar, the jQuery title bar laid over it carries
   the close gadget on the left and the depth gadgets on the right. ---- */
${P} .ui-dialog {
  background: ${B};
  border: 2px solid ${WH};
  border-radius: 0;
  padding: 0;
  box-shadow: none;
}
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  ${gadget(G.front)}
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > *:active { ${gadgetDown} }
/* Sitecore pins the pane with !important and writes the close button's position inline. */
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
  background: ${G.close}, ${WH};
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button:active { background-color: ${O}; }
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: ${G.front}, ${WH}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: ${G.back}, ${WH}; }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: ${G.zoom}, ${WH}; }
/* the sizing gadget, where jQuery UI lets the dialog be resized */
${P} .ui-dialog .ui-resizable-se {
  right: 0;
  bottom: 0;
  width: 18px;
  height: 17px;
  border: 2px solid ${B};
  border-right: 0;
  border-bottom: 0;
  background: ${G.size}, ${WH};
  z-index: 3;
}
/* Workbench never dimmed the screen behind a requester; a faint shade still marks it modal */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.2); opacity: 1; }

/* Inside a dialog page: its header is the striped title bar, the title in its white gap after the close
   gadget's room */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: ${B}; padding: 0; border: 0; border-bottom: 2px solid ${WH}; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeader,
${P} .ui-dialog > .ui-dialog-titlebar + .DialogHeader {
  box-sizing: border-box;
  height: 20px;
  margin: 0;
  padding: 2px 80px 0 30px;
  background: ${stripes()};
  color: ${B};
  font: 12px / 16px ${FONT};
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
}
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .ui-dialog-titlebar + .DialogHeader)::first-line { background: ${WH}; }
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .ui-dialog-titlebar + .DialogHeader)::before,
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .ui-dialog-titlebar + .DialogHeader)::after { content: "\\a0"; }
${P} .ui-dialog > .ui-dialog-titlebar + .DialogHeader { border-bottom: 2px solid ${WH}; height: 22px; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: ${WH}; padding: 6px 10px 8px; margin: 0; }
/* SPE puts a 32px icon in the caption; Workbench titles are one line of text */
${P} .DialogHeader #DialogIcon { display: none; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter { background: ${B}; }

/* ---- Window gadgets: close at the left, depth at the right, on both window kinds ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { ${gadget(G.front)} margin: 0 0 0 2px; vertical-align: middle; object-fit: none; object-position: -999px -999px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:active { ${gadgetDown} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { background: ${G.lines}, ${WH}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { background: ${G.back}, ${WH}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { background: ${G.front}, ${WH}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { background: ${G.zoom}, ${WH}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { background: ${G.close}, ${WH}; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:active { background-color: ${O}; }
/* The Content Editor's window (and Media Library's...): a striped title bar over the ribbon, the close
   gadget at its left, the depth gadgets and the page switcher at its right */
${P} .scCaption.scWindowHandle {
  padding-top: 22px;
  background: var(--lg-stripes) 0 2px / 100% 16px no-repeat, linear-gradient(${WH}, ${WH}) 0 20px / 100% 2px no-repeat, ${B};
}
${P} .scCaption.scWindowHandle > .scSystemButtons {
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}
${P} .scCaption.scWindowHandle > .scSystemButtons > * { pointer-events: auto; margin: 0 0 0 2px; }
${P} .scCaption.scWindowHandle > .scSystemButtons > img[src*="_close"] { order: -1; margin: 0 auto 0 0; }
${P} .scCaption.scWindowHandle > #SystemMenu { top: 39px; }
/* Sitecore draws no caption over these windows, so the bar carries the window's title (engine.js
   --sct-window-title) in its white gap, right of the close gadget, as on every other window */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before,
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before {
  content: "\\a0" var(--sct-window-title, "") "\\a0";
  position: absolute;
  top: 0;
  left: 30px;
  max-width: calc(100% - 110px);
  ${titleGap}
  padding: 0;
}
/* under that bar the menu button shrinks to the tab row, and the tab row drops its empty group-header line
   (kept while a contextual tab group shows one), so the tabs sit right under the bar */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 22px; height: 18px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 4px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 2px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 2px; }
/* the same 4px on a standard window (the ISE...), whose ribbon is in the page inside the window's chrome */
${P}[data-sct-window-content] .scRibbonNavigator { padding-top: 2px; } /* 4px to the tabs: its tabs sit 2px down their row already */
/* Standard windows (ISE, Console, Package Designer...): the striped title bar, the close gadget at the
   left, the title in its white gap */
${P} .standardWindowCaption { height: 20px; background: ${stripes()}; border-bottom: 2px solid ${WH}; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 22px; }
${P} .standardWindowCaption .scWindowCaption { display: block; height: 20px; padding: 0 0 0 30px; text-align: left; }
${P} .standardWindowCaption .scWindowCaption > * { color: ${B} !important; }
${P} .standardWindowCaption .scWindowCaption { line-height: 16px; }
${P} .standardWindowCaption .scWindowCaption::first-line { background: ${WH}; }
${P} .standardWindowCaption .scWindowCaption { color: ${B}; font: 12px / 16px ${FONT}; padding-top: 2px; box-sizing: border-box; white-space: nowrap; overflow: hidden; }
${P} .standardWindowCaption .scWindowCaption::before, ${P} .standardWindowCaption .scWindowCaption::after { content: "\\a0"; }
${P} .standartWindowButtons { top: 0; left: 0; right: 0; height: 20px; display: flex; justify-content: flex-end; pointer-events: none; }
${P} .standartWindowButtons img { pointer-events: auto; }
${P} .standartWindowButtons img[src*="_close"] { order: -1; margin: 0 auto 0 0; }
/* SPE's ISE (ise.js) gives its title the room the .standartWindowButtons box leaves; here that box spans the
   bar (the close gadget on the left, the depth gadgets on the right), so the title would get none. The
   caption keeps clear of the gadgets itself. */
${P} .standardWindowCaption .scWindowCaption { padding-right: 60px; }
${P} .standardWindowCaption #WindowCaption { max-width: 100% !important; margin-left: 0 !important; }
/* The Workbox's window: the same striped title bar, the gadgets on it. Its caption is a .scWindowHandle
   too, whose 22px top padding pushed Sitecore's floated buttons below the caption, under the list's frame. */
${P}:not(#sct-lg) .scWorkboxWindowCaption.scWindowHandle { box-sizing: content-box; height: 20px; padding-top: 0; background: ${stripes()}; border-bottom: 2px solid ${WH}; }
${P} .scWorkboxWindowButtons { float: none; position: absolute; top: 0; left: 0; right: 0; height: 20px; display: flex; justify-content: flex-end; pointer-events: none; }
${P} .scWorkboxWindowButtons > img { pointer-events: auto; }
${P} .scWorkboxWindowButtons > img[src*="_close"] { order: -1; margin: 0 auto 0 0; }

/* ---- Insert gallery scroller: arrow gadgets ---- */
${P} .scRibbonPanelButtons { background: ${B}; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { box-sizing: border-box; width: 16px; filter: none; border: 1px solid ${WH}; }
${P} img.scRibbonPanelUp { ${paint(art([tri.up(2, 3, 7)], { w: 11, h: 8 }))} }
${P} img.scRibbonPanelDown { ${paint(art([tri.down(2, 2, 7)], { w: 11, h: 8 }))} }
${P} img.scRibbonPanelOpen { ${paint(art([bar(2, 4, 2, 2), bar(5, 4, 2, 2), bar(8, 4, 2, 2)], { w: 11, h: 8 }))} }

/* ==== The Desktop: Workbench's screen. The blue screen without wallpaper; the global header and the
   taskbar together are the white screen title bar on top: the Launchpad gadget, "Sitecore Workbench"
   (the start button, opening the Workbench menu), the running windows as text items, the search field
   and the database, then the account and Log out. ==== */
${W("shell")} body:has(> form .DesktopArea) {
  .sc-globalHeader { height: 24px; }
  .sc-globalHeader :is(.sc-globalHeader-content, .col2, .sc-globalHeader-startButton, .sc-globalHeader-loginInfo) { height: 24px; }
  .sc-globalHeader .sc-globalHeader-startButton { display: flex; align-items: center; padding-left: 2px; }
  .sc-globalHeader a.sc-global-logo, .sc-globalHeader a.sc-global-logo:hover { margin: 0; }
  .sc-globalHeader ul.sc-accountInformation { height: 24px; margin: 0; padding: 0 6px 0 0; }
  .sc-globalHeader .sc-accountInformation li { height: 24px; }
  #globalHeaderUserName { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  img#Wallpaper { display: none; }
  .DesktopArea {
    top: 24px;
    bottom: 0;
    /* GlobalHeader.css clears its 50px header with a margin */
    margin-top: 0;
    background: ${B} !important;
  }
  /* the taskbar laid into the title bar, between the gadget and the account */
  .scStartbar {
    position: fixed;
    top: 0;
    bottom: auto;
    left: 44px;
    right: 280px;
    width: auto;
    height: 24px;
    z-index: 11;
    border: 0;
    background: ${WH};
  }
  #Startbar,
  #Startbar > table { height: 24px !important; border: 0; background: ${WH}; box-shadow: none; }
  #Startbar > table > tbody > tr > td { height: 24px; padding: 0; border: 0; background: none; vertical-align: middle; }
  .scStartButtonContainer { width: auto; height: 24px; }
  .scStartButton,
  .scStartButton:hover,
  .scStartButton.scPopupOpener {
    position: static;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    width: auto;
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: 0;
    background: ${WH};
    filter: none;
  }
  .scStartButton::before {
    content: "Sitecore Workbench";
    color: ${B};
    font: 12px / 24px ${FONT};
    white-space: nowrap;
  }
  .scStartButton > * { display: none; }
  .scStartButton:hover,
  .scStartButton.scPopupOpener { background: ${B}; }
  .scStartButton:is(:hover, .scPopupOpener)::before { color: ${WH}; }
  /* running windows: text items divided by a blue bar */
  .scStartBarScroller { height: 24px; padding: 0; border: 0; overflow: hidden; }
  #StartbarApplications { height: 24px; margin: 0; border-spacing: 0; }
  #StartbarApplications > tbody > tr > td { height: 24px; padding: 0; border: 0; vertical-align: middle; }
  :is(.scActiveApplication, .scInactiveApplication) {
    box-sizing: border-box;
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-left: 2px solid ${B};
    border-radius: 0;
    background: ${WH};
    color: ${B};
    box-shadow: none;
  }
  :is(.scActiveApplication, .scInactiveApplication) * { color: ${B}; font: 12px / 24px ${FONT}; }
  :is(.scActiveApplication, .scInactiveApplication) img { display: none; }
  :is(.scActiveApplication, .scInactiveApplication) .scStartBarApplication { display: flex; align-items: center; height: 24px; max-width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .scActiveApplication { ${tabOpen} }
  .scActiveApplication * { color: ${K}; }
  .scInactiveApplication:hover { background: ${B}; }
  .scInactiveApplication:hover * { color: ${WH}; }
  /* the tray: the search field and the database */
  .scStartbarTray { height: 24px; border: 0; border-spacing: 0; background: none; }
  .scStartbarTray > tbody > tr > td { height: 24px; padding: 0 4px 0 0; border: 0; line-height: normal !important; vertical-align: middle; }
  .scStartbarTray :is(td, span) { color: ${B}; background-color: transparent; font: 12px ${FONT}; }
  #SearchBox {
    box-sizing: border-box;
    width: 180px;
    height: 20px;
    min-height: 0;
    margin: 0 4px 0 0;
    padding: 0 6px;
    background: ${WH};
    color: ${B};
    border: 2px solid ${B};
    border-radius: 0;
    box-shadow: none;
    caret-color: ${O};
    font: 12px ${FONT};
  }
  #SearchBox::placeholder { color: ${B}; opacity: 1; }
  #SearchBox:focus, #SearchBox.focus { background: ${WH}; color: ${B}; outline: 2px solid ${O}; outline-offset: 0; }
  #DatabaseSelector {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    margin: 0;
    padding: 0 6px;
    border: 0;
    border-left: 2px solid ${B};
    border-radius: 0;
    background: none;
    color: ${B};
    font: 12px / 20px ${FONT};
  }
  #DatabaseSelector:hover { background: ${B}; color: ${WH}; }
  #DatabaseSelector img { display: none; }
  /* the start menu drops down from the title bar */
  .scPopup:has(> .scStartMenu) { top: 24px !important; bottom: auto !important; }
}
${P} #StartMenu { box-sizing: border-box; padding: 0; ${menuFrame} }

/* ==== Hand-written details ==== */
${header(P, 50)}
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
