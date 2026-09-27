/** Diagnostic image-space openings and balconies on registered textured walls. */
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type BBox = readonly [number, number, number, number];

export interface MeshData {
  id: string;
  kind: string;
  positions: number[];
  indices: number[];
  uvs?: number[];
  textured: boolean;
  colour?: string;
  buildingId?: string;
  [key: string]: unknown;
}

export interface FacadeComponent {
  id: string;
  kind: 'window' | 'door' | 'balcony';
  /** Normalized source-image coordinates, y increasing downward. */
  bbox: BBox;
  /** Balcony projection; default 0.65 m. Openings use it as recess depth (default 0.12 m). */
  depth?: number;
  colour?: string;
}

export interface ComponentStats {
  accepted: string[];
  skipped: Array<{id: string; reason: string}>;
  apertures: number;
  inserted: number;
}

type V = {p: Vec3; uv: Vec2};
type Triangle = readonly [V, V, V];
type Rect = {left: number; right: number; bottom: number; top: number};

const EPS = 1e-8;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, scale: number): Vec3 => [a[0] * scale, a[1] * scale, a[2] * scale];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Vec3) => Math.hypot(...a);
const unit = (a: Vec3): Vec3 => {const n = length(a); return n > EPS ? mul(a, 1 / n) : [0, 0, 0];};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V, b: V, t: number): V => ({p: [0, 1, 2].map(i => lerp(a.p[i], b.p[i], t)) as unknown as Vec3,
  uv: [lerp(a.uv[0], b.uv[0], t), lerp(a.uv[1], b.uv[1], t)]});

function signedArea(poly: readonly V[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i].uv, b = poly[(i + 1) % poly.length].uv;
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function box(feature: FacadeComponent): Rect {
  const [x0, y0, x1, y1] = feature.bbox;
  return {left: x0, right: x1, bottom: 1 - y1, top: 1 - y0};
}

function clip(poly: readonly V[], axis: 0 | 1, edge: number, keepLess: boolean): V[] {
  const inside = (v: V) => keepLess ? v.uv[axis] <= edge + EPS : v.uv[axis] >= edge - EPS;
  const result: V[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const aIn = inside(a), bIn = inside(b);
    if (aIn) result.push(a);
    if (aIn !== bIn) {
      const difference = b.uv[axis] - a.uv[axis];
      if (Math.abs(difference) > EPS) result.push(lerpV(a, b, (edge - a.uv[axis]) / difference));
    }
  }
  return result;
}

function intersect(poly: readonly V[], rect: Rect): V[] {
  return clip(clip(clip(clip(poly, 0, rect.left, false), 0, rect.right, true), 1, rect.bottom, false), 1, rect.top, true);
}

/** Partition a triangle into the portion outside a rectangular aperture and its intersection. */
function subtractRect(poly: readonly V[], rect: Rect): {outside: V[][]; inside: V[]} {
  let remaining = [...poly];
  const outside: V[][] = [];
  const sides: Array<[0 | 1, number, boolean]> = [
    [0, rect.left, false], [0, rect.right, true], [1, rect.bottom, false], [1, rect.top, true],
  ];
  for (const [axis, edge, keepMore] of sides) {
    const fragment = clip(remaining, axis, edge, !keepMore);
    if (fragment.length >= 3 && Math.abs(signedArea(fragment)) > EPS) outside.push(fragment);
    remaining = clip(remaining, axis, edge, keepMore);
    if (remaining.length < 3) break;
  }
  return {outside, inside: remaining.length >= 3 && Math.abs(signedArea(remaining)) > EPS ? remaining : []};
}

function triangles(mesh: MeshData): Triangle[] {
  if (!mesh.uvs || mesh.uvs.length !== mesh.positions.length / 3 * 2) return [];
  const get = (index: number): V => ({p: [mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]],
    uv: [mesh.uvs![index * 2], mesh.uvs![index * 2 + 1]]});
  const result: Triangle[] = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const tri: Triangle = [get(mesh.indices[i]), get(mesh.indices[i + 1]), get(mesh.indices[i + 2])];
    if (Math.abs(signedArea(tri)) > EPS) result.push(tri);
  }
  return result;
}

function outward(tri: Triangle): Vec3 {
  const a = tri[0], b = tri[1], c = tri[2];
  const e1 = sub(b.p, a.p), e2 = sub(c.p, a.p);
  const du1 = b.uv[0] - a.uv[0], dv1 = b.uv[1] - a.uv[1];
  const du2 = c.uv[0] - a.uv[0], dv2 = c.uv[1] - a.uv[1];
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < EPS) return [0, 0, 0];
  const tangentU = mul(sub(mul(e1, dv2), mul(e2, dv1)), 1 / det);
  const tangentV = mul(sub(mul(e2, du1), mul(e1, du2)), 1 / det);
  return unit(cross(tangentU, tangentV));
}

function atUv(triangles: readonly Triangle[], uv: Vec2): {point: Vec3; normal: Vec3} | null {
  for (const tri of triangles) {
    const [a, b, c] = tri;
    const det = (b.uv[1] - c.uv[1]) * (a.uv[0] - c.uv[0]) + (c.uv[0] - b.uv[0]) * (a.uv[1] - c.uv[1]);
    if (Math.abs(det) < EPS) continue;
    const wa = ((b.uv[1] - c.uv[1]) * (uv[0] - c.uv[0]) + (c.uv[0] - b.uv[0]) * (uv[1] - c.uv[1])) / det;
    const wb = ((c.uv[1] - a.uv[1]) * (uv[0] - c.uv[0]) + (a.uv[0] - c.uv[0]) * (uv[1] - c.uv[1])) / det;
    const wc = 1 - wa - wb;
    if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) continue;
    return {point: add(add(mul(a.p, wa), mul(b.p, wb)), mul(c.p, wc)), normal: outward(tri)};
  }
  return null;
}

function appendPolygon(mesh: MeshData, poly: readonly V[], move?: Vec3): void {
  if (poly.length < 3 || Math.abs(signedArea(poly)) <= EPS) return;
  const base = mesh.positions.length / 3;
  for (const vertex of poly) {
    const p = move ? add(vertex.p, move) : vertex.p;
    mesh.positions.push(...p);
    mesh.uvs?.push(...vertex.uv);
  }
  for (let i = 1; i < poly.length - 1; i++) mesh.indices.push(base, base + i, base + i + 1);
}

function solid(id: string, colour: string): MeshData {return {id, kind: 'wall', positions: [], indices: [], textured: false, colour};}

function quad(mesh: MeshData, a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
  const start = mesh.positions.length / 3;
  mesh.positions.push(...a, ...b, ...c, ...d);
  mesh.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function boxBeam(id: string, a: Vec3, b: Vec3, faceNormal: Vec3, width: number, protrusion: number, colour: string): MeshData {
  const result = solid(id, colour);
  const axis = unit(sub(b, a));
  const sideways = mul(unit(cross(faceNormal, axis)), width / 2);
  const up = mul(faceNormal, protrusion);
  const p = [sub(a, sideways), add(a, sideways), add(b, sideways), sub(b, sideways)];
  const q = p.map(v => add(v, up));
  quad(result, q[0], q[1], q[2], q[3]);
  for (let i = 0; i < 4; i++) quad(result, p[i], p[(i + 1) % 4], q[(i + 1) % 4], q[i]);
  return result;
}

function frame(feature: FacadeComponent, rect: Rect, sourceTriangles: readonly Triangle[], recess: number): MeshData[] {
  const cornersUv: Vec2[] = [[rect.left, rect.bottom], [rect.right, rect.bottom], [rect.right, rect.top], [rect.left, rect.top]];
  const mapped = cornersUv.map(uv => atUv(sourceTriangles, uv));
  if (mapped.some(value => !value)) return [];
  const corners = mapped.map(value => value!.point);
  const n = unit(mapped.reduce<Vec3>((sum, value) => add(sum, value!.normal), [0, 0, 0]));
  const trim = feature.colour ?? '#d8d2c4';
  const reveal = solid(`component:${feature.id}:reveal`, '#6f675f');
  const result: MeshData[] = [];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4];
    quad(reveal, a, b, sub(b, mul(n, recess)), sub(a, mul(n, recess)));
    result.push(boxBeam(`component:${feature.id}:frame:${i}`, a, b, n, 0.07, 0.045, trim));
  }
  result.push(reveal);
  return result;
}

function balcony(feature: FacadeComponent, rect: Rect, sourceTriangles: readonly Triangle[]): MeshData[] {
  const left = atUv(sourceTriangles, [rect.left, rect.bottom]);
  const right = atUv(sourceTriangles, [rect.right, rect.bottom]);
  if (!left || !right) return [];
  const n = unit(add(left.normal, right.normal));
  const depth = feature.depth ?? 0.65;
  const frontLeft = add(left.point, mul(n, depth)), frontRight = add(right.point, mul(n, depth));
  const slab = solid(`component:${feature.id}:slab`, feature.colour ?? '#9a9690');
  const down: Vec3 = [0, -0.12, 0];
  quad(slab, left.point, right.point, frontRight, frontLeft);
  quad(slab, add(frontLeft, down), add(frontRight, down), frontRight, frontLeft);
  quad(slab, add(left.point, down), add(frontLeft, down), frontLeft, left.point);
  quad(slab, add(frontRight, down), add(right.point, down), right.point, frontRight);
  const railColour = '#343b3d';
  const result: MeshData[] = [slab];
  const up: Vec3 = [0, 0.95, 0];
  result.push(boxBeam(`component:${feature.id}:top-rail`, add(frontLeft, up), add(frontRight, up), n, 0.045, 0.045, railColour));
  const postCount = Math.max(3, Math.ceil(length(sub(frontRight, frontLeft)) / 0.28));
  for (let i = 0; i <= postCount; i++) {
    const t = i / postCount;
    const foot = add(mul(frontLeft, 1 - t), mul(frontRight, t));
    result.push(boxBeam(`component:${feature.id}:post:${i}`, foot, add(foot, up), n, 0.03, 0.03, railColour));
  }
  return result;
}

function overlap(a: Rect, b: Rect): boolean {
  return Math.max(a.left, b.left) < Math.min(a.right, b.right) - EPS && Math.max(a.bottom, b.bottom) < Math.min(a.top, b.top) - EPS;
}

function valid(feature: FacadeComponent): boolean {
  const [x0, y0, x1, y1] = feature.bbox;
  return Boolean(feature.id && ['window', 'door', 'balcony'].includes(feature.kind) && [x0, y0, x1, y1].every(Number.isFinite) &&
    x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && x1 - x0 >= 0.005 && y1 - y0 >= 0.005 &&
    (feature.depth === undefined || (Number.isFinite(feature.depth) && feature.depth >= 0.02 && feature.depth <= 1.5)));
}

/** Cut visible wall triangles; insert inset panels and optional projected balconies. */
export function applyFacadeComponents(sourceMeshes: readonly MeshData[], features: readonly FacadeComponent[]): {meshes: MeshData[]; stats: ComponentStats} {
  const stats: ComponentStats = {accepted: [], skipped: [], apertures: 0, inserted: 0};
  const texturedTriangles = sourceMeshes.filter(mesh => mesh.kind === 'wall' && mesh.textured).flatMap(triangles);
  const ambiguous = new Set<string>();
  for (let i = 0; i < features.length; i++) {
    if (!valid(features[i]) || features[i].kind === 'balcony') continue;
    for (let j = i + 1; j < features.length; j++) {
      if (!valid(features[j]) || features[j].kind === 'balcony') continue;
      if (overlap(box(features[i]), box(features[j]))) {
        ambiguous.add(features[i].id);
        ambiguous.add(features[j].id);
      }
    }
  }
  const accepted: Array<{feature: FacadeComponent; rect: Rect; aperture: boolean}> = [];
  for (const feature of features) {
    if (!valid(feature)) {stats.skipped.push({id: feature.id, reason: 'invalid-bounds-or-depth'}); continue;}
    if (ambiguous.has(feature.id)) {stats.skipped.push({id: feature.id, reason: 'ambiguous-opening-conflict'}); continue;}
    const rect = box(feature), area = (rect.right - rect.left) * (rect.top - rect.bottom);
    const covered = texturedTriangles.reduce((sum, tri) => sum + Math.abs(signedArea(intersect(tri, rect))), 0);
    const corners: Vec2[] = [[rect.left, rect.bottom], [rect.right, rect.bottom], [rect.left, rect.top], [rect.right, rect.top]];
    if (covered < area * 0.9 || covered > area * 1.15 || corners.some(corner => !atUv(texturedTriangles, corner))) {
      stats.skipped.push({id: feature.id, reason: 'outside-or-ambiguous-wall'}); continue;
    }
    if (feature.kind === 'balcony' && accepted.some(item => item.feature.kind === 'balcony' && overlap(item.rect, rect))) {
      stats.skipped.push({id: feature.id, reason: 'overlapping-balcony'}); continue;
    }
    accepted.push({feature, rect, aperture: feature.kind !== 'balcony'});
    stats.accepted.push(feature.id);
  }
  const apertures = accepted.filter(item => item.aperture);
  const output: MeshData[] = [];
  for (const source of sourceMeshes) {
    if (source.kind !== 'wall' || !source.textured || !source.uvs) {output.push(source); continue;}
    const wall: MeshData = {...source, positions: [], indices: [], uvs: []};
    const panels: MeshData[] = [];
    for (const tri of triangles(source)) {
      let fragments: V[][] = [[...tri]];
      for (const item of apertures) {
        const next: V[][] = [];
        const panel: MeshData = {...source, id: `${source.id}:component:${item.feature.id}:inset`, positions: [], indices: [], uvs: []};
        for (const fragment of fragments) {
          const cut = subtractRect(fragment, item.rect);
          next.push(...cut.outside);
          if (cut.inside.length) appendPolygon(panel, cut.inside, mul(outward(tri), -(item.feature.depth ?? 0.12)));
        }
        fragments = next;
        if (panel.indices.length) panels.push(panel);
      }
      for (const fragment of fragments) appendPolygon(wall, fragment);
    }
    if (wall.indices.length) output.push(wall);
    output.push(...panels);
  }
  for (const aperture of apertures) {
    output.push(...frame(aperture.feature, aperture.rect, texturedTriangles, aperture.feature.depth ?? 0.12));
    stats.apertures++;
  }
  for (const item of accepted.filter(value => value.feature.kind === 'balcony')) {
    output.push(...balcony(item.feature, item.rect, texturedTriangles));
  }
  stats.inserted = output.length - sourceMeshes.length;
  return {meshes: output, stats};
}

export interface EntranceAssembly {
  basePosts?: boolean;
  id: string;
  /** Convex visible opening outline in normalized source-image coordinates (y down). */
  outline: readonly Vec2[];
  /** Distance of the opaque door panel behind the original wall plane, in metres. */
  depth?: number;
  wallColour?: string;
  revealColour?: string;
  doorColour?: string;
  frameColour?: string;
  transomColour?: string;
}

export interface EntranceAssemblyStats {
  accepted: boolean;
  reason?: string;
  cutAreaUv: number;
  focus?: {center: Vec3; outward: Vec3; widthM: number; heightM: number};
}

const uvCross = (a: Vec2, b: Vec2, p: Vec2) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

function uvArea(poly: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    sum += a[0] * b[1] - a[1] * b[0];
  }
  return sum / 2;
}

function entranceOutline(input: readonly Vec2[]): Vec2[] | null {
  const points: Vec2[] = input.map(([x, y]) => [x, 1 - y]);
  if (points.length > 3 && Math.hypot(points[0][0] - points.at(-1)![0], points[0][1] - points.at(-1)![1]) < EPS) points.pop();
  if (points.length < 3 || points.length > 32 || points.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1))) return null;
  const area = uvArea(points);
  if (Math.abs(area) < 1e-5) return null;
  if (area < 0) points.reverse();
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    if (uvCross(a, b, c) < -EPS || Math.hypot(b[0] - a[0], b[1] - a[1]) < EPS) return null;
  }
  return points;
}

function clipEdge(poly: readonly V[], a: Vec2, b: Vec2, keepInside: boolean): V[] {
  const signed = (v: V) => uvCross(a, b, v.uv);
  const result: V[] = [];
  for (let i = 0; i < poly.length; i++) {
    const start = poly[i], end = poly[(i + 1) % poly.length];
    const sa = signed(start), sb = signed(end);
    const startIn = keepInside ? sa >= -EPS : sa <= EPS;
    const endIn = keepInside ? sb >= -EPS : sb <= EPS;
    if (startIn) result.push(start);
    if (startIn !== endIn && Math.abs(sa - sb) > EPS) result.push(lerpV(start, end, sa / (sa - sb)));
  }
  return result;
}

function cutConvex(poly: readonly V[], outline: readonly Vec2[]): {outside: V[][]; inside: V[]} {
  let inside = [...poly];
  const outside: V[][] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const fragment = clipEdge(inside, a, b, false);
    if (fragment.length >= 3 && Math.abs(signedArea(fragment)) > EPS) outside.push(fragment);
    inside = clipEdge(inside, a, b, true);
    if (inside.length < 3) break;
  }
  return {outside, inside: inside.length >= 3 && Math.abs(signedArea(inside)) > EPS ? inside : []};
}

function horizontalSpan(outline: readonly Vec2[], y: number): readonly [number, number] | null {
  const intersections: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) intersections.push(lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])));
  }
  if (intersections.length !== 2) return null;
  return [Math.min(...intersections), Math.max(...intersections)];
}

/** Replace only a reviewed convex entrance outline with a solid recessed door assembly. */
export function applyEntranceAssembly(sourceMeshes: readonly MeshData[], entrance: EntranceAssembly): {meshes: MeshData[]; stats: EntranceAssemblyStats} {
  const reject = (reason: string) => ({meshes: [...sourceMeshes], stats: {accepted: false, reason, cutAreaUv: 0}});
  const outline = entranceOutline(entrance.outline);
  const depth = entrance.depth ?? 0.65;
  if (!entrance.id || !outline || !Number.isFinite(depth) || depth < 0.1 || depth > 1.5) return reject('invalid-outline-or-depth');
  const sourceTriangles = sourceMeshes.filter(mesh => mesh.kind === 'wall' && mesh.textured).flatMap(triangles);
  const expectedArea = uvArea(outline);
  const mapped = outline.map(uv => atUv(sourceTriangles, uv));
  const cutArea = sourceTriangles.reduce((sum, tri) => sum + Math.abs(signedArea(cutConvex(tri, outline).inside)), 0);
  if (mapped.some(value => !value) || cutArea < expectedArea * 0.98 || cutArea > expectedArea * 1.02) return reject('outside-or-ambiguous-wall');
  const normal = unit(mapped.reduce<Vec3>((sum, value) => add(sum, value!.normal), [0, 0, 0]));
  if (length(normal) < 0.9 || mapped.some(value => value!.normal[0] * normal[0] + value!.normal[1] * normal[1] + value!.normal[2] * normal[2] < 0.95)) return reject('nonplanar-or-reversed-wall');

  const output: MeshData[] = [];
  for (const source of sourceMeshes) {
    if (source.kind !== 'wall' || !source.textured || !source.uvs) {output.push(source); continue;}
    const retained: MeshData = {...source, positions: [], indices: [], uvs: []};
    for (const tri of triangles(source)) {
      for (const fragment of cutConvex(tri, outline).outside) appendPolygon(retained, fragment);
    }
    if (retained.indices.length) output.push(retained);
  }

  const front = mapped.map(value => value!.point);
  const back = front.map(point => sub(point, mul(normal, depth)));
  const reveal = solid(`entrance:${entrance.id}:reveal`, entrance.revealColour ?? entrance.wallColour ?? '#71685e');
  for (let i = 0; i < front.length; i++) quad(reveal, front[i], front[(i + 1) % front.length], back[(i + 1) % back.length], back[i]);
  output.push(reveal);
  const door = solid(`entrance:${entrance.id}:door`, entrance.doorColour ?? '#26332e');
  for (let i = 1; i < back.length - 1; i++) {
    const start = door.positions.length / 3;
    door.positions.push(...back[0], ...back[i], ...back[i + 1]);
    door.indices.push(start, start + 1, start + 2);
  }
  output.push(door);
  const frameColour = entrance.frameColour ?? '#303738';
  const bottom = Math.min(...outline.map(p => p[1])), top = Math.max(...outline.map(p => p[1]));
  const transomY = bottom + 0.72 * (top - bottom);
  const cream = entrance.transomColour ?? '#d8d0bd';
  for (let i = 0; i < back.length; i++) {
    const upperEdge = Math.max(outline[i][1], outline[(i + 1) % outline.length][1]) > transomY;
    output.push(boxBeam(`entrance:${entrance.id}:rear-frame:${i}`, back[i], back[(i + 1) % back.length], normal, 0.045, 0.025, upperEdge ? cream : frameColour));
  }
  const span = horizontalSpan(outline, transomY);
  if (span && span[1] - span[0] > 0.01) {
    const from = atUv(sourceTriangles, [span[0], transomY])!, to = atUv(sourceTriangles, [span[1], transomY])!;
    const a = sub(from.point, mul(normal, depth - 0.03)), b = sub(to.point, mul(normal, depth - 0.03));
    output.push(boxBeam(`entrance:${entrance.id}:transom`, a, b, normal, 0.055, 0.025, cream));
    const panes = solid(`entrance:${entrance.id}:glazing`, '#69777b');
    const upper: V[] = outline.map((uv, i) => ({uv, p: add(back[i], mul(normal, 0.008))}));
    appendPolygon(panes, clip(upper, 1, transomY + 0.008 * (top - bottom), false));
    const lowerY = bottom + 0.23 * (top - bottom), upperY = transomY - 0.055 * (top - bottom);
    const lowerSpan = horizontalSpan(outline, lowerY), upperSpan = horizontalSpan(outline, upperY);
    if (lowerSpan && upperSpan && upperY > lowerY) {
      const left = Math.max(lowerSpan[0], upperSpan[0]) + 0.09 * (span[1] - span[0]);
      const right = Math.min(lowerSpan[1], upperSpan[1]) - 0.09 * (span[1] - span[0]);
      const middle = (left + right) / 2, gap = 0.025 * (right - left);
      for (const [x0, x1] of [[left, middle - gap], [middle + gap, right]]) {
        const points = [[x0, lowerY], [x1, lowerY], [x1, upperY], [x0, upperY]] as const;
        const mappedPane = points.map(uv => atUv(sourceTriangles, uv));
        if (mappedPane.every(Boolean)) {
          const p = mappedPane.map(item => sub(item!.point, mul(normal, depth - 0.008)));
          quad(panes, p[0], p[1], p[2], p[3]);
        }
      }
    }
    if (panes.indices.length) output.push(panes);
    const baseSpan = horizontalSpan(outline, bottom + 0.05 * (top - bottom));
    if (baseSpan) {
      const midX = (span[0] + span[1]) / 2;
      const foot = atUv(sourceTriangles, [midX, bottom + 0.05 * (top - bottom)]);
      const head = atUv(sourceTriangles, [midX, transomY]);
      if (foot && head) output.push(boxBeam(`entrance:${entrance.id}:mullion`, sub(foot.point, mul(normal, depth - 0.03)), sub(head.point, mul(normal, depth - 0.03)), normal, 0.04, 0.025, frameColour));
    }
  }
  const focusCenter = mul(front.reduce<Vec3>((sum, p) => add(sum, p), [0, 0, 0]), 1 / front.length);
  const centeredFocus:Vec3=[focusCenter[0],(Math.min(...front.map(p=>p[1]))+Math.max(...front.map(p=>p[1])))/2,focusCenter[2]];
  if(entrance.basePosts){
    const tangent=unit(cross([0,1,0],normal));
    const feet=front.filter(p=>Math.abs(p[1]-Math.min(...front.map(v=>v[1])))<1e-4);
    for(const [j,foot] of feet.entries()){
      const post=solid(`entrance:${entrance.id}:stone-post:${j}`,'#72736c');
      const profile:number[][]=[[-.17,0],[.17,0]];
      for(let k=0;k<=16;k++){const a=k*Math.PI/16;profile.push([.17*Math.cos(a),.61+.17*Math.sin(a)]);}
      const ring=(depth:number)=>profile.map(([x,y])=>add(add(add(foot,mul(tangent,x)),[0,y,0]),mul(normal,depth)));
      const backPost=ring(.04),frontPost=ring(.28);
      for(let k=1;k<frontPost.length-1;k++){const b=post.positions.length/3;post.positions.push(...frontPost[0],...frontPost[k],...frontPost[k+1]);post.indices.push(b,b+1,b+2);}
      for(let k=0;k<frontPost.length;k++)quad(post,backPost[k],backPost[(k+1)%frontPost.length],frontPost[(k+1)%frontPost.length],frontPost[k]);
      output.push(post);
    }
  }
  const horizontal = unit(cross([0, 1, 0], normal));
  const projected = front.map(p => p[0] * horizontal[0] + p[1] * horizontal[1] + p[2] * horizontal[2]);
  const widthM = Math.max(...projected) - Math.min(...projected);
  const heightM = Math.max(...front.map(p => p[1])) - Math.min(...front.map(p => p[1]));
  return {meshes: output, stats: {accepted: true, cutAreaUv: cutArea, focus: {center: centeredFocus, outward: normal, widthM, heightM}}};
}
