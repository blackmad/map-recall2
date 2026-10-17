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

/** A bay standing in front of a discovered front whose ends already sit on the facade line. */
export interface FrontBump {
  fromM: number; toM: number; depthM: number; centre: number;
  /**
   * Only when one endpoint stands on the bay (Eemsstraat 30, pand 111889: the erker runs into the party wall, so discovery
   * ends the front on the bay's side): two chain vertices on the facade line, the rear supporting line of the chain.
   * `fromM`/`toM`/`centre` are then measured along that line, between the endpoints' projections onto it.
   */
  lineRD?: [RD, RD];
}
/** Least outward depth (m) of a chain vertex that makes it a bay, not a jog of the brickwork. */
export const BUMP_MIN_DEPTH_M = 0.25;

/**
 * The bay in a front's chain (Rivierenbuurt 1934 rows, Boterdiepstraat 36-66: BAG outlines carry the canted brick erker,
 * 0.8 m deep and 2.7 m along a 6.1 m front, and discovery keeps the whole 6.1 m front "across a native jog"): the chain
 * vertices standing more than `BUMP_MIN_DEPTH_M` in front of the line through the front's two endpoints, as metres along
 * the front from its first endpoint (left seen from the street), their deepest offset and the centre as a share of the
 * width. Null when the chain is straight, or when an endpoint itself is off the facade line (a bay-front discovery:
 * `chordOverBay` with `bayChord`).
 */
export function frontBump(front: Pick<FrontFacts, 'endpointsRD' | 'chainRD' | 'outwardNormalRD'>): FrontBump | null {
  const along = (a: RD, b: RD) => {
    const w = dist(a, b), u = [(b[0] - a[0]) / w, (b[1] - a[1]) / w];
    let n = [u[1], -u[0]];
    if (n[0] * front.outwardNormalRD[0] + n[1] * front.outwardNormalRD[1] < 0) n = [-n[0], -n[1]];
    return (q: number[]) => ({t: (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1], d: (q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1]});
  };
  const [a, b] = front.endpointsRD;
  let at = along(a, b), lineRD: [RD, RD] | undefined;
  // An endpoint on the bay puts facade vertices behind the endpoint line: take the chain's rear supporting line instead
  // (through two chain vertices at least 1.5 m apart with no vertex more than 3 cm behind it), the longest such.
  if (front.chainRD.some(q => at(q).d < -0.05)) {
    let best: {i: number; j: number; span: number} | null = null;
    const c = front.chainRD;
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
      const span = dist(c[i], c[j]);
      if (span < 1.5 || (best && span <= best.span)) continue;
      const f = along(c[i], c[j]);
      if (c.every(q => f(q).d > -0.03)) best = {i, j, span};
    }
    if (!best) return null;
    lineRD = [c[best.i], c[best.j]];
    at = along(...lineRD);
  }
  const t0 = at(a).t, t1 = at(b).t, w = t1 - t0;
  const out = front.chainRD.map(at).filter(x => x.d > BUMP_MIN_DEPTH_M);
  if (!out.length || w <= 0) return null;
  const fromM = Math.min(...out.map(x => x.t)) - t0, toM = Math.max(...out.map(x => x.t)) - t0;
  return {fromM: round(fromM, 2), toM: round(toM, 2), depthM: round(Math.max(...out.map(x => x.d)), 2), centre: round((fromM + toM) / 2 / w, 3), ...(lineRD ? {lineRD} : {})};
}

/**
 * `chordOverBay` on the front's own endpoints when its chain carries a bay (`frontBump`): the footprint, survey polygons
 * and roofs are clipped to the facade line, so the kit draws the erker (`bayWindows`) and the chunk front is one straight
 * surveyed wall. Null when there is no bump.
 */
export function chordOverFrontBump(facts: BuildingFacts): BuildingFacts | null {
  const f = facts.fronts[0], bump = frontBump(f);
  if (!bump) return null;
  let chord = {a: f.endpointsRD[0], b: f.endpointsRD[1]};
  if (bump.lineRD) {
    // The chord ends: the footprint vertices on the facade line nearest the discovered endpoints (Eemsstraat 30: the
    // party corner the neighbour's front starts from, beside the bay's side).
    const [p, q] = bump.lineRD, w = dist(p, q), n = [(q[1] - p[1]) / w, -(q[0] - p[0]) / w];
    const ring = facts.bagFootprintRD[0], onLine = ring.filter(v => Math.abs((v[0] - p[0]) * n[0] + (v[1] - p[1]) * n[1]) < 0.03);
    const nearest = (e: RD) => onLine.reduce((m, v) => dist(v, e) < dist(m, e) ? v : m, onLine[0]);
    if (onLine.length < 2) return null;
    chord = {a: [nearest(chord.a)[0], nearest(chord.a)[1]], b: [nearest(chord.b)[0], nearest(chord.b)[1]]};
    if (dist(chord.a, chord.b) < 1) return null;
  }
  const next = chordOverBay(facts, chord);
  // Where the facade line runs through an outline vertex (BAG draws the erker's foot on it), clipping adds the cut point
  // beside that vertex; the near-duplicate (Boterdiepstraat 40: 0.2 mm) folds the roof prism. Every vertex within 1 cm
  // of one already seen (survey footprint first, then BAG, then the roofs) takes that one's plan position, so all rings
  // share it, and repeats in a ring are dropped (the explicit `--bay-outline=<pand6>` path stays as it was).
  const seen: number[][] = [];
  const canon = <T extends number[]>(v: T): T => {
    const k = seen.find(q => Math.hypot(q[0] - v[0], q[1] - v[1]) < 0.01);
    if (!k) { seen.push(v); return v; }
    return (v.length > 2 ? [k[0], k[1], ...v.slice(2)] : [k[0], k[1]]) as T;
  };
  const ring = <T extends number[]>(r: T[]): T[] => {
    const c = r.map(canon);
    let out = c.filter((v, i) => { const q = c[(i + c.length - 1) % c.length]; return q[0] !== v[0] || q[1] !== v[1]; });
    // A spike along the facade line (Eemsstraat 30: the bay side ends 0.2 m past the party corner, so the clipped ring
    // runs out along the line and back): drop a vertex whose two edges turn back on each other with no area between.
    for (let again = true; again && out.length > 3;) {
      again = false;
      for (let i = 0; i < out.length; i++) {
        const p = out[(i + out.length - 1) % out.length], v = out[i], q = out[(i + 1) % out.length];
        const e1 = [v[0] - p[0], v[1] - p[1]], e2 = [q[0] - v[0], q[1] - v[1]];
        if (Math.abs(e1[0] * e2[1] - e1[1] * e2[0]) < 1e-3 && e1[0] * e2[0] + e1[1] * e2[1] < 0) { out = out.filter((_, k) => k !== i); again = true; break; }
      }
    }
    return out.length >= 3 ? out : c;
  };
  const surveyFootprintPolygonsRD = next.surveyFootprintPolygonsRD.map(p => p.map(ring)), bagFootprintRD = next.bagFootprintRD.map(ring);
  return {...next, bagFootprintRD, surveyFootprintPolygonsRD, roofsRD: next.roofsRD.map(r => ({...r, vertices: ring(r.vertices), ringsRD: r.ringsRD.map(ring)}))};
}
