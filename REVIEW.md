# REVIEW — the frontier stack (FW10 to FW13)

For the reviewer of four stacked draft PRs. Review and merge them in order;
each is based on the one before it.

| PR | Branch | What |
|---|---|---|
| #9 | `claude/fw10-touch-input` | Touch: one canvas takes every pointer, a floating stick, two thumbs at once, no gap between buttons, no zoom, scroll or selection under a thumb |
| #10 | `claude/fw11-explorer` | The frontier: a mid-angle explorer out the castle gate (`src/frontier.js`, `72-frontier.js`) |
| #11 | `claude/fw12-dense` | Density: a dense tier about three times the plain one for characters and two to three for props, a ground atlas, and a frame governor |
| #12 | `claude/fw13-partner` | The partner: a robot built from four slots of generic parts, with perks, upgrades and an import |

The design of record is in the design repo (`docs/FIELDWORKS.md` §18 and §19,
D66 to D93), in its own draft PR.

## Decisions made in the build

- **Camera (D85).** About 62° down. The ground grid is axis-aligned and runs
  up the screen. Tall things lean a little away from the screen's middle, so a
  building shows its roof, its front wall and its inner side. It is not
  isometric.
- **One canvas for play (D79).** In play, every control is drawn in the scene
  canvas and every touch goes to one handler. The page carries `touch-action:
  none`, no selection, no callout and no tap highlight while a game screen is
  up.
- **Two detail tiers and a governor (D86).** The governor measures each
  frame's own work (update and draw) against `rules.frontier.govern.budget_ms`
  (10 ms). It steps down a level at a time: render scale, then the plain tier,
  then no ash. It steps back up when there is room, and backs off if it
  bounces. A slow frame with little work of its own is the device, never the
  game, and never steps down.
- **The partner (D88).** It has four slots and twelve parts. A part adds its
  stats to the base and each upgrade adds its `up` again; every stat is
  clamped by `limits`. Flags: `climb`, `fly`, `pickup`, `scan`, `weakest`. It
  is play only: the partner never touches the evidence, never defends the
  castle, and its scrap is banked into the play save.
- **The import (D89).** It reads at most `code_max` (200) characters and
  accepts only known part ids or SOAR kinds listed in the rules. It never
  imports levels and ignores everything else. Export is `FF1 base tool head
  core`.
- **Everything is data.** Every number is in `rules/fieldworks.json` and every
  word is in its bank. Nothing in this stack calls a network or a model.

## What to check

1. **Pillars.**
   - `PLAY_FNS` now covers the frontier and the partner (`xbank`,
     `partnerClick`, `partnerBay`).
   - Check by reading that no play path writes `S.events`, `S.st`, `CAS` or
     the journal.
   - Check that the frontier's gate opening reads only the castle's pieces.
2. **Input safety.**
   - `partnerOf` validates with `hasOwnProperty` and clamps levels.
   - `partnerParse` lower-cases, caps the length and accepts nothing outside
     the whitelist.
   - The bay escapes every word it writes.
   - `playOf` validates `scrap` and `partner` on load.
3. **Per-frame allocation.**
   - The no-alloc test covers the drawing functions it lists.
   - Look for closures, template strings or arrays inside `renderExplore`'s
     call tree that the test's list misses.
4. **The walk.** `prototype/shots.mjs` has 107 checks, four of them new for
   the partner. **It was not run**: the build environment could not download
   the browser. Run `node prototype/shots.mjs` before merging anything.
5. **Frame time on a real phone.** It was only estimated with headless
   proxies. The governor's budget and its levels are first guesses.

## Open questions and known gaps

- **The side-scroller is still there.** D77 asks to remove every trace of it.
  That was deferred to FW11b so the frontier could ship beside it; the stage
  list opens with a Frontier row.
- **Should "Out the gate" go straight to the frontier** and skip the stage
  list?
- **The frontier's score is not added to lifetime play score yet.** It is
  shown at the end of a run only.
- **Partner density varies.** Its dense tier is 1.8 to 3.2 times its plain
  tier by build (rotors the least), not a uniform three. Faces per build,
  plain → dense:

  | Build | Plain | Dense |
  |---|---|---|
  | legs, arm, lidar, cell | 25 | 60 |
  | tracks, arm, thermal, swap | 20 | 64 |
  | wheels, gripper, camera, capacitor | 22 | 49 |
  | rotors, gripper, lidar, capacitor | 31 | 55 |

- **The partner card may cover the scene on small phones.** It is 150 to 240
  CSS px wide (`frontier.hud.card_w`). Check it on a 320 px wide screen.
- **Thin props barely lean.** Pylons are the clearest case; the lean scales
  with height, so it's subtle on narrow things.
- **SOAR kinds.** `capacitor` and `battery-swap` are generic tokens that may
  not be real SOAR classes. Check them against the catalogue before a SOAR
  export ships.
- **Balance is untuned.**
  - The regroup teleport (260 units) and catch-up speed (115% of the Keeper's)
    keep slow builds near the Keeper.
  - Turret power, life and damage are first guesses.
- **The bay shows no picture of the partner**, only its parts and words.
- **For the owner:** castle strength or cosmetic wings (D92), whether the
  Wilds stays open without work (D80), the private tier (D84), and a SOAR
  export button. These are listed in the design repo's §19.4.

## Commands

```
node prototype/build.mjs
node --test tests/check.mjs tests/c4.test.mjs
node .github/skeleton/check.mjs
node prototype/shots.mjs   # needs a Playwright browser; not run in this build
```
