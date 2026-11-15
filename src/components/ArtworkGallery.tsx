import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, ImageOff, X } from 'lucide-react';
import type { ArtworkItem } from '../types.ts';

interface ArtworkGalleryProps {
  artworks: ArtworkItem[];
}

export const ArtworkGallery: React.FC<ArtworkGalleryProps> = ({ artworks }) => {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [brokenSlots, setBrokenSlots] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setBrokenSlots({});
    setSelectedSlot((prev) =>
      prev !== null && artworks.some((item) => item.slotIndex === prev) ? prev : null,
    );
  }, [artworks]);

  if (artworks.length === 0) {
    return null;
  }

  const rows: ArtworkItem[][] = [];
  for (let i = 0; i < artworks.length; i += 2) {
    rows.push(artworks.slice(i, i + 2));
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row, rowIdx) => {
          const selectedInRow = row.find((item) => item.slotIndex === selectedSlot) ?? null;

          return (
            <React.Fragment key={rowIdx}>
              {row.map((item) => {
                const isSelected = item.slotIndex === selectedSlot;
                const isBroken = Boolean(brokenSlots[item.slotIndex]);
                const displayTitle = item.title.trim() || `시각 자료 ${item.slotIndex + 1}`;

                return (
                  <button
                    key={item.slotIndex}
                    type="button"
                    onClick={() => setSelectedSlot(isSelected ? null : item.slotIndex)}
                    aria-expanded={isSelected}
                    className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/15'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                      {item.imageUrl && !isBroken ? (
                        <img
                          src={item.imageUrl}
                          alt={displayTitle}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenSlots((prev) => ({ ...prev, [item.slotIndex]: true }))
                          }
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center text-slate-400">
                          {isBroken ? (
                            <>
                              <ImageOff className="h-5 w-5" aria-hidden="true" />
                              <span className="text-[11px]">이미지 불러오기 실패</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon className="h-5 w-5" aria-hidden="true" />
                              <span className="text-[11px]">이미지 없음</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2.5">
                      <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-900">
                        {displayTitle}
                      </p>
                    </div>
                  </button>
                );
              })}

              {selectedInRow && (
                <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {selectedInRow.title.trim() || `시각 자료 ${selectedInRow.slotIndex + 1}`}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      aria-label="작품 설명 닫기"
                      className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 whitespace-nowrap"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>닫기</span>
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {selectedInRow.description.trim() || '작품 설명이 아직 입력되지 않았습니다.'}
                  </p>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">
        그림을 누르면 아래에 작품 설명이 펼쳐집니다. 다시 누르면 닫힙니다.
      </p>
    </div>
  );
};
