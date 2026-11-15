import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ClipboardCheck, Headphones, LogOut, Sparkles, UserRound, Users } from 'lucide-react';
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
import { AiAnalysisView } from './components/AiAnalysisView.tsx';
import { TeacherAiPanel } from './components/TeacherAiPanel.tsx';
import { StudentEntry } from './components/StudentEntry.tsx';
import { clearProfile, readProfile, saveProfile } from './lib/studentProfile.ts';
import type { LessonConfig, StudentProfile, StudentResponse, TeacherSessionState } from './types.ts';

const TABS = [
  { key: 'activity', label: '감상·활동지', short: '감상·활동지', stage: '3단계', Icon: Headphones },
  { key: 'gallery', label: '서로의 관점', short: '서로의 관점', stage: '3단계 정리', Icon: Users },
  { key: 'ai', label: 'AI 또래 음악 분석', short: 'AI 분석', stage: '4단계', Icon: Sparkles },
  { key: 'teacher', label: '교사 확인', short: '교사 확인', stage: '선생님', Icon: ClipboardCheck },
] as const;

type ActiveTab = 'activity' | 'gallery' | 'ai' | 'teacher';

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
  const [profile, setProfile] = useState<StudentProfile | null>(() => readProfile());
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

  // 앞서 다른 학생이 쓴 글이 이 기기에 연결돼 있으면 끊기
  useEffect(() => {
    if (profile && myResponse && myResponse.studentId !== profile.studentId) {
      handleStartNewStudent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, myResponse]);

  const handleEnter = (next: StudentProfile) => {
    saveProfile(next);
    setProfile(next);
    const creds = readStoredCreds();
    setMyCreds(creds);
    if (!creds) setMyResponse(null);
    setActiveTab((t) => (t === 'teacher' ? 'activity' : t));
  };

  const handleLeave = () => {
    if (!window.confirm('나갈까요? 이 기기에서 내 활동 연결이 지워져요. (저장한 글은 선생님께 그대로 남아요)')) return;
    clearProfile();
    setProfile(null);
    setMyCreds(null);
    setMyResponse(null);
    setActiveTab('activity');
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
      <header className="xmas-velvet relative z-20 text-xmas-cream">
        <ChristmasLights top />
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5 pb-3 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className="font-editorial min-h-[44px] text-left text-base font-semibold tracking-tight whitespace-nowrap shrink-0 cursor-pointer sm:text-lg"
          >
            <span aria-hidden="true" className="mr-1.5">🎄</span>
            <span className="gold-shimmer">음악으로 시대 읽기</span>
          </button>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {profile && (
              <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-xmas-gold/40 bg-white/10 py-1 pl-3 pr-1 text-xs sm:text-sm">
                <UserRound className="h-4 w-4 shrink-0 text-xmas-gold" aria-hidden="true" />
                <span className="hidden font-mono text-xmas-blush sm:inline">{profile.studentId}</span>
                <strong className="truncate font-semibold">{profile.studentName}</strong>
                <button
                  type="button"
                  onClick={handleLeave}
                  className="ml-1 inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 text-xs text-xmas-blush hover:bg-white/15 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>나가기</span>
                </button>
              </div>
            )}
            {profile && (
              <button
                type="button"
                onClick={scrollToWorksheet}
                className="gold-button hidden min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition whitespace-nowrap shrink-0 cursor-pointer md:inline-flex md:items-center"
              >
                ✦ 감성 문장 쓰기
              </button>
            )}
          </div>
        </div>

        {/* 브라우저 탭처럼 지금 열린 화면이 본문과 이어져 보이게 */}
        <nav className="mx-auto max-w-6xl px-2 sm:px-6" aria-label="주 메뉴">
          <div role="tablist" className="grid grid-cols-4 items-end gap-1 sm:flex sm:gap-1.5">
            {TABS.map(({ key, label, short, stage, Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(key)}
                  className={`xmas-tab relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-t-xl px-2 text-center transition-colors sm:flex-row sm:gap-2 sm:px-5 ${
                    active
                      ? 'xmas-tab-active z-10 min-h-[58px] bg-slate-50 text-slate-900 sm:min-h-[52px]'
                      : 'min-h-[50px] bg-black/20 text-xmas-blush hover:bg-white/10 hover:text-white sm:min-h-[44px]'
                  }`}
                >
                  {active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-xmas-gold" aria-hidden="true" />}
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-xmas-crimson' : ''}`} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col sm:items-start">
                    <span className={`truncate text-[11px] leading-tight sm:text-sm ${active ? 'font-bold' : 'font-medium'}`}>
                      <span className="sm:hidden">{short}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </span>
                    <span className={`hidden text-[10px] leading-tight sm:block ${active ? 'text-slate-500' : 'text-xmas-blush/70'}`}>{stage}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
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
        ) : !profile && activeTab !== 'teacher' ? (
          <StudentEntry onEnter={handleEnter} onGoTeacher={() => setActiveTab('teacher')} />
        ) : activeTab === 'activity' && profile ? (
          <StudentActivityView
            lesson={lesson}
            profile={profile}
            storageMode={storageMode}
            statusMessage={statusMessage}
            myResponse={myResponse}
            myEditToken={myCreds?.token ?? null}
            onSaved={handleSavedResponse}
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
        ) : activeTab === 'ai' && profile ? (
          <AiAnalysisView key={`${profile.studentId}-${profile.studentName}`} profile={profile} />
        ) : (
          <>
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
          {storageMode === 'api-connected' && teacherSession.authenticated && <TeacherAiPanel />}
          </>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="xmas-pine relative z-10 border-t-2 border-xmas-gold/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-teal-100 sm:gap-4 sm:px-6">
          <span>
            [읽걷쓰AI 프로젝트 수업] 무엇을 욕망했는가- 음악으로 시대 읽고 공감하기 · 3단계(5~6차시) · 4단계(7~8차시)
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
