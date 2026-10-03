// Landmark kits for museums and cinemas (2026-10-03, "work on museums, movie theaters").
//
// Before these, the recognisable ones drew as boxes: the Van Gogh Museum a beige block and a
// windowed oval, the Stedelijk one red tiled roof over its old building and the 2012 wing alike,
// Eye a beige slab, Tuschinski a canal-house front at 22 m, the Maritime Museum and H'ART (the
// Amstelhof) one pitched or flat roof over their whole courtyard blocks.
//
// Heights come from the 3D BAG (api.3dbag.nl, LoD 2.2 roof surfaces from AHN point clouds,
// metres above its own ground level), which is what the tiles' BAG heights are cut from (they
// carry the 70th percentile). Forms come from Commons photographs named per kit; footprint
// positions from the building tiles. Colours are read off those photographs.

import type { Kit } from './landmarkKits.js';

const VGM_STONE = '#c3bcae', NEMO_COPPER = '#4f9a82', STEDELIJK_WHITE = '#efeee9', EYE_WHITE = '#f1f1ee', GLASS = '#5d6c74';

export const MUSEUM_KITS: Kit[] = [
  {
    // Van Gogh Museum, Rietveld building (1973): light grey stone blocks on a glazed ground floor,
    // the black-framed glass stair tower towards Museumplein and a green glass block beside it
    // (Commons "Van Gogh Museum Amsterdam.jpg", "Van Gogh Museum, Kurokawa wing.jpg"). OSM's
    // part heights sit about 3 m under the 3D BAG roofs (main block 21 m, stair tower 24 m, green
    // block 19.5 m above the street; its ground there is the sunken court, 2.4 m lower), so the
    // three tall parts are drawn at the measured heights and the low wings keep their own.
    //
    // Kurokawa wing (1999): an ellipse cut in half. The southern half is the exhibition drum, a
    // granite wall under a titanium roof whose brim tilts up to the south (3D BAG: roof 12 m at
    // the cut, 15 m at the rim); the northern half, once the sunken court, is the 2015 glass
    // entrance hall (roof 4-10 m).
    name: 'Van Gogh Museum',
    wall: { plain: true, hex: VGM_STONE, flat: true },
    tiers: [], stacks: [], roofs: [],
    body: ['w754324679', 'w754324680', 'w754324681', 'w754324682'],
    hides: ['w754324683', 'w754324684', 'w754324685', 'w1230401241', 'w1230401242'],
    forms: [
      { on: 'w754324684', z0: 0, z1: 21, hex: VGM_STONE },
      { on: 'w754324685', z0: 0, z1: 24, hex: '#40464c' },
      { on: 'w754324683', z0: 0, z1: 19.5, hex: '#7d9a92' },
      // The drum and its brim, both tilted up to the south (the cut runs at 22 degrees).
      { on: 'w1230401242', z0: 0, z1: 12, z1High: 14.2, highBearingDeg: -68, hex: '#a9a8a2' },
      { on: 'w1230401242', z0: 11.4, z1: 12.2, z1High: 14.9, highBearingDeg: -68, outsetM: 1.4, hex: '#cdd1d5', tiltBottom: true },
      { on: 'w1230401241', z0: 0, z1: 5, z1High: 9.5, highBearingDeg: 112, hex: '#8ea7b1' },
    ],
  },
  {
    // Stedelijk Museum: A.W. Weissman's 1895 building in red brick with stone bands, steep slate
    // roofs, four corner pavilions with pointed roofs and the front tower with its lantern
    // (Commons "Amsterdam - Paulus Potterstraat 13 Stedelijk.JPG"). OSM stops the walls at 14 m;
    // 3D BAG has the roofs climbing from 16 to 25 m and the tower lantern at 31 m.
    //
    // The 2012 Benthem Crouwel wing ("de badkuip", Commons "Amsterdam - Stedelijk Museum -
    // Benthem Crouwel Wing 2012 - ICE Perspective.jpg", "Stedelijk Museum Amsterdam 2017.jpg"):
    // a smooth white tub lifted on a glass ground floor, under a thin flat roof that runs out as a
    // canopy over the Museumplein entrance. OSM maps the tub (w754299890, 92 x 19 m) inside the
    // canopy's outline (w754299892, 100 x 41 m); 3D BAG puts the roof at 17.6 m. Behind the tub,
    // up to the old building, a 15 m block.
    name: 'Stedelijk',
    wall: { plain: false, style: 'school', hex: '#a0503c' },
    tiers: [
      { id: 'w754299889', shape: 'square', mat: 'brick', z1: 21 },
      ...['w754299894', 'w754299895', 'w754299896', 'w754299897'].map(id => ({ id, shape: 'square' as const, mat: 'brick' as const, z1: 14 })),
    ],
    stacks: [
      { onId: 'w754299889', startZ: 21, stages: [
        { shape: 'square', w0: 14.2, w1: 14.2, h: 0.8, mat: 'stone' },
        { shape: 'square', w0: 13.6, w1: 3.2, h: 4.6, mat: 'slate' },
        { shape: 'octagon', w0: 2.8, w1: 2.6, h: 1.8, mat: 'white' },
        { shape: 'octagon', w0: 2.8, w1: 0, h: 1.9, mat: 'lead' },
      ] },
      ...['w754299894', 'w754299895', 'w754299896', 'w754299897'].map(onId => ({ onId, startZ: 14, stages: [
        { shape: 'square' as const, w0: 11.8, w1: 11.8, h: 0.6, mat: 'stone' as const },
        { shape: 'square' as const, w0: 11.4, w1: 0.8, h: 8.4, mat: 'slate' as const },
        { shape: 'octagon' as const, w0: 0.6, w1: 0, h: 1, mat: 'gold' as const },
      ] })),
    ],
    roofs: [],
    halls: [
      { id: 'w754299893', widthM: 0, anchor: [4.879729, 52.35806], eavesM: 14, riseM: 9, mat: 'slate',
        wings: [{ at: [4.879729, 52.35806], lenM: 95.5, widM: 33.7, bearingDeg: 23.5, riseM: 9, roof: 'hipped' }] },
      { id: 'w754299898', widthM: 0, anchor: [4.879741, 52.358045], eavesM: 14, riseM: 9, mat: 'slate',
        wings: [{ at: [4.879741, 52.358045], lenM: 50, widM: 30.4, bearingDeg: 113.5, riseM: 9, roof: 'hipped' }] },
    ],
    body: ['w754299888'],
    hides: ['w754299890', 'w754299892'],
    forms: [
      // Glass ground floor, the white tub on it, the block behind it, and the canopy over all.
      { on: 'w754299890', z0: 0, z1: 4.6, outsetM: -0.8, hex: GLASS },
      { on: 'w754299890', z0: 4.6, z1: 16.8, hex: STEDELIJK_WHITE },
      { on: 'w754299892', z0: 0, z1: 15, hex: '#d9d6cf', half: { through: [4.879802, 52.357814], keepBearingDeg: 113.7 } },
      { on: 'w754299892', z0: 16.8, z1: 17.6, hex: STEDELIJK_WHITE },
    ],
  },
  {
    // Eye Filmmuseum (Delugan Meissl, 2012): a white faceted wedge that climbs from the west to a
    // flat-topped prow over the IJ, over a long glazed band (Commons "Amsterdam Eye filmmuseum at
    // the IJ - panoramio.jpg"). 3D BAG: the prow's roof 24.5 m, the western facets 3-19 m.
    name: 'Eye Filmmuseum',
    tiers: [], stacks: [], roofs: [],
    hides: ['NL.IMBAG.Pand.0363100012237838'],
    forms: [
      { on: 'NL.IMBAG.Pand.0363100012237838', z0: 0, z1: 4.2, outsetM: -2, hex: GLASS },
      { on: 'NL.IMBAG.Pand.0363100012237838', z0: 4.2, z1: 5, z1High: 21, highBearingDeg: 0, hex: EYE_WHITE, half: { through: [4.90123, 52.38428], keepBearingDeg: 180 } },
      { on: 'NL.IMBAG.Pand.0363100012237838', z0: 4.2, z1: 24.5, hex: EYE_WHITE, half: { through: [4.90123, 52.38428], keepBearingDeg: 0 } },
    ],
  },
  {
    // NEMO's roof (Renzo Piano, 1997): the copper-green ship's deck is a public square that climbs
    // north from the Oosterdok end towards the prow over the IJ tunnel (3D BAG: the hall's roof
    // rises 12-22 m, the prow's 24-31.5 m). OSM gives the hall and its side strips one flat height
    // each, so the deck stood as a flat box between 24 m fins; these forms tilt them. The walls
    // keep the NEMO kit's patinated copper.
    name: 'NEMO deck',
    tiers: [], stacks: [], roofs: [],
    hides: ['w1390692772', 'w1390692771', 'w1390692768', 'w1390692765'],
    forms: [
      { on: 'w1390692772', z0: 0, z1: 12, z1High: 22, highBearingDeg: 90, hex: NEMO_COPPER },
      { on: 'w1390692771', z0: 0, z1: 13, z1High: 23.7, highBearingDeg: 90, hex: NEMO_COPPER },
      { on: 'w1390692768', z0: 0, z1: 13, z1High: 23.8, highBearingDeg: 90, hex: NEMO_COPPER },
      { on: 'w1390692765', z0: 0, z1: 24, z1High: 31.5, highBearingDeg: 90, hex: NEMO_COPPER },
    ],
  },
  {
    // Pathé Tuschinski (Hijman Louis de Jong, 1921): a grey-brown glazed-stone front between two
    // square towers, each under a green copper dome with a lantern (Commons "Tuschinski
    // front.jpg", "Amsterdam - Reguliersbreestraat - View West on Tuschinski Theatre 1921.jpg").
    // One BAG footprint: 3D BAG puts the flat roofs at 19 m, the auditorium and foyer roofs at
    // 22 m, the stage house at the back at 25 m, and the domes from 23.5 m to their lanterns at
    // 33.5 m (the west tower; the east one reads 38 m, its finial). The towers stand inside the
    // corners of the 14.6 m street front.
    name: 'Tuschinski',
    wall: { plain: true, hex: '#6d665e' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012168188', widthM: 0, anchor: [4.894841, 52.366302], eavesM: 19, riseM: 3, mat: 'slate',
      wings: [
        { at: [4.894505, 52.366213], lenM: 30, widM: 26, bearingDeg: 63.4, riseM: 3, roof: 'hipped' },
        { at: [4.894657, 52.36646], lenM: 16, widM: 14, bearingDeg: 63.4, riseM: 3, roof: 'hipped' },
      ],
      towers: [
        // The street front (landmarkFrontData.ts TUSCHINSKI) draws the towers and their stepped
        // crowns to 28.4 m; the domes rise out of those crowns, 1.2 m behind the front's face.
        { at: [4.894772, 52.3665], widthM: 3, z1: 26.8, capM: 5.1, cap: 'copper', capShape: 'dome', capHex: '#4f8a76', bearingDeg: 63.4 },
        { at: [4.894643, 52.366536], widthM: 3, z1: 26.8, capM: 5.1, cap: 'copper', capShape: 'dome', capHex: '#4f8a76', bearingDeg: 63.4 },
        // The stage house across the back.
        { at: [4.894405, 52.366062], widthM: 26, lenM: 10, z1: 24.2, capM: 0.8, cap: 'slate', capShape: 'slant', highBearingDeg: 153.4, bearingDeg: 153.4 },
      ] }],
  },
  {
    // Het Scheepvaartmuseum, 's Lands Zeemagazijn (Daniel Stalpaert, 1656): a square block of pale
    // sandstone round a courtyard, rows of windows, hipped slate roofs with dormers on all four
    // wings (Commons "Het Scheepvaartmuseum, Amsterdam.jpg"). 3D BAG: eaves 17 m, ridges 22.8 m.
    // The courtyard (OSM w269078550, a 9 m box) is roofed in glass at the eaves since 2011.
    name: 'Scheepvaartmuseum',
    wall: { plain: false, style: 'canal', hex: '#d8d2c2' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'r3604837', widthM: 0, anchor: [4.914188, 52.371798], eavesM: 17, riseM: 5.8, mat: 'slate',
      wings: [
        { at: [4.91467, 52.371864], lenM: 64.7, widM: 17.9, bearingDeg: 28.1, riseM: 5.8, roof: 'hipped' },
        { at: [4.914969, 52.37152], lenM: 64.7, widM: 10.4, bearingDeg: 28.1, riseM: 5.8, roof: 'hipped' },
        { at: [4.914502, 52.371607], lenM: 57.3, widM: 17.8, bearingDeg: 118.1, riseM: 5.8, roof: 'hipped' },
        { at: [4.91511, 52.371807], lenM: 57.3, widM: 17.9, bearingDeg: 118.1, riseM: 5.8, roof: 'hipped' },
        // The pedimented centre bay on each side (the footprint's 2.6-3.1 m projections): a gable
        // facing out of the main roof.
        { at: [4.914627, 52.371911], lenM: 12.2, widM: 15.2, bearingDeg: 118.1, riseM: 4.5 },
        { at: [4.914981, 52.371504], lenM: 12.2, widM: 17.1, bearingDeg: 118.1, riseM: 4.5 },
        { at: [4.914433, 52.371583], lenM: 12.2, widM: 12.6, bearingDeg: 28.1, riseM: 4.5 },
        { at: [4.915182, 52.371828], lenM: 12.2, widM: 12.5, bearingDeg: 28.1, riseM: 4.5 },
      ] }],
    hides: ['w269078550'],
    forms: [{ on: 'w269078550', z0: 16.6, z1: 17.4, hex: '#9fb3bc' }],
  },
  {
    // H'ART Museum, the Amstelhof (1683): a severe dark brown brick block of three storeys round a
    // large courtyard, its 102 m front on the Amstel, steep slate hipped roofs with chimneys
    // (Commons "Amsterdam Amstelhof seen from Blauwbrug.jpg"). 3D BAG: eaves 10 m, roofs to 14.5 m.
    // The Amstel and back wings are 9.3 m deep, the north and south wings 23 m (two piles), and a
    // lower 8 m annex stands on the east side.
    name: "H'ART Museum",
    wall: { plain: false, style: 'canal', hex: '#6e4535' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012165553', widthM: 0, anchor: [4.902126, 52.365736], eavesM: 10, riseM: 4.5, mat: 'slate',
      wings: [
        { at: [4.902414, 52.365307], lenM: 102.1, widM: 9.3, bearingDeg: 107.2, riseM: 4.5, roof: 'hipped' },
        { at: [4.90325, 52.365466], lenM: 102.1, widM: 9.3, bearingDeg: 107.2, riseM: 4.5, roof: 'hipped' },
        { at: [4.90266, 52.365729], lenM: 68.8, widM: 22.9, bearingDeg: 17.2, riseM: 4.5, roof: 'hipped' },
        { at: [4.903004, 52.365044], lenM: 68.8, widM: 22.8, bearingDeg: 17.2, riseM: 4.5, roof: 'hipped' },
        { at: [4.903374, 52.365489], lenM: 38.8, widM: 8.1, bearingDeg: 107.2, riseM: 3, roof: 'hipped' },
      ] }],
  },
];
