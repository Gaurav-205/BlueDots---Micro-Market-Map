# Match score v2

Fitted 2026-11-04 on the Blue Dots database (campaign-manager). Replaces the hand-set 0–10 rule in `seeker_job_matches`
(one run on 5 Oct 2026 covering 114 jobs).

## What it scores

A seeker and a job in the same state. The score (0–100) is how strongly the pair looks like the applications seekers
actually made. It ranks **relevance**: who is likely to want this job. It does **not** predict who gets hired
(see "Acceptance" below).

## How it was fitted

- **Positives:** every `apply` action in `bluedot_item_actions` that was not cancelled: 7,163 applications (KA and UP).
- **Controls:** for each application, the same job paired with 3 pseudo-random seekers from the same state: 21,969 pairs.
- **Features** (computed in SQL, only grouped counts leave the database): straight-line distance band, whether seeker and
  job are in the same kind of work (role families from `sql/families.sql`), whether the job's role name appears in the
  seeker's trade or wanted roles, whether the seeker wants the job's type (full-time, apprenticeship, ...), and
  experience fit (job wants "Worked before").
- **Model:** logistic regression with a light ridge penalty, fitted by `scripts/fit_match.py` on the output of
  `sql/match_training.sql`. Pure Python, no packages.

## Weights (log-odds, reference level in brackets)

| Feature | Level | Weight |
|---|---|---:|
| Intercept | | −1.353 |
| Distance (over 20 km) | 0–2 km | +1.186 |
| | 2–5 km | +0.926 |
| | 5–10 km | +0.672 |
| | 10–20 km | +0.835 |
| | unknown (default pin) | −0.833 |
| Kind of work (different) | same | +1.024 |
| | unknown (no trade on one side) | −0.645 |
| Exact role named (no) | yes | +1.437 |
| | job has no role | +0.784 |
| Job type wanted (no) | yes | +0.660 |
| | not stated | −0.035 |
| Experience (neutral) | job wants experience, seeker has it | +1.062 |
| | job wants experience, seeker is a fresher | −0.788 |
| State (UP) | KA | −0.170 (fit only; not used in the score) |

Score = round(100 / (1 + e^−(intercept + weights))). Because controls were sampled 3 to 1, the number is a ranking
signal, not a calibrated probability.

## How good is it

- AUC 0.78 in-sample (applications vs controls).
- Fitted on one state and tested on the other: KA→UP 0.760, UP→KA 0.745, so it is not just memorising one district.
- Raw rates behind it: pairs with the same kind of work were real applications 68% of the time vs 22% for different
  kinds; an exact role name 69% vs 18%; under 2 km 48% vs 23% beyond 20 km; seekers on the default pin 11%.
- Spot check: for a live Electrician job in Hubballi it scored 21,932 KA seekers; the top 50 are all electricians
  (exact role), on average 1.7 km away, scores 88–91.

## Acceptance

The same features barely explain who is accepted (AUC 0.68, driven mostly by the state: KA accepts far more).
Acceptances are concentrated in a few employers (e.g. Tata Marcopolo via Yashaswi Academy: 118 applications,
111 accepted). Acceptance is an employer-side process, so the score should be used to decide **whom to tell about a
job**, not to promise a hire.

## How to use it

`sql/match_score.sql` is read-only. Put a job's `item_id` in `params` to list its 50 best-matching live seekers, or set
`seeker_id` to list the best jobs for one seeker. It returns item ids, score, distance and the matching features, never
names or phone numbers; look people up in the Blue Dots admin. Typical use: build the call list for a KKB campaign
for a hard-to-fill job.

The public map does not show individual matches, only counts per market (see `public/data/pool.csv`).

## Refit

1. Run `sql/match_training.sql`, export the result as JSON (`counts.json`).
2. `python3 scripts/fit_match.py counts.json` prints new weights and AUC.
3. Copy the weights into `sql/match_score.sql` and this file.

## Known limits

- Role families come from keyword rules; a seeker who names several trades counts under the first matching rule.
- Over half of live jobs have no role, which caps how well any score can do. Making role required on the job form is
  the single biggest improvement.
- Distance is straight-line between pins; seeker pins can be a sign-up camp rather than home.
