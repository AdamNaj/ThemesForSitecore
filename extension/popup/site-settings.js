// A site's own settings, the same in the extension's popup and the Sitecore module's panel: the title postfix, the
// icon tint, light or dark for themes with both looks, the accessibility aids, the UI improvements and the tuning. The markup is here, so both draw
// the same controls; each host passes a store for where the values live:
//   get(kind)         the saved value (or a Promise of it): title, tint, mode, accessibility, tuning
//   set(kind, value)  saves it (a Promise); "" (or null for accessibility and tuning) is the plain choice: no
//                     postfix, no tint, System, no aids, the theme's own colours
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
  <fieldset id="needs" class="row needs">
    <legend><span class="label">Needs<small>Each one switches on the aids that help with it</small></span></legend>
    <div class="chips">
      <label><input type="checkbox" name="need" value="screen-reader">Screen reader</label>
      <label><input type="checkbox" name="need" value="keyboard">Keyboard</label>
      <label><input type="checkbox" name="need" value="low-vision">Low vision</label>
      <label><input type="checkbox" name="need" value="colour-vision">Colour vision</label>
      <label><input type="checkbox" name="need" value="reading">Reading and focus</label>
      <label><input type="checkbox" name="need" value="motion">Motion</label>
    </div>
  </fieldset>
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
  <details id="aids" class="row aids">
    <summary><span class="label">Fine-tune<small>Each aid on its own, under the need it serves first</small></span></summary>
    <div id="aid-list"></div>
    <p id="aid-keys" class="keys">Keys: F6 moves between the parts of a page.</p>
    <button type="button" id="aids-reset">Reset to needs</button>
  </details>
</div>`;

  // the UI improvements: for everyone, each on or off on its own, kept in the same `aids` map as the aids
  const UI_HTML = `<div class="panel">
  <div class="row aids">
    <div class="label"><small>Changes to Sitecore's screens that help anyone, whatever their needs, each on its own</small></div>
    <div id="ui-list"></div>
    <p class="keys">Keys: Ctrl+Shift+Space opens the command palette, and F1 lists every shortcut and what each improvement and aid that is on does.</p>
    <button type="button" id="ui-reset">Reset to defaults</button>
  </div>
</div>`;

  // the tuning: settings.js TUNING's rows, drawn by mountTuning
  const TUNING_HTML = `<div class="panel">
  <div class="row"><div class="label"><small>Turns the theme's own colours, never icons, images or the item's content. Native and the themes drawn with pictures rather than colours have none to turn.</small></div></div>
  <div id="tuning"></div>
</div>`;
  // each setting's name, and its value as the row shows it
  const TUNE = {
    brightness: ["Brightness", (v) => `${v}%`],
    contrast: ["Contrast", (v) => `${v}%`],
    gamma: ["Gamma", (v) => (v / 100).toFixed(2)],
    saturation: ["Saturation", (v) => `${v}%`],
    hueShift: ["Hue shift", (v) => `${v > 0 ? "+" : ""}${v}°`],
  };

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

  // The needs, reading font, spacing, a colour filter with its strength (shown while a filter is on), and each aid's
  // and UI improvement's switch with why it is on or off; all off is null. Ticking a need presets the font and spacing it suggests while
  // those rows are on their plain choice. A switch keeps the user's own choice only where it differs from the needs'.
  async function mountAccessibility(r, store) {
    const S = SCT.settings;
    const saved = S.accessibility(await store.get("accessibility")) || {};
    let needs = saved.needs || [];
    let aids = { ...(saved.aids || {}) };
    const range = r.querySelector("#strength");
    range.value = saved.strength || 100;
    const pick = (n) => r.querySelector(`#${n} input:checked`).value || null;
    const current = (own = aids) => S.accessibility({ font: pick("font"), spacing: pick("spacing"), vision: pick("vision"), strength: +range.value, needs, aids: own });
    // on every surface
    const isOn = (a, id) => S.enabledAids(a, { surface: null }).includes(id);
    const show = () => {
      r.querySelector("#strength-row").hidden = !pick("vision");
      r.querySelector("#strength-value").textContent = `${range.value}%`;
    };
    const write = () => store.set("accessibility", current());

    const list = r.querySelector("#aid-list");
    const uiList = r.querySelector("#ui-list");
    const row = (id, aid) => `<div class="aid">
  <input type="checkbox" role="switch" id="aid-${id}" data-aid="${id}" aria-describedby="aid-${id}-hint aid-${id}-why">
  <div class="label"><label for="aid-${id}">${aid.name}</label><small id="aid-${id}-hint">${aid.hint}</small><small id="aid-${id}-why" data-aid-reason="${id}"></small></div>
</div>`;
    // by need, each aid under the first need it serves
    list.innerHTML = Object.entries(S.NEEDS).map(([need, name]) => {
      const rows = Object.entries(S.AIDS).filter(([, aid]) => aid.needs[0] === need).map(([id, aid]) => row(id, aid));
      return rows.length ? `<fieldset class="aid-group"><legend>${name}</legend>${rows.join("")}</fieldset>` : "";
    }).join("");
    // by group, as docs/ui-improvements.md has them
    if (uiList) uiList.innerHTML = Object.entries(S.UI_GROUPS).map(([group, name]) => {
      const rows = Object.entries(S.AIDS).filter(([, aid]) => aid.ui === group).map(([id, aid]) => row(id, aid));
      return `<fieldset class="aid-group"><legend>${name}</legend>${rows.join("")}</fieldset>`;
    }).join("");
    const drawAids = () => {
      const a = current();
      for (const input of r.querySelectorAll("#aid-list [data-aid], #ui-list [data-aid]")) {
        const id = input.dataset.aid;
        const why = S.aidReason(a, id);
        input.checked = isOn(a, id);
        r.querySelector(`[data-aid-reason="${id}"]`).textContent =
          why === "own" ? "Your choice" : why === "always" ? "On by default" : why ? `From ${S.NEEDS[why]}` : S.AIDS[id].ui ? "Off by default" : "Off";
      }
    };
    // each list resets only its own switches
    const reset = (keep) => {
      aids = Object.fromEntries(Object.entries(aids).filter(([id]) => keep(id)));
      drawAids();
      write();
    };
    list.onchange = (e) => {
      const id = e.target.dataset.aid;
      const others = { ...aids };
      delete others[id];
      if (isOn(current(others), id) === e.target.checked) aids = others;
      else aids = { ...others, [id]: e.target.checked };
      drawAids();
      write();
    };
    if (uiList) uiList.onchange = list.onchange;
    r.querySelector("#aids-reset").onclick = () => reset((id) => S.AIDS[id].ui);
    if (uiList) r.querySelector("#ui-reset").onclick = () => reset((id) => !S.AIDS[id].ui);

    const needBox = r.querySelector("#needs");
    for (const input of needBox.querySelectorAll("input")) {
      input.checked = needs.includes(input.value);
      // what it changes, shown on hover and keyboard focus and read out with the chip
      input.setAttribute("aria-describedby", `need-${input.value}-tip`);
      const tip = input.ownerDocument.createElement("span");
      tip.setAttribute("role", "tooltip");
      tip.id = `need-${input.value}-tip`;
      tip.textContent = S.needEffects(input.value);
      input.parentNode.after(tip);
    }
    needBox.onchange = (e) => {
      needs = [...needBox.querySelectorAll("input:checked")].map((i) => i.value);
      const preset = e.target.checked && S.NEED_PRESETS[e.target.value];
      for (const name of ["font", "spacing"]) {
        if (preset && preset[name] && !pick(name)) r.querySelector(`#${name} input[value="${preset[name]}"]`).checked = true;
      }
      show();
      drawAids();
      write();
    };

    for (const name of ["font", "spacing", "vision"]) {
      const box = r.querySelector(`#${name}`);
      box.querySelector(`input[value="${saved[name] || ""}"]`).checked = true;
      box.onchange = () => (show(), drawAids(), write());
    }
    const save = SCT.picker.throttled(write);
    range.oninput = () => (show(), save());
    range.onchange = write; // the slider's release: the popup can close before the throttled save
    show();
    drawAids();
  }

  // A slider per tuning setting, each with its own Reset, enabled only while the setting is off its plain value;
  // all plain is null.
  async function mountTuning(r, store) {
    const S = SCT.settings;
    const saved = S.tuning(await store.get("tuning")) || {};
    const box = r.querySelector("#tuning");
    box.innerHTML = Object.entries(S.TUNING).map(([k, [min, max, plain]]) => `<div class="row tune">
  <label for="tune-${k}">${TUNE[k][0]}</label>
  <input type="range" id="tune-${k}" class="hue" data-tune="${k}" min="${min}" max="${max}" step="5" value="${saved[k] ?? plain}">
  <output for="tune-${k}"></output>
  <button type="button" data-tune-reset="${k}" aria-label="Reset ${TUNE[k][0].toLowerCase()}">Reset</button>
</div>`).join("");
    const sliders = [...box.querySelectorAll("[data-tune]")];
    const current = () => S.tuning(Object.fromEntries(sliders.map((s) => [s.dataset.tune, +s.value])));
    const show = () => {
      for (const s of sliders) {
        const k = s.dataset.tune;
        s.nextElementSibling.textContent = TUNE[k][1](+s.value);
        box.querySelector(`[data-tune-reset="${k}"]`).disabled = +s.value === S.TUNING[k][2];
      }
    };
    const write = () => store.set("tuning", current());
    const save = SCT.picker.throttled(write);
    for (const s of sliders) {
      s.oninput = () => (show(), save());
      s.onchange = write; // the slider's release: the popup can close before the throttled save
    }
    box.onclick = (e) => {
      const k = e.target.dataset?.tuneReset;
      if (!k) return;
      const s = box.querySelector(`[data-tune="${k}"]`);
      s.value = S.TUNING[k][2];
      show();
      write();
      s.focus(); // the button is disabled now, and would drop the focus
    };
    show();
  }

  // every control r holds, wired to the store
  function mount(r, store) {
    return Promise.all([
      r.querySelector("#title-postfix") && mountTitle(r, store),
      r.querySelector("#tint") && mountTint(r, store),
      r.querySelector("#mode") && mountMode(r, store),
      r.querySelector("#font") && mountAccessibility(r, store),
      r.querySelector("#tuning") && mountTuning(r, store),
    ]);
  }

  SCT.siteSettings = { MODE_HTML, GEAR_SVG, BACK_SVG, TITLE_HTML, ACCESS_HTML, UI_HTML, TUNING_HTML, mount };
})(globalThis);
