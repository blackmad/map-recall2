/** Compile REC-A with the large tier, print counts and write an artifact GLB + quick views: `node --import tsx scripts/landmarks/roeterseiland-stats.ts [--render]`. */
import fs from 'node:fs/promises';
import * as T from 'three';
import sharp from 'sharp';
import {canalhouseGroupToGlb} from '../canalhouse-recipes/export-glb.ts';
import {compileRoeterseiland} from './roeterseiland-builder';
import {closeRenderer, renderModels} from '../building-recipes/render.ts';

const {built, stats} = compileRoeterseiland();
console.log('hand-drawn', JSON.stringify(stats), 'kit', JSON.stringify(built.stats));
console.log('components', JSON.stringify(built.components));
console.log('fit warnings', built.fit.warnings.slice(0, 8));
const per = new Map<string, number>();
let total = 0;
built.group.traverse(o => {
  if (!(o instanceof T.Mesh)) return;
  const g = o.geometry as T.BufferGeometry, n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  total += n; per.set(o.name, (per.get(o.name) ?? 0) + n);
});
console.log('triangles', total, [...per].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k} ${v}`).join(' | '));
const out = 'artifacts/building-recipes/roeterseiland-rec-a';
await fs.mkdir(out, {recursive: true});
const glb = await canalhouseGroupToGlb('roeterseiland-rec-a', built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 8_000_000});
await fs.writeFile(`${out}/stats.glb`, glb.bytes);
console.log('glb', glb.bytes.length, 'bytes', glb.triangles, 'tris');
if (process.argv.includes('--render')) {
  const file = `${out}/stats.glb`, size = {width: 900, height: 600};
  const views = [
    {name: 'from-canal-east', eye: [140, 3, 25], target: [30, 22, 25], fov: 50},
    {name: 'from-canal-west', eye: [-110, 3, 30], target: [30, 22, 30], fov: 50},
    {name: 'from-north-street', eye: [-10, 3, 20], target: [-5, 20, 75], fov: 55},
    {name: 'aerial-se', eye: [150, 110, 190], target: [20, 10, 30], fov: 40},
    {name: 'aerial-nw', eye: [-120, 100, -140], target: [20, 10, 30], fov: 40},
  ];
  const imgs = await renderModels([{file}], views.map(v => ({eye: v.eye, target: v.target, fov: v.fov, ...size})));
  for (let i = 0; i < views.length; i++) await sharp(imgs[i]).png().toFile(`${out}/view-${views[i].name}.png`);
  await closeRenderer();
}
