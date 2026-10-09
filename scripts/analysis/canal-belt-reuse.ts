// How much canal-belt geometry could be shared between houses?
//
// Groups buildings by quantised frontage width, depth, height, roof shape and
// register gable type, and counts adjoining near-twins (party-wall neighbours
// within tolerance). An upper bound for mesh reuse in the recipe pipeline: it
// sees massing only, not facades, so photo review must still confirm twins.
//   node --import tsx scripts/analysis/canal-belt-reuse.ts [west south east north]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const ROOT = 'public/data/extracts/amsterdam';
const [west, south, east, north] = process.argv.slice(2).map(Number).length === 4
  ? process.argv.slice(2).map(Number) : [4.876, 52.361, 4.904, 52.380]; // Grachtengordel core
const gables: Record<string, string> = JSON.parse(readFileSync(`${ROOT}/monument-gables.json`, 'utf8')).buildings;

type House = { id: string; ring: [number, number][]; width: number; depth: number; height: number; roof: string; gable: string; cx: number; cy: number };
const M_LAT = 111_320, M_LNG = M_LAT * Math.cos((52.37 * Math.PI) / 180);
const toLocal = ([lng, lat]: number[]): [number, number] => [(lng - west) * M_LNG, (lat - south) * M_LAT];

/** Minimum-area bounding rectangle over hull edge directions: [short side, long side]. */
function rectSides(ring: [number, number][]): [number, number] {
  let best: [number, number] = [Infinity, Infinity];
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[i + 1];
    const len = Math.hypot(bx - ax, by - ay); if (len < 0.5) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of ring) { const u = x * ux + y * uy, v = -x * uy + y * ux; minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
    const a = maxU - minU, b = maxV - minV;
    if (a * b < best[0] * best[1]) best = [Math.min(a, b), Math.max(a, b)];
  }
  return best;
}

const houses: House[] = [];
const tileDir = `${ROOT}/building-tiles/14`;
const seen = new Set<string>();
for (const x of readdirSync(tileDir)) for (const file of readdirSync(`${tileDir}/${x}`)) {
  const path = `${tileDir}/${x}/${file}`;
  const raw = readFileSync(path); const text = (path.endsWith('.gz') ? gunzipSync(raw) : raw).toString();
  for (const f of JSON.parse(text).features) {
    const p = f.properties; if (seen.has(p.id) || f.geometry?.type !== 'Polygon') continue;
    const outer = f.geometry.coordinates[0];
    const lng = outer.reduce((s: number, c: number[]) => s + c[0], 0) / outer.length, lat = outer.reduce((s: number, c: number[]) => s + c[1], 0) / outer.length;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    seen.add(p.id);
    const ring = outer.map(toLocal);
    const [width, depth] = rectSides(ring);
    if (!Number.isFinite(width) || width < 3 || width > 14 || !p.height || p.height < 6) continue; // house-scale only
    const [cx, cy] = toLocal([lng, lat]);
    houses.push({ id: p.id, ring, width, depth, height: p.height, roof: p.roofShape ?? '?', gable: gables[p.id] ?? '?', cx, cy });
  }
}

const q = (v: number, step: number) => Math.round(v / step);
const signature = (h: House) => `${q(h.width, 0.5)}|${q(h.depth, 2)}|${q(h.height, 0.75)}|${h.roof}|${h.gable}`;
const groups = new Map<string, House[]>();
for (const h of houses) { const k = signature(h); groups.set(k, [...(groups.get(k) ?? []), h]); }
const shared = [...groups.values()].filter(g => g.length > 1);

// Adjoining near-twins: centroids within 1.6x frontage width (party-wall neighbours), dims within tolerance.
const near = (a: House, b: House) => Math.abs(a.width - b.width) <= 0.3 && Math.abs(a.height - b.height) <= 0.5 &&
  Math.abs(a.depth - b.depth) <= 2 && a.roof === b.roof && (a.gable === b.gable || a.gable === '?' || b.gable === '?');
const grid = new Map<string, House[]>();
for (const h of houses) { const k = `${Math.floor(h.cx / 20)},${Math.floor(h.cy / 20)}`; grid.set(k, [...(grid.get(k) ?? []), h]); }
let withTwinNeighbour = 0; const rowParent = new Map<string, string>();
const find = (id: string): string => { while (rowParent.get(id) !== id) id = rowParent.get(id)!; return id; };
for (const h of houses) rowParent.set(h.id, h.id);
for (const h of houses) {
  let found = false;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const o of grid.get(`${Math.floor(h.cx / 20) + dx},${Math.floor(h.cy / 20) + dy}`) ?? []) {
    if (o === h || Math.hypot(o.cx - h.cx, o.cy - h.cy) > 1.6 * Math.max(h.width, o.width) || !near(h, o)) continue;
    found = true; rowParent.set(find(h.id), find(o.id));
  }
  if (found) withTwinNeighbour++;
}
const runs = new Map<string, number>(); for (const h of houses) { const r = find(h.id); runs.set(r, (runs.get(r) ?? 0) + 1); }
const runSizes = [...runs.values()];

console.log(JSON.stringify({
  bbox: [west, south, east, north], houses: houses.length,
  withRegisterGable: houses.filter(h => h.gable !== '?').length,
  exactSignatureGroups: groups.size, housesInSharedSignature: shared.reduce((s, g) => s + g.length, 0),
  housesWithAdjoiningNearTwin: withTwinNeighbour,
  twinRuns: { count: runSizes.filter(n => n > 1).length, largest: Math.max(...runSizes), housesInRuns: runSizes.filter(n => n > 1).reduce((a, b) => a + b, 0) },
  uniqueMeshesIfRunsShare: runSizes.length,
}, null, 2));
