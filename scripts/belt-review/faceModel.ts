/** Belt review (R3): the face and candidate file formats, and the pure helpers that order a face. Read by lanes A and C. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { lngLatToRd, type Rd } from '../pand-reference/core.ts';
import type { CropFlags } from '../house-crops/flags.ts';

export type FacePand = {
  pandId: string; address: string; order: number;
  /** the BAG pand the addresses point at, when the world draws its twin (belt-rows.ts WORLD_TWINS) */
  bagPandId?: string;
  numbers: number[]; letters?: string[]; built: number | null; units: number; groundUses: string[]; buurt: string | null;
  /** false when the world's building tiles do not hold this pand (a footprint from BAG is used instead) */
  inWorldTiles: boolean;
};
export type FaceFile = { faceId: string; street: string; side: 'even' | 'odd'; from: number; to: number; orderNote: string; source: string; fetchedAt: string; pands: FacePand[] };

export type CandidateSource = 'wall' | 'strip';
export type Candidate = {
  id: string; file: string; year: number; month: number; distM: number; obliquityDeg: number; source: CandidateSource;
  /** house:crops flags of the 50 px/m crop (flags.ts), the hard-flag reasons and whether every hard flag passes */
  flags: CropFlags; reasons: string[]; hardPass: boolean; usable: boolean;
  /** Jev quality (judge.ts quality = P(full front) x (1 - P(occluded))) and its parts, when judged */
  judge?: { quality: number; score: number; occluded: number; closeUp: number; model: string };
  /** the panorama the view is named after (a strip's straightest), every fused panorama of a strip, and land (car/trike) or water (boat) */
  pano: { id: string; date: string; ids?: string[]; surface?: 'land' | 'water' };
  leafOff: boolean; rayBlocked: boolean;
  /** pixels per metre of the image file (>= 50 unless the wall is too large for the pixel budget), and the panorama's native resolution at the wall */
  ppm: number; nativePpm: number; width: number; height: number;
  /** a plain-language warning (oblique, strip, below 50 px/m) */
  note?: string;
};
export type PandCandidates = { pandId: string; address: string; order: number; wall: { lenM: number; bearingDeg: number; note: string } | null; status: 'ok' | 'no-wall' | 'no-pano' | 'error'; note?: string; candidates: Candidate[]; autoPick: string | null; autoPickWhy?: string };
export type CandidatesFile = { faceId: string; imageRoot: string; archivePath: string; generatedAt: string; judgeModel?: string; pands: PandCandidates[] };

/** Left-to-right order along a face as seen from the street: project each wall middle on u = (-ny, nx) of the mean outward
 *  normal (the flags.ts groupFaces convention). Pands without a wall take their centroid and the shared normal; ties keep
 *  house-number order. */
export function faceOrder(items: { id: string; mid: Rd; normal?: [number, number]; firstNumber: number }[]): string[] {
  let sx = 0, sy = 0;
  for (const it of items) if (it.normal) { sx += it.normal[0]; sy += it.normal[1]; }
  const len = Math.hypot(sx, sy);
  if (!len) return [...items].sort((a, b) => a.firstNumber - b.firstNumber).map(i => i.id);
  const nx = sx / len, ny = sy / len, ux = -ny, uy = nx;
  return [...items].sort((a, b) => (a.mid.x * ux + a.mid.y * uy) - (b.mid.x * ux + b.mid.y * uy) || a.firstNumber - b.firstNumber).map(i => i.id);
}

let buurten: { code: string; rings: Rd[][] }[] | null = null;
const inRing = (p: Rd, ring: Rd[]) => { let yes = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i].y > p.y) !== (ring[j].y > p.y) && p.x < (ring[j].x - ring[i].x) * (p.y - ring[i].y) / (ring[j].y - ring[i].y) + ring[i].x) yes = !yes; return yes; };
/** CBS buurt code (AC01) holding a point, from coverage-v1/buurten.json. */
export async function buurtOf(p: Rd): Promise<string | null> {
  if (!buurten) {
    const all = JSON.parse(await fs.readFile(path.resolve('public/data/extracts/amsterdam/coverage-v1/buurten.json'), 'utf8')).features as any[];
    buurten = all.map(f => ({ code: f.properties.code, rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly: number[][][]) => poly[0].map(q => lngLatToRd([q[0], q[1]]))) }));
  }
  return buurten.find(b => b.rings.some(r => inRing(p, r)))?.code ?? null;
}

/** The canal-belt buurten of the plan: Grachtengordel-West AC01-AC04 and -Zuid AG01-AG06. */
export const BELT_BUURTEN = ['AC01', 'AC02', 'AC03', 'AC04', 'AG01', 'AG02', 'AG03', 'AG04', 'AG05', 'AG06'] as const;
