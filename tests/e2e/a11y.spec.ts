// @a11y - axe-core over the page and every state of the demo, against WCAG 2.2 A and AA, at the
// five sizes the site is designed at. A serious or critical violation fails; moderate and minor
// ones are attached to the report as the work to do, not as a wall.
//
// No exceptions: every rule is checked on every element. The amber buttons' contrast exception
// went with the amber buttons (2026-11-08: white on the app's navy passes AA).

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { TABS, walk } from "./support/demo";
import { openHome, scrollToSection } from "./support/page";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/** A real violation, found by this suite and not fixed yet: kept out of the general scans so it
 *  does not hide a new one, and held by a test of its own (below) marked as failing, which
 *  starts passing - and so fails as "expected to fail" - the day it is fixed. Then the entry
 *  and its marker come out together. */
type Defect = { rule: string; on: string; where: string; defect: string; fix: string; reproduces: (width: number) => boolean };
// None open. Fixed 2026-11-01 and now held by the general scans: the footer's --fg-4 contrast
// (#73767C, 4.56:1) and the demo's scrolling boxes (focusable, named regions).
const DEFECTS: Defect[] = [];

const EXCEPTIONS: { rule: string; on: string }[] = [
  ...DEFECTS.map(({ rule, on }) => ({ rule, on })),
];

type Found = { id: string; impact: string; help: string; nodes: string[] };

/** Every violation in the part of the page asked about, the exceptions above kept to their one
 *  element each: the rule runs everywhere else. */
async function violations(page: Page, include?: string): Promise<Found[]> {
  const scan = (b: AxeBuilder) => (include ? b.include(include) : b);
  const rules = [...new Set(EXCEPTIONS.map((e) => e.rule))];
  const main = await scan(new AxeBuilder({ page }).withTags(TAGS).disableRules(rules)).analyze();
  const out = [...main.violations];
  for (const rule of rules) {
    let b = scan(new AxeBuilder({ page }).withRules([rule]));
    for (const e of EXCEPTIONS.filter((x) => x.rule === rule)) for (const sel of e.on.split(/\s*,\s*/)) b = b.exclude(sel);
    out.push(...(await b.analyze()).violations);
  }
  return out.map((v) => ({ id: v.id, impact: v.impact ?? "n/a", help: v.help, nodes: v.nodes.map((n) => `${n.target.join(" ")} - ${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160)}`) }));
}

async function expectAccessible(page: Page, name: string, include?: string) {
  const found = await violations(page, include);
  await test.info().attach(`${name}-axe.json`, { body: JSON.stringify(found, null, 2), contentType: "application/json" });
  const blocking = found.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of found.filter((x) => !blocking.includes(x))) test.info().annotations.push({ type: `axe ${v.impact}`, description: `${name}: ${v.id} x${v.nodes.length} - ${v.help}` });
  // Soft, so one scan's failure does not hide what the next part of the page would show.
  expect.soft(blocking.map((v) => `${v.id} (${v.impact}) - ${v.help}\n    ${v.nodes.slice(0, 5).join("\n    ")}`), `${name}: serious and critical violations`).toEqual([]);
}

test.describe("@a11y WCAG 2.2 AA", () => {
  test.slow();

  test("the page", async ({ page }) => {
    await openHome(page);
    // Scanned where each part is in view, so its colours are read against what is behind it.
    await expectAccessible(page, "top");
    for (const id of ["platform", "why", "security", "contact"] as const) {
      await scrollToSection(page, id);
      await expectAccessible(page, id, `#${id}`);
    }
    await expectAccessible(page, "footer", "footer");
  });

  for (const t of TABS) {
    test(`the demo, ${t}, in every state its buttons lead to`, async ({ page }) => {
      await openHome(page);
      await walk(page, t, (state) => expectAccessible(page, `demo-${state}`, ".stage"));
    });
  }

  test("the contact form, with its errors, sent, and with its message to copy when sending fails", async ({ page, inbox, guard }) => {
    await openHome(page);
    await scrollToSection(page, "contact");
    const c = page.locator("#contact");
    await c.getByRole("button", { name: "Send message" }).click();
    await expectAccessible(page, "contact-errors", "#contact");
    const fill = async () => {
      await c.getByLabel("Name", { exact: true }).fill("Jana");
      await c.getByLabel("Email", { exact: true }).fill("jana@firma.cz");
      await c.getByLabel("What are you dealing with?", { exact: true }).fill("Six spreadsheets.");
      await c.getByRole("button", { name: "Send message" }).click();
    };
    await fill();
    await expect(c.getByText("Message sent")).toBeVisible();
    await expectAccessible(page, "contact-sent", "#contact");

    guard.allowConsole(/502|Failed to load resource/);
    inbox.answer(502);
    await page.reload();
    await scrollToSection(page, "contact");
    await fill();
    await expect(c.getByText("Your message is ready")).toBeVisible();
    await expectAccessible(page, "contact-failed", "#contact");
  });
});

// The defects above, one test each, failing as long as the defect is there.
test.describe("@a11y known defects, pinned", () => {
  test.slow();

  for (const d of DEFECTS) {
    test(`${d.rule} in ${d.where}`, async ({ page }) => {
      test.fail(d.reproduces(page.viewportSize()!.width), `${d.defect}. Fix: ${d.fix}`);
      await openHome(page);
      const hits: string[] = [];
      const inDemo = d.on.startsWith("#screen");
      const check = async (state = "") => {
        const r = await new AxeBuilder({ page }).withRules([d.rule]).include(inDemo ? ".stage" : "footer").analyze();
        hits.push(...r.violations.flatMap((v) => v.nodes.map((n) => `${state} ${n.target.join(" ")}`.trim())));
      };
      if (inDemo) for (const t of TABS) await walk(page, t, check);
      else {
        await page.locator("footer").scrollIntoViewIfNeeded();
        await check();
      }
      expect(hits, d.defect).toEqual([]);
    });
  }
});
