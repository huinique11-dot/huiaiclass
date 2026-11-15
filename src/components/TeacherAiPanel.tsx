import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, Download, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  AI_RUBRIC,
  JUDGMENT_LABELS,
  deleteAiActivity,
  fetchAiStatus,
  fetchTeacherAiActivities,
  judgmentItems,
  setAiEnabled,
  updateAiActivityEvaluation,
  type AiActivity,
  type AiStatus,
} from '../lib/aiApi.ts';
import type { RubricLevel } from '../types.ts';
import { AiResultView } from './AiAnalysisView.tsx';

// 교사 화면: 4단계 AI 분석 비교 학습지 확인·평가
export function TeacherAiPanel() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [items, setItems] = useState<AiActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, list] = await Promise.all([fetchAiStatus(), fetchTeacherAiActivities()]);
      setStatus(s);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '4단계 활동을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async () => {
    if (!status) return;
    setToggling(true);
    setError('');
    try {
      const res = await setAiEnabled(!status.enabled);
      setStatus({ ...status, enabled: res.enabled, aiConnected: res.aiConnected });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 설정을 바꾸지 못했습니다.');
    } finally {
      setToggling(false);
    }
  };

  const exportCsv = () => {
    const header = ['학번', '별칭', '반·모둠', '곡', '가설', '분석 기준', 'AI 결과 요약', '판단', 'AI와 내 느낌 비교', '나만의 언어로 재구성', '악기 소리·노랫말 구절', 'AI 윤리 생각', '평가', '교사 피드백', '저장 시각'];
    const rows = items.map((a) => {
      const labels = judgmentItems(a.aiResult);
      const judged = labels
        .filter((l) => a.judgments[l.key])
        .map((l) => `${l.label}: ${JUDGMENT_LABELS[a.judgments[l.key]]}`)
        .join(' / ');
      return [
        a.studentId,
        a.studentName,
        a.classGroup,
        a.songs.map((s) => `${s.title}${s.artist ? ` - ${s.artist}` : ''}`).join(' / '),
        a.hypothesis,
        a.criterion === 'lyrics' ? '가사' : '음악적 특징',
        a.aiResult?.summary ?? '',
        judged,
        a.comparisonText,
        a.reconstructionText,
        a.evidenceText,
        a.ethicsText,
        a.rubricLevel || '미평가',
        a.teacherFeedback,
        new Date(a.updatedAt).toLocaleString('ko-KR'),
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `4단계_AI분석비교_학생활동_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const graded = items.filter((a) => a.rubricLevel).length;

  return (
    <section className="mt-12 space-y-5 border-t-2 border-slate-200 pt-10" aria-labelledby="ai-panel-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">4단계 (7~8차시) · H-A-H</p>
          <h2 id="ai-panel-title" className="mt-1 text-xl font-semibold text-slate-900">
            또래 음악 AI 분석 비교 학습지
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            제출 {items.length}건 · 평가 완료 {graded}건
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> 새로고침
          </button>
          <button type="button" onClick={exportCsv} disabled={items.length === 0}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Download className="h-4 w-4" aria-hidden="true" /> CSV 내보내기
          </button>
        </div>
      </div>

      {/* AI 열기/닫기 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            학생 AI 분석 {status?.enabled ? <span className="text-teal-700">열림</span> : <span className="text-slate-500">닫힘</span>}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            수업 시간에만 열어 두세요. 학생 계정 없이 학교 서버(Cloudflare Workers AI)로 분석하며, 가사 원문과 학생 이름은 저장·전송하지 않습니다.
          </p>
          {status && !status.aiConnected && (
            <p className="mt-2 text-xs text-red-700">
              Workers AI가 아직 연결되지 않았습니다. wrangler.jsonc의 AI 바인딩이 배포되었는지 확인해 주세요.
            </p>
          )}
        </div>
        <button type="button" onClick={toggle} disabled={toggling || !status}
          role="switch" aria-checked={Boolean(status?.enabled)}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
            status?.enabled ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}>
          {toggling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {status?.enabled ? 'AI 분석 닫기' : 'AI 분석 열기'}
        </button>
      </div>

      {/* 평가 기준 */}
      <details className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <summary className="cursor-pointer font-medium text-slate-900">
          평가 기준: AI 분석 결과에 대한 비판적 비교·수정 및 주체적 재구성
        </summary>
        <dl className="mt-3 space-y-2">
          {(['상', '중', '하'] as const).map((lv) => (
            <div key={lv} className="flex gap-3">
              <dt className="w-6 shrink-0 font-semibold text-slate-900">{lv}</dt>
              <dd className="text-slate-700">{AI_RUBRIC[lv]}</dd>
            </div>
          ))}
        </dl>
      </details>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          아직 제출된 4단계 활동이 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              open={openId === a.id}
              onToggle={() => setOpenId(openId === a.id ? null : a.id)}
              onUpdated={(u) => setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== a.id))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityCard({
  activity: a,
  open,
  onToggle,
  onUpdated,
  onDeleted,
}: {
  activity: AiActivity;
  open: boolean;
  onToggle: () => void;
  onUpdated: (a: AiActivity) => void;
  onDeleted: () => void;
}) {
  const [level, setLevel] = useState<RubricLevel>(a.rubricLevel);
  const [feedback, setFeedback] = useState(a.teacherFeedback);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const labels = judgmentItems(a.aiResult);

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      onUpdated(await updateAiActivityEvaluation(a.id, level, feedback.trim()));
      setMsg('저장됨');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`${a.studentName} 학생의 4단계 활동을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
      await deleteAiActivity(a.id);
      onDeleted();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-left">
        <span className="font-mono text-xs tabular-nums text-slate-500">{a.studentId}</span>
        <span className="font-semibold text-slate-900">{a.studentName}</span>
        {a.classGroup && <span className="text-xs text-slate-500">{a.classGroup}</span>}
        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
          {a.criterion === 'lyrics' ? '가사' : '음악적 특징'}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{a.reconstructionText}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${a.rubricLevel ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {a.rubricLevel || '미평가'}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-200 px-5 py-5 text-sm">
          <Row label="[H] 곡">{a.songs.map((s) => `${s.title}${s.artist ? ` - ${s.artist}` : ''}`).join(', ')}</Row>
          <Row label="[H] 처음 세운 가설">{a.hypothesis}</Row>
          {a.criterion === 'music' && (
            <Row label="[H] 학생이 적은 음악적 특징">
              {a.songs
                .map((s) => `${s.title}: 템포 ${s.tempo || '-'} / 분위기 ${s.mood || '-'} / 악기 ${s.instruments || '-'} / 가사 ${s.lyricsContent || '-'}`)
                .join('\n')}
            </Row>
          )}
          {a.aiResult && (
            <div>
              <p className="text-xs font-medium text-slate-500">[A] AI 분석 결과</p>
              <AiResultView result={a.aiResult} />
            </div>
          )}
          {labels.length > 0 && (
            <Row label="[H] 항목별 판단">
              {labels.map((l) => `${l.label}: ${a.judgments[l.key] ? JUDGMENT_LABELS[a.judgments[l.key]] : '선택 안 함'}`).join('\n')}
            </Row>
          )}
          <Row label="[H] AI 결과와 내 느낌 비교">{a.comparisonText}</Row>
          <Row label="[H] 나만의 언어로 재구성">{a.reconstructionText}</Row>
          {a.evidenceText && <Row label="[H] 대표 악기 소리·노랫말 구절">{a.evidenceText}</Row>}
          {a.ethicsText && <Row label="AI 윤리 생각">{a.ethicsText}</Row>}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">평가 단계</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="평가 단계">
              {(['상', '중', '하'] as const).map((lv) => (
                <button key={lv} type="button" role="radio" aria-checked={level === lv} title={AI_RUBRIC[lv]}
                  onClick={() => setLevel(level === lv ? '' : lv)}
                  className={`min-h-[40px] min-w-[52px] rounded-lg border px-3 text-sm font-semibold ${
                    level === lv ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}>
                  {lv}
                </button>
              ))}
            </div>
            {level && <p className="mt-2 text-xs text-slate-600">{AI_RUBRIC[level]}</p>}
            <textarea value={feedback} maxLength={500} onChange={(e) => setFeedback(e.target.value)}
              placeholder="AI 결과를 어떻게 따져 보았는지, 더 생각해 볼 점을 적어 주세요."
              className="mt-3 min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={remove}
                className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-red-700 hover:underline">
                <Trash2 className="h-4 w-4" aria-hidden="true" /> 삭제
              </button>
              <div className="flex items-center gap-3">
                {msg && <span className="text-xs text-slate-600">{msg}</span>}
                <button type="button" onClick={save} disabled={saving}
                  className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                  {saving ? '저장 중...' : '평가·피드백 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-line text-slate-900">{children}</p>
    </div>
  );
}
