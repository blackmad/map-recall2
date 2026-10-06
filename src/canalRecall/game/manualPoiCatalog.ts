import { SIGNATURE_MODELS } from '../landmarks/signatureModels';
import facts from './manual-poi-data.json';
import type { LandmarkFeature } from './extracts';

const supplemental = new Map(facts.map(fact => [fact.modelId, fact]));

/** One physical asset may host several genuine venues; facade aliases are
 * identities for picking, not extra destinations. Existing extract content
 * and IDs remain intact so reviewed fact rotations continue to work. */
export function mergeManualPoiFeatures(features: readonly LandmarkFeature[], cityId = 'amsterdam'): LandmarkFeature[] {
  if (cityId !== 'amsterdam') return [...features];
  const merged = new Map(features.map(feature => [feature.id, { ...feature }]));
  for (const model of SIGNATURE_MODELS) {
    const fallback = supplemental.get(model.id);
    const anchor = model.surveyed?.anchor ?? model.footprint?.centre;
    if (!anchor) continue;
    const ids = [model.landmarkId, ...(model.relatedLandmarkIds ?? [])].filter(Boolean) as string[];
    // Muziekgebouw and Bimhuis have independent programmes and destination
    // identities. Other related IDs name the same place/building facade.
    const destinations = model.id === 'muziekgebouw-bimhuis' ? ids : ids.slice(0, 1);
    for (const id of destinations) {
      const existing = merged.get(id);
      merged.set(id, {
        ...existing,
        id,
        name: existing?.name || fallback?.name || model.name,
        // Explicit sourced corrections fix mislabeled neighbors or use a public entrance.
        center: (fallback?.destinationOverride?.center as LandmarkFeature['center'] | undefined) ?? existing?.center ?? (fallback?.center as LandmarkFeature['center'] | undefined) ?? [anchor[1], anchor[0]],
        routeCenter: (fallback?.routeDestination?.center as LandmarkFeature['routeCenter'] | undefined) ?? existing?.routeCenter,
        type: existing?.type || 'landmark',
        // A researched description can improve a generic mapped summary while preserving extract facts.
        funFact: existing?.funFact || (fallback?.preferDescription || !existing?.wikipediaExtract ? fallback?.description : undefined),
        sourceUrl: existing?.sourceUrl || fallback?.sourceUrl || model.attribution.sourceUrl,
        manualPoi: true,
        modelId: model.id,
        buildingIds: [...new Set([...(existing?.buildingIds ?? []), ...(model.suppressOsmIds ?? [])])],
        prominenceScore: Math.max(existing?.prominenceScore ?? 0, 220),
      });
    }
    // Suppress duplicate aliases in the pin/destination pool while allowing
    // delayed building joins to resolve those identities to the primary POI.
    if (model.id !== 'muziekgebouw-bimhuis') {
      for (const alias of ids.slice(1)) merged.delete(alias);
    }
  }
  return [...merged.values()];
}

export function manualPoiModelIds(): readonly string[] {
  return SIGNATURE_MODELS.map(model => model.id);
}

/** Curated route IDs are saved preferences, so retain them while making the
 * corresponding modeled destination one entry rather than two synonyms. */
export function manualPoiForCuratedId(id: string): string | undefined {
  return ({ central: 'centraal-station', 'anne-frank': 'anne-frank-house',
    rijksmuseum: 'rijksmuseum', nemo: 'nemo',
    palace: 'palace-on-the-dam', rembrandt: 'rembrandt-house', hart: 'hart-museum',
    westerkerk: 'westerkerk', mint: 'munttoren-amsterdam' } as Record<string, string>)[id];
}
