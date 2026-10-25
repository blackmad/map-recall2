/**
 * Pure geometry for windmill sails (wieken), shared by the bespoke mill builders (scripts/landmarks/windmill-kit.ts).
 *
 * Frame: the mill's own frame before it is turned to its facing: metres, Y up, sails in front of the cap on +Z. The
 * windshaft rises towards the front, so the sail plane leans back: a point `yv` metres above the hub sits `yv * lean`
 * metres behind it (De Gooyer's builder used lean 0.24, about 13.5 degrees).
 *
 * A sail is a stock (roe) of length `radius` from the hub; its lattice sits on the trailing side, `lateral` metres off
 * the stock. `rotationDeg` turns the whole sail cross clockwise as seen from the front (0 = one stock straight up).
 */
export type Vec3 = readonly [number, number, number];

export interface SailCross {
  hub: Vec3;
  /** Stock length from the hub: half the sail span (vlucht). */
  radius: number;
  rotationDeg: number;
  lean: number;
  /** Number of stocks; Dutch mills have four. */
  count?: number;
}

/** Point `r` metres out along sail `k`, `lateral` metres to its trailing side. */
export function sailPoint(cross: SailCross, k: number, r: number, lateral = 0): [number, number, number] {
  const n = cross.count ?? 4, a = (cross.rotationDeg * Math.PI) / 180 + (k * 2 * Math.PI) / n;
  const s = Math.sin(a), c = Math.cos(a), yv = c * r - s * lateral;
  return [cross.hub[0] + s * r + c * lateral, cross.hub[1] + yv, cross.hub[2] - yv * cross.lean];
}

/** Every sail's outer corners (stock tip and lattice tip). */
export function sailTips(cross: SailCross, latticeWidth: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k < (cross.count ?? 4); k++) out.push(sailPoint(cross, k, cross.radius), sailPoint(cross, k, cross.radius, latticeWidth));
  return out;
}

/**
 * Clearance of the sweep against the mill: the lowest point any sail reaches in a full turn (hub height minus the
 * radius scaled by the lean), and the horizontal distance from the mill axis (x = 0, z = 0) at which that lowest point
 * passes. A stage (stelling) or shed roof of radius R at height H is cleared when lowest >= H or forward > R.
 */
export function sweepClearance(cross: SailCross): {lowest: number; forward: number} {
  const lowestYv = -cross.radius;
  return {lowest: cross.hub[1] + lowestYv, forward: Math.hypot(cross.hub[0], cross.hub[2] - lowestYv * cross.lean)};
}
