// FIELDWORKS — the engine's check (node --test tests/check.mjs).
// Holds the reference engine (src/engine.js) to the rules (rules/fieldworks.json)
// and the design's §6 numbers, holds the castle module (src/castle.js: the castle
// from evidence, the horde's clock, the fight) to its pillars, holds
// prototype/index.html to the three files it inlines (prototype/build.mjs writes it), and sweeps the whole tree for the
// walls: this repository is public, so a name, an e-mail, a database ref or a
// real-range order id never lands here. The denylist is stored as hashes, so the
// check itself carries none of the words it refuses.
import test from 'node:test';
import assert from 'node:assert';
// loose equality on purpose: the engine runs in a vm context, so its objects carry another realm's prototypes
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const RULES = JSON.parse(read('rules/fieldworks.json'));
const ctx = { globalThis: null }; ctx.globalThis = ctx;
vm.runInNewContext(read('src/engine.js'), ctx);
const E = ctx.FieldworksEngine;
vm.runInNewContext(read('src/castle.js'), ctx);
const C = ctx.FieldworksCastle;
const TODAY = '2026-11-09';
const ev = (o) => ({ tier: 'public', evidence: { kind: 'commit', ref: 'abc' }, at: '2026-11-08', ...o });

test('rarity: the §6.1 ladder and its grades', () => {
  assert.equal(E.gradeOf(0, RULES), 'plain');
  assert.equal(E.gradeOf(35, RULES), 'fine');
  assert.equal(E.gradeOf(55, RULES), 'tempered');
  assert.equal(E.gradeOf(72, RULES), 'masterwork');
  assert.equal(E.gradeOf(86, RULES), 'heirloom');
  // an aged P1 decision in the Now lane reaches masterwork or better
  const d = E.drop(ev({ id: 'WO-926', kind: 'decision', weight: 70, facts: { pn: 'P1', difficulty: 'high', ageDays: 54, options: 3, band: 'now' } }), RULES);
  assert.ok(['masterwork', 'heirloom'].includes(d.grade), d.grade);
  // a fresh P3 chore stays plain or fine
  const p = E.drop(ev({ id: 'WO-900', kind: 'close', weight: 30, facts: { pn: 'P3', difficulty: 'low', ageDays: 1 } }), RULES);
  assert.ok(['plain', 'fine'].includes(p.grade), p.grade);
});

test('determinism: the same id rolls the same item on any device', () => {
  const a = E.drop(ev({ id: 'WO-984', kind: 'close', weight: 85, facts: { pn: 'P1', ageDays: 40 } }), RULES);
  const b = E.drop(ev({ id: 'WO-984', kind: 'close', weight: 85, facts: { pn: 'P1', ageDays: 40 } }), RULES);
  assert.deepEqual(a, b);
  assert.ok(Math.abs(E.rarityScore(ev({ id: 'x', kind: 'close', weight: 50 }), RULES) - E.rarityScore(ev({ id: 'y', kind: 'close', weight: 50 }), RULES)) <= 2 * RULES.rarity.variance);
});

test('walls: a private event is sealed, nameless, and refused if it carries a title', () => {
  const s = E.drop(ev({ id: 'private-1', kind: 'close', tier: 'private', weight: 90, facts: { pn: 'P1', ageDays: 60, band: 'now' } }), RULES);
  assert.equal(s.kind, 'sealed'); assert.equal(s.receipt, null); assert.equal(s.zone, null); assert.equal(s.name, 'A sealed crate');
  assert.equal(E.validateEvent(ev({ id: 'p2', kind: 'close', tier: 'private', title: 'Book the thing' })), 'a private event carries a name field');
  assert.equal(E.validateEvent(ev({ id: 'p3', kind: 'close', evidence: null })), 'no evidence');
  assert.equal(E.validateEvent(ev({ id: 'p4', kind: 'open' })), 'unknown kind open');
});

test('xp: evidence only, drops drop nothing for pace/verify, a contradiction voids its event', () => {
  const close = ev({ id: 'WO-901', kind: 'close', weight: 60, facts: { pn: 'P2' } });
  const st = E.evaluate([close, ev({ id: 'pace-1', kind: 'pace', evidence: { kind: 'commit', ref: 'p' } })], RULES, TODAY);
  assert.equal(st.items.length, 1); assert.equal(st.counts.pace, 1);
  assert.equal(st.player.xp, E.xp(close, st.items[0], RULES) + RULES.xp.base.pace);
  const voided = E.evaluate([close, ev({ id: 'c-1', kind: 'contradict', at: '2026-11-09', facts: { target: 'WO-901' } })], RULES, TODAY);
  assert.equal(voided.items.length, 0); assert.equal(voided.player.xp, 0); assert.deepEqual([...voided.voided], ['WO-901']);
  const settled = E.evaluate([close, ev({ id: 'v-1', kind: 'verify', at: '2026-11-09', facts: { target: 'WO-901' } })], RULES, TODAY);
  assert.equal(settled.items[0].provisional, false);
  assert.ok(settled.medals.some((m) => m.slug === 'receipts'));
});

test('levels: the triangular curve', () => {
  assert.equal(E.level(99, 100), 0); assert.equal(E.level(100, 100), 1); assert.equal(E.level(300, 100), 2); assert.equal(E.level(1000, 100), 4);
  assert.deepEqual({ ...E.progress(350, 100) }, { level: 2, into: 50, need: 300, next: 600 });
});

test('medals: Answered is top and once a day; Double clear; Return after seven quiet days; never lost', () => {
  const d1 = ev({ id: 'WO-910', kind: 'decision', at: '2026-11-01', facts: { options: 2 } });
  const d2 = ev({ id: 'WO-911', kind: 'decision', at: '2026-11-01', facts: { options: 2 } });
  const c1 = ev({ id: 'WO-912', kind: 'close', at: '2026-11-01' });
  const c2 = ev({ id: 'WO-913', kind: 'close', at: '2026-11-01' });
  const late = ev({ id: 'WO-914', kind: 'close', at: '2026-11-09' });
  const st = E.evaluate([d1, d2, c1, c2, late], RULES, TODAY);
  const slugs = st.medals.map((m) => m.slug);
  assert.equal(slugs.filter((s) => s === 'answered').length, 1);
  assert.ok(st.medals.find((m) => m.slug === 'answered').top);
  assert.ok(slugs.includes('double-clear'));
  assert.ok(slugs.includes('return'));
  assert.equal(E.evaluate([c1, ev({ id: 'WO-915', kind: 'close', at: '2026-11-05' })], RULES, TODAY).medals.some((m) => m.slug === 'return'), false);
});

test('siege: attackers from age or Options, engines at 60/45 days, pressure never a penalty', () => {
  const open = [
    { id: 'WO-922', written: '2026-09-04', pn: 'P3', options: 2, steps: 3, zone: 'off-races', tier: 'public', band: 'later' },
    { id: 'WO-926', written: '2026-09-16', pn: 'P1', options: 8, steps: 4, zone: 'off-races', tier: 'public', band: 'now' },
    { id: 'WO-999', written: '2026-11-06', pn: 'P0', options: 0, steps: 5, zone: 'alys', tier: 'public', band: 'now' },
    { id: 'WO-977', written: '2026-10-01', pn: 'P2', options: 0, steps: 2, zone: 'alys', tier: 'public', band: 'next' },
    { id: 'WO-955', written: '2026-10-01', pn: 'P2', options: 0, steps: 2, zone: null, tier: 'private', band: 'next' }
  ];
  const wards = E.siege(open, RULES, TODAY);
  const off = wards.find((w) => w.zone === 'off-races');
  assert.equal(off.attackers.length, 2);
  assert.ok(off.attackers.every((a) => a.engine), 'both decisions are past 45 days');
  assert.equal(off.attackers.find((a) => a.id === 'WO-922').hp, 2);
  const alys = wards.find((w) => w.zone === 'alys');
  assert.equal(alys.attackers.length, 1, 'a three-day P0 is not an attacker yet');
  assert.equal(alys.attackers[0].engine, false);
  const keep = wards.find((w) => w.zone === 'keep');
  assert.equal(keep.attackers[0].id, 'private-1', 'the Keep names nothing');
  assert.ok(wards[0].pressure >= wards[wards.length - 1].pressure);
});

test('M2/M3: the fold computes week and quest completion from the context, pays the region bonus and floors a Return drop', () => {
  const plan = { weeks: [{ n: 1, lessons: ['a', 'b'] }] };
  const l = (id, at) => ev({ id: `lesson/${id}`, kind: 'lesson', at, tier: 'private', weight: 30, evidence: { kind: 'tick', ref: id } });
  const st = E.evaluate([l('a', '2026-11-01'), l('b', '2026-11-02')], RULES, TODAY, { plan });
  assert.ok(st.medals.some((m) => m.slug === 'region-mapped'), 'Region mapped fired from the plan, no adapter flag');
  const withoutBonus = E.evaluate([l('a', '2026-11-01')], RULES, TODAY, { plan }).player.xp;
  const second = st.log.find((x) => x.id === 'lesson/b');
  assert.equal(second.xp - E.xp(l('b', '2026-11-02'), second.item, RULES), RULES.expedition.region_bonus_xp, 'the 60 XP region bonus is paid once, on the completing lesson');
  assert.ok(st.player.xp > withoutBonus);
  const quests = { q1: ['t1', 't2'] };
  const t = (id, at) => ev({ id: `task/q1/${id}`, kind: 'task', at, weight: 50, evidence: { kind: 'tick', ref: at } });
  assert.ok(E.evaluate([t('t1', '2026-11-01'), t('t2', '2026-11-03')], RULES, TODAY, { quests }).medals.some((m) => m.slug === 'campaign'));
  assert.equal(E.evaluate([t('t1', '2026-11-01')], RULES, TODAY, { quests }).medals.some((m) => m.slug === 'campaign'), false);
  // the Return floor: a plain drop after a quiet week lands as fine
  const early = ev({ id: 'WO-500', kind: 'close', at: '2026-10-01', weight: 20, facts: { pn: 'P3' } });
  const late = ev({ id: 'WO-501', kind: 'close', at: '2026-11-09', weight: 20, facts: { pn: 'P3', difficulty: 'low', ageDays: 0 } });
  assert.equal(E.drop(late, RULES).grade, 'plain', 'on its own facts the drop is plain');
  const r = E.evaluate([early, late], RULES, TODAY);
  assert.equal(r.items[1].grade, RULES.weather.return_grade); assert.ok(r.items[1].returned); assert.ok(r.medals.some((m) => m.slug === 'return'));
});

test('M4/L6: the Keep\'s attackers are a count and an engine flag; a row without a date is refused, never NaN', () => {
  const wards = E.siege([
    { id: 'WO-955', written: '2026-09-01', pn: 'P1', options: 0, steps: 4, zone: null, tier: 'private', band: 'now' },
    { id: 'WO-956', written: 'yesterday', pn: 'P1', options: 0, steps: 4, zone: 'alys', tier: 'public', band: 'now' }
  ], RULES, TODAY);
  const keep = wards.find((w) => w.zone === 'keep');
  assert.deepEqual(Object.keys(keep.attackers[0]).sort(), ['engine', 'id']);
  assert.equal(keep.attackers[0].engine, true);
  assert.ok(Number.isFinite(keep.pressure));
  assert.equal(wards.refused.length, 1); assert.equal(wards.find((w) => w.zone === 'alys'), undefined);
});

test('expedition: regions, rank, a re-pace changes nothing', () => {
  const plan = { weeks: [{ n: 1, lessons: ['a', 'b'] }, { n: 2, lessons: ['c', 'd'] }, { n: 3, lessons: ['e'] }] };
  const x = E.expedition(plan, ['a', 'b', 'c', 'd'], RULES);
  assert.equal(x.mapped, 2); assert.equal(x.rank.slug, 'surveyor'); assert.equal(x.next.slug, 'cartographer');
  assert.deepEqual(E.expedition(plan, ['a', 'b', 'c', 'd'], RULES), x);
});

test('challenges: rule-picked from what the lanes can satisfy, stable for a date', () => {
  const avail = { quick_order: true, open_decision: false, lessons_today: false, lift_day: false, now_order: true, open_order: true, lift_week: false, sprint_active: true, pressured_ward: true };
  const c = E.challenges(avail, RULES, TODAY);
  assert.ok(['quick-clear', 'oldest-now'].includes(c.daily.slug));
  assert.deepEqual(E.challenges(avail, RULES, TODAY), c);
  assert.equal(E.challenges({}, RULES, TODAY).daily, null);
});

test('rules file: every bank key exists for every kind × grade, every medal type is in the engine, every perk hook closed', () => {
  const kinds = [...new Set(Object.values(RULES.rarity.kind_by_event)), RULES.rarity.sealed_kind];
  for (const k of kinds) for (const g of RULES.rarity.grades) assert.ok(RULES.bank.item[k]?.[g]?.length, `bank item.${k}.${g}`);
  for (const m of RULES.medals) { assert.ok(RULES.bank.medal[m.slug], `bank medal.${m.slug}`); assert.ok(['kind_count', 'same_band', 'on_due', 'verified', 'after_quiet', 'age_at_close', 'week_complete', 'quest_complete'].includes(m.type)); }
  for (const p of RULES.skills.perks) assert.ok(RULES.skills.hooks.includes(p.hook));
  for (const pool of ['daily', 'weekly']) for (const c of RULES.challenges[pool]) assert.ok(RULES.bank.challenge[c.slug], `bank challenge.${c.slug}`);
});

test('prototype/index.html inlines src/engine.js, src/castle.js and rules/fieldworks.json byte for byte', () => {
  const html = read('prototype/index.html');
  assert.ok(html.includes(read('src/engine.js')), 'engine.js is inlined unchanged');
  assert.ok(html.includes(read('src/castle.js')), 'castle.js is inlined unchanged');
  assert.ok(html.includes(read('rules/fieldworks.json').trim()), 'the rules are inlined unchanged');
});

// ── the walls: a sweep of every file in the tree ─────────────────────────────
// Word hashes (sha256, first 16 hex) of a person's name and its spellings, a mail
// host, and the two database project refs the portfolio runs on.
const DENY = new Set(['ccb71b663e383032', '3fe52df0c21fa28f', 'ea5e5cdbccb765e0', 'a67f8eb35b59c847', '576ba7c2e4abb718', '5ecec73dd71edcbb', '7772e1e25e61f131']);
const h16 = (w) => createHash('sha256').update(w).digest('hex').slice(0, 16);
const EMAIL = new RegExp('[^\\s@<>"\'(]+' + '@' + '[^\\s@<>"\')]+\\.[a-z]{2,}', 'i');
const REAL_ID = new RegExp('WO-' + '(?:\\d{1,2}|[01]\\d\\d|2[0-7]\\d)\\b', 'i');   // any casing, one to three digits
export function sweep(text) {
  const hits = [];
  for (const w of new Set(text.toLowerCase().match(/[a-z0-9]+/g) || [])) if (DENY.has(h16(w))) hits.push(`denied word (${w.length} chars)`);
  const m = EMAIL.exec(text); if (m) hits.push(`an e-mail shape: ${m[0].slice(0, 6)}…`);
  const r = REAL_ID.exec(text); if (r) hits.push(`a real-range order id (below the invented 280s): ${r[0]}`);
  return hits;
}
const SKIP_DIRS = new Set(['.git', 'node_modules', '.code-review-graph']);
const TEXT = /\.(md|mjs|js|json|html|yml|yaml|txt|py|css)$|^\.[a-z]+ignore$|^\.mcp\.json$/;
function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) out.push(...files(p)); }
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

test('walls: the sweep catches what it guards (a name, an e-mail, a real id) and passes invented data', () => {
  // the probes are assembled so this file carries none of them whole
  const name = ['Sc', 'ot'].join('');
  assert.ok(sweep(`for ${name} to read`).length, 'a name is caught');
  assert.ok(sweep('mail ' + ['someone', 'example.com'].join('@')).length, 'an e-mail shape is caught');
  assert.ok(sweep('see ' + 'WO-' + '042').length, 'a real-range id is caught');
  assert.ok(sweep('see ' + 'WO-' + '245').length, 'and one the real file will reach soon');
  assert.ok(sweep('see ' + 'wo-' + '042').length && sweep('see ' + 'WO-' + '42.').length, 'in lower case and without its leading zero');
  assert.equal(sweep('WO-304 · P1 · a DEMO chore; family=Albert+Sans:wght@300;500').length, 0, 'invented ids and font URLs pass');
});

test('walls: no file in the tree carries a name, an e-mail, a database ref or a real-range order id', () => {
  const found = [];
  for (const f of files(root)) { const hits = sweep(readFileSync(f, 'utf8')); if (hits.length) found.push(`${relative(root, f)}: ${hits.join('; ')}`); }
  assert.deepEqual(found, []);
});

// ── the rework (design D34): the castle, the horde, the stages ───────────────
const line = (kind, grade) => ({ id: `${kind}-${grade || 'x'}`, kind, xp: 1, item: grade ? { grade } : null, medals: [] });
const built = (count) => C.castleFrom({ wall: 0, tower: 0, keep: 0, course: 0, gate: 0, lamp: 0, ...count }, 1, RULES);
const strong = built({ wall: 30, tower: 16, keep: 4, course: 40, gate: 8 });
const weak = built({ wall: 2, tower: 1 });

test('rules.castle: a piece for every kind of evidence, by kind first, else by the drop\'s grade, and for nothing else', () => {
  const RC = RULES.castle;
  assert.deepEqual(Object.keys(RC.by_grade), RULES.rarity.grades, 'every grade lays a piece');
  for (const p of [...Object.values(RC.by_grade), ...Object.values(RC.by_kind)]) { assert.ok(RC.parts.includes(p.part), p.part); assert.ok(Number.isInteger(p.size) && p.size >= 1); }
  for (const k of Object.keys(RC.by_kind)) assert.ok(E.KINDS.includes(k), `by_kind.${k} is an evidence kind the engine knows`);
  const sizes = RULES.rarity.grades.map((g) => RC.by_grade[g]);
  assert.deepEqual(sizes.slice(0, 2).map((p) => p.part), ['wall', 'wall']); assert.deepEqual(sizes.slice(2).map((p) => p.part), ['tower', 'tower', 'tower'], 'a better drop is a bigger piece: wall sections, then tower levels');
  assert.ok(sizes[1].size > sizes[0].size && sizes[4].size > sizes[3].size && sizes[3].size > sizes[2].size);
  assert.deepEqual({ ...C.pieceFor(line('close', 'tempered'), RULES) }, { part: 'tower', size: 1 });
  assert.deepEqual({ ...C.pieceFor(line('decision', 'plain'), RULES) }, { part: 'keep', size: 1 }, 'a decision answered is a keep level whatever its grade');
  assert.deepEqual({ ...C.pieceFor(line('lesson', 'fine'), RULES) }, { part: 'course', size: 1 });
  assert.deepEqual({ ...C.pieceFor(line('lift', 'plain'), RULES) }, { part: 'gate', size: 1 });
  assert.equal(C.pieceFor(line('verify', null), RULES), null, 'a line with no drop lays nothing');
  assert.equal(C.pieceFor({ id: 'x', voided: true }, RULES), null, 'a voided event lays nothing');
  for (const play of ['score', 'kill', 'spark', 'stage', 'horde']) assert.equal(C.pieceFor({ id: 'p', kind: play, item: null }, RULES), null, `${play} is not evidence`);
  for (const k of Object.keys(RC.parts.reduce((a, p) => ({ ...a, [p]: 1 }), {}))) assert.ok(RULES.bank.castle.parts[k], `bank castle.parts.${k}`);
});

test('the castle is a fold over the evidence log: deterministic, towers breadth-first, never smaller for more evidence', () => {
  const events = [ev({ id: 'WO-901', kind: 'close', weight: 80, facts: { pn: 'P1', difficulty: 'high', ageDays: 50 } }), ev({ id: 'WO-902', kind: 'decision', facts: { options: 2 } }), ev({ id: 'lesson/a', kind: 'lesson', tier: 'private', weight: 30, evidence: { kind: 'tick', ref: 'a' } }), ev({ id: 'lift/1', kind: 'lift', tier: 'private', weight: 30, evidence: { kind: 'tick', ref: 'b' } }), ev({ id: 'pace/1', kind: 'pace' })];
  const st = E.evaluate(events, RULES, TODAY);
  const cas = C.castleOf(st.log, RULES);
  assert.equal(cas.pieces, 5); assert.equal(cas.count.keep, 1); assert.equal(cas.count.course, 1); assert.equal(cas.count.gate, 1); assert.equal(cas.count.lamp, 1); assert.ok(cas.count.tower >= 1, 'an aged high P1 close is a tower');
  assert.deepEqual(C.castleOf(st.log, RULES), cas, 'the same log is the same castle');
  assert.deepEqual([...built({ tower: 5 }).towers], [2, 1, 1, 1], 'every slot stands before any slot rises');
  let prev = C.castleOf([], RULES);
  for (let n = 1; n <= events.length; n++) { const c = C.castleOf(E.evaluate(events.slice(0, n), RULES, TODAY).log, RULES); for (const p of RULES.castle.parts) assert.ok(c.count[p] >= prev.count[p], `${p} never falls`); assert.ok(c.wallHp >= prev.wallHp && c.dps >= prev.dps && c.beaconHp >= prev.beaconHp); prev = c; }
  const gone = C.castleOf(E.evaluate([...events, ev({ id: 'c-1', kind: 'contradict', at: '2026-11-09', facts: { target: 'WO-902' } })], RULES, TODAY).log, RULES);
  assert.equal(gone.count.keep, 0, 'a contradicted tick was never evidence, so its piece was never laid');
});

test('rules.horde: the clock gathers from the siege\'s count, warns warning_hours ahead, keeps its gap, and an unread day gathers nothing', () => {
  const H = RULES.horde, lead = Math.round(H.warning_hours / 24), day = (n) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
  assert.equal(H.warning_hours, 72, 'the warning is three days'); assert.ok(H.min_gap_days >= 7 && H.min_gap_days > lead, 'hordes are infrequent');
  let clock = C.hordeClock(); const warned = [], arrived = [];
  const sizes = [];
  for (let n = 0; n < 120; n++) { const at = 60 + n; const r = C.hordeDay(clock, at, day(n), RULES, 1); clock = r.clock; if (r.warned) { warned.push(n); sizes.push({ ...clock.horde }); assert.deepEqual({ ...clock.horde }, { ...C.hordeOf(at, 1, clock.count, RULES) }, 'sized at the warning'); } if (r.arrived) { arrived.push(n); assert.deepEqual({ ...r.horde }, sizes[arrived.length - 1], 'the horde that arrives is the one that was announced, though the backlog moved'); assert.equal(clock.horde, null); } }
  assert.ok(arrived.length >= 4, 'a deep backlog brings hordes');
  arrived.forEach((a, i) => assert.equal(a - warned[i], lead, 'every arrival was announced the full warning ahead'));
  for (let i = 1; i < arrived.length; i++) assert.ok(arrived[i] - arrived[i - 1] >= H.min_gap_days, `gap ${arrived[i] - arrived[i - 1]}`);
  const period = arrived[2] - arrived[1];
  assert.ok(period >= 12 && period <= 16, `about a fortnight at a deep backlog: ${period} days`);
  assert.equal(clock.count, arrived.length);
  // the cap: a backlog twice as deep comes no faster
  let c2 = C.hordeClock(); const a2 = []; for (let n = 0; n < 120; n++) { const r = C.hordeDay(c2, 600, day(n), RULES); c2 = r.clock; if (r.arrived) a2.push(n); }
  assert.deepEqual(a2, arrived, 'gather_cap_per_day holds the cadence');
  // a thin backlog comes more slowly, and none comes with nothing at the walls
  let c3 = C.hordeClock(); const a3 = []; for (let n = 0; n < 120; n++) { const r = C.hordeDay(c3, 5, day(n), RULES); c3 = r.clock; if (r.arrived) a3.push(n); }
  assert.ok(a3.length < arrived.length && a3.length >= 1);
  let c4 = C.hordeClock(); for (let n = 0; n < 120; n++) c4 = C.hordeDay(c4, 0, day(n), RULES).clock;
  assert.equal(c4.count, 0); assert.equal(c4.due, null);
  // unread: null gathers nothing, and is not a zero
  let c5 = C.hordeDay(C.hordeClock(), 20, day(0), RULES).clock; const g = c5.gather; assert.ok(g > 0);
  for (let n = 1; n < 30; n++) c5 = C.hordeDay(c5, null, day(n), RULES).clock;
  assert.equal(c5.gather, g, 'an unread lane leaves the clock where it stood'); assert.equal(c5.due, null);
  // a horde already announced still arrives on its day when the lane goes unread
  let c6 = { gather: 0, warned: day(0), due: day(3), count: 0, last: null };
  assert.equal(C.hordeDay(c6, null, day(2), RULES).arrived, false); assert.equal(C.hordeDay(c6, null, day(3), RULES).arrived, true);
});

test('rules.horde.size: the horde is the backlog that day plus how many came before, capped; its bosses are the siege engines', () => {
  const z = RULES.horde.size;
  assert.equal(C.hordeOf(20, 0, 0, RULES).n, Math.round(z.base + z.per_attacker * 20));
  assert.ok(C.hordeOf(20, 0, 3, RULES).n > C.hordeOf(20, 0, 0, RULES).n, 'a later horde is larger');
  assert.ok(C.hordeOf(40, 0, 0, RULES).n > C.hordeOf(20, 0, 0, RULES).n, 'a deeper backlog is a larger horde');
  assert.equal(C.hordeOf(5000, 0, 50, RULES).n, z.max);
  assert.equal(C.hordeOf(20, 9, 0, RULES).bosses, RULES.horde.max_bosses); assert.equal(C.hordeOf(20, 1, 0, RULES).bosses, 1);
  for (const m of ['crawler', 'skitter', 'brute']) { const s = RULES.horde.machines[m]; assert.ok(s.hp > 0 && s.speed > 0 && s.dps > 0, m); }
});

test('the fight is one stepping function: the forecast is the fight without the Keeper, and it is deterministic', () => {
  const horde = C.hordeOf(30, 1, 1, RULES);
  const a = C.resolveHorde(strong, horde, RULES, 0), b = C.resolveHorde(strong, horde, RULES, 0);
  assert.deepEqual(a, b);
  const f = C.hordeStart(strong, horde, RULES, 0); let steps = 0; while (!f.done && steps++ < 5000) C.hordeStep(f, RULES);
  assert.deepEqual(C.summary(f), a, 'stepping it by hand is resolveHorde');
  assert.equal(a.total, horde.n); assert.equal(a.keeperDowned, 0, 'nobody at the wall in a forecast');
  assert.ok(['held', 'breached', 'dark'].includes(a.outcome));
  assert.equal(C.resolveHorde(strong, C.hordeOf(4, 0, 0, RULES), RULES, 0).outcome, 'held', 'a strong castle holds a small horde on its own');
  const lost = C.resolveHorde(weak, C.hordeOf(200, 3, 9, RULES), RULES, 0);
  assert.notEqual(lost.outcome, 'held'); assert.equal(lost.wallLeft, 0);
  assert.ok(a.guns.length >= 4 && a.guns.every((g) => g.level > 0), 'every standing tower and the keep fire');
  assert.ok(!a.best || a.guns.some((g) => g.id === a.best.id && g.downed === a.best.downed), 'the tower that mattered is one of the guns');
  assert.ok(C.resolveHorde(strong, horde, RULES, 0).seconds <= RULES.horde.max_seconds + 1, 'a fight ends');
});

test('pillar 2 in the fight: a horde changes nothing in the castle, whatever the outcome', () => {
  for (const cas of [strong, weak, built({})]) {
    const before = JSON.stringify(cas);
    const out = C.resolveHorde(cas, C.hordeOf(200, 3, 9, RULES), RULES, 0);
    assert.equal(JSON.stringify(cas), before, `the castle is untouched after ${out.outcome}`);
    assert.deepEqual(Object.keys(out).sort(), ['beaconLeft', 'best', 'downed', 'guns', 'keeperDowned', 'outcome', 'rally', 'seconds', 'total', 'wallLeft', 'withdrew'], 'a summary carries no piece, XP or item');
  }
  assert.ok(RULES.bank.horde.breached.includes('Nothing was taken') && RULES.bank.horde.dark.includes('Nothing was taken'));
});

test('play can only help: the Keeper\'s shots are counted apart and never make an outcome worse', () => {
  const horde = C.hordeOf(26, 1, 2, RULES), cas = built({ wall: 20, tower: 9, keep: 2, course: 20, gate: 4 });
  const alone = C.resolveHorde(cas, horde, RULES, 0);
  const f = C.hordeStart(cas, horde, RULES, 0); let n = 0;
  while (!f.done && n++ < 5000) { C.hordeStep(f, RULES); if (n % 4 === 0) { const i = f.machines.findIndex((z) => z.alive); if (i >= 0) C.keeperHit(f, i, RULES.horde.keeper_shot); } }
  const helped = C.summary(f); const rank = { dark: 0, breached: 1, held: 2 };
  assert.ok(helped.keeperDowned > 0); assert.ok(rank[helped.outcome] >= rank[alone.outcome], `${alone.outcome} → ${helped.outcome}`);
  assert.equal(helped.downed + helped.keeperDowned + helped.withdrew <= helped.total, true);
  assert.equal(C.keeperHit(f, 0, 999), false, 'a finished fight takes no more shots');
});

test('the warning\'s count: 0 when the castle holds, the fewest tasks that would see it hold otherwise, null past the cap; pieces only ever lower it', () => {
  const W = RULES.horde.warning; assert.ok(W.max_tasks >= 5 && W.max_tasks <= 9, 'a single digit: it is a count on a tile');
  for (const p of W.assume) assert.ok(RULES.castle.parts.includes(p.part));
  assert.equal(C.readiness(strong, C.hordeOf(4, 0, 0, RULES), RULES, 0).tasks, 0);
  assert.equal(C.readiness(built({}), C.hordeOf(600, 3, 30, RULES), RULES, 0).tasks, null);
  const horde = C.hordeOf(26, 1, 2, RULES); let cas = built({ wall: 12, tower: 5, keep: 1, course: 14, gate: 2 }); let last = Infinity, seenBetween = false;
  for (let k = 0; k < 80 && last > 0; k++) {
    const r = C.readiness(cas, horde, RULES, 0), t = r.tasks == null ? Infinity : r.tasks;
    assert.ok(t <= last, `more castle never asks for more tasks: ${last} → ${t}`); last = t; if (t > 0 && t < Infinity) seenBetween = true;
    if (r.tasks > 0) { const extra = Array.from({ length: r.tasks }, (_, i) => W.assume[i % W.assume.length]); assert.equal(C.resolveHorde(C.withPieces(cas, extra, RULES), horde, RULES, r.tasks).outcome, 'held', 'the count is true: that many tasks do hold it'); }
    cas = C.withPieces(cas, [W.assume[k % W.assume.length]], RULES);
  }
  assert.equal(last, 0); assert.ok(seenBetween, 'the count takes values between none and too many');
  for (const k of ['warning', 'when_days', 'when_day', 'when_today', 'need_none', 'need_one', 'need_some', 'need_many', 'gathering', 'unread', 'arrive', 'held', 'breached', 'dark', 'sum_best', 'sum_wall', 'rally']) assert.ok(RULES.bank.horde[k], `bank horde.${k}`);
  assert.ok(!/\{(title|id|name)\}/.test(JSON.stringify(RULES.bank.horde)), 'a warning carries a count, never a title or an id');
});

test('rules.horde.rally: pieces landed since the warning lift the castle for that fight, up to a cap', () => {
  const R = RULES.horde.rally;
  assert.equal(C.rallyOf(0, RULES), 1); assert.equal(C.rallyOf(2, RULES), 1 + 2 * R.per_piece); assert.equal(C.rallyOf(999, RULES), 1 + R.max_pieces * R.per_piece); assert.equal(C.rallyOf(-3, RULES), 1);
  const f0 = C.hordeStart(strong, C.hordeOf(10, 0, 0, RULES), RULES, 0), f4 = C.hordeStart(strong, C.hordeOf(10, 0, 0, RULES), RULES, 4);
  assert.ok(f4.wallMax > f0.wallMax && f4.guns[0].dps > f0.guns[0].dps);
  const big = C.hordeOf(40, 2, 4, RULES), fr = C.hordeStart(strong, big, RULES, 6); let n = 0; while (!fr.done && n++ < 5000) C.hordeStep(fr, RULES);
  assert.deepEqual(C.resolveHorde(strong, big, RULES, 6), C.summary(fr), 'a forecast carries the rally the fight will have');
  assert.notDeepEqual(C.resolveHorde(strong, big, RULES, 6), C.resolveHorde(strong, big, RULES, 0));
  assert.equal(JSON.stringify(strong), JSON.stringify(built({ wall: 30, tower: 16, keep: 4, course: 40, gate: 8 })), 'the rally lifts the fight, not the castle');
});

test('rules.stage: stages are play, their score buys paint and nothing else, and the Keeper\'s hull comes from the evidence level', () => {
  const S = RULES.stage;
  assert.ok(S.view_w >= 150 && S.view_w <= 220 && S.tile >= 8);
  for (const [k, e] of Object.entries(S.enemies)) assert.ok(e.hp > 0 && e.speed > 0 && Number.isInteger(e.score) && e.score > 0, k);
  for (const [k, v] of Object.entries(S.score)) assert.ok(typeof v === 'number' && v >= 0, `score.${k}`);
  assert.ok(!JSON.stringify(S).match(/"(xp|cells|piece|part|wall|tower|keep)"/), 'nothing in the stage block names XP or a castle part');
  const K = S.keeper; assert.ok(K.hearts_base >= 1 && K.hearts_max >= K.hearts_base && K.levels_per_heart >= 1);
  const reach = K.jump * K.jump / (2 * K.gravity), across = 2 * K.jump / K.gravity * K.speed;
  assert.ok(reach >= 3 * S.tile, `a platform three tiles up is in reach: ${reach.toFixed(0)} px`); assert.ok(across >= 3.5 * S.tile, `a three-tile gap is in reach: ${across.toFixed(0)} px`);
  assert.equal(S.paints[0].at, 0, 'the first paint is free'); for (let i = 1; i < S.paints.length; i++) assert.ok(S.paints[i].at > S.paints[i - 1].at);
  for (const p of S.paints) { assert.match(p.colour, /^#[0-9A-Fa-f]{6}$/); assert.ok(p.slug && p.label); }
  for (const k of ['week', 'wilds', 'enter', 'clear', 'over', 'score', 'score_note', 'card', 'survey', 'gate_home', 'offline', 'locked']) assert.ok(RULES.bank.stage[k], `bank stage.${k}`);
  assert.ok(/never power/.test(RULES.bank.stage.score_note));
  assert.ok(!/\{(title|name)\}/.test(JSON.stringify(RULES.bank.stage)), 'a stage shows a week\'s position, never a title');
});

test('rules.save and rules.clock: a version, an autosave period, and the two clocks', () => {
  assert.equal(RULES.save.version, 2, 'the rework\'s save: no map, the castle is derived');
  assert.ok(RULES.save.autosave_seconds > 0 && RULES.save.autosave_seconds <= 60);
  assert.deepEqual([...RULES.clock.modes].sort(), ['demo', 'real']); assert.ok(RULES.clock.modes.includes(RULES.clock.default));
  assert.ok(Number.isInteger(RULES.horde.arrive_hour) && RULES.horde.arrive_hour >= 0 && RULES.horde.arrive_hour <= 23);
  for (const k of ['save_migrated', 'save_corrupt', 'save_old_game']) assert.ok(RULES.bank.castle[k], `bank castle.${k}`);
});

test('rules.states: the honest states, each with its words', () => {
  assert.deepEqual(RULES.states.kinds, ['live', 'unlit', 'dark', 'quiet']);
  for (const k of ['unlit', 'dark', 'quiet']) assert.ok(RULES.bank.states[k], `bank states.${k}`);
  assert.ok(RULES.states.dark_days >= 1);
});

test('rules.onboarding: three cards, each with a title and a body in the bank', () => {
  assert.deepEqual(RULES.onboarding.cards, ['castle', 'horde', 'stages']);
  for (const c of RULES.onboarding.cards) { assert.ok(RULES.bank.onboarding[c]?.title); assert.ok(RULES.bank.onboarding[c]?.body); }
});

test('rules.telemetry: the six local fields, their labels, and the sentence that says they stay', () => {
  assert.deepEqual(RULES.telemetry.fields, ['opens', 'session_seconds', 'closes_seen', 'stages_cleared', 'hordes_seen', 'regions_mapped']);
  for (const f of RULES.telemetry.fields) assert.ok(RULES.bank.telemetry[f], `bank telemetry.${f}`);
  assert.equal(RULES.bank.telemetry.note, 'Kept on this device, never sent.');
});

test('the superseded blocks are gone: no fortress map, no cells, no third-person field in the rules', () => {
  for (const k of ['fortress', 'explore', 'keeper_effects']) { assert.equal(RULES[k], undefined, k); assert.equal(RULES.bank[k], undefined, `bank.${k}`); }
  assert.ok(!/"cells"/.test(JSON.stringify(RULES)), 'no cells anywhere: a piece is laid, never bought');
});

// ── prototype 4: the page itself ────────────────────────────────────────────
const BUILD = await import('../prototype/build.mjs');
const SRC = BUILD.source();   // the page's source with the game's fragments (prototype/game/*.js) joined in, as build.mjs joins them
const scripts = (html) => [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
/** The source of one top-level function of the page, by name. */
const fn = (name) => { const a = SRC.indexOf(`\n  function ${name}(`); assert.ok(a >= 0, `function ${name}`); const eol = SRC.indexOf('\n', a + 1), first = SRC.slice(a + 1, eol); if (/\}\s*(\/\/.*)?$/.test(first)) return '\n' + first; const b = SRC.indexOf('\n  }\n', a); return SRC.slice(a, b); };   // a one-line function is its line

test('the built pages parse: every inline script of index.html and art-sheet.html compiles', () => {
  for (const f of ['prototype/index.html', 'prototype/art-sheet.html']) {
    const ss = scripts(read(f)); assert.ok(ss.length >= 3, f);
    for (const code of ss) assert.doesNotThrow(() => new vm.Script(code), f);
    assert.ok(!/\/\*__[A-Z]+__\*\//.test(read(f)), `${f}: no inline marker left`);
  }
  const art = read('prototype/art-sheet.html');
  assert.ok(art.includes(read('src/engine.js')) && art.includes(read('src/castle.js')) && art.includes(read('rules/fieldworks.json').trim()), 'the art sheet inlines the same engine, castle module and rules');
});

test('pillar 1 in the page: the castle comes from the evidence log in one place, and evidence enters in three', () => {
  const sets = SRC.split('\n').filter((l) => /\bCAS\s*=[^=]/.test(l));
  assert.equal(sets.length, 1, 'one line sets the castle'); assert.match(sets[0], /CAS = C\.castleOf\(st\.log, RULES\)/, 'and it is the fold over the engine\'s log');
  assert.ok(!/CAS\.(count|towers|pieces|wallHp|dps|beaconHp)(\.\w+|\[[^\]]+\])?\s*(\+\+|--|[+\-*]?=(?!=))/.test(SRC), 'nothing writes into the castle');
  const pushes = SRC.split('\n').filter((l) => /S\.events\.push\(/.test(l)).length;
  const inside = ['reset', 'loadSave', 'fire'].reduce((a, f) => a + (fn(f).match(/S\.events\.push\(/g) || []).length, 0);
  assert.ok(pushes > 0 && (SRC.match(/S\.events\.push\(/g) || []).length === inside, 'events are pushed only by the DEMO history, a replayed save and fire()');
  const fires = [...SRC.matchAll(/\bfire\(\[([^\]]*)\]/g)].map((m) => m[1]);
  assert.ok(fires.length >= 3); for (const f of fires) assert.match(f, /^(ev|lessonEvent\(p\.id, TODAY\)|liftEvent\(TODAY\))$/, `fire() carries evidence only: ${f}`);
  assert.match(fn('closeOrder'), /const ev = closeEvent\(o\);/, 'and that event is a finished order');
  // the DEMO's one stand-in, named: a waypoint's button ticks the lesson (the app opens the lesson instead); no key does it, and it needs a post
  assert.match(fn('survey'), /const p = ST && ST\.near; if \(!p \|\| !p\.id \|\| S\.ticks\.includes\(p\.id\)\) return;/);
  // embedded in a host app: the events are the host's, checked by the engine's own validator and assigned whole in one place; none is made here
  assert.equal((SRC.match(/\bS\.events = /g) || []).length, 1, 'one line replaces the event list');
  assert.match(fn('applyWorld'), /S\.events = w\.events;/); assert.match(fn('readWorld'), /const v = E\.validateEvents\(m\.events\); if \(v\.refused\.length\) return null;/);
  for (const [f, to] of [['closeOrder', 'workorders'], ['logLift', 'health'], ['survey', 'learning']]) {
    const body = fn(f), at = body.indexOf(`if (EMBED) { hostGo('${to}'); return; }`), made = body.search(/fire\(|S\.ticks\.push|S\.closed\.push|S\.liftsLogged\.push/);
    assert.ok(at > 0 && made > at, `${f}: embedded, it asks the host to open ${to} before any evidence could be made`);
  }
  assert.ok(!/fire\(|closeEvent|lessonEvent|liftEvent|S\.events\.push/.test(fn('applyWorld') + fn('readWorld') + fn('embedListen')), 'the embed\'s intake builds no event of its own');
  assert.ok(!/survey\(\)/.test(SRC.split('\n').filter((l) => /addEventListener\('keydown'/.test(l)).join('')), 'no key ticks a lesson');
  assert.ok(RULES.bank.stage.card_demo && /DEMO/.test(RULES.bank.stage.card_demo), 'and the card says it is the DEMO standing in');
});

// Everything a run does: the stage, the machines, the bosses, the upgrades, what play score opens. None of it may touch the evidence.
const PLAY_FNS = ['updateStage', 'finishStage', 'updateCastle', 'endFight', 'hurt', 'die', 'grow', 'arena', 'cache', 'newStage', 'updateFoes', 'updateBullets', 'updateMovers', 'updateBoss', 'bossHauler', 'bossEye', 'bossUndertow', 'startBoss', 'bossDown', 'bossReset',
  'award', 'kill', 'strike', 'shoot', 'crackHit', 'reachPost', 'relicFound', 'recalc', 'takeUpgrade', 'offerUpgrade', 'wildsBiomes'];
test('pillar 1 in the page: score is play. No line carries it into the evidence, XP or the castle', () => {
  const lines = SRC.split('\n');
  for (const l of lines) if (/score/i.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l)) assert.ok(!/S\.events|closeEvent|lessonEvent|liftEvent|setState\(|castleOf/.test(l) || /function |\/\/ /.test(l) && !/score[^;]*S\.events\.push/.test(l), `a score line touches the evidence: ${l.trim().slice(0, 90)}`);
  for (const f of PLAY_FNS) { const body = fn(f); assert.ok(!/S\.events|fire\(|setState\(|derive\(|S\.st\s*=|S\.ticks\.push|S\.closed\.push|S\.liftsLogged\.push/.test(body), `${f} never touches the evidence`); }
  assert.ok(!/\.xp\s*[+\-*]?=(?!=)/.test(SRC.replace(/hudEls\.xp/g, '')), 'no XP write outside the engine');
  assert.match(fn('kill'), /award\(RS\.enemies\[z\.type\]\.score, /, 'a stage kill pays play score'); assert.match(fn('award'), /ST\.score \+= n;/, 'and score is all award() adds to');
  assert.match(fn('bossDown'), /award\(RS\.bosses\.score, /, 'a boss pays play score: no item, no piece');
  // play powers play: lifetime play score is fed by runs and by the Keeper's kills at the wall, and what it opens is for play
  const lifeAdds = SRC.split('\n').filter((l) => /S\.play\.life \+= /.test(l));
  assert.equal(lifeAdds.length, 2); assert.ok(lifeAdds.some((l) => /S\.play\.life \+= score;/.test(l)) && lifeAdds.some((l) => /S\.play\.life \+= sum\.keeperDowned \* RS\.score\.horde_machine;/.test(l)), 'a run\'s score and the wall\'s score, nothing else');
  for (const l of lines) if (/S\.play\.|unlocked\(|RS\.meta|RS\.upgrades/.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l)) assert.ok(!/S\.events|closeEvent\(|lessonEvent\(|liftEvent\(|castleOf|setState\(|S\.st\s*=/.test(l) || /function (loadSave|reset)\b|\bS = \{ events/.test(l), `a play line touches the evidence: ${l.trim().slice(0, 100)}`);
  assert.deepEqual([...new Set(RULES.stage.meta.unlocks.map((u) => u.kind))].sort(), ['biome', 'move', 'slot', 'upgrade'], 'what play score opens: upgrades, a move, a slot, worlds. All for play');
  assert.ok(!/xp|level|item|piece|medal|rank/i.test(JSON.stringify(RULES.stage.meta.unlocks)), 'nothing it opens is XP, a level, an item or a castle piece');
  assert.ok(!/S\.play|unlocked\(|ST\./.test(fn('setState') + fn('moment') + fn('fire')), 'the evidence path never reads play');
  assert.match(fn('die'), /finishStage\(false\);/, 'a death ends the run');
  assert.ok(!/S\.play\.life\s*(-=|=(?!=)\s*0)|S\.play\.life--/.test(SRC.replace(/life: 0/g, '')), 'and nothing ever lowers the lifetime score: every unlock is kept');
  assert.match(fn('endFight'), /S\.play\.wall \+= sum\.keeperDowned \* RS\.score\.horde_machine/, 'the Keeper\'s kills at the wall pay play score');
  assert.match(fn('endFight'), /if \(sum\.outcome !== 'held'\) S\.horde\.dim = true;/, 'a breach sets one flag, and a held horde does not clear it');
  assert.match(fn('moment'), /const relit = !EMBED && S\.horde\.dim && pieces\.length > 0; if \(relit\) S\.horde\.dim = false;/, 'and only evidence clears it (embedded, the flag is the host\'s)');
  assert.equal((SRC.match(/S\.horde\.dim\s*=[^=]/g) || []).length, 2, 'the fight sets the flag and fire() clears it: nothing else writes it');
  for (const f of ['endFight', 'skipFight', 'showSummary']) assert.ok(!/S\.closed|S\.ticks|S\.liftsLogged|S\.events|S\.lastLevel|S\.shown/.test(fn(f)), `${f} takes nothing`);
});

test('the save holds no map and nothing the evidence can rebuild', () => {
  const snap = fn('snapshot');
  assert.match(snap, /journal: \{ closed: S\.closed\.slice\(\), ticks: S\.ticks\.slice\(\), lifts: S\.liftsLogged\.slice\(\), lastLevel: S\.lastLevel \}/);
  assert.ok(!/CAS|castle|map:|tiles|grid/.test(snap), 'the castle is never saved: it is derived');
  assert.match(fn('loadSave'), /const old = s && s\.version === 1;/, 'a version-1 save keeps its journal');
});

test('the update and render paths allocate nothing per frame (the HUD, four times a second, builds its strings)', () => {
  assert.match(fn('backdrop'), /if \(bg && bgKey\) return bg;/, 'the backdrop is painted once per theme and size');
  for (const f of ['updateCastle', 'renderCastle', 'updateStage', 'renderStage', 'updateFoes', 'updateBullets', 'updateMovers', 'updateBoss', 'bossHauler', 'bossEye', 'bossUndertow', 'renderBoss', 'drawWorld', 'drawAir', 'drawCastle', 'ground', 'tuft', 'text', 'stone', 'crenels', 'frame', 'burst', 'puff', 'pop', 'emit', 'ebullet', 'aim', 'strike', 'kill', 'hurt', 'shoot', 'jolt']) {
    const src = fn(f).replace(/\/\/.*$/gm, ''), body = src.slice(src.indexOf('{') + 1);
    const bad = body.match(/\.(map|filter|slice|concat|flatMap|reduce|forEach|split|join|find|some|every|includes)\(|\bnew \w|Array\.from|\[[^\]]*,[^\]]*\]\s*[;)]|=>|`|\bString\(|\.toUpperCase\(|\{ ?\w+: /g) || [];
    // the few allowed, each exactly as often as it stands today: the cached score and horde count, and a ticked-post lookup
    const allowed = { renderCastle: { 'String(': 1 }, renderStage: { 'String(': 1 } }[f] || {};
    const seen = {}; for (const b of bad) seen[b] = (seen[b] || 0) + 1;
    assert.deepEqual(seen, allowed, `${f}: ${bad.join(' ')}`);
  }
  assert.match(fn('renderStage'), /if \(ST\.score !== ST\.scoreSeen\)/, 'the score\'s text is rebuilt only when the score changes');
  assert.match(fn('renderCastle'), /if \(left !== CS\.left\)/, 'and the horde\'s count only when it changes');
});

test('pixels: canvas only, no image asset, a whole-number scale', () => {
  assert.ok(!/<img|new Image|\.png|\.jpg|\.gif|\.webp|data:image|url\(/i.test(SRC), 'no image asset anywhere');
  assert.match(SRC, /image-rendering: pixelated/); assert.match(fn('resize'), /sc = Math\.max\(1, Math\.round\(w \/ RS\.view_w\)\)/); assert.match(fn('resize'), /ctx\.imageSmoothingEnabled = false/);
  assert.equal((SRC.match(/fonts\.googleapis\.com/g) || []).length, 1, 'one stylesheet, the two faces');
});

test('storage: the page touches localStorage only through its helper, under exactly four keys', () => {
  assert.equal((SRC.match(/localStorage\./g) || []).length, 3, 'get, set and remove, in the helper');
  const keys = [...new Set(SRC.match(/'fieldworks-[a-z]+'/g))].sort();
  assert.deepEqual(keys, ["'fieldworks-keeper'", "'fieldworks-onboarded'", "'fieldworks-save'", "'fieldworks-telemetry'"]);
  // embedded, two keys of its own and no others: play only
  assert.deepEqual([...new Set(SRC.match(/'fieldworks-[a-z-]+'/g))].sort(), ["'fieldworks-embed-onboarded'", "'fieldworks-embed-play'", "'fieldworks-keeper'", "'fieldworks-onboarded'", "'fieldworks-save'", "'fieldworks-telemetry'"]);
  assert.match(SRC, /const KEYS = EMBED \? \{ keeper: '', save: 'fieldworks-embed-play', onboarded: 'fieldworks-embed-onboarded', telemetry: '' \}/, 'embedded: no name and no telemetry are kept');
  assert.match(fn('snapshot'), /if \(EMBED\) return \{ version: RULES\.save\.version, rules: RULES_HASH, play: S\.play \};/, 'and the embed\'s save is the play record alone');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|navigator\.share/.test(SRC), 'nothing is sent anywhere');
});

test('the bank: every sentence the page reads exists in the rules', () => {
  const refs = [...new Set([...SRC.matchAll(/BANK\.([a-z_]+)\.([a-z_]+)(?:\.([a-z_]+))?/g)].map((m) => m.slice(1).filter(Boolean).join('.')))];
  assert.ok(refs.length > 60, `${refs.length} references`);
  for (const r of refs) { const v = r.split('.').reduce((a, k) => (a == null ? a : a[k]), RULES.bank); assert.ok(v != null, `bank ${r}`); }
  // the sentences the game speaks about the castle, the horde and a stage are not typed into the page (comments and the dev bar's note aside)
  const SPOKEN = SRC.replace(/<span class="note">[\s\S]*?<\/span>/, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const phrase of ['would see it hold', 'holds as it stands', 'at the walls', 'Nothing was taken', 'Stage clear', 'never power', 'added to the castle']) assert.ok(!SPOKEN.includes(phrase), `"${phrase}" comes from the bank, not the page`);
});

test('the Pages site: the two pages, the faces and the build stamp only, noindex, nothing loaded from another origin, nothing walled', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const site = await import('../prototype/site.mjs');
  const out = mkdtempSync(join(tmpdir(), 'fieldworks-site-'));
  try {
    const COMMIT = 'c0ffee1234567890abcdef1234567890abcdef12';   // invented: the test never depends on the checkout it runs in
    const published = site.assemble(out, undefined, { commit: COMMIT });
    assert.deepEqual(published, ['index.html', 'art-sheet.html', 'version.json', ...site.FONT_FILES.map((f) => `fonts/${f}`)], 'the game, the art sheet, the build stamp and the faces; nothing else');
    assert.deepEqual(readdirSync(out).sort(), ['art-sheet.html', 'fonts', 'index.html', 'version.json']);
    const stampHtml = site.badge(site.versionInfo(site.siteVersion(RULES), COMMIT));
    const stampScript = site.versionScript(site.versionInfo(site.siteVersion(RULES), COMMIT));
    for (const page of site.PAGES) {
      const built = read(`prototype/${page}`), html = readFileSync(join(out, page), 'utf8');
      assert.equal(html.split(site.NOINDEX).length, 2, `${page}: one robots noindex`);
      assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html) && html.includes('<link rel="stylesheet" href="fonts/fonts.css">'), `${page}: the faces are local`);
      // the edits and nothing else: undo them and the built page comes back byte for byte
      assert.ok(html.startsWith(site.HEAD), `${page}: a doctype, lang and a UTF-8 charset first`);
      assert.equal(html.split(site.SIGNED_OUT).length, page === 'index.html' ? 2 : 1, `${page}: the signed-out flag on the game page only`);
      if (page === 'index.html') assert.ok(html.indexOf(site.SIGNED_OUT) < html.indexOf('<script id="rules"'), 'the flag is set before the page reads it');
      assert.equal(html.split(stampHtml).length, page === 'index.html' ? 2 : 1, `${page}: the version badge on the game page only`);
      assert.equal(html.split(stampScript).length, page === 'index.html' ? 2 : 1, `${page}: window.SITE_VERSION on the game page only`);
      assert.equal(html.split('site-version').length, page === 'index.html' ? 4 : 1, `${page}: one badge and its two style rules, or none of it`);
      const undone = html.slice(site.HEAD.length).replace(site.SIGNED_OUT, '').replace(stampScript, '').replace(stampHtml, '').replace(`\n${site.NOINDEX}`, '').replace('<link rel="stylesheet" href="fonts/fonts.css">', built.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">/)[0]);
      assert.equal(undone, built, `${page}: the site copy is the built page plus its edits`);
    }
    const css = readFileSync(join(out, 'fonts', 'fonts.css'), 'utf8');
    assert.deepEqual([...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]).sort(), ['albert-sans-latin.woff2', 'silkscreen-400-latin.woff2', 'silkscreen-700-latin.woff2'], 'fonts.css points only at the files beside it');
    for (const f of published.filter((p) => /\.(html|css|txt|json)$/.test(p))) assert.deepEqual(sweep(readFileSync(join(out, f), 'utf8')), [], `the wall sweep over the published ${f}`);
    // the guard itself: a page that would reach another origin is refused, and so is a second run into a full directory
    const page = read('prototype/index.html');
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', '<script src="https://example.org/x.js"></script><meta name="viewport"')), /another origin/);
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', '<style>@import "//example.org/x.css";</style><meta name="viewport"')), /another origin/);
    assert.throws(() => site.sitePage(page.replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/, '')), /one Google Fonts link/);
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', '<img srcset="https://example.org/a.png 2x">' + '<meta name="viewport"')), /another origin/, '<img srcset="https://example.org/a.png 2x">');
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', '<meta http-equiv="refresh" content="0;url=//example.org/">' + '<meta name="viewport"')), /another origin/, '<meta http-equiv="refresh" content="0;url=//example.org/">');
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', '<script>fetch("https://example.org/x")</script>' + '<meta name="viewport"')), /another origin/, '<script>fetch("https://example.org/x")</script>');
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', "<script>import('//example.org/m.js')</script>" + '<meta name="viewport"')), /another origin/, "<script>import('//example.org/m.js')</script>");
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', '<video poster="HTTPS://example.org/p.jpg"></video>' + '<meta name="viewport"')), /another origin/, '<video poster="HTTPS://example.org/p.jpg"></video>');
    assert.throws(() => site.sitePage(page.replace('<meta name="viewport"', '<script>new WebSocket("wss://example.org")</script>' + '<meta name="viewport"')), /another origin/, '<script>new WebSocket("wss://example.org")</script>');
    assert.throws(() => site.sitePage('<!doctype html>\n' + page), /bare page/);
    assert.throws(() => site.sitePage(page.replace('<script id="rules"', '<script id="rulez"'), { signedOut: true }), /rules script/);
    assert.throws(() => site.sitePage(page.replace('<div class="wrap">', '<div class="wrapper">'), { stamp: { version: '3', commit: null } }), /one wrap/);
    assert.throws(() => site.assemble(out), /not empty/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('the Pages site: version.json (site-version/1) and the badge say which build is live, and nothing else', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const site = await import('../prototype/site.mjs');
  const COMMIT = 'c0ffee1234567890abcdef1234567890abcdef12';
  const version = String(RULES.game.version);
  const DATE = '2026.11.26';
  const assembled = (commit, date = null) => {
    const out = mkdtempSync(join(tmpdir(), 'fieldworks-stamp-'));
    try { site.assemble(out, undefined, { commit, date }); return { raw: readFileSync(join(out, 'version.json'), 'utf8'), html: readFileSync(join(out, 'index.html'), 'utf8') }; }
    finally { rmSync(out, { recursive: true, force: true }); }
  };
  const badgeOf = (html) => { const m = html.match(/<div class="site-version" aria-hidden="true">([^<]*)<\/div>/g); assert.equal(m && m.length, 1, 'one badge'); return m[0].replace(/<[^>]*>/g, ''); };

  // the file: five keys, one line, the rules' own version, the commit whole, its date
  const a = assembled(COMMIT, DATE);
  assert.equal(a.raw, `{"schema":"site-version/1","app":"final-frontier","version":"${version}","commit":"${COMMIT}","date":"${DATE}"}\n`, 'the file, byte for byte');
  const info = JSON.parse(a.raw);
  assert.deepEqual(Object.keys(info), ['schema', 'app', 'version', 'commit', 'date'], 'no build time (one commit assembles one site), and nothing about the repo, the host or the run');
  assert.equal(info.version, version, 'the version is the rules\' game version'); assert.equal(site.siteVersion(RULES), version);
  assert.match(info.version, /^[0-9A-Za-z][0-9A-Za-z.+-]{0,39}$/);
  assert.equal(site.siteVersion({ game: { version: '3.1.0-rc.1+b2' } }), '3.1.0-rc.1+b2', 'read from the rules, not typed into the assembler');
  for (const bad of [undefined, null, NaN, {}, '', '<b>3</b>', '3 "x"', 'v'.repeat(41), '-3']) assert.throws(() => site.siteVersion({ game: { version: bad } }), /not a site version/, `a version of ${JSON.stringify(bad)} is refused`);
  assert.deepEqual(assembled(COMMIT, DATE), a, 'assembled twice from one commit: the same bytes');

  // the badge: `v<date> · <commit7>`; the commit alone with no date; `dev` with neither. The version is not shown.
  assert.equal(badgeOf(a.html), `v${DATE} \u00b7 ${COMMIT.slice(0, 7)}`);
  assert.equal(site.badgeText({ version: '3', commit: COMMIT, date: DATE }), 'v2026.11.26 \u00b7 c0ffee1');
  assert.equal(site.badgeText({ version: '3', commit: COMMIT, date: null }), 'c0ffee1');
  assert.equal(site.badgeText({ version: '3', commit: null, date: DATE }), 'dev', 'a date without its commit is not shown');
  const nd = assembled(COMMIT, null);
  assert.equal(JSON.parse(nd.raw).date, null, 'an unknown date is null'); assert.equal(badgeOf(nd.html), 'c0ffee1');
  for (const bad of ['2026-11-26', '2026.13.01', '2026.11.32', '1999.11.26', '2026.1.26', '2026.11.26\n', ' 2026.11.26', '<b>', 7, undefined]) {
    assert.equal(site.cleanDate(bad), null, `${JSON.stringify(bad)} is not a date`);
    assert.equal(assembled(COMMIT, bad).raw, nd.raw, `${JSON.stringify(bad)} never reaches version.json`);
  }
  const n = assembled(null, DATE);
  assert.equal(n.raw, `{"schema":"site-version/1","app":"final-frontier","version":"${version}","commit":null,"date":null}\n`, 'an unknown commit is null, never a placeholder, and so is its date');
  assert.equal(badgeOf(n.html), 'dev', 'and the badge says dev');
  assert.ok(!/unknown|undefined|null/.test(site.badge({ version, commit: null })), 'no placeholder word in the badge');
  // window.SITE_VERSION: set once, frozen, and its text is exactly the badge's
  for (const [c, d] of [[COMMIT, DATE], [COMMIT, null], [null, null]]) {
    const html = assembled(c, d).html, m = html.match(/<script>if\(!globalThis\.SITE_VERSION\)globalThis\.SITE_VERSION=Object\.freeze\((\{[^<]*\})\);<\/script>/g);
    assert.equal(m && m.length, 1, 'one SITE_VERSION line');
    const g = JSON.parse(m[0].match(/freeze\((\{.*\})\)/)[1]);
    assert.deepEqual(g, { app: 'final-frontier', version, commit: c, date: c ? d : null, text: badgeOf(html) }, 'the global says what the badge shows');
    const ctx = {}; new Function('globalThis', m[0].replace(/<\/?script>/g, ''))(ctx);
    assert.ok(Object.isFrozen(ctx.SITE_VERSION) && ctx.SITE_VERSION.text === badgeOf(html));
    const keep = { text: 'first' }; const ctx2 = { SITE_VERSION: keep }; new Function('globalThis', m[0].replace(/<\/?script>/g, ''))(ctx2);
    assert.equal(ctx2.SITE_VERSION, keep, 'never overwritten once set');
  }
  // the date is git's, for that commit: an id the checkout lacks has none, and HEAD's (when there is one) is a date
  assert.equal(site.siteDate(COMMIT, root), null, 'an invented commit has no date'); assert.equal(site.siteDate(null), null);

  // the badge is static: no script, no handler, no URL, not read aloud, not in the way of a tap, not printed
  const markup = site.badge({ version, commit: COMMIT });
  assert.ok(!/<script|javascript:|\bon[a-z]+\s*=|url\(|import|href|src|fetch|:\/\//i.test(markup), 'no script, handler or address in the badge');
  assert.deepEqual(markup.match(/<[a-z]+/g), ['<style', '<div'], 'a style rule and one element');
  assert.match(markup, /aria-hidden="true"/); assert.match(markup, /pointer-events:none/); assert.match(markup, /@media print\{\.site-version\{display:none\}\}/);
  assert.ok(!/position:fixed/.test(markup), 'it sits in the page\'s bottom padding and scrolls with it: never pinned over the game\'s controls');

  // the commit comes from the deploy and is checked: anything that is not a full lowercase id never reaches the file or the page
  assert.equal(site.siteCommit({ GITHUB_SHA: COMMIT }), COMMIT, 'the deploy\'s own commit');
  let head = null; try { const { execFileSync } = await import('node:child_process'); head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* not a checkout */ }
  if (!/^[0-9a-f]{40}$/.test(String(head))) head = null;
  if (head) assert.match(String(site.siteDate(head, root)), /^20\d{2}\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])$/, 'HEAD\'s own committer date, from git');
  const HOSTILE = ['"><script>alert(1)</script>', `${COMMIT}"`, `${COMMIT}<b>`, COMMIT.toUpperCase(), COMMIT.slice(0, 39), `${COMMIT}0`, `${COMMIT}\n`, ` ${COMMIT}`, 'unknown', '', '0'.repeat(39) + 'g'];
  for (const h of HOSTILE) {
    assert.equal(site.cleanCommit(h), null, `${JSON.stringify(h)} is not a commit`);
    assert.equal(site.siteCommit({ GITHUB_SHA: h }), head, `${JSON.stringify(h)}: the checkout's own HEAD, or null`);
    assert.equal(site.versionInfo(version, h, DATE).commit, null);
    assert.equal(site.siteDate(h, root), null);
    const r = assembled(h);
    assert.equal(r.raw, n.raw, `${JSON.stringify(h)} never reaches version.json`);
    assert.equal(r.html, n.html, `${JSON.stringify(h)} never reaches the page`);
  }
  for (const c of [undefined, null, 7, {}, [COMMIT]]) assert.equal(site.cleanCommit(c), null);
  assert.equal(site.siteCommit({}, tmpdir()) === null || /^[0-9a-f]{40}$/.test(site.siteCommit({}, tmpdir())), true, 'outside a checkout: null, and no throw');
  assert.equal(site.siteCommit({ GITHUB_SHA: 'x' }, join(root, 'no-such-directory')), null, 'a build that cannot ask git still assembles: null, and no throw');
  assert.throws(() => site.versionInfo('<3>', COMMIT), /not a site version/);
});

// ── version 3: the feel pass, in the rules ─────────────────────────────────
test('rules.stage (version 3): the moves, six machines brought in by degrees, three bosses, the worlds and hard mode', () => {
  const S = RULES.stage, B = RULES.bank;
  assert.equal(RULES.game.version, 3);
  const M = S.moves; for (const k of ['dash_speed', 'dash_s', 'dash_cooldown_s', 'dash_invulnerable_s', 'coyote_s', 'buffer_s', 'jump_cut', 'double_jump', 'charge_s', 'charge_damage', 'charge_speed']) assert.ok(M[k] > 0, `moves.${k}`);
  assert.ok(M.dash_speed > S.keeper.speed * 2 && M.dash_invulnerable_s >= M.dash_s && M.dash_cooldown_s > M.dash_s, 'a dash is fast, safe while it lasts, and then rests');
  assert.ok(M.charge_damage > S.keeper.shot_damage && M.coyote_s <= .15 && M.buffer_s <= .2);
  assert.deepEqual(Object.keys(S.enemies).sort(), ['brute', 'crawler', 'drone', 'hopper', 'turret', 'warden'], 'six kinds');
  const from = Object.values(S.enemies).map((e) => e.from); assert.ok(from.every((n) => Number.isInteger(n) && n >= 1) && Math.min(...from) === 1 && new Set(from).size >= 5, 'brought in by degrees, the first in week 1');
  for (const k of ['shot_every_s', 'shot_speed']) { assert.ok(S.enemies.drone[k] > 0); assert.ok(S.enemies.turret[k] > 0); }
  assert.ok(S.shots.tell_s >= .3, 'a shot is announced');
  assert.deepEqual(S.bosses.order, ['hauler', 'eye', 'undertow']);
  for (const k of S.bosses.order) { const D = S.bosses[k]; assert.ok(D.hp > 20 && D.w > 16 && D.h > 16 && D.phase2_at > 0 && D.phase2_at < 1, `boss ${k}`); for (const w of ['name', 'sign', 'intro', 'phase', 'down']) assert.ok(B.boss[k][w], `bank boss.${k}.${w}`); assert.match(B.boss[k].sign, /^[A-Z ]+$/, 'a sign is drawn in the pixel face'); }
  assert.ok(S.bosses.hauler.tell_s >= .4 && S.bosses.eye.tell_s >= .4 && S.bosses.eye.beam_tell_s >= .5 && S.bosses.undertow.rumble2_s >= .4, 'every attack is announced long enough to be learned');
  assert.ok(S.bosses.hauler.h < 3 * S.tile, 'a ledge three tiles up clears the Hauler\'s charge');
  assert.ok(S.bosses.arena_tiles * S.tile >= 220, 'an arena is wider than the widest view');
  assert.ok(S.biomes.list.length >= 4 && S.biomes.list[0].at === 0 && S.biomes.list[0].slug === S.biomes.home);
  for (const b of S.biomes.list) {
    for (const k of ['sun', 'far_light', 'far_dark', 'near_light', 'near_dark', 'feature_light', 'feature_dark', 'glow', 'top', 'top2', 'soil', 'soil2', 'slab', 'slab2', 'bloom']) assert.match(b[k], /^#[0-9a-f]{6}$/i, `${b.slug}.${k}`);
    assert.equal(b.sky_light.length, 5); assert.equal(b.sky_dark.length, 5); assert.ok(b.life.length >= 1 && ['trees', 'mesas', 'reeds', 'stacks', 'spires'].includes(b.feature));
    assert.ok(B.biome[b.slug].name && /^[A-Z ]+$/.test(B.biome[b.slug].sign) && RULES.audio.songs[b.song], `${b.slug}: a name, a sign and a song`);
  }
  assert.ok(new Set(S.biomes.weeks).size >= 4 && S.biomes.weeks.every((w) => S.biomes.list.some((b) => b.slug === w)), 'the weeks wear at least four worlds');
  assert.ok(S.hard.hearts === 1 && S.hard.speed > 1 && S.hard.score > 1, 'hard mode: one heart, faster machines, a bigger score');
  assert.ok(Number.isInteger(S.continues) && S.continues >= 0 && S.checkpoints_min >= 1 && S.checkpoint.heal >= 0);
  assert.ok(S.combo.window_s > 0 && S.combo.step > 0 && Number.isInteger(S.combo.cap));
  for (const k of ['hard', 'hard_note', 'checkpoint', 'restart', 'cache_open', 'relic', 'pad_dash', 'warning_sign', 'title_wilds', 'title_week']) assert.ok(B.stage[k], `bank stage.${k}`);
  assert.ok(/dash/i.test(B.castle.keys) && /charge/i.test(B.castle.keys) && /Shift|K\b/.test(B.castle.keys), 'the on-screen help names the new moves and their keys');
  assert.ok(B.story.fragments.length >= 6 && B.story.fragments.every((f) => typeof f === 'string' && f.length > 12), 'the story is fragments, from the bank');
});

test('rules.stage.upgrades and rules.stage.meta: a run\'s picks, and what lifetime play score opens for play', () => {
  const U = RULES.stage.upgrades, M = RULES.stage.meta, B = RULES.bank;
  assert.equal(U.offer, 3, 'one of three');
  assert.ok(U.list.length >= 9); assert.equal(new Set(U.list.map((u) => u.slug)).size, U.list.length); assert.equal(new Set(U.list.map((u) => u.code)).size, U.list.length);
  for (const u of U.list) { assert.match(u.code, /^[A-Z]{2}$/, `${u.slug}: a two-letter code for the HUD`); assert.ok(Number.isInteger(u.max) && u.max >= 1 && u.at >= 0); assert.ok(B.upgrade[u.slug].name && B.upgrade[u.slug].line, `bank upgrade.${u.slug}`); }
  assert.ok(U.list.filter((u) => u.at === 0).length >= U.offer, 'a new player is always offered three');
  for (const w of ['checkpoint', 'boss', 'perk']) assert.ok(B.upgrade.why[w]);
  const at = M.unlocks.map((u) => u.at); assert.ok(at.every((n, i) => n > 0 && (i === 0 || n > at[i - 1])), 'the thresholds climb');
  for (const u of M.unlocks) {
    assert.ok(B.meta.names[u.slug], `bank meta.names.${u.slug}`);
    if (u.kind === 'upgrade') assert.equal(U.list.find((x) => x.slug === u.slug).at, u.at, `${u.slug}: the pool and the track agree`);
    if (u.kind === 'biome') assert.equal(RULES.stage.biomes.list.find((x) => x.slug === u.slug).at, u.at, `${u.slug}: the world and the track agree`);
  }
  for (const u of U.list.filter((x) => x.at > 0)) assert.ok(M.unlocks.some((m) => m.slug === u.slug && m.kind === 'upgrade'), `${u.slug} is on the track`);
  for (const b of RULES.stage.biomes.list.filter((x) => x.at > 0)) assert.ok(M.unlocks.some((m) => m.slug === b.slug && m.kind === 'biome'), `${b.slug} is on the track`);
  assert.ok(M.unlocks.some((u) => u.slug === 'double_jump' && u.kind === 'move') && M.unlocks.some((u) => u.slug === 'perk' && u.kind === 'slot'));
  assert.ok(/only for play/i.test(B.meta.note) && /finished work/i.test(B.meta.note), 'the track says what it is not');
  assert.ok(/never power/.test(B.stage.score_note));
});

test('rules.audio: sound is data for a synth in code; every effect and song the page asks for exists', () => {
  const A = RULES.audio; assert.ok(A.volume > 0 && A.volume <= 1 && A.lookahead_ms > 0 && A.ahead_s > 0);
  for (const [k, d] of Object.entries(A.sfx)) { assert.ok(['square', 'sawtooth', 'triangle', 'sine', 'noise'].includes(d.wave) && d.s > 0 && d.vol > 0 && d.vol <= .3, `sfx.${k}`); if (d.notes) assert.match(d.notes, /^\d+( \d+)*$/); else assert.ok(d.from > 0 && d.to > 0, `sfx.${k}`); }
  for (const [k, s] of Object.entries(A.songs)) { assert.ok(s.bpm >= 60 && s.bpm <= 200 && s.vol > 0 && s.vol <= .1, `songs.${k}`); for (const line of [s.lead, s.bass]) { assert.match(line, /^\d+( \d+)*$/); assert.equal(line.split(' ').length, 32, `songs.${k}: two bars of sixteenths`); } }
  for (const need of ['jump', 'shot', 'charged', 'hit', 'kill', 'pickup', 'hurt', 'upgrade', 'boss', 'warning']) assert.ok(A.sfx[need], `the effect the brief names: ${need}`);
  for (const m of SRC.matchAll(/\bsfx\('([a-z]+)'\)/g)) assert.ok(A.sfx[m[1]], `sfx('${m[1]}') is in the rules`);
  for (const m of SRC.matchAll(/\bmusic\('([a-z]+)'/g)) assert.ok(A.songs[m[1]], `music('${m[1]}') is in the rules`);
  assert.ok(A.songs.boss && A.songs.castle && A.songs.warning);
  // no audio file, nothing before the first input, and a mute that is remembered
  assert.ok(!/<audio|new Audio|\.mp3\b|\.ogg\b|\.wav\b|decodeAudioData/.test(SRC), 'no audio file anywhere');
  assert.equal((SRC.match(/new AC\(\)/g) || []).length, 1); assert.match(fn('auUnlock'), /AU\.ctx = new AC\(\);/, 'the one AudioContext is made in auUnlock');
  const calls = SRC.split('\n').filter((l) => /auUnlock\(\)|, auUnlock,/.test(l) && !/function auUnlock/.test(l)); assert.ok(calls.length >= 3 && calls.every((l) => /pointerdown|keydown|closest\(|e\.preventDefault\(\); auUnlock\(\); if \(!PAD\.cv\) return;/.test(l)), 'and auUnlock is called only from an input handler');
  assert.match(fn('setMute'), /S\.play\.mute = !!on; .*saveNow\(\);/, 'mute is part of the play record, and saved');
  assert.match(SRC, /const CALM = matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches;/); assert.match(fn('jolt'), /if \(CALM\) return;/, 'reduced motion: no shake and no hit-stop');
});

// ── the embeddable build (embed/): the same code for a host app's frame ─────
const EMBED_FILES = ['play.html', 'play.js', 'play.css'];
test('the built files equal a rebuild: the two pages and embed/', () => {
  const out = BUILD.build();
  assert.equal(read('prototype/index.html'), out.index, 'prototype/index.html'); assert.equal(read('prototype/art-sheet.html'), out.art, 'prototype/art-sheet.html');
  assert.deepEqual(Object.keys(out.embed).sort(), EMBED_FILES.slice().sort()); assert.deepEqual(readdirSync(join(root, 'embed')).sort(), EMBED_FILES.slice().sort(), 'embed/ holds the three files and nothing else (the faces are copied beside it by the host)');
  for (const f of EMBED_FILES) assert.equal(read(`embed/${f}`), out.embed[f], `embed/${f}: run node prototype/build.mjs`);
  assert.ok(BUILD.gameFiles().length >= 8 && BUILD.gameFiles().every((f) => /^\d\d-[a-z-]+\.js$/.test(f)), 'the game is its fragments, in name order');
  for (const f of BUILD.gameFiles()) assert.doesNotThrow(() => new vm.Script(read(`prototype/game/${f}`)), `prototype/game/${f} parses on its own`);
});

test('embed/play.html: no inline script, its own policy with no connect-src, nothing from another host', () => {
  const html = read('embed/play.html');
  assert.ok(html.startsWith('<!doctype html>\n<html lang="en" class="embed">\n<meta charset="utf-8">'));
  assert.deepEqual([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => [m[0].startsWith('<script src="play.js">'), m[1]]), [[true, '']], 'one script, by src, with no body');
  assert.ok(!/\son[a-z]+\s*=|javascript:|<style|style="/i.test(html), 'no inline handler, style or javascript: URL');
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)[1]; assert.equal(csp, BUILD.EMBED_CSP);
  assert.equal(csp, "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self' blob:");
  assert.ok(!/connect-src|unsafe-eval|https?:|\*/.test(csp), 'no connect-src (default-src none stands), no eval, no other origin');
  assert.ok(html.includes('<meta name="robots" content="noindex">') && html.includes('name="viewport"'));
  assert.deepEqual([...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]), ['play.css', 'fonts/fonts.css', 'play.js'], 'three relative links: the styles, the faces, the script');
  const EXTERNAL = /\b(?:https?|wss?|ftp):\/\/[a-z0-9-]|(?:["'(=,]\s*|url=)\/\/[a-z0-9-]+\.[a-z]/gi;
  for (const f of EMBED_FILES) assert.equal(read(`embed/${f}`).match(EXTERNAL), null, `embed/${f} names no other host`);
  assert.ok(!new RegExp('fonts\\.googleapis|@' + 'import').test(read('embed/play.css')), 'the embed\'s styles ask no third party for a face');
  for (const f of EMBED_FILES) assert.deepEqual(sweep(read(`embed/${f}`)), [], `the wall sweep over embed/${f}`);
  assert.ok([...files(root)].some((f) => relative(root, f) === join('embed', 'play.js')), 'and the tree-wide sweep reads embed/ too');
});

test('embed/play.js: one classic script carrying the flag, the body, the rules, the engine, the castle module and the same game', () => {
  const js = read('embed/play.js');
  assert.doesNotThrow(() => new vm.Script(js));
  assert.ok(js.indexOf('globalThis.FIELDWORKS_EMBED = true;') >= 0 && js.indexOf('globalThis.FIELDWORKS_EMBED = true;') < js.indexOf('(function () {'), 'the flag is set at its top, before any code runs');
  assert.ok(js.includes(read('src/engine.js').trimEnd()) && js.includes(read('src/castle.js').trimEnd()) && js.includes(`globalThis.FIELDWORKS_RULES = ${read('rules/fieldworks.json').trim()};`), 'the engine, the castle module and the rules, byte for byte');
  const game = /<script>\n(\(\(\) => \{\n[\s\S]*?\n\}\)\(\);)\n<\/script>\s*$/.exec(SRC)[1]; assert.ok(js.includes(game), 'and the page\'s own game script, unchanged');
  // the body it builds: the page's, without the DEMO's chrome
  const body = JSON.parse(/globalThis\.FIELDWORKS_BODY = (".*");\n/.exec(js)[1]);
  for (const gone of ['class="dev"', 'seg-clock', 'id="reset"', 'class="ribbon"', 'SocialOS', 'bar-nav', 'homebtn', '<script']) assert.ok(!body.includes(gone), `the embed's body has no ${gone}`);
  for (const kept of ['id="phone"', 'id="screen"', 'id="overlay"', 'id="live"', 'id="i-fort"']) assert.ok(body.includes(kept), `the embed's body keeps ${kept}`);
  // it never reads its own URL (a srcdoc frame has none) and can call nowhere
  assert.ok(!/\blocation\b|document\.URL|document\.referrer|document\.cookie|document\.currentScript/.test(SRC), 'the game never reads a URL, a referrer or a cookie');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\bimport\(|new Worker|navigator\.serviceWorker/.test(js), 'and makes no network call');
  assert.match(fn('embedListen'), /if \(ev\.source !== window\.parent \|\| ev\.origin !== self\.origin\) return;/, 'a message is taken only from the parent, on this origin');
  assert.match(fn('hostPost'), /window\.parent\.postMessage\(msg, self\.origin\)/, 'and posted only to this origin');
  assert.equal((SRC.match(/postMessage\(/g) || []).length, 1, 'one postMessage in the page'); assert.equal((SRC.match(/addEventListener\('message'/g) || []).length, 1, 'one listener');
  assert.match(SRC, /const HOST_PLACES = \['workorders', 'learning', 'health', 'close'\];/);
});

test('the embed in the page\'s code: the host\'s world, never the DEMO; play only on the device; the pillars hold', () => {
  assert.match(SRC, /const EMBED = !!globalThis\.FIELDWORKS_EMBED;/); assert.ok(!/FIELDWORKS_EMBED = true/.test(read('prototype/index.html')), 'the page never sets the flag');
  assert.match(SRC, /let OUT = !!globalThis\.FIELDWORKS_SIGNED_OUT \|\| EMBED;/, 'embedded, the game starts signed out: reset() lays no DEMO evidence, order, lesson, lift or horde');
  assert.equal((SRC.match(/\bOUT = /g) || []).length, 2, 'OUT is set where it is declared and where a world is applied'); assert.match(fn('applyWorld'), /TODAY = w\.today; OUT = false; EMB\.state = 'world';/);
  for (const demo of ['PRIOR', 'OPEN0', 'TICKS0', 'HORDE0', 'QUESTS', 'DEMO_PLAN']) assert.ok(!new RegExp(`\\b${demo}\\b`).test(fn('applyWorld') + fn('readWorld') + fn('readOrder') + fn('readPlan') + fn('embedListen')), `the embed's intake never reads the DEMO's ${demo}`);
  assert.match(fn('applyWorld'), /S\.hordeKnown = !!w\.horde; S\.horde = w\.horde \|\| HORDE_NONE\(\);/, 'the horde is the host\'s, or none');
  assert.match(fn('advanceDays'), /if \(EMBED\) return;/); assert.match(fn('hordeNow'), /if \(EMBED\) return;/, 'the game runs no horde clock of its own when embedded');
  assert.match(SRC, /const hdate = \(\) => \(EMBED \? TODAY : /, 'the day is the host\'s');
  assert.match(fn('hordeLine'), /if \(EMBED && !OUT && !S\.hordeKnown\) return BANK\.horde\.unknown;/); assert.ok(RULES.bank.horde.unknown, 'a horde the host did not send is said, not guessed');
  for (const k of ['reading', 'none', 'unread']) { assert.ok(RULES.bank.embed[k] && RULES.bank.embed.head[k], `bank embed.${k}`); } assert.ok(RULES.embed.wait_ms >= 1000);
  const ls = fn('loadSave'), at = ls.indexOf('if (EMBED) {'), branch = ls.slice(at, ls.indexOf("return 'loaded';", at)).replace(/\/\/.*$/gm, '');
  assert.ok(at > 0 && at < ls.indexOf('const old = ') && !/S\.events|S\.horde|S\.ticks|S\.liftsLogged|S\.closed|journal/.test(branch), 'an embed save is read before any journal or horde, and is the play record alone');
  assert.match(fn('playOf'), /const q = \{ \.\.\.PLAY0\(\), best: p\.best, wilds: p\.wilds, paint: p\.paint, wall: p\.wall, /, 'and only known play fields are kept from it');
  // pillar 1, embedded: the castle still comes from the one fold; the world's intake sets no castle and pays nothing
  assert.ok(!/CAS\b|castleOf|\.xp\b|S\.play/.test(fn('readWorld') + fn('readOrder') + fn('readPlan')), 'reading a world touches neither the castle nor the play record');
  assert.match(fn('applyWorld'), /setState\(derive\(\)\)|moment\(before, null\)/, 'the castle is the fold over the host\'s events, through the same two functions');
});

test('the embed\'s intake, run: a good world is taken, anything malformed is refused whole, a name never crosses the wall', () => {
  // the page's own readers, lifted from its source and run against the real engine
  const box = { E, RULES, globalThis: null }; box.globalThis = box;
  const pick = (re) => { const m = re.exec(SRC); assert.ok(m, String(re)); return m[0]; };
  vm.runInNewContext([pick(/  const isInt = .*\n/), pick(/  const isDay = .*\n/), fn('validHorde') + '\n  }', pick(/  const isStr = .*\n/), pick(/  const NAME_FIELDS = .*\n/), fn('readOrder') + '\n  }', fn('readPlan') + '\n  }', pick(/  const hordeShape = .*\n/), fn('readWorld') + '\n  }', 'globalThis.readWorld = readWorld;'].join('\n'), box);
  const ev = (id, more = {}) => ({ id, kind: 'close', at: '2026-11-20', tier: 'public', zone: 'alpha', weight: 50, facts: { pn: 'P2' }, evidence: { kind: 'commit', ref: `demo/${id}` }, ...more });
  const world = (more = {}) => ({ fw: 1, type: 'world', today: '2026-12-01', theme: 'light', events: [ev('WO-401'), ev('WO-402')], open: [{ id: 'WO-410', written: '2026-10-01', pn: 'P1', options: 0, steps: 2, zone: 'alpha', tier: 'public', band: 'now' }, { id: 'sealed-1', written: '2026-10-02', tier: 'private' }],
    plan: { weeks: [{ n: 1, lessons: ['w1a', 'w1b'] }] }, horde: { day: 0, clock: { gather: 3, warned: null, due: null, count: 0, last: null, horde: null }, history: [], dim: false, arrived: null, fresh: null }, lanes: { workorders: true, learning: true, body: true }, ...more });
  const ok = box.readWorld(world());
  assert.ok(ok && ok.events.length === 2 && ok.open.length === 2 && ok.today === '2026-12-01' && ok.horde.clock.gather === 3);
  assert.deepEqual(Object.keys(ok.open[0]).sort(), ['band', 'id', 'options', 'pn', 'steps', 'tier', 'written', 'zone'], 'an order is its eight fields');
  assert.equal(JSON.stringify(E.siege(ok.open, RULES, ok.today).map((w) => w.zone).sort()), '["alpha","keep"]', 'and E.siege takes them as they are');
  assert.ok(box.readWorld(world({ horde: null })) && box.readWorld(world({ plan: null })).plan.weeks.length === 0, 'the horde and the plan may be null');
  assert.ok(box.readWorld(world({ briefing: { anything: [1, 2, 3] } })), 'a briefing is carried, never a reason to refuse');
  assert.equal(box.readWorld(world({ open: [{ id: 'WO-410', written: '2026-10-01', tier: 'public', title: 'a title' }] })).open[0].title, undefined, 'a public order\'s title is dropped: none is ever shown');
  const bad = { 'a private event with a name': world({ events: [ev('lesson/x', { kind: 'lesson', tier: 'private', zone: null, title: 'named' })] }), 'a private order with a name': world({ open: [{ id: 's', written: '2026-10-02', tier: 'private', name: 'named' }] }),
    'a duplicate id': world({ events: [ev('WO-401'), ev('WO-401')] }), 'an event without evidence': world({ events: [{ ...ev('WO-401'), evidence: null }] }), 'an order without a date': world({ open: [{ id: 'x', written: 'soon', tier: 'public' }] }),
    'a bad day': world({ today: '12/01/2026' }), 'a bad theme': world({ theme: 'sepia' }), 'no lanes': world({ lanes: null }), 'a lane that is not a boolean': world({ lanes: { workorders: 1, learning: true, body: true } }), 'a horde with a broken clock': world({ horde: { day: 0, clock: { gather: -1 }, history: [], dim: false, arrived: null, fresh: null } }),
    'a plan that is not weeks': world({ plan: { weeks: [{ n: 0, lessons: 'all' }] } }), 'another protocol version': world({ fw: 2 }), 'another type': world({ type: 'theme' }), 'events that are not a list': world({ events: {} }) };
  for (const [why, m] of Object.entries(bad)) assert.equal(box.readWorld(m), null, why);
  assert.equal(box.readWorld(null), null); assert.equal(box.readWorld('world'), null);
});

test('signed out (the public site): the page starts empty and hides what reads an account', () => {
  assert.match(SRC, /let OUT = !!globalThis\.FIELDWORKS_SIGNED_OUT \|\| EMBED;/);
  const r = fn('reset');
  for (const k of ['events: OUT ? [] : PRIOR.slice()', 'open: OUT ? [] : OPEN0()', 'ticks: OUT ? [] : TICKS0.slice()', 'liftsLogged: OUT ? [] : ', 'horde: OUT ? HORDE_NONE() : HORDE0()', 'if (!OUT) S.events.push({ id: `pace/']) assert.ok(r.includes(k), `reset: ${k}`);
  { const ls = fn('loadSave'), at = ls.indexOf('if (OUT) {'), branch = ls.slice(at, ls.indexOf("return 'loaded';", at));
    assert.ok(at > 0 && at < ls.indexOf('for (const id of j.closed)') && !/S\.events|S\.horde|S\.ticks|S\.liftsLogged|S\.closed/.test(branch), 'a signed-out save returns before the journal and the horde, touching neither'); }
  assert.match(fn('stageRows'), /if \(OUT\) return `\$\{wildsCard\}/, 'the Wilds only: the roadmap is the account\'s');
  assert.match(SRC, /if \(\(OUT \|\| EMBED\) && !\['castle', 'stage', 'stages', 'keeper'\]\.includes\(S\.screen\)\) S\.screen = 'castle';/, 'no backlog, Home, skills or archive');
  assert.match(SRC, /if \(OUT && n !== 0\) return;/, 'no roadmap stage by click either');
  assert.ok(RULES.bank.castle.signed_out && RULES.bank.castle.signed_out_short, 'the sentences are in the bank');
  // what hides the account's chrome, held here because CI never runs the walk
  assert.match(SRC, /html\.signed-out \.wrap > \.dev, html\.signed-out \.bar-nav, html\.signed-out \.ribbon \.pill\.lit \{ display: none !important; \}/, 'the prototype bar, Home and Create are hidden by CSS before any script runs');
  assert.match(SRC, /if \(OUT && !EMBED\) \{   \/\/ the account's chrome[^\n]*\n      document\.querySelector\('\.wrap > \.dev'\)\.style\.display = 'none'; document\.getElementById\('homebtn'\)\.parentElement\.style\.display = 'none';\n      document\.querySelector\('\.ribbon \.brand'\)\.textContent = 'Fieldworks'; document\.querySelector\('\.ribbon \.pill\.lit'\)\.style\.display = 'none';/, 'and again at start-up');
  const shell = fn('gameShell');
  assert.match(shell, /const strip = OUT \? \(mode === 'castle' \? `<button class="pri" data-go="stages">[^`]*<button data-go="keeper">[^`]*` : `<button data-go="castle">[^`]*`\)/, 'the signed-out strip: out the gate and the Keeper; in a stage, home');
  assert.ok(!/data-go="siege"/.test(shell.slice(0, shell.indexOf(': mode === '))), 'and no backlog button');
  assert.match(fn('needLine'), /if \(OUT\) return BANK\.castle\.signed_out_short;/);
  assert.match(fn('showStart'), /: OUT \? `<p><b>\$\{esc\(BANK\.castle\.signed_out\)\}<\/b><\/p>`/);
  assert.match(SRC, /if \(OUT\) TEL = \{ \.\.\.TEL0\(\), opens: TEL\.opens, session_seconds: TEL\.session_seconds \};/, 'no DEMO counts on the Keeper screen');
  assert.match(fn('loadSave'), /if \(validPlay\(s\.play\)\) \{ S\.play\.wilds = s\.play\.wilds;/, 'of an old play record, the Wilds alone');
  assert.ok(!/FIELDWORKS_SIGNED_OUT = true/.test(read('prototype/index.html')), 'the committed page (the DEMO) never sets the flag');
});

// ── FW2: gear by grade, the bounty (docs/FIELDWORKS.md §17, D52 and D61) ───────
const gdrop = (id, kind, extra = {}) => E.drop(ev({ id, kind, tier: 'public', weight: 50, facts: { pn: 'P2' }, ...extra }), RULES);

test('rules.gear: every kind an item can be has a slot, every grade a power, every slot a stat, a colour and a sentence', () => {
  const G = RULES.gear;
  assert.deepEqual(Object.keys(G.slots).sort(), Object.keys(RULES.rarity.kind_by_event).sort(), 'a slot for every kind of event that drops an item, sealed or not');
  assert.ok(Object.values(G.slots).every((s) => G.order.includes(s)) && G.order.every((s) => G.stats[s] && RULES.bank.gear.slots[s] && RULES.bank.gear.stats[G.stats[s].stat]));
  for (const g of RULES.rarity.grades) { assert.ok(G.power[g] >= 1 && /^#[0-9a-f]{6}$/i.test(G.colours[g]), g); }
  assert.deepEqual(RULES.rarity.grades.map((g) => G.power[g]), [1, 2, 3, 4, 5], 'stronger by grade, one step each');
  assert.ok(Object.values(G.stats).every((s) => s.per_power > 0 && (s.per_power * 5 < 0.25 || ['magnet', 'speed', 'inv'].includes(s.stat))), 'no slot at full grade is a different game');
  assert.ok(!/xp|level|piece/i.test(JSON.stringify(G.stats)), 'what gear does is for play: no XP, level or castle piece');
});

test('gear is the item\'s kind and grade, and nothing else: no play, no age, no clock', () => {
  const kinds = { close: 'blaster', task: 'visor', lesson: 'boots', lift: 'plating', decision: 'core' };
  for (const [k, slot] of Object.entries(kinds)) { const it = gdrop(`WO-${300 + k.length}`, k); const g = E.gearOf(it, RULES); assert.equal(g.slot, slot, k); assert.equal(g.power, RULES.gear.power[it.grade]); assert.equal(g.item, it.id); }
  const sealed = E.drop(ev({ id: 'x-1', kind: 'lift', tier: 'private', facts: { pn: 'P0' } }), RULES), sg = E.gearOf(sealed, RULES);
  assert.equal(sg.slot, 'plating', 'a sealed piece sits in the slot of the event that dropped it'); assert.equal(sg.name, null, 'a sealed piece of gear has no name'); assert.equal(sg.sealed, true);
  assert.ok(!/WO-|x-1/.test(JSON.stringify({ ...sg, item: undefined, key: undefined })), 'and nothing else of the event');
  // a higher grade is never weaker
  const plain = E.gearOf({ id: 'a', evKind: 'close', grade: 'plain' }, RULES), heir = E.gearOf({ id: 'b', evKind: 'close', grade: 'heirloom' }, RULES);
  assert.ok(heir.power > plain.power && plain.power === 1);
});

test('the loadout: the best of each slot unless chosen, an off slot carries nothing, an unknown choice falls back, and the archive is never touched', () => {
  const items = [
    { id: 'WO-901', evKind: 'close', grade: 'fine', name: 'Brass calipers', at: '2026-11-01' }, { id: 'WO-902', evKind: 'close', grade: 'masterwork', name: 'Brass transit', at: '2026-11-02' },
    { id: 'WO-903', evKind: 'close', grade: 'masterwork', name: 'Locked dividers', at: '2026-11-05' }, { id: 'lesson/w1a', evKind: 'lesson', grade: 'plain', name: 'Sketch', at: '2026-11-03' },
    { id: 'x', evKind: 'lift', kind: 'sealed', grade: 'tempered', name: null, sealed: true, at: '2026-11-04' }];
  const frozen = JSON.stringify(items);
  const auto = E.loadout(items, {}, RULES);
  assert.equal(auto.slots.blaster.gear.item, 'WO-903', 'the best, the later of two equals');
  assert.equal(auto.slots.visor.gear, null, 'nothing dropped for a slot, nothing carried');
  assert.equal(auto.slots.plating.gear.name, null, 'a sealed piece carries no name');
  assert.equal(auto.mods.fire_cd, RULES.gear.power.masterwork * RULES.gear.stats.blaster.per_power);
  const chosen = E.loadout(items, { blaster: E.hash('WO-901') }, RULES);
  assert.equal(chosen.slots.blaster.gear.item, 'WO-901'); assert.equal(chosen.slots.blaster.auto, false); assert.equal(chosen.slots.blaster.candidates.length, 3, 'every piece is still there to choose');
  assert.equal(E.loadout(items, { blaster: 'off' }, RULES).slots.blaster.gear, null); assert.equal(E.loadout(items, { blaster: 'off' }, RULES).mods.fire_cd, undefined);
  assert.equal(E.loadout(items, { blaster: 12345 }, RULES).slots.blaster.gear.item, 'WO-903', 'an unknown choice falls back to the best');
  assert.equal(JSON.stringify(items), frozen, 'equipping and unequipping never change, move or remove an item (pillar 2)');
  // gear can only be made of items the fold dropped: no items, no gear
  assert.ok(E.loadout([], {}, RULES).order === undefined && Object.values(E.loadout([], {}, RULES).slots).every((s) => s.gear === null) && Object.keys(E.loadout([], {}, RULES).mods).length === 0);
});

test('the bounty: oldest first, then the highest Pn, then the quickest, then the id; never a private order', () => {
  const o = (id, written, pn, extra = {}) => ({ id, written, pn, options: 0, steps: 3, tier: 'public', zone: 'a', ...extra });
  const T = '2026-11-20';
  assert.equal(E.bounty([], RULES, T), null);
  assert.equal(E.bounty([o('WO-310', '2026-11-10', 'P3'), o('WO-311', '2026-10-01', 'P3'), o('WO-312', '2026-10-20', 'P0')], RULES, T).id, 'WO-311', 'oldest beats a higher Pn');
  assert.equal(E.bounty([o('WO-320', '2026-10-01', 'P2'), o('WO-321', '2026-10-01', 'P0'), o('WO-322', '2026-10-01', 'P1')], RULES, T).id, 'WO-321', 'same age: the highest Pn');
  assert.equal(E.bounty([o('WO-330', '2026-10-01', 'P1', { steps: 5 }), o('WO-331', '2026-10-01', 'P1', { steps: 2 }), o('WO-332', '2026-10-01', 'P1', { steps: 9 })], RULES, T).id, 'WO-331', 'same age and Pn: the quickest');
  assert.equal(E.bounty([o('WO-340', '2026-10-01', 'P1', { steps: 4 }), o('WO-341', '2026-10-01', 'P1', { options: 3, steps: 0 })], RULES, T).id, 'WO-341', 'a decision is one step');
  assert.equal(E.bounty([o('WO-352', '2026-10-01', 'P1'), o('WO-351', '2026-10-01', 'P1')], RULES, T).id, 'WO-351', 'then the id');
  assert.equal(E.bounty([o('WO-360', '2026-10-01', 'P1', { tier: 'private' }), o('WO-361', '2026-11-18', null)], RULES, T).id, 'WO-361', 'a private order is never the bounty');
  assert.equal(E.bounty([o('WO-370', '2026-10-01', 'P1', { tier: 'private' })], RULES, T), null);
  assert.equal(E.bounty([o('WO-380', 'nope', 'P1')], RULES, T), null, 'a row without a date is skipped, never NaN');
  assert.equal(E.bounty([o('WO-390', '2026-10-01', 'P1')], RULES, 'bad'), null);
  const inA = [o('WO-310', '2026-10-01', 'P1'), o('WO-311', '2026-10-05', 'P0')], inB = inA.slice().reverse();
  assert.deepEqual(E.bounty(inA, RULES, T), E.bounty(inB, RULES, T), 'order of the list never matters');
  assert.ok(!('title' in E.bounty(inA, RULES, T)), 'it carries ids and counts, never a title');
});

test('the bounty bonus: added on the day, only for the bounty, never taken away, never for a sealed drop', () => {
  const close = (id, at, extra = {}) => ev({ id, kind: 'close', at, weight: 50, facts: { pn: 'P2', ageDays: 10 }, ...extra });
  const base = E.evaluate([close('WO-410', '2026-11-20')], RULES, '2026-11-20').items[0];
  const withB = E.evaluate([close('WO-410', '2026-11-20')], RULES, '2026-11-20', { bounties: [{ day: '2026-11-20', id: 'WO-410' }] }).items[0];
  assert.equal(withB.score - base.score, RULES.bounty.score_bonus); assert.equal(withB.bounty, true); assert.match(withB.receipt, /bounty/);
  assert.ok(RULES.rarity.grades.indexOf(withB.grade) >= RULES.rarity.grades.indexOf(base.grade), 'never lower');
  for (const other of [{ day: '2026-11-19', id: 'WO-410' }, { day: '2026-11-20', id: 'WO-411' }, { day: 'bad', id: 'WO-410' }, null]) assert.equal(E.evaluate([close('WO-410', '2026-11-20')], RULES, '2026-11-20', { bounties: [other] }).items[0].score, base.score, 'another day or another order: no bonus');
  assert.equal(E.evaluate([close('WO-410', '2026-11-20')], RULES, '2026-11-25').items[0].score, base.score, 'no ctx: the fold is what it always was');
  // the same close, later: the bonus stays (it is not a clock)
  assert.equal(E.evaluate([close('WO-410', '2026-11-20')], RULES, '2026-12-30', { bounties: [{ day: '2026-11-20', id: 'WO-410' }] }).items[0].score, withB.score);
  // a private close that day is sealed: its grade reads Pn alone, the bonus is not a leak
  const priv = (b) => E.evaluate([close('WO-411', '2026-11-20', { tier: 'private' })], RULES, '2026-11-20', { bounties: b ? [{ day: '2026-11-20', id: 'WO-411' }] : [] }).items[0];
  assert.equal(priv(true).score, priv(false).score); assert.equal(priv(true).bounty, false);
  // XP and the castle are the item's grade through the same fold: the bonus buys a better drop, never a different kind of thing
  assert.equal(E.evaluate([close('WO-410', '2026-11-20')], RULES, '2026-11-20', { bounties: [{ day: '2026-11-20', id: 'WO-410' }] }).log[0].kind, 'close');
});

test('the page: gear is a view of the archive and enters the run only through recalc; the bounty is journalled, the embed carries the host\'s pick', () => {
  assert.match(SRC, /const gearNow = \(\) => E\.loadout\(S\.st\.items, S\.play\.gear, RULES\);/, 'what is carried is read from the fold\'s items and the choice, nowhere else');
  assert.ok(!/S\.st\.items\.(push|splice|pop|shift)|S\.st\.items\s*=[^=]|S\.st\.items\.length\s*=/.test(SRC), 'no line writes the archive');
  assert.ok(!/\.items\.push/.test(SRC.replace(/st\.items\.push/g, '')), 'and no page code makes an item');
  const g = fn('gearMarks') + fn('drawGear') + fn('gearCard') + fn('gearChoice') + fn('todaysBounty');
  assert.ok(!/S\.events|closeEvent|fire\(|setState\(|derive\(|S\.st\s*=|\.xp\b|CAS\b/.test(g), 'gear and the bounty pick touch neither the evidence, XP nor the castle');
  assert.match(fn('recalc'), /const gm = gearNow\(\)\.mods;/); assert.ok(/ST\.mod\.inv/.test(fn('hurt')) && /ST\.mod\.speed/.test(SRC), 'gear reaches the run through ST.mod');
  assert.match(SRC, /E\.evaluate\(S\.events, RULES, TODAY, \{ plan: PLAN, bounties: S\.bounties \}\)/, 'the fold takes the day\'s pick as context, in the one place it runs');
  assert.match(fn('closeOrder'), /todaysBounty\(\);\s*\/\/[^\n]*\n\s*const ev = closeEvent\(o\);/, 'the pick is made and journalled before the close');
  assert.match(fn('todaysBounty'), /if \(EMBED\) return null;/, 'embedded, no pick is ever made locally: only the host\'s exists, so no bonus can later be lost');
  assert.ok(!/bounty_keep|\.slice\(-/.test(SRC.match(/const bountiesOf = .*\n/)[0] + JSON.stringify(RULES.save)), 'the journal never prunes a pick');
  assert.match(fn('applyWorld'), /S\.bounties = bountiesOf\(\[\.\.\.w\.bounties, \.\.\.\(w\.bounty \? \[w\.bounty\] : \[\]\)\]\);/, 'embedded, only the host\'s picks enter the fold');
  assert.match(fn('bountyCard'), /if \(EMBED && !S\.bounties\.some\(\(x\) => x\.day === TODAY\)\) return '';/, 'embedded with no host pick: no bounty card');
  assert.match(fn('gearChoice'), /Number\.isInteger\(v\)/, 'the choice is a hash, never an item id');
  assert.match(SRC, /play: S\.play, horde: S\.horde, bounties: S\.bounties \}/); assert.match(fn('snapshot'), /if \(EMBED\) return \{ version: RULES\.save\.version, rules: RULES_HASH, play: S\.play \};/, 'the embed still stores play only');
  assert.ok(/\[data-gear\]/.test(SRC) && !/data-gear[^\n]*(items|S\.events)/.test(fn('gearCard')), 'the buttons choose; nothing consumes');
});

test('the embed\'s intake takes a bounty and ignores a bad one (an optional field: every earlier message still reads)', () => {
  const box = { E, RULES, globalThis: null }; box.globalThis = box;
  const pick = (re) => { const m = re.exec(SRC); assert.ok(m, String(re)); return m[0]; };
  vm.runInNewContext([pick(/  const isInt = .*\n/), pick(/  const isDay = .*\n/), fn('validHorde') + '\n  }', pick(/  const isStr = .*\n/), pick(/  const NAME_FIELDS = .*\n/), fn('readOrder') + '\n  }', fn('readPlan') + '\n  }', pick(/  const hordeShape = .*\n/), fn('readWorld') + '\n  }', 'globalThis.readWorld = readWorld;'].join('\n'), box);
  const world = (more = {}) => ({ fw: 1, type: 'world', today: '2026-12-01', events: [], open: [{ id: 'WO-410', written: '2026-10-01', tier: 'public' }], plan: null, horde: null, lanes: { workorders: true, learning: true, body: true }, ...more });
  assert.equal(box.readWorld(world()).bounty, null, 'a world with no bounty reads exactly as before');
  assert.deepEqual(JSON.parse(JSON.stringify(box.readWorld(world({ bounty: { day: '2026-12-01', id: 'WO-410', title: 'x' } })).bounty)), { day: '2026-12-01', id: 'WO-410' }, 'two fields, nothing else');
  for (const bad of [{ day: 'x', id: 'WO-410' }, { day: '2026-12-01' }, 'WO-410', 7, []]) { const w = box.readWorld(world({ bounty: bad })); assert.ok(w && w.bounty === null, 'a malformed bounty is dropped, never a reason to refuse the world'); }
});

test('the bounty bonus is durable: re-evaluated long after any window it keeps its grade, and the fold takes only public orders', () => {
  const close = (id, at) => ev({ id, kind: 'close', at, weight: 50, facts: { pn: 'P2', ageDays: 10 } });
  const picks = []; for (let i = 0; i < 400; i++) picks.push({ day: `2025-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, id: `O-${i}` });
  picks.push({ day: '2026-10-01', id: 'WO-500' });
  const evs = [close('WO-500', '2026-10-01')];
  const a = E.evaluate(evs, RULES, '2026-10-01', { bounties: picks }).items[0], b = E.evaluate(evs, RULES, '2026-10-31', { bounties: picks }).items[0];
  assert.deepEqual([a.grade, a.score, a.bounty], [b.grade, b.score, b.bounty], '30 days later the same grade');
  assert.equal(E.evaluate(evs, RULES, '2026-10-31', { bounties: picks.slice(0, 14) }).items[0].bounty, false, 'the bonus depends on the pick being kept, which is why the journal never prunes it');
  assert.ok(!/slice\(-/.test(SRC.match(/const bountiesOf = .*\n/)[0]));
  const o = (id, tier) => ({ id, written: '2026-10-01', pn: 'P0', options: 0, steps: 1, tier });
  assert.equal(E.bounty([o('A', undefined), o('B', 'weird'), o('C', null)], RULES, '2026-11-20'), null, 'a missing or odd tier fails closed');
  assert.equal(E.bounty([o('A', undefined), o('Z', 'public')], RULES, '2026-11-20').id, 'Z');
  const q = (id, steps, options) => ({ id, written: '2026-10-01', pn: 'P1', steps, options, tier: 'public' });
  assert.equal(E.bounty([q('S2', 2, 0), q('S9', 9, 0), q('SN', NaN, 0)], RULES, '2026-11-20').id, 'SN', 'NaN steps count as one');
  assert.equal(E.bounty([q('A', 'abc', 0), q('B', 2.5, 0), q('C', 2, 'x')], RULES, '2026-11-20').id, 'A', 'non-integer steps/options count as one, then the id');
  assert.equal(E.bounty([q('D', 3, 'x'), q('E', 3, 2)], RULES, '2026-11-20').id, 'E', 'a decision is one step; "x" options are not options');
});
test('the embed takes bounties (plural), optional, with bounty still accepted', () => {
  const box = { E, RULES, globalThis: null }; box.globalThis = box;
  const pick = (re) => { const m = re.exec(SRC); assert.ok(m, String(re)); return m[0]; };
  vm.runInNewContext([pick(/  const isInt = .*\n/), pick(/  const isDay = .*\n/), fn('validHorde') + '\n  }', pick(/  const isStr = .*\n/), pick(/  const NAME_FIELDS = .*\n/), fn('readOrder') + '\n  }', fn('readPlan') + '\n  }', pick(/  const hordeShape = .*\n/), fn('readWorld') + '\n  }', 'globalThis.readWorld = readWorld;'].join('\n'), box);
  const world = (more = {}) => ({ fw: 1, type: 'world', today: '2026-12-01', events: [], open: [], plan: null, horde: null, lanes: { workorders: true, learning: true, body: true }, ...more });
  assert.deepEqual(JSON.parse(JSON.stringify(box.readWorld(world()).bounties)), []);
  const w = box.readWorld(world({ bounties: [{ day: '2026-11-01', id: 'A', x: 1 }, { day: 'bad', id: 'B' }, null, { day: '2026-11-02', id: 'C' }], bounty: { day: '2026-12-01', id: 'D' } }));
  assert.deepEqual(JSON.parse(JSON.stringify(w.bounties)), [{ day: '2026-11-01', id: 'A' }, { day: '2026-11-02', id: 'C' }]); assert.equal(w.bounty.id, 'D');
  assert.deepEqual(JSON.parse(JSON.stringify(box.readWorld(world({ bounties: 'nope' })).bounties)), [], 'a malformed list is ignored, never a refusal');
});
