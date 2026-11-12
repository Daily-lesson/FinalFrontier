# CLAUDE.md — FinalFrontier project map

**Fieldworks**, the game: a castle you build out of the work you actually
finish, and a side-scrolling pixel action game outside its gate. This repo is
its home (design ruling D31): the engine, the castle module, the rules, the
economy sim, the prototype, the tests. There is a grep-able repo map in
**`SKELETON.md`** — read it before spelunking. **Keep both files current** when
you add a module, a sim or a workflow: `skeleton-guard` fails the build on
anything undocumented.

**The shape, in two sentences** (the rework, design ruling D34, 2026-11-10).
*The castle* is the home screen: **one piece per evidence event and nothing
else** (a verified close, a decision, a lesson, a lift, a re-pace) builds it,
it defends itself, and a horde gathered from the aged backlog comes about once
a fortnight, announced three days ahead with a count of finished tasks that
would see it hold. *The stages* are out the gate: the Keeper (a workshop
robot) runs, jumps and shoots through one stage per stated week of the
roadmap, or the endless Wilds, for play score that buys paint and nothing
else.

**The canon is not here.** The design lives in the private design repo,
`Daily-lesson/alys`: `docs/FIELDWORKS.md` (the world, the nine invariants,
every mechanic with its source field, the template and the walls, decisions
D1–D24, D31, and §16 the rework, D34–D35) and
`docs/fieldworks/GAME_DEVELOPMENT.md` (the lifecycle and its gates, the GDD
v2, the tech design, milestones, the playtest plan, proposals D36–D48, D32). A design question is answered there, never here.

---

## Commands

There is **no build step for the engine and no `package.json`**: `src/` and
`rules/` are loaded as classic scripts and JSON; the prototype is one page.

| Task | How |
|---|---|
| Engine, castle module, page pillars + walls check | `node --test tests/check.mjs` |
| Sim tests | `node --test sim/economy.test.mjs` (needs an alys checkout beside this one; skips with the reason otherwise) |
| Both | `node --test tests/check.mjs sim/economy.test.mjs` |
| Economy sim → `sim/REPORT.md` | `node sim/economy.mjs --alys ../alys` (refuses to run without the flag, and on a shallow alys checkout: `git -C ../alys fetch --unshallow origin main` first) |
| Rebuild the prototype | `node prototype/build.mjs` (inlines `src/engine.js`, `src/castle.js` + `rules/fieldworks.json` into `prototype/index.html`) |
| Assemble the Pages site | `node prototype/site.mjs _site` (the game at the root, the art sheet, `fonts/`; nothing else) |
| The walk: shots, checks, frame time, art sheet | `node prototype/shots.mjs` (Playwright; writes `prototype/shots/`; about three minutes) |
| Workflow lint | `node .github/scripts/workflow-lint.mjs` |
| Skeleton guard | `node .github/skeleton/check.mjs` (`--list` prints the inventory) |

**CI** (`.github/workflows/ci.yml`): every push to `main` and every pull
request. Workflow lint, `node --check` over every script, JSON validity,
then the two test files. **CI does not run the walk**, and the walk is what
executes the page's behaviour (the tests read the page as text): run
`node prototype/shots.mjs` before every push that touches the page, the
rules or `src/`.

**Pages** (`.github/workflows/pages.yml`): the prototype as a public site,
https://daily-lesson.github.io/FinalFrontier/. A push to `main` touching
`prototype/`, `src/`, `rules/` or the workflow, or by hand (only `main`
ever deploys); never a schedule, never a PR (a
fork cannot reach it). It fails if the committed pages differ from a
rebuild, assembles `_site/` with `prototype/site.mjs`, runs the two test
files (so the wall sweep reads the published directory), and deploys with
the built-in OIDC token: no secret, no alys checkout. The site's copies
gain the doctype and charset the artifact host would add,
self-host the two faces (`prototype/fonts/`, OFL) and carry
`<meta name="robots" content="noindex">`; `site.mjs` refuses a page that
carries any URL naming another host. About 2 billed minutes a run,
nothing against the 100 min/month cap. It is **not** an answer to the
design's D32 (how the game feeds SocialOS). Neither workflow runs the walk.

---

## Directory map

```
src/engine.js          # the fold: pure, window-free, every number from the rules
src/castle.js          # the castle from the fold's log, the horde's clock, the fight as one stepping function
rules/fieldworks.json  # the owner's instance of the rules: every number and sentence the game reads
sim/                   # the economy sim (economy.mjs), its test and fixture, REPORT.md (generated)
prototype/             # prototype.src.html → build.mjs → index.html; art-sheet.html; shots.mjs; shots/; site.mjs + fonts/ → the Pages site
tests/check.mjs        # the engine, the castle module, the rules, the page's pillars, the inline equality, the tree-wide wall sweep
docs/PLAYTEST.md       # the Gate 1 form
.github/  .claude/     # standards from Daily-lesson/alys templates/repo/
CLAUDE.md  SKELETON.md  README.md  CHANGELOG.md
```

---

## Where do I change…?

- **A number, a cost, a sentence the game speaks** → `rules/fieldworks.json`
  only, then `node sim/economy.mjs --alys ../alys` and read the report, then
  `node prototype/build.mjs`. **Never tune the engine.**
- **A rule of the fold** (rarity, XP, medals, the siege, expeditions) →
  `src/engine.js` + a test in `tests/check.mjs`; the contract is the design's
  §7.3 and changing it is a design question first.
- **What a piece of evidence builds, how the horde gathers, how a fight
  steps** → the numbers are in the rules' `castle` and `horde` blocks; the
  functions in `src/castle.js` + a test. The live fight, the forecast and a
  horde met while away must stay one function.
- **The prototype** (the castle screen, the stages, the pixel renderer, the screens, the DEMO set) →
  `prototype/prototype.src.html`, then rebuild. Never edit `index.html`.
- **What the Pages site publishes** → `prototype/site.mjs` (its file
  list and the three edits) + its test in `tests/check.mjs`; the deploy is
  `.github/workflows/pages.yml`. Add nothing to the site that the page does
  not load: no sim, no report, no tests, no shots.
- **The sim's model or report** → `sim/economy.mjs` + `sim/economy.test.mjs`.
- **Repo standards (CI lint, PR template, graph skills, skeleton guard)** →
  canonical in `Daily-lesson/alys` → `templates/repo/`; change them there.

---

## Standards this repo inherits

Stamped from `Daily-lesson/alys` `templates/repo/` (ALYS 1.12.0,
2026-11-09). Re-run the scaffolder in dry-run mode to see what has drifted.

| File | Canonical source | Edit here? |
|---|---|---|
| `.github/pull_request_template.md` | alys `.github/pull_request_template.md` | no |
| `.github/workflows/actions-budget.yml` + `.github/scripts/actions-budget-check.py` | alys (cap is the only per-repo value) | cap only |
| `.github/workflows/code-review-graph.yml`, `.mcp.json`, `.claude/settings.json`, `.claude/skills/{explore-codebase,review-changes,debug-issue,refactor-safely}` | alys copies (from the `code-review-graph` tool) | no |
| `.github/skeleton/check.mjs`, `reminder.mjs`, `.github/scripts/workflow-lint.mjs`, `skeleton-guard.yml` | alys `templates/repo/base/` | no |
| `.github/skeleton/skeleton.config.json`, `.github/workflows/ci.yml` | stack starter — yours from here on | yes |

**Held back from the stamp, on purpose (2026-11-09):** this repository is
**public**, and six standard files name a person or carry a personal audit:
`OPERATING_PRINCIPLES.md`, `SELF_HEALING.md`, the `alys-pipeline` and
`steward` skills, and the CI-only self-heal install
(`.github/self-healing/triage.mjs`, `.github/workflows/self-heal.yml`). They
come back with one re-stamp (`node scripts/new-repo.mjs --name FinalFrontier
--stack vanilla-js --out ../FinalFrontier --write` from alys) once the owner
rules on visibility, or once the canonical copies are written for a public
repo.

---

## Gotchas

1. **This repository is public.** Everything committed here is public-tier:
   no person's name, schedule or number about a person, no work-order id
   from the real file, no quoted order text, no e-mail, no database ref.
   `tests/check.mjs` sweeps every file for those (a hashed denylist and two
   shapes) and CI fails on a hit. The DEMO ids in the prototype (WO-281 and
   up) are invented; any id below 280 is refused by the sweep, so a real
   id cannot land here as the real file grows toward them.
2. **Evidence is the only power source (pillar 1).** A castle piece comes
   from `castle.by_kind` and `castle.by_grade` on an evidence event and from
   nowhere else. The page sets the castle in one line (`CAS =
   C.castleOf(st.log, RULES)`) and nothing writes into it. A kill, a spark, a
   cleared stage and a machine downed from the wall pay play score, which
   buys paint: never XP, a level, an item or a piece. `tests/check.mjs`
   reads the page's source for both. **One DEMO stand-in:** a waypoint
   card's button ticks the lesson (the app would open the lesson and the
   tick made there is the evidence); the card says so and no key does it.
3. **Nothing is ever lost (pillar 2).** No change may take XP, an item, a
   medal, rank or a castle piece. A fight reads the castle and writes
   nothing to it; a breach sets one flag that the next evidence clears; the
   save holds no map, so an unreadable save costs only the play scores.
4. **Counts through the walls.** A private event is sealed; the Keep's
   attackers are a count and an engine flag; the engine refuses a private
   event with a name field (tested). A horde's warning is a count of tasks,
   never a title; a stage shows a week's position, never a lesson's name.
5. **No person's schedule.** The sim's lesson and lift cadence is a stated
   game cadence: weekly totals in the order of the design's own budget, laid
   on invented days, never anyone's real study or training days or times.
6. **The sim reads the real task file for numbers only,** through the alys
   board's own parser imported from the alys checkout at run time — never
   copied here. It keeps an order's id, dates, Pn, tier, program, two counts
   and its score, drops every title, step, option and Say line, and its
   report prints per-week counts and never an id. Never commit the task
   file, the parser or an id from it.
7. **No Claude in the loop.** Every sentence the game speaks is in the rules
   file's bank; no model call, anywhere.
8. **No secret ever lands in a file.** CI passes with no secrets set.

---

## GitHub Actions minutes — a PORTFOLIO budget, not a per-repo one

**Canon: `Daily-lesson/alys` → `ACTIONS_BUDGET.md`.** Read it before adding or
re-timing any `schedule:` trigger.

The 3,000-minute quota ran out on the 20th of the month on 2026-08-21. No single
workflow was greedy — six repos each chose a locally sensible cadence and nobody
ever summed them. Scheduled jobs alone were 2,206 min/month, 74% of quota, before
a single commit. Two rules came out of it:

1. **A pure HTTP poke never goes on Actions.** If the whole body of a scheduled
   job is "call an authenticated endpoint on an already-deployed app", it belongs
   on Supabase `pg_cron` + `pg_net` (the Office project; definitions
   in alys `marketing/schema/007_ops_cron_jobs.sql`), where it costs nothing.
   Actions bills each **job rounded UP to a whole minute**, so a 3-second `curl`
   on a 33×/day schedule costs 1,005 min/month. Portfolio-wide, ~1,800 billed
   minutes were buying ~15 minutes of real compute.
2. **A new `schedule:` updates the ledger in the same PR.**
   `.github/workflows/actions-budget.yml` prices this repo's schedules on every
   PR touching `.github/workflows/**` and fails over a 100 min/month cap. It is path-filtered,
   so it costs ~0 minutes until someone actually introduces the risk.

Legitimately staying on Actions: real compute (checkout/`npm ci`/tests/builds);
**ordered chains**, because `net.http_post` is async fire-and-forget and gives no
sequencing; and program logic that computes a value rather than just poking.

Also standing, from the same pass: every workflow now carries a `concurrency`
group and every job a `timeout-minutes` (the default cap is **360** — one hung
job is 12% of the monthly quota). `cancel-in-progress` is chosen by role, never
blanket: `true` where a newer commit supersedes the run (tests, checks, reviews),
`false` where the run mutates something outside the runner (deploys, commits,
issue filing).

**This repo specifically:** no scheduled workflow (the self-heal weekly sweep
is held back with the rest of the CI-only install, above): 0 min/month. Cap:
100 min/month. Adding a `schedule:` also adds a row to alys `ACTIONS_BUDGET.md`
in the same change.

## Voice & tone

User-facing copy loads the Front Office voice canon first: alys (private) →
`marketing/VOICE.md` + `marketing/STORY.md`. The game's own sentences live in
`rules/fieldworks.json`'s bank, in the game's own world. The canon lives only
in alys; **never copy it into this repo**.

## Working with agents

The portfolio's operating principles live in alys (`OPERATING_PRINCIPLES.md`);
the per-repo copy is held back while this repo is public (above). Agents: draft
PRs always, nothing merged without the owner's say, a lens before every push.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
