import { useEffect, useRef, useState } from 'react';
import {
  createGame, newSeed, stepYear, resolveChoice, resolveCancer, regionOf,
} from './engine/sim';
import type { GameState } from './engine/sim';
import { drawPortrait } from './engine/portrait';
import { saveGame, loadGame, clearSave, hasSave, wasWarned, markWarned } from './engine/save';
import { renderMyCard, renderPaper, downloadCanvas } from './ui/share';
import { FOCI, RATES, fmtMan } from './data/lookup';
import { REGIONS } from './data/lookup';
import { jobLabel } from './data/jobs';
import { WARNING, CONTACT, SOURCES, REFLECTIONS, MEMORIAL, shareText, FOOTER_NOTE } from './data/texts';

const VERSION = '1.0.0';
const BIRTHS_YR = 238300; // 통계청 인구동향 2024
const DEATHS_YR = 352511; // 통계청 사망원인통계 2024(잠정치 반영 추정치)
const BAD_WORDS = ['시발', '씨발', '병신', '지랄', '개새', '좆', '썅', '꺼져', '죽어', '자살'];

function useNow(stepMs: number): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return t;
}

export default function App() {
  const [screen, setScreen] = useState<'start' | 'play' | 'end'>('start');
  const gameRef = useRef<GameState | null>(null);
  const [, setV] = useState(0);
  const bump = () => setV((v) => v + 1);
  const [toast, setToast] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showWarn, setShowWarn] = useState(false);
  const [name, setName] = useState('');
  const [journal, setJournal] = useState('');
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(false);
  const openedAt = useRef(Date.now());
  const now = useNow(1000);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };

  // PWA service worker
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  // fast test mode: ?fast=1 runs a full life instantly
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('fast') === '1' && !gameRef.current) {
      const st = createGame('테스트', 12345);
      st.auto = true;
      let guard = 0;
      while (!st.over && guard++ < 200) stepYear(st);
      gameRef.current = st;
      setScreen('end');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // main timer
  useEffect(() => {
    if (screen !== 'play') return;
    const ms = RATES.tickMs / speed;
    const id = setInterval(() => {
      const st = gameRef.current;
      if (!st || st.over || st.pending || st.reflect || paused) return;
      st.auto = auto;
      stepYear(st);
      saveGame(st);
      if (st.over) {
        clearSave();
        setScreen('end');
      }
      bump();
    }, ms);
    return () => clearInterval(id);
  }, [screen, speed, paused, auto]);

  const start = (cont: boolean) => {
    if (cont) {
      const st = loadGame();
      if (st) {
        gameRef.current = st;
        setSpeed(st.speed ?? 1);
        setAuto(st.auto ?? false);
        setScreen(st.over ? 'end' : 'play');
        return;
      }
    }
    const nm = name.trim();
    if (nm.length === 0 || nm.length > 10) { say('이름은 1~10자로 입력해주세요.'); return; }
    if (BAD_WORDS.some((w) => nm.includes(w))) { say('이름에 부적절한 표현이 있습니다.'); return; }
    if (!wasWarned()) { setShowWarn(true); return; }
    begin(nm);
  };

  const begin = (nm: string) => {
    const st = createGame(nm, newSeed());
    gameRef.current = st;
    saveGame(st);
    setScreen(st.over ? 'end' : 'play');
    bump();
  };

  const pickChoice = (key: string) => {
    const st = gameRef.current;
    if (!st || !st.pending) return;
    if (st.pending.id === 'cancer') resolveCancer(st, key);
    else resolveChoice(st, st.pending.id, key);
    saveGame(st);
    bump();
  };

  const saveJournal = (skip: boolean) => {
    const st = gameRef.current;
    if (!st || st.reflect === null) return;
    if (!skip && journal.trim()) st.player.journal[st.reflect] = journal.trim();
    st.reflect = null;
    setJournal('');
    saveGame(st);
    bump();
  };

  const st = gameRef.current;
  const elapsed = (now - openedAt.current) / 1000;
  const births = Math.floor((BIRTHS_YR / (365 * 24 * 3600)) * elapsed);
  const deaths = Math.floor((DEATHS_YR / (365 * 24 * 3600)) * elapsed);

  return (
    <>
      {screen === 'start' && (
        <div className="wrap">
          <div className="hero">
            <div className="muted mono">v{VERSION} beta · 무료 인생 시뮬레이션 · 2024 실통계</div>
            <h1><em>5100만</em>분의 1</h1>
            <p className="lede">
              지금 이 순간에도 한국에서 아기가 태어납니다. 그중 한 명이 되어 단 한 번뿐인 삶을 끝까지 살아봅니다.
              어디서, 누구의 아이로 태어날지는 고를 수 없습니다. 당신과 같은 반 15명과 함께.
            </p>
            <div className="counter">
              <div><strong>{births.toLocaleString()}</strong><span>이 페이지가 열린 뒤 태어난 아기</span></div>
              <div><strong>{deaths.toLocaleString()}</strong><span>같은 시간 세상을 떠난 사람</span></div>
            </div>
          </div>
          <div className="card">
            <h2>누구로 태어날까요</h2>
            <p className="muted">이름을 정해주세요. 나머지는 전부 통계가 정합니다.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (1~10자)" maxLength={10} />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="cta" onClick={() => start(false)}>태어나기</button>
              {hasSave() && <button className="ghost" onClick={() => start(true)}>이어하기</button>}
            </div>
            <p className="small" style={{ marginTop: 10 }}>1년에 약 15초. 한 생애 약 20분. 배속·일시정지·자동관전 지원.</p>
          </div>
          <div className="card">
            <h3>이 게임에 대하여</h3>
            <p className="muted">
              8개 권역·소득 5분위·141개→한국 100개 대학·100개 직업의 실제 통계를 뼈대로,
              같은 반 15명이 병렬로 살아가는 풀라이프 시뮬레이션입니다. 노력해도 통계를 벗어나기 어렵습니다.
              극소수에게만 역전이 허락됩니다.
            </p>
          </div>
          <footer className="appfoot" style={{ maxWidth: 'none', padding: '0 0 48px' }}>
            <button className="link" onClick={() => setShowSources(true)}>통계 출처 보기</button>
            {' · '}<a href={`mailto:${CONTACT}`}>문의 {CONTACT}</a>
            <div className="legal">{FOOTER_NOTE}</div>
          </footer>
        </div>
      )}

      {screen === 'play' && st && <Play st={st} speed={speed} setSpeed={setSpeed} paused={paused} setPaused={setPaused} auto={auto} setAuto={setAuto} onChoice={pickChoice} reflectAge={st.reflect} journal={journal} setJournal={setJournal} onJournal={saveJournal} onSources={() => setShowSources(true)} bump={bump} />}

      {screen === 'end' && st && (
        <End st={st} say={say} onRebirth={() => { clearSave(); gameRef.current = null; setName(''); setScreen('start'); }} onSources={() => setShowSources(true)} />
      )}

      {showWarn && (
        <div className="scrim">
          <div className="dec">
            <div className="hd">시작 전 고지</div>
            <div className="bd">
              <div className="warn">{WARNING}</div>
              <div className="row">
                <button className="cta" onClick={() => { markWarned(); setShowWarn(false); begin(name.trim()); }}>이해했고 시작한다</button>
                <button className="ghost" onClick={() => setShowWarn(false)}>돌아간다</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSources && (
        <div className="scrim">
          <div className="dec">
            <div className="hd">통계 출처 · 2024 가용치 기준</div>
            <div className="bd">
              <ul className="srclist">
                {SOURCES.map((s) => <li key={s.label}><b>{s.label}</b> — {s.detail}</li>)}
              </ul>
              <p className="small">{FOOTER_NOTE}</p>
              <div className="row"><button className="ghost" onClick={() => setShowSources(false)}>닫기</button></div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function Play(props: {
  st: GameState; speed: 1 | 2 | 4; setSpeed: (s: 1 | 2 | 4) => void;
  paused: boolean; setPaused: (b: boolean) => void; auto: boolean; setAuto: (b: boolean) => void;
  onChoice: (key: string) => void; reflectAge: number | null; journal: string; setJournal: (s: string) => void;
  onJournal: (skip: boolean) => void; onSources: () => void; bump: () => void;
}) {
  const { st } = props;
  const p = st.player;
  const portraitRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (portraitRef.current) drawPortrait(portraitRef.current, p.seed, p.sex, st.age, p.quintile);
  }, [p.seed, p.sex, st.age, p.quintile]);

  const setFocus = (f: typeof p.focus) => {
    p.focus = f;
    saveGame(st);
    props.bump();
  };
  const region = regionOf(st);
  const aliveMates = st.mates.filter((m) => m.alive).length;
  const feed = [...p.log].reverse();
  const refl = REFLECTIONS.find((r) => r.age === props.reflectAge);

  return (
    <>
      <div className="topbar">
        <div className="in">
          <span className="brand"><em>5100만</em>분의 1</span>
          <span className="age">{st.age}<small>세</small></span>
          <span className="yr">{st.birthYear + st.age}년 · {region.name}</span>
          <span className="speed">
            <button aria-pressed={props.paused} onClick={() => props.setPaused(!props.paused)}>{props.paused ? '▶' : '⏸'}</button>
            {([1, 2, 4] as const).map((s) => (
              <button key={s} aria-pressed={props.speed === s} onClick={() => props.setSpeed(s)}>x{s}</button>
            ))}
            <button aria-pressed={props.auto} onClick={() => props.setAuto(!props.auto)}>자동</button>
          </span>
        </div>
      </div>
      <div className="wrap">
        <div className="life">
          <div className="col">
            <div className="panel idcard">
              <h3>인물</h3>
              <div className="idrow">
                <div className="portrait"><canvas ref={portraitRef} /></div>
                <div>
                  <div className="nm">{p.name}</div>
                  <dl>
                    <dt>출생</dt><dd>{region.name} · {p.quintile}분위</dd>
                    <dt>가정</dt><dd>{(() => { const f = { both: '맞벌이 양부모', single: '외벌이 양부모', oneparent: '한부모', grand: '조손', multi: '다문화', care: '보육원' } as Record<string, string>; return f[p.familyId] ?? p.familyId; })()}{p.twin ? ' · 쌍둥이' : ''}</dd>
                    <dt>학력</dt><dd>{p.univName || (p.suneung > 0 ? `수능 ${p.suneung}등급` : st.age >= 19 ? '진학 없음' : '재학 중')}</dd>
                    <dt>직업</dt><dd>{p.job ? jobLabel(p.job) : st.age >= 22 ? '무직' : '학생'}</dd>
                    <dt>가족</dt><dd>{p.spouse ? `${p.spouse.name}와 혼인${p.divorced ? '(이혼)' : ''}` : '미혼'} · 자녀 {p.kids}명</dd>
                    <dt>주거</dt><dd>{p.house === 'own' ? '자가' : p.house === 'jeonse' ? '전세' : '무주택'}</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="panel">
              <h3>상태</h3>
              <Stat label="성적" v={p.grade} />
              <Stat label="건강" v={p.health} />
              <Stat label="멘탈" v={p.mental} />
              <Stat label="인맥" v={p.network} />
              <div className="money" style={{ marginTop: 10 }}>
                <div><b style={{ color: p.money < 0 ? 'var(--bad)' : undefined }}>{fmtMan(p.money)}</b><small>보유 자산</small></div>
                <div><b>{p.job && !p.retired ? fmtMan(Math.round(p.salary / 12)) + '/월' : p.retired ? '연금생활' : '-'}</b><small>월 소득(세전)</small></div>
              </div>
              {p.loanLeft > 0 && <div className="small">학자금 잔여 {p.loanLeft}년</div>}
            </div>
          </div>
          <div className="col">
            <div className="panel">
              <h3>올해의 집중 · {st.age}세</h3>
              <div className="chips">
                {FOCI.map((f) => (
                  <button key={f.id} className="chip" aria-pressed={p.focus === f.id} onClick={() => setFocus(f.id as typeof p.focus)}>
                    {f.name}<small>{f.desc}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3>생애 기록</h3>
              <ul className="feed">
                {feed.slice(0, 60).map((it, i) => (
                  <li key={`${it.age}-${i}`} className={it.cls}>
                    <span className="a">{it.age}세</span>
                    <span className="x">{it.text}{it.src && <span className="src">{it.src}</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="col">
            <div className="panel">
              <h3>같은 반 {st.mates.length > 0 ? 15 : 0}명 · 생존 {aliveMates}명</h3>
              {st.mates.length === 0
                ? <div className="muted">8세 입학 때 만난다.</div>
                : <div className="muted">{st.mates.filter((m) => m.alive).slice(0, 8).map((m) => m.name).join(' · ')}{aliveMates > 8 ? ' …' : ''}</div>}
            </div>
            <div className="panel">
              <h3>기록</h3>
              <div className="muted">
                전성기 연봉 {fmtMan(p.peak)}{p.lottoWon > 0 ? ` (로또 ${fmtMan(p.lottoWon)} 포함)` : ''}
                <br />배속 x{props.speed} · {props.auto ? '자동관전 중' : '직접 선택'}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="ghost" onClick={props.onSources}>출처</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {st.pending && (
        <div className="scrim">
          <div className="dec">
            <div className="hd">{st.pending.id === 'lotto' ? '매주' : `${st.age}세 · 선택`}</div>
            <div className="bd">
              <h2>{st.pending.title}</h2>
              {st.pending.fact && <div className="fact">{st.pending.fact}</div>}
              <div className="ch">
                {st.pending.options.map((o, i) => (
                  <button key={o.key} onClick={() => props.onChoice(o.key)}>
                    <span className="k">{i + 1}</span>
                    <span><b>{o.label}</b><br /><small>{o.sub}</small></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {props.reflectAge !== null && refl && (
        <div className="scrim">
          <div className="dec">
            <div className="hd">멈춤 · {props.reflectAge}세</div>
            <div className="bd">
              <p className="q">{refl.q}</p>
              <textarea value={props.journal} onChange={(e) => props.setJournal(e.target.value)} placeholder="한 줄 남기기 (선택)" />
              <div className="row">
                <button className="cta" onClick={() => props.onJournal(false)}>남기고 간다</button>
                <button className="ghost" onClick={() => props.onJournal(true)}>건너뛴다</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat(props: { label: string; v: number }) {
  const v = Math.max(0, Math.min(100, Math.round(props.v)));
  return (
    <div className="stat">
      <span>{props.label}</span>
      <span className="bar"><i style={{ width: `${v}%` }} /></span>
      <span className="v">{v}</span>
    </div>
  );
}

function End(props: { st: GameState; say: (t: string) => void; onRebirth: () => void; onSources: () => void }) {
  const { st } = props;
  const p = st.player;
  const portraitRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (portraitRef.current) drawPortrait(portraitRef.current, p.seed, p.sex, Math.min(Math.max(p.deathAge, 1), 80), p.quintile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doShare = async (kind: 'mine' | 'paper') => {
    try {
      await document.fonts.ready;
    } catch { /* ignore */ }
    const cv = kind === 'mine' ? renderMyCard(st) : renderPaper(st);
    downloadCanvas(cv, kind === 'mine' ? '5100만분의1-나의생애.png' : '5100만분의1-반신문.png');
    props.say('이미지를 저장했습니다.');
  };
  const copyText = async () => {
    const t = shareText({
      name: p.name, region: REGIONS[p.regionIdx].name, univ: p.univName || '진학 없음',
      job: p.job ? jobLabel(p.job) : '무직', peak: fmtMan(p.peak),
      deathAge: p.deathAge, cause: p.cause, rank: st.rank, total: st.rankTotal,
    });
    try {
      await navigator.clipboard.writeText(t);
      props.say('결과 텍스트를 복사했습니다.');
    } catch {
      props.say('복사에 실패했습니다.');
    }
  };

  if (st.memorial) {
    return (
      <div className="wrap">
        <div className="card" style={{ marginTop: 40 }}>
          <h2>추모</h2>
          <p>{MEMORIAL(p.name, p.deathAge)}</p>
          <div className="row">
            <button className="cta" onClick={props.onRebirth}>다시 태어나기</button>
          </div>
        </div>
      </div>
    );
  }

  const dead = st.mates.filter((m) => !m.alive);
  const journals = Object.entries(p.journal).sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <div className="wrap">
      <div className="dcert" style={{ marginTop: 24 }}>
        <div className="band"><span>사망증명 · {st.birthYear + p.deathAge}년</span><span>5100만분의 1</span></div>
        <div className="body">
          <div className="idrow">
            <div className="portrait" style={{ width: 96, height: 120 }}><canvas ref={portraitRef} /></div>
            <div>
              <h1>{p.name}</h1>
              <div className="mono muted">{REGIONS[p.regionIdx].name} 출생 · {st.birthYear}–{st.birthYear + p.deathAge} ({p.deathAge}세)</div>
              <div className="cause" style={{ marginTop: 10, fontSize: 18 }}>사인: <b style={{ color: 'var(--accent)' }}>{p.cause}</b></div>
            </div>
          </div>
          <div className="summary">
            <div><b>{p.univName || (p.suneung > 0 ? `수능 ${p.suneung}등급` : '진학 없음')}</b><small>학력</small></div>
            <div><b>{p.job ? jobLabel(p.job) : '무직'}</b><small>직업</small></div>
            <div><b>{fmtMan(p.peak)}</b><small>전성기 연봉{p.lottoWon > 0 ? ` (로또 ${fmtMan(p.lottoWon)} 포함)` : ''}</small></div>
            <div><b>{p.spouse ? `기혼${p.divorced ? '(이혼)' : ''} · 자녀 ${p.kids}명` : '미혼'}</b><small>가족</small></div>
            <div><b>{p.house === 'own' ? '자가' : p.house === 'jeonse' ? '전세' : '무주택'}</b><small>주거</small></div>
            <div><b>15명 중 {st.rank}등</b><small>같은 반 종합 순위 (수능3:대학3:소득4)</small></div>
          </div>
          {journals.length > 0 && (
            <div className="paper2">
              <h3>남긴 한 줄</h3>
              {journals.map(([a, t]) => <div key={a} className="muted">“{t}” <span className="mono">— {a}세</span></div>)}
            </div>
          )}
          <div className="endbtns" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <button className="cta" onClick={() => void doShare('mine')}>내 결과 이미지 저장</button>
            <button className="ghost" onClick={() => void doShare('paper')}>반 신문 저장</button>
            <button className="ghost" onClick={() => void copyText()}>텍스트 복사</button>
            <button className="ghost" onClick={props.onRebirth}>다시 태어나기</button>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="ghost" onClick={() => props.say('후원 기능은 준비 중입니다.')}>커피 후원 (준비 중)</button>
            <button className="ghost" onClick={props.onSources}>통계 출처</button>
          </div>
        </div>
      </div>
      <div className="card paper2">
        <h3>우리 반 15명 근황</h3>
        <table>
          <thead><tr><th>이름</th><th>학력 → 직업</th><th>현황</th></tr></thead>
          <tbody>
            <tr><td><b>{p.name} (나)</b></td><td>{p.univName || '진학 없음'} → {p.job ? jobLabel(p.job) : '무직'}</td><td>† {p.deathAge}세 · {p.cause}</td></tr>
            {st.mates.map((m) => (
              <tr key={m.name}>
                <td>{m.name}</td>
                <td>{m.univ || '고졸'} → {m.job || '미정'}</td>
                <td>{m.alive ? `생존 · ${m.married ? `기혼·자녀${m.kids}` : '미혼'} · ${fmtMan(m.peak)}` : `† ${m.deathAge}세 · ${m.cause}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {dead.length > 0 && <p className="small">추모: {dead.map((m) => `${m.name} (†${m.deathAge}·${m.cause})`).join(', ')}</p>}
      </div>
      <footer className="appfoot" style={{ maxWidth: 'none', padding: '0 0 48px' }}>
        <div className="legal">{FOOTER_NOTE} · v1.0.0 · <a href={`mailto:${CONTACT}`}>{CONTACT}</a></div>
      </footer>
    </div>
  );
}
