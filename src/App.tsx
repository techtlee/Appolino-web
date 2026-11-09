import { useEffect, useState } from "react";
import { FOOTER, Header, NAV } from "./components/Header";
import { Logo } from "./components/Logo";
import { useT } from "./i18n";
import { Hero } from "./components/Hero";
import { Showcase } from "./components/Showcase";
import { Statement } from "./components/Statement";
import { Platform } from "./components/Platform";
import { Benefits } from "./components/Benefits";
import { Trust } from "./components/Trust";
import { Changelog } from "./components/Changelog";
import { Contact } from "./components/Contact";
import { FLAGS } from "./flags";


export default function App() {
  const [active, setActive] = useState("");
  const t = useT();

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
        {/* The page as Lasso tells it (owner, 2026-11-08: productlasso.com): the slogan and its
            buttons, the platform's demo right under them as the hero's picture, then the
            statement colouring in word by word, then what a team gets back. */}
        <div className="daylight ground">
          <Hero />
          <Showcase />
          <Statement />
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
              <Logo />
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
          </div>
        </div>
      </footer>
    </>
  );
}
