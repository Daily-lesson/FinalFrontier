  // ── the bosses (rules.stage.bosses): one at the end of every roadmap stage, one every so often in the Wilds; three designs in turn ──
  //   the Hauler walks, rears and charges the length of the arena (phase 2: it leaps, and its landing sends waves along the ground)
  //   the Kiln Eye hovers, fires aimed bursts and drops shells (phase 2: it sweeps a beam across the arena; dash through it)
  //   the Undertow burrows, rumbles where it will rise, rises and spits (phase 2: faster, more shells, waves as it breaks ground)
  // Every attack is announced before it lands. A boss pays play score and nothing else.
  function startBoss(a) {
    const B = ST.boss, R = RS.bosses, n = ST.wilds ? ST.bossN : ST.week - 1, type = R.order[n % R.order.length], D = R[type];
    B.on = true; B.dead = 0; B.type = type; B.arena = a; B.gy = a.row * TILE; B.x0 = a.c0 * TILE + 2; B.x1 = (a.c1 + 1) * TILE - 2;
    B.w = D.w; B.h = D.h; B.max = B.hp = D.hp + R.hp_per_level * n; B.phase = 1; B.t = 0; B.n = 0; B.hit = 0; B.up = 0; B.shots = 0; B.vx = 0; B.vy = 0; B.face = -1; B.dashed = 0;
    B.x = B.x1 - B.w - 8; B.y = type === 'eye' ? B.gy - D.hover : B.gy - B.h; B.st = 'enter'; B.name = BANK.boss[type].sign;
    if (type === 'undertow') { B.up = 0; B.h = 0; B.y = B.gy; }
    ST.lockL = a.c0; ST.lockR = a.c1; ST.banner = RS.bosses.enter_s + .3;
    for (let i = 0; i < ST.foes.length; i++) { const z = ST.foes[i]; if (z.alive && z.x > B.x0 - 40 && z.x < B.x1 + 40) z.alive = false; }   // the arena is the boss's alone
    sfx('boss'); music('boss'); jolt(RS.juice.shake_boss, 0); ticker(BANK.boss[type].name, BANK.boss[type].intro);
  }
  /** The Keeper fell back to a checkpoint mid-fight: the boss withdraws and waits, whole again. */
  function bossReset() { const B = ST.boss; B.on = false; ST.lockL = ST.lockR = -1; for (let i = 0; i < ST.eb.length; i++) ST.eb[i].on = false; music(BIO.def.song); }
  function bossDown() {
    const B = ST.boss, a = B.arena, n = RS.bosses.sparks; B.on = false; a.done = true; ST.lockL = ST.lockR = -1; ST.downed++; S.play.bosses++; ST.bossN++;
    award(RS.bosses.score, B.x, B.gy - 40, false);   // play score: a boss drops no item and no piece
    burst(B.x + B.w / 2, B.gy - 20, 24, -1, 1.8); if (!CALM) ST.flash = 1; jolt(RS.juice.shake_boss, RS.juice.hitstop_boss_s); sfx('bossdown');
    for (let i = 0; i < n; i++) ST.sparks.push(spark(B.x0 + 20 + i * ((B.x1 - B.x0 - 40) / n), B.gy - 12 - (i % 3) * 9));
    ticker(BANK.boss[B.type].down, '');
    if (ST.wilds) { ST.biomeI++; setBiome(ST.biomes[(S.play.wilds.runs + ST.biomeI) % ST.biomes.length]); music(BIO.def.song); offerUpgrade('boss'); }   // past a boss the Wilds change their face
    else { ST.goal = ST.goalAt; music(BIO.def.song); }
  }
  function bossHauler(dt) {
    const B = ST.boss, D = RS.bosses.hauler, kx = ST.k.x + KW / 2, cx = B.x + B.w / 2;
    if (B.st === 'enter') { if (B.t > RS.bosses.enter_s) { B.st = 'walk'; B.t = 0; } }
    else if (B.st === 'walk') { B.face = kx < cx ? -1 : 1; B.x = clamp(B.x + B.face * D.speed * ST.spd * dt, B.x0, B.x1 - B.w); if (B.t > D.walk_s) { B.st = 'tell'; B.t = 0; sfx('tell'); } }
    else if (B.st === 'tell') { if (B.t > (B.phase === 2 ? D.tell2_s : D.tell_s)) { B.st = 'charge'; B.t = 0; B.vx = B.face * D.charge_speed * ST.spd; } }
    else if (B.st === 'charge') {
      B.x += B.vx * dt; if (((B.t * 20) | 0) % 2) puff(cx - B.face * B.w * .4, B.gy - 2, -B.face * 30, -12, 5, .3);
      if (B.x <= B.x0 || B.x + B.w >= B.x1) {
        B.x = clamp(B.x, B.x0, B.x1 - B.w); B.st = 'stun'; B.t = 0; jolt(RS.juice.shake_boss, 0); sfx('break'); burst(B.face < 0 ? B.x : B.x + B.w, B.gy - 12, 10, 5, 1.3);
        if (B.phase === 2) for (let i = 0; i < D.debris; i++) ebullet(B.x0 + 24 + ((B.n * 53 + i * 67) % Math.max(1, B.x1 - B.x0 - 48)), B.gy - 150 - i * 26, 0, 30, 220, 2);   // the hit shakes loose what hangs above
      }
    }
    else if (B.st === 'stun') { if (B.t > D.stun_s) { B.n++; B.t = 0; if (B.phase === 2 && B.n % 2 === 0) { B.st = 'crouch'; sfx('tell'); } else B.st = 'walk'; } }
    else if (B.st === 'crouch') { if (B.t > D.crouch_s) { B.st = 'leap'; B.t = 0; B.vy = -D.leap; B.vx = clamp((kx - cx) / (2 * D.leap / RS.keeper.gravity), -170, 170); sfx('jump'); } }
    else if (B.st === 'leap') {
      B.vy += RS.keeper.gravity * dt; B.y += B.vy * dt; B.x = clamp(B.x + B.vx * dt, B.x0, B.x1 - B.w);
      if (B.y >= B.gy - B.h) { B.y = B.gy - B.h; B.st = 'stun'; B.t = D.stun_s * .4; jolt(RS.juice.shake_boss, 0); sfx('break'); burst(cx, B.gy - 2, 12, 5, 1.4); ebullet(B.x - 2, B.gy, -D.wave_speed * ST.spd, 0, 0, 1); ebullet(B.x + B.w + 2, B.gy, D.wave_speed * ST.spd, 0, 0, 1); }
    }
  }
  function bossEye(dt) {
    const B = ST.boss, D = RS.bosses.eye, k = ST.k, kx = k.x + KW / 2, cx = B.x + B.w / 2, hover = B.gy - D.hover + Math.sin(ST.time * 2) * 6;
    if (B.st === 'enter') { B.y = hover; if (B.t > RS.bosses.enter_s) { B.st = 'drift'; B.t = 0; } }
    else if (B.st === 'drift') {
      if (Math.abs(kx - cx) > 6) B.x = clamp(B.x + Math.sign(kx - cx) * D.speed * ST.spd * dt, B.x0, B.x1 - B.w); B.y += (hover - B.y) * Math.min(1, dt * 4);
      if (B.t > (B.phase === 2 ? D.drift2_s : D.drift_s)) { B.n++; B.t = 0; B.shots = 0; sfx('tell'); if (B.phase === 2 && B.n % 3 === 0) { B.st = 'tobeam'; B.face = cx < (B.x0 + B.x1) / 2 ? 1 : -1; } else B.st = B.n % 2 ? 'tell' : 'tellb'; }
    }
    else if (B.st === 'tell') { if (B.t > D.tell_s) { B.st = 'burst'; B.t = 0; } }
    else if (B.st === 'burst') { if (B.t > B.shots * D.burst_gap_s) { B.shots++; aim(cx, B.y + B.h, kx, k.y + KH / 2, D.shot_speed * ST.spd); sfx('eshot'); if (B.shots >= D.burst + B.phase - 1) { B.st = 'drift'; B.t = 0; } } }
    else if (B.st === 'tellb') { if (B.t > D.tell_s) { B.st = 'bombs'; B.t = 0; B.face = kx < cx ? -1 : 1; } }
    else if (B.st === 'bombs') { B.x = clamp(B.x + B.face * D.bomb_run_speed * ST.spd * dt, B.x0, B.x1 - B.w); if (B.t > B.shots * D.bomb_gap_s) { B.shots++; ebullet(cx, B.y + B.h, 0, 20, 260, 2); sfx('eshot'); if (B.shots >= D.bombs + (B.phase - 1) * 2) { B.st = 'drift'; B.t = 0; } } }
    else if (B.st === 'tobeam') { const tx = B.face > 0 ? B.x0 + 4 : B.x1 - B.w - 4; B.x += Math.sign(tx - B.x) * Math.min(Math.abs(tx - B.x), D.reposition_speed * dt); B.y += (B.gy - D.beam_height - B.y) * Math.min(1, dt * 4); if (Math.abs(tx - B.x) < 2) { B.st = 'tellbeam'; B.t = 0; sfx('tell'); } }
    else if (B.st === 'tellbeam') { if (B.t > D.beam_tell_s) { B.st = 'beam'; B.t = 0; sfx('charged'); } }
    else if (B.st === 'beam') {
      B.x += B.face * D.beam_speed * ST.spd * dt; if (((B.t * 30) | 0) % 2) puff(cx, B.gy - 2, (B.t * 977 % 1 - .5) * 60, -30, 6, .2);
      if (k.x + HBX + HBW > cx - 3 && k.x + HBX < cx + 3 && k.y + KH > B.y + B.h) hurt();
      if (B.face > 0 ? B.x + B.w >= B.x1 - 4 : B.x <= B.x0 + 4) { B.st = 'drift'; B.t = 0; }
    }
  }
  function bossUndertow(dt) {
    const B = ST.boss, D = RS.bosses.undertow, kx = ST.k.x + KW / 2, cx = B.x + B.w / 2;
    if (B.st === 'enter') { if (B.t > RS.bosses.enter_s) { B.st = 'under'; B.t = D.under_s; } }
    else if (B.st === 'under') { B.up = 0; if (B.t > (B.phase === 2 ? D.under2_s : D.under_s)) { B.st = 'rumble'; B.t = 0; B.x = clamp(kx - B.w / 2, B.x0 + 4, B.x1 - B.w - 4); sfx('tell'); } }
    else if (B.st === 'rumble') { if (((ST.time * 24) | 0) % 2) puff(B.x + (ST.time * 997 % 1) * B.w, B.gy - 1, (ST.time * 613 % 1 - .5) * 40, -34, 5, .3); if (B.t > (B.phase === 2 ? D.rumble2_s : D.rumble_s)) { B.st = 'rise'; B.t = 0; sfx('break'); jolt(RS.juice.shake_hit, 0); burst(cx, B.gy - 2, 10, 5, 1.3); } }
    else if (B.st === 'rise') { B.up = Math.min(D.h, D.h * B.t / D.rise_s); if (B.t >= D.rise_s) { B.st = 'up'; B.t = 0; B.shots = 0; if (B.phase === 2) { ebullet(B.x - 2, B.gy, -D.wave_speed * ST.spd, 0, 0, 1); ebullet(B.x + B.w + 2, B.gy, D.wave_speed * ST.spd, 0, 0, 1); } } }
    else if (B.st === 'up') {
      B.up = D.h;
      if (!B.shots && B.t > D.spit_at_s) { B.shots = 1; const n = D.spit + (B.phase - 1) * 2; for (let i = 0; i < n; i++) ebullet(cx, B.gy - D.h + 4, (i % 2 ? 1 : -1) * D.spit_vx * (1 + (i >> 1)) * .7, -D.spit_vy, D.spit_g, 2); sfx('eshot'); }
      if (B.t > D.up_s) { B.st = 'sink'; B.t = 0; }
    }
    else if (B.st === 'sink') { B.up = Math.max(0, D.h * (1 - B.t / D.sink_s)); if (B.t >= D.sink_s) { B.st = 'under'; B.t = 0; B.n++; } }
    B.h = B.up; B.y = B.gy - B.up;
  }
  function updateBoss(dt) {
    const B = ST.boss; if (!B.on) return;
    const k = ST.k; B.hit = Math.max(0, B.hit - dt);
    if (B.dead > 0) {   // going down: a string of blasts, then the big one
      B.dead -= dt; if (((B.dead * 9) | 0) !== (((B.dead + dt) * 9) | 0)) { burst(B.x + (B.dead * 977 % 1) * B.w, B.y + (B.dead * 613 % 1) * Math.max(8, B.h), 7, -1, 1.2); sfx('kill'); if (!CALM) ST.shake = Math.max(ST.shake, .12); }
      if (B.dead <= 0) bossDown(); return;
    }
    B.t += dt;
    if (B.phase === 1 && B.hp <= B.max * RS.bosses[B.type].phase2_at) { B.phase = 2; sfx('boss'); jolt(RS.juice.shake_boss, RS.juice.hitstop_hurt_s); burst(B.x + B.w / 2, B.y + B.h / 2, 14, 6, 1.5); ticker(BANK.boss[B.type].name, BANK.boss[B.type].phase); }
    if (B.type === 'hauler') bossHauler(dt); else if (B.type === 'eye') bossEye(dt); else bossUndertow(dt);
    if (B.st === 'enter' || B.h < 6) return;
    for (let j = 0; j < ST.shots.length; j++) {
      const s = ST.shots[j]; if (!s.on || s.last === -2 || s.x < B.x || s.x > B.x + B.w || s.y < B.y - 2 || s.y > B.y + B.h + 2) continue;
      B.hp -= s.dmg; B.hit = RS.juice.flash_s; s.last = -2; if (!s.big) s.on = false; puff(s.x, s.y, -s.vx * .1, -30, 0, .15); sfx('hit');
    }
    if (k.x + HBX + HBW > B.x + 2 && k.x + HBX < B.x + B.w - 2 && k.y + KH > B.y + 2 && k.y + HBY < B.y + B.h) {
      if (k.dash > 0 && ST.up.strike && B.dashed !== k.dashId) { B.dashed = k.dashId; B.hp -= RS.upgrades.strike_damage * ST.up.strike; B.hit = RS.juice.flash_s; sfx('hit'); } else hurt();
      if (ST.done) return;
    }
    if (B.hp <= 0) { B.hp = 0; B.dead = RS.bosses.death_s; B.st = 'dead'; for (let i = 0; i < ST.eb.length; i++) ST.eb[i].on = false; jolt(RS.juice.shake_boss, RS.juice.hitstop_boss_s); }
  }
  /** The bosses are drawn in rectangles, not sprites: they are too big for a sheet and they move in parts. */
  function renderBoss(t, cam, oy) {
    const B = ST.boss; if (!B.on) return;
    const x = Math.round(B.x - cam), y = Math.round(B.y + oy), w = B.w, h = B.h, tell = B.st === 'tell' || B.st === 'tellb' || B.st === 'crouch' || B.st === 'tellbeam', hot = tell && ((t * 14) | 0) % 2;
    const dying = B.dead > 0 && ((t * 20) | 0) % 2, body = B.hit > 0 || dying ? '#ffffff' : '#2f3439', plate = B.hit > 0 || dying ? '#ffffff' : '#4a5158', glow = B.phase === 2 ? '#ff4d5e' : '#c94a7c';
    if (B.type === 'hauler') {
      const f = B.face, sq = B.st === 'crouch' ? 4 : B.st === 'stun' ? 2 : 0, bob = B.st === 'walk' || B.st === 'charge' ? ((t * (B.st === 'charge' ? 18 : 6)) | 0) % 2 : 0, lean = B.st === 'tell' ? -f * 3 : B.st === 'charge' ? f * 2 : 0;
      for (let i = 0; i < 4; i++) { const lx = x + 3 + i * 10, up = (i + bob) % 2 ? 2 : 0; px(lx, y + h - 9 + up, 6, 9 - up, '#14161a'); px(lx + 1, y + h - 8 + up, 4, 3, plate); }
      px(x + lean, y + 8 + sq, w, h - 16 - sq, '#14161a'); px(x + 1 + lean, y + 9 + sq, w - 2, h - 18 - sq, body);
      px(x + 4 + lean, y + 12 + sq, w - 8, 3, plate); px(x + 4 + lean, y + 17 + sq, w - 8, 1, plate);
      const cabx = f < 0 ? x + 2 : x + w - 18; px(cabx + lean, y + sq, 16, 10, '#14161a'); px(cabx + 1 + lean, y + 1 + sq, 14, 8, plate);
      px(cabx + (f < 0 ? 2 : 8) + lean, y + 3 + sq, 6, 3, hot ? '#ffe08a' : B.st === 'stun' ? '#6c6f74' : glow);   // the eye slit: it flashes before a charge
      px(f < 0 ? x - 3 + lean : x + w - 1 + lean, y + 9 + sq, 4, h - 14 - sq, '#b9bcbf'); px(f < 0 ? x - 3 + lean : x + w + 2 + lean, y + 9 + sq, 1, h - 14 - sq, '#ffffff');   // the ram
      { const sx = f < 0 ? x + w - 16 : x + 8; px(sx + lean, y - 16 + sq, 8, 24, '#14161a'); px(sx + 1 + lean, y - 15 + sq, 6, 22, plate); px(sx - 1 + lean, y - 17 + sq, 10, 3, '#14161a'); for (let i = 0; i < 3; i++) { const u = (t * .9 + i / 3) % 1; ctx.globalAlpha = .6 * (1 - u); px(sx + 2 + lean - f * u * 10, y - 20 + sq - u * 16, 3 + (u * 4 | 0), 3, '#3a3f45'); } ctx.globalAlpha = 1; }   // its stack, and what it burns
      px(x + w / 2 - 3 + lean, y + 14 + sq, 6, 5, glow); px(x + w / 2 - 2 + lean, y + 15 + sq, 4, 3, B.phase === 2 ? '#ffe08a' : '#ff9ab8');
      if (B.st === 'stun') for (let i = 0; i < 3; i++) px(x + w / 2 + Math.cos(t * 6 + i * 2.1) * 12, y - 4 + Math.sin(t * 6 + i * 2.1) * 3, 2, 2, '#ffe08a');
    } else if (B.type === 'eye') {
      const cx = x + w / 2, cy = y + h / 2, r = h / 2, dx = clamp((ST.k.x + KW / 2 - B.x - w / 2) / 20, -3, 3);
      for (let yy = -r; yy <= r; yy++) { const ww = Math.round(Math.sqrt(Math.max(0, r * r - yy * yy)) * (w / h)); px(cx - ww - 1, cy + yy, ww * 2 + 2, 1, '#14161a'); if (ww > 1) px(cx - ww, cy + yy, ww * 2, 1, yy < -r * .3 ? plate : body); }
      for (let yy = -5; yy <= 5; yy++) { const ww = Math.round(Math.sqrt(25 - yy * yy)); px(cx - ww + dx, cy + yy, ww * 2, 1, hot ? '#ffe08a' : '#e9e4d6'); }
      px(cx - 2 + dx * 1.5, cy - 2, 4, 5, B.st === 'beam' || hot ? '#ffffff' : glow); px(cx - 1 + dx * 1.5, cy - 1, 2, 3, '#14161a');
      px(x - 3, cy - 1 + Math.sin(t * 8) * 2, 4, 2, plate); px(x + w - 1, cy - 1 - Math.sin(t * 8) * 2, 4, 2, plate);   // its vanes
      if (B.st === 'tellbeam') { for (let yy = y + h; yy < B.gy + oy; yy += 4) px(cx, yy + ((t * 30) | 0) % 4, 1, 2, '#ff4d5e'); }
      else if (B.st === 'beam') { px(cx - 3, y + h, 6, B.gy + oy - y - h, '#ff4d5e'); px(cx - 1, y + h, 2, B.gy + oy - y - h, '#ffffff'); ctx.globalAlpha = .3; px(cx - 6, y + h, 12, B.gy + oy - y - h, '#ff9ab8'); ctx.globalAlpha = 1; }
    } else {
      const gyy = B.gy + oy;
      if (B.st === 'rumble') { for (let i = 0; i < 5; i++) px(x + i * 5 + ((t * 40 + i * 3) | 0) % 3, gyy - 2 - ((t * 30 + i * 7) | 0) % 3, 3, 2, '#b9a98c'); px(x + 2, gyy - 1, w - 4, 1, '#ff4d5e'); }
      if (h >= 2) {
        for (let yy = 0; yy < h; yy += 6) { const sway = Math.round(Math.sin(t * 5 + yy * .2) * (yy < h - 8 ? 1 : 0)); px(x + 1 + sway, y + h - yy - 6, w - 2, 6, '#14161a'); px(x + 2 + sway, y + h - yy - 5, w - 4, 4, (yy / 6) % 2 ? body : plate); px(x + w / 2 - 1 + sway, y + h - yy - 4, 2, 2, glow); }
        if (h > 12) { px(x - 2, y, w + 4, 11, '#14161a'); px(x - 1, y + 1, w + 2, 9, body); px(x + 3, y + 3, 4, 3, hot || B.st === 'up' ? '#ffe08a' : glow); px(x + w - 7, y + 3, 4, 3, hot || B.st === 'up' ? '#ffe08a' : glow); const jaw = B.st === 'up' && B.t < RS.bosses.undertow.spit_at_s + .3 ? 3 : 0; px(x - 3, y + 8 + jaw, 5, 4, '#b9bcbf'); px(x + w - 2, y + 8 + jaw, 5, 4, '#b9bcbf'); }
      }
      px(x - 4, gyy - 2, w + 8, 2, '#6e6252');
    }
  }
