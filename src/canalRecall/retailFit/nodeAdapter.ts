// Node-frame adapter (lane retail-fit-20261120): a placed GLB's tenant overlay as one extra primitive in the GLB's own
// frame, so nodeFrame/scene.ts places and shades it exactly as the model (modelDraws with the same matrix).
import type { GlbScene } from '../glbRaster/load.js';
import { hasRetailFit, retailFitMesh, storedOpenings, type FitPlaced } from './overlay.js';

const GLASS = /glass|glaz/i;

/** `M`: the model's GLB-to-world 3x4 (row-major, nodeFrame models.ts modelMatrix); `world(lng, lat)` the frame's map. */
export function retailFitScene(model: string, glb: GlbScene, M: readonly number[], world: (lng: number, lat: number) => [number, number]): { scene: GlbScene; triangles: number; placed: FitPlaced[] } | null {
  if (!hasRetailFit(model)) return null;
  const glass = glb.primitives.filter(p => { const m = glb.materials[p.material]; return m.extras?.materialSlot === 'glass' || GLASS.test(m.name); });
  if (!glass.length && !storedOpenings(model)) return null;
  let sx = 0, sz = 0, n = 0;
  for (const p of glb.primitives) for (let i = 0; i < p.positions.length; i += 3) { sx += p.positions[i]; sz += p.positions[i + 2]; n++; }
  // Invert the matrix's plan part: world (X, Y) = [M0 M2; M4 M6] (x, z) + (M3 + M1 y, M7 + M5 y); y does not move it.
  const det = M[0] * M[6] - M[2] * M[4];
  const toNative = (lng: number, lat: number): [number, number] => {
    const [X, Y] = world(lng, lat), a = X - M[3], b = Y - M[7];
    return [(a * M[6] - b * M[2]) / det, (b * M[0] - a * M[4]) / det];
  };
  const r = retailFitMesh(model, glass.map(p => ({ positions: p.positions, indices: p.indices })), [sx / n, sz / n], toNative);
  if (!r) return null;
  const vcount = r.mesh.positions.length / 3, colors = new Float32Array(vcount * 4);
  for (let v = 0; v < vcount; v++) { colors[v * 4] = r.mesh.colors[v * 3]; colors[v * 4 + 1] = r.mesh.colors[v * 3 + 1]; colors[v * 4 + 2] = r.mesh.colors[v * 3 + 2]; colors[v * 4 + 3] = 1; }
  const scene: GlbScene = {
    bytes: 0,
    materials: [{ name: 'retail-fit', baseColor: [1, 1, 1, 1], baseColorTexture: null, emissive: [0, 0, 0], alphaMode: 'OPAQUE', alphaCutoff: 0.5, doubleSided: false, unlit: false, metallic: 0, roughness: 1, extras: {} }],
    primitives: [{ positions: r.mesh.positions, normals: r.mesh.normals, uvs: null, colors, indices: Uint32Array.from({ length: vcount }, (_, i) => i), material: 0, ...(r.pandRanges.length ? { extras: { pandRanges: r.pandRanges } } : {}) } as GlbScene['primitives'][number]],
  };
  return { scene, triangles: r.mesh.triangles, placed: r.placed };
}
