/* ---------- the run is cached on this device: resuming a stage costs a continue coin ---------- */
const runKey = c => 'emberfall_run_v1_' + (c || CLS);
function saveRun(stage) { if (daily) { saveDailyRun(stage); return; } if (DEV) return; try { localStorage.setItem(runKey(), seal({ v: 3, stage, cycle, coins: rpg.coins, gold: rpg.gold, score, coop, c2: CLS2 })); } catch (e) { } }
function loadRun(c) { try { const o = unseal(localStorage.getItem(runKey(c)), runKey(c)); return o && o.stage >= 0 && o.stage < STAGES.length ? o : null; } catch (e) { return null; } }
function clearRun() { if (daily) return; try { localStorage.removeItem(runKey()); } catch (e) { } }
try { for (const c of CLS_ORDER) { unseal(localStorage.getItem(saveKey(c)), saveKey(c)); unseal(localStorage.getItem(runKey(c)), runKey(c)); } } catch (e) { } // at start-up every hero's save and run cache are checked, so a changed one is caught on the title screen
let resumeSel = 0, runInfo = null;
function resumeRun() {
  const o = runInfo; coop = sel.coop; cycle = o.cycle | 0; resetGame(); rpg.coins = Math.max(0, (o.coins | 0) - 1); rpg.gold = o.gold | 0; score = o.score | 0; shop = null;
  saveRun(o.stage); beginStage(o.stage); msg = 'CONTINUED  (-1 COIN)'; msgT = 140;
}
function updateResume() {
  const can = runInfo.coins > 0;
  if (isHit('up') || isHit('down') || isHit('left') || isHit('right')) { resumeSel = can ? 1 - resumeSel : 1; SFX.pick(); }
  if (isHit('back')) { mode = 'select'; return; }
  if (isHit('start') || isHit('atk')) { if (resumeSel === 0 && can) resumeRun(); else { clearRun(); startCampaign(sel.coop); } }
}
function drawResume() {
  g.fillStyle = 'rgba(4,2,10,0.7)'; g.fillRect(0, 0, W, H);
  const o = runInfo, can = o.coins > 0, C = cls();
  lvText(C.name + '  LV ' + rpg.lvl, W / 2, 60, 14, C.col, 'center');
  text('UNFINISHED RUN ON THIS DEVICE', W / 2, 82, 9, '#c9a8ff', 'center');
  text((o.cycle ? trialName(o.cycle) + '  ' : '') + 'STAGE ' + (o.stage + 1) + '  ' + STAGES[o.stage].name, W / 2, 100, 10, '#fff1d0', 'center');
  drawCoins(W / 2 - 14, 116, o.coins, 14);
  text('SCORE ' + (o.score | 0) + '    GOLD ' + (o.gold | 0), W / 2, 136, 8, '#ffd24a', 'center');
  const opt = (i, s, ok) => { const y = 168 + i * 22, on = resumeSel === i; if (on) { g.fillStyle = 'rgba(60,30,90,0.8)'; g.fillRect(W / 2 - 150, y - 13, 300, 18); } text((on ? '> ' : '') + s, W / 2, y, 10, !ok ? '#6a5a70' : on ? '#ffffff' : '#b8a8c8', 'center'); };
  opt(0, can ? 'CONTINUE THIS STAGE  (USES 1 COIN)' : 'NO COINS LEFT TO CONTINUE', can);
  opt(1, 'NEW CAMPAIGN  (THE OLD RUN IS LOST)', true);
  text('ENTER: CHOOSE    ESC: BACK', W / 2, 250, 8, '#8a7a9a', 'center');
}
function peekSave(c) { try { const o = migrateSave(checkSeal(localStorage.getItem(saveKey(c)))) || {}; const eq = {}; for (const sl of SLOTS) if (o.eq && validItem(o.eq[sl])) eq[sl] = o.eq[sl]; return { lvl: clamp((o.lvl | 0) || 1, 1, MAX_LV), eq }; } catch (e) { return { lvl: 1, eq: {} }; } }
function setClass(c) {
  if (!CLASSES[c]) c = 'nolan'; if (c === CLS && loadedCls === c) return;
  if (loadedCls) saveGame(); CLS = c; rpg.lvl = 1; rpg.xp = 0; rpg.bag = []; rpg.eq = {}; rpg.elem = null; rpg.et = 0; rpg.eg = 0; rpg.tr = 0; rpg.pg = 0; rpg.pxp = 0; PS = null; loadGame(); saveSettings();
  if (hero) heroStats(true);
}

