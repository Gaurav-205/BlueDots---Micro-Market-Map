// Blue Dots Micro-Market Map: core logic.
// Put this file at src/lib/logic.ts and use it as is. Every number the app shows comes from these functions.

export type District = "Ghaziabad" | "Hubli-Dharwad";
export type Measure = "postings" | "openings";
export type Age = "all" | "recent" | "30d";
export type DemandField = "postings" | "postings_recent" | "postings_30d" | "openings" | "openings_recent" | "openings_30d";
export type Call =
  | "Demand hotspot"
  | "Supply pocket"
  | "Near district rate"
  | "Thin data"
  | "Not a market";

export interface MarketRow {
  district: District;
  market_id: string;
  market: string;
  localities: string;
  lat: number | null;
  lng: number | null;
  radius_km: number;
  seekers: number;
  postings: number;
  postings_recent: number;
  openings: number;
  openings_recent: number;
  postings_30d: number;
  openings_30d: number;
}

export interface CellRow {
  district: District;
  market_id: string;
  cell_lat: number;
  cell_lng: number;
  seekers: number;
  postings: number;
  postings_recent: number;
  postings_30d: number;
}

export interface RoleRow {
  district: District;
  market_id: string;
  job_role: string;
  postings: number;
  role_rank: number;
}

export interface CoverageRow {
  district: District;
  kind: "Seekers" | "Job postings";
  total_live: number;
  usable: number;
  outside_district: number;
  default_point: number;
  no_location: number;
  usable_pct: number;
}

export interface View {
  district: District;
  measure: Measure;
  age: Age;
}

export interface MarketResult extends MarketRow {
  demand: number; // value of the current demand field
  rate: number; // demand per 100 seekers, unrounded
  index: number; // times the district rate, 1 decimal
  call: Call;
  pile: number | null; // % of seekers on the busiest ~1 km cell, null without cells.csv
  isRest: boolean;
}

export interface DistrictResult {
  district: District;
  seekers: number;
  demand: number;
  rate: number; // district rate, 1 decimal
  recentShare: number; // % of postings from the last 180 days, 1 decimal
  markets: MarketResult[]; // sorted: by rate desc (then seekers desc), REST rows last
  top: MarketResult | null;
  pocket: MarketResult | null;
}

export const THIN_SEEKERS = 30;
export const HOTSPOT_AT = 2;
export const POCKET_AT = 0.5;
export const PILE_WARN_AT = 40;
export const OPENINGS_CAP = 50; // already applied in SQL; listed so the method note can quote it

export const round1 = (x: number) => Math.round(x * 10) / 10;

export const demandField = (measure: Measure, age: Age): DemandField =>
  (age === "all" ? measure : age === "recent" ? `${measure}_recent` : `${measure}_30d`) as DemandField;

export const ageLabel = (age: Age) => (age === "recent" ? "Last 180 days" : age === "30d" ? "Last 30 days" : "All live");
export const ageSuffix = (age: Age) => (age === "recent" ? " (180 d)" : age === "30d" ? " (30 d)" : "");

export const isRest = (id: string) => id.endsWith("REST");

export function callFor(seekers: number, index: number, id: string): Call {
  if (isRest(id)) return "Not a market";
  if (seekers < THIN_SEEKERS) return "Thin data";
  if (index >= HOTSPOT_AT) return "Demand hotspot";
  if (index <= POCKET_AT) return "Supply pocket";
  return "Near district rate";
}

export const callLabel = (c: Call) =>
  c === "Near district rate" ? "Near the district rate" : c === "Not a market" ? "Rest of district" : c;

export function pileShares(cells: CellRow[] | null): Map<string, number> {
  const peak = new Map<string, number>();
  if (!cells) return peak;
  for (const c of cells) peak.set(c.market_id, Math.max(peak.get(c.market_id) ?? 0, c.seekers ?? 0));
  return peak;
}

export function computeDistrict(
  markets: MarketRow[],
  cells: CellRow[] | null,
  view: View,
): DistrictResult {
  const field = demandField(view.measure, view.age);
  const rows = markets.filter((m) => m.district === view.district);
  const seekers = rows.reduce((s, m) => s + (m.seekers || 0), 0);
  const demand = rows.reduce((s, m) => s + (m[field] || 0), 0);
  const postings = rows.reduce((s, m) => s + (m.postings || 0), 0);
  const postingsRecent = rows.reduce((s, m) => s + (m.postings_recent || 0), 0);
  const districtRate = seekers ? round1((100 * demand) / seekers) : 0;
  const peak = pileShares(cells);

  const results: MarketResult[] = rows.map((m) => {
    const d = m[field] || 0;
    const rate = m.seekers ? (100 * d) / m.seekers : 0;
    const index = districtRate ? round1(rate / districtRate) : 0;
    return {
      ...m,
      demand: d,
      rate,
      index,
      call: callFor(m.seekers, index, m.market_id),
      pile: cells && m.seekers ? round1((100 * (peak.get(m.market_id) ?? 0)) / m.seekers) : null,
      isRest: isRest(m.market_id),
    };
  });

  const main = results
    .filter((r) => !r.isRest)
    .sort((a, b) => b.rate - a.rate || b.seekers - a.seekers);
  const rest = results.filter((r) => r.isRest);

  const ranked = main
    .filter((r) => r.call !== "Thin data")
    .slice()
    .sort((a, b) => b.index - a.index || b.seekers - a.seekers);
  const pockets = main
    .filter((r) => r.call === "Supply pocket")
    .sort((a, b) => b.seekers - a.seekers);

  return {
    district: view.district,
    seekers,
    demand,
    rate: districtRate,
    recentShare: postings ? round1((100 * postingsRecent) / postings) : 0,
    markets: [...main, ...rest],
    top: ranked[0] ?? null,
    pocket: pockets[0] ?? null,
  };
}

export const showPileWarning = (m: MarketResult) =>
  m.pile !== null && m.pile >= PILE_WARN_AT && m.seekers >= THIN_SEEKERS;

// Seesaw tilt in degrees. Positive tips the jobs (right) side down.
export const seesawTilt = (index: number) =>
  Math.max(-2.5, Math.min(2.5, Math.log2(Math.max(index, 0.18)))) * 7;

// Zone colour position 0..1 on the pocket -> mid -> hot scale.
export const zoneT = (index: number) =>
  (Math.max(-1, Math.min(1, Math.log2(Math.max(index, 0.125)) / 2)) + 1) / 2;

export const unitWord = (view: View) =>
  (view.measure === "openings" ? "openings" : "job postings") +
  (view.age === "recent" ? " from the last 180 days" : view.age === "30d" ? " from the last 30 days" : "");

export const fmtInt = (n: number) => n.toLocaleString("en-IN");
export const fmt1 = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Takeaway sentences. Second is null when there is no supply pocket.
export function takeaway(r: DistrictResult, view: View): [string | null, string | null] {
  const unit = unitWord(view);
  const first = r.top
    ? `${r.top.market} has the most ${unit} per seeker: ${fmt1(r.top.rate)} per 100 seekers, against ${fmt1(r.rate)} across the district.`
    : null;
  const second = r.pocket
    ? `The biggest supply pocket is ${r.pocket.market}, with ${fmtInt(r.pocket.seekers)} seekers and only ${fmtInt(r.pocket.demand)} ${unit}.`
    : null;
  return [first, second];
}
