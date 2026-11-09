# Changelog — FinalFrontier

Newest first. One entry per merged PR that changes behaviour, a command, a
schema, or a convention. Heading: `## YYYY-MM-DD (PR #N) — <title>` once
merged; `## Unreleased — <title>` while the PR is open (date it at merge).
Name the files touched and say what a user or operator will notice.

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
