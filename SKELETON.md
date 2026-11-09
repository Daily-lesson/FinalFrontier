# Repo Skeleton (reference)

A grep-able map of what exists in this repo. Maintained by hand;
`.github/skeleton/check.mjs` (run by `skeleton-guard`) fails CI when a file
listed in `.github/skeleton/skeleton.config.json` is missing from this file.
`node .github/skeleton/check.mjs --list` prints the inventory it expects.

Stack: vanilla JS, no build step for the engine, no npm. Node 22 for the
checks and the sim; Playwright (preinstalled in the build sessions) for the
art sheet and the screenshots. **Public repository: public-tier content only.**

## Top-level

```
src/  rules/  sim/  prototype/  tests/  docs/
.github/  .claude/                 # standards from Daily-lesson/alys templates/repo/ (see CLAUDE.md)
CLAUDE.md  SKELETON.md  README.md  CHANGELOG.md
```

## Engine and game modules (`src/`)

| File | Global / exports | What |
|---|---|---|
| `engine.js` | `FieldworksEngine` (classic script, IIFE on `globalThis`) | The fold of the design's §7.3: `validateEvent(s)`, `drop`, `xp`, `level`/`progress`, `evaluate`, `medalsFor`, `siege`, `expedition`, `challenges`, `keeper`, `works`, `hash`. Window-free, clock-free, storage-free; every number from the rules. |

## Rules files (`rules/`)

| File | What |
|---|---|
| `fieldworks.json` | The owner's instance: rarity, XP and curves, skills, the siege, expeditions, weather, medals, challenges, works, the Keeper's parts, the `fortress` and `explore` blocks, the `keeper_effects`, `clock`, `onboarding`, `states` and `telemetry` blocks, and the bank (every sentence the game speaks). |

## Sim scripts (`sim/`)

| File | What |
|---|---|
| `economy.mjs` | The economy sim (the paper prototype): replays the last 60 days of real Done history, read for numbers only through the alys board's parser, through the engine and the fortress rules; writes `REPORT.md`. `node sim/economy.mjs --alys ../alys`. |
| `economy.test.mjs` | The sim on an invented fixture: deterministic, private rows are counts, no id or section reaches the report, the targets are computed. |
| `fixture/` | The invented task file and index the test reads (the real grammar, invented ids and words). |
| `REPORT.md` | Generated. Per-week counts, the four targets, the arc, the tuning table. |
| `README.md` | How the sim reads, what it keeps, what it models. |

## Prototype pages (`prototype/`)

| File | What |
|---|---|
| `prototype.src.html` | The prototype's source (version 3): fortress and explore modes, the save, the day clock, the Keeper's parts in play, explore content, onboarding, honest states, local telemetry. `/*__ENGINE__*/` and `/*__RULES__*/` are the inline markers. |
| `index.html` | Built by `build.mjs`; never edited by hand. Published as a private artifact. |
| `art-sheet.html` | Every sprite the renderers draw, by the prototype's own functions, on a grid; light and dark. |

## Prototype scripts (`prototype/`)

| File | What |
|---|---|
| `build.mjs` | Inlines `src/engine.js` and `rules/fieldworks.json` into `index.html`. |
| `shots.mjs` | The Playwright walk at 375 × 667: the screenshots in both themes, the art sheet at 2×, the frame-time measurement. |

## Tests (`tests/`)

| File | What |
|---|---|
| `check.mjs` | The engine against the rules and the design's numbers, the inline equality, the new rule blocks, and the tree-wide wall sweep. |

## CI workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push to `main`, every PR | workflow lint, `node --check`, JSON validity, the two test files |
| `actions-budget.yml` | PRs touching `.github/workflows/**` | prices `schedule:` triggers against the 100 min/month cap |
| `code-review-graph.yml` | PRs | posts a knowledge-graph impact review |
| `skeleton-guard.yml` | push to `main`, every PR | this file's coverage guard + the CLAUDE.md reminder |
