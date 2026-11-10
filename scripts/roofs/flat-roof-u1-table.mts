/**
 * Lane R5-E (#265) step 1, the table: reads tests/e2e/flat-roofs-u1.spec.ts's output (the rendered lids at the user's U1
 * pose), keeps the buildings the runtime draws with a flat lid (meshBuildingFor, the chunk builders' own function), and
 * adds the PDOK orthophoto's median luma inside each footprint (Beeldmateriaal Nederland, CC BY 4.0; the roof-facts
 * sampler, 0.5 m eroded), the lid colour and where it came from (measured slot / mapped tag / prior), and the furniture.
 *
 *   npx tsx scripts/roofs/flat-roof-u1-table.mts [--in=artifacts/flat-roofs/u1-main.json] [--top=15] [--md]
 */
import fs from 'node:fs';
import path from 'node:path';
import { OrthoMosaic } from './orthoTiles.ts';
import { roofPixels, type Pand } from './roofPixels.ts';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';
import { meshBuildingFor, type Feature } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { hexToRgb, lumaOf, type BuildingLook } from '../../src/canalRecall/look/palette.ts';
import { lookVariant } from '../../src/canalRecall/threeBuildingMesh.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const IN = path.resolve(arg('in') ?? 'artifacts/flat-roofs/u1-main.json');
const TOP = Number(arg('top') ?? 15);
const run = JSON.parse(fs.readFileSync(IN, 'utf8'));
const mosaic = new OrthoMosaic('Actueel_ortho25', 14);
const ringArea = (r: number[][]) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a / 2); };

export async function orthoLuma(feature: Feature): Promise<{ luma: number; n: number; areaM2: number }> {
  const g = feature.geometry as { type: string; coordinates: any };
  const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const polygons = polys.map(poly => poly.map(ring => ring.map(([lng, lat]) => lngLatToRd(lng, lat)) as Array<[number, number]>));
  const xs = polygons.flatMap(p => p[0].map(q => q[0])), ys = polygons.flatMap(p => p[0].map(q => q[1]));
  const areaM2 = polygons.reduce((s, p) => s + ringArea(p[0]) - p.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
  const pand: Pand = { id: '', tile: '', roof: 1, height: 0, eaves: null, ridge: null, year: null, polygons, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], areaM2, anchor: polys[0][0][0] as [number, number] };
  await mosaic.load(...pand.bbox);
  const px = roofPixels(pand, mosaic, 0.5);
  const l: number[] = []; for (let i = 0; i < px.n; i++) l.push(lumaOf([px.rgb[i * 3], px.rgb[i * 3 + 1], px.rgb[i * 3 + 2]]));
  l.sort((a, b) => a - b);
  return { luma: l.length ? l[l.length >> 1] : NaN, n: l.length, areaM2 };
}

const rows = [];
for (const r of run.rows) {
  if (r.renderedLuma === null || r.renderedPx < 200) continue;
  const f = r.feature as Feature, p = f.properties;
  const b = meshBuildingFor(f, run.look as BuildingLook, false);
  const flat = !!b?.lid && !b.surveyedEnvelope && (!b.roof || !!b.roof.plan.keepLid || b.roof.plan.kind === 'parapet');
  if (!flat) continue;
  const mapped = typeof p.roofColour === 'string' && p.roofColour !== p.colour;
  const ortho = await orthoLuma(f);
  const furniture = typeof p.roofFurniture === 'string' && p.roofFurniture ? p.roofFurniture.split(',').length / 6 : 0;
  rows.push({
    id: r.id.replace('NL.IMBAG.Pand.', ''), year: p.constructionYear ?? null, areaM2: Math.round(ortho.areaM2), renderedPx: r.renderedPx,
    rendered: r.renderedLuma, ortho: Math.round(ortho.luma), delta: Math.round(r.renderedLuma - ortho.luma),
    source: p.roofSlot ? 'measured' : mapped ? 'mapped' : 'prior',
    which: p.roofSlot ? `${p.roofSlot} (${p.roofConfidence})` : mapped ? String(p.roofColour) : ['gravel', 'white-membrane', 'bitumen-dark', 'bitumen-light'][lookVariant(String(p.id)) % 4],
    lidHex: b!.lid!.hex, tint: Math.round(lumaOf(hexToRgb(b!.lid!.hex))),
    furniture, terrace: p.roofTerrace === true, furnitureDrawn: furniture > 0 && r.keys.some((k: string) => k.startsWith('extras:')) && !!b!.extras,
    tiers: [...new Set(r.keys.map((k: string) => k.split(':')[0]))].join('+'), largeTier: p.largeTier ?? null,
  });
  if (rows.length >= TOP) break;
}
console.table(rows.map(({ id, ...r }) => ({ id: id.slice(-8), ...r })));
const within = rows.filter(r => Math.abs(r.delta) <= 10).length;
console.log(`within ±10: ${within}/${rows.length}; mean Δ ${(rows.reduce((s, r) => s + r.delta, 0) / Math.max(1, rows.length)).toFixed(1)}; median |Δ| ${rows.map(r => Math.abs(r.delta)).sort((a, b) => a - b)[rows.length >> 1]}`);
fs.writeFileSync(IN.replace(/\.json$/, '-table.json'), JSON.stringify(rows, null, 1));
if (process.argv.includes('--md')) {
  console.log('| pand | year | m² | rendered | ortho | Δ | lid from | slot / prior | furniture (drawn) | tiers |\n|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.year ?? '–'} | ${r.areaM2} | ${r.rendered} | ${r.ortho} | ${r.delta > 0 ? '+' : ''}${r.delta} | ${r.source} | ${r.which} | ${r.furniture}${r.terrace ? '+terrace' : ''} (${r.furnitureDrawn ? 'yes' : 'no'}) | ${r.tiers} |`);
}
