const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.SCT = globalThis.SCT || {};
globalThis.SCT.registerAid ||= () => {};
globalThis.SCT.important ||= (css) => css;
require("../../extension/lib/aids/field-length.js");
const { ruleLimit, regexLimit } = globalThis.SCT.fieldLength;

test("field-length: the limit from a MaxLength rule's Parameters, and from a length-only Validation regex", () => {
  const MAX = "Sitecore.Data.Validators.FieldValidators.MaxLengthFieldValidator,Sitecore.Kernel";
  assert.equal(ruleLimit(MAX, "MaxLength=40"), 40);
  assert.equal(ruleLimit(MAX, "Text=Too long&maxlength=50"), 50);
  assert.equal(ruleLimit(MAX, ""), null);
  assert.equal(ruleLimit("Sitecore.Data.Validators.FieldValidators.MinLengthFieldValidator,Sitecore.Kernel", "minlength=8"), null);
  assert.equal(regexLimit("^.{0,50}$"), 50);
  assert.equal(regexLimit("^[\\s\\S]{1,120}$"), 120);
  assert.equal(regexLimit("^[a-z]{0,50}$"), null); // not only a length
  assert.equal(regexLimit(""), null);
});
