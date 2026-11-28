# Changelog — FinalFrontier

Newest first. One entry per merged PR that changes behaviour, a command, a
schema, or a convention. Heading: `## YYYY-MM-DD (PR #N) — <title>` once
merged; `## Unreleased — the frontier: a mid-angle explorer out the gate

FW11, design D66 (rework 2) and D85+ (the merged design in the design repo's
FIELDWORKS.md §19). Stacked on the touch PR.

- `src/frontier.js` (new, `FieldworksFrontier`): the explorer's rules, pure and
  tested in Node. The camera sits about 62° down: the ground is an
  axis-aligned grid running straight up the screen (no isometric diamonds), a
  road reads as ground, tall things rise up the screen and lean a little away
  from the middle so a building shows its roof, its front wall and the side
  facing the middle; characters stand upright. A region grows from a seed:
  the road up the middle, rocks, rubble, ruins, pylons, glowing cracks, ember
  vents, debris and crates (about 600 to 950 props a region, denser the
  deeper). Regions open by the castle's pieces alone (the first is always
  open). A run is one fixed-step function over pools made once.
- `prototype/game/72-frontier.js` (new): the screen. One canvas at its CSS
  size times a whole-number render scale is the scene and the controls: the
  floating stick on the left, Fire, Dash, Bot and Build drawn on the right (Bot
  and Build arrive with the partner robot), hull and power bars, scrap and
  score, a minimap, and the castle from above at the first region's south end.
  Fire aims itself at the nearest machine in front. The way home is the gate,
  or the castle button.
- `prototype/game/80-screens.js`, `90-loop.js`: the stage list opens with a
  Frontier row; the loop runs the frontier; leaving says what the run found.
  The keyboard walks it too (arrows or WASD, J to fire, K to dash).
- `rules/fieldworks.json`: `frontier` (every number) and `bank.frontier`
  (every word); `input.pads.frontier`, `input.overlay_reach`.
- `prototype/build.mjs`: inlines `src/frontier.js` (marker `/*__FRONTIER__*/`)
  in the page, the art sheet and the embed.
- `tests/check.mjs`: the camera's grid, tilt and lean; a region; the gates; a
  run; the module's purity; the frontier's functions held to the pillar and
  per-frame allocation rules. `prototype/shots.mjs`: the frontier section and
  a fourth frame-time scene.

## Unreleased — touch: a floating stick, two thumbs at once, and a page that holds still

FW10, design D67 and D79 (the input rule in the design repo's FIELDWORKS.md).

- `prototype/game/15-input.js` (new): while a game screen is up, one pad canvas
  takes every pointer. A stick appears wherever the left thumb lands and trails
  a thumb that runs past its rim; the right side is drawn Dash, Fire and Jump
  buttons whose hit areas tile that side with no gap, so a thumb that misses a
  button presses the nearest one. Pointers are tracked by id, so one thumb runs
  while the other jumps or fires. A push up on the stick also jumps. Lifting,
  a blur or a screen change lets everything go. Sound still starts only from an
  input (the pad's pointerdown).
- `prototype/game/80-screens.js`, `prototype/prototype.src.html`: the five DOM
  pad buttons are gone; while a game screen is up the page carries
  `html.playing`: `touch-action: none`, no selection, no callout, no tap
  highlight and no overscroll on the game, and on a phone-width screen the game
  fills the screen (safe areas kept), so a quick second tap or a drag no longer
  zooms, scrolls or selects the page. The order sheet and cards keep ordinary
  taps.
- `rules/fieldworks.json`: a new `input` block (stick radius, dead zone, follow,
  thresholds, the two button layouts, the minimum button size, colours) and
  `bank.input` (the button words). The explorer's four-button layout (Fire,
  Dash, Bot, Build) is in the rules already for FW11.
- `prototype/shots.mjs`: the touch section drives the pad canvas: the stick
  runs the Keeper, a second thumb jumps while it runs, lifting lets go, a tap
  between buttons dashes, and a double tap or a drag off the pad moves nothing
  (96 checks).
- `tests/check.mjs`: the sound rule allows the pad's pointerdown as an input.

## Unreleased — <title>` while the PR is open (date it at merge).
Name the files touched and say what a user or operator will notice.

## Unreleased — the Pages site says which build is live

The site-version/1 standard (the design repo's `docs/SITE_VERSION.md`).

- `prototype/site.mjs`: the site now publishes `version.json` beside the game
  page: `{"schema":"site-version/1","app":"final-frontier","version":…,
  "commit":…}`. The version is `rules.game.version`, read from the rules and
  typed nowhere else; the commit is the deploy's own (`GITHUB_SHA`, else `git
  rev-parse HEAD`), kept only when it is 40 lowercase hex, and `null` when the
  build cannot know it. No build time, so one commit assembles one site byte
  for byte. A missing commit never fails the assembly.
- The site's game page (and only that copy) shows the same answer as a small
  static badge, `v<version> · <commit7>`, or `v<version>` alone: low contrast,
  in the page's bottom padding under the game's frame, where it scrolls with
  the page and so never sits over a control; no script, no request, no
  pointer events, hidden from assistive technology and from print. The
  committed pages, the private artifact, the art sheet and `embed/` are
  unchanged; nothing the build emits carries a commit.
- `tests/check.mjs`: the published list gains `version.json`; the "undo the
  edits and the built page comes back" check undoes the badge too; a new test
  holds the file's bytes, the version to the rules, the badge's two forms and
  its markup, and that a value which is not a commit (markup, quotes, upper
  case, 39 characters) reaches neither the file nor the page.
- The shown version is the commit's date (the standard's D6): `version.json`
  gains `date`, the committer date of `commit` in UTC as `YYYY.MM.DD`, read
  from git (never the clock) and checked, else `null`; `version` is unchanged.
  The badge reads `v<date> · <commit7>`, the commit alone with no date, `dev`
  with neither. The game page also sets `window.SITE_VERSION` once, frozen,
  with `text` exactly the badge's words. Tests cover a valid date, malformed
  dates, the three badge forms and the global.
- `.github/workflows/pages.yml`: unchanged. `GITHUB_SHA` is in every step's
  environment by default.

## Unreleased — gear and the bounty (FW2, the FinalFrontier half)

Design: alys `docs/FIELDWORKS.md` §17, D52 and D61. The SocialOS half (the
hero card's bounty line, re-vendoring this build) follows; this repo changes
nothing there.

- `src/engine.js`: `gearOf(item)`, `loadout(items, chosen)` and `bounty(open,
  today)`. A drop is gear by the kind of event that dropped it (close ·
  blaster, task · visor, lesson · boots, lift · plating, decision · core) and
  its grade (power 1 to 5); a sealed drop is gear with no name. The Keeper
  carries the best piece of each slot unless the player chose another or
  none. The bounty is one public open order, oldest first, then the highest
  Pn, then the quickest (a decision counts as one step), then the id; a
  private order is never the bounty. `evaluate` takes an optional
  `ctx.bounties` `[{day, id}]`; a close of that order on that day scores
  `rules.bounty.score_bonus` higher. Items now carry `evKind` and `bounty`.
- `rules/fieldworks.json`: the `gear` and `bounty` blocks, `bank.gear` and
  `bank.bounty`, the journal's unpruned bounty list.
- `prototype/game/`: gear enters a run only through `recalc` (faster fire,
  wider pickup, faster step, longer grace, quicker dash), shows on the Keeper
  as one small mark per slot in its grade's colour (`40-pixels.js`, the stage
  render and the Keeper screen), and is chosen on a Gear card on the Keeper
  screen; the choice IS stored, as a hash in the play save (on the device, embedded too), never an item id. The
  bounty card sits on the backlog screen; the pick is journalled before a
  close so the bonus is never lost on a reload.
- Review fixes: the pick that earned a bonus is never pruned (the DEMO journal
  keeps every day's pick; embedded, the host sends `world.bounties?` `[{day,
  id}]`, every day it holds, beside today's `world.bounty?`, and with no host
  data nothing is computed, so a bonus can never be lost on a reload).
  `E.bounty` takes only `tier === 'public'` orders and counts a non-integer
  `steps`/`options` as one. Embedded with no host pick, the bounty card is
  hidden.
- Embed contract: `world.bounty?` `{day, id}` and `world.bounties?`, optional.
  Every earlier message is still valid; a malformed one is ignored.
- `sim/economy.mjs`: a Gear and the bounty section in the report (counts
  only). The re-run's five target changes come from the live task file having
  moved since the last report, not from FW2 (identical with FW2 stashed).
- `tests/check.mjs`, `prototype/shots.mjs`: the gear table, the bounty order
  and its tie-breaks, the bonus, the pillars on the page and the embed's
  optional field; the walk drives gear and the bounty in the page and the
  frame.

Pillars held: gear exists only because evidence dropped an item; play score
adds none and equipping never changes, moves or removes one; gear's effects
are for play; a sealed piece shows no name.

## Unreleased — a C4 model for the status map

`docs/c4.json` describes FinalFrontier as a C4 model: the player, the game page and the embedded build, the engine, the
builder, the sim and CI, the rules and the on-device save, and how work moves between them. `tests/c4.test.mjs` holds
every fact it states to the repo, and `ci.yml` runs it beside `tests/check.mjs`.

## Unreleased — the embed, after review

- `prototype/game/25-embed.js`: a lane read for the first time is taken as the
  castle as it stood (no drop card for its whole history); a received event
  is rebuilt from the engine's eight fields, so nothing else a host left on
  one is kept.
- `prototype/game/90-loop.js`: in a host frame, Escape with nothing open and
  no run in progress asks the host to close the game.

## Unreleased — the feel pass (phase 1 of the redesign) and an embeddable build

The owner played prototype 4 and found it flat: one robot, flat ground, quiet,
grey. His rulings (2026-11-23): upgrades during a run, bosses and more
machines, feel, secrets; **play powers play** (play score opens things for
play, for good; it still never yields XP, a level, an item or a castle piece,
and nothing is ever lost); short and long sessions; tough but fair, with a
hard-mode switch; sound made in code; a look per world; a light story from the
bank. Later phases (real work orders as bosses, repo worlds, a codex, recall
gates, loot in play) are not built here.

What a player will notice:

- **Moves:** a dash with a moment of invulnerability and a cooldown (a Dash
  button on the pad; Shift or K), a charged shot (hold fire, release), a jump
  as high as the press is long, forgiven a moment after a ledge and buffered a
  moment before landing, and a second jump once play has opened it.
- **Feel:** screen shake, hit flash, a brief hit-stop, particles, a combo that
  raises play score. `prefers-reduced-motion` turns the shake, flash and
  hit-stop off.
- **Six machines**, brought in over the weeks (crawler, hopper, a drone that
  fires, a turret, a shielded warden, a brute that charges), each announcing
  its attack.
- **Bosses:** one at the end of every roadmap stage and every so often in the
  Wilds; three designs in turn (the Hauler, the Kiln Eye, the Undertow), each
  with a bar, a second phase and announced attacks.
- **Run upgrades:** at each checkpoint and after a Wilds boss, one of three
  (eleven in all), for the run; the build is on the HUD.
- **Play powers play:** lifetime play score opens more of the upgrade pool, the
  second jump, a starting pick and four more worlds for the Wilds, besides the
  paints. The stage list shows the track.
- **Terrain and secrets:** ledges at two heights, moving platforms over
  chasms, spikes, vents, and cracked walls with a relic and a line of story
  behind them. Layouts stay seeded.
- **Five worlds** (meadow, canyon, marsh, foundry, frost), each with its own
  sky, ridges, ground, life and weather, across the weeks and the Wilds. The
  castle screen has flags, lit windows and smoke; while a horde is announced
  the sky darkens, the portcullis drops and the flags turn red. The horde
  itself works exactly as before.
- **The Keeper** is larger (14 × 18) with run, jump, fall, dash, hurt, charge
  and blink frames and its tool arm showing.
- **Hard mode** (one heart, faster machines, no restarts, score ×2) and
  **sound** (effects and a looping tune per world, a boss theme, a warning
  theme; WebAudio, no audio file; nothing before the first input) are two
  switches on the stage list, kept in the save.
- A roadmap stage has two restarts from the last checkpoint; the Wilds and
  hard mode have none. A death ends the run and keeps every unlock. A run
  walked away from banks its score.

Files:

- `prototype/game/*.js` (new): the page's script, split into fourteen
  fragments that `build.mjs` joins in name order (`SKELETON.md` lists them).
  `prototype/prototype.src.html` keeps the shell and the styles.
- `prototype/build.mjs`: joins the fragments; exports `source()` and `build()`;
  also writes **`embed/`** (new, committed): `play.html` (its own policy, no
  inline script, no `connect-src`), `play.js` (one classic script that builds
  its own body, so a `srcdoc` host works) and `play.css`. Embedded the game has
  no DEMO chrome and no DEMO world: it posts `ready`, takes a validated `world`
  from its same-origin parent, asks the host to open its own screens where the
  DEMO fakes evidence, runs no horde clock of its own, and keeps play only
  under two keys of its own. The contract is in `SKELETON.md`.
- `rules/fieldworks.json`: **version 3**. New in `stage`: `moves`, `juice`,
  `combo`, `shots`, `terrain`, `bosses`, `upgrades`, `meta`, `biomes`, `hard`,
  `continues`, `checkpoint`, `checkpoints_min`; `enemies` gains `turret` and
  `warden` and a `from` level each; `length_tiles` 150 → 170 and
  `score.par_seconds` 80 → 150 (a stage is longer and ends in a boss). New
  top-level `audio` and `embed`; `castle.draw.sky_darken`. New bank blocks
  `upgrade`, `boss`, `biome`, `meta`, `story`, `sound`, `embed`, and lines in
  `stage`, `castle` and `horde`. Nothing the engine, the castle module or the
  sim reads has changed.
- The save's play record gains `life` (lifetime play score), `mute`, `hard`
  and two counts; an older record starts its lifetime score at its bests.
  Paint now reads the lifetime score.
- `tests/check.mjs`: 58 tests (was 50). The pillars are held over every
  function a run uses (`PLAY_FNS`), the unlock track is checked to open only
  things for play, the built files (pages and `embed/`) must equal a rebuild,
  and the embed's intake is run against the real engine.
- `prototype/shots.mjs`: 86 checks (was 41), a boss-fight frame-time scene, and
  the embed section (a local server, an `iframe src` host and a `srcdoc` one).
  Frame time on the main thread stays about 1 ms.
- `sim/economy.mjs`: its source audit reads `prototype/game/*.js`. **Not
  re-run:** `sim/REPORT.md` is as generated before, so its last section still
  names lines of the old single source file. The next sim run rewrites it.
- `.github/skeleton/skeleton.config.json`: the fragments and `embed/` are in
  the guard. `SKELETON.md`, `CLAUDE.md`, `README.md` updated.

## Unreleased — the public site plays signed out

The first deploy opened on the DEMO world (54 castle pieces, invented orders,
ticked lessons, an announced horde, SocialOS's Home with made-up counts), which
reads as an account to a visitor who has none.

- `prototype/prototype.src.html`: one flag, `globalThis.FIELDWORKS_SIGNED_OUT`.
  Set, the game starts empty (no evidence, orders, lessons, lifts or horde),
  hides what reads an account (the prototype controls, Home, Create, the
  backlog, skills, the archive and the roadmap's weeks), offers the Wilds and
  the Keeper's paint, and its save keeps the play record only, so a device that
  opened the DEMO build replays none of it: of its play record the Wilds score
  alone, and of its telemetry the opens and minutes alone. The account's chrome
  is hidden by CSS before any script runs, and again at start-up. Unset (the committed page, the
  private artifact), nothing changes.
- `prototype/site.mjs`: sets the flag on the site's `index.html` only.
- `rules/fieldworks.json`: three bank lines (`castle.signed_out`,
  `castle.signed_out_short`, `castle.keeper`).
- `prototype/shots.mjs`: a signed-out section (six checks, two screenshots);
  41 checks. `tests/check.mjs`: the flag's reads in the page's source and the
  site test's fourth edit.

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
