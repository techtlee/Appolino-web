// @smoke - the page a visitor lands on, on every device the suite knows: it loads under its own
// name, says its slogan to a screen reader, has every section the bar and the footer point to,
// every link lands where it says, and a whole scroll from the hero to the footer - with motion,
// as most visitors see it, the demo playing - raises no error. If this
// fails, nothing else matters: stop and fix it first.

import { expect, test } from "./support/test";
import { NARROW_MAX, SECTIONS, openHome, scrollThrough, settle, width } from "./support/page";

const TITLE = "appolino · Where Simplicity Meets Precision";
const SLOGAN = "Where Simplicity Meets Precision.";

/** Where an anchor lands, by the section it names: in the window, under the bar. */
async function landed(page: import("@playwright/test").Page, id: string) {
  return page.evaluate((anchor) => {
    const r = document.getElementById(anchor)!.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight };
  }, id);
}

/** The anchor's section stands in the window once the scroll has finished. */
async function expectInView(page: import("@playwright/test").Page, id: string) {
  await expect
    .poll(async () => {
      const r = await landed(page, id);
      return r.top < r.h * 0.6 && r.bottom > 0;
    }, { message: `#${id} scrolled into view`, timeout: 10_000 })
    .toBe(true);
}

test.describe("@smoke the page", () => {
  test("loads under its name, in English, with its slogan for a screen reader and every section in order", async ({ page }) => {
    await openHome(page);
    await expect(page).toHaveTitle(TITLE);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(SLOGAN);
    // The slogan stands alone: the eyebrow over it was taken out (owner, 2026-11-01).
    await expect(page.locator(".hero .eyebrow")).toHaveCount(0);
    // Czech is behind a flag that is off (src/flags.ts): no language menu.
    await expect(page.getByRole("button", { name: "Language / Jazyk" })).toHaveCount(0);

    const tops: number[] = [];
    for (const id of SECTIONS) {
      const section = page.locator(`#${id}`);
      await expect(section, `#${id}`).toHaveCount(1);
      tops.push(await section.evaluate((el) => el.getBoundingClientRect().top + scrollY));
    }
    expect(tops, "top, try, platform, why, security, contact, down the page").toEqual([...tops].sort((a, b) => a - b));
    // The demo's five tabs, Extract open as the page loads.
    await expect(page.getByRole("tablist", { name: "Screens of appolino" }).getByRole("tab")).toHaveText(["Extract", "Transform", "Validate", "Deliver", "✦ Ask"]);
    await expect(page.getByRole("tab", { name: "Extract" })).toHaveAttribute("aria-selected", "true");
  });

  test("the bar names the sections, and every link in it lands on its section", async ({ page }) => {
    test.skip(width(page) <= NARROW_MAX, "the bar's links are hidden on a narrow screen; the footer's are tested there");
    await openHome(page);
    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav.getByRole("link")).toHaveText(["Platform", "Solutions", "Trust", "Contact"]);
    for (const [name, id] of [
      ["Platform", "try"],
      ["Solutions", "why"],
      ["Trust", "security"],
      ["Contact", "contact"],
    ] as const) {
      await nav.getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expectInView(page, id);
    }
  });

  test("every link in the footer lands on its section", async ({ page }) => {
    await openHome(page);
    const footer = page.locator("footer");
    for (const [name, id] of [
      ["Platform", "try"],
      ["Deliver", "platform"],
      ["Solutions", "why"],
      ["Trust", "security"],
      ["Book a demo", "contact"],
      ["Contact", "contact"],
    ] as const) {
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior }));
      await settle(page);
      await footer.getByRole("link", { name, exact: true }).click();
      await expectInView(page, id);
    }
    // The constellation drawings' licence asks for the credit wherever they are shown.
    await expect(footer.getByRole("link", { name: "constellation art for OpenSpace" })).toHaveAttribute("href", /openspaceproject\.com/);
    await expect(footer.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
  });

  test('"Book a demo" goes to the contact form and "Try it" to the demo', async ({ page }) => {
    await openHome(page);
    const hero = page.locator(".hero");
    await expect(hero.getByRole("link", { name: "Book a demo" })).toHaveAttribute("href", "#contact");
    await expect(hero.getByRole("link", { name: "Try it" })).toHaveAttribute("href", "#try");
    await expect(page.locator("header.top").getByRole("link", { name: "Book a demo" })).toHaveAttribute("href", "#contact");

    await hero.getByRole("link", { name: "Try it" }).click();
    await expectInView(page, "try");
    await expect(page.getByRole("tablist", { name: "Screens of appolino" })).toBeInViewport();

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
    await settle(page);
    await hero.getByRole("link", { name: "Book a demo" }).click();
    await expectInView(page, "contact");
    await expect(page.getByLabel("Name")).toBeInViewport();

    // The bar's one action, from anywhere on the page.
    await page.evaluate(() => window.scrollTo({ top: innerHeight * 3, behavior: "instant" as ScrollBehavior }));
    await settle(page);
    await page.locator("header.top").getByRole("link", { name: "Book a demo" }).click();
    await expectInView(page, "contact");
  });
});

test.describe("@smoke with motion, as most visitors see it", () => {
  test.use({ motion: "play" });

  test("a whole scroll from the hero to the footer and back raises no error", async ({ page }) => {
    // The fixture (support/test.ts) fails the test on any page or console error, failed request
    // or request to another site; the scroll is what gives them a chance to happen.
    await openHome(page);
    await scrollThrough(page);
    await expect(page.locator("h1")).toBeVisible();
  });
});
