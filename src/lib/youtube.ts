export interface ParsedYouTubeLink {
  videoId: string;
  embedUrl: string;
  watchUrl: string;
}

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeUrl(rawUrl: string): ParsedYouTubeLink | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v') ?? '';
    } else if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
      videoId = parts[1] ?? '';
    }
  }

  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    return null;
  }

  return {
    videoId,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export function isValidHttpUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
