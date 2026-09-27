/** Rebuild linked balcony openings without carrying painted rail or glass into the recess. */
import {applyFacadeComponents, type BBox, type FacadeComponent, type MeshData, type Vec3} from './componentGeometry';

export interface BalconyCandidate {id: string; bbox: BBox; depth?: number; wallColour?: string}
export interface OpeningCandidate {id: string; kind: 'window' | 'door'; bbox: BBox; depth?: number}
export interface PaintRemovalMask {id: string; bbox: BBox; colour: string; linkedOpeningId: string}
export interface BalconyAssemblyStats {
  acceptedBalconies: string[];
  skippedBalconies: Array<{id: string; reason: string}>;
  rebuiltOpenings: string[];
  inferredCompletions: Array<{openingId: string; balconyId: string; originalBBox: BBox; completedBBox: BBox}>;
  geometry: ReturnType<typeof applyFacadeComponents>['stats'];
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: Vec3): Vec3 => {const n = Math.hypot(...v); return n > 1e-8 ? mul(v, 1 / n) : [0, 0, 0];};

function beam(id: string, a: Vec3, b: Vec3, radius: number): MeshData {
  const axis = unit(sub(b, a));
  const reference: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const side = mul(unit(cross(axis, reference)), radius);
  const up = mul(unit(cross(axis, side)), radius);
  const ring = (p: Vec3) => [add(add(p, side), up), add(sub(p, side), up), sub(sub(p, side), up), add(sub(p, up), side)];
  const corners = [...ring(a), ...ring(b)];
  const mesh: MeshData = {id, kind: 'wall', textured: false, colour: '#343b3d', positions: corners.flatMap(p => [...p]), indices: []};
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    mesh.indices.push(i, j, j + 4, i, j + 4, i + 4);
  }
  mesh.indices.push(0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7);
  return mesh;
}

function linkedWindow(balcony: BalconyCandidate, openings: readonly OpeningCandidate[]): OpeningCandidate[] {
  const [left, top, right, bottom] = balcony.bbox, center = (left + right) / 2;
  return openings.filter(opening => {
    if (opening.kind !== 'window') return false;
    const [x0, y0, x1, y1] = opening.bbox;
    return x0 < center && x1 > center && y0 < top && y1 >= top - 0.015 && y1 < bottom &&
      bottom - y1 < (y1 - y0) * 1.6;
  });
}

/** Barycentric position on one of the inset panel triangles, for deterministic glazing bars. */
function atUv(meshes: readonly MeshData[], u: number, v: number): Vec3 | null {
  for (const mesh of meshes) {
    if (!mesh.uvs) continue;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [ia, ib, ic] = mesh.indices.slice(i, i + 3);
      const a = [mesh.uvs[ia * 2], mesh.uvs[ia * 2 + 1]], b = [mesh.uvs[ib * 2], mesh.uvs[ib * 2 + 1]], c = [mesh.uvs[ic * 2], mesh.uvs[ic * 2 + 1]];
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(det) < 1e-9) continue;
      const wa = ((b[1] - c[1]) * (u - c[0]) + (c[0] - b[0]) * (v - c[1])) / det;
      const wb = ((c[1] - a[1]) * (u - c[0]) + (a[0] - c[0]) * (v - c[1])) / det;
      const wc = 1 - wa - wb;
      if (Math.min(wa, wb, wc) < -1e-4) continue;
      const point = (index: number): Vec3 => [mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]];
      return add(add(mul(point(ia), wa), mul(point(ib), wb)), mul(point(ic), wc));
    }
  }
  return null;
}

function glazingBars(opening: OpeningCandidate, panelMeshes: readonly MeshData[]): MeshData[] {
  if (!panelMeshes.length) return [];
  const [x0, y0, x1, y1] = opening.bbox;
  const midX = (x0 + x1) / 2, upperY = y0 + (y1 - y0) * 0.18;
  const lookup = (x: number, y: number) => atUv(panelMeshes, x, 1 - y);
  const left = lookup(x0, upperY), right = lookup(x1, upperY);
  const top = lookup(midX, y0), bottom = lookup(midX, y1);
  const parts: MeshData[] = [];
  if (left && right) parts.push(beam(`balcony-assembly:${opening.id}:transom`, left, right, 0.018));
  if (top && bottom) parts.push(beam(`balcony-assembly:${opening.id}:mullion`, top, bottom, 0.018));
  return parts;
}

function sideRails(balcony: BalconyCandidate, slab: MeshData): MeshData[] {
  if (slab.positions.length < 12) return [];
  const point = (i: number): Vec3 => [slab.positions[i * 3], slab.positions[i * 3 + 1], slab.positions[i * 3 + 2]];
  const leftRear = point(0), rightRear = point(1), rightFront = point(2), leftFront = point(3);
  const up: Vec3 = [0, 0.95, 0];
  const result: MeshData[] = [];
  for (const [side, rear, front] of [['left', leftRear, leftFront], ['right', rightRear, rightFront]] as const) {
    result.push(beam(`balcony-assembly:${balcony.id}:${side}-rail`, add(rear, up), add(front, up), 0.022));
    result.push(beam(`balcony-assembly:${balcony.id}:${side}-rear-post`, rear, add(rear, up), 0.018));
  }
  return result;
}

/** All image boxes are normalized [x0,y0,x1,y1], y downward. Depths remain inferred. */
export function applyBalconyAssemblies(
  sourceMeshes: readonly MeshData[], balconies: readonly BalconyCandidate[], openings: readonly OpeningCandidate[],
): {meshes: MeshData[]; stats: BalconyAssemblyStats; paintRemovalMasks: PaintRemovalMask[]} {
  const skippedBalconies: BalconyAssemblyStats['skippedBalconies'] = [];
  const completed = new Map(openings.map(opening => [opening.id, {...opening}]));
  const eligible: Array<{balcony: BalconyCandidate; opening: OpeningCandidate}> = [];
  const claimed = new Set<string>();
  for (const balcony of balconies) {
    const matches = linkedWindow(balcony, openings);
    if (matches.length !== 1 || claimed.has(matches[0].id)) {
      skippedBalconies.push({id: balcony.id, reason: matches.length === 0 ? 'no-linked-window' : 'ambiguous-linked-window'});
      continue;
    }
    const opening = matches[0];
    const completedBBox: BBox = [opening.bbox[0], opening.bbox[1], opening.bbox[2], balcony.bbox[3] - 0.004];
    completed.set(opening.id, {...opening, bbox: completedBBox});
    eligible.push({balcony, opening});
    claimed.add(opening.id);
  }
  let active = [...eligible];
  const build = () => {
    const activeIds = new Set(active.map(pair => pair.opening.id));
    const features: FacadeComponent[] = [
      ...openings.map(opening => {
        const current = activeIds.has(opening.id) ? completed.get(opening.id)! : opening;
        return {id: opening.id, kind: opening.kind, bbox: current.bbox, depth: opening.depth ?? 0.18,
          colour: activeIds.has(opening.id) ? '#333d3d' : undefined};
      }),
      ...active.map(({balcony}) => ({id: balcony.id, kind: 'balcony' as const, bbox: balcony.bbox, depth: balcony.depth ?? 0.65})),
    ];
    return applyFacadeComponents(sourceMeshes, features);
  };
  let result = build();
  // A linked opening, slab, and paint mask form one decision. If either geometry
  // proposal fails, restore the original observed window box and omit the slab.
  while (true) {
    const accepted = new Set(result.stats.accepted);
    const failed = active.filter(({balcony, opening}) => !accepted.has(balcony.id) || !accepted.has(opening.id));
    if (!failed.length) break;
    for (const {balcony, opening} of failed) skippedBalconies.push({id: balcony.id, reason: `geometry-rejected:${opening.id}`});
    const failedIds = new Set(failed.map(({balcony}) => balcony.id));
    active = active.filter(({balcony}) => !failedIds.has(balcony.id));
    result = build();
  }
  const accepted = new Set(result.stats.accepted);
  const linkedAccepted = new Map(active.map(({balcony, opening}) => [opening.id, balcony]));
  const activeOpenings = new Set(active.map(({opening}) => opening.id));
  const inferredCompletions = active.map(({balcony, opening}) => ({openingId: opening.id, balconyId: balcony.id,
    originalBBox: opening.bbox, completedBBox: completed.get(opening.id)!.bbox}));
  const panelByOpening = new Map<string, MeshData[]>();
  const meshes = result.meshes.map(mesh => {
    for (const opening of openings) {
      if (mesh.id.includes(`:component:${opening.id}:inset`) && accepted.has(opening.id)) {
        const plain: MeshData = {...mesh, textured: false, colour: '#536267', uvs: mesh.uvs ? [...mesh.uvs] : undefined};
        const list = panelByOpening.get(opening.id) ?? [];
        list.push(plain);
        panelByOpening.set(opening.id, list);
        return plain;
      }
    }
    return mesh;
  });
  for (const opening of openings) {
    if (!accepted.has(opening.id)) continue;
    meshes.push(...glazingBars(activeOpenings.has(opening.id) ? completed.get(opening.id)! : opening, panelByOpening.get(opening.id) ?? []));
  }
  for (const {balcony, opening} of active) {
    if (!linkedAccepted.has(opening.id)) continue;
    const slab = meshes.find(mesh => mesh.id === `component:${balcony.id}:slab`);
    if (slab) meshes.push(...sideRails(balcony, slab));
  }
  const paintRemovalMasks = active.filter(({balcony, opening}) => accepted.has(balcony.id) && accepted.has(opening.id))
    .map(({balcony, opening}) => ({id: balcony.id, bbox: balcony.bbox, colour: balcony.wallColour ?? '#946957', linkedOpeningId: opening.id}));
  return {meshes, paintRemovalMasks, stats: {
    acceptedBalconies: paintRemovalMasks.map(mask => mask.id), skippedBalconies,
    rebuiltOpenings: [...panelByOpening.keys()], inferredCompletions, geometry: result.stats,
  }};
}
