/**
 * Street chunks in the ordinary-buildings layer. Drawn by default again since 2026-10-16 (retired 2026-10-13 to
 * 2026-10-16); `?streetChunks=0` draws the per-house street-survey models they replaced. See `streetSurveyMode`.
 *
 * `ordinary-buildings-data/chunks.json` (see streetChunks/manifest.ts) lists
 * block-face GLBs. Each becomes ONE spec: the GLB in its frontage frame placed
 * like a shared house mesh, suppressing every pand it covers. The per-house
 * specs a chunk replaces are dropped from the model list so no house is drawn
 * twice; hover resolves the pand under the cursor from the glTF extras
 * (`pandIndexForFace`). With `?streetChunks=0`, or the manifest missing, nothing
 * changes.
 */
import type {ChunkManifest, ChunkManifestEntry} from '../streetChunks/manifest.ts';
import type {SignatureModelSpec} from './signaturePlacement';
import {chunkWallExposure} from '../look/chunkWallExposure.ts';

export {pandIndexForFace} from '../streetChunks/extras.ts';

/**
 * How the game draws the street-survey work (block-face chunks and the per-house recipe models they replaced):
 * - `chunks` (default since 2026-10-16, user: "what things are behind flags that we should make default?"): one mesh
 *   per block face. They were retired on 2026-10-13 as near-black masses; the sunny look and chunkWallExposure.ts
 *   (walls at their photo colour normalised to sunlight) fixed that, except the faces in DEFAULT_HELD_CHUNKS.
 * - `retired` (`?streetChunks=retired`): neither; their pands draw like their neighbours.
 * - `houses` (`?streetChunks=0`): the per-house recipe models, for the recipe-street specs.
 * `?streetChunks=1` draws every installed chunk, the held ones included.
 */
export type StreetSurveyMode = 'retired' | 'chunks' | 'houses';

/** Installed chunks the default leaves out (2026-10-16): Oudezijds Voorburgwal 115-125 still draws as a black
 *  block on its shade side (87-89 % of wall pixels under luma 60 against 29 % in its photo; docs/chunk-brightness-20261016.md). */
export const DEFAULT_HELD_CHUNKS: ReadonlySet<string> = new Set(['chunk-face-wallen-ozv-115-125']);

export function streetSurveyMode(search: string): StreetSurveyMode {
  const value = new URLSearchParams(search).get('streetChunks') ?? '';
  if (/^(0|false|off|no|houses)$/i.test(value)) return 'houses';
  if (/^retired$/i.test(value)) return 'retired';
  return 'chunks';
}

/** Chunks draw unless `?streetChunks=0` or `=retired`. */
export const streetChunksEnabled = (search: string): boolean => streetSurveyMode(search) === 'chunks';

/** The chunks this page leaves out: DEFAULT_HELD_CHUNKS unless `?streetChunks=1` asks for every one. */
export const heldStreetChunks = (search: string): ReadonlySet<string> =>
  /^(1|true|on|yes)$/i.test(new URLSearchParams(search).get('streetChunks') ?? '') ? new Set() : DEFAULT_HELD_CHUNKS;

/** Model list without the street-survey category (the retired default). Landmarks and one-off ordinary buildings stay. */
export const withoutStreetSurveys = (models: readonly SignatureModelSpec[]): SignatureModelSpec[] =>
  models.filter(m => m.buildingCategory !== 'street-survey');

export function chunkSpecFor(c: ChunkManifestEntry): SignatureModelSpec {
  const length = c.bounds.max[0] - c.bounds.min[0], width = c.bounds.max[2] - c.bounds.min[2];
  return {
    id: c.id, assetKind: 'ordinary-building', buildingCategory: 'street-survey', name: c.name, landmarkId: '',
    modelUrl: c.modelUrl, suppressOsmIds: [...c.suppress], spatialSuppression: false,
    buildingFootprint: c.footprint, heightMetres: c.height, heightToleranceMetres: 0.5, groundAltitudeMetres: 0, facingOffsetDegrees: 0,
    // Radius is used for visibility/loading only; suppression always uses exact IDs.
    footprint: {centre: c.instance.anchor, headingDegrees: 90, lengthMetres: length, widthMetres: Math.max(width, 1)},
    // Per-pand footprints (Polygon coordinates), for hover.
    chunkPands: c.pands.map((p, i) => ({buildingId: p.buildingId, address: p.address, footprint: c.footprint.coordinates[i]})),
    // Its walls were matched to the face's photo strip: the sunny look draws them at the strip colour normalised to sunlight.
    wallExposure: chunkWallExposure(c.name),
    surveyed: {anchor: c.instance.anchor, northOffsetDegrees: c.instance.northOffsetDegrees, source: 'Street chunk: one mesh per block face, compiled from the houses\' intent recipes and 3DBAG LoD2.2.'},
    attribution: {title: c.name, author: 'Map Recall', sourceUrl: 'https://data.amsterdam.nl/', licence: 'Original project asset', licenceUrl: './LICENSE', modifications: 'Block face compiled from per-house recipes on native surveyed footprints; party walls between neighbours omitted.'},
  };
}

/**
 * Model list with the chunks applied: houses a chunk replaces are removed, the
 * chunks appended. A chunk whose houses are not all present in `models` still
 * applies (it replaces whichever are), because suppression is by pand id.
 */
/** A held chunk is not drawn and neither are the per-house models it replaced: its pands draw as their neighbours. */
export function applyStreetChunks(models: readonly SignatureModelSpec[], manifest: ChunkManifest | null | undefined, held: ReadonlySet<string> = new Set()): {models: SignatureModelSpec[]; replaced: Set<string>; chunks: SignatureModelSpec[]} {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.chunks)) return {models: [...models], replaced: new Set(), chunks: []};
  const replaced = new Set<string>(manifest.chunks.flatMap(c => c.replaces));
  const chunks = manifest.chunks.filter(c => !held.has(c.id)).map(chunkSpecFor);
  return {models: [...models.filter(m => !replaced.has(m.id)), ...chunks], replaced, chunks};
}
