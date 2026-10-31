/**
 * Block faces of a whole buurt (scripts/block-face/buurt-survey.ts): the pands of one neighbourhood grouped into
 * street-side runs, the same rule as blockFace/discover.ts and street-surveys/commercial-faces.ts. A pand belongs to
 * the street of most of its BAG units; per street and side (house-number parity), pands with a frontage are joined
 * by shared BAG party walls (>= `minPartyM`, front normals within `minDot`), a break being a cross street or a gap.
 * Faces whose pands are already members of an authored face are reported as covered, not proposed again.
 */
import type {RD} from '../buildingRecipe/facts.ts';
import {sharedEdgeLength} from './discover.ts';

export interface BuurtPand {
  pandId: string;
  /** The street most of its BAG units are numbered on. */
  street: string;
  numbers: number[];
  /** Numbers on other streets (corner pands). */
  otherStreets: Record<string, number[]>;
  side: 'odd' | 'even';
  builtYear: number | null;
  storeys3dbag: number | null;
  units: number;
  /** gebruiksdoel of the ground-level units. */
  groundUses: string[];
  frontWidthM?: number; eavesM?: number; ridgeM?: number; roofMaxM?: number;
  normal?: [number, number]; frontMidRD?: [number, number];
  factsError?: string;
  rings?: RD[][];
  /** An authored block face that already holds this pand. */
  face?: string;
}

export interface ProposedFace {
  id: string; street: string; side: 'odd' | 'even'; seed: string;
  /** Left to right as seen from the street. */
  members: string[];
  numbers: [number, number];
  lengthM: number;
  /** Set when most members are already on an authored face. */
  covered?: string;
}

export function pointInPolygon(p: readonly number[], ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Short face-id prefix of a street: the last word without `straat` ("Jan Pieter Heijestraat" -> "heije"). */
export const streetPrefix = (street: string) => street.toLowerCase().split(/\s+/).at(-1)!.replace(/straat$/, '').replace(/[^a-z0-9]/g, '') || 'street';

/**
 * Split a face (members in street order) where its frontage bends: a chunk compiles only houses whose fronts are within
 * ~11 degrees (streetChunks/compileChunk.ts, dot 0.98), so a curved street (Albert Luthulistraat, Transvaalbuurt: 151 deg
 * on 1-19, 126 deg on 21-41) is proposed as one face per straight run. A run grows in street order while every member's
 * normal stays within `chunkDot` of the run's mean normal (the chunk's own test). A straight face is one run (unchanged).
 */
export function bendRuns<P extends {normal?: [number, number]}>(members: P[], chunkDot = 0.98): P[][] {
  // The chunk tests every front against the run's MEAN direction (chunkFrame), so a run grows while that holds.
  const holds = (run: P[]) => {
    const ns = run.map(m => m.normal).filter((n): n is [number, number] => !!n);
    const sx = ns.reduce((a, n) => a + n[0], 0), sy = ns.reduce((a, n) => a + n[1], 0), len = Math.hypot(sx, sy);
    return len > 0 && ns.every(n => (n[0] * sx + n[1] * sy) / len >= chunkDot);
  };
  const runs: P[][] = [];
  for (const m of members) {
    const run = runs.at(-1);
    if (run && holds([...run, m])) run.push(m); else runs.push([m]);
  }
  return runs;
}

export function proposeFaces(pands: BuurtPand[], o: {minPartyM?: number; minDot?: number; chunkDot?: number; existingIds?: Set<string>} = {}): ProposedFace[] {
  const minParty = o.minPartyM ?? 1, minDot = o.minDot ?? 0.8, chunkDot = o.chunkDot ?? 0.98;
  const out: ProposedFace[] = [], used = new Set(o.existingIds ?? []);
  const groups = new Map<string, BuurtPand[]>();
  for (const p of pands) if (p.normal && p.rings) { const k = `${p.street}|${p.side}`; groups.set(k, [...(groups.get(k) ?? []), p]); }
  for (const [key, list] of [...groups.entries()].sort()) {
    const [street, side] = key.split('|') as [string, 'odd' | 'even'];
    const seen = new Set<string>();
    for (const seed of [...list].sort((a, b) => a.numbers[0] - b.numbers[0])) {
      if (seen.has(seed.pandId)) continue;
      const comp = [seed]; seen.add(seed.pandId);
      for (let i = 0; i < comp.length; i++) for (const c of list) {
        if (seen.has(c.pandId)) continue;
        const n = c.normal!, m = comp[i].normal!;
        if (n[0] * m[0] + n[1] * m[1] < minDot) continue;
        if (comp[i].rings!.some(ra => c.rings!.some(rb => sharedEdgeLength(ra, rb, 0.1) >= minParty))) { seen.add(c.pandId); comp.push(c); }
      }
      const n0 = seed.normal!, u = [-n0[1], n0[0]];
      const along = (p: BuurtPand) => p.frontMidRD![0] * u[0] + p.frontMidRD![1] * u[1];
      comp.sort((a, b) => along(a) - along(b));
      for (const run of bendRuns(comp, chunkDot)) {
        const nums = run.flatMap(c => c.numbers);
        const covered = run.filter(c => c.face);
        const runSeed = run.includes(seed) ? seed : run[0];
        let id = `${streetPrefix(street)}-${Math.min(...nums)}-${Math.max(...nums)}`;
        if (used.has(id)) id += `-${runSeed.pandId.slice(-6)}`;
        used.add(id);
        out.push({id, street, side, seed: runSeed.pandId, members: run.map(c => c.pandId), numbers: [Math.min(...nums), Math.max(...nums)],
          lengthM: +run.reduce((s, c) => s + (c.frontWidthM ?? 0), 0).toFixed(1), ...(covered.length * 2 >= run.length ? {covered: covered[0].face} : {})});
      }
    }
  }
  return out;
}
