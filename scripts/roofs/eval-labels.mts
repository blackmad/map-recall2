/**
 * Accuracy of `classifyRoof` on the hand-labelled 100 (`fixtures/roof-labels-100.json`).
 * Reports family agreement, slot agreement (labels mapped to slots by the 3DBAG roof type), the
 * tuning half (first 50) against the held-out half, and the confusion; `--sheet` also draws the
 * crops with "label/predicted"; `--sweep` scans the neutral cuts on the tuning half only.
 *
 *   tsx scripts/roofs/eval-labels.mts [--sheet] [--sweep] [--verbose] [--out=artifacts/roofs/labels]
 */
import fs from 'node:fs';
import path from 'node:path';
import { OrthoMosaic } from './orthoTiles.ts';
import { readPands, roofPixels, type Pand, type RoofPixels } from './roofPixels.ts';
import { classifyRoof, slotForFamily, tuneNeutral, SURFACE_PERCENTILE, DARK_BELOW, LIGHT_FROM, type RoofFamily } from '../../src/canalRecall/roofs/roofSlots.ts';

const OUT = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'artifacts/roofs/labels');
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/roof-labels-100.json', import.meta.url), 'utf8')) as { labels: Record<string, RoofFamily>; roof: Record<string, number> };
const ids = Object.keys(fixture.labels);
const want = new Set(ids);
const pands = new Map<string, Pand>();
for (const p of readPands(path.resolve('public/data/extracts/amsterdam/bag-tiles/14'))) if (want.has(p.id)) pands.set(p.id, p);
const mosaic = new OrthoMosaic('Actueel_ortho25', 14);
const pixels = new Map<string, RoofPixels>();
for (const id of ids) {
  const p = pands.get(id)!, [a, b, c, d] = p.bbox;
  await mosaic.load(a - 2, b - 2, c + 2, d + 2);
  pixels.set(id, roofPixels(p, mosaic));
  if (mosaic.size > 300) mosaic.clear();
}

export function evaluate(verbose = false) {
  let fam = 0, slot = 0, slotN = 0, flatOk = 0, flatN = 0, pitchedOk = 0, pitchedN = 0;
  const confusion: Record<string, Record<string, number>> = {}, shown: string[] = [], half: boolean[][] = [[], []], rows: string[] = [];
  for (const [k, id] of ids.entries()) {
    const p = pands.get(id)!, px = pixels.get(id)!;
    const r = classifyRoof(px.rgb, px.n, p.roof);
    const label = fixture.labels[id], predicted = r?.family ?? '-';
    (confusion[label] ??= {})[predicted] = (confusion[label]?.[predicted] ?? 0) + 1;
    if (predicted === label) fam++;
    const wantSlot = slotForFamily(label, p.roof);
    if (wantSlot) {
      slotN++; const ok = r?.slot === wantSlot; if (ok) slot++;
      if (p.roof === 3) { pitchedN++; if (ok) pitchedOk++; } else { flatN++; if (ok) flatOk++; }
      half[k < 50 ? 0 : 1].push(ok);
    }
    shown.push(`${label}/${predicted} ${r?.slot ?? ''}`);
    rows.push(`${k} ${id} roof=${p.roof} label=${label} pred=${predicted} slot=${r?.slot} conf=${r?.confidence} y=${r?.luma} n=${r?.n} ${JSON.stringify(r?.shares)} rgb=${r?.rgb}`);
  }
  if (verbose) console.log(rows.join('\n'));
  return { fam, slot, slotN, flatOk, flatN, pitchedOk, pitchedN, confusion, shown, tuning: half[0].filter(Boolean).length / half[0].length, heldOut: half[1].filter(Boolean).length / half[1].length, halfN: [half[0].length, half[1].length] };
}

if (process.argv.includes('--sweep')) {
  const base = [SURFACE_PERCENTILE, DARK_BELOW, LIGHT_FROM] as const;
  const results: Array<[number, string]> = [];
  for (const p of [0.3, 0.4, 0.5]) for (const dark of [104, 108, 112, 116, 120, 124]) for (const light of [150, 158, 166]) {
    tuneNeutral(p, dark, light);
    const e = evaluate();
    results.push([e.tuning, `p=${p} dark<${dark} light>=${light}: tuning ${(100 * e.tuning).toFixed(0)} % held-out ${(100 * e.heldOut).toFixed(0)} %`]);
  }
  results.sort((a, b) => b[0] - a[0]);
  console.log(results.slice(0, 8).map(r => r[1]).join('\n'));
  tuneNeutral(...base);
}
const e = evaluate(process.argv.includes('--verbose'));
console.log(`\nneutral cuts p=${SURFACE_PERCENTILE} dark<${DARK_BELOW} light>=${LIGHT_FROM}`);
console.log(`family agreement ${e.fam}/${ids.length}; slot agreement ${e.slot}/${e.slotN} (${(100 * e.slot / e.slotN).toFixed(1)} %): flat ${e.flatOk}/${e.flatN}, pitched ${e.pitchedOk}/${e.pitchedN}`);
console.log(`tuning half ${(100 * e.tuning).toFixed(1)} % of ${e.halfN[0]}; held-out half ${(100 * e.heldOut).toFixed(1)} % of ${e.halfN[1]}`);
console.log('confusion (label -> predicted):', JSON.stringify(e.confusion));
if (process.argv.includes('--sheet')) {
  const { drawCrops } = await import('./label-sheet.mts');
  const list = ids.map(id => pands.get(id)!);
  for (let s = 0; s * 20 < list.length; s++) await drawCrops(list.slice(s * 20, s * 20 + 20), path.join(OUT, `eval-sheet-${s}.png`), e.shown.slice(s * 20, s * 20 + 20), 5, 300, s * 20, true);
  console.log('sheets in', OUT);
}
