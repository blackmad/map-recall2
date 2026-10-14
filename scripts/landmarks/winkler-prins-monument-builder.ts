import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Winkler Prins monument (Andre Volten, 1970; Frederiksplein, OSM node 1310554563), an abstract tall column of stacked stainless-steel discs on a
 * thinner core: eight thick discs at the foot (each about 0.17 m with 0.1 m gaps showing the dark core), then thinner discs all the way up separated by
 * narrow dark/glass gaps, a plain cap disc on top. Source photos: Wikimedia Commons "Monument Anthony Winkler Prins Andre Volten Frederiksplein" (Brbbl, CC BY-SA 3.0),
 * its "Detail" (CC BY-SA 4.0) and the Anefo placing/unveiling photographs 923-8960/8961/9119 (CC0). It is a rotationally symmetric column, so the facing is
 * irrelevant. Height (11 m) and disc diameter (0.72 m) are estimates scaled off the unveiling crowd and the benches at its foot; the glass inserts between
 * the upper discs are drawn as dark gaps.
 */
export function buildWinklerPrinsMonument(_w: number, _d: number, b: BuildingTools) {
  const {put} = memorialFrame(b, 0);
  const R = 0.36, SEG = 20;
  const disc = (y: number, h: number, r = R) => { const g = new T.CylinderGeometry(r, r, h, SEG, 1); put(g, 0, y + h / 2, 0, 'frame'); };
  const H = 11.0;
  const core = new T.CylinderGeometry(R * 0.72, R * 0.72, H, 14, 1); put(core, 0, H / 2, 0, 'greyBrick');
  let y = 0;
  for (let i = 0; i < 8; i++) { disc(y, 0.17); y += 0.17 + 0.1 - (i > 4 ? 0.02 : 0); }
  while (y < H - 0.3) { disc(y, 0.11); y += 0.11 + 0.065; }
  disc(H - 0.2, 0.2);
}
