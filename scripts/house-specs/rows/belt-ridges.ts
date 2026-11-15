/**
 * Lane D (2026-11-15, after David on #391: "Gables still look pretty bad"): each belt row member's ridge, the 3DBAG
 * b3_h_dak_max over its ground, into rows.json `ridgeM`. A street gable's apex is the pand's highest roof point; the row
 * solve stands a stated gable's top there (solve.ts `GABLE_ON_RIDGE`) instead of on the wall median plus its rise, which put
 * every belt gable 1-3 m too high (Herengracht 59: wall median 16.04 + rise 2.8 = 18.84 m, apex 17.91 m).
 * Open data: api.3dbag.nl (CC BY 4.0), cached in .cache/3dbag/<pandId>.json, 500 ms apart, the repo URL as contact.
 *
 *   node --import tsx scripts/house-specs/rows/belt-ridges.ts [--rows herengracht-51-73,...] [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './rowDefs.ts';

const ROWS = path.join(REPO, 'scripts/house-specs/rows/rows.json'), CACHE = path.join(REPO, '.cache/3dbag');
const UA = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The pand's ridge over its ground from a 3DBAG item (null when the item has no heights). */
export function ridgeOf(item: { feature?: { CityObjects?: Record<string, { attributes?: Record<string, number> }> } }): number | null {
  const co = item.feature?.CityObjects ?? {};
  const a = Object.entries(co).find(([k]) => !k.includes('-'))?.[1]?.attributes;
  return a && Number.isFinite(a.b3_h_dak_max) && Number.isFinite(a.b3_h_maaiveld) ? r2(a.b3_h_dak_max - a.b3_h_maaiveld) : null;
}

async function item(pandId: string): Promise<unknown | null> {
  const f = path.join(CACHE, `${pandId}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  await new Promise(r => setTimeout(r, 500));
  const res = await fetch(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pandId}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
  if (!res.ok) { console.error(`${pandId}: HTTP ${res.status}`); return null; }
  const j = await res.json();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(j));
  return j;
}

async function main() {
  const argv = process.argv.slice(2), only = (argv[argv.indexOf('--rows') + 1] ?? '').split(',').filter(Boolean);
  const rowsJson = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
  for (const [id, row] of Object.entries(rowsJson.rows as Record<string, { members: Array<{ pandId: string; label: string; ridgeM?: number }> }>)) {
    if (!id.startsWith('herengracht-') || (argv.includes('--rows') && !only.includes(id))) continue;
    for (const m of row.members) {
      const j = await item(m.pandId), r = j ? ridgeOf(j as never) : null;
      if (r !== null) m.ridgeM = r;
      console.log(`${id} ${m.label.padEnd(8)} ${m.pandId} ridge ${r ?? '-'}`);
    }
  }
  if (argv.includes('--write')) { fs.writeFileSync(ROWS, JSON.stringify(rowsJson, null, 2) + '\n'); console.log('wrote rows.json'); }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
