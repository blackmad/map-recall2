/**
 * Quick strip comparison: photo strip over an orthographic render of any GLB in the face's chunk frame.
 *   node --import tsx scripts/block-face/ortho-compare.ts <face> <glb> <out.png>
 * (review.ts is the full sheet; this is for glbs that have no face report, e.g. the per-house baseline.)
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {renderModels, closeRenderer} from '../building-recipes/render.ts';

const [face, glb, out] = process.argv.slice(2);
const s = JSON.parse(await fs.readFile(`scripts/block-face/faces/${face}/strip.json`, 'utf8'));
const W = s.width, H = s.height, x0 = s.x0M, x1 = s.x1M, top = s.heightM;
const [m] = await renderModels([{file: glb}], [{eye: [(x0 + x1) / 2, top / 2, 200], target: [(x0 + x1) / 2, top / 2, 0], fov: 30, width: W, height: H, ortho: [-(x1 - x0) / 2, (x1 - x0) / 2, top / 2, -top / 2], background: '#9fb8cf', noGround: true}]);
await closeRenderer();
const model = await sharp(m).resize(W, H, {fit: 'fill'}).png().toBuffer();
const photo = await sharp(s.image).resize(W, H, {fit: 'fill'}).png().toBuffer();
const stack = await sharp({create: {width: W, height: H * 2, channels: 3, background: '#fff'}}).composite([{input: photo, top: 0, left: 0}, {input: model, top: H, left: 0}]).png().toBuffer();
await sharp(stack).resize(2400).png().toFile(out);
