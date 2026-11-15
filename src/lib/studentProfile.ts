import type { StudentProfile } from '../types.ts';

// 학생이 처음 한 번 입력한 학번·별칭·반을 이 기기에 기억해 두고 모든 활동에 씁니다.
const PROFILE_KEY = 'music_student_profile_v1';

// 학생이 바뀌면 지워야 하는 이 기기의 개인 활동 기록
const PERSONAL_KEYS = [
  'music_era_stage3_my_creds_v1',
  'music_era_stage4_ai_creds_v1',
  'music_era_stage4_ai_draft_v1',
  'music_era_selection_v1',
];

export function readProfile(): StudentProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StudentProfile>;
    if (typeof p.studentId === 'string' && p.studentId && typeof p.studentName === 'string' && p.studentName) {
      return { studentId: p.studentId, studentName: p.studentName, classGroup: typeof p.classGroup === 'string' ? p.classGroup : '' };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: StudentProfile) {
  try {
    const prev = readProfile();
    // 다른 학생으로 들어오면 앞 학생의 기록 연결을 끊음
    if (!prev || prev.studentId !== profile.studentId || prev.studentName !== profile.studentName) {
      clearPersonalData();
    }
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // 저장 공간을 쓸 수 없는 환경이면 이번 접속 동안만 사용
  }
}

export function clearProfile() {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    // 무시
  }
  clearPersonalData();
}

function clearPersonalData() {
  for (const key of PERSONAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 무시
    }
  }
}

export const ACHIEVEMENT_STANDARDS = [
  { code: '9음02-02', text: '다양한 시대와 문화권의 음악을 듣고 음악적 특징과 음악의 구성을 파악한다.' },
  { code: '9음02-03', text: '다양한 시대⋅사회⋅문화권의 음악을 듣고 음악의 배경과 역할을 비교한다.' },
];

// 수업설계안의 4P(관-질-탐-행) 흐름
export const FOUR_P = [
  {
    key: 'P1',
    name: '현상 · 관찰하기',
    stage: '1단계 (1~2차시)',
    body: '시대별 역사적 사건, 대표 미술작품, 그 시대의 음악을 보고 듣고 느끼며 시대의 사고방식을 살펴봐요.',
  },
  {
    key: 'P2',
    name: '문제 · 질문하기',
    stage: '1단계 (1~2차시)',
    body: '“사람들은 어떤 방식으로 음악을 통해 세상을/메시지를 표현하는가?” 떠오른 질문을 모아 모둠 탐구 질문으로 다듬어요.',
  },
  {
    key: 'P3',
    name: '과업 · 탐구하기',
    stage: '2~5단계 (3~10차시)',
    body: '대표곡의 음악 요소를 분석하고, 시대 상황에 나를 대입해 감성 문장을 쓰고, 또래 음악을 AI와 함께 비교·대조해요.',
  },
  {
    key: 'P4',
    name: '실천 · 행동하기',
    stage: '6단계 (11~12차시)',
    body: '발표 자료를 학급에 공유하고, 공감하는 관점에 응원 쪽지나 한 줄 질문을 건네며 지금 시대를 정의해요.',
  },
] as const;
