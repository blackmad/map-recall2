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
  attribution: { title: m.name, author: 'Ride Amsterdam', sourceUrl: m.sourceUrls?.[0] ?? 'https://data.amsterdam.nl/', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', modifications: 'Original procedural facade patterns and shallow geometry on native surveyed footprints. No reference-photo pixels or imported model geometry. See ordinary building recipe for source/height uncertainties.' },
});
/** Catalogue installs whose pand a bespoke landmark model already draws: the landmark wins and the install is not drawn
 * (both drew on the same ground). Keyed by ordinary id, valued by the landmark id; modelOverlap.test.ts pins each pair. */
export const SHADOWED_BY_LANDMARK: Readonly<Record<string, string>> = {
  // Politiebureau IJ-tunnel 2 (2026-10-13 large recipe) is the same 1972 pand as Brandweerkazerne Nico (2026-10-09),
  // which models every side; the install left three sides blank. Found 2026-10-16 by the overlap check.
  'ordinary-0363100012165618': 'fire-station-nico',
  // Marnixstraat car park (2026-10-13 large recipe): its ribbon windows were 18 cm holes in the 3DBAG shell and the ramp
  // drums plain cylinders; the bespoke Europarking model (2026-10-17) draws the banded drums, deck block and Waterkant.
  'ordinary-0363100012185422': 'europarking-marnixstraat',
  // Ziggo Dome (2026-10-06 ordinary tall-box recipe): one ribbed box without the window rows, docks, roof plant or bridges;
  // the bespoke model (#191, 2026-11-02) draws them.
  'ordinary-0363100012238052': 'ziggo-dome',
  // Rietveld building (2026-10-17 large recipe): one 39 m curtain ribbon against the photo's 2.1 m square modules; the bespoke model (#205) draws them.
  'ordinary-0363100012077325': 'gerrit-rietveld-academie',
  // Heinekenplein block (large recipe failed the likeness judge on its east wall and drew the office tower blank; bespoke #207).
  'ordinary-0363100012130580': 'heinekenplein-block',
  // Tetterode complex, Da Costakade 146 (large recipe: one 82 x 94 m block; the bespoke model (#209) draws the 1902 factory front,
  // the dairy, the 1909 lettered range and the Merkelbach & Karsten ribbons).
  'ordinary-0363100012236799': 'da-costakade-146',
};
/** Every catalogue model (both categories) that no landmark shadows: what the game draws. */
export const ORDINARY_BUILDINGS: readonly SignatureModelSpec[] = models.filter(m => !SHADOWED_BY_LANDMARK[m.id]).map(ordinarySpecFor);
/** One-off large non-landmark buildings (the ordinary-buildings gallery). */
export const ORDINARY_CATEGORY_BUILDINGS: readonly SignatureModelSpec[] = ORDINARY_BUILDINGS.filter(m => m.buildingCategory === 'ordinary');
/** Per-house recipe models (street surveys); a block-face chunk may supersede them in game. */
export const STREET_SURVEY_HOUSES: readonly SignatureModelSpec[] = ORDINARY_BUILDINGS.filter(m => m.buildingCategory === 'street-survey');
