import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/**
 * "3 bomen, 6 lenzen" (Lens Trees), Thom Puckey, 1989: three bronze trees on the UvA Binnengasthuis site
 * (Binnengasthuisstraat), each trunk forking into curved horn-like branches that carry, between them, six round glass
 * lenses in steel rims. OSM node 4360169260, Wikidata Q26453081 (bronze, 700 cm).
 *
 * Plan: the three trunk bases were triangulated from the bearings in two Gemeente Amsterdam panoramas (CC BY 4.0):
 * TMX7316010203-000717_pano_0000_000526 (2018-05-14, 12 m east-north-east) and TMX7316010203-000224_pano_0000_000767
 * (2017-03-27, 7 m north); their centroid is the model origin, 2.8 m from the OSM node (the panorama positions carry
 * about a metre of error, the node a few). Heights from the elevation angles in the 2018 panorama with the base distances
 * of that triangulation (camera 2.0 m): forks at 3.0-3.2 m, branch tips 6.9-8.3 m (Wikidata gives 7 m, which the
 * trunk-and-main-branch height matches); lens diameters 0.9-1.0 m. Branch and lens arrangement follows that panorama
 * view and the Commons photographs (Ceescamel 2018, Michal Klajban 2012, Thom Puckey's own photograph), see
 * lensbomen-inventory.json.
 *
 * Authoring frame: u to the right and v away from a viewer standing at the 2018 panorama (looking bearing 241), y up;
 * `toNative` maps it to the model's east/south metres.
 */
type Colour = Parameters<BuildingTools['add']>[1];
type P3 = [number, number, number];

/** Viewer's right (bearing 331) and depth (bearing 241) as east/north unit vectors. */
const RIGHT = [Math.sin(331 * Math.PI / 180), Math.cos(331 * Math.PI / 180)];
const DEPTH = [Math.sin(241 * Math.PI / 180), Math.cos(241 * Math.PI / 180)];
/**
 * The panorama reading puts the tallest horn at 8.3 m; the artist's own record (Commons "The lens trees.jpg", Thom Puckey:
 * bronze and perspex, height 700 cm) wins, so every authored position is scaled by SCALE about the centroid. Radii and lens
 * diameters are not scaled: the 2012 photograph's lens-to-height ratio (0.14) and trunk width (0.68 m) fit them as authored.
 */
export const SCALE = 7.0 / 8.3;
/** (u, y, v) -> native (east, y, south). */
const toNative = ([u, y, v]: P3): T.Vector3 => new T.Vector3(u * RIGHT[0] + v * DEPTH[0], y, -(u * RIGHT[1] + v * DEPTH[1])).multiplyScalar(SCALE);

/** Trunk bases in the authoring frame (metres from the centroid). */
export const TRUNKS: Record<'A' | 'B' | 'C', P3> = {A: [-1.68, 0, -0.97], B: [0.69, 0, 2.72], C: [0.98, 0, -1.76]};

/**
 * A tapering tube along a cubic Bezier from p0 to p3 (authoring frame), radius r0 at the start and r1 at the end; a
 * radius of zero closes the end into a point (the horn tips). Rings of `sides` vertices; every triangle is wound to
 * face away from the axis (side faces) or along -/+ the tangent (start and end caps).
 */
export function taperedTube(p0: P3, p1: P3, p2: P3, p3: P3, r0: number, r1: number, steps = 10, sides = 7): {g: T.BufferGeometry; curve: T.CubicBezierCurve3; radius: (t: number) => number} {
  const curve = new T.CubicBezierCurve3(toNative(p0), toNative(p1), toNative(p2), toNative(p3));
  const frames = curve.computeFrenetFrames(steps, false);
  const radius = (t: number) => r0 + (r1 - r0) * Math.pow(t, 0.85);
  const centres: T.Vector3[] = [], rings: T.Vector3[][] = [];
  for (let i = 0; i <= steps; i++) {
    const c = curve.getPointAt(i / steps), r = radius(i / steps), ring: T.Vector3[] = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      ring.push(c.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r));
    }
    centres.push(c); rings.push(ring);
  }
  const pos: number[] = [];
  const tri = (a: T.Vector3, b: T.Vector3, c: T.Vector3, out: T.Vector3) => {
    const n = new T.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (n.lengthSq() < 1e-12) return;
    const [x, y] = n.dot(out) >= 0 ? [b, c] : [c, b];
    for (const v of [a, x, y]) pos.push(v.x, v.y, v.z);
  };
  const last = r1 > 0 ? steps : steps - 1;
  for (let i = 0; i < last; i++) for (let k = 0; k < sides; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % sides], c = rings[i + 1][(k + 1) % sides], d = rings[i + 1][k];
    const mid = centres[i].clone().add(centres[i + 1]).multiplyScalar(0.5);
    const out = a.clone().add(b).add(c).add(d).multiplyScalar(0.25).sub(mid);
    tri(a, d, c, out); tri(a, c, b, out);
  }
  if (r1 <= 0) {
    // the horn tip: one triangle per side from the last full ring to the point
    const tip = centres[steps], i = steps - 1;
    for (let k = 0; k < sides; k++) {
      const a = rings[i][k], b = rings[i][(k + 1) % sides];
      tri(a, b, tip, a.clone().add(b).multiplyScalar(0.5).sub(centres[i]));
    }
  } else {
    const t1 = curve.getTangentAt(1);
    for (let k = 0; k < sides; k++) tri(centres[steps], rings[steps][k], rings[steps][(k + 1) % sides], t1);
  }
  const t0 = curve.getTangentAt(0).negate();
  for (let k = 0; k < sides; k++) tri(centres[0], rings[0][k], rings[0][(k + 1) % sides], t0);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return {g, curve, radius};
}

const off = (base: P3, d: P3): P3 => [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
type Branch = ReturnType<typeof taperedTube>;

/** A branch from `from` (absolute) through two control offsets to a horn tip, all offsets from the trunk base. */
function branch(b: BuildingTools, base: P3, from: P3, c1: P3, c2: P3, tip: P3, r0: number): Branch {
  const br = taperedTube(from, off(base, c1), off(base, c2), off(base, tip), r0, 0, 10, 6);
  b.add(br.g, 'bronze');
  return br;
}

/**
 * A round lens (slightly biconvex perspex disc in a steel rim) held by a branch: its rim meets the branch at parameter
 * t, on side `side` (+1/-1), the disc's plane containing the branch tangent turned by `yawDeg` about it (0 = the plane
 * through the tangent and the horizontal), so it hangs between the horns the way the photographs show.
 */
function lensOn(b: BuildingTools, br: Branch, t: number, d: number, side: 1 | -1, yawDeg = 0) {
  const p = br.curve.getPointAt(t), tan = br.curve.getTangentAt(t).normalize(), r = d / 2;
  // a horizontal direction across the branch, rotated about the tangent by yaw: lies in the lens plane
  let across = new T.Vector3().crossVectors(tan, new T.Vector3(0, 1, 0));
  if (across.lengthSq() < 1e-6) across = new T.Vector3(1, 0, 0);
  across.normalize().applyAxisAngle(tan, yawDeg * Math.PI / 180);
  const normal = new T.Vector3().crossVectors(tan, across).normalize();
  // the rim overlaps the branch by a third of its radius so the lens is visibly held, not floating
  const centre = p.clone().addScaledVector(across, side * (r + 0.035 - br.radius(t) * 0.35));
  const turn = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
  const glass = new T.SphereGeometry(1, 16, 6).scale(r * 0.97, r * 0.97, 0.06).applyQuaternion(turn).translate(centre.x, centre.y, centre.z);
  const rim = new T.TorusGeometry(r, 0.035, 4, 20).applyQuaternion(turn).translate(centre.x, centre.y, centre.z);
  b.add(glass, 'glass'); b.add(rim, 'frame');
}

/** Trunk from the base, vertical at the ground, to the fork. */
function trunk(b: BuildingTools, base: P3, c2: P3, fork: P3) {
  b.add(taperedTube(base, off(base, [0, 1.0, 0]), off(base, c2), fork, 0.34, 0.19, 8, 8).g, 'bronze');
}

export function buildLensbomen(_w: number, _d: number, b: BuildingTools) {
  const {A, B, C} = TRUNKS;
  // ---------- tree A (left from the 2018 viewer): fork at 3.0 m, four branches, two lenses ----------
  const fa: P3 = off(A, [0.05, 3.0, 0]);
  trunk(b, A, [0.05, 2.0, 0], fa);
  const aTall = branch(b, A, fa, [-0.55, 4.6, 0.1], [-0.75, 6.6, 0.15], [-0.45, 8.3, 0.1], 0.17); // tall outer horn
  branch(b, A, fa, [0.35, 4.3, 0.1], [0.55, 5.6, 0.2], [0.55, 6.7, 0.25], 0.13); // inner horn
  const aLow = branch(b, A, off(A, [0, 2.9, 0]), [-0.65, 3.4, -0.2], [-1.05, 4.2, -0.3], [-1.0, 5.6, -0.35], 0.11); // low outer horn
  const aArm = branch(b, A, fa, [0.8, 3.5, 0.3], [1.6, 3.8, 0.6], [2.4, 4.9, 0.8], 0.12); // long arm towards the middle
  void aTall;
  lensOn(b, aLow, 0.55, 0.9, 1, 75); // inside the low outer horn, seen nearly edge-on from the 2018 viewer
  lensOn(b, aArm, 0.45, 1.0, 1, 85); // large lens standing on the arm, face-on
  // ---------- tree B (behind, the leaning trunk): leans 1.6 m east, fork at 3.1 m, three branches, two lenses ----------
  const fb: P3 = off(B, [-0.78, 3.1, -1.4]);
  trunk(b, B, [-0.45, 2.1, -0.85], fb);
  const b1 = branch(b, B, fb, [-1.1, 4.6, -1.5], [-0.9, 6.3, -1.4], [-0.6, 7.6, -1.2], 0.15);
  branch(b, B, fb, [-0.45, 4.4, -1.2], [-0.1, 5.8, -0.9], [0.25, 7.2, -0.6], 0.13);
  const b3 = branch(b, B, fb, [-1.4, 3.4, -1.7], [-2.0, 3.7, -1.9], [-2.4, 4.8, -2.3], 0.11);
  lensOn(b, b3, 0.5, 0.95, 1, 80);
  lensOn(b, b1, 0.45, 0.95, 1, 40);
  // ---------- tree C (right): upright, fork at 3.2 m, three branches, two lenses ----------
  const fc: P3 = off(C, [0, 3.2, 0]);
  trunk(b, C, [-0.05, 2.1, 0], fc);
  const c1 = branch(b, C, fc, [0.45, 4.6, 0.05], [0.5, 6.0, 0.1], [0.05, 6.9, 0.1], 0.15);
  branch(b, C, fc, [-0.35, 4.2, -0.1], [-0.6, 5.0, -0.15], [-0.6, 5.8, -0.2], 0.12);
  const c3 = branch(b, C, fc, [0.5, 3.6, 0.5], [0.95, 4.2, 0.85], [1.0, 5.2, 0.95], 0.11);
  lensOn(b, c1, 0.4, 0.95, -1, 30);
  lensOn(b, c3, 0.5, 0.9, 1, 60);
}
