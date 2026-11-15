import React from 'react';
import { ACHIEVEMENT_STANDARDS, FOUR_P } from '../lib/studentProfile.ts';

// 성취기준 원문
export const StandardsBox: React.FC = () => (
  <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3.5">
    <p className="text-xs font-semibold text-slate-500">관련 성취기준</p>
    <ul className="mt-2 space-y-1.5">
      {ACHIEVEMENT_STANDARDS.map((s) => (
        <li key={s.code} className="flex gap-2 text-sm leading-relaxed text-slate-800">
          <span className="shrink-0 font-mono text-xs leading-6 text-slate-500">[{s.code}]</span>
          <span>{s.text}</span>
        </li>
      ))}
    </ul>
  </div>
);

// 4P(현상-문제-과업-실천) 흐름. current에 해당하는 칸을 강조하고 지금 하는 활동을 적어 줍니다.
export const FourPStrip: React.FC<{ current: 'P1' | 'P2' | 'P3' | 'P4'; nowLabel: string }> = ({ current, nowLabel }) => (
  <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="4P 프로젝트 흐름">
    {FOUR_P.map((p) => {
      const isNow = p.key === current;
      return (
        <li
          key={p.key}
          aria-current={isNow ? 'step' : undefined}
          className={`relative rounded-xl border p-4 ${
            isNow ? 'border-slate-900 bg-white shadow-md ring-2 ring-xmas-gold/60' : 'border-slate-200 bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold ${
                isNow ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {p.key}
            </span>
            <span className={`text-sm font-semibold ${isNow ? 'text-slate-900' : 'text-slate-700'}`}>{p.name}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{p.stage}</p>
          <p className={`mt-2 text-sm leading-relaxed ${isNow ? 'text-slate-800' : 'text-slate-500'}`}>{p.body}</p>
          {isNow && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-xmas-gold/25 px-2.5 py-1 text-xs font-semibold text-slate-900">
              📍 지금 여기 · {nowLabel}
            </p>
          )}
        </li>
      );
    })}
  </ol>
);
