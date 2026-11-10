/**
 * Wall vs trim (lane H2c, docs/house-line.md §2 "Wall vs trim").
 *
 * `measureFacade` clusters the upper storeys in CIELAB (k = 4) and takes as the wall the cluster that is enriched in the
 * floor zones, large and connected. On a dark front with white bands, window surrounds and a cornice (the Nassaukade
 * 164843 render: brown wall `#3d2722`, white trim) the dark wall is depleted in the floor zones against the pale bands
 * (enrichment 0.83 < 0.9), so the white band cluster, enriched 2x and "connected" along the cornice, was taken as the
 * wall (`#b0a99a`) and the real wall counted as glazing (glazing 0.95 against 0.69).
 *
 * The wall is the dominant colour by area outside the openings; thin bright bands (cornices, sills, frames, speklagen)
 * are trim. This function reads the cluster statistics `measureFacade` already has and says whether the picked wall
 * cluster is such a band and, if so, which cluster is the wall. White still wins when it is the dominant area (a
 * plastered front): the rule only fires when a darker, solid, non-glass cluster has at least the band's share.
 * Pure, no I/O.
 */
import type {Rgb} from './measureFacade.ts';

export const WALL_VS_TRIM = {
  /** a band is lighter than this (L*) */
  minBandL: 45,
  /** a band is thin: under this share of its cells have all 8 neighbours in it (`solid`); a material body is >= 0.35 */
  maxBandSolid: 0.35,
  /** the wall candidate is at least this much darker than the band (L*) */
  minDarker: 20,
  /** the wall candidate holds at least this share of the clustered cells, and at least `areaRatio` x the band's */
  minShare: 0.15,
  areaRatio: 1,
  /** trim is near-white or neutral: chroma under this (a thin orange or coloured cluster is not painted trim) */
  maxBandChroma: 12,
  /** the wall candidate is warm (brick, painted brown: a + b > 12, b > 4, as `warm` in measureFacade): a dark neutral cluster beside pale panels is glass, not wall (Zuidoost, Schaafstraat 17) */
  minWarm: 12,
  minWarmB: 4,
  /** the candidate is a solid body, not an edge ring */
  minSolid: 0.35,
  /** clusters within this Lab distance of the candidate are the same wall (the tones of one brick, its shade) */
  sameWall: 12,
} as const;

export interface ClusterStat {lab: Rgb; share: number; solid: number; glassy: boolean}

/**
 * `wallSet` are the clusters `measureFacade` reads as wall (bands and mortar included) and `wallC` the one it picked.
 * Returns null when they stand. Else: the pale thin clusters in `wallSet` are trim and leave it, the darker solid
 * cluster that outweighs them (and the tones within `sameWall` of it) joins it, and `wallC` is that cluster when the
 * band had been picked.
 */
export function wallVsTrim(clusters: readonly ClusterStat[], wallSet: readonly boolean[], wallC: number): {wallC: number; wallSet: boolean[]} | null {
  const K = WALL_VS_TRIM;
  const isBand = (i: number) => wallSet[i] && clusters[i].lab[0] >= K.minBandL && Math.hypot(clusters[i].lab[1], clusters[i].lab[2]) < K.maxBandChroma && clusters[i].solid < K.maxBandSolid;
  const bands = clusters.map((_, i) => i).filter(isBand);
  if (!bands.length) return null;
  const bandShare = Math.max(...bands.map(i => clusters[i].share)), bandL = Math.min(...bands.map(i => clusters[i].lab[0]));
  let best = -1;
  clusters.forEach((c, i) => {
    if (wallSet[i] || c.glassy || c.share < K.minShare || c.share < bandShare * K.areaRatio || c.solid < K.minSolid || c.lab[1] + c.lab[2] <= K.minWarm || c.lab[2] <= K.minWarmB || bandL - c.lab[0] < K.minDarker) return;
    if (best < 0 || c.share > clusters[best].share) best = i;
  });
  if (best < 0) return null;
  const dE = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const ws = wallSet.map((w, i) => !isBand(i) && (w || i === best || (!clusters[i].glassy && dE(clusters[i].lab, clusters[best].lab) < K.sameWall)));
  return {wallC: isBand(wallC) ? best : wallC, wallSet: ws};
}
