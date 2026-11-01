import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * The site's regression suite (tests/e2e, README "Tests"). Every project is a real window or
 * device, and each runs only the kinds of test worth its cost, by tag:
 *
 *   @smoke    the page loads, every link lands, nothing errors over a full scroll
 *   @layout   rules that need no baseline: nothing sideways, outside the window or cut off,
 *             no button label wrapping, cards level (support/layout.ts)
 *   @flow     what a visitor does: the hero's turning word, every demo tab, the carousel,
 *             the contact form
 *   @content  the owner's standing copy rules over every word the page shows
 *   @a11y     axe-core, WCAG 2.2 A and AA, serious and critical violations fail
 *   @visual   screenshots against committed baselines, made and compared only in the Linux
 *             Playwright image (npm run test:e2e:docker), as CI runs them
 *
 * The cheap rules run on every device; screenshots on a representative five; the flows on a
 * desktop, a phone and a tablet. The production bundle is built and served on a port of its
 * own, so a dev server on 5174 is never what is tested.
 */

const PORT = 5180;
const CI = !!process.env.CI;

const ALL = ["@smoke", "@layout", "@flow", "@content", "@a11y", "@visual"] as const;
type Tag = (typeof ALL)[number];
/** A project that runs only the tests carrying one of these tags. */
const only = (tags: readonly Tag[]) => new RegExp(tags.join("|"));

const SCREENSHOT = {
  // A small tolerance: anti-aliasing moves, a layout change does not hide under it. Set
  // PW_PIXEL_RATIO=0 before an update run to rewrite every baseline that differs at all.
  maxDiffPixelRatio: process.env.PW_PIXEL_RATIO ? Number(process.env.PW_PIXEL_RATIO) : 0.002,
  threshold: 0.2,
  animations: "disabled" as const,
  caret: "hide" as const,
  scale: "css" as const,
};

/** WebKit draws this page far more slowly than Chromium where it has no graphics card of its own
 *  (Playwright's Windows build: some five seconds a click in the demo, against a tenth), so its
 *  projects get four times the time; a real hang still fails, only later. */
const SLOW = 4;

const project = (name: string, use: Project["use"], tags: readonly Tag[]): Project => {
  const webkit = (use as { defaultBrowserType?: string } | undefined)?.defaultBrowserType === "webkit";
  return {
    name,
    use,
    grep: only(tags),
    ...(webkit ? { timeout: 90_000 * SLOW, expect: { timeout: 10_000 * SLOW, toHaveScreenshot: SCREENSHOT } } : {}),
  };
};

export default defineConfig({
  testDir: "./tests/e2e",
  // The demo's loops run on timers of several seconds; a test that watches one play needs room.
  timeout: 90_000,
  expect: { timeout: 10_000, toHaveScreenshot: SCREENSHOT },
  // One set of baselines for every machine: the platform is left out of the name, because they
  // are only ever made and compared in the Linux image (tests/e2e/docker.mjs, CI).
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }], ["list"]] : [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Every failure leaves the whole page as it stood and a recording of the run.
    screenshot: { mode: "only-on-failure", fullPage: true },
    trace: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "Europe/Prague",
  },
  webServer: {
    // Built as `npm run build` builds (type-check, then bundle), but into a folder of its own: a
    // build of dist/ by anyone else during a run swapped the bundle's hashed files out from under
    // the pages being tested, which then failed on a 404.
    command: `npx tsc -b && npx vite build --outDir .e2e-dist --emptyOutDir && npx vite preview --outDir .e2e-dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 240_000,
    // The flags are pinned off, whatever an .env.local says: the suite tests what ships. The
    // contact form sends to the suite's own inbox (support/test.ts), never to the real Worker.
    env: { VITE_FLAG_CZECH: "", VITE_FLAG_CHANGELOG: "", VITE_FLAG_ROAD: "", VITE_CONTACT_URL: "/__contact" },
  },
  projects: [
    // The five sizes the site is designed at.
    project("desktop", { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, ALL),
    project("laptop", { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }, ["@smoke", "@layout", "@a11y"]),
    project("tablet", { ...devices["Desktop Chrome"], viewport: { width: 1000, height: 800 } }, ["@smoke", "@layout", "@a11y"]),
    project("phone", { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, ["@smoke", "@layout", "@content", "@a11y"]),
    project("small-phone", { ...devices["Galaxy S24"] }, ["@smoke", "@layout", "@a11y", "@visual"]),
    // Real devices from Playwright's registry: their viewport, pixel ratio, user agent and
    // touch. The iPhones and iPads run in WebKit, the engine every browser on them uses.
    project("iPhone SE", { ...devices["iPhone SE (3rd gen)"] }, ["@smoke", "@layout"]),
    project("iPhone 15", { ...devices["iPhone 15"] }, ["@smoke", "@layout", "@flow", "@visual"]),
    project("iPhone 15 Pro Max", { ...devices["iPhone 15 Pro Max"] }, ["@smoke", "@layout"]),
    project("Galaxy S8", { ...devices["Galaxy S8"] }, ["@smoke", "@layout"]),
    project("Pixel 7", { ...devices["Pixel 7"] }, ["@smoke", "@layout"]),
    project("iPad Mini", { ...devices["iPad Mini"] }, ["@smoke", "@layout", "@flow", "@visual"]),
    project("iPad Pro 11", { ...devices["iPad Pro 11"] }, ["@smoke", "@layout"]),
    project("desktop-1920", { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } }, ["@smoke", "@layout"]),
    project("desktop-2560", { ...devices["Desktop Chrome"], viewport: { width: 2560, height: 1440 } }, ["@smoke", "@layout", "@visual"]),
  ],
});
