// A site's own settings, the same in the extension's popup and the Sitecore module's panel: the title postfix, the
// icon tint, light or dark for themes with both looks, and the accessibility aids. The markup is here, so both draw
// the same controls; each host passes a store for where the values live:
//   get(kind)         the saved value (or a Promise of it): title, tint, mode, accessibility
//   set(kind, value)  saves it (a Promise); "" (or null for accessibility) is the plain choice: no postfix, no
//                     tint, System, no aids
// No extension APIs: the Sitecore module bundles this file.
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const MODE_HTML = `<div id="mode" class="seg icons" role="radiogroup" aria-label="Light or dark, for themes with both looks" hidden>
  <label title="System"><input type="radio" name="mode" value="" aria-label="System"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 13.75h5M8 11.5v2.25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></label>
  <label title="Light"><input type="radio" name="mode" value="light" aria-label="Light"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.75" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></label>
  <label title="Dark"><input type="radio" name="mode" value="dark" aria-label="Dark"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></label>
</div>`;

  const GEAR_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M10.3 2.8h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.8c.1.6.1 1.3 0 1.9l2 1.8-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.8c-.1-.6-.1-1.3 0-1.9l-2-1.8 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  const BACK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg>`;

  const TITLE_HTML = `<div class="panel">
  <div class="row">
    <div class="label"><label for="title-postfix">Title postfix</label><small id="postfix-hint">In the tab and Sitecore's top bar</small></div>
    <input id="title-postfix" type="text" maxlength="40" placeholder="e.g. [DEV 10.5]" autocomplete="off" aria-describedby="postfix-hint">
  </div>
  <div class="row">
    <div class="label"><span id="tint-label">Icon tint</span>
      <span class="warn" tabindex="0" role="img" title="Some sites block custom tab icons. On those, the usual icon stays." aria-label="Some sites block custom tab icons. On those, the usual icon stays.">&#x26A0;&#xFE0E;</span></div>
    <div id="tint" class="seg" role="radiogroup" aria-labelledby="tint-label">
      <label><input type="radio" name="tint" value="">Off</label>
      <label><input type="radio" name="tint" value="theme">Theme</label>
      <label><input type="radio" name="tint" value="color">Colour</label>
    </div>
  </div>
  <div class="row sub">
    <div id="tint-swatches"></div>
    <input type="range" id="tint-hue" class="hue" min="0" max="359" step="1" value="4" aria-label="Tint hue">
  </div>
</div>`;

  const ACCESS_HTML = `<div class="panel">
  <div class="row">
    <div class="label"><span id="font-label">Font</span><small>Letters that are easier to tell apart</small></div>
    <div id="font" class="seg" role="radiogroup" aria-labelledby="font-label">
      <label><input type="radio" name="font" value="">Theme</label>
      <label><input type="radio" name="font" value="hyperlegible">Hyperlegible</label>
      <label><input type="radio" name="font" value="opendyslexic">OpenDyslexic</label>
    </div>
  </div>
  <div class="row">
    <div class="label"><span id="spacing-label">Spacing</span><small>Between letters and words</small></div>
    <div id="spacing" class="seg" role="radiogroup" aria-labelledby="spacing-label">
      <label><input type="radio" name="spacing" value="">Normal</label>
      <label><input type="radio" name="spacing" value="wide">Wide</label>
    </div>
  </div>
  <div class="row">
    <div class="label"><span id="vision-label">Colour filter</span><small id="vision-hint">Moves colours you can't tell apart into ones you can</small></div>
  </div>
  <div class="row sub">
    <div id="vision" class="seg" role="radiogroup" aria-labelledby="vision-label" aria-describedby="vision-hint">
      <label><input type="radio" name="vision" value="">Off</label>
      <label title="Red-blind"><input type="radio" name="vision" value="protanopia">Protanopia</label>
      <label title="Green-blind"><input type="radio" name="vision" value="deuteranopia">Deuteranopia</label>
      <label title="Blue-blind"><input type="radio" name="vision" value="tritanopia">Tritanopia</label>
    </div>
  </div>
  <div class="row sub" id="strength-row" hidden>
    <label for="strength">Strength</label>
    <input type="range" id="strength" class="hue" min="1" max="100" step="1" value="100">
    <output id="strength-value" for="strength">100%</output>
  </div>
</div>`;

  // The tab icon keeps its own light and shade and takes only the tint's hue and saturation (lib/engine.js
  // drawIcon), so the tint is a hue at one saturation and lightness, or grey for a colourless icon. Saved as #rrggbb.
  const tintHex = (h, s = 0.75, l = 0.48) => {
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return Math.round((l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  // the hue of a saved colour (any colour an older picker saved), null for a grey
  function hexHue(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    if (d < 0.04) return null;
    const h = max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round((h * 60 + 360) % 360);
  }
  const TINT_GREY = "#7a7a7a";
  const TINT_SWATCHES = [...[4, 30, 48, 130, 188, 210, 255, 335].map((h) => tintHex(h)), TINT_GREY];

  // saved on every keystroke: the popup can close before a change event fires
  async function mountTitle(r, store) {
    const input = r.querySelector("#title-postfix");
    input.value = (await store.get("title")) || "";
    input.oninput = () => store.set("title", input.value.trim());
  }

  async function mountTint(r, store) {
    const range = r.querySelector("#tint-hue");
    SCT.picker.paintTrack(range, (d) => tintHex(d));
    const pick = (value) => (r.querySelector(`#tint input[value="${value}"]`).checked = true);
    const saved = (await store.get("tint")) || "";
    let colour = SCT.settings.tintColor(saved, null) || tintHex(+range.value);
    range.value = hexHue(colour) ?? range.value;
    pick(saved.startsWith("#") ? "color" : saved);

    const swatches = r.querySelector("#tint-swatches");
    const mark = () => {
      const on = r.querySelector("#tint input:checked").value === "color";
      for (const b of swatches.children) b.setAttribute("aria-pressed", String(on && b.value === colour));
    };
    const write = () => {
      const mode = r.querySelector("#tint input:checked").value;
      return store.set("tint", mode === "color" ? colour : mode);
    };
    const save = SCT.picker.throttled(write);
    const choose = (c) => {
      colour = c;
      pick("color");
      mark();
    };
    swatches.replaceChildren();
    for (const c of TINT_SWATCHES) {
      const b = (r.ownerDocument || r).createElement("button"); // r is a document or a shadow root
      b.value = c;
      b.style.background = c;
      b.title = c === TINT_GREY ? "Grey" : c;
      b.setAttribute("aria-label", c === TINT_GREY ? "Tint grey" : `Tint ${c}`);
      b.onclick = () => {
        if (c !== TINT_GREY) range.value = hexHue(c);
        choose(c);
        write();
      };
      swatches.append(b);
    }
    mark();
    range.oninput = () => (choose(tintHex(+range.value)), save());
    r.querySelector("#tint").onchange = () => (mark(), write());
    range.onchange = write; // the slider's release: the popup can close before the throttled save
  }

  // Light or Dark for themes that follow the OS; "" is System
  async function mountMode(r, store) {
    const box = r.querySelector("#mode");
    const saved = (await store.get("mode")) || "";
    (box.querySelector(`input[value="${saved}"]`) || box.querySelector("input")).checked = true;
    box.onchange = () => store.set("mode", box.querySelector("input:checked").value);
  }

  // reading font, spacing, and a colour filter with its strength, which shows while a filter is on; all off is null
  async function mountAccessibility(r, store) {
    const saved = SCT.settings.accessibility(await store.get("accessibility")) || {};
    const range = r.querySelector("#strength");
    range.value = saved.strength || 100;
    const pick = (n) => r.querySelector(`#${n} input:checked`).value || null;
    const show = () => {
      r.querySelector("#strength-row").hidden = !pick("vision");
      r.querySelector("#strength-value").textContent = `${range.value}%`;
    };
    const write = () => store.set("accessibility", SCT.settings.accessibility({ font: pick("font"), spacing: pick("spacing"), vision: pick("vision"), strength: +range.value }));
    for (const name of ["font", "spacing", "vision"]) {
      const box = r.querySelector(`#${name}`);
      box.querySelector(`input[value="${saved[name] || ""}"]`).checked = true;
      box.onchange = () => (show(), write());
    }
    const save = SCT.picker.throttled(write);
    range.oninput = () => (show(), save());
    range.onchange = write; // the slider's release: the popup can close before the throttled save
    show();
  }

  // every control r holds, wired to the store
  function mount(r, store) {
    return Promise.all([
      r.querySelector("#title-postfix") && mountTitle(r, store),
      r.querySelector("#tint") && mountTint(r, store),
      r.querySelector("#mode") && mountMode(r, store),
      r.querySelector("#font") && mountAccessibility(r, store),
    ]);
  }

  SCT.siteSettings = { MODE_HTML, GEAR_SVG, BACK_SVG, TITLE_HTML, ACCESS_HTML, mount };
})(globalThis);
