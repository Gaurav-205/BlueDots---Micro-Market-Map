# Expected results: check the app against these

Made by running `06_logic.ts` on the snapshot in `data/` (pulled 2 Nov 2026). If you refresh the data, these numbers will change; re-run the same logic to get new ones.

Corrected 2026-11-04: the two "Openings, Last 180 days" sections originally showed 0 openings everywhere. markets.csv had Windows line endings, so the last column (openings_recent) was read as missing. Those two sections were regenerated with the same logic on the same snapshot (values confirmed against the database); the other six are unchanged.

How to use: after each Lovable prompt, set the controls to each combination below and compare the takeaway and the ranked table. Any mismatch is a bug.

Pile warning (needs cells.csv from 2 Nov 2026). These markets have 40% or more of their seekers on one cell, so they should show the warning:

- Ghaziabad: Meerut Road 60.9%, Muradnagar 50.7%.
- Hubli-Dharwad: Navalgund 96.4%, Annigeri 87.3%, Alnavar 80.6%, Kundgol 76.1%, Dharwad City 73.7%, Hubballi City 66.9%, Kalghatgi 62.4%, Navanagar to Rayapur 55.7%, Gokul Road and Airport 41.7%.

Every other market should not show it. Many Hubli-Dharwad seekers sit on single spots, which is consistent with sign-up camps rather than home locations.

Location coverage (same in every view):

| District | Kind | Live | Placed on map | Placed % | Default pin | Outside district | No location |
|---|---|---:|---:|---:|---:|---:|---:|
| Ghaziabad | Seekers | 17,297 | 8,096 | 46.8% | 6,854 | 2,268 | 79 |
| Ghaziabad | Job postings | 1,275 | 331 | 26.0% | 1 | 158 | 785 |
| Hubli-Dharwad | Seekers | 21,932 | 6,520 | 29.7% | 2,542 | 11,427 | 1,443 |
| Hubli-Dharwad | Job postings | 2,435 | 956 | 39.3% | 9 | 188 | 1,282 |

### Ghaziabad, Job postings, All live

District rate: **4.1** per 100 seekers (331 postings / 8,096 seekers). Postings from the last 180 days: 30.5%.

Takeaway: "Ghaziabad City has the most job postings per seeker: 10.1 per 100 seekers, against 4.1 across the district. The biggest supply pocket is Muradnagar, with 1,425 seekers and only 15 job postings."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Ghaziabad City | 1,268 | 128 | 10.1 | 2.5 | Demand hotspot |
| Indirapuram and Vaishali | 199 | 18 | 9.0 | 2.2 | Demand hotspot |
| Raj Nagar Extension | 378 | 34 | 9.0 | 2.2 | Demand hotspot |
| Sahibabad Industrial | 644 | 38 | 5.9 | 1.4 | Near the district rate |
| Loni and Tronica City | 874 | 39 | 4.5 | 1.1 | Near the district rate |
| Vijay Nagar and NH-9 | 556 | 24 | 4.3 | 1.1 | Near the district rate |
| Dasna and Masuri | 452 | 13 | 2.9 | 0.7 | Near the district rate |
| Meerut Road | 754 | 20 | 2.7 | 0.6 | Near the district rate |
| Muradnagar | 1,425 | 15 | 1.1 | 0.3 | Supply pocket |
| Modinagar | 991 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 555 | 2 | 0.4 | 0.1 | Rest of district |

### Ghaziabad, Job postings, Last 180 days

District rate: **1.2** per 100 seekers (101 postings / 8,096 seekers). Postings from the last 180 days: 30.5%.

Takeaway: "Indirapuram and Vaishali has the most job postings from the last 180 days per seeker: 5.5 per 100 seekers, against 1.2 across the district. The biggest supply pocket is Muradnagar, with 1,425 seekers and only 4 job postings from the last 180 days."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Indirapuram and Vaishali | 199 | 11 | 5.5 | 4.6 | Demand hotspot |
| Ghaziabad City | 1,268 | 39 | 3.1 | 2.6 | Demand hotspot |
| Sahibabad Industrial | 644 | 14 | 2.2 | 1.8 | Near the district rate |
| Meerut Road | 754 | 14 | 1.9 | 1.5 | Near the district rate |
| Raj Nagar Extension | 378 | 6 | 1.6 | 1.3 | Near the district rate |
| Loni and Tronica City | 874 | 9 | 1.0 | 0.9 | Near the district rate |
| Dasna and Masuri | 452 | 2 | 0.4 | 0.4 | Supply pocket |
| Vijay Nagar and NH-9 | 556 | 2 | 0.4 | 0.3 | Supply pocket |
| Muradnagar | 1,425 | 4 | 0.3 | 0.2 | Supply pocket |
| Modinagar | 991 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 555 | 0 | 0.0 | 0.0 | Rest of district |

### Ghaziabad, Openings, All live

District rate: **41.9** per 100 seekers (3,389 openings / 8,096 seekers). Postings from the last 180 days: 30.5%.

Takeaway: "Raj Nagar Extension has the most openings per seeker: 340.5 per 100 seekers, against 41.9 across the district. The biggest supply pocket is Muradnagar, with 1,425 seekers and only 113 openings."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Raj Nagar Extension | 378 | 1,287 | 340.5 | 8.1 | Demand hotspot |
| Indirapuram and Vaishali | 199 | 232 | 116.6 | 2.8 | Demand hotspot |
| Ghaziabad City | 1,268 | 1,067 | 84.1 | 2.0 | Demand hotspot |
| Dasna and Masuri | 452 | 193 | 42.7 | 1.0 | Near the district rate |
| Sahibabad Industrial | 644 | 203 | 31.5 | 0.8 | Near the district rate |
| Vijay Nagar and NH-9 | 556 | 84 | 15.1 | 0.4 | Supply pocket |
| Meerut Road | 754 | 101 | 13.4 | 0.3 | Supply pocket |
| Loni and Tronica City | 874 | 98 | 11.2 | 0.3 | Supply pocket |
| Muradnagar | 1,425 | 113 | 7.9 | 0.2 | Supply pocket |
| Modinagar | 991 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 555 | 11 | 2.0 | 0.0 | Rest of district |

### Ghaziabad, Openings, Last 180 days

District rate: **7.3** per 100 seekers (592 openings / 8,096 seekers). Postings from the last 180 days: 30.5%.

Takeaway: "Indirapuram and Vaishali has the most openings from the last 180 days per seeker: 49.2 per 100 seekers, against 7.3 across the district. The biggest supply pocket is Muradnagar, with 1,425 seekers and only 27 openings from the last 180 days."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Indirapuram and Vaishali | 199 | 98 | 49.2 | 6.7 | Demand hotspot |
| Sahibabad Industrial | 644 | 134 | 20.8 | 2.9 | Demand hotspot |
| Raj Nagar Extension | 378 | 74 | 19.6 | 2.7 | Demand hotspot |
| Ghaziabad City | 1,268 | 158 | 12.5 | 1.7 | Near the district rate |
| Dasna and Masuri | 452 | 41 | 9.1 | 1.2 | Near the district rate |
| Meerut Road | 754 | 31 | 4.1 | 0.6 | Near the district rate |
| Vijay Nagar and NH-9 | 556 | 13 | 2.3 | 0.3 | Supply pocket |
| Muradnagar | 1,425 | 27 | 1.9 | 0.3 | Supply pocket |
| Loni and Tronica City | 874 | 16 | 1.8 | 0.3 | Supply pocket |
| Modinagar | 991 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 555 | 0 | 0.0 | 0.0 | Rest of district |

### Hubli-Dharwad, Job postings, All live

District rate: **14.7** per 100 seekers (956 postings / 6,520 seekers). Postings from the last 180 days: 7.9%.

Takeaway: "Gokul Road and Airport has the most job postings per seeker: 130.0 per 100 seekers, against 14.7 across the district. The biggest supply pocket is Dharwad City, with 2,038 seekers and only 68 job postings."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Gokul Road and Airport | 60 | 78 | 130.0 | 8.8 | Demand hotspot |
| Belur and Mummigatti | 110 | 109 | 99.1 | 6.7 | Demand hotspot |
| Navanagar to Rayapur | 79 | 51 | 64.6 | 4.4 | Demand hotspot |
| Hubballi City | 2,710 | 639 | 23.6 | 1.6 | Near the district rate |
| Dharwad City | 2,038 | 68 | 3.3 | 0.2 | Supply pocket |
| Navalgund | 334 | 1 | 0.3 | 0.0 | Supply pocket |
| Kalghatgi | 417 | 0 | 0.0 | 0.0 | Supply pocket |
| Kundgol | 284 | 0 | 0.0 | 0.0 | Supply pocket |
| Annigeri | 79 | 0 | 0.0 | 0.0 | Supply pocket |
| Alnavar | 67 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 342 | 10 | 2.9 | 0.2 | Rest of district |

### Hubli-Dharwad, Job postings, Last 180 days

District rate: **1.2** per 100 seekers (76 postings / 6,520 seekers). Postings from the last 180 days: 7.9%.

Takeaway: "Gokul Road and Airport has the most job postings from the last 180 days per seeker: 21.7 per 100 seekers, against 1.2 across the district. The biggest supply pocket is Kalghatgi, with 417 seekers and only 0 job postings from the last 180 days."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Gokul Road and Airport | 60 | 13 | 21.7 | 18.1 | Demand hotspot |
| Belur and Mummigatti | 110 | 5 | 4.5 | 3.8 | Demand hotspot |
| Navanagar to Rayapur | 79 | 3 | 3.8 | 3.2 | Demand hotspot |
| Hubballi City | 2,710 | 35 | 1.3 | 1.1 | Near the district rate |
| Dharwad City | 2,038 | 20 | 1.0 | 0.8 | Near the district rate |
| Kalghatgi | 417 | 0 | 0.0 | 0.0 | Supply pocket |
| Navalgund | 334 | 0 | 0.0 | 0.0 | Supply pocket |
| Kundgol | 284 | 0 | 0.0 | 0.0 | Supply pocket |
| Annigeri | 79 | 0 | 0.0 | 0.0 | Supply pocket |
| Alnavar | 67 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 342 | 0 | 0.0 | 0.0 | Rest of district |

### Hubli-Dharwad, Openings, All live

District rate: **96.6** per 100 seekers (6,297 openings / 6,520 seekers). Postings from the last 180 days: 7.9%.

Takeaway: "Belur and Mummigatti has the most openings per seeker: 731.8 per 100 seekers, against 96.6 across the district. The biggest supply pocket is Dharwad City, with 2,038 seekers and only 474 openings."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Belur and Mummigatti | 110 | 805 | 731.8 | 7.6 | Demand hotspot |
| Gokul Road and Airport | 60 | 408 | 680.0 | 7.0 | Demand hotspot |
| Navanagar to Rayapur | 79 | 372 | 470.9 | 4.9 | Demand hotspot |
| Hubballi City | 2,710 | 3,990 | 147.2 | 1.5 | Near the district rate |
| Dharwad City | 2,038 | 474 | 23.3 | 0.2 | Supply pocket |
| Navalgund | 334 | 1 | 0.3 | 0.0 | Supply pocket |
| Kalghatgi | 417 | 0 | 0.0 | 0.0 | Supply pocket |
| Kundgol | 284 | 0 | 0.0 | 0.0 | Supply pocket |
| Annigeri | 79 | 0 | 0.0 | 0.0 | Supply pocket |
| Alnavar | 67 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 342 | 247 | 72.2 | 0.7 | Rest of district |

### Hubli-Dharwad, Openings, Last 180 days

District rate: **7.2** per 100 seekers (467 openings / 6,520 seekers). Postings from the last 180 days: 7.9%.

Takeaway: "Gokul Road and Airport has the most openings from the last 180 days per seeker: 133.3 per 100 seekers, against 7.2 across the district. The biggest supply pocket is Kalghatgi, with 417 seekers and only 0 openings from the last 180 days."

| Market | Seekers | Demand | Per 100 seekers | Times district rate | Call |
|---|---:|---:|---:|---:|---|
| Gokul Road and Airport | 60 | 80 | 133.3 | 18.5 | Demand hotspot |
| Belur and Mummigatti | 110 | 24 | 21.8 | 3.0 | Demand hotspot |
| Navanagar to Rayapur | 79 | 11 | 13.9 | 1.9 | Near the district rate |
| Hubballi City | 2,710 | 218 | 8.0 | 1.1 | Near the district rate |
| Dharwad City | 2,038 | 134 | 6.6 | 0.9 | Near the district rate |
| Kalghatgi | 417 | 0 | 0.0 | 0.0 | Supply pocket |
| Navalgund | 334 | 0 | 0.0 | 0.0 | Supply pocket |
| Kundgol | 284 | 0 | 0.0 | 0.0 | Supply pocket |
| Annigeri | 79 | 0 | 0.0 | 0.0 | Supply pocket |
| Alnavar | 67 | 0 | 0.0 | 0.0 | Supply pocket |
| Rest of district | 342 | 0 | 0.0 | 0.0 | Rest of district |
