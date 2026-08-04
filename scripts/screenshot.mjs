import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/run/current-system/sw/bin/google-chrome",
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1440 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

console.log("→ /");
await page.goto("http://localhost:7842", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-landing.png`, fullPage: false });

console.log("→ /create");
await page.goto("http://localhost:7842/create", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/02-create-default.png`, fullPage: true });

// Try a different theme
console.log("→ /create — switch theme to aurora");
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const t = buttons.find((b) => b.textContent?.trim() === "Aurora");
  t?.click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/03-create-aurora.png`, fullPage: true });

// Switch star chart to dreamscape
console.log("→ /create — switch star chart to dreamscape");
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const t = buttons.find((b) => b.textContent?.trim() === "Dreamscape");
  t?.click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/04-create-dreamscape.png`, fullPage: true });

// Switch compass to compass-rose
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll("button"));
  const t = buttons.find((b) => b.textContent?.trim() === "Compass Rose");
  t?.click();
});
await page.waitForTimeout(1500);

// Mobile viewport
await ctx.close();
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
});
const mpage = await mctx.newPage();
await mpage.goto("http://localhost:7842/create", { waitUntil: "networkidle" });
await mpage.waitForTimeout(2500);
await mpage.screenshot({ path: `${OUT}/05-create-mobile.png`, fullPage: true });

await browser.close();

if (errors.length) {
  console.error("⚠ Console errors captured:");
  for (const e of errors) console.error("  " + e);
} else {
  console.log("✓ no console errors");
}
console.log("✓ screenshots written to " + OUT + "/");