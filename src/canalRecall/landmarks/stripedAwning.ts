/**
 * Fixed fabric canopy (Dutch "markies") over a window, in stripes of two alternating colours, following a plan polyline:
 * a straight shop window or the three faces of a canted bay. Pure geometry in a wall's local frame (t along the wall from
 * the viewer's left, y up, o out of the wall), no three.js.
 *
 * Why (2026-11-22, landmark lane r10-A): every oriel window of the former Maison De Vries on the Leidseplein (A. Jacot,
 * 1917) carries a navy-and-white striped markies whose cloth wraps the canted bay, with a scalloped valance and the
 * striped side cheeks hanging down the cants (Gemeente Amsterdam panoramas TMX7316010203-002306_pano_0001_001396, 2021,
 * and TMX7316010203-001660_pano_0000_000662, 2020). The kit's `awning` (nearbar-kit) is a one-colour quarter-dome hood on
 * a straight wall, and `dropArmAwning` a one-colour flat cloth on arms: neither can say stripes, a canted plan or a
 * scalloped valance, and a flat-colour model without textures can only draw stripes as separate strips of geometry. The
 * plain cream shop awnings of the former Winkelhuis Broekmans (Koningsplein, A. Jacot 1904) use the same part with one
 * colour and a straight head.
 *
 * The cloth runs from the `head` polyline (on the wall or bay face, at yHead) down to the `lip` polyline (same vertex
 * count, `drop` lower); the valance hangs `valance` below the lip, each stripe ending in a pointed tongue `scallop` deep;
 * the optional cheeks close the ends between the head and the lip. Every polygon is returned twice (both windings), since
 * a rider sees the cloth from below and a gallery camera from above. Each carries `stripe` (0 or 1), counted along the
 * whole run so the pattern is continuous round the bay.
 */
export type TO = [number, number];
export type AwningPolygon = {pts: [number, number, number][]; stripe: 0 | 1};
export type StripedAwning = {cloth: AwningPolygon[]; valance: AwningPolygon[]; cheeks: AwningPolygon[]; stripes: number};
export type StripedAwningOpts = {
  /** Head line in plan (t, o), left to right, at least two points. */
  head: TO[];
  /** Lip line in plan, one point per head point (see `lipFromHead`). */
  lip: TO[];
  yHead: number;
  /** Vertical drop from the head to the lip, m (> 0). */
  drop: number;
  /** Target stripe width along the run, m (> 0); each segment gets a whole number of stripes. */
  stripe: number;
  /** Valance depth below the lip, m (0 = none). */
  valance?: number;
  /** Depth of each valance stripe's pointed tongue, m (0 = straight hem; at most the valance). */
  scallop?: number;
  /** Close both ends with a cheek from the head down to the valance hem. */
  cheeks?: boolean;
  /** Height of the cheeks' hem where they meet the wall (default the valance hem); the hem runs straight to the valance hem at the lip, so a markies' side cheek can hang lower against the wall than its front. */
  cheekHem?: number;
  /** Colour index of the first stripe (default 0). */
  first?: 0 | 1;
};

const lerp2 = (a: TO, b: TO, k: number): TO => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const P = (p: TO, y: number): [number, number, number] => [p[0], y, p[1]];
const both = (pts: [number, number, number][], stripe: 0 | 1): AwningPolygon[] => [{pts, stripe}, {pts: pts.slice().reverse(), stripe}];

/**
 * The lip of an awning `proj` metres out from its head line: each segment offset along its outward normal (+o for a run
 * left to right), mitred at interior vertices; the two ends are pushed straight out from the wall (+o) by `endProj`
 * (default `proj`) so the cheeks stand square to the wall beside the piers.
 */
export function lipFromHead(head: TO[], proj: number, endProj = proj): TO[] {
  if (head.length < 2) throw Error('lipFromHead: two head points required');
  if (!(proj > 0 && endProj >= 0)) throw Error('lipFromHead: positive projection required');
  const nrm = (a: TO, b: TO): TO => { const dt = b[0] - a[0], d = b[1] - a[1], L = Math.hypot(dt, d); return [-d / L, dt / L]; };
  const out: TO[] = [];
  for (let i = 0; i < head.length; i++) {
    if (i === 0 || i === head.length - 1) { out.push([head[i][0], head[i][1] + endProj]); continue; }
    const n0 = nrm(head[i - 1], head[i]), n1 = nrm(head[i], head[i + 1]);
    const m: TO = [n0[0] + n1[0], n0[1] + n1[1]], ml = Math.hypot(m[0], m[1]);
    // mitre: the bisector scaled so both offset lines stay `proj` from their segments
    const k = proj / Math.max(1e-6, (m[0] * n0[0] + m[1] * n0[1]) / ml);
    out.push([head[i][0] + m[0] / ml * k, head[i][1] + m[1] / ml * k]);
  }
  return out;
}

export function stripedAwning(o: StripedAwningOpts): StripedAwning {
  const {head, lip, yHead, drop, stripe} = o;
  if (head.length < 2 || lip.length !== head.length) throw Error('stripedAwning: head and lip need the same two or more points');
  if (!(drop > 0 && stripe > 0)) throw Error('stripedAwning: positive drop and stripe width required');
  const val = Math.max(0, o.valance ?? 0), sc = Math.min(val, Math.max(0, o.scallop ?? 0));
  const yLip = yHead - drop, yHem = yLip - val;
  const cloth: AwningPolygon[] = [], valance: AwningPolygon[] = [], cheeks: AwningPolygon[] = [];
  let s = o.first ?? 0, count = 0;
  for (let i = 0; i + 1 < head.length; i++) {
    const len = Math.hypot(head[i + 1][0] - head[i][0], head[i + 1][1] - head[i][1]);
    const n = Math.max(1, Math.round(len / stripe));
    for (let k = 0; k < n; k++) {
      const h0 = lerp2(head[i], head[i + 1], k / n), h1 = lerp2(head[i], head[i + 1], (k + 1) / n);
      const l0 = lerp2(lip[i], lip[i + 1], k / n), l1 = lerp2(lip[i], lip[i + 1], (k + 1) / n);
      const c = s as 0 | 1;
      cloth.push(...both([P(h0, yHead), P(h1, yHead), P(l1, yLip), P(l0, yLip)], c));
      if (val > 0) {
        const mid = lerp2(l0, l1, 0.5);
        valance.push(...both(sc > 0 ? [P(l0, yLip), P(l1, yLip), P(l1, yHem + sc), P(mid, yHem), P(l0, yHem + sc)] : [P(l0, yLip), P(l1, yLip), P(l1, yHem), P(l0, yHem)], c));
      }
      s = (1 - s) as 0 | 1; count++;
    }
  }
  if (o.cheeks) {
    for (const [hp, lp] of [[head[0], lip[0]], [head[head.length - 1], lip[lip.length - 1]]] as [TO, TO][]) {
      const w = Math.hypot(lp[0] - hp[0], lp[1] - hp[1]);
      const n = Math.max(1, Math.round(w / stripe));
      // vertical bands from the wall out to the lip: the top edge follows the sloping cloth, the bottom is the hem
      for (let k = 0; k < n; k++) {
        const a = lerp2(hp, lp, k / n), b = lerp2(hp, lp, (k + 1) / n);
        const ya = yHead - drop * k / n, yb = yHead - drop * (k + 1) / n;
        const wallHem = Math.min(o.cheekHem ?? yHem, yLip), hem = (j: number) => wallHem + (yHem - wallHem) * j / n;
        cheeks.push(...both([P(a, ya), P(b, yb), P(b, hem(k + 1)), P(a, hem(k))], ((o.first ?? 0) + k) % 2 as 0 | 1));
      }
    }
  }
  return {cloth, valance, cheeks, stripes: count};
}
