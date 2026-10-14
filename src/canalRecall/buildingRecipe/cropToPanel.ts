/**
 * Which rectified panorama crop shows which block-kit wall panel, and where along it.
 *
 * A crop (`scripts/pand-reference/all-walls.ts`) is a BAG LoD0 footprint edge `a -> b` rectified at `ppm` pixels per
 * metre: its x runs from `a` (the viewer's left, facing the wall from outside) to `b`, its outward normal is
 * `(dy, -dx) / len` (the footprint ring is made counter-clockwise first; `cropToPanel.test.ts` pins that sign on an
 * L footprint). A panel (blockBuilding/panels.ts) is a 3DBAG LoD2.2 wall plane in local metres (x east, z south,
 * around the recipe's `anchorRD`) with `r` the viewer's right. The match uses the thresholds of
 * facade/wallSurfaceMatch.ts: plan offset <= 0.5 m, angle <= 5 degrees, and here also the same facing side and an
 * along-overlap of at least 60 % of the panel's width. Replaces the old positional pairing `sources[g.index]`.
 */
import {WALL_ANGLE_TOLERANCE_DEG, WALL_OFFSET_TOLERANCE_M} from '../facade/wallSurfaceMatch.ts';

export const CROP_MIN_OVERLAP = 0.6;
export type Xy = [number, number];

/** One crop as walls.json (v2, `--archive`) records it. */
export interface CropWall {
  tag: string; file: string; a: Xy; b: Xy; normal: Xy; ppm: number; widthPx: number; heightPx: number;
  wallHeightM: number; baseZ: number; capturedAt?: string; panoId?: string; obliquityDeg?: number; cameraDistM?: number;
  foliage?: number; washedOut?: number; missingFraction?: number; sha256?: string; cameraRD?: number[];
}
/** The plan part of a block-kit panel (local metres) and the recipe anchor. */
export interface PanelPlan { index: number; o: number[]; r: number[]; n: number[]; uMin: number; uMax: number }

export type CropRelation = 'match' | 'facing' | 'angle' | 'offset' | 'overlap';
export interface CropMatch {
  relation: CropRelation; tag: string; panel: number;
  offsetM: number; angleDeg: number; overlapFraction: number;
  /** crop metres (from `a`) at the panel's uMin and uMax; increasing when the panel and crop face the same side */
  alongAtUMin: number; alongAtUMax: number;
}

/** Unit direction a->b and the outward normal of a counter-clockwise footprint edge. */
export function cropFrame(a: Xy, b: Xy): {t: Xy; n: Xy; len: number} {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  return {t: [dx / len, dy / len], n: [dy / len, -dx / len], len};
}

/** Local panel point (u along `r`) -> RD. */
export function panelPointRD(p: PanelPlan, u: number, anchorRD: Xy): Xy {
  return [anchorRD[0] + p.o[0] + p.r[0] * u, anchorRD[1] - (p.o[2] + p.r[2] * u)];
}

/** Crop metres along `a -> b` of an RD point. */
export const alongOf = (c: Pick<CropWall, 'a' | 'b'>, q: Xy) => { const {t} = cropFrame(c.a, c.b); return (q[0] - c.a[0]) * t[0] + (q[1] - c.a[1]) * t[1]; };

export function matchCropToPanel(c: CropWall, p: PanelPlan, anchorRD: Xy): CropMatch {
  const {t, n, len} = cropFrame(c.a, c.b);
  const pn: Xy = [p.n[0], -p.n[2]], pl = Math.hypot(pn[0], pn[1]) || 1;
  const cos = (pn[0] * n[0] + pn[1] * n[1]) / pl;
  const angleDeg = Math.acos(Math.min(1, Math.abs(cos))) * 180 / Math.PI;
  const q0 = panelPointRD(p, p.uMin, anchorRD), q1 = panelPointRD(p, p.uMax, anchorRD), mid: Xy = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2];
  const offsetM = Math.abs((mid[0] - c.a[0]) * n[0] + (mid[1] - c.a[1]) * n[1]);
  const s0 = (q0[0] - c.a[0]) * t[0] + (q0[1] - c.a[1]) * t[1], s1 = (q1[0] - c.a[0]) * t[0] + (q1[1] - c.a[1]) * t[1];
  const width = Math.max(1e-6, p.uMax - p.uMin), overlap = Math.max(0, Math.min(len, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)));
  const overlapFraction = overlap / width;
  const relation: CropRelation = cos <= 0 ? 'facing' : angleDeg > WALL_ANGLE_TOLERANCE_DEG ? 'angle' : offsetM > WALL_OFFSET_TOLERANCE_M ? 'offset' : overlapFraction < CROP_MIN_OVERLAP ? 'overlap' : 'match';
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {relation, tag: c.tag, panel: p.index, offsetM: r3(offsetM), angleDeg: r3(angleDeg), overlapFraction: r3(overlapFraction), alongAtUMin: r3(s0), alongAtUMax: r3(s1)};
}

/** The best matching crop for a panel: most overlap, then the straightest view, then the newest. */
export function bestCropForPanel(crops: CropWall[], p: PanelPlan, anchorRD: Xy): {crop: CropWall; match: CropMatch} | null {
  const ok = crops.map(crop => ({crop, match: matchCropToPanel(crop, p, anchorRD)})).filter(m => m.match.relation === 'match');
  ok.sort((x, y) => Math.min(1, y.match.overlapFraction) - Math.min(1, x.match.overlapFraction) || (x.crop.obliquityDeg ?? 90) - (y.crop.obliquityDeg ?? 90) || (y.crop.capturedAt ?? '').localeCompare(x.crop.capturedAt ?? ''));
  return ok[0] ?? null;
}

/** walls.json (v2) rows with a crop -> CropWall (file names relative to the pand directory). */
export function cropsOfWallsJson(json: {walls: any[]}): CropWall[] {
  return json.walls.filter(w => w.crop && w.wallRD && w.ppm).map(w => ({
    tag: w.tag, file: `${w.tag}.jpg`, a: w.wallRD.a, b: w.wallRD.b, normal: w.wallRD.normal, ppm: w.ppm, widthPx: w.widthPx, heightPx: w.heightPx,
    wallHeightM: w.wallHeightM, baseZ: w.baseZ, capturedAt: w.capturedAt, panoId: w.panoId, obliquityDeg: w.obliquityDeg, cameraDistM: w.cameraDistM,
    foliage: w.foliage, washedOut: w.washedOut, missingFraction: w.missingFraction, sha256: w.sha256, cameraRD: w.cameraRD,
  }));
}
