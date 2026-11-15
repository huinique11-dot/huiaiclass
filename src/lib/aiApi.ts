import type { RubricLevel } from '../types.ts';

// 4단계(7~8차시) 또래 음악 H-A-H 활동
// AI는 학생이 필요할 때만, 각자 자기 계정의 AI 도구에서 씁니다. 앱은 질문(프롬프트)을 만들어 주고,
// 학생이 받은 답을 붙여 넣은 뒤 핵심 항목을 직접 골라 정리합니다.

export type AiCriterion = 'lyrics' | 'music';
export type Judgment = 'agree' | 'partly' | 'disagree';

export interface AiSong {
  title: string;
  artist: string;
  lyrics: string; // 사용하지 않음(가사는 학생이 자기 AI에만 붙여 넣음)
  tempo: string;
  mood: string;
  instruments: string;
  lyricsContent: string;
}

interface ResultMeta {
  source?: 'ai' | 'self'; // AI 도움 / AI 없이 직접 분석
  tool?: string; // 학생이 쓴 AI 도구 이름
  rawText?: string; // 붙여 넣은 AI 답변
}

export interface LyricsAiResult extends ResultMeta {
  kind: 'lyrics';
  emotionWords: { word: string; count: number; example: string }[];
  themeKeywords: { keyword: string; reason: string }[];
  summary: string;
  limits: string;
}

export interface MusicAiResult extends ResultMeta {
  kind: 'music';
  types: { name: string; desire: string; worry: string; evidence: string }[];
  summary: string;
  limits: string;
}

export type AiResult = LyricsAiResult | MusicAiResult;

export interface AiActivity {
  id: string;
  studentId: string;
  studentName: string;
  classGroup: string;
  songs: Omit<AiSong, 'lyrics'>[];
  hypothesis: string;
  criterion: AiCriterion | '';
  aiResult: AiResult | null;
  judgments: Record<string, Judgment>;
  comparisonText: string;
  reconstructionText: string;
  evidenceText: string;
  ethicsText: string;
  rubricLevel: RubricLevel;
  teacherFeedback: string;
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_SONG: AiSong = {
  title: '',
  artist: '',
  lyrics: '',
  tempo: '',
  mood: '',
  instruments: '',
  lyricsContent: '',
};

export const AI_ETHICS_QUESTION =
  'AI가 분석한 음악의 공통 키워드와 감정 분류가 우리 세대의 마음이나 시대의 실제 욕망을 온전히 담아냈다고 볼 수 있을까?';

export const AI_RUBRIC: Record<'상' | '중' | '하', string> = {
  상: 'AI 분석 결과를 자신이 실제로 느낀 감정·음악적 근거와 구체적으로 비교해 맞는 점과 다른 점을 가려내고, 공감하는 내용을 자신만의 언어로 주체적으로 재구성함.',
  중: 'AI 분석 결과와 자신의 느낌을 비교하고, 공감하는 항목을 골라 자신의 말로 정리함.',
  하: 'AI 분석 결과 중 공감하는 항목을 고르고 느낀 점을 짧게 씀.',
};

export const JUDGMENT_LABELS: Record<Judgment, string> = {
  agree: '공감해요',
  partly: '조금 달라요',
  disagree: '공감 안 돼요',
};

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new Error('데이터 저장소(/api)에 연결할 수 없습니다.');
  }
  if (res.status === 204) return undefined as T;
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  if (!isJson) throw new Error('데이터 저장소(/api)가 아직 연결되지 않았습니다. (저장 준비 중)');
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || '요청을 처리하지 못했습니다.');
  return data;
}

export interface SaveAiActivityInput {
  id?: string;
  editToken?: string;
  studentId: string;
  studentName: string;
  classGroup: string;
  songs: AiSong[];
  hypothesis: string;
  criterion: AiCriterion;
  aiResult: AiResult;
  judgments: Record<string, Judgment>;
  comparisonText: string;
  reconstructionText: string;
  evidenceText: string;
  ethicsText: string;
}

export async function saveAiActivity(input: SaveAiActivityInput): Promise<{ activity: AiActivity; editToken: string }> {
  // 가사 원문은 보내지 않음(서버에도 저장하지 않음)
  const songs = input.songs.map((s) => ({ ...s, lyrics: '' }));
  return call('/api/ai/activities', { method: 'POST', body: JSON.stringify({ ...input, songs }) });
}

export async function fetchMyAiActivity(id: string, token: string): Promise<AiActivity | null> {
  try {
    return await call<AiActivity>(
      `/api/ai/my-activity?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`,
    );
  } catch {
    return null;
  }
}

export async function fetchTeacherAiActivities(): Promise<AiActivity[]> {
  return call('/api/ai/teacher/activities');
}

export async function updateAiActivityEvaluation(
  id: string,
  rubricLevel: RubricLevel,
  teacherFeedback: string,
): Promise<AiActivity> {
  return call(`/api/ai/teacher/activities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ rubricLevel, teacherFeedback }),
  });
}

export async function deleteAiActivity(id: string): Promise<void> {
  await call(`/api/ai/teacher/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// 판단(공감 여부)을 매길 AI 결과 항목 목록
export function judgmentItems(result: AiResult | null): { key: string; label: string; detail: string }[] {
  if (!result) return [];
  if (result.kind === 'lyrics') {
    return [
      ...result.emotionWords.map((e, i) => ({
        key: `emotion-${i}`,
        label: `감정 단어 · ${e.word}`,
        detail: [e.count ? `약 ${e.count}번` : '', e.example ? `“${e.example}”` : ''].filter(Boolean).join(' · '),
      })),
      ...result.themeKeywords.map((k, i) => ({
        key: `theme-${i}`,
        label: `주제 키워드 · ${k.keyword}`,
        detail: k.reason,
      })),
    ];
  }
  return result.types.map((t, i) => ({
    key: `type-${i}`,
    label: `유형 · ${t.name}`,
    detail: [t.desire && `욕망: ${t.desire}`, t.worry && `고민: ${t.worry}`].filter(Boolean).join(' / '),
  }));
}

// 학생이 자기 AI 도구에 붙여 넣을 질문 만들기 (학생 이름·가설은 넣지 않음)
export function buildAiPrompt(criterion: AiCriterion, songs: AiSong[]): string {
  const list = songs
    .filter((x) => x.title.trim())
    .map((x, i) => `${i + 1}) ${x.title.trim()}${x.artist.trim() ? ` - ${x.artist.trim()}` : ''}`)
    .join('\n');
  if (criterion === 'lyrics') {
    return [
      '나는 중학교 2학년이고, 음악 시간에 요즘 또래가 즐겨 듣는 노래의 가사를 분석하고 있어.',
      `곡:\n${list}`,
      '',
      '아래에 붙여 넣는 가사를 읽고 다음을 정리해 줘.',
      '1. 자주 등장하는 감정 단어 4~8개 (많이 나온 순서대로, 대략 몇 번 나왔는지와 그 감정이 드러난 짧은 구절)',
      '2. 핵심 주제 키워드 3~5개 (왜 그 키워드인지 한 문장씩)',
      '3. 가사에 드러난 오늘날 또래의 마음을 2문장으로 요약',
      '4. 이 분석이 놓쳤을 수 있는 점 한 문장',
      '정답처럼 단정하지 말고, 가사에 없는 내용은 지어내지 마. 중학생이 이해하기 쉬운 말로 써 줘.',
      '',
      '[가사]',
      '(여기에 가사를 붙여 넣으세요)',
    ].join('\n');
  }
  const features = songs
    .filter((x) => x.title.trim())
    .map(
      (x, i) =>
        `${i + 1}) ${x.title.trim()}${x.artist.trim() ? ` - ${x.artist.trim()}` : ''}\n   템포: ${x.tempo.trim() || '-'} / 분위기: ${x.mood.trim() || '-'} / 악기 구성: ${x.instruments.trim() || '-'} / 가사 내용: ${x.lyricsContent.trim() || '-'}`,
    )
    .join('\n');
  return [
    '나는 중학교 2학년이고, 음악 시간에 요즘 또래가 즐겨 듣는 노래를 분석하고 있어.',
    '아래는 내가 직접 들으며 적은 곡의 특징이야.',
    features,
    '',
    '이 템포, 분위기, 악기 구성, 가사 내용을 바탕으로 오늘날 세대가 공유하는 욕망과 고민의 유형을 3~4가지로 분류해 줘.',
    '각 유형마다 ① 유형 이름 ② 바라는 것(욕망) 한 문장 ③ 고민 한 문장 ④ 근거가 된 곡의 특징을 적어 줘.',
    '마지막에 이 분류가 놓쳤을 수 있는 점을 한 문장 써 줘.',
    '정답처럼 단정하지 말고, 내가 적지 않은 사실은 지어내지 마. 중학생이 이해하기 쉬운 말로 써 줘.',
  ].join('\n');
}
