/** Screen-scale policy for synthetic facade detail in the Map Recall game.
 * Geometry may stay resident below these thresholds so camera motion does not
 * cause network churn; this module controls drawing only. */
export const FACADE_SILHOUETTE_MIN_ZOOM = 18.25;
export const FACADE_JOINERY_MIN_ZOOM = 19.35;

export type FacadeDisplayLod = 'hidden' | 'openings' | 'joinery';

export function facadeDisplayLod(zoom: number): FacadeDisplayLod {
  if (!Number.isFinite(zoom) || zoom < FACADE_SILHOUETTE_MIN_ZOOM) return 'hidden';
  return zoom < FACADE_JOINERY_MIN_ZOOM ? 'openings' : 'joinery';
}

/** At intermediate scale, retain only the dark opening plane. Pale frames,
 * mullions, sills, doors and cornice strips need more pixels before they read
 * as architecture instead of detached confetti. */
export function facadeBatchVisible(kind: string, zoom: number): boolean {
  const lod = facadeDisplayLod(zoom);
  if (lod === 'hidden') return false;
  if (lod === 'joinery') return true;
  return kind.startsWith('windowGlass') || kind === 'shopGlass';
}

export function facadeBatchOpacity(kind: string, zoom: number): number {
  if (!facadeBatchVisible(kind, zoom)) return 0;
  return facadeDisplayLod(zoom) === 'openings' ? .58 : 1;
}
