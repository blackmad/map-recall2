/**
 * Rectified facade references from the City of Amsterdam's street panoramas. They are
 * drawing references for low-poly fronts (src/canalRecall/landmarkFrontData.ts), not textures.
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx scripts/pano-facades/build-pano-facade.ts \
 *     --name=anne-frank-house --ids=NL.IMBAG.Pand.0363100012169587,... [--wall=N]
 *
 * For a building (its OSM/BAG footprint parts) this picks the best street-facing wall,
 * finds the panoramas that look straight at it, rectifies each onto the wall plane with
 * the repo's own rectifier (AMSTERDAM_WORLD_ALIGNED camera), and fuses them with a
 * per-pixel median, which also removes cars, people, bikes and some tree branches that
 * differ between captures. Output: a JPEG elevation plus a JSON record of where the wall
 * is (lng/lat), its size, and which panoramas were used.
 *
 * Panoramas: https://api.data.amsterdam.nl/panorama/panoramas/ (Gemeente Amsterdam, open
 * data, faces and number plates blurred by the publisher). Verify the licence at
 * https://data.amsterdam.nl/uitleg-gebruik before shipping; the record carries the attribution.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import jpeg from 'jpeg-js';
import { AMSTERDAM_WORLD_ALIGNED, rectifyFacade, type FacadePlane } from '../../src/canalRecall/facade/rectify.ts';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { lensFor } from '../da-costa-block/neighbourhood-core.ts';
import { photoSilhouette } from '../../src/canalRecall/facade/photoSilhouette.ts';

const arg = (name: string, fallback = '') => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const name = arg('name'), ids = new Set(arg('ids').split(',').filter(Boolean));
const radius = Number(arg('radius', '55')), ppm = Number(arg('ppm', '60')), maxPanos = Number(arg('max-panos', '1'));
const after = arg('timestamp-after', '2021-01-01'), outDir = path.resolve(arg('out', 'public/data/landmark-facades'));
const maxObl = Number(arg("max-obl", "50"));
const minStandoff = Number(arg("min-standoff", "4")), maxDist = Number(arg("max-dist", "45"));
const forcedWall = arg('wall');
// --toward=lng,lat: only walls facing that point (a square, the street a landmark fronts on).
const toward = arg('toward') ? arg('toward').split(',').map(Number) as [number, number] : null;
// --near=lng,lat: only the walls within 8 m of a point (a shop's OSM pin), nearest first.
const nearPt = arg('near') ? arg('near').split(',').map(Number) as [number, number] : null;
if (!name || !ids.size) throw new Error('--name and --ids are required');

type Rd = { x: number; y: number };
type Wall = { a: Rd; b: Rd; len: number; nx: number; ny: number; heightM: number; mid: Rd };

async function loadParts() {
  const root = path.resolve('public/data/extracts/amsterdam/building-tiles/14');
  const found = new Map<string, { ring: number[][]; height: number }>();
  for (const x of await fs.readdir(root)) for (const f of await fs.readdir(path.join(root, x))) {
    const bytes = await fs.readFile(path.join(root, x, f));
    const text = (bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString('utf8');
    if (![...ids].some(id => text.includes(id))) continue;
    for (const feature of JSON.parse(text).features) {
      const id = String(feature.properties.id);
      if (!ids.has(id)) continue;
      const g = feature.geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
      found.set(id, { ring, height: Number(feature.properties.height) || 12 });
    }
  }
  return found;
}

function wallsOf(parts: Map<string, { ring: number[][]; height: number }>): Wall[] {
  type Edge = { a: Rd; b: Rd; height: number };
  const edges: Edge[] = [];
  for (const { ring, height } of parts.values()) {
    const pts = ring.map(p => lngLatToRd([p[0], p[1]]));
    let area2 = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    const ordered = area2 > 0 ? pts : [...pts].reverse(); // counter-clockwise: outward normal on the right
    for (let i = 0; i < ordered.length - 1; i++) edges.push({ a: ordered[i], b: ordered[i + 1], height });
  }
  const key = (p: Rd) => `${Math.round(p.x * 5)},${Math.round(p.y * 5)}`;
  const reversed = new Set(edges.map(e => `${key(e.b)}>${key(e.a)}`));
  const walls = edges.filter(e => !reversed.has(`${key(e.a)}>${key(e.b)}`)).map(e => {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, len = Math.hypot(dx, dy);
    return { a: e.a, b: e.b, len, nx: dy / len, ny: -dx / len, heightM: e.height, mid: { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 } };
  }).filter(w => w.len >= 0.5);
  // A front drawn as several parts is several short edges in a line: join runs that share a
  // direction (within 6 degrees) and a line (within 1 m) and touch (within 1.5 m) into one wall.
  const merged: Wall[] = [];
  for (const w of [...walls].sort((p, q) => q.len - p.len)) {
    const host = merged.find(m => m.nx * w.nx + m.ny * w.ny > Math.cos(6 * Math.PI / 180)
      && Math.abs((w.mid.x - m.mid.x) * m.nx + (w.mid.y - m.mid.y) * m.ny) < 1
      && [w.a, w.b].some(p => [m.a, m.b].some(q => Math.hypot(p.x - q.x, p.y - q.y) < 1.5)));
    if (!host) { merged.push({ ...w }); continue; }
    const ux = -host.ny, uy = host.nx, along = (p: Rd) => (p.x - host.mid.x) * ux + (p.y - host.mid.y) * uy;
    const pts = [host.a, host.b, w.a, w.b].sort((p, q) => along(p) - along(q));
    host.a = pts[0]; host.b = pts[3];
    host.len = Math.hypot(host.b.x - host.a.x, host.b.y - host.a.y);
    host.heightM = Math.max(host.heightM, w.heightM);
    host.mid = { x: (host.a.x + host.b.x) / 2, y: (host.a.y + host.b.y) / 2 };
  }
  return merged.filter(w => w.len >= 4);
}

async function listPanos(centre: Rd) {
  const [lng, lat] = rdToLngLat(centre);
  let url: string | null = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&radius=${radius}&srid=4326&page_size=500&timestamp_after=${after}`;
  const all: any[] = [];
  // The API caps a page at 500 and returns them unordered, so follow every page.
  for (let page = 0; url && page < 20; page++) {
    const response = await fetch(url, { headers: { 'User-Agent': 'MapRecall-PanoFacades/1.0' } });
    if (!response.ok) throw new Error(`panorama list ${response.status}`);
    const json: any = await response.json();
    all.push(...(json._embedded?.panoramas ?? []));
    url = json._links?.next?.href ?? null;
  }
  return all;
}

const wallCandidates = (wall: Wall, panos: any[]) => panos.flatMap(pano => {
  const rd = lngLatToRd([pano.geometry.coordinates[0], pano.geometry.coordinates[1]]);
  const vx = rd.x - wall.mid.x, vy = rd.y - wall.mid.y, d = Math.hypot(vx, vy), standoff = vx * wall.nx + vy * wall.ny;
  if (standoff < minStandoff || d > maxDist) return [];
  const obliquity = Math.acos(standoff / d) * 180 / Math.PI;
  if (obliquity > maxObl) return [];
  return [{ pano, rd, d, standoff, obliquity, score: Math.cos(obliquity * Math.PI / 180) / d }];
}).sort((a, b) => b.score - a.score);

async function fetchPano(pano: any) {
  for (const key of ['equirectangular_full', 'equirectangular_medium', 'equirectangular_small']) {
    const response = await fetch(pano._links[key].href, { headers: { 'User-Agent': 'MapRecall-PanoFacades/1.0' } });
    if (!response.ok) continue;
    const decoded = jpeg.decode(Buffer.from(await response.arrayBuffer()), { useTArray: true, maxMemoryUsageInMB: 1024 });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  return null;
}

const parts = await loadParts();
if (!parts.size) throw new Error('no footprint parts found for those ids');
const walls = wallsOf(parts);
const centre = { x: walls.reduce((s, w) => s + w.mid.x, 0) / walls.length, y: walls.reduce((s, w) => s + w.mid.y, 0) / walls.length };
const panos = await listPanos(centre);
console.log(`${parts.size} parts, ${walls.length} exposed walls, ${panos.length} panoramas within ${radius} m`);
const towardRd = toward ? lngLatToRd(toward) : null;
const nearRd = nearPt ? lngLatToRd(nearPt) : null;
const wallDist = (wall: Wall, p: Rd) => { const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y, t = Math.max(0, Math.min(1, ((p.x - wall.a.x) * dx + (p.y - wall.a.y) * dy) / (wall.len * wall.len))); return Math.hypot(p.x - wall.a.x - dx * t, p.y - wall.a.y - dy * t); };
const facing = (wall: Wall) => {
  if (nearRd && wallDist(wall, nearRd) >= 8) return false;
  if (!towardRd) return true;
  return ((towardRd.x - wall.mid.x) * wall.nx + (towardRd.y - wall.mid.y) * wall.ny) / Math.hypot(towardRd.x - wall.mid.x, towardRd.y - wall.mid.y) > 0.6;
};
const ranked = walls.map((wall, index) => ({ wall, index })).filter(({ wall }) => facing(wall)).map(({ wall, index }) => {
  const c = wallCandidates(wall, panos), top = c.slice(0, 3);
  return { wall, index, c, value: top.length ? wall.len * (top.reduce((s, t) => s + t.score, 0) / top.length) * Math.min(1, c.length / 3) : 0 };
}).sort((a, b) => b.value - a.value);
for (const r of ranked.slice(0, 5)) console.log(`  wall ${r.index}: ${r.wall.len.toFixed(1)} m, normal ${(Math.atan2(r.wall.nx, r.wall.ny) * 180 / Math.PI).toFixed(0)}°, ${r.c.length} panos, value ${r.value.toFixed(3)}`);
const chosen = forcedWall ? ranked.find(r => r.index === Number(forcedWall))! : ranked[0];
if (!chosen || !chosen.c.length) throw new Error('no wall has a panorama looking at it');

// Spread the picks: different positions, so occluders differ between captures.
const picks: typeof chosen.c = [];
for (const c of chosen.c) if (picks.length < maxPanos && lensFor(c.pano, undefined) && picks.every(p => Math.hypot(p.rd.x - c.rd.x, p.rd.y - c.rd.y) > 2.5)) picks.push(c);
const wall = chosen.wall;
const poses = picks.map(p => lensFor(p.pano, undefined)!).filter(Boolean);
const baseZ = poses.reduce((s, l) => s + (l.pose.z - 2.44), 0) / poses.length;
const plane: FacadePlane = { start: wall.a, end: wall.b, baseZ, topZ: baseZ + wall.heightM + 1.5 };
console.log(`chosen wall ${chosen.index}: ${wall.len.toFixed(1)} m x ${(plane.topZ - plane.baseZ).toFixed(1)} m, ${picks.length} panoramas`);

const crops: Uint8ClampedArray[] = []; let dims = { width: 0, height: 0 };
for (const pick of picks) {
  const image = await fetchPano(pick.pano);
  if (!image) { console.log(`  ${pick.pano.pano_id} unavailable, skipped`); continue; }
  const lens = lensFor(pick.pano, baseZ)!;
  const out = rectifyFacade(image, { ...lens.pose, headingDeg: 0, pitchDeg: 0, rollDeg: 0 }, plane, { pixelsPerMetre: ppm, camera: AMSTERDAM_WORLD_ALIGNED, maxPixels: 1_800_000 });
  dims = { width: out.width, height: out.height }; crops.push(out.data);
  console.log(`  ${pick.pano.pano_id} ${pick.pano.timestamp?.slice(0, 10)} d=${pick.d.toFixed(0)} m obl=${pick.obliquity.toFixed(0)}° missing=${(out.missingFraction * 100).toFixed(0)}%`);
}
const fused = new Uint8ClampedArray(dims.width * dims.height * 4), samples: number[][] = [[], [], []];
for (let i = 0; i < dims.width * dims.height; i++) {
  samples.forEach(s => (s.length = 0));
  for (const crop of crops) if (crop[i * 4 + 3] === 255) for (let c = 0; c < 3; c++) samples[c].push(crop[i * 4 + c]);
  if (!samples[0].length) { fused[i * 4] = fused[i * 4 + 1] = fused[i * 4 + 2] = 128; fused[i * 4 + 3] = 0; continue; }
  for (let c = 0; c < 3; c++) { samples[c].sort((a, b) => a - b); fused[i * 4 + c] = samples[c][samples[c].length >> 1]; }
  fused[i * 4 + 3] = 255;
}
await fs.mkdir(outDir, { recursive: true });
const encoded = jpeg.encode({ data: Buffer.from(fused), width: dims.width, height: dims.height }, 88);
await fs.writeFile(path.join(outDir, `${name}.jpg`), encoded.data);
const [startLng, startLat] = rdToLngLat(wall.a), [endLng, endLat] = rdToLngLat(wall.b);
await fs.writeFile(path.join(outDir, `${name}.json`), JSON.stringify({
  name, buildingIds: [...ids], image: `${name}.jpg`, width: dims.width, height: dims.height, pixelsPerMetre: ppm,
  wall: { startLngLat: [startLng, startLat], endLngLat: [endLng, endLat], lengthM: wall.len, heightM: plane.topZ - plane.baseZ, outwardBearingDeg: (Math.atan2(wall.nx, wall.ny) * 180 / Math.PI + 360) % 360 },
  panoramas: picks.map(p => ({ id: p.pano.pano_id, timestamp: p.pano.timestamp, distanceM: Math.round(p.d), obliquityDeg: Math.round(p.obliquity) })),
  fusion: 'per-pixel median across panoramas',
  // Measured roofline and wall colour: the reference a low-poly front is checked against.
  silhouette: photoSilhouette({ width: dims.width, height: dims.height, data: fused }, ppm),
  attribution: 'Gemeente Amsterdam, Panoramabeelden (open data; faces and number plates blurred by the publisher)',
  licenceNote: 'Verify at https://data.amsterdam.nl/uitleg-gebruik before shipping.',
}, null, 1));
console.log(`wrote ${path.join(outDir, name)}.jpg (${dims.width}x${dims.height}, ${(encoded.data.length / 1024).toFixed(0)} KB)`);
