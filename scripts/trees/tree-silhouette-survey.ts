#!/usr/bin/env tsx
/**
 * Tree silhouette survey (lane T-shape #371): measure real crowns from summer panoramas, and the game's crowns from
 * the typology, on the same terms.
 */
const HELP = `tree-silhouette-survey: crown width/height, crown base and outline from panoramas vs the game.

  npx tsx scripts/trees/tree-silhouette-survey.ts [--species=30] [--per=6] [--tries=40] [--out=DIR] [--offline]

  1. Species: the commonest named species inside the ride-priority gebieden (src/canalRecall/ridePriority.ts),
     plus the species of every row of trees >= 15 m tall (>= 8 trees of one species and planting year, <= 12 m apart).
  2. For each species, unmanaged trees with a known height class; for each a summer (June-September) Gemeente
     Amsterdam panorama 8-22 m away with no other inventory tree in front; an aimed view from the thumbnail endpoint.
  3. Foliage mask (src/canalRecall/trees/silhouetteMeasure.ts) → crown top, base, widest run, outline.
  4. The game's silhouette for the same tree (src/canalRecall/trees/gameSilhouette.ts) with ?treeShape off and on.

  Views are cached in .cache/tree-silhouettes/ (rerun is free; --offline uses only the cache). Writes
  DIR/survey.json (default docs/reports/trees-silhouette-20261110). Open data: Gemeente Amsterdam municipal trees and
  panoramas (CC BY 4.0).`;
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { treeTypology, normalizedTreeName, setTreeShaper } from '../../public/canal-drive/da-costa-block/tree-typology.js';
import { treeShaper } from '../../src/canalRecall/trees/treeShape';
import { RIDE_PRIORITY_GEBIEDEN } from '../../src/canalRecall/ridePriority';
import { foliageMask, measureCrown, outlineOf, type ViewGeometry } from '../../src/canalRecall/trees/silhouetteMeasure';
import { gameSilhouette } from '../../src/canalRecall/trees/gameSilhouette';

const args = process.argv.slice(2);
if (args.includes('--help')) { console.log(HELP); process.exit(0); }
const opt = (n: string, d: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ROOT = path.resolve(import.meta.dirname, '../..');
const TILES = path.join(ROOT, 'public/data/extracts/amsterdam/municipal-trees/tiles');
const CACHE = path.join(ROOT, '.cache/tree-silhouettes');
const OUT = path.resolve(ROOT, opt('out', 'docs/reports/trees-silhouette-20261110'));
const N_SPECIES = +opt('species', '30'), PER = +opt('per', '6'), TRIES = +opt('tries', '40'), OFFLINE = args.includes('--offline');
const CAMERA_HEIGHT = 2.5; // Cyclomedia/Amsterdam recording car rig, metres above the road.
const UA = 'MapRecall-TreeSilhouettes/1.0 (open-data tree crown survey; CC BY 4.0 Gemeente Amsterdam panoramas)';
setTreeShaper(treeShaper);
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

interface Tree { id: string; lng: number; lat: number; species: string; height: number | null; heightClass: string | null; type: string | null; planted: number | null; }
const M_LAT = 110540, M_LNG = 111320 * Math.cos(52.37 * Math.PI / 180);

function heightRange(hc: string | null): [number, number] | null {
  if (!hc) return null;
  let m = hc.match(/(\d+) tot (\d+) m/); if (m && !hc.startsWith('ZZ')) return [+m[1], +m[2]];
  if ((m = hc.match(/tot (\d+) m/))) return [2, +m[1]];
  if ((m = hc.match(/(\d+) m\. en hoger/))) return [+m[1], +m[1] + 8];
  return null;
}
const seed = (s: string) => parseInt(crypto.createHash('sha1').update(s).digest('hex').slice(0, 8), 16);

// ---- trees and the ride-priority area
const trees: Tree[] = [];
for (const f of fs.readdirSync(TILES)) for (const t of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, f))).toString()).trees) if (t.id?.startsWith('ams-')) trees.push(t);
const buurten = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/coverage-v1/buurten.json'), 'utf8')).features
  .filter((f: any) => RIDE_PRIORITY_GEBIEDEN.has(f.properties.gebied));
const rings: number[][][] = buurten.flatMap((f: any) => f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p: any) => p[0]));
const boxes = rings.map(r => [Math.min(...r.map(p => p[0])), Math.max(...r.map(p => p[0])), Math.min(...r.map(p => p[1])), Math.max(...r.map(p => p[1]))]);
function inRing(r: number[][], x: number, y: number) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
const inPriority = (t: Tree) => rings.some((r, i) => t.lng >= boxes[i][0] && t.lng <= boxes[i][1] && t.lat >= boxes[i][2] && t.lat <= boxes[i][3] && inRing(r, t.lng, t.lat));
const generic = (s: string) => !s || /\b(cv\.|sp\.|spec\.)$/.test(s) || !s.includes(' ');
const priority = trees.filter(inPriority);
const counts = new Map<string, number>();
for (const t of priority) { const s = normalizedTreeName(t.species); if (!generic(s)) counts.set(s, (counts.get(s) ?? 0) + 1); }
const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, N_SPECIES).map(([s]) => s);

// ---- tall rows: >= 15 m, one species and planting year, chained <= 12 m apart, >= 8 trees
const cell = (t: Tree) => `${Math.floor(t.lng * M_LNG / 12)},${Math.floor(t.lat * M_LAT / 12)}`;
const tall = trees.filter(t => (t.height ?? 0) >= 15 && !generic(normalizedTreeName(t.species)));
const grid = new Map<string, Tree[]>();
for (const t of tall) { const k = cell(t); (grid.get(k) ?? grid.set(k, []).get(k)!).push(t); }
const seen = new Set<string>(), rows: Array<{ species: string; planted: number | null; trees: number; lng: number; lat: number; height: number }> = [];
for (const t of tall) {
  if (seen.has(t.id)) continue;
  const key = `${normalizedTreeName(t.species)}|${t.planted}`, group: Tree[] = [], stack = [t]; seen.add(t.id);
  while (stack.length) {
    const a = stack.pop()!; group.push(a);
    const [cx, cy] = cell(a).split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const b of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
      if (seen.has(b.id) || `${normalizedTreeName(b.species)}|${b.planted}` !== key) continue;
      if (Math.hypot((a.lng - b.lng) * M_LNG, (a.lat - b.lat) * M_LAT) <= 12) { seen.add(b.id); stack.push(b); }
    }
  }
  if (group.length >= 8) rows.push({ species: normalizedTreeName(t.species), planted: t.planted, trees: group.length, lng: +group[0].lng.toFixed(6), lat: +group[0].lat.toFixed(6), height: Math.max(...group.map(g => g.height ?? 0)) });
}
rows.sort((a, b) => b.trees - a.trees);
const rowSpecies = new Map<string, number>();
for (const r of rows) rowSpecies.set(r.species, (rowSpecies.get(r.species) ?? 0) + r.trees);
const extra = [...rowSpecies].sort((a, b) => b[1] - a[1]).map(([s]) => s).filter(s => !top.includes(s)).slice(0, 10);
const species = [...top, ...extra];
console.error(`${trees.length} trees, ${priority.length} in ride-priority; ${rows.length} tall rows; species ${top.length} + ${extra.length} tall-row`);

// ---- panoramas
async function cached(url: string, ext: string): Promise<Buffer | null> {
  const file = path.join(CACHE, crypto.createHash('sha1').update(url).digest('hex') + ext);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  if (OFFLINE) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 404) return null;
      if (!r.ok) throw Error(String(r.status));
      const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(file, b); return b;
    } catch { await new Promise(res => setTimeout(res, 1500 * (attempt + 1))); }
  }
  return null;
}
interface Pano { id: string; lng: number; lat: number; ts: string; }
async function panosNear(t: Tree): Promise<Pano[]> {
  const b = await cached(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${t.lng},${t.lat}&srid=4326&radius=22&page_size=100`, '.json');
  if (!b) return [];
  return (JSON.parse(b.toString())._embedded?.panoramas ?? []).map((p: any) => ({ id: p.pano_id, lng: p.geometry.coordinates[0], lat: p.geometry.coordinates[1], ts: p.timestamp }));
}

const near = new Map<string, Tree[]>();
for (const t of trees) { const k = `${Math.floor(t.lng * M_LNG / 30)},${Math.floor(t.lat * M_LAT / 30)}`; (near.get(k) ?? near.set(k, []).get(k)!).push(t); }
const around = (t: Tree) => { const cx = Math.floor(t.lng * M_LNG / 30), cy = Math.floor(t.lat * M_LAT / 30), o: Tree[] = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) o.push(...(near.get(`${cx + dx},${cy + dy}`) ?? [])); return o.filter(b => b.id !== t.id); };

const DEG = 180 / Math.PI;
interface Record_ { id: string; species: string; heightClass: string; inventoryHeight: number | null; pano: string; date: string; distance: number; view: string;
  top: number; base: number; baseCensored: boolean; width: number; widestAt: number; widthCapped: boolean; fill: number; profile: number[];
  widthRatio: number; baseFraction: number; widestFraction: number; outline: string; }
const records: Record_[] = [], rejects: Record<string, number> = {};
const reject = (why: string) => { rejects[why] = (rejects[why] ?? 0) + 1; };

async function survey(t: Tree, s: string): Promise<Record_ | null> {
  const range = heightRange(t.heightClass);
  if (!range) return null;
  const panos = (await panosNear(t)).filter(p => { const m = +p.ts.slice(5, 7); return m >= 6 && m <= 9; });
  const others = around(t);
  const options = panos.map(p => {
    const dx = (t.lng - p.lng) * M_LNG, dy = (t.lat - p.lat) * M_LAT, d = Math.hypot(dx, dy);
    return { p, dx, dy, d };
  }).filter(o => o.d >= 8 && o.d <= 22).filter(o => {
    const fx = o.dx / o.d, fy = o.dy / o.d;
    // Nothing in front: no other inventory tree in the sight line closer than the target.
    return !others.some(b => { const bx = (b.lng - o.p.lng) * M_LNG, by = (b.lat - o.p.lat) * M_LAT, depth = bx * fx + by * fy, lat = -bx * fy + by * fx; return depth > 1 && depth < o.d - 1.5 && Math.abs(lat) < 2.2 + depth * 0.08; });
  }).sort((a, b) => b.p.ts.localeCompare(a.p.ts) || Math.abs(a.d - 13) - Math.abs(b.d - 13));
  if (!panos.length) { reject('no summer panorama'); return null; }
  if (!options.length) { reject('no clear 8-22 m sight line'); return null; }
  const o = options[0], heading = (Math.atan2(o.dx, o.dy) * DEG + 360) % 360;
  const hTop = range[1] * 1.3 + 1, eLo = Math.atan2(0.3 - CAMERA_HEIGHT, o.d) * DEG, eHi = Math.atan2(hTop - CAMERA_HEIGHT, o.d) * DEG;
  const fov = Math.min(115, Math.max(50, Math.round(eHi - eLo + 8))), pitch = Math.round((eHi + eLo) / 2);
  const W = 800;
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${o.p.id}/?width=${W}&aspect=1&fov=${fov}&heading=${Math.round(heading)}&pitch=${pitch}`;
  const jpg = await cached(url, '.jpg');
  if (!jpg) { reject('thumbnail unavailable'); return null; }
  const { data, info } = await sharp(jpg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // The endpoint snaps the heading to whole degrees; the residual is inside the axis search band.
  const g: ViewGeometry = { width: info.width, height: info.height, fovDeg: fov, pitchDeg: pitch, cameraHeight: CAMERA_HEIGHT, distance: o.d };
  const fx = o.dx / o.d, fy = o.dy / o.d;
  let left = -Infinity, right = Infinity;
  for (const b of others) {
    const bx = (b.lng - o.p.lng) * M_LNG, by = (b.lat - o.p.lat) * M_LAT, depth = bx * fx + by * fy, lat = bx * fy - by * fx;
    if (depth < 2) continue;
    const seenLat = (lat * o.d) / depth;
    if (seenLat < 0 && seenLat > -15) left = Math.max(left, seenLat / 2);
    if (seenLat > 0 && seenLat < 15) right = Math.min(right, seenLat / 2);
  }
  const m = measureCrown(foliageMask(data, info.width, info.height, info.channels), g, { expectedHeight: range[1], leftLimit: left, rightLimit: right });
  if (!m) { reject('no crown found'); return null; }
  if (m.top < range[0] * 0.65 || m.top > range[1] * 1.45 + 2) { reject('top outside height class'); return null; }
  const crown = Math.max(0.5, m.top - m.base);
  return { id: t.id, species: s, heightClass: t.heightClass!, inventoryHeight: t.height, pano: o.p.id, date: o.p.ts.slice(0, 10), distance: +o.d.toFixed(1), view: url,
    top: m.top, base: m.base, baseCensored: m.baseCensored, width: m.width, widestAt: m.widestAt, widthCapped: m.widthCapped, fill: m.fill, profile: m.profile,
    widthRatio: +(m.width / m.top).toFixed(3), baseFraction: +(m.base / m.top).toFixed(3), widestFraction: +((m.widestAt - m.base) / crown).toFixed(3), outline: outlineOf(m.width, crown, (m.widestAt - m.base) / crown) };
}

const median = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), k = s.length >> 1; return +(s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2).toFixed(3); };
const bySpecies = new Map<string, Tree[]>();
for (const t of trees) { const s = normalizedTreeName(t.species); if (species.includes(s)) (bySpecies.get(s) ?? bySpecies.set(s, []).get(s)!).push(t); }
const unmanaged = (t: Tree) => t.type === 'Boom niet vrij uitgroeiend' || t.type === 'Boom vrij uitgroeiend';
for (const s of species) {
  const pool = (bySpecies.get(s) ?? []).filter(t => unmanaged(t) && heightRange(t.heightClass));
  const pri = pool.filter(inPriority), cands = (pri.length >= 20 ? pri : pool).sort((a, b) => seed(a.id) - seed(b.id)).slice(0, TRIES);
  let n = 0;
  for (const t of cands) { if (n >= PER) break; const r = await survey(t, s); if (r) { records.push(r); n++; } }
  console.error(`${s}: ${n} measured of ${cands.length} tried`);
}

// ---- the game, before (flag off) and after (?treeShape=1)
function gameFor(t: Tree, shape: boolean) {
  const g = globalThis as Record<string, unknown>;
  g.__canalRecallTreeShape = shape;
  const ty = treeTypology({ ...t, position: [0, 0] });
  g.__canalRecallTreeShape = undefined;
  if (!ty) return null;
  const s = gameSilhouette(ty), crown = Math.max(0.5, s.top - s.base);
  return { archetype: ty.archetype, height: ty.height, top: s.top, base: s.base, width: s.width, widthRatio: +(s.width / s.top).toFixed(3), baseFraction: +(s.base / s.top).toFixed(3), widestFraction: +((s.widestAt - s.base) / crown).toFixed(3), outline: outlineOf(s.width, crown, (s.widestAt - s.base) / crown), profile: s.profile };
}
const summary = species.map(s => {
  const r = records.filter(x => x.species === s), clean = r.filter(x => !x.widthCapped);
  const use = clean.length >= 2 ? clean : r;
  const sample = r.map(x => trees.find(t => t.id === x.id)!).filter(Boolean);
  const game = (shape: boolean) => { const v = sample.map(t => gameFor(t, shape)).filter(Boolean) as NonNullable<ReturnType<typeof gameFor>>[]; return v.length ? { archetype: v[0].archetype, widthRatio: median(v.map(x => x.widthRatio)), baseFraction: median(v.map(x => x.baseFraction)), base: median(v.map(x => x.base)), widestFraction: median(v.map(x => x.widestFraction)), outline: v[0].outline } : null; };
  const outlines = new Map<string, number>(); for (const x of use) outlines.set(x.outline, (outlines.get(x.outline) ?? 0) + 1);
  const photo = { n: r.length, uncapped: clean.length, widthRatio: median(use.map(x => x.widthRatio)), base: median(r.filter(x => !x.baseCensored).map(x => x.base)), baseCensored: r.filter(x => x.baseCensored).length, baseFraction: median(r.map(x => x.baseFraction)), widestFraction: median(use.map(x => x.widestFraction)), fill: median(r.map(x => x.fill)), outline: [...outlines].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null };
  const before = game(false), after = game(true);
  const within = (g: { widthRatio: number | null } | null) => g && photo.widthRatio && g.widthRatio ? +(g.widthRatio / photo.widthRatio - 1).toFixed(3) : null;
  return { species: s, priorityCount: counts.get(s) ?? 0, tallRowTrees: rowSpecies.get(s) ?? 0, photo, before, after, widthRatioErrorBefore: within(before), widthRatioErrorAfter: within(after) };
});
const ok = (k: 'widthRatioErrorBefore' | 'widthRatioErrorAfter') => summary.filter(x => x[k] !== null && Math.abs(x[k]!) <= 0.2).length;
const report = {
  generatedAt: new Date().toISOString(), method: HELP.split('\n').slice(2).join('\n'), cameraHeight: CAMERA_HEIGHT,
  sources: { trees: 'Gemeente Amsterdam municipal tree inventory (public/data/extracts/amsterdam/municipal-trees)', panoramas: 'Gemeente Amsterdam panoramas, CC BY 4.0 (https://api.data.amsterdam.nl/panorama/)' },
  totals: { trees: trees.length, ridePriorityTrees: priority.length, species: species.length, measured: records.length, rejects, measuredSpecies: summary.filter(x => x.photo.n >= 3).length,
    withinTwentyPercentBefore: ok('widthRatioErrorBefore'), withinTwentyPercentAfter: ok('widthRatioErrorAfter') },
  tallRows: rows.slice(0, 60), tallRowCount: rows.length, summary, records,
};
fs.writeFileSync(path.join(OUT, 'survey.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report.totals));
