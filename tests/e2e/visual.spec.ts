// @visual - every part of the page and every state of the demo against a committed screenshot,
// at the five sizes chosen to stand for the rest (playwright.config.ts): what a rule cannot
// say - a colour, a curve, the weight of a shadow, a drawing in a card.
//
// A baseline records a screen as it is, broken or not, so the rules come first (layout.spec.ts)
// and a new baseline is looked at, critically, before it is committed: committing it declares
// the screen correct.
//
// Made and compared only in the Linux Playwright image - fonts are drawn differently on every
// system, and one set of baselines can only hold one - so a run anywhere else skips these:
// `npm run test:e2e:docker` compares, `npm run test:e2e:update` remakes (README, "Tests").
//
// Motion is frozen (less motion asked for, animations finished) and the clock fixed. 

import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { DEMO_STATES, reach } from "./support/demo";
import { fontsReady, openHome, scrollToTop, settle } from "./support/page";

const STILL = fileURLToPath(new URL("./support/shots/still.css", import.meta.url));
const NO_BAR = fileURLToPath(new URL("./support/shots/no-bar.css", import.meta.url));

test.skip(!process.env.E2E_VISUAL, "screenshots are compared in the Linux image only: npm run test:e2e:docker");

test.beforeEach(async ({ page }) => {
  // A fixed moment for everything that reads the time (History's edits, the sky's season).
  await page.clock.setFixedTime(new Date("2026-11-02T09:00:00+01:00"));
});

/** A part of the page, scrolled to and drawn, its screenshot taken without the bar over it. */
async function shoot(page: Page, el: Locator, name: string, options: { bar?: boolean } = {}) {
  await fontsReady(page);
  await settle(page);
  await expect(el).toHaveScreenshot(`${name}.png`, { stylePath: options.bar ? [STILL] : [STILL, NO_BAR] });
}

test.describe("@visual the page, part by part", () => {
  test("the first screen", async ({ page }) => {
    await openHome(page);
    await expect(page).toHaveScreenshot("first-screen.png", { stylePath: [STILL] });
  });

  for (const [name, selector] of [
    ["hero", ".hero"],
    ["statement", ".statement"],
    ["demo-intro", ".show-intro"],
    ["deliver", "#platform"],
    ["solutions-head", "#why .sec-head"],
    ["every-load-is-safe", ".sol-safe"],
    ["trust", "#security"],
    ["contact", "#contact"],
    ["footer", "footer"],
  ] as const) {
    test(name, async ({ page }) => {
      await openHome(page);
      const el = page.locator(selector).first();
      await scrollToTop(page, el);
      await shoot(page, el, name);
    });
  }

  test("the bar over the day", async ({ page }) => {
    await openHome(page);
    await scrollToTop(page, page.locator("#platform"));
    await shoot(page, page.locator("header.top"), "bar-day", { bar: true });
  });

  test("Solutions, group by group", async ({ page }) => {
    await openHome(page);
    for (const id of ["sol-reporting", "sol-tables", "sol-automation", "sol-local"]) {
      const g = page.locator(`#${id}`);
      await scrollToTop(page, g);
      await shoot(page, g, `solutions-${id}`);
    }
  });

  test("the contact form, with its errors and sent", async ({ page }) => {
    await openHome(page);
    const c = page.locator("#contact");
    await scrollToTop(page, c);
    await c.getByRole("button", { name: "Send message" }).click();
    await shoot(page, c, "contact-errors");
    await c.getByLabel("Name", { exact: true }).fill("Jana Nováková");
    await c.getByLabel("Email", { exact: true }).fill("jana@pekarna.cz");
    await c.getByLabel("What are you dealing with?", { exact: true }).fill("Our monthly report comes from six spreadsheets.");
    await c.getByRole("button", { name: "Send message" }).click();
    await expect(c.getByText("Message sent")).toBeVisible();
    await shoot(page, c, "contact-sent");
  });
});

test.describe("@visual the demo, state by state", () => {
  for (const state of DEMO_STATES) {
    test(state.name, async ({ page }) => {
      await openHome(page);
      test.skip(!(await reach(page, state)), "this screen offers nothing to press for it (a phone's Deliver plays the usual runs only)");
      await shoot(page, page.locator(".stage"), `demo-${state.name}`);
    });
  }
});
