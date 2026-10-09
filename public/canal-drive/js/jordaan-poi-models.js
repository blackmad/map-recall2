/** Drop-in specifications for the existing SignatureLandmarks GLB layer.
 * Pass { models: await loadJordaanPoiSpecs(), onModelShown } to that layer.
 * The caller must suppress the corresponding BAG owner only AFTER onModelShown
 * fires. suppressBuildingIds is supplied separately from OSM suppression.
 * POI ids may be bound by the caller; these shops aren't in the landmark extract.
 */
export async function loadJordaanPoiSpecs({ poiIds = {}, mercator = window.maplibregl?.MercatorCoordinate } = {}) {
  const manifestUrl = new URL('../models/jordaan-pois/manifest.json', import.meta.url);
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`Jordaan model manifest: ${response.status}`);
  const { models } = await response.json();
  return models.map(model => ({
    id: model.id,
    name: model.name,
    landmarkId: poiIds[model.id] ?? `jordaan-poi-${model.id}`,
    modelUrl: new URL(`../models/jordaan-pois/${model.id}.glb`, import.meta.url).href,
    suppressOsmIds: [],
    suppressBuildingIds: [model.buildingId, `NL.IMBAG.Pand.${model.buildingId}`],
    groundAltitudeMetres: 0,
    facingOffsetDegrees: 0,
    surveyed: {
      anchor: model.anchor,
      ...(model.sourceRDFrame ? window.CanalRecallSignatureLandmarks.rdProjectedSurvey(model.sourceRDFrame, mercator) : {}),
      northOffsetDegrees: model.xAxisBearingDegrees - 90,
      source: `3DBAG owner ${model.buildingId}, frontage vertex; appearance interpreted from dated photos`,
    },
    attribution: {
      title: `${model.name}, ${model.address}`,
      author: 'Original Blender reconstruction for Map Recall',
      sourceUrl: new URL(`../models/jordaan-pois/${model.id}-full.jpg`, import.meta.url).href,
      licence: 'Original model; reference imagery provenance in manifest',
      licenceUrl: manifestUrl.href,
      modifications: 'Complete footprint, modelled roofline, upper openings and POI storefront. Unseen roof backs inferred.',
    },
  }));
}
