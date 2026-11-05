/** The world-v1 A/B's fixed spots (tests/e2e/world-v1-ab.spec.ts pixels, scripts/world/check-ab-spots.ts structure). */
export const AB_SPOTS = [
  { name: 'westerkerk', at: [4.8826, 52.3741], face: [4.8843, 52.3746] },
  { name: 'bloemgracht-80', at: [4.8798, 52.3752], face: [4.8809, 52.3750] },
  { name: 'nassaukade', at: [4.8722, 52.3712], face: [4.8732, 52.3722] },
  { name: 'leidsegracht-courtyard', at: [4.8868, 52.3676], face: [4.8884, 52.3686] },
  { name: 'ijburg-edge', at: [5.0185, 52.3512], face: [5.0203, 52.3521] },
] as const;

/**
 * The swap lane's spots (R1-A, #223), from the user's 2026-11-06 shots (map-recall2-screenshots
 * engine/2026-11-06-user-shots): `rider` spawns the ride, `camera` / `zoom` / `bearing` / `pitch` hold the world
 * camera, `pand` is the BAG pand number of the building the spot is about (the Weesperstraat slab, 26.8 m, every
 * chunk piece whose id holds it). Not part of AB_SPOTS (the
 * world-v1 structural gate keeps its five).
 *  - s1-hoftuin: high over the Hoftuin by the Wind phone and the Namenmonument, looking NE over Nieuwmarktbuurt
 *    (the distance pop-in, shell → detail two to five blocks out).
 *  - s3-slab: the 1962 slab on Weesperstraat (the building card "BUILT 1962") about 150 m off, the moiré while moving.
 */
export const SWAP_SPOTS = [
  { name: 's1-hoftuin', rider: [4.9049, 52.3652], face: [4.9068, 52.3668], camera: [4.9045, 52.3660], zoom: 17.4, bearing: 40, pitch: 60, pand: '0363100012185595' },
  { name: 's3-slab', rider: [4.9058, 52.3638], face: [4.9063, 52.3651], camera: [4.9058, 52.3645], zoom: 17.6, bearing: -15, pitch: 58, pand: '0363100012185595' },
] as const;
