  // ══════════════════════ SOUND: a small synth in code (WebAudio). No audio file; nothing plays before the first input. ══════════════════════
  // Effects and songs are data (rules.audio): an effect is a swept tone, a noise burst or a short run of notes; a song is two
  // lines of notes stepped by a look-ahead scheduler. The mute switch is part of the play record, so it is remembered.
  const AU = { ctx: null, master: null, noise: null, song: '', wanted: '', step: 0, next: 0, timer: 0 };
  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const notesOf = (v) => (typeof v === 'string' ? v.trim().split(/\s+/).map(Number) : v);   // a line of notes is one string in the rules: read once, here
  for (const s of Object.values(RA.songs)) { s.lead = notesOf(s.lead); s.bass = notesOf(s.bass); }
  for (const s of Object.values(RA.sfx)) if (s.notes) s.notes = notesOf(s.notes);
  function auUnlock() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {}); return; }
    if (globalThis.FIELDWORKS_ART || !S) return;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
    try {
      AU.ctx = new AC(); AU.master = AU.ctx.createGain(); AU.master.gain.value = S.play.mute ? 0 : RA.volume; AU.master.connect(AU.ctx.destination);
      const len = (AU.ctx.sampleRate * .5) | 0, buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate), d = buf.getChannelData(0), r = rng(11);
      for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
      AU.noise = buf; AU.timer = setInterval(auTick, RA.lookahead_ms);
      const w = AU.wanted; AU.song = ''; if (w) music(w);
      if (S.screen === 'castle' && S.horde.clock.due && S.state !== 'unlit') sfx('warning');   // the first sound a warned castle makes
    } catch { AU.ctx = null; }
  }
  /** One voice: an oscillator or the noise buffer through its own gain, from f0 to f1 over dur, then gone. */
  function tone(wave, f0, f1, at, dur, vol) {
    const c = AU.ctx, g = c.createGain(); g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(.0008, at + dur); g.connect(AU.master);
    let src;
    if (wave === 'noise') { src = c.createBufferSource(); src.buffer = AU.noise; src.loop = true; src.playbackRate.setValueAtTime(Math.max(.05, f0 / 1000), at); if (f1 !== f0) src.playbackRate.exponentialRampToValueAtTime(Math.max(.05, f1 / 1000), at + dur); }
    else { src = c.createOscillator(); src.type = wave; src.frequency.setValueAtTime(f0, at); if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(f1, at + dur); }
    src.connect(g); src.start(at); src.stop(at + dur + .02);
  }
  function sfx(name) {
    if (!AU.ctx || S.play.mute) return; const d = RA.sfx[name]; if (!d) return;
    const t = AU.ctx.currentTime;
    if (d.notes) { for (let i = 0; i < d.notes.length; i++) if (d.notes[i]) tone(d.wave, midiHz(d.notes[i]), midiHz(d.notes[i]), t + i * d.s, d.s * 1.6, d.vol); }
    else { tone(d.wave, d.from, d.to, t, d.s, d.vol); if (d.noise) tone('noise', d.noise, d.noise * .4, t, d.s, d.vol * .8); }
  }
  /** Ask for a song by name ('' for silence). It starts on the next tick once sound is unlocked, and loops. */
  function music(name) { AU.wanted = name; if (!AU.ctx || AU.song === name) return; AU.song = name; AU.step = 0; AU.next = AU.ctx.currentTime + .06; }
  function auTick() {
    const c = AU.ctx; if (!c || !AU.song || S.play.mute || document.hidden) return; const s = RA.songs[AU.song]; if (!s) return;
    const dt = 60 / s.bpm / 4;
    if (AU.next < c.currentTime) AU.next = c.currentTime + .02;
    while (AU.next < c.currentTime + RA.ahead_s) {
      const i = AU.step % s.lead.length, l = s.lead[i], b = s.bass[i % s.bass.length];
      if (l) tone(s.wave, midiHz(l), midiHz(l), AU.next, dt * 1.8, s.vol);
      if (b) tone('triangle', midiHz(b), midiHz(b), AU.next, dt * 1.9, s.vol * 1.6);
      if (s.hat && i % s.hat === 0) tone('noise', 7000, 7000, AU.next, .03, s.vol * .45);
      AU.step++; AU.next += dt;
    }
  }
  function setMute(on) { S.play.mute = !!on; if (AU.master) AU.master.gain.value = on ? 0 : RA.volume; saveNow(); }
