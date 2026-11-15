import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Maximize, Minimize2, Minus, Plus, Scan } from 'lucide-react';
import type { StudentResponse } from '../types.ts';

export interface BoardCluster {
  key: string;
  title: string;
  subtitle?: string;
  items: StudentResponse[];
}

// 포스트잇 색 (시대마다 다른 색)
const NOTE_COLORS = ['#fff3a3', '#ffd1dc', '#c9f0c4', '#cfe6ff', '#ffdcae', '#e5d4ff', '#d7f5ee', '#ffe0f0'];
export function noteColor(index: number) {
  return NOTE_COLORS[((index % NOTE_COLORS.length) + NOTE_COLORS.length) % NOTE_COLORS.length];
}

const MIN_SCALE = 0.08;
const MAX_SCALE = 4;

interface View {
  x: number;
  y: number;
  s: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// 한 화면에 모두 보이게 작게 놓고, 두 손가락(또는 휠·트랙패드)으로 확대·이동하는 보드
export const PostItBoard: React.FC<{
  clusters: BoardCluster[];
  colorOf: (r: StudentResponse) => string;
  myResponseId: string | null;
}> = ({ clusters, colorOf, myResponseId }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 });
  const [animate, setAnimate] = useState(false);
  const [full, setFull] = useState(false);
  const [contentWidth, setContentWidth] = useState(2400);
  const downTarget = useRef<EventTarget | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinchDist: number; mid: { x: number; y: number } } | null>(null);

  const fitAll = useCallback((withAnim = true) => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const s = clamp(Math.min(fw / cw, fh / ch) * 0.96, MIN_SCALE, 1.2);
    setAnimate(withAnim);
    setView({ s, x: (fw - cw * s) / 2, y: (fh - ch * s) / 2 });
  }, []);

  // 화면 비율에 맞춰 보드 폭을 정함 (세로 폰이면 묶음이 아래로 쌓이게)
  useLayoutEffect(() => {
    const f = frameRef.current;
    if (!f) return;
    const ratio = f.clientWidth / Math.max(1, f.clientHeight);
    setContentWidth(Math.round(Math.min(2600, Math.max(900, ratio * 1500))));
  }, [full]);

  useLayoutEffect(() => {
    fitAll(false);
  }, [clusters, full, contentWidth, fitAll]);

  useEffect(() => {
    const onResize = () => fitAll(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitAll]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  // 화면의 한 점(px, py)을 기준으로 확대·축소
  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setView((v) => {
      const s = clamp(v.s * factor, MIN_SCALE, MAX_SCALE);
      const k = s / v.s;
      return { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);

  // 휠 / 트랙패드 핀치 (passive:false 로 페이지 스크롤 막기)
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setAnimate(false);
      const rect = frame.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const step = e.ctrlKey ? 0.01 : 0.0015;
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * step));
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const local = (e: React.PointerEvent) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    frameRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) downTarget.current = e.target;
    setAnimate(false);
    if (pointers.current.size === 1) gesture.current = { moved: 0, pinchDist: 0, mid: local(e) };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        moved: 99,
        pinchDist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const g = gesture.current;
      if (g.pinchDist > 0) {
        const factor = dist / g.pinchDist;
        setView((v) => {
          const s = clamp(v.s * factor, MIN_SCALE, MAX_SCALE);
          const k = s / v.s;
          return { s, x: mid.x - (g.mid.x - v.x) * k, y: mid.y - (g.mid.y - v.y) * k };
        });
      }
      gesture.current = { moved: 99, pinchDist: dist, mid };
    } else {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      gesture.current.moved += Math.abs(dx) + Math.abs(dy);
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      // 거의 움직이지 않은 탭 → 누른 포스트잇이나 묶음으로 확대 (Prezi처럼)
      if (g && g.moved < 6) {
        const target = (downTarget.current as HTMLElement | null)?.closest<HTMLElement>('[data-zoom-target]');
        if (target) zoomTo(target);
      }
      gesture.current = null;
    } else if (pointers.current.size === 1) {
      const [only] = [...pointers.current.values()];
      gesture.current = { moved: 99, pinchDist: 0, mid: only };
    }
  };

  const zoomTo = (el: HTMLElement) => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    // 콘텐츠 좌표(확대 전 기준)로 위치 계산
    let x = 0;
    let y = 0;
    let node: HTMLElement | null = el;
    while (node && node !== content) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const s = clamp(Math.min(fw / w, fh / h) * 0.85, MIN_SCALE, MAX_SCALE);
    setAnimate(true);
    setView({ s, x: fw / 2 - (x + w / 2) * s, y: fh / 2 - (y + h / 2) * s });
  };

  const center = () => {
    const f = frameRef.current!;
    return { x: f.clientWidth / 2, y: f.clientHeight / 2 };
  };
  const btn =
    'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white/95 text-slate-700 shadow-sm hover:bg-slate-50';

  return (
    <div className={full ? 'fixed inset-0 z-50 bg-slate-100 p-2 sm:p-4' : 'relative'}>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative w-full cursor-grab touch-none select-none overflow-hidden rounded-xl border border-slate-200 active:cursor-grabbing ${
          full ? 'h-full' : 'h-[72vh] min-h-[420px]'
        }`}
        style={{
          backgroundColor: '#f6efe6',
          backgroundImage: 'radial-gradient(circle, rgba(120,90,80,0.18) 1px, transparent 1.2px)',
          backgroundSize: `${24 * view.s}px ${24 * view.s}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        aria-label="학생 감상 포스트잇 보드. 두 손가락이나 휠로 확대하고, 끌어서 이동하고, 포스트잇을 누르면 크게 봅니다."
      >
        <div
          ref={contentRef}
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: contentWidth,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
            transition: animate ? 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
            willChange: 'transform',
          }}
        >
          <div className="flex flex-wrap items-start justify-center gap-16 p-16">
            {clusters.map((c) => {
              const cols = Math.max(1, Math.min(6, Math.ceil(Math.sqrt(c.items.length * 1.6))));
              return (
                <section
                  key={c.key}
                  data-zoom-target
                  className="rounded-[28px] border-2 border-dashed border-slate-300/80 bg-white/40 p-8"
                >
                  <header className="mb-6">
                    <h3 className="text-3xl font-bold text-slate-900">{c.title}</h3>
                    <p className="mt-1 text-lg text-slate-500">
                      {c.subtitle ? `${c.subtitle} · ` : ''}
                      {c.items.length}장
                    </p>
                  </header>
                  <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${cols}, 260px)` }}>
                    {c.items.map((r, i) => {
                      const mine = r.id === myResponseId;
                      const tilt = ((r.id.charCodeAt(0) + i * 7) % 7) - 3;
                      return (
                        <article
                          key={r.id}
                          data-zoom-target
                          className="relative flex min-h-[220px] flex-col p-5 pt-7 shadow-[0_6px_14px_rgba(60,30,30,0.18)]"
                          style={{ background: colorOf(r), transform: `rotate(${tilt * 0.6}deg)` }}
                        >
                          <span
                            className="absolute left-1/2 top-[-10px] h-5 w-20 -translate-x-1/2 rotate-[-2deg] bg-white/60 shadow-sm"
                            aria-hidden="true"
                          />
                          <p className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-900">
                            {r.reflectionText}
                          </p>
                          {r.presentConnection.trim() && (
                            <p className="mt-3 border-t border-black/10 pt-2 text-[13px] leading-snug text-slate-700">
                              💭 지금 시대: {r.presentConnection}
                            </p>
                          )}
                          <footer className="mt-3 flex items-center justify-between gap-2 text-[12px] text-slate-600">
                            <strong className="truncate text-slate-800">
                              {r.studentName}
                              {mine && <span className="ml-1 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">나</span>}
                            </strong>
                            {r.songTitle && <span className="truncate">♪ {r.songTitle}</span>}
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* 조작 버튼 */}
        <div
          className="absolute bottom-3 right-3 flex flex-col gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <button type="button" className={btn} aria-label="확대" onClick={() => { setAnimate(true); const c = center(); zoomAt(c.x, c.y, 1.4); }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={btn} aria-label="축소" onClick={() => { setAnimate(true); const c = center(); zoomAt(c.x, c.y, 1 / 1.4); }}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={btn} aria-label="전체 보기" onClick={() => fitAll(true)}>
            <Scan className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={btn} aria-label={full ? '화면 크게 보기 끝내기' : '화면 가득 크게 보기'} onClick={() => setFull((f) => !f)}>
            {full ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-md bg-white/85 px-2.5 py-1 text-[11px] text-slate-600 shadow-sm">
          <span className="hidden sm:inline">두 손가락·휠로 확대 · 끌어서 이동 · 포스트잇을 누르면 크게 · </span>
          <span className="sm:hidden">두 손가락으로 확대 · </span>
          {Math.round(view.s * 100)}%
        </p>
      </div>
    </div>
  );
};
