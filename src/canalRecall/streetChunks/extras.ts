/**
 * Reading a chunk's per-pand metadata back (runtime and review): the glTF node
 * carries `extras.streetChunk`; three's GLTFLoader exposes it as
 * `scene.children[0].userData.streetChunk`, and each primitive's
 * `extras.pandRanges` as `geometry.userData.pandRanges`.
 */
import type {PandMeta} from './types.ts';

export interface ChunkExtras {
  version: 1;
  name: string;
  frame: {anchor: [number, number]; northOffsetDegrees: number};
  pands: PandMeta[];
}

/** Validate and return the chunk extras of a node's `extras`/`userData`; null when the model is not a chunk. */
export function readChunkExtras(extras: unknown): ChunkExtras | null {
  const chunk = (extras as {streetChunk?: ChunkExtras} | null | undefined)?.streetChunk;
  if (!chunk || chunk.version !== 1 || !Array.isArray(chunk.pands)) return null;
  return chunk;
}

/** Which pand owns triangle `triangle` of primitive `primitive`? Index into `pands`, or -1. */
export function pandForTriangle(pands: Pick<PandMeta, 'ranges'>[], primitive: number, triangle: number): number {
  for (let i = 0; i < pands.length; i++) {
    for (const r of pands[i].ranges) if (r.primitive === primitive && triangle >= r.firstTriangle && triangle < r.firstTriangle + r.triangleCount) return i;
  }
  return -1;
}

/** Pand index owning `faceIndex` given a primitive's `pandRanges` ([pandIndex, firstTriangle, triangleCount][]); -1 when unknown. */
export function pandIndexForFace(ranges: readonly (readonly number[])[] | undefined, faceIndex: number | undefined): number {
  if (!ranges || faceIndex === undefined) return -1;
  for (const [pand, first, count] of ranges) if (faceIndex >= first && faceIndex < first + count) return pand;
  return -1;
}
