// Retail fit (lane retail-fit-20261120, `?retailFit=1`): a tenant expresses itself INSIDE the building's own openings —
// glass fill, interior colour and goods, vinyl, lettering on the glass or in an arch head, a small lettered panel, a
// door — never with a fascia box pasted over the architecture. David's Hirschgebouw photo (Leidseplein 25, pand
// 0363100012165488): a stone arcade whose arches each hold one tenant's window or door (the Rijksmuseum shop's blue
// Delft vinyl, Albert Heijn's name in an arch head, Apple's clear glass and wood tables).
//
// Pure data: Node (frames, tests), the browser adapter (three.ts) and the node-frame adapter read the same records.

/** A model-space point in the GLB's own frame: x east-ish, y up, z south-ish (glTF axes), metres. */
export type V3 = [number, number, number];

/** An opening's head: flat lintel, segmental, or a round (semicircular or elliptical) arch. */
export type FitHead = 'flat' | 'segmental' | 'round';

/**
 * One opening of the host's ground storey, found on (or stated for) the host's own glass: its front plane, the reader's
 * frame (t = the reader's right facing the wall from outside, n = outward, y up) and its outline.
 */
export interface HostOpening {
  /** Stable within a model: `<bearing>:<u-centre>` rounded, for logs and tests. */
  id: string;
  /** Centre of the opening's bottom edge on the glass front plane, model space. */
  base: V3;
  /** Unit outward normal, horizontal (x, z). */
  n: [number, number];
  /** Unit tangent, the reader's right (x, z). */
  t: [number, number];
  widthM: number;
  /** Bottom of the glass (m above the model's ground). */
  sillM: number;
  /** Where the head starts to curve (= crownM for a flat head). */
  springM: number;
  /** Top of the opening. */
  crownM: number;
  head: FitHead;
  /** Compass bearing of the outward normal (degrees, 0 = north), for reading and matching fronts. */
  bearing: number;
  /** Glass area found (m2), a confidence hint. */
  areaM2: number;
}

/**
 * The in-opening vocabulary (docs/reports/retail-fit-20261120.md). Every layer stays inside its opening's outline;
 * nothing here can draw a fascia box over the host's piers, spandrels or archivolts.
 */
export type FitLayer =
  /** The lit room behind clear glass: a flat colour over the opening (`v0`/`v1` metres above the sill, default all). */
  | { k: 'interior'; hex: string; v0?: number; v1?: number }
  /** Goods seen through the glass: shop tables (Apple), shelving rows (a supermarket), clothes rails, seats. */
  | { k: 'goods'; kind: 'tables' | 'shelves' | 'rails' | 'seats' | 'curtains'; hexes: string[] }
  /** Pendant lamps hanging in the opening's upper glass. */
  | { k: 'lamps'; hex: string; n?: number }
  /** Window vinyl over the glass: a solid colour or a printed pattern (Delft blue on white), with an optional clear
   *  window cut out of it (fractions of the opening's width, metres above the sill). */
  | { k: 'vinyl'; base: string; ink?: string; light?: string; pattern?: 'solid' | 'delft' | 'landscape'; window?: [number, number, number, number]; windowHex?: string; windowGoods?: string[] }
  /** A lettered band inside the opening (a vinyl strip or small board): metres above the sill, text in `ink`. */
  | { k: 'band'; hex: string; v0: number; v1: number; text?: string; ink?: string; inset?: number }
  /** Letters in the arch head (the lunette over the transom), on the glass. */
  | { k: 'head-letters'; text: string; ink: string; bg?: string }
  /** Letters (and an optional square mark) on the glass at `v` metres above the sill. */
  | { k: 'glass-letters'; text: string; ink: string; v: number; heightM?: number; mark?: string }
  /** An opaque infill panel (a bank's ATM wall), with ATM boxes and small letters. */
  | { k: 'panel'; hex: string; atms?: number; text?: string; ink?: string }
  /** A door in the opening: its frame and leaves (glass doors stay glass). */
  | { k: 'door'; hex: string; leaves: 1 | 2 }
  /** The opening's joinery: a frame round the glass, a transom at the springing, mullions. */
  | { k: 'frame'; hex: string; transom?: boolean; mullions?: number }
  /** Posters / promotion sheets stuck inside the glass. */
  | { k: 'posters'; hex: string; n: number };

/** One tenant in one opening of one placed model. */
export interface TenantFit {
  /** The placed model (catalogue id). */
  model: string;
  /** The opening: the point (lng, lat) nearest its centre, from an OSM entrance/shop node or a panorama read. */
  at: [number, number];
  tenant: string;
  layers: FitLayer[];
  /** Evidence: an OSM element, a panorama id + date, a URL. */
  source: string;
}

/** One coloured triangle soup in model space (normals per vertex, sRGB hex per triangle resolved to linear RGB). */
export interface FitMesh { positions: Float32Array; normals: Float32Array; colors: Float32Array; triangles: number }
