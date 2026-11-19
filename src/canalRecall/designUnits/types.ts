/**
 * Design units (docs/handoffs/design-units-plan-20261119.md, tool T1): one building as designed, over one or many BAG
 * pands. The unit, not the pand, is the unit of identity, drawing, review and coverage.
 *
 * Sources, strongest first:
 *   - `ordekaart`: an object of the Gemeente's ordekaart layers (Monumenten en Archeologie; open geodata, archived in
 *     map-recall2-source-data datasets/ordekaart-20261119) holds most of the pand's footprint;
 *   - `inferred`: no object covers the pand, and a deterministic rule joined it to party-wall neighbours (inference.ts);
 *   - `single`: the pand on its own.
 *
 * A single-pand unit keeps the pand id as its seed, so anything seeded by unit draws exactly as it does by pand today;
 * only multi-pand units change seed. Types and constants only. Pure: no fs, no DOM.
 */

export type LngLat = readonly [number, number];
export type Ring = readonly LngLat[];
/** Polygons, each an outer ring then holes (GeoJSON order, lng/lat). */
export type Polygons = readonly (readonly Ring[])[];

export const ORDEKAART_LAYERS = ['centrum', 'ring', 'gordel', 'aup'] as const;
export type OrdekaartLayer = (typeof ORDEKAART_LAYERS)[number];

/** The layer name and theme of each layer at maps.amsterdam.nl/open_geodata/geojson_lnglat.php. */
export const ORDEKAART_SOURCES: Readonly<Record<OrdekaartLayer, { kaartlaag: string; thema: string }>> = {
  centrum: { kaartlaag: 'ORDE_CENTRUM_GEBOUWEN', thema: 'ordekaart_centrum' },
  ring: { kaartlaag: 'ORDE_RING_GEBOUWEN', thema: 'ordekaart_ring' },
  gordel: { kaartlaag: 'ORDE_GORDEL_GEBOUWEN', thema: 'ordekaart_gordel' },
  aup: { kaartlaag: 'ORDE_AUP_GEBOUWEN', thema: 'ordekaart_aup' },
};

/** One ordekaart object: a building as designed, judged by heritage order (1, 2, 3, Basis, 99; AUP also Sloop). */
export interface OrdekaartObject {
  /** `<layer>:<Objectnummer>`. */
  key: string;
  layer: OrdekaartLayer;
  objectnummer: number;
  orde: string;
  architectNr: number | null;
  architect: string | null;
  year: number | null;
  gebied: string | null;
  polygons: Polygons;
}

/** A pand as the join needs it (BAG footprint from the base tiles, BAG year, 3DBAG eaves and height). */
export interface UnitPand {
  /** 16-digit BAG id (no `NL.IMBAG.Pand.` prefix). */
  id: string;
  ring: Ring;
  year: number | null;
  eavesM: number | null;
  heightM: number | null;
  roofCode?: number | null;
}

/** A member's slice of a unit's frontage on one street, in metres along the unit's front, left to right from the street. */
export interface FrontSlice {
  pandId: string;
  fromM: number;
  toM: number;
}
export interface UnitFace {
  street: string;
  /** Unit front length on this street: the last slice's end (m). */
  lengthM: number;
  slices: FrontSlice[];
}

export const UNIT_SOURCES = ['ordekaart', 'inferred', 'single'] as const;
export type UnitSource = (typeof UNIT_SOURCES)[number];

export interface FamilyKey {
  architectNr: number | null;
  year: number | null;
  /** Median member front length, to 0.5 m: the repeated house module of a designed row. Null with no front. */
  moduleM: number | null;
}

export interface DesignUnit {
  /** `du:<layer>:<objectnummer>`, `du:inf:<lowest pand id>`, or the pand id for a single. */
  id: string;
  /** What per-unit priors hash on: the pand id for a one-pand unit (byte-identical to today), else the unit id. */
  seed: string;
  source: UnitSource;
  /** Members, sorted by id. */
  members: string[];
  object?: { key: string; orde: string; year: number | null; architectNr: number | null; architect: string | null };
  faces: UnitFace[];
  /** Members with no street front (rear buildings, courtyard wings). */
  unfronted: string[];
  family: FamilyKey;
  /** `<architectNr|?>/<year|?>/<moduleM|?>`. */
  familyKey: string;
  flags: string[];
}

/** A pand's overlap with the objects it touches: share of the pand's own footprint area inside each object. */
export interface PandOverlap {
  pandId: string;
  areaM2: number;
  hits: Array<{ key: string; share: number }>;
}
