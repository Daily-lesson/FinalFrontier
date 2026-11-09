// FIELDWORKS — the engine's check (node --test tests/check.mjs).
// Holds the reference engine (src/engine.js) to the rules (rules/fieldworks.json)
// and the design's §6 numbers, holds prototype/index.html to the two files it
// inlines (prototype/build.mjs writes it), and sweeps the whole tree for the
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

test('prototype/index.html inlines src/engine.js and rules/fieldworks.json byte for byte', () => {
  const html = read('prototype/index.html');
  assert.ok(html.includes(read('src/engine.js')), 'engine.js is inlined unchanged');
  assert.ok(html.includes(read('rules/fieldworks.json').trim()), 'the rules are inlined unchanged');
});

// ── the walls: a sweep of every file in the tree ─────────────────────────────
// Word hashes (sha256, first 16 hex) of a person's name and its spellings, a mail
// host, and the two database project refs the portfolio runs on.
const DENY = new Set(['ccb71b663e383032', '3fe52df0c21fa28f', 'ea5e5cdbccb765e0', 'a67f8eb35b59c847', '576ba7c2e4abb718', '5ecec73dd71edcbb', '7772e1e25e61f131']);
const h16 = (w) => createHash('sha256').update(w).digest('hex').slice(0, 16);
const EMAIL = new RegExp('[^\\s@<>"\'(]+' + '@' + '[^\\s@<>"\')]+\\.[a-z]{2,}', 'i');
const REAL_ID = new RegExp('WO-' + '(?:[01]\\d\\d|2[0-7]\\d)\\b');
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
  assert.equal(sweep('WO-304 · P1 · a DEMO chore; family=Albert+Sans:wght@300;500').length, 0, 'invented ids and font URLs pass');
});

test('walls: no file in the tree carries a name, an e-mail, a database ref or a real-range order id', () => {
  const found = [];
  for (const f of files(root)) { const hits = sweep(readFileSync(f, 'utf8')); if (hits.length) found.push(`${relative(root, f)}: ${hits.join('; ')}`); }
  assert.deepEqual(found, []);
});

// ── prototype 3: the new rule blocks, each with its own test ─────────────────
test('rules.save: a version and an autosave period', () => {
  assert.ok(Number.isInteger(RULES.save.version) && RULES.save.version >= 1);
  assert.ok(RULES.save.autosave_seconds > 0 && RULES.save.autosave_seconds <= 60);
});

test('rules.clock (D25): two modes, a night hour after the dawn hour, both on the clock', () => {
  const c = RULES.clock;
  assert.deepEqual([...c.modes].sort(), ['real', 'short']); assert.ok(c.modes.includes(c.default));
  assert.ok(Number.isInteger(c.night_hour) && Number.isInteger(c.dawn_hour) && c.dawn_hour >= 0 && c.night_hour <= 23 && c.dawn_hour < c.night_hour);
  for (const k of ['clock_short', 'clock_real', 'until_night', 'until_dawn', 'night_quiet']) assert.ok(RULES.bank.fortress[k], `bank fortress.${k}`);
});

test('rules.keeper_effects (D26): one small multiplier per part, on a closed set of stats, marked proposed', () => {
  const fx = RULES.keeper_effects;
  assert.equal(fx.proposed, true);
  assert.deepEqual(Object.keys(fx.parts).sort(), RULES.keeper.parts.map((p) => p.slug).sort(), 'every part has exactly one effect');
  for (const [slug, e] of Object.entries(fx.parts)) {
    assert.ok(['hull', 'gather', 'range', 'speed', 'struct'].includes(e.stat), `${slug}.stat`);
    assert.ok(e.per_tier > 0 && e.per_tier <= 0.1, `${slug} is small (≤ 10% a tier)`);
    assert.ok(e.label, `${slug}.label`);
  }
  assert.equal(new Set(Object.values(fx.parts).map((e) => e.stat)).size, 5, 'five parts, five stats');
});

test('rules.explore (D29): the gate, provinces and the card radius', () => {
  const X = RULES.explore;
  assert.ok(X.gate.radius_m > 0 && X.gate.z_m < 0, 'the gate stands behind the start');
  assert.ok(Number.isInteger(X.province_weeks) && X.province_weeks >= 1);
  assert.ok(X.card_radius_m > X.waypoint_radius_m, 'the card shows before the survey is in reach');
  for (const k of ['compass_waypoint', 'compass_gate', 'card', 'card_done', 'card_open', 'province', 'gate_home']) assert.ok(RULES.bank.explore[k], `bank explore.${k}`);
});

test('rules.states: the honest states, each with its words', () => {
  assert.deepEqual(RULES.states.kinds, ['live', 'unlit', 'dark', 'quiet']);
  for (const k of ['unlit', 'dark', 'quiet']) assert.ok(RULES.bank.states[k], `bank states.${k}`);
  assert.ok(RULES.states.dark_days >= 1);
});

test('rules.onboarding: three cards, each with a title and a body in the bank', () => {
  assert.equal(RULES.onboarding.cards.length, 3);
  for (const c of RULES.onboarding.cards) { assert.ok(RULES.bank.onboarding[c]?.title); assert.ok(RULES.bank.onboarding[c]?.body); }
});

test('rules.telemetry: the six local fields, their labels, and the sentence that says they stay', () => {
  assert.deepEqual(RULES.telemetry.fields, ['opens', 'session_seconds', 'closes_seen', 'pylons', 'nights_held', 'regions_mapped']);
  for (const f of RULES.telemetry.fields) assert.ok(RULES.bank.telemetry[f], `bank telemetry.${f}`);
  assert.equal(RULES.bank.telemetry.note, 'Kept on this device, never sent.');
});

test('rules.fortress.waves: the cap and the day cap the sim tuned are present and sane', () => {
  const w = RULES.fortress.waves;
  assert.ok(w.max >= w.base && w.max <= 40, 'a night stays inside the 40-machine budget');
  assert.ok(Number.isInteger(w.per_day_cap_days) && w.per_day_cap_days >= 1);
});

// ── prototype 3: the page itself ────────────────────────────────────────────
const SRC = read('prototype/prototype.src.html');
const scripts = (html) => [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

test('the built pages parse: every inline script of index.html and art-sheet.html compiles', () => {
  for (const f of ['prototype/index.html', 'prototype/art-sheet.html']) {
    const ss = scripts(read(f)); assert.ok(ss.length >= 2, f);
    for (const code of ss) assert.doesNotThrow(() => new vm.Script(code), f);
  }
  const art = read('prototype/art-sheet.html');
  assert.ok(art.includes(read('src/engine.js')) && art.includes(read('rules/fieldworks.json').trim()), 'the art sheet inlines the same engine and rules');
});

test('pillar 1: cells arrive in one place (a cache picked up), start at zero, and nothing in the page writes XP', () => {
  const adds = SRC.split('\n').filter((l) => /G\.cells\s*\+=/.test(l));
  assert.equal(adds.length, 1, 'one line adds cells');
  assert.match(adds[0], /G\.cells \+= c\.cells/, 'and it is the cache pickup');
  assert.match(SRC, /scrap: 12, cells: 0,/, 'a new map starts with no cells');
  assert.ok(!/G\.cells\s*=[^=]/.test(SRC), 'no line sets cells outright (a save restores them through Object.assign of its own map)');
  const subs = SRC.split('\n').filter((l) => /G\.cells\s*-=/.test(l));
  assert.equal(subs.length, 1); assert.match(subs[0], /G\.cells -= cost\.cells/, 'and the one line that takes cells is a build the player chose');
  assert.ok(!/\.xp\s*[+\-*]?=(?!=)/.test(SRC.replace(/hudEls\.xp/g, '')), 'no XP write outside the engine');
  assert.match(SRC, /const by = F\.cache_by_kind\[ev\.kind\] \|\| \(item \? F\.cache_by_grade\[item\.grade\] : null\);/, 'one cache rule, the sim\'s');
});

test('storage: the page touches localStorage only through its helper, under exactly four keys', () => {
  assert.equal((SRC.match(/localStorage\./g) || []).length, 3, 'get, set and remove, in the helper');
  const keys = [...new Set(SRC.match(/'fieldworks-[a-z]+'/g))].sort();
  assert.deepEqual(keys, ["'fieldworks-keeper'", "'fieldworks-onboarded'", "'fieldworks-save'", "'fieldworks-telemetry'"]);
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(SRC), 'nothing is sent anywhere');
});

test('the bank: every sentence the page reads exists in the rules', () => {
  const refs = [...new Set([...SRC.matchAll(/BANK\.([a-z_]+)\.([a-z_]+)/g)].map((m) => `${m[1]}.${m[2]}`))];
  assert.ok(refs.length > 20);
  for (const r of refs) { const [a, b] = r.split('.'); assert.ok(RULES.bank[a] && RULES.bank[a][b] != null, `bank ${r}`); }
});
