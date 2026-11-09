// @flow - Solutions as four groups beside a navigation that stays put (2026-11-08, after
// productlasso.com): scrolling lights the group in view, and a press on a name scrolls to its
// group. On a tablet or a phone the navigation is a row of chips held under the bar.

import { expect, test } from "./support/test";
import { openHome, scrollToTop, settle } from "./support/page";

const GROUPS = [
  ["sol-reporting", "Reporting"],
  ["sol-tables", "Team tables"],
  ["sol-automation", "Automation"],
  ["sol-local", "Local formats"],
] as const;

test.describe("@flow Solutions' navigation", () => {
  test("lights the group in view as the page scrolls", async ({ page }) => {
    await openHome(page);
    const lit = page.locator('.sol-nav a[aria-current="true"]');
    for (const [id, name] of GROUPS) {
      await scrollToTop(page, page.locator(`#${id}`));
      await settle(page);
      await expect(lit, `${name} is lit with its group in view`).toHaveText(name);
    }
  });

  test("a press on a name scrolls to its group and keeps the navigation in view", async ({ page }) => {
    await openHome(page);
    await scrollToTop(page, page.locator("#sol-reporting"));
    await page.locator(".sol-nav a", { hasText: "Local formats" }).click();
    await expect.poll(() => page.locator("#sol-local").evaluate((el) => Math.round(el.getBoundingClientRect().top)), { timeout: 5_000 }).toBeLessThan(260);
    await expect(page.locator(".sol-nav")).toBeInViewport();
    await expect(page.locator('.sol-nav a[aria-current="true"]')).toHaveText("Local formats");
  });
});
