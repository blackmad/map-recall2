// Terraces extract (lane terraces-20261114): raw permits (fetch.ts) → placed units → staging → versioned extract.
//
//   npx tsx scripts/terraces/build.ts             # write data/terraces/terraces-v1/ (staging) and print coverage
//   npx tsx scripts/terraces/build.ts --publish   # integrator: also copy staging into public/data/extracts/amsterdam/terraces-v1/
//
// Keeps granted permits (Verleend / Deels verleend) valid today with a terrace polygon; RD → WGS84 with
// src/canalRecall/rdCoordinates.ts; rings simplified at 0.25 m; units laid by src/canalRecall/terraces/placement.ts
// against the own ground's survey: roads-v1 (BGT wegdeel, cells-v3) for carriageway / cycle path / parking, elevation-v1
// water. Report: data/terraces/terraces-v1/report.json (counts by category and style, Centrum vs city, area spread).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { RAW, TABLE } from './fetch.ts';
import {
  TERRACES_EXTRACT, TERRACES_SOURCE, TERRACES_VERSION, fromLocal, permitRejection, polygonArea, rdMultiPolygonToLocal, terraceHours, terraceStyle,
  plausiblePolygons, pointInRing, toLocal, type PermitRow, type Polygon, type TerraceRecord, type TerracesExtract, type Vec2, type UnitRow,
} from '../../src/canalRecall/terraces/extract.ts';
import { TERRACE_COLOURS, TERRACE_MODEL_IDS } from '../../src/canalRecall/terraces/kit.ts';
import { placeTerrace, type SurfaceKind, type SurfaceProbe } from '../../src/canalRecall/terraces/placement.ts';
import { rdToLngLat } from '../../src/canalRecall/rdCoordinates.ts';
import { decodeRoadLine, type RoadCell, type RoadClass } from '../../src/canalRecall/ownGround/roadCells.ts';
import { cellKey, lngLatToLocal, type ElevationIndex } from '../../src/canalRecall/elevation/elevationData.ts';

export const STAGING = `data/terraces/${TERRACES_EXTRACT}`;
export const PUBLISHED = `public/data/extracts/amsterdam/${TERRACES_EXTRACT}`;
const EX = 'public/data/extracts/amsterdam';
export const PLACEMENT_VERSION = 'placement 1 (grid at kit pitch, BGT wegdeel roads-v1 cells-v3 2026-10-16, elevation-v1 water)';

const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());

function rawRows(): { day: string; rows: PermitRow[] } {
  const days = readdirSync(RAW).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!days.length) throw new Error(`no raw cache: run npx tsx scripts/terraces/fetch.ts`);
  const day = days[days.length - 1], dir = `${RAW}/${day}`;
  const pages = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
  return { day, rows: pages.flatMap(f => gz(`${dir}/${f}`)._embedded[TABLE] as PermitRow[]) };
}

// ---------------------------------------------------------------- surface probe

type Ring = Vec2[];
interface Surf { c: RoadClass; rings: Ring[]; box: [number, number, number, number] }
const ROADS: ReadonlySet<RoadClass> = new Set<RoadClass>(['carriage', 'cycle']);

export class SurveyProbe {
  private elev: ElevationIndex = JSON.parse(readFileSync(`${EX}/elevation-v1/index.json`, 'utf8'));
  private roadCells = new Set<string>(JSON.parse(readFileSync(`${EX}/roads-v1/cells.json`, 'utf8')).cells);
  private loaded = new Set<string>();
  private buckets = new Map<string, Surf[]>();
  private water = new Map<string, Ring[][]>();
  readonly B = 25;
  private cellOfLocal(p: Vec2): [number, number] {
    const [lng, lat] = fromLocal(p[0], p[1]), [x, y] = lngLatToLocal(this.elev, lng, lat);
    return [Math.floor(x / this.elev.cellSizeM), Math.floor(y / this.elev.cellSizeM)];
  }
  /** Load the road cells round a point (±1: a polygon is filed under its interior point's cell). */
  ensure(p: Vec2): void {
    const [cx, cy] = this.cellOfLocal(p);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const key = cellKey(cx + dx, cy + dy);
      if (this.loaded.has(key)) continue;
      this.loaded.add(key);
      if (this.roadCells.has(key)) {
        const cell = gz(`${EX}/roads-v1/cells-v3/${key}.json.gz`) as RoadCell;
        for (const s of cell.surfaces) {
          const rings = s.r.map(decodeRoadLine).filter(r => r.length >= 3);
          if (!rings.length) continue;
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (const [x, y] of rings[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
          const surf: Surf = { c: s.c, rings, box: [x0, y0, x1, y1] };
          for (let bx = Math.floor(x0 / this.B); bx <= Math.floor(x1 / this.B); bx++) for (let by = Math.floor(y0 / this.B); by <= Math.floor(y1 / this.B); by++) {
            const k = `${bx}_${by}`; (this.buckets.get(k) ?? this.buckets.set(k, []).get(k)!).push(surf);
          }
        }
      }
      const wf = `${EX}/elevation-v1/cells/${key}.json`;
      if (existsSync(wf)) {
        const w = JSON.parse(readFileSync(wf, 'utf8')), ox = (cx + dx) * this.elev.cellSizeM, oy = (cy + dy) * this.elev.cellSizeM, q = this.elev.quantization.xy;
        this.water.set(key, (w.water as number[][][]).map(poly => poly.map(flat => { const r: Ring = []; for (let i = 0; i + 1 < flat.length; i += 2) r.push([ox + flat[i] * q, oy + flat[i + 1] * q]); return r; })));
      }
    }
  }
  readonly probe: SurfaceProbe = (p: Vec2): SurfaceKind => {
    let kind: SurfaceKind | null = null;
    for (const s of this.buckets.get(`${Math.floor(p[0] / this.B)}_${Math.floor(p[1] / this.B)}`) ?? []) {
      if (p[0] < s.box[0] || p[0] > s.box[2] || p[1] < s.box[1] || p[1] > s.box[3]) continue;
      if (!pointInRing(p, s.rings[0]) || s.rings.slice(1).some(h => pointInRing(p, h))) continue;
      if (ROADS.has(s.c)) return 'road';
      kind = s.c === 'parking' ? (kind ?? 'parking') : 'pavement';
    }
    if (kind) return kind;
    // Water (elevation-v1 storage frame).
    const [lng, lat] = fromLocal(p[0], p[1]), [ex, ey] = lngLatToLocal(this.elev, lng, lat);
    const key = cellKey(Math.floor(ex / this.elev.cellSizeM), Math.floor(ey / this.elev.cellSizeM));
    for (const poly of this.water.get(key) ?? []) if (pointInRing([ex, ey], poly[0]) && !poly.slice(1).some(h => pointInRing([ex, ey], h))) return 'water';
    return 'pavement';
  };
}

// ---------------------------------------------------------------- districts

function districts(): { name: string; rings: Vec2[][] }[] {
  const b = JSON.parse(readFileSync(`${EX}/boundaries.json`, 'utf8')) as any[];
  return b.filter(x => x.adminLevel === 9 && x.kind === 'suburb').map(x => ({ name: x.name, rings: (x.geometry as number[][][][]).map(poly => poly[0].map(([lat, lng]) => [lng, lat] as Vec2)) }));
}

export function build(): { extract: TerracesExtract; report: Record<string, unknown> } {
  const { day, rows } = rawRows();
  const today = new Date().toISOString().slice(0, 10);
  const probe = new SurveyProbe(), dists = districts();
  const rejected: Record<string, number> = {}, reject = (w: string) => { rejected[w] = (rejected[w] ?? 0) + 1; };
  const terraces: TerraceRecord[] = [];
  const byCategory: Record<string, number> = {}, byStyle: Record<string, number> = {}, byDistrict: Record<string, number> = {}, unitsByModel: Record<string, number> = {};
  const areas: number[] = [];
  let strayPolygons = 0, noUnits = 0, fallback = 0, parkingUnits = 0, droppedUnits = 0, units = 0, slivers = 0;
  const modelIndex = new Map(TERRACE_MODEL_IDS.map((m, i) => [m, i]));
  let seen = 0; const limit = Number(process.env.TERRACES_LIMIT ?? Infinity), tStart = Date.now();
  for (const r of rows) {
    if (++seen > limit) break;
    if (seen % 250 === 0) console.error(`${seen} rows, ${terraces.length} terraces, ${((Date.now() - tStart) / 1000).toFixed(1)} s`);
    const why = permitRejection(r, today);
    if (why) { reject(why); continue; }
    const all: Polygon[] = rdMultiPolygonToLocal(r.terrasgeometrie!.coordinates);
    if (!all.length) { reject('terrace polygon under 0.5 m2'); slivers++; continue; }
    const premises = r.locatie?.coordinates ? (() => { const [plng, plat] = rdToLngLat(r.locatie!.coordinates[0], r.locatie!.coordinates[1]); return toLocal(plng, plat); })() : null;
    const { kept: polys, dropped } = plausiblePolygons(all, premises);
    strayPolygons += dropped;
    if (!polys.length) { reject('terrace polygons implausible (far from the premises or over 150 m across)'); continue; }
    const anchor = polys[0][0][0];
    probe.ensure(anchor);
    const style = terraceStyle(r.zaakCategorie, r.zaakSpecificatie, r.zaaknaam);
    const placed = placeTerrace(String(r.id), style, polys, probe.probe, premises);
    const area = polys.reduce((s, p) => s + polygonArea(p), 0);
    const [lng, lat] = fromLocal(anchor[0], anchor[1]);
    const dm = (v: number) => Math.round(v * 10);
    const unitRows: UnitRow[] = placed.units.map(u => {
      const row: UnitRow = [modelIndex.get(u.model)!, dm(u.x - anchor[0]), dm(u.y - anchor[1]), Math.round(((u.yawDeg % 360) + 360) % 360)];
      if (u.colour !== undefined || u.level) row.push(u.colour ?? 0);
      if (u.level) row.push(u.level);
      return row;
    });
    const district = dists.find(d => d.rings.some(ring => pointInRing([lng, lat], ring)))?.name ?? 'outside';
    terraces.push({
      id: String(r.id), name: (r.zaaknaam ?? '').trim(), category: r.zaakCategorie ?? 'Onbekend', spec: r.zaakSpecificatie ?? '', style,
      lng: +lng.toFixed(7), lat: +lat.toFixed(7), areaM2: +area.toFixed(1), hours: terraceHours(r),
      begin: r.begindatum ?? null, end: r.einddatum ?? null,
      poly: polys.map(p => p.map(ring => ring.map(([x, y]) => [dm(x - anchor[0]), dm(y - anchor[1])] as [number, number]))),
      units: unitRows,
    });
    byCategory[r.zaakCategorie ?? 'Onbekend'] = (byCategory[r.zaakCategorie ?? 'Onbekend'] ?? 0) + 1;
    byStyle[style] = (byStyle[style] ?? 0) + 1;
    byDistrict[district] = (byDistrict[district] ?? 0) + 1;
    areas.push(area);
    units += unitRows.length;
    if (!placed.units.some(u => u.model.startsWith('set-'))) noUnits++;
    if (placed.fallback) fallback++;
    for (const u of placed.units) { unitsByModel[u.model] = (unitsByModel[u.model] ?? 0) + 1; if (u.level) parkingUnits++; }
  }
  void droppedUnits;
  const sorted = [...areas].sort((a, b) => a - b), q = (f: number) => +(sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] ?? 0).toFixed(1);
  const hist: Record<string, number> = {};
  for (const a of areas) { const k = a < 5 ? '<5' : a < 10 ? '5-10' : a < 20 ? '10-20' : a < 40 ? '20-40' : a < 80 ? '40-80' : a < 160 ? '80-160' : '>=160'; hist[k] = (hist[k] ?? 0) + 1; }
  const counts = {
    permits: rows.length, terraces: terraces.length, units, unitsByModel, rejected,
    byCategory, byStyle, byDistrict, centrum: byDistrict['Centrum'] ?? 0,
    areaM2: { total: Math.round(areas.reduce((s, a) => s + a, 0)), p10: q(0.1), p50: q(0.5), p90: q(0.9), max: q(1), histogram: hist },
    strayPolygonsDropped: strayPolygons, terracesWithoutTableUnits: noUnits, singleUnitFallback: fallback, unitsOnParking: parkingUnits, temporaryTerraceRows: rows.filter(r => r.statusTijdelijkTerras || r.toestemmingTijdelijkTerras).length,
  };
  const extract: TerracesExtract = {
    version: TERRACES_VERSION, source: TERRACES_SOURCE, fetched: day, placement: PLACEMENT_VERSION,
    models: [...TERRACE_MODEL_IDS], colours: [...TERRACE_COLOURS], counts, terraces,
  };
  return { extract, report: counts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const { extract, report } = build();
  mkdirSync(STAGING, { recursive: true });
  writeFileSync(`${STAGING}/index.json`, JSON.stringify(extract));
  writeFileSync(`${STAGING}/report.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  console.log(`staged ${STAGING}/index.json (${(readFileSync(`${STAGING}/index.json`).length / 1024).toFixed(0)} KB) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (process.argv.includes('--publish')) { mkdirSync(PUBLISHED, { recursive: true }); cpSync(`${STAGING}/index.json`, `${PUBLISHED}/index.json`); console.log(`published ${PUBLISHED}/index.json`); }
}
