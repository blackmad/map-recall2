// Belt library step 1 (lane BL): key every canal-belt pand by look and report how many designs it would take.
//   npm run belt:keys   (node --import tsx scripts/belt-library/keys.ts [--wijken AA,AB,...] [--out artifacts/belt-library] [--help])
// Node only: no browser, no network. Reads the extracts, the hand specs and the D1 answers; writes keys.json and keys.md.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { lngLatToRd, loadRoads, loadTile, nearestOnSeg, pointInRing, type Rd, type Seg } from '../pand-reference/core.ts';
import { frontBays, pandDigits } from '../../src/canalRecall/houseSpec/spec.ts';
import {
  FIELDS, SOURCES, boxDims, colourFromHex, colourFromWord, crownClass, distinctiveFlags, finishClass, groupKeys, isCorner, keyOf,
  keysForShares, polygonArea, resolveAll, sourceOfLabel, type PriorMode, type Field, type PandFacts, type Readings, type Reading, type Source, type Variant, VARIANTS,
} from '../../src/canalRecall/beltLibrary/keys.ts';

export const HELP = `belt-library keys: key every belt pand by look (crown, bays, storeys, finish, colour family).

  node --import tsx scripts/belt-library/keys.ts [--wijken AA,AB,...] [--out artifacts/belt-library]

  --wijken   CBS wijk codes (default AA..AP present in coverage-v1 = AA,AB,AC,AD,AE,AF,AG,AH,AJ,AK)
  --out      directory for keys.json and keys.md
Source order per field: hand > monument > d1 > measured > prior (src/canalRecall/beltLibrary/keys.ts).`;

const EX = 'public/data/extracts/amsterdam';
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
if (process.argv.includes('--help')) { console.log(HELP); process.exit(0); }
const OUT = arg('out') ?? 'artifacts/belt-library';
const readJson = (p: string) => JSON.parse((p.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(p)) : fs.readFileSync(p)).toString('utf8'));
const walk = (dir: string, ext: string): string[] => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), ext) : e.name.endsWith(ext) ? [path.join(dir, e.name)] : []);

// ---- belt buurten and pands ----------------------------------------------------------------------------------------
const buurten = readJson(`${EX}/coverage-v1/buurten.json`).features as any[];
const presentWijken = [...new Set(buurten.map(f => String(f.properties.wijkCode)))].filter(w => w >= 'AA' && w <= 'AP').sort();
const wijken = (arg('wijken')?.split(',') ?? presentWijken);
const belt = buurten.filter(f => wijken.includes(f.properties.wijkCode)).map(f => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return { code: f.properties.code as string, wijk: f.properties.wijkCode as string, rings: polys.map((p: number[][][]) => p[0].map(q => lngLatToRd([q[0], q[1]]))) as Rd[][] };
});

type Fp = { id: string; ring: Rd[]; height: number };
const tileFiles = walk(`${EX}/building-tiles/14`, '.geojson.gz');
const all: Fp[] = [];
for (const f of tileFiles) { const [x, y] = [path.basename(path.dirname(f)), path.basename(f).split('.')[0]]; all.push(...await loadTile(Number(x), Number(y))); }
const cell = 40, grid = new Map<string, Fp[]>();
const gk = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
const centroidOf = (r: Rd[]) => ({ x: r.reduce((s, p) => s + p.x, 0) / r.length, y: r.reduce((s, p) => s + p.y, 0) / r.length });
for (const fp of all) { const c = centroidOf(fp.ring); const k = gk(c.x, c.y); (grid.get(k) ?? grid.set(k, []).get(k)!).push(fp); }
const near = (c: Rd) => { const out: Fp[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(grid.get(`${Math.floor(c.x / cell) + dx},${Math.floor(c.y / cell) + dy}`) ?? [])); return out; };

const pands = new Map<string, { fp: Fp; buurt: string }>();
for (const fp of all) {
  if (!fp.id.startsWith('NL.IMBAG.Pand.') || fp.ring.length < 4) continue;
  const c = centroidOf(fp.ring);
  const b = belt.find(b => b.rings.some(r => pointInRing(c, r)));
  if (!b) continue;
  const old = pands.get(fp.id);
  if (!old || polygonArea(fp.ring) > polygonArea(old.fp.ring)) pands.set(fp.id, { fp, buurt: b.code });
}

// ---- footprint facts: width, corner -------------------------------------------------------------------------------------
const yearOf = new Map<string, number>();
for (const f of walk(`${EX}/building-facts/14`, '.json.gz')) for (const [k, v] of Object.entries(readJson(f).buildings as Record<string, unknown[]>)) if (typeof v[0] === 'number' && v[0] > 1000) yearOf.set(k.replace(/^P/, ''), v[0]);

function distToSeg(p: Rd, a: Rd, b: Rd) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function exposedEdges(fp: Fp): { a: Rd; b: Rd }[] {
  const out: { a: Rd; b: Rd }[] = [], c = centroidOf(fp.ring), others = near(c).filter(o => o.id !== fp.id);
  for (let i = 0; i + 1 < fp.ring.length; i++) {
    const a = fp.ring[i], b = fp.ring[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 2) continue;
    let hits = 0;
    for (const t of [0.25, 0.5, 0.75]) {
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (others.some(o => { for (let j = 0; j + 1 < o.ring.length; j++) if (distToSeg(p, o.ring[j], o.ring[j + 1]) < 0.4) return true; return false; })) hits++;
    }
    if (hits < 2) out.push({ a, b });
  }
  return out;
}
// roads and quays (streets.json + streets-routing.json, as the crop pipeline reads them), gridded
const roadCell = 30, roadGrid = new Map<string, Seg[]>();
for (const sg of await loadRoads()) {
  const x0 = Math.floor(Math.min(sg.a.x, sg.b.x) / roadCell), x1 = Math.floor(Math.max(sg.a.x, sg.b.x) / roadCell);
  const y0 = Math.floor(Math.min(sg.a.y, sg.b.y) / roadCell), y1 = Math.floor(Math.max(sg.a.y, sg.b.y) / roadCell);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) (roadGrid.get(`${x},${y}`) ?? roadGrid.set(`${x},${y}`, []).get(`${x},${y}`)!).push(sg);
}
const STREET_M = 14, STREET_ANGLE_COS = Math.cos((30 * Math.PI) / 180);
/** An exposed wall faces a street when a road or quay segment within 14 m runs within 30 degrees of it. */
function facesStreet(e: { a: Rd; b: Rd }): boolean {
  const m = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 }, ex = e.b.x - e.a.x, ey = e.b.y - e.a.y, el = Math.hypot(ex, ey);
  const cx = Math.floor(m.x / roadCell), cy = Math.floor(m.y / roadCell);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const sg of roadGrid.get(`${cx + dx},${cy + dy}`) ?? []) {
    if (nearestOnSeg(m, sg).d > STREET_M) continue;
    const sx = sg.b.x - sg.a.x, sy = sg.b.y - sg.a.y, sl = Math.hypot(sx, sy) || 1;
    if (Math.abs((ex * sx + ey * sy) / (el * sl)) >= STREET_ANGLE_COS) return true;
  }
  return false;
}

// ---- register facts, kit pands ------------------------------------------------------------------------------------------
const gables = readJson(`${EX}/monument-gables.json`).buildings as Record<string, string>;
const regFacts = readJson(`${EX}/monument-facts.json`).buildings as Record<string, any>;
const kitPands = new Set<string>(Object.values(readJson(`${EX}/kit-pands.json`).ids as Record<string, { pand?: string }>).map(v => v.pand).filter(Boolean) as string[]);

// ---- readings --------------------------------------------------------------------------------------------------------------
const readings = new Map<string, Readings>();
const R = (id: string): Record<string, Reading<any>[]> => (readings.get(id) ?? readings.set(id, {}).get(id)!) as any;
const add = (id: string, f: Field, value: unknown, source: Source | null, ref: string) => {
  if (!source || value === undefined || value === null) return;
  (R(id)[f] ??= []).push({ value, source, ref });
};
/** Raw crown words per pand with their source, so the report can split neck from bell (the key's `curved` merges them). */
const crownWords = new Map<string, { word: string; source: Source }[]>();
const addCrown = (id: string, word: string | undefined, o: { dormers?: boolean; roofFront?: string }, source: Source | null, ref: string) => {
  const c = crownClass(word, o);
  add(id, 'crown', c, source, ref);
  if (c && source && word) (crownWords.get(id) ?? crownWords.set(id, []).get(id)!).push({ word: c === 'mansard' ? 'mansard' : c === 'cornice-dormer' ? 'raised-dormer' : word === 'raisedNeck' ? 'raised-neck' : word === 'clock' ? 'bell' : word, source });
};
type Labels = (path: string) => string | undefined;
/** Read the five fields from a HouseSpec-shaped design; `label(path)` says which source stated a field path. */
function fromDesign(id: string, d: any, label: Labels, ref: string) {
  const f0 = d?.fronts?.[0] ?? {};
  const gl = label('fronts/0/gable');
  const dormers = Number.isFinite(f0.dormers) ? f0.dormers > 0 : Array.isArray(f0.dormers) ? f0.dormers.length > 0 : !!f0.dormers;
  addCrown(id, f0.gable, { dormers, roofFront: f0.roofFront }, sourceOfLabel(gl), ref);
  add(id, 'bays', frontBays(f0), sourceOfLabel(label('fronts/0/bays') ?? label('fronts/0/axisGrid')), ref);
  add(id, 'storeys', Number.isInteger(f0.storeys) ? f0.storeys : undefined, sourceOfLabel(label('fronts/0/storeys')), ref);
  add(id, 'finish', finishClass(d?.palette?.wallMaterial), sourceOfLabel(label('palette/wallMaterial')), ref);
  if (d?.palette?.brick && /^#/.test(d.palette.brick)) add(id, 'colour', colourFromHex(d.palette.brick), sourceOfLabel(label('palette/brick')), ref);
}
const provLabel = (prov: Record<string, { source: string }> | undefined): Labels => p => {
  if (!prov) return undefined;
  for (let k = p; ; k = k.slice(0, Math.max(0, k.lastIndexOf('/')))) { if (prov[k]) return prov[k].source; if (!k.includes('/')) break; }
  return prov['']?.source;
};

let nExtract = 0;
// 1. the published extract (resolved: its field labels say hand / measured / monument / d1)
for (const f of walk(`${EX}/house-specs/14`, '.json.gz')) for (const [k, v] of Object.entries(readJson(f).buildings as Record<string, any>)) {
  const id = pandDigits(k);
  if (!pands.has(`NL.IMBAG.Pand.${id}`)) continue;
  nExtract++;
  fromDesign(id, v.d, p => v.s?.[p], 'extract');
  const wl = sourceOfLabel(v.v?.src?.wallHex);
  if (wl && v.v?.wallHex) add(id, 'colour', colourFromHex(v.v.wallHex), wl, 'extract/v.wallHex');
}
// 2. hand specs, generated specs (house:describe), D1 staged specs: spec files with their own provenance
let nSpecs = 0;
for (const dir of ['scripts/house-specs/specs', 'artifacts/describer-d1/staged-ah07'])
  for (const f of walk(dir, '.json')) { const s = readJson(f); if (!s.design || !s.pandId) continue; nSpecs++; fromDesign(pandDigits(s.pandId), s.design, provLabel(s.provenance), f); }
for (const f of walk('scripts/house-specs/generated', '.json')) { const s = readJson(f).spec; if (!s?.design) continue; nSpecs++; fromDesign(pandDigits(s.pandId), s.design, provLabel(s.provenance), f); }
// 3. hand set v1 (blind-read crops)
const hs = readJson('data/house-line/hand-set-v1.json').pands as any[];
for (const p of hs) {
  const id = pandDigits(p.pandId), F = p.fields ?? {};
  add(id, 'bays', F.axes?.value > 0 ? F.axes.value : undefined, 'hand', 'hand-set-v1');
  add(id, 'storeys', F.storeys?.value > 0 ? F.storeys.value : undefined, 'hand', 'hand-set-v1');
  addCrown(id, F.gable?.value, {}, 'hand', 'hand-set-v1');
  add(id, 'finish', finishClass(F.finish?.value), 'hand', 'hand-set-v1');
  add(id, 'colour', colourFromWord(F.wall?.value), 'hand', 'hand-set-v1');
}
// 4. monument-gables.json and register facts
const elements = new Map<string, string[]>();
for (const [k, g] of Object.entries(gables)) addCrown(pandDigits(k), g, {}, 'monument', 'monument-gables.json');
for (const [k, v] of Object.entries(regFacts)) {
  const id = pandDigits(k);
  addCrown(id, v.gable, {}, 'monument', 'monument-facts.json');
  add(id, 'finish', finishClass(v.finish), 'monument', 'monument-facts.json');
  if (Number.isInteger(v.storeys) && v.storeys > 0) add(id, 'storeys', v.storeys, 'monument', 'monument-facts.json');
  if (v.elements?.length) elements.set(id, v.elements.map((e: any) => e.key));
}
// 5. D1 answers on AH07 (crown only for the classes the integrator shipped: cornice and step, precision >= 0.8; wall family)
for (const f of walk('artifacts/describer-d1/answers-ah07', '.json')) {
  const a = readJson(f); if (!a.pandId || a.readable === false) continue;
  const id = pandDigits(a.pandId);
  if (a.crown === 'cornice' || a.crown === 'step') addCrown(id, a.crown, {}, 'd1', f);
  add(id, 'colour', colourFromWord(a.wallFamily), 'd1', f);
}

// ---- resolve, key, report ------------------------------------------------------------------------------------------------
const list = [...pands.entries()].map(([fullId, { fp, buurt }]) => {
  const id = pandDigits(fullId), box = boxDims(fp.ring), area = polygonArea(fp.ring);
  const street = exposedEdges(fp).filter(facesStreet).map(e => ({ ...e, len: Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) })).filter(e => e.len >= 3);
  const facts: PandFacts = {
    id, buurt, year: yearOf.get(id) ?? null, widthM: +(street.length ? Math.max(...street.map(e => e.len)) : box.shortM).toFixed(2), heightM: +fp.height.toFixed(2),
    areaM2: Math.round(area), corner: isCorner(street.map(e => [e.b.x - e.a.x, e.b.y - e.a.y] as [number, number])), backland: street.length === 0,
  };
  return { facts, readings: readings.get(id) ?? {} };
});
type Res = ReturnType<typeof resolveAll>['resolved'][number];
const sampled = resolveAll(list, 'sample'), moded = resolveAll(list, 'mode');
const { resolved, priors } = sampled;
const byId = new Map(resolved.map(r => [r.facts.id, r]));
const flags = new Map(resolved.map(r => [r.facts.id, distinctiveFlags(r.facts, { elements: elements.get(r.facts.id), modelled: kitPands.has(r.facts.id) })]));
const isDistinctive = (r: Res) => flags.get(r.facts.id)!.length > 0;
const anyPrior = (r: Res) => FIELDS.some(f => r[f].source === 'prior');

const mix: Record<string, Record<string, number>> = {};
for (const f of FIELDS) { mix[f] = Object.fromEntries(SOURCES.map(s => [s, 0])); for (const r of resolved) mix[f][r[f].source]++; }

const street = resolved.filter(r => !r.facts.backland);
const candidates = street.filter(r => !isDistinctive(r));
const modeById = new Map(moded.resolved.map(r => [r.facts.id, r]));
const asMode = (rs: Res[]) => rs.map(r => modeById.get(r.facts.id)!);
function table(subset: Res[], variant: Variant, omitPrior: boolean) {
  const groups = groupKeys(subset.map(r => ({ id: r.facts.id, key: keyOf(r, variant, omitPrior) })));
  return { pands: subset.length, keys: groups.length, cover: keysForShares(groups.map(g => g.ids.length)), groups };
}
/** [label, pands, prior treatment]: the rows of the coverage table. */
const rows: [string, Res[], boolean][] = [
  ['all belt pands, sampled priors', resolved, false],
  ['street houses, sampled priors', street, false],
  ['library candidates (street, not distinctive), sampled priors', candidates, false],
  ['library candidates, mode priors (floor: unread houses of a bucket all alike)', asMode(candidates), false],
  ['street houses, prior fields wildcarded (?)', street, true],
  ['pands with every field read (no prior)', street.filter(r => !anyPrior(r)), false],
];
const tables: Record<string, any> = {};
for (const v of VARIANTS) { tables[v] = {}; for (const [label, rs, omit] of rows) tables[v][label] = table(rs, v, omit); }

const sourceBlend = (ids: string[]) => { const o: Record<string, number> = {}; for (const id of ids) for (const f of FIELDS) { const s = byId.get(id)![f].source; o[`${f}:${s}`] = (o[`${f}:${s}`] ?? 0) + 1; } return o; };
const top = (v: Variant, n: number, label: string) => tables[v][label].groups.slice(0, n).map((g: any, i: number) => ({
  rank: i + 1, key: g.key, count: g.ids.length, share: +(g.ids.length / tables[v][label].pands).toFixed(4),
  priorFieldShare: +(FIELDS.reduce((s, f) => s + g.ids.filter((id: string) => byId.get(id)![f].source === 'prior').length, 0) / (g.ids.length * FIELDS.length)).toFixed(2),
  examples: g.ids.slice(0, 4), sources: sourceBlend(g.ids),
}));
const TOP_LABEL = 'library candidates (street, not distinctive), sampled priors';

// what the readings alone say: value distributions among the pands with a reading
const marginals: Record<string, Record<string, number>> = {};
for (const f of FIELDS) { marginals[f] = {}; for (const r of street) if (r[f].source !== 'prior') marginals[f][String(r[f].value)] = (marginals[f][String(r[f].value)] ?? 0) + 1; }

// crown profiles, as read: the raw word of the winning source (neck and bell kept apart)
const profileOf = (id: string): string | null => { const w = crownWords.get(id); if (!w?.length) return null; return [...w].sort((a, b) => SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source))[0].word; };
const PROFILES = ['neck', 'raised-neck', 'bell', 'step', 'spout', 'cornice', 'raised-dormer', 'mansard', 'plain', 'point', 'flat', 'shouldered', 'pitched-eaves'];
const profileCount = (rs: Res[]) => { const o: Record<string, number> = {}; for (const r of rs) if (r.crown.source !== 'prior') { const w = profileOf(r.facts.id) ?? 'other'; o[w] = (o[w] ?? 0) + 1; } return o; };
const priorCrownClass = (rs: Res[]) => { const o: Record<string, number> = {}; for (const r of rs) if (r.crown.source === 'prior') o[String(r.crown.value)] = (o[String(r.crown.value)] ?? 0) + 1; return o; };
const crownProfiles = { note: 'read crowns only (the source states the word); prior-assigned crowns are a class guess with no neck/bell split', streetHouses: profileCount(street), allBelt: profileCount(resolved), candidates: profileCount(candidates), priorClassStreetHouses: priorCrownClass(street), readShare: +(street.filter(r => r.crown.source !== 'prior').length / street.length).toFixed(3), bySource: Object.fromEntries(SOURCES.filter(s => s !== 'prior').map(s => [s, street.filter(r => r.crown.source === s).length])) };
const flagCount: Record<string, number> = {}; let distinctive = 0;
for (const r of street) { const fl = flags.get(r.facts.id)!; if (fl.length) distinctive++; for (const f of fl) flagCount[f] = (flagCount[f] ?? 0) + 1; }
const examples = (k: string) => street.filter(r => flags.get(r.facts.id)!.includes(k as never)).slice(0, 6).map(r => r.facts.id);
const wijkCount = (ws: string[]) => belt.filter(b => ws.includes(b.wijk)).reduce((n, b) => n + resolved.filter(r => r.facts.buurt === b.code).length, 0);

const perPand = resolved.map(r => ({ id: r.facts.id, buurt: r.facts.buurt, key: keyOf(r, 'fine'), coarse: keyOf(r, 'coarse'), src: FIELDS.map(f => r[f].source[0]).join(''), widthM: r.facts.widthM, backland: r.facts.backland || undefined, corner: r.facts.corner || undefined, flags: flags.get(r.facts.id)!.length ? flags.get(r.facts.id) : undefined }));
const slim = (t: any) => ({ pands: t.pands, keys: t.keys, cover: t.cover });
const out = {
  version: 1, generatedAt: new Date().toISOString().slice(0, 10),
  belt: { wijken, buurten: belt.map(b => b.code), pands: resolved.length, streetHouses: street.length, backland: resolved.length - street.length, aaToAh: wijkCount(['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH']), note: 'wijk codes AA-AP present in coverage-v1/buurten.json (AI and AL-AP have none). Pand = BAG pand whose footprint centroid lies in the buurt.' },
  inputs: { extractPands: nExtract, specFiles: nSpecs, handSetPands: hs.length, monumentGables: Object.keys(gables).length, registerFacts: Object.keys(regFacts).length },
  sourceOrder: SOURCES, sourceMix: mix, marginalsOfReads: marginals,
  priorsFittedFrom: Object.fromEntries(FIELDS.map(f => [f, (priors[f] as any).size])),
  coverage: Object.fromEntries(VARIANTS.map(v => [v, Object.fromEntries(Object.entries(tables[v]).map(([k, t]) => [k, slim(t)]))])),
  crownProfiles,
  top40: { populationLabel: TOP_LABEL, fine: top('fine', 40, TOP_LABEL), coarse: top('coarse', 40, TOP_LABEL) },
  residue: { distinctiveStreetHouses: distinctive, share: +(distinctive / street.length).toFixed(3), byFlag: flagCount, examples: Object.fromEntries(['ornament', 'corner', 'width', 'large', 'modelled'].map(k => [k, examples(k)])), widthThresholds: 'front width < 3.2 m or > 9 m (longest street-facing exposed wall); large > 350 m2; ornament = 2+ of sculpture/gablestone/festoons/claws/oeilDeBoeuf/pediment/pilasters/twinGable/anchors/crownCornice in the register; corner = two street-facing exposed walls >= 4 m at 60-120 degrees; modelled = in kit-pands.json' },
  pands: perPand,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'keys.json'), JSON.stringify(out));

// ---- markdown --------------------------------------------------------------------------------------------------------
const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
let md = `# Belt library keys (lane BL step 1, ${out.generatedAt})\n\nBelt = wijken ${wijken.join(', ')} (${belt.length} buurten; AA-AH alone hold ${out.belt.aaToAh} pands), ${resolved.length} pands by footprint centroid, of which ${street.length} face a street or quay (the rest are rear buildings and sheds). Key = crown | bays | storeys | finish | colour. Source order per field: ${SOURCES.join(' > ')}.\n\n## Source mix (all belt pands)\n\n| field | ${SOURCES.join(' | ')} |\n|---|${SOURCES.map(() => '---').join('|')}|\n`;
for (const f of FIELDS) md += `| ${f} | ${SOURCES.map(s => `${mix[f][s]} (${pct(mix[f][s], resolved.length)})`).join(' | ')} |\n`;
md += `\nPriors: crown and finish by build-year band; bays by front width; storeys by 3DBAG height; colour by buurt; fitted on the pands with a reading (${Object.entries(out.priorsFittedFrom).map(([f, n]) => `${f} ${n}`).join(', ')}), so they carry the bias of which houses got read (monuments for crown). "sampled" draws each unread field from the bucket's read distribution (independent fields, stable per pand id); "mode" gives every unread house of a bucket the same value and is a floor on the key count.\n\n## Keys needed to cover 50 / 80 / 95 % of pands\n\n| variant | population | pands | distinct keys | 50 % | 80 % | 95 % |\n|---|---|---|---|---|---|---|\n`;
for (const v of VARIANTS) for (const [pop, t] of Object.entries(tables[v]) as [string, any][]) md += `| ${v} | ${pop} | ${t.pands} | ${t.keys} | ${t.cover.map((c: any) => c.keys).join(' | ')} |\n`;
md += `\nfine = as read; coarse = bays 1-2/3-4/5+, storeys <=3/4-5/6+, crown straight/gable/roofed, colour red/brown/pale; bays-storeys = only the two counts coarsened.\n\n## What the readings alone say (street houses with a reading, by value)\n\n`;
for (const f of FIELDS) md += `- ${f}: ${Object.entries(marginals[f]).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}\n`;
md += `\n## Crown profiles as read (street houses: ${street.length}; ${(crownProfiles.readShare * 100).toFixed(0)}% have a read crown)\n\n| profile | street houses | all belt | library candidates |\n|---|---|---|---|\n`;
for (const w of [...PROFILES, 'other']) if (crownProfiles.streetHouses[w] || crownProfiles.allBelt[w]) md += `| ${w} | ${crownProfiles.streetHouses[w] ?? 0} | ${crownProfiles.allBelt[w] ?? 0} | ${crownProfiles.candidates[w] ?? 0} |\n`;
md += `\nBy source: ${Object.entries(crownProfiles.bySource).map(([k, n]) => `${k} ${n}`).join(', ')}. ${crownProfiles.note}. Prior-assigned crown classes: ${Object.entries(crownProfiles.priorClassStreetHouses).map(([k, n]) => `${k} ${n}`).join(', ')}.\n`;
for (const v of ['fine', 'coarse'] as const) {
  md += `\n## Top 40 keys (${v}; ${TOP_LABEL})\n\n| # | key | pands | share | prior fields | examples |\n|---|---|---|---|---|---|\n`;
  for (const t of out.top40[v]) md += `| ${t.rank} | ${t.key} | ${t.count} | ${(t.share * 100).toFixed(1)}% | ${(t.priorFieldShare * 100).toFixed(0)}% | ${t.examples.join(', ')} |\n`;
}
md += `\n## Distinctive residue (street houses)\n\n${distinctive} of ${street.length} (${pct(distinctive, street.length)}): ${Object.entries(flagCount).map(([k, n]) => `${k} ${n}`).join(', ')} (a pand can carry several). ${out.residue.widthThresholds}.\n\n`;
for (const [k, ids] of Object.entries(out.residue.examples)) md += `- ${k}: ${(ids as string[]).join(', ')}\n`;
fs.writeFileSync(path.join(OUT, 'keys.md'), md);
console.log(md.split('\n').slice(0, 60).join('\n'));
