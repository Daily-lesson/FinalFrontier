  // ── the machines out the gate: six kinds, each its own habit (rules.stage.enemies). A kill pays play score, never XP or a castle piece. ──
  //   crawler patrols a ledge · hopper leaps at the Keeper · drone hovers and fires aimed shots · turret stands and fires level bursts ·
  //   warden walks at the Keeper behind a shield (hit it from behind, with a charged shot or a dash strike) · brute winds up and charges.
  function kill(z) {
    z.alive = false; ST.kills++;
    award(RS.enemies[z.type].score, z.x, z.y - 6, true);   // a kill pays play score, never XP or a castle piece (pillar 1)
    burst(z.x + z.w / 2, z.y + z.h / 2, 9, -1, 1.1); sfx('kill'); jolt(RS.juice.shake_hit, RS.juice.hitstop_kill_s);
    if (ST.up.salvage) award(RS.score.spark * RS.upgrades.salvage_sparks * ST.up.salvage, z.x + 4, z.y - 14, false);
  }
  /** A shot meets a machine. A warden's shield turns a plain shot from the front. */
  function strike(z, i, s) {
    if (z.type === 'warden' && !s.big && s.vx * z.face < 0) { s.on = false; sfx('clink'); puff(s.x, s.y, -s.vx * .2, -30, 2, .15); puff(s.x, s.y, -s.vx * .2, 20, 3, .15); return; }
    z.hp -= s.dmg; z.hit = RS.juice.flash_s; s.last = i; puff(s.x, s.y, 0, -24, 0, .12);
    if (s.pierce > 0) s.pierce--; else s.on = false;
    if (z.hp <= 0) kill(z); else sfx('hit');
  }
  function updateFoes(dt) {
    const k = ST.k, K = RS.keeper, kx = k.x + KW / 2, ky = k.y + KH / 2, tell = RS.shots.tell_s;
    for (let i = 0; i < ST.foes.length; i++) {
      const z = ST.foes[i]; if (!z.alive) continue; if (z.x > ST.camX + VW + 30 || z.x < ST.camX - 70) continue;
      const D = RS.enemies[z.type], w = z.w, h = z.h, sp = D.speed * ST.spd;
      z.t += dt; z.hit = Math.max(0, z.hit - dt);
      if (z.type === 'drone') {
        z.x += z.vx * dt; z.y = z.y0 + Math.sin(z.t * 2.4) * 10;
        if (Math.abs(z.x + w / 2 - kx) > D.keep_away) z.vx = (kx < z.x ? -1 : 1) * sp;
        z.cd -= dt; if (z.cd <= 0) { z.cd = D.shot_every_s; aim(z.x + w / 2, z.y + h, kx, ky, D.shot_speed * ST.spd); sfx('eshot'); }
      } else if (z.type === 'turret') {
        z.face = kx < z.x + w / 2 ? -1 : 1; const far = Math.abs(kx - z.x) > D.sight;
        if (far) z.cd = Math.max(z.cd, tell + .05); else z.cd -= dt;   // it only takes aim at what it can see
        if (z.cd <= 0) { z.st++; z.cd = z.st % D.burst ? .22 : D.shot_every_s; ebullet(z.x + (z.face < 0 ? -2 : w), z.y + 3, z.face * D.shot_speed * ST.spd, 0, 0, 0); sfx('eshot'); }
      } else {
        z.vy = Math.min(240, z.vy + K.gravity * dt); const zy = z.y + z.vy * dt;
        if (boxHits(z.x, zy, w, h)) { if (z.vy > 0) z.y = Math.floor((zy + h - 1) / TILE) * TILE - h; z.vy = 0; } else z.y = zy;
        const on = boxHits(z.x, z.y + 1, w, h);
        if (z.type === 'hopper' && on && z.t > D.hop_every_s) { z.t = 0; z.vy = -D.hop; z.vx = (kx < z.x ? -1 : 1) * sp; }
        else if (z.type === 'warden') { z.face = kx < z.x + w / 2 ? -1 : 1; z.vx = z.face * sp; }
        else if (z.type === 'brute') {
          if (z.st === 0) { z.face = z.vx < 0 ? -1 : 1; if (Math.abs(kx - (z.x + w / 2)) < D.sight && Math.abs(ky - (z.y + h / 2)) < 26) { z.st = 1; z.cd = D.windup_s; z.face = kx < z.x + w / 2 ? -1 : 1; z.vx = 0; sfx('tell'); } }
          else if (z.st === 1) { z.cd -= dt; if (z.cd <= 0) { z.st = 2; z.cd = D.charge_s; z.vx = z.face * D.charge_speed * ST.spd; } }
          else { z.cd -= dt; if (z.cd <= 0) { z.st = 0; z.vx = z.face * sp; } }
        }
        const zx = z.x + z.vx * dt, ahead = Math.floor((zx + (z.vx < 0 ? 0 : w)) / TILE), foot = Math.floor((z.y + h + 2) / TILE);
        if (boxHits(zx, z.y, w, h) || (on && z.type !== 'hopper' && !solid(ahead, foot))) { if (z.type === 'brute' && z.st === 2) { z.st = 0; z.vx = -z.face * sp; jolt(RS.juice.shake_hit, 0); } else if (z.type !== 'warden') z.vx = -z.vx; } else z.x = zx;
        if (z.y > ROWS * TILE + 30) z.alive = false;
      }
      for (let j = 0; j < ST.shots.length; j++) { const s = ST.shots[j]; if (!s.on || s.last === i || s.x < z.x - 1 || s.x > z.x + w + 1 || s.y < z.y - (s.big ? 4 : 1) || s.y > z.y + h + (s.big ? 3 : 0)) continue; strike(z, i, s); if (!z.alive) break; }
      if (!z.alive) continue;
      if (k.x + HBX + HBW > z.x && k.x + HBX < z.x + w && k.y + KH > z.y && k.y + HBY < z.y + h) {
        if (k.dash > 0 && ST.up.strike && z.dashed !== k.dashId) { z.dashed = k.dashId; z.hp -= RS.upgrades.strike_damage * ST.up.strike; z.hit = RS.juice.flash_s; if (z.hp <= 0) kill(z); else sfx('hit'); }   // a dash strike cuts through
        else hurt();
        if (ST.done) return;
      }
    }
  }
  /** What the machines and the bosses throw: 0 a bolt, 1 a wave along the ground, 2 a lobbed shell. */
  function updateBullets(dt) {
    const k = ST.k;
    for (let i = 0; i < ST.eb.length; i++) {
      const b = ST.eb[i]; if (!b.on) continue;
      b.t += dt; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < ST.camX - 30 || b.x > ST.camX + VW + 30 || b.y > ROWS * TILE + 20 || b.t > 6) { b.on = false; continue; }
      if (b.kind !== 1 && solid(Math.floor(b.x / TILE), Math.floor(b.y / TILE))) { b.on = false; puff(b.x, b.y, 0, -20, 1, .15); if (b.kind === 2) { burst(b.x, b.y - 2, 5, 4, .7); sfx('land'); } continue; }
      if (b.kind === 1 && solid(Math.floor((b.x + (b.vx > 0 ? 8 : -2)) / TILE), Math.floor((b.y - 2) / TILE))) { b.on = false; continue; }
      const r = b.kind === 1 ? 5 : 3;
      if (k.x + HBX + HBW > b.x - r && k.x + HBX < b.x + r && k.y + KH > b.y - (b.kind === 1 ? 9 : r) && k.y + HBY < b.y + r) { if (k.inv <= 0) b.on = b.kind === 1; hurt(); if (ST.done) return; }
    }
  }
