// The curated list. One entry per building worth recognising on sight.
//
// Nine of these are the City of Amsterdam's own survey models, so the bulk of
// each entry — where the building is, which landmark it answers to, what its
// OSM footprint measures — is generated into `surveyedLandmarks.json` by
// `fetch-3dwarehouse-landmarks.ts` rather than typed out. What stays here is
// what no fetch can decide: which way a facade points, how tall a building is
// where the number is worth asserting, and the licence it ships under.
//
// PROTOTYPE: these are used under the 3D Warehouse General Model License,
// which covers a Combined Work but not redistributing an asset library. That
// question is parked, not answered — see TODO.md before this goes anywhere
// public.

import surveyedCatalogue from './surveyedLandmarks.json';
import type { LngLat, OrientedFootprint, SignatureModelSpec } from './signaturePlacement';

interface SurveyedCatalogueEntry {
  id: string;
  name: string;
  warehouseId: string;
  landmarkId: string;
  landmarkName: string | null;
  address: string | null;
  anchor: [number, number];
  anchorToLandmarkMetres: number | null;
  footprint: OrientedFootprint | null;
}

/**
 * Height assertions, in metres to the highest point, for the buildings where
 * the number is worth pinning.
 *
 * Only filled in where there is something to check against. The Palace is the
 * case that earned it: Dutch Wikipedia and Wikidata both claim 90 m for a
 * building whose own survey puts the main stone mass at 51.9 m and the rooster
 * on the weathervane at 60.9 m. A surveyed model is placed at scale 1, so a
 * height that disagrees with the survey means the wrong file rather than a bad
 * fit — which is exactly the failure worth catching.
 */
const EXPECTED_HEIGHTS: Readonly<Record<string, { metres: number; tolerance: number }>> = {
  'palace-on-the-dam': { metres: 60.9, tolerance: 1.5 },
};

/**
 * Which way each building's front faces, as a compass bearing.
 *
 * Not used to place a surveyed model — it arrives already turned correctly —
 * but it is the human-checkable fact about each one, and the thing a reviewer
 * can disagree with. "The Palace faces east onto the Dam" is verifiable; "the
 * mesh is north-up" is not. Values are approximate to the nearest degree and
 * several are unverified guesses; the check script is where they should
 * eventually be pinned against the OSM footprint's long axis.
 */
const FACADE_BEARINGS: Readonly<Record<string, number>> = {
  'palace-on-the-dam': 91, // east, onto the Dam
  'centraal-station': 187, // south, down the Damrak
  'rijksmuseum': 13, // north, towards the city
  'westerkerk': 93, // east, onto the Prinsengracht
  'oude-kerk': 93, // east, onto the Oudekerksplein
  'de-beurs-van-berlage': 97,
  'nemo': 250,
  'stadhuis': 270,
  'national-monument-on-the-dam': 271,
};

const WAREHOUSE_LICENCE = {
  author: 'City of Amsterdam, Geo- en Vastgoedinformatie',
  licence: '3D Warehouse General Model License',
  licenceUrl: 'https://3dwarehouse.sketchup.com/tos/',
  modifications:
    'Cleaned up for the web, not changed artistically: SketchUp construction edges removed, '
    + 'faces made double-sided so inward-facing normals stop rendering black, all materials set '
    + "non-metallic (they arrive at glTF's default metallicFactor 1.0, which renders black with "
    + "no environment map), unpainted faces darkened from SketchUp's near-white, spare UV sets "
    + 'and tangents dropped, textures re-encoded as WebP, geometry quantized and '
    + "meshopt-compressed. Placed at the city's own published coordinate at its surveyed size, "
    + 'unscaled and unrotated.',
} as const;

function specFromCatalogue(entry: SurveyedCatalogueEntry): SignatureModelSpec {
  const height = EXPECTED_HEIGHTS[entry.id];
  return {
    id: entry.id,
    name: entry.name,
    landmarkId: entry.landmarkId,
    modelUrl: `./models/${entry.id}.glb`,
    // Nothing to list: suppression works by biasing the model towards the
    // camera, because this basemap batches its building features and they
    // cannot be filtered. See `signature-landmarks-source.js`.
    suppressOsmIds: [],
    footprint: entry.footprint ?? undefined,
    heightMetres: height?.metres,
    heightToleranceMetres: height?.tolerance,
    groundAltitudeMetres: 0,
    facingOffsetDegrees: FACADE_BEARINGS[entry.id] ?? 0,
    surveyed: {
      anchor: entry.anchor as unknown as LngLat,
      northOffsetDegrees: 0,
      source: `3D Warehouse entity ${entry.warehouseId}, geo attribute`,
    },
    attribution: {
      title: entry.name,
      author: WAREHOUSE_LICENCE.author,
      sourceUrl: `https://3dwarehouse.sketchup.com/model/${entry.warehouseId}`,
      licence: WAREHOUSE_LICENCE.licence,
      licenceUrl: WAREHOUSE_LICENCE.licenceUrl,
      modifications: WAREHOUSE_LICENCE.modifications,
    },
  };
}

export const SIGNATURE_MODELS: readonly SignatureModelSpec[] =
  (surveyedCatalogue as SurveyedCatalogueEntry[]).map(specFromCatalogue);

/** Looks up a spec by id. */
export function signatureModel(id: string): SignatureModelSpec | undefined {
  return SIGNATURE_MODELS.find(model => model.id === id);
}

/** Every OSM footprint that a signature model stands in for. */
export function suppressedOsmIds(): number[] {
  return SIGNATURE_MODELS.flatMap(model => [...model.suppressOsmIds]);
}
