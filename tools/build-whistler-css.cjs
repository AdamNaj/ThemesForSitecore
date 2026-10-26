// Dev tool: writes extension/themes/whistler/{shell,speak,launchpad,login}.css and the glyphs they use.
// Whistler recreates Windows XP's Luna, by default in the deeper blue of the Luna Element WindowBlinds skin, or in XP's
// own Blue, Olive Green or Silver (SCHEMES below). Its caption buttons, scroll arrows, check marks and chevrons are
// glyphs (PNG plus vector SVG pairs, see art()), so the theme is generated here rather than written by hand.
//
// Measured Luna Blue (XP SP2 at 96 dpi):
//   window face #ece9d8; tab page #fcfcfe; 3D shadow #aca899; tab border #919b9c; Tahoma 8pt (11px)
//   caption 30px with the frame, gradient #0997ff > #0053ee > #0050ee > #0066ff > #003dd7, bold Trebuchet MS
//     13px white with a #0f1089 shadow; top corners 8px; frame 3-4px blue (#0831d9 outer)
//   caption buttons 21x21, 1px white border, 3px radius; close red-orange; glyphs white
//   inactive caption #7a96df > #9db9eb, text #d8e4f8: 3.1:1, fails AA. Whistler darkens the text band to
//     #5470c0 under white text (4.7:1).
//   tabs: white to #ecebe6, border #919b9c, 3px top corners; the open tab #fcfcfe, an orange top line
//     (#e68b2c, then 2px #ffc83c), also shown while hovered
//   push buttons 23px, 1px #003c74 border, 3px radius, white to #d6d0c5; hover an orange inner glow
//     (#ffe8a6 top, #f8b330 bottom), the default button a blue one
//   fields 21px, 1px #7f9db9; combo button light blue with a #4d6185 chevron
//   tree +/- boxes 9x9, 1px #7b9ebd border, white to #e0e0e0 face; selection #316ac5, white text
//   taskbar 30px #245edb gradient; start button green, italic bold; tray light blue (darkened from XP's
//     #18b9f4 to #0b72cc behind the white text: XP's fails AA at 2.9:1)
//   start menu: blue header with the portrait, white left list, #d3e5fa right list, blue footer with Log Off
//   task pane: #7ba2e7 > #6375d6; pane header white > #c6d3f7, bold #215dc6 text; pane body #d6dff7
//
// The schemes recolour the window captions and their buttons, the frames, the taskbar and tray, the start button and
// menu, the selection, scroll bars, combo buttons and task panes (the picker's colour scheme control sets
// data-sct-scheme; Luna has none). Blue's values above are the base the others start from. Measured the same way:
//   Olive Green: caption #a7b580 > #c2cd95 under a #e9f2c7 highlight, inactive #d3d6ba > #e0e1c3; frame #abbd85,
//     #758d5e outside; caption buttons olive (#c7c7b4 > #768753), close red-orange as Blue's; taskbar #a8b680 >
//     #c2cd95 under light buttons with #41400a text; tray cream #eae2b2; start menu light olive over the orange rule,
//     right column #f3f1e4; selection #93a070; scroll bars sage #c6dcc1 with #456b3c arrows; task panes #ccd9ad >
//     #a7be86, headers cream > #e1e7b9 with #56662d text, bodies #f6f6ec. XP's white caption text fails AA on the light olive (2.2:1): Whistler
//     writes it in the taskbar's #41400a (5.1:1), the inactive one #4f5a2e (5:1); the selection darkens to #6b7a45
//     under white text (4.7:1), the pressed task button to #67734f (5.1:1).
//   Silver: caption #a4a3be > white, black text with a white shadow; frame light, #66667e outside; caption buttons
//     white > #9c9ebe framed in #6b758f with dark glyphs, close pink-red framed in #a63944; taskbar #a8a9bf >
//     #ecebec, buttons #404040 text; tray #cbccda; selection #b2b4bf under black text; scroll bars grey #dedede
//     with #696969 arrows; task panes #c3c7d3 > #b1b3c8, headers white > #d6d7e0, bodies #f0f1f5. XP's inactive caption text
//     (#a2a2a2, 2:1) darkens to #545462 (5.2:1), the pressed task button to #5d6874 under white (5.7:1).
//   Luna: the palette of the Luna Element WindowBlinds skin, measured from its bitmaps: a deeper caption
//     (#1d55b7 > #2c6fd1, a #63aae7 highlight), inactive #6f97dc > #77a7eb with navy text (#0a2257; white is 2.5:1),
//     frame #1d4bb0 with #0d308c outside; caption buttons framed in #254394 (close #801313); taskbar navy #1e429c,
//     its buttons darkened from #4085f5 to #2b67dd under white (4.9:1); tray #4570c4 > #3d5db7; start menu header
//     #114183 > #1e5fba, program list navy #0e2e66 with white text, places #bcd9f6; start button lit from below.
//   The start button stays green and the Welcome screen blue in all four, as in XP.
const fs = require("fs");
const zlib = require("zlib");
const crypto = require("crypto");
const path = require("path");

const ID = "whistler";
const SURFACE = (s) => `html[data-sct-theme="${ID}"][data-sct-surface="${s}"]`;
const P = SURFACE("shell");
// :not(#sct-xp) matches every page; its id weight lets a rule win over Sitecore's id- and class-heavy selectors.
const X = `${P}:not(#sct-xp)`;
// A desktop window's document while another window has the focus (set by dom.js).
const PI = `${P}[data-sct-window="inactive"]`;
const FONT = 'Tahoma, Verdana, "Segoe UI", sans-serif';
const CAPFONT = '"Trebuchet MS", Tahoma, sans-serif';
// Colours of the pixel art: W white, K black, B the scroll and combo arrow blue-grey, G the check mark green,
// N the task pane's chevron blue, D Silver's caption button glyphs; O and S Olive's and Silver's B, P and Q their N.
const COLORS = { W: "#fff", K: "#000", B: "#4d6185", G: "#21a121", N: "#215dc6", D: "#252536", O: "#456b3c", S: "#696969", P: "#56662d", Q: "#33334a" };

// ---- Pixel art (as in tools/build-metal-css.cjs): one character per pixel, '.' transparent. Each glyph is
// written to themes/whistler/glyphs twice, as a PNG (1x) and as a vector SVG (every other scale), and named
// sct-ext:, which background.js points at the extension (some installs' CSP blocks data:). Placed centred, at
// [x, y] from the box's top left, or, given a number, that many pixels in from the right, centred vertically.
const GLYPHS = path.join(__dirname, "..", "extension", "themes", ID, "glyphs");
fs.rmSync(GLYPHS, { recursive: true, force: true });
fs.mkdirSync(GLYPHS, { recursive: true });
const VECTORS = new Map();
const vector = (rows, body) => VECTORS.set(rows.join("|"), body);
// a glyph's pixels in another colour (from and to are COLORS keys), its vector, if it has one, with them
function recolour(rows, from, to) {
  const out = rows.map((r) => r.replaceAll(from, to));
  const v = VECTORS.get(rows.join("|"));
  if (v && from !== to) vector(out, v.replaceAll(COLORS[from], COLORS[to]));
  return out;
}
function art(rows, at) {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w || /[^.WKBGNDOSPQ]/.test(r))) throw new Error(`bad pixel art: ${rows.join("|")}`);
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
// At exactly 100% the PNGs are drawn nearest-neighbour; the property inherits, so a zero-specificity reset
// keeps it off children.
function pixelate(text) {
  const sels = [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => /(^|[;\s])background(-image)?\s*:[^;]*(sct-ext:|var\(--sct-xp-)/.test(m[2]))
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
const MIN = ["WWWWWW", "WWWWWW", "WWWWWW"];
const MAX = ["WWWWWWWWW", "WWWWWWWWW", "WWWWWWWWW", "W.......W", "W.......W", "W.......W", "W.......W", "W.......W", "WWWWWWWWW"];
const RESTORE = [
  "...WWWWWW", "...WWWWWW", "...W....W", "WWWWWW..W", "WWWWWW..W",
  "W....WWWW", "W....W...", "W....W...", "WWWWWW...",
];
const CLOSE = [
  "WW.....WW", "WWW...WWW", ".WWW.WWW.", "..WWWWW..", "...WWW...",
  "..WWWWW..", ".WWW.WWW.", "WWW...WWW", "WW.....WW",
];
vector(CLOSE, `<path d="M0.9 0.9L8.1 8.1M8.1 0.9L0.9 8.1" stroke="#fff" stroke-width="2.3" stroke-linecap="square"/>`);
// scroll and combo arrows: 2px chevrons
const UP = ["...B...", "..BBB..", ".BB.BB.", "BB...BB"];
const DOWN = [...UP].reverse();
const LEFT = ["...B", "..BB", ".BB.", "BB..", ".BB.", "..BB", "...B"];
const RIGHT = LEFT.map((r) => [...r].reverse().join(""));
vector(UP, `<path d="M0.6 3.6L3.5 0.7L6.4 3.6" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
vector(DOWN, `<path d="M0.6 0.4L3.5 3.3L6.4 0.4" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
vector(LEFT, `<path d="M3.6 0.6L0.7 3.5L3.6 6.4" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
vector(RIGHT, `<path d="M0.4 0.6L3.3 3.5L0.4 6.4" fill="none" stroke="${COLORS.B}" stroke-width="1.6"/>`);
// menu fly-out and ribbon drop-down triangles: black
const TRI_RIGHT = ["K...", "KK..", "KKK.", "KKKK", "KKK.", "KK..", "K..."];
const TRI_DOWN = ["KKKKK", ".KKK.", "..K.."];
vector(TRI_RIGHT, `<path d="M0 0L4 3.5L0 7Z" fill="#000"/>`);
vector(TRI_DOWN, `<path d="M0 0H5L2.5 3Z" fill="#000"/>`);
// the check mark: XP's green tick
const CHECK = ["......G", ".....GG", "G...GGG", "GG.GGG.", "GGGGG..", ".GGG...", "..G...."];
vector(CHECK, `<path d="M0.7 3.2L2.5 5.2L6.4 1" fill="none" stroke="${COLORS.G}" stroke-width="2.1"/>`);
// XP's green "go" arrow (All Programs, the Welcome screen's log-in button): white on green
const GO = ["....W..", "....WW.", "WWWWWWW", "WWWWWWW", "....WW.", "....W.."];
// the task pane's collapse and expand chevrons (doubled), in their round button
const DUP = ["...N...", "..NNN..", ".NN.NN.", "NN...NN", "...N...", "..NNN..", ".NN.NN.", "NN...NN"];
const DDOWN = [...DUP].reverse();
vector(DUP, `<path d="M0.6 3.6L3.5 0.7L6.4 3.6M0.6 7.6L3.5 4.7L6.4 7.6" fill="none" stroke="${COLORS.N}" stroke-width="1.5"/>`);
vector(DDOWN, `<path d="M0.6 0.4L3.5 3.3L6.4 0.4M0.6 4.4L3.5 7.3L6.4 4.4" fill="none" stroke="${COLORS.N}" stroke-width="1.5"/>`);

// ---- Luna recipes ----
// Drop-down selects include size="1" ones (SPE's Read-Variable writes it); list boxes are multiple or size > 1.
// The scheme's colours are custom properties, --sct-xpc-<name> (V below), and its glyphs (a caption button's
// with its face) --sct-xp-<name>: SCHEMES sets them, the default scheme's on the surface, the others' under
// [data-sct-scheme].
const V = (name) => `var(--sct-xpc-${name})`;
const capText = `color: ${V("cap-fg")}; font: bold 13px/1 ${CAPFONT}; text-shadow: ${V("cap-shadow")};`;
const BTN_CLOSE = "linear-gradient(135deg, #f4a487, #e1552d 45%, #c93a17 80%, #e3643c)";
const COLLAPSE = ["WWWWWWW", ".WWWWW.", "..WWW..", "...W..."];
const MORE = ["BB.BB.BB", "BB.BB.BB"];
// A scheme's glyphs: the caption buttons' in ink (a pixel art colour) on face, the close button's white on close;
// the scroll, combo and back arrows in arrow (Blue's B); the task pane's chevrons in chevron (Blue's N).
function schemeGlyphs(ink, face, close, arrow, chevron) {
  const g = (rows, at) => art(rows.map((r) => r.replace(/W/g, ink)), at);
  const a = (rows, at) => art(recolour(rows, "B", arrow), at);
  const c = (rows) => art(recolour(rows, "N", chevron));
  // ponytail: the Launchpad group chevrons keep the pixel squares at 2x (no vector), as Blue's always had
  const lp = (rows) => art(rows.map((r) => r.replace(/B/g, chevron)), [1, 1]);
  return {
    min: `${g(MIN, [6, 12])}, ${face}`, max: `${g(MAX)}, ${face}`, restore: `${g(RESTORE)}, ${face}`, close: `${art(CLOSE)}, ${close}`, collapse: `${g(COLLAPSE)}, ${face}`,
    up: a(UP), down: a(DOWN), left: a(LEFT), right: a(RIGHT), more: a(MORE), combo: a(DOWN, 6), back: a(LEFT, [0, 0]),
    dup: c(DUP), ddown: c(DDOWN), "group-up": lp(UP), "group-down": lp(DOWN),
  };
}
const SCHEMES = {
  blue: {
    glyphs: schemeGlyphs("W", "linear-gradient(135deg, #79a6fc, #2d68e8 45%, #1d55da 80%, #3f78ef)", BTN_CLOSE, "B", "N"),
    cap: "linear-gradient(#0997ff, #0053ee 8%, #0050ee 40%, #0066ff 88%, #0066ff 93%, #005bff 95%, #003dd7 96%, #003dd7)",
    "cap-in": "linear-gradient(#9db3e8, #6d89d4 6%, #5470c0 18%, #5470c0 88%, #4a64ad)",
    "cap-fg": "#fff", "cap-in-fg": "#fff", "cap-shadow": "1px 1px #0f1089", "cap-line": "#003dd7",
    // the ISE's script path in the caption; Sitecore's logo and icons, dark art, recoloured for the caption
    "cap-dim": "#c9dcff", "cap-logo": "brightness(0) invert(1)",
    frame: "#0d55e2", "frame-line": "#0831d9", "frame-in": "#7a96df", "frame-in-line": "#5470c0",
    "btn-border": "#fff", "close-border": "#fff",
    bar: "linear-gradient(#3168d5, #4993e6 3%, #2157d7 10%, #2663e0 50%, #245edb 92%, #1941a5)",
    task: "linear-gradient(#5d9bf8, #3c81f3 15%, #3a7ef0 85%, #2f6fdf)",
    "task-hot": "linear-gradient(#6faaff, #53a3ff 15%, #4f99fb 85%, #4085f0)",
    "task-on": "#1e52b7", "task-border": "#1c50c0", "task-on-border": "#10347f", "task-fg": "#fff", "task-on-fg": "#fff",
    tray: "linear-gradient(#0c59b9, #1185de 4%, #0b72cc 20%, #0b72cc 85%, #1a64c0)", "tray-edge": "#092e7b", "tray-light": "#1ba1ec", "tray-fg": "#fff",
    sm: "#1c64de", "sm-top": "linear-gradient(#1868ce, #0e60cb 15%, #2b7be6 30%, #1b6ed9 70%, #0f5ac4 90%, #1857c2)",
    "sm-rule": "#e18d39", "sm-rule-light": "#f8c26d", "sm-fg": "#fff", "sm-shadow": "1px 1px 1px #0f1089",
    "sm-right": "#d3e5fa", "sm-edge": "#95bdee", "sm-right-fg": "#00136b",
    "sm-foot": "linear-gradient(#4282d6, #3b85e0 10%, #418ae3 30%, #3881dc 70%, #1c64de)", "sm-foot-fg": "#fff", "sm-foot-hot": "rgba(255, 255, 255, 0.2)",
    // the start button; the start menu's program list, its text and the descriptions under the names
    start: "linear-gradient(#5eac56, #3c9c3c 10%, #41a541 18%, #349734 60%, #2f8a2f 88%, #2d7f2d)",
    "sm-left": "#fff", "sm-left-fg": "#000", "sm-left-dim": "#555",
    // the selection, and the black menu triangles turned white on it
    sel: "#316ac5", "sel-fg": "#fff", "sel-glyph": "invert(1)",
    // scroll bars (thumb and buttons, vertical and horizontal faces) and combo buttons
    "scroll-v": "linear-gradient(90deg, #cad9fd, #b8cdf9 45%, #a9c0f4)", "scroll-h": "linear-gradient(180deg, #cad9fd, #b8cdf9 45%, #a9c0f4)",
    "scroll-edge": "#8eaae6", combo: "linear-gradient(135deg, #e3ebfd, #c1d3fb 60%, #b0c6f7)",
    // task panes (the Content Editor's sections, the Control Panel, Launchpad): header, its text, body, the pane
    "pane-head": "linear-gradient(90deg, #fff, #c6d3f7)", "pane-ring": "#c6d3f7", "pane-fg": "#215dc6", "pane-hot": "#428eff",
    "pane-body": "#d6dff7", "pane-bg": "linear-gradient(#7ba2e7, #6375d6)",
    "group-line": "linear-gradient(90deg, #6c95e8, #c5d6f7 55%, transparent)", "group-fg": "#0e3c9c",
  },
  olive: {
    glyphs: schemeGlyphs("W", "linear-gradient(135deg, #c7c7b4, #a5b48b 45%, #8e9d69 80%, #768753)", BTN_CLOSE, "O", "P"),
    cap: "linear-gradient(#e9f2c7, #e0e7b8 7%, #bfcb92 11%, #afbc84 18%, #a7b580 25%, #aab883 36%, #adbd85 50%, #b5c68d 64%, #bbc98f 71%, #c2cd95 79% 86%, #bac88e 93%, #96a867)",
    "cap-in": "linear-gradient(#f1f1da, #edebd3 7%, #dfe0c2 11%, #d6d8bb 18%, #d3d6ba 25% 32%, #d4d7bb 46%, #d7dbbd 57%, #dcdec0 68%, #e0e1c3 79% 86%, #dcdec0 93%, #cbceb6)",
    "cap-fg": "#41400a", "cap-in-fg": "#4f5a2e", "cap-shadow": "1px 1px rgba(255, 255, 255, 0.45)", "cap-line": "#96a867",
    "cap-dim": "#41400a", "cap-logo": "brightness(0)",
    frame: "#abbd85", "frame-line": "#758d5e", "frame-in": "#d8dcbe", "frame-in-line": "#aab48c",
    "btn-border": "#fff", "close-border": "#fff",
    bar: "linear-gradient(#eaf5c9, #e0e7b8 5%, #a8b680 18%, #c2cd95 90%, #96a867)",
    task: "linear-gradient(#ffffe7 5%, #e7eccd 5%, #c2cba3 80%, #c8d39c)",
    "task-hot": "linear-gradient(#fbffe8 5%, #f2f7d5 5%, #d6e3b0)",
    "task-on": "linear-gradient(#4f573b, #67734f 15%, #67734f)", "task-border": "#94a26b", "task-on-border": "#424931", "task-fg": "#41400a", "task-on-fg": "#fff",
    tray: "linear-gradient(#fffde9, #fcf7d9 5%, #f2e5b1 15%, #eae2b2 15% 90%, #d0bc89)", "tray-edge": "#968b4b", "tray-light": "#fffde9", "tray-fg": "#41400a",
    sm: "#8ba169", "sm-top": "linear-gradient(#deebc4, #afc18d 10%, #adbf8b 25%, #b9ca95 50%, #cddcab 75%, #ddedc0)",
    "sm-rule": "#e18d39", "sm-rule-light": "#f8c26d", "sm-fg": "#41400a", "sm-shadow": "1px 1px 1px rgba(255, 255, 255, 0.45)",
    "sm-right": "#f3f1e4", "sm-edge": "#d6cea6", "sm-right-fg": "#41400a",
    "sm-foot": "linear-gradient(#d9e2b4, #d3dbab 20%, #c4d098 60%, #b3c087)", "sm-foot-fg": "#41400a", "sm-foot-hot": "rgba(255, 255, 255, 0.35)",
    sel: "#6b7a45", "sel-fg": "#fff", "sel-glyph": "invert(1)",
    "scroll-v": "linear-gradient(90deg, #d6e6d3, #c6dcc1 45%, #b7d3b0)", "scroll-h": "linear-gradient(180deg, #d6e6d3, #c6dcc1 45%, #b7d3b0)",
    "scroll-edge": "#99c190", combo: "linear-gradient(135deg, #e3eee1, #c7ddc2 60%, #bcd6b6)",
    "pane-head": "linear-gradient(90deg, #fefbea, #e1e7b9)", "pane-ring": "#e1e7b9", "pane-fg": "#56662d", "pane-hot": "#7d8f3e",
    "pane-body": "#f6f6ec", "pane-bg": "linear-gradient(#ccd9ad, #a7be86)",
    "group-line": "linear-gradient(90deg, #a5b986, #e1e7b9 55%, transparent)", "group-fg": "#56662d",
  },
  silver: {
    glyphs: schemeGlyphs("D", "linear-gradient(#fff, #f2f1f7 10%, #dcdbe7 25%, #d3d3e1 40%, #c8cad9 55%, #b8b9ce 70%, #a7a8c2 85%, #9c9ebe)",
      "linear-gradient(#fae9b6, #f2b89e 10%, #ef817a 22%, #e4716d 35%, #e06a68 50%, #d96162 65%, #d05a5f 80%, #c6555c)", "S", "Q"),
    cap: "linear-gradient(#fff, #d7d8e2 4%, #bcbccf 8%, #a8a7bf 13%, #a4a3be 17%, #b1b3c8 30%, #c2c4d1 48%, #dcdee5 66%, #f1f1f4 78%, #fff 89%, #e4e3e3 93%, #bcbdcd 96%, #777792)",
    "cap-in": "linear-gradient(#fff, #eceef5 4%, #e4e5ed 8%, #d7d7e3 13% 18%, #dbdde6 25%, #dedfea 36%, #e6e8ed 50%, #f4f3f5 64%, #fbfbfc 79%, #fff 89%, #eaedf5 96%, #cccbd9)",
    "cap-fg": "#000", "cap-in-fg": "#545462", "cap-shadow": "1px 1px #fff", "cap-line": "#777792",
    "cap-dim": "#33334a", "cap-logo": "brightness(0)",
    frame: "#d0d1de", "frame-line": "#66667e", "frame-in": "#e6e7ee", "frame-in-line": "#a9a9bd",
    "btn-border": "#6b758f", "close-border": "#a63944",
    bar: "linear-gradient(#dadce8, #fff 5%, #dadce8 10%, #b3b6c5 12%, #9a99b1 13%, #a8a9bf 35%, #b1b7bb 40%, #bbbdcd 50%, #d7d7d7 62%, #ecebec 90%, #83829d)",
    task: "linear-gradient(#fff, #f8f9fa 20%, #cfd0df 50%, #cbccda)",
    "task-hot": "linear-gradient(#d9dae8, #dddeed 40%, #efeff8 50%, #fcfcff 65%, #fff 85%)",
    "task-on": "linear-gradient(#3d4851, #56616d 10%, #5d6874 50%, #626d79)", "task-border": "#9495a2", "task-on-border": "#43515b", "task-fg": "#404040", "task-on-fg": "#fff",
    tray: "linear-gradient(#fff, #fefefe 12%, #e8e8ee 25%, #cfd0df 40%, #cbccda 50%, #c8cad8 78%, #aaadc2 97%, #888ba3 98%, #61637c)", "tray-edge": "#58596d", "tray-light": "#d7d8da", "tray-fg": "#000",
    sm: "#a8a9bf", "sm-top": "linear-gradient(#ebecf1, #b2b2c7 6%, #aaa9c2 12%, #bebfd1 40%, #d8d9e3 60%, #f4f3f6 85%, #fff)",
    "sm-rule": "#b5b7b9", "sm-rule-light": "#fff", "sm-fg": "#000", "sm-shadow": "1px 1px 1px #fff",
    "sm-right": "#e3e6ec", "sm-edge": "#cbd2d9", "sm-right-fg": "#000",
    "sm-foot": "linear-gradient(#e6e7ec, #d7d8e2 20%, #c6c8d7 50%, #b9bbce 75%, #b1b3c8)", "sm-foot-fg": "#000", "sm-foot-hot": "rgba(255, 255, 255, 0.45)",
    sel: "#b2b4bf", "sel-fg": "#000", "sel-glyph": "none",
    "scroll-v": "linear-gradient(90deg, #ececec, #dedede 45%, #d1d1d1)", "scroll-h": "linear-gradient(180deg, #ececec, #dedede 45%, #d1d1d1)",
    "scroll-edge": "#b8b8b8", combo: "linear-gradient(135deg, #f4f4f4, #dedede 60%, #d2d2d2)",
    "pane-head": "linear-gradient(90deg, #fff, #d6d7e0)", "pane-ring": "#d6d7e0", "pane-fg": "#33334a", "pane-hot": "#56607a",
    "pane-body": "#f0f1f5", "pane-bg": "linear-gradient(#c3c7d3, #b1b3c8)",
    "group-line": "linear-gradient(90deg, #9ea2b8, #d6d7e0 55%, transparent)", "group-fg": "#33334a",
  },
  luna: {
    glyphs: schemeGlyphs("W", "linear-gradient(#7abbed, #528cdf 10%, #4278d6 30%, #3262cc 50%, #234fc4 72%, #275dd3)",
      "linear-gradient(#ed7a7a, #d95151 10%, #c64040 30%, #b32e2e 50%, #a21f1f 72%, #b92020)", "B", "N"),
    cap: "linear-gradient(#63aae7, #2a66bf 8%, #1d55b7 12% 29%, #1e56bc 36%, #215dc2 50%, #2766ca 64%, #2c6fd1 79% 86%, #2a68cb 89%, #245dc2 93%, #1f52b9 96%, #143898)",
    "cap-in": "linear-gradient(#9bccf8, #83b2e7 4%, #77a1e0 8%, #6f97dc 12% 32%, #7097df 39%, #729ce2 54%, #76a3e8 71%, #77a7eb 79% 86%, #76a1e8 89%, #749ce2 93%, #7194dd 96%, #6b85c8)",
    "cap-in-fg": "#0a2257", "cap-line": "#143898", "cap-dim": "#fff",
    frame: "#1d4bb0", "frame-line": "#0d308c", "frame-in": "#6886d2", "frame-in-line": "#5e79bc",
    "btn-border": "#254394", "close-border": "#801313",
    bar: "linear-gradient(#3a58aa, #67a7df 3%, #4478c0 7%, #2c57ac 23%, #2147a1 35%, #1e429c 45%, #1e3e96 70%, #1e3c94 90%, #19368d 96%, #142d7a)",
    task: "linear-gradient(#4a8ef2, #2b67dd 15%, #2963d8 85%, #235bcf)",
    "task-hot": "linear-gradient(#5a9cf6, #3370e6 15%, #316de2 85%, #2a64d8)",
    "task-on": "linear-gradient(#123c93, #174cba 15%, #1a52b8 85%, #2258b8)", "task-border": "#1a47b0", "task-on-border": "#0d2c70",
    tray: "linear-gradient(#7bb8ed, #4570c4 6%, #4369c1 25%, #3d5db7 80%, #37509d)", "tray-edge": "#142d7a", "tray-light": "#4570c4",
    sm: "#1653a8", "sm-top": "linear-gradient(#3d7ed9, #185ab6 5%, #124286 10%, #114183 15%, #13468d 30%, #154e9d 50%, #1755ab 70%, #1858b2 80%, #1e5fba 95%, #1653a8)",
    "sm-left": "#0e2e66", "sm-left-fg": "#fff", "sm-left-dim": "#b5d4f5",
    "sm-right": "#bcd9f6", "sm-edge": "#4585df",
    "sm-foot": "linear-gradient(#488ae6, #1b5bb5 5%, #1756af 25%, #154f9f 50%, #144994 75%, #12448a 97%, #0c2e5e)",
    start: "linear-gradient(#88c67e, #399937 6%, #158715 14%, #107810 24%, #128612 40%, #149414 52%, #2c9f15 62%, #43a917 75%, #5cb418 85%, #6bc21a 90%, #7ecf33 93%, #33710f)",
  },
};
// The default, a site without a scheme of its own. Olive Green, Silver and Luna take Blue's value for anything they
// leave out.
const DEFAULT = "luna";
for (const s of Object.values(SCHEMES)) for (const [k, v] of Object.entries(SCHEMES.blue)) if (!(k in s)) s[k] = v;
// Text on the other schemes' chrome passes WCAG AA on every inner stop of its background (the outer ones are
// edges and highlights). Blue keeps XP's colours as measured, its taskbar buttons' white on #3c81f3 included, and
// so do the pairs a scheme takes from it unchanged.
{
  const hex = (v) => (v.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi) || []).map((h) => h.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3"));
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const TEXT = [["cap-fg", "cap"], ["cap-dim", "cap"], ["cap-in-fg", "cap-in"], ["task-fg", "task"], ["task-fg", "task-hot"], ["task-on-fg", "task-on"],
    ["tray-fg", "tray"], ["sm-fg", "sm-top"], ["sm-right-fg", "sm-right"], ["sm-foot-fg", "sm-foot"], ["sel-fg", "sel"],
    ["pane-fg", "pane-head"], ["sm-left-fg", "sm-left"], ["sm-left-dim", "sm-left"]];
  for (const [id, s] of Object.entries(SCHEMES)) {
    if (id === "blue") continue;
    for (const [fg, bg] of TEXT) {
      if (s[fg] === SCHEMES.blue[fg] && s[bg] === SCHEMES.blue[bg]) continue;
      const stops = hex(s[bg]);
      for (const c of stops.length > 2 ? stops.slice(1, -1) : stops) {
        if (ratio(hex(s[fg])[0], c) < 4.5) throw new Error(`${id}: ${fg} on ${bg} at ${c} is ${ratio(hex(s[fg])[0], c).toFixed(2)}:1`);
      }
    }
  }
}
// Each scheme's properties on surface S: the default's all, the others' where they differ from it.
const schemeVars = (S) => Object.entries(SCHEMES).sort(([a], [b]) => (b === DEFAULT) - (a === DEFAULT)).map(([id, s]) => {
  const base = SCHEMES[DEFAULT];
  const own = (k, v, from) => id === DEFAULT || v !== from[k];
  const props = [...Object.entries(s.glyphs).filter(([k, v]) => own(k, v, base.glyphs)).map(([k, v]) => `--sct-xp-${k}: ${v};`),
    ...Object.entries(s).filter(([k, v]) => k !== "glyphs" && own(k, v, base)).map(([k, v]) => `--sct-xpc-${k}: ${v};`)];
  return `${id === DEFAULT ? S : `${S}[data-sct-scheme="${id}"]`} {\n${props.map((p) => `  ${p}`).join("\n")}\n}`;
}).join("\n");
// a caption button: g is one of the --sct-xp-* glyph-and-face backgrounds, edge its frame's scheme colour
const capBtn = (g, edge = "btn-border") => `box-sizing: border-box; width: 21px; height: 21px; margin: 0; padding: 0; border: 1px solid ${V(edge)}; border-radius: 3px; ${paint(g)}`;
// the window frame drawn outside an element (a desktop window's iframe): blue rings, dark outside

// tabs
const tab = `border: 1px solid #919b9c; border-bottom: 0; border-radius: 3px 3px 0 0; background: linear-gradient(#fff, #f3f3ef 60%, #ecebe6); box-shadow: none; color: #000; text-transform: none; text-shadow: none;`;
const tabHot = "border-top-color: #e68b2c; box-shadow: inset 0 2px #ffc83c;";
const tabOpen = `background: #fcfcfe; ${tabHot}`;
// push buttons
const push = `box-sizing: border-box; border: 1px solid #003c74; border-radius: 3px; background: linear-gradient(#fff, #f6f5f1 30%, #ecebe6 85%, #d6d0c5); color: #000; text-shadow: none; text-transform: none; box-shadow: none;`;
const pushHot = "box-shadow: inset 0 2px #ffe8a6, inset 0 -2px #f8b330, inset 2px 0 #fcd37a, inset -2px 0 #fcd37a;";
const pushDefault = "box-shadow: inset 0 2px #cee7ff, inset 0 -2px #6982ee, inset 2px 0 #bcd4f6, inset -2px 0 #89ade4;";
const pushDown = "background: linear-gradient(#e5e4de, #e3e2db 85%, #f2f1ec); box-shadow: none;";
const pushOff = "border-color: #c9c7ba; background: #f5f4ea; color: #aca899; box-shadow: none;";
// toolbar buttons (ribbon, header buttons): flat until hovered, then a soft raised face
const toolHot = "border-color: #cecec3; background: linear-gradient(#fff, #f7f6f2 60%, #ebeae3); box-shadow: none;";
const toolDown = "border-color: #9d9d92; background: #e3e3db; box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.18);";
// fields
const field = "border: 1px solid #7f9db9; border-radius: 0; background-color: #fff; color: #000; box-shadow: none;";
const comboBtn = `var(--sct-xp-combo), ${V("combo")} right 1px top 1px / 16px calc(100% - 2px) no-repeat`;
// the scroll bar's thumb and buttons
const scrollFace = (deg) => V(deg === "90deg" ? "scroll-v" : "scroll-h");
// task pane
const PANE_BG = V("pane-bg");
const paneHead = `background: ${V("pane-head")}; border-radius: 3px 3px 0 0; color: ${V("pane-fg")}; font: bold 11px/25px ${FONT};`;
// g: the chevron's glyph property, dup or ddown
const roundChevron = (g) => `var(--sct-xp-${g}), radial-gradient(circle at 50% 50%, #fff 0 8px, ${V("pane-ring")} 8.5px 9px, transparent 9.5px)`;
// the Luna selection
const SEL = `background: ${V("sel")}; color: ${V("sel-fg")};`;

const TABS = (state) => [".scRibbon a.scRibbonNavigatorButtons", ".scRibbon a.scRibbonNavigatorButtonsContextual"].map((s) => `${P} ${s}${state}`).join(",\n");
const RB = 'a[class*="scRibbonToolbar"][class*="Button"]:not(.scRibbonToolbarLargeComboButton > a)';
const LC = ":is(.scRibbonToolbarLargeComboButtonTop, .scRibbonToolbarLargeComboButtonBottom)";

// The global header (standalone Content Editor, SPEAK pages): a Luna caption.
const header = (S) => `/* ---- Global header: a Luna caption ---- */
${S} :is(.sc-globalHeader, .sc-flx-global-header) { background: ${V("cap")}; border-bottom: 1px solid ${V("cap-line")}; box-shadow: none; color: ${V("cap-fg")}; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation span,
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation a,
${S} :is(.sc-globalHeader, .sc-flx-global-header) a { color: ${V("cap-fg")}; font-family: ${FONT}; text-shadow: ${V("cap-shadow")}; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::before, ${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation li::after { color: ${V("cap-fg")}; }
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-accountInformation img { border: 1px solid #fff; border-radius: 3px; }
/* Sitecore's logo is dark art: white on the caption (black on Olive's and Silver's) */
${S} :is(.sc-globalHeader, .sc-flx-global-header) .sc-global-logo { filter: ${V("cap-logo")}; }
`;

// The application header of a SPEAK page (title, Back): XP's toolbar under the caption.
const appHeader = (SX) => `${SX} .sc-applicationHeader { border: 0; background: #ece9d8; box-shadow: none; }
${SX} .sc-applicationHeader-row1 { display: flow-root; height: auto; min-height: 0; padding: 0; background: #ece9d8; border: 0; }
${SX} .sc-applicationHeader-row1::after { content: none; }
${SX} .sc-applicationHeader-row1 .sc-applicationHeader-content { height: auto; padding: 10px 15px 6px; }
${SX} .sc-applicationHeader-title, ${SX} .sc-applicationHeader-title .sc-text { color: #000; font: bold 16px/22px ${CAPFONT}; }
${SX} .sc-applicationHeader-row2 { display: flow-root; height: auto; min-height: 0; padding: 0 15px 8px; background: #ece9d8; border: 0; border-bottom: 1px solid #aca899; box-shadow: 0 1px #fff; }
${SX} .btn.sc-backbutton { display: inline-flex; align-items: center; gap: 6px; height: 23px; min-width: 0; padding: 0 12px 0 8px; }
${SX} .btn.sc-backbutton .sc-backbutton-text { position: static; min-width: 0; height: auto; margin: 0; padding: 0; color: #000; font: 11px/21px ${FONT}; text-decoration: none; }
${SX} .btn.sc-backbutton:hover .sc-backbutton-text { text-decoration: none; }
${SX} .btn.sc-backbutton::before, ${SX} .btn.sc-backbutton:is(:hover, :active)::before { position: static; flex: none; width: 4px; height: 7px; background: var(--sct-xp-back); mask: none; transform: none; }`;

const css = `/* Whistler: classic shell. Generated by tools/build-whistler-css.cjs; never hand-edit.
   Windows XP's Luna: rounded captions (Luna Element's blue, XP's Blue, Olive Green or Silver), the #ece9d8 window
   face, orange-topped tabs, Tahoma. */

${schemeVars(P)}

/* The SPE ISE's Ace editor measures its own monospace font; keep the theme font out of it. */
${P} body, ${P} input, ${P} select, ${P} textarea, ${P} button,
${P} :is(td, a, span, div):not(.ace_editor, .ace_editor *) {
  font-family: ${FONT};
}
${P} { scrollbar-color: auto; }

/* ---- Scrollbars: Luna's light blue thumb and buttons on a pale track (Chrome and Edge) ---- */
${P} ::-webkit-scrollbar { width: 17px; height: 17px; background: #f4f4f0; }
${P} ::-webkit-scrollbar-track { border-radius: 0; }
${P} ::-webkit-scrollbar-track:vertical { background: linear-gradient(90deg, #f3f1ec, #fefefe); }
${P} ::-webkit-scrollbar-track:horizontal { background: linear-gradient(#f3f1ec, #fefefe); }
${P} ::-webkit-scrollbar-thumb, ${P} :is(select, textarea)::-webkit-scrollbar-thumb { border: 0; border-radius: 3px; box-shadow: inset 1px 1px #fff, inset -1px -1px ${V("scroll-edge")}; }
${P} ::-webkit-scrollbar-thumb:vertical, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:vertical { background: ${scrollFace("90deg")}; }
${P} ::-webkit-scrollbar-thumb:horizontal, ${P} :is(select, textarea)::-webkit-scrollbar-thumb:horizontal { background: ${scrollFace("180deg")}; }
${P} ::-webkit-scrollbar-corner { background: #f4f4f0; }
${P} ::-webkit-scrollbar-button:single-button { display: block; border-radius: 3px; box-shadow: inset 1px 1px #fff, inset -1px -1px ${V("scroll-edge")}; }
${P} ::-webkit-scrollbar-button:vertical:single-button { width: 17px; height: 17px; }
${P} ::-webkit-scrollbar-button:horizontal:single-button { width: 17px; height: 17px; }
${P} ::-webkit-scrollbar-button:vertical:decrement { background: var(--sct-xp-up), ${scrollFace("90deg")}; }
${P} ::-webkit-scrollbar-button:vertical:increment { background: var(--sct-xp-down), ${scrollFace("90deg")}; }
${P} ::-webkit-scrollbar-button:horizontal:decrement { background: var(--sct-xp-left), ${scrollFace("180deg")}; }
${P} ::-webkit-scrollbar-button:horizontal:increment { background: var(--sct-xp-right), ${scrollFace("180deg")}; }
/* The rule editor's two lists (10.5) carry Sitecore's own ID-weighted scrollbar: Luna's again, at their weight. */
${P} :is(#Conditions, #Description)::-webkit-scrollbar { width: 17px; height: 17px; background: #f4f4f0; }
${P} :is(#Conditions, #Description)::-webkit-scrollbar-thumb { border: 0; border-radius: 3px; background: ${scrollFace("90deg")}; box-shadow: inset 1px 1px #fff, inset -1px -1px ${V("scroll-edge")}; }

${header(P)}
/* ---- Ribbon: XP tabs over a tab page ---- */
${P} .scRibbon, ${P} .scRibbonNavigator { background: #ece9d8; }
${P} .scRibbonNavigator { border-bottom: 0; }
${TABS("Normal")},
${TABS("Active")} {
  ${tab}
  position: relative;
  font: 11px/19px ${FONT};
  padding: 0 10px;
  margin: 0 0 0 -1px;
}
${TABS("Normal:hover")} { ${tabHot} }
/* The open tab runs into the toolbar, over its top line. */
${TABS("Active")} {
  ${tabOpen}
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 2px;
}
${P} .scRibbonToolbar { background: linear-gradient(#fcfcfe, #f4f3ee); border-top: 1px solid #919b9c; border-bottom: 1px solid #919b9c; }
${P} .scRibbonToolbar .chunk {
  height: auto;
  background: transparent;
  border: 0;
  border-right: 1px solid #d5d2c1;
  box-shadow: 1px 0 #fff;
  border-radius: 0;
  margin: 3px 2px 3px 0;
}
${P} .scRibbonToolbar .chunk .caption { background: transparent; color: #444; font: 11px ${FONT}; }
${P} .scRibbonToolbar .panel, ${P} .scRibbonToolbar .panel span, ${P} .scRibbonToolbar .panel a { color: #000; font-size: 11px; }
${P} .scRibbonToolbar [class*="scRibbonToolbar"][class*="Button"] { border: 1px solid transparent; border-radius: 3px; }
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

/* ---- Content tree: white, Luna selection, the +/- boxes as real 9px borders ---- */
${P} .scContentTree { background: #fff; }
${P} .scContentTree :is(a, span) { font-size: 11px; }
${P} .scContentTree a.scContentTreeNodeActive { ${SEL} outline: 0; border-radius: 0; }
${P} .scContentTree a.scContentTreeNodeActive span { color: ${V("sel-fg")} !important; }
${P} .scContentTree a.scContentTreeNodeNormal:hover { background: transparent; text-decoration: underline; }
${P} img[src*="/treemenu_"] {
  box-sizing: border-box;
  width: 9px;
  height: 9px;
  margin: 4px 3px 3px 4px;
  border: 1px solid #7b9ebd;
  border-radius: 1px;
  object-fit: none;
  object-position: -999px -999px;
}
/* Default.css gives tree glyphs a 5px 0 margin */
${P} .scContentTreeNode > img[src*="/treemenu_"] { margin: 9px 3px 8px 4px; }
${P} img[src*="/treemenu_collapsed"] {
  background: linear-gradient(#000, #000) center / 1px 5px no-repeat, linear-gradient(#000, #000) center / 5px 1px no-repeat, linear-gradient(#fff, #fff 40%, #e0ddd2);
}
${P} img[src*="/treemenu_expanded"] { background: linear-gradient(#000, #000) center / 5px 1px no-repeat, linear-gradient(#fff, #fff 40%, #e0ddd2); }

/* ---- Editor ---- */
${P} .scEditorHeaderTitle { font: bold 14px ${CAPFONT}; color: #000; }
${P} a.scRibbonEditorTabActive, ${P} a.scRibbonEditorTabNormal, ${P} a#BTAddNewSearch, ${P} a#BTAddNewSearch:hover {
  ${tab}
  height: 21px;
  margin: 35px 0 0 -1px;
}
${P} a.scRibbonEditorTabNormal:hover, ${P} a#BTAddNewSearch:hover { ${tabHot} }
${P} a.scRibbonEditorTabActive { ${tabOpen} position: relative; z-index: 1; height: 23px; }
${P} #EditorTabs { height: 57px; border-bottom: 1px solid #919b9c; }
${P} a#BTAddNewSearch { width: 30px; }
${P} .scEditorTabHeaderActive, ${P} .scEditorTabHeaderNormal {
  background-color: transparent;
  color: #000;
  font: 11px ${FONT};
  border: 0;
  height: 21px;
  line-height: 21px;
  padding: 0 10px;
}
/* sections: XP's task pane headers, white to blue, bold blue titles, the round chevron button */
${P} .scEditorSectionCaptionExpanded, ${P} .scEditorSectionCaptionCollapsed {
  ${paneHead}
  line-height: 25px;
  padding: 0 0 0 10px;
  margin: 0 0 2px;
  border: 0;
}
${P} :is(.scEditorSectionCaptionExpanded, .scEditorSectionCaptionCollapsed):hover { color: ${V("pane-hot")}; }
${P} img.scEditorSectionCaptionGlyph { width: 19px; height: 19px; margin: 3px 4px 0 0; }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_up"] { ${paint(roundChevron("dup"))} }
${P} img.scEditorSectionCaptionGlyph[src*="accordion_down"] { ${paint(roundChevron("ddown"))} }
${P} .scEditorFieldLabel { color: #000; font: 11px ${FONT}; }

/* ---- Fields: white, a 1px #7f9db9 border ---- */
${P} .scContentControl,
${P} .scSearchInput,
${P} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${P} textarea,
${P} select { ${field} }
${P} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 20px; background: ${comboBtn}, #fff; }
${X} input[type="checkbox"], ${X} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 1px solid #1c5180;
  border-radius: 0;
  background: linear-gradient(135deg, #dcdcd7, #fff 75%);
  box-shadow: none;
}
${X} input[type="radio"] { border-radius: 50%; }
${X} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcd7, #fff 75%); }
${X} input[type="radio"]:checked { background: radial-gradient(circle, #55d551 0, #21a121 2.5px, transparent 3.2px), linear-gradient(135deg, #dcdcd7, #fff 75%); }
${X} :is(input[type="checkbox"], input[type="radio"]):hover:not(:disabled) { box-shadow: inset 0 0 0 1px #fcc87a, inset 0 0 0 2px #f8b636; }
${X} :is(input[type="checkbox"], input[type="radio"]):disabled { border-color: #cac8bb; background: #fff; opacity: 1; }
${P} :is(input[type="checkbox"], input[type="radio"]):focus-visible { outline: 1px dotted #000; outline-offset: 1px; }

/* ---- Push buttons: Luna's rounded face; an orange glow while hovered, a blue one on the default ---- */
${P} .scButton, ${P} button:not(.ui-button), ${P} input[type="button"], ${P} input[type="submit"] { ${push} font: 11px ${FONT}; }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):hover:not(:disabled) { ${pushHot} }
${P} .scButtonPrimary { ${pushDefault} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):active:not(:disabled) { ${pushDown} }
${P} :is(.scButton, button:not(.ui-button), input[type="button"], input[type="submit"]):disabled { ${pushOff} }
${P} .scButton:focus-visible, ${P} button:focus-visible { outline: 1px dotted #000; outline-offset: -4px; }

/* ---- Bottom application tabs: XP tabs hanging from the bottom edge ---- */
${P} .scPager { width: auto; margin: 0; border: 0; border-radius: 0; padding: 0 4px 3px; background: #ece9d8; border-top: 1px solid #919b9c; }
${P} .scPagerButtonNormal, ${P} .scPagerButtonActive {
  color: #000;
  font: 11px ${FONT};
  background: linear-gradient(#ecebe6, #f3f3ef 40%, #fff);
  border: 1px solid #919b9c;
  border-top: 0;
  border-radius: 0 0 3px 3px;
  box-shadow: none;
  margin: 0 0 0 -1px;
}
${P} .scPagerButtonNormal:hover { border-bottom-color: #e68b2c; box-shadow: inset 0 -2px #ffc83c; }
${P} .scPagerButtonActive { background: #fcfcfe; border-bottom-color: #e68b2c; box-shadow: inset 0 -2px #ffc83c, 0 -1px #fcfcfe; position: relative; z-index: 1; }

/* ---- Dialog windows: an XP window. The page inside the dialog draws the caption (its header); Sitecore's
   empty jQuery title bar is laid over it, keeping the drag and carrying the caption buttons. ---- */
${P} .ui-dialog {
  background: #ece9d8;
  border: 3px solid ${V("frame")};
  border-top: 0;
  border-radius: 8px 8px 0 0;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 0 0 1px ${V("frame-line")}, 2px 3px 8px rgba(0, 0, 0, 0.35);
}
/* The token layer's .ui-widget-content border (#aca899) outranks P: a greige band between the caption and the
   frame. Behind the caption's rounded corners the face is the frame's colour, so the clip blends frame into frame. */
${X} .ui-dialog { border-color: ${V("frame")}; background: linear-gradient(${V("frame")} 0 28px, #ece9d8 0); }
${P} .ui-dialog .ui-dialog-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  min-height: 0;
  padding: 0;
  z-index: 2;
  background: transparent;
  border: 0;
  border-radius: 0;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane {
  top: 4px !important;
  right: 3px !important;
  margin: 0 !important;
  height: 21px;
  display: flex;
  gap: 2px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * {
  box-sizing: border-box;
  width: 21px;
  height: 21px;
  margin: 0;
  padding: 0;
  border: 1px solid ${V("btn-border")};
  border-radius: 3px;
  box-shadow: none;
  overflow: hidden;
  text-indent: -999px;
}
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > * > * { display: none; }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > button.ui-button {
  position: static !important;
  float: none !important;
  order: 9;
  margin: 0 !important;
  border-color: ${V("close-border")};
  background: var(--sct-xp-close);
}
${P} .ui-dialog .ui-dialog-titlebar-maximize { background: var(--sct-xp-max); }
${P} .ui-dialog .ui-dialog-titlebar-restore { background: var(--sct-xp-restore); }
${P} .ui-dialog .ui-dialog-titlebar-minimize { background: var(--sct-xp-min); }
${P} .ui-dialog .ui-dialog-titlebar-collapse { background: var(--sct-xp-collapse); }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :hover { filter: brightness(1.15); }
${P} .ui-dialog .ui-dialog-titlebar-buttonpane > :active { filter: brightness(0.85); }
/* a faint shade marks the dialog as modal */
${P} .ui-widget-overlay { background: rgba(0, 0, 0, 0.18); opacity: 1; }

/* Inside a dialog page: the header is the caption, the window's icon, then the title. */
${P} :is(.scFormDialogHeader, .scDialogHeader) { background: #ece9d8; padding: 0; border: 0; min-height: 0 !important; }
/* the dialog page's header, and the ListView's, which SPE puts straight in the jQuery dialog */
${P} :is(:is(.scFormDialogHeader, .scDialogHeader) .DialogHeader, .ui-dialog > .DialogHeader) {
  display: flex;
  align-items: center;
  gap: 5px;
  box-sizing: border-box;
  height: 28px;
  margin: 0;
  padding: 0 80px 0 7px;
  background: ${V("cap")};
  border: 0;
  border-radius: 0;
  ${capText}
  line-height: 28px;
  white-space: nowrap;
}
${P} .DialogHeader #DialogIcon { width: 16px; height: 16px; margin: 0; }
${P} :is(.scFormDialogHeader, .scDialogHeader) .DialogHeaderDescription { color: #000; padding: 8px 10px; margin: 0; font: 11px ${FONT}; background: #fff; border-bottom: 1px solid #aca899; }
${P} .scFormDialogContent, ${P} .scFormDialogFooter, ${P} .scDialogContentContainer { background: #ece9d8; }
${P} .scFormDialogFooter { border-top: 0; border-radius: 0; }
${X} .scDialogContentContainer { padding: 8px; }
${X} .scFormDialogFooter { height: 39px; padding: 8px; line-height: normal; }
${X} .scFormDialogFooter .footerOkCancel { position: static; float: right; }
/* SPE's help (?) floats for 10.x's taller footer: centred on the 23px buttons instead */
${X} .scFormDialogFooter img#Copyright { margin: 0; }

/* ---- Tab strips (dialogs, the ISE's script tabs) ---- */
${P} .scTabstrip [class*="scTabActive"]::after { display: none; }
${P} .scTabstrip, ${P} .scTabstrip > nobr { display: flex; align-items: flex-end; }
${P} .scTabstrip { border-bottom: 1px solid #919b9c; }
/* Sitecore swaps scTab for scTab_Hover under the mouse; the stock hover class is uppercase on a light face. */
${P} .scTabstrip :is(.scTab, .scTab_Hover), ${P} .scTabstrip [class*="scTabActive"] {
  ${tab}
  height: auto;
  padding: 0 10px;
  margin: 0 0 0 -1px;
  font: 11px/19px ${FONT};
}
${P} .scTabstrip .scTab_Hover { ${tabHot} }
${P} .scTabstrip [class*="scTabActive"] { ${tabOpen} position: relative; z-index: 1; padding-bottom: 2px; margin-bottom: -1px; }
/* The open first tab lines up with the page's left edge and keeps the tabs' own border: Sitecore styles the first
   <nobr>'s open tab apart (its own border colour, position: static), and the colour map copies that over the theme's */
${X} .scTabstrip > nobr:first-child > [class*="scTabActive"] { position: relative; left: 0; border-left-color: #919b9c; }
/* focus: XP's dotted rectangle inside the tab, never Sitecore's black frame */
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus { outline: none; box-shadow: none; }
${X} .scTabstrip [class*="scTabActive"]:focus { ${tabHot} }
${X} .scTabstrip :is(.scTab, .scTab_Hover, [class*="scTabActive"]):focus-visible { outline: 1px dotted #000; outline-offset: -4px; }
${P} .scTabstrip .closeTab { margin: 0 -2px 0 6px; }
/* the ISE's unsaved-script dot, darkened from SPE's #fc2929 to pass AA on the tab */
${P} .scTabstrip .scriptModified { color: #c4291c; }

/* ---- Window buttons (Desktop windows and the Content Editor's own): Luna's caption buttons ---- */
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) { display: flex; align-items: center; gap: 2px; }
${P} .scSystemButtons { margin-right: 6px; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img { vertical-align: middle; filter: none; }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="minimize"] { ${capBtn("var(--sct-xp-min)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="maximize"] { ${capBtn("var(--sct-xp-max)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="restore"] { ${capBtn("var(--sct-xp-restore)")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img[src*="_close"] { ${capBtn("var(--sct-xp-close)", "close-border")} }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"]):hover { filter: brightness(1.15); }
${P} :is(.scSystemButtons, .standartWindowButtons, .scWorkboxWindowButtons) img:is([src*="minimize"], [src*="maximize"], [src*="restore"], [src*="_close"]):active { filter: brightness(0.85); }
/* Standard windows (ISE, Console, Package Designer...): a Luna caption with rounded top corners. */
${P} .standardWindowCaption {
  height: 28px;
  background: ${V("cap")};
  border: 0;
  border-radius: 7px 7px 0 0;
}
/* Around the caption: the window's 1px #7f9db9 frame and the #d6dff7 body behind the rounded corners showed as
   a pale line between the caption and XP's frame. Both the frame's colour; the caption's 7px corners sit 1px inside
   the Desktop window's 8px clip. Workbox draws its own 1px sides (scWindowBorder2). */
${X} .scWindowFrame, ${X} .scWindowBorder2 { border-color: ${V("frame")}; }
${X} .scWindowFrame > .scStretch { background-color: ${V("frame")}; }
${PI}:not(#sct-xp) .scWindowFrame, ${PI}:not(#sct-xp) .scWindowBorder2 { border-color: ${V("frame-in")}; }
${PI}:not(#sct-xp) .scWindowFrame > .scStretch { background-color: ${V("frame-in")}; }
${P} .standardWindowCaption + .windowPlaceholderContainer { top: 28px; }
${P} .standardWindowCaption .windowCaptionIcon { display: inline-block; vertical-align: top; margin: 6px 0 0 6px; }
${P} .standardWindowCaption .scWindowCaption {
  display: inline-block;
  ${capText}
  line-height: 28px;
  padding: 0 6px;
  vertical-align: top;
}
${P} .standardWindowCaption .scWindowCaption * { font: inherit; }
/* The ISE writes its script's path into the caption in an inline #bbb: a tint that reads on the caption. */
${P} .standardWindowCaption .scWindowCaption i { color: ${V("cap-dim")} !important; }
${P} .standartWindowButtons { top: 4px; right: 5px; }
/* An inactive window (dom.js marks its document from the taskbar): the inactive caption, darkened to pass AA. */
${PI} .standardWindowCaption { background: ${V("cap-in")}; }
${PI} .standardWindowCaption .scWindowCaption { color: ${V("cap-in-fg")}; text-shadow: none; }
/* an inactive window's buttons fade, on every kind of window */
${PI} :is(.standartWindowButtons, .scSystemButtons, .scWorkboxWindowButtons) img { filter: saturate(0.5) brightness(1.1); }
/* The Content Editor, Media Library and Workbox: Sitecore draws no caption over their windows. A Luna caption, as on every other window, is
   drawn on the caption's empty top line from the window's title (engine.js --sct-window-title), the window's
   buttons on it and the ribbon's menu button moved below it. */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { box-sizing: border-box; height: 28px; background: ${V("cap")}; border-radius: 7px 7px 0 0; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { content: var(--sct-window-title, ""); display: block; box-sizing: border-box; height: 28px; padding: 0 96px 0 28px; background: var(--sct-window-icon, none) 6px center / 16px 16px no-repeat; ${capText} line-height: 28px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > .scSystemButtons, ${P}[data-sct-window-title] .scWorkboxWindowButtons { top: 4px; right: 5px; margin-right: 0; height: 20px; z-index: 2; }
/* the Workbox's buttons float in its caption strip: placed on the bar like the Content Editor's */
${P}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { position: relative; }
${P}[data-sct-window-title] .scWorkboxWindowButtons { position: absolute; float: none; }
/* Under the bar the tabs start at its foot: the empty header over the tab group (17px, for a contextual group's
   name) goes while no contextual group shows, and the menu button, 17px down and 30px tall for that band, moves
   up into the tab row at the row's height */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { top: 0; margin-top: 28px; height: 21px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator:not(:has(.scRibbonNavigatorButtonsContextualGroup)) .scRibbonNavigatorButtonsGroupHeader { display: none; }
/* 4px between the title bar and the tabs: they never touch it; the menu button moves down with them */
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption .scRibbonNavigator { padding-top: 4px; }
${P}[data-sct-window-title] .scWindowBorder2 > .scCaption > #SystemMenu { translate: 0 4px; }
/* the same 4px on a standard window (the ISE...), whose ribbon is in the page inside the window's chrome */
${P}[data-sct-window-content] .scRibbonNavigator { padding-top: 4px; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle { background: ${V("cap-in")}; }
${PI}[data-sct-window-title] .scWindowBorder2 > .scCaption > #CaptionTopLine::before, ${PI}[data-sct-window-title] .scWorkboxWindowCaption.scWindowHandle::before { color: ${V("cap-in-fg")}; text-shadow: none; }


/* ---- Insert gallery scroller ---- */
${P} .scRibbonPanelButtons { background: transparent; }
${P} :is(img.scRibbonPanelUp, img.scRibbonPanelDown, img.scRibbonPanelOpen) { width: 17px; height: 15px; filter: none; border-radius: 2px; box-shadow: inset 1px 1px #fff, inset -1px -1px ${V("scroll-edge")}; }
${P} img.scRibbonPanelUp { ${paint(`var(--sct-xp-up), ${scrollFace("90deg")}`)} }
${P} img.scRibbonPanelDown { ${paint(`var(--sct-xp-down), ${scrollFace("90deg")}`)} }
${P} img.scRibbonPanelOpen { ${paint(`var(--sct-xp-more), ${scrollFace("90deg")}`)} }

/* ==== Desktop: Bliss under the taskbar ==== */
/* XP had no header above the desktop: the start menu takes over the user name and Log Off (dom.js). */
${X}:has(#Desktop) .sc-globalHeader { display: none; }
${X}:has(#Desktop) .sc-globalHeader ~ :is(div, table) { padding-top: 0; }
${X}:has(#Desktop) .sc-globalHeader ~ div > .DesktopArea { margin-top: 0; }
${X} .DesktopArea {
  top: 0;
  bottom: 34px;
  overflow: clip;
  overflow-clip-margin: border-box;
  /* a rolling green hill under a blue sky with soft clouds; Sitecore sets its wallpaper inline */
  background:
    radial-gradient(ellipse 34% 9% at 22% 20%, rgba(255, 255, 255, 0.55), transparent 70%),
    radial-gradient(ellipse 22% 6% at 62% 12%, rgba(255, 255, 255, 0.45), transparent 70%),
    radial-gradient(ellipse 28% 7% at 82% 30%, rgba(255, 255, 255, 0.35), transparent 70%),
    radial-gradient(ellipse 120% 62% at 30% 118%, #5aa02c 0 50%, transparent 50.4%),
    radial-gradient(ellipse 120% 62% at 30% 118%, #79bd3d 0 52%, transparent 54%),
    radial-gradient(ellipse 90% 50% at 100% 118%, #3f7f1e 0 46%, transparent 46.5%),
    linear-gradient(#1f5fd0, #3d86e6 30%, #79b4f0 58%, #b9d9f7 74%, #d8ecfb) !important;
}
${X} .DesktopArea > :is(iframe, div[id^="FRAME"]) { top: 0; }

/* ---- Taskbar: the scheme's, 34px (XP's 30px read as cramped next to Sitecore's larger windows) ---- */
${X} .scStartbar { height: 34px; }
${X} #Startbar, ${X} #Startbar > table {
  height: 34px;
  background: ${V("bar")};
  border: 0;
  box-shadow: none;
}
${X} #Startbar > table > tbody > tr > td { height: 34px; padding: 0; border: 0; vertical-align: middle; }
/* the start button's cell: Sitecore sizes it 0px wide and lets the button overflow into the window list */
${X} .scStartButtonContainer { width: 108px; height: 34px; }
/* the start button: green, rounded on the right, "start" in white italics */
${X} .scStartButton, ${X} .scStartButton.scPopupOpener, ${X} .scStartButton:hover {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 98px;
  height: 34px;
  padding: 0 12px 2px 6px;
  border: 0;
  border-radius: 0 12px 12px 0;
  background: ${V("start")};
  box-shadow: inset -1px 0 #7cc174, inset 0 1px #79c071, 1px 0 2px rgba(0, 0, 0, 0.4);
}
${X} .scStartButton::after {
  content: "start";
  color: #fff;
  font: italic bold 18px/1 ${CAPFONT};
  text-shadow: 1px 1px 1px #1a4d1a;
}
${X} .scStartButton:hover { filter: brightness(1.1); }
${X} .scStartButton.scPopupOpener { background: linear-gradient(#3b8a36, #2c7a2a 15%, #297226 85%, #24691f); box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.45); filter: none; }
${X} .scStartButton:focus-visible { outline: 1px dotted #fff; outline-offset: -4px; }
${X} .scStartBarScroller { height: 34px; padding: 0; border: 0; display: flex; align-items: center; }
${X} #StartbarApplications { height: 26px; margin: 0; border-spacing: 3px 0; }
${X} :is(.scActiveApplication, .scInactiveApplication) {
  box-sizing: border-box;
  height: 26px;
  max-width: 160px;
  padding: 0 8px;
  border: 1px solid ${V("task-border")};
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
${X} .scInactiveApplication { background: ${V("task")}; box-shadow: inset 1px 1px rgba(255, 255, 255, 0.35); }
${X} .scInactiveApplication:hover { background: ${V("task-hot")}; }
${X} .scActiveApplication { background: ${V("task-on")}; box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.5); border-color: ${V("task-on-border")}; }
${X} .scInactiveApplication::before, ${X} .scInactiveApplication::after { display: none; }
${X} :is(.scActiveApplication, .scInactiveApplication) * { color: ${V("task-fg")}; font: 11px/24px ${FONT}; text-shadow: none; }
${X} .scActiveApplication * { color: ${V("task-on-fg")}; }
${X} .scStartBarApplication span img { margin: 0 4px 0 0 !important; vertical-align: middle; }
/* the tray: Blue's light blue, darkened under the white text (XP's #18b9f4 fails AA); Olive's cream, Silver's grey */
${X} .scStartbarTray {
  height: 34px;
  border: 0;
  border-left: 1px solid ${V("tray-edge")};
  background: ${V("tray")};
  box-shadow: inset 1px 0 ${V("tray-light")};
}
${X} .scStartbarTray > tbody > tr > td { height: 34px; padding: 0 0 0 6px; line-height: 34px !important; vertical-align: middle; }
${X} .scStartbarTray, ${X} .scStartbarTray * { color: ${V("tray-fg")}; font: 11px ${FONT}; }
${X} #SearchBox { box-sizing: border-box; width: 150px; height: 20px; min-height: 0; margin: 0; padding: 0 4px; ${field} font: 11px ${FONT}; }
${X} #SearchBox::placeholder { color: #6d6d6d; }
${X} #DatabaseSelector { display: inline-flex; vertical-align: top; align-items: center; height: 34px; padding: 0 4px; border-radius: 0; background: transparent; }
${X} #DatabaseSelector img { width: 16px; height: 16px; margin: 0 4px 0 0 !important; }
/* the database icon is white, for a dark tray: dark on Olive's and Silver's light ones */
${P}:is([data-sct-scheme="olive"], [data-sct-scheme="silver"]):not(#sct-xp) #DatabaseSelector img { filter: brightness(0) opacity(0.7); }
${X} .sct-xp-clock { padding: 0 10px 0 6px !important; white-space: nowrap; color: ${V("tray-fg")}; font: 11px ${FONT}; }

/* ---- Start menu: XP's two columns between the scheme's header and footer (dom.js adds both) ---- */
${X} .scPopup:has(> .scStartMenu) { padding: 0; border: 0; border-radius: 8px 8px 0 0; box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.45); background: transparent; overflow: hidden; }
${X} .scStartMenu {
  box-sizing: border-box;
  width: 400px;
  padding: 0;
  border: 0;
  border-radius: 8px 8px 0 0;
  background: ${V("sm")};
  box-shadow: none;
  overflow: hidden;
  font-family: ${FONT};
}
${X} .sct-xp-smtop {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 10px;
  background: ${V("sm-top")};
  border-bottom: 2px solid ${V("sm-rule")};
  box-shadow: 0 1px ${V("sm-rule-light")};
}
${X} .sct-xp-smtop img { box-sizing: border-box; width: 44px; height: 44px; border: 2px solid #fff; border-radius: 3px; background: #d6dff7; object-fit: cover; }
${X} .sct-xp-smtop span { overflow: hidden; color: ${V("sm-fg")}; font: bold 14px/1.2 ${CAPFONT}; text-shadow: ${V("sm-shadow")}; text-overflow: ellipsis; white-space: nowrap; }
${X} .scStartMenuContent { margin: 0 2px; border: 0; background: #fff; }
${X} .scStartMenuContentColumns { width: 100%; border: 0; border-collapse: collapse; table-layout: fixed; }
${X} .scStartMenuLeft, ${X} .scStartMenuRight { padding: 4px 0; vertical-align: top; }
${X} .scStartMenuLeft { width: 50%; background: ${V("sm-left")}; }
${X} .scStartMenuRight { background: ${V("sm-right")}; border-left: 1px solid ${V("sm-edge")}; }
${X} :is(.scStartMenuLeft, .scStartMenuRight) * { color: ${V("sm-left-fg")}; font-family: ${FONT}; }
${X} .scStartMenuRight * { color: ${V("sm-right-fg")}; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 0;
  height: auto;
  margin: 0;
  padding: 3px 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-decoration: none;
  white-space: nowrap;
}
${X} .scStartMenuLeft .scStartMenuLeftOption { height: 40px; }
${X} .scStartMenuRight :is(.scStartMenuLeftOption, .scStartMenuRightFolder) { height: 28px; }
${X} .scStartMenuLeftOptionIcon { flex: none; width: 32px; height: 32px; margin: 0 6px 0 0; float: none; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionIcon, .scStartMenuRightFolderIcon) { width: 24px; height: 24px; }
${X} .scStartMenuLeftOptionDescription { min-width: 0; overflow: hidden; }
${X} :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { padding: 0; font: bold 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight :is(.scStartMenuLeftOptionDisplayName, .scStartMenuRightFolderDisplayName) { font-weight: normal; }
${X} .scStartMenuLeftOptionTooltip { color: ${V("sm-left-dim")} !important; font: 11px/14px ${FONT}; overflow: hidden; text-overflow: ellipsis; }
${X} .scStartMenuRight .scStartMenuLeftOptionTooltip { display: none; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) { ${SEL} border: 0; padding: 3px 6px; }
${X} :is(.scStartMenuLeftOption, .scStartMenuRightFolder, .scStartMenuProgramsMenu):is(:hover, .scPopupOpener) > :not(table) { color: ${V("sel-fg")} !important; }
${X} .scStartMenuRightFolderDisplayName { flex: 1; }
${X} .scStartMenuDivider { height: 1px; margin: 3px 8px; border: 0; background: linear-gradient(90deg, transparent, #c5c2b2 20% 80%, transparent); }
${X} .scStartMenuRight .scStartMenuDivider { background: linear-gradient(90deg, transparent, ${V("sm-edge")} 20% 80%, transparent); }
${X} img.scStartMenuRightFolderGlyph { ${paint(art(TRI_RIGHT))} order: 2; width: 8px; height: 9px; margin: 0 0 0 6px; float: none; }
${X} .scStartMenuRightFolder:is(:hover, .scPopupOpener) img.scStartMenuRightFolderGlyph { filter: ${V("sel-glyph")}; }
/* All Applications: XP's All Programs, bold, with the green arrow after it */
${X} .scStartMenuPrograms { padding: 0 0 4px; background: ${V("sm-right")}; border-left: 1px solid ${V("sm-edge")}; vertical-align: bottom; }
${X} .scStartMenuPrograms .scStartMenuDivider { margin: 0 8px 4px; }
${X} .scStartMenuProgramsMenu { display: flex; align-items: center; justify-content: center; gap: 8px; height: 28px; padding: 3px 6px; color: #000; text-decoration: none; }
${X} .scStartMenuProgramsMenuText { color: #000; font: bold 11px/16px ${FONT}; }
${X} img.scStartMenuProgramsGlyph { order: 2; box-sizing: border-box; width: 19px; height: 19px; margin: 0; border: 1px solid #fff; border-radius: 3px; ${paint(`${art(GO)}, linear-gradient(135deg, #7fd36a, #3c9c3c 50%, #2d7f2d)`)} }
${X} .sct-xp-smbottom {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 8px;
  background: ${V("sm-foot")};
}
${X} .sct-xp-smbottom a { display: flex; align-items: center; gap: 5px; padding: 3px 6px; border-radius: 3px; color: ${V("sm-foot-fg")}; font: 11px ${FONT}; text-decoration: none; }
${X} .sct-xp-smbottom a:hover { background: ${V("sm-foot-hot")}; }
${X} .sct-xp-smbottom a img { width: 24px; height: 24px; }

/* ==== Where 10.x's own metrics (34-36px controls, 6px corners, soft shadows) outrank the rules above. ==== */

/* ---- Fields: 21px ---- */
${X} input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])),
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  padding: 0 3px;
  font: 11px/19px ${FONT};
  ${field}
}
${X} select:not([multiple], [size]:not([size="0"], [size="1"])) { padding-right: 20px; background: ${comboBtn}, #fff; }
${X} textarea, ${X} select:is([multiple], [size]:not([size="0"], [size="1"])) { border-radius: 0; ${field} }
${X} :is(input, select, textarea):focus { outline: none; }
${X} :is(input, textarea):disabled, ${X} select:disabled { background-color: #ebebe4; color: #aca899; border-color: #c9c7ba; }

/* Quick Info: read-only text in 19px rows, as Sitecore draws it (no frames) */
${X} .scEditorQuickInfo tr { line-height: 19px; }
${X} .scEditorQuickInfo td { padding: 1px 4px; font-size: 11px; }
${X} .scEditorQuickInfo input { height: 19px; padding: 0; border: 0; background: transparent !important; font-size: 11px; }

/* ---- Combo tables (date and time pickers, item pickers): one Luna combo box ---- */
${X} table.scCombobox {
  box-sizing: border-box;
  height: 21px;
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
  height: 19px !important;
  min-height: 0;
  margin: 0;
  padding: 0 3px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
${X} table.scCombobox img.scComboboxDropDown {
  display: block;
  box-sizing: border-box;
  width: 17px;
  height: 19px;
  margin: 0;
  padding: 0;
  border: 1px solid #fff;
  border-radius: 2px;
  box-shadow: none;
  ${paint(`var(--sct-xp-down), ${V("combo")}`)}
}
${X} table.scCombobox img.scComboboxDropDown:hover { filter: brightness(1.06); }

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
${X} .scButton.scButtonPrimary { border-color: #003c74; ${pushDefault} }
${X} .scButton.scButtonPrimary:hover:not(:disabled) { ${pushHot} }
${X} .scButton.scButtonPrimary:active:not(:disabled) { ${pushDown} }

/* ---- Drop-down arrows: a small black triangle for Sitecore's chevrons ---- */
${X} img[src*="ribbondropdown" i] { ${paint(art(TRI_DOWN))} }

/* ---- Tree search: a field and two toolbar buttons on one line ---- */
${X} #SearchPanel { padding: 4px; background: #ece9d8; border-bottom: 1px solid #aca899; }
${X} #SearchPanel > table { width: 100%; border-spacing: 0; }
${X} #SearchPanel > table > tbody > tr > td { height: auto; padding: 0; vertical-align: middle; }
${X} #SearchPanel > table > tbody > tr > td:first-child { width: 100%; }
${X} #SearchPanel > table > tbody > tr > td > div { float: none !important; padding: 0 0 0 2px !important; }
${X} #SearchPanel .scElementHover { width: auto; height: auto; padding: 0; border: 0; background: none; }
${X} #TreeSearch { width: 100%; }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) {
  display: block;
  box-sizing: border-box;
  width: 21px;
  height: 21px;
  padding: 1px;
  border: 1px solid transparent;
  border-radius: 3px;
}
${X} :is(a.scSearchButton, a.scSearchOptionsButton):hover { ${toolHot} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton):active { ${toolDown} }
${X} :is(a.scSearchButton, a.scSearchOptionsButton) img { display: block; width: 16px; height: 16px; margin: 0; padding: 0; }
${X} a.scSearchOptionsButton img { ${paint(art(TRI_DOWN))} }
${X} #SearchOptionsList td { height: auto; padding: 2px 0; vertical-align: middle; }
${X} #TreeSearchOptions .scElementHover { padding: 0 4px 0 0; border: 0; background: none; }
${X} .scSearchAddCriteriaInput { padding-top: 2px; }
${X} :is(a.scSearchOptionName, a.scSearchAddCriteria) { display: flex; align-items: center; gap: 4px; padding: 0; color: #0033cc; font: 11px ${FONT}; }
${X} a.scSearchOptionName img.arrowDown { ${paint(art(TRI_DOWN))} }

/* ---- Language, version and navigator drop-downs above the editor: XP toolbar buttons ---- */
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
  font: 11px/20px ${FONT};
}
${X} .scEditorTabControls a.scEditorHeaderButton:hover { ${toolHot} }
${X} .scEditorTabControls a.scEditorHeaderButton:active { ${toolDown} }
${X} .scEditorTabControls a.scEditorHeaderButton img { margin: 0; }
${X} .scEditorTabControls a.scEditorHeaderButton span { display: inline-flex; align-items: center; gap: 4px; }

/* ---- Menus: XP's white menu, a #aca899 frame with a soft shadow, the Luna selection ---- */
${X} .scPopup:not(:has(> .scStartMenu)), ${X} .scMenu:not(.scPopup > .scMenu) {
  padding: 2px;
  background: #fff;
  border: 1px solid #aca899;
  border-radius: 0;
  box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.3);
}
${X} .scPopup > .scMenu { padding: 0; background: transparent; border: 0; box-shadow: none; }
${X} .scMenu td {
  height: auto;
  padding: 3px 4px;
  background: transparent;
  color: #000;
  font: 11px ${FONT};
  line-height: 16px;
}
${X} .scMenu :is(.scMenuItemIcon, .scMenuItemIcon_Hover, .scMenuItemIcon_Disabled) { width: 16px; padding: 2px 2px 2px 4px; }
${X} .scMenu :is(.scMenuItemCaption, .scMenuItemCaption_Hover, .scMenuItemCaption_Disabled) { padding: 2px 16px 2px 4px; }
${X} .scMenu :is(.scMenuItemHotkey, .scMenuItemHotkey_Hover, .scMenuItemHotkey_Disabled) { padding: 2px 6px 2px 4px; text-align: right; }
${X} .scMenu :is(.scMenuItemIcon_Hover, .scMenuItemCaption_Hover, .scMenuItemHotkey_Hover, .scMenuPanelItem_Hover, .scMenuPanelItemSelected_Hover) { ${SEL} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):hover * { ${SEL} }
${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover, ${X} .scMenu :is(.scGalleryMenuItem, tr:not([class]):has(> .scMenuItemIcon)):has(.scMenuItemCaption_Disabled):hover * { background: transparent; color: #aca899; }
${X} .scMenu :focus-visible, ${X} .scMenu:focus-visible { outline: 1px dotted #000; outline-offset: -1px; }
${X} iframe.scGalleryFrame { border: 1px solid #aca899; border-radius: 0; box-shadow: 2px 2px 3px rgba(0, 0, 0, 0.3); }
${X} .scMenu :is(.scMenuItemIcon_Disabled, .scMenuItemCaption_Disabled, .scMenuItemHotkey_Disabled) { color: #aca899; }
${X} .scMenu .scMenuItemIcon_Disabled > img { opacity: 0.5; }
${X} .scMenu img[src*="submenu16x16" i] { ${paint(art(TRI_RIGHT))} }
${X} .scMenu :is(.scMenuItemHotkey_Hover, .scMenuItemCaption_Hover) img[src*="submenu16x16" i] { filter: ${V("sel-glyph")}; }
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) {
  height: 7px;
  padding: 0;
  border: 0;
  background: linear-gradient(transparent 3px, #aca899 3px 4px, transparent 4px);
  font-size: 0;
  line-height: 0;
}
${X} .scMenu :is(.scMenuDividerIcon, .scMenuDividerCaption, .scMenuDividerHotkey) img { display: none; }
${X} .scMenuHeader { padding: 4px 6px; color: #000; font: bold 11px ${FONT}; }

/* ---- Dialog tab panes: the open tab joins a #fcfcfe page framed in #919b9c ---- */
${X} .scTabstrip { box-sizing: border-box; height: 22px; background: transparent; }
${X} .scTabstripContainer > .scTabs { top: 22px; left: -1px; background: #fcfcfe; border: 1px solid #919b9c; border-top: 0; box-shadow: none; }
${X} .scTabs .scTabPage .scScrollbox { background: #fff; ${field} }
${X} .scTabs > .scTabPage { border-color: transparent; }

/* ---- Ribbon galleries (Home > Insert, Security > Presets): rows of a list, the Luna selection ---- */
${X} .scRibbonGalleryList > a:is(:hover, :active) { ${SEL} border-color: transparent; box-shadow: none; }
${X} .scRibbonGalleryList > a:is(:hover, :active) * { color: ${V("sel-fg")}; }

/* The ribbon's fold button: the task pane's round chevron */
${X} a.scRibbonClose { background: ${roundChevron("dup")}; }
${X} a.scRibbonOpen { background: ${roundChevron("ddown")}; }
${X} :is(a.scRibbonClose, a.scRibbonOpen)::before { content: none; }

/* ---- Bucket search: one white field holding the filter tokens and the Clear and Search buttons ---- */
${X} .search-box { border-radius: 0; ${field} }
${X} .search-box :is(.sb_down, .sb_up) { border: 0; border-right: 1px solid #7f9db9; border-radius: 0; }
${X} .search-box .sb_down { background: var(--sct-xp-down), ${scrollFace("90deg")}; }
${X} .search-box .sb_up { background: var(--sct-xp-up), ${scrollFace("90deg")}; }
${X} .search-box #raw-user-input { border: 0; box-shadow: none; background: transparent; }
${X} .filters .filter { border: 1px solid #7f9db9; border-radius: 3px; background: #d6dff7; color: #000; }
${X} .clear-search-box :is(.btn-clear, .btn-search) { ${push} }
${X} .clear-search-box .btn-clear { background: url("/sitecore/shell/Applications/Buckets/images/clear.png") center no-repeat, linear-gradient(#fff, #ecebe6 85%, #d6d0c5); }
${X} .clear-search-box .btn-search { background: url("/sitecore/shell/Applications/Buckets/images/edition-magnifier.png") center no-repeat, linear-gradient(#fff, #ecebe6 85%, #d6d0c5); }
${X} .clear-search-box :is(.btn-clear, .btn-search):hover { ${pushHot} }

${X} .scWorkboxWindowCaption:not([data-sct-window-title] *) { background: #ece9d8; }

/* SPEAK pages served in the shell (SPE Reports): XP's toolbar under the caption, as on SPEAK pages */
${appHeader(X)}
${X} .sc-applicationHeader-row1 { background-image: none; }
/* jQuery UI's highlight box (the ISE's tip of the session): XP's yellow info balloon */
${X} .ui-state-highlight { border: 1px solid #000; border-radius: 3px; background: #ffffe1; color: #000; }
${X} .ui-state-highlight :is(p, b, span, a, div) { color: #000; }
${X} .ui-state-highlight a { color: #0033cc; }

/* ---- Desktop windows: each is an iframe, so XP's frame is drawn outside it as rings ---- */
/* XP's frame is the iframe's own 4px border on the sides and bottom, see-through to the iframe's background:
   the caption's gradient, laid from the border's outer edge so it runs across the frame unbroken, down to the caption's height, the frame's blue below. So the frame beside the caption
   is caption, and the window has one rounded corner, the iframe's own; a 1px dark line runs round it all. */
${X} #Desktop > iframe:not([style*="width: 100%"]) { border: 4px solid transparent; border-top: 0; border-radius: 8px 8px 0 0; background: ${V("cap")} top / 100% 28px no-repeat border-box, ${V("frame")}; box-shadow: 0 0 0 1px ${V("frame-line")}, 2px 3px 8px 4px rgba(0, 0, 0, 0.3); }
${X} #Desktop > iframe[data-sct-window="inactive"]:not([style*="width: 100%"]) { background: ${V("cap-in")} top / 100% 28px no-repeat border-box, ${V("frame-in")}; box-shadow: 0 0 0 1px ${V("frame-in-line")}, 2px 3px 8px 4px rgba(0, 0, 0, 0.2); }
/* inside a Desktop window the caption runs to the frame: no 1px window border, no inner rounding */
${X}[data-sct-window-title] :is(.scWindowFrame, .scWindowBorder1, .scWindowBorder2) { border-width: 0; }
/* At 125% the window's right edge falls mid-pixel, and that pixel blends every layer under the caption: the body's
   white, the form's and the Content Editor's caption block's greige made a pale line between the caption and the
   frame. Every element the caption sits in carries the caption's strip too. */
${X}[data-sct-window-title], ${X}[data-sct-window-title] :has(:is(#CaptionTopLine, .standardWindowCaption, .scWorkboxWindowCaption)) { background-image: ${V("cap")}; background-size: 100% 28px; background-repeat: no-repeat; }
${PI}:not(#sct-xp)[data-sct-window-title], ${PI}:not(#sct-xp)[data-sct-window-title] :has(:is(#CaptionTopLine, .standardWindowCaption, .scWorkboxWindowCaption)) { background-image: ${V("cap-in")}; }
/* An element's own colour still bleeds under its strip. Around the Content Editor's caption (white, greige, and an
   inline #f7f7f7 the live map paints with !important) the colour is the window face, laid from the caption's foot
   down. */
${X}[data-sct-window-title] :has(#CaptionTopLine) { background-color: transparent !important; background-image: ${V("cap")}, linear-gradient(transparent 28px, #ece9d8 0); background-size: 100% 28px, auto; }
${PI}:not(#sct-xp)[data-sct-window-title] :has(#CaptionTopLine) { background-image: ${V("cap-in")}, linear-gradient(transparent 28px, #ece9d8 0); }
${X}[data-sct-window-title] :is(.standardWindowCaption, .scWindowBorder2 > .scCaption > #CaptionTopLine, .scWorkboxWindowCaption) { border-radius: 0; }

`;

// ==== SPEAK pages (speak and launchpad areas) ====
// band: the header's height inside its bottom border (SPEAK pages 49px, Launchpad 47px).
const speakCommon = (S, band = 49) => {
  const SX = `${S}:not(#sct-xp)`;
  return `${schemeVars(S)}
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
${SX} :is(input:is([type="text"], [type="password"], [type="search"], [type="number"], [type="email"], [type="url"], :not([type])), select:not([multiple], [size]:not([size="0"], [size="1"])), .form-control) {
  box-sizing: border-box;
  height: 21px;
  min-height: 0;
  padding: 0 3px;
  font: 11px/19px ${FONT};
  ${field}
}
${SX} select:not([multiple], [size]:not([size="0"], [size="1"])) { appearance: none; padding-right: 20px; background: ${comboBtn}, #fff; }
${SX} textarea { border-radius: 0; ${field} }
${SX} :is(input, select, textarea, .form-control):focus { outline: none; box-shadow: none; border-color: #316ac5; }
${SX} input[type="checkbox"], ${SX} input[type="radio"] {
  appearance: none;
  box-sizing: border-box;
  width: 13px;
  height: 13px;
  margin: 0 4px 0 0;
  vertical-align: -2px;
  border: 1px solid #1c5180;
  border-radius: 0;
  outline: none;
  background: linear-gradient(135deg, #dcdcd7, #fff 75%);
}
${SX} input[type="radio"] { border-radius: 50%; }
${SX} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcd7, #fff 75%); }
${SX} input[type="radio"]:checked { background: radial-gradient(circle, #55d551 0, #21a121 2.5px, transparent 3.2px), linear-gradient(135deg, #dcdcd7, #fff 75%); }
${SX} .btn {
  height: 23px;
  min-width: 75px;
  padding: 0 10px;
  font: 11px/21px ${FONT};
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

// An XP task pane group: the white-to-blue header with a bold blue title, a light blue body.
const taskPane = (root, title, body) => `${root} { box-sizing: border-box; margin: 0 0 12px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
${title} {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 25px;
  margin: 0;
  padding: 0 4px 0 12px;
  ${paneHead}
  text-transform: none;
  white-space: nowrap;
}
${body} { box-sizing: border-box; margin: 0; padding: 8px 12px; border: 1px solid #fff; border-top: 0; border-radius: 0; background: ${V("pane-body")}; box-shadow: none; }`;

const SP = SURFACE("speak"), SPX = `${SP}:not(#sct-xp)`;
const EE = `${SPX} .sc-pageeditbar`;
const speak = `/* Whistler: SPEAK pages and the Experience Editor ribbon. Generated by tools/build-whistler-css.cjs. */
${speakCommon(SP)}
/* ==== Experience Editor ribbon: the SPEAK ribbon dressed as the Content Editor's XP ribbon ==== */
${EE} { color: #000; font: 11px ${FONT}; }
${EE} .sc-quickbar {
  display: flex;
  align-items: flex-end;
  height: auto;
  padding: 5px 4px 0;
  border: 0;
  background: #ece9d8;
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
${EE} .sc-quickbar-button:not(.disabled):hover { ${toolHot} }
${EE} .sc-quickbar-button:not(.disabled):active { ${toolDown} }
${EE} .sc-quickbar-button.disabled { opacity: 0.45; }
${EE} .sc-quickbar-button[data-sc-id="QuickRibbon"] { order: 1; margin-left: auto; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down) { float: none; margin: 0; background: none; mask: none; }
${EE} .sc-quickbar-button :is(.navigate_up, .navigate_down)::before { content: ""; display: block; width: 19px; height: 19px; }
${EE} .sc-quickbar-button .navigate_up::before { background: ${roundChevron("dup")}; }
${EE} .sc-quickbar-button .navigate_down::before { background: ${roundChevron("ddown")}; }
${EE} .sc-quickbar-button[data-sc-id="QuickInsert-Component"] { margin-right: 8px; }
${EE} .sc-quickbar-tab, ${EE} .sc-quickbar-tab:hover {
  ${tab}
  position: relative;
  height: auto;
  padding: 0 10px;
  margin: 0 0 0 -1px;
  font: 11px/19px ${FONT};
  text-decoration: none;
}
${EE} .sc-quickbar-tab:not(.sc-quickbar-tab-selected):hover { ${tabHot} }
${EE} .sc-quickbar-item:focus { outline: none; }
${EE} .sc-quickbar-item:focus-visible { outline: 1px dotted #000; outline-offset: -3px; }
${EE} .sc-quickbar-tab.sc-quickbar-tab-selected { ${tabOpen} z-index: 1; margin-bottom: -1px; padding-bottom: 2px; }

${EE} .sc-ribbon { background: linear-gradient(#fcfcfe, #f4f3ee); border: 0; border-top: 1px solid #919b9c; border-bottom: 1px solid #919b9c; box-shadow: none; }
${EE} .sc-strip { min-height: 0; padding: 0 0 0 1px; }
${EE} .sc-chunk {
  float: left;
  height: auto;
  margin: 3px 2px 3px 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-right: 1px solid #d5d2c1;
  border-radius: 0;
  box-shadow: 1px 0 #fff;
}
${EE} .sc-chunk::before, ${EE} .sc-chunk::after { content: none; }
/* As tight as the Content Editor's: 46px buttons 3px below the chunk's top, 4px from its sides, clear of the caption */
${EE} :is(.sc-chunk-button-list, .sc-chunk-check-list) { display: flow-root; box-sizing: border-box; height: 50px; min-height: 0; margin: 0; padding: 3px 4px 0; }
${EE} .sc-chunk-label { height: 18px; margin: 0; padding: 0 6px; color: #444; font: 11px/18px ${FONT}; text-align: center; text-transform: none; }
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
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small, .sc-chunk-check-small):not(.disabled):hover { ${toolHot} }
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small):not(.disabled):active,
${EE} :is(.sc-chunk-button, .sc-chunk-button-dropdown, .sc-chunk-gallerybutton, .sc-chunk-button-small).pressed { ${toolDown} }
${EE} .disabled .sc-chunk-button-label, ${EE} .disabled.sc-chunk-check-small .sc-chunk-check-small-label { color: #aca899; }
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

/* The item path under the ribbon: XP's address bar */
${EE} .sc-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 30px;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  background: #ece9d8;
  border: 0;
  border-top: 1px solid #fff;
  border-bottom: 1px solid #aca899;
  box-shadow: none;
}
${EE} .sc-breadcrumb-item { display: flex; align-items: center; gap: 4px; float: none; height: auto; margin: 0; padding: 0; }
${EE} .sc-breadcrumb-item > * { margin-top: 0; margin-bottom: 0; }
${EE} .sc-breadcrumb-item-path { color: #000; font: 11px ${FONT}; text-decoration: none; }
${EE} .sc-breadcrumb-item-path:hover { color: #0033cc; text-decoration: underline; }
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
${EE} :is(.sc-breadcrumb-item-button, .sc-breadcrumb-item-action):hover { ${toolHot} }
${EE} .sc-breadcrumb-item-action .separator_7 { background: ${art(TRI_RIGHT)}; }
${EE} .sc-breadcrumb .scContentButton { display: block; height: auto; padding: 0; margin: 0 0 0 4px; }
${EE} .sc-breadcrumb .btn.sc-button { height: 22px; min-width: 60px; padding: 0 10px; line-height: 20px; }

/* ==== Control Panel: XP's Control Panel, task pane groups on the window face ==== */
${SPX} body:has(.sc-controlpanel-box), ${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { background: #fff; }
${SPX} body:has(.sc-controlpanel-box) .sc-applicationContent { min-height: 100vh; }
/* every SPEAK application's header (Control Panel, SPE Reports, Forms): XP's toolbar under the caption */
${appHeader(SPX)}
${SPX} .sc-applicationHeader-row1 { background-image: none; }
${SPX} .sc-applicationContent-main { background: none; }
${SPX} .sc-controlpanel-box { margin-top: 16px; }
${taskPane(`${SPX} .sc-controlpanel-box`, `${SPX} .sc-controlpanel-box-header h4`, `${SPX} .sc-controlpanel-box-content`)}
${SPX} .sc-controlpanel-box-header { margin: 0; padding: 0; color: ${V("pane-fg")}; text-transform: none; }
${SPX} .sc-controlpanel-box-header h4 img { flex: none; width: 16px; height: 16px; margin: 0 6px 0 0; }
${SPX} .sc-controlpanel-box-content li { height: auto; padding: 0; border: 0; }
${SPX} .sc-controlpanel-box-content li a { display: block; padding: 2px 0; color: #0c32a4; font: 11px/16px ${FONT}; text-decoration: none; }
${SPX} .sc-controlpanel-box-content li a:is(:hover, :focus) { color: #2d6ff7; text-decoration: underline; background: transparent; }
${SPX} .sc-controlpanel-no-items { color: #555; }

/* ==== Forms: the selected navigation entry and tab sit on the Luna selection ==== */
${SPX} .header.menuItem :is(a, span) { color: ${V("sel-fg")}; }
${SPX} .sc-tab-control-tab-item.selected :is(a, span) { color: ${V("sel-fg")}; }
`;

// ==== Launchpad: an Explorer window. The header is the caption; the left column is the blue task pane
// (the analytics message as a Details pane); the right column shows the groups in Tiles view. A pane or
// group collapses from its header (dom.js).
const LP = SURFACE("launchpad"), LPX = `${LP}:not(#sct-xp)`;
const TP = 232; // the task pane's width
const launchpad = `/* Whistler: Launchpad. Generated by tools/build-whistler-css.cjs.
   An Explorer window: the blue task pane on the left, the applications in Tiles view, shown in groups. */
${speakCommon(LP, 47)}
${LPX} body, ${LPX} .sc-applicationContent { background: #fff; }
${LPX} .sc-applicationContent { min-height: 100vh; padding: 0; }
${LPX} .sc-applicationContent-main { min-width: 0; margin: 0; padding: 0; background: none; }
${LPX} .sc-applicationContent-main > .row { margin: 0; }
/* The page title sits in the caption, after the logo */
${LPX} .sc-applicationHeader { border: 0; background: none; box-shadow: none; }
${LPX} .sc-applicationHeader-row1 { border: 0; }
${LPX} .sc-applicationHeader-row1.no-breadcrumb .sc-applicationHeader-title { display: flex; align-items: center; top: 0; left: 44px; box-sizing: border-box; height: 47px; padding: 0 8px; background: transparent; }
${LPX} .sc-applicationHeader-title, ${LPX} .sc-applicationHeader-title .sc-text { ${capText} line-height: 24px; }
/* the title's dark icon, white on Blue's caption */
${LPX} .sc-applicationHeader-title::before { flex: none; filter: ${V("cap-logo")}; }
${LPX} [data-sc-id="ColumnPanel1"] {
  display: grid;
  grid-template-columns: ${TP}px minmax(0, 1fr);
  align-items: start;
  column-gap: 0;
  box-sizing: border-box;
  width: auto;
  grid-template-rows: auto auto auto 1fr;
  min-height: calc(100vh - 48px);
  margin: 0;
  padding: 0;
  float: none;
  background: ${PANE_BG} 0 0 / ${TP}px 100% no-repeat, #fff;
}
/* the task pane: the analytics message as a Details pane */
${LPX} :is([data-sc-id="CustomAnalyticsLabel"], [data-sc-id="FallBackMessageBorder"], [data-sc-id="RowPanelTilesWrapper"]) { grid-column: 1; float: none; width: auto; margin: 0 12px; }
${LPX} [data-sc-id="CustomAnalyticsLabel"] { grid-row: 1; margin-top: 12px; }
${LPX} [data-sc-id="FallBackMessageBorder"] { grid-row: 2; }
${LPX} [data-sc-id="RowPanelTilesWrapper"] { grid-row: 3; }
${taskPane(`${LPX} .sc-border[data-sc-id="FallBackMessageBorder"]`, `${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]`, `${LPX} .sc-border[data-sc-id="FallBackMessageBorder"]`)}
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"] { position: static; margin: 12px 12px 0; cursor: pointer; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] { margin: 0 12px 12px; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]::after { content: ""; flex: none; width: 19px; height: 19px; margin-left: auto; background: ${roundChevron("dup")}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"]:hover { color: ${V("pane-hot")}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"]::after { background: ${roundChevron("ddown")}; }
${LPX} .sc-text[data-sc-id="CustomAnalyticsLabel"][data-sct-collapsed="1"] + .sc-border { display: none; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] :is(.row, [class*="col-"]) { float: none; width: auto; margin: 0; padding: 0; }
${LPX} .sc-border[data-sc-id="FallBackMessageBorder"] .sc-border { min-height: 0; border: 0; background: none; box-shadow: none; }
${LPX} .sc-text[data-sc-id="FallBackMessage"] { position: static; display: block; padding: 0; color: #000; font: 11px/15px ${FONT}; text-align: left; }

/* the content pane: Tiles view, shown in groups */
${LPX} .sc-launchpad {
  grid-column: 2;
  grid-row: 1 / 5;
  display: block;
  max-width: none;
  margin: 0;
  padding: 10px 16px;
  float: none;
}
${LPX} .sc-launchpad-group {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 4px 12px;
  box-sizing: border-box;
  width: auto;
  min-width: 0;
  margin: 0 0 14px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: none;
}
${LPX} .sc-launchpad-group-title {
  flex: 0 0 100%;
  box-sizing: border-box;
  height: 22px;
  margin: 0 0 4px;
  padding: 0 0 0 2px;
  border: 0;
  background: ${V("group-line")} left bottom / 100% 1px no-repeat;
  color: ${V("group-fg")};
  font: bold 11px/20px ${FONT};
  text-transform: none;
  cursor: pointer;
}
${LPX} .sc-launchpad-group-title::after { content: ""; display: inline-block; width: 9px; height: 6px; margin: 0 0 1px 6px; background: var(--sct-xp-group-up); vertical-align: middle; }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-group-title::after { background: var(--sct-xp-group-down); }
${LPX} .sc-launchpad-group[data-sct-collapsed="1"] > .sc-launchpad-item { display: none; }
${LPX} .sc-launchpad-group-title:hover { color: ${V("pane-hot")}; }
/* a tile: the 48px icon, the name and, below it in grey, where it opens */
${LPX} .sc-launchpad-item {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 236px;
  height: 58px;
  margin: 0;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: #000;
  text-align: left;
  text-decoration: none;
}
${LPX} .sc-launchpad-item .icon { flex: none; width: 48px; height: 48px; margin: 0; border-radius: 0; background: none; }
${LPX} .sc-launchpad-item .icon img { display: block; width: 48px; height: 48px; margin: 0; }
${LPX} .sc-launchpad-item .sc-launchpad-text { display: block; float: none; max-width: none; padding: 1px 2px; overflow: visible; color: #000; font: 11px/14px ${FONT}; white-space: normal; text-align: left; }
${LPX} .sc-launchpad-item .sc-launchpad-text::after { content: "Application"; display: block; color: #6d6d6d; }
${LPX} .sc-launchpad-item:hover { background: none; box-shadow: none; text-decoration: none; }
${LPX} .sc-launchpad-item:hover .sc-launchpad-text { color: #0033cc; text-decoration: underline; }
${LPX} .sc-launchpad-item:is(:focus, :active) { outline: none; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .sc-launchpad-text { ${SEL} text-decoration: none; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .sc-launchpad-text::after { color: ${V("sel-fg")}; }
${LPX} .sc-launchpad-item:is(:focus-visible, :active) .icon img { filter: sepia(1) hue-rotate(180deg) saturate(3) brightness(0.8); }
`;

// ==== Login: XP's Welcome screen. Blue bands top and bottom with an orange and a light rule, the logo
// and a hint left of the vertical divider, the sign-in form as the user's tile on the right.
const LG = SURFACE("login");
const login = `/* Whistler: Identity Server login. Generated by tools/build-whistler-css.cjs.
   Windows XP's Welcome screen. */
${LG} body {
  min-height: 100vh;
  margin: 0;
  background:
    linear-gradient(#00309c, #00309c) top / 100% 78px no-repeat,
    linear-gradient(90deg, transparent, #e7a65b 30%, #e7a65b 70%, transparent) 0 78px / 100% 2px no-repeat,
    linear-gradient(90deg, transparent, #f1b46b 15% 85%, transparent) 0 calc(100% - 92px) / 100% 2px no-repeat,
    linear-gradient(#003399, #003399) bottom / 100% 92px no-repeat,
    radial-gradient(ellipse 60% 55% at 22% 32%, #7aa1e6, transparent 70%),
    #5a7edc;
  color: #fff;
  font: 11px ${FONT};
}
${LG} .top { position: absolute; top: 0; right: 0; z-index: 1; height: auto; padding: 30px 20px; border: 0; background: transparent; box-shadow: none; color: #fff; font: 11px ${FONT}; }
${LG} .top a { color: #fff; }
${LG} .main-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: transparent; }
${LG} .main {
  display: grid;
  grid-template-columns: 1fr 2px 1fr;
  align-items: center;
  column-gap: 32px;
  box-sizing: border-box;
  width: min(760px, 100% - 32px);
  margin: 0 auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: linear-gradient(transparent, rgba(255, 255, 255, 0.8) 30% 70%, transparent) center / 2px 100% no-repeat;
  box-shadow: none;
  color: #fff;
}
${LG} .main::before { content: none; }
${LG} .logo-wrap { grid-column: 1; margin: 0; text-align: right; }
${LG} .logo-wrap img { max-width: 220px; height: auto; }
${LG} .logo-wrap::after { content: "To begin, enter your user name and password"; display: block; margin-top: 18px; color: #fff; font: 14px ${CAPFONT}; }
${LG} .login-page { grid-column: 3; margin: 0; padding: 14px 16px; border-radius: 8px; background: linear-gradient(90deg, #0d3b9e, rgba(13, 59, 158, 0)); }
${LG} .login-page fieldset { margin: 0; padding: 0; border: 0; }
${LG} .login-page .form-group { margin: 0 0 8px; color: #fff; }
${LG} label { color: #fff; font: bold 11px ${FONT}; }
${LG} .form-control {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 21px;
  margin: 2px 0 6px;
  padding: 0 3px;
  font: 11px/19px ${FONT};
  ${field}
}
${LG} .form-control:focus { outline: none; border-color: #fff; box-shadow: 0 0 0 1px #f8b330; }
${LG} .form-control::placeholder { color: #6d6d6d; }
${LG} .btn.btn-primary {
  box-sizing: border-box;
  display: block;
  width: auto;
  min-width: 75px;
  height: 23px;
  margin-left: auto;
  padding: 0 10px 0 28px;
  border: 1px solid #fff;
  border-radius: 3px;
  background: ${art(GO, [8, 8])}, linear-gradient(135deg, #7fd36a, #3c9c3c 50%, #2d7f2d);
  color: #fff;
  font: bold 11px/21px ${FONT};
  text-shadow: 1px 1px #1a4d1a;
  text-transform: none;
  box-shadow: none;
}
${LG} .btn.btn-primary:is(:hover, :focus) { background-color: #3c9c3c; filter: brightness(1.1); color: #fff; }
${LG} .btn.btn-primary:active { filter: brightness(0.9); }
${LG} .btn.btn-primary:focus-visible { outline: 1px dotted #fff; outline-offset: 2px; }
${LG} input[type="checkbox"] { appearance: none; box-sizing: border-box; width: 13px; height: 13px; margin: 0 4px 0 0; vertical-align: -2px; border: 1px solid #1c5180; border-radius: 0; background: linear-gradient(135deg, #dcdcd7, #fff 75%); }
${LG} input[type="checkbox"]:checked { background: ${art(CHECK)}, linear-gradient(135deg, #dcdcd7, #fff 75%); }
${LG} .remember-me { display: inline-flex; align-items: center; padding: 0; color: #fff; font: 11px ${FONT}; }
${LG} .remember-me input[type="checkbox"] { position: static; flex: none; }
${LG} a, ${LG} .forgot-password { color: #fff; font: 11px ${FONT}; }
${LG} :is(.text-danger, .validation-summary-errors, .field-validation-error) { color: #ffe08a; }
`;

const dir = path.join(__dirname, "..", "extension", "themes", ID);
for (const [name, text] of Object.entries({ shell: css, speak, launchpad, login })) {
  fs.writeFileSync(path.join(dir, `${name}.css`), pixelate(text));
  console.log(`${name}.css: ${(text.length / 1024).toFixed(1)} KB`);
}
