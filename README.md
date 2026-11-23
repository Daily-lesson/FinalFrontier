# FinalFrontier

**Fieldworks** — a castle you build out of the work you actually finish, and a
side-scrolling pixel action game outside its gate.

Every order you close, lesson you tick, lift you log and decision you answer
lays a piece of the castle: a wall section, a tower level, a keep level. The
castle defends itself. Now and then the work that aged sends a horde; you are
told three days ahead, with how many finished tasks would see the castle hold,
and it is fought whether you watch or not. Out the gate you run, jump and shoot
through a stage for each week of the roadmap, or as far as you can in the
Wilds, for score and for fun. Nothing is ever lost: a breached wall is drawn
dim, and the next thing you finish relights it.

This repository is the game's home: the engine and the castle module (`src/`),
the rules (`rules/`), the economy sim (`sim/`), the prototype (`prototype/`)
and the tests. It is pre-production: nothing here runs in an app yet.

**Play the prototype:** https://daily-lesson.github.io/FinalFrontier/ (the
art sheet is `art-sheet.html` beside it). It is the DEMO: invented orders and
lessons, nothing read from anyone's real lanes, nothing sent anywhere.

```
node --test tests/check.mjs                 # the engine, the castle module, the rules, the page's pillars, the wall sweep
node prototype/build.mjs                    # rebuild the prototype page and embed/ (the build for a host app's frame)
node prototype/shots.mjs                    # the walk: screenshots, 86 behavioural checks, the frame time
node sim/economy.mjs --alys ../alys         # the economy sim (needs the design repo beside this one, with its full history)
```

Five pillars: evidence is the only power source; nothing is ever lost; the
castle is the real work; five minutes is a whole session; original and honest.
Play powers play: play score opens run upgrades, a second jump, worlds for the
Wilds and paint. It never yields XP, a level, an item or a castle piece.

The prototype keeps four keys in its own browser storage, all local to the
device and never sent: `fieldworks-keeper` (the Keeper's name),
`fieldworks-save` (which evidence the device has seen, the horde's clock, the
play record with its two switches, sound and hard mode; no map, because the castle is derived),
`fieldworks-onboarded` (the three cards seen) and `fieldworks-telemetry` (your
own numbers). Embedded in a host app (`embed/`) it keeps two keys of its own
instead, `fieldworks-embed-play` (the play record alone) and
`fieldworks-embed-onboarded`: nothing about the host's world is stored.

See `CLAUDE.md` for the map and the walls.
