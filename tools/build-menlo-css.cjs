// Dev tool: writes extension/themes/menlo/{shell,speak,launchpad,login}.css and the glyphs they use.
// Menlo recreates BeOS R5: grey #dedede panels with a #555 outline and a white inner highlight, each window's
// title a yellow tab only as wide as its title riding on the window's top left (close box at its left, zoom
// box at its right), the Deskbar in the desktop's top-right corner, rounded-top tab views, a 1px #0000e5
// focus frame on fields, disclosure triangles in trees and a light-blue selection, all in Verdana 11px.
//
// Spec, measured from BeOS R5 screenshots at 100% and the approved concept board:
//   desktop #336698; panel #dedede; window outline #555; bevel shadow #989898, highlight #fff
//   tab: gradient #ffe066 to #ffcb00, 1px #555 outline, no bottom edge, 22px tall, bold 11px black title;
//        inactive #f2eed9 to #dcd5b8; close and zoom boxes 12px and 13px, outlined #8a6d00
//   controls: 1px #737373 outline, 3px corners, white top-left and #c4c4c4 bottom-right inside
//   fields: white, #989898 top-left and white bottom-right edge, a #737373 inner line; focus 1px #0000e5
//   selection #9db4d8; menu highlight #c0c0c0; tab views: 4px rounded tops, #c8c8c8 closed, #dedede open
//   scroll bars 14px: #c8c8c8 track, a raised #e8e8e8 knob, raised arrow buttons with black triangles
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const ID = "menlo";
const SURFACE = (s) => `html[data-sct-theme="${ID}"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-mn) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-mn)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
// A dialog page inside Sitecore's jQuery dialog (set by dom.js).
const PD = `${P}[data-sct-menlo-dialog]`;
const FONT = 'Verdana, "DejaVu Sans", Geneva, sans-serif';

const G = "#dedede", GL = "#e8e8e8", GT = "#c8c8c8", SH = "#989898", DK = "#555555", BD = "#737373";
const Y1 = "#ffe066", Y2 = "#ffcb00", YH = "#fff3b0", YS = "#c79f00";
const IY1 = "#f2eed9", IY2 = "#dcd5b8", IYH = "#fbf9ef", IYS = "#c4bd9e";
const BLUE = "#336698", SEL = "#9db4d8", FOC = "#0000e5", MHI = "#c0c0c0";
const COLORS = { K: "#000", W: "#fff", D: DK, O: "#8a6d00", L: "#fff6c8", M: Y1, Y: "#e8b800", T: "#3c3c3c", G: SH, C: G, A: Y2 };

// ---- Glyphs: each written twice into themes/menlo/glyphs (named by its pixels): the pixel art as a PNG for
// 100% screens (kept exact by pixelate()), and a vector redraw as an SVG for every other scale. The CSS names
// them sct-ext:<path>, which background.js points at the extension, so a CSP that blocks data: still loads them.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.KWDOLMYTGCA]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
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
  return rects.join("");
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
// At exactly 100% the PNGs are drawn nearest-neighbour; a zero-specificity reset keeps that off children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-menlo-)/.test(m[2]))
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
const paint = (g) => `object-fit: none; object-position: -999px -999px; background: ${g};`;

// A BeOS window box on a canvas: the #8a6d00 outline, filled light yellow at the top left to deep yellow.
function canvas(w, h) { return Array.from({ length: h }, () => [...".".repeat(w)]); }
function boxOn(c, x0, y0, s) {
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const edge = x === 0 || y === 0 || x === s - 1 || y === s - 1;
    const d = (x + y) / (2 * (s - 1));
    c[y0 + y][x0 + x] = edge ? "O" : d < 0.4 ? "L" : d < 0.7 ? "M" : "Y";
  }
}
const rowsOf = (c) => c.map((r) => r.join(""));
const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORS.L}"/><stop offset=".55" stop-color="${COLORS.M}"/><stop offset="1" stop-color="${COLORS.Y}"/></linearGradient></defs>`;
const vbox = (x, y, s) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="${s - 1}" height="${s - 1}" fill="url(#g)" stroke="${COLORS.O}"/>`;

const CLOSE = (() => { const c = canvas(12, 12); boxOn(c, 0, 0, 12); return rowsOf(c); })();
vector(CLOSE, grad + vbox(0, 0, 12));
// zoom: a small box in front of a larger one, the larger to the bottom right
const ZOOM = (() => { const c = canvas(13, 13); boxOn(c, 4, 4, 9); boxOn(c, 0, 0, 8); return rowsOf(c); })();
vector(ZOOM, grad + vbox(4, 4, 9) + vbox(0, 0, 8));
// Sitecore's minimize (BeOS has none: it minimizes on a double click): a box with a bar along its foot
const MINIMIZE = (() => { const c = canvas(12, 12); boxOn(c, 0, 0, 12); for (let x = 3; x < 9; x++) { c[8][x] = "T"; c[9][x] = "T"; } return rowsOf(c); })();
vector(MINIMIZE, grad + vbox(0, 0, 12) + `<rect x="3" y="8" width="6" height="2" fill="${COLORS.T}"/>`);
// the Content Editor's application switcher: a box with a small down triangle
const SWITCH = (() => { const c = canvas(12, 12); boxOn(c, 0, 0, 12); ["TTTTT", ".TTT.", "..T.."].forEach((r, y) => [...r].forEach((p, x) => { if (p === "T") c[5 + y][3 + x] = "T"; })); return rowsOf(c); })();
vector(SWITCH, grad + vbox(0, 0, 12) + `<path d="M3 5H8L5.5 7.5Z" fill="${COLORS.T}"/>`);

// Disclosure triangles: Tracker's outline-list latches, dark grey, pointing right (closed) or down (open).
const TRI_R = ["T....", "TT...", "TTT..", "TTTT.", "TTTTT", "TTTT.", "TTT..", "TT...", "T...."];
const TRI_D = ["TTTTTTTTT", ".TTTTTTT.", "..TTTTT..", "...TTT...", "....T...."];
vector(TRI_R, `<path d="M0 0L5 4.5L0 9Z" fill="${COLORS.T}"/>`);
vector(TRI_D, `<path d="M0 0H9L4.5 5Z" fill="${COLORS.T}"/>`);
// Scroll and menu arrows: black, 7x4
const UP = ["...K...", "..KKK..", ".KKKKK.", "KKKKKKK"];
const DOWN = [...UP].reverse();
const LEFT = ["...K", "..KK", ".KKK", "KKKK", ".KKK", "..KK", "...K"];
const RIGHT = LEFT.map((r) => [...r].reverse().join(""));
vector(UP, `<path d="M3.5 0L7 4H0Z" fill="#000"/>`);
vector(DOWN, `<path d="M0 0H7L3.5 4Z" fill="#000"/>`);
vector(LEFT, `<path d="M4 0V7L0 3.5Z" fill="#000"/>`);
vector(RIGHT, `<path d="M0 0V7L4 3.5Z" fill="#000"/>`);
// BeOS R5 marks a check box with an X
const CHECK = ["KK....KK", "KKK..KKK", ".KKKKKK.", "..KKKK..", "..KKKK..", ".KKKKKK.", "KKK..KKK", "KK....KK"];
vector(CHECK, `<path d="M1 1L7 7M7 1L1 7" stroke="#000" stroke-width="1.7" stroke-linecap="square"/>`);
// radio buttons: a dark ring, white inside, a black dot when on
const RADIO = (on) => {
  const n = 12, c = canvas(n, n), r = 5.5, m = 5.5;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - m, y - m);
    if (d <= r + 0.2) c[y][x] = d > r - 1 ? "D" : on && d < 2.6 ? "K" : "W";
  }
  return rowsOf(c);
};
for (const on of [false, true]) vector(RADIO(on), `<circle cx="5.5" cy="5.5" r="5" fill="#fff" stroke="${DK}"/>` + (on ? `<circle cx="5.5" cy="5.5" r="2.5" fill="#000"/>` : ""));
// The Deskbar's menu glyph: a small window with its yellow tab (neutral, not the Be logo)
const LEAF = ["DDDDDDDD......", "DMMMMMMD......", "DAAAAAAD......", "DDDDDDDDDDDDDD", ...Array(7).fill("DWCCCCCCCCCCCD"), "DDDDDDDDDDDDDD"];

const ICONS = { close: art(CLOSE), zoom: art(ZOOM), minimize: art(MINIMIZE), switch: art(SWITCH) };
const GI = Object.fromEntries(Object.keys(ICONS).map((k) => [k, `var(--sct-menlo-${k})`]));

// ---- Recipes ----
const ytab = `background: linear-gradient(${Y1}, ${Y2}); border: 1px solid ${DK}; border-bottom: 0; border-radius: 0;
  box-shadow: inset 1px 1px ${YH}, inset -1px 0 ${YS}; color: #000;`;
const ytabIn = `background: linear-gradient(${IY1}, ${IY2}); box-shadow: inset 1px 1px ${IYH}, inset -1px 0 ${IYS};`;
const body = `background: ${G}; border: 1px solid ${DK}; box-shadow: inset 1px 1px #fff;`;
const raised = `border: 1px solid ${BD}; border-radius: 3px; background: linear-gradient(#f7f7f7, #dadada); box-shadow: inset 1px 1px #fff, inset -1px -1px #c4c4c4;`;
const pressed = `background: linear-gradient(#c2c2c2, #d6d6d6); box-shadow: inset 1px 1px ${SH};`;
const field = `border: 1px solid; border-color: ${SH} #fff #fff ${SH}; box-shadow: inset 1px 1px ${BD};`;
const focusField = `border-color: ${FOC}; box-shadow: inset 0 0 0 1px ${FOC};`;
const sunken = `border: 1px solid; border-color: ${SH} #fff #fff ${SH};`;
const tab = (on) => on
  ? `background: ${G}; border: 1px solid ${DK}; border-bottom: 0; border-radius: 4px 4px 0 0; box-shadow: inset 1px 1px #fff;`
  : `background: ${GT}; border: 1px solid ${DK}; border-bottom: 0; border-radius: 4px 4px 0 0; box-shadow: inset 1px 1px #e4e4e4;`;
const scrollbars = (S) => `${S} ::-webkit-scrollbar { width: 14px; height: 14px; background: ${GT}; }
${S} ::-webkit-scrollbar-track { border-radius: 0; background: ${GT}; }
${S} ::-webkit-scrollbar-track:vertical { box-shadow: inset 1px 0 ${SH}; }
${S} ::-webkit-scrollbar-track:horizontal { box-shadow: inset 0 1px ${SH}; }
${S} ::-webkit-scrollbar-thumb, ${S} :is(select, textarea, #Conditions, #Description)::-webkit-scrollbar-thumb {
  border: 0;
  border-radius: 0;
  background: ${GL};
  box-shadow: inset 0 0 0 1px ${BD}, inset 2px 2px #fff, inset -2px -2px ${SH};
}
${S} ::-webkit-scrollbar-corner { background: ${G}; }
${S} ::-webkit-scrollbar-button:single-button { display: block; box-shadow: inset 0 0 0 1px ${BD}, inset 2px 2px #fff, inset -2px -2px ${SH}; }
${S} ::-webkit-scrollbar-button:vertical:single-button { width: 14px; height: 14px; }
${S} ::-webkit-scrollbar-button:horizontal:single-button { width: 14px; height: 14px; }
${S} ::-webkit-scrollbar-button:vertical:decrement { background: ${art(UP, [4, 5])}, ${GL}; }
${S} ::-webkit-scrollbar-button:vertical:increment { background: ${art(DOWN, [4, 5])}, ${GL}; }
${S} ::-webkit-scrollbar-button:horizontal:decrement { background: ${art(LEFT, [5, 4])}, ${GL}; }
${S} ::-webkit-scrollbar-button:horizontal:increment { background: ${art(RIGHT, [5, 4])}, ${GL}; }
${S} :is(#Conditions, #Description)::-webkit-scrollbar { width: 14px; height: 14px; background: ${GT}; }
${S} :is(#Conditions, #Description)::-webkit-scrollbar-track { border-radius: 0; background: ${GT}; }`;

const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
const LC = ':is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)';
const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");

// The global header (Desktop, Content Editor, SPEAK pages): a BeOS menu bar, grey with a white top edge.
const header = (S) => `/* ---- Global header: a BeOS menu bar ---- */
${S} :is(.sc-globalHeader, .sc-flx-global-header) {
  background: ${G} !important;
  border-bottom: 1px solid ${SH};
  box-shadow: inset 0 1px #fff, inset 0 -1px ${GL};
  color: #000;
}
${S} .sc-globalHeader .sc-accountInformation li,
${S} .sc-globalHeader .sc-accountInformation span,
${S} .sc-globalHeader .sc-accountInformation a,
${S} .sc-globalHeader a { color: #000; font-family: ${FONT}; font-size: 11px; }
`;

const css = `/* Menlo: classic shell. Generated by tools/build-menlo-css.cjs; edit the generator, not this file.
   BeOS R5: grey panels with a #555 outline and white highlight, a yellow tab as each window's title, the
   Deskbar in the desktop's top-right corner, rounded-top tab views, disclosure triangles, Verdana 11px. */

${P} {
${Object.entries(ICONS).map(([k, v]) => `  --sct-menlo-${k}: ${v};`).join("\n")}
}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} { scrollbar-color: auto; }

/* ---- Scroll bars (Chrome and Edge; Firefox only takes colours) ---- */
${scrollbars(P)}

${header(P)}
/* ---- Ribbon: a BeOS tab view over a grey toolbar ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: ${G}; }
${P} .scRibbonNavigator { border-bottom: 0; }
${TABS("Normal")},
${TABS("Active")} {
  ${tab(false)}
  position: relative;
  color: #000;
  font: 11px/20px ${FONT};
  text-transform: none;
  padding: 0 12px;
  margin-right: 1px;
}
/* The open tab runs into the toolbar, over its top line. */
${TABS("Active")} {
  ${tab(true)}
  font-weight: bold;
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 1px;
}
${P} .scRibbonToolbar { background: ${G}; border-top: 1px solid ${DK}; box-shadow: inset 0 1px #fff; border-bottom: 1px solid ${SH}; }
/* The Content Editor clears the floated chunks with .contentEditor .scRibbonToolbar:after; the ISE has no
   .contentEditor, so on 10.4 its toolbar stopped at the strip's 80px min-height and the bottom line ran
   through the chunks. Contain them everywhere. */
${P} .scRibbonToolbar { display: flow-root; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: ${G};
  border: 1px solid ${SH};
  border-radius: 0;
  box-shadow: inset 1px 1px #fff, 1px 1px #fff;
  margin: 3px 2px 3px 1px;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #333; font: 11px ${FONT}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 1px solid transparent; border-radius: 3px; }
/* Only the buttons react, not their icons or labels; disabled buttons (spans) not at all. A large combo
   button is flat until hovered, then shows its command and its drop-down as two faces pressed on their own. */
${P} .scRibbonToolbar ${RB}:hover { ${raised} }
${P} .scRibbonToolbar ${RB}:active { ${pressed} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton:hover > ${LC} { ${raised} }
${P} .scRibbonToolbar .scRibbonToolbarLargeComboButton > ${LC}:active { ${pressed} }

/* ---- Content tree: Tracker's outline list, disclosure triangles, a light-blue selection ---- */
${P} .scContentTree { background: #fff; }
${P} .scContentTree a.scContentTreeNodeActive { background: ${SEL}; outline: 0; color: #000; border-radius: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: #000 !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; }
${P} img[src*="/treemenu_collapsed"] { ${paint(art(TRI_R, [6, 4]))} overflow: hidden; }
${P} img[src*="/treemenu_expanded"] { ${paint(art(TRI_D, [4, 6]))} overflow: hidden; }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: bold 13px ${FONT}; color: #000; }
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${tab(false)}
  height: 22px;
  margin: 35px 1px 0 0;
}
${P} a.scRibbonEditorTabActive { ${tab(true)} position: relative; z-index: 1; height: 23px; }
${P} #EditorTabs { height: 57px; border-bottom: 1px solid ${DK}; }
${P} a#BTAddNewSearch { width: 34px; }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: 11px ${FONT};
  border: 0;
  height: 22px;
  line-height: 22px;
  padding: 0 12px;
}
${P} .scEditorTabHeaderActive { font-weight: bold; }
/* Sections: a BeOS box, its label on a slightly lighter strip with a disclosure triangle */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  background: ${GL};
  color: #000;
  font: bold 11px ${FONT};
  line-height: 20px;
  padding: 0 0 0 4px;
  margin: 0 0 2px;
  border: 1px solid ${SH};
  box-shadow: inset 1px 1px #fff;
}
${P} img.scEditorSectionCaptionGlyph { width: 16px; height: 16px; margin: 2px 4px 0 0; float: left; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(art(TRI_D))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(art(TRI_R))} }
${P} .scEditorFieldLabel { color: #000; font: 11px ${FONT}; }
${P} .scEditorFieldMarkerBarCellGrey { border-left-color: ${SH}; }

/* ---- Fields: white, a sunken edge ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select {
  background-color: #fff;
  color: #000;
  border-radius: 0;
  ${field}
}
${P} :is(.scContentControl, input, textarea, select):focus { outline: none; ${focusField} }
${P} select:not([multiple], [size]) {
  appearance: none;
  padding-right: 20px;
  background: ${art(DOWN, 6)}, #fff;
}
${P} input[type="checkbox"], ${P} input[type="radio"] {
  appearance: none;
  width: 12px;
  height: 12px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 0;
  border-radius: 0;
}
${P} input[type="checkbox"] { background: #fff; box-shadow: inset 0 0 0 1px ${DK}, inset 2px 2px ${GT}; }
${P} input[type="checkbox"]:checked { background: ${art(CHECK)}, #fff; }
${P} input[type="radio"] { background: ${art(RADIO(false), [0, 0])}; }
${P} input[type="radio"]:checked { background: ${art(RADIO(true), [0, 0])}; }
${P} :is(input[type="checkbox"], input[type="radio"]):disabled { opacity: 0.5; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px solid ${FOC}; outline-offset: 1px; }

/* ---- Buttons: BeOS push buttons; the default button has a second, dark ring ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] {
  color: #000;
  font: 11px ${FONT};
  ${raised}
}
${P} .scButton:active, ${P} button:not(.ui-button):active, ${P} input:is([type="button"], [type="submit"]):active { ${pressed} }
${X} .scButton.scButtonPrimary { border-color: ${BD}; box-shadow: inset 1px 1px #fff, inset -1px -1px #c4c4c4, 0 0 0 1px ${G}, 0 0 0 2px ${DK}; }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px solid ${FOC}; outline-offset: -4px; }

/* ---- Bottom application tabs: tab-view tabs hanging from the bottom edge ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 2px 2px; background: ${G}; border-top: 1px solid ${DK}; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  color: #000;
  font: 11px ${FONT};
  background: ${GT};
  border: 1px solid ${DK};
  border-top: 0;
  border-radius: 0 0 4px 4px;
  box-shadow: inset 1px 0 #e4e4e4;
  margin: 0 1px 0 0;
}
${P} .scPagerButtonActive { background: ${G}; font-weight: bold; box-shadow: inset 1px 0 #fff, 0 -1px ${G}; position: relative; z-index: 1; }

/* ==== Dialogs: a BeOS window. The jQuery dialog draws nothing above its 22px tab band but the window
   buttons; the dialog page's title is the yellow tab, laid over that band. The page lets the band show
   through (dom.js marks it data-sct-menlo-dialog) and gives the dialog its tab's width, so the zoom box
   sits at the tab's right end; without dom.js the band stays grey and the zoom box at the far right. ==== */
${P} .ui-dialog {
  overflow: visible;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: linear-gradient(transparent 22px, ${G} 22px);
  box-shadow: none;
}
/* the window body's outline and highlight, from the tab band down, over the page's edge */
${P} .ui-dialog::before {
  content: "";
  position: absolute;
  inset: 22px 0 0;
  z-index: 3;
  border: 1px solid ${DK};
  box-shadow: inset 1px 1px #fff, 2px 2px 0 rgba(0, 0, 0, 0.18);
  pointer-events: none;
}
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
${P} .ui-dialog .ui-dialog-titlebar-buttonpane { position: static !important; margin: 0 !important; height: 0; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  position: absolute !important;
  top: 5px !important;
  float: none !important;
  width: 14px;
  height: 14px;
  margin: 0 !important;
  padding: 0;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  box-shadow: none;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button { left: 5px !important; right: auto !important; top: 5px !important; background: ${GI.close}; }
${P} .ui-dialog .ui-dialog-titlebar-maximize, ${P} .ui-dialog .ui-dialog-titlebar-restore { left: calc(var(--sct-menlo-tab, 100% + 6px) - 20px) !important; top: 4px !important; background: ${GI.zoom}; }
${P} .ui-dialog .ui-dialog-titlebar-minimize { left: calc(var(--sct-menlo-tab, 100% + 6px) - 38px) !important; background: ${GI.minimize}; }
${P} .ui-dialog .ui-dialog-titlebar-collapse { left: calc(var(--sct-menlo-tab, 100% + 6px) - 56px) !important; background: ${art(DOWN)}; }
${P} .ui-dialog > iframe { position: relative; z-index: 1; display: block; background: transparent; }
/* BeOS never dimmed what was behind a window; a faint shade still marks the dialog as modal. */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.15); opacity: 1; }

/* Inside a dialog page: the header's title is the yellow tab, room left for the close box and right for the
   zoom box; the description and everything below are the grey window body. */
${PD}, ${PD} body, ${PD} form, ${PD} .scFlexColumnContainer { background: transparent !important; }
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: transparent; padding: 0; border: 0; min-height: 0 !important; }
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100% - 8px);
  height: 22px;
  margin: 0;
  padding: 0 28px 0 24px;
  ${ytab}
  font: bold 11px/21px ${FONT};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { background: ${G}; color: #000; padding: 8px 10px; margin: 0; font: 11px ${FONT}; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background: ${G}; }
${P} .scFormDialogFooter { border-top: 1px solid ${SH}; box-shadow: inset 0 1px #fff; border-radius: 0; }
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 40px; padding: 7px 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: right; }
${X} .scFormDialogFooter img#Copyright { margin: 1px 0 0; }

/* ---- Tab views (dialogs, the ISE's script tabs): rounded tops, the open tab joined to its page ---- */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 1px solid ${DK}; }
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${tab(false)}
  height: auto;
  padding: 0 12px;
  margin-right: 1px;
  text-transform: none;
  color: #000;
  font: 11px/20px ${FONT};
}
${P} .scTabstrip [class*="scTabActive"] { ${tab(true)} font-weight: bold; position: relative; z-index: 1; padding-bottom: 1px; margin-bottom: -1px; }
${P} .scTabstrip .closeTab { margin: 0 -4px 0 6px; }

/* ==== Window buttons ==== */
/* Desktop windows of the standard frame (ISE, Console, Workbox...): the caption is the yellow tab, only as
   wide as the title, the close box at its left, minimize and zoom at its right. Right of the tab the window
   is see-through, so the desktop or the window behind shows, as in BeOS. */
${P}:has(.standardWindowCaption), ${P}:has(.standardWindowCaption) :is(body, form, #Body) { background: transparent !important; }
${P} :is(.scWindowOuterFrame, .scWindowFrame, .scWindowHandle):has(.standardWindowCaption) { background: transparent; border: 0; border-radius: 0; box-shadow: none; }
${P} .standardWindowCaption {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100% - 4px);
  height: 22px;
  padding: 0 6px 0 5px;
  ${ytab}
}
${PI} .standardWindowCaption { ${ytabIn} }
${P} .standardWindowCaption .windowCaptionIcon { display: none; }
${P} .standardWindowCaption .scWindowCaption {
  order: 1;
  min-width: 0;
  padding: 0 4px;
  overflow: hidden;
  background: none;
  color: #000;
  font: bold 11px/21px ${FONT};
  text-overflow: ellipsis;
  white-space: nowrap;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* the ISE writes its script's path into the caption as italics in an inline #bbb */
${P} .standardWindowCaption .scWindowCaption i { color: #5a4600 !important; font-weight: normal; }
${P} .standartWindowButtons { display: contents; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 22px; ${body} }
${P} .standartWindowButtons img, ${P} .scSystemButtons img {
  flex: none;
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  filter: none;
  opacity: 1;
  vertical-align: middle;
}
${P} :is(.standartWindowButtons, .scSystemButtons) img[src*="_close"] { order: -1; ${paint(GI.close)} }
${P} :is(.standartWindowButtons, .scSystemButtons) img[src*="page_switcher"] { order: 1; ${paint(GI.switch)} }
${P} :is(.standartWindowButtons, .scSystemButtons) img[src*="minimize"] { order: 2; ${paint(GI.minimize)} }
${P} :is(.standartWindowButtons, .scSystemButtons) img:is([src*="maximize"], [src*="restore"]) { order: 3; ${paint(GI.zoom)} }
/* The Content Editor has no caption: its window buttons stand in the ribbon's tab row. They become a yellow
   tab at the window's top right (a BeOS tab can slide along the top edge), close box first. */
${P} .scSystemButtons {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  top: 0;
  right: 8px;
  height: 22px;
  padding: 0 6px;
  ${ytab}
}
${P} .scSystemButtons:not(:has(img:not([style*="none"]))) { display: none; }
${PI} .scSystemButtons { ${ytabIn} }
/* The Content Editor and Media Library as desktop windows: the tab moves to the window's top left and carries
   the window's title (engine.js --sct-window-title) between the close box and the zoom box, as on the standard
   windows; the caption's empty top line is the strip it rides on, see-through right of it, and the window's
   outline starts under it. The ribbon's menu button and tabs sit straight under the outline. */
${P}[data-sct-window-title]:has(.scWindowBorder2 > .scCaption > #CaptionTopLine) :is(body, form) { background: transparent !important; border: 0; }
${P}[data-sct-window-title] .scWindowBorder2:has(> .scCaption > #CaptionTopLine) { background: linear-gradient(transparent 22px, ${G} 22px) !important; }
${P}[data-sct-window-title] .scWindowBorder2:has(> .scCaption > #CaptionTopLine)::after { content: ""; position: absolute; inset: 22px 0 0; border: 1px solid ${DK}; pointer-events: none; z-index: 5; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption:has(> #CaptionTopLine) { background: transparent; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine { height: 23px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons { display: flex; top: 0; left: 0; right: auto; max-width: calc(100% - 4px); margin-right: 0; padding: 0 6px 0 5px; z-index: 2; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons::before { content: var(--sct-window-title, ""); order: 1; min-width: 0; padding: 0 4px; overflow: hidden; color: #000; font: bold 11px/21px ${FONT}; text-overflow: ellipsis; white-space: nowrap; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons img[src*="_close"] { margin-right: 0; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 23px; margin-top: 0; height: 21px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 2px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 2px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 2px; }
/* The Workbox's empty caption strip, in a desktop window (dom.js marks those): see-through, its window
   buttons a yellow tab at the top left carrying the window's name, close box first. */
${P}[data-sct-window]:has(.scWorkboxWindowCaption), ${P}[data-sct-window]:has(.scWorkboxWindowCaption) :is(body, form) { background: transparent !important; }
${X}[data-sct-window] .scWorkboxWindowCaption { position: relative; height: 22px; min-height: 0; padding: 0; border: 0; background: transparent; box-shadow: none; }
${X}[data-sct-window] .scWorkboxWindowCaption + * { border-top: 1px solid ${DK}; }
${X}[data-sct-window] .scWorkboxWindowButtons {
  position: absolute;
  top: 0;
  left: 0;
  right: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  height: 22px;
  margin: 0;
  padding: 0 6px 0 5px;
  ${ytab}
}
${X}[data-sct-window] .scWorkboxWindowButtons::before { content: var(--sct-window-title, "Workbox"); order: 0; padding: 0 4px; font: bold 11px/21px ${FONT}; }
${PI}:not(#sct-mn) .scWorkboxWindowButtons { ${ytabIn} }
${P} .scWorkboxWindowButtons img { flex: none; box-sizing: border-box; width: 14px; height: 14px; margin: 0; padding: 0; border: 0; filter: none; }
${P} .scWorkboxWindowButtons img[src*="_close"] { order: -1; ${paint(GI.close)} }
${P} .scWorkboxWindowButtons img[src*="minimize"] { order: 2; ${paint(GI.minimize)} }
${P} .scWorkboxWindowButtons img:is([src*="maximize"], [src*="restore"]) { order: 3; ${paint(GI.zoom)} }
${P} .scSystemButtons img[src*="_close"] { margin-right: 10px; }

/* ---- Insert gallery scroller ---- */
${P} .scRibbonPanelButtons { background: ${G}; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { width: 14px; height: 14px; filter: none; box-shadow: inset 0 0 0 1px ${BD}, inset 2px 2px #fff, inset -2px -2px ${SH}; }
${P} img.scRibbonPanelUp { ${paint(`${art(UP)}, ${GL}`)} }
${P} img.scRibbonPanelDown { ${paint(`${art(DOWN)}, ${GL}`)} }
${P} img.scRibbonPanelOpen { ${paint(`${art(["KK.KK.KK", "KK.KK.KK"])}, ${GL}`)} }

/* ==== Desktop: #336698 under the Deskbar, BeOS's taskbar in the top-right corner: a vertical panel with the
   menu button on top, a sunken tray under it, then one row per running application. Sitecore's own controls,
   restyled; nothing is moved in the DOM. ==== */
/* The desktop runs to the screen's bottom edge. Its right 184px are a transparent border: windows are sized to
   the padding box, so a zoomed window stops left of the Deskbar (as BeOS zooms around it) while the desktop
   colour, painted from the border box, carries on behind it; a window dragged right slides under it. */
${X} .DesktopArea {
  bottom: 0;
  border-right: 184px solid transparent;
  overflow: clip;
  overflow-clip-margin: border-box;
  background: ${BLUE} !important;
  background-origin: border-box !important;
  background-clip: border-box !important;
}
${X} .scStartbar {
  position: absolute;
  top: 58px;
  right: 6px;
  bottom: auto;
  left: auto;
  z-index: 900;
  width: 172px;
  height: auto;
  border: 0;
  background: none;
}
${X} #Startbar {
  box-sizing: border-box;
  height: auto !important;
  ${body}
  box-shadow: inset 1px 1px #fff, inset -1px -1px ${SH}, 2px 2px 0 rgba(0, 0, 0, 0.2);
}
${X} #Startbar > table { display: flex; flex-direction: column; width: 100%; height: auto; border: 0; border-spacing: 0; background: none; }
${X} #Startbar > table > tbody, ${X} #Startbar > table > tbody > tr { display: contents; }
${X} #Startbar > table > tbody > tr > td { display: block; width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #Startbar > table > tbody > tr > td:nth-child(2) { order: 2; }
${X} #Startbar > table > tbody > tr > td:nth-child(3) { order: 1; }
/* the menu button: a small window with its yellow tab and "Menlo" */
${X} .scStartButtonContainer { position: relative; width: auto; height: 28px; }
${X} .scStartButton, ${X} .scStartButton:hover, ${X} .scStartButton.scPopupOpener {
  position: absolute;
  inset: 1px 1px 0;
  width: auto;
  height: auto;
  border: 0;
  border-bottom: 1px solid ${SH};
  border-radius: 0;
  background: linear-gradient(#f2f2f2, #d4d4d4);
  box-shadow: inset 1px 1px #fff;
}
${X} .scStartButton.scPopupOpener, ${X} .scStartButton:active { background: ${MHI}; box-shadow: inset 1px 1px ${SH}; }
${X} .scStartButton::before {
  content: "Menlo";
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  color: #000;
  font: bold 12px/1 ${FONT};
}
${X} .scStartButton::after {
  content: "";
  position: absolute;
  top: 6px;
  left: calc(50% - 40px);
  width: 16px;
  height: 14px;
  background: ${art(LEAF, [0, 0])};
}
${X} .scStartButton:focus-visible { outline: 1px solid ${FOC}; outline-offset: -3px; }
/* the tray: sunken, the search field over the database switcher */
${X} .scStartbarTray { display: block; width: auto; height: auto; margin: 3px; padding: 3px; border: 0; border-spacing: 0; background: #d4d4d4; ${sunken} }
${X} .scStartbarTray > tbody { display: block; }
${X} .scStartbarTray > tbody > tr { display: flex; flex-direction: column; align-items: stretch; gap: 3px; }
${X} .scStartbarTray > tbody > tr > td { display: block; width: auto; height: auto; padding: 0; border: 0; line-height: normal !important; text-align: right; }
${X} .scStartbarTray :is(td, span) { color: #000; }
${X} #SearchBox { box-sizing: border-box; width: 100%; height: 20px; min-height: 0; margin: 0; padding: 0 4px; border-radius: 0; background: #fff; color: #000; font: 11px ${FONT}; ${field} }
${X} #SearchBox:focus { ${focusField} }
${X} #DatabaseSelector { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 4px; border: 0; border-radius: 0; background: none; color: #000; font: 11px/18px ${FONT}; }
${X} #DatabaseSelector:hover { background: ${MHI}; }
${X} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 !important; filter: brightness(0.35); }
/* the running applications, one row each */
${X} .scStartBarScroller { height: auto; max-height: calc(100vh - 160px); padding: 0; border: 0; overflow: auto; }
${X} #StartbarApplications, ${X} #StartbarApplications > tbody { display: block; width: 100%; height: auto; margin: 0; border-spacing: 0; }
${X} #StartbarApplications > tbody > tr { display: flex; flex-direction: column; }
${X} #StartbarApplications > tbody > tr > td {
  display: block;
  height: auto;
  padding: 0;
  border: 0;
  border-top: 1px solid ${SH};
  border-radius: 0;
  box-shadow: inset 0 1px #fff;
  background: none;
}
${X} #StartbarApplications > tbody > tr > td::before, ${X} #StartbarApplications > tbody > tr > td::after { content: none; display: none; }
${X} .scStartBarApplication { display: block; box-sizing: border-box; height: auto; min-width: 0; max-width: none; margin: 0; padding: 4px 6px; border: 0; border-radius: 0; background: none; box-shadow: none; }
${X} .scStartBarApplication span { display: block; overflow: hidden; color: #000; font: 11px/16px ${FONT}; text-overflow: ellipsis; white-space: nowrap; }
${X} .scStartBarApplication img { margin: 0 6px 0 0 !important; vertical-align: -3px; }
${X} .scStartBarApplication:hover { background: ${GL}; }
${X} .scActiveApplication .scStartBarApplication { background: ${GT}; box-shadow: inset 1px 1px ${SH}; }
${X} .scActiveApplication .scStartBarApplication span { font-weight: bold; }

/* The Deskbar menu drops down from the menu button, its right edge on the Deskbar's: a BeOS menu, grey,
   a #555 outline and white highlight, grey selection. */
${X} .scPopup:has(> #StartMenu) {
  top: 87px !important;
  right: 6px !important;
  bottom: auto !important;
  left: auto !important;
  padding: 0;
  border: 1px solid ${DK};
  border-radius: 0;
  background: ${G};
  box-shadow: inset 1px 1px #fff, 2px 2px 0 rgba(0, 0, 0, 0.25);
}
${X} #StartMenu { border: 0; border-radius: 0; box-shadow: none; background: transparent; font-family: ${FONT}; }
${X} :is(#StartMenu, .scStartMenuContent, .scStartMenuContentColumns, .scStartMenuContentColumns td, .scStartMenuLeft, .scStartMenuRight, .scStartMenuPrograms, .scStartMenuTop, .scStartMenuBottom) { background: transparent; }
${X} :is(.scStartMenuLeft, .scStartMenuRight) * { color: #000; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu) { border-radius: 0; background: transparent; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):hover { background: ${MHI}; }
/* BeOS menu rows: a 16px icon and the name on one line; the description stays in the row's tooltip */
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu) { display: flex; align-items: center; gap: 6px; box-sizing: border-box; height: auto; min-height: 0; margin: 0; padding: 3px 24px 3px 8px; position: relative; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder) > img:first-child { flex: none; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} .scStartMenuLeftOptionDescription, ${X} .scStartMenuLeftOptionDisplayName, ${X} :is(.scStartMenuRightFolder, .scStartMenuProgramsMenu) > div { margin: 0; padding: 0; color: #000; font: 11px/16px ${FONT}; white-space: nowrap; }
${X} .scStartMenuLeftOptionTooltip { display: none; }
${X} :is(.scStartMenuLeft, .scStartMenuRight) { padding: 3px 0; vertical-align: top; }
${X} .scStartMenuLeft { box-shadow: inset -1px 0 ${SH}, -1px 0 #fff inset; }
${X} .scStartMenuDivider { height: 2px; margin: 3px 6px; background: none; border: 0; border-top: 1px solid ${SH}; border-bottom: 1px solid #fff; }
${X} .scStartMenuPrograms * { color: #000; }
${X} img.scStartMenuRightFolderGlyph, ${X} img.scStartMenuProgramsGlyph { position: absolute; right: 6px; top: calc(50% - 8px); width: 16px; height: 16px; margin: 0; ${paint(art(RIGHT))} filter: none; }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: BeOS's 20px text control and menu field; Sitecore's 34px minimum and corners go ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${X} select:not([multiple], [size]) {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  padding: 0 4px;
  border-radius: 0;
  background-color: #fff;
  font: 11px/19px ${FONT};
  ${field}
}
${X} select:not([multiple], [size]) { padding-right: 20px; }
${X} textarea, ${X} select:is([multiple], [size]) { border-radius: 0; ${field} }
${X} :is(input, select, textarea):focus { outline: none; ${focusField} }

/* ---- Combo tables (date and time pickers, item pickers): one field, the button behind one divider ---- */
${X} table.scCombobox {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 0;
  overflow: hidden;
  background: #fff;
  ${field}
}
${X} table.scCombobox :is(tbody, tr, td) { height: auto; }
${X} table.scCombobox td { padding: 0; border: 0; vertical-align: middle; }
${X} table.scCombobox input.scComboboxEdit {
  box-sizing: border-box;
  width: 100%;
  height: 18px !important;
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
  width: 16px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  border-left: 1px solid ${SH};
  border-radius: 0;
  box-shadow: none;
  ${paint(`${art(DOWN)}, ${GL}`)}
}

/* ---- Push buttons: 24px, wide enough for OK and Cancel ---- */
${X} :is(.scButton:not(.scEditorHeaderButton), input[type="button"], input[type="submit"]) {
  box-sizing: border-box;
  height: 24px;
  min-width: 75px;
  padding: 0 12px;
  line-height: 22px;
}
${X} button:not(.ui-button) { border-radius: 3px; }

/* ---- Drop-down arrows ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(DOWN))} }

/* ---- Tree search: a field and two small buttons on one line ---- */
${X} div#SearchPanel { padding: 4px; background: ${G}; border-bottom: 1px solid ${SH}; box-shadow: 0 1px #fff; }
${X} #SearchPanel > table { width: 100%; border-spacing: 0; }
${X} #SearchPanel > table > tbody > tr > td { height: auto; padding: 0; vertical-align: middle; }
${X} #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
${X} #SearchPanel > table > tbody > tr > td > div { float: none !important; padding: 0 0 0 2px !important; }
${X} #SearchPanel .scElementHover { width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #TreeSearch { width: 100%; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) { display: block; box-sizing: border-box; width: 21px; height: 21px; padding: 1px; ${raised} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { ${pressed} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(DOWN))} }
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #000; font: 11px ${FONT}; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: BeOS menu fields ---- */
${X} .scEditorTabControls a.scEditorHeaderButton {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 21px;
  min-width: 0;
  padding: 0 4px 0 6px;
  color: #000;
  font: 11px/19px ${FONT};
  ${raised}
}
${X} .scEditorTabControls a.scEditorHeaderButton:active { ${pressed} }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus (context menus, fly-outs, drop-downs): BeOS menus, grey with a #555 outline, a white highlight,
   a darker grey selection, etched separators ---- */
${X} .scPopup, ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 1px 0 0 1px;
  background: ${G};
  border: 1px solid ${DK};
  border-radius: 0;
  box-shadow: inset 1px 1px #fff, 2px 2px 0 rgba(0, 0, 0, 0.2);
}
${X} .scPopup > .scMenu { background: transparent; border: 0; box-shadow: none; }
${X} .scMenu td { height: auto; padding: 3px 4px; background: transparent; color: #000; font: 11px ${FONT}; line-height: 16px; }
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 2px 2px 2px 6px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 2px 10px 2px 4px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 2px 6px 2px 4px; text-align: right; }
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { background: ${MHI}; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover { background: ${MHI}; }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover { background: transparent; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 1px solid ${FOC}; outline-offset: -1px; }
${X} iframe.scGalleryFrame { border: 1px solid ${DK}; border-radius: 0; box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.2); }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: #7a7a7a; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(RIGHT))} }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 4px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 1px, ${SH} 1px 2px, #fff 2px 3px, transparent 3px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 6px; color: #000; font: bold 11px ${FONT}; }

/* ---- Dialog tab panes: the strip as tall as a tab; the page grey with the tab view's outline ---- */
${X} .scTabstrip { box-sizing: border-box; height: 22px; background: transparent; }
${X} .scTabstripContainer > .scTabs { top: 22px; left: -1px; background: ${G}; border: 1px solid ${DK}; border-top: 0; box-shadow: inset 1px 0 #fff; }
${X} .scTabs .scTabPage .scScrollbox { background: #fff; ${field} }
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): list rows selected in light blue ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { background: ${SEL}; border-color: transparent; box-shadow: none; }

/* the chunk launchers: Sitecore's pale grey glyph, darkened for the grey panel */
${X} .scRibbonChunkEndLink img.glyph { filter: brightness(0.45); }

/* The ribbon's fold button */
${X} a.scRibbonClose { background: ${art(UP)}; }
${X} a.scRibbonOpen { background: ${art(DOWN)}; }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search: one white field holding the filter tokens and the Clear and Search buttons ---- */
${X} .search-box { border-radius: 0; background: #fff; ${field} }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; box-shadow: inset -1px 0 ${SH}; }
${X} .search-box .sb_down { background: ${art(DOWN)}, ${GL}; }
${X} .search-box .sb_up { background: ${art(UP)}, ${GL}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; background: transparent; }
${X} .filters .filter { border: 1px solid ${SH}; border-radius: 0; background: ${SEL}; color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { ${raised} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, ${GL}; }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, ${GL}; }
${X} .clear-search-box :is(.btn-clear, .btn-search):active { ${pressed} }

${X} .scWorkboxWindowCaption { background: ${G}; }

/* jQuery UI's highlight box (the ISE's tip of the session): a BeOS tool tip, pale yellow with black text.
   jQuery's own olive text stays on the token layer's selection blue otherwise (1.9:1). */
${X} .ui-state-highlight { background: #fff6c8; border: 1px solid ${DK}; border-radius: 0; }
${X} .ui-state-highlight, ${X} .ui-state-highlight * { color: #000; }
`;

// ==== SPEAK pages (speak and launchpad areas) ====
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px), which every header
// item is centred on.
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-mn)`;
  return `${SX} :is(body, input, button, select, textarea, h1, h2, h3, h4, h5, h6, p, a, span, div, li, label, td, th, nav, header, section):not([class*="glyphicon"], .fa, [class*="fa-"]) {
  font-family: ${FONT};
}
${scrollbars(S)}
${header(SX)}
${SX} .sc-globalHeader .sc-accountInformation { height: ${band}px; line-height: ${band}px; vertical-align: top; box-shadow: none; }
${SX} .sc-globalHeader .sc-accountInformation li { height: ${band}px; line-height: ${band}px; vertical-align: top; }
${SX} .sc-globalHeader .sc-accountInformation img { vertical-align: top; margin-top: ${(band - 32) / 2}px; margin-bottom: 0; }
${SX} .sc-globalHeader .sc-ext-dbName { line-height: ${band}px; }
${SX} .sc-globalHeader .sc-accountInformation li, ${SX} .sc-globalHeader .sc-accountInformation li::before, ${SX} .sc-globalHeader .sc-accountInformation li::after { color: #000; }
${SX} .sc-globalHeader .sc-accountInformation a { text-decoration: none; }
${SX} .sc-globalHeader .sc-accountInformation a:hover { text-decoration: underline; }

/* ---- Fields, check boxes, push buttons ---- */
${SX} :is(input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), select:not([multiple], [size]), .form-control) {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  padding: 0 4px;
  border-radius: 0;
  background-color: #fff;
  color: #000;
  font: 11px/19px ${FONT};
  ${field}
}
${SX} textarea { border-radius: 0; ${field} }
${SX} :is(input, select, textarea, .form-control):focus { outline: none; ${focusField} }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  width: 12px;
  height: 12px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 0;
  border-radius: 0;
  outline: none;
}
${SX} input[type="checkbox"] { background: #fff; box-shadow: inset 0 0 0 1px ${DK}, inset 2px 2px ${GT}; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK)}, #fff; }
${SX} input[type="radio"] { background: ${art(RADIO(false), [0, 0])}; box-shadow: none; }
${SX} input[type="radio"]:checked { background: ${art(RADIO(true), [0, 0])}; }
${SX} .btn {
  box-sizing: border-box;
  height: 24px;
  min-width: 75px;
  padding: 0 12px;
  color: #000;
  font: 11px/22px ${FONT};
  text-transform: none;
  text-shadow: none;
  ${raised}
}
${SX} .btn :is(span, .sc-button-text) { color: inherit; font: inherit; }
${SX} .btn:hover, ${SX} .btn:focus { color: #000; ${raised} }
${SX} .btn:active, ${SX} .btn.active { ${pressed} }
${SX} .btn:focus-visible { outline: 1px solid ${FOC}; outline-offset: -4px; }
${SX} .btn:disabled, ${SX} .btn.disabled { color: #7a7a7a; opacity: 1; }
${SX} .btn.btn-primary { box-shadow: inset 1px 1px #fff, inset -1px -1px #c4c4c4, 0 0 0 1px ${G}, 0 0 0 2px ${DK}; }
${SX} .btn.btn-primary :is(span, .sc-button-text) { color: #000; }
`;
};

// A BeOS window around a SPEAK panel: the grey body with its outline, and the title as a yellow tab riding on
// its top left. active: the selector list that gets the bright tab; the rest are pale.
const windowed = (root, title, { white = false } = {}) => `${root} {
  position: relative;
  box-sizing: border-box;
  margin-top: 22px;
  border-radius: 0;
  ${body}
  ${white ? "background: #fff;" : ""}
}
${title} {
  position: absolute;
  top: -22px;
  left: -1px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100% + 2px);
  height: 22px;
  margin: 0;
  padding: 0 10px 0 8px;
  ${ytab}
  ${ytabIn}
  font: bold 11px/21px ${FONT};
  text-transform: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}`;
const brightTab = (sels) => `${sels.join(",\n")} { background: linear-gradient(${Y1}, ${Y2}); box-shadow: inset 1px 1px ${YH}, inset -1px 0 ${YS}; }`;

const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: ${G}; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: ${G}; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 8px 12px 4px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 14px/20px ${FONT}; }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 12px 6px; background: ${G}; border: 0; border-bottom: 1px solid ${SH}; box-shadow: 0 1px #fff; }
${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 24px; min-width: 0; padding: 0 10px 0 8px; ${raised} }
${SX} .btn.sc-backbutton:active { ${pressed} }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: 11px/22px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton:hover .sc-backbutton-text { text-decoration: none; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before { position: static; flex: none; width: 4px; height: 7px; background: ${art(LEFT, [0, 0])}; mask: none; transform: none; }`;

// SPEAK-style application headers in shell pages (SPE Reports): the grey toolbar, not the red banner
const shellCss = `${css}
/* ---- SPEAK-style application header (SPE Reports) ---- */
${appHeader(X)}
`;
const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-mn)`;
const EE = `${SPX} .sc-pageeditbar`;
const speak = `/* Menlo: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-menlo-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's ==== */
${EE} { color: #000; font: 11px ${FONT}; }
${EE} .sc-quickbar { display: flex; align-items: flex-end; height: auto; padding: 5px 4px 0; border: 0; background: ${G}; box-shadow: none; }
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
${EE} .sc-quickbar-button:not(.disabled):hover { ${raised} }
${EE} .sc-quickbar-button:not(.disabled):active { ${pressed} }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 16px; height: 16px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${art(UP)}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${art(DOWN)}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  ${tab(false)}
  position: relative;
  height: auto;
  padding: 0 12px;
  margin-right: 1px;
  color: #000;
  font: 11px/20px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 1px solid ${FOC}; outline-offset: -3px; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected { ${tab(true)} font-weight: bold; z-index: 1; margin-bottom: -1px; padding-bottom: 1px; }

${EE} .sc-ribbon { background: ${G}; border: 0; border-top: 1px solid ${DK}; box-shadow: inset 0 1px #fff; border-bottom: 1px solid ${SH}; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 1px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 2px 3px 1px;
  padding: 0;
  background: ${G};
  border: 1px solid ${SH};
  border-radius: 0;
  box-shadow: inset 1px 1px #fff, 1px 1px #fff;
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; height: 50px; min-height: 0; margin: 0; padding: 0 5px; }
${EE} .sc-chunk-label { height: 18px; margin: 0; padding: 0 6px; color: #333; font: 11px/18px ${FONT}; text-align: center; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) {
  float: left;
  box-sizing: border-box;
  height: 50px;
  margin: 0;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
}
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton) > [class*="sprite"] { display: block; margin: 0 auto; }
${EE} .sc-chunk-button-label { margin: 0; padding: 4px 0 0; color: #000; font: 11px/12px ${FONT}; text-transform: none; }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover { ${raised} }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed { ${raised} ${pressed} }
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: #7a7a7a; }
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
  height: 4px;
  margin: 0 0 1px 4px;
  background: ${art(DOWN, [0, 0])};
}
${EE} .sc-chunk-datepanel { display: flex; align-items: center; height: 50px; margin: 0; padding: 0 2px; border: 0; border-radius: 0; background: none; box-shadow: none; }
${EE} .sc-chunk-datepanel-selector { padding: 2px 6px; border-radius: 0; background: #fff; color: #000; ${field} }
${EE} .sc-chunk-datepanel-selector * { color: #000; font-family: ${FONT}; }
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 30px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: ${G};
  border: 0;
  border-top: 1px solid #fff;
  border-bottom: 1px solid ${SH};
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 4px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: 11px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { text-decoration: underline; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 21px;
  min-width: 14px;
  padding: 0 2px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: none;
}
${EE} .sc-breadcrumb-item-button { width: 21px; }
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { ${raised} }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(RIGHT)}; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 21px; min-width: 60px; padding: 0 10px; line-height: 19px; }

/* ==== Control Panel: the desktop colour, one BeOS window per group, a white list of tasks inside ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: ${BLUE}; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
${appHeader(`${SPX} body:has(.sc-controlpanel-box)`)}
${SPX} .sc-applicationContent-main { background: none; }
${SPX} .sc-controlpanel-box { margin-top: 34px; padding: 3px; }
${windowed(`${SPX} .sc-controlpanel-box`, `${SPX} .sc-controlpanel-box-header h4`)}
${brightTab([`${SPX} .sc-controlpanel-box:is(:hover, :focus-within) .sc-controlpanel-box-header h4`])}
${SPX} .sc-controlpanel-box-header { position: static; margin: 0; padding: 0; color: #000; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0; }
${SPX} .sc-controlpanel-box-content { box-sizing: border-box; margin: 0; padding: 2px 0; border-radius: 0; background: #fff; ${field} }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 3px 8px; color: #000; font: 11px/16px ${FONT}; text-decoration: none; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { background: ${SEL}; color: #000; text-decoration: none; }
${SPX} .sc-controlpanel-no-items { color: #555; }
`;

// Launchpad: the desktop colour with a Tracker window of icons per group.
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-mn)`;
const SELECTED = `${LPX} [data-sc-id="ColumnPanel1"]:not(:has(:is(.sc-launchpad-group, [data-sc-id="FallBackMessageBorder"]):is(:hover, :focus-within))) .sc-launchpad-group.first`;
const launchpad = `/* Menlo: Launchpad. Generated by tools/build-menlo-css.cjs.
   The BeOS desktop: one Tracker window per group, its applications as icons with their names under them.
   The window under the pointer (or holding the focus; the first otherwise) has the bright tab. No tab
   carries close or zoom boxes: they would not work here. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: ${BLUE}; }
${LPX} .sc-applicationContent { min-height: 100vh; padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; background: none; }
${LPX} .sc-applicationContent-main > .row { margin: 0; }
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 12px/24px ${FONT}; }
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: minmax(0, max-content) auto;
  justify-content: start;
  align-items: start;
  gap: 14px;
  box-sizing: border-box;
  width: auto;
  min-height: calc(100vh - 48px);
  margin: 0;
  padding: 10px 14px 14px;
  float: none;
}
${LPX} .sc-launchpad {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 34px 14px;
  max-width: none;
  margin: 22px 0 0;
  padding: 0;
  float: none;
}
${LPX} .sc-launchpad-group {
  --sct-cols: 1;
  display: grid;
  grid-template-columns: repeat(var(--sct-cols), 96px);
  align-content: start;
  gap: 2px 4px;
  flex: none;
  min-width: 200px;
  padding: 8px;
  margin: 0;
}
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(2)) { --sct-cols: 2; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(3)) { --sct-cols: 3; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(4)) { --sct-cols: 4; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(5)) { --sct-cols: 3; }
${LPX} .sc-launchpad-group:has(> a.sc-launchpad-item:nth-of-type(7)) { --sct-cols: 4; }
${windowed(`${LPX} .sc-launchpad-group`, `${LPX} .sc-launchpad-group-title`, { white: true })}
${LPX} .sc-launchpad-group { margin-top: 0; }
${brightTab([`${LPX} .sc-launchpad-group:is(:hover, :focus-within) > .sc-launchpad-group-title`, `${SELECTED} > .sc-launchpad-group-title`])}

/* the analytics message: a window of its own, the label as its tab */
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 2; grid-row: 1; float: none; margin: 0; }
${LPX} [data-sc-id="CustomAnalyticsLabel"] { position: relative; z-index: 1; align-self: start; width: max-content; height: 22px; margin: 0; padding: 0 10px 0 8px; ${ytab} ${ytabIn} font: bold 11px/21px ${FONT}; }
${LPX} [data-sc-id="CustomAnalyticsLabel"]:has(+ .sc-border:hover) { background: linear-gradient(${Y1}, ${Y2}); }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] { box-sizing: border-box; width: 280px; margin-top: 22px; padding: 6px; border-radius: 0; ${body} }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 4px 6px 6px; color: #000; font: 11px/16px ${FONT}; text-align: left; }

/* Tracker icons: a 32px icon over its name; the name highlighted while hovered or focused */
${LPX} .sc-launchpad-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  width: 96px;
  height: auto;
  min-height: 66px;
  margin: 0;
  padding: 6px 2px 4px;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: center;
  text-decoration: none;
}
${LPX} .sc-launchpad-item:hover, ${LPX} .sc-launchpad-item:active { background: none; box-shadow: none; }
${LPX} .sc-launchpad-item:focus { outline: none; }
${LPX} .sc-launchpad-item .icon { flex: none; width: 32px; height: 32px; margin: 0; border-radius: 0; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 32px; height: 32px; margin: 0; }
${LPX} .sc-launchpad-item:active .icon img { filter: brightness(0.7); }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: 92px; padding: 0 3px; overflow: visible; color: #000; font: 11px/14px ${FONT}; white-space: normal; }
${LPX} .sc-launchpad-item:is(:hover, :focus-visible) .sc-launchpad-text { background: ${SEL}; }
${LPX} .sc-launchpad-item:focus-visible .sc-launchpad-text { outline: 1px solid ${FOC}; }
`;

const LG = SURFACE("login");
const login = `/* Menlo: Identity Server login. Generated by tools/build-menlo-css.cjs.
   A BeOS window on the desktop colour: the "Log in" tab, then the fields and the default button. */
${LG} body, ${LG} .main-wrap { background: ${BLUE} none; color: #000; font: 11px ${FONT}; }
${LG} .main { position: relative; margin-top: 60px; padding: 20px 0; border-radius: 0; ${body} }
${LG} .main::before {
  content: "Log in";
  position: absolute;
  top: -22px;
  left: -1px;
  box-sizing: border-box;
  height: 22px;
  padding: 0 12px;
  ${ytab}
  font: bold 11px/21px ${FONT};
}
/* the signed-in strip in the top right: a small BeOS panel */
${LG} .top { background: ${G}; border: 1px solid ${DK}; border-top: 0; border-right: 0; box-shadow: inset 1px 0 #fff; }
${LG} .top, ${LG} .top * { color: #000; font-family: ${FONT}; font-size: 11px; }
${LG} .logo-wrap, ${LG} .login-page { margin: 0 48px; }
${LG} .logo-wrap { margin-bottom: 16px; }
/* the logo is white art: drawn dark on the grey window */
${LG} .logo-wrap img { filter: brightness(0); opacity: 0.75; }
${LG} label { color: #000; font: 11px ${FONT}; }
${LG} .form-control { box-sizing: border-box; height: 21px; padding: 0 4px; border-radius: 0; background: #fff; color: #000; font: 11px/19px ${FONT}; ${field} }
${LG} .form-control:focus { outline: none; ${focusField} }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: block;
  width: auto;
  min-width: 88px;
  height: 24px;
  margin-left: auto;
  padding: 0 14px;
  color: #000;
  font: 11px/22px ${FONT};
  text-transform: none;
  ${raised}
  box-shadow: inset 1px 1px #fff, inset -1px -1px #c4c4c4, 0 0 0 1px ${G}, 0 0 0 2px ${DK};
}
${LG} .btn.btn-primary:is(:hover, :focus) { color: #000; background: linear-gradient(#f7f7f7, #dadada); }
${LG} .btn.btn-primary:active { background: linear-gradient(#c2c2c2, #d6d6d6); }
${LG} .btn.btn-primary:focus-visible { outline: 1px solid ${FOC}; outline-offset: -4px; }
${LG} input[type="checkbox"] { appearance: none; width: 12px; height: 12px; margin-top: 1px; border: 0; background: #fff; box-shadow: inset 0 0 0 1px ${DK}, inset 2px 2px ${GT}; }
${LG} input[type="checkbox"]:checked { background: ${art(CHECK)}, #fff; }
${LG} .remember-me { color: #000; font: 11px ${FONT}; }
${LG} a, ${LG} .forgot-password { color: ${FOC}; font: 11px ${FONT}; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #a00000; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", ID);
for (const [name, text] of Object.entries({ shell: shellCss, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
