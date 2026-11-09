/**
 * Lane S3 (#315): detail-tier roofs that hang past their pand footprint. For every building the detail chunk roofs
 * (the default runtime path: loadTile → meshBuildingFor → roofTrianglesForOutline), the farthest any roof vertex
 * stands outside the footprint, seen from above, and the generator path that drew it.
 *   node --import tsx scripts/roofs/measure-roof-overhang.ts [--tiles=8414/5384,...|--all|--at=lng,lat] [--min=1] [--list=40] [--json=out.json] [--hash=roofs.json]
 * Buildings hidden by a placed model (covers.json, kit tables) are counted apart: their roof is the model's.
 */
import '../world/useBrowserMath.js';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { EXTRACT, COVERS, gameChain, loadTile, readJson } from '../world/pipeline.js';
import { KIT_HIDE_IDS } from '../../src/canalRecall/landmarkKits.js';
import { ORIGIN, meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.js';
import { roofTrianglesForOutline, type RoofPlan } from '../../src/canalRecall/roofMesh.js';
import { footprintHangM } from '../../src/canalRecall/roofOverhang.js';

const args = process.argv.slice(2);
const value = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const MIN = Number(value('min') ?? 1), LIST = Number(value('list') ?? 40);
const tileOf = (lng: number, lat: number, z = 14) => { const n = 2 ** z, r = lat * Math.PI / 180; return `${Math.floor((lng + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)}`; };
let tiles: string[];
if (args.includes('--all')) {
  const dir = path.join(EXTRACT, 'building-tiles/14');
  tiles = fs.readdirSync(dir).flatMap(x => fs.readdirSync(path.join(dir, x)).filter(f => f.endsWith('.geojson.gz')).map(f => `${x}/${f.replace('.geojson.gz', '')}`));
} else if (value('at')) {
  const [lng, lat] = value('at')!.split(',').map(Number), [x, y] = tileOf(lng, lat).split('/').map(Number);
  tiles = [-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => `${x + dx}/${y + dy}`));
} else tiles = (value('tiles') ?? '8414/5384').split(',');

const hidden = new Set<string>(KIT_HIDE_IDS);
for (const entry of Object.values<any>(readJson(COVERS).models ?? {})) for (const p of entry.p ?? []) hidden.add(`NL.IMBAG.Pand.${p}`);

/** The generator path a plan came from (roofMesh.planBuildingRoof's branches). */
export function pathOf(plan: RoofPlan, p: Record<string, unknown>): string {
  if (plan.repeatedTerrace) return 'repeatedTerrace';
  if (plan.sourceCrownFront) return 'sourceCrownFront';
  if (plan.perimeterInsetM !== undefined) return 'perimeterInset';
  if (plan.kind === 'parapet') return 'parapet';
  const n = plan.pieces?.length ?? 0;
  const box = n === 1 && plan.clipToOutline && !plan.keepLid;
  const base = plan.keepLid ? 'inscribedPieces' : box ? 'fittedBox+clip' : 'fittedBox';
  return `${base}:${plan.kind}${p.gableShape || p.monumentGable ? '+measured' : ''}${plan.streetRidge ? '+streetRidge' : ''}`;
}

const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const chain = gameChain();
const byPath: Record<string, { roofs: number; over1: number; over3: number; m2: number }> = {};
const rows: Array<{ id: string; tile: string; path: string; kind: string; hangM: number; clip: boolean; lng: number; lat: number }> = [];
let roofs = 0, hiddenRoofs = 0, hiddenOver = 0;
const hashes: Record<string, [string, number]> = {};
for (const tile of tiles) {
  for (const r of await loadTile(tile, chain)) {
    const f = r.styled as any, p = f.properties;
    if (!p.roofPlanned) continue;
    const b = meshBuildingFor(f, 'photo');
    if (!b?.roof) continue;
    const outer = b.polygons[0]?.[0] ?? [];
    const tris = roofTrianglesForOutline(outer, ORIGIN, b.roof.plan, b.heightM, b.roof.dims, kx);
    const hangM = footprintHangM(outer, tris, ORIGIN, kx);
    const id = String(p.id);
    if (hidden.has(id)) { hiddenRoofs++; if (hangM > MIN) hiddenOver++; continue; }
    roofs++;
    if (value('hash')) hashes[id] = [createHash('sha1').update(JSON.stringify(tris)).digest('hex').slice(0, 16), +hangM.toFixed(3)];
    const key = pathOf(b.roof.plan, p);
    const s = byPath[key] ??= { roofs: 0, over1: 0, over3: 0, m2: 0 };
    s.roofs++;
    if (hangM > MIN) { s.over1++; rows.push({ id, tile, path: key, kind: b.roof.plan.kind, hangM: +hangM.toFixed(2), clip: !!b.roof.plan.clipToOutline, lng: +outer[0][0].toFixed(6), lat: +outer[0][1].toFixed(6) }); }
    if (hangM > 3) s.over3++;
  }
}
rows.sort((a, b) => b.hangM - a.hangM);
console.log(`tiles ${tiles.length}, detail roofs ${roofs}, over ${MIN} m: ${rows.length} (> 3 m: ${rows.filter(r => r.hangM > 3).length}); hidden by a model: ${hiddenRoofs} (${hiddenOver} would hang)`);
console.log('path'.padEnd(44), 'roofs'.padStart(7), `>${MIN}m`.padStart(7), '>3m'.padStart(7));
for (const [k, s] of Object.entries(byPath).sort((a, b) => b[1].over1 - a[1].over1)) console.log(k.padEnd(44), String(s.roofs).padStart(7), String(s.over1).padStart(7), String(s.over3).padStart(7));
for (const r of rows.slice(0, LIST)) console.log(`${r.hangM.toFixed(2).padStart(6)} m  ${r.id.replace('NL.IMBAG.Pand.', '')}  ${r.path}  ${r.clip ? 'clip' : ''}  ${r.lng},${r.lat}`);
if (value('hash')) fs.writeFileSync(value('hash')!, JSON.stringify(hashes));
if (value('json')) fs.writeFileSync(value('json')!, JSON.stringify({ tiles: tiles.length, roofs, over: rows.length, byPath, rows }, null, 1));
