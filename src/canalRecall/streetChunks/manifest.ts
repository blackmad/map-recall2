/**
 * Chunk manifest: what the ordinary-buildings loader needs to draw a block
 * face as ONE model and keep per-pand behaviour.
 *
 * One entry per chunk. The loader treats an entry like an ordinary catalogue
 * model with several BAG ids:
 *   - `suppress` lists every pand the chunk replaces (exact BAG-host
 *     suppression, as `suppressOsmIds`);
 *   - `replaces` lists the per-house catalogue ids (`ordinary-<pand>`) the chunk
 *     supersedes: when the chunk is enabled those specs are not loaded, so no
 *     house is drawn twice;
 *   - `instance` places the GLB (chunk frame) exactly like a shared house mesh;
 *   - `pands[]` carries per-pand footprints, addresses and triangle ranges for
 *     hover/cards (`pandForTriangle`) and per-building review.
 */
import {createHash} from 'node:crypto';
import type {ChunkResult, PandMeta} from './types.ts';

export interface ChunkManifestEntry {
  id: string;
  name: string;
  modelUrl: string;
  sha256: string;
  bytes: number;
  triangles: number;
  primitives: number;
  instance: {anchor: [number, number]; northOffsetDegrees: number; mirror: false};
  bounds: {min: number[]; max: number[]};
  /** Tallest roof/crown in the chunk, metres above the chunk ground. */
  height: number;
  suppress: string[];
  replaces: string[];
  footprint: {type: 'MultiPolygon'; coordinates: number[][][][]};
  pands: Pick<PandMeta, 'recipeId' | 'pandId' | 'buildingId' | 'address' | 'frontage' | 'bounds' | 'triangles' | 'ranges'>[];
}

export interface ChunkManifest { version: 1; generatedAt: string; chunks: ChunkManifestEntry[] }

export function buildChunkManifest(results: ChunkResult[], urlFor: (name: string) => string, generatedAt = new Date().toISOString()): ChunkManifest {
  return {
    version: 1, generatedAt,
    chunks: results.map(r => {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const p of r.pands) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p.bounds.min[k]); max[k] = Math.max(max[k], p.bounds.max[k]); }
      const sha256 = createHash('sha256').update(r.glb).digest('hex'), url = urlFor(r.name);
      return {
        id: `chunk-${r.name}`, name: r.name, modelUrl: url.includes('?') ? url : `${url}?asset=${sha256.slice(0, 16)}`, sha256, bytes: r.glb.length,
        triangles: r.report.triangles.chunk, primitives: r.report.primitives.chunk,
        instance: {anchor: r.frame.anchor, northOffsetDegrees: r.frame.northOffsetDegrees, mirror: false as const},
        bounds: {min, max}, height: max[1],
        suppress: r.pands.map(p => p.buildingId), replaces: r.pands.map(p => `ordinary-${p.pandId}`),
        footprint: {type: 'MultiPolygon' as const, coordinates: r.pands.map(p => p.footprint)},
        pands: r.pands.map(({recipeId, pandId, buildingId, address, frontage, bounds, triangles, ranges}) => ({recipeId, pandId, buildingId, address, frontage, bounds, triangles, ranges})),
      };
    }),
  };
}
