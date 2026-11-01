/**
 * The measuring half of `SkyBound` (stripSkyline.ts): what ends each skyline column of a span. Kept apart from
 * stripSkyline.ts so the pure skyline judgement does not pull measureFacade.ts into autoPlace.ts's import graph.
 */
import {isLeaf} from '../buildingRecipe/measureFacade.ts';
import {isSky, SKY_BOUND, SKYLINE, type SkyBound} from './stripSkyline.ts';

export function measureSkyBound(a: {rgb: Uint8Array; width: number; height: number; x0: number; x1: number; pixelsPerMetre: number}): SkyBound {
  const {rgb, width, height, pixelsPerMetre: ppm} = a, inset = Math.round((a.x1 - a.x0) * 0.04);
  const xa = Math.max(0, a.x0 + inset), xb = Math.min(width, a.x1 - inset);
  let cols = 0, leafy = 0;
  for (let x = xa; x < xb; x++) {
    let solid = 0, top = -1;
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 3;
      if (isSky([rgb[i], rgb[i + 1], rgb[i + 2]])) { solid = 0; continue; }
      if (++solid >= SKYLINE.run) { top = y - SKYLINE.run + 1; break; }
    }
    if (top < 0) continue;
    cols++;
    let n = 0, l = 0;
    for (let y = top; y < Math.min(height, top + ppm); y++) { const i = (y * width + x) * 3; n++; if (isLeaf(rgb[i], rgb[i + 1], rgb[i + 2])) l++; }
    if (n && l / n > SKY_BOUND.leafColumn) leafy++;
  }
  return {leafTopShare: cols ? +(leafy / cols).toFixed(2) : 0, spanM: +(Math.max(0, xb - xa) / ppm).toFixed(2)};
}

