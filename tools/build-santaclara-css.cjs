// Dev tool: writes extension/themes/santaclara/{shell,speak,launchpad,login}.css and the glyphs they use.
// Santa Clara recreates CDE and Motif on a Solaris workstation. Its window buttons' marks, Motif's bevelled
// arrows and the check marks are glyphs (PNG plus vector SVG pairs, see art()), so the theme is generated
// here rather than written by hand.
//
// Measured CDE 1.x (dtwm and Motif 1.2 at 96 dpi, the sand and maroon palette):
//   panels #ae9c88; text #000; Helvetica 12px (CDE's -dt-interface-medium sans), labels bold where Motif's are
//   bevels 2px (shadowThickness): light #e6dccf top and left, dark #5e5248 bottom and right; raised for
//     buttons, sunken for fields, lists and the scroll trough; etched (dark then light) round frames
//   fields and lists sunken, #c9bcae; the focused one #d9cdbf with Motif's 2px black highlight
//   window frame (dtwm): a 5px border bevelled in and out, the active window's maroon (#a85c60, light
//     #e6b3b5, dark #5a2a2d), an inactive one's sand; the title bar 24px in four bevelled pieces: the window
//     menu button at the left (a bar), the title (white bold, centred), minimize (a small square) and maximize
//     (a large square) at the right. The window menu button holds Close, as dtwm's menu does.
//   push buttons 24px, raised; pressed sunken and darker (#9a8977); the default one inside a sunken ring
//   menus: a raised 2px frame; the armed row raised (Motif marks it with a bevel, not a colour); the menu bar's
//     titles with their mnemonic underlined
//   tabs (Motif 2's notebook): raised tabs, the open one taller and joined to its raised page
//   toggles: square check boxes and diamond radio buttons, sunken and filled maroon when set
//   scroll bar 15px: a sunken #9a8977 trough, a raised sand slider, bevelled triangle arrows
//   front panel: slate #64748b with #b8c4d4 and #36404d bevels (CDE's #6b7c93 is 4.3:1 under white text);
//     its middle the workspace switch, four coloured buttons: here each running window is one of them, in the
//     workspace colours (maroon, olive #6a7951, steel #556f7d, umber #7d6e55), as their names are
//   selection maroon #a85c60 under white text (4.8:1)
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const ID = "santaclara";
const SURFACE = (s) => `html[data-sct-theme="${ID}"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-sc) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-sc)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
const FONT = 'Helvetica, Arial, "Liberation Sans", sans-serif';
// Colours of the pixel art: W white, K black, L and D a maroon bevel's light and dark, S and H a sand bevel's
// light and dark (the dark one deepened so the marks read on sand), M the arrows' face, a shade under the sand.
const COLORS = { W: "#fff", K: "#000", L: "#f2c9cb", D: "#5a2a2d", S: "#e6dccf", H: "#3d342c", M: "#8a7966" };

// ---- Pixel art (as in tools/build-metal-css.cjs): one character per pixel, '.' transparent. Each glyph is
// written to themes/santaclara/glyphs twice, as a PNG (1x) and as a vector SVG (every other scale), and named
// sct-ext:, which background.js points at the extension (a site's CSP can block data:). Placed centred, at
// [x, y] from the box's top left, or, given a number, that many pixels in from the right, centred vertically.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.WKLDSHM]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
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
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-sc-)/.test(m[2]))
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
// a bevelled box w x h: light top and left, dark bottom and right
const boxArt = (w, h, l, d) => [l.repeat(w), ...Array.from({ length: h - 2 }, () => `${l}${".".repeat(w - 2)}${d}`), l + d.repeat(w - 1)];
// dtwm's marks on the title bar's buttons: the window menu's bar, minimize's small square, maximize's large one
const MENU_MARK = boxArt(12, 4, "L", "D");
const MIN_MARK = boxArt(5, 5, "L", "D");
const MAX_MARK = boxArt(11, 11, "L", "D");
const MENU_MARK_S = boxArt(12, 4, "S", "H");
const MIN_MARK_S = boxArt(5, 5, "S", "H");
const MAX_MARK_S = boxArt(11, 11, "S", "H");
// Motif's arrows: a sand triangle with a light edge on the lit side and a dark edge on the other
const UP = [
  "....S....", "...SMH...", "...SMH...", "..SMMMH..", "..SMMMH..", ".SMMMMMH.", ".SMMMMMH.", "SHHHHHHHH",
];
const DOWN = ["SSSSSSSSH", ".SMMMMMH.", ".SMMMMMH.", "..SMMMH..", "..SMMMH..", "...SMH...", "...SMH...", "....H...."];
const LEFT = [
  "......SS", "....SSMH", "..SSMMMH", "SSMMMMMH", "HHMMMMMH", "..HHMMMH", "....HHMH", "......HH",
];
const RIGHT = ["SS......", "SMSS....", "SMMMSS..", "SMMMMMSS", "SMMMMMHH", "SMMMHH..", "SMHH....", "HH......"];
// the menu fly-out and drop-down marks: small solid triangles, as Motif's cascade buttons
const TRI_RIGHT = ["K...", "KK..", "KKK.", "KKKK", "KKK.", "KK..", "K..."];
const TRI_RIGHT_W = TRI_RIGHT.map((r) => r.replace(/K/g, "W"));
const TRI_DOWN = ["KKKKKKK", ".KKKKK.", "..KKK..", "...K..."];
vector(TRI_RIGHT, `<path d="M0 0L4 3.5L0 7Z" fill="#000"/>`);
vector(TRI_RIGHT_W, `<path d="M0 0L4 3.5L0 7Z" fill="#fff"/>`);
vector(TRI_DOWN, `<path d="M0 0H7L3.5 4Z" fill="#000"/>`);
// the check mark (CDE's toggle, set)
const CHECK = ["......W", ".....WW", "W...WWW", "WW.WWW.", "WWWWW..", ".WWW...", "..W...."];
vector(CHECK, `<path d="M0.7 3.2L2.5 5.2L6.4 1" fill="none" stroke="#fff" stroke-width="2"/>`);

// ---- Motif recipes ----
const SAND = "#ae9c88", SAND_L = "#e6dccf", SAND_D = "#5e5248", WELL = "#c9bcae", WELL_FOCUS = "#d9cdbf", DOWN_BG = "#9a8977";
const MAROON = "#a85c60", MAROON_L = "#e6b3b5", MAROON_D = "#5a2a2d";
const SLATE = "#64748b", SLATE_L = "#b8c4d4", SLATE_D = "#36404d";
const raised = (l = SAND_L, d = SAND_D, w = 2) => `border: ${w}px solid; border-color: ${l} ${d} ${d} ${l};`;
const sunken = (l = SAND_L, d = SAND_D, w = 2) => `border: ${w}px solid; border-color: ${d} ${l} ${l} ${d};`;
const RAISED = raised();
const SUNKEN = sunken();
// an etched frame drawn with shadows: dark then light, 2px
const ETCHED = `box-shadow: inset 1px 1px ${SAND_D}, inset -1px -1px ${SAND_L}, 1px 1px ${SAND_L};`;
const capText = `color: #fff; font: bold 13px/1 ${FONT}; text-shadow: none;`;
// the window frame drawn outside an element (a desktop window's iframe): a 5px maroon border bevelled out
const ring = (face, l, d) => `0 0 0 3px ${face}, -2px -2px 0 3px ${l}, 2px 2px 0 3px ${d}, 3px 3px 0 4px rgba(0, 0, 0, 0.35)`;
const FRAME_RING = ring(MAROON, MAROON_L, MAROON_D);
const FRAME_RING_IN = ring(SAND, SAND_L, SAND_D);
// tabs
const tab = `${RAISED} border-bottom: 0; border-radius: 0; background: ${SAND}; box-shadow: none; color: #000; text-transform: none; text-shadow: none;`;
const tabOpen = "background: #bfae9b;";
// push buttons
const push = `box-sizing: border-box; ${RAISED} border-radius: 0; background: ${SAND}; color: #000; text-shadow: none; text-transform: none; box-shadow: none;`;
const pushHot = "background: #b8a792;";
// the default button: Motif draws a sunken ring round it
const pushDefault = `box-shadow: 0 0 0 1px ${SAND}, 0 0 0 2px ${SAND_D}, 0 0 0 3px ${SAND_L};`;
const pushDown = `${SUNKEN} background: ${DOWN_BG};`;
const pushOff = "color: #75685b;";
// toolbar buttons (ribbon, header buttons): flat until the pointer arms them, then raised; pressed sunken
const toolHot = `border-color: ${SAND_L} ${SAND_D} ${SAND_D} ${SAND_L}; background: transparent;`;
const toolDown = `border-color: ${SAND_D} ${SAND_L} ${SAND_L} ${SAND_D}; background: ${DOWN_BG};`;
// fields
const field = `${SUNKEN} border-radius: 0; background-color: ${WELL}; color: #000; box-shadow: none;`;
const fieldFocus = `background-color: ${WELL_FOCUS}; outline: 2px solid #000; outline-offset: 0;`;
// the selection
const SEL = `background: ${MAROON}; color: #fff;`;
// the scroll bar's slider and arrow buttons: raised sand
const slider = `background: ${SAND}; box-shadow: inset 2px 2px ${SAND_L}, inset -2px -2px ${SAND_D};`;
// the front panel's controls
const panelBtn = `${raised(SLATE_L, SLATE_D)} background: ${SLATE}; color: #fff;`;
const panelDown = `border-color: ${SLATE_D} ${SLATE_L} ${SLATE_L} ${SLATE_D}; background: #56657a;`;
// the workspace colours, for running windows on the front panel
const WORKSPACES = [[MAROON, MAROON_L, MAROON_D], ["#6a7951", "#c9d6b2", "#3b4630"], ["#556f7d", "#b2c9d6", "#2f3f47"], ["#7d6e55", "#d6c9b2", "#463d2e"]];

const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");
const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
const LC = ":is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)";

// The global header (standalone Content Editor, SPEAK pages): the active window's maroon title bar.
const header = (S) => `/* ---- Global header: a maroon title bar ---- */
${S} :is(.sc-globalHeader, .sc-flx-global-header) { background: ${MAROON}; border: 0; border-bottom: 2px solid ${MAROON_D}; box-shadow: inset 0 2px ${MAROON_L}; color: #fff; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation span,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a,
${S} :is(.sc-globalHeader, .sc-flx-global-header) a { color: #fff; font-family: ${FONT}; text-shadow: none; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::before, ${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::after { color: #fff; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { box-sizing: border-box; border: 2px solid; border-color: ${MAROON_D} ${MAROON_L} ${MAROON_L} ${MAROON_D}; border-radius: 0; }
/* Sitecore's logo is dark art: white on the maroon */
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-global-logo { filter: brightness(0) invert(1); }
`;

// The application header of a SPEAK page (title, Back): a sand bar under the title, the title bold.
const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: ${SAND}; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: ${SAND}; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 8px 15px 6px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 16px/22px ${FONT}; }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 15px 8px; background: ${SAND}; border: 0; border-bottom: 2px solid ${SAND_D}; box-shadow: 0 2px ${SAND_L}; }
${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 24px; min-width: 0; padding: 0 12px 0 8px; ${push} }
${SX} .btn.sc-backbutton:active { ${pushDown} }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: 12px/20px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before { position: static; flex: none; width: 10px; height: 10px; background: ${art(LEFT)}; mask: none; transform: none; }`;

// dtwm's title bar buttons: a bevelled box of the bar's colour holding its mark
const capBtn = (mark, face, l, d) => `box-sizing: border-box; width: 22px; height: 22px; margin: 0; padding: 0; border: 2px solid; border-color: ${l} ${d} ${d} ${l}; border-radius: 0; ${paint(`${art(mark)}, ${face}`)}`;

const css = `/* Santa Clara: classic shell. Generated by tools/build-santaclara-css.cjs; never hand-edit.
   CDE and Motif: sand panels with 2px bevels, maroon window frames, sunken fields, Motif menus, Helvetica. */

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} { scrollbar-color: auto; }

/* ---- Scrollbars: a sunken trough, a raised slider, Motif's bevelled arrows ---- */
${P} ::-webkit-scrollbar { width: 15px; height: 15px; background: ${DOWN_BG}; }
${P} ::-webkit-scrollbar-track { border-radius: 0; background: ${DOWN_BG}; box-shadow: inset 1px 1px ${SAND_D}, inset -1px -1px ${SAND_L}; }
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { border: 0; border-radius: 0; ${slider} }
${P} ::-webkit-scrollbar-corner { background: ${SAND}; }
${P} ::-webkit-scrollbar-button:single-button { display: block; background-color: ${DOWN_BG}; }
${P} ::-webkit-scrollbar-button:vertical:single-button { width: 15px; height: 15px; }
${P} ::-webkit-scrollbar-button:horizontal:single-button { width: 15px; height: 15px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: ${art(UP)}, ${DOWN_BG}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: ${art(DOWN)}, ${DOWN_BG}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: ${art(LEFT)}, ${DOWN_BG}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: ${art(RIGHT)}, ${DOWN_BG}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar: Motif's again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 15px; height: 15px; background: ${DOWN_BG}; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { border: 0; border-radius: 0; ${slider} }

${header(P)}
/* ---- Ribbon: the tab row is a Motif menu bar (each title's mnemonic underlined), the open one armed (raised);
   the toolbar's groups are etched frames ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: ${SAND}; }
${P} .scRibbonNavigator { border-bottom: 0; }
${TABS("Normal")},
${TABS("Active")} {
  position: relative;
  box-sizing: border-box;
  height: 24px;
  margin: 0 0 1px;
  padding: 0 10px;
  border: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 12px/20px ${FONT};
  text-transform: none;
}
${TABS("Normal")}::first-letter, ${TABS("Active")}::first-letter { text-decoration: underline; }
${TABS("Normal:hover")} { ${toolHot} }
${TABS("Active")} { border-color: ${SAND_L} ${SAND_D} ${SAND_D} ${SAND_L}; background: #bfae9b; }
${P} .scRibbonToolbar { background: ${SAND}; border-top: 2px solid ${SAND_D}; border-bottom: 2px solid ${SAND_D}; box-shadow: inset 0 2px ${SAND_L}; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: transparent;
  border: 0;
  border-radius: 0;
  ${ETCHED}
  margin: 3px 3px 3px 2px;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #000; font: 11px ${FONT}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; font-size: 11px; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 2px solid transparent; border-radius: 0; }
/* Only the buttons react, not their icons or labels, and disabled buttons (spans) not at all. A large combo
   button shows its command and its drop-down as two faces while armed, each pressed on its own. */
${P} .scRibbonToolbar ${RB}:hover { ${toolHot} }
${P} .scRibbonToolbar ${RB}:active { ${toolDown} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > ${LC} { ${toolHot} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > ${LC}:active { ${toolDown} }
/* Copenhagen-tight on both versions: the strip keeps 1px plus the chunks' 3px margin above and below
   (10.5 pads it 12px over an 80px minimum), the panel 3px above the buttons and 4px at the sides (10.5
   16px, 10.4 10px 8px), a 16px caption, and large buttons cut from 55px to 46px so they end above the
   caption with their bevel. */
${X} :is(.scRibbonToolbarStrip, .scRibbonToolbarContextualStrip) { display: flow-root; min-height: 0; padding: 1px 0; }
${X} .scRibbonToolbar .chunk > .panel { box-sizing: border-box; height: 52px; padding: 3px 4px 0; }
${X} .scRibbonToolbar .chunk > .caption { height: 16px; padding: 0 4px; line-height: 16px; }
${X} .scRibbonToolbar :is(a.scRibbonToolbarLargeButton, span.scRibbonToolbarLargeButtonDisabled, a.scRibbonToolbarLargeButtonDown, a.scRibbonToolbarLargeGalleryButton, span.scRibbonToolbarLargeGalleryButtonDisabled) { padding: 1px 4px 0; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLarge"] .header { padding: 3px 4px 1px; }
${X} .scRibbonToolbar :is(.scRibbonGallery, .scRibbonToolbarSmallButtons) { padding: 1px 5px 0; }
${X} .scRibbonToolbar .scRibbonToolbarSmallCheckButton { padding: 2px 3px; }
${X} .scRibbonToolbar :is(.scRibbonToolbarLargeComboButton, .scRibbonToolbarLargeComboButtonDisabled) { padding: 0; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonTop"] { padding: 0 4px; }
${X} .scRibbonToolbar [class*="scRibbonToolbarLargeComboButtonBottom"] { padding: 0 4px 1px; }
/* 10.4's chunk launchers are pale grey: inked like the captions */
${X} .scRibbonChunkEndLink img.glyph { filter: brightness(0.4); }
/* 10.5's grey ribbon icons were drawn for white: deepened on the sand (colour icons keep their hues) */
${X} :is(.scRibbonToolbar img:is([class*="Icon"], .scRibbonToolbarSmallButtonIcon), .scMenu td[class*="scMenuItemIcon"] > img, .scStartMenu img:is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon), #Masters img) { filter: contrast(1.35) brightness(0.82); }

/* ---- Content tree: a sunken list, the maroon selection, +/- boxes bevelled out (real 9px borders) ---- */
${P} .scContentTree { background: ${WELL}; }
${P} .scContentTree :is(a, span) { font-size: 12px; }
${P} .scContentTree a.scContentTreeNodeActive { ${SEL} outline: 0; border-radius: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: #fff !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: #d6cbbe; text-decoration: none; }
${P} img[src*="/treemenu_"] {
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  margin: 4px 3px 3px 4px;
  border: 1px solid;
  border-color: ${SAND_L} ${SAND_D} ${SAND_D} ${SAND_L};
  border-radius: 0;
  object-fit: none;
  object-position: -999px -999px;
}
/* Default.css gives tree glyphs a 5px 0 margin */
${P} .scContentTreeNode > img[src*="/treemenu_"] { margin: 9px 3px 8px 4px; }
${P} img[src*="/treemenu_collapsed"] { background: linear-gradient(#000, #000) center / 1px 5px no-repeat, linear-gradient(#000, #000) center / 5px 1px no-repeat, ${SAND}; }
${P} img[src*="/treemenu_expanded"] { background: linear-gradient(#000, #000) center / 5px 1px no-repeat, ${SAND}; }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: bold 14px ${FONT}; color: #000; }
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${tab}
  height: 22px;
  margin: 34px 1px 0 0;
}
${P} a.scRibbonEditorTabNormal:hover, ${P} a#BTAddNewSearch:hover { background: #b8a792; }
${P} a.scRibbonEditorTabActive { ${tabOpen} position: relative; z-index: 1; height: 24px; }
${P} #EditorTabs { height: 58px; border-bottom: 2px solid ${SAND_L}; }
${P} a#BTAddNewSearch { width: 30px; }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: 12px ${FONT};
  border: 0;
  height: 20px;
  line-height: 20px;
  padding: 0 10px;
}
${P} .scEditorTabHeaderActive { font-weight: bold; }
/* sections: raised bars, Motif's arrow before the bold name */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  box-sizing: border-box;
  height: 24px;
  margin: 0 0 3px;
  padding: 0 0 0 4px;
  ${RAISED}
  border-radius: 0;
  background: #bfae9b;
  color: #000;
  font: bold 12px/20px ${FONT};
}
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed):hover { background: #c8b8a6; }
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed):active { ${SUNKEN} background: ${DOWN_BG}; }
${P} img.scEditorSectionCaptionGlyph { float: left; width: 16px; height: 16px; margin: 2px 4px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(art(DOWN))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(art(RIGHT))} }
${P} .scEditorFieldLabel { color: #000; font: bold 12px ${FONT}; }

/* ---- Fields: sunken #c9bcae; the focused one paler, inside Motif's 2px black highlight ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select { ${field} }
/* Motif's option menu: a raised button holding the choice and the small bar mark */
${P} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 22px; ${RAISED} background: linear-gradient(${SAND_L}, ${SAND_L}) right 6px top 50% / 10px 2px no-repeat, linear-gradient(${SAND_D}, ${SAND_D}) right 6px top calc(50% + 2px) / 10px 2px no-repeat, ${SAND}; }
${X} input[type="checkbox"], ${X} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 5px 0 1px;
  vertical-align: -2px;
  ${RAISED}
  border-radius: 0;
  background: ${SAND};
  box-shadow: none;
}
/* Motif's radio buttons are diamonds */
${X} input[type="radio"] { transform: rotate(45deg) scale(0.85); }
${X} :is(input[type="checkbox"], input[type="radio"]):checked { ${SUNKEN} background: ${MAROON}; }
${X} input[type="checkbox"]:checked { background: ${art(CHECK)}, ${MAROON}; }
${X} :is(input[type="checkbox"], input[type="radio"]):disabled { border-color: #c4b6a5; background: ${SAND}; opacity: 1; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 2px solid #000; outline-offset: 1px; }

/* ---- Push buttons: raised sand; pressed sunken and darker; the default one ringed ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] { ${push} font: 12px ${FONT}; }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):hover:not(:disabled) { ${pushHot} }
${P} .scButtonPrimary { ${pushDefault} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):active:not(:disabled) { ${pushDown} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):disabled { ${pushOff} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 2px solid #000; outline-offset: 0; }

/* ---- Bottom application tabs: raised tabs hanging from the window's bottom edge ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 4px 3px; background: ${SAND}; border-top: 2px solid ${SAND_L}; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  color: #000;
  font: 12px ${FONT};
  background: ${SAND};
  ${RAISED}
  border-top: 0;
  border-radius: 0;
  box-shadow: none;
  margin: 0 1px 0 0;
}
${P} .scPagerButtonNormal:hover { background: #b8a792; }
${P} .scPagerButtonActive { background: #bfae9b; font-weight: bold; position: relative; z-index: 1; top: -2px; padding-top: 2px; }

/* ---- Dialog windows: a dtwm window. The page inside the dialog draws the title bar (its header); Sitecore's
   empty jQuery title bar is laid over it, keeping the drag and carrying the window's buttons: Close as the
   window menu button at the left, the rest at the right. ---- */
${P} .ui-dialog {
  background: ${SAND};
  border: 5px solid ${MAROON};
  border-radius: 0;
  padding: 0;
  overflow: hidden;
  box-shadow: inset 2px 2px ${MAROON_L}, inset -2px -2px ${MAROON_D}, -2px -2px 0 0 ${MAROON_L}, 2px 2px 0 0 ${MAROON_D}, 4px 4px 0 1px rgba(0, 0, 0, 0.3);
}
${X} .ui-dialog { border-color: ${MAROON}; background: ${SAND}; }
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 24px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  top: 1px !important;
  left: 1px;
  right: 1px !important;
  margin: 0 !important;
  height: 22px;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  pointer-events: none;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 2px solid;
  border-color: ${MAROON_L} ${MAROON_D} ${MAROON_D} ${MAROON_L};
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  text-indent: -999px;
  pointer-events: auto;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: -1;
  margin: 0 auto 0 0 !important;
  background: ${art(MENU_MARK)}, ${MAROON};
}
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: ${art(MIN_MARK)}, ${MAROON}; }
${P} .ui-dialog :is(.ui-dialog-titlebar-maximize, .ui-dialog-titlebar-restore) { background: ${art(MAX_MARK)}, ${MAROON}; }
${P} .ui-dialog .ui-dialog-titlebar-collapse { background: ${art(boxArt(11, 4, "L", "D"))}, ${MAROON}; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :active { border-color: ${MAROON_D} ${MAROON_L} ${MAROON_L} ${MAROON_D}; }
/* a faint shade marks the dialog as modal */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.18); opacity: 1; }

/* Inside a dialog page: the header is the title bar, a bevelled maroon bar between the buttons. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: ${SAND}; padding: 0; border: 0; min-height: 0 !important; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  height: 24px;
  margin: 0;
  padding: 0 72px 0 26px;
  background: ${MAROON};
  border: 1px solid ${MAROON};
  border-radius: 0;
  box-shadow: inset 2px 2px ${MAROON_L}, inset -2px -2px ${MAROON_D};
  ${capText}
  line-height: 24px;
  white-space: nowrap;
}
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 8px 10px; margin: 0; font: 12px ${FONT}; background: ${SAND}; border-bottom: 2px solid ${SAND_D}; box-shadow: 0 2px ${SAND_L}; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background: ${SAND}; }
${P} .scFormDialogFooter { border-top: 2px solid ${SAND_D}; border-radius: 0; box-shadow: inset 0 2px ${SAND_L}; }
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 42px; padding: 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: right; display: flex; gap: 10px; }
/* SPE's help (?) floats for 10.x's taller footer: centred on the 24px buttons instead */
${X} .scFormDialogFooter img#Copyright { margin: 0; }

/* ---- Tab strips (dialogs, the ISE's script tabs): Motif's notebook tabs ---- */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 2px solid ${SAND_L}; }
/* Sitecore swaps scTab for scTab_Hover under the mouse; the stock hover class is uppercase on a light face. */
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${tab}
  height: auto;
  padding: 0 10px 0 14px;
  margin: 0 1px 0 0;
  font: 12px/20px ${FONT};
}
${P} .scTabstrip .scTab_Hover { background: #b8a792; }
${P} .scTabstrip [class*="scTabActive"] { ${tabOpen} position: relative; z-index: 1; padding-bottom: 2px; margin-bottom: -2px; font-weight: bold; }
/* The open first tab lines up with the page's left edge and keeps the light bevel the page's edge has: Sitecore styles
   the first <nobr>'s open tab apart (its own dark border, position: static), and the colour map copies that over */
${X} .scTabstrip > nobr:first-child > [class*="scTabActive"] { position: relative; left: 0; border-left-color: ${SAND_L}; }
/* focus: Motif's 2px black highlight inside the tab */
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus { outline: none; box-shadow: none; }
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus-visible { outline: 2px solid #000; outline-offset: -4px; }
${P} .scTabstrip .closeTab { margin: 0 -2px 0 6px; }
/* the ISE's unsaved-script dot, darkened from SPE's #fc2929 to pass AA on the sand */
${P} .scTabstrip .scriptModified { color: #5a0d10; }

/* ---- Window buttons (Desktop windows and the Content Editor's own): dtwm's bevelled boxes, Close as the
   window menu button at the left ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) { display: flex; align-items: center; gap: 2px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { order: 2; ${capBtn(MIN_MARK, MAROON, MAROON_L, MAROON_D)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="maximize"], [src*="restore"]) { order: 3; ${capBtn(MAX_MARK, MAROON, MAROON_L, MAROON_D)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { order: -1; ${capBtn(MENU_MARK, MAROON, MAROON_L, MAROON_D)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="page_switcher"] { order: 1; ${capBtn(["KKKKKKK", ".KKKKK.", "..KKK..", "...K..."], SAND, SAND_L, SAND_D)} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"]):active { border-color: ${MAROON_D} ${MAROON_L} ${MAROON_L} ${MAROON_D}; }
/* The Content Editor's own buttons: on the sand beside its tabs, so sand boxes */
${P} .scSystemButtons { margin-right: 6px; }
${P} .scSystemButtons img[src*="minimize"] { ${capBtn(MIN_MARK_S, SAND, SAND_L, SAND_D)} }
${P} .scSystemButtons img:is([src*="maximize"], [src*="restore"]) { ${capBtn(MAX_MARK_S, SAND, SAND_L, SAND_D)} }
${P} .scSystemButtons img[src*="_close"] { order: 9; ${capBtn(MENU_MARK_S, SAND, SAND_L, SAND_D)} }
${P} .scSystemButtons img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"]):active { border-color: ${SAND_D} ${SAND_L} ${SAND_L} ${SAND_D}; }
/* Standard windows (ISE, Console, Package Designer...): the maroon title bar, its title a bevelled piece
   between the window menu button and minimize and maximize */
${P} .standardWindowCaption {
  box-sizing: border-box;
  height: 26px;
  padding: 1px;
  background: ${MAROON};
  border: 0;
  border-radius: 0;
  text-align: center;
}
${P} .standardWindowCaption::before { content: ""; position: absolute; top: 1px; left: 25px; right: 49px; height: 24px; box-sizing: border-box; border: 2px solid; border-color: ${MAROON_L} ${MAROON_D} ${MAROON_D} ${MAROON_L}; pointer-events: none; }
/* Around the caption: the window's frame, maroon */
${X} .scWindowFrame, ${X} .scWindowBorder2 { border-color: ${MAROON}; }
${X} .scWindowFrame > .scStretch { background-color: ${MAROON}; }
${PI}:not(#sct-sc) .scWindowFrame, ${PI}:not(#sct-sc) .scWindowBorder2 { border-color: ${SAND}; }
${PI}:not(#sct-sc) .scWindowFrame > .scStretch { background-color: ${SAND}; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 26px; }
${P} .standardWindowCaption .windowCaptionIcon { display: inline-block; vertical-align: top; margin: 4px 0 0 0; }
${P} .standardWindowCaption .scWindowCaption {
  display: inline-block;
  ${capText}
  line-height: 24px;
  padding: 0 6px;
  vertical-align: top;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* The ISE writes its script's path into the caption in an inline #bbb: pale pink on the maroon. */
${P} .standardWindowCaption .scWindowCaption i { color: #f6dcdd !important; }
/* The button box spans the bar: the window menu button at the left, minimize and maximize at the right. */
${P} .standartWindowButtons { top: 2px; left: 2px; right: 2px; height: 22px; display: flex; justify-content: flex-end; pointer-events: none; }
${P} .standartWindowButtons img { pointer-events: auto; }
${P} .standartWindowButtons img[src*="_close"] { margin-right: auto; }
/* SPE's ISE (ise.js) gives its title the room the .standartWindowButtons box leaves; here that box spans the
   bar, so the title would get none. The title bar's own padding keeps it clear of the buttons. */
${P} .standardWindowCaption #WindowCaption { max-width: calc(100% - 90px) !important; margin-left: 0 !important; }
/* An inactive window (dom.js marks its document from the taskbar): dtwm paints its frame and title sand. */
${PI} .standardWindowCaption { background: ${SAND}; }
${PI} .standardWindowCaption::before { border-color: ${SAND_L} ${SAND_D} ${SAND_D} ${SAND_L}; }
${PI} .standardWindowCaption .scWindowCaption { color: #000; }
${PI} .standardWindowCaption .scWindowCaption i { color: #3a3128 !important; }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. CDE's maroon title bar, its title a bevelled piece left of the window buttons, as on every other window, is
   drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), the window's
   buttons on it and the ribbon's menu button moved below it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 26px; padding: 1px; background: ${MAROON}; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 24px; margin-right: 76px; border: 2px solid; border-color: ${MAROON_L} ${MAROON_D} ${MAROON_D} ${MAROON_L}; ${capText} line-height: 20px; text-align: center; padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 2px; right: 2px; margin-right: 0; height: 22px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 26px; height: 25px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 4px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 4px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 4px; }
/* the same 4px on a standard window (the ISE...), whose ribbon is in the page inside the window's chrome */
${P}[data-sct-window-content] .scRibbonNavigator { padding-top: 4px; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { background: ${SAND}; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { border-color: ${SAND_L} ${SAND_D} ${SAND_D} ${SAND_L}; color: #000; }

${PI} :is(.standartWindowButtons, .scSystemButtons, .scWorkboxWindowButtons) img[src*="minimize"] { ${capBtn(MIN_MARK_S, SAND, SAND_L, SAND_D)} }
${PI} .standartWindowButtons img:is([src*="maximize"], [src*="restore"]) { ${capBtn(MAX_MARK_S, SAND, SAND_L, SAND_D)} }
${PI} :is(.standartWindowButtons, .scSystemButtons, .scWorkboxWindowButtons) img[src*="_close"] { ${capBtn(MENU_MARK_S, SAND, SAND_L, SAND_D)} }

/* ---- Insert gallery scroller: Motif's arrows ---- */
${P} .scRibbonPanelButtons { background: transparent; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { width: 17px; height: 15px; filter: none; }
${P} img.scRibbonPanelUp { ${paint(`${art(UP)}, transparent`)} }
${P} img.scRibbonPanelDown { ${paint(`${art(DOWN)}, transparent`)} }
${P} img.scRibbonPanelOpen { box-sizing: border-box; ${RAISED} ${paint(`${art(["KK.KK.KK", "KK.KK.KK"])}, ${SAND}`)} }

/* ==== Desktop: the backdrop and the front panel ==== */
/* CDE had no header above the workspace: the start menu takes over the user name and Log out (dom.js). */
${X}:has(#Desktop) .sc-globalHeader { display: none; }
${X}:has(#Desktop) .sc-globalHeader ~ :is(div, table) { padding-top: 0; }
${X}:has(#Desktop) .sc-globalHeader ~ div > .DesktopArea { margin-top: 0; }
/* The workspace runs to the screen's bottom edge, the front panel standing on it, and so do the windows: a
   maximized window fills it and runs on under the panel, which floats above every non-modal window. */
${X} .DesktopArea {
  top: 0;
  bottom: 0;
  overflow: clip;
  /* a backdrop: slate blue-grey woven with a faint diagonal; Sitecore sets its wallpaper inline */
  background:
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 2px, transparent 2px 6px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.05) 0 2px, transparent 2px 6px),
    #5f7f8c !important;
  background-origin: border-box !important;
  background-clip: border-box !important;
}
${X} .DesktopArea > :is(iframe, div[id^="FRAME"]) { top: 0; }

/* ---- The front panel: a slate bar standing centred on the bottom edge. The start button is its first
   control, the running windows fill the workspace switch in the workspace colours, the tray its last
   controls, each control a bevelled box. ---- */
${X} .scStartbar { bottom: 0; height: 66px; z-index: 900; border: 0; background: transparent; pointer-events: none; }
${X} #Startbar {
  box-sizing: border-box;
  width: fit-content;
  min-width: 640px;
  max-width: calc(100% - 16px);
  height: 64px !important;
  margin: 0 auto;
  padding: 4px;
  ${raised(SLATE_L, SLATE_D)}
  background: ${SLATE};
  box-shadow: 0 0 0 1px #20262e;
  pointer-events: auto;
}
${X} #Startbar > table { display: flex; align-items: stretch; gap: 3px; width: auto; height: 100%; border: 0; border-spacing: 0; background: none; box-shadow: none; }
${X} #Startbar > table > tbody, ${X} #Startbar > table > tbody > tr { display: contents; }
${X} #Startbar > table > tbody > tr > td { display: block; flex: none; width: auto; height: auto; padding: 0; border: 0; background: none; vertical-align: middle; }
${X} #Startbar > table > tbody > tr > td:nth-child(2) { flex: 1 1 auto; min-width: 0; }
/* the start button: a front panel control, Sitecore's start picture in a bevelled box */
${X} .scStartButtonContainer { position: relative; width: 56px; height: 52px; }
${X} :is(.scStartButton, .scStartButton:hover, .scStartButton.scPopupOpener) {
  top: 0;
  left: 0;
  box-sizing: border-box;
  width: 56px;
  height: 52px;
  margin: 0;
  padding: 0;
  ${panelBtn}
  border-radius: 0;
  box-shadow: none;
  background: url("/sitecore/shell/themes/standard/Images/Startbar/StartButton.png") center / 72px 58px no-repeat, ${SLATE};
}
${X} .scStartButton.scPopupOpener { ${panelDown} background: url("/sitecore/shell/themes/standard/Images/Startbar/StartButton.png") center / 72px 58px no-repeat, #56657a; }
${X} .scStartButton:focus-visible { outline: 2px solid #000; outline-offset: -4px; }
/* the workspace switch: a sunken well holding the running windows as coloured buttons */
${X} .scStartBarScroller {
  box-sizing: border-box;
  height: 52px;
  padding: 3px 10px;
  ${sunken(SLATE_L, SLATE_D)}
  background: ${SLATE};
  overflow: hidden;
}
${X} #StartbarApplications, ${X} #StartbarApplications > tbody { display: block; height: 42px; margin: 0; }
${X} #StartbarApplications > tbody > tr { display: grid; grid-template-rows: repeat(2, 20px); grid-auto-flow: column; grid-auto-columns: minmax(70px, 150px); gap: 2px; height: 42px; }
${X} #StartbarApplications > tbody > tr > td {
  box-sizing: border-box;
  min-width: 0;
  height: 20px;
  padding: 0 6px;
  border: 2px solid;
  border-radius: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: none;
}
${WORKSPACES.map(([face, l, d], i) => `${X} #StartbarApplications > tbody > tr > td:nth-child(4n + ${i + 1}) { background: ${face}; border-color: ${l} ${d} ${d} ${l}; }
${X} #StartbarApplications > tbody > tr > td.scActiveApplication:nth-child(4n + ${i + 1}) { border-color: ${d} ${l} ${l} ${d}; }`).join("\n")}
${X} #StartbarApplications > tbody > tr > td::before, ${X} #StartbarApplications > tbody > tr > td::after { display: none; }
${X} #StartbarApplications > tbody > tr > td :is(*, a, span) { color: #fff; font: 11px/16px ${FONT}; text-shadow: none; }
${X} #StartbarApplications > tbody > tr > td.scActiveApplication :is(*, a, span) { font-weight: bold; }
${X} .scStartBarApplication { display: block; height: 16px; margin: 0; padding: 0; border: 0; background: none; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartBarApplication span img { width: 14px; height: 14px; margin: 0 4px 0 0 !important; vertical-align: -3px; }
/* the tray: the search field, the database and the clock, each in a front panel control */
${X} .scStartbarTray { height: 52px; border: 0; border-spacing: 3px 0; background: none; }
${X} .scStartbarTray > tbody > tr > td { box-sizing: border-box; height: 52px; padding: 0 6px; ${panelBtn} line-height: normal !important; vertical-align: middle; }
${X} .scStartbarTray :is(td, span) { color: #fff; font: 11px ${FONT}; }
${X} #SearchBox { box-sizing: border-box; width: 150px; height: 22px; min-height: 0; margin: 0; padding: 0 4px; ${field} font: 12px ${FONT}; }
${X} #SearchBox::placeholder { color: #3a3128; }
${X} #SearchBox:focus { ${fieldFocus} }
${X} #DatabaseSelector { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; height: 44px; padding: 0 2px; border-radius: 0; background: transparent; color: #fff; font: 11px ${FONT}; }
${X} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 !important; }
${X} .sct-sc-clock { box-sizing: border-box; min-width: 64px; text-align: center; white-space: nowrap; color: #fff; font: bold 13px ${FONT}; }

/* ---- Start menu: a Motif menu rising from the front panel, framed raised; the armed row raised
   (dom.js adds the account row and Log out) ---- */
${X} .scPopup:has(> .scStartMenu) { padding: 0; border: 0; border-radius: 0; box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.35); background: transparent; overflow: hidden; }
${X} .scStartMenu {
  box-sizing: border-box;
  width: 400px;
  padding: 2px;
  ${RAISED}
  border-radius: 0;
  background: ${SAND};
  box-shadow: none;
  overflow: hidden;
  font-family: ${FONT};
}
${X} .sct-sc-smtop { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 8px; margin: 0 0 2px; background: ${MAROON}; box-shadow: inset 2px 2px ${MAROON_L}, inset -2px -2px ${MAROON_D}; }
${X} .sct-sc-smtop img { box-sizing: border-box; width: 30px; height: 30px; border: 2px solid; border-color: ${MAROON_D} ${MAROON_L} ${MAROON_L} ${MAROON_D}; background: ${WELL}; object-fit: cover; }
${X} .sct-sc-smtop span { overflow: hidden; color: #fff; font: bold 13px/1.2 ${FONT}; text-overflow: ellipsis; white-space: nowrap; }
${X} .scStartMenuContent { margin: 0; border: 0; background: transparent; }
${X} .scStartMenuContentColumns { width: 100%; border: 0; border-collapse: collapse; table-layout: fixed; }
${X} .scStartMenuLeft, ${X} .scStartMenuRight { padding: 2px 0; vertical-align: top; background: transparent; }
${X} .scStartMenuLeft { width: 50%; }
${X} .scStartMenuRight { box-shadow: inset 1px 0 ${SAND_D}, inset 2px 0 ${SAND_L}; padding-left: 3px; }
${X} :is(.scStartMenuLeft, .scStartMenuRight) * { color: #000; font-family: ${FONT}; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 0;
  height: auto;
  margin: 0;
  padding: 1px 6px;
  border: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  text-decoration: none;
  white-space: nowrap;
}
${X} .scStartMenuLeft .scStartMenuLeftOption { height: 40px; }
${X} .scStartMenuRight :is(.scStartMenuLeftOption, .scStartMenuRightFolder) { height: 26px; }
${X} .scStartMenuLeftOptionIcon { flex: none; width: 32px; height: 32px; margin: 0 6px 0 0; float: none; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) { width: 16px; height: 16px; margin: 0 6px 0 0; }
${X} .scStartMenuLeftOptionDescription { min-width: 0; overflow: hidden; }
${X} :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { padding: 0; font: bold 12px/15px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { font-weight: normal; }
${X} .scStartMenuLeftOptionTooltip { color: #3a3128 !important; font: 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight .scStartMenuLeftOptionTooltip { display: none; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) { ${toolHot} }
${X} .scStartMenuRightFolderDisplayName { flex: 1; }
${X} .scStartMenuDivider { height: 0; margin: 3px 4px; border: 0; box-shadow: 0 0 0 0 transparent; border-top: 1px solid ${SAND_D}; border-bottom: 1px solid ${SAND_L}; background: none; }
${X} img.scStartMenuRightFolderGlyph { ${paint(art(TRI_RIGHT))} order: 2; width: 8px; height: 9px; margin: 0 0 0 6px; float: none; }
${X} .scStartMenuPrograms { padding: 0 0 2px; background: transparent; vertical-align: bottom; }
${X} .scStartMenuPrograms .scStartMenuDivider { margin: 0 4px 3px; }
${X} .scStartMenuProgramsMenu { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 6px; border: 2px solid transparent; color: #000; text-decoration: none; }
${X} .scStartMenuProgramsMenuText { flex: 1; color: #000; font: bold 12px/16px ${FONT}; }
${X} img.scStartMenuProgramsGlyph { order: 2; width: 8px; height: 9px; margin: 0; ${paint(art(TRI_RIGHT))} }
${X} .sct-sc-smbottom { display: flex; justify-content: flex-end; gap: 6px; padding: 6px 4px 4px; border-top: 1px solid ${SAND_D}; box-shadow: inset 0 1px ${SAND_L}; }
${X} .sct-sc-smbottom a { display: flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; ${push} font: 12px ${FONT}; text-decoration: none; }
${X} .sct-sc-smbottom a:hover { ${pushHot} }
${X} .sct-sc-smbottom a:active { ${pushDown} }
${X} .sct-sc-smbottom a img { width: 16px; height: 16px; }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: 24px ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])) {
  box-sizing: border-box;
  height: 24px;
  min-height: 0;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) { box-sizing: border-box; height: 24px; min-height: 0; padding: 0 24px 0 6px; font: 12px/20px ${FONT}; ${RAISED} border-radius: 0; background: linear-gradient(${SAND_L}, ${SAND_L}) right 6px top 50% / 10px 2px no-repeat, linear-gradient(${SAND_D}, ${SAND_D}) right 6px top calc(50% + 2px) / 10px 2px no-repeat, ${SAND}; box-shadow: none; color: #000; }
${X} textarea, ${X} select:is([multiple], [size]:not([size="0"], [size="1"])) { ${field} }
${X} :is(input, textarea):focus { ${fieldFocus} }
${X} select:focus { outline: 2px solid #000; outline-offset: 0; }
${X} :is(input, textarea):disabled, ${X} select:disabled { background-color: ${SAND}; color: #75685b; }

/* Quick Info: read-only text in 19px rows, as Sitecore draws it (no frames) */
${X} .scEditorQuickInfo tr { line-height: 19px; }
${X} .scEditorQuickInfo td { padding: 1px 4px; font-size: 12px; }
${X} .scEditorQuickInfo input { height: 19px; padding: 0; border: 0; background: transparent !important; outline: 0; font-size: 12px; }

/* ---- Combo tables (date and time pickers, item pickers): one sunken field, Motif's arrow button at its end ---- */
${X} table.scCombobox {
  box-sizing: border-box;
  height: 24px;
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
  outline: 0;
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
  border-radius: 0;
  box-shadow: none;
  ${paint(`${art(DOWN)}, ${WELL}`)}
}
${X} table.scCombobox img.scComboboxDropDown:active { filter: brightness(0.85); }

/* ---- Push buttons: 24px, wide enough for OK and Cancel ---- */
${X} :is(.scButton:not(.scEditorHeaderButton), input[type="button"], input[type="submit"]) {
  height: 24px;
  min-width: 75px;
  padding: 0 10px;
  border-radius: 0;
  line-height: 20px;
}
${X} button:not(.ui-button) { border-radius: 0; }
/* the default button: the token layer frames it in its fill colour */
${X} .scButton.scButtonPrimary { ${push} ${pushDefault} }
${X} .scButton.scButtonPrimary:hover:not(:disabled) { ${pushHot} }
${X} .scButton.scButtonPrimary:active:not(:disabled) { ${pushDown} }

/* ---- Drop-down arrows: a small black triangle for Sitecore's chevrons ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(TRI_DOWN))} }

/* ---- Tree search: a field and two toolbar buttons on one line ---- */
${X} #SearchPanel { padding: 4px; background: ${SAND}; border-bottom: 2px solid ${SAND_D}; }
${X} #SearchPanel > table { width: 100%; border-spacing: 0; }
${X} #SearchPanel > table > tbody > tr > td { height: auto; padding: 0; vertical-align: middle; }
${X} #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
${X} #SearchPanel > table > tbody > tr > td > div { float: none !important; padding: 0 0 0 2px !important; }
${X} #SearchPanel .scElementHover { width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #TreeSearch { width: 100%; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) {
  display: block;
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  padding: 2px;
  border: 2px solid transparent;
  border-radius: 0;
}
${X} :is(a.scSearchButton, a.scSearchOptionsButton):hover { ${toolHot} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { ${toolDown} }
${X} a.scSearchButton img { filter: contrast(1.5) brightness(0.6); }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(TRI_DOWN))} }
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #3a1416; font: 12px ${FONT}; text-decoration: underline; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(TRI_DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: toolbar buttons ---- */
${X} .scEditorTabControls a.scEditorHeaderButton {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  min-width: 0;
  padding: 0 4px 0 6px;
  border: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 12px/20px ${FONT};
}
${X} .scEditorTabControls a.scEditorHeaderButton:hover { ${toolHot} }
${X} .scEditorTabControls a.scEditorHeaderButton:active { ${toolDown} }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus: Motif's raised menu; the armed row raised, its text unchanged ---- */
${X} .scPopup:not(:has(> .scStartMenu)), ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 1px;
  background: ${SAND};
  ${RAISED}
  border-radius: 0;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.3);
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
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 2px 2px 2px 5px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 2px 16px 2px 4px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 2px 6px 2px 4px; text-align: right; }
/* the armed row: a raised bevel drawn from each cell's edges, the row's ends closing it */
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { background: #bfae9b; box-shadow: inset 0 2px ${SAND_L}, inset 0 -2px ${SAND_D}; color: #000; }
${X} .scMenu .scMenuItemIcon_Hover { box-shadow: inset 0 2px ${SAND_L}, inset 0 -2px ${SAND_D}, inset 2px 0 ${SAND_L}; }
${X} .scMenu :is(.scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { box-shadow: inset 0 2px ${SAND_L}, inset 0 -2px ${SAND_D}, inset -2px 0 ${SAND_D}; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover > td { background: #bfae9b; box-shadow: inset 0 2px ${SAND_L}, inset 0 -2px ${SAND_D}; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover * { color: #000; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover > td { background: transparent; box-shadow: none; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover * { color: #75685b; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 2px solid #000; outline-offset: -2px; }
${X} iframe.scGalleryFrame { border: 0; border-radius: 0; box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.3); }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: #75685b; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(TRI_RIGHT))} }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 8px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 3px, ${SAND_D} 3px 4px, ${SAND_L} 4px 5px, transparent 5px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 6px; color: #000; font: bold 12px ${FONT}; }

/* ---- Dialog tab panes: the open tab joins a raised page ---- */
${X} .scTabstrip { box-sizing: border-box; height: 24px; background: transparent; }
${X} .scTabstripContainer > .scTabs { top: 24px; left: 0; background: #bfae9b; ${RAISED} border-top: 0; box-shadow: none; }
${X} .scTabs .scTabPage .scScrollbox { background: ${WELL}; ${field} }
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): rows of a list, the maroon selection ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { ${SEL} border-color: transparent; box-shadow: none; }
${X} .scRibbonGalleryList > a:is(:hover, :active) * { color: #fff; }

/* The ribbon's fold button: Motif's arrow */
${X} a.scRibbonClose { background: ${art(UP)}; }
${X} a.scRibbonOpen { background: ${art(DOWN)}; }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search: one sunken field holding the filter tokens and the Clear and Search buttons ---- */
${X} .search-box { ${field} }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; border-right: 2px solid ${SAND_D}; border-radius: 0; }
${X} .search-box .sb_down { background: ${art(DOWN)}, ${SAND}; }
${X} .search-box .sb_up { background: ${art(UP)}, ${SAND}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; outline: 0; background: transparent; }
${X} .filters .filter { ${RAISED} border-radius: 0; background: #bfae9b; color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { ${push} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, ${SAND}; }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, ${SAND}; }
${X} .clear-search-box :is(.btn-clear, .btn-search):active { ${pushDown} }

${X} .scWorkboxWindowCaption { background: ${SAND}; }

/* SPEAK pages served in the shell (SPE Reports): the sand bar under the title, as on SPEAK pages */
${appHeader(X)}
/* jQuery UI's highlight box (the ISE's tip of the session): a Motif information box */
${X} .ui-state-highlight { ${RAISED} border-radius: 0; background: #bfae9b; color: #000; }
${X} .ui-state-highlight :is(p, b, span, a, div) { color: #000; }
${X} .ui-state-highlight a { color: #3a1416; }

/* ---- Desktop windows: each is an iframe, so dtwm's maroon frame is drawn outside it, bevelled ---- */
${X} #Desktop > iframe:not([style*="width: 100%"]) { box-shadow: ${FRAME_RING}; border-radius: 0; }
${X} #Desktop > iframe[data-sct-window="inactive"]:not([style*="width: 100%"]) { box-shadow: ${FRAME_RING_IN}; }
`;

// ==== SPEAK pages (speak and launchpad areas) ====
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px).
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-sc)`;
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

/* ---- Fields, toggles, push buttons ---- */
${SX} :is(input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), .form-control) {
  box-sizing: border-box;
  height: 24px;
  min-height: 0;
  padding: 0 4px;
  font: 12px/20px ${FONT};
  ${field}
}
${SX} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; box-sizing: border-box; height: 24px; min-height: 0; padding: 0 24px 0 6px; font: 12px/20px ${FONT}; ${RAISED} border-radius: 0; background: linear-gradient(${SAND_L}, ${SAND_L}) right 6px top 50% / 10px 2px no-repeat, linear-gradient(${SAND_D}, ${SAND_D}) right 6px top calc(50% + 2px) / 10px 2px no-repeat, ${SAND}; box-shadow: none; color: #000; }
${SX} textarea { ${field} }
${SX} :is(input, textarea, .form-control):focus { box-shadow: none; ${fieldFocus} }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 5px 0 1px;
  vertical-align: -2px;
  ${RAISED}
  border-radius: 0;
  outline: none;
  background: ${SAND};
}
${SX} input[type="radio"] { transform: rotate(45deg) scale(0.85); }
${SX} :is(input[type="checkbox"], input[type="radio"]):checked { ${SUNKEN} background: ${MAROON}; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK)}, ${MAROON}; }
${SX} .btn {
  height: 24px;
  min-width: 75px;
  padding: 0 10px;
  font: 12px/20px ${FONT};
  ${push}
}
${SX} .btn :is(span, .sc-button-text) { color: inherit; font: inherit; }
${SX} .btn:hover, ${SX} .btn:focus { ${push} ${pushHot} }
${SX} .btn:active, ${SX} .btn.active { ${pushDown} }
${SX} .btn:focus-visible { outline: 2px solid #000; outline-offset: 0; }
${SX} .btn:disabled, ${SX} .btn.disabled { ${pushOff} opacity: 1; }
${SX} .btn.btn-primary { ${pushDefault} }
${SX} .btn.btn-primary :is(span, .sc-button-text) { color: #000; }
`;
};

const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-sc)`;
const EE = `${SPX} .sc-pageeditbar`;
// A Motif frame: an etched box with its title set into the top edge.
const frame = (root, title, body) => `${root} { box-sizing: border-box; position: relative; margin: 12px 0 0; padding: 9px 0 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
${title} {
  position: absolute;
  top: 0;
  left: 10px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: 18px;
  margin: 0;
  padding: 0 6px;
  background: ${SAND};
  color: #000;
  font: bold 12px/18px ${FONT};
  text-transform: none;
  white-space: nowrap;
}
${body} { box-sizing: border-box; margin: 0; padding: 16px 12px 10px; border: 0; border-radius: 0; background: transparent; ${ETCHED} }`;
const speak = `/* Santa Clara: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-santaclara-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's: a Motif menu bar over the
   toolbar's etched groups ==== */
${EE} { color: #000; font: 12px ${FONT}; }
${EE} .sc-quickbar {
  display: flex;
  align-items: center;
  height: auto;
  padding: 3px 4px 2px;
  border: 0;
  background: ${SAND};
  box-shadow: none;
}
${EE} .sc-quickbar-item { float: none; margin: 0; text-transform: none; cursor: default; }
${EE} .sc-quickbar-button {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 24px;
  height: 24px;
  padding: 0;
  margin: 0 1px 0 0;
  border: 2px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  opacity: 1;
}
${EE} .sc-quickbar-button:not(.disabled):hover { ${toolHot} }
${EE} .sc-quickbar-button:not(.disabled):active { ${toolDown} }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} :is(.sc-quickbar-button, .sc-breadcrumb-item-button, .sc-chunk) [class*="sprite"] { filter: contrast(1.5) brightness(0.7); }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 16px; height: 16px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${art(UP)}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${art(DOWN)}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  position: relative;
  box-sizing: border-box;
  height: 24px;
  padding: 0 10px;
  margin: 0;
  border: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #000;
  font: 12px/20px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-tab::first-letter { text-decoration: underline; }
${EE} .sc-quickbar-tab:not(.sc-quickbar-tab-selected):hover { ${toolHot} }
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 2px solid #000; outline-offset: -2px; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected { border-color: ${SAND_L} ${SAND_D} ${SAND_D} ${SAND_L}; background: #bfae9b; }

${EE} .sc-ribbon { background: ${SAND}; border: 0; border-top: 2px solid ${SAND_D}; border-bottom: 2px solid ${SAND_D}; box-shadow: inset 0 2px ${SAND_L}; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 2px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 3px 3px 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
  ${ETCHED}
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
/* As tight as the Content Editor's: 46px buttons 3px below the chunk's top, 4px from its sides, clear of the caption */
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; box-sizing: border-box; height: 50px; min-height: 0; margin: 0; padding: 3px 4px 0; }
${EE} .sc-chunk-label { height: 18px; margin: 0; padding: 0 6px; color: #000; font: 11px/18px ${FONT}; text-align: center; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
  float: left;
  box-sizing: border-box;
  height: 46px;
  margin: 0;
  padding: 1px 4px 0;
  border: 2px solid transparent;
  border-radius: 0;
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
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: #75685b; }
${EE} .disabled > [class*="sprite"] { opacity: 0.45; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-small, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton).disabled { opacity: 1; }
${EE} .sc-chunk-button-small-list { float: left; margin: 0; padding: 0; }
${EE} :is(.sc-chunk-button-small, .sc-chunk-check-small) {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 22px;
  margin: 0;
  padding: 0 3px;
  border: 2px solid transparent;
  border-radius: 0;
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
  width: 9px;
  height: 6px;
  margin: 0 0 1px 3px;
  background: ${art(TRI_DOWN, [0, 0])};
}
/* The date box fills the button row (3px down), not 55px of SPEAK's padded panel over the caption */
${EE} .sc-chunk-panel:has(> .sc-chunk-datepanel) { height: auto; margin: 0; padding: 0; }
${EE} .sc-chunk-datepanel { display: flex; align-items: center; height: 46px; margin: 0; padding: 0 2px; border: 0; border-radius: 0; background: none; box-shadow: none; }
${EE} .sc-chunk-datepanel > * { max-height: 46px; }
${EE} .sc-chunk-datepanel-selector { display: flex; align-items: center; gap: 4px; box-sizing: border-box; height: 46px; padding: 0 6px; overflow: hidden; color: #000; ${field} }
${EE} .sc-chunk-datepanel-monthyear { height: auto; padding: 0; }
${EE} .sc-chunk-datepanel-selector * { color: #000; font-family: ${FONT}; }

/* The item path under the ribbon */
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 32px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: ${SAND};
  border: 0;
  border-bottom: 2px solid ${SAND_D};
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 4px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: 12px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { color: #3a1416; text-decoration: underline; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  min-width: 14px;
  padding: 0 2px;
  border: 2px solid transparent;
  border-radius: 0;
  background: none;
}
${EE} .sc-breadcrumb-item-button { width: 24px; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { ${toolHot} }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(TRI_RIGHT)}; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 24px; min-width: 60px; padding: 0 10px; line-height: 20px; }

/* ==== Control Panel: CDE's Style Manager, each category an etched Motif frame with its title in the edge ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: ${SAND}; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
/* every SPEAK application's header (Control Panel, SPE Reports, Forms): the sand bar under the title */
${appHeader(SPX)}
${SPX} .sc-applicationContent-main { background: none; }
${frame(`${SPX} .sc-controlpanel-box`, `${SPX} .sc-controlpanel-box-header h4`, `${SPX} .sc-controlpanel-box-content`)}
${SPX} .sc-controlpanel-box-header { margin: 0; padding: 0; color: #000; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0 6px 0 0; }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 2px 0; color: #3a1416; font: 12px/16px ${FONT}; text-decoration: underline; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { color: #000; background: #bfae9b; }
${SPX} .sc-controlpanel-no-items { color: #3a3128; }

/* ==== Forms: the selected navigation entry and tab sit on the maroon ==== */
${SPX} .header.menuItem :is(a, span) { color: #fff; }
${SPX} .sc-tab-control-tab-item.selected :is(a, span) { color: #fff; }
`;

// ==== Launchpad: CDE's Application Manager. The header is the window's maroon title bar; under it a sand
// window holds the groups as etched Motif frames (their names set into the top edge, a click folds them),
// each application a 48px icon over its name. The analytics message is a frame of its own at the left.
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-sc)`;
const SIDE = 240;
const launchpad = `/* Santa Clara: Launchpad. Generated by tools/build-santaclara-css.cjs.
   CDE's Application Manager: the groups as etched frames of icons in a sand window. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: ${SAND}; }
${LPX} .sc-applicationContent { padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; background: none; }
/* Sitecore gives the main section min-height: 100vh under the 48px header, so every page scrolled 48px; the
   grid below fills the window instead */
${LPX} .sc-applicationContent-main > .row { margin: 0; }
/* The page title sits in the title bar, after the logo */
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title { display: flex; align-items: center; top: 0; left: 44px; box-sizing: border-box; height: 47px; padding: 0 8px; background: ${MAROON}; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { ${capText} line-height: 24px; }
${LPX} .sc-applicationHeader-title::before { flex: none; filter: brightness(0) invert(1); }
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: ${SIDE}px minmax(0, 1fr);
  grid-template-rows: auto auto auto 1fr;
  align-items: start;
  column-gap: 0;
  box-sizing: border-box;
  width: auto;
  min-height: calc(100vh - 51px);
  margin: 0;
  padding: 0;
  float: none;
}
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 1; float: none; width: auto; margin: 0 6px 0 12px; }
${LPX} [data-sc-id="CustomAnalyticsLabel"] { grid-row: 1; }
${LPX} [data-sc-id="FallBackMessageBorder"] { grid-row: 2; }
${LPX} [data-sc-id="RowPanelTilesWrapper"] { grid-row: 3; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"] {
  position: relative;
  z-index: 1;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 18px;
  margin: 14px 0 -9px 22px;
  padding: 0 6px;
  background: ${SAND};
  color: #000;
  font: bold 12px/18px ${FONT};
  text-transform: none;
  white-space: nowrap;
  cursor: pointer;
}
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]::before { content: ""; flex: none; width: 11px; height: 10px; background: ${art(DOWN)}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"]::before { width: 10px; height: 11px; background: ${art(RIGHT)}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] + .sc-border > * { display: none; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] { box-sizing: border-box; margin: 0 6px 12px 12px; padding: 16px 12px 10px; border: 0; border-radius: 0; background: transparent; ${ETCHED} }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 0; color: #000; font: 12px/16px ${FONT}; text-align: left; }

/* the groups: etched frames of icons, the name set into the top edge */
${LPX} .sc-launchpad {
  grid-column: 2;
  grid-row: 1 / 5;
  display: block;
  box-sizing: border-box;
  max-width: none;
  margin: 0;
  padding: 4px 12px 12px 6px;
  float: none;
}
${LPX} .sc-launchpad-group {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  position: relative;
  margin: 18px 0 0;
  padding: 16px 10px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  ${ETCHED}
}
${LPX} .sc-launchpad-group-title {
  position: absolute;
  top: -9px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 18px;
  margin: 0;
  padding: 0 6px;
  border: 0;
  background: ${SAND};
  color: #000;
  font: bold 12px/18px ${FONT};
  text-transform: none;
  white-space: nowrap;
  cursor: pointer;
}
${LPX} .sc-launchpad-group-title::before { content: ""; flex: none; width: 11px; height: 10px; background: ${art(DOWN)}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-group-title::before { width: 10px; height: 11px; background: ${art(RIGHT)}; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-item { display: none; }
/* an icon: 48px over its name; armed raised, selected maroon */
${LPX} .sc-launchpad-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  box-sizing: border-box;
  width: 100px;
  height: 96px;
  margin: 0;
  padding: 4px 2px;
  border: 2px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
  text-decoration: none;
}
${LPX} .sc-launchpad-item .icon { flex: none; width: 48px; height: 48px; margin: 0; border-radius: 0; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 48px; height: 48px; margin: 0; }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: 100%; padding: 0 3px; overflow: hidden; color: #000; font: 12px/15px ${FONT}; white-space: normal; text-align: center; }
${LPX} .sc-launchpad-item:hover { ${toolHot} text-decoration: none; }
${LPX} .sc-launchpad-item:is(:focus, :active) { outline: none; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) { ${toolDown} }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .sc-launchpad-text { ${SEL} }
`;

// ==== Login: dtlogin. A raised sand panel on the backdrop: the logo and a welcome in the top band, the fields,
// and the buttons along the foot.
const LG = SURFACE("login");
const login = `/* Santa Clara: Identity Server login. Generated by tools/build-santaclara-css.cjs.
   CDE's login screen (dtlogin). */
${LG} body {
  min-height: 100vh;
  margin: 0;
  background: repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.05) 0 2px, transparent 2px 6px), #5f7f8c;
  color: #000;
  font: 12px ${FONT};
}
${LG} .top { position: absolute; top: 0; right: 0; z-index: 1; height: auto; padding: 14px 18px; border: 0; background: transparent; box-shadow: none; color: #fff; font: 12px ${FONT}; }
${LG} .top a { color: #fff; }
${LG} .main-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: transparent; }
${LG} .main {
  box-sizing: border-box;
  width: min(440px, 100% - 32px);
  margin: 0 auto;
  padding: 6px;
  ${RAISED}
  border-width: 3px;
  border-radius: 0;
  background: ${SAND};
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.35);
  color: #000;
}
${LG} .main::before { content: none; }
${LG} .logo-wrap { margin: 0 0 6px; padding: 16px 12px 12px; ${SUNKEN} background: ${WELL}; text-align: center; }
${LG} .logo-wrap img { max-width: 200px; height: auto; filter: brightness(0) opacity(0.85); }
${LG} .logo-wrap::after { content: "Welcome"; display: block; margin-top: 10px; color: #000; font: bold 16px ${FONT}; }
${LG} .login-page { margin: 0; padding: 10px 14px 6px; background: transparent; }
${LG} .login-page fieldset { margin: 0; padding: 0; border: 0; }
${LG} .login-page .form-group { margin: 0 0 8px; color: #000; }
${LG} label { color: #000; font: bold 12px ${FONT}; }
${LG} .form-control {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 26px;
  margin: 3px 0 6px;
  padding: 0 4px;
  font: 13px/22px ${FONT};
  ${field}
}
${LG} .form-control:focus { box-shadow: none; ${fieldFocus} }
${LG} .form-control::placeholder { color: #4a3f36; }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: block;
  width: auto;
  min-width: 90px;
  height: 26px;
  margin: 8px auto 0;
  padding: 0 14px;
  ${push}
  ${pushDefault}
  font: 12px/22px ${FONT};
}
${LG} .btn.btn-primary:is(:hover, :focus) { ${pushHot} color: #000; }
${LG} .btn.btn-primary:active { ${pushDown} }
${LG} .btn.btn-primary:focus-visible { outline: 2px solid #000; outline-offset: 2px; }
${LG} input[type="checkbox"] { appearance: none; box-sizing: border-box; width: 13px; height: 13px; margin: 0 5px 0 1px; vertical-align: -2px; ${RAISED} border-radius: 0; background: ${SAND}; }
${LG} input[type="checkbox"]:checked { ${SUNKEN} background: ${art(CHECK)}, ${MAROON}; }
${LG} .remember-me { display: inline-flex; align-items: center; padding: 0; color: #000; font: 12px ${FONT}; }
${LG} .remember-me input[type="checkbox"] { position: static; flex: none; }
${LG} a, ${LG} .forgot-password { color: #3a1416; font: 12px ${FONT}; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #5a0d10; font-weight: bold; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", ID);
for (const [name, text] of Object.entries({ shell: css, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
