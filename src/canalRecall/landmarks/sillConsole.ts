/**
 * Scalloped stone sill apron ("console" under a window sill): the shaped block that hangs under the sill of 19th-century
 * and neo-19th-century brick fronts, flat on top, with a short straight drop at each end, two concave scallops sweeping in
 * and down to a central pendant. Pure geometry: a closed outline in (t, y) about the apron's top centre, y down from 0,
 * counter-clockwise, for the caller to extrude (nearbar-kit `poly`).
 *
 * Why a component (2026-11-22, lane landmarks-r14-a, Hotel Notting Hill, Westeinde 26): every window on both fronts sits
 * on a stone sill with this apron (TMX7316010203-002545_pano_0000_000344, 2022: about 0.8 of the sill width, 0.2 m
 * deep, end drops a third of the depth, a pendant a fifth of the width). The kit drew sills as one slab, which at street
 * size read as a plain ledge instead of the white scalloped accent under each window that the photo shows.
 */
export type P2 = [number, number];

export interface SillConsoleOptions {
  /** Width of the apron's top edge, metres. */
  width: number;
  /** Depth below the sill (to the pendant's tip), metres. */
  depth: number;
  /** Straight drop at each end, as a share of `depth` (default 0.35). */
  endDrop?: number;
  /** Pendant width as a share of `width` (default 0.2). */
  pendant?: number;
  /** Points per scallop (default 5). */
  steps?: number;
}

/** Closed apron outline, counter-clockwise, top edge at y = 0, pendant tip at y = -depth. */
export function sillConsoleOutline(o: SillConsoleOptions): P2[] {
  const w = o.width, h = o.depth, half = w / 2, steps = Math.max(2, Math.round(o.steps ?? 5));
  const drop = h * Math.min(0.9, Math.max(0.05, o.endDrop ?? 0.35)), pw = w * Math.min(0.8, Math.max(0.02, o.pendant ?? 0.2)) / 2;
  if (!(w > 0) || !(h > 0)) return [];
  // right scallop: from the end drop (half, -drop) to the pendant shoulder (pw, -h * 0.8), concave (bulging up toward the sill)
  const scallop = (sgn: number): P2[] => {
    const pts: P2[] = [];
    for (let k = 0; k <= steps; k++) {
      const s = k / steps, x = half - (half - pw) * s;
      // quarter-ellipse rising toward the top centre: y stays high near the end, falls to the shoulder
      const y = -drop - (h * 0.8 - drop) * (1 - Math.cos((s * Math.PI) / 2));
      pts.push([sgn * x, y]);
    }
    return pts;
  };
  // counter-clockwise from the top left: down the left end, along the left scallop, round the pendant, up the right
  return [[-half, 0], ...scallop(-1), [-pw, -h], [pw, -h], ...scallop(1).reverse(), [half, 0]];
}

/** Signed shoelace area of an outline in (t, y): positive when counter-clockwise. */
export function outlineArea(p: P2[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
