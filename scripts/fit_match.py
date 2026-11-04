"""Fit match-score weights from grouped application counts (docs/sql/match_training.sql).

Two logistic models on the same features:
  apply:  real applications vs control pairs (same job, a pseudo-random seeker from the same state)
  accept: accepted vs not, among real applications
Pure Python (Newton steps on grouped rows), so it runs anywhere: python3 scripts/fit_match.py counts.json
"""
import json
import math
import sys

LEVELS = {  # first level is the reference (weight 0)
    "dist": ["20+", "10-20", "5-10", "2-5", "0-2", "unknown"],
    "fam": ["different", "same", "unknown"],
    "role_exact": ["no", "yes", "unknown"],
    "nature": ["no", "yes", "unknown"],
    "exp": ["neutral", "match", "mismatch"],
    "instance": ["UP", "KA"],
}
NAMES = ["intercept"] + [f"{k}={v}" for k, vs in LEVELS.items() for v in vs[1:]]


def x_of(r):
    return [1.0] + [1.0 if r[k] == v else 0.0 for k, vs in LEVELS.items() for v in vs[1:]]


def solve(a, b):
    """Gaussian elimination with partial pivoting."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c and m[c][c]:
                f = m[r][c] / m[c][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] for i in range(n)]


def fit(rows, ridge=1.0):
    """rows: (x, positives, negatives). Ridge keeps empty cells from blowing up."""
    k = len(NAMES)
    w = [0.0] * k
    for _ in range(50):
        g = [0.0] * k
        h = [[0.0] * k for _ in range(k)]
        for x, pos, neg in rows:
            z = sum(a * b for a, b in zip(w, x))
            p = 1 / (1 + math.exp(-z))
            n = pos + neg
            for i in range(k):
                g[i] += x[i] * (pos - n * p)
                for j in range(k):
                    h[i][j] += x[i] * x[j] * n * p * (1 - p)
        for i in range(1, k):
            g[i] -= ridge * w[i]
            h[i][i] += ridge
        step = solve(h, g)
        w = [a + b for a, b in zip(w, step)]
        if max(abs(s) for s in step) < 1e-8:
            break
    return w


def auc(rows, w):
    """Area under the ROC curve on grouped rows (ties count half)."""
    scored = sorted(((sum(a * b for a, b in zip(w, x)), pos, neg) for x, pos, neg in rows), key=lambda t: t[0])
    tp = sum(p for _, p, _ in scored)
    tn = sum(n for _, _, n in scored)
    seen_neg, total = 0.0, 0.0
    i = 0
    while i < len(scored):
        j, p, n = i, 0, 0
        while j < len(scored) and scored[j][0] == scored[i][0]:
            p += scored[j][1]
            n += scored[j][2]
            j += 1
        total += p * (seen_neg + n / 2)
        seen_neg += n
        i = j
    return total / (tp * tn)


def main(path):
    data = json.load(open(path))
    apply_rows = [(x_of(r), int(r["apps"]), int(r["controls"])) for r in data]
    accept_rows = [(x_of(r), int(r["accepted"]), int(r["apps"]) - int(r["accepted"])) for r in data if int(r["apps"])]
    out = {}
    for name, rows in (("apply", apply_rows), ("accept", accept_rows)):
        w = fit(rows)
        out[name] = {"weights": dict(zip(NAMES, [round(v, 3) for v in w])), "auc": round(auc(rows, w), 3),
                     "positives": sum(p for _, p, _ in rows), "negatives": sum(n for _, _, n in rows)}
    json.dump(out, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main(sys.argv[1])
