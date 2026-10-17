/**
 * Gallery-size views of compiled block faces from every side (review before install): the rectified photo strip, the
 * chunk from the street at both obliques (eye 1.7 m up, 14 m out), an aerial three-quarter, and the rear oblique, in one
 * contact sheet per face. One browser for all faces (run it under the machine's browser lock).
 *
 *   node --import tsx scripts/block-face/run-views.ts --face=boterdiep-36-66-r1[,...] [--out=<dir>]
 *
 * Chunk frame (as review.ts renders it): x along the face (left to right seen from the street), y up, +z the street.
 * Writes staging/block-face/<face>/review/views.png (or <out>/<face>-views.png).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {closeRenderer, contactSheet, renderModels, type RenderView} from '../building-recipes/render.ts';
import {FACES, STAGING} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const faces = arg('face')?.split(',');
if (!faces?.length) throw Error('--face=<id>[,<id>...]');
const outDir = arg('out');
const size = {width: 720, height: 480};
for (const face of faces) {
  const strip = JSON.parse(await fs.readFile(path.join(FACES, face, 'strip.json'), 'utf8'));
  const glb = path.join(STAGING, face, 'chunk.glb');
  const x0 = strip.x0M, x1 = strip.x1M, L = x1 - x0, mid = (x0 + x1) / 2, top = strip.heightM - 2;
  const d = Math.max(14, L * 0.45);
  const views: RenderView[] = [
    {eye: [x0 - 0.15 * L, 1.7, d], target: [mid, top * 0.45, 0], fov: 50, ...size},
    {eye: [x1 + 0.15 * L, 1.7, d], target: [mid, top * 0.45, 0], fov: 50, ...size},
    {eye: [mid - 0.3 * L, top + L * 0.55, L * 0.75], target: [mid, top * 0.4, -4], fov: 40, ...size},
    {eye: [mid + 0.35 * L, top * 1.2, -L * 0.8], target: [mid, top * 0.4, -6], fov: 40, ...size},
  ];
  const renders = await renderModels([{file: glb}], views);
  const photo = await sharp(strip.image).resize(size.width, size.height, {fit: 'contain', background: '#ffffff'}).png().toBuffer();
  const out = outDir ? path.join(outDir, `${face}-views.png`) : path.join(STAGING, face, 'review', 'views.png');
  await fs.mkdir(path.dirname(out), {recursive: true});
  await contactSheet([{image: photo, text: `photo strip ${strip.date}`}, ...renders.map((image, i) => ({image, text: ['street, from the left', 'street, from the right', 'aerial three-quarter', 'rear oblique'][i]}))], out, size, `${face}: every side`);
  console.log(out);
}
await closeRenderer();
