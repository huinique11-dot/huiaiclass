import React, { useMemo, useState } from 'react';
import { Clock, Lock, MessageSquareQuote, RefreshCw } from 'lucide-react';
import { PostItBoard, noteColor, type BoardCluster } from './PostItBoard.tsx';
import { lessonEras } from './StudentActivityView.tsx';

type GroupBy = 'all' | 'era' | 'song';
const NO_ERA = '시대 미선택';
import type { StorageMode } from '../lib/classroomApi.ts';
import type { LessonConfig, StudentResponse } from '../types.ts';

interface ClassGalleryViewProps {
  lesson: LessonConfig;
  storageMode: StorageMode;
  responses: StudentResponse[];
  myResponseId: string | null;
  onRefresh: () => void;
  onGoToWrite: () => void;
}


export const ClassGalleryView: React.FC<ClassGalleryViewProps> = ({
  lesson,
  storageMode,
  responses,
  myResponseId,
  onRefresh,
  onGoToWrite,
}) => {
  const [groupFilter, setGroupFilter] = useState<string>('전체');
  const [groupBy, setGroupBy] = useState<GroupBy>('era');

  const groups = useMemo(() => {
    const set = new Set<string>();
    responses.forEach((r) => {
      if (r.classGroup.trim()) {
        set.add(r.classGroup.trim());
      }
    });
    return ['전체', ...Array.from(set)];
  }, [responses]);

  const filtered = useMemo(() => {
    if (groupFilter === '전체') return responses;
    return responses.filter((r) => r.classGroup.trim() === groupFilter);
  }, [responses, groupFilter]);

  // 시대 순서(교사가 정한 순서)와 색
  const eraOrder = useMemo(() => lessonEras(lesson).map((e) => e.title), [lesson]);
  const eraIndex = (title: string) => {
    const i = eraOrder.indexOf(title);
    return i === -1 ? eraOrder.length + (title ? 1 : 2) : i;
  };
  const colorOf = (r: StudentResponse) => noteColor(eraIndex(r.eraTitle ?? ''));

  const clusters: BoardCluster[] = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => eraIndex(a.eraTitle ?? '') - eraIndex(b.eraTitle ?? '') || (a.songTitle ?? '').localeCompare(b.songTitle ?? ''),
    );
    if (groupBy === 'all') return [{ key: 'all', title: '우리 반 감상 포스트잇', items: sorted }];
    const map = new Map<string, BoardCluster>();
    for (const r of sorted) {
      const era = r.eraTitle?.trim() || NO_ERA;
      const song = r.songTitle?.trim() || '감상곡 미선택';
      const key = groupBy === 'era' ? era : `${era}__${song}`;
      if (!map.has(key)) {
        map.set(key, groupBy === 'era' ? { key, title: era, items: [] } : { key, title: `♪ ${song}`, subtitle: era, items: [] });
      }
      map.get(key)!.items.push(r);
    }
    return [...map.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, groupBy, eraOrder]);

  if (!lesson.shareWithClass) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center sm:p-10">
        <MessageSquareQuote className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold text-slate-900">학급 관점 나누기가 잠시 비공개 상태입니다</h2>
        <p className="mt-2 text-sm text-slate-600">
          선생님이 모든 학생의 작성이 끝난 뒤 서로의 감상 문장을 함께 열어볼 수 있습니다.
        </p>
        <button
          type="button"
          onClick={onGoToWrite}
          className="mt-6 min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
        >
          내 활동지로 돌아가기
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs text-slate-500">3단계 정리 · 새로운 시각으로 보기</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            서로의 감상 관점 나누기
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm leading-relaxed text-slate-600">
            <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            <span>학급 공개를 선택한 친구들의 글만 표시됩니다. 비공개 글은 교사만 볼 수 있습니다.</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-slate-500">
            공개 글 {responses.length}건
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {storageMode === 'pending-setup' && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-950"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>
            저장 준비 중: 아직 Cloudflare D1 데이터베이스가 연결되지 않아 공개된 글을 불러올 수 없습니다.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="모아 보기 방식">
        <span className="mr-1 text-xs font-semibold text-slate-500">모아 보기</span>
        {([
          ['era', '같은 시대끼리'],
          ['song', '같은 감상곡끼리'],
          ['all', '한꺼번에'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={groupBy === key}
            onClick={() => setGroupBy(key)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-medium transition-colors ${
              groupBy === key ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="반 또는 모둠 필터">
          {groups.map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setGroupFilter(grp)}
              className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                groupFilter === grp
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center sm:p-12">
          <p className="text-base font-medium text-slate-900">공개된 감성 문장이 아직 없습니다</p>
          <p className="mt-1.5 text-sm text-slate-500">
            활동지에서 ‘서로의 관점에 내 글 공개하기’를 선택해 첫 관점을 나누어 보세요.
          </p>
          <button
            type="button"
            onClick={onGoToWrite}
            className="mt-5 min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap"
          >
            감성 문장 작성하러 가기
          </button>
        </div>
      ) : (
        <PostItBoard clusters={clusters} colorOf={colorOf} myResponseId={myResponseId} />
      )}
    </div>
  );
};
