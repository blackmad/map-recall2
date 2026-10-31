// Railway infrastructure registered as buildings (src/canalRecall/railInfraBuildings.ts): the viaduct pands under
// track and the platform canopies over it, city-wide, from the published building tiles, rail-v1 (tracks and
// platforms) and BAG use (PDOK BAG OGC API, cached in .cache/bag-pand-uses). Staged with a report; `--publish`
// copies the table into the extract.
//
//   npx tsx scripts/own-ground/build-rail-infra-buildings.ts [--rail-stage=artifacts/rail-look/staged/rail-v1-platforms/cells] [--offline] [--publish]
//
// --rail-stage: rail-v1 cells read from there first (the platforms are staged until the integrator publishes them).
// --offline: no BAG API calls (a pand without a cached use is judged on geometry alone, and listed).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import { fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodePlatforms, decodeRail, isRailCell, RAIL_EXTRACT } from '../../src/canalRecall/ownGround/railTracks.ts';
import { CANOPY, classifyRailInfra, infraShares, RAIL_INFRA_FILE, type InfraVerdict, type PandUse, type RailInfraTable, type Vec2 } from '../../src/canalRecall/railInfraBuildings.ts';

const ROOT = 'public/data/extracts/amsterdam';
const OUT = 'artifacts/own-ground/staging/rail-infra';
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const RAIL_STAGE = arg('rail-stage') ?? 'artifacts/rail-look/staged/rail-v1-platforms/cells';
const OFFLINE = process.argv.includes('--offline');
const PBF = arg('pbf') ?? '.cache/osm-source/Amsterdam.osm.pbf';
const CACHE = '.cache/bag-pand-uses';
const API = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections';

async function get(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'map-recall/1.0 (rail infrastructure pands)' } });
    if (r.ok) return r.json();
    if (attempt >= 4) throw new Error(`${r.status} ${url}`);
    await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
  }
}

/** BAG pand use, in fetch-kit-pand-uses.ts's cache format. */
async function useOf(pand: string): Promise<PandUse | null | undefined> {
  const file = join(CACHE, `${pand}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) return undefined;
  const p = (await get(`${API}/pand/items?identificatie=${pand}&f=json`)).features?.[0];
  if (!p) return null;
  const area: Record<string, number> = {};
  let vbos = 0;
  for (const href of (p.properties['verblijfsobject.href'] ?? []) as string[]) {
    const v = (await get(`${href}?f=json`)).properties;
    if (!/in gebruik|gevormd|verbouwing/i.test(v.status)) continue;
    vbos++;
    for (const use of String(v.gebruiksdoel ?? 'unknown').split(',')) area[use.trim()] = (area[use.trim()] ?? 0) + (Number(v.oppervlakte) || 0) / String(v.gebruiksdoel ?? '').split(',').length;
  }
  const use = { pand, year: p.properties.bouwjaar ?? null, status: p.properties.status, uses: p.properties.gebruiksdoel ?? '', vbos, area };
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify(use));
  return use;
}

type Feature = { properties: Record<string, any>; geometry: { type: string; coordinates: any } };
const polysOf = (g: Feature['geometry']): number[][][][] => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

async function main(): Promise<void> {
  // Rail: every cell's tracks (heavy rail, metro, light rail) and platforms.
  const manifest = JSON.parse(readFileSync(join(ROOT, RAIL_EXTRACT, 'cells.json'), 'utf8')) as { cells: string[] };
  const tracks: Vec2[][] = [], platforms: Vec2[][] = [], seen = new Set<string>();
  for (const key of manifest.cells) {
    const staged = join(RAIL_STAGE, `${key}.json.gz`), file = existsSync(staged) ? staged : join(ROOT, RAIL_EXTRACT, 'cells', `${key}.json.gz`);
    const c = JSON.parse(gunzipSync(readFileSync(file)).toString());
    if (!isRailCell(c)) continue;
    for (const w of decodeRail(c)) { if (w.kind === 'tram') continue; const k = JSON.stringify(w.points); if (!seen.has(k)) { seen.add(k); tracks.push(w.points); } }
    for (const p of decodePlatforms(c)) { const k = JSON.stringify(p.ring); if (!seen.has(k)) { seen.add(k); platforms.push(p.ring); } }
  }
  // A 50 m grid of track and platform points, for the near-rail prefilter.
  const G = 50, near = new Set<string>();
  const mark = (x: number, y: number) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) near.add(`${Math.floor(x / G) + dx}:${Math.floor(y / G) + dy}`); };
  for (const t of tracks) for (let i = 0; i + 1 < t.length; i++) { const [a, b] = [t[i], t[i + 1]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20); for (let k = 0; k <= n; k++) mark(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n); }
  for (const r of platforms) for (const p of r) mark(p[0], p[1]);
  // Buildings: every published tile's features (an id once).
  const dir = join(ROOT, 'building-tiles/14'), byId = new Map<string, Feature>();
  for (const x of readdirSync(dir)) for (const f of readdirSync(join(dir, x))) {
    if (!f.endsWith('.geojson.gz')) continue;
    for (const feat of (JSON.parse(gunzipSync(readFileSync(join(dir, x, f))).toString()).features ?? []) as Feature[]) {
      const id = String(feat.properties?.id ?? '');
      if (id && feat.geometry && !byId.has(id)) byId.set(id, feat);
    }
  }
  const nearRail = (f: Feature) => { const ring = polysOf(f.geometry)[0]?.[0]; if (!ring) return false; const [x, y] = toLocal(ring[0][0], ring[0][1]); return near.has(`${Math.floor(x / G)}:${Math.floor(y / G)}`); };
  const table: RailInfraTable = { version: 1, source: 'building-tiles (BAG/3DBAG/OSM), rail-v1 tracks and platforms (OSM), BAG verblijfsobject use (PDOK BAG OGC API)', ids: {}, canopies: {} };
  const report: { id: string; uses?: Record<string, number>; m2: number; roofed?: number; kind: string | null; why: string; at: Vec2; minHeight: number; height: number; cover: number; platform: number }[] = [];
  let candidates = 0, unknownUse = 0;
  // OSM tags of the OSM-outlined candidates (the tiles keep only `building`): building=roof / building:part, roof:shape,
  // ref:bag. From the archived extract, no network.
  const osmTags = await osmTagsOf([...byId.keys()].filter(id => /^w\d+$/.test(id) && nearRail(byId.get(id)!)));
  const platformUnion = () => platformUnionCache ??= polygonClipping.union(...(platforms.map(r => [[...r, r[0]]]) as any));
  let platformUnionCache: ReturnType<typeof polygonClipping.union> | null = null;
  const pending: { id: string; f: Feature; polys: Vec2[][][]; rings: Vec2[][]; s: ReturnType<typeof infraShares>; c: number[] }[] = [];
  for (const [id, f] of byId) {
    const polys = polysOf(f.geometry).map(poly => poly.map(ring => ring.map(([lng, lat]) => toLocal(lng, lat))));
    if (!polys.length) continue;
    const c = polys[0][0].reduce((s, p) => [s[0] + p[0] / polys[0][0].length, s[1] + p[1] / polys[0][0].length], [0, 0]);
    if (!near.has(`${Math.floor(c[0] / G)}:${Math.floor(c[1] / G)}`)) continue;
    const rings = polys.flat();
    const s = infraShares(rings, tracks, platforms);
    if (s.cover < 0.5) continue;
    pending.push({ id, f, polys, rings, s, c });
  }
  // OSM canopy outlines (building=roof or building:part=roof, flat): a standing candidate under one is the deck under it.
  const roofs = pending.filter(q => { const t = osmTags.get(q.id) ?? {}; return (t.building === 'roof' || t['building:part'] === 'roof') && !['round', 'gambrel', 'barrel'].includes(t['roof:shape'] ?? ''); }).map(q => q.rings[0]);
  for (const { id, f, polys, s, c } of pending) {
    if (!(osmTags.get(id)?.building === 'roof') && roofs.length) s.roofed = infraShares(polys.flat(), [], roofs).platform;
    candidates++;
    const tags = osmTags.get(id) ?? {};
    const osmBuilding = tags.building ?? (typeof f.properties.building === 'string' ? f.properties.building : undefined);
    const cand = { id, minHeight: Number(f.properties.minHeight) || 0, height: Number(f.properties.height) || 0, ...(osmBuilding ? { osmBuilding } : {}), ...(tags['building:part'] ? { osmPart: tags['building:part'] } : {}), ...(tags['roof:shape'] ? { roofShape: tags['roof:shape'] } : {}) };
    // BAG use for a whole pand standing on the ground that the geometry would drop (parts are judged on geometry: the
    // pand's shops are in its hall).
    let use: PandUse | null | undefined = null;
    const pre = classifyRailInfra(cand, s);
    // A standing pand the geometry would reclassify: its BAG use decides (a part: its pand's).
    const pand = typeof f.properties.pand === 'string' ? f.properties.pand : id.startsWith('NL.IMBAG.Pand.') ? id : tags['ref:bag'] ? `NL.IMBAG.Pand.${tags['ref:bag'].padStart(16, '0')}` : null;
    // A bagGap part (part:<pand>:n) is judged on its geometry: its pand's shops are in the parts off the tracks (Amstel's hall).
    if (pre.kind && cand.minHeight < 2.5 && pand && !id.startsWith('part:')) { use = await useOf(pand.slice(14)).catch(() => undefined); if (use === undefined) unknownUse++; }
    const v: InfraVerdict = classifyRailInfra(cand, s, use ?? null, s.samples);
    report.push({ id, ...(use ? { uses: use.area } : {}), m2: s.samples, ...(s.roofed ? { roofed: +s.roofed.toFixed(2) } : {}), kind: v.kind, why: v.why, at: fromLocal(c[0], c[1]).map(q => +q.toFixed(5)) as Vec2, minHeight: cand.minHeight, height: cand.height, cover: +s.cover.toFixed(2), platform: +s.platform.toFixed(2) });
    if (!v.kind) continue;
    table.ids[id] = v.kind;
    if (v.kind === 'canopy') {
      const fp = polys.map(poly => poly.map(r => [...r, r[0]]));
      const pieces = polygonClipping.intersection(fp as any, platformUnion() as any);
      if (v.top) (table.canopyBase ??= {})[id] = +Math.max(0, cand.height - CANOPY.thickM).toFixed(2);
      table.canopies[id] = pieces.filter(p => ringArea(p[0]) >= 8).map(p => ({ ring: p[0].slice(0, -1).map(([x, y]) => fromLocal(x, y).map(q => +q.toFixed(7)) as Vec2) }));
    }
  }
  // Row coherence: a viaduct pand touching (ROW_TOUCH_M) a building kept under the same tracks (an arch in use) is one
  // more arch of that row and stays a building (the Westerpark viaduct's arches: dropping the empty ones left holes).
  const ringsOf = new Map(pending.map(q => [q.id, q.rings]));
  const keptUnder = new Set(report.filter(r => !r.kind && /^in use/.test(r.why)).map(r => r.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const r of report) {
      if (r.kind !== 'viaduct' || /platforms/.test(r.why)) continue;
      const mine = ringsOf.get(r.id)!;
      const touch = [...keptUnder].find(k => ringsTouch(mine, ringsOf.get(k)!, ROW_TOUCH_M));
      if (!touch) continue;
      r.kind = null; r.why = `an arch in a row with ${touch} (in use)`; delete table.ids[r.id]; keptUnder.add(r.id); changed = true;
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, RAIL_INFRA_FILE), JSON.stringify(table));
  const counts = { candidates, viaduct: report.filter(r => r.kind === 'viaduct').length, canopy: report.filter(r => r.kind === 'canopy').length, kept: report.filter(r => !r.kind).length, canopyPieces: Object.values(table.canopies).reduce((n, p) => n + p.length, 0), unknownUse, tracks: tracks.length, platforms: platforms.length };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ counts, report }, null, 1));
  console.log(JSON.stringify(counts));
  if (process.argv.includes('--publish')) { cpSync(join(OUT, RAIL_INFRA_FILE), join(ROOT, RAIL_INFRA_FILE)); console.log('published', join(ROOT, RAIL_INFRA_FILE)); }
}

/** OSM tags per way id (`w123`), read with osmium from the archived pbf. */
async function osmTagsOf(ids: string[]): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  if (!ids.length) return out;
  const opl = execFileSync('osmium', ['getid', PBF, ...ids, '-f', 'opl'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  for (const line of opl.split('\n')) {
    const m = /^(w\d+) .* T(\S*)/.exec(line);
    if (!m) continue;
    const tags: Record<string, string> = {};
    for (const kv of m[2].split(',')) { const i = kv.indexOf('='); if (i > 0) tags[unopl(kv.slice(0, i))] = unopl(kv.slice(i + 1)); }
    out.set(m[1], tags);
  }
  return out;
}
const unopl = (s: string) => s.replace(/%([0-9a-f]+)%/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

const ROW_TOUCH_M = 1.5;
/** Do two outlines come within `d` metres (a vertex of one near an edge of the other)? */
function ringsTouch(a: Vec2[][], b: Vec2[][], d: number): boolean {
  const near = (p: Vec2, r: Vec2[]) => r.some((q, i) => { const n = r[(i + 1) % r.length], dx = n[0] - q[0], dy = n[1] - q[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / l2)) : 0; return Math.hypot(q[0] + dx * t - p[0], q[1] + dy * t - p[1]) <= d; });
  return a.some(ra => b.some(rb => ra.some(p => near(p, rb)) || rb.some(p => near(p, ra))));
}

function ringArea(r: readonly number[][]): number {
  let a = 0;
  for (let i = 0; i + 1 < r.length; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(a / 2);
}

await main();
