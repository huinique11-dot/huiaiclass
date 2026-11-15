import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Image as ImageIcon, ImageOff, Plus, Trash2 } from 'lucide-react';
import { isValidHttpUrl, parseYouTubeUrl } from '../lib/youtube.ts';
import { looksLikeImageUrl, toImageUrl } from '../lib/imageUrl.ts';
import type { ArtworkItem, Era } from '../types.ts';
import { ArtworkGallery } from './ArtworkGallery.tsx';

const MAX_ERAS = 10;
const MAX_SONGS = 10;

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function emptyEra(n: number): Era {
  return { id: newId(), title: `새 시대 ${n}`, historicalContext: '', artworkNote: '', artworks: [], songs: [{ id: newId(), title: '', url: '' }] };
}

const renumber = (items: ArtworkItem[]) => items.map((a, i) => ({ ...a, slotIndex: i }));

const inputCls =
  'mt-1 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none sm:text-sm';
const labelCls = 'block text-xs font-medium text-slate-700';

// 교사 화면: 시대 여러 개 관리. 시대마다 역사적 배경·미술 시각 자료는 공통, 대표 감상곡은 여러 곡.
export const EraEditor: React.FC<{ eras: Era[]; onChange: (eras: Era[]) => void }> = ({ eras, onChange }) => {
  const [activeId, setActiveId] = useState(eras[0]?.id ?? '');
  const [preview, setPreview] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const idx = Math.max(0, eras.findIndex((e) => e.id === activeId));
  const era = eras[idx];

  const patchEra = (patch: Partial<Era>) => onChange(eras.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  const addEra = () => {
    const e = emptyEra(eras.length + 1);
    onChange([...eras, e]);
    setActiveId(e.id);
  };
  const removeEra = () => {
    if (eras.length <= 1) return;
    if (!window.confirm(`「${era.title}」 시대와 그 안의 감상곡·자료를 지울까요? (저장해야 반영됩니다)`)) return;
    const next = eras.filter((_, i) => i !== idx);
    onChange(next);
    setActiveId(next[Math.max(0, idx - 1)].id);
  };
  const moveEra = (dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= eras.length) return;
    const next = [...eras];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  // 시각 자료는 개수 제한 없이 추가·삭제 (빈 칸은 저장할 때 빠짐)
  const patchSlot = (slotIndex: number, patch: Partial<ArtworkItem>) => {
    patchEra({ artworks: era.artworks.map((a, i) => (i === slotIndex ? { ...a, ...patch } : a)) });
    if (patch.imageUrl !== undefined) setBroken((b) => ({ ...b, [`${era.id}-${slotIndex}`]: false }));
  };
  const addSlot = () =>
    patchEra({ artworks: renumber([...era.artworks, { slotIndex: 0, title: '', imageUrl: '', description: '' }]) });
  const removeSlot = (slotIndex: number) => {
    patchEra({ artworks: renumber(era.artworks.filter((_, i) => i !== slotIndex)) });
    setBroken({});
  };

  if (!era) {
    return (
      <button type="button" onClick={addEra} className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">
        첫 번째 시대 추가하기
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60">
      {/* 시대 탭 */}
      <div className="overflow-x-auto px-3 pt-3">
        <div role="tablist" aria-label="편집할 시대" className="flex min-w-max items-end gap-1 border-b-2 border-slate-900">
          {eras.map((e) => {
            const active = e.id === era.id;
            return (
              <button key={e.id} type="button" role="tab" aria-selected={active} onClick={() => setActiveId(e.id)}
                className={`relative -mb-[2px] max-w-[12rem] truncate rounded-t-lg border-2 px-4 text-sm ${
                  active
                    ? 'z-10 min-h-[44px] border-slate-900 border-b-white bg-white font-bold text-slate-900'
                    : 'min-h-[38px] border-transparent bg-slate-200/70 font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                }`}>
                {active && <span className="absolute inset-x-2 top-0 h-[3px] rounded-b bg-xmas-gold" aria-hidden="true" />}
                {e.title || '(이름 없음)'}
              </button>
            );
          })}
          {eras.length < MAX_ERAS && (
            <button type="button" onClick={addEra}
              className="mb-1 ml-1 inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
              <Plus className="h-4 w-4" aria-hidden="true" /> 시대 추가
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5 rounded-b-xl bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[14rem] flex-1">
            <span className={labelCls}>시대 이름 (학생 화면의 탭 이름)</span>
            <input className={inputCls} maxLength={120} value={era.title} placeholder="예: 근현대 / 바로크"
              onChange={(e) => patchEra({ title: e.target.value })} />
          </label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => moveEra(-1)} disabled={idx === 0} aria-label="왼쪽으로 옮기기"
              className="min-h-[40px] rounded-lg border border-slate-300 px-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => moveEra(1)} disabled={idx === eras.length - 1} aria-label="오른쪽으로 옮기기"
              className="min-h-[40px] rounded-lg border border-slate-300 px-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={removeEra} disabled={eras.length <= 1}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> 이 시대 삭제
            </button>
          </div>
        </div>

        {/* 대표 감상곡 여러 곡 */}
        <div>
          <p className="text-sm font-semibold text-slate-900">대표 감상곡 <span className="text-xs font-normal text-slate-500">(학생이 이 중에서 골라 감상해요 · 최대 {MAX_SONGS}곡)</span></p>
          <div className="mt-2 space-y-2">
            {era.songs.map((song, si) => {
              const yt = parseYouTubeUrl(song.url);
              const urlOk = !song.url.trim() || isValidHttpUrl(song.url);
              return (
                <div key={song.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1.3fr_auto]">
                  <input className={inputCls} maxLength={160} value={song.title} aria-label={`감상곡 ${si + 1} 제목`}
                    placeholder={`곡 ${si + 1}: 제목과 작곡가 (예: 봄의 제전 - 스트라빈스키)`}
                    onChange={(e) => patchEra({ songs: era.songs.map((s) => (s.id === song.id ? { ...s, title: e.target.value } : s)) })} />
                  <div>
                    <input className={inputCls} type="url" maxLength={500} value={song.url} aria-label={`감상곡 ${si + 1} 링크`}
                      placeholder="유튜브 또는 음원 링크 https://..."
                      onChange={(e) => patchEra({ songs: era.songs.map((s) => (s.id === song.id ? { ...s, url: e.target.value } : s)) })} />
                    {song.url.trim() && (
                      <p className={`mt-1 text-[11px] ${yt ? 'text-teal-700' : urlOk ? 'text-slate-500' : 'text-red-700'}`}>
                        {yt ? <><CheckCircle2 className="mr-0.5 inline h-3 w-3" aria-hidden="true" />유튜브 영상으로 재생돼요</> : urlOk ? '일반 링크(바로가기 버튼)로 보여요' : 'https:// 로 시작하는 전체 주소를 넣어 주세요'}
                      </p>
                    )}
                  </div>
                  <button type="button" aria-label={`감상곡 ${si + 1} 지우기`}
                    onClick={() => patchEra({ songs: era.songs.filter((s) => s.id !== song.id) })}
                    className="min-h-[40px] rounded-lg border border-slate-300 px-3 text-slate-500 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
          {era.songs.length < MAX_SONGS && (
            <button type="button" onClick={() => patchEra({ songs: [...era.songs, { id: newId(), title: '', url: '' }] })}
              className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" aria-hidden="true" /> 감상곡 추가
            </button>
          )}
        </div>

        {/* 시대 공통: 역사적 배경 */}
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">역사적 배경과 당시 사람들의 삶 <span className="text-xs font-normal text-slate-500">(이 시대의 모든 감상곡에 공통)</span></span>
          <textarea className={`${inputCls} min-h-[96px]`} maxLength={3000} value={era.historicalContext}
            onChange={(e) => patchEra({ historicalContext: e.target.value })} />
        </label>

        {/* 시대 공통: 미술·시각 자료 2x2 */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              함께 보는 미술 · 시각 자료 <span className="text-xs font-normal text-slate-500">(이 시대 공통 · 2칸씩 · 개수 제한 없음)</span>
            </p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="시각 자료 편집 모드">
              {[false, true].map((pv) => (
                <button key={String(pv)} type="button" onClick={() => setPreview(pv)}
                  className={`min-h-[34px] rounded-md px-3 text-xs font-medium ${preview === pv ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                  {pv ? '학생 화면 미리보기' : '링크 입력·수정'}
                </button>
              ))}
            </div>
          </div>

          {preview ? (
            <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-4">
              {era.artworks.some((a) => a.title.trim() || a.imageUrl.trim() || a.description.trim()) ? <ArtworkGallery artworks={era.artworks.filter((a) => a.title.trim() || a.imageUrl.trim() || a.description.trim())} /> : <p className="py-6 text-center text-xs text-slate-500">등록된 자료가 없습니다.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {era.artworks.map((slot) => {
                const key = `${era.id}-${slot.slotIndex}`;
                const ok = isValidHttpUrl(slot.imageUrl.trim()) && !broken[key];
                return (
                  <div key={key} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-xs font-semibold text-slate-700">작품 {slot.slotIndex + 1}</p>
                      <button type="button" onClick={() => removeSlot(slot.slotIndex)} aria-label={`작품 ${slot.slotIndex + 1} 삭제`}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded px-2 text-xs text-slate-500 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> 삭제
                      </button>
                    </div>
                    <div className="aspect-[4/3] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                      {ok ? (
                        <img src={toImageUrl(slot.imageUrl)} alt={slot.title || `작품 ${slot.slotIndex + 1}`} referrerPolicy="no-referrer"
                          onError={() => setBroken((b) => ({ ...b, [key]: true }))} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-xs text-slate-400">
                          {broken[key] ? <><ImageOff className="h-5 w-5 text-amber-600" aria-hidden="true" /><span className="text-amber-800">사진을 불러오지 못했어요</span></> : <><ImageIcon className="h-5 w-5" aria-hidden="true" />사진 웹 링크를 넣으면 보여요</>}
                        </div>
                      )}
                    </div>
                    <input className={inputCls} type="url" maxLength={1000} value={slot.imageUrl} placeholder="사진 웹 링크 https://..."
                      aria-label={`작품 ${slot.slotIndex + 1} 사진 링크`} onChange={(e) => patchSlot(slot.slotIndex, { imageUrl: e.target.value })} />
                    {slot.imageUrl.trim() && (broken[key] || !looksLikeImageUrl(slot.imageUrl)) && (
                      <p className="rounded-md bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
                        {broken[key] ? '이 주소로는 그림을 불러올 수 없어요. ' : '그림 파일이 아니라 웹 페이지 주소 같아요. '}
                        그림 위에서 <b>마우스 오른쪽 클릭 → 「이미지 주소 복사」</b>한 주소(보통 .jpg, .png로 끝남)를 붙여 넣어 주세요.
                        위키백과 「파일:」 페이지 주소와 구글 드라이브 공유 링크는 자동으로 바뀌어요.
                      </p>
                    )}
                    <input className={inputCls} maxLength={120} value={slot.title} placeholder="그림 제목과 화가"
                      aria-label={`작품 ${slot.slotIndex + 1} 제목`} onChange={(e) => patchSlot(slot.slotIndex, { title: e.target.value })} />
                    <textarea className={`${inputCls} min-h-[64px]`} maxLength={1200} value={slot.description} placeholder="작품 설명 (그림을 누르면 보여요)"
                      aria-label={`작품 ${slot.slotIndex + 1} 설명`} onChange={(e) => patchSlot(slot.slotIndex, { description: e.target.value })} />
                  </div>
                );
              })}
            </div>
          )}

          {!preview && (
            <button type="button" onClick={addSlot}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Plus className="h-4 w-4" aria-hidden="true" /> 시각 자료 추가
            </button>
          )}

          <label className="block">
            <span className={labelCls}>미술 · 시각 자료 안내 문구 (선택)</span>
            <textarea className={`${inputCls} min-h-[56px]`} maxLength={600} value={era.artworkNote}
              placeholder="예: 네 작품을 눌러보며 이 시대의 표정과 분위기를 살펴봅시다."
              onChange={(e) => patchEra({ artworkNote: e.target.value })} />
          </label>
        </div>
      </div>
    </div>
  );
};
