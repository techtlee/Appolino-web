import mark from "../assets/appolino-mark.svg";

/** What Appolino reads from and delivers to today. Databases are destinations
 *  and storage, not import sources. */
const IN = ["Excel", "CSV", "ISDOC", "Bank statements", "SharePoint", "OneDrive", "Cloud Storage"];
const OUT = ["PostgreSQL", "Power BI", "BigQuery", "SharePoint", "Teams", "Slack"];

export function Connects() {
  return (
    <section className="connects" aria-label="Works with">
      <div className="wrap">
        <div className="flow2">
          <div className="side in">
            <p className="label">Data comes in from</p>
            <div className="logos">
              {IN.map((n) => (
                <span key={n}>
                  <i aria-hidden />
                  {n}
                </span>
              ))}
            </div>
          </div>
          <div className="hub-row" aria-hidden>
            <span className="stream" />
            <span className="hub">
              <img src={mark} alt="" />
            </span>
            <span className="stream" />
          </div>
          <div className="side out">
            <p className="label">and goes out to</p>
            <div className="logos">
              {OUT.map((n) => (
                <span key={n}>
                  <i aria-hidden />
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
