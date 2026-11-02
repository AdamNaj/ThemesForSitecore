// Character limits: every Single-Line and Multi-Line Text field shows how many characters it holds under it ("15
// characters"), wherever Sitecore draws item fields (the Content Editor, the field editor). One whose validation rules
// cap its length shows "15 / 40", with "3 left" once it is nine tenths full and "5 too many" past the limit, so the state
// is in words, not only in the emphasis. The type and the limit are not in the page: it is the smallest of the field's own rules (its Quick Action Bar, Validate
// Button, Validator Bar and Workflow, and the same four on its field type under /sitecore/system/Settings/Validation
// Rules/Field Types) that are Sitecore's MaxLengthFieldValidator (Parameters "MaxLength=40"), and its Validation regex
// when that is a plain ^.{0,40}$. They are read from the Item Service as the signed-in user, once per field and rule
// for the page's life, after the editor has drawn. A field with no such rule, or only a custom validator, shows its count
// alone; an install with the Item Service shut off counts every text-like input, Integer and Number too.
// ponytail: one request per text field the first time its template shows; a batch endpoint if that ever shows up slow
(function (root) {
  const SCT = (root.SCT = root.SCT || {});

  const CONTROL = 'input.scContentControl[id^="FIELD"], textarea.scContentControlMemo[id^="FIELD"]';
  const RULES = ["Quick Action Bar", "Validate Button", "Validator Bar", "Workflow"];
  const GUID = /\{[0-9A-F-]{36}\}/gi;
  const TEXT = /^(Single-Line Text|Multi-Line Text|text|memo)$/i; // field types counted, with the old names
  const asked = new Map(); // db + item ID or path -> Promise of its fields, or null
  let down = false; // the Item Service said no once: ask no more on this page

  // the limit a rule's Type and Parameters set, or null
  function ruleLimit(type, parameters) {
    if (!/MaxLengthFieldValidator/.test(type || "")) return null;
    for (const [k, v] of new URLSearchParams(parameters || "")) if (k.toLowerCase() === "maxlength" && +v > 0) return +v;
    return null;
  }
  // the limit a Validation regex sets when it is only a length: ^.{0,40}$ or ^[\s\S]{1,40}$
  function regexLimit(pattern) {
    const m = /^\^(?:\.|\[\\s\\S\])\{\d*,(\d+)\}\$$/.exec((pattern || "").trim());
    return m ? +m[1] : null;
  }
  // what the server counts: a textarea's line breaks are posted as CRLF
  const count = (control) => control.value.length + (control.tagName === "TEXTAREA" ? (control.value.match(/\n/g) || []).length : 0);

  function item(doc, db, idOrPath, fields) {
    const key = `${db}|${idOrPath}`;
    if (!asked.has(key)) {
      const q = new URLSearchParams({ database: db, fields: fields.join(",") });
      const id = idOrPath.startsWith("/") ? "" : idOrPath.replace(/[{}]/g, "");
      if (!id) q.set("path", idOrPath);
      const ask = down ? Promise.resolve(null) : fetch(`${doc.location.origin}/sitecore/api/ssc/item/${id}?${q}`, { credentials: "include" })
        .then((r) => {
          if (r.status === 401 || r.status === 403) down = true;
          return r.ok ? r.json() : null;
        })
        .catch(() => null);
      asked.set(key, ask);
    }
    return asked.get(key);
  }

  // the field's type and limit; { type: null } when the Item Service cannot say
  async function limitOf(doc, db, fieldId) {
    const field = await item(doc, db, fieldId, ["Type", "Validation", ...RULES]);
    if (!field) return { type: null, max: null };
    const kind = field.Type && (await item(doc, db, `/sitecore/system/Settings/Validation Rules/Field Types/${field.Type}`, RULES));
    const ids = new Set([field, kind].filter(Boolean).flatMap((f) => RULES.flatMap((r) => (f[r] || "").match(GUID) || [])));
    const limits = await Promise.all([...ids].map(async (id) => {
      const rule = await item(doc, db, id, ["Type", "Parameters"]);
      return rule && ruleLimit(rule.Type, rule.Parameters);
    }));
    const all = [...limits, regexLimit(field.Validation)].filter((n) => n > 0);
    return { type: field.Type || null, max: all.length ? Math.min(...all) : null };
  }

  function show(control) {
    const out = control.ownerDocument.getElementById(`sct-length-${control.id}`);
    if (!out) return;
    const max = +out.dataset.sctMax || 0;
    const n = count(control);
    const state = !max ? "" : n > max ? "over" : n >= max * 0.9 ? "near" : "";
    const text = !max ? `${n} character${n === 1 ? "" : "s"}`
      : `${n} / ${max}${state === "over" ? `, ${n - max} too many` : state === "near" ? `, ${max - n} left` : ""}`;
    if (out.textContent !== text) out.textContent = text;
    if (out.dataset.sctState !== state) out.dataset.sctState = state;
  }

  function onInput(e) {
    if (e.target.matches && e.target.matches(CONTROL)) show(e.target);
  }

  SCT.registerAid("field-length", {
    css: SCT.important(`[data-sct-length]{display:block;margin:2px 0 0;text-align:right;font-size:11px;line-height:1.4;color:var(--sct-muted-fg,GrayText);font-variant-numeric:tabular-nums}
[data-sct-length][data-sct-state=near]{font-weight:700;color:inherit}
[data-sct-length][data-sct-state=over]{font-weight:700;color:inherit;text-decoration:underline wavy #d13438;text-underline-offset:3px}`),
    apply(ctx) {
      const { doc } = ctx;
      if (!doc.documentElement.hasAttribute("data-sct-length-on")) {
        ctx.setAttr(doc.documentElement, "data-sct-length-on", "");
        ctx.listen(doc, "input", onInput, true);
      }
      for (const control of doc.querySelectorAll(CONTROL)) {
        if (control.hasAttribute("data-sct-length-asked")) {
          show(control);
          continue;
        }
        // its item and field, from Sitecore's own handler: sitecore://master/{item}?lang=en&ver=1&fld={field}&ctl=...
        // (the Content Editor, the field editor and every dialog that draws fields the same way)
        const m = /sitecore:\/\/(\w+)\/\{[^}]+\}\?[^']*?\bfld=(\{[0-9A-F-]{36}\})/i.exec(control.getAttribute("onfocus") || "");
        if (!m) continue;
        ctx.setAttr(control, "data-sct-length-asked", "");
        limitOf(doc, m[1], m[2]).then(({ type, max }) => {
          // Integer and Number draw the same input: counted only when the Item Service says it is text, or cannot say
          if ((type && !TEXT.test(type)) || !control.isConnected || doc.getElementById(`sct-length-${control.id}`)) return;
          const out = ctx.own(doc.createElement("span"));
          out.id = `sct-length-${control.id}`;
          out.setAttribute("data-sct-length", "");
          if (max) {
            out.dataset.sctMax = String(max);
            out.title = `This field allows ${max} characters`;
          }
          control.after(out);
          show(control);
        });
      }
    },
  });

  SCT.fieldLength = { ruleLimit, regexLimit }; // for the tests
})(globalThis);
