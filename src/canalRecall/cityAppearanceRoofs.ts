/** Conservative extraction of game-compatible LoD2.2 roof components.
 * The source owner's `up` axis is NAP − 0.65 m; returned geometry is ground
 * relative to NAP. Selection only withholds source components that do not fit
 * the game's current single-height wall volume.
 */
export const SOURCE_ROOF_SELECTION_POLICY = 'per-source-surface-compatible-v3-nap-corrected' as const;
export const SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M = 0.65;
export const SOURCE_ROOF_MIN_EAVE_RATIO = 0.6;
export const SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M = 3;
export const SOURCE_ROOF_MIN_RELIEF_M = 0.25;

type Point = [number, number, number];
type Surface = { type: string; rings: Point[][] };
export type SourceRoofBuilding = {
  roofType?: string | null;
  groundNAP?: number | null;
  height?: number | null;
  surfaces?: Surface[];
};
export type CompatibleSourceRoof = { surfaces: Point[][][]; eaves: number };

/** Convert the block compiler's scene-local vertical coordinate to NAP. */
export function sourceRoofUpAboveGroundNAP(up: number, groundNAP: number): number {
  return up + SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M - groundNAP;
}

export function selectCompatibleSourceRoof(building: SourceRoofBuilding): CompatibleSourceRoof | null {
  if (
    building.roofType !== 'slanted' ||
    !Number.isFinite(building.groundNAP) ||
    !(Number(building.height) > 0)
  ) return null;

  const groundNAP = Number(building.groundNAP);
  const height = Number(building.height);
  const components = (building.surfaces ?? [])
    .filter(surface => surface.type === 'roof')
    .map(surface => {
      const geometry = surface.rings.map(ring =>
        ring.map(([east, sceneUp, south]) => [
          east,
          -south,
          Math.max(0, sourceRoofUpAboveGroundNAP(sceneUp, groundNAP)),
        ] as Point),
      );
      const heights = geometry.flat().map(point => point[2]);
      const eaves = Math.min(...heights);
      const ridge = Math.max(...heights);
      return { geometry, eaves, ridge };
    })
    .filter(component =>
      component.eaves >= height * SOURCE_ROOF_MIN_EAVE_RATIO &&
      component.ridge <= height + SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M &&
      component.ridge > component.eaves + SOURCE_ROOF_MIN_RELIEF_M,
    );

  return components.length
    ? {
        surfaces: components.map(component => component.geometry),
        eaves: Math.min(...components.map(component => component.eaves)),
      }
    : null;
}
