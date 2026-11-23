  // ══════════════════════ rendering the screens ══════════════════════
  const $screen = document.getElementById('screen'), $overlay = document.getElementById('overlay'), $live = document.getElementById('live'), $mode = document.getElementById('modepill'), $home = document.getElementById('homebtn');
  function head(title, sub, back) { return `<div class="shead">${back ? `<button class="back" data-go="${back}" aria-label="Back">${icon('back')}</button>` : ''}<span class="mark" aria-hidden="true"></span><div class="grow"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div></div>`; }
  let hudEls = null;
  function gameShell(mode) {
    const strip = OUT ? (mode === 'castle' ? `<button class="pri" data-go="stages">${icon('field')} ${esc(BANK.castle.gate)}</button><button data-go="keeper">${icon('medal')} ${esc(BANK.castle.keeper)}</button>` : `<button data-go="castle">${icon('fort')} ${esc(BANK.stage.home)}</button>`)
      : EMBED ? (mode === 'castle' ? `<button class="pri" data-host="workorders">${icon('engine')} ${esc(BANK.castle.orders)}</button><button data-go="stages">${icon('field')} ${esc(BANK.castle.gate)}</button>` : `<button data-go="castle">${icon('fort')} ${esc(BANK.stage.home)}</button><button data-host="workorders">${icon('engine')} ${esc(BANK.castle.orders)}</button>`)   // embedded, evidence is made in the host: the button asks it to open its work orders
      : mode === 'castle'
      ? `<button class="pri" data-go="siege">${icon('engine')} ${esc(BANK.castle.orders)}</button><button data-go="stages">${icon('field')} ${esc(BANK.castle.gate)}</button>`
      : `<button data-go="castle">${icon('fort')} ${esc(BANK.stage.home)}</button><button data-go="siege">${icon('engine')} ${esc(BANK.castle.orders)}</button>`;
    return `<div class="hud" id="hud"><div class="title"><b id="hudTitle"></b></div><div class="meter" id="hudCastle"></div><div class="meter"><span>L<b id="lvl"></b></span><div class="bar"><i id="xpBar"></i></div></div><div class="statechip" id="stateChip"></div><button class="mutebtn" id="muteBtn" data-mute="1" aria-pressed="${S.play.mute}">${esc(S.play.mute ? BANK.sound.off : BANK.sound.on)}</button></div>
      <div class="ticker" id="ticker" aria-live="off"><b id="tickA"></b><span class="need" id="tickB"></span></div>
      <div class="stage" id="stage"><canvas class="game" id="game" aria-label="${mode === 'castle' ? 'The castle. It defends itself; move along the wall and fire if you like.' : 'A stage. Run right, jump, dash, fire; hold fire to charge.'}"></canvas>${mode === 'stage' ? '<div class="wpcard" id="wpcard" hidden></div>' : `<button class="skipbtn" id="skipFight" hidden>${esc(BANK.horde.skip)}</button>`}</div>
      <nav class="pad" aria-label="Controls"><button data-key="left" aria-label="Left">◀</button><button data-key="right" aria-label="Right">▶</button><span class="gap"></span><button class="act alt" data-key="dash">${esc(BANK.stage.pad_dash)}</button><button class="act" data-key="fire">${esc(BANK.stage.pad_fire)}</button><button class="act" data-key="jump">${esc(BANK.stage.pad_jump)}</button></nav><div class="strip">${strip}</div>`;
  }
  let tickHold = 0;
  /** The ticker: the horde line by default; a passing sentence (from the bank) holds it for a few seconds. */
  function ticker(a, b) { const A = document.getElementById('tickA'), B = document.getElementById('tickB'); if (!A) return;
    if (!b && a.length > 30 && ST) { b = a; a = ST.wilds ? BANK.stage.wilds : fill(BANK.stage.week, { n: ST.week }); }   // a long sentence goes on the line that wraps, under the stage's name
    A.textContent = a; B.textContent = b; A.parentElement.classList.add('calm'); tickHold = 3; $live.textContent = `${a} ${b}`; }
  function updateHud() {
    if (!hudEls || !document.getElementById('hud')) return;
    const st = S.st, pr = st.player.progress, set = (el, v) => { v = String(v); if (el && el.textContent !== v) el.textContent = v; };
    set(hudEls.title, S.screen === 'castle' ? 'Castle' : ST && ST.wilds ? BANK.stage.wilds : fill(BANK.stage.week, { n: ST ? ST.week : '' }));
    set(hudEls.castle, `${fill(BANK.castle.count, { n: CAS.pieces })} · ${fill(BANK.castle.wall, { n: CAS.wallHp })} · ${fill(BANK.castle.fire, { n: CAS.dps })}`);
    set(hudEls.lvl, st.player.level); hudEls.xp.style.width = Math.round(100 * pr.into / pr.need) + '%';
    set(hudEls.state, S.state === 'dark' ? fill(BANK.states.dark, { days: RULES.states.dark_days }) : S.state === 'quiet' ? BANK.states.quiet : '');
    if (tickHold <= 0) { const A = document.getElementById('tickA'), B = document.getElementById('tickB'); set(A, hordeLine()); set(B, needLine()); A.parentElement.classList.toggle('calm', !S.horde.clock.due && !S.horde.arrived); }
  }
  function mountCanvas() {
    cv = document.getElementById('game'); if (!cv) return; ctx = cv.getContext('2d');
    hudEls = { title: document.getElementById('hudTitle'), castle: document.getElementById('hudCastle'), state: document.getElementById('stateChip'), lvl: document.getElementById('lvl'), xp: document.getElementById('xpBar') };
    resize(); stageObs.disconnect(); stageObs.observe(document.getElementById('stage'));
    document.querySelectorAll('.pad [data-key]').forEach((b) => {
      const k = b.dataset.key, on = (e) => { auUnlock(); keys[k] = true; if (k in tap) tap[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); }, off = () => { keys[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off); b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }
  function resize() {
    const st = document.getElementById('stage'); if (!st || !cv) return;
    const w = st.clientWidth - 12, sc = Math.max(1, Math.round(w / RS.view_w)); VW = clamp(Math.floor(w / sc), 150, 220); VH = clamp(Math.floor((st.clientHeight - 4) / sc), 110, 232);
    bgKey = ''; cv.width = VW; cv.height = VH; cv.style.width = VW * sc + 'px'; cv.style.height = VH * sc + 'px'; ctx.imageSmoothingEnabled = false;
  }
  new ResizeObserver(() => resize()).observe(document.getElementById('phone'));
  const stageObs = new ResizeObserver(() => resize());
  function stageRows() {
    const x = E.expedition(PLAN, S.ticks, RULES), B = BANK.stage; let open = true;
    const rows = PLAN.weeks.map((w, i) => {
      const b = S.play.best[`w${w.n}`], reg = x.regions[i], can = open; open = open && !!b;
      const biome = RS.biomes.weeks[(w.n - 1) % RS.biomes.weeks.length], boss = RS.bosses.order[(w.n - 1) % RS.bosses.order.length];
      return `<button class="row" data-stage="${w.n}" ${can ? '' : 'disabled'}><span class="chip ${reg.mapped ? 'g g-fine' : ''}">${w.n}</span><div class="t"><div class="name">${esc(fill(B.week, { n: w.n }))}${b ? ` ${'★'.repeat(b.stars)}` : ''}</div><div class="meta">${esc(BANK.biome[biome].name)} · ${esc(BANK.boss[boss].name)} · ${esc(fill(B.posts, { done: reg.done, total: reg.total }))}${reg.mapped ? ` · ${esc(B.mapped)}` : ''} · ${can ? esc(b ? fill(B.best, { score: b.score }) : B.unplayed) : esc(fill(B.locked, { n: w.n - 1 }))}</div></div></button>`;
    }).join('');
    // the two switches (kept on this device) and the track of what play score has opened: things for play, never for the castle
    const M = BANK.meta, life = S.play.life, next = RS.meta.unlocks.find((u) => life < u.at);
    const switches = `<section class="card" id="switches"><div class="row"><div class="t"><div class="name">${esc(B.hard)}</div><div class="meta">${esc(fill(B.hard_note, { x: RS.hard.score }))}</div></div><button class="switch" data-hard="1" role="switch" aria-checked="${S.play.hard}" aria-label="${esc(B.hard)}"><i></i></button></div><div class="row"><div class="t"><div class="name">${esc(BANK.sound.label)}</div><div class="meta">${esc(BANK.sound.note)}</div></div><button class="switch" data-mute="1" role="switch" aria-checked="${!S.play.mute}" aria-label="${esc(BANK.sound.label)}"><i></i></button></div></section>`;
    const track = `<section class="card" id="metacard"><h2>${esc(M.heading)} <span class="more">${esc(fill(M.total, { score: life }))}</span></h2><div class="empty">${esc(next ? fill(M.next, { at: next.at, what: M.names[next.slug] }) : M.all)}</div><div class="unlocks">${RS.meta.unlocks.map((u) => `<span class="chip ${life >= u.at ? 'g g-fine' : 'dash'}" data-unlock="${u.slug}" data-open="${life >= u.at}">${esc(M.names[u.slug])}${life >= u.at ? '' : ` · ${u.at}`}</span>`).join('')}</div><div class="empty" style="margin-top:6px">${esc(M.note)}</div></section>`;
    const hostCard = EMBED && !OUT ? `<section class="card" id="hostcard"><h2>${esc(BANK.embed.where)}</h2>${['workorders', 'learning', 'health'].map((to) => `<button class="row" data-host="${to}"><div class="t"><div class="name">${esc(BANK.embed.places[to])}</div><div class="meta">${esc(BANK.embed.place_notes[to])}</div></div></button>`).join('')}</section>` : '';
    const wildsCard = `<section class="card"><h2>${esc(B.wilds)} <span class="more">${esc(S.play.wilds.best ? fill(B.best, { score: S.play.wilds.best }) : B.unplayed)}</span></h2><button class="row" data-stage="0"><span class="chip dash">∞</span><div class="t"><div class="name">${esc(B.wilds)}</div><div class="meta">${esc(B.wilds_line)} ${esc(fill(B.wilds_biomes, { n: wildsBiomes().length, of: RS.biomes.list.length }))}</div></div></button></section>`;
    if (OUT) return `${wildsCard}${switches}${track}<div class="empty">${esc(EMBED ? BANK.embed[EMB.state] : BANK.castle.signed_out)}</div><div class="empty">${esc(B.score_note)}</div>`;   // the roadmap's weeks are the account's
    const roadmap = PLAN.weeks.length ? `<section class="card"><h2>${esc(B.roadmap)} <span class="more">${esc(fill(B.roadmap_meta, { n: x.mapped, rank: x.rank.label }))}</span></h2>${rows}</section>` : `<div class="empty" id="noplan">${esc(BANK.embed.no_plan)}</div>`;
    return `${wildsCard}${switches}${roadmap}${track}${hostCard}<div class="empty">${esc(B.score_note)}</div>`;
  }
  function render() {
    if (EMBED && EMB.queued && !(S.screen === 'stage' && ST)) { const w = EMB.queued; EMB.queued = null; applyWorld(w); return; }   // a world that arrived mid-run is applied back at the castle
    const st = S.st; const wards = siegeNow(); const x = E.expedition(PLAN, S.ticks, RULES);
    if ($mode) $mode.textContent = `Fieldworks · ${S.screen}`;
    document.querySelectorAll('#seg-screen button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === S.screen)));
    if ($home) $home.setAttribute('aria-current', S.screen === 'home' ? 'page' : 'false');
    let html = '';
    if (S.screen === 'stage' && !ST) S.screen = 'castle';
    if ((OUT || EMBED) && !['castle', 'stage', 'stages', 'keeper'].includes(S.screen)) S.screen = 'castle';   // the backlog, Home, skills and the archive read an account; embedded, the host has its own
    if (S.screen !== 'stage') music(S.screen === 'castle' && (CS.fight || (S.horde.clock.due && S.state !== 'unlit')) ? 'warning' : 'castle');
    if (S.screen === 'castle' || S.screen === 'stage') {
      $screen.innerHTML = gameShell(S.screen); mountCanvas(); tickHold = 0; updateHud(); updateCard();
      if (S.screen === 'castle' && CS.fight) document.getElementById('skipFight').hidden = false;
      if (S.screen === 'castle' && !S.started) { S.started = true; if (store.get(KEYS.onboarded) === '1') showStart(); else showOnboarding(0); }
      renderOverlay(); return;
    }
    hudEls = null; cv = null;
    if (S.screen === 'stages') {
      html += head(BANK.stage.heading, OUT ? '' : esc(BANK.stage.sub), 'castle') + `<div class="content">${stageRows()}</div>`;
    } else if (S.screen === 'siege') {
      const f = forecast();
      html += head('The backlog', `${wards.reduce((a, w) => a + w.attackers.length, 0)} aged orders feed the horde · finish one to build the castle`, 'castle');
      html += `<div class="content"><section class="card"><h2>${esc(hordeLine())} ${f ? `<span class="more">${esc(fill(BANK.horde.size, { n: f.horde.n, bosses: f.horde.bosses }))}</span>` : ''}</h2><div class="empty" id="needline">${esc(needLine())}</div>${S.horde.clock.due && freshNow() ? `<div class="empty" id="rallyline">${esc(fill(BANK.horde.rally, { pct: Math.round((C.rallyOf(freshNow(), RULES) - 1) * 100), n: freshNow() }))}</div>` : ''}</section>`;
      for (const w of wards) {
        const keep = w.zone === 'keep';
        html += `<section class="card"><h2>${esc(wardOf(w.zone).name)} <span class="more">pressure ${w.pressure}</span></h2>`;
        for (const a of w.attackers) {
          const o = S.open.find((o) => o.id === a.id);
          if (keep) { html += `<div class="row"><span class="chip dash">private</span><div class="t"><div class="name">${a.engine ? 'An engine' : 'An attacker'} in the muster</div><div class="meta">counted, never named, never aged</div></div></div>`; continue; }
          html += `<button class="row" data-order="${a.id}"><span class="id">${a.id}</span><div class="t"><div class="name">${esc(o.title)}</div><div class="meta">${a.ageDays} d · ${o.pn} · ${o.effortMin} min · ${o.band}${a.decision ? ' · a decision' : ''}</div></div>${a.engine ? `<span class="chip eng">engine · ${a.hp} HP</span>` : `<span class="chip ${o.pn}">${o.pn}</span>`}</button>`;
        }
        html += `</section>`;
      }
      const open = S.open.filter((o) => o.tier === 'public' && !wards.some((w) => w.attackers.some((a) => a.id === o.id)));
      html += `<section class="card"><h2>Not yet in the muster <span class="more">${open.length} fresh orders</span></h2>${open.map((o) => `<button class="row" data-order="${o.id}"><span class="id">${o.id}</span><div class="t"><div class="name">${esc(o.title)}</div><div class="meta">${E.daysBetween(o.written, TODAY)} d · ${o.pn} · ${o.effortMin} min</div></div></button>`).join('')}</section>`;
      if (LIFT_DAYS.has(TODAY_DOW)) html += `<section class="card"><button class="row" data-lift="1" ${S.liftsLogged.includes(TODAY) ? 'disabled' : ''}><div class="t"><div class="name">Today's lift</div><div class="meta">${S.liftsLogged.includes(TODAY) ? 'logged' : 'a tick, never a number · a gate brace'}</div></div></button></section>`;
      html += `</div>`;
    } else if (S.screen === 'keeper') {
      const parts = E.keeper(st, { regions: x.mapped }, RULES), total = totalScore();
      html += head(S.keeperName || 'The Keeper', `L${st.player.level} · ${st.medals.length} plates · ${st.items.length} items`, 'castle');
      html += `<div class="content"><section class="card"><div class="keeper"><canvas id="keeperPic" width="28" height="36" aria-hidden="true"></canvas><div class="parts">${parts.map((p) => `<div class="part"><span>${esc(p.label)}</span><div class="tiers">${[1, 2, 3, 4, 5].map((t) => `<i class="${p.tier >= t ? 'on' : ''}"></i>`).join('')}</div><span class="chip">${esc(p.from.replace('_', ' '))} ${p.value}</span></div>`).join('')}</div></div><div class="empty" id="hullline" style="margin-top:8px"><b>${esc(fill(BANK.keeper.hearts, { n: hearts(), level: st.player.level }))}</b> · ${esc(BANK.keeper.hearts_note)}</div>${EMBED ? '' : `<div style="margin-top:10px;display:flex;gap:8px"><input class="input" id="kname" placeholder="Name the Keeper (kept on this device)" value="${esc(S.keeperName)}" aria-label="Keeper's name"><button class="btn" data-name="1">Save</button></div>`}</section>`;
      html += `<section class="card" id="paintcard"><h2>${esc(BANK.keeper.paint)} <span class="more">${esc(fill(BANK.keeper.total, { score: total }))}</span></h2><div class="empty">${esc(BANK.keeper.paint_note)}</div><div class="paints">${RS.paints.map((p) => `<button data-paint="${p.slug}" aria-pressed="${S.play.paint === p.slug}" ${total >= p.at ? '' : 'disabled'}><i style="background:${p.colour}"></i>${esc(p.label)}${total >= p.at ? '' : ` · ${esc(fill(BANK.keeper.paint_locked, { at: p.at }))}`}</button>`).join('')}</div><div class="empty" style="margin-top:8px">${esc(BANK.keeper.device)}</div></section>`;
      const last7 = Object.entries(TEL.opens).filter(([d]) => d >= new Date(Date.now() - 6 * DAY).toLocaleDateString('en-CA')).reduce((a, [, n]) => a + n, 0);
      if (!EMBED) html += `<section class="card" id="yournumbers"><h2>${esc(BANK.telemetry.heading)} <span class="more">${esc(BANK.telemetry.note)}</span></h2><div class="nums">${[['opens', last7], ['session_seconds', Math.round(TEL.session_seconds / 60)], ['closes_seen', TEL.closes_seen], ['stages_cleared', TEL.stages_cleared], ['hordes_seen', TEL.hordes_seen], ['regions_mapped', TEL.regions_mapped]].map(([k, v]) => `<div><b>${v}</b>${esc(BANK.telemetry[k])}</div>`).join('')}</div></section>`;
      html += `<section class="card"><h2>Plates <span class="more">${st.medals.length} medals · never lost</span></h2><div class="plates">${st.medals.map((m) => `<span class="plate-chip ${m.top ? 'top' : ''}" title="${esc(BANK.medal[m.slug])}">${icon('medal')}${esc(m.label)}<small>${m.at}</small></span>`).join('') || '<div class="empty">No plates yet.</div>'}</div></section>`;
      html += `<section class="card"><h2>The forge <span class="more">${st.items.length} items</span></h2>${st.items.slice().reverse().map((it) => `<div class="row"><span class="chip g g-${it.grade}">${it.grade}</span><div class="t"><div class="name">${esc(it.name)}${it.provisional ? ' <span class="chip dash">unverified</span>' : ''}</div><div class="meta">${it.sealed ? 'sealed · a count, never a name' : esc(it.receipt)}</div></div></div>`).join('')}</section></div>`;
    } else if (S.screen === 'skills') {
      html += head('Skills', 'one per ward · cosmetics first', 'castle');
      html += `<div class="content">${WARDS.filter((w) => !w.keep).map((w) => { const sk = st.skills[w.id] || { xp: 0, level: 0 }; return `<section class="card"><h2>${esc(w.name)} <span class="more">L${sk.level} · ${sk.xp} XP</span></h2><div class="rungs">${[1, 2, 3, 4, 5].map((r) => `<i class="${sk.level >= r ? 'on' : ''}"></i>`).join('')}</div>${RULES.skills.perks.map((p) => `<div class="row" style="min-height:32px;padding:5px 0"><span class="chip ${sk.level >= p.rung ? 'g g-fine' : ''}">${p.rung}</span><div class="t empty">${esc(p.label)}${sk.level >= p.rung ? ' · unlocked' : ''}</div></div>`).join('')}</section>`; }).join('')}<section class="card"><h2>Expedition <span class="more">${esc(x.rank.label)} · ${x.mapped} regions</span></h2><div class="rungs">${[1, 2, 3, 4, 5].map((r) => `<i class="${(st.skills.field ? st.skills.field.level : 0) >= r ? 'on' : ''}"></i>`).join('')}</div></section></div>`;
    } else if (S.screen === 'archive') {
      html += head('Archive', `${QUESTS.length} quests · ${PRIVATE_QUESTS} private, not named`, 'castle');
      html += `<div class="content">${QUESTS.map((q) => { const leaves = q.tasks, done = leaves.filter((t) => t[2] === 'done').length, complete = done === leaves.length; return `<section class="card"><h2>${esc(q.name)} <span class="more">${q.program ? esc(wardOf(q.program).name) : 'standalone'}</span></h2>${complete ? `<div class="row"><span class="chip g g-masterwork">campaign</span><div class="t"><div class="name">Quest complete</div><div class="meta">every objective done with evidence</div></div></div>` : ''}${leaves.map((t) => `<div class="row" style="min-height:36px;padding:6px 0"><span class="chip ${t[2] === 'done' ? 'g g-fine' : t[2] === 'blocked' ? 'dash' : ''}">${t[2] === 'done' ? '✓' : t[2] === 'blocked' ? 'lock' : t[2] === 'in_progress' ? '…' : '·'}</span><div class="t"><div class="name">${esc(t[1])}</div><div class="meta">${t[2] === 'blocked' ? `requires ${t[4]}` : t[2] === 'done' ? `evidence · ${t[3]}` : t[2]}</div></div></div>`).join('')}</section>`; }).join('')}<section class="card"><div class="row"><span class="chip dash">private</span><div class="t"><div class="name">${PRIVATE_QUESTS} quests in the Keep</div><div class="meta">counted, never named</div></div></div></section></div>`;
    } else if (S.screen === 'home') {
      html += `<div class="shead"><div class="grow"><h1>Home</h1><div class="sub">${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][TODAY_DOW]} · what needs you</div></div>${icon('sliders')}</div>`;
      html += `<div class="content"><div class="attn"><span class="n">7</span><div><b>things need you</b><div class="empty">4 drafts · 2 orders in Now · 1 reply</div></div></div><div class="tiles">
        <div class="tile wide" style="--node:var(--n-inbox)"><span class="dot"></span><span class="tt">Inbox</span><span class="tm">4 drafts waiting</span></div>
        <button class="tile play" data-go="castle" id="playtile"><span class="tt">${icon('fort')} Fieldworks</span><canvas class="mini" id="minimap" width="90" height="30" aria-hidden="true"></canvas><span class="tm"><b>${esc(hordeLine())}</b>${tileNeed() ? ' · ' + esc(tileNeed()) : ''}</span></button>
        <div class="tile" style="--node:var(--n-workorders)"><span class="tt"><span class="dot"></span>Work orders</span><span class="tm">${S.open.filter((o) => o.band === 'now' && o.tier === 'public').length} in Now</span></div>
        <div class="tile" style="--node:var(--n-calendar)"><span class="tt"><span class="dot"></span>Calendar</span><span class="tm">2 lessons · 1 lift</span></div>
        <div class="tile" style="--node:var(--n-week)"><span class="tt"><span class="dot"></span>Week</span><span class="tm">Mixed · 7 live</span></div>
        <div class="tile" style="--node:var(--n-learning)"><span class="tt"><span class="dot"></span>Learning</span><span class="tm">Week 4 · on pace</span></div>
        <div class="tile" style="--node:var(--n-flow)"><span class="tt"><span class="dot"></span>Flow</span><span class="tm">1 red · 3 starved</span></div>
        <div class="tile wide" style="--node:var(--n-health)"><span class="dot"></span><span class="tt">Health</span><span class="tm">${LIFT_DAYS.has(TODAY_DOW) ? 'lift day' : 'rest day'} · 2 lifts this week</span></div>
      </div><div class="empty">Home at 375×667. The Fieldworks tile is the castle at thumb size with the horde's countdown under it.</div></div>`;
    }
    $screen.innerHTML = html;
    if (S.screen === 'home') drawMini();
    if (S.screen === 'keeper') { const c = document.getElementById('keeperPic'), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(KS.idle[0], 0, 0, KW, KH, 0, 0, 28, 36); }
    renderOverlay();
  }
  /** The Home tile's thumbnail: the castle screen's own drawing, cropped. */
  function drawMini() {
    const m = document.getElementById('minimap'); if (!m) return;
    const keepCv = cv, keepCtx = ctx, keepVH = VH, off = document.createElement('canvas'); off.width = VW; off.height = 120;
    ctx = off.getContext('2d'); VH = 120; bgKey = '';
    setBiome(RS.biomes.home); drawWorld(0, 1); ground(92, 0); drawCastle(CAS, 0, 92, S.horde.dim, 1, S.state === 'quiet', !!S.horde.clock.due);
    ctx = keepCtx; cv = keepCv; VH = keepVH; bgKey = '';
    const g = m.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(off, 0, 58, 114, 38, 0, 0, 90, 30);
  }
  function renderOverlay() {
    if (!S.order) { $overlay.querySelectorAll('.sheet').forEach((s) => s.parentElement.remove()); return; }
    const o = S.open.find((x) => x.id === S.order); if (!o) { S.order = null; return renderOverlay(); }
    const age = E.daysBetween(o.written, TODAY), w = wos(o), pick = S.picked || (o.options ? o.options.find((x) => /recommended/.test(x.t)).k : null);
    $overlay.querySelectorAll('.sheet').forEach((s) => s.parentElement.remove());
    const piece = C.pieceFor({ kind: o.options ? 'decision' : 'close', item: E.drop(closeEvent(o), RULES) }, RULES);
    const el = document.createElement('div'); el.className = 'scrim'; el.dataset.close = '1';
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="otitle"><div class="handle"></div><div style="display:flex;justify-content:space-between;align-items:center"><span class="id">${o.id} · ${o.pn} · WOS ${w}</span><button class="btn" data-close="1" aria-label="Close" style="min-height:32px;padding:0 10px">✕</button></div><h3 id="otitle">${esc(o.title)}</h3>
      <dl class="kv"><dt>Age</dt><dd>${age} d${age >= 60 || (o.options && age >= 45) ? ' · a siege engine in the horde' : age >= 21 || o.options ? ' · in the muster' : ''}</dd><dt>Effort</dt><dd>${o.effortMin} min · ${o.difficulty} · ${o.device}</dd><dt>Lane</dt><dd>${o.band} · due ${o.due}</dd></dl>
      <div><b>Steps</b><ol class="steps">${o.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
      ${o.options ? `<div><b>Options</b><div style="display:grid;gap:6px;margin-top:6px">${o.options.map((x) => `<button class="opt ${/recommended/.test(x.t) ? 'rec' : ''}" data-pick="${x.k}" aria-pressed="${pick === x.k}"><b>${x.k}.</b><span>${esc(x.t)}</span></button>`).join('')}</div><div class="say" style="margin-top:6px">${esc(o.options.find((x) => x.k === pick).say)}</div></div>` : ''}
      <div><b>Mark done</b><div class="empty" style="padding:2px 0 6px">Proof: a link, a run or a sha. Required.</div><input class="input" id="proof" placeholder="https://… or a sha" value="${esc(S.proof)}" aria-label="Proof"></div>
      <button class="btn pri blk" data-done="${o.id}" ${S.proof.trim() ? '' : 'disabled'}>${o.options ? `Answer ${pick} and mark done` : 'Mark done'}</button>
      <div class="empty">${piece ? esc(fill(BANK.castle.piece, { what: BANK.castle.parts[piece.part] })) : ''} The drop rolls from this order's own facts.</div></div>`;
    $overlay.appendChild(el); setTimeout(() => document.getElementById('proof')?.focus(), 0);
  }
  function showOnboarding(i) {
    const ids = RULES.onboarding.cards, c = BANK.onboarding[ids[i]];
    const el = paper(`<div class="keys">${i + 1} of ${ids.length}</div><h2 data-onboard="${i}">${esc(c.title)}</h2><p>${esc(c.body)}</p><button class="primary" data-act="next">${i + 1 < ids.length ? 'Next' : 'Got it'}</button>`);
    el.addEventListener('click', (e) => { if (!e.target.closest('[data-act="next"]')) return; el.remove(); if (i + 1 < ids.length) showOnboarding(i + 1); else { store.set(KEYS.onboarded, '1'); showStart(); } });
  }
  function showStart() {
    const el = paper(`<h2>Fieldworks</h2><p>${esc(BANK.castle.start)}</p><p>${esc(BANK.castle.how)}</p>${EMBED && OUT ? `<p><b>${esc(BANK.embed[EMB.state])}</b></p>` : OUT ? `<p><b>${esc(BANK.castle.signed_out)}</b></p>` : `<p><b>${esc(hordeLine())}.</b> ${esc(needLine())}</p>`}<p class="keys">${esc(BANK.castle.keys)}</p><button class="primary" data-act="start">${esc(BANK.castle.power_on)}</button>`);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-act="start"]')) el.remove(); });
  }
