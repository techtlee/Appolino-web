// @content - the owner's standing rules for the words the site shows (support/copy.ts;
// docs/design-system.md section 8): no dash as punctuation, the name in lower case, no "Czech Republic", ACID
// said in business words and never named, nothing promised as coming, GDPR-ready and never
// "compliant", and the certifications only ever the infrastructure's. Each was corrected by
// hand at least once; a single slipped sentence makes the page read as unchecked.
//
// Every test of the suite already holds every word it saw to these rules (support/test.ts).
// Here they are asserted on purpose: over the whole page and every state of the demo, over
// every line each of the demo's stories tells as it plays, and - for the certifications - with
// the card a claim stands in, which a list of words cannot see.

import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { INFRASTRUCTURE, ONLY_CERTS, copyProblems } from "./support/copy";
import { TABS, openTab, walk } from "./support/demo";
import { openHome, scrollThrough } from "./support/page";

/** Every word the page holds now, by the element it is written in. */
const words = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.body.querySelectorAll("*"))
      .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()))
      .map((el) => ({ text: (el.textContent ?? "").replace(/\s+/g, " ").trim(), code: !!el.closest("code, pre, textarea") })),
  );

test.describe("@content the owner's copy rules", () => {
  test("hold over the whole page", async ({ page }) => {
    await openHome(page);
    await scrollThrough(page);
    const all = await words(page);
    expect(all.length, "the page has words to check").toBeGreaterThan(200);
    expect(copyProblems(all)).toEqual([]);
    await expect(page).toHaveTitle("appolino · Where Simplicity Meets Precision");
  });

  test("hold over every state of the demo", async ({ page }) => {
    for (const t of TABS) {
      await openHome(page);
      await walk(page, t, async (state) => expect.soft(copyProblems(await words(page)), state).toEqual([]));
    }
  });

  test("the certifications are named as the infrastructure's, never appolino's own", async ({ page }) => {
    await openHome(page);
    const claims = await page.evaluate(() =>
      Array.from(document.body.querySelectorAll("*"))
        .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && /ISO\s?27001|SOC\s?2\b/i.test(n.textContent ?? "")))
        .map((el) => ({
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim(),
          card: el.closest(".frame, .pillar, li, article")?.querySelector("h3")?.textContent ?? null,
        })),
    );
    expect(claims.length, "the certifications are on the page, so the rule is tested").toBeGreaterThan(0);
    for (const c of claims) {
      if (ONLY_CERTS.test(c.text)) {
        // A tag of certification names alone speaks for its card: the card must be the
        // infrastructure's.
        expect(c.card, `the card "${c.text}" stands in`).toMatch(/infrastructure/i);
      } else {
        expect(c.text, "a sentence that names a certification names the infrastructure holding it").toMatch(INFRASTRUCTURE);
      }
    }
    // The frame says so in its own words.
    const frame = page.locator(".frame", { has: page.getByRole("heading", { name: "Certified infrastructure" }) });
    await expect(frame).toContainText("Amazon Web Services");
  });

  test('GDPR is said as "GDPR-ready"', async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole("heading", { name: "GDPR-ready" })).toBeVisible();
    await expect(page.getByText(/GDPR[\s-]*complian/i)).toHaveCount(0);
  });
});

// The demo's stories, each played through once with motion, every line they say recorded as
// it arrives and held to the rules by the fixture at the end. Each waits for its story's last
// line, not for a guessed time.
test.describe("@content every line the demo's stories tell", () => {
  test.use({ motion: "play" });
  test.slow();

  const STORIES: { tab: "Extract" | "Transform" | "Validate" | "Deliver" | "Ask"; ends: (page: Page) => Promise<void> }[] = [
    { tab: "Extract", ends: (p) => expect(p.locator("#screen .rd-log li").last()).toHaveText("24 rows into Invoices", { timeout: 30_000 }) },
    { tab: "Transform", ends: (p) => expect(p.locator("#screen .tt-tour b")).toHaveText("Now you", { timeout: 90_000 }) },
    {
      tab: "Validate",
      ends: async (p) => {
        // The rounds take turns at Fix all and Fix one by one: the second round ends the story.
        await expect(p.locator("#screen .tt-tour")).toContainText("Fix all applies every fix at once.", { timeout: 120_000 });
        await expect(p.locator("#screen .tt-tour")).toContainText("A rule suggested from the values", { timeout: 60_000 });
      },
    },
    { tab: "Deliver", ends: (p) => expect(p.locator("#screen .tt-tour b")).toHaveText(/^8 of 8$/, { timeout: 150_000 }) },
    { tab: "Ask", ends: (p) => expect(p.locator("#screen").getByText("Put back as it was.")).toBeVisible({ timeout: 120_000 }) },
  ];

  for (const story of STORIES) {
    test(`${story.tab}'s story`, async ({ page }) => {
      test.skip(page.viewportSize()!.width < 1000, "the stories tell the same words at every size; told once, on the desktop");
      await openHome(page);
      await openTab(page, story.tab);
      await story.ends(page);
    });
  }
});
