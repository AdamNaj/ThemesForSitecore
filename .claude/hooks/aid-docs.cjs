// PostToolUse hook: after an edit to an accessibility aid (extension/lib/aids/<id>.js) or to settings.js, where the
// AIDS table lives, remind the agent that docs/accessibility.md (the aids) or docs/ui-improvements.md (the UI
// improvements, ui: true) describes it and must follow.
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let file = "";
  try {
    const e = JSON.parse(input);
    file = (e.tool_input && e.tool_input.file_path) || (e.tool_response && e.tool_response.filePath) || "";
  } catch {
    return;
  }
  const aid = /extension[\\/]lib[\\/]aids[\\/]([\w-]+)\.js$/.exec(file);
  const settings = /extension[\\/]lib[\\/]settings\.js$/.test(file);
  if (!aid && !settings) return;
  const what = aid ? `the ${aid[1]} aid` : "settings.js (if you touched the AIDS table: an aid's name, hint, needs or surfaces)";
  const id = aid ? aid[1] : "<id>";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `You changed ${what}. docs/accessibility.md describes every aid and docs/ui-improvements.md every UI improvement (ui: true in AIDS): when the change is done, read its section and update what it says the aid does, shows and tells a screen reader, then run node tools/aid-docs.cjs ${id} to shoot it off and on in live 10.4 and stamp it (--stamp ${id} if nothing on screen changed). A new aid needs a section and a scene in tools/aid-docs.cjs. npm test fails until the stamp matches.`,
    },
  }));
});
