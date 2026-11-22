/**
 * A stone dormer with concave flared cheeks (klauwstukken): the front outline of a dormer whose straight body stands on
 * a base that sweeps out on both sides in a quarter-ellipse cove, the way the 1870s Sarphati-plan houses on the
 * Weteringschans finish their dormers. Pure geometry in wall-local (t, y), no three.js, the convention of holedWall.ts,
 * mansardDormers.ts and pointedDormer.ts:
 *   t  along the wall, from the viewer's left end (0) to the right end (len), facing the wall from outside;
 *   y  up.
 *
 * Why (2026-11-22, landmarks r14-b, Hotel V Frederiksplein, Weteringschans 136): the three cream stone dormers over the
 * middle bay of each house have a two-light window in a straight body under a moulded cap, and cheeks that curve out to
 * almost twice the body width where they meet the cornice (w01-346, the 2018 leaf-off crop). mansardDormers.ts draws flat
 * box dormers with straight cheeks and pointedDormer.ts lancet heads; neither has the concave cove, and a box read as a
 * plain zinc dormer on the gallery card.
 *
 * The outline runs counter-clockwise from the right foot: up the right cove to the body's side, up the body to the cap
 * line, across, down the left side and cove to the left foot, and back along the base. The cove from the foot
 * (t = c +- (w/2 + flare), y = y0) to the body side (t = c +- w/2, y = y0 + coveH) is the quarter ellipse centred at
 * (c +- (w/2 + flare), y0 + coveH): it leaves the foot along the base and meets the body tangent to it, and its centre
 * lies outside the stone, so the profile is concave from outside (a cove, never a bulge).
 */
export interface ScrollDormerOptions {
  /** Centre of the dormer along the wall. */
  t: number;
  /** Width of the straight body (the window panel). */
  width: number;
  /** How far each foot reaches past the body side (> 0). */
  flare: number;
  /** Base (foot) height. */
  y0: number;
  /** Height of the cove above the base (> 0). */
  coveH: number;
  /** Top of the body (the underside of the cap); > y0 + coveH. */
  y1: number;
  /** Segments per cove (default 6). */
  segments?: number;
}

export interface ScrollDormer {
  /** Front outline, counter-clockwise, no repeated closing point. */
  outline: [number, number][];
  /** The two cove profiles, foot first (left, right). */
  coves: [number, number][][];
}

export function scrollDormer(o: ScrollDormerOptions): ScrollDormer {
  const n = o.segments ?? 6;
  if (!(o.width > 0) || !(o.flare > 0) || !(o.coveH > 0) || !(o.y1 > o.y0 + o.coveH)) throw new Error('scrollDormer: width, flare and coveH must be positive and y1 above the cove');
  const hw = o.width / 2;
  /** Cove on side s (+1 right, -1 left), foot to body: centre (c + s (hw + flare), y0 + coveH), radii flare x coveH. */
  const cove = (s: number): [number, number][] => {
    const cx = o.t + s * (hw + o.flare), cy = o.y0 + o.coveH, pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI / 2) * i / n; // 0 at the foot (straight below the centre), pi/2 at the body side
      pts.push([cx - s * o.flare * Math.sin(a), cy - o.coveH * Math.cos(a)]);
    }
    return pts;
  };
  const right = cove(1), left = cove(-1);
  const outline: [number, number][] = [...right, [o.t + hw, o.y1], [o.t - hw, o.y1], ...[...left].reverse()];
  return {outline, coves: [left, right]};
}
