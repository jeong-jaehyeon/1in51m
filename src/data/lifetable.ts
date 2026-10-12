// Simplified Korean 2024-based mortality. All-cause base EXCLUDES suicide/accident
// (those roll separately in sim.ts so counts match statistics).
// Brackets approximate 2024 생명표; e0 ≈ M 80.6 / F 86.4. Label shown in sources screen.

export type Sex = 'M' | 'F';

interface Band { max: number; m: number; f: number }

const BASE: Band[] = [
  { max: 0, m: 0.0023, f: 0.0023 },
  { max: 4, m: 0.00013, f: 0.00011 },
  { max: 9, m: 0.00009, f: 0.00007 },
  { max: 14, m: 0.00011, f: 0.00008 },
  { max: 19, m: 0.00030, f: 0.00016 },
  { max: 24, m: 0.00042, f: 0.00020 },
  { max: 29, m: 0.00050, f: 0.00024 },
  { max: 34, m: 0.00066, f: 0.00033 },
  { max: 39, m: 0.00090, f: 0.00048 },
  { max: 44, m: 0.00130, f: 0.00072 },
  { max: 49, m: 0.00200, f: 0.00110 },
  { max: 54, m: 0.00320, f: 0.00170 },
  { max: 59, m: 0.00480, f: 0.00250 },
  { max: 64, m: 0.00720, f: 0.00370 },
  { max: 69, m: 0.01100, f: 0.00580 },
  { max: 74, m: 0.01800, f: 0.01000 },
  { max: 79, m: 0.03200, f: 0.01900 },
  { max: 84, m: 0.05600, f: 0.03600 },
  { max: 89, m: 0.09600, f: 0.06800 },
  { max: 94, m: 0.16000, f: 0.12000 },
  { max: 200, m: 0.26000, f: 0.21000 },
];

export function baseQ(age: number, sex: Sex): number {
  for (const b of BASE) if (age <= b.max) return sex === 'M' ? b.m : b.f;
  return 0.3;
}

// Annual suicide rate by age/sex (2024 인구 10만명당 20대 후반~60대 구조 근사)
// Annual suicide rate by age/sex — scaled x0.5 so lifetime ≈1% (100판 1명꼴).
// Base shape follows 2024 구조; mental multiplier applied in sim.
export function suicideQ(age: number, sex: Sex): number {
  if (age < 15 || age > 85) return 0;
  const m = sex === 'M' ? 0.8 : 0.35;
  if (age < 20) return 0.000025 * m;
  if (age < 30) return 0.00014 * m;
  if (age < 40) return 0.00015 * m;
  if (age < 50) return 0.00018 * m;
  if (age < 60) return 0.00019 * m;
  if (age < 70) return 0.00021 * m;
  return 0.00024 * m;
}

export const ACCIDENT_Q = 0.0004; // 교통·산재 등 외인 (20세+ 가중은 sim에서)

// Cause labels for base (disease) deaths by age band
export function diseaseCause(age: number, r: number): string {
  if (age < 1) return r < 0.5 ? '선천성 질환' : '신생아 폐렴';
  if (age < 20) return r < 0.4 ? '교통사고' : r < 0.6 ? '익사' : r < 0.8 ? '백혈병' : '심장돌연사';
  if (age < 40) return r < 0.35 ? '심혈관 돌연사' : r < 0.6 ? '교통사고' : r < 0.8 ? '암' : '간질환';
  if (age < 65) {
    if (r < 0.4) return '암';
    if (r < 0.6) return '심혈관질환';
    if (r < 0.72) return '간질환';
    if (r < 0.82) return '뇌혈관질환';
    if (r < 0.9) return '당뇨 합병증';
    return '교통사고';
  }
  if (r < 0.32) return '암';
  if (r < 0.5) return '폐렴';
  if (r < 0.64) return '심혈관질환';
  if (r < 0.74) return '뇌혈관질환';
  if (r < 0.82) return '치매';
  if (r < 0.9) return '노환';
  return '낙상 합병증';
}
