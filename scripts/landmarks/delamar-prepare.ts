/**
 * DeLaMar shell source: the 3DBAG LoD2.2 shells of the three BAG pands the DeLaMar landmark stands for (the catalogue's
 * suppressOsmIds), in one native frame, plus the neighbouring footprints and heights for the exposure analysis.
 *
 *   node --import tsx scripts/landmarks/delamar-prepare.ts [--out=scripts/landmarks/delamar-shell.json] [--facts=<facts.json with neighboursRD>]
 *
 * Pands: 0363100012169852 Theater Bellevue (Leidsekade 90, 1894 BAG year; the 1938 drum and the 1960s/2010 halls),
 * 0363100012571556 Theater DeLaMar (2010) and 0363100012169853 (2010, its Marnixstraat north end). The Quentin hotel
 * corner house (0363100012168512, Leidsekade 89, 1888), which the old box model also suppressed, is not DeLaMar and is
 * left to the city layer. Items come from the 3DBAG API (CC BY 4.0), cached under .cache/3dbag/.
 *
 * Frame: x east, z south, y up, metres; origin = vertex average of the three BAG footprints (RD), y = 0 at each pand's
 * own 3DBAG ground (b3_h_maaiveld). The spec's `surveyed.anchor` is the origin in lng/lat.
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

export const DELAMAR_PANDS = ['0363100012169852', '0363100012571556', '0363100012169853'] as const;

type Item = {feature: {CityObjects: Record<string, {type: string; attributes?: Record<string, unknown>; geometry?: {lod: string | number; boundaries: unknown; semantics?: {surfaces: {type: string}[]; values: number[][]}}[]}>; vertices: number[][]}; metadata: {transform: {scale: number[]; translate: number[]}}};

async function item(pand: string): Promise<Item> {
  const file = path.join('.cache', '3dbag', `${pand}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`);
  if (!r.ok) throw Error(`3DBAG ${pand}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j as Item;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

async function main() {
  const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'scripts/landmarks/delamar-shell.json';
  const items = await Promise.all(DELAMAR_PANDS.map(item));
  const decoded = items.map((it, k) => {
    const t = it.metadata.transform, verts = it.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
    let attributes: Record<string, unknown> = {};
    const footprint: number[][] = [], surfaces: {type: string; rings: number[][][]}[] = [];
    for (const o of Object.values(it.feature.CityObjects)) {
      if (o.type === 'Building') attributes = o.attributes ?? {};
      for (const g of o.geometry ?? []) {
        if (String(g.lod) === '0' && !footprint.length) for (const k2 of ((g.boundaries as number[][][])[0][0])) footprint.push(verts[k2].slice(0, 2));
        if (String(g.lod) !== '2.2' || !g.semantics) continue;
        const shells = g.boundaries as number[][][][];
        shells.forEach((shell, si) => shell.forEach((surface, j) => {
          const type = g.semantics!.surfaces[g.semantics!.values[si][j]]?.type ?? 'WallSurface';
          surfaces.push({type, rings: surface.map(r => r.map(i => verts[i]))});
        }));
      }
    }
    return {pand: DELAMAR_PANDS[k], attributes, footprint, surfaces};
  });
  const all = decoded.flatMap(d => d.footprint);
  const ax = all.reduce((s, p) => s + p[0], 0) / all.length, ay = all.reduce((s, p) => s + p[1], 0) / all.length;
  const ground = Number(decoded[0].attributes.b3_h_maaiveld);
  // Each pand stands on its own 3DBAG ground (Marnixstraat is 0.31 m above the Leidsekade, 169853's estimate 1.37 m): y = 0
  // at every pand's foot, so no front floats over the landmark's flat ground.
  const L = (g: number) => (p: number[]) => [r3(p[0] - ax), r3((p[2] ?? g) - g), r3(-(p[1] - ay))];
  // Neighbour rings and heights come from a scratch `facts.ts --large` run (not committed; the result is baked into the shell):
  //   node --import tsx scripts/building-recipes/facts.ts --house=delamar --pand=0363100012169852 --large --no-photo
  const factsFile = process.argv.find(a => a.startsWith('--facts='))?.slice(8) ?? 'scripts/building-recipes/houses/delamar/facts.json';
  const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
  const members = new Set(DELAMAR_PANDS.map(p => `NL.IMBAG.Pand.${p}`));
  const neighbours = (facts.neighboursRD as {id: string; heightM: number; ringRD: number[][]}[])
    .filter(n => !members.has(n.id))
    .map(n => ({id: n.id.slice(-16), heightM: r3(n.heightM), ring: n.ringRD.map(p => [r3(p[0] - ax), r3(-(p[1] - ay))])}));
  const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
  const json = {
    id: 'delamar', anchorRD: [r3(ax), r3(ay)], anchor, groundNAP: ground,
    coordinateConvention: 'native east/south metres from anchor (RD axes); y above each pand\'s own 3DBAG ground',
    source: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<id> (3DBAG, CC BY 4.0)',
    pands: decoded.map(d => ({
      pand: d.pand, groundNAP: r3(Number(d.attributes.b3_h_maaiveld)), roofMaxNAP: r3(Number(d.attributes.b3_h_dak_max)),
      footprint: d.footprint.map(p => [r3(p[0] - ax), r3(-(p[1] - ay))]),
      surfaces: d.surfaces.filter(s => s.type !== 'GroundSurface').map(s => ({type: s.type, rings: s.rings.map(r => r.map(L(Number(d.attributes.b3_h_maaiveld))))})),
    })),
    neighbours,
  };
  fs.writeFileSync(out, JSON.stringify(json));
  console.log(out, 'anchor', anchor, 'surfaces', json.pands.map(p => `${p.pand.slice(-6)}:${p.surfaces.length}`).join(' '), 'neighbours', neighbours.length);
}
await main();
