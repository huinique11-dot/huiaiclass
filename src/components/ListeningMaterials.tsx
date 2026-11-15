import React, { useMemo, useState } from 'react';
import { PERFORMANCE_FORMS } from '../lib/performanceForms.ts';
import { BookOpen, CheckCircle2, ExternalLink, Headphones, Music2 } from 'lucide-react';
import { isValidHttpUrl, parseYouTubeUrl } from '../lib/youtube.ts';
import type { Era, EraSong } from '../types.ts';
import { ArtworkGallery } from './ArtworkGallery.tsx';

interface ListeningMaterialsProps {
  eras: Era[];
  eraId: string;
  songId: string;
  onSelect: (eraId: string, songId: string) => void;
}

const needsSetup = (val: string) => val.includes('[확인 필요]');

// 학생 화면: 시대 선택(브라우저 탭 모양) → 시대별 대표곡 선택 → 공통 역사 배경과 미술·시각 자료
export const ListeningMaterials: React.FC<ListeningMaterialsProps> = ({ eras, eraId, songId, onSelect }) => {
  const era = eras.find((e) => e.id === eraId) ?? eras[0];
  const song = era?.songs.find((s) => s.id === songId) ?? era?.songs[0];
  const yt = song ? parseYouTubeUrl(song.url) : null;
  const hasUrl = song ? isValidHttpUrl(song.url) : false;
  const [mode, setMode] = useState<'era' | 'form'>('era');
  const formsInUse = useMemo(
    () => PERFORMANCE_FORMS.filter((f) => eras.some((e) => e.songs.some((x) => x.form === f.key))),
    [eras],
  );
  const [form, setForm] = useState<string>('');
  const activeForm = form || song?.form || formsInUse[0]?.key || '';
  const formSongs = useMemo(
    () => eras.flatMap((e) => e.songs.filter((x) => x.form === activeForm).map((x) => ({ era: e, song: x }))),
    [eras, activeForm],
  );
  const formInfo = PERFORMANCE_FORMS.find((f) => f.key === activeForm);

  return (
    <aside className="rounded-xl border border-slate-200 bg-white lg:col-span-5">
      <div className="px-5 pt-4 sm:px-6">
        <div className="flex items-center gap-2 text-slate-900">
          <Headphones className="h-4 w-4 text-slate-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold">오늘의 감상 자료</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">① 시대나 연주 형태로 찾아보고 ② 감상곡을 골라 들어 보세요.</p>
        {formsInUse.length > 0 && (
          <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="radiogroup" aria-label="찾아보기 방식">
            {([['era', '시대별로'], ['form', '연주 형태별로']] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => {
                setMode(k);
                if (k === 'form' && !song?.form) {
                  const first = eras.flatMap((e) => e.songs.filter((x) => x.form === activeForm).map((x) => ({ e, x })))[0];
                  if (first) onSelect(first.e.id, first.x.id);
                }
              }}
                className={`min-h-[34px] rounded-md px-3 text-xs font-semibold ${mode === k ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'form' && (
        <div className="mt-4 px-5 sm:px-6">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="연주 형태">
            {formsInUse.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={f.key === activeForm} onClick={() => {
                setForm(f.key);
                const first = eras.flatMap((e) => e.songs.filter((x) => x.form === f.key).map((x) => ({ e, x })))[0];
                if (first && song?.form !== f.key) onSelect(first.e.id, first.x.id);
              }}
                className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold ${
                  f.key === activeForm ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}>
                {f.key}
              </button>
            ))}
          </div>
          {formInfo && <p className="mt-2 text-xs text-slate-500">{formInfo.group} · {formInfo.desc}</p>}
          <div role="radiogroup" aria-label={`${activeForm} 감상곡`} className="mt-3 grid gap-1.5">
            {formSongs.map(({ era: e, song: x }) => (
              <SongButton key={x.id} song={x} on={x.id === song?.id && e.id === era?.id} eraTitle={e.title} onClick={() => onSelect(e.id, x.id)} />
            ))}
          </div>
          <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
            아래 배경과 미술 자료는 고른 곡의 시대 「{era?.title}」 자료예요.
          </p>
        </div>
      )}

      {/* ① 시대 탭 */}
      {mode === 'era' && (
      <div className="mt-4 overflow-x-auto px-3 sm:px-4">
        <div role="tablist" aria-label="탐구 시대" className="flex min-w-max items-end gap-1 border-b-2 border-slate-900">
          {eras.map((e) => {
            const active = e.id === era?.id;
            return (
              <button
                key={e.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(e.id, e.songs[0]?.id ?? '')}
                className={`relative -mb-[2px] max-w-[11rem] truncate rounded-t-lg border-2 px-4 text-sm transition-colors ${
                  active
                    ? 'z-10 min-h-[46px] border-slate-900 border-b-white bg-white font-bold text-slate-900'
                    : 'min-h-[40px] border-transparent bg-slate-100 font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                }`}
              >
                {active && <span className="absolute inset-x-2 top-0 h-[3px] rounded-b bg-xmas-gold" aria-hidden="true" />}
                {e.title}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {era && (
        <div className="divide-y divide-slate-200 px-5 sm:px-6">
          {/* ② 대표 감상곡 선택 */}
          <div className="py-4">
            <p className={`text-xs font-medium text-slate-500 ${mode === 'form' ? 'hidden' : ''}`}>
              「{era.title}」 대표 감상곡 {era.songs.length > 1 && <span>— {era.songs.length}곡 중 하나를 골라요</span>}
            </p>
            {mode === 'form' ? null : era.songs.length === 0 ? (
              <p className="mt-1.5 text-xs leading-relaxed text-amber-800">
                [확인 필요] 교사 확인 화면에서 이 시대의 감상곡을 등록해 주세요.
              </p>
            ) : (
              <div role="radiogroup" aria-label="대표 감상곡" className="mt-2 grid gap-1.5">
                {era.songs.map((x) => (
                  <SongButton key={x.id} song={x} on={x.id === song?.id} onClick={() => onSelect(era.id, x.id)} />
                ))}
              </div>
            )}

            {song && yt ? (
              <div className="mt-3 space-y-2.5">
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
                  <iframe
                    key={yt.embedUrl}
                    src={yt.embedUrl}
                    title={`${song.title} 감상 영상`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="h-full w-full border-0"
                  />
                </div>
                <a href={yt.watchUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" /> 유튜브에서 직접 열기
                </a>
              </div>
            ) : song && hasUrl ? (
              <a href={song.url} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> 감상 음원·영상 열기
              </a>
            ) : null}
          </div>

          {/* 시대 공통: 역사적 배경 */}
          <div className="py-4">
            <p className="text-xs font-medium text-slate-500">역사적 배경과 당시 사람들의 삶</p>
            <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed ${needsSetup(era.historicalContext) ? 'text-amber-800' : 'text-slate-700'}`}>
              {era.historicalContext || '[확인 필요] 이 시대의 역사적 배경을 입력해 주세요.'}
            </p>
          </div>

          {/* 시대 공통: 미술·시각 자료 */}
          <div className="py-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>함께 보는 미술 · 시각 자료</span>
            </div>
            {era.artworkNote.trim() && !needsSetup(era.artworkNote) && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{era.artworkNote}</p>
            )}
            {era.artworks.length > 0 ? (
              <div className="mt-3">
                <ArtworkGallery artworks={era.artworks} />
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-amber-800">[확인 필요] 이 시대의 미술·시각 자료를 등록해 주세요.</p>
            )}
            {(era.links ?? []).length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">더 많은 작품으로 미술 경향 살펴보기</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(era.links ?? []).map((l) => (
                    <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" /> {l.title}
                    </a>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">새 탭에서 열려요. 다 본 뒤 이 탭으로 돌아오세요.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

function SongButton({ song, on, eraTitle, onClick }: { song: EraSong; on: boolean; eraTitle?: string; onClick: () => void }) {
  const chip = on ? 'border-white/40 text-white/90' : 'border-slate-300 text-slate-500';
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`flex min-h-[44px] items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        on ? 'border-slate-900 bg-slate-900 font-semibold text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
      }`}>
      {on ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Music2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block">{song.title}</span>
        {(eraTitle || song.form || song.movement) && (
          <span className="mt-1 flex flex-wrap gap-1 text-[11px] font-normal">
            {eraTitle && <span className={`rounded-full border px-1.5 ${chip}`}>{eraTitle}</span>}
            {song.form && !eraTitle && <span className={`rounded-full border px-1.5 ${chip}`}>{song.form}</span>}
            {song.movement && <span className={`rounded-full border px-1.5 ${chip}`}>{song.movement}</span>}
          </span>
        )}
      </span>
    </button>
  );
}
