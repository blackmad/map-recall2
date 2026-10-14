/**
 * Bay outline in the BAG footprint (Nassaukade 146, pand 0363100012160704): BAG draws a pand from above, so an erker that
 * overhangs the street is part of its outline, and 3DBAG extrudes that outline to the roof (146's 1.6 m wide, 0.84 m deep
 * canted bay stands to 13 m in LoD2.2 although the real erker is one storey). Frontage discovery then takes the bay's front
 * face for the house front (its sides stand ~51 degrees off the facade), so the strip, the fit and the gates see a 1.6 m
 * house.
 *
 * `chordOverBay` rebuilds such a pand's facts on the facade line: the frontage runs from the last facade vertex before the
 * bay to the first one after it, footprint rings and roof surfaces are clipped to the house side of that chord (heights
 * interpolated along clipped roof edges), and the front's top profile is resampled on the chord. The erker itself is then
 * the kit's job (`bayWindows.bays`). Pure and deterministic; the block-face intake applies it to the pands named by
 * `--bay-outline`.
 */
import {roofHeightAt, type BuildingFacts, type FrontFacts, type RD} from '../buildingRecipe/facts.ts';

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (v: number, d = 4) => +v.toFixed(d);

/** Keep the part of a closed ring with signed distance <= tol from the line (point on it `p`, unit normal `n` pointing to the street). */
export function clipRing<P extends number[]>(ring: P[], p: number[], n: number[], tol = 0.02): P[] {
  const closed = ring.length > 1 && dist(ring[0], ring.at(-1)!) < 1e-9, pts = closed ? ring.slice(0, -1) : ring;
  const d = (q: number[]) => (q[0] - p[0]) * n[0] + (q[1] - p[1]) * n[1];
  const out: P[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], da = d(a), db = d(b);
    if (da <= tol) out.push(a);
    if ((da <= tol) !== (db <= tol)) {
      // Cross the line itself (d = 0) where the edge leaves or enters the kept side.
      const t = da / (da - db), q = a.map((v, k) => v + (b[k] - v) * Math.min(1, Math.max(0, t))) as P;
      out.push(q);
    }
  }
  const dedup = out.filter((q, i) => dist(q, out[(i + 1) % out.length]) > 1e-6);
  return closed && dedup.length ? [...dedup, dedup[0]] : dedup;
}

const areaOf = (ring: number[][]) => { let s = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };

/**
 * The facade chord around a bay: from the bay front (the discovered front), walk the footprint ring outward on both sides
 * while the edges are bay sides (more than 35 degrees off the bay front's direction, or standing in front of the facade
 * line); the first vertex after them on each side, then along the facade edge to its far end, gives the chord ends.
 */
export function bayChord(facts: BuildingFacts): {a: RD; b: RD} {
  const front = facts.fronts[0], ring = facts.bagFootprintRD[0];
  const pts = dist(ring[0], ring.at(-1)!) < 1e-9 ? ring.slice(0, -1) : ring, n = pts.length;
  const idx = (q: number[]) => pts.findIndex(v => dist(v, q) < 1e-4);
  const [fa, fb] = front.endpointsRD, ia = idx(fa), ib = idx(fb);
  if (ia < 0 || ib < 0) throw Error(`${facts.pandId}: bay front endpoints are not BAG footprint vertices`);
  const u = [(fb[0] - fa[0]) / dist(fa, fb), (fb[1] - fa[1]) / dist(fa, fb)];
  // Ring direction from fa that does not run through fb first.
  const step = (ia + 1) % n === ib ? -1 : 1;
  const walk = (start: number, dir: number, sign: number): RD => {
    let i = start;
    for (let k = 0; k < 6; k++) {
      const j = (i + dir + n) % n, e = [pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]], len = Math.hypot(e[0], e[1]);
      const along = sign * (e[0] * u[0] + e[1] * u[1]) / len;
      // A facade edge runs along the front direction (within 35 degrees); the bay sides do not.
      if (along >= Math.cos(35 * Math.PI / 180)) return pts[j] as RD;
      i = j;
    }
    throw Error(`${facts.pandId}: no facade edge beside the bay within 6 ring edges`);
  };
  return {a: walk(ia, step, -1), b: walk(ib, -step, 1)};
}

/** Facts rebuilt on the chord a-b (left to right seen from the street): see the module comment. */
export function chordOverBay(facts: BuildingFacts, chord = bayChord(facts)): BuildingFacts {
  const {a, b} = chord, w = dist(a, b), u = [(b[0] - a[0]) / w, (b[1] - a[1]) / w];
  const old = facts.fronts[0], n0 = old.outwardNormalRD;
  // Unit normal of the chord, on the street side (the side the discovered front faced).
  let n = [u[1], -u[0]];
  if (n[0] * n0[0] + n[1] * n0[1] < 0) n = [-n[0], -n[1]];
  const clipPoly = (poly: RD[][]) => poly.map(r => clipRing(r, a, n)).filter(r => r.length >= 3);
  const bagFootprintRD = clipPoly(facts.bagFootprintRD);
  const surveyFootprintPolygonsRD = facts.surveyFootprintPolygonsRD.map(clipPoly).filter(p => p.length && areaOf(p[0]) > 0.01);
  const roofsRD = facts.roofsRD.map(r => {
    const ringsRD = r.ringsRD.map(ring => clipRing(ring, a, n)).filter(ring => ring.length >= 3);
    if (!ringsRD.length || areaOf(ringsRD[0]) < 0.01) return null;
    const vertices = clipRing(r.vertices, a, n);
    return {...r, vertices, ringsRD, areaM2: round(r.areaM2 * areaOf(ringsRD[0]) / Math.max(1e-6, areaOf(r.ringsRD[0])), 2)};
  }).filter((r): r is BuildingFacts['roofsRD'][number] => r !== null);
  // The chain: every clipped survey vertex on the chord, in order along it.
  const onChord = surveyFootprintPolygonsRD.flatMap(p => p[0]).filter(q => Math.abs((q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1]) < 0.03)
    .map(q => ({q: [q[0], q[1]] as RD, t: (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1]})).filter(x => x.t > -0.01 && x.t < w + 0.01).sort((x, y) => x.t - y.t);
  const chainRD = onChord.filter((x, i) => i === 0 || x.t - onChord[i - 1].t > 1e-4).map(x => x.q);
  if (!chainRD.length || dist(chainRD[0], a) > 1e-3 || dist(chainRD.at(-1)!, b) > 1e-3) throw Error(`${facts.pandId}: chord ends are not survey footprint vertices`);
  const topProfile: FrontFacts['topProfile'] = [];
  for (let k = 0; k <= 40; k++) {
    const t = w * (0.01 + 0.98 * k / 40), on = [a[0] + u[0] * t, a[1] + u[1] * t], h = roofHeightAt(roofsRD, [on[0] - n[0] * 0.08, on[1] - n[1] * 0.08], facts.heights.groundNAP);
    if (h !== null) topProfile.push({alongM: round(t, 3), heightM: h});
  }
  const hs = topProfile.map(p => p.heightM).sort((x, y) => x - y);
  const front: FrontFacts = {...old, endpointsRD: [a, b], chainRD, widthM: w, outwardNormalRD: [n[0], n[1]], topProfile, eavesM: hs[Math.floor(hs.length * 0.1)] ?? NaN, topM: hs.at(-1) ?? NaN,
    uncertainty: [...old.uncertainty, `Frontage rebuilt as the facade chord over a BAG bay outline (was the ${round(old.widthM, 2)} m bay front; blockFace/bayOutline.ts).`]};
  const roofZ = roofsRD.flatMap(r => r.vertices.map(v => v[2] - facts.heights.groundNAP));
  return {...facts, bagFootprintRD, surveyFootprintPolygonsRD, roofsRD, fronts: [front, ...facts.fronts.slice(1)],
    heights: {...facts.heights, roofMinM: round(Math.min(...roofZ), 2), roofMaxM: round(Math.max(...roofZ), 2)}};
}
