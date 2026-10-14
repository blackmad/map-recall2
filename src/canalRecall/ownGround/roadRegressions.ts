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

/** Street bands a rider should see on a deck (belt audit's deck-top probe). */
const DECK_STREET: ReadonlySet<string> = new Set(['asphalt', 'klinker', 'paving', 'cycle', 'paint', 'kerb']);
/** Embedded tram rails (LIFT.rail) sit 2 cm over the carriageway (LIFT.carriageway); over a band within this they are street vocabulary. */
export const RAIL_ON_BAND_M = 0.035;

/**
 * Is the topmost hit (sorted by `compareHits`) a street band, or a tram rail lying on one?
 * On 2026-10-14 15 of the belt audit's 18 deck-top findings were rails on the asphalt or
 * klinker of a tram bridge (BRU0030, BRU0041, BRU0001…); a rail over a deck top or the
 * deck body still fails.
 */
export function deckStreetTop(hits: readonly { layer: string; z: number }[]): boolean {
  const top = hits[0];
  if (!top) return false;
  if (DECK_STREET.has(top.layer)) return true;
  if (top.layer !== 'tram') return false;
  const under = hits.find(h => h.layer !== 'tram');
  return !!under && DECK_STREET.has(under.layer) && top.z - under.z <= RAIL_ON_BAND_M;
}

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

/** A junction whose interior must read as one road surface (no red or pale blobs, no land). */
export interface JunctionRegression { id: string; label: string; at: [number, number]; radiusM: number; surface: GroundLayer; minShare: number }

/** De Clercqstraat × Bilderdijkstraat (and the tram junction): user shots of red smears and grey patches. */
export const JUNCTIONS: JunctionRegression[] = [
  { id: 'bilderdijkstraat-de-clercqstraat', label: 'Bilderdijkstraat × De Clercqstraat', at: [4.870286, 52.370936], radiusM: 4, surface: 'asphalt', minShare: 0.9 },
  { id: 'nassaukade-de-clercqstraat', label: 'Nassaukade × De Clercqstraat / Rozengracht (Rijckerbrug)', at: [4.874103, 52.371797], radiusM: 4, surface: 'asphalt', minShare: 0.9 },
];

/** Share of probes on a disc around a junction node whose top layer is the road surface (plus paint on it). */
export function junctionCoverage(cells: readonly BuiltCell[], centre: [number, number], radiusM: number, surface: GroundLayer): { probes: number; ok: number; share: number; tops: Record<string, number> } {
  const tops: Record<string, number> = {};
  let probes = 0, ok = 0;
  for (let r = 0; r <= radiusM; r += 1) for (let k = 0; k < (r ? 12 : 1); k++) {
    const a = (k / 12) * Math.PI * 2, x = centre[0] + Math.cos(a) * r, y = centre[1] + Math.sin(a) * r;
    const top = cells.map(c => layersAt(c, x, y)).filter(h => h.hits.length).map(h => h.top).find(Boolean) ?? 'none';
    tops[top] = (tops[top] ?? 0) + 1;
    probes++;
    if (top === surface || top === 'paint' || top === 'tram') ok++;
  }
  return { probes, ok, share: ok / probes, tops };
}

/**
 * Stray surface fragments at a junction (user, 2026-10-13: "red cycle-lane smear
 * and brown holes at Rozengracht/Marnixstraat"). Each probe point lies where a
 * fragment was drawn; the top surface there must not be one of `forbid`.
 *  - a 2.4 m klinker stub of De Clercqstraat (way 1410733518, 13 m, OSM maps it
 *    through the junction) lay as a brown parallelogram on the Rozengracht asphalt;
 *  - two cycleway slivers (1410733519 between two junction cuts, 813875405 at
 *    the kerb) lay as red stubs on the road.
 * Offsets are scene metres (east, north) from `at`.
 */
export interface StrayRegression { id: string; label: string; at: [number, number]; probes: { offset: [number, number]; forbid: GroundLayer[] }[] }

export const STRAYS: StrayRegression[] = [
  {
    id: 'rozengracht-marnixstraat-fragments',
    label: 'Rozengracht × Marnixstraat × De Clercqstraat: klinker stub and red slivers on the junction asphalt',
    at: [4.874103, 52.371797],
    probes: [
      { offset: [-9.0, -7.0], forbid: ['klinker'] }, { offset: [-7.5, -5.9], forbid: ['klinker'] }, { offset: [-6.2, -4.9], forbid: ['klinker'] },
      { offset: [-7.0, -7.9], forbid: ['cycle'] }, { offset: [-6.0, -7.85], forbid: ['cycle'] },
      { offset: [6.0, -5.0], forbid: ['cycle'] },
    ],
  },
  {
    // De Clercqstraat 22-2 and the Bilderdijkstraat crossing: the `area:highway` polygons are tram and bus platforms
    // (area:highway=platform). They were drawn as light square paving; they are pavement tiles under the street bands,
    // never the plaza paving or bare land. (Carriageway and cycleway `area:highway` classes: osmGround.pavedAreaSurface.)
    id: 'de-clercqstraat-platforms',
    label: 'De Clercqstraat 22-2 and the Bilderdijkstraat crossing: area:highway platforms read as pavement or street',
    at: [4.87043, 52.37058],
    probes: [
      { offset: [0, 0], forbid: ['square', 'land'] }, { offset: [56.4, 65.2], forbid: ['square', 'land'] },
      { offset: [10.9, 88.4], forbid: ['square', 'land'] }, { offset: [-61.8, 16.6], forbid: ['square', 'land'] },
    ],
  },
];

/** Probes of a stray regression that still read as a forbidden surface (empty: clean). */
export function strayHits(cells: readonly BuiltCell[], centre: [number, number], reg: StrayRegression): { offset: [number, number]; top: string }[] {
  const out: { offset: [number, number]; top: string }[] = [];
  for (const p of reg.probes) {
    const x = centre[0] + p.offset[0], y = centre[1] + p.offset[1];
    const top = cells.map(c => layersAt(c, x, y)).filter(h => h.hits.length).map(h => h.top).find(Boolean) ?? 'none';
    if ((p.forbid as string[]).includes(top)) out.push({ offset: p.offset, top });
  }
  return out;
}

/**
 * Belt audit quay samples: each segment of the shore at `step` metres (at
 * least its start), after merging runs of collinear vertices back into one
 * segment. The berth rule (moorings.ts) splits shores near a houseboat into
 * 0.5 m collinear pieces; sampled per piece, the Westerdok spot went from 16
 * to 106 samples once the berths reached main and its worst sample moved
 * 1.4 m, off its reviewed key (2026-10-14). Merged, an uncut shore samples
 * exactly as before the berths.
 */
export function shoreSamples(line: readonly (readonly [number, number])[], step = 5, tolM = 0.01): [number, number][] {
  const pts: (readonly [number, number])[] = [];
  for (const p of line) {
    if (pts.length && Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) < 1e-9) continue;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1], len = Math.hypot(p[0] - a[0], p[1] - a[1]);
      const off = len > 0 ? Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / len : 0;
      const ahead = (b[0] - a[0]) * (p[0] - b[0]) + (b[1] - a[1]) * (p[1] - b[1]) > 0;
      if (off < tolM && ahead) pts[pts.length - 1] = p;
      else pts.push(p);
    } else pts.push(p);
  }
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.floor(Math.hypot(bx - ax, by - ay) / step));
    for (let t = 0; t < n; t++) out.push([ax + (bx - ax) * t / n, ay + (by - ay) * t / n]);
  }
  return out;
}

/**
 * A reviewed belt-audit spot ("lng,lat", 5 decimals) matches a finding within
 * this many metres. Spots are 40 m clusters named by their worst sample, which
 * moves when the shore around it is re-split; a new spot lies further off.
 */
export const KNOWN_SPOT_M = 15;
export function spotDistanceM(a: string, b: string): number {
  const [alng, alat] = a.split(',').map(Number), [blng, blat] = b.split(',').map(Number);
  return Math.hypot((alng - blng) * 111320 * Math.cos(alat * Math.PI / 180), (alat - blat) * 111320);
}
