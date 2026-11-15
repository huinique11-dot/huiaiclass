const MAX_DATA_URL_LENGTH = 360000;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 파일을 불러오지 못했습니다.'));
    img.src = src;
  });
}

function encodeCanvas(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number,
  mimeType: 'image/webp' | 'image/jpeg',
): string {
  const ratio = Math.min(1, maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const width = Math.max(1, Math.round((img.naturalWidth || 1) * ratio));
  const height = Math.max(1, Math.round((img.naturalHeight || 1) * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('브라우저에서 이미지 변환을 지원하지 않습니다.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL(mimeType, quality);
}

export async function compressArtworkImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일(JPG, PNG, WebP 등)만 올릴 수 있습니다.');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('15MB 이하의 이미지 파일을 선택해 주세요.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);

    const attempts: Array<[number, number, 'image/webp' | 'image/jpeg']> = [
      [960, 0.82, 'image/webp'],
      [960, 0.78, 'image/jpeg'],
      [760, 0.72, 'image/jpeg'],
      [600, 0.65, 'image/jpeg'],
    ];

    for (const [maxDim, quality, mime] of attempts) {
      const dataUrl = encodeCanvas(img, maxDim, quality, mime);
      if (dataUrl.startsWith(`data:${mime}`) && dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }

    throw new Error('이미지 용량이 너무 큽니다. 더 작은 사진이나 이미지 주소(URL)를 사용해 주세요.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isValidArtworkImageSource(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= 450000;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
