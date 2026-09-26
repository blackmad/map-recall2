/** Conservative extraction of game-compatible LoD2.2 roofs.
 * The source owner's `up` axis is NAP − 0.65 m; returned geometry is ground
 * relative to NAP. The game still owns an uncut, single-height LoD1 wall
 * prism, so a source roof is safe only when its whole surface set stays above
 * that prism. This is deliberately a stopgap: it withholds roofs instead of
 * pretending that a partial source mesh supplies its missing gable-end walls.
 */
export const SOURCE_ROOF_SELECTION_POLICY = 'whole-source-roof-above-uncut-lod1-v4-nap-corrected' as const;
export const SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M = 0.65;
export const SOURCE_ROOF_MIN_EAVE_RATIO = 0.6;
export const SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M = 3;
export const SOURCE_ROOF_MIN_RELIEF_M = 0.25;
/** The browser adds its own 4 cm draw offset after this geometric admission. */
export const SOURCE_ROOF_MIN_CLEARANCE_ABOVE_LOD1_M = 0;

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
  const sourceSurfaces = building.surfaces ?? [];
  if (!Array.isArray(sourceSurfaces)) return null;
  const roofSurfaces = sourceSurfaces.filter(surface => surface?.type === 'roof');
  const components: { geometry: Point[][]; eaves: number; ridge: number }[] = [];
  for (const surface of roofSurfaces) {
    // Every point is consumed by Three's triangulator later. Reject malformed
    // source here rather than letting NaN make the numeric gates evaluate
    // false and accidentally admitting a partial roof.
    if (!Array.isArray(surface.rings) || !surface.rings.length) return null;
    const geometry: Point[][] = [];
    for (const ring of surface.rings) {
      if (!Array.isArray(ring) || ring.length < 3) return null;
      const converted: Point[] = [];
      for (const point of ring) {
        if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) return null;
        const [east, sceneUp, south] = point;
        const up = Math.max(0, sourceRoofUpAboveGroundNAP(sceneUp, groundNAP));
        if (!Number.isFinite(up)) return null;
        converted.push([east, -south, up]);
      }
      geometry.push(converted);
    }
    const heights = geometry.flat().map(point => point[2]);
    const eaves = Math.min(...heights);
    const ridge = Math.max(...heights);
    if (!Number.isFinite(eaves) || !Number.isFinite(ridge)) return null;
    components.push({ geometry, eaves, ridge });
  }
  // A source building may have several roof components. Publishing only the
  // individually compatible ones left their lower eaves cutting through the
  // fallback LoD1 top as grey sawtooth shards. Do not claim a partial mesh is
  // a roof: retain every source component or none of them.
  if (!components.length) return null;
  const eaves = Math.min(...components.map(component => component.eaves));
  const ridge = Math.max(...components.map(component => component.ridge));
  if (
    eaves < height + SOURCE_ROOF_MIN_CLEARANCE_ABOVE_LOD1_M ||
    ridge > height + SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M ||
    ridge <= eaves + SOURCE_ROOF_MIN_RELIEF_M
  ) return null;

  return { surfaces: components.map(component => component.geometry), eaves };
}
