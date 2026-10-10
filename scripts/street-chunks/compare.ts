/**
 * Review renders: the control (same houses, nothing changed) vs the chunk, from
 * identical street-level cameras, side by side plus a pixel-difference panel.
 *
 *   node --import tsx scripts/street-chunks/compare.ts --chunk=bilder-080336-x4 [--dir=artifacts/street-chunks]
 *
 * Models live in the chunk frame (x along the street, z outward); the renderer's
 * scene is recipe-local (x east, z south), so the models are rotated by the frame
 * angle and the cameras are rotated with them.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {renderModels, closeRenderer, contactSheet, type RenderView} from '../building-recipes/render.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = arg('dir') ?? 'artifacts/street-chunks', name = arg('chunk')!;
const report = JSON.parse(await fs.readFile(path.join(dir, `${name}.report.json`), 'utf8'));
const [ux, uy] = report.frame.uRD as number[], theta = Math.atan2(uy, ux), c = Math.cos(theta), s = Math.sin(theta);
/** chunk frame (x, y, z) → renderer scene. */
const toScene = (p: number[]) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
const xs = report.pandX as number[] | undefined;
const pands = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8')).chunks.find((x: any) => x.name === name).pands;
const x0 = Math.min(...pands.map((p: any) => p.frontage.x0)), x1 = Math.max(...pands.map((p: any) => p.frontage.x1)), top = Math.max(...pands.map((p: any) => p.bounds.max[1]));
const mid = (x0 + x1) / 2, span = x1 - x0;
const size = {width: 1200, height: 760};
const view = (eye: number[], target: number[], fov: number): RenderView => ({eye: toScene(eye), target: toScene(target), fov, ...size});
const views: Record<string, RenderView> = {
  // Pedestrian across the street, looking at the middle of the face.
  street: view([mid, 1.7, Math.max(14, span * 0.55)], [mid, top * 0.4, 0], 62),
  // Game-like chase camera: higher, further down the street, looking along the face.
  chase: view([x0 - 16, 9, 14], [mid, top * 0.3, 0], 58),
  // Rider's eye from the far end at low height: sees every joint edge-on.
  alongLow: view([x1 + 10, 2.2, 7], [x0, top * 0.35, 0], 56),
  // High oblique over the roofs.
  high: view([mid - 10, top + 14, span * 0.7 + 8], [mid, top * 0.5, 0], 52),
};
const models = (file: string) => [{file, rotationY: theta}];
const before = await renderModels(models(path.join(dir, 'control', `${name}.glb`)), Object.values(views));
const after = await renderModels(models(path.join(dir, `${name}.glb`)), Object.values(views));
const grounded = await renderModels(models(path.join(dir, 'grounded', `${name}.glb`)), Object.values(views));
await closeRenderer();
const out = path.join(dir, 'review', name);
await fs.mkdir(out, {recursive: true});
for (const [i, key] of Object.keys(views).entries()) {
  const a = await sharp(before[i]).raw().ensureAlpha().toBuffer({resolveWithObject: true}), b = await sharp(after[i]).raw().ensureAlpha().toBuffer({resolveWithObject: true});
  const diff = Buffer.alloc(a.info.width * a.info.height * 3);
  let changed = 0;
  for (let p = 0; p < a.info.width * a.info.height; p++) {
    const d = Math.max(Math.abs(a.data[p * 4] - b.data[p * 4]), Math.abs(a.data[p * 4 + 1] - b.data[p * 4 + 1]), Math.abs(a.data[p * 4 + 2] - b.data[p * 4 + 2]));
    if (d > 12) { changed++; diff[p * 3] = 255; diff[p * 3 + 1] = 40; diff[p * 3 + 2] = 40; } else { const g = Math.round((a.data[p * 4] + a.data[p * 4 + 1] + a.data[p * 4 + 2]) / 3 * 0.5 + 100); diff[p * 3] = diff[p * 3 + 1] = diff[p * 3 + 2] = g; }
  }
  const diffPng = await sharp(diff, {raw: {width: a.info.width, height: a.info.height, channels: 3}}).png().toBuffer();
  await contactSheet([{image: before[i], text: 'individual houses (control)'}, {image: after[i], text: 'chunk'}, {image: diffPng, text: `difference (${(100 * changed / (a.info.width * a.info.height)).toFixed(2)}% px)`}], path.join(out, `${key}.png`), {width: 600, height: 380}, `${name} · ${key}`);
  await fs.writeFile(path.join(out, `${key}-before.png`), before[i]); await fs.writeFile(path.join(out, `${key}-after.png`), after[i]);
  // Trim-only check: grounded (walls kept) vs chunk (walls dropped) must look the same from outside.
  const g = await sharp(grounded[i]).raw().ensureAlpha().toBuffer({resolveWithObject: true});
  let trimChanged = 0;
  for (let p = 0; p < g.info.width * g.info.height; p++) if (Math.max(Math.abs(g.data[p * 4] - b.data[p * 4]), Math.abs(g.data[p * 4 + 1] - b.data[p * 4 + 1]), Math.abs(g.data[p * 4 + 2] - b.data[p * 4 + 2])) > 12) trimChanged++;
  console.log(key, 'vs control px', changed, '| party-wall trim only px', trimChanged);
}
