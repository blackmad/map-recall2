// BAG housing for the pands the industrial table tags (lane FD, 2026-11-13).
//   npx tsx scripts/industrial/fetch-bag-housing.ts [--out=.cache/industrial/bag-housing.json]
// fetch-bag-uses.ts keeps only VBOs whose gebruiksdoel is not plain woonfunctie, so classifyIndustrial's housing
// share never sees an apartment. This fetches every in-use VBO (all uses) of the works/shed pands, in OR-filter
// batches from PDOK's BAG WFS (open data), cached per batch under .cache/industrial/bag-housing-pages/.
import fs from 'node:fs';
import path from 'node:path';
import { INDUSTRIAL_FILE } from '../../src/canalRecall/industrial/industrialTable.ts';

const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? '.cache/industrial/bag-housing.json';
const WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
const BATCH = 25, PAGE = 1000;
const table = JSON.parse(fs.readFileSync(`public/data/extracts/amsterdam/${INDUSTRIAL_FILE}`, 'utf8')) as { ids: Record<string, string> };
const pandIds = Object.entries(table.ids).filter(([, k]) => k === 'works' || k === 'shed').map(([id]) => id.replace(/^NL\.IMBAG\.Pand\./, '')).sort();
const pages = path.join(path.dirname(out), 'bag-housing-pages');
fs.mkdirSync(pages, { recursive: true });
const filter = (ids: string[]) => `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:Or>${ids.map(i => `<fes:PropertyIsEqualTo><fes:ValueReference>pandidentificatie</fes:ValueReference><fes:Literal>${i}</fes:Literal></fes:PropertyIsEqualTo>`).join('')}</fes:Or></fes:Filter>`;
type Row = { vbos: number; woonVbos: number; area: Record<string, number> };
const pands: Record<string, Row> = {};
for (let b = 0; b * BATCH < pandIds.length; b++) {
  const ids = pandIds.slice(b * BATCH, (b + 1) * BATCH);
  for (let start = 0; ; start += PAGE) {
    const cached = path.join(pages, `${ids[0]}-${start}.json`);
    let json: any = fs.existsSync(cached) ? JSON.parse(fs.readFileSync(cached, 'utf8')) : null;
    const q = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'bag:verblijfsobject', outputFormat: 'application/json', count: String(PAGE), startIndex: String(start), sortBy: 'identificatie', filter: filter(ids) });
    for (let attempt = 0; attempt < 5 && !json; attempt++) {
      try { const r = await fetch(WFS, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: q }); if (!r.ok) console.error(r.status); if (r.ok) { json = await r.json(); fs.writeFileSync(cached, JSON.stringify(json)); } } catch { /* retry */ }
      if (!json) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
    }
    if (!json) throw new Error(`batch ${b} page ${start} failed`);
    const features = json.features ?? [];
    for (const f of features) {
      const p = f.properties, pand = String(p.pandidentificatie ?? '');
      if (!pand || !String(p.status ?? '').includes('in gebruik')) continue;
      const row = (pands[pand] ??= { vbos: 0, woonVbos: 0, area: {} });
      row.vbos++;
      const uses = String(p.gebruiksdoel ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
      if (uses.includes('woonfunctie')) row.woonVbos++;
      for (const u of uses) row.area[u] = (row.area[u] ?? 0) + (Number(p.oppervlakte) || 0) / uses.length;
    }
    process.stdout.write(`\rbatch ${b + 1}/${Math.ceil(pandIds.length / BATCH)}  ${Object.keys(pands).length} pands`);
    if (features.length < PAGE) break;
  }
}
fs.writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), source: `${WFS} bag:verblijfsobject, all uses, in use, pands tagged works/shed in ${INDUSTRIAL_FILE}`, tagged: pandIds.length, pands }));
console.log(`\nwrote ${out}: ${Object.keys(pands).length} of ${pandIds.length} tagged pands have an in-use VBO`);
