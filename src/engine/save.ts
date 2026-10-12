// localStorage: 1 slot, schema-versioned. Save every year + on choice resolve.

import type { GameState } from './sim';

const KEY = '1in51m-save-v1';
const WARN_KEY = '1in51m-warned-v1';

export function saveGame(st: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* quota/privacy: ignore */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as GameState;
    if (!o || o.v !== 1 || !o.player) return null;
    // migrate older saves (new fields default)
    const pl = o.player as unknown as Record<string, unknown>;
    const reg = (o.player as GameState['player']).regionIdx;
    if (pl['homeIdx'] === undefined) pl['homeIdx'] = reg;
    if (pl['liveIdx'] === undefined) pl['liveIdx'] = reg;
    if (pl['dwelling'] === undefined) pl['dwelling'] = '본가';
    if (pl['uniRegion'] === undefined) pl['uniRegion'] = reg;
    if (pl['deposit'] === undefined) pl['deposit'] = 0;
    if (pl['car'] === undefined) pl['car'] = 'none';
    if (pl['carLoan'] === undefined) pl['carLoan'] = 0;
    if (pl['huntTier'] === undefined) pl['huntTier'] = 'hs';
    if (pl['jobPlace'] === undefined) pl['jobPlace'] = '';
    if (pl['parentsAlive'] === undefined) pl['parentsAlive'] = true;
    if (pl['autoLotto'] === undefined) pl['autoLotto'] = false;
    if (pl['lastFlavor'] === undefined) pl['lastFlavor'] = '';
    if (pl['partner'] === undefined) pl['partner'] = null;
    else if (pl['partner']) {
      const pt = pl['partner'] as Record<string, unknown>;
      if (pt['edu'] === undefined) { pt['edu'] = '대졸'; pt['job'] = '직장인'; pt['income'] = 3000; }
    }
    if (pl['dateCand'] === undefined) pl['dateCand'] = null;
    else if (pl['dateCand']) {
      const dc = pl['dateCand'] as Record<string, unknown>;
      if (dc['edu'] === undefined) { dc['edu'] = '대졸'; dc['job'] = '직장인'; dc['income'] = 3000; }
    }
    if (pl['nums'] === undefined) pl['nums'] = {};
    if (pl['baseGrade'] === undefined) pl['baseGrade'] = (o.player as GameState['player']).grade;
    if (pl['studyYrs'] === undefined) pl['studyYrs'] = 0;
    return o;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function hasSave(): boolean {
  try { return localStorage.getItem(KEY) !== null; } catch { return false; }
}

export function wasWarned(): boolean {
  try { return localStorage.getItem(WARN_KEY) === '1'; } catch { return false; }
}

export function markWarned(): void {
  try { localStorage.setItem(WARN_KEY, '1'); } catch { /* ignore */ }
}
