import type { Chunk, Origin } from './threeBuildingMesh.js';

/** Pre-upload clipping: coordinates must be native east / height / south metres.
 * The caller supplies an exact source edge, never a nearest-wall search.
 * Run before GPU upload; attributes whose CPU arrays were released are unsupported.
 */
export type HostOpeningConfig = {
  hostIdentity: string;
  enabled: boolean;
  additiveModelAvailable: boolean;
  wallEdge: readonly [readonly [number, number], readonly [number, number]];
  authorAngleRadians: number;
  halfWidth: number;
  springHeight: number;
  crownHeight: number;
  portalDepth: number;
  archSegments?: number;
};
type Vertex = Record<string, number[]>;
type AttributeArray = Float32Array | Float64Array | Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array;
export type HostWallAttribute = { array: AttributeArray; itemSize: number; normalized?: boolean };
export type HostWallGeometry = { attributes: Record<string, HostWallAttribute>; indices?: Uint32Array };

/** Expected source/config rejection. Programming and corrupt chunk errors still propagate. */
export class HostOpeningValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'HostOpeningValidationError'; }
}

export type HostOpeningResult = {
  geometry: HostWallGeometry;
  /** Native east/height/south loose triangles, excluding the ground threshold. */
  reveals: Float32Array[];
  active: boolean;
  selectedTriangles: number;
  removedArea: number;
};

/** Subtract a convex, ground-connected arch from explicit wall-plane triangles.
 * Other triangles and their facade attributes survive exactly. This does not
 * cut rear walls, roofs, floor caps or a covered passage's unknown interior.
 */
export function cutHostWallOpening(
  geometry: HostWallGeometry, identity: string, config: HostOpeningConfig,
): HostOpeningResult {
  const fallback = { geometry, reveals: [], active: false, selectedTriangles: 0, removedArea: 0 };
  if (identity !== config.hostIdentity || !config.enabled || !config.additiveModelAvailable) return fallback;
  const { halfWidth: r, springHeight: spring, crownHeight: crown, portalDepth: depth } = config;
  if (!Array.isArray(config.wallEdge) || config.wallEdge.length !== 2
    || ![0, 1].every(i => { const p = config.wallEdge[i]; return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]); })
    || ![r, spring, crown, depth, config.authorAngleRadians, ...config.wallEdge.flat()].every(Number.isFinite)
    || r <= 0 || spring <= 0 || crown <= spring || depth <= 0) throw new HostOpeningValidationError('Invalid explicit host opening dimensions');
  const segments = config.archSegments ?? 32;
  if (!Number.isInteger(segments) || segments < 8 || segments > 128) throw new HostOpeningValidationError('Invalid arch segment count');
  const c = Math.cos(config.authorAngleRadians), s = Math.sin(config.authorAngleRadians);
  const ax = (east: number, south: number) => east * c - south * s;
  const [p, q] = config.wallEdge;
  const dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
  const xp = ax(...p), xq = ax(...q);
  if (length < .01 || Math.min(xp, xq) >= -r || Math.max(xp, xq) <= r) throw new HostOpeningValidationError('Explicit edge does not contain opening');
  const profile: [number, number][] = [[-r, 0], [r, 0], [r, spring]];
  for (let i = 1; i <= segments; i++) {
    const theta = Math.PI * i / segments;
    profile.push([r * Math.cos(theta), spring + (crown - spring) * Math.sin(theta)]);
  }
  const attributes = Object.entries(geometry.attributes);
  if (!geometry.attributes.position || geometry.attributes.position.itemSize !== 3) throw Error('Native position attribute required');
  for (const [name, attr] of attributes) {
    if (!attr.array) throw Error(`Unsupported/released CPU attribute: ${name}`);
  }
  const values = Object.fromEntries(attributes.map(([name]) => [name, [] as number[]]));
  const output: HostWallGeometry = { attributes: {} };
  let selectedTriangles = 0, removedArea = 0;
  const read = (index: number): Vertex => Object.fromEntries(attributes.map(([name, attr]) => [name,
    Array.from({ length: attr.itemSize }, (_, j) => Number(attr.array[index * attr.itemSize + j]))]));
  const xy = (v: Vertex) => [ax(v.position[0], v.position[2]), v.position[1]];
  const mix = (a: Vertex, b: Vertex, t: number): Vertex => Object.fromEntries(attributes.map(([name]) => [name, a[name].map((v, j) => v + (b[name][j] - v) * t)]));
  const signed = (v: Vertex, a: number[], b: number[]) => {
    const point = xy(v); return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
  };
  function clip(poly: Vertex[], a: number[], b: number[], inside: boolean): Vertex[] {
    const result: Vertex[] = [];
    for (let i = 0; i < poly.length; i++) {
      const u = poly[i], v = poly[(i + 1) % poly.length], du = signed(u, a, b), dv = signed(v, a, b);
      const keepU = inside ? du >= 0 : du <= 0, keepV = inside ? dv >= 0 : dv <= 0;
      if (keepU) result.push(u);
      if (keepU !== keepV) result.push(mix(u, v, du / (du - dv)));
    }
    return result;
  }
  const area = (a: Vertex, b: Vertex, d: Vertex) => {
    const u = b.position.map((v, i) => v - a.position[i]), w = d.position.map((v, i) => v - a.position[i]);
    return Math.hypot(u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]) / 2;
  };
  function emit(poly: Vertex[]) {
    for (let j = 1; j + 1 < poly.length; j++) {
      if (area(poly[0], poly[j], poly[j + 1]) < 1e-10) continue;
      for (const v of [poly[0], poly[j], poly[j + 1]]) for (const [name] of attributes) values[name].push(...v[name]);
    }
  }
  const total = geometry.indices?.length ?? geometry.attributes.position.array.length / 3;
  for (let i = 0; i < total; i += 3) {
    const triangle = [0, 1, 2].map(j => read(geometry.indices ? geometry.indices[i + j] : i + j));
    const onEdge = triangle.every(v => {
      const [x, , z] = v.position;
      const projection = ((x - p[0]) * dx + (z - p[1]) * dz) / length;
      return Math.abs((x - p[0]) * dz - (z - p[1]) * dx) / length < .002 && projection >= -.002 && projection <= length + .002;
    });
    if (!onEdge) { emit(triangle); continue; }
    selectedTriangles++;
    let remainder = triangle;
    for (let k = 0; k < profile.length && remainder.length; k++) {
      const a = profile[k], b = profile[(k + 1) % profile.length];
      emit(clip(remainder, a, b, false));
      remainder = clip(remainder, a, b, true);
    }
    for (let j = 1; j + 1 < remainder.length; j++) removedArea += area(remainder[0], remainder[j], remainder[j + 1]);
  }
  if (!selectedTriangles || removedArea < .01) throw new HostOpeningValidationError('Explicit installed wall plane has no cuttable opening; retain fallback');
  for (const [name, attr] of attributes) {
    const Constructor = attr.array.constructor as { new(values: number[]): AttributeArray };
    output.attributes[name] = { array: new Constructor(values[name]), itemSize: attr.itemSize, normalized: attr.normalized };
  }
  // The front follows the installed plane; the back follows authored -Z for
  // only the verified portal depth. No rear cap, threshold or invented ceiling.
  const front = (x: number, y: number) => {
    const t = (x - xp) / (xq - xp); return [p[0] + t * dx, y, p[1] + t * dz];
  };
  const interior = [-s * depth, 0, -c * depth];
  const revealValues: number[] = [];
  // Skip profile edge 0: it is the ground opening, which must remain clear.
  for (let i = 1; i < profile.length; i++) {
    const a = front(...profile[i]), b = front(...profile[(i + 1) % profile.length]);
    const ab = a.map((v, i) => v + interior[i]), bb = b.map((v, i) => v + interior[i]);
    for (const point of [a, b, ab, b, bb, ab]) revealValues.push(...point);
  }
  return { geometry: output, reveals: [new Float32Array(revealValues)], active: true, selectedTriangles, removedArea };
}


/** Native gate coordinates are east/height/south around this geographic anchor.
 * wallEdge must identify the installed source edge in that same local frame.
 * revealLayer must be a bare/flat texture layer, never a door/window cell.
 */
export type ChunkHostOpeningConfig = HostOpeningConfig & {
  anchorLngLat: readonly [number, number];
  revealLayer: number;
};

/** Explicit, source-owned subtraction on CPU chunk data before GPU upload.
 * Unconfigured ranges retain their original indexed vertices and attributes.
 * Disabled/unavailable configurations return the original chunk object.
 * Extras are intentionally not passed here by buildChunk: their relief is retained.
 */
export function applyHostWallOpenings(chunk: Chunk, origin: Origin, configs: readonly ChunkHostOpeningConfig[]): Chunk {
  const active = configs.filter(c => c.enabled && c.additiveModelAvailable && chunk.ranges.some(r => r.id === c.hostIdentity));
  if (!active.length) return chunk;
  // Ambiguous duplicate configuration rejects only that host, never its ordinary walls.
  const configByHost = new Map<string, ChunkHostOpeningConfig | undefined>();
  for (const config of active) configByHost.set(config.hostIdentity, configByHost.has(config.hostIdentity) ? undefined : config);
  const hostOpeningIds: string[] = [];
  let successfulCuts = 0;
  const owners = new Int32Array(chunk.vertexCount).fill(-1);
  chunk.ranges.forEach((r, i) => owners.fill(i, r.start, r.start + r.count));
  const byRange = chunk.ranges.map(() => [] as number[]);
  for (let i = 0; i < chunk.indices.length; i += 3) {
    const a = chunk.indices[i], b = chunk.indices[i + 1], c = chunk.indices[i + 2], owner = owners[a];
    if (owner < 0 || owners[b] !== owner || owners[c] !== owner) throw Error('Host opening requires wholly source-owned triangles');
    byRange[owner].push(a, b, c);
  }
  const parts = chunk.ranges.map((range, ri) => {
    const source = {
      positions: chunk.positions.slice(range.start * 3, (range.start + range.count) * 3),
      uvs: chunk.uvs.slice(range.start * 2, (range.start + range.count) * 2),
      layers: chunk.layers.slice(range.start, range.start + range.count),
      tints: chunk.tints.slice(range.start * 4, (range.start + range.count) * 4),
      accents: chunk.accents.slice(range.start * 4, (range.start + range.count) * 4),
      indices: Uint32Array.from(byRange[ri], i => i - range.start),
    };
    const config = configByHost.get(range.id);
    if (!config) return source;
    // Keep validation and construction transactional per host. No wrong-plane remap.
    try {
      if (!Number.isInteger(config.revealLayer) || config.revealLayer < 0 || config.revealLayer > 255
        || !Array.isArray(config.anchorLngLat) || config.anchorLngLat.length !== 2
        || ![0, 1].every(i => Number.isFinite(config.anchorLngLat[i]))) throw new HostOpeningValidationError('Invalid opening anchor/reveal layer');
      const east = (config.anchorLngLat[0] - origin.lng) * 111320 * Math.cos(origin.lat * Math.PI / 180);
      const north = (config.anchorLngLat[1] - origin.lat) * 110540;
      const local = new Float32Array(source.positions.length);
      for (let i = 0; i < local.length; i += 3) {
        local[i] = source.positions[i] - east;
        local[i + 1] = source.positions[i + 2];
        local[i + 2] = north - source.positions[i + 1];
      }
      const g: HostWallGeometry = { attributes: {
        position: { array: local, itemSize: 3 },
        // Carry the original frame separately to avoid round-trip drift on retained roofs/walls.
        chunkPosition: { array: source.positions, itemSize: 3 },
        uv: { array: source.uvs, itemSize: 2 }, layer: { array: source.layers, itemSize: 1 },
        tint: { array: source.tints, itemSize: 4, normalized: true },
        accent: { array: source.accents, itemSize: 4, normalized: true },
      }, indices: source.indices };
      const cut = cutHostWallOpening(g, range.id, config);
      const position = Array.from(cut.geometry.attributes.chunkPosition.array);
      const uv = Array.from(cut.geometry.attributes.uv.array);
      const layer = Array.from(cut.geometry.attributes.layer.array);
      const tint = Array.from(cut.geometry.attributes.tint.array);
      const accent = Array.from(cut.geometry.attributes.accent.array);
      // Borrow only wall colour from the exact selected edge; reveals get a flat layer.
      const [p, q] = config.wallEdge, dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      let wallVertex = -1;
      for (let i = 0; i < local.length / 3; i++) {
        const along = ((local[i * 3] - p[0]) * dx + (local[i * 3 + 2] - p[1]) * dz) / len;
        if (along >= -.002 && along <= len + .002 && local[i * 3 + 1] < config.crownHeight && Math.abs((local[i * 3] - p[0]) * dz - (local[i * 3 + 2] - p[1]) * dx) / len < .002) { wallVertex = i; break; }
      }
      if (wallVertex < 0) throw new HostOpeningValidationError('No source facade material for bounded reveal');
      for (const reveal of cut.reveals) {
        for (let i = 0; i < reveal.length; i += 3) {
          position.push(reveal[i] + east, north - reveal[i + 2], reveal[i + 1]);
          uv.push(.5, .5); layer.push(config.revealLayer);
          tint.push(...source.tints.slice(wallVertex * 4, wallVertex * 4 + 4));
          accent.push(255, 255, 255, 255);
        }
      }
      successfulCuts++;
      hostOpeningIds.push(range.id);
      return { positions: new Float32Array(position), uvs: new Float32Array(uv), layers: new Uint8Array(layer),
        tints: new Uint8Array(tint), accents: new Uint8Array(accent), indices: Uint32Array.from(layer, (_, i) => i) };
    } catch (error) {
      if (!(error instanceof HostOpeningValidationError)) throw error;
      return source;
    }
  });
  if (!successfulCuts) return chunk;
  const vertexCount = parts.reduce((sum, p) => sum + p.layers.length, 0);
  const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const layers = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4), accents = new Uint8Array(vertexCount * 4);
  const indices = new Uint32Array(parts.reduce((sum, p) => sum + p.indices.length, 0));
  let vertex = 0, index = 0;
  const ranges = parts.map((part, i) => {
    positions.set(part.positions, vertex * 3); uvs.set(part.uvs, vertex * 2); layers.set(part.layers, vertex);
    tints.set(part.tints, vertex * 4); accents.set(part.accents, vertex * 4);
    for (const j of part.indices) indices[index++] = vertex + j;
    const range = { id: chunk.ranges[i].id, start: vertex, count: part.layers.length };
    vertex += range.count; return range;
  });
  return { ...chunk, positions, uvs, layers, tints, accents, indices, ranges, vertexCount, hostOpeningIds,
    quadCount: chunk.quadCount + Math.ceil((indices.length - chunk.indices.length) / 6) };
}
