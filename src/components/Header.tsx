import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FLAGS } from "../flags";
import { useLang, useSetLang, useT, type Lang } from "../i18n";
import { Logo } from "./Logo";

/** The sections the nav links to, named in English and Czech, as a product site's bar names
 *  them (owner, 2026-11-01: Platform, Solutions, About, Contact): the platform is the demo,
 *  the solutions what a team gets back - About and the country-specific data are part of
 *  Solutions now (owner, 2026-11-01: "merge them together"), so About left the bar. The
 *  security section stays in the bar, named Trust (owner, 2026-11-01: "security name put there
 *  trust"); its id is still #security. The footer links to every section (FOOTER). */
export const NAV: [string, string, string][] = [
  ["try", "Platform", "Platforma"],
  ["why", "Solutions", "Řešení"],
  ["security", "Trust", "Důvěra"],
  ["contact", "Contact", "Kontakt"],
];

/** Every part of the page, for the footer's Product column. */
export const FOOTER: [string, string, string][] = [
  ["try", "Platform", "Platforma"],
  ["platform", "Deliver", "Doručení"],
  ["why", "Solutions", "Řešení"],
  ["security", "Trust", "Důvěra"],
  ...(FLAGS.changelog ? [["changelog", "Changelog", "Novinky"] as [string, string, string]] : []),
];

/** The language, as the best product sites place it (Stripe, Vercel, the Awwwards winners): a
 *  quiet control in the bar beside the one action - a globe and the code of the language now
 *  shown - opening a small menu that names each language in its own words, the current one
 *  ticked. It closes on a choice, a click outside or Esc. */
function LangSwitch() {
  const lang = useLang();
  const setLang = useSetLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("pointerdown", away);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", away);
      removeEventListener("keydown", esc);
    };
  }, [open]);
  const opts: [Lang, string, string][] = [
    ["en", "EN", "English"],
    ["cs", "CZ", "Čeština"],
  ];
  return (
    <span className={`lang${open ? " is-open" : ""}`} ref={box}>
      <button type="button" className="lang-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Language / Jazyk" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9M12 3c-2.6 2.8-3.9 5.8-3.9 9s1.3 6.2 3.9 9" />
        </svg>
        <b>{lang === "cs" ? "CZ" : "EN"}</b>
        <svg className="lang-car" viewBox="0 0 24 24" width="12" height="12" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <span className="lang-menu" role="menu">
          {opts.map(([l, short, name]) => (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={lang === l}
              lang={l}
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
            >
              <span>{name}</span>
              <small>{short}</small>
              {lang === l && (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** Whether the page has moved under the bar: at the very top the bar is no bar at all, the
 *  hero's light running up behind it; scrolled, it is a pane of the page's own light. */
function useScrolled(): boolean {
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const set = () => setMoved(scrollY >= 24);
    set();
    addEventListener("scroll", set, { passive: true });
    return () => removeEventListener("scroll", set);
  }, []);
  return moved;
}

/** Brand, the nav beside it, actions on the right; a line of light under the section in view. */
export function Header({ active }: { active: string }) {
  const navRef = useRef<HTMLElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0, opacity: 0 });
  const moved = useScrolled();
  const t = useT();

  useLayoutEffect(() => {
    const place = () => {
      const a = navRef.current?.querySelector<HTMLAnchorElement>(`a[data-id="${active}"]`);
      setInd((p) => (a ? { left: a.offsetLeft, width: a.offsetWidth, opacity: 1 } : { ...p, opacity: 0 }));
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [active, t]);

  return (
    <header className={moved ? "top daylight" : "top daylight clear"}>
      <div className="wrap">
        <a href="#top" className="brand" aria-label={t("appolino, back to top", "appolino, zpět nahoru")}>
          <Logo />
        </a>
        <nav className="nav" ref={navRef} aria-label={t("Sections", "Sekce")}>
          {NAV.map(([id, en, cs]) => (
            <a key={id} href={`#${id}`} data-id={id} className={active === id ? "on" : ""}>
              {t(en, cs)}
            </a>
          ))}
          <span className="nav-ind" style={ind} />
        </nav>
        {/* One clear action, as a product site's bar has it, and the language beside it. */}
        <div className="top-actions">
          {FLAGS.czech && <LangSwitch />}
          <a className="btn" href="#contact">
            {t("Book a demo", "Domluvit ukázku")}
          </a>
        </div>
      </div>
    </header>
  );
}
