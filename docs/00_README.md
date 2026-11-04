# Blue Dots Micro-Market Map: app build kit

This kit has everything needed to build the micro-market map as its own web app in Lovable. The app shows where Blue Dots has job seekers and where it has jobs, in 10 micro-markets each for Ghaziabad and Hubli-Dharwad, so the team can decide where to send people and where to bring employers.

Data snapshot: live Blue Dots records pulled from campaign-manager on 2 Nov 2026. All numbers are aggregated counts. There are no names, phone numbers or other personal details anywhere in this kit.

## What's in the kit

| File | What it is | When you use it |
|---|---|---|
| `01_PRD.md` | What we're building, for whom, the features, and how we know it's done | Read first, share with Adarsh and Parth |
| `02_design.md` | Colours, type, layout, map styling, copy rules | Paste into Lovable project knowledge |
| `03_user_flows.md` | Step by step journeys and every screen state | Check the build against it |
| `04_data_spec.md` | Every data file and column, every formula, the caveats | Paste into Lovable project knowledge |
| `05_lovable_prompts.md` | 9 prompts to paste into Lovable, in order | The actual build |
| `06_logic.ts` | The exact maths (rates, calls, takeaway) as TypeScript | Upload to Lovable with prompt 1 |
| `07_expected_results.md` | The numbers the app must show, to test it | After each prompt |
| `data/markets.csv` | Seekers, postings and openings per market | Upload with prompt 1 |
| `data/roles.csv` | Top 4 roles asked for in each market | Upload with prompt 1 |
| `data/coverage.csv` | How much data has no usable location | Upload with prompt 1 |
| `data/market_centres.json` | The 20 market centres and their radius | Upload with prompt 1 |
| `data/district_outlines.geojson` | District outlines for the map | Upload with prompt 1 |
| `sql/*.sql` | The 5 read-only queries that made the data (markets, roles, coverage, cells, flows) | To refresh the data |

## Order of work

1. Read `01_PRD.md` and check the 20 market centres in `data/market_centres.json` look right. Move or rename any before building.
2. Export one more file yourself: open the Supabase SQL editor on campaign-manager, run `sql/cells.sql`, and download the result as `cells.csv`. It powers the pins layer (about 700 rows). The app works without it, the pins toggle just stays off.
3. Create a new Lovable project. Paste `02_design.md` and `04_data_spec.md` into the project knowledge.
4. Paste the prompts from `05_lovable_prompts.md` one at a time. After each one, check the result against `07_expected_results.md` before moving on.
5. Keep the project private until Adarsh and Vineela are fine with who can see it (see "Access" in the PRD).

## To refresh the numbers later

Run the four files in `sql/` in the Supabase SQL editor, export each as CSV with the same file name, and replace the files in the app's `public/data/` folder. The app recalculates everything else itself.
