// Warp: the parts of OS/2 Warp 4 that 10.x has no markup for.
// - Desktop: the WarpCenter menu's blue header (the user's portrait and name) and footer (Launchpad, which the hidden
//   top bar held, and Log off, which runs Sitecore's own Log out; marked data-sct-menu-footer for the Sitecore
//   module's picker), the WarpCenter's clock (green figures in a black window), and data-sct-window="active"/"inactive" on each window's iframe
//   and document, mirrored from its taskbar entry, for the inactive grey title bar. Sitecore keeps a hidden copy of
//   #StartMenu next to the live one, so every copy is decorated.
// - Launchpad: a folder window (a group) or the analytics rolls up and down from its title bar.
// Every change goes through the dom-kit, so a theme switch reverts it.
(function () {
  const ATTR = "data-sct-window";
  const clockText = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  let desk = null; // { doc, ctx, observer, frames: Map<iframe, onload> } on the desktop
  let pad = null; // { doc, onclick } on the Launchpad

  // Sitecore can leave a stale entry behind for a window that navigated: the newest entry wins.
  function entryFor(doc, id) {
    const cells = doc.querySelectorAll(`#StartbarApplications [id="startbar_application_${CSS.escape(id)}"]`);
    return cells[cells.length - 1] || null;
  }

  function syncWindows() {
    if (!desk) return;
    const { doc, ctx, frames } = desk;
    for (const frame of doc.querySelectorAll("#Desktop > iframe[id]")) {
      if (!frames.has(frame)) {
        // a window that navigates gets a new document, which needs the attribute again
        const onload = () => syncWindows();
        frame.addEventListener("load", onload);
        frames.set(frame, onload);
      }
      const cell = entryFor(doc, frame.id);
      if (!cell) continue;
      const value = cell.classList.contains("scActiveApplication") ? "active" : "inactive";
      if (frame.getAttribute(ATTR) !== value) ctx.setAttr(frame, ATTR, value);
      let html = null;
      try {
        html = frame.contentDocument && frame.contentDocument.documentElement;
      } catch {
        // a cross-origin window: only the iframe is marked
      }
      if (html && html.getAttribute(ATTR) !== value) ctx.setAttr(html, ATTR, value);
    }
  }

  function decorateStartMenu(ctx) {
    const doc = ctx.doc;
    const user = (doc.getElementById("globalHeaderUserName") || {}).textContent;
    const portrait = doc.getElementById("globalHeaderUserPortrait");
    const logout = doc.querySelector(".sc-globalHeader .logout");
    const launchpad = doc.querySelector(".sc-globalHeader .sc-global-logo");
    for (const menu of doc.querySelectorAll(".scStartMenu")) {
      if (!menu.querySelector(".sct-wp-smtop")) {
        const top = ctx.own(doc.createElement("div"));
        top.className = "sct-wp-smtop";
        const img = doc.createElement("img");
        img.alt = "";
        img.src = portrait && portrait.src ? portrait.src : "/temp/iconcache/office/32x32/default_user.png";
        const name = doc.createElement("span");
        name.textContent = (user || "").trim() || "Sitecore";
        top.append(img, name);
        menu.prepend(top);
      }
      if (logout && !menu.querySelector(".sct-wp-smbottom")) {
        const bottom = ctx.own(doc.createElement("div"));
        bottom.className = "sct-wp-smbottom";
        bottom.setAttribute("data-sct-menu-footer", "");
        if (launchpad && launchpad.href) {
          const pad = doc.createElement("a");
          pad.href = launchpad.href;
          const icon = doc.createElement("img");
          icon.alt = "";
          icon.src = "/sitecore/shell/~/icon/Core/32x32/views.png"; // a window of app tiles; Core has no smaller size
          pad.append(icon, "Launchpad");
          bottom.append(pad);
        }
        const off = doc.createElement("a");
        off.href = "#";
        off.className = "sct-wp-logoff";
        const key = doc.createElement("img");
        key.alt = "";
        key.src = "/sitecore/shell/~/icon/Network/24x24/key1.png";
        off.append(key, "Log off");
        off.addEventListener("click", (e) => {
          e.preventDefault();
          logout.click();
        });
        bottom.append(off);
        menu.append(bottom);
      }
    }
  }

  function applyDesktop(ctx) {
    const doc = ctx.doc;
    if (!desk || desk.doc !== doc) desk = { doc, ctx, observer: null, frames: new Map() };
    desk.ctx = ctx;
    decorateStartMenu(ctx);

    const tray = doc.getElementById("Tray");
    if (tray && !doc.querySelector(".sct-wp-clock")) {
      const clock = ctx.own(doc.createElement("td"));
      clock.className = "sct-wp-clock";
      const face = doc.createElement("span");
      face.textContent = clockText();
      clock.append(face);
      tray.after(clock);
      const timer = setInterval(() => (face.isConnected ? (face.textContent = clockText()) : clearInterval(timer)), 15000);
    }

    const bar = doc.getElementById("StartbarApplications");
    if (bar && !desk.observer) {
      // the engine re-runs apply for added and removed nodes; focus changes only swap the entry's class
      desk.observer = new MutationObserver(syncWindows);
      desk.observer.observe(bar, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
    }
    syncWindows();
  }

  function applyLaunchpad(ctx) {
    const doc = ctx.doc;
    if (pad && pad.doc === doc) return;
    const onclick = (e) => {
      const head = e.target.closest && e.target.closest('.sc-launchpad-group-title, .sc-text[data-sc-id="CustomAnalyticsLabel"]');
      if (!head) return;
      const target = head.matches(".sc-launchpad-group-title") ? head.parentElement : head;
      ctx.setAttr(target, "data-sct-collapsed", target.getAttribute("data-sct-collapsed") === "1" ? "0" : "1");
    };
    doc.addEventListener("click", onclick);
    pad = { doc, onclick };
  }

  SCT.registerTheme("warp", {
    apply(ctx) {
      if (ctx.doc.getElementById("Desktop")) applyDesktop(ctx);
      if (ctx.doc.querySelector(".sc-launchpad")) applyLaunchpad(ctx);
    },
    // The dom-kit undoes every element and attribute; this drops the listeners.
    revert() {
      if (desk) {
        if (desk.observer) desk.observer.disconnect();
        for (const [frame, onload] of desk.frames) frame.removeEventListener("load", onload);
        desk = null;
      }
      if (pad) {
        pad.doc.removeEventListener("click", pad.onclick);
        pad = null;
      }
    },
  });
})();
