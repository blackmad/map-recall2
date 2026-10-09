/**
 * Step 3: per-pand facts merged from the repo's local extracts (no network).
 *  - footprint width (front wall) / depth, height (tile), roofShape (buildings-colored.geojson, centroid match),
 *    year (building-facts tile), register gable type (monument-gables.json), municipal monument facts
 *    (scripts/data/amsterdam-monuments.json: architect, years, original function).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { lngLatToRd, pointInRing, type Footprint, type Rd } from './core.ts';
import type { Wall } from './select.ts';

let gables: Record<string, string> | null = null;
let monuments: Map<string, any[]> | null = null;
let colored: Array<{ ring: Rd[]; props: any; bb: [number, number, number, number] }> | null = null;

async function loadColored() {
  if (colored) return colored;
  colored = [];
  try {
    const json = JSON.parse(await fs.readFile(path.resolve('public/data/extracts/amsterdam/buildings-colored.geojson'), 'utf8'));
    for (const f of json.features) {
      const g = f.geometry, ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((p: number[]) => lngLatToRd([p[0], p[1]])) as Rd[];
      const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
      colored.push({ ring, props: f.properties, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    }
  } catch { /* optional */ }
  return colored;
}

export async function factsFor(fp: Footprint, wall: Wall | null) {
  gables ??= JSON.parse(await fs.readFile(path.resolve('public/data/extracts/amsterdam/monument-gables.json'), 'utf8')).buildings;
  if (!monuments) {
    monuments = new Map();
    const d = JSON.parse(await fs.readFile(path.resolve('scripts/data/amsterdam-monuments.json'), 'utf8'));
    for (const m of d.monuments) for (const p of m[7] ?? []) { (monuments.get(p) ?? monuments.set(p, []).get(p)!).push(m); }
  }
  const bag = fp.id.replace('NL.IMBAG.Pand.', '');
  const centroid = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
  // Depth: footprint extent perpendicular to the front wall; width: front wall length.
  let depthM: number | null = null;
  if (wall) { const proj = fp.ring.map(p => (p.x - wall.mid.x) * -wall.nx + (p.y - wall.mid.y) * -wall.ny); depthM = Math.max(...proj) - Math.min(...proj); }
  const match = (await loadColored()).find(c => centroid.x >= c.bb[0] && centroid.x <= c.bb[2] && centroid.y >= c.bb[1] && centroid.y <= c.bb[3] && pointInRing(centroid, c.ring));
  let year: number | null = null;
  try {
    const { x, y } = await tileCoords(fp);
    const bytes = await fs.readFile(path.resolve(`public/data/extracts/amsterdam/building-facts/14/${x}/${y}.json.gz`));
    const t = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString('utf8'));
    year = t.buildings?.[`P${bag}`]?.[0] ?? null;
  } catch { /* optional */ }
  const reg = monuments.get(bag) ?? [];
  return {
    bagPandId: bag,
    footprint: { frontWidthM: wall ? round(wall.len) : null, depthM: depthM === null ? null : round(depthM), heightM: fp.height || null },
    roofShape: match?.props?.roofShape ?? null,
    roofShapeSource: match ? 'buildings-colored.geojson centroid match (OSM/aerial)' : null,
    buildYear: year && year > 1000 ? year : null,
    registerGableType: gables![fp.id] ?? null,
    monument: reg.map(m => ({ number: m[0], status: m[1], name: m[2], architect: m[3] || null, yearFrom: m[4] || null, yearTo: m[5] || null, originalFunction: m[6] || null, sharedWithPanden: (m[7] as string[]).length })),
  };
}
const round = (v: number) => Math.round(v * 100) / 100;
async function tileCoords(fp: Footprint) {
  const { rdToLngLat } = await import('./core.ts');
  const [lng, lat] = rdToLngLat(fp.ring[0]), n = 2 ** 14, s = Math.sin(lat * Math.PI / 180);
  return { x: Math.floor((lng + 180) / 360 * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) };
}
