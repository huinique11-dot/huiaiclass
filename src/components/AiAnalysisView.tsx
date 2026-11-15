import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Music2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AI_ETHICS_QUESTION,
  EMPTY_SONG,
  JUDGMENT_LABELS,
  fetchAiStatus,
  fetchMyAiActivity,
  judgmentItems,
  requestAiAnalysis,
  saveAiActivity,
  type AiActivity,
  type AiCriterion,
  type AiResult,
  type AiSong,
  type AiStatus,
  type Judgment,
} from '../lib/aiApi.ts';

const DRAFT_KEY = 'music_era_stage4_ai_draft_v1';
const CREDS_KEY = 'music_era_stage4_ai_creds_v1';
const MAX_SONGS = 3;

interface Draft {
  step: number;
  studentId: string;
  studentName: string;
  classGroup: string;
  songs: AiSong[];
  hypothesis: string;
  criterion: AiCriterion | '';
  aiResult: AiResult | null;
  judgments: Record<string, Judgment>;
  comparisonText: string;
  reconstructionText: string;
  evidenceText: string;
  ethicsText: string;
}

const EMPTY_DRAFT: Draft = {
  step: 1,
  studentId: '',
  studentName: '',
  classGroup: '',
  songs: [{ ...EMPTY_SONG }],
  hypothesis: '',
  criterion: '',
  aiResult: null,
  judgments: {},
  comparisonText: '',
  reconstructionText: '',
  evidenceText: '',
  ethicsText: '',
};

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간을 쓸 수 없는 환경이면 무시
  }
}

const STEPS = [
  { n: 1, tag: 'H', title: '나의 가설 먼저', who: '학생이 먼저' },
  { n: 2, tag: 'A', title: '분석 기준 고르기', who: 'AI가 돕기 ①' },
  { n: 3, tag: 'A', title: 'AI 분석 받기', who: 'AI가 돕기 ②' },
  { n: 4, tag: 'H', title: '비교하고 재구성', who: '학생이 판단' },
] as const;

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15';
const labelCls = 'block text-sm font-medium text-slate-800';
const primaryBtn =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';
const ghostBtn =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50';

export function AiAnalysisView() {
  const [draft, setDraft] = useState<Draft>(() => ({ ...EMPTY_DRAFT, ...(readJson<Draft>(DRAFT_KEY) ?? {}) }));
  const [creds, setCreds] = useState<{ id: string; token: string } | null>(() => readJson(CREDS_KEY));
  const [saved, setSaved] = useState<AiActivity | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    writeJson(DRAFT_KEY, draft);
  }, [draft]);

  useEffect(() => {
    fetchAiStatus().then(setStatus);
    if (creds) {
      fetchMyAiActivity(creds.id, creds.token).then((a) => {
        if (a) {
          setSaved(a);
          setDraft((d) => (d.step === 1 && !d.hypothesis ? { ...d, step: 5 } : d));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<Draft>) => {
    setError('');
    setDraft((d) => ({ ...d, ...patch }));
  };
  const goStep = (step: number) => {
    update({ step });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const updateSong = (i: number, patch: Partial<AiSong>) =>
    update({ songs: draft.songs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  const filledSongs = draft.songs.filter((s) => s.title.trim());
  const step1Ready =
    draft.studentId.trim() && draft.studentName.trim() && filledSongs.length > 0 && draft.hypothesis.trim().length >= 5;
  const step3InputsReady =
    draft.criterion === 'lyrics'
      ? filledSongs.every((s) => s.lyrics.trim())
      : filledSongs.every((s) => s.tempo.trim() || s.mood.trim() || s.instruments.trim() || s.lyricsContent.trim());
  const step4Ready = draft.comparisonText.trim() && draft.reconstructionText.trim();
  const items = useMemo(() => judgmentItems(draft.aiResult), [draft.aiResult]);

  const runAnalysis = async () => {
    if (!draft.criterion) return;
    setAnalyzing(true);
    setError('');
    try {
      const result = await requestAiAnalysis({
        criterion: draft.criterion,
        hypothesis: draft.hypothesis.trim(),
        songs: filledSongs,
      });
      update({ aiResult: result, judgments: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 분석을 받지 못했어요.');
      fetchAiStatus().then(setStatus);
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!draft.criterion || !draft.aiResult) return;
    setSaving(true);
    setError('');
    try {
      const res = await saveAiActivity({
        id: creds?.id,
        editToken: creds?.token,
        studentId: draft.studentId.trim(),
        studentName: draft.studentName.trim(),
        classGroup: draft.classGroup.trim(),
        songs: filledSongs,
        hypothesis: draft.hypothesis.trim(),
        criterion: draft.criterion,
        aiResult: draft.aiResult,
        judgments: draft.judgments,
        comparisonText: draft.comparisonText.trim(),
        reconstructionText: draft.reconstructionText.trim(),
        evidenceText: draft.evidenceText.trim(),
        ethicsText: draft.ethicsText.trim(),
      });
      const nextCreds = { id: res.activity.id, token: res.editToken };
      setCreds(nextCreds);
      writeJson(CREDS_KEY, nextCreds);
      setSaved(res.activity);
      goStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    if (!window.confirm('새로 시작할까요? 지금 쓰던 내용은 이 기기에서 지워집니다. (이미 저장한 활동은 선생님께 남아 있어요)')) return;
    setCreds(null);
    writeJson(CREDS_KEY, null);
    setSaved(null);
    setDraft({ ...EMPTY_DRAFT, songs: [{ ...EMPTY_SONG }] });
  };

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <section>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>4단계 (7~8차시)</span>
          <span aria-hidden="true">·</span>
          <span>동시대 및 또래 음악 탐구와 AI 분석 결과 비판적 검토</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">
          또래 음악 속 욕망과 고민, AI와 함께 들여다보기
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          <strong className="text-slate-900">H(나) → A(AI) → H(나)</strong> 순서로 진행해요. AI는 정답을 주는 게 아니라
          생각할 재료를 주는 도우미예요. 마지막 판단과 문장은 언제나 내가 씁니다.
        </p>
      </section>

      {/* 진행 단계 표시 */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="활동 단계">
        {STEPS.map((s) => {
          const current = draft.step === s.n;
          const done = draft.step > s.n;
          return (
            <li
              key={s.n}
              aria-current={current ? 'step' : undefined}
              className={`rounded-xl border px-3 py-2.5 ${
                current
                  ? 'border-slate-900 bg-white shadow-sm'
                  : done
                    ? 'border-teal-200 bg-teal-50'
                    : 'border-slate-200 bg-white/70'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    s.tag === 'A' ? 'bg-teal-700 text-white' : 'bg-slate-900 text-white'
                  }`}
                >
                  {s.tag}
                </span>
                <span className="text-xs text-slate-500">
                  {s.n}단계 · {s.who}
                </span>
                {done && <CheckCircle2 className="ml-auto h-4 w-4 text-teal-700" aria-label="완료" />}
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">{s.title}</p>
            </li>
          );
        })}
      </ol>

      {status && !status.connected && (
        <Notice tone="amber">
          저장 준비 중이에요. 데이터 저장소(/api)와 연결되면 AI 분석과 저장을 할 수 있어요.
        </Notice>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ---------- 1단계: H 나의 가설 ---------- */}
      {draft.step === 1 && (
        <Card tag="H" title="1단계 · 선곡하고 나의 가설 세우기" sub="AI에게 묻기 전에, 내 생각을 먼저 적어요.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="학번(번호)" required>
              <input className={inputCls} value={draft.studentId} maxLength={20} placeholder="예: 20305"
                onChange={(e) => update({ studentId: e.target.value })} />
            </Field>
            <Field label="별칭(이름)" required>
              <input className={inputCls} value={draft.studentName} maxLength={30} placeholder="예: 푸른음표 (가상 별칭)"
                onChange={(e) => update({ studentName: e.target.value })} />
            </Field>
            <Field label="반 또는 모둠" hint="선택">
              <input className={inputCls} value={draft.classGroup} maxLength={40} placeholder="예: 2모둠"
                onChange={(e) => update({ classGroup: e.target.value })} />
            </Field>
          </div>

          <div className="mt-6">
            <p className={labelCls}>
              요즘 또래가 즐겨 듣는 곡 <span className="text-red-700">*</span>{' '}
              <span className="text-xs font-normal text-slate-500">(1~3곡 · 출처를 밝히기 위해 곡명과 가수를 정확히)</span>
            </p>
            <div className="mt-2 space-y-2">
              {draft.songs.map((song, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <Music2 className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden="true" />
                  <input className={inputCls} value={song.title} maxLength={80} placeholder={`곡 ${i + 1} 제목`}
                    aria-label={`곡 ${i + 1} 제목`} onChange={(e) => updateSong(i, { title: e.target.value })} />
                  <input className={inputCls} value={song.artist} maxLength={60} placeholder="가수"
                    aria-label={`곡 ${i + 1} 가수`} onChange={(e) => updateSong(i, { artist: e.target.value })} />
                  {draft.songs.length > 1 && (
                    <button type="button" className={ghostBtn} aria-label={`곡 ${i + 1} 지우기`}
                      onClick={() => update({ songs: draft.songs.filter((_, idx) => idx !== i) })}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {draft.songs.length < MAX_SONGS && (
              <button type="button" className={`${ghostBtn} mt-2`}
                onClick={() => update({ songs: [...draft.songs, { ...EMPTY_SONG }] })}>
                <Plus className="h-4 w-4" aria-hidden="true" /> 곡 추가
              </button>
            )}
          </div>

          <div className="mt-6">
            <Field label="나만의 가설 한 줄" required
              hint="이 노래들에 요즘 또래의 어떤 감정이나 고민이 담겨 있을까요?">
              <textarea className={`${inputCls} min-h-[84px]`} value={draft.hypothesis} maxLength={300}
                placeholder="예: 이 노래들에는 남들과 비교하지 않고 나답게 인정받고 싶은 마음과, 불확실한 미래에 대한 불안이 담겨 있을 것 같다."
                onChange={(e) => update({ hypothesis: e.target.value })} />
            </Field>
          </div>

          <StepNav
            next={{ label: '다음: 분석 기준 고르기', disabled: !step1Ready, onClick: () => goStep(2) }}
            hint={!step1Ready ? '학번, 별칭, 곡 1개 이상, 가설 한 줄을 적으면 다음으로 갈 수 있어요.' : ''}
          />
        </Card>
      )}

      {/* ---------- 2단계: A-1 기준 고르기 ---------- */}
      {draft.step === 2 && (
        <Card tag="A" title="2단계 · 무엇을 기준으로 분석할까요?" sub="둘 중 하나를 골라요. 기준에 따라 AI가 도와주는 방식이 달라져요.">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="분석 기준">
            <CriterionCard
              selected={draft.criterion === 'lyrics'}
              title="가사 측면"
              desc="가사를 분석해서 자주 등장하는 감정 단어와 핵심 주제 키워드를 뽑아요."
              need="필요한 것: 각 곡의 가사"
              onSelect={() => update({ criterion: 'lyrics', aiResult: draft.criterion === 'lyrics' ? draft.aiResult : null, judgments: {} })}
            />
            <CriterionCard
              selected={draft.criterion === 'music'}
              title="음악적 특징 측면"
              desc="템포, 분위기, 악기 구성, 가사 내용을 바탕으로 오늘날 세대가 공유하는 욕망과 고민의 유형을 3~4가지로 나눠요."
              need="필요한 것: 내가 들으며 적은 템포·분위기·악기·가사 내용"
              onSelect={() => update({ criterion: 'music', aiResult: draft.criterion === 'music' ? draft.aiResult : null, judgments: {} })}
            />
          </div>
          <StepNav
            back={() => goStep(1)}
            next={{ label: '다음: 자료 넣고 AI 분석 받기', disabled: !draft.criterion, onClick: () => goStep(3) }}
          />
        </Card>
      )}

      {/* ---------- 3단계: A-2 AI 분석 ---------- */}
      {draft.step === 3 && draft.criterion && (
        <Card
          tag="A"
          title={draft.criterion === 'lyrics' ? '3단계 · 가사 넣고 감정 단어·주제 키워드 뽑기' : '3단계 · 음악적 특징 적고 욕망·고민 유형 나누기'}
          sub={draft.criterion === 'lyrics' ? '가사는 분석에만 쓰이고 저장되지 않아요.' : '직접 들으며 느낀 대로 적어요. 내가 적은 내용이 AI 분석의 재료가 돼요.'}
        >
          <Notice tone="slate">
            개인정보(이름, 학교, 연락처)는 어떤 칸에도 적지 마세요. AI 결과에는 틀린 내용이 있을 수 있어요.
          </Notice>

          <div className="mt-5 space-y-5">
            {filledSongs.map((song) => {
              const i = draft.songs.indexOf(song);
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {song.title}
                    {song.artist && <span className="font-normal text-slate-500"> · {song.artist}</span>}
                  </p>
                  {draft.criterion === 'lyrics' ? (
                    <textarea className={`${inputCls} mt-3 min-h-[160px]`} value={song.lyrics} maxLength={2500}
                      aria-label={`${song.title} 가사`} placeholder="가사를 붙여 넣으세요 (최대 2,500자)"
                      onChange={(e) => updateSong(i, { lyrics: e.target.value })} />
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="템포(빠르기)">
                        <input className={inputCls} value={song.tempo} maxLength={80} placeholder="예: 빠르고 통통 튐"
                          onChange={(e) => updateSong(i, { tempo: e.target.value })} />
                      </Field>
                      <Field label="분위기">
                        <input className={inputCls} value={song.mood} maxLength={120} placeholder="예: 신나지만 어딘가 쓸쓸함"
                          onChange={(e) => updateSong(i, { mood: e.target.value })} />
                      </Field>
                      <Field label="악기 구성">
                        <input className={inputCls} value={song.instruments} maxLength={160} placeholder="예: 신시사이저, 강한 드럼, 베이스"
                          onChange={(e) => updateSong(i, { instruments: e.target.value })} />
                      </Field>
                      <Field label="가사 내용(내 말로 요약)">
                        <input className={inputCls} value={song.lyricsContent} maxLength={400} placeholder="예: 남의 시선 신경 쓰지 말고 내 길을 가자"
                          onChange={(e) => updateSong(i, { lyricsContent: e.target.value })} />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            {status && status.connected && !status.enabled ? (
              <p className="flex items-center gap-2 text-sm text-slate-700">
                <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                선생님이 AI 분석을 열면 버튼을 누를 수 있어요.
                <button type="button" className="ml-auto text-xs underline underline-offset-4"
                  onClick={() => fetchAiStatus().then(setStatus)}>다시 확인</button>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={primaryBtn} disabled={!step3InputsReady || analyzing || !status?.connected}
                  onClick={runAnalysis}>
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                  {analyzing ? 'AI가 분석하는 중...' : draft.aiResult ? '다시 분석 받기' : 'AI에게 분석 요청하기'}
                </button>
                {!step3InputsReady && (
                  <span className="text-xs text-slate-500">
                    {draft.criterion === 'lyrics' ? '모든 곡의 가사를 넣어 주세요.' : '곡마다 하나 이상의 칸을 적어 주세요.'}
                  </span>
                )}
              </div>
            )}
          </div>

          {draft.aiResult && <AiResultView result={draft.aiResult} />}

          <StepNav
            back={() => goStep(2)}
            next={{ label: '다음: 내 느낌과 비교하기', disabled: !draft.aiResult, onClick: () => goStep(4) }}
          />
        </Card>
      )}

      {/* ---------- 4단계: H 비교·판단·재구성 ---------- */}
      {draft.step === 4 && draft.aiResult && (
        <Card tag="H" title="4단계 · AI 결과를 내 느낌과 비교하고, 내 언어로 다시 쓰기" sub="AI가 한 말을 그대로 받아들이지 말고 내 경험과 감정으로 따져 봐요.">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="text-xs font-medium text-slate-500">처음 세운 나의 가설</p>
            <p className="mt-1 text-slate-900">{draft.hypothesis}</p>
          </div>

          <div className="mt-5">
            <p className={labelCls}>① AI가 뽑은 항목마다 내 판단을 골라요</p>
            <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
              {items.map((item) => (
                <li key={item.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    {item.detail && <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`${item.label} 판단`}>
                    {(Object.keys(JUDGMENT_LABELS) as Judgment[]).map((j) => {
                      const on = draft.judgments[item.key] === j;
                      return (
                        <button key={j} type="button" role="radio" aria-checked={on}
                          onClick={() => update({ judgments: { ...draft.judgments, [item.key]: j } })}
                          className={`min-h-[36px] rounded-md border px-2.5 text-xs font-medium transition-colors ${
                            on
                              ? j === 'agree'
                                ? 'border-teal-700 bg-teal-700 text-white'
                                : j === 'partly'
                                  ? 'border-amber-700 bg-amber-50 text-amber-900'
                                  : 'border-slate-700 bg-slate-700 text-white'
                              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                          }`}>
                          {JUDGMENT_LABELS[j]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 space-y-5">
            <Field label="② AI 결과와 내가 실제로 느끼는 감정 비교하기" required
              hint="무엇이 맞고 무엇이 다른가요? 모둠 대화에서 고친 점, 처음 가설과 달라진 점도 적어요.">
              <textarea className={`${inputCls} min-h-[110px]`} value={draft.comparisonText} maxLength={1500}
                placeholder="예: AI는 '불안'을 가장 많이 뽑았지만, 나는 이 노래를 들으면 불안보다 '버티는 힘'이 더 느껴진다. 모둠 친구들도..."
                onChange={(e) => update({ comparisonText: e.target.value })} />
            </Field>
            <Field label="③ 나만의 언어로 재구성하기" required
              hint="공감하는 항목을 골라, 오늘날 우리 세대의 욕망과 고민을 내 말로 다시 써요.">
              <textarea className={`${inputCls} min-h-[110px]`} value={draft.reconstructionText} maxLength={1500}
                placeholder="예: 우리 세대는 ___을/를 원하지만, 동시에 ___ 때문에 고민한다."
                onChange={(e) => update({ reconstructionText: e.target.value })} />
            </Field>
            <Field label="④ 그 느낌을 주는 대표 악기 소리나 노랫말 구절" hint="짝과 비교해 보세요.">
              <textarea className={`${inputCls} min-h-[80px]`} value={draft.evidenceText} maxLength={800}
                placeholder="예: 후렴에서 갑자기 드럼이 빠지고 목소리만 남는 부분 / “○○○” 구절"
                onChange={(e) => update({ evidenceText: e.target.value })} />
            </Field>
            <Field label="⑤ AI 윤리 함께 고민하기" hint={AI_ETHICS_QUESTION}>
              <textarea className={`${inputCls} min-h-[80px]`} value={draft.ethicsText} maxLength={800}
                placeholder="내 생각을 적어 보세요."
                onChange={(e) => update({ ethicsText: e.target.value })} />
            </Field>
          </div>

          <StepNav
            back={() => goStep(3)}
            next={{
              label: saving ? '저장하는 중...' : saved ? '고친 내용 저장하기' : '활동 저장하기',
              disabled: !step4Ready || saving,
              onClick: save,
            }}
            hint={!step4Ready ? '②와 ③을 적으면 저장할 수 있어요.' : ''}
          />
        </Card>
      )}

      {/* ---------- 완료 ---------- */}
      {draft.step === 5 && saved && (
        <Card tag="H" title="저장 완료! 선생님이 확인할 수 있어요" sub="수업 중에 고치고 싶으면 언제든 다시 열어 고칠 수 있어요.">
          <dl className="space-y-4 text-sm">
            <Summary label="곡">{saved.songs.map((s) => `${s.title}${s.artist ? ` - ${s.artist}` : ''}`).join(', ')}</Summary>
            <Summary label="나의 가설">{saved.hypothesis}</Summary>
            <Summary label="분석 기준">{saved.criterion === 'lyrics' ? '가사 측면' : '음악적 특징 측면'}</Summary>
            <Summary label="AI 결과와 내 느낌 비교">{saved.comparisonText}</Summary>
            <Summary label="나만의 언어로 재구성">{saved.reconstructionText}</Summary>
            {saved.evidenceText && <Summary label="대표 악기 소리·노랫말 구절">{saved.evidenceText}</Summary>}
          </dl>
          {saved.teacherFeedback && (
            <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
              <p className="text-xs font-medium text-teal-800">선생님 피드백</p>
              <p className="mt-1 whitespace-pre-line">{saved.teacherFeedback}</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className={primaryBtn} onClick={() => goStep(draft.aiResult ? 4 : 1)}>
              내 활동 고치기
            </button>
            <button type="button" className={ghostBtn} onClick={() => fetchMyAiActivity(saved.id, creds?.token ?? '').then((a) => a && setSaved(a))}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> 피드백 확인
            </button>
            <button type="button" className={ghostBtn} onClick={startOver}>
              다른 별칭으로 새로 시작
            </button>
          </div>
        </Card>
      )}
      {draft.step === 5 && !saved && (
        <StepNav next={{ label: '처음부터 하기', onClick: () => goStep(1) }} />
      )}
    </div>
  );
}

// ---------- 작은 부품들 ----------

function Card({ tag, title, sub, children }: { tag: 'H' | 'A'; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
            tag === 'A' ? 'bg-teal-700' : 'bg-slate-900'
          }`}
          aria-label={tag === 'A' ? 'AI가 돕는 단계' : '학생이 하는 단계'}
        >
          {tag}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label} {required && <span className="text-red-700">*</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Notice({ tone, children }: { tone: 'amber' | 'slate'; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
        tone === 'amber' ? 'border-amber-200 bg-amber-50/70 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

function StepNav({
  back,
  next,
  hint,
}: {
  back?: () => void;
  next: { label: string; disabled?: boolean; onClick: () => void };
  hint?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
      {back ? (
        <button type="button" className={ghostBtn} onClick={back}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 이전
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
        <button type="button" className={primaryBtn} disabled={next.disabled} onClick={next.onClick}>
          {next.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function CriterionCard({
  selected,
  title,
  desc,
  need,
  onSelect,
}: {
  selected: boolean;
  title: string;
  desc: string;
  need: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left transition-colors ${
        selected ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/15' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`inline-block h-4 w-4 rounded-full border-2 ${selected ? 'border-slate-900 bg-slate-900' : 'border-slate-400'}`}
          aria-hidden="true"
        />
        <span className="text-base font-semibold text-slate-900">{title}</span>
      </span>
      <span className="mt-2 block text-sm leading-relaxed text-slate-700">{desc}</span>
      <span className="mt-2 block text-xs text-slate-500">{need}</span>
    </button>
  );
}

export function AiResultView({ result }: { result: AiResult }) {
  return (
    <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-teal-900">
        <Sparkles className="h-4 w-4" aria-hidden="true" /> AI 분석 결과 <span className="font-normal">(생각할 재료일 뿐, 정답이 아니에요)</span>
      </p>
      {result.kind === 'lyrics' ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-600">자주 등장하는 감정 단어</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {result.emotionWords.map((e, i) => (
                <li key={i} className="rounded-full border border-teal-200 bg-white px-3 py-1 text-sm text-slate-900" title={e.example}>
                  {e.word}
                  {e.count > 0 && <span className="ml-1 text-xs text-slate-500">×{e.count}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600">핵심 주제 키워드</p>
            <ul className="mt-2 space-y-1.5">
              {result.themeKeywords.map((k, i) => (
                <li key={i} className="text-sm text-slate-800">
                  <strong className="text-slate-900">#{k.keyword}</strong> {k.reason && <span className="text-slate-600">— {k.reason}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {result.types.map((t, i) => (
            <li key={i} className="rounded-lg border border-teal-200 bg-white p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {i + 1}. {t.name}
              </p>
              {t.desire && <p className="mt-1 text-slate-700"><span className="text-xs text-slate-500">욕망 </span>{t.desire}</p>}
              {t.worry && <p className="mt-0.5 text-slate-700"><span className="text-xs text-slate-500">고민 </span>{t.worry}</p>}
              {t.evidence && <p className="mt-1.5 text-xs text-slate-500">근거: {t.evidence}</p>}
            </li>
          ))}
        </ul>
      )}
      {result.summary && <p className="mt-4 text-sm leading-relaxed text-slate-800">{result.summary}</p>}
      {result.limits && <p className="mt-2 text-xs text-slate-600">AI가 놓쳤을 수 있는 점: {result.limits}</p>}
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-slate-900">{children}</dd>
    </div>
  );
}
