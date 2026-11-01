// Layout rules that hold on any part of the page, at any window size, with no baseline - after
// bdop's (frontend/tests/browser/support/layout.ts).
//
// A screenshot compared with a baseline says that a screen changed. It cannot say that a screen
// is wrong: the baseline is made from the screen as it is, so a word cut off at a card's edge is
// recorded as correct and every later run agrees with it. These rules ask the page itself:
//
//   sideways   the page is wider than the window and scrolls sideways
//   off-screen text runs past the window's edge
//   cut-off    text runs past the edge of a box that clips it (a card, the page's own
//              sideways clip) - without the ellipsis that says it was shortened
//   wrapped    a button's label breaks onto a second line
//   spills     a button's label runs out of its own box
//
// Deliberately not a problem: text scrolled out of sight inside a box that scrolls (the
// carousel's further cards, a wide grid on a phone), text that is not shown (opacity 0, hidden,
// the turning words waiting their turn) and text hidden for screen readers alone (`.sr`).
//
// `audit` runs inside the page (page.evaluate sends its source), so it uses nothing from outside
// its own body.

import type { Page } from "@playwright/test";

export type AuditOptions = {
  /** Only this part of the page (a CSS selector); the whole page by default. */
  root?: string;
  /** Subtrees not checked. Say why beside each one, where it is passed. */
  ignore?: string[];
};

/** Every broken layout rule in the part of the page asked about, one sentence each. */
export async function layoutProblems(page: Page, options: AuditOptions = {}): Promise<string[]> {
  return page.evaluate(audit, { root: options.root ?? "body", ignore: options.ignore ?? [], buttons: BUTTONS });
}

/** The selectors whose labels must stay on one line: the page's two buttons and the demo's
 *  (docs/design-system.md section 4.1: "labels never wrap"), the demo's tabs, and every segmented choice. */
export const BUTTONS = ".btn, .btn2, .tt-btn, .tabs [role=tab], .tt-seg > button, .sol-arrow";

function audit({ root, ignore, buttons }: { root: string; ignore: string[]; buttons: string }): string[] {
  const W = document.documentElement.clientWidth;
  const found = new Map<string, number>();
  const report = (s: string) => found.set(s, (found.get(s) ?? 0) + 1);
  const px = (n: number) => `${Math.round(n)}px`;
  const skip = (el: Element) => ignore.some((sel) => el.closest(sel) !== null);
  const shown = (el: Element) =>
    typeof el.checkVisibility !== "function" || el.checkVisibility({ opacityProperty: true, visibilityProperty: true } as CheckVisibilityOptions);
  /** A short path to an element - its tag and first classes, two levels up. */
  const name = (el: Element) => {
    const parts: string[] = [];
    for (let n: Element | null = el, d = 0; n && n !== document.body && d < 3; n = n.parentElement, d++) {
      const cls = Array.from(n.classList)
        .filter((c) => !/^is-/.test(c))
        .slice(0, 2)
        .map((c) => `.${c}`)
        .join("");
      parts.unshift(n.tagName.toLowerCase() + cls);
    }
    return parts.join(" > ");
  };
  const says = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    return `"${t.length > 40 ? `${t.slice(0, 39)}…` : t}"`;
  };
  type Box = { l: number; t: number; r: number; b: number };
  /** The part of an element its overflow clips to: its padding box. */
  const clipBox = (a: Element): Box => {
    const r = a.getBoundingClientRect();
    const l = r.left + a.clientLeft;
    const t = r.top + a.clientTop;
    return { l, t, r: l + a.clientWidth, b: t + a.clientHeight };
  };
  const clips = (v: string) => v === "hidden" || v === "clip";

  const base = document.querySelector(root);
  if (!base) return [`missing: nothing matches ${root}`];

  if (root === "body") {
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) report(`sideways: the page is ${px(de.scrollWidth - de.clientWidth)} wider than the window and scrolls sideways`);
  }

  // ------------------------------------------------------------------- text
  const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? "";
    const el = n.parentElement;
    if (!el || !text.trim() || skip(el) || !shown(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const lines = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 0.5);
    lines: for (const line of lines) {
      const v: Box = { l: line.left, t: line.top, r: line.right, b: line.bottom };
      for (let a: Element | null = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.display === "inline" || s.display === "contents") continue;
        if (s.overflowX === "visible" && s.overflowY === "visible") continue;
        const c = clipBox(a);
        // A box a pixel or two across that clips is hiding its text on purpose (.sr).
        if (c.r - c.l <= 2 || c.b - c.t <= 2) continue lines;
        const axes: [string, "l" | "t", "r" | "b"][] = [
          [s.overflowX, "l", "r"],
          [s.overflowY, "t", "b"],
        ];
        for (const [overflow, lo, hi] of axes) {
          if (overflow === "visible") continue;
          if (clips(overflow) && (v[lo] < c[lo] - 1 || v[hi] > c[hi] + 1) && !(s.textOverflow === "ellipsis" && s.whiteSpace.includes("nowrap"))) {
            const by = Math.max(c[lo] - v[lo], v[hi] - c[hi]);
            report(`cut-off: ${name(el)} ${says(text)} runs ${px(by)} past the edge of ${name(a)}, which clips it`);
          }
          // What is left in sight inside this box; a scrolled-out line is simply not on show.
          v[lo] = Math.max(v[lo], c[lo]);
          v[hi] = Math.min(v[hi], c[hi]);
          if (v[hi] - v[lo] <= 0.5) continue lines;
        }
      }
      if (v.r > W + 1 || v.l < -1) {
        report(`off-screen: ${name(el)} ${says(text)} runs ${px(Math.max(v.r - W, -v.l))} past the edge of the window`);
      }
    }
  }

  // ---------------------------------------------------------------- buttons
  for (const b of Array.from(base.querySelectorAll(buttons))) {
    if (skip(b) || !shown(b)) continue;
    const box = b.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const rects: DOMRect[] = [];
    const it = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let t = it.nextNode(); t; t = it.nextNode()) {
      if (!t.textContent?.trim() || !t.parentElement || !shown(t.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      rects.push(...Array.from(range.getClientRects()).filter((r) => r.width > 0.5));
    }
    if (!rects.length) continue;
    const label = b.textContent ?? "";
    const tops: number[] = [];
    for (const r of rects) if (!tops.some((top) => Math.abs(top - r.top) < r.height / 2)) tops.push(r.top);
    if (tops.length > 1) report(`wrapped: ${name(b)} ${says(label)} - its label breaks onto ${tops.length} lines`);
    const l = Math.min(...rects.map((r) => r.left));
    const r = Math.max(...rects.map((r) => r.right));
    if (l < box.left - 1 || r > box.right + 1) report(`spills: ${name(b)} ${says(label)} - its label runs ${px(Math.max(box.left - l, r - box.right))} out of its box`);
  }

  return Array.from(found.entries()).map(([s, n]) => (n > 1 ? `${s} (x${n})` : s));
}
