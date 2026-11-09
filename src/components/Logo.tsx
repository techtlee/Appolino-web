import logo from "../assets/appolino-logo.svg";
import logoWhite from "../assets/appolino-logo-white.svg";

/** The appolino logo, the owner's file as it is (2026-11-08: Group 628467.svg, the horizontal
 *  lockup; "použij to svgečko"): navy for daylight, and the same file with only its colour made
 *  white for the night (assets/appolino-logo-white.svg). Both are in the page; the stylesheet
 *  shows the one the bar or footer stands on (index.css, .brand). */
export function Logo() {
  return (
    <span className="logo">
      <img className="logo-night" src={logoWhite} alt="" />
      <img className="logo-day" src={logo} alt="" />
    </span>
  );
}
