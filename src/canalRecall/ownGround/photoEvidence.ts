// What the orthophoto shows on the surveyed carriageway, per OSM way (pure; lane roads-lanes 2026-10-23, R2 + R3).
//
// User 2026-10-23: "strange paints and multiple lanes where people don't expect". The OSM tags say a street has a
// painted cycle lane or a centre line, but BGT's rijbaan already contains the lane and most of the tagged lanes are
// not red on the street (the PDOK 8 cm orthophoto at Kinkerstraat, Ceintuurbaan, Spiegelgracht: 0 % red where the
// ribbon drew). So paint that comes from a tag draws only where the photo backs it:
//
//   lanes        a covered carriageway's `cycleway=lane` ribbon, per side: the station runs where the photo reads red
//                along the lane (scripts/own-ground/build-photo-evidence.ts); none listed → no ribbon.
//   centre       the station runs of a two-way carriageway where the photo shows a line along the measured middle
//                (surveyMarkings centre dashes); none listed → no dashes.
//   zebras       per planned crossing (surveyMarkings planCrossings, keyed by its centre): where along the road the
//                photo's stripes are (OSM crossing nodes sit metres off the paint: Rozengracht, 3–5 m), or that the
//                photo shows none there (dropped; a node mapped through a junction drew a zebra rotated along the road
//                at Linnaeusstraat); a crossing not listed is drawn as planned.
//   greyFiets    interior points of rijbaan sections the extract paints red as a fietsstraat while the photo shows
//                them grey (the Marnixstraat busway: photo red 44 % against 77 % on the fietspad beside it).
//
// File: road-marks-v1/photo-evidence.json.gz (published from the generator's staging copy after review), decimetre stations along the way's own polyline (groundStore toLocal).
// Built offline from the orthophoto (Beeldmateriaal Nederland, PDOK, CC BY 4.0); the game never fetches it.

import type { Vec2 } from './surface.js';

export const PHOTO_EVIDENCE_VERSION = 1 as const;
export const PHOTO_EVIDENCE_FILE = 'photo-evidence.json.gz';

export interface PhotoEvidenceFile {
  version: typeof PHOTO_EVIDENCE_VERSION;
  source: string;
  built: string;
  /** way id → [side (1 left, -1 right), s0, s1, ...] in decimetres. */
  lanes: Record<string, number[]>;
  /** way id → [s0, s1, ...] in decimetres. */
  centre: Record<string, number[]>;
  /** [x, y, du, ...] decimetres: a planned crossing's centre and the shift along its stripes' direction to the photo's
   *  zebra, or ZEBRA_DROP when the photo shows none. */
  zebras?: number[];
  /** [x, y, ...] decimetres: a point inside each rijbaan section to draw grey though the extract says fietsstraat. */
  greyFiets: number[];
  /** Ways and sections sampled (so "not listed" can be told from "not sampled"). */
  sampled?: { laneWays: number; centreWays: number; fietsSections: number; cells: number; zebras?: number };
  /** Thresholds the build used. */
  rules?: Record<string, number>;
}

/** The evidence as the cell build reads it. */
export interface PhotoEvidence {
  lanes: ReadonlyMap<number, readonly { side: 1 | -1; s0: number; s1: number }[]>;
  centre: ReadonlyMap<number, readonly [number, number][]>;
  greyFiets: readonly Vec2[];
  /** Planned crossings checked against the photo: centre, and the shift along r (null: no zebra in the photo). */
  zebras: readonly { p: Vec2; du: number | null }[];
}

export const ZEBRA_DROP = -32768;
/** A planned crossing matches its evidence entry within this (metres). */
export const ZEBRA_MATCH_M = 0.5;

export const EMPTY_EVIDENCE: PhotoEvidence = { lanes: new Map(), centre: new Map(), greyFiets: [], zebras: [] };

export function isPhotoEvidence(v: unknown): v is PhotoEvidenceFile {
  const f = v as PhotoEvidenceFile;
  return !!f && f.version === PHOTO_EVIDENCE_VERSION && typeof f.lanes === 'object' && typeof f.centre === 'object' && Array.isArray(f.greyFiets);
}

export function decodePhotoEvidence(f: PhotoEvidenceFile | null | undefined): PhotoEvidence {
  if (!f) return EMPTY_EVIDENCE;
  const lanes = new Map<number, { side: 1 | -1; s0: number; s1: number }[]>(), centre = new Map<number, [number, number][]>();
  for (const [id, v] of Object.entries(f.lanes)) {
    const runs: { side: 1 | -1; s0: number; s1: number }[] = [];
    for (let i = 0; i + 2 < v.length; i += 3) runs.push({ side: v[i] > 0 ? 1 : -1, s0: v[i + 1] / 10, s1: v[i + 2] / 10 });
    lanes.set(Number(id), runs);
  }
  for (const [id, v] of Object.entries(f.centre)) {
    const runs: [number, number][] = [];
    for (let i = 0; i + 1 < v.length; i += 2) runs.push([v[i] / 10, v[i + 1] / 10]);
    centre.set(Number(id), runs);
  }
  const greyFiets: Vec2[] = [];
  for (let i = 0; i + 1 < f.greyFiets.length; i += 2) greyFiets.push([f.greyFiets[i] / 10, f.greyFiets[i + 1] / 10]);
  const zebras: { p: Vec2; du: number | null }[] = [], z = f.zebras ?? [];
  for (let i = 0; i + 2 < z.length; i += 3) zebras.push({ p: [z[i] / 10, z[i + 1] / 10], du: z[i + 2] === ZEBRA_DROP ? null : z[i + 2] / 10 });
  return { lanes, centre, greyFiets, zebras };
}

/** Runs (metres) to the file's decimetre list. */
export const encodeRuns = (runs: readonly [number, number][]): number[] => runs.flatMap(([a, b]) => [Math.round(a * 10), Math.round(b * 10)]);

/**
 * Flags at 1 m stations (index = station) to runs: gaps up to `bridge` stations closed, runs shorter than `min`
 * dropped. Each run spans [first − 0.5, last + 0.5].
 */
export function flagRuns(flags: readonly (boolean | null)[], bridge: number, min: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1, last = -1;
  for (let i = 0; i <= flags.length; i++) {
    const on = i < flags.length && flags[i] === true;
    if (on) {
      if (start >= 0 && i - last - 1 > bridge) { if (last - start + 1 >= min) out.push([start - 0.5, last + 0.5]); start = -1; }
      if (start < 0) start = i;
      last = i;
    }
  }
  if (start >= 0 && last - start + 1 >= min) out.push([start - 0.5, last + 0.5]);
  return out;
}

/** Station (metres along the polyline) of the foot of p. */
export function stationOf(points: readonly Vec2[], p: Vec2): number {
  let best = Infinity, at = 0, run = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
    const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    const d = Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
    if (d < best) { best = d; at = run + t * l; }
    run += l;
  }
  return at;
}

export const inRuns = (runs: readonly (readonly [number, number])[] | undefined, s: number): boolean => !!runs && runs.some(([a, b]) => s >= a && s <= b);

/** The evidence entry of a crossing planned at `c` (nearest within ZEBRA_MATCH_M), or undefined. */
export function zebraEvidenceAt(ev: PhotoEvidence, c: Vec2): { p: Vec2; du: number | null } | undefined {
  let best: { p: Vec2; du: number | null } | undefined, bd = ZEBRA_MATCH_M;
  for (const z of ev.zebras) { const d = Math.hypot(z.p[0] - c[0], z.p[1] - c[1]); if (d <= bd) { bd = d; best = z; } }
  return best;
}
