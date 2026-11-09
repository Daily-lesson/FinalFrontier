# sim/ — the economy sim (the paper prototype)

```
node sim/economy.mjs --alys ../alys            # writes sim/REPORT.md (fetches the alys main first)
node sim/economy.mjs --alys ../alys --stdout   # prints it instead
node --test sim/economy.test.mjs               # the fixture tests (skip without an alys checkout)
```

Flags: `--ref` (default `origin/main`), `--today` (default the run's UTC date),
`--no-fetch`. The sim refuses to run without `--alys`.

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
learning record). Per day: XP and level, the caches (cells and scrap
by the prototype's one rule: `cache_by_kind` for a lesson, lift or pace,
`cache_by_grade` for a drop otherwise), the open set as it stood that day fed to
`engine.siege`, the blight and the wave, and an expected-value ground model
(pylons the cells buy, half a disc each, ground never taken). Deterministic.

**What it writes.** `REPORT.md`: per-week counts only, never an id, a section or
an order's date; the four GDD targets met or not with their numbers; the arc in
plain words; the tuning table (`tuning.json`, each change re-run); and the lines
in the prototype where cells, scrap or XP change. `guardReport` refuses a report
with a `WO-` token or a section heading of the file.

**Tuning.** Only `rules/fieldworks.json`, never the engine. Add the change to
`tuning.json` (`key`, `before`, `after`, `why`), edit the rules, re-run; the test
holds the two in step.
