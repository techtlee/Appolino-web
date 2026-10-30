import { useEffect, useState, type RefObject } from "react";

/** The reader asks for less motion: the field stands still, the check
 *  shows its end state, and panels change without sliding. */
export function prefersLessMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Czech decimal comma, one place. */
export const fmt = (n: number) => n.toFixed(1).replace(".", ",");

/** True once the element has been seen - by default a third of it in view,
 *  as Appolino's home hero asks before it plays. */
export function useSeen(ref: RefObject<Element>, threshold = 0.33): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, threshold]);
  return seen;
}
