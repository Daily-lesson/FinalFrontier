// docs/c4.json: FinalFrontier's C4 model, which the owner's status map draws this program from. The grammar is
// checked where the file is read; this test holds what the file SAYS to what this repo IS. A moved file, a renamed
// workflow, a new dependency manifest or a network call in the game fails here until the model is true again.
// Run: node --test tests/c4.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => join(root, p);
const read = (p) => readFileSync(at(p), 'utf8');
const model = JSON.parse(read('docs/c4.json'));
const by = (id) => { const c = model.containers.find((x) => x.id === id); assert.ok(c, `no container ${id}`); return c; };

test('c4: version 1 and inside the limits its reader enforces', () => {
  assert.equal(model.c4, 1);
  assert.ok(model.containers.length >= 1 && model.containers.length <= 12);
  assert.ok((model.people || []).length <= 4);
  const ids = new Set();
  for (const c of model.containers) {
    assert.match(c.id, /^[a-z][a-z0-9-]{0,11}$/);
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`); ids.add(c.id);
    assert.ok(['front', 'back', 'data'].includes(c.lane), c.id);
    assert.ok(c.label.length <= 28 && c.tech.length <= 60 && c.desc.length <= 160, c.id);
    assert.ok((c.components || []).length <= 8, c.id);
    for (const n of c.components || []) assert.ok(n.label.length <= 28 && (n.tech || '').length <= 60 && (n.desc || '').length <= 160, `${c.id}/${n.label}`);
  }
  const people = new Set((model.people || []).map((p) => p.id));
  assert.ok((model.rels || []).length <= 40);
  for (const r of model.rels || []) {
    assert.ok(ids.has(r.from) && ids.has(r.to) && r.from !== r.to, `${r.from} -> ${r.to}`);
    assert.ok(!people.has(r.from) && !people.has(r.to), 'a person never appears in a relationship');
    assert.ok(r.label.length <= 80);
  }
  for (const lane of ['front', 'back', 'data']) assert.ok(model.containers.some((c) => c.lane === lane), lane);
});

test('c4: names no URL, host or address', () => {
  const body = JSON.stringify(model);
  assert.ok(!/https?:|\/\/|www\.|\.(com|io|dev|app|fyi|co|org|net)\b|github\.io|localhost|127\.0\.0\.1/i.test(body));
});

test('c4: every file and directory it names is in this repo', () => {
  for (const c of model.containers) for (const n of c.components || []) {
    const p = (n.tech || '').split(' · ')[0];
    assert.ok(existsSync(at(p)), `${c.id}/${n.label}: ${p}`);
  }
});

test('c4: the readings rest on what this repo has', () => {
  assert.deepEqual(by('game').reads, { workflow: 'pages.yml' });
  assert.deepEqual(by('engine').reads, { fresh: 'src', days: 90 });
  assert.deepEqual(by('rules').reads, { fresh: 'rules', days: 90 });
  assert.equal(by('ci').reads, 'ci');
  for (const c of model.containers) {
    const w = c.reads && c.reads.workflow; if (w) assert.ok(existsSync(at(`.github/workflows/${w}`)), w);
    const f = c.reads && c.reads.fresh; if (f) assert.ok(existsSync(at(f)), f);
  }
});

test('c4: the stack it states is the stack the repo runs', () => {
  assert.ok(!existsSync(at('package.json')), 'no package.json: the builder says so');
  assert.match(by('builder').tech, /no package\.json/);
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /node-version: 22/); assert.match(by('ci').tech, /Node 22/);
  assert.match(ci, /node --test tests\/check\.mjs tests\/c4\.test\.mjs/, 'CI runs this test');
  const pages = read('.github/workflows/pages.yml');
  assert.match(pages, /actions\/deploy-pages@/); assert.match(by('game').tech, /GitHub Pages/);
  assert.match(pages, /if: github\.ref == 'refs\/heads\/main'/, 'Pages deploys from main only');
  const build = read('prototype/build.mjs');
  for (const f of ['play.html', 'play.js', 'play.css']) assert.ok(build.includes(f), `build.mjs writes embed/${f}`);
  assert.match(build, /script-src 'self'/); assert.match(by('embed').tech, /no inline script/);
});

test('c4: the built page carries the engine and the castle module byte for byte', () => {
  const page = read('prototype/index.html');
  for (const f of ['src/engine.js', 'src/castle.js']) assert.ok(page.includes(read(f).trim()), `${f} inlined`);
});

test('c4: the save is on the device and the game makes no network call', () => {
  const core = read('prototype/game/10-core.js');
  assert.ok(core.includes("'fieldworks-save'") && core.includes("'fieldworks-embed-play'"), 'both save keys');
  assert.match(core, /localStorage/); assert.equal(by('save').on, 'browser');
  for (const f of readdirSync(at('prototype/game'))) {
    const p = `prototype/game/${f}`; if (statSync(at(p)).isDirectory()) continue;
    const src = read(p);
    assert.ok(!/\bfetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket\s*\(/.test(src), `${p} makes no network call`);
  }
});

test('c4: the rules parse and the fonts carry their licences', () => {
  JSON.parse(read('rules/fieldworks.json'));
  assert.ok(existsSync(at('prototype/fonts/OFL-AlbertSans.txt')) && existsSync(at('prototype/fonts/OFL-Silkscreen.txt')));
  assert.match(by('game').components.find((n) => n.label === 'Fonts').desc, /OFL/);
});

test('c4: the relationships it draws are the ones the build does', () => {
  const has = (f, t) => (model.rels || []).some((r) => r.from === f && r.to === t);
  for (const [f, t] of [['builder', 'engine'], ['builder', 'rules'], ['builder', 'game'], ['builder', 'embed'], ['game', 'save'], ['embed', 'save'], ['ci', 'engine']]) assert.ok(has(f, t), `${f} -> ${t}`);
  const build = read('prototype/build.mjs');
  assert.match(build, /'src', 'engine\.js'/); assert.match(build, /'rules', 'fieldworks\.json'/);
});
