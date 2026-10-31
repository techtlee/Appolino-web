export function Benefits() {
  return (
    <section className="why" id="why">
      <div className="wrap">
        <h2>
          Hours back every week.
          <span>An end to copying between spreadsheets.</span>
        </h2>
        <div className="ben-grid">
          <div className="ben">
            <h3>Numbers people agree on</h3>
            <p>One table, one definition, one result. Sales and finance read the same figure, and either can click it to see the rows it came from.</p>
            <div className="vis">
              <div className="report">
                <span className="t">Sales · Revenue, October</span>
                <span className="v">28 504,50 Kč</span>
                <span className="ok">✓ from result “Tržby po měsících”</span>
              </div>
              <div className="report">
                <span className="t">Finance · Revenue, October</span>
                <span className="v">28 504,50 Kč</span>
                <span className="ok">✓ from result “Tržby po měsících”</span>
              </div>
            </div>
          </div>
          <div className="ben">
            <h3>Runs while you sleep</h3>
            <p>Pipelines run on their own schedule in your time zone, so the data is where people need it when they arrive.</p>
            <div className="vis">
              <div className="sched">
                <div>
                  <span className="t">00:00</span>Bank statements<span className="ok">✓</span>
                </div>
                <div>
                  <span className="t">06:00</span>Monthly invoices<span className="ok">✓</span>
                </div>
                <div>
                  <span className="t">07:30</span>Sales report<span className="ok">✓</span>
                </div>
                <div>
                  <span className="t">08:15</span>Ceník write-back<span className="run">● running</span>
                </div>
                <div>
                  <span className="t">18:00</span>Bank statements<span className="t">due</span>
                </div>
              </div>
            </div>
          </div>
          <div className="ben">
            <h3>Problems before the board sees them</h3>
            <p>A failed check holds the run and names what to fix. The destination keeps its last good load, so nobody corrects a report after it has been read.</p>
            <div className="vis">
              <div className="held">
                <span className="pill-held">Blocked · Monthly invoices</span>
                <div className="log">
                  <b>06:00:14</b> Not negative · Amount (CZK): 1 row
                  <br />
                  <b>06:00:14</b> held before delivery
                  <br />
                  <b>06:00:15</b> Teams: admins told once
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
