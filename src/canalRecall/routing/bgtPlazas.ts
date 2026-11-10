/**
 * BGT paved plazas and forecourts as rideable surface (lane bgt-plazas-20261110, user decision 2026-11-10 option c).
 *
 * The rideable surface is street corridors around OSM centrelines plus the squares of `squares.json`
 * (pedestrianAreas.ts). Where the municipality's surveyed partition (BGT, Kadaster CC0) says the ground beside a
 * corridor is public paving that is not a road, the bike may ride across it too. This module is the one typed
 * statement of WHICH BGT polygons count, so "rides paved" (this lane) and "looks paved" (the open-ground look lane,
 * ownGround/groundSurface.ts) can agree by importing the same list.
 *
 * The rule (measured in docs/reports/bgt-plazas-20261110.md):
 *  - wegdeel with functie voetgangersgebied, plein, woonerf or voetpad (Amsterdam's BGT maps the Dam, the Spui, the
 *    Nieuwmarkt and the Stationsplein as voetpad, not plein),
 *  - at least BGT_PLAZA_MIN_WIDTH_METRES across (a morphological opening of the union): squares, forecourts and wide
 *    quays stay, ordinary sidewalks and narrow pedestrian streets (which the corridors carry) drop out,
 *  - paved: fysiek_voorkomen open or gesloten verharding (never half verhard, onverhard or erf),
 *  - at ground level (relatieve_hoogteligging 0), status bestaand, no eind_registratie,
 *  - dissolved with its rideable neighbours, reaching BGT_PLAZA_REACH_METRES into adjoining paved road surface so it
 *    meets the corridor of the street beside it, cut by BGT walls and fences (scheiding),
 *  - kept only where the piece touches a routing corridor (no islands one cannot ride to).
 * Left out on purpose (REJECTED_PLAZA_CLASSES says why): onbegroeidterreindeel even where paved (measured: 82 % of its
 * corridor-connected area is Westpoort terminal aprons and closed block courtyards), `erf` (private yards, school
 * grounds, office courtyards: BGT's class for terrain belonging to a pand), parkeervlak (car parks), inrit (driveways
 * into private land), spoorbaan / OV-baan (rail and tram track), and all vegetated ground (begroeidterreindeel: lawns,
 * planting).
 */

/** The BGT collection a source polygon came from. */
export type BgtPlazaCollection = 'wegdeel' | 'onbegroeidterreindeel';

export interface BgtSurfaceAttributes {
  collection: BgtPlazaCollection;
  /** wegdeel functie; empty for onbegroeidterreindeel. */
  functie: string;
  /** fysiek_voorkomen. */
  fv: string | null;
  /** relatieve_hoogteligging. */
  h: number;
  status: string | null;
  /** eind_registratie, null while current. */
  eind: string | null;
}

/** Paved, in BGT's words. Half paved (gravel, shell) and unpaved ground never ride as plaza. */
export const BGT_PAVED_FYSIEK: readonly string[] = ['open verharding', 'gesloten verharding'];

/**
 * The rideable plaza classes: the one list the look lane and the integrator read. `functie: null` means any
 * (onbegroeidterreindeel has no functie; its fysiek_voorkomen already says paved vs erf vs unpaved).
 */
export const RIDEABLE_PLAZA_CLASSES: ReadonlyArray<Readonly<{ collection: BgtPlazaCollection; functie: string | null; fysiek: readonly string[] }>> = [
  { collection: 'wegdeel', functie: 'voetgangersgebied', fysiek: BGT_PAVED_FYSIEK },
  { collection: 'wegdeel', functie: 'plein', fysiek: BGT_PAVED_FYSIEK },
  { collection: 'wegdeel', functie: 'woonerf', fysiek: BGT_PAVED_FYSIEK },
  { collection: 'wegdeel', functie: 'voetpad', fysiek: BGT_PAVED_FYSIEK },
];

/**
 * A plaza is pedestrian paving at least this wide: the union of the classes above is opened by a disc of half this
 * diameter. A 2–4 m sidewalk never survives; the Spui (≈ 30 m) and a 10 m quay promenade do.
 */
export const BGT_PLAZA_MIN_WIDTH_METRES = 8;

/**
 * A single voetpad polygon joins the plaza build only when it is this deep somewhere (half of 5 m), so the city's
 * 82,000 sidewalk polygons do not chain into one cluster. Neighbouring polygons of one square are each that wide in
 * practice; narrower ones still serve as reach (PLAZA_REACH_FUNCTIES).
 */
export const BGT_VOETPAD_CANDIDATE_DEPTH_METRES = 2.5;

/**
 * Classes measured and left out, with the reason, so a later rule change starts from the evidence
 * (docs/reports/bgt-plazas-20261110.md, orthophoto sheets). Never rideable as plaza.
 */
export const REJECTED_PLAZA_CLASSES: ReadonlyArray<Readonly<{ collection: BgtPlazaCollection; functie: string | null; fysiek: string | null; why: string }>> = [
  { collection: 'onbegroeidterreindeel', functie: null, fysiek: 'gesloten verharding', why: 'Westpoort terminal and storage aprons (the 15 largest connected pieces, 2.9 km²), closed block courtyards' },
  { collection: 'onbegroeidterreindeel', functie: null, fysiek: 'open verharding', why: 'block courtyards (one is lawn on the 2025 ortho), boat yards, car parks; some quays are good but not separable by attribute' },
  { collection: 'onbegroeidterreindeel', functie: null, fysiek: 'erf', why: 'terrain belonging to a pand: yards, gardens, school grounds, office courtyards (637f346b and 4f47f105 stand on erf)' },
  { collection: 'wegdeel', functie: 'parkeervlak', fysiek: null, why: 'car parks and parking bays' },
  { collection: 'wegdeel', functie: 'inrit', fysiek: null, why: 'driveways into private land' },
];

/**
 * Road surface a plaza may reach into (BGT_PLAZA_REACH_METRES) so it meets the corridor beside it. Rail, tram and
 * bus track and unpaved ways are not.
 */
export const PLAZA_REACH_FUNCTIES: ReadonlySet<string> = new Set([
  'voetgangersgebied', 'plein', 'woonerf', 'voetpad', 'fietspad', 'parkeervlak', 'inrit', 'rijbaan lokale weg',
  'rijbaan regionale weg', 'rijbaan autoweg', 'overweg', 'transitie',
]);

/** BGT scheiding types that cut a plaza: anything one cannot ride through. */
export const PLAZA_CUTTING_SCHEIDING: ReadonlySet<string> = new Set([
  'muur', 'hek', 'kademuur', 'damwand', 'geluidsscherm', 'walbescherming', 'draadraster', 'faunaraster',
]);

/** How far a plaza reaches into the adjoining paved road surface, metres. The runtime inset (1.5 m) leaves 1.5 m. */
export const BGT_PLAZA_REACH_METRES = 3;

/**
 * A connected piece ships only when it opens at least this much ground the corridors and squares do not already
 * allow (≥ the inset inside it, beyond every corridor's guard reach): a sidewalk corner the corridor already covers
 * costs bytes and adds nothing. Measured 2026-11-10: 2,497 of 7,434 connected pieces open less than 20 m².
 */
export const BGT_PLAZA_MIN_OPENED_M2 = 20;

/** The width of the cut a wall or fence makes, metres. */
export const BGT_PLAZA_CUT_METRES = 0.6;

/**
 * Smaller dissolved pieces are slivers between other objects (a tree pit's surround, a kerb island), not space one
 * rides across. Counted on the BGT plaza polygons only, before the reach is added.
 */
export const BGT_PLAZA_MIN_AREA_M2 = 40;

/**
 * A piece joins the network when a corridor's edge reaches at least PLAZA_EDGE_INSET_METRES − this into it: 0.5 m
 * with the 1.5 m inset. The guard lets the bike 4 px (1.33 m) past a corridor edge, so the corridor and the inset
 * plaza then overlap by 0.33 m and the bike crosses from one to the other without a blocked seam.
 */
export const BGT_PLAZA_CORRIDOR_SLACK_METRES = 1.0;

const isCurrent = (a: BgtSurfaceAttributes) => a.h === 0 && (a.status === null || a.status === 'bestaand') && !a.eind;

/** True when a BGT polygon is rideable plaza paving under RIDEABLE_PLAZA_CLASSES. */
export function isRideablePlazaSurface(a: BgtSurfaceAttributes): boolean {
  if (!isCurrent(a)) return false;
  return RIDEABLE_PLAZA_CLASSES.some(c => c.collection === a.collection
    && (c.functie === null || c.functie === a.functie)
    && c.fysiek.includes(a.fv ?? ''));
}

/** True when a plaza may reach into this BGT road polygon to meet a corridor. */
export function isPlazaReachSurface(a: BgtSurfaceAttributes): boolean {
  if (!isCurrent(a) || a.collection !== 'wegdeel') return false;
  return PLAZA_REACH_FUNCTIES.has(a.functie) && BGT_PAVED_FYSIEK.includes(a.fv ?? '');
}

// ---- runtime flag ---------------------------------------------------------------------------------------------

/** The URL flag: `?bgtPlazas=1` turns the BGT plazas on, `?bgtPlazas=0` off. */
export const BGT_PLAZAS_FLAG = 'bgtPlazas';

/** Default off until the integrator has looked at the ride frames (docs/reports/bgt-plazas-20261110.md). */
export const BGT_PLAZAS_DEFAULT = false;

/** The published extract, relative to the city's extract path. */
export const BGT_PLAZAS_EXTRACT = 'bgt-plazas-v1.json';

export function bgtPlazasEnabled(search: string, fallback: boolean = BGT_PLAZAS_DEFAULT): boolean {
  const match = new RegExp(`[?&]${BGT_PLAZAS_FLAG}=([^&#]*)`).exec(search || '');
  if (!match) return fallback;
  const value = match[1].toLowerCase();
  if (value === '1' || value === 'true' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'off') return false;
  return fallback;
}

/** The extract as published: one feature per dissolved plaza piece, rings as [lat, lon]. */
export interface BgtPlazaExtract {
  version: 1;
  source: string;
  rule: string;
  features: BgtPlazaFeature[];
}

export interface BgtPlazaFeature {
  /** Stable id: `bgt:` + the first BGT lokaal_id in the piece. */
  id: string;
  /** "BGT voetgangersgebied" etc., the dominant source class by area; also what plazaAt reports. */
  name: string;
  source: 'bgt';
  /** Outer ring then holes, closed, [lat, lon] at 1e-7°. */
  polygons: Array<Array<Array<[number, number]>>>;
  /** Area of the BGT plaza polygons in the piece, m² (before the reach). */
  plazaArea: number;
  /** Area by source class (`wegdeel/voetgangersgebied`, `onbegroeidterreindeel`), m². */
  classes: Record<string, number>;
}
