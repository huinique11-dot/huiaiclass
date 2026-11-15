import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Headphones,
  Lock,
  PencilLine,
} from 'lucide-react';
import { submitStudentResponse, type StorageMode } from '../lib/classroomApi.ts';
import { isValidHttpUrl, parseYouTubeUrl } from '../lib/youtube.ts';
import type { LessonConfig, StudentResponse } from '../types.ts';
import { ArtworkGallery } from './ArtworkGallery.tsx';

interface StudentActivityViewProps {
  lesson: LessonConfig;
  storageMode: StorageMode;
  statusMessage: string;
  myResponse: StudentResponse | null;
  myEditToken: string | null;
  onSaved: (saved: StudentResponse, editToken?: string) => void;
  onStartNewStudent: () => void;
  onGoToGallery: () => void;
  formRef: React.RefObject<HTMLFormElement | null>;
}

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

export const StudentActivityView: React.FC<StudentActivityViewProps> = ({
  lesson,
  storageMode,
  statusMessage,
  myResponse,
  myEditToken,
  onSaved,
  onStartNewStudent,
  onGoToGallery,
  formRef,
}) => {
  const [studentId, setStudentId] = useState(myResponse?.studentId ?? '');
  const [studentName, setStudentName] = useState(myResponse?.studentName ?? '');
  const [classGroup, setClassGroup] = useState(myResponse?.classGroup ?? '');
  const [reflectionText, setReflectionText] = useState(myResponse?.reflectionText ?? '');
  const [presentConnection, setPresentConnection] = useState(myResponse?.presentConnection ?? '');
  const [isPublic, setIsPublic] = useState(myResponse?.isPublic ?? false);

  const [isEditing, setIsEditing] = useState(!myResponse);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  useEffect(() => {
    if (myResponse) {
      setStudentId(myResponse.studentId);
      setStudentName(myResponse.studentName);
      setClassGroup(myResponse.classGroup);
      setReflectionText(myResponse.reflectionText);
      setPresentConnection(myResponse.presentConnection);
      setIsPublic(myResponse.isPublic);
      setIsEditing(false);
    } else {
      setStudentId('');
      setStudentName('');
      setClassGroup('');
      setReflectionText('');
      setPresentConnection('');
      setIsPublic(false);
      setIsEditing(true);
    }
  }, [myResponse?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusNotice('');

    const trimmedId = studentId.trim();
    const trimmedName = studentName.trim();
    const trimmedReflection = reflectionText.trim();

    if (!trimmedId) {
      setErrorMsg('학번을 입력해 주세요.');
      return;
    }
    if (!trimmedName) {
      setErrorMsg('이름(별칭)을 입력해 주세요.');
      return;
    }
    if (!trimmedReflection) {
      setErrorMsg('시대 상황에 대입한 감성 문장을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitStudentResponse({
        id: myResponse?.id,
        editToken: myEditToken ?? undefined,
        studentId: trimmedId,
        studentName: trimmedName,
        classGroup: classGroup.trim(),
        reflectionText: trimmedReflection,
        presentConnection: presentConnection.trim(),
        isPublic,
      });

      onSaved(result.response, result.editToken);
      setIsEditing(false);
      setStatusNotice(
        myResponse ? '수정한 감성 문장이 저장되었습니다.' : '감성 문장이 정상적으로 저장되었습니다.',
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : '저장에 실패했습니다. 데이터 저장소 연결 상태를 확인해 주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsSetup = (val: string) => val.includes('[확인 필요]');
  const youtubeInfo = parseYouTubeUrl(lesson.audioOrLinkUrl);
  const hasExternalUrl = isValidHttpUrl(lesson.audioOrLinkUrl);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Lesson Intro Header */}
      <section id="guide" className="border-b border-slate-200 pb-7 sm:pb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>중학교 2학년 음악(읽걷쓰 · 인공지능 · 미술 융합)</span>
          <span aria-hidden="true">·</span>
          <span>3단계 (5~6차시)</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">성취기준 [9음02-02], [9음02-03]</span>
        </div>

        <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          <span className="block font-bold">무엇을 욕망했는가</span>
          <span className="mt-1.5 block">ㅡ 음악으로 시대 읽고 공감하기</span>
        </h1>

        <p className="mt-3.5 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          관통 질문:{' '}
          <strong className="font-medium text-slate-900">
            “사람들은 어떤 방식으로 음악을 통해 세상을, 그리고 메시지를 표현하는가?”
          </strong>
        </p>

        {/* 3-Step Flow Strip */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:mt-7 sm:grid-cols-3 sm:pt-6">
          <div>
            <p className="font-mono text-xs text-slate-500">01. 들어가기</p>
            <p className="mt-1 text-sm font-medium text-slate-900">시대 배경과 삶의 상황 되짚기</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              탐구할 시대의 역사적 배경과 당시 사람들의 삶을 먼저 살펴봅니다.
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-slate-500">02. 활동</p>
            <p className="mt-1 text-sm font-medium text-slate-900">시대 상황에 나를 대입해 감상하기</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              그 시대를 살아가는 사람이라 상상하며 음악 속 마음과 욕망에 공감합니다.
            </p>
          </div>
          <div>
            <p className="font-mono text-xs text-slate-500">03. 정리</p>
            <p className="mt-1 text-sm font-medium text-slate-900">감성 문장 작성과 관점 나누기</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              느낀 감성을 나만의 문장으로 기록해 교사·친구들과 시선을 나눕니다.
            </p>
          </div>
        </div>
      </section>

      {/* Honest Storage Status Notice */}
      {storageMode === 'pending-setup' && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5 text-sm text-amber-950"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-medium">저장 준비 중 (데이터 저장소 연결 전)</p>
            <p className="text-xs leading-relaxed text-amber-900">
              {statusMessage ||
                '현재는 화면과 입력 형태를 확인하는 상태입니다. Cloudflare Worker와 D1 데이터베이스(/api)가 연결되기 전까지는 제출해도 저장되지 않습니다.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Two-Zone Workspace */}
      <section id="workspace" className="grid grid-cols-1 items-start gap-6 sm:gap-8 lg:grid-cols-12">
        {/* Left Zone: Lesson Context & Listening Material */}
        <aside className="rounded-xl border border-slate-200 bg-white lg:col-span-5">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Headphones className="h-4 w-4 text-slate-700" aria-hidden="true" />
              <h2 className="text-lg font-semibold">오늘의 감상 자료</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              자료와 시대 배경을 확인한 뒤 활동지에 감성 문장을 작성해 주세요.
            </p>
          </div>

          <div className="divide-y divide-slate-200 px-5 sm:px-6">
            <div className="py-4">
              <p className="text-xs font-medium text-slate-500">탐구 시대</p>
              <p
                className={`mt-1 text-sm font-medium leading-relaxed ${
                  needsSetup(lesson.eraTitle) ? 'text-amber-800' : 'text-slate-900'
                }`}
              >
                {lesson.eraTitle}
              </p>
            </div>

            <div className="py-4">
              <p className="text-xs font-medium text-slate-500">시대별 대표 감상곡</p>
              <p
                className={`mt-1 text-sm font-medium leading-relaxed ${
                  needsSetup(lesson.songTitle) ? 'text-amber-800' : 'text-slate-900'
                }`}
              >
                {lesson.songTitle}
              </p>
              {youtubeInfo ? (
                <div className="mt-3 space-y-2.5">
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
                    <iframe
                      src={youtubeInfo.embedUrl}
                      title={`${lesson.songTitle} 감상 영상`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  </div>
                  <a
                    href={youtubeInfo.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    <span>유튜브에서 직접 열기</span>
                  </a>
                </div>
              ) : hasExternalUrl ? (
                <a
                  href={lesson.audioOrLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span>감상 음원·영상 열기</span>
                </a>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
                  [확인 필요] 교사 확인 화면에서 유튜브 감상곡 주소를 등록하면 이곳에 영상 미리보기와 링크가 연결됩니다.
                </p>
              )}
            </div>

            <div className="py-4">
              <p className="text-xs font-medium text-slate-500">역사적 배경과 당시 사람들의 삶</p>
              <p
                className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed ${
                  needsSetup(lesson.historicalContext) ? 'text-amber-800' : 'text-slate-700'
                }`}
              >
                {lesson.historicalContext}
              </p>
            </div>

            <div className="py-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>함께 보는 미술 · 시각 자료</span>
              </div>

              {lesson.artworks.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {lesson.artworkNote.trim() && !needsSetup(lesson.artworkNote) && (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {lesson.artworkNote}
                    </p>
                  )}
                  <ArtworkGallery artworks={lesson.artworks} />
                </div>
              ) : (
                <p
                  className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed ${
                    needsSetup(lesson.artworkNote) ? 'text-amber-800' : 'text-slate-700'
                  }`}
                >
                  {lesson.artworkNote}
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* Right Zone: Student Reflection Worksheet */}
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <div className="flex items-center gap-2 text-slate-900">
                <PencilLine className="h-4 w-4 text-slate-700" aria-hidden="true" />
                <h2 className="text-lg font-semibold">감성 표현 활동지</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                개인정보 보호를 위해 실명 대신 가상 별칭으로 입력해 주세요. 비공개 글은 교사만 확인할 수 있습니다.
              </p>
            </div>

            {myResponse && !isEditing && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    setStatusNotice('');
                  }}
                  className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  내 글 수정하기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusNotice('');
                    setErrorMsg('');
                    onStartNewStudent();
                  }}
                  className="min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  다른 별칭으로 새로 쓰기
                </button>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6">
            {/* Guiding Prompt */}
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
              <p className="text-xs font-medium text-slate-500">활동 안내 질문</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{lesson.empathyPrompt}</p>
            </div>

            {statusNotice && (
              <div
                role="status"
                className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                  <span>{statusNotice}</span>
                </div>
                {lesson.shareWithClass && isPublic && (
                  <button
                    type="button"
                    onClick={onGoToGallery}
                    className="min-h-[40px] px-2 text-xs font-semibold underline underline-offset-4 whitespace-nowrap shrink-0"
                  >
                    서로의 관점 보러 가기
                  </button>
                )}
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            {myResponse && !isEditing ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {myResponse.studentId && (
                      <span className="font-mono tabular-nums font-medium text-slate-700">
                        {myResponse.studentId}
                      </span>
                    )}
                    <span className="font-medium text-slate-900">{myResponse.studentName}</span>
                    {myResponse.classGroup && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{myResponse.classGroup}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{myResponse.isPublic ? '학급 공개' : '비공개(교사만 확인)'}</span>
                  </div>
                  <span className="font-mono tabular-nums">
                    저장 시각: {formatDateTime(myResponse.updatedAt)}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500">시대 상황에 대입한 나의 감성 문장</p>
                  <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-slate-900">
                    {myResponse.reflectionText}
                  </p>
                </div>

                {myResponse.presentConnection && (
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-medium text-slate-500">지금 시대를 바라보는 한 줄 생각</p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {myResponse.presentConnection}
                    </p>
                  </div>
                )}

                {myResponse.teacherFeedback && (
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-medium text-teal-800">선생님 피드백</p>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-800">
                      {myResponse.teacherFeedback}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>저장 완료</span>
                  </span>
                  {lesson.shareWithClass && myResponse.isPublic && (
                    <button
                      type="button"
                      onClick={onGoToGallery}
                      className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
                    >
                      서로의 감상 관점 나누기
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="studentId" className="block text-sm font-medium text-slate-800">
                      학번(번호) <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="studentId"
                      type="text"
                      inputMode="numeric"
                      maxLength={20}
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="예: 20305"
                      className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="studentName" className="block text-sm font-medium text-slate-800">
                      별칭(이름) <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="studentName"
                      type="text"
                      maxLength={30}
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="예: 푸른음표 (가상 별칭)"
                      className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="classGroup" className="block text-sm font-medium text-slate-800">
                      반 또는 모둠 <span className="text-xs font-normal text-slate-500">(선택)</span>
                    </label>
                    <input
                      id="classGroup"
                      type="text"
                      maxLength={40}
                      value={classGroup}
                      onChange={(e) => setClassGroup(e.target.value)}
                      placeholder="예: 2모둠"
                      className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="reflectionText" className="block text-sm font-medium text-slate-800">
                      시대 상황에 나를 대입한 감성 문장 <span className="text-red-600">*</span>
                    </label>
                    <span className="font-mono text-xs tabular-nums text-slate-400">
                      {reflectionText.length} / 2000
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    음악을 들으며 떠올린 당시 사람들의 감정, 바람(욕망), 그리고 내가 느낀 점을 구체적인 문장으로 적어 보세요.
                  </p>
                  <textarea
                    id="reflectionText"
                    rows={5}
                    maxLength={2000}
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    placeholder="만약 내가 이 음악이 만들어진 시대를 살고 있다면..."
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 sm:text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="presentConnection" className="block text-sm font-medium text-slate-800">
                      지금 시대를 바라보는 나의 생각 한 줄{' '}
                      <span className="text-xs font-normal text-slate-500">(선택 · 목표 ③ 연결)</span>
                    </label>
                    <span className="font-mono text-xs tabular-nums text-slate-400">
                      {presentConnection.length} / 1000
                    </span>
                  </div>
                  <input
                    id="presentConnection"
                    type="text"
                    maxLength={1000}
                    value={presentConnection}
                    onChange={(e) => setPresentConnection(e.target.value)}
                    placeholder="그 시대의 마음과 비교했을 때, 지금 우리가 살아가는 시대는 어떤 시대라고 생각하나요?"
                    className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 sm:text-sm"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-slate-900"
                    />
                    <span className="space-y-0.5">
                      <span className="block font-medium">서로의 관점(학급 공유)에 내 글 공개하기</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>선택하지 않으면 비공개로 저장되어 선생님만 볼 수 있습니다.</span>
                      </span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                  {myResponse && (
                    <button
                      type="button"
                      onClick={() => {
                        setStudentId(myResponse.studentId);
                        setStudentName(myResponse.studentName);
                        setClassGroup(myResponse.classGroup);
                        setReflectionText(myResponse.reflectionText);
                        setPresentConnection(myResponse.presentConnection);
                        setIsPublic(myResponse.isPublic);
                        setErrorMsg('');
                        setIsEditing(false);
                      }}
                      className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap sm:w-auto"
                    >
                      취소
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[44px] w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap sm:w-auto"
                  >
                    {isSubmitting
                      ? '저장하는 중...'
                      : myResponse
                      ? '수정한 문장 저장하기'
                      : '감성 문장 저장하기'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
