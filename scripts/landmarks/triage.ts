/**
 * Landmark triage (GitHub #110): which queue candidates can pass the judge, decided from data that exists before any
 * draft, with no LLM call. Rules live in src/canalRecall/landmarks/triage.ts; this CLI gathers the facts.
 *
 *   node --import tsx scripts/landmarks/triage.ts [--queue=public/canal-drive/landmark-factory-queue.json]
 *        [--targets=docs/reports/landmark-targets-20261029.json] [--limit=40 (0 = all)] [--write]
 *        [--archives=<extra pand-reference-walls roots, comma separated>] [--houses=<extra houses dirs>]
 *        [--validate=<#105 staging houses dir>] [--selftest-out=docs/reports/landmark-triage-selftest-20261029.json]
 *        [--report=<json out>] [--no-measure]
 *
 * Per candidate: identity (BAG pand from the queue, the POI centre or the OSM parts of a #104 target; underground
 * stations and name merges dropped), `covered` (factory-queue.ts `coveredPands()`, covers.json twins included),
 * `not-in-tiles`, BAG build year and storeys (bag-facts tiles), tile height against the crop cap (rectify.ts
 * `wallHeight`), and per exposed wall in `$MAP_RECALL_SOURCE_DATA/pand-reference-walls/<pand>/walls.json` whether it
 * faces a routing street and whether its best crop is judgeable; measureFacade runs on that crop for the usable share
 * and the front class (cached by crop sha256 under artifacts/landmark-triage/). `--write` stores
 * `triage: {verdict, reasons, gaps, date}` on the queue rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import {coveredPands, QUEUE_FILE, type Queue} from './factory-queue.ts';
import {loadTile, pointInRing, rdToLngLat, type Footprint} from '../pand-reference/core.ts';
import {wallHeight} from '../pand-reference/rectify.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {measureFacade, type FrontClass} from '../../src/canalRecall/buildingRecipe/measureFacade.ts';
import {curtainEvidence} from '../../src/canalRecall/buildingRecipe/measureWriteback.ts';
import {triageCandidate, TRIAGE_VERDICTS, wallFacesStreet, type TriageResult, type WallCrop, type WallInput} from '../../src/canalRecall/landmarks/triage.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const has = (f: string) => process.argv.includes(f);
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const EX = 'public/data/extracts/amsterdam';
const today = new Date().toISOString().slice(0, 10);
const pandOf = (s: unknown): string | null => { const m = /(\d{16})/.exec(String(s ?? '')); return m ? m[1] : null; };

const sourceData = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const archives = [sourceData, ...arg('archives').split(',').filter(Boolean)].map(r => r.endsWith('pand-reference-walls') ? r : path.join(r, 'pand-reference-walls'));
const houseDirs = ['scripts/building-recipes/houses', ...arg('houses').split(',').filter(Boolean), ...(arg('validate') ? [arg('validate')] : [])];
const queueFile = arg('queue', QUEUE_FILE), targetsFile = arg('targets', 'docs/reports/landmark-targets-20261029.json');
const limit = Number(arg('limit', '40'));

// ---- tiles: every footprint once, with a coarse grid for point lookups
const tileFeatures = new Map<string, Footprint>();
const grid = new Map<string, Footprint[]>();
const gkey = (x: number, y: number) => `${Math.floor(x / 100)},${Math.floor(y / 100)}`;
for (const xd of fs.readdirSync(path.join(EX, 'building-tiles/14'))) for (const f of fs.readdirSync(path.join(EX, 'building-tiles/14', xd))) {
  for (const raw of await loadTile(Number(xd), Number(f.split('.')[0]))) {
    const fp = {...raw, id: raw.id.replace('NL.IMBAG.Pand.', '')};
    if (tileFeatures.has(fp.id)) continue;
    tileFeatures.set(fp.id, fp);
    const keys = new Set(fp.ring.map(p => gkey(p.x, p.y)));
    for (const k of keys) (grid.get(k) ?? grid.set(k, []).get(k)!).push(fp);
  }
}
const isPandId = (id: string) => /^\d{16}$/.test(id);
const area = (r: {x: number; y: number}[]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
const centroid = (r: {x: number; y: number}[]) => ({x: r.reduce((s, p) => s + p.x, 0) / r.length, y: r.reduce((s, p) => s + p.y, 0) / r.length});
function pandAt(p: {x: number; y: number}): Footprint | null {
  const hits = (grid.get(gkey(p.x, p.y)) ?? []).filter(fp => isPandId(fp.id) && pointInRing(p, fp.ring));
  return hits.sort((a, b) => area(a.ring) - area(b.ring))[0] ?? null;
}
/** A courtyard block's centroid lies in its courtyard: half its vertices, pulled 0.5 m toward that centroid, inside the part. */
function mostlyInside(ring: {x: number; y: number}[], part: {x: number; y: number}[]): boolean {
  const c = centroid(ring);
  const n = ring.filter(p => { const d = Math.hypot(c.x - p.x, c.y - p.y) || 1; return pointInRing({x: p.x + (c.x - p.x) * 0.5 / d, y: p.y + (c.y - p.y) * 0.5 / d}, part); }).length;
  return n >= ring.length / 2;
}
/** BAG pands of the tiles whose centroid lies inside one of these OSM parts, largest first. */
function pandsInside(parts: Footprint[]): Footprint[] {
  const out = new Map<string, Footprint>();
  for (const part of parts) {
    const keys = new Set(part.ring.map(p => gkey(p.x, p.y)));
    for (const k of keys) for (const fp of grid.get(k) ?? []) if (isPandId(fp.id) && area(fp.ring) > 150 && (pointInRing(centroid(fp.ring), part.ring) || mostlyInside(fp.ring, part.ring))) out.set(fp.id, fp);
  }
  // a curved or L-shaped pand's vertex mean can fall outside its part: also the pand under each part's own centre
  for (const part of parts) { const p = pandAt(centroid(part.ring)); if (p && area(p.ring) > 150) out.set(p.id, p); }
  return [...out.values()].sort((a, b) => area(b.ring) - area(a.ring));
}

// ---- BAG facts (archetype, storeys, roof, eaves, ridge, year, terraced) by z14 tile
const bagCache = new Map<string, Record<string, number[]>>();
function bagFacts(pand: string, fp: Footprint | undefined): {year: number | null; storeys: number | null} {
  if (!fp) return {year: null, storeys: null};
  const [lng, lat] = rdToLngLat(centroid(fp.ring)), n = 2 ** 14;
  const tx = Math.floor((lng + 180) / 360 * n), s = Math.sin(lat * Math.PI / 180), ty = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  for (const ddx of [0, -1, 1]) for (const ddy of [0, -1, 1]) {
    const key = `${tx + ddx}/${ty + ddy}`;
    if (!bagCache.has(key)) { try { bagCache.set(key, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(EX, 'bag-facts/14', `${key}.json.gz`))).toString('utf8')).pands); } catch { bagCache.set(key, {}); } }
    const row = bagCache.get(key)![pand];
    if (row) return {year: row[5] || null, storeys: row[1] || null};
  }
  return {year: null, storeys: null};
}

// ---- streets (routing paths with a name, RD)
const streets = (read(`${EX}/streets-routing.json`) as any[]).filter(s => s.name).map(s => ({name: s.name as string, paths: ((s.paths ?? [s.path]) as [number, number][][]).map(p => p.map(q => { const r = lngLatToRd([q[1], q[0]]); return [r.x, r.y] as [number, number]; }))}));
const streetGrid = new Map<string, typeof streets>();
for (const s of streets) { const keys = new Set(s.paths.flat().map(p => gkey(p[0], p[1]))); for (const k of keys) (streetGrid.get(k) ?? streetGrid.set(k, []).get(k)!).push(s); }
function streetOf(mid: [number, number], normal: [number, number]): string | null {
  let best: {name: string; d: number} | null = null;
  const seen = new Set<object>();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const s of streetGrid.get(gkey(mid[0] + dx * 100, mid[1] + dy * 100)) ?? []) {
    if (seen.has(s)) continue; seen.add(s);
    for (const p of s.paths) { const d = wallFacesStreet(mid, normal, p); if (d !== null && (!best || d < best.d)) best = {name: s.name, d}; }
  }
  return best?.name ?? null;
}

// ---- covers: which model draws a pand (coveredPands plus the covers.json model name for the reason)
const covered = coveredPands();
const coverName = new Map<string, string>();
for (const [k, m] of Object.entries(read('public/canal-drive/models/covers.json').models as Record<string, {p?: string[]}>)) for (const p of m.p ?? []) { const id = pandOf(p); if (id && !coverName.has(id)) coverName.set(id, k); }

// ---- measured.json (measure.ts output) by crop tag, where a house was measured
const measuredByCrop = new Map<string, {frontClass: FrontClass | null; usable: number | null}>();
for (const dir of houseDirs) { if (!fs.existsSync(dir)) continue; for (const h of fs.readdirSync(dir)) {
  const f = path.join(dir, h, 'measured.json'); if (!fs.existsSync(f)) continue;
  try { for (const g of read(f).groups ?? []) { const ref = g.crop?.ref as string | undefined, l = g.likeness; if (!ref || !l) continue;
    measuredByCrop.set(ref.replace(/^source-data:\/\/pand-reference-walls\//, '').replace(/\.jpg$/, ''), {frontClass: l.classes?.photo ?? null, usable: l.evidence?.usable ?? null}); } } catch { /* unreadable */ }
} }

// ---- crop measurement (cached by sha256)
const CACHE = 'artifacts/landmark-triage/measure-cache.json';
const cache: Record<string, {usable: number; foliage: number; washedOut: number; frontClass: FrontClass; family: string | null; glazing: number; curtainDoubt?: string[]}> = fs.existsSync(CACHE) ? read(CACHE) : {};
let measuredNow = 0;
const saveCache = () => { fs.mkdirSync(path.dirname(CACHE), {recursive: true}); fs.writeFileSync(CACHE, JSON.stringify(cache)); };
async function measureCrop(dir: string, row: any, heightM: number, storeys: number | null) {
  const key = row.sha256 ?? `${dir}/${row.tag}`;
  if (cache[key]) return cache[key];
  const jpg = path.join(dir, `${row.tag}.jpg`), maskF = path.join(dir, `${row.tag}.mask.png`);
  if (!fs.existsSync(jpg)) return null;
  const {data, info} = await sharp(jpg).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const valid = fs.existsSync(maskF) ? new Uint8Array(await sharp(maskF).extractChannel(0).raw().toBuffer()) : undefined;
  const widthM = Number(row.wallWidthM ?? row.lengthM);
  if (!(widthM > 0)) return null;
  const ppm = info.width / widthM, topM = info.height / ppm;
  const top = Math.min(Math.max(heightM, 4), topM), n = Math.max(1, storeys ?? Math.round(top / 3.2));
  const lines = Array.from({length: n + 1}, (_, i) => +(i * top / n).toFixed(2));
  let m;
  try { m = measureFacade({image: {width: info.width, height: info.height, rgb: new Uint8Array(data), valid, ppm, topM}, box: {u0: 0, u1: info.width / ppm, v0: 0, v1: top}, lines}); } catch (e) { console.log(`  measure failed ${dir}/${row.tag}: ${(e as Error).message}`); return null; }
  if (++measuredNow % 25 === 0) saveCache();
  return cache[key] = {usable: +m.usableFraction.toFixed(3), foliage: +m.foliageFraction.toFixed(3), washedOut: +m.washedOutFraction.toFixed(3), frontClass: m.frontClass, family: m.material?.family ?? null, glazing: m.glazing,
    ...(m.frontClass === 'curtain' ? {curtainDoubt: curtainEvidence({glass: m.glass?.hex ?? null, wall: m.wall.hex, usable: m.usableFraction, likenessUsable: m.usableFraction, foliage: m.foliageFraction, washedOut: m.washedOutFraction})} : {})};
}

// ---- candidates
interface Candidate { id: string; pand: string | null; name: string | null; source: string; rank?: number; queueRow?: any; dropped?: string[]; identityNote?: string; resolved?: boolean }
const queue: Queue = read(queueFile);
const targets = fs.existsSync(targetsFile) ? read(targetsFile).targets as any[] : [];
const dominant = new Map<string, any>((read('public/canal-drive/dominant-building-backlog.json').candidates as any[]).map(c => [String(c.id).replace('NL.IMBAG.Pand.', ''), c]));
const cands: Candidate[] = [];
for (const r of queue.items) {
  if (r.pand) { cands.push({id: r.id, pand: r.pand, name: r.name, source: 'queue', queueRow: r}); continue; }
  const p = r.center ? pandAt(lngLatToRd(r.center)) : null;
  cands.push({id: r.id, pand: p?.id ?? null, name: r.name, source: 'queue', queueRow: r, identityNote: p ? `pand ${p.id} under the POI centre` : 'no BAG pand in the tiles under the POI centre'});
}
for (const t of targets) {
  const ids: string[] = t.pandIds ?? [], bag = ids.filter(isPandId), osm = ids.filter(i => /^[wr]\d+$/.test(i));
  const ident = dominant.get(ids[0])?.identity ?? {}, tags = ident.osmTags ?? {};
  const dropped: string[] = [];
  if (/vervoerbedrijf|\bgvb\b/i.test(tags.operator ?? '') || /metro|station/i.test(`${tags.railway ?? ''} ${tags.public_transport ?? ''}`) || tags.location === 'underground' || Number(tags.layer) < 0) dropped.push(`underground station (${tags.operator ?? tags.railway ?? 'layer < 0'})`);
  if ((ident.sharedWith ?? 1) >= 10) dropped.push(`name merge over ${ident.sharedWith} OSM ways`);
  if (bag.length) { for (const p of bag) cands.push({id: p, pand: p, name: t.name, source: 'target', rank: t.rank, dropped}); continue; }
  const parts = osm.map(i => tileFeatures.get(i)).filter((x): x is Footprint => !!x);
  const inside = pandsInside(parts);
  // an OSM way the tiles do not draw (the BAG pand replaced it): the pand under the backlog's centre
  const centre = dominant.get(osm[0])?.center as [number, number] | undefined;
  if (!parts.length && centre) { const p = pandAt(lngLatToRd(centre)); if (p) inside.push(p); }
  cands.push({id: osm[0], pand: inside[0]?.id ?? null, name: t.name, source: 'target', rank: t.rank, dropped, resolved: true,
    identityNote: inside.length ? `OSM ${osm.length} part(s) resolve to BAG pand ${inside[0].id}${inside.length > 1 ? ` (+${inside.length - 1} more)` : ''}` : `OSM ${osm.length} part(s) ${osm.slice(0, 2).join(',')}: no BAG pand of the tiles inside (the OSM parts draw it)`});
}
// dedupe by pand (queue rows first)
const byPand = new Map<string, Candidate>(), list: Candidate[] = [];
for (const c of cands) { if (c.pand && byPand.has(c.pand)) { const o = byPand.get(c.pand)!; o.rank ??= c.rank; continue; } if (c.pand) byPand.set(c.pand, c); list.push(c); }
const work = limit > 0 ? list.slice(0, limit) : list;

// ---- triage
interface Row extends Candidate { triage: TriageResult & {date: string}; heightM: number | null; builtYear: number | null }
const rows: Row[] = [];
for (const c of work) {
  const fp = c.pand ? tileFeatures.get(c.pand) : undefined;
  const {year, storeys} = c.pand ? bagFacts(c.pand, fp) : {year: null, storeys: null};
  const heightM = fp ? +fp.height.toFixed(1) : null;
  const mon = c.pand ? dominant.get(c.pand)?.identity?.monument : null, monNo = Number(mon?.number ?? 0);
  const walls: WallInput[] = [];
  const dir = c.pand ? archives.map(a => path.join(a, c.pand!)).find(d => fs.existsSync(path.join(d, 'walls.json')) && fs.readdirSync(d).some(f => f.endsWith('.jpg'))) : undefined;
  if (dir && fp) {
    const byWall = new Map<string, any[]>();
    for (const w of read(path.join(dir, 'walls.json')).walls ?? []) { const k = /^w\d+/.exec(w.tag)?.[0] ?? w.tag; (byWall.get(k) ?? byWall.set(k, []).get(k)!).push(w); }
    for (const [k, ws] of byWall) {
      const w0 = ws[0], a = w0.wallRD?.a, b = w0.wallRD?.b, nrm = w0.wallRD?.normal;
      const street = a && b && nrm ? streetOf([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], nrm) : null;
      const crops: WallCrop[] = [];
      for (const w of ws.sort((p: any, q: any) => (p.obliquityDeg ?? 90) - (q.obliquityDeg ?? 90))) {
        const crop: WallCrop = {tag: w.tag, lengthM: w.lengthM, crop: w.crop !== false && fs.existsSync(path.join(dir, `${w.tag}.jpg`)), capturedAt: w.capturedAt, cameraDistM: w.cameraDistM, obliquityDeg: w.obliquityDeg, foliage: w.foliage, washedOut: w.washedOut, missingFraction: w.missingFraction};
        const prior = measuredByCrop.get(`${c.pand}/${w.tag}`);
        if (prior) { crop.frontClass = prior.frontClass; crop.usable = prior.usable; }
        crops.push(crop);
      }
      // measure the straightest crops until one is judgeable (only those the walls.json fields do not already rule out)
      if (!has('--no-measure')) for (const crop of crops) {
        const pre = triageCandidate({inTiles: true, covered: null, builtYear: year, heightM, cropCapped: false, walls: [{wall: k, lengthM: crop.lengthM, street, crops: [crop]}]});
        if (!pre.walls[0]?.judgeable && pre.walls[0]?.reasons.length) continue;
        if (!crop.frontClass || crop.usable == null) {
          const m = await measureCrop(dir, ws.find((w: any) => w.tag === crop.tag), heightM ?? 10, storeys);
          if (m) { crop.usable ??= m.usable; crop.frontClass ??= m.frontClass; crop.family = m.family; crop.foliage = m.foliage; crop.washedOut = m.washedOut; crop.glazing = m.glazing; crop.curtainDoubt = m.curtainDoubt; }
        }
        const post = triageCandidate({inTiles: true, covered: null, builtYear: year, heightM, cropCapped: false, walls: [{wall: k, lengthM: crop.lengthM, street, crops: [crop]}]});
        if (post.walls[0]?.judgeable) break;
      }
      walls.push({wall: k, lengthM: w0.lengthM, street, crops});
    }
  }
  const capTop = heightM != null ? wallHeight(heightM) : null;
  const t = triageCandidate({dropped: c.dropped, inTiles: !!fp, covered: c.pand && covered.has(c.pand) ? coverName.get(c.pand) ?? 'a placed model or catalogue entry' : null,
    builtYear: year, rijksmonument: monNo > 0 && (monNo < 200000 || monNo >= 500000), heightM, cropCapped: heightM != null && capTop! < heightM, cropTopM: capTop, walls});
  if (c.identityNote) t.reasons.unshift(c.identityNote);
  if (fp && !dir && t.verdict === 'no-evidence' && !walls.length) t.reasons.push('no archived crops (pand-reference-walls/<pand>/walls.json): run the factory crops stage');
  rows.push({...c, heightM, builtYear: year, triage: {...t, date: today}});
}
if (measuredNow) saveCache();

// ---- summary
const count = (rs: Row[]) => Object.fromEntries(TRIAGE_VERDICTS.map(v => [v, rs.filter(r => r.triage.verdict === v).length]));
console.log(`triage ${today}: ${rows.length} candidates (${rows.filter(r => r.source === 'queue').length} queue, ${rows.filter(r => r.source === 'target').length} target-only), ${measuredNow} crops measured`);
for (const [v, n] of Object.entries(count(rows))) console.log(`  ${v.padEnd(13)} ${n}`);
const gapCounts = new Map<string, number>();
for (const r of rows) for (const g of r.triage.gaps) gapCounts.set(g, (gapCounts.get(g) ?? 0) + 1);
if (gapCounts.size) console.log(`  kit gaps: ${[...gapCounts].sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(', ')}`);

// ---- validation against recorded review outcomes (#105 drafts + factory verdicts)
let validation: any[] = [];
if (arg('validate')) {
  const known = new Map<string, {name: string; recorded: string; note: string; from: string}>();
  for (const r of queue.items) if (r.verdict) known.set(r.pand, {name: r.name ?? r.id, recorded: r.verdict.outcome, note: r.verdict.note ?? '', from: 'factory'});
  for (const h of fs.readdirSync(arg('validate'))) {
    const f = path.join(arg('validate'), h, 'draft.json'), i = path.join(arg('validate'), h, 'intent.json');
    if (!fs.existsSync(f) || !fs.existsSync(i)) continue;
    const p = pandOf(read(i).pandId); if (p && !known.has(p)) known.set(p, {name: h, recorded: 'hold', note: '#105: held, not installed', from: '#105'});
  }
  for (const [pand, k] of known) {
    let r = rows.find(x => x.pand === pand);
    if (!r) { console.log(`  validate: ${pand} ${k.name} not in the triaged set (raise --limit)`); continue; }
    // a pass since installed is now covered: that is the recorded outcome too
    const predicted = r.triage.verdict, ok = k.recorded === 'pass' ? predicted === 'buildable' || predicted === 'covered' : predicted !== 'buildable';
    validation.push({pand, name: k.name, from: k.from, recorded: k.recorded, predicted, ok, reasons: r.triage.reasons.slice(0, 4), recordedNote: k.note});
  }
  const bad = validation.filter(v => !v.ok);
  console.log(`validation: ${validation.length} known houses, ${validation.length - bad.length} predicted correctly; let through: ${bad.filter(v => v.recorded !== 'pass').map(v => `${v.name} (${v.pand.slice(-6)})`).join(', ') || 'none'}; passes refused: ${bad.filter(v => v.recorded === 'pass').map(v => `${v.name} [${v.predicted}]`).join(', ') || 'none'}`);
}

// ---- self-test batch: ten buildable pands, best ride visibility first
if (arg('selftest-out')) {
  const known = new Set(validation.map(v => v.pand));
  const vis = (r: Row) => r.queueRow?.rideVisibility?.score ?? 0;
  const pick = rows.filter(r => r.triage.verdict === 'buildable' && r.pand && !known.has(r.pand)).sort((a, b) => vis(b) - vis(a)).slice(0, 10);
  fs.writeFileSync(arg('selftest-out'), JSON.stringify({schema: 'landmark-triage-selftest/v1', date: today, command: 'node --import tsx scripts/landmarks/triage.ts --limit=0',
    note: 'Fixed batch: a triage run over these pands must return these verdicts and the same judgeable street walls; a factory run over them is the skill self-test.',
    pands: pick.map(r => ({pand: r.pand, name: r.name, expected: {verdict: r.triage.verdict, judgeableStreetWalls: r.triage.walls.filter(w => w.judgeable && w.street).map(w => `${w.wall}:${w.frontClass}`)}, heightM: r.heightM, builtYear: r.builtYear}))}, null, 2) + '\n');
  console.log(`self-test batch: ${pick.length} pands -> ${arg('selftest-out')}`);
}
if (arg('report')) fs.writeFileSync(arg('report'), JSON.stringify({date: today, counts: count(rows), gaps: Object.fromEntries(gapCounts), validation,
  rows: rows.map(r => ({id: r.id, pand: r.pand, name: r.name, source: r.source, rank: r.rank, heightM: r.heightM, builtYear: r.builtYear, verdict: r.triage.verdict, gaps: r.triage.gaps, reasons: r.triage.reasons}))}, null, 1) + '\n');

if (has('--write')) {
  const byId = new Map(rows.filter(r => r.queueRow).map(r => [r.id, r]));
  for (const item of queue.items) { const r = byId.get(item.id); if (r) (item as any).triage = {verdict: r.triage.verdict, reasons: r.triage.reasons, gaps: r.triage.gaps, date: today}; }
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 1) + '\n');
  console.log(`wrote triage to ${byId.size} rows of ${queueFile}`);
}
