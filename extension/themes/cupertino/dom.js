// Cupertino: the desktop's running windows as macOS Dock items, one per application. Sitecore's own
// taskbar buttons stay in the DOM (shell.css hides them visually) and keep every behaviour: a Dock item
// forwards its clicks and right-clicks to them, so Sitecore's window manager still owns activation,
// minimising and restoring. The Dock is rebuilt from those buttons whenever they change.
(function () {
  const ENTRY = '#StartbarApplications td[id^="startbar_application_"]';
  // window ids, most recently active first; lives for one apply/revert cycle
  let recent = [];
  // The engine re-runs apply when nodes are added or removed; a focus change only swaps the entries'
  // classes, so the Dock watches those itself. Disconnected on revert.
  let classWatch = null;
  // the Dock this engine built; a Dock left by an engine that died with an extension reload is dropped
  let dock = null;

  // Sitecore lists 16px icons (/-/icon/..., ~/icon/... or its /temp/iconcache); the same URLs serve
  // the art at 32px.
  const iconPath = (src) => (src || "").match(/\/(?:temp\/iconcache|[~-]\/icon)\/(.+)\/16x16\/([^?#]+)/i);
  const icon32 = (src) => (iconPath(src) ? src.replace(/\/16x16\//i, "/32x32/") : src);
  const appKey = (src) => {
    const m = iconPath(src);
    return (m ? `${m[1]}/${m[2]}` : src || "?").toLowerCase();
  };

  // Sitecore drops a window's entry from its unload event, which current Chrome no longer fires, so a
  // closed window leaves its entry behind and a window that navigates gets a second one. Entries are
  // left alone; the Dock ignores those whose window is gone and keeps the newest entry per window.
  function windows(doc) {
    const byId = new Map();
    for (const td of doc.querySelectorAll(ENTRY)) {
      const id = td.id.slice("startbar_application_".length);
      const button = td.querySelector(".scStartBarApplication");
      if (!button || !doc.getElementById(id)) continue;
      byId.delete(id);
      const img = td.querySelector("img");
      byId.set(id, {
        id, button,
        src: img ? img.getAttribute("src") : "",
        title: button.textContent.trim(),
        active: td.classList.contains("scActiveApplication"),
      });
    }
    return [...byId.values()];
  }

  // The item selected in a Content Editor-style window: its tree's active node and the nodes above it
  // (display names, as the tree shows them). Read when the label opens, so nothing watches the windows.
  function itemPath(doc, id) {
    let d = null;
    try {
      d = doc.getElementById(id).contentDocument;
    } catch {
      return "";
    }
    const parts = [];
    const active = d && d.querySelector("a.scContentTreeNodeActive");
    for (let n = active && active.closest(".scContentTreeNode"); n; n = n.parentElement && n.parentElement.closest(".scContentTreeNode")) {
      const a = n.querySelector(":scope > a");
      if (a) parts.unshift(a.textContent.trim());
    }
    const path = parts.length ? "/" + parts.join("/") : "";
    // ponytail: keeps the tail (the item itself) of long paths; a CSS start-ellipsis would need bidi tricks
    return path.length > 60 ? "…" + path.slice(-59) : path;
  }

  // A Dock click brings the app forward: its most recently active window.
  const pick = (wins) => wins.find((w) => w.id === recent.find((id) => wins.some((x) => x.id === id))) || wins[wins.length - 1];

  function forward(el, target) {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      target().button.click();
    });
    el.addEventListener("contextmenu", (e) => {
      // the Dock sits in the taskbar strip, whose own right-click menu must not answer as well
      e.preventDefault();
      e.stopPropagation();
      // delivered to the button only: Sitecore's menu for the window, not the strip's behind it
      target().button.dispatchEvent(new MouseEvent("contextmenu", { bubbles: false, cancelable: true, button: 2, clientX: e.clientX, clientY: e.clientY }));
    });
  }

  function img(doc, src, fallback) {
    const i = doc.createElement("img");
    i.alt = "";
    if (fallback) i.addEventListener("error", () => i.getAttribute("src") !== fallback && (i.src = fallback), { once: true });
    i.src = src;
    return i;
  }

  function item(doc, wins) {
    const app = doc.createElement("div");
    app.className = "sct-cu-app" + (wins.some((w) => w.active) ? " sct-cu-app-active" : "");
    const icon = doc.createElement("button");
    icon.type = "button";
    icon.className = "sct-cu-app-icon";
    icon.setAttribute("aria-label", wins.length > 1 ? `${wins[0].title} and ${wins.length - 1} more` : wins[0].title);
    icon.append(img(doc, icon32(wins[0].src), wins[0].src));
    forward(icon, () => pick(wins));
    app.append(icon);

    // each label's second line: the window's selected item, refreshed whenever the label opens
    const paths = [];
    const pathLine = (w) => {
      const small = doc.createElement("small");
      small.className = "sct-cu-path";
      paths.push([small, w.id]);
      return small;
    };
    const refresh = () => {
      for (const [small, id] of paths) small.textContent = itemPath(doc, id);
    };
    app.addEventListener("mouseenter", refresh);
    app.addEventListener("focusin", refresh);

    if (wins.length === 1) {
      const tip = doc.createElement("div");
      tip.className = "sct-cu-tip";
      tip.append(wins[0].title, pathLine(wins[0]));
      app.append(tip);
    } else {
      // more than one window: a stack of them above the icon, as the Dock lists a folder
      icon.setAttribute("aria-haspopup", "menu");
      const stack = doc.createElement("div");
      stack.className = "sct-cu-stack";
      const list = doc.createElement("div");
      list.className = "sct-cu-stack-list";
      list.setAttribute("role", "menu");
      for (const w of wins) {
        const row = doc.createElement("button");
        row.type = "button";
        row.className = "sct-cu-stack-row" + (w.active ? " sct-cu-stack-row-active" : "");
        row.setAttribute("role", "menuitem");
        const label = doc.createElement("span");
        label.append(w.title, pathLine(w));
        row.append(img(doc, w.src), label);
        forward(row, () => w);
        list.append(row);
      }
      stack.append(list);
      app.append(stack);
    }
    const dot = doc.createElement("span");
    dot.className = "sct-cu-dot";
    app.append(dot);
    return app;
  }

  // Sitecore's instant search opens its results (#InstantResults) at a fixed spot near the right edge,
  // where its taskbar search box used to be. The Dock is centred, so the results are placed above the
  // Dock's search field instead: the position goes into custom properties shell.css reads.
  function placeSearch(doc) {
    const popup = doc.getElementById("InstantResults");
    const field = doc.getElementById("SearchBox");
    const shelf = doc.getElementById("Startbar");
    if (!popup || !field || !shelf) return;
    const win = doc.defaultView;
    const f = field.getBoundingClientRect();
    const w = popup.offsetWidth;
    const left = Math.max(8, Math.min(f.left + f.width / 2 - w / 2, win.innerWidth - w - 8));
    popup.style.setProperty("--sct-cu-left", `${Math.round(left)}px`);
    popup.style.setProperty("--sct-cu-bottom", `${Math.round(win.innerHeight - shelf.getBoundingClientRect().top + 8)}px`);
  }

  // Sitecore's scWin.maximizeWindow ignores clicks more than 36px down its window (the caption below is a
  // drag area). shell.css centres the Content Editor's lights on its tab row, 29-43px down, so a click on
  // the zoom light's lower half is handed on as one at y=36. One listener per frame; removed on revert.
  let reachFix = null;
  function reach(doc) {
    if (reachFix) return;
    reachFix = (e) => {
      const t = e.target;
      if (!e.isTrusted || e.clientY <= 36 || !t.matches || !t.matches('.scSystemButtons img[onclick*="maximizeWindow"]')) return;
      e.stopImmediatePropagation();
      t.dispatchEvent(new MouseEvent("click", {
        bubbles: true, cancelable: true, view: e.view, detail: e.detail, button: e.button,
        clientX: e.clientX, clientY: 36, screenX: e.screenX, screenY: e.screenY - (e.clientY - 36),
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
      }));
    };
    doc.addEventListener("click", reachFix, true);
  }

  SCT.registerTheme("cupertino", {
    apply(ctx) {
      const doc = ctx.doc;
      reach(doc);
      const scroller = doc.querySelector(".scStartBarScroller");
      const table = doc.getElementById("StartbarApplications");
      if (!scroller || !table) return;
      if (!classWatch) classWatch = new MutationObserver(() => this.apply(ctx));
      if (classWatch.table !== table) {
        classWatch.disconnect();
        classWatch.observe(table, { attributes: true, attributeFilter: ["class"], subtree: true });
        classWatch.table = table;
      }
      const wins = windows(doc);
      const active = wins.find((w) => w.active);
      if (active) recent = [active.id, ...recent.filter((id) => id !== active.id)];

      const groups = new Map();
      for (const w of wins) {
        const k = appKey(w.src);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(w);
      }
      const sig = JSON.stringify([...groups].map(([k, g]) => [k, g.map((w) => [w.id, w.title, w.active])]));

      for (const stale of scroller.querySelectorAll(":scope > .sct-cu-dock")) if (stale !== dock) stale.remove();
      if (dock && dock.isConnected && dock.getAttribute("data-sig") === sig) return placeSearch(doc);
      if (!dock || !dock.isConnected) {
        dock = ctx.own(doc.createElement("div"));
        dock.className = "sct-cu-dock";
        dock.setAttribute("role", "toolbar");
        dock.setAttribute("aria-label", "Open applications");
        scroller.append(dock);
      }
      dock.setAttribute("data-sig", sig);
      dock.replaceChildren(...[...groups.values()].map((g) => item(doc, g)));
      placeSearch(doc);
    },
    revert(ctx) {
      const popup = ctx && ctx.doc && ctx.doc.getElementById("InstantResults");
      if (popup) for (const p of ["--sct-cu-left", "--sct-cu-bottom"]) popup.style.removeProperty(p);
      if (reachFix && ctx && ctx.doc) ctx.doc.removeEventListener("click", reachFix, true);
      reachFix = null;
      recent = [];
      dock = null;
      if (classWatch) classWatch.disconnect();
      classWatch = null;
    },
  });
})();
