/**
 * Block pilot elevations (lane belt-block-pilot-20261122): the block GLB drawn per pand through house preview's GLB route
 * (renderGlb: flat game colours, the framing of the belt review's per-house renders: the pand's measured front line from
 * walls.json, 50 px/m, ground at the bottom), then a whole-row strip, photo | block | kit sheets per pand.
 *
 *   node --import tsx scripts/belt-block/render.ts <id> <walls.json> <row.png> <row.json> <outDir> [pand,...]
 *
 * outDir gets front/<pand>.png, row.png, and cmp/<pand>.png when kit/<pand>.png (the review's kit render) is present.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {PreviewSession, parseArgs, renderGlb, recipeToEnu, soupToEnu} from '../house-preview/preview.ts';
import {loadMaterialSoup} from '../landmarks/material-soup.ts';

const [id, wallsFile, rowPng, rowJson, outDir, only] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/belt-block/${id}-source.json`, 'utf8'));
const walls = JSON.parse(fs.readFileSync(wallsFile, 'utf8')).walls;
const layout = JSON.parse(fs.readFileSync(rowJson, 'utf8')).layout.pands as {pandId: string; x: number; w: number}[];
const pands: string[] = only ? only.split(',') : src.pands.map((p: {pand: string}) => p.pand);
const soup = soupToEnu(await loadMaterialSoup(`scripts/belt-block/out/${id}.glb`), recipeToEnu(src.anchorRD));
const session = new PreviewSession('photo');
for (const d of ['front', 'cmp', 'work']) fs.mkdirSync(path.join(outDir, d), {recursive: true});
const tm = {t: {} as Record<string, number>, mark() {}};
for (const pand of pands) {
  const w = walls[pand], f = (v: number) => v.toFixed(8);
  const out = path.join(outDir, 'work', pand);
  const args = {...parseArgs([]), ppm: 50, out, wall: `line:${f(w.a[0])},${f(w.a[1])},${f(w.b[0])},${f(w.b[1])}`};
  const r = await renderGlb(session, pand, {soup, route: 'recipe', why: `block pilot ${id}`, label: `block ${id}`, measure: {}}, args as never, tm as never);
  fs.copyFileSync(path.join(out, 'front.png'), path.join(outDir, 'front', `${pand}.png`));
  console.log(pand, 'rendered', JSON.stringify((r.measure as {heights?: unknown}).heights));
}

// whole-row strip: each pand's front at its layout x, bottoms aligned (the review's row layout)
const fronts = await Promise.all(layout.filter(p => pands.includes(p.pandId) && fs.existsSync(path.join(outDir, 'front', `${p.pandId}.png`))).map(async p => ({p, buf: await sharp(path.join(outDir, 'front', `${p.pandId}.png`)).png().toBuffer(), meta: await sharp(path.join(outDir, 'front', `${p.pandId}.png`)).metadata()})));
if (fronts.length) {
  const x0 = Math.min(...fronts.map(f => f.p.x)), x1 = Math.max(...fronts.map(f => f.p.x + f.p.w)), H = Math.max(...fronts.map(f => f.meta.height!)) + 20;
  await sharp({create: {width: x1 - x0, height: H, channels: 4, background: '#ffffff'}})
    .composite(fronts.map(f => ({input: f.buf, left: f.p.x - x0, top: H - f.meta.height!}))).png().toFile(path.join(outDir, 'row.png'));
  // the photo strip of the same span, for the row side-by-side
  const pm = await sharp(rowPng).metadata(), top = Math.max(0, pm.height! - H - 23);
  const photo = await sharp(rowPng).extract({left: x0, top, width: x1 - x0, height: Math.min(pm.height! - top, H + 23)}).flatten({background: '#ffffff'}).png().toBuffer();
  const pmeta = await sharp(photo).metadata();
  await sharp({create: {width: x1 - x0, height: pmeta.height! + H + 10, channels: 4, background: '#ffffff'}})
    .composite([{input: photo, left: 0, top: 0}, {input: path.join(outDir, 'row.png'), left: 0, top: pmeta.height! + 10}]).png().toFile(path.join(outDir, 'row-vs-photo.png'));
}

// per pand: photo | block | kit, bottoms aligned, same scale
for (const pand of pands) {
  const p = layout.find(q => q.pandId === pand)!, kit = path.join(outDir, 'kit', `${pand}.png`), mine = path.join(outDir, 'front', `${pand}.png`);
  const pm = await sharp(rowPng).metadata();
  const photo = await sharp(rowPng).extract({left: p.x, top: 0, width: p.w, height: 1300}).flatten({background: '#ffffff'}).png().toBuffer();
  const parts = [photo, await sharp(mine).png().toBuffer(), ...(fs.existsSync(kit) ? [await sharp(kit).png().toBuffer()] : [])];
  const metas = await Promise.all(parts.map(b => sharp(b).metadata()));
  const H = 1300, gap = 16, Wd = metas.reduce((s, m) => s + m.width! + gap, gap);
  let x = gap;
  const comps = parts.map((b, i) => { const c = {input: b, left: x, top: H - metas[i].height!}; x += metas[i].width! + gap; return c; });
  // trim the empty sky above the tallest part
  const top = Math.max(0, H - Math.max(...metas.slice(1).map(m => m.height!), 0) - 150);
  const sheet = await sharp({create: {width: Wd, height: H, channels: 4, background: '#ffffff'}}).composite(comps).png().toBuffer();
  await sharp(sheet).extract({left: 0, top, width: Wd, height: H - top}).png().toFile(path.join(outDir, 'cmp', `${pand}.png`));
  void pm;
}
console.log('done', pands.length);
