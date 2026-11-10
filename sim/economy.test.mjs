// The economy sim on an invented fixture (node --test sim/economy.test.mjs).
// The board's parser is imported from an alys checkout beside this repo (or
// FIELDWORKS_ALYS); without one, the tests skip and say why — CI has none.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as S from './economy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ALYS = resolve(process.env.FIELDWORKS_ALYS || join(here, '..', '..', 'alys'));
const HAVE = existsSync(join(ALYS, 'scripts', 'tasks', 'build.mjs'));
const skip = HAVE ? false : `no alys checkout at ${ALYS} (the parser is imported from there, never copied here)`;
const TODAY = '2026-11-09';
const md = readFileSync(join(here, 'fixture', 'Fixture_Tasks.md'), 'utf8');
const index = JSON.parse(readFileSync(join(here, 'fixture', 'projects.json'), 'utf8'));
const rules = JSON.parse(readFileSync(join(here, '..', 'rules', 'fieldworks.json'), 'utf8'));

async function run() {
  const P = await S.loadParser(ALYS); const E = S.loadEngine();
  const { rows, stats } = S.extract(md, TODAY, index, P, null);
  const sim = S.simulate(rows, rules, TODAY, E);
  const tuning = JSON.parse(readFileSync(join(here, 'tuning.json'), 'utf8')).changes;
  const runs = [0, tuning.length].map((n) => S.targets(S.simulate(rows, S.applyTuning(rules, tuning, n), TODAY, E), S.applyTuning(rules, tuning, n)));
  const report = S.renderReport({ sim, rules, stats, sha: 'f'.repeat(40), ref: 'fixture', tuning, tuningRuns: [runs[0], ...tuning.map(() => runs[1])], alysRef: 'fixture' });
  return { rows, stats, sim, report };
}

test('the sim is deterministic on the fixture: the same file, the same report', { skip }, async () => {
  const a = await run(); const b = await run();
  assert.equal(a.report, b.report);
  assert.equal(a.sim.days.length, 60);
});

test('a Back Office open row and a back-office Done row come out as counts, never ids', { skip }, async () => {
  const { rows, stats } = await run();
  assert.equal(stats.privateOpen, 1, 'the open Back Office block is one private count');
  assert.equal(stats.privateDone, 1, 'the Done row stamped Project: back-office is one private count');
  const priv = rows.filter((r) => r.tier === 'private');
  assert.deepEqual(priv.map((r) => r.id).sort(), ['private-1', 'private-2']);
  for (const r of priv) { assert.equal(r.zone, null); assert.equal(r.options, 0); assert.equal(r.steps, 0); assert.equal(r.weight, null); }
});

test('no title, step or option text survives the parse; a private title is counted and never printed', { skip }, async () => {
  const { rows, report } = await run();
  const kept = JSON.stringify(rows);
  for (const word of ['SECRET-FIXTURE', 'hinge', 'paint', 'errand', 'attic', 'green', 'example.com']) {
    assert.ok(!kept.includes(word), `the rows keep no text: ${word}`);
    assert.ok(!report.includes(word), `the report prints no text: ${word}`);
  }
  for (const r of rows) assert.deepEqual(Object.keys(r).sort(), ['band', 'difficulty', 'done', 'id', 'options', 'pn', 'steps', 'tier', 'weight', 'written', 'zone']);
});

test('the report carries no order id and no section heading', { skip }, async () => {
  const { report } = await run();
  assert.ok(!/WO-/.test(report), 'not one WO- token');
  for (const s of ['Workshop', 'Back Office', 'Open', 'Done']) assert.ok(!report.includes(`### ${s}`) && !report.includes(s === 'Workshop' ? s : `## ${s}\n`), `no section: ${s}`);
  assert.throws(() => S.guardReport('a line naming WO-904', md, index), /order id/);
  assert.throws(() => S.guardReport('the Workshop section', md, index), /section/);
});

test('the five targets are computed, each with a number, never asserted', { skip }, async () => {
  const { sim } = await run();
  const t = S.targets(sim, rules);
  assert.deepEqual(t.map((x) => x.key), ['piece', 'growth', 'cadence', 'ready', 'level']);
  for (const x of t) { assert.equal(typeof x.met, 'boolean'); assert.ok(x.value !== undefined); }
  // the fixture is thin: it should not meet everything, which shows the targets are measured
  assert.ok(t.some((x) => !x.met), 'a three-order fixture does not meet every target');
});

test('the sim\'s castle is the castle module\'s fold over the engine\'s log, day by day, and never falls', { skip }, async () => {
  const { sim } = await run(); const C = S.loadCastle();
  const last = sim.days.at(-1);
  assert.deepEqual({ ...C.castleFrom(last.count, last.total, rules) }.wallHp, last.wallHp);
  assert.equal(sim.days.reduce((a, d) => a + d.pieces, 0), last.total, 'every piece was laid on a day');
  for (let i = 1; i < sim.days.length; i++) { assert.ok(sim.days[i].total >= sim.days[i - 1].total); assert.ok(sim.days[i].wallHp >= sim.days[i - 1].wallHp); assert.ok(sim.days[i].dps >= sim.days[i - 1].dps); }
  assert.equal(S.targets(sim, rules)[1].fell, 0);
  const sum = (k) => sim.days.reduce((a, d) => a + d[k], 0);
  assert.equal(last.count.course, sum('lessons'), 'a lesson is a course of stone'); assert.equal(last.count.gate, sum('lifts'), 'a lift is a gate brace');
  assert.equal(last.count.keep, sum('decisions'), 'a decision is a keep level'); assert.equal(last.total, sum('lessons') + sum('lifts') + sum('decisions') + sum('closes'), 'one piece per evidence event, and none from anything else');
});

test('a horde in the sim is warned, then fought by the castle on its own, and the report tables it without an id', { skip }, async () => {
  const P = await S.loadParser(ALYS); const E = S.loadEngine();
  const { rows } = S.extract(md, TODAY, index, P, null);
  // a rules copy whose clock fills fast, so the thin fixture meets hordes
  const r = JSON.parse(JSON.stringify(rules)); r.horde.threshold = 4; r.horde.gather_cap_per_day = 4;
  const sim = S.simulate(rows, r, TODAY, E);
  assert.ok(sim.hordes.length >= 2, `${sim.hordes.length} hordes`);
  const lead = Math.round(r.horde.warning_hours / 24);
  for (const h of sim.hordes) { assert.equal(h.arrivedDay - h.warnedDay, lead); assert.ok(['held', 'breached', 'dark'].includes(h.outcome)); assert.ok(['held', 'breached', 'dark'].includes(h.forecast)); assert.ok(h.tasks === null || (h.tasks >= 0 && h.tasks <= r.horde.warning.max_tasks)); assert.ok(h.landed >= 0); }
  for (let i = 1; i < sim.hordes.length; i++) assert.ok(sim.hordes[i].arrivedDay - sim.hordes[i - 1].arrivedDay >= r.horde.min_gap_days);
  const C = S.loadCastle();
  sim.hordes.forEach((h, i) => { const d = sim.days[h.arrivedDay - 1], w = sim.days[h.warnedDay - 1]; assert.equal(h.landed, d.total - w.total, 'landed is the pieces between the warning and the arrival');
    const sized = C.hordeOf(w.attackers, w.engines, i, r); assert.equal(h.n, sized.n, 'the horde is the one sized at its warning'); assert.equal(h.bosses, sized.bosses);
    assert.equal(h.forecast, C.readiness(C.castleFrom(w.count, w.total, r), sized, r, 0).forecast.outcome, 'the forecast is for the horde that arrives');
    assert.ok(['none', 'under 10', '10 or more'].includes(h.band));
    const again = C.resolveHorde(C.castleFrom(d.count, d.total, r), sized, r, h.landed); assert.equal(again.outcome, h.outcome, 'the outcome is the castle of that day, rallied by what landed, against that day\'s horde'); assert.equal(again.wallLeft, h.wallLeft); assert.equal(h.rally, Math.round((C.rallyOf(h.landed, r) - 1) * 100), 'the fight carries the rally of what landed'); });
  assert.ok(sim.hordes.some((h) => h.landed > 0 && h.rally > 0), 'at least one horde of the fixture is met with a rally');
  const closes = S.simulate(rows, r, TODAY, E, 60, { closesOnly: true });
  assert.deepEqual(closes.hordes.map((h) => h.arrivedDay), sim.hordes.map((h) => h.arrivedDay), 'the horde\'s clock is the backlog\'s: the stated cadence does not move it');
  assert.ok(closes.days.at(-1).total < sim.days.at(-1).total, 'closes alone build less than closes and the cadence');
  assert.equal(closes.days.reduce((a, d) => a + d.lessons + d.lifts, 0), 0, 'the closes-only run carries no stated lesson or lift');
  const report = S.renderReport({ sim, rules: r, stats: (await run()).stats, sha: 'f'.repeat(40), ref: 'fixture', tuning: [], tuningRuns: [S.targets(sim, r)], alysRef: 'fixture', closesOnly: { sim: closes, targets: S.targets(closes, r) } });
  assert.match(report, /## The hordes/); for (const row of report.split('\n').filter((l) => /^\| \d+ \| \d+ \| \d+ \| \d+ \| (held|breached|dark) \|/.test(l))) { const cells = row.split('|').map((c) => c.trim()); assert.ok(['none', 'under 10', '10 or more'].includes(cells[7]), `pieces landed is a band, never a count: ${cells[7]}`); assert.ok(!/\+\d+%/.test(row), 'and no rally percentage, which would give the count back'); } assert.match(report, /On real closes alone/); assert.ok(!/WO-/.test(report));
  S.guardReport(report, md, index);
});

test('the tuning record ends where the rules file is', () => {
  const tuning = JSON.parse(readFileSync(join(here, 'tuning.json'), 'utf8')).changes;
  const get = (o, k) => k.split('.').reduce((a, x) => (a == null ? a : a[x]), o);
  for (const t of tuning) assert.deepEqual(get(rules, t.key), t.after, t.key);
  const v1 = S.applyTuning(rules, tuning, 0);
  for (const t of tuning) assert.deepEqual(get(v1, t.key) ?? null, t.before, `${t.key} restores to before`);
});

test('the script refuses to run without --alys', () => {
  const r = spawnSync(process.execPath, [join(here, 'economy.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 2); assert.match(r.stderr, /--alys/);
});

test('target 3 (the cadence) fails a horde that came unannounced, two inside the gap, or too many in thirty days', () => {
  const day = (n, o = {}) => ({ date: '2026-11-01', day: n, pieces: 1, towerPoints: 0, total: n, wallHp: 40, dps: 0, count: { wall: 0, tower: 0, keep: 0, course: n, gate: 0, lamp: 0 }, xp: 0, level: 0, closes: 0, decisions: 0, lessons: 1, lifts: 0, attackers: 30, engines: 0, gather: 0, warned: false, arrived: false, regions: 0, ...o });
  const mk = (hordes) => ({ from: '2026-10-01', to: '2026-11-29', days: Array.from({ length: 60 }, (_, i) => day(i + 1)), hordes, pending: null });
  const h = (warnedDay, arrivedDay, o = {}) => ({ warnedDay, arrivedDay, n: 12, bosses: 0, forecast: 'held', tasks: 0, landed: 0, band: 'none', rally: 0, outcome: 'held', wallLeft: 100, ...o });
  const lead = Math.round(rules.horde.warning_hours / 24), gap = rules.horde.min_gap_days;
  const T = (hs) => S.targets(mk(hs), rules);
  assert.equal(T([h(10, 10 + lead), h(30, 30 + lead), h(50, 50 + lead)])[2].met, true, 'three in sixty days, each announced');
  assert.equal(T([h(null, 13), h(30, 30 + lead)])[2].met, false, 'one came unannounced');
  assert.equal(T([h(11, 13), h(30, 30 + lead)])[2].met, false, 'one was announced late');
  assert.equal(T([h(10, 10 + lead), h(10 + gap - 2, 10 + lead + gap - 2), h(40, 40 + lead)])[2].met, false, 'two inside the gap');
  assert.equal(T([h(10, 10 + lead)])[2].met, false, 'fewer than one in thirty days');
  assert.equal(T(Array.from({ length: 7 }, (_, i) => h(1 + i * 8, 1 + i * 8 + lead)))[2].met, false, 'more than three in thirty days');
  // target 4: every horde can be held from its warning, and at least one asks for something
  assert.equal(T([h(10, 13), h(30, 33)])[3].met, false, 'none asked for anything: a formality');
  assert.equal(T([h(10, 13), h(30, 33, { forecast: 'breached', tasks: 3 })])[3].met, true);
  assert.equal(T([h(10, 13, { forecast: 'dark', tasks: null }), h(30, 33, { tasks: 2 })])[3].met, false, 'one was past the cap at its warning');
});
