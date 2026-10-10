/**
 * Inferred rear facades for block-face chunks.
 *
 * A face models only the street side. On a straight row the backs then form one blank plane (a 91 x 13.5 m wall with no
 * opening), which is wrong (real rears are windowed) and visible from courtyards, side streets and the intro flight.
 * Without a rear photo we add a plain window grid per pand from what is known: the surveyed rear edges of its own
 * footprint, its storey heights and its eaves. Everything here is INFERRED and reported as such (report.json `rears`,
 * strip sheet); a rear photo would replace the grid, not the mechanism.
 *
 * Rules (each is a regression in blockFace.test.ts):
 *  - a rear edge faces away from the street (outward normal within ~37 degrees of the reverse frontage normal) and is
 *    at least `minEdgeM` long;
 *  - never on a party wall or a wall shared with a neighbour: a window whose centre lies on a neighbour footprint edge
 *    (within `partyTolM`), or whose outside is inside a neighbour footprint, is not placed;
 *  - windows are attached: a frame plate `plateM` (3 cm) proud of the wall and a glass pane 1.5 cm further, never more
 *    than 5 cm from the wall;
 *  - modest cost: 4 triangles per window (frame plate + pane).
 */
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {pointInRing} from '../buildingRecipe/facts.ts';

export interface RearOptions {
  minEdgeM?: number;
  /** Window pitch along an edge (m). */
  pitchM?: number;
  windowWidthM?: number;
  /** Margin kept free at each end of an edge and around shared spans (m). */
  marginM?: number;
  partyTolM?: number;
}

export interface RearEdgeReport { lengthM: number; windowsPerStorey: number; skippedShared: number }
export interface RearReport {
  pandId: string;
  source: 'inferred';
  edges: RearEdgeReport[];
  windows: number;
  triangles: number;
  /** Storey heights the grid used (floor to floor, m). */
  storeys: number[];
  maxProudM: number;
}

export const REAR_DEFAULTS = {minEdgeM: 2.2, pitchM: 2.5, windowWidthM: 1.05, marginM: 0.9, partyTolM: 0.12, plateM: 0.03, paneM: 0.045, frameM: 0.09};

const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1]];

/** Distance from point to segment, in the plane. */
function segDistance(p: number[], a: number[], b: number[]): number {
  const ab = sub(b, a), ap = sub(p, a), len2 = ab[0] * ab[0] + ab[1] * ab[1] || 1, t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / len2));
  return Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t));
}

/** Rear edges of the main outer ring in RD: [a, b, outwardNormal(unit)]. */
export function rearEdges(facts: BuildingFacts, opts: RearOptions = {}): {a: number[]; b: number[]; n: number[]}[] {
  const minEdge = opts.minEdgeM ?? REAR_DEFAULTS.minEdgeM, front = facts.fronts[0].outwardNormalRD, fl = Math.hypot(front[0], front[1]);
  const out: {a: number[]; b: number[]; n: number[]}[] = [];
  for (const poly of facts.surveyFootprintPolygonsRD) {
    const ring = poly[0], area = ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), sign = area > 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], d = sub(b, a), len = Math.hypot(d[0], d[1]);
      if (len < minEdge) continue;
      // CCW ring (positive shoelace): outward normal of direction (dx, dy) is (dy, -dx).
      const n = [sign * d[1] / len, -sign * d[0] / len];
      if ((n[0] * front[0] + n[1] * front[1]) / fl > -0.8) continue;
      out.push({a, b, n});
    }
  }
  return out;
}

/**
 * Height of the masonry wall standing at a rear edge point (m): the highest shell/roof-closure wall triangle facing `n`
 * (recipe-local x,z) whose plane lies within 6 cm of the point and whose span along the edge covers it. A low rear wing
 * has a lower wall than the main body, and a window above it would hover in the air.
 */
export function wallTopAt(group: T.Group, c: [number, number], n: [number, number]): number {
  group.updateMatrixWorld(true);
  const t: [number, number] = [n[1], -n[0]], a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3();
  let top = 0;
  group.traverse(o => {
    if (!(o instanceof T.Mesh) || o.userData.surface !== 'wall' || !/^shell\//.test(o.name)) return;
    const g = o.geometry as T.BufferGeometry, pos = g.getAttribute('position'), idx = g.index, count = idx ? idx.count : pos.count;
    for (let k = 0; k < count; k += 3) {
      const v = [0, 1, 2].map(j => new T.Vector3().fromBufferAttribute(pos, idx ? idx.getX(k + j) : k + j).applyMatrix4(o.matrixWorld));
      a.subVectors(v[1], v[0]); b.subVectors(v[2], v[0]); d.crossVectors(a, b).normalize();
      if (d.x * n[0] + d.z * n[1] < 0.9) continue;
      const off = v.map(q => (q.x - c[0]) * n[0] + (q.z - c[1]) * n[1]);
      if (off.some(q => Math.abs(q) > 0.06)) continue;
      const along = v.map(q => (q.x - c[0]) * t[0] + (q.z - c[1]) * t[1]);
      if (Math.min(...along) > 0.05 || Math.max(...along) < -0.05) continue;
      top = Math.max(top, ...v.map(q => q.y));
    }
  });
  return top;
}

/**
 * Add the inferred rear windows of one pand to its compiled group (recipe-local coordinates: x east, z south of the
 * anchor, y up). `neighbours` are the other pands' facts of the same face.
 */
export function addInferredRear(group: T.Group, facts: BuildingFacts, anchorRD: [number, number], storeyHeightsM: number[], eavesM: number, glass: string, trim: string, neighbours: BuildingFacts[], opts: RearOptions = {}): RearReport {
  const o = {...REAR_DEFAULTS, ...opts}, local = (p: number[]): [number, number] => [p[0] - anchorRD[0], anchorRD[1] - p[1]];
  const neighbourRings = neighbours.flatMap(f => f.surveyFootprintPolygonsRD.map(poly => poly[0]));
  const neighbourEdges = neighbourRings.flatMap(r => r.map((p, i) => [p, r[(i + 1) % r.length]] as [number[], number[]]));
  const shared = (c: number[], n: number[]) => neighbourEdges.some(([p, q]) => segDistance(c, p, q) <= o.partyTolM) || neighbourRings.some(r => pointInRing([c[0] + n[0] * 0.15, c[1] + n[1] * 0.15], r as any));
  // Floors: skip a sub-1.5 m basement storey and anything too low to hold a window.
  const floors: {y0: number; y1: number}[] = [];
  let y = 0;
  for (const h of storeyHeightsM) { if (h >= 2.3 && y + h <= eavesM + 0.3) floors.push({y0: y, y1: Math.min(y + h, eavesM)}); y += h; }
  const trimPos: number[] = [], glassPos: number[] = [], edges: RearEdgeReport[] = [];
  const quad = (pos: number[], c: [number, number], t: [number, number], n: [number, number], w: number, y0: number, y1: number, off: number) => {
    const bl = [c[0] - t[0] * w / 2 + n[0] * off, y0, c[1] - t[1] * w / 2 + n[1] * off], br = [c[0] + t[0] * w / 2 + n[0] * off, y0, c[1] + t[1] * w / 2 + n[1] * off];
    const tl = [bl[0], y1, bl[2]], tr = [br[0], y1, br[2]];
    pos.push(...bl, ...br, ...tr, ...bl, ...tr, ...tl);
  };
  let windows = 0;
  for (const e of rearEdges(facts, opts)) {
    const la = local(e.a), lb = local(e.b), len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
    const nLocal: [number, number] = [e.n[0], -e.n[1]], t: [number, number] = [nLocal[1], -nLocal[0]];
    // up × n = (n_z, 0, -n_x) in (x, z): quad winding below makes the face look along +n.
    const usable = len - 2 * o.marginM, count = Math.max(0, Math.round(usable / o.pitchM) + (usable >= 0 ? 1 : 0));
    if (usable < 0 || !count) { edges.push({lengthM: +len.toFixed(2), windowsPerStorey: 0, skippedShared: 0}); continue; }
    const step = count > 1 ? usable / (count - 1) : 0, along = count > 1 ? (i: number) => o.marginM + i * step : () => len / 2;
    let skipped = 0, placed = 0;
    for (let i = 0; i < count; i++) {
      const s = along(i), rd = [e.a[0] + (e.b[0] - e.a[0]) * s / len, e.a[1] + (e.b[1] - e.a[1]) * s / len];
      // The whole window width must stay clear of shared spans.
      const ends = [-o.windowWidthM / 2 - 0.2, 0, o.windowWidthM / 2 + 0.2].map(k => [rd[0] + (e.b[0] - e.a[0]) / len * k, rd[1] + (e.b[1] - e.a[1]) / len * k]);
      if (ends.some(p => shared(p, e.n))) { skipped++; continue; }
      const c: [number, number] = [la[0] + (lb[0] - la[0]) * s / len, la[1] + (lb[1] - la[1]) * s / len];
      const wallTop = Math.min(...[-o.windowWidthM / 2, 0, o.windowWidthM / 2].map(k => wallTopAt(group, [c[0] + t[0] * k, c[1] + t[1] * k], nLocal)));
      for (const f of floors) {
        const sill = f.y0 + 0.9, head = Math.min(f.y1 - 0.45, sill + 1.8, wallTop - 0.3);
        if (head - sill < 1.0) continue;
        quad(trimPos, c, t, nLocal, o.windowWidthM + 2 * o.frameM, sill - o.frameM, head + o.frameM, o.plateM);
        quad(glassPos, c, t, nLocal, o.windowWidthM, sill, head, o.paneM);
        windows++;
      }
      placed++;
    }
    edges.push({lengthM: +len.toFixed(2), windowsPerStorey: placed, skippedShared: skipped});
  }
  const add = (pos: number[], colour: string, surface: 'trim' | 'glass') => {
    if (!pos.length) return;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({color: colour, roughness: 1}));
    m.name = `rear/inferred-${surface}`; m.userData = {component: 'rear', surface, inferred: true, pandId: facts.pandId};
    group.add(m);
  };
  add(trimPos, trim, 'trim'); add(glassPos, glass, 'glass');
  return {pandId: facts.pandId, source: 'inferred', edges, windows, triangles: (trimPos.length + glassPos.length) / 9, storeys: floors.map(f => +(f.y1 - f.y0).toFixed(2)), maxProudM: windows ? o.paneM : 0};
}
