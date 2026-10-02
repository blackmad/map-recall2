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
export type KitWall = { plain: true; hex: string } | { plain: false; style: 'canal' | 'school'; hex: string };
/** `hides`: further parts the kit's own geometry replaces (a dome's OSM bands under a modelled dome). */
/** `body`: the landmark's remaining parts, walled in the kit's own style instead of a generic facade. */
export type Kit = { name: string; tiers: Tier[]; stacks: Stack[]; roofs: KitRoof[]; wall?: KitWall; hides?: string[]; body?: string[] };

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
];

/** Every part a kit draws, and which of them hide their own plain prism (tiers, and hosts under a stack). */
export const KIT_PART_IDS: ReadonlySet<string> = new Set(KITS.flatMap(k => [...k.tiers.map(t => t.id), ...k.stacks.map(s => s.onId), ...k.roofs.map(r => r.id), ...(k.hides ?? [])]));
export const KIT_HIDE_IDS: readonly string[] = [...new Set(KITS.flatMap(k => [...k.tiers.map(t => t.id), ...k.stacks.map(s => s.onId), ...(k.hides ?? [])]))];
const KIT_ROOF = new Map(KITS.flatMap(k => k.roofs.map(r => [r.id, { roof: r, wall: k.wall }] as const)));
const KIT_BODY = new Map(KITS.flatMap(k => (k.wall ? (k.body ?? []).map(id => [id, k.wall!] as const) : [])));

type GeoFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };

/** Lower a kit roof host's plain wall to its eaves and stop the flat lid; other features pass through. */
export function decorateKitRoof<T extends GeoFeature>(feature: T): T {
  const body = KIT_BODY.get(String(feature.properties.id ?? ''));
  if (body && !feature.properties.kitWall) {
    return { ...feature, properties: { ...feature.properties, facade: 'kit', facadeStyle: body.plain ? 'school' : body.style, kitWall: body.plain ? 'plain' : 'grid', kitWallHex: body.hex, sideColour: body.hex } };
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
function stage(sink: TriSink, cx: number, cy: number, ang: number, shape: StageShape, w0: number, w1: number, z0: number, z1: number, mat: Mat) {
  const n = shape === 'square' ? 4 : 8;
  // Full width is the distance across flats, so a square of width w is w x w.
  const radius = (w: number) => (shape === 'square' ? (w / 2) * Math.SQRT2 : w / 2 / Math.cos(Math.PI / 8));
  const off = shape === 'square' ? Math.PI / 4 : Math.PI / 8;
  const ring = (w: number, z: number): Vec3[] => Array.from({ length: n }, (_, k) => {
    const a = ang + off + (k * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * radius(w), cy + Math.sin(a) * radius(w), z] as Vec3;
  });
  const bottom = ring(w0, z0), top = w1 > 0 ? ring(w1, z1) : null, apex: Vec3 = [cx, cy, z1];
  const layer = layerFor(mat), hex = MAT_HEX[mat];
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
  return [...out].map(([id, sink]) => ({ id, tris: sink.out }));
}
