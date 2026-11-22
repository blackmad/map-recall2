/**
 * Speklagen (light stone bands laid through a brick front) that stop at the openings they meet.
 *
 * Why (landmarks r10-C, 2026-11-22, the former Kweekschool voor Machinisten, Plantage Muidergracht 14, A. Salm 1886-87):
 * the register reads "de horizontale geleding wordt benadrukt door zandstenen speklagen", and the panoramas
 * (TMX7316010203-002910_pano_0013_000177, TMX7316010203-002541_pano_0003_000192) show eight sandstone courses running
 * across the whole front, each broken by every window it crosses, so the stone shows as neggeblokken beside the jambs.
 * Builders drew such bands as one continuous slab, which then runs across the glass, or skipped them; Magna Plaza
 * hand-split its stripes per pier. This splits every band at the openings it crosses.
 *
 * Pure geometry in the wall frame (t along the wall from the viewer's left, y up), no three.js. Nothing changes for models
 * that do not call it.
 */
export interface BandRow {y: number; h: number}
export interface BandOpening {t0: number; t1: number; y0: number; y1: number}
export interface BandRun {t0: number; t1: number; y: number; h: number}

export interface SpeklagenOptions {
  /** The run of wall the bands cover. */
  t0: number;
  t1: number;
  bands: BandRow[];
  /** Openings (window frames, doors, arches) the bands stop at. */
  openings: BandOpening[];
  /** Clear gap kept between a band end and an opening's edge (m, default 0). */
  gap?: number;
  /** Runs shorter than this are dropped (m, default 0.1). */
  minRun?: number;
}

/**
 * The band pieces left once every opening that overlaps a band's height is cut out of it, in band order, then t order.
 * An opening only cuts a band whose [y, y + h] overlaps its (y0, y1); touching edges do not cut.
 */
export function speklagen(o: SpeklagenOptions): BandRun[] {
  if (!(o.t1 > o.t0)) throw Error('speklagen: t1 must exceed t0');
  const gap = o.gap ?? 0, minRun = o.minRun ?? 0.1;
  const out: BandRun[] = [];
  for (const band of o.bands) {
    if (!(band.h > 0)) throw Error('speklagen: band height must be positive');
    const cuts = o.openings
      .filter(p => p.y0 < band.y + band.h && p.y1 > band.y)
      .map(p => [p.t0 - gap, p.t1 + gap] as [number, number])
      .sort((a, c) => a[0] - c[0]);
    let at = o.t0;
    for (const [a, c] of cuts) {
      if (a > at && Math.min(a, o.t1) - at >= minRun) out.push({t0: at, t1: Math.min(a, o.t1), y: band.y, h: band.h});
      at = Math.max(at, c);
      if (at >= o.t1) break;
    }
    if (o.t1 - at >= minRun) out.push({t0: at, t1: o.t1, y: band.y, h: band.h});
  }
  return out;
}
