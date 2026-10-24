/**
 * Which BAG pand an OSM-only kit part stands on (kit review round 3, 2026-10-24, GitHub #37).
 *
 * The generic worship/public kits and several hand kits are keyed by OSM building(-part) ways. The BAG-keyed base
 * tiles draw those ways as OSM-only features, so the pand under them is not a tile feature and `resolveSuppressed`
 * finds no pand: the kit sheets showed "no location" / "pand unresolved" for 124 kits. The pand is still in the
 * 3DBAG; scripts/landmarks/build-kit-pands.ts joins each OSM part to the 3DBAG footprints with this rule.
 */
import { shareInside } from './bagTiles.js';
import type { Ring } from './buildingLadder.js';

/** A part this much inside one pand stands on it. */
export const KIT_PAND_SHARE = 0.5;

export type KitPandCandidate = { pand: string; rings: Ring[] };
export type KitPandMatch = { pand: string; share: number; pandShare: number; others: string[] };

/**
 * The pand holding most of the part. A part at least KIT_PAND_SHARE inside a pand takes it; failing that, a pand at
 * least KIT_PAND_SHARE inside the part (one part over several small pands) takes the one with the largest overlap.
 * `others`: further pands the part covers at least 10% of, or that lie at least half inside it.
 */
export function pickKitPand(part: readonly Ring[], candidates: readonly KitPandCandidate[], grid = 32): KitPandMatch | null {
  const scored = candidates
    .map(c => ({ pand: c.pand, share: shareInside(part, c.rings, grid), pandShare: shareInside(c.rings, part, grid) }))
    .filter(c => c.share > 0 || c.pandShare > 0)
    .sort((a, b) => b.share - a.share || b.pandShare - a.pandShare || a.pand.localeCompare(b.pand));
  const best = scored[0]?.share >= KIT_PAND_SHARE ? scored[0] : scored.filter(c => c.pandShare >= KIT_PAND_SHARE).sort((a, b) => b.share - a.share || b.pandShare - a.pandShare)[0];
  if (!best) return null;
  const others = scored.filter(c => c !== best && (c.share >= 0.1 || c.pandShare >= KIT_PAND_SHARE)).map(c => c.pand);
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { pand: best.pand, share: r2(best.share), pandShare: r2(best.pandShare), others };
}

/** public/data/extracts/amsterdam/kit-pands.json `ids`: OSM part id -> the pand digits it stands on (or null). */
export type KitPandJoins = Readonly<Record<string, { pand: string | null }>>;
const PAND_PREFIX = 'NL.IMBAG.Pand.';

/**
 * The BAG pand whose measurements (wall crops, LoD2.2 roof planes) a kit id reads: the id itself when it is a pand, the
 * pand kit-pands.json joins it to when it is an OSM part (w..., r...), else null. kit-pands.json is the one source of
 * truth for the join (GitHub #41): scripts/landmarks/kit-roof-pitch.ts and build-public-facts.ts both read it here.
 */
export function measuredPandFor(id: string, joins: KitPandJoins): string | null {
  if (id.startsWith(PAND_PREFIX)) return id;
  const pand = joins[id]?.pand;
  return pand ? `${PAND_PREFIX}${pand}` : null;
}

/**
 * The joined pand's roof planes over one OSM part: those whose centroid lies inside the part's outline (both in the
 * same planar frame, e.g. RD). Most OSM kit parts are a small share of their pand (a church tower, one of the
 * Bijlmerbios' ten parts), so the pand's whole roof would put the nave's roof on the tower (GitHub #41).
 */
export function planesOverPart<P extends { centroid: readonly [number, number] }>(planes: readonly P[], part: readonly (readonly [number, number])[]): P[] {
  const inside = ([x, y]: readonly [number, number]) => {
    let hit = false;
    for (let i = 0, j = part.length - 1; i < part.length; j = i++) {
      const [xi, yi] = part[i], [xj, yj] = part[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  return planes.filter(p => inside(p.centroid));
}
