/**
 * A round (or segmental) arch over a square-headed window whose tympanum, the field between the window head and the
 * arch, is filled (brick, stone, a carved panel) instead of glazed: the arch ring laid out as voussoirs that may
 * alternate in two materials, a keystone that may stand proud of the extrados, impost blocks at the springing and an
 * optional boss or rosette in the field.
 *
 * Why (2026-11-22, landmarks r14): several round-13 models needed this head and drew it from loose parts. Nieuwe
 * Doelenstraat 12 (F.W.M. Poggenbeek 1889-90, rijksmonument 518440; panorama TMX7316010203-000354_pano_0001_001510,
 * 2017) has over every upper window a brick relieving arch on stone springers with a carved tympanum and a stone
 * keystone; its builder approximated it with a flat stone slab, a segmental band and a disc, so the arch read as a
 * stripe and the voussoirs and imposts were missing. The motif is common on Amsterdam neo-renaissance offices and
 * schools of 1875-1905 (Publieke Werken, Springer, the Van Gendts). The kit had `archBand` (one band, one colour) and
 * `relievingArches` (segmental rowlocks over glazed heads); it could not say "a filled field under a voussoir ring".
 *
 * Pure layout, no three.js: the builder adapter is scripts/landmarks/tympanum-arch-kit.ts. Coordinates are metres in a
 * wall frame: x along the wall (0 = the window centre), y up. Nothing changes for models that do not call it.
 */
export type XY = [number, number];

export interface TympanumArchOptions {
  /** Window clear width = the arch's intrados span (m, > 0). */
  width: number;
  /** Window head height: the springing line of the arch (m). */
  head: number;
  /** `round` (semicircle, rise = width / 2) or `segmental` (rise below half the span). */
  shape?: 'round' | 'segmental';
  /** Intrados rise above the springing for a segmental arch (m, 0 < rise < width / 2). */
  rise?: number;
  /** Radial depth of the arch ring (m, > 0). */
  ring: number;
  /** Number of voussoirs including the keystone (odd, >= 3). */
  voussoirs: number;
  /** Keystone: angular share of the ring it takes (as a multiple of one voussoir, default 1) and how far it stands above the extrados (m, default 0). */
  keystone?: {scale?: number; proud?: number};
  /** Impost blocks at the springing on either side: width beyond the ring and height (m); absent = none. */
  impost?: {width: number; height: number};
  /** A round boss or rosette in the tympanum: radius (m) and its centre's height above the springing (default: middle of the field). */
  boss?: {radius: number; y?: number};
  /** Curve resolution of the tympanum outline (segments over the half circle; default 12). */
  segments?: number;
}

/** One voussoir: its outline (four or five points, counter-clockwise), whether it is the keystone, and its course class for two-material rings. */
export interface Voussoir {outline: XY[]; key: boolean; course: 0 | 1}

export interface TympanumArch {
  /** The filled field under the intrados, above the window head (closed outline, counter-clockwise). */
  tympanum: XY[];
  voussoirs: Voussoir[];
  imposts: XY[][];
  boss: {centre: XY; radius: number} | null;
  /** Circle of the intrados: centre (x, y) and radius; the extrados is radius + ring. */
  circle: {centre: XY; radius: number};
  /** Highest point of the assembly (extrados crown, or the keystone's top when it stands proud). */
  top: number;
}

/**
 * Lay out the arch. The intrados runs from (-width/2, head) to (width/2, head) through the crown at head + rise; voussoir
 * joints are radial, at equal angles, the keystone centred on the crown. Courses alternate 0/1 from the keystone outwards
 * (keystone 0), so a builder can draw stone and brick voussoirs or one material for both.
 */
export function tympanumArch(o: TympanumArchOptions): TympanumArch {
  const W = o.width, ring = o.ring, n = o.voussoirs, segs = o.segments ?? 12;
  if (!(W > 0 && ring > 0)) throw Error('tympanumArch: positive width and ring required');
  if (!(Number.isInteger(n) && n >= 3 && n % 2 === 1)) throw Error('tympanumArch: voussoirs must be an odd integer >= 3');
  const half = W / 2, shape = o.shape ?? 'round';
  const rise = shape === 'round' ? half : o.rise ?? NaN;
  if (!(rise > 0 && rise <= half)) throw Error('tympanumArch: a segmental arch needs 0 < rise <= width / 2');
  const R = (half * half + rise * rise) / (2 * rise), cy = o.head + rise - R;
  // half-angle of the arc measured from the vertical
  const phi = Math.asin(Math.min(1, half / R));
  const at = (r: number, a: number): XY => [r * Math.sin(a), cy + r * Math.cos(a)];
  // tympanum: window head chord, then the intrados from the right springing over the crown to the left
  const tympanum: XY[] = [[-half, o.head], [half, o.head]];
  for (let k = 1; k < segs; k++) tympanum.push(at(R, phi - (2 * phi * k) / segs));
  // voussoir joints: keystone `scale` voussoirs wide, the rest share the remaining angle equally
  const ks = o.keystone?.scale ?? 1, proud = o.keystone?.proud ?? 0;
  const unit = (2 * phi) / (n - 1 + ks);
  const joints: number[] = [];
  for (let k = 0; k <= (n - 1) / 2; k++) joints.push(-phi + k * unit);
  const left = joints, right = joints.map(a => -a).reverse();
  const bounds = [...left, ...right];
  const voussoirs: Voussoir[] = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const a0 = bounds[k], a1 = bounds[k + 1], key = Math.abs((a0 + a1) / 2) < 1e-9;
    const fromKey = Math.abs(k - (n - 1) / 2);
    const outer = R + ring + (key ? proud : 0);
    const outline: XY[] = [at(R, a0), at(R, a1), at(outer, a1), at(outer, a0)];
    // the intrados ends on the springing line: snap the first and last joints' inner points onto it (no sliver below the head)
    for (const p of outline) if (Math.abs(p[1] - o.head) < 1e-9) p[1] = o.head;
    voussoirs.push({outline, key, course: (fromKey % 2) as 0 | 1});
  }
  const imposts: XY[][] = [];
  if (o.impost) {
    const {width: iw, height: ih} = o.impost;
    const xIn = half, xOut = at(R + ring, phi)[0] + iw;
    for (const s of [-1, 1]) {
      const pts: XY[] = [[s * xIn, o.head - ih], [s * xOut, o.head - ih], [s * xOut, o.head], [s * xIn, o.head]];
      imposts.push(s < 0 ? pts.reverse() : pts);
    }
  }
  let boss: TympanumArch['boss'] = null;
  if (o.boss) {
    const y = o.boss.y ?? rise / 2;
    if (!(o.boss.radius > 0 && y - o.boss.radius >= 0 && y + o.boss.radius <= rise)) throw Error('tympanumArch: the boss must lie inside the tympanum');
    boss = {centre: [0, o.head + y], radius: o.boss.radius};
  }
  return {tympanum, voussoirs, imposts, boss, circle: {centre: [0, cy], radius: R}, top: cy + R + ring + proud};
}

/** Shoelace area of a closed outline (positive when counter-clockwise). */
export function outlineArea(p: XY[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
