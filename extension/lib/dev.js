// Development hooks (page messages that reload the extension or switch themes).
// tools/build.mjs writes `false` here in every packaged build.
(function (root) {
  (root.SCT = root.SCT || {}).devHooks = true;
})(globalThis);
