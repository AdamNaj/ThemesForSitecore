// Item info: a small panel at the right of the Content Editor's item header. Two chips say when the item's version was
// last modified and by whom (the user name without its domain), and which version in this language is live in the web
// database against what the next publish would put there: up to date, edited since it was published, a newer version
// still in workflow or ready to publish, or the item or a version held back by its publishing settings (and live content
// the next publish takes down); Copy puts the item's or its template's name, path or ID on the clipboard, and Navigate
// opens its template, or one of the templates that template inherits from (Sitecore's own, under
// /sitecore/templates/System, left out).
// Nothing here holds up the editor: the chips fill in once the browser is idle, from the version list Sitecore shows
// under the ribbon's version button (Gallery.Versions, once for the content database and once for web), the item's
// Publishing Settings dialog opened read-only (SetPublishing), and, when web lacks the version that would go live, the
// Review tab's workflow menu for it (Gallery.WorkflowEdit). Navigate reads the
// template's Inheritance tab (TemplateInheritance) the first time it opens. Copy reads Quick Info, already in the page;
// without Quick Info (switched off in the Application Options) there is no template to copy or open.
// The pill says how long ago; its tooltip has Sitecore's own text for the date, in the user's format and the server's time.
// ponytail: a template's inheritance is kept for the page's life; a base template changed meanwhile shows on reload
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const HEADER = ".scEditorHeader";
  const SYSTEM = /^\/sitecore\/templates\/system\//i;
  const svg = (paths) => `<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const ICONS = {
    clock: svg('<circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.2l2 1.3"/>'),
    globe: svg('<circle cx="7" cy="7" r="5.5"/><path d="M1.5 7h11M7 1.5C5.2 3.1 4.4 5 4.4 7s.8 3.9 2.6 5.5M7 1.5c1.8 1.6 2.6 3.5 2.6 5.5S8.8 10.9 7 12.5"/>'),
    globeOff: svg('<circle cx="7" cy="7" r="5.5"/><path d="M1.5 7h11M7 1.5C5.2 3.1 4.4 5 4.4 7s.8 3.9 2.6 5.5M7 1.5c1.8 1.6 2.6 3.5 2.6 5.5S8.8 10.9 7 12.5M1.5 1.5l11 11"/>'),
    copy: svg('<rect x="4.5" y="4.5" width="8" height="8" rx="1.5"/><path d="M9.5 4.5V3A1.5 1.5 0 0 0 8 1.5H3A1.5 1.5 0 0 0 1.5 3v5A1.5 1.5 0 0 0 3 9.5h1.5"/>'),
    template: svg('<rect x="5" y="1.5" width="4" height="3" rx=".5"/><rect x="1.5" y="9.5" width="4" height="3" rx=".5"/><rect x="8.5" y="9.5" width="4" height="3" rx=".5"/><path d="M7 4.5V7M3.5 9.5V7h7v2.5"/>'),
    flow: svg('<circle cx="3" cy="3" r="1.5"/><circle cx="11" cy="11" r="1.5"/><path d="M4.5 3H9a2 2 0 0 1 0 4H5a2 2 0 0 0 0 4h4.5"/>'),
    ready: svg('<path d="M7 9.5V2.5M4.5 5L7 2.5 9.5 5M2.5 9.5v2h9v-2"/>'),
    edited: svg('<path d="M9.5 2.5l2 2-6.5 6.5-2.7.7.7-2.7z"/>'),
    gone: svg('<path d="M7 1.8l5.6 9.7H1.4z"/><path d="M7 5.5v2.6M7 10v.01"/>'),
    ban: svg('<circle cx="7" cy="7" r="5.5"/><path d="M3.1 3.1l7.8 7.8"/>'),
    calendar: svg('<rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/><path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2"/>'),
    hidden: svg('<path d="M1.5 7S3.5 3 7 3s5.5 4 5.5 4-2 4-5.5 4S1.5 7 1.5 7z"/><circle cx="7" cy="7" r="1.8"/><path d="M2 2l10 10"/>'),
    takedown: svg('<path d="M7 1.5v7M4.5 6L7 8.5 9.5 6M2.5 12h9"/>'),
    back: svg('<path d="M5 3.5L2.5 6 5 8.5"/><path d="M2.5 6H9a3 3 0 0 1 0 6H6"/>'),
    down: '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3.5l3 3 3-3"/></svg>',
  };
  const inheritance = new Map(); // template ID -> Promise of [{ id, name, folder, depth }]
  let loading = null; // the chips' requests for the newest header, aborted when another item opens
  let serial = 0;

  // A date from Sitecore's text for it: 4/19/2026 6:21 PM (month first, as en-US writes it with AM/PM), 19/04/2026 18:21
  // or 19.04.2026 18:21 (day first), 2026-04-19 18:21, each with or without its time. Null for anything else.
  // ponytail: the server's time zone is taken to be the browser's; a server hours behind reads hours too recent, and a
  // date with no time and slashes is read month first
  function when(text) {
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2})(?::\d{2})? ?([AP]M))?$/i.exec(text);
    if (m) return new Date(+m[3], m[1] - 1, +m[2], m[4] ? (m[4] % 12) + (/p/i.test(m[6]) ? 12 : 0) : 0, +(m[5] || 0));
    if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?: (\d{1,2}):(\d{2}))?/.exec(text))) return new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(text))) return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    return null;
  }

  // "2 hours ago" from Sitecore's text for a date; null for a date in the future (the server's clock or time zone is not
  // the browser's), so the pill shows Sitecore's text instead
  function ago(text) {
    const d = when(text);
    const s = d ? (Date.now() - d) / 1000 : NaN;
    if (!(s > -120)) return null;
    if (s < 60) return "just now";
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    for (const [unit, size, next] of [["minute", 60, 60], ["hour", 3600, 24], ["day", 86400, 30], ["month", 2592000, 12]]) {
      if (s < size * next) return rtf.format(-Math.floor(s / size), unit);
    }
    return rtf.format(-Math.floor(s / 31536000), "year");
  }

  const last = (path) => path.slice(path.lastIndexOf("/") + 1);
  const url = (doc, control, q) => `${doc.location.origin}/sitecore/shell/default.aspx?xmlcontrol=${control}&${new URLSearchParams(q)}`;

  // the item in the editor: sitecore://master/{ID}?lang=en&ver=1
  function current(doc) {
    const m = /^sitecore:\/\/(\w+)\/(\{[^}]+\})\?lang=([^&]+)&ver=(\d+)/.exec(doc.getElementById("__CurrentItem")?.value || "");
    return m && { db: m[1], id: m[2], lang: m[3], ver: m[4] };
  }

  // names, paths and IDs, from Quick Info
  function facts(doc, item) {
    const info = doc.querySelector(".scEditorQuickInfo");
    if (!info) return null;
    const path = [...info.querySelectorAll("input")].map((i) => i.value).find((v) => v.startsWith("/sitecore/")) || "";
    const link = info.querySelector('a[onclick*="edittemplate"]');
    const tpath = link ? link.textContent.trim() : "";
    const tid = link?.parentNode.querySelector("input")?.value || "";
    return { name: last(path), path, id: item.id, tname: last(tpath), tpath, tid };
  }

  async function gallery(doc, item, db, signal) {
    const r = await fetch(url(doc, "Gallery.Versions", { id: item.id, la: item.lang, vs: item.ver, db }), { credentials: "include", signal });
    const page = new DOMParser().parseFromString(await r.text(), "text/html");
    if (!r.ok || !page.querySelector('form[action*="Gallery.Versions"]')) throw new Error("not the version list");
    // a row per version: "1." then "Modified <b>date</b> by <b>user</b>."
    return [...page.querySelectorAll("tr")].map((tr) => {
      const b = tr.querySelectorAll("b");
      return b.length === 2 && { ver: (/^(\d+)\./.exec(tr.textContent.trim()) || [])[1], date: b[0].textContent.trim(), user: b[1].textContent.trim() };
    }).filter(Boolean);
  }

  // A version's workflow and state, from the menu under the Review tab's workflow button: "The item is in the <b>Draft</b>
  // state<br>in the <b>Sample Workflow</b> workflow.", a lock after a double break, then Edit and the state's commands.
  // ponytail: Sitecore names no final state here; one with no commands (Sample Workflow's Approved) is taken as final,
  // so a final state with commands of its own reads as still in workflow
  function flowOf(page) {
    const text = page.querySelector("div.scMenuItem");
    if (!text) return { workflow: null }; // a template without the Workflow field
    const [about, lock] = text.innerHTML.split(/<br\s*\/?>\s*<br\s*\/?>/i);
    const box = page.createElement("div");
    box.innerHTML = about; // an inert parsed page: nothing in it runs
    const b = [...box.querySelectorAll("b")].map((x) => x.textContent.trim());
    if (b.length < 2) return { workflow: b[0] || null, state: null };
    // a lock can hide the commands, so a locked version is never taken as final
    return { workflow: b[1], state: b[0], final: lock === undefined && !page.querySelector('[onclick*="item:workflow("]') };
  }

  async function workflow(doc, item, ver, signal) {
    const r = await fetch(url(doc, "Gallery.WorkflowEdit", { id: item.id, la: item.lang, vs: ver, db: item.db }), { credentials: "include", signal });
    const page = new DOMParser().parseFromString(await r.text(), "text/html");
    if (!r.ok || !page.querySelector('form[action*="Gallery.WorkflowEdit"]')) throw new Error("not the workflow menu");
    return flowOf(page);
  }

  // The item's publishing restrictions, from its Publishing Settings dialog (Publish tab, Change) opened read-only: the
  // item's Publishable box and dates, each version's, and the publishing targets ticked (none ticked: every target).
  // Dates are Sitecore's text for them, in the user's format and the server's time.
  function rulesOf(page) {
    const value = (id) => page.getElementById(id)?.getAttribute("value") || "";
    const date = (id) => {
      const text = [value(`${id}_date`), value(`${id}_time`)].filter(Boolean).join(" ");
      const at = text && when(text);
      return at ? { text, at } : null;
    };
    const versions = {};
    for (const box of page.querySelectorAll('input[id^="hide_"]')) {
      const v = box.id.slice(5);
      versions[v] = { publishable: box.hasAttribute("checked"), from: date(`validfrom_${v}`), to: date(`validto_${v}`) };
    }
    const targets = [...page.querySelectorAll('input[id^="pb_"][checked]')].map((t) => (t.nextSibling?.textContent || "").trim());
    return { publishable: page.getElementById("NeverPublish").hasAttribute("checked"), from: date("Publish"), to: date("Unpublish"), versions, targets };
  }

  async function rules(doc, item, signal) {
    const r = await fetch(url(doc, "SetPublishing", { id: item.id, la: item.lang, vs: item.ver, db: item.db, ro: 1 }), { credentials: "include", signal });
    const page = new DOMParser().parseFromString(await r.text(), "text/html");
    if (!r.ok || !page.getElementById("NeverPublish")) throw new Error("not the publishing settings");
    return rulesOf(page);
  }

  const top = (rows) => rows.reduce((n, r) => Math.max(n, +r.ver || 0), 0);
  const short = (d) => d.at.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  // Why a version, or the whole item, cannot go live now: null when it can (or the rules could not be read).
  function heldVersion(rules, v, now) {
    const r = rules && rules.versions[v];
    if (!r) return null;
    if (!r.publishable) return { icon: "hidden", text: `v${v} not publishable`, why: `Version ${v}'s Publishable box is unticked` };
    if (r.from && r.from.at > now) return { icon: "calendar", text: `v${v} from ${short(r.from)}`, why: `Version ${v} can be published from ${r.from.text}` };
    if (r.to && r.to.at <= now) return { icon: "hidden", text: `v${v} expired`, why: `Version ${v} stopped being publishable on ${r.to.text}` };
    return null;
  }
  // ponytail: the web database's target is taken to be the one named Internet (or web); one named otherwise reads as left out
  function heldItem(rules, now) {
    if (!rules) return null;
    if (!rules.publishable) return { icon: "ban", text: "Never publishes", why: "The item's Publishable box is unticked" };
    if (rules.from && rules.from.at > now) return { icon: "calendar", text: `Publishes from ${short(rules.from)}`, why: `The item can be published from ${rules.from.text}` };
    if (rules.to && rules.to.at <= now) return { icon: "ban", text: "Not publishable", why: `The item stopped being publishable on ${rules.to.text}` };
    if (rules.targets.length && !rules.targets.some((t) => /^(internet|web)$/i.test(t))) return { icon: "ban", text: "Not for web", why: `Its publishing targets (${rules.targets.join(", ")}) leave out Internet` };
    return null;
  }

  // The version the next publish puts in web: master's newest that its settings let go live (its workflow aside); 0 for none.
  function candidate(mine, rules, now = new Date()) {
    if (heldItem(rules, now)) return 0;
    const vers = [...new Set(mine.map((r) => +r.ver || 0))].sort((a, b) => b - a);
    return vers.find((v) => v && !heldVersion(rules, v, now)) || 0;
  }

  // What web has against what the next publish would put there: rows from gallery() for each database, rules from
  // rules() (null when they could not be read), flow from workflow() for candidate() (undefined when web already has it,
  // null when it could not be read). The pill is one part when nothing is live and nothing can go, else what is live
  // and, beside it, the one thing to know next, most serious first; the tooltip says the rest.
  function published(mine, web, flow, rules = null, now = new Date()) {
    const newest = top(mine);
    const live = top(web);
    const row = (rows, v) => rows.find((r) => +r.ver === v);
    const item = heldItem(rules, now);
    const goes = candidate(mine, rules, now);
    const notes = [];
    let next = null;
    if (!live && !goes) {
      // nothing in web, and nothing can go
      const h = item || heldVersion(rules, newest, now);
      if (h) return { state: "held", icon: h.icon, text: item ? h.text : h.icon === "calendar" ? `Publishes from ${short(rules.versions[newest].from)}` : "Not publishable", title: `${h.why}, so no version of it is published.`, next: null };
    }
    if (live && item) {
      next = { state: "down", icon: "takedown", text: "comes down on next publish", title: `${item.why}, so the next publish removes it from web.` };
    } else if (live && !row(mine, live)) {
      next = { state: "gone", text: "not in master", title: `Version ${live} is no longer in master; publishing the item brings web in line.` };
    } else if (live && goes < live) {
      const why = heldVersion(rules, live, now).why;
      next = goes
        ? { state: "down", icon: "back", text: `back to v${goes} on next publish`, title: `${why}, so the next publish puts version ${goes} back.` }
        : { state: "down", icon: "takedown", text: "comes down on next publish", title: `${why}, so the next publish removes it from web.` };
    } else if (goes > live) {
      if (flow && flow.state && !flow.final) next = { state: "flow", text: `v${goes} · ${flow.state}`, title: `Version ${goes} is in the ${flow.state} state of the ${flow.workflow} workflow.` };
      else if (flow && flow.workflow && !flow.state) next = { state: "flow", text: `v${goes} · no state`, title: `Version ${goes} is in the ${flow.workflow} workflow but has no state.` };
      else if (flow) next = { state: "ready", text: `v${goes} ready to publish`, title: `Version ${goes} goes live on the next publish.` };
      else if (live) next = { state: "ready", text: `v${goes} not published`, title: `Version ${goes} is not in web yet.` };
      if (newest > goes) notes.push(`${heldVersion(rules, newest, now).why}.`);
    } else if (live) {
      const h = newest > live && heldVersion(rules, newest, now);
      const m = row(mine, live);
      const w = row(web, live);
      const edited = m.date !== w.date || m.user !== w.user ? `It was changed after it was published: ${m.date} by ${m.user}.` : "";
      if (h) {
        next = { state: "held", icon: h.icon, text: h.text, title: `${h.why}, so publishing keeps version ${live}.` };
        if (edited) notes.push(edited);
      } else if (edited) next = { state: "edited", text: "edited since", title: edited };
      else {
        const end = [rules && rules.to, rules && rules.versions[live] && rules.versions[live].to].filter((d) => d && d.at > now).sort((a, b) => a.at - b.at)[0];
        if (end) next = { state: "held", icon: "calendar", text: `until ${short(end)}`, title: `It stops being publishable on ${end.text}; the first publish after that takes it down.` };
      }
    }
    const head = live
      ? { state: "yes", text: next ? `Live v${live}` : `Published · v${live}`, title: `Version ${live} is live in the web database.` }
      : { state: "no", text: "Not published", title: "No version in this language in the web database." };
    return { ...head, title: [head.title, next && next.title, ...notes].filter(Boolean).join(" "), next };
  }

  // the bases of a template, as its Inheritance tab nests them, Sitecore's own left out with everything under them
  function bases(doc, item, tid) {
    if (!inheritance.has(tid)) {
      const ask = fetch(url(doc, "TemplateInheritance", { id: tid, la: item.lang, language: item.lang, vs: 1, version: 1, database: item.db, readonly: 0, db: item.db }), { credentials: "include" })
        .then((r) => r.text())
        .then((html) => {
          const list = new DOMParser().parseFromString(html, "text/html").getElementById("TemplateList");
          if (!list) throw new Error("not the inheritance list");
          const out = [];
          (function walk(box, depth) {
            for (const a of box.querySelectorAll(":scope > a.scTemplate")) {
              const path = (a.querySelector(".scTemplatePath")?.textContent || "").replace(/^\s*-\s*/, "");
              if (SYSTEM.test(path)) continue;
              const id = (/\{[0-9A-F-]{36}\}/i.exec(a.getAttribute("onclick") || "") || [])[0];
              const name = [...a.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
              out.push({ id, name, folder: path.replace(/^\/sitecore\/templates\//i, "").slice(0, -name.length - 1), depth });
              // its fields, then its own bases, before the next template
              let sub = a.nextElementSibling;
              while (sub && !sub.matches("a.scTemplate, .scBaseTemplates")) sub = sub.nextElementSibling;
              if (sub?.matches(".scBaseTemplates")) walk(sub, depth + 1);
            }
          })(list, 0);
          return out;
        });
      ask.catch(() => inheritance.delete(tid)); // a failure is asked again next time
      inheritance.set(tid, ask);
    }
    return inheritance.get(tid);
  }

  async function copy(doc, text) {
    try {
      await doc.defaultView.navigator.clipboard.writeText(text);
    } catch {
      // http, or no clipboard permission: the old way
      const area = doc.createElement("textarea");
      area.value = text;
      area.style.cssText = "position:fixed;opacity:0";
      doc.body.append(area);
      area.select();
      doc.execCommand("copy");
      area.remove();
    }
  }

  function chip(doc, kind) {
    const c = doc.createElement("sct-item-chip");
    c.dataset.kind = kind;
    c.dataset.loading = "";
    c.innerHTML = `${ICONS[kind === "modified" ? "clock" : "globe"]}<sct-item-wait></sct-item-wait>`;
    return c;
  }

  function fill(c, icon, text, title, state) {
    delete c.dataset.loading;
    if (state) c.dataset.state = state;
    c.innerHTML = icon;
    c.append(text);
    c.title = title;
  }

  // the chips' facts, once the browser has a moment
  function load(ctx, header, status, item) {
    if (loading) loading.abort();
    const ctrl = (loading = new AbortController());
    const win = ctx.doc.defaultView;
    const later = win.requestIdleCallback ? (fn) => win.requestIdleCallback(fn, { timeout: 1500 }) : (fn) => win.setTimeout(fn, 200);
    later(async () => {
      if (ctrl.signal.aborted) return;
      const [mod, pub] = status.children;
      const [mine, web, settings] = await Promise.allSettled([
        gallery(ctx.doc, item, item.db, ctrl.signal),
        pub ? gallery(ctx.doc, item, "web", ctrl.signal) : null,
        pub ? rules(ctx.doc, item, ctrl.signal) : null,
      ]);
      if (ctrl.signal.aborted || !header.isConnected) return;
      const v = mine.status === "fulfilled" && (mine.value.find((r) => r.ver === item.ver) || mine.value.at(-1));
      if (v) fill(mod, ICONS.clock, `${ago(v.date) || v.date} · ${v.user.slice(v.user.lastIndexOf("\\") + 1)}`, `Modified ${v.date} by ${v.user}`);
      else mod.remove(); // signed out, or a page Sitecore would not give: no chip rather than a wrong one
      if (pub && web.status === "fulfilled" && mine.status === "fulfilled" && mine.value.length) {
        const set = settings.status === "fulfilled" ? settings.value : null; // without them, nothing is taken as held back
        const goes = candidate(mine.value, set);
        const flow = goes > top(web.value) ? await workflow(ctx.doc, item, goes, ctrl.signal).catch(() => null) : undefined;
        if (ctrl.signal.aborted || !header.isConnected) return;
        const p = published(mine.value, web.value, flow, set);
        fill(pub, ICONS[p.icon] || (p.state === "yes" ? ICONS.globe : ICONS.globeOff), p.text, p.title, p.state);
        if (p.next) {
          // two halves, each with its own tint
          const live = ctx.doc.createElement("sct-item-live");
          live.append(...pub.childNodes);
          pub.append(live);
          const n = ctx.doc.createElement("sct-item-next");
          n.dataset.state = p.next.state;
          n.innerHTML = `<sct-item-sr>, </sct-item-sr>${ICONS[p.next.icon || p.next.state]}`;
          n.append(p.next.text);
          pub.append(n);
        }
      } else pub?.remove();
      status.removeAttribute("aria-busy");
    });
  }

  // A menu under its button: arrows, Home and End move, Escape and Tab close, focus goes back to the button.
  function menu(ctx, button, label, build) {
    const { doc } = ctx;
    for (const open of doc.querySelectorAll("sct-item-menu")) open.close();
    const m = ctx.own(doc.createElement("sct-item-menu"));
    m.id = button.getAttribute("aria-controls");
    m.setAttribute("role", "menu");
    m.setAttribute("aria-label", label);
    const items = () => [...m.querySelectorAll('[role="menuitem"]')];
    const go = (i) => { const all = items(); if (all.length) all[(i + all.length) % all.length].focus(); };
    const outside = (e) => !m.contains(e.target) && e.target !== button && !button.contains(e.target) && m.close();
    m.close = (focus) => {
      doc.removeEventListener("mousedown", outside, true);
      doc.defaultView.removeEventListener("blur", m.close);
      m.remove();
      button.setAttribute("aria-expanded", "false");
      if (focus) button.focus();
    };
    m.addEventListener("keydown", (e) => {
      const at = items().indexOf(doc.activeElement);
      const keys = { ArrowDown: () => go(at + 1), ArrowUp: () => go(at - 1), Home: () => go(0), End: () => go(-1), Escape: () => m.close(true), Tab: () => m.close() };
      if (!keys[e.key]) return;
      if (e.key !== "Tab") e.preventDefault();
      e.stopPropagation(); // the Content Editor's own shortcuts stay out of it
      keys[e.key]();
    });
    doc.addEventListener("mousedown", outside, true);
    doc.defaultView.addEventListener("blur", m.close);
    const r = button.getBoundingClientRect();
    m.style.top = `${Math.round(r.bottom + 3)}px`;
    m.style.right = `${Math.round(doc.documentElement.clientWidth - r.right)}px`;
    doc.body.append(m);
    button.setAttribute("aria-expanded", "true");
    build(m);
    return m;
  }

  function group(doc, m, label) {
    const g = doc.createElement("sct-item-group");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", label);
    const h = doc.createElement("sct-item-heading");
    h.setAttribute("aria-hidden", "true");
    h.textContent = label;
    g.append(h);
    m.append(g);
    return g;
  }

  function entry(doc, g, label, value, act, depth = 0) {
    const b = doc.createElement("button");
    b.type = "button";
    b.tabIndex = -1;
    b.setAttribute("role", "menuitem");
    const name = doc.createElement("span");
    name.textContent = label;
    if (depth) name.style.paddingInlineStart = `${depth * 12}px`;
    const v = doc.createElement("sct-item-value");
    v.textContent = value;
    b.append(name, v);
    b.title = value;
    b.addEventListener("click", () => act(b, v));
    g.append(b);
  }

  function copyMenu(ctx, button, item) {
    menu(ctx, button, "Copy", (m) => {
      const { doc } = ctx;
      const f = facts(doc, item) || { id: item.id };
      const pick = (text) => async (b, v) => {
        await copy(doc, text);
        v.textContent = "Copied";
        SCT.announce(doc, "Copied");
        setTimeout(() => m.close(true), 600);
      };
      const it = group(doc, m, "Item");
      if (f.name) entry(doc, it, "Name", f.name, pick(f.name));
      if (f.path) entry(doc, it, "Path", f.path, pick(f.path));
      entry(doc, it, "ID", f.id, pick(f.id));
      if (f.tid) {
        const t = group(doc, m, "Template");
        entry(doc, t, "Name", f.tname, pick(f.tname));
        entry(doc, t, "Path", f.tpath, pick(f.tpath));
        entry(doc, t, "ID", f.tid, pick(f.tid));
      }
      m.querySelector('[role="menuitem"]').focus();
    });
  }

  function navigateMenu(ctx, button, item, f) {
    const { doc } = ctx;
    const open = (id) => () => {
      m.close();
      setTimeout(() => SCT.gotoItem(doc, id));
    };
    const m = menu(ctx, button, "Navigate", (m) => {
      const t = group(doc, m, "Template");
      entry(doc, t, f.tname, f.tpath.replace(/^\/sitecore\/templates\//i, "").slice(0, -f.tname.length - 1), open(f.tid));
      m.querySelector('[role="menuitem"]').focus();
      const wait = doc.createElement("sct-item-note");
      wait.textContent = "Loading templates";
      wait.setAttribute("role", "status");
      m.append(wait);
      bases(doc, item, f.tid).then((list) => {
        wait.remove();
        if (!list.length) return;
        const g = group(doc, m, "Inherits from");
        for (const b of list) entry(doc, g, b.name, b.folder, open(b.id), b.depth + 1);
      }, () => (wait.textContent = "Could not load the templates"));
    });
  }

  function button(doc, icon, label, id) {
    const b = doc.createElement("button");
    b.type = "button";
    b.setAttribute("aria-haspopup", "menu");
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-controls", id);
    b.innerHTML = `${icon}<span>${label}</span>${ICONS.down}`;
    return b;
  }

  function build(ctx, header, item) {
    const { doc } = ctx;
    const panel = ctx.own(doc.createElement("sct-item-info"));
    const status = doc.createElement("sct-item-status");
    status.setAttribute("aria-busy", "true");
    status.append(chip(doc, "modified"));
    if (item.db === "master") status.append(chip(doc, "published"));
    const actions = doc.createElement("sct-item-actions");
    const n = ++serial;
    const copyButton = button(doc, ICONS.copy, "Copy", `sct-item-copy-${n}`);
    actions.append(copyButton);
    const f = facts(doc, item);
    let navButton = null;
    if (f && f.tid) {
      navButton = button(doc, ICONS.template, "Navigate", `sct-item-nav-${n}`);
      actions.append(navButton);
    }
    for (const [b, open] of [[copyButton, () => copyMenu(ctx, copyButton, item)], [navButton, () => navigateMenu(ctx, navButton, item, facts(doc, item))]]) {
      if (!b) continue;
      const toggle = () => (b.getAttribute("aria-expanded") === "true" ? doc.getElementById(b.getAttribute("aria-controls"))?.close() : open());
      b.addEventListener("click", toggle);
      b.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowDown" || b.getAttribute("aria-expanded") === "true") return;
        e.preventDefault();
        open();
      });
    }
    panel.append(status, actions);
    header.insertBefore(panel, header.firstChild); // floated right, first: it sits at the top
    load(ctx, header, status, item);
  }

  SCT.itemInfo = { published, candidate, when }; // for the unit tests

  SCT.registerAid("item-info", {
    css: `.scEditorHeader:has(>sct-item-info){display:flow-root;height:auto!important}
${SCT.important(`sct-item-info{float:right;display:flex;align-items:flex-start;gap:10px;margin:0 0 4px 16px;font-size:11.5px;line-height:1.6;color:inherit}
sct-item-status{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
sct-item-chip{display:inline-flex;align-items:center;gap:5px;padding:1px 9px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:11px;white-space:nowrap;overflow:hidden}
sct-item-live,sct-item-next{display:inline-flex;align-items:center;gap:5px;padding:1px 7px 1px 9px}
sct-item-live{border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-right:0;border-radius:11px 0 0 11px}
sct-item-next{padding:1px 9px 1px 7px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:0 11px 11px 0}
sct-item-next[data-state="flow"]{background:color-mix(in srgb,#1c7ed6 14%,transparent);border-color:color-mix(in srgb,#1c7ed6 55%,transparent)}
sct-item-chip>sct-item-next[data-state="flow"] svg{color:#1c7ed6}
sct-item-next[data-state="ready"],sct-item-next[data-state="edited"]{background:color-mix(in srgb,#e8a10c 18%,transparent);border-color:color-mix(in srgb,#e8a10c 60%,transparent)}
sct-item-chip>sct-item-next[data-state="ready"] svg,sct-item-chip>sct-item-next[data-state="edited"] svg{color:#c07f00}
sct-item-next[data-state="gone"],sct-item-next[data-state="down"]{background:color-mix(in srgb,#e03131 14%,transparent);border-color:color-mix(in srgb,#e03131 55%,transparent)}
sct-item-chip>sct-item-next[data-state="down"] svg{color:#e03131}
sct-item-chip[data-state="held"],sct-item-next[data-state="held"]{background:color-mix(in srgb,#868e96 14%,transparent);border-color:color-mix(in srgb,#868e96 62%,transparent)}
sct-item-chip[data-state="held"] svg,sct-item-chip>sct-item-next[data-state="held"] svg{color:#5c636a}
sct-item-chip>sct-item-next[data-state="gone"] svg{color:#e03131}
sct-item-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
sct-item-chip svg,sct-item-info button svg{flex:none}
sct-item-chip[data-state="yes"]{background:color-mix(in srgb,#2f9e44 13%,transparent);border-color:color-mix(in srgb,#2f9e44 55%,transparent)}
sct-item-chip[data-state="yes"] svg{color:#2f9e44}
sct-item-chip[data-state="no"]{background:color-mix(in srgb,#e8a10c 15%,transparent);border-color:color-mix(in srgb,#e8a10c 60%,transparent)}
sct-item-chip[data-state="no"] svg{color:#c07f00}
sct-item-chip[data-state]:has(>sct-item-next){padding:0;gap:0;background:none;border:0}
sct-item-chip[data-state="yes"]>sct-item-live{background:color-mix(in srgb,#2f9e44 13%,transparent);border-color:color-mix(in srgb,#2f9e44 55%,transparent)}
sct-item-chip[data-state="no"]>sct-item-live{background:color-mix(in srgb,#e8a10c 15%,transparent);border-color:color-mix(in srgb,#e8a10c 60%,transparent)}
sct-item-wait{display:inline-block;width:72px;height:9px;border-radius:5px;background:color-mix(in srgb,currentColor 12%,transparent)}
sct-item-chip[data-kind="published"] sct-item-wait{width:52px}
sct-item-actions{display:flex;flex-direction:column;gap:5px;padding-left:10px;border-left:1px solid color-mix(in srgb,currentColor 15%,transparent)}
sct-item-info button{all:unset;display:inline-flex;align-items:center;gap:4px;box-sizing:border-box;padding:1px 8px;border:1px solid color-mix(in srgb,currentColor 30%,transparent);border-radius:3px;font:inherit;color:inherit;cursor:pointer;white-space:nowrap}
sct-item-info button:hover,sct-item-info button[aria-expanded="true"]{background:color-mix(in srgb,currentColor 9%,transparent)}
sct-item-info button:focus-visible{outline:2px solid var(--sct-focus-ring,Highlight);outline-offset:1px}
sct-item-menu{position:fixed;z-index:2147483646;display:block;width:max-content;min-width:220px;max-width:90vw;max-height:70vh;overflow:auto;box-sizing:border-box;padding:4px 0;border:1px solid var(--sct-border,#b5b5b5);border-radius:var(--sct-radius,3px);background:var(--sct-panel-bg,Canvas);color:var(--sct-panel-fg,CanvasText);font-size:12px;line-height:1.5;box-shadow:0 4px 14px rgba(0,0,0,.22);text-align:start}
sct-item-group{display:block}
sct-item-group+sct-item-group{margin-top:4px;padding-top:4px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
sct-item-note{display:block;padding:3px 12px;opacity:.7}
sct-item-heading{display:block;padding:3px 12px 1px;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;opacity:.7}
sct-item-menu button{all:unset;display:flex;justify-content:space-between;gap:18px;box-sizing:border-box;width:100%;padding:3px 12px;cursor:pointer;color:inherit;font:inherit;white-space:nowrap}
sct-item-menu[aria-label="Navigate"] sct-item-value{max-width:none}
sct-item-menu button:hover,sct-item-menu button:focus{background:var(--sct-accent,Highlight);color:var(--sct-accent-fg,HighlightText)}
sct-item-value{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.65;font-family:Consolas,Menlo,monospace;font-size:11px}`)}`,
    apply(ctx) {
      const item = current(ctx.doc);
      if (!item) return;
      for (const header of ctx.doc.querySelectorAll(HEADER)) {
        if (!header.querySelector(":scope > sct-item-info") && header.querySelector(".scEditorHeaderTitlePanel")) build(ctx, header, item);
      }
    },
    revert({ doc }) {
      if (loading) loading.abort();
      loading = null;
      for (const m of doc.querySelectorAll("sct-item-menu")) m.close();
    },
  });
})(globalThis);
