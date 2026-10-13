// Named road-drawing regressions for the own ground (pure; used by
// scripts/own-ground/check-ground-cells.ts and ownGround.test.ts).
//
// A probe asks what a camera straight above sees on a drawn band: every
// band of every listed way, at a few stations along it and across its inner
// width. The answer must be a street surface (or paint/kerb/rail on it),
// never the land's paving, a square, or nothing.

import { layersAt, type BuiltCell, type GroundLayer } from './groundCell.js';
import { pointAt, stations } from './drape.js';
import type { LocalWay } from './streets.js';

export const STREET_TOPS: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['asphalt', 'klinker', 'cycle', 'paving', 'gravel', 'paint', 'kerb', 'tram']);

export interface RoadRegression {
  id: string;
  label: string;
  /** A point in the cell that owns most of the ways. */
  at: [number, number];
  /** OSM way ids whose bands must read as street at both LODs. */
  ways: number[];
  /** Station fractions to probe (ends skipped: junction fills are checked elsewhere). */
  fractions?: number[];
  /** Minimum share of probes that must hit a street surface. */
  minShare: number;
}

/**
 * De Clercqstraat between Bilderdijkstraat and the Kostverlorenvaart (user,
 * 2026-10-13: "why is half of De Clercqstraat missing here?"). The block lies
 * just west of the elevation-v1 cell seam at lng 4.87057 (the Bilderdijkstraat
 * junction), so from ~350 m east of it (the Raampoort, the Rozengracht /
 * Marnixstraat junction: where the user's other shots were taken) the cell
 * is in the far ring while the block east of the seam is near: LOD 1 drew carriageways only, on a 6 m drape over a
 * 10 m land grid that poked through, and the block read as an open grey plaza
 * with a ragged strip of asphalt (35.6 % of band probes read as street at
 * LOD 1 before the fix, 97.8 % after).
 */
export const DE_CLERCQSTRAAT: RoadRegression = {
  id: 'de-clercqstraat-bilderdijk-kostverloren',
  label: 'De Clercqstraat, Bilderdijkstraat → Kostverlorenvaart (north carriageway, south red lane, north cycle path)',
  at: [4.8696, 52.37072],
  ways: [813878643, 1091618121, 221261856],
  minShare: 0.95,
};

export interface CoverageResult { probes: number; street: number; share: number; misses: { way: number; band: string; offset: number; top: string | null }[] }

/** Probe the bands of `ways` (already prepared, scene frame) on the built cells. */
export function bandCoverage(cells: readonly BuiltCell[], ways: readonly LocalWay[], fractions = [0.2, 0.35, 0.5, 0.65, 0.8]): CoverageResult {
  const out: CoverageResult = { probes: 0, street: 0, share: 0, misses: [] };
  for (const w of ways) {
    const st = stations(w.points), total = st[st.length - 1];
    for (const f of fractions) {
      const s = f * total, p = pointAt(w.points, st, s), q = pointAt(w.points, st, Math.min(total, s + 0.5)), r = pointAt(w.points, st, Math.max(0, s - 0.5));
      const dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      for (const band of w.section.bands) for (const k of [-0.35, 0, 0.35]) {
        const o = band.offset + k * band.width;
        const x = p[0] + nx * o, y = p[1] + ny * o;
        const top = cells.map(c => layersAt(c, x, y)).filter(h => h.hits.length).map(h => h.top).find(Boolean) ?? null;
        out.probes++;
        if (top && STREET_TOPS.has(top)) out.street++;
        else out.misses.push({ way: w.id, band: band.kind, offset: +o.toFixed(2), top });
      }
    }
  }
  out.share = out.probes ? out.street / out.probes : 0;
  return out;
}
