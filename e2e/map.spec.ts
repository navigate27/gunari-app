import { test, expect } from "@playwright/test";

test("Map Print flow: load, change theme, save", async ({ page }) => {
  await page.goto("/map");

  // Page renders
  await expect(page.getByText("GUNARI", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Randomize/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Save$/ })).toBeVisible();

  // Canvas is present
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

  // Wait for the OSM fetch to complete (Save + Randomize buttons become enabled
  // once `geometry` is non-null). The fetch hits the real Overpass API and may
  // take several seconds; a fixed waitForTimeout is unreliable. 30 s allows for
  // dev-server first-compile overhead plus the Overpass round-trip.
  await expect(page.getByRole("button", { name: /^Save$/ })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole("button", { name: /Randomize/i })).toBeEnabled({ timeout: 5000 });

  // Change theme to Midnight (click the radio). Theme changes do not re-fetch
  // (only location/zoom are in the effect deps), so Save stays enabled. The
  // radio input is visually hidden via `sr-only`, so force the click.
  await page.getByRole("radio", { name: /Midnight/i }).click({ force: true });

  // Click Save and expect a download.
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: /^Save$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/gunari-map-.*\.png/);
});