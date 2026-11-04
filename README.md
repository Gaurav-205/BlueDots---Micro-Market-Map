# Blue Dots micro-market map

Internal, read-only map of job seekers vs job postings across 10 micro-markets each in Ghaziabad and Hubli-Dharwad. Built from the app kit in `docs/` (PRD, design, data spec, expected results, SQL).

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # verifies src/lib/logic.ts on public/data against docs/07_expected_results.md (all 8 views)
npm run build    # static site in dist/
```

- Data: `public/data/` (snapshot 2 Nov 2026). Refresh by re-running `docs/sql/*.sql` in Supabase and replacing the CSVs with the same names.
- Pins and the pile warning need `public/data/cells.csv`, exported from `docs/sql/cells.sql`. (included, pulled 4 Nov 2026). Without it the pins toggle is disabled.
- "Where seekers applied" and the map arrows need `public/data/flows.csv`, exported from `docs/sql/flows.sql` (included, pulled 4 Nov 2026). Without it that section is hidden.
- Base map is Google Maps (roadmap + satellite toggle). Copy `.env.example` to `.env.local` and set `VITE_GOOGLE_MAPS_API_KEY` (Maps JavaScript API enabled). `VITE_GOOGLE_MAPS_MAP_ID` is optional; it falls back to `DEMO_MAP_ID`. The key ships in the browser bundle, so restrict it by HTTP referrer in Google Cloud.
- View state lives in the URL: `?district=Hubli-Dharwad&measure=openings&age=recent&market=HDW-05`.
- Keep it private: internal Blue Dots data. Don't deploy publicly until Adarsh and Vineela agree.
