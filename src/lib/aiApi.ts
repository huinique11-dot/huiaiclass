import type { RubricLevel } from '../types.ts';

// 4단계(7~8차시) 또래 음악 H-A-H 활동

export type AiCriterion = 'lyrics' | 'music';
export type Judgment = 'agree' | 'partly' | 'disagree';

export interface AiSong {
  title: string;
  artist: string;
  lyrics: string; // 분석에만 쓰고 서버에 저장하지 않음
  tempo: string;
  mood: string;
  instruments: string;
  lyricsContent: string;
}

export interface LyricsAiResult {
  kind: 'lyrics';
  emotionWords: { word: string; count: number; example: string }[];
  themeKeywords: { keyword: string; reason: string }[];
  summary: string;
  limits: string;
}

export interface MusicAiResult {
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

export interface AiStatus {
  connected: boolean; // /api 연결 여부
  enabled: boolean; // 교사가 AI 분석을 열었는지
  aiConnected: boolean; // Workers AI 바인딩 여부
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

export async function fetchAiStatus(): Promise<AiStatus> {
  try {
    const data = await call<{ enabled: boolean; aiConnected: boolean }>('/api/ai/status');
    return { connected: true, enabled: data.enabled, aiConnected: data.aiConnected };
  } catch {
    return { connected: false, enabled: false, aiConnected: false };
  }
}

export async function requestAiAnalysis(input: {
  criterion: AiCriterion;
  hypothesis: string;
  songs: AiSong[];
}): Promise<AiResult> {
  const data = await call<{ result: AiResult }>('/api/ai/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.result;
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

export async function setAiEnabled(enabled: boolean): Promise<{ enabled: boolean; aiConnected: boolean }> {
  return call('/api/ai/teacher/settings', { method: 'PUT', body: JSON.stringify({ enabled }) });
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
