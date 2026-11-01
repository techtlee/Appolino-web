// The `test` every spec imports. What it guarantees, so a spec only says what it is about:
//
// - motion is chosen per test: `motion: "reduce"` (the default) is the page as a visitor who
//   asks for less motion sees it - the sky and sun drawn still, the statement lit, the demo's
//   loops not playing, every run over at once - which is what makes a state reachable the same
//   way every time; `motion: "play"` is everyone else's page, for what is about movement;
// - hermetic: the page may ask nothing of any other site. A request that leaves localhost is
//   refused and fails the test by its address - a font or script pulled from a CDN is a page
//   that works here and breaks the day that CDN does;
// - a page error, a console error, a failed request or an HTTP error from the site fails the
//   test that caused it, named, at its end;
// - every word the page shows while the test runs - text that arrives later included, read as
//   it arrives - is held to the owner's copy rules (support/copy.ts), so a loop or a state no
//   content test visits cannot slip a dash or a claim past them;
// - the contact form never sends real mail: the suite builds it to send to CONTACT_PATH, which
//   an inbox in the test answers, keeping what arrived and answering as the test asks.

import { expect, test as base } from "@playwright/test";
import { copyProblems } from "./copy";

export type Motion = "reduce" | "play";

type Options = {
  /** The visitor's motion preference, set before the page loads. */
  motion: Motion;
};

type Guard = {
  /** Console errors a test expects and accepts, matched by their text. */
  allowConsole: (pattern: RegExp) => void;
};

/** Where the suite's build sends the contact form (VITE_CONTACT_URL in playwright.config.ts). */
export const CONTACT_PATH = "/__contact";

type Inbox = {
  /** Every form the page sent, as the Worker would read it. */
  received: Record<string, string>[];
  /** The status the next sends are answered with: 200 by default, a failure to see the page cope. */
  answer: (status: number) => void;
};

/** Records every text node the page ever holds, in the page: the observer is installed before
 *  any script of the page's runs, so nothing the page writes is missed. Text inside code and
 *  form fields is marked, for the rules that are about prose. */
function recordText() {
  const w = window as unknown as { __seenText: Map<string, boolean> };
  w.__seenText = new Map();
  const keep = (n: Node) => {
    const t = n.textContent ?? "";
    if (!t.trim() || w.__seenText.size > 50_000) return;
    const code = !!n.parentElement?.closest("code, pre, textarea, input, script, style");
    w.__seenText.set(t, code);
  };
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) return keep(n);
    const it = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    for (let t = it.nextNode(); t; t = it.nextNode()) keep(t);
  };
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") keep(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
}

export const test = base.extend<Options & { guard: Guard; inbox: Inbox }>({
  motion: ["reduce", { option: true }],

  page: async ({ page, motion }, use) => {
    await page.emulateMedia({ reducedMotion: motion === "reduce" ? "reduce" : "no-preference" });
    await use(page);
  },

  inbox: [
    async ({ page, baseURL }, use) => {
      const received: Record<string, string>[] = [];
      let status = 200;
      await page.route(new URL(CONTACT_PATH, baseURL).href, async (route) => {
        received.push(JSON.parse(route.request().postData() ?? "{}"));
        await route.fulfill({ status, contentType: "application/json", body: status < 300 ? '{"ok":true}' : '{"error":"could not send"}' });
      });
      await use({ received, answer: (s) => (status = s) });
    },
    { auto: true },
  ],

  guard: [
    async ({ page, context, baseURL }, use, info) => {
      const origin = new URL(baseURL ?? "http://localhost").origin;
      // A failure the inbox was told to answer with is the test's subject, not a broken site.
      const ours = (url: string) => url.startsWith(origin) && new URL(url).pathname !== CONTACT_PATH;
      const outside: string[] = [];
      const pageErrors: string[] = [];
      const consoleErrors: string[] = [];
      const failed: string[] = [];
      const allowed: RegExp[] = [];

      await context.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => {
        outside.push(route.request().url());
        return route.abort("blockedbyclient");
      });
      await page.addInitScript(recordText);
      page.on("pageerror", (e) => pageErrors.push(`${e.name}: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !allowed.some((p) => p.test(m.text()))) consoleErrors.push(m.text());
      });
      page.on("requestfailed", (r) => {
        // An aborted outside request is reported once, above; a navigation away is the test's.
        if (ours(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED") failed.push(`${r.url()} (${r.failure()?.errorText})`);
      });
      page.on("response", (r) => {
        if (ours(r.url()) && r.status() >= 400) failed.push(`${r.url()} answered ${r.status()}`);
      });

      await use({ allowConsole: (p) => allowed.push(p) });

      // Every word the page showed while the test ran, and what it says in its attributes now.
      const seen = await page
        .evaluate(() => {
          const w = window as unknown as { __seenText?: Map<string, boolean> };
          const texts = [...(w.__seenText ?? new Map()).entries()].map(([text, code]) => ({ text, code }));
          // React writes "{a} - {b}" as three text nodes; an element's whole text joins them.
          for (const el of Array.from(document.body.querySelectorAll("*"))) {
            if (!Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) continue;
            texts.push({ text: el.textContent ?? "", code: !!el.closest("code, pre, textarea, script, style") });
          }
          for (const el of Array.from(document.querySelectorAll("[aria-label], [title], [placeholder], img[alt]"))) {
            for (const a of ["aria-label", "title", "placeholder", "alt"]) {
              const v = el.getAttribute(a);
              if (v && v.trim()) texts.push({ text: v, code: false });
            }
          }
          texts.push({ text: document.title, code: false });
          return texts;
        })
        .catch(() => [] as { text: string; code: boolean }[]);

      expect(outside, "the page asked another site for something; everything it needs ships with it").toEqual([]);
      // Before the console: a failed request names its address, the browser's line does not.
      expect(failed, "requests to the site that failed").toEqual([]);
      expect(pageErrors, "uncaught errors in the page").toEqual([]);
      expect(consoleErrors, "errors the page logged").toEqual([]);
      expect(copyProblems(seen), `the owner's copy rules, over every word the page showed in "${info.title}"`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
