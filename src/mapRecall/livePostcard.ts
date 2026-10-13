/**
 * "Greetings from" postcards for Map Recall, composed in layers so nothing waits for photographs.
 *
 * The large-letter compositor (src/canalRecall/largeLetterPostcard.ts) paints the card with every
 * letter face left transparent (`photoWindows`), and `largeLetterPhotoWindows` says where each
 * photograph goes. The page lays the photographs behind the card as ordinary images, so the browser
 * fetches them in its own time and each letter fills in as its photo arrives. Only the frame needs
 * the compositor and the outline font, and the quiz prepares it while the player is still guessing
 * (`preparePostcard` from the round's first render), so the answer card shows it at once.
 *
 * User report 2026-10-02: the postcard used to be composed at reveal, after waiting for all eight
 * Commons photographs, the compositor chunk and the font (1.3-12 s).
 */
import type { LargeLetterPhotoWindows } from '../canalRecall/largeLetterPostcard';
import outlineFontUrl from './fonts/Anton-Regular.ttf?url';
import scriptFontUrl from './fonts/Pacifico-Regular.ttf?url';

const WIDTH = 640;
const HEIGHT = 400;

export interface PreparedPostcard {
  width: number;
  height: number;
  photos: readonly string[];
  /** Replaced once every photograph has loaded and been measured (per-photo filters); repaint listeners fire. */
  windows: LargeLetterPhotoWindows;
  /** The card with transparent letter faces; repainted once when the backdrop photograph arrives. */
  frame: HTMLCanvasElement;
  /** The SVG `<filter>` the letter photographs' CSS filter references (windows.filter). */
  paintFilterSvg: string;
  /** Print grain for an `overlay` layer over the whole card (shared by every postcard). */
  grain: HTMLCanvasElement;
  /** Called after each repaint of `frame`; returns an unsubscribe. */
  onRepaint(listener: () => void): () => void;
}

let grainCanvas: HTMLCanvasElement | null = null;

const prepared = new Map<string, Promise<PreparedPostcard | null>>();


function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    // Same mode as the card's <img> (one cached copy), and readable for measurePhotoTone.
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * Start composing a postcard (idempotent per name and photo list). Also asks the browser for the
 * photographs, so by the time the card shows they are usually cached. Resolves null when the
 * compositor or its outline font cannot load; the card then shows its plain thumbnail.
 */
export function preparePostcard(name: string, cityName: string | undefined, photos: readonly string[]): Promise<PreparedPostcard | null> {
  const key = [name, cityName ?? '', ...photos].join('\n');
  let entry = prepared.get(key);
  if (!entry) {
    entry = compose(name, cityName, photos).catch(() => null);
    prepared.set(key, entry);
    // Keep the cache to the last few rounds.
    if (prepared.size > 12) prepared.delete(prepared.keys().next().value!);
  }
  return entry;
}

/**
 * Whether the caption fits beside the bicycle prop, at the size and place drawLargeLetterPostcard
 * prints it (right-aligned, 16 px in from the border; the bicycle is about 36 px wide, 16 px in
 * from the left border).
 */
function captionFits(
  layout: { caption: string; width: number; borderInset: number; nameFontSize: number },
  measure: (text: string, font: string) => number,
  fontCss: string,
): boolean {
  const size = Math.max(16, Math.min(Math.round(layout.nameFontSize * 0.22), Math.round(layout.width * 0.042)));
  const room = layout.width - 2 * layout.borderInset - 16 - (16 + 36 + 14);
  return measure(layout.caption.toUpperCase(), `800 ${size}px ${fontCss}`) <= room;
}

let faces: Promise<void> | null = null;
/** The postcard's two faces as page fonts ("Anton", "Pacifico"), for the canvas and the phone strip. */
export function loadPostcardFaces(): Promise<void> {
  faces ??= Promise.all([['Anton', outlineFontUrl], ['Pacifico', scriptFontUrl]].map(async ([family, url]) => {
    const face = new FontFace(family, `url(${url})`);
    document.fonts.add(await face.load());
  })).then(() => undefined);
  return faces;
}

async function compose(name: string, cityName: string | undefined, photos: readonly string[]): Promise<PreparedPostcard | null> {
  const loads = photos.map((url) => loadImage(url));
  const backdrop = loads[0] ?? Promise.resolve(null);
  const postcard = await import('../canalRecall/largeLetterPostcard');
  // EduMap hosting excludes canal-drive/**. Vite imports put these fonts in
  // its own fingerprinted assets, rather than depending on Canal Recall files.
  const [font] = await Promise.all([postcard.loadLargeLetterFont(outlineFontUrl), loadPostcardFaces()]);
  const frame = document.createElement('canvas');
  const ctx = frame.getContext('2d');
  if (!ctx) return null;
  const measure = (text: string, fontSpec: string) => { ctx.font = fontSpec; return ctx.measureText(text).width; };
  const measureCard = (caption: string | undefined) => postcard.measureLargeLetterPostcard(
    { name, cityName: caption, imageCount: photos.length, width: WIDTH, height: HEIGHT },
    measure,
    { font, pathWarp: true },
  );
  let layout = measureCard(cityName);
  // "Zuid · Amsterdam" only when it clears the bicycle in the bottom-left corner; else the city.
  if (cityName?.includes(' · ') && !captionFits(layout, measure, postcard.LARGE_LETTER_FONT_CSS)) {
    layout = measureCard(cityName.split(' · ').pop());
  }
  frame.width = layout.width;
  frame.height = layout.height;
  const listeners = new Set<() => void>();
  const paint = (images: HTMLImageElement[]) => {
    ctx.clearRect(0, 0, layout.width, layout.height);
    postcard.drawLargeLetterPostcard(ctx, layout, images, { font, photoWindows: true });
    listeners.forEach((listener) => listener());
  };
  paint([]);
  // The first photograph is also the card's faded backdrop: one repaint when it arrives.
  void backdrop.then((image) => { if (image) paint([image]); });
  // Per-photo filters (the compositor lane's measurePhotoTone, when present): the windows are
  // laid out at once and re-laid with each photograph's measured tone once all have loaded.
  type WindowsOptions = { photoTones?: ReadonlyArray<unknown> };
  const photoWindows = postcard.largeLetterPhotoWindows as unknown as (
    layout: Parameters<typeof postcard.largeLetterPhotoWindows>[0], count: number, font: Parameters<typeof postcard.largeLetterPhotoWindows>[2], opts?: WindowsOptions,
  ) => LargeLetterPhotoWindows;
  const measureTone = (postcard as unknown as { measurePhotoTone?: (image: HTMLImageElement) => unknown }).measurePhotoTone;
  const card: PreparedPostcard = {
    width: layout.width,
    height: layout.height,
    photos,
    windows: photoWindows(layout, photos.length, font),
    frame,
    paintFilterSvg: postcard.POSTCARD_PAINT_FILTER_SVG,
    grain: grainCanvas ??= (() => {
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const grainCtx = canvas.getContext('2d');
      if (grainCtx) postcard.drawLargeLetterPrintGrain(grainCtx, WIDTH, HEIGHT);
      return canvas;
    })(),
    onRepaint(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  if (measureTone && photos.length) {
    void Promise.all(loads).then((images) => {
      try {
        const tones = images.map((image) => image ? measureTone(image) : null);
        card.windows = photoWindows(layout, photos.length, font, { photoTones: tones });
        listeners.forEach((listener) => listener());
      } catch { /* a tainted or failed photograph keeps the default filter */ }
    });
  }
  return card;
}
