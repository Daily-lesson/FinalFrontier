// The economy sim — the paper prototype of the design's GDD §2.4 (task T1).
//
//   node sim/economy.mjs --alys ../alys            # writes sim/REPORT.md
//   node sim/economy.mjs --alys ../alys --stdout   # prints it instead
//
// It replays the owner's real Done history, day by day for the last 60 days,
// through the engine (src/engine.js) and the castle module (src/castle.js), and
// prints per week what the evidence would have built and each horde it met. It reads the real task file
// for NUMBERS ONLY, through the board's own parser imported from the alys
// checkout at run time (never copied here): for each order it keeps the id
// (only to join the open set; never printed), the written and done dates, the
// Pn, the tier, the program, the Options and Steps counts, the difficulty and
// the board's own score. Every title, step, option and Say line is dropped at
// the parse. A private row becomes `private-<n>` with its dates and Pn only.
// The report prints per-week counts and never an id, a section or an order's
// date. Window-free, zero dependencies, deterministic: the same file, the
// same date and the same rules give the same report.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const DAY = 86400000;
const utc = (d) => { const [y, m, dd] = String(d).split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d, n) => iso(utc(d) + n * DAY);
const dow = (d) => new Date(utc(d)).getUTCDay();   // 0 Sunday … 6 Saturday
const mondayOf = (d) => addDays(d, -((dow(d) + 6) % 7));
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BACK_OFFICE_SECTION = 'Back Office';
const BACK_OFFICE_PROJECT = 'back-office';

/**
 * A stated game cadence, not a person's schedule and not a read of any learning repo:
 * ten lessons and three lifts a week on an invented spread (two lessons each weekday,
 * lifts Tue/Thu/Sat). Only the weekly totals matter to the economy.
 */
export const CADENCE = {
  source: 'a stated game cadence: ten lessons and three lifts a week, on an invented spread',
  lessonsByDay: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 },   // Mon–Fri, two each
  liftDays: [2, 4, 6],                              // Tue, Thu, Sat
};

export function loadEngine() {
  const ctx = { globalThis: null }; ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(join(ROOT, 'src', 'engine.js'), 'utf8'), ctx);
  return ctx.FieldworksEngine;
}

/** The board's parser, imported from the alys checkout — never copied into this repo. */
export async function loadParser(alys) {
  const build = join(alys, 'scripts', 'tasks', 'build.mjs');
  const audit = join(alys, 'scripts', 'wo-audit.mjs');
  if (!existsSync(build) || !existsSync(audit)) throw new Error(`no board parser under ${alys} (scripts/tasks/build.mjs, scripts/wo-audit.mjs)`);
  const b = await import(pathToFileURL(build).href);
  const a = await import(pathToFileURL(audit).href);
  return { parseTasks: b.parseTasks, buildModel: b.buildModel, score: b.score, parseDay: b.parseDay, doneDate: a.doneDate };
}

/** The task file is the one `*_Tasks.md` at the checkout's root; found by shape, so this repo never spells its name. */
export function taskFileName(alys) {
  const hits = readdirSync(alys).filter((f) => /^[A-Za-z]+_Tasks\.md$/.test(f));
  if (hits.length !== 1) throw new Error(`expected one *_Tasks.md at ${alys}, found ${hits.length}`);
  return hits[0];
}

const git = (alys, args, opts = {}) => execFileSync('git', ['-C', alys, ...args], { encoding: 'utf8', maxBuffer: 1 << 30, ...opts });

/**
 * For each id, the set of `###` sections it ever sat under in the Open part of the
 * file, across every version of the file reachable from `ref`. One `git cat-file
 * --batch` reads them all. Only the heading of the block an id sits in is looked
 * at; nothing of a block's text is kept.
 */
export function sectionHistory(alys, ref, file, ids) {
  const want = new Set(ids); const seen = new Map();
  if (!want.size) return { seen, versions: 0, shallow: null };
  const shallow = git(alys, ['rev-parse', '--is-shallow-repository']).trim() === 'true';
  const commits = git(alys, ['log', '--format=%H', ref, '--', file]).split('\n').filter(Boolean);
  const out = execFileSync('git', ['-C', alys, 'cat-file', '--batch'], { input: commits.map((c) => `${c}:${file}`).join('\n') + '\n', maxBuffer: 1 << 30 });
  let pos = 0, versions = 0;
  const HEADLINE = /^- \[[ xX]\] \d{4}-\d{2}-\d{2} — (WO-\d+) · /;
  while (pos < out.length) {
    const nl = out.indexOf(10, pos); const header = out.toString('utf8', pos, nl).split(' ');
    if (header[1] === 'missing') { pos = nl + 1; continue; }
    const size = Number(header[2]); const text = out.toString('utf8', nl + 1, nl + 1 + size); pos = nl + 1 + size + 1; versions++;
    let area = null, section = null;
    for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
      if (line.startsWith('## ')) { area = line.slice(3).trim(); section = null; continue; }
      if (line.startsWith('### ')) { section = line.slice(4).trim(); continue; }
      if (area !== 'Open' || !section) continue;
      const m = HEADLINE.exec(line); if (!m || !want.has(m[1])) continue;
      if (!seen.has(m[1])) seen.set(m[1], new Set());
      seen.get(m[1]).add(section);
    }
  }
  return { seen, versions, shallow };
}

/** Is a section public: mapped, its program public, its default project (if any) public. */
function sectionPublic(section, index) {
  if (section === BACK_OFFICE_SECTION) return null;
  const sec = index.sections?.[section]; if (!sec) return null;
  const prog = (index.programs || []).find((p) => p.id === sec.program);
  if (!prog || prog.tier !== 'public') return null;
  if (sec.project) { const pj = (index.projects || []).find((p) => p.id === sec.project); if (!pj || pj.tier !== 'public' || pj.id === BACK_OFFICE_PROJECT) return null; }
  return sec.program;
}
/** A project link's program when the project and its program are public; null when private. */
function projectPublic(ref, index) {
  if (!ref || ref === BACK_OFFICE_PROJECT) return null;
  const pj = (index.projects || []).find((p) => p.id === ref); if (!pj || pj.tier !== 'public') return null;
  if (pj.program === null) return { program: null };
  const prog = (index.programs || []).find((p) => p.id === pj.program);
  return prog && prog.tier === 'public' ? { program: pj.program } : null;
}

/**
 * Parse once, keep the numbers, drop the rest. Returns { rows, stats } where a row is
 *   { id, tier, zone, written, done|null, pn, options, steps, difficulty, weight, band }
 * and a private row's id is `private-<n>` with only its dates and Pn (the rest null).
 */
export function extract(md, today, index, P, history = null) {
  const { open, done } = P.parseTasks(md);
  const model = P.buildModel(md, P.parseDay(today), index);   // once, with today: the open rows' scores and lanes
  const scored = new Map(model.orders.map((o) => [o.id, o]));
  const byId = new Map([...open, ...done].map((w) => [w.id, w]));
  const stats = { open: open.length, done: done.length, doneNoDate: 0, privateOpen: 0, privateDone: 0, ambiguous: 0, ambiguousResolvedPublic: 0, ambiguousCountedPrivate: 0, historyVersions: history ? history.versions : 0, historyShallow: history ? history.shallow : null };
  const raw = [];
  for (const wo of open) {
    const s = scored.get(wo.id);
    const link = projectPublic(s?.projectRef, index);
    const priv = wo.project === BACK_OFFICE_SECTION || Boolean(wo.private) || (s?.projectRef ? !link : !sectionPublic(wo.project, index));
    raw.push(priv
      ? { tier: 'private', written: wo.written, done: null, pn: wo.priority }
      : { id: wo.id, tier: 'public', zone: s?.program ?? null, written: wo.written, done: null, pn: wo.priority, options: wo.options.length, steps: wo.steps.length, difficulty: wo.difficulty || null, weight: s ? s.score.total : null, band: s ? s.band : null });
  }
  for (const wo of done) {
    const d = P.doneDate(wo);
    if (!d) { stats.doneNoDate++; continue; }
    let zone; let priv;
    if (wo.private) priv = true;
    else if (wo.projectRef) { const link = projectPublic(wo.projectRef, index); priv = !link; zone = link ? link.program : null; }
    else {
      stats.ambiguous++;
      const secs = history ? history.seen.get(wo.id) : null;
      const progs = secs ? [...secs].map((s) => sectionPublic(s, index)) : [];
      priv = !secs || !progs.length || progs.some((p) => !p);
      if (priv) stats.ambiguousCountedPrivate++; else { stats.ambiguousResolvedPublic++; zone = progs[0]; }
    }
    if (priv) { raw.push({ tier: 'private', written: wo.written, done: d, pn: wo.priority }); continue; }
    let weight = null;
    try { weight = P.score(wo, P.parseDay(d), byId).total; } catch { weight = null; }   // a Done block is history and may lack a v2 field
    raw.push({ id: wo.id, tier: 'public', zone: zone ?? null, written: wo.written, done: d, pn: wo.priority, options: wo.options.length, steps: wo.steps.length, difficulty: wo.difficulty || null, weight, band: null });
  }
  // private ordinals: by dates, so the number says nothing an id would
  const priv = raw.filter((r) => r.tier === 'private').sort((a, b) => a.written.localeCompare(b.written) || String(a.done).localeCompare(String(b.done)));
  priv.forEach((r, i) => { r.id = `private-${i + 1}`; r.zone = null; r.options = 0; r.steps = 0; r.difficulty = null; r.weight = null; r.band = null; });
  stats.privateOpen = priv.filter((r) => !r.done).length; stats.privateDone = priv.filter((r) => r.done).length;
  return { rows: raw, stats };
}

/** The scheduled cadence as events (private-tier ticks, never a title). */
export function cadenceEvents(from, to) {
  const ev = []; const weeks = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const n = CADENCE.lessonsByDay[dow(d)] || 0;
    for (let k = 0; k < n; k++) {
      const id = `${d}-${k + 1}`; ev.push({ id: `lesson/${id}`, kind: 'lesson', at: d, tier: 'private', zone: null, weight: 30, facts: {}, evidence: { kind: 'tick', ref: `stated/${id}` } });
      const wk = mondayOf(d); if (!weeks.has(wk)) weeks.set(wk, []); weeks.get(wk).push(id);
    }
    if (CADENCE.liftDays.includes(dow(d))) ev.push({ id: `lift/${d}`, kind: 'lift', at: d, tier: 'private', zone: null, weight: 30, facts: {}, evidence: { kind: 'tick', ref: `stated/${d}` } });
  }
  // only whole stated weeks are regions: a window's partial first or last week maps nothing
  const perWeek = Object.values(CADENCE.lessonsByDay).reduce((a, n) => a + n, 0);
  const plan = { weeks: [...weeks.entries()].filter(([, lessons]) => lessons.length === perWeek).map(([, lessons], i) => ({ n: i + 1, lessons })) };
  return { events: ev, plan };
}

function closeEvent(r) {
  const decision = r.options > 0;
  return { id: r.id, kind: decision ? 'decision' : 'close', at: r.done, tier: r.tier, zone: r.zone, ...(r.weight != null ? { weight: r.weight } : {}),
    facts: { pn: r.pn, ...(r.difficulty ? { difficulty: r.difficulty } : {}), ...(r.tier === 'public' ? { ageDays: daysBetween(r.written, r.done), options: r.options } : {}) },
    evidence: { kind: 'commit', ref: 'tasks-file' } };
}

/** The castle module (src/castle.js), loaded the way the engine is. */
export function loadCastle() {
  const ctx = { globalThis: null }; ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(join(ROOT, 'src', 'castle.js'), 'utf8'), ctx);
  return ctx.FieldworksCastle;
}

/**
 * The day-by-day replay. Pure over (rows, rules, today). Per day: the evidence that landed, the pieces it
 * added to the castle (src/castle.js, a fold over the engine's own log), the siege's count, the horde's
 * clock, and for each horde the forecast at its warning and the fight at its arrival, with nobody at the wall.
 */
export function simulate(rows, rules, today, E, days = 60, opts = {}) {
  const C = opts.castle || loadCastle(); const from = addDays(today, -(days - 1));
  const closes = rows.filter((r) => r.done && r.done >= from && r.done <= today).map(closeEvent);
  const { events: cadence0, plan: plan0 } = cadenceEvents(from, today);
  const cadence = opts.closesOnly ? [] : cadence0, plan = opts.closesOnly ? { weeks: [] } : plan0;
  const all = [...closes, ...cadence].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const byId = new Map(all.map((e) => [e.id, e]));
  // One fold over the whole window: an event's XP, drop and medals depend only on the events before it,
  // so the running totals on day D are the sums of the log up to D (the engine's own order: date, then id).
  const logs = E.evaluate(all, rules, today, { plan }).log.filter((l) => l.kind);
  const count = Object.fromEntries(rules.castle.parts.map((p) => [p, 0])); let pieces = 0;
  let xpSum = 0, cut = 0; const weekEnd = plan.weeks.map((w) => w.lessons.map((id) => id.slice(0, 10)).sort().at(-1));
  const lead = Math.round(rules.horde.warning_hours / 24);
  let clock = C.hordeClock(); let pending = null; const hordes = []; const out = [];
  for (let i = 0; i < days; i++) {
    const D = addDays(from, i); const day = i + 1; const todays = []; let added = 0; const part = Object.fromEntries(rules.castle.parts.map((p) => [p, 0]));
    while (cut < logs.length && byId.get(logs[cut].id).at <= D) { const l = logs[cut++]; xpSum += l.xp; todays.push(l); const p = C.pieceFor(l, rules); if (p) { count[p.part] += p.size; part[p.part] += p.size; pieces++; added++; } }
    const castle = C.castleFrom(count, pieces, rules);
    const openOnD = rows.filter((r) => r.written <= D && (!r.done || r.done > D)).map((r) => ({ id: r.id, written: r.written, pn: r.pn, options: r.options || 0, steps: r.steps || 0, zone: r.zone, tier: r.tier, band: r.band }));
    const wards = E.siege(openOnD, rules, D);
    const attackers = wards.reduce((a, w) => a + w.attackers.length, 0);
    const engines = wards.reduce((a, w) => a + w.attackers.filter((x) => x.engine).length, 0);
    const r = C.hordeDay(clock, attackers, D, rules, engines); clock = r.clock;
    if (r.warned) {
      const h = clock.horde; const rd = C.readiness(castle, h, rules, 0);   // the horde is sized here, once, and it is the one that arrives
      pending = { warnedDay: day, dueDay: day + lead, n: h.n, bosses: h.bosses, ordinal: h.ordinal, forecast: rd.forecast.outcome, tasks: rd.tasks, piecesAtWarning: pieces, attackers };
    }
    if (r.arrived) {
      const h = r.horde; const landed = pending ? pieces - pending.piecesAtWarning : 0; const res = C.resolveHorde(castle, h, rules, landed);
      hordes.push({ warnedDay: pending ? pending.warnedDay : null, forecast: pending ? pending.forecast : null, tasks: pending ? pending.tasks : null, arrivedDay: day, n: h.n, bosses: h.bosses, ordinal: h.ordinal, attackers: pending ? pending.attackers : attackers, landed, band: landed === 0 ? 'none' : landed < 10 ? 'under 10' : '10 or more', rally: res.rally, outcome: res.outcome, wallLeft: res.wallLeft, downed: res.downed, seconds: res.seconds, best: res.best ? res.best.id : null });
      pending = null;
    }
    out.push({ date: D, day, closes: todays.filter((l) => l.kind === 'close').length,   // private closes are in this count and never shown apart
      decisions: todays.filter((l) => l.kind === 'decision').length, lessons: todays.filter((l) => l.kind === 'lesson').length, lifts: todays.filter((l) => l.kind === 'lift').length,
      pieces: added, towerPoints: part.tower, total: pieces, wallHp: castle.wallHp, dps: castle.dps, count: { ...count }, xp: xpSum, level: E.level(xpSum, rules.xp.player_step),
      attackers, engines, gather: Math.round(100 * clock.gather / rules.horde.threshold), warned: r.warned, arrived: r.arrived, regions: weekEnd.filter((d) => d <= D).length });
  }
  return { from, to: today, days: out, hordes, pending };
}

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

export function weeks(sim) {
  const by = new Map();
  for (const d of sim.days) { const k = mondayOf(d.date); if (!by.has(k)) by.set(k, []); by.get(k).push(d); }
  return [...by.entries()].map(([monday, ds]) => {
    const sum = (f) => ds.reduce((a, d) => a + d[f], 0); const last = ds[ds.length - 1];
    return { monday, days: ds.length, closes: sum('closes'), decisions: sum('decisions'), lessons: sum('lessons'), lifts: sum('lifts'), pieces: sum('pieces'), towerPoints: sum('towerPoints'), wallHp: last.wallHp, dps: last.dps, level: last.level, attackers: last.attackers, gather: last.gather, hordes: ds.filter((d) => d.arrived).length, warnings: ds.filter((d) => d.warned).length };
  });
}

/** The five targets of the GDD v2 §2.4 (the rework), computed, never asserted. */
export function targets(sim, rules) {
  const ds = sim.days; const wk = weeks(sim).filter((w) => w.days === 7); const H = rules.horde; const hs = sim.hordes;
  // 1. a median day adds a piece to the castle
  const med = median(ds.map((d) => d.pieces));
  const t1 = { key: 'piece', name: 'A median day adds at least one piece to the castle', value: med, met: med >= 1 };
  // 2. a good week raises a tower; nothing is ever taken (the castle's counts never fall)
  const good = wk.filter((w) => w.closes + w.decisions >= 10);
  const least = good.length ? Math.min(...good.map((w) => w.towerPoints)) : null;
  let fell = 0; for (let i = 1; i < ds.length; i++) for (const p of rules.castle.parts) if (ds[i].count[p] < ds[i - 1].count[p]) fell++;
  const capDay = (f) => (ds.find(f) || {}).day ?? null;
  const t2 = { key: 'growth', name: 'A good week (ten or more closes and decisions) raises at least one tower level, and no day takes a piece', value: least, good: good.length, fell, met: good.length > 0 && least >= 1 && fell === 0,
    caps: { wall: capDay((d) => d.count.wall >= rules.castle.draw.sections_max), tower: capDay((d) => Math.floor(d.count.tower / rules.castle.tower.slots) >= rules.castle.draw.tower_levels_max), keep: capDay((d) => d.count.keep >= rules.castle.draw.keep_levels_max) } };
  // 3. hordes are large, infrequent and announced: about one a fortnight, each warned warning_hours ahead, none inside the gap
  const per30 = Math.round(hs.length / ds.length * 30 * 10) / 10; const lead = Math.round(H.warning_hours / 24);
  const gaps = hs.slice(1).map((h, i) => h.arrivedDay - hs[i].arrivedDay);
  const warnedAll = hs.every((h) => h.warnedDay != null && h.arrivedDay - h.warnedDay === lead);
  const t3 = { key: 'cadence', name: `Hordes are infrequent and announced: one to three in thirty days, each warned ${H.warning_hours} hours ahead, never two inside ${H.min_gap_days} days`, value: per30, count: hs.length, gaps, lead, warnedAll, sizes: hs.map((h) => h.n),
    met: per30 >= 1 && per30 <= 3 && warnedAll && gaps.every((g) => g >= H.min_gap_days) };
  // 4. a horde is a fair fight: every one can be held from its warning, and they are not all a formality
  const winnable = hs.filter((h) => h.tasks != null).length; const asked = hs.filter((h) => h.tasks == null || h.tasks > 0).length; const held = hs.filter((h) => h.outcome === 'held').length;
  const t4 = { key: 'ready', name: `Every horde can be held from its warning (at most ${H.warning.max_tasks} finished tasks), and at least one asks for something`, value: { hordes: hs.length, winnable, asked, held }, met: hs.length > 0 && winnable === hs.length && asked >= 1 };
  // 5. level 5 within the first month, level 10 within the quarter (projected from the window's rate): unchanged from GDD v1
  const l30 = ds[Math.min(29, ds.length - 1)].level; const rate = ds[ds.length - 1].xp / ds.length; const E2 = (xp) => { const s = rules.xp.player_step; return Math.floor((Math.sqrt(8 * xp / s + 1) - 1) / 2); };
  const l90 = E2(rate * 90); const l5day = (ds.find((d) => d.level >= 5) || {}).day ?? null; const l10day = (ds.find((d) => d.level >= 10) || {}).day ?? null;
  const t5 = { key: 'level', name: 'Level 5 within the first month (and not before day 14) and level 10 within the quarter', value: { l30, l90, l5day, l10day }, met: l30 >= 5 && l90 >= 10 && (l5day == null || l5day >= 14) };
  return [t1, t2, t3, t4, t5];
}

/** Apply a tuning list ([{key:'horde.threshold', before, after}]) to a rules copy, up to index n (exclusive). */
export function applyTuning(rules, tuning, n) {
  const r = JSON.parse(JSON.stringify(rules));
  tuning.forEach((t, i) => { const v = i < n ? t.after : t.before; const ks = t.key.split('.'); let o = r; for (const k of ks.slice(0, -1)) o = o[k]; if (v === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = v; });
  return r;
}

const fmtTarget = (t) => {
  if (t.key === 'piece') return `${t.value} pieces on the median day`;
  if (t.key === 'growth') return t.good ? `${t.good} good weeks; the leanest raised ${t.value} tower levels · ${t.fell} days took a piece · the drawing fills: the curtain wall on day ${t.caps.wall ?? '—'}, the towers on day ${t.caps.tower ?? '—'}, the keep on day ${t.caps.keep ?? '—'}` : 'no week reached ten closes';
  if (t.key === 'cadence') return `${t.count} hordes in the window, ${t.value} per thirty days · days between arrivals: ${t.gaps.length ? t.gaps.join(', ') : '—'} · every warning ${t.lead} days ahead: ${t.warnedAll ? 'yes' : 'no'} · sizes: ${t.sizes.join(', ') || '—'} machines`;
  if (t.key === 'ready') return `${t.value.winnable} of ${t.value.hordes} could be held from the warning · ${t.value.asked} asked for a finished task or more · ${t.value.held} held at arrival`;
  return `level ${t.value.l30} at day 30 · ${t.value.l90} projected at day 90 · level 5 on day ${t.value.l5day ?? '—'} · level 10 on day ${t.value.l10day ?? '—'}`;
};

/** The places in the prototype where evidence enters, where the castle is derived and where play score changes, read from its source at report time. */
export function sourceAudit() {
  const src = readFileSync(join(ROOT, 'prototype', 'prototype.src.html'), 'utf8').split('\n');
  const hits = [];
  src.forEach((l, i) => { if (/S\.events\.push\(|C\.castleOf\(|\.score \+=|S\.play\.wall \+=|player\.xp\s*\+=/.test(l)) hits.push({ line: i + 1, text: l.trim().slice(0, 118) }); });
  return hits;
}

const HORDE_HEAD = ['| Warned on day | Arrived on day | Machines | Engines | Forecast at the warning | Tasks to hold | Pieces landed in the window | Outcome | Wall left |', '|---|---|---|---|---|---|---|---|---|'];
const hordeRow = (h, cap) => `| ${h.warnedDay ?? '—'} | ${h.arrivedDay} | ${h.n} | ${h.bosses} | ${h.forecast ?? '—'} | ${h.tasks == null ? `more than ${cap}` : h.tasks} | ${h.band} | ${h.outcome} | ${h.wallLeft}% |`;
const hordeTable = (sim, cap) => [...HORDE_HEAD, ...(sim.hordes.length ? sim.hordes.map((h) => hordeRow(h, cap)) : ['| — | — | — | — | — | — | — | no horde in the window | — |'])];

export function renderReport({ sim, rules, stats, sha, ref, tuning, tuningRuns, alysRef, closesOnly }) {
  const W = weeks(sim); const T = targets(sim, rules); const H = rules.horde; const cap = H.warning.max_tasks;
  const L = [];
  L.push('# Economy sim — report', '');
  L.push(`*Generated by \`node sim/economy.mjs\` on ${sim.to}. Do not edit by hand.*`, '');
  L.push(`- **Input:** the task file at alys \`${alysRef}\` (${ref}), commit \`${sha}\`, read through the board's own parser from that checkout; per-week counts only.`);
  L.push(`- **Window:** ${sim.days.length} days, ${sim.from} to ${sim.to}; the game is taken to start on the first day.`);
  L.push(`- **Kept per order:** dates, Pn, tier, program, the Options and Steps counts, difficulty, the board's score. Every title, step, option and Say line was dropped at the parse; a private row kept its dates and Pn only, so a private decision is modelled as a close.`);
  L.push(`- **Rows:** ${stats.open} open and ${stats.done} done (no Done row has left the file; its first ticks fall in the window's third week, so the first weeks show no close); ${stats.privateOpen + stats.privateDone} rows are private, counted in the totals and never shown apart or named; ${stats.doneNoDate} done rows had no readable date and were skipped.`);
  L.push(`- **Ambiguous rows:** ${stats.ambiguous} done rows carry neither a \`Project:\` line nor a private mark (ticked before stamping began). ${stats.ambiguousResolvedPublic} were resolved public from the sections they sat in across ${stats.historyVersions} versions of the file${stats.historyShallow ? ' (a shallow history: some may be missing)' : ''}; ${stats.ambiguousCountedPrivate} never showed in a public section, or sat in a private one, and are counted private.`);
  L.push(`- **Stated cadence:** ${CADENCE.source}. It is a schedule the sim assumes, not a read of anyone's learning record, and it assumes every lesson and lift lands; a region is a stated week of ten lessons.`);
  L.push(`- **The castle:** a fold over the evidence (\`src/castle.js\`): a piece per event, by its kind first, else by its drop's grade. *Wall* is the wall's health and *fire* the towers' and the keep's damage a second. Nothing is bought or placed, so there is no ground model and no map to fill.`);
  L.push(`- **The horde:** it gathers ${H.gather_per_attacker} a day for each order at the walls (the engine's siege count, at most ${H.gather_cap_per_day} a day), is announced when ${H.threshold} has gathered, arrives ${H.warning_hours} hours later, and never comes inside ${H.min_gap_days} days of the last. Each fight below is the castle on its own: the same stepping function the prototype runs, with nobody at the wall.`, '');
  L.push('## The five targets (GDD v2 §2.4)', '', '| # | Target | With the stated cadence | Number | On real closes alone | Number |', '|---|---|---|---|---|---|');
  T.forEach((t, i) => { const c = closesOnly ? closesOnly.targets[i] : null; L.push(`| ${i + 1} | ${t.name} | **${t.met ? 'met' : 'not met'}** | ${fmtTarget(t)} | ${c ? `**${c.met ? 'met' : 'not met'}**` : '—'} | ${c ? fmtTarget(c) : '—'} |`); });
  L.push('', '**The closes-only column** drops every stated lesson and lift, so it is what the real file alone would build. Where the two columns differ, the difference is the cadence.', '');
  L.push('## The hordes', '', 'Days are counted from the window\'s first day. *Forecast* is the fight as it stood at the warning. *Tasks to hold* is how many finished tasks (each assumed to add the next piece of the rules\' warning list) would see the castle hold; it is the number the warning shows. The horde is sized once, at its warning, and that one arrives. *Landed* is how many pieces the evidence added between the warning and the arrival, as a band (none, under 10, 10 or more), never a count: each piece lifts the castle for that fight (the rally). *Outcome* is the fight at arrival with nobody at the wall. With the stated cadence the rally is at or near its cap in every window, because the stated lessons and lifts alone land five or six pieces in any three days: read the closes-only table for what the real file does.', '');
  L.push('**With the stated cadence**', '', ...hordeTable(sim, cap));
  if (sim.pending) L.push('', `A horde was announced on day ${sim.pending.warnedDay} and is due on day ${sim.pending.dueDay}, after the window: ${sim.pending.n} machines, ${sim.pending.bosses} engines; the forecast is ${sim.pending.forecast}, and ${sim.pending.tasks == null ? `more than ${cap}` : sim.pending.tasks} finished tasks would see it hold.`);
  if (closesOnly) { L.push('', '**On real closes alone**', '', ...hordeTable(closesOnly.sim, cap)); if (closesOnly.sim.pending) L.push('', `A horde was announced on day ${closesOnly.sim.pending.warnedDay} and is due after the window.`); }
  L.push('', '## Per week', '', 'Weeks run Monday to Sunday; the first and last may be partial (the days column). Pieces are what the week\'s evidence added; wall, fire, level, at the walls and gathered are as of the week\'s last day.', '');
  L.push('| Week of | Days | Closes | Decisions | Lessons | Lifts | Pieces | Tower levels | Wall | Fire | Level | At the walls | Gathered | Warnings | Hordes |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const w of W) L.push(`| ${w.monday} | ${w.days} | ${w.closes} | ${w.decisions} | ${w.lessons} | ${w.lifts} | ${w.pieces} | ${w.towerPoints} | ${w.wallHp} | ${w.dps} | ${w.level} | ${w.attackers} | ${w.gather}% | ${w.warnings} | ${w.hordes} |`);
  L.push('', '## The arc, in plain words', '', arc(sim, T, rules), '');
  L.push('## Tuning', '', 'Every change is a rules-file edit (`rules/fieldworks.json`), never the engine or the castle module. Each row was applied in order and the whole sim re-run; the columns are the five targets after that row (✓ met, ✗ not).', '');
  L.push('| Step | Key | Before → after | Why | T1 | T2 | T3 | T4 | T5 |', '|---|---|---|---|---|---|---|---|---|');
  tuningRuns.forEach((run, i) => {
    const t = i === 0 ? null : tuning[i - 1];
    L.push(`| ${i} | ${t ? `\`${t.key}\`` : 'the first cut of the rework'} | ${t ? `${JSON.stringify(t.before)} → ${JSON.stringify(t.after)}` : '—'} | ${t ? t.why : 'the baseline'} | ${run.map((x) => (x.met ? '✓' : '✗')).join(' | ')} |`);
  });
  L.push('', '**Not touched:** the engine; rarity, XP bases and multipliers, the player step (200, from the first sim), medals, the skill step and the siege\'s ages and weights (the design\'s definition of an order at the walls, not a balance knob).', '');
  L.push('## Where evidence enters, where the castle comes from, where score changes', '', 'Read from `prototype/prototype.src.html` when this report was generated. Evidence enters the event list on a finished task, a survey or a logged lift (and when a save or the DEMO history is replayed); the castle is derived from the fold\'s log in one place; score changes only inside a stage or at the wall, and no line carries it into the event list.', '');
  for (const h of sourceAudit()) L.push(`- line ${h.line}: \`${h.text.replace(/`/g, "'")}\``);
  L.push('');
  return L.join('\n');
}

function arc(sim, T, rules) {
  const ds = sim.days; const at = (n) => ds[Math.min(n, ds.length) - 1];
  const w1 = at(7), m1 = at(30), end = ds[ds.length - 1]; const t5 = T[4].value; const hs = sim.hordes;
  const towers = (d) => { const s = rules.castle.tower.slots; return d.count.tower ? `${Math.min(s, d.count.tower)} towers, the tallest at level ${Math.ceil(d.count.tower / s)}` : 'no tower yet'; };
  const first = hs[0];
  return [
    `**The first week.** By the seventh day the evidence has added ${w1.total} pieces: ${w1.count.wall} wall sections, ${towers(w1)}, a keep at level ${w1.count.keep}. The Keeper is level ${w1.level}; ${w1.attackers} orders stand at the walls and the horde's clock reads ${w1.gather}%.`,
    `**The first month.** At day 30 the castle is ${m1.total} pieces (wall ${m1.wallHp}, fire ${m1.dps}), the Keeper level ${m1.level} (level 5 came on day ${t5.l5day ?? '—'}), and ${hs.filter((h) => h.arrivedDay <= 30).length} hordes have come${first ? `, the first on day ${first.arrivedDay} with ${first.n} machines (${first.outcome})` : ''}.`,
    `**The quarter.** At the window's pace the Keeper would reach level ${t5.l90} by day 90 (projected; the file holds ${ds.length} days). On the last day the castle is ${end.total} pieces (wall ${end.wallHp}, fire ${end.dps}) with ${end.attackers} orders at the walls; ${hs.length} hordes came in the window and the castle held ${hs.filter((h) => h.outcome === 'held').length} of them on its own.`,
  ].join(' ');
}

async function main(argv) {
  const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const alys = arg('--alys'); if (!alys) { console.error('economy.mjs: --alys <path to the alys checkout> is required (the parser and the task file are read from there, never copied here)'); process.exit(2); }
  const A = resolve(alys); const ref = arg('--ref', 'origin/main'); const today = arg('--today', new Date().toISOString().slice(0, 10));
  const P = await loadParser(A); const E = loadEngine(); const C = loadCastle();
  const file = taskFileName(A);
  if (!argv.includes('--no-fetch')) { try { git(A, ['fetch', '-q', 'origin', ref.replace(/^origin\//, '')]); } catch { /* offline: the ref as it stands */ } }
  const sha = git(A, ['rev-parse', ref]).trim();
  const md = git(A, ['show', `${ref}:${file}`]);
  const index = JSON.parse(git(A, ['show', `${ref}:projects.json`]));
  const { done } = P.parseTasks(md);
  const ambiguous = done.filter((w) => !w.private && !w.projectRef).map((w) => w.id);
  const history = sectionHistory(A, ref, file, ambiguous);
  const { rows, stats } = extract(md, today, index, P, history);
  if (history.shallow && !argv.includes('--allow-shallow')) { console.error('economy.mjs: the alys checkout is shallow, so a Done row\'s section history is cut short and public rows would be counted private. Run `git -C <alys> fetch --unshallow origin main` first, or pass --allow-shallow to take the short history as it is.'); process.exit(3); }
  const rules = JSON.parse(readFileSync(join(ROOT, 'rules', 'fieldworks.json'), 'utf8'));
  const tuning = JSON.parse(readFileSync(join(here, 'tuning.json'), 'utf8')).changes;
  const tuningRuns = [];
  for (let n = 0; n <= tuning.length; n++) tuningRuns.push(targets(simulate(rows, applyTuning(rules, tuning, n), today, E, 60, { castle: C }), applyTuning(rules, tuning, n)));
  const sim = simulate(rows, rules, today, E, 60, { castle: C });
  const simCloses = simulate(rows, rules, today, E, 60, { closesOnly: true, castle: C });
  const closesOnly = { sim: simCloses, targets: targets(simCloses, rules) };
  const report = renderReport({ sim, rules, stats, sha, ref, tuning, tuningRuns, alysRef: ref.replace(/^origin\//, ''), closesOnly });
  guardReport(report, md, index);
  if (argv.includes('--stdout')) process.stdout.write(report); else { writeFileSync(join(here, 'REPORT.md'), report); console.log(`sim/REPORT.md written — ${sim.days.length} days, ${stats.done} done rows, targets ${targets(sim, rules).map((t) => (t.met ? 'met' : 'not met')).join(' / ')}`); }
}

/** The report's own wall: no order id, no section heading of the file, ever. */
export function guardReport(report, md, index) {
  if (/WO-\d/.test(report)) throw new Error('the report would carry an order id');
  const sections = new Set([...String(md).matchAll(/^### (.+)$/gm)].map((m) => m[1].trim()));
  for (const s of Object.keys(index.sections || {})) sections.add(s);
  for (const s of sections) if (s.length > 3 && report.includes(s)) throw new Error('the report would name a section of the task file');
}

const isMain = (() => { try { return fileURLToPath(import.meta.url) === resolve(process.argv[1]); } catch { return false; } })();
if (isMain) main(process.argv.slice(2)).catch((e) => { console.error(`economy.mjs: ${e.message}`); process.exit(1); });
