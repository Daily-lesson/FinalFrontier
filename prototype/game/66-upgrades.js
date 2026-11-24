  // ── run upgrades (rules.stage.upgrades): at a checkpoint and after a Wilds boss, one of three. They last for the run and stack. ──
  // Which ones can be offered is what lifetime play score has opened (rules.stage.meta): play powers play, and only play.
  function recalc() {
    const U = ST.up, R = RS.upgrades, K = RS.keeper, M = RS.moves;
    ST.mod.cd = (1 / K.fire_per_s) * Math.pow(R.rapid_factor, U.rapid);
    ST.mod.charge = M.charge_s * Math.pow(R.charge_factor, U.charge); ST.mod.chargeDmg = M.charge_damage + R.charge_damage * U.charge;
    ST.mod.dashCd = Math.pow(R.overclock_factor, U.overclock);
    ST.mod.magnet = R.magnet_reach * U.magnet;
    ST.mod.shieldS = U.shield ? R.shield_recharge_s / U.shield : 0;
    // gear (FW2): what the evidence dropped, carried into the run. For play only; reading the archive changes nothing in it.
    const gm = gearNow().mods;
    ST.mod.cd *= 1 - (gm.fire_cd || 0); ST.mod.charge *= 1 - (gm.charge || 0); ST.mod.dashCd *= 1 - (gm.dash_cd || 0);
    ST.mod.magnet += gm.magnet || 0; ST.mod.speed = K.speed + (gm.speed || 0); ST.mod.inv = K.invulnerable_s + (gm.inv || 0);
    ST.gearMarks = gearMarks();
    ST.buildStr = R.list.filter((u) => U[u.slug]).map((u) => u.code + U[u.slug]).join(' ');   // the build, as the HUD draws it
  }
  function takeUpgrade(slug) {
    const k = ST.k; if (!(slug in ST.up)) return; ST.up[slug]++; ST.picks++;
    if (slug === 'heart') { k.max++; k.hp = Math.min(k.max, k.hp + 1); }
    if (slug === 'shield') k.shield = true;
    recalc(); sfx('upgrade'); ticker(BANK.upgrade[slug].name, BANK.upgrade[slug].line);
  }
  /** The pool a run may draw from: opened by lifetime play score, not yet at its cap. Hard mode keeps its one heart. */
  const upgradePool = () => RS.upgrades.list.filter((u) => S.play.life >= u.at && ST.up[u.slug] < u.max && !(ST.hard && u.slug === 'heart'));
  function offerUpgrade(why) {
    const pool = upgradePool(); if (!pool.length) return;
    const picks = []; while (picks.length < RS.upgrades.offer && pool.length) picks.push(pool.splice((ST.urnd() * pool.length) | 0, 1)[0]);   // the stage's own seeded roll
    for (const kk in keys) keys[kk] = false;
    const pips = (u) => Array.from({ length: u.max }, (_, i) => `<i class="${i < ST.up[u.slug] ? 'on' : i === ST.up[u.slug] ? 'new' : ''}"></i>`).join('');
    const el = paper(`<div class="keys">${esc(BANK.upgrade.why[why])}</div><h2 data-upgrade="${why}">${esc(BANK.upgrade.title)}</h2><div class="ups">${picks.map((u) => `<button class="up" data-up="${u.slug}"><b>${esc(BANK.upgrade[u.slug].name)}</b><span>${esc(BANK.upgrade[u.slug].line)}</span><span class="pips">${pips(u)}</span></button>`).join('')}</div><p class="keys">${esc(BANK.upgrade.note)}</p>`);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-up]'); if (!b) return; el.remove(); takeUpgrade(b.dataset.up); });
  }
