// The economy sim — the paper prototype of the design's GDD §2.4 (task T1).
//
//   node sim/economy.mjs --alys ../alys            # writes sim/REPORT.md
//   node sim/economy.mjs --alys ../alys --stdout   # prints it instead
//
// It replays the owner's real Done history, day by day for the last 60 days,
// through the engine (src/engine.js) and the fortress rules, and prints per
// week what the game would have paid and drawn. It reads the real task file
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

/** Where cells and scrap come from: the prototype's one rule, by kind first, else by the drop's grade. */
export function cacheFor(ev, item, rules) {
  const F = rules.fortress;
  return F.cache_by_kind[ev.kind] || (item ? F.cache_by_grade[item.grade] : null) || { scrap: 0, cells: 0 };
}

/** The day-by-day replay. Pure over (rows, rules, today). */
export function simulate(rows, rules, today, E, days = 60, opts = {}) {
  const F = rules.fortress; const from = addDays(today, -(days - 1));
  const closes = rows.filter((r) => r.done && r.done >= from && r.done <= today).map(closeEvent);
  const { events: cadence0, plan: plan0 } = cadenceEvents(from, today);
  const cadence = opts.closesOnly ? [] : cadence0, plan = opts.closesOnly ? { weeks: [] } : plan0;
  const all = [...closes, ...cadence].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const pylonCost = F.costs.pylon.cells; const tiles = F.cols * F.rows;
  const reachTiles = (r) => Math.PI * r * r;
  const newPerPylon = reachTiles(F.pylon_reach) * 0.5;   // EV: a pylon touching ground adds about half its disc
  let ground = Math.min(tiles, reachTiles(F.core_reach)); let carry = 0; let spreadAcc = 0; let cut = 0;
  const byId = new Map(all.map((e) => [e.id, e]));
  // One fold over the whole window: an event's XP, drop and medals depend only on the events before it,
  // so the running totals on day D are the sums of the log up to D (the engine's own order: date, then id).
  const logs = E.evaluate(all, rules, today, { plan }).log.filter((l) => l.kind);
  let xpSum = 0, medals = 0, regions = 0; const weekEnd = plan.weeks.map((w) => w.lessons.map((id) => id.slice(0, 10)).sort().at(-1));
  const out = [];
  for (let i = 0; i < days; i++) {
    const D = addDays(from, i); const day = i + 1;
    let cells = 0, scrap = 0; const todays = [];
    while (cut < logs.length && byId.get(logs[cut].id).at <= D) { const l = logs[cut++]; xpSum += l.xp; medals += l.medals.length; todays.push(l); const c = cacheFor(byId.get(l.id), l.item, rules); cells += c.cells; scrap += c.scrap; }
    regions = weekEnd.filter((d) => d <= D).length;
    const st = { player: { xp: xpSum, level: E.level(xpSum, rules.xp.player_step) }, medals: { length: medals }, regions };
    const openOnD = rows.filter((r) => r.written <= D && (!r.done || r.done > D)).map((r) => ({ id: r.id, written: r.written, pn: r.pn, options: r.options || 0, steps: r.steps || 0, zone: r.zone, tier: r.tier, band: r.band }));
    const wards = E.siege(openOnD, rules, D);
    const attackers = wards.reduce((a, w) => a + w.attackers.length, 0);
    const engines = wards.reduce((a, w) => a + w.attackers.filter((x) => x.engine).length, 0);
    const blightSiege = clamp(Math.round(attackers * F.blight.tiles_per_attacker), F.blight.min_tiles, F.blight.max_tiles);
    const w = F.waves; const wave = Math.min(w.max ?? Infinity, Math.round(w.base + w.per_attacker * attackers + w.per_day * Math.min(day, w.per_day_cap_days ?? Infinity)));
    const pylons = Math.floor((carry + cells) / pylonCost); carry = (carry + cells) - pylons * pylonCost;
    // An upper bound: every pylon is taken to stand. In the prototype a machine can still destroy a pylon at night,
    // which turns its ground wild again (v2's rule, a design question, D33's neighbour); the sim does not model it.
    // Ground grows up to the tiles the siege's blight leaves free;
    // the blight drawn is the siege's size where free tiles allow it.
    ground = Math.max(ground, Math.min(tiles - blightSiege, ground + pylons * newPerPylon));
    const blightTarget = Math.min(blightSiege, tiles - Math.round(ground));
    const p = Math.min(F.blight.spread_cap, F.blight.spread_base + F.blight.spread_per_day * day);
    const wild = Math.max(0, tiles - ground - blightTarget - spreadAcc);
    const side = Math.sqrt(Math.max(0, tiles - blightTarget - spreadAcc)); const frontier = Math.min(wild, Math.max(0, 4 * side - 4));
    spreadAcc += p * frontier;   // the night takes wild ground only, never a built tile
    out.push({ date: D, day, closes: todays.filter((l) => l.kind === 'close').length,   // private closes are in this count and never shown apart
      decisions: todays.filter((l) => l.kind === 'decision').length,
      lessons: todays.filter((l) => l.kind === 'lesson').length, lifts: todays.filter((l) => l.kind === 'lift').length,
      cells, scrap, xp: st.player.xp, level: st.player.level, pylons, turretsHabitats: Math.floor(cells / (F.costs.turret.cells + F.costs.habitat.cells)),
      attackers, engines, blight: blightTarget, blightSiege, wave, ground: Math.round(ground), wildLost: Math.round(spreadAcc), medals: st.medals.length, regions: st.regions });
  }
  return { from, to: today, days: out };
}

const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };

export function weeks(sim) {
  const by = new Map();
  for (const d of sim.days) { const k = mondayOf(d.date); if (!by.has(k)) by.set(k, []); by.get(k).push(d); }
  return [...by.entries()].map(([monday, ds]) => {
    const sum = (f) => ds.reduce((a, d) => a + d[f], 0); const last = ds[ds.length - 1];
    return { monday, days: ds.length, closes: sum('closes'), decisions: sum('decisions'), lessons: sum('lessons'), lifts: sum('lifts'), cells: sum('cells'), scrap: sum('scrap'), level: last.level, pylons: sum('pylons'), blight: last.blight, wave: last.wave, ground: last.ground, groundStart: ds[0].ground - ds[0].pylons * 0 };
  });
}

/** The four targets of GDD §2.4, computed, never asserted. */
export function targets(sim, rules) {
  const F = rules.fortress; const ds = sim.days; const wk = weeks(sim).filter((w) => w.days === 7);
  const pylonCost = F.costs.pylon.cells; const pairCost = F.costs.turret.cells + F.costs.habitat.cells;
  // 1. a median day funds a pylon, or a turret and a habitat
  const medCells = median(ds.map((d) => d.cells));
  const t1 = { name: 'A median day funds one pylon, or one turret and a habitat', value: medCells, need: Math.min(pylonCost, pairCost), met: medCells >= Math.min(pylonCost, pairCost), unit: 'cells on the median day' };
  // 2. a good week grows the ground by a ring; a quiet week takes no built tile (rule)
  const tiles = F.cols * F.rows; const ringAt = (g) => { const r = Math.sqrt(g / Math.PI); return Math.round(Math.PI * ((r + 1) ** 2 - r * r)); };
  const good = wk.filter((w) => w.closes + w.decisions >= 10);
  const growth = good.map((w, i) => { const ds7 = ds.filter((d) => mondayOf(d.date) === w.monday); const before = ds7[0].ground - Math.round(ds7[0].pylons * Math.PI * F.pylon_reach ** 2 * 0.5); return { grew: w.ground - before, ring: ringAt(Math.max(1, before)), capped: w.ground >= tiles - w.blight }; });
  const ringMet = growth.length > 0 && growth.every((g) => g.grew >= g.ring || g.capped);
  const capped = growth.some((g) => g.capped && g.grew < g.ring);
  const fillDay = (ds.find((d) => d.blight < d.blightSiege || d.ground >= F.cols * F.rows - d.blightSiege) || {}).day ?? null;
  const t2 = { capped, fillDay, name: 'A good week grows the ground by a ring; a quiet week takes no built tile', value: growth.length ? Math.min(...growth.map((g) => g.grew - g.ring)) : null, good: good.length, met: ringMet, unit: 'tiles over a ring in the leanest good week', quiet: wk.filter((w) => w.closes + w.decisions === 0).length };
  // 3. the siege is legible: the clamp does not bind on most days, so a close moves the blight
  // illegible on a day the blight cannot follow the backlog: held at the clamp, or squeezed by a full map
  const bound = ds.filter((d) => d.blightSiege >= F.blight.max_tiles || Math.round(d.attackers * F.blight.tiles_per_attacker) < F.blight.min_tiles || d.blight < d.blightSiege).length;
  const t3 = { name: 'The siege is legible: the blight follows the backlog (held at either clamp or squeezed by a full map on under a quarter of the days)', value: bound, of: ds.length, met: bound < ds.length / 4, unit: 'days the clamp binds', attackersToday: ds[ds.length - 1].attackers, attackersRange: [Math.min(...ds.map((d) => d.attackers)), Math.max(...ds.map((d) => d.attackers))], waveMax: Math.max(...ds.map((d) => d.wave)) };
  // 4. level 5 within the first month, level 10 within the quarter (projected from the 60-day rate)
  const l30 = ds[Math.min(29, ds.length - 1)].level; const rate = ds[ds.length - 1].xp / ds.length; const E2 = (xp) => { const s = rules.xp.player_step; return Math.floor((Math.sqrt(8 * xp / s + 1) - 1) / 2); };
  const l90 = E2(rate * 90); const l5day = (ds.find((d) => d.level >= 5) || {}).day ?? null; const l10day = (ds.find((d) => d.level >= 10) || {}).day ?? null;
  const t4 = { name: 'Level 5 within the first month and level 10 within the quarter, so the module card is a monthly-ish event', value: { l30, l90, l5day, l10day }, met: l30 >= 5 && l90 >= 10 && (l5day == null || l5day >= 14), unit: 'level at day 30 · projected at day 90' };
  return [t1, t2, t3, t4];
}

/** Apply a tuning list ([{key:'fortress.waves.max', before, after}]) to a rules copy, up to index n (exclusive). */
export function applyTuning(rules, tuning, n, side = 'after') {
  const r = JSON.parse(JSON.stringify(rules));
  tuning.forEach((t, i) => { const v = i < n ? t.after : t.before; const ks = t.key.split('.'); let o = r; for (const k of ks.slice(0, -1)) o = o[k]; if (v === null) delete o[ks.at(-1)]; else o[ks.at(-1)] = v; });
  void side; return r;
}

const fmtTarget = (t) => {
  if (t.unit === 'level at day 30 · projected at day 90') return `level ${t.value.l30} at day 30 · ${t.value.l90} projected at day 90 · level 5 on day ${t.value.l5day ?? '—'} · level 10 on day ${t.value.l10day ?? '—'}`;
  if (t.unit === 'days the clamp binds') return `${t.value} of ${t.of} days held at a clamp or squeezed · attackers ${t.attackersRange[0]}–${t.attackersRange[1]} (${t.attackersToday} today) · largest wave ${t.waveMax}`;
  if (t.unit === 'tiles over a ring in the leanest good week') return t.good ? `${t.good} good weeks (ten or more closes and decisions); the leanest grew ${t.value >= 0 ? t.value + ' tiles more than' : -t.value + ' tiles short of'} a ring${t.capped ? ' because the free ground ran out' : ''} · the map's free ground is used up ${t.fillDay ? `on day ${t.fillDay}` : 'on no day of the window'} · ${t.quiet} weeks with no close (the spread takes wild tiles only, by rule)` : 'no week reached ten closes';
  return `${t.value} ${t.unit} (needs ${t.need})`;
};

/** The places in the prototype where cells, scrap or XP change, read from its source at report time. */
export function sourceAudit() {
  const src = readFileSync(join(ROOT, 'prototype', 'prototype.src.html'), 'utf8').split('\n');
  const hits = [];
  src.forEach((l, i) => { if (/G\.cells\s*[+\-]=|G\.cells\s*=[^=]|cells:\s*\d|cells: m\.cells|player\.xp\s*\+=/.test(l)) hits.push({ line: i + 1, text: l.trim().slice(0, 110) }); });
  return hits;
}

export function renderReport({ sim, rules, stats, sha, ref, tuning, tuningRuns, alysRef, closesOnly }) {
  const W = weeks(sim); const T = targets(sim, rules);
  const L = [];
  L.push('# Economy sim — report', '');
  L.push(`*Generated by \`node sim/economy.mjs\` on ${sim.to}. Do not edit by hand.*`, '');
  L.push(`- **Input:** the task file at alys \`${alysRef}\` (${ref}), commit \`${sha}\`, read through the board's own parser from that checkout; per-week counts only.`);
  L.push(`- **Window:** ${sim.days.length} days, ${sim.from} to ${sim.to}; the game is taken to start on the first day.`);
  L.push(`- **Kept per order:** dates, Pn, tier, program, the Options and Steps counts, difficulty, the board's score. Every title, step, option and Say line was dropped at the parse; a private row kept its dates and Pn only, so a private decision is modelled as a close.`);
  L.push(`- **Rows:** ${stats.open} open and ${stats.done} done (no Done row has left the file; its first ticks fall in the window's third week, so the first weeks show no close); ${stats.privateOpen + stats.privateDone} rows are private, counted in the totals and never shown apart or named; ${stats.doneNoDate} done rows had no readable date and were skipped.`);
  L.push(`- **Ambiguous rows:** ${stats.ambiguous} done rows carry neither a \`Project:\` line nor a private mark (ticked before stamping began). ${stats.ambiguousResolvedPublic} were resolved public from the sections they sat in across ${stats.historyVersions} versions of the file${stats.historyShallow ? ' (a shallow history: some may be missing)' : ''}; ${stats.ambiguousCountedPrivate} never showed in a public section, or sat in a private one, and are counted private.`);
  L.push(`- **Stated cadence:** ${CADENCE.source}. It is a schedule the sim assumes, not a read of anyone's learning record, and it assumes every lesson and lift lands; a region is a stated week of ten lessons.`);
  L.push(`- **Ground model:** expected value, not the map: a pylon adds half its disc (${(Math.PI * rules.fortress.pylon_reach ** 2 * 0.5).toFixed(1)} tiles); the blight is the siege's size (\`tiles_per_attacker\`, clamped); the night spread (\`spread_base + spread_per_day × day\`, capped) takes wild tiles only. Scrap from play (ambient nodes, kills, habitats) is not modelled; only evidence caches are.`, '');
  L.push('## The four targets (GDD §2.4)', '', '| # | Target | Result | Number |', '|---|---|---|---|');
  T.forEach((t, i) => L.push(`| ${i + 1} | ${t.name} | **${t.met ? 'met' : 'not met'}** | ${fmtTarget(t)} |`));
  if (closesOnly) { const c = closesOnly; L.push('', `**On real closes alone** (no stated lessons or lifts): target 1 ${c[0].met ? 'met' : 'not met'} (${c[0].value} cells on the median day), target 4 ${c[3].met ? 'met' : 'not met'} (level ${c[3].value.l30} at day 30, ${c[3].value.l90} projected at day 90). Targets 1 and 4 lean on the stated cadence; 2 and 3 are the backlog's.`); }
  L.push('', '**Ground is an upper bound.** The sim takes every pylon to stand. In the prototype a machine can destroy a pylon at night and its ground goes wild again (version 2\'s rule, kept): that is a design question, recorded with D33 in the design repo.');
  L.push('', '## Per week', '', 'Weeks run Monday to Sunday; the first and last may be partial (the days column). Cells and scrap are the evidence caches landed that week; pylons are what the week\'s cells buy at the pylon\'s cost, with the remainder carried; level, blight, wave and ground are as of the week\'s last day.', '');
  L.push('| Week of | Days | Closes | Decisions | Lessons | Lifts | Cells | Scrap | Level | Pylons | Blight tiles | Wave | Ground tiles |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const w of W) L.push(`| ${w.monday} | ${w.days} | ${w.closes} | ${w.decisions} | ${w.lessons} | ${w.lifts} | ${w.cells} | ${w.scrap} | ${w.level} | ${w.pylons} | ${w.blight} | ${w.wave} | ${w.ground} |`);
  L.push('', '## The arc, in plain words', '', arc(sim, W, T, rules), '');
  L.push('## Tuning', '', 'Every change is a rules-file edit (`rules/fieldworks.json`), never the engine. Each row was applied in order and the whole sim re-run; the columns are the four targets after that row (✓ met, ✗ not).', '');
  L.push('| Step | Key | Before → after | Why | T1 | T2 | T3 | T4 |', '|---|---|---|---|---|---|---|---|');
  tuningRuns.forEach((run, i) => {
    const t = i === 0 ? null : tuning[i - 1];
    L.push(`| ${i} | ${t ? `\`${t.key}\`` : 'the v1 rules'} | ${t ? `${JSON.stringify(t.before)} → ${JSON.stringify(t.after)}` : '—'} | ${t ? t.why : 'the baseline'} | ${run.map((x) => (x.met ? '✓' : '✗')).join(' | ')} |`);
  });
  L.push('', '**Not touched:** the engine; rarity, XP bases and multipliers, medals, the skill step, the siege\'s ages and weights (they are the design\'s definition of an attacker, not a balance knob), the other structure costs and every structure\'s health, the machines, the modules, the caches by grade and by kind, and the explore block.', '');
  L.push('## Where cells, scrap and XP change in the prototype', '', 'Read from `prototype/prototype.src.html` when this report was generated. Each line must trace to an evidence event (a cache picked up), a spend, or a save restoring what the player already held; XP changes only in the engine\'s fold over evidence events.', '');
  for (const h of sourceAudit()) L.push(`- line ${h.line}: \`${h.text.replace(/`/g, "'")}\``);
  L.push('');
  return L.join('\n');
}

function arc(sim, W, T, rules) {
  const ds = sim.days; const at = (n) => ds[Math.min(n, ds.length) - 1];
  const w1 = at(7), m1 = at(30), end = ds[ds.length - 1]; const t4 = T[3].value;
  const pct = (g) => Math.round(g / (rules.fortress.cols * rules.fortress.rows) * 100);
  return [
    `**The first week.** By the seventh day the evidence of that week has landed ${ds.slice(0, 7).reduce((a, d) => a + d.cells, 0)} cells, enough for ${ds.slice(0, 7).reduce((a, d) => a + d.pylons, 0)} pylons; the Keeper is level ${w1.level} and the ground stands at about ${pct(w1.ground)}% of the map. The blight at the edges is ${w1.blight} tiles, drawn from ${w1.attackers} orders at the walls, and a night brings ${w1.wave} machines.`,
    `**The first month.** At day 30 the Keeper is level ${m1.level} (level 5 came on day ${t4.l5day ?? '—'}), the ground is about ${pct(m1.ground)}% and the blight ${m1.blight} tiles; ${m1.regions} regions are mapped on the stated cadence.`,
    `**The quarter.** At the window's pace the Keeper would reach level ${t4.l90} by day 90 (projected; the file holds ${ds.length} days). On the last day of the window the ground is about ${pct(end.ground)}%, the blight ${end.blight} tiles from ${end.attackers} attackers, and a night is ${end.wave} machines.`,
  ].join(' ');
}

async function main(argv) {
  const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const alys = arg('--alys'); if (!alys) { console.error('economy.mjs: --alys <path to the alys checkout> is required (the parser and the task file are read from there, never copied here)'); process.exit(2); }
  const A = resolve(alys); const ref = arg('--ref', 'origin/main'); const today = arg('--today', new Date().toISOString().slice(0, 10));
  const P = await loadParser(A); const E = loadEngine();
  const file = taskFileName(A);
  if (!argv.includes('--no-fetch')) { try { git(A, ['fetch', '-q', 'origin', ref.replace(/^origin\//, '')]); } catch { /* offline: the ref as it stands */ } }
  const sha = git(A, ['rev-parse', ref]).trim();
  const md = git(A, ['show', `${ref}:${file}`]);
  const index = JSON.parse(git(A, ['show', `${ref}:projects.json`]));
  const { done } = P.parseTasks(md);
  const ambiguous = done.filter((w) => !w.private && !w.projectRef).map((w) => w.id);
  const history = sectionHistory(A, ref, file, ambiguous);
  const { rows, stats } = extract(md, today, index, P, history);
  const rules = JSON.parse(readFileSync(join(ROOT, 'rules', 'fieldworks.json'), 'utf8'));
  const tuning = JSON.parse(readFileSync(join(here, 'tuning.json'), 'utf8')).changes;
  const tuningRuns = [];
  for (let n = 0; n <= tuning.length; n++) tuningRuns.push(targets(simulate(rows, applyTuning(rules, tuning, n), today, E), applyTuning(rules, tuning, n)));
  const sim = simulate(rows, rules, today, E);
  const closesOnly = targets(simulate(rows, rules, today, E, 60, { closesOnly: true }), rules);
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
