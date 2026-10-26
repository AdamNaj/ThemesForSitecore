// Cheetah: the parts of Mac OS X that 10.x has no markup for.
// - Desktop: the start menu's account row (the user's portrait and name) and its foot (Launchpad, which
//   the menu bar's logo also opens, and Log Out, which runs Sitecore's own Log out; marked
//   data-sct-menu-footer for the Sitecore module's picker), the menu bar's clock, the Dock's tiles (each
//   taskbar entry's name in data-sct-label for the label above it, and its icon asked for at 32px, which the
//   same URL serves), and data-sct-window="active"/"inactive" on each window's iframe and document, mirrored
//   from its taskbar entry, for Aqua's inactive title bar. Sitecore keeps a hidden copy of #StartMenu next
//   to the live one, so every copy is decorated.
// - Launchpad: a group or the analytics collapses and expands from its header, as the Finder's
//   disclosure triangles do.
// Every change goes through the dom-kit, so a theme switch reverts it.
(function () {
  const ATTR = "data-sct-window";
  const clockText = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  // Sitecore lists 16px icons (/-/icon/..., ~/icon/... or its /temp/iconcache); the same URLs serve the art at 32px.
  const icon32 = (src) => (/\/(?:temp\/iconcache|[~-]\/icon)\/.+\/16x16\//i.test(src || "") ? src.replace(/\/16x16\//i, "/32x32/") : null);
  let desk = null; // { doc, ctx, observer, frames: Map<iframe, onload> } on the desktop
  let pad = null; // { doc, onclick } on the Launchpad

  // Sitecore can leave a stale entry behind for a window that navigated: the newest entry wins.
  function entryFor(doc, id) {
    const cells = doc.querySelectorAll(`#StartbarApplications [id="startbar_application_${CSS.escape(id)}"]`);
    return cells[cells.length - 1] || null;
  }

  function syncDock() {
    if (!desk) return;
    const { doc, ctx } = desk;
    for (const cell of doc.querySelectorAll('#StartbarApplications td[id^="startbar_application_"]')) {
      const button = cell.querySelector(".scStartBarApplication");
      const label = button ? button.textContent.trim() : "";
      if (label && cell.getAttribute("data-sct-label") !== label) ctx.setAttr(cell, "data-sct-label", label);
      const img = cell.querySelector("img");
      const big = img && icon32(img.getAttribute("src"));
      if (big) ctx.setAttr(img, "src", big);
    }
  }

  function syncWindows() {
    if (!desk) return;
    const { doc, ctx, frames } = desk;
    syncDock();
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
    const name = (user || "").trim() || "Sitecore";
    for (const menu of doc.querySelectorAll(".scStartMenu")) {
      if (!menu.querySelector(".sct-ch-smtop")) {
        const top = ctx.own(doc.createElement("div"));
        top.className = "sct-ch-smtop";
        const img = doc.createElement("img");
        img.alt = "";
        img.src = portrait && portrait.src ? portrait.src : "/temp/iconcache/office/32x32/default_user.png";
        const span = doc.createElement("span");
        span.textContent = name;
        top.append(img, span);
        menu.prepend(top);
      }
      if (logout && !menu.querySelector(".sct-ch-smbottom")) {
        const bottom = ctx.own(doc.createElement("div"));
        bottom.className = "sct-ch-smbottom";
        bottom.setAttribute("data-sct-menu-footer", "");
        if (launchpad && launchpad.href) {
          const link = doc.createElement("a");
          link.href = launchpad.href;
          const icon = doc.createElement("img");
          icon.alt = "";
          icon.src = "/sitecore/shell/~/icon/Core/32x32/views.png"; // a window of app tiles; Core has no smaller size
          link.append(icon, "Launchpad");
          bottom.append(link);
        }
        const off = doc.createElement("a");
        off.href = "#";
        off.className = "sct-ch-logoff";
        const key = doc.createElement("img");
        key.alt = "";
        key.src = "/sitecore/shell/~/icon/Network/16x16/key1.png";
        off.append(key, `Log Out ${name}...`);
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

    const bar = doc.querySelector(".sc-globalHeader");
    if (bar && !doc.querySelector(".sct-ch-clock")) {
      const clock = ctx.own(doc.createElement("div"));
      clock.className = "sct-ch-clock";
      clock.textContent = clockText();
      bar.append(clock);
      const timer = setInterval(() => (clock.isConnected ? (clock.textContent = clockText()) : clearInterval(timer)), 15000);
    }

    const apps = doc.getElementById("StartbarApplications");
    if (apps && !desk.observer) {
      // the engine re-runs apply for added and removed nodes; focus changes only swap the entry's class
      desk.observer = new MutationObserver(syncWindows);
      desk.observer.observe(apps, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
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

  SCT.registerTheme("cheetah", {
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
