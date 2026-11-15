import type { LessonConfig, RubricLevel, StudentResponse, TeacherSessionState } from '../types.ts';

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
  updatedAt: new Date(0).toISOString(),
};

interface ApiResult<T> {
  connected: boolean;
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function requestApi<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.status === 204) {
      return { connected: true, ok: true, status: 204 };
    }

    if (!contentType.includes('application/json')) {
      return {
        connected: false,
        ok: false,
        status: res.status,
        error: '데이터 저장소(/api)가 아직 연결되지 않았습니다. (저장 준비 중)',
      };
    }

    const parsed = (await res.json()) as T & { error?: string };
    if (!res.ok) {
      return {
        connected: res.status !== 503,
        ok: false,
        status: res.status,
        error: parsed?.error || '요청을 처리하지 못했습니다.',
      };
    }

    return { connected: true, ok: true, status: res.status, data: parsed };
  } catch {
    return {
      connected: false,
      ok: false,
      status: 0,
      error: '데이터 저장소(/api)에 연결할 수 없습니다. (저장 준비 중)',
    };
  }
}

export async function loadInitialState(myCreds: { id: string; token: string } | null): Promise<{
  storageMode: StorageMode;
  lesson: LessonConfig;
  publicResponses: StudentResponse[];
  myResponse: StudentResponse | null;
  teacherSession: TeacherSessionState;
  statusMessage: string;
}> {
  const healthRes = await requestApi<{ ok: boolean; dbConnected: boolean }>('/api/health');

  if (!healthRes.connected || !healthRes.ok) {
    return {
      storageMode: 'pending-setup',
      lesson: DEFAULT_LESSON,
      publicResponses: [],
      myResponse: null,
      teacherSession: { authenticated: false, passwordConfigured: false },
      statusMessage: healthRes.error || '데이터 저장소(/api)가 아직 연결되지 않았습니다. (저장 준비 중)',
    };
  }

  const [lessonRes, publicRes, sessionRes, myRes] = await Promise.all([
    requestApi<LessonConfig>('/api/lesson'),
    requestApi<StudentResponse[]>('/api/public-responses'),
    requestApi<TeacherSessionState>('/api/teacher/session'),
    myCreds
      ? requestApi<StudentResponse>(
          `/api/my-response?id=${encodeURIComponent(myCreds.id)}&token=${encodeURIComponent(myCreds.token)}`,
        )
      : Promise.resolve(null),
  ]);

  return {
    storageMode: 'api-connected',
    lesson: lessonRes.ok && lessonRes.data ? lessonRes.data : DEFAULT_LESSON,
    publicResponses: publicRes.ok && Array.isArray(publicRes.data) ? publicRes.data : [],
    myResponse: myRes && myRes.ok && myRes.data ? myRes.data : null,
    teacherSession:
      sessionRes.ok && sessionRes.data
        ? sessionRes.data
        : { authenticated: false, passwordConfigured: false },
    statusMessage: '',
  };
}

export async function fetchPublicResponses(): Promise<{
  storageMode: StorageMode;
  responses: StudentResponse[];
  error?: string;
}> {
  const res = await requestApi<StudentResponse[]>('/api/public-responses');
  if (!res.connected) {
    return { storageMode: 'pending-setup', responses: [], error: res.error };
  }
  if (!res.ok || !res.data) {
    return { storageMode: 'api-connected', responses: [], error: res.error };
  }
  return { storageMode: 'api-connected', responses: res.data };
}

export async function submitStudentResponse(payload: {
  id?: string;
  editToken?: string;
  studentId: string;
  studentName: string;
  classGroup: string;
  reflectionText: string;
  presentConnection: string;
  isPublic: boolean;
}): Promise<{ response: StudentResponse; editToken?: string }> {
  if (payload.id && payload.editToken) {
    const res = await requestApi<StudentResponse>(`/api/my-response/${encodeURIComponent(payload.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        editToken: payload.editToken,
        studentId: payload.studentId,
        studentName: payload.studentName,
        classGroup: payload.classGroup,
        reflectionText: payload.reflectionText,
        presentConnection: payload.presentConnection,
        isPublic: payload.isPublic,
      }),
    });
    if (!res.ok || !res.data) {
      throw new Error(res.error || '수정한 응답을 저장하지 못했습니다.');
    }
    return { response: res.data, editToken: payload.editToken };
  }

  const res = await requestApi<{ response: StudentResponse; editToken: string }>('/api/responses', {
    method: 'POST',
    body: JSON.stringify({
      studentId: payload.studentId,
      studentName: payload.studentName,
      classGroup: payload.classGroup,
      reflectionText: payload.reflectionText,
      presentConnection: payload.presentConnection,
      isPublic: payload.isPublic,
    }),
  });

  if (!res.ok || !res.data) {
    throw new Error(res.error || '응답을 저장하지 못했습니다.');
  }
  return res.data;
}

export async function loginTeacher(password: string): Promise<void> {
  const res = await requestApi<{ authenticated: boolean }>('/api/teacher/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new Error(res.error || '교사 로그인에 실패했습니다.');
  }
}

export async function logoutTeacher(): Promise<void> {
  const res = await requestApi<{ authenticated: boolean }>('/api/teacher/logout', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(res.error || '로그아웃 처리에 실패했습니다.');
  }
}

export async function fetchTeacherResponses(): Promise<StudentResponse[]> {
  const res = await requestApi<StudentResponse[]>('/api/responses');
  if (!res.ok || !res.data) {
    throw new Error(res.error || '학생 응답 목록을 불러오지 못했습니다.');
  }
  return res.data;
}

export async function saveLessonConfig(
  next: Omit<LessonConfig, 'isCustomized' | 'updatedAt'>,
): Promise<LessonConfig> {
  const res = await requestApi<LessonConfig>('/api/lesson', {
    method: 'PUT',
    body: JSON.stringify(next),
  });
  if (!res.ok || !res.data) {
    throw new Error(res.error || '수업 자료를 저장하지 못했습니다.');
  }
  return res.data;
}

export async function updateTeacherReview(
  id: string,
  rubricLevel: RubricLevel,
  teacherFeedback: string,
): Promise<StudentResponse> {
  const res = await requestApi<StudentResponse>(`/api/responses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ rubricLevel, teacherFeedback }),
  });
  if (!res.ok || !res.data) {
    throw new Error(res.error || '평가와 피드백을 저장하지 못했습니다.');
  }
  return res.data;
}

export async function deleteStudentResponse(id: string): Promise<void> {
  const res = await requestApi<void>(`/api/responses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(res.error || '응답을 삭제하지 못했습니다.');
  }
}
