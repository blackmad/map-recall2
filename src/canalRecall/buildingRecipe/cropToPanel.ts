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

/**
 * The best matching crop for a panel: the evidence quality `min(1, overlap) - foliage - washedOut / 2 - obliquity / 90`
 * (a leaf-off, straight, full view wins over a newer summer one), then the newest.
 */
export function bestCropForPanel(crops: CropWall[], p: PanelPlan, anchorRD: Xy): {crop: CropWall; match: CropMatch} | null {
  const ok = crops.map(crop => ({crop, match: matchCropToPanel(crop, p, anchorRD)})).filter(m => m.match.relation === 'match');
  ok.sort((x, y) => quality(y) - quality(x) || (y.crop.capturedAt ?? '').localeCompare(x.crop.capturedAt ?? ''));
  return ok[0] ?? null;
}

/** Evidence quality of a crop for a panel (higher is better). */
export const cropQuality = (m: {crop: CropWall; match: CropMatch}) => Math.min(1, m.match.overlapFraction) - (m.crop.foliage ?? 0) - (m.crop.washedOut ?? 0) / 2 - (m.crop.obliquityDeg ?? 90) / 90;
const quality = cropQuality;

export interface CoveragePiece { crop: CropWall; match: CropMatch; u0: number; u1: number }
/**
 * A panel photographed in pieces: a 3DBAG plane often spans two BAG footprint edges (a tower front over two pands'
 * walls, a block over a jog). Every crop on the panel's plane (offset, angle and facing within the match thresholds,
 * any overlap) can cover part of it; along the panel (0.1 m steps) the best-quality covering crop wins, and the pieces
 * are its runs. Evidence when the union covers >= 60 % of the panel width (CROP_MIN_OVERLAP).
 */
export function panelCoverage(crops: CropWall[], p: PanelPlan, anchorRD: Xy, stepM = 0.1): {pieces: CoveragePiece[]; coverage: number} {
  const cands = crops.map(crop => ({crop, match: matchCropToPanel(crop, p, anchorRD)})).filter(m => m.match.relation === 'match' || m.match.relation === 'overlap').filter(m => m.match.overlapFraction > 0);
  const width = p.uMax - p.uMin, pieces: CoveragePiece[] = [];
  let covered = 0;
  for (let u = p.uMin + stepM / 2; u < p.uMax; u += stepM) {
    let best: (typeof cands)[number] | null = null;
    for (const c of cands) {
      const {len} = cropFrame(c.crop.a, c.crop.b), k = (c.match.alongAtUMax - c.match.alongAtUMin) / Math.max(1e-6, width), along = c.match.alongAtUMin + (u - p.uMin) * k;
      if (along < 0 || along > len) continue;
      if (!best || quality(c) > quality(best) + 1e-9) best = c;
    }
    if (!best) continue;
    covered += stepM;
    const last = pieces[pieces.length - 1];
    if (last && last.crop === best.crop && Math.abs(last.u1 - (u - stepM / 2)) < 1e-6) last.u1 = Math.min(p.uMax, u + stepM / 2);
    else pieces.push({crop: best.crop, match: best.match, u0: Math.max(p.uMin, u - stepM / 2), u1: Math.min(p.uMax, u + stepM / 2)});
  }
  return {pieces, coverage: Math.round(Math.min(1, covered / Math.max(1e-6, width)) * 1000) / 1000};
}

/**
 * `panelCoverage` without the pieces seen more than `maxObliquityDeg` off square, when the straighter crops still cover
 * CROP_MIN_OVERLAP of the panel (a segmented hall side whose last piece only has a 47 degree view): the likeness
 * abstains on any oblique piece, so dropping it keeps the rest of the mosaic as evidence. Otherwise the full coverage.
 */
export function panelCoverageStraight(crops: CropWall[], p: PanelPlan, anchorRD: Xy, maxObliquityDeg = 45): {pieces: CoveragePiece[]; coverage: number} {
  const all = panelCoverage(crops, p, anchorRD);
  if (!all.pieces.some(q => (q.crop.obliquityDeg ?? 0) > maxObliquityDeg)) return all;
  const straight = panelCoverage(crops.filter(c => (c.obliquityDeg ?? 0) <= maxObliquityDeg), p, anchorRD);
  return straight.pieces.length && straight.coverage >= CROP_MIN_OVERLAP ? straight : all;
}

/** walls.json (v2) rows with a crop -> CropWall (file names relative to the pand directory). */
export function cropsOfWallsJson(json: {walls: any[]}): CropWall[] {
  return json.walls.filter(w => w.crop && w.wallRD && w.ppm).map(w => ({
    tag: w.tag, file: `${w.tag}.jpg`, a: w.wallRD.a, b: w.wallRD.b, normal: w.wallRD.normal,
    // the scale actually used: rectifyFacade lowers the requested ppm on long or tall walls (maxPixels), and older archives recorded the request
    ppm: w.widthPx && w.wallWidthM ? w.widthPx / w.wallWidthM : w.ppm, widthPx: w.widthPx, heightPx: w.heightPx,
    wallHeightM: w.wallHeightM, baseZ: w.baseZ, capturedAt: w.capturedAt, panoId: w.panoId, obliquityDeg: w.obliquityDeg, cameraDistM: w.cameraDistM,
    foliage: w.foliage, washedOut: w.washedOut, missingFraction: w.missingFraction, sha256: w.sha256, cameraRD: w.cameraRD,
  }));
}
