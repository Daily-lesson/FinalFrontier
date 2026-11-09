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
  for (const word of ['SECRET-FIXTURE', 'hinge', 'paint', 'errand', 'floor', 'green', 'example.com']) {
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

test('the four targets are computed, each with a number, never asserted', { skip }, async () => {
  const { sim } = await run();
  const t = S.targets(sim, rules);
  assert.equal(t.length, 4);
  for (const x of t) { assert.equal(typeof x.met, 'boolean'); assert.ok(x.value !== undefined); }
  // the fixture is thin: it should not meet everything, which shows the targets are measured
  assert.ok(t.some((x) => !x.met), 'a three-order fixture does not meet every target');
});

test('cells come from the cache rules alone: by kind for a lesson or lift, by the drop grade for a close', () => {
  const F = rules.fortress;
  assert.deepEqual(S.cacheFor({ kind: 'lesson' }, { grade: 'heirloom' }, rules), F.cache_by_kind.lesson);
  assert.deepEqual(S.cacheFor({ kind: 'lift' }, { grade: 'plain' }, rules), F.cache_by_kind.lift);
  assert.deepEqual(S.cacheFor({ kind: 'close' }, { grade: 'tempered' }, rules), F.cache_by_grade.tempered);
  assert.deepEqual(S.cacheFor({ kind: 'verify' }, null, rules), { scrap: 0, cells: 0 });
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
