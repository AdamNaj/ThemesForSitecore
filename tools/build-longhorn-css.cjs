// Dev tool: writes extension/themes/longhorn/{shell,speak,launchpad,login}.css and the glyphs they use.
// Longhorn recreates Windows Vista's Aero. Its caption buttons, scroll arrows, check marks and tree triangles are
// glyphs (PNG plus vector SVG pairs, see art()), so the theme is generated here rather than written by hand.
//
// Measured Aero (Vista SP2 at 96 dpi, Aero.msstyles, default "Default" glass colour):
//   window body #f0f0f0; text #000; Segoe UI 9pt (12px)
//   caption 30px with the 8px top frame, glass tinted #a9c6e3 to #7ea6cf, two diagonal light streaks; text
//     Segoe UI 12px black with a white glow; top corners 6px; frame 8px of glass, 1px dark outline outside and a
//     1px white line inside. Inside a window the glass is drawn opaque (an iframe cannot blur the desktop).
//   caption buttons hang from the top edge as one group: minimize and maximize 26x18, close 43x18, 1px dark
//     frame, bottom corners 4px; glass faces split at half height, close red (#c0392b under #d46a5c); glyphs
//     white with a dark outline; hover glows blue (close: brighter red)
//   tabs: #898c95 frame, 2px top corners, face #f2f2f2 / #ebebeb | #dddddd / #cfcfcf split at half height;
//     hover the blue gel (#3c7fb1 frame, #eaf6fd / #d9f0fc | #bee6fd / #a7d9f5); the open tab white, 2px
//     taller, joined to its white page
//   push buttons 23px, #707070 frame, 3px corners, the same grey split face; hover the blue gel; pressed
//     #2c628b with #e5f4fc / #c4e5f6 | #98d1ef / #68b3db; default #3c7fb1 with a pale blue inner ring
//   fields 22px, border #abadb3 top, #dbdfe6 sides, #e3e9ef bottom; hover #5794bf; focus #3d7bad
//   Explorer selection boxes, 1px frame, 3px corners: hover #b8d6fb round #fafbfd > #ebf3fd; selected #84acdd
//     round #f1f7fe > #d0e5fc; black text. Tree triangles: hollow #a6a6a6 closed, filled #404040 open.
//   group headers (Explorer, here the Content Editor's sections): #1e3287 text, a line fading out after it
//   menus: #f0f0f0 face, #979797 frame, a 28px icon gutter with a #e2e3e3 / #fff line; hover a #aecff7 box
//     round #f2f7fe > #dbeafc
//   scroll bar 17px: track #f2f2f2, thumb and buttons #959595 frame, 2px corners, grey split face; hover blue
//   taskbar 30px of black glass (Longhorn: 34px for Sitecore's larger windows), the round orb 38px across
//     rising over its top edge; buttons 160px at most, dark glass, the active one lit blue; tray darker
//   start menu: dark glass round a white program list with a #959595 frame, the user's picture in a glass frame
//     above the right column, white links on the glass, Log Off at the bottom right
//   Vista's text highlight #3399ff fails AA under white (3.0:1): Longhorn's accent is its link blue #0066cc.
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const ID = "longhorn";
const SURFACE = (s) => `html[data-sct-theme="${ID}"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-lh) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-lh)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
const FONT = '"Segoe UI", Tahoma, Verdana, sans-serif';
// Colours of the pixel art: W white, K black, D the caption glyphs' dark outline, A the scroll and combo
// arrows, L the closed tree triangle's outline, T the open tree triangle, C the check mark.
const COLORS = { W: "#fff", K: "#000", D: "#1f3349", A: "#404040", L: "#6d6d6d", T: "#3a3a3a", C: "#1f3d6e" };

// ---- Pixel art (as in tools/build-metal-css.cjs): one character per pixel, '.' transparent. Each glyph is
// written to themes/longhorn/glyphs twice, as a PNG (1x) and as a vector SVG (every other scale), and named
// sct-ext:, which background.js points at the extension (a site's CSP can block data:). Placed centred, at
// [x, y] from the box's top left, or, given a number, that many pixels in from the right, centred vertically.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.WKDALTC]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
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
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([len, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
// At exactly 100% the PNGs are drawn nearest-neighbour; the property inherits, so a zero-specificity reset
// keeps it off children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-lh-)/.test(m[2]))
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
// caption buttons: white shapes with a dark outline, as Aero draws them on glass
const MIN = ["DDDDDDDDDD", "DWWWWWWWWD", "DWWWWWWWWD", "DDDDDDDDDD"];
const MAX = ["DDDDDDDDDDD", "DWWWWWWWWWD", "DWWWWWWWWWD", "DWDDDDDDDWD", "DWD.....DWD", "DWD.....DWD", "DWDDDDDDDWD", "DWWWWWWWWWD", "DDDDDDDDDDD"];
const RESTORE = [
  "...DDDDDDDD", "...DWWWWWWD", "...DWWWWWWD", "DDDDDDDDDWD", "DWWWWWWDDWD",
  "DWWWWWWDDWD", "DWDDDDWDDDD", "DWD..DWD...", "DWWWWWWD...", "DDDDDDDD...",
];
const CLOSE = [
  "DDD.....DDD", "DWWD...DWWD", "DWWWD.DWWWD", ".DWWWDWWWD.", "..DWWWWWD..",
  "..DWWWWWD..", ".DWWWDWWWD.", "DWWWD.DWWWD", "DWWD...DWWD", "DDD.....DDD",
];
vector(CLOSE, `<path d="M1.2 1.2L9.8 8.8M9.8 1.2L1.2 8.8" stroke="${COLORS.D}" stroke-width="3.6" stroke-linecap="square"/><path d="M1.6 1.6L9.4 8.4M9.4 1.6L1.6 8.4" stroke="#fff" stroke-width="1.8" stroke-linecap="square"/>`);
vector(MIN, `<rect x="0.5" y="0.5" width="9" height="3" fill="#fff" stroke="${COLORS.D}"/>`);
vector(MAX, `<path d="M0.5 0.5H10.5V8.5H0.5Z" fill="#fff" stroke="${COLORS.D}"/><path d="M2.5 3.5H8.5V6.5H2.5Z" fill="none" stroke="${COLORS.D}"/>`);
// scroll arrows, combo and drop-down arrows: small solid triangles
const UP = ["...A...", "..AAA..", ".AAAAA.", "AAAAAAA"];
const DOWN = [...UP].reverse();
const LEFT = ["...A", "..AA", ".AAA", "AAAA", ".AAA", "..AA", "...A"];
const RIGHT = LEFT.map((r) => [...r].reverse().join(""));
vector(UP, `<path d="M0 4L3.5 0.5L7 4Z" fill="${COLORS.A}"/>`);
vector(DOWN, `<path d="M0 0L3.5 3.5L7 0Z" fill="${COLORS.A}"/>`);
vector(LEFT, `<path d="M4 0L0.5 3.5L4 7Z" fill="${COLORS.A}"/>`);
vector(RIGHT, `<path d="M0 0L3.5 3.5L0 7Z" fill="${COLORS.A}"/>`);
// menu fly-outs and ribbon drop-downs: black triangles
const TRI_RIGHT = ["K...", "KK..", "KKK.", "KKKK", "KKK.", "KK..", "K..."];
const TRI_DOWN = ["KKKKK", ".KKK.", "..K.."];
vector(TRI_RIGHT, `<path d="M0 0L4 3.5L0 7Z" fill="#000"/>`);
vector(TRI_DOWN, `<path d="M0 0H5L2.5 3Z" fill="#000"/>`);
// the tree: a hollow triangle pointing right when closed, a filled one pointing down-right when open
const TREE_CLOSED = ["L...", "LL..", "LWL.", "LWWL", "LWL.", "LL..", "L..."];
const TREE_OPEN = [".....T", "....TT", "...TTT", "..TTTT", ".TTTTT", "TTTTTT"];
vector(TREE_CLOSED, `<path d="M0.5 0.5L3.5 3.5L0.5 6.5Z" fill="#fff" stroke="${COLORS.L}"/>`);
vector(TREE_OPEN, `<path d="M6 0V6H0Z" fill="${COLORS.T}"/>`);
// group header chevrons (the Content Editor's sections): two-pixel strokes, up when open
const CHEV_UP = ["...T...", "..TTT..", ".TT.TT.", "TT...TT"];
const CHEV_DOWN = [...CHEV_UP].reverse();
vector(CHEV_UP, `<path d="M0.6 3.6L3.5 0.7L6.4 3.6" fill="none" stroke="${COLORS.T}" stroke-width="1.5"/>`);
vector(CHEV_DOWN, `<path d="M0.6 0.4L3.5 3.3L6.4 0.4" fill="none" stroke="${COLORS.T}" stroke-width="1.5"/>`);
// the check mark
const CHECK = ["......C", ".....CC", "C...CCC", "CC.CCC.", "CCCCC..", ".CCC...", "..C...."];
vector(CHECK, `<path d="M0.7 3.2L2.5 5.2L6.4 1" fill="none" stroke="${COLORS.C}" stroke-width="2"/>`);
// the round Back button's arrow and the login's go arrow: white
const BACK = ["...W....", "..WW....", ".WWWWWWW", "WWWWWWWW", ".WWWWWWW", "..WW....", "...W...."];
const GO = BACK.map((r) => [...r].reverse().join(""));
vector(BACK, `<path d="M8 3.5H2M4.2 0.8L1.2 3.5L4.2 6.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);
vector(GO, `<path d="M0 3.5H6M3.8 0.8L6.8 3.5L3.8 6.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`);

// ---- Aero recipes ----
// glass, drawn opaque: two soft diagonal streaks over the tint
const STREAKS = "linear-gradient(115deg, transparent 0 16%, rgba(255, 255, 255, 0.28) 19%, transparent 23%, transparent 58%, rgba(255, 255, 255, 0.42) 61%, transparent 65%)";
const CAP = `${STREAKS}, linear-gradient(#bfd6ee, #a9c6e3 45%, #94b6da)`;
const CAP_IN = "linear-gradient(#e2ebf5, #d3e1ee 45%, #c7d7e8)";
const GLASS = "#9cbde0"; // the frame ring, the caption's middle
const GLASS_IN = "#cddcec";
const capText = `color: #000; font: 12px/1 ${FONT}; text-shadow: 0 0 6px #fff, 0 0 3px #fff, 0 0 1px #fff;`;
// caption buttons, faces split at half height
const BTN_FACE = "linear-gradient(rgba(255, 255, 255, 0.75), rgba(222, 236, 248, 0.6) 50%, rgba(150, 188, 222, 0.7) 50%, rgba(204, 228, 247, 0.8))";
const BTN_HOT = "linear-gradient(#d6efff, #9fd2f5 50%, #3d95d8 50%, #8fd3f7)";
const BTN_CLOSE = "linear-gradient(#e8a49a, #d46a5c 50%, #c0392b 50%, #e07a6a)";
const BTN_CLOSE_HOT = "linear-gradient(#f7c0b4, #ea7a66 50%, #d8301a 50%, #f3907a)";
const BTN_FRAME = "#33475f";
// Real glass for Desktop windows: the Desktop blurs what lies behind a window's iframe and tints it (AERO), and
// the window's caption is clear over that, so frame and caption are one sheet of glass; inactive windows are
// paler and clearer (AERO_IN)
const AERO = `${STREAKS}, rgba(118, 162, 210, 0.42)`;
const AERO_IN = "rgba(196, 214, 232, 0.55)";
// the grey split face shared by push buttons, tabs, scroll bars
const GREY = "linear-gradient(#f2f2f2, #ebebeb 50%, #dddddd 50%, #cfcfcf)";
const GREY_V = "linear-gradient(90deg, #f3f3f3, #e8e8e8 50%, #d6d6d6 50%, #d8d8d8)";
const GEL = "linear-gradient(#eaf6fd, #d9f0fc 50%, #bee6fd 50%, #a7d9f5)";
const GEL_V = "linear-gradient(90deg, #e3f4fc, #d6eef9 50%, #a9dbf6 50%, #a4d9f5)";
const GEL_DOWN = "linear-gradient(#e5f4fc, #c4e5f6 50%, #98d1ef 50%, #68b3db)";
// tabs
const tab = `border: 1px solid #898c95; border-bottom: 0; border-radius: 2px 2px 0 0; background: ${GREY}; box-shadow: inset 1px 1px rgba(255, 255, 255, 0.7); color: #000; text-transform: none; text-shadow: none;`;
const tabHot = `border-color: #3c7fb1; background: ${GEL};`;
const tabOpen = "border-color: #898c95; background: #fff; box-shadow: none;";
// push buttons
const push = `box-sizing: border-box; border: 1px solid #707070; border-radius: 3px; background: ${GREY}; color: #000; text-shadow: none; text-transform: none; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.75);`;
const pushHot = `border-color: #3c7fb1; background: ${GEL}; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);`;
const pushDefault = "border-color: #3c7fb1; box-shadow: inset 0 0 0 1px #9fd8f7;";
const pushDown = `border-color: #2c628b; background: ${GEL_DOWN}; box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.25);`;
const pushOff = "border-color: #adb2b5; background: #f4f4f4; color: #838383; box-shadow: none;";
// the Explorer's selection boxes (ribbon buttons, tree rows, tiles): hot under the pointer, then selected
const hot = "border-color: #b8d6fb; background: linear-gradient(#fafbfd, #ebf3fd); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);";
const picked = "border-color: #84acdd; background: linear-gradient(#f1f7fe, #d0e5fc); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);";
const pickedDown = "border-color: #7da2ce; background: linear-gradient(#dcebfc, #c1dbfc); box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);";
// fields
const field = "border: 1px solid; border-color: #abadb3 #dbdfe6 #e3e9ef #e2e3ea; border-radius: 2px; background-color: #fff; color: #000; box-shadow: none;";
const fieldHot = "border-color: #5794bf #c5daed #b7d5ea #c7e2f1;";
const fieldFocus = "border-color: #3d7bad #a4c9e3 #b7d9ed #b5cfe7;";
const comboBtn = `${art(DOWN, 6)}`;
// the scroll bar's thumb and buttons
const scrollFrame = "inset 0 0 0 1px #959595, inset 0 0 0 2px rgba(255, 255, 255, 0.65)";
const scrollHotFrame = "inset 0 0 0 1px #3c7fb1, inset 0 0 0 2px rgba(255, 255, 255, 0.55)";
// the dark glass of the taskbar and the start menu
const BLACK_GLASS = "linear-gradient(rgba(78, 82, 88, 0.92), rgba(28, 30, 34, 0.94) 50%, rgba(0, 0, 0, 0.96) 50%, rgba(22, 24, 28, 0.96))";
// the menu hover
const menuHot = "background: linear-gradient(#f2f7fe, #dbeafc); color: #000;";
// the text highlight of lists, the accent
const SEL = "background: #0066cc; color: #fff;";
// the Explorer's group header line
const groupLine = "linear-gradient(90deg, #a6bcd8, #e2e9f3 45%, transparent) left bottom / 100% 1px no-repeat";
const NAVY = "#1e3287";

const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");
const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
const LC = ":is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)";

// The global header (standalone Content Editor, SPEAK pages): a glass caption.
const header = (S) => `/* ---- Global header: a glass caption ---- */
${S} :is(.sc-globalHeader, .sc-flx-global-header) { background: ${CAP}; border-bottom: 1px solid #5a7fa3; box-shadow: inset 0 -1px rgba(255, 255, 255, 0.45); color: #000; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation span,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a,
${S} :is(.sc-globalHeader, .sc-flx-global-header) a { color: #000; font-family: ${FONT}; text-shadow: 0 0 6px #fff, 0 0 3px #fff; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::before, ${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::after { color: #000; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { border: 1px solid #fff; border-radius: 3px; box-shadow: 0 0 0 1px #5a7fa3; }
`;

// The application header of a SPEAK page (title, Back): Vista's address bar under the caption, with the round
// blue Back button.
const backBtn = (SX) => `${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 26px; min-width: 0; padding: 0 8px 0 0; border: 0; background: none; box-shadow: none; }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: 12px/24px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton:hover .sc-backbutton-text { text-decoration: underline; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before {
  position: static;
  flex: none;
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  border: 1px solid #1d4f86;
  border-radius: 50%;
  background: ${art(BACK)}, radial-gradient(circle at 50% 28%, #bde3ff, #4b9be0 45%, #1a5ea8 75%, #2c7fd0);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.6);
  mask: none;
  transform: none;
}
${SX} .btn.sc-backbutton:hover::before { background: ${art(BACK)}, radial-gradient(circle at 50% 28%, #d7f0ff, #62b4f5 45%, #2072c4 75%, #46a2f0); }
${SX} .btn.sc-backbutton:active::before { filter: brightness(0.85); }`;
const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: #f0f0f0; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: #f0f0f0; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 10px 15px 6px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: ${NAVY}; font: 17px/24px ${FONT}; }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 15px 8px; background: #f0f0f0; border: 0; border-bottom: 1px solid #a0afc3; box-shadow: none; }
${backBtn(SX)}`;

const css = `/* Longhorn: classic shell. Generated by tools/build-longhorn-css.cjs; never hand-edit.
   Windows Vista's Aero: glass captions with a sheen, the #f0f0f0 window body, glossy split buttons and tabs,
   the Explorer's pale blue selection boxes, Segoe UI. */

${P} {
  --sct-lh-min: ${art(MIN)}, ${BTN_FACE};
  --sct-lh-max: ${art(MAX)}, ${BTN_FACE};
  --sct-lh-restore: ${art(RESTORE)}, ${BTN_FACE};
  --sct-lh-close: ${art(CLOSE)}, ${BTN_CLOSE};
  --sct-lh-min-hot: ${art(MIN)}, ${BTN_HOT};
  --sct-lh-max-hot: ${art(MAX)}, ${BTN_HOT};
  --sct-lh-restore-hot: ${art(RESTORE)}, ${BTN_HOT};
  --sct-lh-close-hot: ${art(CLOSE)}, ${BTN_CLOSE_HOT};
}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} { scrollbar-color: auto; }

/* ---- Scrollbars: Aero's grey split thumb and buttons on a pale track, blue under the pointer ---- */
${P} ::-webkit-scrollbar { width: 17px; height: 17px; background: #f2f2f2; }
${P} ::-webkit-scrollbar-track { border-radius: 0; }
${P} ::-webkit-scrollbar-track:vertical { background: linear-gradient(90deg, #e6e6e6, #f5f5f5 20%, #f5f5f5 80%, #e9e9e9); }
${P} ::-webkit-scrollbar-track:horizontal { background: linear-gradient(#e6e6e6, #f5f5f5 20%, #f5f5f5 80%, #e9e9e9); }
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { border: 0; border-radius: 3px; box-shadow: ${scrollFrame}; }
${P} ::-webkit-scrollbar-thumb:vertical, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:vertical { background: ${GREY_V}; }
${P} ::-webkit-scrollbar-thumb:horizontal, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:horizontal { background: ${GREY}; }
${P} ::-webkit-scrollbar-thumb:vertical:hover { background: ${GEL_V}; box-shadow: ${scrollHotFrame}; }
${P} ::-webkit-scrollbar-thumb:horizontal:hover { background: ${GEL}; box-shadow: ${scrollHotFrame}; }
${P} ::-webkit-scrollbar-corner { background: #f2f2f2; }
${P} ::-webkit-scrollbar-button:single-button { display: block; border-radius: 3px; box-shadow: ${scrollFrame}; }
${P} ::-webkit-scrollbar-button:vertical:single-button { width: 17px; height: 17px; }
${P} ::-webkit-scrollbar-button:horizontal:single-button { width: 17px; height: 17px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${art(UP)}, ${GREY_V}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${art(DOWN)}, ${GREY_V}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${art(LEFT)}, ${GREY}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${art(RIGHT)}, ${GREY}; }
${P} ::-webkit-scrollbar-button:vertical:decrement:hover { background: ${art(UP)}, ${GEL_V}; box-shadow: ${scrollHotFrame}; }
${P} ::-webkit-scrollbar-button:vertical:increment:hover { background: ${art(DOWN)}, ${GEL_V}; box-shadow: ${scrollHotFrame}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement:hover { background: ${art(LEFT)}, ${GEL}; box-shadow: ${scrollHotFrame}; }
${P} ::-webkit-scrollbar-button:horizontal:increment:hover { background: ${art(RIGHT)}, ${GEL}; box-shadow: ${scrollHotFrame}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar: Aero's again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 17px; height: 17px; background: #f2f2f2; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { border: 0; border-radius: 3px; background: ${GREY_V}; box-shadow: ${scrollFrame}; }

${header(P)}
/* ---- Ribbon: Aero tabs over a pale command bar ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: #f0f0f0; }
${P} .scRibbonNavigator { border-bottom: 0; }
${TABS("Normal")},
${TABS("Active")} {
  ${tab}
  position: relative;
  font: 12px/20px ${FONT};
  padding: 0 10px;
  margin: 0 0 0 -1px;
}
${TABS("Normal:hover")} { ${tabHot} }
/* The open tab runs into the command bar, over its top line. */
${TABS("Active")} {
  ${tabOpen}
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 2px;
}
${P} .scRibbonToolbar { background: linear-gradient(#fff, #f4f7fb 45%, #e6edf6); border-top: 1px solid #898c95; border-bottom: 1px solid #a0afc3; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: transparent;
  border: 0;
  border-right: 1px solid #c5d0dc;
  box-shadow: 1px 0 #fff;
  border-radius: 0;
  margin: 3px 2px 3px 0;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #3c4b5c; font: 11px ${FONT}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; font-size: 11px; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 1px solid transparent; border-radius: 3px; }
/* Only the buttons react, not their icons or labels, and disabled buttons (spans) not at all. A large combo
   button shows its command and its drop-down as two faces while hovered, each pressed on its own. */
${P} .scRibbonToolbar ${RB}:hover { ${hot} }
${P} .scRibbonToolbar ${RB}:active { ${pickedDown} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > ${LC} { ${hot} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > ${LC}:active { ${pickedDown} }
/* Copenhagen-tight on both versions: the strip keeps 1px plus the chunks' 3px margin above and below
   (10.5 pads it 12px over an 80px minimum), the panel 3px above the buttons and 4px at the sides (10.5
   16px, 10.4 10px 8px), a 16px caption, and large buttons cut from 55px to 46px so they end above the
   caption with their hover frame. */
${X} :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip) { display: flow-root; min-height: 0; padding: 1px 0; }
${X} .scRibbonToolbar .chunk > .panel { box-sizing: border-box; height: 52px; padding: 3px 4px 0; }
${X} .scRibbonToolbar .chunk > .caption { height: 16px; padding: 0 4px; line-height: 16px; }
${X} .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeButtonDown, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) { padding: 2px 5px 1px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLarge"] .header { padding: 3px 4px 1px; }
${X} .scRibbonToolbar :is(.scRibbonGallery, .scRibbonToolbarSmallButtons) { padding: 1px 5px 0; }
${X} .scRibbonToolbar .scRibbonToolbarSmallCheckButton { padding: 3px 4px; }
${X} .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) { padding: 0; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonTop"] { padding: 0 5px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonBottom"] { padding: 0 5px 1px; }

/* ---- Content tree: white, the Explorer's selection boxes, the triangles ---- */
${P} .scContentTree { background: #fff; }
${P} .scContentTree :is(a, span) { font-size: 12px; }
/* a steady 1px frame on every row, so selecting one does not move it */
${P} .scContentTree :is(a.scContentTreeNodeNormal, a.scContentTreeNodeActive) { border: 1px solid transparent; border-radius: 3px; }
${P} .scContentTree a.scContentTreeNodeActive { ${picked} color: #000; outline: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: #000 !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { ${hot} text-decoration: none; }
${P} img[src*="/treemenu_collapsed"] { ${paint(art(TREE_CLOSED))} }
${P} img[src*="/treemenu_expanded"] { ${paint(art(TREE_OPEN))} }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: 15px ${FONT}; color: ${NAVY}; }
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${tab}
  height: 21px;
  margin: 35px 0 0 -1px;
}
${P} a.scRibbonEditorTabNormal:hover, ${P} a#BTAddNewSearch:hover { ${tabHot} }
${P} a.scRibbonEditorTabActive { ${tabOpen} position: relative; z-index: 1; height: 23px; }
${P} #EditorTabs { height: 57px; border-bottom: 1px solid #898c95; }
${P} a#BTAddNewSearch { width: 30px; }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: 12px ${FONT};
  border: 0;
  height: 21px;
  line-height: 21px;
  padding: 0 10px;
}
/* sections: the Explorer's group headers, navy text over a line that fades out, the chevron at the right */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  box-sizing: border-box;
  height: 26px;
  margin: 0 0 2px;
  padding: 0 4px 0 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: ${groupLine}, transparent;
  color: ${NAVY};
  font: 13px/24px ${FONT};
}
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed):hover { ${hot} color: ${NAVY}; }
${P} img.scEditorSectionCaptionGlyph { float: right; width: 16px; height: 16px; margin: 4px 2px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(art(CHEV_UP))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(art(CHEV_DOWN))} }
${P} .scEditorFieldLabel { color: #000; font: 12px ${FONT}; }

/* ---- Fields: white, Aero's darker top border ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select { ${field} }
${P} :is(.scContentControl, .scSearchInput, input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), textarea, select):hover:not(:disabled, :focus) { ${fieldHot} }
${P} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 20px; background: ${comboBtn}, #fff; }
${X} input[type="checkbox"], ${X} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 1px solid #707070;
  border-radius: 0;
  background: linear-gradient(135deg, #dcdcdc, #fff 70%), #f4f4f4;
  box-shadow: inset 0 0 0 1px #f4f4f4, inset 0 0 0 2px #ccc;
}
${X} input[type="radio"] { border-radius: 50%; box-shadow: inset 0 0 0 1px #f4f4f4; }
${X} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcdc, #fff 70%); }
${X} input[type="radio"]:checked { background: radial-gradient(circle, #8ad4ff 0, #2f8fd8 2px, #1b4f8c 3.2px, transparent 3.7px), linear-gradient(135deg, #dcdcdc, #fff 70%); }
${X} :is(input[type="checkbox"], input[type="radio"]):hover:not(:disabled) { border-color: #3c7fb1; box-shadow: inset 0 0 0 1px #def9fa, inset 0 0 0 2px #79c6f9; }
${X} :is(input[type="checkbox"], input[type="radio"]):disabled { border-color: #bcbcbc; background: #f4f4f4; box-shadow: none; opacity: 1; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px dotted #000; outline-offset: 1px; }

/* ---- Push buttons: Aero's split grey face; the blue gel under the pointer ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] { ${push} font: 12px ${FONT}; }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):hover:not(:disabled) { ${pushHot} }
${P} .scButtonPrimary { ${pushDefault} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):active:not(:disabled) { ${pushDown} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):disabled { ${pushOff} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }

/* ---- Bottom application tabs: Aero tabs hanging from the bottom edge ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 4px 3px; background: #f0f0f0; border-top: 1px solid #898c95; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  color: #000;
  font: 12px ${FONT};
  background: linear-gradient(#cfcfcf, #dddddd 50%, #ebebeb 50%, #f2f2f2);
  border: 1px solid #898c95;
  border-top: 0;
  border-radius: 0 0 2px 2px;
  box-shadow: none;
  margin: 0 0 0 -1px;
}
${P} .scPagerButtonNormal:hover { border-color: #3c7fb1; background: linear-gradient(#a7d9f5, #bee6fd 50%, #d9f0fc 50%, #eaf6fd); }
${P} .scPagerButtonActive { background: #fff; box-shadow: 0 -1px #fff; position: relative; z-index: 1; }

/* ---- Dialog windows: an Aero window. The page inside the dialog draws the caption (its header); Sitecore's
   empty jQuery title bar is laid over it, keeping the drag and carrying the caption buttons. ---- */
${P} .ui-dialog {
  background: #f0f0f0;
  border: 7px solid ${GLASS};
  border-top: 0;
  border-radius: 7px 7px 4px 4px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(12, 24, 38, 0.75), inset 0 0 0 1px rgba(255, 255, 255, 0.5), 0 8px 24px rgba(0, 0, 0, 0.45);
}
/* The token layer's .ui-widget-content border outranks P. Behind the caption's rounded corners the face is
   glass, so the clip blends glass into glass. */
${X} .ui-dialog { border-color: ${GLASS}; background: linear-gradient(#a9c6e3 0 30px, #f0f0f0 0); }
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
/* the caption buttons hang from the top edge as one group */
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  top: 0 !important;
  right: 0 !important;
  margin: 0 !important;
  height: 18px;
  display: flex;
  gap: 0;
  border: 1px solid ${BTN_FRAME};
  border-top: 0;
  border-radius: 0 0 4px 4px;
  overflow: hidden;
  box-shadow: 0 1px rgba(255, 255, 255, 0.5);
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  box-sizing: border-box;
  width: 26px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  border-left: 1px solid ${BTN_FRAME};
  border-radius: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :first-child { border-left: 0; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: 9;
  width: 43px;
  margin: 0 !important;
  background: var(--sct-lh-close);
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button:hover { background: var(--sct-lh-close-hot); }
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: var(--sct-lh-max); }
${P} .ui-dialog .ui-dialog-titlebar-maximize:hover { background: var(--sct-lh-max-hot); }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: var(--sct-lh-restore); }
${P} .ui-dialog .ui-dialog-titlebar-restore:hover { background: var(--sct-lh-restore-hot); }
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: var(--sct-lh-min); }
${P} .ui-dialog .ui-dialog-titlebar-minimize:hover { background: var(--sct-lh-min-hot); }
${P} .ui-dialog .ui-dialog-titlebar-collapse { background: ${art(["DDDDDDDDD", "DWWWWWWWD", ".DWWWWWD.", "..DWWWD..", "...DWD...", "....D...."])}, ${BTN_FACE}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :active { filter: brightness(0.8); }
/* a faint shade marks the dialog as modal */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.18); opacity: 1; }

/* Inside a dialog page: the header is the caption, the window's icon, then the title. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #f0f0f0; padding: 0; border: 0; min-height: 0 !important; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 30px;
  margin: 0;
  padding: 0 110px 0 2px;
  background: ${CAP};
  border: 0;
  border-radius: 0;
  ${capText}
  line-height: 30px;
  white-space: nowrap;
}
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 8px 10px; margin: 0; font: 12px ${FONT}; background: #fff; border-top: 1px solid #5a7fa3; border-bottom: 1px solid #dfdfdf; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background: #f0f0f0; }
${P} .scFormDialogFooter { border-top: 0; border-radius: 0; }
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 39px; padding: 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: right; }
/* SPE's help (?) floats for 10.x's taller footer: centred on the 23px buttons instead */
${X} .scFormDialogFooter img#Copyright { margin: 0; }

/* ---- Tab strips (dialogs, the ISE's script tabs) ---- */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 1px solid #898c95; }
/* Sitecore swaps scTab for scTab_Hover under the mouse; the stock hover class is uppercase on a light face. */
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${tab}
  height: auto;
  padding: 0 10px 0 14px;
  margin: 0 0 0 -1px;
  font: 12px/20px ${FONT};
}
${P} .scTabstrip .scTab_Hover { ${tabHot} }
${P} .scTabstrip [class*="scTabActive"] { ${tabOpen} position: relative; z-index: 1; padding-bottom: 2px; margin-bottom: -1px; }
/* focus: a dotted rectangle inside the tab, never Sitecore's black frame */
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus { outline: none; box-shadow: none; }
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
${P} .scTabstrip .closeTab { margin: 0 -2px 0 6px; }
/* the ISE's unsaved-script dot, darkened from SPE's #fc2929 to pass AA on the tab */
${P} .scTabstrip .scriptModified { color: #c4291c; }

/* ---- Window buttons (Desktop windows and the Content Editor's own): Aero's caption buttons, one group
   hanging from the top edge ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) { display: flex; align-items: flex-start; gap: 0; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { vertical-align: top; filter: none; box-sizing: border-box; height: 19px; margin: 0; padding: 0; border: 1px solid ${BTN_FRAME}; border-top: 0; border-left-width: 0; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:first-child { border-left-width: 1px; border-bottom-left-radius: 4px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:last-child { border-bottom-right-radius: 4px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { width: 27px; ${paint("var(--sct-lh-min)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { width: 27px; ${paint("var(--sct-lh-max)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { width: 27px; ${paint("var(--sct-lh-restore)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { width: 44px; ${paint("var(--sct-lh-close)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"]:hover { background: var(--sct-lh-min-hot); }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"]:hover { background: var(--sct-lh-max-hot); }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"]:hover { background: var(--sct-lh-restore-hot); }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"]:hover { background: var(--sct-lh-close-hot); }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"]):active { filter: brightness(0.8); }
/* the application switcher keeps Sitecore's glyph, on a glass face of its own */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { width: 27px; ${paint(`${art(TRI_DOWN)}, ${BTN_FACE}`)} }
/* The Content Editor's own buttons hang from the top of the glass band above its ribbon. */
${P} .scSystemButtons { align-self: flex-start; margin: 0 6px 0 0; }
/* Standard windows (ISE, Console, Package Designer...): a glass caption with rounded top corners. */
${P} .standardWindowCaption {
  height: 30px;
  background: ${CAP};
  border: 0;
  border-bottom: 1px solid #5a7fa3;
  border-radius: 6px 6px 0 0;
}
/* Around the caption: the window's 1px frame and its pale body behind the rounded corners showed as a line
   between the caption and the glass ring. Both glass; the caption's 6px corners sit inside the iframe's clip. */
${X} .scWindowFrame, ${X} .scWindowBorder2 { border-color: ${GLASS}; }
${X} .scWindowFrame > .scStretch { background-color: ${GLASS}; }
${PI}:not(#sct-lh) .scWindowFrame, ${PI}:not(#sct-lh) .scWindowBorder2 { border-color: ${GLASS_IN}; }
${PI}:not(#sct-lh) .scWindowFrame > .scStretch { background-color: ${GLASS_IN}; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 31px; }
${P} .standardWindowCaption .windowCaptionIcon { display: inline-block; vertical-align: top; margin: 7px 0 0 6px; }
${P} .standardWindowCaption .scWindowCaption {
  display: inline-block;
  ${capText}
  line-height: 30px;
  padding: 0 6px;
  vertical-align: top;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* The ISE writes its script's path into the caption in an inline #bbb: dark grey on the glass. */
${P} .standardWindowCaption .scWindowCaption i { color: #2d3e52 !important; }
${P} .standartWindowButtons { top: 0; right: 6px; }
/* An inactive window (dom.js marks its document from the taskbar): paler, clearer glass, no streaks. */
${PI} .standardWindowCaption { background: ${CAP_IN}; }

/* ---- Inside a Desktop window (the engine names it from the taskbar): the caption is real glass. The window's
   layers are clear for the caption's height (--lh-cap) and the window body below it, so the Desktop's blurred,
   tinted backdrop shows through the caption only, the same glass as the frame beside it: one sheet, one rounded
   corner (the window's), no line between them. The Content Editor, Media Library and Workbox, which Sitecore
   gives no caption, get one on the caption's empty top line, from the window's title. ---- */
${X}[data-sct-window-title] { --lh-cap: 0px; background: transparent; }
${X}[data-sct-window-title]:has(.scWindowBorder2 > .scCaption > #CaptionTopLine, .scWorkboxWindowCaption) { --lh-cap: 26px; }
${X}[data-sct-window-title]:has(.standardWindowCaption) { --lh-cap: 31px; }
${X}[data-sct-window-title] :is(body, body > form, .scFlexColumnContainer.scWindowBorder2, .scWindowFrame, .scWindowFrame > .scStretch) {
  background: linear-gradient(transparent 0 var(--lh-cap), #f0f0f0 var(--lh-cap)) !important;
}
${X}[data-sct-window-title] :is(.scWindowFrame, .scWindowBorder2) { border-width: 0; }
${X}[data-sct-window-title] .scWindowBorder2 > .scCaption { background: transparent; }
${X}[data-sct-window-title] .standardWindowCaption { background: transparent; border-radius: 0; border-bottom-color: rgba(40, 70, 100, 0.45); }
${X}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${X}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 26px; background: transparent; border-bottom: 1px solid rgba(40, 70, 100, 0.45); }
${X}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${X}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; padding: 0 150px 0 8px; ${capText} line-height: 25px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${X}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${X}[data-sct-window-title] .scWorkboxWindowButtons { top: 0; right: 6px; margin-right: 0; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${X}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${X}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${X}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 26px; height: 22px; }
${X}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
${PI} .standardWindowCaption .scWindowCaption { color: #3c3c3c; }
${PI} .standartWindowButtons img { filter: saturate(0.4) brightness(1.08); }

/* ---- Insert gallery scroller ---- */
${P} .scRibbonPanelButtons { background: transparent; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { width: 17px; height: 15px; filter: none; border-radius: 2px; box-shadow: ${scrollFrame}; }
/* 10.4's chunk launchers are pale grey: inked like the captions */
${X} .scRibbonChunkEndLink img.glyph { filter: brightness(0.45); }
${P} img.scRibbonPanelUp { ${paint(`${art(UP)}, ${GREY}`)} }
${P} img.scRibbonPanelDown { ${paint(`${art(DOWN)}, ${GREY}`)} }
${P} img.scRibbonPanelOpen { ${paint(`${art(["AA.AA.AA", "AA.AA.AA"])}, ${GREY}`)} }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen):hover { box-shadow: ${scrollHotFrame}; }

/* ==== Desktop: the aurora under a glass taskbar ==== */
/* Vista had no header above the desktop: the start menu takes over the user name and Log Off (dom.js). */
${X}:has(#Desktop) .sc-globalHeader { display: none; }
${X}:has(#Desktop) .sc-globalHeader ~ :is(div, table) { padding-top: 0; }
${X}:has(#Desktop) .sc-globalHeader ~ div > .DesktopArea { margin-top: 0; }
/* The desktop runs to the screen's bottom edge, so the aurora shows through the taskbar's glass. Its bottom
   34px are a transparent border: windows are sized to the padding box, so a maximized window stops above
   the taskbar while the wallpaper, painted from the border box, carries on behind it. */
${X} .DesktopArea {
  top: 0;
  bottom: 0;
  border-bottom: 34px solid transparent;
  overflow: clip;
  overflow-clip-margin: border-box;
  /* the aurora: green and teal light bands over a deep blue-green night; Sitecore sets its wallpaper inline */
  background:
    radial-gradient(ellipse 70% 22% at 30% 62%, rgba(150, 255, 190, 0.32), transparent 70%),
    radial-gradient(ellipse 60% 14% at 62% 70%, rgba(110, 220, 255, 0.26), transparent 70%),
    radial-gradient(ellipse 90% 30% at 50% 58%, rgba(60, 170, 120, 0.35), transparent 72%),
    radial-gradient(ellipse 80% 70% at 72% 30%, #2f8f6a, #1c6b5a 30%, #0d3a44 62%, #071b26) !important;
  background-origin: border-box !important;
  background-clip: border-box !important;
}
${X} .DesktopArea > :is(iframe, div[id^="FRAME"]) { top: 0; }

/* ---- Taskbar: black glass, 34px; the wallpaper shows through, blurred ---- */
${X} .scStartbar { height: 34px; z-index: 900; background: transparent; }
${X} #Startbar, ${X} #Startbar > table { height: 34px; border: 0; }
${X} #Startbar {
  background: ${BLACK_GLASS};
  backdrop-filter: blur(6px);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.28), 0 -1px rgba(0, 0, 0, 0.6);
}
${X} #Startbar > table { background: none; box-shadow: none; }
${X} #Startbar > table > tbody > tr > td { height: 34px; padding: 0; border: 0; vertical-align: middle; }
/* the start button's cell: Sitecore sizes it 0px wide and lets the button overflow into the window list */
${X} .scStartButtonContainer { position: relative; width: 56px; height: 34px; }
/* the orb: a glass sphere 38px across, rising over the bar's top edge */
${X} .scStartButton, ${X} .scStartButton.scPopupOpener, ${X} .scStartButton:hover {
  position: absolute;
  top: -6px;
  left: 8px;
  box-sizing: border-box;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.75);
  border-radius: 50%;
  background:
    radial-gradient(ellipse 60% 36% at 50% 22%, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.15) 70%, transparent 72%),
    radial-gradient(circle at 50% 75%, #7fe0ff, #2f9ee6 30%, #145a96 60%, #0a2f4c 85%);
  box-shadow: inset 0 0 0 1px rgba(170, 220, 255, 0.55), 0 0 6px rgba(120, 200, 255, 0.45);
}
${X} .scStartButton:hover { box-shadow: inset 0 0 0 1px rgba(200, 236, 255, 0.8), 0 0 12px 2px rgba(130, 210, 255, 0.85); }
${X} .scStartButton.scPopupOpener { filter: brightness(0.85); }
${X} .scStartButton:focus-visible { outline: 1px dotted #fff; outline-offset: 2px; }
${X} .scStartBarScroller { height: 34px; padding: 0; border: 0; display: flex; align-items: center; }
${X} #StartbarApplications { height: 26px; margin: 0; border-spacing: 3px 0; }
${X} :is(.scActiveApplication, .scInactiveApplication) {
  box-sizing: border-box;
  height: 26px;
  max-width: 160px;
  padding: 0 8px;
  border: 1px solid rgba(0, 0, 0, 0.75);
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${X} .scInactiveApplication { background: linear-gradient(rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.07) 50%, rgba(255, 255, 255, 0) 50%, rgba(255, 255, 255, 0.08)); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22); }
${X} .scInactiveApplication:hover { background: linear-gradient(rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.14) 50%, rgba(255, 255, 255, 0.04) 50%, rgba(255, 255, 255, 0.16)); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); }
${X} .scActiveApplication { background: linear-gradient(rgba(150, 200, 255, 0.5), rgba(80, 140, 220, 0.35) 50%, rgba(30, 80, 160, 0.4) 50%, rgba(90, 160, 240, 0.45)); box-shadow: inset 0 0 0 1px rgba(190, 225, 255, 0.45), inset 0 0 6px rgba(120, 190, 255, 0.5); }
${X} .scInactiveApplication::before, ${X} .scInactiveApplication::after { display: none; }
${X} :is(.scActiveApplication, .scInactiveApplication) * { color: #fff; font: 12px/24px ${FONT}; text-shadow: 0 1px 1px #000; }
${X} .scStartBarApplication span img { margin: 0 5px 0 0 !important; vertical-align: middle; }
/* the notification area: darker glass behind a light line */
${X} .scStartbarTray {
  height: 34px;
  border: 0;
  border-left: 1px solid rgba(0, 0, 0, 0.7);
  background: linear-gradient(rgba(40, 42, 46, 0.6), rgba(10, 10, 12, 0.6) 50%, rgba(0, 0, 0, 0.65) 50%, rgba(14, 14, 16, 0.6));
  box-shadow: inset 1px 0 rgba(255, 255, 255, 0.18);
}
${X} .scStartbarTray > tbody > tr > td { height: 34px; padding: 0 0 0 6px; line-height: 34px !important; vertical-align: middle; }
${X} .scStartbarTray, ${X} .scStartbarTray * { color: #fff; font: 12px ${FONT}; }
${X} #SearchBox { box-sizing: border-box; width: 160px; height: 22px; min-height: 0; margin: 0; padding: 0 6px; ${field} font: 12px ${FONT}; }
${X} #SearchBox::placeholder { color: #6d6d6d; font-style: italic; }
${X} #DatabaseSelector { display: inline-flex; vertical-align: top; align-items: center; height: 34px; padding: 0 4px; border-radius: 0; background: transparent; }
${X} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 4px 0 0 !important; }
${X} .sct-lh-clock { padding: 0 10px 0 6px !important; white-space: nowrap; color: #fff; font: 12px ${FONT}; }

/* ---- Start menu: dark glass round the white program list; the user's picture above the right column
   (dom.js adds it and the footer) ---- */
${X} .scPopup:has(> .scStartMenu) { padding: 0; border: 0; border-radius: 7px 7px 4px 4px; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.8), 2px 4px 14px rgba(0, 0, 0, 0.55); background: transparent; overflow: visible; }
${X} .scStartMenu {
  position: relative;
  box-sizing: border-box;
  width: 420px;
  padding: 52px 8px 0;
  border: 0;
  border-radius: 7px 7px 4px 4px;
  background: linear-gradient(115deg, transparent 0 55%, rgba(255, 255, 255, 0.1) 58%, transparent 62%), linear-gradient(rgba(42, 64, 92, 0.95), rgba(14, 24, 38, 0.96) 40%, rgba(8, 14, 24, 0.97));
  backdrop-filter: blur(8px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  overflow: visible;
  font-family: ${FONT};
}
${X} .sct-lh-smtop { position: absolute; top: 4px; right: 12px; left: 12px; display: flex; align-items: center; justify-content: flex-end; gap: 10px; height: 44px; pointer-events: none; }
${X} .sct-lh-smtop img { order: 2; box-sizing: border-box; width: 48px; height: 48px; margin-top: -14px; border: 3px solid #f4f8fc; border-radius: 4px; background: #d7e4f2; object-fit: cover; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.6), inset 0 0 0 1px #9fb4ca; }
${X} .sct-lh-smtop span { overflow: hidden; color: #fff; font: 13px/1.2 ${FONT}; text-shadow: 0 1px 2px #000; text-overflow: ellipsis; white-space: nowrap; }
${X} .scStartMenuContent { margin: 0; border: 0; background: transparent; }
${X} .scStartMenuContentColumns { width: 100%; border: 0; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
${X} .scStartMenuLeft, ${X} .scStartMenuRight { padding: 4px 0; vertical-align: top; }
${X} .scStartMenuLeft { width: 58%; background: #fff; border: 1px solid #959595; border-radius: 4px; box-shadow: inset 0 0 0 1px #fff; }
${X} .scStartMenuRight { padding: 4px 0 4px 6px; background: transparent; }
${X} .scStartMenuLeft * { color: #000; font-family: ${FONT}; }
${X} .scStartMenuRight * { color: #fff; font-family: ${FONT}; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 0;
  height: auto;
  margin: 0 3px;
  padding: 2px 5px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  text-decoration: none;
  white-space: nowrap;
}
${X} .scStartMenuLeft .scStartMenuLeftOption { height: 40px; }
${X} .scStartMenuRight :is(.scStartMenuLeftOption, .scStartMenuRightFolder) { height: 28px; }
${X} .scStartMenuLeftOptionIcon { flex: none; width: 32px; height: 32px; margin: 0 6px 0 0; float: none; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) { width: 24px; height: 24px; margin: 0 6px 0 0; }
${X} .scStartMenuLeftOptionDescription { min-width: 0; overflow: hidden; }
${X} :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { padding: 0; font: 12px/15px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuLeftOptionTooltip { color: #5a5a5a !important; font: 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight .scStartMenuLeftOptionTooltip { display: none; }
${X} .scStartMenuLeft :is(.scStartMenuLeftOption, .scStartMenuRightFolder):is(:hover, .scPopupOpener) { ${picked} }
${X} .scStartMenuRight :is(.scStartMenuLeftOption, .scStartMenuRightFolder):is(:hover, .scPopupOpener) { border-color: rgba(0, 0, 0, 0.6); background: linear-gradient(rgba(140, 190, 255, 0.45), rgba(70, 120, 200, 0.3) 50%, rgba(20, 60, 130, 0.4) 50%, rgba(70, 140, 220, 0.4)); box-shadow: inset 0 0 0 1px rgba(190, 225, 255, 0.4); }
${X} .scStartMenuRightFolderDisplayName { flex: 1; }
${X} .scStartMenuDivider { height: 1px; margin: 3px 8px; border: 0; background: linear-gradient(90deg, transparent, #d5d5d5 20% 80%, transparent); }
${X} .scStartMenuRight .scStartMenuDivider { background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3) 20% 80%, transparent); }
${X} img.scStartMenuRightFolderGlyph { ${paint(art(TRI_RIGHT))} order: 2; width: 8px; height: 9px; margin: 0 0 0 6px; float: none; filter: invert(1); }
${X} .scStartMenuLeft img.scStartMenuRightFolderGlyph { filter: none; }
/* All Applications: Vista's All Programs, with its arrow. Sitecore sets it under the right-hand column (the
   left one spans both rows), so it is that column's glass, white text and its hover */
${X} .scStartMenuPrograms { padding: 0 0 6px 6px; background: transparent; border: 0; vertical-align: bottom; }
${X} .scStartMenuPrograms .scStartMenuDivider { margin: 0 8px 4px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3) 20% 80%, transparent); }
${X} .scStartMenuProgramsMenu { display: flex; align-items: center; gap: 8px; height: 26px; margin: 0 3px; padding: 0 8px; border: 1px solid transparent; border-radius: 3px; color: #fff; text-decoration: none; }
${X} .scStartMenuProgramsMenu:is(:hover, .scPopupOpener) { border-color: rgba(0, 0, 0, 0.6); background: linear-gradient(rgba(140, 190, 255, 0.45), rgba(70, 120, 200, 0.3) 50%, rgba(20, 60, 130, 0.4) 50%, rgba(70, 140, 220, 0.4)); box-shadow: inset 0 0 0 1px rgba(190, 225, 255, 0.4); }
${X} .scStartMenuProgramsMenuText { color: #fff; font: 12px/16px ${FONT}; }
${X} img.scStartMenuProgramsGlyph { order: -1; width: 8px; height: 9px; margin: 0; ${paint(art(TRI_RIGHT))} filter: invert(1); }
${X} .sct-lh-smbottom {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 4px;
}
${X} .sct-lh-smbottom a { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px; border: 1px solid transparent; border-radius: 3px; color: #fff; font: 12px ${FONT}; text-decoration: none; text-shadow: 0 1px 1px #000; }
${X} .sct-lh-smbottom a:hover { border-color: rgba(0, 0, 0, 0.6); background: linear-gradient(rgba(140, 190, 255, 0.45), rgba(70, 120, 200, 0.3) 50%, rgba(20, 60, 130, 0.4) 50%, rgba(70, 140, 220, 0.4)); }
${X} .sct-lh-smbottom a img { width: 24px; height: 24px; }
/* Log Off: Vista's red-orange power button */
${X} .sct-lh-smbottom a.sct-lh-logoff { border-color: rgba(0, 0, 0, 0.7); background: linear-gradient(#f3a98e, #e06a3b 50%, #c43e14 50%, #e57a46); box-shadow: inset 0 0 0 1px rgba(255, 220, 200, 0.5); }
${X} .sct-lh-smbottom a.sct-lh-logoff:hover { filter: brightness(1.12); }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: 22px ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) { padding-right: 20px; background: ${comboBtn}, #fff; }
${X} textarea, ${X} select:is([multiple], [size]:not([size="0"], [size="1"])) { ${field} }
${X} :is(input, select, textarea):focus { outline: none; ${fieldFocus} }
${X} :is(input, textarea):disabled, ${X} select:disabled { background-color: #f4f4f4; color: #838383; border-color: #adb2b5; }

/* Quick Info: read-only text in 19px rows, as Sitecore draws it (no frames) */
${X} .scEditorQuickInfo tr { line-height: 19px; }
${X} .scEditorQuickInfo td { padding: 1px 4px; font-size: 12px; }
${X} .scEditorQuickInfo input { height: 19px; padding: 0; border: 0; background: transparent !important; font-size: 12px; }

/* ---- Combo tables (date and time pickers, item pickers): one Aero combo box ---- */
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
  width: 17px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 0;
  border-left: 1px solid transparent;
  border-radius: 0;
  box-shadow: none;
  ${paint(`${art(DOWN)}, transparent`)}
}
${X} table.scCombobox img.scComboboxDropDown:hover { border-left-color: #3c7fb1; ${paint(`${art(DOWN)}, ${GEL}`)} }

/* ---- Push buttons: 23px, wide enough for OK and Cancel ---- */
${X} :is(.scButton:not(.scEditorHeaderButton), input[type="button"], input[type="submit"]) {
  height: 23px;
  min-width: 75px;
  padding: 0 10px;
  border-radius: 3px;
  line-height: 21px;
}
${X} button:not(.ui-button) { border-radius: 3px; }
/* the default button: the token layer frames it in its fill colour */
${X} .scButton.scButtonPrimary { ${push} ${pushDefault} }
${X} .scButton.scButtonPrimary:hover:not(:disabled) { ${pushHot} }
${X} .scButton.scButtonPrimary:active:not(:disabled) { ${pushDown} }

/* ---- Drop-down arrows: a small black triangle for Sitecore's chevrons ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(TRI_DOWN))} }

/* ---- Tree search: a field and two toolbar buttons on one line ---- */
${X} #SearchPanel { padding: 4px; background: #f0f0f0; border-bottom: 1px solid #c5d0dc; }
${X} #SearchPanel > table { width: 100%; border-spacing: 0; }
${X} #SearchPanel > table > tbody > tr > td { height: auto; padding: 0; vertical-align: middle; }
${X} #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
${X} #SearchPanel > table > tbody > tr > td > div { float: none !important; padding: 0 0 0 2px !important; }
${X} #SearchPanel .scElementHover { width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #TreeSearch { width: 100%; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) {
  display: block;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: 3px;
}
${X} :is(a.scSearchButton, a.scSearchOptionsButton):hover { ${hot} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { ${pickedDown} }
${X} a.scSearchButton img { filter: brightness(0.55); }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(TRI_DOWN))} }
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #0055b3; font: 12px ${FONT}; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(TRI_DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: command bar buttons ---- */
${X} .scEditorTabControls a.scEditorHeaderButton {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  min-width: 0;
  padding: 0 4px 0 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 12px/20px ${FONT};
}
${X} .scEditorTabControls a.scEditorHeaderButton:hover { ${hot} }
${X} .scEditorTabControls a.scEditorHeaderButton:active { ${pickedDown} }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus: Aero's pale menu with its icon gutter, a #979797 frame, the light blue hover box ---- */
${X} .scPopup:not(:has(> .scStartMenu)), ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 2px;
  background: linear-gradient(90deg, #f1f1f1 0 26px, #e2e3e3 26px 27px, #fff 27px 28px, #f0f0f0 28px);
  border: 1px solid #979797;
  border-radius: 0;
  box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.3);
}
${X} .scPopup > .scMenu { padding: 0; background: transparent; border: 0; box-shadow: none; }
${X} .scMenu td {
  height: auto;
  padding: 3px 4px;
  background: transparent;
  color: #000;
  font: 12px ${FONT};
  line-height: 16px;
}
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 2px 6px 2px 3px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 2px 16px 2px 8px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 2px 6px 2px 4px; text-align: right; }
/* the hover box spans the row: a frame drawn from each cell's edges, rounded at the row's ends */
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { ${menuHot} box-shadow: inset 0 1px #aecff7, inset 0 -1px #aecff7; }
${X} .scMenu .scMenuItemIcon_Hover { border-radius: 3px 0 0 3px; box-shadow: inset 0 1px #aecff7, inset 0 -1px #aecff7, inset 1px 0 #aecff7; }
${X} .scMenu :is(.scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { border-radius: 0 3px 3px 0; box-shadow: inset 0 1px #aecff7, inset 0 -1px #aecff7, inset -1px 0 #aecff7; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover > td { ${menuHot} box-shadow: inset 0 1px #aecff7, inset 0 -1px #aecff7; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover * { color: #000; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover > td { background: transparent; box-shadow: none; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover * { color: #6d6d6d; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 1px dotted #000; outline-offset: -1px; }
${X} iframe.scGalleryFrame { border: 1px solid #979797; border-radius: 0; box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.3); }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: #6d6d6d; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(TRI_RIGHT))} }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 7px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 3px, #e0e0e0 3px 4px, #fff 4px 5px, transparent 5px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu .scMenuDividerIcon { background: none; }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 6px; color: ${NAVY}; font: bold 12px ${FONT}; }

/* ---- Dialog tab panes: the open tab joins a white page framed in #898c95 ---- */
${X} .scTabstrip { box-sizing: border-box; height: 23px; background: transparent; }
${X} .scTabstripContainer > .scTabs { top: 23px; left: -1px; background: #fff; border: 1px solid #898c95; border-top: 0; box-shadow: none; }
${X} .scTabs .scTabPage .scScrollbox { background: #fff; ${field} }
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): rows of a list, the selection box ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { ${picked} }
${X} .scRibbonGalleryList > a:is(:hover, :active) * { color: #000; }

/* The ribbon's fold button: the group header chevron */
${X} a.scRibbonClose { background: ${art(CHEV_UP)}; border: 1px solid transparent; border-radius: 3px; }
${X} a.scRibbonOpen { background: ${art(CHEV_DOWN)}; border: 1px solid transparent; border-radius: 3px; }
${X} :is(a.scRibbonClose, a.scRibbonOpen):hover { ${hot} background-image: none; }
${X} a.scRibbonClose:hover { background: ${art(CHEV_UP)}, linear-gradient(#fafbfd, #ebf3fd); }
${X} a.scRibbonOpen:hover { background: ${art(CHEV_DOWN)}, linear-gradient(#fafbfd, #ebf3fd); }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search: one white field holding the filter tokens and the Clear and Search buttons ---- */
${X} .search-box { ${field} }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; border-right: 1px solid #dbdfe6; border-radius: 0; }
${X} .search-box .sb_down { background: ${art(DOWN)}, ${GREY}; }
${X} .search-box .sb_up { background: ${art(UP)}, ${GREY}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; background: transparent; }
${X} .filters .filter { border: 1px solid #84acdd; border-radius: 3px; background: linear-gradient(#f1f7fe, #d0e5fc); color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { ${push} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, ${GREY}; }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, ${GREY}; }
${X} .clear-search-box .btn-clear:hover { ${pushHot} background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, ${GEL}; }
${X} .clear-search-box .btn-search:hover { ${pushHot} background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, ${GEL}; }

${X} .scWorkboxWindowCaption { background: #f0f0f0; }

/* SPEAK pages served in the shell (SPE Reports): Vista's address bar under the caption, as on SPEAK pages */
${appHeader(X)}
${X} .sc-applicationHeader-row1 { background-image: none; }
/* jQuery UI's highlight box (the ISE's tip of the session): Vista's info bar, pale yellow with a frame */
${X} .ui-state-highlight { border: 1px solid #c9b46f; border-radius: 3px; background: #ffffe1; color: #000; }
${X} .ui-state-highlight :is(p, b, span, a, div) { color: #000; }
${X} .ui-state-highlight a { color: #0055b3; }

/* ---- Desktop windows: Aero glass. Each window is an iframe; the Desktop blurs and tints what lies behind it
   (backdrop-filter covers the whole border box), so its frame, the iframe's own border, and its caption, where
   the window's document is clear, show the wallpaper and the windows behind, softened. As in Vista there is no
   frame along the top: the caption is the window's top edge, under a 1px dark line. ---- */
${X} #Desktop > iframe { background: ${AERO}; backdrop-filter: blur(8px) saturate(1.4); }
${X} #Desktop > iframe[data-sct-window="inactive"] { background: ${AERO_IN}; }
${X} #Desktop > iframe:not([style*="width: 100%"]) { border: 7px solid transparent; border-top: 0; border-radius: 7px 7px 0 0; box-shadow: 0 0 0 1px rgba(12, 24, 38, 0.75), 0 8px 24px 2px rgba(0, 0, 0, 0.45); }
${X} #Desktop > iframe[data-sct-window="inactive"]:not([style*="width: 100%"]) { box-shadow: 0 0 0 1px rgba(40, 52, 66, 0.55), 0 6px 18px 1px rgba(0, 0, 0, 0.3); }
/* A system set to reduce transparency, or an engine without backdrop-filter: the frame turns solid glass blue. */
@media (prefers-reduced-transparency: reduce) {
  ${X} #Desktop > iframe { background: ${GLASS}; }
  ${X} #Desktop > iframe[data-sct-window="inactive"] { background: ${GLASS_IN}; }
}
@supports not (backdrop-filter: blur(1px)) {
  ${X} #Desktop > iframe { background: ${GLASS}; }
  ${X} #Desktop > iframe[data-sct-window="inactive"] { background: ${GLASS_IN}; }
}
`;

// ==== SPEAK pages (speak and launchpad areas) ====
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px).
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-lh)`;
  return `${SX} :is(body, input, button, select, textarea, h1, h2, h3, h4, h5, h6, p, a, span, div, li, label, td, th, nav, header, section):not([class*="glyphicon"], .fa, [class*="fa-"]) {
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
${SX} :is(input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), select:not([multiple], [size]:not([size="0"], [size="1"])), .form-control) {
  box-sizing: border-box;
  height: 22px;
  min-height: 0;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${SX} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 20px; background: ${comboBtn}, #fff; }
${SX} textarea { ${field} }
${SX} :is(input, select, textarea, .form-control):hover:not(:disabled, :focus) { ${fieldHot} }
${SX} :is(input, select, textarea, .form-control):focus { outline: none; box-shadow: none; ${fieldFocus} }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 1px solid #8f8f8f;
  border-radius: 0;
  outline: none;
  background: linear-gradient(135deg, #dcdcdc, #fff 70%), #f4f4f4;
  box-shadow: inset 0 0 0 1px #f4f4f4, inset 0 0 0 2px #ccc;
}
${SX} input[type="radio"] { border-radius: 50%; box-shadow: inset 0 0 0 1px #f4f4f4; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcdc, #fff 70%); }
${SX} input[type="radio"]:checked { background: radial-gradient(circle, #8ad4ff 0, #2f8fd8 2px, #1b4f8c 3.2px, transparent 3.7px), linear-gradient(135deg, #dcdcdc, #fff 70%); }
${SX} .btn {
  height: 23px;
  min-width: 75px;
  padding: 0 10px;
  font: 12px/21px ${FONT};
  ${push}
}
${SX} .btn :is(span, .sc-button-text) { color: inherit; font: inherit; }
${SX} .btn:hover, ${SX} .btn:focus { ${push} ${pushHot} }
${SX} .btn:active, ${SX} .btn.active { ${pushDown} }
${SX} .btn:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
${SX} .btn:disabled, ${SX} .btn.disabled { ${pushOff} opacity: 1; }
${SX} .btn.btn-primary { ${pushDefault} }
${SX} .btn.btn-primary :is(span, .sc-button-text) { color: #000; }
`;
};

// A Control Panel category: the 32px icon beside a navy heading, its links under it.
const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-lh)`;
const EE = `${SPX} .sc-pageeditbar`;
const speak = `/* Longhorn: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-longhorn-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's Aero ribbon ==== */
${EE} { color: #000; font: 12px ${FONT}; }
${EE} .sc-quickbar {
  display: flex;
  align-items: flex-end;
  height: auto;
  padding: 5px 4px 0;
  border: 0;
  background: #f0f0f0;
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
  border-radius: 3px;
  background: none;
  box-shadow: none;
  opacity: 1;
}
${EE} .sc-quickbar-button:not(.disabled):hover { ${hot} }
${EE} .sc-quickbar-button:not(.disabled):active { ${pickedDown} }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 16px; height: 16px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${art(CHEV_UP)}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${art(CHEV_DOWN)}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  ${tab}
  position: relative;
  height: auto;
  padding: 0 10px;
  margin: 0 0 0 -1px;
  font: 12px/20px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-tab:not(.sc-quickbar-tab-selected):hover { ${tabHot} }
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected { ${tabOpen} z-index: 1; margin-bottom: -1px; padding-bottom: 2px; }

${EE} .sc-ribbon { background: linear-gradient(#fff, #f4f7fb 45%, #e6edf6); border: 0; border-top: 1px solid #898c95; border-bottom: 1px solid #a0afc3; box-shadow: none; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 1px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 2px 3px 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-right: 1px solid #c5d0dc;
  border-radius: 0;
  box-shadow: 1px 0 #fff;
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
/* As tight as the Content Editor's: 46px buttons 3px below the chunk's top, 4px from its sides, clear of the caption */
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; box-sizing: border-box; height: 50px; min-height: 0; margin: 0; padding: 3px 4px 0; }
${EE} .sc-chunk-label { height: 18px; margin: 0; padding: 0 6px; color: #3c4b5c; font: 11px/18px ${FONT}; text-align: center; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
  float: left;
  box-sizing: border-box;
  height: 46px;
  margin: 0;
  padding: 2px 5px 1px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
}
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) > [class*="sprite"] { display: block; margin: 0 auto; }
${EE} .sc-chunk-button-label { margin: 0; padding: 3px 0 0; color: #000; font: 11px/12px ${FONT}; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover { ${hot} }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed { ${pickedDown} }
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: #838383; }
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
  border-radius: 3px;
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

/* The item path under the ribbon: Vista's breadcrumb address bar */
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 2px;
  box-sizing: border-box;
  height: 30px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: #f0f0f0;
  border: 0;
  border-top: 1px solid #fff;
  border-bottom: 1px solid #a0afc3;
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 2px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: 12px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { color: #0055b3; text-decoration: underline; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  min-width: 14px;
  padding: 0 2px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
}
${EE} .sc-breadcrumb-item-button { width: 22px; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { ${hot} }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(TRI_RIGHT)}; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 22px; min-width: 60px; padding: 0 10px; line-height: 20px; }

/* ==== Control Panel: Vista's Control Panel Home, categories with a navy heading on the white page ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: #fff; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
/* every SPEAK application's header (Control Panel, SPE Reports, Forms): Vista's address bar under the caption */
${appHeader(SPX)}
${SPX} .sc-applicationHeader-row1 { background-image: none; }
${SPX} .sc-applicationContent-main { background: none; }
${SPX} .sc-controlpanel-box { box-sizing: border-box; margin: 16px 0 0; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
${SPX} .sc-controlpanel-box-header { margin: 0; padding: 0; color: ${NAVY}; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 { display: flex; align-items: center; box-sizing: border-box; height: 26px; margin: 0; padding: 0 4px; background: ${groupLine}; color: ${NAVY}; font: 15px/24px ${FONT}; text-transform: none; white-space: nowrap; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0 6px 0 0; }
${SPX} .sc-controlpanel-box-content { box-sizing: border-box; margin: 0; padding: 4px 4px 4px 26px; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 2px 0; color: #0055b3; font: 12px/16px ${FONT}; text-decoration: none; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { color: #3399ff; text-decoration: underline; background: transparent; }
${SPX} .sc-controlpanel-no-items { color: #5a5a5a; }

/* ==== Forms: the selected navigation entry and tab sit on the accent ==== */
${SPX} .header.menuItem :is(a, span) { color: #fff; }
${SPX} .sc-tab-control-tab-item.selected :is(a, span) { color: #fff; }
`;

// ==== Launchpad: Vista's desktop. The aurora fills the page; the applications sit in an Explorer window in
// Large Icons view, shown in groups; the analytics message is a gadget on the Sidebar at the right. A group
// collapses from its header (dom.js).
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-lh)`;
const SB = 240; // the Sidebar's width
const AURORA = `radial-gradient(ellipse 70% 22% at 30% 62%, rgba(150, 255, 190, 0.32), transparent 70%),
    radial-gradient(ellipse 60% 14% at 62% 70%, rgba(110, 220, 255, 0.26), transparent 70%),
    radial-gradient(ellipse 90% 30% at 50% 58%, rgba(60, 170, 120, 0.35), transparent 72%),
    radial-gradient(ellipse 80% 70% at 72% 30%, #2f8f6a, #1c6b5a 30%, #0d3a44 62%, #071b26)`;
const launchpad = `/* Longhorn: Launchpad. Generated by tools/build-longhorn-css.cjs.
   Vista's desktop: an Explorer window of large icons in groups, the analytics as a Sidebar gadget. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: ${AURORA} fixed; }
${LPX} .sc-applicationContent { padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; background: none; }
/* Sitecore gives the main section min-height: 100vh under the 48px header, so every page scrolled 48px; the
   grid below fills the window instead */
${LPX} .sc-applicationContent-main > .row { margin: 0; }
/* The page title sits in the caption, after the logo */
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title { display: flex; align-items: center; top: 0; left: 44px; box-sizing: border-box; height: 47px; padding: 0 8px; background: transparent; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { ${capText} line-height: 24px; }
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) ${SB}px;
  grid-template-rows: auto auto auto 1fr;
  align-items: start;
  column-gap: 0;
  box-sizing: border-box;
  width: auto;
  min-height: calc(100vh - 48px);
  margin: 0;
  padding: 0;
  float: none;
}
/* the Sidebar: a dark glass strip down the right edge, the analytics message its gadget */
${LPX} [data-sc-id="ColumnPanel1"]::after { content: ""; grid-column: 2; grid-row: 1 / 5; align-self: stretch; background: linear-gradient(90deg, rgba(0, 0, 0, 0.55), rgba(20, 30, 40, 0.35)); box-shadow: inset 1px 0 rgba(255, 255, 255, 0.2); z-index: 0; }
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 2; float: none; width: auto; margin: 0 14px; position: relative; z-index: 1; }
${LPX} [data-sc-id="CustomAnalyticsLabel"] { grid-row: 1; }
${LPX} [data-sc-id="FallBackMessageBorder"] { grid-row: 2; }
${LPX} [data-sc-id="RowPanelTilesWrapper"] { grid-row: 3; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"] {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 26px;
  margin: 14px 14px 0;
  padding: 0 10px;
  border: 1px solid rgba(0, 0, 0, 0.7);
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(rgba(255, 255, 255, 0.5), rgba(220, 235, 250, 0.35) 50%, rgba(150, 190, 230, 0.4) 50%, rgba(200, 225, 248, 0.45));
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.6);
  color: #fff;
  font: 12px/24px ${FONT};
  text-shadow: 0 1px 2px #000;
  text-transform: none;
  white-space: nowrap;
  cursor: pointer;
}
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] { border-bottom: 1px solid rgba(0, 0, 0, 0.7); border-radius: 6px; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] + .sc-border { display: none; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] { box-sizing: border-box; margin: 0 14px 14px; padding: 10px 12px; border: 1px solid rgba(0, 0, 0, 0.7); border-top: 0; border-radius: 0 0 6px 6px; background: linear-gradient(#fdfdfd, #e9eef5); box-shadow: inset 0 0 0 1px #fff, 0 3px 8px rgba(0, 0, 0, 0.45); }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 0; color: #000; font: 12px/16px ${FONT}; text-align: left; }

/* the Explorer window: a glass frame round a white pane, the applications in groups */
${LPX} .sc-launchpad {
  grid-column: 1;
  grid-row: 1 / 5;
  display: block;
  box-sizing: border-box;
  max-width: none;
  margin: 18px 22px 22px;
  padding: 10px 16px;
  float: none;
  border: 7px solid ${GLASS};
  border-top-width: 26px;
  border-radius: 7px 7px 4px 4px;
  background: #fff padding-box;
  box-shadow: 0 0 0 1px rgba(12, 24, 38, 0.75), inset 0 0 0 1px #5a7fa3, 0 10px 30px rgba(0, 0, 0, 0.5);
  position: relative;
}
${LPX} .sc-launchpad::before { content: "Applications"; position: absolute; top: -26px; left: -1px; right: -1px; height: 26px; padding: 0 8px; border-radius: 6px 6px 0 0; background: ${CAP}; ${capText} line-height: 26px; }
${LPX} .sc-launchpad-group {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 2px;
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
  flex: 0 0 100%;
  box-sizing: border-box;
  height: 24px;
  margin: 0 0 4px;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: ${groupLine};
  color: ${NAVY};
  font: 13px/22px ${FONT};
  text-transform: none;
  cursor: pointer;
}
${LPX} .sc-launchpad-group-title::after { content: ""; display: inline-block; width: 9px; height: 6px; margin: 0 0 1px 8px; background: ${art(CHEV_UP, [1, 1])}; vertical-align: middle; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-group-title::after { background: ${art(CHEV_DOWN, [1, 1])}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-item { display: none; }
${LPX} .sc-launchpad-group-title:hover { ${hot} }
/* Large Icons: the 48px icon over its name, the selection box under the pointer */
${LPX} .sc-launchpad-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  width: 96px;
  height: 92px;
  margin: 0;
  padding: 6px 4px 4px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
  text-decoration: none;
}
${LPX} .sc-launchpad-item .icon { flex: none; width: 48px; height: 48px; margin: 0; border-radius: 0; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 48px; height: 48px; margin: 0; }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: 100%; padding: 0; overflow: hidden; color: #000; font: 12px/15px ${FONT}; white-space: normal; text-align: center; }
${LPX} .sc-launchpad-item:hover { ${hot} text-decoration: none; }
${LPX} .sc-launchpad-item:is(:focus, :active) { outline: none; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) { ${picked} }
`;

// ==== Login: Vista's Welcome screen. The aurora; the logo as the user's tile, in a glass frame; the sign-in
// form below it, the password's round blue arrow button beside it.
const LG = SURFACE("login");
const login = `/* Longhorn: Identity Server login. Generated by tools/build-longhorn-css.cjs.
   Windows Vista's Welcome screen. */
${LG} body {
  min-height: 100vh;
  margin: 0;
  background: ${AURORA};
  color: #fff;
  font: 12px ${FONT};
}
${LG} .top { position: absolute; top: 0; right: 0; z-index: 1; height: auto; padding: 24px 24px; border: 0; background: transparent; box-shadow: none; color: #fff; font: 12px ${FONT}; }
${LG} .top a { color: #fff; }
${LG} .main-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: transparent; }
${LG} .main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  box-sizing: border-box;
  width: min(320px, 100% - 32px);
  margin: 0 auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #fff;
}
${LG} .main::before { content: none; }
/* the tile: a white glass frame round the logo */
${LG} .logo-wrap { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 128px; height: 128px; margin: 0; padding: 16px; border: 4px solid rgba(255, 255, 255, 0.85); border-radius: 6px; background: radial-gradient(ellipse 90% 60% at 30% 25%, #59c08a, #1c6b5a 55%, #0d3a44); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6), 0 6px 18px rgba(0, 0, 0, 0.5), inset 0 0 0 1px #9fb4ca; }
${LG} .logo-wrap img { max-width: 100%; max-height: 100%; height: auto; }
${LG} .login-page { box-sizing: border-box; width: 100%; margin: 0; padding: 0; background: none; }
${LG} .login-page fieldset { margin: 0; padding: 0; border: 0; }
${LG} .login-page .form-group { margin: 0 0 8px; color: #fff; }
${LG} label { color: #fff; font: 12px ${FONT}; text-shadow: 0 1px 2px #000; }
${LG} .form-control {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 24px;
  margin: 3px 0 6px;
  padding: 0 6px;
  font: 12px/22px ${FONT};
  ${field}
  border-color: #6e8197;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25);
}
${LG} .form-control:focus { outline: none; border-color: #3d7bad; box-shadow: 0 0 0 1px rgba(160, 210, 255, 0.8); }
${LG} .form-control::placeholder { color: #6d6d6d; font-style: italic; }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  width: auto;
  min-width: 0;
  height: 30px;
  margin: 4px 0 0 auto;
  padding: 0 4px 0 12px;
  border: 1px solid rgba(0, 0, 0, 0.7);
  border-radius: 15px;
  background: linear-gradient(rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.02) 50%, rgba(255, 255, 255, 0.12));
  color: #fff;
  font: 12px/28px ${FONT};
  text-shadow: 0 1px 2px #000;
  text-transform: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}
/* the round blue arrow */
${LG} .btn.btn-primary::after { content: ""; flex: none; box-sizing: border-box; width: 22px; height: 22px; border: 1px solid #1d4f86; border-radius: 50%; background: ${art(GO)}, radial-gradient(circle at 50% 28%, #bde3ff, #4b9be0 45%, #1a5ea8 75%, #2c7fd0); box-shadow: inset 0 1px rgba(255, 255, 255, 0.6); }
${LG} .btn.btn-primary:is(:hover, :focus) { background: linear-gradient(rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18) 50%, rgba(255, 255, 255, 0.06) 50%, rgba(255, 255, 255, 0.2)); color: #fff; }
${LG} .btn.btn-primary:active { filter: brightness(0.85); }
${LG} .btn.btn-primary:focus-visible { outline: 1px dotted #fff; outline-offset: 2px; }
${LG} input[type="checkbox"] { appearance: none; box-sizing: border-box; width: 13px; height: 13px; margin: 0 4px 0 0; vertical-align: -2px; border: 1px solid #8f8f8f; border-radius: 0; background: linear-gradient(135deg, #dcdcdc, #fff 70%); }
${LG} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcdc, #fff 70%); }
${LG} .remember-me { display: inline-flex; align-items: center; padding: 0; color: #fff; font: 12px ${FONT}; }
${LG} .remember-me input[type="checkbox"] { position: static; flex: none; }
${LG} a, ${LG} .forgot-password { color: #fff; font: 12px ${FONT}; text-shadow: 0 1px 2px #000; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #ffd88a; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", ID);
for (const [name, text] of Object.entries({ shell: css, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
