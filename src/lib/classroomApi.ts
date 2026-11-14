import type { LessonConfig, RubricLevel, StudentResponse } from '../types.ts';

export type StorageMode = 'api-connected' | 'pending-setup';

export const DEFAULT_LESSON: LessonConfig = {
  eraTitle: '[확인 필요] 탐구할 시대를 입력해 주세요',
  songTitle: '[확인 필요] 감상할 시대별 대표곡 제목과 작곡가를 입력해 주세요',
  audioOrLinkUrl: '',
  historicalContext:
    '[확인 필요] 탐구할 시대의 역사적 배경과 당시 사람들의 삶의 상황을 입력해 주세요. (수업설계안 원문에는 구체적인 시대와 곡명이 명시되어 있지 않습니다.)',
  artworkNote: '[확인 필요] 함께 살펴볼 대표 미술작품이나 시각 자료 안내를 입력해 주세요.',
  empathyPrompt:
    '당시 시대 상황에 자신을 대입하여 음악을 감상하고, 그 시대 사람들의 마음과 욕망에 공감하며 느낀 개인의 감성을 문장으로 표현해 봅시다.',
  shareWithClass: true,
  isCustomized: false,
  updatedAt: new Date().toISOString(),
};

const DRAFT_LESSON_KEY = 'music_era_stage3_draft_lesson_v1';
const DRAFT_RESPONSES_KEY = 'music_era_stage3_draft_responses_v1';

async function fetchApiJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const contentType = res.headers.get('content-type') || '';
    // Vite SPA dev server returns index.html (text/html) for unknown /api routes.
    // Treat non-JSON or 404/501/503 responses as backend not connected yet.
    if (!res.ok || !contentType.includes('application/json')) {
      return { ok: false };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

function readLocalLesson(): LessonConfig {
  try {
    const raw = window.localStorage.getItem(DRAFT_LESSON_KEY);
    if (!raw) return DEFAULT_LESSON;
    return { ...DEFAULT_LESSON, ...(JSON.parse(raw) as Partial<LessonConfig>) };
  } catch {
    return DEFAULT_LESSON;
  }
}

function writeLocalLesson(lesson: LessonConfig): void {
  try {
    window.localStorage.setItem(DRAFT_LESSON_KEY, JSON.stringify(lesson));
  } catch {
    // Ignore storage errors
  }
}

function readLocalResponses(): StudentResponse[] {
  try {
    const raw = window.localStorage.getItem(DRAFT_RESPONSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StudentResponse[]) : [];
  } catch {
    return [];
  }
}

function writeLocalResponses(list: StudentResponse[]): void {
  try {
    window.localStorage.setItem(DRAFT_RESPONSES_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

export async function loadClassroomState(): Promise<{
  storageMode: StorageMode;
  lesson: LessonConfig;
  responses: StudentResponse[];
}> {
  const [lessonResult, responsesResult] = await Promise.all([
    fetchApiJson<LessonConfig>('/api/lesson'),
    fetchApiJson<StudentResponse[]>('/api/responses'),
  ]);

  if (lessonResult.ok && responsesResult.ok) {
    return {
      storageMode: 'api-connected',
      lesson: lessonResult.data,
      responses: responsesResult.data,
    };
  }

  return {
    storageMode: 'pending-setup',
    lesson: readLocalLesson(),
    responses: readLocalResponses(),
  };
}

export async function saveLessonConfig(
  next: Omit<LessonConfig, 'isCustomized' | 'updatedAt'>,
): Promise<{ storageMode: StorageMode; lesson: LessonConfig }> {
  const apiResult = await fetchApiJson<LessonConfig>('/api/lesson', {
    method: 'PUT',
    body: JSON.stringify(next),
  });

  if (apiResult.ok) {
    return { storageMode: 'api-connected', lesson: apiResult.data };
  }

  const localLesson: LessonConfig = {
    ...next,
    isCustomized: true,
    updatedAt: new Date().toISOString(),
  };
  writeLocalLesson(localLesson);
  return { storageMode: 'pending-setup', lesson: localLesson };
}

export async function submitStudentResponse(payload: {
  id?: string;
  studentName: string;
  classGroup: string;
  reflectionText: string;
  presentConnection: string;
}): Promise<{ storageMode: StorageMode; response: StudentResponse }> {
  if (payload.id) {
    const apiResult = await fetchApiJson<StudentResponse>(`/api/responses/${payload.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        studentName: payload.studentName,
        classGroup: payload.classGroup,
        reflectionText: payload.reflectionText,
        presentConnection: payload.presentConnection,
      }),
    });
    if (apiResult.ok) {
      return { storageMode: 'api-connected', response: apiResult.data };
    }
  } else {
    const apiResult = await fetchApiJson<StudentResponse>('/api/responses', {
      method: 'POST',
      body: JSON.stringify({
        studentName: payload.studentName,
        classGroup: payload.classGroup,
        reflectionText: payload.reflectionText,
        presentConnection: payload.presentConnection,
      }),
    });
    if (apiResult.ok) {
      return { storageMode: 'api-connected', response: apiResult.data };
    }
  }

  const now = new Date().toISOString();
  const list = readLocalResponses();
  if (payload.id) {
    const idx = list.findIndex((item) => item.id === payload.id);
    if (idx !== -1) {
      const updated: StudentResponse = {
        ...list[idx],
        studentName: payload.studentName,
        classGroup: payload.classGroup,
        reflectionText: payload.reflectionText,
        presentConnection: payload.presentConnection,
        updatedAt: now,
      };
      list[idx] = updated;
      writeLocalResponses(list);
      return { storageMode: 'pending-setup', response: updated };
    }
  }

  const created: StudentResponse = {
    id: crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`,
    studentName: payload.studentName,
    classGroup: payload.classGroup,
    reflectionText: payload.reflectionText,
    presentConnection: payload.presentConnection,
    rubricLevel: '',
    teacherFeedback: '',
    createdAt: now,
    updatedAt: now,
  };
  writeLocalResponses([created, ...list]);
  return { storageMode: 'pending-setup', response: created };
}

export async function updateTeacherReview(
  id: string,
  rubricLevel: RubricLevel,
  teacherFeedback: string,
): Promise<{ storageMode: StorageMode; response: StudentResponse | null }> {
  const apiResult = await fetchApiJson<StudentResponse>(`/api/responses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ rubricLevel, teacherFeedback }),
  });
  if (apiResult.ok) {
    return { storageMode: 'api-connected', response: apiResult.data };
  }

  const list = readLocalResponses();
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) {
    return { storageMode: 'pending-setup', response: null };
  }
  const updated: StudentResponse = {
    ...list[idx],
    rubricLevel,
    teacherFeedback,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  writeLocalResponses(list);
  return { storageMode: 'pending-setup', response: updated };
}

export async function deleteStudentResponse(id: string): Promise<{ storageMode: StorageMode }> {
  try {
    const res = await fetch(`/api/responses/${id}`, { method: 'DELETE' });
    if (res.ok && res.status === 204) {
      return { storageMode: 'api-connected' };
    }
  } catch {
    // Fallback to pending-setup local draft removal
  }

  const list = readLocalResponses().filter((item) => item.id !== id);
  writeLocalResponses(list);
  return { storageMode: 'pending-setup' };
}
