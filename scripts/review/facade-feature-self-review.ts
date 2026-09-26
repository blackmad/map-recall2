import type { FacadeFeature } from '../../src/canalRecall/facadeDescription.js';

export type FacadeFeatureReviewFlag = {
  featureId: string;
  code: 'upper-door-solid-default';
  reason: string;
};

/** Flags ambiguous solid-door defaults for source review. It never changes a
 * feature: balcony/window-row context is a reason to inspect pixels, not proof
 * that every elevated door is glazed. */
export function reviewUpperFloorDoors(features: readonly FacadeFeature[]): FacadeFeatureReviewFlag[] {
  const lowestOpeningBottom = Math.max(...features.filter(feature => feature.kind === 'door' || feature.kind === 'window').map(feature => feature.bounds?.[3] ?? -Infinity));
  if (!Number.isFinite(lowestOpeningBottom)) return [];
  return features.flatMap(feature => {
    if (feature.kind !== 'door' || !Number.isInteger(feature.row) || feature.bounds[3] >= lowestOpeningBottom - 1 || feature.doorStyle === 'glazed' || feature.doorStyle === 'plain') return [];
    const alignedWindows = features.filter(other => other.kind === 'window' && other.row === feature.row).length;
    if (alignedWindows < 1) return [];
    return [{
      featureId: feature.id,
      code: 'upper-door-solid-default' as const,
      reason: `Elevated door shares row ${feature.row} with ${alignedWindows} window${alignedWindows === 1 ? '' : 's'}; compare glass-to-panel proportion and frame rhythm with the source before accepting a panelled/default treatment.`,
    }];
  });
}
