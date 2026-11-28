  // ══════════════════════ the explorer out the gate (FW11, design D66 rework 2 and D85+) ══════════════════════
  // The mid-angle view: the ground is an axis-aligned grid running straight up the screen, tilted about 62° down, so
  // a road reads as ground and runs north; a building shows its roof, its front wall and the side facing the middle;
  // the Keeper and the machines stand upright. The rules of a run live in src/frontier.js (FieldworksFrontier), the
  // numbers in rules.frontier and every word in bank.explore. This file is the screen: mounting, input, drawing.
  // The canvas is drawn at its CSS size times a whole-number render scale (1 or 2), with no image asset.
  // Nothing here reads or writes the evidence; the castle is read to draw it and to know which regions are open.
  const XE = FieldworksFrontier, RX = RULES.frontier, BX = BANK.frontier;
  let XR = null, XRUN = 0, XRS = 1, XW = 1, XH = 1;
  const XCAM = XE.camOf(RULES), XP = { x: 0, y: 0 }, XQ = { x: 0, y: 0 }, XA = { x: 0, y: 0 }, XB = { x: 0, y: 0 };
  const XIN = { ax: 0, ay: 0, fire: false, dash: false }, XPR = { dash: false };
  const XSORT = new Int32Array(RX.foes.cap + 2), XSY = new Float32Array(RX.foes.cap + 2);   // the upright actors, drawn in depth order with the props
  const XG = ['#2b2723', '#312c27', '#28241f', '#36302a'], XGL = ['#332e29', '#39332d', '#2f2a25', '#3e3730'];   // ground: ash, grit, scorched plate, gravel
  const XTXT = { scrap: '', score: '', seal: '', sealN: -1, scrapN: -1, scoreN: -1, toast: '', toastT: 0 };
  let XMINI = null, XMKEY = '';

  /** The screen's markup: one canvas that is the scene and the controls, and a way home. */
  function exploreShell() {
    return `<div class="stage xstage" id="stage"><canvas class="game xcv" id="game" role="application" aria-label="${esc(BX.label)}"></canvas><button class="xback" data-go="castle" aria-label="${esc(BX.back)}">${icon('fort')}</button></div>`;
  }
  /** Mount: a run in the region asked for (the first by default), the canvas sized, the overlay's buttons on it. */
  function mountExplore(index) {
    cv = document.getElementById('game'); if (!cv) return; ctx = cv.getContext('2d'); hudEls = null;
    const open = XE.regionsOpen(CAS.pieces, RULES), i = clamp(index == null ? (XR ? XR.index : 0) : index, 0, open - 1);
    if (!XR || XR.over || XR.index !== i) XR = XE.newRun(i, XRUN++, hearts(), i + 1 >= open, RULES);
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
    XRS = clamp(Math.round(globalThis.devicePixelRatio || 1), 1, RX.render.scale_max);
    cv.width = XW * XRS; cv.height = XH * XRS; cv.style.width = XW + 'px'; cv.style.height = XH + 'px';
    XE.camFit(XCAM, XW, XH);
    if (PAD.on && PAD.layout === 'overlay') { padSize(); padLayout(PAD.names, 'overlay'); }
  }
  /** Leave the frontier. Returns the line that says what the run found, for the castle's ticker (empty when nothing). */
  function endExplore() {
    if (!XR) return '';
    const r = XR; XR = null; PAD.on = false;
    return r.score > 0 || r.scrap > 0 ? fill(BX.home, { scrap: r.scrap, score: r.score }) : '';
  }
  // ── one frame ──
  function updateExplore(dt) {
    const s = PAD.stick, k = XR.k;
    XIN.ax = s.id >= 0 ? s.ax : (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    XIN.ay = s.id >= 0 ? s.ay : (keys.down ? 1 : 0) - (keys.jump ? 1 : 0);
    XIN.fire = padHeld('fire') || keys.fire;
    XPR.dash = padTake('dash') || tap.dash; tap.dash = false; tap.jump = false; tap.fire = false;
    XE.stepRun(XR, XIN, XPR, dt, RULES);
    XE.camFollow(XCAM, k.x, k.y, dt, XR.map, RULES);
    if (XTXT.toastT > 0) XTXT.toastT -= dt;
    if (XR.over) exploreOver();
  }
  function exploreOver() {
    const r = XR, open = XE.regionsOpen(CAS.pieces, RULES);
    if (!r.won) { xsay(BX.down); XR = XE.newRun(0, XRUN++, hearts(), open <= 1, RULES); XCAM.x = XR.k.x; XCAM.y = XR.k.y; XMKEY = ''; return; }
    if (r.exit < 0 && r.index === 0) { const msg = endExplore(); S.screen = 'castle'; render(); if (msg) ticker(msg, ''); return; }
    const next = clamp(r.index + r.exit, 0, open - 1), keep = r.k.hp;
    XR = XE.newRun(next, XRUN++, hearts(), next + 1 >= open, RULES); XR.k.hp = Math.max(1, Math.min(keep, XR.k.max)); XR.score = r.score; XR.scrap = r.scrap; XR.kills = r.kills;
    if (r.exit < 0) { XR.k.y = XR.map.north + XR.map.tile * 2; }   // walked back south: arrive at the north edge of the region before
    XCAM.x = XR.k.x; XCAM.y = XR.k.y; XMKEY = '';
    xsay(fill(BX.next, { name: BX.regions[XR.map.slug] }));
  }

  // ── drawing: small helpers that make nothing ──
  function xq(x, y, z) { return XE.project(XCAM, x, y, z, XP); }
  function xfill(c) { ctx.fillStyle = c; }
  function xquad(ax, ay, bx, by, cx, cy, dx, dy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill(); }
  function xtri(ax, ay, bx, by, cx, cy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }
  function xell(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, 6.2832); ctx.fill(); }
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
        const g = M.ground[r * M.cols + c], road = c >= M.roadC0 && c <= M.roadC1;
        xfill(road ? (c === M.roadC0 || c === M.roadC1 ? '#3d3a35' : '#46423c') : XG[g]); ctx.fillRect(x0, y0, XP.x - x0 + .6, y1 - y0 + .6);
        if (!road && ((r * 7 + c * 13) & 3) === 0) { xfill(XGL[g]); ctx.fillRect(x0 + (XP.x - x0) * .2, y0 + (y1 - y0) * .3, (XP.x - x0) * .35, (y1 - y0) * .25); }
        if (road && c === M.roadC0 + 1 && (r & 1) === 0) { xfill('#8a6a2c'); ctx.fillRect(x0 + (XP.x - x0) * .46, y0 + (y1 - y0) * .1, (XP.x - x0) * .08, (y1 - y0) * .55); }
        if (road) { xfill('#2f2c28'); ctx.fillRect(x0, y0, XP.x - x0, Math.max(.6, (y1 - y0) * .05)); }
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
    for (let i = 0; i < W.fx.length; i++) { const e = W.fx[i]; if (e.t <= 0) continue; xq(e.x, e.y, e.z); xfill(e.kind === 5 ? '#e9b949' : e.kind === 2 ? '#9ff0d8' : e.kind === 1 ? (i & 1 ? '#ff9a3c' : '#ffe08a') : '#ffffff'); const rr = (e.kind === 2 ? 5 : 1.4) * Z * Math.min(1, e.t * 4); ctx.globalAlpha = e.kind === 2 ? .35 : 1; xell(XP.x, XP.y, rr, e.kind === 2 ? rr * .5 : rr); ctx.globalAlpha = 1; }
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
      for (let k = 0; k < 3; k++) { const ph = (t * .7 + k / 3 + (p.seed & 7) / 7) % 1; xq(p.x + p.w * (.3 + .2 * k), p.y + p.d / 2, ph * 26); ctx.globalAlpha = 1 - ph; xfill(k & 1 ? '#ffd27a' : '#ff9a3c'); ctx.fillRect(XP.x, XP.y, Z * .6, Z * .6); }
      ctx.globalAlpha = 1;
    } else if (p.kind === 'debris') {
      xq(p.x, p.y, 0); const ax = XP.x, ay = XP.y; xq(p.x + p.w, p.y + p.d, 0);
      xfill(p.seed & 1 ? '#4a5560' : '#5b4a3a'); xtri(ax, XP.y, (ax + XP.x) / 2, ay, XP.x, XP.y - (XP.y - ay) * .3);
      xfill('#2a2420'); ctx.fillRect(ax + (XP.x - ax) * .3, XP.y - Z * .4, (XP.x - ax) * .5, Z * .4);
    } else if (p.kind === 'rubble') {
      const n = 2 + (p.seed & 3);
      for (let k = 0; k < n; k++) { const ox = ((p.seed >> (k * 3)) & 7) / 7 * p.w, oy = ((p.seed >> (k * 3 + 9)) & 7) / 7 * p.w * .6, s = p.w * (.2 + ((p.seed >> k) & 3) * .08);
        xq(p.x + ox, p.y + oy, 0); xfill('#4d463e'); xtri(XP.x - s * Z, XP.y, XP.x, XP.y - s * Z * .9, XP.x + s * Z * .8, XP.y); xfill('#615950'); xtri(XP.x - s * Z * .3, XP.y - s * Z * .2, XP.x, XP.y - s * Z * .9, XP.x + s * Z * .5, XP.y - s * Z * .15); }
    }
  }
  function xprop(p, t) {
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
    if (i < 0) { xkeeper(t); return; }
    const f = XR.foes[i], Z = XCAM.zoom; xq(f.x, f.y, 0); const x = XP.x, y = XP.y, hit = f.hit > 0 && !CALM;
    xfill('rgba(0,0,0,.38)'); xell(x, y, f.r * Z * 1.1, f.r * Z * .5);
    if (f.type === 'crawler') {
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
  /** The castle from above at the first region's south end: a wall across with a gate on the road, towers at its ends. */
  function xcastle(M, t) {
    const T = M.tile, y = M.gate.y, w = M.cols * T, gx0 = M.roadC0 * T, gx1 = (M.roadC1 + 1) * T;
    const n = CAS.count, wallH = 10 + Math.min(18, n.course * .6 + n.wall * .5), dim = S.horde.dim;
    const roof = dim ? '#4a4640' : '#8a8378', front = dim ? '#3a3631' : '#6e675d', side = dim ? '#2e2b27' : '#5a544c';
    xbox(0, y, gx0, T * 1.2, wallH, roof, front, side); xbox(gx1, y, w - gx1, T * 1.2, wallH, roof, front, side);
    for (let x = 4; x < w; x += 12) { if (x > gx0 - 6 && x < gx1 + 2) continue; xbox(x, y, 5, T * .5, wallH + 4, roof, front, side); }   // the crenels
    const towers = CAS.towers;
    for (let i = 0; i < towers.length; i++) { const tx = i === 0 ? T * .4 : i === 1 ? w - T * 2.4 : i === 2 ? gx0 - T * 2.2 : gx1 + T * .2, th = wallH + 10 + towers[i] * 5; xbox(tx, y - T * .4, T * 2, T * 2, th, roof, front, side); if (n.lamp > i) { xq(tx + T, y + T * .6, th + 3); xfill(dim ? '#5a4a2a' : '#ffd27a'); xell(XP.x, XP.y, XCAM.zoom * 2, XCAM.zoom * 2); } }
    xq(gx0, y + T * 1.2, 0); const gax = XP.x, gay = XP.y; xq(gx1, y + T * 1.2, wallH); xfill('rgba(20,18,16,.6)'); ctx.fillRect(gax, XP.y, XP.x - gax, gay - XP.y);
  }
  /** The north edge while the next region is sealed: a line of light across the road, and a word when the Keeper bumps it. */
  function xseal(M, t) {
    xq(0, M.north, 0); const y = XP.y, x0 = XP.x; xq(M.cols * M.tile, M.north, 0);
    ctx.globalAlpha = .45 + .25 * Math.sin(t * 4) + (XR.bump > 0 ? .3 : 0); xfill('#9b7bff'); ctx.fillRect(x0, y - XCAM.zoom * 14, XP.x - x0, XCAM.zoom * 14); ctx.globalAlpha = 1;
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
      xfill('#ff4d5e'); for (let i = 0; i < W.foes.length; i++) { const f = W.foes[i]; if (!f.on || !f.wake) continue; const fy = f.y / M.tile * s - top; if (fy < 0 || fy > mh) continue; ctx.fillRect(mx + f.x / M.tile * s - 1, my + fy - 1, 2, 2); }
      xfill('#9ff0d8'); ctx.fillRect(mx + k.x / M.tile * s - 1.5, my + k.y / M.tile * s - top - 1.5, 3, 3);
      ctx.strokeStyle = 'rgba(232,236,239,.35)'; ctx.lineWidth = 1; ctx.strokeRect(mx - .5, my - .5, mw + 1, mh + 1);
    }
    ctx.textAlign = 'center';
    if (W.sealed && (W.bump > 0 || k.y < W.map.north + W.map.tile * 6)) { xfill('#e8ecef'); ctx.fillText(XTXT.seal, XW / 2, XH * .22); }
    if (XTXT.toastT > 0) { ctx.globalAlpha = Math.min(1, XTXT.toastT); xfill('rgba(12,12,14,.7)'); ctx.fillRect(XW * .1, XH * .3 - 4, XW * .8, 18); xfill('#e8ecef'); ctx.fillText(XTXT.toast, XW / 2, XH * .3); ctx.globalAlpha = 1; }
  }
