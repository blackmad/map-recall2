/**
 * Canal-belt pand list for the window/accent survey (2026-10-14): every BAG pand whose centroid lies within 22 m of
 * the Herengracht, Keizersgracht or Prinsengracht street line, with its BAG build year, register gable type and
 * municipal-monument record (name | yearFrom | yearTo). Local extracts only (streets.json + streets-routing.json: the canals are routing streets).
 *
 *   node --import tsx scripts/research/canal-windows/list-pands.ts --out=staging/canal-windows/pands.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {loadTile, lngLatToRd, nearestOnSeg} from '../../pand-reference/core.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const mons = new Map<string, unknown[][]>();
const d = JSON.parse(await fs.readFile('scripts/data/amsterdam-monuments.json', 'utf8'));
for (const m of d.monuments) for (const p of m[7] ?? []) (mons.get(p) ?? mons.set(p, []).get(p)!).push(m);
const gables = JSON.parse(await fs.readFile('public/data/extracts/amsterdam/monument-gables.json', 'utf8')).buildings;
const streets = [...JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets.json', 'utf8')), ...JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8'))];
const root = 'public/data/extracts/amsterdam/building-tiles/14';
const tiles: [number, number][] = [];
for (const x of await fs.readdir(root)) for (const f of await fs.readdir(path.join(root, x))) tiles.push([Number(x), Number(f.split('.')[0])]);
const out: {street: string; bag: string; year: number | null; heightM: number; gable: string | null; monument: string}[] = [];
for (const street of ['Herengracht', 'Keizersgracht', 'Prinsengracht']) {
  const segs: {a: {x: number; y: number}; b: {x: number; y: number}}[] = [];
  for (const s of streets) if (s.name === street) for (const p of s.paths ?? [s.path]) for (let i = 0; i + 1 < p.length; i++) segs.push({a: lngLatToRd([p[i][1], p[i][0]]), b: lngLatToRd([p[i + 1][1], p[i + 1][0]])});
  for (const [x, y] of tiles) {
    let facts: {buildings?: Record<string, number[]>} | null = null;
    try { const b = await fs.readFile(`public/data/extracts/amsterdam/building-facts/14/${x}/${y}.json.gz`); facts = JSON.parse((b[0] === 0x1f ? zlib.gunzipSync(b) : b).toString()); } catch { /* optional */ }
    for (const fp of await loadTile(x, y)) {
      if (!fp.id.startsWith('NL.IMBAG.Pand.')) continue;
      const c = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
      if (!segs.some(s => nearestOnSeg(c, s).d < 22)) continue;
      const bag = fp.id.slice(14);
      out.push({street, bag, year: facts?.buildings?.[`P${bag}`]?.[0] ?? null, heightM: fp.height, gable: gables[fp.id] ?? null, monument: (mons.get(bag) ?? []).map(q => [q[2], q[4], q[5]].join('|')).join(' ; ')});
    }
  }
}
await fs.mkdir(path.dirname(arg('out', 'staging/canal-windows/pands.json')), {recursive: true});
await fs.writeFile(arg('out', 'staging/canal-windows/pands.json'), JSON.stringify(out, null, 1));
console.log(out.length, 'pands');
