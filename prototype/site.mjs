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
// And a fifth, the build stamp (the site-version/1 standard, the design repo's
// docs/SITE_VERSION.md): `version.json` beside the game page says which build is
// live, and the game page carries the shown part as a static badge,
// `v<date> · <commit7>`. The version is the rules' game version (code may compare
// it; it is no longer shown); the commit comes from the deploy (`GITHUB_SHA`,
// else `git rev-parse HEAD`); the date is that commit's committer date in UTC,
// `YYYY.MM.DD`, read from git, never the clock. Neither is written into a
// committed file; a build that cannot know one says so with `null`, and the badge
// is the commit alone, or `dev`. No time is stamped: one commit assembles one
// site, byte for byte.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
export const PAGES = ['index.html', 'art-sheet.html'];
export const FONT_FILES = ['fonts.css', 'albert-sans-latin.woff2', 'silkscreen-400-latin.woff2', 'silkscreen-700-latin.woff2', 'OFL-AlbertSans.txt', 'OFL-Silkscreen.txt'];
const GOOGLE = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/[^"]*">/g;
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';
export const NOINDEX = '<meta name="robots" content="noindex">';
export const HEAD = '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n';
// The game page only: signed out, so it starts empty (no evidence, orders, lessons, lifts or horde; the Wilds only).
export const SIGNED_OUT = '<script>globalThis.FIELDWORKS_SIGNED_OUT = true; document.documentElement.classList.add(\'signed-out\');</script>\n';
const RULES_TAG = '<script id="rules"';
// The build stamp. Fixed strings and two checked values; nothing else about the repo, the host or the run.
export const VERSION_FILE = 'version.json';
export const APP = 'final-frontier';
const VERSION_OK = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,39}$/;
const COMMIT_OK = /^[0-9a-f]{40}$/;
const DATE_OK = /^20\d{2}\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])$/;
const WRAP = '<div class="wrap">\n';
// In the page's bottom padding, under the game's frame and never over it: it scrolls with the page rather than
// floating over the controls on a short screen. No script, no request, no pointer events, not printed.
const BADGE_STYLE = '<style>.wrap{position:relative}.site-version{position:absolute;right:10px;bottom:6px;font:400 10px/1 var(--mono);color:var(--fg-3);pointer-events:none;user-select:none}@media print{.site-version{display:none}}</style>';

/** A full lowercase commit id, or null. Anything else (a short id, upper case, markup) is not a commit. */
export const cleanCommit = (c) => (typeof c === 'string' && COMMIT_OK.test(c) ? c : null);

/** The commit this build is of: the deploy's own `GITHUB_SHA`, else the checkout's HEAD, else null. Never throws. */
export function siteCommit(env = process.env, cwd = here) {
  const fromEnv = cleanCommit(env && env.GITHUB_SHA);
  if (fromEnv) return fromEnv;
  try { return cleanCommit(execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()); } catch { return null; }
}

/** A `YYYY.MM.DD` date, or null. */
export const cleanDate = (d) => (typeof d === 'string' && DATE_OK.test(d) ? d : null);

/** The committer date of `commit`, in UTC, as `YYYY.MM.DD`, read from git (never the clock); null when unknown. Never throws. */
export function siteDate(commit, cwd = here) {
  const c = cleanCommit(commit);
  if (!c) return null;
  try {
    const out = execFileSync('git', ['log', '-1', '--date=format-local:%Y.%m.%d', '--format=%cd', c], { cwd, encoding: 'utf8', env: { ...process.env, TZ: 'UTC' }, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 });
    return cleanDate(out.trim());
  } catch { return null; }
}

// A version is a string or a number that reads as one short plain token; a missing one is not the word "undefined".
const cleanVersion = (v) => {
  const s = typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)) ? String(v) : null;
  if (s === null || !VERSION_OK.test(s)) throw new Error(`not a site version: ${JSON.stringify(v)}`);
  return s;
};

/** The game's own version, from the rules the page plays by. Throws on a value the standard does not allow. */
export const siteVersion = (rules) => cleanVersion(rules && rules.game && rules.game.version);

/** What `version.json` says. `commit` is a full id or null, `date` its `YYYY.MM.DD` or null; no build time, so a commit assembles one site. */
export function versionInfo(version, commit, date = null) {
  const c = cleanCommit(commit);
  return { schema: 'site-version/1', app: APP, version: cleanVersion(version), commit: c, date: c ? cleanDate(date) : null };
}

/** The badge's words: `v<date> · <commit7>`; the commit alone with no date; `dev` with neither. The version is not shown. */
export const badgeText = (info) => {
  const c = cleanCommit(info.commit), d = c ? cleanDate(info.date) : null;
  return d ? `v${d} \u00b7 ${c.slice(0, 7)}` : c ? c.slice(0, 7) : 'dev';
};

/** The badge's markup, one line, placed first inside the page's wrap. */
export const badge = (info) => `${BADGE_STYLE}<div class="site-version" aria-hidden="true">${badgeText(versionInfo(info.version, info.commit, info.date))}</div>\n`;

/** One inline line beside the badge: `window.SITE_VERSION`, set once and frozen, with `text` exactly the badge's words
 *  (a bug report then names the build the badge shows). Only checked values; no address, no request. */
export const versionScript = (info) => {
  const v = versionInfo(info.version, info.commit, info.date);
  const g = { app: v.app, version: v.version, commit: v.commit, date: v.date, text: badgeText(v) };
  return `<script>if(!globalThis.SITE_VERSION)globalThis.SITE_VERSION=Object.freeze(${JSON.stringify(g).replace(/</g, '\\u003c')});</script>\n`;
};

/** One built page → its site copy. Throws unless each change applies exactly once. */
export function sitePage(html, { signedOut = false, stamp = null } = {}) {
  const links = html.match(GOOGLE) || [];
  if (links.length !== 1) throw new Error(`expected one Google Fonts link, found ${links.length}`);
  if (html.split(VIEWPORT).length !== 2) throw new Error('expected one viewport meta');
  if (html.includes('name="robots"')) throw new Error('the page already carries a robots meta');
  if (!html.startsWith('<title>') || /<!doctype|<meta charset/i.test(html)) throw new Error('expected a bare page that starts at its <title>');
  if (signedOut && html.split(RULES_TAG).length !== 2) throw new Error('expected one rules script to set the signed-out flag before');
  if (stamp && html.split(RULES_TAG).length !== 2) throw new Error('expected one rules script to set the site version before');
  if (stamp && html.split(WRAP).length !== 2) throw new Error('expected one wrap to place the version badge in');
  let out = HEAD + html
    .replace(GOOGLE, () => '<link rel="stylesheet" href="fonts/fonts.css">')
    .replace(VIEWPORT, () => `${VIEWPORT}\n${NOINDEX}`);
  if (signedOut) out = out.replace(RULES_TAG, () => SIGNED_OUT + RULES_TAG);
  if (stamp) out = out.replace(RULES_TAG, () => versionScript(stamp) + RULES_TAG);
  if (stamp) out = out.replace(WRAP, () => WRAP + badge(stamp));
  // Nothing the page loads may leave the origin. Fail closed rather than list the ways a page can
  // load (src, srcset, poster, action, url(), @import, refresh, fetch, import(), workers, sockets…):
  // no absolute or protocol-relative URL naming a host may appear anywhere in the site's copy.
  // The page's one `https://…` is placeholder text with no host, and passes.
  const external = out.match(/\b(?:https?|wss?|ftp):\/\/[a-z0-9-]|(?:["'(=,]\s*|url=)\/\/[a-z0-9-]+\.[a-z]/gi);
  if (external) throw new Error(`the site page would load from another origin: ${external[0]}`);
  return out;
}

/** Writes the site into `out`; returns the list of published paths. `commit` is the build's commit and `date` its committer date, or null for "not known". */
export function assemble(out, from = here, { commit = siteCommit(), date = siteDate(commit) } = {}) {
  if (existsSync(out) && readdirSync(out).length) throw new Error(`${out} is not empty`);
  mkdirSync(join(out, 'fonts'), { recursive: true });
  const published = [];
  const info = versionInfo(siteVersion(JSON.parse(readFileSync(join(from, '..', 'rules', 'fieldworks.json'), 'utf8'))), commit, date);
  for (const page of PAGES) {
    const game = page === 'index.html';
    writeFileSync(join(out, page), sitePage(readFileSync(join(from, page), 'utf8'), { signedOut: game, stamp: game ? info : null }));
    published.push(page);
  }
  writeFileSync(join(out, VERSION_FILE), JSON.stringify(info) + '\n');
  published.push(VERSION_FILE);
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
