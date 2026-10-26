// Dev tool: writes extension/themes/cheetah/{shell,speak,launchpad,login}.css and the glyphs they use.
// Cheetah recreates Mac OS X's Aqua (10.0 to 10.3). Its window lights' marks, disclosure triangles, scroll
// arrows and check marks are glyphs (PNG plus vector SVG pairs, see art()), so the theme is generated here
// rather than written by hand.
//
// Measured Aqua (Mac OS X 10.2, Blue appearance, 72 dpi points as px):
//   window body: pinstripes, #efefef and #f8f8f8 in 2px stripes; text #000; Lucida Grande 13px (11px small).
//     Lucida Grande ships with the Mac only: Lucida Sans Unicode stands in on Windows, at 12px (it runs wider).
//   title bar 22px: brushed metal, #dcdcdc to #a9a9a9 with faint vertical hairlines, the title centred,
//     13px black with a white emboss under it; top corners 6px, bottom 4px; 1px #6e6e6e frame, a soft
//     0 10px 28px shadow. Inactive: flatter and paler (#ececec to #d6d6d6), the title #4d4d4d.
//   window lights on the left: close, minimize, zoom, 14px gel circles 7px apart, 8px from the edge, centred
//     on the bar; red #e2301d, amber #e8a722, green #45a62c, each lit from the top; their marks (x, -, +)
//     show while the pointer is over the group; an inactive window's lights are grey.
//   push buttons 21px pills (11px radius), white gel: #fff / #d8d8d8 to the split, #c4c4c4 / #ececec below,
//     a 1px #8a8a8a inner frame; the default one blue gel (#d6ebff / #74b6ff | #3d8fe8 / #a6d2ff, frame
//     #2a5fa8) and pulsing; pressed blue
//   tabs: a segmented control, joined segments with 10px rounded ends, the open one blue gel; in dialogs the
//     strip straddles the top edge of an etched, rounded tab box
//   fields 22px, 1px #7a7a7a with an inner shadow along the top; focus a 3px rgba(91, 153, 232, 0.7) glow
//   selection #3875d7 under white text: 4.47:1, so Cheetah takes #3670d0 (4.8:1); disclosure triangles #6b6b6b,
//     drawn #505050 here so they stand out from white at 125%
//   scroll bar 15px: a white track shaded at its edges, the thumb a blue gel pill, the arrows white gel
//   menus: white at 95%, square top and 5px bottom corners, a soft shadow; the selected row a blue
//     gradient (#6b9ef6 to #3a72e0) under white text; 11px gaps above and below the rows
//   menu bar 22px across the top of the screen: white pinstripes, a #bdbdbd line and a shadow under it
//   Dock: a translucent white shelf with rounded top corners on the bottom edge, 48px tiles, the running
//     triangle under each open application, its name in a dark rounded label above it under the pointer
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const ID = "cheetah";
const SURFACE = (s) => `html[data-sct-theme="${ID}"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-ch) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-ch)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
// Pages with tab boxes: every one but the ISE.
const NB = `${P}:not(:has(#TreeViewToggle)):not(#sct-ch)`;
const FONT = '"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Geneva, Verdana, sans-serif';
// Colours of the pixel art: W white, K black, T the disclosure triangles, R Y G the marks on the window
// lights, B the scroll arrows.
const COLORS = { W: "#fff", K: "#000", T: "#505050", R: "#5c0d05", Y: "#5e3c03", G: "#0d4504", B: "#1e1e1e" };

// ---- Pixel art (as in tools/build-metal-css.cjs): one character per pixel, '.' transparent. Each glyph is
// written to themes/cheetah/glyphs twice, as a PNG (1x) and as a vector SVG (every other scale), and named
// sct-ext:, which background.js points at the extension (a site's CSP can block data:). Placed centred, at
// [x, y] from the box's top left, or, given a number, that many pixels in from the right, centred vertically.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.WKTRYGB]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
  // a transparent 1px margin keeps Chrome's softening of an image placed between device pixels off the art
  const pad = ".".repeat(w + 2);
  const name = crypto.createHash("sha1").update(rows.join("|")).digest("hex").slice(0, 10);
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), png([pad, ...rows.map((r) => `.${r}.`), pad]));
  fs.writeFileSync(path.join(GLYPHS, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2}" height="${h + 2}" viewBox="-1 -1 ${w + 2} ${h + 2}">${VECTORS.get(rows.join("|")) || squares(rows)}</svg>\n`);
  const pos = Array.isArray(at) ? `${at[0] - 1}px ${at[1] - 1}px` : typeof at === "number" ? `right ${at - 1}px center` : "center";
  const url = (ext) => `url("sct-ext:themes/${ID}/glyphs/${name}.${ext}")`;
  return `image-set(${url("png")} 1x, ${url("svg")} 2x) ${pos} / ${w + 2}px ${h + 2}px no-repeat`;
}
function squares(rows) {
  const h = rows.length, w = rows[0].length;
  const done = rows.map((r) => [...r].map((c) => c === "."));
  const rects = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (done[y][x]) continue;
    const c = rows[y][x];
    let rw = 1, rh = 1;
    while (x + rw < w && !done[y][x + rw] && rows[y][x + rw] === c) rw++;
    while (y + rh < h && [...Array(rw)].every((_, i) => !done[y + rh][x + i] && rows[y + rh][x + i] === c)) rh++;
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) done[y + j][x + i] = true;
    rects.push(`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${COLORS[c]}"/>`);
  }
  return `<g shape-rendering="crispEdges">${rects.join("")}</g>`;
}
function png(rows) {
  const h = rows.length, w = rows[0].length;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  rows.forEach((r, y) => [...r].forEach((c, x) => {
    if (c === ".") return;
    const hex = COLORS[c].replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3");
    raw.writeUInt32BE(((parseInt(hex.slice(1), 16) << 8) | 0xff) >>> 0, y * (w * 4 + 1) + 1 + x * 4);
  }));
  return encodePng(w, h, 6, raw);
}
// raw: filter byte 0 then the pixels, per row; colorType 6 is RGBA, 4 grey and alpha
function encodePng(w, h, colorType, raw) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = colorType;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// Aqua's brushed metal (Mac OS X 10.0 to 10.3's metal windows): fine horizontal grain, each line a little lighter
// or darker than its neighbours, with long streaks that brighten and fade along it. Drawn as a light and dark
// overlay (white or black at a low alpha) so it lies over any of the grey ramps below. Seeded, so every build
// writes the same file; the streaks are whole sine periods across the tile, so it repeats seamlessly sideways,
// and the lines are independent, so it repeats seamlessly down too.
function brushedMetal(W = 384, H = 128, strength = 0.1) {
  let seed = 0x5eed;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
  const raw = Buffer.alloc(H * (W * 2 + 1));
  for (let y = 0; y < H; y++) {
    const line = gauss() * 0.3; // the line's own shade
    const waves = [1, 2, 3, 5].map((k) => ({ k, phase: rand() * 2 * Math.PI, amp: (0.5 + rand()) * 0.16 / Math.sqrt(k) }));
    // grain along the line: noise smoothed over 6px, wrapping round the tile
    const grain = Array.from({ length: W }, () => gauss());
    const smooth = grain.map((_, x) => { let t = 0; for (let i = -3; i <= 3; i++) t += grain[(x + i + W) % W]; return t / 7; });
    const row = y * (W * 2 + 1);
    for (let x = 0; x < W; x++) {
      const streak = waves.reduce((t, w) => t + w.amp * Math.sin((2 * Math.PI * w.k * x) / W + w.phase), 0);
      const v = Math.max(-1, Math.min(1, line + streak + smooth[x] * 0.35));
      raw[row + 1 + x * 2] = v > 0 ? 255 : 0;
      raw[row + 2 + x * 2] = Math.round(Math.abs(v) * strength * 255);
    }
  }
  const name = "brushed-metal";
  fs.writeFileSync(path.join(GLYPHS, `${name}.png`), encodePng(W, H, 4, raw));
  return `url("sct-ext:themes/${ID}/glyphs/${name}.png") 0 0 / ${W}px ${H}px repeat`;
}
// At exactly 100% the PNGs are drawn nearest-neighbour; the property inherits, so a zero-specificity reset
// keeps it off children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-ch-)/.test(m[2]))
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

// ---- Glyphs ----
// the marks on the window lights
const X_MARK = ["R...R", ".R.R.", "..R..", ".R.R.", "R...R"];
const MINUS = ["YYYYY"];
const PLUS = ["..G..", "..G..", "GGGGG", "..G..", "..G.."];
vector(X_MARK, `<path d="M0.4 0.4L4.6 4.6M4.6 0.4L0.4 4.6" stroke="${COLORS.R}" stroke-width="1.3"/>`);
vector(MINUS, `<path d="M0 0.5H5" stroke="${COLORS.Y}" stroke-width="1.3"/>`);
vector(PLUS, `<path d="M0 2.5H5M2.5 0V5" stroke="${COLORS.G}" stroke-width="1.3"/>`);
// disclosure triangles: right when closed, down when open
const TRI_CLOSED = ["T....", "TT...", "TTT..", "TTTT.", "TTTTT", "TTTT.", "TTT..", "TT...", "T...."];
const TRI_OPEN = ["TTTTTTTTT", ".TTTTTTT.", "..TTTTT..", "...TTT...", "....T...."];
vector(TRI_CLOSED, `<path d="M0 0L5 4.5L0 9Z" fill="${COLORS.T}"/>`);
vector(TRI_OPEN, `<path d="M0 0H9L4.5 5Z" fill="${COLORS.T}"/>`);
// scroll arrows and drop-down arrows: solid black triangles
const UP = ["...B...", "..BBB..", ".BBBBB.", "BBBBBBB"];
const DOWN = [...UP].reverse();
const LEFT = ["...B", "..BB", ".BBB", "BBBB", ".BBB", "..BB", "...B"];
const RIGHT = LEFT.map((r) => [...r].reverse().join(""));
vector(UP, `<path d="M0 4L3.5 0.5L7 4Z" fill="${COLORS.B}"/>`);
vector(DOWN, `<path d="M0 0L3.5 3.5L7 0Z" fill="${COLORS.B}"/>`);
vector(LEFT, `<path d="M4 0L0.5 3.5L4 7Z" fill="${COLORS.B}"/>`);
vector(RIGHT, `<path d="M0 0L3.5 3.5L0 7Z" fill="${COLORS.B}"/>`);
// the pop-up menu's double arrow (drop-down lists)
const UPDOWN = ["..K..", ".KKK.", "KKKKK", ".....", "KKKKK", ".KKK.", "..K.."];
vector(UPDOWN, `<path d="M0 3L2.5 0L5 3ZM0 4H5L2.5 7Z" fill="#000"/>`);
// menu fly-outs and ribbon drop-downs
const TRI_RIGHT = ["K...", "KK..", "KKK.", "KKKK", "KKK.", "KK..", "K..."];
const TRI_RIGHT_W = TRI_RIGHT.map((r) => r.replace(/K/g, "W"));
const TRI_DOWN = ["KKKKK", ".KKK.", "..K.."];
vector(TRI_RIGHT, `<path d="M0 0L4 3.5L0 7Z" fill="#000"/>`);
vector(TRI_RIGHT_W, `<path d="M0 0L4 3.5L0 7Z" fill="#fff"/>`);
vector(TRI_DOWN, `<path d="M0 0H5L2.5 3Z" fill="#000"/>`);
// the check mark, black on the blue gel box
const CHECK = ["......K", ".....KK", "K...KKK", "KK.KKK.", "KKKKK..", ".KKK...", "..K...."];
vector(CHECK, `<path d="M0.7 3.2L2.5 5.2L6.4 1" fill="none" stroke="#000" stroke-width="2"/>`);
// the Dock's running triangle
const RUNNING = ["...K...", "..KKK..", ".KKKKK."];
vector(RUNNING, `<path d="M0.5 3L3.5 0L6.5 3Z" fill="#000"/>`);
// the Back button's arrow (a toolbar pill)
const BACK = ["...K....", "..KK....", ".KKKKKKK", "KKKKKKKK", ".KKKKKKK", "..KK....", "...K...."];
vector(BACK, `<path d="M8 3.5H2M4.2 0.8L1.2 3.5L4.2 6.2" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);

// ---- Aqua recipes ----
const PINSTRIPES = "repeating-linear-gradient(#efefef 0 2px, #f8f8f8 2px 4px)";
// brushed metal: the grain (brushedMetal()) over the grey ramp
const BRUSHED = brushedMetal();
const METAL = (top = "#e2e2e2", bottom = "#bdbdbd") => `${BRUSHED}, linear-gradient(${top}, ${bottom})`;
const CAP = METAL("#e4e4e4", "#c2c2c2");
const CAP_IN = "linear-gradient(#f0f0f0, #dedede)";
const capText = `color: #000; font: 13px/1 ${FONT}; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);`;
// gels, split at half height
const WHITE_GEL = "linear-gradient(#fff, #e8e8e8 50%, #d4d4d4 50%, #f2f2f2)";
const BLUE_GEL = "linear-gradient(#d6ebff, #74b6ff 50%, #3d8fe8 50%, #a6d2ff)";
const BLUE_GEL_DOWN = "linear-gradient(#a9cff7, #4f98ea 50%, #2370cf 50%, #7cb8f4)";
const WHITE_GEL_V = "linear-gradient(90deg, #fff, #e8e8e8 50%, #d4d4d4 50%, #f2f2f2)";
const BLUE_GEL_V = "linear-gradient(90deg, #a6d2ff, #3d8fe8 30%, #74b6ff 50%, #d6ebff 75%, #8cc4ff)";
// a window light: the gel circle and its glare
const light = (hi, mid, lo) => `radial-gradient(ellipse 58% 36% at 50% 26%, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0) 100%), radial-gradient(circle at 50% 70%, ${hi}, ${mid} 55%, ${lo})`;
const RED = light("#ffb2a8", "#e2301d", "#9d1a0c");
const AMBER = light("#ffe6a3", "#e8a722", "#a26a06");
const GREEN = light("#c8f5a8", "#45a62c", "#21680f");
const GREY_LIGHT = light("#f4f4f4", "#b9b9b9", "#8c8c8c");
// the window frame drawn outside an element (a desktop window's iframe): a 1px line and the soft shadow
const FRAME_RING = "0 0 0 1px rgba(40, 40, 40, 0.6), 0 10px 28px rgba(0, 0, 0, 0.5)";
const FRAME_RING_IN = "0 0 0 1px rgba(60, 60, 60, 0.4), 0 6px 18px rgba(0, 0, 0, 0.3)";
// segmented control: joined gel segments
const seg = `border: 0; border-radius: 0; background: ${WHITE_GEL}; box-shadow: inset 0 0 0 1px #8a8a8a; color: #000; text-transform: none; text-shadow: none;`;
const segOpen = `background: ${BLUE_GEL}; box-shadow: inset 0 0 0 1px #2a5fa8;`;
const segDown = "background: linear-gradient(#d8d8d8, #c4c4c4 50%, #b4b4b4 50%, #d2d2d2); box-shadow: inset 0 0 0 1px #6b6b6b;";
// push buttons: pills
const push = `box-sizing: border-box; border: 0; border-radius: 11px; background: ${WHITE_GEL}; color: #000; text-shadow: none; text-transform: none; box-shadow: inset 0 0 0 1px #8a8a8a, 0 1px 2px rgba(0, 0, 0, 0.22);`;
const pushHot = "box-shadow: inset 0 0 0 1px #6b6b6b, 0 1px 2px rgba(0, 0, 0, 0.28);";
const pushDefault = `background: ${BLUE_GEL}; box-shadow: inset 0 0 0 1px #2a5fa8, 0 1px 2px rgba(0, 0, 0, 0.3); animation: sct-ch-pulse 1.4s ease-in-out infinite alternate;`;
const pushDown = `background: ${BLUE_GEL_DOWN}; box-shadow: inset 0 0 0 1px #1d4f94, inset 0 1px 2px rgba(0, 0, 0, 0.3); animation: none;`;
const pushOff = "background: linear-gradient(#fafafa, #f0f0f0 50%, #e8e8e8 50%, #f6f6f6); color: #8a8a8a; box-shadow: inset 0 0 0 1px #c0c0c0; animation: none;";
// toolbar buttons on metal: no frame until hovered, then a pale rounded plate
const toolHot = "border-color: rgba(0, 0, 0, 0.28); background: rgba(255, 255, 255, 0.4); box-shadow: inset 0 1px rgba(255, 255, 255, 0.6);";
const toolDown = "border-color: rgba(0, 0, 0, 0.4); background: rgba(0, 0, 0, 0.12); box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);";
// fields
const field = "border: 1px solid #7a7a7a; border-top-color: #555; border-radius: 0; background-color: #fff; color: #000; box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.2);";
const fieldFocus = "box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.2), 0 0 0 3px rgba(91, 153, 232, 0.7);";
// a drop-down list: Aqua's pop-up button, a white gel pill with the blue end holding the double arrow
const popup = `border: 0; border-radius: 5px; background: ${art(UPDOWN, 6)}, ${BLUE_GEL} right / 18px 100% no-repeat, ${WHITE_GEL}; box-shadow: inset 0 0 0 1px #8a8a8a, 0 1px 1px rgba(0, 0, 0, 0.18); color: #000;`;
// the scroll bar
const thumbFrame = "inset 0 0 0 1px #2a5fa8, inset 0 0 0 2px rgba(255, 255, 255, 0.35)";
// menus
const MENU_BG = "rgba(255, 255, 255, 0.95)";
const menuHot = "background: linear-gradient(#6b9ef6, #3a72e0); color: #fff;";
// the selection
const SEL = "background: #3670d0; color: #fff;";
// the column header band (sections, table heads)
const HEAD = "linear-gradient(#fefefe, #ececec 50%, #dedede 50%, #f1f1f1)";

const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");
const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
const LC = ":is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)";

// The global header (standalone Content Editor, SPEAK pages): a brushed metal title bar.
const header = (S) => `/* ---- Global header: brushed metal ---- */
${S} :is(.sc-globalHeader, .sc-flx-global-header) { background: ${CAP}; border-bottom: 1px solid #7d7d7d; box-shadow: inset 0 1px rgba(255, 255, 255, 0.7); color: #000; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation span,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a,
${S} :is(.sc-globalHeader, .sc-flx-global-header) a { color: #000; font-family: ${FONT}; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6); }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::before, ${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::after { color: #000; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { border: 1px solid #7d7d7d; border-radius: 4px; }
`;

// The application header of a SPEAK page (title, Back): a metal toolbar under the title.
const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: ${METAL("#c8c8c8", "#adadad")}; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: transparent; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 8px 15px 4px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: #000; font: 15px/22px ${FONT}; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6); }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 15px 6px; background: transparent; border: 0; border-bottom: 1px solid #6e6e6e; box-shadow: none; }
${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 22px; min-width: 0; padding: 0 12px 0 10px; ${push} }
${SX} .btn.sc-backbutton:hover { ${pushHot} }
${SX} .btn.sc-backbutton:active { ${pushDown} }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: 12px/20px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before { position: static; flex: none; width: 10px; height: 9px; background: ${art(BACK)}; mask: none; transform: none; }`;

// The window lights for a selector: three images Sitecore names minimize, maximize/restore and close.
const lights = (S) => `${S} img { box-sizing: border-box; width: 14px; height: 14px; margin: 0; padding: 0; border: 0; border-radius: 50%; vertical-align: middle; filter: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.38), 0 1px 1px rgba(255, 255, 255, 0.5); }
${S} img[src*="_close"] { order: 1; ${paint(RED)} }
${S} img[src*="minimize"] { order: 2; ${paint(AMBER)} }
${S} img:is([src*="maximize"], [src*="restore"]) { order: 3; ${paint(GREEN)} }
${S} img[src*="page_switcher"] { order: 4; ${paint(`${art(TRI_DOWN)}, ${GREY_LIGHT}`)} }
${S}:hover img[src*="_close"] { background: ${art(X_MARK)}, ${RED}; }
${S}:hover img[src*="minimize"] { background: ${art(MINUS)}, ${AMBER}; }
${S}:hover img:is([src*="maximize"], [src*="restore"]) { background: ${art(PLUS)}, ${GREEN}; }
${S} img:active { filter: brightness(0.8); }`;

const css = `/* Cheetah: classic shell. Generated by tools/build-cheetah-css.cjs; never hand-edit.
   Mac OS X's Aqua: pinstriped windows under brushed metal, traffic-light window controls on the left, blue gel
   buttons and segmented tabs, Lucida Grande. */

/* The default button pulses, as Aqua's did; under reduced motion slower and fainter. */
@keyframes sct-ch-pulse { from { filter: brightness(1); } to { filter: brightness(1.12); } }
@media (prefers-reduced-motion: reduce) {
  ${P} :is(.scButtonPrimary, .btn-primary) { animation-duration: 3.2s !important; }
  @keyframes sct-ch-pulse { from { filter: brightness(1); } to { filter: brightness(1.05); } }
}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} { scrollbar-color: auto; }
/* the window body: Aqua's pinstripes */
${X} :is(.scFormDialogContent, .scDialogContentContainer, .scWizardFormContent, .scEditorPanel) { background-image: ${PINSTRIPES}; }
/* the Content Editor's sections below Quick Info lie on the panel's pinstripes, not on a flat fill */
${X} .scEditorSections { background-color: transparent; }

/* ---- Scrollbars: a white track shaded at its edges, the blue gel thumb, white gel arrows ---- */
${P} ::-webkit-scrollbar { width: 15px; height: 15px; background: #eee; }
${P} ::-webkit-scrollbar-track { border-radius: 0; }
${P} ::-webkit-scrollbar-track:vertical { background: linear-gradient(90deg, #c4c4c4, #e9e9e9 3px, #fff 50%, #ececec); }
${P} ::-webkit-scrollbar-track:horizontal { background: linear-gradient(#c4c4c4, #e9e9e9 3px, #fff 50%, #ececec); }
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { border: 0; border-radius: 7px; box-shadow: ${thumbFrame}; }
${P} ::-webkit-scrollbar-thumb:vertical, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:vertical { background: ${BLUE_GEL_V}; }
${P} ::-webkit-scrollbar-thumb:horizontal, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:horizontal { background: ${BLUE_GEL}; }
${P} ::-webkit-scrollbar-thumb:active { filter: brightness(0.9); }
${P} ::-webkit-scrollbar-corner { background: #eee; }
${P} ::-webkit-scrollbar-button:single-button { display: block; box-shadow: inset 0 0 0 1px #9a9a9a; }
${P} ::-webkit-scrollbar-button:vertical:single-button { width: 15px; height: 16px; }
${P} ::-webkit-scrollbar-button:horizontal:single-button { width: 16px; height: 15px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${art(UP)}, ${WHITE_GEL_V}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${art(DOWN)}, ${WHITE_GEL_V}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${art(LEFT)}, ${WHITE_GEL}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${art(RIGHT)}, ${WHITE_GEL}; }
${P} ::-webkit-scrollbar-button:active { filter: brightness(0.85); }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar: Aqua's again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 15px; height: 15px; background: #eee; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { border: 0; border-radius: 7px; background: ${BLUE_GEL_V}; box-shadow: ${thumbFrame}; }

${header(P)}
/* ---- Ribbon: a segmented control on the metal toolbar, the toolbar's groups under it ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: ${METAL("#d4d4d4", "#c8c8c8")}; }
${P} .scRibbonNavigator { border-bottom: 0; }
/* the ribbon's tabs centred on the metal, as Aqua centred a window's toolbar and tab controls */
${P} .scRibbonNavigatorButtons { display: flex; justify-content: center; }
${P} .scRibbonNavigatorButtonsGroup { float: none; }
${TABS("Normal")},
${TABS("Active")} {
  ${seg}
  position: relative;
  height: 20px;
  margin: 0 0 4px -1px;
  padding: 0 12px;
  font: 12px/20px ${FONT};
}
${TABS("Normal:hover")} { box-shadow: inset 0 0 0 1px #6b6b6b; }
${TABS("Normal:active")} { ${segDown} }
${TABS("Active")} { ${segOpen} z-index: 1; }
/* the segments' rounded ends */
${P} .scRibbon :is(a.scRibbonNavigatorButtonsNormal, a.scRibbonNavigatorButtonsActive):first-of-type { border-radius: 10px 0 0 10px; }
${P} .scRibbon :is(a.scRibbonNavigatorButtonsNormal, a.scRibbonNavigatorButtonsActive):last-of-type { border-radius: 0 10px 10px 0; }
${P} .scRibbonToolbar { background: ${METAL("#c8c8c8", "#a9a9a9")}; border-top: 0; border-bottom: 1px solid #6e6e6e; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: transparent;
  border: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.16);
  box-shadow: 1px 0 rgba(255, 255, 255, 0.4);
  border-radius: 0;
  margin: 3px 2px 3px 0;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #222; font: 11px ${FONT}; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5); }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; font-size: 11px; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 1px solid transparent; border-radius: 6px; }
/* Only the buttons react, not their icons or labels, and disabled buttons (spans) not at all. A large combo
   button shows its command and its drop-down as two faces while hovered, each pressed on its own. */
${P} .scRibbonToolbar ${RB}:hover { ${toolHot} }
${P} .scRibbonToolbar ${RB}:active { ${toolDown} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > ${LC} { ${toolHot} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > ${LC}:active { ${toolDown} }
/* Copenhagen-tight on both versions: the strip keeps 1px plus the chunks' 3px margin above and below
   (10.5 pads it 12px over an 80px minimum), the panel 3px above the buttons and 4px at the sides (10.5
   16px, 10.4 10px 8px), a 16px caption, and large buttons cut from 55px to 46px so they end above the
   caption with their hover frame. */
/* The strips are see-through, so the metal runs on behind the buttons as it did in Aqua's metal windows (the
   generated map paints them --sct-panel-bg). */
${X} :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip) { display: flow-root; min-height: 0; padding: 1px 0; background: transparent; }
${X} .scRibbonToolbar .chunk > .panel { box-sizing: border-box; height: 52px; padding: 3px 4px 0; }
${X} .scRibbonToolbar .chunk > .caption { height: 16px; padding: 0 4px; line-height: 16px; }
${X} .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeButtonDown, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) { padding: 2px 5px 1px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLarge"] .header { padding: 3px 4px 1px; }
${X} .scRibbonToolbar :is(.scRibbonGallery, .scRibbonToolbarSmallButtons) { padding: 1px 5px 0; }
${X} .scRibbonToolbar .scRibbonToolbarSmallCheckButton { padding: 3px 4px; }
${X} .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) { padding: 0; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonTop"] { padding: 0 5px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonBottom"] { padding: 0 5px 1px; }
/* 10.4's chunk launchers are pale grey: inked like the captions */
${X} .scRibbonChunkEndLink img.glyph { filter: brightness(0); }
/* 10.4's pale grey ribbon icons were drawn for white: deepened on the metal (colour icons keep their hues) */
${X} .scRibbonToolbar img:is([class*="Icon"], .scRibbonToolbarSmallButtonIcon) { filter: contrast(1.3) brightness(0.85); }

/* ---- Content tree: white, the Aqua selection, disclosure triangles ---- */
${P} .scContentTree { background: #fff; }
${P} .scContentTree :is(a, span) { font-size: 12px; }
${P} .scContentTree a.scContentTreeNodeActive { ${SEL} outline: 0; border-radius: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: #fff !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: #edf3fe; text-decoration: none; }
${P} img[src*="/treemenu_collapsed"] { ${paint(art(TRI_CLOSED))} }
${P} img[src*="/treemenu_expanded"] { ${paint(art(TRI_OPEN))} }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: bold 14px ${FONT}; color: #000; }
/* the editor's tabs: a segmented control */
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${seg}
  height: 20px;
  margin: 5px 0 0 -1px;
}
${P} a.scRibbonEditorTabNormal:hover, ${P} a#BTAddNewSearch:hover { box-shadow: inset 0 0 0 1px #6b6b6b; }
${P} a.scRibbonEditorTabActive { ${segOpen} position: relative; z-index: 1; }
${P} :is(a.scRibbonEditorTabActive, a.scRibbonEditorTabNormal):first-child { border-radius: 10px 0 0 10px; }
${P} a#BTAddNewSearch { width: 34px; border-radius: 0 10px 10px 0; }
/* the Search segment's magnifier is a pale grey drawn for white: inked on the gel */
${X} a#BTAddNewSearch img { filter: brightness(0.45); }
/* the bar over the fields: the tree's search row beside it, brushed metal at its 30px, the tabs and the
   controls on the right centred in it (Sitecore leaves 35px above them for nothing) */
${X} #EditorTabs { box-sizing: content-box; height: 30px; background: ${METAL("#d4d4d4", "#c4c4c4")}; border-bottom: 1px solid #8a8a8a; }
${X} #EditorTabs > .scEditorTabControlsHolder { height: 24px; margin-top: 3px; }
/* the fields start at the bar's foot (Sitecore sets them 58px down, under its own bar) */
${X} #EditorFrames { margin-top: 31px; }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: 12px ${FONT};
  border: 0;
  height: 20px;
  line-height: 20px;
  padding: 0 12px;
}
/* the sections run edge to edge across the editor, as list header bands span an Aqua window (the token layer's
   15px inset does not apply) */
${X} .scEditorPanel { padding-left: 0; }
/* sections: Aqua's list header band, a disclosure triangle before the bold name */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  box-sizing: border-box;
  height: 22px;
  margin: 0 0 2px;
  padding: 0 0 0 4px;
  border: 0;
  border-top: 1px solid #c8c8c8;
  border-bottom: 1px solid #a5a5a5;
  border-radius: 0;
  background: ${HEAD};
  color: #000;
  font: bold 12px/20px ${FONT};
}
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed):hover { background: linear-gradient(#fff, #f2f2f2 50%, #e6e6e6 50%, #f6f6f6); }
${P} img.scEditorSectionCaptionGlyph { float: left; width: 16px; height: 16px; margin: 2px 4px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(art(TRI_OPEN))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(art(TRI_CLOSED))} }
${P} .scEditorFieldLabel { color: #000; font: 12px ${FONT}; }

/* ---- Fields: white, a #7a7a7a frame with the shadow inside its top edge ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select:is([multiple], [size]:not([size="0"], [size="1"])) { ${field} }
${P} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 22px; ${popup} }
${X} input[type="checkbox"], ${X} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  margin: 0 4px 0 0;
  vertical-align: -3px;
  border: 0;
  border-radius: 3px;
  background: ${WHITE_GEL};
  box-shadow: inset 0 0 0 1px #6e6e6e;
}
${X} input[type="radio"] { border-radius: 50%; }
${X} input[type="checkbox"]:checked { background: ${art(CHECK)}, ${BLUE_GEL}; box-shadow: inset 0 0 0 1px #2a5fa8; }
${X} input[type="radio"]:checked { background: radial-gradient(circle, #1e1e1e 0 2.2px, transparent 2.8px), ${BLUE_GEL}; box-shadow: inset 0 0 0 1px #2a5fa8; }
${X} :is(input[type="checkbox"], input[type="radio"]):active:not(:disabled) { filter: brightness(0.85); }
${X} :is(input[type="checkbox"], input[type="radio"]):disabled { background: #f4f4f4; box-shadow: inset 0 0 0 1px #c0c0c0; opacity: 1; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: none; box-shadow: inset 0 0 0 1px #2a5fa8, 0 0 0 3px rgba(91, 153, 232, 0.7); }

/* ---- Push buttons: Aqua's white gel pills; the default one blue and pulsing ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] { ${push} font: 12px ${FONT}; }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):hover:not(:disabled) { ${pushHot} }
${P} .scButtonPrimary { ${pushDefault} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):active:not(:disabled) { ${pushDown} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):disabled { ${pushOff} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: none; box-shadow: inset 0 0 0 1px #2a5fa8, 0 0 0 3px rgba(91, 153, 232, 0.7); }

/* ---- Bottom application tabs: a segmented control under the window's content ---- */
/* the bar as tall as its 20px pills (Sitecore floats them; its fixed 30px left 13px under them), 3px above and 4px below
   with the 1px line on top */
${P} .scPager { box-sizing: content-box; width: auto; height: 20px; margin: 0; border: 0; border-radius: 0; padding: 3px 6px 4px; background: ${METAL("#d0d0d0", "#b4b4b4")}; border-top: 1px solid #7d7d7d; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  ${seg}
  height: 20px;
  margin: 0 0 0 -1px;
  padding: 0 12px;
  font: 12px/20px ${FONT};
}
${P} .scPagerButtonNormal:hover { box-shadow: inset 0 0 0 1px #6b6b6b; }
${P} .scPagerButtonActive { ${segOpen} position: relative; z-index: 1; }
${P} :is(.scPagerButtonNormal, .scPagerButtonActive):first-child { border-radius: 10px 0 0 10px; }
${P} :is(.scPagerButtonNormal, .scPagerButtonActive):last-child { border-radius: 0 10px 10px 0; }

/* ---- Dialog windows: an Aqua window. The page inside the dialog draws the title bar (its header); Sitecore's
   empty jQuery title bar is laid over it, keeping the drag and carrying the window lights at its left. ---- */
${P} .ui-dialog {
  background: #f4f4f4;
  border: 1px solid #6e6e6e;
  border-radius: 6px 6px 4px 4px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
}
${X} .ui-dialog { border-color: #6e6e6e; background: #f4f4f4; }
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 22px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
/* the lights: close, minimize, zoom from the left */
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  top: 4px !important;
  left: 8px;
  right: auto !important;
  margin: 0 !important;
  height: 14px;
  display: flex;
  gap: 7px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.38);
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: -2;
  margin: 0 !important;
  background: ${RED};
}
${P} .ui-dialog .ui-dialog-titlebar-minimize { order: -1; background: ${AMBER}; }
${P} .ui-dialog :is(.ui-dialog-titlebar-maximize, .ui-dialog-titlebar-restore) { background: ${GREEN}; }
${P} .ui-dialog .ui-dialog-titlebar-collapse { background: ${GREY_LIGHT}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane:hover > button.ui-button { background: ${art(X_MARK)}, ${RED}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane:hover > .ui-dialog-titlebar-minimize { background: ${art(MINUS)}, ${AMBER}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane:hover > :is(.ui-dialog-titlebar-maximize, .ui-dialog-titlebar-restore) { background: ${art(PLUS)}, ${GREEN}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :active { filter: brightness(0.8); }
/* a faint shade marks the dialog as modal */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.18); opacity: 1; }

/* Inside a dialog page: the header is the title bar, the title centred clear of the lights. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #f4f4f4; padding: 0; border: 0; min-height: 0 !important; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  box-sizing: border-box;
  height: 22px;
  margin: 0;
  padding: 0 80px;
  background: ${CAP};
  border: 0;
  border-bottom: 1px solid #7d7d7d;
  border-radius: 0;
  ${capText}
  line-height: 22px;
  white-space: nowrap;
}
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 8px 12px; margin: 0; font: 12px ${FONT}; background: ${PINSTRIPES}; border-bottom: 1px solid #c8c8c8; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background-color: #f4f4f4; }
${P} .scFormDialogFooter { border-top: 0; border-radius: 0; background-image: ${PINSTRIPES}; }
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 39px; padding: 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: right; display: flex; gap: 10px; }
/* SPE's help (?) floats for 10.x's taller footer: centred on the 21px buttons instead */
${X} .scFormDialogFooter img#Copyright { margin: 0; }

/* ---- Tab strips (dialogs, the ISE's script tabs): a segmented control ---- */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 0; }
/* Sitecore swaps scTab for scTab_Hover under the mouse; the stock hover class is uppercase on a light face. */
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${seg}
  height: 20px;
  padding: 0 12px 0 14px;
  margin: 0 0 0 -1px;
  font: 12px/20px ${FONT};
}
${P} .scTabstrip .scTab_Hover { box-shadow: inset 0 0 0 1px #6b6b6b; }
${P} .scTabstrip [class*="scTabActive"] { ${segOpen} position: relative; z-index: 1; }
${P} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):first-child { border-radius: 10px 0 0 10px; }
${P} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):last-child { border-radius: 0 10px 10px 0; }
${P} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):only-child { border-radius: 10px; }
/* focus: Aqua's blue glow, never Sitecore's black frame */
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus { outline: none; }
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus-visible { outline: 2px solid rgba(91, 153, 232, 0.8); outline-offset: 0; }
${P} .scTabstrip .closeTab { margin: 0 -2px 0 6px; }
/* the ISE's unsaved-script dot, darkened from SPE's #fc2929 to pass AA on the gel */
${P} .scTabstrip .scriptModified { color: #a01a10; }

/* ---- Window lights (Desktop windows and the Content Editor's own) ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) { display: flex; align-items: center; gap: 7px; }
${lights(`${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons)`)}
/* Groups Sitecore pins to the right-hand edge are mirrored, so red stays nearest the edge */
${P} :is(.scSystemButtons, .scWorkboxWindowButtons) { flex-direction: row-reverse; margin-right: 9px; }
/* Standard windows (ISE, Console, Package Designer...): brushed metal, the lights on the left, the title
   centred clear of them. */
${P} .standardWindowCaption {
  height: 22px;
  background: ${CAP};
  border: 0;
  border-bottom: 1px solid #7d7d7d;
  border-radius: 6px 6px 0 0;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.7);
  text-align: center;
}
/* Around the caption: the window's frame and its body behind the rounded corners: metal grey. */
${X} .scWindowFrame, ${X} .scWindowBorder2 { border-color: #8a8a8a; }
${X} .scWindowFrame > .scStretch { background-color: #c9c9c9; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 23px; }
${P} .standardWindowCaption .windowCaptionIcon { display: inline-block; vertical-align: top; margin: 3px 0 0 0; }
${P} .standardWindowCaption .scWindowCaption {
  display: inline-block;
  ${capText}
  line-height: 22px;
  padding: 0 4px;
  vertical-align: top;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* The ISE writes its script's path into the caption in an inline #bbb: dark grey on the metal. */
${P} .standardWindowCaption .scWindowCaption i { color: #3a3a3a !important; }
${P} .standartWindowButtons { top: 0; height: 22px; left: 8px; right: auto; }
/* An inactive window (dom.js marks its document from the taskbar): flat, pale metal, grey lights, grey title. */
${PI} .standardWindowCaption { background: ${CAP_IN}; }
/* A standard window with a ribbon (the ISE, the Package Designer...): the bar runs on into the ribbon's metal
   without a line, as on the Content Editor */
${P} .standardWindowCaption:has(+ .windowPlaceholderContainer .scRibbon) { background: ${METAL("#e4e4e4", "#d4d4d4")}; border-bottom: 0; }
${P} .standardWindowCaption:has(+ .windowPlaceholderContainer .scRibbon) + .windowPlaceholderContainer { top: 22px; }
${PI} .standardWindowCaption:has(+ .windowPlaceholderContainer .scRibbon) { background: ${CAP_IN}; }
${PI} .standardWindowCaption .scWindowCaption { color: #4d4d4d; }
${PI} :is(.standartWindowButtons, .scSystemButtons) img:is([src*="_close"], [src*="minimize"], [src*="maximize"], [src*="restore"]) { background: ${GREY_LIGHT}; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. Aqua's metal title
   bar is drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), centred,
   the lights moved onto it at the left, the ribbon's menu button below it. The bar runs on into the ribbon's
   metal without a line, as a metal window's title bar ran into its toolbar. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 22px; background: ${METAL("#e4e4e4", "#d4d4d4")}; border-radius: 6px 6px 0 0; box-shadow: inset 0 1px rgba(255, 255, 255, 0.7); }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 22px; padding: 0 80px; ${capText} line-height: 22px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 0; left: 8px; right: auto; margin-right: 0; height: 22px; flex-direction: row; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (it holds a contextual group's
   name, 17px) goes, and the menu button, 17px down and 30px tall for the band it left, takes the tab row's
   24px. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; height: 24px; margin-top: 22px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { background: ${CAP_IN}; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { color: #4d4d4d; }

/* ---- Insert gallery scroller: white gel arrows ---- */
${P} .scRibbonPanelButtons { background: transparent; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { width: 16px; height: 15px; filter: none; border-radius: 3px; box-shadow: inset 0 0 0 1px #8a8a8a; }
${P} img.scRibbonPanelUp { ${paint(`${art(UP)}, ${WHITE_GEL}`)} }
${P} img.scRibbonPanelDown { ${paint(`${art(DOWN)}, ${WHITE_GEL}`)} }
${P} img.scRibbonPanelOpen { ${paint(`${art(["BB.BB.BB", "BB.BB.BB"])}, ${WHITE_GEL}`)} }

/* ==== Desktop: the Aqua desktop between the menu bar and the Dock ==== */
/* the desktop: Aqua's blue, lit from the top left; the wallpaper replaces Sitecore's (it sets it inline). The
   desktop runs to the screen's bottom edge, so it shows round the Dock, and so do the windows: a maximized
   window fills it and runs on under the Dock, which floats above every non-modal window. */
${X} .DesktopArea {
  top: 22px;
  bottom: 0;
  margin-top: 0;
  overflow: clip;
  background:
    radial-gradient(ellipse 60% 40% at 72% 78%, rgba(160, 205, 255, 0.35), transparent 70%),
    radial-gradient(ellipse 80% 55% at 28% 18%, #8fb8ef 0%, #3b6cc4 48%, #1f3f86 100%) !important;
  background-origin: border-box !important;
  background-clip: border-box !important;
}
${X} .DesktopArea > :is(iframe, div[id^="FRAME"]) { top: 0; }

/* the global header is the menu bar: 22px of white pinstripes over a grey line, the Launchpad button at the
   left, the account at the right */
${X} .sc-globalHeader:has(~ div .DesktopArea) {
  height: 22px;
  min-height: 0;
  overflow: visible;
  background: repeating-linear-gradient(#fff 0 1px, #f2f2f2 1px 2px) !important;
  border-bottom: 1px solid #a8a8a8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
${X} .sc-globalHeader:has(~ div .DesktopArea) .sc-globalHeader-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  height: 22px;
  padding: 0 96px 0 6px;
}
${X} .sc-globalHeader:has(~ div .DesktopArea) .col2 { float: none; width: auto; height: 22px; padding: 0; }
${X} .sc-globalHeader:has(~ div .DesktopArea) .sc-globalHeader-startButton { display: flex; align-items: center; height: 22px; }
${X} .sc-globalHeader:has(~ div .DesktopArea) a.sc-global-logo { width: 22px; height: 22px; margin: 0 4px; background-size: 15px 15px; }
${X} .sc-globalHeader:has(~ div .DesktopArea) .sc-globalHeader-loginInfo { float: none; height: 22px; }
${X} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation { display: flex; flex-direction: row-reverse; align-items: center; gap: 0; height: 22px; margin: 0; padding: 0; }
${X} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li { display: flex; align-items: center; height: 22px; margin: 0; padding: 0 9px; color: #000; font: 13px/22px ${FONT}; text-shadow: none; }
${X} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li :is(a, span) { color: #000; font: 13px/22px ${FONT}; text-shadow: none; }
${X} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li::after { content: none; }
${X} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li:is(:hover, :focus-within) { ${menuHot} }
${X} .sc-globalHeader:has(~ div .DesktopArea) ul.sc-accountInformation > li:is(:hover, :focus-within) :is(a, span) { color: #fff; text-decoration: none; }
${X} .sc-globalHeader:has(~ div .DesktopArea) .sc-accountInformation img { width: 16px; height: 16px; margin: 0 0 0 6px; padding: 0; border: 0; border-radius: 3px; vertical-align: middle; }
/* the clock (dom.js) at the menu bar's right end */
${X} .sct-ch-clock { position: absolute; top: 0; right: 0; height: 22px; padding: 0 12px; color: #000; font: 13px/22px ${FONT}; white-space: nowrap; }

/* ---- The Dock: a translucent white shelf centred on the bottom edge. The start button is its first tile,
   each running window a tile with the running triangle under it, and after a separator the search field and
   the database. Sitecore's own controls, restyled; nothing is moved in the DOM. ---- */
${X} .scStartbar { bottom: 0; height: 62px; z-index: 900; border: 0; background: transparent; pointer-events: none; }
${X} #Startbar {
  box-sizing: border-box;
  width: fit-content;
  max-width: calc(100% - 24px);
  height: 62px !important;
  margin: 0 auto;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: linear-gradient(rgba(255, 255, 255, 0.55), rgba(225, 235, 248, 0.42));
  backdrop-filter: blur(4px);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18), inset 0 1px rgba(255, 255, 255, 0.8);
  pointer-events: auto;
}
${X} #Startbar > table { display: flex; align-items: center; width: auto; height: 100%; border: 0; border-spacing: 0; background: none; box-shadow: none; }
${X} #Startbar > table > tbody, ${X} #Startbar > table > tbody > tr { display: contents; }
${X} #Startbar > table > tbody > tr > td { display: block; flex: none; width: auto; height: auto; padding: 0; border: 0; background: none; vertical-align: middle; }
${X} #Startbar > table > tbody > tr > td:nth-child(2) { flex: 0 1 auto; min-width: 0; }
/* the start button: an Aqua tile holding Sitecore's own start picture */
${X} .scStartButtonContainer { position: relative; width: 56px; height: 62px; }
${X} :is(.scStartButton, .scStartButton:hover, .scStartButton.scPopupOpener) { top: 0; left: 0; width: 56px; height: 62px; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none; }
${X} .scStartButton::before {
  content: "";
  position: absolute;
  top: 6px;
  left: 4px;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: radial-gradient(ellipse 80% 45% at 50% 20%, rgba(255, 255, 255, 0.75), transparent 72%), url("/sitecore/shell/themes/standard/Images/Startbar/StartButton.png") center / 80px 64px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25), 0 2px 3px rgba(0, 0, 0, 0.35);
}
${X} .scStartButton.scPopupOpener::before { filter: brightness(0.75); }
${X} .scStartButton:focus-visible { outline: none; }
${X} .scStartButton:focus-visible::before { outline: 3px solid rgba(91, 153, 232, 0.8); }
/* running windows: tiles with the 32px icon (dom.js asks for it), the running triangle beneath, the name
   above under the pointer (dom.js copies it into data-sct-label) */
${X} .scStartBarScroller { height: 62px; padding: 0; border: 0; overflow: visible; }
${X} #StartbarApplications, ${X} #StartbarApplications > tbody { display: block; height: 62px; margin: 0; }
${X} #StartbarApplications > tbody > tr { display: flex; align-items: center; height: 62px; }
${X} #StartbarApplications > tbody > tr > td {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 1 auto;
  box-sizing: border-box;
  width: 56px;
  min-width: 30px;
  height: 62px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
${X} #StartbarApplications > tbody > tr > td::after {
  content: "";
  position: absolute;
  top: auto;
  right: auto;
  bottom: 1px;
  left: calc(50% - 4px);
  display: block;
  border: 0;
  width: 9px;
  height: 5px;
  background: ${art(RUNNING)};
}
${X} #StartbarApplications > tbody > tr > td::before {
  content: attr(data-sct-label);
  position: absolute;
  top: auto;
  right: auto;
  bottom: calc(100% + 4px);
  left: 50%;
  display: none;
  max-width: 320px;
  padding: 2px 10px;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font: 12px/16px ${FONT};
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}
${X} #StartbarApplications > tbody > tr > td[data-sct-label]:hover::before { display: block; }
${X} .scStartBarApplication {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 48px;
  height: 48px;
  margin: 0 0 4px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: none;
  color: transparent;
}
${X} .scStartBarApplication span { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; padding: 0; overflow: hidden; color: transparent; font-size: 0; }
${X} .scStartBarApplication img { flex: none; width: 32px; height: 32px; margin: 0 !important; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35)); }
${X} .scStartBarApplication:hover img { transform: translateY(-2px); }
${X} .scActiveApplication .scStartBarApplication { background: radial-gradient(ellipse at 50% 60%, rgba(255, 255, 255, 0.55), transparent 70%); }
/* after a separator: the search field and the database */
${X} #Startbar > table > tbody > tr > td:last-child { padding-left: 13px; background: linear-gradient(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.22)) 5px 50% / 1px 40px no-repeat; }
${X} .scStartbarTray { height: 62px; border: 0; border-spacing: 0; background: none; }
${X} .scStartbarTray > tbody > tr > td { height: 62px; padding: 0 3px; border: 0; line-height: normal !important; vertical-align: middle; }
${X} .scStartbarTray :is(td, span) { color: #000; font: 12px ${FONT}; }
${X} #SearchBox { box-sizing: border-box; width: 170px; height: 22px; min-height: 0; margin: 0; padding: 0 10px; border: 1px solid #7a7a7a; border-radius: 11px; background: #fff; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3); color: #000; font: 12px ${FONT}; }
${X} #SearchBox::placeholder { color: #6d6d6d; }
${X} #SearchBox:focus { outline: none; ${fieldFocus} }
${X} #DatabaseSelector { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px; border-radius: 13px; background: transparent; color: #000; font: 12px ${FONT}; }
${X} #DatabaseSelector:hover { background: rgba(255, 255, 255, 0.5); }
${X} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 !important; }

/* ---- Start menu: an Aqua menu rising from the Dock's first tile (dom.js adds the account row and Log Out) ---- */
${X} .scPopup:has(> .scStartMenu) { padding: 0; border: 0; border-radius: 5px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); background: transparent; overflow: hidden; }
${X} .scStartMenu {
  box-sizing: border-box;
  width: 400px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: ${MENU_BG};
  backdrop-filter: blur(6px);
  box-shadow: none;
  overflow: hidden;
  font-family: ${FONT};
}
${X} .sct-ch-smtop { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-bottom: 1px solid #d6d6d6; background: ${HEAD}; }
${X} .sct-ch-smtop img { box-sizing: border-box; width: 32px; height: 32px; border: 1px solid #8a8a8a; border-radius: 4px; background: #e6e6e6; object-fit: cover; }
${X} .sct-ch-smtop span { overflow: hidden; color: #000; font: bold 13px/1.2 ${FONT}; text-overflow: ellipsis; white-space: nowrap; }
${X} .scStartMenuContent { margin: 0; border: 0; background: transparent; }
${X} .scStartMenuContentColumns { width: 100%; border: 0; border-collapse: collapse; table-layout: fixed; }
${X} .scStartMenuLeft, ${X} .scStartMenuRight { padding: 5px 0; vertical-align: top; background: transparent; }
${X} .scStartMenuLeft { width: 52%; }
${X} .scStartMenuRight { border-left: 1px solid #dadada; }
${X} :is(.scStartMenuLeft, .scStartMenuRight) * { color: #000; font-family: ${FONT}; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 0;
  height: auto;
  margin: 0;
  padding: 2px 12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-decoration: none;
  white-space: nowrap;
}
${X} .scStartMenuLeft .scStartMenuLeftOption { height: 40px; }
${X} .scStartMenuRight :is(.scStartMenuLeftOption, .scStartMenuRightFolder) { height: 24px; }
${X} .scStartMenuLeftOptionIcon { flex: none; width: 32px; height: 32px; margin: 0 8px 0 0; float: none; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) { width: 16px; height: 16px; margin-right: 6px; }
${X} .scStartMenuLeftOptionDescription { min-width: 0; overflow: hidden; }
${X} :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { padding: 0; font: 13px/16px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuLeftOptionTooltip { color: #555 !important; font: 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight .scStartMenuLeftOptionTooltip { display: none; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) { ${menuHot} }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) * { color: #fff !important; }
${X} .scStartMenuRightFolderDisplayName { flex: 1; }
${X} .scStartMenuDivider { height: 1px; margin: 5px 0; border: 0; background: #dadada; }
${X} img.scStartMenuRightFolderGlyph { ${paint(art(TRI_RIGHT))} order: 2; width: 8px; height: 9px; margin: 0 0 0 6px; float: none; }
${X} :is(.scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) img:is(.scStartMenuRightFolderGlyph, .scStartMenuProgramsGlyph) { background: ${art(TRI_RIGHT_W)}; }
${X} .scStartMenuPrograms { padding: 0 0 5px; background: transparent; vertical-align: bottom; }
${X} .scStartMenuPrograms .scStartMenuDivider { margin: 0 0 5px; }
${X} .scStartMenuProgramsMenu { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 12px; color: #000; text-decoration: none; }
${X} .scStartMenuProgramsMenuText { flex: 1; color: #000; font: 13px/16px ${FONT}; }
${X} img.scStartMenuProgramsGlyph { order: 2; width: 8px; height: 9px; margin: 0; ${paint(art(TRI_RIGHT))} }
${X} .sct-ch-smbottom { display: flex; flex-direction: column; padding: 5px 0; border-top: 1px solid #dadada; }
${X} .sct-ch-smbottom a { display: flex; align-items: center; gap: 6px; height: 22px; padding: 0 12px; color: #000; font: 13px ${FONT}; text-decoration: none; }
${X} .sct-ch-smbottom a:hover { ${menuHot} }
${X} .sct-ch-smbottom a img { width: 16px; height: 16px; }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: 22px ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) { box-sizing: border-box; height: 22px; min-height: 0; padding: 0 24px 0 9px; font: 12px/20px ${FONT}; ${popup} }
${X} textarea, ${X} select:is([multiple], [size]:not([size="0"], [size="1"])) { ${field} }
${X} :is(input, textarea):focus { outline: none; ${fieldFocus} }
${X} select:focus { outline: none; box-shadow: inset 0 0 0 1px #8a8a8a, 0 0 0 3px rgba(91, 153, 232, 0.7); }
${X} :is(input, textarea):disabled, ${X} select:disabled { background-color: #f4f4f4; color: #8a8a8a; border-color: #c0c0c0; }

/* Quick Info: read-only text in 19px rows, as Sitecore draws it (no frames) */
${X} .scEditorQuickInfo tr { line-height: 19px; }
${X} .scEditorQuickInfo td { padding: 1px 4px; font-size: 12px; }
${X} .scEditorQuickInfo input { height: 19px; padding: 0; border: 0; background: transparent !important; box-shadow: none; font-size: 12px; }

/* ---- Combo tables (date and time pickers, item pickers): one Aqua combo box, the blue gel end ---- */
${X} table.scCombobox {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  ${field}
}
${X} table.scCombobox :is(tbody, tr, td) { height: auto; }
${X} table.scCombobox td { padding: 0; border: 0; vertical-align: middle; }
${X} table.scCombobox input.scComboboxEdit {
  box-sizing: border-box;
  width: 100%;
  height: 20px !important;
  min-height: 0;
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
${X} table.scCombobox img.scComboboxDropDown {
  display: block;
  box-sizing: border-box;
  width: 18px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  border-left: 1px solid #2a5fa8;
  border-radius: 0;
  box-shadow: none;
  ${paint(`${art(DOWN)}, ${BLUE_GEL}`)}
}
${X} table.scCombobox img.scComboboxDropDown:active { filter: brightness(0.85); }

/* ---- Push buttons: 21px pills, wide enough for OK and Cancel ---- */
${X} :is(.scButton:not(.scEditorHeaderButton), input[type="button"], input[type="submit"]) {
  height: 21px;
  min-width: 72px;
  padding: 0 14px;
  border-radius: 11px;
  line-height: 21px;
}
${X} button:not(.ui-button) { border-radius: 11px; }
/* the default button: the token layer frames it in its fill colour */
${X} .scButton.scButtonPrimary { ${pushDefault} }
${X} .scButton.scButtonPrimary:hover:not(:disabled) { box-shadow: inset 0 0 0 1px #1d4f94, 0 1px 2px rgba(0, 0, 0, 0.3); }
${X} .scButton.scButtonPrimary:active:not(:disabled) { ${pushDown} }

/* ---- Drop-down arrows: a small black triangle for Sitecore's chevrons ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(TRI_DOWN))} }

/* ---- Tree search: a round search field and two toolbar buttons on one line ---- */
${X} #SearchPanel { padding: 4px; background: ${METAL("#d4d4d4", "#c4c4c4")}; border-bottom: 1px solid #8a8a8a; }
${X} #SearchPanel > table { width: 100%; border-spacing: 0; }
${X} #SearchPanel > table > tbody > tr > td { height: auto; padding: 0; vertical-align: middle; }
${X} #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
${X} #SearchPanel > table > tbody > tr > td > div { float: none !important; padding: 0 0 0 2px !important; }
${X} #SearchPanel .scElementHover { width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #TreeSearch { width: 100%; border-radius: 11px; padding: 0 9px; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) {
  display: block;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: 6px;
}
${X} :is(a.scSearchButton, a.scSearchOptionsButton):hover { ${toolHot} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { ${toolDown} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(TRI_DOWN))} }
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #1c5bc0; font: 12px ${FONT}; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(TRI_DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: toolbar buttons ---- */
${X} .scEditorTabControls a.scEditorHeaderButton {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  min-width: 0;
  padding: 0 4px 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 12px/20px ${FONT};
  animation: none;
}
${X} .scEditorTabControls a.scEditorHeaderButton:hover { border-color: #a5a5a5; background: ${WHITE_GEL}; }
${X} .scEditorTabControls a.scEditorHeaderButton:active { ${toolDown} }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus: Aqua's white menu, the blue selected row ---- */
${X} .scPopup:not(:has(> .scStartMenu)), ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 4px 0;
  background: ${MENU_BG};
  border: 0;
  border-radius: 0 0 5px 5px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12), 0 5px 14px rgba(0, 0, 0, 0.38);
}
${X} .scPopup > .scMenu { padding: 0; background: transparent; border: 0; box-shadow: none; }
${X} .scMenu td {
  height: auto;
  padding: 2px 4px;
  background: transparent;
  color: #000;
  font: 13px ${FONT};
  line-height: 16px;
}
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 2px 4px 2px 10px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 2px 20px 2px 4px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 2px 12px 2px 4px; text-align: right; }
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { ${menuHot} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover * { ${menuHot} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover * { background: transparent; color: #8a8a8a; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 2px solid rgba(91, 153, 232, 0.8); outline-offset: -2px; }
${X} iframe.scGalleryFrame { border: 0; border-radius: 0 0 5px 5px; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12), 0 5px 14px rgba(0, 0, 0, 0.38); }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: #8a8a8a; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(TRI_RIGHT))} }
${X} .scMenu :is(.scMenuItemHotkey_Hover, .scMenuItemCaption_Hover) img[src*="submenu16x16" i] { background: ${art(TRI_RIGHT_W)}; }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 11px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 5px, #c8c8c8 5px 6px, transparent 6px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 12px; color: #555; font: bold 12px ${FONT}; }

/* ---- Dialog tab panes: the segmented strip straddles the top edge of an etched, rounded box ---- */
${X} .scTabstrip { box-sizing: border-box; height: 22px; background: transparent; }
/* centred in dialogs; the ISE's script tabs stay at the left, beside SPE's tree and variables toggles */
${NB} .scTabstrip, ${NB} .scTabstrip > nobr { justify-content: center; }
${NB} .scTabstripContainer > .scTabs { top: 11px; left: 0; padding-top: 11px; background: rgba(0, 0, 0, 0.035); border: 1px solid #9a9a9a; border-radius: 5px; box-shadow: inset 0 1px rgba(255, 255, 255, 0.7), 0 1px rgba(255, 255, 255, 0.7); }
${X} .scTabs .scTabPage .scScrollbox { background: #fff; ${field} }
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): rows of a list, the Aqua selection ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { ${SEL} border-color: transparent; box-shadow: none; }
${X} .scRibbonGalleryList > a:is(:hover, :active) * { color: #fff; }

/* The ribbon's fold button: a disclosure triangle */
${X} a.scRibbonClose { background: ${art(TRI_OPEN)}; }
${X} a.scRibbonOpen { background: ${art(TRI_CLOSED)}; }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search: one round search field holding the filter tokens and the Clear and Search buttons ---- */
${X} .search-box { ${field} border-radius: 11px; }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; border-right: 1px solid #a5a5a5; border-radius: 0; }
${X} .search-box .sb_down { background: ${art(DOWN)}, ${WHITE_GEL}; }
${X} .search-box .sb_up { background: ${art(UP)}, ${WHITE_GEL}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; background: transparent; }
${X} .filters .filter { border: 1px solid #2a5fa8; border-radius: 10px; background: linear-gradient(#e4f0ff, #bcd9fb); color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { ${push} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, ${WHITE_GEL}; }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, ${WHITE_GEL}; }
${X} .clear-search-box :is(.btn-clear, .btn-search):hover { ${pushHot} }

${X} .scWorkboxWindowCaption { background: ${CAP}; }

/* SPEAK pages served in the shell (SPE Reports): the metal toolbar under the title, as on SPEAK pages */
${appHeader(X)}
/* jQuery UI's highlight box (the ISE's tip of the session): a help tag, pale yellow */
${X} .ui-state-highlight { border: 1px solid #a5a5a5; border-radius: 5px; background: #ffffc8; color: #000; }
${X} .ui-state-highlight :is(p, b, span, a, div) { color: #000; }
${X} .ui-state-highlight a { color: #1c5bc0; }

/* ---- Desktop windows: each is an iframe, its 1px frame and soft shadow drawn outside it ---- */
${X} #Desktop > iframe:not([style*="width: 100%"]) { box-shadow: ${FRAME_RING}; border-radius: 6px 6px 4px 4px; }
${X} #Desktop > iframe[data-sct-window="inactive"]:not([style*="width: 100%"]) { box-shadow: ${FRAME_RING_IN}; }
`;

// ==== SPEAK pages (speak and launchpad areas) ====
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px).
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-ch)`;
  return `@keyframes sct-ch-pulse { from { filter: brightness(1); } to { filter: brightness(1.12); } }
@media (prefers-reduced-motion: reduce) {
  ${S} .btn-primary { animation-duration: 3.2s !important; }
  @keyframes sct-ch-pulse { from { filter: brightness(1); } to { filter: brightness(1.05); } }
}
${SX} :is(body, input, button, select, textarea, h1, h2, h3, h4, h5, h6, p, a, span, div, li, label, td, th, nav, header, section):not([class*="glyphicon"], .fa, [class*="fa-"]) {
  font-family: ${FONT};
}
${header(SX)}
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-globalHeader-startButton { display: flex; align-items: center; box-sizing: border-box; width: auto; height: ${band}px; margin: 0; background: transparent; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-globalheader-appName:not(:empty) { height: ${band}px; margin: 0; padding: 0 8px; ${capText} line-height: ${band}px; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation { height: ${band}px; line-height: ${band}px; vertical-align: top; box-shadow: none; background: transparent; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li { height: ${band}px; line-height: ${band}px; vertical-align: top; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { vertical-align: top; margin-top: ${(band - 34) / 2}px; margin-bottom: 0; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-ext-dbName { line-height: ${band}px; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a { text-decoration: none; }
${SX} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a:hover { text-decoration: underline; }

/* ---- Fields, check boxes, push buttons ---- */
${SX} :is(input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), .form-control) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${SX} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; box-sizing: border-box; height: 22px; min-height: 0; padding: 0 24px 0 9px; font: 12px/20px ${FONT}; ${popup} }
${SX} textarea { ${field} }
${SX} :is(input, textarea, .form-control):focus { outline: none; ${fieldFocus} }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  margin: 0 4px 0 0;
  vertical-align: -3px;
  border: 0;
  border-radius: 3px;
  outline: none;
  background: ${WHITE_GEL};
  box-shadow: inset 0 0 0 1px #8a8a8a;
}
${SX} input[type="radio"] { border-radius: 50%; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK)}, ${BLUE_GEL}; box-shadow: inset 0 0 0 1px #2a5fa8; }
${SX} input[type="radio"]:checked { background: radial-gradient(circle, #1e1e1e 0 2.2px, transparent 2.8px), ${BLUE_GEL}; box-shadow: inset 0 0 0 1px #2a5fa8; }
${SX} .btn {
  height: 21px;
  min-width: 72px;
  padding: 0 14px;
  font: 12px/21px ${FONT};
  ${push}
}
${SX} .btn :is(span, .sc-button-text) { color: inherit; font: inherit; }
${SX} .btn:hover, ${SX} .btn:focus { ${push} ${pushHot} }
${SX} .btn:active, ${SX} .btn.active { ${pushDown} }
${SX} .btn:focus-visible { outline: none; box-shadow: inset 0 0 0 1px #2a5fa8, 0 0 0 3px rgba(91, 153, 232, 0.7); }
${SX} .btn:disabled, ${SX} .btn.disabled { ${pushOff} opacity: 1; }
${SX} .btn.btn-primary { ${pushDefault} }
${SX} .btn.btn-primary :is(span, .sc-button-text) { color: #000; }
`;
};

const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-ch)`;
const EE = `${SPX} .sc-pageeditbar`;
const speak = `/* Cheetah: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-cheetah-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's metal toolbar ==== */
${EE} { color: #000; font: 12px ${FONT}; }
${EE} .sc-quickbar {
  display: flex;
  align-items: center;
  height: auto;
  padding: 4px 4px 3px;
  border: 0;
  background: ${METAL("#d4d4d4", "#c8c8c8")};
  box-shadow: none;
}
${EE} .sc-quickbar-item { float: none; margin: 0; text-transform: none; cursor: default; }
${EE} .sc-quickbar-button {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0 1px 0 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  box-shadow: none;
  opacity: 1;
}
${EE} .sc-quickbar-button:not(.disabled):hover { ${toolHot} }
${EE} .sc-quickbar-button:not(.disabled):active { ${toolDown} }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 16px; height: 16px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${art(TRI_OPEN)}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${art(TRI_CLOSED)}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  ${seg}
  position: relative;
  height: 20px;
  padding: 0 12px;
  margin: 0 0 0 -1px;
  font: 12px/20px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-tab:not(.sc-quickbar-tab-selected):hover { box-shadow: inset 0 0 0 1px #6b6b6b; }
${EE} .sc-quickbar-tab:first-of-type { border-radius: 10px 0 0 10px; }
${EE} .sc-quickbar-tab:last-of-type { border-radius: 0 10px 10px 0; }
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 2px solid rgba(91, 153, 232, 0.8); outline-offset: 0; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected { ${segOpen} z-index: 1; }

${EE} .sc-ribbon { background: ${METAL("#c8c8c8", "#a9a9a9")}; border: 0; border-bottom: 1px solid #6e6e6e; box-shadow: none; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 1px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 2px 3px 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 0;
  box-shadow: 1px 0 rgba(255, 255, 255, 0.4);
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
/* As tight as the Content Editor's: 46px buttons 3px below the chunk's top, 4px from its sides, clear of the caption */
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; box-sizing: border-box; height: 50px; min-height: 0; margin: 0; padding: 3px 4px 0; }
${EE} .sc-chunk-label { height: 18px; margin: 0; padding: 0 6px; color: #222; font: 11px/18px ${FONT}; text-align: center; text-transform: none; text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5); }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
  float: left;
  box-sizing: border-box;
  height: 46px;
  margin: 0;
  padding: 2px 5px 1px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
}
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) > [class*="sprite"] { display: block; margin: 0 auto; }
${EE} .sc-chunk-button-label { margin: 0; padding: 3px 0 0; color: #000; font: 11px/12px ${FONT}; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover { ${toolHot} }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed { ${toolDown} }
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: #5e5e5e; }
${EE} .disabled > [class*="sprite"] { opacity: 0.45; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-small, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton).disabled { opacity: 1; }
${EE} .sc-chunk-button-small-list { float: left; margin: 0; padding: 0; }
${EE} :is(.sc-chunk-button-small, .sc-chunk-check-small) {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 21px;
  margin: 0;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  box-shadow: none;
  color: #000;
  white-space: nowrap;
}
${EE} .sc-chunk-button-small > [class*="sprite"] { float: none; margin: 0; }
${EE} :is(.sc-chunk-button-small .sc-chunk-button-label, .sc-chunk-check-small-label) { display: inline; float: none; padding: 0; color: #000; font: 11px/16px ${FONT}; }
${EE} .sc-chunk-check-list { float: left; padding-top: 2px; }
${EE} input.sc-smallcheckbox { margin: 0; }
${EE} :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton)::after { content: none; }
${EE} :is(.sc-chunk-button-dropdown, .sc-chunk-gallerybutton) .sc-chunk-button-label::after {
  content: "";
  display: inline-block;
  width: 7px;
  height: 5px;
  margin: 0 0 1px 3px;
  background: ${art(TRI_DOWN, [0, 0])};
}
/* The date box fills the button row (3px down), not 55px of SPEAK's padded panel over the caption */
${EE} .sc-chunk-panel:has(> .sc-chunk-datepanel) { height: auto; margin: 0; padding: 0; }
${EE} .sc-chunk-datepanel { display: flex; align-items: center; height: 46px; margin: 0; padding: 0 2px; border: 0; border-radius: 0; background: none; box-shadow: none; }
${EE} .sc-chunk-datepanel > * { max-height: 46px; }
${EE} .sc-chunk-datepanel-selector { display: flex; align-items: center; gap: 4px; box-sizing: border-box; height: 46px; padding: 0 6px; overflow: hidden; background: #fff; color: #000; ${field} }
${EE} .sc-chunk-datepanel-monthyear { height: auto; padding: 0; }
${EE} .sc-chunk-datepanel-selector * { color: #000; font-family: ${FONT}; }

/* The item path under the ribbon: a path bar on the pinstripes */
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 30px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: ${PINSTRIPES};
  border: 0;
  border-bottom: 1px solid #a5a5a5;
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 4px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: 12px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { color: #1c5bc0; text-decoration: underline; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 14px;
  padding: 0 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
}
${EE} .sc-breadcrumb-item-button { width: 22px; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { border-color: #a5a5a5; background: ${WHITE_GEL}; }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(TRI_RIGHT)}; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 21px; min-width: 60px; padding: 0 12px; line-height: 21px; }

/* ==== Control Panel: System Preferences, a band per category, the categories' bold names at the left ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: ${PINSTRIPES}; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
/* every SPEAK application's header (Control Panel, SPE Reports, Forms): the metal toolbar */
${appHeader(SPX)}
${SPX} .sc-applicationContent-main { background: none; }
${SPX} .sc-controlpanel-box { box-sizing: border-box; margin: 0; padding: 8px 0 10px; border: 0; border-bottom: 1px solid #c8c8c8; border-radius: 0; background: transparent; box-shadow: none; }
${SPX} .sc-controlpanel-box:nth-child(even) { background: rgba(0, 0, 0, 0.035); }
${SPX} .sc-controlpanel-box-header { margin: 0; padding: 0; color: #000; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 { display: flex; align-items: center; box-sizing: border-box; height: 22px; margin: 0; padding: 0 10px; color: #000; font: bold 13px/22px ${FONT}; text-transform: none; white-space: nowrap; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0 6px 0 0; }
${SPX} .sc-controlpanel-box-content { box-sizing: border-box; margin: 0; padding: 2px 10px 0 32px; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 2px 0; color: #1c5bc0; font: 12px/16px ${FONT}; text-decoration: none; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { color: #0b3f99; text-decoration: underline; background: transparent; }
${SPX} .sc-controlpanel-no-items { color: #555; }

/* ==== Forms: the selected navigation entry and tab sit on the selection blue ==== */
${SPX} .header.menuItem :is(a, span) { color: #fff; }
${SPX} .sc-tab-control-tab-item.selected :is(a, span) { color: #fff; }
`;

// ==== Launchpad: a Finder window on the Aqua desktop. Brushed metal round a white pane, a sidebar at the left
// holding the analytics message, the applications as large icons in groups headed by disclosure triangles,
// the Finder's selection under the pointer. A group or the analytics collapses from its header (dom.js).
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-ch)`;
const SIDE = 220; // the sidebar's width
const AQUA_DESK = "radial-gradient(ellipse 60% 40% at 72% 78%, rgba(160, 205, 255, 0.35), transparent 70%), radial-gradient(ellipse 80% 55% at 28% 18%, #8fb8ef 0%, #3b6cc4 48%, #1f3f86 100%)";
const launchpad = `/* Cheetah: Launchpad. Generated by tools/build-cheetah-css.cjs.
   A brushed metal Finder window on the Aqua desktop: a sidebar, the applications as large icons in groups. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: ${AQUA_DESK} fixed; }
${LPX} .sc-applicationContent { padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; background: none; }
/* Sitecore gives the main section min-height: 100vh under the 48px header, so every page scrolled 48px; the
   grid below fills the window instead */
${LPX} .sc-applicationContent-main > .row { margin: 0; }
/* The page title sits in the header, after the logo */
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title { display: flex; align-items: center; top: 0; left: 44px; box-sizing: border-box; height: 47px; padding: 0 8px; background: transparent; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { ${capText} line-height: 24px; }
/* the window: brushed metal round the sidebar and the icon pane */
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: ${SIDE}px minmax(0, 1fr);
  grid-template-rows: auto auto auto 1fr;
  align-items: start;
  column-gap: 0;
  box-sizing: border-box;
  width: auto;
  min-height: calc(100vh - 48px - 44px);
  margin: 18px 22px 26px;
  padding: 22px 6px 6px;
  float: none;
  border: 1px solid #6e6e6e;
  border-radius: 6px 6px 4px 4px;
  background: ${METAL("#dcdcdc", "#a9a9a9")};
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5), inset 0 1px rgba(255, 255, 255, 0.7);
  position: relative;
}
/* the window's title (no lights: this window cannot be closed or zoomed) */
${LPX} [data-sc-id="ColumnPanel1"]::before { content: "Applications"; position: absolute; top: 0; left: 0; right: 0; height: 22px; ${capText} line-height: 22px; text-align: center; }
/* the sidebar: the analytics message, its name a disclosure row */
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 1; float: none; width: auto; margin: 0 4px 0 0; }
${LPX} [data-sc-id="CustomAnalyticsLabel"] { grid-row: 1; }
${LPX} [data-sc-id="FallBackMessageBorder"] { grid-row: 2; }
${LPX} [data-sc-id="RowPanelTilesWrapper"] { grid-row: 3; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"] {
  position: static;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 22px;
  margin: 0 4px 0 0;
  padding: 0 8px;
  border: 1px solid #8a8a8a;
  border-bottom: 0;
  border-radius: 4px 4px 0 0;
  background: #e8ecf1;
  color: #000;
  font: bold 11px/22px ${FONT};
  text-transform: uppercase;
  cursor: pointer;
}
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]::before { content: ""; flex: none; width: 9px; height: 7px; background: ${art(TRI_OPEN)}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"]::before { width: 7px; height: 9px; background: ${art(TRI_CLOSED)}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] { border-bottom: 1px solid #8a8a8a; border-radius: 4px; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] + .sc-border { display: none; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] { box-sizing: border-box; margin: 0 4px 0 0; padding: 4px 10px 10px 23px; border: 1px solid #8a8a8a; border-top: 0; border-radius: 0 0 4px 4px; background: #e8ecf1; box-shadow: none; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 0; color: #000; font: 11px/15px ${FONT}; text-align: left; }

/* the icon pane: white, the groups headed by disclosure rows */
${LPX} .sc-launchpad {
  grid-column: 2;
  grid-row: 1 / 5;
  align-self: stretch;
  display: block;
  box-sizing: border-box;
  max-width: none;
  min-height: 100%;
  margin: 0;
  padding: 10px 16px;
  float: none;
  border: 1px solid #8a8a8a;
  border-radius: 4px;
  background: #fff;
}
${LPX} .sc-launchpad-group {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px 8px;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
${LPX} .sc-launchpad-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 100%;
  box-sizing: border-box;
  height: 20px;
  margin: 0 0 4px;
  padding: 0 2px;
  border: 0;
  border-bottom: 1px solid #dadada;
  background: none;
  color: #000;
  font: bold 12px/20px ${FONT};
  text-transform: none;
  cursor: pointer;
}
${LPX} .sc-launchpad-group-title::before { content: ""; flex: none; width: 11px; height: 7px; background: ${art(TRI_OPEN)}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-group-title::before { width: 7px; height: 11px; background: ${art(TRI_CLOSED)}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-item { display: none; }
/* an icon: 48px over its name; the Finder's selection, a dark rounded plate round the icon and the name in a
   blue pill */
${LPX} .sc-launchpad-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  box-sizing: border-box;
  width: 104px;
  height: 100px;
  margin: 0;
  padding: 4px 2px;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
  text-decoration: none;
}
${LPX} .sc-launchpad-item .icon { flex: none; box-sizing: border-box; width: 56px; height: 56px; margin: 0; padding: 4px; border-radius: 6px; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 48px; height: 48px; margin: 0; }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: 100%; padding: 0 6px; overflow: hidden; border-radius: 8px; color: #000; font: 11px/15px ${FONT}; white-space: normal; text-align: center; }
${LPX} .sc-launchpad-item:hover { text-decoration: none; }
${LPX} .sc-launchpad-item:hover .icon { background: rgba(0, 0, 0, 0.12); }
${LPX} .sc-launchpad-item:is(:focus, :active) { outline: none; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .icon { background: rgba(0, 0, 0, 0.22); }
${LPX} .sc-launchpad-item:is(:hover, :focus-visible, :active) .sc-launchpad-text { ${SEL} }
`;

// ==== Login: the login window on the Aqua desktop. A pinstriped window with a metal title bar, the logo in a
// white band at its top, the fields with their labels to the left, Log In the pulsing default button.
const LG = SURFACE("login");
const login = `/* Cheetah: Identity Server login. Generated by tools/build-cheetah-css.cjs.
   Mac OS X's login window. */
@keyframes sct-ch-pulse { from { filter: brightness(1); } to { filter: brightness(1.12); } }
@media (prefers-reduced-motion: reduce) {
  ${LG} .btn.btn-primary { animation-duration: 3.2s !important; }
  @keyframes sct-ch-pulse { from { filter: brightness(1); } to { filter: brightness(1.05); } }
}
${LG} body {
  min-height: 100vh;
  margin: 0;
  background: ${AQUA_DESK};
  color: #000;
  font: 12px ${FONT};
}
${LG} .top { position: absolute; top: 0; right: 0; z-index: 1; height: auto; padding: 0 16px; border: 0; background: transparent; box-shadow: none; color: #fff; font: 13px/22px ${FONT}; }
${LG} .top a { color: #fff; }
${LG} .main-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: transparent; }
${LG} .main {
  position: relative;
  box-sizing: border-box;
  width: min(380px, 100% - 32px);
  margin: 0 auto;
  padding: 22px 0 0;
  border: 1px solid #6e6e6e;
  border-radius: 6px 6px 4px 4px;
  background: linear-gradient(#e4e4e4, #c2c2c2) top / 100% 22px no-repeat, ${PINSTRIPES};
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.55);
  color: #000;
  overflow: hidden;
}
${LG} .main::before { content: none; }
${LG} .logo-wrap { margin: 0; padding: 18px 20px; border-top: 1px solid #7d7d7d; border-bottom: 1px solid #c8c8c8; background: #fff; text-align: center; }
${LG} .logo-wrap img { max-width: 200px; height: auto; filter: brightness(0) opacity(0.8); }
${LG} .login-page { margin: 0; padding: 16px 20px 18px; background: transparent; }
${LG} .login-page fieldset { margin: 0; padding: 0; border: 0; }
${LG} .login-page .form-group { margin: 0 0 8px; color: #000; }
${LG} label { color: #000; font: 12px ${FONT}; }
${LG} .form-control {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 22px;
  margin: 3px 0 6px;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${LG} .form-control:focus { outline: none; ${fieldFocus} }
${LG} .form-control::placeholder { color: #6d6d6d; }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: block;
  width: auto;
  min-width: 80px;
  height: 21px;
  margin-left: auto;
  padding: 0 16px;
  border: 0;
  border-radius: 11px;
  ${pushDefault}
  color: #000;
  font: 12px/21px ${FONT};
  text-shadow: none;
  text-transform: none;
}
${LG} .btn.btn-primary:is(:hover, :focus) { background: ${BLUE_GEL}; color: #000; }
${LG} .btn.btn-primary:active { ${pushDown} }
${LG} .btn.btn-primary:focus-visible { outline: none; box-shadow: inset 0 0 0 1px #2a5fa8, 0 0 0 3px rgba(91, 153, 232, 0.7); }
${LG} input[type="checkbox"] { appearance: none; box-sizing: border-box; width: 14px; height: 14px; margin: 0 4px 0 0; vertical-align: -3px; border: 0; border-radius: 3px; background: ${WHITE_GEL}; box-shadow: inset 0 0 0 1px #8a8a8a; }
${LG} input[type="checkbox"]:checked { background: ${art(CHECK)}, ${BLUE_GEL}; box-shadow: inset 0 0 0 1px #2a5fa8; }
${LG} .remember-me { display: inline-flex; align-items: center; padding: 0; color: #000; font: 12px ${FONT}; }
${LG} .remember-me input[type="checkbox"] { position: static; flex: none; }
${LG} a, ${LG} .forgot-password { color: #1c5bc0; font: 12px ${FONT}; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #b3140a; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", ID);
for (const [name, text] of Object.entries({ shell: css, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
