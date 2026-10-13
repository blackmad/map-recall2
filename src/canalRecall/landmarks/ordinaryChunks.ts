/**
 * Street chunks in the ordinary-buildings layer. Retired by default (2026-10-13): `?streetChunks=1` draws them for
 * comparison, `?streetChunks=0` draws the per-house street-survey models they replaced. See `streetSurveyMode`.
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

export {pandIndexForFace} from '../streetChunks/extras.ts';

/**
 * How the game draws the street-survey work (block-face chunks and the per-house recipe models they replaced):
 * - `retired` (default since 2026-10-13): neither. The installed chunks rendered as near-black masses beside the
 *   generic extrusions (dark photo-measured tints, glass and slate, and under the shared frame's sun their stepped
 *   3DBAG rears in their own shadow), and the recipe tiles (`?recipeTiles=1`, src/canalRecall/tileBuildings/) are
 *   their successor. Their pands draw like their neighbours: no spec loads, so nothing suppresses them.
 * - `chunks` (`?streetChunks=1`): one mesh per block face, for comparison.
 * - `houses` (`?streetChunks=0`): the per-house recipe models, for the recipe-street specs.
 * The block-face recipe data (`faces/<id>/intent.json`) stays: it is the recipe tiles' input.
 */
export type StreetSurveyMode = 'retired' | 'chunks' | 'houses';

export function streetSurveyMode(search: string): StreetSurveyMode {
  const value = new URLSearchParams(search).get('streetChunks') ?? '';
  if (/^(1|true|on|yes)$/i.test(value)) return 'chunks';
  if (/^(0|false|off|no)$/i.test(value)) return 'houses';
  return 'retired';
}

/** `?streetChunks=1` only. */
export const streetChunksEnabled = (search: string): boolean => streetSurveyMode(search) === 'chunks';

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
    surveyed: {anchor: c.instance.anchor, northOffsetDegrees: c.instance.northOffsetDegrees, source: 'Street chunk: one mesh per block face, compiled from the houses\' intent recipes and 3DBAG LoD2.2.'},
    attribution: {title: c.name, author: 'Map Recall', sourceUrl: 'https://data.amsterdam.nl/', licence: 'Original project asset', licenceUrl: './LICENSE', modifications: 'Block face compiled from per-house recipes on native surveyed footprints; party walls between neighbours omitted.'},
  };
}

/**
 * Model list with the chunks applied: houses a chunk replaces are removed, the
 * chunks appended. A chunk whose houses are not all present in `models` still
 * applies (it replaces whichever are), because suppression is by pand id.
 */
export function applyStreetChunks(models: readonly SignatureModelSpec[], manifest: ChunkManifest | null | undefined): {models: SignatureModelSpec[]; replaced: Set<string>; chunks: SignatureModelSpec[]} {
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.chunks)) return {models: [...models], replaced: new Set(), chunks: []};
  const replaced = new Set<string>(manifest.chunks.flatMap(c => c.replaces));
  const chunks = manifest.chunks.map(chunkSpecFor);
  return {models: [...models.filter(m => !replaced.has(m.id)), ...chunks], replaced, chunks};
}
