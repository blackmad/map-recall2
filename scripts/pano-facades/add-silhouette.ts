/**
 * Re-measure the roofline outline and wall colour of already-built landmark facades,
 * without fetching panoramas again: `npx tsx scripts/pano-facades/add-silhouette.ts [name...]`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { photoSilhouette } from '../../src/canalRecall/facade/photoSilhouette.ts';

const dir = path.resolve('public/data/landmark-facades');
const names = process.argv.slice(2).length ? process.argv.slice(2)
  : (await fs.readdir(dir)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
for (const name of names) {
  const file = path.join(dir, `${name}.json`), meta = JSON.parse(await fs.readFile(file, 'utf8'));
  const image = jpeg.decode(await fs.readFile(path.join(dir, meta.image)), { useTArray: true });
  meta.silhouette = photoSilhouette({ width: image.width, height: image.height, data: new Uint8ClampedArray(image.data.buffer) }, meta.pixelsPerMetre);
  await fs.writeFile(file, JSON.stringify(meta, null, 1));
  const tops = meta.silhouette.topsM as number[];
  console.log(`${name}: top ${Math.min(...tops).toFixed(1)}–${Math.max(...tops).toFixed(1)} m of ${meta.wall.heightM} m, colour ${meta.silhouette.wallColour}`);
}
