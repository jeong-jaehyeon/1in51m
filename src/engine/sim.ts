// 5100만분의 1 — simulation engine.
// Locked balance (planning sims N=10k): lotto yearly attempt p=0.014% (20-60),
// star 예체능-only try 10% x win 5%, suicide stats x mental mult, life table pure,
// marriage 78%, divorce 0.5%/yr, med cutoff grade>=95, recalibration targets:
// q5 top 15%, q1 2% (builder: verify against real 2024 tables).

import { REGIONS, FAMILIES, RATES, QUINTILE_START, afterTax } from '../data/lookup';
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
export interface ChoiceOpt { key: string; label: string; sub?: string }
export interface PendingChoice { id: string; title: string; fact?: string; options: ChoiceOpt[] }

export type FocusId = 'study' | 'sport' | 'work' | 'network' | 'rest' | 'art' | 'love' | 'gamble';

export interface Spouse { name: string; edu: string; job: string; income: number; classmate: boolean }

export interface Player {
  name: string; sex: Sex; seed: number;
  regionIdx: number; quintile: number; familyId: string; familyNote: string;
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
  spouse: Spouse | null; kids: number; divorced: boolean;
  house: 'none' | 'jeonse' | 'own';
  loan: number; loanLeft: number;
  cancer: boolean; dementia: boolean; star: boolean; starRetired: boolean; biz: boolean;
  alive: boolean; deathAge: number; cause: string;
  lottoWon: number;
  journal: Record<number, string>;
  log: FeedItem[];
  flags: Record<string, boolean>;
}

export interface Mate {
  name: string; sex: Sex; seed: number;
  q: number; score: number;
  alive: boolean; deathAge: number; cause: string;
  edu: string; univ: string; job: string; peak: number;
  married: boolean; kids: number; spouseClass: boolean;
}

export interface GameState {
  v: 1; seed: number; rng: RngS;
  age: number; birthYear: number;
  player: Player; mates: Mate[];
  over: boolean; memorial: boolean;
  pending: PendingChoice | null;
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
  const quintile = Math.floor(rnd(rng) * 5) + 1;
  const fam = pickW(rng, FAMILIES.map((f) => [f, f.w] as const));
  const twin = ch(rng, RATES.twin);
  const luck = rint(rng, 1, 100);
  const grade = Math.max(0, Math.min(100, gauss(rng, 30 + quintile * 9, 15)));
  const st: GameState = {
    v: 1, seed, rng, age: 0, birthYear: 2026,
    player: {
      name, sex, seed: rint(rng, 1, 1e9),
      regionIdx, quintile, familyId: fam.id, familyNote: fam.note,
      twin, luck,
      health: rint(rng, 70, 95), mental: 70 + fam.mental, network: 50, grade,
      baseGrade: grade, studyYrs: 0,
      money: QUINTILE_START[quintile - 1] + fam.money,
      focus: 'study',
      edu: 'none', univName: '', track: '', suneung: 0,
      record: false, bankrupt: false,
      job: null, salary: 0, peak: 0, workYrs: 0, retired: false,
      service: sex === 'M' ? 'todo' : 'none', serviceLeft: 0, nco: false, officer: false,
      spouse: null, kids: 0, divorced: false,
      house: 'none', loan: 0, loanLeft: 0,
      cancer: false, dementia: false, star: false, starRetired: false, biz: false,
      alive: true, deathAge: 0, cause: '',
      lottoWon: 0, journal: {}, log: [], flags: {},
    },
    mates: [], over: false, memorial: false,
    pending: null, reflect: null, auto: false, speed: 1, rank: 0, rankTotal: 15,
  };
  const p = st.player;
  const region = REGIONS[regionIdx];
  feed(st, `${p.name} 탄생. ${region.name}, ${fam.name}${twin ? ', 쌍둥이' : ''}. ${sex === 'M' ? '남아' : '여아'}.`, 'big');
  feed(st, '같은 해 한국 출생아 약 23만 8천 명 중 1명.', undefined, '통계청 인구동향 2024');
  if (ch(rng, RATES.infantDeath)) {
    p.alive = false; p.deathAge = 0; p.cause = pick(rng, ['선천성 질환', '신생아 폐렴'] as const);
    feed(st, `생후 4개월, ${p.cause}로 세상을 떠났다.`, 'death');
    st.over = true; st.memorial = true;
    return st;
  }
  feed(st, '산모·신생아 건강. 분유값이 월 18만 원씩 나간다.');
  return st;
}

// ---------- classmates (formed at age 7) ----------
function formClass(st: GameState): void {
  const rng = st.rng;
  const poolM = MALE.filter((n) => n !== st.player.name);
  const poolF = FEMALE.filter((n) => n !== st.player.name);
  const names: string[] = [];
  for (let i = 0; i < 7; i++) names.push(poolM.splice(Math.floor(rnd(rng) * poolM.length), 1)[0]);
  for (let i = 0; i < 7; i++) names.push(poolF.splice(Math.floor(rnd(rng) * poolF.length), 1)[0]);
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
      edu: '', univ: '', job: '', peak: 0, married: false, kids: 0, spouseClass: false,
    } satisfies Mate;
  });
  feed(st, '초등학교 입학. 같은 반 15명이 모였다. 앞으로 70년을 같이 산다.', 'big');
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

function drawJob(st: GameState, tier: SimTier | 'hs', bonus: number): Job | null {
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
    if (age < 50 || m.cause === '자살') feed(st, `${m.name}(${age}세) 사망. 사인: ${m.cause}.`, 'friend');
    return;
  }
  if (age >= 15 && age <= 85 && ch(rng, suicideQ(age, m.sex))) {
    m.alive = false; m.deathAge = age; m.cause = '자살';
    feed(st, `${m.name}(${age}세) 사망. 사인: 자살.`, 'friend');
    return;
  }
  if (age === 19) {
    const tier = tierByGrade(m.score, m.score);
    m.edu = tier === 'hs' ? '고졸' : tier === 'med' ? pick(rng, ['서울대의대', '연세의대', '지방의대'] as const) : pickUniv(tier, rnd(rng)).name;
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
  if (!m.married && age >= 26 && age <= 42 && ch(rng, 0.10)) {
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
      const earn = st.age * 10;
      p.money += earn; p.mental = Math.max(0, p.mental - 1);
      if (st.age >= 14) feed(st, `알바로 ${earn}만 원 벌었다.`);
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

const PHASE_FLAVOR: Array<[number, number, string[]]> = [
  [1, 6, ['이앓이를 한다. 밤에 세 번 깬다.', '첫돌. 돌잡이에서 {pick}를 잡았다.', '말문이 트였다. “엄마”가 먼저다.', '어린이집 대기번호가 {n}번이다.', '예방접종 날. 엉엉 울었다가 사탕 하나로 그쳤다.']],
  [7, 12, ['받아쓰기 100점. 냉장고에 붙었다.', '운동회 계주에서 넘어졌다. 무릎이 까졌다.', '같은 반 {mate}와 절교했다가 다음 날 화해했다.', '학원 셔틀버스에서 꾸벅 졸았다.', '생일 파티에 {mate}가 왔다.']],
  [13, 15, ['사춘기. 방문을 닫고 산다.', '첫 시험에서 반 평균을 넘겼다.', '좋아하는 연예인 사진을 책상에 붙였다.', '{mate}와 같은 고등학교를 가고 싶다고 했다.', '밤 12시, 수학 오답노트를 펼쳤다.']],
  [16, 18, ['모의고사 성적표가 왔다.', '야자 시간에 꾸벅 졸다 걸렸다.', '급식 빵이 맛있다는 소문이 났다.', '수능 D-{n}. 책상 앞에 붙였다.']],
  [20, 29, ['취업 포털에 이력서를 올렸다.', '면접에서 떨어졌다. 세 번째다.', '월급날. 통장을 세 번 확인했다.', '친구 결혼식에 축의금 10만 원을 냈다.', '자격증 시험에 또 떨어졌다.']],
  [30, 49, ['아이 운동회 날 반차를 썼다.', '건강검진에서 콜레스테롤 경고를 받았다.', '부모님께 용돈을 보내드렸다.', '회식 2차에서 노래를 불렀다.', '월급은 그대로인데 물가는 올랐다.']],
  [50, 64, ['무릎이 시큰거린다.', '후배가 팀장이 됐다.', '자녀 등록금 고지서가 왔다.', '동창회에 나갔다. 반은 약을 먹는다고 했다.']],
  [65, 200, ['공원에서 바둑을 뒀다.', '병원 정기검진 날이다.', '손주 사진을 받았다.', '옛날 노래를 흥얼거렸다.']],
];

function flavor(st: GameState): void {
  const band = PHASE_FLAVOR.find(([a, b]) => st.age >= a && st.age <= b);
  if (!band || !ch(st.rng, 0.7)) return;
  let t = pick(st.rng, band[2]);
  const mate = st.mates.length > 0 && ch(st.rng, 0.4) ? pick(st.rng, st.mates).name : '친구';
  t = t.replace('{mate}', mate)
    .replace('{pick}', pick(st.rng, ['공', '마이크', '청진기', '돈'] as const))
    .replace('{n}', String(rint(st.rng, 3, 200)));
  feed(st, t);
}

function livingCost(st: GameState): number {
  const p = st.player;
  return Math.round(1800 * REGIONS[p.regionIdx].costIdx + p.kids * 800 + (p.house === 'jeonse' ? 200 : 0));
}

function tutorCost(st: GameState): number {
  const p = st.player;
  if (p.kids === 0 || st.age > 60) return 0;
  return Math.round(144 * REGIONS[p.regionIdx].tutorIdx * (0.5 + p.quintile * 0.2) * p.kids);
}

// ---------- main step ----------
export interface StepOut { choice: PendingChoice | null; reflection: number | null; died: boolean }

// Ask a branch choice. Auto mode resolves immediately (weighted) and returns null to continue.
function ask(st: GameState, c: PendingChoice): StepOut | null {
  if (st.auto) {
    if (c.id === 'lotto') {
      resolveChoice(st, 'lotto', st.player.money > 0.5 ? 'buy' : 'skip');
      return null;
    }
    const n = c.options.length;
    const ws = c.options.map((_, i) => 1 + Math.min(i, n - 1 - i));
    const total = ws.reduce((a, b) => a + b, 0);
    let r = rnd(st.rng) * total;
    let idx = 0;
    for (let i = 0; i < n; i++) { r -= ws[i]; if (r < 0) { idx = i; break; } idx = i; }
    if (c.id === 'cancer') resolveCancer(st, 'std');
    else resolveChoice(st, c.id, c.options[idx].key);
    // chained pending (e.g. cancer) in auto: resolve immediately too
    if (st.pending && st.auto) {
      const p2 = st.pending;
      st.pending = null;
      if (p2.id === 'cancer') resolveCancer(st, 'std');
      else resolveChoice(st, p2.id, p2.options[Math.floor(p2.options.length / 2)].key);
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
  if (age === 7) formClass(st);

  // economy first — every year, even choice years
  applyFocus(st);
  yearlyMoney(st);
  flavor(st);

  // death
  if (deathRoll(st)) return { choice: null, reflection: null, died: true };

  // reflection
  if (!st.auto && [5, 15, 30, 50, 70].includes(age)) {
    st.reflect = age;
    return { choice: null, reflection: age, died: false };
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
    const band = Math.max(1, Math.min(9, gradeBand(p.grade) + (ch(rng, RATES.conditionP) ? (ch(rng, 0.5) ? -1 : 1) : 0)));
    if (band !== gradeBand(p.grade)) feed(st, `수능 당일 컨디션 ${band < gradeBand(p.grade) ? '최상' : '난조'}.`);
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
      p.service = 'done';
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
    feed(st, pick(rng, ['토익 학원에 등록했다.', '편의점 야간 알바를 시작했다.', '자격증 2개를 땄다.', '배낭여행을 다녀왔다.'] as const));
  }

  // first job
  if (age >= 22 && !p.job && p.service !== 'active' && p.service !== 'supplement' && p.service !== 'officer' && !p.flags['jobDone']) {
    p.flags['jobDone'] = true;
    const tier: SimTier | 'hs' = p.edu === 'none' ? 'hs' : p.edu === 'med' ? 'med' : p.edu;
    const bonus = (p.nco || p.officer ? 0.25 : 0) + (p.network >= 70 ? 0.15 : 0);
    const job = drawJob(st, tier, bonus);
    if (!job) {
      p.flags['unemployed'] = true;
      feed(st, '취업에 실패했다. 취준생 신분으로 버틴다.', 'bad');
    } else {
      p.job = job;
      p.salary = Math.round(job.base * (0.9 + rnd(rng) * 0.2));
      p.peak = p.salary;
      feed(st, `첫 취업: ${jobLabel(job)}. 초임 ${Math.round(afterTax(p.salary)).toLocaleString()}만원(세후).`, 'big', '워크넷 2024 기반 추정치');
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

  if ((age >= 30 && !p.flags['biz30']) || (age >= 40 && !p.flags['biz40'])) {
    if (p.job && !p.biz && p.money >= RATES.bizSeed) {
      p.flags[age >= 40 ? 'biz40' : 'biz30'] = true;
      const r = ask(st, {
        id: 'biz', title: '창업 제안이 왔다 (종잣돈 500만)',
        options: [
          { key: 'go', label: '창업한다', sub: '성공률 5%. 성공 시 대박, 실패 시 빚' },
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
      id: 'partner', title: `${mate}가 동업을 제안했다`,
      options: [
        { key: 'go', label: '같이 한다', sub: '성공률 5%' },
        { key: 'no', label: '거절한다', sub: '관계 유지' },
      ],
    });
    if (r) return r;
  }

  if (age >= 25 && age <= 40 && !p.flags['coin']) {
    p.flags['coin'] = true;
    const r = ask(st, {
      id: 'coin', title: '주변에서 코인으로 돈을 벌었다고 한다',
      options: [
        { key: 'in', label: '1000만 원을 넣는다', sub: '80% 폭락, 15% +50%, 5% 5배' },
        { key: 'out', label: '안 한다', sub: '무소식' },
      ],
    });
    if (r) return r;
  }

  if (!p.spouse && !p.divorced && age >= 26 && age <= 40 && ch(rng, 0.10)) {
    const r = ask(st, {
      id: 'marry', title: '결혼 이야기가 오간다',
      options: [
        { key: 'yes', label: '결혼한다', sub: '비용 1500만. 배우자 스펙 공개' },
        { key: 'later', label: '아직은', sub: '다음 기회에' },
      ],
    });
    if (r) return r;
  }

  if (age >= 30 && age <= 50 && !p.flags['guar'] && ch(rng, 0.05)) {
    p.flags['guar'] = true;
    const mate = st.mates.length > 0 ? pick(rng, st.mates).name : '친구';
    const r = ask(st, {
      id: 'guar', title: `${mate}가 보증을 서달라고 한다`,
      options: [
        { key: 'yes', label: '서준다', sub: '절반 확률로 연봉 2배 빚' },
        { key: 'no', label: '거절한다', sub: '인맥 -3' },
      ],
    });
    if (r) return r;
  }

  if (!p.star && p.flags['artYrs'] && age >= 16 && age <= 25 && ch(rng, RATES.starTry)) {
    if (ch(rng, RATES.starWin)) {
      p.star = true;
      p.job = JOBS.find((j) => j.tier === 'STAR') ?? p.job;
      p.salary = 50000; p.peak = 50000;
      p.mental = Math.max(0, p.mental - 20);
      feed(st, '데뷔했다. 악플이 쏟아진다. 전성기 연봉 5억.', 'big');
    } else {
      p.flags['artYrs'] = false;
      feed(st, '오디션에서 떨어졌다. 연습생 생활을 접는다.', 'bad');
    }
  }
  if (p.star && !p.starRetired && age >= 35) {
    p.starRetired = true;
    p.job = JOBS.find((j) => j.role === '카페사장') ?? p.job;
    p.salary = 2600;
    feed(st, '은퇴 후 카페를 열었다.');
  }

  if (age >= 20 && age <= 60) {
    const r = ask(st, {
      id: 'lotto', title: '이번 주 로또를 살까? (5천 원)',
      options: [
        { key: 'buy', label: '산다', sub: '당첨 확률 0.014%. 4~20억, 세금 33%' },
        { key: 'skip', label: '안 산다', sub: '5천 원 세이브' },
      ],
    });
    if (r) return r;
  }

  return EMPTY;
}

function yearlyMoney(st: GameState): void {
  const p = st.player;
  let income = 0;
  if (p.job && !p.retired) {
    p.salary = Math.round(p.salary * (1 + p.job.raise));
    p.workYrs += 1;
    income += p.salary;
    p.peak = Math.max(p.peak, p.salary);
    if (p.job.retire > 0 && st.age >= p.job.retire) {
      p.retired = true;
      feed(st, `정년퇴직 (${p.job.retire}세).`);
    }
  }
  if (p.retired) income += p.workYrs * 2 * 12;
  if (p.spouse) income += st.age <= 60 ? Math.round(p.spouse.income * 0.5) : 100;
  if (st.age >= 65 && p.kids > 0) income += p.kids * 300;
  const net = afterTax(Math.max(0, income));
  if (st.age < 20) return; // 미성년: 생활비는 부모 부담, 알바 수입(집중효과)은 용돈으로 유지
  p.money += net - livingCost(st) - tutorCost(st);
  if (p.loanLeft > 0 && p.loan > 0) {
    const pay = Math.round((p.loan / 10) * 1.02);
    p.money -= pay; p.loanLeft -= 1;
    if (p.loanLeft === 0) feed(st, '학자금 상환 완료.');
  }
  if (income > 0 && p.money < -income * RATES.bankruptX && !p.bankrupt) {
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
        p.loan = RATES.loanTable.med; p.loanLeft = 10;
        feed(st, `${p.univName} 합격. 등록금 대출 ${RATES.loanTable.med}만 원.`, 'big');
      } else {
        p.edu = tier;
        const u = pickUniv(tier, rnd(rng));
        p.univName = u.name;
        p.loan = RATES.loanTable[tier] ?? 1800; p.loanLeft = 10;
        feed(st, `${u.name} 합격 (취업률 ${u.emp}%). 등록금 대출 ${p.loan}만 원.`, 'big', '대학알리미 2025(2024 졸업자 기준)');
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
          p.loan = RATES.loanTable[tier] ?? 1800; p.loanLeft = 10;
          feed(st, `${p.univName}에 진학한다.`, 'big');
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
    case 'layoff':
      if (key === 'accept') { p.money += p.salary; p.job = null; p.salary = 0; p.flags['jobDone'] = false; feed(st, '위로금을 받고 나왔다. 실직.', 'bad'); }
      else if (ch(rng, 0.5)) feed(st, '버텼다. 자리는 지켰다.', 'good');
      else { p.job = null; p.salary = 0; p.flags['jobDone'] = false; feed(st, '버티다 잘렸다.', 'bad'); }
      break;
    case 'biz':
    case 'partner': {
      if (key === 'go') {
        p.money -= RATES.bizSeed;
        if (ch(rng, RATES.bizWin)) {
          p.biz = true;
          p.job = JOBS.find((j) => j.role === '쇼핑몰운영') ?? p.job;
          p.salary = 15000; p.peak = Math.max(p.peak, 15000);
          feed(st, '대박. 연 매출이 찍힌다. 전성기 연봉 1.5억.', 'big');
        } else { p.money -= 2000; feed(st, '망했다. 빚 2000만 원이 남았다.', 'bad'); }
      } else feed(st, '안정적으로 간다.');
      break;
    }
    case 'coin':
      if (key === 'in') {
        p.money -= 1000;
        const r = rnd(rng);
        if (r < 0.8) feed(st, '폭락. 800만 원이 증발했다.', 'bad');
        else if (r < 0.95) { p.money += 1500; feed(st, '50% 수익. 1500만 원 회수.', 'good'); }
        else { p.money += 5000; feed(st, '5배. 5000만 원. 전설이 됐다.', 'big'); }
      } else feed(st, '코인은 안 한다. 무소식.');
      break;
    case 'marry': {
      if (key === 'yes') {
        p.money -= 1500;
        const cand = st.mates.filter((m) => m.alive && m.sex !== p.sex && !m.married);
        const isClass = ch(rng, RATES.classmateMarry) && cand.length > 0;
        if (isClass) {
          const mate = cand[Math.floor(rnd(rng) * cand.length) % cand.length];
          mate.married = true; mate.spouseClass = true;
          p.spouse = { name: mate.name, edu: mate.edu || '대졸', job: mate.job || '직장인', income: Math.max(2000, mate.peak), classmate: true };
          feed(st, `같은 반 ${mate.name}와 결혼했다.`, 'big');
        } else {
          const edu = pick(rng, ['서울권 대졸', '지방국립 대졸', '전문대졸', '고졸'] as const);
          const job = pick(rng, ['사무직', '간호사', '교사', '개발자', '자영업', '공무원'] as const);
          p.spouse = { name: pick(rng, p.sex === 'M' ? FEMALE : MALE), edu, job, income: rint(rng, 2200, 4200), classmate: false };
          feed(st, `${p.spouse.name}(${p.spouse.edu}, ${p.spouse.job}, 연봉 ${p.spouse.income}만)와 결혼했다.`, 'big');
        }
        if (ch(rng, 0.85)) {
          p.kids = 1 + (ch(rng, RATES.kids2) ? 1 : 0) + (ch(rng, RATES.kids3) ? 1 : 0);
          feed(st, `자녀 ${p.kids}명. 분유값·학원비가 시작됐다.`);
        }
      } else feed(st, '아직은. 다음 기회에.');
      break;
    }
    case 'guar':
      if (key === 'yes') {
        if (ch(rng, 0.5)) { const debt = Math.max(1000, p.salary * 2); p.money -= debt; feed(st, `보증이 터졌다. 빚 ${debt.toLocaleString()}만 원.`, 'bad'); }
        else feed(st, '잘 해결됐다. 우정이 깊어졌다.', 'good');
      } else { p.network = Math.max(0, p.network - 3); feed(st, '거절했다. 서먹해졌다.'); }
      break;
    case 'lotto':
      if (key === 'buy') {
        p.money -= 0.5;
        if (ch(rng, RATES.lottoP)) {
          const gross = rint(rng, RATES.lottoMin, RATES.lottoMax);
          const net = Math.round(gross * (1 - RATES.lottoTax));
          p.money += net; p.lottoWon += net; p.peak = Math.max(p.peak, p.salary + net);
          feed(st, `로또 1등. 세후 ${net.toLocaleString()}만 원 수령.`, 'big');
        }
      }
      break;
    default:
      break;
  }
  if (p.spouse && !p.divorced && st.age >= 30 && ch(rng, RATES.divorceYr)) {
    p.divorced = true; p.spouse = null; p.money -= 1000;
    feed(st, '이혼했다. 위자료·분할로 1000만 원이 나갔다.', 'bad', '통계청 혼인·이혼통계 2024');
  }
  if (st.age >= 40 && st.age <= 60 && !p.flags['parent'] && ch(rng, 0.12)) {
    p.flags['parent'] = true;
    const inherit = [0, 50, 100, 200, 500][p.quintile - 1] * 100;
    p.money += inherit - 1000;
    feed(st, `부모상. 장례비 1000만 원, 상속 ${inherit.toLocaleString()}만 원.`);
    if (ch(rng, RATES.parentCare)) { p.money -= 1200; feed(st, '간병비 1200만 원이 나갔다.'); }
  }
  if (st.age >= 40 && !p.cancer && ch(rng, RATES.cancerDx)) {
    p.cancer = true;
    st.pending = {
      id: 'cancer', title: '암 진단을 받았다',
      options: [
        { key: 'full', label: '고액 치료 (5000만)', sub: '생존율 높음' },
        { key: 'std', label: '표준 치료 (2000만)', sub: '보통' },
        { key: 'give', label: '치료 포기', sub: '수명 단축' },
      ],
    };
  }
  if (st.age >= 75 && !p.dementia && ch(rng, RATES.dementia)) {
    p.dementia = true; p.money -= 2000;
    feed(st, '치매 진단. 요양비 2000만 원.', 'bad');
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
