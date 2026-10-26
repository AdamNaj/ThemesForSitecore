// Dev tool: draws the glyphs of the Sitecore 10.4 and 10.5 themes into extension/themes/<id>/glyphs.
// Sitecore's own image files are never copied into the extension: each glyph here is our own drawing of the same
// idea (a chevron, a cross, a toggle), sized and placed like the image it stands in for, so a page laid out for
// the stock image still lines up. tools/css-diff.mjs points its output at these files by name: a stock image
// `<name>.<ext>` the target install lacks becomes glyphs/<name>.svg, and an embedded image is looked up in EMBEDDED there.
// Run: node tools/build-sitecore-glyphs.mjs
import fs from "node:fs";
import path from "node:path";

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;
// Strokes in black at an opacity, so the glyph greys over whatever it sits on, as 10.5's do.
const line = (d, o, w = 1.5) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fill = (d, o) => `<path d="${d}" fill="#000" fill-opacity="${o}"/>`;
const dots = (pts, r, o) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000" fill-opacity="${o}"/>`).join("");

const cross = svg(19, 19, line("M5 5l9 9M14 5l-9 9", 0.72, 1.6));
const chevronDown = svg(19, 19, line("M6 7.5l3.5 3.5 3.5-3.5", 0.85, 1.6));
const magnifier = svg(22, 22, `<circle cx="8.5" cy="8.5" r="5.25" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>${line("M12.5 12.5l5 5", 0.55, 2)}`);
const back = (o) => svg(22, 22, line("M17.5 11h-13M10 5.5L4.5 11l5.5 5.5", o, 1.8));
const toggle = (track, knobX) => svg(34, 20, `<rect width="34" height="20" rx="10" fill="${track}"/><circle cx="${knobX}" cy="10" r="7.5" fill="#fff"/>`);
// Sitecore 10.4's SPEAK dialog buttons: 2px outlines, light grey and white on hover.
const maximize104 = (c) => svg(16, 16, `<rect x="1" y="1" width="14" height="14" fill="none" stroke="${c}" stroke-width="2"/>`);
const restore104 = (c) => svg(16, 16, `<path d="M6 5V1h9v9h-4" fill="none" stroke="${c}" stroke-width="2"/><rect x="1" y="6" width="9" height="9" fill="none" stroke="${c}" stroke-width="2"/>`);

const GLYPHS = {
  sitecore105: {
    accordion_down_grey: chevronDown,
    accordion_up_grey: svg(19, 19, line("M6 11l3.5-3.5L13 11", 0.85, 1.6)),
    back_button_arrow_left: back(0.55),
    back_button_arrow_left_dark: back(0.75),
    cancel_grey: cross,
    close_button_sprite_v2: cross,
    dialog_close_v2: cross,
    dialog_maximize_v2: svg(16, 16, line("M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9", 0.55, 1.25)),
    dialog_restore_v2: svg(16, 16, line("M9 3v4h4M9 7l4.5-4.5M7 13V9H3M7 9l-4.5 4.5", 0.55, 1.25)),
    "edition-magnifier-v2": magnifier,
    global_logo_v2: svg(32, 32, dots([10, 16, 22].flatMap((y) => [10, 16, 22].map((x) => [x, y])), 1.9, 0.66)),
    hamburgermenu_grey: svg(24, 24, fill("M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z", 0.5)),
    magnifying_glass_grey: magnifier,
    notebook_grey: svg(19, 20, `<rect x="3.75" y="2.75" width="11.5" height="14.5" rx="1" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.5"/>${fill("M6.5 3h3.5v6L8.25 7.6 6.5 9z", 0.55)}`),
    page_close_grey: svg(19, 19, line("M5 5l9 9M14 5l-9 9", 0.6, 1.4)),
    page_minimize_v2: svg(19, 19, fill("M4 8.75h11v1.5H4z", 0.55)),
    page_switcher_v2: svg(19, 19, fill("M5.5 8h8l-4 4z", 0.55)),
    ribbon_panel_dots: svg(14, 14, dots([[3.5, 7], [7, 7], [10.5, 7]], 1.1, 0.55)),
    ribbon_panel_down_grey: svg(14, 14, fill("M4.5 5.5h5L7 8.5z", 0.55)),
    ribbon_panel_up_grey: svg(14, 14, fill("M4.5 8.5h5L7 5.5z", 0.55)),
    ribbonchunkglyphgrey: svg(15, 14, `<rect x="2.5" y="1.5" width="10" height="11" rx="0.5" fill="none" stroke="#000" stroke-opacity="0.5"/>${line("M5.5 5l3.5 3.5M9.25 5.75v3h-3", 0.6, 1.2)}`),
    ribbondropdown_grey: svg(12, 12, line("M3.5 4.75L6 7.25l2.5-2.5", 0.85, 1.3)),
    switch_off: toggle("rgba(0,0,0,0.42)", 10),
    switch_on: toggle("#6e3dff", 24),
    treemenu_collapsed_grey: svg(16, 16, line("M6.5 4.5L10 8l-3.5 3.5", 0.5, 1.3)),
    treemenu_expanded_grey: svg(16, 16, line("M4.5 6.25L8 9.75l3.5-3.5", 0.35, 1.3)),
  },
  sitecore104: {
    speak_maximize: maximize104("#ccc"),
    speak_maximize_h: maximize104("#fff"),
    speak_restore: restore104("#ccc"),
    speak_restore_h: restore104("#fff"),
  },
};

for (const [id, glyphs] of Object.entries(GLYPHS)) {
  const dir = path.join("extension", "themes", id, "glyphs");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  for (const [name, text] of Object.entries(glyphs)) fs.writeFileSync(path.join(dir, `${name}.svg`), text);
}
