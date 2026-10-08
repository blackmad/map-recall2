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
import { formTriangles, type KitForm } from './landmarkForms.js';
import { MUSEUM_KITS } from './museumKits.js';
import { WORSHIP_KITS } from './worshipKits.js';
import { FIT_COVERAGE, FIT_MAX_DEV_M, GENERIC_WORSHIP_KITS } from './worshipBuildings.js';
import { GENERIC_PUBLIC_KITS } from './publicBuildings.js';

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
export type KitHalls = {
  id: string; widthM: number; anchor: [number, number]; eavesM: number; riseM: number; mat: 'slate' | 'tile' | 'lead'; towers?: KitTower[]; wings?: KitWing[];
  /** Window openings on the host's walls and towers (opt in: a kit without it keeps blank walls). */
  windows?: KitWindows;
  /** A roof colour other than the material's own (Carré's pale zinc). */
  roofHex?: string;
  /**
   * One pitched roof over the footprint's own best-fit rectangle, ridge along its long side, at
   * `eavesM` rising `riseM` (the generic place-of-worship nave, worshipBuildings.ts). Skipped when
   * the rectangle covers the footprint poorly, so an odd plan keeps its flat lid at the eaves.
   */
  fit?: boolean;
};
/**
 * A row of window openings, `z0` (sill) to `z1` (top of the head), `widthM` wide, `bayM` apart,
 * with a round, pointed or flat head. Without `at` the row fills every wall edge long enough
 * for one window (bays spread evenly, none inside a tower); with `at` ([lng, lat], a point on a
 * wall) it puts exactly `count` windows, `bayM` apart, centred on that point of the nearest wall,
 * and the fill rows then leave that wall alone. On towers (`towerRows`) `count` windows go
 * centred on each of the four faces.
 */
export type KitWindowRow = { z0: number; z1: number; widthM: number; bayM: number; head?: 'round' | 'pointed' | 'flat'; at?: [number, number]; count?: number };
/** A round window on the nearest wall to `at`: glass, a stone ring, a hub and six spokes of tracery. */
export type KitRose = { at: [number, number]; z: number; radiusM: number };
/**
 * Cheap window geometry on a kit's walls: dark glass panes a hand's breadth proud of the wall,
 * optionally in a light `frameHex` surround, and a stone `plinth` band round the base.
 */
export type KitWindows = { rows: KitWindowRow[]; /** Source-supported blind wall points; fill rows skip their nearest edge. */ blindWalls?: [number, number][]; towerRows?: KitWindowRow[]; roses?: KitRose[]; glassHex?: string; frameHex?: string; plinth?: { z1: number; hex: string } };
/**
 * A pitched or hipped roof over one rectangle of the footprint, at the host's eaves: a nave, a
 * transept, a cross arm. `at` is its centre ([lng, lat]), `lenM` runs along the ridge, `bearingDeg`
 * is the ridge's direction (degrees counter-clockwise from east). The strips of `widthM` cut a
 * footprint into parallel halls; wings are for a plan that is not one, and `widthM: 0` leaves the
 * strips off so the wings roof the building alone. `roof: 'dome'` is a cloister dome: four convex
 * sides curving up from the eaves to a flat top `riseM` higher (Carré's roof over the circus ring).
 */
export type KitWing = { at: [number, number]; lenM: number; widM: number; bearingDeg: number; riseM: number; roof?: 'gable' | 'hipped' | 'dome'; /** `dome`: how far the curved sides reach in from the eaves before the flat top (default 35% of the width). */ insetM?: number };
/**
 * A tower standing on a hall host's footprint at `at` ([lng, lat], its centre), walled
 * in the kit's own brick up to `z1`, with a stone cornice and a pyramid cap `capM` tall. For a
 * church whose towers are not separate OSM parts (one BAG footprint for the whole building).
 * The optional fields reshape it: `shape` an octagonal body, `lenM` a slab (with `bearingDeg`
 * turning it, default the hall axis), `z0` a body that starts above the ground (a lantern on a
 * ridge), `mat`/`wallHex` its material, and `capShape` a convex `spire`, a `dome`, or a `slant`
 * (a flat top tilted to rise `capM` towards `highBearingDeg`, for a slab). `capHex` colours the cap.
 */
export type KitTower = {
  at: [number, number]; widthM: number; z1: number; capM: number; cap: Mat;
  lenM?: number; bearingDeg?: number; z0?: number; shape?: StageShape; mat?: Mat; wallHex?: string;
  capShape?: 'pyramid' | 'spire' | 'dome' | 'slant'; capHex?: string; highBearingDeg?: number;
  /** A pyramid cap narrower than the tower (set back behind a parapet, the Hofkerk's west tower); default the cornice's width. */
  capWidthM?: number;
  /** `false`: no gilt finial on the cap (a minaret's balcony ring, which is a short wide tower of its own). */
  finial?: boolean;
};
export type Kit = { name: string; tiers: Tier[]; stacks: Stack[]; roofs: KitRoof[]; halls?: KitHalls[]; wall?: KitWall; hides?: string[]; body?: string[]; /** Hand-modelled volumes (landmarkForms.ts). */ forms?: KitForm[] };

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

export const HAND_KITS: Kit[] = [
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
    // BAG's own record for the church's east end (NL.IMBAG.Pand.0363100012164998, BAG year 1990): a 1.8 x 10 m sliver 35 m tall that stood as a bare beige slab beside
    // the OSM nave parts. Walled in the kit's brick to the nave's 27 m eaves under a slim slate ridge.
    halls: [{ id: 'NL.IMBAG.Pand.0363100012164998', widthM: 1.9, anchor: [4.884358, 52.374554], eavesM: 27, riseM: 1.5, mat: 'slate' }],
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
  // Museums and cinemas: the Van Gogh Museum, the Stedelijk, Eye, Tuschinski, the Maritime Museum, H'ART (museumKits.ts).
  ...MUSEUM_KITS,
  // Places of worship modelled by hand (worshipKits.ts), and the generic treatment for the rest (worshipBuildings.ts).
  ...WORSHIP_KITS,
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
    ],
    // Openings read off Commons "Fatih moskee, Amsterdam 69.jpg" (the front, scaled by its 4.5 m
    // door arches) and "Fatihmosquewesterkerkamsterdam.jpg" (the towers): three pointed door
    // arches, four round-headed windows over them, a 3.6 m rose with star tracery in the gable,
    // paired windows up each tower and a row of five belfry arches under the cornice. The photos
    // show round heads, not pointed ones, everywhere but the doors. The nave's long walls stand
    // behind 10-16 m neighbours; their tall windows are a guess from the plan, not a photo.
    windows: {
      glassHex: '#46505a', frameHex: '#c9bda4',
      // Amsterdam monument 200454: Bloemstraat elevation is nearly blind.
      blindWalls: [[4.878470, 52.373455]],
      // `at` points sit on the front wall: its middle, and in front of each tower.
      rows: [
        { z0: 0.3, z1: 4.6, widthM: 2.6, bayM: 3.1, head: 'pointed', at: [4.8786371, 52.3730248], count: 3 },
        { z0: 7.7, z1: 10.9, widthM: 1, bayM: 1.9, head: 'round', at: [4.8786371, 52.3730248], count: 4 },
        ...([[4.8784814, 52.372986], [4.8787927, 52.3730635]] as [number, number][]).flatMap(at => [
          { z0: 5.6, z1: 8.4, widthM: 0.85, bayM: 1.3, head: 'flat' as const, at, count: 2 },
          { z0: 9.6, z1: 12.2, widthM: 0.85, bayM: 1.3, head: 'flat' as const, at, count: 2 },
          { z0: 13.6, z1: 15.6, widthM: 0.85, bayM: 1.3, head: 'round' as const, at, count: 2 },
        ]),
        { z0: 6, z1: 13.5, widthM: 1.5, bayM: 4.5, head: 'round' },
      ],
      roses: [{ at: [4.8786371, 52.3730248], z: 16, radiusM: 1.8 }],
      towerRows: [
        { z0: 18, z1: 20.8, widthM: 0.85, bayM: 1.3, head: 'round', count: 2 },
        { z0: 27.4, z1: 29.8, widthM: 0.75, bayM: 1.3, head: 'round', count: 5 },
      ],
    } }],
  },
  {
    // Obrechtkerk, Jacob Obrechtstraat: Jos Cuypers and Jan Stuyt's 1908-11 neo-Romanesque cross
    // basilica (BAG height 36.3 m is the twin towers', carried by the whole 2075 m2 footprint).
    // Commons "Obrechtkerk.jpg" (RCE view of the front): two square brown-grey brick towers with
    // arched belfries and a steep banded cap each, red-tile roofs behind; nl.wikipedia: "een front
    // ... geflankeerd door twee rijzige torens, en met een lagere vieringtoren aan de westkant".
    // The footprint is a Latin cross on an axis of 24 degrees with the front to the east: a 24 m
    // wide nave, a 30 m wide transept block, a choir block with the apse, and a 15 m annex at the
    // south east corner. The towers fill the two front corners (7 m wide, an 11 m porch between);
    // the crossing tower (10 m, tiled pyramid) stands over the transept, lower than the front.
    name: 'Obrechtkerk',
    wall: { plain: true, hex: '#7d6858' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012124153', widthM: 0, anchor: [4.874498, 52.35549], eavesM: 15, riseM: 8, mat: 'tile',
      wings: [
        { at: [4.87496, 52.355863], lenM: 30.3, widM: 24.4, bearingDeg: 24, riseM: 8 },
        { at: [4.874639, 52.355771], lenM: 37.9, widM: 17.9, bearingDeg: 114, riseM: 6 },
        { at: [4.874436, 52.355718], lenM: 42.1, widM: 12, bearingDeg: 114, riseM: 4.3 },
        { at: [4.875291, 52.35577], lenM: 15.1, widM: 12.5, bearingDeg: 24, riseM: 4.2 },
      ],
      towers: [
        // Front towers: walls to 27 m, a banded spire cap 7.7 m with its cross (36.3 m in all).
        { at: [4.875065, 52.355978], widthM: 7, z1: 27, capM: 7.7, cap: 'slate', capShape: 'spire', capHex: '#665a50', bearingDeg: 24 },
        { at: [4.875169, 52.355834], widthM: 7, z1: 27, capM: 7.7, cap: 'slate', capShape: 'spire', capHex: '#665a50', bearingDeg: 24 },
        { at: [4.874637, 52.355775], widthM: 10, z1: 22, capM: 6.5, cap: 'tile', bearingDeg: 24 },
      ] }],
  },
  {
    // Oosterkerk, Wittenburgergracht: Daniel Stalpaert's 1669-71 Greek-cross church (BAG height
    // 26.9 m is the lantern with its weathervane). Commons "Oosterkerk-amsterdam-wittenburg.jpg":
    // brown brick, tall slate hipped roofs on four arms meeting at the crossing, and a lead-clad
    // wooden lantern with an open belfry and a dome; nl.wikipedia: "gelijkarmig kruis ... Op de
    // kruising van de hoge schilddaken staat een met lood beklede houten koepeltoren". The
    // footprint is a 29 m square (corners filled in) with arms 14 m wide running out 5 m
    // beyond it on a 45 degree axis. Eaves at 14 m and ridges at 19 m read off the photo
    // (the hipped end reaches 4.5 m above the cornice); the lantern runs from the ridges to 25 m.
    name: 'Oosterkerk',
    wall: { plain: true, hex: '#8c5b46' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012170274', widthM: 0, anchor: [4.919276, 52.369762], eavesM: 14, riseM: 5, mat: 'slate',
      wings: [
        { at: [4.91931, 52.369991], lenM: 39.1, widM: 13.9, bearingDeg: 45, riseM: 5, roof: 'hipped' },
        { at: [4.91931, 52.369991], lenM: 32.5, widM: 14.5, bearingDeg: 135, riseM: 5, roof: 'hipped' },
      ],
      towers: [
        // The belfry (lead grey, octagonal, from the ridge up) and its dome with a small lantern: 26.8 m.
        { at: [4.91931, 52.369991], widthM: 5.4, z0: 17.5, z1: 22.5, capM: 2.7, cap: 'lead', shape: 'octagon', mat: 'lead', wallHex: '#5f6670', capShape: 'dome', capHex: '#8d939b', bearingDeg: 45 },
      ] }],
  },
  {
    // Mozes en Aäronkerk, Waterlooplein: Suys' 1837-41 neoclassical church. Commons
    // "Mozes_en_Aaronkerk_1.jpg": a cream stuccoed front with a four-column portico between two
    // open timber towers, brown brick flanks under a very low roof; nl.wikipedia: "facade met
    // twee torens", "driebeukige hallenkerk", "bakstenen zijgevels". BAG height 24.4 m is a blend.
    // The footprint is 23 x 44.6 m (front at the south west end, where two 6.5 m blocks flank
    // the portico recess). Walls 15 m, ridge 18.5 m; towers 31.4 m of cream stucco with a slate
    // cap and cross, 33 m in all (photo: columns 10 m against a 33 m cross).
    name: 'Mozes en Aäronkerk',
    wall: { plain: true, hex: '#7c5a4a' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012253765', widthM: 0, anchor: [4.902946, 52.368211], eavesM: 15, riseM: 3.5, mat: 'slate',
      wings: [{ at: [4.903287, 52.368335], lenM: 40.6, widM: 23, bearingDeg: 56, riseM: 3.5 }],
      towers: [
        { at: [4.903024, 52.368228], widthM: 6.5, z1: 29.5, capM: 2, cap: 'slate', wallHex: '#e3d6a6', bearingDeg: -34 },
        { at: [4.903229, 52.368143], widthM: 6.5, z1: 29.5, capM: 2, cap: 'slate', wallHex: '#e3d6a6', bearingDeg: -34 },
      ] }],
  },
  {
    // De Duif (Sint-Willibrorduskerk), Prinsengracht 756: Theo Molkenboer's 1857 neoclassical
    // church with a neo-baroque front (user report: one bare box). Commons "De Duif (Amsterdam,
    // Q2050495).jpg": grey stuccoed front with pilasters and an arched window under a pediment
    // with a cross, no tower; nl.wikipedia: "neoclassicistische stijl ... neobarokke voorgevel".
    // BAG height 24.5 m is the pediment. The footprint is a plain 46 x 18.6 m nave (the street
    // front is the jagged pilastered short end) under a long pitched roof; walls at 16 m, ridge 22 m.
    name: 'De Duif',
    wall: { plain: true, hex: '#a99e8c', flat: true },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012171729', widthM: 0, anchor: [4.897017, 52.361124], eavesM: 16, riseM: 6, mat: 'slate',
      wings: [{ at: [4.896787, 52.361299], lenM: 46.1, widM: 18.6, bearingDeg: 107, riseM: 6 }] }],
  },
  {
    // Opstandingskerk, Bos en Lommerplein: Marius Duintjer's 1955-56 church, nicknamed "Kolenkit"
    // for its bell tower. Commons "Overzicht westgevel met kerktoren - Amsterdam - 20357071 -
    // RCE.jpg" (rijksmonument photo): pink-red brick, a low nave under a very shallow gable, and
    // a slab tower 7 m wide whose top is cut on a long slant, high edge up; nl.wikipedia: "48 meter
    // hoge klokkentoren" and "rode baksteen". BAG height (35.2 m) is a blend of the two. The tower
    // is the 7 x 12.5 m strip at the footprint's south end; its top rises 10.5 m from the low
    // (west) edge at 37.5 m to 48 m along the photo's long slope. The nave (11 m walls, a
    // 15 degree roof) roofs the rounded hall; the saw-tooth north wall stays as mapped.
    name: 'Opstandingskerk',
    wall: { plain: true, hex: '#b07a63' },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012133302', widthM: 0, anchor: [4.842514, 52.377448], eavesM: 11, riseM: 3, mat: 'lead',
      wings: [{ at: [4.842772, 52.377707], lenM: 31, widM: 22, bearingDeg: 2, riseM: 3 }],
      towers: [
        { at: [4.842958, 52.377514], widthM: 7, lenM: 12.5, z1: 37.5, capM: 10.5, cap: 'slate', capShape: 'slant', highBearingDeg: 2, bearingDeg: 2 },
      ] }],
  },
  {
    // Koninklijk Theater Carré, Amstel 115-125: the 1887 circus building (user 2026-10-03:
    // "Carre looks awful in that shot", one bare 28 m brick slab). One BAG footprint, 58 x 37 m on
    // an axis of 17 degrees, its 37 m front on the Amstel at the west end with an 8 m central
    // risalit standing 1.9 m proud. Commons "Carre_Theatre_2038.jpg" and "Overzicht op Carré gezien
    // vanaf de overzijde van de Amstel - 20408841 - RCE.jpg" (straight on, scaled by the 37 m
    // front): a cream stuccoed neo-Renaissance front, a grey stone ground storey of round arches
    // to 4.5 m, three rows of windows (5-8 m, 9-11.5 m, 14.5-16.5 m), the cornice at 19 m and a
    // pediment over the risalit to 21.5 m. Behind it the whole block sits under one pale zinc
    // cloister dome (Commons "Theater Carre - Amsterdam - 20015613 - RCE.jpg" and "Amsterdam - Amstel -
    // Hoge Sluis - View North towards Carré Theatre.jpg" show its curved sides from the south west)
    // with a flat top and the CARRÉ sign box; BAG 28.3 m is the box's top. The front's
    // ends are pilastered bays, not raised pavilions. The 8.7 m strip on the north (Bridge Hotel)
    // side and its round stair turret keep the eaves under low hipped roofs and the flat lid.
    name: 'Carré',
    wall: { plain: true, hex: '#e2d8c2', flat: true },
    tiers: [], stacks: [], roofs: [],
    halls: [{ id: 'NL.IMBAG.Pand.0363100012165489', widthM: 0, anchor: [4.903937, 52.362186], eavesM: 19, riseM: 8, mat: 'lead', roofHex: '#98a299',
      wings: [
        { at: [4.904268, 52.362423], lenM: 58.3, widM: 37.1, bearingDeg: 17, riseM: 8, roof: 'dome', insetM: 13 },
        { at: [4.903873, 52.362349], lenM: 6, widM: 8, bearingDeg: 17, riseM: 2.5 },
        { at: [4.904316, 52.362648], lenM: 31.4, widM: 8.7, bearingDeg: 17, riseM: 1.5, roof: 'hipped' },
        { at: [4.904043, 52.362572], lenM: 9.1, widM: 3.4, bearingDeg: 17, riseM: 1, roof: 'hipped' },
      ],
      towers: [
        // The CARRÉ sign box on the dome's flat top, behind the pediment: 8.4 m across the front.
        { at: [4.904079, 52.362387], widthM: 3.5, lenM: 8.4, z0: 26.6, z1: 28, capM: 0.3, cap: 'lead', capShape: 'slant', highBearingDeg: 17, bearingDeg: 17, mat: 'white', wallHex: '#ece6da' },
        // The round stair turret at the back (south east) corner: a low zinc cap, a guess (no photo shows it).
        { at: [4.904677, 52.362304], widthM: 7.6, shape: 'octagon', z0: 18.4, z1: 19, capM: 1.6, cap: 'lead', capShape: 'dome', capHex: '#98a299', mat: 'white', wallHex: '#e2d8c2', bearingDeg: 17 },
      ],
      windows: {
        glassHex: '#3b4148',
        plinth: { z1: 4.6, hex: '#8c877d' },
        rows: [
          { z0: 0.4, z1: 3.9, widthM: 2.2, bayM: 3.7, head: 'round' },
          { z0: 5.2, z1: 8, widthM: 1.4, bayM: 3.7, head: 'flat' },
          { z0: 9.3, z1: 11.6, widthM: 1.4, bayM: 3.7, head: 'flat' },
          { z0: 14.6, z1: 16.3, widthM: 1.4, bayM: 3.7, head: 'flat' },
        ],
      } }],
  },
];

export const kitIds = (k: Kit) => [...k.tiers.map(t => t.id), ...k.stacks.map(s => s.onId), ...k.roofs.map(r => r.id), ...(k.halls ?? []).map(h => h.id), ...(k.hides ?? []), ...(k.forms ?? []).map(f => f.on), ...(k.body ?? [])];
/** Every footprint a hand-modelled kit claims (the worship staging script leaves these to their kit). */
export const HAND_KIT_IDS: ReadonlySet<string> = new Set(HAND_KITS.flatMap(kitIds));
const HAND_IDS = HAND_KIT_IDS;
/** Every kit: the hand-modelled ones, then the generic worship treatment for footprints none of them claims. */
export const KITS: Kit[] = [...HAND_KITS, ...[...GENERIC_WORSHIP_KITS, ...GENERIC_PUBLIC_KITS].filter(k => kitIds(k).every(id => !HAND_IDS.has(id)))];

/** Every part a kit draws, and which of them hide their own plain prism (tiers, and hosts under a stack). */
export const KIT_PART_IDS: ReadonlySet<string> = new Set(KITS.flatMap(k => [...k.tiers.map(t => t.id), ...k.stacks.map(s => s.onId), ...k.roofs.map(r => r.id), ...(k.halls ?? []).map(h => h.id), ...(k.hides ?? []), ...(k.forms ?? []).map(f => f.on)]));
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
    const wall = hall.wall, walled = wall ? { facade: 'kit', facadeStyle: wall.plain ? 'school' : wall.style, kitWall: wall.plain ? (wall.flat ? 'flat' : 'plain') : 'grid', kitWallHex: wall.hex, sideColour: wall.hex } : {};
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
 * A rectangular prism `w` along `ang` by `l` across, walled from z0 up to a flat top that rises
 * from `zLow` to `zHigh` towards the direction `high` (radians): a slab tower with a slanted lid.
 */
function slab(sink: TriSink, cx: number, cy: number, ang: number, w: number, l: number, z0: number, zLow: number, zHigh: number, high: number, mat: Mat, hexOverride?: string) {
  const ax = Math.cos(ang), ay = Math.sin(ang), bx = -ay, by = ax, hx = Math.cos(high), hy = Math.sin(high);
  const layer = layerFor(mat), hex = hexOverride ?? MAT_HEX[mat];
  const pts = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([i, j]) => [cx + ax * (i * w) / 2 + bx * (j * l) / 2, cy + ay * (i * w) / 2 + by * (j * l) / 2] as Vec2);
  const reach = Math.abs(hx * ax + hy * ay) * (w / 2) + Math.abs(hx * bx + hy * by) * (l / 2);
  const zAt = (p: Vec2) => zLow + ((zHigh - zLow) * (((p[0] - cx) * hx + (p[1] - cy) * hy) / reach + 1)) / 2;
  const tops = pts.map(p => [p[0], p[1], zAt(p)] as Vec3), feet = pts.map(p => [p[0], p[1], z0] as Vec3);
  let run = 0;
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4, side = Math.hypot(pts[k1][0] - pts[k][0], pts[k1][1] - pts[k][1]);
    const u0 = run / 5, u1 = (run + side) / 5; run += side;
    const mx = (pts[k][0] + pts[k1][0]) / 2 - cx, my = (pts[k][1] + pts[k1][1]) / 2 - cy, hint: Vec3 = [mx, my, 0];
    sink.tri(feet[k], feet[k1], tops[k1], [u0, z0 / 3.1], [u1, z0 / 3.1], [u1, tops[k1][2] / 3.1], layer, hex, hint);
    sink.tri(feet[k], tops[k1], tops[k], [u0, z0 / 3.1], [u1, tops[k1][2] / 3.1], [u0, tops[k][2] / 3.1], layer, hex, hint);
  }
  sink.tri(tops[0], tops[1], tops[2], [0, 0], [1, 0], [1, 1], 'flat', hex, [0, 0, 1]);
  sink.tri(tops[0], tops[2], tops[3], [0, 0], [1, 0], [1, 1], 'flat', hex, [0, 0, 1]);
}

/** Convex octagonal caps as [relative base, relative top, relative height] frusta, fractions of the cap. */
const CAP_PROFILES: Record<'spire' | 'dome', ReadonlyArray<readonly [number, number, number]>> = {
  // A hemisphere in four steps: radius cos and height sin of 0, 30, 55, 75, 90 degrees.
  dome: [[1, 0.87, 0.5], [0.87, 0.57, 0.32], [0.57, 0.26, 0.17], [0.26, 0, 0.01]],
  // A steep bulged point, the Obrechtkerk's banded tower caps: fat low down, a long thin tip.
  spire: [[1, 0.9, 0.2], [0.9, 0.62, 0.28], [0.62, 0.32, 0.27], [0.32, 0.1, 0.2], [0.1, 0, 0.05]],
};

/** One kit tower: walls, cornice, and a cap (a pyramid unless `capShape` says otherwise), at `(cx, cy)` turned `ang`. */
function towerParts(sink: TriSink, t: KitTower, [cx, cy]: Vec2, ang: number, baseZ: number, gable: string) {
  const w = t.widthM, z0 = t.z0 ?? baseZ, shape = t.shape ?? 'square', body = t.mat ?? 'brick';
  const hex = t.wallHex ?? (body === 'brick' ? gable : undefined), capShape = t.capShape ?? 'pyramid';
  if (capShape === 'slant') {
    slab(sink, cx, cy, ang, w, t.lenM ?? w, z0, t.z1, t.z1 + t.capM, ((t.highBearingDeg ?? 0) * Math.PI) / 180, body, hex);
    return;
  }
  stage(sink, cx, cy, ang, shape, w, w, z0, t.z1, body, hex);
  if (shape === 'square') stage(sink, cx, cy, ang, 'square', w + 0.8, w + 0.8, t.z1 - 0.6, t.z1, 'stone');
  // An octagonal tower takes an octagonal pyramid (the Gerardus Majellakerk's drum and its slate cone).
  if (capShape === 'pyramid') stage(sink, cx, cy, ang, shape, t.capWidthM ?? w + 1.2, 0, t.z1, t.z1 + t.capM, t.cap, t.capHex);
  else {
    let z = t.z1;
    const base = shape === 'square' ? w + 0.5 : w;
    for (const [r0, r1, h] of CAP_PROFILES[capShape]) { stage(sink, cx, cy, ang, 'octagon', base * r0, base * r1, z, z + h * t.capM, t.cap, t.capHex); z += h * t.capM; }
  }
  if (t.finial !== false) stage(sink, cx, cy, ang, 'octagon', 0.35, 0, t.z1 + t.capM, t.z1 + t.capM + 1.6, 'gold');
}

/**
 * A cloister dome over a rectangle: four convex sides rise from the eaves rectangle, each ring
 * stepped in by `inset * (1 - cos a)` at height `rise * sin a`, to a flat top `inset` in from the eaves.
 */
function cloisterDome(sink: TriSink, rect: Rect, z0: number, rise: number, inset: number, hex: string) {
  const { cx, cy, ux, uy } = rect, vx = -uy, vy = ux;
  const ring = (d: number, z: number): Vec3[] => ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
    .map(([i, j]) => [cx + ux * i * (rect.len / 2 - d) + vx * j * (rect.wid / 2 - d), cy + uy * i * (rect.len / 2 - d) + vy * j * (rect.wid / 2 - d), z] as Vec3);
  const steps = [0, 22, 45, 67, 90].map(deg => (deg * Math.PI) / 180);
  let lower = ring(0, z0);
  for (let s = 1; s < steps.length; s++) {
    const upper = ring(inset * (1 - Math.cos(steps[s])), z0 + rise * Math.sin(steps[s]));
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4, mx = (lower[k][0] + lower[k1][0]) / 2 - cx, my = (lower[k][1] + lower[k1][1]) / 2 - cy;
      const hint: Vec3 = [mx, my, Math.hypot(mx, my) * 0.3];
      const side = Math.hypot(lower[k1][0] - lower[k][0], lower[k1][1] - lower[k][1]);
      const v0 = (s - 1) * 1.6, v1 = s * 1.6;
      sink.tri(lower[k], lower[k1], upper[k1], [0, v0], [side / 5, v0], [side / 5, v1], 'slope', hex, hint);
      sink.tri(lower[k], upper[k1], upper[k], [0, v0], [side / 5, v1], [0, v1], 'slope', hex, hint);
    }
    lower = upper;
  }
  sink.tri(lower[0], lower[1], lower[2], [0, 0], [1, 0], [1, 1], 'slope', hex, [0, 0, 1]);
  sink.tri(lower[0], lower[2], lower[3], [0, 0], [1, 1], [0, 1], 'slope', hex, [0, 0, 1]);
}

const GLASS_HEX = '#2c333b';
/** Proud of the wall: plinth, frame, glass, tracery. Far enough not to shimmer, close enough to read as an opening. */
const OFF = { plinth: 0.04, frame: 0.07, glass: 0.1, tracery: 0.13 };

/** One opening's outline in wall coordinates (s along the wall, z up), convex, counter-clockwise. */
function openingOutline(s0: number, s1: number, z0: number, z1: number, head: 'round' | 'pointed' | 'flat'): Vec2[] {
  const w = s1 - s0, mid = (s0 + s1) / 2;
  if (head === 'flat' || z1 - z0 < w) return [[s0, z0], [s1, z0], [s1, z1], [s0, z1]];
  if (head === 'round') {
    const r = w / 2, zb = z1 - r, arc: Vec2[] = [];
    for (let k = 0; k <= 4; k++) { const a = (k * Math.PI) / 4; arc.push([mid + Math.cos(a) * r, zb + Math.sin(a) * r]); }
    return [[s0, z0], [s1, z0], ...arc];
  }
  const zb = z1 - 0.8 * w, shoulder = zb + 0.5 * (z1 - zb);
  return [[s0, z0], [s1, z0], [s1, zb], [s1 - 0.12 * w, shoulder], [mid, z1], [s0 + 0.12 * w, shoulder], [s0, zb]];
}

/** A flat convex polygon on a wall: `o` the wall's foot at s = 0, `t` along it, `n` out of it. */
function wallPolygon(sink: TriSink, o: Vec2, t: Vec2, n: Vec2, off: number, pts: readonly Vec2[], hex: string) {
  const at = ([s, z]: Vec2): Vec3 => [o[0] + t[0] * s + n[0] * off, o[1] + t[1] * s + n[1] * off, z];
  const hint: Vec3 = [n[0], n[1], 0];
  for (let k = 1; k + 1 < pts.length; k++) sink.tri(at(pts[0]), at(pts[k]), at(pts[k + 1]), [0, 0], [1, 0], [1, 1], 'flat', hex, hint);
}

/** A window at `s` along a wall: glass, and a light surround when the kit has one. */
function opening(sink: TriSink, o: Vec2, t: Vec2, n: Vec2, s: number, row: KitWindowRow, glass: string, frame?: string) {
  const head = row.head ?? 'round', w = row.widthM;
  if (frame) wallPolygon(sink, o, t, n, OFF.frame, openingOutline(s - w / 2 - 0.18, s + w / 2 + 0.18, row.z0 - 0.15, row.z1 + 0.18, head), frame);
  wallPolygon(sink, o, t, n, OFF.glass, openingOutline(s - w / 2, s + w / 2, row.z0, row.z1, head), glass);
}

/** A rose window centred at `s`, height `z`: stone ring, glass, six spokes and a hub. */
function roseWindow(sink: TriSink, o: Vec2, t: Vec2, n: Vec2, s: number, rose: KitRose, glass: string, stone: string) {
  const disc = (r: number, k = 12): Vec2[] => Array.from({ length: k }, (_, i) => [s + Math.cos((i * 2 * Math.PI) / k) * r, rose.z + Math.sin((i * 2 * Math.PI) / k) * r] as Vec2);
  const r = rose.radiusM;
  wallPolygon(sink, o, t, n, OFF.frame, disc(r + 0.3), stone);
  wallPolygon(sink, o, t, n, OFF.glass, disc(r), glass);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a), px = -sa * 0.09, pz = ca * 0.09;
    wallPolygon(sink, o, t, n, OFF.tracery, [[s - ca * r + px, rose.z - sa * r + pz], [s - ca * r - px, rose.z - sa * r - pz], [s + ca * r - px, rose.z + sa * r - pz], [s + ca * r + px, rose.z + sa * r + pz]], stone);
  }
  wallPolygon(sink, o, t, n, OFF.tracery, disc(r * 0.26, 8), stone);
}

type WallEdge = { o: Vec2; t: Vec2; n: Vec2; len: number };

/** The ring's edges with unit tangents and outward normals. */
function wallEdges(ring: readonly Vec2[]): WallEdge[] {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice();
  let area2 = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  const sign = area2 >= 0 ? 1 : -1;
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), t: Vec2 = len ? [(b[0] - a[0]) / len, (b[1] - a[1]) / len] : [1, 0];
    return { o: a, t, n: [t[1] * sign, -t[0] * sign] as Vec2, len };
  });
}

/** The edge nearest `p`, and where `p` falls along its line. */
function nearestEdge(edges: readonly WallEdge[], p: Vec2): { edge: number; s: number } {
  let best = { edge: 0, s: 0, d: Infinity };
  edges.forEach((e, i) => {
    const s = (p[0] - e.o[0]) * e.t[0] + (p[1] - e.o[1]) * e.t[1], c = Math.max(0, Math.min(e.len, s));
    const d = Math.hypot(e.o[0] + e.t[0] * c - p[0], e.o[1] + e.t[1] * c - p[1]);
    if (d < best.d) best = { edge: i, s, d };
  });
  return best;
}

/** Windows, roses and a plinth on a hall host's walls and its square towers. */
function kitWindows(sink: TriSink, ring: readonly Vec2[], spec: KitHalls, win: KitWindows, towerAng: (t: KitTower) => number) {
  const edges = wallEdges(ring), glass = win.glassHex ?? GLASS_HEX, stone = win.frameHex ?? MAT_HEX.stone;
  if (win.plinth) for (const e of edges) if (e.len >= 0.2) wallPolygon(sink, e.o, e.t, e.n, OFF.plinth, [[0, 0], [e.len, 0], [e.len, win.plinth.z1], [0, win.plinth.z1]], win.plinth.hex);
  // A window centre inside a tower's plan (plus a margin) is behind the tower's own wall.
  const inTower = (p: Vec2) => (spec.towers ?? []).some(t => {
    const [cx, cy] = toLocal(t.at), a = towerAng(t), dx = p[0] - cx, dy = p[1] - cy;
    return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) < t.widthM / 2 + 0.4 && Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) < (t.lenM ?? t.widthM) / 2 + 0.4;
  });
  const placed = win.rows.filter(r => r.at).map(r => ({ row: r, ...nearestEdge(edges, toLocal(r.at!)) }));
  // A placed row claims its whole wall: every edge on the same line (a front mapped as several
  // collinear pieces a few centimetres apart). Its openings go on the outermost of those pieces,
  // so a piece standing proud does not swallow them (the Fatih front's 0.2 m jogs).
  const claimed = new Set<number>((win.blindWalls ?? []).map(at => nearestEdge(edges, toLocal(at)).edge));
  const plane = (edge: number): WallEdge => {
    const a = edges[edge];
    let out = 0;
    edges.forEach((e, i) => {
      const along = e.t[0] * a.t[0] + e.t[1] * a.t[1], off = (e.o[0] - a.o[0]) * a.n[0] + (e.o[1] - a.o[1]) * a.n[1];
      if (along > 0.995 && Math.abs(off) < 0.4) { claimed.add(i); out = Math.max(out, off); }
    });
    return { ...a, o: [a.o[0] + a.n[0] * out, a.o[1] + a.n[1] * out] };
  };
  for (const { row, edge, s } of placed) {
    const e = plane(edge), n = row.count ?? 1;
    for (let k = 0; k < n; k++) opening(sink, e.o, e.t, e.n, s + (k - (n - 1) / 2) * row.bayM, row, glass, win.frameHex);
  }
  for (const row of win.rows) {
    if (row.at || row.z1 > spec.eavesM) continue;
    edges.forEach((e, i) => {
      if (claimed.has(i) || e.len < row.widthM + 1) return;
      const n = Math.max(1, Math.floor(e.len / row.bayM));
      for (let k = 0; k < n; k++) {
        const s = ((k + 0.5) * e.len) / n;
        if (!inTower([e.o[0] + e.t[0] * s + e.n[0] * 0.5, e.o[1] + e.t[1] * s + e.n[1] * 0.5])) opening(sink, e.o, e.t, e.n, s, row, glass, win.frameHex);
      }
    });
  }
  for (const rose of win.roses ?? []) {
    const { edge, s } = nearestEdge(edges, toLocal(rose.at)), e = plane(edge);
    roseWindow(sink, e.o, e.t, e.n, s, rose, glass, stone);
  }
  // Tower faces: square towers only (a slab or an octagon has no four faces of one width).
  for (const t of spec.towers ?? []) {
    if ((t.shape ?? 'square') !== 'square' || t.lenM !== undefined || t.capShape === 'slant') continue;
    const [cx, cy] = toLocal(t.at), a = towerAng(t), half = t.widthM / 2;
    for (let f = 0; f < 4; f++) {
      const na = a + (f * Math.PI) / 2, n: Vec2 = [Math.cos(na), Math.sin(na)], tt: Vec2 = [-n[1], n[0]];
      const o: Vec2 = [cx + n[0] * half - tt[0] * half, cy + n[1] * half - tt[1] * half];
      for (const row of win.towerRows ?? []) {
        if (row.z1 > t.z1 - 0.6 || row.z0 < (t.z0 ?? 0)) continue;
        const count = row.count ?? Math.max(1, Math.floor(t.widthM / row.bayM));
        for (let k = 0; k < count; k++) opening(sink, o, tt, n, half + (k - (count - 1) / 2) * row.bayM, row, glass, win.frameHex);
      }
    }
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
    const sink = sinkFor(spec.id), hex = spec.roofHex ?? MAT_HEX[spec.mat === 'tile' ? 'tile' : spec.mat === 'lead' ? 'lead' : 'slate'], gable = kit.wall?.hex ?? MAT_HEX.brick;
    const plan: RoofPlan = { kind: 'pitched', gable: 'plain', riseM: spec.riseM, dormers: false, material: 'slate', tone: 0, seed: spec.id, chimney: false };
    for (const rect of hallRects(part.ring, spec.widthM, toLocal(spec.anchor))) {
      for (const t of roofTriangles(rect, plan, spec.eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
        const slope = t.part === 'slope';
        sink.out.push({ p: t.p, uv: t.uv, layer: slope ? 'slope' : 'plain', hex: slope ? hex : gable, n: t.n });
      }
    }
    if (spec.fit) {
      const rect = fitRect(part.ring, 200);
      if (rect && rect.coverage >= FIT_COVERAGE && rect.maxDev <= FIT_MAX_DEV_M && spec.riseM > 0) {
        for (const t of roofTriangles(rect, plan, spec.eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
          const slope = t.part === 'slope';
          sink.out.push({ p: t.p, uv: t.uv, layer: slope ? 'slope' : 'plain', hex: slope ? hex : gable, n: t.n });
        }
      }
    }
    for (const wing of spec.wings ?? []) {
      const [cx, cy] = toLocal(wing.at), b = (wing.bearingDeg * Math.PI) / 180;
      const rect: Rect = { cx, cy, ux: Math.cos(b), uy: Math.sin(b), len: wing.lenM, wid: wing.widM, coverage: 1, maxDev: 0 };
      if (wing.roof === 'dome') { cloisterDome(sink, rect, spec.eavesM, wing.riseM, wing.insetM ?? Math.min(wing.lenM, wing.widM) * 0.35, hex); continue; }
      const wingPlan: RoofPlan = { ...plan, kind: wing.roof === 'hipped' ? 'hipped' : 'pitched', riseM: wing.riseM };
      for (const t of roofTriangles(rect, wingPlan, spec.eavesM, { bayM: 5, storeyM: 3.1, cellM: 1.2 })) {
        const slope = t.part === 'slope';
        sink.out.push({ p: t.p, uv: t.uv, layer: slope ? 'slope' : 'plain', hex: slope ? hex : gable, n: t.n });
      }
    }
    // Towers line up with the halls' axis (the footprint's longest edge).
    const axis = hallRects(part.ring, spec.widthM, toLocal(spec.anchor))[0], ang = axis ? Math.atan2(axis.uy, axis.ux) : 0;
    const towerAng = (tower: KitTower) => (tower.bearingDeg === undefined ? ang : (tower.bearingDeg * Math.PI) / 180);
    for (const tower of spec.towers ?? []) towerParts(sink, tower, toLocal(tower.at), towerAng(tower), part.minHeightM, gable);
    if (spec.windows) kitWindows(sink, part.ring, spec, spec.windows, towerAng);
  }
  for (const form of kit.forms ?? []) { const part = parts.get(form.on); if (part) sinkFor(form.on).out.push(...formTriangles(form, part.ring, toLocal)); }
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
