// Role families per market, from families.csv (docs/sql/families.sql).
// Each seeker and job is in exactly one family, so a market's families add up to its markets.csv row
// (give or take a few live sign-ups: families.csv is a later snapshot than markets.csv).
import { demandField } from "./logic";
import type { MarketRow, View } from "./logic";

export interface FamilyRow {
  district: string;
  market_id: string;
  family: string;
  seekers: number;
  postings: number;
  postings_recent: number;
  openings: number;
  openings_recent: number;
  postings_30d: number;
  openings_30d: number;
}

// Buckets that say nothing about the kind of work; shown apart from the real skill families.
export const NO_ROLE = new Set(["Studied, no trade stated", "Open to anything", "Not stated", "ITI, any trade", "Other"]);

const NUMS = ["seekers", "postings", "postings_recent", "openings", "openings_recent", "postings_30d", "openings_30d"] as const;

/** The district's market rows with every count replaced by that family's count, so computeDistrict works unchanged. */
export function familyMarkets(markets: MarketRow[], families: FamilyRow[], family: string): MarketRow[] {
  const by = new Map(families.filter((f) => f.family === family).map((f) => [f.market_id, f]));
  return markets.map((m) => {
    const f = by.get(m.market_id);
    const out = { ...m };
    for (const k of NUMS) out[k] = f ? f[k] : 0;
    return out;
  });
}

export interface FamilyTotal { family: string; seekers: number; demand: number; rate: number }

/** Seekers and demand per family for a district, or one market when marketId is given. Biggest gap first is up to the caller. */
export function familyTotals(families: FamilyRow[], view: View, marketId?: string): FamilyTotal[] {
  const field = demandField(view.measure, view.age);
  const acc = new Map<string, FamilyTotal>();
  for (const f of families) {
    if (f.district !== view.district || (marketId && f.market_id !== marketId)) continue;
    const t = acc.get(f.family) ?? { family: f.family, seekers: 0, demand: 0, rate: 0 };
    t.seekers += f.seekers;
    t.demand += f[field];
    acc.set(f.family, t);
  }
  return [...acc.values()].map((t) => ({ ...t, rate: t.seekers ? (100 * t.demand) / t.seekers : 0 }));
}
