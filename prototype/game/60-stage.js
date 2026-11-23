  // ══════════════════════ THE STAGES: out the gate, a side-scrolling run ══════════════════════
  // A stage is laid by its own seeded generator, so a week is the same every time and the Wilds differ run to run. Everything here is play:
  // it pays play score and nothing else (pillar 1). The run's upgrades last for the run; what play score unlocks is for play, and kept.
  const ROWS = 16, GROUND_ROW = 13, MIN_ROW = GROUND_ROW - 5;
  let ST = null;
  const solid = (c, r) => { if (c < 0) return true; if (c >= ST.len) return !ST.wilds; if (ST.lockL >= 0 && (c < ST.lockL || c > ST.lockR)) return true; const g = ST.ground[c]; return (g >= 0 && r >= g) || ST.plat[c] === r || ST.plat2[c] === r || (ST.crack[c] >= 0 && r >= ST.crack[c]); };
  function col(g) { ST.ground.push(g); ST.plat.push(-1); ST.plat2.push(-1); ST.crack.push(-1); ST.chp.push(0); ST.spike.push(0); ST.len++; }
  function flat(n, h) { for (let i = 0; i < n; i++) col(h); }
  const spark = (x, y, lock = -1, big = false) => ({ x, y, on: true, lock, big });
  const post = (id, c, pos = 0, of = 0) => ({ id, x: c * TILE + 3, y: ST.h * TILE - 15, pos, of, hit: false });
  /** How far along the ramp a column is: the week for a roadmap stage, the distance for the Wilds. Gates the machines and the hazards. */
  const levelAt = () => (ST.wilds ? 1 + Math.floor(ST.len / RS.wilds.ramp_tiles) : ST.week);
  const meets = (type) => levelAt() >= RS.enemies[type].from;
  function foe(type, x, y) { const s = SP[type === 'hopper' ? 'skitter' : type === 'crawler' ? 'crawlerA' : type][0], D = RS.enemies[type]; return { type, x, y: y - s.height, vx: -D.speed * ST.spd, vy: 0, hp: D.hp, alive: true, t: 0, y0: y - s.height, hit: 0, w: s.width, h: s.height, cd: D.shot_every_s || 0, st: 0, face: -1, dashed: 0 }; }
  /** A machine for open ground, from the kinds this far along allows; rarer the tougher it is. */
  function pickFoe(r, d) {
    const roll = r();
    if (roll < d * .16 && meets('brute')) return 'brute';
    if (roll < d * .34 && meets('warden')) return 'warden';
    if (roll < d * .55 && meets('hopper')) return 'hopper';
    return 'crawler';
  }
  /** A boss arena: flat, wider than any view, two ledges to fight from. The boss arrives when the Keeper walks in. */
  function arena() {
    const h = ST.h, c0 = ST.len, n = RS.bosses.arena_tiles;
    flat(n, h);
    for (let i = 0; i < 3; i++) { ST.plat[c0 + 4 + i] = h - 3; ST.plat[c0 + n - 7 + i] = h - 3; }
    ST.arenas.push({ c0, c1: c0 + n - 1, done: false, row: h });
    flat(3, h);
  }
  /** A hidden alcove inside a cliff, closed by a cracked wall: sparks and a relic for whoever shoots the wall. */
  function cache() {
    const h = ST.h, T = RS.terrain;
    col(h - 1); col(h - 1);                                  // a step up to the wall
    const a = ST.len, id = ST.caches.length; flat(5, h);
    ST.crack[a] = h - 2; ST.chp[a] = T.crack_hp;
    for (let i = 1; i <= 4; i++) ST.plat[a + i] = h - 3;     // the roof, level with the cliff beyond
    ST.caches.push({ c0: a, c1: a + 4, row: h, open: false });
    for (let i = 1; i <= 3; i++) { ST.sparks.push(spark((a + i) * TILE + 4, (h - 1) * TILE + 3, id)); ST.sparks.push(spark((a + i) * TILE + 4, (h - 2) * TILE + 4, id)); }
    ST.sparks.push(spark((a + 4) * TILE + 2, (h - 1) * TILE + 1, id, true));
    ST.h = h - 3; flat(4, ST.h);
    ST.nextCache = ST.len + T.cache_every_tiles + ((ST.rnd() * 30) | 0);
  }
  /** Lay `n` more columns of a stage from its own seeded generator. Jumps stay inside the Keeper's reach (3 tiles across, 3 up). */
  function grow(n) {
    const r = ST.rnd, end = ST.len + n, T = RS.terrain;
    while (ST.len < end) {
      if (ST.wilds && ST.len >= ST.nextBoss) { arena(); ST.nextBoss = ST.len + RS.bosses.wilds_every_tiles; continue; }
      if (ST.wilds && ST.len >= ST.nextPost) { flat(4, ST.h); ST.posts.push(post(null, ST.len - 3)); ST.nextPost = ST.len + RS.wilds.checkpoint_tiles; continue; }
      if (ST.len >= ST.nextCache && ST.h >= GROUND_ROW - 2) { cache(); continue; }
      const d = ST.wilds ? Math.min(1, ST.len / RS.wilds.ramp_tiles / 3 + .2) : Math.min(1, .25 + ST.week * .09), roll = r(), h = ST.h, c0 = ST.len, lvl = levelAt();
      if (roll < .13 && d > .2) {                            // a pit, sometimes watched from above
        const w = 2 + (r() < d * .6 ? 1 : 0); for (let i = 0; i < w; i++) col(-1);
        if (r() < d * .7 && meets('drone')) ST.foes.push(foe('drone', (c0 + w / 2) * TILE, (h - 4) * TILE));
        flat(3, h);
      } else if (roll < .21 && lvl >= T.mover_from) {         // a chasm too wide to jump, and a platform that crosses it
        const w = T.chasm_tiles; for (let i = 0; i < w; i++) col(-1);
        ST.movers.push({ x: c0 * TILE, y: h * TILE, w: 24, x0: c0 * TILE, x1: (c0 + w) * TILE - 24, vx: T.mover_speed, dx: 0 });
        for (let i = 1; i < w; i += 2) ST.sparks.push(spark((c0 + i) * TILE + 4, (h - 2) * TILE));
        flat(3, h);
      } else if (roll < .35) {                               // a step up, a step down, now and then a drop
        const drop = h <= GROUND_ROW - 2 && r() < .45;
        const to = drop ? h + 2 : r() < .5 && h > MIN_ROW + 1 ? h - 1 - (r() < .3 && h > MIN_ROW + 2 ? 1 : 0) : Math.min(GROUND_ROW, h + 1);
        ST.h = Math.max(MIN_ROW, Math.min(GROUND_ROW, to)); flat(3 + ((r() * 3) | 0), ST.h);
      } else if (roll < .5) {                                // ledges at two heights, sparks on both
        flat(7, h);
        for (let i = 1; i <= 3; i++) { ST.plat[c0 + i] = h - 3; ST.sparks.push(spark((c0 + i) * TILE + 4, (h - 4) * TILE + 2)); }
        if (r() < .5 && h - 6 >= 2) for (let i = 4; i <= 5; i++) { ST.plat2[c0 + i] = h - 6; ST.sparks.push(spark((c0 + i) * TILE + 4, (h - 7) * TILE + 2)); }
        if (r() < d) ST.foes.push(foe(pickFoe(r, d), (c0 + 5) * TILE, h * TILE));
      } else if (roll < .58 && lvl >= T.spike_from) {         // spikes, with sparks over them for the bold
        flat(8, h); const n = 2 + (r() < d ? 1 : 0);
        for (let i = 0; i < n; i++) { ST.spike[c0 + 3 + i] = 1; ST.sparks.push(spark((c0 + 3 + i) * TILE + 4, (h - 3) * TILE)); }
      } else if (roll < .65 && lvl >= T.vent_from) {          // vents that fire in turn
        flat(8, h); ST.vents.push({ c: c0 + 2, row: h, o: 0 }); ST.vents.push({ c: c0 + 5, row: h, o: (T.vent_on_s + T.vent_off_s) / 2 });
        ST.sparks.push(spark((c0 + 3) * TILE + 9, h * TILE - 10));
      } else if (roll < .73 && meets('turret')) {             // a turret on a pedestal
        flat(3, h); col(h - 1); ST.foes.push(foe('turret', (c0 + 3) * TILE, (h - 1) * TILE)); flat(4, h);
      } else {                                               // open ground, sparks and a machine
        const w = 5 + ((r() * 3) | 0); flat(w, h);
        for (let i = 1; i < w - 1; i += 2) if (r() < .7) ST.sparks.push(spark((c0 + i) * TILE + 4, h * TILE - 10 - (i % 4 === 1 ? 6 : 0)));
        ST.foes.push(foe(pickFoe(r, d), (c0 + w - 2) * TILE, h * TILE));
      }
    }
  }
  const BUILD0 = () => Object.fromEntries(RS.upgrades.list.map((u) => [u.slug, 0]));
  function newStage(week) {
    const wilds = week === 0, runs = S.play.wilds.runs, seed = wilds ? `wilds/${runs}` : `stage/${week}`, hp = hearts();
    const biomes = wildsBiomes();
    ST = { week, wilds, rnd: rng(E.hash(seed)), urnd: rng(E.hash(seed + '/upgrades')), ground: [], plat: [], plat2: [], crack: [], chp: [], spike: [], len: 0, h: GROUND_ROW,
      foes: [], sparks: [], posts: [], movers: [], vents: [], caches: [], arenas: [], goal: -1, goalAt: -1, lockL: -1, lockR: -1,
      nextBoss: wilds ? RS.bosses.wilds_first_tiles : Infinity, nextPost: wilds ? RS.wilds.checkpoint_tiles : Infinity, nextCache: RS.terrain.cache_first_tiles, bossN: 0,
      hard: S.play.hard, spd: S.play.hard ? RS.hard.speed : 1, mult: S.play.hard ? RS.hard.score : 1, cont: wilds || S.play.hard ? 0 : RS.continues,
      k: { x: 30, y: 0, vx: 0, vy: 0, face: 1, air: true, cd: 0, step: 0, inv: 0, hp, max: hp, safe: 30, cpx: 30, coy: 0, buf: 0, dash: 0, dashCd: 0, airDash: false, dj: false, hold: 0, full: false, ride: null, hurtT: 0, squash: 0, shield: false, shT: 0, trail: 0, dashId: 0, bud: 0 },
      up: BUILD0(), mod: { cd: 1 / RS.keeper.fire_per_s, charge: RS.moves.charge_s, chargeDmg: RS.moves.charge_damage, dashCd: 1, dj: unlocked('double_jump'), magnet: 0, shieldS: 0 }, buildStr: '', picks: 0,
      shots: Array.from({ length: 28 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 1, pierce: 0, big: false, last: -1 })),
      eb: Array.from({ length: 24 }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, kind: 0, t: 0 })),
      bits: Array.from({ length: 90 }, () => ({ t: 0, x: 0, y: 0, vx: 0, vy: 0, c: 0, g: 300 })), pops: Array.from({ length: 8 }, () => ({ t: 0, x: 0, y: 0, s: '' })),
      boss: { on: false, dead: 0, type: '', x: 0, y: 0, vx: 0, vy: 0, hp: 0, max: 1, st: '', t: 0, n: 0, face: -1, hit: 0, phase: 1, tx: 0, w: 0, h: 0, up: 0, shots: 0, name: '', arena: null, gy: 0, x0: 0, x1: 0 },
      camX: 0, camRow: GROUND_ROW, camTo: GROUND_ROW, score: 0, scoreSeen: -1, scoreStr: '0', combo: 0, comboT: 0, comboBest: 0, name: wilds ? BANK.stage.title_wilds : fill(BANK.stage.title_week, { n: week }), got: 0, time: 0, clean: true, done: false, far: 0, title: 2.2,
      banner: 0, shake: 0, freeze: 0, flash: 0, near: null, biomes, biomeI: 0, kills: 0, downed: 0 };
    setBiome(wilds ? biomes[runs % biomes.length] : RS.biomes.weeks[(week - 1) % RS.biomes.weeks.length]);
    for (let i = 0; i < 9; i++) col(GROUND_ROW);
    if (wilds) { grow(60); }
    else {
      const total = RS.length_tiles + (week - 1) * RS.length_per_week, lessons = (PLAN.weeks.find((w) => w.n === week) || { lessons: [] }).lessons, stops = Math.max(lessons.length, RS.checkpoints_min);
      for (let i = 0; i < stops; i++) { grow(Math.max(4, Math.round(total * (i + 1) / (stops + 1)) - ST.len)); flat(4, ST.h); ST.posts.push(post(lessons[i] || null, ST.len - 3, i + 1, lessons.length)); }   // a lesson's waypoint is a checkpoint; a week with few lessons still has its checkpoints
      grow(Math.max(4, total - ST.len));
      flat(4, ST.h); arena(); flat(6, ST.h);
      ST.goalAt = (ST.len - 5) * TILE;   // the goal stands once the boss is down
    }
    ST.k.y = GROUND_ROW * TILE - KH; ST.totalSparks = ST.sparks.filter((s) => s.lock < 0).length;
    tap.jump = tap.fire = tap.dash = false;
    music(BIO.def.song); ST.perkDue = unlocked('perk');   // a starting pick, once play score has opened the slot
  }
  /** The biomes the Wilds may wear: the ones play score has opened. */
  function wildsBiomes() { return RS.biomes.list.filter((b) => S.play.life >= b.at).map((b) => b.slug); }
  function boxHits(x, y, w, h) { const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE), r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE); for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) return true; return false; }
  // particles: one pool, colours by index, nothing allocated when one flies
  const BIT_COL = ['#ffe08a', '#c94a7c', '#9ff0d8', '#ffffff', '#ff9a3c', '#b9a98c', '#ff4d5e'];
  function burst(x, y, n = 6, c = 0, sp = 1) { let m = 0; for (let i = 0; i < ST.bits.length && m < n; i++) { const b = ST.bits[i]; if (b.t > 0) continue; b.t = .3 + (m % 3) * .1; b.x = x; b.y = y; b.vx = (m - (n - 1) / 2) * 16 * sp + ((i * 7) % 5 - 2) * 4; b.vy = (-40 - ((m * 37) % 5) * 14) * sp; b.c = c < 0 ? m % 5 : c; b.g = 300; m++; } }
  function puff(x, y, vx, vy, c, life) { for (let i = 0; i < ST.bits.length; i++) { const b = ST.bits[i]; if (b.t > 0) continue; b.t = life; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.c = c; b.g = 0; return; } }
  const LABELS = new Map();
  /** '+120' and 'X3', each built once and kept: a kill allocates no string. */
  function label(pre, n) { const key = pre + n; let s = LABELS.get(key); if (!s) { s = key; LABELS.set(key, s); } return s; }
  function jolt(shake, freeze) { if (CALM) return; ST.shake = Math.max(ST.shake, shake); ST.freeze = Math.max(ST.freeze, freeze); }
  /** Play score for something done in a run: the combo and hard mode raise it. It is play: no XP, no level, no item, no castle piece (pillar 1). */
  function award(base, x, y, combo) {
    if (combo) { ST.combo = Math.min(RS.combo.cap, ST.combo + 1); ST.comboT = RS.combo.window_s; if (ST.combo > ST.comboBest) ST.comboBest = ST.combo; }
    const n = Math.round(base * (1 + Math.max(0, ST.combo - 1) * RS.combo.step) * ST.mult);
    ST.score += n; pop(ST.pops, x, y, label('+', n));
  }
  function shoot(big) {
    const k = ST.k, K = RS.keeper, M = RS.moves, x = k.x + (k.face > 0 ? KW - 1 : -3), y = k.y + 10;
    k.cd = ST.mod.cd;
    emit(x, y, k.face * (big ? M.charge_speed : K.shot_speed), 0, big ? ST.mod.chargeDmg : K.shot_damage, big ? 99 : ST.up.pierce, big);
    if (!big) for (let i = 1; i <= ST.up.spread; i++) { emit(x, y, k.face * K.shot_speed, -i * M.spread_vy, K.shot_damage, ST.up.pierce, false); emit(x, y, k.face * K.shot_speed, i * M.spread_vy, K.shot_damage, ST.up.pierce, false); }
    sfx(big ? 'charged' : 'shot'); puff(x, y, k.face * 30, -10, 2, .1); puff(x, y, k.face * 26, 12, 3, .1); if (big) { burst(x, y, 6, 2, .8); jolt(RS.juice.shake_hit, 0); }
  }
  function emit(x, y, vx, vy, dmg, pierce, big) { for (let i = 0; i < ST.shots.length; i++) { const s = ST.shots[i]; if (s.on) continue; s.on = true; s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.dmg = dmg; s.pierce = pierce; s.big = big; s.last = -1; return; } }
  function ebullet(x, y, vx, vy, g, kind) { for (let i = 0; i < ST.eb.length; i++) { const b = ST.eb[i]; if (b.on) continue; b.on = true; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.g = g; b.kind = kind; b.t = 0; return; } }
  function aim(x, y, tx, ty, sp) { const dx = tx - x, dy = ty - y, d = Math.max(1, Math.sqrt(dx * dx + dy * dy)); ebullet(x, y, dx / d * sp, dy / d * sp, 0, 0); }
  function hurt() {
    const k = ST.k; if (k.inv > 0 || ST.done) return;
    if (k.shield) { k.shield = false; k.shT = ST.mod.shieldS; k.inv = .6; sfx('clink'); burst(k.x + KW / 2, k.y + 8, 8, 2); return; }   // the shield takes it
    k.hp--; k.inv = RS.keeper.invulnerable_s; k.hurtT = .35; ST.clean = false; k.vy = -90; k.dash = 0; ST.combo = 0;
    sfx('hurt'); burst(k.x + KW / 2, k.y + 8, 8, 6); jolt(RS.juice.shake_hurt, RS.juice.hitstop_hurt_s); if (!CALM) ST.flash = .5;
    if (k.hp <= 0) die();
  }
  /** Out of hull. A roadmap stage has a few restarts from the last checkpoint; the Wilds and hard mode have none. A death ends the run and keeps every unlock. */
  function die() {
    const k = ST.k;
    if (ST.cont > 0) { ST.cont--; if (ST.boss.on) bossReset(); k.hp = k.max; restand(k.cpx); k.inv = 1.5; $live.textContent = BANK.stage.offline; ticker(fill(BANK.stage.restart, { n: ST.cont }), ''); return; }
    finishStage(false);
  }
  function restand(x) { const k = ST.k, c = Math.floor((x + KW / 2) / TILE); k.x = x; k.y = (ST.ground[c] >= 0 ? ST.ground[c] : GROUND_ROW) * TILE - KH; k.vx = 0; k.vy = 0; k.dash = 0; k.ride = null; }
  function updateMovers(dt) {
    const k = ST.k; let ride = null;
    for (let i = 0; i < ST.movers.length; i++) {
      const m = ST.movers[i]; if (m.x1 < ST.camX - 60 || m.x0 > ST.camX + VW + 60) { m.dx = 0; continue; }
      const nx = m.x + m.vx * dt; m.dx = nx - m.x; m.x = nx; if (m.x <= m.x0) { m.x = m.x0; m.vx = Math.abs(m.vx); } else if (m.x >= m.x1) { m.x = m.x1; m.vx = -Math.abs(m.vx); }
      // a one-way deck: the Keeper lands on it from above and rides it
      const feet = k.y + KH, hx = k.x + HBX;
      if (k.vy >= 0 && hx + HBW > m.x && hx < m.x + m.w && feet >= m.y - 1 && feet <= m.y + 5 + k.vy * dt) ride = m;
    }
    if (ride) { k.y = ride.y - KH; k.vy = 0; if (!boxHits(k.x + ride.dx + HBX, k.y + HBY, HBW, HBH)) k.x += ride.dx; }
    k.ride = ride;
  }
  function crackHit(c, dmg) {
    ST.chp[c] -= dmg; sfx('clink'); puff(c * TILE + 6, ST.crack[c] * TILE + 8, -20, -30, 5, .3);
    if (ST.chp[c] > 0) return;
    const top = ST.crack[c]; ST.crack[c] = -1;
    for (let i = 0; i < ST.caches.length; i++) if (ST.caches[i].c0 === c) ST.caches[i].open = true;
    burst(c * TILE + 6, top * TILE + 10, 12, 5, 1.2); sfx('break'); jolt(RS.juice.shake_hit, 0); ticker(BANK.stage.cache_open, '');
  }
  function updateStage(dt) {
    const k = ST.k, K = RS.keeper, M = RS.moves, T = RS.terrain; if (ST.done) return;
    if (ST.freeze > 0) { ST.freeze -= dt; return; }
    if (ST.perkDue) { ST.perkDue = false; offerUpgrade('perk'); return; }
    ST.time += dt; ST.title = Math.max(0, ST.title - dt); ST.banner = Math.max(0, ST.banner - dt); ST.shake = Math.max(0, ST.shake - dt); ST.flash = Math.max(0, ST.flash - dt * 3);
    if (ST.comboT > 0) { ST.comboT -= dt; if (ST.comboT <= 0) ST.combo = 0; }
    updateMovers(dt);
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), jumpTap = tap.jump, fireTap = tap.fire, dashTap = tap.dash; tap.jump = tap.fire = tap.dash = false;
    // the dash: a short burst that nothing can hurt, then a cooldown; once in the air
    k.dashCd -= dt;
    if (dashTap && k.dashCd <= 0 && k.dash <= 0 && !(k.air && k.airDash)) { k.dash = M.dash_s; k.dashCd = M.dash_cooldown_s * ST.mod.dashCd; k.inv = Math.max(k.inv, M.dash_invulnerable_s); if (dir) k.face = dir; if (k.air) k.airDash = true; k.dashId++; sfx('dash'); burst(k.x + KW / 2, k.y + KH - 3, 4, 3, .6); }
    if (k.dash > 0) { k.dash -= dt; k.vx = k.face * M.dash_speed; k.vy = 0; }
    else { k.vx = dir * K.speed; if (dir) { k.face = dir; k.step += dt * 11; } k.vy = Math.min(280, k.vy + K.gravity * dt); }
    // the jump: buffered a moment before landing, forgiven a moment after a ledge, cut short by a short press; a second one once play has opened it
    if (jumpTap) k.buf = M.buffer_s; else k.buf -= dt;
    k.coy = k.air ? k.coy - dt : M.coyote_s;
    if (k.buf > 0 && k.dash <= 0) {
      if (k.coy > 0) { k.vy = -K.jump; k.air = true; k.coy = 0; k.buf = 0; k.ride = null; sfx('jump'); puff(k.x + 4, k.y + KH, -14, -4, 5, .25); puff(k.x + 10, k.y + KH, 14, -4, 5, .25); }
      else if (k.dj) { k.dj = false; k.vy = -K.jump * M.double_jump; k.buf = 0; sfx('jump'); burst(k.x + KW / 2, k.y + KH, 5, 2, .5); }
    }
    if (!keys.jump && k.vy < -M.jump_cut && k.dash <= 0) k.vy = -M.jump_cut;   // a short press is a short hop
    const nx = k.x + k.vx * dt; if (!boxHits(nx + HBX, k.y + HBY, HBW, HBH)) k.x = nx; else if (k.dash > 0) k.dash = 0;
    const ny = k.y + k.vy * dt, was = k.air, fell = k.vy;
    if (boxHits(k.x + HBX, ny + HBY, HBW, HBH)) { if (k.vy > 0) k.y = Math.floor((ny + KH - 1) / TILE) * TILE - KH; k.vy = 0; } else if (!k.ride) k.y = ny;
    k.air = !k.ride && !boxHits(k.x + HBX, k.y + HBY + 1, HBW, HBH);   // standing is a probe one pixel down, so the ground is steady under the feet
    if (!k.air) {
      if (was && fell > 120) { k.squash = .09; sfx('land'); puff(k.x + 3, k.y + KH - 1, -22, -6, 5, .25); puff(k.x + 11, k.y + KH - 1, 22, -6, 5, .25); }
      k.airDash = false; k.dj = ST.mod.dj;
      const c = Math.floor((k.x + KW / 2) / TILE), g = ST.ground[c];
      if (!k.ride && g >= 0 && g * TILE === k.y + KH) { if (ST.spike[c]) hurt(); else if (ST.crack[c] < 0) k.safe = c * TILE; }
    }
    if (k.y > ROWS * TILE + 20) { const sh = k.shield; k.inv = 0; k.shield = false; hurt(); k.shield = sh; if (!ST.done && k.hp > 0 && k.y > ROWS * TILE) restand(k.safe); if (ST.done) return; }
    if (!ST.wilds && k.x + HBX < 2 && keys.left && ST.lockL < 0) { leaveStage(); return; }
    k.inv = Math.max(0, k.inv - dt); k.cd -= dt; k.hurtT = Math.max(0, k.hurtT - dt); k.squash = Math.max(0, k.squash - dt);
    if (k.dash > 0 || (k.vx && !k.air && ((k.step * 2) | 0) % 5 === 0)) { k.trail -= dt; if (k.trail <= 0) { k.trail = .05; puff(k.x + KW / 2 - k.face * 5, k.y + KH - 2, -k.face * 12, -8, k.dash > 0 ? 2 : 5, .22); } }
    if (!k.shield && ST.mod.shieldS > 0) { k.shT -= dt; if (k.shT <= 0) { k.shield = true; sfx('ready'); } }
    // fire: a press is a shot; held, the charge builds, and the release lets it go
    if (fireTap && k.cd <= 0) shoot(false);
    if (keys.fire) { k.hold += dt; if (k.hold >= ST.mod.charge && !k.full) { k.full = true; sfx('ready'); } }
    else { if (k.full) shoot(true); k.hold = 0; k.full = false; }
    for (let i = 0; i < ST.up.buddy; i++) {   // a companion's own shots, at the nearest machine in its reach
      k.bud -= dt; if (k.bud > 0) break; const bx = k.x + KW / 2 + Math.cos(ST.time * 2 + i * 3.1) * 14, by = k.y - 3 + Math.sin(ST.time * 3 + i * 3.1) * 4;
      let best = -1, bd = RS.upgrades.buddy_reach; for (let j = 0; j < ST.foes.length; j++) { const z = ST.foes[j]; if (!z.alive) continue; const dx = Math.abs(z.x + z.w / 2 - bx); if (dx < bd && Math.abs(z.y - by) < 60) { bd = dx; best = j; } }
      const B = ST.boss, tx = best >= 0 ? ST.foes[best].x + ST.foes[best].w / 2 : B.on && !B.dead ? B.x + B.w / 2 : NaN, ty = best >= 0 ? ST.foes[best].y + ST.foes[best].h / 2 : B.y + B.h / 2;
      if (tx === tx) { const dx = tx - bx, dy = ty - by, d = Math.max(1, Math.sqrt(dx * dx + dy * dy)); emit(bx, by, dx / d * K.shot_speed, dy / d * K.shot_speed, K.shot_damage, 0, false); k.bud = RS.upgrades.buddy_every_s / ST.up.buddy; }
    }
    for (let i = 0; i < ST.shots.length; i++) {
      const s = ST.shots[i]; if (!s.on) continue; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < ST.camX - 8 || s.x > ST.camX + VW + 8) { s.on = false; continue; }
      const c = Math.floor(s.x / TILE), r = Math.floor(s.y / TILE);
      if (solid(c, r)) { if (c >= 0 && c < ST.len && ST.crack[c] >= 0 && r >= ST.crack[c] && (ST.ground[c] < 0 || r < ST.ground[c])) crackHit(c, s.dmg); s.on = false; puff(s.x, s.y, -s.vx * .1, -20, 2, .12); }
    }
    updateFoes(dt); if (ST.done) return;
    updateBullets(dt); if (ST.done) return;
    updateBoss(dt); if (ST.done) return;
    // hazards: a vent's flame, on its own clock
    for (let i = 0; i < ST.vents.length; i++) { const v = ST.vents[i], x = v.c * TILE; if (x < ST.camX - 20 || x > ST.camX + VW + 20) continue; const ph = (ST.time + v.o) % (T.vent_on_s + T.vent_off_s); if (ph > T.vent_off_s && k.x + HBX + HBW > x + 2 && k.x + HBX < x + 10 && k.y + KH > v.row * TILE - T.vent_reach) hurt(); }
    if (ST.done) return;
    const mr = ST.mod.magnet;
    for (let i = 0; i < ST.sparks.length; i++) {
      const s = ST.sparks[i]; if (!s.on || (s.lock >= 0 && !ST.caches[s.lock].open)) continue; const dx = k.x + KW / 2 - (s.x + 2), dy = k.y + KH / 2 - (s.y + 2);
      if (mr > 0 && Math.abs(dx) < mr && Math.abs(dy) < mr) { s.x += Math.sign(dx) * 90 * dt; s.y += Math.sign(dy) * 90 * dt; }
      if (Math.abs(dx) < 9 && Math.abs(dy) < 12) { s.on = false; sfx('pickup'); if (s.big) { award(T.cache_score, s.x - 6, s.y - 8, false); relicFound(); burst(s.x + 3, s.y + 3, 10, -1); } else { award(RS.score.spark, s.x - 2, s.y - 6, false); if (s.lock < 0) ST.got++; puff(s.x + 2, s.y + 2, 0, -30, 0, .2); } }
    }
    for (let i = 0; i < ST.bits.length; i++) { const b = ST.bits[i]; if (b.t <= 0) continue; b.t -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += b.g * dt; }
    for (let i = 0; i < ST.pops.length; i++) if (ST.pops[i].t > 0) { ST.pops[i].t -= dt; ST.pops[i].y -= 12 * dt; }
    let near = null;
    for (let i = 0; i < ST.posts.length; i++) { const p = ST.posts[i]; if (Math.abs(p.x + 2 - (k.x + KW / 2)) < 12) { near = p; if (!p.hit) { reachPost(p); if (ST.done) return; } } }
    if (near !== ST.near) { ST.near = near; updateCard(); }
    if (ST.wilds) { const tile = Math.floor(k.x / TILE); if (tile > ST.far) { ST.score += Math.round((tile - ST.far) * RS.score.wilds_per_tile * ST.mult); ST.far = tile; } if (ST.len * TILE - k.x < VW * 2) grow(40); }
    else if (ST.goal > 0 && k.x + KW / 2 >= ST.goal) { finishStage(true); return; }
    for (let i = 0; i < ST.arenas.length; i++) { const a = ST.arenas[i]; if (!a.done && !ST.boss.on && k.x > (a.c0 + 2) * TILE && k.x < a.c1 * TILE) startBoss(a); }
    const lead = k.x - 56 + k.face * 10, to = ST.lockL >= 0 ? clamp(lead, ST.lockL * TILE, Math.max(ST.lockL * TILE, (ST.lockR + 1) * TILE - VW)) : clamp(lead, 0, Math.max(0, (ST.wilds ? ST.len + 99 : ST.len) * TILE - VW));
    ST.camX += (to - ST.camX) * Math.min(1, dt * 7);
    // the view rises and falls with the ground the Keeper is over, so a cliff top and a boss overhead are both on screen
    { const g = ST.boss.on ? ST.boss.arena.row : ST.ground[Math.floor((k.x + KW / 2) / TILE)]; if (g >= 0 && (!k.air || ST.boss.on)) ST.camTo = g; ST.camRow += (ST.camTo - ST.camRow) * Math.min(1, dt * 3.5); }
  }
  /** A checkpoint: the run restarts from here, the hull is patched, and the build grows by one pick of three. */
  function reachPost(p) {
    const k = ST.k; p.hit = true; k.cpx = Math.floor(p.x / TILE) * TILE; k.safe = k.cpx;
    if (k.hp < k.max) k.hp = Math.min(k.max, k.hp + RS.checkpoint.heal);
    sfx('checkpoint'); burst(p.x + 2, p.y, 8, 2); ticker(BANK.stage.checkpoint, '');
    offerUpgrade('checkpoint');
  }
  function relicFound() { S.play.caches++; const F = BANK.story.fragments; ticker(BANK.stage.relic, F[(S.play.caches - 1) % F.length]); }
  function finishStage(cleared) {
    if (ST.done) return; ST.done = true;
    const id = ST.wilds ? 'wilds' : `w${ST.week}`, lines = [];
    let score = ST.score, stars = 0;
    if (cleared) {
      const under = Math.max(0, Math.floor(RS.score.par_seconds - ST.time));
      score += Math.round((RS.score.clear + under * RS.score.per_second_under_par + (ST.clean ? RS.score.clean : 0)) * ST.mult);
      stars = 1 + (ST.totalSparks && ST.got / ST.totalSparks >= RS.stars.sparks_share ? 1 : 0) + (ST.clean ? 1 : 0);
      lines.push(BANK.stage.stars.clear); if (stars > 1 && ST.got / Math.max(1, ST.totalSparks) >= RS.stars.sparks_share) lines.push(BANK.stage.stars.sparks); if (ST.clean) lines.push(BANK.stage.stars.clean);
      teleAdd('stages_cleared');
    }
    if (ST.comboBest > 1) lines.push(fill(BANK.stage.combo_best, { n: ST.comboBest }));
    if (ST.downed) lines.push(fill(BANK.stage.bosses_down, { n: ST.downed }));
    if (ST.hard) lines.push(fill(BANK.stage.hard_line, { x: RS.hard.score }));
    // play powers play: this run's score joins the lifetime play score, and what that opens is kept whatever happens next
    const had = RS.meta.unlocks.filter((u) => S.play.life >= u.at).length;
    S.play.life += score;
    const opened = RS.meta.unlocks.filter((u) => S.play.life >= u.at).slice(had).map((u) => fill(BANK.meta.opened, { what: BANK.meta.names[u.slug] }));
    let best = false;
    if (ST.wilds) { S.play.wilds.runs++; if (score > S.play.wilds.best) { S.play.wilds.best = score; best = true; } }
    else { const b = S.play.best[id] || { score: 0, stars: 0 }; if (cleared && (score > b.score || stars > b.stars)) { best = score > b.score; S.play.best[id] = { score: Math.max(b.score, score), stars: Math.max(b.stars, stars) }; } }
    sfx(cleared ? 'clear' : 'over'); music('');
    saveNow(); teleSave(); showResult(cleared, score, stars, lines, best, opened);
  }
  function leaveStage() { S.screen = 'castle'; S.stage = null; ST = null; for (const kk in keys) keys[kk] = false; render(); ticker(BANK.stage.gate_home, ''); }
