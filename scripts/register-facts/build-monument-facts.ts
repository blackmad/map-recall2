// monument-facts.json (#316 step 3 data): parsed register facts per matched pand, staging first.
//   nice -n 19 npx tsx scripts/register-facts/build-monument-facts.ts            stage + coverage report
//   nice -n 19 npx tsx scripts/register-facts/build-monument-facts.ts --publish  integrator only, after review
// Match (round 20261123, the rm 2389 bug): the register's own BAG pand ids first, then the pands of its addresses
// (BAG addresses by postcode, api.data.amsterdam.nl, CC0, cached under .cache/monument-join/), then the RCE point
// inside a z14 footprint as the fallback; see src/canalRecall/facade/monumentPandJoin.ts. Every record whose pand
// differs from the point's pand is listed in the coverage report (`moved`). --offline uses only cached postcodes.
// A pand under several monuments keeps every number; its facts are the first record that names a gable (as the
// gables extract does), falling back to the first record. Ride priority = stadsdeel Centrum + the inner-ring gebieden.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { parseRegisterFacts, type RegisterFacts } from '../../src/canalRecall/facade/registerFacts.ts';
import { joinMonumentToPand, matchUnit, registerAddresses, type BagUnit } from '../../src/canalRecall/facade/monumentPandJoin.ts';

const STAGING = 'public/data/extracts/amsterdam/staging/monument-facts.json';
const REPORT = 'public/data/extracts/amsterdam/staging/monument-facts.coverage.json';
const EXTRACT = process.env.REGISTER_FACTS_PUBLISH_TO ?? 'public/data/extracts/amsterdam/monument-facts.json';
// Moved to src/canalRecall/ridePriority.ts (house line H1); re-exported for existing importers.
import { RIDE_PRIORITY_GEBIEDEN } from '../../src/canalRecall/ridePriority.ts';
export { RIDE_PRIORITY_GEBIEDEN };

type Ring = number[][];
const inside = ([x, y]: number[], ring: Ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
const polys = (g: any): Ring[][] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14; return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n)}`; };
const tiles = new Map<string, any[]>();
const feats = (k: string) => { if (!tiles.has(k)) { const f = `public/data/extracts/amsterdam/building-tiles/14/${k}.geojson.gz`; tiles.set(k, existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString()).features : []); } return tiles.get(k)!; };
const buurten = JSON.parse(readFileSync('public/data/extracts/amsterdam/coverage-v1/buurten.json', 'utf8')).features as any[];
const buurtAt = (p: number[]) => buurten.find(b => polys(b.geometry).some(poly => inside(p, poly[0])))?.properties;

const snap = JSON.parse(gunzipSync(readFileSync('scripts/data/amsterdam-monument-register/records.json.gz')).toString('utf8'));
type Entry = { nrs: string[]; facts: Omit<RegisterFacts, 'sourceNr'> & { sourceNr: string }; buurt?: string; gebied?: string };
const byPand = new Map<string, Entry>();
const stats = { withText: 0, byRegisterPand: 0, byAddress: 0, byPoint: 0, unmatched: 0, disagreeWithPoint: 0, unitsMissing: 0 };

// BAG addresses per postcode with the pands their units lie in (api.data.amsterdam.nl BAG, CC0; current versions only),
// slimmed and cached. Two requests per postcode: nummeraanduidingen (number, letter, addition, unit) and
// verblijfsobjecten (unit -> ligtInPanden), joined on the unit id.
const VBO_DIR = '.cache/monument-join/bag', OFFLINE = process.argv.includes('--offline');
const UA = { 'User-Agent': 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)' };
async function pages(first: string, key: string): Promise<any[]> {
  const out: any[] = [];
  let url: string | null = first;
  for (let page = 0; url && page < 30; page++) {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 4 && !res?.ok; attempt++) { res = await fetch(url, { headers: UA }).catch(() => null); if (!res?.ok) await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
    if (!res?.ok) throw new Error(`BAG ${url}: ${res?.status}`);
    const j = await res.json() as { _embedded: Record<string, any[]>; _links: { next?: { href: string } | null } };
    out.push(...(j._embedded[key] ?? []));
    url = j._links.next?.href ?? null;
  }
  return out;
}
async function unitsFor(pc: string): Promise<BagUnit[]> {
  const file = path.join(VBO_DIR, `${pc}.json`);
  if (!existsSync(file)) {
    if (OFFLINE) return [];
    const api = 'https://api.data.amsterdam.nl/v1/bag';
    const [nas, vbos] = await Promise.all([
      pages(`${api}/nummeraanduidingen/?postcode=${pc}&eindGeldigheid[isnull]=true&_pageSize=1000&_format=json&_fields=huisnummer,huisletter,huisnummertoevoeging,adresseertVerblijfsobject,ligtAanOpenbareruimte`, 'nummeraanduidingen'),
      pages(`${api}/verblijfsobjecten/?heeftHoofdadres.postcode=${pc}&eindGeldigheid[isnull]=true&_pageSize=1000&_format=json&_fields=identificatie,ligtInPanden`, 'verblijfsobjecten'),
    ]);
    const pandsOf = new Map<string, string[]>(vbos.map(v => [String(v.identificatie), (v._links?.ligtInPanden ?? []).map((p: any) => String(p.identificatie))]));
    const units: BagUnit[] = nas.map(n => ({ street: String(n._links?.ligtAanOpenbareruimte?.title ?? ''), number: Number(n.huisnummer), letter: n.huisletter?.toUpperCase() ?? null, addition: n.huisnummertoevoeging?.toUpperCase() ?? null, pands: pandsOf.get(String(n._links?.adresseertVerblijfsobject?.identificatie)) ?? [] })).filter(u => u.pands.length);
    mkdirSync(VBO_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: api, units }));
  }
  return (JSON.parse(readFileSync(file, 'utf8')) as { units: BagUnit[] }).units;
}
const pandAt = (p: number[]): string | null => { const hit = feats(tileOf(p[0], p[1])).find(f => polys(f.geometry).some(poly => inside(p, poly[0]))); return hit ? String(hit.properties.id).replace('NL.IMBAG.Pand.', '') : null; };

// Prefetch the postcodes of records without register pand ids, six at a time.
if (!OFFLINE) {
  const want = new Set<string>();
  for (const r of snap.rce) {
    const addrs = registerAddresses(r.metadata ?? []);
    if (r.bagPandIds.length || addrs.some(a => a.pand)) continue;
    for (const a of addrs) if (a.postcode && !existsSync(path.join(VBO_DIR, `${a.postcode}.json`))) want.add(a.postcode);
  }
  const queue = [...want];
  console.error(`prefetching ${queue.length} postcodes`);
  await Promise.all(Array.from({ length: 6 }, async () => { for (let pc = queue.pop(); pc; pc = queue.pop()) await unitsFor(pc); }));
}

const moved: Array<{ nr: string; address: string; from: string | null; to: string; source: string }> = [];
let fetched = 0;
for (const r of snap.rce) {
  const text = r.descriptions.map((d: any) => d.text).join(' ').trim();
  if (!text) continue;
  stats.withText++;
  const m = r.locations.map((l: any) => /Point\s*\(\s*([\d.]+)\s+([\d.]+)/i.exec(l.value)).find(Boolean);
  const p = m ? [Number(m[1]), Number(m[2])] : null;
  const pointPand = p ? pandAt(p) : null;
  const addrs = registerAddresses(r.metadata ?? []);
  const registerPands = [...new Set([...r.bagPandIds.map(String), ...addrs.flatMap(a => (a.pand ? [a.pand] : []))])];
  const addressPands: string[] = [];
  if (!registerPands.length) {
    for (const a of addrs) {
      if (!a.postcode) continue;
      if (!existsSync(path.join(VBO_DIR, `${a.postcode}.json`))) fetched++;
      const u = matchUnit(a, await unitsFor(a.postcode));
      if (!u) { stats.unitsMissing++; continue; }
      // a unit in several pands: prefer the one under the RCE point, else the first
      addressPands.push(pointPand && u.pands.includes(pointPand) ? pointPand : u.pands[0]);
    }
  }
  const join = joinMonumentToPand({ registerPands, addressPands, pointPand });
  if (!join.pand) { stats.unmatched++; continue; }
  if (join.source === 'register-pand') stats.byRegisterPand++; else if (join.source === 'address') stats.byAddress++; else stats.byPoint++;
  if (join.disagrees) { stats.disagreeWithPoint++; moved.push({ nr: r.monumentNumber, address: addrs.map(a => `${a.street} ${a.number}${a.letter ?? ''}`).slice(0, 3).join('; '), from: pointPand, to: join.pand, source: join.source }); }
  const id = `NL.IMBAG.Pand.${join.pand}`;
  const facts = parseRegisterFacts(r.monumentNumber, text);
  const b = p ? buurtAt(p) : undefined;
  const prev = byPand.get(id);
  if (!prev) byPand.set(id, { nrs: [r.monumentNumber], facts, buurt: b?.name, gebied: b?.gebied });
  else { prev.nrs.push(r.monumentNumber); if (!prev.facts.gable && facts.gable) prev.facts = facts; }
}
console.error(`fetched ${fetched} postcodes from BAG`);
// Compact record: only stated fields; the text stays (provenance, resumable review).
const buildings: Record<string, unknown> = {};
const fieldCount: Record<string, number> = {}, byBuurt: Record<string, { gebied?: string; pands: number; dated: number; gable: number; finish: number; elements: number }> = {};
for (const [id, e] of [...byPand].sort()) {
  const { sourceNr, ...f } = e.facts;
  const rec: Record<string, unknown> = { nr: e.nrs.length > 1 ? e.nrs : sourceNr, ...f };
  if (!f.elements.length) delete rec.elements;
  buildings[id] = rec;
  for (const k of Object.keys(rec)) fieldCount[k] = (fieldCount[k] ?? 0) + 1;
  const key = e.buurt ?? '(no buurt)';
  const s = byBuurt[key] ??= { gebied: e.gebied, pands: 0, dated: 0, gable: 0, finish: 0, elements: 0 };
  s.pands++; if (f.facadeDate || f.coreDate) s.dated++; if (f.gable) s.gable++; if (f.finish) s.finish++; if (f.elements.length) s.elements++;
}
const ride = Object.values(byBuurt).filter(b => b.gebied && RIDE_PRIORITY_GEBIEDEN.has(b.gebied)).reduce((a, b) => a + b.pands, 0);
const out = { version: 1, source: 'Rijksdienst voor het Cultureel Erfgoed, monumentenregister (CC0); parsed by src/canalRecall/facade/registerFacts.ts', generated: new Date().toISOString().slice(0, 10), buildings };
const report = { stats, pands: byPand.size, moved, ridePriorityPands: ride, rideGebieden: [...RIDE_PRIORITY_GEBIEDEN], fieldCount, byBuurt: Object.fromEntries(Object.entries(byBuurt).sort((a, b) => b[1].pands - a[1].pands)) };
mkdirSync(path.dirname(STAGING), { recursive: true });
writeFileSync(STAGING, JSON.stringify(out));
writeFileSync(REPORT, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, moved: `${moved.length} records (see ${REPORT})`, byBuurt: Object.fromEntries(Object.entries(report.byBuurt).slice(0, 12)) }, null, 1));
// The published extract drops `sourceText` (provenance and the review text stay in staging; the game reads parsed fields only).
if (process.argv.includes('--publish')) {
  const published = { ...out, buildings: Object.fromEntries(Object.entries(buildings).map(([id, rec]) => { const { sourceText, ...rest } = rec as Record<string, unknown>; void sourceText; return [id, rest]; })) };
  writeFileSync(EXTRACT, JSON.stringify(published));
  console.log(`published ${EXTRACT} without sourceText: ${(JSON.stringify(published).length / 1e6).toFixed(2)} MB (staging ${(JSON.stringify(out).length / 1e6).toFixed(2)} MB)`);
}
