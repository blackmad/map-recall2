/**
 * The Nieuwe Achtergracht passage under the bridge block ("De Brug"). BAG outlines a bridge by its roof, so 3DBAG extrudes the whole 45 m block
 * down to the ground; the panoramas (w02-253 from the west, w06-73 from the east) show the canal running through a 15.2 m high, 38 m wide
 * opening with a dark soffit and glazed channel walls either end. This module opens the passage in the surveyed shell:
 *
 *  - wall surfaces 521 (west front) and 399 / 397 / 410 (east front) are clipped to start at the soffit (397 lies wholly below it and is dropped;
 *    410 is split where the void ends so its southern end keeps its 8 m base);
 *  - the soffit is a quad over the passage, the two channel walls close it north and south (glass with mullions).
 *
 * Passage corners are read from the 3DBAG wall rings themselves (west front 521 bottom edge, east front 399 + 397 bottom edge), so the opening
 * is exactly as wide as the fronts it opens.
 */
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';

export const SOFFIT_M = 15.2;
type Ring3 = number[][];
export interface Passage { w0: [number, number]; w1: [number, number]; e0: [number, number]; e1: [number, number]; soffit: number; surfaces: {west: number; east: number[]} }

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** Facts with the passage opened, and the passage polygon in local metres (x east, z south). */
export function openPassage(src: BuildingFacts, anchorRD: [number, number]): {facts: BuildingFacts; passage: Passage} {
  const facts = clone(src), g = facts.heights.groundNAP, [ax, ay] = anchorRD;
  const loc = (p: number[]): [number, number] => [p[0] - ax, ay - p[1]];
  const byId = (id: number) => facts.wallsRD!.find(w => w.surface === id)!;
  const bottomEdge = (id: number) => { const r = byId(id).ringsRD[0].filter(p => Math.abs(p[2] - g) < 0.05); return r.map(loc); };
  const w = bottomEdge(521), e399 = bottomEdge(399), e397 = bottomEdge(397);
  if (w.length < 2 || e399.length < 2 || e397.length < 2) throw Error('roeterseiland-void: passage wall rings not found (surface ids changed?)');
  const sortZ = (pts: [number, number][]) => [...pts].sort((a, b) => a[1] - b[1]);
  const [w0, w1] = [sortZ(w)[0], sortZ(w).at(-1)!], e0 = sortZ(e399)[0], e1 = sortZ(e397).at(-1)!;
  const top = g + SOFFIT_M;
  const clipBottom = (id: number) => { for (const p of byId(id).ringsRD[0]) if (p[2] < top) p[2] = top; const wl = byId(id); wl.bottomM = SOFFIT_M; };
  clipBottom(521); clipBottom(399);
  // 397 (0-8.2 m, the lower east front south of 399) lies wholly in the opening
  facts.wallsRD = facts.wallsRD!.filter(x => x.surface !== 397);
  // 410: upper east front from the 8 m base; the part over the passage starts at the soffit, the rest keeps its base
  const s410 = byId(410), r = s410.ringsRD[0];
  const north = r.filter(p => Math.abs(loc(p)[1] - 28.1) < 0.3), south = r.filter(p => Math.abs(loc(p)[1] - 49.9) < 0.3);
  if (north.length && south.length) {
    const t = (e1[1] - loc(north[0])[1]) / (loc(south[0])[1] - loc(north[0])[1]);
    const mid = (a: number[], b: number[], z: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z];
    const pN = north.find(p => p[2] - g > 40)!, pS = south.find(p => p[2] - g > 40)!, nLow = north.find(p => p[2] - g < 20)!;
    const sLows = south.filter(p => p[2] - g < 20).sort((a, b) => b[2] - a[2]), sLow = sLows[sLows.length - 1];
    const mTop = mid(pN, pS, pN[2]), mLow = mid(nLow, sLow, nLow[2] + (sLow[2] - nLow[2]) * t);
    const over: Ring3 = [mTop, [mLow[0], mLow[1], top], [nLow[0], nLow[1], top], pN];
    const rest: Ring3 = [pS, ...sLows, mLow, mTop];
    s410.ringsRD = [over]; s410.bottomM = SOFFIT_M; s410.areaM2 = s410.areaM2 * t;
    const id = Math.max(...facts.wallsRD!.map(x => x.surface!)) + 1;
    facts.wallsRD!.push({...clone(s410), surface: id, ringsRD: [rest], bottomM: sLow[2] - g, areaM2: src.wallsRD!.find(x => x.surface === 410)!.areaM2 * (1 - t), onFootprintEdge: false});
  }
  return {facts, passage: {w0, w1, e0, e1, soffit: SOFFIT_M, surfaces: {west: 521, east: [399, 397, 410]}}};
}

/**
 * Soffit and glazed channel walls of the passage (slots: 'glass' for the soffit and panes, 'frame' for mullions and transoms).
 * Mullions are closed boxes 13.5 cm off the pane (the kit's third sheet layer), one per 1.2 m, transoms at the podium storey lines.
 */
export function addPassage(mesh: import('../../src/canalRecall/blockBuilding/mesh').MeshBuilder, p: Passage, storeyM = 3.8) {
  const y = p.soffit, v3 = (q: [number, number], h: number): [number, number, number] => [q[0], h, q[1]];
  const part = mesh.newPart();
  mesh.quad('glass', v3(p.w0, y), v3(p.w1, y), v3(p.e1, y), v3(p.e0, y), part, [0, -1, 0]);
  const cx = (p.w0[0] + p.w1[0] + p.e0[0] + p.e1[0]) / 4, cz = (p.w0[1] + p.w1[1] + p.e0[1] + p.e1[1]) / 4;
  for (const [a, b] of [[p.w0, p.e0], [p.w1, p.e1]] as [number, number][][][]) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    let nx = -uz, nz = ux; if ((cx - a[0]) * nx + (cz - a[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const wp = mesh.newPart();
    mesh.quad('glass', v3(a, 0), v3(b, 0), v3(b, y), v3(a, y), wp, [nx, 0, nz]);
    const at = (s: number, h: number, d: number): [number, number, number] => [a[0] + ux * s + nx * d, h, a[1] + uz * s + nz * d];
    const box = (s0: number, s1: number, h0: number, h1: number, d0: number, d1: number) => {
      const bp = mesh.newPart(), c = (s: number, h: number, d: number) => at(s, h, d);
      mesh.quad('frame', c(s0, h0, d1), c(s1, h0, d1), c(s1, h1, d1), c(s0, h1, d1), bp, [nx, 0, nz]);
      mesh.quad('frame', c(s0, h1, d0), c(s1, h1, d0), c(s1, h1, d1), c(s0, h1, d1), bp, [0, 1, 0]);
      mesh.quad('frame', c(s0, h0, d0), c(s1, h0, d0), c(s1, h0, d1), c(s0, h0, d1), bp, [0, -1, 0]);
      mesh.quad('frame', c(s0, h0, d0), c(s0, h1, d0), c(s0, h1, d1), c(s0, h0, d1), bp, [-ux, 0, -uz]);
      mesh.quad('frame', c(s1, h0, d0), c(s1, h1, d0), c(s1, h1, d1), c(s1, h0, d1), bp, [ux, 0, uz]);
      mesh.quad('frame', c(s0, h0, d0), c(s1, h0, d0), c(s1, h1, d0), c(s0, h1, d0), bp, [-nx, 0, -nz]);
    };
    const n = Math.round(L / 1.2), step = L / n;
    for (let k = 0; k <= n; k++) box(Math.max(0, k * step - 0.04), Math.min(L, k * step + 0.04), 0.1, y - 0.05, 0.045, 0.135);
    for (let h = storeyM; h < y - 0.5; h += storeyM) box(0, L, h - 0.04, h + 0.04, 0.045, 0.135);
    box(0, L, 0, 0.1, 0.045, 0.135);
  }
}
