import { useLayoutEffect, useRef, useState } from "react";
import mark from "../assets/appolino-mark.svg";

export const NAV: [string, string][] = [
  ["try", "Try it"],
  ["platform", "Platform"],
  ["why", "Why Appolino"],
  ["czech", "Czech data"],
  ["security", "Security"],
  ["changelog", "Changelog"],
];

/** Brand, the nav beside it, actions on the right; a line of light under the section in view. */
export function Header({ active }: { active: string }) {
  const navRef = useRef<HTMLElement>(null);
  const [ind, setInd] = useState({ left: 0, width: 0, opacity: 0 });

  useLayoutEffect(() => {
    const place = () => {
      const a = navRef.current?.querySelector<HTMLAnchorElement>(`a[data-id="${active}"]`);
      setInd((p) => (a ? { left: a.offsetLeft, width: a.offsetWidth, opacity: 1 } : { ...p, opacity: 0 }));
    };
    place();
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [active]);

  return (
    <header className="top">
      <div className="wrap">
        <a href="#top" className="brand" aria-label="Appolino, back to top">
          <img className="mark" src={mark} alt="" />
          <span className="prod">Appolino</span>
        </a>
        <nav className="nav" ref={navRef} aria-label="Sections">
          {NAV.map(([id, t]) => (
            <a key={id} href={`#${id}`} data-id={id} className={active === id ? "on" : ""}>
              {t}
            </a>
          ))}
          <span className="nav-ind" style={ind} />
        </nav>
        <div className="top-actions">
          <a className="btn2" href="#try">
            Try it
          </a>
          <a className="btn" href="#contact">
            Book a demo
          </a>
        </div>
      </div>
    </header>
  );
}
