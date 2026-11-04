// Checks src/lib/logic.ts on public/data against docs/07_expected_results.md, all 8 views.
// Run: npm run check
import { readFileSync } from "node:fs";
import { callLabel, computeDistrict, fmt1, fmtInt, takeaway } from "../src/lib/logic.ts";
import type { Age, District, MarketRow, Measure } from "../src/lib/logic.ts";
import { flowCoverage, flowsFor } from "../src/lib/flows.ts";
import type { FlowRow } from "../src/lib/flows.ts";

const csv = readFileSync(new URL("../public/data/markets.csv", import.meta.url), "utf8").trim().split(/\r?\n/); // CRLF exports once hid the last column
const head = csv[0].split(",");
const num = new Set(["lat", "lng", "radius_km", "seekers", "postings", "postings_recent", "openings", "openings_recent", "postings_30d", "openings_30d"]);
const markets = csv.slice(1).map((line) => {
  const cells = line.match(/("[^"]*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, ""));
  return Object.fromEntries(head.map((h, i) => [h, num.has(h) ? (cells[i] === "" ? null : Number(cells[i])) : cells[i]]));
}) as unknown as MarketRow[];

const md = readFileSync(new URL("../docs/07_expected_results.md", import.meta.url), "utf8");
const sections = md.split(/^### /m).slice(1);
let fails = 0;
const eq = (what: string, got: string, want: string) => {
  if (got !== want) { fails++; console.log(`FAIL ${what}\n  got:  ${got}\n  want: ${want}`); }
};

for (const s of sections) {
  const [title] = s.split("\n");
  const [d, m, a] = title.split(", ");
  const view = {
    district: d as District,
    measure: (m === "Openings" ? "openings" : "postings") as Measure,
    age: (a === "Last 180 days" ? "recent" : "all") as Age,
  };
  const r = computeDistrict(markets, null, view);
  eq(`${title} district rate`, fmt1(r.rate), s.match(/District rate: \*\*([\d.]+)\*\*/)![1]);
  eq(`${title} freshness`, fmt1(r.recentShare) + "%", s.match(/last 180 days: ([\d.]+%)/)![1]);
  eq(`${title} takeaway`, takeaway(r, view).filter(Boolean).join(" "), s.match(/Takeaway: "(.*)"/)![1]);
  const rows = s.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Market"));
  rows.forEach((l, i) => {
    const want = l.split("|").slice(1, -1).map((c) => c.trim()).join(" | ");
    const x = r.markets[i];
    const got = x
      ? [x.isRest ? "Rest of district" : x.market, fmtInt(x.seekers), fmtInt(x.demand), fmt1(x.rate), fmt1(x.index), callLabel(x.call)].join(" | ")
      : "(missing)";
    eq(`${title} row ${i + 1}`, got, want);
  });
}
// Last 30 days has no expected-results file; check it is a subset of the last 180 days in every market.
for (const m of markets) for (const k of ["postings", "openings"] as const) {
  if (!(m[`${k}_30d`] <= m[`${k}_recent`])) eq(`${m.market_id} ${k}_30d <= ${k}_recent`, String(m[`${k}_30d`]), `<= ${m[`${k}_recent`]}`);
}
// Flows: every application lands in exactly one bucket on each side.
const fl = readFileSync(new URL("../public/data/flows.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map((l) => {
  const [district, from_market, to_market, applications, accepted, applications_recent] = l.split(",");
  return { district, from_market, to_market, applications: +applications, accepted: +accepted, applications_recent: +applications_recent } as FlowRow;
});
for (const d of ["Ghaziabad", "Hubli-Dharwad"]) {
  const ids = new Set(fl.filter((r) => r.district === d).flatMap((r) => [r.from_market, r.to_market]));
  let outSum = 0;
  for (const id of ids) {
    const f = flowsFor(fl.filter((r) => r.district === d), id);
    for (const s of [f.out, f.in]) eq(`${d} ${id} flow buckets`, String(s.local + s.unplaced + s.placed.reduce((t, l) => t + l.n, 0)), String(s.total));
    outSum += f.out.total;
  }
  eq(`${d} flow total`, String(outSum), String(flowCoverage(fl, d).total));
}
// Families: each market's families add up to its markets.csv row. families.csv is a later snapshot,
// so allow a little drift from new sign-ups (1% or 5 items, whichever is larger).
const famLines = readFileSync(new URL("../public/data/families.csv", import.meta.url), "utf8").trim().split(/\r?\n/);
const famHead = famLines[0].split(",");
const famSum = new Map<string, Record<string, number>>();
for (const l of famLines.slice(1)) {
  const c = l.match(/("[^"]*"|[^,]*)(,|$)/g)!.map((x) => x.replace(/,$/, "").replace(/^"|"$/g, ""));
  const acc = famSum.get(c[1]) ?? {};
  famHead.slice(3).forEach((h, i) => (acc[h] = (acc[h] ?? 0) + Number(c[i + 3])));
  famSum.set(c[1], acc);
}
for (const m of markets) for (const k of ["seekers", "postings", "openings", "postings_30d", "openings_30d"] as const) {
  const got = famSum.get(m.market_id)?.[k] ?? 0, want = m[k];
  if (Math.abs(got - want) > Math.max(5, want / 100)) eq(`${m.market_id} families ${k}`, String(got), `about ${want}`);
}
console.log(fails ? `${fails} mismatches` : `All ${sections.length} views match`);
process.exit(fails ? 1 : 0);
