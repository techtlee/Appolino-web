// @flow - Solutions' row of nine cards that scrolls sideways (docs/design-system.md section 4.4: "like 3
// visible with arrows beside them"): the arrows step one card and grey out at either end, the
// arrow keys move it once it has focus, a trackpad's sideways swipe moves it, the thin bar under
// it says where the view is, and on a phone the card in view stands in the middle of the screen.
// A row that will not move hides six of the nine cards.

import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { isPhone, openHome, scrollToMiddle, settle } from "./support/page";

const row = (page: Page) => page.getByRole("region", { name: "Solutions, card by card" });
const arrow = (page: Page, name: "Previous" | "Next") => page.locator(".sol-car").getByRole("button", { name });
const at = (track: Locator) => track.evaluate((el) => Math.round(el.scrollLeft));

/** The row has stopped moving: two looks a frame apart agree. */
async function resting(page: Page, track: Locator): Promise<number> {
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = await at(track);
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [150], timeout: 5_000 },
    )
    .toBe(true);
  return last;
}

/** How far one step moves the row: a card and the gap after it. */
const stepOf = (track: Locator) =>
  track.evaluate((el) => {
    const card = el.querySelector<HTMLElement>(".ben")!;
    return card.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
  });

test.describe("@flow the Solutions carousel", () => {
  test.beforeEach(async ({ page }) => {
    await openHome(page);
    await scrollToMiddle(page, page.locator(".sol-car"));
  });

  test("the arrows step one card at a time and grey out at either end", async ({ page }) => {
    // Held since 2026-11-01, when WebKit on the iPad showed Next grey until a swipe: the
    // Carousel measured its ends before the cards were laid out. It now measures again whenever
    // the row or a card changes size (a ResizeObserver in Benefits.tsx).
    const track = row(page);
    await expect(arrow(page, "Previous")).toBeDisabled();
    await expect(arrow(page, "Next")).toBeEnabled();
    const step = await stepOf(track);
    let pos = await resting(page, track);
    let steps = 0;
    while (await arrow(page, "Next").isEnabled()) {
      await arrow(page, "Next").click();
      await expect.poll(() => at(track)).toBeGreaterThan(pos);
      const now = await resting(page, track);
      expect(Math.abs(now - pos - step), `step ${steps + 1} moves one card`).toBeLessThanOrEqual(2);
      pos = now;
      steps += 1;
      expect(steps, "the row comes to an end").toBeLessThan(10);
    }
    await expect(arrow(page, "Next")).toBeDisabled();
    await expect(arrow(page, "Previous")).toBeEnabled();
    expect(pos, "at the end, the row is scrolled as far as it goes").toBeGreaterThanOrEqual(await track.evaluate((el) => el.scrollWidth - el.clientWidth - 4));
    // Three to a view on a wide screen leave six steps; two leave seven; one leaves eight.
    const inView = await track.evaluate((el) => Math.round(el.clientWidth / el.querySelector<HTMLElement>(".ben")!.offsetWidth));
    expect(steps, `${inView} cards to a view`).toBe(9 - Math.max(1, Math.min(3, inView)));

    // The thin bar under the row stands at its right end.
    const bar = page.locator(".sol-progress");
    const thumb = (await bar.locator("span").boundingBox())!;
    const box = (await bar.boundingBox())!;
    expect(Math.abs(thumb.x + thumb.width - (box.x + box.width)), "the bar's thumb at the end").toBeLessThanOrEqual(2);

    await arrow(page, "Previous").click();
    await expect.poll(() => at(track)).toBeLessThan(pos);
  });

  test("the arrow keys move the row once it has focus", async ({ page }) => {
    const track = row(page);
    await track.focus();
    await expect(track).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => at(track), { message: "ArrowRight moves the row on" }).toBeGreaterThan(0);
    const there = await resting(page, track);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => at(track), { message: "ArrowLeft moves it back" }).toBeLessThan(there);
  });

  test("a sideways swipe on a trackpad moves the row", async ({ page }) => {
    test.skip(await page.evaluate(() => !matchMedia("(hover: hover)").matches), "a trackpad belongs to a screen with a pointer");
    const track = row(page);
    const b = (await track.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3);
    await page.mouse.wheel(400, 0);
    await expect.poll(() => at(track)).toBeGreaterThan(0);
    await expect(arrow(page, "Previous")).toBeEnabled();
  });

  test("on a phone the card in view stands in the middle of the screen", async ({ page }) => {
    test.skip(!isPhone(page), "a phone's row centres its card; a wider screen's starts it at the row's edge");
    const track = row(page);
    const middle = await page.evaluate(() => document.documentElement.clientWidth / 2);
    const centred = async () => {
      await resting(page, track);
      await settle(page);
      // The card nearest the middle, and how far its centre is from it.
      return track.evaluate((el, mid) => {
        const off = Array.from(el.querySelectorAll(".ben")).map((c) => {
          const r = c.getBoundingClientRect();
          return r.left + r.width / 2 - mid;
        });
        return Math.min(...off.map(Math.abs));
      }, middle);
    };
    expect(await centred(), "the first card centred").toBeLessThanOrEqual(2);
    for (let i = 0; i < 3; i++) {
      await arrow(page, "Next").click();
      expect(await centred(), `card ${i + 2} centred`).toBeLessThanOrEqual(2);
    }
    // A finger's flick ends on a card too: scroll part of the way and let it snap.
    await track.evaluate((el) => el.scrollBy({ left: el.querySelector<HTMLElement>(".ben")!.offsetWidth * 0.7, behavior: "instant" as ScrollBehavior }));
    expect(await centred(), "a part-way scroll snaps to a card's middle").toBeLessThanOrEqual(2);
  });
});
