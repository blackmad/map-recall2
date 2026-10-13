/**
 * Close-up of one wall group of a compiled `kind: large` house (run large.ts first): front-on and 3/4 views centred
 * at a fraction of the group's widest panel, to judge components (pilasters, portals, box windows, screens) that the
 * contact sheets show only a few pixels wide.
 *
 *   node --import tsx scripts/building-recipes/closeup.ts --house=<id> --group=<n> [--at=0.5] [--span=12] [--panel=<index>] [--v=0.5]
 *
 * Writes artifacts/building-recipes/<id>/closeup-g<n>-<at>.png. `--panel` picks another panel of the group; `--v` the
 * height of the view centre as a fraction of the panel top.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';
import {closeRenderer, contactSheet, renderModels} from './render.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const id = arg('house'), gi = Number(arg('group', '0')), at = Number(arg('at', '0.5')), span = Number(arg('span', '12')), vf = Number(arg('v', '0.5'));
const dir = path.join('artifacts/building-recipes', id), house = path.join('scripts/building-recipes/houses', id);
const intent = validateLargeIntent(JSON.parse(await fs.readFile(path.join(house, 'intent.json'), 'utf8')));
const built = compileLargeBuilding(intent, JSON.parse(await fs.readFile(path.join(house, 'facts.json'), 'utf8')), {budget: 1e9});
const g = built.recipe.groups[gi], pi = arg('panel') ? Number(arg('panel')) : g.mainPanel;
if (pi === null) throw Error(`walls[${gi}] has no panel`);
const p = built.panels[pi], u = p.uMin + (p.uMax - p.uMin) * at, vc = p.vMax * vf;
const mid = [p.o[0] + p.r[0] * u, vc, p.o[2] + p.r[2] * u], fov = 30, dist = span / 2 / Math.tan(fov * Math.PI / 360);
const yaw = 40 * Math.PI / 180, rx = p.n[0] * Math.cos(yaw) - p.n[2] * Math.sin(yaw), rz = p.n[0] * Math.sin(yaw) + p.n[2] * Math.cos(yaw);
const size = {width: 900, height: 700};
try {
  const [front, three] = await renderModels([{file: path.join(dir, 'model.glb')}], [
    {eye: [mid[0] + p.n[0] * dist, vc, mid[2] + p.n[2] * dist], target: mid, fov, ...size},
    {eye: [mid[0] + rx * dist, vc + span * 0.15, mid[2] + rz * dist], target: mid, fov, ...size},
  ]);
  const out = path.join(dir, `closeup-g${gi}-${at}.png`);
  await contactSheet([{image: front, text: `walls[${gi}] panel ${pi} front-on, ${span} m`}, {image: three, text: '3/4 from the right'}], out, {width: 720, height: 560}, `${id} — walls[${gi}] close-up`);
  console.log(out);
} finally { await closeRenderer(); }
