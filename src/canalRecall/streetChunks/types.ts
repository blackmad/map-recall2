/**
 * Street chunks: one mesh per block face (a run of adjacent panden along one
 * side of a street) built from the houses' intent recipes, with the party walls
 * between neighbours omitted and per-pand metadata kept as glTF extras.
 *
 * Coordinates: the chunk frame (see buildingRecipe/instances.ts `FrontFrame`):
 * origin on the frontage, +X along the street left to right as seen from the
 * street, +Y up, +Z outward (towards the street).
 */
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import type {CanalHouseIntent} from '../buildingRecipe/intent.ts';

export type P2 = [number, number];

/** One house of a block face, as the recipe pipeline holds it. */
export interface ChunkHouseInput {
  /** Recipe id, e.g. `bilder-155417`. */
  id: string;
  intent: CanalHouseIntent;
  facts: BuildingFacts;
}

/** A triangle bucket for one material: flat arrays, 9 position / 9 normal / 6 uv numbers per triangle. */
export interface Bucket {
  /** `<hex>_<slot>`: same colour + slot share a glTF material. */
  key: string;
  slot: string;
  tint: string;
  surface: string;
  positions: number[];
  normals: number[];
  uvs: number[];
}

export type BucketMap = Map<string, Bucket>;

export interface ChunkOptions {
  /** Chunk id, used for the node/mesh/file name. */
  name: string;
  /** Re-ground every house on one street level (median 3DBAG ground height) when the shift is below this. 0 disables. */
  maxRegroundM?: number;
  /** Snap neighbouring eaves within this step to one cornice height. 0 disables. */
  eavesSnapStepM?: number;
  /** Snapped cluster may not span more than this. */
  eavesSnapSpanM?: number;
  /** Drop party walls (default true). False builds the same merged mesh with every wall kept (the "before" control). */
  trimPartyWalls?: boolean;
  /** Footprint edges closer than this are one party wall. */
  partyToleranceM?: number;
}

export interface PartyContactReport {
  a: string;
  b: string;
  lengthM: number;
  /** Wall area (m2) removed from `a` because `b` covers it. */
  removedAreaA: number;
  /** Wall area of `a` kept along this contact because it stands above `b` (exposed party wall). */
  exposedAreaA: number;
  /** Highest point of `a`'s and `b`'s wall along the contact, metres. */
  topA: number;
  topB: number;
  /** Partly covered faces left uncut because cutting would add triangles. */
  keptWhole: number;
}

export interface JointReport {
  left: string;
  right: string;
  /** Distance along the street between the facade ends (0 = they meet). */
  lateralGapM: number;
  /** Difference of the facade planes' depth at the joint (frontage jog). */
  depthStepM: number;
  /** Eaves/cornice height difference before and after alignment, metres. */
  eavesStepBeforeM: number;
  eavesStepAfterM: number;
  /** True when the two houses share a footprint vertex at the front, so no gap can open between them. */
  sharedFrontVertex: boolean;
}

export interface PandRange {
  /** Index of the glTF primitive. */
  primitive: number;
  /** First triangle and count within that primitive (index buffer range = x3). */
  firstTriangle: number;
  triangleCount: number;
}

export interface PandMeta {
  recipeId: string;
  pandId: string;
  buildingId: string;
  address: string;
  /** Intent source images/ids, so review can reach the recipe. */
  sources: string[];
  /** Frontage extent along the chunk X axis, metres. */
  frontage: {x0: number; x1: number; widthM: number};
  /** Chunk-frame bounds of the pand's triangles. */
  bounds: {min: number[]; max: number[]};
  triangles: number;
  ranges: PandRange[];
  /** BAG footprint (outer ring of each polygon) in lng/lat, for suppression/hover geometry. */
  footprint: number[][][];
  /** Eaves height used for the cornice (chunk frame, metres above the chunk ground). */
  eavesM: number;
  groundShiftM: number;
}

export interface ChunkReport {
  name: string;
  houses: number;
  /** Triangle counts. `individual` = the same houses compiled one by one, `merged` = one mesh, nothing dropped. */
  triangles: {individual: number; merged: number; chunk: number; partyWallDropped: number};
  primitives: {individual: number; chunk: number};
  bytes: {individual: number; chunk: number};
  gzipBytes: {individual: number; chunk: number};
  partyWalls: PartyContactReport[];
  joints: JointReport[];
  ground: {sharedNapM: number; shiftsM: Record<string, number>};
  eaves: {before: Record<string, number>; after: Record<string, number>; clusters: string[][]};
  warnings: string[];
  timingsMs: {compile: number; trim: number; write: number};
}

export interface ChunkResult {
  name: string;
  /** Houses in street order (increasing X). */
  order: string[];
  glb: Uint8Array;
  pands: PandMeta[];
  frame: {midRD: P2; uRD: P2; nRD: P2; anchor: [number, number]; northOffsetDegrees: number};
  report: ChunkReport;
}
