// FIELDWORKS — the explorer out the gate (design D66 rework 2, D85+: the merged design, work order FW11).
// Pure, window-free, clock-free, storage-free; every number from rules.frontier. Like the castle module it is an
// IIFE on globalThis, so a <script> tag and node's vm load it the same way, and the tests run it without a page.
//   camOf / project   the mid-angle camera: ground on an axis-aligned grid running straight up the screen (no
//                     diamonds), tilted ~62° down, heights rising up the screen and leaning a little away from the
//                     screen's centre, so a building shows its roof, its front wall and the side that faces the middle
//   regionOf          one region, grown from a seed: ground, the road straight up the middle, rocks, rubble, ruins,
//                     pylons, glowing cracks, ember vents, debris, crates and where the machines wait
//   regionsOpen       which regions are open: a pure function of the castle's pieces (evidence) and nothing a run does
//   newRun / stepRun  a run as ONE fixed-step function over pooled arrays: it allocates nothing per step
//   partnerOf …       the robot partner (FW13): a build of four parts, its stats, a code to share or import, a random
//                     build, an upgrade's price. In a run the partner follows or hunts, fights, builds turrets, goes down
//                     and reboots; every number from rules.frontier.partner
// Nothing here reads or writes the evidence. A run's score and scrap are play, kept by the page as play.
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  function rngOf(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** FNV-1a over a string: the seed of a region from its name and the run's number. */
  function hashOf(s) { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  const between = (r, ab) => ab[0] + r() * (ab[1] - ab[0]);

  // ── the camera ───────────────────────────────────────────────────────────
  /**
   * The mid-angle camera. World x runs right, world y runs DOWN the screen (south), z runs up out of the ground.
   * Ground: screen y = (y - camY) × sin(tilt). Height: z × cos(tilt) up the screen. A raised point also moves away
   * from the screen's centre by (x - camX) × z × lean, so a tall thing leans out and shows its inner side.
   */
  function camOf(rules) {
    const C = rules.frontier.camera, t = C.tilt_deg * Math.PI / 180;
    return { sin: Math.sin(t), cos: Math.cos(t), lean: C.lean, anchor: C.anchor, units: C.view_units, x: 0, y: 0, zoom: 1, vw: 1, vh: 1 };
  }
  /** Fit the camera to a surface of vw × vh pixels: view_units of world across the narrower side. */
  function camFit(cam, vw, vh) { cam.vw = vw; cam.vh = vh; cam.zoom = Math.min(vw, vh * 1.25) / cam.units; return cam; }
  /** Where a world point lands on the surface, written into `out` (no object made). */
  function project(cam, x, y, z, out) {
    const dx = x - cam.x, dy = y - cam.y;
    out.x = cam.vw / 2 + (dx + dx * z * cam.lean) * cam.zoom;
    out.y = cam.vh * cam.anchor + (dy * cam.sin - z * cam.cos) * cam.zoom;
    return out;
  }
  /** Follow a point, eased, and never show past the region's edges. */
  function camFollow(cam, x, y, dt, map, rules) {
    const k = 1 - Math.exp(-dt * rules.frontier.camera.follow), halfW = cam.vw / 2 / cam.zoom;
    cam.x += (x - cam.x) * k; cam.y += (y - cam.y) * k;
    const w = map.cols * map.tile; cam.x = Math.max(halfW, Math.min(w - halfW, cam.x));
    const below = cam.vh * (1 - cam.anchor) / (cam.sin * cam.zoom), above = cam.vh * cam.anchor / (cam.sin * cam.zoom), h = map.rows * map.tile;
    cam.y = Math.max(Math.min(above, h / 2), Math.min(h - below, cam.y));   // never show past the region's south or north edge
  }

  // ── a region ─────────────────────────────────────────────────────────────
  const KINDS = ['rock', 'rubble', 'ruin', 'pylon', 'crack', 'vent', 'debris', 'crate'];
  /**
   * One region from its seed. The road runs straight up the middle; the castle's gate sits at the south end of the
   * first region. Props never sit on the road or in the gate's yard; solid ones go in a grid of cells for collision.
   */
  function regionOf(index, run, rules) {
    const X = rules.frontier, R = X.regions[index], tile = X.tile, cols = X.cols, rows = X.rows;
    const seed = hashOf(`${R.slug}/${run}`), r = rngOf(seed);
    const roadC0 = Math.floor(cols / 2 - X.road_w / 2), roadC1 = roadC0 + X.road_w - 1;
    const ground = new Uint8Array(cols * rows);
    for (let i = 0; i < ground.length; i++) { const v = r(); ground[i] = v < .5 ? 0 : v < .75 ? 1 : v < .92 ? 2 : 3; }
    const yard = index === 0 ? X.castle.yard_rows : 1;   // the first region's south end is the castle and its yard
    const props = [];
    const free = (c, rw, span) => c + span < roadC0 - 0 || c > roadC1 + 0 ? rw < rows - yard - 1 && rw > 1 : false;
    for (const kind of KINDS) {
      const P = X.props[kind], n = Math.round(P.per100 * cols * rows / 100 * (1 + index * X.density_per_region));
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 8; tries++) {
          const w = P.w ? between(r, P.w) : P.r ? between(r, P.r) * 2 : tile, span = Math.ceil(w / tile);
          const c = Math.floor(r() * (cols - span)), rw = Math.floor(r() * rows);
          if (!free(c, rw, span)) continue;
          const d = P.d ? between(r, P.d) : w, h = P.h ? between(r, P.h) : 0;
          props.push({ kind, x: c * tile + r() * (tile - 1), y: rw * tile + r() * (tile - 1), w, d, h, solid: !!P.solid, seed: (r() * 1e9) | 0, hp: P.hp || 0, open: false });
          break;
        }
      }
    }
    // the first region's south end: the castle's wall across, solid but for the gate on the road (drawn by the page)
    const gateY = (rows - 2) * tile;
    if (index === 0) {
      props.push({ kind: 'wall', x: 0, y: gateY, w: roadC0 * tile, d: tile * 1.2, h: 1, solid: true, seed: 0, hp: 0, open: false });
      props.push({ kind: 'wall', x: (roadC1 + 1) * tile, y: gateY, w: (cols - roadC1 - 1) * tile, d: tile * 1.2, h: 1, solid: true, seed: 0, hp: 0, open: false });
    }
    props.sort((a, b) => a.y - b.y);
    // the solid grid: each cell lists the solid props that touch it
    const cell = X.cell, gw = Math.ceil(cols * tile / cell), gh = Math.ceil(rows * tile / cell), grid = Array.from({ length: gw * gh }, () => []);
    props.forEach((p, i) => {
      if (!p.solid) return;
      for (let gy = Math.max(0, Math.floor(p.y / cell)); gy <= Math.min(gh - 1, Math.floor((p.y + p.d) / cell)); gy++)
        for (let gx = Math.max(0, Math.floor(p.x / cell)); gx <= Math.min(gw - 1, Math.floor((p.x + p.w) / cell)); gx++) grid[gy * gw + gx].push(i);
    });
    // where the machines wait: away from the road's south end, more the deeper the region
    const spawns = [], nFoes = X.foes.per_region[Math.min(index, X.foes.per_region.length - 1)];
    for (let i = 0; i < nFoes; i++) {
      const y = between(r, [tile * 3, (rows - yard - 6) * tile]), x = between(r, [tile, (cols - 1) * tile]);
      const kinds = X.foes.by_region[Math.min(index, X.foes.by_region.length - 1)];
      spawns.push({ x, y, type: kinds[Math.floor(r() * kinds.length)] });
    }
    return { index, slug: R.slug, seed, tile, cols, rows, roadC0, roadC1, ground, props, grid, gw, gh, cell, spawns,
      start: { x: cols * tile / 2, y: (rows - yard + 1) * tile }, gate: { x: cols * tile / 2, y: gateY }, north: tile };
  }

  /** The regions open now: the first always (D80), each next one at its castle-piece count. Evidence opens the map; play never does. */
  function regionsOpen(pieces, rules) {
    let n = 0; const list = rules.frontier.regions;
    for (let i = 0; i < list.length; i++) if (i === 0 || pieces >= list[i].at) n = i + 1; else break;
    return n;
  }
  /** What the next sealed region needs: its index and how many more pieces, or null when every region is open. */
  function nextSeal(pieces, rules) {
    const open = regionsOpen(pieces, rules), R = rules.frontier.regions[open];
    return R ? { index: open, need: R.at - pieces } : null;
  }

  // ── a run ────────────────────────────────────────────────────────────────
  /** A run: `sealed` when the region past the north edge is not open yet. The Keeper, the pools (machines, shots, effects) made once at their caps, the region and its camera. */
  function newRun(index, run, hp, sealed, rules, build) {
    const X = rules.frontier, K = X.keeper, map = regionOf(index, run, rules), P = X.partner, b = partnerOf(build, rules), ps = partnerStats(b, rules);
    const foes = Array.from({ length: X.foes.cap }, () => ({ on: false, type: '', x: 0, y: 0, vx: 0, vy: 0, hp: 0, max: 0, r: 0, t: 0, hit: 0, cd: 0, face: 1, wake: false }));
    const shots = Array.from({ length: X.shots.cap }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, foe: false, dmg: 0 }));
    const fx = Array.from({ length: X.fx.cap }, () => ({ t: 0, kind: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
    const turrets = Array.from({ length: P.turret.cap }, () => ({ on: false, x: 0, y: 0, hp: 0, max: 0, cd: 0, life: 0, aim: 0 }));
    const W = { map, index, run, sealed: !!sealed, bump: 0, time: 0, acc: 0, score: 0, scrap: 0, kills: 0, over: false, won: false, exit: 0,
      k: { x: map.start.x, y: map.start.y, vx: 0, vy: 0, fx: 0, fy: -1, r: K.radius, hp, max: hp, power: K.power_max, pmax: K.power_max, dash: 0, dashCd: 0, cd: 0, inv: 0, step: 0, aim: -1 },
      p: { up: true, x: map.start.x + P.follow_gap, y: map.start.y + P.follow_gap * .5, vx: 0, vy: 0, r: P.radius, hp: ps.hp, max: ps.hp, power: ps.pmax, pmax: ps.pmax,
        mode: 0, cd: 0, down: 0, inv: 0, heal: 0, t: 0, step: 0, face: 1, target: -1, swing: 0, kills: 0, b, s: ps },
      foes, shots, fx, turrets, fxAt: 0, hits: 0, shake: 0, said: 0 };
    for (let i = 0; i < map.spawns.length && i < foes.length; i++) wake(W, i, map.spawns[i], rules);
    return W;
  }
  function wake(W, i, s, rules) {
    const F = rules.frontier.foes.kinds[s.type], f = W.foes[i];
    f.on = true; f.type = s.type; f.x = s.x; f.y = s.y; f.vx = 0; f.vy = 0; f.hp = F.hp; f.max = F.hp; f.r = F.radius; f.t = (i * 0.37) % 1; f.hit = 0; f.cd = F.fire_s || 0; f.wake = false;
  }
  function emit(W, kind, x, y, z, vx, vy, vz, t) {
    const e = W.fx[W.fxAt]; W.fxAt = (W.fxAt + 1) % W.fx.length;
    e.kind = kind; e.x = x; e.y = y; e.z = z; e.vx = vx; e.vy = vy; e.vz = vz; e.t = t;
  }
  /** Push a circle out of every solid prop near it. A climber (walker legs) goes over rocks. */
  function collide(map, o, climb) {
    const gx = Math.floor(o.x / map.cell), gy = Math.floor(o.y / map.cell);
    for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= map.gw || yy >= map.gh) continue;
      const list = map.grid[yy * map.gw + xx];
      for (let j = 0; j < list.length; j++) {
        const p = map.props[list[j]]; if (p.open || (climb && p.kind === 'rock')) continue;
        const nx = Math.max(p.x, Math.min(o.x, p.x + p.w)), ny = Math.max(p.y, Math.min(o.y, p.y + p.d));
        const dx = o.x - nx, dy = o.y - ny, d2 = dx * dx + dy * dy;
        if (d2 >= o.r * o.r) continue;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), push = o.r - d; o.x += dx / d * push; o.y += dy / d * push; }
        else { const l = o.x - p.x, rr = p.x + p.w - o.x, t = o.y - p.y, b = p.y + p.d - o.y, m = Math.min(l, rr, t, b);
          if (m === l) o.x = p.x - o.r; else if (m === rr) o.x = p.x + p.w + o.r; else if (m === t) o.y = p.y - o.r; else o.y = p.y + p.d + o.r; }
      }
    }
    const w = map.cols * map.tile, h = map.rows * map.tile;
    if (o.x < o.r) o.x = o.r; if (o.x > w - o.r) o.x = w - o.r; if (o.y > h - o.r) o.y = h - o.r; if (o.y < o.r) o.y = o.r;
  }
  /** The nearest awake machine inside the aim cone of the facing (or anywhere in range when none is in the cone). */
  function aimAt(W, rules) {
    const K = rules.frontier.keeper, k = W.k, cone = Math.cos(K.aim_cone_deg * Math.PI / 360);
    let best = -1, bd = K.aim_range * K.aim_range, loose = -1, ld = bd;
    for (let i = 0; i < W.foes.length; i++) {
      const f = W.foes[i]; if (!f.on) continue;
      const dx = f.x - k.x, dy = f.y - k.y, d2 = dx * dx + dy * dy; if (d2 > bd && d2 > ld) continue;
      const d = Math.sqrt(d2) || 1, dot = (dx * k.fx + dy * k.fy) / d;
      if (dot >= cone && d2 < bd) { bd = d2; best = i; }
      if (d2 < ld) { ld = d2; loose = i; }
    }
    return best >= 0 ? best : loose;
  }
  function shoot(W, x, y, dx, dy, speed, life, dmg, foe) {
    for (let i = 0; i < W.shots.length; i++) {
      const s = W.shots[i]; if (s.on) continue;
      const d = Math.hypot(dx, dy) || 1; s.on = true; s.x = x; s.y = y; s.vx = dx / d * speed; s.vy = dy / d * speed; s.life = life; s.dmg = dmg; s.foe = foe;
      return true;
    }
    return false;
  }
  function hurtKeeper(W, n, rules) {
    const k = W.k; if (k.inv > 0 || W.over) return;
    k.hp -= n; k.inv = rules.frontier.keeper.invulnerable_s; W.shake = .25; W.hits++;
    if (k.hp <= 0) { k.hp = 0; W.over = true; W.won = false; }
  }
  function killFoe(W, f, rules) {
    const F = rules.frontier.foes.kinds[f.type];
    f.on = false; W.kills++; W.score += F.score; W.scrap += F.scrap;
    for (let j = 0; j < 8; j++) emit(W, 1, f.x, f.y, 6, Math.cos(j * .785) * 40, Math.sin(j * .785) * 40, 30 + (j % 3) * 20, .5);
  }
  /**
   * One step of a run. `input` is { ax, ay, fire, dash } (the stick's push, -1..1, and two held buttons); `pressed`
   * holds the press edges { dash, bot, build }. Fixed step inside, so a slow frame plays the same game as a fast one.
   * A press lands on the first tick of the frame only, so one tap is one dash, one order or one turret.
   */
  function stepRun(W, input, pressed, dt, rules) {
    const X = rules.frontier, STEP = 1 / X.step_hz;
    W.acc = Math.min(W.acc + dt, STEP * X.max_steps);
    let edges = pressed ? (pressed.dash ? 1 : 0) | (pressed.bot ? 2 : 0) | (pressed.build ? 4 : 0) : 0;
    while (W.acc >= STEP - 1e-9) { W.acc -= STEP; tick(W, input, edges, STEP, rules); edges = 0; }
    for (let i = 0; i < W.fx.length; i++) { const e = W.fx[i]; if (e.t <= 0) continue; e.t -= dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z = Math.max(0, e.z + e.vz * dt); e.vz -= 140 * dt; }
    if (W.shake > 0) W.shake = Math.max(0, W.shake - dt);
    if (W.bump > 0) W.bump = Math.max(0, W.bump - dt);
  }
  function tick(W, input, edges, dt, rules) {
    const X = rules.frontier, K = X.keeper, k = W.k, map = W.map, dashEdge = edges & 1;
    W.time += dt; if (W.over) return;
    // move: the stick's push, or a dash along the facing
    const ax = input.ax || 0, ay = input.ay || 0, m = Math.hypot(ax, ay);
    if (m > .05) { k.fx = ax / m; k.fy = ay / m; }
    if (dashEdge && k.dash <= 0 && k.dashCd <= 0 && k.power >= K.dash_power) { k.dash = K.dash_s; k.dashCd = K.dash_cooldown_s; k.power -= K.dash_power; k.inv = Math.max(k.inv, K.dash_s); emit(W, 2, k.x, k.y, 2, 0, 0, 0, .3); }
    const sp = k.dash > 0 ? K.dash_speed : K.speed * Math.min(1, m);
    k.vx = k.dash > 0 ? k.fx * sp : ax / (m || 1) * sp; k.vy = k.dash > 0 ? k.fy * sp : ay / (m || 1) * sp;
    k.x += k.vx * dt; k.y += k.vy * dt; collide(map, k);
    if (m > .05 || k.dash > 0) k.step += dt * (k.dash > 0 ? 14 : 9);
    k.dash = Math.max(0, k.dash - dt); k.dashCd = Math.max(0, k.dashCd - dt); k.inv = Math.max(0, k.inv - dt); k.cd = Math.max(0, k.cd - dt);
    k.power = Math.min(k.pmax, k.power + K.power_regen * dt);
    // fire: at the nearest machine in the cone, else straight along the facing
    k.aim = aimAt(W, rules);
    if (input.fire && k.cd <= 0 && k.power >= K.fire_power) {
      const f = k.aim >= 0 ? W.foes[k.aim] : null, dx = f ? f.x - k.x : k.fx, dy = f ? f.y - k.y : k.fy;
      if (shoot(W, k.x, k.y, dx, dy, K.shot_speed, K.shot_range / K.shot_speed, K.shot_damage, false)) { k.cd = 1 / K.fire_per_s; k.power -= K.fire_power; emit(W, 3, k.x + k.fx * 6, k.y + k.fy * 6, 8, 0, 0, 0, .08); }
    }
    // the machines: they wake when the Keeper comes near, then chase; drones keep their distance and fire
    for (let i = 0; i < W.foes.length; i++) {
      const f = W.foes[i]; if (!f.on) continue; const F = X.foes.kinds[f.type];
      f.t += dt; f.hit = Math.max(0, f.hit - dt);
      const dx = k.x - f.x, dy = k.y - f.y, d = Math.hypot(dx, dy) || 1;
      if (!f.wake && d < X.foes.aggro) f.wake = true;
      if (!f.wake) continue;
      const want = F.keep ? (d > F.keep ? 1 : d < F.keep * .7 ? -1 : 0) : 1;
      f.vx = dx / d * F.speed * want; f.vy = dy / d * F.speed * want; f.face = dx >= 0 ? 1 : -1;
      f.x += f.vx * dt; f.y += f.vy * dt; collide(map, f);
      if (F.fire_s) { f.cd -= dt; if (f.cd <= 0 && d < X.foes.aggro) { f.cd = F.fire_s; shoot(W, f.x, f.y, dx, dy, F.shot_speed, X.foes.aggro / F.shot_speed, 1, true); } }
      if (d < f.r + k.r) hurtKeeper(W, F.touch, rules);
    }
    partnerTick(W, edges, dt, rules);
    turretTick(W, dt, rules);
    // the shots
    for (let i = 0; i < W.shots.length; i++) {
      const s = W.shots[i]; if (!s.on) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || solidAt(map, s.x, s.y)) { s.on = false; emit(W, 4, s.x, s.y, 6, 0, 0, 20, .15); continue; }
      if (s.foe) { if (Math.hypot(s.x - k.x, s.y - k.y) < k.r + 2) { s.on = false; hurtKeeper(W, s.dmg, rules); }
        else if (W.p.up && Math.hypot(s.x - W.p.x, s.y - W.p.y) < W.p.r + 2) { s.on = false; hurtPartner(W, s.dmg, rules); } continue; }
      for (let j = 0; j < W.foes.length; j++) {
        const f = W.foes[j]; if (!f.on || Math.hypot(s.x - f.x, s.y - f.y) > f.r + 2) continue;
        s.on = false; f.hp -= s.dmg; f.hit = .12; f.wake = true; emit(W, 4, s.x, s.y, 6, 0, 0, 20, .15);
        if (f.hp <= 0) killFoe(W, f, rules);
        break;
      }
    }
    // crates: walk into one and it opens for scrap
    const near = Math.floor(k.y / map.cell), nearP = W.p.up && W.p.s.pickup ? Math.floor(W.p.y / map.cell) : near;
    for (let i = 0; i < map.props.length; i++) {
      const p = map.props[i]; if (p.kind !== 'crate' || p.open) continue;
      const row = Math.floor(p.y / map.cell); if (Math.abs(row - near) > 1 && Math.abs(row - nearP) > 1) continue;
      const q = W.p, grab = q.up && q.s.pickup && q.x > p.x - q.r && q.x < p.x + p.w + q.r && q.y > p.y - q.r && q.y < p.y + p.d + q.r;
      if (grab || (k.x > p.x - k.r && k.x < p.x + p.w + k.r && k.y > p.y - k.r && k.y < p.y + p.d + k.r)) { p.open = true; W.scrap += X.props.crate.scrap + (q.up ? Math.round(q.s.carry) : 0); W.score += X.props.crate.score; for (let j = 0; j < 6; j++) emit(W, 5, p.x + p.w / 2, p.y + p.d / 2, 6, Math.cos(j) * 30, Math.sin(j) * 30, 50, .6); }
    }
    // the region's ends: back through the gate at the south, on to the next region at the north
    if (k.y <= map.north && W.sealed) { k.y = map.north + 1; W.bump = .6; }   // the next region is sealed until the castle has its pieces
    else if (k.y <= map.north) { W.exit = 1; W.over = true; W.won = true; }
    else if (W.index === 0 ? k.y > map.gate.y + map.tile * 1.4 : k.y > map.rows * map.tile - map.tile) { W.exit = -1; W.over = true; W.won = true; }
  }
  function solidAt(map, x, y) {
    const gx = Math.floor(x / map.cell), gy = Math.floor(y / map.cell);
    if (gx < 0 || gy < 0 || gx >= map.gw || gy >= map.gh) return true;
    const list = map.grid[gy * map.gw + gx];
    for (let j = 0; j < list.length; j++) { const p = map.props[list[j]]; if (!p.open && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.d) return true; }
    return false;
  }

  // ── the partner (FW13) ───────────────────────────────────────────────────
  // Four slots (a base, a tool, a sensor head and a power core), one part each, every part loosely after a real class of
  // robot and named generically. A part adds its stats to the partner's base; each upgrade level adds its `up` once more.
  const FLAGS = ['climb', 'fly', 'pickup', 'scan', 'weakest'];
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  /** A build from anything (a saved record, a parsed code, nothing): known parts only, whole levels clamped; an unknown or missing slot takes the default part. */
  function partnerOf(b, rules) {
    const P = rules.frontier.partner, src = b && typeof b === 'object' ? b : {}, lv = src.lv && typeof src.lv === 'object' ? src.lv : {}, out = { lv: {} };
    for (const slot of P.slots) {
      const v = src[slot]; out[slot] = typeof v === 'string' && own(P.parts[slot], v) ? v : P.default[slot];
      for (const id of Object.keys(P.parts[slot])) { const n = own(lv, id) ? lv[id] : 0; if (Number.isInteger(n) && n > 0) out.lv[id] = Math.min(P.max_level, n); }
    }
    return out;
  }
  /** What a build can do: the base's numbers, each part's added, each upgrade's added per level, each kept inside its limits; and the parts' perks as flags. */
  function partnerStats(b, rules) {
    const P = rules.frontier.partner, s = {};
    for (const k of Object.keys(P.base)) s[k] = P.base[k];
    for (const f of FLAGS) s[f] = false;
    for (const slot of P.slots) {
      const part = P.parts[slot][b[slot]], n = b.lv[b[slot]] || 0;
      for (const k of Object.keys(part.stats)) s[k] += part.stats[k];
      for (const k of Object.keys(part.up)) s[k] += part.up[k] * n;
      for (const f of FLAGS) if (part[f]) s[f] = true;
    }
    for (const k of Object.keys(P.limits)) s[k] = Math.max(P.limits[k][0], Math.min(P.limits[k][1], s[k]));
    return s;
  }
  /** A build as a short code to keep or share: the prefix and the four part names. Upgrades stay out; they are earned. */
  function partnerCode(b, rules) {
    const P = rules.frontier.partner; let c = P.code_prefix;
    for (const slot of P.slots) c += ' ' + b[slot];
    return c;
  }
  /**
   * The parts a pasted code names, or null when it names none. A code is read as words (letters, digits and hyphens);
   * a word is a part's own name or a generic robot kind or component class from the SOAR catalogue's taxonomy that the
   * rules map to a part (lidar, quadruped, cobot-arm, battery …). Anything else, a brand's robot id included, is ignored.
   * Only the first word for each slot counts. It returns the four parts and no levels, never anything the text carried.
   */
  function partnerParse(text, rules) {
    const P = rules.frontier.partner; if (typeof text !== 'string') return null;
    const words = text.slice(0, P.code_max).toLowerCase().split(/[^a-z0-9-]+/), out = {}; let n = 0;
    for (const w of words) {
      if (!w) continue;
      for (const slot of P.slots) {
        if (out[slot]) continue;
        for (const id of Object.keys(P.parts[slot])) if (w === id || P.parts[slot][id].soar.indexOf(w) >= 0) { out[slot] = id; n++; break; }
      }
    }
    if (!n) return null;
    const b = partnerOf(out, rules); return { base: b.base, tool: b.tool, head: b.head, core: b.core, named: n };
  }
  /** A random build from a seed (the page brings the seed): one part per slot. */
  function partnerRandom(seed, rules) {
    const P = rules.frontier.partner, r = rngOf(seed), out = { lv: {} };
    for (const slot of P.slots) { const ids = Object.keys(P.parts[slot]); out[slot] = ids[Math.floor(r() * ids.length) % ids.length]; }
    return out;
  }
  /** The scrap the next level of a slot's part costs, or 0 when it is at the top. */
  function upgradeCost(b, slot, rules) {
    const P = rules.frontier.partner, n = b.lv[b[slot]] || 0;
    return n >= P.max_level ? 0 : P.upgrade_cost[n];
  }
  /** One step of the partner: an order (Bot), a turret (Build), a target, a move, an attack, a repair, the hits it takes. */
  function partnerTick(W, edges, dt, rules) {
    const X = rules.frontier, P = X.partner, T = P.turret, p = W.p, s = p.s, k = W.k, map = W.map;
    p.t += dt; p.inv = Math.max(0, p.inv - dt); p.cd = Math.max(0, p.cd - dt); p.swing = Math.max(0, p.swing - dt);
    if (!p.up) {   // down: it reboots where it fell, then rejoins the Keeper with half its hull and power
      p.down -= dt;
      if (p.down <= 0) { p.up = true; p.hp = p.max * .5; p.power = p.pmax * .5; p.inv = 1; W.said = 4; }
      return;
    }
    if (edges & 2) { p.mode = p.mode ? 0 : 1; p.target = -1; W.said = p.mode ? 2 : 1; }
    if (edges & 4) {
      let u = -1; for (let i = 0; i < W.turrets.length; i++) if (!W.turrets[i].on) { u = i; break; }
      if (u < 0) W.said = 7;
      else if (p.power < T.power) W.said = 6;
      else { const q = W.turrets[u]; q.on = true; q.x = p.x; q.y = p.y; q.hp = s.turret_hp; q.max = s.turret_hp; q.cd = 0; q.life = T.life_s; q.aim = p.face > 0 ? 0 : Math.PI; p.power -= T.power; W.said = 5; emit(W, 2, p.x, p.y, 2, 0, 0, 0, .3); }
    }
    // a target: following, a machine near the Keeper; hunting, any machine it can see that is inside the leash around the
    // Keeper (so it stays on screen). A heat camera goes for the one with the least hull left; every other head, the nearest.
    const leash = P.leash, guard = p.mode ? s.sight : P.defend_range, ox = p.mode ? p.x : k.x, oy = p.mode ? p.y : k.y;
    let ti = -1, tv = Infinity;
    for (let i = 0; i < W.foes.length; i++) {
      const f = W.foes[i]; if (!f.on || (!p.mode && !f.wake)) continue;
      const d = Math.hypot(f.x - ox, f.y - oy); if (d > guard || Math.hypot(f.x - k.x, f.y - k.y) > leash) continue;
      const v = s.weakest ? f.hp * 1000 + d : d; if (v < tv) { tv = v; ti = i; }
    }
    p.target = ti;
    // move: to the target until in reach, else to its place a step behind the Keeper; faster to catch up when far
    let gx = k.x - k.fx * P.follow_gap, gy = k.y - k.fy * P.follow_gap, stop = 3;
    if (ti >= 0) { const f = W.foes[ti]; gx = f.x; gy = f.y; stop = s.reach * .8 + f.r; }
    const far = Math.hypot(k.x - p.x, k.y - p.y);
    if (far > P.regroup) { p.x = k.x - k.fx * P.follow_gap; p.y = k.y - k.fy * P.follow_gap; collide(map, p, s.climb); }   // lost behind a wall or left far behind: it rejoins
    const dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy), c = Math.floor(p.x / map.tile), road = c >= map.roadC0 && c <= map.roadC1;
    let sp = s.speed * (road ? s.road : s.rough);
    if (far > P.catch_up) sp = Math.max(sp * 1.5, X.keeper.speed * 1.15);   // falling behind: it hurries, whatever its base
    if (p.power <= 0) sp *= .5;
    if (d > stop) {
      const m = Math.min(sp * dt, d - stop); p.vx = dx / d * sp; p.vy = dy / d * sp; p.x += dx / d * m; p.y += dy / d * m;
      p.step += dt * (s.fly ? 20 : 9); p.power = Math.max(0, p.power - s.drain * dt); if (Math.abs(dx) > .5) p.face = dx >= 0 ? 1 : -1;
    } else { p.vx = 0; p.vy = 0; }
    if (s.fly) { const w = map.cols * map.tile, h = map.rows * map.tile; p.x = Math.max(p.r, Math.min(w - p.r, p.x)); p.y = Math.max(p.r, Math.min(h - p.r, p.y)); }
    else collide(map, p, s.climb);
    p.power = Math.min(p.pmax, p.power + s.regen * dt);
    // attack: in reach, cooled down and with the power for it
    if (ti >= 0 && p.cd <= 0 && p.power >= P.attack_power) {
      const f = W.foes[ti];
      if (Math.hypot(f.x - p.x, f.y - p.y) <= s.reach + f.r) {
        p.cd = s.attack_s; p.swing = .18; p.power -= P.attack_power; f.hp -= s.damage; f.hit = .12; f.wake = true;
        emit(W, 6, (p.x + f.x) / 2, (p.y + f.y) / 2, 7, 0, 0, 12, .14);
        if (f.hp <= 0) { killFoe(W, f, rules); p.kills++; p.target = -1; }
      }
    }
    // repair: an arm patches one hull point after staying close for repair_s
    if (s.repair_s > 0 && k.hp < k.max && Math.hypot(k.x - p.x, k.y - p.y) < P.repair_range) { p.heal += dt; if (p.heal >= s.repair_s) { p.heal = 0; k.hp = Math.min(k.max, k.hp + 1); emit(W, 7, k.x, k.y, 14, 0, 0, 24, .6); } }
    else if (k.hp >= k.max) p.heal = 0;
    // machines that run into it (a flier is out of their reach; drones' shots still find it)
    if (!s.fly) for (let i = 0; i < W.foes.length; i++) { const f = W.foes[i]; if (f.on && f.wake && Math.hypot(f.x - p.x, f.y - p.y) < f.r + p.r) hurtPartner(W, X.foes.kinds[f.type].touch, rules); }
  }
  /** A hit on the partner: armour takes its share; at no hull it goes down for its reboot time. */
  function hurtPartner(W, n, rules) {
    const p = W.p; if (!p.up || p.inv > 0) return;
    p.hp -= n * (1 - p.s.armour); p.inv = .5;
    if (p.hp <= 0) { p.hp = 0; p.up = false; p.down = p.s.reboot_s; p.target = -1; W.said = 3; for (let j = 0; j < 6; j++) emit(W, 1, p.x, p.y, 6, Math.cos(j) * 30, Math.sin(j) * 30, 40, .4); }
  }
  /** The turrets the partner built: each fires at the nearest machine in range until its time runs out or machines wreck it. */
  function turretTick(W, dt, rules) {
    const X = rules.frontier, T = X.partner.turret;
    for (let i = 0; i < W.turrets.length; i++) {
      const q = W.turrets[i]; if (!q.on) continue;
      q.life -= dt; q.cd = Math.max(0, q.cd - dt);
      let best = -1, bd = T.range;
      for (let j = 0; j < W.foes.length; j++) {
        const f = W.foes[j]; if (!f.on) continue;
        const d = Math.hypot(f.x - q.x, f.y - q.y); if (d < bd) { bd = d; best = j; }
        if (f.wake && d < f.r + T.radius) q.hp -= X.foes.kinds[f.type].touch * dt * 2;
      }
      if (best >= 0) {
        const f = W.foes[best]; q.aim = Math.atan2(f.y - q.y, f.x - q.x);
        if (q.cd <= 0 && shoot(W, q.x, q.y, f.x - q.x, f.y - q.y, T.shot_speed, T.range / T.shot_speed, T.damage, false)) { q.cd = T.fire_s; emit(W, 3, q.x + Math.cos(q.aim) * 5, q.y + Math.sin(q.aim) * 5, 9, 0, 0, 0, .08); }
      }
      if (q.life <= 0 || q.hp <= 0) { q.on = false; for (let j = 0; j < 5; j++) emit(W, 1, q.x, q.y, 6, Math.cos(j * 1.3) * 26, Math.sin(j * 1.3) * 26, 36, .4); }
    }
  }

  // ── the frame governor (FW12) ─────────────────────────────────────────────
  /**
   * Keeps a frame inside its budget on any phone. It is fed the milliseconds the frame's own work took (update and
   * drawing) and the time between frames; when the work runs over the budget for a moment it steps down one level
   * (a level is a detail tier and a render scale, from rules.frontier.govern.levels, best first), and when there has
   * been plenty of room for a while it steps back up. A step down soon after a step up doubles the wait before the
   * next step up, so it settles instead of see-sawing. A slow frame with little work of its own is the device holding
   * the page back (a power saver, a 30 Hz screen), not the scene: that never steps down. Pure: numbers in, numbers out.
   */
  function govOf(rules, scaleMax) {
    const L = rules.frontier.govern.levels, G = { level: 0, tier: 0, scale: 1, max: Math.max(1, scaleMax | 0), ms: 0, frame: 0, n: 0, over: 0, under: 0, wait: rules.frontier.govern.raise_after_s, since: 1e9, pin: -1, levels: L.length };
    return govSet(G, 0, rules);
  }
  /** Put the governor on a level (clamped), its tier and render scale from the rules; scale never above the device's. */
  function govSet(G, level, rules) {
    const L = rules.frontier.govern.levels, i = Math.max(0, Math.min(L.length - 1, level | 0));
    G.level = i; G.tier = L[i][0]; G.scale = Math.min(G.max, L[i][1]); return G;
  }
  /** One frame's measure. Returns true when the level changed (the screen then resizes or redraws what it caches). */
  function govern(G, workMs, frameMs, dt, rules) {
    const R = rules.frontier.govern, was = G.level, wasScale = G.scale, wasTier = G.tier;
    if (G.pin >= 0) { govSet(G, G.pin, rules); return G.tier !== wasTier || G.scale !== wasScale; }
    G.ms += (workMs - G.ms) * R.ema; G.frame += (frameMs - G.frame) * R.ema; G.n++; G.since += dt;
    if (G.n < R.warm_frames) return false;
    const heavy = G.ms > R.budget_ms || (G.frame > R.frame_ms_max && G.ms > R.budget_ms * R.own_share);
    const light = G.ms < R.budget_ms * R.raise_below && G.frame <= R.frame_ms_max;
    if (heavy) { G.over += dt; G.under = 0; } else if (light) { G.under += dt; G.over = 0; } else { G.over = 0; G.under = 0; }
    let step = 0;
    if (G.over >= R.drop_after_s) step = 1; else if (G.under >= G.wait) step = -1;
    // skip levels that change nothing on this device (a render scale it cannot have)
    let lv = G.level;
    if (step) { lv += step; while (lv >= 0 && lv < G.levels && R.levels[lv][0] === G.tier && Math.min(G.max, R.levels[lv][1]) === G.scale) lv += step; }
    if (!step || lv < 0 || lv >= G.levels) { if (step) { G.over = 0; G.under = 0; } return false; }
    if (step > 0 && G.since < G.wait * 2) G.wait = Math.min(R.backoff_max_s, G.wait * 2);   // it went up and could not hold it
    govSet(G, lv, rules); G.over = 0; G.under = 0; G.ms = Math.min(G.ms, R.budget_ms); G.since = step < 0 ? 0 : G.since;
    return G.level !== was && (G.tier !== wasTier || G.scale !== wasScale);
  }

  const api = { TAU, rngOf, hashOf, camOf, camFit, project, camFollow, KINDS, regionOf, regionsOpen, nextSeal, newRun, stepRun, solidAt, collide, aimAt, govOf, govSet, govern,
    partnerOf, partnerStats, partnerCode, partnerParse, partnerRandom, upgradeCost };
  if (typeof globalThis !== 'undefined') globalThis.FieldworksFrontier = api;
})();
