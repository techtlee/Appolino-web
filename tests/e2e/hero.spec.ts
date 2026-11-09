// @flow - the hero's slogan, as the owner set it (docs/design-system.md section 6.2): its last word turns
// every few seconds, rolling up into one place from the line's lower edge, and nothing else on
// the line moves - "Meets should not change, text should not jump", "always in the middle".
// Every one of those words was a correction of something that had moved; this holds them.
//
// With motion, as the words only turn then; and a second part with less motion asked for, where
// nothing may turn at all.

import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { expectUnchanged, openHome } from "./support/page";

const turning = (page: Page) => page.locator(".hero h1 .turn-w.is-on");
const meets = (page: Page) => page.locator(".hero h1 .w", { hasText: /^Meets$/ });

type Turn = { word: string; at: number; meetsX: number; offset?: number };

/** Records every turn in the page itself, as it happens - the word, when, where "Meets" stood,
 *  and, once the word has rolled into place, how far its baseline is from Meets's - so a busy
 *  test runner can neither miss a word nor measure one mid-roll. A baseline is found by a
 *  zero-sized inline box dropped at the end of the text, which stands on it; it is taken out
 *  again at once. */
function recordTurns() {
  const w = window as unknown as { __turns: Turn[] };
  const turn = document.querySelector(".hero h1 .turn")!;
  const meetsEl = Array.from(document.querySelectorAll(".hero h1 .w")).find((x) => x.textContent === "Meets")!;
  const base = (el: Element) => {
    const mark = document.createElement("span");
    mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    el.appendChild(mark);
    const y = mark.getBoundingClientRect().top;
    mark.remove();
    return y;
  };
  const on = () => turn.querySelector(".turn-w.is-on");
  const record = () => {
    const el = on();
    const last = w.__turns[w.__turns.length - 1];
    if (el && (!last || last.word !== el.textContent)) w.__turns.push({ word: el.textContent ?? "", at: performance.now(), meetsX: meetsEl.getBoundingClientRect().x });
  };
  w.__turns = [];
  record();
  w.__turns[0].offset = base(on()!) - base(meetsEl);
  new MutationObserver(record).observe(turn, { subtree: true, attributes: true, attributeFilter: ["class"] });
  turn.addEventListener("transitionend", (e) => {
    const el = on();
    const last = w.__turns[w.__turns.length - 1];
    if (el && e.target === el && (e as TransitionEvent).propertyName === "transform" && last?.word === el.textContent) last.offset = base(el) - base(meetsEl);
  });
}

test.describe("@flow the hero's turning word", () => {
  test.use({ motion: "play" });

  test("turns through its words, each standing a few seconds, Meets never moving and on its baseline", async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Where Simplicity Meets Precision.");
    // The words come out one by one after the sun has risen; let them. On a slow machine the
    // word may have turned already: the turns are read from wherever they are.
    await expect(meets(page)).toHaveCSS("opacity", "1", { timeout: 10_000 });
    await page.evaluate(recordTurns);
    // The first turn waits for the slogan to come out (about seven seconds); each after it
    // stands 3.6 s (Hero.tsx, TURN_MS).
    const turns = () => page.evaluate(() => (window as unknown as { __turns: Turn[] }).__turns);
    await expect.poll(async () => (await turns()).filter((t) => t.offset !== undefined).length, { message: "four words, each rolled into place", timeout: 30_000 }).toBeGreaterThanOrEqual(4);
    const seen = (await turns()).slice(0, 4);

    const ORDER = ["Precision.", "Automation.", "Validation.", "Reliability.", "Consistency.", "Traceability.", "Trust."];
    const from = ORDER.indexOf(seen[0].word);
    expect(from, `"${seen[0].word}" is one of the owner's words`).toBeGreaterThanOrEqual(0);
    expect(seen.map((t) => t.word), "the words in the owner's order").toEqual(seen.map((_, i) => ORDER[(from + i) % ORDER.length]));
    // Each stands a few seconds and the next is due within five.
    for (let i = 2; i < seen.length; i++) {
      const stood = (seen[i].at - seen[i - 1].at) / 1000;
      expect(stood, `"${seen[i - 1].word}" stood ${stood.toFixed(1)} s`).toBeGreaterThan(2.5);
      expect(stood, `"${seen[i - 1].word}" stood ${stood.toFixed(1)} s`).toBeLessThan(5);
    }
    const xs = seen.map((t) => t.meetsX);
    expect(Math.max(...xs) - Math.min(...xs), `Meets stood at ${xs.map(Math.round).join(", ")}`).toBeLessThanOrEqual(0.5);
    // Side by side on every screen, "Meets" and the word share a baseline.
    for (const t of seen) expect(Math.abs(t.offset!), `"${t.word}" on Meets's baseline`).toBeLessThanOrEqual(1);
    // Only the word on show is read; the others are hidden from a screen reader.
    await expect(page.locator(".hero h1 .turn-w[aria-hidden='false']")).toHaveCount(1);
  });

  test("the slogan, the line under it and the buttons stand in the middle", async ({ page }) => {
    await openHome(page);
    await expect(page.locator(".hero .ctas")).toHaveCSS("opacity", "1", { timeout: 10_000 });
    const mid = await page.evaluate(() => document.documentElement.clientWidth / 2);
    for (const sel of [".hero h1", ".hero .lede", ".hero .ctas"]) {
      const b = (await page.locator(sel).boundingBox())!;
      expect(Math.abs(b.x + b.width / 2 - mid), `${sel} centred`).toBeLessThanOrEqual(1);
    }
    // The slogan's lines start at one edge: Meets under Where.
    const where = (await page.locator(".hero h1 .w", { hasText: /^Where$/ }).boundingBox())!;
    expect(Math.abs((await meets(page).boundingBox())!.x - where.x), "Meets starts where Where starts").toBeLessThanOrEqual(1);
  });
});

test.describe("@flow the hero with less motion asked for", () => {
  test("the word does not turn", async ({ page }) => {
    await openHome(page);
    await expect(turning(page)).toHaveText("Precision.");
    await expectUnchanged(page, async () => [await turning(page).textContent()], 4_500, "the word stands still");
  });
});
