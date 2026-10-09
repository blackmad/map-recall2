import { SIGNATURE_MODELS } from '../landmarks/signatureModels';
import facts from './manual-poi-data.json';
import type { LandmarkFeature } from './extracts';

type SupplementalFact = Omit<typeof facts[number], 'destinations'> & {
  destinations?: readonly { landmarkId: string; name?: string; center?: number[]; description?: string; funFact?: string; sourceUrl?: string; preferDescription?: boolean; routeDestination?: { center: number[] }; destinationOverride?: { center: number[] } }[];
};
const supplemental = new Map<string, SupplementalFact>(facts.map(fact => [fact.modelId, fact]));
const additiveHostsByPoi = new Map<string, Set<string>>();
for (const model of SIGNATURE_MODELS) {
  const hosts = new Set(model.hostWallOpenings?.map(opening => opening.hostIdentity)
    .filter(id => !model.suppressOsmIds.includes(id)));
  if (!hosts.size) continue;
  for (const id of [model.landmarkId, ...(model.relatedLandmarkIds ?? []), ...(model.destinationLandmarkIds ?? [])]) {
    if (id) additiveHostsByPoi.set(id, hosts);
  }
}

/** An additive facade asset occupies its own mesh, not its entire host Pand.
 * The extract's containment join can still identify the host; discard that
 * association for physical building clicks and ordinary-building highlights. */
export function manualPoiBuildingIds(landmarkId: string, ids: readonly string[]): string[] {
  const hosts = additiveHostsByPoi.get(landmarkId);
  return [...new Set(ids)].filter(id => !hosts?.has(id));
}

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
    // Explicit venue IDs remain independent destinations within a shared mesh.
    // The legacy concert-hall pair retains its existing behavior.
    const destinations = model.destinationLandmarkIds ?? (model.id === 'muziekgebouw-bimhuis' ? ids : ids.slice(0, 1));
    for (const id of destinations) {
      const venue=fallback?.destinations?.find(p=>p.landmarkId===id);
      const specific=venue??fallback;
      const existing = merged.get(id);
      merged.set(id, {
        ...existing,
        id,
        name: existing?.name || specific?.name || model.name,
        // Explicit sourced corrections fix mislabeled neighbors or use a public entrance.
        center: (specific?.destinationOverride?.center as LandmarkFeature['center'] | undefined) ?? existing?.center ?? (specific?.center as LandmarkFeature['center'] | undefined) ?? [anchor[1], anchor[0]],
        routeCenter: ((venue?.routeDestination?.center ?? (id===model.landmarkId ? fallback?.routeDestination?.center : undefined)) as LandmarkFeature['routeCenter'] | undefined) ?? existing?.routeCenter,
        type: existing?.type || 'landmark',
        // Opt-in researched descriptions can improve generic address summaries while retaining extract history.
        funFact: existing?.funFact || specific?.funFact || (specific?.preferDescription || !existing?.wikipediaExtract ? specific?.description : undefined),
        sourceUrl: (!existing?.funFact && specific?.funFact ? specific?.sourceUrl : existing?.sourceUrl) || specific?.sourceUrl || model.attribution.sourceUrl,
        researchSourceUrl: specific?.sourceUrl || existing?.researchSourceUrl,
        researchDetail: specific?.funFact || specific?.description || existing?.researchDetail,
        manualPoi: true,
        modelId: model.id,
        buildingIds: manualPoiBuildingIds(id, [...(existing?.buildingIds ?? []), ...(model.suppressOsmIds ?? [])]),
        prominenceScore: Math.max(existing?.prominenceScore ?? 0, 220),
      });
    }
    // Suppress duplicate aliases in the pin/destination pool while allowing
    // delayed building joins to resolve those identities to the primary POI.
    if (model.id !== 'muziekgebouw-bimhuis') {
      for (const alias of ids.slice(1)) if(!destinations.includes(alias))merged.delete(alias);
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
