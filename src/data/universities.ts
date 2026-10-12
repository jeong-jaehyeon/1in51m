// 100 universities. tier: sk | seoul | jgeo | local | junior
// emp: employment rate — 2024 대학알리미 계열 평균 기반 추정치 (see sources screen).

export interface Univ { name: string; tier: 'sk' | 'seoul' | 'jgeo' | 'local' | 'junior'; emp: number }

const SK: Univ[] = [
  { name: '서울대', tier: 'sk', emp: 71 }, { name: '연세대', tier: 'sk', emp: 72 }, { name: '고려대', tier: 'sk', emp: 72 },
  { name: 'KAIST', tier: 'sk', emp: 78 }, { name: 'POSTECH', tier: 'sk', emp: 79 },
  { name: 'UNIST', tier: 'sk', emp: 74 }, { name: 'GIST', tier: 'sk', emp: 73 }, { name: 'DGIST', tier: 'sk', emp: 74 },
];
const SEOUL: Univ[] = [
  '성균관대', '서강대', '한양대', '중앙대', '경희대', '한국외대', '서울시립대', '이화여대',
  '건국대', '동국대', '홍익대', '숙명여대', '국민대', '숭실대', '세종대', '광운대',
  '명지대', '상명대', '가천대', '아주대', '인하대', '단국대',
].map((name, i) => ({ name, tier: 'seoul' as const, emp: 70 - (i % 7) }));
const EDU: Univ[] = [
  { name: '서울교대', tier: 'jgeo' as const, emp: 66 },
  { name: '경인교대', tier: 'jgeo' as const, emp: 65 },
  { name: '부산교대', tier: 'jgeo' as const, emp: 64 },
];
const JGEO: Univ[] = [
  '부산대', '경북대', '전남대', '충남대', '충북대', '전북대', '강원대', '경상국립대', '제주대',
].map((name, i) => ({ name, tier: 'jgeo' as const, emp: 62 - (i % 4) }));
const LOCAL: Univ[] = [
  '경기대', '인천대', '수원대', '강남대', '용인대', '평택대', '남서울대', '호서대',
  '공주대', '한밭대', '순천향대', '선문대', '백석대', '대전대', '목원대', '배재대',
  '우송대', '청주대', '서원대', '세명대', '상지대', '대구대', '계명대', '영남대',
  '울산대', '인제대', '경남대', '조선대',
].map((name, i) => ({ name, tier: 'local' as const, emp: 60 - (i % 6) }));
const JUNIOR: Univ[] = [
  '명지전문대', '한양여자대', '숭의여자대', '배화여자대', '동양미래대', '인덕대', '서일대', '삼육보건대',
  '경기과학기술대', '부천대', '유한대', '신구대', '동남보건대', '수원과학대', '안산대', '대림대',
  '계원예술대', '청강문화산업대', '연성대', '경복대', '서정대', '김포대', '인천재능대', '영남이공대',
  '대구보건대', '부산과학기술대', '경남정보대', '울산과학대', '광주보건대', '전북과학대',
].map((name, i) => ({ name, tier: 'junior' as const, emp: 73 - (i % 5) }));

export const UNIVERSITIES: Univ[] = [...SK, ...SEOUL, ...EDU, ...JGEO, ...LOCAL, ...JUNIOR];

export type SimTier = 'med' | 'sk' | 'seoul' | 'jgeo' | 'jun' | 'hs';

export function tierOf(u: Univ): SimTier {
  if (u.tier === 'sk') return 'sk';
  if (u.tier === 'seoul') return 'seoul';
  if (u.tier === 'jgeo' || u.tier === 'local') return 'jgeo';
  return 'jun';
}

export function pickUniv(tier: SimTier, r: number): Univ {
  const pool = UNIVERSITIES.filter((u) => tierOf(u) === tier);
  if (pool.length === 0) return UNIVERSITIES[0];
  return pool[Math.floor(r * pool.length) % pool.length];
}
