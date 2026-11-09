#!/usr/bin/env python3
"""
Scheduled-Actions budget guard.  Byte-identical in every daily-lesson repo.

WHY THIS EXISTS
    On 2026-08-20 the 3,000-minute GitHub Actions quota ran out on the 20th of
    the month.  Cause was not one greedy workflow: it was that six repos each
    made a locally reasonable cadence choice and nobody ever summed them.
    Scheduled jobs alone were costing 2,206 min/month before a single commit.

WHAT IT CHECKS
    Sums this repo's `schedule:` triggers into minutes/month and fails if the
    total exceeds BUDGET_MINUTES.  GitHub bills each JOB rounded UP to a whole
    minute, so a workflow's cost is (fires/month x jobs), NOT its runtime --
    which is exactly why a 3-second curl fired 33x/day cost 1,005 min/month.

WHEN IT RUNS
    Only on pull requests that touch .github/workflows/**.  Costs ~0 minutes in
    steady state and fires precisely when the risk is introduced.

Run locally with:  python3 .github/scripts/actions-budget-check.py
"""
import glob, os, sys

try:
    import yaml
except ImportError:
    print("::warning::pyyaml unavailable - budget guard skipped")
    sys.exit(0)

BUDGET = int(os.environ.get("BUDGET_MINUTES", "100"))
DAYS_PER_MONTH = 30.44
WEEKS_PER_MONTH = 4.345


def expand(field, lo, hi):
    out = set()
    for part in field.split(","):
        step = 1
        if "/" in part:
            part, s = part.split("/")
            step = int(s)
        if part == "*":
            a, b = lo, hi
        elif "-" in part:
            a, b = (int(x) for x in part.split("-"))
        else:
            a = b = int(part)
        out.update(range(a, b + 1, step))
    return sorted(out)


def fires_per_month(expr):
    """Expand a 5-field cron into fires/month. Raises on anything unparseable."""
    mi, h, dom, mon, dow = expr.split()[:5]
    per_day = len(expand(mi, 0, 59)) * len(expand(h, 0, 23))
    if dom != "*" and dow == "*":
        return per_day * len(expand(dom, 1, 31))
    if dow != "*" and dom == "*":
        return per_day * len(expand(dow.replace("7", "0"), 0, 6)) * WEEKS_PER_MONTH
    return per_day * DAYS_PER_MONTH


rows, total, unparsed = [], 0.0, []
for path in sorted(glob.glob(".github/workflows/*.yml") + glob.glob(".github/workflows/*.yaml")):
    try:
        doc = yaml.safe_load(open(path)) or {}
    except Exception as exc:
        print(f"::error file={path}::unparseable workflow: {exc}")
        sys.exit(1)

    # PyYAML resolves a bare `on:` key to the boolean True (YAML 1.1 "Norway
    # problem").  Both spellings must be handled or every workflow reads as
    # having no triggers and the guard silently passes.
    on = doc.get("on", doc.get(True)) or {}
    if isinstance(on, str):
        on = {on: None}
    if isinstance(on, list):
        on = {k: None for k in on}

    schedule = on.get("schedule") or []
    crons = [c["cron"] for c in schedule if isinstance(c, dict) and "cron" in c]
    if not crons:
        continue

    njobs = len(doc.get("jobs") or {})
    for expr in crons:
        try:
            fires = fires_per_month(expr)
        except Exception:
            unparsed.append((path, expr))
            continue
        cost = fires * njobs
        total += cost
        rows.append((path, expr, njobs, round(fires), round(cost)))

rows.sort(key=lambda r: -r[4])
print(f"{'workflow':<44}{'cron':<22}{'jobs':>5}{'fires/mo':>10}{'min/mo':>9}")
for path, expr, njobs, fires, cost in rows:
    print(f"{os.path.basename(path):<44}{expr:<22}{njobs:>5}{fires:>10}{cost:>9}")

total = round(total)
print(f"\nscheduled total: {total} min/month     budget: {BUDGET} min/month")

for path, expr in unparsed:
    # Never silently ignore a cron we could not price -- that is how an
    # unbudgeted job would slip through a guard that still reports green.
    print(f"::error file={path}::could not price cron '{expr}' - add it to the "
          f"ledger by hand (alys/ACTIONS_BUDGET.md) or simplify the expression")
if unparsed:
    sys.exit(1)

if total > BUDGET:
    print(f"::error::scheduled Actions spend {total} min/month exceeds this "
          f"repo's budget of {BUDGET}. GitHub bills each job rounded UP to a "
          f"whole minute, so a short curl on a frequent schedule is expensive. "
          f"If the new job is a pure authenticated HTTP poke, it belongs on "
          f"Supabase pg_cron (zero minutes) -- see alys/ACTIONS_BUDGET.md. "
          f"If it genuinely needs a runner, raise the cap there first so the "
          f"portfolio total stays visible.")
    sys.exit(1)

print("OK: within budget")
