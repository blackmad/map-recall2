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
 *    This pose looks down from ~650 m: it is not the user's (lane R3-A, #230).
 *  - s3-slab-user (lane R3-A, #230): the user's own S3 pose, fitted to the shot. The shot is the top-left 1185 × 501 CSS px
 *    of a 1448 × 657 CSS px window at DPR 2 (the minimap's arc fixes the window's left and bottom edges, the centred
 *    building card its width), and the slab's south-face corners, its far roof corner, the Namenmonument and the Wind
 *    phone fix the eye: 39 m up, 146 m from the slab's south (window-grid) face, looking -16.8° at pitch 74.7°
 *    (least-squares fit, ≈ 10 device px on the slab corners). `eye` + `bearing` + `pitch` + `viewport` hold it;
 *    `camera`/`zoom` are the same pose's look-at centre and zoom at that viewport (the zoom depends on the viewport's
 *    height). `crop` is the shot's rectangle in that window (CSS px). The slab covers 2.2 % of that frame at DPR 2
 *    (84,165 px, swap-zfight's eroded mask; `minMaskShare` asserts 1.5 %): the brief's "10 %, the right half" does not
 *    hold at the user's distance. On main the 1995 block 0363100012165761, which wraps the slab's south end, stands
 *    in front of the slab's south face; in the user's frame it is absent and that face is the window grid they saw.
 *  - westerkerk, nassaukade (lane R3-A): the world-v1 A/B spots at the chase pose (pitch null), whole-frame alias counts.
 */
export const SWAP_SPOTS = [
  { name: 's1-hoftuin', rider: [4.9049, 52.3652], face: [4.9068, 52.3668], camera: [4.9045, 52.3660], zoom: 17.4, bearing: 40, pitch: 60, pand: '0363100012185595' },
  { name: 's3-slab', rider: [4.9058, 52.3638], face: [4.9063, 52.3651], camera: [4.9058, 52.3645], zoom: 17.6, bearing: -15, pitch: 58, pand: '0363100012185595' },
  { name: 's3-slab-user', rider: [4.9058, 52.3638], face: [4.9063, 52.3651], eye: [4.906907, 52.362617, 39], camera: [4.906301, 52.363845], zoom: 18.28, bearing: -16.8, pitch: 74.7, viewport: [1448, 657], crop: { x: 193, y: 0, width: 1185, height: 501 }, minMaskShare: 0.015, pand: '0363100012185595' },
  { name: 'westerkerk', rider: [4.8826, 52.3741], face: [4.8843, 52.3746], camera: [4.8826, 52.3741], zoom: 17.8, bearing: 74, pitch: null },
  { name: 'nassaukade', rider: [4.8722, 52.3712], face: [4.8732, 52.3722], camera: [4.8722, 52.3712], zoom: 17.8, bearing: 31, pitch: null },
] as const;
