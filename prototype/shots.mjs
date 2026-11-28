// The prototype walk (node prototype/shots.mjs): Playwright at 375 × 667, both
// themes. Writes the screenshots and the art sheet to prototype/shots/, checks
// the behaviours the prototype claims (each a named check; the run exits non-zero
// on any failure or page error), and measures the frame time with Chrome's own
// Performance metrics. Its last sections load the public site's page (signed out)
// and the embeddable build inside a tiny host page served from this repo.
// Run `node prototype/build.mjs` first.
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = await import('playwright')); }
const PAGE = pathToFileURL(join(here, 'index.html')).href;
const ART = pathToFileURL(join(here, 'art-sheet.html')).href;
const OUT = join(here, 'shots'); mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (/\.(png|json)$/.test(f)) unlinkSync(join(OUT, f));   // every run writes the whole set: no screenshot of an older game is left behind
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
    const up = p.locator('[data-up]'); if (await up.count()) { await up.first().click(); await wait(p, 120); continue; }
    const next = p.locator('[data-act="next"],[data-act="start"],[data-act="summary"]'); if (await next.count()) { await next.last().click(); await wait(p, 100); continue; }   // the topmost card first
    if (await p.locator('.medalpop').count()) { await wait(p, 400); continue; }
    break;
  }
}
async function go(p, screen) { await p.click(`#seg-screen [data-go="${screen}"]`); await wait(p, 200); }
/** Back to the castle from a run: a run walked away from banks its score on a result card first. */
async function leave(p) { await go(p, 'castle'); if (await p.locator('[data-act="castle"]').count()) { await p.locator('[data-act="castle"]').click(); await wait(p, 200); } await clearCards(p); }
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
/** Run right, hopping and firing (a press is a shot; a held key would charge), taking any pick that is offered. */
async function run(p, hops) {
  await p.keyboard.down('d');
  for (let i = 0; i < hops; i++) { if (await p.locator('[data-up]').count()) { await p.locator('[data-up]').first().click(); await p.keyboard.down('d'); } if (await p.locator('[data-result]').count()) break; await p.keyboard.press('j'); await p.keyboard.press(' ', { delay: 120 }); await p.keyboard.press('j'); await wait(p, 220); }
  await p.keyboard.up('d');
}
async function playStage(p, n = 1) { await go(p, 'stages'); await p.click(`[data-stage="${n}"]`); await wait(p, 300); await run(p, 9); }
const pick = async (p) => { await p.waitForSelector('[data-up]', { timeout: 4000 }); const slug = await p.locator('[data-up]').first().getAttribute('data-up'); await p.locator('[data-up]').first().click(); await wait(p, 150); return slug; };
/** Walk into the stage's arena, so its boss arrives; returns once the boss is on. */
async function toBoss(p) { await p.evaluate(() => { const s = FieldworksDebug.stage(); FieldworksDebug.clearFoes(); FieldworksDebug.place(s.arenas[s.arenas.length - 1].x + 36); }); await p.waitForFunction(() => FieldworksDebug.stage().boss, null, { timeout: 4000 }); }
async function downBoss(p) { await p.evaluate(() => FieldworksDebug.hitBoss(9999)); await p.waitForFunction(() => !FieldworksDebug.stage().boss, null, { timeout: 8000 }); await wait(p, 500); }
async function clearStage(p) { await p.evaluate(() => { FieldworksDebug.clearFoes(); FieldworksDebug.place(FieldworksDebug.stage().goal - 30); }); await p.keyboard.down('d'); await p.waitForSelector('[data-result="clear"]', { timeout: 8000 }); await p.keyboard.up('d'); }

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
  await phoneShot(p, `${theme}-07-stages`);                      // the Wilds, the two switches, the roadmap
  await p.locator('#metacard').scrollIntoViewIfNeeded(); await wait(p, 150);
  await phoneShot(p, `${theme}-08-play-powers-play`);            // what lifetime play score opens
  await playStage(p);
  await phoneShot(p, `${theme}-09-stage`);
  const posts = (await D(p, 'stage')).posts; await p.evaluate((x) => FieldworksDebug.place(x), posts[0] - 2); await p.waitForSelector('[data-up]');
  await phoneShot(p, `${theme}-10-upgrade-pick`);                // a checkpoint: one of three, for the run
  await pick(p); await wait(p, 300);
  await phoneShot(p, `${theme}-11-waypoint-card`);
  await p.evaluate(() => { const s = FieldworksDebug.stage(); FieldworksDebug.place(s.caches[0].x - 30); }); for (let i = 0; i < 6; i++) { await p.keyboard.press('j'); await wait(p, 230); } await p.keyboard.down('d'); await wait(p, 700); await p.keyboard.up('d'); await wait(p, 200);
  await phoneShot(p, `${theme}-12-secret`);                      // a cracked wall, broken: the alcove behind it
  await toBoss(p); await wait(p, 900);
  await phoneShot(p, `${theme}-13-boss-arrives`);
  await wait(p, 2600);
  await phoneShot(p, `${theme}-14-boss`);
  await downBoss(p); await clearStage(p); await wait(p, 200);
  await phoneShot(p, `${theme}-15-stage-clear`);
  await p.click('[data-act="castle"]'); await go(p, 'keeper'); await p.locator('#paintcard').scrollIntoViewIfNeeded(); await wait(p, 150);
  await phoneShot(p, `${theme}-16-keeper`);
  await go(p, 'home');
  await phoneShot(p, `${theme}-17-home`);
  // the worlds: the Wilds, dressed in each (two per theme)
  await go(p, 'stages'); await p.click('[data-stage="0"]'); await wait(p, 300);
  for (const slug of theme === 'light' ? ['canyon', 'frost'] : ['marsh', 'foundry']) { await p.evaluate((b) => FieldworksDebug.look(b), slug); await run(p, 3); await phoneShot(p, `${theme}-18-world-${slug}`); }
  if (theme === 'light') {
    await leave(p);
    for (const st of ['unlit', 'dark', 'quiet']) { await p.click(`[data-state="${st}"]`); await wait(p, 400); await phoneShot(p, `${theme}-19-state-${st}`); }
    await p.click('[data-state="live"]');
    await p.click('#reset'); await clearCards(p); await p.click('[data-days="now"]'); await wait(p, 300); await p.click('#skipFight'); await clearCards(p); await wait(p, 400);
    await phoneShot(p, `${theme}-20-breached-dim`);              // a horde met unready: the walls dim, nothing taken
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
  let p = await open(ctx);
  const fresh0 = { audio: await D(p, 'audio'), play: await D(p, 'play') };   // before any input: the page is silent
  await clearCards(p);
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
  check('the castle holds the horde on its own (nobody at the pad), as the warning forecast', outcome === 'held' && h2.forecast.outcome === 'held' && !/You downed/.test(sum), `forecast ${h2.forecast.outcome} → fought ${outcome}; ${sum.replace(/\s+/g, ' ').slice(0, 150)}`);
  check('the summary says what held and which tower mattered', /machines downed/i.test(sum) && /Wall \d+% standing/i.test(sum) && /(Tower \d|The keep) mattered most/i.test(sum) && hist.length === 1);
  const afterFight = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), level: await D(p, 'level') };
  check('a horde takes nothing: every piece, the XP and the level stand', JSON.stringify(afterFight) === JSON.stringify(beforeFight));
  await clearCards(p);

  // 4. a stage is played and its score pays no XP and no castle piece
  const before = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), level: await D(p, 'level'), events: await D(p, 'events') };
  check('no sound before the first input; music after it', fresh0.audio.started === false && (await D(p, 'audio')).started === true && (await D(p, 'audio')).wanted !== '', `before: ${JSON.stringify(fresh0.audio)}; now: ${JSON.stringify(await D(p, 'audio'))}`);
  await playStage(p);
  const st = await D(p, 'stage');
  check('a stage is played with the keyboard: the Keeper runs, jumps and scores', st.x > 80 && st.score > 0, `x ${Math.round(st.x)} · score ${st.score}`);
  check('a stage has its world and its song', st.biome === 'meadow' && (await D(p, 'audio')).song === 'meadow' && st.title === 'WEEK 1', `${st.title} · ${st.biome} · ${(await D(p, 'audio')).song}`);
  // 4a. the moves: a dash that nothing can hurt, a charged shot, a jump as high as the press is long
  await p.evaluate(() => { FieldworksDebug.clearFoes(); FieldworksDebug.place(40); }); await wait(p, 300);
  const d0 = await D(p, 'stage'); await p.keyboard.down('d'); await p.keyboard.press('k'); await wait(p, 60); const d1 = await D(p, 'stage'); await wait(p, 200); await p.keyboard.up('d'); const d2 = await D(p, 'stage');
  check('dash: a burst faster than a run, invulnerable while it lasts, then a cooldown', d1.dash && d1.inv && d2.x - d0.x > 34 && !d2.dash, `x ${Math.round(d0.x)} → ${Math.round(d2.x)} in 0.26 s (a run covers 17)`);
  await p.evaluate(() => FieldworksDebug.place(40)); await wait(p, 250);
  await p.keyboard.down('j'); await wait(p, 1000); const ch1 = await D(p, 'stage'); await p.keyboard.up('j'); await wait(p, 80); const ch2 = await D(p, 'stage');
  check('charged shot: hold fire to charge, release to let it go', ch1.full === true && ch2.shots.includes(true) && ch2.full === false, `charged ${ch1.full}; in flight ${JSON.stringify(ch2.shots)}`);
  const apex = async (ms) => { await p.evaluate(() => FieldworksDebug.place(40)); await wait(p, 300); const y0 = (await D(p, 'stage')).y; await p.keyboard.down(' '); await wait(p, ms); await p.keyboard.up(' '); let top = y0; for (let i = 0; i < 14; i++) { top = Math.min(top, (await D(p, 'stage')).y); await wait(p, 30); } return Math.round(y0 - top); };
  const hop = await apex(40), leap = await apex(420);
  check('jump: a short press is a short hop, a held one a full jump', hop > 4 && leap > hop + 12, `${hop} px against ${leap} px`);
  // 4b. a checkpoint: the hull is patched and one of three is picked; the pick is in the build and on the HUD
  const posts = (await D(p, 'stage')).posts; await p.evaluate((x) => FieldworksDebug.place(x), posts[0] - 2); await p.waitForSelector('[data-up]');
  const offered = await p.locator('[data-up]').evaluateAll((bs) => bs.map((b) => b.dataset.up)); const took1 = await pick(p); const bd1 = await D(p, 'stage');
  check('a checkpoint offers one of three run upgrades, and the pick joins the build shown on the HUD', offered.length === 3 && new Set(offered).size === 3 && bd1.build[took1] === 1 && bd1.picks === 1 && bd1.reached === 1 && bd1.hud.length >= 3, `offered ${offered.join(', ')}; took ${took1}; HUD "${bd1.hud}"`);
  check('a surveyed waypoint reads surveyed and offers nothing', (await p.locator('#wpcard').isVisible()) && /Week 1 · lesson 1 of 4/.test(await p.locator('#wpcard').innerText()) && (await p.locator('[data-survey]').isDisabled()));
  // 4c. a secret: a cracked wall, an alcove behind it, a relic
  const cache0 = (await D(p, 'stage')).caches[0]; await p.evaluate((x) => FieldworksDebug.place(x - 30), cache0.x); await wait(p, 250);
  for (let i = 0; i < 6 && !(await D(p, 'stage')).caches[0].open; i++) { await p.keyboard.press('j'); await wait(p, 240); }
  const sc0 = (await D(p, 'stage')).score; await p.keyboard.down('d'); await wait(p, 1600); await p.keyboard.up('d'); const sc1 = (await D(p, 'stage')).score;
  check('a cracked wall breaks under fire and the alcove behind it holds a relic', (await D(p, 'stage')).caches[0].open && sc1 >= sc0 + 250, `open; score ${sc0} → ${sc1}`);
  // 4d. the boss at the end of the stage: announced, two phases, a bar; down, it pays play score and the way opens
  check('the goal does not stand until the boss is down', (await D(p, 'stage')).goal < 0);
  await toBoss(p); const bs0 = (await D(p, 'stage')).boss;
  check('a boss arrives when the Keeper walks into its arena, with its own theme', bs0.type === 'hauler' && bs0.hp === bs0.max && bs0.phase === 1 && (await D(p, 'audio')).song === 'boss', `${bs0.type} ${bs0.hp}/${bs0.max}`);
  await wait(p, 1500); await p.evaluate((n) => FieldworksDebug.hitBoss(n), Math.ceil(bs0.max / 2)); await wait(p, 300); const bs1 = (await D(p, 'stage')).boss;
  check('at half its hull a boss enters a second phase', bs1 && bs1.phase === 2, bs1 && `${bs1.hp}/${bs1.max} · phase ${bs1.phase}`);
  const sb = (await D(p, 'stage')).score; await downBoss(p); const sd = await D(p, 'stage');
  check('a boss downed pays play score, opens the arena and raises the goal', sd.score >= sb + 1500 && sd.goal > 0 && sd.arenas[0].done, `score ${sb} → ${sd.score}; goal at ${sd.goal}`);
  await clearStage(p);
  const score = Number(await p.locator('[data-score]').getAttribute('data-score')); const play = await D(p, 'play'); const resultText = await p.locator('.paper').innerText();
  const after = { castle: await D(p, 'castle'), xp: await D(p, 'xp'), level: await D(p, 'level'), events: await D(p, 'events') };
  check('a cleared stage keeps its score as the best, on the device', score >= 2500 && play.best.w1 && play.best.w1.score === score, `score ${score}; best ${play.best.w1 && play.best.w1.score}`);
  check('stage score pays no XP, no level, no event and no castle piece', JSON.stringify(after) === JSON.stringify(before), `XP ${before.xp} → ${after.xp}; events ${before.events} → ${after.events}; pieces ${before.castle.pieces} → ${after.castle.pieces}`);
  check('play powers play: the run joins the lifetime play score, and what that opens is said and kept', play.total === fresh0.play.total + score && play.pool.includes('pierce') && !fresh0.play.pool.includes('pierce') && /Opened: Piercing shots/i.test(resultText), `lifetime ${fresh0.play.total} → ${play.total}; pool ${play.pool.join(', ')}`);
  await p.click('[data-act="castle"]'); await go(p, 'keeper');
  const paints = await p.locator('[data-paint]').evaluateAll((bs) => bs.map((b) => [b.dataset.paint, !b.disabled]));
  check('paint is unlocked by play score, and is looks only (the Keeper screen says so)', paints[0][1] && paints.some(([, on]) => !on) && /Looks only/.test(await p.locator('#paintcard').innerText()), paints.map(([k, on]) => `${k}:${on ? 'open' : 'locked'}`).join(' '));
  await go(p, 'stages');
  const track = await p.locator('[data-unlock]').evaluateAll((els) => els.map((e) => [e.dataset.unlock, e.dataset.open === 'true']));
  check('the stage list shows what play score has opened and what comes next', track.length >= 8 && track.find(([k]) => k === 'pierce')[1] && track.some(([, on]) => !on) && /Next at \d+/.test(await p.locator('#metacard').innerText()), track.map(([k, on]) => `${k}:${on ? 'open' : 'locked'}`).join(' '));
  // 5. gear and the bounty (FW2): the drop is gear by its grade, equipped from the archive; the day's bounty is picked by rule and its close drops better
  {
    const ctxG = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' }); const g = await open(ctxG); await clearCards(g);
    const x0 = { xp: await D(g, 'xp'), level: await D(g, 'level'), events: await D(g, 'events'), castle: await D(g, 'castle') };
    const g0 = await D(g, 'gear');
    await go(g, 'keeper'); await g.locator('#gearcard').scrollIntoViewIfNeeded(); await wait(g, 150);
    check('gear: the Keeper screen lists the five slots, each with the pieces the history dropped into it', (await g.locator('#gearcard .gear').count()) === 5 && g0.slots.blaster.have > 0 && g0.slots.core.have > 0 && /never lost|used up/i.test(await g.locator('#gearcard').innerText()), JSON.stringify(g0.slots));
    await phoneShot(g, 'gear-01-keeper');
    await g.click('[data-gear="blaster:off"]'); const g1 = await D(g, 'gear'); await g.click('[data-gear="blaster:auto"]'); const g2 = await D(g, 'gear');
    check('gear: equipping chooses a view of the archive: carry nothing, then the best again; no piece is ever used up', g1.slots.blaster.off && g1.slots.blaster.grade === null && g1.mods.fire_cd === undefined && !g2.slots.blaster.off && g2.slots.blaster.grade === g0.slots.blaster.grade && g1.items === g0.items && g2.items === g0.items && g1.ids === g0.ids && g2.ids === g0.ids, `${g0.items} → ${g1.items} → ${g2.items} items`);
    check('gear: and it pays no XP, no level, no event and no castle piece', JSON.stringify({ xp: await D(g, 'xp'), level: await D(g, 'level'), events: await D(g, 'events'), castle: await D(g, 'castle') }) === JSON.stringify(x0));
    await go(g, 'stages'); await g.click('[data-stage="0"]'); await wait(g, 300);
    const gs = await D(g, 'gear'); await leave(g);
    check('gear: carried into a run: the blaster fires faster, the Keeper is marked, and the carried pieces reach the run only as its modifiers', gs.mod && gs.mod.cd < 0.2 && gs.mod.marks >= 2 && gs.mod.speed >= 66 && gs.mod.inv >= 1.2, JSON.stringify(gs.mod));
    // the bounty: the oldest public open order, then the highest Pn, then the quickest (an independent reading of the DEMO's open list)
    const orders = await D(g, 'openIds'), rank = (pn) => ['P0', 'P1', 'P2', 'P3'].indexOf(pn) < 0 ? 4 : ['P0', 'P1', 'P2', 'P3'].indexOf(pn);
    const want = orders.slice().sort((a, b) => a.written.localeCompare(b.written) || rank(a.pn) - rank(b.pn) || (a.options > 0 ? 1 : a.steps || 1) - (b.options > 0 ? 1 : b.steps || 1) || a.id.localeCompare(b.id))[0].id;
    await go(g, 'siege'); await g.locator('#bountycard').scrollIntoViewIfNeeded(); await wait(g, 150);
    const b0 = await D(g, 'bounty'), shown = await g.locator('#bountycard [data-order]').getAttribute('data-order');
    check('bounty: the day\'s pick is the oldest, then the highest Pn, then the quickest, and the siege screen shows it', b0.id === want && shown === want && /Today's bounty/.test(await g.locator('#bountycard').innerText()), `${b0.id} (wanted ${want})`);
    await phoneShot(g, 'gear-02-bounty');
    await closeOrder(g, want, true); await clearCards(g); await wait(g, 300);
    const it = await g.evaluate((id) => FieldworksDebug.itemOf(id), want);
    check('bounty: closing it that day drops better (its rarity score carries the bonus, its receipt says so)', it && it.bounty === true && /bounty/.test(it.receipt), JSON.stringify(it));
    await g.reload(); await wait(g, 300); await clearCards(g);
    const it2 = await g.evaluate((id) => FieldworksDebug.itemOf(id), want);
    check('bounty: the pick is journalled, so the bonus survives a reload', it2 && it2.bounty === true, JSON.stringify(it2));
    await ctxG.close();
  }

  // 4e. hard mode: one heart, a death ends the run, and every unlock stands
  await p.click('[data-hard]'); await p.click('[data-stage="0"]'); await wait(p, 300); await run(p, 2);
  const hs = await D(p, 'stage'); await p.evaluate(() => FieldworksDebug.hurt()); await p.waitForSelector('[data-result="over"]', { timeout: 4000 });
  const overScore = Number(await p.locator('[data-score]').getAttribute('data-score')); const play2 = await D(p, 'play');
  check('hard mode: one heart, and a death ends the run', hs.hard && hs.max === 1 && hs.cont === 0 && play2.wilds.runs === 1, `hull ${hs.max}; run over at ${overScore}`);
  check('a death keeps every unlock and the run\'s play score', play2.total === play.total + overScore && play2.pool.join() === play.pool.join() && JSON.stringify({ castle: await D(p, 'castle'), xp: await D(p, 'xp'), level: await D(p, 'level'), events: await D(p, 'events') }) === JSON.stringify(before), `lifetime ${play.total} → ${play2.total}`);
  await p.click('[data-act="castle"]'); await go(p, 'stages'); await p.click('#switches [data-mute]');
  check('the hard-mode and sound switches are kept', (await D(p, 'play')).hard === true && (await D(p, 'play')).mute === true);
  // 5. a second stage opens once the first is cleared
  await p.evaluate(() => document.querySelector('[data-stage="2"]').click()); await wait(p, 300);
  const openStage = await D(p, 'stage');
  check('week 2 opens once week 1 is cleared, in another world, with machines week 1 did not have', openStage && openStage.week === 2 && openStage.biome === 'canyon' && openStage.kinds.includes('drone') && openStage.hard === true, openStage && `${openStage.biome} · ${openStage.kinds.join(', ')} · movers ${openStage.movers} · spikes ${openStage.spikes}`);
  await p.evaluate(() => FieldworksDebug.hurt()); await p.waitForSelector('[data-result="over"]'); await p.click('[data-act="castle"]'); await go(p, 'stages');

  // 6. the save: a reload keeps the castle, the horde's clock and the scores
  const save1 = JSON.parse(await p.evaluate(() => { dispatchEvent(new Event('pagehide')); return localStorage.getItem('fieldworks-save'); }));
  const live1 = { castle: await D(p, 'castle'), play: await D(p, 'play'), horde: (await D(p, 'horde')).clock };
  await p.reload(); await wait(p, 400);
  const live2 = { castle: await D(p, 'castle'), play: await D(p, 'play'), horde: (await D(p, 'horde')).clock };
  check('a reload keeps the castle, the horde clock, the scores, the lifetime play score and the two switches', JSON.stringify(live1) === JSON.stringify(live2) && live2.play.hard === true && live2.play.mute === true && live2.play.total > 0 && live2.castle.pieces > fresh.castle.pieces && save1.map === undefined && save1.journal.closed.length === took, `pieces ${live2.castle.pieces} (a fresh device has ${fresh.castle.pieces}); the save holds a journal of ${save1.journal.closed.length} closes and no map`);
  check('onboarding shows once (not again after a reload)', (await p.locator('[data-onboard]').count()) === 0 && (await p.evaluate(() => localStorage.getItem('fieldworks-onboarded'))) === '1');
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

  // 10. touch: one pad canvas, a floating stick on the left and drawn buttons on the right, drive the Keeper on a phone
  ctx = await chromium.newContext({ viewport: VIEW, hasTouch: true, isMobile: true, timezoneId: 'UTC' });
  p = await open(ctx); await clearCards(p);
  await go(p, 'stages'); await p.click('[data-stage="1"]'); await wait(p, 300);
  const pad = await p.locator('#padcv').boundingBox();
  const at = (fx, fy) => ({ x: Math.round(pad.x + pad.width * fx), y: Math.round(pad.y + pad.height * fy) });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ ...q, id: i })) });
  const x0 = (await D(p, 'stage')).x;
  // the stick: the thumb lands anywhere on the left and slides right; the Keeper runs
  const s0 = at(.2, .5), s1 = { x: s0.x + 60, y: s0.y };
  await touch('touchStart', [s0]); await touch('touchMove', [s1]); await wait(p, 700);
  const x1t = (await D(p, 'stage')).x, y0 = (await D(p, 'stage')).y;
  // a second thumb presses Jump while the first still holds the stick
  const jb = at(.89, .62);
  await touch('touchMove', [s1, jb]); await wait(p, 180); const yUp = (await D(p, 'stage')).y; const xMid = (await D(p, 'stage')).x;
  await touch('touchEnd', []); await wait(p, 200);
  const held = await p.evaluate(() => FieldworksDebug.keys());
  check('touch: the stick runs the Keeper, a second thumb jumps while it runs, and lifting both lets go', x1t > x0 + 20 && yUp < y0 - 4 && xMid >= x1t && !held.left && !held.right && !held.jump, `x ${Math.round(x0)} → ${Math.round(x1t)} → ${Math.round(xMid)}; y ${Math.round(y0)} → ${Math.round(yUp)}; held after ${JSON.stringify(held)}`);
  // a tap in the space between buttons still presses the nearest one: here Dash
  const xd0 = (await D(p, 'stage')).x;
  await touch('touchStart', [at(.6, .95)]); await wait(p, 50); await touch('touchEnd', []); await wait(p, 200);
  check('touch: the right side has no dead gaps, so a tap between the buttons dashes', (await D(p, 'stage')).x > xd0 + 25, `x ${Math.round(xd0)} → ${Math.round((await D(p, 'stage')).x)}`);
  // the page does not move under a thumb: no zoom on a quick double tap, no scroll, no selection, no DOM buttons in play
  const zoom0 = await p.evaluate(() => [visualViewport.scale, scrollY]);
  for (let i = 0; i < 2; i++) { await touch('touchStart', [at(.72, .42)]); await touch('touchEnd', []); await wait(p, 60); }
  await touch('touchStart', [at(.2, .5)]); await touch('touchMove', [at(.2, .1)]); await touch('touchMove', [at(.2, -2)]); await touch('touchEnd', []); await wait(p, 200);
  const lock = await p.evaluate(() => ({ scale: visualViewport.scale, y: scrollY, sel: String(getSelection()), ta: getComputedStyle(document.getElementById('padcv')).touchAction, btns: document.querySelectorAll('.phone button:not([hidden])').length, playing: document.documentElement.classList.contains('playing') }));
  check('touch: a double tap and a thumb dragged off the pad move nothing: no zoom, no scroll, no selection', lock.scale === zoom0[0] && lock.y === zoom0[1] && lock.sel === '' && lock.ta === 'none' && lock.playing, JSON.stringify(lock));
  check('touch: the pad is big enough for two thumbs', pad.height >= 100 && pad.width >= 300, `${Math.round(pad.width)} × ${Math.round(pad.height)} px`);
  const view = (await D(p, 'stage')).view; const css = await p.locator('#game').evaluate((c) => [c.clientWidth, c.clientHeight, c.width, c.height]);
  check('the pixels are whole: the canvas is drawn at a whole-number scale', css[0] % css[2] === 0 && css[0] / css[2] === css[1] / css[3] && css[2] === view[0], `${css[2]} × ${css[3]} drawn at ${css[0]} × ${css[1]} (×${css[0] / css[2]})`);
  await phoneShot(p, 'touch-pad');
  await ctx.close();

  // 10b. the frontier (FW11): the mid-angle explorer out the gate, its camera, its controls drawn over the scene
  ctx = await chromium.newContext({ viewport: VIEW, hasTouch: true, isMobile: true, deviceScaleFactor: 2, timezoneId: 'UTC' });
  p = await open(ctx); await clearCards(p);
  const ev0 = await D(p, 'events'), lv0 = await D(p, 'xp');
  await go(p, 'stages'); await p.click('[data-go="frontier"]'); await wait(p, 400);
  const fr0 = await D(p, 'frontier');
  check('the frontier opens from the stage list: a region, the Keeper north of the castle\'s gate, the camera at the owner\'s mid-angle', fr0 && fr0.region === 0 && fr0.props > 300 && fr0.cam.tilt >= 60 && fr0.cam.tilt <= 65 && fr0.view[2] >= 1, JSON.stringify(fr0));
  await phoneShot(p, 'frontier-gate');
  { const box = await p.locator('#game').boundingBox(), cdpF = await ctx.newCDPSession(p), at = (fx, fy) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy), id: 0 });
    await cdpF.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(.2, .6)] });
    await cdpF.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...at(.2, .6), y: at(.2, .6).y - 60 }] }); await wait(p, 1200);
    const fr1 = await D(p, 'frontier');
    await cdpF.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(p, 100);
    check('touch on the frontier: a thumb anywhere on the left floats the stick and walks the Keeper north up the road', fr1.y < fr0.y - 40, `y ${Math.round(fr0.y)} → ${Math.round(fr1.y)}`);
    const k1 = await D(p, 'frontier');
    await cdpF.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(.66, .9)] }); await wait(p, 40); await cdpF.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(p, 100);
    check('a tap on Dash dashes and spends power', (await D(p, 'frontier')).power < k1.power, `power ${Math.round(k1.power)} → ${Math.round((await D(p, 'frontier')).power)}`); }
  await p.keyboard.down('w'); for (let i = 0; i < 20; i++) { await p.keyboard.press('j'); await wait(p, 150); } await p.keyboard.up('w');
  const fr2 = await D(p, 'frontier'); await phoneShot(p, 'frontier-north');
  check('the keyboard walks the frontier too, and nothing the run does touches the evidence', fr2.y < fr0.y - 150 && (await D(p, 'events')) === ev0 && (await D(p, 'xp')) === lv0, `y ${Math.round(fr2.y)}; scrap ${fr2.scrap}; score ${fr2.score}`);
  await p.click('.xback'); await wait(p, 200);
  check('the way home: back to the castle', (await p.evaluate(() => FieldworksDebug.screen())) === 'castle');
  await ctx.close();

  // 11. reduced motion: no shake, no flash, no hit-stop
  ctx = await chromium.newContext({ viewport: VIEW, reducedMotion: 'reduce', timezoneId: 'UTC' });
  p = await open(ctx); await clearCards(p); await go(p, 'stages'); await p.click('[data-stage="1"]'); await wait(p, 300);
  await p.evaluate(() => FieldworksDebug.hurt()); const calm = await D(p, 'stage');
  check('reduced motion: a hit shakes and flashes nothing', calm.hp === calm.max - 1 && calm.shake === 0 && calm.flash === 0, `hull ${calm.hp}/${calm.max}; shake ${calm.shake}; flash ${calm.flash}`);
  await ctx.close();

  // 12. later weeks: every machine kind, the hazards, another boss, another world (a device that has cleared four weeks)
  ctx = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' });
  p = await open(ctx); await clearCards(p);
  await p.goto(ART); await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fieldworks-save')); for (let i = 1; i < 8; i++) s.play.best['w' + i] = { score: 1, stars: 1 }; localStorage.setItem('fieldworks-save', JSON.stringify(s)); }); await p.goto(PAGE); await wait(p, 300); await clearCards(p);
  const seen = new Set(), worlds = new Set(), bosses = []; let hazards = { movers: 0, vents: 0, spikes: 0, caches: 0 };
  for (const n of [2, 3, 4, 5, 8]) {
    await go(p, 'stages'); await p.click(`[data-stage="${n}"]`); await wait(p, 250); const s5 = await D(p, 'stage');
    s5.kinds.forEach((k) => seen.add(k)); worlds.add(s5.biome); hazards = { movers: hazards.movers + s5.movers, vents: hazards.vents + s5.vents, spikes: hazards.spikes + s5.spikes, caches: hazards.caches + s5.caches.length };
    await toBoss(p); bosses.push((await D(p, 'stage')).boss.type);
    if (n === 3 || n === 5) { await wait(p, 2600); await p.locator('#phone').screenshot({ path: join(OUT, `boss-${bosses[bosses.length - 1]}.png`) }); }
    await p.evaluate(() => FieldworksDebug.hurt()); await p.evaluate(() => FieldworksDebug.hurt());
  }
  // a moving platform carries the Keeper over a chasm too wide to jump (week 2 has the first)
  await go(p, 'stages'); await p.click('[data-stage="2"]'); await wait(p, 250);
  const r0 = await p.evaluate(() => { FieldworksDebug.clearFoes(); return FieldworksDebug.ride(); }); await wait(p, 400); const r1 = await D(p, 'stage'); await wait(p, 1200); const r2 = await D(p, 'stage');
  check('a moving platform carries the Keeper across a chasm', r0 && r1.riding && r2.riding && Math.abs((r2.x - r1.x) - (r2.mover - r1.mover)) < 1.5 && Math.abs(r2.mover - r1.mover) > 10 && r2.y === r1.y && r0.x1 - r0.x0 >= 40, r0 && `the deck moved ${Math.round(r2.mover - r1.mover)} px and the Keeper ${Math.round(r2.x - r1.x)} px with it`);
  // a roadmap stage has two restarts from the last checkpoint; the third death ends the run
  const fall = async () => { const s0 = await D(p, 'stage'); for (let i = 0; i < s0.hp && !(await p.locator('[data-result]').count()); i++) { await p.evaluate(() => FieldworksDebug.hurt()); await wait(p, 120); } await wait(p, 200); };
  await p.evaluate(() => FieldworksDebug.place(FieldworksDebug.stage().posts[0] - 2)); await pick(p); await p.evaluate(() => FieldworksDebug.place(FieldworksDebug.stage().posts[0] + 200)); await wait(p, 200);
  const k0 = await D(p, 'stage'); await fall(); const k1 = await D(p, 'stage'); await fall(); const k2 = await D(p, 'stage'); await fall(); const ended = await p.locator('[data-result="over"]').count();
  check('out of hull, a roadmap run restarts at its last checkpoint twice, with the build kept; the third time the run is over', k0.cont === 2 && k1.cont === 1 && k1.hp === k1.max && Math.abs(k1.x - (k0.posts[0] - 3)) < 14 && k1.picks === 1 && k2.cont === 0 && ended === 1, `restarts ${k0.cont} → ${k1.cont} → ${k2.cont}; back at x ${Math.round(k1.x)} (the checkpoint is at ${k0.posts[0]})`);
  await p.click('[data-act="castle"]');
  // the Wilds: a checkpoint every so often, a boss every so often, and a pick after it
  await go(p, 'stages'); await p.click('[data-stage="0"]'); await wait(p, 250);
  for (let i = 0; i < 12 && !(await D(p, 'stage')).arenas.length; i++) { await p.evaluate(() => { FieldworksDebug.clearFoes(); FieldworksDebug.far(); }); await wait(p, 150); if (await p.locator('[data-up]').count()) await pick(p); }
  const wl = await D(p, 'stage'); await toBoss(p); const wb = (await D(p, 'stage')).boss.type; await p.evaluate(() => FieldworksDebug.hitBoss(9999)); await p.waitForSelector('[data-upgrade="boss"]', { timeout: 8000 }); await pick(p);
  const wl2 = await D(p, 'stage');
  check('the Wilds have their own checkpoints and bosses, and a boss downed there is followed by a pick', wl.week === 0 && wl.posts.length >= 2 && wb === 'hauler' && wl2.arenas[0].done && !wl2.done && wl2.picks >= 1, `${wl.posts.length} checkpoints and an arena in ${wl.len} tiles; ${wb} downed; ${wl2.picks} picks`);
  await p.evaluate(() => { FieldworksDebug.hurt(); FieldworksDebug.hurt(); FieldworksDebug.hurt(); FieldworksDebug.hurt(); FieldworksDebug.hurt(); FieldworksDebug.hurt(); }); await wait(p, 200); if (await p.locator('[data-act="castle"]').count()) await p.click('[data-act="castle"]');
  check('six kinds of machine come in over the weeks', [...seen].sort().join() === 'brute,crawler,drone,hopper,turret,warden', [...seen].sort().join(', '));
  check('the stages carry moving platforms, spikes, vents and hidden caches', hazards.movers > 0 && hazards.vents > 0 && hazards.spikes > 0 && hazards.caches >= 4, JSON.stringify(hazards));
  check('three boss designs rotate, and the weeks wear at least four worlds', new Set(bosses).size === 3 && worlds.size >= 4, `${bosses.join(', ')} · ${[...worlds].join(', ')}`);
  await ctx.close();

  // 13. a device with a long play record: the second jump, the starting pick and more worlds for the Wilds, all from play score
  ctx = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' });
  p = await open(ctx); await clearCards(p);
  await p.goto(ART); await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('fieldworks-save')); s.play.life = 40000; localStorage.setItem('fieldworks-save', JSON.stringify(s)); }); await p.goto(PAGE); await wait(p, 300); await clearCards(p);
  const rich0 = { castle: await D(p, 'castle'), xp: await D(p, 'xp') };
  await go(p, 'stages'); await p.click('[data-stage="0"]'); await p.waitForSelector('[data-upgrade="perk"]', { timeout: 4000 });
  const perkPool = await p.locator('[data-up]').count(); await pick(p); const rich = await D(p, 'stage');
  const jumpTwice = async (twice) => { await p.evaluate(() => { FieldworksDebug.clearFoes(); FieldworksDebug.place(40); }); await wait(p, 300); const y0 = (await D(p, 'stage')).y; await p.keyboard.down(' '); let top = y0; for (let i = 0; i < 30; i++) { const s = await D(p, 'stage'); top = Math.min(top, s.y); if (twice && i === 8) { await p.keyboard.up(' '); await p.keyboard.down(' '); } await wait(p, 25); } await p.keyboard.up(' '); return Math.round(y0 - top); };
  const one = await jumpTwice(false), two = await jumpTwice(true);
  check('play score opens things for play: a starting pick, a second jump, more worlds for the Wilds', perkPool === 3 && rich.picks === 1 && two > one + 15 && rich.wildsWorlds === 3 && (await D(p, 'play')).pool.length === 9, `a head start of ${perkPool}; one jump ${one} px, two ${two} px; ${rich.wildsWorlds} worlds; a pool of ${(await D(p, 'play')).pool.length}`);
  check('… and nothing for the castle: the same pieces and XP as a device that never played', JSON.stringify(rich0) === JSON.stringify({ castle: fresh.castle, xp: fresh.xp }), `pieces ${rich0.castle.pieces}; XP ${rich0.xp}`);
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
  await run(p, 8);
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

/** The embeddable build (embed/), in a same-origin frame of a tiny host page served from this repo: the host posts an invented world. */
async function embedded() {
  const root = join(here, '..'), TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };
  const LISTEN = '<script>window.msgs=[];addEventListener("message",function(e){if(e.source===document.getElementById("f").contentWindow)msgs.push(e.data)})</script>';
  const FRAME = 'style="border:0;width:100vw;height:100vh;display:block"';
  const hosts = {
    '/host.html': `<!doctype html><meta charset="utf-8"><title>host</title><body style="margin:0"><iframe id="f" src="/embed/play.html" ${FRAME}></iframe>${LISTEN}`,
    // the form the host app will most likely use: a srcdoc document (about:srcdoc, the parent's origin) that is only the stylesheets and the one script
    '/host-srcdoc.html': `<!doctype html><meta charset="utf-8"><title>host</title><body style="margin:0"><iframe id="f" ${FRAME} srcdoc='<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/embed/play.css"><link rel="stylesheet" href="/embed/fonts/fonts.css"><body><script src="/embed/play.js"></script>'></iframe>${LISTEN}`
  };
  const srv = createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (hosts[u]) { res.writeHead(200, { 'content-type': TYPES['.html'] }); res.end(hosts[u]); return; }
    const m = /^\/embed\/(fonts\/)?([\w.-]+)$/.exec(u), f = m && join(root, m[1] ? 'prototype/fonts' : 'embed', m[2]);   // the host copies prototype/fonts/ beside the embed
    if (!f || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${srv.address().port}`;
  const ev = (id, kind, at, more = {}) => ({ id, kind, at, tier: 'public', zone: 'alpha', weight: 60, facts: { pn: 'P1', difficulty: 'medium', ageDays: 9, band: 'now' }, evidence: { kind: 'commit', ref: `demo/${id}` }, ...more });
  const lesson = (id, at) => ({ id: `lesson/${id}`, kind: 'lesson', at, tier: 'private', zone: null, weight: 30, facts: {}, evidence: { kind: 'tick', ref: `progress/${id}` } });
  const WORLD = () => ({ fw: 1, type: 'world', today: '2026-12-01', theme: 'dark',
    events: [...Array.from({ length: 14 }, (_, i) => ev(`WO-${400 + i}`, 'close', `2026-11-${10 + i}`)), lesson('w1a', '2026-11-20')],
    open: [{ id: 'WO-420', written: '2026-10-01', pn: 'P1', options: 0, steps: 3, zone: 'alpha', tier: 'public', band: 'now' }, { id: 'sealed-1', written: '2026-10-20', pn: 'P2', options: 2, steps: 1, zone: null, tier: 'private', band: null }],
    plan: { weeks: [{ n: 1, lessons: ['w1a', 'w1b'] }, { n: 2, lessons: ['w2a'] }] },
    horde: { day: 0, clock: { gather: 0, warned: '2026-11-30', due: '2026-12-03', count: 1, last: '2026-11-15', horde: { n: 9, bosses: 1, ordinal: 1 } }, history: [], dim: false, arrived: null, fresh: 12 },
    lanes: { workorders: true, learning: true, body: false }, briefing: { later: true } });
  const load = async (path, scheme = 'light') => {
    const ctx = await chromium.newContext({ viewport: VIEW, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: 'UTC' }); const p = await ctx.newPage(); const reqs = [];
    p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); p.on('request', (r) => reqs.push(r.url()));
    await p.goto(origin + path); await p.waitForFunction(() => window.msgs && msgs.length > 0, null, { timeout: 5000 }).catch(() => {});
    return { ctx, p, reqs, fr: p.frames()[1], msgs: () => p.evaluate(() => msgs), post: (w) => p.evaluate((x) => document.getElementById('f').contentWindow.postMessage(x, location.origin), w) };
  };
  const F = (fr, k) => fr.evaluate((key) => FieldworksDebug[key](), k);
  const cards = async (fr) => { for (let i = 0; i < 10; i++) { const n = fr.locator('[data-act="next"],[data-act="start"],[data-take],[data-act="summary"]'); if (!(await n.count())) break; await n.last().click(); await wait(fr, 120); } };

  // a. ready, then the honest wait
  let h = await load('/host.html');
  check('embed: the frame posts ready to its host, and waits for a world saying so', JSON.stringify(await h.msgs()) === '[{"fw":1,"type":"ready"}]' && (await F(h.fr, 'embed')).state === 'reading' && (await F(h.fr, 'horde')).line === 'Reading your work' && (await F(h.fr, 'castle')).pieces === 0, `${JSON.stringify(await h.msgs())} · ${(await F(h.fr, 'horde')).line}`);
  await cards(h.fr); await h.p.screenshot({ path: join(OUT, 'embed-01-reading.png') });
  // b. the world: the castle is the fold over the posted events, the day and the horde are the host's
  await h.post(WORLD()); await wait(h.p, 400); await cards(h.fr); await wait(h.p, 300);
  const e1 = await F(h.fr, 'embed'), c1 = await F(h.fr, 'castle'), h1 = await F(h.fr, 'horde');
  const want = await h.fr.evaluate((w) => FieldworksCastle.castleOf(FieldworksEngine.evaluate(w.events, FIELDWORKS_RULES, w.today, { plan: w.plan }).log, FIELDWORKS_RULES).pieces, WORLD());
  check('embed: the castle is the fold over the host\'s events, on the host\'s day', e1.state === 'world' && e1.today === '2026-12-01' && c1.pieces === want && want >= 14 && (await F(h.fr, 'events')) === 15, `${c1.pieces} pieces from 15 posted events (the engine's fold says ${want})`);
  check('embed: the horde is the host\'s, and the theme', h1.line === 'Horde in 2 days' && h1.clock.due === '2026-12-03' && (await h.fr.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', h1.line);
  const chrome = await h.fr.evaluate(() => ({ dev: document.querySelectorAll('.dev, #seg-clock, #reset').length, ribbon: document.querySelectorAll('.ribbon, .bar-nav, #homebtn').length, close: !!document.getElementById('fwClose'), w: document.getElementById('phone').clientWidth, h: document.getElementById('phone').clientHeight, inline: document.querySelectorAll('script:not([src])').length }));
  check('embed: no prototype bar, no phone frame, no host chrome; the game fills the frame and keeps a Close button', chrome.dev === 0 && chrome.ribbon === 0 && chrome.close && chrome.w === 375 && chrome.h === 667 && chrome.inline === 0, JSON.stringify(chrome));
  await h.p.screenshot({ path: join(OUT, 'embed-02-castle.png') });
  // c. the buttons that fake evidence in the DEMO ask the host instead; no evidence is made here
  await h.fr.click('.strip [data-host="workorders"]');
  await h.fr.click('.strip [data-go="stages"]'); await wait(h.p, 200);
  const stages = await h.fr.locator('[data-stage]').evaluateAll((els) => els.map((e) => e.dataset.stage));
  await h.p.screenshot({ path: join(OUT, 'embed-03-stages.png') });
  await h.fr.click('#hostcard [data-host="health"]');
  await h.fr.click('[data-stage="1"]'); await wait(h.p, 300);
  await h.fr.evaluate(() => FieldworksDebug.place(FieldworksDebug.stage().posts[1] - 2)); await h.fr.waitForSelector('[data-up]'); await h.fr.locator('[data-up]').first().click(); await wait(h.p, 250);
  const cardText = await h.fr.locator('#wpcard').innerText(); await h.fr.click('[data-survey]'); await wait(h.p, 100);
  await h.p.screenshot({ path: join(OUT, 'embed-04-stage.png') });
  const m2 = (await h.msgs()).filter((m) => m.type === 'go').map((m) => m.to);
  check('embed: the evidence buttons post go to the host (work orders, health, learning) and create no evidence', JSON.stringify(m2) === '["workorders","health","learning"]' && (await F(h.fr, 'events')) === 15 && (await F(h.fr, 'castle')).pieces === want && /Open the lesson/.test(cardText), `${m2.join(', ')}; events still ${await F(h.fr, 'events')}; the card: ${cardText.replace(/\s+/g, ' ')}`);
  check('embed: the roadmap\'s weeks come from the host\'s plan', JSON.stringify(stages) === '["0","1","2"]', stages.join(', '));
  // d. a world that arrives mid-run waits; back at the castle it is applied, and the new work gets its card
  const w2 = WORLD(); w2.events.push(ev('WO-430', 'close', '2026-12-01'));
  await h.post(w2); await wait(h.p, 300); const q = await F(h.fr, 'embed'), stillRun = await F(h.fr, 'stage');
  await h.fr.click('.strip [data-go="castle"]'); await wait(h.p, 300); if (await h.fr.locator('[data-act="castle"]').count()) await h.fr.click('[data-act="castle"]'); await wait(h.p, 500);
  const dropped = await h.fr.locator('.dropcard').count(); await cards(h.fr); await wait(h.p, 300);
  check('embed: a world posted during a run is queued, not lost, and applied back at the castle with its drop card', q.queued === true && !!stillRun && (await F(h.fr, 'events')) === 16 && (await F(h.fr, 'castle')).pieces === want + 1 && dropped === 1, `queued ${q.queued}; then ${await F(h.fr, 'events')} events, ${(await F(h.fr, 'castle')).pieces} pieces`);
  // e. what is kept: play only, under the embed's own keys
  const kept = await h.fr.evaluate(() => { dispatchEvent(new Event('pagehide')); return { keys: Object.keys(localStorage).sort(), save: JSON.parse(localStorage.getItem('fieldworks-embed-play')) }; });
  check('embed: the device keeps play only, under its own keys; nothing of the world', JSON.stringify(kept.keys) === '["fieldworks-embed-onboarded","fieldworks-embed-play"]' && JSON.stringify(Object.keys(kept.save).sort()) === '["play","rules","version"]' && !/WO-\d|lesson\/|2026-12/.test(JSON.stringify(kept.save)), `${kept.keys.join(', ')}; the save holds ${Object.keys(kept.save).join(', ')}`);
  // f. a horde the host marks arrived is met by the same fight; a horde the host does not send is not guessed
  const w3 = WORLD(); w3.horde = { ...w3.horde, clock: { gather: 0, warned: null, due: null, count: 2, last: '2026-12-01', horde: null }, arrived: { n: 9, bosses: 1, ordinal: 1 } };
  await h.post(w3); await wait(h.p, 500); const fighting = await F(h.fr, 'fight'); await h.fr.click('#skipFight'); await h.fr.waitForSelector('[data-outcome]');
  const piecesAfter = (await F(h.fr, 'castle')).pieces; await cards(h.fr);
  check('embed: a horde the host marks arrived is fought here by the one stepping function, and takes nothing', fighting !== null && piecesAfter === want && (await F(h.fr, 'events')) === 15, `pieces ${piecesAfter}`);
  const w4 = WORLD(); w4.horde = null; await h.post(w4); await wait(h.p, 300);
  check('embed: with no horde from the host, the line says it was not read', (await F(h.fr, 'horde')).line === "The horde's clock was not read", (await F(h.fr, 'horde')).line);
  // g. Close, and the network: nothing but the embed's own files was ever asked for
  await h.fr.click('#fwClose'); await wait(h.p, 150); const last = (await h.msgs()).pop();
  const asked = h.reqs.map((u) => u.replace(origin, '')), allowed = /^\/(host\.html|embed\/(play\.(html|js|css)|fonts\/[\w.-]+))$/;
  check('embed: Close posts close to the host', last.type === 'go' && last.to === 'close');
  check('embed: no request leaves the frame: the page, its script, its styles and the faces, and nothing after', asked.every((u) => allowed.test(u)) && h.reqs.every((u) => u.startsWith(origin)) && asked.filter((u) => /play\.js/.test(u)).length === 1, asked.join(' '));
  await h.ctx.close();

  // g2. the host's bounty (FW2, optional): a close of that order on that day drops better; without it, or when malformed, the world reads as before and the drop is as it was
  {
    const hb = await load('/host.html');
    const withClose = (more = {}) => { const w = WORLD(); w.events = [...w.events, ev('WO-499', 'close', '2026-12-01')]; return { ...w, ...more }; };
    const itemOf = (fr) => fr.evaluate(() => FieldworksDebug.itemOf('WO-499'));
    await hb.post(withClose({ bounty: { day: '2026-12-01', id: 'WO-499' } })); await wait(hb.p, 400); await cards(hb.fr);
    const a = await itemOf(hb.fr);
    await hb.ctx.close();
    const hc = await load('/host.html'); await hc.post(withClose()); await wait(hc.p, 400); await cards(hc.fr);
    const b = await itemOf(hc.fr); await hc.ctx.close();
    const hd = await load('/host.html'); await hd.post(withClose({ bounty: { day: 'x', id: 7 } })); await wait(hd.p, 400); await cards(hd.fr);
    const c = await itemOf(hd.fr), ed = await F(hd.fr, 'embed'); await hd.ctx.close();
    check('embed: the host\'s bounty is optional: with it the close of that order drops better, without it or malformed the world reads exactly as before', a && b && c && a.bounty === true && a.score === b.score + 10 && b.bounty === false && c.score === b.score && ed.state === 'world', `${a && a.score} against ${b && b.score} and ${c && c.score}`);
  }

  // h. a world that cannot be read is ignored, and the game says so: a private event carrying a name, then a broken order
  h = await load('/host.html'); await cards(h.fr);
  const bad = WORLD(); bad.events.push({ ...lesson('w1b', '2026-11-21'), title: 'a name that must not arrive' });
  await h.post(bad); await wait(h.p, 300);
  const u1 = await F(h.fr, 'embed'), uh = await F(h.fr, 'horde');
  const bad2 = WORLD(); bad2.open.push({ id: 'x', written: 'yesterday', tier: 'public' }); await h.post(bad2); await wait(h.p, 200);
  check('embed: a malformed world is ignored whole, and the game says it could not read your work', u1.state === 'unread' && (await F(h.fr, 'embed')).state === 'unread' && (await F(h.fr, 'castle')).pieces === 0 && uh.line === 'Could not read your work' && /could not be read/.test(uh.need), `${uh.line} · ${uh.need}`);
  await h.post(WORLD()); await wait(h.p, 300);
  check('embed: a good world after a bad one is applied', (await F(h.fr, 'embed')).state === 'world' && (await F(h.fr, 'castle')).pieces === want);
  await h.ctx.close();

  // i. no world: after the wait the game plays signed out; opened with no host at all, at once
  h = await load('/host.html'); await cards(h.fr); await wait(h.p, 3400);
  await h.fr.click('.strip [data-go="stages"]'); await wait(h.p, 200);
  const lone = await h.fr.locator('[data-stage]').evaluateAll((els) => els.map((e) => e.dataset.stage));
  check('embed: with no world after three seconds, it falls back to signed-out play (an empty castle, the Wilds only)', (await F(h.fr, 'embed')).state === 'none' && (await F(h.fr, 'castle')).pieces === 0 && JSON.stringify(lone) === '["0"]', `${(await F(h.fr, 'embed')).state}; stages ${lone.join(', ')}`);
  await h.ctx.close();
  { const ctx = await chromium.newContext({ viewport: VIEW, timezoneId: 'UTC' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(origin + '/embed/play.html'); await wait(p, 300);
    check('embed: opened with no parent it is signed out at once', (await p.evaluate(() => FieldworksDebug.embed())).state === 'none' && (await p.evaluate(() => FieldworksDebug.castle())).pieces === 0);
    await ctx.close(); }

  // j. the srcdoc form: a document with no URL of its own, only the stylesheets and the one script
  h = await load('/host-srcdoc.html', 'dark'); await cards(h.fr);
  const sready = JSON.stringify(await h.msgs()); await h.post({ ...WORLD(), theme: 'light' }); await wait(h.p, 400); await cards(h.fr); await wait(h.p, 300);
  const sdoc = await h.fr.evaluate(() => ({ href: location.href, body: !!document.getElementById('phone'), face: getComputedStyle(document.body).fontFamily, embed: document.documentElement.classList.contains('embed') }));
  check('embed: the srcdoc form works the same: ready, the world applied, the body built by the script', sready === '[{"fw":1,"type":"ready"}]' && sdoc.href === 'about:srcdoc' && sdoc.body && sdoc.embed && (await F(h.fr, 'embed')).state === 'world' && (await F(h.fr, 'castle')).pieces === want && h.reqs.every((u) => u.startsWith(origin) || u === 'about:srcdoc'), `${sdoc.href}; ${(await F(h.fr, 'castle')).pieces} pieces`);
  await h.p.screenshot({ path: join(OUT, 'embed-05-srcdoc-light.png') });
  await h.ctx.close();
  await new Promise((r) => srv.close(r));
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
  clearInterval(p.__tap); await p.keyboard.up('d'); await p.keyboard.up('j'); await p.keyboard.up('w'); await ctx.close();
  console.log(`perf: ${JSON.stringify(res)}`);
  check(`a frame stays inside the 16.7 ms budget on the main thread (${name})`, res.main_thread_ms_per_frame < 16.7, `${res.main_thread_ms_per_frame} ms · ${res.fps} fps`);
  return res;
}
async function perf() {
  const horde = await perfScene('a horde at the walls, the towers firing', async (p) => { await p.click('[data-days="now"]'); await wait(p, 2500); });
  const stage = await perfScene('a stage, running and firing', async (p) => { await go(p, 'stages'); await p.click('[data-stage="0"]'); await wait(p, 300); await p.keyboard.down('d'); p.__tap = setInterval(() => { p.keyboard.press('j').catch(() => {}); p.keyboard.press(' ').catch(() => {}); if (Math.random() < .3) p.evaluate(() => { const u = document.querySelector('[data-up]'); if (u) u.click(); }).catch(() => {}); }, 200); });
  const boss = await perfScene('a boss fight, dashing and firing', async (p) => { await go(p, 'stages'); await p.click('[data-stage="1"]'); await wait(p, 300); await toBoss(p); await p.evaluate(() => { for (const s of ['spread', 'spread', 'rapid', 'buddy', 'buddy']) FieldworksDebug.give(s); }); p.__tap = setInterval(() => { p.keyboard.press('j').catch(() => {}); p.keyboard.press('k').catch(() => {}); }, 180); });
  const frontier = await perfScene('the frontier, walking north and firing', async (p) => { await go(p, 'stages'); await p.click('[data-go="frontier"]'); await wait(p, 300); await p.keyboard.down('w'); p.__tap = setInterval(() => { p.keyboard.press('j').catch(() => {}); }, 200); });
  writeFileSync(join(OUT, 'perf.json'), JSON.stringify({ horde, stage, boss, frontier }, null, 2) + '\n');
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
  await homeFit(); await behaviours(); await signedOut(); await embedded(); await perf(); await artSheet();
} finally { await b.close(); }
check('no page error anywhere in the walk', errors.length === 0, errors.slice(0, 3).join(' | '));
writeFileSync(join(OUT, 'checks.json'), JSON.stringify(results, null, 2) + '\n');
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
