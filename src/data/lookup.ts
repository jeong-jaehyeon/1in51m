// Static lookup data: regions, family types, focus areas, rates.
// Monetary unit: 만원 (KRW 10k). Sources labeled 2024-available; see texts.ts SOURCES.

export interface Region {
  id: string;
  name: string;
  birthW: number; // share of annual births (2024 추계 근사)
  costIdx: number; // living-cost multiplier
  tutorIdx: number; // private-education multiplier
  houseIdx: number; // housing price multiplier (self-owned home target)
}

export const REGIONS: Region[] = [
  { id: 'gangnam', name: '서울 강남3구', birthW: 5, costIdx: 1.45, tutorIdx: 2.1, houseIdx: 3.2 },
  { id: 'seoulN', name: '서울 강북·기타', birthW: 8, costIdx: 1.2, tutorIdx: 1.4, houseIdx: 2.0 },
  { id: 'gyeongS', name: '경기 남부·신도시', birthW: 17, costIdx: 1.1, tutorIdx: 1.3, houseIdx: 1.6 },
  { id: 'gyeongN', name: '경기 북부·외곽', birthW: 10, costIdx: 0.95, tutorIdx: 0.9, houseIdx: 1.0 },
  { id: 'metro', name: '광역시', birthW: 19, costIdx: 0.9, tutorIdx: 0.9, houseIdx: 0.9 },
  { id: 'midcity', name: '지방 중소도시', birthW: 21, costIdx: 0.85, tutorIdx: 0.7, houseIdx: 0.6 },
  { id: 'rural', name: '농어촌', birthW: 12, costIdx: 0.8, tutorIdx: 0.4, houseIdx: 0.35 },
  { id: 'sejong', name: '세종·제주', birthW: 8, costIdx: 0.9, tutorIdx: 0.8, houseIdx: 0.8 },
];

export interface FamilyType { id: string; name: string; w: number; money: number; mental: number; note: string }

export const FAMILIES: FamilyType[] = [
  { id: 'both', name: '맞벌이 양부모', w: 62, money: 0, mental: 0, note: '평범한 시작' },
  { id: 'single', name: '외벌이 양부모', w: 16, money: -400, mental: 0, note: '빠듯한 시작' },
  { id: 'oneparent', name: '한부모 가정', w: 11, money: -900, mental: -6, note: '가장이 일찍 철든다' },
  { id: 'grand', name: '조손 가정', w: 4, money: -1200, mental: -8, note: '할머니 손에서 자란다' },
  { id: 'multi', name: '다문화 가정', w: 5, money: -600, mental: -4, note: '두 개의 말이 집에 있다' },
  { id: 'care', name: '보육원', w: 2, money: -1800, mental: -14, note: '시설에서 자란다. 퇴소 후 자립' },
];

export interface Focus { id: string; name: string; desc: string }

export const FOCI: Focus[] = [
  { id: 'study', name: '공부', desc: '성적 +4, 건강 -1' },
  { id: 'sport', name: '운동', desc: '건강 +4, 성적 -1' },
  { id: 'work', name: '알바·돈', desc: '돈 + (나이×10만), 멘탈 -1' },
  { id: 'network', name: '인맥', desc: '인맥 +4' },
  { id: 'rest', name: '휴식', desc: '멘탈 +5, 건강 +1' },
  { id: 'art', name: '예체능', desc: '스타 도전권. 성적 -2' },
  { id: 'love', name: '연애', desc: '멘탈 +3, 인맥 +1' },
  { id: 'gamble', name: '도박', desc: '위험. 잃거나 따거나' },
];

// Locked balance rates (see planning sims; recalibration targets in sim.ts header)
export const RATES = {
  tickMs: 15000,
  infantDeath: 0.0025,
  twin: 0.015,
  maleBirth: 0.514,
  lottoP: 0.00014, // yearly attempt -> ~0.7% lifetime
  lottoMin: 40000, lottoMax: 200000, lottoTax: 0.33,
  starTry: 0.10, starWin: 0.05,
  suicideBase: 0.00025, // ages 20-70, x mental multiplier
  accident: 0.0004,
  divorceYr: 0.005,
  marryP: 0.78, // lifetime target
  classmateMarry: 0.10,
  kids2: 0.40, kids3: 0.08,
  moveSchool: 0.08,
  jaesu: 0.30,
  conditionP: 0.20,
  cheongyakWin: 0.07,
  bizSeed: 500, bizWin: 0.05,
  guarantee: 0.05,
  jobChange: 0.40,
  coinJoin: 0.20,
  layoff: 0.02, // 40s+
  parentCare: 0.40,
  cancerDx: 0.003, // 40+
  dementia: 0.10, // 75+
  lonelyPlus: 0.03, // solitary 65+
  bankruptX: 3, // debt > 3x income
  tutorBase: 12, // 만원/month base x region tutorIdx x quintile
  loanTable: { med: 4500, sk: 3000, seoul: 3000, jgeo: 2200, jun: 1800, hs: 1200 } as Record<string, number>,
} as const;

export const QUINTILE_START = [-1500, -800, 0, 800, 2000]; // starting household savings (만원)

// Simplified after-tax conversion (간이세율 근사, 2024 근로소득세율 기반)
export function afterTax(annualManwon: number): number {
  if (annualManwon <= 0) return annualManwon;
  const b = annualManwon;
  let tax: number;
  if (b <= 1400) tax = b * 0.06;
  else if (b <= 5000) tax = 84 + (b - 1400) * 0.15;
  else if (b <= 8800) tax = 624 + (b - 5000) * 0.24;
  else if (b <= 15000) tax = 1536 + (b - 8800) * 0.35;
  else tax = 3706 + (b - 15000) * 0.38;
  const ins = b * 0.09; // 4대보험+건보 근사
  return Math.round(b - tax - ins);
}

export function fmtMan(manw: number): string {
  const a = Math.round(manw);
  if (a === 0) return '0원';
  const neg = a < 0 ? '-' : '';
  const v = Math.abs(a);
  if (v >= 10000) {
    const eok = Math.floor(v / 10000);
    const rest = v % 10000;
    return `${neg}${eok}억${rest > 0 ? ` ${rest.toLocaleString()}만` : ''}원`;
  }
  return `${neg}${v.toLocaleString()}만원`;
}
