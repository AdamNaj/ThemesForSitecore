// Rasterises extension/icons/icon.svg into the PNG sizes the manifest uses.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const svg = readFileSync("extension/icons/icon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: `extension/icons/icon-${size}.png`, omitBackground: true });
}
await browser.close();
