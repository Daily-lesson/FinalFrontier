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
embed/                             # the embeddable build for a host app, written by prototype/build.mjs and committed
_site/                             # the Pages site, assembled by prototype/site.mjs; ignored, never committed
.github/  .claude/                 # standards from Daily-lesson/alys templates/repo/ (see CLAUDE.md)
CLAUDE.md  SKELETON.md  README.md  CHANGELOG.md
```

## Engine and game modules (`src/`)

| File | Global / exports | What |
|---|---|---|
| `engine.js` | `FieldworksEngine` (classic script, IIFE on `globalThis`) | The fold of the design's §7.3: `validateEvent(s)`, `drop`, `xp`, `level`/`progress`, `evaluate`, `medalsFor`, `gearOf`, `loadout`, `bounty` (FW2: a drop is gear by its kind of event and grade, the Keeper's loadout over the archive, the day's bounty), `siege`, `expedition`, `challenges`, `keeper`, `works`, `hash`. Window-free, clock-free, storage-free; every number from the rules. |
| `castle.js` | `FieldworksCastle` (classic script, IIFE on `globalThis`) | The rework's module (design D34): `pieceFor`, `castleOf`, `castleFrom`, `withPieces` (the castle as a fold over the engine's log); `hordeClock`, `hordeDay`, `hordeOf` (the horde's clock, and its size fixed at the warning); `hordeStart`, `hordeStep`, `keeperHit`, `resolveHorde`, `summary`, `readiness`, `rallyOf` (the fight as one stepping function and the warning's count). Pure; every number from the rules' `castle` and `horde` blocks. |

## Rules files (`rules/`)

| File | What |
|---|---|
| `fieldworks.json` | The owner's instance (version 3): rarity, XP and curves, skills, the siege, expeditions, weather, medals, challenges, works, the Keeper's parts, the `castle` and `horde` blocks (the rework), the `stage` block (version 3, the feel pass: `keeper`, `moves`, `juice`, `combo`, `enemies` (six kinds, each with the level it comes in at), `shots`, `terrain`, `bosses` (three designs), `upgrades` (a run's picks), `meta` (what lifetime play score opens, for play only), `biomes` (five worlds: palettes, features, life, song), `hard`, `continues`, `checkpoint`, `score`, `paints`), `audio` (the synth's effects and songs as data), `embed`, the `save`, `clock`, `onboarding`, `states` and `telemetry` blocks, and the bank (every sentence the game speaks, the story's fragments among them). |

## Sim scripts (`sim/`)

| File | What |
|---|---|
| `economy.mjs` | The economy sim (the paper prototype): replays the last 60 days of real Done history, read for numbers only through the alys board's parser, through the engine and the castle module; per day the pieces laid, the horde's clock, each horde's forecast and fight; writes `REPORT.md`. `node sim/economy.mjs --alys ../alys` (a full-history checkout). |
| `economy.test.mjs` | The sim on an invented fixture: deterministic, private rows are counts, no id or section reaches the report, the five targets are computed, the castle is the module's fold, each horde is warned and fought as its day's castle. |
| `fixture/` | The invented task file and index the test reads (the real grammar, invented ids and words). |
| `REPORT.md` | Generated. Per-week counts, gear and the bounty (FW2, counts only), the five targets with a closes-only column, the hordes, the arc, the tuning table. |
| `README.md` | How the sim reads, what it keeps, what it models. |

## Prototype pages (`prototype/`)

| File | What |
|---|---|
| `prototype.src.html` | The prototype's shell: the styles, the icon symbols, the phone frame and the DEMO's chrome (the prototype bar, the ribbon, Home), which sits between `<!--demo-->` markers so the embed can leave it out. `/*__GAME__*/`, `/*__ENGINE__*/`, `/*__CASTLE__*/` and `/*__RULES__*/` are the inline markers; the game script itself is `game/*.js`. |
| `index.html` | Built by `build.mjs`; never edited by hand. Published as a private artifact, and as the Pages site's root through `site.mjs`. |
| `art-sheet.html` | Every sprite the renderers draw and the castle at four sizes, by the prototype's own functions, on a grid; light and dark. |

## Game script fragments (`prototype/game/`)

The page's one script, in files. `build.mjs` joins them in name order inside a
single IIFE, so they share one scope: each is top-level statements at a
two-space indent and parses on its own (`node --check`), and a name declared
in one is used in the next. Never a module, never an import.

| File | What |
|---|---|
| `10-core.js` | The flags (`EMBED`, `OUT`, `CALM`), the rules, helpers, the storage keys, the seeded `rng`, local telemetry. Embedded, it builds the page's body first. |
| `20-world.js` | The DEMO's invented data, the state (`S`), the events, the one line that sets the castle (`setState`), the play record (`PLAY0`, `playOf`, lifetime score, `unlocked`), the save and its migrations, the horde's clock and its lines. |
| `25-embed.js` | The embed: the message contract, `readWorld`/`readOrder`/`readPlan` (validation), `applyWorld`, `hostGo`, `embedListen`. |
| `30-audio.js` | The synth: `auUnlock` (first input only), `tone`, `sfx`, `music`, the look-ahead scheduler, `setMute`. |
| `40-pixels.js` | The pixel renderer: sprites (`spr`, `both`, the hit-flash `tint`), the Keeper's frames, the six machines, the worlds (`biomeOf`, `backdrop`, `drawWorld`, `drawAir`), the bitmap face, the castle's drawing. |
| `50-castle.js` | The castle screen: the Keeper on the wall, the horde fight, the sky and the brace while a horde is announced. |
| `60-stage.js` | A stage: the seeded generator (`grow`, `arena`, `cache`), `newStage`, the Keeper's moves and the run's loop (`updateStage`), `award`, `hurt`, `die`, checkpoints, `finishStage`. |
| `62-foes.js` | The six machines' habits (`updateFoes`), `strike`, `kill`, and what they throw (`updateBullets`). |
| `64-boss.js` | The three bosses: `startBoss`, `bossHauler`, `bossEye`, `bossUndertow`, `updateBoss`, `bossDown`, `renderBoss`. |
| `66-upgrades.js` | The run's upgrades: the pool play score has opened, `offerUpgrade` (one of three, the stage's own seeded roll), `takeUpgrade`, `recalc`. |
| `68-stage-render.js` | Drawing a stage and its HUD (`renderStage`); the waypoint card and `survey` (the DEMO's one stand-in; embedded, it asks the host). |
| `70-moment.js` | Evidence shown: `fire`, `moment` (drop card, medal, piece), `closeOrder`, `logLift`, the horde's summary, a run's result. |
| `80-screens.js` | The DOM screens: the game shell and pad, the HUD, the stage list with its switches and the unlock track, the backlog, the Keeper, Home, the order sheet, onboarding. |
| `90-loop.js` | Clicks and keys, the frame loop, the art sheet, `FieldworksDebug` (the walk's window), `boot`. |

## Embed build (`embed/`)

Written by `node prototype/build.mjs`, committed, never edited; `tests/check.mjs`
holds it equal to a rebuild. The faces are not duplicated here: a host copies
`prototype/fonts/` to `fonts/` beside these files.

| File | What |
|---|---|
| `play.html` | A minimal shell: doctype, UTF-8, viewport, `noindex`, its own policy (`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self' blob:`; no `connect-src`, so the page can make no network call), `play.css`, `fonts/fonts.css`, `play.js`. No inline script. |
| `play.js` | One classic script: `globalThis.FIELDWORKS_EMBED = true`, the page's body as a string (built into `document.body` by the script, so a host document that is only the stylesheets and this script works, a `srcdoc` frame included), the rules as a constant, the engine, the castle module and the same game script as the page. It never reads its own URL. |
| `play.css` | The page's styles. |

Embedded: no prototype bar, no phone frame, no host chrome; a Close button; the
DEMO world is never used; the device keeps play only (`fieldworks-embed-play`,
`fieldworks-embed-onboarded`). The contract (a message is accepted only when
`ev.source === window.parent && ev.origin === self.origin`; posts go to
`self.origin`):

- play → host `{fw:1, type:'ready'}` on load; `{fw:1, type:'go', to:'workorders'|'learning'|'health'|'close'}` from the buttons that fake evidence in the DEMO, and from Close.
- host → play `{fw:1, type:'world', today, theme, events, open, plan, horde, lanes, briefing?, bounty?}`: `today` `YYYY-MM-DD`; `theme` `'light'|'dark'` (or absent); `events` the engine's events (all must pass `validateEvents`); `open` orders as `E.siege` takes them (`id`, `written`, `tier`, and optionally `pn`, `options`, `steps` as counts, `zone`, `band`; a private order with a name field is refused, and no title is ever kept); `plan` `{weeks:[{n, lessons:[id]}]}` or null; `horde` the page's own `S.horde` shape or null; `lanes` `{workorders, learning, body}` booleans; `briefing` carried for a later phase and ignored. Anything malformed and the whole message is ignored and the game says it could not read your work. A world that arrives during a run waits for the castle. **`bounty` (optional, FW2):** `{day, id}`, the host's pick of today's bounty; **`bounties` (optional):** `[{day, id}]`, every day's pick the host holds (without host data embedded no bonus is computed) (a public open order, by `E.bounty`'s rule: oldest, then highest Pn, then quickest). The fold adds `rules.bounty.score_bonus` to the drop of a close of that order on that day. Absent or malformed it is ignored (never a reason to refuse the world) and the game picks for display only; only the host's pick enters the fold, and nothing of it is stored. Every message before FW2 is still valid.

## Prototype scripts (`prototype/`)

| File | What |
|---|---|
| `build.mjs` | Joins `game/*.js` (name order, one IIFE) into the shell and inlines `src/engine.js`, `src/castle.js` and `rules/fieldworks.json` → `index.html` and `art-sheet.html`; and writes the embed (`embed/play.html`, `play.js`, `play.css`). Exports `source()` (the page's source with the game joined, which the tests read), `build()`, `gameFiles()`, `EMBED_CSP`. |
| `site.mjs` | Assembles the GitHub Pages site (`node prototype/site.mjs _site`): `index.html` at the root, `art-sheet.html` beside it, `version.json`, `fonts/`, nothing else. On the site's copies only, the document head the artifact host would wrap around the page is added (doctype, `lang`, UTF-8 charset), the Google Fonts link becomes `fonts/fonts.css` and a robots `noindex` meta is added; the game page alone also gets the signed-out flag (`globalThis.FIELDWORKS_SIGNED_OUT`), so the public game starts empty; it refuses a page that would load anything from another origin. The build stamp (the site-version/1 standard, the design repo's `docs/SITE_VERSION.md`): `version.json` is `{schema, app, version, commit, date}`, the version from `rules.game.version` and the commit from the deploy (`GITHUB_SHA`, else `git rev-parse HEAD`, else `null`), checked as 40 lowercase hex, `date` that commit's UTC committer date from git (`YYYY.MM.DD`, else `null`), with no build time; the game page alone gets a static badge in the page's bottom padding, `v<date> · <commit7>`, the commit alone, or `dev`, and one inline line setting a frozen `window.SITE_VERSION` whose `text` is the badge's words. Exports `sitePage`, `assemble`, `PAGES`, `FONT_FILES`, `NOINDEX`, `HEAD`, `SIGNED_OUT`, and `VERSION_FILE`, `APP`, `cleanCommit`, `siteCommit`, `cleanDate`, `siteDate`, `versionScript`, `siteVersion`, `versionInfo`, `badgeText`, `badge` for the test. |
| `shots.mjs` | The Playwright walk at 375 × 667: the screenshots in both themes (the castle, the horde, the stages, an upgrade pick, a secret, a boss, each world), the art sheet at 2×, the frame-time measurement of three scenes (`shots/perf.json`: a horde, a stage, a boss fight) and 94 behavioural checks (`shots/checks.json`: the warning, a piece from a close, the horde held on its own, no sound before an input, the dash, the charged shot, the jump, a checkpoint's pick, a secret, a boss and its second phase, a stage that pays no XP, what play score opens, hard mode and a death that keeps every unlock, the save, touch, reduced motion, a moving platform, the restarts, the Wilds' bosses, six machines and three bosses over the weeks, a long play record); exits non-zero on a failure or a page error. It clears `shots/` first, so no screenshot of an older game is left. The embed section serves `embed/` from a local server inside a tiny host page (an `iframe src` and an `iframe srcdoc`), posts an invented world and checks the message contract, the castle from the posted events, the `go` buttons, the queue during a run, what is stored, and that no request leaves the frame (`shots/embed-*.png`). The signed-out section assembles the site with `site.mjs` and checks the public game page: an empty castle, no horde, no account chrome, the Wilds only, and an earlier DEMO save replaying nothing but play (`shots/signed-out-*.png`). |

## Self-hosted faces (`prototype/fonts/`)

| File | What |
|---|---|
| `fonts.css` | The two faces as `@font-face` rules pointing at the files beside it. Read only by the Pages site; the committed pages and the private artifact keep their Google Fonts link. |
| `albert-sans-latin.woff2`, `silkscreen-400-latin.woff2`, `silkscreen-700-latin.woff2` | The latin subsets the page uses (Albert Sans is one variable file for 300 and 500). |
| `OFL-AlbertSans.txt`, `OFL-Silkscreen.txt` | Their SIL Open Font License 1.1 texts, published with them. |

## Tests (`tests/`)

| File | What |
|---|---|
| `check.mjs` | The engine against the rules and the design's numbers, the castle module (pieces, the clock, the fight, the forecast, the rally), the rule blocks (version 3's too: moves, machines, bosses, upgrades, the unlock track, worlds, audio), the page's pillars read from its joined source (`PLAY_FNS`: nothing a run does touches the evidence; play score opens only things for play; no allocation per frame), the built files equal to a rebuild (the two pages and `embed/`), the embed (no inline script, its policy, no other host, no URL read, the message guards, the world's intake run against the real engine), the Pages site's assembly and its build stamp (`version.json`, the badge, a commit that is not a commit refused), and the tree-wide wall sweep. |

## CI workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push to `main`, every PR | workflow lint, `node --check`, JSON validity, the two test files |
| `pages.yml` | push to `main` touching `prototype/`, `src/`, `rules/` or the workflow; `workflow_dispatch` (deploys from `main` only) | rebuilds the pages and fails on a diff, assembles `_site/` with `site.mjs` (which stamps the run's commit into `version.json` and the badge), runs the two test files (the wall sweep then reads `_site/`), uploads and deploys it to GitHub Pages; no schedule, no secret, no alys checkout |
| `actions-budget.yml` | PRs touching `.github/workflows/**` | prices `schedule:` triggers against the 100 min/month cap |
| `code-review-graph.yml` | PRs | posts a knowledge-graph impact review |
| `skeleton-guard.yml` | push to `main`, every PR | this file's coverage guard + the CLAUDE.md reminder |
