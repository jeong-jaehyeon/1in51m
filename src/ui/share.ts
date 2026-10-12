// Share cards (1080x1350 PNG): my life card + class newspaper. Pure canvas, no assets.

import type { GameState } from '../engine/sim';
import { fmtMan } from '../data/lookup';
import { dwellingLabel } from '../engine/sim';
import { REGIONS } from '../data/lookup';
import { jobLabel } from '../data/jobs';
import { drawPortrait } from '../engine/portrait';

const W = 1080;
const H = 1350;
const PAPER = '#F7FAF8';
const INK = '#13212A';
const INK2 = '#4A5A61';
const ACCENT = '#8C1D3C';
const STAMP = '#0F6E68';
const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif';

function base(title: string, sub: string): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = '#fff';
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText(title, 60, 95);
  ctx.font = `400 30px ${FONT}`;
  ctx.fillStyle = '#F3E3E8';
  ctx.fillText(sub, 60, 132);
  return [cv, ctx];
}

export function renderMyCard(st: GameState): HTMLCanvasElement {
  const p = st.player;
  const [cv, ctx] = base('5100만분의 1', '나의 생애 결과 · 교육용 풍자 시뮬레이션');
  // portrait
  const pc = document.createElement('canvas');
  drawPortrait(pc, p.seed, p.sex, Math.min(p.deathAge, 80), p.quintile);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pc, 60, 200, 200, 250);
  ctx.fillStyle = INK;
  ctx.font = `800 92px ${FONT}`;
  ctx.fillText(p.name, 300, 310);
  ctx.font = `400 36px ${FONT}`;
  ctx.fillStyle = INK2;
  ctx.fillText(`${REGIONS[p.regionIdx].name} 출생 · ${p.sex === 'M' ? '남' : '여'}`, 300, 365);
  ctx.fillText(`${p.deathAge}세, 사인: ${p.cause}`, 300, 410);
  const rows: Array<[string, string]> = [
    ['학력', p.univName || (p.suneung > 0 ? `수능 ${p.suneung}등급` : '진학 없음')],
    ['직업', p.job ? jobLabel(p.job) : '무직'],
    ['전성기 연봉', `${fmtMan(p.peak)}${p.lottoWon > 0 ? ` (로또 ${fmtMan(p.lottoWon)} 포함)` : ''}`],
    ['결혼·자녀', p.spouse ? `기혼${p.divorced ? '(이혼)' : ''} · 자녀 ${p.kids}명` : '미혼'],
    ['주거', dwellingLabel(st)],
    ['반 등수', `15명 중 ${st.rank}등`],
  ];
  let y = 540;
  ctx.font = `400 38px ${FONT}`;
  for (const [k, v] of rows) {
    ctx.fillStyle = INK2;
    ctx.fillText(k, 60, y);
    ctx.fillStyle = INK;
    ctx.font = `700 38px ${FONT}`;
    ctx.fillText(v.slice(0, 26), 330, y);
    ctx.font = `400 38px ${FONT}`;
    y += 78;
  }
  ctx.fillStyle = STAMP;
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(`같은 반 15명 중 ${st.rank}등`, 60, y + 30);
  ctx.fillStyle = INK2;
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText('#5100만분의1 · 실통계 기반 허구', 60, H - 60);
  return cv;
}

export function renderPaper(st: GameState): HTMLCanvasElement {
  const [cv, ctx] = base('우리 반 15명 근황', '같은 해 태어나 각자의 삶을 살았다');
  let y = 230;
  ctx.font = `400 32px ${FONT}`;
  const alive = st.mates.filter((m) => m.alive);
  const dead = st.mates.filter((m) => !m.alive);
  for (const m of st.mates) {
    const line1 = `${m.name} · ${m.univ || '고졸'} → ${m.job || '미정'}`;
    const line2 = m.alive
      ? `${m.married ? `기혼·자녀${m.kids}` : '미혼'} · peak ${fmtMan(m.peak)}`
      : `† ${m.deathAge}세 · ${m.cause}`;
    ctx.fillStyle = INK;
    ctx.fillText(line1.slice(0, 30), 60, y);
    ctx.fillStyle = m.alive ? INK2 : ACCENT;
    ctx.font = `400 28px ${FONT}`;
    ctx.fillText(line2.slice(0, 34), 60, y + 38);
    ctx.font = `400 32px ${FONT}`;
    y += 84;
    if (y > H - 160) break;
  }
  ctx.fillStyle = INK2;
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(`생존 ${alive.length}명 · 사망 ${dead.length}명 (추모)`, 60, H - 60);
  return cv;
}

export function downloadCanvas(cv: HTMLCanvasElement, filename: string): void {
  const a = document.createElement('a');
  a.download = filename;
  a.href = cv.toDataURL('image/png');
  a.click();
}
