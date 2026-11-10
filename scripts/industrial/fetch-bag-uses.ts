// BAG gebruiksdoel per pand for the industrial classifier (lane industrial-kit 2026-11-10).
//   npx tsx scripts/industrial/fetch-bag-uses.ts [--out=.cache/industrial/bag-uses.json]
// Pages PDOK's BAG WFS (open data) for every Amsterdam verblijfsobject whose gebruiksdoel is not plain woonfunctie
// and sums floor area per pand and use. Pands absent from the result have only housing (or no VBO at all).
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? '.cache/industrial/bag-uses.json';
const WFS = 'https://service.pdok.nl/lv/bag/wfs/v2_0';
// The WFS stops paging at 50,000: the city is fetched in RD x stripes, each well under that.
const STRIPES = [[100000, 117000], [117000, 120500], [120500, 122500], [122500, 125000], [125000, 145000]];
const FILTER = ([x0, x1]: number[]) => `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0" xmlns:gml="http://www.opengis.net/gml/3.2"><fes:And><fes:PropertyIsNotEqualTo><fes:ValueReference>gebruiksdoel</fes:ValueReference><fes:Literal>woonfunctie</fes:Literal></fes:PropertyIsNotEqualTo><fes:PropertyIsEqualTo><fes:ValueReference>woonplaats</fes:ValueReference><fes:Literal>Amsterdam</fes:Literal></fes:PropertyIsEqualTo><fes:BBOX><fes:ValueReference>geom</fes:ValueReference><gml:Envelope srsName="urn:ogc:def:crs:EPSG::28992"><gml:lowerCorner>${x0} 470000</gml:lowerCorner><gml:upperCorner>${x1} 500000</gml:upperCorner></gml:Envelope></fes:BBOX></fes:And></fes:Filter>`;
const PAGE = 1000;

type Uses = Record<string, { vbos: number; area: Record<string, number> }>;
const pands: Uses = {};
let total = 0;
const pages = path.join(path.dirname(out), 'bag-pages');
fs.mkdirSync(pages, { recursive: true });
for (const stripe of STRIPES) for (let start = 0; ; start += PAGE) {
  const cached = path.join(pages, `${stripe[0]}-${start}.json`);
  let json: any = fs.existsSync(cached) ? JSON.parse(fs.readFileSync(cached, 'utf8')) : null;
  const q = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'bag:verblijfsobject', outputFormat: 'application/json', count: String(PAGE), startIndex: String(start), sortBy: 'identificatie', filter: FILTER(stripe) });
  for (let attempt = 0; attempt < 5 && !json; attempt++) {
    try { const r = await fetch(`${WFS}?${q}`); if (r.ok) { json = await r.json(); fs.writeFileSync(cached, JSON.stringify(json)); } } catch { /* retry */ }
    if (!json) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
  }
  if (!json) throw new Error(`WFS page ${stripe[0]}+${start} failed`);
  const features = json.features ?? [];
  for (const f of features) {
    const p = f.properties, pand = String(p.pandidentificatie ?? '');
    if (!pand || !String(p.status ?? '').includes('in gebruik')) continue;
    const row = (pands[pand] ??= { vbos: 0, area: {} });
    row.vbos++;
    const uses = String(p.gebruiksdoel ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
    for (const u of uses) row.area[u] = (row.area[u] ?? 0) + (Number(p.oppervlakte) || 0) / uses.length;
  }
  total += features.length;
  process.stdout.write(`\r${total} vbos, ${Object.keys(pands).length} pands`);
  if (features.length < PAGE) break;
  if (start + PAGE >= 50000) throw new Error(`stripe ${stripe} exceeds the WFS paging limit`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), source: `${WFS} bag:verblijfsobject, gebruiksdoel != woonfunctie, woonplaats Amsterdam, status in gebruik`, vbos: total, pands }));
console.log(`\nwrote ${out}`);
