/**
 * Draw a building's footprint onto the raw panorama, and look at where it lands.
 *
 * This is the test that should have existed first, and every failure of the
 * last two days is a consequence of it not existing.
 *
 * The pipeline's first act is a correspondence: *this* BAG footprint appears at
 * *these* pixels of *that* panorama. Everything after it — rectification,
 * detection, grammar, textures, the renderer — is measurement performed on the
 * assumption that the correspondence holds. But it was never checked directly.
 * It was only ever checked through its own consequences: does the rectified
 * strip look like a façade? In Amsterdam that question has no power, because
 * whatever you point at looks like a façade. A 180° yaw error passed it for the
 * entire project.
 *
 * So: no rectification. Take the footprint the registry published, lift it to
 * the measured ground and eaves heights, project those corners through the
 * camera model into the equirectangular frame, draw the wireframe on the
 * photograph, and crop to it. If the box is on the building, the correspondence
 * is right and everything downstream has a foundation. If it is on the
 * neighbour, or the canal, or half a building, that is visible in one glance
 * and no amount of careful measurement will fix it.
 *
 * It tests the RD transform, the camera model, the yaw convention, the pose and
 * the choice of wall simultaneously, which is the point: those are exactly the
 * things that cannot be separated by looking at a rectified strip.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/project-check.ts --ids=<pandId>,...
 *   npx tsx scripts/facade-twin/project-check.ts --limit=24
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M, hasUsablePose } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.resolve('public/canal-drive/projection-check');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = new Map<string, PanoramaView>(
  (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[])
    .map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')).facades as Record<string, any>;
let multi: Record<string, Array<{ panoramaId: string }>> = {};
try { multi = JSON.parse(await readFile(path.join(STAGING, 'multi-view.json'), 'utf8')).facades; } catch { /* optional */ }
let addresses: Record<string, any> = {};
try { addresses = JSON.parse(await readFile(path.join(CACHE, 'addresses.json'), 'utf8')).addresses; } catch { /* optional */ }

const footprints = new Map<string, ProjectedPoint[]>();
for (const e of registry) if (!footprints.has(e.buildingId)) {
  footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
}

/**
 * World offset → pixel, through the publisher's camera model.
 *
 * This used to rotate by the van's heading, pitch and roll before mapping to a
 * pixel. It does not any more, and that single change is what put the outline on
 * the building: Amsterdam's frames are already north-aligned and level. See
 * `AMSTERDAM_CAMERA`.
 */

const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const limit = Number(arg('limit') ?? 0);
const measured = Object.keys(store).sort();
const queue = ids.length ? ids
  : measured.filter((_, i) => i % Math.max(1, Math.floor(measured.length / (limit || 24))) === 0).slice(0, limit || 24);

await mkdir(OUT, { recursive: true });
const report = [];
for (const buildingId of queue) {
  const record = store[buildingId];
  const ring = footprints.get(buildingId);
  const mass = massing.get(buildingId);
  if (!record || !ring || !mass?.groundLevel) continue;
  // Every view of this wall we have, not just the one it was measured from.
  // Agreement between independent panoramas is the correspondence test: two
  // cameras in different places on different days cannot both put a building
  // where there is none, and if they disagree the geometry is wrong in a way no
  // single view can reveal.
  const candidates: PanoramaView[] = [];
  const chosen = views.get(record.panoramaId);
  if (chosen) candidates.push(chosen);
  for (const extra of (multi[buildingId] ?? [])) {
    const v = views.get(extra.panoramaId);
    if (v && hasUsablePose(v) && !candidates.some(c => c.panoramaId === v.panoramaId)) candidates.push(v);
  }
  for (const view of candidates) {
  let bytes: Buffer;
  try { bytes = await readFile(path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`)); } catch { continue; }
  const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const cam = RD_NEW.fromLngLat(view.lngLat);
  const camZ = view.cameraHeight - GEOID_SEPARATION_M;
  const ground = mass.groundLevel;
  const eaves = mass.eavesHeight ?? ground + 12;

  const project = (p: ProjectedPoint, z: number) =>
    AMSTERDAM_CAMERA.project([p.x - cam.x, p.y - cam.y, z - camZ],
      { x: cam.x, y: cam.y, z: camZ, headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg }, image);

  // Every footprint corner at ground and at eaves.
  const low = ring.map(p => project(p, ground));
  const high = ring.map(p => project(p, eaves));
  // The measured front wall, drawn heavier — that is the thing being rectified.
  const [wx0, wy0, wx1, wy1] = record.wall;
  const wallLow = [project({ x: wx0, y: wy0 }, ground), project({ x: wx1, y: wy1 }, ground)];
  const wallHigh = [project({ x: wx0, y: wy0 }, eaves), project({ x: wx1, y: wy1 }, eaves)];

  // Crop around the *wall*, not the whole footprint.
  //
  // The footprint includes twenty metres of depth, and seen from the quay its
  // rear corners sit at wildly different bearings — the bounding box of the
  // whole solid spanned about 100° of the panorama, so the frontage being
  // judged occupied a fifth of a very wide, very curved picture. What a
  // reviewer needs is the wall and enough of its neighbours to see whether it
  // is on the right house.
  const all = [...wallLow, ...wallHigh];
  const anchor = all[0][0];
  const unwrap = (u: number) => {
    let d = u - anchor;
    while (d > image.width / 2) d -= image.width;
    while (d < -image.width / 2) d += image.width;
    return anchor + d;
  };
  const us = all.map(p => unwrap(p[0]));
  const vs = all.map(p => p[1]);
  const minU = Math.min(...us), maxU = Math.max(...us);
  const minV = Math.min(...vs), maxV = Math.max(...vs);
  // Half a frontage of context on each side: enough to see the neighbours.
  const padU = Math.max(80, (maxU - minU) * 0.6), padV = Math.max(60, (maxV - minV) * 0.3);
  const x0 = Math.round(minU - padU), x1 = Math.round(maxU + padU);
  const y0 = Math.max(0, Math.round(minV - padV)), y1 = Math.min(image.height, Math.round(maxV + padV));
  const cw = x1 - x0, ch = y1 - y0;
  if (cw < 8 || ch < 8 || cw > 6000) continue;

  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const sx = ((x + x0) % image.width + image.width) % image.width;
      const sy = Math.max(0, Math.min(image.height - 1, y + y0));
      const s = (sy * image.width + sx) * 4, d = (y * cw + x) * 4;
      out[d] = image.data[s]; out[d + 1] = image.data[s + 1];
      out[d + 2] = image.data[s + 2]; out[d + 3] = 255;
    }
  }
  /**
   * A 3-D edge, drawn as the curve it actually is.
   *
   * In an equirectangular frame the image of a straight line in the world is
   * *not* straight — it is a great-circle arc, and over the 20–30° a canal house
   * subtends at twenty metres the bow is tens of pixels. Drawing straight lines
   * between projected corners therefore lays a box across the wall at a visible
   * angle to it, and the outline looks wrong on a projection that is in fact
   * exact. The scale was right all along: 470 px for a 12.24 m wall at 30 m is
   * 40 px/m against the 41.7 the range implies.
   *
   * So the edge is subdivided in *world* space and every sample projected. The
   * drawn curve is then the real image of the edge.
   */
  const edge = (pa: ProjectedPoint, za: number, pb: ProjectedPoint, zb: number,
                colour: [number, number, number], thick = 2) => {
    const STEPS = 48;
    let prev: number[] | null = null;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const here = project({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t }, za + (zb - za) * t);
      if (prev) line(prev, here, colour, thick);
      prev = here;
    }
  };

  const line = (a: number[], b: number[], colour: [number, number, number], thick = 2) => {
    const ax = unwrap(a[0]) - x0, ay = a[1] - y0, bx = unwrap(b[0]) - x0, by = b[1] - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= steps; i++) {
      const px = Math.round(ax + ((bx - ax) * i) / steps);
      const py = Math.round(ay + ((by - ay) * i) / steps);
      for (let ox = -thick; ox <= thick; ox++) for (let oy = -thick; oy <= thick; oy++) {
        const qx = px + ox, qy = py + oy;
        if (qx < 0 || qy < 0 || qx >= cw || qy >= ch) continue;
        const d = (qy * cw + qx) * 4;
        out[d] = colour[0]; out[d + 1] = colour[1]; out[d + 2] = colour[2];
      }
    }
  };
  // Whole footprint in blue, the measured front wall in green — every edge
  // drawn as the arc it really is.
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    edge(ring[i], ground, ring[j], ground, [70, 150, 255], 1);
    edge(ring[i], eaves, ring[j], eaves, [70, 150, 255], 1);
    edge(ring[i], ground, ring[i], eaves, [70, 150, 255], 1);
  }
  const wa = { x: wx0, y: wy0 }, wb = { x: wx1, y: wy1 };
  edge(wa, ground, wb, ground, [40, 235, 120], 3);
  edge(wa, eaves, wb, eaves, [40, 235, 120], 3);
  edge(wa, ground, wa, eaves, [40, 235, 120], 3);
  edge(wb, ground, wb, eaves, [40, 235, 120], 3);

  const stem = `${buildingId}__${view.panoramaId}`;
  await writeFile(path.join(OUT, `${stem}.jpg`),
    jpeg.encode({ width: cw, height: ch, data: Buffer.from(out) }, 88).data);
  const wallPx = Math.abs(unwrap(wallLow[1][0]) - unwrap(wallLow[0][0]));
  report.push({
    buildingId,
    file: `${stem}.jpg`,
    panoramaId: view.panoramaId,
    capturedAt: view.capturedAt.slice(0, 10),
    // The front wall as a polygon in crop pixels — not a bounding box.
    //
    // The bounding box of the whole projected wireframe is the wrong region to
    // ask about: for a building seen at any angle it is mostly sky and road even
    // when the projection is perfect, so scoring fill inside it says every
    // building is wrong. The wall quad is the thing that should be covered in
    // brick, and it is what gets rectified.
    wallQuad: [
      [Math.round(unwrap(wallLow[0][0]) - x0), Math.round(wallLow[0][1] - y0)],
      [Math.round(unwrap(wallLow[1][0]) - x0), Math.round(wallLow[1][1] - y0)],
      [Math.round(unwrap(wallHigh[1][0]) - x0), Math.round(wallHigh[1][1] - y0)],
      [Math.round(unwrap(wallHigh[0][0]) - x0), Math.round(wallHigh[0][1] - y0)],
    ],
    address: addresses[buildingId]?.label ?? null,
    wallWidthM: record.wallWidthM,
    wallPixels: Math.round(wallPx),
    impliedPixelsPerMetre: Number((wallPx / Math.max(record.wallWidthM, 0.1)).toFixed(1)),
    standoffM: record.standoffM,
    // What the panorama should give at this range, if the geometry is right.
    expectedPixelsPerMetre: Number((1250 / Math.max(record.standoffM, 1)).toFixed(1)),
    crop: `${cw}x${ch}`,
  });
  }
}

await writeFile(path.join(STAGING, 'projection-check.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/project-check.ts',
    note: 'Footprints projected into raw panoramas. No rectification. Blue is the whole BAG '
      + 'footprint at ground and eaves; green is the wall being rectified. If the green box is '
      + 'not on the building, nothing downstream can be right.',
  },
  buildings: report,
}, null, 1));

const perBuilding = new Map<string, number>();
for (const r of report) perBuilding.set(r.buildingId, (perBuilding.get(r.buildingId) ?? 0) + 1);
console.log(`${report.length} projections of ${perBuilding.size} buildings → ${path.relative(process.cwd(), OUT)}`);
console.log(`  ${[...perBuilding.values()].filter(n => n > 1).length} with more than one view\n`);
console.log(`${'pand'.padEnd(8)}${'wall m'.padStart(8)}${'px'.padStart(7)}${'px/m'.padStart(7)}${'expect'.padStart(8)}  address`);
for (const r of report.slice(0, 24)) {
  const flag = Math.abs(r.impliedPixelsPerMetre - r.expectedPixelsPerMetre) / r.expectedPixelsPerMetre > 0.3 ? ' ←' : '';
  console.log(`${r.buildingId.slice(-6).padEnd(8)}${String(r.wallWidthM).padStart(8)}${String(r.wallPixels).padStart(7)}`
    + `${String(r.impliedPixelsPerMetre).padStart(7)}${String(r.expectedPixelsPerMetre).padStart(8)}  ${r.address ?? ''}${flag}`);
}
