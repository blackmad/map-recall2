/**
 * One wall, one plane, one view per capture campaign.
 *
 * The settling experiment for the pose question. Three views of one pand showed
 * two panoramas from 2023 agreeing with each other and one from 2021 agreeing
 * with neither, which suggests the convention for reading a published pose
 * differs between campaigns. Three views cannot tell a per-campaign constant
 * from per-panorama noise; eight campaigns can.
 *
 * The plane is held fixed and widened, so every render is the same 120 metres
 * of canal at the same scale. If the images fall into groups that agree within
 * a campaign and disagree between them, the correction is a constant per
 * campaign and the shift between groups — at a known standoff — is a heading
 * offset in degrees. If they scatter individually, the error is per panorama
 * and no amount of grouping will fix it.
 *
 * Two views per year, not one, because a year that disagrees with itself is the
 * answer as much as a year that disagrees with another.
 *
 * Usage: npx tsx scripts/facade-twin/campaign-test.ts --id=<pandId>
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { buildElevations, inFrontOf, obliquityDeg, standoffM } from '../../src/canalRecall/facade/elevations.ts';
import { STRIP_BASE_BELOW_GROUND_M } from '../../src/canalRecall/facade/measure.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { hasUsablePose, AMSTERDAM_YAW_CONVENTION, GEOID_SEPARATION_M, isLeafOff } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { LngLat, PanoramaView, ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.join(CACHE, 'campaign-test');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const PAND = arg('id') ?? '0363100012176586';
const MARGIN = Number(arg('margin') ?? 9);
const PER_YEAR = Number(arg('perYear') ?? 2);
const BUDGET = Number(arg('downloads') ?? 40);

const registry = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-registry.json`), 'utf8')).data as
  Array<{ buildingId: string; footprintLngLat: LngLat[] }>;
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, any>(recon.massing.map((m: any) => [m.buildingId, m]));
const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')).facades as Record<string, any>;

const ring = registry.find(e => e.buildingId === PAND)?.footprintLngLat.map(p => RD_NEW.fromLngLat(p));
const record = store[PAND];
const mass = massing.get(PAND);
if (!ring || !record || !mass?.groundLevel) throw new Error(`no data for ${PAND}`);

const [x0, y0, x1, y1] = record.wall;
const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
const wall = buildElevations(ring)
  .map(e => ({ e, d: Math.hypot(e.midpoint.x - mid.x, e.midpoint.y - mid.y) }))
  .sort((a, b) => a.d - b.d)[0].e;

const posed = views.filter(v => isLeafOff(v.capturedAt) && hasUsablePose(v))
  .map(v => ({ v, p: RD_NEW.fromLngLat(v.lngLat) }));

// Best two views per capture year, so a campaign can be seen disagreeing with
// itself as well as with another.
const byYear = new Map<string, Array<{ v: PanoramaView; p: ProjectedPoint; standoff: number; obliquity: number }>>();
for (const q of posed) {
  if (Math.abs(q.p.x - wall.midpoint.x) > 55 || Math.abs(q.p.y - wall.midpoint.y) > 55) continue;
  if (!inFrontOf(wall, q.p)) continue;
  const standoff = standoffM(wall, q.p), obliquity = obliquityDeg(wall, q.p);
  if (standoff < Math.max(8, wall.lengthM * 1.2) || standoff > 45 || obliquity > 22) continue;
  const year = q.v.capturedAt.slice(0, 4);
  const list = byYear.get(year) ?? [];
  list.push({ ...q, standoff, obliquity });
  byYear.set(year, list);
}

const half = (wall.lengthM * MARGIN) / 2;
const ux = (x1 - x0) / wall.lengthM, uy = (y1 - y0) / wall.lengthM;
const start = { x: mid.x - ux * half, y: mid.y - uy * half };
const end = { x: mid.x + ux * half, y: mid.y + uy * half };

await mkdir(path.join(OUT, PAND), { recursive: true });
let downloads = 0;
const rendered: any[] = [];
for (const year of [...byYear.keys()].sort()) {
  const picks = byYear.get(year)!.sort((a, b) => a.obliquity - b.obliquity).slice(0, PER_YEAR);
  for (const [i, pick] of picks.entries()) {
    const file = path.join(CACHE, 'panoramas', `${pick.v.panoramaId}.jpg`);
    let bytes: Buffer;
    try { bytes = await readFile(file); } catch {
      if (downloads >= BUDGET) continue;
      downloads++;
      try {
        const response = await fetch(pick.v.imageUrl, {
          headers: { 'User-Agent': 'MapRecallFacadeTwin/1.0' }, signal: AbortSignal.timeout(120_000) });
        if (!response.ok) continue;
        bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(file, bytes);
      } catch { continue; }
    }
    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    const rect = rectifyFacade({ width: image.width, height: image.height, data: image.data },
      { x: pick.p.x, y: pick.p.y, z: pick.v.cameraHeight - GEOID_SEPARATION_M,
        headingDeg: pick.v.headingDeg, pitchDeg: pick.v.pitchDeg, rollDeg: pick.v.rollDeg },
      { start, end, baseZ: mass.groundLevel - STRIP_BASE_BELOW_GROUND_M,
        topZ: (mass.eavesHeight ?? mass.groundLevel + 12) + 0.3 },
      // One scale for every render, so a shift between them is metres.
      { pixelsPerMetre: 14, yaw: AMSTERDAM_YAW_CONVENTION, maxPixels: 30e6 });
    const name = `${year}-${i}.jpg`;
    await writeFile(path.join(OUT, PAND, name),
      jpeg.encode({ width: rect.width, height: rect.height, data: Buffer.from(rect.data) }, 86).data);
    rendered.push({
      file: `${PAND}/${name}`, year,
      panoramaId: pick.v.panoramaId,
      rig: String(pick.v.panoramaId).split('_')[0].replace(/-\d+$/, ''),
      missionYear: (pick.v as any).missionYear ?? null,
      capturedAt: pick.v.capturedAt.slice(0, 10),
      standoffM: Number(pick.standoff.toFixed(1)),
      obliquityDeg: Number(pick.obliquity.toFixed(1)),
      cameraHeight: Number(pick.v.cameraHeight.toFixed(2)),
      pitchDeg: Number(pick.v.pitchDeg.toFixed(2)),
      rollDeg: Number(pick.v.rollDeg.toFixed(2)),
      width: rect.width, height: rect.height,
    });
    process.stdout.write(`\r  ${rendered.length} rendered, ${downloads} fetched`);
  }
}
process.stdout.write('\n');

await writeFile(path.join(STAGING, 'campaign-test.json'), JSON.stringify({
  metadata: {
    pandId: PAND, wallWidthM: Number(wall.lengthM.toFixed(2)),
    planeWidthM: Number((wall.lengthM * MARGIN).toFixed(1)),
    pixelsPerMetre: 14,
    generator: 'scripts/facade-twin/campaign-test.ts',
    note: 'One wall plane, widened, rendered from panoramas across every capture campaign at one '
      + 'shared scale. Grouping in the result means the pose correction is per campaign.',
    stripDirectory: '.cache/facade-twin/campaign-test',
  },
  renders: rendered,
}, null, 1));
console.log(`${rendered.length} renders of pand ${PAND}, wall ${wall.lengthM.toFixed(2)} m, plane ${(wall.lengthM * MARGIN).toFixed(0)} m`);
console.log(`years: ${[...byYear.keys()].sort().join(', ')}`);
