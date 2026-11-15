// 선생님이 붙여 넣은 링크를 실제 이미지 주소로 바꿔 줍니다.
// - 위키백과/위키미디어 '파일:' 설명 페이지 → Special:FilePath 이미지 주소
// - 구글 드라이브 공유 링크 → 썸네일 이미지 주소
// - 구글 이미지 검색 결과 링크(imgurl=) → 원본 이미지 주소

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;

export function toImageUrl(raw: string): string {
  const input = raw.trim();
  if (!input) return '';
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }

  // 구글 이미지 검색 결과
  const imgurl = url.searchParams.get('imgurl');
  if (imgurl && /^https?:\/\//.test(imgurl)) return imgurl;

  // 위키백과·위키미디어 공용
  if (/(^|\.)(wikipedia|wikimedia)\.org$/.test(url.hostname)) {
    const fromHash = decodeURIComponent(url.hash).match(/\/media\/[^:]+:(.+)$/);
    const fromPath = decodeURIComponent(url.pathname).match(/^\/wiki\/[^/:]+:(.+)$/);
    const file = fromHash?.[1] ?? (fromPath && IMAGE_EXT.test(fromPath[1]) ? fromPath[1] : null);
    if (file && !/^Special:/i.test(file)) {
      const host = url.hostname === 'upload.wikimedia.org' ? 'commons.wikimedia.org' : url.hostname;
      return `https://${host}/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`;
    }
  }

  // 구글 드라이브 공유 링크
  if (url.hostname === 'drive.google.com') {
    const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get('id');
    if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`;
  }

  return input;
}

// 이미지 파일 주소로 보이지 않으면(웹 페이지 주소 등) 안내하기 위한 판별
export function looksLikeImageUrl(raw: string): boolean {
  const converted = toImageUrl(raw);
  try {
    const u = new URL(converted);
    return (
      IMAGE_EXT.test(u.pathname) ||
      /Special:FilePath/i.test(u.pathname) ||
      u.hostname === 'upload.wikimedia.org' ||
      u.hostname.endsWith('googleusercontent.com') ||
      (u.hostname === 'drive.google.com' && u.pathname === '/thumbnail') ||
      /(^|\.)(images?|img|cdn|media|static)\./.test(u.hostname) ||
      /[?&](format|fm|ext)=(jpe?g|png|webp|gif)/i.test(u.search)
    );
  } catch {
    return false;
  }
}
