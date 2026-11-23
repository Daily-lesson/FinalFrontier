  // ══════════════════════ the moment: finished work → event → drop card → medal → a piece on the castle ══════════════════════
  function fire(newEvents, after) {
    const before = S.st;
    for (const e of newEvents) S.events.push(e);
    moment(before, after);
  }
  /** What the evidence just did, shown: the fold is run again and whatever is new in its log gets its card, its medal and its piece. */
  function moment(before, after) {
    const st = derive(); setState(st);
    const fresh = st.log.filter((l) => !S.shown.has(l.id) && !l.voided); fresh.forEach((l) => S.shown.add(l.id));
    const medals = fresh.flatMap((l) => l.medals); const item = fresh.map((l) => l.item).find(Boolean);
    const gain = st.player.xp - before.player.xp;
    const pieces = fresh.map((l) => C.pieceFor(l, RULES)).filter(Boolean);
    const relit = !EMBED && S.horde.dim && pieces.length > 0; if (relit) S.horde.dim = false;   // the next evidence relights a breached wall
    const levelled = st.player.level > S.lastLevel; S.lastLevel = Math.max(S.lastLevel, st.player.level);
    updateHud(); saveNow(); teleSave();
    const seq = [];
    if (item) seq.push((next) => { sfx('upgrade'); showDrop(item, gain, pieces[0], next); });
    for (const m of medals) seq.push((next) => showMedal(m, next));
    seq.push((next) => { const said = [pieces.length ? fill(BANK.castle.piece, { what: BANK.castle.parts[pieces[0].part] }) : '', relit ? BANK.castle.relit : '', levelled ? fill(BANK.keeper.level, { n: st.player.level }) : ''].filter(Boolean).join(' '); if (said) toast(said); $live.textContent = `${gain} XP. ${said} ${medals.map((m) => m.label).join(', ')}`; after && after(); next(); });
    let i = 0; const next = () => { const f = seq[i++]; if (f) f(next); }; next();
  }
  function showDrop(item, gain, piece, next) {
    const el = document.createElement('div'); el.className = 'dropwrap';
    el.innerHTML = `<div class="dropcard ${item.provisional ? 'provisional' : ''}" role="dialog" aria-label="A drop"><div class="rail g-${item.grade}"></div><div class="body"><div class="eyebrow"><span>${esc(BANK.drop[item.grade])}</span><span>+${gain} XP</span></div><div class="nm">${esc(item.name)}</div><div><span class="chip g g-${item.grade}">${item.grade}</span> ${item.sealed ? '<span class="chip dash">sealed</span>' : ''} ${item.provisional ? `<span class="chip dash">${esc(BANK.weather.provisional)}</span>` : ''}</div>${item.receipt ? `<div class="rc">${esc(item.receipt)}</div>` : '<div class="rc">a count, never a name</div>'}${piece ? `<div class="empty" data-piece="${piece.part}">${esc(fill(BANK.castle.piece, { what: BANK.castle.parts[piece.part] }))}</div>` : ''}<button class="btn pri blk" data-take="1">Take it</button></div></div>`;
    $overlay.appendChild(el); el.querySelector('[data-take]').addEventListener('click', () => { el.remove(); next(); }); el.querySelector('[data-take]').focus();
  }
  function showMedal(m, next) { const el = document.createElement('div'); el.className = 'medalpop'; el.setAttribute('role', 'status'); el.innerHTML = `${icon('medal')}<div><span class="l">${m.top ? 'Top medal' : 'Medal'} · ${esc(m.label)}</span><b>${esc(BANK.medal[m.slug])}</b></div>`; $overlay.appendChild(el); setTimeout(() => { el.remove(); next(); }, 1500); }
  function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg; $overlay.appendChild(el); setTimeout(() => el.remove(), 2600); }
  function closeOrder(id) {
    if (EMBED) { hostGo('workorders'); return; }   // embedded, an order is finished in the host's own screen: no evidence is made here
    const o = S.open.find((x) => x.id === id); if (!o) return;
    const ev = closeEvent(o); S.closed.push(o.id); teleAdd('closes_seen');
    S.open = S.open.filter((x) => x.id !== id); S.order = null; S.picked = null; S.proof = ''; renderOverlay();
    fire([ev], () => { if (S.screen === 'siege') render(); });
  }
  function logLift() { if (EMBED) { hostGo('health'); return; } if (S.liftsLogged.includes(TODAY)) return; S.liftsLogged.push(TODAY); fire([liftEvent(TODAY)], () => render()); }
  function paper(html, bad) { const el = document.createElement('div'); el.className = 'scrim center'; el.innerHTML = `<div class="paper ${bad ? 'bad' : ''}" role="dialog">${html}</div>`; $overlay.appendChild(el); const b = el.querySelector('button'); if (b) b.focus(); return el; }
  function showSummary(sum) {
    const H = BANK.horde, who = (id) => (id === 'keep' ? H.guns.keep : fill(H.guns.tower, { n: id.slice(6) }));
    const lines = [fill(H.sum_downed, { n: sum.downed + sum.keeperDowned, total: sum.total }), fill(H.sum_wall, { pct: sum.wallLeft }), fill(H.sum_beacon, { pct: sum.beaconLeft }), sum.best ? fill(H.sum_best, { who: who(sum.best.id), n: sum.best.downed }) : H.sum_nobody];
    if (sum.rally) lines.push(fill(H.rally, { pct: sum.rally, n: Math.round(sum.rally / (RH.rally.per_piece * 100)) }));
    if (sum.withdrew) lines.push(fill(H.sum_withdrew, { n: sum.withdrew })); if (sum.keeperDowned) lines.push(fill(H.sum_keeper, { n: sum.keeperDowned }));
    const el = paper(`<h2 data-outcome="${sum.outcome}">${esc(H[sum.outcome])}</h2><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p class="keys">${esc(sum.outcome === 'held' ? H.next : BANK.castle.dim)}</p><button class="primary" data-act="summary">${esc(H.done)}</button>`, sum.outcome !== 'held');
    el.addEventListener('click', (e) => { if (e.target.closest('[data-act="summary"]')) { el.remove(); updateHud(); } });
  }
  function showResult(cleared, score, stars, lines, best, opened) {
    const B = BANK.stage;
    const el = paper(`<h2 data-result="${cleared ? 'clear' : 'over'}">${esc(cleared ? B.clear : B.over)}</h2><p><b data-score="${score}">${esc(fill(B.score, { score }))}</b>${best ? ' ' + esc(B.new_best) : ''}</p>${lines.length ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}${opened.length ? `<ul class="opened">${opened.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}<p class="keys">${esc(fill(BANK.meta.total, { score: S.play.life }))} ${esc(B.score_note)}</p><button class="primary" data-act="again">${esc(B.again)}</button><button class="second" data-act="castle">${esc(B.home)}</button>`, !cleared);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b) return; el.remove(); for (const kk in keys) keys[kk] = false; if (b.dataset.act === 'again') { newStage(S.stage); render(); } else leaveStage(); });
  }
