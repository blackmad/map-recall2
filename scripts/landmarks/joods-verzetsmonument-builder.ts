import type {BuildingTools} from './cultural-builders';
import {memorialFrame} from './memorial-frame';

/**
 * Joods Verzetsmonument (Amstel 1, on the quay where the Amstel meets the Zwanenburgwal; unveiled 16 October 1988): a tall stele of polished black stone
 * on a low plinth, its wide face carrying a block of gilt lines in the middle (the Dutch text for the Jewish citizens who died in the resistance
 * 1940-1945) and its narrow face a vertical strip of gilt Hebrew lines (the underground fighters, Jewish years 5700-5705).
 * Original low-poly stele from Gemeente Amsterdam panoramas (CC BY 4.0) TMX7316010203-000711_pano_0000_003721/3722/3723 and b_20250130_0915_Track35_Sphere_00073;
 * the wording is not legible at panorama resolution, so the gilt text is modelled as line plates (the date line is real lettering). Local frame: +z is the wide
 * lettered face, +x its left. FACING (east, towards the camera of all panoramas) is a visual estimate; 2.5 m height from the railing beside it is an estimate.
 */
const FACING = 85;

export function buildJoodsVerzetsmonument(_w: number, _d: number, b: BuildingTools) {
  const {box, lettering} = memorialFrame(b, FACING);
  const W = 0.86, D = 0.5, H = 2.5, P = 0.06;
  box(0, 0, 0, W + 0.24, P, D + 0.24, 'concrete');                      // low plinth slab
  box(0, P, 0, W, H, D, 'dark');                                        // the stele
  box(0, P + H, 0, W + 0.04, 0.03, D + 0.04, 'greyBrick');              // cap slab, thin and a shade lighter
  // wide face: five gilt line plates (centred block) and the date line; plates 2 cm proud of the face
  const z = D / 2 + 0.015;
  const rows: [number, number][] = [[1.52, 0.5], [1.44, 0.56], [1.36, 0.46], [1.28, 0.54], [1.2, 0.34]];
  for (const [y, w] of rows) box(0, y, z, w, 0.035, 0.03, 'gold');
  lettering('1940 - 1945', 0.07, 0.42, 0, 1.08, D / 2, 'front', 'gold', 0.03);
  // narrow (left) face: a vertical strip of Hebrew-style gilt lines
  const x = W / 2 + 0.015;
  for (let i = 0; i < 6; i++) box(x, 1.22 + i * 0.07, 0, 0.03, 0.03, 0.34 - (i % 3) * 0.06, 'gold');
}
