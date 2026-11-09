#!/usr/bin/env node
// Workflow standards lint (canonical: Daily-lesson/alys templates/repo/ —
// keep byte-identical across repos; change it there).
//
// ACTIONS_BUDGET.md's 2026-08-21 pass made three rules standing for every
// daily-lesson workflow, and until this file nothing enforced them — they held
// only because every author remembered:
//   1. a `permissions:` block (top level, or on every job) — least privilege;
//   2. a `concurrency:` group (top level, or on every job);
//   3. `timeout-minutes` on every job — the default cap is 360, and one hung
//      job is 12% of the portfolio's monthly quota.
// Plus two cheap ones: every `uses:` carries a ref and that ref is not one of
// the usual moving branch names (`@main`, `@master`, `@HEAD`, `@latest` — a
// denylist, not proof of immutability: a tag can move too; pin third-party
// actions to a SHA where it matters), and every cron has five fields. A cron on minute 0 is a WARNING, not an error: GitHub queues every
// on-the-hour schedule at once, so those fire late (ACTIONS_BUDGET.md
// measured 06:50–13:27 for a 06:00 cron), but the ALYS self-heal sweep is on
// the hour by design and a warning is the honest weight for a preference.
//
// No YAML parser (no dependencies, same as the skeleton guard): the checks
// read indentation, which every workflow in the portfolio keeps consistent.
// A job that calls a reusable workflow (`uses:` at job level) cannot carry
// `timeout-minutes`, so it is exempt from rule 3. Flow-style YAML
// (`steps: [{uses: x}]`) is not parsed; the portfolio does not write it.
//
//   node .github/scripts/workflow-lint.mjs              # lints .github/workflows/*.y*ml
//   node .github/scripts/workflow-lint.mjs a.yml b.yml  # lints the named files
// Exit 1 on any error; warnings never fail.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOVING_REFS = new Set(['main', 'master', 'head', 'latest']);

const indentOf = (line) => line.length - line.trimStart().length;
const isContent = (line) => line.trim() !== '' && !line.trimStart().startsWith('#');
const keyOf = (line) => {
  const m = /^\s*(?:-\s+)?(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*:(\s|$)/.exec(line);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};

/**
 * Blank out the bodies of block scalars (`run: |`, `script: >-`, …): a heredoc
 * that writes YAML contains `uses:` / `cron:` text that is not workflow
 * structure, and linting it produced false errors.
 */
function stripBlockScalars(lines) {
  const out = [];
  let blockIndent = -1;
  for (const line of lines) {
    if (blockIndent >= 0) {
      if (line.trim() === '' || indentOf(line) > blockIndent) { out.push(''); continue; }
      blockIndent = -1;
    }
    out.push(line);
    if (isContent(line) && /:\s*[|>][-+0-9]*\s*(#.*)?$/.test(line)) blockIndent = indentOf(line);
  }
  return out;
}

/** Split the `jobs:` mapping into { id, lines } blocks. */
function jobsOf(lines) {
  const start = lines.findIndex((l) => /^(?:jobs|"jobs"|'jobs')\s*:\s*(#.*)?$/.test(l));
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isContent(lines[i]) && indentOf(lines[i]) === 0) { end = i; break; }
  }
  const body = lines.slice(start + 1, end);
  const first = body.find(isContent);
  if (!first) return [];
  const jobIndent = indentOf(first);
  const jobs = [];
  for (const line of body) {
    if (isContent(line) && indentOf(line) === jobIndent && keyOf(line)) {
      jobs.push({ id: keyOf(line), lines: [] });
    } else if (jobs.length) {
      jobs[jobs.length - 1].lines.push(line);
    }
  }
  return jobs;
}

/** Keys directly under a job (its own indentation level only). */
function jobKeys(job) {
  const first = job.lines.find(isContent);
  if (!first) return new Set();
  const propIndent = indentOf(first);
  return new Set(job.lines
    .filter((l) => isContent(l) && indentOf(l) === propIndent)
    .map(keyOf)
    .filter(Boolean));
}

/**
 * Lint one workflow's text. Returns { errors: string[], warnings: string[] }.
 * Pure — the tests call it directly with fixture text.
 */
export function lintWorkflow(text) {
  const errors = [];
  const warnings = [];
  const lines = stripBlockScalars(text.split(/\r?\n/));
  const topKeys = new Set(lines.filter((l) => isContent(l) && indentOf(l) === 0).map(keyOf).filter(Boolean));
  const jobs = jobsOf(lines);

  if (!jobs.length) errors.push('no jobs found under `jobs:`');
  const keysByJob = new Map(jobs.map((j) => [j.id, jobKeys(j)]));

  for (const rule of ['permissions', 'concurrency']) {
    if (topKeys.has(rule)) continue;
    const missing = jobs.filter((j) => !keysByJob.get(j.id).has(rule)).map((j) => j.id);
    if (missing.length) {
      errors.push(`no top-level \`${rule}:\` and job(s) without one: ${missing.join(', ')}`);
    }
  }

  for (const job of jobs) {
    const keys = keysByJob.get(job.id);
    if (keys.has('uses')) continue; // reusable-workflow call: timeout-minutes not allowed
    if (!keys.has('timeout-minutes')) {
      errors.push(`job \`${job.id}\` has no \`timeout-minutes\` (default is 360)`);
    }
  }

  for (const line of lines) {
    if (!isContent(line)) continue;
    const uses = /^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)/.exec(line);
    if (uses) {
      const ref = uses[1];
      if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
      const at = ref.lastIndexOf('@');
      if (at === -1) errors.push(`\`uses: ${ref}\` is not pinned to a ref`);
      else if (MOVING_REFS.has(ref.slice(at + 1).toLowerCase())) {
        errors.push(`\`uses: ${ref}\` is pinned to a moving branch`);
      }
    }
    // Split rather than one backtracking regex: a lazy group next to \s* went
    // quadratic on a long run of spaces (seconds at 40k), and this runs on PR content.
    const cron = /^\s*(?:-\s+)?cron:(.*)$/.exec(line);
    if (cron) {
      const expr = cron[1].split('#')[0].trim().replace(/^["']|["']$/g, '').trim();
      const fields = expr.split(/\s+/);
      if (fields.length !== 5) errors.push(`cron "${expr}" does not have 5 fields`);
      else if (/^0+$/.test(fields[0])) {
        warnings.push(`cron "${expr}" fires on the hour — GitHub delays those most; prefer an odd minute`);
      }
    }
  }
  return { errors, warnings };
}

function main(argv) {
  let files = argv;
  if (!files.length) {
    const dir = resolve('.github/workflows');
    if (!existsSync(dir)) { console.log('No .github/workflows directory; nothing to lint.'); return 0; }
    files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => join('.github/workflows', f));
  }
  const gha = process.env.GITHUB_ACTIONS === 'true';
  let errorCount = 0;
  for (const file of files) {
    const { errors, warnings } = lintWorkflow(readFileSync(file, 'utf8'));
    for (const w of warnings) console.log(gha ? `::warning file=${file}::${w}` : `⚠ ${file}: ${w}`);
    for (const e of errors) console.log(gha ? `::error file=${file}::${e}` : `✖ ${file}: ${e}`);
    if (!errors.length) console.log(`✓ ${file}`);
    errorCount += errors.length;
  }
  if (errorCount) {
    console.log(`\n${errorCount} workflow standard violation(s). See Daily-lesson/alys ACTIONS_BUDGET.md.`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
