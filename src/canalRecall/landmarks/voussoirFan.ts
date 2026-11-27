/**
 * A sunburst of radiating stone voussoirs over an opening (Dutch neo-renaissance "zonnestralen"): long and short stone
 * blocks alternating round a segmental or round head, set in brick, each pointing at one centre below the head.
 *
 * Why (2026-11-27, landmarks r20, kweekschool-zeevaart): the Kweekschool voor de Zeevaart (Prins Hendrikkade, 1859 per BAG,
 * rijksmonument 518430) carries such a fan over every first-floor window of its 40.8 m front and its SE side (panorama
 * TMX7316010203-002370_pano_0000_000191, b_20241210_1246_Track15_Sphere_00023). Builders drew these as a flat lintel or a
 * hand loop of rotated slabs with the angles guessed inline; this says "n rays between these angles, long and short" once.
 * Pure layout, no three.js; nothing changes for models that do not call it.
 *
 * Coordinates: t along the wall (0 at the fan's centre line, negative to the viewer's left), y up; the centre of the
 * radiation sits at (0, cy). Angles in radians from the +y axis, negative to the left.
 */
export interface VoussoirFanOptions {
  /** Height of the point the rays radiate from (usually below the springing, for a flat fan). */
  cy: number;
  /** Inner radius: where every ray starts (the head of the opening). */
  r0: number;
  /** Outer radius of a long ray; short rays end at `r0 + (r1 - r0) * shortRatio`. */
  r1: number;
  /** Number of rays (odd keeps a central keystone ray). */
  count: number;
  /** Half the angle the fan spans (rad), measured from the vertical. */
  halfAngle: number;
  /** Ray width (m) at its middle. */
  width: number;
  /** Short rays as a fraction of the long ray's length (default 0.6); every other ray, the central one long. */
  shortRatio?: number;
}

export interface VoussoirRay {
  /** Centre of the ray's rectangle. */
  t: number;
  y: number;
  /** Ray length (m) and width (m). */
  length: number;
  width: number;
  /** Rotation from vertical, radians (negative leans left). */
  angle: number;
  long: boolean;
}

export function voussoirFan(o: VoussoirFanOptions): VoussoirRay[] {
  const {cy, r0, r1, count: n, halfAngle: a, width: w} = o;
  const short = o.shortRatio ?? 0.6;
  if (!(r1 > r0 && r0 >= 0 && w > 0 && a > 0 && a < Math.PI / 2)) throw Error('voussoirFan: need 0 <= r0 < r1, width > 0, 0 < halfAngle < pi/2');
  if (!(Number.isInteger(n) && n >= 2)) throw Error('voussoirFan: count must be an integer >= 2');
  if (!(short > 0 && short <= 1)) throw Error('voussoirFan: shortRatio in (0, 1]');
  const mid = (n - 1) / 2, rays: VoussoirRay[] = [];
  for (let i = 0; i < n; i++) {
    const ang = -a + (2 * a * i) / (n - 1);
    // the central ray (or the pair either side of the middle for an even count) is long; long and short alternate outward
    const long = Math.floor(Math.abs(i - mid)) % 2 === 0;
    const len = (r1 - r0) * (long ? 1 : short), rc = r0 + len / 2;
    rays.push({t: Math.sin(ang) * rc, y: cy + Math.cos(ang) * rc, length: len, width: w, angle: ang, long});
  }
  return rays;
}
