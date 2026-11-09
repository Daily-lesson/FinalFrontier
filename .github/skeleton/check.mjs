#!/usr/bin/env node
// Skeleton drift guard (canonical — keep byte-identical across daily-lesson repos).
//
// Reads .github/skeleton/skeleton.config.json, enumerates the real code entities
// it names (routes, lib modules, migrations, grep-based module banners, …) and
// fails if any entity is not mentioned in the configured doc file(s). This makes
// it impossible to add a route / module / migration and silently leave the
// SKELETON.md (and CLAUDE.md) inventory behind. Prose quality is a separate
// concern (the LLM refresh workflow + the CLAUDE.md reminder handle that); this
// guard only enforces *coverage* — every entity must appear somewhere in the docs.
//
// Usage:
//   node .github/skeleton/check.mjs            # guard: exit 1 if anything undocumented
//   node .github/skeleton/check.mjs --list     # print the enumerated entities and exit 0
//
// Dependency-free (Node built-ins only) so it runs anywhere with no npm install.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..'); // repo root (this file lives in .github/skeleton/)
const CONFIG_PATH = resolve(HERE, 'skeleton.config.json');

function die(msg) { console.error(msg); process.exit(2); }
if (!existsSync(CONFIG_PATH)) die(`No config at ${CONFIG_PATH}`);
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

// --- tracked file list (deterministic, respects .gitignore) --------------------
let tracked = [];
try {
  tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
} catch {
  die('git ls-files failed — this guard must run inside a git checkout.');
}

// glob -> RegExp ( ** = any incl. /, * = any except /, ? = one non-/ )
function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}
const matchGlob = (glob) => { const re = globToRe(glob); return tracked.filter((f) => re.test(f)); };
function excluded(file, patterns) {
  return (patterns || []).some((p) => globToRe(p).test(file));
}

// --- entity enumeration --------------------------------------------------------
// Each entity = { token: string-that-must-appear-in-docs, label: human hint }.
function enumerateSet(set) {
  const out = [];
  if (set.kind === 'route') {
    // directories containing a `leaf` file, under `root`; token = path below root.
    const leaf = set.leaf || 'route.ts';
    const root = set.root.replace(/\/$/, '');
    for (const f of tracked) {
      if (basename(f) !== leaf) continue;
      if (!f.startsWith(root + '/')) continue;
      if (excluded(f, set.exclude)) continue;
      let rel = dirname(f).slice(root.length + 1); // '' for the root route
      if (set.depth && rel) rel = rel.split('/').slice(0, set.depth).join('/');
      out.push({ token: rel === '' ? (set.rootToken || root.split('/').pop()) : rel, label: f });
    }
  } else if (set.kind === 'path') {
    for (const f of matchGlob(set.glob)) {
      if (excluded(f, set.exclude)) continue;
      let token = set.tokenBasename ? basename(f) : f;
      for (const [pat, repl] of set.tokenReplace || []) token = token.replace(new RegExp(pat), repl ?? '');
      out.push({ token, label: f });
    }
  } else if (set.kind === 'grep') {
    const file = resolve(ROOT, set.file);
    if (!existsSync(file)) die(`grep set "${set.name}": file not found: ${set.file}`);
    const text = readFileSync(file, 'utf8');
    const re = new RegExp(set.regex, 'gm');
    const seen = new Set();
    let m;
    while ((m = re.exec(text)) !== null) { if (m[1]) seen.add(m[1]); }
    for (const token of [...seen].sort()) out.push({ token, label: `${set.file} :: ${token}` });
  } else {
    die(`Unknown entity-set kind: ${set.kind}`);
  }
  // de-dupe by token, keep sorted+stable
  const byToken = new Map();
  for (const e of out) if (!byToken.has(e.token)) byToken.set(e.token, e);
  return [...byToken.values()].sort((a, b) => a.token.localeCompare(b.token));
}

// --- doc text ------------------------------------------------------------------
const docCache = new Map();
function docText(name) {
  if (docCache.has(name)) return docCache.get(name);
  const p = resolve(ROOT, name);
  const t = existsSync(p) ? readFileSync(p, 'utf8') : '';
  if (!t) console.error(`⚠  doc file not found (coverage will fail): ${name}`);
  docCache.set(name, t);
  return t;
}

const listMode = process.argv.includes('--list');
const defaultDocs = config.docs || ['SKELETON.md'];
let missing = 0;
let total = 0;

for (const set of config.entitySets) {
  const entities = enumerateSet(set);
  const docs = set.docs || defaultDocs;
  const combined = docs.map(docText).join('\n');
  if (listMode) {
    console.log(`\n# ${set.name}  (${entities.length}) — covered by: ${docs.join(', ')}`);
    for (const e of entities) console.log(`  ${e.token}`);
    continue;
  }
  const gaps = entities.filter((e) => !combined.includes(e.token));
  total += entities.length;
  if (gaps.length) {
    missing += gaps.length;
    console.error(`\n✖ ${set.name}: ${gaps.length}/${entities.length} not documented in ${docs.join(' / ')}:`);
    for (const g of gaps) console.error(`    - ${g.token}   (${g.label})`);
  } else {
    console.error(`✓ ${set.name}: all ${entities.length} documented`);
  }
}

if (listMode) process.exit(0);
if (missing) {
  console.error(`\nSkeleton drift detected: ${missing} entity(ies) missing from the docs.`);
  console.error('Document them in the file(s) above (or run the skeleton-refresh workflow), then re-run.');
  process.exit(1);
}
console.error(`\nSkeleton up to date: ${total} entities all documented.`);
process.exit(0);
