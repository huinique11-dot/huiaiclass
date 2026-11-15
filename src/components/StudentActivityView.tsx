import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Lock, Music2, PencilLine, UserRound } from 'lucide-react';
import { submitStudentResponse, type StorageMode } from '../lib/classroomApi.ts';
import type { Era, LessonConfig, StudentProfile, StudentResponse } from '../types.ts';
import { ListeningMaterials } from './ListeningMaterials.tsx';
import { FourPStrip, StandardsBox } from './LessonGuide.tsx';

const SELECTION_KEY = 'music_era_selection_v1';

// 시대 목록이 아직 없으면(예전 단일 자료) 하나의 시대로 보여 줌
export function lessonEras(lesson: LessonConfig): Era[] {
  if (lesson.eras && lesson.eras.length > 0) return lesson.eras;
  return [
    {
      id: 'legacy',
      title: lesson.eraTitle,
      historicalContext: lesson.historicalContext,
      artworkNote: lesson.artworkNote,
      artworks: lesson.artworks,
      songs: lesson.songTitle ? [{ id: 'legacy-song', title: lesson.songTitle, url: lesson.audioOrLinkUrl }] : [],
    },
  ];
}

interface StudentActivityViewProps {
  lesson: LessonConfig;
  profile: StudentProfile;
  storageMode: StorageMode;
  statusMessage: string;
  myResponse: StudentResponse | null;
  myEditToken: string | null;
  onSaved: (saved: StudentResponse, editToken?: string) => void;
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
  profile,
  storageMode,
  statusMessage,
  myResponse,
  myEditToken,
  onSaved,
  onGoToGallery,
  formRef,
}) => {
  const eras = useMemo(() => lessonEras(lesson), [lesson]);
  const [selection, setSelection] = useState<{ eraId: string; songId: string }>(() => {
    try {
      const raw = window.localStorage.getItem(SELECTION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // 무시
    }
    return { eraId: '', songId: '' };
  });
  const selectedEra = eras.find((e) => e.id === selection.eraId) ?? eras[0];
  const selectedSong = selectedEra?.songs.find((s) => s.id === selection.songId) ?? selectedEra?.songs[0];
  const selectMaterial = (eraId: string, songId: string) => {
    const next = { eraId, songId };
    setSelection(next);
    try {
      window.localStorage.setItem(SELECTION_KEY, JSON.stringify(next));
    } catch {
      // 무시
    }
  };
  const [reflectionText, setReflectionText] = useState(myResponse?.reflectionText ?? '');
  const [presentConnection, setPresentConnection] = useState(myResponse?.presentConnection ?? '');
  const [isPublic, setIsPublic] = useState(myResponse?.isPublic ?? false);

  const [isEditing, setIsEditing] = useState(!myResponse);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  useEffect(() => {
    if (myResponse) {
      setReflectionText(myResponse.reflectionText);
      setPresentConnection(myResponse.presentConnection);
      setIsPublic(myResponse.isPublic);
      setIsEditing(false);
    } else {
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

    const trimmedReflection = reflectionText.trim();

    if (!trimmedReflection) {
      setErrorMsg('시대 상황에 대입한 감성 문장을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitStudentResponse({
        id: myResponse?.id,
        editToken: myEditToken ?? undefined,
        studentId: profile.studentId,
        studentName: profile.studentName,
        classGroup: profile.classGroup,
        reflectionText: trimmedReflection,
        presentConnection: presentConnection.trim(),
        isPublic,
        eraTitle: selectedEra?.title ?? '',
        songTitle: selectedSong?.title ?? '',
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


  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Lesson Intro Header */}
      <section id="guide" className="border-b border-slate-200 pb-7 sm:pb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>중학교 2학년 음악(읽걷쓰 · 인공지능 · 미술 융합)</span>
          <span aria-hidden="true">·</span>
          <span>3단계 (5~6차시) 시대 상황 대입을 통한 공감과 개인 감성 표현</span>
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

        <div className="mt-5 max-w-4xl">
          <StandardsBox />
        </div>

        <div className="mt-6 border-t border-slate-200 pt-5 sm:mt-7 sm:pt-6">
          <p className="mb-3 text-xs font-semibold text-slate-500">프로젝트 흐름 (4P · 관찰 → 질문 → 탐구 → 행동)</p>
          <FourPStrip current="P3" nowLabel="3단계 시대 상황에 나를 대입해 감성 문장 쓰기" />
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
        {/* Left Zone: 시대·감상곡 선택과 시대 공통 자료 */}
        <ListeningMaterials eras={eras} eraId={selectedEra?.id ?? ''} songId={selectedSong?.id ?? ''} onSelect={selectMaterial} />

        {/* Right Zone: Student Reflection Worksheet */}
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <div className="flex items-center gap-2 text-slate-900">
                <PencilLine className="h-4 w-4 text-slate-700" aria-hidden="true" />
                <h2 className="text-lg font-semibold">감성 표현 활동지</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                비공개 글은 교사만 확인할 수 있습니다.
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

                {(myResponse.eraTitle || myResponse.songTitle) && (
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    <Music2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {[myResponse.eraTitle, myResponse.songTitle].filter(Boolean).join(' · ')}
                  </p>
                )}

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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <UserRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    <span className="font-mono text-xs text-slate-500">{profile.studentId}</span>
                    <strong className="text-slate-900">{profile.studentName}</strong>
                    {profile.classGroup && <span className="text-xs text-slate-500">· {profile.classGroup}</span>}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-700">
                    <Music2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">
                      {selectedEra?.title}
                      {selectedSong && <> · {selectedSong.title}</>}
                    </span>
                  </span>
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
