// FIELDWORKS engine — reference implementation of docs/FIELDWORKS.md §7.3.
// Pure, window-free, clock-free, storage-free: every number comes from the
// rules file; the one source of variance is hash(). The prototype inlines
// this file byte for byte (check.mjs holds the two copies equal) and G1
// moves it to templates/game/engine.mjs with its tests. Classic script: an
// IIFE on globalThis, so a <script> tag, sw.js importScripts and node's vm
// can all load it.
(function () {
  'use strict';

  const KINDS = ['close', 'task', 'lesson', 'lift', 'decision', 'pace', 'verify', 'contradict'];
  const EVIDENCE = ['commit', 'url', 'sha', 'tick', 'verified'];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const DAY = 86400000;
  const PRIVATE_FIELDS = ['title', 'label', 'name', 'summary'];

  /** FNV-1a over a string → unsigned 32-bit. The one roll in the game. */
  function hash(s) {
    let h = 0x811c9dc5;
    const str = String(s);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }

  const utc = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, dd); };
  const isDate = (d) => typeof d === 'string' && DATE_RE.test(d) && !Number.isNaN(utc(d));
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const mondayOf = (d) => { const t = utc(d); const back = (new Date(t).getUTCDay() + 6) % 7; return iso(t - back * DAY); };

  /** Null when the event is well formed; else the one reason it is refused. */
  function validateEvent(ev) {
    if (!ev || typeof ev !== 'object') return 'not an object';
    if (typeof ev.id !== 'string' || !ev.id) return 'no id';
    if (!KINDS.includes(ev.kind)) return `unknown kind ${ev.kind}`;
    if (!isDate(ev.at)) return 'at is not YYYY-MM-DD';
    if (!(ev.tier === 'public' || ev.tier === 'private')) return 'tier is not public|private';
    if (ev.tier === 'private' && PRIVATE_FIELDS.some((k) => ev[k] != null && String(ev[k]).length)) return 'a private event carries a name field';
    if (!ev.evidence || !EVIDENCE.includes(ev.evidence.kind) || typeof ev.evidence.ref !== 'string' || !ev.evidence.ref) return 'no evidence';
    if (ev.weight != null && !(typeof ev.weight === 'number' && ev.weight >= 0 && ev.weight <= 100)) return 'weight outside 0–100';
    if (ev.zone != null && typeof ev.zone !== 'string') return 'zone is not a string';
    return null;
  }

  /** Validate a list: well-formed and unique ids. Returns {ok, refused:[{id, reason}]}. */
  function validateEvents(events) {
    const seen = new Set(); const ok = []; const refused = [];
    for (const ev of Array.isArray(events) ? events : []) {
      const why = validateEvent(ev);
      if (why) { refused.push({ id: ev && ev.id, reason: why }); continue; }
      if (seen.has(ev.id)) { refused.push({ id: ev.id, reason: 'duplicate id' }); continue; }
      seen.add(ev.id); ok.push(ev);
    }
    return { ok, refused };
  }

  // ── rarity (§6.1) ──────────────────────────────────────────────────────
  function rarityScore(ev, rules) {
    const r = rules.rarity; const f = ev.facts || {};
    const weight = typeof ev.weight === 'number' ? ev.weight : (r.default_weight[ev.kind] ?? 50);
    const pn = r.pn[f.pn] ?? r.pn.none;
    const diff = r.difficulty[f.difficulty] ?? r.difficulty.none;
    const age = Math.min(r.age_cap, (f.ageDays ?? 0) / r.age_divisor);
    const dec = ev.kind === 'decision' || f.options ? r.decision_bonus : 0;
    const v = (hash(ev.id) % (2 * r.variance + 1)) - r.variance;
    return Math.round(r.weight_factor * weight + pn + diff + age + dec + v);
  }
  function gradeOf(score, rules) {
    const t = rules.rarity.thresholds; const g = rules.rarity.grades;
    if (score >= t.heirloom) return g[4];
    if (score >= t.masterwork) return g[3];
    if (score >= t.tempered) return g[2];
    if (score >= t.fine) return g[1];
    return g[0];
  }
  const DROPPING = new Set(['close', 'task', 'lesson', 'lift', 'decision']);
  /** The item an event drops, or null for a kind that drops nothing (pace, verify, contradict). */
  function drop(ev, rules) {
    if (!DROPPING.has(ev.kind)) return null;
    const r = rules.rarity;
    const sealed = ev.tier === 'private';
    const kind = sealed ? r.sealed_kind : r.kind_by_event[ev.kind];
    // A sealed item's grade reads Pn alone: no weight, age or variance can leak a fact.
    const score = sealed ? (r.pn[(ev.facts || {}).pn] ?? r.pn.none) * 2 : rarityScore(ev, rules);
    const grade = gradeOf(score, rules);
    const names = (((rules.bank || {}).item || {})[kind] || {})[grade] || [];
    const name = names.length ? names[hash(ev.id + '/name') % names.length] : null;
    const f = ev.facts || {};
    const receipt = sealed ? null : [ev.id, f.pn, f.ageDays != null ? `${f.ageDays} d` : null, f.band ? `${f.band} lane` : null, ev.at].filter(Boolean).join(' · ');
    return { id: ev.id, event: ev.id, kind, grade, score, name, receipt, zone: sealed ? null : ev.zone || null, sealed, provisional: !(f.verified === true), at: ev.at };
  }

  // ── xp and levels (§6.2) ────────────────────────────────────────────────
  function xp(ev, item, rules) {
    const base = rules.xp.base[ev.kind] ?? 0;
    const mult = item ? (rules.xp.mult[item.grade] ?? 1) : 1;
    return Math.round(base * mult);
  }
  /** Triangular curve: level L needs step × L × (L+1) / 2. */
  function level(total, step) {
    if (!(total > 0) || !(step > 0)) return 0;
    return Math.floor((Math.sqrt(8 * total / step + 1) - 1) / 2);
  }
  function progress(total, step) {
    const L = level(total, step);
    const floor = step * L * (L + 1) / 2;
    const next = step * (L + 1) * (L + 2) / 2;
    return { level: L, into: total - floor, need: next - floor, next };
  }

  // ── medals (§6.7): predicates over the fold ─────────────────────────────
  function windowKey(window, at) {
    if (window === 'day') return at;
    if (window === 'week') return mondayOf(at);
    return 'ever';
  }
  function medalsFor(m, st, ev, rules) {
    const kind = ev.kind; const f = ev.facts || {};
    switch (m.type) {
      case 'kind_count': {
        if (kind !== m.kind) return false;
        const key = windowKey(m.window, ev.at);
        const n = st.live.filter((e) => e.kind === m.kind && windowKey(m.window, e.at) === key).length;
        return n >= m.n;
      }
      case 'same_band': {
        if (kind !== 'close' || !f.band) return false;
        const key = windowKey(m.window, ev.at);
        const n = st.live.filter((e) => e.kind === 'close' && (e.facts || {}).band === f.band && windowKey(m.window, e.at) === key).length;
        return n >= m.n;
      }
      case 'on_due': return kind === (m.kind || 'close') && !!f.due && f.due === ev.at;
      case 'verified': return kind === 'verify';
      case 'after_quiet': {
        if (!DROPPING.has(kind)) return false;
        const before = st.live.filter((e) => DROPPING.has(e.kind) && e.id !== ev.id && utc(e.at) < utc(ev.at));
        if (!before.length) return false;
        const last = before.reduce((a, e) => (utc(e.at) > utc(a.at) ? e : a));
        return daysBetween(last.at, ev.at) >= (m.quiet_days || rules.weather.quiet_days);
      }
      case 'age_at_close': return kind === 'close' && (f.ageDays ?? 0) >= m.min_days;
      case 'week_complete': return kind === 'lesson' && f.weekComplete === true;
      case 'quest_complete': return kind === 'task' && f.questComplete === true;
      default: return false;
    }
  }

  // ── the fold (§5 rule 3) ────────────────────────────────────────────────
  /**
   * ctx (optional): { plan: {weeks:[{n, lessons:[id]}]}, quests: {questId: [taskId]} }.
   * With a plan, a lesson event completes its week when every lesson id of that
   * week is a live lesson event (the lesson id is the event id after `lesson/`);
   * with quests, a task event completes its quest the same way (`task/<quest>/<id>`).
   * Without ctx the adapter's facts.weekComplete / facts.questComplete stand.
   */
  function evaluate(events, rules, today, ctx) {
    const { ok, refused } = validateEvents(events);
    const plan = ctx && ctx.plan ? ctx.plan : null;
    const quests = ctx && ctx.quests ? ctx.quests : null;
    const lessonId = (id) => String(id).replace(/^lesson\//, '');
    const taskOf = (id) => { const m = /^task\/([^/]+)\/(.+)$/.exec(String(id)); return m ? { quest: m[1], task: m[2] } : null; };
    const sorted = ok.slice().sort((a, b) => utc(a.at) - utc(b.at) || a.id.localeCompare(b.id));
    // A contradiction voids the event it names (facts.target); verify settles it.
    const voided = new Set(sorted.filter((e) => e.kind === 'contradict' && (e.facts || {}).target).map((e) => e.facts.target));
    const verified = new Set(sorted.filter((e) => e.kind === 'verify' && (e.facts || {}).target).map((e) => e.facts.target));
    const st = { live: [], items: [], medals: [], player: { xp: 0 }, skills: {}, keep: { closes: 0, items: 0 }, counts: { close: 0, task: 0, lesson: 0, lift: 0, decision: 0, pace: 0 }, refused, voided: [...voided], log: [] };
    const earned = new Set();
    for (const ev0 of sorted) {
      let ev = ev0;
      if (voided.has(ev.id)) { st.log.push({ id: ev.id, voided: true }); continue; }
      if (ev.kind === 'contradict') continue;
      st.live.push(ev);
      if (st.counts[ev.kind] != null) st.counts[ev.kind]++;
      // completion, computed here when the context allows (M3), else the adapter's flag
      if (ev.kind === 'lesson' && plan) {
        const lid = lessonId(ev.id); const week = (plan.weeks || []).find((w) => w.lessons.includes(lid));
        const have = new Set(st.live.filter((e) => e.kind === 'lesson').map((e) => lessonId(e.id)));
        ev = { ...ev, facts: { ...(ev.facts || {}), weekComplete: !!week && week.lessons.every((l) => have.has(l)) } };
      }
      if (ev.kind === 'task' && quests) {
        const t = taskOf(ev.id); const all = t && quests[t.quest];
        const have = new Set(st.live.filter((e) => e.kind === 'task').map((e) => (taskOf(e.id) || {}).task));
        ev = { ...ev, facts: { ...(ev.facts || {}), questComplete: !!all && all.every((x) => have.has(x)) } };
      }
      let item = drop(ev, rules);
      if (item && verified.has(ev.id)) item = { ...item, provisional: false };
      // the Return floor (§3): the first drop after a quiet week is at least the return grade
      const quietBefore = (() => { if (!item) return false; const before = st.live.filter((e) => DROPPING.has(e.kind) && e.id !== ev.id && utc(e.at) < utc(ev.at)); if (!before.length) return false; const last = before.reduce((a, e) => (utc(e.at) > utc(a.at) ? e : a)); return daysBetween(last.at, ev.at) >= rules.weather.quiet_days; })();
      if (item && quietBefore && rules.rarity.grades.indexOf(item.grade) < rules.rarity.grades.indexOf(rules.weather.return_grade)) item = { ...item, grade: rules.weather.return_grade, returned: true, name: (((rules.bank || {}).item || {})[item.kind] || {})[rules.weather.return_grade]?.[hash(ev.id + '/name') % ((((rules.bank || {}).item || {})[item.kind] || {})[rules.weather.return_grade] || [1]).length] ?? item.name };
      let gain = xp(ev, item, rules);
      if (ev.kind === 'lesson' && (ev.facts || {}).weekComplete) gain += rules.expedition.region_bonus_xp;
      st.player.xp += gain;
      if (item) {
        st.items.push(item);
        if (item.sealed) { st.keep.items++; if (ev.kind === 'close') st.keep.closes++; }
      }
      const zone = ev.tier === 'private' ? null : (ev.kind === 'lesson' ? 'field' : ev.zone || null);
      if (zone) { st.skills[zone] = st.skills[zone] || { xp: 0 }; st.skills[zone].xp += gain; }
      const fired = [];
      for (const m of rules.medals) {
        const key = `${m.slug}/${windowKey(m.window, ev.at)}`;
        if (earned.has(key)) continue;
        if (medalsFor(m, st, ev, rules)) { earned.add(key); const md = { slug: m.slug, label: m.label, at: ev.at, event: ev.id, top: !!m.top }; st.medals.push(md); fired.push(md); }
      }
      st.log.push({ id: ev.id, kind: ev.kind, xp: gain, item, medals: fired });
    }
    st.player.level = level(st.player.xp, rules.xp.player_step);
    st.player.progress = progress(st.player.xp, rules.xp.player_step);
    for (const z of Object.keys(st.skills)) { st.skills[z].level = Math.min(rules.skills.rungs, level(st.skills[z].xp, rules.xp.skill_step)); st.skills[z].progress = progress(st.skills[z].xp, rules.xp.skill_step); }
    const drops = st.live.filter((e) => DROPPING.has(e.kind));
    const last = drops.length ? drops.reduce((a, e) => (utc(e.at) > utc(a.at) ? e : a)).at : null;
    st.weather = { lastDrop: last, quietDays: last && today ? daysBetween(last, today) : null, quiet: !!(last && today && daysBetween(last, today) >= rules.weather.quiet_days) };
    return st;
  }

  // ── the siege (§6.5) ────────────────────────────────────────────────────
  /** openOrders: [{id, written, pn, options, steps, zone, tier, band}] */
  function siege(openOrders, rules, today) {
    const s = rules.siege; const wards = {};
    const refused = [];
    for (const o of openOrders || []) {
      if (!o || !isDate(o.written) || !isDate(today)) { refused.push({ id: o && o.id, reason: 'written is not YYYY-MM-DD' }); continue; }   // L6
      const age = daysBetween(o.written, today);
      const decision = (o.options || 0) > 0;
      if (age < s.attacker_min_age_days && !decision) continue;
      const zone = o.tier === 'private' ? 'keep' : (o.zone || 'keep');
      const w = (wards[zone] = wards[zone] || { zone, pressure: 0, attackers: [] });
      const engine = age >= s.engine_min_age_days || (decision && age >= s.decision_engine_min_age_days);
      const p = (age / s.age_week_days) * (s.pn_weight[o.pn] ?? s.pn_weight.none) * (decision ? s.decision_factor : 1);
      w.pressure += p;
      w.attackers.push(zone === 'keep'
        ? { id: `private-${w.attackers.length + 1}`, engine }   // a count and whether it is an engine: never an age, a lane, a Pn or an HP
        : { id: o.id, ageDays: age, decision, engine, hp: engine ? (decision ? o.options : o.steps) || 1 : null, pressure: Math.round(p * 10) / 10, band: o.band, pn: o.pn });
    }
    const out = Object.values(wards).map((w) => ({ ...w, pressure: Math.round(w.pressure * 10) / 10, figures: Math.min(s.figure_cap, Math.floor(w.pressure / s.figure_divisor)), attackers: w.attackers.sort((a, b) => (b.engine - a.engine) || (b.ageDays || 0) - (a.ageDays || 0)) })).sort((a, b) => b.pressure - a.pressure);
    out.refused = refused;
    return out;
  }

  // ── expeditions (§6.6) ──────────────────────────────────────────────────
  /** plan: {weeks:[{n, lessons:[id]}]}; ticks: Set|array of ids. */
  function expedition(plan, ticks, rules) {
    const done = new Set(ticks || []);
    const regions = (plan.weeks || []).map((w) => { const d = w.lessons.filter((id) => done.has(id)).length; return { week: w.n, total: w.lessons.length, done: d, mapped: w.lessons.length > 0 && d === w.lessons.length }; });
    const mapped = regions.filter((r) => r.mapped).length;
    const ranks = rules.expedition.ranks; let rank = ranks[0];
    for (const r of ranks) if (mapped >= r.regions) rank = r;
    const next = ranks.find((r) => r.regions > mapped) || null;
    return { regions, mapped, surveyed: regions.reduce((a, r) => a + r.done, 0), rank, next };
  }

  // ── challenges (§6.8) ───────────────────────────────────────────────────
  /** avail: {quick_order, open_decision, lessons_today, lift_day, now_order, open_order, lift_week, sprint_active, pressured_ward} booleans. */
  function pickChallenge(pool, avail, seed) {
    const can = pool.filter((c) => avail[c.needs]);
    if (!can.length) return null;
    return can[hash(seed) % can.length];
  }
  function challenges(avail, rules, date) {
    return { daily: pickChallenge(rules.challenges.daily, avail, `daily/${date}`), weekly: pickChallenge(rules.challenges.weekly, avail, `weekly/${mondayOf(date)}`) };
  }

  // ── the keeper and the works ────────────────────────────────────────────
  function tierOf(value, tiers) { let t = 0; tiers.forEach((th, i) => { if (value >= th) t = i + 1; }); return t; }
  function keeper(state, figures, rules) {
    const src = { player_level: state.player.level, closes: state.counts.close, regions: figures.regions || 0, lifts: state.counts.lift, medals: state.medals.length };
    return rules.keeper.parts.map((p) => ({ ...p, value: src[p.from] ?? 0, tier: tierOf(src[p.from] ?? 0, p.tiers) }));
  }
  function works(playerLevel, rules) { return rules.works.map((w) => ({ ...w, unlocked: playerLevel >= w.level })); }

  const api = { KINDS, EVIDENCE, hash, validateEvent, validateEvents, rarityScore, gradeOf, drop, xp, level, progress, evaluate, medalsFor, siege, expedition, challenges, keeper, works, mondayOf, daysBetween };
  if (typeof globalThis !== 'undefined') globalThis.FieldworksEngine = api;
})();
