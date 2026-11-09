import { createContext, useContext } from "react";

/** The demo's tour through its tabs (owner, 2026-11-08: "pokud animace doběhne, bylo by fajn
 *  skočit na tu další animaci"): each screen says when its own round has played through once,
 *  and when the visitor has taken it over; the showcase (components/Showcase.tsx) moves on to
 *  the next tab on the first and stays put after the second. Outside a showcase - the
 *  standalone embed - both do nothing. */
export type Cycle = {
  /** The screen's autoplay has played one whole round. */
  roundEnd: () => void;
  /** The visitor has taken the screen over: stay on it. */
  takeover: () => void;
};

const noop = () => {};
export const CycleCtx = createContext<Cycle>({ roundEnd: noop, takeover: noop });
export const useCycle = () => useContext(CycleCtx);

/** How long each tab plays before the next opens, in ms - what the line under the tab fills
 *  over. About one round of each screen (from its timers, 2026-11-08); a screen that ends its
 *  round sooner moves on sooner. Deliver's whole story is over a minute, so it shows its first
 *  scenes and moves on. */
export const ROUND_MS: Record<string, { wide: number; phone?: number }> = {
  import: { wide: 9_000 },
  tables: { wide: 27_400 },
  validate: { wide: 25_700 },
  deliver: { wide: 30_000, phone: 24_000 },
  ask: { wide: 40_000 },
};
