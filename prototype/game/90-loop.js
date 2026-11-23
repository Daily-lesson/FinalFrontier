  // ══════════════════════ events and the loop ══════════════════════
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-order],[data-close],[data-pick],[data-done],[data-lift],[data-name],[data-theme],[data-days],[data-state],[data-survey],[data-stage],[data-paint],[data-host],[data-mute],[data-hard],#reset,#replayOnboarding,#skipFight,#fwClose');
    if (!t) return;
    if (t.id === 'fwClose') { saveNow(); music(''); hostGo('close'); return; }
    if (t.dataset.host) { hostGo(t.dataset.host); return; }   // where the evidence is made: the host's own screen
    if (t.dataset.mute) { setMute(!S.play.mute); if (S.screen === 'stages') render(); else { const b = document.getElementById('muteBtn'); if (b) { b.textContent = S.play.mute ? BANK.sound.off : BANK.sound.on; b.setAttribute('aria-pressed', String(S.play.mute)); } } return; }
    if (t.dataset.hard) { S.play.hard = !S.play.hard; saveNow(); render(); return; }
    if (t.dataset.go) { if (CS.fight && t.dataset.go !== 'castle') skipFight();
      if (S.screen === 'stage' && ST && !ST.done && ST.score > 0 && t.dataset.go !== 'stage') { finishStage(false); return; }   // a run walked away from still banks its play score
      S.screen = t.dataset.go === 'stage' ? 'stages' : t.dataset.go; if (S.screen !== 'stage') { ST = null; S.stage = null; } S.order = null; for (const kk in keys) keys[kk] = false; render(); return; }
    if (t.dataset.stage) { const n = Number(t.dataset.stage); if (OUT && n !== 0) return; if (n > 1 && !S.play.best[`w${n - 1}`]) return;   // a week opens when the one before it is cleared
      S.stage = n; newStage(S.stage); S.screen = 'stage'; render(); ticker(ST.wilds ? BANK.stage.wilds_enter : fill(BANK.stage.enter, { n: ST.week }), ''); return; }
    if (t.dataset.paint) { S.play.paint = t.dataset.paint; paintKeeper(); saveNow(); render(); return; }
    if (t.dataset.order) { S.order = t.dataset.order; S.picked = null; S.proof = ''; renderOverlay(); return; }
    if (t.dataset.close) { if (e.target === t || e.target.closest('[data-close]') === t) { S.order = null; renderOverlay(); } return; }
    if (t.dataset.pick) { S.picked = t.dataset.pick; S.proof = document.getElementById('proof')?.value || ''; renderOverlay(); return; }
    if (t.dataset.done) { closeOrder(t.dataset.done); return; }
    if (t.dataset.lift) { logLift(); return; }
    if (t.dataset.name) { S.keeperName = (document.getElementById('kname')?.value || '').slice(0, 24); store.set(KEYS.keeper, S.keeperName); render(); return; }
    if (t.dataset.days) { if (t.dataset.days === 'now') hordeNow(); else advanceDays(Number(t.dataset.days)); return; }
    if (t.dataset.state) { S.state = t.dataset.state; pressSeg('seg-state', 'state', S.state); fcKey = ''; bgKey = ''; if (S.screen === 'home' || S.screen === 'siege') render(); else updateHud(); return; }
    if (t.dataset.survey) { survey(); return; }
    if (t.id === 'skipFight') { skipFight(); return; }
    if (t.id === 'replayOnboarding') { $overlay.querySelectorAll('.scrim').forEach((x) => x.remove()); S.screen = 'castle'; S.started = true; ST = null; render(); showOnboarding(0); return; }
    if (t.dataset.theme) { document.documentElement.setAttribute('data-theme', t.dataset.theme); document.querySelectorAll('#seg-theme button').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); bgKey = ''; if (S.screen === 'home') drawMini(); return; }
    if (t.id === 'reset') { store.del(KEYS.save); $overlay.innerHTML = ''; reset(); S.play.mute = !!(AU.master && AU.master.gain.value === 0); newCastleScene(); paintKeeper(); ST = null; S.started = false; S.screen = 'castle'; render(); saveNow(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'proof') { S.proof = e.target.value; const b = document.querySelector('[data-done]'); if (b) b.disabled = !S.proof.trim(); } });
  const KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'jump', arrowup: 'jump', w: 'jump', j: 'fire', x: 'fire', f: 'fire', shift: 'dash', k: 'dash', l: 'dash', c: 'dash' };
  addEventListener('keydown', (e) => { if (e.target.matches('input')) return; auUnlock(); const key = e.key.toLowerCase();
    if (key >= '1' && key <= '3') { const ups = $overlay.querySelectorAll('[data-up]'); if (ups[key - 1]) { ups[key - 1].click(); return; } }   /* an upgrade by its number */
    if (KEYMAP[key]) { keys[KEYMAP[key]] = true; if (KEYMAP[key] in tap && !e.repeat) tap[KEYMAP[key]] = true; e.preventDefault(); } if (key === 'escape' && S.order) { S.order = null; renderOverlay(); }
    else if (key === 'escape' && EMBED && !blocking() && !(S.screen === 'stage' && ST)) { saveNow(); music(''); hostGo('close'); } });   /* in a host frame, Escape at rest closes the game; a run in progress is never dropped by a key */
  addEventListener('keyup', (e) => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const kk in keys) keys[kk] = false; });
  function pressSeg(id, key, v) { document.querySelectorAll(`#${id} button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[key] === v))); }

  // The loop: paused while a sheet or a card is open, stopped while the page is hidden. Nothing is allocated per frame.
  let last = performance.now(), hudTick = 0, running = false;
  const blocking = () => $overlay.childElementCount > 0 && !!$overlay.querySelector('.scrim, .dropwrap');
  function frame(now) {
    if (document.hidden) { running = false; return; }
    const dt = Math.min(.034, (now - last) / 1000); last = now;
    if (cv && (S.screen === 'castle' || (S.screen === 'stage' && ST))) {
      if (!blocking()) { if (S.screen === 'castle') updateCastle(dt); else updateStage(dt); TEL.session_seconds += dt; }
      else tap.jump = tap.fire = tap.dash = false;
      if (cv && S.screen === 'castle') renderCastle(now / 1000); else if (cv && ST) renderStage(now / 1000);
      tickHold -= dt; hudTick += dt; if (hudTick > .25) { hudTick = 0; updateHud(); }
      if (now - savedAt > RULES.save.autosave_seconds * 1000) { saveNow(); teleSave(); }
    }
    requestAnimationFrame(frame);
  }
  function startLoop() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveNow(); teleSave(); } else startLoop(); });
  addEventListener('pagehide', () => { saveNow(); teleSave(); });

  // ── the art sheet (prototype/art-sheet.html): every sprite and every castle piece, by the functions above ──
  function renderArtSheet() {
    document.querySelector('.wrap').innerHTML = `<div class="dev" style="max-width:760px"><span class="lbl">Fieldworks · the art sheet</span><span class="note">Every sprite the renderers draw and the castle at four sizes, by the prototype's own drawing functions, at twice their size. Canvas only: no image asset. The sky follows the theme; the world keeps its own colours.</span></div><canvas id="sheet" aria-label="The Fieldworks art sheet" style="image-rendering:pixelated"></canvas>`;
    const cw = 112, ch = 100, cols = 4, Z = 2, now = 1.3;
    const mk = (count) => C.castleFrom({ wall: 0, tower: 0, keep: 0, course: 0, gate: 0, lamp: 0, ...count }, 1, RULES);
    const sprite = (s) => (x, y) => blit(s, x - (s.width >> 1), y - (s.height >> 1));
    const castleCell = (count, dim, brace) => (x, y) => { drawCastle(mk(count), x - 52, y + 44, dim, now, false, !!brace); };
    const cells = [
      ['Keeper · idle, blink', (x, y) => { blit(KS.idle[0], x - 16, y - 9); blit(KS.blink[0], x + 2, y - 9); }], ['Keeper · run', (x, y) => { for (let i = 0; i < 3; i++) blit(KS.run[i][0], x - 26 + i * 18, y - 9); }], ['Keeper · jump, fall', (x, y) => { blit(KS.jump[0], x - 16, y - 9); blit(KS.fall[0], x + 2, y - 9); }], ['Keeper · dash, hurt, charge', (x, y) => { blit(KS.dash[0], x - 26, y - 9); blit(KS.hurt[0], x - 8, y - 9); blit(KS.charge[0], x + 10, y - 9); }],
      ...RS.paints.slice(1, 5).map((p) => [`Paint · ${p.label}`, sprite(spr(KEEPER_ROWS.idle, { ...PAL, t: p.colour }))]),
      ['Machine · crawler', sprite(SP.crawlerA[0])], ['Machine · hopper', sprite(SP.skitter[0])], ['Machine · drone', sprite(SP.drone[0])], ['Machine · turret', sprite(SP.turret[0])],
      ['Machine · warden', sprite(SP.warden[0])], ['Machine · brute', sprite(SP.brute[0])], ['Hit flash', sprite(SP.brute[2])], ['Cracked wall · spikes · vent', (x, y) => { blit(SP.crack, x - 22, y - 6); blit(SP.spikes, x - 6, y + 2); blit(SP.vent, x + 10, y + 3); }],
      ...RS.bosses.order.map((type) => [`Boss · ${BANK.boss[type].name}`, (x, y) => { const D = RS.bosses[type]; ST = { boss: { on: true, dead: 0, type, x: x - D.w / 2, y: y + 24 - D.h, w: D.w, h: D.h, hp: 1, max: 1, st: type === 'undertow' ? 'up' : 'walk', t: 1, face: -1, hit: 0, phase: 1, gy: y + 24 }, k: { x: x - 60 }, time: 0 }; renderBoss(now, 0, 0); ST = null; }]), ['Spark · relic', (x, y) => { blit(SP.spark, x - 9, y - 3); blit(SP.relic, x + 2, y - 4); }],
      ['Hull · full, spent, shield', (x, y) => { blit(SP.heart, x - 13, y - 3); blit(SP.heartOff, x - 3, y - 3); blit(SP.shield, x + 7, y - 3); }], ['Waypoint · open, reached', (x, y) => { blit(SP.postOff, x - 8, y - 8); blit(SP.postOn, x + 3, y - 8); }], ['Stage goal', sprite(SP.goal)], ['Blight', sprite(SP.blight)],
      ...RS.biomes.list.map((b) => [`World · ${BANK.biome[b.slug].name}`, (x, y) => { const B = biomeOf(b.slug); for (let i = -2; i < 2; i++) { blit(B.grass, x + i * 12, y + 4); blit(B.soil, x + i * 12, y + 16); } blit(B.slab, x - 6, y - 18); px(x - 30, y - 30, 12, 8, isDark() ? b.sky_dark[2] : b.sky_light[1]); px(x - 16, y - 30, 12, 8, isDark() ? b.far_dark : b.far_light); px(x - 2, y - 30, 12, 8, isDark() ? b.near_dark : b.near_light); }]), ['Beacon · lit, dim', (x, y) => { drawBeacon(x - 6, y + 6, now, false); drawBeacon(x + 6, y + 6, now, true); }],
      ['Castle · first pieces', castleCell({ wall: 2, course: 3 })], ['Castle · a tower, a keep', castleCell({ wall: 6, tower: 3, keep: 1, course: 9, gate: 2, lamp: 2 })], ['Castle · grown, braced', castleCell({ wall: 12, tower: 18, keep: 5, course: 30, gate: 4, lamp: 6 }, false, true)], ['Castle · breached, dim', castleCell({ wall: 12, tower: 18, keep: 5, course: 30, gate: 4, lamp: 6 }, true)],
    ];
    const rows = Math.ceil(cells.length / cols);
    cv = document.getElementById('sheet'); cv.width = cols * cw; cv.height = rows * ch; cv.style.width = cols * cw * Z + 'px'; cv.style.height = rows * ch * Z + 'px'; ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const dark = isDark();
    cells.forEach(([label, draw], i) => {
      const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch;
      px(cx + 1, cy + 1, cw - 2, ch - 2, dark ? '#1C1D21' : '#FFFFFF'); px(cx + 4, cy + 4, cw - 8, ch - 18, dark ? '#262c52' : '#bfe4ec');
      ctx.save(); ctx.beginPath(); ctx.rect(cx + 4, cy + 4, cw - 8, ch - 18); ctx.clip(); draw(cx + cw / 2, cy + 42); ctx.restore();
    });
    // labels in the chrome face, over the canvas
    const wrap = document.querySelector('.wrap'), lab = document.createElement('div'); lab.style.cssText = `position:relative;width:${cols * cw * Z}px;margin-top:-${rows * ch * Z + 12}px;height:${rows * ch * Z}px;pointer-events:none`;
    lab.innerHTML = cells.map(([label], i) => `<span style="position:absolute;left:${(i % cols) * cw * Z}px;top:${Math.floor(i / cols) * ch * Z + ch * Z - 24}px;width:${cw * Z}px;text-align:center;font:500 11px/1.2 var(--font);color:var(--fg)">${esc(label)}</span>`).join('');
    wrap.appendChild(lab);
    document.documentElement.dataset.ready = '1';
  }
  // A window onto the game for the walk (prototype/shots.mjs). It reads; its verbs move the Keeper, strike a boss, offer a pick or change the look: play only, never the evidence.
  globalThis.FieldworksDebug = {
    castle: () => ({ pieces: CAS.pieces, count: { ...CAS.count }, towers: CAS.towers.slice(), wallHp: CAS.wallHp, dps: CAS.dps }),
    xp: () => S.st.player.xp, level: () => S.st.player.level, events: () => S.events.length, screen: () => S.screen, hearts: () => hearts(),
    horde: () => ({ day: S.horde.day, clock: { ...S.horde.clock }, dim: S.horde.dim, arrived: S.horde.arrived, history: S.horde.history.slice(), line: hordeLine(), need: needLine(), forecast: forecast() && { n: fc.horde.n, bosses: fc.horde.bosses, tasks: fc.tasks, outcome: fc.forecast.outcome } }),
    fight: () => (CS.fight ? { t: CS.fight.t, left: CS.fight.total - CS.fight.downed - CS.fight.keeperDowned, wall: CS.fight.wallHp, keeper: CS.fight.keeperDowned, done: CS.fight.done } : null),
    stage: () => (ST ? { week: ST.week, score: ST.score, x: ST.k.x, y: ST.k.y, hp: ST.k.hp, max: ST.k.max, len: ST.len, goal: ST.goal, done: ST.done, foes: ST.foes.filter((z) => z.alive).length, kinds: [...new Set(ST.foes.map((z) => z.type))].sort(), posts: ST.posts.map((p) => p.x), reached: ST.posts.filter((p) => p.hit).length, view: [VW, VH],
      build: { ...ST.up }, hud: ST.buildStr, picks: ST.picks, shake: ST.shake, flash: ST.flash, title: ST.name, vy: ST.k.vy, combo: ST.combo, cont: ST.cont, hard: ST.hard, biome: BIO.slug, dash: ST.k.dash > 0, inv: ST.k.inv > 0, full: ST.k.full, air: ST.k.air, shots: ST.shots.filter((s) => s.on).map((s) => s.big), arenas: ST.arenas.map((a) => ({ x: a.c0 * TILE, done: a.done })), caches: ST.caches.map((q) => ({ x: q.c0 * TILE, open: q.open })), movers: ST.movers.length, mover: ST.movers.length ? ST.movers[0].x : null, riding: !!ST.k.ride, wildsWorlds: ST.biomes.length, vents: ST.vents.length, spikes: ST.spike.reduce((a, b) => a + b, 0),
      boss: ST.boss.on ? { type: ST.boss.type, hp: ST.boss.hp, max: ST.boss.max, phase: ST.boss.phase, st: ST.boss.st, dead: ST.boss.dead > 0 } : null } : null),
    play: () => ({ best: { ...S.play.best }, wilds: { ...S.play.wilds }, wall: S.play.wall, total: totalScore(), paint: S.play.paint, mute: S.play.mute, hard: S.play.hard, bosses: S.play.bosses, pool: RS.upgrades.list.filter((u) => S.play.life >= u.at).map((u) => u.slug) }),
    audio: () => ({ started: !!AU.ctx, song: AU.song, wanted: AU.wanted, mute: S.play.mute }),
    embed: () => ({ on: EMBED, state: EMB.state, queued: !!EMB.queued, today: TODAY, out: OUT }),
    place(x) { if (!ST) return; restand(x); ST.k.safe = Math.floor(x / TILE) * TILE; ST.camX = Math.max(0, x - 56); ST.camRow = ST.camTo = (ST.k.y + KH) / TILE; },
    clearFoes() { if (ST) for (const z of ST.foes) z.alive = false; },
    hitBoss(n) { if (ST && ST.boss.on && !ST.boss.dead) ST.boss.hp -= n; },
    offer() { if (ST) offerUpgrade('checkpoint'); },
    look(slug) { setBiome(slug); },
    give(slug) { if (ST) takeUpgrade(slug); },
    ride() { if (!ST || !ST.movers.length) return null; const m = ST.movers[0], k = ST.k; k.x = m.x + 6; k.y = m.y - KH - 3; k.vx = 0; k.vy = 0; ST.camX = Math.max(0, k.x - 56); ST.camRow = ST.camTo = m.y / TILE; return { x: m.x, x0: m.x0, x1: m.x1 }; },
    far() { if (ST) { restand((ST.len - 6) * TILE); ST.camX = ST.k.x - 56; } },
    hurt() { if (ST) { ST.k.inv = 0; hurt(); } },
    keys: () => ({ ...keys })
  };
  function boot() {
    if (globalThis.FIELDWORKS_ART) { reset(); paintKeeper(); renderArtSheet(); return; }
    if (OUT && !EMBED) {   // the account's chrome: the prototype bar, SocialOS's Home and its Create pill
      document.querySelector('.wrap > .dev').style.display = 'none'; document.getElementById('homebtn').parentElement.style.display = 'none';
      document.querySelector('.ribbon .brand').textContent = 'Fieldworks'; document.querySelector('.ribbon .pill.lit').style.display = 'none';
    }
    if (EMBED) {   // no prototype bar, no phone frame, no host chrome: the game and one way out
      const b = document.createElement('button'); b.id = 'fwClose'; b.className = 'closebtn'; b.setAttribute('aria-label', BANK.embed.close); b.textContent = '✕'; document.getElementById('phone').appendChild(b);
    }
    S = undefined;
    const loaded = loadSave();
    if (loaded === 'none') reset();
    S.keeperName = store.get(KEYS.keeper) || '';
    newCastleScene(); paintKeeper();
    teleOpen();
    if (matchMedia('(prefers-color-scheme: dark)').matches && !document.documentElement.getAttribute('data-theme')) document.querySelectorAll('#seg-theme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === 'dark')));
    if (EMBED) embedListen();   // before the first draw: the listener is up, `ready` is posted, and the state is honest from the first frame
    render();
    // A horde that arrived while the page was shut is resolved by the same stepping function, and its summary shown.
    if (S.horde.arrived) { CS.fight = C.hordeStart(CAS, S.horde.arrived, RULES, freshNow()); teleAdd('hordes_seen'); skipFight(); }
    if (loaded === 'migrated') { toast(BANK.castle.save_migrated); saveNow(); }
    if (loaded === 'old-game') { toast(BANK.castle.save_old_game); saveNow(); }
    if (loaded === 'corrupt') { toast(BANK.castle.save_corrupt); saveNow(); }
    startLoop();
  }
  addEventListener('pointerdown', auUnlock, { passive: true });   // sound starts with the first input, never before
  boot();
