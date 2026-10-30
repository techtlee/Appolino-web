import { useEffect, useRef, useState } from "react";
import embed from "vega-embed";
import type { TopLevelSpec } from "vega-lite";

/** Jobs' "Last 14 days", in figures: example runs, not anyone's account. */
const OUTCOMES = ["Succeeded", "Blocked", "Failed"] as const;
const COLORS = ["#E9A23B", "#6E7FA3", "#C96A6A"];
const SUCCEEDED = [12, 14, 13, 4, 3, 15, 14, 13, 14, 15, 4, 3, 14, 13];
const BLOCKED = [0, 1, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 1, 0];
const FAILED = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];

const DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(2026, 9, 17 + i);
  return { iso: `2026-10-${String(17 + i).padStart(2, "0")}`, label: `${d.getDate()} Oct` };
});

const VALUES = DAYS.flatMap((d, i) =>
  [SUCCEEDED[i], BLOCKED[i], FAILED[i]].map((n, k) => ({ day: d.label, iso: d.iso, outcome: OUTCOMES[k], order: k, runs: n })),
);

const FONT = "Google Sans Flex, Inter, system-ui, sans-serif";
const AXIS = { labelColor: "#717C94", labelFontSize: 12, domain: false, ticks: false, titleColor: "#717C94", titleFontWeight: 400 as const };

const spec: TopLevelSpec = {
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  width: "container",
  height: 240,
  background: null as unknown as string,
  autosize: { type: "fit-x", contains: "padding" },
  data: { values: VALUES },
  params: [{ name: "pick", select: { type: "point", fields: ["outcome"] }, bind: "legend" }],
  mark: { type: "bar", cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3, width: { band: 0.66 } },
  encoding: {
    x: { field: "day", type: "ordinal", sort: { field: "iso" }, title: null, axis: { ...AXIS, labelAngle: 0, labelOverlap: true } },
    y: { field: "runs", type: "quantitative", stack: true, title: "Runs per day", axis: { ...AXIS, tickCount: 4, gridColor: "rgba(226,232,228,0.07)" } },
    color: {
      field: "outcome",
      type: "nominal",
      scale: { domain: [...OUTCOMES], range: COLORS },
      legend: { orient: "top", direction: "horizontal", title: null, labelColor: "#BCC5D8", labelFontSize: 13, symbolType: "circle", offset: 12 },
    },
    order: { field: "order" },
    opacity: { condition: { param: "pick", value: 1 }, value: 0.18 },
    tooltip: [
      { field: "day", title: "Day" },
      { field: "outcome", title: "Outcome" },
      { field: "runs", title: "Runs" },
    ],
  },
  config: { font: FONT, view: { stroke: null }, axis: { labelFont: FONT }, legend: { labelFont: FONT } },
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function JobsPanel() {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let finalize: (() => void) | undefined;
    embed(box.current!, spec, { actions: false, renderer: "svg", tooltip: { theme: "dark" } })
      .then((r) => {
        finalize = r.finalize;
        if (!alive) r.finalize();
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      finalize?.();
    };
  }, []);

  const total = sum(SUCCEEDED) + sum(BLOCKED) + sum(FAILED);
  const figures = [
    { n: sum(SUCCEEDED), t: "runs succeeded", c: "var(--sun)" },
    { n: sum(BLOCKED), t: "stopped by the gate before they sent bad data", c: "#6E7FA3" },
    { n: sum(FAILED), t: "failed and wait for Retry now", c: "#C96A6A" },
  ];

  return (
    <>
      <p className="panel-hint">The last 14 days in figures. Click an outcome in the legend and the chart highlights it. Example data; only daily pipelines run at weekends.</p>
      <div className="runs">
          <div className="card chart-card">
            <div className="chart-top">
              <div>
                <p className="label">Last 14 days</p>
                <p className="big">{total} runs</p>
              </div>
            </div>
            {failed ? <p className="empty">The chart did not load.</p> : <div className="chart" ref={box} />}
          </div>
          <div className="run-figs">
            {figures.map((f) => (
              <div key={f.t} className="run-fig">
                <span className="dot" style={{ background: f.c }} />
                <p className="n">{f.n}</p>
                <p>{f.t}</p>
              </div>
            ))}
          </div>
        </div>
    </>
  );
}
