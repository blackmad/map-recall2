// Classic "Greetings from…" large-letter postcard compositor.
//
// Follows the Spoon Graphics Illustrator→Photoshop recipe in canvas form:
// banded 3D extrusion, pathable baseline, photos under transparent letter faces
// (word-art overlay), outer outline, linen grain. Style presets live in
// largeLetterPostcardStyles.ts so gallery variety is generative knobs, not forks.
//
// Neighborhood HUD entry stays the compact strip in renderer.js; this module
// is the celebratory card (Storybook now, game pop-in overlay later).

import { coverCrop, type TextMeasurer } from './noticeCards.ts';
import {
  baselinePathOffset,
  resolvePostcardStyle,
  type PostcardStyle,
  type PostcardStyleId,
} from './largeLetterPostcardStyles.ts';
import {
  LARGE_LETTER_FONT_CSS,
  pathCommandsToPath2D,
  warpPathCommands,
  pathBendLift,
  type ArchEnvelope,
  type OtFont,
} from './largeLetterGlyphPaths.ts';

export {
  loadLargeLetterFont,
  getLoadedLargeLetterFont,
  LARGE_LETTER_FONT_URL,
  LARGE_LETTER_FONT_CSS,
  pathCommandsToSvgD,
  type OtFont,
} from './largeLetterGlyphPaths.ts';

export {
  POSTCARD_STYLES,
  DEFAULT_POSTCARD_STYLE_ID,
  resolvePostcardStyle,
  type BaselinePath,
  type PostcardStyle,
  type PostcardStyleId,
} from './largeLetterPostcardStyles.ts';

export const LARGE_LETTER_WIDTH = 640;
export const LARGE_LETTER_HEIGHT = 400;

/** Billboard: tall faces first — width stretch is secondary. */
const NAME_MAX_FRAC = 0.80;
const NAME_MIN = 72;
/** Stretch advances to fill the band — shapes stay inside advances (no overlap). */
const MAX_HORIZONTAL_STRETCH = 1.7;
/** Allow horizontal squeeze so Archivo Black can stay TALL. */
const MIN_HORIZONTAL_SCALE = 0.68;
/** Prefer fill stretch, but height wins — mild compression is OK. */
const PREFERRED_MIN_STRETCH = 0.84;
/** Long unbroken tokens prefer a hyphenated two-line break. */
const LONG_NAME_CHARS = 9;
/** Ultra-black display face — thick stems for photo windows (Monterey weight). */
const NAME_FONT_FAMILY = LARGE_LETTER_FONT_CSS;
const GREETING_FONT_FAMILY = '"Pacifico", "Segoe Script", "Brush Script MT", cursive';
/**
 * Near-zero / slight negative tracking: authentic linen cards sit letters
 * tight with a hair of outline air — never stacked/overlapping faces.
 */
const TRACKING_EM = -0.038;

/** Desired billboard bulk before fit-to-frame (layout may shrink to stay on-card). */
const DESIRED_PAINT_SCALE_X = 1.0;
const DESIRED_PAINT_SCALE_Y = 1.05;
/** Lean matrix — identity: one shared billboard plane (no tip/shear). */
const PAINT_LEAN = { a: 1.0, b: 0, c: 0, d: 1.0 } as const;
/** Keep this many px inside the paper after transform. */
const FRAME_SAFE_PAD = 6;
/** Target painted face height as a fraction of card height (linen billboard). */
const TARGET_FACE_HEIGHT_FRAC = 0.74;
/** Soft-clip extrusion into caption zone so faces can stay tall. */
const MAX_FACE_PULL_Y = 2.7;
/** Paper margin — authentic linen is a hairline, not a mat. */
const BORDER_INSET = 4;
/** Hard clearance from paper clip to letter ink tops (px). */
const TOP_INK_CLEAR = 12;
/** Reserve for "Greetings from" above the billboard crest. */
const GREETING_BAND_FRAC = 0.055;
/** Comfortable face fill — tall souvenir letters, not a squat strip. */
const MIN_FACE_FILL_FRAC = 0.60;
/** Cap so short names keep a little air without a mid-card strip. */
const MAX_FACE_FILL_FRAC = 0.78;
/** Side air inside the paper clip (faces + outline). */
const SIDE_INK_CLEAR = 6;

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Untransformed content box: glyph faces + extrusion + outline pad. */
export function measureLetterContentBounds(layout: Pick<
  LargeLetterPostcardLayout,
  'glyphs' | 'nameFontSize' | 'extrusionSteps' | 'extrusionDx' | 'extrusionDy' | 'outlineWidth'
>): Bounds {
  const ascent = layout.nameFontSize * 0.82;
  const descent = layout.nameFontSize * 0.1;
  const pad = layout.outlineWidth + 2;
  const steps = layout.extrusionSteps;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of layout.glyphs) {
    if (g.char === ' ' || g.char === '-') continue;
    const xs = [
      g.x,
      g.x + g.width,
      g.x + steps * layout.extrusionDx,
      g.x + g.width + steps * layout.extrusionDx,
    ];
    const ys = [
      g.baselineY - ascent,
      g.baselineY + descent,
      g.baselineY - ascent + steps * layout.extrusionDy,
      g.baselineY + descent + steps * layout.extrusionDy + 3,
    ];
    for (const x of xs) {
      minX = Math.min(minX, x - pad);
      maxX = Math.max(maxX, x + pad);
    }
    for (const y of ys) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

function applyPaintTransform(
  x: number,
  y: number,
  pivotX: number,
  pivotY: number,
  scaleX: number,
  scaleY: number,
  lean: typeof PAINT_LEAN,
): { x: number; y: number } {
  const px = (x - pivotX) * scaleX;
  const py = (y - pivotY) * scaleY;
  return {
    x: lean.a * px + lean.c * py + pivotX,
    y: lean.b * px + lean.d * py + pivotY,
  };
}

/** Transformed AABB from every glyph face + extrusion corner (not just content box). */
export function measurePaintedLetterBounds(layout: LargeLetterPostcardLayout): Bounds {
  const pullX = layout.facePullX ?? 1;
  const pullY = layout.facePullY ?? 1;
  // Archivo Black caps + path warp: tops ~0.72em. 1.15× archPad invented a
  // phantom crest that starved fill while photo ink sat mid-card.
  const archPad = (layout.archAmount ?? 0) * 0.55;
  const ascent = layout.nameFontSize * 0.72 * pullY + archPad;
  const descent = layout.nameFontSize * 0.14 * pullY + archPad * 0.25;
  const pad = layout.outlineWidth + Math.max(2, layout.nameFontSize * 0.03);
  const steps = layout.extrusionSteps;
  const dx = layout.extrusionDx;
  const dy = layout.extrusionDy;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of layout.glyphs) {
    if (g.char === ' ' || g.char === '-') continue;
    const hw = (g.width * pullX) / 2;
    const cx = g.x + g.width / 2;
    const local: Array<[number, number]> = [
      [cx - hw - pad, g.baselineY - ascent],
      [cx + hw + pad, g.baselineY - ascent],
      [cx - hw - pad, g.baselineY + descent],
      [cx + hw + pad, g.baselineY + descent],
      [cx - hw + steps * dx - pad, g.baselineY - ascent + steps * dy],
      [cx + hw + steps * dx + pad, g.baselineY - ascent + steps * dy],
      [cx - hw + steps * dx - pad, g.baselineY + descent + steps * dy + 3],
      [cx + hw + steps * dx + pad, g.baselineY + descent + steps * dy + 3],
    ];
    for (const [x, y] of local) {
      const p = applyPaintTransform(
        x,
        y,
        layout.paintPivotX,
        layout.paintPivotY,
        layout.paintScaleX,
        layout.paintScaleY,
        PAINT_LEAN,
      );
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function boundsFitFrame(bounds: Bounds, frame: Bounds): boolean {
  return (
    bounds.minX >= frame.minX
    && bounds.minY >= frame.minY
    && bounds.maxX <= frame.maxX
    && bounds.maxY <= frame.maxY
  );
}

/** Face-only AABB (no extrusion) after paint transform — used so X-fit can
 *  keep stretched letters edge-tight without paying for the left shelf. */
export function measurePaintedFaceBounds(layout: LargeLetterPostcardLayout): Bounds {
  const pullX = layout.facePullX ?? 1;
  const pullY = layout.facePullY ?? 1;
  const archPad = (layout.archAmount ?? 0) * 0.55;
  const ascent = layout.nameFontSize * 0.72 * pullY + archPad;
  const descent = layout.nameFontSize * 0.14 * pullY + archPad * 0.25;
  const pad = layout.outlineWidth + 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const g of layout.glyphs) {
    if (g.char === ' ' || g.char === '-') continue;
    // Advance box is already horizontalScale-wide; facePullX fattens past it.
    const hw = (g.width * pullX) / 2;
    const cx = g.x + g.width / 2;
    const local: Array<[number, number]> = [
      [cx - hw - pad, g.baselineY - ascent],
      [cx + hw + pad, g.baselineY - ascent],
      [cx - hw - pad, g.baselineY + descent],
      [cx + hw + pad, g.baselineY + descent],
    ];
    for (const [x, y] of local) {
      const p = applyPaintTransform(
        x,
        y,
        layout.paintPivotX,
        layout.paintPivotY,
        layout.paintScaleX,
        layout.paintScaleY,
        PAINT_LEAN,
      );
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Fit billboard bulk to the paper. X uses face bounds (extrusion may soft-clip
 * into the left pad); Y uses full face+extrusion bounds. Axes are independent
 * so vertical overflow does not re-compress a width-filled word.
 */
export function fitLetterPaintScale(args: {
  glyphs: GlyphLayout[];
  nameFontSize: number;
  extrusionSteps: number;
  extrusionDx: number;
  extrusionDy: number;
  outlineWidth: number;
  frame: Bounds;
  pivotX: number;
  pivotY: number;
  facePullY?: number;
  facePullX?: number;
  archAmount?: number;
  desiredScaleX?: number;
  desiredScaleY?: number;
  lean?: typeof PAINT_LEAN;
}): { scaleX: number; scaleY: number; fit: number } {
  const desiredScaleX = args.desiredScaleX ?? DESIRED_PAINT_SCALE_X;
  const desiredScaleY = args.desiredScaleY ?? DESIRED_PAINT_SCALE_Y;
  const facePullY = args.facePullY ?? 1;
  const facePullX = args.facePullX ?? 1;
  const archAmount = args.archAmount ?? 0;

  const trialAt = (
    scaleX: number,
    scaleY: number,
    pullX: number = facePullX,
  ): LargeLetterPostcardLayout => ({
    glyphs: args.glyphs,
    nameFontSize: args.nameFontSize,
    extrusionSteps: args.extrusionSteps,
    extrusionDx: args.extrusionDx,
    extrusionDy: args.extrusionDy,
    outlineWidth: args.outlineWidth,
    paintPivotX: args.pivotX,
    paintPivotY: args.pivotY,
    paintScaleX: scaleX,
    paintScaleY: scaleY,
    facePullX: pullX,
    facePullY,
    archAmount,
  } as LargeLetterPostcardLayout);

  let scaleX = desiredScaleX;
  let scaleY = desiredScaleY;

  // X: size to advance boxes (pullX=1) so scale can GROW; facePullX then fattens
  // into the margins. No soft-spill on the left — IJBURG "I" was clipped.
  let faces = measurePaintedFaceBounds(trialAt(1, scaleY, 1));
  const frameW = Math.max(1, args.frame.maxX - args.frame.minX);
  const faceW0 = Math.max(1, faces.maxX - faces.minX);
  scaleX = Math.min(1.35, Math.max(0.72, frameW / faceW0));
  faces = measurePaintedFaceBounds(trialAt(scaleX, scaleY));
  const paintedX = measurePaintedLetterBounds(trialAt(scaleX, scaleY));
  if (
    paintedX.minX < args.frame.minX
    || paintedX.maxX > args.frame.maxX
    || faces.minX < args.frame.minX
    || faces.maxX > args.frame.maxX
  ) {
    const spillL = Math.max(
      0,
      args.frame.minX - Math.min(paintedX.minX, faces.minX),
    );
    const spillR = Math.max(
      0,
      Math.max(paintedX.maxX, faces.maxX) - args.frame.maxX,
    );
    const boxW = Math.max(1, Math.max(paintedX.maxX, faces.maxX) - Math.min(paintedX.minX, faces.minX));
    scaleX *= Math.max(0.68, (boxW - spillL - spillR) / boxW);
  }

  // Y: size faces to the frame. TOP is hard — never soft-spill above the clip
  // (warped tops + greeting must stay fully on-card). Bottom may soft-clip shelf.
  let painted = measurePaintedFaceBounds(trialAt(scaleX, 1));
  const frameH = Math.max(1, args.frame.maxY - args.frame.minY);
  const faceH0 = Math.max(1, painted.maxY - painted.minY);
  scaleY = Math.min(1.55, Math.max(0.72, (frameH * 0.98) / faceH0));
  painted = measurePaintedLetterBounds(trialAt(scaleX, scaleY));
  if (painted.minY < args.frame.minY || painted.maxY > args.frame.maxY + 28) {
    const spillT = Math.max(0, args.frame.minY - painted.minY);
    const spillB = Math.max(0, painted.maxY - (args.frame.maxY + 28));
    const boxH = Math.max(1, painted.maxY - painted.minY);
    scaleY *= Math.max(0.7, (boxH - spillT - spillB) / boxH);
  }

  for (let i = 0; i < 12; i++) {
    faces = measurePaintedFaceBounds(trialAt(scaleX, scaleY));
    painted = measurePaintedLetterBounds(trialAt(scaleX, scaleY));
    let changed = false;
    const fillX = (faces.maxX - faces.minX) / frameW;
    const fillY = (faces.maxY - faces.minY) / frameH;
    if (fillX < 0.94 && scaleX < 1.4
      && faces.minX >= args.frame.minX - 10
      && faces.maxX <= args.frame.maxX + 10) {
      scaleX = Math.min(1.4, scaleX * (0.97 / Math.max(0.5, fillX)));
      changed = true;
    }
    if (fillY < 0.96 && scaleY < 1.55
      && faces.minY >= args.frame.minY + 1
      && faces.maxY <= args.frame.maxY + 8) {
      scaleY = Math.min(1.55, scaleY * (0.98 / Math.max(0.5, fillY)));
      changed = true;
    }
    if (faces.minX < args.frame.minX - 10 || faces.maxX > args.frame.maxX + 10) {
      scaleX *= 0.98;
      changed = true;
    }
    if (painted.minX < args.frame.minX - 14 || painted.maxX > args.frame.maxX + 24) {
      scaleX *= 0.98;
      changed = true;
    }
    // Hard top: any intrusion above the frame shrinks Y (no soft allowance).
    if (painted.minY < args.frame.minY || faces.minY < args.frame.minY) {
      scaleY *= 0.96;
      changed = true;
    }
    if (painted.maxY > args.frame.maxY + 32) {
      scaleY *= 0.97;
      changed = true;
    }
    // Prefer filling the pocket once tops are safe.
    if (painted.minY >= args.frame.minY + 2 && fillY < 0.9 && scaleY < 1.45) {
      scaleY = Math.min(1.45, scaleY * 1.03);
      changed = true;
    }
    scaleX = Math.min(1.4, Math.max(0.72, scaleX));
    scaleY = Math.max(0.7, Math.min(1.55, scaleY));
    if (!changed) break;
  }

  const fit = Math.min(scaleX / Math.max(0.01, desiredScaleX), scaleY / Math.max(0.01, desiredScaleY));
  return { scaleX, scaleY, fit };
}

export interface LargeLetterPostcardProps {
  name: string;
  cityName?: string;
  provinceCaption?: string;
  greeting?: string;
  imageCount?: number;
  width?: number;
  height?: number;
  /** Gallery style preset id, or a full style object. Defaults to linen-arch. */
  style?: PostcardStyleId | PostcardStyle;
}

export interface GlyphLayout {
  char: string;
  /** Left edge of the glyph advance box. */
  x: number;
  width: number;
  baselineY: number;
  /** CircleType/Arctext-style rotation (radians); 0 = upright. */
  tiltRad: number;
  /** Per-glyph horizontal face scale (two-line: each line fills the band). */
  scaleX?: number;
}

export interface LargeLetterPostcardLayout {
  width: number;
  height: number;
  style: PostcardStyle;
  greeting: string;
  greetingFont: string;
  greetingX: number;
  greetingY: number;
  /** Dynamic script tilt (deg) — follows local wave/rise slope. */
  greetingTiltDeg: number;
  nameLines: string[];
  nameFontSize: number;
  nameFont: string;
  horizontalScale: number;
  letterBand: { x: number; y: number; width: number; height: number };
  /** Flat baseline for the first line (path is applied per glyph). */
  nameBaselineYs: number[];
  /** Per-glyph boxes for the primary (first) line — drives photo strips + path. */
  glyphs: GlyphLayout[];
  extrusionSteps: number;
  extrusionDx: number;
  extrusionDy: number;
  outlineWidth: number;
  /** Peak path amplitude in px (arch height or rise climb). */
  archAmount: number;
  caption: string;
  captionY: number;
  imageStripCount: number;
  fallbackFill: string;
  outlineFill: string;
  paperTop: string;
  paperBottom: string;
  borderInset: number;
  /** Paint bulk after lean — fit so the word stays on-card. */
  paintScaleX: number;
  paintScaleY: number;
  paintPivotX: number;
  paintPivotY: number;
  /** Fraction of desired billboard bulk kept after fit-to-frame (1 = full). */
  paintFit: number;
  /** Extra horizontal pull on glyph faces before photo fill (1 = none). */
  facePullX: number;
  /** Extra vertical pull on glyph faces before photo fill (1 = none). */
  facePullY: number;
  /**
   * When true, baselines stay flat and arch is applied by warping glyph
   * outlines (opentype paths). fillText fallback still uses mild layout arch.
   */
  pathWarp: boolean;
}

type CanvasCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function nameFontAt(size: number): string {
  return `800 ${size}px ${NAME_FONT_FAMILY}`;
}

function greetingFontAt(size: number): string {
  return `400 ${size}px ${GREETING_FONT_FAMILY}`;
}

function trackingPx(fontSize: number): number {
  return fontSize * TRACKING_EM;
}

/**
 * Soft hyphenation for place names. No hyphenation library in-repo — this is a
 * small curated + heuristic splitter for postcard two-line breaks.
 *
 * Priority: existing hyphen → space → known Dutch/English compounds →
 * vowel-boundary soft hyphen near the middle → hard bisect.
 */
const PLACE_HYPHEN_BREAKS: ReadonlyArray<readonly [string, string]> = [
  ['GRACHTEN', 'GORDEL'],
  ['SLOTDIJK', 'CENTRUM'],
  ['BIJLMER', 'MEER'],
  ['OUD', 'WEST'],
  ['OUD', 'ZUID'],
  ['NIEUW', 'WEST'],
  ['NIEUW', 'ZUID'],
  ['AMSTERDAM', 'NOORD'],
  ['AMSTERDAM', 'OOST'],
  ['AMSTERDAM', 'WEST'],
  ['AMSTERDAM', 'ZUID'],
  ['WATER', 'GRAAFS'],
  ['WATER', 'GRAAFSMEER'],
  ['IJ', 'BURG'],
  ['SPAARNDAM', 'MER'],
  ['HAARLEM', 'MER'],
  ['ZUIDER', 'ZEE'],
  ['NOORDER', 'EILAND'],
  ['WESTER', 'PARK'],
  ['OOSTER', 'PARK'],
  ['MUSEUM', 'KWARTIER'],
  ['PLANTAGE', 'BUURT'],
  ['INDISCHE', 'BUURT'],
  ['JODEN', 'BUURT'],
];

function softHyphenBreak(token: string): [string, string] | null {
  const upper = token.toUpperCase();
  for (const [a, b] of PLACE_HYPHEN_BREAKS) {
    if (upper === a + b) return [`${a}-`, b];
    if (upper.startsWith(a) && upper.slice(a.length) === b) {
      return [`${token.slice(0, a.length)}-`, token.slice(a.length)];
    }
  }
  // Vowel-boundary soft hyphen near mid (keeps both sides ≥3 letters).
  if (upper.length < 8) return null;
  const vowels = new Set('AEIOUYÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜ');
  const mid = Math.floor(upper.length / 2);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 3; i <= upper.length - 3; i++) {
    const left = upper[i - 1];
    const right = upper[i];
    // Break after a vowel before a consonant, or between double consonants.
    const ok =
      (vowels.has(left) && !vowels.has(right))
      || (!vowels.has(left) && !vowels.has(right) && left === right);
    if (!ok) continue;
    const dist = Math.abs(i - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  if (best < 0) return null;
  return [`${token.slice(0, best)}-`, token.slice(best)];
}

/** Prefer a natural break on space or hyphen; else soft-hyphen; else bisect. */
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
      // Break at the hyphen but don't paint a trailing "-" on the top line.
      return [name.slice(0, best).trim(), name.slice(best + 1).trim()];
    }
    return [name.slice(0, best).trim(), name.slice(best + 1).trim()];
  }
  const soft = softHyphenBreak(name);
  if (soft) return soft;
  return [name.slice(0, mid).trim(), name.slice(mid).trim()];
}

function measureLineWidth(text: string, font: string, fontSize: number, measure: TextMeasurer): number {
  if (!text) return 0;
  const gap = trackingPx(fontSize);
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += measure(text[i], font);
    if (i < text.length - 1) w += gap;
  }
  return w;
}

function lineWidth(lines: string[], font: string, fontSize: number, measure: TextMeasurer): number {
  return Math.max(0, ...lines.map((line) => measureLineWidth(line, font, fontSize, measure)));
}

function tryFitLines(
  lines: string[],
  bandWidth: number,
  measure: TextMeasurer,
  maxSize: number,
  minStretch: number,
): { lines: string[]; fontSize: number; horizontalScale: number } | null {
  for (let size = maxSize; size >= NAME_MIN; size -= 1) {
    const font = nameFontAt(size);
    const widest = lineWidth(lines, font, size, measure);
    if (widest <= 0) continue;
    const scale = bandWidth / widest;
    // Too wide even when compressed.
    if (scale < minStretch) continue;
    // Short lines may want scale > MAX — cap stretch; leave side margin rather than
    // rejecting the two-line billboard (DE / PIJP).
    const horizontalScale = Math.min(MAX_HORIZONTAL_STRETCH, Math.max(minStretch, scale));
    if (widest * horizontalScale > bandWidth * 1.02) continue;
    return { lines, fontSize: size, horizontalScale };
  }
  return null;
}

/**
 * Manual stretch/fit: prefer two lines for spaced / long names (hyphenate),
 * then maximize letter height while stretching each line to fill the band.
 * Letters stay discrete — horizontalScale widens advances, never past them.
 */
function fitName(
  display: string,
  bandWidth: number,
  measure: TextMeasurer,
  maxSize: number,
): { lines: string[]; fontSize: number; horizontalScale: number } {
  const hasBreak = /[\s-]/.test(display);
  const isLong = display.replace(/[\s-]/g, '').length >= LONG_NAME_CHARS;
  const pair = (hasBreak || isLong) ? splitNameForTwoLines(display) : null;

  // Spaced / long names: try two-line billboard first (DE PIJP, GRACHTEN-GORDEL).
  if (pair && pair[0] && pair[1]) {
    const two = tryFitLines(pair, bandWidth, measure, maxSize, PREFERRED_MIN_STRETCH)
      ?? tryFitLines(pair, bandWidth, measure, maxSize, MIN_HORIZONTAL_SCALE);
    if (two) return two;
  }

  // Single-line fill stretch.
  const one = tryFitLines([display], bandWidth, measure, maxSize, PREFERRED_MIN_STRETCH)
    ?? tryFitLines([display], bandWidth, measure, maxSize, MIN_HORIZONTAL_SCALE);
  if (one) return one;

  // Last resort: force a split even for short unbroken tokens.
  const forced = splitNameForTwoLines(display);
  if (forced[0] && forced[1]) {
    const two = tryFitLines(forced, bandWidth, measure, maxSize, MIN_HORIZONTAL_SCALE);
    if (two) return two;
    const floorFont = nameFontAt(NAME_MIN);
    const widest = lineWidth(forced, floorFont, NAME_MIN, measure);
    if (widest > 0) {
      return {
        lines: forced,
        fontSize: NAME_MIN,
        horizontalScale: Math.min(1, bandWidth / widest),
      };
    }
  }

  const floorFont = nameFontAt(NAME_MIN);
  const single = measureLineWidth(display, floorFont, NAME_MIN, measure);
  return {
    lines: [display],
    fontSize: NAME_MIN,
    horizontalScale: single > 0 ? Math.min(1, bandWidth / single) : 1,
  };
}

function layoutGlyphs(
  text: string,
  font: string,
  fontSize: number,
  centerX: number,
  baselineY: number,
  pathAmountPx: number,
  path: PostcardStyle['path'],
  horizontalScale: number,
  measure: TextMeasurer,
  /** When true, baselines stay flat; arch is only tilt + later outline warp. */
  flatBaseline = false,
): GlyphLayout[] {
  const gap = trackingPx(fontSize);
  const total = measureLineWidth(text, font, fontSize, measure) * horizontalScale;
  const x0 = centerX - total / 2;
  let x = x0;
  const glyphs: GlyphLayout[] = [];
  const n = Math.max(1, text.length);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const rawW = measure(char, font);
    const width = rawW * horizontalScale;
    const t = text.length === 1 ? 0.5 : i / (n - 1);
    const baseline = flatBaseline
      ? baselineY
      : baselineY + baselinePathOffset(path, pathAmountPx, t);
    glyphs.push({ char, x, width, baselineY: baseline, tiltRad: 0, scaleX: horizontalScale });
    x += width + gap * horizontalScale;
  }
  // Per-letter tangent tilt fights "one plane" billboard faces. Keep upright;
  // the outline warp (or baseline offset) carries the path alone.
  if ((path === 'arch' || path === 'wave') && pathAmountPx > 0 && total > 0 && !flatBaseline) {
    const span = Math.max(1, total);
    for (const g of glyphs) {
      if (g.char === ' ' || g.char === '-') continue;
      const mid = g.x + g.width / 2;
      const t = Math.min(1, Math.max(0, (mid - x0) / span));
      g.tiltRad = 0;
      g.baselineY = baselineY + baselinePathOffset(path, pathAmountPx, t);
    }
  }
  return glyphs;
}

export function measureLargeLetterPostcard(
  props: LargeLetterPostcardProps,
  measure: TextMeasurer,
  opts?: { font?: OtFont; pathWarp?: boolean },
): LargeLetterPostcardLayout {
  const pathWarp = opts?.pathWarp !== false && !!opts?.font;
  const style = resolvePostcardStyle(props.style);
  const width = props.width ?? LARGE_LETTER_WIDTH;
  const height = props.height ?? LARGE_LETTER_HEIGHT;
  const borderInset = BORDER_INSET;
  const greeting = props.greeting ?? 'Greetings from';
  // Size is derived from the fitted billboard face (see after fitName).
  const greetingReserve = borderInset + Math.round(height * 0.055) + 6;
  const captionReserve = borderInset + 40;
  // Full usable width — short names leave a little side air (NOORD felt edge-tight).
  const usableW = width - 2 * (borderInset + FRAME_SAFE_PAD);
  const display = String(props.name || '').trim().toUpperCase() || '—';
  const letterCount = display.replace(/[^A-Z]/g, '').length;
  const bandFrac = letterCount <= 5 ? 0.90 : letterCount <= 7 ? 0.96 : 0.98;
  const bandWidth = Math.round(usableW * bandFrac);
  const padX = Math.round((width - bandWidth) / 2);
  // Billboard height first — comfort fill, not edge-to-edge.
  const nameMax = Math.min(
    Math.round(height * NAME_MAX_FRAC),
    Math.round(height * TARGET_FACE_HEIGHT_FRAC / 0.92),
    Math.round((height - greetingReserve - captionReserve) * 0.88),
  );
  const nameMeasure: TextMeasurer = opts?.font
    ? (text, font) => {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12);
      let w = 0;
      for (const ch of text) {
        w += (opts.font!.charToGlyph(ch).advanceWidth / opts.font!.unitsPerEm) * size;
      }
      return w;
    }
    : measure;
  const fittedRaw = fitName(display, bandWidth, nameMeasure, Math.max(NAME_MIN, nameMax));
  // Two-line billboards must stay shorter — OUD WEST at ~50%H/line blew the clip
  // and stacked extrusion into a mid-word seam.
  const fitted = fittedRaw.lines.length > 1
    ? {
      ...fittedRaw,
      fontSize: Math.min(
        fittedRaw.fontSize,
        Math.round(height * 0.34),
        Math.round((height - greetingReserve - captionReserve) * 0.42),
      ),
    }
    : fittedRaw;

  const lineCount = fitted.lines.length;
  // Two-line billboards nest like Atlantic City — tight stack, one plane.
  const lineGap = fitted.fontSize * (lineCount > 1 ? 0.88 : 1);
  // Stronger path when we warp outlines; two-line: top line carries the wave.
  const pathPx = fitted.fontSize * style.pathAmount * (
    pathWarp ? (lineCount > 1 ? 0.85 : 1) : (lineCount > 1 ? 0.35 : 0.45)
  );

  const sizeScale = Math.min(1.25, fitted.fontSize / 140);
  let extrusionDx = style.extrusionDx * sizeScale;
  let extrusionDy = style.extrusionDy * sizeScale;
  // Two-line: short shelf so top-line depth doesn't invade the line below.
  if (lineCount > 1) {
    extrusionDx *= 0.55;
    extrusionDy *= 0.55;
  }
  const maxDepth = height * (lineCount > 1 ? 0.07 : 0.1);
  const rawDepth = style.extrusionSteps * Math.abs(extrusionDy);
  if (rawDepth > maxDepth) {
    const f = maxDepth / rawDepth;
    extrusionDx *= f;
    extrusionDy *= f;
  }

  const letterBandHeight = Math.round(
    fitted.fontSize * lineCount * (lineCount > 1 ? 0.92 : 1.05)
      + pathPx
      + style.extrusionSteps * Math.abs(extrusionDy),
  );
  // Provisional script size — final size is derived from painted face height
  // after fit (Monterey ~20% of letter face, not of the em box).
  const greetingSizeProvisional = Math.max(20, Math.round(height * 0.065));
  // Provisional band — greeting is re-parked after paint relative to the name.
  const letterBandY = borderInset + Math.round(greetingSizeProvisional * 1.2) + 10;
  const letterBand = {
    x: padX,
    y: letterBandY,
    width: bandWidth,
    height: Math.max(letterBandHeight, Math.round(fitted.fontSize * 1.15 * lineCount)),
  };

  const firstBaseline = letterBand.y + Math.round(fitted.fontSize * 0.9);
  const nameBaselineYs = fitted.lines.map((_, i) => firstBaseline + i * lineGap);
  const idealCenterX = width / 2 - (style.extrusionSteps * extrusionDx) * 0.35;
  const glyphs: GlyphLayout[] = [];
  for (let li = 0; li < fitted.lines.length; li++) {
    const line = fitted.lines[li];
    const rawSpan = measureLineWidth(
      line,
      nameFontAt(fitted.fontSize),
      fitted.fontSize,
      nameMeasure,
    );
    // Atlantic City: each stacked line fills the band on its own (OUD as wide as WEST).
    const lineScale = lineCount > 1
      ? Math.min(
        MAX_HORIZONTAL_STRETCH,
        Math.max(PREFERRED_MIN_STRETCH, bandWidth / Math.max(1, rawSpan)),
      )
      : fitted.horizontalScale;
    const span = rawSpan * lineScale;
    const centerX = Math.min(
      padX + bandWidth - span / 2,
      Math.max(padX + span / 2, idealCenterX),
    );
    // Path-warp: flat baselines; shared envelope mangles outlines.
    // fillText fallback: baseline path offset.
    glyphs.push(
      ...layoutGlyphs(
        line,
        nameFontAt(fitted.fontSize),
        fitted.fontSize,
        centerX,
        nameBaselineYs[li],
        pathPx,
        style.path,
        lineScale,
        nameMeasure,
        pathWarp,
      ),
    );
  }

  const city = props.cityName || 'Amsterdam';
  const caption = props.provinceCaption
    ? `${city} · ${props.provinceCaption}`
    : city;
  const captionY = height - borderInset - 24;

  const outlineWidth = Math.min(
    5,
    Math.max(2.8, Math.round(fitted.fontSize * 0.016), style.outlineWidth * 0.85),
  );
  const greetingBand = borderInset + Math.round(height * (lineCount > 1 ? 0.12 : GREETING_BAND_FRAC));
  const frame: Bounds = {
    minX: borderInset + FRAME_SAFE_PAD + SIDE_INK_CLEAR,
    // Greeting nests into crests — only a small paper-safe band above the word.
    minY: greetingBand + (lineCount > 1 ? 14 : 8),
    maxX: width - borderInset - FRAME_SAFE_PAD - SIDE_INK_CLEAR,
    // Keep caption/bike, but don't leave a dead linen void under the word.
    maxY: captionY - 8,
  };
  // Vertical pull — comfort band; two-line already has stacked mass.
  const naturalFaceH = fitted.fontSize * 0.94 * (lineCount > 1 ? lineCount * 0.82 : 1);
  const targetFaceH = Math.max(
    height * (lineCount > 1 ? TARGET_FACE_HEIGHT_FRAC * 0.92 : TARGET_FACE_HEIGHT_FRAC),
    (frame.maxY - frame.minY) * (lineCount > 1 ? 0.58 : 0.72)
      - style.extrusionSteps * Math.abs(extrusionDy) * 0.12,
  );
  const facePullY = Math.min(
    lineCount > 1 ? 1.4 : MAX_FACE_PULL_Y,
    Math.max(1.35, targetFaceH / Math.max(1, naturalFaceH)),
  );
  const facePullX = 1;

  // Re-anchor baselines so pulled faces sit in the vertical frame (not above it).
  // Otherwise paintScaleY collapses the billboard to keep tops on-card.
  {
    const ascent = fitted.fontSize * 0.72 * facePullY;
    const descent = fitted.fontSize * 0.14 * facePullY;
    let faceMin = Infinity;
    let faceMax = -Infinity;
    for (const g of glyphs) {
      if (g.char === ' ' || g.char === '-') continue;
      faceMin = Math.min(faceMin, g.baselineY - ascent);
      faceMax = Math.max(faceMax, g.baselineY + descent);
    }
    const extrudePad = style.extrusionSteps * Math.abs(extrusionDy) * 0.55;
    const wantTop = frame.minY + 2;
    const wantBottom = frame.maxY - extrudePad;
    const wantH = Math.max(1, wantBottom - wantTop);
    const haveH = Math.max(1, faceMax - faceMin);
    // Center in the pocket — top-align was parking a short word over a linen void.
    const targetTop = wantTop + (wantH - haveH) / 2;
    const dy = targetTop - faceMin;
    if (Math.abs(dy) > 0.5) {
      for (const g of glyphs) g.baselineY += dy;
      for (let i = 0; i < nameBaselineYs.length; i++) nameBaselineYs[i] += dy;
      letterBand.y += dy;
    }
  }

  const paintPivotX = width / 2;
  const paintPivotY = (() => {
    const ascent = fitted.fontSize * 0.72 * facePullY;
    const descent = fitted.fontSize * 0.14 * facePullY;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const g of glyphs) {
      if (g.char === ' ' || g.char === '-') continue;
      minY = Math.min(minY, g.baselineY - ascent);
      maxY = Math.max(maxY, g.baselineY + descent);
    }
    return (minY + maxY) / 2;
  })();

  const paint = fitLetterPaintScale({
    glyphs,
    nameFontSize: fitted.fontSize,
    extrusionSteps: style.extrusionSteps,
    extrusionDx,
    extrusionDy,
    outlineWidth,
    frame,
    pivotX: paintPivotX,
    pivotY: paintPivotY,
    facePullX,
    facePullY,
    archAmount: pathPx,
  });

  // Hit-test grow: expand paintScaleY until face AABB kisses the frame.
  // Do NOT settle the block into bottom void — that left empty top air.
  let scaleX = paint.scaleX;
  let scaleY = paint.scaleY;
  {
    const trial = (sx: number, sy: number): LargeLetterPostcardLayout => ({
      glyphs,
      nameFontSize: fitted.fontSize,
      extrusionSteps: style.extrusionSteps,
      extrusionDx,
      extrusionDy,
      outlineWidth,
      paintPivotX,
      paintPivotY,
      paintScaleX: sx,
      paintScaleY: sy,
      facePullX,
      facePullY,
      archAmount: pathPx,
    } as LargeLetterPostcardLayout);

    // If tops breach, shift down just enough (clip fix only).
    {
      const painted0 = measurePaintedLetterBounds(trial(scaleX, scaleY));
      const topBreach = Math.max(0, frame.minY - painted0.minY);
      if (topBreach > 0.5) {
        for (const g of glyphs) g.baselineY += topBreach;
        for (let i = 0; i < nameBaselineYs.length; i++) nameBaselineYs[i] += topBreach;
        letterBand.y += topBreach;
      }
    }

    // Binary-search max sy that keeps faces inside the frame — capped by comfort fill.
    // Keep sy near sx so vertical pull (facePullY) isn't pancakes by paintScale.
    let lo = scaleY;
    let hi = Math.min(1.45, Math.max(scaleY * 1.35, scaleX * 1.05));
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      const faces = measurePaintedFaceBounds(trial(scaleX, mid));
      const fill = (faces.maxY - faces.minY) / height;
      const ok = faces.minY >= frame.minY - 0.5
        && faces.maxY <= frame.maxY + 4
        && faces.minX >= frame.minX - 8
        && faces.maxX <= frame.maxX + 8
        && fill <= MAX_FACE_FILL_FRAC;
      if (ok) lo = mid;
      else hi = mid;
    }
    scaleY = lo;
    // If Y had to shrink hard, pull X with it (keep billboard proportions).
    if (scaleY < scaleX * 0.94) {
      scaleX = Math.min(scaleX, Math.max(0.78, scaleY / 0.94));
    }

    // Grow toward a comfortable fill — stop before edge-to-edge (NOORD blew up).
    {
      const faces0 = measurePaintedFaceBounds(trial(scaleX, scaleY));
      const fill0 = (faces0.maxY - faces0.minY) / height;
      if (fill0 < MIN_FACE_FILL_FRAC) {
        let growLo = scaleY;
        let growHi = Math.min(1.55, Math.max(scaleY * 1.12, 1.2));
        for (let i = 0; i < 14; i++) {
          const mid = (growLo + growHi) / 2;
          const faces = measurePaintedFaceBounds(trial(scaleX, mid));
          const fill = (faces.maxY - faces.minY) / height;
          const ok = faces.minY >= frame.minY - 0.5
            && faces.maxY <= frame.maxY + 2
            && faces.minX >= frame.minX - 14
            && faces.maxX <= frame.maxX + 14
            && fill <= MAX_FACE_FILL_FRAC;
          if (ok) growLo = mid;
          else growHi = mid;
        }
        scaleY = growLo;
      } else if (fill0 > MAX_FACE_FILL_FRAC) {
        // Shrink oversized short names back into the comfort band.
        let lo = Math.max(0.72, scaleY * (MAX_FACE_FILL_FRAC / fill0) * 0.92);
        let hi = scaleY;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          const faces = measurePaintedFaceBounds(trial(scaleX, mid));
          const fill = (faces.maxY - faces.minY) / height;
          if (fill > MAX_FACE_FILL_FRAC) hi = mid;
          else lo = mid;
        }
        scaleY = lo;
      }
    }

    // Center leftover slack; keep hard top clearance.
    {
      const faces = measurePaintedFaceBounds(trial(scaleX, scaleY));
      const slackTop = faces.minY - frame.minY;
      const slackBot = frame.maxY - faces.maxY;
      const keepTop = Math.max(TOP_INK_CLEAR, Math.min(slackTop, 20));
      let dy = slackTop - keepTop;
      // Prefer balanced air — don't dump everything into the bottom void.
      const recenter = (slackBot - (faces.minY + dy - frame.minY)) / 2;
      if (Math.abs(recenter) > 1 && Math.abs(recenter) < 48) dy += recenter * 0.65;
      const afterTop = faces.minY + dy;
      if (afterTop < borderInset + TOP_INK_CLEAR) {
        dy += (borderInset + TOP_INK_CLEAR) - afterTop;
      }
      if (Math.abs(dy) > 1) {
        for (const g of glyphs) g.baselineY += dy;
        for (let i = 0; i < nameBaselineYs.length; i++) nameBaselineYs[i] += dy;
        letterBand.y += dy;
      }
    }
  }

  let paintPivotYFinal = (() => {
    const ascent = fitted.fontSize * 0.72 * facePullY;
    const descent = fitted.fontSize * 0.14 * facePullY;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const g of glyphs) {
      if (g.char === ' ' || g.char === '-') continue;
      minY = Math.min(minY, g.baselineY - ascent);
      maxY = Math.max(maxY, g.baselineY + descent);
    }
    return (minY + maxY) / 2;
  })();
  const paintFinal = fitLetterPaintScale({
    glyphs,
    nameFontSize: fitted.fontSize,
    extrusionSteps: style.extrusionSteps,
    extrusionDx,
    extrusionDy,
    outlineWidth,
    frame,
    pivotX: paintPivotX,
    pivotY: paintPivotYFinal,
    facePullX,
    facePullY,
    archAmount: pathPx,
    desiredScaleX: scaleX,
    desiredScaleY: scaleY,
  });
  // Comfort-band sy is authoritative — second fit may only shrink for clip safety.
  let finalScaleY = Math.min(scaleY, paintFinal.scaleY);
  let finalScaleX = Math.min(scaleX, Math.max(paintFinal.scaleX, scaleX * 0.96));
  // Don't re-inflate to the paper edges (IJBURG "I" / short names).
  finalScaleX = Math.min(finalScaleX, letterCount <= 6 ? 1.12 : 1.18);
  // Preserve vertical stretch — crushing Y alone (sy≈0.77, sx≈1) made IJBURG squat.
  // Prefer matching X down with Y over pancake letters.
  if (finalScaleY < finalScaleX * 0.94) {
    finalScaleX = Math.min(finalScaleX, Math.max(0.78, finalScaleY / 0.94));
  }
  // Floor sy so facePullY remains the vertical stretch, not a post-squash.
  if (finalScaleY < 0.92) {
    const lift = Math.min(1.02, Math.max(finalScaleY, finalScaleX * 0.97, 0.92));
    finalScaleY = lift;
    if (finalScaleX > finalScaleY / 0.94) {
      finalScaleX = finalScaleY / 0.94;
    }
  }

  const trialLayout = (
    sx: number,
    sy: number,
    pivotY: number = paintPivotYFinal,
  ): LargeLetterPostcardLayout => ({
    glyphs,
    nameFontSize: fitted.fontSize,
    extrusionSteps: style.extrusionSteps,
    extrusionDx,
    extrusionDy,
    outlineWidth,
    paintPivotX,
    paintPivotY: pivotY,
    paintScaleX: sx,
    paintScaleY: sy,
    facePullX,
    facePullY,
    archAmount: pathPx,
  } as LargeLetterPostcardLayout);

  // Re-enforce fill/comfort after the sy floor (it can overshoot the band).
  {
    for (let i = 0; i < 10; i++) {
      const faces = measurePaintedFaceBounds(trialLayout(finalScaleX, finalScaleY));
      const painted = measurePaintedLetterBounds(trialLayout(finalScaleX, finalScaleY));
      const fill = (faces.maxY - faces.minY) / height;
      const bottomSpill = painted.maxY - (height - borderInset - 6);
      let factor = 1;
      if (fill > MAX_FACE_FILL_FRAC) factor = Math.min(factor, MAX_FACE_FILL_FRAC / fill);
      if (bottomSpill > 0) {
        factor = Math.min(
          factor,
          Math.max(0.82, (faces.maxY - faces.minY - bottomSpill) / Math.max(1, faces.maxY - faces.minY)),
        );
      }
      if (faces.minY < borderInset + TOP_INK_CLEAR) {
        const dy = borderInset + TOP_INK_CLEAR - faces.minY;
        for (const g of glyphs) g.baselineY += dy;
        for (let j = 0; j < nameBaselineYs.length; j++) nameBaselineYs[j] += dy;
        letterBand.y += dy;
        paintPivotYFinal += dy;
      }
      if (factor >= 0.995) break;
      finalScaleY *= factor;
      finalScaleX *= factor;
    }
    // Keep proportions after the fill trim.
    if (finalScaleY < finalScaleX * 0.94) {
      finalScaleX = Math.min(finalScaleX, Math.max(0.78, finalScaleY / 0.94));
    }
  }

  // Hard on-card clearance: left shelf + crest must stay inside the paper.
  {
    for (let pass = 0; pass < 8; pass++) {
      const painted = measurePaintedLetterBounds(trialLayout(finalScaleX, finalScaleY));
      const faces = measurePaintedFaceBounds(trialLayout(finalScaleX, finalScaleY));
      const leftEdge = Math.min(painted.minX, faces.minX) - outlineWidth * 0.35;
      const rightEdge = Math.max(painted.maxX, faces.maxX) + outlineWidth * 0.35;
      const topEdge = Math.min(painted.minY, faces.minY) - outlineWidth * 0.5;
      const leftNeed = borderInset + SIDE_INK_CLEAR;
      const rightNeed = width - borderInset - SIDE_INK_CLEAR;
      const topNeed = borderInset + TOP_INK_CLEAR
        + Math.round(height * (lineCount > 1 ? 0.06 : 0.02));
      let moved = false;
      if (leftEdge < leftNeed) {
        const dx = leftNeed - leftEdge;
        for (const g of glyphs) g.x += dx;
        moved = true;
      }
      if (rightEdge > rightNeed) {
        finalScaleX *= Math.max(0.72, (rightNeed - leftNeed) / Math.max(1, rightEdge - leftEdge));
        // Keep vertical stretch in lockstep when width has to give.
        if (finalScaleY > finalScaleX / 0.94) {
          finalScaleY = Math.min(finalScaleY, finalScaleX / 0.94);
        }
        moved = true;
      }
      if (topEdge < topNeed) {
        const dy = topNeed - topEdge;
        for (const g of glyphs) g.baselineY += dy;
        for (let i = 0; i < nameBaselineYs.length; i++) nameBaselineYs[i] += dy;
        letterBand.y += dy;
        // Prefer shifting over squashing — only scale if we run out of bottom.
        const after = measurePaintedLetterBounds(trialLayout(finalScaleX, finalScaleY));
        if (after.maxY > frame.maxY + 24) {
          const factor = Math.max(
            0.82,
            (frame.maxY + 24 - topNeed) / Math.max(1, after.maxY - after.minY),
          );
          finalScaleY *= factor;
          finalScaleX = Math.min(finalScaleX, Math.max(0.78, finalScaleY / 0.94));
        }
        moved = true;
      }
      if (!moved) break;
    }
    // Recompute pivot after shifts.
    {
      const ascent = fitted.fontSize * 0.72 * facePullY;
      const descent = fitted.fontSize * 0.14 * facePullY;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const g of glyphs) {
        if (g.char === ' ' || g.char === '-') continue;
        minY = Math.min(minY, g.baselineY - ascent);
        maxY = Math.max(maxY, g.baselineY + descent);
      }
      paintPivotYFinal = (minY + maxY) / 2;
    }
  }

  const finalFit = Math.min(
    1.05,
    Math.min(
      finalScaleX / Math.max(0.01, scaleX),
      finalScaleY / Math.max(0.01, scaleY),
    ),
  );

  // Park "Greetings from" in the best arch pocket relative to the painted
  // name — left by default (Monterey), shifting when headroom is tighter.
  let greetingPlace = placeGreetingAboveName({
    greeting,
    glyphs,
    nameFontSize: fitted.fontSize,
    facePullY,
    paintPivotX,
    paintPivotY: paintPivotYFinal,
    paintScaleX: finalScaleX,
    paintScaleY: finalScaleY,
    archAmount: pathPx,
    outlineWidth,
    extrusionSteps: style.extrusionSteps,
    extrusionDx,
    extrusionDy,
    borderInset,
    width,
    height,
    path: style.path,
    styleTiltDeg: style.greetingTiltDeg,
    nameBaselineYs,
  });
  // Waterloo nest: script may overlap left crests. Only keep loops on-paper.
  {
    const gTop = estimateGreetingTop(
      greetingPlace.greetingX,
      greetingPlace.greetingY,
      greetingPlace.greetingSize,
      greetingPlace.greetingTiltDeg,
      greeting.length,
    );
    if (gTop < borderInset + 4) {
      greetingPlace = {
        ...greetingPlace,
        greetingY: greetingPlace.greetingY + (borderInset + 4 - gTop),
      };
    }
  }
  const greetingSize = greetingPlace.greetingSize;
  const greetingFont = greetingFontAt(greetingSize);
  const greetingX = greetingPlace.greetingX;
  const greetingY = greetingPlace.greetingY;
  const greetingTiltDeg = greetingPlace.greetingTiltDeg;

  // Tuck caption under the letter faces — no orphan footer across a linen desert.
  const facesForCaption = measurePaintedFaceBounds({
    glyphs,
    nameFontSize: fitted.fontSize,
    extrusionSteps: style.extrusionSteps,
    extrusionDx,
    extrusionDy,
    outlineWidth,
    paintPivotX,
    paintPivotY: paintPivotYFinal,
    paintScaleX: finalScaleX,
    paintScaleY: finalScaleY,
    facePullX,
    facePullY,
    archAmount: pathPx,
  } as LargeLetterPostcardLayout);
  const captionYFinal = Math.min(
    height - borderInset - 28,
    Math.max(facesForCaption.maxY + 30, height - borderInset - 36),
  );

  return {
    width,
    height,
    style,
    greeting,
    greetingFont,
    greetingX,
    greetingY,
    greetingTiltDeg,
    nameLines: fitted.lines,
    nameFontSize: fitted.fontSize,
    nameFont: nameFontAt(fitted.fontSize),
    horizontalScale: fitted.horizontalScale,
    letterBand,
    nameBaselineYs,
    glyphs,
    extrusionSteps: style.extrusionSteps,
    extrusionDx,
    extrusionDy,
    outlineWidth,
    archAmount: pathPx,
    caption,
    captionY: captionYFinal,
    imageStripCount: Math.max(0, Math.floor(props.imageCount ?? 0)),
    fallbackFill: style.fallbackFill,
    outlineFill: style.outlineFill,
    paperTop: style.paperTop,
    paperBottom: style.paperBottom,
    borderInset,
    paintScaleX: finalScaleX,
    paintScaleY: finalScaleY,
    paintPivotX,
    paintPivotY: paintPivotYFinal,
    paintFit: finalFit,
    facePullX,
    facePullY,
    pathWarp,
  };
}

function makeLayer(width: number, height: number): { canvas: CanvasImageSource; ctx: CanvasCtx } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    return { canvas, ctx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { canvas, ctx };
}

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

/** Active outline font for path-warp paint (set for the duration of a draw call). */
let paintOtFont: OtFont | null = null;

function rowFlatBaseline(layout: LargeLetterPostcardLayout, g: GlyphLayout): number {
  return layout.nameBaselineYs.find(
    (y) => Math.abs(y - g.baselineY) < layout.nameFontSize * 0.55,
  ) ?? g.baselineY;
}

function lineArchEnvelope(
  layout: LargeLetterPostcardLayout,
  g: GlyphLayout,
): ArchEnvelope | null {
  if (!layout.pathWarp || layout.archAmount <= 0) return null;
  const flatY = rowFlatBaseline(layout, g);
  const letters = layout.glyphs.filter((x) => x.char !== ' ' && x.char !== '-');
  if (letters.length === 0) return null;
  // Shared x-span so stacked lines stay on one billboard plane.
  // Atlantic City: top line carries the path; line 2 stays flat (same plane).
  const lineIdx = layout.nameBaselineYs.length <= 1
    ? 0
    : layout.nameBaselineYs.reduce((best, y, i) => (
      Math.abs(y - flatY) < Math.abs(layout.nameBaselineYs[best] - flatY) ? i : best
    ), 0);
  const archScale = lineIdx > 0 ? 0 : 1;
  return {
    x0: Math.min(...letters.map((x) => x.x)),
    x1: Math.max(...letters.map((x) => x.x + x.width)),
    baselineY: flatY,
    archPx: layout.archAmount * archScale,
    pullY: 1,
    pullX: 1,
    path: layout.style.path,
  };
}

type GlyphPaint = (mode: 'text' | 'path', path?: Path2D) => void;

/**
 * Draw one glyph. With opentype: Bézier outlines + csswarp-style arch envelope.
 * Without: CircleType/Arctext tilt + fillText.
 */
function withGlyphFace(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  g: GlyphLayout,
  offsetX: number,
  offsetY: number,
  paint: GlyphPaint,
): void {
  const sx = g.scaleX ?? layout.horizontalScale;
  const sy = layout.facePullY;
  const font = paintOtFont;

  if (font && g.char !== ' ' && g.char !== '-') {
    const raw = font.getPath(g.char, 0, 0, layout.nameFontSize);
    type Cmd = {
      type: string;
      x?: number;
      y?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
    };
    const placed: Cmd[] = raw.commands.map((c) => {
      const map = (x: number, y: number) => ({
        x: g.x + offsetX + x * sx,
        y: g.baselineY + offsetY + y * sy,
      });
      const out: Cmd = { type: c.type };
      if (c.type === 'Z') return out;
      if (c.x1 != null && c.y1 != null) {
        const p = map(c.x1, c.y1);
        out.x1 = p.x;
        out.y1 = p.y;
      }
      if (c.x2 != null && c.y2 != null) {
        const p = map(c.x2, c.y2);
        out.x2 = p.x;
        out.y2 = p.y;
      }
      if (c.x != null && c.y != null) {
        const p = map(c.x, c.y);
        out.x = p.x;
        out.y = p.y;
      }
      return out;
    });
    const env = lineArchEnvelope(layout, g);
    const cmds = env ? warpPathCommands(placed, env) : placed;
    paint('path', pathCommandsToPath2D(cmds));
    return;
  }

  ctx.save();
  const cx = g.x + g.width / 2 + offsetX;
  const cy = g.baselineY + offsetY;
  ctx.translate(cx, cy);
  if (g.tiltRad) ctx.rotate(g.tiltRad);
  ctx.scale(sx, sy);
  ctx.translate(-(g.width / (2 * Math.max(0.01, sx))), 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  paint('text');
  ctx.restore();
}

function paintGlyphFill(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  g: GlyphLayout,
  offsetX = 0,
  offsetY = 0,
): void {
  withGlyphFace(ctx, layout, g, offsetX, offsetY, (mode, path) => {
    if (mode === 'path' && path) ctx.fill(path);
    else ctx.fillText(g.char, 0, 0);
  });
}

function paintGlyphStroke(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  g: GlyphLayout,
  offsetX = 0,
  offsetY = 0,
): void {
  const baseLw = ctx.lineWidth || 1;
  const sx = g.scaleX ?? layout.horizontalScale;
  const sy = layout.facePullY;
  withGlyphFace(ctx, layout, g, offsetX, offsetY, (mode, path) => {
    ctx.lineWidth = baseLw / Math.max(0.5, Math.min(sx, sy));
    if (mode === 'path' && path) ctx.stroke(path);
    else ctx.strokeText(g.char, 0, 0);
  });
}

/** Draw each glyph at its arched baseline. */
function fillGlyphs(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  offsetX = 0,
  offsetY = 0,
): void {
  ctx.font = layout.nameFont;
  for (const g of layout.glyphs) {
    if (g.char === ' ' || g.char === '-') continue;
    paintGlyphFill(ctx, layout, g, offsetX, offsetY);
  }
}

function strokeGlyphs(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  offsetX = 0,
  offsetY = 0,
): void {
  ctx.font = layout.nameFont;
  for (const g of layout.glyphs) {
    if (g.char === ' ' || g.char === '-') continue;
    paintGlyphStroke(ctx, layout, g, offsetX, offsetY);
  }
}

function imageSize(image: CanvasImageSource): { w: number; h: number } {
  if ('naturalWidth' in image && Number(image.naturalWidth) > 0) {
    return { w: Number(image.naturalWidth), h: Number(image.naturalHeight) };
  }
  const bmp = image as ImageBitmap | HTMLCanvasElement | OffscreenCanvas;
  return { w: Number(bmp.width), h: Number(bmp.height) };
}

function drawPaper(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  const { width: w, height: h } = layout;
  // Near full-bleed wash — linen cards aren't mounted on a fat cream mat.
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, layout.paperTop);
  wash.addColorStop(0.5, layout.style.paperMid);
  wash.addColorStop(1, layout.paperBottom);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
}

function drawFadedBackground(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  image: CanvasImageSource | null,
): void {
  const { width: w, height: h, borderInset: b, style } = layout;
  if (!image) return;
  const { w: nw, h: nh } = imageSize(image);
  if (!nw || !nh) return;
  // Full-bleed scenic wash — no inset panel that reads as a fat mat.
  const crop = coverCrop(nw, nh, w, h);
  ctx.save();
  ctx.globalAlpha = style.backdropAlpha;
  ctx.filter = 'saturate(0.52) contrast(0.86) brightness(1.06)';
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  ctx.filter = 'none';
  const veil = ctx.createLinearGradient(0, 0, 0, h);
  veil.addColorStop(0, style.veilTop);
  veil.addColorStop(0.45, style.veilMid);
  veil.addColorStop(1, style.veilBottom);
  ctx.globalAlpha = 1;
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function extrusionBandColor(
  bands: PostcardStyle['extrusionBands'],
  t: number,
  fallback: string,
): string {
  for (const band of bands) {
    if (t <= band.from && t > band.to) return band.color;
  }
  return fallback;
}

function drawGlyphExtrusion(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  g: GlyphLayout,
): void {
  if (g.char === ' ' || g.char === '-') return;
  const steps = layout.extrusionSteps;
  const dx = layout.extrusionDx;
  const dy = layout.extrusionDy;
  const bands = layout.style.extrusionBands;
  const far = extrusionBandColor(bands, 0.95, '#1a3a6b');
  const mid = extrusionBandColor(bands, 0.5, far);
  const near = extrusionBandColor(bands, 0.08, mid);
  ctx.font = layout.nameFont;

  // Soft contact shadow under the shelf (reads as print depth, not a second word).
  ctx.fillStyle = 'rgba(8,12,20,0.38)';
  paintGlyphFill(ctx, layout, g, steps * dx + 2.2, steps * dy + 3.2);

  // Solid back silhouette + two facets — a block wall, not a candy ladder.
  ctx.fillStyle = far;
  paintGlyphFill(ctx, layout, g, steps * dx, steps * dy);
  ctx.strokeStyle = layout.outlineFill;
  ctx.lineWidth = Math.max(2.2, layout.outlineWidth * 0.7);
  ctx.lineJoin = 'round';
  paintGlyphStroke(ctx, layout, g, steps * dx, steps * dy);

  ctx.fillStyle = mid;
  paintGlyphFill(ctx, layout, g, steps * dx * 0.52, steps * dy * 0.52);

  ctx.fillStyle = near;
  paintGlyphFill(ctx, layout, g, dx * 0.35, dy * 0.35);
}

function drawGlyphPhoto(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  g: GlyphLayout,
  img: CanvasImageSource | null,
  focusX: number,
  focusY: number,
): void {
  if (g.char === ' ' || g.char === '-') return;
  const { width, height } = layout;
  const gLayer = makeLayer(width, height);
  gLayer.ctx.font = layout.nameFont;
  gLayer.ctx.fillStyle = '#fff';
  paintGlyphFill(gLayer.ctx, layout, g);
  gLayer.ctx.globalCompositeOperation = 'source-in';
  if (img) {
    const { w: nw, h: nh } = imageSize(img);
    if (nw && nh) {
      gLayer.ctx.filter = 'saturate(1.78) contrast(1.4) brightness(1.12)';
      const pad = 12;
      const pullY = layout.facePullY;
      // Generous crop — short boxes left a flat photo cutoff under the crest
      // stroke after path-warp / facePull (OUD WEST).
      const bx = g.x - pad - Math.abs(layout.archAmount) * 0.35 - layout.outlineWidth;
      const bw = Math.max(
        4,
        g.width + pad * 2 + Math.abs(layout.archAmount) * 0.7 + layout.outlineWidth * 2,
      );
      const by = g.baselineY
        - layout.nameFontSize * 1.28 * pullY
        - layout.archAmount * 1.25
        - layout.outlineWidth;
      const bh = layout.nameFontSize * 1.6 * pullY
        + layout.archAmount * 1.5
        + layout.outlineWidth * 2;
      const crop = coverCropFocus(nw, nh, bw, bh, focusX, focusY);
      gLayer.ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, bx, by, bw, bh);
      gLayer.ctx.filter = 'none';
    } else {
      gLayer.ctx.fillStyle = layout.fallbackFill;
      gLayer.ctx.fillRect(0, 0, width, height);
    }
  } else {
    gLayer.ctx.fillStyle = layout.fallbackFill;
    gLayer.ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(gLayer.canvas, 0, 0);
}

function drawGlyphOutlines(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  g: GlyphLayout,
): void {
  if (g.char === ' ' || g.char === '-') return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;
  ctx.font = layout.nameFont;
  // Die-cut: dark outer + hairline white rim (Indiana / Waterloo, not a cyan tire).
  const baseBlack = Math.max(3.2, layout.outlineWidth * 1.15);
  const baseWhite = Math.max(1.15, layout.outlineWidth * 0.34);

  ctx.strokeStyle = layout.outlineFill;
  ctx.lineWidth = baseBlack;
  paintGlyphStroke(ctx, layout, g);
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = baseWhite;
  paintGlyphStroke(ctx, layout, g);
}

/**
 * Photos sit under a word-art mask. Always one window per glyph.
 * Use source-in (letters first): Chromium drops per-glyph fillText under destination-in.
 */
function drawPhotosThroughLetterOverlay(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  images: CanvasImageSource[],
): void {
  const letterGlyphs = layout.glyphs.filter((g) => g.char !== ' ' && g.char !== '-');
  let painted = 0;
  for (const g of letterGlyphs) {
    const img = images.length ? images[painted % images.length] : null;
    const focusX = letterGlyphs.length <= 1 ? 0.5 : painted / Math.max(1, letterGlyphs.length - 1);
    const focusY = 0.35 + (painted % 3) * 0.12;
    drawGlyphPhoto(ctx, layout, g, img, focusX, focusY);
    painted += 1;
  }
}

function drawOutlines(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  for (const g of layout.glyphs) drawGlyphOutlines(ctx, layout, g);
}

/** Paint each stacked line as one unit (extrusion → faces → outlines), top→bottom
 *  so a two-line billboard stays one coplanar stack — not inter-line shelf seams
 *  (OUD WEST: top extrusion was cutting halfway through WEST). */
function drawPerspectiveLetterBlock(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  images: CanvasImageSource[],
): void {
  const block = makeLayer(layout.width, layout.height);
  const letterGlyphs = layout.glyphs.filter((g) => g.char !== ' ' && g.char !== '-');
  const shelfRight = layout.extrusionDx >= 0;
  const lineYs = layout.nameBaselineYs.length
    ? layout.nameBaselineYs
    : [...new Set(letterGlyphs.map((g) => g.baselineY))];
  const lineTol = layout.nameFontSize * 0.45;

  const lines = lineYs.map((y) => letterGlyphs
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => Math.abs(g.baselineY - y) < lineTol));

  // Stable image index by original glyph order.
  const imgFor = (i: number) => (images.length ? images[i % images.length] : null);

  for (const line of lines) {
    const ordered = shelfRight ? line : [...line].reverse();
    for (const { g } of ordered) drawGlyphExtrusion(block.ctx, layout, g);
    for (const { g, i } of ordered) {
      const focusX = letterGlyphs.length <= 1 ? 0.5 : i / Math.max(1, letterGlyphs.length - 1);
      const focusY = 0.35 + (i % 3) * 0.12;
      drawGlyphPhoto(block.ctx, layout, g, imgFor(i), focusX, focusY);
      drawGlyphOutlines(block.ctx, layout, g);
    }
  }

  ctx.save();
  ctx.translate(layout.paintPivotX, layout.paintPivotY);
  ctx.transform(PAINT_LEAN.a, PAINT_LEAN.b, PAINT_LEAN.c, PAINT_LEAN.d, 0, 0);
  ctx.scale(layout.paintScaleX, layout.paintScaleY);
  ctx.translate(-layout.paintPivotX, -layout.paintPivotY);
  ctx.drawImage(block.canvas, 0, 0);
  ctx.restore();
}

/** Cover-crop with a focus point (0..1) so per-letter windows can pan. */
function coverCropFocus(
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number,
  boxHeight: number,
  focusX: number,
  focusY: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const base = coverCrop(naturalWidth, naturalHeight, boxWidth, boxHeight);
  const maxSx = Math.max(0, naturalWidth - base.sw);
  const maxSy = Math.max(0, naturalHeight - base.sh);
  return {
    sx: maxSx * Math.min(1, Math.max(0, focusX)),
    sy: maxSy * Math.min(1, Math.max(0, focusY)),
    sw: base.sw,
    sh: base.sh,
  };
}

/** Approximate top of tilted Pacifico script (canvas y, smaller = higher). */
function estimateGreetingTop(
  greetingX: number,
  greetingY: number,
  greetingSize: number,
  tiltDeg: number,
  greetingLen: number,
): number {
  const ascent = greetingSize * 1.35;
  const width = Math.max(24, greetingLen * greetingSize * 0.42);
  const rad = (tiltDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Corners of the script AABB in local space, then rotate around baseline origin.
  const corners: Array<[number, number]> = [
    [0, -ascent],
    [width * 0.35, -ascent],
    [width * 0.7, -ascent * 0.9],
    [width, -ascent * 0.75],
    [0, greetingSize * 0.15],
    [width, greetingSize * 0.2],
  ];
  let top = Infinity;
  for (const [lx, ly] of corners) {
    const y = greetingY + lx * sin + ly * cos;
    top = Math.min(top, y);
  }
  return top;
}

function placeGreetingAboveName(args: {
  greeting: string;
  glyphs: GlyphLayout[];
  nameFontSize: number;
  facePullY: number;
  paintPivotX: number;
  paintPivotY: number;
  paintScaleX: number;
  paintScaleY: number;
  archAmount: number;
  outlineWidth: number;
  extrusionSteps: number;
  extrusionDx: number;
  extrusionDy: number;
  borderInset: number;
  width: number;
  height: number;
  path: PostcardStyle['path'];
  styleTiltDeg: number;
  nameBaselineYs: number[];
}): { greetingX: number; greetingY: number; greetingSize: number; greetingTiltDeg: number } {
  const allLetters = args.glyphs.filter((g) => g.char !== ' ' && g.char !== '-');
  // Pocket against the TOP line only — never park over CENTRUM / line 2.
  const topY = args.nameBaselineYs[0] ?? allLetters[0]?.baselineY ?? 0;
  const letters = allLetters.filter(
    (g) => Math.abs(g.baselineY - topY) < args.nameFontSize * 0.45,
  );
  const layoutBase = {
    nameFontSize: args.nameFontSize,
    extrusionSteps: args.extrusionSteps,
    extrusionDx: args.extrusionDx,
    extrusionDy: args.extrusionDy,
    outlineWidth: args.outlineWidth,
    paintPivotX: args.paintPivotX,
    paintPivotY: args.paintPivotY,
    paintScaleX: args.paintScaleX,
    paintScaleY: args.paintScaleY,
    facePullX: 1,
    facePullY: args.facePullY,
    archAmount: args.archAmount,
  };

  const fallbackSize = Math.max(22, Math.min(32, Math.round(args.height * 0.07)));
  if (letters.length === 0) {
    return {
      greetingX: args.borderInset + 12,
      greetingY: args.borderInset + Math.round(fallbackSize * 1.6),
      greetingSize: fallbackSize,
      greetingTiltDeg: args.styleTiltDeg,
    };
  }

  const wordFaces = measurePaintedFaceBounds({
    ...layoutBase,
    glyphs: letters,
  } as LargeLetterPostcardLayout);
  const faceH = Math.max(48, wordFaces.maxY - wordFaces.minY);
  const greetingSize = Math.max(
    22,
    Math.min(
      34,
      Math.round(faceH * 0.18),
      Math.round(args.height * 0.075),
    ),
  );
  const scriptAscent = greetingSize * 1.3;
  const scriptWidth = args.greeting.length * greetingSize * 0.42;
  // Pacifico loops stay on-card; +4 is enough once we nest into the crest.
  const minBaseline = args.borderInset + scriptAscent + 4;

  // Left pocket of the top line — Waterloo nests into the first crests.
  const n = letters.length;
  const leftCount = Math.min(3, Math.max(2, Math.ceil(n * 0.34)));
  const cluster = letters.slice(0, leftCount);
  const faces = measurePaintedFaceBounds({
    ...layoutBase,
    glyphs: cluster,
  } as LargeLetterPostcardLayout);

  let greetingX = Math.max(args.borderInset + 8, faces.minX + greetingSize * 0.06);
  greetingX = Math.max(
    args.borderInset + 8,
    Math.min(greetingX, args.width * 0.34),
  );

  const wordX0 = letters[0].x;
  const wordX1 = letters[n - 1].x + letters[n - 1].width;
  const wordW = Math.max(1, wordX1 - wordX0);
  const t = Math.min(1, Math.max(0, (greetingX + scriptWidth * 0.35 - wordX0) / wordW));
  const dt = 0.04;
  const lift0 = pathBendLift(args.path, args.archAmount, t);
  const lift1 = pathBendLift(args.path, args.archAmount, Math.min(1, t + dt));
  const dLiftDx = ((lift1 - lift0) / dt) / wordW;
  let greetingTiltDeg = -Math.atan(dLiftDx) * (180 / Math.PI);
  if (!Number.isFinite(greetingTiltDeg)) greetingTiltDeg = args.styleTiltDeg;
  // Mild tip only — hard upward tilt clipped Pacifico off the card (IJBURG).
  greetingTiltDeg = Math.max(
    -7,
    Math.min(-1.5, greetingTiltDeg * 0.7 + args.styleTiltDeg * 0.15),
  );

  // Nest onto the left crest (Waterloo) — baseline sits in the letter tops.
  const nestBaseline = faces.minY + greetingSize * 0.24;
  let greetingY = Math.max(minBaseline, nestBaseline);
  let top = estimateGreetingTop(greetingX, greetingY, greetingSize, greetingTiltDeg, args.greeting.length);
  if (top < args.borderInset + 4) {
    greetingY += (args.borderInset + 4) - top;
    greetingTiltDeg = Math.max(-4, Math.min(-1.5, greetingTiltDeg));
  }

  return { greetingX, greetingY, greetingSize, greetingTiltDeg };
}

function drawGreetingAndCaption(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  const { style } = layout;
  // Monterey/Alaska: delicate script — thin stroke, not a fat white sticker.
  ctx.save();
  ctx.translate(layout.greetingX, layout.greetingY);
  ctx.rotate((layout.greetingTiltDeg * Math.PI) / 180);
  ctx.font = layout.greetingFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = style.greetingShadow;
  ctx.fillText(layout.greeting, 0.7, 0.7);
  ctx.strokeStyle = style.greetingShadow;
  ctx.lineWidth = 1.15;
  ctx.lineJoin = 'round';
  ctx.strokeText(layout.greeting, 0, 0);
  ctx.fillStyle = style.greetingFill;
  ctx.fillText(layout.greeting, 0, 0);
  ctx.restore();

  // Region line — heavier than the script (Monterey CALIFORNIA > Greetings).
  ctx.save();
  const capSize = Math.max(
    16,
    Math.min(
      Math.round(layout.nameFontSize * 0.22),
      Math.round(layout.width * 0.042),
    ),
  );
  ctx.font = `800 ${capSize}px ${NAME_FONT_FAMILY}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  const capX = layout.width - layout.borderInset - 16;
  const capY = layout.captionY;
  const label = layout.caption.toUpperCase();
  ctx.strokeStyle = 'rgba(20,12,4,0.85)';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.strokeText(label, capX, capY);
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(label, capX, capY);
  ctx.restore();
}

function drawDistress(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  const { width: w, height: h, borderInset: b, letterBand } = layout;
  ctx.save();
  // No rounded clip — that left cream corner mats reading as a fat border.
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // Soft vignette — keep quiet so it doesn't read as a thick frame.
  const vig = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.28, w * 0.5, h * 0.5, h * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.75, 'rgba(40,25,10,0.02)');
  vig.addColorStop(1, 'rgba(40,25,10,0.12)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Flecks near the paper edge, not over the word.
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 70; i++) {
    const x = b + ((i * 97 + 13) % (w - b * 2));
    const y = b + ((i * 57 + 29) % (h - b * 2));
    if (
      x > letterBand.x + 8
      && x < letterBand.x + letterBand.width - 8
      && y > letterBand.y
      && y < letterBand.y + letterBand.height + 24
    ) {
      continue;
    }
    const s = 1 + (i % 3);
    ctx.fillStyle = i % 5 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(30,20,10,0.45)';
    ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}

function drawLinenTexture(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  const { width: w, height: h, borderInset: b, style } = layout;
  if (style.linenGrain <= 0 && style.linenHatch <= 0) return;

  const grain = makeLayer(w, h);
  const g = grain.ctx;
  const imageData = g.createImageData(w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = i / 4;
    const v = Math.floor(Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 256);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  g.putImageData(imageData, 0, 0);

  ctx.save();
  roundRectPath(ctx, b, b, w - b * 2, h - b * 2, 6);
  ctx.clip();
  if (style.linenGrain > 0) {
    ctx.globalAlpha = style.linenGrain;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grain.canvas, 0, 0);
  }
  if (style.linenHatch > 0) {
    ctx.globalAlpha = style.linenHatch;
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 1;
    for (let y = b; y < h - b; y += 3) {
      ctx.beginPath();
      ctx.moveTo(b, y);
      ctx.lineTo(w - b, y);
      ctx.stroke();
    }
    for (let x = b; x < w - b; x += 3) {
      ctx.beginPath();
      ctx.moveTo(x, b);
      ctx.lineTo(x, h - b);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPaperBorder(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  const { width: w, height: h, borderInset: b } = layout;
  // Single hairline near the edge — Curt Teich, not a mounted mat.
  ctx.strokeStyle = 'rgba(55,40,25,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b + 0.75, b + 0.75, w - 2 * b - 1.5, h - 2 * b - 1.5);
}

function drawLinen(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  drawLinenTexture(ctx, layout);
  drawPaperBorder(ctx, layout);
}

function borderStroke(layout: LargeLetterPostcardLayout): number {
  return Math.max(2.5, layout.borderInset * 0.55);
}

function drawAmsterdamProp(ctx: CanvasCtx, layout: LargeLetterPostcardLayout): void {
  // Below the letter AABB, far-left — never under the J hook.
  const painted = measurePaintedLetterBounds(layout);
  const x = layout.borderInset + 16;
  const y = Math.min(
    layout.height - layout.borderInset - 12,
    Math.max(layout.captionY - 2, painted.maxY + 28),
  );
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(18,28,40,0.75)';
  ctx.fillStyle = 'rgba(18,28,40,0.14)';
  ctx.lineWidth = 1.9;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(26, 0, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(9, -13);
  ctx.lineTo(20, -13);
  ctx.lineTo(26, 0);
  ctx.moveTo(9, -13);
  ctx.lineTo(9, -2);
  ctx.lineTo(0, 0);
  ctx.moveTo(20, -13);
  ctx.lineTo(17, -19);
  ctx.stroke();
  ctx.restore();
}

/**
 * Paint a measured large-letter postcard.
 * `images` empty → typographic fill; one → span; many → per-glyph strips.
 * Pass `font` (opentype Archivo Black) for csswarp-style outline mangling;
 * without it, CircleType-style tilt + fillText still applies.
 */
export function drawLargeLetterPostcard(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  images: CanvasImageSource[] = [],
  opts?: { font?: OtFont },
): void {
  const prevFont = paintOtFont;
  paintOtFont = opts?.font ?? null;
  try {
    ctx.save();
    drawPaper(ctx, layout);
    drawFadedBackground(ctx, layout, images[0] ?? null);
    drawLinenTexture(ctx, layout);
    const faceImages = images.length >= 2
      ? [...images.slice(1), images[0]]
      : images;
    ctx.save();
    // Rectangular clip — rounded clip left cream corner mats that read as a fat border.
    ctx.beginPath();
    ctx.rect(
      Math.max(1, layout.borderInset - 1),
      Math.max(1, layout.borderInset - 1),
      layout.width - Math.max(2, (layout.borderInset - 1) * 2),
      layout.height - Math.max(2, (layout.borderInset - 1) * 2),
    );
    ctx.clip();
    drawPerspectiveLetterBlock(ctx, layout, faceImages);
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 1;
    const { width: w, height: h, borderInset: b } = layout;
    for (let y = b; y < h - b; y += 3) {
      ctx.beginPath();
      ctx.moveTo(b, y);
      ctx.lineTo(w - b, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    drawGreetingAndCaption(ctx, layout);
    drawAmsterdamProp(ctx, layout);
    drawDistress(ctx, layout);
    drawPaperBorder(ctx, layout);
    ctx.restore();
  } finally {
    paintOtFont = prevFont;
  }
}

/** Build just the word-art overlay (opaque card with transparent letter faces). */
export function drawWordArtOverlay(
  ctx: CanvasCtx,
  layout: LargeLetterPostcardLayout,
  opts?: { font?: OtFont },
): void {
  const prevFont = paintOtFont;
  paintOtFont = opts?.font ?? null;
  try {
    ctx.save();
    ctx.clearRect(0, 0, layout.width, layout.height);
    drawPaper(ctx, layout);
    const letterGlyphs = layout.glyphs.filter((g) => g.char !== ' ' && g.char !== '-');
    for (let i = letterGlyphs.length - 1; i >= 0; i--) {
      drawGlyphExtrusion(ctx, layout, letterGlyphs[i]);
    }
    ctx.globalCompositeOperation = 'destination-out';
    fillGlyphs(ctx, layout);
    ctx.globalCompositeOperation = 'source-over';
    drawOutlines(ctx, layout);
    drawGreetingAndCaption(ctx, layout);
    drawLinen(ctx, layout);
    drawDistress(ctx, layout);
    ctx.restore();
  } finally {
    paintOtFont = prevFont;
  }
}
