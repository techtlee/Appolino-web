// Getting the page where a test needs it: loaded with its fonts, scrolled to a part without the
// page's smooth scrolling in the way, and told apart by the width it is shown at.

import { expect, type Locator, type Page } from "@playwright/test";

/** The sections the page is built from, top to bottom, by their anchors. */
export const SECTIONS = ["top", "try", "platform", "why", "security", "contact"] as const;

/** The phone layout's breakpoint (index.css, app.css): the tabs share the width, the cards
 *  centre, the turning word takes a line of its own. */
export const PHONE_MAX = 600;
/** Up to here the nav is hidden and the demo window grows with what it holds. */
export const NARROW_MAX = 900;

export const width = (page: Page) => page.viewportSize()!.width;
export const isPhone = (page: Page) => width(page) <= PHONE_MAX;

/** Two frames: whatever a scroll or a resize set off has been drawn. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

/** Every font the page asked for has arrived. Asked again after a change, since a font is only
 *  fetched once something uses it (the demo's icons, a weight first seen in a tab). */
export async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The home page, loaded and drawn: the headline is there and the fonts have arrived. */
export async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("h1")).toBeAttached();
  await fontsReady(page);
  await settle(page);
}

/** Scrolls the window at once - not with the page's smooth scrolling - so `el`'s top stands
 *  under the bar where an anchor would put it (html's scroll-padding-top). */
export async function scrollToTop(page: Page, el: Locator): Promise<void> {
  await el.evaluate((node) => {
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const y = node.getBoundingClientRect().top + scrollY - pad;
    window.scrollTo({ top: Math.max(0, y), behavior: "instant" as ScrollBehavior });
  });
  await settle(page);
}

/** Scrolls the window at once so `el` stands in the middle of it, or its top under the bar if
 *  it is taller than the window. */
export async function scrollToMiddle(page: Page, el: Locator): Promise<void> {
  await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const room = innerHeight - pad;
    const y = r.height >= room ? r.top + scrollY - pad : r.top + scrollY - pad - (room - r.height) / 2;
    window.scrollTo({ top: Math.max(0, y), behavior: "instant" as ScrollBehavior });
  });
  await settle(page);
}

/** Scrolls the section with this anchor to the top of the window. */
export async function scrollToSection(page: Page, id: (typeof SECTIONS)[number]): Promise<void> {
  await scrollToTop(page, page.locator(`#${id}`));
}

/** Walks the whole page down a window at a time and back up, so everything that waits to be
 *  seen (the demo's screens, the cards' loops, the masking) has been seen. */
export async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(200, Math.round(page.viewportSize()!.height * 0.8));
  for (let y = 0; y < height; y += step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" as ScrollBehavior }), y);
    await settle(page);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  await settle(page);
}

/** Polls `read` for `ms` and fails at the first answer that differs from the first one: the way
 *  to say that something does NOT happen, which no web-first assertion can wait for. */
export async function expectUnchanged<T>(page: Page, read: () => Promise<T>, ms: number, what: string): Promise<void> {
  const first: unknown = await read();
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.waitForTimeout(250);
    const now: unknown = await read();
    expect(now, what).toEqual(first);
  }
}
