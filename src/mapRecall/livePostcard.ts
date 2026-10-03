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

const WIDTH = 640;
const HEIGHT = 400;

export interface PreparedPostcard {
  width: number;
  height: number;
  photos: readonly string[];
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

async function compose(name: string, cityName: string | undefined, photos: readonly string[]): Promise<PreparedPostcard | null> {
  const backdrop = photos.length ? loadImage(photos[0]) : Promise.resolve(null);
  for (const url of photos.slice(1)) void loadImage(url);
  const fonts = `${import.meta.env.BASE_URL}canal-drive/fonts/`;
  const postcard = await import('../canalRecall/largeLetterPostcard');
  const [font] = await Promise.all([postcard.loadLargeLetterFont(`${fonts}Anton-Regular.ttf`), postcard.ensureLargeLetterWebFonts(fonts)]);
  const frame = document.createElement('canvas');
  const ctx = frame.getContext('2d');
  if (!ctx) return null;
  const measure = (text: string, fontSpec: string) => { ctx.font = fontSpec; return ctx.measureText(text).width; };
  const layout = postcard.measureLargeLetterPostcard(
    { name, cityName, imageCount: photos.length, width: WIDTH, height: HEIGHT },
    measure,
    { font, pathWarp: true },
  );
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
  return {
    width: layout.width,
    height: layout.height,
    photos,
    windows: postcard.largeLetterPhotoWindows(layout, photos.length, font),
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
}
