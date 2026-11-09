// Runs the existing TS measureFacade over the evaluation crops (comparator).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {measureFacade} from '../../src/canalRecall/facade/measure';

const dir = process.argv[2];
const rows = JSON.parse(fs.readFileSync(path.join(dir, 'truth.json'), 'utf8')) as {file: string; ppm: number}[];
const out: Record<string, {bays: number; storeys: number; ms: number}> = {};
for (const r of rows) {
  const {data, info} = await sharp(path.join(dir, r.file)).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const t = performance.now();
  const m = measureFacade({width: info.width, height: info.height, data: new Uint8ClampedArray(data)}, {pixelsPerMetre: r.ppm});
  out[r.file] = {bays: m.bays, storeys: m.storeys.length, ms: Math.round(performance.now() - t)};
}
fs.writeFileSync(path.join(dir, 'measure-ts.json'), JSON.stringify(out));
console.log(Object.keys(out).length, 'measured');
