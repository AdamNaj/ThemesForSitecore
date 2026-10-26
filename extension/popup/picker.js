// The theme picker, shared by the extension's popup and the Sitecore module's panel (sitecore/host.js): the
// preview, a theme's own settings (an environment, a time of day, a hue: theme.json `controls` and `hue`) and the strip of
// miniatures. Needs themes.js, lib/settings.js and swatch.js. The caller says where to draw and how to read and save:
//   SCT.picker.mount(container, {
//     label,          the strip's accessible name
//     themes,         the URL of the themes folder, ending in /: a theme's screenshots are <id>/preview*.jpg
//     load(),         Promise of { version, catalog, theme (saved id), hue, env, phase }
//     setTheme(id),   Promise
//     setHue(hue, theme), Promise; called while the slider moves (at most once a second) and on release
//     setEnv(env),    Promise; leave it out for no environment control
//     setPhase(phase), Promise, "" for Auto; leave it out for no time-of-day control
//     onTheme(theme), optional: called with the site's theme on every draw
//   }) returns { render } to draw again after a change elsewhere
(function (root) {
  const SCT = (root.SCT = root.SCT || {});
  const KNOWN_VERSIONS = ["10.4", "10.5"];

  const MARKUP = `<p id="version-notice" class="notice" hidden></p>
<figure id="hero">
  <div id="hero-art"></div>
  <figcaption><b id="hero-name"></b><span id="hero-desc"></span><em id="hero-tag" hidden>Preview</em></figcaption>
</figure>
<div id="params">
<div id="env" role="radiogroup" aria-label="This site's environment" hidden>
  <label><input type="radio" name="env" value="prod"> Production</label>
  <label><input type="radio" name="env" value="staging"> Staging</label>
  <label><input type="radio" name="env" value="qa"> QA</label>
  <label><input type="radio" name="env" value="dev"> Dev</label>
  <label><input type="radio" name="env" value="sandbox"> Sandbox</label>
  <label><input type="radio" name="env" value="local"> Local</label>
  <label><input type="radio" name="env" value="beta"> Beta</label>
</div>
<div id="phase" role="radiogroup" aria-label="This site's time of day" hidden>
  <label><input type="radio" name="phase" value=""> Auto</label>
  <label><input type="radio" name="phase" value="dawn"> Dawn</label>
  <label><input type="radio" name="phase" value="day"> Day</label>
  <label><input type="radio" name="phase" value="dusk"> Dusk</label>
  <label><input type="radio" name="phase" value="night"> Night</label>
</div>
<div id="hue" hidden>
  <label for="hue-range">Hue</label>
  <span class="hue-track"><input type="range" id="hue-range" class="hue" min="0" max="359" step="1" value="0"></span>
  <button id="hue-reset" type="button" title="Back to the theme's own colours">Reset</button>
</div>
</div>
<div id="groups" role="tablist" aria-label="Theme groups"></div>
<div id="themes" role="radiogroup"></div>`;

  function paintTrack(range, colour) {
    // not Array.from: Sitecore's Prototype.js replaces it with one that ignores the mapping function
    const stops = [...Array(13).keys()].map((i) => colour(i * 30));
    range.style.background = `linear-gradient(to right, ${stops.join(", ")})`;
  }

  // storage.sync allows about one write a second sustained: a drag saves at once, then at most once a second.
  function throttled(save) {
    let timer = 0, again = false;
    const run = () => {
      again = false;
      save();
      timer = setTimeout(() => ((timer = 0), again && run()), 1000);
    };
    return () => (timer ? (again = true) : run());
  }

  function mount(container, opts) {
    const doc = container.ownerDocument;
    container.replaceChildren(...[...new DOMParser().parseFromString(MARKUP, "text/html").body.childNodes].map((n) => doc.importNode(n, true)));
    const $ = (sel) => container.querySelector(sel);
    $("#themes").setAttribute("aria-label", opts.label);

    let heroId = null;
    let siteVersion = null; // the site's Sitecore version: Native and some themes look different per version
    let siteTheme = null; // the theme in use
    let siteHue = 0; // its hue, 0 for the theme's own colours
    let openGroup = null; // the group whose tab is open

    // One theme in the strip: its miniature around a radio button (hidden, still keyboard and screen-reader driven).
    function frame(t, checked) {
      const label = doc.createElement("label");
      label.className = "frame";
      label.title = [t.name + (t.imported ? " (imported)" : ""), t.description].filter(Boolean).join(": ");
      const input = doc.createElement("input");
      input.type = "radio";
      input.name = "theme";
      input.value = t.id;
      input.checked = checked;
      label.append(input);
      label.insertAdjacentHTML("beforeend", SCT.swatch(SCT.swatchSpec(t, siteVersion), t.name));
      return label;
    }

    // The preview: the theme's screenshot (light and dark halves for a theme that follows the OS), or its
    // miniature drawn large where there is none (imported themes, a theme added since the last capture).
    // A theme's `previews` (themes.js) names the screenshots tools/previews.cjs made: preview.jpg on its main version
    // (10.5 where it runs there), preview-<version>.jpg on another, each with a -dark twin for themes that follow the OS.
    function hero(t, previewing) {
      if (heroId !== t.id) {
        heroId = t.id;
        const art = $("#hero-art");
        const spec = SCT.swatchSpec(t, siteVersion);
        art.style.background = spec.desk;
        const have = t.previews || [];
        const base = [`-${siteVersion}`, ""].find((n) => have.includes(n));
        if (base === undefined) {
          // the whole miniature, centred on its wallpaper colour
          art.replaceChildren();
          art.insertAdjacentHTML("beforeend", SCT.swatch(spec, t.name).replace(/ width="\d+" height="\d+"/, ""));
        } else {
          const shot = (name, cls) => Object.assign(doc.createElement("img"), { alt: "", className: cls, src: `${opts.themes}${t.id}/preview${name}.jpg` });
          const parts = [shot(base, "")];
          if (have.includes(`${base}-dark`)) parts.push(shot(`${base}-dark`, "dark"));
          art.replaceChildren(...parts);
        }
      }
      paintHue();
      $("#hero-name").textContent = t.name;
      $("#hero-desc").textContent = $("#hero-desc").title = t.description || "";
      $("#hero-tag").hidden = !previewing;
    }

    // The preview and this site's miniature turned by the site's hue, roughly: the theme turns in OKLCH.
    function paintHue() {
      const filter = siteHue ? `hue-rotate(${siteHue}deg)` : "";
      $("#hero-art").style.filter = siteTheme && heroId === siteTheme.id ? filter : "";
      for (const f of container.querySelectorAll("#themes .frame")) f.querySelector("svg").style.filter = f.querySelector("input").checked ? filter : "";
      $("#hue-reset").disabled = !siteHue;
    }

    async function render() {
      const { version: release = null, catalog, theme, hue, env, phase } = await opts.load();
      const version = SCT.settings.uiVersion(release); // 10.0 to 10.3 serve 10.4's UI
      if (siteVersion !== version) (siteVersion = version), (heroId = null);
      const byId = (id) => catalog.find((t) => t.id === id);

      const notice = $("#version-notice");
      notice.hidden = !version || KNOWN_VERSIONS.includes(version);
      notice.textContent = `Sitecore ${release} is untested. Themes are written for 10.0 to 10.5 and may look off.`;

      // Themes made for another Sitecore version (Sitecore 10.4 on a 10.4 site) aren't offered. A site without a
      // theme of its own, or whose theme was removed or doesn't fit its version, shows Native, as the engine does.
      const fits = (t) => !version || t.versions.includes(version);
      const saved = byId(theme);
      const current = byId(saved && fits(saved) ? saved.id : "native");
      const offered = catalog.filter(fits);
      siteTheme = current;
      opts.onTheme?.(current);
      siteHue = (current.hue && SCT.settings.hue(hue, current.id)) || 0;
      const groups = [
        ["Sitecore", offered.filter((t) => !t.category && !t.imported)],
        ...SCT.categories.map((c) => [c.name, offered.filter((t) => t.category === c.id)]),
        ["Imported", offered.filter((t) => t.imported)],
      ].filter(([, themes]) => themes.length);

      // One group at a time, under a row of tabs: the group holding the site's theme (its tab carries a dot) until
      // another tab is picked, which then stays open across picks while the popup is open.
      const tabs = $("#groups");
      const list = $("#themes");
      if (!groups.some(([name]) => name === openGroup)) openGroup = (groups.find(([, ts]) => ts.includes(current)) || groups[0])[0];
      const showGroup = (name) => {
        openGroup = name;
        for (const tab of tabs.children) {
          const on = tab.dataset.group === name;
          tab.setAttribute("aria-selected", String(on));
          tab.tabIndex = on ? 0 : -1;
        }
        list.replaceChildren(...groups.find(([n]) => n === name)[1].map((t) => frame(t, t.id === current.id)));
      };
      tabs.replaceChildren(...groups.map(([name, themes]) => {
        const tab = doc.createElement("button");
        tab.type = "button";
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", "themes");
        tab.dataset.group = name;
        tab.textContent = name;
        if (themes.includes(current)) {
          tab.classList.add("current");
          tab.title = `This site's theme, ${current.name}, is here`;
        }
        return tab;
      }));
      tabs.onclick = (e) => {
        const tab = e.target.closest("[data-group]");
        if (tab) showGroup(tab.dataset.group);
      };
      // arrow keys, Home and End move between tabs and open the one they reach
      tabs.onkeydown = (e) => {
        const all = [...tabs.children], i = all.indexOf(e.target);
        const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 }[e.key];
        if (i < 0 || to === undefined) return;
        e.preventDefault();
        const tab = all[(to + all.length) % all.length];
        showGroup(tab.dataset.group);
        tab.focus();
      };
      showGroup(openGroup);

      // the preview follows the pointer and the keyboard over the strip, and returns to this site's theme
      hero(current, false);
      const previewAt = (el) => {
        const t = el && byId(el.closest(".frame")?.querySelector("input").value);
        hero(t || current, !!t && t.id !== current.id);
      };
      const focused = () => container.getRootNode().activeElement;
      list.onmouseover = (e) => previewAt(e.target);
      list.onmouseleave = () => previewAt(focused()?.closest?.("#themes .frame") ? focused() : null);
      list.onfocusin = (e) => previewAt(e.target);
      list.onfocusout = (e) => !list.contains(e.relatedTarget) && previewAt(null);

      // a theme that draws the site's environment (Guardrail); production until the site says otherwise
      $("#env").hidden = !opts.setEnv || !current.controls?.includes("env");
      $(`#env input[value="${SCT.settings.ENVS.includes(env) ? env : "prod"}"]`).checked = true;

      // a theme that follows the clock (Meridian) until the site pins a time of day
      $("#phase").hidden = !opts.setPhase || !current.controls?.includes("phase");
      $(`#phase input[value="${SCT.settings.PHASES.includes(phase) ? phase : ""}"]`).checked = true;

      // a theme with a hue (Fjord) turns round the colour wheel: the track starts at the theme's own accent
      $("#hue").hidden = !current.hue;
      if (current.hue) {
        const accent = current.preview[1];
        paintTrack($("#hue-range"), (d) => `oklch(from ${accent} l c calc(h + ${d}))`);
        $("#hue-range").value = siteHue;
      }
      paintHue();
    }

    $("#themes").onchange = (e) => opts.setTheme(e.target.value).then(render);
    if (opts.setEnv) $("#env").onchange = (e) => opts.setEnv(e.target.value);
    if (opts.setPhase) $("#phase").onchange = (e) => opts.setPhase(e.target.value);
    const range = $("#hue-range");
    const writeHue = () => opts.setHue(siteHue, siteTheme.id);
    const saveHue = throttled(writeHue);
    range.oninput = () => ((siteHue = +range.value), paintHue(), saveHue());
    range.onchange = writeHue; // the popup can close before the throttled save
    $("#hue-reset").onclick = () => ((range.value = siteHue = 0), paintHue(), writeHue());

    render();
    return { render };
  }

  SCT.picker = { mount, paintTrack, throttled };
})(globalThis);
