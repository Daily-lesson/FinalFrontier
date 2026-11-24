  // ══════════════════════ the pixel renderer: 180 px wide, a whole-number scale, sprites built in canvas ══════════════════════
  const TILE = RS.tile;
  let cv = null, ctx = null, VW = RS.view_w, VH = 204;   // the view: about view_w wide, set by resize() so every pixel is a whole number of screen pixels
  const PAL = { k: '#14161a', w: '#e9e4d6', W: '#bdb7a6', t: '#3DBFA6', T: '#1f6e60', d: '#2f3439', D: '#4a5158', g: '#8f9296', G: '#6c6f74', l: '#b9bcbf', m: '#a3305e', M: '#c94a7c', r: '#ff4d5e', y: '#e9b949', Y: '#ffe08a', b: '#6b4a2a', B: '#93683a', e: '#4a8f5e', E: '#2f6e4a', s: '#8d7f6a', S: '#6e6252', c: '#9ff0d8', o: '#ff9a3c', v: '#7a5cff' };
  function spr(rows, pal = PAL) {
    const w = Math.max(...rows.map((r) => r.length)), c = document.createElement('canvas'); c.width = w; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = pal[ch] || '#f0f'; g.fillRect(x, y, 1, 1); } });
    return c;
  }
  function flip(c) { const f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return f; }
  /** The same shape in one colour: the hit flash. Built once per sprite, never per frame. */
  function tint(c, col) { const f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); return f; }
  /** [facing right, facing left, flash right, flash left] */
  const both = (rows, pal) => { const a = spr(rows, pal), b = flip(a); return [a, b, tint(a, '#ffffff'), tint(b, '#ffffff')]; };
  // The Keeper: a workshop robot, no face (D13): a visor band and a chest stripe in its paint, and its tool arm out in front.
  // 14 × 18, a body and a set of legs per frame; the hit box is the middle 8 × 16.
  const KW = 14, KH = 18, HBX = 3, HBW = 8, HBY = 2, HBH = 16;
  const K_BODY = ['......y.......', '......k.......', '...kkkkkkkk...', '..kwwwwwwwwk..', '..kttttttttk..', '..ktcttttttk..', '..kwwwwwwwWk..', '...kkkkkkkk...', '..kwwwtwwwWk..', '.kkwwwtwwwWkkk', '.kdwwwtwwwWllk', '.kkwwwtwwwWkk.', '..kwwwtwwwWk..', '...kkkkkkkk...'];
  const K_VISOR = { blink: ['..kTTTTTTTTk..', '..kTTTTTTTTk..'], hurt: ['..krrrrrrrrk..', '..krYrrrrrrk..'], charge: ['..kcccccccck..', '..kcYcccccck..'] };
  const K_LEGS = {
    idle: ['...kd....kd...', '...kd....kd...', '...kd....kd...', '..kkk...kkk...'],
    run1: ['..kd......kd..', '.kd........kd.', '.kk........kkk', '..............'],
    run2: ['...kd...kd....', '....kd.kd.....', '....kkkkk.....', '..............'],
    run3: ['...kd....kd...', '..kd....kd....', '..kk....kkk...', '..............'],
    jump: ['..kdd....kdd..', '..kk.....kk...', '..............', '..............'],
    fall: ['...kd....kd...', '...kd....kd...', '..kd......kd..', '..kk......kk..'],
    dash: ['.kddd..kddd...', '.kk....kk.....', '..............', '..............']
  };
  const kRows = (legs, visor) => [...K_BODY.slice(0, 4), ...(visor ? K_VISOR[visor] : K_BODY.slice(4, 6)), ...K_BODY.slice(6), ...K_LEGS[legs]];
  const KEEPER_ROWS = { idle: kRows('idle'), blink: kRows('idle', 'blink'), run1: kRows('run1'), run2: kRows('run2'), run3: kRows('run3'), jump: kRows('jump'), fall: kRows('fall'), dash: kRows('dash'), hurt: kRows('jump', 'hurt'), charge: kRows('idle', 'charge') };
  const K_RUN = ['run1', 'run2', 'run3', 'run2'];
  // Gear on the Keeper (FW2): one small mark per slot in the colour of its grade, over the sprite. [x, y, w, h] on the 14 × 18 sprite, facing right.
  const GEAR_PX = { blaster: [[11, 9, 3, 1]], visor: [[4, 3, 6, 1]], boots: [[3, 17, 3, 1], [8, 17, 3, 1]], plating: [[2, 8, 1, 2], [11, 8, 1, 2]], core: [[6, 10, 2, 2]] };
  /** The marks of what is carried: [{px, c}] — built when a run starts or its build changes, never per frame. A slot carrying nothing draws nothing. */
  function gearMarks() { const L = gearNow().slots, out = []; for (const slot of RULES.gear.order) { const g = L[slot].gear; if (g) out.push({ px: GEAR_PX[slot], c: RULES.gear.colours[g.grade] }); } return out; }
  /** Draw the marks at the sprite's corner (x, y) through `put(x, y, w, h, colour)`; a left-facing Keeper is the mirror. */
  function drawGear(marks, put, x, y, face) { for (let i = 0; i < marks.length; i++) { const m = marks[i]; for (let j = 0; j < m.px.length; j++) { const r = m.px[j]; put(face > 0 ? x + r[0] : x + KW - r[0] - r[2], y + r[1], r[2], r[3], m.c); } } }
  let KS = null;
  function paintKeeper() { const pal = { ...PAL, t: paintOf(S.play.paint).colour }; KS = Object.fromEntries(Object.entries(KEEPER_ROWS).map(([k, rows]) => [k, both(rows, pal)])); KS.run = K_RUN.map((k) => KS[k]); }
  // The blight's machines (facing left, the way a horde walks). Six kinds out the gate; three of them also walk in a horde.
  const SP = {
    crawlerA: both(['...kkkkkk...', '..kddddddk..', '.krdDddmddk.', '.kddddDdmdk.', 'kkkkkkkkkkkk', 'k.k..kk..k.k']),
    crawlerB: both(['...kkkkkk...', '..kddddddk..', '.krdDddmddk.', '.kddddDdmdk.', 'kkkkkkkkkkkk', '.k.k.kk.k.k.']),
    skitter: both(['..kkkk..', '.kMMMMk.', 'krMMmMMk', 'kMMMMmMk', '.kkkkkk.', '.k.kk.k.', 'k..kk..k']),
    drone: both(['k..kkkk..k', 'kkkddddkkk', '.krdDdmdk.', '.kddddddk.', '..kkkkkk..', '....mm....']),
    turret: both(['....kkkkkk..', '...kdDddddk.', 'kkkkdrrdddk.', 'kllldrrdmdk.', 'kkkkddddddk.', '...kddDdmdk.', '...kkkkkkkk.', '....kddddk..', '...kkddddkk.', '..kkkkkkkkkk']),
    warden: both(['....kkkkkk..', '...kddddddk.', '..kkdrdDddk.', '.kckddddmdk.', 'kclkddDdddk.', 'kclkdddddmk.', 'kclkddddddk.', 'kclkdDddddk.', 'kclkddddmdk.', '.kckddddddk.', '..kkkkkkkkk.', '...kk...kk..', '...kk...kk..']),
    brute: both(['....kkkkkkkk....', '...kddddddddk...', '..kdDDddddmmdk..', '.kdrrDdddddmddk.', '.kdrrddddDdddmk.', '.kddddddddddddk.', 'kkdddDddddmdddkk', 'kmdddddddddDddmk', 'kkddddddddddddkk', '.kkkkkkkkkkkkkk.', '.kk.kk....kk.kk.', '.kk.kk....kk.kk.']),
    spark: spr(['..y..', '.yYy.', 'yYYYy', '.yYy.', '..y..']),
    relic: spr(['...c...', '..cYc..', '.cYYYc.', 'cYYwYYc', '.cYYYc.', '..cYc..', '...c...']),
    heart: spr(['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...']),
    heartOff: spr(['.DD.DD.', 'D..D..D', 'D.....D', '.D...D.', '..D.D..', '...D...']),
    shield: spr(['.ccccc.', 'cc...cc', 'c.....c', '.c...c.', '..c.c..', '...c...']),
    postOn: spr(['.ccc.', 'ccYcc', '.ccc.', '..k..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '.kdk.', 'kkkkk']),
    postOff: spr(['.DDD.', 'D...D', '.DDD.', '..k..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '.kdk.', 'kkkkk']),
    goal: spr(['..ttt..', '.tcYct.', '..ttt..', '...k...', '...d...', '..kdk..', '..dtd..', '..dtd..', '..dtd..', '..dtd..', '..dtd..', '..dtd..', '.kdddk.', 'kkkkkkk']),
    crack: spr(['kkkkkkkkkkkk', 'kggGgggkgggk', 'kgGggggkggGk', 'kggggkkggggk', 'kkkkgkgggkkk', 'kgggkgggGggk', 'kgGgkkgggggk', 'kggggkkkgGgk', 'kgggGggkgggk', 'kkgggggkkggk', 'kgggGggggkgk', 'kkkkkkkkkkkk']),
    spikes: spr(['.l...l...l..', '.g...g...g..', 'lgl.lgl.lgl.', 'gGg.gGg.gGg.']),
    vent: spr(['kkkkkkkkkkkk', 'kdDdrrrrdDdk', 'kkkkkkkkkkkk']),
    blight: spr(['....m.......', '..m.M..m....', '.mMmMm.M.m..', 'mMMMMMmMmMm.'])
  };
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w, h); };
  const blit = (s, x, y) => ctx.drawImage(s, x | 0, y | 0);
  // A 3 × 5 bitmap face for the few words drawn in the world; sentences stay in the chrome.
  const GLYPH = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110', '+': '000010111010000', '-': '000000111000000', '.': '000000000000010', ':': '000010000010000', '!': '010010010000010', '/': '001001010100100', '%': '101001010100101' };
  /** Draws an upper-case string (callers pass one ready: nothing is converted or built here, so the loop allocates nothing). */
  function text(str, x, y, col, shadow = '#14161a') {
    let cx = x | 0;
    for (let i = 0; i < str.length; i++) { const g = GLYPH[str[i]]; if (g) { for (let p = 0; p < 15; p++) if (g[p] === '1') { const gx = cx + p % 3, gy = (y | 0) + ((p / 3) | 0); if (shadow) px(gx + 1, gy + 1, 1, 1, shadow); px(gx, gy, 1, 1, col); } } cx += 4; }
  }
  const textW = (str) => str.length * 4 - 1;
  const isDark = () => (document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  // ── the worlds: a biome is a sky, two ridges, a line of features, its own ground and its own life (rules.stage.biomes) ──
  const GRASS_ROWS = ['eEeeeEeeeEee', 'EeeEeeeEeeEe', 'sSssssssSsss', 'sssssSssssss', 'ssSsssssssSs', 'ssssssSsssss', 'sSsssssssSss', 'ssssSsssssss', 'sssssssSssss', 'ssSsssssssss', 'sssssSssssSs', 'sSssssssssss'];
  const SOIL_ROWS = ['ssssSsssssss', 'sSssssssSsss', 'sssssSssssss', 'ssSsssssssSs', 'ssssssSsssss', 'sSsssssssSss', 'ssssSsssssss', 'sssssssSssss', 'ssSsssssssss', 'sssssSssssSs', 'sSssssssssss', 'ssssssssSsss'];
  const SLAB_ROWS = ['kkkkkkkkkkkk', 'kBBbBBBBbBBk', 'kbBBBbBBBBbk', 'kkkkkkkkkkkk', 'kbbbbkbbbbbk', 'kbbbbkbbbbbk', 'kkkkkkkkkkkk', 'kbbkbbbbkbbk', 'kbbkbbbbkbbk', 'kSSkSSSSkSSk', 'kkkkkkkkkkkk'];   // a ledge is a whole tile: what stops the Keeper is what is drawn
  const BIOMES = {};
  /** A biome's tiles, built once: the same ground in its own colours. */
  function biomeOf(slug) {
    if (BIOMES[slug]) return BIOMES[slug];
    const def = RS.biomes.list.find((b) => b.slug === slug) || RS.biomes.list[0], pal = { ...PAL, e: def.top, E: def.top2, s: def.soil, S: def.soil2, b: def.slab2, B: def.slab };
    const life = def.life;
    return (BIOMES[slug] = { def, slug: def.slug, sign: BANK.biome[def.slug].sign, grass: spr(GRASS_ROWS, pal), soil: spr(SOIL_ROWS, pal), slab: spr(SLAB_ROWS, pal),
      clouds: life.includes('clouds'), birds: life.includes('birds'), flies: life.includes('fireflies'), embers: life.includes('embers'), snow: life.includes('snow'), rain: life.includes('rain'), dust: life.includes('dust'), motes: life.includes('motes') });
  }
  let BIO = null;
  function setBiome(slug) { const b = biomeOf(slug); if (b !== BIO) { BIO = b; bgKey = ''; } }
  // The backdrop: a banded sky and three tiling layers (far ridge, near ridge, features), painted once per biome, theme and size, then stamped.
  let bg = null, bgFar = null, bgNear = null, bgKey = '';   // bgKey '' marks it stale: a theme change, a biome change or a resize clears it, and nothing is built per frame
  function layer() { const c = document.createElement('canvas'); c.width = VW; c.height = VH; return c; }
  function backdrop() {
    if (bg && bgKey) return bg;
    if (!BIO) BIO = biomeOf(RS.biomes.home);
    bgKey = 'painted'; bg = layer(); bgFar = layer(); bgNear = layer();
    const def = BIO.def, dark = isDark(), g = bg.getContext('2d'); isDarkNow = dark; const r = rng(E.hash(def.slug));
    (dark ? def.sky_dark : def.sky_light).forEach((c, i) => { g.fillStyle = c; g.fillRect(0, Math.round(i * VH * .16), VW, VH); });
    if (dark) { g.fillStyle = '#e6ebe4'; for (let i = 0; i < 30; i++) g.fillRect((r() * VW) | 0, (r() * VH * .55) | 0, 1, 1); }
    // the sun, or the moon: a disc in rows
    { const sx = Math.round(VW * .74), sy = Math.round(VH * .16); g.fillStyle = dark ? '#e9eef5' : def.sun; for (let y = -6; y <= 6; y++) { const w = Math.round(Math.sqrt(36 - y * y)); g.fillRect(sx - w, sy + y, w * 2, 1); } if (dark) { g.fillStyle = def.sky_dark[1]; for (let y = -5; y <= 3; y++) { const w = Math.round(Math.sqrt(25 - (y + 1) * (y + 1))); g.fillRect(sx - w + 3, sy + y - 1, w * 2 - 2, 1); } } }
    const ridge = (cv2, base, amp, col, ph) => { const q = cv2.getContext('2d'); q.fillStyle = col; for (let x = 0; x < VW; x += 2) { const a = x / VW * Math.PI * 2, h = Math.round(Math.sin(a * 2 + ph) * amp * .5 + Math.sin(a * 3 + ph * 2) * amp * .3 + Math.sin(a + ph * .5) * amp * .4); q.fillRect(x, Math.round(VH * base) - h, 2, VH); } return q; };
    ridge(bgFar, .6, 16, dark ? def.far_dark : def.far_light, 5.6);
    const q = ridge(bgNear, .72, 10, dark ? def.near_dark : def.near_light, 2.9), fc = dark ? def.feature_dark : def.feature_light, base = Math.round(VH * .72);
    const twice = (fn) => { for (let i = 0; i < 7; i++) { const x = (r() * VW) | 0, s = r(); fn(x, s); fn(x - VW, s); } };   // drawn again one width left, so the layer tiles without a seam
    q.fillStyle = fc;
    if (def.feature === 'trees') twice((x, s) => { const h = 12 + (s * 12 | 0), y = base - 4; q.fillRect(x + 3, y - h * .4, 2, h * .4 + 6); for (let i = 0; i < h; i += 2) { const w = 1 + (i / 3 | 0); q.fillRect(x + 4 - w, y - h + i - 2, w * 2, 2); } });
    else if (def.feature === 'mesas') twice((x, s) => { const w = 16 + (s * 18 | 0), h = 14 + (s * 16 | 0); q.fillRect(x, base - h, w, h + 8); q.fillRect(x + 3, base - h - 3, w - 8, 3); q.fillRect(x - 3, base - h * .5, w + 6, h); });
    else if (def.feature === 'reeds') twice((x, s) => { const h = 10 + (s * 16 | 0); q.fillRect(x, base - h, 1, h + 6); q.fillRect(x - 1, base - h - 3, 3, 4); q.fillRect(x + 4, base - h * .6, 1, h); q.fillRect(x + 8, base - h * .8, 1, h); q.fillRect(x + 7, base - h * .8 - 2, 3, 3); });
    else if (def.feature === 'stacks') twice((x, s) => { const h = 20 + (s * 22 | 0); q.fillRect(x, base - h, 5, h + 8); q.fillRect(x - 1, base - h, 7, 2); q.fillRect(x + 7, base - h * .5, 14, h); q.fillStyle = def.glow; q.fillRect(x + 1, base - h - 1, 3, 1); q.fillRect(x + 10, base - h * .5 + 3, 2, 2); q.fillRect(x + 15, base - h * .5 + 3, 2, 2); q.fillStyle = fc; });
    else twice((x, s) => { const h = 18 + (s * 22 | 0); for (let i = 0; i < h; i++) { const w = Math.max(1, Math.round((i / h) * 7)); q.fillRect(x - w, base - h + i, w * 2, 1); } q.fillStyle = def.glow; q.fillRect(x - 1, base - h, 1, 5); q.fillStyle = fc; });
    return bg;
  }
  /** The sky and its three layers at a camera position; then the weather-free life of the place (clouds, birds). */
  function drawWorld(camX, t) {
    ctx.drawImage(backdrop(), 0, 0);
    if (BIO.clouds) { ctx.globalAlpha = isDarkNow ? .18 : .8; for (let i = 0; i < 3; i++) { const x = ((i * 71 + t * (2 + i) - camX * .05) % (VW + 44) + VW + 44) % (VW + 44) - 34, y = 12 + i * 15; px(x, y, 20, 3, '#ffffff'); px(x + 4, y - 2, 11, 2, '#ffffff'); px(x + 5, y + 3, 12, 1, '#ffffff'); } ctx.globalAlpha = 1; }
    let o = Math.floor(camX * .12) % VW; if (o < 0) o += VW; ctx.drawImage(bgFar, -o, 0); ctx.drawImage(bgFar, VW - o, 0);
    if (BIO.birds) for (let i = 0; i < 3; i++) { const x = ((t * (11 + i * 3) + i * 67) % (VW + 24)) - 12, y = 22 + i * 11 + Math.sin(t * 1.3 + i) * 4, up = ((t * 5 + i) | 0) % 2; px(x, y + up, 2, 1, '#22262b'); px(x + 2, y + 1 - up, 1, 1, '#22262b'); px(x + 3, y + up, 2, 1, '#22262b'); }
    o = Math.floor(camX * .3) % VW; if (o < 0) o += VW; ctx.drawImage(bgNear, -o, 0); ctx.drawImage(bgNear, VW - o, 0);
  }
  /** What moves in the air in front of the ground: fireflies, embers, snow, rain, dust, motes. Positions are functions of time: no state. */
  function drawAir(camX, t, gy) {
    const B = BIO;
    if (B.flies) for (let i = 0; i < 9; i++) { if (Math.sin(t * 2.1 + i * 1.7) < -.2) continue; const x = ((i * 41 + Math.sin(t * .7 + i) * 12 - camX * .6) % VW + VW) % VW, y = gy - 14 - (i * 17 % 58) + Math.cos(t * .9 + i * 2) * 5; px(x, y, 1, 1, '#eaff8a'); ctx.globalAlpha = .3; px(x - 1, y - 1, 3, 3, '#eaff8a'); ctx.globalAlpha = 1; }
    if (B.embers) for (let i = 0; i < 14; i++) { const u = ((t * (18 + i % 5 * 4) + i * 37) % VH), x = ((i * 29 + Math.sin(t + i) * 8 - camX * .5) % VW + VW) % VW; px(x, VH - u, 1, 1, i % 3 ? '#ff9a3c' : '#ffe08a'); }
    if (B.snow) for (let i = 0; i < 26; i++) { const y = (t * (20 + i % 4 * 6) + i * 23) % VH, x = ((i * 17 + Math.sin(t * .8 + i) * 9 - camX * .4) % VW + VW) % VW; px(x, y, 1, 1, '#ffffff'); }
    if (B.rain) { ctx.globalAlpha = .45; for (let i = 0; i < 18; i++) { const y = (t * 230 + i * 41) % VH, x = ((i * 23 - t * 36 - camX * .3) % VW + VW) % VW; px(x, y, 1, 4, '#cfe9ff'); } ctx.globalAlpha = 1; }
    if (B.dust) { ctx.globalAlpha = .35; for (let i = 0; i < 6; i++) { const x = ((t * (30 + i * 7) + i * 53 - camX * .7) % (VW + 20) + VW + 20) % (VW + 20) - 10, y = gy - 6 - i * 13; px(x, y, 6 + i % 3 * 3, 1, '#fff0d0'); } ctx.globalAlpha = 1; }
    if (B.motes) for (let i = 0; i < 4; i++) { const x = ((i * 53 + Math.sin(t * .6 + i * 2) * 16 - camX * .8) % VW + VW) % VW, y = gy - 8 - i * 6 + Math.sin(t * 3 + i) * 3, f = ((t * 9 + i) | 0) % 2; px(x - f, y, 1, 1, '#fff3a8'); px(x + 1 + f, y, 1, 1, '#fff3a8'); px(x, y + 1, 1, 1, '#22262b'); }
  }
  let isDarkNow = false;
  // ── stone: the castle is drawn from its counts, never stored ──
  const STONE = { base: '#8f9296', shade: '#6c6f74', light: '#b9bcbf', line: '#2a2d31', lamp: '#ffe08a', trim: '#3DBFA6', wood: '#6b4a2a', iron: '#2f3439', glass: '#ffd27a' };
  const STONE_DIM = { base: '#55575e', shade: '#3f4148', light: '#6b6d74', line: '#1c1e22', lamp: '#5d5a52', trim: '#4c5f5b', wood: '#40301f', iron: '#22252a', glass: '#4c4a44' };
  function stone(x, y, w, h, P) {
    px(x, y, w, h, P.base);
    for (let yy = y + 3, r = 0; yy < y + h; yy += 4, r++) { px(x, yy, w, 1, P.shade); for (let xx = x + (r % 2 ? 2 : 5); xx < x + w - 1; xx += 6) px(xx, yy - 3, 1, 3, P.shade); }
    px(x, y, w, 1, P.light); px(x, y, 1, h, P.line); px(x + w - 1, y, 1, h, P.line);
  }
  function crenels(x, y, w, P) { for (let xx = x; xx + 3 <= x + w; xx += 6) { px(xx, y - 3, 3, 3, P.base); px(xx, y - 3, 3, 1, P.light); px(xx, y - 3, 1, 3, P.line); px(xx + 2, y - 3, 1, 3, P.line); } }
  function stub(x, gy, w, P) { for (let xx = x; xx < x + w; xx += 2) px(xx, gy - 4, 1, 1, P.shade); px(x, gy - 2, w, 2, P.shade); }
  const FACE = 104, TOWER_X = [90, 62, 16, 1], TOWER_W = 14, KEEP_X = 34, KEEP_W = 24;
  const wallH = (cas) => 14 + Math.min(RC.draw.rows_max, Math.floor(cas.count.course / RC.draw.courses_per_row) + Math.floor(Math.max(0, cas.count.wall - RC.draw.sections_max) / RC.draw.sections_max)) * 3;
  const towerH = (level) => (level > 0 ? 24 + Math.min(level, RC.draw.tower_levels_max) * 6 : 0);
  const walkH = (cas) => (cas.count.wall > 0 ? wallH(cas) : 0);   // the Keeper stands on the wall once there is one
  const walkMin = (cas) => (cas.count.wall > 0 ? Math.max(4, FACE - 10 * Math.min(RC.draw.sections_max, cas.count.wall)) : 4);
  const keepH = (cas) => (cas.count.keep > 0 ? 26 + Math.min(cas.count.keep, RC.draw.keep_levels_max) * 8 : 6);
  function drawBeacon(x, y, t, dim) {
    px(x - 1, y - 6, 3, 6, dim ? '#3f4148' : '#2f3439');
    const pulse = dim ? 0 : .5 + .5 * Math.sin(t * 3);
    px(x - 2, y - 10, 5, 4, dim ? '#55575e' : '#3DBFA6'); px(x - 1, y - 9, 3, 2, dim ? '#6b6d74' : '#9ff0d8');
    if (!dim) { ctx.globalAlpha = .25 + .25 * pulse; px(x - 4, y - 12, 9, 8, '#9ff0d8'); ctx.globalAlpha = 1; }
  }
  /** The castle, from its counts. ox shifts it (the stage shows its face at the left edge); returns nothing and keeps nothing. */
  function drawCastle(cas, ox, gy, dim, t, quiet, brace) {
    const P = dim ? STONE_DIM : STONE, c = cas.count, hW = wallH(cas);
    const n = Math.min(RC.draw.sections_max, c.wall);
    for (let i = 0; i < RC.draw.sections_max; i++) { const x = ox + FACE - 10 * (i + 1); if (i < n) { stone(x, gy - hW, 10, hW, P); crenels(x, gy - hW, 10, P); } else stub(x, gy, 10, P); }
        for (let i = 0; i < Math.min(8, c.lamp); i++) { const x = ox + 8 + i * 11; px(x, gy - 9, 1, 3, P.iron); px(x - 1, gy - 11, 3, 2, P.lamp); }
    for (let i = 0; i < cas.towers.length; i++) {
      const level = cas.towers[i], x = ox + TOWER_X[i], h = towerH(level); if (!level) { stub(x, gy, TOWER_W, P); continue; }
      stone(x, gy - h, TOWER_W, h, P); crenels(x - 1, gy - h, TOWER_W + 2, P); px(x - 1, gy - h, TOWER_W + 2, 1, P.light);
      px(x + 6, gy - h + 8, 2, 5, P.line); px(x + TOWER_W, gy - h + 5, 4, 2, P.iron);
      for (let p = 0; p < Math.min(level, RC.draw.tower_levels_max); p++) px(x + 2, gy - 6 - p * 6, 2, 2, P.lamp);
      px(x + 6, gy - h - 12, 1, 9, P.iron);   // a flag on every tower: it flies in the wind, and turns red while the castle braces
      for (let fx = 0; fx < 6; fx++) px(x + 7 + fx, gy - h - 12 + (dim ? 1 : Math.sin(t * 5 + fx * .9 + i) > 0 ? 0 : 1), 1, level > RC.draw.tower_levels_max ? 4 : 3, brace ? '#e0445c' : P.trim);
    }
    const kh = keepH(cas), kx = ox + KEEP_X;
    if (c.keep > 0) {
      stone(kx, gy - kh, KEEP_W, kh, P); crenels(kx - 1, gy - kh, KEEP_W + 2, P);
      for (let l = 0; l < Math.min(c.keep, RC.draw.keep_levels_max); l++) { const lit = dim || Math.sin(t * 1.7 + l * 2.3) > -.85; px(kx + 5, gy - 12 - l * 8, 3, 4, lit ? P.glass : P.lamp); px(kx + 16, gy - 12 - l * 8, 3, 4, P.glass); if (brace) { px(kx + 5, gy - 10 - l * 8, 3, 1, P.iron); px(kx + 16, gy - 10 - l * 8, 3, 1, P.iron); } }
      if (!dim && !quiet) { for (let s = 0; s < 3; s++) { const u = (t * .3 + s / 3) % 1; ctx.globalAlpha = .5 * (1 - u); px(kx + 19 + Math.sin(u * 6 + s) * 2, gy - kh - 5 - u * 18, 2 + (u * 3 | 0), 2, '#f2f2ee'); } ctx.globalAlpha = 1; }   // the hearth's smoke
      px(kx + 9, gy - 11, 6, 11, P.wood); px(kx + 9, gy - 11, 6, 1, P.line);
    } else { stub(kx, gy, KEEP_W, P); px(kx + 8, gy - 6, 8, 6, P.shade); }
    drawBeacon(kx + 12, gy - kh, t, dim || quiet);
    // the gate in the face, braced by the lifts
    const gx = ox + FACE - 11; px(gx, gy - 13, 8, 13, P.wood); px(gx, gy - 13, 8, 1, P.line); px(gx, gy - 13, 1, 13, P.line); px(gx + 7, gy - 13, 1, 13, P.line);
    for (let b = 0; b < Math.min(4, c.gate); b++) px(gx + 1, gy - 3 - b * 3, 6, 1, P.iron);
    if (brace) { for (let b = 1; b < 7; b += 2) px(gx + b, gy - 12, 1, 12, P.iron); px(gx, gy - 7, 8, 1, P.iron); }   // the portcullis is down
    if (dim) { px(ox + FACE - 22, gy - hW, 2, 6, P.line); px(ox + FACE - 21, gy - hW + 5, 2, 5, P.line); px(ox + FACE - 23, gy - hW + 9, 2, 4, P.line); }   // the breach, drawn; nothing was taken
  }
  function ground(gy, camX) { const off = -(Math.floor(camX) % TILE); for (let x = off; x < VW; x += TILE) { blit(BIO.grass, x, gy); for (let y = gy + TILE; y < VH; y += TILE) blit(BIO.soil, x, y); } }
  /** Grass that sways and the odd flower, on one ground tile's top. */
  function tuft(x, y, c, t) { const s = Math.sin(t * 2.2 + c * 1.3) > .2 ? 1 : 0; px(x + 2 + s, y - 2, 1, 2, BIO.def.top2); px(x + 8 + s, y - 3, 1, 3, BIO.def.top); if (c % 5 === 2) { px(x + 5, y - 3, 1, 3, BIO.def.top2); px(x + 5 + s, y - 4, 1, 1, BIO.def.bloom); } }
