/**
 * Which GLB-audit hole loops of a chunk are party-wall trimming artefacts. Trimming removes the part of a party wall the
 * neighbour covers, so its outline becomes open edges lying ON the party plane, closed visually by the neighbour's own
 * wall. Where neighbours differ in depth (a short 3DBAG footprint next to a deep one) those open edges run past the end
 * of the shared footprint edge along the same plane. A loop counts as a party artefact when the open edges inside its box
 * lie (all but `maxOffM` of their length) within `tolM` of the vertical plane through a shared footprint edge (the
 * edge's infinite line), and anything else stays a hole.
 */
import type {Contact} from '../streetChunks/party.ts';

export interface PlanTri { p: number[][] }
export interface LoopBox { perimeter: number; min: number[]; max: number[] }

/** Open (single-use, 2 mm weld) edges of the chunk triangles, per pand list. */
export function openEdges(tris: PlanTri[][]): [number[], number[]][] {
  const key = (v: number[]) => v.map(x => Math.round(x / 0.002)).join(',');
  const edges = new Map<string, [number[], number[]][]>();
  for (const list of tris) for (const t of list) for (let i = 0; i < 3; i++) {
    const p = t.p[i], q = t.p[(i + 1) % 3], a = key(p), b = key(q);
    if (a === b) continue;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    (edges.get(k) ?? edges.set(k, []).get(k)!).push([p, q]);
  }
  return [...edges.values()].filter(l => l.length === 1).map(l => l[0]);
}

export function classifyPartyLoops(loops: LoopBox[], open: [number[], number[]][], contacts: Contact[], tolM = 0.08, maxOffM = 0.5) {
  const onPlane = (v: number[]) => contacts.some(c => Math.abs((v[0] - c.ox) * -c.dz + (v[2] - c.oz) * c.dx) <= tolM);
  return loops.map(d => {
    const inBox = (v: number[]) => v[0] >= d.min[0] - 0.05 && v[0] <= d.max[0] + 0.05 && v[1] >= d.min[1] - 0.05 && v[1] <= d.max[1] + 0.05 && v[2] >= d.min[2] - 0.05 && v[2] <= d.max[2] + 0.05;
    let off = 0, on = 0;
    for (const [p, q] of open) {
      if (!inBox(p) || !inBox(q)) continue;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      if (onPlane(p) && onPlane(q)) on += len; else off += len;
    }
    return {...d, onPartyM: Math.round(on * 100) / 100, offPartyM: Math.round(off * 100) / 100, party: on > 0 && off <= maxOffM};
  });
}
