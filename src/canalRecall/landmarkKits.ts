// Landmark kits: low-poly towers, spires, domes and roofs for the buildings
// people recognise on sight.
//
// OSM already models these buildings as stacked parts (the Westerkerk tower is
// five prisms from 40 m to 82 m), so the heights are right and the *shape* is
// what is missing: every part is a square prism with a flat lid. A kit says, per
// OSM part id, what that part really is (a square or octagonal stage, in what
// material), what to stack on top (a lantern, a spire, a dome, a crown) and which
// parts carry a pitched roof. Everything is generated from the part's own
// footprint, so position, orientation and size stay as accurate as the data.
//
// Dimensions come from memory and are good to a few metres: the tower heights,
// the number of stages, the silhouette. They are not surveys. The licence is
// clean, since nothing here is copied from a model or a photograph.

import { fitRect, roofTriangles, type Rect, type RoofPlan } from './roofMesh.js';

export type Mat = 'brick' | 'stone' | 'lead' | 'gold' | 'copper' | 'slate' | 'white' | 'tile' | 'blue';
export type StageShape = 'square' | 'octagon';

/** A part's own stage: the OSM footprint between its minHeight and height (or an override). */
export type Tier = { id: string; shape: StageShape; mat: Mat; z0?: number; z1?: number; /** Gilt clock faces on the four sides. */ clocks?: boolean; /** A ring of slim columns around the drum. */ columns?: number };
/** A frustum stacked on a part: widths are full widths in metres, 0 at an apex. */
export type Stage = { shape: StageShape; w0: number; w1: number; h: number; mat: Mat };
export type Stack = { onId: string; startZ?: number; stages: Stage[] };
export type KitRoof = { id: string; riseM: number; mat: 'slate' | 'tile' | 'lead' };
/** How a kit's roofed parts are walled: bare brick or stone, or a window grid in a facade style. */
/** `flat`: one flat colour with no wall texture at all (patinated copper, glass, render). */
export type KitWall = { plain: true; hex: string; flat?: boolean } | { plain: false; style: 'canal' | 'school'; hex: string };
/** `hides`: further parts the kit's own geometry replaces (a dome's OSM bands under a modelled dome). */
/** `body`: the landmark's remaining parts, walled in the kit's own style instead of a generic facade. */
/**
 * A row of parallel halls under one footprint (a tram depot, a market): the footprint is cut
 * into strips `widthM` wide across the axis of its longest wall, starting from `anchor`
 * ([lng, lat], a corner where two halls meet), and each strip's stretch of the footprint gets
 * its own pitched roof with gable ends, ridge along the axis, eaves at `eavesM`.
 */
export type KitHalls = { id: string; widthM: number; anchor: [number, number]; eavesM: number; riseM: number; mat: 'slate' | 'tile' | 'lead'; towers?: KitTower[] };
/**
 * A square tower standing on a hall host's footprint at `at` ([lng, lat], its centre), walled
 * in the kit's own brick up to `z1`, with a stone cornice and a pyramid cap `capM` tall. For a
 * church whose towers are not separate OSM parts (one BAG footprint for the whole building).
 */
export type KitTower = { at: [number, number]; widthM: number; z1: number; capM: number; cap: 'slate' | 'lead' };
export type Kit = { name: string; tiers: Tier[]; stacks: Stack[]; roofs: KitRoof[]; halls?: KitHalls[]; wall?: KitWall; hides?: string[]; body?: string[] };

export const MAT_HEX: Record<Mat, string> = {
  brick: '#9a5240', blue: '#3f5f9a', stone: '#cfc2a6', lead: '#4d535c', gold: '#d9b24c', copper: '#6aa896', slate: '#4a525d', white: '#efe9db', tile: '#b5543a',
};

/** The imperial crown on the Westerkerk (a Maximilian crown), as a few gilded stages. */
const CROWN: Stage[] = [
  { shape: 'octagon', w0: 5.0, w1: 4.5, h: 1.2, mat: 'gold' },
  { shape: 'octagon', w0: 4.5, w1: 4.5, h: 1.1, mat: 'blue' },
  { shape: 'octagon', w0: 4.5, w1: 2.0, h: 2.4, mat: 'gold' },
  { shape: 'octagon', w0: 1.6, w1: 1.6, h: 1.0, mat: 'gold' },
  { shape: 'octagon', w0: 0.9, w1: 0, h: 1.8, mat: 'gold' },
];

export const KITS: Kit[] = [
  {
    // Tower 87 m: brick base, stone clock stage, octagonal stone and lead stages, lantern, crown.
    name: 'Westerkerk',
    wall: { plain: true, hex: '#8a4b38' },
    tiers: [
      { id: 'w751083599', shape: 'square', mat: 'brick' },
      { id: 'w751083598', shape: 'square', mat: 'stone', clocks: true },
      { id: 'w751083596', shape: 'octagon', mat: 'stone' },
      { id: 'w751083597', shape: 'octagon', mat: 'lead' },
      { id: 'w751083595', shape: 'octagon', mat: 'lead' },
    ],
    stacks: [{ onId: 'w751083595', stages: CROWN }],
    roofs: [
      { id: 'w749268118', riseM: 8, mat: 'slate' }, { id: 'w749268117', riseM: 7, mat: 'slate' },
      { id: 'w749268116', riseM: 7, mat: 'slate' }, { id: 'w749268115', riseM: 4, mat: 'slate' },
    ],
  },
  {
    // The tower is 80 m; OSM stops at 30, so the octagonal stage, lantern and needle spire are stacked on.
    name: 'Zuiderkerk',
    wall: { plain: true, hex: '#8a4b38' },
    tiers: [{ id: 'w749385556', shape: 'square', mat: 'brick' }],
    stacks: [{ onId: 'w749385556', stages: [
      { shape: 'octagon', w0: 9, w1: 7.4, h: 14, mat: 'stone' },
      { shape: 'octagon', w0: 6.6, w1: 6.6, h: 8, mat: 'lead' },
      { shape: 'octagon', w0: 6.2, w1: 0.5, h: 26, mat: 'lead' },
      { shape: 'octagon', w0: 0.8, w1: 0, h: 3, mat: 'gold' },
    ] }],
    roofs: [{ id: 'w749385558', riseM: 6, mat: 'slate' }, { id: 'w749385557', riseM: 4, mat: 'tile' }],
  },
  {
    // 47 m: brick base, white octagonal stages with clocks, a lead lantern and a spire.
    name: 'Montelbaanstoren',
    tiers: [
      { id: 'w751647820', shape: 'square', mat: 'brick' },
      { id: 'w751647819', shape: 'octagon', mat: 'white', clocks: true },
      { id: 'w751647818', shape: 'octagon', mat: 'white' },
      { id: 'w751647817', shape: 'octagon', mat: 'lead' },
    ],
    stacks: [{ onId: 'w751647817', stages: [
      { shape: 'octagon', w0: 3.4, w1: 0.5, h: 7.5, mat: 'lead' },
      { shape: 'octagon', w0: 1.1, w1: 1.1, h: 0.9, mat: 'gold' },
      { shape: 'octagon', w0: 0.8, w1: 0, h: 1.2, mat: 'gold' },
    ] }],
    roofs: [],
  },
  {
    // A Greek cross: two naves crossing, a small turret and spire above the crossing.
    name: 'Noorderkerk',
    wall: { plain: true, hex: '#8f5a40' },
    tiers: [
      { id: 'w749871263', shape: 'octagon', mat: 'white' },
      { id: 'w749871262', shape: 'octagon', mat: 'lead' },
    ],
    stacks: [{ onId: 'w749871262', stages: [{ shape: 'octagon', w0: 2.2, w1: 0, h: 6.5, mat: 'lead' }] }],
    roofs: [{ id: 'w749269858', riseM: 8, mat: 'slate' }, { id: 'w749269859', riseM: 8, mat: 'slate' }],
  },
  {
    // The cupola 51 m up: stone drum, copper dome, lantern, gilt ship weathervane.
    name: 'Royal Palace',
    wall: { plain: false, style: 'canal', hex: '#cdc2a8' },
    tiers: [{ id: 'w748659171', shape: 'octagon', mat: 'white', z1: 40, columns: 8 }],
    stacks: [{ onId: 'w748659171', startZ: 40, stages: [
      { shape: 'octagon', w0: 9.6, w1: 8.8, h: 1.4, mat: 'copper' },
      { shape: 'octagon', w0: 8.8, w1: 6.6, h: 1.6, mat: 'copper' },
      { shape: 'octagon', w0: 6.6, w1: 3.4, h: 1.6, mat: 'copper' },
      { shape: 'octagon', w0: 3.4, w1: 1.7, h: 1.2, mat: 'copper' },
      { shape: 'octagon', w0: 1.7, w1: 1.7, h: 3, mat: 'white' },
      { shape: 'octagon', w0: 1.9, w1: 0, h: 3.4, mat: 'gold' },
    ] }],
    roofs: ['w748659181', 'w748659182', 'w748659172', 'w748659173', 'w748659174', 'w748659175', 'w748659183', 'w748659170', 'w748659180']
      .map(id => ({ id, riseM: 5, mat: 'lead' as const })),
  },
  {
    // Two round corner towers with conical roofs, two turrets, and steep roofs on the main body.
    name: 'Waag',
    tiers: ['w749066949', 'w749066950', 'w749066946', 'w749066947'].map(id => ({ id, shape: 'octagon' as const, mat: 'brick' as const })),
    stacks: [
      ...['w749066949', 'w749066950'].map(onId => ({ onId, stages: [{ shape: 'octagon' as const, w0: 9, w1: 0.8, h: 10, mat: 'slate' as const }] })),
      ...['w749066946', 'w749066947'].map(onId => ({ onId, stages: [{ shape: 'octagon' as const, w0: 5.2, w1: 0.5, h: 5.5, mat: 'slate' as const }] })),
    ],
    roofs: ['w749066938', 'w749066939', 'w749066942', 'w749066948', 'w749066940'].map(id => ({ id, riseM: 6, mat: 'slate' as const })),
  },
  {
    // Berlage's Beurs: a brick clock tower with a pyramid cap, and long steep-roofed halls.
    // The Beursplein hall's eaves sit on its gable row at 15.5 m (front in landmarkFrontData.ts), so its roof rises 11.5 m.
    name: 'Beurs van Berlage',
    wall: { plain: true, hex: '#9a5240' },
    tiers: [{ id: 'w749918639', shape: 'square', mat: 'brick' }],
    stacks: [{ onId: 'w749918639', stages: [{ shape: 'square', w0: 12.5, w1: 0.6, h: 11, mat: 'slate' }] }],
    // The hall roofs start on the gable row at 15.5 m: rise = part height - 15.5 (641 in the raw extract, 642/645 in the game tiles).
    roofs: [...['w749918651', 'w749918653', 'w749918637', 'w749918638'].map(id => ({ id, riseM: 7, mat: 'slate' as const })),
      { id: 'w749918641', riseM: 11.5, mat: 'slate' }, { id: 'w749918642', riseM: 9.5, mat: 'slate' }, { id: 'w749918645', riseM: 8.5, mat: 'slate' }],
  },
  {
    // Centraal's twin towers: square brick shafts with gilt dials (the west one a clock, the
    // east one a wind dial), a stone band, an open lead lantern and a slim spire each.
    name: 'Centraal',
    wall: { plain: true, hex: '#9a5a45' },
    tiers: ['w752653568', 'w752653567'].map(id => ({ id, shape: 'square' as const, mat: 'brick' as const, z1: 27, clocks: true })),
    stacks: ['w752653568', 'w752653567'].map(onId => ({ onId, startZ: 27, stages: [
      { shape: 'square' as const, w0: 7.6, w1: 7.6, h: 1.2, mat: 'stone' as const },
      { shape: 'octagon' as const, w0: 5.2, w1: 4.8, h: 4.2, mat: 'lead' as const },
      { shape: 'octagon' as const, w0: 5.6, w1: 0.6, h: 4.6, mat: 'lead' as const },
      { shape: 'octagon' as const, w0: 0.6, w1: 0, h: 1.6, mat: 'gold' as const },
    ] })),
    roofs: [],
    body: ['w451533147', 'w451533145', 'w1239767708', 'w424523117', 'w451533149', 'w506192827', 'w752653562', 'w752653565', 'w752653571', 'w752653572', 'w752738611', 'w1239767712', 'w1239767716', 'w1239767717', 'w1239767718', 'w1239767719', 'w1239767720', 'w1239767721', 'w1239767722', 'w1239767723', 'w1239767724', 'w1239767725', 'w1239767726', 'w1240155430', 'w1240155433', 'w1240155434', 'w752286896', 'w752286897', 'w752286898', 'w752328419', 'w752328422', 'w752653574', 'w1239767701', 'w1239767703', 'w1239767706', 'w1239767709', 'w589499178', 'w752328416', 'w752328417', 'w752328418', 'w752328420', 'w752653566', 'w752653570', 'w752653573', 'w752738610', 'w1239767711', 'w1239767713', 'w1239767714', 'w1239767715', 'w1240155431', 'w1240155435', 'w1240314141', 'w1240314142', 'w752328423', 'w752328424', 'w752328425', 'w752328426', 'w752653575', 'w1239767702'],
  },
  {
    // Rijksmuseum: two central towers with steep slate spires over the gate, four corner
    // turrets with spires, steep roofs on the main wings. Cuypers' red brick.
    name: 'Rijksmuseum',
    wall: { plain: false, style: 'school', hex: '#9a4f3c' },
    tiers: [
      ...['w749429998', 'w749429999'].map(id => ({ id, shape: 'square' as const, mat: 'brick' as const, z1: 38 })),
      ...['w749805757', 'w749805758', 'w749805760', 'w749805761'].map(id => ({ id, shape: 'square' as const, mat: 'brick' as const, z1: 33 })),
    ],
    stacks: [
      ...['w749429998', 'w749429999'].map(onId => ({ onId, startZ: 38, stages: [
        { shape: 'square' as const, w0: 13.4, w1: 13.4, h: 1.1, mat: 'stone' as const },
        { shape: 'square' as const, w0: 12.4, w1: 0.6, h: 14, mat: 'slate' as const },
        { shape: 'octagon' as const, w0: 0.6, w1: 0, h: 1.4, mat: 'gold' as const },
      ] })),
      ...['w749805757', 'w749805758', 'w749805760', 'w749805761'].map(onId => ({ onId, startZ: 33, stages: [
        { shape: 'square' as const, w0: 7.4, w1: 7.4, h: 0.8, mat: 'stone' as const },
        { shape: 'square' as const, w0: 6.8, w1: 0.4, h: 8.4, mat: 'slate' as const },
        { shape: 'octagon' as const, w0: 0.4, w1: 0, h: 1, mat: 'gold' as const },
      ] })),
    ],
    roofs: ['w749430000', 'w749430001', 'w749429988'].map(id => ({ id, riseM: 8, mat: 'slate' as const })),
    body: ['NL.IMBAG.Pand.0363100012235882', 'w431070791', 'w431070942', 'w517791046', 'w749429987', 'w749429989', 'w749429991', 'w749429992', 'w749429993', 'w749429994', 'w749429995', 'w749429996', 'w749429997', 'w749805753', 'w749805756', 'w749805759', 'w749805762', 'w749429990', 'w749805754', 'w749805755', 'w749805763', 'w749805764', 'NL.IMBAG.Pand.0363100012229949', 'NL.IMBAG.Pand.0363100012157857', 'NL.IMBAG.Pand.0363100012194197', 'NL.IMBAG.Pand.0363100012236686'],
  },
  {
    // Sint-Nicolaasbasiliek: twin west towers with octagonal lanterns and small domes, and the
    // crossing dome on its drum with a lantern. Dark brick, lead and copper.
    name: 'Sint-Nicolaas',
    wall: { plain: true, hex: '#7a4636' },
    tiers: [
      ...['w645534930', 'w645534931'].map(id => ({ id, shape: 'square' as const, mat: 'brick' as const, z1: 43 })),
      { id: 'w749289632', shape: 'octagon', mat: 'brick', z0: 24, z1: 39, columns: 8 },
    ],
    stacks: [
      ...['w645534930', 'w645534931'].map(onId => ({ onId, startZ: 43, stages: [
        { shape: 'octagon' as const, w0: 5.6, w1: 5.4, h: 6, mat: 'brick' as const },
        { shape: 'octagon' as const, w0: 6.2, w1: 2.2, h: 3.4, mat: 'copper' as const },
        { shape: 'octagon' as const, w0: 1.4, w1: 0, h: 2.2, mat: 'copper' as const },
        { shape: 'octagon' as const, w0: 0.4, w1: 0, h: 1.2, mat: 'gold' as const },
      ] })),
      { onId: 'w749289632', startZ: 39, stages: [
        { shape: 'octagon', w0: 13.6, w1: 11.4, h: 4, mat: 'copper' },
        { shape: 'octagon', w0: 11.4, w1: 6.4, h: 4.4, mat: 'copper' },
        { shape: 'octagon', w0: 6.4, w1: 2.6, h: 2.6, mat: 'copper' },
        { shape: 'octagon', w0: 2.4, w1: 2.2, h: 3.4, mat: 'white' },
        { shape: 'octagon', w0: 2.8, w1: 0, h: 2.4, mat: 'copper' },
        { shape: 'octagon', w0: 0.5, w1: 0, h: 1, mat: 'gold' },
      ] },
    ],
    roofs: [{ id: 'w749289633', riseM: 8, mat: 'slate' }, { id: 'w749289634', riseM: 8, mat: 'slate' }],
    hides: ['w750217062', 'w750591090'],
    body: ['w750217059', 'w750217060', 'w750217061', 'w750217063', 'w750217064', 'w750591088'],
  },
  {
    // Munttoren: an octagonal brick and stone tower with clocks on the old Regulierspoort
    // base, an open lantern and Hendrick de Keyser's spire.
    name: 'Munttoren',
    tiers: [
      { id: 'w751698384', shape: 'octagon', mat: 'brick', z1: 14, clocks: true },
      { id: 'w751698383', shape: 'octagon', mat: 'white', z0: 14, z1: 19 },
      { id: 'w751698382', shape: 'octagon', mat: 'lead', z0: 19, z1: 23 },
    ],
    stacks: [{ onId: 'w751698382', stages: [
      { shape: 'octagon', w0: 3.8, w1: 3.4, h: 3, mat: 'white' },
      { shape: 'octagon', w0: 3.6, w1: 0.3, h: 7.5, mat: 'lead' },
      { shape: 'octagon', w0: 0.5, w1: 0, h: 1.2, mat: 'gold' },
    ] }],
    roofs: [],
  },
  {
    // De Krijtberg (Sint-Franciscus Xaveriuskerk): two slender neo-Gothic towers with tall
    // slate spires on the Singel front, a steep nave roof behind.
    name: 'Krijtberg',
    wall: { plain: true, hex: '#7a4a3a' },
    tiers: ['w751905304', 'w751905305'].map(id => ({ id, shape: 'octagon' as const, mat: 'brick' as const, z1: 33 })),
    stacks: ['w751905304', 'w751905305'].map(onId => ({ onId, startZ: 33, stages: [
      { shape: 'octagon' as const, w0: 4.6, w1: 4.6, h: 0.8, mat: 'stone' as const },
      { shape: 'octagon' as const, w0: 4.2, w1: 0.3, h: 15, mat: 'slate' as const },
      { shape: 'octagon' as const, w0: 0.4, w1: 0, h: 1.8, mat: 'gold' as const },
    ] })),
    roofs: [{ id: 'w751713223', riseM: 10, mat: 'slate' }, { id: 'w751713221', riseM: 10, mat: 'slate' }],
    body: ['w751713218', 'w751713219', 'w751713220', 'w751713222', 'w751905303', 'w751979070'],
  },
  {
    // Oude Kerk: the brick tower base with clocks, then octagonal lead stages, an open
    // lantern and the spire; steep roofs over the hall church and its chapels.
    name: 'Oude Kerk',
    wall: { plain: true, hex: '#8a5a44' },
    tiers: [
      { id: 'w747868982', shape: 'square', mat: 'brick', clocks: true },
      { id: 'w747868971', shape: 'octagon', mat: 'lead' },
    ],
    stacks: [{ onId: 'w747868971', stages: [
      { shape: 'octagon', w0: 6, w1: 5.4, h: 5, mat: 'lead' },
      { shape: 'octagon', w0: 4.6, w1: 4.2, h: 4, mat: 'white' },
      { shape: 'octagon', w0: 4.4, w1: 0.3, h: 8.5, mat: 'lead' },
      { shape: 'octagon', w0: 0.5, w1: 0, h: 1.2, mat: 'gold' },
    ] }],
    roofs: [
      ...['w747868974', 'w747868975'].map(id => ({ id, riseM: 9, mat: 'slate' as const })),
      ...['w747868972', 'w747868973', 'w747868976', 'w747868977', 'w747868978', 'w747868979', 'w747868980', 'w747868981', 'w747868984'].map(id => ({ id, riseM: 5.5, mat: 'slate' as const })),
    ],
    hides: ['w747868970'],
  },
  {
    // Nieuwe Kerk on the Dam: towering nave and transept roofs (the tower was never built)
    // with a slim lead flèche over the crossing; lower aisle and chapel roofs.
    name: 'Nieuwe Kerk',
    wall: { plain: true, hex: '#8f5d48' },
    tiers: [],
    stacks: [{ onId: 'w747911439', startZ: 34, stages: [
      { shape: 'octagon', w0: 2.6, w1: 2.2, h: 3.2, mat: 'lead' },
      { shape: 'octagon', w0: 2.4, w1: 0, h: 8, mat: 'lead' },
      { shape: 'octagon', w0: 0.4, w1: 0, h: 1, mat: 'gold' },
    ] }],
    roofs: [
      { id: 'w747911441', riseM: 14, mat: 'slate' }, { id: 'w747911439', riseM: 14, mat: 'slate' }, { id: 'w747911438', riseM: 5, mat: 'slate' },
      ...['w747911436', 'w747911437', 'w747924626'].map(id => ({ id, riseM: 6, mat: 'slate' as const })),
    ],
  },
  {
    // NEMO: Renzo Piano's copper-green ship rising out of the IJ tunnel mouth; its colour is
    // the recognisable part, so the whole building is walled in patinated copper.
    name: 'NEMO',
    wall: { plain: true, hex: '#4f9a82', flat: true },
    tiers: [],
    stacks: [],
    roofs: [],
    body: ['w1390692763', 'w1390692767', 'w1390692768', 'w1390692769', 'w1390692770', 'w1390692771', 'w1390692772', 'w1390692766', 'w1390692764', 'w1390692765'],
  },
  {
    // De Hallen, the 1902-05 Tollensstraat tram depot (user report 2026-10-02: one bare tan
    // block). One BAG footprint over a row of brick sheds about 9.6 m wide, whose gable ends
    // step back 6 m each along the Bellamyplein side (the footprint's 9.6 m / 6 m step edges).
    name: 'De Hallen',
    wall: { plain: false, style: 'school', hex: '#9a5844' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012236693', widthM: 9.62, anchor: [4.868004, 52.367613], eavesM: 7.2, riseM: 3.4, mat: 'slate' }],
  },
  {
    // Fatih mosque, Rozengracht 150: H.W. Valk's 1929 Sint-Ignatiuskerk (user report 2026-10-02:
    // a 37 m green box). One BAG footprint whose BAG height is the towers', so the whole block
    // stood at tower height in a hash-picked colour. Dark brown brick nave with its gable to the
    // street between twin square towers, 40 m with their slate pyramid caps (Commons photo
    // "Fatihmosquewesterkerkamsterdam.jpg"; nl.wikipedia: "dubbeltorenfront van 40 meter").
    // The towers stand inside the front corners (Rozengracht runs along the footprint's 30.6 m
    // south front, bearing 68 degrees).
    name: 'Fatih',
    wall: { plain: true, hex: '#6a3a2e' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012167944', widthM: 30.6, anchor: [4.878429, 52.372973], eavesM: 16, riseM: 9, mat: 'slate', towers: [
      { at: [4.878461, 52.373017], widthM: 7.5, z1: 31, capM: 8.5, cap: 'slate' },
      { at: [4.878772, 52.373095], widthM: 7.5, z1: 31, capM: 8.5, cap: 'slate' },
    ] }],
  },
];

/** Every part a kit draws, and which of them hide their own plain prism (tiers, and hosts under a stack). */
export const KIT_PART_IDS: ReadonlySet<string> = new Set(KITS.flatMap(k => [...k.tiers.map(t => t.id), ...k.stacks.map(s => s.onId), ...k.roofs.map(r => r.id), ...(k.halls ?? []).map(h => h.id), ...(k.hides ?? [])]));
export const KIT_HIDE_IDS: readonly string[] = [...new Set(KITS.flatMap(k => [...k.tiers.map(t => t.id), ...k.stacks.map(s => s.onId), ...(k.hides ?? [])]))];
/** Every landmark part a kit draws or walls itself (parts, hall hosts, bodies): the generic landmark fallback leaves these alone. */
export const KIT_MODELLED_IDS: ReadonlySet<string> = new Set([...KIT_PART_IDS, ...KITS.flatMap(k => k.body ?? [])]);
const KIT_ROOF = new Map(KITS.flatMap(k => k.roofs.map(r => [r.id, { roof: r, wall: k.wall }] as const)));
const KIT_HALLS = new Map(KITS.flatMap(k => (k.halls ?? []).map(h => [h.id, { halls: h, wall: k.wall }] as const)));
const KIT_BODY = new Map(KITS.flatMap(k => (k.wall ? (k.body ?? []).map(id => [id, k.wall!] as const) : [])));

type GeoFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

/** Lower a kit roof host's plain wall to its eaves and stop the flat lid; other features pass through. */
export function decorateKitRoof<T extends GeoFeature>(feature: T): T {
  const body = KIT_BODY.get(String(feature.properties.id ?? ''));
  if (body && !feature.properties.kitWall) {
    return { ...feature, properties: { ...feature.properties, facade: 'kit', facadeStyle: body.plain ? 'school' : body.style, kitWall: body.plain ? (body.flat ? 'flat' : 'plain') : 'grid', kitWallHex: body.hex, sideColour: body.hex } };
  }
  const hall = KIT_HALLS.get(String(feature.properties.id ?? ''));
  if (hall && !feature.properties.kitRoof) {
    const wall = hall.wall, walled = wall ? { facade: 'kit', facadeStyle: wall.plain ? 'school' : wall.style, kitWall: wall.plain ? 'plain' : 'grid', kitWallHex: wall.hex, sideColour: wall.hex } : {};
    return { ...feature, properties: { ...feature.properties, kitRoof: true, roofShape: 'gabled', roofEavesHeightM: hall.halls.eavesM, ...walled } };
  }
  const entry = KIT_ROOF.get(String(feature.properties.id ?? ''));
  if (!entry || feature.properties.kitRoof) return feature;
  const { roof, wall } = entry, height = Number(feature.properties.height);
  if (!Number.isFinite(height) || height - roof.riseM < 4) return feature;
  const walled = wall ? { facade: 'kit', facadeStyle: wall.plain ? 'school' : wall.style, kitWall: wall.plain ? 'plain' : 'grid', kitWallHex: wall.hex, sideColour: wall.hex } : {};
  return { ...feature, properties: { ...feature.properties, kitRoof: true, roofShape: 'pitched', roofEavesHeightM: height - roof.riseM, ...walled } };
}

type Vec3 = [number, number, number];
type Vec2 = [number, number];
export type KitMat = 'plain' | 'flat' | 'slope';
export type KitTri = { p: [Vec3, Vec3, Vec3]; uv: [Vec2, Vec2, Vec2]; layer: KitMat; hex: string; n: Vec3 };
export type KitPartGeometry = { id: string; tris: KitTri[] };
export type PartInput = { id: string; ring: Vec2[]; minHeightM: number; heightM: number };

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const layerFor = (mat: Mat): KitMat => (mat === 'brick' ? 'plain' : 'flat');

class TriSink {
  readonly out: KitTri[] = [];
  tri(a: Vec3, b: Vec3, c: Vec3, ua: Vec2, ub: Vec2, uc: Vec2, layer: KitMat, hex: string, hint: Vec3) {
    let n = cross(sub(b, a), sub(c, a)), B = b, C = c, UB = ub, UC = uc;
    if (dot(n, hint) < 0) { B = c; C = b; UB = uc; UC = ub; n = [-n[0], -n[1], -n[2]]; }
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-9) return;
    this.out.push({ p: [a, B, C], uv: [ua, UB, UC], layer, hex, n: [n[0] / l, n[1] / l, n[2] / l] });
  }
}

/** A frustum (or pyramid, when w1 is 0) with a 4 or 8 sided base about (cx, cy), turned by `ang`. */
function stage(sink: TriSink, cx: number, cy: number, ang: number, shape: StageShape, w0: number, w1: number, z0: number, z1: number, mat: Mat, hexOverride?: string) {
  const n = shape === 'square' ? 4 : 8;
  // Full width is the distance across flats, so a square of width w is w x w.
  const radius = (w: number) => (shape === 'square' ? (w / 2) * Math.SQRT2 : w / 2 / Math.cos(Math.PI / 8));
  const off = shape === 'square' ? Math.PI / 4 : Math.PI / 8;
  const ring = (w: number, z: number): Vec3[] => Array.from({ length: n }, (_, k) => {
    const a = ang + off + (k * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * radius(w), cy + Math.sin(a) * radius(w), z] as Vec3;
  });
  const bottom = ring(w0, z0), top = w1 > 0 ? ring(w1, z1) : null, apex: Vec3 = [cx, cy, z1];
  const layer = layerFor(mat), hex = hexOverride ?? MAT_HEX[mat];
  let run = 0;
  for (let k = 0; k < n; k++) {
    const b0 = bottom[k], b1 = bottom[(k + 1) % n];
    const side = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
    const u0 = run / 5, u1 = (run + side) / 5; run += side;
    const midA = ang + off + ((k + 0.5) * 2 * Math.PI) / n, hint: Vec3 = [Math.cos(midA), Math.sin(midA), 0.2];
    if (top) {
      const t0 = top[k], t1 = top[(k + 1) % n];
      sink.tri(b0, b1, t1, [u0, z0 / 3.1], [u1, z0 / 3.1], [u1, z1 / 3.1], layer, hex, hint);
      sink.tri(b0, t1, t0, [u0, z0 / 3.1], [u1, z1 / 3.1], [u0, z1 / 3.1], layer, hex, hint);
    } else sink.tri(b0, b1, apex, [u0, z0 / 3.1], [u1, z0 / 3.1], [(u0 + u1) / 2, z1 / 3.1], layer, hex, hint);
  }
  if (top) for (let k = 1; k < n - 1; k++) sink.tri(top[0], top[k], top[k + 1], [0, 0], [1, 0], [1, 1], 'flat', hex, [0, 0, 1]);
}

/** Four gilt-ringed clock faces on the sides of a tier, as flat octagon fans just proud of the wall. */
function clocks(sink: TriSink, cx: number, cy: number, ang: number, width: number, zc: number) {
  const r = Math.min(width * 0.3, 2.3);
  for (let k = 0; k < 4; k++) {
    const a = ang + (k * Math.PI) / 2, dx = Math.cos(a), dy = Math.sin(a), tx = -dy, ty = dx;
    const mx = cx + dx * (width / 2 + 0.55 + 0.06), my = cy + dy * (width / 2 + 0.55 + 0.06);
    for (const [rad, mat, lift] of [[r, 'gold', 0], [r * 0.8, 'white', 0.04]] as const) {
      const pts: Vec3[] = Array.from({ length: 8 }, (_, i) => { const t = (i * Math.PI) / 4 + Math.PI / 8; return [mx + dx * lift + tx * Math.cos(t) * rad, my + dy * lift + ty * Math.cos(t) * rad, zc + Math.sin(t) * rad] as Vec3; });
      for (let i = 1; i < 7; i++) sink.tri(pts[0], pts[i], pts[i + 1], [0, 0], [1, 0], [1, 1], 'flat', MAT_HEX[mat], [dx, dy, 0]);
    }
  }
}

/** A ring of slim square columns around a drum. */
function columns(sink: TriSink, cx: number, cy: number, ang: number, width: number, z0: number, z1: number, n: number) {
  for (let k = 0; k < n; k++) {
    const a = ang + (k * 2 * Math.PI) / n + Math.PI / n, rad = width / 2 + 0.1;
    stage(sink, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a, 'square', 0.7, 0.7, z0, z1, 'white');
  }
}

/**
 * Triangles for every part of a kit that is present. `parts` are the OSM
 * footprints in metres; missing parts (a tile that has not loaded) are skipped.
 */
export function kitGeometry(kit: Kit, parts: ReadonlyMap<string, PartInput>): KitPartGeometry[] {
  const out = new Map<string, TriSink>();
  const sinkFor = (id: string) => { let s = out.get(id); if (!s) out.set(id, s = new TriSink()); return s; };
  const rectOf = (part: PartInput): Rect | null => fitRect(part.ring, 200);
  for (const tier of kit.tiers) {
    const part = parts.get(tier.id), rect = part && rectOf(part);
    if (!part || !rect) continue;
    const width = Math.max(rect.len, rect.wid), ang = Math.atan2(rect.uy, rect.ux);
    const z0 = tier.z0 ?? part.minHeightM, z1 = tier.z1 ?? part.heightM;
    const sink = sinkFor(tier.id);
    stage(sink, rect.cx, rect.cy, ang, tier.shape, width, width, z0, z1, tier.mat);
    // A cornice ledge at the top of every tier but the last in its kit gives each stage a roofline.
    if (tier.z1 === undefined) stage(sink, rect.cx, rect.cy, ang, tier.shape, width + 0.9, width + 0.9, z1 - 0.55, z1, tier.mat === 'brick' ? 'stone' : tier.mat);
    if (tier.clocks) clocks(sink, rect.cx, rect.cy, ang, width, (z0 + z1) / 2 - 0.4);
    if (tier.columns) columns(sink, rect.cx, rect.cy, ang, width, z0 + 1, z1 - 0.8, tier.columns);
  }
  for (const stack of kit.stacks) {
    const part = parts.get(stack.onId), rect = part && rectOf(part);
    if (!part || !rect) continue;
    const ang = Math.atan2(rect.uy, rect.ux);
    let z = stack.startZ ?? part.heightM;
    for (const s of stack.stages) { stage(sinkFor(stack.onId), rect.cx, rect.cy, ang, s.shape, s.w0, s.w1, z, z + s.h, s.mat); z += s.h; }
  }
  for (const roof of kit.roofs) {
    const part = parts.get(roof.id), rect = part && rectOf(part);
    if (!part || !rect || rect.coverage < 0.7) continue;
    const eaves = part.heightM - roof.riseM;
    if (eaves < 4) continue;
    const plan: RoofPlan = { kind: 'pitched', gable: 'plain', riseM: roof.riseM, dormers: false, material: 'slate', tone: 0, seed: roof.id, chimney: false };
    const sink = sinkFor(roof.id);
    const hex = MAT_HEX[roof.mat === 'tile' ? 'tile' : roof.mat === 'lead' ? 'lead' : 'slate'];
    for (const t of roofTriangles(rect, plan, eaves, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
      const slope = t.part === 'slope';
      sink.out.push({ p: t.p, uv: t.uv, layer: slope ? 'slope' : 'plain', hex: slope ? hex : MAT_HEX.stone, n: t.n });
    }
  }
  for (const spec of kit.halls ?? []) {
    const part = parts.get(spec.id);
    if (!part) continue;
    const sink = sinkFor(spec.id), hex = MAT_HEX[spec.mat === 'tile' ? 'tile' : spec.mat === 'lead' ? 'lead' : 'slate'], gable = kit.wall?.hex ?? MAT_HEX.brick;
    const plan: RoofPlan = { kind: 'pitched', gable: 'plain', riseM: spec.riseM, dormers: false, material: 'slate', tone: 0, seed: spec.id, chimney: false };
    for (const rect of hallRects(part.ring, spec.widthM, toLocal(spec.anchor))) {
      for (const t of roofTriangles(rect, plan, spec.eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
        const slope = t.part === 'slope';
        sink.out.push({ p: t.p, uv: t.uv, layer: slope ? 'slope' : 'plain', hex: slope ? hex : gable, n: t.n });
      }
    }
    // Towers line up with the halls' axis (the footprint's longest edge).
    const axis = hallRects(part.ring, spec.widthM, toLocal(spec.anchor))[0], ang = axis ? Math.atan2(axis.uy, axis.ux) : 0;
    for (const tower of spec.towers ?? []) {
      const [cx, cy] = toLocal(tower.at), w = tower.widthM;
      stage(sink, cx, cy, ang, 'square', w, w, part.minHeightM, tower.z1, 'brick', gable);
      stage(sink, cx, cy, ang, 'square', w + 0.8, w + 0.8, tower.z1 - 0.6, tower.z1, 'stone');
      stage(sink, cx, cy, ang, 'square', w + 1.2, 0, tower.z1, tower.z1 + tower.capM, tower.cap);
      stage(sink, cx, cy, ang, 'octagon', 0.35, 0, tower.z1 + tower.capM, tower.z1 + tower.capM + 1.6, 'gold');
    }
  }
  return [...out].map(([id, sink]) => ({ id, tris: sink.out }));
}

// Kit parts arrive in the three layer's local metres (ORIGIN in threeBuildingFeatures.ts).
const KIT_ORIGIN = { lng: 4.9, lat: 52.37 };
const toLocal = ([lng, lat]: [number, number]): Vec2 => [(lng - KIT_ORIGIN.lng) * 111_320 * Math.cos(KIT_ORIGIN.lat * Math.PI / 180), (lat - KIT_ORIGIN.lat) * 110_540];

/**
 * The halls under one footprint: the ring is cut into strips `widthM` wide across the
 * direction of its longest edge, aligned so a strip line passes through `anchor`, and each
 * strip's centre line, clipped to the ring, gives one hall rectangle (several where the
 * footprint has a notch). Halls shorter than 4 m are dropped.
 */
export function hallRects(ring: readonly Vec2[], widthM: number, anchor: Vec2): Rect[] {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
  if (pts.length < 3 || !(widthM > 1)) return [];
  let ux = 1, uy = 0, best = 0;
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > best) { best = len; ux = (b[0] - a[0]) / len; uy = (b[1] - a[1]) / len; }
  }
  const vx = -uy, vy = ux;
  const local = pts.map(([x, y]) => [(x - anchor[0]) * ux + (y - anchor[1]) * uy, (x - anchor[0]) * vx + (y - anchor[1]) * vy] as Vec2);
  const vMin = Math.min(...local.map(p => p[1])), vMax = Math.max(...local.map(p => p[1]));
  const out: Rect[] = [];
  for (let k = Math.floor(vMin / widthM); k * widthM < vMax; k++) {
    const v0 = Math.max(vMin, k * widthM), v1 = Math.min(vMax, (k + 1) * widthM), vc = (v0 + v1) / 2;
    if (v1 - v0 < widthM * 0.4) continue;
    const xs: number[] = [];
    for (let i = 0; i < local.length; i++) {
      const [a, b] = [local[i], local[(i + 1) % local.length]];
      if ((a[1] > vc) !== (b[1] > vc)) xs.push(a[0] + ((vc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const u0 = xs[i], u1 = xs[i + 1];
      if (u1 - u0 < 4) continue;
      const cu = (u0 + u1) / 2;
      out.push({ cx: anchor[0] + ux * cu + vx * vc, cy: anchor[1] + uy * cu + vy * vc, ux, uy, len: u1 - u0, wid: v1 - v0, coverage: 1, maxDev: 0 });
    }
  }
  return out;
}
