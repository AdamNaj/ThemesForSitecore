const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "test/e2e",
  // Playwright empties its output folder on every run; test-results itself holds verify screenshots and boards
  outputDir: "test-results/playwright",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  projects: [
    { name: "fixtures", testMatch: /(domkit|import|engine)\.spec\.js/ },
    { name: "sitecore", testMatch: /sitecore\.spec\.js/, timeout: 600_000 },
  ],
});
