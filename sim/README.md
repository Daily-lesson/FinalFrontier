# sim/ — the economy sim (the paper prototype)

```
node sim/economy.mjs --alys ../alys            # writes sim/REPORT.md (fetches the alys main first)
node sim/economy.mjs --alys ../alys --stdout   # prints it instead
node --test sim/economy.test.mjs               # the fixture tests (skip without an alys checkout)
```

Flags: `--ref` (default `origin/main`), `--today` (default the run's UTC date),
`--no-fetch`, `--allow-shallow`. The sim refuses to run without `--alys`, and
refuses a **shallow** alys checkout: a Done row's section history is read from
git, and a short history counts public rows as private (it once reported 90
private rows where the full history gives 26). Run `git -C ../alys fetch
--unshallow origin main` first.

**What it reads.** The owner's task file, at the alys checkout's `--ref`, through
the board's own parser imported from that checkout at run time
(`scripts/tasks/build.mjs` `parseTasks`, `buildModel` once with the run's date for
the open rows' scores and lanes, `score` for a Done row's score at its close, and
`scripts/wo-audit.mjs` `doneDate`). Nothing of the parser or the file is copied
here; the file is found by its shape (`*_Tasks.md`), so this repository never
spells its name. `projects.json` is read at the same ref for the tiers.

**What it keeps.** Per order: the dates (written, done), the Pn, the tier, the
program, the Options and Steps counts, the difficulty, the score and lane. Every
title, step, option and Say line is dropped at the parse. **A private row is a
count**: an open row under the Back Office section or marked private, a Done row
stamped with the private project or marked private, and any row whose program or
project is not public becomes `private-<n>` (an ordinal by date) with its dates
and Pn only. A Done row with neither a project stamp nor a private mark (ticked
before stamping began) is resolved by the sections it sat in across every
version of the file in git history (one `git cat-file --batch`): public only if
every section it ever sat in is public; otherwise, or if it never shows, it is
counted private. The report says how many were ambiguous.

**What it models.** The last 60 days, one fold over the evidence (closes and
decisions from the file; lessons and lifts from a **stated game cadence**: ten
lessons and three lifts a week on an invented spread, not a read of anyone's
learning record). Per day: XP and level; the pieces the evidence lays on the
castle (`src/castle.js` `pieceFor`, the prototype's one rule: by the event's
kind first, else by its drop's grade) and the castle's wall and fire; the open
set as it stood that day fed to `engine.siege`; the horde's clock
(`hordeDay`). When a horde is announced it is sized, once, and the forecast
and the count of tasks that would see the castle hold are computed for it
(`readiness`); when it arrives, the fight with
nobody at the wall (`resolveHorde`), rallied by what landed since the warning.
Every run is made twice: with the stated cadence, and on the real closes
alone. Deterministic.

**What it writes.** `REPORT.md`: per-week counts only, never an id, a section or
an order's date; the five GDD targets met or not with their numbers, beside a
closes-only column; a table of the hordes (warned and arrived as day numbers of
the window, machines, engines, the forecast, tasks to hold, the pieces landed
as a band and never a count, outcome, wall left); the arc in plain words; the tuning table (`tuning.json`,
each change re-run); and the lines in the prototype where evidence enters, where
the castle is derived and where play score changes. `guardReport` refuses a
report with a `WO-` token or a section heading of the file.

**Tuning.** Only `rules/fieldworks.json`, never the engine or the castle module. Add the change to
`tuning.json` (`key`, `before`, `after`, `why`), edit the rules, re-run; the test
holds the two in step.
