import { useEffect, useState } from "react";
import { Header, NAV } from "./components/Header";
import { Hero } from "./components/Hero";
import { Showcase } from "./components/Showcase";
import { Connects } from "./components/Connects";
import { Statement } from "./components/Statement";
import { Platform } from "./components/Platform";
import { Benefits } from "./components/Benefits";
import { Trust } from "./components/Trust";
import { Changelog } from "./components/Changelog";
import { Contact } from "./components/Contact";
import mark from "./assets/appolino-mark.svg";

export default function App() {
  const [active, setActive] = useState("");

  // The nav's line follows the section in the middle of the window.
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    ["top", ...NAV.map((n) => n[0]), "contact"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <>
      <Header active={active} />
      <main>
        <Hero />
        <Showcase />
        <Connects />
        <Statement />
        <Platform />
        <Benefits />
        <Trust />
        <Changelog />
        <Contact draft={null} />
      </main>
      <footer>
        <div className="wrap">
          <div className="foot-brand">
            <a href="#top" className="brand" aria-label="Appolino, back to top">
              <img className="mark" src={mark} alt="" />
              <span className="prod">Appolino</span>
            </a>
            <p>Company spreadsheets you can trust: imported once, checked every time, delivered on a schedule.</p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              {NAV.map(([id, t]) => (
                <li key={id}>
                  <a href={`#${id}`}>{t}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Get in touch</h4>
            <ul>
              <li>
                <a href="#contact">Book a demo</a>
              </li>
              <li>
                <a href="#contact">Contact</a>
              </li>
            </ul>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Appolino</span>
            <span>All figures on this page are examples, not customer data.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
