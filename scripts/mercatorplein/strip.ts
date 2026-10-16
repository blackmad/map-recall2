/**
 * Four-side gallery strips of the two Mercatorplein tower models (three-quarter views from the square's four corners,
 * at gallery-card size), and a view of the whole square with both towers.
 *
 *   node --import tsx scripts/mercatorplein/strip.ts [--out=artifacts/mercatorplein/sheets]
 *
 * Reads the dequantized copies written by sheets.ts (artifacts/mercatorplein/plain-<id>.glb); run sheets.ts first.
 */
import path from 'node:path';
import {closeRenderer, contactSheet, renderModels, type RenderModel} from '../building-recipes/render';

const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'artifacts/mercatorplein/sheets';
const ANCHORS: Record<string, [number, number]> = {'mercatorplein-noordtoren': [118460.66, 487085.28], 'mercatorplein-zuidtoren': [118464.64, 486912.0]};
const [AX, AY] = ANCHORS['mercatorplein-noordtoren'];
const models: RenderModel[] = Object.entries(ANCHORS).map(([id, [x, y]]) => ({file: path.resolve(`artifacts/mercatorplein/plain-${id}.glb`), position: [x - AX, 0, AY - y]}));
const size = {width: 640, height: 440};
// The square's axes: u along bearing 74, n along 344. Corners of the view in compass terms of the camera from the target.
const view = (target: number[], bearing: number, dist: number, h: number, fov = 34) => {
  const a = bearing * Math.PI / 180;
  return {eye: [target[0] + Math.sin(a) * dist, h, target[2] - Math.cos(a) * dist], target, fov, ...size};
};
// North tower (u 22, n -6 in its frame -> local), south tower (u -8, n 0 in its frame), offset by its anchor
const loc = (u: number, n: number, anchor: [number, number]) => {
  const a = 74 * Math.PI / 180, b = 344 * Math.PI / 180;
  const x = u * Math.sin(a) + n * Math.sin(b), y = u * Math.cos(a) + n * Math.cos(b);
  return [anchor[0] - AX + x, 14, AY - anchor[1] - y];
};
const north = loc(22, -6, ANCHORS['mercatorplein-noordtoren']), south = loc(-6, 0, ANCHORS['mercatorplein-zuidtoren']);
// camera compass bearing from the tower: the north tower faces the square to the SSE, the south tower to the NNW
const sides = [['from the square (SSE)', 165], ['from the south-west', 230], ['from Mercatorstraat (NNW, rear)', 345], ['from the east', 90]] as const;
const southSides = [['from the square (NNW)', 345], ['from the north-east', 45], ['from Van Spilbergenstraat (SSE, rear)', 165], ['from the west', 270]] as const;
const views = [
  ...sides.map(([, b]) => view([north[0], 16, north[2]], b, 85, 28, 32)),
  ...southSides.map(([, b]) => view([south[0], 15, south[2]], b, 70, 22, 32)),
  view([2, 8, 86], 74 + 90 + 20, 230, 120, 40),
];
const images = await renderModels(models, views);
await closeRenderer();
await contactSheet(images.slice(0, 4).map((image, i) => ({image, text: sides[i][0]})), path.join(out, 'strip-noordtoren.png'), {width: 320, height: 220}, 'Mercatorplein north tower - four sides (gallery size)');
await contactSheet(images.slice(4, 8).map((image, i) => ({image, text: southSides[i][0]})), path.join(out, 'strip-zuidtoren.png'), {width: 320, height: 220}, 'Mercatorplein south tower - four sides (gallery size)');
await contactSheet([{image: images[8], text: 'the square from the south-east, both towers'}], path.join(out, 'square-both.png'), {width: 640, height: 440}, 'Mercatorplein');
console.log('wrote strips to', out);
