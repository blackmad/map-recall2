/**
 * Lane R1-B (#224) spots: the user's shots (map-recall2-screenshots engine/2026-11-06-user-shots/, build 69d4c65,
 * `?ride=free&engine=own`, Mac DPR 2) and the rail-look spots (scripts/own-ground/rail-shots.mjs). `center` is the
 * view centre [lng, lat], `pitch` null = the chase pitch; `band` the facade (or rail) band the sharpness probe reads,
 * fractions of the frame. Used by tests/e2e/crisp-textures.spec.ts.
 * The archive's s2/s3 file names were swapped until map-recall2-screenshots c856dd1 (2026-11-06) and now match the plan's numbering.
 */
export type CrispSpot = { name: string; center: [number, number]; zoom: number; bearing: number; pitch: number | null; band: { x0: number; y0: number; x1: number; y1: number }; /** Centre of the strip's 1:1 crop (fractions); default the band's centre. */ crop?: { x: number; y: number }; shot?: string };

export const CRISP_SPOTS: readonly CrispSpot[] = [
  // S2: Da Costakade / Jacob van Lennepkade looking N along the Da Costagracht, from ~150 m up.
  { name: 'da-costakade', center: [4.8727, 52.3702], zoom: 17.1, bearing: -12, pitch: 70, band: { x0: 0, y0: 0.35, x1: 1, y1: 1 }, crop: { x: 0.45, y: 0.8 }, shot: 's3-weesperstraat-slab-moire.png' },
  // S2 at the chase distance: the same quay from the rider's view (windows magnified).
  { name: 'da-costakade-chase', center: [4.8738, 52.3672], zoom: 17.8, bearing: -15, pitch: null, band: { x0: 0, y0: 0.2, x1: 1, y1: 0.8 }, crop: { x: 0.3, y: 0.75 } },
  // S4: the Zuidas rail corridor between Zuid and RAI, Beatrixpark beyond, from the air looking N.
  { name: 'zuidas-rails', center: [4.8835, 52.3402], zoom: 16.7, bearing: 5, pitch: 66, band: { x0: 0, y0: 0.55, x1: 0.7, y1: 0.9 }, crop: { x: 0.35, y: 0.66 }, shot: 's4-zuidas-rails.png' },
  // S2 close: the quay from the chase camera at its nearest zoom (cells magnified: where 512 px cells can show).
  { name: 'da-costakade-near', center: [4.8738, 52.3672], zoom: 18.8, bearing: -15, pitch: null, band: { x0: 0, y0: 0.1, x1: 1, y1: 0.9 }, crop: { x: 0.3, y: 0.5 } },
  // S4 higher: under z15 the own ground is not drawn and the overview's rail lines are what shows (the user's frame).
  { name: 'zuidas-rails-high', center: [4.8835, 52.3402], zoom: 14.8, bearing: 5, pitch: 66, band: { x0: 0, y0: 0.55, x1: 0.7, y1: 0.9 }, crop: { x: 0.35, y: 0.66 }, shot: 's4-zuidas-rails.png' },
  // GPU-cost spots (lane R2-A #228, analytic windows): the world-v1 A/B's Westerkerk (scripts/world/abSpots.ts) and the
  // look spots' Dam, chase pose, whole frame.
  { name: 'westerkerk', center: [4.8826, 52.3741], zoom: 17.8, bearing: 74, pitch: null, band: { x0: 0, y0: 0, x1: 1, y1: 1 } },
  { name: 'dam', center: [4.8926, 52.3731], zoom: 17.8, bearing: 250, pitch: null, band: { x0: 0, y0: 0, x1: 1, y1: 1 } },
  // The rail-look spots (issue #145), chase pose.
  { name: 'dijksgracht', center: [4.9180, 52.3757], zoom: 17.5, bearing: 300, pitch: null, band: { x0: 0, y0: 0.3, x1: 1, y1: 1 } },
  { name: 'piet-heinkade-east', center: [4.919002, 52.376640], zoom: 17.5, bearing: 100, pitch: null, band: { x0: 0, y0: 0.3, x1: 1, y1: 1 } },
  { name: 'zeeburg-curve', center: [4.931068, 52.374300], zoom: 17.5, bearing: 90, pitch: null, band: { x0: 0, y0: 0.3, x1: 1, y1: 1 } },
  { name: 'oostertoegang', center: [4.903754, 52.376897], zoom: 17.5, bearing: 240, pitch: null, band: { x0: 0, y0: 0.3, x1: 1, y1: 1 } },
];
