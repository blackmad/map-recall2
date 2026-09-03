// What the Canal Recall page needs from the signature-landmark modules,
// bundled into one global. The placement arithmetic is typed and tested; the
// browser side is a painting adapter that reads what this exposes.

export {
  fitOrientedFootprint,
  footprintClipFeature,
  footprintPolygon,
  metresBetween,
  metresPerDegreeLongitude,
  modelExtent,
  normaliseBearing,
  offsetByMetres,
  placementFor,
  scaledExtent,
  scaleToFootprintWidth,
  scaleToHeight,
  pointInRing,
} from './signaturePlacement';

export type {
  LatLng,
  LngLat,
  ModelBounds,
  OrientedFootprint,
  ScaledExtent,
  SignatureModelAttribution,
  SignatureModelSpec,
  SignaturePlacement,
} from './signaturePlacement';

export { SIGNATURE_MODELS, signatureModel, suppressedOsmIds } from './signatureModels';

// Main's basemap suppression, re-exported so the signature layer can hide the
// extrusions it replaces with the same mechanism the rest of the game uses.
export { basemapBuildingFilter, encodeBasemapBuildingId } from '../buildingStyle';
