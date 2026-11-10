// monument-facts.json (#316 step 3 data): parsed register facts per matched pand, staging first.
//   nice -n 19 npx tsx scripts/register-facts/build-monument-facts.ts            stage + coverage report
//   nice -n 19 npx tsx scripts/register-facts/build-monument-facts.ts --publish  integrator only, after review
// Match: the RCE point inside a z14 footprint (as fetch-monument-gables.ts), else the record's own BAG pand link.
// A pand under several monuments keeps every number; its facts are the first record that names a gable (as the
// gables extract does), falling back to the first record. Ride priority = stadsdeel Centrum + the inner-ring gebieden.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { parseRegisterFacts, type RegisterFacts } from '../../src/canalRecall/facade/registerFacts.ts';

const STAGING = 'public/data/extracts/amsterdam/staging/monument-facts.json';
const REPORT = 'public/data/extracts/amsterdam/staging/monument-facts.coverage.json';
const EXTRACT = 'public/data/extracts/amsterdam/monument-facts.json';
export const RIDE_PRIORITY_GEBIEDEN = new Set(['Centrum-West', 'Centrum-Oost', 'Oud-West, De Baarsjes', 'Westerpark', 'Oud-Zuid', 'De Pijp, Rivierenbuurt', 'Oud-Oost']);

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
const stats = { withText: 0, byPoint: 0, byLink: 0, unmatched: 0 };
for (const r of snap.rce) {
  const text = r.descriptions.map((d: any) => d.text).join(' ').trim();
  if (!text) continue;
  stats.withText++;
  const m = r.locations.map((l: any) => /Point\s*\(\s*([\d.]+)\s+([\d.]+)/i.exec(l.value)).find(Boolean);
  const p = m ? [Number(m[1]), Number(m[2])] : null;
  let id: string | null = null;
  if (p) { const hit = feats(tileOf(p[0], p[1])).find(f => polys(f.geometry).some(poly => inside(p, poly[0]))); if (hit) { id = String(hit.properties.id); stats.byPoint++; } }
  if (!id && r.bagPandIds.length === 1) { id = `NL.IMBAG.Pand.${r.bagPandIds[0]}`; stats.byLink++; }
  if (!id) { stats.unmatched++; continue; }
  const facts = parseRegisterFacts(r.monumentNumber, text);
  const b = p ? buurtAt(p) : undefined;
  const prev = byPand.get(id);
  if (!prev) byPand.set(id, { nrs: [r.monumentNumber], facts, buurt: b?.name, gebied: b?.gebied });
  else { prev.nrs.push(r.monumentNumber); if (!prev.facts.gable && facts.gable) prev.facts = facts; }
}
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
const report = { stats, pands: byPand.size, ridePriorityPands: ride, rideGebieden: [...RIDE_PRIORITY_GEBIEDEN], fieldCount, byBuurt: Object.fromEntries(Object.entries(byBuurt).sort((a, b) => b[1].pands - a[1].pands)) };
mkdirSync(path.dirname(STAGING), { recursive: true });
writeFileSync(STAGING, JSON.stringify(out));
writeFileSync(REPORT, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, byBuurt: Object.fromEntries(Object.entries(report.byBuurt).slice(0, 12)) }, null, 1));
if (process.argv.includes('--publish')) { writeFileSync(EXTRACT, JSON.stringify(out)); console.log(`published ${EXTRACT}`); }
