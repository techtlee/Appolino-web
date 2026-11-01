import { useEffect, useState } from "react";
import { FOOTER, Header, NAV, Wordmark } from "./components/Header";
import { useT } from "./i18n";
import { Hero } from "./components/Hero";
import { Showcase } from "./components/Showcase";
import { Platform } from "./components/Platform";
import { Benefits } from "./components/Benefits";
import { Trust } from "./components/Trust";
import { Changelog } from "./components/Changelog";
import { Contact } from "./components/Contact";
import { FLAGS } from "./flags";
import sun from "./assets/appolino-sun.svg";


/** How far the day has risen over the night: --day on the page, 0 at the
 *  top to 1 once a whole screen has been scrolled, for the stylesheet to
 *  fade the headline and the sun by. */
function useDayRising() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const set = () => {
      raf = 0;
      root.style.setProperty("--day", Math.min(1, Math.max(0, scrollY / innerHeight)).toFixed(3));
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(set);
    };
    set();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
    };
  }, []);
}

export default function App() {
  const [active, setActive] = useState("");
  const t = useT();
  useDayRising();

  // The nav's line follows the section in the middle of the window.
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    ["top", ...NAV.map((n) => n[0])].forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Header active={active} />
      <main>
        {/* The night holds still for one screen of scrolling while the day rises over it. */}
        <div className="night-pin">
          <Hero />
        </div>
        {/* Under the horizon it is day: everything from the app window down is light. */}
        <div className="daylight ground curtain">
          <Showcase />
          <Platform />
          {/* Solutions holds what were About and the country-specific data (owner, 2026-11-01). */}
          <Benefits />
          <Trust />
          {FLAGS.changelog && <Changelog />}
          <Contact draft={null} />
        </div>
      </main>
      <footer className="daylight ground">
        <div className="wrap">
          <div className="foot-brand">
            <a href="#top" className="brand" aria-label={t("appolino, back to top", "appolino, zpět nahoru")}>
              <img className="mark" src={sun} alt="" />
              <Wordmark />
            </a>
          </div>
          <div>
            <h4>{t("Product", "Produkt")}</h4>
            <ul>
              {FOOTER.map(([id, en, cs]) => (
                <li key={id}>
                  <a href={`#${id}`}>{t(en, cs)}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{t("Company", "Společnost")}</h4>
            <ul>
              <li>
                <a href="#contact">{t("Book a demo", "Domluvit ukázku")}</a>
              </li>
              <li>
                <a href="#contact">{t("Contact", "Kontakt")}</a>
              </li>
            </ul>
          </div>
          <div className="foot-bottom">
            <span>© 2026 appolino</span>
            <span>{t("All figures on this page are examples, not customer data.", "Všechna čísla na této stránce jsou příklady, ne data zákazníků.")}</span>
            {/* CC BY 4.0 asks for the artist, where the work came from, the licence and a note that it was changed, wherever it is shown: the drawings are recoloured, filled and cut (scripts/sky-art.mjs). */}
            <span>
              {t("Constellation drawings adapted from James Hedberg's", "Kresby souhvězdí upravené z díla Jamese Hedberga")}{" "}
              <a href="https://docs.openspaceproject.com/latest/content/milky-way/constellations/constellation-art/index.html" target="_blank" rel="noreferrer">
                {t("constellation art for OpenSpace", "Constellation art pro OpenSpace")}
              </a>
              ,{" "}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>
              .
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
