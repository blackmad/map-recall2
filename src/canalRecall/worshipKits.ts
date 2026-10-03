// Landmark kits for places of worship (2026-10-03, "temples mosques and churches"), after the
// museums and cinemas.
//
// Before these, the recognisable ones drew as whatever the generic rules gave them: the
// Portuguese Synagogue a five-storey block of canal-house windows (an old landmark under 26 m
// takes the period house front), the Hofkerk a 32 m bare brick box, the Dominicuskerk two beige
// boxes. Heights come from the 3D BAG (api.3dbag.nl, LoD 2.2 roof surfaces, metres above its own
// ground), forms and openings from the Commons photographs named per kit, positions from the
// building tiles. The generic treatment for the rest is worshipBuildings.ts.

import type { Kit } from './landmarkKits.js';

const ESNOGA_BRICK = '#7a4a3a', ESNOGA_STONE = '#e6dfcf';

export const WORSHIP_KITS: Kit[] = [
  {
    // Portuguese Synagogue (Esnoga), Mr. Visserplein: Elias Bouman's 1675 brick box. Commons
    // "EsnogaAmsterdam.jpg" and "De Portuguese Synagoge te Amsterdam - Amsterdam - 20013903 -
    // RCE.jpg": dark brick walls between giant pilaster-buttresses, a lower row of tall
    // round-headed windows and an upper row of square ones, a white stone cornice and balustrade,
    // and the roof hidden behind it. The low ring of service buildings around it are separate
    // footprints. One BAG footprint (1675, 21.9 m tile height) carries the box with its 1.1 m
    // buttresses, 37 x 27.9 m on an axis of 151 degrees, and two small 8 m annexes on the east.
    // 3D BAG: roof slopes from 18.7 to 23.7 m (hipped, behind the balustrade), a few flat bits at
    // 21 m. Scaled off the RCE photo (cornice 19 m): arched windows 6.2-13.2 m, square ones
    // 14.6-17.6 m, two between each pair of buttresses; balustrade to 20.2 m.
    name: 'Portuguese Synagogue',
    wall: { plain: true, hex: ESNOGA_BRICK },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012170255', widthM: 0, anchor: [4.905322, 52.367546], eavesM: 19.2, riseM: 4.4, mat: 'slate',
      wings: [{ at: [4.905322, 52.367546], lenM: 37, widM: 27.9, bearingDeg: 151, riseM: 4.4, roof: 'hipped' }],
      windows: {
        glassHex: '#3c454d',
        rows: [
          { z0: 6.2, z1: 13.2, widthM: 2.1, bayM: 4.9, head: 'round' },
          { z0: 14.6, z1: 17.6, widthM: 1.9, bayM: 4.9, head: 'flat' },
        ],
      } }],
    // The stone cornice and balustrade round the top of the walls.
    forms: [{ on: 'NL.IMBAG.Pand.0363100012170255', z0: 18.7, z1: 20.2, outsetM: 0.35, hex: ESNOGA_STONE }],
  },
  {
    // Hofkerk (H.H. Martelaren van Gorcumkerk), Linnaeusstraat: J.T.J. Cuypers and Jan Stuyt's
    // 1927-29 brick church. Commons "Overzicht westgevel met ingangsportaal - Amsterdam - 20409083 -
    // RCE.jpg" (the west front), "H.H. Martelaren van Gorcum kerk.JPG" (the south side) and
    // "... kerk 3.JPG" (the tower): a square west tower with paired belfry arches and a narrow
    // tiled pyramid, the nave's big gable between three pointed portals, a small clock turret,
    // one sweeping glazed-tile roof over nave and aisles, a square crossing tower under a tiled
    // pyramid, and a lower transept and choir. No dome. One BAG footprint (1929, tile height
    // 32.1 m: the whole church stood as a 32 m box). 3D BAG: nave slopes 5.4-19.8 m, transept
    // 6-13.9 m, choir 8-15 m, crossing tower pyramid 22.3-29.3 m, the west tower's flat top
    // 25.7-26.1 m (ridge 32.1 m with its cap and cross), the clock turret's pyramid 11.2-16.7 m.
    name: 'Hofkerk',
    wall: { plain: true, hex: '#8f5038' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012123068', widthM: 0, anchor: [4.933645, 52.353062], eavesM: 8, riseM: 11.8, mat: 'tile', roofHex: '#9a8150',
      wings: [
        { at: [4.933645, 52.353062], lenM: 37.4, widM: 21, bearingDeg: 0, riseM: 11.8 },
        { at: [4.93399, 52.353055], lenM: 43, widM: 12, bearingDeg: 90, riseM: 5.9 },
        { at: [4.93412, 52.35306], lenM: 10, widM: 12, bearingDeg: 0, riseM: 7, roof: 'hipped' },
      ],
      towers: [
        // West tower: walls to the 26 m flat top, a narrow tiled pyramid and cross (32.1 m).
        { at: [4.933435, 52.353172], widthM: 8.5, z1: 26, capM: 4.5, capWidthM: 4.2, cap: 'tile', bearingDeg: 0 },
        // Crossing tower under its tiled pyramid (29.3 m, cross 30.9 m).
        { at: [4.93397, 52.353062], widthM: 10, z1: 21.5, capM: 7.8, cap: 'tile', bearingDeg: 0 },
        // Clock turret at the south west, turned with the angled block it stands in.
        { at: [4.933603, 52.352865], widthM: 5, z1: 11.2, capM: 5.5, cap: 'tile', bearingDeg: 44 },
      ],
      windows: {
        glassHex: '#3a434c',
        rows: [
          // The west front's three pointed portals, the middle one widest (photo: 3 m and 2.4 m).
          { z0: 0.3, z1: 5.6, widthM: 2.8, bayM: 6.2, head: 'pointed', at: [4.93337, 52.35305], count: 3 },
          // Aisle windows: small pointed lights in a row under the eaves.
          { z0: 2.6, z1: 5.8, widthM: 0.8, bayM: 2.2, head: 'pointed' },
        ],
        // Paired belfry arches near the west tower's top.
        towerRows: [{ z0: 21.4, z1: 24.6, widthM: 1.4, bayM: 1.9, head: 'round', count: 2 }],
      } }],
  },
  {
    // Gerardus Majellakerk, Amsterdam-Oost (OSM way 45037862): a 1926 central church. Commons "Gerardus Majellakerk -
    // Amsterdam - 20307934 - RCE.jpg", "2022 Gerardus Majellakerk, Asd.jpg" and "Gerardus
    // Majellakerk Amsterdam (Oostzijde).jpg": dark brown brick, a broad octagonal drum ringed with
    // round-arched windows under a steep slate cone with a gilt ball and cross, four short arms with
    // slate gable roofs, round chapels with conical caps in the angles, and a narthex with a round
    // window at the west end. One BAG footprint (tile height 41.5 m: the whole church stood as a
    // 41 m block of flats with house windows). 3D BAG: the cone's facets rise from 23-28 m to
    // 41.3 m round (4.938523, 52.359805); the arms' slopes run 13.3 to 18.8-19.8 m (long arm,
    // axis 13 degrees) and 13.3 to 19.1-21.2 m (cross arm); chapels 10.5-13.9 m, apses 8-11.4 m.
    // The footprint is 69 m along the axis and 40 m across at the drum.
    name: 'Gerardus Majellakerk',
    wall: { plain: true, hex: '#6e4a3c' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012136492', widthM: 0, anchor: [4.938523, 52.359805], eavesM: 13.3, riseM: 6, mat: 'slate',
      wings: [
        { at: [4.938523, 52.359805], lenM: 56, widM: 20, bearingDeg: 13.3, riseM: 6 },
        { at: [4.938523, 52.359805], lenM: 40, widM: 14, bearingDeg: 103.3, riseM: 6 },
      ],
      towers: [
        // The drum (24 m across, walls to 25.5 m) under its slate cone to 41.3 m.
        { at: [4.938523, 52.359805], widthM: 24, z1: 25.5, capM: 15.8, cap: 'slate', shape: 'octagon', bearingDeg: 13.3 },
      ],
      windows: {
        glassHex: '#3a434c', frameHex: '#e3dccb',
        rows: [{ z0: 4, z1: 10.5, widthM: 1.5, bayM: 4.2, head: 'round' }],
        // The narthex's round window over the west porch.
        roses: [{ at: [4.93802, 52.359705], z: 9.5, radiusM: 2 }],
      } }],
  },
  {
    // Westermoskee (Ayasofya Camii), Piri Reisplein: Marc Breitman and Nada Breitman-Jakov's 2015
    // mosque in the Ottoman manner (before this kit it stood as a glass-fronted
    // box). Commons "Westermoskee Aya Sofya (Amsterdam, The Netherlands 2017).jpg" and
    // "Westermoskee - Amsterdam (26579109769).jpg": a two-storey body of banded brown and buff
    // brick with round-headed upper windows, a chamfered square drum with a ring of arched windows,
    // a big zinc dome with a gilt finial, half-domes and a white colonnade, and one slender brick
    // minaret with two white balconies and a silver spike. One BAG footprint (2015, tile 21.5 m).
    // 3D BAG: the dome's facets reach 26.4 m round (4.86064, 52.36620); lower roofs and half-domes
    // 10.5-24 m; the minaret is the small polygon at the east corner (4.86094, 52.366252), where the
    // point cloud catches only 26.5-32.6 m of it. Its height, about 40 m, is read off the second
    // photo against the 26 m dome, not measured.
    name: 'Westermoskee',
    wall: { plain: true, hex: '#7b4636' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012241498', widthM: 0, anchor: [4.86064, 52.3662], eavesM: 10.6, riseM: 0, mat: 'lead',
      towers: [
        // The drum (22 m across, walls to 18 m) under the zinc dome to 26.4 m.
        { at: [4.86064, 52.3662], widthM: 22, z1: 18, capM: 8.4, cap: 'lead', capShape: 'dome', capHex: '#9aa3a8', shape: 'octagon', bearingDeg: -37.5 },
        // The minaret: brick shaft, two white balconies, a silver spike.
        { at: [4.86094, 52.366252], widthM: 3, z1: 34, capM: 7, cap: 'lead', capShape: 'spire', capHex: '#c9ced2', shape: 'octagon', bearingDeg: -37.5, wallHex: '#6b3a30' },
        ...[20.5, 30].map(z => ({ at: [4.86094, 52.366252] as [number, number], widthM: 4.4, z0: z, z1: z + 1.3, capM: 0.3, cap: 'white' as const, capShape: 'dome' as const, shape: 'octagon' as const, mat: 'white' as const, wallHex: '#ece8de', bearingDeg: -37.5, finial: false })),
      ],
      windows: {
        glassHex: '#3a434c', frameHex: '#ece8de',
        rows: [
          { z0: 0.6, z1: 3.6, widthM: 1.2, bayM: 3, head: 'flat' },
          { z0: 5.2, z1: 8.6, widthM: 1.3, bayM: 3, head: 'round' },
        ],
      } }],
  },
  {
    // Dominicuskerk (Sint-Dominicus), Spuistraat 12: P.J.H. Cuypers' 1884-86 neo-Gothic basilica
    // (it stood as two beige boxes, 28 and 15 m). Commons "Overzicht van de zuidgevel in de
    // spuistraat - Amsterdam - 20424399 - RCE.jpg" and "WLM - andrevanb - amsterdam, dominicuskerk
    // (1).jpg": grey-brown brick with buff bands, tall pointed traceried windows in the aisles and
    // the clerestory, balustrades and pinnacles along both, a steep roof behind, and at the front
    // corner a slender stair turret with an octagonal belfry and a slate spire. OSM maps the nave
    // (w749287654, 28 m), the whole church as the aisles' part (w749287651, 15 m) and the turret
    // (w749287652). 3D BAG (pand 0363100012171033): nave roof 20.5-25.6 m, aisle roofs 10.4-12.7
    // m, the turret's belfry top flat at 28.5 m; the spire above it (8 m) is scaled off the photo.
    name: 'Dominicuskerk',
    wall: { plain: true, hex: '#6f5e52' },
    tiers: [{ id: 'w749287652', shape: 'octagon', mat: 'brick', z1: 28.5 }],
    stacks: [{ onId: 'w749287652', startZ: 28.5, stages: [
      { shape: 'octagon', w0: 5.4, w1: 5.4, h: 0.5, mat: 'stone' },
      { shape: 'octagon', w0: 4.4, w1: 0.3, h: 8, mat: 'slate' },
      { shape: 'octagon', w0: 0.4, w1: 0, h: 1.4, mat: 'gold' },
    ] }],
    roofs: [],
    halls: [
      { id: 'w749287654', widthM: 0, anchor: [4.893274, 52.376958], fit: true, eavesM: 20.6, riseM: 5, mat: 'slate',
        windows: { glassHex: '#3a434c', frameHex: '#cbb98f', rows: [{ z0: 13, z1: 19.4, widthM: 1.6, bayM: 5, head: 'pointed' }] } },
      { id: 'w749287651', widthM: 0, anchor: [4.893274, 52.376958], fit: true, eavesM: 10.4, riseM: 2.3, mat: 'slate',
        windows: { glassHex: '#3a434c', frameHex: '#cbb98f', rows: [{ z0: 2.8, z1: 9.4, widthM: 1.8, bayM: 5, head: 'pointed' }] } },
    ],
  },
];
