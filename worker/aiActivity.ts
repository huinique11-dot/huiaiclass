// 4단계(7~8차시) 또래 음악 H-A-H 활동 API
// H 학생이 먼저 가설 → A 필요할 때만 학생이 자기 계정의 AI 도구에 질문(앱이 프롬프트 제공) → H 학생이 정리·비교·재구성
// - 앱 서버는 AI를 호출하지 않습니다. 학생이 붙여 넣은 AI 답과 정리한 항목만 저장합니다.
// - 가사 원문은 저장하지 않습니다(저작권).

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[]; success: boolean }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface AiEnv {
  DB: D1Database;
}

export interface AiDeps {
  jsonResponse(body: unknown, status?: number): Response;
  cleanText(raw: unknown, maxLen: number): string;
  parseJsonBody(request: Request): Promise<Record<string, unknown> | null>;
  isTeacherAuthenticated(request: Request): Promise<boolean>;
  timingSafeEqualStrings(a: string, b: string): Promise<boolean>;
}

const MAX_SONGS = 3;

type Criterion = 'lyrics' | 'music';

interface SongInput {
  title: string;
  artist: string;
  lyrics: string;
  tempo: string;
  mood: string;
  instruments: string;
  lyricsContent: string;
}

interface ActivityRow {
  id: string;
  student_id: string;
  student_name: string;
  class_group: string;
  songs_json: string;
  hypothesis: string;
  criterion: string;
  ai_result_json: string;
  judgments_json: string;
  comparison_text: string;
  reconstruction_text: string;
  evidence_text: string;
  ethics_text: string;
  rubric_level: string;
  teacher_feedback: string;
  edit_token?: string;
  created_at: string;
  updated_at: string;
}

const ACTIVITY_COLUMNS =
  'id, student_id, student_name, class_group, songs_json, hypothesis, criterion, ai_result_json, judgments_json, comparison_text, reconstruction_text, evidence_text, ethics_text, rubric_level, teacher_feedback, created_at, updated_at';

// ---------- 테이블 자동 생성(기존 데이터는 건드리지 않음) ----------

let tablesReady = false;

async function ensureTables(db: D1Database): Promise<void> {
  if (tablesReady) return;
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS ai_activities (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, student_name TEXT NOT NULL, class_group TEXT NOT NULL DEFAULT '', songs_json TEXT NOT NULL DEFAULT '[]', hypothesis TEXT NOT NULL DEFAULT '', criterion TEXT NOT NULL DEFAULT '', ai_result_json TEXT NOT NULL DEFAULT '', judgments_json TEXT NOT NULL DEFAULT '{}', comparison_text TEXT NOT NULL DEFAULT '', reconstruction_text TEXT NOT NULL DEFAULT '', evidence_text TEXT NOT NULL DEFAULT '', ethics_text TEXT NOT NULL DEFAULT '', rubric_level TEXT NOT NULL DEFAULT '', teacher_feedback TEXT NOT NULL DEFAULT '', edit_token TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    )
    .run();
  await db
    .prepare('CREATE INDEX IF NOT EXISTS idx_ai_activities_updated ON ai_activities (updated_at DESC)')
    .run();
  tablesReady = true;
}

// ---------- 입력 정리 ----------

function parseSongs(raw: unknown, deps: AiDeps, criterion: Criterion | ''): SongInput[] {
  if (!Array.isArray(raw)) return [];
  const songs: SongInput[] = [];
  for (const item of raw.slice(0, MAX_SONGS)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const song: SongInput = {
      title: deps.cleanText(r.title, 80),
      artist: deps.cleanText(r.artist, 60),
      lyrics: criterion === 'lyrics' ? deps.cleanText(r.lyrics, 2500) : '',
      tempo: deps.cleanText(r.tempo, 80),
      mood: deps.cleanText(r.mood, 120),
      instruments: deps.cleanText(r.instruments, 160),
      lyricsContent: deps.cleanText(r.lyricsContent, 400),
    };
    if (song.title) songs.push(song);
  }
  return songs;
}

// 저장용: 가사 원문은 빼고 곡 정보와 음악적 특징만 남김
function songsForStorage(songs: SongInput[]) {
  return songs.map(({ lyrics: _lyrics, ...rest }) => rest);
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function mapActivityRow(row: ActivityRow) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    classGroup: row.class_group,
    songs: safeJsonParse(row.songs_json, [] as unknown[]),
    hypothesis: row.hypothesis,
    criterion: row.criterion,
    aiResult: safeJsonParse(row.ai_result_json, null as unknown),
    judgments: safeJsonParse(row.judgments_json, {} as Record<string, string>),
    comparisonText: row.comparison_text,
    reconstructionText: row.reconstruction_text,
    evidenceText: row.evidence_text,
    ethicsText: row.ethics_text,
    rubricLevel: row.rubric_level,
    teacherFeedback: row.teacher_feedback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------- 결과 정리 ----------

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '';
}

function arr(v: unknown, max: number): Record<string, unknown>[] {
  return Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)).slice(0, max)
    : [];
}

export function normalizeAiResult(criterion: Criterion, obj: Record<string, unknown>) {
  const meta = {
    source: obj.source === 'self' ? ('self' as const) : ('ai' as const),
    tool: str(obj.tool, 40),
    rawText: obj.source === 'self' ? '' : str(obj.rawText, 4000),
  };
  if (criterion === 'lyrics') {
    const emotionWords = arr(obj.emotionWords, 8)
      .map((e) => ({
        word: str(e.word, 30),
        count: typeof e.count === 'number' && Number.isFinite(e.count) ? Math.max(0, Math.round(e.count)) : Number(str(e.count, 4)) || 0,
        example: str(e.example, 80),
      }))
      .filter((e) => e.word);
    const themeKeywords = arr(obj.themeKeywords, 5)
      .map((k) => ({ keyword: str(k.keyword, 30), reason: str(k.reason, 200) }))
      .filter((k) => k.keyword);
    if (emotionWords.length === 0 && themeKeywords.length === 0) return null;
    return { kind: 'lyrics' as const, emotionWords, themeKeywords, summary: str(obj.summary, 400), limits: str(obj.limits, 300), ...meta };
  }
  const types = arr(obj.types, 4)
    .map((t) => ({ name: str(t.name, 40), desire: str(t.desire, 200), worry: str(t.worry, 200), evidence: str(t.evidence, 300) }))
    .filter((t) => t.name);
  if (types.length === 0) return null;
  return { kind: 'music' as const, types, summary: str(obj.summary, 400), limits: str(obj.limits, 300), ...meta };
}

// ---------- 라우터 ----------

export async function handleAiRoutes(
  request: Request,
  env: AiEnv,
  url: URL,
  deps: AiDeps,
): Promise<Response | null> {
  const { pathname } = url;
  if (!pathname.startsWith('/api/ai/')) return null;

  const { jsonResponse, cleanText, parseJsonBody } = deps;
  await ensureTables(env.DB);

  // 학생 활동 저장(새로 만들기 / 내 글 수정)
  if (pathname === '/api/ai/activities' && request.method === 'POST') {
    const body = await parseJsonBody(request);
    if (!body) return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);

    const studentId = cleanText(body.studentId, 20);
    const studentName = cleanText(body.studentName, 30);
    const classGroup = cleanText(body.classGroup, 40);
    const criterion: Criterion | '' = body.criterion === 'lyrics' || body.criterion === 'music' ? body.criterion : '';
    const hypothesis = cleanText(body.hypothesis, 300);
    const songs = songsForStorage(parseSongs(body.songs, deps, criterion));
    const aiResultObj =
      criterion && body.aiResult && typeof body.aiResult === 'object' && !Array.isArray(body.aiResult)
        ? normalizeAiResult(criterion, body.aiResult as Record<string, unknown>)
        : null;

    const judgments: Record<string, string> = {};
    if (body.judgments && typeof body.judgments === 'object' && !Array.isArray(body.judgments)) {
      for (const [k, v] of Object.entries(body.judgments as Record<string, unknown>).slice(0, 20)) {
        if (/^[a-z]+-\d{1,2}$/.test(k) && (v === 'agree' || v === 'partly' || v === 'disagree')) judgments[k] = v;
      }
    }
    const comparisonText = cleanText(body.comparisonText, 1500);
    const reconstructionText = cleanText(body.reconstructionText, 1500);
    const evidenceText = cleanText(body.evidenceText, 800);
    const ethicsText = cleanText(body.ethicsText, 800);

    if (!studentId || !studentName) return jsonResponse({ error: '학번과 별칭을 입력해 주세요.' }, 400);
    if (!hypothesis) return jsonResponse({ error: '나의 가설 한 줄을 입력해 주세요.' }, 400);
    if (!criterion || songs.length === 0) return jsonResponse({ error: '곡과 분석 기준을 입력해 주세요.' }, 400);
    if (!aiResultObj) return jsonResponse({ error: '3단계에서 분석 결과(감정 단어·키워드 또는 유형)를 먼저 정리해 주세요.' }, 400);
    if (!comparisonText || !reconstructionText) {
      return jsonResponse({ error: 'AI 결과와 내 느낌 비교, 나만의 언어로 재구성하기를 모두 적어 주세요.' }, 400);
    }

    const now = new Date().toISOString();
    const values = [
      studentId,
      studentName,
      classGroup,
      JSON.stringify(songs),
      hypothesis,
      criterion,
      JSON.stringify(aiResultObj),
      JSON.stringify(judgments),
      comparisonText,
      reconstructionText,
      evidenceText,
      ethicsText,
    ];

    const existingId = cleanText(body.id, 64);
    const editToken = cleanText(body.editToken, 128);
    if (existingId) {
      const existing = await env.DB.prepare('SELECT id, edit_token FROM ai_activities WHERE id = ?')
        .bind(existingId)
        .first<{ id: string; edit_token: string }>();
      if (!existing || !editToken || !(await deps.timingSafeEqualStrings(editToken, existing.edit_token))) {
        return jsonResponse({ error: '본인 활동을 수정할 권한이 없습니다.' }, 403);
      }
      await env.DB.prepare(
        'UPDATE ai_activities SET student_id = ?, student_name = ?, class_group = ?, songs_json = ?, hypothesis = ?, criterion = ?, ai_result_json = ?, judgments_json = ?, comparison_text = ?, reconstruction_text = ?, evidence_text = ?, ethics_text = ?, updated_at = ? WHERE id = ?',
      )
        .bind(...values, now, existingId)
        .run();
      const row = await env.DB.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM ai_activities WHERE id = ?`)
        .bind(existingId)
        .first<ActivityRow>();
      return jsonResponse({ activity: row ? mapActivityRow(row) : null, editToken });
    }

    const id = crypto.randomUUID();
    const newToken = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO ai_activities (id, student_id, student_name, class_group, songs_json, hypothesis, criterion, ai_result_json, judgments_json, comparison_text, reconstruction_text, evidence_text, ethics_text, rubric_level, teacher_feedback, edit_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?)",
    )
      .bind(id, ...values, newToken, now, now)
      .run();
    const row = await env.DB.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM ai_activities WHERE id = ?`).bind(id).first<ActivityRow>();
    return jsonResponse({ activity: row ? mapActivityRow(row) : null, editToken: newToken }, 201);
  }

  // 학생: 내 활동 불러오기(id + 토큰)
  if (pathname === '/api/ai/my-activity' && request.method === 'GET') {
    const id = url.searchParams.get('id')?.trim() ?? '';
    const token = url.searchParams.get('token')?.trim() ?? '';
    if (!id || !token || id.length > 64 || token.length > 128) {
      return jsonResponse({ error: '유효하지 않은 조회 요청입니다.' }, 400);
    }
    const row = await env.DB.prepare(`SELECT ${ACTIVITY_COLUMNS}, edit_token FROM ai_activities WHERE id = ?`)
      .bind(id)
      .first<ActivityRow>();
    if (!row || !row.edit_token || !(await deps.timingSafeEqualStrings(token, row.edit_token))) {
      return jsonResponse({ error: '활동을 찾을 수 없거나 접근 권한이 없습니다.' }, 404);
    }
    return jsonResponse(mapActivityRow(row));
  }

  // ----- 교사 전용 -----
  if (pathname.startsWith('/api/ai/teacher/')) {
    if (!(await deps.isTeacherAuthenticated(request))) {
      return jsonResponse({ error: '교사 인증이 필요합니다.' }, 401);
    }

    if (pathname === '/api/ai/teacher/activities' && request.method === 'GET') {
      const res = await env.DB.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM ai_activities ORDER BY updated_at DESC LIMIT 500`).all<ActivityRow>();
      return jsonResponse((res.results ?? []).map(mapActivityRow));
    }

    if (pathname.startsWith('/api/ai/teacher/activities/')) {
      const id = pathname.slice('/api/ai/teacher/activities/'.length).trim();
      if (!id || id.length > 64) return jsonResponse({ error: '잘못된 활동 ID입니다.' }, 400);

      if (request.method === 'PATCH') {
        const body = await parseJsonBody(request);
        const level = body?.rubricLevel;
        if (!(level === '' || level === '상' || level === '중' || level === '하')) {
          return jsonResponse({ error: '유효하지 않은 평가 단계입니다.' }, 400);
        }
        const feedback = cleanText(body?.teacherFeedback, 500);
        await env.DB.prepare('UPDATE ai_activities SET rubric_level = ?, teacher_feedback = ?, updated_at = ? WHERE id = ?')
          .bind(level, feedback, new Date().toISOString(), id)
          .run();
        const row = await env.DB.prepare(`SELECT ${ACTIVITY_COLUMNS} FROM ai_activities WHERE id = ?`).bind(id).first<ActivityRow>();
        if (!row) return jsonResponse({ error: '해당 활동을 찾을 수 없습니다.' }, 404);
        return jsonResponse(mapActivityRow(row));
      }

      if (request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM ai_activities WHERE id = ?').bind(id).run();
        return new Response(null, { status: 204 });
      }
    }
  }

  return jsonResponse({ error: '요청한 API 경로를 찾을 수 없습니다.' }, 404);
}
