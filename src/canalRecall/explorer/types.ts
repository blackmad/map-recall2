/**
 * The neighbourhood explorer's index (`extracts/amsterdam/explorer-index.json`,
 * written by `scripts/explorer/build-index.ts`). One compact row per modelled
 * building the game draws, so the explorer page can pin, list, search and open
 * them without loading the three model catalogues it is built from.
 */

/** landmark: curated landmark; ordinary: one-off large building; house: street-survey recipe house; block: block-face chunk. */
export type ExplorerKind = 'landmark' | 'ordinary' | 'house' | 'block';

export type LngLat = [number, number];

export interface ExplorerModel {
  id: string;
  kind: ExplorerKind;
  name: string;
  lngLat: LngLat;
  /** Neighbourhood name (smallest quiz boundary containing the anchor), or ELSEWHERE. */
  buurt: string;
  /** Page-relative URL of the full GLB. */
  glbUrl: string;
  /** Page-relative URL of the far LOD, when one is published. */
  lodUrl?: string;
  /** Size of the full GLB on disk. */
  bytes: number;
  triangles?: number;
  /** Bare BAG pand numbers (16 digits) the model stands in for. */
  pandIds: string[];
  /** English (or source-language) Wikipedia article for a landmark. */
  wiki?: string;
  /**
   * Present only when the model may not be redistributed (the 3D Warehouse
   * survey batch): the licence name, and `source` is where to get it instead.
   */
  restricted?: { licence: string; source: string; author: string };
}

export interface ExplorerBuurt {
  name: string;
  /** [west, south, east, north] over every outline of that name. */
  bbox: [number, number, number, number];
  count: number;
}

export interface ExplorerIndex {
  version: 1;
  generatedAt: string;
  buurten: ExplorerBuurt[];
  models: ExplorerModel[];
}

/** Buildings outside every quiz neighbourhood. */
export const ELSEWHERE = 'Elsewhere in Amsterdam';
