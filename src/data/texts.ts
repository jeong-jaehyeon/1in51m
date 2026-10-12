// Static copy: warnings, sources, reflections, share templates, memorial.

export const WARNING =
  '실제 통계(2024 가용치)를 뼈대로 한 허구 시뮬레이션입니다. 자살·범죄·빈곤·질병·전쟁 묘사를 포함하며 15세 이상 권장합니다. 실명 대학·기업 수치는 공개 통계 기반이며 풍자·교육 목적입니다.';

export const CONTACT = 'wolgus104@naver.com';

export interface Src { label: string; detail: string }

export const SOURCES: Src[] = [
  { label: '출생·사망·기대수명', detail: '통계청 인구동향·생명표 2024' },
  { label: '가구소득 5분위·생활비', detail: '통계청 가계동향조사 2024' },
  { label: '사교육비', detail: '통계청 초중고 사교육비조사 2024' },
  { label: '대학 취업률', detail: '대학알리미 공시 2025(2024년 졸업자 기준), 계열 평균 기반 추정치 포함' },
  { label: '임금·초임', detail: '고용노동부 워크넷·임금직무정보 2024 기반 추정치' },
  { label: '자살·사망원인', detail: '통계청 사망원인통계 2024, WHO/GBD 연령 패턴' },
  { label: '혼인·이혼', detail: '통계청 혼인·이혼통계 2024 (유배우이혼율 3.7‰)' },
  { label: '출산', detail: '통계청 합계출산율 2024 (0.75명)' },
  { label: '주택·청약', detail: '국토교통부 실거래·한국부동산원 2024 기반 추정치' },
  { label: '로또·세금', detail: '복권위 33% 과세, 국세청 간이세율표 2024 근사' },
];

export const REFLECTIONS: Array<{ age: number; q: string }> = [
  { age: 5, q: '이 아이의 다섯 살은 어땠나요? 당신의 다섯 살과 겹쳐보세요.' },
  { age: 15, q: '열다섯, 진로가 갈리기 시작합니다. 이 아이와 당신의 열다섯을 비교해보세요.' },
  { age: 30, q: '서른. 기대와 현실의 간극을 이 아이는 어떻게 메우고 있나요?' },
  { age: 50, q: '쉰. 몸이 먼저 늙습니다. 이 아이에게 해주고 싶은 말이 있나요?' },
  { age: 70, q: '일흔. 남은 시간을 이 아이는 무엇에 쓰고 있나요?' },
];

export const MEMORIAL = (name: string, age: number) =>
  `${name} 님은 ${age}세의 짧은 생을 마쳤습니다. 통계가 말해주지 않는 이야기가 여기 있었습니다. 다시 태어나기를 눌러 또 다른 삶을 살아보세요.`;

export function shareText(o: {
  name: string; region: string; univ: string; job: string; peak: string;
  deathAge: number; cause: string; rank: number; total: number;
}): string {
  return [
    `5100만분의 1 — 나의 생애 결과`,
    `${o.name} · ${o.region} 출생`,
    `${o.univ} → ${o.job}`,
    `전성기 연봉 ${o.peak}`,
    `${o.deathAge}세, 사인: ${o.cause}`,
    `같은 반 ${o.total}명 중 ${o.rank}등`,
    `#5100만분의1`,
  ].join('\n');
}

export const FOOTER_NOTE =
  '교육용 풍자 시뮬레이션. 실명 대학·기업 수치는 공개 통계 기반 추정치이며 각 기관의 공식 입장과 무관합니다.';
