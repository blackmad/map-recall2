/**
 * Windowless audit for large recipes (lane newbuild-kit, feedback 75242f30): the share of each `kind: large` recipe's
 * wall panel area that falls to `otherWalls` and with it the windowless `blank` system (the factory draft default).
 * Since lane blank-walls-20261114 an unlisted wall is windowless only when `blankWalls` cites a photo (otherWalls.ts);
 * `gridM2` is the unlisted wall area the shader window grid now paints, `blankM2` what stays windowless.
 *   node --import tsx scripts/newbuild/blank-walls.ts [--top=15]
 */
import fs from 'node:fs';
import {fitLarge} from '../../src/canalRecall/buildingRecipe/fit.ts';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
const HOUSES = 'scripts/building-recipes/houses';
const rows: {id: string; other: string; pand: string; blankM2: number; gridM2: number; allM2: number}[] = [];
for (const id of fs.readdirSync(HOUSES)) {
  const f = `${HOUSES}/${id}/intent.json`;
  if (!fs.existsSync(f) || !fs.existsSync(`${HOUSES}/${id}/facts.json`)) continue;
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (raw.kind !== 'large') continue;
  try {
    const {report, recipe} = fitLarge(validateLargeIntent(raw), JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8')));
    let blank = 0, grid = 0, all = 0;
    for (const p of report.panels) { const a = p.widthM * p.heightM; all += a; if (p.group < 0 && p.system === 'blank') { if (recipe.other.windowGrid) grid += a; else blank += a; } }
    rows.push({id, pand: raw.pandId, other: raw.otherWalls ?? 'blank', blankM2: Math.round(blank), gridM2: Math.round(grid), allM2: Math.round(all)});
  } catch (e) { console.error(id, (e as Error).message.slice(0, 80)); }
}
rows.sort((a, b) => (b.blankM2 + b.gridM2) / b.allM2 - (a.blankM2 + a.gridM2) / a.allM2);
const blankOnes = rows.filter(r => r.blankM2 > 0);
console.log(JSON.stringify({large: rows.length, withBlank: blankOnes.length, blankOver25pct: rows.filter(r => r.blankM2 / r.allM2 > 0.25).length,
  blankM2: rows.reduce((s, r) => s + r.blankM2, 0), gridM2: rows.reduce((s, r) => s + r.gridM2, 0),
  gridHouses: rows.filter(r => r.gridM2 > 0 && r.other !== 'window-grid').length, wallM2: rows.reduce((s, r) => s + r.allM2, 0),
  top: rows.slice(0, Number(process.argv.find(a => a.startsWith('--top='))?.slice(6) ?? 15)).map(r => `${r.id} blank ${Math.round(100 * r.blankM2 / r.allM2)}% grid ${Math.round(100 * r.gridM2 / r.allM2)}% of ${r.allM2} m2`)}, null, 1));
if (process.argv.includes('--pands')) console.log(JSON.stringify(rows.filter(r => r.gridM2 > 0 && r.other !== 'window-grid').map(r => r.pand)));
