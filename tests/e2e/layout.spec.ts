// @layout - the page and every state of the demo, on every device the suite knows, against rules
// that need no baseline (support/layout.ts), and the design rules docs/design-system.md writes down that a
// measurement can hold: cards one height and level, tags and titles on one line, buttons that
// are pills and never wrap, white day surfaces, shadows straight down. A screenshot can only
// say a screen changed; these say a screen is broken, including on the day it was built.
//
// It runs on fourteen windows and devices, so each test checks as much as one page load can
// (soft assertions, each naming what it holds), and the last part proves the audit itself still
// sees: each kind of break, put into the page on purpose, must be caught by name.

import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { layoutProblems } from "./support/layout";
import { TABS, screen, walk } from "./support/demo";
import { openHome, scrollThrough, scrollToMiddle, settle, width } from "./support/page";

type Box = { x: number; y: number; width: number; height: number };
const bottom = (b: Box) => b.y + b.height;

/** How many lines a piece of text runs to. */
const linesOf = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops: number[] = [];
      for (const r of Array.from(range.getClientRects())) if (r.width > 0.5 && !tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
      return { text: (el.textContent ?? "").trim(), lines: tops.length };
    }),
  );

// Real defects this suite found that are not fixed yet (the site's files were being changed by
// others while it was written, and were not the suite's to change). Each test that proves one
// is kept and marked as failing where the defect shows, so it fails as "unexpectedly passing"
// the day the fix lands; then the marker comes off. The measurements are 2026-11-01's.

/** Trust's frame tags break inside a tag ("audit / trail", "or your own / PostgreSQL") where
 *  the frames are narrower than the longest tag (325px of text in a pill): three frames side by
 *  side between 901 and about 1210px, and phones under about 410px. Fix: keep a tag whole - each
 *  tag its own pill, wrapping as a unit, where the one pill does not fit (Trust.tsx, index.css). */
const FRAME_TAGS_BREAK = "Trust's frame tags break inside a tag on narrow frames (Trust.tsx, index.css; layout.spec.ts names the fix)";
/** Where the defect shows: a frame's proof, set as one pill on one line, is wider than the
 *  frame's body - the mechanism, measured, since each browser sets the type a little wider or
 *  narrower. The fix keeps every tag whole however wide the proof, and so passes here too. */
const frameTagsOverflow = (page: Page) =>
  page.locator("#security .frame small").evaluateAll((els) =>
    els.some((s) => {
      const c = s.cloneNode(true) as HTMLElement;
      c.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
      s.parentElement!.append(c);
      const wide = c.getBoundingClientRect().width;
      c.remove();
      const body = s.parentElement!;
      const cs = getComputedStyle(body);
      return wide > body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5;
    }),
  );

test.describe("@layout the page holds together", () => {
  test("nothing scrolls sideways, runs off the window, is cut off, or wraps a button's label", async ({ page }) => {
    await openHome(page);
    // Everything that waits to be seen has been, then measured from the top.
    await scrollThrough(page);
    expect(await layoutProblems(page)).toEqual([]);
    // And asked directly: a page that can scroll sideways moves when told to.
    await page.evaluate(() => window.scrollTo({ left: 400, top: 0, behavior: "instant" as ScrollBehavior }));
    expect(await page.evaluate(() => scrollX), "the page scrolled sideways").toBe(0);
  });

  test("the demo holds together in every tab and every state its buttons lead to", async ({ page }) => {
    test.slow();
    for (const t of TABS) {
      await openHome(page);
      await walk(page, t, async (state) => {
        expect.soft(await layoutProblems(page, { root: ".stage" }), state).toEqual([]);
        expect.soft(await layoutProblems(page), `${state}: the page around it`).toEqual([]);
      });
    }
  });

  test("every turning word of the slogan fits inside the hero, beside Meets on every screen", async ({ page }) => {
    // On a phone the slogan is sized to keep the widest word beside Meets (index.css, 9.4vw;
    // owner, 2026-11-01, "why is Reliability under Meets"). Every word is in the page from the
    // start, stacked at one starting point (Hero.tsx, Turning), so each one's reach is measured
    // without waiting for it to turn. A longer word runs on past the slogan's block by design;
    // it must still stop short of the page's gutter.
    await openHome(page);
    const words = await page.locator(".hero h1 .turn").evaluate((turn) => {
      const gutter = parseFloat(getComputedStyle(document.querySelector(".hero .wrap")!).paddingRight);
      const right = document.querySelector(".hero")!.getBoundingClientRect().right - gutter;
      const left = turn.getBoundingClientRect().left;
      return Array.from(turn.querySelectorAll<HTMLElement>(".turn-w")).map((w) => ({ word: w.textContent, over: Math.round(left + w.offsetWidth - right) }));
    });
    expect(words.length, "the turning words").toBeGreaterThanOrEqual(7);
    expect.soft(words.filter((w) => w.over > 0), "words that run past the hero's gutter").toEqual([]);
    const meets = (await page.locator(".hero h1 .w", { hasText: /^Meets$/ }).boundingBox())!;
    const turn = (await page.locator(".hero h1 .turn").boundingBox())!;
    expect.soft(Math.abs(turn.y + turn.height - (meets.y + meets.height)), "the turning word on Meets's line").toBeLessThanOrEqual(meets.height * 0.25);
    expect.soft(turn.x, "after Meets, not under it").toBeGreaterThanOrEqual(meets.x + meets.width);
  });
});

test.describe("@layout Solutions", () => {
  test('the cards are one height, each title one line, and "Every load is safe" in its rows', async ({ page }) => {
    await openHome(page);
    const cards = page.locator("#why .ben");
    await expect(cards).toHaveCount(9);
    const heights = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect.soft(Math.max(...heights) - Math.min(...heights), `card heights ${heights.join(", ")}`).toBeLessThanOrEqual(1);
    const titles = await linesOf(page, "#why .ben h3");
    expect.soft(titles.filter((l) => l.lines !== 1), "titles on more than one line").toEqual([]);

    const band = page.locator(".sol-safe");
    await expect.soft(band.locator(".sol-safe-h")).toHaveText("Every load is safe");
    await expect.soft(band.locator(".sol-safe-i b")).toHaveText(["All or nothing", "Always valid", "No half-finished views", "Saved for good"]);
    const cols = await band.locator(".sol-safe-i").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size);
    // Four in a row, two by two on a tablet, one under another on a phone (docs/design-system.md section 4.2).
    expect.soft(cols, "the promises' columns").toBe(width(page) > 1000 ? 4 : width(page) > 560 ? 2 : 1);
  });

  test("every group's cards hold together", async ({ page }) => {
    await openHome(page);
    for (const id of ["sol-reporting", "sol-tables", "sol-automation", "sol-local"]) {
      await scrollToMiddle(page, page.locator(`#${id}`));
      expect.soft(await layoutProblems(page, { root: `#${id}` }), id).toEqual([]);
    }
  });
});

test.describe("@layout Deliver and Trust", () => {
  test("Deliver's two paths end level, and the masking rows stay inside their card", async ({ page }) => {
    await openHome(page);
    const paths = page.locator("#platform .path");
    await expect(paths).toHaveCount(2);
    const [a, b] = [(await paths.nth(0).boundingBox())!, (await paths.nth(1).boundingBox())!];
    if (b.y > a.y + a.height - 1) {
      // One under the other on a phone (index.css, under 700px): nothing to stand level with.
      expect.soft(width(page), "the paths stack only on a narrow screen").toBeLessThanOrEqual(700);
    } else {
      expect.soft(Math.abs(bottom(a) - bottom(b)), "the two paths end level").toBeLessThanOrEqual(1);
      for (const part of ["h3", "ul"]) {
        const [p, q] = [(await paths.nth(0).locator(part).boundingBox())!, (await paths.nth(1).locator(part).boundingBox())!];
        expect.soft(Math.abs(p.y - q.y), `the paths' ${part}s start level`).toBeLessThanOrEqual(1);
      }
    }
    expect.soft(await paths.nth(0).locator("li").count(), "seven lines each").toBe(await paths.nth(1).locator("li").count());

    const card = page.locator(".mask-rows");
    await scrollToMiddle(page, card);
    const cb = (await card.boundingBox())!;
    const rows = page.locator(".mask-row");
    await expect(rows).toHaveCount(5);
    for (const row of await rows.all()) {
      const rb = (await row.boundingBox())!;
      expect.soft(rb.x, "a masking row inside its card at the left").toBeGreaterThanOrEqual(cb.x - 0.5);
      expect.soft(rb.x + rb.width, "a masking row inside its card at the right").toBeLessThanOrEqual(cb.x + cb.width + 0.5);
      expect.soft(await row.evaluate((e) => e.scrollWidth - e.clientWidth), "nothing in a masking row runs out of it").toBeLessThanOrEqual(0);
    }
    expect.soft(await layoutProblems(page, { root: ".masking" }), "the masking").toEqual([]);
  });

  test("Trust's frames keep each tag on one line, the tags standing level", async ({ page }) => {
    await openHome(page);
    // Each frame's proof is a row of pills, one a tag, wrapping whole (fixed 2026-11-01).
    await expect(page.locator("#security .frame-tags")).toHaveCount(3);
    const tags = page.locator("#security .frame-tags");
    expect.soft(await frameTagsOverflow(page), FRAME_TAGS_BREAK).toBe(false);
    // Each tag named in a frame's proof - "EU hosting", "personal tags", "audit trail" - read
    // from the page's text as one run, however it is marked up, must sit on one line.
    const broken = await page.locator("#security .frame small").evaluateAll((els) =>
      els.flatMap((small) => {
        const nodes: Text[] = [];
        const it = document.createTreeWalker(small, NodeFilter.SHOW_TEXT);
        for (let n = it.nextNode(); n; n = it.nextNode()) nodes.push(n as Text);
        const whole = nodes.map((n) => n.data).join("");
        const out: string[] = [];
        let from = 0;
        for (const part of whole.split(" · ")) {
          const start = whole.indexOf(part, from);
          from = start + part.length;
          const range = document.createRange();
          let at = 0;
          for (const n of nodes) {
            if (start >= at && start <= at + n.data.length) range.setStart(n, start - at);
            if (from >= at && from <= at + n.data.length) {
              range.setEnd(n, from - at);
              break;
            }
            at += n.data.length;
          }
          const tops: number[] = [];
          for (const r of Array.from(range.getClientRects())) if (r.width > 0.5 && !tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
          if (tops.length > 1) out.push(`"${part}" breaks onto ${tops.length} lines`);
        }
        return out;
      }),
    );
    expect.soft(broken, "tags broken inside").toEqual([]);
    const boxes = await tags.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, bottom: r.bottom })));
    if (new Set(boxes.map((b) => Math.round(b.x))).size === 3 && Math.abs(boxes[0].bottom - boxes[2].bottom) < 200) {
      const bottoms = boxes.map((b) => b.bottom);
      expect.soft(Math.max(...bottoms) - Math.min(...bottoms), "the three tags stand on one line across the cards").toBeLessThanOrEqual(1);
    }
  });
});

test.describe("@layout the design's rules", () => {
  test("hold on this screen: sections, buttons, surfaces, shadows, the statement, the demo's names", async ({ page }) => {
    await openHome(page);

    // Every section opens the same way: a small amber label, the heading, one line of intro.
    for (const [id, label] of [
      ["platform", "Deliver"],
      ["why", "Solutions"],
      ["security", "Trust"],
      ["contact", "Contact"],
    ] as const) {
      const head = page.locator(`#${id}`).locator(".sec-head, .contact-side").first();
      const parts = await head.evaluate((h) => Array.from(h.children).map((c) => ({ tag: c.tagName, cls: c.className, color: getComputedStyle(c).color, text: c.textContent })));
      expect.soft(parts.map((p) => p.tag), `#${id} opens label, heading, intro`).toEqual(["P", "H2", "P"]);
      expect.soft(parts[0]?.cls, `#${id}'s first line is its label`).toContain("label");
      expect.soft(parts[0]?.text, `#${id}'s label`).toBe(label);
      expect.soft(parts[2]?.cls, `#${id}'s intro`).toContain("intro");
      // --sun-text in the day: the accent's deep mustard, #856500 (owner, 2026-11-08).
      expect.soft(parts[0]?.color, `#${id}'s label is mustard`).toBe("rgb(133, 101, 0)");
    }

    // Buttons are plain pills: no gradient, fully round, tall enough for a finger.
    const buttons = await page.locator(".btn, .btn2").evaluateAll((els) =>
      els
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => {
          const s = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return { label: e.textContent?.trim(), inBar: !!e.closest("header.top"), height: r.height, radius: parseFloat(s.borderTopLeftRadius), image: s.backgroundImage };
        }),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    const touch = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    for (const b of buttons) {
      expect.soft(b.image, `${b.label}: no gradient`).toBe("none");
      expect.soft(b.radius, `${b.label}: the full pill`).toBeGreaterThanOrEqual(b.height / 2);
      // 44px on a touch screen; the bar's one action is smaller on a phone by design (36px).
      const least = b.inBar ? 36 : touch ? 44 : 36;
      expect.soft(b.height, `${b.label}: tall enough to press`).toBeGreaterThanOrEqual(least - 0.5);
    }

    // Day surfaces are white, never grey; every shadow falls straight down.
    const grey = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".ben, .frame, .path, .pillar, .opt, .sol-safe, .win.app, .daylight .glass"))
        .map((e) => ({ el: `${e.tagName.toLowerCase()}.${e.classList[0]}`, bg: getComputedStyle(e).backgroundColor }))
        .filter((x) => x.bg !== "rgb(255, 255, 255)" && x.bg !== "rgba(0, 0, 0, 0)"),
    );
    expect.soft(grey, "cards with a fill that is not white").toEqual([]);
    const sideways = await page.evaluate(() => {
      const out: string[] = [];
      for (const e of Array.from(document.querySelectorAll(".daylight, .daylight *"))) {
        const shadow = getComputedStyle(e).boxShadow;
        if (!shadow || shadow === "none") continue;
        for (const one of shadow.split(/,(?![^(]*\))/)) {
          if (one.includes("inset")) continue;
          const x = parseFloat(one.replace(/rgba?\([^)]*\)|hsla?\([^)]*\)/, "").trim().split(/\s+/)[0]);
          if (x !== 0) out.push(`${e.tagName.toLowerCase()}.${e.classList[0] ?? ""}: ${one.trim()}`);
        }
      }
      return [...new Set(out)];
    });
    expect.soft(sideways, "shadows cast sideways (docs/design-system.md section 3.3: one light straight above)").toEqual([]);

    // With less motion asked for, the statement is shown lit and unpinned.
    const words = await page.locator(".statement .w").count();
    expect.soft(words, "the statement's words").toBeGreaterThan(10);
    await expect.soft(page.locator(".statement .w.lit"), "every word of the statement lit").toHaveCount(words);
    await expect.soft(page.locator(".statement")).toHaveClass(/still/);

    // A card does not rise under the pointer (where there is one).
    if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
      for (const sel of ["#platform .path", "#why .ben", "#security .frame", "#security .pillar"]) {
        const card = page.locator(sel).first();
        await scrollToMiddle(page, card);
        const before = (await card.boundingBox())!;
        await card.hover();
        await settle(page);
        expect.soft(Math.abs((await card.boundingBox())!.y - before.y), `${sel} stays where it is under the pointer`).toBeLessThanOrEqual(0.5);
        expect.soft(await card.evaluate((e) => getComputedStyle(e).transform), `${sel} is not transformed`).toBe("none");
      }
    }

    // docs/design-system.md section 7.1: a short shared name inside the demo window picked up the page's
    // padding and layout (.done, .why, .grid, .seg), and the page's .step and .log once turned
    // Solutions' pills into a column. What the window uses the page must not, nor the other way
    // round - but for the icon font and the screen-reader utility, shared on purpose, and the is-
    // states, which only ever qualify a name of their own (.turn-w.is-on, .tt-dot.is-on).
    const inside = new Set<string>();
    for (const t of TABS) {
      await page.getByRole("tab", { name: t }).click();
      for (const c of await screen(page).evaluate((s) => Array.from(s.querySelectorAll("*")).flatMap((e) => Array.from(e.classList)))) inside.add(c);
    }
    const outside = await page.evaluate(() => {
      const win = document.querySelector("#screen")!;
      return Array.from(document.body.querySelectorAll("*"))
        .filter((e) => !win.contains(e))
        .flatMap((e) => Array.from(e.classList));
    });
    const shared = [...new Set(outside)].filter((c) => inside.has(c) && !/^(ti|ti-.+|sr|is-.+)$/.test(c));
    expect.soft(shared, "class names used both inside the demo window and on the page").toEqual([]);
  });
});

// Each kind of break, put into the page on purpose: the audit must name it. If one of these
// starts passing, the audit has gone blind to that kind of break, and a real one would pass too.
test.describe("@layout the audit catches what it should", () => {
  test("each kind of break, put in on purpose, by name", async ({ page }) => {
    test.skip(width(page) !== 1440, "proved once, at the desktop size");
    const found = async (css: string, root?: string) => {
      await openHome(page);
      await page.addStyleTag({ content: css });
      await settle(page);
      return (await layoutProblems(page, root ? { root } : {})).join("\n");
    };
    expect.soft(await found(".hero .ctas .btn { white-space: normal !important; width: 60px !important; }"), "a button's label broken onto lines").toMatch(
      /wrapped: .*"Book a demo" - its label breaks onto \d lines/,
    );
    expect.soft(await found(".frame p { white-space: nowrap !important; }"), "text pushed past a card that clips it").toMatch(/cut-off: .*frame.* runs \d+px past the edge of .*frame/);
    expect.soft(await found("footer .wrap { min-width: 3000px !important; }"), "a page wider than its window").toMatch(/sideways: the page is \d+px wider than the window/);
    expect.soft(await found("footer h4 { margin-left: 2000px !important; white-space: nowrap; }", "footer"), "text running off the window").toMatch(
      /off-screen: .*"Product" runs \d+px past the edge of the window/,
    );
    expect.soft(
      await found(".contact form .btn { width: 40px !important; min-width: 0 !important; padding: 0 !important; justify-content: flex-start !important; }"),
      "a label running out of its button",
    ).toMatch(/spills: .*"Send message" - its label runs \d+px out of its box/);
  });
});
