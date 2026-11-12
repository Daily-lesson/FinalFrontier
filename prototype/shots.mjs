// The prototype walk (node prototype/shots.mjs): Playwright at 375 × 667, both
// themes. Writes the screenshots and the art sheet to prototype/shots/, checks
// the behaviours prototype 4 claims (each a named check; the run exits non-zero
// on any failure or page error), and measures the frame time with Chrome's own
// Performance metrics. Run `node prototype/build.mjs` first.
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
const PAGE = pathToFileURL(join(here, 'index.html')).href;
const ART = pathToFileURL(join(here, 'art-sheet.html')).href;
const OUT = join(here, 'shots'); mkdirSync(OUT, { recursive: true });
const VIEW = { width: 375, height: 667 };
const results = []; const errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };
const wait = (p, ms) => p.waitForTimeout(ms);

async function open(ctx, url = PAGE) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(url);
  // file:// pages can share storage across contexts: every walk starts from a device that has never opened the page
  if (url === PAGE) { await p.goto(ART); await p.evaluate(() => localStorage.clear()); await p.goto(url); }
  await wait(p, 300); return p;
}
const phoneShot = (p, name) => p.locator('#phone').screenshot({ path: join(OUT, `${name}.png`) });
const D = (p, f) => p.evaluate((k) => FieldworksDebug[k](), f);
async function clearCards(p) {
  for (let i = 0; i < 14; i++) {
    const take = p.locator('[data-take]'); if (await take.count()) { await take.first().click(); await wait(p, 150); continue; }
    const next = p.locator('[data-act="next"],[data-act="start"],[data-act="summary"]'); if (await next.count()) { await next.last().click(); await wait(p, 100); continue; }   // the topmost card first
    if (await p.locator('.medalpop').count()) { await wait(p, 400); continue; }
    break;
  }
}
async function go(p, screen) { await p.click(`#seg-screen [data-go="${screen}"]`); await wait(p, 200); }
async function closeOrder(p, id, keepCard = false) {
  await go(p, 'siege'); await p.click(`[data-order="${id}"]`); await p.fill('#proof', 'https://example.com/run/1'); await p.click('[data-done]'); await wait(p, 500);
  if (!keepCard) { await clearCards(p); await wait(p, 1700); await clearCards(p); }
}
const FRESH = ['WO-304', 'WO-318', 'WO-322', 'WO-325', 'WO-330'];
/** Finish DEMO tasks until the warning says the castle holds as it stands. Returns how many it took. */
async function closeUntilHeld(p, from = 0) {
  let n = 0;
  for (const id of FRESH.slice(from)) { if ((await D(p, 'horde')).forecast.tasks === 0) break; await closeOrder(p, id); n++; }
  return n;
}
async function playStage(p) {
  await go(p, 'stages'); await p.click('[data-stage="1"]'); await wait(p, 300);
  await p.keyboard.down('d'); await p.keyboard.down('j');
  for (let i = 0; i < 12; i++) { await p.keyboard.press(' ', { delay: 120 }); await wait(p, 260); }
  await p.keyboard.up('d'); await p.keyboard.up('j');
}

async function walk(theme) {
  const ctx = await chromium.newContext({ viewport: VIEW, deviceScaleFactor: 2, colorScheme: theme, timezoneId: 'UTC' });
  const p = await open(ctx);
  await p.click(`#seg-theme [data-theme="${theme}"]`);
  await phoneShot(p, `${theme}-01-start`);                       // the first onboarding card
  await clearCards(p); await wait(p, 500);
  await phoneShot(p, `${theme}-02-castle-warning`);              // the castle, the horde announced, the count of tasks
  await closeOrder(p, 'WO-304', true);
  await phoneShot(p, `${theme}-03-drop-card`);                   // a finished task: the drop and the piece it adds
  await clearCards(p); await wait(p, 1700); await clearCards(p);
  await closeUntilHeld(p, 1); await go(p, 'castle'); await clearCards(p); await wait(p, 400);
  await phoneShot(p, `${theme}-04-castle-grown`);                // the castle after the closes: the warning now says it holds
  await p.click('[data-days="1"]'); await p.click('[data-days="1"]'); await p.click('[data-days="1"]'); await wait(p, 7000);
  await phoneShot(p, `${theme}-05-horde`);                       // the horde at the walls, the towers firing, nobody at the pad
  await p.click('#skipFight'); await wait(p, 300);
  await phoneShot(p, `${theme}-06-summary`);
  await clearCards(p); await go(p, 'stages');
  await phoneShot(p, `${theme}-07-stages`);
  await playStage(p);
  await phoneShot(p, `${theme}-08-stage`);
  const posts = (await D(p, 'stage')).posts; await p.evaluate((x) => FieldworksDebug.place(x), posts[0] - 2); await wait(p, 300);
  await phoneShot(p, `${theme}-09-waypoint-card`);
  await p.evaluate(() => { FieldworksDebug.clearFoes(); FieldworksDebug.place(FieldworksDebug.stage().goal - 30); }); await p.keyboard.down('d'); await wait(p, 900); await p.keyboard.up('d'); await wait(p, 200);
  await phoneShot(p, `${theme}-10-stage-clear`);
  await p.click('[data-act="castle"]'); await go(p, 'keeper'); await p.locator('#paintcard').scrollIntoViewIfNeeded(); await wait(p, 150);
  await phoneShot(p, `${theme}-11-keeper`);
  await go(p, 'home');
  await phoneShot(p, `${theme}-12-home`);
  if (theme === 'light') {
    await go(p, 'castle'); await clearCards(p);
    for (const st of ['unlit', 'dark', 'quiet']) { await p.click(`[data-state="${st}"]`); await wait(p, 400); await phoneShot(p, `${theme}-13-state-${st}`); }
    await p.click('[data-state="live"]');
    await p.click('#reset'); await clearCards(p); await p.click('[data-days="now"]'); await wait(p, 300); await p.click('#skipFight'); await clearCards(p); await wait(p, 400);
    await phoneShot(p, `${theme}-14-breached-dim`);              // a horde met unready: the walls dim, nothing taken
  }
  await ctx.close();
}

// Home's fit is measured in the 375 × 667 frame itself (a wide page, so the dev bar does not shrink the frame).
async function homeFit() {
  for (const theme of ['light', 'dark']) {
    const ctx = await chromium.newContext({ viewport: { width: 900, height: 900 }, colorScheme: theme });
    const p = await open(ctx); await go(p, 'home');
    const fit = await p.evaluate(() => { const c = document.querySelector('.content'), ph = document.getElementById('phone'), t = document.getElementById('playtile'); return { w: ph.clientWidth, h: ph.clientHeight, scroll: c.scrollHeight, client: c.clientHeight, tile: t.scrollHeight <= t.clientHeight, text: t.innerText.replace(/\s+/g, ' ') }; });
    check(`Home fits the ${fit.w} × ${fit.h} frame without scrolling (${theme})`, fit.w === 375 && fit.h === 667 && fit.scroll <= fit.client && fit.tile, `${fit.scroll} ≤ ${fit.client} px; the tile: ${fit.text}`);
    check(`the Home tile carries the horde's countdown and a count, never a title (${theme})`, /Horde in 3 days · \d tasks to hold/.test(fit.text), fit.text);
    await ctx.close();
  }
}

async function behaviours() {
  let ctx = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' });
  let p = await open(ctx); await clearCards(p);
  const fresh = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), events: await D(p, 'events'), horde: await D(p, 'horde') };

  // 1. the warning: announced days ahead, with a count of tasks (never a title)
  check('the horde is announced three days ahead with a count of tasks that would see the castle hold', fresh.horde.line === 'Horde in 3 days' && /^\d finished tasks? would see it hold\.$/.test(fresh.horde.need) && fresh.horde.forecast.tasks > 0, `${fresh.horde.line} · ${fresh.horde.need} · ${fresh.horde.forecast.n} machines`);

  // 2. a finished task builds a piece of the castle (and only that does)
  await closeOrder(p, 'WO-304', true);
  const card = await p.locator('.dropcard').innerText();
  await clearCards(p); await wait(p, 1700); await clearCards(p);
  const c1 = await D(p, 'castle'); const x1 = await D(p, 'xp');
  check('a closed order adds a piece to the castle, named on its drop card, and pays XP', c1.pieces === fresh.castle.pieces + 1 && c1.count.keep === fresh.castle.count.keep + 1 && /A keep level added to the castle/.test(card) && x1 > fresh.xp, `pieces ${fresh.castle.pieces} → ${c1.pieces}; keep ${fresh.castle.count.keep} → ${c1.count.keep}; XP ${fresh.xp} → ${x1}`);
  const took = 1 + await closeUntilHeld(p, 1);
  const h2 = await D(p, 'horde');
  check('finishing tasks lowers the count until the warning says the castle holds', h2.forecast.tasks === 0 && h2.need === 'The castle holds as it stands.' && took <= fresh.horde.forecast.tasks + 1, `${took} tasks finished (the warning asked for ${fresh.horde.forecast.tasks}); now: ${h2.need}`);

  // 3. the horde comes on its day and the castle holds it on its own: no key is pressed
  await go(p, 'castle'); await clearCards(p);
  await p.click('[data-days="1"]'); await p.click('[data-days="1"]');
  check('the horde does not come early', (await D(p, 'fight')) === null && (await D(p, 'horde')).line === 'Horde in 1 day');
  const beforeFight = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), level: await D(p, 'level') };
  await p.click('[data-days="1"]'); await wait(p, 400);
  check('… and arrives on the third day, on the castle screen', (await D(p, 'fight')) !== null && (await D(p, 'screen')) === 'castle');
  await p.waitForSelector('[data-outcome]', { timeout: 150000 });
  const sum = await p.locator('.paper').innerText(); const outcome = await p.locator('[data-outcome]').getAttribute('data-outcome');
  const hist = (await D(p, 'horde')).history;
  check('the castle holds the horde on its own (nobody at the pad), as the warning forecast', outcome === 'held' && h2.forecast.outcome === 'held' && !/You downed/.test(sum), `forecast ${h2.forecast.outcome} → fought ${outcome}; ${sum.replace(/s+/g, ' ').slice(0, 150)}`);
  check('the summary says what held and which tower mattered', /machines downed/i.test(sum) && /Wall \d+% standing/i.test(sum) && /(Tower \d|The keep) mattered most/i.test(sum) && hist.length === 1);
  const afterFight = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), level: await D(p, 'level') };
  check('a horde takes nothing: every piece, the XP and the level stand', JSON.stringify(afterFight) === JSON.stringify(beforeFight));
  await clearCards(p);

  // 4. a stage is played and its score pays no XP and no castle piece
  const before = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), events: await D(p, 'events') };
  await playStage(p);
  const st = await D(p, 'stage');
  check('a stage is played with the keyboard: the Keeper runs, jumps and scores', st.x > 80 && st.score > 0, `x ${Math.round(st.x)} · score ${st.score}`);
  await p.evaluate(() => { FieldworksDebug.clearFoes(); FieldworksDebug.place(FieldworksDebug.stage().goal - 30); }); await p.keyboard.down('d'); await p.waitForSelector('[data-result="clear"]', { timeout: 8000 }); await p.keyboard.up('d');
  const score = Number(await p.locator('[data-score]').getAttribute('data-score')); const play = await D(p, 'play');
  const after = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), events: await D(p, 'events') };
  check('a cleared stage keeps its score as the best, on the device', score >= 1000 && play.best.w1 && play.best.w1.score === score, `score ${score}; best ${play.best.w1 && play.best.w1.score}`);
  check('stage score pays no XP, no event and no castle piece', JSON.stringify(after) === JSON.stringify(before), `XP ${before.xp} → ${after.xp}; events ${before.events} → ${after.events}; pieces ${before.castle.pieces} → ${after.castle.pieces}`);
  await p.click('[data-act="castle"]'); await go(p, 'keeper');
  const paints = await p.locator('[data-paint]').evaluateAll((bs) => bs.map((b) => [b.dataset.paint, !b.disabled]));
  check('play score unlocks paint and nothing else (the Keeper screen says so)', paints[0][1] && paints.some(([, on]) => !on) && /Looks only/.test(await p.locator('#paintcard').innerText()), paints.map(([k, on]) => `${k}:${on ? 'open' : 'locked'}`).join(' '));

  // 5. a survey in a stage is evidence: the lesson's tick adds a course of stone
  await go(p, 'stages'); await p.click('[data-stage="1"]'); await wait(p, 200);
  check('a surveyed waypoint reads surveyed and offers nothing', await (async () => { const x = (await D(p, 'stage')).posts[0]; await p.evaluate((v) => FieldworksDebug.place(v), x - 2); await wait(p, 300); return (await p.locator('#wpcard').isVisible()) && /Week 1 · lesson 1 of 4/.test(await p.locator('#wpcard').innerText()) && (await p.locator('[data-survey]').isDisabled()); })());
  await go(p, 'stages'); await p.evaluate(() => document.querySelector('[data-stage="2"]').click()); await wait(p, 200);
  const openStage = await D(p, 'stage');

  // 6. the save: a reload keeps the castle, the horde's clock and the scores
  const save1 = JSON.parse(await p.evaluate(() => { dispatchEvent(new Event('pagehide')); return localStorage.getItem('fieldworks-save'); }));
  const live1 = { castle: await D(p, 'castle'), play: await D(p, 'play'), horde: (await D(p, 'horde')).clock };
  await p.reload(); await wait(p, 400);
  const live2 = { castle: await D(p, 'castle'), play: await D(p, 'play'), horde: (await D(p, 'horde')).clock };
  check('a reload keeps the castle, the horde clock and the best score', JSON.stringify(live1) === JSON.stringify(live2) && live2.castle.pieces > fresh.castle.pieces && save1.map === undefined && save1.journal.closed.length === took, `pieces ${live2.castle.pieces} (a fresh device has ${fresh.castle.pieces}); the save holds a journal of ${save1.journal.closed.length} closes and no map`);
  check('onboarding shows once (not again after a reload)', (await p.locator('[data-onboard]').count()) === 0 && (await p.evaluate(() => localStorage.getItem('fieldworks-onboarded'))) === '1');
  void openStage;
  // the page saves on pagehide, so a tamper is made from the art sheet (same origin; art mode never saves), then the page is loaded
  const tamperAndLoad = async (fn) => { await p.goto(ART); await p.evaluate(fn); await p.goto(PAGE); await wait(p, 300); };
  await tamperAndLoad(() => { const s = JSON.parse(localStorage.getItem('fieldworks-save')); s.rules = 1; localStorage.setItem('fieldworks-save', JSON.stringify(s)); });
  const ov1 = await p.locator('#overlay').innerText();
  check('a save from other rules loads under the current rules and says so', /older rules/.test(ov1) && (await D(p, 'castle')).pieces === live2.castle.pieces, ov1.replace(/\s+/g, ' ').slice(0, 90));
  await p.reload(); await wait(p, 300);
  check('… once', !/older rules/.test(await p.locator('#overlay').innerText()));
  await tamperAndLoad(() => { const s = JSON.parse(localStorage.getItem('fieldworks-save')); localStorage.setItem('fieldworks-save', JSON.stringify({ version: 1, rules: 1, journal: { ...s.journal, clock: 'short', partsAct: false, modules: [], pendingModules: 0, landed: [] }, map: { day: 3 } })); });
  const ov3 = await p.locator('#overlay').innerText();
  check('a save from the old fortress game keeps its evidence: the castle stands on it, and the page says so', /old fortress map/.test(ov3) && (await D(p, 'castle')).pieces === live2.castle.pieces, ov3.replace(/\s+/g, ' ').slice(0, 90));
  await tamperAndLoad(() => localStorage.setItem('fieldworks-save', '{not json'));
  check('an unreadable save is discarded with a toast and the castle still stands on its evidence', /could not be read/.test(await p.locator('#overlay').innerText()) && (await D(p, 'castle')).pieces === fresh.castle.pieces);
  await clearCards(p); await go(p, 'keeper'); await p.fill('#kname', 'Unit seven'); await p.click('[data-name]'); await go(p, 'castle'); await clearCards(p);
  const keys = await p.evaluate(() => Object.keys(localStorage).sort());
  check('the page keeps exactly its four named keys', JSON.stringify(keys) === JSON.stringify(['fieldworks-keeper', 'fieldworks-onboarded', 'fieldworks-save', 'fieldworks-telemetry']), keys.join(', '));

  // 7. an unready castle: the wall is breached, nothing is taken, and the next evidence relights it
  await p.click('#reset'); await clearCards(p);
  const b0 = { castle: await D(p, 'castle'), xp: await D(p, 'xp') };
  await p.click('[data-days="now"]'); await wait(p, 300);
  // 8. a reload in the middle of a fight resolves it with the same stepping function and shows the summary
  await p.reload(); await p.waitForSelector('[data-outcome]', { timeout: 5000 });
  const out2 = await p.locator('[data-outcome]').getAttribute('data-outcome'); await clearCards(p);
  const b1 = { castle: await D(p, 'castle'), xp: await D(p, 'xp') }; const hd = await D(p, 'horde');
  check('a horde that arrived while the page was shut is resolved and its summary shown', out2 === fresh.horde.forecast.outcome && hd.history.length === 1 && hd.arrived === null, `forecast ${fresh.horde.forecast.outcome} → resolved ${out2}`);
  check('a breach dims the walls and takes nothing', out2 !== 'held' && hd.dim === true && JSON.stringify(b1) === JSON.stringify(b0) && /breached and dim/.test(hd.need), hd.need);
  await closeOrder(p, 'WO-318');
  check('the next finished task relights the walls', (await D(p, 'horde')).dim === false && (await D(p, 'castle')).pieces === b0.castle.pieces + 1);

  // 9. the unread state: the horde clock gathers nothing and says so (never a zero it did not measure)
  await go(p, 'castle'); await clearCards(p);
  const g0 = (await D(p, 'horde')).clock.gather;
  await p.click('[data-state="unlit"]'); await p.click('[data-days="7"]'); await wait(p, 200);
  const hu = await D(p, 'horde');
  check('an unread backlog leaves the horde clock unlit: seven days gather nothing', hu.clock.gather === g0 && /unread/i.test(hu.line), `${hu.line}; gathered ${g0} → ${hu.clock.gather}`);
  await p.click('[data-state="live"]'); await p.click('[data-days="7"]'); await wait(p, 200);
  const hl = await D(p, 'horde');
  check('… and read again it gathers, inside the gap rule', hl.clock.gather > g0 || hl.clock.due !== null, `${hl.line}`);
  await ctx.close();

  // 10. touch: the pad's buttons drive the Keeper on a phone
  ctx = await chromium.newContext({ viewport: VIEW, hasTouch: true, isMobile: true, timezoneId: 'UTC' });
  p = await open(ctx); await clearCards(p);
  await go(p, 'stages'); await p.click('[data-stage="1"]'); await wait(p, 300);
  await p.locator('.pad').scrollIntoViewIfNeeded(); await wait(p, 200);
  const x0 = (await D(p, 'stage')).x;
  const right = await p.locator('[data-key="right"]').boundingBox(), jump = await p.locator('[data-key="jump"]').boundingBox();
  const hold = async (b, ms) => { const cdp = await ctx.newCDPSession(p); const pt = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] }); await wait(p, ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  await hold(right, 700); const x1t = (await D(p, 'stage')).x; const y0 = (await D(p, 'stage')).y;
  const cdp2 = await ctx.newCDPSession(p); await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(jump.x + jump.width / 2), y: Math.round(jump.y + jump.height / 2) }] }); await wait(p, 180); const yUp = (await D(p, 'stage')).y; await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('touch: holding the pad\'s right button runs the Keeper, and jump lifts it', x1t > x0 + 20 && yUp < y0 - 4 && right.height >= 44 && jump.height >= 44, `x ${Math.round(x0)} → ${Math.round(x1t)}; y ${Math.round(y0)} → ${Math.round(yUp)}; buttons ${Math.round(right.width)} × ${Math.round(right.height)} px`);
  const view = (await D(p, 'stage')).view; const css = await p.locator('#game').evaluate((c) => [c.clientWidth, c.clientHeight, c.width, c.height]);
  check('the pixels are whole: the canvas is drawn at a whole-number scale', css[0] % css[2] === 0 && css[0] / css[2] === css[1] / css[3] && css[2] === view[0], `${css[2]} × ${css[3]} drawn at ${css[0]} × ${css[1]} (×${css[0] / css[2]})`);
  await ctx.close();
}

/** The public site's game page: signed out, so it starts empty and the Wilds are the whole game. */
async function signedOut() {
  const dir = mkdtempSync(join(tmpdir(), 'fieldworks-site-')); const { assemble } = await import('./site.mjs'); assemble(join(dir, 'site'));
  const url = pathToFileURL(join(dir, 'site', 'index.html')).href;
  const ctx = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await wait(p, 400);
  const startText = await (async () => { for (let i = 0; i < 6; i++) { const n = p.locator('[data-act="next"]'); if (!(await n.count())) break; await n.click(); await wait(p, 100); } return p.locator('#overlay').innerText(); })();
  await clearCards(p);
  const c0 = await D(p, 'castle'), h0 = await D(p, 'horde'), ev0 = await D(p, 'events'), xp0 = await D(p, 'xp');
  check('signed out: the castle starts empty, with no evidence, no XP and no horde', c0.pieces === 0 && ev0 === 0 && xp0 === 0 && !h0.clock.due && h0.forecast === null && h0.line === 'No horde gathering', `${c0.pieces} pieces · ${ev0} events · ${xp0} XP · ${h0.line}`);
  check('… and says why, on the start card and under the horde line', /Signed out, so nothing is built here/.test(startText) && h0.need === 'Built only by work finished in SocialOS', h0.need);
  const chrome = await p.evaluate(() => ({ dev: getComputedStyle(document.querySelector('.wrap > .dev')).display, home: getComputedStyle(document.getElementById('homebtn').parentElement).display, brand: document.querySelector('.ribbon .brand').textContent, create: getComputedStyle(document.querySelector('.ribbon .pill.lit')).display, strip: [...document.querySelectorAll('.strip [data-go]')].map((b) => b.dataset.go) }));
  check('… and shows nothing that reads an account: no backlog, Home, Create or prototype controls', chrome.dev === 'none' && chrome.home === 'none' && chrome.create === 'none' && chrome.brand === 'Fieldworks' && JSON.stringify(chrome.strip) === '["stages","keeper"]', JSON.stringify(chrome));
  await phoneShot(p, 'signed-out-castle');
  await p.click('.strip [data-go="stages"]'); await wait(p, 200);
  const stages = await p.locator('[data-stage]').evaluateAll((els) => els.map((e) => e.dataset.stage));
  check('signed out: the stage list is the Wilds alone (the roadmap is the account\'s)', JSON.stringify(stages) === '["0"]', stages.join(', '));
  await phoneShot(p, 'signed-out-stages');
  await p.click('[data-stage="0"]'); await wait(p, 300);
  await p.keyboard.down('d'); await p.keyboard.down('j');
  for (let i = 0; i < 10; i++) { await p.keyboard.press(' ', { delay: 120 }); await wait(p, 240); }
  await p.keyboard.up('d'); await p.keyboard.up('j');
  const st = await D(p, 'stage'), c1 = await D(p, 'castle');
  check('signed out: the Wilds play, and their score builds nothing', st && st.week === 0 && st.x > 80 && (st.score > 0 || st.hp < (await D(p, 'hearts'))) && c1.pieces === 0 && (await D(p, 'events')) === 0 && (await D(p, 'xp')) === 0, st ? `x ${Math.round(st.x)} · score ${st.score}; pieces ${c1.pieces}` : 'no stage');
  // a device that opened the DEMO build earlier carries its journal and announced horde: signed out, none of it replays
  // planted from pagehide and visibilitychange listeners added after the page's own, so its save-on-hide cannot overwrite it
  await p.evaluate(() => { const plant = () => localStorage.setItem('fieldworks-save', JSON.stringify({ version: 2, rules: 'x', journal: { closed: ['WO-304'], ticks: ['w1a', 'w4c'], lifts: ['2026-11-09'], lastLevel: 3 }, play: { best: { w1: { score: 900, stars: 3 } }, wilds: { best: 120, runs: 1 }, paint: 'verdigris', wall: 500 }, horde: { day: 0, clock: { gather: 0, warned: '2026-11-09', due: '2026-11-12', count: 0, last: null, horde: { n: 12, bosses: 0, ordinal: 0 } }, history: [], dim: false, arrived: null, fresh: 50 } })); addEventListener('pagehide', plant); document.addEventListener('visibilitychange', plant); });
  await p.reload(); await wait(p, 400); await clearCards(p);
  const c2 = await D(p, 'castle'), h2 = await D(p, 'horde'), pl = await D(p, 'play');
  check('signed out: an earlier DEMO save replays no evidence and no horde, and keeps its Wilds score alone', c2.pieces === 0 && (await D(p, 'events')) === 0 && !h2.clock.due && pl.wilds.best === 120 && pl.total === 120 && !pl.best.w1, `pieces ${c2.pieces}; horde ${h2.line}; wilds best ${pl.wilds.best}; play total ${pl.total}`);
  await ctx.close(); rmSync(dir, { recursive: true, force: true });
}

async function perfScene(name, setup) {
  const ctx = await chromium.newContext({ viewport: VIEW, deviceScaleFactor: 2, timezoneId: 'UTC' });
  const p = await open(ctx); await clearCards(p); await setup(p);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
  await p.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const t0 = Date.now(); await wait(p, 6000); const secs = (Date.now() - t0) / 1000;
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const frames = await p.evaluate(() => window.__frames);
  const task = (m1.TaskDuration - m0.TaskDuration) * 1000, script = (m1.ScriptDuration - m0.ScriptDuration) * 1000;
  const res = { scene: name, viewport: '375 × 667 @2×', seconds: Math.round(secs * 10) / 10, frames, fps: Math.round(frames / secs), main_thread_ms_per_frame: Math.round((task / frames) * 100) / 100, script_ms_per_frame: Math.round((script / frames) * 100) / 100, heap_mb: Math.round(m1.JSHeapUsedSize / 1048576 * 10) / 10, heap_growth_kb: Math.round((m1.JSHeapUsedSize - m0.JSHeapUsedSize) / 1024) };
  await p.keyboard.up('d'); await p.keyboard.up('j'); await ctx.close();
  console.log(`perf: ${JSON.stringify(res)}`);
  check(`a frame stays inside the 16.7 ms budget on the main thread (${name})`, res.main_thread_ms_per_frame < 16.7, `${res.main_thread_ms_per_frame} ms · ${res.fps} fps`);
  return res;
}
async function perf() {
  const horde = await perfScene('a horde at the walls, the towers firing', async (p) => { await p.click('[data-days="now"]'); await wait(p, 2500); });
  const stage = await perfScene('a stage, running and firing', async (p) => { await go(p, 'stages'); await p.click('[data-stage="0"]'); await wait(p, 300); await p.keyboard.down('d'); await p.keyboard.down('j'); });
  writeFileSync(join(OUT, 'perf.json'), JSON.stringify({ horde, stage }, null, 2) + '\n');
}

async function artSheet() {
  for (const theme of ['light', 'dark']) {
    const ctx = await chromium.newContext({ viewport: { width: 960, height: 1400 }, deviceScaleFactor: 1, colorScheme: theme });
    const p = await open(ctx, ART); await p.waitForSelector('html[data-ready="1"]');
    await p.locator('.wrap').screenshot({ path: join(OUT, `art-sheet-${theme}.png`) });
    await ctx.close();
  }
  check('the art sheet renders in both themes', true);
}

const b = await chromium.launch();
chromium.newContext = (o) => b.newContext(o);
try {
  for (const theme of ['light', 'dark']) await walk(theme);
  await homeFit(); await behaviours(); await signedOut(); await perf(); await artSheet();
} finally { await b.close(); }
check('no page error anywhere in the walk', errors.length === 0, errors.slice(0, 3).join(' | '));
writeFileSync(join(OUT, 'checks.json'), JSON.stringify(results, null, 2) + '\n');
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
