# FinalFrontier

**Fieldworks** — a fortress you build out of the work you actually finish.

Your real backlog is the blight at the edges of the map; every order you close
in real life lands a cache by the beacon, and if it was one of the engines
parked in the blight, scraps it on the spot. By day you drive the Keeper,
salvage, raise pylons that reclaim ground and wall it; by night the aged work
comes for the beacon and you hold it. Out through the gate, in third person,
the learning roadmap is the field you walk and survey. Nothing is ever lost.

This repository is the game's home: the engine (`src/`), the rules
(`rules/`), the economy sim (`sim/`), the greybox prototype (`prototype/`) and
the tests. It is pre-production (milestone M0 of the plan): nothing here runs
in an app yet.

```
node --test tests/check.mjs                 # the engine, the rules, the wall sweep
node prototype/build.mjs                    # rebuild the prototype page
node sim/economy.mjs --alys ../alys         # the economy sim (needs the design repo beside this one)
```

Five pillars: evidence is the only power source; nothing is ever lost; the map
is the real world; five minutes is a whole session; original and honest.

The prototype keeps four keys in its own browser storage, all local to the
device and never sent: `fieldworks-keeper` (the Keeper's name),
`fieldworks-save` (the built map), `fieldworks-onboarded` (the three cards
seen) and `fieldworks-telemetry` (your own numbers).

See `CLAUDE.md` for the map and the walls.
