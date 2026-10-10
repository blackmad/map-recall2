/**
 * Building-type specification (`types/<type>.json`). Data, not code: the
 * generator interprets bays and openings; the counts and photo evidence that
 * justify them live next to them so a reviewer can check the JSON against
 * the panorama.
 */
import type {Slot} from './mesh.ts';

export type FacadeId = 'front' | 'back' | 'left' | 'right';
export const FACADE_IDS: FacadeId[] = ['front', 'back', 'left', 'right'];

/** Floors an element repeats on. Floor 0 is the ground storey; `upper` = 1..storeys-1. */
export type Levels = 'ground' | 'upper' | 'all' | number[];

export type ElementKind = 'window' | 'balcony' | 'door' | 'storageDoor' | 'vents' | 'panel' | 'ribbon';

export interface Element {
  kind: ElementKind;
  levels: Levels;
  /** Which bay edge `u` is measured from: the bay centre (default) or its left/right edge (u > 0 moves inwards). */
  ref?: 'centre' | 'left' | 'right';
  /** Offset of the element's centre from `ref`, metres. */
  u?: number;
  w?: number;
  h?: number;
  /** Bottom edge above the floor line of its level, metres (negative: centred on a stair landing). */
  sill?: number;
  /** Window lights (vertical mullions = lights - 1). */
  lights?: number;
  /** Balcony projection / box depth. */
  depth?: number;
  railing?: 'bars' | 'slats' | 'solid';
  /** Number of repeats for `vents`. */
  count?: number;
  /** Palette entry for panels. */
  colour?: string;
  /** Only in these cladding variants / in all but these. */
  variants?: string[];
  exceptVariants?: string[];
  /** Only when the ground storey is built this way (open pilotis vs closed storage cells). */
  groundModes?: ('solid' | 'pilotis')[];
  /** Door only: raised entrance steps. */
  steps?: number;
  note?: string;
}

export interface Bay {
  id: string;
  /** Relative width; the facade scales all bays to its real length. */
  w: number;
  role: 'balcony' | 'stair' | 'windows' | 'storage' | 'corner';
  /** Ground storey stays solid in this bay even for `ground.mode = pilotis`. */
  core?: boolean;
  elements: Element[];
}

export interface Evidence {
  /** Photo file in the scratchpad survey (type-N*.jpg) and the pand/address it shows. */
  photo: string;
  pand: string;
  address: string;
  note: string;
}

export interface FacadeSpec {
  confidence: 'measured' | 'partly-measured' | 'inferred';
  evidence: Evidence[];
  /** Counts written down from the photos, checked against the generated model by the test. */
  counted: {
    bays: number;
    /** Openings per upper storey (windows + glazed doors, not balconies). */
    openingsPerUpperStorey: number;
    /** Door/storage-door leaves on the ground storey. */
    groundDoors: number;
    balconiesPerUpperStorey: number;
  };
  bays: Bay[];
  /** Concrete-panel joints. */
  joints?: {panelW: number; panelH: number};
  /** Horizontal bands (e.g. white slab edges) as [vFromGroundStoreyTopOffset, height] pairs, in storey index (0 = ground floor line). */
  bands?: {floor: number; below: number; above: number; palette: string}[];
}

export interface Palette {
  wall: {slot: Slot; tint: string};
  /** Ground-storey wall when it differs (brick plinth under render). */
  plinth?: {slot: Slot; tint: string};
  frame: string;
  glass: string;
  door: string;
  /** Concrete slabs, surrounds, sills. */
  accent: string;
  rail: string;
  /** Balcony slab edge / dark fascia. */
  dark: string;
  /** Pilotis columns and white bands. */
  column: string;
  joint: string;
  roof: {slot: Slot; tint: string};
}

export interface Variant {
  label: string;
  /** Draw concrete-panel joints on the facades that declare them. */
  joints?: boolean;
  evidence: string;
  palette: Palette;
}

export interface RoofSpec {
  form: 'gable' | 'hip' | 'flat';
  /** Ridge direction relative to the long side when pitched (3DBAG decides per pand; this is the default). */
  ridge: 'long' | 'short';
  eavesOverhangM: number;
  vergeOverhangM: number;
  thicknessM: number;
  /** Fallback pitch when 3DBAG gives no ridge height. */
  pitchDeg: number;
}

export interface GroundSpec {
  mode: 'solid' | 'pilotis';
  /** Set back of the open ground storey behind the facade line (pilotis). */
  recessM?: number;
  columnPitchM?: number;
  columnM?: number;
  /** Storage doors in the recessed wall. */
  storageDoorW?: number;
}

export interface TypeSpec {
  id: string;
  label: string;
  source: {clusterRank: number; panden: number; bouwjaar: [number, number]; lengthM: number; widthM: number; bouwlagen: number; roof: 'pitched' | 'flat'; dwellingsMedian: number};
  /** Storeys incl. the ground storey, all below the eaves/roof edge. */
  storeys: number;
  roof: RoofSpec;
  ground: GroundSpec;
  defaultVariant: string;
  variants: Record<string, Variant>;
  facades: Record<FacadeId, FacadeSpec>;
  notes: string[];
}

export function validateSpec(spec: TypeSpec): string[] {
  const errors: string[] = [];
  if (!spec.variants[spec.defaultVariant]) errors.push(`defaultVariant ${spec.defaultVariant} not in variants`);
  for (const id of FACADE_IDS) {
    const f = spec.facades[id];
    if (!f) { errors.push(`facade ${id} missing`); continue; }
    if (!f.bays.length) errors.push(`${id}: no bays`);
    if (f.counted.bays !== f.bays.length) errors.push(`${id}: counted.bays ${f.counted.bays} != ${f.bays.length} bays`);
    if (!f.evidence.length) errors.push(`${id}: no evidence`);
    if (new Set(f.bays.map(b => b.id)).size !== f.bays.length) errors.push(`${id}: duplicate bay ids`);
    for (const b of f.bays) for (const e of b.elements) for (const v of [...(e.variants ?? []), ...(e.exceptVariants ?? [])]) if (!spec.variants[v]) errors.push(`${id}/${b.id}: unknown variant ${v}`);
  }
  if (spec.storeys < 2) errors.push('storeys < 2');
  return errors;
}
