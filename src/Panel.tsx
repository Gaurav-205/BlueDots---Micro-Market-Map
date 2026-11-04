import type { ReactNode } from "react";
import { callLabel, fmt1, fmtInt, showPileWarning, zoneT } from "./lib/logic";
import type { Call, DistrictResult, MarketResult, RoleRow, View } from "./lib/logic";
import { flowsFor } from "./lib/flows";
import type { FlowRow, MarketFlows } from "./lib/flows";

export const callColour = (c: Call) =>
  c === "Demand hotspot" ? "#2B8FA6" : c === "Supply pocket" ? "#D06A22" : "#6B7280";

const REC: Record<Call, string> = {
  "Demand hotspot": "treat this as a place to send people. Point KKB campaigns from nearby supply pockets at these employers first, and check the postings are still open before we push them.",
  "Supply pocket": "bring employers here. Ask DKB and the local associations for jobs in or near this market, or line these seekers up for the nearest hotspot if travel works for them.",
  "Near district rate": "keep both sides growing together here. It is not the first place to act.",
  "Thin data": "too few seekers here to judge the rate. Treat it as thin and don't act on this number alone.",
  "Not a market": "these records sit too far from any market centre to group. If many of them cluster somewhere, that place may deserve its own market.",
};

interface Props {
  market: MarketResult | null;
  result: DistrictResult;
  view: View;
  roles: RoleRow[] | null;
  flows: FlowRow[] | null;
}

export default function Panel({ market: m, result, view, roles, flows }: Props) {
  if (!m) {
    return <p className="muted" style={{ margin: 0 }}>Pick a zone on the map or a row in the list to see that market's numbers and what I'd propose for it.</p>;
  }
  const myRoles = (roles ?? []).filter((r) => r.market_id === m.market_id).sort((a, b) => a.role_rank - b.role_rank);
  return (
    <div>
      <div className="phead">
        <h2 className="pname serif">{m.market}</h2>
        <span className="badge" style={{ color: callColour(m.call) }}><span className="cdot" style={{ background: callColour(m.call) }} />{callLabel(m.call)}</span>
      </div>
      {m.localities && <div className="small muted">{m.localities}</div>}
      <div className="pair">
        <div><span>Seekers</span><b>{fmtInt(m.seekers)}</b></div>
        <div><span>{view.measure === "openings" ? "Openings" : "Job postings"}{view.age === "recent" ? ", 180 d" : ""}</span><b>{fmtInt(m.demand)}</b></div>
      </div>
      <Gauge m={m} district={result.rate} />
      <div className="rec"><b>What I'd do:</b> {REC[m.call]}</div>
      {showPileWarning(m) && (
        <p className="caveat">
          {fmt1(m.pile!)}% of these seekers sit on a single spot of about 1 km. A pile that big is usually a college, camp or town centre where people were signed up, not where they live, so read this market's seeker count with care.
        </p>
      )}
      <dl className="nums">
        <dt>Live job postings</dt><dd>{fmtInt(m.postings)}</dd>
        <dt>Posted in last 180 days</dt><dd>{fmtInt(m.postings_recent)}</dd>
        <dt>Openings (capped at 50 a posting)</dt><dd>{fmtInt(m.openings)}</dd>
      </dl>
      {roles && (
        <div className="roles">
          <h3>Roles asked for most here</h3>
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
      <Side f={f.out} name={name} none="No applications from seekers placed here yet."
        lead={<>Seekers here applied <b>{fmtInt(f.out.total)}</b> times. <b>{fmtInt(f.out.local)}</b> went to jobs in this market{f.out.accepted ? <>, <b>{fmtInt(f.out.accepted)}</b> were accepted</> : null}.</>} />
      <h3>Who applied to jobs here</h3>
      <Side f={f.in} name={name} none="No applications to jobs placed here yet."
        lead={<>Jobs here got <b>{fmtInt(f.in.total)}</b> applications. <b>{fmtInt(f.in.local)}</b> came from seekers in this market{f.in.accepted ? <>, <b>{fmtInt(f.in.accepted)}</b> were accepted</> : null}.</>} />
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
      {f.unplaced > 0 && <p className="small muted" style={{ margin: "4px 0 0" }}>{fmtInt(f.unplaced)} more where the other side has no usable location.</p>}
    </>
  );
}

// Where this market's rate sits against the district, on the same log scale as the zone colours.
function Gauge({ m, district }: { m: MarketResult; district: number }) {
  return (
    <div className="gauge">
      <div className="gauge-head"><span>Demand per 100 seekers</span><b>{fmt1(m.rate)}</b></div>
      <div className="gauge-bar">
        <i className="gauge-mid" title={`District ${fmt1(district)}`} />
        <i className="gauge-pt" style={{ left: `${100 * zoneT(m.index)}%` }} />
      </div>
      <div className="gauge-foot"><span>More seekers</span><span>District {fmt1(district)} · {fmt1(m.index)}×</span><span>More jobs</span></div>
    </div>
  );
}
