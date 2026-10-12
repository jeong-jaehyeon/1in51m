// 5100만분의 1 — simulation engine.
// Locked balance (planning sims N=10k): lotto yearly attempt p=0.014% (20-60),
// star 예체능-only try 10% x win 5%, suicide stats x mental mult, life table pure,
// marriage 78%, divorce 0.5%/yr, med cutoff grade>=95, recalibration targets:
// q5 top 15%, q1 2% (builder: verify against real 2024 tables).

import { REGIONS, FAMILIES, RATES, QUINTILE_START, QUINTILE_LABEL, MPC, REGION_QW, afterTax, fmtMan } from '../data/lookup';
import { pickUniv, UNIVERSITIES } from '../data/universities';
import type { SimTier } from '../data/universities';
import { JOBS, jobLabel } from '../data/jobs';
import type { Job } from '../data/jobs';
import { baseQ, suicideQ, ACCIDENT_Q, diseaseCause } from '../data/lifetable';
import type { Sex } from '../data/lifetable';
import { MALE, FEMALE } from '../data/names';

export interface RngS { s: number }
function rnd(st: RngS): number {
  st.s |= 0; st.s = (st.s + 0x6d2b79f5) | 0;
  let t = Math.imul(st.s ^ (st.s >>> 15), 1 | st.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rint(st: RngS, a: number, b: number): number { return a + Math.floor(rnd(st) * (b - a + 1)); }
function ch(st: RngS, p: number): boolean { return rnd(st) < p; }
function pick<T>(st: RngS, arr: readonly T[]): T { return arr[Math.floor(rnd(st) * arr.length)]; }
function pickW<T>(st: RngS, pairs: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let r = rnd(st) * total;
  for (const [v, w] of pairs) { r -= w; if (r < 0) return v; }
  return pairs[pairs.length - 1][0];
}
function gauss(st: RngS, mean: number, sd: number): number {
  const u = Math.max(rnd(st), 1e-9);
  const v = Math.max(rnd(st), 1e-9);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface FeedItem { age: number; text: string; cls?: string; src?: string }

// 한국어 조사 (받침 유무). 이름·명사 뒤에 붙인다.
export function josa(word: string, kind: '와과' | '을를' | '이가' | '은는' | '으로'): string {
  const last = word.charCodeAt(word.length - 1);
  const tail = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
  const hasBatchim = tail !== 0;
  switch (kind) {
    case '와과': return hasBatchim ? '과' : '와';
    case '을를': return hasBatchim ? '을' : '를';
    case '이가': return hasBatchim ? '이' : '가';
    case '은는': return hasBatchim ? '은' : '는';
    case '으로': return hasBatchim && tail !== 8 ? '으로' : '로';
  }
}
export interface ChoiceOpt { key: string; label: string; sub?: string }
export interface PendingChoice { id: string; title: string; fact?: string; options: ChoiceOpt[] }

export type FocusId = 'study' | 'sport' | 'work' | 'network' | 'rest' | 'art' | 'love' | 'gamble';

export interface Spouse { name: string; edu: string; job: string; income: number; classmate: boolean; age: number; marriedAt: number }

export interface Partner { name: string; classmate: boolean; yrs: number; edu: string; job: string; income: number }

export interface Player {
  name: string; sex: Sex; seed: number;
  regionIdx: number; quintile: number; familyId: string; familyNote: string;
  homeIdx: number; liveIdx: number; dwelling: '본가' | '자취' | '전세' | '자가';
  uniRegion: number; deposit: number;
  car: 'none' | 'used' | 'new'; carLoan: number;
  huntTier: SimTier | 'hs'; jobPlace: string; parentsAlive: boolean;
  autoLotto: boolean; lastFlavor: string;
  twin: boolean; luck: number;
  health: number; mental: number; network: number; grade: number;
  baseGrade: number; studyYrs: number;
  money: number;
  focus: FocusId;
  edu: SimTier | 'none'; univName: string; track: string; suneung: number;
  record: boolean; bankrupt: boolean;
  job: Job | null; salary: number; peak: number; workYrs: number; retired: boolean;
  service: 'none' | 'todo' | 'active' | 'supplement' | 'officer' | 'done' | 'exempt';
  serviceLeft: number; nco: boolean; officer: boolean;
  spouse: Spouse | null; partner: Partner | null; dateCand: Partner | null;
  kids: number; children: Array<'M' | 'F'>; divorced: boolean;
  sibOlder: number; sibYounger: number;
  loan: number; loanLeft: number;
  cancer: boolean; dementia: boolean; star: boolean; starRetired: boolean; biz: boolean;
  alive: boolean; deathAge: number; cause: string;
  lottoWon: number;
  journal: Record<number, string>;
  log: FeedItem[];
  flags: Record<string, boolean>;
  nums: Record<string, number>;
}

export interface Mate {
  name: string; sex: Sex; seed: number;
  q: number; score: number;
  alive: boolean; deathAge: number; cause: string;
  edu: string; univ: string; job: string; peak: number;
  married: boolean; kids: number; spouseClass: boolean; dating: boolean;
}

export interface GameState {
  v: 1; seed: number; rng: RngS;
  age: number; birthYear: number;
  player: Player; mates: Mate[];
  over: boolean; memorial: boolean;
  pending: PendingChoice | null;
  condolence: { name: string; age: number; cause: string } | null;
  reflect: number | null;
  auto: boolean; speed: 1 | 2 | 4;
  rank: number; rankTotal: number;
}

export function newSeed(): number { return (Date.now() ^ (Math.random() * 1e9)) >>> 0; }
export function regionOf(st: GameState) { return REGIONS[st.player.regionIdx]; }

function feed(st: GameState, text: string, cls?: string, src?: string): void {
  st.player.log.push({ age: st.age, text, cls, src });
  if (st.player.log.length > 500) st.player.log.splice(0, st.player.log.length - 500);
}

// ---------- birth ----------
export function createGame(name: string, seed: number): GameState {
  const rng: RngS = { s: seed };
  const sex: Sex = rnd(rng) < RATES.maleBirth ? 'M' : 'F';
  const regionIdx = (() => {
    const pairs = REGIONS.map((r, i) => [i, r.birthW] as const);
    return pickW(rng, pairs);
  })();
  const region0 = REGIONS[regionIdx];
  const quintile = pickW(rng, (REGION_QW[region0.id] ?? [20, 20, 20, 20, 20]).map((w, i) => [i + 1, w] as const));
  const fam = pickW(rng, FAMILIES.map((f) => [f, f.w] as const));
  const twin = ch(rng, RATES.twin);
  const luck = rint(rng, 1, 100);
  // 형제자매: 외동 25%, 1명 50%, 2명+ 25%. 첫째·막내·중간은 생략하고 수만 기록
  const sibRoll = rnd(rng);
  const sibTotal = sibRoll < 0.25 ? 0 : sibRoll < 0.75 ? 1 : 2;
  const sibOlder = sibTotal === 0 ? 0 : Math.floor(rnd(rng) * (sibTotal + 1));
  const grade = Math.max(0, Math.min(100, gauss(rng, 30 + quintile * 9, 15)));
  const st: GameState = {
    v: 1, seed, rng, age: 0, birthYear: 2026,
    player: {
      name, sex, seed: rint(rng, 1, 1e9),
      regionIdx, quintile, familyId: fam.id, familyNote: fam.note,
      homeIdx: regionIdx, liveIdx: regionIdx, dwelling: '본가',
      uniRegion: regionIdx, deposit: 0,
      car: 'none', carLoan: 0,
      huntTier: 'hs', jobPlace: '', parentsAlive: true,
      autoLotto: false, lastFlavor: '',
      twin, luck,
      health: rint(rng, 70, 95), mental: 70 + fam.mental, network: 50, grade,
      baseGrade: grade, studyYrs: 0,
      money: QUINTILE_START[quintile - 1] + fam.money,
      focus: 'study',
      edu: 'none', univName: '', track: '', suneung: 0,
      record: false, bankrupt: false,
      job: null, salary: 0, peak: 0, workYrs: 0, retired: false,
      service: sex === 'M' ? 'todo' : 'none', serviceLeft: 0, nco: false, officer: false,
      spouse: null, partner: null, dateCand: null, kids: 0, children: [], divorced: false,
      sibOlder, sibYounger: sibTotal - sibOlder,
      loan: 0, loanLeft: 0,
      cancer: false, dementia: false, star: false, starRetired: false, biz: false,
      alive: true, deathAge: 0, cause: '',
      lottoWon: 0, journal: {}, log: [], flags: {}, nums: {},
    },
    mates: [], over: false, memorial: false,
    pending: null, condolence: null, reflect: null, auto: false, speed: 1, rank: 0, rankTotal: 11,
  };
  const p = st.player;
  const region = REGIONS[regionIdx];
  feed(st, `${p.name} 탄생. ${region.name}(${region.city}), ${fam.name}${twin ? ', 쌍둥이' : ''}. ${sex === 'M' ? '남아' : '여아'}.`, 'big');
  feed(st, `${QUINTILE_LABEL[quintile - 1]} 가구에서 태어났다. 같은 동네라도 살림살이는 다르다.`, undefined, '통계청 가계동향 2024');
  if (ch(rng, RATES.infantDeath)) {
    p.alive = false; p.deathAge = 0; p.cause = pick(rng, ['선천성 질환', '신생아 폐렴'] as const);
    feed(st, `생후 4개월, ${p.cause}${josa(p.cause, '으로')} 세상을 떠났다.`, 'death');
    st.over = true; st.memorial = true;
    return st;
  }
  feed(st, '산모·신생아 건강. 분유값이 월 18만 원씩 나간다.');
  if (p.money < 0) feed(st, `가계 빚 ${Math.abs(Math.round(p.money)).toLocaleString()}만 원에서 시작한다. 부모의 빚이 아이의 출발선이다.`, 'bad');
  else feed(st, `종잣돈 ${Math.round(p.money).toLocaleString()}만 원으로 시작한다.`);
  return st;
}

// ---------- classmates (formed at age 7) ----------
function formClass(st: GameState): void {
  const rng = st.rng;
  const poolM = MALE.filter((n) => n !== st.player.name);
  const poolF = FEMALE.filter((n) => n !== st.player.name);
  const names: string[] = [];
  for (let i = 0; i < 5; i++) names.push(poolM.splice(Math.floor(rnd(rng) * poolM.length), 1)[0]);
  for (let i = 0; i < 5; i++) names.push(poolF.splice(Math.floor(rnd(rng) * poolF.length), 1)[0]);
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(rng) * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  st.mates = names.map((name) => {
    const sex: Sex = MALE.includes(name) ? 'M' : 'F';
    const q = Math.floor(rnd(rng) * 5) + 1;
    return {
      name, sex, seed: rint(rng, 1, 1e9), q,
      score: Math.max(0, Math.min(100, gauss(rng, 30 + q * 9, 15))),
      alive: true, deathAge: 0, cause: '',
      edu: '', univ: '', job: '', peak: 0, married: false, kids: 0, spouseClass: false, dating: false,
    } satisfies Mate;
  });
  feed(st, '초등학교 입학. 같은 반 11명이 모였다. 앞으로 죽을 때까지 소식을 주고받는다.', 'big');
}

function gradeBand(g: number): number {
  if (g >= 92) return 1; if (g >= 88) return 2; if (g >= 82) return 3;
  if (g >= 74) return 4; if (g >= 64) return 5; if (g >= 52) return 6;
  if (g >= 38) return 7; if (g >= 24) return 8; return 9;
}

function tierByGrade(g: number, base: number): SimTier | 'hs' {
  if (g >= 95 && base >= 93) return 'med';
  if (g >= 85) return 'sk';
  if (g >= 75) return 'seoul';
  if (g >= 60) return 'jgeo';
  if (g >= 45) return 'jun';
  return 'hs';
}

const TIER_JOB: Record<SimTier | 'hs', Array<[string, number]>> = {
  med: [['PRO', 85], ['BIG', 15]],
  sk: [['PRO', 8], ['BIG', 45], ['PUB', 25], ['MID', 22]],
  seoul: [['BIG', 20], ['PUB', 20], ['MID', 45], ['PLAT', 15]],
  jgeo: [['PUB', 12], ['MID', 40], ['PROD', 20], ['PLAT', 15], ['SELF', 13]],
  jun: [['MID', 25], ['PROD', 25], ['SELF', 20], ['PLAT', 15], ['FARM', 8], ['NONE', 7]],
  hs: [['PROD', 30], ['SELF', 15], ['PLAT', 20], ['FARM', 10], ['NONE', 25]],
};

export function drawJob(st: GameState, tier: SimTier | 'hs', bonus: number): Job | null {
  const rng = st.rng;
  let t = pickW(rng, TIER_JOB[tier]);
  if (t === 'NONE') return null;
  if (bonus > 0 && ch(rng, bonus)) {
    const up: Record<string, string> = { MID: 'BIG', PROD: 'MID', PLAT: 'MID', SELF: 'MID', FARM: 'PROD', PUB: 'BIG', BIG: 'PRO', PRO: 'PRO' };
    t = up[t] ?? t;
  }
  if (st.player.record && ch(rng, 0.5)) {
    const dn: Record<string, string> = { PRO: 'BIG', BIG: 'MID', PUB: 'MID', MID: 'PROD', SELF: 'PROD', PLAT: 'PROD' };
    t = dn[t] ?? t;
  }
  const pool = JOBS.filter((j) => j.tier === t);
  if (pool.length === 0) return null;
  return pool[Math.floor(rnd(rng) * pool.length) % pool.length];
}

function mateTick(st: GameState, m: Mate, age: number): void {
  const rng = st.rng;
  if (!m.alive) return;
  if (ch(rng, baseQ(age, m.sex) + ACCIDENT_Q)) {
    m.alive = false; m.deathAge = age; m.cause = diseaseCause(age, rnd(rng));
    if (age < 60 && !st.condolence) st.condolence = { name: m.name, age, cause: m.cause };
    else if (age < 50 || m.cause === '자살') feed(st, `${m.name}(${age}세) 사망. 사인: ${m.cause}.`, 'friend');
    return;
  }
  if (age >= 15 && age <= 85 && ch(rng, suicideQ(age, m.sex))) {
    m.alive = false; m.deathAge = age; m.cause = '자살';
    if (age < 60 && !st.condolence) st.condolence = { name: m.name, age, cause: '자살' };
    else feed(st, `${m.name}(${age}세) 사망. 사인: 자살.`, 'friend');
    return;
  }
  if (age === 19) {
    const tier = tierByGrade(m.score, m.score);
    m.edu = tier === 'hs' ? '고졸' : tier === 'med' ? pick(rng, ['서울대의대', '연세의대', '지방의대'] as const) : pickUniv(tier, rnd(rng)).name;
    m.univ = tier === 'hs' ? '' : m.edu;
    if (tier === 'med' || (tier === 'sk' && ch(rng, 0.3))) feed(st, `${m.name}, ${m.edu} 입학.`, 'friend');
  }
  if (age === 22 && !m.job) {
    if (ch(rng, 0.10) && ch(rng, 0.05)) {
      m.job = pick(rng, ['가수', '배우', '운동선수', '인플루언서'] as const); m.peak = 50000;
      feed(st, `${m.name}, ${m.job}로 데뷔했다.`, 'friend');
    } else {
      const tier = m.edu === '' || m.edu === '고졸' ? 'hs' : tierByGrade(m.score, m.score);
      const t = pickW(rng, TIER_JOB[tier === 'med' ? 'med' : tier]);
      if (t === 'NONE') { m.job = '취준생'; m.peak = 0; }
      else {
        const pool = JOBS.filter((j) => j.tier === t);
        const j = pool[Math.floor(rnd(rng) * pool.length) % pool.length];
        m.job = jobLabel(j); m.peak = Math.round(j.base * (1 + j.raise * 20));
      }
    }
  }
  if (m.job && m.job !== '취준생' && age > 22 && age < 60) m.peak = Math.round(m.peak * 1.015);
  if (!m.married && !m.dating && age >= 26 && age <= 42 && ch(rng, 0.10)) {
    m.married = true;
    m.kids = ch(rng, 0.85) ? (ch(rng, 0.4) ? (ch(rng, 0.08) ? 3 : 2) : 1) : 0;
  }
  if (age >= 20 && age <= 60 && ch(rng, RATES.lottoP)) {
    m.peak += 67000;
    feed(st, `${m.name}, 로또 1등에 당첨됐다는 소문.`, 'friend');
  }
}

function applyFocus(st: GameState): void {
  const p = st.player;
  if (st.age < 17 && (p.focus === 'work' || p.focus === 'gamble')) {
    // 미성년: 알바·도박 불가. 심부름 수준으로 대체
    p.mental = Math.min(100, p.mental + 2);
    return;
  }
  switch (p.focus) {
    case 'study': {
      if (st.age < 19) {
        p.grade = Math.min(100, p.grade + (p.studyYrs < 5 ? 1.2 : 0.2));
        p.studyYrs += 1;
      }
      p.health = Math.max(0, p.health - 1);
      break;
    }
    case 'sport': p.health = Math.min(100, p.health + 4); p.grade = Math.max(0, p.grade - 1); break;
    case 'work': {
      const hours = st.age < 19 ? 30 : 80;
      const earn = Math.round(hours * 0.986 * 12);
      p.money += earn; p.mental = Math.max(0, p.mental - 1);
      if (st.age >= 14) feed(st, `알바 월 ${hours}시간 × 최저시급 9860원. 연 ${earn}만 원 벌었다.`, undefined, '최저임금위원회 2024');
      break;
    }
    case 'network': p.network = Math.min(100, p.network + 4); break;
    case 'rest': p.mental = Math.min(100, p.mental + 5); p.health = Math.min(100, p.health + 1); break;
    case 'art': p.grade = Math.max(0, p.grade - 2); p.flags['artYrs'] = true; break;
    case 'love': p.mental = Math.min(100, p.mental + 3); p.network = Math.min(100, p.network + 1); break;
    case 'gamble': {
      p.mental = Math.max(0, p.mental - 2);
      const x = rnd(st.rng);
      if (x < 0.6) { p.money -= 50; feed(st, '도박으로 50만 원 잃었다.'); }
      else if (x < 0.9) { p.money += 100; feed(st, '도박으로 100만 원 땄다.'); }
      else { p.money += 1000; feed(st, '도박으로 1000만 원 땄다. 이 맛에 못 끊지.', 'good'); }
      break;
    }
  }
}

interface FEntry { a: number; b: number; age?: [number, number]; if?: (st: GameState) => boolean; lines: string[] }

const hasJob = (st: GameState) => !!st.player.job && !st.player.retired;
const huntReady = (st: GameState) => {
  const s = st.player.service;
  return !st.player.job && st.age >= 22 && (s === 'done' || s === 'exempt' || s === 'none');
};
const kidAge = (st: GameState) => (st.player.nums['firstKid'] ?? -1) >= 0 ? st.age - (st.player.nums['firstKid'] ?? 0) : -1;

const PHASE_FLAVOR: FEntry[] = [
  { a: 1, b: 6, age: [1, 2], lines: ['이앓이를 한다. 밤에 세 번 깬다.'] },
  { a: 1, b: 6, age: [1, 1], lines: ['첫돌. 돌잡이에서 {pickJ} 잡았다.'] },
  { a: 1, b: 6, age: [1, 2], lines: ['말문이 트였다. “엄마”가 먼저다.'] },
  { a: 1, b: 6, age: [2, 6], lines: ['어린이집 대기번호가 {n}번이다.'] },
  { a: 1, b: 6, age: [1, 5], lines: ['예방접종 날. 엉엉 울었다가 사탕 하나로 그쳤다.'] },
  { a: 7, b: 12, lines: ['받아쓰기 100점. 냉장고에 붙었다.', '운동회 계주에서 넘어졌다. 무릎이 까졌다.', '같은 반 {mWa} 절교했다가 다음 날 화해했다.', '학원 셔틀버스에서 꾸벅 졸았다.', '생일 파티에 {mGa} 왔다.'] },
  { a: 13, b: 15, lines: ['사춘기. 방문을 닫고 산다.', '첫 시험에서 반 평균을 넘겼다.', '좋아하는 연예인 사진을 책상에 붙였다.', '{mWa} 같은 고등학교를 가고 싶다고 했다.', '밤 12시, 수학 오답노트를 펼쳤다.'] },
  { a: 16, b: 18, lines: ['모의고사 성적표가 왔다.', '야자 시간에 꾸벅 졸다 걸렸다.', '급식 빵이 맛있다는 소문이 났다.', '수능 D-{dday}. 책상 앞에 붙였다.'] },
  { a: 20, b: 29, if: huntReady, lines: ['취업 포털에 이력서를 올렸다. 서류만 {n}번째다.'] },
  { a: 20, b: 29, if: (st) => huntReady(st) && !st.player.flags['certDone'], lines: ['취업을 위해 컴활 1급 시험을 봤다.', '컴활 실기에서 {certR}. 취업용인데.', '한국사 1급을 땄다. 공무원 가산점용이다.'] },
  { a: 20, b: 29, if: (st) => hasJob(st) && st.player.workYrs <= 1, lines: ['첫 월급날. 통장을 세 번 확인했다. 세후 {pay}만원이 찍혔다. 너무 좋아서.'] },
  { a: 20, b: 29, if: (st) => hasJob(st) && st.player.salary > 0 && st.player.salary < 3000, lines: ['월급날. 통장을 세 번 확인했다. 너무 적어서.'] },
  { a: 20, b: 29, if: (st) => {
    if (!hasJob(st) && st.age < 25) return false;
    const n = st.player.nums;
    if ((n['giftAge'] ?? -1) !== st.age) { n['giftAge'] = st.age; n['giftN'] = 0; }
    return (n['giftN'] ?? 0) < 1 + Math.floor(st.player.network / 30);
  }, lines: ['친구 결혼식에 축의금 {gift}만 원을 냈다.'] },
  { a: 30, b: 49, if: (st) => kidAge(st) >= 6 && kidAge(st) <= 18, lines: ['아이 운동회 날 반차를 썼다.', '아이 학원비 고지서가 왔다.'] },
  { a: 30, b: 49, lines: ['건강검진에서 콜레스테롤 경고를 받았다.'] },
  { a: 30, b: 49, if: (st) => !st.player.flags['bpMed'], lines: ['혈압약을 먹기 시작했다.'] },
  { a: 30, b: 49, if: (st) => !st.player.flags['golf'], lines: ['골프를 배웠다.'] },
  { a: 30, b: 64, if: (st) => hasJob(st) && st.age % 10 === 0, lines: ['연봉 {payY}만. 10년 전보다 {pct}% 올랐다.', '연봉이 10년째 제자리다. 답답하다.'] },
  { a: 30, b: 49, if: (st) => st.player.parentsAlive && st.player.money > 0, lines: ['부모님께 용돈을 보내드렸다.'] },
  { a: 30, b: 49, if: hasJob, lines: ['회식 2차에서 노래를 불렀다.'] },
  { a: 45, b: 60, if: (st) => kidAge(st) >= 19 && kidAge(st) <= 28, lines: ['자녀 등록금 고지서가 왔다.'] },
  { a: 50, b: 64, if: hasJob, lines: ['후배가 팀장이 됐다.'] },
  { a: 50, b: 64, if: (st) => st.mates.length > 0, lines: ['동창회에 나갔다. 반은 약을 먹는다고 했다.'] },
  { a: 50, b: 64, lines: ['무릎이 시큰거린다.', '정년 후 뭘 할지 고민한다.'] },
  { a: 50, b: 64, if: (st) => !st.player.flags['cataract'], lines: ['백내장이 왔다.'] },
  { a: 65, b: 200, if: (st) => kidAge(st) >= 27, lines: ['손주 사진을 받았다.'] },
  { a: 65, b: 200, lines: ['공원에서 바둑을 뒀다.', '병원 정기검진 날이다.', '옛날 노래를 흥얼거렸다.', '경로당에 나간다.', '고혈압 약을 먹는다.', '옛 친구를 장례식에서 만났다.', '텃밭을 가꾼다.'] },
  { a: 65, b: 200, if: (st) => !st.player.flags['denture'], lines: ['틀니를 맞췄다.'] },
];

function flavor(st: GameState): void {
  const prevSal = st.player.nums['sal10'] ?? st.player.salary;
  const pct = prevSal > 0 ? Math.round((st.player.salary / prevSal - 1) * 100) : 0;
  const pool: string[] = [];
  for (const e of PHASE_FLAVOR) {
    if (st.age < e.a || st.age > e.b) continue;
    if (e.age && (st.age < e.age[0] || st.age > e.age[1])) continue;
    if (e.if && !e.if(st)) continue;
    for (const ln of e.lines) {
      if (ln.includes('10년 전보다') && pct <= 0) continue;
      if (ln.includes('제자리다') && pct > 0) continue;
      pool.push(ln);
    }
  }
  if (pool.length === 0 || !ch(st.rng, 0.7)) return;
  const cands = pool.length > 1 ? pool.filter((t) => t !== st.player.lastFlavor) : pool;
  let t = pick(st.rng, cands.length > 0 ? cands : pool);
  const mate = st.mates.length > 0 && ch(st.rng, 0.4) ? pick(st.rng, st.mates).name : '친구';
  const mWa = mate + josa(mate, '와과');
  const mGa = mate + josa(mate, '이가');
  const n = st.player.nums['apps'] ?? 0;
  if (st.player.nums['dday'] === undefined) st.player.nums['dday'] = rint(st.rng, 280, 365);
  const dday = Math.max(1, st.player.nums['dday'] ?? 1);
  const gift = pick(st.rng, [5, 10, 10, 20, 30] as const);
  const pk = pick(st.rng, ['공', '마이크', '청진기', '돈'] as const);
  t = t.replace('{mWa}', mWa).replace('{mGa}', mGa)
    .replace('{gift}', String(gift))
    .replace('{pickJ}', pk + josa(pk, '을를'))
    .replace('{pick}', pk)
    .replace('{n}', String(n + 1))
    .replace('{dday}', String(dday))
    .replace('{certR}', pick(st.rng, ['떨어졌다', '붙었다'] as const))
    .replace('{pay}', Math.round(afterTax(st.player.salary) / 12).toLocaleString())
    .replace('{payY}', Math.round(st.player.salary).toLocaleString())
    .replace('{pct}', String(pct));
  if (t.includes('10년 전보다')) st.player.nums['sal10'] = st.player.salary;
  if (t.includes('이력서')) st.player.nums['apps'] = n + 1;
  if (t.includes('혈압약')) st.player.flags['bpMed'] = true;
  if (t.includes('골프를 배웠다')) st.player.flags['golf'] = true;
  if (t.includes('백내장')) st.player.flags['cataract'] = true;
  if (t.includes('틀니')) st.player.flags['denture'] = true;
  if (t.includes('축의금')) { st.player.money -= gift; st.player.nums['giftN'] = (st.player.nums['giftN'] ?? 0) + 1; }
  if (t.includes('D-')) st.player.nums['dday'] = Math.max(1, dday - rint(st.rng, 150, 200));
  if (t.includes('컴활') || t.includes('한국사')) st.player.flags['certDone'] = true;
  st.player.lastFlavor = t;
  feed(st, t);
}

export function formatKids(p: { kids: number; children: Array<'M' | 'F'> }): string {
  if (p.children.length !== p.kids || p.kids === 0) return p.kids === 0 ? '없음' : `자녀 ${p.kids}명`;
  const m = p.children.filter((c) => c === 'M').length;
  const f = p.kids - m;
  const parts: string[] = [];
  if (m > 0) parts.push(`${m}남`);
  if (f > 0) parts.push(`${f}녀`);
  return parts.join('');
}

export function spouseNow(p: { spouse: Spouse | null }, ageNow: number): string {
  if (!p.spouse) return '미혼';
  const cur = p.spouse.age + (ageNow - p.spouse.marriedAt);
  return `${p.spouse.name}(${cur}세)${josa(p.spouse.name, '와과')} 혼인`;
}

// 전국 비교 (수명: 2024 생명표 e0 기준, 소득: 추정치)
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let pb = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) pb = 1 - pb;
  return pb;
}

export function compareStat(st: GameState): { life: number; income: number } {
  const p = st.player;
  const e0 = p.sex === 'M' ? 80.6 : 86.4;
  const life = Math.max(1, Math.min(99, Math.round((1 - normCdf((p.deathAge - e0) / 9)) * 100)));
  const pk = p.peak;
  const income = pk >= 9000 ? 10 : pk >= 6000 ? 25 : pk >= 4000 ? 50 : pk >= 3000 ? 70 : 90;
  return { life, income };
}

export function dwellingLabel(st: GameState): string {
  const p = st.player;
  return `${p.dwelling}(${REGIONS[p.liveIdx].name})`;
}

function livingCost(st: GameState): number {
  const p = st.player;
  const region = REGIONS[p.liveIdx];
  let c = Math.round(1800 * region.costIdx + p.kids * 800);
  if (p.dwelling === '자취') c += Math.round(600 * region.houseIdx);
  else if (p.dwelling === '본가') c += 120;
  else if (p.dwelling === '전세') c += 200 + Math.round(p.deposit * ((p.nums['jeonRate'] ?? 4) / 100));
  else if (p.dwelling === '자가') c += 100 + (p.flags['mortgage'] ? 300 : 0);
  if (p.car === 'used') c += 250;
  else if (p.car === 'new') c += 360;
  if (p.carLoan > 0) c += 500;
  if (p.flags['abroad']) c = Math.round(c * 1.4);
  return c;
}

function tutorCost(st: GameState): number {
  const p = st.player;
  if (p.kids === 0 || st.age > 60) return 0;
  return Math.round(144 * REGIONS[p.liveIdx].tutorIdx * (0.5 + p.quintile * 0.2) * p.kids);
}

// 등록금: 5분위는 부모 전액, 4분위는 절반, 나머지는 대출
function assignTuition(st: GameState, full: number): void {
  const p = st.player;
  if (p.quintile >= 5) {
    p.loan = 0; p.loanLeft = 0;
    feed(st, '등록금은 부모님이 내주셨다.', 'good');
  } else if (p.quintile === 4) {
    p.loan = Math.round(full / 2); p.loanLeft = 10;
    p.money -= Math.round(full / 2);
    feed(st, `등록금 절반은 부모님이, 절반은 대출 ${p.loan}만 원.`);
  } else {
    p.loan = full; p.loanLeft = 10;
    feed(st, `등록금 대출 ${full}만 원. 10년 상환.`, undefined, '대학알리미 등록금 공시');
  }
}

// 대학 소재지 추첨 + 거주지 결정 (타지=자취, 고향=통학)
function setResidence(st: GameState): void {
  const p = st.player;
  const r = rnd(st.rng);
  const home = p.homeIdx;
  let uni = home;
  if (r < 0.30) uni = pickW(st.rng, [[0, 8], [1, 8], [2, 9], [3, 5]] as const);
  else if (r < 0.45) {
    const others = REGIONS.map((_, i) => i).filter((i) => i !== home && i > 3);
    uni = others[Math.floor(rnd(st.rng) * others.length) % others.length];
  }
  p.uniRegion = uni;
  p.liveIdx = uni;
  if (uni !== home) {
    p.dwelling = '자취';
    p.money -= 500;
    feed(st, `타지(${REGIONS[uni].name}) 진학. 자취를 시작했다. 이사비 500만 원.`, 'big');
  } else {
    p.dwelling = '본가';
    feed(st, '본가 통학한다. 교통비 월 10만 원.');
  }
}

// 실명 직장 표기 (소방서·경찰서·학교·관공서)
export function jobPlace(j: Job, region: { city: string }): string {
  const city = region.city;
  switch (j.role) {
    case '소방': return `소방 — ${city}소방서 소속`;
    case '경찰': return `경찰 — ${city}경찰서 소속`;
    case '교사': return `교사 — ${city} 소재 고등학교 소속`;
    case '9급공무원': case '지방공무원': return `${j.role} — ${city} 시청 소속`;
    case '7급공무원': return '7급공무원 — 세종 중앙부처 소속';
    case '군무원': return '군무원 — 계룡대 소속';
    case '세무공무원': return `세무공무원 — ${city} 세무서 소속`;
    default: {
      if (j.org) return jobLabel(j);
      const fb = j.tier === 'MID' ? '중소기업' : j.tier === 'PROD' ? '현장' : j.tier === 'FARM' ? '고향' : j.tier === 'PLAT' ? '플랫폼' : '직장';
      return `${j.role} — ${fb} 소속`;
    }
  }
}

const TIER_DOWN: Record<string, SimTier | 'hs'> = { med: 'sk', sk: 'seoul', seoul: 'jgeo', jgeo: 'jun', jun: 'hs', hs: 'hs' };
const MINGRADE: Record<string, number> = { PRO: 90, BIG: 75, PUB: 55, MID: 40 };

// 눈높이 하향 + 구직 단념
function downshift(st: GameState): void {
  const p = st.player;
  const fails = p.nums['fails'] ?? 0;
  if (fails >= 3 && p.huntTier !== 'hs') {
    p.huntTier = TIER_DOWN[p.huntTier];
    p.nums['fails'] = 0;
    feed(st, '눈높이를 낮췄다. 한 단계 아래를 노린다.', 'bad');
  } else if (fails >= 6 && p.huntTier === 'hs') {
    p.flags['gaveup'] = true;
    feed(st, '취업을 잠시 접었다. 단기알바로 버틴다.', 'bad');
  }
}

// 연간 구직: 실명 조직 면접 (스펙 미달이면 서류 탈락 + 이유)
function huntYear(st: GameState): StepOut | null {
  const rng = st.rng;
  const p = st.player;
  const letter = pickW(rng, TIER_JOB[p.huntTier]);
  if (letter === 'NONE') {
    p.money += 150;
    feed(st, pick(rng, ['단기알바로 150만 원 벌었다. 정규직 공고가 없다.', '일용직으로 150만 원 벌었다.', '배달 대행으로 150만 원 벌었다.'] as const));
    return null;
  }
  const cand = JOBS.filter((j) => j.tier === letter);
  const j = cand[Math.floor(rnd(rng) * cand.length) % cand.length];
  if (letter === 'SELF') {
    // 자영업은 면접이 아니라 인수 (무산 후 3년 쿨다운)
    if ((p.nums['takeCool'] ?? 0) > st.age) return null;
    p.nums['tjob'] = JOBS.indexOf(j);
    return ask(st, {
      id: 'takeover', title: `${jobLabel(j)} 인수 기회 (보증금 2500만)`, fact: '자영업은 시험이 아니라 목돈으로 시작한다',
      options: [
        { key: 'yes', label: '인수한다', sub: '보증금 2500만 원 필요' },
        { key: 'no', label: '패스한다', sub: '다음 기회에' },
      ],
    });
  }
  const need = MINGRADE[letter] ?? 0;
  const place = jobPlace(j, REGIONS[p.liveIdx]);
  if (p.grade < need - 10) {
    p.nums['fails'] = (p.nums['fails'] ?? 0) + 1;
    feed(st, `${place} 서류 탈락. 스펙(성적 ${Math.round(p.grade)}점)이 모자라다.`, 'bad');
    downshift(st);
    return null;
  }
  p.nums['tjob'] = JOBS.indexOf(j);
  return ask(st, {
    id: 'interview', title: `${place} 면접 기회`, fact: `요구 스펙: 성적 ${need}점대`,
    options: [
      { key: 'prep', label: '밤새 준비한다', sub: '합격률 상승' },
      { key: 'loose', label: '대충 본다', sub: '떨어질 확률 높음' },
    ],
  });
}

// 원작처럼: 스탯은 가만히 있으면 감쇠한다 (100 찍고 고정 금지)
function decayStats(st: GameState): void {
  const p = st.player;
  if (st.age >= 19) {
    p.health = Math.max(0, p.health - (st.age >= 70 ? 2 : st.age >= 50 ? 1 : 0.3));
    if (p.health < 30 && ch(st.rng, 0.1)) {
      const fee = st.age < 50 ? 300 : st.age < 70 ? 500 : 1000;
      p.money -= fee;
      feed(st, pick(st.rng, [`입원했다. 병원비 ${fee}만 원.`, `응급실에 실려갔다. ${fee}만 원.`, `무릎 수술을 했다. ${fee}만 원.`, `정밀검사 입원. ${fee}만 원.`, `재활병원에 입원했다. ${fee}만 원.`] as const), 'bad');
    }
  }
  p.mental = Math.max(0, Math.min(100, p.mental + (55 - p.mental) * 0.08));
  p.network = Math.max(0, Math.min(100, p.network + (40 - p.network) * 0.12));
  if (p.flags['smoke']) p.health = Math.max(0, p.health - 0.3);
  if (p.flags['drink']) p.health = Math.max(0, p.health - 0.2);
}

// ---------- main step ----------
export interface StepOut { choice: PendingChoice | null; reflection: number | null; died: boolean }

// auto 가중랜덤 선택 (중간 선호). ask + App 안전망 공용.
export function autoPickChoice(st: GameState, c: PendingChoice): string {
  const n = c.options.length;
  const ws = c.options.map((_, i) => 1 + Math.min(i, n - 1 - i));
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rnd(st.rng) * total;
  let idx = 0;
  for (let i = 0; i < n; i++) { r -= ws[i]; if (r < 0) { idx = i; break; } idx = i; }
  return c.options[idx].key;
}

// Ask a branch choice. Auto mode resolves immediately (weighted) and returns null to continue.
function ask(st: GameState, c: PendingChoice): StepOut | null {
  if (st.auto) {
    if (c.id === 'cancer') resolveCancer(st, 'std');
    else resolveChoice(st, c.id, autoPickChoice(st, c));
    // chained pending (e.g. car after interview) in auto: resolve immediately too
    let guard = 0;
    while (st.pending && guard++ < 5) {
      const p2 = st.pending;
      st.pending = null;
      if (p2.id === 'cancer') resolveCancer(st, 'std');
      else resolveChoice(st, p2.id, autoPickChoice(st, p2));
    }
    return null;
  }
  st.pending = c;
  return { choice: c, reflection: null, died: false };
}

const EMPTY: StepOut = { choice: null, reflection: null, died: false };

export function stepYear(st: GameState): StepOut {
  const rng = st.rng;
  const p = st.player;
  if (st.over) return { choice: null, reflection: null, died: true };
  st.age += 1;
  const age = st.age;

  for (const m of st.mates) mateTick(st, m, age);
  if (st.condolence) {
    const cd = st.condolence;
    st.condolence = null;
    const r = ask(st, {
      id: 'condole', title: `${cd.name}(${cd.age}세) 사망. 사인: ${cd.cause}. 조문 갈까?`,
      options: [
        { key: 'yes', label: '간다', sub: '부조금 30만, 멘탈 +2' },
        { key: 'no', label: '못 간다', sub: '멘탈 -2' },
      ],
    });
    if (r) return r;
  }
  if (age === 7) formClass(st);

  // 쌍둥이 서사
  if (p.twin && p.alive) {
    if (age === 10) feed(st, '쌍둥이와 같은 반이 됐다. 선생님이 헷갈려한다.');
    if (age === 19) feed(st, pick(rng, ['쌍둥이는 대학에 갔다. 엇갈리기 시작했다.', '쌍둥이는 취업을 택했다.'] as const));
    if (age === 30) feed(st, '쌍둥이가 먼저 결혼했다. 축의금 30만 원을 냈다.');
  }

  // 형제 서사 (외동 포함)
  if (p.sibOlder + p.sibYounger > 0) {
    if (age === 12) feed(st, pick(rng, ['형제와 크게 싸웠다.', '형제와 밤늦게 놀았다.'] as const));
    if (age === 25) feed(st, pick(rng, ['형제가 독립했다.', '형제가 결혼했다. 축의금을 냈다.'] as const));
  } else if (age === 12) feed(st, '외동이라 심심했다. 혼자 놀았다.');

  // 흡연·음주 선택 (20세 1회)
  if (age === 20 && !p.flags['habit']) {
    p.flags['habit'] = true;
    const r = ask(st, {
      id: 'habit', title: '술·담배를 시작할까?',
      options: [
        { key: 'both', label: '둘 다 한다', sub: '건강 -·돈 -·멘탈 +' },
        { key: 'smoke', label: '흡연만 한다', sub: '건강·돈 -' },
        { key: 'drink', label: '음주만 한다', sub: '돈 -·멘탈 +' },
        { key: 'none', label: '둘 다 안 한다', sub: '건강 지킴' },
      ],
    });
    if (r) return r;
  }

  // 반려동물 (25-40세 1회)
  if (age >= 25 && age <= 40 && !p.flags['petAsked'] && ch(rng, 0.3)) {
    p.flags['petAsked'] = true;
    const r = ask(st, {
      id: 'pet', title: '반려동물을 입양할까?',
      options: [
        { key: 'yes', label: '입양한다', sub: '초기 200만 + 연 100만, 멘탈 +' },
        { key: 'no', label: '안 한다', sub: '현상 유지' },
      ],
    });
    if (r) return r;
  }

  // economy first — every year, even choice years
  applyFocus(st);
  decayStats(st);
  // 전세대출 금리 변동 + 주담대 완납 체크
  if (p.dwelling === '전세') {
    const r0 = p.nums['jeonRate'] ?? 4.0;
    const r1 = Math.max(2, Math.min(7, r0 + pick(rng, [-0.5, 0, 0, 0.5] as const)));
    p.nums['jeonRate'] = Math.round(r1 * 100) / 100;
    const hi = p.nums['jeonHi'] ?? 4.0;
    const lo = p.nums['jeonLo'] ?? 4.0;
    if (r1 > hi || r1 < lo) {
      p.nums['jeonHi'] = Math.max(hi, r1);
      p.nums['jeonLo'] = Math.min(lo, r1);
      feed(st, `전세대출 금리가 연 ${r1.toFixed(2)}%로 ${r1 > r0 ? '올랐다' : '내렸다'}. ${r1 > r0 ? '이자 부담이 커졌다' : '숨통이 트였다'}.`);
    }
  }
  if (p.flags['mortgage'] && (p.nums['mortStart'] ?? st.age) + 20 <= st.age) {
    p.flags['mortgage'] = false;
    feed(st, '주담대 완납. 온전한 내 집이다.', 'big');
  }
  yearlyMoney(st);
  flavor(st);

  // death
  if (deathRoll(st)) return { choice: null, reflection: null, died: true };

  // reflection
  if (!st.auto && [5, 15, 30, 50, 70].includes(age)) {
    st.reflect = age;
    return { choice: null, reflection: age, died: false };
  }

  // yearly family/health rolls (매년 실행)
  if (p.spouse && !p.divorced && age >= 30 && ch(rng, RATES.divorceYr)) {
    p.divorced = true; p.spouse = null; p.money -= 1000;
    feed(st, '이혼했다. 위자료·분할로 1000만 원이 나갔다.', 'bad', '통계청 혼인·이혼통계 2024');
  }
  if (age >= 40 && age <= 60 && !p.flags['parent'] && ch(rng, 0.12)) {
    p.flags['parent'] = true;
    p.parentsAlive = false;
    const inherit = [0, 50, 100, 200, 500][p.quintile - 1] * 100;
    const care = ch(rng, RATES.parentCare);
    p.money += inherit - 1000 - (care ? 1200 : 0);
    if (inherit === 0 && !care) feed(st, '부모상. 장례비 1000만 원. 유산은 없었다.');
    else if (inherit === 0) feed(st, '부모상. 생전 간병비 1200만 원, 장례비 1000만 원. 유산은 없었다.');
    else if (care) feed(st, `부모상. 생전 간병비 1200만 원, 장례비 1000만 원, 상속 ${fmtMan(inherit)}.`);
    else feed(st, `부모상. 장례비 1000만 원, 상속 ${fmtMan(inherit)}.`);
  }
  if (age >= 40 && !p.cancer && ch(rng, RATES.cancerDx)) {
    p.cancer = true;
    feed(st, '건강검진에서 암 진단을 받았다.', 'bad');
    const rc = ask(st, {
      id: 'cancer', title: '암 진단을 받았다',
      options: [
        { key: 'full', label: '고액 치료 (5000만)', sub: '생존율 높음' },
        { key: 'std', label: '표준 치료 (2000만)', sub: '보통' },
        { key: 'give', label: '치료 포기', sub: '수명 단축' },
      ],
    });
    if (rc) return rc;
  }
  if (age >= 75 && !p.dementia && ch(rng, RATES.dementia)) {
    p.dementia = true; p.money -= 2000;
    feed(st, '치매 진단. 요양비 2000만 원.', 'bad');
  }

  // 중병 발병 (50세+, 심근경색·뇌졸중. 사망원인 통계 부합)
  if (age >= 50 && !p.flags['majorDone'] && ch(rng, 0.004)) {
    p.flags['majorDone'] = true;
    const dz = pick(rng, ['심근경색', '뇌졸중'] as const);
    p.nums['majorKind'] = dz === '심근경색' ? 1 : 2;
    feed(st, `응급실. ${dz} 진단.`, 'bad');
    const r = ask(st, {
      id: 'major', title: `${dz} 발병`, fact: '50대 이상 심·뇌혈관 사망의 주원인 (통계청 사망원인통계 2024)',
      options: [
        { key: 'op', label: '수술한다 (3000만)', sub: '생존율 높음, 후유증' },
        { key: 'med', label: '약물로 버틴다', sub: '생존율 보통' },
      ],
    });
    if (r) return r;
  }

  // 반려동물 yearly
  if (p.flags['pet'] && !p.flags['petDead']) {
    p.nums['petAge'] = (p.nums['petAge'] ?? 0) + 1;
    p.money -= 100;
    p.mental = Math.min(100, p.mental + 3);
    if ((p.nums['petAge'] ?? 0) >= 15) {
      p.flags['petDead'] = true;
      p.mental = Math.max(0, p.mental - 10);
      feed(st, '콩이가 무지개다리를 건넜다. 15년을 함께했다.', 'bad');
    }
  }

  // 자녀 독립 (첫째 기준 +25)
  const fk2 = p.nums['firstKid'] ?? -1;
  if (fk2 >= 0 && age - fk2 === 25 && !p.flags['kidOut']) {
    p.flags['kidOut'] = true;
    feed(st, '첫째가 분가했다. 빈 둥지가 됐다.');
  }
  const fk = fk2;
  if (fk >= 0 && p.kids > 0) {
    const ka = age - fk;
    if (ka === 19 && !p.flags['kidUni']) {
      p.flags['kidUni'] = true;
      feed(st, pick(rng, ['첫째가 대학에 갔다. 등록금이 나간다.', '첫째가 취업했다. 용돈을 받기 시작했다.'] as const));
    }
    if (ka === 25 && !p.flags['kidMarry']) {
      p.flags['kidMarry'] = true;
      feed(st, '첫째가 결혼했다. 축의금보다 축복을 줬다.');
    }
    if (ka === 27 && !(p.nums['grandkids'] ?? 0)) {
      p.nums['grandkids'] = 1;
      feed(st, '손주가 태어났다. 할아버지·할머니가 됐다.', 'big');
    }
  }

  // school violence
  if (age >= 9 && age <= 18 && !p.flags['hkDone'] && ch(rng, 0.03)) {
    p.flags['hkDone'] = true;
    if (ch(rng, 0.5)) {
      const r = ask(st, {
        id: 'hk', title: '같은 반 아이가 괴롭힘당하고 있다', fact: '학폭 피해 응답률 2.1% (교육부 2024)',
        options: [
          { key: 'report', label: '선생님께 알린다', sub: '멘탈 -5, 인맥 +3' },
          { key: 'ignore', label: '못 본 척한다', sub: '멘탈 -2' },
          { key: 'join', label: '같이 괴롭힌다', sub: '생기부에 기록. 진학·취업 패널티' },
        ],
      });
      if (r) return r;
    } else {
      const r = ask(st, {
        id: 'hkv', title: '괴롭힘을 당하고 있다', fact: '학폭 피해 응답률 2.1% (교육부 2024)',
        options: [
          { key: 'tell', label: '부모·선생님께 알린다', sub: '멘탈 -5, 해결' },
          { key: 'endure', label: '참는다', sub: '멘탈 -12' },
          { key: 'fight', label: '맞선다', sub: '건강 -8, 멘탈 +2' },
        ],
      });
      if (r) return r;
    }
  }

  if (age === 16) {
    const r = ask(st, {
      id: 'hschool', title: '고등학교를 정한다',
      options: [
        { key: 'special', label: '특목고·자사고에 도전한다', sub: '성적 상위 10%만 합격' },
        { key: 'normal', label: '일반고에 진학한다', sub: '무난하다' },
      ],
    });
    if (r) return r;
  }

  if (age === 17) {
    const r = ask(st, {
      id: 'track', title: '문과·이과를 정한다 (고1)',
      options: [
        { key: 'mun', label: '문과', sub: '법·경상·인문 트랙' },
        { key: 'ee', label: '이과', sub: '공대·의약·자연 트랙. 대체복무 가능' },
      ],
    });
    if (r) return r;
  }

  if (age === 18) {
    const orig = gradeBand(p.grade);
    const band = Math.max(1, Math.min(9, orig + (ch(rng, RATES.conditionP) ? (ch(rng, 0.5) ? -1 : 1) : 0)));
    if (band !== orig) feed(st, band < orig ? `수능 당일 컨디션 최상. ${orig}등급 나올 뻔한 걸 ${band}등급으로 막았다.` : `수능 당일 컨디션 난조. ${orig}등급 받을 실력에 ${band}등급.`);
    p.suneung = band;
    feed(st, `수능 ${band}등급.`, 'big', '한국교육과정평가원');
    const r = ask(st, {
      id: 'apply', title: `수능 ${band}등급. 지원 방식을 정한다`,
      options: [
        { key: 'susi', label: '수시로 간다', sub: '성적+운으로 가산' },
        { key: 'jeongsi', label: '정시로 간다', sub: '등급 그대로' },
      ],
    });
    if (r) return r;
  }

  // jaesu before dropout so 재수 gets priority at 19
  if ((age === 19 || age === 20) && p.flags['jaesuOffer'] && !p.flags['jaesuDone']) {
    const r = ask(st, {
      id: 'jaesu', title: age === 19 ? '재수할까?' : '삼수할까?',
      options: [
        { key: 'yes', label: age === 19 ? '재수한다' : '삼수한다', sub: '1년 압축. 30%로 1등급 상승' },
        { key: 'no', label: '현재 등급으로 간다', sub: '바로 진학·취업' },
      ],
    });
    if (r) return r;
  }

  if (age === 19 && p.edu === 'none' && !p.flags['uniDone'] && !p.flags['jaesuOffer']) {
    const r = ask(st, {
      id: 'dropout', title: '대학에 가지 않았다. 앞으로는?',
      options: [
        { key: 'ged', label: '검정고시·취업 준비', sub: '고졸 취업 트랙' },
        { key: 'work', label: '바로 일한다', sub: '돈 +300만' },
      ],
    });
    if (r) return r;
  }

  // military route choice at 20, assignment after
  if (p.sex === 'M' && p.service === 'todo' && age === 20 && !p.flags['milroute']) {
    const canRotc = p.edu === 'sk' || p.edu === 'seoul' || p.edu === 'jgeo';
    const canAlt = p.track === 'ee' && (p.edu === 'sk' || p.edu === 'seoul');
    if (canRotc || canAlt) {
      p.flags['milroute'] = true;
      const opts: ChoiceOpt[] = [];
      if (canRotc) opts.push({ key: 'rotc', label: 'ROTC·학사장교에 지원한다', sub: '3년 복무, 제대 후 취업 가산' });
      if (canAlt) opts.push({ key: 'alt', label: '전문연구요원(대체복무)한다', sub: '연구소 3년, 경력 가산' });
      opts.push({ key: 'normal', label: '일반으로 간다', sub: '현역·보충·면제 추첨' });
      const r = ask(st, { id: 'milroute', title: '병역 루트를 정한다 (20세)', options: opts });
      if (r) return r;
    }
  }
  if (p.sex === 'M' && p.service === 'todo' && age >= 20) {
    const r = rnd(rng);
    if (r < 0.82) { p.service = 'active'; p.serviceLeft = 2; }
    else if (r < 0.94) { p.service = 'supplement'; p.serviceLeft = 3; }
    else { p.service = 'exempt'; feed(st, '병역 면제 판정을 받았다.'); }
    if (p.service === 'active' || p.service === 'supplement') feed(st, `${p.service === 'active' ? '현역 입대' : '보충역 소집'}.`, 'big');
  }
  if ((p.service === 'active' || p.service === 'supplement' || p.service === 'officer') && p.serviceLeft > 0) {
    p.serviceLeft -= 1;
    if (!p.flags['bullyMil'] && ch(rng, 0.25)) {
      p.flags['bullyMil'] = true;
      const r = ask(st, {
        id: 'mil', title: '부대 내 부조리를 목격했다',
        options: [
          { key: 'report', label: '신고한다', sub: '관심병사 리스크. 통과 시 인맥 +5' },
          { key: 'silent', label: '묵인한다', sub: '멘탈 -4' },
        ],
      });
      if (r) return r;
    }
    if (p.serviceLeft === 0) {
      const wasOfficer = p.officer;
      p.service = 'done';
      const saved = wasOfficer ? 4000 : 1500;
      p.money += saved;
      feed(st, `전역. 복무 중 모은 월급 ${saved}만 원.`, undefined, '국방부 2024 (병장 월 125만)');
      feed(st, '전역. 사회로 돌아왔다.', 'big');
      if (p.nco) feed(st, '부사관 경력이 취업에 가산된다.', 'good');
      if (p.officer) feed(st, '장교 경력이 취업에 가산된다.', 'good');
    } else {
      const opts: ChoiceOpt[] = [
        { key: 'hard', label: '열심히 한다', sub: '인맥 +5, 멘탈 -3' },
        { key: 'bear', label: '버틴다', sub: '멘탈 -1' },
      ];
      if (p.service === 'active' && !p.nco) opts.push({ key: 'nco', label: '부사관에 지원한다', sub: '복무 4년으로 연장, 제대 후 경력 가산' });
      const r = ask(st, { id: 'milstyle', title: `복무 중 (${p.serviceLeft}년 남음)`, options: opts });
      if (r) return r;
    }
  }
  if ((p.sex === 'F' || p.service === 'exempt' || p.service === 'none') && (age === 20 || age === 21)) {
    feed(st, pick(rng, ['토익 학원에 등록했다.', '편의점 야간 알바를 시작했다.', '자격증 2개를 땄다.', '배낭여행을 다녀왔다.', '운전면허를 땄다.', '워킹홀리데이를 알아봤다.'] as const));
  }

  // first job & re-employment via interview chain (실명 조직 + 사유 명시)
  if (age >= 22 && !p.job && (p.service === 'done' || p.service === 'exempt' || p.service === 'none') && !p.retired) {
    if (!p.flags['hunting']) {
      p.flags['hunting'] = true;
      p.huntTier = p.edu === 'none' ? 'hs' : p.edu === 'med' ? 'med' : p.edu;
      feed(st, '취업 전선에 뛰어들었다.');
    }
    if (p.flags['gaveup']) {
      if (ch(rng, 0.15)) { p.flags['gaveup'] = false; p.nums['fails'] = 0; feed(st, '다시 이력서를 꺼냈다.'); }
      else { p.money += 150; feed(st, pick(rng, ['단기알바로 버틴다.', '일용직으로 버틴다.'] as const)); }
    } else {
      const r = huntYear(st);
      if (r) return r;
    }
  }

  if (p.job && !p.retired && age >= 40 && age <= 55 && (p.job.tier === 'MID' || p.job.tier === 'PROD') && ch(rng, RATES.layoff)) {
    const r = ask(st, {
      id: 'layoff', title: '권고사직 통보를 받았다',
      options: [
        { key: 'accept', label: '받고 나간다', sub: '위로금 1년치, 실직' },
        { key: 'fight', label: '버틴다', sub: '50% 잔류, 실패 시 즉시 퇴사' },
      ],
    });
    if (r) return r;
  }

  // 이직 (30·42세 창구, 연봉 상승 제안이 올 때만. 창업 성공 후·스펙 미달 제외)
  if (p.job && !p.retired && !p.biz && ((age >= 30 && !p.flags['chg1']) || (age >= 42 && !p.flags['chg2'])) && ch(rng, 0.25)) {
    const tier = p.edu === 'none' ? 'hs' : p.edu === 'med' ? 'med' : p.edu;
    const nj = drawJob(st, tier, 0.1);
    p.flags[age >= 42 ? 'chg2' : 'chg1'] = true;
    const need = MINGRADE[nj?.tier ?? ''] ?? 0;
    if (nj && nj.base * 1.2 > p.salary && p.grade >= need - 10) {
      p.nums['chgJob'] = JOBS.indexOf(nj);
      const r = ask(st, {
        id: 'change', title: `${jobPlace(nj, REGIONS[p.liveIdx])}에서 스카우트 제의`, fact: `제시 연봉 ${Math.round(nj.base).toLocaleString()}만 (현 ${Math.round(p.job.base).toLocaleString()}만)`,
        options: [
          { key: 'go', label: '옮긴다', sub: '연봉 상승, 적응 필요' },
          { key: 'stay', label: '남는다', sub: '현상 유지' },
        ],
      });
      if (r) return r;
    }
  }

  if ((age >= 30 && !p.flags['biz30']) || (age >= 40 && !p.flags['biz40'])) {
    if (p.job && !p.biz && p.money >= RATES.bizSeed) {
      p.flags[age >= 40 ? 'biz40' : 'biz30'] = true;
      const r = ask(st, {
        id: 'biz', title: '창업 제안이 왔다 (종잣돈 500만)',
        options: [
          { key: 'chick', label: '치킨집 차린다', sub: '성공률 5%' },
          { key: 'cafe', label: '카페 차린다', sub: '성공률 5%' },
          { key: 'mall', label: '쇼핑몰 연다', sub: '성공률 5%' },
          { key: 'stay', label: '안정적으로 간다', sub: '현상 유지' },
        ],
      });
      if (r) return r;
    } else if (!p.job || p.money < RATES.bizSeed) {
      p.flags[age >= 40 ? 'biz40' : 'biz30'] = true;
    }
  }
  if (age >= 28 && age <= 45 && !p.biz && !p.flags['partner'] && ch(rng, 0.05)) {
    p.flags['partner'] = true;
    const mate = st.mates.length > 0 ? pick(rng, st.mates).name : '친구';
    const r = ask(st, {
      id: 'partner', title: `${mate}${josa(mate, '이가')} 동업을 제안했다`,
      options: [
        { key: 'chick', label: '치킨집 동업', sub: '성공률 5%' },
        { key: 'cafe', label: '카페 동업', sub: '성공률 5%' },
        { key: 'mall', label: '쇼핑몰 동업', sub: '성공률 5%' },
        { key: 'no', label: '거절한다', sub: '관계 유지' },
      ],
    });
    if (r) return r;
  }

  if (age >= 25 && age <= 35 && !p.flags['coin'] && ch(rng, 0.5)) {
    p.flags['coin'] = true;
    const r = ask(st, {
      id: 'coin', title: '주변에서 코인으로 돈을 벌었다고 한다',
      options: [
        { key: 'in100', label: '100만 원을 넣는다', sub: '소액 테스트' },
        { key: 'in500', label: '500만 원을 넣는다', sub: '80% 폭락, 15% +50%, 5% 5배' },
        { key: 'in1000', label: '1000만 원을 넣는다', sub: '80% 폭락, 15% +50%, 5% 5배' },
        { key: 'in3000', label: '3000만 원을 넣는다', sub: '몰빵' },
        { key: 'out', label: '안 한다', sub: '무소식' },
      ],
    });
    if (r) return r;
  }

  // 연애 시작 (솔로, 22-38세): 소개팅 스펙 공개. 해외 체류 중에도 가능
  if (!p.spouse && !p.partner && age >= 22 && age <= 38 && ch(rng, 0.55)) {
    const cand = st.mates.filter((m) => m.alive && m.sex !== p.sex && !m.married && !m.dating);
    const isClass = ch(rng, 0.10) && cand.length > 0;
    const mate = isClass ? cand[Math.floor(rnd(rng) * cand.length) % cand.length] : null;
    const edu = mate ? (mate.univ || mate.edu || '대학생') : pick(rng, ['서울권 대졸', '지방국립 대졸', '전문대졸', '고졸'] as const);
    const job = mate ? (mate.job || '취준생') : pick(rng, ['사무직', '간호사', '교사', '개발자', '자영업', '공무원'] as const);
    const income = mate ? Math.max(2000, mate.peak) : rint(rng, 2200, 4200);
    p.dateCand = { name: mate ? mate.name : pick(rng, p.sex === 'M' ? FEMALE : MALE), classmate: isClass, yrs: 0, edu, job, income };
    const dcName = p.dateCand.name;
    const r = ask(st, {
      id: 'date', title: isClass ? `같은 반 ${dcName}(${edu}·${job})${josa(dcName, '와과')} 썸 시작` : `${dcName}${josa(dcName, '와과')} 썸 시작 (${edu}·${job})`,
      options: [
        { key: 'yes', label: '사귄다', sub: '교제 시작' },
        { key: 'no', label: '그만둔다', sub: '솔로 유지' },
      ],
    });
    if (r) return r;
  }

  // 교제 중: 매년 1년씩, 이별 6%, 2년차부터 결혼 선택 (형성 틱은 통째로 스킵)
  if (p.partner) {
    if (p.nums['justDated']) { p.nums['justDated'] = 0; }
    else {
    p.partner.yrs += 1;
    if (ch(rng, 0.06)) {
      const ex = p.partner;
      if (ex.classmate) {
        const m = st.mates.find((x) => x.name === ex.name);
        if (m) m.dating = false;
      }
      p.partner = null;
      feed(st, `${ex.name}${josa(ex.name, '와과')} 헤어졌다. ${ex.yrs}년의 연애가 끝났다.`, 'bad');
    } else if (p.partner.yrs >= 2 && age <= 45) {
      const r = ask(st, {
        id: 'marry', title: `${p.partner.name}${josa(p.partner.name, '와과')} ${p.partner.yrs}년째 만나는 중`,
        fact: `${p.partner.edu}·${p.partner.job}`,
        options: [
          { key: 'yes', label: '결혼한다', sub: '비용 1000만. 배우자 스펙 공개' },
          { key: 'wait', label: '계속 만난다', sub: '내년에 다시' },
          { key: 'bye', label: '헤어진다', sub: '정리한다' },
        ],
      });
      if (r) return r;
    } else if (ch(rng, 0.3)) {
      feed(st, pick(rng, [`${p.partner.name}${josa(p.partner.name, '와과')} 한강 데이트.`, `${p.partner.name}${josa(p.partner.name, '와과')} 크게 싸웠다. 화해했다.`, `${p.partner.name} 부모님께 인사드렸다.`] as const));
    }
    }
  }

  // 출산 선택 (기혼, 3명 상한, 42세까지)
  if (p.spouse && !p.divorced && p.kids < 3 && age < 42) {
    const kp = [0.6, 0.25, 0.08][p.kids];
    if (ch(rng, kp)) {
      const r = ask(st, {
        id: 'baby', title: p.kids === 0 ? '아이를 가질까?' : `둘째${p.kids >= 2 ? '·셋째' : ''}를 가질까? (현재 ${p.kids}명)`,
        options: [
          { key: 'yes', label: '갖는다', sub: '양육비 시작' },
          { key: 'no', label: '미룬다', sub: '다음 기회에' },
        ],
      });
      if (r) return r;
    }
  }

  if (age >= 30 && age <= 50 && !p.flags['guar'] && ch(rng, 0.05)) {
    p.flags['guar'] = true;
    const mate0 = st.mates.length > 0 ? pick(rng, st.mates).name : '친구';
    const r0 = ask(st, {
      id: 'guar', title: `${mate0}${josa(mate0, '이가')} 보증을 서달라고 한다`,
      options: [
        { key: 'yes', label: '서준다', sub: '절반 확률로 연봉 2배 빚' },
        { key: 'no', label: '거절한다', sub: '인맥 -3' },
      ],
    });
    if (r0) return r0;
  }

  // 청약: 기혼무주택 자동 시도 (당첨 7%, 탈락하면 전세 루프. 해외 체류 중 제외)
  if (p.spouse && p.dwelling !== '자가' && age >= 30 && !p.flags['abroad']) {
    p.nums['cheongFails'] = p.nums['cheongFails'] ?? 0;
    if (ch(rng, RATES.cheongyakWin)) {
      p.dwelling = '자가';
      p.money += p.deposit; p.deposit = 0;
      const price = Math.round(20000 * REGIONS[p.liveIdx].houseIdx);
      const down = Math.round(price * 0.3);
      p.money -= down;
      p.flags['mortgage'] = true;
      p.nums['mortStart'] = st.age;
      feed(st, `청약 당첨! ${REGIONS[p.liveIdx].name} 자가 마련. 계약금 ${down.toLocaleString()}만 원, 나머지는 주담대.`, 'big');
    } else {
      if (ch(rng, 0.2)) {
        p.nums['cheongFails'] = (p.nums['cheongFails'] ?? 0) + 1;
        feed(st, `청약 탈락. ${p.nums['cheongFails']}번째다. 전세살이 계속.`);
      }
    }
  }

  // 해외이주: 25-40세, 연 30%로 기회 (매년 고정 아님)
  if (age >= 25 && age <= 40 && !p.flags['emig'] && !p.flags['abroad'] && ch(rng, 0.3)) {
    p.flags['emig'] = true;
    const r = ask(st, {
      id: 'emig', title: '해외 취업이민 기회가 왔다',
      options: [
        { key: 'yes', label: '도전한다', sub: '성공률 30%. 성공 시 소득 ×1.3, 생활비 ×1.4' },
        { key: 'no', label: '한국에 남는다', sub: '현상 유지' },
      ],
    });
    if (r) return r;
  }
  if (p.flags['abroad'] && age >= 40 && age <= 55 && !p.flags['backAsked']) {
    p.flags['backAsked'] = true;
    const r = ask(st, {
      id: 'back', title: '귀국할까, 정착할까?',
      options: [
        { key: 'yes', label: '귀국한다', sub: '한국으로 복귀' },
        { key: 'no', label: '정착한다', sub: '해외 생활 계속' },
      ],
    });
    if (r) return r;
  }

  if (!p.star && !p.flags['starTried'] && p.flags['artYrs'] && age >= 16 && age <= 25) {
    p.flags['starTried'] = true;
    if (ch(rng, RATES.starTry)) {
      feed(st, '기획사 오디션에 붙었다. 연습생 생활을 시작한다.', 'big');
      if (ch(rng, RATES.starWin)) {
        p.star = true;
        p.job = JOBS.find((j) => j.tier === 'STAR') ?? p.job;
        p.salary = 50000; p.peak = 50000;
        p.mental = Math.max(0, p.mental - 20);
        feed(st, '데뷔했다. 악플이 쏟아진다. 전성기 연봉 5억.', 'big');
      } else {
        p.flags['artYrs'] = false;
        feed(st, '데뷔조에서 탈락했다. 연습생 생활을 접는다.', 'bad');
      }
    }
  }
  if (p.star && !p.starRetired && age >= 35) {
    p.starRetired = true;
    p.job = JOBS.find((j) => j.role === '카페사장') ?? p.job;
    p.salary = 2600;
    feed(st, '은퇴 후 카페를 열었다.');
  }

  // lotto: 수동 구매 버튼 or 자동구매 토글 (매주 모달 없음).
  // 자동구매 ON이면 조용히 굴리고 1등 때만 사용처를 묻지 않고 예금한다.
  if (age >= 20 && age <= 60 && p.autoLotto && p.money > 0.5) {
    p.money -= 0.5;
    const hit = lottoDraw(st);
    if (hit && hit.tier === 1) lottoWin(st, hit.net, true);
    else if (hit && hit.tier > 1 && hit.tier < 5) {
      p.money += hit.net; p.lottoWon += hit.net; p.peak = Math.max(p.peak, p.salary + hit.net);
      feed(st, `로또 ${hit.tier}등. ${hit.net.toLocaleString()}만 원 수령.`, 'big');
    } else if (hit) feed(st, '로또 5등. 5000원 환급. 본전이다.');
  }

  return EMPTY;
}

function yearlyMoney(st: GameState): void {
  const p = st.player;
  let income = 0;
  if (p.job && !p.retired) {
    if (st.age < 60) p.salary = Math.round(p.salary * (1 + p.job.raise));
    else if (st.age >= 70) p.salary = Math.round(p.salary * 0.99);
    p.workYrs += 1;
    income += p.salary;
    p.peak = Math.max(p.peak, p.salary);
    if (p.job.retire > 0 && st.age >= p.job.retire) {
      p.retired = true;
      const sever = Math.round((p.salary / 12) * Math.min(p.workYrs, 30));
      p.money += sever;
      feed(st, `정년퇴직 (${p.job.retire}세). 퇴직금 ${sever.toLocaleString()}만 원.`);
    }
  }
  if (p.retired && st.age >= 65) income += p.workYrs * 2 * 12; // 국민연금은 65세 개시
  if (p.spouse) income += st.age <= 60 ? Math.round(p.spouse.income * 0.5) : 100;
  if (st.age >= 65 && p.kids > 0) income += p.kids * 300;
  if (p.flags['abroad'] && p.job && !p.retired) income += Math.round(p.salary * 0.3);
  const net = afterTax(Math.max(0, income));
  if (st.age < 20) return; // 미성년: 생활비는 부모 부담, 알바 수입(집중효과)은 용돈으로 유지
  // 실업급여: 실직 후 구직 중 1회 (6개월분 1080만)
  if (!p.job && p.flags['hunting'] && (p.nums['unempPay'] ?? 0) > 0) {
    p.nums['unempPay'] = 0;
    p.money += 1080;
    feed(st, '실업급여 6개월분 1080만 원을 받았다.', 'good');
  }
  if (p.carLoan > 0) p.carLoan -= 1;
  if (p.flags['smoke']) p.money -= 120;
  if (p.flags['drink']) { p.money -= 150; p.mental = Math.min(100, p.mental + 2); }
  const liv = livingCost(st);
  const tut = tutorCost(st);
  let loanPay = 0;
  if (p.loanLeft > 0 && p.loan > 0) {
    loanPay = Math.round((p.loan / 10) * 1.02);
    p.loanLeft -= 1;
    if (p.loanLeft === 0) feed(st, '학자금 상환 완료.');
  }
  const base = liv + tut + loanPay;
  // 한계소비성향: 저소득은 거의 다 쓰고 고소득은 저축 (가계동향 2024 평균소비성향 반영)
  const mpc = MPC[p.quintile - 1];
  const consume = net > base ? base + (net - base) * mpc : Math.max(net, 0);
  p.money += net - consume;
  p.nums['lastIn'] = net;
  p.nums['lastOut'] = Math.round(consume);
  if (p.car !== 'none' && income > 0) {
    const burden = (p.car === 'new' ? 360 : 250) + (p.carLoan > 0 ? 500 : 0);
    const last = p.nums['carpoorAt'] ?? -99;
    if (burden > income * 0.3 && st.age - last >= 5 && ch(st.rng, 0.3)) {
      p.nums['carpoorAt'] = st.age;
      p.mental = Math.max(0, p.mental - 3);
      feed(st, '카푸어다. 차 유지비가 소득의 30%를 넘는다.', 'bad');
    }
  }
  if (income > 0 && st.age < 65 && !p.retired && p.money < -income * RATES.bankruptX && !p.bankrupt) {
    p.bankrupt = true; p.money = 0; p.record = true;
    feed(st, '파산 선고. 빚은 탕감됐지만 기록이 남았다.', 'bad');
  }
}

function deathRoll(st: GameState): boolean {
  const rng = st.rng;
  const p = st.player;
  const age = st.age;
  const mm = p.mental <= 0 ? 5 : p.mental < 30 ? 2 : 1;
  if (age >= 15 && age <= 85 && ch(rng, suicideQ(age, p.sex) * mm)) return die(st, '자살');
  if (age >= 18 && ch(rng, ACCIDENT_Q)) return die(st, pick(rng, ['교통사고', '산재사고', '추락사'] as const));
  if (!p.spouse && p.kids === 0 && age >= 65 && ch(rng, RATES.lonelyPlus)) return die(st, '고독사');
  if (ch(rng, baseQ(age, p.sex))) return die(st, diseaseCause(age, rnd(rng)));
  return false;
}

function die(st: GameState, cause: string): boolean {
  const p = st.player;
  p.alive = false; p.deathAge = st.age; p.cause = cause;
  feed(st, `${st.age}세, 사인: ${cause}. 생을 마쳤다.`, 'death');
  st.over = true;
  st.memorial = p.deathAge < 5;
  finishMates(st);
  computeRank(st);
  return true;
}

function finishMates(st: GameState): void {
  for (const m of st.mates) {
    for (let a = st.age; m.alive && a < 110; a++) {
      if (ch(st.rng, baseQ(a, m.sex) + ACCIDENT_Q + suicideQ(a, m.sex))) {
        m.alive = false; m.deathAge = a; m.cause = diseaseCause(a, rnd(st.rng));
      }
    }
    if (m.alive) m.deathAge = 0;
  }
}

function univRank(u: string): number {
  if (!u || u === '고졸') return 0;
  if (u.includes('의대') || u.includes('의예')) return 100;
  const found = UNIVERSITIES.find((x) => x.name === u);
  if (!found) return 40;
  return found.tier === 'sk' ? 95 : found.tier === 'seoul' ? 80 : found.tier === 'jgeo' ? 60 : found.tier === 'local' ? 45 : 30;
}

function scoreOf(suneung: number, univ: string, peak: number): number {
  const sRank = suneung > 0 ? (10 - suneung) / 9 : 0.3;
  const uRank = univRank(univ) / 100;
  const iRank = Math.min(1, peak / 9000);
  return sRank * 0.3 + uRank * 0.3 + iRank * 0.4;
}

function computeRank(st: GameState): void {
  const p = st.player;
  const all = [{ s: scoreOf(p.suneung, p.univName, p.peak), me: true }];
  for (const m of st.mates) {
    const sg = Math.max(1, Math.min(9, gradeBand(m.score)));
    all.push({ s: scoreOf(sg, m.univ, m.peak), me: false });
  }
  all.sort((a, b) => b.s - a.s);
  st.rank = all.findIndex((x) => x.me) + 1;
  st.rankTotal = all.length;
}

// ---------- choice resolution ----------

// 로또 등급 추첨. 1등만 선택지, 나머지는 즉시 정산.
function lottoDraw(st: GameState): { tier: number; net: number } | null {
  const r = rnd(st.rng);
  if (r < RATES.lottoP) {
    const gross = rint(st.rng, RATES.lottoMin, RATES.lottoMax);
    return { tier: 1, net: Math.round(gross * (1 - RATES.lottoTax)) };
  }
  if (r < RATES.lottoP + 0.0002) return { tier: 2, net: 3000 };
  if (r < RATES.lottoP + 0.0017) return { tier: 3, net: 100 };
  if (r < RATES.lottoP + 0.0097) return { tier: 4, net: 5 };
  if (r < RATES.lottoP + 0.0397) return { tier: 5, net: 0.5 };
  return null;
}

function lottoWin(st: GameState, net: number, silent: boolean): void {
  const p = st.player;
  p.money += net; p.lottoWon += net; p.peak = Math.max(p.peak, p.salary + net);
  if (silent) { p.nums['lottoNet'] = net; return; }
  p.nums['lottoNet'] = net;
  feed(st, `로또 1등. 세후 ${net.toLocaleString()}만 원 수령.`, 'big');
  st.pending = {
    id: 'lottowin', title: `당첨금 ${net.toLocaleString()}만 원을 어떻게 할까?`,
    options: [
      { key: 'debt', label: '빚부터 갚는다', sub: '마음이 놓인다' },
      { key: 'save', label: '예금한다', sub: '안전하게' },
      { key: 'spend', label: '펑펑 쓴다', sub: '3할 증발, 스트레스 해소' },
    ],
  };
}
// 수동 로또 구매 (UI 버튼용). 1~5등 차등.
export function buyLotto(st: GameState): 'win' | 'lose' | 'poor' | 'closed' {
  const p = st.player;
  if (st.over || st.age < 20 || st.age > 60) return 'closed';
  if (p.money < 0.5) return 'poor';
  p.money -= 0.5;
  const hit = lottoDraw(st);
  if (!hit) { feed(st, '로또 낙첨. 5천 원이 증발했다.'); return 'lose'; }
  if (hit.tier === 1) { lottoWin(st, hit.net, false); return 'win'; }
  if (hit.tier === 5) { feed(st, '로또 5등. 5000원 환급. 본전이다.'); return 'lose'; }
  p.money += hit.net; p.lottoWon += hit.net; p.peak = Math.max(p.peak, p.salary + hit.net);
  feed(st, `로또 ${hit.tier}등. ${hit.net.toLocaleString()}만 원 수령.`, 'big');
  return 'win';
}

export function resolveChoice(st: GameState, id: string, key: string): void {
  const rng = st.rng;
  const p = st.player;
  st.pending = null;
  switch (id) {
    case 'hk':
      if (key === 'report') { p.mental = Math.max(0, p.mental - 5); p.network = Math.min(100, p.network + 3); feed(st, '선생님께 알렸다. 괴롭힘이 멈췄다.', 'good'); }
      else if (key === 'ignore') { p.mental = Math.max(0, p.mental - 2); feed(st, '못 본 척했다. 찝찝함이 남았다.'); }
      else { p.record = true; feed(st, '같이 괴롭혔다. 생기부에 기록됐다.', 'bad'); }
      break;
    case 'hkv':
      if (key === 'tell') { p.mental = Math.max(0, p.mental - 5); feed(st, '알렸다. 가해 학생은 전학갔다.', 'good'); }
      else if (key === 'endure') { p.mental = Math.max(0, p.mental - 12); feed(st, '참았다. 밤에 이불을 찼다.', 'bad'); }
      else { p.health = Math.max(0, p.health - 8); p.mental = Math.min(100, p.mental + 2); feed(st, '맞섰다. 코피가 났지만 끝났다.'); }
      break;
    case 'hschool':
      if (key === 'special') {
        if (p.baseGrade >= 88) { p.flags['specialHs'] = true; p.grade = Math.min(100, p.grade + 2); feed(st, '특목고 합격. 기숙사 생활이 시작됐다.', 'good'); }
        else feed(st, '특목고 불합격. 일반고로 진학한다.', 'bad');
      } else feed(st, '일반고에 진학한다.');
      break;
    case 'track':
      p.track = key === 'ee' ? 'ee' : 'mun';
      feed(st, `${key === 'ee' ? '이과' : '문과'}를 선택했다.`);
      break;
    case 'apply': {
      const bonus = key === 'susi' ? (p.grade >= 60 ? 3 : 0) + (p.luck > 70 ? 2 : 0) : 0;
      const g = Math.min(100, p.grade + bonus);
      const tier = tierByGrade(g, p.baseGrade);
      if (tier === 'hs') {
        p.flags['jaesuOffer'] = true;
        feed(st, `수능 ${p.suneung}등급. 대학 진학이 어렵다.`, 'bad');
      } else if (tier === 'med') {
        p.edu = 'med';
        const u = pick(rng, ['서울대', '연세대', '성균관대', '울산대', '가톨릭대', '경북대'] as const);
        p.univName = `${u} 의예과`;
        feed(st, `${p.univName} 합격.`, 'big');
        assignTuition(st, RATES.loanTable.med);
      } else {
        p.edu = tier;
        const u = pickUniv(tier, rnd(rng));
        p.univName = u.name;
        feed(st, `${u.name} 합격 (취업률 ${u.emp}%).`, 'big', '대학알리미 2025(2024 졸업자 기준)');
        assignTuition(st, RATES.loanTable[tier] ?? 1800);
        setResidence(st);
      }
      p.flags['uniDone'] = true;
      break;
    }
    case 'dropout':
      p.flags['uniDone'] = true;
      if (key === 'work') { p.money += 300; feed(st, '바로 일한다. 첫 월급 300만 원.'); }
      else feed(st, '검정고시를 준비한다.');
      break;
    case 'jaesu':
      if (key === 'yes') {
        p.money -= 800;
        if (ch(rng, 0.30)) { p.grade = Math.min(100, p.grade + 12); feed(st, '재수 성공. 성적이 1등급 올랐다.', 'good'); }
        else feed(st, '재수했지만 성적은 그대로다.', 'bad');
        const tier = tierByGrade(p.grade, p.baseGrade);
        if (tier !== 'hs') {
          p.edu = tier;
          p.univName = tier === 'med' ? `${pick(rng, ['서울대', '연세대', '경북대'] as const)} 의예과` : pickUniv(tier, rnd(rng)).name;
          feed(st, `${p.univName}에 진학한다.`, 'big');
          assignTuition(st, RATES.loanTable[tier] ?? 1800);
          setResidence(st);
        }
      } else feed(st, '현재 등급으로 간다. 고졸 취업 트랙.');
      p.flags['jaesuDone'] = true;
      p.flags['uniDone'] = true;
      break;
    case 'milroute':
      if (key === 'rotc') { p.officer = true; p.service = 'officer'; p.serviceLeft = 3; feed(st, '학사장교 합격. 3년 복무한다.', 'big'); }
      else if (key === 'alt') { p.officer = true; p.service = 'officer'; p.serviceLeft = 3; feed(st, '전문연구요원 편입. 연구소에서 3년 복무한다.', 'big'); }
      else feed(st, '일반으로 간다. 추첨을 기다린다.');
      break;
    case 'mil':
      if (key === 'report') {
        if (ch(rng, 0.7)) { p.network = Math.min(100, p.network + 5); feed(st, '신고가 받아들여졌다. 부대가 바뀌었다.', 'good'); }
        else { p.mental = Math.max(0, p.mental - 10); feed(st, '관심병사로 찍혔다. 남은 군생활이 고되다.', 'bad'); }
      } else { p.mental = Math.max(0, p.mental - 4); feed(st, '묵인했다. 양심의 가책이 남았다.'); }
      break;
    case 'milstyle':
      if (key === 'hard') { p.network = Math.min(100, p.network + 5); p.mental = Math.max(0, p.mental - 3); feed(st, '열심히 했다. 간부들이 이름을 안다.'); }
      else if (key === 'bear') { p.mental = Math.max(0, p.mental - 1); feed(st, '버틴다. 말년 소리만 기다린다.'); }
      else { p.nco = true; p.serviceLeft = 4; feed(st, '부사관 지원. 복무가 4년으로 늘었다.'); }
      break;
    case 'change': {
      const ci = p.nums['chgJob'] ?? -1;
      const nj: Job | null = ci >= 0 && ci < JOBS.length ? JOBS[ci] : null;
      if (key === 'go' && nj) {
        p.job = nj; p.jobPlace = jobPlace(nj, REGIONS[p.liveIdx]);
        p.salary = Math.max(p.salary, Math.round(nj.base * 1.2));
        p.peak = Math.max(p.peak, p.salary);
        feed(st, `이직: ${p.jobPlace}. 연봉 인상으로 옮겼다.`, 'big');
      } else feed(st, '현 직장에 남는다.');
      break;
    }
    case 'layoff':
      if (key === 'accept') { p.money += p.salary; p.job = null; p.salary = 0; p.flags['jobDone'] = false; p.nums['unempPay'] = 1; feed(st, '위로금을 받고 나왔다. 실직.', 'bad'); }
      else if (ch(rng, 0.5)) feed(st, '버텼다. 자리는 지켰다.', 'good');
      else { p.job = null; p.salary = 0; p.flags['jobDone'] = false; p.nums['unempPay'] = 1; feed(st, '버티다 잘렸다.', 'bad'); }
      break;
    case 'biz':
    case 'partner': {
      const item = key === 'chick' ? '치킨집사장' : key === 'cafe' ? '카페사장' : key === 'mall' ? '쇼핑몰운영' : '';
      if (item) {
        p.money -= RATES.bizSeed;
        if (ch(rng, RATES.bizWin)) {
          p.biz = true;
          p.job = JOBS.find((j) => j.role === item) ?? p.job;
          p.salary = 15000; p.peak = Math.max(p.peak, 15000);
          feed(st, `대박. ${item} 연 매출이 찍힌다. 전성기 연봉 1.5억.`, 'big');
        } else {
          p.money -= 2000;
          feed(st, id === 'partner'
            ? pick(rng, ['동업자와 싸우고 접었다. 빚 2000만 원.', '동업이 깨졌다. 빚 2000만 원.'] as const)
            : pick(rng, ['망했다. 빚 2000만 원이 남았다.', '가게 문을 닫았다. 빚 2000만 원.', '폐업했다. 빚 2000만 원.'] as const), 'bad');
        }
      } else feed(st, id === 'partner' ? '동업 제안을 거절했다. 안정적으로 간다.' : '창업 제안을 거절했다. 안정적으로 간다.');
      break;
    }
    case 'coin': {
      const stake = key === 'in100' ? 100 : key === 'in500' ? 500 : key === 'in1000' ? 1000 : key === 'in3000' ? 3000 : 0;
      if (stake > 0) {
        p.money -= stake;
        const r = rnd(rng);
        if (r < 0.8) { const left = Math.round(stake * 0.2); p.money += left; feed(st, `코인에 넣은 ${stake}만 원이 ${left}만 원이 됐다. -80% 폭락.`, 'bad'); }
        else if (r < 0.95) { const back = Math.round(stake * 1.5); p.money += back; feed(st, `+50% 수익. ${back}만 원 회수.`, 'good'); }
        else { const back = stake * 5; p.money += back; feed(st, `5배. ${back.toLocaleString()}만 원. 전설이 됐다.`, 'big'); }
      } else {
        const m = rnd(rng);
        if (m < 0.6) feed(st, '그해 코인 시장은 -63% 폭락했다. 안 하길 잘했다.', undefined, '빗썸 2022 언저리');
        else if (m < 0.85) feed(st, '그해 코인 시장은 +120% 폭등했다. 배가 아프다.');
        else feed(st, '그해 코인 시장은 횡보했다. 무소식.');
      }
      break;
    }
    case 'lottowin': {
      const net = p.nums['lottoNet'] ?? 0;
      if (key === 'spend') {
        const use = Math.round(net * 0.3);
        p.money -= use; p.mental = Math.min(100, p.mental + 10);
        feed(st, `펑펑 썼다. ${use.toLocaleString()}만 원 증발. 속이 시원하다.`);
      } else if (key === 'debt') {
        p.mental = Math.min(100, p.mental + 2);
        feed(st, p.money < 0 ? '당첨금으로 빚부터 갚았다. 한숨 돌렸다.' : '빚이 없어 예금했다.', 'good');
      } else feed(st, '당첨금은 예금했다. 통장 숫자가 낯설다.', 'good');
      break;
    }
    case 'date': {
      const dc = p.dateCand;
      p.dateCand = null;
      if (!dc) break;
      if (key === 'yes') {
        p.partner = { name: dc.name, classmate: dc.classmate, yrs: 0, edu: dc.edu, job: dc.job, income: dc.income };
        p.nums['justDated'] = 1;
        if (dc.classmate) {
          const m = st.mates.find((x) => x.name === dc.name);
          if (m) m.dating = true;
          feed(st, `같은 반 ${dc.name}(${dc.edu}·${dc.job})${josa(dc.name, '와과')} 사귀기 시작했다.`, 'big');
        } else feed(st, `${dc.name}${josa(dc.name, '와과')} 사귀기 시작했다. (${dc.edu}·${dc.job})`, 'big');
      } else feed(st, pick(rng, ['썸은 썸으로 끝났다.', '연락이 뜸해졌다. 자연스럽게 멀어졌다.', '고백 타이밍을 놓쳤다.'] as const));
      break;
    }
    case 'marry': {
      if (key === 'bye') {
        const ex = p.partner;
        if (ex?.classmate) {
          const m = st.mates.find((x) => x.name === ex.name);
          if (m) m.dating = false;
        }
        feed(st, ex ? `${ex.name}${josa(ex.name, '와과')} 헤어졌다.` : '헤어졌다.', 'bad');
        p.partner = null;
        break;
      }
      if (key !== 'yes') { feed(st, '계속 만난다.'); break; }
      p.money -= 1000;
      const pt = p.partner;
      if (pt?.classmate) {
        const mate = st.mates.find((x) => x.name === pt.name);
        if (mate) { mate.married = true; mate.spouseClass = true; mate.dating = false; }
        const sage = st.age + (p.sex === 'M' ? -3 : 3);
        p.spouse = { name: pt.name, edu: pt.edu, job: pt.job, income: pt.income, classmate: true, age: sage, marriedAt: st.age };
        feed(st, `같은 반 ${pt.name}(${p.spouse.age}세)${josa(pt.name, '와과')} 결혼했다.`, 'big');
      } else if (pt) {
        const sage2 = st.age + (p.sex === 'M' ? -3 : 3);
        p.spouse = { name: pt.name, edu: pt.edu, job: pt.job, income: pt.income, classmate: false, age: sage2, marriedAt: st.age };
        feed(st, `${pt.name}(${p.spouse.age}세)${josa(pt.name, '와과')} 결혼했다. (${pt.edu}, ${pt.job}, 연봉 ${pt.income}만)`, 'big');
      } else {
        p.spouse = { name: pick(rng, p.sex === 'M' ? FEMALE : MALE), edu: '대졸', job: '사무직', income: 3000, classmate: false, age: st.age + (p.sex === 'M' ? -3 : 3), marriedAt: st.age };
        feed(st, `${p.spouse.name}${josa(p.spouse.name, '와과')} 결혼했다.`, 'big');
      }
      p.partner = null;
      p.dwelling = '전세';
      p.deposit = Math.round(8000 * REGIONS[p.liveIdx].houseIdx);
      p.nums['jeonRate'] = 4.0;
      const down2 = Math.round(p.deposit * 0.2);
      p.money -= down2;
      feed(st, `전세 ${p.deposit.toLocaleString()}만 원에 신혼집을 구했다. 계약금 ${down2.toLocaleString()}만 원 + 전세대출. (${REGIONS[p.liveIdx].name})`);
      break;
    }
    case 'baby':
      if (key === 'yes') {
        p.kids += 1;
        const g: 'M' | 'F' = ch(rng, 0.514) ? 'M' : 'F';
        p.children.push(g);
        const gs = g === 'M' ? '아들' : '딸';
        if (p.kids === 1) p.nums['firstKid'] = st.age;
        p.money -= 300;
        feed(st, p.kids === 1 ? `첫 아이가 태어났다. ${gs}이다. 조리원비 300만 원.` : `둘째도 ${gs}이다. 양육비가 늘었다.`, 'big', '통계청 출생성비 2024 (남아 51.4%)');
      } else feed(st, '아이 계획은 미룬다.');
      break;
    case 'car':
      if (key === 'used') { p.car = 'used'; p.money -= 800; feed(st, '중고차를 샀다. 800만 원. 유지비 연 250만 원.'); }
      else if (key === 'new') { p.car = 'new'; p.carLoan = 5; p.money -= 300; feed(st, '신차 할부. 선수금 300만, 5년 할부 연 500만 + 유지비 연 360만 원.'); }
      else feed(st, '차는 안 산다. 대중교통으로 버틴다.');
      break;
    case 'emig':
      if (key === 'yes') {
        if (ch(rng, 0.30)) {
          p.flags['abroad'] = true;
          feed(st, '해외 취업비자 승인. 소득 ×1.3, 생활비 ×1.4의 삶이 시작됐다.', 'big');
        } else feed(st, '비자 탈락. 국내에 남는다.', 'bad');
      } else feed(st, '해외는 다음 기회에.');
      break;
    case 'back':
      if (key === 'yes') { p.flags['abroad'] = false; feed(st, '귀국했다. 다시 한국 물가로 산다.'); }
      else feed(st, '정착한다. 영주권을 알아본다.');
      break;
    case 'habit':
      if (key === 'both' || key === 'smoke') p.flags['smoke'] = true;
      if (key === 'both' || key === 'drink') p.flags['drink'] = true;
      feed(st, key === 'none' ? '술·담배를 멀리한다.' : '기호품이 생겼다. 지갑은 얇아진다.');
      break;
    case 'pet':
      if (key === 'yes') {
        p.flags['pet'] = true;
        p.nums['petAge'] = 0;
        p.money -= 200;
        feed(st, '강아지를 입양했다. 이름은 콩이다.', 'big');
      } else feed(st, '반려동물은 다음 기회에.');
      break;
    case 'major': {
      const dz = (p.nums['majorKind'] ?? 1) === 1 ? '심근경색' : '뇌졸중';
      if (key === 'op') {
        p.money -= 3000;
        if (ch(rng, 0.85)) { p.health = Math.max(0, p.health - 10); feed(st, `수술 성공. ${dz} 후유증이 남았다.`, 'good'); }
        else { die(st, dz); return; }
      } else {
        if (ch(rng, 0.6)) { p.health = Math.max(0, p.health - 15); feed(st, `약물로 버틴다. ${dz} 후유증이 남았다.`); }
        else { die(st, dz); return; }
      }
      break;
    }
    case 'condole':
      if (key === 'yes') {
        p.money -= 30;
        p.mental = Math.min(100, p.mental + 2);
        feed(st, '조문 다녀왔다. 빈소가 조용했다.', 'good');
      } else {
        p.mental = Math.max(0, p.mental - 2);
        feed(st, '조문을 못 갔다. 마음에 남는다.', 'bad');
      }
      break;
    case 'guar':
      if (key === 'yes') {
        if (ch(rng, 0.5)) { const debt = Math.max(1000, p.salary * 2); p.money -= debt; feed(st, `보증이 터졌다. 빚 ${debt.toLocaleString()}만 원.`, 'bad'); }
        else feed(st, '잘 해결됐다. 우정이 깊어졌다.', 'good');
      } else { p.network = Math.max(0, p.network - 3); feed(st, '거절했다. 서먹해졌다.'); }
      break;
    case 'takeover': {
      const ti = p.nums['tjob'] ?? -1;
      const j: Job | null = ti >= 0 && ti < JOBS.length ? JOBS[ti] : null;
      if (key === 'yes' && j) {
        if (p.money < 2500) { p.nums['takeCool'] = st.age + 3; feed(st, '보증금이 모자라 인수가 무산됐다.', 'bad'); break; }
        p.money -= 2500;
        p.job = j; p.jobPlace = jobLabel(j);
        p.salary = Math.round(j.base * (0.9 + rnd(rng) * 0.2));
        p.peak = Math.max(p.peak, p.salary);
        p.nums['fails'] = 0;
        feed(st, `인수 개업: ${jobLabel(j)}. 목돈으로 시작했다.`, 'big');
        if (p.bankrupt || p.money < 0) {
          feed(st, '차는 꿈도 못 꾼다. 빚부터 갚아야 한다.');
        } else if (!p.flags['carOffered']) {
          p.flags['carOffered'] = true;
          st.pending = {
            id: 'car', title: '첫 월급 기념, 차를 살까?',
            options: [
              { key: 'used', label: '중고차 (800만)', sub: '유지비 연 250만' },
              { key: 'new', label: '신차 할부 (2500만, 5년)', sub: '유지비 연 360만 + 할부 연 500만' },
              { key: 'no', label: '안 산다', sub: '대중교통으로 버틴다' },
            ],
          };
          return;
        }
      } else feed(st, '인수 기회를 패스했다.');
      break;
    }
    case 'interview': {
      const ti = p.nums['tjob'] ?? -1;
      const j: Job | null = ti >= 0 && ti < JOBS.length ? JOBS[ti] : null;
      const place: string = j ? jobPlace(j, REGIONS[p.liveIdx]) : '지원한 곳';
      const prep = key === 'prep';
      const prob = (prep ? 0.35 : 0.15) + p.grade / 400 + (p.network >= 70 ? 0.1 : 0) + (p.luck > 80 ? 0.05 : 0) + (p.nco || p.officer ? 0.1 : 0);
      if (j && ch(rng, prob)) {
        p.job = j; p.jobPlace = place;
        p.salary = Math.round(j.base * (0.9 + rnd(rng) * 0.2));
        p.peak = Math.max(p.peak, p.salary);
        p.nums['fails'] = 0;
        const why: string[] = [];
        if (p.luck >= 85) why.push('운');
        if (p.grade >= 75) why.push(`수능 ${p.suneung}등급`);
        if (p.network >= 70) why.push('지인 추천');
        if (p.nco || p.officer) why.push('군 경력');
        if (p.flags['specialHs']) why.push('특목고');
        if (p.luck >= 80 && p.luck < 85) why.push('운');
        if (why.length === 0) why.push(p.track === 'ee' && j.tier !== 'PROD' ? '이공계 전공' : '체력·인성');
        feed(st, `최종 합격: ${place}. ${why.slice(0, 2).join(' + ')} 덕분이다.`, 'big');
        feed(st, `초임 ${Math.round(afterTax(p.salary)).toLocaleString()}만원(세후).`, undefined, '워크넷 2024 기반 추정치');
        if (ch(rng, 0.35) && !p.spouse && p.liveIdx === p.homeIdx) {
          const others = REGIONS.map((_, i) => i).filter((i) => i !== p.liveIdx);
          p.liveIdx = others[Math.floor(rnd(rng) * others.length) % others.length];
          p.dwelling = '자취';
          p.money -= 300;
          feed(st, `발령지가 ${REGIONS[p.liveIdx].name}이다. 자취를 시작했다. 이사비 300만 원.`, 'big');
        }
        if (p.bankrupt || p.money < 0) {
          feed(st, '차는 꿈도 못 꾼다. 빚부터 갚아야 한다.');
        } else if (!p.flags['carOffered']) {
          p.flags['carOffered'] = true;
          st.pending = {
            id: 'car', title: '첫 월급 기념, 차를 살까?',
            options: [
              { key: 'used', label: '중고차 (800만)', sub: '유지비 연 250만' },
              { key: 'new', label: '신차 할부 (2500만, 5년)', sub: '유지비 연 360만 + 할부 연 500만' },
              { key: 'no', label: '안 산다', sub: '대중교통으로 버틴다' },
            ],
          };
          return;
        }
      } else {
        const f = (p.nums['fails'] ?? 0) + 1;
        p.nums['fails'] = f;
        feed(st, `${place} 면접 탈락. ${f}번째다.`, 'bad');
        downshift(st);
      }
      break;
    }
    default:
      break;
  }
}

export function resolveCancer(st: GameState, key: string): void {
  const p = st.player;
  const rng = st.rng;
  st.pending = null;
  if (key === 'full') { p.money -= 5000; if (ch(rng, 0.85)) { p.cancer = false; feed(st, '관해. 살았다.', 'good'); } else feed(st, '치료에도 암이 남았다.', 'bad'); }
  else if (key === 'std') { p.money -= 2000; if (ch(rng, 0.6)) { p.cancer = false; feed(st, '관해. 살았다.', 'good'); } else feed(st, '재발했다.', 'bad'); }
  else { p.health = Math.max(0, p.health - 30); feed(st, '치료를 포기했다.'); }
}
