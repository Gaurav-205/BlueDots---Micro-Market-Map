# PRD: Blue Dots Micro-Market Map

Owner: Gaurav Khandelwal (Blue Dots, EkStep Foundation)
Asked for by: Adarsh, for the JFC review
Status: v1 to build
Data snapshot: live Blue Dots records, pulled 2 Nov 2026

## 1. The problem

We run KKB campaigns and collect jobs across a whole district, but we don't know where inside the district the jobs are and where the job seekers are. So we can't say "send these people to that area" or "we need employers in this area". Adarsh asked for a view that splits each district into 8 to 10 micro-markets and shows supply and demand in each.

## 2. Who uses it

- **Adarsh and the Blue Dots leads**, to decide where to push in JFC reviews.
- **Parth, Santosh and the JFC teams**, to plan campaigns and employer outreach by area.
- **Gaurav**, to refresh the data and present it.

Everyone is internal. The app is read only.

## 3. What success looks like

- In a review, someone can answer "where should we bring employers?" and "where should we send seekers?" for either district in under a minute.
- Every number on screen matches the data files exactly (see `07_expected_results.md`).
- Nobody is misled: the gaps in the data (missing locations, old postings, seekers piled on one spot) are shown, not hidden.

## 4. Key ideas, in plain words

- **Supply** = live Blue Dots seeker profiles with a real location inside the district.
- **Demand** = live job postings with a real location inside the district. It can be counted two ways: number of postings, or number of openings. Openings are capped at 50 per posting, because a few postings claim hundreds.
- **Recent** = posted in the last 180 days.
- **Micro-market** = the area nearest one of 10 market centres, up to 6 km away in Ghaziabad and 10 km in Hubli-Dharwad. Anything further is "Rest of district".
- **Rate** = demand per 100 seekers.
- **Times the district rate** = a market's rate divided by its district's rate.
- **Call**:
  - Demand hotspot: 2 times the district rate or more.
  - Supply pocket: half the district rate or less.
  - Near the district rate: anything in between.
  - Thin data: fewer than 30 seekers, so no call is made.
  - Rest of district: not a market, so no call.

Exact formulas are in `04_data_spec.md` and `06_logic.ts`.

## 5. Scope

### v1 (build now)

| # | Feature | Must or should |
|---|---|---|
| F1 | District switch: Ghaziabad or Hubli-Dharwad | Must |
| F2 | Demand switch: job postings or openings | Must |
| F3 | Postings switch: all live or last 180 days | Must |
| F4 | Takeaway line at the top that rewrites itself for the current view | Must |
| F5 | Map with district outline, 10 coloured zones, a split circle at each centre (seekers left, demand right) and labels | Must |
| F6 | Hover tooltip on a zone: name, call, seekers, demand, rate | Must |
| F7 | Click a zone to open the market panel; click again or press Esc to close | Must |
| F8 | Market panel: name, localities, call badge, seesaw, numbers, "My recommendation", top roles, warning if seekers are piled on one spot | Must |
| F9 | Ranked table of all markets, sorted by rate, with "Rest of district" at the bottom; clicking a row selects the market on the map | Must |
| F10 | "What this map can't see" section: location coverage, freshness, method notes | Must |
| F11 | Pins layer from `cells.csv` (seekers as grey dots, postings as blue squares), with a toggle | Should |
| F12 | View kept in the link (district, demand, postings, selected market) so a link opens the same view | Should |
| F13 | Download the current ranked table as CSV | Should |

### Later (v2, not now)

- Live data instead of a CSV snapshot (see section 8).
- Side by side view of both districts.
- Filter by job role.
- Travel time from each supply pocket to the nearest hotspot.
- Editing market centres inside the app.

### Not doing

- No individual seeker or employer records, ever.
- No login system in v1 (see Access).
- No writing back to any Blue Dots database.

## 6. Screens

One page, top to bottom:

1. Header: title and one line on what this is.
2. Controls row: district, demand, postings, pins toggle.
3. Takeaway line.
4. Map (left, wide) and market panel (right). On phones the panel goes under the map.
5. Ranked table.
6. "What this map can't see".

Wireframe and styling are in `02_design.md`. Journeys and states are in `03_user_flows.md`.

## 7. Acceptance criteria

The app is done when all of these are true:

1. With Ghaziabad, job postings and all live selected:
   - The district rate shows 4.1 per 100 seekers.
   - Ghaziabad City shows 10.1 and is a demand hotspot.
   - Modinagar shows 991 seekers, 0 postings and is a supply pocket.
2. With Hubli-Dharwad, job postings and all live selected:
   - The district rate shows 14.7.
   - Gokul Road and Airport shows 130.0.
   - Dharwad City is a supply pocket with 2,038 seekers.
3. Every value in `07_expected_results.md` matches what the app shows, for all 4 combinations of demand and postings.
4. "Rest of district" never gets a call, never gets a zone on the map, and always sits at the bottom of the table.
5. The takeaway line changes when any control changes.
6. When a market has 40% or more of its seekers on its single busiest 1 km cell, the panel shows the pile warning. This needs `cells.csv`; without it the warning is hidden.
7. No text anywhere uses an em dash or en dash.
8. It works at 375 px wide (phone) and at 1440 px wide.
9. If a data file fails to load, that part of the page says so in one line instead of showing wrong or blank numbers.

## 8. Data and refresh

- **v1:** static CSV and JSON files in the app (`public/data/`). Gaurav refreshes them by running the 4 queries in `sql/` and replacing the files.
- **v2 (needs approval):** a Supabase Edge Function on the Blue Dots project that runs the same 4 queries and returns only aggregated rows. The app would call that function instead of reading files.
  - Gaurav's Supabase access is read only, so Palak or the data owner would have to create the function.
  - Vineela approves data access, so ask her first.
  - Never put a Supabase service key in the Lovable app.

## 9. Access

The data is aggregated and has no personal details, but it is still internal Blue Dots data.

- Keep the Lovable project private.
- Don't publish a public URL until Adarsh and Vineela agree.
- For Thursday, present it from your own screen.

## 10. Risks and caveats the app must show

- **Missing locations:** 62% of Ghaziabad and 53% of Hubli-Dharwad live postings have no location, so demand is undercounted.
- **Old postings:** only about 31% (Ghaziabad) and 8% (Hubli-Dharwad) of mapped postings are from the last 180 days.
- **Seeker locations:** seeker pins can show where someone was signed up (a college or camp), not where they live.
- **Job locations:** job pins can show the office that entered the posting, not the job site.
- **Market centres:** my placement of well-known localities, to be checked on a map before anything goes outside the team.

## 11. Open questions

1. Does Adarsh want 10 markets per district, or fewer and bigger?
2. Should the 180-day view be the default for the review?
3. Who owns refreshing the data after Thursday?
4. Is v2 live data worth asking Vineela and Palak for, or is a weekly CSV refresh enough?
