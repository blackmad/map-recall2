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
import { GORDEL_RULE, RING_RULE, SEGMENTS_SCHEMA, segmentsOf, type MemberHeights, type Segment, type SegmentsExtract } from '../../src/canalRecall/designUnits/segments.ts';
import type { DesignUnit } from '../../src/canalRecall/designUnits/types.ts';
import { fillRoofPattern, type PlotFacts, type PlotRoof, type WhiteHeads } from '../../src/canalRecall/designUnits/plotPlan.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STAGING = path.join(ROOT, 'artifacts/design-units/staging');
const PUBLISH = path.join(ROOT, 'public/data/extracts/amsterdam/design-units-v1');
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const layers = (arg('layers') ?? 'ring').split(',');
// --tag=<name>: write staging/segments-<name>.json and segment-stats-<name>.json (a layer's dry run beside the Ring extract).
const tag = arg('tag'), sfx = tag ? `-${tag}` : '';
// --rule=gordel: the Gordel dry-run split rule (segments.ts GORDEL_RULE); default the Ring rule.
const rule = arg('rule') === 'gordel' ? GORDEL_RULE : RING_RULE;

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

type Answer = { readable?: boolean; windowSurround?: string; bands?: string; whiteFrames?: boolean | null; pale?: boolean | null; finish?: string; bays?: number; heads?: string[]; storeyParts?: { roof?: string; full?: number | string; souterrain?: boolean }; dormers?: { count?: number; kind?: string }; ground?: string; basement?: string; crown?: string; balconies?: number[] };
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
// Round 2 (#399): plots are separate houses unless photo evidence says one facade. Evidence: a block-face intent's
// `identical` group or a house's `sameAs`, or a same-building run read "one" (confidence >= 0.6). Cornice groups do not
// count (a shared cornice line is the family, not one facade).
const oneFacade: string[][] = [];
const norm = (s: string) => String(s).replace(/^NL\.IMBAG\.Pand\./, '');
const FACES = path.join(ROOT, 'scripts/block-face/faces');
if (fs.existsSync(FACES)) for (const face of fs.readdirSync(FACES)) {
  const f = path.join(FACES, face, 'intent.json');
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const g of d.continuity?.identical ?? []) if (Array.isArray(g.pands)) oneFacade.push(g.pands.map(norm));
  for (const h of d.houses ?? []) if (h.sameAs && h.pandId) oneFacade.push([norm(h.pandId), norm(h.sameAs)]);
}
const SAME = path.join(STAGING, 'same-building');
if (fs.existsSync(SAME)) for (const f of fs.readdirSync(SAME).filter(n => n.endsWith('.json'))) {
  for (const r of (JSON.parse(fs.readFileSync(path.join(SAME, f), 'utf8')).runs ?? []) as Array<{ pids: string[]; answer: string; confidence?: number }>) {
    if (r.answer === 'one' && (r.confidence ?? 0) >= 0.6) oneFacade.push(r.pids.map(norm));
  }
}
/** The segment's one-facade groups: union of the evidence over its members (groups of 2 or more). */
function plotGroupsOf(members: string[]): string[][] {
  const mine = new Set(members), parent = new Map<string, string>();
  const find = (a: string): string => { while (parent.has(a) && parent.get(a) !== a) a = parent.get(a)!; return a; };
  for (const g of oneFacade) {
    const ids = g.filter(p => mine.has(p));
    for (let i = 1; i < ids.length; i++) { const a = find(ids[0]), b = find(ids[i]); if (a !== b) parent.set(a, b); }
  }
  const groups = new Map<string, string[]>();
  for (const m of members) { const r = find(m); groups.set(r, [...(groups.get(r) ?? []), m]); }
  return [...groups.values()].filter(g => g.length > 1);
}

// Roof storeys AHN cannot see (2026-11-20): the Ring's front mansards and hoist dormers stand inside the DSM's flat top.
// Evidence, first found wins: the photo-row review (scripts/design-units/roof-evidence.json), then the members' D1 reads
// (majority storeyParts.roof: dormers / mansard / roof-storey is a roof storey, none is not; gable attics and unreadable
// tops say nothing; the dormer kind is the reads' majority gabled / plain).
const photoRoof = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/design-units/roof-evidence.json'), 'utf8')).segments as Record<string, { storey: boolean; dormer?: 'pediment' | 'gabled' | 'plain'; hoist?: boolean }>;
function roofEvidenceOf(id: string, members: string[]): Segment['roofEvidence'] | undefined {
  const ph = photoRoof[id];
  if (ph) return { storey: ph.storey, ...(ph.dormer ? { dormer: ph.dormer } : {}), ...(ph.hoist ? { hoist: true } : {}), source: 'photo-row review 2026-11-20 (scripts/design-units/roof-evidence.json)', roofSource: 'photo' };
  const rs = members.map(m => answers.get(m)).filter((a): a is Answer => !!a);
  const says = rs.map(a => a.storeyParts?.roof).filter((r): r is string => r === 'dormers' || r === 'mansard' || r === 'roof-storey' || r === 'none');
  const storey = majority(says.map(r => r !== 'none'));
  if (storey === undefined) return undefined;
  const kind = majority(rs.map(a => a.dormers?.kind).filter((k): k is string => k === 'gabled' || k === 'plain')) as 'gabled' | 'plain' | undefined;
  const form = majority(says.filter(r => r !== 'none').map(r => (r === 'dormers' ? 'dormers' : 'mansard')));
  return { storey, ...(storey ? { dormer: kind ?? 'plain', ...(form === 'dormers' ? { form } : {}) } : {}), source: `D1 reads (${says.length} of ${members.length} members)`, roofSource: 'reads' };
}

// David, 2026-11-21 ("A then B"): a Ring segment with neither a photo-row entry nor D1 reads gets the default roof storey of
// its era: the eras come from the D1 reads themselves (an era whose reads say "none" more than DEFAULT_NONE_MAX of the
// time is left flat), its dormer kind and form the era's most common read. Marked roofSource 'default': reads override it.
export const ROOF_ERAS: ReadonlyArray<readonly [number, number]> = [[1860, 1880], [1880, 1900], [1900, 1920], [1920, 1940]];
export const DEFAULT_NONE_MAX = 0.3;
const yearOfRead = new Map<string, number>();
for (const [id] of answers) if (yearOf.has(id)) yearOfRead.set(id, yearOf.get(id)!);
export const eraDefaults = ROOF_ERAS.map(([from, to]) => {
  const rs = [...answers].filter(([id]) => { const y = yearOfRead.get(id); return y !== undefined && y >= from && y < to; }).map(([, a]) => a);
  const roofs = rs.map(a => a.storeyParts?.roof).filter((r): r is string => r === 'dormers' || r === 'mansard' || r === 'roof-storey' || r === 'none');
  const none = roofs.filter(r => r === 'none').length, noneShare = roofs.length ? none / roofs.length : 1;
  const kinds = new Map<string, number>(); for (const a of rs) if ((a.dormers?.count ?? 0) > 0 && (a.dormers?.kind === 'gabled' || a.dormers?.kind === 'plain' || a.dormers?.kind === 'pediment')) kinds.set(a.dormers.kind, (kinds.get(a.dormers.kind) ?? 0) + 1);
  const kind = ([...kinds].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'plain') as 'gabled' | 'plain' | 'pediment';
  const dormersN = roofs.filter(r => r === 'dormers').length, form: 'dormers' | 'mansard' = dormersN >= (roofs.length - none - dormersN) ? 'dormers' : 'mansard';
  return { from, to, reads: roofs.length, noneShare: +noneShare.toFixed(3), included: roofs.length >= 10 && noneShare <= DEFAULT_NONE_MAX, kind, form, kinds: Object.fromEntries(kinds) };
});
function defaultRoofOf(year: number | null | undefined): Segment['roofEvidence'] | undefined {
  if (typeof year !== 'number') return undefined;
  const e = eraDefaults.find(x => year >= x.from && year < x.to);
  return e?.included ? { storey: true, dormer: e.kind, form: e.form, source: `era default ${e.from}-${e.to - 1} (D1 reads: ${Math.round((1 - e.noneShare) * 100)} % roof storey, most common dormer ${e.kind})`, roofSource: 'default' } : undefined;
}

// Plot facts (2026-11-21, plotPlan.ts): the gate photo rows (scripts/design-units/plot-reads.json), else the member's D1
// read: full storeys, ground use, souterrain, roof element (a pointed / stepped / bell crown is the plot's gable; a
// mansard or roof storey, dormers, or none), dormer kind, balcony storeys.
const plotReads = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/design-units/plot-reads.json'), 'utf8')).pands as Record<string, Omit<PlotFacts, 'src'> & { block: string }>;
const D1_ROOF: Record<string, PlotRoof> = { dormers: 'dormers', mansard: 'mansard', 'roof-storey': 'mansard', none: 'flat', 'gable-attic': 'pointedGable' };
const D1_CROWN: Record<string, PlotRoof> = { point: 'pointedGable', step: 'stepGable', bell: 'bellGable', neck: 'bellGable', 'raised-neck': 'bellGable' };
const D1_HEADS: Record<string, WhiteHeads> = { keystone: 'keystone', 'jack-blocks': 'blocks', 'block-dressings': 'blocks', 'dentil-lintel': 'blocks', 'stone-lintel': 'band', none: 'none', sill: 'none', 'full-frame': 'none' };
function plotFactsOf(id: string): PlotFacts | undefined {
  const ph = plotReads[id];
  if (ph) { const { block: _b, ...f } = ph; return { ...f, src: 'photo' }; }
  const a = answers.get(id);
  if (!a) return undefined;
  const f: PlotFacts = { src: 'reads' };
  if (typeof a.storeyParts?.full === 'number' && a.storeyParts.full >= 2 && a.storeyParts.full <= 7) f.storeys = a.storeyParts.full;
  if (a.ground === 'shopfront') f.ground = 'shop'; else if (a.ground === 'dwelling') f.ground = 'dwelling';
  if (a.storeyParts?.souterrain === true || (a.basement && a.basement !== 'none' && a.basement !== 'not-visible')) f.souterrain = true;
  const roof = (a.crown && D1_CROWN[a.crown]) || (a.storeyParts?.roof && D1_ROOF[a.storeyParts.roof]);
  if (roof) f.roof = roof;
  if (a.dormers?.kind === 'gabled' || a.dormers?.kind === 'plain' || a.dormers?.kind === 'pediment') f.dormer = a.dormers.kind;
  if (Array.isArray(a.balconies)) f.balconies = a.balconies.filter(n => Number.isInteger(n) && n >= 1);
  // White heads and string courses (2026-11-21): the read surround and bands (speklagen are bacon courses, not a string course).
  const heads = a.windowSurround ? D1_HEADS[a.windowSurround] : undefined;
  if (heads) f.whiteHeads = heads;
  if (a.bands && a.bands !== 'not-visible' && a.bands !== 'speklagen') f.stringCourses = a.bands !== 'none';
  return Object.keys(f).length > 1 ? f : undefined;
}
const patternFilled: string[] = [];

const segments: Segment[] = [];
let splitUnits = 0;
const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
for (const u of units) {
  const s = segmentsOf(u, heights, rule);
  if (s.length > 1) splitUnits++;
  for (const g of s) {
    g.year = med(g.members.map(m => yearOf.get(m)).filter((y): y is number => typeof y === 'number'));
    const c = g.members.map(m => centre.get(m)).filter((x): x is [number, number, number] => !!x);
    if (c.length) { const n = c.reduce((t, x) => t + x[2], 0); g.at = [+(c.reduce((t, x) => t + x[0], 0) / n).toFixed(7), +(c.reduce((t, x) => t + x[1], 0) / n).toFixed(7)]; }
    // The roof mass behind the front (AHN, m over the line): the median member's roof p90 minus its front p90. Null unread.
    const rises = g.members.map(m => ahn[m]?.riseM).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
    g.roofRiseM = rises.length ? +rises[Math.floor((rises.length - 1) / 2)].toFixed(2) : null;
    const eaves = Object.fromEntries(g.members.filter(m => typeof ahn[m]?.p90 === 'number').map(m => [m, +ahn[m]!.p90.toFixed(2)]));
    if (Object.keys(eaves).length) g.plotEavesM = eaves;
    const ev = roofEvidenceOf(g.id, g.members) ?? (layers.includes('ring') && g.id.startsWith('du:ring:') ? defaultRoofOf(g.year) : undefined);
    if (ev) g.roofEvidence = ev;
    const plots: Record<string, PlotFacts> = {};
    for (const m of g.members) { const f = plotFactsOf(m); if (f) plots[m] = f; }
    if (Object.keys(plots).length) {
      // The roof sequence along the main street (the street with the most slices), mirror-filled where one side is read.
      const byStreet = new Map<string, typeof g.slices>();
      for (const s of g.slices) byStreet.set(s.street, [...(byStreet.get(s.street) ?? []), s]);
      const main = [...byStreet.values()].sort((x, y) => y.length - x.length)[0] ?? [];
      const order = [...new Map(main.sort((x, y) => x.fromM - y.fromM).map(s => [s.pandId, 1])).keys()];
      const { filled, pattern } = fillRoofPattern(order, plots);
      patternFilled.push(...filled);
      g.plots = plots;
      if (/[A-Z]/.test(pattern)) g.roofPattern = pattern;
    }
    const groups = plotGroupsOf(g.members);
    if (groups.length) g.plotGroups = groups;
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
  roofEras: eraDefaults,
  plots: { photo: multi.reduce((t, s) => t + Object.values(s.plots ?? {}).filter(f => f.src === 'photo').length, 0), reads: multi.reduce((t, s) => t + Object.values(s.plots ?? {}).filter(f => f.src === 'reads').length, 0), patternFilled: patternFilled.length,
    roofs: multi.reduce((t, s) => { for (const f of Object.values(s.plots ?? {})) if (f.roof) t[f.roof] = (t[f.roof] ?? 0) + 1; return t; }, {} as Record<string, number>) },
  roofEvidence: { photoRow: multi.filter(s => s.roofEvidence?.roofSource === 'photo').length, reads: multi.filter(s => s.roofEvidence?.roofSource === 'reads').length, default: multi.filter(s => s.roofEvidence?.roofSource === 'default').length,
    storey: multi.filter(s => s.roofEvidence?.storey).length, noStorey: multi.filter(s => s.roofEvidence && !s.roofEvidence.storey).length },
  oneFacadeEvidence: oneFacade.length, segmentsWithOneFacadeGroups: multi.filter(s => s.plotGroups?.length).length,
  pandsInOneFacadeGroups: multi.reduce((t, s) => t + (s.plotGroups ?? []).reduce((u, g) => u + g.length, 0), 0),
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
fs.writeFileSync(path.join(STAGING, `segments${sfx}.json`), JSON.stringify(extract));
fs.writeFileSync(path.join(STAGING, `segment-stats${sfx}.json`), JSON.stringify(stat, null, 1));
console.log(JSON.stringify(stat, null, 1));
if (process.argv.includes('--publish') && tag) throw new Error('--publish takes no --tag');
if (process.argv.includes('--publish')) {
  fs.mkdirSync(PUBLISH, { recursive: true });
  fs.writeFileSync(path.join(PUBLISH, 'segments.json'), JSON.stringify(extract));
  console.log(`published ${path.relative(ROOT, PUBLISH)}/segments.json (${(JSON.stringify(extract).length / 1e6).toFixed(2)} MB)`);
}
