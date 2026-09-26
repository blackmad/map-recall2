// Generative style recipes for large-letter postcards.
// Paint stays in largeLetterPostcard.ts; this file only names knobs + presets
// inspired by classic linen collecting-site variety (arch / flat / rise / palettes).

export type BaselinePath = 'flat' | 'arch' | 'rise' | 'wave';

export type PostcardStyleId =
  | 'linen-arch'
  | 'flat-block'
  | 'rise-coastal'
  | 'desert-warm';

export interface ExtrusionBand {
  color: string;
  /** Depth fraction from the back of the extrusion (1) toward the face (0). */
  from: number;
  to: number;
}

export interface PostcardStyle {
  id: PostcardStyleId;
  path: BaselinePath;
  /** Path amplitude as a fraction of font size. */
  pathAmount: number;
  extrusionSteps: number;
  extrusionDx: number;
  extrusionDy: number;
  extrusionBands: ExtrusionBand[];
  outlineWidth: number;
  outlineFill: string;
  paperTop: string;
  paperBottom: string;
  paperMid: string;
  fallbackFill: string;
  greetingFill: string;
  greetingShadow: string;
  /** Script rotation in degrees (negative = uphill to the right). */
  greetingTiltDeg: number;
  linenGrain: number;
  linenHatch: number;
  backdropAlpha: number;
  veilTop: string;
  veilMid: string;
  veilBottom: string;
}

/** Solid blue walls + orange far shelf (Indiana / Curt Teich). */
const LINEN_WALL_BANDS: ExtrusionBand[] = [
  { color: '#b45309', from: 1, to: 0.72 },
  { color: '#3d7eb3', from: 0.72, to: 0.28 },
  { color: '#24557a', from: 0.28, to: 0 },
];

/** Default — aiming at NARNIA/linen craft; depths capped by LARGE_LETTER_CRAFT.md. */
export const LINEN_ARCH: PostcardStyle = {
  id: 'linen-arch',
  // Indiana wave: smooth rise + bow. A strong 2nd harmonic zig-zagged tops
  // into a stair-step once the crest kissed the paper clip.
  path: 'wave',
  pathAmount: 0.26,
  // Few steps × large stride → ~32px wall after sizeScale (not a 9px rim).
  extrusionSteps: 8,
  extrusionDx: 1.5,
  extrusionDy: 3.2,
  extrusionBands: LINEN_WALL_BANDS,
  outlineWidth: 3.5,
  outlineFill: '#05080c',
  paperTop: '#f2ebe0',
  paperBottom: '#d9cbb4',
  paperMid: '#ebe1d2',
  fallbackFill: '#1a4a7a',
  greetingFill: '#f7fbff',
  greetingShadow: 'rgba(15,30,50,0.95)',
  greetingTiltDeg: -5,
  linenGrain: 0.12,
  linenHatch: 0.07,
  backdropAlpha: 0.16,
  veilTop: 'rgba(245,240,230,0.7)',
  veilMid: 'rgba(245,240,230,0.48)',
  veilBottom: 'rgba(220,200,170,0.66)',
};

/** Alaska / Hayward — flat baseline, deep solid navy extrusion. */
export const FLAT_BLOCK: PostcardStyle = {
  id: 'flat-block',
  path: 'flat',
  pathAmount: 0,
  extrusionSteps: 8,
  extrusionDx: -1.8,
  extrusionDy: 3.4,
  extrusionBands: [
    { color: '#1a3a6b', from: 1, to: 0.45 },
    { color: '#0f2448', from: 0.45, to: 0.15 },
    { color: '#070f1c', from: 0.15, to: 0 },
  ],
  outlineWidth: 4,
  outlineFill: '#05080e',
  paperTop: '#eef2f6',
  paperBottom: '#d5dde6',
  paperMid: '#e4eaf0',
  fallbackFill: '#16375f',
  greetingFill: '#fff8ef',
  greetingShadow: 'rgba(8,12,20,0.75)',
  greetingTiltDeg: 0,
  linenGrain: 0.09,
  linenHatch: 0.05,
  backdropAlpha: 0.18,
  veilTop: 'rgba(230,236,242,0.78)',
  veilMid: 'rgba(230,236,242,0.5)',
  veilBottom: 'rgba(200,210,222,0.68)',
};

/** Sea Bright — rising baseline, maritime blues, slight script tilt. */
export const RISE_COASTAL: PostcardStyle = {
  id: 'rise-coastal',
  // Waterloo rising slant + mild bow — keep amount modest so crest stays on-card.
  path: 'rise',
  pathAmount: 0.28,
  extrusionSteps: 8,
  extrusionDx: -1.7,
  extrusionDy: 3.3,
  extrusionBands: [
    { color: '#3a7fc4', from: 1, to: 0.5 },
    { color: '#1e4f8c', from: 0.5, to: 0.22 },
    { color: '#0c2748', from: 0.22, to: 0 },
  ],
  outlineWidth: 4,
  outlineFill: '#061018',
  paperTop: '#e8f2f8',
  paperBottom: '#c5d8e6',
  paperMid: '#d7e6f0',
  fallbackFill: '#1a5a8a',
  greetingFill: '#fffdf8',
  greetingShadow: 'rgba(8,30,50,0.7)',
  greetingTiltDeg: -4,
  linenGrain: 0.08,
  linenHatch: 0.05,
  backdropAlpha: 0.18,
  veilTop: 'rgba(186,220,238,0.62)',
  veilMid: 'rgba(210,230,242,0.36)',
  veilBottom: 'rgba(160,198,220,0.58)',
};

/** Safford / desert — warm paper, terracotta extrusion, mild arch. */
export const DESERT_WARM: PostcardStyle = {
  id: 'desert-warm',
  path: 'arch',
  pathAmount: 0.16,
  extrusionSteps: 8,
  extrusionDx: -1.5,
  extrusionDy: 2.9,
  extrusionBands: [
    { color: '#e89a3c', from: 1, to: 0.55 },
    { color: '#c46a28', from: 0.55, to: 0.3 },
    { color: '#7a3a18', from: 0.3, to: 0.1 },
    { color: '#3a1c0c', from: 0.1, to: 0 },
  ],
  outlineWidth: 3.8,
  outlineFill: '#1a0c06',
  paperTop: '#f6e6c8',
  paperBottom: '#e0c49a',
  paperMid: '#edd6b0',
  fallbackFill: '#8a4a22',
  greetingFill: '#fff6e8',
  greetingShadow: 'rgba(40,18,8,0.7)',
  greetingTiltDeg: 0,
  linenGrain: 0.13,
  linenHatch: 0.075,
  backdropAlpha: 0.16,
  veilTop: 'rgba(246,230,200,0.76)',
  veilMid: 'rgba(246,230,200,0.5)',
  veilBottom: 'rgba(220,180,130,0.66)',
};

export const POSTCARD_STYLES: Record<PostcardStyleId, PostcardStyle> = {
  'linen-arch': LINEN_ARCH,
  'flat-block': FLAT_BLOCK,
  'rise-coastal': RISE_COASTAL,
  'desert-warm': DESERT_WARM,
};

export const DEFAULT_POSTCARD_STYLE_ID: PostcardStyleId = 'linen-arch';

export function resolvePostcardStyle(
  style?: PostcardStyleId | PostcardStyle,
): PostcardStyle {
  if (!style) return LINEN_ARCH;
  if (typeof style === 'string') {
    return POSTCARD_STYLES[style] ?? LINEN_ARCH;
  }
  return style;
}

/** Baseline offset in px (negative = higher on the card). `t` is 0..1 along the word. */
export function baselinePathOffset(
  path: BaselinePath,
  pathAmountPx: number,
  t: number,
): number {
  if (pathAmountPx <= 0 || path === 'flat') return 0;
  // Positive path amount lifts (smaller y). Signs match warpPath bend.
  if (path === 'arch') return -Math.sin(Math.PI * t) * pathAmountPx;
  if (path === 'rise') {
    // Waterloo: left low → right high, plus a mild center bow.
    return -t * pathAmountPx - Math.sin(Math.PI * t) * pathAmountPx * 0.35;
  }
  // wave (Indiana): smooth rise + center bow — no harsh 2nd-harmonic zig-zag.
  return (
    -t * pathAmountPx * 0.45
    - Math.sin(Math.PI * t) * pathAmountPx * 0.55
  );
}
