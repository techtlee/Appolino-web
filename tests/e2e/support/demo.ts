// The demo window (src/app, docs/design-system.md section 7): its five tabs, and the states a visitor can
// put each one in. One list serves the flows, the layout audit, the accessibility scan and the
// screenshots, so a state that is screenshot is also audited, and every one is reached the way
// a visitor reaches it - by the tab's own buttons, found by their names.
//
// Reached with less motion asked for (the suite's default), where every run is over at once and
// no story plays under the test: the same state every time.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { fontsReady, scrollToMiddle, settle } from "./page";

export const TABS = ["Extract", "Transform", "Validate", "Deliver", "Ask"] as const;
export type Tab = (typeof TABS)[number];

/** The window the tabs open into. */
export const screen = (page: Page) => page.locator("#screen");
export const tab = (page: Page, name: Tab) => page.getByRole("tab", { name });

/** Opens a tab and brings the window into view, where its screen counts as seen. */
export async function openTab(page: Page, name: Tab): Promise<Locator> {
  await scrollToMiddle(page, page.locator(".stage"));
  await tab(page, name).click();
  await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
  await expect(screen(page)).toHaveAttribute("aria-labelledby", (await tab(page, name).getAttribute("id")) as string);
  await scrollToMiddle(page, page.locator(".stage"));
  return screen(page);
}

/** Transform's steps beside the table: History and Transform are one switch over its card. */
export async function openTransform(page: Page): Promise<Locator> {
  const s = screen(page);
  await s.getByRole("radiogroup", { name: "Beside the table" }).getByRole("radio", { name: /Transform/ }).click();
  const panel = s.getByRole("region", { name: "Transform" });
  await expect(panel).toBeVisible();
  return panel;
}

/** Adds a step by its tile, opening its kind first. */
export async function addStep(page: Page, kind: "Shape" | "Calculate" | "Combine", name: string): Promise<void> {
  const panel = screen(page).getByRole("region", { name: "Transform" });
  await panel.getByRole("radiogroup", { name: "Kind of step" }).getByRole("radio", { name: kind }).click();
  await panel.getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
}

/** What arrives today in Deliver; the chips wait while a run is on its way. */
export async function deliverScenario(page: Page, name: "As usual" | "New column" | "Half the rows" | "Bad value"): Promise<void> {
  const s = screen(page);
  await s.getByRole("radiogroup", { name: "What arrives today" }).getByRole("radio", { name }).click();
  await expect(s.getByRole("radio", { name })).toHaveAttribute("aria-checked", "true");
}

/** Deliver at rest: its first run, started by itself a moment after the window is seen, over. */
export async function deliverAtRest(page: Page): Promise<void> {
  await expect(screen(page).getByRole("button", { name: "Run again" })).toBeVisible();
}

type Step = {
  name: string;
  act?: (page: Page) => Promise<void>;
  /** Only where the screen offers what the step presses: a phone's Deliver plays the usual runs
   *  alone, without the chips that pick what arrives (docs/design-system.md section 7.4, 2026-11-01). */
  offered?: (page: Page) => Locator;
};

/** Deliver's chips: what arrives today. */
export const chips = (page: Page) => screen(page).getByRole("radiogroup", { name: "What arrives today" });

/** Whether every step of a state is offered on this screen. */
export async function offered(page: Page, steps: Step[]): Promise<boolean> {
  for (const s of steps) if (s.offered && !(await s.offered(page).isVisible())) return false;
  return true;
}

/** Each tab's states in the order a visitor reaches them, each step acting on the one before. */
export const WALKS: Record<Tab, Step[]> = {
  // The read over: its button offers to read again (a phone folds the log that says so).
  Extract: [{ name: "extract", act: async (p) => void (await expect(screen(p).getByRole("button", { name: "Read again" })).toBeEnabled()) }],
  Transform: [
    { name: "transform" },
    { name: "transform-open", act: async (p) => void (await openTransform(p)) },
    {
      name: "transform-pivot",
      act: async (p) => {
        await addStep(p, "Shape", "Pivot: months by region");
        await expect(screen(p).getByRole("columnheader", { name: "Month" })).toBeVisible();
      },
    },
    {
      name: "transform-sql",
      act: async (p) => {
        await screen(p).getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: "SQL" }).click();
        await expect(screen(p).locator("pre.tt-sql")).toBeVisible();
      },
    },
  ],
  Validate: [
    { name: "validate" },
    {
      name: "validate-run",
      act: async (p) => {
        await screen(p).getByRole("button", { name: "Validate", exact: true }).click();
        await expect(screen(p).getByRole("button", { name: "Fix all" })).toBeVisible();
      },
    },
    {
      name: "validate-fixed",
      act: async (p) => {
        await screen(p).getByRole("button", { name: "Fix all" }).click();
        await expect(screen(p).getByText("Remembered for the next import")).toBeVisible();
      },
    },
  ],
  Deliver: [
    { name: "deliver", act: deliverAtRest },
    {
      name: "deliver-schema-held",
      offered: chips,
      act: async (p) => {
        await deliverScenario(p, "New column");
        await expect(screen(p).getByText(/^Held at the schema gate/)).toBeVisible();
      },
    },
    {
      name: "deliver-bad-held",
      offered: chips,
      act: async (p) => {
        await deliverScenario(p, "Bad value");
        await expect(screen(p).getByRole("button", { name: /^Correct to .* and deliver$/ })).toBeVisible();
      },
    },
    {
      name: "deliver-corrected",
      offered: chips,
      act: async (p) => {
        await screen(p).getByRole("button", { name: /^Correct to .* and deliver$/ }).click();
        await expect(screen(p).locator(".tt-banner.is-ok")).toBeVisible();
      },
    },
  ],
  Ask: [
    { name: "ask" },
    {
      name: "ask-applied",
      act: async (p) => {
        const s = screen(p);
        await s.locator(".tt-try button").first().click();
        await s.getByRole("button", { name: "Apply", exact: true }).click();
        await expect(s.getByRole("button", { name: /Saved steps/ })).toBeEnabled();
      },
    },
  ],
};

export type DemoState = { name: string; tab: Tab; steps: Step[] };

/** Every state of the demo, each reached afresh: its tab's steps up to it. */
export const DEMO_STATES: DemoState[] = TABS.flatMap((t) => WALKS[t].map((s, i) => ({ name: s.name, tab: t, steps: WALKS[t].slice(0, i + 1) })));

/** Settles the frame after a step: its fonts in, two frames drawn. */
async function drawn(page: Page) {
  await fontsReady(page);
  await settle(page);
}

/** Brings the demo to a state from a freshly loaded page; false, and nothing pressed, when this
 *  screen does not offer one of its steps. */
export async function reach(page: Page, state: DemoState): Promise<boolean> {
  await openTab(page, state.tab);
  for (const step of state.steps) {
    if (!(await offered(page, [step]))) return false;
    if (step.act) await step.act(page);
  }
  await drawn(page);
  return true;
}

/** Walks one tab through all its states on one page, calling `each` at every state this screen
 *  offers: the cheap way to check them all, where a screenshot's need for a fresh start does
 *  not apply. */
export async function walk(page: Page, t: Tab, each: (state: string) => Promise<void>): Promise<void> {
  await openTab(page, t);
  for (const step of WALKS[t]) {
    if (!(await offered(page, [step]))) {
      test.info().annotations.push({ type: "not offered here", description: `${step.name}: this screen has nothing to press for it` });
      break;
    }
    if (step.act) await step.act(page);
    await drawn(page);
    await each(step.name);
  }
}
