/**
 * Layout of a sculpted figure group in a triangular pediment (tympanum relief): every figure is sized so its whole
 * outline stays under the raking cornice, the way a sculptor fills the field (tall standing figures at the centre,
 * seated ones further out, reclining ones in the corners).
 *
 * Why (2026-11-02, Effectenbeurs lane #201): the kit had figures (`scripts/landmarks/figure-kit.ts`) but nothing that
 * fits a group into a triangle. A builder that guesses heights per figure either pokes heads through the rake or leaves
 * the field half empty; C.A. Smout's 1924 tympanum on the Beursplein front is a sixteen-figure group from corner to
 * corner. Pure geometry, no three.js:
 *   x  across the tympanum, 0 at the apex axis, negative to the viewer's left;
 *   y  up from the top of the base (horizontal) cornice;
 * the clear field is the triangle |x| <= halfWidth, y <= rise * (1 - |x| / halfWidth), shrunk by `margin` on all sides.
 */
export type ReliefKind = 'standing' | 'seated' | 'kneeling' | 'reclining' | 'shield';

export interface ReliefSlot {
  kind: ReliefKind;
  /** Position across the field: -1 = left corner, 0 = apex axis, 1 = right corner (the figure's centre). */
  u: number;
  /** Which way the figure turns: -1 towards the viewer's left, 1 towards the right, 0 frontal. Default: towards the axis. */
  facing?: -1 | 0 | 1;
}

export interface PedimentField {
  /** Half the clear width of the tympanum at its base (m). */
  halfWidth: number;
  /** Clear height of the tympanum at the apex (m). */
  rise: number;
  /** Clearance kept from the raking and base mouldings (m). */
  margin: number;
  /** Cap on any figure's height (m), so the centre figure does not grow to the full apex height. */
  maxHeight?: number;
}

export interface PlacedRelief {
  kind: ReliefKind;
  /** Centre of the figure's footprint across the field (m). */
  x: number;
  /** Envelope height (m): the figure's top at x +- width / 2 stays under the rake. */
  height: number;
  /** Envelope width (m). */
  width: number;
  facing: -1 | 0 | 1;
}

/** Envelope width / height of each kind (a standing draped figure, a seated one, a kneeling one, a reclining one, a shield). */
export const RELIEF_ASPECT: Record<ReliefKind, number> = {standing: 0.32, seated: 0.6, kneeling: 0.55, reclining: 2.4, shield: 0.8};

/** Clear height of the field above the base at x (0 outside the field). */
export function rakeHeight(f: PedimentField, x: number): number {
  return Math.max(0, f.rise * (1 - Math.abs(x) / f.halfWidth) - f.margin);
}

/**
 * Size every slot to the largest envelope whose outer top corner stays under the rake. With the outer edge at
 * |x| + a h / 2 and the rake falling at rise / halfWidth per metre: h = (rise (1 - |x| / W) - margin) / (1 + rise a / (2 W)).
 */
export function layoutRelief(f: PedimentField, slots: ReliefSlot[]): PlacedRelief[] {
  if (!(f.halfWidth > 0 && f.rise > 0 && f.margin >= 0)) throw Error('pedimentRelief: halfWidth and rise must be > 0, margin >= 0');
  const W = f.halfWidth - f.margin, k = f.rise / f.halfWidth;
  return slots.map(s => {
    if (!(s.u >= -1 && s.u <= 1)) throw Error(`pedimentRelief: slot u ${s.u} outside [-1, 1]`);
    const a = RELIEF_ASPECT[s.kind];
    // centre as far out as asked, but the envelope may not cross the field's side edge
    let x = s.u * W;
    let h = (f.rise * (1 - Math.abs(x) / f.halfWidth) - f.margin) / (1 + k * a / 2);
    if (f.maxHeight !== undefined) h = Math.min(h, f.maxHeight);
    h = Math.max(0, h);
    const w = a * h;
    if (Math.abs(x) + w / 2 > W) x = Math.sign(x) * Math.max(0, W - w / 2);
    const facing = s.facing ?? (x === 0 ? 0 : (x < 0 ? 1 : -1));
    return {kind: s.kind, x, height: h, width: w, facing};
  });
}

/** Pairs of placed figures whose envelopes overlap by more than `allow` metres (sculpted groups touch, they do not merge). */
export function reliefOverlaps(placed: PlacedRelief[], allow = 0.15): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    const ov = Math.min(a.x + a.width / 2, b.x + b.width / 2) - Math.max(a.x - a.width / 2, b.x - b.width / 2);
    if (ov > allow) out.push([i, j]);
  }
  return out;
}
