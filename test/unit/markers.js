// The validation gutter's colours (Sitecore's) and what a theme's shade of them must keep: the hue (an error red,
// a warning orange or amber), enough saturation to read as that hue, and 3:1 on what it sits on. Shared by
// tokens.test.js and hue.test.js (the tokens) and sct-verify's shots.cjs --field-states (the page as painted).
const markerStock = { warning: "#fbc200", error: "#ce130a" };

const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

// null when the colour keeps the state, else why it does not
function markerProblem(hex, state, bg) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = !d ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (state === "error" ? !(h >= 340 || h < 30) : !(h >= 25 && h <= 60)) return `hue ${h.toFixed(0)} is not ${state === "error" ? "a red (340-30)" : "an orange or amber (25-60)"}`;
  if (s < 0.4) return `saturation ${s.toFixed(2)} under 0.4 reads as grey`;
  const [hi, lo] = [luminance(hex), luminance(bg)].sort((x, y) => y - x);
  const ratio = (hi + 0.05) / (lo + 0.05);
  return ratio < 3 ? `${ratio.toFixed(2)}:1 on ${bg}, under 3:1` : null;
}

module.exports = { markerStock, markerProblem };
