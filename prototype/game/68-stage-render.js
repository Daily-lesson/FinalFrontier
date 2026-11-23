  // ── drawing a stage: the world, the ground and what stands on it, the machines, the Keeper, the air, then the HUD ──
  const COMBO_STR = Array.from({ length: RS.combo.cap + 1 }, (_, i) => 'X' + i);
  const SIGN = { warning: BANK.stage.warning_sign, hard: BANK.stage.hard_sign };
  function renderStage(t) {
    const k = ST.k, B = ST.boss, T = RS.terrain, M = RS.moves, sh = ST.shake > 0 && !CALM ? (((t * 60) | 0) % 2 ? 1 : -1) : 0;
    const cam = Math.floor(ST.camX) + sh, oy = Math.round(VH - 30 - ST.camRow * TILE) + (ST.shake > .2 && !CALM ? -sh : 0);
    drawWorld(cam, t);
    if (!ST.wilds && cam < FACE + 8) drawCastle(CAS, -cam - FACE + 22, oy + GROUND_ROW * TILE, S.horde.dim, t, S.state === 'quiet', false);   // the castle's face is the left edge of every stage
    const c0 = Math.max(0, Math.floor(cam / TILE)), c1 = c0 + Math.ceil(VW / TILE) + 1;
    for (let c = c0; c <= c1 && c < ST.len; c++) {
      const x = c * TILE - cam, g = ST.ground[c];
      if (g >= 0) { blit(BIO.grass, x, g * TILE + oy); for (let y = (g + 1) * TILE + oy; y < VH; y += TILE) blit(BIO.soil, x, y); if (ST.spike[c]) blit(SP.spikes, x, g * TILE + oy - 4); else tuft(x, g * TILE + oy, c, t); }
      else if (c % 2) blit(SP.blight, x, VH - 4);
      if (ST.plat[c] >= 0) blit(BIO.slab, x, ST.plat[c] * TILE + oy);
      if (ST.plat2[c] >= 0) blit(BIO.slab, x, ST.plat2[c] * TILE + oy);
      if (ST.crack[c] >= 0) for (let r = ST.crack[c]; r < g; r++) blit(SP.crack, x, r * TILE + oy);
    }
    for (let i = 0; i < ST.caches.length; i++) {   // a cliff with something in it: solid to the eye until its wall is broken
      const q = ST.caches[i], x = (q.c0 + 1) * TILE - cam; if (x > VW || x < -5 * TILE) continue;
      if (q.open) px(x, (q.row - 2) * TILE + oy, 4 * TILE, 2 * TILE, '#1d1712');
      for (let c = 0; c < 4; c++) { blit(BIO.grass, x + c * TILE, (q.row - 3) * TILE + oy); if (!q.open) { blit(BIO.soil, x + c * TILE, (q.row - 2) * TILE + oy); blit(BIO.soil, x + c * TILE, (q.row - 1) * TILE + oy); } }
    }
    for (let i = 0; i < ST.vents.length; i++) {
      const v = ST.vents[i], x = v.c * TILE - cam; if (x < -12 || x > VW) continue; const y = v.row * TILE + oy, ph = (ST.time + v.o) % (T.vent_on_s + T.vent_off_s);
      blit(SP.vent, x, y - 3);
      if (ph > T.vent_off_s) { for (let j = 0; j < T.vent_reach; j += 3) { const w = 3 + ((t * 30 + j) | 0) % 4; px(x + 6 - w / 2, y - 4 - j, w, 3, j > T.vent_reach * .6 ? '#ff4d5e' : j % 2 ? '#ff9a3c' : '#ffe08a'); } }
      else if (ph > T.vent_off_s - RS.shots.tell_s) px(x + 4 + ((t * 20) | 0) % 3, y - 6, 2, 2, '#ffe08a');
    }
    for (let i = 0; i < ST.movers.length; i++) { const m = ST.movers[i], x = m.x - cam; if (x < -m.w || x > VW) continue; const y = m.y + oy; px(x, y, m.w, 5, '#14161a'); px(x + 1, y + 1, m.w - 2, 2, '#b9bcbf'); px(x + 1, y + 3, m.w - 2, 1, '#6c6f74'); px(x + 3, y + 5, 2, 2, ((t * 4) | 0) % 2 ? '#9ff0d8' : '#3DBFA6'); px(x + m.w - 5, y + 5, 2, 2, ((t * 4) | 0) % 2 ? '#3DBFA6' : '#9ff0d8'); }
    for (let i = 0; i < ST.posts.length; i++) { const p = ST.posts[i]; if (p.x < cam - 8 || p.x > cam + VW) continue; blit(p.hit ? SP.postOn : SP.postOff, p.x - cam, p.y + oy); }
    if (ST.goal > 0 && ST.goal > cam - 8 && ST.goal < cam + VW) blit(SP.goal, ST.goal - cam, ST.ground[Math.floor(ST.goal / TILE)] * TILE - 14 + oy);
    for (let i = 0; i < ST.sparks.length; i++) { const s = ST.sparks[i]; if (!s.on || s.x < cam - 8 || s.x > cam + VW || (s.lock >= 0 && !ST.caches[s.lock].open)) continue; blit(s.big ? SP.relic : SP.spark, s.x - cam, s.y + oy + Math.round(Math.sin(t * 4 + i) * 1)); }
    for (let i = 0; i < ST.foes.length; i++) {
      const z = ST.foes[i]; if (!z.alive || z.x < cam - 20 || z.x > cam + VW + 4) continue;
      const set = z.type === 'brute' ? SP.brute : z.type === 'drone' ? SP.drone : z.type === 'hopper' ? SP.skitter : z.type === 'turret' ? SP.turret : z.type === 'warden' ? SP.warden : ((z.t * 6) | 0) % 2 ? SP.crawlerA : SP.crawlerB;
      const right = z.type === 'turret' || z.type === 'warden' || (z.type === 'brute' && z.st) ? z.face > 0 : z.vx > 0, wind = z.type === 'brute' && z.st === 1 ? ((t * 30) | 0) % 2 : 0;
      blit(set[(right ? 1 : 0) + (z.hit > 0 && !CALM ? 2 : 0)], z.x - cam + wind, z.y + oy);
      if ((z.type === 'drone' || z.type === 'turret') && z.cd < RS.shots.tell_s && ((t * 16) | 0) % 2) px(z.x - cam + (z.type === 'drone' ? z.w / 2 - 1 : right ? z.w : -2), z.y + oy + (z.type === 'drone' ? z.h : 3), 2, 2, '#ffe08a');   // it is about to fire
      if (wind || (z.type === 'brute' && z.st === 1)) { px(z.x - cam + z.w / 2, z.y + oy - 8, 2, 4, '#ffe08a'); px(z.x - cam + z.w / 2, z.y + oy - 3, 2, 2, '#ffe08a'); }
    }
    renderBoss(t, cam, oy);
    for (let i = 0; i < ST.eb.length; i++) {
      const b = ST.eb[i]; if (!b.on) continue; const x = b.x - cam, y = b.y + oy;
      if (b.kind === 1) { const hh = 6 + ((t * 24 + i) | 0) % 4; px(x - 3, y - hh, 6, hh, '#ff9a3c'); px(x - 1, y - hh + 2, 2, hh - 2, '#ffe08a'); }
      else if (b.kind === 2) { px(x - 2, y - 2, 5, 5, '#14161a'); px(x - 1, y - 1, 3, 3, '#ff9a3c'); }
      else { px(x - 1, y - 1, 3, 3, '#ff4d5e'); px(x, y, 1, 1, '#ffffff'); }
    }
    for (let i = 0; i < ST.shots.length; i++) { const s = ST.shots[i]; if (!s.on) continue; if (s.big) { px(s.x - cam - 3, s.y + oy - 3, 9, 7, '#9ff0d8'); px(s.x - cam - 1, s.y + oy - 2, 6, 5, '#ffffff'); } else { px(s.x - cam, s.y + oy, 4, 2, '#9ff0d8'); px(s.x - cam + (s.vx > 0 ? 3 : 0), s.y + oy, 1, 2, '#ffffff'); } }
    for (let i = 0; i < ST.bits.length; i++) { const b = ST.bits[i]; if (b.t > 0) px(b.x - cam, b.y + oy, b.t > .15 ? 2 : 1, b.t > .15 ? 2 : 1, BIT_COL[b.c]); }
    if (!(k.inv > 0 && k.dash <= 0 && ((t * 16) | 0) % 2)) {
      const ks = k.hurtT > 0 ? KS.hurt : k.dash > 0 ? KS.dash : k.air ? (k.vy < 0 ? KS.jump : KS.fall) : k.vx ? KS.run[(k.step | 0) % 4] : k.hold > M.charge_min_s ? KS.charge : t % 3.4 < .12 ? KS.blink : KS.idle;
      const s = ks[k.face > 0 ? 0 : 1], x = k.x - cam, y = k.y + oy;
      if (k.dash > 0) { ctx.globalAlpha = .3; blit(s, x - k.face * 13, y); ctx.globalAlpha = .55; blit(s, x - k.face * 6, y); ctx.globalAlpha = 1; }
      if (k.squash > 0) ctx.drawImage(s, x | 0, (y + 3) | 0, KW, KH - 3); else blit(s, x, y + (k.vx && !k.air && (k.step | 0) % 2 ? -1 : 0));
      if (k.hold > M.charge_min_s) { const u = Math.min(1, k.hold / ST.mod.charge), r = 1 + ((u * 3) | 0), gx = x + (k.face > 0 ? KW + 1 : -2), gy = y + 10; px(gx - r, gy - r, r * 2 + 1, r * 2 + 1, k.full && ((t * 20) | 0) % 2 ? '#ffffff' : '#9ff0d8'); if (k.full) { ctx.globalAlpha = .35; px(gx - r - 2, gy - r - 2, r * 2 + 5, r * 2 + 5, '#9ff0d8'); ctx.globalAlpha = 1; } }
      if (k.shield) { const c = '#9ff0d8'; px(x - 1, y - 1, 3, 1, c); px(x - 1, y - 1, 1, 3, c); px(x + KW - 2, y - 1, 3, 1, c); px(x + KW, y - 1, 1, 3, c); px(x - 1, y + KH, 3, 1, c); px(x - 1, y + KH - 2, 1, 3, c); px(x + KW - 2, y + KH, 3, 1, c); px(x + KW, y + KH - 2, 1, 3, c); }
    }
    for (let i = 0; i < ST.up.buddy; i++) { const bx = k.x - cam + KW / 2 + Math.cos(ST.time * 2 + i * 3.1) * 14, by = k.y + oy - 3 + Math.sin(ST.time * 3 + i * 3.1) * 4; px(bx - 2, by - 2, 5, 4, '#14161a'); px(bx - 1, by - 1, 3, 2, '#e9e4d6'); px(bx, by - 1, 1, 1, '#3DBFA6'); px(bx - 3, by - 3 + ((t * 20) | 0) % 2, 7, 1, '#b9bcbf'); }
    for (let i = 0; i < ST.pops.length; i++) if (ST.pops[i].t > 0) text(ST.pops[i].s, ST.pops[i].x - cam, ST.pops[i].y + oy, '#ffe08a');
    drawAir(cam, t, oy + GROUND_ROW * TILE);
    if (ST.flash > 0 && !CALM) { ctx.globalAlpha = Math.min(.7, ST.flash * .7); px(0, 0, VW, VH, '#ffffff'); ctx.globalAlpha = 1; }
    // the HUD: hull, the dash, the build, the score and the combo; a boss's name and bar
    for (let i = 0; i < k.max; i++) blit(i < k.hp ? SP.heart : SP.heartOff, 4 + i * 9, 4);
    if (k.shield) blit(SP.shield, 4 + k.max * 9, 4);
    px(4, 12, 22, 3, '#14161a'); px(5, 13, Math.round(20 * (1 - clamp(k.dashCd / (M.dash_cooldown_s * ST.mod.dashCd), 0, 1))), 1, k.dashCd <= 0 ? '#9ff0d8' : '#6c6f74');
    if (ST.buildStr) text(ST.buildStr, 4, 18, '#cfe9ff');
    if (ST.score !== ST.scoreSeen) { ST.scoreSeen = ST.score; ST.scoreStr = String(ST.score); }
    text(ST.scoreStr, VW - 4 - textW(ST.scoreStr), 5, '#ffffff');
    if (ST.combo > 1) { const cs = COMBO_STR[ST.combo]; text(cs, VW - 4 - textW(cs), 13, ST.comboT < .7 ? '#ff9a3c' : '#ffe08a'); }
    if (ST.hard) text(SIGN.hard, VW - 4 - textW(SIGN.hard), 21, '#ff7a90');
    if (ST.title > 0) { ctx.globalAlpha = .6; px(0, 36, VW, 22, '#14161a'); ctx.globalAlpha = 1; text(ST.name, (VW - textW(ST.name)) / 2, 40, '#ffe08a'); text(BIO.sign, (VW - textW(BIO.sign)) / 2, 49, '#ffffff'); }
    if (B.on) {
      px(18, VH - 11, VW - 36, 6, '#14161a'); px(19, VH - 10, Math.round((VW - 38) * B.hp / B.max), 4, B.phase === 2 ? '#ff4d5e' : '#c94a7c'); px(19 + Math.round((VW - 38) * RS.bosses[B.type].phase2_at), VH - 11, 1, 6, '#14161a');
      text(B.name, (VW - textW(B.name)) / 2, VH - 19, '#ffd1dc');
      if (ST.banner > 0) { ctx.globalAlpha = .72; px(0, 44, VW, 26, '#14161a'); ctx.globalAlpha = 1; if (((t * 6) | 0) % 2 || CALM) text(SIGN.warning, (VW - textW(SIGN.warning)) / 2, 49, '#ff4d5e'); text(B.name, (VW - textW(B.name)) / 2, 59, '#ffffff'); }
    }
    if (S.state === 'dark') { ctx.globalAlpha = .35; px(0, 0, VW, VH, '#28282c'); ctx.globalAlpha = 1; }
  }
  // THE DEMO'S ONE STAND-IN: in the app a waypoint opens the lesson in the Learning screen and the tick made there is the evidence.
  // The DEMO has no Learning screen, so the card's button ticks the lesson itself, and says so. It is the lesson's tick, not the run.
  // Embedded there is a Learning screen: the button asks the host to open it, and no evidence is made here.
  function survey() {
    const p = ST && ST.near; if (!p || !p.id || S.ticks.includes(p.id)) return;
    if (EMBED) { hostGo('learning'); return; }
    S.ticks.push(p.id);
    const before = E.expedition(PLAN, S.ticks.filter((x) => x !== p.id), RULES).mapped;
    // the survey is the lesson's tick (an event): the evidence, not the run, adds the course of stone
    fire([lessonEvent(p.id, TODAY)], () => { ticker(BANK.stage.survey, ''); if (E.expedition(PLAN, S.ticks, RULES).mapped > before) teleAdd('regions_mapped'); updateCard(); });
  }
  function updateCard() {
    const card = document.getElementById('wpcard'); if (!card) return;
    const p = ST && ST.near && ST.near.id ? ST.near : null; card.hidden = !p; if (!p) return;
    const done = S.ticks.includes(p.id);
    card.innerHTML = `<div class="grow">${esc(fill(BANK.stage.card, { week: ST.week, pos: p.pos, of: p.of }))}<small>${esc(done ? BANK.stage.card_done : EMBED ? BANK.embed.card_open : BANK.stage.card_demo)}</small></div><button data-survey="1" ${done ? 'disabled' : ''}>${esc(done ? BANK.stage.card_done : EMBED ? BANK.embed.open_lesson : BANK.stage.survey_button)}</button>`;
  }
