// A :has() on <html> or <body> that looks at descendants makes Chrome search the whole page again for every element
// anything inserts: under Los Gatos, Menlo and Copenhagen each restyle cost 500 times Native's, and with the Sitecore
// Extensions add-on each item the Content Editor opened took seconds. Themes select the page with data-sct-page.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const FILES = [...walk(path.join(ROOT, "extension")), ...walk(path.join(ROOT, "tools"))].filter((f) => /\.(css|js|cjs|mjs)$/.test(f));

// file -> how many it may keep, and why
const KNOWN = {
  "extension/themes/notebook/speak.css": 3, // its & is the Experience Editor's .sc-pageeditbar, not <html>
};

// each :has( whose compound is html, body, :root or a nesting & (attributes and pseudo-classes aside), with an
// argument that does not start with a child or sibling combinator
function rooted(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const found = [];
  let i = -1;
  while ((i = text.indexOf(":has(", i + 1)) >= 0) {
    let s = i;
    let depth = 0;
    // back to the start of the compound, over brackets and parentheses
    while (s > 0) {
      const c = text[s - 1];
      if (c === "]" || c === ")") depth++;
      else if (c === "[" || c === "(") {
        if (depth) depth--;
        else {
          // the :has sits in a :not(), :is() or :where(): its compound is the one round that
          const wrap = /:(not|is|where)$/.exec(text.slice(0, s - 1));
          if (!wrap) break;
          s -= wrap[0].length;
        }
      } else if (!depth && /[\s,{}>+~]/.test(c)) break;
      s--;
    }
    // the compound without its attributes, its bracketed groups and the wrapper the :has sits in: "html:not", "body",
    // "&", ".panel", ":is:not" (a subject named inside :is()), "" (attributes only)
    let head = text.slice(s, i).replace(/\[[^\]]*\]/g, "");
    for (let was = ""; was !== head; ) (was = head), (head = head.replace(/\([^()]*\)/g, ""));
    head = head.replace(/\(.*$/, "");
    const type = head.replace(/:[\w-]+/g, "");
    // attributes and pseudo-classes alone are <html>'s only straight after a generator's ${prefix}
    const root = /^(html|body|&)$/.test(type) || head.startsWith(":root") || (type === "" && !/:(is|where)/.test(head) && text[s - 1] === "}" && /[[:]/.test(text[s]));
    // the argument, and whether it reaches past children: a descendant step anywhere in it (":has(> form .x)" too)
    let e = i + 5;
    for (let d = 1; e < text.length && d; e++) d += text[e] === "(" ? 1 : text[e] === ")" ? -1 : 0;
    let arg = text.slice(i + 5, e - 1).trim().replace(/\[[^\]]*\]/g, "[]");
    for (let was = ""; was !== arg; ) (was = arg), (arg = arg.replace(/\([^()]*\)/g, ""));
    const deep = !/^[>+~]/.test(arg) || /[^\s>+~,]\s+[^\s>+~,]/.test(arg);
    if (root && deep) found.push(text.slice(Math.max(0, s - 20), i + 40).replace(/\s+/g, " "));
  }
  return found;
}

test("no :has() on <html> or <body> searches the whole page", () => {
  const over = [];
  for (const f of FILES) {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    if (rel === "extension/popup/popup.css") continue; // the popup is our own small page
    const found = rooted(fs.readFileSync(f, "utf8"));
    if (found.length > (KNOWN[rel] || 0)) over.push(`${rel}: ${found.length}, e.g. ${found[0]}`);
  }
  assert.deepEqual(over, [], "a :has() on <html> or <body> over descendants; use data-sct-page (themes/README.md)");
});

test("the check finds what it is for", () => {
  assert.equal(rooted('html[data-sct-theme="x"] body:has(.scGalleryGrip) a{}').length, 1);
  assert.equal(rooted('html[data-sct-theme="x"]:not(#a):has(#Desktop) .b{}').length, 1);
  assert.equal(rooted("html { &:has(.dock) #x{} }").length, 1);
  assert.equal(rooted('body:is([data-sct-page~="gallery"] > *) a{}').length, 0);
  assert.equal(rooted(".panel:has(> .x){} tr:has(td){}").length, 0);
  assert.equal(rooted('html[a]:not(:has(#TreeViewToggle)) .x{} body:not(:has(#g)){}').length, 2);
  assert.equal(rooted(".nav:not(:has(.group)) .x{} .r :is(div, span):not(:has(> *)){}").length, 0);
  assert.equal(rooted('.m :is(.a, tr:not([c]):has(> .i)):has(.h){} html [data-sc-id="C"]:not(:has(.g)){}').length, 0);
  assert.equal(rooted("const P = `${X}[data-sct-window-title]:has(.standardWindowCaption)`").length, 1);
  assert.equal(rooted("html body:has(> form .DesktopArea) a{} html:has(> body > form > .x) b{}").length, 1);
});
