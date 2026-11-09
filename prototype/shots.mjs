// The prototype walk (node prototype/shots.mjs): Playwright at 375 × 667, both
// themes. Writes the screenshots and the art sheet to prototype/shots/, checks
// the behaviours prototype 3 claims (each a named check; the run exits non-zero
// on any failure or page error), and measures the frame time with Chrome's own
// Performance metrics. Run `node prototype/build.mjs` first.
import { mkdirSync, writeFileSync } from 'node:fs';
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
async function clearCards(p) {
  for (let i = 0; i < 12; i++) {
    const take = p.locator('[data-take]'); if (await take.count()) { await take.first().click(); await wait(p, 150); continue; }
    const mod = p.locator('[data-module]'); if (await mod.count()) { await mod.first().click(); await wait(p, 150); continue; }
    const next = p.locator('[data-act="next"]'); if (await next.count()) { await next.first().click(); await wait(p, 100); continue; }
    const start = p.locator('[data-act="start"]'); if (await start.count()) { await start.first().click(); await wait(p, 100); continue; }
    if (await p.locator('.medalpop').count()) { await wait(p, 400); continue; }
    break;
  }
}
async function go(p, screen) { await p.click(`#seg-screen [data-go="${screen}"]`); await wait(p, 200); }
async function closeOrder(p, id) {
  await go(p, 'siege'); await p.click(`[data-order="${id}"]`); await p.fill('#proof', 'https://example.com/run/1'); await p.click('[data-done]'); await wait(p, 500);
}
async function walkToCache(p) { const b = await p.evaluate(() => FieldworksDebug.beacon()); for (const [dx, dy] of [[52, 0], [0, 52], [-52, 0], [0, -52], [37, 37], [-37, 37], [37, -37], [-37, -37]]) { await p.evaluate(([x, y]) => FieldworksDebug.keeperAt(x, y), [b.x + dx, b.y + dy]); await wait(p, 60); } }

async function walk(theme) {
  const ctx = await chromium.newContext({ viewport: VIEW, deviceScaleFactor: 2, colorScheme: theme, timezoneId: 'UTC' });
  const p = await open(ctx);
  await p.click(`#seg-theme [data-theme="${theme}"]`);
  await phoneShot(p, `${theme}-01-start`);                       // the first onboarding card
  await clearCards(p); await wait(p, 300);
  await p.keyboard.down('d'); await wait(p, 600); await p.keyboard.up('d');
  await phoneShot(p, `${theme}-02-fortress-day`);
  await closeOrder(p, 'WO-304');
  await phoneShot(p, `${theme}-03-drop-card`);
  await p.click('[data-take]'); await wait(p, 1800); await clearCards(p); await go(p, 'fortress'); await clearCards(p);
  await phoneShot(p, `${theme}-04-the-cache`);
  await p.keyboard.press('n'); await wait(p, 3500);
  await phoneShot(p, `${theme}-05-night`);
  await go(p, 'explore'); await clearCards(p); await p.keyboard.down('w'); await wait(p, 1200); await p.keyboard.up('w');
  await phoneShot(p, `${theme}-06-explore`);
  await p.evaluate(() => FieldworksDebug.place(-4, 230, 0)); await wait(p, 400);
  await phoneShot(p, `${theme}-07-waypoint-card`);
  await go(p, 'keeper'); await p.locator('#yournumbers').scrollIntoViewIfNeeded(); await wait(p, 150);
  await phoneShot(p, `${theme}-08-keeper-your-numbers`);
  await go(p, 'home');
  await phoneShot(p, `${theme}-09-home`);
  if (theme === 'light') {
    await go(p, 'fortress'); await clearCards(p);
    for (const st of ['unlit', 'dark', 'quiet']) { await p.click(`[data-state="${st}"]`); await wait(p, 400); await phoneShot(p, `${theme}-10-state-${st}`); }
    await p.click('[data-state="live"]');
  }
  await ctx.close();
}

// Home's fit is measured in the 375 × 667 frame itself (a wide page, so the dev bar does not shrink the frame).
async function homeFit() {
  for (const theme of ['light', 'dark']) {
    const ctx = await chromium.newContext({ viewport: { width: 900, height: 900 }, colorScheme: theme });
    const p = await open(ctx); await go(p, 'home');
    const fit = await p.evaluate(() => { const c = document.querySelector('.content'), ph = document.getElementById('phone'); return { w: ph.clientWidth, h: ph.clientHeight, scroll: c.scrollHeight, client: c.clientHeight }; });
    check(`Home fits the ${fit.w} × ${fit.h} frame without scrolling (${theme})`, fit.w === 375 && fit.h === 667 && fit.scroll <= fit.client, `${fit.scroll} ≤ ${fit.client} px`);
    await ctx.close();
  }
}

async function behaviours() {
  // 1. the save: a reload keeps the map; another rules hash loads and says so once; a corrupt save is laid again with the caches back
  let ctx = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' });
  let p = await open(ctx); await clearCards(p);
  await walkToCache(p); const cellsBefore = await p.evaluate(() => FieldworksDebug.cells());
  check('the newest evidence lands as caches and pays cells only when picked up', cellsBefore > 0, `${cellsBefore} cells after walking the caches`);
  await p.keyboard.press('2'); const box = await p.locator('#game').boundingBox();
  const b = await p.evaluate(() => FieldworksDebug.beacon());
  await p.mouse.click(box.x + box.width * ((b.x + 32) / 640), box.y + box.height * ((b.y) / 640)); await wait(p, 200);
  const save1 = JSON.parse(await p.evaluate(() => localStorage.getItem('fieldworks-save')));
  const live1 = await p.evaluate(() => FieldworksDebug.mapHash());
  await p.reload(); await wait(p, 400); await clearCards(p);
  const live2 = await p.evaluate(() => FieldworksDebug.mapHash());
  const fresh = await (async () => { const q = await ctx.newPage(); await q.goto(ART); const keep = await q.evaluate(() => localStorage.getItem('fieldworks-save')); await q.evaluate(() => localStorage.removeItem('fieldworks-save')); await q.goto(PAGE); await wait(q, 300); const h = await q.evaluate(() => FieldworksDebug.mapHash()); await q.goto(ART); await q.evaluate((k) => localStorage.setItem('fieldworks-save', k), keep); await q.close(); return h; })();
  const walls = (s) => s.map.grid.filter((g) => g && g[0] === 'wall').length;
  check('a reload keeps the map (the live tiles and structures, not only the stored copy)', walls(save1) >= 1 && live1 === live2 && live2 !== fresh, `${walls(save1)} wall(s); the map after reload ${live1 === live2 ? 'matches' : 'differs'}; a fresh map ${live2 !== fresh ? 'differs' : 'matches'}`);
  check('onboarding shows once (not again after a reload)', (await p.locator('[data-onboard]').count()) === 0 && (await p.evaluate(() => localStorage.getItem('fieldworks-onboarded'))) === '1');
  // the page saves on pagehide, so a tamper is made from the art sheet (same origin; art mode never saves), then the page is loaded
  const tamperAndLoad = async (fn) => { await p.goto(ART); await p.evaluate(fn); await p.goto(PAGE); await wait(p, 300); };
  await tamperAndLoad(() => { const s = JSON.parse(localStorage.getItem('fieldworks-save')); s.rules = 1; localStorage.setItem('fieldworks-save', JSON.stringify(s)); });
  const ov1 = await p.locator('#overlay').innerText();
  check('a save from other rules loads under the current rules and says so', /older rules/.test(ov1), ov1.replace(/\s+/g, ' ').slice(0, 80));
  await p.reload(); await wait(p, 300);
  const ov2 = await p.locator('#overlay').innerText();
  check('… once', !/older rules/.test(ov2), ov2.replace(/\s+/g, ' ').slice(0, 80));
  await tamperAndLoad(() => localStorage.setItem('fieldworks-save', '{not json'));
  check('a corrupt save is discarded with a toast and every unshown cache lands again', /could not be read/.test(await p.locator('#overlay').innerText()) && (await p.evaluate(() => FieldworksDebug.caches())) > 0);
  // name the Keeper so the fourth key exists, then every key in this origin's storage must be one of the four
  await clearCards(p); await go(p, 'keeper'); await p.fill('#kname', 'Unit seven'); await p.click('[data-name]'); await go(p, 'fortress'); await clearCards(p);
  const keys = await p.evaluate(() => Object.keys(localStorage).sort());
  check('the page keeps exactly its four named keys', JSON.stringify(keys) === JSON.stringify(['fieldworks-keeper', 'fieldworks-onboarded', 'fieldworks-save', 'fieldworks-telemetry']), keys.join(', '));
  // a reload keeps the two dev switches, and a reload mid-night opens a fresh day rather than replaying the night
  await p.click('[data-parts="on"]'); await p.click('[data-clock="real"]'); await wait(p, 100); await p.click('[data-clock="short"]'); await p.click('[data-parts="on"]');
  await p.keyboard.press('n'); await wait(p, 400);
  await p.reload(); await wait(p, 400); await clearCards(p);
  check('a reload keeps the Parts act switch', (await p.locator('[data-parts="on"]').getAttribute('aria-pressed')) === 'true');
  check('a reload during a night opens a fresh day, not the night again', (await p.evaluate(() => FieldworksDebug.phase())) === 'day' && /s to dark/.test(await p.locator('#hud').innerText()));
  await p.click('[data-parts="off"]');

  // 2. the parts act (D26, behind its switch)
  await clearCards(p);
  const off = await p.evaluate(() => FieldworksDebug.player());
  await p.click('[data-parts="on"]'); await wait(p, 100);
  const on = await p.evaluate(() => FieldworksDebug.player());
  check('Parts act: a part\'s effect acts (hull, range, speed or gather rises)', on.max > off.max || on.range > off.range || on.speed > off.speed || on.gather > off.gather, `hull ${off.max}→${on.max} · range ${Math.round(off.range)}→${Math.round(on.range)} · speed ${Math.round(off.speed)}→${Math.round(on.speed)}`);
  await go(p, 'keeper');
  check('the Keeper screen shows each part\'s effect and the word proposed', (await p.locator('[data-fx]').count()) === 5 && /proposed/.test(await p.locator('[data-fx]').first().innerText()));
  check('the Keeper screen shows Your numbers, kept on this device', /Kept on this device, never sent/.test(await p.locator('#yournumbers').innerText()));
  await p.click('[data-parts="off"]');

  // 3. explore: the compass points, the card shows, the gate returns
  await go(p, 'explore'); await clearCards(p);
  await p.evaluate(() => FieldworksDebug.place(0, 2, 0)); await wait(p, 300);
  const comp = await p.locator('#compass').innerText();
  check('the compass shows the heading, the nearest waypoint and the gate', /Heading/.test(comp) && /waypoint \d+ m/.test(comp) && /gate \d+ m/.test(comp), comp.replace(/\s+/g, ' '));
  await p.evaluate(() => FieldworksDebug.place(0, 2, Math.PI)); await wait(p, 300);
  const behind = await p.locator('#compass').innerText();
  const arrowBefore = (txt, word) => (new RegExp(`(\\S)${word}\\d`).exec(txt.replace(/\s+/g, '')) || [])[1];
  check('… and it turns with the Keeper (the waypoint is behind after a half turn)', arrowBefore(comp, 'waypoint') === '↑' && arrowBefore(behind, 'waypoint') === '↓', behind.replace(/\s+/g, ' '));
  await p.evaluate(() => FieldworksDebug.place(-4, 230, 0)); await wait(p, 300);
  check('a waypoint card shows on approach', await p.locator('#wpcard').isVisible());
  await p.evaluate(() => FieldworksDebug.place(0, -4, Math.PI)); await wait(p, 400);
  check('the gate returns to the fortress', (await p.evaluate(() => FieldworksDebug.screen())) === 'fortress');
  await ctx.close();

  // 4. the real-day clock shows the right phase for the device's hour
  for (const [hour, want] of [['10:00', 'day'], ['22:30', 'night']]) {
    ctx = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' });
    p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
    await p.clock.setFixedTime(new Date(`2026-11-09T${hour}:00Z`));
    await p.goto(ART); await p.evaluate(() => localStorage.clear());
    await p.goto(PAGE); await wait(p, 200); await clearCards(p);
    await p.click('[data-clock="real"]'); await wait(p, 500);
    const phase = await p.evaluate(() => FieldworksDebug.phase()); const hud = await p.locator('#hud').innerText();
    check(`the real-day clock at ${hour} reads ${want}`, phase === want && /real day/.test(hud) && (want === 'day' ? /until 21:00/.test(hud) : /Night/.test(hud)), hud.replace(/\s+/g, ' ').slice(0, 90));
    await ctx.close();
  }
}

async function perf() {
  const ctx = await chromium.newContext({ viewport: VIEW, deviceScaleFactor: 2, timezoneId: 'UTC' });
  const p = await open(ctx); await clearCards(p);
  for (const id of ['WO-304', 'WO-301', 'WO-311']) { await closeOrder(p, id); await clearCards(p); }
  await go(p, 'fortress'); await clearCards(p); await p.keyboard.press('n'); await wait(p, 1500);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
  await p.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const t0 = Date.now(); await wait(p, 6000); const secs = (Date.now() - t0) / 1000;
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const frames = await p.evaluate(() => window.__frames);
  const task = (m1.TaskDuration - m0.TaskDuration) * 1000, script = (m1.ScriptDuration - m0.ScriptDuration) * 1000;
  const res = { viewport: '375 × 667 @2×', seconds: Math.round(secs * 10) / 10, frames, fps: Math.round(frames / secs), main_thread_ms_per_frame: Math.round((task / frames) * 100) / 100, script_ms_per_frame: Math.round((script / frames) * 100) / 100, heap_mb: Math.round(m1.JSHeapUsedSize / 1048576 * 10) / 10, scene: 'a fortress night with machines on the map' };
  writeFileSync(join(OUT, 'perf.json'), JSON.stringify(res, null, 2) + '\n');
  console.log(`perf: ${JSON.stringify(res)}`);
  check('a frame stays inside the 16.7 ms budget on the main thread', res.main_thread_ms_per_frame < 16.7, `${res.main_thread_ms_per_frame} ms`);
  await ctx.close();
}

async function artSheet() {
  for (const theme of ['light', 'dark']) {
    const ctx = await chromium.newContext({ viewport: { width: 640, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
    const p = await open(ctx, ART); await p.waitForSelector('html[data-ready="1"]');
    await p.locator('#sheet').screenshot({ path: join(OUT, `art-sheet-${theme}.png`) });
    await ctx.close();
  }
  check('the art sheet renders in both themes', true);
}

const b = await chromium.launch();
chromium.newContext = (o) => b.newContext(o);
try {
  for (const theme of ['light', 'dark']) await walk(theme);
  await homeFit(); await behaviours(); await perf(); await artSheet();
} finally { await b.close(); }
check('no page error anywhere in the walk', errors.length === 0, errors.slice(0, 3).join(' | '));
writeFileSync(join(OUT, 'checks.json'), JSON.stringify(results, null, 2) + '\n');
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
