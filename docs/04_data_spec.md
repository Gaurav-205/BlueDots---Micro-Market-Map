# Data spec: Blue Dots Micro-Market Map

Paste this whole file into the Lovable project knowledge.

## Source

All numbers come from the Blue Dots table `bluedot_items` in the Supabase project campaign-manager (`vqvonmoktpvfvzlhtiqo`).

- Ghaziabad = instance `UP`. Hubli-Dharwad = instance `KA`.
- Only live records count: `lifecycle_status = 'live'`, `item_network = 'blue_dot'`.
- A seeker is `item_type = 'profile_1.0'`. A job posting is `item_type = 'job_posting_1.0'`.
- A record is placed on the map only if it has a latitude and longitude, is not on the default pin (`is_default_geo`), and falls inside the district outline.

The 4 queries in `sql/` do all of this and return only aggregated counts. Snapshot in this kit: pulled 2 Nov 2026.

## Files the app reads (put them in `public/data/`)

### markets.csv: one row per market, plus one "Rest of district" row per district (22 rows)

| Column | Type | Meaning |
|---|---|---|
| district | text | "Ghaziabad" or "Hubli-Dharwad" |
| market_id | text | GZB-01 to GZB-10, HDW-01 to HDW-10, plus GZB-REST and HDW-REST |
| market | text | Display name |
| localities | text | Areas the market covers, for the panel |
| lat, lng | number or blank | Market centre. Blank for REST rows |
| radius_km | number | 6 in Ghaziabad, 10 in Hubli-Dharwad |
| seekers | integer | Live seeker profiles in this market |
| postings | integer | Live job postings |
| postings_recent | integer | Of those, posted in the last 180 days |
| openings | integer | Sum of openings, each posting capped at 50 |
| openings_recent | integer | Openings on postings from the last 180 days |
| postings_30d | integer | Of those, posted in the last 30 days (added 2026-11-04) |
| openings_30d | integer | Openings on postings from the last 30 days (added 2026-11-04) |

A fresh export from `sql/markets.sql` has extra columns (postings_per_100 and so on). The app must ignore them and work the rates out itself, as below.

### roles.csv: top 4 named roles per market

Not read by the app since 2026-11-04: the "Kinds of work here" table (families.csv) replaces the top-roles chips, which repeated it with raw labels such as "ITI (Other)". The file is kept for reference.

| Column | Type | Meaning |
|---|---|---|
| district | text | |
| market_id | text | |
| job_role | text | Role as written on the posting (blank, "na" and "Any" already removed) |
| postings | integer | Postings naming this role |
| role_rank | integer | 1 to 4 |

Some markets have no rows; show "None of the postings here name a role."

### coverage.csv: how much data can be placed (4 rows)

| Column | Type | Meaning |
|---|---|---|
| district | text | |
| kind | text | "Seekers" or "Job postings" |
| total_live | integer | All live records of this kind in the instance |
| usable | integer | Placed inside the district (this is what the map uses) |
| outside_district | integer | Has a location, but outside the district |
| default_point | integer | Sits on the default pin |
| no_location | integer | No latitude or longitude |
| usable_pct | number | usable / total_live x 100, one decimal |

### cells.csv: pins on a grid of about 1 km (export it yourself with `sql/cells.sql`)

| Column | Type | Meaning |
|---|---|---|
| district | text | |
| market_id | text | Which market this cell's records belong to |
| cell_lat, cell_lng | number | Cell centre, rounded to 2 decimals |
| seekers | integer | |
| postings | integer | |
| postings_recent | integer | |
| postings_30d | integer | Postings from the last 30 days (added 2026-11-04) |

A cell can appear twice if it is split between two markets. That is fine.

### flows.csv: applications between markets (from `sql/flows.sql`)

| Column | Type | Meaning |
|---|---|---|
| district | text | |
| from_market | text | Market of the seeker who applied, or outside / no_location / default / unknown |
| to_market | text | Market of the job applied to, same codes |
| applications | integer | Apply actions, cancelled ones excluded, all time |
| accepted | integer | Of those, accepted by the employer |
| applications_recent | integer | Of those, made in the last 180 days |

Counts every application whatever the item's status today, so closed jobs still count. The market panel shows where a market's seekers applied and where applicants to its jobs came from; the map draws arrows to the top 5 destinations. Optional: without the file the section is hidden.

### families.csv: seekers and jobs per market and role family (from `sql/families.sql`, added 2026-11-04)

| Column | Type | Meaning |
|---|---|---|
| district | text | |
| market_id | text | Same ids as markets.csv, REST included |
| family | text | Kind of work, e.g. Electrical, Fitter & maintenance, Accounts & finance |
| seekers, postings, postings_recent, openings, openings_recent, postings_30d, openings_30d | integer | Same meaning as in markets.csv, for that family only |

Each seeker or job is in exactly one family: the first rule in `sql/families.sql` whose pattern matches its text (the job's role; the seeker's ITI trade, wanted roles, diploma, vocational course and studies). So a market's families add up to its markets.csv row, give or take new sign-ups between the two exports. Five buckets are not a kind of work and are shown apart: "Studied, no trade stated", "Open to anything", "Not stated", "ITI, any trade", "Other". Optional: without the file the Role filter and Skills tab are hidden.

The Role filter recomputes every view with one family's counts in place of the market totals (same formulas). The Skills tab compares each family's rate with the all-roles district rate, using the same thresholds as the market calls.

### pool.csv: matching pool per market and role family (from `sql/pool.sql`, added 2026-11-04)

Only role families that are a kind of work. Same snapshot as families.csv, so `jobs` and `seekers` equal its `postings` and `seekers`.

| Column | Meaning |
|---|---|
| jobs, openings | Live postings of this family placed in the market |
| hard_jobs, hard_openings | Of those, postings with fewer than 5 seekers of the same family within 10 km |
| seekers | Seekers of this family placed in the market |
| stranded_seekers | Of those, seekers with no posting of the same family within 10 km |

### employers.csv: top 6 employers per market (from `sql/employers.sql`, added 2026-11-04)

District, market_id, employer, postings, openings, postings_30d, applications, accepted, employers_in_market. Spellings are merged on a normalised key; test postings and postings without an employer name are left out.

Match score v2 (used for call lists, not shown on the map): see `match_score.md`.

### market_centres.json

The same centres as markets.csv, as JSON. Use it as the single source for centre positions and radius. Fields: market_id, district, market, localities, lat, lng, radius_km.

### district_outlines.geojson

Two polygon features with `properties.district` = "Ghaziabad" or "Hubli-Dharwad". These are 2011 census outlines from the open india-maps-data project, simplified (about 100 to 135 points each). Use them to draw the outline, fit the map, and clip the zones.

## Formulas

Let `v` be the current demand field:

| Count demand as | All live | Last 180 days | Last 30 days |
|---|---|---|---|
| Job postings | `postings` | `postings_recent` | `postings_30d` |
| Openings | `openings` | `openings_recent` | `openings_30d` |

If the district has no demand in the chosen period, the app shows a "no new postings" message instead of rates and calls.

Then:

1. **Market rate:** `rate = 100 x v / seekers`. Show it with one decimal. If seekers = 0, the rate is 0.
2. **District rate:** add `v` and `seekers` over every row of the district, including the REST row. Then `district_rate = round(100 x sum(v) / sum(seekers), 1 decimal)`.
3. **Times the district rate:** `index = round(rate / district_rate, 1 decimal)`. Use the unrounded market rate, divided by the rounded district rate as shown on screen. If district_rate = 0, index = 0.
4. **Call**, in this order:
   - If market_id ends with "REST": "Not a market".
   - Else if seekers < 30: "Thin data".
   - Else if index >= 2: "Demand hotspot".
   - Else if index <= 0.5: "Supply pocket".
   - Else: "Near district rate". Show it as "Near the district rate".
5. **Pile share:** for each market, take the cell in cells.csv with the most seekers. `pile = round(100 x that cell's seekers / market seekers, 1 decimal)`. Show the warning when pile >= 40 and the market has 30 or more seekers.
6. **Freshness:** `recent_share = round(100 x sum(postings_recent) / sum(postings), 1 decimal)` over the district.
7. **Takeaway:**
   - **Top market:** among markets that are not REST and not Thin data, the one with the highest index (ties broken by more seekers).
   - **Biggest pocket:** among "Supply pocket" markets, the one with the most seekers. If there is none, hide the second sentence.

The exact code is in `06_logic.ts`. Use it as is.

## How markets are assigned (done in SQL, for reference)

- Each placed record goes to the nearest market centre. Distance is measured in km with a flat-earth approximation, which is fine at this scale.
- If the nearest centre is more than radius_km away (6 km in Ghaziabad, 10 km in Hubli-Dharwad), the record goes to Rest of district.
- On the map, draw each zone as its Voronoi cell, cut to a circle of radius_km around the centre, then cut to the district outline. That matches the SQL rule.

## Method note (show this text in the app, 12 px muted)

How the markets are drawn: each seeker or posting goes to its nearest market centre if it is within 6 km (Ghaziabad) or 10 km (Hubli-Dharwad); anything further counts as rest of district. Seeker pins may show where someone was signed up (a college or camp) rather than where they live, and job pins may show the office that entered the posting. Openings are capped at 50 a posting because a few postings list hundreds. District outlines are 2011 census boundaries, simplified. Market centres are my placement of well-known localities and should be checked on a map before this goes outside the team. All counts are aggregated; no personal details are shown.

## Privacy

- Only aggregated counts. Never add a column with names, phone numbers, emails, addresses or individual IDs.
- Don't put any Supabase key in the app.
- Treat it as internal Blue Dots data: keep the Lovable project private.
