// A buurt stamp: the large-letter postcard compositor's small square variant,
// set inside a perforated stamp edge (G5, issue #275).
//
// The compositor carries opentype.js (~295 kB minified), so the game loads
// this module as its own bundle (`CanalRecallStampArt`, see stampArtLoader.ts)
// only when an album or an arrival stamp is shown; the overlay and the ride
// bundles stay their size. Storybook imports it directly.

import {
  drawLargeLetterPostcard,
  loadLargeLetterFont,
  measureLargeLetterPostcard,
  type OtFont,
} from './largeLetterPostcard.ts';
import { punchPerforations, STAMP_PAPER } from './stampAlbumPlain.ts';

/** Internal resolution of one stamp; drawn at ~64–112 CSS px, so 3× at most. */
export const STAMP_ART_SIZE = 300;
const FONT_URL = '/canal-drive/fonts/Anton-Regular.ttf';

let font: OtFont | null = null;
let fontLoad: Promise<OtFont | null> | null = null;
const cache = new Map<string, HTMLCanvasElement>();

export function loadStampFont(url = FONT_URL): Promise<OtFont | null> {
  if (font) return Promise.resolve(font);
  if (!fontLoad) {
    fontLoad = loadLargeLetterFont(url).then(loaded => { font = loaded; cache.clear(); return loaded; }).catch(() => null);
  }
  return fontLoad;
}

/**
 * Draw the stamp for `name` into a square of `size` px at the context origin:
 * cream stamp paper, perforated edge, and the postcard (no photographs; a
 * stamp is the card's lettering) inset by the perforation margin.
 */
export function drawBuurtStamp(ctx: CanvasRenderingContext2D, name: string, size = STAMP_ART_SIZE): void {
  const margin = Math.round(size * 0.075);
  const inner = size - margin * 2;
  ctx.save();
  ctx.fillStyle = STAMP_PAPER;
  ctx.fillRect(0, 0, size, size);
  const measure = (text: string, spec: string) => { ctx.font = spec; return ctx.measureText(text).width; };
  const layout = measureLargeLetterPostcard(
    { name, width: inner, height: inner, greeting: '', cityName: 'Amsterdam', imageCount: 0 },
    measure,
    font ? { font, pathWarp: true } : undefined,
  );
  ctx.translate(margin, margin);
  drawLargeLetterPostcard(ctx, layout, [], font ? { font } : undefined);
  ctx.restore();
  punchPerforations(ctx, size);
}

/** A cached stamp canvas; redrawn once the outline font arrives. */
export function buurtStampCanvas(name: string, size = STAMP_ART_SIZE): HTMLCanvasElement {
  const key = `${size}|${font ? 'f' : 'n'}|${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) drawBuurtStamp(ctx, name, size);
  cache.set(key, canvas);
  return canvas;
}

export interface StampArt {
  drawBuurtStamp: typeof drawBuurtStamp;
  buurtStampCanvas: typeof buurtStampCanvas;
  loadStampFont: typeof loadStampFont;
  STAMP_ART_SIZE: number;
}
