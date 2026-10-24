// Compact ground meshes (lane perf-phones item 3, 2026-10-24; desktop too since the desktop A/B, issue #28 follow-up). A built cell's layers carry float normals,
// float sRGB colours, 32-bit indices and a uv per vertex that is always its own x, y (drape.ts `vertex`, parks.ts,
// streets.ts bollards). On the GPU that is ~80 bytes a triangle; a centre cell is 28 MB. The worker compacts the
// meshes before transfer when the game asks (gameGround `compactFlag`, every device unless turned off):
//   normals  Int8 normalised (3 bytes, not 12): under half a degree off, invisible in the ground's lighting;
//   colours  linear Uint16 normalised (the sRGB → linear the main thread did, here; 6 bytes, not 12, no banding);
//   indices  Uint16 when the layer has under 65,536 vertices;
//   uvs      dropped: the game reads the uv as the position's x, y from the same GPU buffer (an interleaved view).
// The geometry the GPU draws is the same.

import type { BuiltCell, PackedMesh } from './groundCell.js';
import type { BuiltFar } from './farRing.js';

export interface CompactMesh { positions: Float32Array; normals: Int8Array; indices: Uint16Array | Uint32Array; colors?: Uint16Array }
/** A mesh as the worker sends it: packed (floats, uv array) or compact. */
export type GpuMesh = PackedMesh | CompactMesh;

export const isCompact = (m: GpuMesh): m is CompactMesh => m.normals instanceof Int8Array;

export function compactMesh(p: PackedMesh): CompactMesh {
  const normals = new Int8Array(p.normals.length);
  for (let i = 0; i < normals.length; i++) normals[i] = Math.round(Math.max(-1, Math.min(1, p.normals[i])) * 127);
  const vertices = p.positions.length / 3;
  const indices = vertices <= 65536 ? Uint16Array.from(p.indices) : p.indices;
  const out: CompactMesh = { positions: p.positions, normals, indices };
  if (p.colors) {
    const c = new Uint16Array(p.colors.length);
    // Vertex colours are authored in sRGB; three expects linear (gameGround applied this on the main thread).
    for (let i = 0; i < c.length; i++) c[i] = Math.round(Math.pow(Math.max(0, Math.min(1, p.colors[i])), 2.2) * 65535);
    out.colors = c;
  }
  return out;
}

export const gpuMeshBytes = (m: GpuMesh): number =>
  m.positions.byteLength + m.normals.byteLength + ('uvs' in m ? m.uvs.byteLength : 0) + m.indices.byteLength + (m.colors?.byteLength ?? 0);

export function gpuMeshTransferables(m: GpuMesh): ArrayBuffer[] {
  return [m.positions.buffer, m.normals.buffer, ...('uvs' in m ? [m.uvs.buffer] : []), m.indices.buffer, ...(m.colors ? [m.colors.buffer] : [])] as ArrayBuffer[];
}

/** The cell with compact layers; `stats.bytes` counts what is sent (the mask included). */
export function compactCell(cell: BuiltCell): BuiltCell {
  const layers: Record<string, CompactMesh> = {};
  let bytes = cell.mask ? cell.mask.texels.byteLength : 0;
  for (const [layer, m] of Object.entries(cell.layers)) if (m) { layers[layer] = compactMesh(m); bytes += gpuMeshBytes(layers[layer]); }
  return { ...cell, layers: layers as unknown as BuiltCell['layers'], stats: { ...cell.stats, bytes } };
}

export function compactFar(far: BuiltFar): BuiltFar {
  const parts = far.parts.map(p => ({ key: p.key, mesh: compactMesh(p.mesh) }));
  const bytes = parts.reduce((b, p) => b + gpuMeshBytes(p.mesh), 0);
  return { ...far, parts: parts as unknown as BuiltFar['parts'], stats: { ...far.stats, bytes } };
}

export function cellGpuTransferables(cell: BuiltCell): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const m of Object.values(cell.layers) as GpuMesh[]) if (m) out.push(...gpuMeshTransferables(m));
  if (cell.mask) out.push(cell.mask.texels.buffer as ArrayBuffer);
  return out;
}

export const farGpuTransferables = (far: BuiltFar): ArrayBuffer[] => (far.parts as { mesh: GpuMesh }[]).flatMap(p => gpuMeshTransferables(p.mesh));
