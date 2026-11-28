  // ── DEMO data (invented chores in the file's grammar; public program ids; the Keep as counts) ──
  const WARDS = [
    { id: 'alys', name: 'ALYS and the Office' }, { id: 'socialos', name: 'SocialOS' }, { id: 'resumai', name: 'ResumAI' }, { id: 'off-races', name: 'Off2Races' },
    { id: 'robcista', name: 'Robcista' }, { id: 'source-of-all-robots', name: 'SOAR' }, { id: 'easm-red', name: 'EASM' }, { id: 'prism', name: 'PRISM' }, { id: 'keep', name: 'The Keep', keep: true }
  ];
  const wardOf = (id) => WARDS.find((w) => w.id === id) || WARDS[8];
  const O = (id, age, pn, eff, diff, dev, zone, band, title, steps, options, due) => ({ id, written: ago(age), pn, effortMin: eff, difficulty: diff, device: dev, zone, band, title, steps, options, due, tier: zone === 'keep' ? 'private' : 'public' });
  const OPEN0 = () => [
    O('WO-301', 66, 'P3', 5, 'low', 'either', 'off-races', 'later', 'Decide which of the two price sources the Saturday card reads', ['Read the two sample cards.', 'Pick an option below.'], [{ k: 'A', t: 'Keep the current source and add the second as a fallback (recommended)', say: 'WO-301 — keep the current price source and add the second as a fallback.' }, { k: 'B', t: 'Switch to the second source outright', say: 'WO-301 — switch the Saturday card to the second price source.' }], ago(-3)),
    O('WO-304', 41, 'P1', 60, 'high', 'desktop', 'off-races', 'now', 'Decide the night batch’s window (options A–D)', ['Read the four options.', 'Pick one.'], [{ k: 'A', t: 'One window at 02:00 local (recommended)', say: 'WO-304 — run the night batch in one window at 02:00 local.' }, { k: 'B', t: 'Two windows, 02:00 and 05:00', say: 'WO-304 — run the night batch in two windows.' }, { k: 'C', t: 'On demand only', say: 'WO-304 — run the night batch on demand only.' }, { k: 'D', t: 'Leave it as is', say: 'WO-304 — leave the night batch as it is.' }], ago(40)),
    O('WO-311', 33, 'P2', 15, 'medium', 'either', 'alys', 'next', 'Decide whether the digest’s links open the board or the app', ['Tap both links on the phone.', 'Pick an option.'], [{ k: 'A', t: 'The app, with the board as the desktop fallback (recommended)', say: 'WO-311 — digest links open the app; the board is the desktop fallback.' }, { k: 'B', t: 'The board everywhere', say: 'WO-311 — digest links open the board everywhere.' }], ago(6)),
    O('WO-318', 40, 'P1', 5, 'low', 'either', 'alys', 'now', 'Confirm the nightly workflow ran after the quota reset', ['Open the workflow’s runs.', 'Find last night’s run.', 'Note its conclusion.'], null, ago(40)),
    O('WO-322', 38, 'P1', 15, 'low', 'desktop', 'resumai', 'now', 'Install the preview build and clip one listing', ['Install the build.', 'Clip one listing.', 'Confirm the clip shows in the list.'], null, ago(38)),
    O('WO-325', 36, 'P2', 20, 'medium', 'desktop', 'socialos', 'next', 'Redeploy the relay function after the merge', ['Dispatch the deploy.', 'Open the screen it serves.', 'Confirm the new field shows.'], null, ago(33)),
    O('WO-330', 31, 'P2', 10, 'low', 'desktop', 'socialos', 'next', 'Re-pin the app on the second phone and confirm the icon', ['Remove the old pin.', 'Add to Home Screen.', 'Check the tile.'], null, ago(20)),
    O('WO-333', 29, 'P2', 15, 'medium', 'either', 'robcista', 'next', 'Decide the demo estate’s default time zone', ['Read the three shapes.', 'Pick one.'], [{ k: 'A', t: 'UTC everywhere (recommended)', say: 'WO-333 — the demo estate runs on UTC everywhere.' }, { k: 'B', t: 'The browser’s zone', say: 'WO-333 — the demo estate follows the browser’s zone.' }, { k: 'C', t: 'A zone per site', say: 'WO-333 — the demo estate carries a zone per site.' }], ago(29)),
    O('WO-339', 24, 'P2', 20, 'low', 'desktop', 'source-of-all-robots', 'next', 'Rotate the research scout’s token before it expires', ['Open the token page.', 'Mint a new one, same scope.', 'Paste it as the secret.'], null, ago(10)),
    O('WO-341', 22, 'P3', 45, 'medium', 'desktop', 'easm-red', 'soon', 'Read the revision-2 report on a tablet and note what wraps', ['Open the report.', 'Note what wraps badly.'], null, ago(-4)),
    O('WO-345', 15, 'P1', 10, 'low', 'desktop', 'alys', 'now', 'Paste the staged prompt into the daily Routine', ['Open the Routine.', 'Paste the prompt.', 'Save.'], null, ago(2)),
    O('WO-348', 12, 'P2', 2, 'low', 'either', 'alys', 'now', 'Switch the weekly digest’s summary line on', ['Open the digest settings.', 'Toggle the summary line on.'], null, ago(1)),
    O('WO-350', 9, 'P2', 20, 'medium', 'desktop', 'socialos', 'later', 'Archive the October deploy logs to the notes repo', ['Download the month’s logs.', 'Commit them under logs/.'], null, ago(-23)),
    O('WO-352', 7, 'P1', 20, 'medium', 'desktop', 'socialos', 'next', 'Set the staging project’s egress alert at 80%', ['Open the project’s alerts.', 'Add the egress rule.', 'Send one test alert.'], null, ago(-2)),
    O('WO-355', 4, 'P0', 5, 'low', 'either', 'alys', 'now', 'Restart the stuck preview deploy and confirm the probe answers', ['Open the deploy.', 'Restart it.', 'Read the probe.'], null, ago(1)),
    O('WO-356', 3, 'P2', 45, 'high', 'desktop', 'source-of-all-robots', 'later', 'Choose how a reader submits a correction to a fact', ['Read the two intake shapes.'], [{ k: 'A', t: 'A form on the site (recommended)', say: 'WO-356 — readers submit a correction through the site’s form.' }, { k: 'B', t: 'An issue on the repository', say: 'WO-356 — readers submit a correction as an issue.' }], ago(-21)),
    O('WO-360', 2, 'P2', 15, 'low', 'phone', 'resumai', 'soon', 'Confirm the sample import landed five rows', ['Open the list.', 'Count the rows.'], null, ago(-5)),
    O('WO-362', 45, 'P2', 10, 'low', 'either', 'keep', 'next', null, ['', ''], null, ago(10)),
    O('WO-363', 30, 'P1', 15, 'low', 'either', 'keep', 'now', null, ['', '', ''], null, ago(2)),
    O('WO-364', 9, 'P3', 20, 'medium', 'either', 'keep', 'soon', null, [''], [{ k: 'A' }, { k: 'B' }], ago(-7))
  ];
  function wos(o) {
    const d = Math.round((utc(o.due) - utc(TODAY)) / DAY);
    const u = d < 0 ? 40 : d === 0 ? 36 : d <= 2 ? 30 : d <= 7 ? 22 : d <= 14 ? 14 : d <= 30 ? 8 : 4;
    const i = { P0: 30, P1: 22, P2: 12, P3: 6 }[o.pn];
    const base = o.effortMin <= 5 ? 20 : o.effortMin <= 15 ? 17 : o.effortMin <= 30 ? 13 : o.effortMin <= 60 ? 9 : 5;
    const e = Math.round(base * ({ low: 1, medium: 0.75, high: 0.5 }[o.difficulty]));
    const a = Math.min(10, Math.floor((utc(TODAY) - utc(o.written)) / DAY / 7));
    return Math.max(0, Math.min(100, u + i + e + a - (o.device === 'desktop' ? 2 : 0)));
  }
  const EARLIER = 20;
  const PRIOR = [
    ['WO-281', 'close', 20, 'alys', 'P2', 'low', 3, 'now', 70], ['WO-282', 'close', 21, 'socialos', 'P1', 'medium', 30, 'now', 80], ['WO-283', 'close', 18, 'alys', 'P1', 'medium', 30, 'now', 78], ['WO-285', 'close', 16, 'resumai', 'P1', 'medium', 36, 'now', 82], ['WO-287', 'close', 15, 'off-races', 'P1', 'medium', 34, 'now', 80], ['WO-289', 'close', 12, 'alys', 'P2', 'medium', 33, 'next', 76],
    ['WO-284', 'close', 19, 'socialos', 'P1', 'medium', 12, 'next', 66], ['WO-286', 'close', 17, 'resumai', 'P2', 'low', 30, 'now', 74],
    ['WO-288', 'decision', 17, 'alys', 'P2', 'medium', 22, 'next', 60], ['WO-290', 'close', 14, 'off-races', 'P1', 'medium', 44, 'now', 76], ['WO-292', 'close', 13, 'alys', 'P3', 'low', 2, 'soon', 40],
    ['WO-293', 'close', 13, 'alys', 'P2', 'low', 5, 'now', 72], ['WO-295', 'close', 10, 'robcista', 'P2', 'high', 61, 'next', 58], ['WO-296', 'close', 8, 'socialos', 'P1', 'low', 1, 'now', 83],
    ['WO-297', 'close', 6, 'source-of-all-robots', 'P2', 'medium', 9, 'next', 62], ['WO-298', 'close', 3, 'keep', 'P2', 'low', 14, 'next', 60], ['WO-299', 'close', 2, 'alys', 'P1', 'low', 4, 'now', 80],
    // a month of earlier invented closes, so the DEMO's castle is the size a month of work builds
    ...Array.from({ length: EARLIER }, (_, i) => [`WO-${365 + i}`, 'close', 22 + i, ['alys', 'socialos', 'resumai', 'off-races', 'robcista', 'source-of-all-robots'][i % 6], ['P2', 'P1', 'P2', 'P3'][i % 4], ['low', 'medium', 'low', 'high'][i % 4], 4 + (i * 7) % 40, 'next', 52 + (i * 11) % 30])
  ].map(([id, kind, at, zone, pn, diff, age, band, w]) => ({ id, kind, at: ago(at), tier: zone === 'keep' ? 'private' : 'public', zone: zone === 'keep' ? null : zone, weight: w, facts: { pn, difficulty: diff, ageDays: age, band, options: kind === 'decision' ? 2 : 0 }, evidence: { kind: 'commit', ref: `demo/${id}` } }));
  const QUESTS = [
    { id: 'office-brief', program: 'alys', name: 'OFFICE BRIEF', tasks: [['design', 'The design and its diagnosis', 'done', ago(8)], ['ob1', 'The builder and the wall check', 'done', ago(8)], ['ob3', 'The pastes', 'done', ago(7)], ['ob5', 'The generated record', 'todo'], ['ob11', 'The weekly recap model', 'done', ago(7)], ['ob12', 'The recap on the phone', 'blocked', null, 'WO-352']] },
    { id: 'flow-status', program: 'socialos', name: 'FLOW STATUS', tasks: [['fs1', 'The visual design', 'done', ago(1)], ['fs2', 'The status contract', 'done', ago(1)], ['fs4', 'The lane', 'blocked', null, 'WO-352'], ['fs5', 'The node and screen', 'done', ago(1)]] },
    { id: 'robot-value', program: null, name: 'Robot Value', tasks: [['rv1', 'The shared model', 'done', ago(9)], ['rv2', 'The task catalog', 'done', ago(9)], ['rv3', 'The value lab', 'done', ago(9)], ['rv9', 'The ingest route', 'done', ago(9)]] },
    { id: 'create-desk', program: 'socialos', name: 'CREATE DESK', tasks: [['c1', 'The canon move', 'done', ago(17)], ['c2', 'The first platform', 'todo'], ['c3', 'The second platform', 'todo'], ['c5', 'The copy path removed', 'done', ago(17)]] },
    { id: 'honest-screening', program: 'resumai', name: 'Honest screening', tasks: [['hs1', 'The screen', 'done', ago(6)], ['hs2', 'The relay', 'in_progress'], ['hs7', 'Pooled outcomes', 'blocked', null, 'WO-360']] }
  ];
  const PRIVATE_QUESTS = 2;
  const DEMO_PLAN = { weeks: Array.from({ length: 8 }, (_, i) => ({ n: i + 1, lessons: ['a', 'b', 'c', 'd'].slice(0, i === 7 ? 3 : 4).map((l) => `w${i + 1}${l}`) })) };
  let PLAN = EMBED ? { weeks: [] } : DEMO_PLAN;   // embedded, the host's plan (or none)
  const TICKS0 = [...DEMO_PLAN.weeks[0].lessons, ...DEMO_PLAN.weeks[1].lessons, ...DEMO_PLAN.weeks[2].lessons, 'w4a', 'w4b'];
  const LIFT_DAYS = new Set([2, 4, 6]);   // the stated game cadence (sim/economy.mjs), an invented spread
  const TODAY_DOW = new Date(utc(TODAY)).getUTCDay();   // the DEMO's day; the screens that read it are closed when embedded

  // ── state: the evidence ledger (what the phone would keep), the horde clock and the play record ──
  let S, CAS;
  function lessonEvent(id, at) { return { id: `lesson/${id}`, kind: 'lesson', at, tier: 'private', zone: null, weight: 30, facts: {}, evidence: { kind: 'tick', ref: `progress/${id}` } }; }
  const liftEvent = (d) => ({ id: `lift/${d}`, kind: 'lift', at: d, tier: 'private', zone: null, weight: 30, facts: {}, evidence: { kind: 'tick', ref: `body/${d}` } });
  /** A close or an answer as the phone would record it at the tap (the journal's facts). */
  function closeEvent(o) {
    const age = E.daysBetween(o.written, TODAY);
    return { id: o.id, kind: o.options ? 'decision' : 'close', at: TODAY, tier: o.tier, zone: o.tier === 'private' ? null : o.zone, weight: wos(o), facts: { pn: o.pn, difficulty: o.difficulty, effortMin: o.effortMin, ageDays: age, band: o.band, options: o.options ? o.options.length : 0, due: o.due, verified: false }, evidence: { kind: 'commit', ref: `tasks: ${o.id} done (from SocialOS)` } };
  }
  const LEAD = Math.round(RH.warning_hours / 24);
  // The play record: scores, the lifetime play score that unlocks things for play (never for the castle), the paint and two switches.
  const PLAY0 = () => ({ best: {}, wilds: { best: 0, runs: 0 }, paint: RS.paints[0].slug, wall: 0, life: 0, mute: false, hard: false, bosses: 0, caches: 0, gear: {}, scrap: 0, partner: FieldworksFrontier.partnerOf(null, RULES) });   // scrap and the partner: the frontier's play (FW13)
  // The DEMO opens with its first horde already announced, so the warning is the first thing seen. `fresh` is the castle's size at the warning: pieces landed since then rally it.
  const HORDE0 = () => ({ day: 0, clock: { gather: 0, warned: TODAY, due: iso(utc(TODAY) + LEAD * DAY), count: 0, last: null, horde: null }, history: [], dim: false, arrived: null, fresh: null });
  const HORDE_NONE = () => ({ day: 0, clock: { gather: 0, warned: null, due: null, count: 0, last: null, horde: null }, history: [], dim: false, arrived: null, fresh: null });
  function reset() {
    sgSeen = -1;
    S = { events: OUT ? [] : PRIOR.slice(), open: OUT ? [] : OPEN0(), ticks: OUT ? [] : TICKS0.slice(), liftsLogged: OUT ? [] : [ago(2), ago(4)], shown: new Set(), closed: [], screen: S ? S.screen : 'castle', order: null, picked: null, proof: '', keeperName: S ? S.keeperName : '', lastLevel: 0,
      bounties: [], state: S ? S.state : 'live', started: false, stage: null, play: PLAY0(), horde: OUT ? HORDE_NONE() : HORDE0() };
    for (const d of S.liftsLogged) S.events.push(liftEvent(d));
    for (const id of S.ticks) S.events.push(lessonEvent(id, ago(6)));
    if (!OUT) S.events.push({ id: `pace/${ago(5)}`, kind: 'pace', at: ago(5), tier: 'private', zone: null, weight: 0, facts: {}, evidence: { kind: 'commit', ref: 'pace' } });
    setState(derive()); S.lastLevel = S.st.player.level;
    if (!OUT) { S.horde.fresh = CAS.pieces; const sg = siegeCounts(); S.horde.clock.horde = C.hordeOf(sg.attackers, sg.engines, 0, RULES); }   // the announced horde is sized once, at its warning
    for (const l of S.st.log) S.shown.add(l.id);   // the drop cards for history never fire; the castle is built from all of it all the same
  }
  const derive = () => E.evaluate(S.events, RULES, TODAY, { plan: PLAN, bounties: S.bounties });
  /** The one place the castle comes from: the fold's log, through the castle module. Play never reaches it. */
  function setState(st) { S.st = st; CAS = C.castleOf(st.log, RULES); fcKey = ''; }
  const countOf = (v) => (Array.isArray(v) ? v.length : Number.isInteger(v) ? v : 0);   // the DEMO holds an order's steps and options; a host sends their counts
  const openOrders = () => S.open.map((o) => ({ ...o, options: countOf(o.options), steps: countOf(o.steps) }));
  const siegeNow = () => E.siege(openOrders(), RULES, TODAY);
  let sgSeen = -1; const SG = { attackers: 0, engines: 0 };
  /** The siege's two counts, recomputed only when the open set changes. */
  function siegeCounts() { if (sgSeen !== S.open.length) { sgSeen = S.open.length; const w = siegeNow(); SG.attackers = w.reduce((a, x) => a + x.attackers.length, 0); SG.engines = w.reduce((a, x) => a + x.attackers.filter((y) => y.engine).length, 0); } return SG; }
  const hearts = () => (S.play.hard ? RS.hard.hearts : Math.min(RS.keeper.hearts_max, RS.keeper.hearts_base + Math.floor(S.st.player.level / RS.keeper.levels_per_heart)));
  const bestTotal = () => Object.values(S.play.best).reduce((a, b) => a + b.score, 0) + S.play.wilds.best + S.play.wall;
  /** Lifetime play score: every run's score, kept. It unlocks paint and things for play; never XP, a level, an item or a castle piece. */
  const totalScore = () => S.play.life;
  const unlocked = (slug) => { const u = RS.meta.unlocks.find((x) => x.slug === slug); return !u || S.play.life >= u.at; };
  // ── gear and the bounty (FW2): the Keeper carries what the evidence dropped; the day's pick is journalled so a close that day carries its bonus ──
  /** What the Keeper carries: a view over the archive (S.st.items), chosen per slot in the play record. Nothing here adds, moves or removes an item. */
  const gearNow = () => E.loadout(S.st.items, S.play.gear, RULES);
  const bountiesOf = (b) => (Array.isArray(b) ? b.filter((x) => x && isDay(x.day) && typeof x.id === 'string' && x.id.length <= 200): []);
  /** The pick for TODAY. The DEMO and the device journal it the first time it is asked (before any close, so the close carries the bonus); embedded, only the host's pick enters the fold and a local pick is for display. */
  function todaysBounty() {
    const had = S.bounties.find((b) => b.day === TODAY); if (had) return { id: had.id, day: TODAY, ...(openBounty(had.id) || {}) };
    if (EMBED) return null;   // embedded: no bounty exists unless the host sent it (a bonus computed here could be lost later)
    const pick = E.bounty(openOrders(), RULES, TODAY); if (!pick) return null;
    S.bounties = bountiesOf([...S.bounties, { day: TODAY, id: pick.id }]); saveNow();
    return pick;
  }
  function openBounty(id) { const o = openOrders().find((x) => x.id === id); return o ? E.bounty([o], RULES, TODAY) : null; }
  const paintOf = (slug) => RS.paints.find((p) => p.slug === slug) || RS.paints[0];

  // ── the save (rules.save): the journal, the horde clock, the play record. No map: the castle is derived. ──
  function snapshot() {
    if (EMBED) return { version: RULES.save.version, rules: RULES_HASH, play: S.play };   // embedded: play only, nothing about the world
    return { version: RULES.save.version, rules: RULES_HASH,
      journal: { closed: S.closed.slice(), ticks: S.ticks.slice(), lifts: S.liftsLogged.slice(), lastLevel: S.lastLevel },
      play: S.play, horde: S.horde, bounties: S.bounties };
  }
  let savedAt = 0;
  function saveNow() { if (!S || globalThis.FIELDWORKS_ART) return;   /* the art sheet never writes the player's save */ store.set(KEYS.save, JSON.stringify(snapshot())); savedAt = performance.now(); }
  const isInt = (n) => Number.isInteger(n) && n >= 0;
  const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  function validJournal(j) {
    return j && Array.isArray(j.closed) && j.closed.every((x) => typeof x === 'string') && Array.isArray(j.ticks) && j.ticks.every((x) => typeof x === 'string') && Array.isArray(j.lifts) && j.lifts.every(isDay) && isInt(j.lastLevel);
  }
  function validPlay(p) {
    return p && p.best && typeof p.best === 'object' && Object.values(p.best).every((b) => b && isInt(b.score) && isInt(b.stars) && b.stars <= 3) && p.wilds && isInt(p.wilds.best) && isInt(p.wilds.runs) && RS.paints.some((x) => x.slug === p.paint) && isInt(p.wall);
  }
  /** The gear a player chose, per slot: a hash of an item id (never the id) or 'off'. Only known slots and shapes are kept. */
  function gearChoice(g) { const out = {}; if (g && typeof g === 'object') for (const slot of RULES.gear.order) { const v = g[slot]; if (v === 'off' || (Number.isInteger(v) && v >= 0 && v <= 0xffffffff)) out[slot] = v; } return out; }
  /** A read play record under today's shape: a save from before lifetime score starts it at its bests. Only known fields are kept. */
  function playOf(p) {
    const q = { ...PLAY0(), best: p.best, wilds: p.wilds, paint: p.paint, wall: p.wall, mute: p.mute === true, hard: p.hard === true, bosses: isInt(p.bosses) ? p.bosses : 0, caches: isInt(p.caches) ? p.caches : 0, gear: gearChoice(p.gear), scrap: isInt(p.scrap) ? Math.min(p.scrap, RULES.frontier.partner.scrap_max) : 0, partner: FieldworksFrontier.partnerOf(p.partner, RULES) };
    q.life = Math.max(isInt(p.life) ? p.life : 0, Object.values(q.best).reduce((a, b) => a + b.score, 0) + q.wilds.best + q.wall);
    return q;
  }
  function validHorde(h) {
    const c = h && h.clock;
    return h && isInt(h.day) && h.day <= 36500 && c && (c.horde == null || (isInt(c.horde.n) && isInt(c.horde.bosses) && isInt(c.horde.ordinal))) && Number.isFinite(c.gather) && c.gather >= 0 && isInt(c.count) && (c.due === null || isDay(c.due)) && (c.warned === null || isDay(c.warned)) && (c.last === null || isDay(c.last))
      && Array.isArray(h.history) && typeof h.dim === 'boolean' && (h.fresh === null || isInt(h.fresh)) && (h.arrived === null || (isInt(h.arrived.n) && isInt(h.arrived.bosses) && isInt(h.arrived.ordinal)));
  }
  /** 'none' | 'loaded' | 'migrated' | 'old-game' | 'corrupt'. Never takes anything: the castle is the evidence, and the journal survives every path but an unreadable one. */
  function loadSave() {
    const raw = store.get(KEYS.save); if (!raw) return 'none';
    let s = null; try { s = JSON.parse(raw); } catch { s = null; }
    if (EMBED) {   // the embed's own key holds play only: no journal, no horde, nothing of the world to replay
      reset();
      if (!s || s.version !== RULES.save.version || !validPlay(s.play)) { store.del(KEYS.save); return 'corrupt'; }
      S.play = playOf(s.play); return 'loaded';
    }
    const old = s && s.version === 1;   // prototype 3's fortress map: its journal is kept, its map belongs to the old game
    if (!s || !(old || s.version === RULES.save.version) || !validJournal(s.journal)) { store.del(KEYS.save); reset(); return 'corrupt'; }
    const j = s.journal;
    reset(); S.bounties = bountiesOf(s.bounties);
    if (OUT) {   // signed out: no journal and no horde to replay; of the play record, the Wilds alone (the weeks and the wall were the DEMO's)
      if (validPlay(s.play)) { S.play.wilds = s.play.wilds;
        const demo = Object.keys(s.play.best).length > 0 || s.play.wall > 0;   // a DEMO build's weeks and wall were the DEMO's: of such a record, the Wilds alone
        S.play.life = demo ? s.play.wilds.best : playOf({ ...s.play, best: {}, wall: 0 }).life; S.play.mute = s.play.mute === true; S.play.hard = s.play.hard === true;
        const p = RS.paints.find((x) => x.slug === s.play.paint); if (p && totalScore() >= p.at) S.play.paint = p.slug; }
      return 'loaded';
    }
    for (const id of j.closed) { const o = S.open.find((x) => x.id === id); if (!o) continue; S.events.push(closeEvent(o)); S.open = S.open.filter((x) => x !== o); S.closed.push(id); S.shown.add(id); }
    for (const t of j.ticks) if (!S.ticks.includes(t) && PLAN.weeks.some((w) => w.lessons.includes(t))) { S.ticks.push(t); S.events.push(lessonEvent(t, TODAY)); S.shown.add(`lesson/${t}`); }
    for (const d of j.lifts) if (!S.liftsLogged.includes(d)) { S.liftsLogged.push(d); S.events.push(liftEvent(d)); S.shown.add(`lift/${d}`); }
    setState(derive()); S.lastLevel = Math.max(j.lastLevel, 0);
    if (old) return 'old-game';
    if (validPlay(s.play)) S.play = playOf(s.play);
    if (validHorde(s.horde)) S.horde = s.horde;
    return s.rules === RULES_HASH ? 'loaded' : 'migrated';
  }

  // ── the horde's clock in the DEMO: the dev bar steps the day; the real app reads the device's date ──
  const hdate = () => (EMBED ? TODAY : iso(utc(TODAY) + S.horde.day * DAY));   // embedded, the host's day: the game runs no horde clock of its own
  const freshNow = () => (S.horde.fresh == null ? 0 : Math.max(0, CAS.pieces - S.horde.fresh));   // pieces the evidence landed since the warning
  let fc = null, fcKey = '';
  /** The forecast for the announced horde: the fight without the Keeper, and how many finished tasks would see it hold. */
  function forecast() {
    const cl = S.horde.clock; if (!cl.due || S.state === 'unlit') return null;
    const key = `${CAS.pieces}/${CAS.wallHp}/${CAS.dps}/${cl.count}/${freshNow()}`;
    if (key !== fcKey) { fcKey = key; const sg = siegeCounts(), horde = cl.horde || C.hordeOf(sg.attackers, sg.engines, cl.count, RULES); const r = C.readiness(CAS, horde, RULES, freshNow()); fc = { horde, forecast: r.forecast, tasks: r.tasks }; }
    return fc;
  }
  function hordeLine() {
    if (EMBED && EMB.state !== 'world') return BANK.embed.head[EMB.state];
    if (S.horde.arrived) return BANK.horde.arrive;
    if (EMBED && !OUT && !S.hordeKnown) return BANK.horde.unknown;   // the host sent no horde: said, never guessed
    if (S.state === 'unlit') return BANK.horde.unread;
    const cl = S.horde.clock;
    if (cl.due) { const d = E.daysBetween(hdate(), cl.due); return fill(BANK.horde.warning, { when: d <= 0 ? BANK.horde.when_today : d === 1 ? BANK.horde.when_day : fill(BANK.horde.when_days, { n: d }) }); }
    if (cl.gather > 0) return fill(BANK.horde.gathering, { pct: Math.min(99, Math.round(100 * cl.gather / RH.threshold)) });
    return cl.last ? BANK.horde.resting : BANK.horde.quiet;
  }
  function needLine() {
    if (EMBED && EMB.state !== 'world') return BANK.embed[EMB.state];   // reading, none or unread: the honest line
    if (OUT) return BANK.castle.signed_out_short;
    if (S.horde.arrived) return BANK.horde.join;
    if (S.horde.dim) return BANK.castle.dim;
    const f = forecast(); if (!f) return '';
    return f.tasks === 0 ? BANK.horde.need_none : f.tasks === 1 ? BANK.horde.need_one : f.tasks == null ? fill(BANK.horde.need_many, { n: RH.warning.max_tasks }) : fill(BANK.horde.need_some, { n: f.tasks });
  }
  /** The Home tile's short form of the same count. */
  function tileNeed() { if (S.horde.arrived) return ''; if (S.horde.dim) return BANK.horde.tile_dim; const f = forecast(); if (!f) return fill(BANK.castle.count, { n: CAS.pieces }); return f.tasks === 0 ? BANK.horde.tile_holds : f.tasks == null ? fill(BANK.horde.tile_many, { n: RH.warning.max_tasks }) : fill(BANK.horde.tile_need, { n: f.tasks }); }
  function advanceDays(n) {
    if (EMBED) return;   // the host's clock, never the game's
    if (S.horde.arrived) { toast(BANK.horde.dev_wait); return; }   // a fight in progress is not restarted
    for (let i = 0; i < n && !S.horde.arrived; i++) {
      S.horde.day++;
      const sg = siegeCounts(), cl = S.horde.clock;
      const r = C.hordeDay(cl, S.state === 'unlit' ? null : sg.attackers, hdate(), RULES, sg.engines); S.horde.clock = r.clock;
      if (r.warned) S.horde.fresh = CAS.pieces;
      if (r.arrived) S.horde.arrived = r.horde;
    }
    fcKey = ''; saveNow();
    if (S.horde.arrived) beginFight(); else if (S.screen === 'home') render(); else updateHud();
  }
  function hordeNow() {
    if (EMBED) return;
    if (S.horde.arrived) { toast(BANK.horde.dev_wait); return; }
    const sg = siegeCounts(), cl = S.horde.clock;
    S.horde.arrived = cl.horde || C.hordeOf(sg.attackers, sg.engines, cl.count, RULES);
    S.horde.clock = { gather: 0, warned: null, due: null, count: cl.count + 1, last: hdate(), horde: null };
    saveNow(); beginFight();
  }
