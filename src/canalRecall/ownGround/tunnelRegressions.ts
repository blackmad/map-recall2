// Named tunnel sites (tunnels.ts): the user's IJ-tunnel report of 2026-10-30 and the tunnel lane's survey of the same
// day. Checked offline by scripts/own-ground/check-tunnels.ts; shot in the game by scripts/tunnel-places-shots.mjs.
//
// Each site probes one point ([lng, lat]) and says what the ground must do there.

export type LngLat = [number, number];

export interface TunnelSite {
  id: string;
  label: string;
  at: LngLat;
  expect: {
    /** The cut that must hold the probe point (absent: no cut may hold it). */
    kind?: 'ramp' | 'slot';
    /** That cut is a motor road's (portal mouths, closed to bikes). */
    motor?: boolean;
    /** Its wall at the probe stands at least this high above the floor, metres. */
    minWallM?: number;
    /** Its floor lies at least this far under the measured relief there (a slot through an embankment), metres. */
    floorBelowReliefM?: number;
    /** A portal stands within 20 m of this point. */
    portalNear?: LngLat;
    /** The ground over the tunnel stays the measured relief here (quay, water side, park, plaza). */
    groundIntact?: LngLat[];
    /** The riding height along this polyline (the routed way through, run on 10 m past each end) climbs at most this over its higher end, metres. */
    rideMaxClimbM?: number;
    ride?: LngLat[];
    /** The ground here (a median between carriageways merged into one trench) lies on the cut floor within 0.3 m. */
    groundAtFloor?: LngLat[];
  };
}

export const TUNNEL_SITES: readonly TunnelSite[] = [
  {
    id: 'ij-tunnel-south-ramp',
    label: 'IJ-tunnel south ramp from Prins Hendrikkade / Foeliestraat up to the portal under NEMO (user report 2026-10-30: read as a street to ride)',
    at: [4.91165, 52.37250],
    expect: { kind: 'ramp', motor: true, minWallM: 1, portalNear: [4.91235, 52.37360], groundIntact: [[4.91240, 52.37400], [4.91225, 52.37440]] },
  },
  {
    id: 'ij-tunnel-median-wedge',
    label: 'IJ-tunnel south ramp: the median wedge between the inner carriageways lies in the trench (round 2, 2026-10-30: drew a ridge at the wall top)',
    at: [4.91166, 52.37264],
    expect: { groundAtFloor: [[4.91166, 52.37264], [4.91162, 52.37265]] },
  },
  {
    id: 'westerpark-path-rail-embankment',
    label: 'Westerpark: path at the foot of the rail embankment west of the cycle underpass (one-sided "wall": no cut)',
    at: [4.86400, 52.38940],
    expect: {},
  },
  {
    id: 'westerpark-path-dike',
    label: 'Westerpark: park path beside the bank, 200-500 m from the underpass (way 61848368: no cut)',
    at: [4.86182, 52.38594],
    expect: {},
  },
  {
    id: 'westerpark-path-east',
    label: 'Westerpark: path along the embankment east of the underpass (way 290027474: no cut)',
    at: [4.86622, 52.38885],
    expect: {},
  },
  {
    id: 'piet-heintunnel-west',
    label: 'Piet Heintunnel west ramp at the Piet Heinkade',
    at: [4.93565, 52.37266],
    expect: { kind: 'ramp', motor: true, minWallM: 1, portalNear: [4.93641, 52.37260] },
  },
  {
    id: 'spaarndammertunnel-west',
    label: 'Spaarndammertunnel west ramp',
    at: [4.87445, 52.39304],
    expect: { kind: 'ramp', motor: true, minWallM: 1, portalNear: [4.87517, 52.39302] },
  },
  {
    id: 'michiel-de-ruijtertunnel-west',
    label: 'Michiel de Ruijtertunnel, west ramp on the IJ side of Centraal',
    at: [4.89811, 52.38060],
    expect: { kind: 'ramp', motor: true, minWallM: 1 },
  },
  {
    id: 'molukkenstraat-cycle-underpass',
    label: 'Molukkenstraat cycle underpass under the rail embankment (way 553770152)',
    at: [4.94032, 52.35678],
    expect: { kind: 'slot', floorBelowReliefM: 3, rideMaxClimbM: 0.5, ride: [[4.940098, 52.356571], [4.940553, 52.356983]] },
  },
  {
    id: 'wibautstraat-cycle-underpass',
    label: 'Wibautstraat cycle tunnel under the railway (way 174300938)',
    at: [4.91446, 52.35107],
    expect: { kind: 'slot', floorBelowReliefM: 2, rideMaxClimbM: 0.5, ride: [[4.914016, 52.351336], [4.914912, 52.350814]] },
  },
  {
    id: 'overschiestraat-underpass',
    label: 'Overschiestraat under the rail embankment (tertiary, way 7381205)',
    at: [4.84100, 52.34335],
    expect: { kind: 'slot', floorBelowReliefM: 2, rideMaxClimbM: 0.5, ride: [[4.840462, 52.343347], [4.84153, 52.343354]] },
  },
  {
    id: 'cycleway-168978409',
    label: 'Cycle tunnel under the rail embankment by the Postjesweg (way 168978409)',
    at: [4.84316, 52.37219],
    expect: { kind: 'slot', floorBelowReliefM: 2, rideMaxClimbM: 0.5, ride: [[4.843142, 52.371923], [4.843171, 52.372459]] },
  },
  {
    id: 'cuyperspassage',
    label: 'Cuyperspassage cycle tunnel under Centraal (way 313016874)',
    at: [4.89850, 52.37960],
    expect: { kind: 'slot', floorBelowReliefM: 2, rideMaxClimbM: 0.5, ride: [[4.898142, 52.379251], [4.899005, 52.380124]] },
  },
  {
    id: 'mauritskade-underpass',
    label: 'Mauritskade underpass (primary, way 26716654)',
    at: [4.90772, 52.35990],
    expect: { kind: 'ramp', motor: true, minWallM: 1, portalNear: [4.90823, 52.36015] },
  },
];
