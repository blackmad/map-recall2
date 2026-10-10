/**
 * Building taxonomy (docs/buildings-pipeline.md "Building categories").
 *
 *   landmark      — the curated landmark list (surveyed 3D Warehouse batch +
 *                   manualCatalogue.json entries). The ONLY category that may
 *                   create destinations, cards, discovery, quiz and What's new
 *                   landmark counts, or route candidates.
 *   ordinary      — one-off, medium-fidelity reconstructions of large
 *                   non-landmark buildings (offices, warehouses, Haparandaweg
 *                   residential blocks). Rendered in the game; never a POI.
 *   street-survey — the repetitive canal-house / block-face work whose aim is
 *                   reusable geometry: block faces (scripts/block-face/faces),
 *                   per-house recipes installed by scripts/building-recipes/
 *                   install.ts, and street chunks. Rendered; never a POI.
 *
 * The category is recorded in the source data: `category` on every
 * ordinary-buildings-data/catalogue.json entry and chunks.json entry, and on
 * manualCatalogue.json entries that are not landmarks (absent = landmark).
 */

export const BUILDING_CATEGORIES = ['landmark', 'ordinary', 'street-survey'] as const;
export type BuildingCategory = typeof BUILDING_CATEGORIES[number];

export const isBuildingCategory = (value: unknown): value is BuildingCategory =>
  typeof value === 'string' && (BUILDING_CATEGORIES as readonly string[]).includes(value);

/** Category of a manualCatalogue.json / ALL_MANUAL_LANDMARKS entry: landmark unless it says otherwise. */
export function manualEntryCategory(entry: {category?: unknown}): BuildingCategory {
  if (entry.category === undefined) return 'landmark';
  if (!isBuildingCategory(entry.category)) throw new Error(`Unknown building category ${String(entry.category)}`);
  return entry.category;
}

/** Category of an ordinary-buildings catalogue entry. The field is required there: a missing one is a data error. */
export function ordinaryEntryCategory(entry: {id?: string; category?: unknown}): Exclude<BuildingCategory, 'landmark'> {
  if (entry.category === 'ordinary' || entry.category === 'street-survey') return entry.category;
  throw new Error(`ordinary-buildings catalogue entry ${entry.id ?? '?'} has no ordinary/street-survey category (${String(entry.category)})`);
}

/** Only landmarks may become destinations, cards, quiz items or What's new landmark counts. */
export const countsAsLandmark = (spec: {buildingCategory?: BuildingCategory}): boolean =>
  (spec.buildingCategory ?? 'landmark') === 'landmark';

export const CATEGORY_LABEL: Readonly<Record<BuildingCategory, string>> = {
  landmark: 'Landmark',
  ordinary: 'Ordinary building',
  'street-survey': 'Street survey',
};
