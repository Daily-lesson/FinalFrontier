#!/usr/bin/env node
// CLAUDE.md drift reminder (canonical — keep byte-identical across repos).
//
// Soft, NON-blocking. CLAUDE.md is editorial prose (gotchas, conventions,
// "where do I change X") — it can't be mechanically generated, so instead of a
// hard guard we nudge: if a change touches a lot of watched source but leaves
// CLAUDE.md untouched, emit a GitHub warning annotation. Never fails the build.
//
// Changed files come from $CHANGED_FILES (newline/space separated) when the
// workflow computes them; otherwise we diff against $BASE_REF (default origin/main).

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const cfg = JSON.parse(readFileSync(resolve(HERE, 'skeleton.config.json'), 'utf8'));
const R = cfg.reminder;
if (!R) { console.log('No reminder config; skipping.'); process.exit(0); }

function globToRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') { if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; } else re += '[^/]*'; }
    else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}

let changed = (process.env.CHANGED_FILES || '').split(/\s+/).map((s) => s.trim()).filter(Boolean);
if (!changed.length) {
  const base = process.env.BASE_REF || 'origin/main';
  try {
    changed = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { console.log('Could not compute changed files; skipping reminder.'); process.exit(0); }
}

const watch = (R.watchGlobs || []).map(globToRe);
const hits = changed.filter((f) => watch.some((re) => re.test(f)));
const touchedDoc = changed.includes(R.doc);
const threshold = R.threshold || 6;

if (hits.length >= threshold && !touchedDoc) {
  const list = hits.slice(0, 12).map((f) => `  - ${f}`).join('%0A');
  console.log(
    `::warning title=${R.doc} may be stale::` +
    `${hits.length} watched source files changed but ${R.doc} was not updated. ` +
    `If this change adds/alters a route, gotcha, or convention, update ${R.doc}.%0A${list}`
  );
} else {
  console.log(`CLAUDE.md reminder: ${hits.length} watched file(s) changed, ${R.doc} ${touchedDoc ? 'was updated' : 'not triggered'}.`);
}
process.exit(0);
