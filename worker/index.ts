interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TEACHER_PASSWORD?: string;
}

interface LessonRow {
  id: number;
  era_title: string;
  song_title: string;
  audio_or_link_url: string;
  historical_context: string;
  artwork_note: string;
  empathy_prompt: string;
  share_with_class: number;
  is_customized: number;
  updated_at: string;
}

interface ArtworkRow {
  slot_index: number;
  title: string;
  image_url: string;
  description: string;
}

interface ArtworkInput {
  slotIndex: number;
  title: string;
  imageUrl: string;
  description: string;
}

interface ResponseRow {
  id: string;
  student_id: string;
  student_name: string;
  class_group: string;
  reflection_text: string;
  present_connection: string;
  is_public: number;
  rubric_level: string;
  teacher_feedback: string;
  edit_token?: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_LESSON = {
  eraTitle: '[확인 필요] 탐구할 시대를 입력해 주세요',
  songTitle: '[확인 필요] 감상할 시대별 대표곡 제목과 작곡가를 입력해 주세요',
  audioOrLinkUrl: '',
  historicalContext:
    '[확인 필요] 탐구할 시대의 역사적 배경과 당시 사람들의 삶의 상황을 입력해 주세요. (수업설계안 원문에는 구체적인 시대와 곡명이 명시되어 있지 않습니다.)',
  artworkNote: '[확인 필요] 함께 살펴볼 대표 미술작품이나 시각 자료 안내를 입력해 주세요.',
  artworks: [] as ArtworkInput[],
  empathyPrompt:
    '당시 시대 상황에 자신을 대입하여 음악을 감상하고, 그 시대 사람들의 마음과 욕망에 공감하며 느낀 개인의 감성을 문장으로 표현해 봅시다.',
  shareWithClass: true,
  isCustomized: false,
  updatedAt: new Date(0).toISOString(),
};

const COOKIE_NAME = 'teacher_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(extraHeaders ?? {}),
    },
  });
}

function cleanText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

function sanitizeHttpUrl(raw: unknown): { valid: boolean; value: string } {
  if (typeof raw !== 'string') return { valid: true, value: '' };
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: '' };
  if (trimmed.length > 500) return { valid: false, value: '' };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { valid: true, value: parsed.toString() };
    }
    return { valid: false, value: '' };
  } catch {
    return { valid: false, value: '' };
  }
}

function sanitizeArtworkImageUrl(raw: unknown): { valid: boolean; value: string } {
  if (typeof raw !== 'string') return { valid: true, value: '' };
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: '' };
  if (trimmed.length > 1000) return { valid: false, value: '' };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { valid: true, value: parsed.toString() };
    }
    return { valid: false, value: '' };
  } catch {
    return { valid: false, value: '' };
  }
}

async function ensureLessonArtworksTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS lesson_artworks (slot_index INTEGER PRIMARY KEY CHECK (slot_index >= 0 AND slot_index <= 3), title TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)",
    )
    .run();
}

async function readLessonArtworks(db: D1Database): Promise<ArtworkInput[]> {
  try {
    const res = await db
      .prepare('SELECT slot_index, title, image_url, description FROM lesson_artworks ORDER BY slot_index ASC')
      .all<ArtworkRow>();
    return (res.results ?? []).map((row) => ({
      slotIndex: row.slot_index,
      title: row.title,
      imageUrl: row.image_url,
      description: row.description,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('no such table')) {
      await ensureLessonArtworksTable(db);
      return [];
    }
    throw err;
  }
}

function mapLessonRow(row: LessonRow, artworks: ArtworkInput[]) {
  return {
    eraTitle: row.era_title,
    songTitle: row.song_title,
    audioOrLinkUrl: row.audio_or_link_url,
    historicalContext: row.historical_context,
    artworkNote: row.artwork_note,
    artworks,
    empathyPrompt: row.empathy_prompt,
    shareWithClass: row.share_with_class === 1,
    isCustomized: row.is_customized === 1,
    updatedAt: row.updated_at,
  };
}

function mapTeacherResponseRow(row: ResponseRow) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    classGroup: row.class_group,
    reflectionText: row.reflection_text,
    presentConnection: row.present_connection,
    isPublic: row.is_public === 1,
    rubricLevel: row.rubric_level,
    teacherFeedback: row.teacher_feedback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicResponseRow(row: ResponseRow) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    classGroup: row.class_group,
    reflectionText: row.reflection_text,
    presentConnection: row.present_connection,
    isPublic: true,
    rubricLevel: '',
    teacherFeedback: '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  return timingSafeEqualBytes(hashA, hashB);
}

async function deriveHmacKey(secret: string): Promise<CryptoKey> {
  const data = new TextEncoder().encode(`classroom-teacher-session-v1:${secret}`);
  const keyMaterial = await crypto.subtle.digest('SHA-256', data);
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  const key = await deriveHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${toHex(sig)}`;
}

async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sigHex] = parts;
  if (!/^\d+$/.test(payload) || !/^[0-9a-f]{64}$/i.test(sigHex)) return false;
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const key = await deriveHmacKey(secret);
  const expectedSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expectedHex = toHex(expectedSig);
  return timingSafeEqualStrings(sigHex.toLowerCase(), expectedHex);
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function buildCookieHeader(value: string, maxAge: number, isHttps: boolean): string {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) {
    attrs.push('Secure');
  }
  return attrs.join('; ');
}

async function isTeacherAuthenticated(request: Request, env: Env): Promise<boolean> {
  const secret = env.TEACHER_PASSWORD?.trim();
  if (!secret) return false;
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  return verifySessionToken(token, secret);
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    if (!env.DB) {
      return jsonResponse({ error: 'D1 데이터베이스 바인딩(DB)이 연결되지 않았습니다.' }, 503);
    }

    const isHttps = url.protocol === 'https:';

    try {
      // Health check verifies D1 connection and required tables exist
      if (pathname === '/api/health' && request.method === 'GET') {
        await env.DB.prepare('SELECT 1 AS ok').first();
        await env.DB.prepare('SELECT id FROM lesson_settings LIMIT 1').first();
        await env.DB.prepare('SELECT id FROM student_responses LIMIT 1').first();
        return jsonResponse({ ok: true, dbConnected: true });
      }

      // Teacher authentication endpoints
      if (pathname === '/api/teacher/session' && request.method === 'GET') {
        const passwordConfigured = Boolean(env.TEACHER_PASSWORD && env.TEACHER_PASSWORD.trim().length > 0);
        const authenticated = passwordConfigured ? await isTeacherAuthenticated(request, env) : false;
        return jsonResponse({ authenticated, passwordConfigured });
      }

      if (pathname === '/api/teacher/login' && request.method === 'POST') {
        const secret = env.TEACHER_PASSWORD?.trim();
        if (!secret) {
          return jsonResponse(
            { error: '교사 비밀번호(TEACHER_PASSWORD)가 서버 Secret에 설정되지 않았습니다.' },
            503,
          );
        }
        const body = await parseJsonBody(request);
        const submittedPassword = typeof body?.password === 'string' ? body.password : '';
        if (!submittedPassword || submittedPassword.length > 200) {
          return jsonResponse({ error: '비밀번호를 입력해 주세요.' }, 400);
        }
        const matched = await timingSafeEqualStrings(submittedPassword, secret);
        if (!matched) {
          return jsonResponse({ error: '교사 비밀번호가 올바르지 않습니다.' }, 401);
        }
        const token = await createSessionToken(secret);
        return jsonResponse(
          { authenticated: true },
          200,
          { 'Set-Cookie': buildCookieHeader(token, Math.floor(SESSION_TTL_MS / 1000), isHttps) },
        );
      }

      if (pathname === '/api/teacher/logout' && request.method === 'POST') {
        return jsonResponse(
          { authenticated: false },
          200,
          { 'Set-Cookie': buildCookieHeader('', 0, isHttps) },
        );
      }

      // Lesson configuration (public read, teacher-only write)
      if (pathname === '/api/lesson' && request.method === 'GET') {
        const [row, artworks] = await Promise.all([
          env.DB.prepare(
            'SELECT id, era_title, song_title, audio_or_link_url, historical_context, artwork_note, empathy_prompt, share_with_class, is_customized, updated_at FROM lesson_settings WHERE id = 1',
          ).first<LessonRow>(),
          readLessonArtworks(env.DB),
        ]);
        return jsonResponse(row ? mapLessonRow(row, artworks) : { ...DEFAULT_LESSON, artworks });
      }

      if (pathname === '/api/lesson' && request.method === 'PUT') {
        if (!(await isTeacherAuthenticated(request, env))) {
          return jsonResponse({ error: '교사 인증이 필요합니다.' }, 401);
        }
        const body = await parseJsonBody(request);
        if (!body) {
          return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);
        }

        const eraTitle = cleanText(body.eraTitle, 120);
        const songTitle = cleanText(body.songTitle, 160);
        const urlCheck = sanitizeHttpUrl(body.audioOrLinkUrl);
        const historicalContext = cleanText(body.historicalContext, 2000);
        const artworkNote = cleanText(body.artworkNote, 600);
        const empathyPrompt = cleanText(body.empathyPrompt, 600);
        const shareWithClass = body.shareWithClass === true ? 1 : 0;

        if (!eraTitle || !songTitle || !historicalContext || !empathyPrompt) {
          return jsonResponse({ error: '필수 수업 안내 항목을 모두 입력해 주세요.' }, 400);
        }
        if (!urlCheck.valid) {
          return jsonResponse({ error: '링크는 http:// 또는 https:// 주소만 입력할 수 있습니다.' }, 400);
        }

        const rawArtworks = Array.isArray(body.artworks) ? body.artworks : [];
        const sanitizedArtworks: ArtworkInput[] = [];
        const usedSlots = new Set<number>();

        for (let i = 0; i < Math.min(rawArtworks.length, 4); i++) {
          const item = rawArtworks[i];
          if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
          const record = item as Record<string, unknown>;
          const slotIndex =
            typeof record.slotIndex === 'number' &&
            Number.isInteger(record.slotIndex) &&
            record.slotIndex >= 0 &&
            record.slotIndex <= 3
              ? record.slotIndex
              : i;
          if (usedSlots.has(slotIndex)) continue;
          usedSlots.add(slotIndex);

          const title = cleanText(record.title, 120);
          const description = cleanText(record.description, 1200);
          const imageCheck = sanitizeArtworkImageUrl(record.imageUrl);
          if (!imageCheck.valid) {
            return jsonResponse(
              { error: `시각 자료 ${slotIndex + 1}의 이미지 형식이 올바르지 않거나 용량이 너무 큽니다.` },
              400,
            );
          }

          if (title || imageCheck.value || description) {
            sanitizedArtworks.push({
              slotIndex,
              title,
              imageUrl: imageCheck.value,
              description,
            });
          }
        }

        const now = new Date().toISOString();
        await ensureLessonArtworksTable(env.DB);
        await env.DB.prepare(
          'INSERT INTO lesson_settings (id, era_title, song_title, audio_or_link_url, historical_context, artwork_note, empathy_prompt, share_with_class, is_customized, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO UPDATE SET era_title = excluded.era_title, song_title = excluded.song_title, audio_or_link_url = excluded.audio_or_link_url, historical_context = excluded.historical_context, artwork_note = excluded.artwork_note, empathy_prompt = excluded.empathy_prompt, share_with_class = excluded.share_with_class, is_customized = 1, updated_at = excluded.updated_at',
        )
          .bind(
            eraTitle,
            songTitle,
            urlCheck.value,
            historicalContext,
            artworkNote,
            empathyPrompt,
            shareWithClass,
            now,
          )
          .run();

        await env.DB.prepare('DELETE FROM lesson_artworks').run();
        for (const art of sanitizedArtworks) {
          await env.DB.prepare(
            'INSERT INTO lesson_artworks (slot_index, title, image_url, description, updated_at) VALUES (?, ?, ?, ?, ?)',
          )
            .bind(art.slotIndex, art.title, art.imageUrl, art.description, now)
            .run();
        }

        const [updated, savedArtworks] = await Promise.all([
          env.DB.prepare(
            'SELECT id, era_title, song_title, audio_or_link_url, historical_context, artwork_note, empathy_prompt, share_with_class, is_customized, updated_at FROM lesson_settings WHERE id = 1',
          ).first<LessonRow>(),
          readLessonArtworks(env.DB),
        ]);

        return jsonResponse(updated ? mapLessonRow(updated, savedArtworks) : { ...DEFAULT_LESSON, artworks: savedArtworks });
      }

      // Public shared gallery (only when share_with_class=1 AND response is_public=1)
      if (pathname === '/api/public-responses' && request.method === 'GET') {
        const lessonRow = await env.DB.prepare(
          'SELECT share_with_class FROM lesson_settings WHERE id = 1',
        ).first<{ share_with_class: number }>();

        const sharingEnabled = lessonRow ? lessonRow.share_with_class === 1 : DEFAULT_LESSON.shareWithClass;
        if (!sharingEnabled) {
          return jsonResponse([]);
        }

        const result = await env.DB.prepare(
          'SELECT id, student_id, student_name, class_group, reflection_text, present_connection, is_public, created_at, updated_at FROM student_responses WHERE is_public = 1 ORDER BY updated_at DESC LIMIT 200',
        ).all<ResponseRow>();

        return jsonResponse((result.results ?? []).map(mapPublicResponseRow));
      }

      // Student own submission lookup (requires matching id + editToken)
      if (pathname === '/api/my-response' && request.method === 'GET') {
        const id = url.searchParams.get('id')?.trim() ?? '';
        const token = url.searchParams.get('token')?.trim() ?? '';
        if (!id || !token || id.length > 64 || token.length > 128) {
          return jsonResponse({ error: '유효하지 않은 조회 요청입니다.' }, 400);
        }

        const row = await env.DB.prepare(
          'SELECT id, student_id, student_name, class_group, reflection_text, present_connection, is_public, rubric_level, teacher_feedback, edit_token, created_at, updated_at FROM student_responses WHERE id = ?',
        )
          .bind(id)
          .first<ResponseRow>();

        if (!row || !row.edit_token || !(await timingSafeEqualStrings(token, row.edit_token))) {
          return jsonResponse({ error: '응답을 찾을 수 없거나 접근 권한이 없습니다.' }, 404);
        }

        return jsonResponse(mapTeacherResponseRow(row));
      }

      // Create new student response
      if (pathname === '/api/responses' && request.method === 'POST') {
        const body = await parseJsonBody(request);
        if (!body) {
          return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);
        }

        const studentId = cleanText(body.studentId, 20);
        const studentName = cleanText(body.studentName, 30);
        const classGroup = cleanText(body.classGroup, 40);
        const reflectionText = cleanText(body.reflectionText, 2000);
        const presentConnection = cleanText(body.presentConnection, 1000);
        const isPublic = body.isPublic === true ? 1 : 0;

        if (!studentId) {
          return jsonResponse({ error: '학번을 입력해 주세요.' }, 400);
        }
        if (!studentName) {
          return jsonResponse({ error: '이름(별칭)을 입력해 주세요.' }, 400);
        }
        if (!reflectionText) {
          return jsonResponse({ error: '시대 상황에 대입한 감성 문장을 입력해 주세요.' }, 400);
        }

        const id = crypto.randomUUID();
        const editToken = crypto.randomUUID();
        const now = new Date().toISOString();

        await env.DB.prepare(
          'INSERT INTO student_responses (id, student_id, student_name, class_group, reflection_text, present_connection, is_public, rubric_level, teacher_feedback, edit_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
          .bind(
            id,
            studentId,
            studentName,
            classGroup,
            reflectionText,
            presentConnection,
            isPublic,
            '',
            '',
            editToken,
            now,
            now,
          )
          .run();

        const created = await env.DB.prepare(
          'SELECT id, student_id, student_name, class_group, reflection_text, present_connection, is_public, rubric_level, teacher_feedback, created_at, updated_at FROM student_responses WHERE id = ?',
        )
          .bind(id)
          .first<ResponseRow>();

        if (!created) {
          return jsonResponse({ error: '저장 결과를 확인하지 못했습니다.' }, 500);
        }

        return jsonResponse({ response: mapTeacherResponseRow(created), editToken }, 201);
      }

      // Update student's own response (requires matching editToken)
      if (pathname.startsWith('/api/my-response/') && request.method === 'PATCH') {
        const id = pathname.slice('/api/my-response/'.length).trim();
        if (!id || id.length > 64) {
          return jsonResponse({ error: '잘못된 응답 ID입니다.' }, 400);
        }
        const body = await parseJsonBody(request);
        if (!body) {
          return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);
        }
        const editToken = typeof body.editToken === 'string' ? body.editToken.trim() : '';
        if (!editToken) {
          return jsonResponse({ error: '수정 권한 토큰이 필요합니다.' }, 401);
        }

        const existing = await env.DB.prepare(
          'SELECT id, edit_token FROM student_responses WHERE id = ?',
        )
          .bind(id)
          .first<{ id: string; edit_token: string }>();

        if (!existing || !(await timingSafeEqualStrings(editToken, existing.edit_token))) {
          return jsonResponse({ error: '본인 글을 수정할 권한이 없습니다.' }, 403);
        }

        const studentId = cleanText(body.studentId, 20);
        const studentName = cleanText(body.studentName, 30);
        const classGroup = cleanText(body.classGroup, 40);
        const reflectionText = cleanText(body.reflectionText, 2000);
        const presentConnection = cleanText(body.presentConnection, 1000);
        const isPublic = body.isPublic === true ? 1 : 0;

        if (!studentId || !studentName || !reflectionText) {
          return jsonResponse({ error: '학번, 이름(별칭), 감성 문장은 필수 입력 항목입니다.' }, 400);
        }

        const now = new Date().toISOString();
        await env.DB.prepare(
          'UPDATE student_responses SET student_id = ?, student_name = ?, class_group = ?, reflection_text = ?, present_connection = ?, is_public = ?, updated_at = ? WHERE id = ?',
        )
          .bind(studentId, studentName, classGroup, reflectionText, presentConnection, isPublic, now, id)
          .run();

        const updated = await env.DB.prepare(
          'SELECT id, student_id, student_name, class_group, reflection_text, present_connection, is_public, rubric_level, teacher_feedback, created_at, updated_at FROM student_responses WHERE id = ?',
        )
          .bind(id)
          .first<ResponseRow>();

        return jsonResponse(updated ? mapTeacherResponseRow(updated) : null);
      }

      // Teacher-only: list all responses (including private ones)
      if (pathname === '/api/responses' && request.method === 'GET') {
        if (!(await isTeacherAuthenticated(request, env))) {
          return jsonResponse({ error: '교사 인증이 필요합니다.' }, 401);
        }

        const result = await env.DB.prepare(
          'SELECT id, student_id, student_name, class_group, reflection_text, present_connection, is_public, rubric_level, teacher_feedback, created_at, updated_at FROM student_responses ORDER BY updated_at DESC LIMIT 500',
        ).all<ResponseRow>();

        return jsonResponse((result.results ?? []).map(mapTeacherResponseRow));
      }

      // Teacher-only: evaluate rubric & feedback or delete response
      if (pathname.startsWith('/api/responses/')) {
        const id = pathname.slice('/api/responses/'.length).trim();
        if (!id || id.length > 64) {
          return jsonResponse({ error: '잘못된 응답 ID입니다.' }, 400);
        }
        if (!(await isTeacherAuthenticated(request, env))) {
          return jsonResponse({ error: '교사 인증이 필요합니다.' }, 401);
        }

        if (request.method === 'PATCH') {
          const body = await parseJsonBody(request);
          if (!body) {
            return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400);
          }

          const rubricLevel =
            body.rubricLevel === '' ||
            body.rubricLevel === '상' ||
            body.rubricLevel === '중' ||
            body.rubricLevel === '하'
              ? body.rubricLevel
              : null;
          if (rubricLevel === null) {
            return jsonResponse({ error: '유효하지 않은 평가 단계입니다.' }, 400);
          }

          const teacherFeedback = cleanText(body.teacherFeedback, 500);
          const now = new Date().toISOString();

          const res = await env.DB.prepare(
            'UPDATE student_responses SET rubric_level = ?, teacher_feedback = ?, updated_at = ? WHERE id = ?',
          )
            .bind(rubricLevel, teacherFeedback, now, id)
            .run();

          if (!res.success) {
            return jsonResponse({ error: '피드백 저장에 실패했습니다.' }, 500);
          }

          const updated = await env.DB.prepare(
            'SELECT id, student_id, student_name, class_group, reflection_text, present_connection, is_public, rubric_level, teacher_feedback, created_at, updated_at FROM student_responses WHERE id = ?',
          )
            .bind(id)
            .first<ResponseRow>();

          if (!updated) {
            return jsonResponse({ error: '해당 응답을 찾을 수 없습니다.' }, 404);
          }

          return jsonResponse(mapTeacherResponseRow(updated));
        }

        if (request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM student_responses WHERE id = ?').bind(id).run();
          return new Response(null, { status: 204 });
        }
      }

      return jsonResponse({ error: '요청한 API 경로를 찾을 수 없습니다.' }, 404);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '서버 오류';
      if (msg.includes('no such table')) {
        return jsonResponse(
          { error: '데이터베이스 테이블이 아직 준비되지 않았습니다. setup.sql을 먼저 실행해 주세요.' },
          503,
        );
      }
      return jsonResponse({ error: '데이터 처리 중 오류가 발생했습니다.' }, 500);
    }
  },
};
