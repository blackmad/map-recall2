import * as T from 'three';

/** CPU prototype: coordinates must be native east / height / south metres.
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
export type HostOpeningResult = {
  geometry: T.BufferGeometry;
  reveals: T.BufferGeometry[];
  active: boolean;
  selectedTriangles: number;
  removedArea: number;
};

/** Subtract a convex, ground-connected arch from explicit wall-plane triangles.
 * Other triangles and their facade attributes survive exactly. This does not
 * cut rear walls, roofs, floor caps or a covered passage's unknown interior.
 */
export function cutHostWallOpening(
  geometry: T.BufferGeometry, identity: string, config: HostOpeningConfig,
): HostOpeningResult {
  const fallback = { geometry, reveals: [], active: false, selectedTriangles: 0, removedArea: 0 };
  if (identity !== config.hostIdentity || !config.enabled || !config.additiveModelAvailable) return fallback;
  const { halfWidth: r, springHeight: spring, crownHeight: crown, portalDepth: depth } = config;
  if (![r, spring, crown, depth, config.authorAngleRadians, ...config.wallEdge.flat()].every(Number.isFinite)
    || r <= 0 || spring <= 0 || crown <= spring || depth <= 0) throw Error('Invalid explicit host opening dimensions');
  const segments = config.archSegments ?? 32;
  if (!Number.isInteger(segments) || segments < 8 || segments > 128) throw Error('Invalid arch segment count');
  const c = Math.cos(config.authorAngleRadians), s = Math.sin(config.authorAngleRadians);
  const ax = (east: number, south: number) => east * c - south * s;
  const [p, q] = config.wallEdge;
  const dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
  const xp = ax(...p), xq = ax(...q);
  if (length < .01 || Math.min(xp, xq) >= -r || Math.max(xp, xq) <= r) throw Error('Explicit edge does not contain opening');
  const profile: [number, number][] = [[-r, 0], [r, 0], [r, spring]];
  for (let i = 1; i <= segments; i++) {
    const theta = Math.PI * i / segments;
    profile.push([r * Math.cos(theta), spring + (crown - spring) * Math.sin(theta)]);
  }
  const attributes = Object.entries(geometry.attributes) as [string, T.BufferAttribute][];
  if (!geometry.getAttribute('position') || geometry.getAttribute('position').itemSize !== 3) throw Error('Native position attribute required');
  for (const [name, attr] of attributes) {
    if ((attr as unknown as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute || !attr.array) throw Error(`Unsupported/released CPU attribute: ${name}`);
  }
  const values = Object.fromEntries(attributes.map(([name]) => [name, [] as number[]]));
  const output = new T.BufferGeometry();
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
  const area = (a: Vertex, b: Vertex, d: Vertex) => new T.Vector3(...b.position as [number, number, number])
    .sub(new T.Vector3(...a.position as [number, number, number]))
    .cross(new T.Vector3(...d.position as [number, number, number]).sub(new T.Vector3(...a.position as [number, number, number]))).length() / 2;
  function emit(poly: Vertex[], materialIndex: number) {
    const start = values.position.length / 3;
    for (let j = 1; j + 1 < poly.length; j++) {
      if (area(poly[0], poly[j], poly[j + 1]) < 1e-10) continue;
      for (const v of [poly[0], poly[j], poly[j + 1]]) for (const [name] of attributes) values[name].push(...v[name]);
    }
    const count = values.position.length / 3 - start;
    if (count && geometry.groups.length) output.addGroup(start, count, materialIndex);
  }
  const total = geometry.index?.count ?? geometry.getAttribute('position').count;
  for (let i = 0; i < total; i += 3) {
    const triangle = [0, 1, 2].map(j => read(geometry.index ? geometry.index.getX(i + j) : i + j));
    const materialIndex = geometry.groups.find(g => i >= g.start && i < g.start + g.count)?.materialIndex ?? 0;
    const onEdge = triangle.every(v => {
      const [x, , z] = v.position;
      const projection = ((x - p[0]) * dx + (z - p[1]) * dz) / length;
      return Math.abs((x - p[0]) * dz - (z - p[1]) * dx) / length < .002 && projection >= -.002 && projection <= length + .002;
    });
    if (!onEdge) { emit(triangle, materialIndex); continue; }
    selectedTriangles++;
    let remainder = triangle;
    for (let k = 0; k < profile.length && remainder.length; k++) {
      const a = profile[k], b = profile[(k + 1) % profile.length];
      emit(clip(remainder, a, b, false), materialIndex);
      remainder = clip(remainder, a, b, true);
    }
    for (let j = 1; j + 1 < remainder.length; j++) removedArea += area(remainder[0], remainder[j], remainder[j + 1]);
  }
  if (!selectedTriangles || removedArea < .01) throw Error('Explicit installed wall plane has no cuttable opening; retain fallback');
  for (const [name, attr] of attributes) {
    const Constructor = attr.array.constructor as { new(values: number[]): T.TypedArray };
    output.setAttribute(name, new T.BufferAttribute(new Constructor(values[name]), attr.itemSize, attr.normalized));
  }
  output.userData = { ...geometry.userData, hostOpening: config.hostIdentity };
  output.computeBoundingBox(); output.computeBoundingSphere();
  // The front follows the installed plane; the back follows authored -Z for
  // only the verified portal depth. No rear cap, threshold or invented ceiling.
  const front = (x: number, y: number) => {
    const t = (x - xp) / (xq - xp); return new T.Vector3(p[0] + t * dx, y, p[1] + t * dz);
  };
  const interior = new T.Vector3(-s * depth, 0, -c * depth);
  const revealValues: number[] = [];
  // Skip profile edge 0: it is the ground opening, which must remain clear.
  for (let i = 1; i < profile.length; i++) {
    const a = front(...profile[i]), b = front(...profile[(i + 1) % profile.length]);
    const ab = a.clone().add(interior), bb = b.clone().add(interior);
    for (const point of [a, b, ab, b, bb, ab]) revealValues.push(...point.toArray());
  }
  const reveal = new T.BufferGeometry();
  reveal.setAttribute('position', new T.Float32BufferAttribute(revealValues, 3)); reveal.computeVertexNormals();
  reveal.userData.role = 'bounded-portal-jambs-and-arch-soffit';
  return { geometry: output, reveals: [reveal], active: true, selectedTriangles, removedArea };
}
