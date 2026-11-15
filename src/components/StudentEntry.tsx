import React, { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import type { StudentProfile } from '../types.ts';

interface StudentEntryProps {
  onEnter: (profile: StudentProfile) => void;
  onGoTeacher: () => void;
}

// 처음 한 번만 학번·별칭을 입력하면 모든 활동에 자동으로 들어갑니다.
export const StudentEntry: React.FC<StudentEntryProps> = ({ onEnter, onGoTeacher }) => {
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [classGroup, setClassGroup] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = studentId.trim();
    const name = studentName.trim();
    if (!id) return setError('학번을 입력해 주세요.');
    if (!name) return setError('별칭(이름)을 입력해 주세요.');
    onEnter({ studentId: id, studentName: name, classGroup: classGroup.trim() });
  };

  const inputCls =
    'mt-1.5 min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15';

  return (
    <div className="mx-auto max-w-md py-6 sm:py-12">
      <div className="text-center">
        <p className="text-xs text-slate-500">중학교 2학년 음악 · 읽걷쓰AI 프로젝트</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">무엇을 욕망했는가</h1>
        <p className="mt-1 text-base text-slate-700">음악으로 시대 읽고 공감하기</p>
      </div>

      <form onSubmit={submit} className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <LogIn className="h-5 w-5" aria-hidden="true" /> 활동 시작하기
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          처음 한 번만 입력하면 감상·활동지와 AI 분석에 자동으로 들어가요.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-800">
              학번(번호) <span className="text-red-700">*</span>
            </span>
            <input className={`${inputCls} font-mono`} inputMode="numeric" maxLength={20} value={studentId}
              onChange={(e) => setStudentId(e.target.value)} placeholder="예: 20305" autoFocus />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">
              별칭(이름) <span className="text-red-700">*</span>
            </span>
            <input className={inputCls} maxLength={30} value={studentName}
              onChange={(e) => setStudentName(e.target.value)} placeholder="예: 푸른음표 (가상 별칭)" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">
              반 또는 모둠 <span className="text-xs font-normal text-slate-500">(선택)</span>
            </span>
            <input className={inputCls} maxLength={40} value={classGroup}
              onChange={(e) => setClassGroup(e.target.value)} placeholder="예: 2모둠" />
          </label>
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

        <button type="submit"
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-base font-semibold text-white hover:bg-slate-800">
          들어가기
        </button>

        <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          실명 대신 가상 별칭을 써 주세요. 공용 기기라면 활동을 마친 뒤 오른쪽 위 「나가기」를 눌러 주세요.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        선생님이신가요?{' '}
        <button type="button" onClick={onGoTeacher} className="font-medium text-slate-900 underline underline-offset-4">
          교사 확인으로 가기
        </button>
      </p>
    </div>
  );
};
