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
            <p>One table, one definition, one result. Sales and finance read the same figure, from the same place.</p>
            <div className="vis">
              <div className="report">
                <span className="t">Sales · Revenue, October</span>
                <span className="v">12,840.00</span>
                <span className="ok">✓ from result “revenue_by_customer”</span>
              </div>
              <div className="report">
                <span className="t">Finance · Revenue, October</span>
                <span className="v">12,840.00</span>
                <span className="ok">✓ from result “revenue_by_customer”</span>
              </div>
            </div>
          </div>
          <div className="ben">
            <h3>Runs while you sleep</h3>
            <p>Pipelines run on their own schedule, so the data is where people need it when they arrive.</p>
            <div className="vis">
              <div className="sched">
                <div><span className="t">06:00</span>Nightly ERP sync<span className="ok">✓</span></div>
                <div><span className="t">07:00</span>Sales report<span className="ok">✓</span></div>
                <div><span className="t">07:30</span>Stock levels to SharePoint<span className="ok">✓</span></div>
                <div><span className="t">08:00</span>Invoice write-back<span className="run">● running</span></div>
                <div><span className="t">18:00</span>End-of-day export<span className="t">due</span></div>
              </div>
            </div>
          </div>
          <div className="ben">
            <h3>Problems before the board sees them</h3>
            <p>A failed check holds the run and names what to fix. Nobody corrects a report after it has been read.</p>
            <div className="vis">
              <div className="held">
                <span className="pill-held">Blocked · Invoice write-back</span>
                <div className="log">
                  <b>08:00:14</b> check “dates are ISO” failed: 3 rows
                  <br />
                  <b>08:00:14</b> run held before write-back
                  <br />
                  <b>08:00:15</b> owner notified · Retry now available
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
