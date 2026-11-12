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
_site/                             # the Pages site, assembled by prototype/site.mjs; ignored, never committed
.github/  .claude/                 # standards from Daily-lesson/alys templates/repo/ (see CLAUDE.md)
CLAUDE.md  SKELETON.md  README.md  CHANGELOG.md
```

## Engine and game modules (`src/`)

| File | Global / exports | What |
|---|---|---|
| `engine.js` | `FieldworksEngine` (classic script, IIFE on `globalThis`) | The fold of the design's §7.3: `validateEvent(s)`, `drop`, `xp`, `level`/`progress`, `evaluate`, `medalsFor`, `siege`, `expedition`, `challenges`, `keeper`, `works`, `hash`. Window-free, clock-free, storage-free; every number from the rules. |
| `castle.js` | `FieldworksCastle` (classic script, IIFE on `globalThis`) | The rework's module (design D34): `pieceFor`, `castleOf`, `castleFrom`, `withPieces` (the castle as a fold over the engine's log); `hordeClock`, `hordeDay`, `hordeOf` (the horde's clock, and its size fixed at the warning); `hordeStart`, `hordeStep`, `keeperHit`, `resolveHorde`, `summary`, `readiness`, `rallyOf` (the fight as one stepping function and the warning's count). Pure; every number from the rules' `castle` and `horde` blocks. |

## Rules files (`rules/`)

| File | What |
|---|---|
| `fieldworks.json` | The owner's instance: rarity, XP and curves, skills, the siege, expeditions, weather, medals, challenges, works, the Keeper's parts, the `castle`, `horde` and `stage` blocks (version 2, the rework), the `save`, `clock`, `onboarding`, `states` and `telemetry` blocks, and the bank (every sentence the game speaks). |

## Sim scripts (`sim/`)

| File | What |
|---|---|
| `economy.mjs` | The economy sim (the paper prototype): replays the last 60 days of real Done history, read for numbers only through the alys board's parser, through the engine and the castle module; per day the pieces laid, the horde's clock, each horde's forecast and fight; writes `REPORT.md`. `node sim/economy.mjs --alys ../alys` (a full-history checkout). |
| `economy.test.mjs` | The sim on an invented fixture: deterministic, private rows are counts, no id or section reaches the report, the five targets are computed, the castle is the module's fold, each horde is warned and fought as its day's castle. |
| `fixture/` | The invented task file and index the test reads (the real grammar, invented ids and words). |
| `REPORT.md` | Generated. Per-week counts, the five targets with a closes-only column, the hordes, the arc, the tuning table. |
| `README.md` | How the sim reads, what it keeps, what it models. |

## Prototype pages (`prototype/`)

| File | What |
|---|---|
| `prototype.src.html` | The prototype's source (version 4, the rework): the pixel renderer, the castle screen and the horde fight, the stages and the Wilds, the save without a map, onboarding, honest states, local telemetry. `/*__ENGINE__*/`, `/*__CASTLE__*/` and `/*__RULES__*/` are the inline markers. |
| `index.html` | Built by `build.mjs`; never edited by hand. Published as a private artifact, and as the Pages site's root through `site.mjs`. |
| `art-sheet.html` | Every sprite the renderers draw and the castle at four sizes, by the prototype's own functions, on a grid; light and dark. |

## Prototype scripts (`prototype/`)

| File | What |
|---|---|
| `build.mjs` | Inlines `src/engine.js`, `src/castle.js` and `rules/fieldworks.json` into `index.html` and `art-sheet.html`. |
| `site.mjs` | Assembles the GitHub Pages site (`node prototype/site.mjs _site`): `index.html` at the root, `art-sheet.html` beside it, `fonts/`, nothing else. On the site's copies only, the document head the artifact host would wrap around the page is added (doctype, `lang`, UTF-8 charset), the Google Fonts link becomes `fonts/fonts.css` and a robots `noindex` meta is added; it refuses a page that would load anything from another origin. Exports `sitePage`, `assemble`, `PAGES`, `FONT_FILES`, `NOINDEX`, `HEAD` for the test. |
| `shots.mjs` | The Playwright walk at 375 × 667: the screenshots in both themes, the art sheet at 2×, the frame-time measurement of two scenes (`shots/perf.json`) and 35 behavioural checks (`shots/checks.json`: the warning, a piece from a close, the horde held on its own, a stage that pays no XP, the save, touch); exits non-zero on a failure or a page error. |

## Self-hosted faces (`prototype/fonts/`)

| File | What |
|---|---|
| `fonts.css` | The two faces as `@font-face` rules pointing at the files beside it. Read only by the Pages site; the committed pages and the private artifact keep their Google Fonts link. |
| `albert-sans-latin.woff2`, `silkscreen-400-latin.woff2`, `silkscreen-700-latin.woff2` | The latin subsets the page uses (Albert Sans is one variable file for 300 and 500). |
| `OFL-AlbertSans.txt`, `OFL-Silkscreen.txt` | Their SIL Open Font License 1.1 texts, published with them. |

## Tests (`tests/`)

| File | What |
|---|---|
| `check.mjs` | The engine against the rules and the design's numbers, the castle module (pieces, the clock, the fight, the forecast, the rally), the rule blocks, the page's pillars read from its source, the inline equality, the Pages site's assembly (what is published, noindex, no other origin, the sweep over it), and the tree-wide wall sweep. |

## CI workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push to `main`, every PR | workflow lint, `node --check`, JSON validity, the two test files |
| `pages.yml` | push to `main` touching `prototype/`, `src/`, `rules/` or the workflow; `workflow_dispatch` (deploys from `main` only) | rebuilds the pages and fails on a diff, assembles `_site/` with `site.mjs`, runs the two test files (the wall sweep then reads `_site/`), uploads and deploys it to GitHub Pages; no schedule, no secret, no alys checkout |
| `actions-budget.yml` | PRs touching `.github/workflows/**` | prices `schedule:` triggers against the 100 min/month cap |
| `code-review-graph.yml` | PRs | posts a knowledge-graph impact review |
| `skeleton-guard.yml` | push to `main`, every PR | this file's coverage guard + the CLAUDE.md reminder |
