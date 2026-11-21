/**
 * Round 2 (lane postwar-kit-r2-20261121): which sampled post-1965 members have a curved street front in their BAG
 * footprint, as the game meshes it (pipeline.ts gameChain, the styled feature's ring). A curve here is a chain of 3+
 * consecutive edges, each under CURVE_MAX_EDGE_M and turning 2-25 deg the same way, over a total turn of at least 20 deg.
 *   node --import tsx scripts/postwar-kit/curve-scan.ts  -> artifacts/postwar-kit/curves.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { curvedChains } from '../../src/canalRecall/postwarKit/curve.ts';
const { gameChain, loadTile } = await import('../world/pipeline.ts');
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample-all.json'), 'utf8')) as Record<string, any>;
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)}`; };
const want = new Set(Object.keys(sample).map(id => `NL.IMBAG.Pand.${id}`));
const tiles = new Set(Object.values(sample).map((r: any) => tileOf(r.centroid[0], r.centroid[1])));
const chain = gameChain(), out: Record<string, unknown> = {};
for (const t of tiles) for (const row of await loadTile(t, chain)) {
  const f = row.styled, id = String(f.properties.id ?? '');
  if (!want.has(id) || out[id.slice(14)]) continue;
  const g = f.geometry, rings: number[][][] = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p: number[][][]) => p[0]);
  const lat0 = rings[0][0][1], k = 111_320 * Math.cos(lat0 * Math.PI / 180);
  const chains = rings.flatMap(r => curvedChains(r.map(([x, y]) => [x * k, y * 110_540] as [number, number])));
  if (chains.length) out[id.slice(14)] = { address: sample[id.slice(14)].address, chains: chains.map(c => ({ edges: c.edges, turnDeg: Math.round(c.turnDeg), lenM: Math.round(c.lenM), radiusM: Math.round(c.radiusM) })) };
}
fs.writeFileSync(path.join(OUT, 'curves.json'), JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'curved of', want.size);
for (const [id, r] of Object.entries(out) as any) console.log(id, r.address, JSON.stringify(r.chains));
