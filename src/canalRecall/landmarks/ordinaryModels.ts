/** Source-reviewed ordinary shells use the same lazy loading/fallback as landmarks.
 * Their visual models do not create route destinations or trivia identities. */
import catalogue from '../../../public/canal-drive/ordinary-buildings-data/catalogue.json';
import type { SignatureModelSpec } from './signaturePlacement';
import { ordinaryEntryCategory } from '../buildingCategory';

export type Entry = {
  id: string; buildingId: string; name: string; anchor: [number, number];
  /** Taxonomy (buildingCategory.ts): one-off large building, or street-survey recipe house. Required. */
  category?: string;
  footprint: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  height: number; modelUrl: string; hash: string; sourceUrls?: string[];
  bounds: { min: number[]; max: number[] }; aliases?: string[];
  /** Recipe-pipeline houses: `modelUrl` is a shared GLB in its frontage frame, placed per house (see buildingRecipe/instances.ts). */
  instance?: { anchor: [number, number]; northOffsetDegrees: number; mirror: boolean };
};
const models = (catalogue as unknown as { models: Entry[] }).models;
export const ORDINARY_BUILDING_VERSIONS: Readonly<Record<string, string>> = Object.fromEntries(models.map(m => [m.id, m.hash]));
/** Catalogue entry → runtime spec. Legacy entries sit on their own origin; instance entries carry a frame placement and the shared-mesh flags. */
export const ordinarySpecFor = (m: Entry): SignatureModelSpec => ({
  id: m.id, assetKind: 'ordinary-building', buildingCategory: ordinaryEntryCategory(m), name: m.name, landmarkId: '',
  modelUrl: m.modelUrl, suppressOsmIds: [m.buildingId, ...(m.aliases ?? [])],
  spatialSuppression: false, buildingFootprint: m.footprint, heightMetres: m.height,
  heightToleranceMetres: .5, groundAltitudeMetres: 0, facingOffsetDegrees: 0,
  // Radius is used for visibility/loading only; suppression always uses exact IDs.
  footprint: { centre: m.anchor, headingDegrees: 90, lengthMetres: m.bounds.max[0] - m.bounds.min[0], widthMetres: m.bounds.max[2] - m.bounds.min[2] },
  ...(m.instance ? { sharedModel: true, ...(m.instance.mirror ? { mirror: true } : {}) } : {}),
  surveyed: { anchor: m.instance?.anchor ?? m.anchor, northOffsetDegrees: m.instance?.northOffsetDegrees ?? 0, source: 'Installed native footprint; source-specific facade and roof recipe. Heights/details retain documented approximations.' },
  attribution: { title: m.name, author: 'Map Recall', sourceUrl: m.sourceUrls?.[0] ?? 'https://data.amsterdam.nl/', licence: 'Original project asset', licenceUrl: './LICENSE', modifications: 'Original procedural facade patterns and shallow geometry on native surveyed footprints. No reference-photo pixels or imported model geometry. See ordinary building recipe for source/height uncertainties.' },
});
/** Every catalogue model (both categories): what the game draws. */
export const ORDINARY_BUILDINGS: readonly SignatureModelSpec[] = models.map(ordinarySpecFor);
/** One-off large non-landmark buildings (the ordinary-buildings gallery). */
export const ORDINARY_CATEGORY_BUILDINGS: readonly SignatureModelSpec[] = ORDINARY_BUILDINGS.filter(m => m.buildingCategory === 'ordinary');
/** Per-house recipe models (street surveys); a block-face chunk may supersede them in game. */
export const STREET_SURVEY_HOUSES: readonly SignatureModelSpec[] = ORDINARY_BUILDINGS.filter(m => m.buildingCategory === 'street-survey');
