  // ══════════════════════ THE CASTLE SCREEN: it defends itself; the horde comes to it ══════════════════════
  const keys = { left: false, right: false, jump: false, fire: false, dash: false };
  const tap = { jump: false, fire: false, dash: false };   // a press shorter than a frame still counts once
  let CS = null;
  const fieldX = (x) => (x >= 0 ? FACE + 3 + x * (VW - FACE - 6) / RH.approach : FACE + x);
  function newCastleScene() {
    CS = { k: { x: 60, y: 0, vy: 0, face: 1, cd: 0, step: 0, air: false }, fight: null, acc: 0, bolt: { t: 0, x1: 0, y1: 0, x2: 0, y2: 0 }, stray: { x: -1, hp: 0, wait: 3, back: false }, pops: Array.from({ length: 6 }, () => ({ t: 0, x: 0, y: 0, s: '' })), shake: 0, left: -1, leftStr: '' };
  }
  function pop(list, x, y, s) { for (let i = 0; i < list.length; i++) if (list[i].t <= 0) { const p = list[i]; p.t = .9; p.x = x; p.y = y; p.s = s; return; } }
  function beginFight() {
    S.screen = 'castle'; S.order = null; render();
    CS.fight = C.hordeStart(CAS, S.horde.arrived, RULES, freshNow()); CS.acc = 0; CS.stray.x = -1;
    teleAdd('hordes_seen'); $live.textContent = BANK.horde.arrive; updateHud(); sfx('boss'); music('warning');
    const b = document.getElementById('skipFight'); if (b) b.hidden = false;
  }
  function endFight() {
    const f = CS.fight; if (!f) return;
    const sum = C.summary(f); CS.fight = null;
    S.horde.history.push({ day: S.horde.day, outcome: sum.outcome, wallLeft: sum.wallLeft, total: sum.total }); if (S.horde.history.length > 6) S.horde.history.shift();
    if (sum.outcome !== 'held') S.horde.dim = true;   // a held horde does not relight a breached wall: only evidence does
    S.horde.arrived = null; S.horde.fresh = null;
    S.play.wall += sum.keeperDowned * RS.score.horde_machine; S.play.life += sum.keeperDowned * RS.score.horde_machine;   // the Keeper's own kills pay play score, never XP
    fcKey = ''; saveNow(); teleSave(); updateHud(); showSummary(sum);
    const b = document.getElementById('skipFight'); if (b) b.hidden = true;
  }
  function skipFight() { const f = CS.fight; if (!f) return; let guard = 4000; while (!f.done && guard-- > 0) C.hordeStep(f, RULES); endFight(); }
  function updateCastle(dt) {
    const k = CS.k, gy = VH - 28, top = gy - walkH(CAS);
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) { k.x = clamp(k.x + dir * RS.keeper.speed * dt, walkMin(CAS), FACE - 12); k.face = dir; k.step += dt * 10; }
    const jump = keys.jump || tap.jump, shoot = keys.fire || tap.fire; tap.jump = tap.fire = false;
    if (jump && !k.air) { k.vy = -RS.keeper.jump * .7; k.air = true; sfx('jump'); }
    if (k.air) { k.vy += RS.keeper.gravity * dt; k.y += k.vy * dt; if (k.y >= 0) { k.y = 0; k.vy = 0; k.air = false; } }
    k.cd -= dt; CS.bolt.t -= dt; CS.shake = Math.max(0, CS.shake - dt);
    const f = CS.fight;
    if (f) {
      CS.acc += dt; let n = 0;
      while (CS.acc >= C.STEP && n++ < 4) { CS.acc -= C.STEP; const before = f.wallHp; C.hordeStep(f, RULES); if (f.wallHp < before) { CS.shake = .1; if (((f.t * 4) | 0) !== (((f.t - C.STEP) * 4) | 0)) sfx('hit'); } if (f.done) break; }
      if (shoot && k.cd <= 0 && !f.done) {
        k.cd = 1 / RS.keeper.fire_per_s; k.face = 1; let best = -1, bx = Infinity;
        for (let i = 0; i < f.machines.length; i++) { const z = f.machines[i]; if (z.alive && z.x < bx) { bx = z.x; best = i; } }
        if (best >= 0) { sfx('shot'); const sx = fieldX(bx); CS.bolt.t = .08; CS.bolt.x1 = k.x + 10; CS.bolt.y1 = top + k.y - 8; CS.bolt.x2 = sx; CS.bolt.y2 = gy - 4; if (C.keeperHit(f, best, RH.keeper_shot)) { pop(CS.pops, sx, gy - 14, SCORE_LABEL.horde); sfx('kill'); } }
      }
      if (f.done) endFight();
      return;
    }
    // between hordes: a stray wanders in and the towers see to it. It changes nothing; it only shows the castle is awake.
    const s = CS.stray;
    if (s.x < 0) { s.wait -= dt; if (s.wait <= 0 && S.state !== 'dark') { s.x = RH.approach; s.hp = RH.machines.crawler.hp; s.back = false; } }
    else {
      if (s.back) { s.x += RH.machines.crawler.speed * 2 * dt; if (s.x > RH.approach) { s.x = -1; s.wait = 5; } }
      else { s.x = Math.max(0, s.x - RH.machines.crawler.speed * dt); if (s.x <= 0) s.back = true; }
      if (s.x >= 0 && s.x < RC.tower.range - 20 && CAS.dps > 0 && !S.horde.dim) { s.hp -= Math.min(CAS.dps, 14) * dt; if (s.hp <= 0) { s.x = -1; s.wait = 4 + (CAS.pieces % 3); } }
      if (shoot && k.cd <= 0 && s.x >= 0) { sfx('shot'); k.cd = 1 / RS.keeper.fire_per_s; k.face = 1; CS.bolt.t = .08; CS.bolt.x1 = k.x + 10; CS.bolt.y1 = top + k.y - 8; CS.bolt.x2 = fieldX(s.x); CS.bolt.y2 = gy - 4; s.hp -= RH.keeper_shot; if (s.hp <= 0) { s.x = -1; s.wait = 4; } }
    }
    for (let i = 0; i < CS.pops.length; i++) if (CS.pops[i].t > 0) { CS.pops[i].t -= dt; CS.pops[i].y -= 10 * dt; }
  }
  // score labels are built once, so a kill or a spark allocates no string
  const SCORE_LABEL = { horde: '+' + RS.score.horde_machine };
  function machineSprite(type, t) { return type === 'brute' ? SP.brute[0] : type === 'skitter' ? SP.skitter[0] : ((t * 6) | 0) % 2 ? SP.crawlerA[0] : SP.crawlerB[0]; }
  const MZ = [0, 0], GUN_SLOT = { 'tower-1': 0, 'tower-2': 1, 'tower-3': 2, 'tower-4': 3 };
  function gunMuzzle(id, gy) { if (id === 'keep') { MZ[0] = KEEP_X + 12; MZ[1] = gy - keepH(CAS) - 8; } else { const i = GUN_SLOT[id]; MZ[0] = TOWER_X[i] + TOWER_W + 3; MZ[1] = gy - towerH(CAS.towers[i]) + 6; } return MZ; }
  function renderCastle(t) {
    const gy = VH - 28, f = CS.fight, dim = S.horde.dim, quiet = S.state === 'quiet';
    const sh = CS.shake > 0 ? ((t * 60) | 0) % 2 : 0;
    setBiome(RS.biomes.home); drawWorld(0, t);
    // the blight on the horizon: how near the horde is, drawn; the sky darkens with it, and the castle braces while one is announced
    const cl = S.horde.clock, brace = !!f || (!!cl.due && S.state !== 'unlit'), near = f ? 1 : cl.due ? .55 + .45 * (1 - clamp(E.daysBetween(hdate(), cl.due) / LEAD, 0, 1)) : S.state === 'unlit' ? 0 : Math.min(.5, .5 * cl.gather / RH.threshold);
    if (near > 0) { ctx.globalAlpha = near * RC.draw.sky_darken; px(0, 0, VW, VH, '#1a0f2e'); if (brace && !CALM && Math.sin(t * 1.3) > .992) { ctx.globalAlpha = .5; px(0, 0, VW, VH, '#ffe8f0'); } ctx.globalAlpha = 1; }   // a storm front; lightning far off
    if (near > 0) { ctx.globalAlpha = .55; const w = Math.round(near * 46); for (let i = 0; i < w; i += 2) px(VW - i, gy - 6 - Math.round(Math.sin(i * .4 + t) * 2 + (w - i) * .35), 2, 40, '#a3305e'); ctx.globalAlpha = 1; }
    ground(gy + sh, 0);
    for (let x = VW - 12; x > VW - 12 - Math.round(near * 60); x -= 12) blit(SP.blight, x, gy - 3);
    for (let c = 0; c < 16; c++) if (c * TILE > FACE + 6) tuft(c * TILE, gy + sh, c, t);
    drawCastle(CAS, 0, gy + sh, dim, t, quiet, brace);
    if (S.state === 'dark') { ctx.globalAlpha = .35; px(0, 0, VW, VH, '#28282c'); ctx.globalAlpha = 1; }
    if (f) {
      for (let i = 0; i < f.machines.length; i++) { const z = f.machines[i]; if (!z.alive) continue; const s = machineSprite(z.type, t + i); const x = fieldX(z.x); blit(s, x - (z.x <= 0 ? s.width - 2 : 0), gy - s.height + 1); if (z.hp < z.max) { px(x, gy - s.height - 2, 8, 1, '#14161a'); px(x, gy - s.height - 2, Math.ceil(8 * z.hp / z.max), 1, '#ff7a90'); } }
      for (let g = 0; g < f.guns.length; g++) { const gun = f.guns[g]; if (gun.target < 0 || !f.machines[gun.target] || !f.machines[gun.target].alive) continue; const m = gunMuzzle(gun.id, gy), tx = fieldX(f.machines[gun.target].x) + 3, ty = gy - 4; for (let j = 0; j < 3; j++) { const u = (t * 5 + g * .3 + j / 3) % 1; px(m[0] + (tx - m[0]) * u, m[1] + (ty - m[1]) * u, 2, 1, '#ffe08a'); } }
      // the wall's health and the beacon's, over the gate
      text('WALL', 4, 5, '#ffffff'); px(22, 5, 42, 5, '#14161a'); px(23, 6, Math.round(40 * f.wallHp / f.wallMax), 3, f.breached ? '#ff7a90' : '#9ff0d8');
      const left = f.total - f.downed - f.keeperDowned; if (left !== CS.left) { CS.left = left; CS.leftStr = String(left); }
      text('HORDE', 4, 13, '#ffd1dc'); text(CS.leftStr, 26, 13, '#ffd1dc');
    } else if (CS.stray.x >= 0) { const s = machineSprite('crawler', t); blit(CS.stray.back ? SP.crawlerA[1] : s, fieldX(CS.stray.x), gy - s.height + 1); if (CAS.dps > 0 && !CS.stray.back && CS.stray.x < RC.tower.range - 20 && !dim) { const m = gunMuzzle(CAS.towers[0] ? 'tower-1' : 'keep', gy), tx = fieldX(CS.stray.x) + 3; const u = (t * 5) % 1; px(m[0] + (tx - m[0]) * u, m[1] + (gy - 4 - m[1]) * u, 2, 1, '#ffe08a'); } }
    const k = CS.k, ks = k.air ? (k.vy < 0 ? KS.jump : KS.fall) : (keys.left || keys.right) ? KS.run[(k.step | 0) % 4] : (t % 3.4 < .12 ? KS.blink : KS.idle);
    blit(ks[k.face > 0 ? 0 : 1], Math.max(k.x, walkMin(CAS)) - 2, gy + sh - walkH(CAS) - KH + k.y);
    if (CS.bolt.t > 0) { ctx.strokeStyle = '#9ff0d8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(CS.bolt.x1, CS.bolt.y1); ctx.lineTo(CS.bolt.x2, CS.bolt.y2); ctx.stroke(); }
    for (let i = 0; i < CS.pops.length; i++) if (CS.pops[i].t > 0) text(CS.pops[i].s, CS.pops[i].x, CS.pops[i].y, '#ffe08a');
    drawAir(0, t, gy);
    if (S.state === 'unlit') { for (let y = 0; y < gy; y += 4) px(VW - 40 + (y % 8), y, 36, 1, 'rgba(150,150,142,.5)'); }
  }
