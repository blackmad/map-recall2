/**
 * Flat or pitched, from a pand's own LoD2.2 roof planes (3DBAG reconstruction as Kadaster's 3D Basisvoorziening
 * publishes it on PDOK, CC BY 4.0; scripts/landmarks/kit-roof-pitch.ts reads the cached blades). Pure: no I/O.
 *
 * Why (kit review round 3, 2026-10-24, GitHub #36): the BAG tiles' `roof` code (3DBAG b3_dak_type) is 3 "slanted"
 * on 29 of the 30 reviewed holds, flat photos included (rows 301, 304: Amsterdam School fronts under flat roofs), and
 * the tiles' eaves/ridge/70th-percentile triple cannot tell a flat roof with a stair tower from a hip (row 301: ratio
 * 0.90, row 491 pitched: 0.49, row 304 flat: 0.56). The planes can: each carries its slope, azimuth and heights.
 */

/** One roof plane: its area seen from above, slope and azimuth in degrees, lowest and highest point above ground. */
export type RoofPlane = { planM2: number; slopeDeg: number; azimuthDeg: number; zMin: number; zMax: number };

/**
 * A plane at least this steep is a pitched roof face; under it a flat roof (falls of a few degrees, terraces). A roof
 * is pitched when such planes cover `pitchedShare` of it: 0.55, not a half, because row 304 (a flat parapet front over
 * a half-pitched block) reads exactly 0.50 and the pitched holds 520, 194, 341 read 0.57-0.58.
 */
export const PITCH = { minSlopeDeg: 15, pitchedShare: 0.55, flatShare: 0.25, monoShare: 0.8, azimuthTolDeg: 35 } as const;

export type RoofPitch = {
  /** Share of the roof's plan area in pitched planes. */
  pitchedShare: number;
  /** 'pitched' at or over PITCH.pitchedShare, 'flat' at or under PITCH.flatShare, 'mixed' between. */
  form: 'pitched' | 'flat' | 'mixed';
  /** Pitched area facing (within PITCH.azimuthTolDeg) one way and almost none the other: a mono-pitch (lessenaar). */
  mono: boolean;
  /** Area-weighted medians of the pitched planes' lowest (eaves) and highest (ridge) points, metres above ground: the
   *  main roof's, not a tower's spire or a porch's eaves. */
  eavesM: number | null; ridgeM: number | null;
  /** Area-weighted mean slope of the pitched planes. */
  slopeDeg: number | null;
};

const angDiff = (a: number, b: number) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };

export function roofPitch(planes: readonly RoofPlane[]): RoofPitch | null {
  const total = planes.reduce((s, p) => s + p.planM2, 0);
  if (!(total > 0)) return null;
  const pitched = planes.filter(p => p.slopeDeg >= PITCH.minSlopeDeg), area = pitched.reduce((s, p) => s + p.planM2, 0);
  const share = area / total;
  const form = share >= PITCH.pitchedShare ? 'pitched' : share <= PITCH.flatShare ? 'flat' : 'mixed';
  if (!pitched.length) return { pitchedShare: 0, form, mono: false, eavesM: null, ridgeM: null, slopeDeg: null };
  // The dominant facing: the plane azimuth that gathers the most pitched area within the tolerance.
  let best = 0, bestAz = 0;
  for (const p of pitched) {
    const near = pitched.filter(q => angDiff(q.azimuthDeg, p.azimuthDeg) <= PITCH.azimuthTolDeg).reduce((s, q) => s + q.planM2, 0);
    if (near > best) { best = near; bestAz = p.azimuthDeg; }
  }
  const opposite = pitched.filter(q => angDiff(q.azimuthDeg, bestAz + 180) <= PITCH.azimuthTolDeg).reduce((s, q) => s + q.planM2, 0);
  const mono = best / area >= PITCH.monoShare && opposite / area < 0.1;
  const median = (key: (p: RoofPlane) => number) => {
    const by = pitched.slice().sort((a, b) => key(a) - key(b));
    let acc = 0;
    for (const p of by) { acc += p.planM2; if (acc >= area / 2) return key(p); }
    return key(by[by.length - 1]);
  };
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    pitchedShare: Math.round(share * 100) / 100, form, mono, eavesM: r(median(p => p.zMin)), ridgeM: r(median(p => p.zMax)),
    slopeDeg: r(pitched.reduce((s, p) => s + p.slopeDeg * p.planM2, 0) / area),
  };
}
