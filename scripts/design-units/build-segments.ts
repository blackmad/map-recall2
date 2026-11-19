/**
 * Design-unit segments for the renderer (phase 1): Ring-layer multi-pand units split at real AHN breaks
 * (src/canalRecall/designUnits/segments.ts), staged with their numbers.
 *
 *   node --import tsx scripts/design-units/build-segments.ts [--layers=ring] [--reads=<dir of D1 answers>] [--publish]
 *
 * --reads (default artifacts/design-units/staging/d1-ring-answers, the De Pijp lane's ring tranche): a segment with read
 * members takes their consensus (`reads`: majority whiteFrames / pale / arch heads / finish, each read member's bays), which
 * the renderer prefers over the era prior.
 *
 * Reads artifacts/design-units/staging/{design-units.json,ahn-fronts.json} and the base tiles' 3DBAG eaves. Writes
 * artifacts/design-units/staging/{segments.json,segment-stats.json}; --publish copies segments.json to
 * public/data/extracts/amsterdam/design-units-v1/segments.json (read by the renderer only under ?designUnits=1).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { SEGMENTS_SCHEMA, segmentsOf, type MemberHeights, type Segment, type SegmentsExtract } from '../../src/canalRecall/designUnits/segments.ts';
import type { DesignUnit } from '../../src/canalRecall/designUnits/types.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const PUBLISH = path.join(ROOT, 'public/data/extracts/amsterdam/design-units-v1');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const layers = (arg('layers') ?? 'ring').split(',');

const units = (JSON.parse(fs.readFileSync(path.join(STAGING, 'design-units.json'), 'utf8')).units as DesignUnit[])
  .filter(u => u.members.length > 1 && u.object && layers.includes(u.object.key.split(':')[0]));
const ahn = JSON.parse(fs.readFileSync(path.join(STAGING, 'ahn-fronts.json'), 'utf8')).fronts as Record<string, { p90: number; roofP90?: number; riseM?: number } | null>;
const want = new Set(units.flatMap(u => u.members));
const bag = new Map<string, number | null>();
const yearOf = new Map<string, number>(), centre = new Map<string, [number, number, number]>(); // centre: sum lng, sum lat, n
const TILES = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
for (const x of fs.readdirSync(TILES).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(TILES, x)).filter(n => n.endsWith('.geojson.gz'))) {
  for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, f))).toString('utf8')).features) {
    const id = String(ft.properties?.id ?? '').replace(/^NL\.IMBAG\.Pand\./, '');
    if (!want.has(id) || bag.has(id)) continue;
    bag.set(id, typeof ft.properties.eaves === 'number' ? ft.properties.eaves : null);
    if (typeof ft.properties.year === 'number') yearOf.set(id, ft.properties.year);
    const ring: [number, number][] | undefined = ft.geometry?.type === 'Polygon' ? ft.geometry.coordinates[0] : ft.geometry?.coordinates?.[0]?.[0];
    if (ring?.length) { const pts = ring.slice(0, -1); centre.set(id, [pts.reduce((t, q) => t + q[0], 0), pts.reduce((t, q) => t + q[1], 0), pts.length]); }
  }
}
const heights = new Map<string, MemberHeights>([...want].map(id => [id, { ahnM: ahn[id]?.p90 ?? null, bagEavesM: bag.get(id) ?? null }]));

type Answer = { readable?: boolean; whiteFrames?: boolean | null; pale?: boolean | null; finish?: string; bays?: number; heads?: string[] };
const readsDir = path.resolve(ROOT, arg('reads') ?? 'artifacts/design-units/staging/d1-ring-answers');
const answers = new Map<string, Answer>();
if (fs.existsSync(readsDir)) for (const f of fs.readdirSync(readsDir).filter(n => n.endsWith('.json'))) {
  const a = JSON.parse(fs.readFileSync(path.join(readsDir, f), 'utf8')) as Answer & { pandId?: string };
  if (a.readable !== false && a.pandId) answers.set(a.pandId, a);
}
const majority = <V>(xs: V[]): V | undefined => { const c = new Map<V, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); const top = [...c].sort((a, b) => b[1] - a[1]); return top.length && (top.length === 1 || top[0][1] > top[1][1]) ? top[0][0] : undefined; };
function readsOf(members: string[]) {
  const rs = members.map(m => [m, answers.get(m)] as const).filter((x): x is readonly [string, Answer] => !!x[1]);
  if (!rs.length) return undefined;
  const bool = (k: 'whiteFrames' | 'pale') => majority(rs.map(([, a]) => a[k]).filter((v): v is boolean => typeof v === 'boolean'));
  const arch = majority(rs.flatMap(([, a]) => (a.heads ?? []).filter(h => h !== 'mixed' && h !== 'not-visible').map(h => h === 'segmental' || h === 'round' || h === 'arch')));
  const finish = majority(rs.map(([, a]) => a.finish).filter((f): f is string => !!f && f !== 'not-visible'));
  const bays = Object.fromEntries(rs.filter(([, a]) => typeof a.bays === 'number' && a.bays > 0).map(([m, a]) => [m, a.bays!]));
  return { n: rs.length, ...(bool('whiteFrames') !== undefined ? { whiteFrames: bool('whiteFrames') } : {}), ...(bool('pale') !== undefined ? { pale: bool('pale') } : {}),
    ...(arch !== undefined ? { arch } : {}), ...(finish ? { finish } : {}), ...(Object.keys(bays).length ? { bays } : {}) };
}
const segments: Segment[] = [];
let splitUnits = 0;
const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
for (const u of units) {
  const s = segmentsOf(u, heights);
  if (s.length > 1) splitUnits++;
  for (const g of s) {
    g.year = med(g.members.map(m => yearOf.get(m)).filter((y): y is number => typeof y === 'number'));
    const c = g.members.map(m => centre.get(m)).filter((x): x is [number, number, number] => !!x);
    if (c.length) { const n = c.reduce((t, x) => t + x[2], 0); g.at = [+(c.reduce((t, x) => t + x[0], 0) / n).toFixed(7), +(c.reduce((t, x) => t + x[1], 0) / n).toFixed(7)]; }
    // The roof mass behind the front (AHN, m over the line): the median member's roof p90 minus its front p90. Null unread.
    const rises = g.members.map(m => ahn[m]?.riseM).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    g.roofRiseM = rises.length ? +rises[Math.floor((rises.length - 1) / 2)].toFixed(2) : null;
    const r = readsOf(g.members);
    if (r) (g as Segment & { reads?: unknown }).reads = r;
  }
  segments.push(...s);
}
// Only multi-pand segments change drawing; singles (a unit split down to one pand) draw as today.
const multi = segments.filter(s => s.members.length > 1);
const stat = {
  layers, units: units.length, pands: want.size,
  ahnRead: [...want].filter(id => ahn[id]).length, ahnMissing: [...want].filter(id => !ahn[id]).length,
  segments: segments.length, multiPandSegments: multi.length, pandsInMultiSegments: multi.reduce((t, s) => t + s.members.length, 0),
  unitsSplit: splitUnits, singlesFromSplits: segments.filter(s => s.members.length === 1).length,
  exceptions: multi.reduce((t, s) => t + s.exceptions.length, 0),
  roofMeasured: multi.filter(s => typeof s.roofRiseM === 'number').length, roofStoreys: multi.filter(s => (s.roofRiseM ?? 0) >= 1.8).length,
  withReads: multi.filter(s => (s as Segment & { reads?: unknown }).reads).length, readsFrom: answers.size,
  eavesSource: { ahn: multi.filter(s => s.eavesSource === 'ahn').length, '3dbag': multi.filter(s => s.eavesSource === '3dbag').length, none: multi.filter(s => s.eavesSource === 'none').length },
  // How far 3DBAG per-pand eaves sit from the segment line today (what the flag removes).
  bagSpreadOver0_8: multi.filter(s => { const v = s.members.map(m => bag.get(m)).filter((x): x is number => typeof x === 'number'); return v.length > 1 && Math.max(...v) - Math.min(...v) > 0.8; }).length,
};
const extract: SegmentsExtract = {
  schema: SEGMENTS_SCHEMA, layers, generatedAt: new Date().toISOString(),
  source: 'design units (ordekaart, Gemeente Amsterdam Maps Data; the original datasets are freely available from the Gemeente under its Gebruiksvoorwaarden, https://maps.amsterdam.nl/open_geodata/terms.php) split at AHN4 front-edge breaks; scripts/design-units/build-segments.ts',
  segments: multi,
};
fs.writeFileSync(path.join(STAGING, 'segments.json'), JSON.stringify(extract));
fs.writeFileSync(path.join(STAGING, 'segment-stats.json'), JSON.stringify(stat, null, 1));
console.log(JSON.stringify(stat, null, 1));
if (process.argv.includes('--publish')) {
  fs.mkdirSync(PUBLISH, { recursive: true });
  fs.writeFileSync(path.join(PUBLISH, 'segments.json'), JSON.stringify(extract));
  console.log(`published ${path.relative(ROOT, PUBLISH)}/segments.json (${(JSON.stringify(extract).length / 1e6).toFixed(2)} MB)`);
}
