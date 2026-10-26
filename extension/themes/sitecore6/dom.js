// Copenhagen: builds the parts of 6.6's desktop that 10.x no longer renders, with 6.6's own markup so
// the ported 6.6 stylesheets dress them: the start menu's top band (portrait and name) and bottom band
// (Log Off), and the clock at the end of the taskbar. Sitecore keeps a hidden copy of #StartMenu next to
// the live one, so every copy is decorated. The bottom band also holds Launchpad, which 6.x never had but the
// hidden global header did, and is marked data-sct-menu-footer for the Sitecore module's picker.
(function () {
  const clockText = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  SCT.registerTheme("sitecore6", {
    apply(ctx) {
      const doc = ctx.doc;
      const account = [...doc.querySelectorAll(".sc-accountInformation li")];
      const user = account.map((li) => li.textContent.trim()).filter((t) => t && !/log ?out/i.test(t)).pop();
      const logout = [...doc.querySelectorAll(".sc-accountInformation *")].find((e) => !e.children.length && /log ?(out|off)/i.test(e.textContent));
      // the user's portrait is the only image in the global header
      const avatar = doc.querySelector(".sc-globalHeader img");
      const launchpad = doc.querySelector(".sc-globalHeader .sc-global-logo");

      for (const menu of doc.querySelectorAll(".scStartMenu")) {
        if (!menu.querySelector(".scStartMenuTop")) {
          const top = ctx.own(doc.createElement("div"));
          top.className = "scStartMenuTop";
          const icon = doc.createElement("img");
          icon.className = "scStartMenuTopIcon";
          icon.alt = "";
          icon.src = avatar && avatar.src ? avatar.src : "/sitecore/shell/~/icon/People/32x32/ghost.png";
          const names = doc.createElement("div");
          names.className = "scStartMenuTopNames";
          const name = doc.createElement("div");
          name.className = "scStartMenuTopUserName";
          name.textContent = user || "Sitecore";
          names.append(name);
          top.append(icon, names);
          menu.prepend(top);
        }
        let inner = menu.querySelector(".scStartMenuBottomInner");
        if (!inner) {
          const bottom = ctx.own(doc.createElement("div"));
          bottom.className = "scStartMenuBottom";
          inner = doc.createElement("div");
          inner.className = "scStartMenuBottomInner";
          inner.setAttribute("data-sct-menu-footer", "");
          bottom.append(inner);
          menu.append(bottom);
        }
        // The account links can arrive after the menu, so Log Off is added once they exist.
        // It runs Sitecore's own Log out; the theme adds no behaviour of its own.
        if (launchpad && launchpad.href && !inner.querySelector(".sct-sc6-launchpad")) {
          const pad = doc.createElement("a");
          pad.className = "sct-sc6-launchpad";
          pad.href = launchpad.href;
          const icon = doc.createElement("img");
          icon.alt = "";
          icon.src = "/sitecore/shell/~/icon/Core/32x32/views.png"; // a window of app tiles; Core has no smaller size
          pad.append(icon, "Launchpad");
          inner.prepend(pad);
        }
        if (logout && !inner.querySelector(".sct-sc6-logoff")) {
          const off = doc.createElement("a");
          off.className = "sct-sc6-logoff";
          off.href = "#";
          const key = doc.createElement("img");
          key.alt = "";
          key.src = "/sitecore/shell/~/icon/Network/16x16/key1.png";
          off.append(key, "Log Off");
          off.addEventListener("click", (e) => {
            e.preventDefault();
            logout.click();
          });
          inner.append(off);
        }
      }

      // 6.6's tray ended with a clock.
      const tray = doc.querySelector("#Tray");
      if (tray && !doc.querySelector(".sct-sc6-clock")) {
        const clock = ctx.own(doc.createElement("td"));
        clock.className = "sct-sc6-clock";
        clock.textContent = clockText();
        tray.after(clock);
        const timer = setInterval(() => (clock.isConnected ? (clock.textContent = clockText()) : clearInterval(timer)), 15000);
      }
    },
  });
})();
