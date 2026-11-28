  // ══════════════════════ the explorer out the gate (FW11, design D66 rework 2 and D85+) ══════════════════════
  // The mid-angle view: the ground is an axis-aligned grid running straight up the screen, tilted about 62° down, so
  // a road reads as ground and runs north; a building shows its roof, its front wall and the side facing the middle;
  // the Keeper and the machines stand upright. The rules of a run live in src/frontier.js (FieldworksFrontier), the
  // numbers in rules.frontier and every word in bank.explore. This file is the screen: mounting, input, drawing.
  // The canvas is drawn at its CSS size times a whole-number render scale (1 or 2), with no image asset.
  // Detail comes in tiers (FW12): tier 2 is the dense art (characters about three times the faces of the plain tier,
  // props and ground about twice), 1 the plain, 0 the plain without the drifting ash. A frame governor
  // (FieldworksFrontier.govern) picks the tier and the render scale from what each frame's own work measures.
  // Ground tiles are painted once into an atlas at the current zoom and scale and drawn from it: one painting, every tile.
  // Nothing here reads or writes the evidence; the castle is read to draw it and to know which regions are open.
  const XE = FieldworksFrontier, RX = RULES.frontier, BX = BANK.frontier;
  let XR = null, XRUN = 0, XRS = 1, XW = 1, XH = 1;
  const XCAM = XE.camOf(RULES), XP = { x: 0, y: 0 }, XQ = { x: 0, y: 0 }, XA = { x: 0, y: 0 }, XB = { x: 0, y: 0 };
  const XIN = { ax: 0, ay: 0, fire: false, dash: false }, XPR = { dash: false, bot: false, build: false };
  const XNA = RX.foes.cap + 2 + RX.partner.turret.cap, XSORT = new Int32Array(XNA), XSY = new Float32Array(XNA);   // the upright actors (Keeper -1, partner -2, turrets -3…), drawn in depth order with the props
  const XG = ['#2b2723', '#312c27', '#28241f', '#36302a'], XGL = ['#332e29', '#39332d', '#2f2a25', '#3e3730'];   // ground: ash, grit, scorched plate, gravel
  const XTXT = { scrap: '', score: '', seal: '', sealN: -1, scrapN: -1, scoreN: -1, toast: '', toastT: 0 };
  let XMINI = null, XMKEY = '';
  const XGOV = XE.govOf(RULES, 1);   // the frame governor: detail tier and render scale, stepped by measured work
  let XT = XGOV.tier, XATL = null, XAK = '', XAW = 1, XAH = 1;   // the tier now; the ground atlas, its key and one cell's size in device pixels
  const XEMB = new Float32Array(RX.render.embers * 3);   // the drifting ash: three seeded numbers each, drawn from the clock with no state
  { const r = XE.rngOf(0x5eed); for (let i = 0; i < XEMB.length; i++) XEMB[i] = r(); }
  const XSAY = ['', BX.bot_follow_say, BX.bot_hunt_say, BX.bot_downed, BX.bot_back, BX.built, BX.build_low, BX.build_full];   // what the run says, by W.said
  const XPC = { key: '', slot: [], lines: [[], [], [], []], neg: [0, 0, 0, 0], cols: [], mode: ['', '', ''], font: `700 ${RULES.frontier.hud.card_px}px Silkscreen, ui-monospace, monospace` };   // the partner card: the build's words, wrapped to the card, made when the build or the width changes

  /** The screen's markup: one canvas that is the scene and the controls, and a way home. */
  function exploreShell() {
    return `<div class="stage xstage" id="stage"><canvas class="game xcv" id="game" role="application" aria-label="${esc(BX.label)}"></canvas><button class="xback" data-go="castle" aria-label="${esc(BX.back)}">${icon('fort')}</button></div>`;
  }
  /** Mount: a run in the region asked for (the first by default), the canvas sized, the overlay's buttons on it. */
  function mountExplore(index) {
    cv = document.getElementById('game'); if (!cv) return; ctx = cv.getContext('2d'); hudEls = null;
    const open = XE.regionsOpen(CAS.pieces, RULES), i = clamp(index == null ? (XR ? XR.index : 0) : index, 0, open - 1);
    if (!XR || XR.over || XR.index !== i) XR = XE.newRun(i, XRUN++, hearts(), i + 1 >= open, RULES, S.play.partner);
    XMKEY = ''; sizeExplore(); stageObs.disconnect(); stageObs.observe(document.getElementById('stage'));
    padMount(cv, RI.pads.frontier, 'overlay');
    XCAM.x = XR.k.x; XCAM.y = XR.k.y; XE.camFollow(XCAM, XR.k.x, XR.k.y, 0, XR.map, RULES);
    xsay(fill(BX.enter, { name: BX.regions[XR.map.slug] })); xhudText();
  }
  /** A line on the scene for a few seconds, and for a screen reader. */
  function xsay(s) { XTXT.toast = s; XTXT.toastT = RX.hud.toast_s; $live.textContent = s; }
  /** The canvas at its box's CSS size times the render scale; the camera fitted to it. */
  function sizeExplore() {
    const st = document.getElementById('stage'); if (!st || !cv) return;
    XW = Math.max(1, Math.round(st.clientWidth)); XH = Math.max(1, Math.round(st.clientHeight));
    XGOV.max = clamp(Math.round(globalThis.devicePixelRatio || 1), 1, RX.render.scale_max); XE.govSet(XGOV, XGOV.level, RULES);
    XRS = XGOV.scale; XT = XGOV.tier;
    cv.width = XW * XRS; cv.height = XH * XRS; cv.style.width = XW + 'px'; cv.style.height = XH + 'px';
    XE.camFit(XCAM, XW, XH); xatlasBake();
    if (PAD.on && PAD.layout === 'overlay') { padSize(); padLayout(PAD.names, 'overlay'); }
    XPC.key = '';
  }
  /** The governor moved: a new render scale resizes the canvas (and repaints the atlas); a new tier only changes what is drawn. */
  function xgovApply() { if (XGOV.scale !== XRS) sizeExplore(); XT = XGOV.tier; }
  /**
   * The ground atlas: each kind of ground in a few variants, and the road's edge, middle and striped middle, painted
   * once at one tile's size on the surface (flat ground projects to the same rectangle everywhere) and drawn from
   * here for every tile in view. Repainted only when the zoom or the render scale changes.
   */
  function xatlasBake() {
    const T = RX.tile, cw = Math.max(2, Math.ceil(T * XCAM.zoom * XRS)), ch = Math.max(2, Math.ceil(T * XCAM.zoom * XCAM.sin * XRS)), key = cw + 'x' + ch;
    if (key === XAK && XATL) return;
    const V = RX.render.atlas_variants, c = XATL || document.createElement('canvas'); c.width = cw * V; c.height = ch * 5;
    const g = c.getContext('2d'), r = XE.rngOf(0xa71a5);
    const tri = (ax, ay, bx, by, cx, cy, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.closePath(); g.fill(); };
    const blot = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.2832); g.fill(); };
    for (let row = 0; row < 5; row++) for (let v = 0; v < V; v++) {
      g.setTransform(cw, 0, 0, ch, v * cw, row * ch);   // paint each cell in a unit square
      if (row < 4) {
        g.fillStyle = XG[row]; g.fillRect(0, 0, 1, 1);
        tri(0, 1, 1, 1, r() < .5 ? 0 : 1, 0, XGL[row]); g.globalAlpha = .55; tri(0, 0, 1, 0, .5, .5 + r() * .4, XG[row]); g.globalAlpha = 1;   // two facets catch the light differently
        if (row === 0) blot(.3 + r() * .4, .3 + r() * .4, .22, .16, 'rgba(0,0,0,.18)');   // ash: a soft dark drift
        if (row === 2) { g.fillStyle = '#211d19'; g.fillRect(0, .48, 1, .04); g.fillRect(.48, 0, .04, 1); g.fillStyle = '#4a4239'; for (let i = 0; i < 4; i++) g.fillRect((i & 1 ? .4 : .56) - .02, (i & 2 ? .4 : .56) - .025, .04, .05); }   // scorched plate: seams and rivets
        const n = row === 3 ? 6 : 3;
        for (let i = 0; i < n; i++) { const x = .1 + r() * .8, y = .1 + r() * .8, s = .05 + r() * .07; tri(x - s, y + s * .5, x, y - s * .7, x + s, y + s * .5, i & 1 ? XGL[row] : '#1f1c19'); }   // grit and pebbles
        if (r() < .5) { g.strokeStyle = '#1c1916'; g.lineWidth = .025; g.beginPath(); g.moveTo(r(), 0); g.lineTo(.3 + r() * .4, .5); g.lineTo(r(), 1); g.stroke(); }   // a hairline crack
      } else {
        g.fillStyle = v === 0 || v === 3 ? '#3d3a35' : '#46423c'; g.fillRect(0, 0, 1, 1);
        for (let i = 0; i < 7; i++) { g.fillStyle = i & 1 ? '#524d46' : '#38342f'; g.fillRect(r(), r(), .04, .03); }   // the aggregate
        g.fillStyle = '#2f2c28'; g.fillRect(0, 0, 1, .05);   // the joint between slabs
        if (v === 0) { g.fillStyle = '#58534b'; g.fillRect(0, 0, .12, 1); }   // the kerb, west
        if (v === 3) { g.fillStyle = '#58534b'; g.fillRect(.88, 0, .12, 1); }   // the kerb, east
        if (v === 2) { g.fillStyle = '#8a6a2c'; g.fillRect(.46, .1, .08, .55); g.fillStyle = '#a8843a'; g.fillRect(.47, .12, .03, .5); }   // the stripe, worn
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    XATL = c; XAK = key; XAW = cw; XAH = ch;
  }
  /** Leave the frontier. Returns the line that says what the run found, for the castle's ticker (empty when nothing). */
  function endExplore() {
    if (!XR) return '';
    const r = XR; XR = null; PAD.on = false; xbank(r);
    return r.score > 0 || r.scrap > 0 ? fill(BX.home, { scrap: r.scrap, score: r.score }) : '';
  }
  /** A run's scrap into the play record, where the partner bay spends it on upgrades. Play, kept on this device: it opens nothing the evidence opens. */
  function xbank(r) { if (r.scrap > 0) { S.play.scrap = Math.min(RX.partner.scrap_max, S.play.scrap + r.scrap); r.scrap = 0; saveNow(); } }
  // ── one frame ──
  function updateExplore(dt) {
    const s = PAD.stick, k = XR.k;
    XIN.ax = s.id >= 0 ? s.ax : (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    XIN.ay = s.id >= 0 ? s.ay : (keys.down ? 1 : 0) - (keys.jump ? 1 : 0);
    XIN.fire = padHeld('fire') || keys.fire;
    XPR.dash = padTake('dash') || tap.dash; XPR.bot = padTake('bot') || tap.bot; XPR.build = padTake('build') || tap.build;
    tap.dash = false; tap.jump = false; tap.fire = false; tap.bot = false; tap.build = false;
    XE.stepRun(XR, XIN, XPR, dt, RULES);
    if (XR.said) { xsay(XSAY[XR.said]); XR.said = 0; }
    XE.camFollow(XCAM, k.x, k.y, dt, XR.map, RULES);
    if (XTXT.toastT > 0) XTXT.toastT -= dt;
    if (XR.over) exploreOver();
  }
  function exploreOver() {
    const r = XR, open = XE.regionsOpen(CAS.pieces, RULES);
    if (!r.won) { xbank(r); xsay(BX.down); XR = XE.newRun(0, XRUN++, hearts(), open <= 1, RULES, S.play.partner); XCAM.x = XR.k.x; XCAM.y = XR.k.y; XMKEY = ''; return; }
    if (r.exit < 0 && r.index === 0) { const msg = endExplore(); S.screen = 'castle'; render(); if (msg) ticker(msg, ''); return; }
    const next = clamp(r.index + r.exit, 0, open - 1), keep = r.k.hp;
    XR = XE.newRun(next, XRUN++, hearts(), next + 1 >= open, RULES, S.play.partner); XR.k.hp = Math.max(1, Math.min(keep, XR.k.max)); XR.score = r.score; XR.scrap = r.scrap; XR.kills = r.kills;
    const pp = r.p, np = XR.p; np.up = pp.up; np.down = pp.down; np.hp = pp.hp; np.power = pp.power; np.mode = pp.mode; np.kills = pp.kills;   // the partner walks on with the Keeper, as it was
    if (r.exit < 0) { XR.k.y = XR.map.north + XR.map.tile * 2; }   // walked back south: arrive at the north edge of the region before
    np.x = XR.k.x + RX.partner.follow_gap; np.y = XR.k.y + RX.partner.follow_gap * .5;
    XCAM.x = XR.k.x; XCAM.y = XR.k.y; XMKEY = '';
    xsay(fill(BX.next, { name: BX.regions[XR.map.slug] }));
  }

  // ── drawing: small helpers that make nothing ──
  function xq(x, y, z) { return XE.project(XCAM, x, y, z, XP); }
  function xfill(c) { ctx.fillStyle = c; }
  function xquad(ax, ay, bx, by, cx, cy, dx, dy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill(); }
  function xtri(ax, ay, bx, by, cx, cy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }
  function xell(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, 6.2832); ctx.fill(); }
  function xline(ax, ay, bx, by, w, c) { ctx.strokeStyle = c; ctx.lineWidth = Math.max(.6, w); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
  /**
   * A box on the ground at (x, y), w across, d deep (north to south), h tall: its roof, its south wall and the side
   * that faces the middle of the screen (the lean shows it). Colours: roof, front, side.
   */
  function xbox(x, y, w, d, h, roof, front, side) {
    const Z = XCAM.zoom;
    xq(x, y + d, 0); const fax = XP.x, fay = XP.y; xq(x + w, y + d, 0); const fbx = XP.x, fby = XP.y;
    xq(x + w, y + d, h); const ftx = XP.x, fty = XP.y; xq(x, y + d, h); const fux = XP.x, fuy = XP.y;
    xq(x, y, h); const bax = XP.x, bay = XP.y; xq(x + w, y, h); const bbx = XP.x, bby = XP.y;
    const left = x + w / 2 > XCAM.x;   // right of the middle: its west side faces the middle
    xfill(side);
    if (left) { xq(x, y, 0); xquad(fax, fay, fux, fuy, bax, bay, XP.x, XP.y); }
    else { xq(x + w, y, 0); xquad(fbx, fby, ftx, fty, bbx, bby, XP.x, XP.y); }
    xfill(front); xquad(fax, fay, fbx, fby, ftx, fty, fux, fuy);
    xfill(roof); xquad(fux, fuy, ftx, fty, bbx, bby, bax, bay);
    return Z;
  }

  /** The frame: ground, flat things, then everything upright in depth order, the air, the HUD and the controls. */
  function renderExplore(t) {
    const W = XR, M = W.map, T = M.tile, Z = XCAM.zoom, sh = W.shake > 0 && !CALM ? (((t * 60) | 0) % 2 ? 1.5 : -1.5) : 0;
    ctx.setTransform(XRS, 0, 0, XRS, sh * XRS, 0);
    xfill('#141210'); ctx.fillRect(-4, -4, XW + 8, XH + 8);
    // what of the ground is in view: the rows between the top and bottom edges, the columns between the sides
    const r0 = Math.max(0, Math.floor((XCAM.y - XH * XCAM.anchor / (XCAM.sin * Z)) / T) - 1), r1 = Math.min(M.rows - 1, Math.ceil((XCAM.y + XH * (1 - XCAM.anchor) / (XCAM.sin * Z)) / T) + 1);
    const c0 = Math.max(0, Math.floor((XCAM.x - XW / 2 / Z) / T) - 1), c1 = Math.min(M.cols - 1, Math.ceil((XCAM.x + XW / 2 / Z) / T) + 1);
    for (let r = r0; r <= r1; r++) {
      xq(0, r * T, 0); const y0 = XP.y; xq(0, (r + 1) * T, 0); const y1 = XP.y;
      for (let c = c0; c <= c1; c++) {
        xq(c * T, r * T, 0); const x0 = XP.x; xq((c + 1) * T, r * T, 0);
        const g = M.ground[r * M.cols + c], road = c >= M.roadC0 && c <= M.roadC1, v = (r * 7 + c * 13 + (r >> 2)) & 3;
        const col = road ? (c === M.roadC0 ? 0 : c === M.roadC1 ? 3 : c === M.roadC0 + 1 && (r & 1) === 0 ? 2 : 1) : v;
        ctx.drawImage(XATL, col * XAW, (road ? 4 : g) * XAH, XAW, XAH, x0, y0, XP.x - x0 + .6, y1 - y0 + .6);
      }
    }
    // flat things: cracks that glow, vents that breathe embers, debris and rubble lying on the ground
    const yTop = XCAM.y - XH * XCAM.anchor / (XCAM.sin * Z) - 80, yBot = XCAM.y + XH * (1 - XCAM.anchor) / (XCAM.sin * Z) + 20;
    let p0 = 0, lo = 0, hi = M.props.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (M.props[mid].y < yTop) lo = mid + 1; else hi = mid; } p0 = lo;
    for (let i = p0; i < M.props.length; i++) { const p = M.props[i]; if (p.y > yBot) break; if (p.h === 0 || p.kind === 'rubble') xflat(p, t); }
    // upright: props with height and the actors, merged in order of their southern edge
    let na = 0;
    XSORT[na] = -1; XSY[na] = W.k.y; na++;
    { const p = W.p; let j = na++; while (j > 0 && XSY[j - 1] > p.y) { XSY[j] = XSY[j - 1]; XSORT[j] = XSORT[j - 1]; j--; } XSY[j] = p.y; XSORT[j] = -2; }
    for (let i = 0; i < W.turrets.length; i++) { const q = W.turrets[i]; if (!q.on) continue; let j = na++; while (j > 0 && XSY[j - 1] > q.y) { XSY[j] = XSY[j - 1]; XSORT[j] = XSORT[j - 1]; j--; } XSY[j] = q.y; XSORT[j] = -3 - i; }
    for (let i = 0; i < W.foes.length; i++) { const f = W.foes[i]; if (!f.on || f.y < yTop || f.y > yBot) continue; let j = na++; while (j > 0 && XSY[j - 1] > f.y) { XSY[j] = XSY[j - 1]; XSORT[j] = XSORT[j - 1]; j--; } XSY[j] = f.y; XSORT[j] = i; }
    { let j = 0; while (j + 1 < na && XSY[j + 1] < XSY[j]) { const ty = XSY[j], ts = XSORT[j]; XSY[j] = XSY[j + 1]; XSORT[j] = XSORT[j + 1]; XSY[j + 1] = ty; XSORT[j + 1] = ts; j++; } }
    let a = 0;
    for (let i = p0; i < M.props.length; i++) {
      const p = M.props[i]; if (p.y > yBot) break; if (p.h === 0 || p.kind === 'rubble') continue;
      while (a < na && XSY[a] < p.y + p.d) { xactor(XSORT[a], t); a++; }
      xprop(p, t);
    }
    while (a < na) { xactor(XSORT[a], t); a++; }
    if (W.index === 0) xcastle(M, t);
    if (W.sealed) xseal(M, t);
    // shots and sparks
    for (let i = 0; i < W.shots.length; i++) { const s = W.shots[i]; if (!s.on) continue; xq(s.x, s.y, 7); xfill(s.foe ? '#ff4d5e' : '#9ff0d8'); xell(XP.x, XP.y, 2.2 * Z * .5 + 1, 2.2 * Z * .5 + 1); xfill('#ffffff'); xell(XP.x, XP.y, Z * .5, Z * .5); }
    for (let i = 0; i < W.fx.length; i++) { const e = W.fx[i]; if (e.t <= 0) continue; xq(e.x, e.y, e.z); xfill(e.kind === 5 ? '#e9b949' : e.kind === 2 ? '#9ff0d8' : e.kind === 1 ? (i & 1 ? '#ff9a3c' : '#ffe08a') : e.kind === 6 ? '#b9a7ff' : e.kind === 7 ? '#7cf29a' : '#ffffff'); const rr = (e.kind === 2 ? 5 : 1.4) * Z * Math.min(1, e.t * 4); ctx.globalAlpha = e.kind === 2 ? .35 : 1; xell(XP.x, XP.y, rr, e.kind === 2 ? rr * .5 : rr); ctx.globalAlpha = 1; }
    // ash and embers drifting up through the view, fixed in the world as the camera moves (stateless: seeds and the clock)
    if (XT >= 1 && !CALM) {
      const n = RX.render.embers, hw = XW / 2 / Z + 8, span = hw * 2, vh = yBot - yTop;
      for (let i = 0; i < n; i++) {
        const a = XEMB[i * 3], b = XEMB[i * 3 + 1], c = XEMB[i * 3 + 2], ph = (t * (.06 + c * .1) + a) % 1;
        const wx = XCAM.x - hw + (((b * 997 + Math.sin(t * .7 + i) * 3 - (XCAM.x - hw)) % span) + span) % span;
        const wy = yTop + (((a * 1999 - yTop) % vh) + vh) % vh;
        xq(wx, wy, ph * 46); ctx.globalAlpha = (1 - ph) * (i % 3 ? .55 : .9); xfill(i % 3 ? '#8a817a' : i & 1 ? '#ff9a3c' : '#ffd27a'); ctx.fillRect(XP.x, XP.y, Z * (i % 3 ? .45 : .6), Z * (i % 3 ? .45 : .6));
      }
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(XRS, 0, 0, XRS, 0, 0);
    xhud(t);
    padPaint(ctx, .72);
  }
  function xflat(p, t) {
    const Z = XCAM.zoom;
    if (p.kind === 'crack') {
      xq(p.x, p.y + p.d / 2, 0); const ax = XP.x, ay = XP.y; xq(p.x + p.w, p.y + p.d / 2, 0);
      const pulse = .55 + .45 * Math.sin(t * 2 + (p.seed & 7));
      xfill('#1a1311'); xquad(ax, ay - Z * .9, XP.x, XP.y - Z * .4, XP.x, XP.y + Z * .6, ax, ay + Z * .9);
      ctx.globalAlpha = pulse; xfill('#ff6a2a'); xquad(ax + Z, ay - Z * .3, XP.x - Z, XP.y - Z * .15, XP.x - Z, XP.y + Z * .2, ax + Z, ay + Z * .35);
      xfill('#ffd27a'); ctx.fillRect((ax + XP.x) / 2 - Z, ay - Z * .15, Z * 2, Z * .3); ctx.globalAlpha = 1;
    } else if (p.kind === 'vent') {
      xq(p.x, p.y, 0); const ax = XP.x, ay = XP.y; xq(p.x + p.w, p.y + p.d, 0);
      xfill('#1a1716'); ctx.fillRect(ax, ay, XP.x - ax, XP.y - ay);
      xfill('#3c3530'); for (let k = 1; k < 4; k++) ctx.fillRect(ax + (XP.x - ax) * k / 4 - Z * .25, ay, Z * .5, XP.y - ay);
      const glow = .35 + .3 * Math.sin(t * 3 + (p.seed & 15)); ctx.globalAlpha = glow; xfill('#ff7a2e'); ctx.fillRect(ax + Z * .5, ay + Z * .5, XP.x - ax - Z, XP.y - ay - Z); ctx.globalAlpha = 1;
      if (XT >= 1) for (let k = 0; k < 3; k++) { const ph = (t * .7 + k / 3 + (p.seed & 7) / 7) % 1; xq(p.x + p.w * (.3 + .2 * k), p.y + p.d / 2, ph * 26); ctx.globalAlpha = 1 - ph; xfill(k & 1 ? '#ffd27a' : '#ff9a3c'); ctx.fillRect(XP.x, XP.y, Z * .6, Z * .6); }
      ctx.globalAlpha = 1;
    } else if (p.kind === 'debris') {
      xq(p.x, p.y, 0); const ax = XP.x, ay = XP.y; xq(p.x + p.w, p.y + p.d, 0);
      xfill(p.seed & 1 ? '#4a5560' : '#5b4a3a'); xtri(ax, XP.y, (ax + XP.x) / 2, ay, XP.x, XP.y - (XP.y - ay) * .3);
      xfill('#2a2420'); ctx.fillRect(ax + (XP.x - ax) * .3, XP.y - Z * .4, (XP.x - ax) * .5, Z * .4);
    } else if (p.kind === 'rubble') {
      const n = 2 + (p.seed & 3) + (XT >= 2 ? 3 : 0);
      for (let k = 0; k < n; k++) { const ox = ((p.seed >> (k * 3)) & 7) / 7 * p.w, oy = ((p.seed >> (k * 3 + 9)) & 7) / 7 * p.w * .6, s = p.w * (.2 + ((p.seed >> k) & 3) * .08);
        xq(p.x + ox, p.y + oy, 0); xfill('#4d463e'); xtri(XP.x - s * Z, XP.y, XP.x, XP.y - s * Z * .9, XP.x + s * Z * .8, XP.y); xfill('#615950'); xtri(XP.x - s * Z * .3, XP.y - s * Z * .2, XP.x, XP.y - s * Z * .9, XP.x + s * Z * .5, XP.y - s * Z * .15); }
    }
  }
  function xprop(p, t) {
    if (XT >= 2 && xpropHi(p, t)) return;
    if (p.kind === 'rock') {
      const Z = XCAM.zoom, r = p.w / 2; xq(p.x + r, p.y + r, 0); const bx = XP.x, by = XP.y;
      xfill('rgba(0,0,0,.35)'); xell(bx, by + Z, r * Z * 1.05, r * Z * .55);
      xq(p.x + r, p.y + r, p.h); const tx = XP.x, ty = XP.y;
      xfill('#3a352f'); xquad(bx - r * Z, by, tx - r * Z * .55, ty + r * Z * .3, tx, ty - r * Z * .1, bx, by + r * Z * .45);
      xfill('#4a443c'); xquad(bx, by + r * Z * .45, tx, ty - r * Z * .1, tx + r * Z * .6, ty + r * Z * .25, bx + r * Z, by);
      xfill('#625a50'); xtri(tx - r * Z * .55, ty + r * Z * .3, tx, ty - r * Z * .45, tx + r * Z * .6, ty + r * Z * .25);
    } else if (p.kind === 'ruin') {
      xbox(p.x, p.y, p.w, p.d, p.h, '#6f6a62', '#57524b', '#48443e');
      const Z = XCAM.zoom; xq(p.x + p.w * .2, p.y + p.d, p.h * .55); xfill('#2b2825'); ctx.fillRect(XP.x, XP.y, p.w * .18 * Z, p.h * .22 * Z * XCAM.cos);
      xq(p.x + p.w * .62, p.y + p.d, p.h * .55); ctx.fillRect(XP.x, XP.y, p.w * .18 * Z, p.h * .22 * Z * XCAM.cos);
      xq(p.x + p.w * .7, p.y + p.d * .4, p.h); const rx = XP.x, ry = XP.y; xq(p.x + p.w * .76, p.y + p.d * .4, p.h + 9);
      ctx.strokeStyle = '#7a4a2c'; ctx.lineWidth = Math.max(1, Z * .5); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(XP.x, XP.y); ctx.stroke();
    } else if (p.kind === 'pylon') {
      xbox(p.x, p.y, p.w, p.d, p.h, '#5d6a75', '#4a5560', '#3a434c');
      const on = ((t * 1.5 + (p.seed & 3)) | 0) % 2; xq(p.x + p.w / 2, p.y + p.d / 2, p.h + 2); xfill(on ? '#ff4d5e' : '#5a2228'); xell(XP.x, XP.y, XCAM.zoom * 1.4, XCAM.zoom * 1.4);
    } else if (p.kind === 'crate') {
      if (p.open) { xbox(p.x, p.y, p.w, p.d, 2, '#3a2c1a', '#2e2315', '#261d12'); return; }
      xbox(p.x, p.y, p.w, p.d, p.h, '#9a7a44', '#7a5e32', '#654d29');
      xq(p.x, p.y + p.d, p.h * .5); xfill('#c8932a'); ctx.fillRect(XP.x, XP.y - XCAM.zoom * .4, p.w * XCAM.zoom, XCAM.zoom * .8);
    }
  }
  /** An actor: -1 is the Keeper, else a machine by its slot. */
  function xactor(i, t) {
    if (i < 0) { if (i === -1) { if (XT >= 2) xkeeperHi(t); else xkeeper(t); } else if (i === -2) xpartner(t); else xturret(XR.turrets[-3 - i], t); return; }
    const f = XR.foes[i], Z = XCAM.zoom; xq(f.x, f.y, 0); const x = XP.x, y = XP.y, hit = f.hit > 0 && !CALM;
    xfill('rgba(0,0,0,.38)'); xell(x, y, f.r * Z * 1.1, f.r * Z * .5);
    if (XT >= 2) { if (f.type === 'crawler') xcrawlerHi(f, x, y, Z, hit); else if (f.type === 'drone') xdroneHi(f, x, y, Z, hit, t); else xbruteHi(f, x, y, Z, hit); }
    else if (f.type === 'crawler') {
      const leg = Math.sin(f.t * 14) * Z * 1.2; xfill('#2a2e33');
      for (let k = -1; k <= 1; k += 2) { xtri(x + k * f.r * Z * .4, y - Z * 3, x + k * f.r * Z * 1.25, y - Z + leg * k, x + k * f.r * Z * .9, y + Z * .3); xtri(x + k * f.r * Z * .3, y - Z * 2, x + k * f.r * Z * 1.1, y + Z + leg * -k, x + k * f.r * Z * .6, y + Z * 1.2); }
      xfill(hit ? '#ffffff' : '#6b6f74'); xell(x, y - Z * 4, f.r * Z * .85, f.r * Z * .55);
      xfill(hit ? '#ffffff' : '#8a8f94'); xell(x, y - Z * 4.8, f.r * Z * .55, f.r * Z * .3);
      xfill('#ff4d5e'); xell(x + f.face * f.r * Z * .45, y - Z * 4, Z * .9, Z * .7);
    } else if (f.type === 'drone') {
      const hov = Math.sin(f.t * 5) * Z * 1.2, hy = y - Z * 11 + hov;
      xfill(hit ? '#ffffff' : '#3c4a56'); xell(x, hy, f.r * Z * 1.1, f.r * Z * .55);
      xfill(hit ? '#ffffff' : '#56687a'); xell(x, hy - Z * 1.2, f.r * Z * .7, f.r * Z * .35);
      ctx.globalAlpha = .5; xfill('#c8d3dc'); const sp = (f.t * 40) % 6.28; xell(x - f.r * Z * 1.1, hy - Z * 2, f.r * Z * .7 * Math.abs(Math.cos(sp)) + Z * .3, Z * .5); xell(x + f.r * Z * 1.1, hy - Z * 2, f.r * Z * .7 * Math.abs(Math.sin(sp)) + Z * .3, Z * .5); ctx.globalAlpha = 1;
      xfill(f.cd < .35 && ((t * 16) | 0) % 2 ? '#ffe08a' : '#ff4d5e'); xell(x, hy + Z * .8, Z * 1.1, Z * .8);
    } else {
      const sway = Math.sin(f.t * 5) * Z; xfill('#2a2e33');
      ctx.fillRect(x - f.r * Z * .7, y - Z * 7 + sway, Z * 3, Z * 7 - sway); ctx.fillRect(x + f.r * Z * .7 - Z * 3, y - Z * 7 - sway, Z * 3, Z * 7 + sway);
      xfill(hit ? '#ffffff' : '#7a4a36'); xquad(x - f.r * Z, y - Z * 7, x + f.r * Z, y - Z * 7, x + f.r * Z * .8, y - Z * 17, x - f.r * Z * .8, y - Z * 17);
      xfill(hit ? '#ffffff' : '#9a5e42'); xquad(x - f.r * Z * .8, y - Z * 17, x + f.r * Z * .8, y - Z * 17, x + f.r * Z * .5, y - Z * 20, x - f.r * Z * .5, y - Z * 20);
      xfill('#ffe08a'); ctx.fillRect(x - Z * 2.5 + f.face * Z * 2, y - Z * 15.5, Z * 5, Z * 1.2);
    }
    if (f.hp < f.max) { xfill('#14161a'); ctx.fillRect(x - Z * 5, y - Z * 23, Z * 10, Z * 1.2); xfill('#ff4d5e'); ctx.fillRect(x - Z * 5, y - Z * 23, Z * 10 * f.hp / f.max, Z * 1.2); }
  }
  /** The Keeper, upright: shadow, legs in step, a plated body in its paint, a helmet with a lit visor, the arm on the aim. */
  function xkeeper(t) {
    const k = XR.k, Z = XCAM.zoom; if (k.inv > 0 && k.dash <= 0 && ((t * 16) | 0) % 2) return;
    xq(k.x, k.y, 0); const x = XP.x, y = XP.y, face = k.fx >= 0 ? 1 : -1, sw = Math.sin(k.step) * Z * 1.6, paint = XPAINT.c;
    xfill('rgba(0,0,0,.4)'); xell(x, y, Z * 6, Z * 2.6);
    if (k.dash > 0) { ctx.globalAlpha = .3; xfill('#9ff0d8'); xell(x - k.fx * Z * 8, y - Z * 8 - k.fy * Z * 4, Z * 4, Z * 7); ctx.globalAlpha = 1; }
    xfill('#22262b'); ctx.fillRect(x - Z * 3, y - Z * 8 + sw * .3, Z * 2.4, Z * 8 - sw * .3); ctx.fillRect(x + Z * .6, y - Z * 8 - sw * .3, Z * 2.4, Z * 8 + sw * .3);
    xfill('#3a4048'); xquad(x - Z * 4.5, y - Z * 8, x + Z * 4.5, y - Z * 8, x + Z * 5, y - Z * 16, x - Z * 5, y - Z * 16);
    xfill(paint); xquad(x - Z * 3.5, y - Z * 9.5, x + Z * 3.5, y - Z * 9.5, x + Z * 4, y - Z * 15, x - Z * 4, y - Z * 15);
    xfill('#59616b'); xell(x - Z * 5, y - Z * 15.5, Z * 2.2, Z * 1.6); xell(x + Z * 5, y - Z * 15.5, Z * 2.2, Z * 1.6);
    xfill('#2f353c'); xell(x, y - Z * 19, Z * 3.6, Z * 3.4);
    xfill('#9ff0d8'); ctx.fillRect(x - Z * 2.6 + face * Z * .8, y - Z * 19.8, Z * 4.2, Z * 1.3);
    // the arm and its blaster, on the aim (a machine in the cone) or along the facing
    let dx = k.fx, dy = k.fy; if (k.aim >= 0) { const f = XR.foes[k.aim]; dx = f.x - k.x; dy = f.y - k.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; }
    const hx = x + face * Z * 4, hy = y - Z * 13, ex = hx + dx * Z * 7, ey = hy + dy * Z * 7 * XCAM.sin;
    ctx.strokeStyle = '#4a5560'; ctx.lineWidth = Z * 2.2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    xfill(XR.k.cd > 0 ? '#ffe08a' : '#14161a'); xell(ex, ey, Z * 1.2, Z * 1.2);
  }
  // ── the partner and its turrets (FW13) ──
  /**
   * The partner, upright, put together from its four parts: the base it stands on (legs in step, tracks rolling, wheels
   * turning, or rotors holding it up), the chassis with its core glowing through a window and a stripe in the Keeper's
   * paint, the tool (an arm that reaches for its target, or a gripper's jaws) and the sensor head. Tier 2 draws each
   * part in its joints, panels and lights; below that, the same silhouette in a few shapes. Down, it slumps and blinks.
   */
  function xpartner(t) {
    const p = XR.p, b = p.b, Z = XCAM.zoom; if (p.up && p.inv > 0 && ((t * 16) | 0) % 2) return;
    xq(p.x, p.y, 0); const x = XP.x, y = XP.y, f = p.face, hi = XT >= 2, fly = b.base === 'rotors';
    const hov = fly && p.up ? Z * (13 + Math.sin(p.t * 3) * 1.4) : 0;
    xfill('rgba(0,0,0,.36)'); xell(x, y, Z * (fly ? 4.5 : 6.5), Z * (fly ? 1.7 : 2.5));
    if (!p.up) {   // down: the chassis on the ground, dark, an amber light blinking while it reboots
      xfill('#2f343a'); xquad(x - Z * 5, y, x + Z * 5, y, x + Z * 4.5, y - Z * 3.5, x - Z * 4.5, y - Z * 3.5);
      xfill('#3c434b'); xquad(x - Z * 4.5, y - Z * 3.5, x + Z * 4.5, y - Z * 3.5, x + Z * 3.6, y - Z * 5.4, x - Z * 3.6, y - Z * 5.4);
      xfill(((t * 4) | 0) % 2 ? '#ffb347' : '#5a3d1a'); xell(x + f * Z * 2, y - Z * 4.4, Z * .9, Z * .6);
      xfill('#14161a'); ctx.fillRect(x - Z * 5, y - Z * 9, Z * 10, Z * 1.1); xfill('#ffb347'); ctx.fillRect(x - Z * 5, y - Z * 9, Z * 10 * (1 - p.down / p.s.reboot_s), Z * 1.1);
      return;
    }
    const by = y - hov - (b.base === 'legs' ? Z * 7 : b.base === 'tracks' ? Z * 4.5 : b.base === 'wheels' ? Z * 4 : Z * 2);   // the chassis's lower edge
    xpbase(b.base, p, x, y, by, Z, f, hi);
    xpbody(b.core, p, x, by, Z, f, hi, t);
    xptool(b.tool, p, x, by, Z, f, hi);
    xphead(b.head, p, x, by, Z, f, hi, t);
    xfill(p.mode ? '#ff4d5e' : '#9ff0d8'); xtri(x - Z * 1.2, by - Z * 14, x + Z * 1.2, by - Z * 14, x, by - Z * 12.4);   // the order it is on: hunt or follow
    if (p.hp < p.max) { xfill('#14161a'); ctx.fillRect(x - Z * 4.5, by - Z * 16.4, Z * 9, Z * 1.1); xfill('#7cf29a'); ctx.fillRect(x - Z * 4.5, by - Z * 16.4, Z * 9 * p.hp / p.max, Z * 1.1); }
  }
  /** The base: four jointed legs in a walking gait, a pair of tracks, four wheels, or four rotors on arms (with skids). */
  function xpbase(kind, p, x, y, by, Z, f, hi) {
    const st = p.step, moving = p.vx !== 0 || p.vy !== 0;
    if (kind === 'legs') {
      for (let i = 0; i < 4; i++) {   // the far pair first, darker; each leg a thigh, a shin, a knee and a foot
        const far = i < 2, side = i & 1 ? 1 : -1, ph = st + (i === 0 || i === 3 ? 0 : Math.PI), lift = moving ? Math.max(0, Math.sin(ph)) * Z * 1.6 : 0, sw = moving ? Math.cos(ph) * Z * 1.6 * f : 0;
        const hx = x + side * Z * 3.6, hy = by - Z * (far ? 1.6 : .6), fx = hx + side * Z * 1.2 + sw, fy = y - (far ? Z * 1.4 : 0) - lift, kx = hx + side * Z * 2.6 + sw * .5, ky = (hy + fy) * .5 - Z * 1.2;
        const c = far ? '#30353b' : '#454c55';
        xline(hx, hy, kx, ky, Z * (hi ? 2 : 1.6), c); xline(kx, ky, fx, fy, Z * (hi ? 1.5 : 1.2), c);
        if (hi) { xfill(far ? '#3c434b' : '#5f6a74'); xell(hx, hy, Z * 1.3, Z * 1.1); xell(kx, ky, Z * 1, Z * .9); xfill('#c8932a'); xell(kx, ky, Z * .45, Z * .4); xfill('#22262b'); xell(fx, fy, Z * 1.2, Z * .55); }
      }
    } else if (kind === 'tracks') {
      for (let i = 0; i < 2; i++) {   // the far track, then the near one: a belt, its road wheels and the treads moving with the step
        const ty = y - (i ? 0 : Z * 2), x0 = x - Z * 6.5, x1 = x + Z * 6.5, c = i ? '#2a2e33' : '#22262b';
        xfill(c); xquad(x0 + Z, ty, x1 - Z, ty, x1, ty - Z * 3.6, x0, ty - Z * 3.6);
        if (!hi) continue;
        xfill(i ? '#6f7d5a' : '#525c43'); ctx.fillRect(x0 + Z * .4, ty - Z * 4.2, x1 - x0 - Z * .8, Z * .9);   // the mudguard
        xfill(i ? '#59616b' : '#3c434b'); for (let w = 0; w < 4; w++) xell(x0 + Z * (1.8 + w * 3.1), ty - Z * 1.7, Z * 1.2, Z * 1.1);
        xfill('#15171a'); const span = x1 - x0 - Z * 2.4, off = ((st * f * Z * 1.5) % span + span) % span;   // the treads, wrapped along the belt
        for (let s = 0; s < 6; s++) ctx.fillRect(x0 + Z * .8 + (s * span / 6 + off) % span, ty - Z * .5, Z * .7, Z * .5);
      }
    } else if (kind === 'wheels') {
      xfill('#2f353c'); xquad(x - Z * 6, by + Z * 1.2, x + Z * 6, by + Z * 1.2, x + Z * 5.5, by - Z * .4, x - Z * 5.5, by - Z * .4);   // the low deck
      for (let i = 0; i < 4; i++) {
        const far = i < 2, wx = x + (i & 1 ? 1 : -1) * Z * 4.4, wy = y - (far ? Z * 1.8 : 0) - Z * 1.6, r = Z * (far ? 1.6 : 1.9);
        xfill(far ? '#15171a' : '#1b1e22'); xell(wx, wy, r, r);
        if (!hi) continue;
        xfill(far ? '#3c434b' : '#7d8792'); xell(wx, wy, r * .5, r * .5);
        const a = st * 1.4 * f; xline(wx - Math.cos(a) * r * .8, wy - Math.sin(a) * r * .8, wx + Math.cos(a) * r * .8, wy + Math.sin(a) * r * .8, Z * .4, '#2a2e33');
      }
      if (hi) { xfill('#4a90b8'); ctx.fillRect(x - Z * 5, by - Z * .1, Z * 10, Z * .6); xfill('#ffe08a'); xell(x + f * Z * 5.6, by + Z * .4, Z * .6, Z * .45); }   // the stripe and a headlight
    } else {
      xline(x - Z * 3, by + Z * 2.2, x + Z * 3, by + Z * 2.2, Z * .6, '#30353b');   // the skids
      if (hi) { xline(x - Z * 2.4, by, x - Z * 2.8, by + Z * 2.2, Z * .5, '#30353b'); xline(x + Z * 2.4, by, x + Z * 2.8, by + Z * 2.2, Z * .5, '#30353b'); }
      for (let i = 0; i < 4; i++) {   // the far rotors first; an arm, a motor, a blur of blades, and in the dense tier the blade itself
        const far = i < 2, rx = x + (i & 1 ? 1 : -1) * Z * 7.5, ry = by - Z * (far ? 5.2 : 2.6);
        xline(x + (i & 1 ? 1 : -1) * Z * 3, by - Z * 3, rx, ry, Z * (hi ? 1 : .8), far ? '#3c434b' : '#59616b');
        xfill('#22262b'); xell(rx, ry, Z * .9, Z * .7);
        ctx.globalAlpha = .32; xfill('#c8d3dc'); xell(rx, ry - Z * .6, Z * 3.4, Z * 1.1); ctx.globalAlpha = 1;
        if (hi) { const a = p.t * 38 + i * 1.7, cx = Math.cos(a) * Z * 3.2, cy = Math.sin(a) * Z * 1; xline(rx - cx, ry - Z * .6 - cy, rx + cx, ry - Z * .6 + cy, Z * .4, '#e8ecef'); xfill('#8fd3ff'); xell(rx, ry + Z * .3, Z * .35, Z * .3); }
      }
    }
  }
  /** The chassis: a box with a lit top, a window on the core (its colour, breathing) and a stripe in the Keeper's paint. */
  function xpbody(core, p, x, by, Z, f, hi, t) {
    xfill('#3c434b'); xquad(x - Z * 5, by, x + Z * 5, by, x + Z * 5, by - Z * 4, x - Z * 5, by - Z * 4);
    xfill('#59616b'); xquad(x - Z * 5, by - Z * 4, x + Z * 5, by - Z * 4, x + Z * 4, by - Z * 6.5, x - Z * 4, by - Z * 6.5);
    xfill('#30353b'); xquad(x - f * Z * 5, by, x - f * Z * 5, by - Z * 4, x - f * Z * 4, by - Z * 6.5, x - f * Z * 4, by - Z * 2.6);   // the side turned from the light
    xfill(XPAINT.c); ctx.fillRect(x - Z * 5, by - Z * 3.1, Z * 10, Z * .8);
    const C = RX.partner.parts.core[core], glow = .55 + .45 * Math.sin(t * (core === 'cap' ? 7 : 3));
    xfill('#14161a'); xell(x + f * Z * 1.4, by - Z * 1.5, Z * 1.6, Z * 1.1);
    ctx.globalAlpha = glow; xfill(C.colour); xell(x + f * Z * 1.4, by - Z * 1.5, Z * 1.1, Z * .75); ctx.globalAlpha = 1;
    if (!hi) return;
    xline(x - Z * 5, by - Z * 4, x + Z * 5, by - Z * 4, Z * .3, '#7d8792');   // the lit edge, seams, vents and rivets
    xline(x - f * Z * 1.2, by - Z * .2, x - f * Z * 1.2, by - Z * 2.3, Z * .25, '#2a2e33');
    xfill('#22262b'); for (let i = 0; i < 3; i++) ctx.fillRect(x - f * Z * (4.2 - i * .9), by - Z * 1.9, Z * .45, Z * 1.4);
    xfill('#8a929c'); ctx.fillRect(x - Z * 4.6, by - Z * 3.8, Z * .5, Z * .5); ctx.fillRect(x + Z * 4.1, by - Z * 3.8, Z * .5, Z * .5); ctx.fillRect(x - Z * 4.6, by - Z * .7, Z * .5, Z * .5); ctx.fillRect(x + Z * 4.1, by - Z * .7, Z * .5, Z * .5);
    xfill('#4a525b'); xquad(x - Z * 2.5, by - Z * 4.6, x + Z * 2.5, by - Z * 4.6, x + Z * 2, by - Z * 6, x - Z * 2, by - Z * 6);   // a hatch on top
    if (core === 'swap') { xfill('#ffe08a'); ctx.fillRect(x + f * Z * 3.2, by - Z * 2.4, Z * .9, Z * 1.8); }   // the swap pack's handle
  }
  /** The tool: an arm of two links that reaches for its target (and lunges when it strikes), or a gripper's two jaws. */
  function xptool(kind, p, x, by, Z, f, hi) {
    let ax = f, ay = 0;
    if (p.target >= 0) { const q = XR.foes[p.target]; ax = q.x - p.x; ay = (q.y - p.y) * XCAM.sin; const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d; }
    const reach = p.swing > 0 ? 1.35 : 1;
    if (kind === 'arm') {
      const sx = x + f * Z * 3.4, sy = by - Z * 6.2, ex = sx + ax * Z * 2.6, ey = sy - Z * 4.2, wx = ex + ax * Z * 5 * reach, wy = ey + Z * 2.4 + ay * Z * 3 * reach;
      xline(sx, sy, ex, ey, Z * (hi ? 1.7 : 1.4), '#e9b949'); xline(ex, ey, wx, wy, Z * (hi ? 1.3 : 1.1), '#c8932a');
      if (!hi) return;
      xfill('#3c434b'); xell(sx, sy, Z * 1.3, Z * 1.1); xell(ex, ey, Z * 1.05, Z); xell(wx, wy, Z * .8, Z * .75);
      xfill('#14161a'); xell(sx, sy, Z * .5, Z * .45); xell(ex, ey, Z * .4, Z * .38);
      xline(sx - f * Z * .5, sy + Z * .4, ex - ax * Z * .6, ey + Z * .5, Z * .25, '#22262b');   // the cable along the upper link
      const o = p.swing > 0 ? .4 : 1;   // the fingers: open, or shut on a strike
      xfill('#7d8792'); xtri(wx, wy, wx + ax * Z * 1.8 - ay * Z * .9 * o, wy + ay * Z * 1.8 - Z * .9 * o, wx + ax * Z * .9, wy + ay * Z * .9);
      xtri(wx, wy, wx + ax * Z * 1.8 + ay * Z * .9 * o, wy + ay * Z * 1.8 + Z * .9 * o, wx + ax * Z * .9, wy + ay * Z * .9);
    } else {
      const mx = x + f * Z * 5.2, my = by - Z * 2.2, o = p.swing > 0 ? .25 : .7 + Math.sin(p.t * 2.5) * .3, L = Z * 2.8 * reach;
      xfill('#3c434b'); ctx.fillRect(mx - (f > 0 ? 0 : Z * 1.2), my - Z * 1.2, Z * 1.2, Z * 2.4);
      xfill('#9ff0d8'); xtri(mx, my - Z * .4, mx + f * L, my - Z * .4 - Z * 1.2 * o, mx + f * L * .8, my - Z * .4);
      xtri(mx, my + Z * .4, mx + f * L, my + Z * .4 + Z * 1.2 * o, mx + f * L * .8, my + Z * .4);
      if (hi) { xfill('#22262b'); xell(mx, my, Z * .7, Z * .7); xfill('#5fb8a0'); xtri(mx + f * L * .8, my - Z * .4, mx + f * L, my - Z * .4 - Z * 1.2 * o, mx + f * L, my - Z * .2); xtri(mx + f * L * .8, my + Z * .4, mx + f * L, my + Z * .4 + Z * 1.2 * o, mx + f * L, my + Z * .2); }
    }
  }
  /** The sensor head: a laser scanner's spinning puck, a depth camera's lens, or a heat camera's twin lenses on a gimbal. */
  function xphead(kind, p, x, by, Z, f, hi, t) {
    const hx = x - f * Z * 1.4, hy = by - Z * 7.6;
    xline(hx, by - Z * 5.6, hx, hy + Z * .6, Z * (hi ? 1 : .8), '#30353b');   // the neck
    if (kind === 'lidar') {
      xfill('#22262b'); ctx.fillRect(hx - Z * 2, hy - Z * 1.4, Z * 4, Z * 1.6); xell(hx, hy + Z * .2, Z * 2, Z * .7);
      xfill('#3c434b'); xell(hx, hy - Z * 1.4, Z * 2, Z * .7);
      const a = p.t * 7, dx = Math.cos(a) * Z * 1.9; if (Math.sin(a) > 0 || !hi) { xfill('#7cf29a'); ctx.fillRect(hx + dx - Z * .35, hy - Z, Z * .7, Z * .7); }
      if (hi) { xfill('#14161a'); ctx.fillRect(hx - Z * 2, hy - Z * .7, Z * 4, Z * .3); const ph = (t * .5) % 1; ctx.globalAlpha = (1 - ph) * .35; ctx.strokeStyle = '#7cf29a'; ctx.lineWidth = Z * .3; ctx.beginPath(); ctx.ellipse(hx, hy - Z * .6, Z * (2 + ph * 9), Z * (.7 + ph * 3), 0, 0, 6.2832); ctx.stroke(); ctx.globalAlpha = 1; }
    } else if (kind === 'camera') {
      xfill('#3c434b'); xquad(hx - Z * 2.2, hy + Z * .8, hx + Z * 2.2, hy + Z * .8, hx + Z * 2, hy - Z * 1.8, hx - Z * 2, hy - Z * 1.8);
      xfill('#14161a'); xell(hx + f * Z * 1, hy - Z * .5, Z * 1.2, Z * 1.1);
      xfill('#b9a7ff'); xell(hx + f * Z * 1.1, hy - Z * .5, Z * .75, Z * .7);
      if (hi) { xfill('#2a1f4a'); xell(hx + f * Z * 1.1, hy - Z * .5, Z * .35, Z * .33); xfill('#ffffff'); xell(hx + f * Z * 1.35, hy - Z * .8, Z * .2, Z * .18); xfill('#59616b'); ctx.fillRect(hx - Z * 2, hy - Z * 1.8, Z * 4, Z * .4); xfill('#ff4d5e'); xell(hx - f * Z * 1.3, hy - Z * 1.1, Z * .3, Z * .3); }
    } else {
      xline(hx - Z * 2.2, hy + Z * .8, hx - Z * 2.2, hy - Z * 1.2, Z * .5, '#59616b'); xline(hx + Z * 2.2, hy + Z * .8, hx + Z * 2.2, hy - Z * 1.2, Z * .5, '#59616b');   // the gimbal's yoke
      xfill('#2f353c'); xell(hx, hy - Z * .3, Z * 1.9, Z * 1.6);
      const glow = .6 + .4 * Math.sin(t * 2.2); ctx.globalAlpha = glow; xfill('#ff9a3c'); xell(hx + f * Z * .4 - Z * .7, hy - Z * .4, Z * .55, Z * .5); xell(hx + f * Z * .4 + Z * .7, hy - Z * .4, Z * .55, Z * .5); ctx.globalAlpha = 1;
      if (hi) { xfill('#4a525b'); xell(hx, hy - Z * 1.5, Z * 1.3, Z * .4); xfill('#ffe08a'); xell(hx + f * Z * .4 - Z * .7, hy - Z * .55, Z * .2, Z * .18); xell(hx + f * Z * .4 + Z * .7, hy - Z * .55, Z * .2, Z * .18); }
    }
  }
  /** A turret the partner built: a tripod, a box, a barrel on its aim, a light that blinks as its time runs out. */
  function xturret(q, t) {
    const Z = XCAM.zoom; xq(q.x, q.y, 0); const x = XP.x, y = XP.y, hi = XT >= 2, ca = Math.cos(q.aim), sa = Math.sin(q.aim) * XCAM.sin;
    xfill('rgba(0,0,0,.34)'); xell(x, y, Z * 4.5, Z * 1.8);
    xline(x, y - Z * 4, x - Z * 3.6, y + Z * .2, Z * .6, '#30353b'); xline(x, y - Z * 4, x + Z * 3.6, y + Z * .2, Z * .6, '#30353b'); xline(x, y - Z * 4, x, y + Z * 1, Z * .6, '#22262b');
    xfill('#4a525b'); xquad(x - Z * 2.4, y - Z * 3.6, x + Z * 2.4, y - Z * 3.6, x + Z * 2.2, y - Z * 7, x - Z * 2.2, y - Z * 7);
    xline(x, y - Z * 5.6, x + ca * Z * 5, y - Z * 5.6 + sa * Z * 5, Z * 1.1, '#2a2e33');
    if (hi) { xfill('#6b747e'); xquad(x - Z * 2.2, y - Z * 7, x + Z * 2.2, y - Z * 7, x + Z * 1.6, y - Z * 8.2, x - Z * 1.6, y - Z * 8.2); xfill('#c8932a'); ctx.fillRect(x - Z * 2.4, y - Z * 4.6, Z * 4.8, Z * .5); xfill('#14161a'); xell(x + ca * Z * 5, y - Z * 5.6 + sa * Z * 5, Z * .5, Z * .5); }
    xfill(q.life < 3 && ((t * 6) | 0) % 2 ? '#14161a' : '#ffe08a'); xell(x, y - Z * 8.4, Z * .6, Z * .5);
    if (q.hp < q.max) { xfill('#14161a'); ctx.fillRect(x - Z * 3, y - Z * 10.4, Z * 6, Z * .9); xfill('#ffe08a'); ctx.fillRect(x - Z * 3, y - Z * 10.4, Z * 6 * Math.max(0, q.hp) / q.max, Z * .9); }
  }
  /** The castle from above at the first region's south end: a wall across with a gate on the road, towers at its ends. */
  function xcastle(M, t) {
    const T = M.tile, y = M.gate.y, w = M.cols * T, gx0 = M.roadC0 * T, gx1 = (M.roadC1 + 1) * T;
    const n = CAS.count, wallH = 10 + Math.min(18, n.course * .6 + n.wall * .5), dim = S.horde.dim;
    const roof = dim ? '#4a4640' : '#8a8378', front = dim ? '#3a3631' : '#6e675d', side = dim ? '#2e2b27' : '#5a544c';
    xbox(0, y, gx0, T * 1.2, wallH, roof, front, side); xbox(gx1, y, w - gx1, T * 1.2, wallH, roof, front, side);
    if (XT >= 2) {   // the dense tier: courses of stone along the wall's face, and scorch where the horde has hit it
      const Z = XCAM.zoom; xfill(dim ? '#2e2b27' : '#5a544c');
      for (let h = 3; h < wallH; h += 3.2) { xq(0, y + T * 1.2, h); const ax = XP.x, ay = XP.y; xq(gx0, y + T * 1.2, h); ctx.fillRect(ax, ay, XP.x - ax, Z * .3); xq(gx1, y + T * 1.2, h); const bx = XP.x; xq(w, y + T * 1.2, h); ctx.fillRect(bx, XP.y, XP.x - bx, Z * .3); }
      xfill(dim ? '#3a3631' : '#625b52'); for (let x = 6, i = 0; x < w; x += 7, i++) { if (x > gx0 - 4 && x < gx1) continue; xq(x + (i & 1) * 3, y + T * 1.2, 1.6 + (i % 3) * 3.2); ctx.fillRect(XP.x, XP.y - Z * 1.4, Z * .3, Z * 1.4); }   // the joints, staggered
      ctx.globalAlpha = .35; xfill('#14110e'); for (let x = 20; x < w; x += 53) { if (x > gx0 - 10 && x < gx1 + 4) continue; xq(x, y + T * 1.2, wallH * .4); xell(XP.x, XP.y, Z * 6, Z * 3.4); } ctx.globalAlpha = 1;
    }
    for (let x = 4; x < w; x += 12) { if (x > gx0 - 6 && x < gx1 + 2) continue; xbox(x, y, 5, T * .5, wallH + 4, roof, front, side); }   // the crenels
    const towers = CAS.towers;
    for (let i = 0; i < towers.length; i++) { const tx = i === 0 ? T * .4 : i === 1 ? w - T * 2.4 : i === 2 ? gx0 - T * 2.2 : gx1 + T * .2, th = wallH + 10 + towers[i] * 5; xbox(tx, y - T * .4, T * 2, T * 2, th, roof, front, side); if (XT >= 2) xtowerHi(tx, y - T * .4, T * 2, th, i, dim); if (n.lamp > i) { xq(tx + T, y + T * .6, th + 3); xfill(dim ? '#5a4a2a' : '#ffd27a'); xell(XP.x, XP.y, XCAM.zoom * 2, XCAM.zoom * 2); } }
    xq(gx0, y + T * 1.2, 0); const gax = XP.x, gay = XP.y; xq(gx1, y + T * 1.2, wallH); xfill('rgba(20,18,16,.6)'); ctx.fillRect(gax, XP.y, XP.x - gax, gay - XP.y);
  }
  /** The north edge while the next region is sealed: a line of light across the road, and a word when the Keeper bumps it. */
  function xseal(M, t) {
    xq(0, M.north, 0); const y = XP.y, x0 = XP.x; xq(M.cols * M.tile, M.north, 0);
    ctx.globalAlpha = .45 + .25 * Math.sin(t * 4) + (XR.bump > 0 ? .3 : 0); xfill('#9b7bff'); ctx.fillRect(x0, y - XCAM.zoom * 14, XP.x - x0, XCAM.zoom * 14); ctx.globalAlpha = 1;
  }

  // ── the dense tier (FW12): more parts, more faces. Every colour is a solid fill; nothing is an image ──
  /** The Keeper at the dense tier: a reactor pack, jointed legs with guards and toe caps, a belt with pouches, a plated
   *  chest in its paint with a lit core and rivets, cabled shoulders, a crested helmet with a visor that glows and an
   *  antenna, and a two-part arm to a blaster with a coil. About three times the faces of the plain Keeper. */
  function xkeeperHi(t) {
    const k = XR.k, Z = XCAM.zoom; if (k.inv > 0 && k.dash <= 0 && ((t * 16) | 0) % 2) return;
    xq(k.x, k.y, 0); const x = XP.x, y = XP.y, f = k.fx >= 0 ? 1 : -1, sw = Math.sin(k.step) * Z * 1.6, paint = XPAINT.c, lit = .6 + .4 * Math.sin(t * 5);
    xfill('rgba(0,0,0,.42)'); xell(x, y, Z * 6.5, Z * 2.8);
    if (k.dash > 0) { ctx.globalAlpha = .3; xfill('#9ff0d8'); xell(x - k.fx * Z * 8, y - Z * 9 - k.fy * Z * 4, Z * 4.5, Z * 8); xell(x - k.fx * Z * 14, y - Z * 9 - k.fy * Z * 7, Z * 3, Z * 6); ctx.globalAlpha = 1; }
    // the reactor pack, behind: its two ports breathe
    xfill('#262b31'); xquad(x - Z * 3.8, y - Z * 17.5, x + Z * 3.8, y - Z * 17.5, x + Z * 3.4, y - Z * 10.5, x - Z * 3.4, y - Z * 10.5);
    ctx.globalAlpha = lit; xfill('#ff9a3c'); xell(x - Z * 2.4, y - Z * 18, Z * .9, Z * .6); xell(x + Z * 2.4, y - Z * 18, Z * .9, Z * .6); ctx.globalAlpha = 1;
    // legs: thigh, shin, knee guard, boot, toe cap, in step
    for (let side = -1; side <= 1; side += 2) {
      const lx = x + side * Z * 1.9, lift = side * sw * .3, kn = y - Z * 4.4 + lift * .5;
      xfill('#1d2126'); xquad(lx - Z * 1.4, y - Z * 8.5, lx + Z * 1.4, y - Z * 8.5, lx + Z * 1.2, kn, lx - Z * 1.2, kn);
      xfill('#2a3038'); xquad(lx - Z * 1.2, kn, lx + Z * 1.2, kn, lx + Z * 1.1, y - Z * 1.4 + lift, lx - Z * 1.1, y - Z * 1.4 + lift);
      xfill('#4a525c'); xtri(lx - Z * 1.3, kn - Z * .8, lx + Z * 1.3, kn - Z * .8, lx, kn + Z * 1.3);
      xfill('#16191d'); xquad(lx - Z * 1.5, y - Z * 1.6 + lift, lx + Z * 1.5, y - Z * 1.6 + lift, lx + Z * 1.7 + f * Z * .6, y + lift * .2, lx - Z * 1.5, y + lift * .2);
      xfill('#59616b'); xtri(lx + f * Z * .4, y - Z * 1.2 + lift, lx + f * Z * 2.2, y + lift * .2, lx + f * Z * .2, y + lift * .2);
    }
    // belt, buckle, two pouches
    xfill('#2b3036'); ctx.fillRect(x - Z * 4.4, y - Z * 9.6, Z * 8.8, Z * 1.8);
    xfill('#c8932a'); ctx.fillRect(x - Z * .8, y - Z * 9.5, Z * 1.6, Z * 1.5);
    xfill('#3a4048'); ctx.fillRect(x - Z * 4.2, y - Z * 9.2, Z * 1.8, Z * 2.4); ctx.fillRect(x + Z * 2.4, y - Z * 9.2, Z * 1.8, Z * 2.4);
    // the torso: shell, the painted plate and its shaded half, a seam, vents, the core, rivets, cables to the pack
    xfill('#323840'); xquad(x - Z * 4.6, y - Z * 9.6, x + Z * 4.6, y - Z * 9.6, x + Z * 5.2, y - Z * 16.8, x - Z * 5.2, y - Z * 16.8);
    xfill(paint); xquad(x - Z * 3.6, y - Z * 11.2, x + Z * 3.6, y - Z * 11.2, x + Z * 4.2, y - Z * 16.2, x - Z * 4.2, y - Z * 16.2);
    xfill('rgba(0,0,0,.28)'); xquad(x - f * Z * .2, y - Z * 11.2, x - f * Z * 3.6, y - Z * 11.2, x - f * Z * 4.2, y - Z * 16.2, x - f * Z * .2, y - Z * 16.2);
    xfill('#1d2126'); ctx.fillRect(x - Z * .3, y - Z * 16.2, Z * .6, Z * 5);
    xfill('#4a525c'); ctx.fillRect(x - Z * 3.4, y - Z * 10.9, Z * 2.2, Z * .5); ctx.fillRect(x + Z * 1.2, y - Z * 10.9, Z * 2.2, Z * .5);
    ctx.globalAlpha = lit; xfill('#9ff0d8'); xell(x, y - Z * 13.6, Z * 1.1, Z * 1.1); ctx.globalAlpha = 1; xfill('#e9fff9'); xell(x, y - Z * 13.6, Z * .45, Z * .45);
    xfill('#c8d3dc'); xell(x - Z * 3.2, y - Z * 15.6, Z * .3, Z * .3); xell(x + Z * 3.2, y - Z * 15.6, Z * .3, Z * .3); xell(x - Z * 2.8, y - Z * 11.8, Z * .3, Z * .3); xell(x + Z * 2.8, y - Z * 11.8, Z * .3, Z * .3);
    ctx.strokeStyle = '#14161a'; ctx.lineWidth = Math.max(.6, Z * .6); ctx.beginPath(); ctx.moveTo(x - Z * 4.6, y - Z * 16); ctx.quadraticCurveTo(x - Z * 6, y - Z * 13, x - Z * 4.4, y - Z * 10.4); ctx.moveTo(x + Z * 4.6, y - Z * 16); ctx.quadraticCurveTo(x + Z * 6, y - Z * 13, x + Z * 4.4, y - Z * 10.4); ctx.stroke();
    // shoulders: a guard, its plate, a rim below, a rivet
    for (let side = -1; side <= 1; side += 2) {
      const sx = x + side * Z * 5.3;
      xfill('#4a525c'); xell(sx, y - Z * 15.8, Z * 2.6, Z * 1.9);
      xfill('#6b737c'); xell(sx, y - Z * 16.4, Z * 2, Z * 1.1);
      xfill('#2b3036'); xtri(sx - Z * 2.4, y - Z * 15, sx + Z * 2.4, y - Z * 15, sx + side * Z * .6, y - Z * 13.4);
      xfill('#c8d3dc'); xell(sx + side * Z * 1.1, y - Z * 16.2, Z * .35, Z * .35);
    }
    // the helmet: jaw guard, dome and its highlight, a crest in the paint, the visor slot, the visor and its glow, an antenna
    xfill('#22272d'); xquad(x - Z * 2.4, y - Z * 16.6, x + Z * 2.4, y - Z * 16.6, x + Z * 3.1, y - Z * 19, x - Z * 3.1, y - Z * 19);
    xfill('#2f353c'); xell(x, y - Z * 20.2, Z * 3.7, Z * 3.5);
    xfill('#454c55'); xell(x - f * Z * .9, y - Z * 21.4, Z * 2, Z * 1.4);
    xfill(paint); xtri(x - Z * .7, y - Z * 23.6, x + Z * .7, y - Z * 23.6, x, y - Z * 19.4);
    xfill('#0d0f12'); ctx.fillRect(x - Z * 3 + f * Z * .6, y - Z * 21, Z * 4.8, Z * 1.8);
    xfill('#9ff0d8'); ctx.fillRect(x - Z * 2.6 + f * Z * .8, y - Z * 20.6, Z * 4.2, Z * 1.1);
    ctx.globalAlpha = .3; xell(x + f * Z * .8, y - Z * 20, Z * 3.4, Z * 1.2); ctx.globalAlpha = 1;
    xline(x - f * Z * 2.6, y - Z * 21.6, x - f * Z * 3.4, y - Z * 25.6, Z * .35, '#59616b');
    xfill(((t * 2) | 0) % 2 ? '#ff4d5e' : '#5a2228'); xell(x - f * Z * 3.4, y - Z * 25.8, Z * .5, Z * .5);
    // the arm on the aim: upper arm, elbow, forearm into the blaster, its coil, the barrel, the muzzle
    let dx = k.fx, dy = k.fy; if (k.aim >= 0) { const e = XR.foes[k.aim]; dx = e.x - k.x; dy = e.y - k.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d; }
    const hx = x + f * Z * 4.6, hy = y - Z * 14.4, ex = hx + dx * Z * 3.6, ey = hy + dy * Z * 3.6 * XCAM.sin + Z * 1.6, mx = ex + dx * Z * 4.4, my = ey + dy * Z * 4.4 * XCAM.sin;
    xline(hx, hy, ex, ey, Z * 2.2, '#3a4048');
    xline(ex, ey, mx, my, Z * 2.6, '#4a5560');
    xfill('#59616b'); xell(ex, ey, Z * 1.4, Z * 1.4);
    xline(mx, my, mx + dx * Z * 2.4, my + dy * Z * 2.4 * XCAM.sin, Z * 1.2, '#14161a');
    xfill(paint); xell(mx, my, Z * .9, Z * .9);
    xfill(k.cd > 0 ? '#ffe08a' : '#14161a'); xell(mx + dx * Z * 2.6, my + dy * Z * 2.6 * XCAM.sin, Z * 1.1, Z * 1.1);
  }
  /** A crawler at the dense tier: six legs of two joints each stepping in turn, a plated carapace with a ridge of spines,
   *  mandibles and a cluster of eyes, a vent on its back that breathes. */
  function xcrawlerHi(f, x, y, Z, hit) {
    const R = f.r * Z, fc = f.face;
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1, j = i % 3, ph = Math.sin(f.t * 14 + j * 2.1 + (side > 0 ? 3.1 : 0)) * Z * 1.2;
      const bx = x + side * R * .35, by = y - Z * (2.6 + j * .7), kx = x + side * R * (1.05 + j * .12), ky = by - Z * 1.8 + ph * .4, ex = x + side * R * (1.3 + j * .15), ey = y - Z * .2 + (j - 1) * Z * 1.4 + ph;
      xfill('#2a2e33'); xtri(bx, by - Z * .6, kx, ky, bx, by + Z * .6);
      xfill('#3a3f45'); xtri(kx - Z * .4, ky, kx + Z * .4, ky, ex, ey);
      xfill('#14161a'); xell(ex, ey, Z * .45, Z * .3);
    }
    xfill(hit ? '#ffffff' : '#3e4247'); xell(x, y - Z * 3.4, R * .9, R * .5);
    xfill(hit ? '#ffffff' : '#6b6f74'); xell(x, y - Z * 4.2, R * .85, R * .55);
    xfill(hit ? '#ffffff' : '#8a8f94'); xquad(x - R * .6, y - Z * 4.6, x + R * .6, y - Z * 4.6, x + R * .35, y - Z * 5.6, x - R * .35, y - Z * 5.6);
    xfill(hit ? '#ffffff' : '#555a60'); xquad(x - R * .7, y - Z * 3.9, x + R * .7, y - Z * 3.9, x + R * .6, y - Z * 3.3, x - R * .6, y - Z * 3.3);
    xfill('#2a2e33'); for (let i = -1; i <= 1; i++) xtri(x + i * R * .3 - Z * .5, y - Z * 5.5, x + i * R * .3 + Z * .5, y - Z * 5.5, x + i * R * .3, y - Z * 7.2);
    const hx = x + fc * R * .62;
    xfill('#1d2126'); xtri(hx, y - Z * 3.8, hx + fc * Z * 2.2, y - Z * 3, hx + fc * Z * .6, y - Z * 2.6); xtri(hx, y - Z * 4.6, hx + fc * Z * 2.2, y - Z * 5.2, hx + fc * Z * .6, y - Z * 4.2);
    xfill('#ff4d5e'); xell(hx, y - Z * 4.1, Z * .9, Z * .7); xell(hx - fc * Z * .9, y - Z * 4.8, Z * .5, Z * .4); xell(hx - fc * Z * .9, y - Z * 3.5, Z * .5, Z * .4);
    xfill('#ffd27a'); xell(hx + fc * Z * .2, y - Z * 4.2, Z * .3, Z * .3);
    ctx.globalAlpha = .5 + .5 * Math.sin(f.t * 6); xfill('#ff7a2e'); ctx.fillRect(x - Z * 1.2, y - Z * 5.1, Z * 2.4, Z * .5); ctx.globalAlpha = 1;
  }
  /** A drone at the dense tier: four rotors on crossed arms with motors and lights, a banded hull under a dome, fins,
   *  a housed eye that flashes before it fires, an antenna, and a faint beam to the ground under it. */
  function xdroneHi(f, x, y, Z, hit, t) {
    const hy = y - Z * 11 + Math.sin(f.t * 5) * Z * 1.2, R = f.r * Z, sp = f.t * 40;
    ctx.globalAlpha = .12; xfill('#ff4d5e'); xquad(x - Z, hy + Z * 1.6, x + Z, hy + Z * 1.6, x + R * .8, y, x - R * .8, y); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a2e33'; ctx.lineWidth = Math.max(.6, Z * .7); ctx.beginPath(); ctx.moveTo(x - R * 1.25, hy - Z * 2.6); ctx.lineTo(x + R * 1.25, hy + Z * .6); ctx.moveTo(x + R * 1.25, hy - Z * 2.6); ctx.lineTo(x - R * 1.25, hy + Z * .6); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const rx = x + (i & 1 ? 1 : -1) * R * 1.25, ry = hy + (i < 2 ? -Z * 2.6 : Z * .6);
      xfill('#1d2126'); xell(rx, ry + Z * .4, Z, Z * .6);
      ctx.globalAlpha = .45; xfill('#c8d3dc'); xell(rx, ry, R * .55 * Math.abs(Math.cos(sp + i)) + Z * .4, Z * .45); ctx.globalAlpha = 1;
      xfill(i < 2 ? '#ff4d5e' : '#9ff0d8'); ctx.fillRect(rx - Z * .25, ry - Z * .25, Z * .5, Z * .5);
    }
    xfill(hit ? '#ffffff' : '#2e3a44'); xell(x, hy + Z * .6, R * .95, R * .45);
    xfill(hit ? '#ffffff' : '#3c4a56'); xquad(x - R * 1.05, hy, x + R * 1.05, hy, x + R * .75, hy - Z * 2, x - R * .75, hy - Z * 2);
    xfill(hit ? '#ffffff' : '#56687a'); xell(x, hy - Z * 2.2, R * .7, R * .35);
    xfill('#7a8c9c'); xell(x - Z * .8, hy - Z * 2.6, R * .3, R * .12);
    xfill('#2a2e33'); xtri(x - R * .9, hy - Z * .6, x - R * 1.4, hy + Z * 1.6, x - R * .6, hy + Z * .4); xtri(x + R * .9, hy - Z * .6, x + R * 1.4, hy + Z * 1.6, x + R * .6, hy + Z * .4);
    xfill('#14161a'); xell(x, hy + Z, Z * 1.7, Z * 1.2);
    xfill(f.cd < .35 && ((t * 16) | 0) % 2 ? '#ffe08a' : '#ff4d5e'); xell(x, hy + Z, Z * 1.1, Z * .8);
    xfill('#ffffff'); xell(x - Z * .3, hy + Z * .8, Z * .3, Z * .25);
    xline(x + Z, hy - Z * 2.4, x + Z * 1.6, hy - Z * 4.6, Z * .3, '#59616b'); xfill('#9ff0d8'); xell(x + Z * 1.6, hy - Z * 4.7, Z * .4, Z * .4);
  }
  /** A brute at the dense tier: jointed legs with bolted knees, a hip plate, a torso with chest plates over a furnace
   *  behind a grille, spiked shoulders, arms to heavy fists, a slit visor, horns, and two stacks that smoke. */
  function xbruteHi(f, x, y, Z, hit) {
    const sway = Math.sin(f.t * 5) * Z, R = f.r * Z, c1 = hit ? '#ffffff' : '#7a4a36', c2 = hit ? '#ffffff' : '#9a5e42', heat = .6 + .4 * Math.sin(f.t * 8), fc = f.face;
    for (let side = -1; side <= 1; side += 2) {
      const lx = x + side * R * .55, s = side * sway;
      xfill('#2a2e33'); xquad(lx - Z * 1.8, y - Z * 8 + s, lx + Z * 1.8, y - Z * 8 + s, lx + Z * 1.6, y - Z * 4 + s * .5, lx - Z * 1.6, y - Z * 4 + s * .5);
      xfill('#3a3f45'); xquad(lx - Z * 1.6, y - Z * 4 + s * .5, lx + Z * 1.6, y - Z * 4 + s * .5, lx + Z * 1.9, y - Z, lx - Z * 1.9, y - Z);
      xfill('#1d2126'); xquad(lx - Z * 2.4, y - Z * 1.2, lx + Z * 2.4, y - Z * 1.2, lx + Z * 2.8, y + Z * .4, lx - Z * 2.8, y + Z * .4);
      xfill('#8a8f94'); xell(lx, y - Z * 4 + s * .5, Z * .8, Z * .8);
    }
    xfill(hit ? '#ffffff' : '#4a2c22'); xquad(x - R * .95, y - Z * 8.5, x + R * .95, y - Z * 8.5, x + R * .9, y - Z * 6.8, x - R * .9, y - Z * 6.8);
    xfill(c1); xquad(x - R, y - Z * 7, x + R, y - Z * 7, x + R * .8, y - Z * 17, x - R * .8, y - Z * 17);
    xfill(c2); xquad(x - R * .8, y - Z * 17, x + R * .8, y - Z * 17, x + R * .5, y - Z * 20, x - R * .5, y - Z * 20);
    xfill(hit ? '#ffffff' : '#5e3829'); xquad(x - R * .85, y - Z * 16.6, x - Z * .4, y - Z * 16.6, x - Z * .4, y - Z * 12, x - R * .9, y - Z * 12); xquad(x + Z * .4, y - Z * 16.6, x + R * .85, y - Z * 16.6, x + R * .9, y - Z * 12, x + Z * .4, y - Z * 12);
    xfill('#1a1311'); ctx.fillRect(x - Z * 3, y - Z * 11.4, Z * 6, Z * 3.6);
    ctx.globalAlpha = heat; xfill('#ff6a2a'); ctx.fillRect(x - Z * 2.6, y - Z * 11, Z * 5.2, Z * 2.8); ctx.globalAlpha = 1;
    xfill('#2a2e33'); for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * Z * 1.5 - Z * .3, y - Z * 11.4, Z * .6, Z * 3.6);
    for (let side = -1; side <= 1; side += 2) {
      const sx = x + side * R * 1.05, arm = side * sway * .6;
      xfill(hit ? '#ffffff' : '#4a525c'); xquad(sx - Z * 1.4, y - Z * 15, sx + Z * 1.4, y - Z * 15, sx + Z * 1.6 + arm, y - Z * 8, sx - Z * 1.6 + arm, y - Z * 8);
      xfill('#2a2e33'); xell(sx + arm, y - Z * 7.4, Z * 2.2, Z * 1.9);
      xfill(c2); xell(sx, y - Z * 16, Z * 2.8, Z * 2);
      xfill('#c8d3dc'); xtri(sx - Z * .8, y - Z * 17.4, sx + Z * .8, y - Z * 17.4, sx + side * Z * 1.2, y - Z * 20.4);
    }
    xfill('#14161a'); ctx.fillRect(x - Z * 3 + fc * Z * 1.6, y - Z * 16.2, Z * 6, Z * 1.8);
    xfill('#ffe08a'); ctx.fillRect(x - Z * 2.5 + fc * Z * 2, y - Z * 15.8, Z * 5, Z * 1.1);
    xfill('#d8c8a8'); xtri(x - R * .5, y - Z * 19.4, x - R * .25, y - Z * 19.6, x - R * .75, y - Z * 22.6); xtri(x + R * .5, y - Z * 19.4, x + R * .25, y - Z * 19.6, x + R * .75, y - Z * 22.6);
    xfill('#2a2e33'); ctx.fillRect(x - fc * R * .6 - Z * .8, y - Z * 21.6, Z * 1.6, Z * 3); ctx.fillRect(x - fc * R * .2 - Z * .8, y - Z * 21, Z * 1.6, Z * 2.4);
    const pf = (f.t * .8) % 1, pg = (pf + .5) % 1;
    ctx.globalAlpha = .35 * (1 - pf); xfill('#8a8f94'); xell(x - fc * R * .6, y - Z * (22.4 + pf * 5), Z * (1 + pf * 1.5), Z * (1 + pf * 1.5));
    ctx.globalAlpha = .35 * (1 - pg); xell(x - fc * R * .2, y - Z * (21.8 + pg * 5), Z * (1 + pg * 1.2), Z * (1 + pg * 1.2)); ctx.globalAlpha = 1;
  }
  /** A prop at the dense tier, about twice the faces of the plain one. Returns false for a kind it leaves to the plain. */
  function xpropHi(p, t) {
    const Z = XCAM.zoom, v = p.seed;
    if (p.kind === 'rock') {
      const r = p.w / 2; xq(p.x + r, p.y + r, 0); const bx = XP.x, by = XP.y;
      xfill('rgba(0,0,0,.35)'); xell(bx, by + Z, r * Z * 1.1, r * Z * .58);
      xq(p.x + r, p.y + r, p.h); const tx = XP.x, ty = XP.y;
      xfill('#2f2b26'); xquad(bx - r * Z * 1.02, by + Z * .2, bx - r * Z * .7, by - r * Z * .2, bx, by - r * Z * .1, bx - r * Z * .2, by + r * Z * .5);
      xfill('#3a352f'); xquad(bx - r * Z, by, tx - r * Z * .55, ty + r * Z * .3, tx, ty - r * Z * .1, bx, by + r * Z * .45);
      xfill('#4a443c'); xquad(bx, by + r * Z * .45, tx, ty - r * Z * .1, tx + r * Z * .6, ty + r * Z * .25, bx + r * Z, by);
      xfill('#433d36'); xtri(bx + r * Z * .35, by + r * Z * .3, tx + r * Z * .6, ty + r * Z * .25, bx + r * Z * 1.02, by + Z * .2);
      xfill('#625a50'); xtri(tx - r * Z * .55, ty + r * Z * .3, tx, ty - r * Z * .45, tx + r * Z * .6, ty + r * Z * .25);
      xfill('#776e62'); xtri(tx - r * Z * .2, ty - r * Z * .1, tx, ty - r * Z * .45, tx + r * Z * .25, ty);
      xline(tx - r * Z * .1, ty + r * Z * .1, bx + r * Z * .15, by + r * Z * .25, Z * .3, '#1f1c19');
      xfill(v & 4 ? '#5b4a2c' : '#4a4a3a'); xell(bx - r * Z * .4, by - r * Z * .05, r * Z * .18, r * Z * .1);
      xfill('#4d463e'); xtri(bx + r * Z * 1.05, by + Z * .6, bx + r * Z * 1.35, by - Z * .4, bx + r * Z * 1.55, by + Z * .6);
      return true;
    }
    if (p.kind === 'ruin') {
      xbox(p.x, p.y, p.w, p.d, p.h, '#6f6a62', '#57524b', '#48443e');
      for (let i = 0; i < 3; i++) {   // the broken top: teeth of wall still standing
        const u = p.x + p.w * (.08 + i * .32), hh = p.h + 2 + ((v >> (i * 2)) & 3) * 2.5;
        xq(u, p.y + p.d, p.h); const ax = XP.x, ay = XP.y; xq(u + p.w * .22, p.y + p.d, p.h); const bx = XP.x, by = XP.y; xq(u + p.w * (.06 + (i & 1) * .1), p.y + p.d, hh);
        xfill(i & 1 ? '#625d55' : '#57524b'); xtri(ax, ay, bx, by, XP.x, XP.y);
      }
      xfill('#4a463f'); for (let h = .3; h < .95; h += .3) { xq(p.x, p.y + p.d, p.h * h); ctx.fillRect(XP.x, XP.y, p.w * Z * (1 + p.h * h * XCAM.lean), Z * .35); }   // courses of block
      for (let i = 0; i < 2; i++) {   // two windows, one with a fire still burning inside
        xq(p.x + p.w * (.18 + i * .44), p.y + p.d, p.h * .62); const wx = XP.x, wy = XP.y, ww = p.w * .2 * Z, wh = p.h * .24 * Z * XCAM.cos;
        xfill('#1d1a17'); ctx.fillRect(wx, wy, ww, wh);
        if ((v >> 5 & 1) === i) { ctx.globalAlpha = .55 + .35 * Math.sin(t * 7 + i); xfill('#ff7a2e'); ctx.fillRect(wx + ww * .15, wy + wh * .45, ww * .7, wh * .5); ctx.globalAlpha = 1; }
        xfill('#7a756c'); ctx.fillRect(wx - Z * .4, wy + wh, ww + Z * .8, Z * .5);
      }
      xq(p.x + p.w * .7, p.y + p.d * .4, p.h); const rx = XP.x, ry = XP.y; xq(p.x + p.w * .76, p.y + p.d * .4, p.h + 9); xline(rx, ry, XP.x, XP.y, Z * .5, '#7a4a2c');
      xq(p.x + p.w * .3, p.y + p.d * .3, p.h); const sx = XP.x, sy = XP.y; xq(p.x + p.w * .22, p.y + p.d * .3, p.h + 6); xline(sx, sy, XP.x, XP.y, Z * .4, '#6a3e24');
      xq(p.x + p.w * .1, p.y + p.d, 0); const gx = XP.x, gy = XP.y;
      xfill('#4d463e'); xtri(gx - Z * 2, gy + Z * .4, gx, gy - Z * 1.6, gx + Z * 2.2, gy + Z * .4);
      xq(p.x + p.w * .85, p.y + p.d, 0); xfill('#5b544a'); xtri(XP.x - Z * 1.6, XP.y + Z * .4, XP.x, XP.y - Z * 1.2, XP.x + Z * 1.8, XP.y + Z * .4);
      ctx.globalAlpha = .3; xfill('#14110e'); xq(p.x + p.w * .5, p.y + p.d, p.h * .3); xell(XP.x, XP.y, p.w * Z * .22, p.h * Z * .16); ctx.globalAlpha = 1;
      return true;
    }
    if (p.kind === 'pylon') {
      xbox(p.x - 1, p.y - 1, p.w + 2, p.d + 2, 3, '#4a5560', '#3a434c', '#2e353c');
      xbox(p.x + p.w * .2, p.y + p.d * .2, p.w * .6, p.d * .6, p.h, '#5d6a75', '#4a5560', '#3a434c');
      xq(p.x - 1, p.y + p.d + 1, 3); const ax = XP.x, ay = XP.y; xq(p.x + p.w + 1, p.y + p.d + 1, 3); const bx = XP.x, by = XP.y; xq(p.x + p.w * .5, p.y + p.d, p.h * .55);
      ctx.strokeStyle = '#2e353c'; ctx.lineWidth = Math.max(.6, Z * .45); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(XP.x, XP.y); ctx.lineTo(bx, by); ctx.stroke();
      xq(p.x + p.w * .5, p.y + p.d * .5, p.h - 2); const cx = XP.x, cy = XP.y;
      xfill('#2e353c'); ctx.fillRect(cx - p.w * Z * .9, cy - Z * .5, p.w * Z * 1.8, Z);
      xfill('#b8c4cc'); xell(cx - p.w * Z * .85, cy - Z * .9, Z * .7, Z * .9); xell(cx + p.w * Z * .85, cy - Z * .9, Z * .7, Z * .9);
      xq(p.x + p.w * .2, p.y + p.d * .8, p.h * .3); xfill('#c8932a'); ctx.fillRect(XP.x, XP.y, p.w * .6 * Z, Z * .7); xq(p.x + p.w * .2, p.y + p.d * .8, p.h * .4); xfill('#14161a'); ctx.fillRect(XP.x, XP.y, p.w * .6 * Z, Z * .7);
      xline(cx + p.w * Z * .85, cy - Z * .4, cx + p.w * Z * 3, cy + Z * 6, Z * .3, '#1d2126');
      const on = ((t * 1.5 + (v & 3)) | 0) % 2; xq(p.x + p.w / 2, p.y + p.d / 2, p.h + 2);
      if (on) { ctx.globalAlpha = .3; xfill('#ff4d5e'); xell(XP.x, XP.y, Z * 3, Z * 3); ctx.globalAlpha = 1; }
      xfill(on ? '#ff4d5e' : '#5a2228'); xell(XP.x, XP.y, Z * 1.4, Z * 1.4);
      return true;
    }
    if (p.kind === 'crate') {
      if (p.open) {
        xbox(p.x, p.y, p.w, p.d, 2, '#3a2c1a', '#2e2315', '#261d12');
        xq(p.x - 2, p.y + p.d, 0); xfill('#7a5e32'); xtri(XP.x, XP.y, XP.x + p.w * Z * .5, XP.y - Z * .8, XP.x + p.w * Z * .2, XP.y + Z * .8);
        xq(p.x + p.w + 1, p.y + p.d * .3, 0); xfill('#654d29'); xtri(XP.x, XP.y, XP.x + p.w * Z * .4, XP.y + Z, XP.x - Z, XP.y + Z * .6);
        ctx.globalAlpha = .4 + .4 * Math.sin(t * 5); xfill('#e9b949'); xq(p.x + p.w / 2, p.y + p.d / 2, 2); xell(XP.x, XP.y, Z, Z * .6); ctx.globalAlpha = 1;
        return true;
      }
      xbox(p.x, p.y, p.w, p.d, p.h, '#9a7a44', '#7a5e32', '#654d29');
      xq(p.x, p.y + p.d, p.h); const fx = XP.x, fy = XP.y, fw = p.w * Z * (1 + p.h * XCAM.lean), fh = p.h * Z * XCAM.cos;
      xfill('#5e4626'); ctx.fillRect(fx, fy + fh * .33, fw, Z * .3); ctx.fillRect(fx, fy + fh * .66, fw, Z * .3);   // the planks
      xfill('#c8932a'); ctx.fillRect(fx + fw * .18, fy, fw * .1, fh); ctx.fillRect(fx + fw * .72, fy, fw * .1, fh);   // the straps
      xfill('#3a3f45'); ctx.fillRect(fx, fy, Z * .9, Z * .9); ctx.fillRect(fx + fw - Z * .9, fy, Z * .9, Z * .9); ctx.fillRect(fx, fy + fh - Z * .9, Z * .9, Z * .9); ctx.fillRect(fx + fw - Z * .9, fy + fh - Z * .9, Z * .9, Z * .9);   // the corner irons
      xq(p.x, p.y, p.h + .8); const lx = XP.x, ly = XP.y; xq(p.x + p.w, p.y + p.d * .25, p.h + .8); xfill('#ab8a52'); ctx.fillRect(lx, ly, XP.x - lx, XP.y - ly);   // the lid's lip
      xfill('#1d1a17'); xtri(fx + fw * .42, fy + fh * .62, fx + fw * .5, fy + fh * .4, fx + fw * .58, fy + fh * .62); ctx.fillRect(fx + fw * .47, fy + fh * .66, fw * .06, fh * .1);   // a stencilled warning
      return true;
    }
    return false;
  }
  /** A tower's dense detail: arrow slits, a banner in the Keeper's paint, a band of stone under the roof. */
  function xtowerHi(x, y, w, h, i, dim) {
    const Z = XCAM.zoom;
    xfill(dim ? '#2e2b27' : '#4a453e'); xq(x, y + w, h - 2); ctx.fillRect(XP.x, XP.y, w * Z * (1 + h * XCAM.lean), Z * .6);
    xfill('#14110e'); for (let k = 0; k < 2; k++) { xq(x + w * (.3 + k * .3), y + w, h * .55); ctx.fillRect(XP.x, XP.y, Z * .8, Z * 3); }
    xq(x + w * .5, y + w * .5, h + 2); const px = XP.x, py = XP.y; xline(px, py, px, py - Z * 9, Z * .4, '#2b2825');
    xfill(dim ? '#3a4a46' : XPAINT.c); const wave = Math.sin(XR.k.step * .3 + i) * Z * .6; xquad(px, py - Z * 9, px + Z * 4.5, py - Z * 8 + wave, px + Z * 4.5, py - Z * 5.5 + wave, px, py - Z * 6.5);
  }
  const XPAINT = { c: '#3DBFA6', slug: '' };
  /** The HUD's words and the minimap: rebuilt only when what they show changes (never each frame). */
  function xhudText() {
    const W = XR;
    if (XPAINT.slug !== S.play.paint) { XPAINT.slug = S.play.paint; XPAINT.c = paintOf(S.play.paint).colour; }
    if (W.scrap !== XTXT.scrapN) { XTXT.scrapN = W.scrap; XTXT.scrap = fill(BX.scrap, { n: W.scrap }); }
    if (W.score !== XTXT.scoreN) { XTXT.scoreN = W.score; XTXT.score = fill(BX.score, { n: W.score }); }
    const seal = XE.nextSeal(CAS.pieces, RULES), key = seal ? seal.index * 1000 + seal.need : -1;
    if (key !== XTXT.sealN) { XTXT.sealN = key; XTXT.seal = seal ? fill(BX.sealed, { name: BX.regions[RX.regions[seal.index].slug], n: seal.need }) : BX.sealed_all; }
    const mk = `${W.map.seed}/${W.run}`; if (mk !== XMKEY) { XMKEY = mk; XMINI = xminiBake(W.map); }
    const pk = XE.partnerCode(W.p.b, RULES) + '/' + Object.values(W.p.b.lv).join('.') + '/' + XW; if (pk !== XPC.key) xpartnerLines(W.p.b, pk);
  }
  /** The partner card's words: for each slot, the part's name and its perk, strength and weakness, wrapped to the card's width. */
  function xpartnerLines(b, key) {
    const P = RX.partner, B = BX.parts, per = Math.max(12, Math.floor((xcardW() - 10) / (RX.hud.card_px * .74)));
    const wrap = (s, out) => { let line = ''; for (const w of s.split(' ')) { if (line && (line + ' ' + w).length > per) { out.push(line); line = '  ' + w; } else line = line ? line + ' ' + w : w; } if (line) out.push(line); };
    XPC.slot.length = 0; XPC.cols.length = 0;
    P.slots.forEach((slot, i) => {
      const id = b[slot], w = B[id], out = [];
      out.push(w.name + (b.lv[id] ? ' +' + b.lv[id] : '')); wrap('+ ' + w.perk, out); wrap('+ ' + w.strength, out); XPC.neg[i] = out.length; wrap('- ' + w.weakness, out);
      XPC.lines[i] = out.slice(0, RX.hud.card_lines); XPC.slot.push(id); XPC.cols.push(P.parts[slot][id].colour);
    });
    XPC.mode[0] = BX.bot_follow; XPC.mode[1] = BX.bot_hunt; XPC.mode[2] = BX.bot_down; XPC.key = key;
  }
  /** The partner card's width: the room left of the minimap, within the rules' bounds. */
  function xcardW() { return clamp(XW - (XMINI ? XMINI.width : 90) - 30, RX.hud.card_w[0], RX.hud.card_w[1]); }
  /** The partner card, under the Keeper's bars: its four parts (colour and level), its order, its hull and power, and one part's perk, strength and weakness at a time. */
  function xcard(W, x0, y0, t) {
    const p = W.p, cw = xcardW(), H = RX.hud, slot = ((t / RX.partner.card_line_s) | 0) % 4, L = XPC.lines[slot], lh = H.card_px + 2;
    xfill('rgba(12,12,14,.7)'); ctx.fillRect(x0 - 4, y0 - 4, cw + 8, 26 + L.length * lh);
    for (let i = 0; i < 4; i++) {
      xfill(XPC.cols[i]); ctx.globalAlpha = i === slot ? 1 : .55; ctx.fillRect(x0 + i * 12, y0, 9, 9); ctx.globalAlpha = 1;
      const n = p.b.lv[XPC.slot[i]] || 0; xfill('#e8ecef'); for (let j = 0; j < n; j++) ctx.fillRect(x0 + i * 12 + j * 3, y0 + 11, 2, 2);
    }
    ctx.font = '700 9px Silkscreen, ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    xfill(!p.up ? '#ffb347' : p.mode ? '#ff4d5e' : '#9ff0d8'); ctx.fillText(XPC.mode[p.up ? p.mode : 2], x0 + cw, y0);
    const bw = (cw - 54) / 2, bx = x0 + 52;
    xfill('#1b2a22'); ctx.fillRect(bx, y0 + 12, bw - 2, 4); xfill('#7cf29a'); ctx.fillRect(bx, y0 + 12, (bw - 2) * p.hp / p.max, 4);
    xfill('#1b2a33'); ctx.fillRect(bx + bw, y0 + 12, bw - 2, 4); xfill('#8fd3ff'); ctx.fillRect(bx + bw, y0 + 12, (bw - 2) * p.power / p.pmax, 4);
    ctx.font = XPC.font; ctx.textAlign = 'left';
    for (let i = 0; i < L.length; i++) { xfill(i === 0 ? '#e8ecef' : i >= XPC.neg[slot] ? '#ff9a8a' : '#c8d3dc'); ctx.fillText(L[i], x0, y0 + 20 + i * lh); }
  }
  /** The minimap's ground, painted once per region: the road, the solid things, the gate. */
  function xminiBake(M) {
    const c = document.createElement('canvas'), s = RX.hud.mini_px_per_tile; c.width = M.cols * s; c.height = M.rows * s;
    const g = c.getContext('2d'); g.fillStyle = 'rgba(20,18,16,.82)'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#46423c'; g.fillRect(M.roadC0 * s, 0, (M.roadC1 - M.roadC0 + 1) * s, c.height);
    for (const p of M.props) { if (!p.solid && p.kind !== 'crack') continue; g.fillStyle = p.kind === 'crack' ? '#ff6a2a' : p.kind === 'crate' ? '#c8932a' : '#6f6a62'; g.fillRect(p.x / M.tile * s, p.y / M.tile * s, Math.max(1, p.w / M.tile * s), Math.max(1, p.d / M.tile * s)); }
    return c;
  }
  function xhud(t) {
    const W = XR, k = W.k, pad = 10, bw = Math.min(150, XW * .38);
    // hull and power, top left
    xfill('rgba(12,12,14,.7)'); ctx.fillRect(pad - 4, pad - 4, bw + 8, 30);
    xfill('#3a1d22'); ctx.fillRect(pad, pad, bw, 9); xfill('#ff4d5e'); ctx.fillRect(pad, pad, bw * k.hp / k.max, 9);
    xfill('#14161a'); for (let i = 1; i < k.max; i++) ctx.fillRect(pad + bw * i / k.max - .5, pad, 1, 9);
    xfill('#1b2a33'); ctx.fillRect(pad, pad + 13, bw, 7); xfill(k.power >= RX.keeper.dash_power ? '#8fd3ff' : '#4a7a96'); ctx.fillRect(pad, pad + 13, bw * k.power / k.pmax, 7);
    ctx.font = '700 9px Silkscreen, ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    xfill('#e8ecef'); ctx.fillText(XTXT.scrap, pad, pad + 30); ctx.fillText(XTXT.score, pad, pad + 42);
    // the minimap, top right: the region, the Keeper, the machines that are awake
    if (XMINI) {
      const s = RX.hud.mini_px_per_tile, mw = XMINI.width, mh = Math.min(XMINI.height, RX.hud.mini_h), M = W.map;
      const top = clamp(k.y / M.tile * s - mh / 2, 0, XMINI.height - mh), mx = XW - mw - pad, my = pad + 34;
      ctx.drawImage(XMINI, 0, top, mw, mh, mx, my, mw, mh);
      const scan = W.p.up && W.p.s.scan;   // a laser scanner shows the machines still asleep, dimmer
      for (let i = 0; i < W.foes.length; i++) { const f = W.foes[i]; if (!f.on || (!f.wake && !scan)) continue; const fy = f.y / M.tile * s - top; if (fy < 0 || fy > mh) continue; xfill(f.wake ? '#ff4d5e' : '#8a5a3a'); ctx.fillRect(mx + f.x / M.tile * s - 1, my + fy - 1, 2, 2); }
      xfill('#b9a7ff'); ctx.fillRect(mx + W.p.x / M.tile * s - 1, my + W.p.y / M.tile * s - top - 1, 2, 2);
      xfill('#9ff0d8'); ctx.fillRect(mx + k.x / M.tile * s - 1.5, my + k.y / M.tile * s - top - 1.5, 3, 3);
      ctx.strokeStyle = 'rgba(232,236,239,.35)'; ctx.lineWidth = 1; ctx.strokeRect(mx - .5, my - .5, mw + 1, mh + 1);
    }
    if (XPC.key) xcard(W, pad, pad + 56, t);
    ctx.textAlign = 'center';
    if (W.sealed && (W.bump > 0 || k.y < W.map.north + W.map.tile * 6)) { xfill('#e8ecef'); ctx.fillText(XTXT.seal, XW / 2, XH * .22); }
    if (XTXT.toastT > 0) { ctx.globalAlpha = Math.min(1, XTXT.toastT); xfill('rgba(12,12,14,.7)'); ctx.fillRect(XW * .1, XH * .3 - 4, XW * .8, 18); xfill('#e8ecef'); ctx.fillText(XTXT.toast, XW / 2, XH * .3); ctx.globalAlpha = 1; }
  }
