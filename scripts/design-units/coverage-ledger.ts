/**
 * T8 coverage ledger (design-units plan, option A approved on #397): Ring fronts by tier, per buurt and ride-weighted.
 *
 *   node --import tsx scripts/design-units/coverage-ledger.ts [--segments=<extract>]
 *
 * Ring fronts: every pand in an ordekaart `ring:` object (staging/design-units.json). Each pand gets the first tier that
 * holds:
 *   A  a placed model, recipe or landmark kit (public/canal-drive/models/covers.json);
 *   B  described from photos: a published row-front record, or a published HouseSpec drawn from its spec (`r` not
 *      'generic'; a monument-text-only spec still draws generic);
 *   C  drawn as one building: a member of a multi-pand design-unit segment (the Ring extract; `?designUnits=1`, so the
 *      "flag on" column; with the flag off C is empty and those pands are D);
 *   D  per-pand dice.
 * Ride weight: each buurt's routeMetres from the latest docs/reports/ride-ring-buurten-*.json (seeded route samples),
 * times the Ring share of the buurt's pands.
 * Writes artifacts/design-units/staging/coverage-ledger.json and prints the totals.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { DesignUnit } from '../../src/canalRecall/designUnits/types.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const norm = (s: string) => String(s).replace(/^NL\.IMBAG\.Pand\./, '');
const ring = new Set((JSON.parse(fs.readFileSync(path.join(STAGING, 'design-units.json'), 'utf8')).units as DesignUnit[])
  .filter(u => u.object?.key.startsWith('ring:')).flatMap(u => u.members));
const buurtOf = JSON.parse(fs.readFileSync(path.join(STAGING, 'pand-buurt.json'), 'utf8')) as Record<string, string>;

const A = new Set<string>();
for (const m of Object.values((JSON.parse(fs.readFileSync(path.join(ROOT, 'public/canal-drive/models/covers.json'), 'utf8')) as { models: Record<string, { p: string[] }> }).models)) for (const p of m.p) A.add(norm(p).padStart(16, '0'));
const B = new Set<string>((JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/front-records/row-front.json'), 'utf8')).records as Array<{ pandId: string }>).map(r => norm(r.pandId)));
const SPECS = path.join(ROOT, 'public/data/extracts/amsterdam/house-specs/14');
for (const x of fs.readdirSync(SPECS)) for (const f of fs.readdirSync(path.join(SPECS, x))) {
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(SPECS, x, f))).toString('utf8')) as { buildings: Record<string, { r?: string }> };
  for (const [id, b] of Object.entries(d.buildings)) if (b.r && b.r !== 'generic') B.add(norm(id));
}
const segFile = arg('segments') ?? path.join(ROOT, 'public/data/extracts/amsterdam/design-units-v1/segments.json');
const C = new Set<string>((JSON.parse(fs.readFileSync(segFile, 'utf8')).segments as Array<{ members: string[] }>).flatMap(s => s.members));

const reports = fs.readdirSync(path.join(ROOT, 'docs/reports')).filter(f => /^ride-ring-buurten-\d+\.json$/.test(f)).sort();
const rideRows = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/reports', reports.at(-1)!), 'utf8')).rows as Array<{ code: string; routeMetres: number; pands: number }>;
const ride = new Map<string, number>(rideRows.map(r => [r.code, r.routeMetres])), buurtPands = new Map<string, number>(rideRows.map(r => [r.code, r.pands]));

type Row = { buurt: string; pands: number; A: number; B: number; C: number; D: number; routeMetres: number };
const rows = new Map<string, Row>();
for (const p of ring) {
  const b = buurtOf[p] ?? '?', r = rows.get(b) ?? rows.set(b, { buurt: b, pands: 0, A: 0, B: 0, C: 0, D: 0, routeMetres: ride.get(b) ?? 0 }).get(b)!;
  r.pands++;
  r[A.has(p) ? 'A' : B.has(p) ? 'B' : C.has(p) ? 'C' : 'D']++;
}
const list = [...rows.values()].sort((a, b) => b.routeMetres - a.routeMetres);
const sum = (k: 'A' | 'B' | 'C' | 'D' | 'pands') => list.reduce((t, r) => t + r[k], 0);
// A buurt's ride weight on its Ring fronts: its route metres times the Ring share of its pands (a buurt with one Ring
// pand among hundreds does not weigh as much as one that is all Ring).
const w = (r: Row) => r.routeMetres * Math.min(1, r.pands / Math.max(1, buurtPands.get(r.buurt) ?? r.pands));
const rideTotal = list.reduce((t, r) => t + w(r), 0) || 1;
const rideShare = (k: 'A' | 'B' | 'C' | 'D') => +(list.reduce((t, r) => t + w(r) * (r[k] / r.pands), 0) / rideTotal).toFixed(3);
const totals = { pands: sum('pands'), A: sum('A'), B: sum('B'), C: sum('C'), D: sum('D'),
  share: Object.fromEntries((['A', 'B', 'C', 'D'] as const).map(k => [k, +(sum(k) / sum('pands')).toFixed(3)])),
  rideWeighted: Object.fromEntries((['A', 'B', 'C', 'D'] as const).map(k => [k, rideShare(k)])),
  flagOffD: sum('C') + sum('D'), rideReport: reports.at(-1), segments: path.relative(ROOT, segFile) };
fs.writeFileSync(path.join(STAGING, 'coverage-ledger.json'), JSON.stringify({ totals, buurten: list }, null, 1));
console.log(JSON.stringify({ totals, top10ByRide: list.slice(0, 10) }, null, 1));
