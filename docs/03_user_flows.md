# User flows: Blue Dots Micro-Market Map

## Flow 1: "Where should we act in Ghaziabad?" (the review flow)

1. Adarsh opens the link.
   - The app loads with Ghaziabad, Job postings, All live, Show pins on, and no market selected.
2. He reads the takeaway line: "Ghaziabad City has the most job postings per seeker: 10.1 per 100 seekers, against 4.1 across the district. The biggest supply pocket is Muradnagar, with 1,425 seekers and only 15 job postings."
3. He looks at the map:
   - Blue zones in the city core.
   - Orange zones in the north (Muradnagar, Modinagar).
4. He hovers Modinagar. The tooltip shows: Supply pocket, 991 seekers, 0 job postings, 0.0 per 100 seekers.
5. He clicks Modinagar. The panel opens with:
   - The seesaw tipped hard toward seekers.
   - The numbers.
   - The "bring employers here" recommendation.
   - "None of the postings here name a role."
6. He clicks Modinagar again, or presses Esc. The panel goes back to its empty line.

## Flow 2: "Is this just old postings?"

1. With Ghaziabad open, the user switches Postings to "Last 180 days".
2. Everything updates:
   - The zone colours.
   - The split circles, whose right halves shrink.
   - The labels.
   - The takeaway.
   - The table column header ("Postings, last 180 days").
   - The panel, if a market is selected.
3. The user compares: Indirapuram and Vaishali becomes the strongest hotspot (5.5 per 100, 4.6 times the district rate). Raj Nagar Extension drops to near the district rate.
4. The user reads "What this map can't see" and sees the freshness line.

## Flow 3: Switching district

1. The user clicks "Hubli-Dharwad".
2. The selected market clears. The map refits to the Dharwad district outline, and every section updates.
3. Takeaway: "Gokul Road and Airport has the most job postings per seeker: 130.0 per 100 seekers, against 14.7 across the district. The biggest supply pocket is Dharwad City, with 2,038 seekers and only 68 job postings."
4. The user clicks Dharwad City in the table.
   - The row highlights and the page scrolls up to the map, with Dharwad City selected.
   - The panel shows the pile warning, because 73.7% of its seekers sit on one spot.

## Flow 4: Postings vs openings

1. The user switches "Count demand as" to "Openings".
2. Labels, circles, table and panel now use openings, capped at 50 per posting.
3. Example: Raj Nagar Extension jumps to 340.5 openings per 100 seekers, because a few postings list many openings each.
   - The app does not hide this.
   - The cap note in the method section explains it.

## Flow 5: Sharing a view

1. The user picks Hubli-Dharwad, Openings, Last 180 days, and selects Belur and Mummigatti.
2. The link in the address bar now carries that view: `?district=Hubli-Dharwad&measure=openings&age=recent&market=HDW-05`.
3. Anyone opening the link sees the same view.

## Flow 6: Taking numbers to a slide

1. The user clicks "Download table as CSV" above the ranked table.
2. They get a file named, for example, `micro-markets_Ghaziabad_postings_all.csv`, with the same columns and order as the table on screen.

## Flow 7: Refreshing the data (Gaurav)

1. Run the 4 files in `sql/` in the Supabase SQL editor on campaign-manager.
2. Export each one as CSV, with the same file names.
3. Replace the files in the app's `public/data/` folder. In Lovable you can ask: "Replace public/data/markets.csv with this file", and so on for each file.
4. Update the "Data as of" date in the header.

## Screen states to build and check

| Where | Loading | Loaded | No data | Failed |
|---|---|---|---|---|
| Takeaway | Skeleton bar | Two sentences | Second sentence hidden if there's no supply pocket | Hidden |
| Map | Empty box with skeleton, fixed height | Zones, circles, labels | "No markets for this district" | "Failed to load" line |
| Pins | Not drawn | Drawn when toggle is on | Toggle disabled with note "Pins need cells.csv" | Toggle disabled |
| Panel | Empty line | Market detail | Empty line | Empty line |
| Roles | Not shown | Numbered list | "None of the postings here name a role." | Hidden |
| Pile warning | Hidden | Shown at 40% or more on one cell, if 30+ seekers | Hidden | Hidden |
| Table | Skeleton rows | Rows | "No markets for this district" | "Failed to load" line |
| Gaps section | Skeleton bars | Sentences | n/a | "Failed to load" line |
