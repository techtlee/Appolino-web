// @flow - the demo window (docs/design-system.md section 7), tab by tab, as a visitor uses it: every tab
// opens its screen and plays its story by itself until the visitor's first press, and each
// tab's own buttons do what they say - Extract reads its file, Transform's steps pivot, convert
// and bring what they need, Validate finds and fixes, Deliver holds a run at its gates and lets
// it on, Ask drafts a change and applies it. The demo is what the page is for; a tab that stops
// playing, or a button that no longer leads where its words promise, is the page broken.
//
// The stories run with motion (they do not play without it); the buttons are pressed with less
// motion asked for, where every run is over at once, so each step lands the same way every time.

import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { TABS, addStep, chips, deliverAtRest, deliverScenario, openTab, openTransform, screen } from "./support/demo";
import { expectUnchanged, openHome } from "./support/page";

/** What the window shows, as a visitor reads it. */
const shown = (page: Page) => screen(page).innerText();

test.describe("@flow every tab plays by itself", () => {
  test.use({ motion: "play" });

  for (const name of TABS) {
    test(`${name}: opens its screen and plays its story`, async ({ page }) => {
      await openHome(page);
      const s = await openTab(page, name);
      await expect(s.locator("h4").first()).not.toBeEmpty();
      const first = await shown(page);
      await expect.poll(() => shown(page), { message: `${name} changes on its own`, timeout: 20_000 }).not.toBe(first);
    });
  }

  // The first press inside the window hands it to the visitor: nothing new starts after it. A
  // run already on its way finishes where it was going (Deliver, Extract), so the screen is
  // let come to rest, then watched for longer than any of the stories rests between steps.
  for (const name of TABS) {
    test(`${name}: a visitor's press stops the story`, async ({ page }) => {
      await openHome(page);
      const s = await openTab(page, name);
      const first = await shown(page);
      await expect.poll(() => shown(page), { timeout: 20_000 }).not.toBe(first);
      await s.locator("h4").first().click();
      // The line over the table that tells the story goes with it.
      await expect(s.locator(".tt-tour")).toHaveCount(0, { timeout: 15_000 });
      let last = "";
      await expect
        .poll(
          async () => {
            const now = await shown(page);
            const same = now === last;
            last = now;
            return same;
          },
          { message: "the screen comes to rest", intervals: [1_000], timeout: 20_000 },
        )
        .toBe(true);
      await expectUnchanged(page, () => shown(page), 6_000, `${name} stays as the visitor left it`);
    });
  }
});

test.describe("@flow Extract", () => {
  test.use({ motion: "play" });

  test("reads its file to the end, and again on Read again", async ({ page }) => {
    await openHome(page);
    const s = await openTab(page, "Extract");
    const log = s.getByRole("region", { name: "Read automatically" }).locator("ol li");
    await expect(log.last()).toHaveText("24 rows into Invoices", { timeout: 20_000 });
    await expect(log).toHaveText([
      "Header found on row 4 (the 3 lines above it skipped)",
      "Types inferred: text, date, amount, yes/no",
      /^Local formats read: /,
      "Totals line dropped: a row needs an invoice number",
      /is not an amount; kept as written, flagged for Validate$/,
      "24 rows into Invoices",
    ]);
    await expect(s.locator(".tt-foot")).toContainText("Read.");
    // The file's columns carry their names and types now, and the word where an amount belongs
    // stays as written, ringed for Validate.
    await expect(s.locator(".rd-ch.is-typed")).toHaveCount(5);
    await expect(s.locator(".rd-c.is-bad")).toHaveText("hodně");

    // The visitor's own read: the first press stops the story, then the file is read again.
    const again = s.getByRole("button", { name: "Read again" });
    // Pressed the moment it can be, between the story's reads; forced, because the button that
    // is next to press breathes (docs/design-system.md section 3.6), which Playwright would wait out forever.
    await expect(again).toBeEnabled({ timeout: 20_000 });
    await again.click({ force: true });
    await expect(s.getByRole("button", { name: "Reading" })).toBeDisabled();
    await expect(log.last()).toHaveText("24 rows into Invoices", { timeout: 20_000 });
    await expect(again).toBeEnabled();
  });
});

test.describe("@flow Transform", () => {
  test("adds a pivot, brings the rate with Plan in EUR, takes a step out, and shows the SQL", async ({ page }) => {
    await openHome(page);
    const s = await openTab(page, "Transform");
    await expect(s.locator("h4").first()).toHaveText("Sales plan 2026");
    const panel = await openTransform(page);
    // Shape is open first, the pivot leading it.
    await expect(panel.getByRole("radio", { name: "Shape" })).toHaveAttribute("aria-checked", "true");

    await addStep(page, "Shape", "Pivot: months by region");
    const heads = s.locator("table.tt-grid thead th");
    await expect(heads.filter({ hasText: /^Month$/ })).toHaveCount(1);
    for (const region of ["Prague", "Brno", "Ostrava", "Total"]) await expect(heads.filter({ hasText: new RegExp(`^${region}$`) }), region).toHaveCount(1);
    await expect(s.locator("table.tt-grid tbody tr").first().locator("td").nth(1)).toHaveText(/^[A-Z][a-z]{2} 2026$/);
    await expect(panel.locator(".tt-lineage")).toContainText("Plan by month and region");

    await addStep(page, "Calculate", "Plan in EUR");
    const note = panel.locator(".tt-steps-note");
    await expect(note).toContainText("“Add the ČNB rate on Due” came with it, as it needs it.");
    await expect(note).toContainText("Put before “Pivot: months by region”, which shapes the result last.");
    await expect(heads.filter({ hasText: /^Prague \(EUR\)$/ })).toHaveCount(1);
    const recipe = panel.locator(".tt-recipe > li:not(.is-src) b");
    await expect(recipe).toHaveText(["Add the ČNB rate on Due", "Plan in EUR", "Pivot: months by region"]);
    await expect(panel.locator(".tt-lineage")).toContainText("ČNB exchange rates");

    // Taking out the rate takes what needs it along.
    await panel.getByRole("button", { name: "Remove Add the ČNB rate on Due" }).click();
    await expect(note).toHaveText("Plan in EUR went with it, as it needs it; the rest were replayed.");
    await expect(recipe).toHaveText(["Pivot: months by region"]);
    await expect(heads.filter({ hasText: /^Prague$/ })).toHaveCount(1);

    // The SQL is one switch away, written from the same steps.
    await panel.getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: "SQL" }).click();
    const sql = panel.locator("pre.tt-sql");
    await expect(sql).toContainText('{{ dataset("Sales plan 2026") }}');
    await expect(sql).toContainText("sum(plan) filter (where region = 'Prague')");
    await panel.getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: "Steps" }).click();
    await expect(sql).toHaveCount(0);
    await expect(recipe).toHaveText(["Pivot: months by region"]);

    await panel.getByRole("button", { name: "Save as result table" }).click();
    await expect(panel.locator(".tt-saved")).toContainText("Saved as Plan by month and region");

    // Closed, the grid is the table again, to edit.
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(heads.filter({ hasText: /^Product/ })).toHaveCount(1);
  });

  test("a cell is edited in place: a word in a number column is refused, a figure is kept", async ({ page }) => {
    await openHome(page);
    const s = await openTab(page, "Transform");
    // The plan, the first column of figures.
    const cell = s.locator("table.tt-entry tbody tr").first().locator("td.is-edit.is-num").first();
    const before = (await cell.textContent())!.trim();
    await cell.click();
    const input = s.getByRole("textbox", { name: /, row 1$/ });
    await expect(input).toBeFocused();
    await input.fill("lots");
    await expect(s.getByRole("alert")).toHaveText(/^Must be/);
    await input.press("Enter");
    await expect(input, "a misfit is not saved; the cell stays open").toBeFocused();
    await input.press("Escape");
    await expect(cell).toHaveText(before);

    await cell.click();
    await s.getByRole("textbox", { name: /, row 1$/ }).fill("125,000");
    await page.keyboard.press("Enter");
    // Enter saves and moves down, as in a spreadsheet.
    await expect(s.getByRole("textbox", { name: /, row 2$/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(cell).toHaveText("125,000");
    await expect(s.getByRole("radiogroup", { name: "Beside the table" }).getByRole("radio", { name: /History/ })).toContainText("1");
  });
});

test.describe("@flow Validate", () => {
  test("finds what breaks the rules, then fixes it and remembers the fix", async ({ page }) => {
    await openHome(page);
    const s = await openTab(page, "Validate");
    const rules = s.getByRole("region", { name: "Rules" });
    await s.getByRole("button", { name: "Validate", exact: true }).click();
    const tally = rules.locator(".tt-chip").first();
    await expect(tally).toHaveText(/^\d+ of \d+ pass$/);
    const before = Number((await tally.textContent())!.match(/^(\d+)/)![1]);
    await expect(s.getByRole("button", { name: "Validate again" })).toBeVisible();

    await rules.getByRole("button", { name: "Fix all" }).click();
    await expect(rules.locator(".tt-kept")).toContainText("Remembered for the next import");
    const after = Number((await tally.textContent())!.match(/^(\d+)/)![1]);
    expect(after, "more rules pass after the fixes").toBeGreaterThan(before);

    await rules.getByRole("button", { name: "Start over" }).click();
    await expect(s.getByRole("button", { name: "Validate", exact: true })).toBeVisible();
  });
});

/** Deliver at rest, where its chips pick what arrives; skipped where they do not (a phone's
 *  Deliver plays the usual runs only, docs/design-system.md section 7.4, 2026-11-01). */
async function openDeliver(page: Page) {
  await openHome(page);
  const s = await openTab(page, "Deliver");
  await deliverAtRest(page);
  test.skip(!(await chips(page).isVisible()), "a phone's Deliver plays the usual runs only, without the chips");
  return s;
}

test.describe("@flow Deliver", () => {
  test("runs as usual, and again on Run again", async ({ page }) => {
    await openHome(page);
    const s = await openTab(page, "Deliver");
    await deliverAtRest(page);
    // Succeeded, as its chip says where the head has chips; a phone's head folds them away.
    const wide = await chips(page).isVisible();
    const succeeded = s.getByText("Succeeded", { exact: true }).filter({ visible: true }).first();
    if (wide) await expect(succeeded).toBeVisible();
    await s.getByRole("button", { name: "Run again" }).click();
    await expect(s.getByRole("button", { name: "Run again" })).toBeEnabled();
    if (wide) await expect(succeeded).toBeVisible();
    await expect(s.locator(".tt-banner:not(.is-ok)")).toHaveCount(0);
  });

  test("a new column holds the run at the schema gate; accepting it runs it through", async ({ page }) => {
    const s = await openDeliver(page);
    await deliverScenario(page,"New column");
    const banner = s.locator(".tt-banner");
    await expect(banner).toContainText("Held at the schema gate");
    await expect(s.locator(".tt-chip", { hasText: "Held" })).toBeVisible();
    await banner.getByRole("button", { name: /^Accept .+ and run again$/ }).click();
    await expect(s.locator(".tt-chip", { hasText: "Succeeded" })).toBeVisible();
    await expect(s.getByText("Held at the schema gate")).toHaveCount(0);
  });

  test("a bad value holds its row; correcting it delivers and the banner turns green", async ({ page }) => {
    const s = await openDeliver(page);
    await deliverScenario(page,"Bad value");
    const banner = s.locator(".tt-banner");
    await expect(banner).toContainText("1 row held by validation");
    await expect(banner).not.toHaveClass(/is-ok/);
    const correct = banner.getByRole("button", { name: /^Correct to .+ and deliver$/ });
    const to = (await correct.textContent())!.match(/Correct to (.+) and deliver/)![1];
    await correct.click();
    await expect(banner).toHaveClass(/is-ok/);
    await expect(banner).toContainText(`corrected to ${to} and delivered; the fix is kept for the next run.`);
  });

  test("half the rows are held at the row count gate and let through once", async ({ page }) => {
    const s = await openDeliver(page);
    await deliverScenario(page,"Half the rows");
    await expect(s.locator(".tt-banner")).toContainText("Held at the row count gate");
    await s.locator(".tt-banner").getByRole("button", { name: "Let it through once" }).click();
    await expect(s.locator(".tt-chip", { hasText: "Succeeded" })).toBeVisible();
  });

  test.describe("with motion", () => {
    test.use({ motion: "play" });

    test("the held run plays to its banner, and the visitor's accept runs it through", async ({ page }) => {
      await openHome(page);
      const s = await openTab(page, "Deliver");
      test.skip(!(await chips(page).isVisible()), "a phone's Deliver plays the usual runs only, without the chips");
      // The choice is the visitor's once the story's own run has ended (the chips wait for it).
      await deliverScenario(page, "New column");
      await expect(s.locator(".tt-banner")).toContainText("Held at the schema gate", { timeout: 30_000 });
      await s.locator(".tt-banner").getByRole("button", { name: /^Accept .+ and run again$/ }).click();
      await expect(s.locator(".tt-chip", { hasText: "Succeeded" })).toBeVisible({ timeout: 30_000 });
    });
  });
});

test.describe("@flow Ask", () => {
  test("a suggested sentence comes back as a draft; Apply changes the table and Undo puts it back", async ({ page }) => {
    await openHome(page);
    const s = await openTab(page, "Ask");
    const ask = s.getByRole("region", { name: "Ask" });
    await expect(s.getByRole("button", { name: /Saved steps/ })).toBeDisabled();
    const suggestion = ask.locator(".tt-try button").first();
    const sentence = (await suggestion.textContent())!.trim();
    await suggestion.click();
    await expect(ask.locator(".tt-you").last()).toHaveText(sentence);
    await ask.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(ask.getByText("Applied", { exact: true })).toBeVisible();
    const saved = s.getByRole("button", { name: /Saved steps/ });
    await expect(saved).toBeEnabled();
    await expect(saved).toContainText("1");

    await saved.click();
    await expect(s.getByRole("menu", { name: "Steps saved to the table" }).getByRole("menuitem")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await s.getByRole("button", { name: "Undo the last applied change" }).click();
    await expect(ask.getByText("Put back as it was.")).toBeVisible();
    await expect(saved).toBeDisabled();
  });

  test("a question about the data is answered honestly: not yet", async ({ page }) => {
    await openHome(page);
    const s = await openTab(page, "Ask");
    const box = s.getByLabel("Ask appolino");
    await box.fill("How much did Prague invoice?");
    await s.getByRole("button", { name: "Send" }).click();
    await expect(s.getByText(/^I don't answer questions about the data yet\./)).toBeVisible();
    await expect(box).toHaveValue("");
  });
});
