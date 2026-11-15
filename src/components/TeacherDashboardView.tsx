import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Settings2,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  deleteStudentResponse,
  loginTeacher,
  logoutTeacher,
  saveLessonConfig,
  updateTeacherReview,
  type StorageMode,
} from '../lib/classroomApi.ts';
import { compressArtworkImageFile } from '../lib/imageUpload.ts';
import { isValidHttpUrl, parseYouTubeUrl } from '../lib/youtube.ts';
import type {
  ArtworkItem,
  LessonConfig,
  RubricLevel,
  StudentResponse,
  TeacherSessionState,
} from '../types.ts';
import { ArtworkGallery } from './ArtworkGallery.tsx';

interface TeacherDashboardViewProps {
  lesson: LessonConfig;
  storageMode: StorageMode;
  statusMessage: string;
  teacherSession: TeacherSessionState;
  responses: StudentResponse[];
  onAuthenticatedChange: (authenticated: boolean) => Promise<void>;
  onLessonUpdated: (next: LessonConfig) => void;
  onResponseUpdated: (next: StudentResponse) => void;
  onResponseDeleted: (id: string) => void;
  onRefreshResponses: () => Promise<void>;
  onCheckConnection: () => Promise<void>;
}

const RUBRIC_DESCRIPTIONS: Record<'상' | '중' | '하', string> = {
  상: '음악에 드러난 시대 상황과 정서에 공감하며, 자신이 살아가는 지금 시대를 바라보는 주체적인 관점을 구체적인 문장으로 밝혀 표현함.',
  중: '음악에 나타난 시대 상황을 이해하고, 지금 시대를 바라보는 자신의 생각을 문장으로 표현함.',
  하: '주어진 질문을 바탕으로 음악을 듣고 느낀 점과 지금 시대에 대한 생각을 문장으로 씀.',
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function buildArtworkSlots(artworks?: ArtworkItem[]): ArtworkItem[] {
  const bySlot = new Map<number, ArtworkItem>();
  for (const item of artworks ?? []) {
    if (item.slotIndex >= 0 && item.slotIndex <= 3) {
      bySlot.set(item.slotIndex, item);
    }
  }
  return [0, 1, 2, 3].map((slotIndex) => {
    const existing = bySlot.get(slotIndex);
    return {
      slotIndex,
      title: existing?.title ?? '',
      imageUrl: existing?.imageUrl ?? '',
      description: existing?.description ?? '',
    };
  });
}

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  lesson,
  storageMode,
  statusMessage,
  teacherSession,
  responses,
  onAuthenticatedChange,
  onLessonUpdated,
  onResponseUpdated,
  onResponseDeleted,
  onRefreshResponses,
  onCheckConnection,
}) => {
  // Login form state
  const [passwordInput, setPasswordInput] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  // Dashboard filters & UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [rubricFilter, setRubricFilter] = useState<'전체' | '미평가' | '상' | '중' | '하'>('전체');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [sortOrder, setSortOrder] = useState<'studentId' | 'latest'>('studentId');
  const [showLessonEditor, setShowLessonEditor] = useState(!lesson.isCustomized);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState('');

  // Lesson editor state
  const [eraTitle, setEraTitle] = useState(lesson.eraTitle);
  const [songTitle, setSongTitle] = useState(lesson.songTitle);
  const [audioOrLinkUrl, setAudioOrLinkUrl] = useState(lesson.audioOrLinkUrl);
  const [historicalContext, setHistoricalContext] = useState(lesson.historicalContext);
  const [artworkNote, setArtworkNote] = useState(lesson.artworkNote);
  const [artworkSlots, setArtworkSlots] = useState<ArtworkItem[]>(() => buildArtworkSlots(lesson.artworks));
  const [artworkPreviewMode, setArtworkPreviewMode] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [artworkUploadError, setArtworkUploadError] = useState('');
  const [empathyPrompt, setEmpathyPrompt] = useState(lesson.empathyPrompt);
  const [shareWithClass, setShareWithClass] = useState(lesson.shareWithClass);
  const [savingLesson, setSavingLesson] = useState(false);
  const [lessonSavedNotice, setLessonSavedNotice] = useState('');
  const [lessonErrorNotice, setLessonErrorNotice] = useState('');

  useEffect(() => {
    setEraTitle(lesson.eraTitle);
    setSongTitle(lesson.songTitle);
    setAudioOrLinkUrl(lesson.audioOrLinkUrl);
    setHistoricalContext(lesson.historicalContext);
    setArtworkNote(lesson.artworkNote);
    setArtworkSlots(buildArtworkSlots(lesson.artworks));
    setEmpathyPrompt(lesson.empathyPrompt);
    setShareWithClass(lesson.shareWithClass);
  }, [lesson]);

  const previewYouTube = parseYouTubeUrl(audioOrLinkUrl);
  const previewValidUrl = isValidHttpUrl(audioOrLinkUrl);
  const activeArtworksPreview = useMemo(
    () =>
      artworkSlots.filter(
        (slot) => slot.title.trim() || slot.imageUrl.trim() || slot.description.trim(),
      ),
    [artworkSlots],
  );

  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = responses.length;
    const evaluated = responses.filter((r) => r.rubricLevel !== '').length;
    const publicCount = responses.filter((r) => r.isPublic).length;
    return { total, evaluated, publicCount };
  }, [responses]);

  const filteredResponses = useMemo(() => {
    const matched = responses.filter((r) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesQuery =
        !q ||
        r.studentId.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.classGroup.toLowerCase().includes(q) ||
        r.reflectionText.toLowerCase().includes(q) ||
        r.presentConnection.toLowerCase().includes(q);

      const matchesRubric =
        rubricFilter === '전체'
          ? true
          : rubricFilter === '미평가'
          ? r.rubricLevel === ''
          : r.rubricLevel === rubricFilter;

      return matchesQuery && matchesRubric;
    });

    return [...matched].sort((a, b) => {
      if (sortOrder === 'studentId') {
        const idCompare = (a.studentId || 'zzzz').localeCompare(b.studentId || 'zzzz', 'ko', {
          numeric: true,
        });
        if (idCompare !== 0) return idCompare;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [responses, searchTerm, rubricFilter, sortOrder]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!passwordInput.trim()) {
      setLoginError('교사 비밀번호를 입력해 주세요.');
      return;
    }
    setLoggingIn(true);
    try {
      await loginTeacher(passwordInput);
      setPasswordInput('');
      await onAuthenticatedChange(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setActionError('');
    setLoggingOut(true);
    try {
      await logoutTeacher();
      await onAuthenticatedChange(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '로그아웃 처리에 실패했습니다.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleRefresh = async () => {
    setActionError('');
    setRefreshing(true);
    try {
      await onRefreshResponses();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '응답 목록을 새로고침하지 못했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  const updateArtworkSlot = (slotIndex: number, patch: Partial<ArtworkItem>) => {
    setArtworkSlots((prev) =>
      prev.map((slot) => (slot.slotIndex === slotIndex ? { ...slot, ...patch } : slot)),
    );
  };

  const handleArtworkFileChange = async (slotIndex: number, file: File | null) => {
    if (!file) return;
    setArtworkUploadError('');
    setUploadingSlot(slotIndex);
    try {
      const compressedDataUrl = await compressArtworkImageFile(file);
      updateArtworkSlot(slotIndex, { imageUrl: compressedDataUrl });
    } catch (err) {
      setArtworkUploadError(
        err instanceof Error ? err.message : '이미지 파일을 처리하지 못했습니다.',
      );
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLesson(true);
    setLessonSavedNotice('');
    setLessonErrorNotice('');
    try {
      const cleanedArtworks = artworkSlots
        .map((slot) => ({
          slotIndex: slot.slotIndex,
          title: slot.title.trim(),
          imageUrl: slot.imageUrl.trim(),
          description: slot.description.trim(),
        }))
        .filter((slot) => slot.title || slot.imageUrl || slot.description);

      const trimmedNote = artworkNote.trim();
      const normalizedArtworkNote =
        cleanedArtworks.length > 0 && trimmedNote.includes('[확인 필요]')
          ? ''
          : trimmedNote || (cleanedArtworks.length > 0 ? '' : lesson.artworkNote);

      const updated = await saveLessonConfig({
        eraTitle: eraTitle.trim() || lesson.eraTitle,
        songTitle: songTitle.trim() || lesson.songTitle,
        audioOrLinkUrl: audioOrLinkUrl.trim(),
        historicalContext: historicalContext.trim() || lesson.historicalContext,
        artworkNote: normalizedArtworkNote,
        artworks: cleanedArtworks,
        empathyPrompt: empathyPrompt.trim() || lesson.empathyPrompt,
        shareWithClass,
      });
      onLessonUpdated(updated);
      setLessonSavedNotice('수업 자료가 D1 데이터베이스에 저장되었습니다.');
    } catch (err) {
      setLessonErrorNotice(err instanceof Error ? err.message : '수업 자료를 저장하지 못했습니다.');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleUpdateReview = async (item: StudentResponse, nextLevel: RubricLevel, nextFeedback: string) => {
    setSavingRowId(item.id);
    setSavedRowId(null);
    setActionError('');
    try {
      const updated = await updateTeacherReview(item.id, nextLevel, nextFeedback.trim());
      onResponseUpdated(updated);
      setSavedRowId(item.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '평가와 피드백을 저장하지 못했습니다.');
    } finally {
      setSavingRowId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionError('');
    try {
      await deleteStudentResponse(id);
      onResponseDeleted(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '응답을 삭제하지 못했습니다.');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      '학번',
      '별칭(이름)',
      '반·모둠',
      '공개 여부',
      '시대 상황 대입 감성 문장',
      '지금 시대에 대한 한 줄 생각',
      '평가 단계',
      '교사 피드백',
      '저장 시각',
    ];
    const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const rows = filteredResponses.map((r) =>
      [
        r.studentId,
        r.studentName,
        r.classGroup,
        r.isPublic ? '학급 공개' : '비공개',
        r.reflectionText,
        r.presentConnection,
        r.rubricLevel || '미평가',
        r.teacherFeedback,
        formatDateTime(r.updatedAt),
      ]
        .map(escapeCell)
        .join(','),
    );
    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `3단계_감성표현_학생응답_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Unauthenticated Teacher Login Gate
  if (!teacherSession.authenticated) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-4">
        <div className="border-b border-slate-200 pb-5">
          <p className="text-xs text-slate-500">교사 전용 · 보호된 세션 인증</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">
            교사 확인 로그인
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            학생이 작성한 비공개 응답과 평가·피드백, 수업 자료 설정은 교사 로그인 후 확인할 수 있습니다.
          </p>
        </div>

        {storageMode === 'pending-setup' ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 text-sm text-amber-950"
          >
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">저장 준비 중 (Cloudflare Workers · D1 미연결)</p>
              <p className="text-xs leading-relaxed text-amber-900">
                {statusMessage ||
                  '아직 /api 백엔드와 D1 데이터베이스가 연결되지 않았습니다. Cloudflare 발행 및 setup.sql 실행 후 교사 로그인과 응답 확인이 동작합니다.'}
              </p>
            </div>
          </div>
        ) : !teacherSession.passwordConfigured ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 text-sm text-amber-950"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">교사 비밀번호(TEACHER_PASSWORD) 설정 필요</p>
              <p className="text-xs leading-relaxed text-amber-900">
                Cloudflare Workers 환경 변수(Secret)에 TEACHER_PASSWORD를 등록한 뒤 다시 시도해 주세요.
              </p>
            </div>
          </div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="teacherPassword" className="block text-sm font-medium text-slate-800">
                교사 비밀번호
              </label>
              <input
                id="teacherPassword"
                type="password"
                autoComplete="current-password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="서버에 설정된 교사 비밀번호 입력"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 sm:text-sm"
              />
            </div>

            {loginError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onCheckConnection}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>/api 연결 상태 확인</span>
              </button>
              <button
                type="submit"
                disabled={loggingIn}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>{loggingIn ? '확인 중...' : '로그인'}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs text-slate-500">교사 확인 화면 · 평가 요소 ③ 감성 표현 활동지(5~6차시)</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            학생 제출 응답 및 수업 자료 관리
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLessonEditor((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            <span>{showLessonEditor ? '수업 자료 설정 닫기' : '수업 자료 설정'}</span>
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={handleRefresh}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{refreshing ? '불러오는 중...' : '응답 새로고침'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={responses.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>CSV 내보내기</span>
          </button>
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{loggingOut ? '로그아웃 중...' : '로그아웃'}</span>
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div
        role="status"
        className="flex items-center gap-2.5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
        <span>교사 인증됨 · Cloudflare D1(/api) 저장소 연결됨</span>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">전체 제출 응답</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">{stats.total}건</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">평가 완료 (상·중·하)</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {stats.evaluated} / {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">학급 공개 선택</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {stats.publicCount}건
          </p>
        </div>
      </div>

      {/* Collapsible Lesson Setup Editor */}
      {showLessonEditor && (
        <section className="rounded-xl border border-slate-300 bg-white p-5 sm:p-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              수업 자료 설정 — 원문 [확인 필요] 항목 채우기
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              수업설계안에 적혀 있지 않은 실제 시대명, 대표곡, 역사적 배경, 미술작품 안내를 입력하면 학생 활동 화면에 반영됩니다.
            </p>
          </div>

          <form onSubmit={handleSaveLesson} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="eraTitle" className="block text-xs font-medium text-slate-700">
                  탐구 시대
                </label>
                <input
                  id="eraTitle"
                  type="text"
                  maxLength={120}
                  value={eraTitle}
                  onChange={(e) => setEraTitle(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-slate-900 focus:outline-none sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="songTitle" className="block text-xs font-medium text-slate-700">
                  시대별 대표 감상곡
                </label>
                <input
                  id="songTitle"
                  type="text"
                  maxLength={160}
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-slate-900 focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="audioOrLinkUrl" className="block text-xs font-medium text-slate-700">
                감상곡 유튜브 · 음원 링크 (선택, https://...)
              </label>
              <input
                id="audioOrLinkUrl"
                type="url"
                maxLength={500}
                value={audioOrLinkUrl}
                onChange={(e) => setAudioOrLinkUrl(e.target.value)}
                placeholder="예: https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-sm"
              />
              {previewYouTube ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-teal-800">
                    유튜브 미리보기 확인됨 — 저장하면 학생 화면에서도 바로 재생할 수 있습니다.
                  </p>
                  <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg bg-slate-900">
                    <iframe
                      src={previewYouTube.embedUrl}
                      title="감상곡 유튜브 미리보기"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                  <a
                    href={previewYouTube.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>새 창에서 유튜브 링크 확인하기</span>
                  </a>
                </div>
              ) : audioOrLinkUrl.trim() ? (
                <p className="mt-1.5 text-xs text-slate-500">
                  {previewValidUrl
                    ? '일반 웹 링크로 인식되었습니다. 학생 화면에는 바로가기 버튼으로 연결됩니다.'
                    : '유튜브 주소(youtube.com 또는 youtu.be)나 https:// 로 시작하는 전체 주소를 입력해 주세요.'}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="historicalContext" className="block text-xs font-medium text-slate-700">
                역사적 배경과 당시 사람들의 삶
              </label>
              <textarea
                id="historicalContext"
                rows={3}
                maxLength={2000}
                value={historicalContext}
                onChange={(e) => setHistoricalContext(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-slate-900 focus:outline-none sm:text-sm"
              />
            </div>

            {/* 2x2 Artwork Gallery Editor */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    함께 보는 미술 · 시각 자료 (2×2 갤러리, 최대 4점)
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    각 칸에 사진(파일 업로드 또는 이미지 주소), 제목, 설명을 넣으면 학생 화면에 2×2 갤러리로 보입니다.
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="시각 자료 편집 모드">
                  <button
                    type="button"
                    onClick={() => setArtworkPreviewMode(false)}
                    className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      !artworkPreviewMode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2×2 올리기·수정
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtworkPreviewMode(true)}
                    className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      artworkPreviewMode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    학생 화면 미리보기
                  </button>
                </div>
              </div>

              {artworkUploadError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>{artworkUploadError}</span>
                </div>
              )}

              {artworkPreviewMode ? (
                <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-4">
                  {activeArtworksPreview.length > 0 ? (
                    <ArtworkGallery artworks={activeArtworksPreview} />
                  ) : (
                    <p className="py-6 text-center text-xs text-slate-500">
                      등록된 미술·시각 자료가 아직 없습니다. ‘2×2 올리기·수정’에서 그림을 추가해 보세요.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {artworkSlots.map((slot) => {
                    const isDataUrl = slot.imageUrl.startsWith('data:image/');
                    const isUploading = uploadingSlot === slot.slotIndex;
                    const hasAnyValue = Boolean(
                      slot.title.trim() || slot.imageUrl.trim() || slot.description.trim(),
                    );

                    return (
                      <div
                        key={slot.slotIndex}
                        className="flex flex-col space-y-3 rounded-lg border border-slate-200 bg-white p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            작품 {slot.slotIndex + 1}
                          </span>
                          {hasAnyValue && (
                            <button
                              type="button"
                              onClick={() =>
                                updateArtworkSlot(slot.slotIndex, {
                                  title: '',
                                  imageUrl: '',
                                  description: '',
                                })
                              }
                              className="min-h-[32px] rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-700 whitespace-nowrap"
                            >
                              비우기
                            </button>
                          )}
                        </div>

                        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          {slot.imageUrl ? (
                            <img
                              src={slot.imageUrl}
                              alt={slot.title || `작품 ${slot.slotIndex + 1} 미리보기`}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
                              <ImageIcon className="h-6 w-6" aria-hidden="true" />
                              <span className="text-xs">사진을 올리거나 이미지 주소를 입력하세요</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap">
                            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{isUploading ? '처리 중...' : '사진 올리기'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0] ?? null;
                                void handleArtworkFileChange(slot.slotIndex, file);
                                e.target.value = '';
                              }}
                              className="sr-only"
                            />
                          </label>
                          {slot.imageUrl && (
                            <button
                              type="button"
                              onClick={() => updateArtworkSlot(slot.slotIndex, { imageUrl: '' })}
                              className="min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 whitespace-nowrap"
                            >
                              사진 지우기
                            </button>
                          )}
                        </div>

                        {!isDataUrl ? (
                          <div>
                            <label
                              htmlFor={`art-url-${slot.slotIndex}`}
                              className="block text-[11px] font-medium text-slate-500"
                            >
                              또는 이미지 주소 (https://...)
                            </label>
                            <input
                              id={`art-url-${slot.slotIndex}`}
                              type="url"
                              maxLength={1000}
                              value={slot.imageUrl}
                              onChange={(e) =>
                                updateArtworkSlot(slot.slotIndex, { imageUrl: e.target.value })
                              }
                              placeholder="https://... (직접 올리지 않을 때)"
                              className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 px-3 py-1.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-xs"
                            />
                          </div>
                        ) : (
                          <p className="text-[11px] font-medium text-teal-800">
                            직접 올린 사진이 압축되어 준비되었습니다.
                          </p>
                        )}

                        <div>
                          <label
                            htmlFor={`art-title-${slot.slotIndex}`}
                            className="block text-[11px] font-medium text-slate-600"
                          >
                            그림 제목 (사진 아래 표시)
                          </label>
                          <input
                            id={`art-title-${slot.slotIndex}`}
                            type="text"
                            maxLength={120}
                            value={slot.title}
                            onChange={(e) =>
                              updateArtworkSlot(slot.slotIndex, { title: e.target.value })
                            }
                            placeholder={`예: 작품 ${slot.slotIndex + 1} 제목과 화가`}
                            className="mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 px-3 py-1.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-xs"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`art-desc-${slot.slotIndex}`}
                            className="block text-[11px] font-medium text-slate-600"
                          >
                            작품 설명 (그림을 누르면 아래에 표시)
                          </label>
                          <textarea
                            id={`art-desc-${slot.slotIndex}`}
                            rows={3}
                            maxLength={1200}
                            value={slot.description}
                            onChange={(e) =>
                              updateArtworkSlot(slot.slotIndex, { description: e.target.value })
                            }
                            placeholder="이 그림에 담긴 시대 상황과 감상 포인트를 적어 주세요."
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-xs"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label htmlFor="artworkNote" className="block text-xs font-medium text-slate-700">
                  미술 · 시각 자료 전체 안내 문구 <span className="font-normal text-slate-500">(선택)</span>
                </label>
                <textarea
                  id="artworkNote"
                  rows={2}
                  maxLength={600}
                  value={artworkNote}
                  onChange={(e) => setArtworkNote(e.target.value)}
                  placeholder="예: 네 작품을 눌러보며 음악이 만들어진 시대의 표정과 분위기를 살펴봅시다."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="empathyPrompt" className="block text-xs font-medium text-slate-700">
                활동 안내 질문
              </label>
              <input
                id="empathyPrompt"
                type="text"
                maxLength={600}
                value={empathyPrompt}
                onChange={(e) => setEmpathyPrompt(e.target.value)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-slate-900 focus:outline-none sm:text-sm"
              />
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={shareWithClass}
                  onChange={(e) => setShareWithClass(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-slate-900"
                />
                <span>‘서로의 관점’ 화면에서 공개 선택된 글만 학급과 나누기</span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                {lessonSavedNotice && (
                  <span className="text-xs font-medium text-teal-700">{lessonSavedNotice}</span>
                )}
                {lessonErrorNotice && (
                  <span className="text-xs font-medium text-red-700">{lessonErrorNotice}</span>
                )}
                <button
                  type="submit"
                  disabled={savingLesson}
                  className="min-h-[44px] w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap sm:w-auto"
                >
                  {savingLesson ? '저장 중...' : '수업 자료 저장하기'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Rubric Reference */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          설계안 평가 기준 ③ — 음악에 담긴 시대 상황 공감과 지금 시대 관점 서술
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 border-t border-slate-200 pt-3 md:grid-cols-3">
          {(['상', '중', '하'] as const).map((level) => (
            <div key={level}>
              <p className="text-xs font-semibold text-slate-900">성취수준 {level}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{RUBRIC_DESCRIPTIONS[level]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Filter, Sort, and View Mode Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md lg:flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="학번, 별칭, 반·모둠, 문장 내용 검색..."
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="정렬 기준">
              <button
                type="button"
                onClick={() => setSortOrder('studentId')}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sortOrder === 'studentId' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                학번순
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('latest')}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  sortOrder === 'latest' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                최신순
              </button>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="보기 방식">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>표로 모아보기</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span>카드로 평가·피드백</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="평가 상태 필터">
          {(['전체', '미평가', '상', '중', '하'] as const).map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setRubricFilter(lv)}
              className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                rubricFilter === lv
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      {/* Responses List / Table */}
      {filteredResponses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center sm:p-12">
          <p className="text-base font-medium text-slate-900">저장된 학생 응답이 없습니다</p>
          <p className="mt-1.5 text-sm text-slate-500">
            학생이 활동지에서 학번·별칭과 감성 문장을 저장하면 이곳에 모아집니다.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="px-4 py-3 whitespace-nowrap">학번</th>
                  <th className="px-4 py-3 whitespace-nowrap">별칭(이름)</th>
                  <th className="px-4 py-3 whitespace-nowrap">반·모둠</th>
                  <th className="px-4 py-3 whitespace-nowrap">공개</th>
                  <th className="px-4 py-3">시대 상황 대입 감성 문장</th>
                  <th className="px-4 py-3">지금 시대 한 줄</th>
                  <th className="px-4 py-3 whitespace-nowrap">평가</th>
                  <th className="px-4 py-3 whitespace-nowrap">저장 시각</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredResponses.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 font-mono text-xs font-medium tabular-nums text-slate-900 whitespace-nowrap">
                      {item.studentId || '-'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      {item.studentName}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {item.classGroup || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {item.isPublic ? '공개' : '비공개'}
                    </td>
                    <td className="max-w-sm px-4 py-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-line">
                      {item.reflectionText}
                    </td>
                    <td className="max-w-xs px-4 py-3.5 text-xs leading-relaxed text-slate-600">
                      {item.presentConnection || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {item.rubricLevel || '미평가'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateTime(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('cards');
                          window.setTimeout(() => {
                            document
                              .getElementById(`response-card-${item.id}`)
                              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 50);
                        }}
                        className="min-h-[36px] rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        피드백
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResponses.map((item) => {
            const feedbackDraft = feedbackDrafts[item.id] ?? item.teacherFeedback;
            const isSaving = savingRowId === item.id;
            const isSaved = savedRowId === item.id;

            return (
              <article
                id={`response-card-${item.id}`}
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {item.studentId && (
                      <span className="font-mono font-medium tabular-nums text-slate-700">
                        {item.studentId}
                      </span>
                    )}
                    <span className="font-semibold text-slate-900">{item.studentName}</span>
                    {item.classGroup && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-slate-600">{item.classGroup}</span>
                      </>
                    )}
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="text-xs text-slate-500">{item.isPublic ? '학급 공개' : '비공개'}</span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span className="font-mono text-xs tabular-nums text-slate-500">
                      {formatDateTime(item.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="min-h-[40px] rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label={`${item.studentName} 응답 삭제`}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-md px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-700 whitespace-nowrap"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>삭제</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="space-y-4 lg:col-span-7">
                    <div>
                      <p className="text-xs font-medium text-slate-500">시대 상황 대입 감성 문장</p>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-900">
                        {item.reflectionText}
                      </p>
                    </div>
                    {item.presentConnection && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-xs font-medium text-slate-500">지금 시대를 바라보는 한 줄 생각</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.presentConnection}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-slate-200 pt-4 lg:col-span-5 lg:border-t-0 lg:pt-0">
                    <div>
                      <p className="text-xs font-medium text-slate-500">평가 단계</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {(['상', '중', '하'] as const).map((level) => {
                          const active = item.rubricLevel === level;
                          return (
                            <button
                              key={level}
                              type="button"
                              onClick={() => handleUpdateReview(item, active ? '' : level, feedbackDraft)}
                              className={`min-h-[44px] min-w-[48px] rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                                active
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {level}
                            </button>
                          );
                        })}
                        {item.rubricLevel === '' && (
                          <span className="ml-1 text-xs text-slate-400">미평가</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`fb-${item.id}`} className="block text-xs font-medium text-slate-500">
                        교사 한 줄 피드백
                      </label>
                      <textarea
                        id={`fb-${item.id}`}
                        rows={2}
                        maxLength={500}
                        value={feedbackDraft}
                        onChange={(e) =>
                          setFeedbackDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="공감한 표현이나 더 생각해 볼 점을 적어 주세요."
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-xs"
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {isSaved && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>저장됨</span>
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleUpdateReview(item, item.rubricLevel, feedbackDraft)}
                          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                        >
                          {isSaving ? '저장 중...' : '피드백 저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
