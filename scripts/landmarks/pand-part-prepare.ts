/**
 * Prepare a landmark that stands on part of its BAG pand (src/canalRecall/landmarks/pandParts.ts).
 *
 *   node --import tsx scripts/landmarks/pand-part-prepare.ts <id>
 *
 * Reads `pandPart.ring` (lng/lat) from scripts/landmarks/<id>-spec.json and the shell from <id>-footprints.json
 * (bag-shell-prepare.ts). Measures the rest's heights from the 3DBAG roof faces outside the ring and writes them to
 * `pandPart.rest` in the spec (the tile's pand height is the landmark's). Prints the part's faces and the cut line the
 * builder closes with a party wall. Then catalogue-entry-from-shell.ts writes `pandParts` into the catalogue.
 */
import fs from 'node:fs';
import {clippedOutline, cutSegments, inPart, type PartSource} from './pand-part-shell';
import {fullPand, type PandPart} from '../../src/canalRecall/landmarks/pandParts';

const id = process.argv[2];
if (!id) throw new Error('usage: pand-part-prepare.ts <id>');
const specFile = `scripts/landmarks/${id}-spec.json`;
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8')) as PartSource & {bagId: string};
if (!spec.pandPart?.ring) throw new Error(`${specFile}: no pandPart.ring`);
const part: PandPart = {pand: fullPand(String(src.bagId)), ring: spec.pandPart.ring};
const inside = inPart(src, part);

const area = (pts: number[][]) => { // plan area of a face (x, z)
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][2] - pts[i][0] * pts[j][2];
  return Math.abs(a) / 2;
};
const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');
const restRoofs = roofs.filter(s => !inside(s)), partRoofs = roofs.filter(s => inside(s));
// Area-weighted heights: the tile `height` is the 3DBAG roof's 70th percentile above ground.
const weighted = (faces: typeof roofs) => faces.map(s => ({h: s.rings[0].reduce((a, p) => a + p[1], 0) / s.rings[0].length, w: area(s.rings[0])})).sort((a, b) => a.h - b.h);
const pct = (list: {h: number; w: number}[], q: number) => {
  const total = list.reduce((a, x) => a + x.w, 0);
  let acc = 0;
  for (const x of list) { acc += x.w; if (acc >= q * total) return x.h; }
  return list.at(-1)?.h ?? 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const restList = weighted(restRoofs), partList = weighted(partRoofs);
const restVerts = restRoofs.flatMap(s => s.rings[0].map(p => p[1])).sort((a, b) => a - b);
const rest = {height: r2(pct(restList, 0.7)), eaves: r2(restVerts[Math.floor(restVerts.length * 0.1)] ?? 0), ridge: r2(restVerts.at(-1) ?? 0)};
spec.pandPart = {...spec.pandPart, rest};
fs.writeFileSync(specFile, `${JSON.stringify(spec, null, 1)}\n`);

const outline = clippedOutline(src, part);
console.log(`${id}: part ${partRoofs.length} roof faces (70th pct ${r2(pct(partList, 0.7))} m), rest ${restRoofs.length} roof faces -> rest ${JSON.stringify(rest)}`);
console.log(`clipped outline: ${outline.length} vertices`);
for (const [a, b] of cutSegments(src, part)) console.log(`  cut line (${a.map(r2)}) -> (${b.map(r2)}), ${r2(Math.hypot(b[0] - a[0], b[1] - a[1]))} m`);
