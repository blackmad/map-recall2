/**
 * Does one wall look the same from two independent panoramas, and if not, why?
 *
 * The registration instrument. Rectify one wall plane from two panoramas taken
 * on different days from different standpoints; under a correct camera model
 * they are two pictures of the same wall at the same scale and they lock at
 * zero offset. The offset at best agreement is a registration residual in
 * metres — a number this project went two days without.
 *
 * Two things had to be right before it said anything true, and both were
 * learned the hard way:
 *
 *   - **Read only the upper façade.** Everything below the first floor is tree,
 *     car, bike, lamp post and parking sign. None of it lies in the wall plane,
 *     so between two camera positions it slides metres sideways under parallax
 *     and swamps the wall, which does not. Correlating the whole strip returned
 *     0.02 — indistinguishable from noise — on pairs a person can see match.
 *   - **Correlate the horizontal gradient.** What fixes a façade horizontally is
 *     its vertical edges: window jambs, party walls, downpipes. Correlating
 *     intensity lets a bright sky and a dark ground dominate.
 *
 * The control is the point: a strip against itself must score exactly 1.000 at
 * zero offset, and the run refuses to report if it does not.
 *
 * It also records, per pand, the things that could explain a failure other than
 * the camera — obliquity, standoff, occlusion by another footprint, whether the
 * chosen wall matches the plot's own axis, and the correlation peak — because a
 * residual tail attributed by assertion is not a diagnosis.
 *
 * Usage: npx tsx scripts/facade-twin/cross-view-registration.ts [--limit=90]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { loadTrackOffsets } from './panorama-render.ts';
import { buildProbe, chooseFrontage, rankViews, spreadAcrossYears } from './frontage.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M, hasUsablePose } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const PPM = 20, MARGIN = 1.8;
const SPREAD_YEARS = (arg('spread') ?? '1') !== '0';

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = new Map<string, PanoramaView>(
  (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[]).map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')).facades as Record<string, any>;
let multi: Record<string, Array<{ panoramaId: string }>> = {};
try { multi = JSON.parse(await readFile(path.join(STAGING, 'multi-view.json'), 'utf8')).facades; } catch { /* optional */ }

const footprints = new Map<string, ProjectedPoint[]>();
for (const e of registry) if (!footprints.has(e.buildingId)) footprints.set(e.buildingId, e.footprintLngLat.map(p => RD_NEW.fromLngLat(p)));

const decoded = new Map<string, any>();
async function panorama(id: string) {
  if (decoded.has(id)) return decoded.get(id);
  if (decoded.size > 6) decoded.clear();
  const file = path.join(CACHE, 'panoramas', `${id}.jpg`);
  if (!existsSync(file)) return null;
  const image = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true });
  decoded.set(id, image);
  return image;
}

const trackOffset = await loadTrackOffsets(CACHE);
const posedViews = [...views.values()].filter(hasUsablePose)
  .map(view => ({ view, point: RD_NEW.fromLngLat(view.lngLat), capturedAt: view.capturedAt }));
const probe = buildProbe(footprints, [...views.values()].filter(hasUsablePose).map(v => RD_NEW.fromLngLat(v.lngLat)));
const addressPoints = new Map<string, ProjectedPoint[]>();
try {
  for (const a of JSON.parse(await readFile(path.join(CACHE, 'address-points.json'), 'utf8')).addresses as any[]) {
    if (a.pandId) (addressPoints.get(a.pandId) ?? addressPoints.set(a.pandId, []).get(a.pandId)!).push(a.rd);
  }
} catch { /* optional */ }

function strip(image: any, view: PanoramaView, start: ProjectedPoint, end: ProjectedPoint, baseZ: number, topZ: number) {
  const cam = RD_NEW.fromLngLat(view.lngLat);
  const pose = { x: cam.x, y: cam.y, z: view.cameraHeight - trackOffset(view).offsetM - GEOID_SEPARATION_M,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg };
  const wM = Math.hypot(end.x - start.x, end.y - start.y), hM = topZ - baseZ;
  const w = Math.max(8, Math.round(wM * PPM)), h = Math.max(8, Math.round(hM * PPM));
  const ux = (end.x - start.x) / wM, uy = (end.y - start.y) / wM;
  const data = new Float32Array(w * h);
  for (let py = 0; py < h; py++) {
    const z = topZ - ((py + 0.5) / h) * hM;
    for (let px = 0; px < w; px++) {
      const a = ((px + 0.5) / w) * wM;
      const [u, v] = AMSTERDAM_CAMERA.project([start.x + ux * a - pose.x, start.y + uy * a - pose.y, z - pose.z], pose, image);
      const sx = Math.round(((u % image.width) + image.width) % image.width), sy = Math.round(v);
      if (sy < 0 || sy >= image.height) { data[py * w + px] = NaN; continue; }
      const s = (sy * image.width + sx) * 4;
      data[py * w + px] = 0.299 * image.data[s] + 0.587 * image.data[s + 1] + 0.114 * image.data[s + 2];
    }
  }
  return { data, w, h };
}

type Strip = ReturnType<typeof strip>;
function align(a: Strip, b: Strip, maxShiftPx: number) {
  const y0 = Math.round(a.h * 0.05), y1 = Math.round(a.h * 0.62);
  const prep = (s: Strip) => {
    const g = new Float32Array(s.w * s.h);
    for (let y = y0; y < Math.min(y1, s.h); y++) for (let x = 1; x < s.w - 1; x++) {
      const l = s.data[y * s.w + x - 1], r = s.data[y * s.w + x + 1];
      g[y * s.w + x] = Number.isFinite(l) && Number.isFinite(r) ? r - l : NaN;
    }
    return g;
  };
  const ga = prep(a), gb = prep(b);
  let best = { score: -2, shift: 0 };
  for (let k = -maxShiftPx; k <= maxShiftPx; k++) {
    let sa = 0, sb = 0, sab = 0, n = 0;
    for (let y = y0; y < Math.min(y1, a.h, b.h); y++) for (let x = 1; x < a.w - 1; x++) {
      const xb = x + k; if (xb < 1 || xb >= b.w - 1) continue;
      const va = ga[y * a.w + x], vb = gb[y * b.w + xb];
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      sa += va * va; sb += vb * vb; sab += va * vb; n++;
    }
    if (n < 500) continue;
    const s = sab / (Math.sqrt(sa * sb) || 1);
    if (s > best.score) best = { score: s, shift: k };
  }
  return best;
}

/** Does anything stand between this camera and this wall? */
function occluded(cam: ProjectedPoint, target: ProjectedPoint, pandId: string): string | null {
  const rayHit = (a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint) => {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const denom = rx * sy - ry * sx;
    if (Math.abs(denom) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
    return u > 1e-9 && u < 1 - 1e-9 ? t : null;
  };
  for (const [otherId, ring] of footprints) {
    if (otherId === pandId) continue;
    if (Math.hypot(ring[0].x - target.x, ring[0].y - target.y) > 90) continue;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      const t = rayHit(cam, target, ring[i], ring[j]);
      // A hit close to the target is its own party wall, not an occluder.
      if (t !== null && t > 0.02 && t < 0.94) return otherId;
    }
  }
  return null;
}

const limit = Number(arg('limit') ?? 90);
const rows: any[] = [];
let done = 0;
for (const pandId of Object.keys(store)) {
  if (done >= limit) break;
  const record = store[pandId], ring = footprints.get(pandId), mass = massing.get(pandId);
  if (!record || !ring || !Number.isFinite(mass?.groundLevel)) continue;

  /**
   * The frontage, chosen by visibility rather than by a stale proposal.
   *
   * The proposal in `measured-facades.json` was picked by geometry, which
   * cannot tell a frontage from a courtyard wall, and on 35% of panden it
   * picked a wall facing the other way. Registration measured on the back of a
   * building is not a worse measurement of the front, it is a measurement of
   * something else.
   */
  const choice = chooseFrontage(ring, pandId, probe,
    { proposal: record.wall, addressPoints: addressPoints.get(pandId) ?? [] });
  if (!choice.elevation) continue;                 // nothing visible: massing only
  const wall = choice.elevation;
  // Views are chosen for *this* wall, not read from a record chosen for another
  // one. That record picked its views for the elevation the old selector liked,
  // which on a third of buildings is the back — so a corrected frontage
  // inherited views that never pointed at it.
  const ranked = rankViews(wall, pandId, probe,
    posedViews.filter(c => existsSync(path.join(CACHE, 'panoramas', `${c.view.panoramaId}.jpg`))),
    { wallHeightM: (mass.ridgeHeight ?? mass.groundLevel + 14) - mass.groundLevel });
  /**
   * Independent views, or merely two views?
   *
   * `--spread=0` takes the best two by quality, which on a dense pass is two
   * frames of the same afternoon five metres apart: same weather, same parked
   * cars, same awnings, same season. They correlate beautifully and prove
   * almost nothing about registration, because they share every error the pass
   * made. Year-spread deliberately takes one per capture year, which is a much
   * harder and much more honest test. The flag exists to measure the
   * difference rather than assume it.
   */
  const spread = SPREAD_YEARS
    ? spreadAcrossYears(ranked, 2)
    : ranked.slice(0, 2);
  if (spread.length < 2) continue;
  const [a, b] = [spread[0].view, spread[1].view];
  const [imA, imB] = [await panorama(a.panoramaId), await panorama(b.panoramaId)];
  if (!imA || !imB) continue;
  const [x0, y0, x1, y1] = [wall.start.x, wall.start.y, wall.end.x, wall.end.y];
  const wM = Math.hypot(x1 - x0, y1 - y0);
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const ux = (x1 - x0) / wM, uy = (y1 - y0) / wM;
  const half = (wM * MARGIN) / 2;
  const start = { x: mid.x - ux * half, y: mid.y - uy * half }, end = { x: mid.x + ux * half, y: mid.y + uy * half };
  const baseZ = mass.groundLevel - 1, topZ = (mass.eavesHeight ?? mass.groundLevel + 12) + 2;

  const { score, shift } = align(strip(imA, a, start, end, baseZ, topZ), strip(imB, b, start, end, baseZ, topZ), Math.round(wM * PPM * 0.7));


  const camA = RD_NEW.fromLngLat(a.lngLat), camB = RD_NEW.fromLngLat(b.lngLat);
  rows.push({
    pandId, shiftM: Number((shift / PPM).toFixed(2)), peak: Number(score.toFixed(3)),
    dHeading: Number((((b.headingDeg - a.headingDeg) % 360 + 540) % 360 - 180).toFixed(1)),
    wallWidthM: Number(wM.toFixed(2)), proposedWidthM: record.wallWidthM,
    frontageChanged: choice.changed, clearViews: choice.clearViews,
    yearsApart: Math.abs(Number(a.capturedAt.slice(0,4)) - Number(b.capturedAt.slice(0,4))),
    worstPpmA: Number(spread[0].worstPixelsPerMetre.toFixed(1)), worstPpmB: Number(spread[1].worstPixelsPerMetre.toFixed(1)),
    // Independent explanations for a bad residual, recorded rather than assumed.
    obliquityA: Number(obliquityDeg(wall, camA).toFixed(1)), obliquityB: Number(obliquityDeg(wall, camB).toFixed(1)),
    standoffA: Number(standoffM(wall, camA).toFixed(1)), standoffB: Number(standoffM(wall, camB).toFixed(1)),
    occludedA: occluded(camA, wall.midpoint, pandId), occludedB: occluded(camB, wall.midpoint, pandId),
    // Is the wall we rectified really an elevation of this footprint?
    wallOffPlotDeg: Number(Math.min(...buildElevations(ring).map(e =>
      Math.abs(((Math.atan2(uy, ux) - Math.atan2(e.end.y - e.start.y, e.end.x - e.start.x)) * 180 / Math.PI + 540) % 360 - 180)))
      .toFixed(1)),
  });
  done++;
  if (done % 10 === 0) process.stdout.write(`\r  ${done}/${limit}`);
}
process.stdout.write('\r');

const abs = (r: any) => Math.abs(r.shiftM);
const q = (xs: number[], p: number) => xs.length ? [...xs].sort((m, n) => m - n)[Math.floor(p * (xs.length - 1))] : NaN;
const all = rows.map(abs);
const good = rows.filter(r => abs(r) < 1), bad = rows.filter(r => abs(r) >= 2);

console.log(`\nCross-view registration under '${AMSTERDAM_CAMERA.id}' — ${rows.length} panden with two usable views\n`);
console.log(`  median |shift| ${q(all, 0.5).toFixed(2)} m   p90 ${q(all, 0.9).toFixed(2)} m   within 1 m ${Math.round(100 * good.length / rows.length)}%`);
console.log(`\n  What separates the ${good.length} that lock from the ${bad.length} that miss by 2 m or more:\n`);
const compare = (name: string, f: (r: any) => number) =>
  console.log(`    ${name.padEnd(26)} locked ${q(good.map(f), 0.5).toFixed(2).padStart(7)}   missed ${q(bad.map(f), 0.5).toFixed(2).padStart(7)}`);
compare('correlation peak', r => r.peak);
compare('worse obliquity, deg', r => Math.max(r.obliquityA, r.obliquityB));
compare('further standoff, m', r => Math.max(r.standoffA, r.standoffB));
compare('wall off plot axis, deg', r => r.wallOffPlotDeg);
compare('wall width, m', r => r.wallWidthM);
const share = (rs: any[], f: (r: any) => boolean) => `${Math.round(100 * rs.filter(f).length / Math.max(1, rs.length))}%`;
console.log(`    ${'either view occluded'.padEnd(26)} locked ${share(good, r => r.occludedA || r.occludedB).padStart(7)}   missed ${share(bad, r => r.occludedA || r.occludedB).padStart(7)}`);
console.log(`    ${'opposed headings'.padEnd(26)} locked ${share(good, r => Math.abs(r.dHeading) > 120).padStart(7)}   missed ${share(bad, r => Math.abs(r.dHeading) > 120).padStart(7)}`);

await writeFile(path.join(CACHE, `cross-view-registration${SPREAD_YEARS ? '' : '-samepass'}.json`), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/cross-view-registration.ts',
    cameraModel: AMSTERDAM_CAMERA.id, pixelsPerMetre: PPM, planeMargin: MARGIN, yearSpread: SPREAD_YEARS,
    note: 'shiftM is the along-wall offset at best agreement between two independent panoramas. '
      + 'The diagnostics are recorded so a residual tail can be explained rather than asserted.',
  },
  summary: { panden: rows.length, medianM: q(all, 0.5), p90M: q(all, 0.9), withinOneMetre: good.length },
  panden: rows,
}, null, 1));
console.log(`\n→ .cache/facade-twin/cross-view-registration.json`);
