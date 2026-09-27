/** Simple image-registered awning proposals on a photographed wall plane. */
import type {BBox, MeshData, Vec3} from './componentGeometry';

export interface AwningCandidate {id: string; bbox: BBox; depth?: number; colour?: string; stripeColour?: string}
export interface AwningStats {accepted: string[]; skipped: Array<{id: string; reason: string}>}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: Vec3): Vec3 => {const n = Math.hypot(...v); return n > 1e-8 ? mul(v, 1 / n) : [0, 0, 0];};

function wallPoint(meshes: readonly MeshData[], u: number, v: number): {point: Vec3; normal: Vec3} | null {
  for (const mesh of meshes) {
    if (!mesh.textured || mesh.kind !== 'wall' || !mesh.uvs) continue;
    const point = (i: number): Vec3 => [mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [ia, ib, ic] = mesh.indices.slice(i, i + 3);
      const a = [mesh.uvs[ia * 2], mesh.uvs[ia * 2 + 1]], b = [mesh.uvs[ib * 2], mesh.uvs[ib * 2 + 1]], c = [mesh.uvs[ic * 2], mesh.uvs[ic * 2 + 1]];
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(det) < 1e-9) continue;
      const wa = ((b[1] - c[1]) * (u - c[0]) + (c[0] - b[0]) * (v - c[1])) / det;
      const wb = ((c[1] - a[1]) * (u - c[0]) + (a[0] - c[0]) * (v - c[1])) / det;
      const wc = 1 - wa - wb;
      if (Math.min(wa, wb, wc) < -1e-4) continue;
      const pa = point(ia), pb = point(ib), pc = point(ic);
      const du1 = b[0] - a[0], dv1 = b[1] - a[1], du2 = c[0] - a[0], dv2 = c[1] - a[1];
      const tangentU = mul(sub(mul(sub(pb, pa), dv2), mul(sub(pc, pa), dv1)), 1 / det);
      const tangentV = mul(sub(mul(sub(pc, pa), du1), mul(sub(pb, pa), du2)), 1 / det);
      return {point: add(add(mul(pa, wa), mul(pb, wb)), mul(pc, wc)), normal: unit(cross(tangentU, tangentV))};
    }
  }
  return null;
}

function quad(id: string, colour: string, a: Vec3, b: Vec3, c: Vec3, d: Vec3): MeshData {
  return {id, kind: 'wall', textured: false, colour, positions: [...a, ...b, ...c, ...d], indices: [0, 1, 2, 0, 2, 3]};
}

/** Add a canopy using the box top at the wall and box bottom at the projected front edge. */
export function applyAwningAssemblies(sourceMeshes: readonly MeshData[], awnings: readonly AwningCandidate[]): {meshes: MeshData[]; stats: AwningStats} {
  const meshes = [...sourceMeshes];
  const stats: AwningStats = {accepted: [], skipped: []};
  for (const awning of awnings) {
    const [x0, y0, x1, y1] = awning.bbox, depth = awning.depth ?? 0.9;
    if (!awning.id || ![x0, y0, x1, y1, depth].every(Number.isFinite) || x0 < 0 || y0 < 0 || x1 > 1 || y1 > 1 ||
      x1 - x0 < 0.01 || y1 - y0 < 0.005 || depth < 0.2 || depth > 2) {
      stats.skipped.push({id: awning.id, reason: 'invalid-bounds-or-depth'});
      continue;
    }
    const mapped = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => wallPoint(sourceMeshes, x, 1 - y));
    if (mapped.some(value => !value)) {stats.skipped.push({id: awning.id, reason: 'outside-wall'}); continue;}
    const normal = unit(mapped.reduce<Vec3>((sum, value) => add(sum, value!.normal), [0, 0, 0]));
    if (mapped.some(value => value!.normal[0] * normal[0] + value!.normal[1] * normal[1] + value!.normal[2] * normal[2] < 0.95)) {
      stats.skipped.push({id: awning.id, reason: 'nonplanar-wall'});
      continue;
    }
    const backLeft = mapped[0]!.point, backRight = mapped[1]!.point;
    const frontRight = add(mapped[2]!.point, mul(normal, depth)), frontLeft = add(mapped[3]!.point, mul(normal, depth));
    const colour = awning.colour ?? '#9a3e37';
    meshes.push(quad(`awning:${awning.id}:top`, colour, backLeft, backRight, frontRight, frontLeft));
    const down: Vec3 = [0, -0.12, 0];
    meshes.push(quad(`awning:${awning.id}:fascia`, awning.stripeColour ?? '#eee7d9', frontLeft, frontRight, add(frontRight, down), add(frontLeft, down)));
    meshes.push(quad(`awning:${awning.id}:left-cap`, colour, backLeft, frontLeft, add(frontLeft, down), add(backLeft, down)));
    meshes.push(quad(`awning:${awning.id}:right-cap`, colour, frontRight, backRight, add(backRight, down), add(frontRight, down)));
    meshes.push(quad(`awning:${awning.id}:underside`, '#796b5f', add(backLeft, down), add(frontLeft, down), add(frontRight, down), add(backRight, down)));
    stats.accepted.push(awning.id);
  }
  return {meshes, stats};
}
