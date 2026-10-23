// Named road-drawing regressions for the own ground (pure; used by
// scripts/own-ground/check-ground-cells.ts and ownGround.test.ts).
//
// A probe asks what a camera straight above sees on a drawn band: every
// band of every listed way, at a few stations along it and across its inner
// width. The answer must be a street surface (or paint/kerb/rail on it),
// never the land's paving, a square, or nothing.

import { compareHits, layersAt, type BuiltCell, type GroundLayer } from './groundCell.js';
import { pointAt, stations } from './drape.js';
import type { LocalWay } from './streets.js';
import { surfaceLayer, type RoadIndex } from './roadSurfaces.js';
import type { RoadMesh } from './roadCells.js';

/**
 * The top surface at (x, y) across the cells: the highest cell top (a neighbour cell's road polygon reaches over the
 * cell edge where this cell's land is; the first cell with any hit used to answer 'land' there).
 */
export function topAcross(cells: readonly BuiltCell[], x: number, y: number): string {
  let best: string | null = null, bz = -Infinity;
  for (const c of cells) {
    const h = layersAt(c, x, y);
    if (!h.top) continue;
    const z = h.hits.find(q => q.layer === h.top)?.z ?? -Infinity;
    if (z > bz) { bz = z; best = h.top; }
  }
  return best ?? 'none';
}

export const STREET_TOPS: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['asphalt', 'klinker', 'brick', 'cycle', 'paving', 'gravel', 'paint', 'kerb', 'tram']);

/**
 * roads-v1 survey gaps (roads lane phase 2, 2026-10-16): a junction node under no wegdeel polygon (a plein the BGT
 * files as terrain) where the covered ways draw no bands, so the land showed where the band model paved. The
 * pocket pass paves a disc around such a node again (pockets.ts SurveyGap). `maxLandM2`: land points (1 m grid,
 * within `radiusM`, under no polygon) where the build without the survey shows a street surface. With every cell
 * published the Nieuwmarkt nodes lie in polygons the neighbour cell 0_0 owns; the gap shows at the extract's edge
 * (where the pilot ended), so check-ground-cells builds the cell with its neighbours' roads withheld.
 */
export interface SurveyGapRegression { id: string; label: string; at: [number, number]; radiusM: number; maxLandM2: number }
export const SURVEY_GAPS: SurveyGapRegression[] = [
  { id: 'nieuwmarkt-west', label: 'Nieuwmarkt, west side (the plein is terrain, not wegdeel)', at: [4.899633, 52.372277], radiusM: 12, maxLandM2: 40 },
  { id: 'nieuwmarkt-north', label: 'Nieuwmarkt, north side by the Waag', at: [4.899968, 52.372743], radiusM: 12, maxLandM2: 30 },
];
/** Land points (1 m grid within `radiusM`, under no survey polygon) on `on` that `off` (no survey) shows as street. */
export function gapLand(on: readonly BuiltCell[], off: readonly BuiltCell[], centre: [number, number], radiusM: number, index: RoadIndex): { probes: number; land: number } {
  let probes = 0, land = 0;
  for (let dx = -radiusM; dx <= radiusM; dx++) for (let dy = -radiusM; dy <= radiusM; dy++) {
    if (dx * dx + dy * dy > radiusM * radiusM) continue;
    const x = centre[0] + dx, y = centre[1] + dy;
    if (index.find(x, y) >= 0) continue;
    if (!STREET_TOPS.has(topAcross(off, x, y) as GroundLayer)) continue;
    probes++;
    if (topAcross(on, x, y) === 'land') land++;
  }
  return { probes, land };
}

/** Street bands a rider should see on a deck (belt audit's deck-top probe). */
const DECK_STREET: ReadonlySet<string> = new Set(['asphalt', 'klinker', 'brick', 'paving', 'cycle', 'paint', 'kerb']);
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

/** A junction whose interior must read as one road surface (no red or pale blobs, no land). `also`: further tops accepted (a fietsstraat junction the survey paints red reads cycle or asphalt). */
export interface JunctionRegression { id: string; label: string; at: [number, number]; radiusM: number; surface: GroundLayer; minShare: number; also?: GroundLayer[] }

/** De Clercqstraat × Bilderdijkstraat (and the tram junction): user shots of red smears and grey patches. */
export const JUNCTIONS: JunctionRegression[] = [
  { id: 'bilderdijkstraat-de-clercqstraat', label: 'Bilderdijkstraat × De Clercqstraat', at: [4.870286, 52.370936], radiusM: 4, surface: 'asphalt', minShare: 0.9 },
  { id: 'nassaukade-de-clercqstraat', label: 'Nassaukade × De Clercqstraat / Rozengracht (Rijckerbrug)', at: [4.874103, 52.371797], radiusM: 4, surface: 'asphalt', minShare: 0.9 },
];

/** Share of probes on a disc around a junction node whose top layer is the road surface (plus paint on it, and `also`). */
export function junctionCoverage(cells: readonly BuiltCell[], centre: [number, number], radiusM: number, surface: GroundLayer, also: readonly GroundLayer[] = []): { probes: number; ok: number; share: number; tops: Record<string, number> } {
  const tops: Record<string, number> = {};
  let probes = 0, ok = 0;
  for (let r = 0; r <= radiusM; r += 1) for (let k = 0; k < (r ? 12 : 1); k++) {
    const a = (k / 12) * Math.PI * 2, x = centre[0] + Math.cos(a) * r, y = centre[1] + Math.sin(a) * r;
    const top = topAcross(cells, x, y);
    tops[top] = (tops[top] ?? 0) + 1;
    probes++;
    if (top === surface || top === 'paint' || top === 'tram' || (also as string[]).includes(top)) ok++;
  }
  return { probes, ok, share: ok / probes, tops };
}

/** The layer a surveyed polygon's mesh draws as; paint, rails, kerb lines and posts may lie on any of them. */
const MESH_LAYER: Record<RoadMesh, GroundLayer> = { asphalt: 'asphalt', klinker: 'klinker', cycle: 'cycle', paving: 'paving', gravel: 'gravel' };
const ON_ANY: ReadonlySet<string> = new Set(['paint', 'tram', 'kerb', 'bollard']);
/**
 * roads-v1: share of probes on the disc whose top is what the survey says lies there (the polygon's mesh, or paint
 * and rails on it); off the survey, anything but bare land or nothing. A red fietspad 3 m from the node reads cycle
 * by right; the band model's red smear on a rijbaan does not.
 */
export function surveyedCoverage(cells: readonly BuiltCell[], centre: [number, number], radiusM: number, index: RoadIndex): { probes: number; ok: number; share: number; tops: Record<string, number>; misses: { at: [number, number]; top: string; survey: string }[] } {
  const tops: Record<string, number> = {}, misses: { at: [number, number]; top: string; survey: string }[] = [];
  let probes = 0, ok = 0;
  for (let r = 0; r <= radiusM; r += 1) for (let k = 0; k < (r ? 12 : 1); k++) {
    const a = (k / 12) * Math.PI * 2, x = centre[0] + Math.cos(a) * r, y = centre[1] + Math.sin(a) * r;
    const top = topAcross(cells, x, y), mesh = index.meshAt(x, y), cls = index.classAt(x, y);
    tops[top] = (tops[top] ?? 0) + 1;
    probes++;
    const good = mesh === null ? top !== 'land' && top !== 'none' : top === (cls ? surfaceLayer(cls, mesh) : MESH_LAYER[mesh]) || ON_ANY.has(top);
    if (good) ok++; else misses.push({ at: [+(x - centre[0]).toFixed(1), +(y - centre[1]).toFixed(1)], top, survey: mesh ?? 'off-survey' });
  }
  return { probes, ok, share: ok / probes, tops, misses };
}

/**
 * roads-v1 junctions (the BGT partition on, `?roads=bgt`): the user's Kinkerstraat × Da Costakade shots (red smears
 * and pale wedges where the band model met the bridge mouths) read as the surveyed asphalt; the Marnixstraat busway
 * crossing of the red fietsstraat is one rijbaan polygon the extract paints red (an OSM fietsstraat lies on it) with
 * tram track along it, which the extract keeps grey (roadCells fietsstraatSection: the section is the busway's): asphalt, never paving or land. check-ground-cells judges them with `surveyedCoverage` (the top must
 * be the polygon's mesh); `surface`/`also` document what that is at the node.
 */
export const ROAD_JUNCTIONS: JunctionRegression[] = [
  { id: 'kinkerstraat-da-costakade-west', label: 'Kinkerstraat × Da Costakade (west quay)', at: [4.87323, 52.367545], radiusM: 4, surface: 'asphalt', minShare: 0.9 },
  { id: 'kinkerstraat-da-costakade-east', label: 'Kinkerstraat × Da Costakade (east quay)', at: [4.87383, 52.367724], radiusM: 4, surface: 'asphalt', minShare: 0.9 },
  { id: 'marnixstraat-busway-fietsstraat', label: 'Marnixstraat busway × the red fietsstraat (Frederik Hendrikplantsoen)', at: [4.87673, 52.374747], radiusM: 4, surface: 'asphalt', minShare: 0.9 },
];

/**
 * roads-v1 strays along a way: at `fractions` of the way's length and `offsets` metres left (+) / right (−) of its
 * axis, the top must not be one of `forbid`. The Da Costagracht bridge deck (Kinkerstraat, way 753774987): the pale
 * pavement tiles and the grey deck slab must not show on the carriageway (Kinkerstraat has cycleway:both=lane, so
 * red lane ribbons there are the map's, not strays).
 */
export interface WayStrayRegression { id: string; label: string; way: number; fractions: number[]; offsets: number[]; forbid: GroundLayer[] }
export const ROAD_WAY_STRAYS: WayStrayRegression[] = [
  { id: 'da-costagracht-bridge-deck', label: 'Kinkerstraat over the Da Costagracht (way 753774987): deck reads as road', way: 753774987, fractions: [0.15, 0.3, 0.5, 0.7, 0.85], offsets: [-2, 0, 2], forbid: ['paving', 'deckTop', 'land', 'square', 'none' as GroundLayer] },
];
export function wayStrayHits(cells: readonly BuiltCell[], way: LocalWay, reg: WayStrayRegression): { fraction: number; offset: number; top: string }[] {
  const st = stations(way.points), total = st[st.length - 1], out: { fraction: number; offset: number; top: string }[] = [];
  for (const f of reg.fractions) {
    const t = f * total, p = pointAt(way.points, st, t), q = pointAt(way.points, st, Math.min(total, t + 1)), r = pointAt(way.points, st, Math.max(0, t - 1));
    const dx = q[0] - r[0], dy = q[1] - r[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (const o of reg.offsets) {
      const x = p[0] + nx * o, y = p[1] + ny * o;
      const top = topAcross(cells, x, y);
      if ((reg.forbid as string[]).includes(top)) out.push({ fraction: f, offset: o, top });
    }
  }
  return out;
}

/**
 * roads-v1 crossing paint: the Bilderdijkgracht crossings of the Kinkerstraat (footway=crossing ways 1239242881 and
 * 1239242873, unmarked in OSM, with a refuge island between the carriageways). Every paint triangle within reach of
 * the crossing way (the Kinkerstraat's lane paint at the quay mouths) must lie on a carriageway polygon (`onRoad`) or
 * off the survey: the band model ran 14 of 14 across the pavements and the island. Returns the paint triangles
 * counted and those off the carriageway.
 */
export interface ZebraRegression { id: string; label: string; ways: number[]; reachM: number }
export const ZEBRAS: ZebraRegression[] = [
  { id: 'bilderdijkgracht-zebras', label: 'Kinkerstraat × Bilderdijkgracht zebras stop at the carriageway polygons', ways: [1239242881, 1239242873], reachM: 1.6 },
];
export function zebraOffRoad(cells: readonly BuiltCell[], ways: readonly LocalWay[], reg: ZebraRegression, onRoad: (x: number, y: number) => boolean): { dashes: number; off: [number, number][] } {
  const off: [number, number][] = [];
  let dashes = 0;
  const near = (x: number, y: number) => ways.some(w => { for (let i = 0; i + 1 < w.points.length; i++) { const a = w.points[i], b = w.points[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)); if (Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y) <= reg.reachM) return true; } return false; });
  for (const c of cells) {
    const m = c.layers.paint;
    if (!m) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, k = idx[t + 2] * 3, x = (p[a] + p[b] + p[k]) / 3, y = (p[a + 1] + p[b + 1] + p[k + 1]) / 3;
      if (!near(x, y)) continue;
      dashes++;
      if (!onRoad(x, y)) off.push([+x.toFixed(1), +y.toFixed(1)]);
    }
  }
  return { dashes, off };
}

/**
 * Road look v2 (2026-10-16, user: "our roads still don't look great"): the survey-aware markings (surveyMarkings.ts)
 * lie on ground carriageway polygons only, and the named junctions carry them. Within `radiusM` of `at` every paint
 * triangle's centroid must lie on a carriageway polygon (class carriage; a parking bay, inrit, cycle path or pavement
 * fails), and at least `minPaint` paint triangles must be there (the Nassaukade / Frederik Hendrikplantsoen zebras,
 * OSM crossing nodes with crossing:markings=zebra and crossing:signals=yes). The Bilderdijkgracht crossings and the
 * Marnixstraat busway were where the prior-based band paint shredded across pavements and the island.
 */
export interface SurveyPaintRegression { id: string; label: string; at: [number, number]; radiusM: number; minPaint: number }
export const SURVEY_PAINT: SurveyPaintRegression[] = [
  { id: 'bilderdijkgracht-survey-paint', label: 'Kinkerstraat × Bilderdijkgracht: survey paint on the carriageway only', at: [4.87081, 52.36684], radiusM: 45, minPaint: 20 },
  { id: 'marnixstraat-busway-survey-paint', label: 'Marnixstraat busway by the Tweede Marnixplantsoen: survey paint on the carriageway only', at: [4.87673, 52.374747], radiusM: 45, minPaint: 0 },
  { id: 'nassaukade-fhplantsoen-zebras', label: 'Nassaukade × Frederik Hendrikplantsoen: zebras at the signalised crossings, on the carriageway', at: [4.8776303, 52.3785795], radiusM: 30, minPaint: 60 },
];
export function surveyPaint(cells: readonly BuiltCell[], centre: [number, number], radiusM: number, onCarriage: (x: number, y: number) => boolean): { paint: number; off: [number, number][] } {
  const off: [number, number][] = [];
  let paint = 0;
  for (const c of cells) {
    const m = c.layers.paint;
    if (!m) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, k = idx[t + 2] * 3, x = (p[a] + p[b] + p[k]) / 3, y = (p[a + 1] + p[b + 1] + p[k + 1]) / 3;
      if (Math.hypot(x - centre[0], y - centre[1]) > radiusM) continue;
      paint++;
      if (!onCarriage(x, y)) off.push([+(x - centre[0]).toFixed(1), +(y - centre[1]).toFixed(1)]);
    }
  }
  return { paint, off };
}

/**
 * Crossing audit 2026-10-17 (crossingAudit.ts; user ride screenshots by the Nieuwezijds Voorburgwal / Magna Plaza /
 * Dam junction: zebras splayed in fans, overlapped at different angles, every other stripe missing, on cobbles and in
 * odd places). Within `radiusM` of `at` the renderer draws between `count[0]` and `count[1]` zebras, and the audit
 * finds none of them splayed, skewed, overlapping, off the carriageway, gapped or of an implausible length.
 *  - Raadhuisstraat by Magna Plaza: OSM maps each crossing as a node on every way it crosses (busway, cycleway,
 *    footway, tram rails); each node drew its own zebra on the nearest road 1.3 m apart and at the angle of whichever
 *    way it snapped to (one fan of five over the tram junction). The photo has a zebra on each general lane; the
 *    south one is mapped only as the cycle path's crossing node (crossing:markings=yes on the cycleway vertex), so it
 *    is not drawn (the cycle crossing pass draws none there either).
 *  - Nieuwezijds Voorburgwal south of the Dam: three nodes of one crossing 1.3 m apart drew three interleaved zebras;
 *    the Paleisstraat (a highway=cycleway on BGT rijbaan) zebra was dropped as a cycle crossing.
 *  - Leidseplein: BGT maps the zebras as voetpad strips across the road; they drew as raised pavement without stripes.
 */
export interface CrossingRegression { id: string; label: string; at: [number, number]; radiusM: number; count: [number, number] }
export const CROSSINGS: CrossingRegression[] = [
  { id: 'magna-plaza-raadhuisstraat', label: 'Raadhuisstraat × Nieuwezijds Voorburgwal by Magna Plaza: the north lane zebra alone, no fan over the tram junction', at: [4.89032, 52.37318], radiusM: 12, count: [1, 1] },
  { id: 'nzvoorburgwal-dam-south', label: 'Nieuwezijds Voorburgwal × Dam (south) and the Paleisstraat: one zebra per crossing, not three interleaved', at: [4.89067, 52.37251], radiusM: 16, count: [2, 2] },
  { id: 'leidseplein-voetpad-strips', label: 'Leidseplein: zebras on the BGT voetpad strips across the road', at: [4.8822, 52.3638], radiusM: 40, count: [3, 8] },
];

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
    const top = topAcross(cells, x, y);
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

/**
 * Deck top lying on land with no street band over it (ride review 2026-10-14, J6: grey slabs over the four corners of
 * the Nieuwe-Wercksbrug BRU0063, across the quay pavements and the cycle-lane ends). A 1 m grid over the deck's
 * profile (its stations ±`pad` m, out to its widest side plus `pad`): where the topmost surface seen from above is the
 * deck top and no water lies under it, a square metre of slab. Returns the area and the probes counted.
 */
export function deckSlabOnLand(cells: readonly BuiltCell[], deck: { profile: { x: Float64Array; y: Float64Array } }, pad = 4): { slabM2: number; deckM2: number } {
  const p = deck.profile;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.x.length; i++) { x0 = Math.min(x0, p.x[i]); x1 = Math.max(x1, p.x[i]); y0 = Math.min(y0, p.y[i]); y1 = Math.max(y1, p.y[i]); }
  x0 -= 20 + pad; y0 -= 20 + pad; x1 += 20 + pad; y1 += 20 + pad;
  const covers = (m: { positions: ArrayLike<number>; indices: ArrayLike<number> } | undefined, x: number, y: number) => {
    if (!m) return false;
    const pos = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      if (Math.max(pos[a], pos[b], pos[c]) < x || Math.min(pos[a], pos[b], pos[c]) > x || Math.max(pos[a + 1], pos[b + 1], pos[c + 1]) < y || Math.min(pos[a + 1], pos[b + 1], pos[c + 1]) > y) continue;
      const d = (pos[b + 1] - pos[c + 1]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 1] - pos[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((pos[b + 1] - pos[c + 1]) * (x - pos[c]) + (pos[c] - pos[b]) * (y - pos[c + 1])) / d;
      const v = ((pos[c + 1] - pos[a + 1]) * (x - pos[c]) + (pos[a] - pos[c]) * (y - pos[c + 1])) / d;
      if (u >= 0 && v >= 0 && u + v <= 1) return true;
    }
    return false;
  };
  let slab = 0, deckM2 = 0;
  for (let x = Math.floor(x0) + 0.5; x < x1; x += 1) for (let y = Math.floor(y0) + 0.5; y < y1; y += 1) {
    const cell = cells.find(c => x >= c.rect[0] && x < c.rect[2] && y >= c.rect[1] && y < c.rect[3]);
    if (!cell || !covers(cell.layers.deckTop, x, y)) continue;
    const { hits } = layersAt(cell, x, y);
    if (hits[0]?.layer !== 'deckTop') continue;
    deckM2++;
    if (!hits.some(h => h.layer === 'water')) slab++;
  }
  return { slabM2: slab, deckM2 };
}

/**
 * A measured deck's ends read as road (user 2026-10-16, a Prinsengracht bridge: "small grey slivers/wedges sticking
 * out at both ends where the decks meet the quay"). Over the water between the bank and the bridge's surveyed start
 * the street mask cut the survey's ground polygons (h = 0), so the grey deck top showed as a jagged band across the
 * road; on the bank the deck top, at the riding surface, poked through the polygons draped a centimetre or two under
 * it. Probes along the deck at `offsets` (fractions of the road's half-width) every `stepM` from `beforeM` outside each
 * span end to `intoM` inside it: the topmost surface must not be the grey deck top, water or nothing (DECK_END_FORBID;
 * a bollard, a kerb or a quay coping there is street furniture or the survey's own edge, counted apart).
 */
export const DECK_END_FORBID: ReadonlySet<string> = new Set(['deckTop', 'water', 'none']);
/** `maxMisses` of the 378 probes (measured 2026-10-16); `pinMin`: without the fix at least this many (the pin is live). */
export interface DeckEndRegression { id: string; label: string; at: [number, number]; maxMisses: number; pinMin?: number }
export const DECK_ENDS: DeckEndRegression[] = [
  // The user's bridge (screenshots 2026-10-16, houseboats both sides): 1 miss with the fix, 36 without.
  { id: 'BRU0065', label: 'Berensluis, Prinsengracht × Berenstraat', at: [4.88272, 52.37043], maxMisses: 2, pinMin: 20 },
  // Its east end's north pavement polygon stops 2 m short of the span end: 8 probes see the deck top there (10 without).
  { id: 'BRU0066', label: 'Brug 66, Prinsengracht × Runstraat', at: [4.88261, 52.36892], maxMisses: 8 },
  { id: 'BRU0064', label: 'Reesluis, Prinsengracht × Reestraat', at: [4.8829, 52.37242], maxMisses: 1 },
  { id: 'BRU0067', label: 'Angenietje Swarthofbrug, Prinsengracht × Leidsegracht', at: [4.88271, 52.36629], maxMisses: 1 },
];
type DeckLine = { profile: { x: ArrayLike<number>; y: ArrayLike<number>; s: ArrayLike<number>; halfWidth: ArrayLike<number>; deck: readonly [number, number] } };
export function deckEndMisses(cells: readonly BuiltCell[], deck: DeckLine, offsets = [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8], beforeM = 3, intoM = 2, stepM = 0.25): { probes: number; misses: { s: number; t: number; top: string }[] } {
  const p = deck.profile, n = p.s.length, misses: { s: number; t: number; top: string }[] = [];
  let probes = 0;
  const at = (s: number) => {
    let i = 0;
    while (i < n - 2 && p.s[i + 1] < s) i++;
    const f = Math.max(0, Math.min(1, (s - p.s[i]) / (p.s[i + 1] - p.s[i] || 1))), dx = p.x[i + 1] - p.x[i], dy = p.y[i + 1] - p.y[i], l = Math.hypot(dx, dy) || 1;
    return { x: p.x[i] + dx * f, y: p.y[i] + dy * f, nx: -dy / l, ny: dx / l, hw: p.halfWidth[i] };
  };
  for (const [from, to] of [[p.deck[0] - beforeM, p.deck[0] + intoM], [p.deck[1] - intoM, p.deck[1] + beforeM]]) {
    for (let s = from; s <= to + 1e-6; s += stepM) {
      const c = at(s);
      for (const f of offsets) {
        const x = c.x + c.nx * c.hw * f, y = c.y + c.ny * c.hw * f;
        const hits = cells.flatMap(cell => layersAt(cell, x, y).hits).filter(h => !h.cut).sort(compareHits);
        probes++;
        const top = hits[0]?.layer ?? 'none';
        if (DECK_END_FORBID.has(top)) misses.push({ s: +s.toFixed(2), t: f, top });
      }
    }
  }
  return { probes, misses };
}

/**
 * Road spots judged beside the 8 cm PDOK orthophoto (lane roads-diagnose 2026-10-23; user: "our roads still look like
 * shit: too many weird gaps and strange paints and multiple lanes where people don't expect"). Each is a junction
 * centre (`at`, the OSM node the named ways share) with the bearing a rider looks along; scripts/own-ground/
 * render-road-sources.ts renders `halfM` around `at` coloured by source layer beside the orthophoto and the game
 * frame (artifacts/roads/diagnose/<id>.png) and measures the three complaints there (gaps R1, lanes R2, paint R3).
 * tests/e2e/own-ground-roads.spec.ts shoots the frame from `backM` behind `at` along the bearing.
 */
export interface RoadSpot { id: string; label: string; at: [number, number]; bearing: number; halfM: number; backM: number }
export const ROAD_SPOTS: RoadSpot[] = [
  { id: 'kinkerstraat-bilderdijkstraat', label: 'Kinkerstraat × Bilderdijkstraat (tram junction by the Bilderdijkgracht)', at: [4.87215, 52.36727], bearing: 60, halfM: 40, backM: 30 },
  { id: 'marnixstraat-busway', label: 'Marnixstraat busway × the red fietsstraat (Frederik Hendrikplantsoen)', at: [4.87673, 52.374747], bearing: 20, halfM: 40, backM: 30 },
  { id: 'rozengracht-marnixstraat', label: 'Rozengracht × Marnixstraat', at: [4.87575, 52.37209], bearing: 70, halfM: 40, backM: 30 },
  { id: 'de-clercqstraat-bilderdijkstraat', label: 'De Clercqstraat × Bilderdijkstraat', at: [4.87059, 52.37102], bearing: 70, halfM: 40, backM: 30 },
  { id: 'linnaeusstraat-wijttenbachstraat', label: 'Linnaeusstraat × Wijttenbachstraat (Oost)', at: [4.92545, 52.36001], bearing: 160, halfM: 40, backM: 30 },
  { id: 'mosplein', label: 'Mosplein (Noord)', at: [4.9119, 52.3915], bearing: 0, halfM: 40, backM: 30 },
  { id: 'osdorper-ban-meer-en-vaart', label: 'Osdorper Ban × Meer en Vaart (Nieuw-West)', at: [4.80540, 52.36320], bearing: 90, halfM: 40, backM: 30 },
  { id: 'ceintuurbaan-van-woustraat', label: 'Ceintuurbaan × Van Woustraat (Zuid)', at: [4.90127, 52.35481], bearing: 80, halfM: 40, backM: 30 },
  // User screenshots 2026-10-23: the junction, bridge and both quays one saturated brown klinker mass, red cycle
  // fragments mid-junction, a ring of red and zebra bits round a green centre (by Hans en Grietje, Spiegelgracht 27).
  { id: 'spiegelgracht-prinsengracht', label: 'Spiegelgracht × Prinsengracht (Hans en Grietje, looking north)', at: [4.88729, 52.36173], bearing: 0, halfM: 40, backM: 25 },
  // User 2026-10-23: "what's with the wiggly green patches?" on the square with the Dokwerker. The brief's point
  // (4.89628, 52.36622) is the Rembrandtplein; the square is east of the Portuguese Synagogue.
  { id: 'jonas-daniel-meijerplein', label: 'Jonas Daniël Meijerplein (the Dokwerker)', at: [4.90490, 52.36715], bearing: 90, halfM: 50, backM: 25 },
  { id: 'rembrandtplein', label: 'Rembrandtplein (the point first given for the Dokwerker complaint)', at: [4.89628, 52.36622], bearing: 0, halfM: 40, backM: 25 },
];
/** Where a rider stands to look at a spot: `backM` behind `at` along the bearing (lng/lat, bearing degrees from north). */
export function spotViewpoint(s: RoadSpot): { lng: number; lat: number; bearing: number } {
  const b = s.bearing * Math.PI / 180, mLat = 111320, mLng = 111320 * Math.cos(s.at[1] * Math.PI / 180);
  return { lng: s.at[0] - Math.sin(b) * s.backM / mLng, lat: s.at[1] - Math.cos(b) * s.backM / mLat, bearing: s.bearing };
}
