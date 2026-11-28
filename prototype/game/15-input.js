  // ══════════════════════ touch input: one canvas, a floating stick, drawn buttons (FW10, design D67 and D79) ══════════════════════
  // While you play, no DOM button takes a touch. One canvas takes every pointer: a stick appears wherever the left thumb lands
  // and follows it; the right side is drawn buttons whose hit areas tile that side with no gap, so a thumb that misses a
  // button still presses the nearest one (the old pad was a third gaps, where a quick second tap zoomed the page).
  // Pointers are tracked by id, so one thumb moves while the other acts. The page around it carries touch-action: none,
  // no selection, no callout and no tap highlight while a game screen is up (html.playing, in the shell's styles).
  // Every size is in rules.input; every label is in the bank. Nothing here reads or writes the evidence.
  const RI = RULES.input, PAD_FONT = `700 ${RI.label_px}px Silkscreen, ui-monospace, monospace`;
  const PAD = { cv: null, g: null, w: 0, h: 0, dpr: 1, on: false, layout: 'pad', dirty: true,
    stick: { id: -1, ox: 0, oy: 0, x: 0, y: 0, ax: 0, ay: 0, up: false },
    zones: [], names: [] };
  // The right side's buttons for a layout: the side-scroller's three, or the explorer's four (FW11). Positions are fractions
  // of the surface, then clamped so every button keeps the rules' minimum size.
  function padLayout(names, layout) {
    PAD.zones.length = 0; PAD.names = names; PAD.layout = layout;
    const L = RI.layouts[layout], minR = RI.button_min_px / 2;
    for (let i = 0; i < names.length; i++) {
      const at = L[names[i]]; if (!at) continue;
      const r = Math.max(minR, Math.min(PAD.w, PAD.h) * at.r);
      PAD.zones.push({ key: names[i], x: PAD.w * at.x, y: PAD.h * at.y, r, id: -1, on: false, t: 0 });
    }
    PAD.dirty = true;
  }
  // Mount on a canvas: size it to its box at the device's pixel ratio (crisp rings and words), and take its pointers.
  function padMount(c, names, layout) {
    if (!c) return;
    PAD.cv = c; PAD.g = c.getContext('2d'); padRelease();
    padSize(); padLayout(names, layout);
    if (c.dataset.pad !== '1') {
      c.dataset.pad = '1';
      c.addEventListener('pointerdown', padDown); c.addEventListener('pointermove', padMove);
      c.addEventListener('pointerup', padUp); c.addEventListener('pointercancel', padUp); c.addEventListener('lostpointercapture', padUp);
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('dblclick', (e) => e.preventDefault());
    }
    PAD.on = true;
  }
  function padSize() {
    const c = PAD.cv; if (!c) return;
    const w = Math.max(1, Math.round(c.clientWidth)), h = Math.max(1, Math.round(c.clientHeight)), dpr = clamp(Math.round(globalThis.devicePixelRatio || 1), 1, 3);
    if (PAD.layout === 'pad') { c.width = w * dpr; c.height = h * dpr; }   // its own surface; on the explorer the game sizes the canvas
    PAD.w = w; PAD.h = h; PAD.dpr = dpr; PAD.dirty = true;
  }
  function padUnmount() { padRelease(); PAD.on = false; PAD.cv = null; PAD.g = null; }
  // Every held thing let go: the stick, the buttons and the keys they hold (a screen change, a blur, a card opening).
  function padRelease() {
    const s = PAD.stick; s.id = -1; s.ax = 0; s.ay = 0; s.up = false;
    for (let i = 0; i < PAD.zones.length; i++) { PAD.zones[i].id = -1; PAD.zones[i].on = false; }
    padKeys(); PAD.dirty = true;
  }
  const padXY = (e) => { const r = PAD.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // The button for a point on the right side: the one whose ring holds it, else the nearest, so the side has no gap.
  function padZoneAt(x, y) {
    let best = null, bd = Infinity;
    for (let i = 0; i < PAD.zones.length; i++) { const z = PAD.zones[i], d = Math.hypot(x - z.x, y - z.y) - z.r; if (d < bd) { bd = d; best = z; } }
    return best;
  }
  const padSideX = () => PAD.w * RI.stick_side;
  function padDown(e) {   // the canvas's pointerdown: sound may start here, from an input
    e.preventDefault(); auUnlock(); if (!PAD.cv) return;
    const [x, y] = padXY(e);
    try { PAD.cv.setPointerCapture(e.pointerId); } catch {}
    if (x < padSideX() || !PAD.zones.length) {
      const s = PAD.stick; if (s.id >= 0) return;   // one stick: a second thumb on the left is ignored
      s.id = e.pointerId; s.ox = x; s.oy = y; s.x = x; s.y = y; s.ax = 0; s.ay = 0; s.up = false;
    } else {
      const z = padZoneAt(x, y); if (!z || z.id >= 0) return;
      z.id = e.pointerId; z.on = true; z.t = 0;
    }
    padKeys(); PAD.dirty = true;
  }
  function padMove(e) {
    const s = PAD.stick; if (s.id !== e.pointerId || !PAD.cv) return;
    e.preventDefault();
    const [x, y] = padXY(e), R = RI.stick_radius_px;
    let dx = x - s.ox, dy = y - s.oy; const d = Math.hypot(dx, dy);
    // the stick's base trails a thumb that runs past its rim, so it never has to come back to the first point to turn
    if (d > R * RI.stick_follow) { const k = (d - R * RI.stick_follow) / d; s.ox += dx * k; s.oy += dy * k; dx = x - s.ox; dy = y - s.oy; }
    s.x = x; s.y = y;
    const m = Math.min(1, Math.hypot(dx, dy) / R), dz = RI.dead_zone, a = Math.atan2(dy, dx), mm = m < dz ? 0 : (m - dz) / (1 - dz);
    s.ax = Math.cos(a) * mm; s.ay = Math.sin(a) * mm;
    padKeys(); PAD.dirty = true;
  }
  function padUp(e) {
    const s = PAD.stick;
    if (s.id === e.pointerId) { s.id = -1; s.ax = 0; s.ay = 0; s.up = false; }
    for (let i = 0; i < PAD.zones.length; i++) { const z = PAD.zones[i]; if (z.id === e.pointerId) { z.id = -1; z.on = false; } }
    padKeys(); PAD.dirty = true;
  }
  // What the pad holds, as the keys the game already reads: the stick's sideways push is left or right, a push up past
  // the rules' line is a jump (once per push, as a key's press is once), and each button holds its own key.
  function padKeys() {
    if (typeof keys === 'undefined') return;
    const s = PAD.stick, side = RI.side_threshold;
    keys.left = s.ax < -side; keys.right = s.ax > side;
    const upNow = s.ay < -RI.jump_threshold && PAD.layout === 'pad';
    let jump = upNow, fire = false, dash = false;
    for (let i = 0; i < PAD.zones.length; i++) { const z = PAD.zones[i]; if (!z.on) continue; if (z.key === 'jump') jump = true; else if (z.key === 'fire') fire = true; else if (z.key === 'dash') dash = true; }
    if (jump && !keys.jump) tap.jump = true; if (fire && !keys.fire) tap.fire = true; if (dash && !keys.dash) tap.dash = true;
    keys.jump = jump; keys.fire = fire; keys.dash = dash; s.up = upNow;
  }
  // Drawn only when something changed: a thumb landed, moved or lifted. Rings, never text a finger can select.
  function padDraw() {
    if (!PAD.on || !PAD.g || !PAD.dirty || PAD.layout !== 'pad') return;
    PAD.dirty = false;
    const g = PAD.g, d = PAD.dpr; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, PAD.w, PAD.h);
    padPaint(g, 1);
  }
  // The controls themselves, on any 2D context in CSS pixels: the pad's own canvas, or the explorer's scene (FW11).
  function padPaint(g, alpha) {
    const s = PAD.stick, R = RI.stick_radius_px;
    g.lineWidth = 2;
    // the stick: where the thumb is, or a faint ring at its resting place when nobody touches it
    const ox = s.id >= 0 ? s.ox : PAD.w * RI.stick_rest.x, oy = s.id >= 0 ? s.oy : PAD.h * RI.stick_rest.y;
    g.globalAlpha = alpha * (s.id >= 0 ? .55 : .28); g.strokeStyle = '#e8ecef'; g.beginPath(); g.arc(ox, oy, R, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = alpha * (s.id >= 0 ? .85 : .35); g.fillStyle = '#e8ecef';
    const kx = s.id >= 0 ? ox + s.ax * R : ox, ky = s.id >= 0 ? oy + s.ay * R : oy;
    g.beginPath(); g.arc(kx, ky, R * .42, 0, Math.PI * 2); g.fill();
    // the buttons: a filled ring, brighter while held, and its word in the game's face
    g.font = PAD_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < PAD.zones.length; i++) {
      const z = PAD.zones[i];
      g.globalAlpha = alpha * (z.on ? .9 : .5); g.fillStyle = z.on ? RI.colours.on : RI.colours[z.key] || RI.colours.fire;
      g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = alpha * .9; g.strokeStyle = '#0d0f12'; g.stroke();
      g.globalAlpha = alpha; g.fillStyle = z.on ? '#0d0f12' : '#ffffff'; g.fillText(BANK.input[z.key], z.x, z.y + 1);
    }
    g.globalAlpha = 1;
  }
