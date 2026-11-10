// Ridge orientation for the register gable gate (lane H5h round 5, #351), pure: the pitched roof faces of a 3DBAG LoD2.2
// CityJSON feature, the ridge axis they imply, and the angle between an axis and a direction.
// scripts/house-specs/build-ridge-facts.ts bakes the result per pand into staging/ridge-facts.json.

/** A roof face: [area m², slope °, downhill direction ° counter-clockwise from east (RD x east, y north)]. */
export type RoofFace = [number, number, number];

/** Faces in this slope band carry the ridge direction: steeper ones are mansard skirts and dormer cheeks, flatter ones decks. */
export const RIDGE_SLOPE_MIN_DEG = 15;
export const RIDGE_SLOPE_MAX_DEG = 60;
/** At least this much pitched face, and this agreement (doubled-angle resultant), or the roof has no ridge direction. */
export const RIDGE_MIN_AREA_M2 = 8;
export const RIDGE_MIN_RESULTANT = 0.5;
/** The smaller side of a saddle carries at least this share of its pitched face area. */
export const SADDLE_MIN_SIDE_SHARE = 0.2;

/** The roof faces (slope ≥ 10°) of a 3DBAG CityJSON item, LoD2.2. */
export function roofFacesFromCityJson(source: any): RoofFace[] {
  const f = source?.feature, t = source?.metadata?.transform;
  if (!f?.vertices || !f.CityObjects || !t?.scale) return [];
  const V = f.vertices.map((v: number[]) => [v[0] * t.scale[0], v[1] * t.scale[1], v[2] * t.scale[2]]);
  const out: RoofFace[] = [];
  for (const o of Object.values<any>(f.CityObjects)) for (const g of o.geometry ?? []) {
    if (String(g.lod) !== '2.2' || !g.semantics) continue;
    const values = g.semantics.values?.[0] ?? [];
    (g.boundaries?.[0] ?? []).forEach((surface: number[][], i: number) => {
      if (g.semantics.surfaces?.[values[i]]?.type !== 'RoofSurface') return;
      const P = (surface[0] ?? []).map(k => V[k]); if (P.length < 3) return;
      let nx = 0, ny = 0, nz = 0; // Newell normal, length = 2 × area
      for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
      const len = Math.hypot(nx, ny, nz); if (!len) return;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const slope = Math.acos(nz / len) * 180 / Math.PI; if (slope < 10) return;
      out.push([Math.round(len / 2 * 10) / 10, Math.round(slope), Math.round(Math.atan2(ny, nx) * 180 / Math.PI)]);
    });
  }
  return out;
}

/** The ridge axis (radians, mod π) the pitched faces imply: perpendicular to their area-weighted doubled-angle mean
 *  downhill direction. Null for no pitched roof, or faces that disagree (a hipped pyramid, a four-sided mansard). */
export function ridgeAxis(faces: readonly RoofFace[]): { axis: number; r: number; area: number; saddle: boolean } | null {
  let c = 0, s = 0, w = 0;
  const pitched = faces.filter(([, slope]) => slope >= RIDGE_SLOPE_MIN_DEG && slope <= RIDGE_SLOPE_MAX_DEG);
  for (const [area, , dir] of pitched) {
    const th = dir * Math.PI / 180;
    c += area * Math.cos(2 * th); s += area * Math.sin(2 * th); w += area;
  }
  if (w < RIDGE_MIN_AREA_M2) return null;
  const r = Math.hypot(c, s) / w; if (r < RIDGE_MIN_RESULTANT) return null;
  const axis = (Math.atan2(s, c) / 2 + Math.PI / 2 + Math.PI) % Math.PI;
  // A saddle has pitched faces on both sides of its ridge; a lean-to (one slope, often beside a flat deck) has not, and
  // makes no gable on its end wall: its street front is a cornice or a parapet (174911).
  let a = 0, b = 0;
  for (const [area, , dir] of pitched) { if (Math.cos(dir * Math.PI / 180 - axis - Math.PI / 2) >= 0) a += area; else b += area; }
  return { axis, r: Math.round(r * 100) / 100, area: Math.round(w), saddle: Math.min(a, b) / w >= SADDLE_MIN_SIDE_SHARE };
}

/** Angle between an axis (mod π) and a direction, 0–90°. */
export const axisOff = (axis: number, dir: number): number => { let d = Math.abs(((axis - dir) % Math.PI + Math.PI) % Math.PI); if (d > Math.PI / 2) d = Math.PI - d; return d * 180 / Math.PI; };
