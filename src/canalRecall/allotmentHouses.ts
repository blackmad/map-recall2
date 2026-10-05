/** Small garden houses: approximate single-storey architecture on mapped footprints.
 * Colours, openings and heights are display priors, not individual-house surveys.
 * Geometry lives in the walls chunk at both LODs, so camera pans keep the windows.
 */
import earcut from 'earcut';
import { ExtraSink, hash01, type FlatTri, type V3, type WallFrame } from './facadeExtraCore.js';
import { fitRect } from './roofMesh.js';
import type { Chunk } from './threeBuildingMesh.js';

type Feature = { properties: Record<string, unknown>; geometry: unknown };
type Point = [number, number];
export const isAllotmentHouse = (f: Feature): boolean => {
  if (f.properties.allotmentHouse !== 'garden-house-v1') return false;
  const g = f.geometry as { type?: string; coordinates?: number[][][][] | number[][][] };
  const polygons = g?.type === 'Polygon' ? [g.coordinates as number[][][]] : g?.type === 'MultiPolygon' ? g.coordinates as number[][][][] : [];
  return !!polygons?.length && polygons.every(p => p.length === 1 && p[0].length >= 4);
};
const WALLS = ['#385342', '#6d5845', '#6f2522', '#ddd7c5', '#45535b', '#34433a'];
const ROOFS = ['#555755', '#614d44', '#9a583f', '#474b50'];
const rgb = (hex: string): number[] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** Clip one triangulated footprint face at the ridge: each half has a planar roof. */
function half(points: Point[], value: (p: Point) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], da = value(a), db = value(b);
    if (da >= -1e-8) out.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

export function allotmentHouseTriangles(feature: Feature, origin: { lng: number; lat: number }, coarse = false, counts?: { walls: number; quads: number }): FlatTri[] {
  const shape = feature.geometry as { type: string; coordinates: number[][][][] };
  if (shape?.type === 'MultiPolygon') return shape.coordinates.flatMap(coordinates => allotmentHouseTriangles({ ...feature, geometry: { type: 'Polygon', coordinates } }, origin, coarse, counts));
  const g = feature.geometry as { type: string; coordinates: number[][][] };
  if (g?.type !== 'Polygon' || g.coordinates.length !== 1) return [];
  const kx = 111320 * Math.cos(origin.lat * Math.PI / 180);
  let ring: Point[] = g.coordinates[0].map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * 110540]);
  if (ring.length > 1 && Math.hypot(ring[0][0] - ring.at(-1)![0], ring[0][1] - ring.at(-1)![1]) < .001) ring.pop();
  const area = ring.reduce((s, a, i) => { const b = ring[(i + 1) % ring.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
  if (area < 0) ring = ring.reverse();
  const rect = fitRect(ring, 80);
  if (!rect || rect.wid < 1 || rect.len < 1) return [];
  const id = String(feature.properties.id), seed = hash01(id);
  const eaves = 2.25 + seed * .25, rise = .65 + hash01(`${id}:roof`) * .35;
  const wall = WALLS[Math.floor(seed * WALLS.length)], roof = ROOFS[Math.floor(hash01(`${id}:roof-tone`) * ROOFS.length)];
  const flat = feature.properties.roofShape === 'flat';
  const v = ([x, y]: Point) => -(x - rect.cx) * rect.uy + (y - rect.cy) * rect.ux;
  const roofZ = (p: Point) => eaves + (flat ? 0 : rise * Math.max(0, 1 - Math.abs(v(p)) / (rect.wid / 2)));
  const sink = new ExtraSink(10000);
  const face = (p: V3[], hex: string, n: V3) => {
    for (let i = 1; i + 1 < p.length; i++) {
      const q = [p[0], p[i], p[i + 1]], a = q[1].map((x, k) => x - q[0][k]), b = q[2].map((x, k) => x - q[0][k]);
      const c: V3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const length = Math.hypot(...c); if (length < 1e-7) continue;
      const flip = c.reduce((s, x, k) => s + x * n[k], 0) < 0;
      sink.tris.push({ p: flip ? [q[0], q[2], q[1]] : q, hex, n: c.map(x => x / length * (flip ? -1 : 1)) as V3 });
    }
  };
  const edges: WallFrame[] = ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { x0: a[0], y0: a[1], ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len, nx: (b[1] - a[1]) / len, ny: -(b[0] - a[0]) / len, len };
  });
  const front = edges.reduce((best, e, i) => e.len > edges[best].len ? i : best, 0);
  const panel = (f: WallFrame, a0: number, a1: number, z0: number, z1: number, colour: string, out: number) => {
    if (sink.wallQuad(f, [[a0, z0], [a1, z0], [a1, z1], [a0, z1]], out, colour) && counts) counts.quads++;
  };
  for (const [i, f] of edges.entries()) {
    if (f.len < .01) continue;
    if (counts) { counts.walls++; counts.quads++; }
    const a = ring[i], b = ring[(i + 1) % ring.length];
    face([[...a, 0], [...b, 0], [...b, eaves], [...a, eaves]], wall, [f.nx, f.ny, 0]);
    // Close triangular ends against the same native roof height function.
    let top: Point[] = [a, b];
    if (!flat && v(a) * v(b) < 0) { const t = v(a) / (v(a) - v(b)); top = [a, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], b]; }
    for (let k = 0; k + 1 < top.length; k++) face([[...top[k], eaves], [...top[k + 1], eaves], [...top[k + 1], roofZ(top[k + 1])], [...top[k], roofZ(top[k])]], wall, [f.nx, f.ny, 0]);
    if (f.len < 2.1) continue;
    panel(f, 0, f.len, eaves - .09, eaves, '#e6e1d2', .025);
    const door = i === front && f.len > 3;
    if (door) {
      const center = f.len * .25, width = .8;
      panel(f, center - width / 2 - .06, center + width / 2 + .06, .04, 2.08, '#e6e1d2', .03);
      panel(f, center - width / 2, center + width / 2, .06, 2.02, '#3e4840', .045);
      panel(f, center - .23, center + .23, 1.15, 1.87, '#526b76', .055);
    }
    const centers = door ? [f.len * .68] : f.len > 5.3 ? [f.len * .3, f.len * .7] : [f.len * .5];
    for (const center of centers) {
      const width = Math.min(1.25, f.len * .28);
      panel(f, center - width / 2 - .055, center + width / 2 + .055, .86, 1.99, '#e6e1d2', .03);
      panel(f, center - width / 2, center + width / 2, .92, 1.93, '#526b76', .045);
      if (!coarse) panel(f, center - .025, center + .025, .92, 1.93, '#e6e1d2', .055);
    }
  }
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map(k => ring[k]);
    const parts = flat ? [triangle] : [half(triangle, v), half(triangle, p => -v(p))];
    for (const part of parts) if (part.length >= 3) face(part.map(p => [...p, roofZ(p)] as V3), roof, [0, 0, 1]);
  }
  return sink.tris;
}

/** Append the bounded flat-colour meshes to the existing renderer's chunk format. */
export function appendAllotmentHouses(chunk: Chunk, features: readonly Feature[], origin: { lng: number; lat: number }, flatLayer: number, coarse: boolean): Chunk {
  const positions = Array.from(chunk.positions), uvs = Array.from(chunk.uvs), layers = Array.from(chunk.layers), tints = Array.from(chunk.tints), accents = Array.from(chunk.accents), indices = Array.from(chunk.indices), ranges = [...chunk.ranges];
  let added = 0;
  const counts = { walls: 0, quads: 0 };
  for (const f of features) {
    const tris = allotmentHouseTriangles(f, origin, coarse, counts); if (!tris.length) continue;
    const start = positions.length / 3;
    for (const tri of tris) {
      const colour = rgb(tri.hex), shade = .78 + Math.max(0, tri.n[2]) * .2 + tri.n[0] * .05 - tri.n[1] * .04;
      for (const p of tri.p) {
        indices.push(positions.length / 3); positions.push(...p); uvs.push(0, 0); layers.push(flatLayer);
        tints.push(...colour, Math.round(Math.min(1, shade) * 255)); accents.push(255, 255, 255, 255);
      }
    }
    ranges.push({ id: String(f.properties.id), start, count: positions.length / 3 - start }); added++;
  }
  return { ...chunk, positions: new Float32Array(positions), uvs: new Float32Array(uvs), layers: new Uint8Array(layers), tints: new Uint8Array(tints), accents: new Uint8Array(accents), indices: new Uint32Array(indices), ranges, vertexCount: positions.length / 3, buildingCount: chunk.buildingCount + added, wallCount: chunk.wallCount + counts.walls, quadCount: chunk.quadCount + counts.quads };
}
