/**
 * Drop-arm fabric awning (Dutch "uitvalscherm") over a window, as pure geometry in a wall's local frame
 * (t along the wall from the viewer's left, y up, o out of the wall; (t, y, o) right-handed).
 *
 * Why (2026-11-20, landmark lane kramatplantsoen-203, Flevohuis Kramatplantsoen 203-263): nearly every window of the care
 * home's Kramatplantsoen front carries a cream retractable awning: a flat cloth hung from a head rail on the wall, pushed
 * out and down by two side arms to a front bar, with a short valance flap hanging from the bar (panoramas
 * TMX7316010203-001207_pano_0000_001993, 2019). The kit's `awning` (nearbar-kit) is a quarter-dome hood, a curved shop
 * canopy that reads as a solid shell; a straight sloping cloth you see from below, with its arms, was not expressible.
 *
 * Every surface is returned twice (front and back winding) because a rider sees the cloth from below and a gallery camera
 * from above. No three.js.
 */
export type AwningQuad = {pts: [number, number, number][]};
export type DropArmAwning = {
  /** The cloth from the head rail (o = 0, y = yTop) to the front bar (o = proj, y = yTop - drop), both windings. */
  cloth: AwningQuad[];
  /** The valance hanging `valance` below the front bar, both windings. */
  valance: AwningQuad[];
  /** The two side arms, thin ribbons from the wall pivot to the bar ends, both windings. */
  arms: AwningQuad[];
};
export type DropArmOpts = {
  /** Valance depth below the front bar, m (0 = none). */
  valance?: number;
  /** Arm ribbon width, m. */
  armW?: number;
  /** How far below the cloth's head the arms pivot on the wall, m (drop-arm awnings pivot at the window's side, lower). */
  pivotBelow?: number;
};

const rev = (q: AwningQuad): AwningQuad => ({pts: q.pts.slice().reverse()});

/**
 * Awning `w` wide from t = 0, head at yTop on the wall, front bar `proj` out and `drop` lower. Throws on a non-positive
 * width, projection or drop.
 */
export function dropArmAwning(w: number, yTop: number, proj: number, drop: number, o: DropArmOpts = {}): DropArmAwning {
  if (!(w > 0 && proj > 0 && drop > 0)) throw Error('dropArmAwning: positive width, projection and drop required');
  const val = o.valance ?? 0.2, aw = o.armW ?? 0.04, pivot = o.pivotBelow ?? drop + 0.5;
  const yb = yTop - drop;
  // the cloth's upper face, counter-clockwise seen from above and outside (normal up and out)
  const top: AwningQuad = {pts: [[0, yb, proj], [w, yb, proj], [w, yTop, 0], [0, yTop, 0]]};
  const cloth = [top, rev(top)];
  const valance: AwningQuad[] = [];
  if (val > 0) {
    const front: AwningQuad = {pts: [[0, yb - val, proj], [w, yb - val, proj], [w, yb, proj], [0, yb, proj]]};
    valance.push(front, rev(front));
  }
  // arms: from the wall pivot (o = 0, yTop - pivot) up and out to the bar end (o = proj, yb), a ribbon `aw` wide in t
  const arms: AwningQuad[] = [];
  for (const t of [aw / 2, w - aw / 2]) {
    // a ribbon `aw` wide along t (a ribbon in the plane t = const would be edge-on to a rider in front)
    const ribbon: AwningQuad = {pts: [[t - aw / 2, yTop - pivot, 0], [t + aw / 2, yTop - pivot, 0], [t + aw / 2, yb, proj], [t - aw / 2, yb, proj]]};
    arms.push(ribbon, rev(ribbon));
  }
  return {cloth, valance, arms};
}
