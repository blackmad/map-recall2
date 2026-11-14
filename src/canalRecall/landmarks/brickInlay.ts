/**
 * Brick inlay and stone-dressing outlines of the 1900s eclectic factory front: lozenges (ruitjes, the red-brick diamond
 * crosses set into a yellow-brick front), a pierced parapet band (a row of square holes through the parapet of a corner
 * turret) and the side profile of a closed balcony on a tapered stone corbel.
 *
 * Why (venues-ring lane, 2026-11-14, Diamantslijperij Asscher, Tolstraat 127): van Arkel's 1907 factory sets red-brick
 * lozenge crosses into every spandrel of its yellow front, crowns the two Tolstraat corner turrets with an openwork
 * parapet of square holes, and hangs two closed stone balconies on corbels beside the 1907 tablet (panoramas
 * recording_2025-07-14_08-27-06_01061, TMX7316010203-002112_pano_0001_000113). The kit had single boxes and
 * `crenellationOutline` (merlons cut down from the top edge), which cannot say a hole through a closed parapet, a
 * diamond set on its point, or a balcony whose underside tapers back into the wall.
 *
 * Pure geometry, no three.js, in the wall frame of `crenellation.ts`: points are (t, y), t along the wall from the
 * viewer's left, y up, counter-clockwise, first point not repeated. Nothing changes for models that do not call these.
 */
export type Pt = [number, number];
export type Rect = {t0: number; t1: number; y0: number; y1: number};

/** A lozenge (square set on its point) centred at (t, y), `r` from the centre to each point. */
export function lozenge(t: number, y: number, r: number): Pt[] {
  if (!(r > 0)) throw Error('lozenge: r > 0');
  return [[t, y - r], [t + r, y], [t, y + r], [t - r, y]];
}

/**
 * A cross of five lozenges (the "ruitjeskruis"): a centre lozenge and one touching each of its points, so the cross is
 * 6r wide and high. Returned centre first, then bottom, right, top, left.
 */
export function lozengeCross(t: number, y: number, r: number): Pt[][] {
  return [lozenge(t, y, r), lozenge(t, y - 2 * r, r), lozenge(t + 2 * r, y, r), lozenge(t, y + 2 * r, r), lozenge(t - 2 * r, y, r)];
}

/** Centres `pitch` apart filling t0..t1 evenly, the first and last half a pitch in (as a row of n tiles fills its length). */
export function rowCentres(t0: number, t1: number, pitch: number): number[] {
  if (!(t1 > t0 && pitch > 0)) return [];
  const n = Math.max(1, Math.round((t1 - t0) / pitch)), step = (t1 - t0) / n;
  return Array.from({length: n}, (_, k) => t0 + step * (k + 0.5));
}

/**
 * Pierced parapet: `holes` square-ish openings of width `hole` spread evenly across t0..t1 with equal solid between
 * them and at both ends, from yHole0 to yHole1. Throws when the holes do not fit with at least `minSolid` between.
 */
export function piercedHoles(o: {t0: number; t1: number; yHole0: number; yHole1: number; holes: number; hole: number; minSolid?: number}): Rect[] {
  const n = Math.round(o.holes), len = o.t1 - o.t0;
  if (n < 1) throw Error('piercedHoles: at least one hole');
  if (!(o.yHole1 > o.yHole0)) throw Error('piercedHoles: yHole0 < yHole1');
  const solid = (len - n * o.hole) / (n + 1);
  if (!(solid >= (o.minSolid ?? 0.05))) throw Error('piercedHoles: holes do not fit');
  return Array.from({length: n}, (_, k) => {
    const t0 = o.t0 + solid + k * (o.hole + solid);
    return {t0, t1: t0 + o.hole, y0: o.yHole0, y1: o.yHole1};
  });
}

/**
 * Side profile of a closed balcony on a tapered corbel, in (o, y): o out of the wall (0 = wall plane), y up. The
 * parapet box runs from the balcony floor `yFloor` to `yTop` and reaches `depth` out; under the floor the corbel tapers
 * from the full depth back to the wall over `corbel` metres. Extrude it along t for the balcony's width.
 */
export function corbelBalconyProfile(o: {yFloor: number; yTop: number; depth: number; corbel: number}): Pt[] {
  if (!(o.yTop > o.yFloor && o.depth > 0 && o.corbel > 0)) throw Error('corbelBalconyProfile: yFloor < yTop, depth and corbel > 0');
  return [[0, o.yFloor - o.corbel], [o.depth, o.yFloor], [o.depth, o.yTop], [0, o.yTop]];
}
