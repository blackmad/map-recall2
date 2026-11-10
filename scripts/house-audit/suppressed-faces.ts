/**
 * House audit (lane A1, issue #341): which suppressed pands leave a street-facing BAG wall undrawn?
 *
 * A pand listed under a chunk-* or ordinary-* model in public/canal-drive/models/covers.json is hidden from the generic
 * streamed facade, so whatever that installed model does not model is a blank wall in the ride. This script walks every
 * such pand, takes its footprint walls (BAG/3DBAG footprint from the z14 building tiles), keeps the walls that face a named
 * street, and asks whether the placed model has an outward-facing triangle at the wall's midpoint. Read-only: it writes
 * artifacts/house-audit/ and touches no game data. The method and the numbers are written up in docs/house-line.md §2.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { loadMaterialSoup } from '../landmarks/material-soup.ts';
import { chunkMetres } from '../../src/canalRecall/world/shellMesh.ts';

export const HELP = `node --import tsx scripts/house-audit/suppressed-faces.ts [flags]   (npm run house:audit once the integrator adds it)

Lists the suppressed pands (models/covers.json, chunk-* and ordinary-* models) with a street-facing BAG wall at least
--min-len metres long on a named street that the placed model does not draw. Read-only.

Method
  Footprints: the z14 building tiles (public/data/extracts/amsterdam/building-tiles/14), the same rings the chunk builder
    reads. Each edge is in metres (scripts/world chunkMetres); its outward normal follows the ring's winding.
  Street-facing: the wall's midpoint, probed 15 m outward, sees a named road (streets-routing.json, not cycleway, footway,
    path, steps, track, bridleway, motorway or trunk) within 15 m, the road lies on the outward side (at least 2 m out)
    and runs within 30 degrees of the wall. The nearest such road names the wall.
  Exposed: no other building edge lies within 0.5 m of the midpoint (party walls are not counted).
  Covered: the placed model (chunks.json or the ordinary catalogue, placed as the runtime places it, the same formula
    as scripts/house-preview/preview.ts placedToEnu) has an outward-facing triangle (winding normal, dot with the wall
    normal above 0.5, near-vertical triangles only) within 1 m, in 3D, of the midpoint at half the BAG height.
    "anyFacing" counts triangles facing either way, as a diagnostic.
  Self-check: pand 0363100012116526 (Nassaukade corner, chunk-face-clercq-236681) must come out with an uncovered
    Nassaukade wall, and pand 0363100012236681 (De Clercqstraat, the model's own face) must come out covered. Otherwise
    the script exits 1 and the numbers are not trusted.

Flags
  --min-len <m>       minimum wall length (default 4)
  --out <dir>         output directory (default artifacts/house-audit)
  --top <n>           walls in the ride-priority top list (default 20)
  --help              this text

Output: <out>/suppressed-faces.json (every suppressed pand, every street-facing wall with its covered flags, the per-buurt
table, the top list, the self-check) and a summary on stdout. Ride priority: buurten in the centre (Centrum-West,
Centrum-Oost) first, then the inner ring (RIDE_PRIORITY_GEBIEDEN in scripts/register-facts/build-monument-facts.ts).
Not covered: landmark-* models (their placement is not the runtime's chunk or ordinary placement; counted, not measured).`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const CANAL = path.join(ROOT, 'public/canal-drive');
const CENTRE = ['Centrum-West', 'Centrum-Oost'];
const INNER = ['Westerpark', 'Oud-West, De Baarsjes', 'Oud-Zuid', 'De Pijp, Rivierenbuurt', 'Oud-Oost'];
const SKIP_HIGHWAY = /^(cycleway|footway|path|steps|track|bridleway|motorway|motorway_link|trunk|trunk_link)$/;
const COS52 = Math.cos(52.37 * Math.PI / 180);

type V2 = [number, number];
type V3 = [number, number, number];
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
const inverseMetres = (e: number, n: number): V2 => [4.9 + e / (111_320 * COS52), 52.37 + n / 110_540];

function arg(name: string, dflt: string): string {
  const i = process.argv.findIndex(a => a === name || a.startsWith(`${name}=`));
  if (i < 0) return dflt;
  return process.argv[i].includes('=') ? process.argv[i].split('=')[1] : process.argv[i + 1];
}

// ----------------------------------------------------------------------------------------------------------------
// Uniform grids (2D, metres)
// ----------------------------------------------------------------------------------------------------------------
class Grid<T> {
  private cells = new Map<string, T[]>();
  constructor(private readonly size: number) {}
  private key(ix: number, iy: number) { return `${ix},${iy}`; }
  insert(x0: number, y0: number, x1: number, y1: number, item: T) {
    const ix0 = Math.floor(Math.min(x0, x1) / this.size), ix1 = Math.floor(Math.max(x0, x1) / this.size);
    const iy0 = Math.floor(Math.min(y0, y1) / this.size), iy1 = Math.floor(Math.max(y0, y1) / this.size);
    for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) {
      const k = this.key(ix, iy);
      let arr = this.cells.get(k);
      if (!arr) this.cells.set(k, arr = []);
      arr.push(item);
    }
  }
  near(x: number, y: number, r: number): T[] {
    const out = new Set<T>();
    const ix0 = Math.floor((x - r) / this.size), ix1 = Math.floor((x + r) / this.size);
    const iy0 = Math.floor((y - r) / this.size), iy1 = Math.floor((y + r) / this.size);
    for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) for (const t of this.cells.get(this.key(ix, iy)) ?? []) out.add(t);
    return [...out];
  }
}

const distPointSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): { d: number; qx: number; qy: number } => {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  const qx = ax + dx * t, qy = ay + dy * t;
  return { d: Math.hypot(px - qx, py - qy), qx, qy };
};

// ----------------------------------------------------------------------------------------------------------------
// Footprints from the z14 building tiles
// ----------------------------------------------------------------------------------------------------------------
type Ring = { id: string; height: number; pts: V2[]; outwardSign: number }; // pts in metres, closing point dropped
type Edge = { owner: string; ax: number; ay: number; bx: number; by: number };

function ringMetres(coords: number[][][] | number[][]): V2[] | null {
  const ring = (coords as number[][]).map(([lng, lat]) => chunkMetres(lng, lat) as V2);
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
  return ring.length >= 3 ? ring : null;
}

function loadFootprints(): { rings: Ring[]; edges: Grid<Edge>; byPand: Map<string, Ring[]>; streetsGrid: Grid<{ name: string; highway: string; ax: number; ay: number; bx: number; by: number }> } {
  const root = path.join(EXTRACT, 'building-tiles/14');
  const rings: Ring[] = [], byPand = new Map<string, Ring[]>();
  const edges = new Grid<Edge>(5);
  for (const x of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, x))) {
    const fc = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, x, f))).toString('utf8'));
    for (const feat of fc.features ?? []) {
      const g = feat.geometry;
      if (!g) continue;
      const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      const id = String(feat.properties?.id ?? '');
      const height = Number(feat.properties?.height) || 0;
      for (const poly of polys) {
        const pts = ringMetres(poly[0]);
        if (!pts) continue;
        let area = 0;
        for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; area += x0 * y1 - x1 * y0; }
        const r: Ring = { id, height, pts, outwardSign: area >= 0 ? 1 : -1 };
        rings.push(r);
        const pand = id.startsWith('NL.IMBAG.Pand.') ? bare(id) : null;
        if (pand) { const list = byPand.get(pand) ?? []; list.push(r); byPand.set(pand, list); }
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
          edges.insert(ax, ay, bx, by, { owner: id, ax, ay, bx, by });
        }
      }
    }
  }
  // Named roads (streets-routing.json: the routing ways with names; the same file the runtime's street fronts read).
  const streetsGrid = new Grid<{ name: string; highway: string; ax: number; ay: number; bx: number; by: number }>(20);
  for (const w of readJson(path.join(EXTRACT, 'streets-routing.json')) as { name: string; highway: string; path: number[][] }[]) {
    if (!w.name || SKIP_HIGHWAY.test(w.highway) || !w.path || w.path.length < 2) continue;
    // path is [lat, lng]
    const pts = w.path.map(([lat, lng]) => chunkMetres(lng, lat) as V2);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      if (Math.hypot(bx - ax, by - ay) < 0.01) continue;
      streetsGrid.insert(ax, ay, bx, by, { name: w.name, highway: w.highway, ax, ay, bx, by });
    }
  }
  return { rings, edges, byPand, streetsGrid };
}

// ----------------------------------------------------------------------------------------------------------------
// Walls: the footprint edges that face a named street
// ----------------------------------------------------------------------------------------------------------------
type Wall = {
  pand: string; ring: number; edge: number; lengthM: number;
  midM: V2; normal: V2; direction: V2; heightM: number;
  exposed: boolean; street: string | null; streetHighway: string | null; streetDistM: number | null;
};

function wallsOf(pand: string, rings: Ring[], edges: Grid<Edge>, streets: ReturnType<typeof loadFootprints>['streetsGrid'], minLen: number): Wall[] {
  const out: Wall[] = [];
  rings.forEach((ring, ri) => {
    const P = ring.pts;
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < minLen) continue;
      const dir: V2 = [(bx - ax) / len, (by - ay) / len];
      // Outward normal: right-hand side of a CCW ring, left-hand of a CW ring.
      const normal: V2 = [dir[1] * ring.outwardSign, -dir[0] * ring.outwardSign];
      const mid: V2 = [(ax + bx) / 2, (ay + by) / 2];
      // Exposed: no other building's edge within 0.5 m of the midpoint.
      const exposed = !edges.near(mid[0], mid[1], 0.5).some(e => e.owner !== ring.id && distPointSeg(mid[0], mid[1], e.ax, e.ay, e.bx, e.by).d <= 0.5);
      // Street: the nearest named road on the outward side, within 15 m, running within 30 degrees of the wall.
      let best: { name: string; highway: string; d: number } | null = null;
      for (const s of streets.near(mid[0], mid[1], 15)) {
        const sdx = s.bx - s.ax, sdy = s.by - s.ay, sl = Math.hypot(sdx, sdy);
        if (sl === 0) continue;
        const cos = Math.abs(sdx * dir[0] + sdy * dir[1]) / sl;
        if (cos < Math.cos(30 * Math.PI / 180)) continue;
        const { d, qx, qy } = distPointSeg(mid[0], mid[1], s.ax, s.ay, s.bx, s.by);
        if (d > 15 || d < 0.5) continue;
        if ((qx - mid[0]) * normal[0] + (qy - mid[1]) * normal[1] < 2) continue;
        if (!best || d < best.d) best = { name: s.name, highway: s.highway, d };
      }
      out.push({ pand, ring: ri, edge: i, lengthM: +len.toFixed(2), midM: mid, normal, direction: dir, heightM: ring.height, exposed, street: best?.name ?? null, streetHighway: best?.highway ?? null, streetDistM: best ? +best.d.toFixed(2) : null });
    }
  });
  return out;
}

// ----------------------------------------------------------------------------------------------------------------
// Installed models, placed as the runtime places them (same formula as scripts/house-preview/preview.ts placedToEnu)
// ----------------------------------------------------------------------------------------------------------------
type Placement = { key: string; glb: string; anchor: V2; northOffsetDegrees: number; mirror: boolean };
function placementsOf(): Map<string, Placement> {
  const data = path.join(CANAL, 'ordinary-buildings-data');
  const glbOf = (url: string) => path.join(CANAL, url.replace(/^\.\//, '').replace(/\?.*$/, ''));
  const out = new Map<string, Placement>();
  for (const e of readJson(path.join(data, 'chunks.json')).chunks as { id: string; modelUrl: string; instance: { anchor: V2; northOffsetDegrees?: number; mirror?: boolean } }[]) {
    out.set(e.id, { key: e.id, glb: glbOf(e.modelUrl), anchor: e.instance.anchor, northOffsetDegrees: e.instance.northOffsetDegrees ?? 0, mirror: !!e.instance.mirror });
  }
  const models = readJson(path.join(data, 'catalogue.json')).models;
  for (const e of (Array.isArray(models) ? models : Object.values(models)) as { id: string; modelUrl: string; anchor: V2; instance?: { anchor?: V2; northOffsetDegrees?: number; mirror?: boolean } }[]) {
    if (out.has(e.id)) continue;
    out.set(e.id, { key: e.id, glb: glbOf(e.modelUrl), anchor: e.instance?.anchor ?? e.anchor, northOffsetDegrees: e.instance?.northOffsetDegrees ?? 0, mirror: !!e.instance?.mirror });
  }
  return out;
}
function placedToEnu(p: Placement): (x: number, y: number, z: number) => V3 {
  const [ex, ny] = chunkMetres(p.anchor[0], p.anchor[1]), th = p.northOffsetDegrees * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
  return (x, y, z) => { const xm = p.mirror ? -x : x; return [ex + xm * c - z * s, ny - xm * s - z * c, y]; };
}

type ModelTris = { cells: Grid<number>; tris: Float64Array; normals: Float64Array; count: number; facing: number };
/** Near-vertical triangles of the placed model, in chunk metres, with their winding normals. */
async function modelTris(p: Placement): Promise<ModelTris> {
  const soup = await loadMaterialSoup(p.glb);
  const f = placedToEnu(p), P = soup.positions, I = soup.indices, nt = I.length / 3;
  const tris = new Float64Array(nt * 9), normals = new Float64Array(nt * 3);
  const cells = new Grid<number>(1);
  let count = 0;
  for (let t = 0; t < nt; t++) {
    const v = [0, 1, 2].map(k => f(P[I[t * 3 + k] * 3], P[I[t * 3 + k] * 3 + 1], P[I[t * 3 + k] * 3 + 2]));
    const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
    const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-9) continue;
    nx /= L; ny /= L; nz /= L;
    if (Math.abs(nz) >= 0.35) continue; // walls only
    const o = count * 9;
    for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) tris[o + k * 3 + c] = v[k][c];
    normals.set([nx, ny, nz], count * 3);
    cells.insert(Math.min(v[0][0], v[1][0], v[2][0]), Math.min(v[0][1], v[1][1], v[2][1]), Math.max(v[0][0], v[1][0], v[2][0]), Math.max(v[0][1], v[1][1], v[2][1]), count);
    count++;
  }
  return { cells, tris: tris.subarray(0, count * 9), normals: normals.subarray(0, count * 3), count, facing: 0 };
}

/** Closest point on triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5), returns the distance. */
function distPointTri(p: V3, a: number[], b: number[], c: number[]): number {
  const sub = (u: V3 | number[], v: number[]): V3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const dot = (u: V3 | number[], v: V3 | number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let q: V3;
  if (d1 <= 0 && d2 <= 0) q = [a[0], a[1], a[2]];
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) q = [b[0], b[1], b[2]];
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
    else if (d6 >= 0 && d5 <= d6) q = [c[0], c[1], c[2]];
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); q = [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
    else {
      const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
      q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
    }
  }
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

type Coverage = {
  outward: boolean; any: boolean; nearestOutwardM: number | null; nearestAnyM: number | null;
  /** The outward wall-plane triangles are a bare slab: every vertex sits on the wall's two ends (no bays, openings or relief). */
  bare: boolean | null; planeVertices: number;
};
/**
 * The brief's test (outward triangle within `tol` of the midpoint at half height) plus the slab test: a model that draws
 * the wall as one flat brick box (the H2b blank wall) passes the first and fails to draw the facade. The plane triangles are
 * the outward near-vertical triangles whose vertices all lie within 0.5 m of the wall's line and overlap its extent; the slab
 * is bare when none of their vertices falls inside the wall's extent away from its two ends (0.1 m).
 */
function coverage(w: Wall, h: number, m: ModelTris, tol = 1): Coverage {
  const p: V3 = [w.midM[0], w.midM[1], h / 2];
  const len = w.lengthM, dir = w.direction, a = w.midM[0] - dir[0] * len / 2, ay = w.midM[1] - dir[1] * len / 2;
  let nearestOut: number | null = null, nearestAny: number | null = null;
  let planeVertices = 0, interior = false;
  for (const t of m.cells.near(w.midM[0], w.midM[1], Math.max(tol, len / 2 + 0.5))) {
    const n = [m.normals[t * 3], m.normals[t * 3 + 1], m.normals[t * 3 + 2]];
    const dn = n[0] * w.normal[0] + n[1] * w.normal[1];
    const o = t * 9;
    const tri = [m.tris.subarray(o, o + 3), m.tris.subarray(o + 3, o + 6), m.tris.subarray(o + 6, o + 9)].map(v => Array.from(v));
    if (dn > 0.5 && tri.every(v => Math.abs((v[0] - a) * w.normal[0] + (v[1] - ay) * w.normal[1]) <= 0.5)) {
      // Wall-plane triangle: along-wall position of each vertex.
      const s = tri.map(v => (v[0] - a) * dir[0] + (v[1] - ay) * dir[1]);
      if (Math.min(...s) < len && Math.max(...s) > 0) {
        planeVertices += 3;
        if (s.some(x => x > 0.1 && x < len - 0.1)) interior = true;
      }
    }
    const d = distPointTri(p, tri[0], tri[1], tri[2]);
    if (d > tol) continue;
    if (Math.abs(dn) > 0.5) nearestAny = nearestAny === null ? d : Math.min(nearestAny, d);
    if (dn > 0.5) nearestOut = nearestOut === null ? d : Math.min(nearestOut, d);
  }
  const outward = nearestOut !== null;
  // Bare needs plane triangles to judge: outward geometry off the wall's plane (a bay, a step) is facade, not a slab.
  return { outward, any: nearestAny !== null, nearestOutwardM: nearestOut === null ? null : +nearestOut.toFixed(3), nearestAnyM: nearestAny === null ? null : +nearestAny.toFixed(3), bare: outward ? planeVertices > 0 && !interior : null, planeVertices };
}

// ----------------------------------------------------------------------------------------------------------------
// Buurten
// ----------------------------------------------------------------------------------------------------------------
type Buurt = { code: string; name: string; gebied: string; tier: number; rings: V2[][] };
const pip = (x: number, y: number, ring: number[][]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c; return c; };
function loadBuurten(): Buurt[] {
  const fc = readJson(path.join(EXTRACT, 'coverage-v1/buurten.json')).features as { properties: Record<string, string>; geometry: { type: string; coordinates: number[][][][] | number[][][] } }[];
  return fc.map(f => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    const gebied = f.properties.gebied ?? '';
    const tier = CENTRE.includes(gebied) ? 0 : INNER.includes(gebied) ? 1 : 2;
    return { code: f.properties.code, name: f.properties.name, gebied, tier, rings: polys.map(p => p[0] as unknown as V2[]) } as unknown as Buurt;
  });
}
const buurtOf = (lng: number, lat: number, bs: Buurt[]) => bs.find(b => (b.rings as unknown as number[][][]).some(r => pip(lng, lat, r))) ?? null;

// ----------------------------------------------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------------------------------------------
async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log(HELP); return; }
  const minLen = Number(arg('--min-len', '4')), topN = Number(arg('--top', '20'));
  const outDir = path.resolve(ROOT, arg('--out', 'artifacts/house-audit'));
  const t0 = Date.now();

  const covers = readJson(path.join(CANAL, 'models/covers.json')).models as Record<string, { p?: string[] }>;
  const placements = placementsOf();
  const suppressed = new Map<string, { key: string; kind: 'chunk' | 'ordinary' }>();
  const landmarkPands = new Set<string>();
  for (const [key, v] of Object.entries(covers)) for (const p of v.p ?? []) {
    if (key.startsWith('chunk-') || key.startsWith('ordinary-')) { if (!suppressed.has(p)) suppressed.set(p, { key, kind: key.startsWith('chunk-') ? 'chunk' : 'ordinary' }); }
    else landmarkPands.add(p);
  }
  console.log(`suppressed pands: ${suppressed.size} (chunk/ordinary); landmark-covered: ${landmarkPands.size} (not measured)`);

  const { rings, edges, byPand, streetsGrid } = loadFootprints();
  console.log(`footprints: ${rings.length} rings, ${byPand.size} pands, ${(Date.now() - t0) / 1000}s`);
  const buurten = loadBuurten();

  const models = new Map<string, ModelTris>();
  const modelOf = async (key: string) => {
    let m = models.get(key);
    if (!m) {
      const p = placements.get(key);
      if (!p) throw new Error(`${key}: no placement in chunks.json or the ordinary catalogue`);
      m = await modelTris(p);
      models.set(key, m);
    }
    return m;
  };

  type Out = { pand: string; model: string; kind: string; buurt: string | null; gebied: string | null; tier: number | null; heightM: number; street: string; lengthM: number; midLngLat: V2; normal: V2; coveredOutward: boolean; coveredAny: boolean; bare: boolean | null; planeVertices: number; drawn: boolean; nearestOutwardM: number | null; nearestAnyM: number | null; streetDistM: number | null; streetHighway: string | null };
  const walls: Out[] = [];
  const perPand: Record<string, { walls: number; uncovered: number; lengthM: number; uncoveredLengthM: number; streets: string[]; buurt: string | null }> = {};
  let noFootprint = 0;

  for (const [pand, s] of suppressed) {
    const pr = byPand.get(pand);
    if (!pr) { noFootprint++; continue; }
    const ws = wallsOf(pand, pr, edges, streetsGrid, minLen).filter(w => w.exposed && w.street);
    const m = await modelOf(s.key);
    const [lng, lat] = inverseMetres(pr[0].pts[0][0], pr[0].pts[0][1]);
    const b = buurtOf(lng, lat, buurten);
    const rec = { walls: 0, uncovered: 0, lengthM: 0, uncoveredLengthM: 0, streets: [] as string[], buurt: b?.name ?? null };
    for (const w of ws) {
      const c = coverage(w, w.heightM || 10, m);
      const ll = inverseMetres(w.midM[0], w.midM[1]);
      rec.walls++; rec.lengthM += w.lengthM;
      if (!rec.streets.includes(w.street!)) rec.streets.push(w.street!);
      const drawn = c.outward && !c.bare;
      if (!drawn) { rec.uncovered++; rec.uncoveredLengthM += w.lengthM; }
      walls.push({ pand, model: s.key, kind: s.kind, buurt: b?.name ?? null, gebied: b?.gebied ?? null, tier: b?.tier ?? null, heightM: w.heightM, street: w.street!, lengthM: w.lengthM, midLngLat: [+ll[0].toFixed(7), +ll[1].toFixed(7)], normal: [+w.normal[0].toFixed(3), +w.normal[1].toFixed(3)], coveredOutward: c.outward, coveredAny: c.any, bare: c.bare, planeVertices: c.planeVertices, drawn, nearestOutwardM: c.nearestOutwardM, nearestAnyM: c.nearestAnyM, streetDistM: w.streetDistM, streetHighway: w.streetHighway });
    }
    perPand[pand] = { ...rec, lengthM: +rec.lengthM.toFixed(2), uncoveredLengthM: +rec.uncoveredLengthM.toFixed(2) };
  }
  console.log(`measured ${walls.length} street-facing walls in ${Object.keys(perPand).length} pands (${noFootprint} without a footprint), ${(Date.now() - t0) / 1000}s`);

  // Self-check: the known positive must be uncovered; the model's own face must be covered.
  const check = (pand: string, street: RegExp, expectDrawn: boolean) => {
    const ws = walls.filter(w => w.pand === pand && street.test(w.street));
    const ok = ws.length > 0 && ws.every(w => w.drawn === expectDrawn);
    return { pand, street: street.source, expectDrawn, walls: ws.map(w => ({ street: w.street, lengthM: w.lengthM, coveredOutward: w.coveredOutward, bare: w.bare, planeVertices: w.planeVertices, drawn: w.drawn, nearestOutwardM: w.nearestOutwardM, nearestAnyM: w.nearestAnyM, midLngLat: w.midLngLat, heightM: w.heightM })), ok };
  };
  // The known positive (H2b): a Nassaukade corner face that is a bare slab, so not drawn. The model's own face: drawn.
  const selfCheck = [check('0363100012116526', /Nassaukade/, false), check('0363100012236681', /Clercq/, true)];
  for (const c of selfCheck) console.log(`self-check ${c.pand} ${c.street} expect ${c.expectDrawn ? 'drawn' : 'blank'}: ${c.ok ? 'PASS' : 'FAIL'} ${JSON.stringify(c.walls)}`);

  // Per buurt, centre and inner ring first.
  const byBuurt = new Map<string, { name: string; gebied: string; tier: number; pands: Set<string>; pandsUncovered: Set<string>; walls: number; uncovered: number; uncoveredLengthM: number }>();
  for (const w of walls) {
    if (!w.buurt) continue;
    const r = byBuurt.get(w.buurt) ?? { name: w.buurt, gebied: w.gebied!, tier: w.tier!, pands: new Set<string>(), pandsUncovered: new Set<string>(), walls: 0, uncovered: 0, uncoveredLengthM: 0 };
    r.pands.add(w.pand); r.walls++;
    if (!w.drawn) { r.uncovered++; r.uncoveredLengthM += w.lengthM; r.pandsUncovered.add(w.pand); }
    byBuurt.set(w.buurt, r);
  }
  const table = [...byBuurt.values()].map(r => ({ buurt: r.name, gebied: r.gebied, tier: r.tier, pands: r.pands.size, pandsWithUncovered: r.pandsUncovered.size, walls: r.walls, uncoveredWalls: r.uncovered, uncoveredLengthM: +r.uncoveredLengthM.toFixed(1) }))
    .sort((a, b) => a.tier - b.tier || b.uncoveredWalls - a.uncoveredWalls);
  const top = walls.filter(w => !w.drawn && w.tier !== null && w.tier <= 1).sort((a, b) => b.lengthM - a.lengthM).slice(0, topN);

  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    method: 'scripts/house-audit/suppressed-faces.ts (see --help)',
    minLenM: minLen,
    suppressedPands: suppressed.size, landmarkCoveredPands: landmarkPands.size, withoutFootprint: noFootprint,
    totals: { pandsMeasured: Object.keys(perPand).length, walls: walls.length, noOutwardGeometry: walls.filter(w => !w.coveredOutward).length, bareSlabs: walls.filter(w => w.coveredOutward && w.bare).length, blankWalls: walls.filter(w => !w.drawn).length, blankLengthM: +walls.filter(w => !w.drawn).reduce((s, w) => s + w.lengthM, 0).toFixed(1) },
    selfCheck,
    perBuurt: table,
    top20RidePriority: top,
    walls,
    perPand,
  };
  fs.writeFileSync(path.join(outDir, 'suppressed-faces.json'), JSON.stringify(report));
  console.log(`\nTotals: ${report.totals.walls} walls: ${report.totals.noOutwardGeometry} with no outward geometry, ${report.totals.bareSlabs} bare slabs, ${report.totals.blankWalls} blank (${report.totals.blankLengthM} m)`);
  console.log('buurt\tgebied\ttier\tpands\tpands w/ blank\twalls\tblank walls\tblank m');
  for (const r of table) console.log(`${r.buurt}\t${r.gebied}\t${r.tier}\t${r.pands}\t${r.pandsWithUncovered}\t${r.walls}\t${r.uncoveredWalls}\t${r.uncoveredLengthM}`);
  console.log(`\nTop ${topN} blank walls by length, ride-priority buurten:`);
  for (const w of top) console.log(`${w.pand}\t${w.street}\t${w.lengthM} m\t${w.buurt}\t${w.model}\t${w.midLngLat.join(',')}`);
  console.log(`\nwrote ${path.relative(ROOT, path.join(outDir, 'suppressed-faces.json'))} in ${(Date.now() - t0) / 1000}s`);
  if (!selfCheck.every(c => c.ok)) { console.error('self-check FAILED: the numbers are not trusted'); process.exitCode = 1; }
}

main().catch(e => { console.error(e); process.exit(1); });
