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
const SRC = read('prototype/prototype.src.html');
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
  assert.match(fn('survey'), /const p = ST && ST\.near; if \(!p \|\| S\.ticks\.includes\(p\.id\)\) return;/);
  assert.ok(!/survey\(\)/.test(SRC.split('\n').filter((l) => /addEventListener\('keydown'/.test(l)).join('')), 'no key ticks a lesson');
  assert.ok(RULES.bank.stage.card_demo && /DEMO/.test(RULES.bank.stage.card_demo), 'and the card says it is the DEMO standing in');
});

test('pillar 1 in the page: score is play. No line carries it into the evidence, XP or the castle', () => {
  const lines = SRC.split('\n');
  for (const l of lines) if (/score/i.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l)) assert.ok(!/S\.events|closeEvent|lessonEvent|liftEvent|setState\(|castleOf/.test(l) || /function |\/\/ /.test(l) && !/score[^;]*S\.events\.push/.test(l), `a score line touches the evidence: ${l.trim().slice(0, 90)}`);
  for (const f of ['updateStage', 'finishStage', 'updateCastle', 'endFight', 'hurt', 'grow', 'newStage']) { const body = fn(f); assert.ok(!/S\.events|fire\(|setState\(|derive\(|S\.st\s*=|S\.ticks\.push|S\.closed\.push|S\.liftsLogged\.push/.test(body), `${f} never touches the evidence`); }
  assert.ok(!/\.xp\s*[+\-*]?=(?!=)/.test(SRC.replace(/hudEls\.xp/g, '')), 'no XP write outside the engine');
  assert.match(fn('updateStage'), /ST\.score \+= RS\.enemies\[z\.type\]\.score/, 'a stage kill pays play score');
  assert.match(fn('endFight'), /S\.play\.wall \+= sum\.keeperDowned \* RS\.score\.horde_machine/, 'the Keeper\'s kills at the wall pay play score');
  assert.match(fn('endFight'), /if \(sum\.outcome !== 'held'\) S\.horde\.dim = true;/, 'a breach sets one flag, and a held horde does not clear it');
  assert.match(fn('fire'), /if \(relit\) S\.horde\.dim = false;/, 'and only evidence clears it');
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
  for (const f of ['updateCastle', 'renderCastle', 'updateStage', 'renderStage', 'drawCastle', 'ground', 'text', 'stone', 'crenels', 'frame', 'burst', 'pop']) {
    const src = fn(f).replace(/\/\/.*$/gm, ''), body = src.slice(src.indexOf('{') + 1);
    const bad = body.match(/\.(map|filter|slice|concat|flatMap|reduce|forEach|split|join|find|some|every|includes)\(|\bnew \w|Array\.from|\[[^\]]*,[^\]]*\]\s*[;)]|=>|`|\bString\(|\.toUpperCase\(|\{ ?\w+: /g) || [];
    // the few allowed, each exactly as often as it stands today: the cached score and horde count, and a ticked-post lookup
    const allowed = { renderCastle: { 'String(': 1 }, renderStage: { 'String(': 1, '.includes(': 1 } }[f] || {};
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

test('the Pages site: the two pages and the faces only, noindex, nothing loaded from another origin, nothing walled', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const site = await import('../prototype/site.mjs');
  const out = mkdtempSync(join(tmpdir(), 'fieldworks-site-'));
  try {
    const published = site.assemble(out);
    assert.deepEqual(published, ['index.html', 'art-sheet.html', ...site.FONT_FILES.map((f) => `fonts/${f}`)], 'the game, the art sheet and the faces; nothing else');
    assert.deepEqual(readdirSync(out).sort(), ['art-sheet.html', 'fonts', 'index.html']);
    for (const page of site.PAGES) {
      const built = read(`prototype/${page}`), html = readFileSync(join(out, page), 'utf8');
      assert.equal(html.split(site.NOINDEX).length, 2, `${page}: one robots noindex`);
      assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html) && html.includes('<link rel="stylesheet" href="fonts/fonts.css">'), `${page}: the faces are local`);
      // the edits and nothing else: undo them and the built page comes back byte for byte
      assert.ok(html.startsWith(site.HEAD), `${page}: a doctype, lang and a UTF-8 charset first`);
      assert.equal(html.split(site.SIGNED_OUT).length, page === 'index.html' ? 2 : 1, `${page}: the signed-out flag on the game page only`);
      if (page === 'index.html') assert.ok(html.indexOf(site.SIGNED_OUT) < html.indexOf('<script id="rules"'), 'the flag is set before the page reads it');
      const undone = html.slice(site.HEAD.length).replace(site.SIGNED_OUT, '').replace(`\n${site.NOINDEX}`, '').replace('<link rel="stylesheet" href="fonts/fonts.css">', built.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">/)[0]);
      assert.equal(undone, built, `${page}: the site copy is the built page plus its edits`);
    }
    const css = readFileSync(join(out, 'fonts', 'fonts.css'), 'utf8');
    assert.deepEqual([...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]).sort(), ['albert-sans-latin.woff2', 'silkscreen-400-latin.woff2', 'silkscreen-700-latin.woff2'], 'fonts.css points only at the files beside it');
    for (const f of published.filter((p) => /\.(html|css|txt)$/.test(p))) assert.deepEqual(sweep(readFileSync(join(out, f), 'utf8')), [], `the wall sweep over the published ${f}`);
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
    assert.throws(() => site.assemble(out), /not empty/);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('signed out (the public site): the page starts empty and hides what reads an account', () => {
  assert.match(SRC, /const OUT = !!globalThis\.FIELDWORKS_SIGNED_OUT;/);
  const r = fn('reset');
  for (const k of ['events: OUT ? [] : PRIOR.slice()', 'open: OUT ? [] : OPEN0()', 'ticks: OUT ? [] : TICKS0.slice()', 'liftsLogged: OUT ? [] : ', 'horde: OUT ? HORDE_NONE() : HORDE0()', 'if (!OUT) S.events.push({ id: `pace/']) assert.ok(r.includes(k), `reset: ${k}`);
  assert.match(fn('loadSave'), /if \(OUT\) \{ if \(validPlay\(s\.play\)\) S\.play = s\.play; return 'loaded'; \}/, 'a signed-out save replays no journal and no horde, only play');
  assert.match(fn('stageRows'), /if \(OUT\) return `\$\{wildsCard\}/, 'the Wilds only: the roadmap is the account\'s');
  assert.match(SRC, /if \(OUT && !\['castle', 'stage', 'stages', 'keeper'\]\.includes\(S\.screen\)\) S\.screen = 'castle';/, 'no backlog, Home, skills or archive');
  assert.match(SRC, /if \(OUT && n !== 0\) return;/, 'no roadmap stage by click either');
  assert.ok(RULES.bank.castle.signed_out && RULES.bank.castle.signed_out_short, 'the sentences are in the bank');
  assert.ok(!/FIELDWORKS_SIGNED_OUT = true/.test(read('prototype/index.html')), 'the committed page (the DEMO) never sets the flag');
});
