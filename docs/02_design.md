# design.md: Blue Dots Micro-Market Map

Paste this whole file into the Lovable project knowledge. Follow it for every screen.

## Feel

A calm field map for a working review, not a flashy dashboard. One bold idea carries the page: the map, where orange means "more seekers than jobs" and blue means "more jobs than seekers". Everything around it stays quiet and readable.

## Colours

| Token | Hex | Use |
|---|---|---|
| `ink` | #1F2933 | Main text |
| `muted` | #6B7280 | Secondary text, seekers half of the split circle |
| `bg` | #F7F8FA | Page background |
| `panel` | #FFFFFF | Cards |
| `line` | #E3E6EA | Borders, table rules, hatching |
| `pocket` | #E8833A | Supply pocket end of the map scale (more seekers than jobs) |
| `mid` | #C9CED6 | Near the district rate |
| `hot` | #2B8FA6 | Demand hotspot end of the map scale, demand half of the split circle, posting pins |
| `pocketText` | #D06A22 | Supply pocket badge and dot text |
| `recFill` | #E8F5E9 | "My recommendation" box fill |
| `recLine` | #2E7D32 | "My recommendation" box left border and label |
| `bad` | #C2410C | The dot in "Failed to load" |

- Zone colour comes from one 3-stop scale: pocket, then mid, then hot.
- Input: t = log2(times the district rate) / 2, clamped to -1 to 1, then mapped to 0 to 1. Treat times the district rate below 0.125 as 0.125.
- Zone fill opacity is 0.62. When a market is selected, every other zone drops to 0.28.
- Thin data zones use `line` as their fill.
- Only use light, pale colours on meaningful things. No dark header bands, no big coloured banners, no gradients except the legend bar.

## Type

- Headings and the market name in the panel: **Source Serif 4**, weight 400.
- Everything else: **Inter**.
- Numbers use tabular figures.
- Sizes:
  - Page title 30 px.
  - Section titles 17 px, weight 500.
  - Body 14 px.
  - Captions and notes 12 px.
  - Map labels 12 px semibold for the market name, 11 px muted for the rate under it.
- Sentence case everywhere. No ALL CAPS labels.

## Layout

Max width 1240 px, centred. Page padding 16 px on phones, 32 px on desktop. Gap between sections 24 px.

```
+--------------------------------------------------------------------+
| Where jobs and job seekers meet: Blue Dots micro-markets           |
| One line on what this is                                           |
|                                                                    |
| District [Ghaziabad|Hubli-Dharwad]  Count demand as [Postings|Openings]
| Postings [All live|Last 180 days]   [x] Show pins                  |
|                                                                    |
| Takeaway sentence, large, two short sentences                      |
|                                                                    |
| +-------------------------------------------+ +------------------+ |
| | Micro-market map                          | | Market panel     | |
| | note line                                 | | (sticky)         | |
| |                                           | | name, localities | |
| |            MAP                            | | badge            | |
| |                                           | | seesaw           | |
| |                                           | | numbers list     | |
| | legend                                    | | My recommendation| |
| +-------------------------------------------+ | roles            | |
|                                               | pile warning     | |
|                                               +------------------+ |
| +----------------------------------------------------------------+ |
| | All micro-markets, ranked by jobs per seeker                   | |
| | table                                                          | |
| +----------------------------------------------------------------+ |
| +----------------------------------------------------------------+ |
| | What this map can't see                                        | |
| +----------------------------------------------------------------+ |
+--------------------------------------------------------------------+
```

- Map card takes the remaining width. The panel is 340 px.
- Below 860 px wide, the panel goes under the map and stops being sticky.
- Cards: white, 1 px `line` border, 10 px radius, 20 px padding, no shadows.

## Components

### Segmented controls
Pill shaped group with a 1 px `line` border. The selected option is filled `ink` with white text. The others are `muted` text on transparent.

### Takeaway
18 px, line height 1.45, max 80 characters per line. Market names and numbers are semibold.

### Map
- Base map: CARTO Positron light tiles (`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`) with their attribution. Fit the map to the district outline with 20 px padding.
- District outline: 1.2 px `muted` stroke, no fill.
- Rest of district: the inside of the outline gets a light diagonal hatch in `line`.
- Zones: each market's zone = (its Voronoi cell) intersected with (a circle of radius_km around its centre) intersected with (the district outline). Stroke 1.5 px white. The selected zone gets a 2.5 px `ink` stroke.
- Split circle at each centre:
  - The left half is seekers, in `muted`. The right half is demand, in `hot`.
  - Both halves use one square-root scale per view: the largest seekers or demand value gets a radius of 28 px.
  - A thin white line divides the halves.
- Labels:
  - Market name, with the rate on a second line ("10.1 per 100").
  - The label has a white halo so it reads over the map.
  - Try placing it under the circle first, then above, then right, then left.
  - Skip a label rather than overlap another, unless that market is selected.
- Pins (when on and `cells.csv` is loaded):
  - Seekers are grey circles at 16% opacity, square-root sized, up to 11 px radius.
  - Postings are `hot` squares at 85% opacity, up to 18 px side.
  - Pins don't capture clicks.
- Tooltip:
  - Small white card, 1 px border, 8 px radius, soft shadow, 12 px text.
  - Lines: name (semibold), call, "1,268 seekers", "128 job postings", "10.1 per 100 seekers".
  - It stays inside the map box.
- Legend under the map:
  - A 160 px gradient bar from pocket to mid to hot, with "Fewer jobs per seeker" on the left and "More jobs per seeker" on the right.
  - A small split circle with "Seekers | demand".
  - A dot and a square with "Pins: seekers, postings".

### Market panel
- Empty state: one muted line, "Pick a zone on the map or a row in the list to see that market's numbers and what I'd propose for it."
- Name: Source Serif 4, 30 px.
- Localities: 12 px muted.
- Call badge: a pill with a coloured dot.
  - Hotspot: `hot`.
  - Pocket: `pocketText`.
  - Others: `muted`.
- Seesaw (the one playful element):
  - A beam on a small triangle.
  - Left end: grey weight labelled "Seekers" and the count. Right end: `hot` weight labelled "Postings" or "Openings" and the count.
  - Tilt = clamp(log2(times the district rate), -2.5, 2.5) x 7 degrees. Positive tips the right (jobs) side down. Treat values under 0.18 as 0.18.
  - Animate the tilt over 400 ms, unless the user prefers reduced motion.
  - Caption under it: "Tips toward jobs, compared with the district" or "Tips toward seekers, compared with the district".
- Numbers: a two-column list (label left in `muted`, value right in semibold), not tiles. Rows:
  - Seekers
  - Live job postings
  - Posted in last 180 days
  - Openings (capped at 50 a posting)
  - Demand per 100 seekers
  - District rate
  - Times the district rate
- "My recommendation": a box with `recFill` background and a 3 px `recLine` left border. The bold label "My recommendation:" is in `recLine`. Text by call:
  - **Demand hotspot:** treat this as a place to send people. Point KKB campaigns from nearby supply pockets at these employers first, and check the postings are still open before we push them.
  - **Supply pocket:** bring employers here. Ask DKB and the local associations for jobs in or near this market, or line these seekers up for the nearest hotspot if travel works for them.
  - **Near the district rate:** keep both sides growing together here. It is not the first place to act.
  - **Thin data:** too few seekers here to judge the rate. Treat it as thin and don't act on this number alone.
  - **Rest of district:** these records sit too far from any market centre to group. If many of them cluster somewhere, that place may deserve its own market.
- Roles:
  - Heading "Roles asked for most here", then a numbered list "Machine Operator (151)".
  - If there are none: "None of the postings here name a role."
- Pile warning (12 px muted): "X% of these seekers sit on a single spot of about 1 km. A pile that big is usually a college or camp where people were signed up, not where they live, so read this market's seeker count with care."

### Ranked table
- Columns:
  - Market
  - Seekers
  - Postings or Openings, with ", last 180 days" added when recent
  - Per 100 seekers (with a 90 px in-cell bar in `hot`)
  - Times district rate
  - Call (dot and text)
- Numbers right aligned. Market and Call left aligned.
- Rows: hover tint `hot` at 7%, selected row `hot` at 14%. "Rest of district" rows in `muted` text with no bar.
- The whole row is clickable and keyboard focusable (Enter selects).
- On phones the table scrolls sideways inside its card. The page never scrolls sideways.

### "What this map can't see"
Plain sentences, numbers in semibold:
- "Seekers: 8,096 of 17,297 live profiles (46.8%) have a real location inside the district. 6,854 sit on the default pin and 2,268 are pinned outside the district."
- "Jobs: 331 of 1,275 live postings (26.0%) can be placed on the map. 785 have no location at all, so real demand is higher than shown."
- "Freshness: only 30.5% of the postings on this map were posted in the last 180 days."
- Then the method note in 12 px muted (text in `04_data_spec.md`).

## States

- **Loading:** grey rounded skeleton bars in place of numbers. The map box keeps its height so nothing jumps.
- **Failed:** centred one-liner with a small `bad` dot and "Failed to load", in muted 12 px. No technical error text on screen.
- **Empty:** if a district has no data, one muted line saying so.

## Copy rules

- Plain, human, first person ("what I'd propose"). No jargon, no hype words.
- Never use em dashes or en dashes. Use a hyphen, comma, colon or full stop.
- Numbers with thousands separators (1,268). Rates with one decimal (10.1). Percentages with one decimal (46.8%).
- Say "consistent with", never "proves", for partial evidence.

## Accessibility

- Visible focus ring: 2 px `hot`, 2 px offset.
- All controls reachable by keyboard. Esc clears the selected market.
- Colour is never the only signal: every call also has a text label.
- Respect reduced motion.
