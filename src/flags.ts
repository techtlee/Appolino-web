/**
 * Feature flags: parts of the site that are built but not shown yet. Each is
 * read at build time from a VITE_FLAG_* variable - an .env file locally, the
 * host's build settings in production - and is off unless set to "1". Vite
 * writes the value into the bundle, so a section that is off is left out of
 * it altogether, and switching one on is a rebuild, not a code change.
 */
export const FLAGS = {
  /** The changelog section and its links: on once there are releases to list. */
  changelog: import.meta.env.VITE_FLAG_CHANGELOG === "1",
  /** Czech, and the language menu that offers it. Off, the page is English for everyone,
   *  whatever the browser's language or a choice kept from before (owner, 2026-11-01: "turn
   *  Czech off with a feature flag, keep English only"); every Czech text stays in the code. */
  czech: import.meta.env.VITE_FLAG_CZECH === "1",
  /** "How you work in appolino" - the four steps at the foot of Solutions and the line on Ask,
   *  put away for now (owner, 2026-11-01: "put this away with a feature flag"). */
  road: import.meta.env.VITE_FLAG_ROAD === "1",
} as const;
