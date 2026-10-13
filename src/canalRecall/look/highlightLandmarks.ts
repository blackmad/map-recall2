/**
 * Which landmark-source entries (GLB landmarks, recipe houses) are highlighted or dimmed under `?highlight=a|b|c`
 * (look/highlight.ts). Pure, so the matching is unit-tested without three.js.
 *
 * Under today's yellow only `landmarkId` matches (signature-landmarks-source.js keeps that path untouched). The
 * candidates also light an entry whose `suppressOsmIds` hold one of the card's buildings: a recipe house standing
 * in for the answer building used to stay unlit, since the extrusion that carried the yellow is suppressed under it.
 * Building-type areas (`sceneFactory`) are left to their own per-pand highlight.
 */
import { HIGHLIGHT_RECIPES, highlightStyle, withinDesaturation, type HighlightFocus, type HighlightStyle, type LngLat } from './highlight.ts';

export interface LandmarkEntryLike {
  spec: { landmarkId?: string; relatedLandmarkIds?: readonly string[]; suppressOsmIds?: readonly (string | number)[]; sceneFactory?: unknown };
  placement?: { anchor?: LngLat };
}
export interface LandmarkLike {
  id?: string;
  lngLat?: LngLat;
  buildingIds?: readonly (string | number)[];
  featureTarget?: { id?: string | number } | null;
}

export type EntryState = 'plain' | 'highlight' | 'dim';

export function landmarkHighlightStates<E extends LandmarkEntryLike>(entries: readonly E[], landmark: LandmarkLike | null | undefined, style: HighlightStyle = highlightStyle()): {
  states: Map<E, EntryState>; ids: Set<string>; focus: HighlightFocus | null;
} {
  const recipe = HIGHLIGHT_RECIPES[style];
  const ids = new Set<string>([...(landmark?.buildingIds ?? []), landmark?.featureTarget?.id].filter(id => id != null && id !== '').map(String));
  const focus: HighlightFocus | null = landmark?.lngLat ? { lngLat: landmark.lngLat, ids: [...ids] } : null;
  const states = new Map<E, EntryState>();
  const active = landmark?.id ?? null;
  for (const entry of entries) {
    const spec = entry.spec;
    if (spec.sceneFactory) continue;
    const byId = !!active && (spec.landmarkId === active || (spec.relatedLandmarkIds ?? []).includes(active));
    const byBuilding = recipe.keepMaterials && (spec.suppressOsmIds ?? []).some(id => ids.has(String(id)));
    if (byId || byBuilding) states.set(entry, 'highlight');
    else if (recipe.desaturate && focus && entry.placement?.anchor && withinDesaturation(focus.lngLat, entry.placement.anchor)) states.set(entry, 'dim');
  }
  return { states, ids, focus };
}
