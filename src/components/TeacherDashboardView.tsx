import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Clock, Download, RefreshCw, Search, Settings2, Trash2 } from 'lucide-react';
import {
  deleteStudentResponse,
  saveLessonConfig,
  updateTeacherReview,
  type StorageMode,
} from '../lib/classroomApi.ts';
import type { LessonConfig, RubricLevel, StudentResponse } from '../types.ts';

interface TeacherDashboardViewProps {
  lesson: LessonConfig;
  storageMode: StorageMode;
  responses: StudentResponse[];
  onLessonUpdated: (next: LessonConfig, nextMode: StorageMode) => void;
  onResponseUpdated: (next: StudentResponse, nextMode: StorageMode) => void;
  onResponseDeleted: (id: string, nextMode: StorageMode) => void;
  onRefresh: () => void;
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

export const TeacherDashboardView: React.FC<TeacherDashboardViewProps> = ({
  lesson,
  storageMode,
  responses,
  onLessonUpdated,
  onResponseUpdated,
  onResponseDeleted,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rubricFilter, setRubricFilter] = useState<'전체' | '미평가' | '상' | '중' | '하'>('전체');
  const [showLessonEditor, setShowLessonEditor] = useState(!lesson.isCustomized);

  const [eraTitle, setEraTitle] = useState(lesson.eraTitle);
  const [songTitle, setSongTitle] = useState(lesson.songTitle);
  const [audioOrLinkUrl, setAudioOrLinkUrl] = useState(lesson.audioOrLinkUrl);
  const [historicalContext, setHistoricalContext] = useState(lesson.historicalContext);
  const [artworkNote, setArtworkNote] = useState(lesson.artworkNote);
  const [empathyPrompt, setEmpathyPrompt] = useState(lesson.empathyPrompt);
  const [shareWithClass, setShareWithClass] = useState(lesson.shareWithClass);
  const [savingLesson, setSavingLesson] = useState(false);
  const [lessonSavedNotice, setLessonSavedNotice] = useState('');

  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = responses.length;
    const evaluated = responses.filter((r) => r.rubricLevel !== '').length;
    const withPresent = responses.filter((r) => r.presentConnection.trim().length > 0).length;
    return { total, evaluated, withPresent };
  }, [responses]);

  const filteredResponses = useMemo(() => {
    return responses.filter((r) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesQuery =
        !q ||
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
  }, [responses, searchTerm, rubricFilter]);

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLesson(true);
    setLessonSavedNotice('');
    try {
      const result = await saveLessonConfig({
        eraTitle: eraTitle.trim() || lesson.eraTitle,
        songTitle: songTitle.trim() || lesson.songTitle,
        audioOrLinkUrl: audioOrLinkUrl.trim(),
        historicalContext: historicalContext.trim() || lesson.historicalContext,
        artworkNote: artworkNote.trim() || lesson.artworkNote,
        empathyPrompt: empathyPrompt.trim() || lesson.empathyPrompt,
        shareWithClass,
      });
      onLessonUpdated(result.lesson, result.storageMode);
      setLessonSavedNotice(
        result.storageMode === 'api-connected'
          ? '수업 자료가 서버에 저장되었습니다.'
          : '수업 자료가 현재 화면에 임시 반영되었습니다. (저장 준비 중 — DB 미연결)',
      );
    } finally {
      setSavingLesson(false);
    }
  };

  const handleUpdateReview = async (item: StudentResponse, nextLevel: RubricLevel, nextFeedback: string) => {
    setSavingRowId(item.id);
    setSavedRowId(null);
    try {
      const result = await updateTeacherReview(item.id, nextLevel, nextFeedback.trim());
      if (result.response) {
        onResponseUpdated(result.response, result.storageMode);
        setSavedRowId(item.id);
      }
    } finally {
      setSavingRowId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await deleteStudentResponse(id);
    onResponseDeleted(id, result.storageMode);
    setConfirmDeleteId(null);
  };

  const handleExportCsv = () => {
    const headers = [
      '학번·이름',
      '반·모둠',
      '시대 상황 대입 감성 문장',
      '지금 시대에 대한 한 줄 생각',
      '평가 단계',
      '교사 피드백',
      '입력 시각',
    ];
    const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const rows = responses.map((r) =>
      [
        r.studentName,
        r.classGroup,
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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowLessonEditor((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            <span>{showLessonEditor ? '수업 자료 설정 닫기' : '수업 자료 설정 ([확인 필요] 입력)'}</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>/api 연결 확인</span>
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
        </div>
      </div>

      {/* Honest Storage Connection Banner */}
      {storageMode === 'pending-setup' ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 text-sm text-amber-950"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">저장소 상태: 저장 준비 중 (Cloudflare Workers · D1 미연결)</p>
            <p className="text-xs leading-relaxed text-amber-900">
              현재 화면은 같은 주소의 <code className="font-mono">/api</code> 경로로 데이터를 주고받도록 준비되어 있습니다. 아직 백엔드가 연결되지 않아 아래 목록에는 이 브라우저에서 직접 테스트 입력한 응답만 임시 표시됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
          <span>저장소 상태: /api 저장소 연결됨 (Cloudflare Workers · D1)</span>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">
            {storageMode === 'api-connected' ? '전체 제출 응답' : '임시 확인 응답 (현재 브라우저)'}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">{stats.total}명</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">평가 완료 (상·중·하)</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {stats.evaluated} / {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-xs text-slate-500">지금 시대 연결 작성</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {stats.withPresent}건
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
                감상 음원 · 영상 링크 (선택, https://...)
              </label>
              <input
                id="audioOrLinkUrl"
                type="url"
                maxLength={500}
                value={audioOrLinkUrl}
                onChange={(e) => setAudioOrLinkUrl(e.target.value)}
                placeholder="예: https://www.youtube.com/..."
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <div>
                <label htmlFor="artworkNote" className="block text-xs font-medium text-slate-700">
                  함께 보는 미술 · 시각 자료 안내
                </label>
                <textarea
                  id="artworkNote"
                  rows={3}
                  maxLength={600}
                  value={artworkNote}
                  onChange={(e) => setArtworkNote(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-slate-900 focus:outline-none sm:text-sm"
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
                <span>‘서로의 관점’ 화면에서 학생들에게 글 공개하기</span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                {lessonSavedNotice && (
                  <span className="text-xs font-medium text-amber-800">{lessonSavedNotice}</span>
                )}
                <button
                  type="submit"
                  disabled={savingLesson}
                  className="min-h-[44px] w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap sm:w-auto"
                >
                  {savingLesson
                    ? '적용 중...'
                    : storageMode === 'api-connected'
                    ? '수업 자료 저장하기'
                    : '수업 자료 적용하기 (저장 준비 중)'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Rubric Reference (from PDF page 5) */}
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

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름, 반·모둠, 문장 내용 검색..."
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-sm"
          />
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

      {/* Responses List */}
      {filteredResponses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center sm:p-12">
          <p className="text-base font-medium text-slate-900">조건에 맞는 학생 응답이 없습니다</p>
          <p className="mt-1.5 text-sm text-slate-500">
            학생 화면에서 감성 문장을 입력하면 이곳에서 바로 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResponses.map((item) => {
            const feedbackDraft = feedbackDrafts[item.id] ?? item.teacherFeedback;
            const isSaving = savingRowId === item.id;
            const isSaved = savedRowId === item.id;

            return (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-900">{item.studentName}</span>
                    {item.classGroup && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="text-slate-600">{item.classGroup}</span>
                      </>
                    )}
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
                  {/* Student text */}
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

                  {/* Teacher assessment & feedback */}
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
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{storageMode === 'api-connected' ? '저장됨' : '임시 반영됨'}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleUpdateReview(item, item.rubricLevel, feedbackDraft)}
                          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
                        >
                          {isSaving
                            ? '적용 중...'
                            : storageMode === 'api-connected'
                            ? '피드백 저장'
                            : '피드백 반영 (저장 준비 중)'}
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
