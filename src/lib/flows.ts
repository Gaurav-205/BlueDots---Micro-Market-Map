// Applications between markets, from flows.csv. One row per (from market, to market) pair.
// from_market / to_market is a market_id, or one of: outside, no_location, default, unknown
// (the seeker or the job could not be placed inside the district).

export interface FlowRow {
  district: string;
  from_market: string;
  to_market: string;
  applications: number;
  accepted: number;
  applications_recent: number;
}

export interface Link { id: string; n: number; accepted: number }

export interface MarketFlows {
  total: number;      // all applications on this side
  accepted: number;
  local: number;      // seeker and job in the same market
  placed: Link[];     // other side placed in a market (REST included), biggest first, excluding local
  unplaced: number;   // other side could not be placed
}

export const isPlaced = (id: string) => /^(GZB|HDW)-/.test(id);

function side(rows: FlowRow[], id: string, mine: "from_market" | "to_market"): MarketFlows {
  const other = mine === "from_market" ? "to_market" : "from_market";
  const out: MarketFlows = { total: 0, accepted: 0, local: 0, placed: [], unplaced: 0 };
  for (const r of rows) {
    if (r[mine] !== id) continue;
    out.total += r.applications;
    out.accepted += r.accepted;
    if (r[other] === id) out.local += r.applications;
    else if (isPlaced(r[other])) out.placed.push({ id: r[other], n: r.applications, accepted: r.accepted });
    else out.unplaced += r.applications;
  }
  out.placed.sort((a, b) => b.n - a.n);
  return out;
}

/** Where this market's seekers applied (out) and where applicants to this market's jobs came from (in). */
export const flowsFor = (rows: FlowRow[], id: string) => ({ out: side(rows, id, "from_market"), in: side(rows, id, "to_market") });

/** Applications in a district and how many have both the seeker and the job inside a market or REST. */
export function flowCoverage(rows: FlowRow[], district: string) {
  let total = 0, both = 0;
  for (const r of rows) {
    if (r.district !== district) continue;
    total += r.applications;
    if (isPlaced(r.from_market) && isPlaced(r.to_market)) both += r.applications;
  }
  return { total, both, pct: total ? Math.round((1000 * both) / total) / 10 : 0 };
}
