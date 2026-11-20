/**
 * Ordinary-building backlog (2026-11-20, David: "a backlog of buildings near the center that have a large footprint in
 * the 'ordinary' queue too, where work has a high payoff"). The dominant backlog covers only giants (≥ 2,500 m² or
 * ≥ 35 m); this ranks the mid-to-large ORDINARY buildings near the Dam.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference \
 *   node --max-old-space-size=12288 --import tsx scripts/ordinary-backlog/build.ts \
 *     [--date 20261120] [--rescan] [--evidence 260] [--offline] [--ordekaart <dir>]
 *
 * Scope: BAG pands with a footprint ≥ 300 m² whose centroid lies ≤ 5 km from the Dam (core ≤ 3 km, outer ring 3–5 km),
 * drawn today by an ordinary path (core.ts DrawKind): bare box, plain kit, generic family, or an installed large recipe
 * whose unphotographed walls (`otherWalls: 'blank'`) face a street. Excluded and counted: placed models (bespoke,
 * chunk, house recipe, ordinary GLB, clean large recipe; models/covers.json + catalogue), signature-model and landmark-kit
 * pands, building-type instances, published house specs and house rows (`houseSpec` / `rowFront` on the decorated
 * feature, row-front.json), held installs (held.json) and held factory-queue items.
 *
 * Stages (each cached under artifacts/ordinary-backlog/):
 *   1. scan: every tile within reach through the world pipeline's game chain (scripts/world/pipeline.ts gameChain +
 *      loadTile, the decorators the game bakes), meshBuildingFor for bare, the coarse chunk for the aerial plain share
 *      (as scripts/large-tier/audit.ts);
 *   2. facts: building-facts (year, OSM type, heritage, register name/year), bag-facts (archetype, terraced), ordekaart
 *      year/architect (centroid in object; optional, default ~/Code/map-recall2/.cache/ordekaart-20261119), design-unit
 *      segment membership, exposed street wall (core.ts exposedStreetWalls over the BAG footprints and the routing streets);
 *   3. ride visibility: scripts/building-recipes/ride-visibility.ts with the dominant backlog's settings (2,000 routes,
 *      seed 7, ride-visibility/v1);
 *   4. evidence for the top `--evidence` by raw payoff (and every cluster's exemplars): the street wall
 *      (pand-reference/select.ts pickWall), the panorama list (cached API), rankPanos + rayBlocked as house:crops;
 *   5. BAG units (PDOK BAG verblijfsobject over 400 m cells, cached) for every candidate: address and use; payoff, routes, clusters; writes
 *      docs/reports/ordinary-backlog-<date>.{json,md}.
 * Network: the panorama list API (api.data.amsterdam.nl) and PDOK BAG, both open data, a repo-URL User-Agent, cached.
 */
import '../world/useBrowserMath.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { gameChain, loadTile, type Feature as PipelineFeature } from '../world/pipeline.ts';
import { buildFeatureChunk, meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { footprintAreaM2 } from '../../src/canalRecall/genericFacades.ts';
import { KIT_HIDE_IDS, KIT_PART_IDS } from '../../src/canalRecall/landmarkKits.ts';
import { placedSuppressedOsmIds } from '../../src/canalRecall/landmarks/placedModels.ts';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { resolveOtherWalls } from '../../src/canalRecall/buildingRecipe/otherWalls.ts';
import { parseOrdekaart } from '../../src/canalRecall/designUnits/join.ts';
import { ORDEKAART_LAYERS } from '../../src/canalRecall/designUnits/types.ts';
import { loadFootprints, sampleRoutes, scorer, METHOD as RIDE_METHOD } from '../building-recipes/ride-visibility.ts';
import {
  BANDS, CORE_M, OUTER_M, EVIDENCE_GATE, KIT_CLUSTER_MIN, badness, bandOf, clusterKey, eraOf, evidenceClass, exposedStreetWalls, formOf,
  formatAddress, isWrongPeriod, planAspect, rawPayoff, ringOf, routeOf, useOf,
  type DrawKind, type Evidence, type Route, type XY,
} from './core.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const OUT = path.join(ROOT, 'artifacts/ordinary-backlog');
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const flag = (n: string) => process.argv.includes(`--${n}`);
const DATE = arg('date', new Date().toISOString().slice(0, 10).replace(/-/g, ''));
const EVIDENCE_N = Number(arg('evidence', '260'));
const MIN_AREA = 300, ROUTES = 2000, SEED = 7;
const DAM = { lng: 4.8932, lat: 52.3731 };
const DAM_RD = lngLatToRd([DAM.lng, DAM.lat]);
const UA = 'MapRecall-OrdinaryBacklog/1.0 (+https://github.com/blackmad/map-recall2)';
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const gz = (p: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString('utf8'));
const short = (id: string) => id.replace('NL.IMBAG.Pand.', '');
fs.mkdirSync(OUT, { recursive: true });
const t0 = performance.now();
const log = (s: string) => console.log(`[${((performance.now() - t0) / 1000).toFixed(0)} s] ${s}`);

// ---------------------------------------------------------------------------------------------------------------------
// 1. scan
// ---------------------------------------------------------------------------------------------------------------------
type Scan = {
  id: string; tile: string; areaM2: number; heightM: number; minHeightM: number; distM: number; centroid: [number, number];
  holes: number; aspect: number; name: string | null;
  facade: string | null; facadeStyle: string | null; kitWall: string | null; largeTier: boolean; buildingType: string | null;
  houseSpec: boolean; rowFront: boolean; bare: boolean; plainFromAir: number; constructionYear: number | null;
};
const SCAN = path.join(OUT, 'scan.json');

/** Share of a building's wall area the coarse (aerial) chunk draws in the plain cell (scripts/large-tier/audit.ts). */
function aerialPlainShare(feature: PipelineFeature, plainLayer: number | undefined): number {
  if (plainLayer === undefined) return 1;
  const c = buildFeatureChunk([feature as never], 'photo', 'coarse'), P = c.positions;
  let plain = 0, all = 0;
  for (let t = 0; t < c.indices.length; t += 3) {
    const a = c.indices[t], b = c.indices[t + 1], d = c.indices[t + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[d * 3] - P[a * 3], vy = P[d * 3 + 1] - P[a * 3 + 1], vz = P[d * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, n = Math.hypot(nx, ny, nz);
    if (!(n > 0) || Math.abs(nz) >= 0.3 * n) continue;
    all += n; if (c.layers[a] === plainLayer) plain += n;
  }
  return all ? plain / all : 1;
}
const outerRings = (g: any): number[][][] => g?.type === 'Polygon' ? [g.coordinates[0]] : g?.type === 'MultiPolygon' ? g.coordinates.map((p: number[][][]) => p[0]) : [];
const holeCount = (g: any): number => g?.type === 'Polygon' ? g.coordinates.length - 1 : g?.type === 'MultiPolygon' ? g.coordinates.reduce((s: number, p: unknown[]) => s + p.length - 1, 0) : 0;

async function scan(): Promise<Scan[]> {
  if (fs.existsSync(SCAN) && !flag('rescan')) return readJson(SCAN);
  const index = readJson(path.join(EXTRACT, 'building-tiles/index-z14.json'));
  const tiles = (index.tileList as string[]).map(t => t.replace(/^14\//, '')).filter(t => {
    const [x, y] = t.split('/').map(Number), n = 2 ** 14;
    const lng = (x + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n))) * 180 / Math.PI;
    const p = lngLatToRd([lng, lat]);
    return Math.hypot(p.x - DAM_RD.x, p.y - DAM_RD.y) <= OUTER_M + 1300;
  });
  log(`scan: ${tiles.length} tiles`);
  const chain = gameChain();
  const out = new Map<string, Scan>();
  for (const tile of tiles) {
    for (const row of await loadTile(tile, chain)) {
      const f = row.styled, p = f.properties, id = String(p.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.') || out.has(id)) continue;
      const area = footprintAreaM2(f.geometry);
      if (!(area >= MIN_AREA)) continue;
      const ring = outerRings(f.geometry)[0];
      if (!ring?.length) continue;
      const c: [number, number] = [ring.reduce((s, q) => s + q[0], 0) / ring.length, ring.reduce((s, q) => s + q[1], 0) / ring.length];
      const rd = lngLatToRd(c), dist = Math.hypot(rd.x - DAM_RD.x, rd.y - DAM_RD.y);
      if (dist > OUTER_M) continue;
      const b = meshBuildingFor(f as never, 'photo') as any;
      if (!b) continue;
      const kitPlain = p.kitWall === 'plain' || p.kitWall === 'flat';
      const share = b.bare || kitPlain ? 1 : aerialPlainShare(f, b.plainLayer);
      const rdRing = ring.map(q => { const r = lngLatToRd([q[0], q[1]]); return [r.x, r.y] as XY; });
      out.set(id, {
        id, tile, areaM2: Math.round(area), heightM: Math.round((Number(p.height) || 0) * 10) / 10, minHeightM: Number(p.minHeight) || 0,
        distM: Math.round(dist), centroid: [+c[0].toFixed(6), +c[1].toFixed(6)], holes: holeCount(f.geometry), aspect: planAspect(rdRing),
        name: (p.name as string) ?? null, facade: (p.facade as string) ?? null, facadeStyle: (p.facadeStyle as string) ?? null,
        kitWall: (p.kitWall as string) ?? null, largeTier: !!p.largeTier, buildingType: (p.buildingType as string) ?? null,
        houseSpec: p.houseSpec !== undefined, rowFront: p.rowFront !== undefined, bare: !!b.bare, plainFromAir: +share.toFixed(2),
        constructionYear: Number(p.constructionYear) || null,
      });
    }
  }
  const list = [...out.values()];
  fs.writeFileSync(SCAN, JSON.stringify(list));
  log(`scan: ${list.length} BAG pands ≥ ${MIN_AREA} m² within ${OUTER_M} m`);
  return list;
}

// ---------------------------------------------------------------------------------------------------------------------
// exclusions and today's drawing path
// ---------------------------------------------------------------------------------------------------------------------
type Exclusion = 'bespoke-or-model' | 'clean-large-recipe' | 'landmark-kit' | 'building-type' | 'house-spec' | 'house-row' | 'held';
function exclusionSets() {
  const covers = readJson(path.join(ROOT, 'public/canal-drive/models/covers.json')) as { models: Record<string, { p: string[] }> };
  const catalogue = new Map<string, any>((readJson(path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/catalogue.json')).models as any[]).map(m => [m.id, m]));
  const modelOf = new Map<string, string>();
  for (const [model, entry] of Object.entries(covers.models)) for (const p of entry.p ?? []) modelOf.set(short(p), model);
  const held = new Map<string, string>();
  for (const [id, h] of Object.entries<any>(readJson(path.join(ROOT, 'public/canal-drive/ordinary-buildings-data/held.json')).held ?? {})) held.set(id.replace(/^ordinary-/, ''), `held install: ${h.reason}`);
  for (const it of readJson(path.join(ROOT, 'public/canal-drive/landmark-factory-queue.json')).items as any[]) {
    if (it.status === 'held' && it.pand) held.set(short(String(it.pand)), `factory queue held: ${(it.triage?.reasons ?? []).join('; ') || it.name}`);
  }
  const types = new Set<string>((readJson(path.join(ROOT, 'public/canal-drive/building-types/instances.json')) as any[]).map(i => short(String(i.pand))));
  const kit = new Set<string>([...KIT_PART_IDS, ...KIT_HIDE_IDS].map(String).map(short));
  const signature = new Set<string>(placedSuppressedOsmIds().map(String).map(short));
  const rows = new Set<string>(((readJson(path.join(ROOT, 'public/data/front-records/row-front.json')).records ?? []) as any[]).map(r => short(String(r.pandId))));
  return { modelOf, catalogue, held, types, kit, signature, rows };
}

/** An installed large recipe's photographed wall groups and its unlisted-wall rule. */
function largeRecipeState(entry: any): { unphotographed: boolean; groups: number; recipe: string } | null {
  if (entry?.source !== 'building-recipes-large' || !entry.recipe?.id) return null;
  const file = path.join(ROOT, 'scripts/building-recipes/houses', entry.recipe.id, 'intent.json');
  if (!fs.existsSync(file)) return { unphotographed: true, groups: entry.recipe.wallGroups?.length ?? 0, recipe: entry.recipe.id };
  const intent = readJson(file);
  return { unphotographed: resolveOtherWalls(intent).why === 'unphotographed', groups: (intent.walls ?? []).length, recipe: entry.recipe.id };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. facts
// ---------------------------------------------------------------------------------------------------------------------
const tileCache = new Map<string, any>();
function factsTile(kind: 'building-facts' | 'bag-facts', tile: string) {
  const key = `${kind}/${tile}`;
  if (!tileCache.has(key)) {
    const file = path.join(EXTRACT, kind, '14', `${tile}.json.gz`);
    tileCache.set(key, fs.existsSync(file) ? gz(file) : null);
  }
  return tileCache.get(key);
}
const OSM_TYPES = ['warehouse', 'church', 'chapel', 'cathedral', 'mosque', 'synagogue', 'temple', 'school', 'university', 'hospital', 'train_station', 'industrial', 'office', 'retail', 'commercial', 'hotel', 'windmill', 'houseboat', 'civic', 'government', 'public', 'kindergarten', 'college', 'museum', 'theatre'];
function factsOf(s: Scan) {
  const bf = factsTile('building-facts', s.tile)?.buildings?.[`P${short(s.id)}`] as [number, number, number, any?] | undefined;
  const mid = factsTile('bag-facts', s.tile);
  const bag = mid?.pands?.[short(s.id)] as number[] | undefined;
  const monument = bf?.[3];
  const registerYear = monument?.y ? Number(String(monument.y).match(/\d{4}/)?.[0]) || null : null;
  return {
    bagYear: bf?.[0] && bf[0] > 1000 ? bf[0] : s.constructionYear,
    osmType: bf && bf[1] >= 0 ? OSM_TYPES[bf[1]] : s.buildingType ?? undefined,
    heritage: bf?.[2] ?? 0,
    registerName: (monument?.n as string) ?? null, architect: (monument?.a as string) ?? null, registerYear,
    archetype: bag ? mid.archetypes[bag[0]] as string : undefined, terraced: bag ? bag[6] === 1 : false, storeys: bag?.[1] ?? null,
  };
}

function loadOrdekaart() {
  const dir = arg('ordekaart', path.join(os.homedir(), 'Code/map-recall2/.cache/ordekaart-20261119'));
  if (!fs.existsSync(dir)) { log(`ordekaart: ${dir} missing, skipped`); return null; }
  const objects = ORDEKAART_LAYERS.flatMap(layer => {
    const file = path.join(dir, `ORDE_${layer.toUpperCase()}_GEBOUWEN.geojson`);
    return fs.existsSync(file) ? parseOrdekaart(layer, readJson(file)) : [];
  });
  const C = 0.002, grid = new Map<string, number[]>();
  objects.forEach((o, i) => {
    const pts = (o.polygons as unknown as number[][][][]).flat(2);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    for (let gx = Math.floor(Math.min(...xs) / C); gx <= Math.floor(Math.max(...xs) / C); gx++) for (let gy = Math.floor(Math.min(...ys) / C); gy <= Math.floor(Math.max(...ys) / C); gy++) {
      const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    }
  });
  log(`ordekaart: ${objects.length} objects from ${dir}`);
  return (c: [number, number]) => {
    for (const i of grid.get(`${Math.floor(c[0] / C)},${Math.floor(c[1] / C)}`) ?? []) {
      const o = objects[i];
      if ((o.polygons as unknown as number[][][][]).some(poly => inRing(c, poly[0]) && !poly.slice(1).some(h => inRing(c, h)))) return o;
    }
    return null;
  };
}
function inRing(p: number[], ring: number[][]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function roadGrid() {
  const C = 100, grid = new Map<string, Array<[XY, XY]>>();
  for (const s of readJson(path.join(EXTRACT, 'streets-routing.json')) as Array<{ highway: string; path?: [number, number][] }>) {
    if (!s.path || /motorway/.test(s.highway)) continue;
    const pts = s.path.map(([lat, lng]) => { const r = lngLatToRd([lng, lat]); return [r.x, r.y] as XY; });
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      for (let gx = Math.floor(Math.min(a[0], b[0]) / C); gx <= Math.floor(Math.max(a[0], b[0]) / C); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / C); gy <= Math.floor(Math.max(a[1], b[1]) / C); gy++) {
        const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push([a, b]);
      }
    }
  }
  return (box: [number, number, number, number]) => {
    const out = new Set<[XY, XY]>();
    for (let gx = Math.floor(box[0] / C); gx <= Math.floor(box[2] / C); gx++) for (let gy = Math.floor(box[1] / C); gy <= Math.floor(box[3] / C); gy++) for (const s of grid.get(`${gx},${gy}`) ?? []) out.add(s);
    return [...out];
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. evidence (house:crops' pre-download checks) and 5. addresses
// ---------------------------------------------------------------------------------------------------------------------
type EvidenceRow = { class: Evidence; obliquityDeg?: number; distM?: number; panoId?: string; year?: number; candidates?: number; wallM?: number; bearingDeg?: number; note?: string };
const EVIDENCE_CACHE = path.join(OUT, 'evidence-v2.json');
async function evidenceFor(ids: string[], heights: Map<string, number>): Promise<Map<string, EvidenceRow>> {
  process.env.PAND_REFERENCE_CACHE ??= path.join(os.homedir(), 'Code/map-recall2/.cache/pand-reference');
  const core = await import('../pand-reference/core.ts');
  const select = await import('../pand-reference/select.ts');
  const { rayBlocked } = await import('../house-crops/flags.ts');
  core.http.userAgent = UA; core.http.minGapMs = 400;
  if (flag('offline')) core.http.offline = true;
  const cache: Record<string, EvidenceRow> = fs.existsSync(EVIDENCE_CACHE) ? readJson(EVIDENCE_CACHE) : {};
  let done = 0;
  for (const id of ids) {
    if (cache[id]) continue;
    try {
      const found = await core.findPands([id]);
      const fp = found.get(core.normId(id));
      if (!fp) { cache[id] = { class: 'none', note: 'pand not in building tiles' }; continue; }
      const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
      const others = await core.neighbourhood(centre);
      const picked = await select.pickWall(fp, others);
      // pickWall buckets road distance in 6 m steps before length, which on a large building can pick a 4 m return wall;
      // the backlog judges the longest road-facing wall (facing > 0.5, road ≤ 45 m), else pickWall's choice.
      const facing = [picked.wall, ...(picked.others ?? [])].filter((w): w is NonNullable<typeof w> => !!w && w.facing > 0.5 && w.roadDistM < 45);
      const wall = facing.sort((p, q) => q.len - p.len)[0] ?? picked.wall;
      const note = wall === picked.wall ? picked.note : 'longest road-facing wall';
      if (!wall) { cache[id] = { class: 'none', note: picked.note }; continue; }
      const ranked = select.rankPanos(wall, await select.listPanos(wall.mid));
      const rings = others.filter(o => o.id !== fp.id && Math.hypot(o.ring[0].x - wall.mid.x, o.ring[0].y - wall.mid.y) < 120).map(o => o.ring);
      const camRd = (rec: any) => core.lngLatToRd([rec.geometry.coordinates[0], rec.geometry.coordinates[1]]);
      const clear = ranked.find(p => !rayBlocked(camRd(p.record), wall.mid, [wall.nx, wall.ny], rings));
      const pick = clear ?? ranked[0] ?? null;
      const cls = evidenceClass(pick ? { obliquityDeg: pick.obliquityDeg, blocked: !clear } : null);
      cache[id] = { class: cls, obliquityDeg: pick ? Math.round(pick.obliquityDeg) : undefined, distM: pick ? Math.round(pick.distM) : undefined, panoId: pick?.panoId, year: pick?.missionYear,
        candidates: ranked.length, wallM: Math.round(wall.len), bearingDeg: Math.round((Math.atan2(wall.nx, wall.ny) * 180 / Math.PI + 360) % 360), note };
      void heights;
    } catch (e) { cache[id] = { class: 'unchecked', note: String((e as Error).message).slice(0, 120) }; }
    if (++done % 20 === 0) { fs.writeFileSync(EVIDENCE_CACHE, JSON.stringify(cache)); log(`evidence ${done} new (requests ${core.http.requests})`); }
  }
  fs.writeFileSync(EVIDENCE_CACHE, JSON.stringify(cache));
  return new Map(ids.map(id => [id, cache[id]]));
}

const VBO_DIR = path.join(ROOT, '.cache/ordinary-backlog/vbo-cells');
const CELL_M = 400;
type Vbo = { street: string; nr: number; use: string; m2: number; at: [number, number] };
/**
 * BAG verblijfsobjecten (PDOK BAG OGC API v2, CC0) over every 400 m RD cell that holds a candidate, paged, cached per
 * cell; each unit joins the candidate footprint its point lies in. Gives the address and the use (gebruiksdoel) of
 * every candidate.
 */
async function unitsByPand(ids: string[], footprints: ReturnType<typeof loadFootprints>): Promise<Map<string, Vbo[]>> {
  fs.mkdirSync(VBO_DIR, { recursive: true });
  const cells = new Set<string>();
  const C = 100, grid = new Map<string, string[]>();
  for (const id of ids) {
    const b = footprints.pands.get(id)?.box; if (!b) continue;
    for (let gx = Math.floor(b[0] / CELL_M); gx <= Math.floor(b[2] / CELL_M); gx++) for (let gy = Math.floor(b[1] / CELL_M); gy <= Math.floor(b[3] / CELL_M); gy++) cells.add(`${gx},${gy}`);
    for (let gx = Math.floor(b[0] / C); gx <= Math.floor(b[2] / C); gx++) for (let gy = Math.floor(b[1] / C); gy <= Math.floor(b[3] / C); gy++) { const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(id); }
  }
  log(`BAG units: ${cells.size} cells of ${CELL_M} m`);
  const out = new Map<string, Vbo[]>();
  let fetched = 0;
  // fetch missing cells four at a time (paged inside a cell), then join
  const missing = flag('offline') ? [] : [...cells].filter(c => !fs.existsSync(path.join(VBO_DIR, `${c.replace(',', '_')}.json`)));
  const fetchCell = async (cell: string) => {
    const file = path.join(VBO_DIR, `${cell.replace(',', '_')}.json`);
    {
      const [gx, gy] = cell.split(',').map(Number);
      const lo = rdToLngLat({ x: gx * CELL_M, y: gy * CELL_M }), hi = rdToLngLat({ x: (gx + 1) * CELL_M, y: (gy + 1) * CELL_M });
      let url: string | null = `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?f=json&limit=1000&bbox=${lo[0].toFixed(6)},${lo[1].toFixed(6)},${hi[0].toFixed(6)},${hi[1].toFixed(6)}`;
      const vbos: Vbo[] = [];
      for (let page = 0; url && page < 40; page++) {
        let res: Response | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) }).catch(() => null);
          if (res?.ok) break;
          await new Promise(r => setTimeout(r, 1500 * 2 ** attempt));
        }
        if (!res?.ok) throw Error(`PDOK ${url}: ${res?.status}`);
        const j = await res.json() as { features: Array<{ properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }>; links: Array<{ rel: string; href: string }> };
        for (const f of j.features) {
          if (/ingetrokken|niet gerealiseerd|ten onrechte/i.test(String(f.properties.status))) continue;
          vbos.push({ street: String(f.properties.openbare_ruimte_naam ?? ''), nr: Number(f.properties.huisnummer), use: String(f.properties.gebruiksdoel ?? ''), m2: Number(f.properties.oppervlakte) || 0, at: [+f.geometry.coordinates[0].toFixed(7), +f.geometry.coordinates[1].toFixed(7)] });
        }
        url = j.links?.find(l => l.rel === 'next')?.href ?? null;
        fetched++;
        await new Promise(r => setTimeout(r, 100));
      }
      fs.writeFileSync(file, JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), vbos }));
    }
  };
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < missing.length) { await fetchCell(missing[next++]); if (++done % 25 === 0) log(`BAG units: ${done}/${missing.length} cells, ${fetched} pages`); }
  }));
  for (const cell of cells) {
    const file = path.join(VBO_DIR, `${cell.replace(',', '_')}.json`);
    if (!fs.existsSync(file)) continue;
    for (const v of readJson(file).vbos as Vbo[]) {
      const r = lngLatToRd(v.at), k = `${Math.floor(r.x / C)},${Math.floor(r.y / C)}`;
      for (const id of grid.get(k) ?? []) {
        const me = footprints.pands.get(id)!;
        if (me.polys.some(poly => pointInPoly([r.x, r.y], poly[0]) && !poly.slice(1).some(h => pointInPoly([r.x, r.y], h)))) { (out.get(id) ?? out.set(id, []).get(id)!).push(v); break; }
      }
    }
  }
  // a unit on a cell border is read twice: keep one per street/number/use/point
  for (const [id, list] of out) out.set(id, [...new Map(list.map(v => [`${v.street}|${v.nr}|${v.at}`, v])).values()]);
  log(`BAG units: ${fetched} pages fetched, ${out.size} of ${ids.length} candidates have units`);
  return out;
}
function pointInPoly(p: number[], ring: number[][]) { return inRing(p, ring); }

// ---------------------------------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------------------------------
const scanned = await scan();
log(`scan: ${scanned.length} pands`);
const ex = exclusionSets();
const excludedCounts: Record<string, Record<string, number>> = {};
const bumpEx = (why: Exclusion, ring: string) => { (excludedCounts[why] ??= {})[ring] = ((excludedCounts[why] ??= {})[ring] ?? 0) + 1; };
type Cand = Scan & { kind: DrawKind; largeRecipe?: { recipe: string; groups: number }; heldReason?: string };
const cands: Cand[] = [];
const heldSeen: Array<{ id: string; reason: string }> = [];
for (const s of scanned) {
  const pid = short(s.id), ring = ringOf(s.distM)!;
  const model = ex.modelOf.get(pid);
  if (ex.held.has(pid)) { bumpEx('held', ring); heldSeen.push({ id: pid, reason: ex.held.get(pid)! }); continue; }
  let largeRecipe: Cand['largeRecipe'];
  if (model) {
    const large = largeRecipeState(ex.catalogue.get(model));
    if (!large) { bumpEx('bespoke-or-model', ring); continue; }
    if (!large.unphotographed) { bumpEx('clean-large-recipe', ring); continue; }
    largeRecipe = { recipe: large.recipe, groups: large.groups };
  }
  if (!largeRecipe && (ex.signature.has(pid) || ex.signature.has(s.id))) { bumpEx('bespoke-or-model', ring); continue; }
  if (!largeRecipe && (ex.kit.has(pid) || ex.kit.has(s.id))) { bumpEx('landmark-kit', ring); continue; }
  if (ex.types.has(pid)) { bumpEx('building-type', ring); continue; }
  if (s.houseSpec) { bumpEx('house-spec', ring); continue; }
  if (s.rowFront || ex.rows.has(pid)) { bumpEx('house-row', ring); continue; }
  const kind: DrawKind = largeRecipe ? 'large-blank-side' : s.bare ? 'bare' : (s.kitWall === 'plain' || s.kitWall === 'flat') ? 'plain-kit' : 'generic';
  cands.push({ ...s, kind, largeRecipe });
}
log(`candidates: ${cands.length} (excluded ${scanned.length - cands.length})`);

// facts, exposure, design units
const ordekaart = loadOrdekaart();
const segments = readJson(path.join(EXTRACT, 'design-units-v1/segments.json')).segments as Array<{ id: string; members: string[] }>;
const inSegment = new Map<string, string>();
for (const seg of segments) if (seg.members.length >= 2) for (const m of seg.members) inSegment.set(m, seg.id);
log('loading BAG footprints and routes (ride-visibility/v1)…');
const fp = loadFootprints();
const roads = roadGrid();
const routes = sampleRoutes(ROUTES, SEED);
log(`routes ${routes.routes}, ${(routes.metres / 1000).toFixed(0)} km`);
const score = scorer(routes.samples, fp);
const units = await unitsByPand(cands.map(c => c.id), fp);

type Row = ReturnType<typeof enrich>;
function enrich(c: Cand) {
  const f = factsOf(c);
  const ord = ordekaart?.(c.centroid) ?? null;
  const me = fp.pands.get(c.id);
  let exposedM = 0, streetM = 0, streetWalls = 0;
  if (me) {
    const box: [number, number, number, number] = [me.box[0] - 45, me.box[1] - 45, me.box[2] + 45, me.box[3] + 45];
    const neighbours = fp.near([me.box[0] - 2, me.box[1] - 2, me.box[2] + 2, me.box[3] + 2]).filter(o => o !== c.id).flatMap(o => fp.pands.get(o)!.polys.map(p => p[0] as XY[]));
    for (const poly of me.polys) {
      const r = exposedStreetWalls(poly[0] as XY[], neighbours, roads(box));
      exposedM += r.exposedM; streetM += r.streetM; streetWalls += r.walls.filter(w => w.len >= 5).length;
    }
  }
  const designedYear = c.kind === 'generic' ? (f.registerYear ?? ord?.year ?? null) : null;
  const wrongPeriod = c.kind === 'generic' && isWrongPeriod(c.facade ?? c.facadeStyle ?? undefined, designedYear);
  const blankSideShare = c.largeRecipe ? Math.max(0, Math.min(1, 1 - c.largeRecipe.groups / Math.max(streetWalls, 1))) : undefined;
  const bad = badness({ kind: c.kind, plainFromAir: c.plainFromAir, wrongPeriod, blankSideShare });
  const ride = score(c.id) ?? { score: 0, routeMetres: 0, wallM: 0, routes: 0 };
  const year = ord?.year ?? f.registerYear ?? f.bagYear ?? null;
  const myUnits = units.get(c.id) ?? [];
  const use = useOf(myUnits, f.osmType);
  const form = formOf(c.heightM, c.areaM2, c.aspect, c.holes);
  return {
    ...c, ...f, address: formatAddress(myUnits), unitCount: myUnits.length, ordekaart: ord ? { key: ord.key, orde: ord.orde, year: ord.year, architect: ord.architect } : null,
    designUnit: inSegment.get(short(c.id)) ?? null, exposedWallM: exposedM, streetWallM: streetM, wrongPeriod, blankSideShare,
    badness: bad, ride, payoffRaw: rawPayoff(ride.score, c.heightM - c.minHeightM, bad), year, era: eraOf(year), use, form,
  };
}
const rows = cands.map(enrich).filter(r => r.streetWallM > 0 || r.ride.score > 0);
log(`enriched ${rows.length} (dropped ${cands.length - rows.length} with no street wall and no ride view)`);

// clusters
const clusters = new Map<string, Row[]>();
for (const r of rows) { const k = clusterKey(r); (clusters.get(k) ?? clusters.set(k, []).get(k)!).push(r); }
const routeFor = (r: Row): Route => routeOf({ named: !!(r.registerName || r.name), landmark: r.heritage >= 2 && !!r.registerName, areaM2: r.areaM2, heightM: r.heightM, use: r.use,
  inDesignUnit: !!r.designUnit, terraced: r.terraced, year: r.year, clusterSize: clusters.get(clusterKey(r))!.length });

// evidence for the top by raw payoff (core first) and the top exemplars of the biggest clusters
const byRaw = [...rows].sort((a, b) => b.payoffRaw - a.payoffRaw);
const clusterList = [...clusters].map(([key, members]) => ({ key, members: members.sort((a, b) => b.payoffRaw - a.payoffRaw), payoffRaw: members.reduce((s, m) => s + m.payoffRaw, 0) }))
  .filter(c => c.members.length >= KIT_CLUSTER_MIN).sort((a, b) => b.payoffRaw - a.payoffRaw);
const evidenceIds = [...new Set([
  ...byRaw.filter(r => r.distM <= CORE_M).slice(0, EVIDENCE_N).map(r => r.id),
  ...byRaw.filter(r => r.distM > CORE_M).slice(0, Math.round(EVIDENCE_N / 4)).map(r => r.id),
  ...clusterList.slice(0, 15).flatMap(c => c.members.slice(0, 6).map(m => m.id)),
])];
log(`evidence for ${evidenceIds.length} pands…`);
const evidence = await evidenceFor(evidenceIds, new Map(rows.map(r => [r.id, r.heightM])));

const final = rows.map(r => {
  const ev = evidence.get(r.id) ?? { class: 'unchecked' as Evidence };
  return { ...r, evidence: ev, route: routeFor(r), payoff: Math.round(r.payoffRaw * EVIDENCE_GATE[ev.class] * 100) / 100 };
});
const core = final.filter(r => r.distM <= CORE_M).sort((a, b) => b.payoff - a.payoff || b.payoffRaw - a.payoffRaw);
const outer = final.filter(r => r.distM > CORE_M).sort((a, b) => b.payoff - a.payoff || b.payoffRaw - a.payoffRaw);
core.forEach((r, i) => ((r as any).rank = i + 1));
outer.forEach((r, i) => ((r as any).rank = i + 1));

const counts = (list: typeof final) => {
  const out: Record<string, number> = {};
  for (const [, , band] of BANDS) out[band] = list.filter(r => bandOf(r.areaM2) === band).length;
  return out;
};
const by = <K extends string>(list: typeof final, f: (r: (typeof final)[number]) => K) => list.reduce((m, r) => { const k = f(r); m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>);
const pub = (r: (typeof final)[number]) => ({
  rank: (r as any).rank, id: short(r.id), address: r.address, name: r.registerName ?? r.name ?? null, use: r.use, units: r.unitCount,
  year: r.year, bagYear: r.bagYear, ordekaart: r.ordekaart, architect: r.ordekaart?.architect ?? r.architect ?? null, heritage: r.heritage,
  footprintM2: r.areaM2, heightM: r.heightM, distM: r.distM, centroid: r.centroid, exposedWallM: r.exposedWallM, streetWallM: r.streetWallM,
  rideVisibility: { ...r.ride, method: 'ride-visibility/v1 seed 7' },
  today: { kind: r.kind, facade: r.facade, kitWall: r.kitWall, plainFromAir: r.plainFromAir, wrongPeriod: r.wrongPeriod, largeRecipe: r.largeRecipe?.recipe, blankSideShare: r.blankSideShare, badness: r.badness },
  evidence: r.evidence, route: r.route, designUnit: r.designUnit, cluster: clusterKey(r), payoffRaw: r.payoffRaw, payoff: r.payoff,
});
const clusterOut = clusterList.map(c => {
  const checked = c.members.filter(m => evidence.has(m.id) && evidence.get(m.id)!.class !== 'unchecked');
  const usable = checked.filter(m => ['straight', 'oblique'].includes(evidence.get(m.id)!.class));
  const core = c.members.filter(m => m.distM <= CORE_M);
  return { key: c.key, members: c.members.length, core: core.length, payoffRaw: Math.round(c.payoffRaw * 100) / 100, corePayoffRaw: Math.round(core.reduce((s, m) => s + m.payoffRaw, 0) * 100) / 100,
    footprintM2: c.members.reduce((s, m) => s + m.areaM2, 0), streetWallM: c.members.reduce((s, m) => s + m.streetWallM, 0),
    evidence: { checked: checked.length, usable: usable.length },
    routes: by(c.members.map(m => final.find(f => f.id === m.id)!), r => r.route),
    exemplars: c.members.slice(0, 6).map(m => ({ id: short(m.id), address: m.address, year: m.year, footprintM2: m.areaM2, heightM: m.heightM, payoffRaw: m.payoffRaw, evidence: evidence.get(m.id)?.class ?? 'unchecked' })) };
});

const report = {
  version: 1, date: DATE, generatedBy: 'scripts/ordinary-backlog/build.ts',
  scope: { centre: DAM, coreRadiusM: CORE_M, outerRadiusM: OUTER_M, minFootprintM2: MIN_AREA, bands: BANDS.map(b => b[2]) },
  method: {
    rideVisibility: `${RIDE_METHOD}; ${ROUTES} routes, seed ${SEED} (the dominant backlog's run)`,
    badness: 'bare 1.0 · plain kit 0.85 · large recipe 0.15 + 0.45 × street walls without a photographed group · generic 0.35 + 0.3 × aerial plain share (+0.25 when the register/ordekaart year puts it in another period than the drawn style)',
    payoff: 'rideVisibility.score × wall height (≤ 40 m) × badness / 1e6 ("M ride-m³"), × evidence gate (straight 1, oblique 0.6, blocked/none/unchecked 0)',
    evidence: 'house:crops pre-download checks: pickWall street front, Gemeente Amsterdam panoramas 5-35 m, ≤ 55°, ray not through another footprint; straight ≤ 35°',
    route: 'landmark (register name / listed / ≥ 2,500 m² and ≥ 30 m) > design-units (Ring housing in a design-unit segment, or terraced pre-1940 housing) > kit-fix (cluster ≥ 8) > large-recipe',
    cluster: 'era (designed year) · use (BAG units by floor area, else OSM tag) · form (tower/slab/hall/courtyard-block/block) · height band (<12, 12-24, ≥24 m) · drawing path',
  },
  counts: {
    scanned: { core: scanned.filter(s => s.distM <= CORE_M).length, outer: scanned.filter(s => s.distM > CORE_M).length },
    excluded: excludedCounts,
    candidates: { core: counts(core), outer: counts(outer), coreTotal: core.length, outerTotal: outer.length },
    byKind: { core: by(core, r => r.kind), outer: by(outer, r => r.kind) },
    byRoute: { core: by(core, r => r.route), outer: by(outer, r => r.route) },
    evidence: { checked: evidenceIds.length, ...by(final.filter(r => evidence.has(r.id)), r => r.evidence.class) },
    wrongPeriod: { core: core.filter(r => r.wrongPeriod).length, outer: outer.filter(r => r.wrongPeriod).length },
  },
  held: heldSeen,
  core: core.map(pub),
  outer: outer.slice(0, 200).map(pub),
  clusters: clusterOut,
};
/** Top level indented, one row per line in the long arrays (diffable, a third of the indented size). */
function rowsPerLine(o: Record<string, unknown>): string {
  return '{\n' + Object.entries(o).map(([k, v]) => `"${k}": ` + (Array.isArray(v) && v.length > 20 ? `[\n${v.map(x => JSON.stringify(x)).join(',\n')}\n]` : JSON.stringify(v, null, 1))).join(',\n') + '\n}\n';
}
const jsonPath = path.join(ROOT, `docs/reports/ordinary-backlog-${DATE}.json`);
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, rowsPerLine(report));
log(`wrote ${path.relative(ROOT, jsonPath)}: core ${core.length}, outer ${outer.length}, clusters ${clusterOut.length}`);
fs.writeFileSync(path.join(OUT, 'top20.json'), JSON.stringify(core.slice(0, 20).map(pub), null, 1));
