// Inlines src/engine.js and rules/fieldworks.json into prototype.src.html →
// prototype/index.html. The published artifact is one page with no dependency;
// tests/check.mjs holds the inlined copies equal to the files.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = readFileSync(join(here, 'prototype.src.html'), 'utf8');
const engine = readFileSync(join(root, 'src', 'engine.js'), 'utf8');
const rules = readFileSync(join(root, 'rules', 'fieldworks.json'), 'utf8').trim();
const out = src.replace('/*__ENGINE__*/', () => engine).replace('/*__RULES__*/', () => rules);
if (out === src) throw new Error('markers not found');
writeFileSync(join(here, 'index.html'), out);
console.log(`prototype/index.html written — ${out.length} bytes`);
