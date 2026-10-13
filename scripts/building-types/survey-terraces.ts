/**
 * Terrace survey for the front-on-short-side cluster (the Nieuw-West 8.5 x 5.0 m terraced house): group the cluster's panden into
 * terraces (members whose footprints touch), pick one representative house per terrace, fetch the municipal panorama that looks at ITS
 * FRONT (the short side facing the nearest street, see orientation.ts) and write contact sheets of one tile per terrace.
 *
 *   node --import tsx scripts/building-types/survey-terraces.ts --nw=<survey dir> --pool=pp_small --rank=0 --out=staging/building-types/rh-survey
 *
 * Writes <out>/terraces.json (members, free-side counts, front street, the panorama used per terrace) and sheets under
 * .cache/building-types/rh-sheets/. Crops are cached as .cache/building-types/crops/<pandId>.jpg (montage.ts / sample-colours.ts read them).
 * Flags: --margin=<m> metres of context left/right of the house (default 4), --limit=N, --members=<ids.json> to survey only those terraces' panden.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
import {lngLatToLocal, localToLngLat, minimumRotatedRectangle, swapAxes, bearingDeg, type Anchor, type Pt} from '../../src/canalRecall/buildingTypes/geometry.ts';
import {frontSide, type Street} from '../../src/canalRecall/buildingTypes/orientation.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const nw = arg('nw'), pool = arg('pool', 'pp_small'), rank = Number(arg('rank', '0')), outDir = arg('out', 'staging/building-types/rh-survey');
const MARGIN = Number(arg('margin', '4')), SCRATCH = '.cache/building-types', W = 1000, H = 750, CAM_H = 2.4, TILE_W = 320, TILE_H = 240, COLS = 5, ROWS = 5;
if (!nw) throw new Error('--nw required');
const anchor: Anchor = {lng: 4.806, lat: 52.37};

const clusters = JSON.parse(fs.readFileSync(path.join(nw, 'clusters.json'), 'utf8'));
let members: any[] = clusters[pool][rank].pandIds;
if (arg('members')) { const want = new Set<string>(JSON.parse(fs.readFileSync(arg('members'), 'utf8'))); members = members.filter(m => want.has(m.id)); }
const bag = JSON.parse(fs.readFileSync(path.join(nw, 'raw/bag-panden.json'), 'utf8')) as any[];
const ringOf = (f: any): [number, number][] => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]);
const byId = new Map<string, any>(bag.map(f => [f.properties.identificatie, f]));

// Spatial hash of every in-use BAG footprint's edges (local metres) for touching tests.
type Seg = {a: Pt; b: Pt; id: string};
const CELL = 8, grid = new Map<string, Seg[]>();
const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
const localRing = new Map<string, Pt[]>();
for (const f of bag) {
  if (f.properties.status !== 'Pand in gebruik') continue;
  const ring = ringOf(f).map(([lng, lat]) => lngLatToLocal(anchor, lng, lat));
  localRing.set(f.properties.identificatie, ring);
  for (let i = 0; i + 1 < ring.length; i++) {
    const seg = {a: ring[i], b: ring[i + 1], id: f.properties.identificatie};
    const x0 = Math.min(seg.a[0], seg.b[0]), x1 = Math.max(seg.a[0], seg.b[0]), z0 = Math.min(seg.a[1], seg.b[1]), z1 = Math.max(seg.a[1], seg.b[1]);
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) { const k = `${cx},${cz}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(seg); }
  }
}
const segDist = (p: Pt, a: Pt, b: Pt) => { const dx = b[0] - a[0], dz = b[1] - a[1], den = dx * dx + dz * dz, t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / den)) : 0; return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t)); };
/** Other panden whose footprint lies within 0.45 m of a point sampled on this ring's edges, with the side they touch (sign along the frontage axis = the footprint's short axis, so +-1 are the two party walls). */
function touching(id: string): {other: string; side: 1 | -1}[] {
  const ring = localRing.get(id)!, rect = minimumRotatedRectangle(ring), found = new Map<string, 1 | -1>();
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i], b = ring[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 0.5));
    for (let s = 0; s <= n; s++) {
      const p: Pt = [a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n];
      for (const seg of grid.get(key(p[0], p[1])) ?? []) {
        if (seg.id === id || found.has(seg.id)) continue;
        if (segDist(p, seg.a, seg.b) < 0.45) found.set(seg.id, ((p[0] - rect.center[0]) * rect.short[0] + (p[1] - rect.center[1]) * rect.short[1]) >= 0 ? 1 : -1);
      }
    }
  }
  return [...found].map(([other, side]) => ({other, side}));
}

interface Mem { id: string; bj: number; lat: number; lon: number; neighbours: {other: string; side: number}[]; centre: Pt; rect: ReturnType<typeof swapAxes> }
const mem = new Map<string, Mem>();
for (const m of members) {
  const f = byId.get(m.id);
  if (!f || !localRing.has(m.id)) continue;
  const ring = localRing.get(m.id)!, rect = swapAxes(minimumRotatedRectangle(ring));
  mem.set(m.id, {id: m.id, bj: m.bj, lat: m.lat, lon: m.lon, neighbours: touching(m.id), centre: rect.center, rect});
}
// Terraces: connected components over member-member adjacency.
const parent = new Map<string, string>([...mem.keys()].map(k => [k, k]));
const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
for (const m of mem.values()) for (const n of m.neighbours) if (mem.has(n.other)) parent.set(find(m.id), find(n.other));
const comps = new Map<string, Mem[]>();
for (const m of mem.values()) (comps.get(find(m.id)) ?? comps.set(find(m.id), []).get(find(m.id))!).push(m);

// Streets near the Nieuw-West bbox, local metres.
const routing = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[];
const streets: Street[] = routing.flatMap(s => (s.paths ?? [s.path]).map((p: [number, number][]) => ({name: s.name || '', highway: s.highway as string, path: p.map(([lat, lng]) => lngLatToLocal(anchor, lng, lat))})))
  .filter(s => s.path.some(([x, z]) => Math.abs(x) < 6000 && Math.abs(z) < 4500) && s.path.some(p => { const [lng, lat] = localToLngLat(anchor, p); return lng > 4.77 && lng < 4.845 && lat > 52.345 && lat < 52.392; }));

async function bytes(url: string, file: string): Promise<Buffer> {
  if (fs.existsSync(file)) return fs.readFileSync(file);
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(60000)});
      if (!r.ok) throw new Error(String(r.status));
      const b = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, b);
      return b;
    } catch (e) { if (attempt >= 3) throw new Error(`${url}: ${(e as Error).message}`); await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
  }
}

interface Shot { pandId: string; panoId: string; timestamp: string; heading: number; depth: number; front: string | null; frontAmbiguous: boolean; frontBearing: number; file: string }
async function shoot(m: Mem, topM: number, flip = false): Promise<Shot | null> {
  const rect = m.rect, front = frontSide(rect, streets);
  const n: Pt = flip ? [-front.normal[0], -front.normal[1]] : front.normal, t: Pt = flip ? [-front.tangent[0], -front.tangent[1]] : front.tangent, frontage = rect.length;
  const mid: Pt = [rect.center[0] + n[0] * rect.width / 2, rect.center[1] + n[1] * rect.width / 2];
  const target = flip ? 30 : 16, want: Pt = [mid[0] + n[0] * target, mid[1] + n[1] * target], [lng, lat] = localToLngLat(anchor, want);
  const listing = JSON.parse((await bytes(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&radius=${flip ? 70 : 30}&page_size=250&timestamp_after=2019-01-01`, `${SCRATCH}/pano-list/${m.id}${flip ? '-flip' : ''}.json`)).toString());
  const cands = (listing._embedded?.panoramas ?? []).map((p: any) => {
    const c = lngLatToLocal(anchor, p.geometry.coordinates[0], p.geometry.coordinates[1]), dx = c[0] - mid[0], dz = c[1] - mid[1];
    const depth = dx * n[0] + dz * n[1], lateral = Math.abs(dx * t[0] + dz * t[1]);
    const month = Number(String(p.timestamp).slice(5, 7)), leafOff = month <= 4 || month >= 11;
    return {p, c, depth, lateral, score: lateral + 0.35 * Math.abs(depth - target) - (leafOff ? 6 : 0) - (p.timestamp > '2023' ? 1 : 0)};
  }).filter((x: any) => x.depth > 5 && x.depth < (flip ? 70 : 40)).sort((a: any, b: any) => a.score - b.score);
  const best = cands[0];
  if (!best) return null;
  const dist = Math.hypot(best.c[0] - mid[0], best.c[1] - mid[1]), heading = bearingDeg(mid[0] - best.c[0], mid[1] - best.c[1]);
  const topAng = Math.atan((topM - CAM_H) / dist) * 180 / Math.PI, botAng = -Math.atan(CAM_H / dist) * 180 / Math.PI, pitch = (topAng + botAng) / 2, halfV = (topAng - botAng) / 2 + 3;
  const hNeeded = 2 * Math.atan((frontage / 2 + MARGIN) / dist) * 180 / Math.PI, vAsH = 2 * Math.atan(Math.tan(halfV * Math.PI / 180) * W / H) * 180 / Math.PI;
  const hfov = Math.min(105, Math.max(hNeeded, vAsH)), file = `${SCRATCH}/crops/${m.id}${flip ? '-flip' : ''}.jpg`;
  if (!fs.existsSync(file)) {
    const pano = await bytes(best.p._links.equirectangular_medium.href, `${SCRATCH}/pano/${best.p.pano_id}.jpg`);
    fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, perspectiveCrop(pano, heading, W, H, hfov, pitch));
  }
  return {pandId: m.id, panoId: best.p.pano_id, timestamp: best.p.timestamp, heading: Math.round(heading), depth: Math.round(dist), front: front.street, frontAmbiguous: front.ambiguous, frontBearing: Math.round(bearingDeg(n[0], n[1])), file};
}

const label = (text: string, w: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22"><rect width="${w}" height="22" fill="#111"/><text x="6" y="16" font-family="Helvetica,Arial,sans-serif" font-size="12.5" fill="#fff">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
const list = [...comps.values()].sort((a, b) => a[0].lat - b[0].lat || a[0].lon - b[0].lon).slice(0, Number(arg('limit', '99999')));
// --only=<json array of terrace indices> --flip: re-shoot just those terraces from the OTHER long-axis side (front detection picked the garden side). Tiles keep the original indices.
const selected: number[] = arg('only') ? JSON.parse(fs.readFileSync(arg('only'), 'utf8')) : list.map((_, i) => i), FLIP = process.argv.includes('--flip');
const terraces: any[] = [], tiles: {img: Buffer; text: string}[] = [];
let done = 0;
async function work(pos: number) {
  const idx = selected[pos], ms = list[idx];
  // Representative: the member nearest the centroid of the terrace, so the photo is centred on the row.
  const cx = ms.reduce((s, m) => s + m.centre[0], 0) / ms.length, cz = ms.reduce((s, m) => s + m.centre[1], 0) / ms.length;
  const rep = [...ms].sort((a, b) => Math.hypot(a.centre[0] - cx, a.centre[1] - cz) - Math.hypot(b.centre[0] - cx, b.centre[1] - cz))[0];
  let shot: Shot | null = null;
  try { shot = await shoot(rep, 8.4, FLIP); } catch (e) { console.warn('shot failed', rep.id, (e as Error).message); }
  terraces[pos] = {terrace: idx, flipped: FLIP, size: ms.length, centreLngLat: [rep.lon, rep.lat], rep: rep.id, shot, members: ms.map(m => ({id: m.id, bj: m.bj, freeSides: 2 - new Set(m.neighbours.map(n => n.side)).size, neighbours: m.neighbours.length}))};
  if (shot) tiles[pos] = {img: await sharp(`${shot.file}`).resize(TILE_W, TILE_H).jpeg().toBuffer(), text: `#${idx} x${ms.length} ${rep.id.slice(-7)} ${shot.front ?? '?'} ${shot.timestamp.slice(0, 7)}${shot.frontAmbiguous ? ' AMBIG' : ''}`};
  if (++done % 25 === 0) console.log(`${done}/${selected.length}`);
}
let next = 0;
await Promise.all(Array.from({length: 5}, async () => { while (next < selected.length) await work(next++); }));

fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, FLIP ? 'terraces-flip.json' : 'terraces.json'), JSON.stringify({anchor, pool, rank, terraces}, null, 0) + '\n');
fs.mkdirSync(`${SCRATCH}/rh-sheets`, {recursive: true});
const perSheet = COLS * ROWS;
for (let s = 0; s * perSheet < selected.length; s++) {
  const comp: sharp.OverlayOptions[] = [];
  for (let i = 0; i < perSheet; i++) {
    const t = tiles[s * perSheet + i];
    if (!t) continue;
    comp.push({input: t.img, left: (i % COLS) * TILE_W, top: Math.floor(i / COLS) * (TILE_H + 22)}, {input: label(t.text, TILE_W), left: (i % COLS) * TILE_W, top: Math.floor(i / COLS) * (TILE_H + 22) + TILE_H});
  }
  fs.writeFileSync(`${SCRATCH}/rh-sheets/${arg('tag', 'sheet')}-${String(s).padStart(2, '0')}.jpg`, await sharp({create: {width: COLS * TILE_W, height: ROWS * (TILE_H + 22), channels: 3, background: '#000'}}).composite(comp).jpeg({quality: 80}).toBuffer());
}
console.log(`${list.length} terraces, ${[...mem.values()].length} houses, sizes`, JSON.stringify(Object.fromEntries([...new Set(list.map(l => l.length))].sort((a, b) => a - b).map(n => [n, list.filter(l => l.length === n).length]))));
