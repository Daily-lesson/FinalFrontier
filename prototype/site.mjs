// Assembles the GitHub Pages site from the two built pages: the game at the
// site's root (index.html), the art sheet beside it, and the two self-hosted
// faces. Nothing else from the repo is published: no sim, no report, no tests,
// no shots. `.github/workflows/pages.yml` runs it after the rebuild check.
//
//   node prototype/site.mjs <out-dir>     # e.g. _site; the directory is created and must be empty or absent
//
// Three changes to each page, and only on the site's copies (the committed pages
// and the private artifact keep theirs): the document head the artifact host
// wraps around the page (a doctype, `lang`, a UTF-8 charset; without them a
// served page renders in quirks mode and a host without a charset header shows
// `Â·` for `·`); the Google Fonts link becomes the local `fonts/fonts.css`, so the
// site asks no third party for anything; and a
// `<meta name="robots" content="noindex">` keeps the playable spec out of
// search indexes (a public repo is not an invitation to be found).
// And on the game page alone, a fourth: the signed-out flag. The public site has no
// account, so the game starts empty (no evidence, orders, lessons, lifts or horde)
// and the Wilds are the whole game; the private artifact keeps the DEMO world.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const PAGES = ['index.html', 'art-sheet.html'];
export const FONT_FILES = ['fonts.css', 'albert-sans-latin.woff2', 'silkscreen-400-latin.woff2', 'silkscreen-700-latin.woff2', 'OFL-AlbertSans.txt', 'OFL-Silkscreen.txt'];
const GOOGLE = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">/g;
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';
export const NOINDEX = '<meta name="robots" content="noindex">';
export const HEAD = '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n';
// The game page only: signed out, so it starts empty (no evidence, orders, lessons, lifts or horde; the Wilds only).
export const SIGNED_OUT = '<script>globalThis.FIELDWORKS_SIGNED_OUT = true;</script>\n';
const RULES_TAG = '<script id="rules"';

/** One built page → its site copy. Throws unless each change applies exactly once. */
export function sitePage(html, { signedOut = false } = {}) {
  const links = html.match(GOOGLE) || [];
  if (links.length !== 1) throw new Error(`expected one Google Fonts link, found ${links.length}`);
  if (html.split(VIEWPORT).length !== 2) throw new Error('expected one viewport meta');
  if (html.includes('name="robots"')) throw new Error('the page already carries a robots meta');
  if (!html.startsWith('<title>') || /<!doctype|<meta charset/i.test(html)) throw new Error('expected a bare page that starts at its <title>');
  if (signedOut && html.split(RULES_TAG).length !== 2) throw new Error('expected one rules script to set the signed-out flag before');
  let out = HEAD + html
    .replace(GOOGLE, () => '<link rel="stylesheet" href="fonts/fonts.css">')
    .replace(VIEWPORT, () => `${VIEWPORT}\n${NOINDEX}`);
  if (signedOut) out = out.replace(RULES_TAG, () => SIGNED_OUT + RULES_TAG);
  // Nothing the page loads may leave the origin. Fail closed rather than list the ways a page can
  // load (src, srcset, poster, action, url(), @import, refresh, fetch, import(), workers, sockets…):
  // no absolute or protocol-relative URL naming a host may appear anywhere in the site's copy.
  // The page's one `https://…` is placeholder text with no host, and passes.
  const external = out.match(/\b(?:https?|wss?|ftp):\/\/[a-z0-9-]|(?:["'(=,]\s*|url=)\/\/[a-z0-9-]+\.[a-z]/gi);
  if (external) throw new Error(`the site page would load from another origin: ${external[0]}`);
  return out;
}

/** Writes the site into `out`; returns the list of published paths. */
export function assemble(out, from = here) {
  if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty`);
  mkdirSync(join(out, 'fonts'), { recursive: true });
  const published = [];
  for (const page of PAGES) {
    writeFileSync(join(out, page), sitePage(readFileSync(join(from, page), 'utf8'), { signedOut: page === 'index.html' }));
    published.push(page);
  }
  for (const f of FONT_FILES) {
    copyFileSync(join(from, 'fonts', f), join(out, 'fonts', f));
    published.push(`fonts/${f}`);
  }
  return published;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) { console.error('usage: node prototype/site.mjs <out-dir>'); process.exit(2); }
  const published = assemble(resolve(out));
  console.log(`site assembled in ${out}: ${published.join(', ')}`);
}
