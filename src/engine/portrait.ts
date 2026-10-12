// Procedural pixel portraits (16x20), seeded. No external assets.
// Varies by sex, age band, household quintile. Rendered with image-rendering: pixelated.

import type { Sex } from '../data/lifetable';

const W = 16;
const H = 20;

function hash(n: number): number {
  let x = n >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function drawPortrait(
  cv: HTMLCanvasElement,
  seed: number,
  sex: Sex,
  age: number,
  quintile: number,
): void {
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const h = (salt: number) => hash(seed + salt * 7919);
  const skins = ['#f2c9a0', '#e8b184', '#d69c6d'];
  const skin = skins[h(1) % skins.length];
  const shade = '#b97f56';
  let hair = ['#2b2b33', '#3d3d47', '#1d1d22'][h(2) % 3];
  if (age >= 75) hair = '#e8e8e8';
  else if (age >= 55) hair = h(3) % 2 ? '#9a9aa0' : hair;
  const tops = ['#5a6b7d', '#4a5a6a', '#0F6E68', '#33415c', '#1f2a44', '#8C1D3C'];
  const top = tops[(quintile - 1 + h(4)) % tops.length];
  const bg = age < 7 ? '#DCEDEA' : ['#E3E8E6', '#EFE7DA', '#E2E6EF'][h(5) % 3];

  const px = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(x, y, bg);
  // hair
  for (let x = 3; x <= 12; x++) { px(x, 2, hair); px(x, 3, hair); }
  if (sex === 'F') {
    for (let y = 4; y <= 9; y++) { px(2, y, hair); px(13, y, hair); }
    for (let x = 3; x <= 12; x++) px(x, 4, hair);
  } else {
    for (let x = 4; x <= 11; x++) px(x, 4, hair);
  }
  // face
  for (let y = 4; y <= 13; y++) for (let x = 4; x <= 11; x++) px(x, y, skin);
  if (sex === 'F') { for (let y = 5; y <= 9; y++) { px(3, y, skin); px(12, y, skin); } }
  // ears
  px(3, 9, shade); px(12, 9, shade);
  // eyes
  const eye = '#1c1c22';
  px(5, 8, eye); px(6, 8, eye); px(9, 8, eye); px(10, 8, eye);
  if (age >= 60) { px(5, 7, shade); px(10, 7, shade); }
  // mouth
  const mw = age >= 60 ? 3 : 2;
  for (let i = 0; i < mw; i++) px(7 + i, 12, '#7a4038');
  // wrinkles 60+
  if (age >= 60) { for (let x = 5; x <= 10; x++) px(x, 10, shade); }
  if (age >= 75) { for (let x = 6; x <= 9; x++) px(x, 6, shade); }
  // neck + body
  px(7, 13, shade); px(8, 13, shade);
  for (let y = 14; y < H; y++) for (let x = 3; x <= 12; x++) px(x, y, top);
  // collar / tie by quintile
  if (quintile >= 4) { px(7, 14, '#f5f5f5'); px(8, 14, '#f5f5f5'); }
  if (quintile >= 5) { px(7, 15, '#8C1D3C'); px(8, 15, '#8C1D3C'); px(7, 16, '#8C1D3C'); }
  if (quintile <= 2) { for (let x = 3; x <= 12; x += 2) px(x, 15, shade); }
  // student cap
  if (age >= 7 && age <= 18) { for (let x = 5; x <= 10; x++) px(x, 1, '#8C1D3C'); }
  // soldier helmet 20-21
  if (age >= 20 && age <= 23 && h(6) % 3 === 0) { for (let x = 3; x <= 12; x++) { px(x, 1, '#4a5d23'); px(x, 2, '#4a5d23'); } }
}
