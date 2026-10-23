import React, { useEffect, useState } from 'react';
import { preparePostcard } from '../mapRecall/livePostcard';
import outlineFontUrl from '../mapRecall/fonts/Anton-Regular.ttf?url';
import { useT } from '../i18n/useT';

/** The saved card's size: twice the on-screen postcard (640 × 400). */
export const POSTCARD_EXPORT_WIDTH = 1280;
export const POSTCARD_EXPORT_HEIGHT = 800;

/** `greetings-from-de-pijp.png` */
export function postcardFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `greetings-from-${slug || 'amsterdam'}.png`;
}

/**
 * A CORS-clean copy of a photograph, or null. Commons thumbnails (thumb./upload.wikimedia.org)
 * send `Access-Control-Allow-Origin: *`, so with `crossOrigin = 'anonymous'` they can be drawn to a
 * canvas that is still exportable. Anything that fails CORS fails to load here and its window
 * stays the plain fallback colour, so the export never taints.
 */
function loadCorsImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** The painted-photo SVG filter the window filters reference, added to the page once (same id as PostcardHeader's). */
function ensurePaintFilter(filterSvg: string): void {
  if (typeof document === 'undefined' || document.getElementById('large-letter-paint-defs')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'large-letter-paint-defs';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `<defs>${filterSvg}</defs>`;
  document.body.appendChild(svg);
}

/**
 * Compose the whole postcard (photographs, frame and print grain) at 1280 × 800 and return it as a
 * PNG blob, or null when the compositor cannot load.
 *
 * The frame is repainted here rather than copied from `preparePostcard`'s canvas: that canvas
 * holds the backdrop photograph loaded without CORS, so copying it would taint the export. The
 * layout is measured with the same inputs as livePostcard.ts, so the windows match the card on
 * screen; tones are measured from the CORS copies so each window gets its poster/soft filter.
 */
export async function composePostcardPng(name: string, cityName: string | undefined, photos: readonly string[]): Promise<Blob | null> {
  // Registers Anton and Pacifico with document.fonts, and is the same gate the header uses.
  const prepared = await preparePostcard(name, cityName, photos);
  if (!prepared) return null;
  const postcard = await import('../canalRecall/largeLetterPostcard');
  const [font, images] = await Promise.all([
    postcard.loadLargeLetterFont(outlineFontUrl),
    Promise.all(photos.map(loadCorsImage)),
  ]);
  const { width, height } = prepared;
  const canvas = document.createElement('canvas');
  canvas.width = POSTCARD_EXPORT_WIDTH;
  canvas.height = POSTCARD_EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const measure = (text: string, fontSpec: string) => { ctx.font = fontSpec; return ctx.measureText(text).width; };
  const layout = postcard.measureLargeLetterPostcard(
    { name, cityName, imageCount: photos.length, width, height },
    measure,
    { font, pathWarp: true },
  );
  const tones = images.map((image) => (image ? postcard.measurePhotoTone(image) : null));
  const windows = postcard.largeLetterPhotoWindows(layout, photos.length, font, { photoTones: tones });
  ensurePaintFilter(postcard.POSTCARD_PAINT_FILTER_SVG);

  ctx.imageSmoothingQuality = 'high';
  ctx.scale(POSTCARD_EXPORT_WIDTH / width, POSTCARD_EXPORT_HEIGHT / height);

  // 1. Photographs behind the card, as PostcardHeader lays its <img>s.
  ctx.save();
  const { clip } = windows;
  ctx.beginPath();
  ctx.rect(clip.x, clip.y, clip.width, clip.height);
  ctx.clip();
  ctx.fillStyle = windows.fallbackFill;
  ctx.fillRect(clip.x, clip.y, clip.width, clip.height);
  ctx.transform(...windows.matrix);
  for (const window of windows.windows) {
    const image = images[window.imageIndex];
    if (!image) continue;
    const { x, y, width: bw, height: bh } = window.box;
    // object-fit: cover at object-position focus.
    const scale = Math.max(bw / image.naturalWidth, bh / image.naturalHeight);
    const sw = bw / scale, sh = bh / scale;
    const sx = (image.naturalWidth - sw) * window.focusX;
    const sy = (image.naturalHeight - sh) * window.focusY;
    ctx.save();
    ctx.translate(x, y);
    ctx.clip(new Path2D(window.d));
    ctx.filter = window.filter;
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, bw, bh);
    ctx.restore();
  }
  ctx.restore();

  // 2. The frame with transparent letter faces, the backdrop being photograph 0.
  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  const frameCtx = frame.getContext('2d');
  if (!frameCtx) return null;
  postcard.drawLargeLetterPostcard(frameCtx, layout, images[0] ? [images[0]] : [], { font, photoWindows: true });
  ctx.drawImage(frame, 0, 0, width, height);

  // 3. Print grain over everything, as the header's overlay layer.
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.35;
  ctx.drawImage(prepared.grain, 0, 0, width, height);
  ctx.restore();

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Status = 'idle' | 'saving' | 'error';

/**
 * "Save postcard": composes the "Greetings from" card the player sees (frame, photographs, grain)
 * to a 1280 × 800 PNG and downloads it as `greetings-from-<name>.png`. Renders nothing when the
 * card cannot be composed (no compositor or outline font), matching PostcardHeader.
 */
export const PostcardExport: React.FC<{
  name: string;
  cityName?: string;
  photos: string[];
  className?: string;
}> = ({ name, cityName, photos, className }) => {
  const t = useT();
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const key = `${name}|${cityName ?? ''}|${photos.join('|')}`;

  useEffect(() => {
    let cancelled = false;
    setAvailable(false);
    setStatus('idle');
    void preparePostcard(name, cityName, photos).then((card) => { if (!cancelled) setAvailable(!!card); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!available) return null;
  const save = async () => {
    setStatus('saving');
    try {
      const blob = await composePostcardPng(name, cityName, photos);
      if (!blob) throw new Error('postcard unavailable');
      download(blob, postcardFileName(name));
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };
  return <button
    type="button"
    data-testid="save-postcard"
    onClick={() => { void save(); }}
    disabled={status === 'saving'}
    aria-label={`Save the Greetings from ${name} postcard as an image`}
    className={className ?? 'inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-sm font-medium text-slate-700 underline-offset-2 hover:underline disabled:opacity-60'}
  >
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" />
    </svg>
    {status === 'saving' ? t('postcard.saving') : status === 'error' ? t('postcard.saveError') : t('postcard.save')}
  </button>;
};
