/**
 * Index rows for a large-recipe review: one row per (house, wall group) with
 *   installed-before (a game frame, e.g. live-play-shots.mjs on the tracked bundles) | re-fit raw (recipe look, 3/4 of
 *   the group's main panel) | re-fit city look (same view) | photo (the archived crop matched to the panel)
 * and the group's likeness verdict in the row label (views wider than 32 m look at the middle 32 m). JPEG, under ~400 KB.
 *
 *   MAP_RECALL_SOURCE_DATA=<checkout> node --import tsx scripts/building-recipes/index-row-sheet.ts --out=<file.jpg> \
 *     <house>:<group>[:<before.png>] ...
 *
 * Needs `large.ts --house=<id>` first (artifacts/building-recipes/<id>/model.glb and report.json with likeness).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {compileLargeHouse} from './large.ts';
import {closeRenderer, renderModels} from './render.ts';
import {pandWallsDir} from './sourceData.ts';

const ARTIFACTS = 'artifacts/building-recipes';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const out = arg('out') ?? 'artifacts/index-row-sheet.jpg';
const specs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const W = 420, H = 300, LABEL = 30;

const label = (text: string, width: number) => Buffer.from(`<svg width="${width}" height="${LABEL}"><rect width="100%" height="100%" fill="#1f2328"/><text x="8" y="20" font-family="Helvetica, Arial" font-size="14" fill="#ffffff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const cell = async (image: Buffer | null, text: string) => {
  const body = image ? await sharp(image).resize(W, H, {fit: 'contain', background: '#ffffff'}).png().toBuffer() : await sharp({create: {width: W, height: H, channels: 3, background: '#dddddd'}}).png().toBuffer();
  return sharp({create: {width: W, height: H + LABEL, channels: 3, background: '#ffffff'}}).composite([{input: label(text, W), top: 0, left: 0}, {input: body, top: LABEL, left: 0}]).png().toBuffer();
};

const rows: Buffer[] = [];
for (const spec of specs) {
  const [id, gs, before] = spec.split(':'), gi = Number(gs);
  const {built, likeness, report} = await compileLargeHouse(id);
  const g = built.recipe.groups.find(x => x.index === gi);
  if (!g || g.mainPanel === null) throw Error(`${id}: no group ${gi} with a panel`);
  const p = built.panels[g.mainPanel], top = Math.max(g.eavesM + 3, 8);
  const u = (p.uMin + p.uMax) / 2, mid = [p.o[0] + p.r[0] * u, top / 2, p.o[2] + p.r[2] * u], width = Math.min(Math.max(p.uMax - p.uMin, 8), 32);
  const fov = 35, dist = Math.max(width * 0.75, top) * 1.2 / 2 / Math.tan(fov * Math.PI / 360);
  const yaw = 30 * Math.PI / 180, rx = p.n[0] * Math.cos(yaw) - p.n[2] * Math.sin(yaw), rz = p.n[0] * Math.sin(yaw) + p.n[2] * Math.cos(yaw);
  const view = {eye: [mid[0] + rx * dist, Math.max(2, top * 0.6), mid[2] + rz * dist], target: [mid[0], top * 0.4, mid[2]], fov, width: W * 2, height: H * 2};
  const file = path.join(ARTIFACTS, id, 'model.glb');
  const [raw] = await renderModels([{file}], [view]);
  const [city] = await renderModels([{file}], [view], {city: true, year: built.facts.heights.builtYear});
  const gl = likeness?.find(x => x.group === gi);
  const photo = gl?.crop ? await fs.readFile(path.join(pandWallsDir(built.recipe.pandId), gl.crop.file)).catch(() => null) : null;
  const verdict = gl?.likeness ? gl.likeness.verdict : gl ? 'NO PHOTO' : 'not measured';
  const cells = await Promise.all([
    cell(before ? await fs.readFile(before) : null, before ? `installed before: ${path.basename(before)}` : 'installed before: none'),
    cell(raw, `${id} walls[${gi}] ${g.system} · ${report.triangles} tris`),
    cell(city, `city look · likeness ${verdict}`),
    cell(photo, photo ? `photo ${gl!.crop!.tag} ${gl!.crop!.capturedAt}` : 'no matched photo'),
  ]);
  rows.push(await sharp({create: {width: 4 * W + 3 * 6, height: H + LABEL, channels: 3, background: '#f4f4f2'}}).composite(cells.map((input, i) => ({input, top: 0, left: i * (W + 6)}))).png().toBuffer());
}
await closeRenderer();
const sheet = sharp({create: {width: 4 * W + 3 * 6, height: rows.length * (H + LABEL + 6), channels: 3, background: '#f4f4f2'}}).composite(rows.map((input, i) => ({input, top: i * (H + LABEL + 6), left: 0})));
await fs.mkdir(path.dirname(out), {recursive: true});
let q = 82, bytes = await sheet.clone().jpeg({quality: q, mozjpeg: true}).toBuffer();
while (bytes.length > 400_000 && q > 40) { q -= 8; bytes = await sheet.clone().jpeg({quality: q, mozjpeg: true}).toBuffer(); }
await fs.writeFile(out, bytes);
console.log(`${out}: ${rows.length} rows, ${(bytes.length / 1024).toFixed(0)} KB (q ${q})`);
