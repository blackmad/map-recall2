/**
 * Roofs under a measured front: clip 3DBAG LoD2.2 roof polygons against rectangular zones laid out along a street front
 * and cap the parts inside each zone at the zone's height, so a builder can put the roof the photo shows (a slate slope
 * behind a parapet, a tiled roof behind a cornice) on top without a 3DBAG block standing above the measured crown.
 *
 * Why (2026-11-02, Binnengasthuis lane #208): the Oudemanhuispoort block on the Kloveniersburgwal is one BAG pand whose
 * 3DBAG roof merges the 1927 wing's slate slope and a pitched tile roof into flat 17.6 m and 18.5 m pieces that start at
 * the front wall. Kept as they are, a closed prism under each piece draws a plain brick wall above the measured eaves where
 * the panorama shows a roof slope (the "3DBAG roof above the crown" correction). Builders so far either dropped the whole
 * shell or used it unchanged; neither can say "keep the 3DBAG rear, but the first 4 m behind this front is a roof slope
 * from 14.5 m".
 *
 * Coordinates: native plan (x east, z south), roof points [x, y, z] with y up. A front is a chord a -> b with its outward
 * normal n = (-tz, tx) (to the right of a -> b seen from above with north up); a point's front coordinates are
 * s (metres along from a) and o (metres out of the chord, positive outside). A zone covers s0 <= s <= s1 and o >= -depth.
 * Pure geometry, no three.js.
 */
export type P3 = [number, number, number];
export type Ring3 = P3[];
export type Chord = {a: [number, number]; b: [number, number]};
export type FrontZone = {chord: Chord; s0: number; s1: number; depth: number; cap: number};

type Half = {nx: number; nz: number; c: number}; // keep points with nx * x + nz * z >= c

function axes(ch: Chord) {
  const L = Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]);
  const tx = (ch.b[0] - ch.a[0]) / L, tz = (ch.b[1] - ch.a[1]) / L;
  return {L, tx, tz, nx: -tz, nz: tx};
}

/** Front coordinates (s along the chord from a, o out of it) of a plan point. */
export function frontCoords(ch: Chord, x: number, z: number): {s: number; o: number} {
  const {tx, tz, nx, nz} = axes(ch);
  const dx = x - ch.a[0], dz = z - ch.a[1];
  return {s: dx * tx + dz * tz, o: dx * nx + dz * nz};
}

/** Sutherland-Hodgman clip of a ring (any shape) to one half-plane; y is interpolated along each cut edge. */
export function clipHalf(ring: Ring3, h: Half): Ring3 {
  const out: Ring3 = [];
  const v = (p: P3) => h.nx * p[0] + h.nz * p[2] - h.c;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], vp = v(p), vq = v(q);
    if (vp >= 0) out.push(p);
    if ((vp >= 0) !== (vq >= 0)) {
      const t = vp / (vp - vq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
    }
  }
  return out;
}

const area = (r: Ring3) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[2] - q[0] * p[2]; }, 0)) / 2;

function zoneHalves(z: FrontZone): {inside: Half[]; outside: Half[][]} {
  const {tx, tz, nx, nz} = axes(z.chord), ax = z.chord.a[0], az = z.chord.a[1];
  const sAt = (s: number) => tx * ax + tz * az + s, oAt = (o: number) => nx * ax + nz * az + o;
  const sLo: Half = {nx: tx, nz: tz, c: sAt(z.s0)}, sHi: Half = {nx: -tx, nz: -tz, c: -sAt(z.s1)};
  const oIn: Half = {nx, nz, c: oAt(-z.depth)};
  return {
    inside: [sLo, sHi, oIn],
    // the complement of the zone rectangle as three disjoint strips: before s0, after s1, behind the depth line
    outside: [[{nx: -tx, nz: -tz, c: -sAt(z.s0)}], [{nx: tx, nz: tz, c: sAt(z.s1)}], [sLo, sHi, {nx: -nx, nz: -nz, c: -oAt(-z.depth)}]],
  };
}

/**
 * Splits outer roof rings (no holes) by the zones and caps each inside part at its zone's height. A ring touching no zone
 * comes back as the same array object; pieces under 0.01 m2 are dropped. Zones must not overlap.
 */
export function capRoofsUnderFronts(rings: Ring3[], zones: FrontZone[], minArea = 0.01): Ring3[] {
  let work = rings.map(r => ({r, capped: false}));
  for (const z of zones) {
    const {inside, outside} = zoneHalves(z), next: {r: Ring3; capped: boolean}[] = [];
    for (const w of work) {
      if (w.capped) { next.push(w); continue; }
      const inn = inside.reduce((r, h) => r.length ? clipHalf(r, h) : r, w.r);
      if (inn.length < 3 || area(inn) < minArea) { next.push(w); continue; }
      next.push({r: inn.map(p => [p[0], Math.min(p[1], z.cap), p[2]] as P3), capped: true});
      for (const hs of outside) {
        const piece = hs.reduce((r, h) => r.length ? clipHalf(r, h) : r, w.r);
        if (piece.length >= 3 && area(piece) >= minArea) next.push({r: piece, capped: false});
      }
    }
    work = next;
  }
  return work.map(w => w.r);
}
