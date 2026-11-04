import { callFor, callLabel, fmt1, fmtInt, round1 } from "./lib/logic";
import type { View } from "./lib/logic";
import { familyTotals, NO_ROLE } from "./lib/families";
import type { FamilyRow } from "./lib/families";
import { callColour } from "./Panel";

interface Props {
  families: FamilyRow[];
  view: View;
  baseRate: number; // district rate across all roles, the yardstick for every family
  active: string;
  onPick: (family: string) => void;
  marketId?: string; // one market instead of the whole district
  limit?: number;
}

// Supply and demand per role family: seekers who trained for or want that kind of work, against postings or openings for it.
export default function Skills({ families, view, baseRate, active, onPick, marketId, limit }: Props) {
  const all = familyTotals(families, view, marketId);
  const seekers = all.reduce((s, t) => s + t.seekers, 0);
  const demand = all.reduce((s, t) => s + t.demand, 0);
  const roles = all.filter((t) => !NO_ROLE.has(t.family)).sort((a, b) => b.seekers + b.demand - (a.seekers + a.demand));
  const rest = all.filter((t) => NO_ROLE.has(t.family)).sort((a, b) => b.seekers + b.demand - (a.seekers + a.demand));
  const covS = seekers ? (100 * roles.reduce((s, t) => s + t.seekers, 0)) / seekers : 0;
  const covD = demand ? (100 * roles.reduce((s, t) => s + t.demand, 0)) / demand : 0;
  const unit = view.measure === "openings" ? "Openings" : "Postings";
  const shown = limit ? roles.slice(0, limit) : roles;
  if (!all.length) return <p className="muted small" style={{ margin: 0 }}>No role data here.</p>;

  const row = (t: (typeof all)[number], muted = false) => {
    const call = muted ? "Not a market" : callFor(t.seekers, baseRate ? round1(t.rate / baseRate) : 0, t.family);
    const on = t.family === active;
    return (
      <tr key={t.family} tabIndex={0} aria-selected={on} className={muted ? "rest" : ""} title={muted ? "Not a specific kind of work" : callLabel(call)}
        onClick={() => onPick(on ? "" : t.family)} onKeyDown={(e) => e.key === "Enter" && onPick(on ? "" : t.family)}>
        <td><div className="tname">{!muted && <span className="cdot" style={{ background: callColour(call) }} />}{t.family}</div></td>
        <td>{fmtInt(t.seekers)}</td>
        <td>{fmtInt(t.demand)}</td>
        <td>{t.seekers ? fmt1(t.rate) : "–"}</td>
      </tr>
    );
  };

  return (
    <div className="skills">
      <p className="small muted" style={{ margin: "0 0 8px" }}>
        {fmt1(covS)}% of seekers and {fmt1(covD)}% of {unit.toLowerCase()} here name a kind of work. Click a row to show it on the map.
      </p>
      <div className="scroll">
        <table>
          <thead><tr><th>Kind of work</th><th>Seekers</th><th>{unit}</th><th>Per 100 seekers</th></tr></thead>
          <tbody>
            {shown.map((t) => row(t))}
            {!limit && rest.length > 0 && (
              <>
                <tr className="group"><td colSpan={4}>No specific role</td></tr>
                {rest.map((t) => row(t, true))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
