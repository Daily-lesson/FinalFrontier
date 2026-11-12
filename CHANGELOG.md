# Changelog — FinalFrontier

Newest first. One entry per merged PR that changes behaviour, a command, a
schema, or a convention. Heading: `## YYYY-MM-DD (PR #N) — <title>` once
merged; `## Unreleased — <title>` while the PR is open (date it at merge).
Name the files touched and say what a user or operator will notice.

## Unreleased — the prototype on GitHub Pages

- `.github/workflows/pages.yml` (new): on a push to `main` touching
  `prototype/`, `src/`, `rules/` or the workflow, or by hand (only `main`
  deploys), rebuilds the two pages and
  fails if the committed ones differ, assembles the site, runs the two test
  files over it and deploys it to https://daily-lesson.github.io/FinalFrontier/.
  Least permissions (the build reads; only the deploy job gets `pages: write`
  and `id-token: write`), one `pages` concurrency group that never cancels a
  deploy, 10-minute timeouts, actions pinned to commit SHAs. No schedule, no
  pull-request trigger, no secret, no alys checkout.
- `prototype/site.mjs` (new): the site is `index.html`, `art-sheet.html` and
  `fonts/`, nothing else. Its copies gain the document head the artifact host
  wraps around the page (a doctype, `lang`, a UTF-8 charset: served bare, the
  page rendered in quirks mode and showed `Â·` for `·`), swap the Google Fonts link for the
  self-hosted `fonts/fonts.css` and add a robots `noindex` meta; it refuses a
  page carrying any URL that names another host. The committed pages and
  the private artifact are unchanged.
- `prototype/fonts/` (new): the latin subsets of Albert Sans and Silkscreen,
  with their OFL 1.1 licences.
- `tests/check.mjs`: one test for the site (what is published, the three
  edits and nothing else, no other origin, the wall sweep over every published text
  file, and the guards refusing what they should).
- Enabling Pages (Settings → Pages → Source: GitHub Actions) is the owner's
  step; until then the deploy job fails and the build job still runs.

## Unreleased — the rework: a castle from evidence, announced hordes, stages out the gate (prototype 4)

The design's ruling D34 replaced the top-down fortress map and the
third-person field with a side-scrolling pixel action game.

- `src/castle.js` (new): the castle as a fold over the engine's evidence log
  (`castleOf`), the horde's clock (`hordeDay`: gathered from the siege's
  count, announced 72 hours ahead, never two inside ten days), and the fight as
  one stepping function (`hordeStep`, `resolveHorde`, `readiness`), so the
  warning's forecast is the fight without the Keeper. A horde is sized once,
  at its warning, so the one forecast is the one that arrives. The engine is
  unchanged.
- `rules/fieldworks.json`: version 2. New blocks `castle`, `horde` and
  `stage` with their bank lines; the `fortress`, `explore` and
  `keeper_effects` blocks are gone, and with them cells and scrap.
- `prototype/`: prototype 4. The castle screen (it defends itself), the
  warning with its countdown and count of tasks, the horde fought live or
  resolved while away, a stage per stated week and the endless Wilds, play
  score that buys paint only (one stand-in, said on its card: a waypoint's
  button ticks the lesson in the DEMO, where the app would open the lesson),
  a save with no map (a prototype 3 save keeps its
  evidence and says so once). Pixels: one canvas about 180 px wide at a
  whole-number scale, every sprite drawn in canvas. `build.mjs` inlines the
  castle module too; `shots.mjs` walks the new loop (35 checks, touch
  included) and measures two scenes.
- `sim/`: the sim follows the castle and the hordes: five targets, a
  closes-only column, each horde's forecast, tasks to hold and outcome (the
  pieces landed in a warning as a band, never a count); six
  rules-only tuning rows (`sim/tuning.json`). It now refuses a shallow design
  checkout, which miscounts private rows.
- `tests/check.mjs`: a test per new rule block and per castle-module
  function, the page's pillars read from its source (one line sets the castle,
  no line carries score into the evidence, the save holds no map, the update
  and render paths allocate nothing per frame, no image asset). The page's
  behaviour is checked by the walk (`prototype/shots.mjs`), which CI does not
  run: run it before a push.
- `docs/PLAYTEST.md`: the Gate 1 form for prototype 4.

## Unreleased — M0: the economy sim, prototype 3, the playtest kit

- `sim/`: the economy sim on the owner's real history (numbers only, through
  the design repo's parser), its report, and seven rules changes it tested
  (`rules/fieldworks.json`; `sim/tuning.json` records each).
- `prototype/`: prototype 3 (the save, the day clock, the parts in play,
  explore content, onboarding, honest states, local telemetry, a performance
  pass), `art-sheet.html`, `shots.mjs` and `shots/`. The page now keeps four
  local keys: `fieldworks-keeper`, `fieldworks-save`, `fieldworks-onboarded`,
  `fieldworks-telemetry`.
- `docs/PLAYTEST.md`: the Gate 1 form.
- `tests/check.mjs`: a test per new rule block, the inline scripts compiled,
  cells and storage audited, every bank line the page reads present.

## 2026-11-09 — repo stamped and seeded

- Created from `Daily-lesson/alys` → `templates/repo/` (stack: vanilla-js,
  ALYS 1.12.0), with six person-naming standard files held back while the
  repository is public (see `CLAUDE.md`).
- Seeded with the game from the design repo: `src/engine.js`,
  `rules/fieldworks.json`, `tests/check.mjs`, `prototype/build.mjs`,
  `prototype/prototype.src.html` → `prototype/index.html` (version 2).
  Numbers, contract and DEMO set unchanged; the check gains a tree-wide wall
  sweep held as hashes.
