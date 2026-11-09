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
// The art sheet is the same page with one flag set: every sprite drawn by the prototype's own functions.
const ART_FLAG = '<script>globalThis.FIELDWORKS_ART = true;</script>\n';
const art = out.replace('<script id="rules"', () => ART_FLAG + '<script id="rules"');
if (art === out) throw new Error('art marker not found');
writeFileSync(join(here, 'art-sheet.html'), art.replace('<title>Fieldworks</title>', '<title>Fieldworks art sheet</title>'));
console.log(`prototype/index.html written — ${out.length} bytes; art-sheet.html beside it`);
