/**
 * One page that shows everything known about a building, side by side.
 *
 * The evidence for this project has been scattered across a dozen JSON files, a
 * directory of loose tiles and three review pages that each answered one
 * question. That is how a 180° error survived for a pilot: nothing put the
 * parcel, the camera, the photograph and the address on one screen, so no single
 * glance could contradict any of them.
 *
 * Per pand this shows, in one column:
 *
 *   - the **plan** — BAG footprint, the wall being rectified, the cameras that
 *     saw it, their rays, and BAG's own address points, all in metres;
 *   - the **projection** — that footprint drawn into the raw panorama, which is
 *     the correspondence itself and not a consequence of it;
 *   - the **rectified strip** from each independent view, so disagreement is
 *     visible rather than inferred;
 *   - the **door band** with any house number read off it;
 *   - the **numbers** — registration residual, correlation peak, obliquity,
 *     standoff, occlusion, pose.
 *
 * Everything is embedded, so the page is one file that opens anywhere. Street
 * imagery is CC BY 4.0 and attributed at the foot.
 *
 * Usage: npx tsx scripts/facade-twin/build-explorer.ts [--limit=30] [--ids=...]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { AMSTERDAM_CAMERA, hasUsableGeometry, lensHeightNap } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { loadTrackOffsets } from './panorama-render.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'explorer');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);

const readJson = async (p: string, fallback: any = null) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};

const registry = (await readJson(path.join(CACHE, `${AREA.areaId}-registry.json`))).data as Array<{ buildingId: string; footprintLngLat: LngLat[]; constructionYear?: number }>;
const views = new Map<string, PanoramaView>(
  ((await readJson(path.join(CACHE, `${AREA.areaId}-panoramas.json`))).data as PanoramaView[]).map(v => [v.panoramaId, v]));
const recon = await readJson(path.join(STAGING, 'recon.json'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = (await readJson(path.join(STAGING, 'measured-facades.json'), { facades: {} })).facades as Record<string, any>;
const multi = (await readJson(path.join(STAGING, 'multi-view.json'), { facades: {} })).facades as Record<string, Array<{ panoramaId: string }>>;
const addressPoints = (await readJson(path.join(CACHE, 'address-points.json'), { addresses: [] })).addresses as
  Array<{ street: string; houseNumber: number; display: string; rd: { x: number; y: number }; pandId: string | null }>;
const registration = (await readJson(path.join(CACHE, 'cross-view-registration.json'), { panden: [] })).panden as any[];
const bandManifest = (await readJson(path.join(CACHE, 'number-bands/manifest.json'), { bands: [] })).bands as any[];
const bandReadings = (await readJson(path.join(CACHE, 'number-bands/readings.json'), { bands: [] })).bands as any[];

const footprints = new Map<string, ProjectedPoint[]>();
const years = new Map<string, number | undefined>();
for (const e of registry) if (!footprints.has(e.buildingId)) {
  footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));
  years.set(e.buildingId, e.constructionYear);
}
const addressesOf = new Map<string, typeof addressPoints>();
for (const a of addressPoints) if (a.pandId) (addressesOf.get(a.pandId) ?? addressesOf.set(a.pandId, []).get(a.pandId)!).push(a);

/**
 * The footprint elevation the old proposal was pointing at.
 *
 * `measured-facades.json` stores a wall chosen before coplanar stretches were
 * rejoined, so on a frontage with a jog it holds one piece of the wall — a
 * median 2.31x too small across 176 panden. The record is quarantined evidence
 * anyway; what it is still good for is saying *which* elevation was meant. So
 * the proposal is snapped onto the elevation it lies on, and the geometry comes
 * from the footprint rather than from the stale extract.
 */
function wallOf(ring: ProjectedPoint[], proposed: readonly number[]): [number, number, number, number] {
  const mid = { x: (proposed[0] + proposed[2]) / 2, y: (proposed[1] + proposed[3]) / 2 };
  const elevations = buildElevations(ring);
  if (!elevations.length) return [proposed[0], proposed[1], proposed[2], proposed[3]];
  // Nearest by perpendicular distance to the segment, not to its midpoint: a
  // merged elevation's midpoint can sit far from the piece originally chosen.
  const best = elevations
    .map(e => {
      const dx = (e.end.x - e.start.x) / e.lengthM, dy = (e.end.y - e.start.y) / e.lengthM;
      const along = Math.max(0, Math.min(e.lengthM, (mid.x - e.start.x) * dx + (mid.y - e.start.y) * dy));
      const px = e.start.x + dx * along, py = e.start.y + dy * along;
      return { e, d: Math.hypot(mid.x - px, mid.y - py) };
    })
    .sort((a, b) => a.d - b.d)[0].e;
  return [best.start.x, best.start.y, best.end.x, best.end.y];
}

const decoded = new Map<string, any>();
async function panorama(id: string) {
  if (decoded.has(id)) return decoded.get(id);
  if (decoded.size > 4) decoded.clear();
  const file = path.join(CACHE, 'panoramas', `${id}.jpg`);
  if (!existsSync(file)) return null;
  const image = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true });
  decoded.set(id, image);
  return image;
}

const trackOffset = await loadTrackOffsets(CACHE);

const poseOf = (view: PanoramaView, groundZ: number) => {
  const cam = RD_NEW.fromLngLat(view.lngLat);
  const lens = lensHeightNap(view, groundZ);
  if (!lens) return null;
  // The solved per-segment datum offset, where one exists; an inferred height
  // is already anchored to the ground and must not be corrected twice.
  if (!lens.inferred) lens.z -= trackOffset(view).offsetM;
  return { pose: { x: cam.x, y: cam.y, z: lens.z,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg }, inferred: lens.inferred };
};

const encode = (width: number, height: number, data: Uint8ClampedArray, quality = 74) =>
  jpeg.encode({ width, height, data: Buffer.from(data) }, quality).data.toString('base64');

function downscale(src: Uint8ClampedArray, w: number, h: number, maxW: number) {
  if (w <= maxW) return { w, h, data: src };
  const k = maxW / w, ow = maxW, oh = Math.max(1, Math.round(h * k));
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const sx = Math.min(w - 1, Math.floor(x / k)), sy = Math.min(h - 1, Math.floor(y / k));
    const s = (sy * w + sx) * 4, d = (y * ow + x) * 4;
    out[d] = src[s]; out[d + 1] = src[s + 1]; out[d + 2] = src[s + 2]; out[d + 3] = 255;
  }
  return { w: ow, h: oh, data: out };
}

/** The footprint drawn into the raw panorama: the correspondence itself. */
async function projection(pandId: string, view: PanoramaView, wall: number[], ground: number, eaves: number) {
  const image = await panorama(view.panoramaId);
  if (!image) return null;
  const groundZ = ground;
  const ring = footprints.get(pandId)!;
  const posed = poseOf(view, groundZ);
  if (!posed) return null;
  const pose = posed.pose;
  const project = (p: ProjectedPoint, z: number) => AMSTERDAM_CAMERA.project([p.x - pose.x, p.y - pose.y, z - pose.z], pose, image);
  const [wx0, wy0, wx1, wy1] = wall;
  const a = { x: wx0, y: wy0 }, b = { x: wx1, y: wy1 };
  const corners = [project(a, ground), project(b, ground), project(a, eaves), project(b, eaves)];
  const anchor = corners[0][0];
  const unwrap = (u: number) => { let d = u - anchor; while (d > image.width / 2) d -= image.width; while (d < -image.width / 2) d += image.width; return anchor + d; };
  const us = corners.map(c => unwrap(c[0])), vs = corners.map(c => c[1]);
  const padU = Math.max(90, (Math.max(...us) - Math.min(...us)) * 0.6), padV = Math.max(70, (Math.max(...vs) - Math.min(...vs)) * 0.28);
  const x0 = Math.round(Math.min(...us) - padU), x1 = Math.round(Math.max(...us) + padU);
  const y0 = Math.max(0, Math.round(Math.min(...vs) - padV)), y1 = Math.min(image.height, Math.round(Math.max(...vs) + padV));
  const cw = x1 - x0, ch = y1 - y0;
  if (cw < 16 || ch < 16 || cw > 7000 || ch > 4000) return null;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = ((x + x0) % image.width + image.width) % image.width;
    const sy = Math.max(0, Math.min(image.height - 1, y + y0));
    const s = (sy * image.width + sx) * 4, d = (y * cw + x) * 4;
    out[d] = image.data[s]; out[d + 1] = image.data[s + 1]; out[d + 2] = image.data[s + 2]; out[d + 3] = 255;
  }
  const line = (p: number[], q: number[], colour: number[], thick: number) => {
    const ax = unwrap(p[0]) - x0, ay = p[1] - y0, bx = unwrap(q[0]) - x0, by = q[1] - y0;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const px = Math.round(ax + ((bx - ax) * i) / n), py = Math.round(ay + ((by - ay) * i) / n);
      for (let ox = -thick; ox <= thick; ox++) for (let oy = -thick; oy <= thick; oy++) {
        const qx = px + ox, qy = py + oy;
        if (qx < 0 || qy < 0 || qx >= cw || qy >= ch) continue;
        const d = (qy * cw + qx) * 4;
        out[d] = colour[0]; out[d + 1] = colour[1]; out[d + 2] = colour[2];
      }
    }
  };
  // In an equirectangular frame a straight 3-D line images as an arc, so every
  // edge is subdivided in world space and each sample projected.
  const edge = (pa: ProjectedPoint, za: number, pb: ProjectedPoint, zb: number, colour: number[], thick: number) => {
    let prev: number[] | null = null;
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const here = project({ x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t }, za + (zb - za) * t);
      if (prev) line(prev, here, colour, thick);
      prev = here;
    }
  };
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    edge(ring[i], ground, ring[j], ground, [70, 150, 255], 1);
    edge(ring[i], eaves, ring[j], eaves, [70, 150, 255], 1);
  }
  edge(a, ground, b, ground, [40, 235, 120], 2);
  edge(a, eaves, b, eaves, [40, 235, 120], 2);
  edge(a, ground, a, eaves, [40, 235, 120], 2);
  edge(b, ground, b, eaves, [40, 235, 120], 2);
  const small = downscale(out, cw, ch, 420);
  return encode(small.w, small.h, small.data);
}

/** The wall rectified into its own plane, at a readable scale. */
async function rectified(view: PanoramaView, wall: number[], baseZ: number, topZ: number, marginFactor = 1.25) {
  const image = await panorama(view.panoramaId);
  if (!image) return null;
  const posed = poseOf(view, baseZ + 1);
  if (!posed) return null;
  const pose = posed.pose;
  const [x0, y0, x1, y1] = wall;
  const wM = Math.hypot(x1 - x0, y1 - y0);
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const ux = (x1 - x0) / wM, uy = (y1 - y0) / wM, half = (wM * marginFactor) / 2;
  const start = { x: mid.x - ux * half, y: mid.y - uy * half };
  const ppm = 26;
  const w = Math.max(8, Math.round(wM * marginFactor * ppm)), h = Math.max(8, Math.round((topZ - baseZ) * ppm));
  if (w * h > 4e6) return null;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let py = 0; py < h; py++) {
    const z = topZ - ((py + 0.5) / h) * (topZ - baseZ);
    for (let px = 0; px < w; px++) {
      const along = ((px + 0.5) / w) * wM * marginFactor;
      const [u, v] = AMSTERDAM_CAMERA.project([start.x + ux * along - pose.x, start.y + uy * along - pose.y, z - pose.z], pose, image);
      const sx = Math.round(((u % image.width) + image.width) % image.width), sy = Math.round(v);
      const d = (py * w + px) * 4;
      data[d + 3] = 255;
      if (sy < 0 || sy >= image.height) continue;
      const s = (sy * image.width + sx) * 4;
      data[d] = image.data[s]; data[d + 1] = image.data[s + 1]; data[d + 2] = image.data[s + 2];
    }
  }
  const small = downscale(data, w, h, 380);
  return encode(small.w, small.h, small.data);
}

/** A plan of the parcel, its wall, its cameras and BAG's address points. */
function plan(pandId: string, wall: number[], cameras: Array<{ view: PanoramaView; role: string }>) {
  const ring = footprints.get(pandId)!;
  const [wx0, wy0, wx1, wy1] = wall;
  const points: ProjectedPoint[] = [...ring, { x: wx0, y: wy0 }, { x: wx1, y: wy1 },
    ...cameras.map(c => RD_NEW.fromLngLat(c.view.lngLat)),
    ...(addressesOf.get(pandId) ?? []).map(a => a.rd)];
  // Neighbours give the plan its context: a wall on the wrong side of a party
  // wall is only visible against the terrace it sits in.
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const neighbours: Array<[string, ProjectedPoint[]]> = [];
  for (const [otherId, other] of footprints) {
    if (otherId === pandId) continue;
    if (Math.hypot(other[0].x - cx, other[0].y - cy) < 45) neighbours.push([otherId, other]);
    if (neighbours.length > 40) break;
  }
  for (const [, other] of neighbours) points.push(...other);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const pad = 4;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const W = 380, H = Math.max(200, Math.min(340, Math.round(W * (maxY - minY) / Math.max(1, maxX - minX))));
  const sx = W / (maxX - minX), sy = H / (maxY - minY), s = Math.min(sx, sy);
  // North up: SVG y grows downward, RD y grows north.
  const px = (p: ProjectedPoint) => [((p.x - minX) * s).toFixed(1), (H - (p.y - minY) * s).toFixed(1)];
  const poly = (r: ProjectedPoint[]) => r.map(p => px(p).join(',')).join(' ');

  const parts: string[] = [];
  for (const [, other] of neighbours) parts.push(`<polygon points="${poly(other)}" class="nb"/>`);
  parts.push(`<polygon points="${poly(ring)}" class="me"/>`);
  const [ax, ay] = px({ x: wx0, y: wy0 }), [bx, by] = px({ x: wx1, y: wy1 });
  for (const { view, role } of cameras) {
    const cam = RD_NEW.fromLngLat(view.lngLat);
    const [ex, ey] = px(cam);
    const mx = (Number(ax) + Number(bx)) / 2, my = (Number(ay) + Number(by)) / 2;
    parts.push(`<line x1="${ex}" y1="${ey}" x2="${mx}" y2="${my}" class="ray ${role}"/>`);
    parts.push(`<circle cx="${ex}" cy="${ey}" r="3.5" class="cam ${role}"><title>${role} · ${view.capturedAt.slice(0, 10)} · heading ${view.headingDeg.toFixed(1)}°</title></circle>`);
  }
  parts.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" class="wall"/>`);
  for (const a of addressesOf.get(pandId) ?? []) {
    const [x, y] = px(a.rd);
    parts.push(`<circle cx="${x}" cy="${y}" r="2.4" class="addr"><title>${a.street} ${a.display}</title></circle>`);
  }
  const scaleM = 10, scalePx = (scaleM * s).toFixed(1);
  parts.push(`<line x1="10" y1="${H - 12}" x2="${10 + Number(scalePx)}" y2="${H - 12}" class="scale"/>`
    + `<text x="${12 + Number(scalePx)}" y="${H - 8}" class="scaletext">${scaleM} m</text>`);
  parts.push(`<text x="${W - 12}" y="16" class="scaletext" text-anchor="end">N ↑</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" class="plan" role="img" aria-label="parcel plan">${parts.join('')}</svg>`;
}

const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const limit = Number(arg('limit') ?? 30);
const queue = ids.length ? ids : Object.keys(store).sort();

await mkdir(OUT, { recursive: true });
const cards: any[] = [];
let done = 0;
for (const pandId of queue) {
  if (done >= (ids.length ? ids.length : limit)) break;
  const record = store[pandId], ring = footprints.get(pandId), mass = massing.get(pandId);
  if (!record || !ring || !Number.isFinite(mass?.groundLevel)) continue;

  const wall = wallOf(ring, record.wall);
  const chosen: PanoramaView[] = [];
  for (const id of [record.panoramaId, ...(multi[pandId] ?? []).map(m => m.panoramaId)]) {
    const v = views.get(id);
    if (v && hasUsableGeometry(v) && !chosen.some(c => c.panoramaId === id)) chosen.push(v);
  }
  if (!chosen.length) continue;
  const shown = chosen.slice(0, 3);
  const ground = mass.groundLevel;
  const eavesLine = Number.isFinite(mass.eavesHeight) ? mass.eavesHeight : null;
  const eaves = Number.isFinite(mass.ridgeHeight) ? mass.ridgeHeight : (eavesLine ?? ground + 12);

  const wallElevation = buildElevations(ring)
    .map(e => ({ e, d: Math.hypot(e.midpoint.x - (wall[0] + wall[2]) / 2, e.midpoint.y - (wall[1] + wall[3]) / 2) }))
    .sort((a, b) => a.d - b.d)[0].e;

  const projections: any[] = [];
  const strips: any[] = [];
  for (const view of shown) {
    const cam = RD_NEW.fromLngLat(view.lngLat);
    const meta = {
      panoramaId: view.panoramaId, capturedAt: view.capturedAt.slice(0, 10),
      heading: Number(view.headingDeg.toFixed(1)),
      standoff: Number(standoffM(wallElevation, cam).toFixed(1)),
      obliquity: Number(obliquityDeg(wallElevation, cam).toFixed(1)),
    };
    const p = await projection(pandId, view, wall, ground, eaves);
    if (p) projections.push({ ...meta, image: p });
    const r = await rectified(view, wall, ground - 1, eaves + 1.5);
    if (r) strips.push({ ...meta, image: r });
  }
  if (!projections.length && !strips.length) continue;

  const band = bandManifest.find(b => b.pandId === pandId);
  const readings = bandReadings.find(b => b.pandId === pandId)?.readings ?? [];
  const bandTiles: any[] = [];
  if (band) {
    for (const tile of band.tiles.slice(0, 6)) {
      const file = path.join(CACHE, 'number-bands', tile.file);
      if (!existsSync(file)) continue;
      const im = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true });
      const small = downscale(Uint8ClampedArray.from(im.data), im.width, im.height, 300);
      bandTiles.push({
        startM: tile.startM, native: tile.nativePixelsPerMetre, image: encode(small.w, small.h, small.data, 80),
        readings: readings.filter((r: any) => r.alongM >= tile.startM && r.alongM < tile.startM + tile.lengthM)
          .map((r: any) => `${r.text} @${r.confidence.toFixed(2)}`),
      });
    }
  }

  const reg = registration.find(r => r.pandId === pandId);
  const addresses = (addressesOf.get(pandId) ?? []);
  const label = addresses.length
    ? `${addresses[0].street} ${[...new Set(addresses.map(a => a.houseNumber))].sort((a, b) => a - b).join(', ')}`
    : pandId;

  cards.push({
    pandId, label,
    addressCount: addresses.length,
    constructionYear: years.get(pandId) ?? null,
    wallWidthM: Number(Math.hypot(wall[2] - wall[0], wall[3] - wall[1]).toFixed(2)),
    proposedWidthM: record.wallWidthM, ground: Number(ground.toFixed(2)), eaves: Number(eaves.toFixed(2)),
    plan: plan(pandId, wall, shown.map((v, i) => ({ view: v, role: i === 0 ? 'primary' : 'other' }))),
    projections, strips, bandTiles,
    registration: reg ? { shiftM: reg.shiftM, peak: reg.peak, occluded: !!(reg.occludedA || reg.occludedB), dHeading: reg.dHeading } : null,
    readingSummary: readings.slice(0, 4).map((r: any) => `${r.text} @${r.confidence.toFixed(2)}`),
  });
  done++;
  process.stdout.write(`\r  ${done} panden`);
}
process.stdout.write('\r');

const chip = (c: any) => {
  if (!c.registration) return `<span class="chip none">no cross-view</span>`;
  const a = Math.abs(c.registration.shiftM);
  const cls = a < 1 ? 'good' : a < 2 ? 'fair' : 'bad';
  return `<span class="chip ${cls}">${a.toFixed(2)} m</span>`;
};

const section = (c: any) => `
<article class="card" data-pand="${c.pandId}" data-label="${c.label.toLowerCase()}"
  data-shift="${c.registration ? Math.abs(c.registration.shiftM) : -1}">
  <header class="cardhead">
    <div><h2>${c.label}</h2>
      <p class="meta">BAG ${c.pandId} · ${c.addressCount} address${c.addressCount === 1 ? '' : 'es'}`
  + `${c.constructionYear ? ` · built ${c.constructionYear}` : ''} · wall ${c.wallWidthM} m · ground ${c.ground} m NAP</p></div>
    <div class="chips">${chip(c)}${c.registration?.occluded ? '<span class="chip warn">occluded</span>' : ''}
      ${c.readingSummary.length ? `<span class="chip read">read ${c.readingSummary[0]}</span>` : ''}</div>
  </header>
  <div class="grid">
    <div class="cell"><h3>Parcel</h3>${c.plan}
      <p class="legend"><span class="k wall"></span>wall rectified <span class="k cam"></span>camera
      <span class="k addr"></span>BAG address <span class="k nb"></span>neighbour</p></div>
    <div class="cell"><h3>Footprint in the raw panorama</h3><div class="row">
      ${c.projections.map((p: any) => `<figure><img src="data:image/jpeg;base64,${p.image}" alt="">
        <figcaption>${p.capturedAt} · heading ${p.heading}° · ${p.standoff} m · ${p.obliquity}° off square</figcaption></figure>`).join('')}
    </div></div>
    <div class="cell"><h3>Rectified wall, one per independent view</h3><div class="row">
      ${c.strips.map((p: any) => `<figure><img src="data:image/jpeg;base64,${p.image}" alt="">
        <figcaption>${p.capturedAt} · heading ${p.heading}°</figcaption></figure>`).join('')}
    </div></div>
    <div class="cell report">
      <h3>Report a problem with this building</h3>
      <div class="reportrow">
        <select class="kind" aria-label="what is wrong">
          <option value="wrong-building">Outline is on the wrong building</option>
          <option value="wrong-wall">Right building, wrong wall</option>
          <option value="offset">Right wall, visibly offset</option>
          <option value="occluded">View is blocked — tree, boat, scaffolding</option>
          <option value="bad-crop">Crop or rectification looks wrong</option>
          <option value="looks-right">Looks right (confirming it)</option>
          <option value="other">Something else</option>
        </select>
        <input class="note" type="text" placeholder="optional note — what you saw" aria-label="note">
        <button class="send" type="button">Report</button>
      </div>
      <p class="reported" aria-live="polite"></p>
    </div>
    ${c.bandTiles.length ? `<div class="cell"><h3>Door band, near-side pass</h3><div class="row">
      ${c.bandTiles.map((t: any) => `<figure><img src="data:image/jpeg;base64,${t.image}" alt="">
        <figcaption>${t.startM} m · ${t.native} px/m${t.readings.length ? ` · <b>${t.readings.join(', ')}</b>` : ''}</figcaption></figure>`).join('')}
    </div></div>` : ''}
  </div>
</article>`;

const page = `<title>Façade Twin Explorer</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root {
    --paper:#f4f3ee; --panel:#fbfaf7; --ink:#191c19; --muted:#6c716b; --rule:#dedbd2;
    --good:#1f6b45; --fair:#9a7020; --bad:#9c3b26; --plan:#2f6fd0; --wall:#1f8a4c;
    --display:"Zilla Slab",Georgia,serif; --body:"Source Sans 3",ui-sans-serif,system-ui,sans-serif;
    --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96; --rule:#2d312d;
    --good:#5fb98a; --fair:#d3ae5c; --bad:#d9775e; --plan:#7aa8e8; --wall:#5fb98a; } }
  :root[data-theme="dark"] {
    --paper:#141614; --panel:#1c1f1c; --ink:#eceae3; --muted:#979d96; --rule:#2d312d;
    --good:#5fb98a; --fair:#d3ae5c; --bad:#d9775e; --plan:#7aa8e8; --wall:#5fb98a; }
  * { box-sizing:border-box; }
  body { background:var(--paper); color:var(--ink); font-family:var(--body); font-size:15px;
         line-height:1.55; margin:0; padding:2rem 1.25rem 5rem; }
  .wrap { max-width:1240px; margin:0 auto; }
  .eyebrow { font-family:var(--mono); font-size:.7rem; letter-spacing:.14em; text-transform:uppercase;
             color:var(--muted); margin:0 0 .6rem; }
  h1 { font-family:var(--display); font-weight:600; font-size:2rem; margin:0 0 .5rem; letter-spacing:-.015em; }
  .lede { color:var(--muted); max-width:66ch; margin:0 0 1.5rem; }
  .controls { display:flex; flex-wrap:wrap; gap:.6rem; align-items:center; padding:.85rem 0 1.1rem;
              border-top:1px solid var(--rule); border-bottom:1px solid var(--rule); margin-bottom:1.5rem; }
  input[type=search], select { font-family:var(--body); font-size:.9rem; padding:.4rem .6rem;
    border:1px solid var(--rule); border-radius:4px; background:var(--panel); color:var(--ink); }
  input[type=search] { min-width:230px; }
  label { font-family:var(--mono); font-size:.74rem; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  #count { font-family:var(--mono); font-size:.8rem; color:var(--muted); margin-left:auto; }
  .card { border:1px solid var(--rule); border-radius:5px; background:var(--panel);
          padding:1.1rem 1.2rem 1.3rem; margin-bottom:1.4rem; }
  .cardhead { display:flex; gap:1rem; align-items:flex-start; flex-wrap:wrap;
              border-bottom:1px solid var(--rule); padding-bottom:.8rem; margin-bottom:1rem; }
  .cardhead h2 { font-family:var(--display); font-size:1.15rem; margin:0; }
  .meta { font-family:var(--mono); font-size:.74rem; color:var(--muted); margin:.2rem 0 0;
          font-variant-numeric:tabular-nums; }
  .chips { display:flex; gap:.4rem; flex-wrap:wrap; margin-left:auto; }
  .chip { font-family:var(--mono); font-size:.72rem; padding:.16rem .5rem; border-radius:3px;
          border:1px solid currentColor; white-space:nowrap; }
  .chip.good { color:var(--good); } .chip.fair { color:var(--fair); } .chip.bad { color:var(--bad); }
  .chip.warn { color:var(--fair); } .chip.none, .chip.read { color:var(--muted); }
  .grid { display:grid; gap:1.2rem; grid-template-columns:1fr; }
  @media (min-width:900px) { .grid { grid-template-columns:400px 1fr; }
    .cell:nth-child(1) { grid-row:span 3; } }
  h3 { font-family:var(--body); font-size:.82rem; font-weight:600; margin:0 0 .5rem;
       text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
  .row { display:flex; gap:.6rem; overflow-x:auto; padding-bottom:.4rem; }
  figure { margin:0; flex:0 0 auto; display:flex; flex-direction:column; gap:.32rem; }
  img { display:block; border-radius:3px; max-width:100%; }
  figcaption { font-family:var(--mono); font-size:.68rem; color:var(--muted); font-variant-numeric:tabular-nums; }
  .plan { width:100%; height:auto; background:var(--paper); border:1px solid var(--rule); border-radius:3px; }
  .plan .nb { fill:color-mix(in srgb, var(--muted) 14%, transparent); stroke:var(--rule); stroke-width:.7; }
  .plan .me { fill:color-mix(in srgb, var(--plan) 16%, transparent); stroke:var(--plan); stroke-width:1.2; }
  .plan .wall { stroke:var(--wall); stroke-width:3.2; stroke-linecap:round; }
  .plan .ray { stroke:var(--muted); stroke-width:.7; stroke-dasharray:3 3; }
  .plan .ray.primary { stroke:var(--bad); }
  .plan .cam { fill:var(--muted); } .plan .cam.primary { fill:var(--bad); }
  .plan .addr { fill:var(--fair); }
  .plan .scale { stroke:var(--ink); stroke-width:1.4; }
  .plan .scaletext { font-family:var(--mono); font-size:9px; fill:var(--muted); }
  .legend { font-family:var(--mono); font-size:.68rem; color:var(--muted); margin:.45rem 0 0;
            display:flex; gap:.7rem; flex-wrap:wrap; align-items:center; }
  .k { display:inline-block; width:.6rem; height:.6rem; border-radius:2px; margin-right:.25rem; vertical-align:-1px; }
  .k.wall { background:var(--wall); } .k.cam { background:var(--bad); }
  .k.addr { background:var(--fair); } .k.nb { background:color-mix(in srgb, var(--muted) 40%, transparent); }
  .report { border-top:1px dashed var(--rule); padding-top:.9rem; }
  .reportrow { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; }
  .reportrow select, .reportrow input { font-family:var(--body); font-size:.85rem; padding:.35rem .5rem;
    border:1px solid var(--rule); border-radius:4px; background:var(--paper); color:var(--ink); }
  .reportrow input { flex:1 1 220px; min-width:180px; }
  .reportrow button { font-family:var(--body); font-size:.85rem; font-weight:600; padding:.38rem .9rem;
    border:1px solid var(--wall); border-radius:4px; background:var(--wall); color:var(--paper); cursor:pointer; }
  .reportrow button:disabled { opacity:.5; cursor:default; }
  .reportrow button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid var(--plan); outline-offset:2px; }
  .reported { font-family:var(--mono); font-size:.72rem; color:var(--muted); margin:.5rem 0 0; min-height:1em; }
  .offline { color:var(--fair); }
  footer { border-top:1px solid var(--rule); padding-top:1rem; margin-top:2rem; color:var(--muted); font-size:.8rem; }
  code { font-family:var(--mono); font-size:.9em; }
</style>
<div class="wrap">
<p class="eyebrow">Amsterdam façade twin · ${AREA.name}</p>
<h1>Façade Twin Explorer</h1>
<p class="lede">Everything known about one building, on one screen: the BAG parcel and its address
points, the footprint drawn into the raw panorama, the wall rectified from each independent view,
and the door band with any house number read off it. Nothing here is accepted evidence — the wall
is a <em>proposal</em> from the pre-correction run, kept because it is the thing being checked.</p>
<p class="lede">Spot something wrong? Say so on the building itself — the report box under each card
writes straight back to the working session, so a note here reaches the pipeline without a
screenshot or a round trip.</p>

<div class="controls">
  <input type="search" id="q" placeholder="address or pand id" aria-label="search">
  <label for="f">show</label>
  <select id="f">
    <option value="all">all</option>
    <option value="good">locks within 1 m</option>
    <option value="fair">1–2 m</option>
    <option value="bad">misses by 2 m or more</option>
    <option value="none">no cross-view pair</option>
  </select>
  <span id="count"></span>
</div>

${cards.map(section).join('\n')}

<footer>Street imagery © Gemeente Amsterdam, <em>Kernregistratie Panoramabeelden</em>, CC BY 4.0.
Footprints and addresses from BAG via PDOK; ground and eaves from 3DBAG and AHN.
Camera model <code>${AMSTERDAM_CAMERA.id}</code>. Generated by
<code>scripts/facade-twin/build-explorer.ts</code>.</footer>
</div>
<script>
  const q = document.getElementById('q'), f = document.getElementById('f'), count = document.getElementById('count');
  const cards = [...document.querySelectorAll('.card')];
  function apply() {
    const term = q.value.trim().toLowerCase(), mode = f.value;
    let shown = 0;
    for (const card of cards) {
      const shift = Number(card.dataset.shift);
      const bucket = shift < 0 ? 'none' : shift < 1 ? 'good' : shift < 2 ? 'fair' : 'bad';
      const ok = (!term || card.dataset.label.includes(term) || card.dataset.pand.includes(term))
        && (mode === 'all' || mode === bucket);
      card.hidden = !ok;
      if (ok) shown++;
    }
    count.textContent = shown + ' of ' + cards.length + ' buildings';
  }
  q.addEventListener('input', apply); f.addEventListener('change', apply);

  // Reports go to the artifact's own store, so a note made while looking at a
  // building reaches the session that built the page. The page works without
  // it: if the store is unavailable the control says so instead of pretending.
  (async () => {
    const db = await claude.use('db');
    for (const card of cards) {
      const box = card.querySelector('.report');
      if (!box) continue;
      const button = box.querySelector('.send');
      const said = box.querySelector('.reported');
      if (!db) {
        button.disabled = true;
        said.textContent = 'reporting unavailable in this view';
        said.classList.add('offline');
        continue;
      }
      const pandId = card.dataset.pand;
      try {
        const existing = await db.collection('reports').where('pandId', '==', pandId).get();
        if (existing.docs.length) said.textContent = existing.docs.length + ' report(s) already filed';
      } catch (error) { /* an empty or unreadable store is not an error worth showing */ }
      button.addEventListener('click', async () => {
        button.disabled = true;
        const kind = box.querySelector('.kind').value;
        const note = box.querySelector('.note').value.trim();
        try {
          await db.collection('reports').add({
            pandId, label: card.dataset.label, kind, note,
            shiftM: Number(card.dataset.shift), createdAt: new Date().toISOString(),
          });
          said.textContent = 'reported — ' + kind + (note ? ' · ' + note : '');
          said.classList.remove('offline');
          box.querySelector('.note').value = '';
        } catch (error) {
          said.textContent = 'could not send (' + (error && error.code ? error.code : 'unknown') + ')';
          said.classList.add('offline');
        }
        button.disabled = false;
      });
    }
  })();
  try { const saved = localStorage.getItem('explorer-filter'); if (saved) f.value = saved; } catch {}
  f.addEventListener('change', () => { try { localStorage.setItem('explorer-filter', f.value); } catch {} });
  apply();
</script>`;

const file = path.join(OUT, 'index.html');
await writeFile(file, page);
console.log(`${cards.length} buildings → ${path.relative(process.cwd(), file)} (${(page.length / 1e6).toFixed(1)} MB)`);
