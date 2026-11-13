// Named building fronts the ground must not bury (lane F4, feedback 2026-11-13 on build bc4ad8a). At the Kinkerbrug
// approach Postjesweg runs ~2.5 m over the yards of its blocks (relief, ground-height-v1); under the lowest-relief rule
// (placement.ts footprintBase) the pavement stood up to 2.7 m over these fronts, the ground floor and the first-floor
// sills under the street. Het Sieraad (Postjesweg 1, note d1d82d2d) is drawn by its landmark model (het-sieraad.glb,
// signature landmarks: one translation, pointBase at its anchor), not by this rule: it is not pinned here. scripts/own-ground/audit-building-fronts.ts --check pins each: under frontBase less than
// 2 m of open wall with the relief more than 0.3 m over the base, and no point more than 0.5 m over it.

export interface FrontSpot {
  id: string;
  /** What the user saw (feedback note). */
  what: string;
  /** BAG pand id (building-tiles `id` without the NL.IMBAG.Pand. prefix). */
  pand: string;
  /** The note's pose (context.mapCenter). */
  lng: number; lat: number;
  /** Feedback note id prefix(es). */
  note: string;
}

export const FRONT_SPOTS: readonly FrontSpot[] = [
  { id: 'postjesweg-north-block', what: 'raised pavement covers the ground floor of the block across Postjesweg from Het Sieraad: 1.98 m', pand: '0363100012098127', lng: 4.859546, lat: 52.364629, note: 'b19fe125' },
  { id: 'postjesweg-north-row-west', what: 'brick row whose first floors are cut by the raised pavement, west of the block: 1.83 m', pand: '0363100012125509', lng: 4.858864, lat: 52.364911, note: '8bdee44c' },
  { id: 'postjesweg-north-row-west-2', what: 'the same row, next house east: 1.79 m', pand: '0363100012130924', lng: 4.858864, lat: 52.364911, note: '8bdee44c' },
  { id: 'kinkerstraat-east-corner', what: 'the corner across the Kinkerbrug (Kinkerstraat side): 1.56 m', pand: '0363100012071767', lng: 4.859546, lat: 52.364629, note: 'b19fe125' },
];
