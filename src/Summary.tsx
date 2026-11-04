import type { ReactNode } from "react";
import { demandField, fmt1, fmtInt, THIN_SEEKERS } from "./lib/logic";
import type { DistrictResult, View } from "./lib/logic";
import { familyTotals, NO_ROLE } from "./lib/families";
import type { EmployerRow, FamilyRow, PoolRow } from "./lib/families";
import { isPlaced } from "./lib/flows";
import type { FlowRow } from "./lib/flows";
import type { CoverageRow } from "./lib/logic";

interface Props {
  result: DistrictResult; // all roles, current count and period
  view: View;
  families: FamilyRow[] | null;
  pool: PoolRow[] | null;
  flows: FlowRow[] | null;
  employers: EmployerRow[] | null;
  coverage: CoverageRow[] | null;
  onMarket: (id: string) => void;
  onRole: (family: string) => void;
  onFresh: () => void;
}

type Tone = "good" | "bad" | "note";
interface Finding { key: string; tone: Tone; text: ReactNode; act?: () => void; actLabel?: string }

// What the numbers mean for the team, worked out from the data each time it loads. Every line is a fact
// someone can act on: where jobs are, where seekers wait, which skills are short or oversupplied, how far apart
// people and jobs are, where applications turn into jobs, and how far to trust it all.
export default function Summary(p: Props) {
  const { result: r, view } = p;
  const unit = view.measure === "openings" ? "openings" : "postings";
  const of = (n: number) => `${fmtInt(n)} ${n === 1 ? unit.slice(0, -1) : unit}`; // "1 posting", "2 postings"
  const name = new Map(r.markets.map((m) => [m.market_id, m.isRest ? "the rest of the district" : m.market]));
  const out: { title: string; items: Finding[] }[] = [];

  // 1. Is the demand real and recent?
  const freshField = demandField(view.measure, "30d");
  const fresh = r.markets.reduce((s, m) => s + (m[freshField] || 0), 0);
  const allField = demandField(view.measure, "all");
  const all = r.markets.reduce((s, m) => s + (m[allField] || 0), 0);
  out.push({ title: "Is the demand current?", items: [{
    key: "fresh", tone: all && fresh / all >= 0.25 ? "good" : "bad",
    text: fresh
      ? <>Only <b>{fmtInt(fresh)}</b> of <b>{fmtInt(all)}</b> live {unit} were added in the last 30 days. Most of the demand on this map is older and may already be filled.</>
      : <>No {unit} were added in the last 30 days. Everything on this map is older and may already be filled.</>,
    act: view.age === "30d" ? undefined : p.onFresh, actLabel: "Show last 30 days",
  }] });

  // 2. Where the jobs are, and where seekers wait.
  const markets = r.markets.filter((m) => !m.isRest);
  const hot = markets.filter((m) => m.call === "Demand hotspot");
  const pockets = markets.filter((m) => m.call === "Supply pocket").sort((a, b) => b.seekers - a.seekers);
  const pocketShare = r.seekers ? (100 * pockets.reduce((s, m) => s + m.seekers, 0)) / r.seekers : 0;
  const place: Finding[] = [];
  if (r.top) place.push({
    key: "top", tone: "good", act: () => p.onMarket(r.top!.market_id), actLabel: "Open market",
    text: <><b>{r.top.market}</b> has the most {unit} per seeker: {fmt1(r.top.rate)} per 100, {fmt1(r.top.index)}× the district. {hot.length > 1 ? <>{hot.length} markets are demand hotspots; send seekers from nearby pockets there first.</> : <>Send seekers from nearby pockets here first.</>}</>,
  });
  if (r.pocket) place.push({
    key: "pocket", tone: "bad", act: () => p.onMarket(r.pocket!.market_id), actLabel: "Open market",
    text: <><b>{r.pocket.market}</b> has {fmtInt(r.pocket.seekers)} seekers and only {of(r.pocket.demand)}. Supply pockets hold <b>{fmt1(pocketShare)}%</b> of the district's seekers; they need employers brought in or help to travel.</>,
  });
  if (place.length) out.push({ title: "Where are the jobs and the people?", items: place });

  // 3. Which kinds of work are short or oversupplied (role families that are a real kind of work).
  if (p.families) {
    const fam = familyTotals(p.families, view).filter((t) => !NO_ROLE.has(t.family));
    // Same bar as the market calls: at least 30 seekers to judge a rate; shortage needs 10+ postings,
    // oversupply is the biggest group (most seekers) at half the district rate or less.
    const short = fam.filter((t) => t.demand >= 10 && t.seekers >= THIN_SEEKERS).sort((a, b) => b.rate - a.rate)[0];
    const over = fam.filter((t) => t.seekers >= THIN_SEEKERS && t.rate <= 0.5 * r.rate).sort((a, b) => b.seekers - a.seekers)[0];
    const items: Finding[] = [];
    if (short && r.rate) items.push({
      key: "short", tone: "good", act: () => p.onRole(short.family), actLabel: "Show on map",
      text: <><b>{short.family}</b> is short of people: {of(short.demand)} for {fmtInt(short.seekers)} seekers, {fmt1(short.rate / r.rate)}× the district rate. Worth recruiting or training seekers for it.</>,
    });
    if (over && (!short || over.family !== short.family)) items.push({
      key: "over", tone: "bad", act: () => p.onRole(over.family), actLabel: "Show on map",
      text: <><b>{over.family}</b> is oversupplied: {fmtInt(over.seekers)} seekers and only {of(over.demand)}. Bring in employers for this work or steer these seekers to nearby skills.</>,
    });
    if (items.length) out.push({ title: "Which skills are short or oversupplied?", items });
  }

  // 4. Distance: seekers with no job of their trade within reach.
  if (p.pool) {
    const here = p.pool.filter((x) => x.district === view.district);
    const s = here.reduce((a, x) => a + x.seekers, 0), st = here.reduce((a, x) => a + x.stranded_seekers, 0);
    const byMarket = new Map<string, number>();
    for (const x of here) byMarket.set(x.market_id, (byMarket.get(x.market_id) ?? 0) + x.stranded_seekers);
    const worst = [...byMarket.entries()].filter(([id]) => !id.endsWith("REST")).sort((a, b) => b[1] - a[1])[0];
    const hard = here.reduce((a, x) => a + x.hard_jobs, 0), jobs = here.reduce((a, x) => a + x.jobs, 0);
    if (s) out.push({ title: "Are people and jobs close enough?", items: [{
      key: "dist", tone: st / s > 0.15 ? "bad" : "good", act: worst ? () => p.onMarket(worst[0]) : undefined, actLabel: "Open market",
      text: <><b>{fmt1((100 * st) / s)}%</b> of seekers who name a trade have no job of that trade within 10 km{worst && worst[1] > 0 ? <>, most of them in <b>{name.get(worst[0])}</b> ({fmtInt(worst[1])})</> : null}. {jobs && hard / jobs < 0.1 ? <>Only {fmtInt(hard)} of {fmtInt(jobs)} trade jobs lack seekers nearby, so the gap is distance and local employers, not skills.</> : <>{fmtInt(hard)} of {fmtInt(jobs)} trade jobs also lack seekers nearby.</>}</>,
    }] });
  }

  // 5. What seekers actually do, and where it leads to a job.
  const act: Finding[] = [];
  if (p.flows) {
    const rows = p.flows.filter((f) => f.district === view.district);
    const cross = rows.filter((f) => f.from_market !== f.to_market && isPlaced(f.from_market) && isPlaced(f.to_market)).sort((a, b) => b.applications - a.applications)[0];
    const apps = rows.reduce((a, f) => a + f.applications, 0), acc = rows.reduce((a, f) => a + f.accepted, 0);
    if (cross) act.push({
      key: "flow", tone: "note", act: () => p.onMarket(cross.from_market), actLabel: "See where they apply",
      text: <>The busiest route: seekers from <b>{name.get(cross.from_market)}</b> applied <b>{fmtInt(cross.applications)}</b> times to jobs in <b>{name.get(cross.to_market)}</b>. People already travel for work; transport or outreach along this route pays off.</>,
    });
    if (apps) {
      const top = (p.employers ?? []).filter((e) => e.district === view.district && e.accepted > 0).sort((a, b) => b.accepted - a.accepted)[0];
      act.push({
        key: "acc", tone: acc / apps >= 0.05 ? "good" : "bad",
        text: <><b>{fmtInt(acc)}</b> of <b>{fmtInt(apps)}</b> applications ({fmt1((100 * acc) / apps)}%) ended in an acceptance{top ? <>; the most came from <b>{top.employer}</b> ({fmtInt(top.accepted)} of {fmtInt(top.applications)})</> : null}. {acc / apps < 0.05 ? "Following up with employers on pending applications is the biggest lever." : "Ask why these employers convert and copy it with others."}</>,
      });
    }
  }
  if (act.length) out.push({ title: "What happens when people apply?", items: act });

  // 6. How far to trust this.
  const seek = p.coverage?.find((c) => c.district === view.district && c.kind === "Seekers");
  const trust: Finding[] = [];
  if (seek) trust.push({
    key: "loc", tone: seek.usable_pct >= 60 ? "note" : "bad",
    text: <>Only <b>{fmt1(seek.usable_pct)}%</b> of {fmtInt(seek.total_live)} live seekers have a real location, so the map shows part of the picture. Asking for a location at sign-up would fix this.</>,
  });
  if (p.families) {
    const t = familyTotals(p.families, { ...view, measure: "postings", age: "all" });
    const jobs = t.reduce((a, x) => a + x.demand, 0), noRole = t.find((x) => x.family === "Not stated")?.demand ?? 0;
    const seekers = t.reduce((a, x) => a + x.seekers, 0), school = t.find((x) => x.family === "Studied, no trade stated")?.seekers ?? 0;
    if (jobs && seekers) trust.push({
      key: "roles", tone: "note",
      text: <><b>{fmt1((100 * noRole) / jobs)}%</b> of postings here name no role and <b>{fmt1((100 * school) / seekers)}%</b> of seekers list only their schooling. Making role required on job posts and asking seekers what work they want would sharpen every match.</>,
    });
  }
  if (trust.length) out.push({ title: "How far can we trust this?", items: trust });

  return (
    <div className="summary">
      {out.map((sec) => (
        <section key={sec.title}>
          <h3>{sec.title}</h3>
          {sec.items.map((f) => (
            <div key={f.key} className={`finding ${f.tone}`}>
              <p>{f.text}</p>
              {f.act && <button type="button" className="link" onClick={f.act}>{f.actLabel} →</button>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
