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
