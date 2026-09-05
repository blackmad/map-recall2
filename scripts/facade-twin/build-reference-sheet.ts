/**
 * A contact sheet of rectified façades with a metre grid drawn over them.
 *
 * Built to be *looked at*. Every heuristic about canal-house geometry in this
 * project should come from reading real façades at a known scale rather than
 * from what one imagines a canal house looks like, and a rectified elevation at
 * a fixed pixels-per-metre is the one artefact where a proportion can simply be
 * read off: storey heights, window sizes, sill positions, how the ground floor
 * differs, whether bays are evenly spaced.
 *
 * The grid is the point. Horizontal lines every metre, heavier every five, so a
 * storey height is counted rather than guessed.
 *
 * Usage: npx tsx scripts/facade-twin/build-reference-sheet.ts --count=12
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { MassingRecord, PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const COUNT = Number(arg('count') ?? 12);
const PPM = 26;                       // enough to read a sill, small enough to tile
const TILE_H_M = 20;                  // metres of façade height per tile

interface Measured {
  pandId: string; panoramaId: string; standoffM: number; obliquityDeg: number;
  wall: [number, number, number, number]; wallWidthM: number;
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
}

const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')) as { facades: Record<string, Measured> };
const views = JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];
const viewById = new Map(views.map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));
const years = new Map<string, number | null>(recon.buildings.map((b: any) => [b.buildingId, b.constructionYear]));

/**
 * Pick a spread, not the best.
 *
 * A sheet of twelve near-identical five-metre fronts teaches nothing about the
 * range the detector has to cope with, so the sample is stratified by plot
 * width and prefers square-on close views within each band.
 */
const candidates = Object.values(store.facades)
  .filter(f => f.obliquityDeg < 12 && f.standoffM < 40 && f.wallWidthM >= 3.5 && f.wallWidthM <= 14
    && massing.get(f.pandId)?.eavesHeight != null && massing.get(f.pandId)?.groundLevel != null);
const bands: Measured[][] = [[], [], [], []];
for (const f of candidates) {
  const i = f.wallWidthM < 5 ? 0 : f.wallWidthM < 6.5 ? 1 : f.wallWidthM < 9 ? 2 : 3;
  bands[i].push(f);
}
for (const band of bands) band.sort((a, b) => a.obliquityDeg - b.obliquityDeg);
const chosen: Measured[] = [];
for (let i = 0; chosen.length < COUNT; i++) {
  let added = false;
  for (const band of bands) if (band[i] && chosen.length < COUNT) { chosen.push(band[i]); added = true; }
  if (!added) break;
}
console.log(`${candidates.length} square-on candidates; sampling ${chosen.length} across four width bands`);

const images = new Map<string, { width: number; height: number; data: Uint8ClampedArray }>();
async function panorama(view: PanoramaView) {
  if (images.has(view.panoramaId)) return images.get(view.panoramaId)!;
  const bytes = await readFile(path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`));
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const image = { width: decoded.width, height: decoded.height, data: Uint8ClampedArray.from(decoded.data) };
  images.set(view.panoramaId, image);
  return image;
}

const tiles: Array<{ pandId: string; widthPx: number; data: Uint8ClampedArray; widthM: number; year: number | null }> = [];
const tileH = Math.round(TILE_H_M * PPM);
for (const f of chosen) {
  const view = viewById.get(f.panoramaId);
  if (!view) continue;
  const mass = massing.get(f.pandId)!;
  const point = RD_NEW.fromLngLat(view.lngLat);
  const image = await panorama(view);
  const rect = rectifyFacade(image, {
    x: point.x, y: point.y, z: view.cameraHeight - GEOID_SEPARATION_M,
    headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
  }, {
    start: { x: f.wall[0], y: f.wall[1] }, end: { x: f.wall[2], y: f.wall[3] },
    baseZ: mass.groundLevel! - 1, topZ: mass.groundLevel! - 1 + TILE_H_M,
  }, { pixelsPerMetre: PPM, camera: AMSTERDAM_CAMERA });
  tiles.push({ pandId: f.pandId, widthPx: rect.width, data: rect.data, widthM: f.wallWidthM, year: years.get(f.pandId) ?? null });
}

const GAP = 10;
const sheetW = tiles.reduce((s, t) => s + t.widthPx + GAP, GAP);
const sheet = new Uint8ClampedArray(sheetW * tileH * 4).fill(24);
for (let i = 3; i < sheet.length; i += 4) sheet[i] = 255;

let x0 = GAP;
for (const tile of tiles) {
  for (let y = 0; y < tileH; y++) {
    for (let x = 0; x < tile.widthPx; x++) {
      const src = (y * tile.widthPx + x) * 4, dst = (y * sheetW + x0 + x) * 4;
      sheet[dst] = tile.data[src]; sheet[dst + 1] = tile.data[src + 1]; sheet[dst + 2] = tile.data[src + 2];
    }
  }
  // Metre grid: light every metre, bright every five, so heights are countable.
  for (let m = 0; m <= TILE_H_M; m++) {
    const y = tileH - Math.round(m * PPM);
    if (y < 0 || y >= tileH) continue;
    const heavy = m % 5 === 0;
    for (let x = 0; x < tile.widthPx; x++) {
      if (!heavy && x % 6 > 2) continue;
      const dst = (y * sheetW + x0 + x) * 4;
      sheet[dst] = heavy ? 255 : 150; sheet[dst + 1] = heavy ? 210 : 150; sheet[dst + 2] = heavy ? 0 : 150;
    }
  }
  x0 += tile.widthPx + GAP;
}

const encoded = jpeg.encode({ width: sheetW, height: tileH, data: Buffer.from(sheet) }, 92);
const OUT = path.join(CACHE, 'reference');
await mkdir(OUT, { recursive: true });
const file = path.join(OUT, 'facade-reference-sheet.jpg');
await writeFile(file, encoded.data);

console.log(`\n${tiles.length} façades, ${PPM} px/m, grid every 1 m (bright every 5 m), tile height ${TILE_H_M} m`);
for (const t of tiles) console.log(`  ${t.pandId}  ${t.widthM.toFixed(2)} m wide  ${t.year ?? '—'}`);
console.log(`\nwrote ${path.relative(process.cwd(), file)}  (${sheetW}×${tileH})`);
