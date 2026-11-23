  // The embeddable build (embed/play.js) sets the flag, carries the rules as a constant and brings the page's body with it,
  // so any host shell works: a document that is only the stylesheets and this one script.
  const EMBED = !!globalThis.FIELDWORKS_EMBED;
  if (EMBED) {
    document.documentElement.classList.add('embed');
    if (!document.body) document.documentElement.appendChild(document.createElement('body'));
    document.body.insertAdjacentHTML('beforeend', globalThis.FIELDWORKS_BODY);
  }
  const RULES = globalThis.FIELDWORKS_RULES || JSON.parse(document.getElementById('rules').textContent);
  const E = FieldworksEngine, C = FieldworksCastle;
  const BANK = RULES.bank, RC = RULES.castle, RH = RULES.horde, RS = RULES.stage, RA = RULES.audio;
  // Signed out (the public site sets the flag; the DEMO never does): no account, so no evidence, no orders, no lessons,
  // no lifts and no horde. The castle stands empty and the Wilds are the whole game. The save keeps play only.
  // Embedded, the game is signed out until the host posts a world (25-embed.js); the DEMO world is never used there.
  let OUT = !!globalThis.FIELDWORKS_SIGNED_OUT || EMBED;
  let TODAY = '2026-11-09';   // the DEMO's fixed day; embedded, the host's `today`
  const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;   // no shake, no flash, no hit-stop
  const DAY = 86400000;
  const utc = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const ago = (n) => iso(utc(TODAY) - n * DAY);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = '') => `<svg class="fm ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // The page's own browser storage: four keys, all local to this device, never sent. Embedded, two keys of its own: play only.
  const KEYS = EMBED ? { keeper: '', save: 'fieldworks-embed-play', onboarded: 'fieldworks-embed-onboarded', telemetry: '' }
    : { keeper: 'fieldworks-keeper', save: 'fieldworks-save', onboarded: 'fieldworks-onboarded', telemetry: 'fieldworks-telemetry' };
  const store = { get(k) { if (!k) return null; try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { if (!k) return; try { localStorage.setItem(k, v); } catch {} }, del(k) { if (!k) return; try { localStorage.removeItem(k); } catch {} } };
  const RULES_HASH = E.hash(JSON.stringify(RULES));
  const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // ── local telemetry (rules.telemetry): your own numbers, on this device ──
  const TEL0 = () => ({ v: 2, opens: {}, session_seconds: 0, closes_seen: 0, stages_cleared: 0, hordes_seen: 0, regions_mapped: 0 });
  function teleLoad() { try { const t = JSON.parse(store.get(KEYS.telemetry) || 'null'); if (t && t.opens && typeof t.opens === 'object') { if (t.v === 2) return t; if (t.v === 1) return { ...TEL0(), opens: t.opens, session_seconds: t.session_seconds || 0, closes_seen: t.closes_seen || 0, regions_mapped: t.regions_mapped || 0 }; } } catch {} return TEL0(); }   // version 1 was the old game's: its opens, minutes, closes and regions carry over
  let TEL = teleLoad();
  if (OUT) TEL = { ...TEL0(), opens: TEL.opens, session_seconds: TEL.session_seconds };   // signed out: a device's own opens and minutes, never counts of the DEMO's closes, hordes or regions
  const teleSave = () => { if (!globalThis.FIELDWORKS_ART) store.set(KEYS.telemetry, JSON.stringify(TEL)); };
  function teleOpen() { const d = localDay(); TEL.opens[d] = (TEL.opens[d] || 0) + 1; const cut = new Date(Date.now() - RULES.telemetry.keep_days * DAY); for (const k of Object.keys(TEL.opens)) if (new Date(k) < cut) delete TEL.opens[k]; teleSave(); }
  const teleAdd = (k, n = 1) => { TEL[k] = (TEL[k] || 0) + n; };
