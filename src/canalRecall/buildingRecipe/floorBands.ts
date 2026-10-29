/**
 * Floor bands of a curtain front, measured from the photo's cell mask (GitHub #116). Lane #114 found that the 13-30 %
 * "wall" a glass front shows is the horizontal slab-edge bands at the storey lines, 0.5-1.5 m tall, not the mullion grid
 * (thin mullions vanish in the 3x3 clean-up). This reads them: per fitted storey line, the run of wall-dominant rows
 * near the line with glazed rows above it; when at least half the lines with evidence carry one, the band height and the
 * centre's lift over the line are the medians, written as fractions of an upper storey (components.ts `storeyUnit`, the
 * unit the kit draws them in; intents carry no metres), and the colour is the measured wall's. `measure.ts` writes the result as
 * `walls[].floorBands` on a layered curtain-wall group (blockBuilding/components.ts `drawFloorBands` draws it). Pure.
 */
import {GROUND_BAND_M, MASK, type FacadeMeasurement} from './measureFacade.ts';
import {FLOOR_BAND_LIMITS, storeyUnit} from '../blockBuilding/components.ts';

type MaskLike = Pick<FacadeMeasurement, 'mask' | 'cols' | 'rows' | 'cell' | 'box'>;

/**
 * Thresholds: a band row is >= `rowWall` wall among its usable cells (rows with under `minUsable` usable cells are no
 * evidence); the run may bridge `gapRows` weaker rows; it is searched `below`..`above` m round the line; the storey over
 * the band must read glazed (wall share under `visionWall`), else the front is a wall, not a band; a line within `roofM`
 * of the top is the roof edge (the `roof` band).
 */
export const FLOOR_BAND = {rowWall: 0.5, minUsable: 0.2, gapRows: 1, below: 1.0, above: 1.6, visionWall: 0.4, roofM: 1.0, quorum: 0.5} as const;

export interface FloorBandReading {
  /** per storey line looked at: the line, the band found (m) or null, and why not */
  lines: {at: number; band: [number, number] | null; why?: string}[];
  roof: [number, number] | null;
  /** the proposal (intent `floorBands` without the colour), null when the quorum is not met; `heightM` / `liftM` for reports */
  proposal: {share: number; lift: number; roof?: boolean; heightM: number; liftM: number} | null;
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Wall share per row (row 0 at the top), null where too few cells are usable. */
export function rowWallShare(m: MaskLike): (number | null)[] {
  const out: (number | null)[] = [];
  for (let r = 0; r < m.rows; r++) {
    let u = 0, w = 0;
    for (let c = 0; c < m.cols; c++) { const q = m.mask[r * m.cols + c]; if (q === MASK.unusable) continue; u++; if (q === MASK.wall) w++; }
    out.push(u >= m.cols * FLOOR_BAND.minUsable ? w / u : null);
  }
  return out;
}

/** The longest run of band rows with its centre in [lo, hi] (m), bridging short gaps; null when none. */
function bandRun(share: (number | null)[], m: MaskLike, lo: number, hi: number, maxM: number): [number, number] | null {
  const vOf = (r: number) => m.box.v1 - (r + 0.5) * m.cell, F = FLOOR_BAND;
  let best: [number, number] | null = null, start = -1, end = -1, gap = 0;
  const close = () => { if (start < 0) return; const v1 = vOf(start) + m.cell / 2, v0 = vOf(end) - m.cell / 2, c = (v0 + v1) / 2; if (c >= lo && c <= hi && (!best || v1 - v0 > best[1] - best[0])) best = [v0, v1]; start = -1; gap = 0; };
  for (let r = 0; r < m.rows; r++) {
    const s = share[r], v = vOf(r);
    if (v > hi + maxM || v < lo - maxM) { close(); continue; }
    if (s !== null && s >= F.rowWall) { if (start < 0) start = r; end = r; gap = 0; }
    else if (start >= 0 && ++gap > F.gapRows) close();
  }
  close();
  return best;
}

/** Mean wall share of the rows in [v0, v1] (m), null without evidence. */
function meanShare(share: (number | null)[], m: MaskLike, v0: number, v1: number): number | null {
  const s: number[] = [];
  for (let r = 0; r < m.rows; r++) { const v = m.box.v1 - (r + 0.5) * m.cell, x = share[r]; if (v >= v0 && v <= v1 && x !== null) s.push(x); }
  return s.length >= 3 ? s.reduce((a, b) => a + b, 0) / s.length : null;
}

/**
 * Floor bands in the mask at the fitted storey `lines` ([0, ground top, ..., top]) of a panel whose roof edge is `panelTop`
 * (a low wing of a taller group: its lines run past it). A panel whose only band is the one under its roof edge (no storey
 * line inside it) proposes the roof band alone.
 */
export function measureFloorBands(m: MaskLike, lines: number[], panelTop = Infinity): FloorBandReading {
  const F = FLOOR_BAND, L = FLOOR_BAND_LIMITS, share = rowWallShare(m), top = Math.min(lines[lines.length - 1], panelTop), out: FloorBandReading['lines'] = [];
  const unit = storeyUnit(lines, lines[lines.length - 1]), minM = L.minShare * unit, maxM = Math.min(2.0, L.maxShare * unit);
  const floors = lines.slice(1, -1).filter(at => at < top - F.roofM && at >= GROUND_BAND_M - F.below);
  for (let k = 0; k < floors.length; k++) {
    const at = floors[k], next = floors[k + 1] ?? top;
    if (meanShare(share, m, at - F.below, Math.min(next, at + F.above)) === null) { out.push({at, band: null, why: 'no evidence'}); continue; }
    const run = bandRun(share, m, at - F.below / 2, at + F.above - 0.3, maxM);
    if (!run) { out.push({at, band: null, why: 'no band rows'}); continue; }
    const h = run[1] - run[0];
    if (h < Math.max(0.3, minM) || h > maxM) { out.push({at, band: null, why: `run ${h.toFixed(1)} m outside ${Math.max(0.3, minM).toFixed(1)}..${maxM.toFixed(1)} m`}); continue; }
    const vision = meanShare(share, m, run[1] + 0.2, Math.max(run[1] + 0.5, next - 0.5));
    if (vision !== null && vision >= F.visionWall) { out.push({at, band: null, why: `storey over it ${Math.round(vision * 100)} % wall`}); continue; }
    out.push({at, band: [+run[0].toFixed(2), +run[1].toFixed(2)]});
  }
  const roofRun = bandRun(share, m, top - maxM, top, maxM);
  const roof = roofRun && roofRun[1] >= top - 0.5 && roofRun[1] - roofRun[0] <= maxM && roofRun[1] - roofRun[0] >= Math.max(0.3, minM) ? [+roofRun[0].toFixed(2), +roofRun[1].toFixed(2)] as [number, number] : null;
  const seen = out.filter(x => x.why !== 'no evidence'), found = out.filter(x => x.band);
  if (!seen.length && roof && unit > 0) { const h = roof[1] - roof[0], s = Math.min(L.maxShare, Math.max(L.minShare, r2(h / unit))); return {lines: out, roof, proposal: {share: s, lift: 0, roof: true, heightM: r2(h), liftM: 0}}; }
  if (!found.length || found.length < seen.length * F.quorum || !(unit > 0)) return {lines: out, roof, proposal: null};
  const heightM = median(found.map(x => x.band![1] - x.band![0])), liftM = median(found.map(x => (x.band![0] + x.band![1]) / 2 - x.at));
  const s = Math.min(L.maxShare, Math.max(L.minShare, r2(heightM / unit))), lift = Math.min(L.maxLift, Math.max(L.minLift, r2(liftM / unit)));
  return {lines: out, roof, proposal: {share: s, lift, ...(roof ? {roof: true} : {}), heightM: r2(heightM), liftM: r2(liftM)}};
}
