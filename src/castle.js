// FIELDWORKS — the castle and the horde (design D34: the rework).
// Pure, window-free, clock-free, storage-free; every number from rules.castle and
// rules.horde. The engine (engine.js) is untouched: this module reads the fold's
// own log (evaluate(...).log) and the siege's counts and derives three things:
//   castleOf      the castle, built from evidence and from nothing else
//   hordeDay      the horde's clock: it gathers from the aged backlog, is announced, arrives
//   hordeStart / hordeStep / resolveHorde / readiness
//                 the fight, as ONE stepping function: the live screen and the
//                 forecast run the same code, so a forecast is the fight without the Keeper
// IIFE on globalThis, like the engine: a <script> tag and node's vm load it the same way.
(function () {
  'use strict';
  const DAY = 86400000;
  const utc = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, dd); };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const addDays = (d, n) => iso(utc(d) + n * DAY);
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
  const STEP = 1 / 20;   // the fight's fixed step, seconds

  // ── the castle ──────────────────────────────────────────────────────────
  /** The piece one line of the fold's log adds: by the event's kind first, else by its drop's grade. Null for a line with no piece. */
  function pieceFor(entry, rules) {
    if (!entry || entry.voided || !entry.kind) return null;
    const C = rules.castle;
    const p = C.by_kind[entry.kind] || (entry.item ? C.by_grade[entry.item.grade] : null);
    return p && C.parts.includes(p.part) && p.size > 0 ? { part: p.part, size: p.size } : null;
  }
  const emptyCount = (rules) => Object.fromEntries(rules.castle.parts.map((p) => [p, 0]));
  /** A castle from part counts ({wall, tower, keep, course, gate, lamp}); the numbers a fight reads. */
  function castleFrom(count, pieces, rules) {
    const C = rules.castle, slots = C.tower.slots;
    // tower points are laid breadth-first: every slot stands before any slot rises
    const towers = Array.from({ length: slots }, (_, i) => Math.floor(count.tower / slots) + (i < count.tower % slots ? 1 : 0));
    return {
      pieces, count: { ...count }, towers,
      wallHp: C.wall.hp_base + count.wall * C.wall.hp_per_section + count.course * C.wall.hp_per_course + count.gate * C.wall.hp_per_brace,
      beaconHp: C.keep.beacon_hp_base + count.keep * C.keep.beacon_hp_per_level,
      dps: count.tower * C.tower.dps_per_level + count.keep * C.keep.dps_per_level
    };
  }
  /** The castle the evidence built: a fold over the engine's log. Play adds nothing here. */
  function castleOf(log, rules) {
    const count = emptyCount(rules); let pieces = 0;
    for (const l of log || []) { const p = pieceFor(l, rules); if (!p) continue; count[p.part] += p.size; pieces++; }
    return castleFrom(count, pieces, rules);
  }
  /** The same castle with extra pieces laid on it (the forecast's "if k more tasks landed"). */
  function withPieces(castle, list, rules) {
    const count = { ...castle.count };
    for (const p of list) count[p.part] = (count[p.part] || 0) + p.size;
    return castleFrom(count, castle.pieces + list.length, rules);
  }

  // ── the horde's clock ───────────────────────────────────────────────────
  /** A new clock: nothing gathered, nothing due. */
  const hordeClock = () => ({ gather: 0, warned: null, due: null, count: 0, last: null, horde: null });
  /**
   * One day of the clock. `attackers` is the siege's count that day (engine.siege),
   * or null when the lane was not read: an unread day gathers nothing, never a zero.
   * `engines` is the siege's engine count that day. Returns { clock, warned, arrived,
   * horde }: the horde is announced `warning_hours` ahead and never inside
   * `min_gap_days` of the last one. The horde is sized ONCE, at its warning, and kept
   * on the clock: the one that is forecast is the one that arrives.
   */
  function hordeDay(clock, attackers, date, rules, engines) {
    const H = rules.horde, c = { ...clock };
    let warned = false, arrived = false, horde = null;
    if (c.due) {
      if (date >= c.due) { arrived = true; horde = c.horde || hordeOf(attackers, engines, c.count, rules); c.count++; c.last = c.due; c.due = null; c.warned = null; c.horde = null; }
      return { clock: c, warned, arrived, horde };
    }
    if (attackers == null) return { clock: c, warned, arrived, horde };
    const lead = Math.round(H.warning_hours / 24);
    if (c.last && daysBetween(c.last, date) < H.min_gap_days - lead) return { clock: c, warned, arrived, horde };
    c.gather += Math.min(H.gather_cap_per_day, attackers * H.gather_per_attacker);
    if (c.gather >= H.threshold) { c.gather = 0; c.warned = date; c.due = addDays(date, lead); c.horde = hordeOf(attackers, engines, c.count, rules); warned = true; }
    return { clock: c, warned, arrived, horde };
  }
  /** The horde that arrives: its size from the backlog that day and how many came before; its bosses are the siege engines. */
  function hordeOf(attackers, engines, ordinal, rules) {
    const z = rules.horde.size;
    const n = Math.max(1, Math.min(z.max, Math.round(z.base + z.per_attacker * (attackers || 0) + z.per_horde * (ordinal || 0))));
    const bosses = Math.min(rules.horde.max_bosses, engines || 0, n);
    return { n, bosses, ordinal: ordinal || 0 };
  }

  // ── the fight: one stepping function ────────────────────────────────────
  // One line of ground. The wall's face is x = 0; the horde walks in from x = approach;
  // towers stand behind the wall at negative x; the keep, and its beacon, behind them.
  /** The rally: every piece the evidence landed since the warning lifts the castle's fire and its wall for this one fight, up to a cap. */
  function rallyOf(fresh, rules) { const R = rules.horde.rally; return 1 + R.per_piece * Math.max(0, Math.min(R.max_pieces, fresh || 0)); }
  function hordeStart(castle, horde, rules, fresh) {
    const H = rules.horde, C = rules.castle, rally = rallyOf(fresh, rules);
    const order = [];   // a fixed order: every `skitter_every`-th machine is a skitter, the bosses come last
    for (let i = 0; i < horde.n - horde.bosses; i++) order.push((i + 1) % H.skitter_every === 0 ? 'skitter' : 'crawler');
    for (let i = 0; i < horde.bosses; i++) order.push('brute');
    const guns = castle.towers.map((level, i) => ({ id: `tower-${i + 1}`, x: -(C.tower.first_x + i * C.tower.spacing), level, dps: level * C.tower.dps_per_level * rally, range: C.tower.range, downed: 0 })).filter((g) => g.level > 0);
    if (castle.count.keep > 0) guns.push({ id: 'keep', x: -C.keep.x, level: castle.count.keep, dps: castle.count.keep * C.keep.dps_per_level * rally, range: C.keep.range, downed: 0 });
    return { t: 0, rally, order, next: 0, spawnIn: 0, machines: [], guns, wallHp: castle.wallHp * rally, wallMax: castle.wallHp * rally, beaconHp: castle.beaconHp, beaconMax: castle.beaconHp, breached: false, downed: 0, keeperDowned: 0, total: order.length, done: false, outcome: null };
  }
  /** Advance the fight by one fixed step. Mutates and returns `f`. No allocation once every machine has spawned. */
  function hordeStep(f, rules) {
    if (f.done) return f;
    const H = rules.horde, C = rules.castle, dt = STEP;
    f.t += dt;
    if (f.next < f.order.length) { f.spawnIn -= dt; if (f.spawnIn <= 0) { const type = f.order[f.next++], m = H.machines[type]; f.machines.push({ type, x: H.approach, hp: m.hp, max: m.hp, alive: true }); f.spawnIn += H.spawn_gap_s; } }
    const stop = f.breached ? -C.keep.x : 0;
    for (let i = 0; i < f.machines.length; i++) {
      const z = f.machines[i]; if (!z.alive) continue;
      const m = H.machines[z.type];
      if (z.x > stop) { z.x = Math.max(stop, z.x - m.speed * dt); continue; }
      if (!f.breached) { f.wallHp -= m.dps * dt; if (f.wallHp <= 0) { f.wallHp = 0; f.breached = true; } }
      else { f.beaconHp -= m.dps * dt; if (f.beaconHp < 0) f.beaconHp = 0; }
    }
    for (let g = 0; g < f.guns.length; g++) {
      const gun = f.guns[g]; let best = -1, bx = Infinity;
      for (let i = 0; i < f.machines.length; i++) { const z = f.machines[i]; if (z.alive && z.x - gun.x <= gun.range && z.x < bx) { bx = z.x; best = i; } }
      gun.target = best;
      if (best < 0) continue;
      const z = f.machines[best]; z.hp -= gun.dps * dt;
      if (z.hp <= 0) { z.alive = false; gun.downed++; f.downed++; }
    }
    if (f.beaconHp <= 0) { f.done = true; f.outcome = 'dark'; }
    else if (f.downed + f.keeperDowned >= f.total) { f.done = true; f.outcome = f.breached ? 'breached' : 'held'; }
    else if (f.t >= H.max_seconds) { f.done = true; f.outcome = f.breached ? 'breached' : 'held'; f.withdrew = f.total - f.downed - f.keeperDowned; }
    return f;
  }
  /** The Keeper's shot from the wall: play may help a fight; it is never in a forecast. */
  function keeperHit(f, index, dmg) {
    const z = f.machines[index]; if (!z || !z.alive || f.done) return false;
    z.hp -= dmg; if (z.hp <= 0) { z.alive = false; f.keeperDowned++; return true; }
    return false;
  }
  /** The fight with nobody at the wall: what the castle does on its own. */
  function resolveHorde(castle, horde, rules, fresh) {
    const f = hordeStart(castle, horde, rules, fresh);
    let guard = Math.ceil(rules.horde.max_seconds / STEP) + 2;
    while (!f.done && guard-- > 0) hordeStep(f, rules);
    return summary(f);
  }
  function summary(f) {
    const best = f.guns.slice().sort((a, b) => b.downed - a.downed || a.id.localeCompare(b.id))[0] || null;
    return { outcome: f.outcome, rally: Math.round((f.rally - 1) * 100), seconds: Math.round(f.t), total: f.total, downed: f.downed, keeperDowned: f.keeperDowned, withdrew: f.withdrew || 0,
      wallLeft: f.wallMax ? Math.round(100 * f.wallHp / f.wallMax) : 0, beaconLeft: f.beaconMax ? Math.round(100 * f.beaconHp / f.beaconMax) : 0,
      guns: f.guns.map((g) => ({ id: g.id, level: g.level, downed: g.downed })), best: best && best.downed > 0 ? { id: best.id, downed: best.downed } : null };
  }
  /**
   * How ready the castle is: the forecast for this horde, and the smallest number of
   * finished tasks (each assumed to add the next piece of rules.horde.warning.assume,
   * in turn, and to count toward the rally) after which the castle holds on its own.
   * `fresh` is how many pieces have landed since the warning. tasks = 0: it holds as it stands;
   * tasks = null: more than warning.max_tasks. A count, never a title.
   */
  function readiness(castle, horde, rules, fresh) {
    const W = rules.horde.warning, now = resolveHorde(castle, horde, rules, fresh);
    let tasks = now.outcome === 'held' ? 0 : null;
    for (let k = 1; tasks == null && k <= W.max_tasks; k++) {
      const extra = Array.from({ length: k }, (_, i) => W.assume[i % W.assume.length]);
      if (resolveHorde(withPieces(castle, extra, rules), horde, rules, (fresh || 0) + k).outcome === 'held') tasks = k;
    }
    return { forecast: now, tasks };
  }

  const api = { STEP, rallyOf, pieceFor, castleOf, castleFrom, withPieces, hordeClock, hordeDay, hordeOf, hordeStart, hordeStep, keeperHit, resolveHorde, summary, readiness };
  if (typeof globalThis !== 'undefined') globalThis.FieldworksCastle = api;
})();
