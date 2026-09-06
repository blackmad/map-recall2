// Classic "Greetings from…" large-letter postcard compositor.
//
// Pure measure + canvas paint. No AI: letter masks are drawn from type, photos
// are cover-cropped and clipped with destination-in. Neighborhood HUD entry
// stays the compact strip in renderer.js; this module is the full celebratory
// card (Storybook now, game pop-in overlay later).

import { coverCrop, type TextMeasurer } from './noticeCards.ts';

export const LARGE_LETTER_WIDTH = 640;
export const LARGE_LETTER_HEIGHT = 400;

const NAME_MAX = 118;
const NAME_MIN = 42;
const NAME_FONT_FAMILY = '"Barlow Condensed", "Arial Narrow", "Helvetica Neue Condensed", sans-serif';
const GREETING_FONT_FAMILY = '"Pacifico", "Segoe Script", "Brush Script MT", cursive';
const EXTRUSION_STEPS = 10;
const EXTRUSION_DX = -1.15;
const EXTRUSION_DY = 1.35;
const OUTLINE_WIDTH = 7;

export interface LargeLetterPostcardProps {
  name: string;
  cityName?: string;
  provinceCaption?: string;
  /** Defaults to "Greetings from". */
  greeting?: string;
  /** How many photos will be layered into the letters (0 = typographic fill). */
  imageCount?: number;
  width?: number;
  height?: number;
}

export interface LargeLetterPostcardLayout {
  width: number;
  height: number;
  greeting: string;
  greetingFont: string;
  greetingX: number;
  greetingY: number;
  /** Uppercased display lines (one or two). */
  nameLines: string[];
  nameFontSize: number;
  nameFont: string;
  /** Applied when the floor size still overflows the band. */
  horizontalScale: number;
  letterBand: { x: number; y: number; width: number; height: number };
  /** Baseline y for each name line, relative to the card. */
  nameBaselineYs: number[];
  extrusionSteps: number;
  extrusionDx: number;
  extrusionDy: number;
  outlineWidth: number;
  caption: string;
  captionY: number;
  imageStripCount: number;
  fallbackFill: string;
  extrusionFill: string;
  outlineFill: string;
  paperTop: string;
  paperBottom: string;
}

function nameFontAt(size: number): string {
  return `800 ${size}px ${NAME_FONT_FAMILY}`;
}

function greetingFontAt(size: number): string {
  return `400 ${size}px ${GREETING_FONT_FAMILY}`;
}

/** Prefer a natural break on space or hyphen; otherwise bisect. */
export function splitNameForTwoLines(raw: string): [string, string] {
  const name = raw.trim();
  if (!name) return ['', ''];
  const mid = Math.floor(name.length / 2);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch !== ' ' && ch !== '-') continue;
    const dist = Math.abs(i - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  if (best >= 0) {
    if (name[best] === '-') {
      return [name.slice(0, best + 1).trim(), name.slice(best + 1).trim()];
    }
    return [name.slice(0, best).trim(), name.slice(best + 1).trim()];
  }
  return [name.slice(0, mid).trim(), name.slice(mid).trim()];
}

function lineWidth(
  lines: string[],
  font: string,
  measure: TextMeasurer,
): number {
  return Math.max(0, ...lines.map((line) => measure(line, font)));
}

function fitName(
  display: string,
  bandWidth: number,
  measure: TextMeasurer,
): { lines: string[]; fontSize: number; horizontalScale: number } {
  // Single line first.
  for (let size = NAME_MAX; size >= NAME_MIN; size -= 1) {
    const font = nameFontAt(size);
    if (measure(display, font) <= bandWidth) {
      return { lines: [display], fontSize: size, horizontalScale: 1 };
    }
  }

  // Two lines when a single floor-size line still overflows.
  const pair = splitNameForTwoLines(display);
  if (pair[0] && pair[1]) {
    for (let size = NAME_MAX; size >= NAME_MIN; size -= 1) {
      const font = nameFontAt(size);
      if (lineWidth(pair, font, measure) <= bandWidth) {
        return { lines: pair, fontSize: size, horizontalScale: 1 };
      }
    }
    const floorFont = nameFontAt(NAME_MIN);
    const widest = lineWidth(pair, floorFont, measure);
    if (widest > 0) {
      return {
        lines: pair,
        fontSize: NAME_MIN,
        horizontalScale: Math.min(1, bandWidth / widest),
      };
    }
  }

  const floorFont = nameFontAt(NAME_MIN);
  const single = measure(display, floorFont);
  return {
    lines: [display],
    fontSize: NAME_MIN,
    horizontalScale: single > 0 ? Math.min(1, bandWidth / single) : 1,
  };
}

export function measureLargeLetterPostcard(
  props: LargeLetterPostcardProps,
  measure: TextMeasurer,
): LargeLetterPostcardLayout {
  const width = props.width ?? LARGE_LETTER_WIDTH;
  const height = props.height ?? LARGE_LETTER_HEIGHT;
  const padX = Math.round(width * 0.06);
  const bandWidth = width - padX * 2;
  const display = String(props.name || '').trim().toUpperCase() || '—';
  const fitted = fitName(display, bandWidth, measure);

  const lineCount = fitted.lines.length;
  const lineGap = fitted.fontSize * (lineCount > 1 ? 0.92 : 1);
  const letterBandHeight = Math.round(fitted.fontSize * lineCount * (lineCount > 1 ? 0.95 : 1.05));
  const letterBandY = Math.round(height * 0.38);
  const letterBand = {
    x: padX,
    y: letterBandY,
    width: bandWidth,
    height: Math.max(letterBandHeight, Math.round(fitted.fontSize * 1.1)),
  };

  const firstBaseline = letterBand.y + Math.round(fitted.fontSize * 0.88);
  const nameBaselineYs = fitted.lines.map((_, i) => firstBaseline + i * lineGap);

  const greeting = props.greeting ?? 'Greetings from';
  const greetingSize = Math.max(22, Math.round(width * 0.055));
  const greetingFont = greetingFontAt(greetingSize);
  const greetingWidth = measure(greeting, greetingFont);
  const greetingX = Math.round((width - greetingWidth) / 2);
  const greetingY = Math.max(36, letterBand.y - Math.round(greetingSize * 0.55));

  const city = props.cityName || 'Amsterdam';
  const caption = props.provinceCaption
    ? `${city} · ${props.provinceCaption}`
    : city;
  const captionY = Math.min(
    height - 28,
    letterBand.y + letterBand.height + Math.round(fitted.fontSize * 0.35) + 28,
  );

  const imageStripCount = Math.max(0, Math.floor(props.imageCount ?? 0));

  return {
    width,
    height,
    greeting,
    greetingFont,
    greetingX,
    greetingY,
    nameLines: fitted.lines,
    nameFontSize: fitted.fontSize,
    nameFont: nameFontAt(fitted.fontSize),
    horizontalScale: fitted.horizontalScale,
    letterBand,
    nameBaselineYs,
    extrusionSteps: EXTRUSION_STEPS,
    extrusionDx: EXTRUSION_DX,
    extrusionDy: EXTRUSION_DY,
    outlineWidth: OUTLINE_WIDTH,
    caption,
    captionY,
    imageStripCount,
    fallbackFill: '#1a3a6b',
    extrusionFill: '#1a0f0a',
    outlineFill: '#0a0604',
    paperTop: '#f3e6c8',
    paperBottom: '#d9c49a',
  };
}

type CanvasCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function roundRectPath(
  ctx: CanvasCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function withNameTransform(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  paint: () => void,
): void {
  const cx = layout.width / 2;
  ctx.save();
  if (layout.horizontalScale < 1) {
    ctx.translate(cx, 0);
    ctx.scale(layout.horizontalScale, 1);
    ctx.translate(-cx, 0);
  }
  paint();
  ctx.restore();
}

function fillNameLines(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  ctx.font = layout.nameFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = layout.width / 2;
  for (let i = 0; i < layout.nameLines.length; i++) {
    ctx.fillText(layout.nameLines[i], cx, layout.nameBaselineYs[i]);
  }
}

function strokeNameLines(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  ctx.font = layout.nameFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = layout.width / 2;
  for (let i = 0; i < layout.nameLines.length; i++) {
    ctx.strokeText(layout.nameLines[i], cx, layout.nameBaselineYs[i]);
  }
}

function drawPaper(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  const { width: w, height: h } = layout;
  roundRectPath(ctx, 0, 0, w, h, 10);
  ctx.clip();

  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, layout.paperTop);
  wash.addColorStop(0.55, '#ebe0c2');
  wash.addColorStop(1, layout.paperBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  // Soft corner vignette — sun-faded card stock.
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.4, h * 0.15, w * 0.5, h * 0.5, h * 0.85);
  vignette.addColorStop(0, 'rgba(255,245,220,0)');
  vignette.addColorStop(1, 'rgba(90,60,30,0.22)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Cheap procedural grain (deterministic, no image asset).
  ctx.save();
  ctx.globalAlpha = 0.045;
  for (let i = 0; i < 140; i++) {
    const x = (i * 47 + 13) % w;
    const y = (i * 91 + 29) % h;
    const s = 1 + (i % 3);
    ctx.fillStyle = i % 2 === 0 ? '#5a4030' : '#fff8e8';
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function drawScenicWash(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  image: CanvasImageSource | null,
): void {
  if (!image) return;
  const nw = 'naturalWidth' in image ? Number(image.naturalWidth) : Number((image as ImageBitmap).width);
  const nh = 'naturalHeight' in image ? Number(image.naturalHeight) : Number((image as ImageBitmap).height);
  if (!nw || !nh) return;
  const crop = coverCrop(nw, nh, layout.width, layout.height);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.filter = 'saturate(0.55) contrast(0.95)';
  ctx.drawImage(
    image,
    crop.sx, crop.sy, crop.sw, crop.sh,
    0, 0, layout.width, layout.height,
  );
  ctx.restore();
  ctx.filter = 'none';
}

function drawExtrusion(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  withNameTransform(ctx, layout, () => {
    ctx.fillStyle = layout.extrusionFill;
    for (let step = layout.extrusionSteps; step >= 1; step--) {
      ctx.save();
      ctx.translate(step * layout.extrusionDx, step * layout.extrusionDy);
      fillNameLines(ctx, layout);
      ctx.restore();
    }
  });
}

function drawOutline(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  withNameTransform(ctx, layout, () => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = layout.outlineFill;
    ctx.lineWidth = layout.outlineWidth;
    strokeNameLines(ctx, layout);
  });
}

function imageSize(image: CanvasImageSource): { w: number; h: number } {
  if ('naturalWidth' in image && Number(image.naturalWidth) > 0) {
    return { w: Number(image.naturalWidth), h: Number(image.naturalHeight) };
  }
  const bmp = image as ImageBitmap | HTMLCanvasElement | OffscreenCanvas;
  return { w: Number(bmp.width), h: Number(bmp.height) };
}

function drawLetterFill(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  images: CanvasImageSource[],
): void {
  const band = layout.letterBand;
  let octx: CanvasCtx | null = null;
  let off: CanvasImageSource;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(layout.width, layout.height);
    octx = canvas.getContext('2d');
    off = canvas;
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    octx = canvas.getContext('2d');
    off = canvas;
  }
  if (!octx) return;

  if (images.length === 0) {
    withNameTransform(octx, layout, () => {
      octx.fillStyle = layout.fallbackFill;
      fillNameLines(octx, layout);
    });
  } else {
    const strips = Math.max(1, Math.min(images.length, layout.imageStripCount || images.length));
    const stripW = band.width / strips;
    for (let i = 0; i < strips; i++) {
      const img = images[i] ?? images[images.length - 1];
      const { w: nw, h: nh } = imageSize(img);
      if (!nw || !nh) continue;
      const dx = band.x + i * stripW;
      const crop = coverCrop(nw, nh, stripW, band.height);
      octx.drawImage(
        img,
        crop.sx, crop.sy, crop.sw, crop.sh,
        dx, band.y, stripW, band.height,
      );
    }
    // Clip the photo band to the letterforms.
    octx.globalCompositeOperation = 'destination-in';
    withNameTransform(octx, layout, () => {
      octx.fillStyle = '#000';
      fillNameLines(octx, layout);
    });
    octx.globalCompositeOperation = 'source-over';
  }

  ctx.drawImage(off as CanvasImageSource, 0, 0);
}

function drawInnerRim(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  withNameTransform(ctx, layout, () => {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1.5, layout.outlineWidth * 0.28);
    strokeNameLines(ctx, layout);
  });
}

function drawGreetingAndCaption(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  ctx.save();
  ctx.fillStyle = '#6b1d1d';
  ctx.font = layout.greetingFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(layout.greeting, layout.greetingX, layout.greetingY);

  ctx.fillStyle = 'rgba(40,28,18,0.72)';
  ctx.font = `600 16px ${NAME_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.fillText(layout.caption, layout.width / 2, layout.captionY);

  // Thin postal rule under the caption.
  const ruleW = Math.min(180, layout.width * 0.28);
  ctx.strokeStyle = 'rgba(40,28,18,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.width / 2 - ruleW / 2, layout.captionY + 10);
  ctx.lineTo(layout.width / 2 + ruleW / 2, layout.captionY + 10);
  ctx.stroke();
  ctx.restore();
}

/**
 * Paint a measured large-letter postcard into `ctx`.
 * `images` may be empty (typographic fallback), one (span), or many (strips).
 */
export function drawLargeLetterPostcard(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  images: CanvasImageSource[] = [],
): void {
  ctx.save();
  drawPaper(ctx, layout);
  drawScenicWash(ctx, layout, images[0] ?? null);
  drawExtrusion(ctx, layout);
  drawOutline(ctx, layout);
  drawLetterFill(ctx, layout, images);
  drawInnerRim(ctx, layout);
  drawGreetingAndCaption(ctx, layout);

  // Card edge.
  ctx.strokeStyle = 'rgba(60,40,20,0.45)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, 1, 1, layout.width - 2, layout.height - 2, 9);
  ctx.stroke();
  ctx.restore();
}
