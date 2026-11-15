// 4단계(7~8차시) 또래 음악 H-A-H 활동 API
// H 학생이 먼저 가설 → A 기준 선택 후 AI 분석 → H 학생이 비교·판단·재구성
// - 가사 원문은 AI 분석에만 쓰고 DB에 저장하지 않습니다(저작권).
// - 학생 이름·학번은 AI에 보내지 않습니다(개인정보).
// - 교사가 AI 분석을 열어야(ai_enabled=1) 학생이 분석을 요청할 수 있습니다.

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[]; success: boolean }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface WorkersAI {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface AiEnv {
  DB: D1Database;
  AI?: WorkersAI;
  AI_MODEL?: string;
}

export interface AiDeps {
  jsonResponse(body: unknown, status?: number): Response;
  cleanText(raw: unknown, maxLen: number): string;
  parseJsonBody(request: Request): Promise<Record<string, unknown> | null>;
  isTeacherAuthenticated(request: Request): Promise<boolean>;
  timingSafeEqualStrings(a: string, b: string): Promise<boolean>;
}

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const HOURLY_LIMIT = 300;
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
      'CREATE TABLE IF NOT EXISTS ai_settings (id INTEGER PRIMARY KEY CHECK (id = 1), ai_enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)',
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS ai_activities (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, student_name TEXT NOT NULL, class_group TEXT NOT NULL DEFAULT '', songs_json TEXT NOT NULL DEFAULT '[]', hypothesis TEXT NOT NULL DEFAULT '', criterion TEXT NOT NULL DEFAULT '', ai_result_json TEXT NOT NULL DEFAULT '', judgments_json TEXT NOT NULL DEFAULT '{}', comparison_text TEXT NOT NULL DEFAULT '', reconstruction_text TEXT NOT NULL DEFAULT '', evidence_text TEXT NOT NULL DEFAULT '', ethics_text TEXT NOT NULL DEFAULT '', rubric_level TEXT NOT NULL DEFAULT '', teacher_feedback TEXT NOT NULL DEFAULT '', edit_token TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
    )
    .run();
  await db
    .prepare('CREATE INDEX IF NOT EXISTS idx_ai_activities_updated ON ai_activities (updated_at DESC)')
    .run();
  await db.prepare('CREATE TABLE IF NOT EXISTS ai_usage (called_at TEXT NOT NULL)').run();
  tablesReady = true;
}

async function isAiEnabled(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT ai_enabled FROM ai_settings WHERE id = 1').first<{ ai_enabled: number }>();
  return row?.ai_enabled === 1;
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

// ---------- AI 프롬프트와 결과 정리 ----------

const SYSTEM_PROMPT =
  '너는 중학교 2학년 음악 수업의 분석 도우미야. 학생이 고른 또래 음악을 분석하지만, 정답을 정해 주지 않고 학생이 스스로 비교·판단할 재료를 준다. ' +
  '반드시 한국어로, 중학생이 이해할 수 있는 쉬운 말로 쓴다. 근거 없이 단정하지 말고, 주어진 정보에 없는 사실(가수의 사생활, 곡의 숨은 사연 등)을 지어내지 않는다. ' +
  '출력은 지정된 JSON 하나만 쓴다. 설명 문장이나 코드 블록 표시는 쓰지 않는다.';

function buildUserPrompt(criterion: Criterion, songs: SongInput[], hypothesis: string): string {
  const songText = songs
    .map((s, i) => {
      const head = `[곡 ${i + 1}] ${s.title}${s.artist ? ` - ${s.artist}` : ''}`;
      if (criterion === 'lyrics') {
        return `${head}\n가사:\n${s.lyrics || '(가사 없음)'}`;
      }
      return [
        head,
        `템포(빠르기): ${s.tempo || '(입력 없음)'}`,
        `분위기: ${s.mood || '(입력 없음)'}`,
        `악기 구성: ${s.instruments || '(입력 없음)'}`,
        `가사 내용(학생 요약): ${s.lyricsContent || '(입력 없음)'}`,
      ].join('\n');
    })
    .join('\n\n');

  const hypothesisLine = `참고: 학생이 분석 전에 세운 가설은 "${hypothesis}" 이다. 이 가설에 맞추려 하지 말고 자료에 근거해 분석한다.`;

  if (criterion === 'lyrics') {
    return `${songText}\n\n${hypothesisLine}\n\n위 가사를 분석해서 다음 JSON 형식으로만 답해.\n` +
      '{"emotionWords":[{"word":"감정 단어","count":가사에 나온 대략적 횟수(숫자),"example":"그 감정이 드러난 짧은 구절(10자 안팎)"}],' +
      '"themeKeywords":[{"keyword":"핵심 주제 키워드","reason":"왜 이 키워드인지 한 문장"}],' +
      '"summary":"가사에서 드러나는 오늘날 또래의 마음을 2문장으로",' +
      '"limits":"이 분석이 놓쳤을 수 있는 점을 한 문장으로"}\n' +
      '감정 단어는 자주 나오는 것부터 4~8개, 핵심 주제 키워드는 3~5개로 한다.';
  }
  return `${songText}\n\n${hypothesisLine}\n\n위 곡들의 템포, 분위기, 악기 구성, 가사 내용을 바탕으로 오늘날 세대가 공유하는 욕망과 고민의 유형을 3~4가지로 분류해서 다음 JSON 형식으로만 답해.\n` +
    '{"types":[{"name":"유형 이름(짧게)","desire":"이 유형이 바라는 것(욕망) 한 문장","worry":"이 유형의 고민 한 문장","evidence":"근거가 된 음악적 특징이나 가사 내용(곡 이름 포함)"}],' +
    '"summary":"분류 결과를 2문장으로",' +
    '"limits":"이 분류가 놓쳤을 수 있는 점을 한 문장으로"}';
}

function extractJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '';
}

function arr(v: unknown, max: number): Record<string, unknown>[] {
  return Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)).slice(0, max)
    : [];
}

export function normalizeAiResult(criterion: Criterion, obj: Record<string, unknown>) {
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
    return { kind: 'lyrics' as const, emotionWords, themeKeywords, summary: str(obj.summary, 400), limits: str(obj.limits, 300) };
  }
  const types = arr(obj.types, 4)
    .map((t) => ({ name: str(t.name, 40), desire: str(t.desire, 200), worry: str(t.worry, 200), evidence: str(t.evidence, 300) }))
    .filter((t) => t.name);
  if (types.length === 0) return null;
  return { kind: 'music' as const, types, summary: str(obj.summary, 400), limits: str(obj.limits, 300) };
}

async function callModel(env: AiEnv, criterion: Criterion, songs: SongInput[], hypothesis: string) {
  const ai = env.AI!;
  const model = env.AI_MODEL?.trim() || DEFAULT_MODEL;
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(criterion, songs, hypothesis) },
  ];

  const attempts: Record<string, unknown>[] = [
    { messages, max_tokens: 1400, temperature: 0.3, response_format: { type: 'json_object' } },
    { messages, max_tokens: 1400, temperature: 0.3 },
  ];

  for (const inputs of attempts) {
    try {
      const out = (await ai.run(model, inputs)) as { response?: unknown } | string;
      const raw = typeof out === 'string' ? out : out?.response;
      const obj = extractJsonObject(raw);
      const normalized = obj ? normalizeAiResult(criterion, obj) : null;
      if (normalized) return normalized;
    } catch {
      // 다음 방식으로 다시 시도
    }
  }
  return null;
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

  // 학생 화면: AI 분석 열림 여부
  if (pathname === '/api/ai/status' && request.method === 'GET') {
    return jsonResponse({ enabled: await isAiEnabled(env.DB), aiConnected: Boolean(env.AI) });
  }

  // A: AI 분석 요청
  if (pathname === '/api/ai/analyze' && request.method === 'POST') {
    if (!env.AI) {
      return jsonResponse({ error: 'AI 기능(Workers AI)이 아직 연결되지 않았습니다. 선생님께 알려 주세요.' }, 503);
    }
    if (!(await isAiEnabled(env.DB))) {
      return jsonResponse({ error: '선생님이 AI 분석을 아직 열지 않았어요. 수업 시간에 다시 시도해 주세요.' }, 403);
    }
    const body = await parseJsonBody(request);
    if (!body) return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);

    const criterion: Criterion | '' = body.criterion === 'lyrics' || body.criterion === 'music' ? body.criterion : '';
    if (!criterion) return jsonResponse({ error: '분석 기준(가사 / 음악적 특징)을 먼저 골라 주세요.' }, 400);

    const hypothesis = cleanText(body.hypothesis, 300);
    if (!hypothesis) return jsonResponse({ error: 'AI에게 묻기 전에 나의 가설 한 줄을 먼저 적어 주세요.' }, 400);

    const songs = parseSongs(body.songs, deps, criterion);
    if (songs.length === 0) return jsonResponse({ error: '곡 제목을 1곡 이상 입력해 주세요.' }, 400);
    if (criterion === 'lyrics' && songs.some((s) => !s.lyrics)) {
      return jsonResponse({ error: '가사로 분석하려면 각 곡의 가사를 붙여 넣어 주세요.' }, 400);
    }
    if (criterion === 'music' && songs.some((s) => !s.tempo && !s.mood && !s.instruments && !s.lyricsContent)) {
      return jsonResponse({ error: '각 곡의 템포, 분위기, 악기 구성, 가사 내용 중 하나 이상을 적어 주세요.' }, 400);
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const usage = await env.DB.prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE called_at > ?').bind(since).first<{ n: number }>();
    if ((usage?.n ?? 0) >= HOURLY_LIMIT) {
      return jsonResponse({ error: '지금은 AI 요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.' }, 429);
    }
    await env.DB.prepare('INSERT INTO ai_usage (called_at) VALUES (?)').bind(new Date().toISOString()).run();
    await env.DB.prepare('DELETE FROM ai_usage WHERE called_at < ?')
      .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .run();

    const result = await callModel(env, criterion, songs, hypothesis);
    if (!result) {
      return jsonResponse({ error: 'AI가 분석 결과를 만들지 못했어요. 입력을 조금 바꾸거나 다시 시도해 주세요.' }, 502);
    }
    return jsonResponse({ result });
  }

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
    if (!aiResultObj) return jsonResponse({ error: 'AI 분석 결과가 없어요. 3단계에서 분석을 먼저 받아 주세요.' }, 400);
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

    if (pathname === '/api/ai/teacher/settings' && request.method === 'PUT') {
      const body = await parseJsonBody(request);
      const enabled = body?.enabled === true ? 1 : 0;
      await env.DB.prepare(
        'INSERT INTO ai_settings (id, ai_enabled, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET ai_enabled = excluded.ai_enabled, updated_at = excluded.updated_at',
      )
        .bind(enabled, new Date().toISOString())
        .run();
      return jsonResponse({ enabled: enabled === 1, aiConnected: Boolean(env.AI) });
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
