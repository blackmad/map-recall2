/**
 * Crop-to-native wall lines for a hand-modelled block (lane hand-blocks-a-20261121).
 *
 *   node --import tsx scripts/landmarks/hand-block-walls.ts <id> [--min-len=4] [--setback[=<min m>]]
 *
 * Recomputes the exposed walls exactly as landmark-brief.ts tags them (w<NN>-<bearing>, longest first) and prints, per wall,
 * its end points in the native frame of scripts/landmarks/<id>-footprints.json (x east, z south, metres from the anchor),
 * `a` = the viewer's left end of the rectified crop and `b` the right end, the outward normal `n`, and the crop scale
 * (px per metre = crop width / wall length; the crop's bottom row is the panorama's street level, its top is the
 * tile height + 1.5 m) and `line`, the wall as a house:preview `--wall line:` (the render of today at the photo pose).
 * A front in a `*-builder.ts` is then `{a, b, n}` plus metres read off the crop. --setback also lists the upper fronts
 * behind the footprint (s<NN>-<bearing>, as landmark-brief.ts --setback crops them), with their foot and top heights.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {findPands, neighbourhood, normId, rdToLngLat} from '../pand-reference/core.ts';
import {exposedWalls, type Wall} from '../pand-reference/select.ts';
import {setbackWallsForPand} from '../pand-reference/setback-walls.ts';

const id = process.argv[2];
if (!id) throw new Error('usage: hand-block-walls.ts <id> [--min-len=4]');
const minLen = Number(process.argv.find(a => a.startsWith('--min-len='))?.slice(10) ?? 4);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const pand = normId(String(src.bagId));
const fp = (await findPands([pand])).get(pand);
if (!fp) throw new Error(`pand ${pand} not in the building tiles`);
const centre = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
const walls = exposedWalls(fp, await neighbourhood(centre)).sort((a, b) => b.len - a.len).filter(w => w.len >= minLen).slice(0, 30);
const ll = (p: {x: number; y: number}) => rdToLngLat(p).map(v => v.toFixed(7)).join(',');
const nat = (p: {x: number; y: number}) => [+(p.x - src.anchorRD[0]).toFixed(2), +(src.anchorRD[1] - p.y).toFixed(2)];
const setbackArg = process.argv.find(a => a === '--setback' || a.startsWith('--setback='));
const setback = setbackArg ? await setbackWallsForPand(pand, fp.ring, {minLen, minSetbackM: setbackArg.includes('=') ? Number(setbackArg.split('=')[1]) : 2}) : [];
let i = 0, si = 0;
for (const w of [...walls, ...setback] as (Wall & {native?: {footM: number; topM: number; setbackM: number}})[]) {
  const bearing = Math.round((Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360) % 360;
  const tag = w.native ? `s${String(++si).padStart(2, '0')}-${bearing}` : `w${String(++i).padStart(2, '0')}-${bearing}`;
  const crop = path.join('artifacts/landmark-briefs', id, `${tag}.jpg`);
  const meta = fs.existsSync(crop) ? await sharp(crop).metadata() : null;
  const ppm = meta ? meta.width! / w.len : null;
  console.log(JSON.stringify({tag, len: +w.len.toFixed(2), a: nat(w.a), b: nat(w.b), n: [+w.nx.toFixed(4), +(-w.ny).toFixed(4)],
    line: `line:${ll(w.a)},${ll(w.b)}`,
    ...(w.native ? {footM: +w.native.footM.toFixed(2), topM: +w.native.topM.toFixed(2), setbackM: +w.native.setbackM.toFixed(2)} : {}), ...(meta ? {crop: `${meta.width}x${meta.height}`, ppm: +ppm!.toFixed(2), cropHeightM: +(meta.height! / ppm!).toFixed(2)} : {})}));
}
