// What a patch of ground is, from BGT (pure, dependency-free; lane open-ground-look 2026-11-10).
//
// The own ground drew every patch no extract claimed as the `land` layer, the same light grey as paving, so lawns,
// rough lots and yards read as rideable (feedback 637f346b / 4f47f105 off Heathrowstraat and Barajasweg, 020e2132 the
// Moermanskkade lot, 28ae61fb Sloterdijkerweg). BGT is a planar partition of the whole terrain, so every polygon of
// it is one of the classes below. One classifier for the ground look (this lane, open-ground-v1) and for the sister
// lane that makes the paved plazas rideable (lane bgt-plazas-20261110): a `paved-plaza` here is what it admits.
//
//   road         wegdeel rijbaan / parkeervlak / inrit / overweg            drawn by roads-v1
//   paved-plaza  wegdeel plein / voetgangersgebied / woonerf; onbegroeid gesloten or open verharding
//                                                                         roads-v1 (squares up to 20,000 m²), else land
//   path         wegdeel voetpad / fietspad / ruiterpad / trap            roads-v1
//   grass        begroeidterreindeel (lawn, rough grass, reeds, shrubs, wood); onbegroeid erf the CIR aerial shows green
//   bare         onbegroeidterreindeel onverhard / zand / half verhard
//   verge        ondersteunendwegdeel berm / verkeerseiland              roads-v1 (green ones as lawn)
//   other        anything else (spoorbaan, an erf that is paved or unknown, transitie)
//
// `cover` says how an open-ground polygon draws (open-ground-v1, groundCell.ts): `meadow` and `bare` are the lane's
// two new layers, `shrub` and `sand` the parks' layers; null: not drawn by the open-ground extract.

export type GroundSurfaceClass = 'road' | 'paved-plaza' | 'path' | 'grass' | 'bare' | 'verge' | 'other';
export const GROUND_SURFACE_CLASSES: readonly GroundSurfaceClass[] = ['road', 'paved-plaza', 'path', 'grass', 'bare', 'verge', 'other'];

/** How an open-ground polygon is drawn: grass and rough vegetation, shrubs and wood, bare earth and gravel, sand. */
export type OpenGroundCover = 'meadow' | 'shrub' | 'bare' | 'sand';
export const OPEN_GROUND_COVERS: readonly OpenGroundCover[] = ['meadow', 'shrub', 'bare', 'sand'];

/**
 * The ground layer each cover draws in (groundCell.ts). Meadow is the courtyard green (`garden`, groundLook.ts
 * gardenTone): the orthophoto's sunlit open grass measures luma 125 (scripts/own-ground/measure-open-ground-tones.ts,
 * dehazed, 107,688 texels at the lane's spots), the garden tone's luma; the park lawn (luma 140, mowing stripes) stays for
 * parks and green verges. Shrubs and sand share the parks' layers; bare earth is the lane's own `bare` layer.
 */
export const OPEN_GROUND_LAYER: Readonly<Record<OpenGroundCover, 'garden' | 'shrub' | 'bare' | 'sand'>> = { meadow: 'garden', shrub: 'shrub', bare: 'bare', sand: 'sand' };
/** Lift over the relief per cover, metres: as the parks' surfaces (parks.ts PARK_LIFT lawn / shrub / sand), bare between. */
export const OPEN_GROUND_LIFT: Readonly<Record<OpenGroundCover, number>> = { meadow: 0.018, shrub: 0.021, bare: 0.02, sand: 0.022 };

/**
 * How finely open ground drapes the relief (parks.ts drapeBisect: longest edge, how far the fill may sag under the land
 * before it is split, shortest edge), near (LOD 0 full detail) and far (LOD 1, touch). Coarser than the parks' 8 m /
 * 2 mm: at the parks' settings the open ground added 33 % of the triangles of the Nieuw-West cell -5_1 (320k → 426k)
 * and 43 % at LOD 1; at these 19 % and 18 % (1_0: 16 % and 12 %; Centrum 0_0 +2.4 %, -1_-1 +0.5 %). A 1 cm sag under an
 * 18 mm lift never lets the land through near; the far ring's 5 cm is under a pixel there.
 */
export const OPEN_GROUND_DRAPE = { near: { edge: 12, clearance: 0.01, minEdge: 2 }, far: { edge: 32, clearance: 0.05, minEdge: 6 } } as const;

export type BgtCollection = 'wegdeel' | 'ondersteunendwegdeel' | 'begroeidterreindeel' | 'onbegroeidterreindeel';

export interface BgtGroundProps { functie?: string | null; fysiek_voorkomen?: string | null; plus_fysiek_voorkomen?: string | null }

export interface GroundSurfaceVerdict { cls: GroundSurfaceClass; cover: OpenGroundCover | null }

/** An `erf` (yard) at least this vegetated (share of its sunlit CIR pixels, courtyards.ts vegetatedShare) is grass. */
export const ERF_GRASS_SHARE = 0.5;
/**
 * Bare ground (zand, onverhard, half verhard) at least this vegetated is grass. Lower than a yard's: the CIR flight is in
 * early spring, when rough meadow is mostly last year's dry grass (the Moermanskkade lot: median NDVI ~0.1, 0.44 of its
 * sunlit pixels over courtyards.ts NDVI_VEG), while bare sand and earth sit at or under NDVI 0.
 */
export const BARE_GRASS_SHARE = 0.3;

const WEG_ROAD = /^(rijbaan|parkeervlak|inrit|overweg|ov-baan|transitie|baan voor vliegverkeer)/;
const WEG_PLAZA = /^(plein|voetgangersgebied|woonerf)/;
const WEG_PATH = /^(voetpad|fietspad|ruiterpad)/;

/**
 * The class of a BGT polygon and how the open-ground extract draws it. `vegShare`: for an onbegroeid `erf`, the
 * vegetated share of its sunlit CIR aerial pixels (null: unknown). Roads, plazas, paths and verges have no cover:
 * roads-v1 draws them (or the land's paving grey stands for them).
 */
export function groundSurface(collection: BgtCollection, p: BgtGroundProps, vegShare: number | null = null): GroundSurfaceVerdict {
  const fn = (p.functie ?? '').toLowerCase(), fv = (p.fysiek_voorkomen ?? '').toLowerCase(), plus = (p.plus_fysiek_voorkomen ?? '').toLowerCase();
  if (collection === 'wegdeel') {
    if (/spoorbaan/.test(fn)) return { cls: 'other', cover: null };
    if (WEG_PLAZA.test(fn)) return { cls: 'paved-plaza', cover: null };
    if (WEG_PATH.test(fn)) return { cls: 'path', cover: null };
    if (WEG_ROAD.test(fn)) return { cls: 'road', cover: null };
    return { cls: 'other', cover: null };
  }
  if (collection === 'ondersteunendwegdeel') return { cls: 'verge', cover: null };
  if (collection === 'begroeidterreindeel') {
    // Shrubs and wood: the parks' shrub layer (trees stand on it from the tree inventory).
    if (/heester|bosplantsoen|struik|houtwal|haag/.test(plus) || /bos|struiken|houtwal|boomteelt|fruitteelt/.test(fv)) return { cls: 'grass', cover: 'shrub' };
    // Grass, rough grass, reeds, marsh, heath, farmland: the meadow.
    return { cls: 'grass', cover: 'meadow' };
  }
  // onbegroeidterreindeel
  // Bare ground the aerial shows grown over is grass: BGT's survey lags a lot left to itself (the Moermanskkade lot,
  // 020e2132, is `zand` in BGT and meadow on the 2025 photo and the 2025 panorama).
  const green = vegShare !== null && vegShare >= BARE_GRASS_SHARE;
  if (fv === 'zand') return green ? { cls: 'grass', cover: 'meadow' } : { cls: 'bare', cover: 'sand' };
  if (fv === 'onverhard' || fv.startsWith('half verhard')) return green ? { cls: 'grass', cover: 'meadow' } : { cls: 'bare', cover: 'bare' };
  if (fv === 'gesloten verharding' || fv === 'open verharding') return { cls: 'paved-plaza', cover: null };
  if (fv === 'erf') return vegShare !== null && vegShare >= ERF_GRASS_SHARE ? { cls: 'grass', cover: 'meadow' } : { cls: 'other', cover: null };
  return { cls: 'other', cover: null };
}

// ------------------------------------------------------------------ the open-ground-v1 extract

export const OPEN_GROUND_EXTRACT = 'open-ground-v1';
/** Published budget for the whole extract (build-open-ground.ts enforces it). */
export const OPEN_GROUND_TOTAL_BUDGET_GZ = 12 * 1024 * 1024;

/**
 * One cell of open-ground-v1 (`open-ground-v1/cells/<key>.json.gz`): the BGT open ground whose interior point lies in
 * the cell and that no other extract draws (parks-v1, courtyards-v1, roads-v1, the OSM areas), rings (outer first, then
 * holes) in the game's local frame as delta-encoded decimetres (parks.ts encodeLine), already cut free of the OSM area
 * fills so no two ground fills overlap.
 */
export interface OpenGroundCell { version: 1; key: string; areas: { id: string; k: OpenGroundCover; r: number[][] }[] }
export interface OpenGroundManifest { version: 1; cells: string[]; provenance?: Record<string, unknown> }

/** Problems with a parsed cell (empty when valid), the first `limit` only. */
export function openGroundCellProblems(v: unknown, limit = 20): string[] {
  const out: string[] = [];
  const bad = (m: string) => { if (out.length < limit) out.push(m); };
  if (!v || typeof v !== 'object') return ['not an object'];
  const c = v as Record<string, unknown>;
  if (c.version !== 1) bad(`version ${String(c.version)}`);
  if (typeof c.key !== 'string' || !/^-?\d+_-?\d+$/.test(c.key)) bad(`key ${String(c.key)}`);
  if (!Array.isArray(c.areas)) { bad('areas: not an array'); return out; }
  c.areas.forEach((a: any, i) => {
    if (!a || typeof a !== 'object') return bad(`areas[${i}]: not an object`);
    if (typeof a.id !== 'string') bad(`areas[${i}].id`);
    if (!OPEN_GROUND_COVERS.includes(a.k)) bad(`areas[${i}].k ${String(a.k)}`);
    if (!Array.isArray(a.r) || !a.r.length) bad(`areas[${i}].r: no rings`);
    else a.r.forEach((r: unknown, j: number) => { if (!Array.isArray(r) || r.length % 2 || r.length < 6 || r.some(n => !Number.isInteger(n))) bad(`areas[${i}].r[${j}]: not an even-length integer ring of ≥ 3 points`); });
  });
  return out;
}

/** Whether groundSurface reads the CIR aerial's vegetated share for this polygon (the yards and the bare ground). */
export function needsAerial(collection: BgtCollection, fysiekVoorkomen: string | null | undefined): boolean {
  const fv = (fysiekVoorkomen ?? '').toLowerCase();
  return collection === 'onbegroeidterreindeel' && (fv === 'erf' || fv === 'zand' || fv === 'onverhard' || fv.startsWith('half verhard'));
}
