import { useEffect, useMemo, useState } from "react";
import { ageLabel, ageSuffix, callLabel, computeDistrict, fmt1, fmtInt, showPileWarning } from "./lib/logic";
import { flowCoverage } from "./lib/flows";
import { familyMarkets, familyTotals, NO_ROLE } from "./lib/families";
import type { DistrictResult, MarketResult, View } from "./lib/logic";
import { useData } from "./lib/useData";
import type { Data, Status } from "./lib/useData";
import { useView } from "./lib/useView";
import MapView from "./MapView";
import Panel, { callColour } from "./Panel";
import Skills from "./Skills";

const METHOD =
  "How the markets are drawn: each seeker or posting goes to its nearest market centre if it is within 6 km (Ghaziabad) or 10 km (Hubli-Dharwad); anything further counts as rest of district. Seeker pins may show where someone was signed up (a college or camp) rather than where they live, and job pins may show the office that entered the posting. Openings are capped at 50 a posting because a few postings list hundreds. District outlines are 2011 census boundaries, simplified. Market centres are my placement of well-known localities and should be checked on a map before this goes outside the team. All counts are aggregated; no personal details are shown.";

type Tab = "market" | "ranking" | "skills" | "gaps";

const Failed = () => <div className="state"><span className="dot" />Failed to load</div>;
const Skel = ({ rows = 3 }: { rows?: number }) => (
  <div style={{ display: "grid", gap: 10 }}>{Array.from({ length: rows }, (_, i) => <span key={i} className="skel" />)}</div>
);
const worst = (...s: Status[]): Status => (s.includes("error") ? "error" : s.includes("loading") ? "loading" : "ok");

export default function App() {
  const data = useData();
  const [uv, setView] = useView();
  const view: View = { district: uv.district, measure: uv.measure, age: uv.age };
  const [tab, setTab] = useState<Tab>(uv.market ? "market" : "ranking");

  const base = useMemo(
    () => (data.markets ? computeDistrict(data.markets, data.cells, view) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.markets, data.cells, uv.district, uv.measure, uv.age],
  );
  // Role filter: same maths on that family's counts. Unknown roles (stale links) fall back to all roles.
  const role = data.families?.some((f) => f.district === uv.district && f.family === uv.role) ? uv.role : "";
  const result = useMemo(
    () => (role && data.markets && data.families ? computeDistrict(familyMarkets(data.markets, data.families, role), null, view) : base),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, role, data.markets, data.families, uv.district, uv.measure, uv.age],
  );
  const roleOptions = useMemo(() => {
    if (!data.families) return [];
    const t = familyTotals(data.families, view).sort((a, b) => b.seekers + b.demand - (a.seekers + a.demand));
    return [...t.filter((x) => !NO_ROLE.has(x.family)), ...t.filter((x) => NO_ROLE.has(x.family))].map((x) => x.family);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.families, uv.district, uv.measure, uv.age]);
  const selected = result?.markets.find((m) => m.market_id === uv.market) ?? null;

  // A market id from another district or a stale link would dim every zone with nothing selected; drop it.
  useEffect(() => {
    if (result && uv.market && !selected) setView({ market: "" });
  }, [result, uv.market, selected, setView]);

  // Selecting a market opens its tab; clearing it goes back to the ranking.
  useEffect(() => {
    setTab((t) => (uv.market ? "market" : t === "market" ? "ranking" : t));
  }, [uv.market]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setView({ market: "" });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView]);

  const s = data.status;
  const mapStatus = worst(s.markets, s.centres, s.outlines);
  const cellsOk = s.cells === "ok";
  const hasMarkets = !!result?.markets.some((m) => !m.isRest);
  // No postings in the chosen period: every market would score 0 and read as a supply pocket, so say so instead.
  const noDemand = !!result && result.demand === 0 && (uv.age !== "all" || !!role);
  const empty = <NoDemand district={uv.district} view={view} role={role} onAll={() => setView(role ? { role: "" } : { age: "all" })} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            <h1>Matchmap</h1>
            <div className="sub">Where job seekers and jobs meet · Blue Dots</div>
          </div>
        </div>
        <nav className="controls" aria-label="View">
          <Seg label="District" value={uv.district} onChange={(v) => setView({ district: v })}
            options={[["Ghaziabad", "Ghaziabad"], ["Hubli-Dharwad", "Hubli-Dharwad"]]} />
          <span className="divider" aria-hidden />
          <Seg label="Count" value={uv.measure} onChange={(v) => setView({ measure: v })}
            options={[["postings", "Postings"], ["openings", "Openings"]]} />
          <Seg label="Period" value={uv.age} onChange={(v) => setView({ age: v })}
            options={[["all", ageLabel("all")], ["30d", ageLabel("30d")]]} />
          {roleOptions.length > 0 && (
            <label className="ctl">
              <span className="ctl-label">Role</span>
              <select className="select" value={role} onChange={(e) => setView({ role: e.target.value })}>
                <option value="">All roles</option>
                {roleOptions.map((f) => <option key={f} value={f}>{NO_ROLE.has(f) ? `(${f})` : f}</option>)}
              </select>
            </label>
          )}
        </nav>
      </header>

      {/* Overview first, then the map to explore, then details in the side panel. */}
      <section className="overview" aria-label={`${uv.district} overview`}>
        {s.markets === "error" ? <Failed /> : !result ? <Skel rows={2} /> : (
          <Overview result={result} view={view} role={role} onSelect={(id) => setView({ market: id })} hideInsights={noDemand} />
        )}
      </section>

      <main className="body">
        <section className="mapwrap" aria-label="Micro-market map">
          {noDemand ? <div className="state">{empty}</div> : mapStatus === "ok" && result && hasMarkets ? (
            <MapView data={data} result={result} view={view} selected={uv.market} pins={uv.pins && cellsOk && !role}
              onSelect={(id) => setView({ market: id })} />
          ) : mapStatus === "loading" ? <div className="state"><span className="skel" style={{ width: 160 }} /></div>
            : mapStatus === "error" ? <Failed /> : <div className="state">No markets for this district</div>}
          {!noDemand && <div className="legend">
            <div className="legend-title">Jobs per 100 seekers</div>
            {role && (
              <div className="legend-row rolechip">
                <span>Only <b>{role}</b></span>
                <button type="button" className="link" onClick={() => setView({ role: "" })}>All roles</button>
              </div>
            )}
            <div className="legend-row"><i className="grad" /></div>
            <div className="legend-row legend-ends"><span>More seekers</span><span>More jobs</span></div>
            {cellsOk && !role && (
              <label className="legend-row check">
                <input type="checkbox" checked={uv.pins} onChange={(e) => setView({ pins: e.target.checked })} />
                <span>Show seeker and job dots</span>
              </label>
            )}
          </div>}
        </section>

        <aside className="sidebar">
          {s.markets === "error" ? <Failed /> : !result ? <div className="pad"><Skel rows={5} /></div> : (
            <>
              <div className="tabs" role="tablist"><div className="seg">
                {([["ranking", "Ranking"], ...(data.families ? [["skills", "Skills"]] : []), ["market", selected ? selected.market : "Market"], ["gaps", "Data quality"]] as [Tab, string][]).map(([t, label]) => (
                  <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
                ))}
              </div></div>
              <div className="pad tabbody">
                {tab === "skills" && data.families && base && (
                  <Skills families={data.families} view={view} baseRate={base.rate} active={role} onPick={(f) => setView({ role: f })} />
                )}
                {noDemand && tab !== "gaps" && tab !== "skills" ? empty : tab === "market" && (
                  <>
                    {selected && <button type="button" className="link" onClick={() => setView({ market: "" })}>← All markets</button>}
                    <Panel market={selected} result={result} view={view} roles={data.roles} flows={data.flows}
                      skills={data.families && base && selected && !selected.isRest
                        ? <Skills families={data.families} view={view} baseRate={base.rate} active={role} onPick={(f) => setView({ role: f })} marketId={selected.market_id} limit={6} />
                        : null} />
                  </>
                )}
                {!noDemand && tab === "ranking" && (
                  <Table result={result} view={view} selected={uv.market} onSelect={(id) => setView({ market: id === uv.market ? "" : id })} />
                )}
                {tab === "gaps" && (
                  <div className="gaps">
                    <Gaps data={data} result={result} district={uv.district} />
                    <p className="small muted" style={{ marginTop: 16 }}>{METHOD}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="ctl" role="group" aria-label={label}>
      <span className="ctl-label">{label}</span>
      <div className="seg">
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

// Brand mark: a map pin holding a seeker dot (orange) and a job dot (blue); the white overlap is the match.
const Logo = () => (
  <svg className="logo" viewBox="0 0 32 32" aria-hidden>
    <path d="M16 2C9.6 2 4.5 7 4.5 13.3 4.5 21.6 16 30 16 30s11.5-8.4 11.5-16.7C27.5 7 22.4 2 16 2z" fill="#0A1317" />
    <circle cx="12.6" cy="13.2" r="4.4" fill="#E8710A" />
    <circle cx="19.4" cy="13.2" r="4.4" fill="#0064E0" />
    <path d="M16 10.41A4.4 4.4 0 0 1 16 15.99 4.4 4.4 0 0 1 16 10.41z" fill="#fff" />
  </svg>
);

// Key numbers for the district, then the two markets to act on first.
function NoDemand({ district, view, role, onAll }: { district: string; view: View; role: string; onAll: () => void }) {
  const what = view.measure === "openings" ? "openings" : "job postings";
  const when = view.age === "all" ? "" : ` in the ${ageLabel(view.age).toLowerCase()}`;
  return (
    <div className="empty">
      <b>{role ? `No ${what} for ${role} in ${district}${when}.` : `No new ${what} in ${district}${when}.`}</b>
      <span>Every market would show 0, so there is nothing to compare.</span>
      <button type="button" className="btn" onClick={onAll}>{role ? "Show all roles" : "Show all live postings"}</button>
    </div>
  );
}

function Overview({ result, view, role, onSelect, hideInsights }: { result: DistrictResult; view: View; role: string; onSelect: (id: string) => void; hideInsights: boolean }) {
  const unit = view.measure === "openings" ? "openings" : "postings";
  const period = ageLabel(view.age);
  const count = result.markets.filter((m) => !m.isRest).length;
  const { top, pocket } = result;
  const card = (m: MarketResult, kind: "hot" | "pocket", label: string, value: string) => (
    <button type="button" className={`insight ${kind}`} onClick={() => onSelect(m.market_id)}>
      <span className="insight-label">{label}</span>
      <span className="insight-name">{m.market}</span>
      <span className="insight-value">{value}</span>
      {/* A pile on one spot may be a signup camp, not real supply. */}
      {showPileWarning(m) && <span className="insight-warn">⚠ {fmt1(m.pile!)}% of seekers on one spot, check first</span>}
    </button>
  );
  return (
    <div className="ov">
      <div className="kpis">
        <div className="kpi hero">
          <span className="kpi-label">{role ? `${role}, district` : "District average"}</span>
          <b>{fmt1(result.rate)}</b>
          <span className="kpi-note">{unit} per 100 seekers</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Seekers</span>
          <b>{fmtInt(result.seekers)}</b>
          <span className="kpi-note">{role ? "in this kind of work" : `across ${count} micro-markets`}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">{unit === "openings" ? "Openings" : "Job postings"}</span>
          <b>{fmtInt(result.demand)}</b>
          <span className="kpi-note">{period}</span>
        </div>
      </div>
      {!hideInsights && <div className="insights">
        {!top && !pocket && <p className="muted" style={{ margin: 0 }}>No markets for this district.</p>}
        {top && card(top, "hot", "Most jobs per seeker", `${fmt1(top.rate)} ${unit} per 100 seekers`)}
        {pocket && card(pocket, "pocket", "Most seekers, few jobs", `${fmtInt(pocket.seekers)} seekers · ${fmtInt(pocket.demand)} ${unit}`)}
      </div>}
    </div>
  );
}

function Table({ result, view, selected, onSelect }: { result: DistrictResult; view: View; selected: string; onSelect: (id: string) => void }) {
  const demandHead = (view.measure === "openings" ? "Openings" : "Postings") + ageSuffix(view.age);
  const maxRate = Math.max(0, ...result.markets.filter((m) => !m.isRest).map((m) => m.rate));
  const name = (m: MarketResult) => (m.isRest ? "Rest of district" : m.market);

  const download = () => {
    const head = ["Market", "Seekers", demandHead, "Per 100 seekers", "Times district rate", "Call"];
    const rows = result.markets.map((m) => [name(m), m.seekers, m.demand, fmt1(m.rate), fmt1(m.index), callLabel(m.call)]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `matchmap_${view.district}_${view.measure}_${view.age}.csv`;
    a.click();
    // Revoking in the same tick can cancel the download in Safari and Firefox.
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (!result.markets.some((m) => !m.isRest)) return <div className="state">No markets for this district</div>;
  return (
    <>
      <div className="tablehead">
        <span className="key">
          <span><i className="cdot" style={{ background: callColour("Demand hotspot") }} />More jobs</span>
          <span><i className="cdot" style={{ background: callColour("Supply pocket") }} />More seekers</span>
          <span><i className="cdot" style={{ background: callColour("Near district rate") }} />Average or thin</span>
        </span>
        <button className="btn" type="button" onClick={download}>Download CSV</button>
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Market</th><th>Seekers</th><th>{demandHead}</th><th>Per 100 seekers</th></tr>
          </thead>
          <tbody>
            {result.markets.map((m) => (
              <tr key={m.market_id} tabIndex={0} aria-selected={m.market_id === selected} className={m.isRest ? "rest" : ""}
                onClick={() => onSelect(m.market_id)} onKeyDown={(e) => e.key === "Enter" && onSelect(m.market_id)}>
                <td>
                  <div className="tname" title={callLabel(m.call)}>
                    <span className="rank" style={{ background: callColour(m.call) }}>{m.isRest ? "" : result.markets.indexOf(m) + 1}</span>{name(m)}
                  </div>
                  {showPileWarning(m) && <div className="tpile" title="Share of seekers on the busiest 1 km spot">⚠ {fmt1(m.pile!)}% on one spot</div>}
                </td>
                <td>{fmtInt(m.seekers)}</td>
                <td>{fmtInt(m.demand)}</td>
                <td>
                  <div>{fmt1(m.rate)}</div>
                  <span className="bar">{!m.isRest && maxRate > 0 && <i style={{ width: `${(100 * m.rate) / maxRate}%` }} />}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Gaps({ data, result, district }: { data: Data; result: DistrictResult; district: string }) {
  if (data.status.coverage === "error") return <Failed />;
  if (!data.coverage) return <Skel />;
  const seek = data.coverage.find((c) => c.district === district && c.kind === "Seekers");
  const jobs = data.coverage.find((c) => c.district === district && c.kind === "Job postings");
  if (!seek || !jobs) return <Failed />;
  return (
    <>
      <Meter label="Seekers placed on map" pct={seek.usable_pct} />
      <p>Seekers: <b>{fmtInt(seek.usable)}</b> of <b>{fmtInt(seek.total_live)}</b> live profiles (<b>{fmt1(seek.usable_pct)}%</b>) have a real location inside the district. <b>{fmtInt(seek.default_point)}</b> sit on the default pin and <b>{fmtInt(seek.outside_district)}</b> are pinned outside the district.</p>
      <Meter label="Postings placed on map" pct={jobs.usable_pct} />
      <p>Jobs: <b>{fmtInt(jobs.usable)}</b> of <b>{fmtInt(jobs.total_live)}</b> live postings (<b>{fmt1(jobs.usable_pct)}%</b>) can be placed on the map. <b>{fmtInt(jobs.no_location)}</b> have no location at all, so real demand is higher than shown.</p>
      <Meter label="Mapped postings from last 180 days" pct={result.recentShare} />
      <p>Freshness: only <b>{fmt1(result.recentShare)}%</b> of the postings on this map were posted in the last 180 days. Switch to "Last 30 days" to see only fresh postings.</p>
      {data.flows && (() => {
        const f = flowCoverage(data.flows, district);
        return (
          <>
            <Meter label="Applications with both sides on the map" pct={f.pct} />
            <p>Applications: <b>{fmtInt(f.both)}</b> of <b>{fmtInt(f.total)}</b> applications (<b>{fmt1(f.pct)}%</b>) have both the seeker and the job placed in a market here. The rest have a seeker or job outside the district or without a location, so the "where seekers applied" lists are a sample.</p>
          </>
        );
      })()}
    </>
  );
}

const Meter = ({ label, pct }: { label: string; pct: number }) => (
  <div className="meter">
    <div className="meter-head"><span>{label}</span><b>{fmt1(pct)}%</b></div>
    <span className="meter-bar"><i style={{ width: `${pct}%` }} /></span>
  </div>
);
