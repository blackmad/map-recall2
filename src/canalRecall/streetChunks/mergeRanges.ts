// Street-chunk pand ranges across a primitive merge (lane R4-C #245).
//
// A chunk is one mesh with one primitive per material, each primitive carrying `pandRanges`
// ([pandIndex, firstTriangle, triangleCount], streetChunks/gltf.ts). After the city look many primitives share one
// material object, and the landmark layer merges such siblings into one draw (landmarks/landmarkBatch.ts
// mergeSiblingsByMaterial / mergeLevelByMaterial) by concatenating their triangles in order. The per-pand lift
// (ownGround/chunkBases.ts separatePands, liftPands) and the hover pick (extras.ts pandIndexForFace) read the ranges of
// the drawn geometry, so the merged geometry needs the parts' ranges re-based onto its triangle order.

export type PandRange = readonly [pand: number, firstTriangle: number, triangleCount: number];

export interface RangedPart {
  /** The part's own ranges (absent: a part with no pands, e.g. a catalogue landmark primitive). */
  ranges?: readonly (readonly number[])[] | null;
  /** Triangles the part contributes to the merge, in its own order. */
  triangles: number;
}

/**
 * Ranges of the concatenation of `parts` (each part's triangles follow the previous part's): every range shifted by the
 * triangles before its part. Null when no part has ranges (the merge then leaves `userData` as it was).
 */
export function concatPandRanges(parts: readonly RangedPart[]): [number, number, number][] | null {
  if (!parts.some(p => p.ranges && p.ranges.length)) return null;
  const out: [number, number, number][] = [];
  let offset = 0;
  for (const part of parts) {
    for (const [pand, first, count] of part.ranges ?? []) {
      // A range past the part's end would claim the next part's triangles: clip it to the part.
      const end = Math.min(first + count, part.triangles);
      if (end > first) out.push([pand, offset + first, end - first]);
    }
    offset += part.triangles;
  }
  return out;
}

/** The inverse, for tests and review: the merged ranges cut back into the parts' own triangle numbering. */
export function splitPandRanges(ranges: readonly PandRange[], triangleCounts: readonly number[]): [number, number, number][][] {
  const out: [number, number, number][][] = triangleCounts.map(() => []);
  let start = 0;
  triangleCounts.forEach((n, i) => {
    const end = start + n;
    for (const [pand, first, count] of ranges) {
      const a = Math.max(first, start), b = Math.min(first + count, end);
      if (b > a) out[i].push([pand, a - start, b - a]);
    }
    start = end;
  });
  return out;
}

/** The lowest of a chunk's per-pand bases (metres): the one lift a chunk's lod2 takes from the air. 0 without pands. */
export function lowestPandBase(bases: ReadonlyMap<number, number> | Readonly<Record<string, number>>): number {
  const values = bases instanceof Map ? [...bases.values()] : Object.values(bases);
  let low = Infinity;
  for (const v of values) if (Number.isFinite(v) && v < low) low = v;
  return low === Infinity ? 0 : low;
}
