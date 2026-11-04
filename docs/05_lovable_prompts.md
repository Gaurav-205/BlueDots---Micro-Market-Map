# Lovable prompts: build in this order

## Before you start

1. Create a new Lovable project, and keep it private.
2. In the project knowledge, paste all of `02_design.md`, then all of `04_data_spec.md`.
3. Paste one prompt at a time. Wait for each build to finish and check it against `07_expected_results.md` before you send the next one.
4. If something comes out wrong, don't stack fixes into the next prompt. Send a short fix prompt first (examples at the end).

---

## Prompt 1: Set up the project, the data and the logic

Attach these files to this message: `06_logic.ts`, `data/markets.csv`, `data/roles.csv`, `data/coverage.csv`, `data/market_centres.json`, `data/district_outlines.geojson`, and `cells.csv` if you exported it.

```
I'm building an internal map app for Blue Dots called "Blue Dots micro-markets". It shows where we have job seekers and where we have jobs, in 10 micro-markets each for two districts, Ghaziabad and Hubli-Dharwad. Follow the design and data spec in the project knowledge exactly.

This first step is only setup, no UI yet beyond a plain page that proves the data loads.

1. Put the attached data files in public/data/ with these exact names: markets.csv, roles.csv, coverage.csv, market_centres.json, district_outlines.geojson, and cells.csv if attached.
2. Put the attached 06_logic.ts at src/lib/logic.ts and do not change its maths. Every number in the app must come from its functions.
3. Add papaparse to read the CSVs. Write a small data hook (src/lib/useData.ts) that loads all files once, turns number columns into numbers (blank lat/lng become null), ignores any extra CSV columns, and reports a status per file: loading, ok or error. cells.csv is optional: if it is missing, its status is "missing" and nothing breaks.
4. Keep the view in the URL query string: district (Ghaziabad or Hubli-Dharwad, default Ghaziabad), measure (postings or openings, default postings), age (all or recent, default all), market (a market_id or empty), pins (1 or 0, default 1). Write a hook useView() that reads and updates it.
5. For now, render a plain test page that prints, for the current view, the district rate and a simple table of every market with seekers, demand, rate (1 decimal), times the district rate and call, using computeDistrict() from logic.ts.

No login, no backend, no Supabase connection. All data stays in these static files.
```

Check: Ghaziabad, postings, all live should show a district rate of 4.1 and Ghaziabad City at 10.1, a demand hotspot.

---

## Prompt 2: Page layout, controls and takeaway

```
Now build the real page layout from design.md, replacing the test page.

- Header: title "Where jobs and job seekers meet: Blue Dots micro-markets" in Source Serif 4, and under it one muted line: "Live Blue Dots seeker profiles and job postings that carry a real map location, grouped into 10 micro-markets per district. Each zone is coloured by how many jobs it has per seeker, compared with its own district. Data as of 2 Nov 2026."
- Controls row with pill segmented controls: District [Ghaziabad | Hubli-Dharwad], Count demand as [Job postings | Openings], Postings [All live | Last 180 days], and a "Show pins" checkbox. They read and write the URL view. Changing district clears the selected market. Disable "Show pins" with the note "Pins need cells.csv" if cells.csv is missing.
- Takeaway: use takeaway() from logic.ts. Show the two sentences at 18 px, with market names and numbers in semibold. Hide the second sentence when it is null.
- Below: a two-column area (map card wide on the left, market panel 340 px on the right, stacking under 860 px), then a full-width "All micro-markets, ranked by jobs per seeker" card, then a full-width "What this map can't see" card. Leave the map, panel and table as empty cards with their headings for now.
- Fonts: Source Serif 4 for headings, Inter for everything else, tabular numbers.
- No em dashes or en dashes anywhere in the text.
```

Check: the takeaway changes when you flip any control, and matches `07_expected_results.md`.

---

## Prompt 3: The base map and coloured zones

```
Build the map inside the map card using react-leaflet.

- Base tiles: CARTO Positron light (https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png) with their attribution. Disable scroll-wheel zoom unless the map is focused; keep zoom buttons.
- Fit to the current district's outline from district_outlines.geojson with 20 px padding, and refit when the district changes. Map height: 560 px on desktop, 420 px on phones.
- Draw the outline: 1.2 px stroke in muted (#6B7280), no fill. Fill the inside with a light diagonal hatch in #E3E6EA (an SVG pattern), to show "rest of district".
- Zones: add @turf/turf. For the current district's 10 market centres (market_centres.json):
  1. Make a Voronoi diagram over the outline's bounding box.
  2. Intersect each cell with a turf.circle of radius_km around its centre.
  3. Intersect that with the district outline.
  Memoise this per district.
- Colour each zone using zoneT(index) from logic.ts on a 3-stop scale: #E8833A (0), #C9CED6 (0.5), #2B8FA6 (1). Use d3-interpolate or chroma-js. Thin data zones use #E3E6EA. Fill opacity 0.62, white 1.5 px stroke.
- Under the map, the legend from design.md: the gradient bar with "Fewer jobs per seeker" and "More jobs per seeker", a split-circle key "Seekers | demand", and a pins key "Pins: seekers, postings".
- Under the card heading, this note in 12 px muted: "Each zone covers the places nearest one market centre, up to {radius} km away. Hatched ground is the rest of district. The split circle at each centre shows seekers on the left and demand on the right, on one shared scale. Click a zone for its numbers." {radius} is 6 for Ghaziabad and 10 for Hubli-Dharwad, from the data.
```

Check: in Ghaziabad (postings, all live), Ghaziabad City, Indirapuram and Raj Nagar Extension are blue, and Muradnagar and Modinagar are orange.

---

## Prompt 4: Split circles, labels, tooltip and selection

```
Add these on top of the zones.

- At each market centre, a split circle drawn as an SVG marker (a Leaflet divIcon or a custom SVG overlay):
  - The left half is seekers, in #6B7280. The right half is the current demand, in #2B8FA6.
  - A thin white divider line between the halves.
  - Radius uses one square-root scale per view, where the largest of (seekers, demand) across the district's markets gets 28 px.
  - If demand is 0, draw only the left half.
- Labels: market name (12 px semibold) with "{rate} per 100" under it (11 px muted, 1 decimal).
  - Give the text a white halo.
  - Try placing the label below the circle, then above, then right, then left.
  - Skip any label that would overlap another label or circle, unless that market is selected.
- Tooltip on hovering a zone or circle:
  - A small white card that stays inside the map box.
  - Lines: name (semibold), call label, "{seekers} seekers", "{demand} {unit}", "{rate} per 100 seekers".
  - Use callLabel() and unitWord() from logic.ts.
- Clicking a zone or circle sets market in the URL view. Clicking the selected one again, clicking empty map, or pressing Esc clears it.
  - The selected zone gets a 2.5 px #1F2933 stroke.
  - Every other zone drops to fill opacity 0.28.
- Pins layer, only when "Show pins" is on and cells.csv loaded. Use the current district's cells.
  - Seekers: grey (#1F2933 at 16% opacity) circles, square-root sized up to 11 px radius.
  - Postings: #2B8FA6 squares at 85% opacity, up to 18 px wide. Use postings_recent instead of postings when age is recent.
  - Draw pins between the zones and the split circles. They must not catch clicks.
```

---

## Prompt 5: The market panel

```
Build the market panel on the right (sticky on desktop, under the map on phones), from design.md.

- Nothing selected: one muted line, "Pick a zone on the map or a row in the list to see that market's numbers and what I'd propose for it."
- Selected market:
  - Name in Source Serif 4, 30 px. Localities in 12 px muted.
  - A call badge (pill with coloured dot): Demand hotspot #2B8FA6; Supply pocket #D06A22; Near the district rate, Thin data and Rest of district in muted.
  - The seesaw, as an SVG:
    - A beam on a small triangle. Left weight grey with "Seekers" and the count above it. Right weight #2B8FA6 with "Postings" or "Openings" and the current demand count above it.
    - Tilt with seesawTilt(index) from logic.ts, animated over 400 ms (none with prefers-reduced-motion).
    - Caption: "Tips toward jobs, compared with the district" when index >= 1, else "Tips toward seekers, compared with the district".
  - A two-column numbers list (not tiles): Seekers; Live job postings; Posted in last 180 days; Openings (capped at 50 a posting); Demand per 100 seekers (current view, 1 decimal); District rate; Times the district rate.
  - A "My recommendation" box: #E8F5E9 fill, 3 px #2E7D32 left border, bold "My recommendation:" label in #2E7D32. The text depends on the call; copy it exactly from design.md.
  - "Roles asked for most here": a numbered list from roles.csv for this market_id, as "Machine Operator (151)". If there are none: "None of the postings here name a role."
  - The pile warning from design.md, shown only when showPileWarning() from logic.ts is true. Show pile with 1 decimal.
- Changing district, demand or postings updates the panel straight away.
```

Check: Hubli-Dharwad, Dharwad City shows Supply pocket, 2,038 seekers, the "bring employers here" box, Fitter (7) as the first role, and the pile warning at 73.7% (if cells.csv is loaded).

---

## Prompt 6: The ranked table and CSV download

```
Fill the "All micro-markets, ranked by jobs per seeker" card.

- Note under the heading (12 px muted): "Click a row to open it on the map. Markets with fewer than 30 seekers are marked thin."
- Table columns:
  - Market
  - Seekers
  - Demand: header "Postings" or "Openings", with ", last 180 days" added when age is recent
  - Per 100 seekers: 1 decimal, with a 90 px in-cell bar in #2B8FA6 scaled to the highest market in the view, no bar for Rest of district
  - Times district rate: 1 decimal
  - Call: coloured dot and callLabel()
- Row order comes from computeDistrict().markets (already sorted, Rest of district last).
- Numbers right aligned with tabular figures. Market and Call left aligned. Rest of district rows in muted text.
- Clicking a row (or Enter on a focused row) selects that market and smooth-scrolls up to the map. Clicking the selected row clears it. The selected row is tinted #2B8FA6 at 14%, hover at 7%.
- On phones the table scrolls sideways inside its card. The page itself never scrolls sideways.
- Above the table on the right: a small "Download table as CSV" button. It exports exactly the visible columns and rows, named micro-markets_{district}_{measure}_{age}.csv.
```

---

## Prompt 7: "What this map can't see"

```
Fill the "What this map can't see" card with plain sentences built from coverage.csv and computeDistrict() for the current district. Numbers are in semibold.

- "Seekers: {usable} of {total_live} live profiles ({usable_pct}%) have a real location inside the district. {default_point} sit on the default pin and {outside_district} are pinned outside the district."
- "Jobs: {usable} of {total_live} live postings ({usable_pct}%) can be placed on the map. {no_location} have no location at all, so real demand is higher than shown."
- "Freshness: only {recentShare}% of the postings on this map were posted in the last 180 days. Switch to "Last 180 days" to see the picture without old postings that are still marked live."

Then the method note from the data spec, in 12 px muted, copied exactly.

Formatting: integers with thousands separators, percentages with 1 decimal.
```

Check: Ghaziabad shows 8,096 of 17,297 (46.8%), and 331 of 1,275 (26.0%), and 30.5% freshness.

---

## Prompt 8: Loading, errors and phone layout

```
Polish states and responsiveness.

- Loading: grey rounded skeleton bars in place of numbers and the takeaway. The map card keeps its height so nothing jumps.
- If a file fails to load: show one centred muted line "Failed to load" with a small #C2410C dot, in the part of the page that needs it (map, table, gaps or panel). Never show wrong or blank numbers, and no technical error text on screen. Log the real error to the console.
- If cells.csv is missing: pins toggle disabled with "Pins need cells.csv", the pile warning hidden, everything else works.
- Phone (375 px):
  - Controls wrap.
  - The map is 420 px tall.
  - The panel sits under the map.
  - The seesaw scales to the width.
  - The table scrolls inside its card.
- Keyboard: every control and table row reachable with Tab, a visible 2 px #2B8FA6 focus ring, Esc clears the selected market.
- Search the whole app for em dashes and en dashes in any user-facing text and replace them with hyphens, commas or full stops.
```

---

## Prompt 9: Final check against the expected numbers

Attach `07_expected_results.md` to this message.

```
Here is a file of expected results. Go through all 8 combinations (2 districts x 2 demand measures x 2 posting ages) and compare the app's takeaway and ranked table with the file, row by row. Fix any difference in how values are read, rounded or sorted, but do not change the formulas in src/lib/logic.ts. Then list what you checked and anything that still differs.
```

---

## Fix prompts you might need

- **Labels overlap:** "Labels are overlapping in central Ghaziabad. Keep the placement order below, above, right, left, and skip a label rather than overlap, unless the market is selected."
- **Zones leak outside the outline:** "Zones are spilling outside the district outline. Intersect each zone with the district polygon after the circle step, using turf.intersect, and drop any empty result."
- **Numbers differ:** "Ghaziabad City shows X but should show 10.1 per 100 seekers. Make sure the rate uses computeDistrict() from src/lib/logic.ts and that CSV values are numbers, not text."
- **Wrong district fit:** "When I switch to Hubli-Dharwad the map stays on Ghaziabad. Refit the map bounds to the selected district's outline every time the district changes."
