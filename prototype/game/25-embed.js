  // ══════════════════════ THE EMBED (embed/play.js): the host's world by postMessage; nothing of it is stored ══════════════════════
  // The game runs in a same-origin frame of the host app. It says `ready`, the host answers with a `world`, and a button that
  // fakes evidence in the DEMO asks the host to open the screen where the evidence is really made. Evidence is never created here.
  //   play → host   {fw:1, type:'ready'}   {fw:1, type:'go', to:'workorders'|'learning'|'health'|'close'}
  //   host → play   {fw:1, type:'world', today, theme, events, open, plan, horde, lanes, briefing?, bounty?}
  //   `bounty` (optional, FW2): {day, id} — the host's pick of the day's bounty (a public open order, by E.bounty's rule). The fold scores a close of that order on that day higher; absent or malformed, the game picks for display only.
  // EMB.state: 'reading' (waiting for the host) · 'world' (applied) · 'none' (no host answered: signed-out play) · 'unread' (a world came and could not be read).
  const EMB = { state: EMBED ? 'reading' : 'world', queued: null, fought: '', seen: false };
  const HOST_PLACES = ['workorders', 'learning', 'health', 'close'];
  function hostPost(msg) { if (!EMBED || window.parent === window) return; try { window.parent.postMessage(msg, self.origin); } catch {} }   // only ever to this origin
  function hostGo(to) { if (HOST_PLACES.includes(to)) hostPost({ fw: 1, type: 'go', to }); }
  const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
  const NAME_FIELDS = ['title', 'label', 'name', 'summary'];
  /** One open order in the shape E.siege takes, or null. Only these eight fields are kept: a title never enters the game. */
  function readOrder(o) {
    if (!o || typeof o !== 'object' || !isStr(o.id) || !isDay(o.written) || !(o.tier === 'public' || o.tier === 'private')) return null;
    if (o.tier === 'private' && NAME_FIELDS.some((k) => o[k] != null && String(o[k]).length)) return null;   // the engine's own wall, held here too
    if (!(o.pn == null || /^P[0-3]$/.test(o.pn)) || !(o.zone == null || isStr(o.zone)) || !(o.band == null || isStr(o.band))) return null;
    if (!(o.options == null || isInt(o.options)) || !(o.steps == null || isInt(o.steps))) return null;
    return { id: o.id, written: o.written, pn: o.pn || null, options: o.options || 0, steps: o.steps || 0, zone: o.tier === 'private' ? null : o.zone || null, tier: o.tier, band: o.band || null };
  }
  function readPlan(p) {
    if (p == null) return { weeks: [] };
    if (typeof p !== 'object' || !Array.isArray(p.weeks) || p.weeks.length > 60) return null;
    const weeks = [];
    for (const w of p.weeks) { if (!w || !isInt(w.n) || w.n < 1 || !Array.isArray(w.lessons) || w.lessons.length > 40 || !w.lessons.every(isStr)) return null; weeks.push({ n: w.n, lessons: w.lessons.slice() }); }
    return { weeks };
  }
  const hordeShape = (x) => ({ n: x.n, bosses: x.bosses, ordinal: x.ordinal });
  /** The whole message, validated; null when any of it is malformed (the message is then ignored, and the game says so). */
  function readWorld(m) {
    if (!m || typeof m !== 'object' || m.fw !== 1 || m.type !== 'world' || !isDay(m.today)) return null;
    if (!(m.theme == null || m.theme === 'light' || m.theme === 'dark')) return null;
    if (!Array.isArray(m.events) || !Array.isArray(m.open) || m.events.length > 20000 || m.open.length > 5000) return null;
    const v = E.validateEvents(m.events); if (v.refused.length) return null;   // the engine's own check; it refuses a private event with a name field
    const open = []; for (const o of m.open) { const r = readOrder(o); if (!r) return null; open.push(r); }
    const plan = readPlan(m.plan); if (!plan) return null;
    const L = m.lanes; if (!L || typeof L !== 'object' || typeof L.workorders !== 'boolean' || typeof L.learning !== 'boolean' || typeof L.body !== 'boolean') return null;
    let horde = null;
    if (m.horde != null) {
      const h = m.horde; if (!validHorde(h)) return null;
      const c = h.clock;
      horde = { day: h.day, clock: { gather: c.gather, warned: c.warned, due: c.due, count: c.count, last: c.last, horde: c.horde ? hordeShape(c.horde) : null }, history: [], dim: h.dim, arrived: h.arrived ? hordeShape(h.arrived) : null, fresh: h.fresh };
    }
    const bounty = m.bounty && typeof m.bounty === 'object' && isDay(m.bounty.day) && isStr(m.bounty.id) ? { day: m.bounty.day, id: m.bounty.id } : null;   // optional: a malformed one is ignored, never a reason to refuse
    // `briefing` (optional) is a later phase's: carried by the host, ignored here, never a reason to refuse.
    // The eight fields an engine event has, and nothing else a host might have left on one.
    const events = v.ok.map((e) => ({ id: e.id, kind: e.kind, at: e.at, tier: e.tier, zone: e.zone ?? null, weight: e.weight, facts: e.facts, evidence: e.evidence }));
    return { today: m.today, theme: m.theme || null, events, open, plan, horde, bounty, lanes: { workorders: L.workorders, learning: L.learning, body: L.body } };
  }
  /** The host's world becomes the game's: the castle is the fold over the host's events, the horde is the host's, the day is the host's. */
  function applyWorld(w) {
    // A lane read for the first time brings its whole history: that is the castle as it stood, not work just finished,
    // so it is taken as the baseline (no drop card, no level toast) exactly as the first world is.
    const was = S.lanes || {}, landed = ['workorders', 'learning', 'body'].some((k) => w.lanes[k] && !was[k]);
    const first = !EMB.seen || landed, before = S.st;
    TODAY = w.today; OUT = false; EMB.state = 'world'; EMB.seen = true;
    if (w.theme) document.documentElement.setAttribute('data-theme', w.theme);
    PLAN = w.lanes.learning ? w.plan : { weeks: [] };
    S.events = w.events; S.open = w.open; S.closed = []; S.liftsLogged = [];
    S.ticks = w.events.filter((e) => e.kind === 'lesson').map((e) => e.id.replace(/^lesson\//, ''));
    S.bounties = w.bounty ? [w.bounty] : [];   // only the host's pick enters the fold; nothing of it is stored
    S.lanes = w.lanes; S.state = w.lanes.workorders ? 'live' : 'unlit';
    S.hordeKnown = !!w.horde; S.horde = w.horde || HORDE_NONE();
    const sig = S.horde.arrived ? `${S.horde.arrived.ordinal}/${S.horde.arrived.n}/${S.horde.clock.last}` : '';
    if (sig && sig === EMB.fought) S.horde.arrived = null;   // a horde already fought in this sitting is not fought again
    sgSeen = -1; bgKey = '';
    if (first) { setState(derive()); S.lastLevel = S.st.player.level; for (const l of S.st.log) S.shown.add(l.id); render(); }
    else { render(); moment(before, null); }   // work finished in the host since the last world: its drop card and its piece
    if (S.horde.arrived) { EMB.fought = sig; beginFight(); }   // a horde the host marks arrived is met here, by the one stepping function
  }
  function embedUnread() { if (EMB.state !== 'world') { EMB.state = 'unread'; updateHud(); } else toast(BANK.embed.unread); }
  function embedListen() {
    addEventListener('message', (ev) => {
      if (ev.source !== window.parent || ev.origin !== self.origin) return;   // the host and nobody else; the window's origin, never the document's own URL: a srcdoc frame has none
      const m = ev.data; if (!m || typeof m !== 'object' || m.fw !== 1 || m.type !== 'world') return;
      const w = readWorld(m); if (!w) { embedUnread(); return; }
      if (S.screen === 'stage' && ST) EMB.queued = w; else applyWorld(w);   // a run in progress is never lost: the world waits for the castle
    });
    if (window.parent === window) EMB.state = 'none';   // opened on its own: signed-out play, the Wilds only
    else setTimeout(() => { if (EMB.state === 'reading') { EMB.state = 'none'; updateHud(); } }, RULES.embed.wait_ms);
    hostPost({ fw: 1, type: 'ready' });
  }
