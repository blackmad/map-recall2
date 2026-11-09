/**
 * Before/after gallery cards for `roof.tidy` (issue #87): per house one PNG, top row the roof as drawn today, bottom row
 * with `roof.tidy` forced on in memory, four aerial views (from the south, west, north and east of the footprint).
 * Installs nothing and touches no intent file.
 *
 *   node --import tsx scripts/building-recipes/roof-tidy-cards.ts --house=<id>[,<id>...] [--out=artifacts/roof-tidy]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {canalhouseGroupToGlb} from '../canalhouse-recipes/export-glb.ts';
import {compileBuilding} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {trustFactsGround, type BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
import sharp from 'sharp';
import {closeRenderer, contactSheet, renderModels} from './render.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ids = (arg('house') ?? '').split(',').filter(Boolean), OUT = arg('out') ?? 'artifacts/roof-tidy';
if (!ids.length) throw Error('usage: roof-tidy-cards.ts --house=<id>[,<id>...]');
const HOUSES = 'scripts/building-recipes/houses';
const read = async (f: string) => JSON.parse(await fs.readFile(f, 'utf8'));

try {
  for (const id of ids) {
    const raw = await read(path.join(HOUSES, id, 'intent.json'));
    const facts: BuildingFacts = trustFactsGround(await read(path.join(HOUSES, id, 'facts.json')), sharedTerrain());
    const dir = path.join(OUT, id); await fs.mkdir(dir, {recursive: true});
    const tiles: {image: Buffer; text: string}[] = [];
    let ext = 0;
    for (const tidy of [false, true]) {
      const intent = validateLargeIntent(structuredClone(tidy ? {...raw, roof: {...(raw.roof ?? {material: 'bitumen'}), tidy: {evidence: 'roof-tidy-cards.ts preview, issue #87'}}} : raw));
      const built = compileBuilding(intent, facts);
      const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
      const file = path.join(dir, tidy ? 'after.glb' : 'before.glb'); await fs.writeFile(file, glb.bytes);
      const r = built.recipe, top = Math.max(built.facts.heights.roofMaxM, 6);
      const xs = r.set.ground.flatMap(s => s.rings.flat().map(p => p[0])), zs = r.set.ground.flatMap(s => s.rings.flat().map(p => p[2]));
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), top);
      const d = ext * 1.5, size = {width: 640, height: 480};
      const dirs: [string, number, number][] = [['south', 0, 1], ['west', -1, 0], ['north', 0, -1], ['east', 1, 0]];
      const imgs = await renderModels([{file}], dirs.map(([, sx, sz]) => ({eye: [cx + sx * d, top + d * 0.6, cz + sz * d], target: [cx, top * 0.45, cz], fov: 35, ...size})));
      imgs.forEach((image, k) => tiles.push({image, text: `${tidy ? 'AFTER (roof.tidy)' : 'BEFORE'} · from the ${dirs[k][0]}`}));
    }
    // contactSheet lays one row; the card stacks the before row over the after row
    const rows = [tiles.slice(0, 4), tiles.slice(4)], files = rows.map((_, i) => path.join(dir, `row-${i}.png`));
    for (const [i, row] of rows.entries()) await contactSheet(row, files[i], {width: 480, height: 360}, i === 0 ? `${id} — roof before (top) / after roof.tidy (bottom)` : undefined);
    const metas = await Promise.all(files.map(f => sharp(f).metadata()));
    await sharp({create: {width: metas[0].width!, height: metas[0].height! + metas[1].height!, channels: 3, background: '#f4f4f2'}})
      .composite([{input: files[0], left: 0, top: 0}, {input: files[1], left: 0, top: metas[0].height!}]).png().toFile(path.join(dir, 'card.png'));
    await Promise.all(files.map(f => fs.rm(f)));
    console.log(path.join(dir, 'card.png'));
  }
} finally { await closeRenderer(); }
