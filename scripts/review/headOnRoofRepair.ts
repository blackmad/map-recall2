/** Provisional frontage roof repair for the opt-in head-on 3DBAG demo. */
export type Point3 = [number, number, number];
export type Point2 = [number, number];
export type Mesh = {id: string; buildingId: string; kind: 'wall' | 'roof' | 'ground'; positions: number[]; indices: number[]; uvs?: number[]; textured: boolean; sourceTileSha256?: string};
export type Plane = {start: {x: number; y: number}; end: {x: number; y: number}; baseZ: number; topZ: number};
export type Crop = [number, number, number, number];
export type RepairInput = {meshes: Mesh[]; plane: Plane; crop: Crop; contextSize: [number, number]; originRD: Point3; cameraPosition: Point3; imageWidth: number; imageHeight: number; skylineY: number[]; setbackM: number};

const round = (value: number) => Number(value.toFixed(4));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot2 = (a: Point2, b: Point2) => a[0] * b[0] + a[1] * b[1];

/** First sustained non-sky row at each x, then reject isolated roof spikes. */
export function skylineFromRgba(data: Uint8Array, width: number, height: number, channels: number, samples = 96): number[] {
  if (width < 16 || height < 16 || channels < 3 || samples < 4) throw Error('Invalid silhouette raster');
  const rows: number[] = [];
  const dark = (x: number, y: number) => {
    const p = (y * width + x) * channels;
    return Math.min(data[p], data[p + 1], data[p + 2]) < 225;
  };
  for (let i = 0; i <= samples; i++) {
    const x = Math.min(width - 1, Math.round(i * (width - 1) / samples));
    let found = height - 1;
    for (let y = 0; y < height - 5; y++) {
      let hits = 0;
      for (let j = 0; j < 6; j++) if (dark(x, y + j)) hits++;
      if (hits >= 3) {found = y; break;}
    }
    rows.push(found);
  }
  // Narrow antenna/hoisting-beam strokes should not become full-height 3D spikes.
  return rows.map((value, i) => {
    const neighborhood = rows.slice(Math.max(0, i - 2), Math.min(rows.length, i + 3)).sort((a, b) => a - b);
    const median = neighborhood[Math.floor(neighborhood.length / 2)];
    return value < median - height * 0.075 ? median : value;
  });
}

type Vertex = {p: Point3; uv?: Point2};
const distance = (p: Point3, direction: Point2) => dot2([p[0], -p[2]], direction);
const interpolate = (a: Vertex, b: Vertex, t: number): Vertex => ({
  p: [0, 1, 2].map(i => lerp(a.p[i], b.p[i], t)) as Point3,
  ...(a.uv && b.uv ? {uv: [lerp(a.uv[0], b.uv[0], t), lerp(a.uv[1], b.uv[1], t)] as Point2} : {}),
});

/** Keep the original BAG triangle only behind a shallow cut parallel to the facade. */
export function clipMeshToRear(mesh: Mesh, direction: Point2, setbackM: number): Mesh | null {
  const out: Vertex[] = [], indices: number[] = [];
  const get = (index: number): Vertex => ({
    p: [mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]],
    ...(mesh.uvs ? {uv: [mesh.uvs[index * 2], mesh.uvs[index * 2 + 1]] as Point2} : {}),
  });
  for (let i = 0; i < mesh.indices.length; i += 3) {
    let poly = [get(mesh.indices[i]), get(mesh.indices[i + 1]), get(mesh.indices[i + 2])];
    const input = poly; poly = [];
    for (let j = 0; j < input.length; j++) {
      const a = input[j], b = input[(j + 1) % input.length];
      const da = distance(a.p, direction) + setbackM, db = distance(b.p, direction) + setbackM;
      const insideA = da <= 1e-6, insideB = db <= 1e-6;
      if (insideA) poly.push(a);
      if (insideA !== insideB) poly.push(interpolate(a, b, da / (da - db)));
    }
    if (poly.length < 3) continue;
    const start = out.length;
    out.push(...poly);
    for (let j = 1; j < poly.length - 1; j++) indices.push(start, start + j, start + j + 1);
  }
  if (!indices.length) return null;
  return {...mesh, id: `${mesh.id}:rear`, positions: out.flatMap(v => v.p.map(round)), indices,
    ...(mesh.uvs ? {uvs: out.flatMap(v => v.uv!.map(round))} : {})};
}

function roofHeightAt(meshes: Mesh[], x: number, z: number): number | null {
  let highest: number | null = null;
  for (const mesh of meshes) {
    if (mesh.kind !== 'roof') continue;
    const p = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
      const ax = p[a], az = p[a + 2], bx = p[b], bz = p[b + 2], cx = p[c], cz = p[c + 2];
      const denom = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(denom) < 1e-9) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denom;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denom;
      if (u < -1e-4 || v < -1e-4 || u + v > 1.0001) continue;
      const y = u * p[a + 1] + v * p[b + 1] + (1 - u - v) * p[c + 1];
      if (highest === null || y > highest) highest = y;
    }
  }
  return highest;
}

function surface(id: string, kind: Mesh['kind'], points: Point3[], indices: number[], uvs?: number[]): Mesh {
  return {id, buildingId: 'diagnostic-generated-frontage', kind, positions: points.flatMap(p => p.map(round)), indices,
    ...(uvs ? {uvs: uvs.map(round)} : {}), textured: Boolean(uvs)};
}

/** Retain BAG rear mass, with a photo-shaped frontage and a finite roof join. */
export function buildRoofRepair(input: RepairInput): {meshes: Mesh[]; stats: {roofJoinSamples: number; roofFallbackSamples: number; skylineSamples: number; setbackM: number}} {
  const {plane, crop, contextSize, originRD, skylineY, imageWidth, imageHeight, setbackM} = input;
  if (skylineY.length < 5 || setbackM <= 0) throw Error('Invalid repair profile or setback');
  const camera: Point2 = [input.cameraPosition[0], -input.cameraPosition[2]];
  const cameraLength = Math.hypot(...camera);
  if (!cameraLength) throw Error('Missing front camera direction');
  const direction: Point2 = [camera[0] / cameraLength, camera[1] / cameraLength];
  const delta: Point2 = [plane.end.x - plane.start.x, plane.end.y - plane.start.y];
  const makeFront = (i: number): Point3 => {
    const u = i / (skylineY.length - 1);
    const t = (crop[0] + u * (crop[2] - crop[0])) / contextSize[0];
    return [plane.start.x + delta[0] * t - originRD[0], 0, -(plane.start.y + delta[1] * t - originRD[1])];
  };
  const bases = skylineY.map((_, i) => makeFront(i));
  const tops = skylineY.map((row, i): Point3 => {
    const p = bases[i];
    return [p[0], Math.max(0.4, (plane.topZ - row / imageHeight * (plane.topZ - plane.baseZ)) - originRD[2]), p[2]];
  });
  const backPoints = tops.map(p => sub(p, [direction[0] * setbackM, 0, -direction[1] * setbackM]));
  const backHeights = backPoints.map(p => roofHeightAt(input.meshes, p[0], p[2]));
  const available = backHeights.filter((height): height is number => height !== null);
  if (available.length < skylineY.length * 0.4) throw Error(`Only ${available.length}/${skylineY.length} roof join samples land on BAG roof`);
  // Small gaps between BAG polygons inherit the closest sampled roof edge, not an invented peak.
  for (let i = 0; i < backHeights.length; i++) {
    if (backHeights[i] !== null) continue;
    let nearest = -1;
    for (let step = 1; step < backHeights.length && nearest < 0; step++) {
      if (i - step >= 0 && backHeights[i - step] !== null) nearest = i - step;
      else if (i + step < backHeights.length && backHeights[i + step] !== null) nearest = i + step;
    }
    backHeights[i] = nearest >= 0 ? backHeights[nearest] : tops[i][1];
  }
  for (let i = 0; i < backPoints.length; i++) backPoints[i][1] = backHeights[i]!;
  const repaired: Mesh[] = input.meshes.flatMap(mesh => {
    const clipped = clipMeshToRear(mesh, direction, setbackM);
    return clipped ? [clipped] : [];
  });
  const frontPoints: Point3[] = [], frontUvs: number[] = [], frontIndices: number[] = [];
  const apronPoints: Point3[] = [], apronIndices: number[] = [];
  for (let i = 0; i < skylineY.length; i++) {
    frontPoints.push(bases[i], tops[i]);
    const u = i / (skylineY.length - 1);
    frontUvs.push(u, 0, u, 1 - skylineY[i] / imageHeight);
    apronPoints.push(tops[i], backPoints[i]);
    if (i === skylineY.length - 1) continue;
    const k = i * 2;
    frontIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    apronIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  repaired.push(surface('generated:front-shell', 'wall', frontPoints, frontIndices, frontUvs));
  repaired.push(surface('generated:roof-apron', 'roof', apronPoints, apronIndices));
  for (const i of [0, skylineY.length - 1]) {
    const backBase: Point3 = [backPoints[i][0], 0, backPoints[i][2]];
    repaired.push(surface(`generated:end-cap:${i === 0 ? 'left' : 'right'}`, 'wall',
      [bases[i], tops[i], backPoints[i], backBase], [0, 1, 2, 0, 2, 3]));
  }
  return {meshes: repaired, stats: {roofJoinSamples: available.length, roofFallbackSamples: skylineY.length - available.length,
    skylineSamples: skylineY.length, setbackM}};
}
