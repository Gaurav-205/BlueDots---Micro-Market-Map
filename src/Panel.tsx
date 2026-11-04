import type { ReactNode } from "react";
import { ageSuffix, callLabel, fmt1, fmtInt, showPileWarning } from "./lib/logic";
import type { Call, DistrictResult, MarketResult, RoleRow, View } from "./lib/logic";
import { flowsFor } from "./lib/flows";
import type { FlowRow, MarketFlows } from "./lib/flows";

export const callColour = (c: Call) =>
  c === "Demand hotspot" ? "#1A9850" : c === "Supply pocket" ? "#D73027" : "#8595A4";

interface Props {
  market: MarketResult | null;
  result: DistrictResult;
  view: View;
  roles: RoleRow[] | null;
  flows: FlowRow[] | null;
  skills: ReactNode; // role-family table for this market, built by App
}

export default function Panel({ market: m, result, view, roles, flows, skills }: Props) {
  if (!m) {
    return <p className="muted" style={{ margin: 0 }}>Pick a zone on the map or a row in the list to see that market's numbers.</p>;
  }
  const myRoles = (roles ?? []).filter((r) => r.market_id === m.market_id).sort((a, b) => a.role_rank - b.role_rank);
  return (
    <div>
      <div className="phead">
        <h2 className="pname">{m.market}</h2>
        <span className="badge" style={{ color: callColour(m.call) }}><span className="cdot" style={{ background: callColour(m.call) }} />{callLabel(m.call)}</span>
      </div>
      {m.localities && <div className="small muted">{m.localities}</div>}
      <div className="pair">
        <div><span>Seekers</span><b>{fmtInt(m.seekers)}</b></div>
        <div><span>{view.measure === "openings" ? "Openings" : "Postings"}{ageSuffix(view.age)}</span><b>{fmtInt(m.demand)}</b></div>
      </div>
      <Compare m={m} district={result.rate} />
      {showPileWarning(m) && (
        <p className="caveat">
          ⚠ {fmt1(m.pile!)}% of these seekers sit on one 1 km spot, likely a signup camp or college. Read the seeker count with care.
        </p>
      )}
      {skills && (
        <div className="roles">
          <h3>Kinds of work here</h3>
          {skills}
        </div>
      )}
      {roles && (
        <div className="roles">
          <h3>Top roles</h3>
          {myRoles.length ? (
            <div className="rolechips">{myRoles.map((r) => <span key={r.role_rank}>{r.job_role} <b>{fmtInt(r.postings)}</b></span>)}</div>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>None of the postings here name a role.</p>
          )}
        </div>
      )}
      {flows && <Applications flows={flows} m={m} result={result} />}
    </div>
  );
}

function Applications({ flows, m, result }: { flows: FlowRow[]; m: MarketResult; result: DistrictResult }) {
  const name = new Map(result.markets.map((x) => [x.market_id, x.isRest ? "Rest of district" : x.market]));
  const f = flowsFor(flows, m.market_id);
  return (
    <div className="apps">
      <h3>Where seekers here applied</h3>
      <Side f={f.out} name={name} none="No applications yet."
        lead={<><b>{fmtInt(f.out.total)}</b> applications · <b>{fmtInt(f.out.local)}</b> in this market{f.out.accepted ? <> · <b>{fmtInt(f.out.accepted)}</b> accepted</> : null}</>} />
      <h3>Who applied to jobs here</h3>
      <Side f={f.in} name={name} none="No applications yet."
        lead={<><b>{fmtInt(f.in.total)}</b> applications · <b>{fmtInt(f.in.local)}</b> from this market{f.in.accepted ? <> · <b>{fmtInt(f.in.accepted)}</b> accepted</> : null}</>} />
    </div>
  );
}

function Side({ f, name, lead, none }: { f: MarketFlows; name: Map<string, string>; lead: ReactNode; none: string }) {
  if (!f.total) return <p className="muted small" style={{ margin: 0 }}>{none}</p>;
  const top = f.placed.slice(0, 4);
  const max = Math.max(1, ...top.map((l) => l.n));
  return (
    <>
      <p className="small" style={{ margin: "0 0 6px" }}>{lead}</p>
      {top.length > 0 && (
        <ul className="flowlist">
          {top.map((l) => (
            <li key={l.id}>
              <span>{name.get(l.id) ?? l.id}</span><b>{fmtInt(l.n)}</b>
              <i style={{ width: `${(100 * l.n) / max}%` }} />
            </li>
          ))}
        </ul>
      )}
      {f.unplaced > 0 && <p className="small muted" style={{ margin: "4px 0 0" }}>+ {fmtInt(f.unplaced)} with no usable location</p>}
    </>
  );
}

// This market's rate next to the district average, as two bars on one scale.
function Compare({ m, district }: { m: MarketResult; district: number }) {
  const max = Math.max(m.rate, district, 0.1);
  const row = (label: string, v: number, colour: string) => (
    <div className="cmp-row">
      <span>{label}</span>
      <span className="cmp-track"><i style={{ width: `${(100 * v) / max}%`, background: colour }} /></span>
      <b>{fmt1(v)}</b>
    </div>
  );
  return (
    <div className="cmp">
      <div className="cmp-head">Jobs per 100 seekers</div>
      {row("This market", m.rate, callColour(m.call))}
      {row("District average", district, "#8595A4")}
      <div className="cmp-foot">{fmt1(m.index)}× the district average</div>
    </div>
  );
}
