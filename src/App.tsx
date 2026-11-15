import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  DEFAULT_LESSON,
  fetchPublicResponses,
  fetchTeacherResponses,
  loadInitialState,
  type StorageMode,
} from './lib/classroomApi.ts';
import { StudentActivityView } from './components/StudentActivityView.tsx';
import { ClassGalleryView } from './components/ClassGalleryView.tsx';
import { TeacherDashboardView } from './components/TeacherDashboardView.tsx';
import { ChristmasLights, ChristmasSky } from './components/ChristmasDecor.tsx';
import type { LessonConfig, StudentResponse, TeacherSessionState } from './types.ts';

type ActiveTab = 'activity' | 'gallery' | 'teacher';

const MY_CREDS_STORAGE_KEY = 'music_era_stage3_my_creds_v1';

interface MyCredentials {
  id: string;
  token: string;
}

function readStoredCreds(): MyCredentials | null {
  try {
    const raw = window.localStorage.getItem(MY_CREDS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MyCredentials>;
    if (typeof parsed.id === 'string' && typeof parsed.token === 'string' && parsed.id && parsed.token) {
      return { id: parsed.id, token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('activity');
  const [storageMode, setStorageMode] = useState<StorageMode>('pending-setup');
  const [statusMessage, setStatusMessage] = useState('');
  const [lesson, setLesson] = useState<LessonConfig>(DEFAULT_LESSON);
  const [publicResponses, setPublicResponses] = useState<StudentResponse[]>([]);
  const [teacherResponses, setTeacherResponses] = useState<StudentResponse[]>([]);
  const [myCreds, setMyCreds] = useState<MyCredentials | null>(() => readStoredCreds());
  const [myResponse, setMyResponse] = useState<StudentResponse | null>(null);
  const [teacherSession, setTeacherSession] = useState<TeacherSessionState>({
    authenticated: false,
    passwordConfigured: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const formRef = useRef<HTMLFormElement | null>(null);

  const fetchAll = useCallback(async () => {
    setLoadError('');
    try {
      const state = await loadInitialState(readStoredCreds());
      setStorageMode(state.storageMode);
      setStatusMessage(state.statusMessage);
      setLesson(state.lesson);
      setPublicResponses(state.publicResponses);
      setMyResponse(state.myResponse);
      setTeacherSession(state.teacherSession);

      if (state.storageMode === 'api-connected' && state.teacherSession.authenticated) {
        const all = await fetchTeacherResponses();
        setTeacherResponses(all);
      } else {
        setTeacherResponses([]);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '화면을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSavedResponse = async (saved: StudentResponse, editToken?: string) => {
    setStorageMode('api-connected');
    setStatusMessage('');
    setMyResponse(saved);

    if (editToken) {
      const nextCreds = { id: saved.id, token: editToken };
      setMyCreds(nextCreds);
      try {
        window.localStorage.setItem(MY_CREDS_STORAGE_KEY, JSON.stringify(nextCreds));
      } catch {
        // Ignore storage errors
      }
    }

    const pub = await fetchPublicResponses();
    if (pub.storageMode === 'api-connected') {
      setPublicResponses(pub.responses);
    }

    if (teacherSession.authenticated) {
      try {
        const all = await fetchTeacherResponses();
        setTeacherResponses(all);
      } catch {
        // Ignore background teacher refresh failure
      }
    }
  };

  const handleStartNewStudent = () => {
    setMyResponse(null);
    setMyCreds(null);
    try {
      window.localStorage.removeItem(MY_CREDS_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  const handleRefreshGallery = async () => {
    const pub = await fetchPublicResponses();
    setStorageMode(pub.storageMode);
    setPublicResponses(pub.responses);
  };

  const handleTeacherAuthChange = async (authenticated: boolean) => {
    setTeacherSession((prev) => ({ ...prev, authenticated }));
    if (authenticated) {
      const all = await fetchTeacherResponses();
      setTeacherResponses(all);
    } else {
      setTeacherResponses([]);
    }
  };

  const handleRefreshTeacherResponses = async () => {
    const all = await fetchTeacherResponses();
    setTeacherResponses(all);
  };

  const handleLessonUpdated = async (nextLesson: LessonConfig) => {
    setLesson(nextLesson);
    const pub = await fetchPublicResponses();
    setPublicResponses(pub.responses);
  };

  const handleResponseUpdated = async (updated: StudentResponse) => {
    setTeacherResponses((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (myResponse?.id === updated.id) {
      setMyResponse(updated);
    }
    const pub = await fetchPublicResponses();
    setPublicResponses(pub.responses);
  };

  const handleResponseDeleted = async (id: string) => {
    setTeacherResponses((prev) => prev.filter((r) => r.id !== id));
    setPublicResponses((prev) => prev.filter((r) => r.id !== id));
    if (myResponse?.id === id) {
      handleStartNewStudent();
    }
  };

  const scrollToWorksheet = () => {
    setActiveTab('activity');
    window.setTimeout(() => {
      const el = document.getElementById('workspace');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const input = document.getElementById('studentId') ?? document.getElementById('studentName');
      if (input instanceof HTMLInputElement) {
        input.focus({ preventScroll: true });
      }
    }, 60);
  };

  const scrollToGuide = () => {
    setActiveTab('activity');
    window.setTimeout(() => {
      const el = document.getElementById('guide');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  return (
    <div className="relative min-h-screen flex flex-col text-slate-900">
      <ChristmasSky />
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="xmas-velvet relative z-20 border-b border-xmas-gold/40 text-xmas-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:gap-8 sm:px-6 sm:py-4">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className="font-editorial min-h-[44px] text-left text-base font-semibold tracking-tight whitespace-nowrap shrink-0 cursor-pointer sm:text-lg"
          >
            <span aria-hidden="true" className="mr-1.5">🎄</span>
            <span className="gold-shimmer">음악으로 시대 읽기</span>
          </button>

          {/* Zone 2: 4 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-xmas-blush" aria-label="주 메뉴">
            <button
              type="button"
              onClick={scrollToGuide}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'activity' ? 'text-xmas-gold underline decoration-xmas-gold underline-offset-8' : 'hover:text-white'
              }`}
            >
              수업 안내
            </button>
            <button
              type="button"
              onClick={scrollToWorksheet}
              className="transition-colors hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              감상·활동지
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'gallery' ? 'text-xmas-gold underline decoration-xmas-gold underline-offset-8' : 'hover:text-white'
              }`}
            >
              서로의 관점
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('teacher')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'teacher' ? 'text-xmas-gold underline decoration-xmas-gold underline-offset-8' : 'hover:text-white'
              }`}
            >
              교사 확인
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={scrollToWorksheet}
              className="gold-button min-h-[44px] rounded-lg px-4 py-2 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer sm:text-sm"
            >
              ✦ 감성 문장 쓰기
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <nav
          className="grid grid-cols-3 border-t border-xmas-gold/20 px-2 md:hidden"
          aria-label="모바일 메뉴"
        >
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`min-h-[44px] px-2 py-2.5 text-center text-xs whitespace-nowrap ${
              activeTab === 'activity' ? 'font-semibold text-xmas-gold underline decoration-xmas-gold underline-offset-8' : 'font-medium text-xmas-blush'
            }`}
          >
            감상·활동지
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`min-h-[44px] px-2 py-2.5 text-center text-xs whitespace-nowrap ${
              activeTab === 'gallery' ? 'font-semibold text-xmas-gold underline decoration-xmas-gold underline-offset-8' : 'font-medium text-xmas-blush'
            }`}
          >
            서로의 관점
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('teacher')}
            className={`min-h-[44px] px-2 py-2.5 text-center text-xs whitespace-nowrap ${
              activeTab === 'teacher' ? 'font-semibold text-xmas-gold underline decoration-xmas-gold underline-offset-8' : 'font-medium text-xmas-blush'
            }`}
          >
            교사 확인
          </button>
        </nav>
        <ChristmasLights />
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            수업 활동 화면을 불러오는 중입니다...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-red-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">{loadError}</p>
            <button
              type="button"
              onClick={fetchAll}
              className="mt-4 min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              다시 불러오기
            </button>
          </div>
        ) : activeTab === 'activity' ? (
          <StudentActivityView
            lesson={lesson}
            storageMode={storageMode}
            statusMessage={statusMessage}
            myResponse={myResponse}
            myEditToken={myCreds?.token ?? null}
            onSaved={handleSavedResponse}
            onStartNewStudent={handleStartNewStudent}
            onGoToGallery={() => setActiveTab('gallery')}
            formRef={formRef}
          />
        ) : activeTab === 'gallery' ? (
          <ClassGalleryView
            lesson={lesson}
            storageMode={storageMode}
            responses={publicResponses}
            myResponseId={myResponse?.id ?? null}
            onRefresh={handleRefreshGallery}
            onGoToWrite={scrollToWorksheet}
          />
        ) : (
          <TeacherDashboardView
            lesson={lesson}
            storageMode={storageMode}
            statusMessage={statusMessage}
            teacherSession={teacherSession}
            responses={teacherResponses}
            onAuthenticatedChange={handleTeacherAuthChange}
            onLessonUpdated={handleLessonUpdated}
            onResponseUpdated={handleResponseUpdated}
            onResponseDeleted={handleResponseDeleted}
            onRefreshResponses={handleRefreshTeacherResponses}
            onCheckConnection={fetchAll}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="xmas-pine relative z-10 border-t-2 border-xmas-gold/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-teal-100 sm:gap-4 sm:px-6">
          <span>
            [읽걷쓰AI 프로젝트 수업] 무엇을 욕망했는가- 음악으로 시대 읽고 공감하기 · 3단계(5~6차시)
          </span>
          <span>
            {storageMode === 'api-connected'
              ? '중학교 2학년 음악 · Cloudflare D1 연결됨'
              : '중학교 2학년 음악 · 저장 준비 중'}
          </span>
        </div>
      </footer>
    </div>
  );
}
