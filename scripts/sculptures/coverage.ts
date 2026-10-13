// Coverage of a sculpture photo set, and whether its COLMAP poses can be
// trusted around the statue.
//
//   node --import tsx scripts/sculptures/coverage.ts dokwerker <colmap txt dir>
//
// Writes to scripts/sculptures/<id>/sources.json:
// - per photo `colmap: { registered, colour }` (colour = not a monochrome scan);
// - `registrationCheck`: the statue's feet and head, hand-labelled in a few
//   photos (labels.json, pixels of the cache copies), are triangulated from
//   the COLMAP poses. If the rays miss each other by more than a fraction of
//   the statue's height, the poses are not consistent *at the statue* (mean
//   reprojection error only says the background matched) and no splat can be
//   trained from them;
// - `coverage`: azimuth sectors of the registered cameras about the
//   triangulated statue, only when the check passes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { azimuths, estimateUp, quatToMatrix, sectorCoverage, type V3 } from '../../src/canalRecall/sculptures/coverage.js';
import { readCameras, readImages, type ColmapCamera, type ColmapImage } from './colmap.js';

const [id, txtDir] = process.argv.slice(2);
if (!id || !txtDir) throw new Error('usage: coverage.ts <id> <colmap txt dir>');
const dir = path.join('scripts/sculptures', id);
const sourcesPath = path.join(dir, 'sources.json');
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const outDir = String(sources.outDir).replace(/^~/, os.homedir());
const labels: Record<string, { feet: [number, number]; head: [number, number] }> = JSON.parse(fs.readFileSync(path.join(dir, 'labels.json'), 'utf8')).photos;

const images = await readImages(txtDir);
const cameras = readCameras(txtDir);
const up = estimateUp(images);

/** Mean max−min channel spread of a 64 px thumbnail: < 6 means a monochrome scan. */
async function chroma(file: string): Promise<number> {
  const { data, info } = await sharp(file).resize(64, 64, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < info.width * info.height; i++) sum += Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) - Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  return sum / (info.width * info.height);
}

/** World ray through a pixel (SIMPLE_RADIAL undistorted by fixed-point iteration). */
function ray(img: ColmapImage, cam: ColmapCamera, [px, py]: [number, number]): { o: V3; d: V3 } {
  const [f, cx, cy, k = 0] = cam.params;
  const xd = (px - cx) / f, yd = (py - cy) / f;
  let x = xd, y = yd;
  for (let i = 0; i < 8; i++) { const r2 = x * x + y * y; x = xd / (1 + k * r2); y = yd / (1 + k * r2); }
  const R = quatToMatrix(img.q);
  const d: V3 = [0, 1, 2].map(j => R[0][j] * x + R[1][j] * y + R[2][j]) as V3;
  const l = Math.hypot(...d);
  return { o: img.centre, d: d.map(v => v / l) as V3 };
}

function triangulate(rays: { o: V3; d: V3 }[]): V3 {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  for (const { o, d } of rays) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const P = (i === j ? 1 : 0) - d[i] * d[j];
    A[i][j] += P; b[i] += P * o[j];
  }
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  return [0, 1, 2].map(k => det(A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / D) as V3;
}

function miss(X: V3, { o, d }: { o: V3; d: V3 }): { miss: number; depth: number } {
  const v = [X[0] - o[0], X[1] - o[1], X[2] - o[2]];
  const depth = v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
  return { miss: Math.hypot(v[0] - depth * d[0], v[1] - depth * d[1], v[2] - depth * d[2]), depth };
}

const byName = new Map(images.map(img => [img.name, img]));
let registered = 0, registeredColour = 0;
for (const rec of sources.commons) {
  if (!rec.local) { rec.colmap = null; continue; }
  const file = path.join(outDir, rec.local);
  const colour = fs.existsSync(file) ? (await chroma(file)) >= 6 : null;
  const reg = byName.has(path.basename(rec.local));
  rec.colmap = { registered: reg, colour };
  if (reg) { registered++; if (colour) registeredColour++; }
}

const labelled = Object.entries(labels).filter(([name]) => byName.has(name));
const rays = (key: 'feet' | 'head') => labelled.map(([name, l]) => { const img = byName.get(name)!; return { name, ...ray(img, cameras.get(img.cameraId)!, l[key]) }; });
const feetRays = rays('feet'), headRays = rays('head');
const feet = triangulate(feetRays), head = triangulate(headRays);
const statueHeight = Math.abs((head[0] - feet[0]) * up[0] + (head[1] - feet[1]) * up[1] + (head[2] - feet[2]) * up[2]);
const perPhoto = labelled.map(([name], i) => {
  const f = miss(feet, feetRays[i]), h = miss(head, headRays[i]);
  return { photo: name, feetMiss: +f.miss.toFixed(3), headMiss: +h.miss.toFixed(3), feetDepth: +f.depth.toFixed(2) };
});
const misses = perPhoto.flatMap(p => [p.feetMiss, p.headMiss]).sort((a, b) => a - b);
const medianMiss = misses[misses.length >> 1];
// Plinth top to head is ~2.6 m of a ~4.2 m monument; a usable model puts the
// labelled rays within a tenth of that of each other, and in front of every camera.
const consistent = perPhoto.every(p => p.feetDepth > 0) && statueHeight > 0 && medianMiss < 0.1 * statueHeight;
sources.registrationCheck = {
  method: 'statue feet (plinth top centre) and head top hand-labelled in labels.json, rays from the COLMAP poses triangulated; miss = distance of the triangulated point from each ray, model units',
  labelledPhotos: perPhoto.length,
  triangulatedFigureHeightUnits: +statueHeight.toFixed(3),
  medianMissUnits: +medianMiss.toFixed(3),
  maxMissUnits: +misses[misses.length - 1].toFixed(3),
  pointsBehindCamera: perPhoto.filter(p => p.feetDepth <= 0).map(p => p.photo),
  consistent,
  perPhoto,
};
sources.coverage = {
  model: 'COLMAP 4.2.1 (CPU) incremental mapper, SIMPLE_RADIAL per image, the 2026-10-09 pilot run (docs/sculptures.md)',
  photos: sources.commons.length,
  admitted: sources.commons.filter((r: any) => r.local).length,
  registered, registeredColour,
  ...(consistent ? (() => {
    const az = azimuths(images, feet, up);
    const all = sectorCoverage(az, 30);
    return { azimuthSectors30deg: all.bins, widestGapDeg: all.widestGapDeg };
  })() : { azimuthSectors30deg: null, note: 'Poses are not consistent at the statue (registrationCheck), so camera azimuths about it are meaningless; see coverageByEye.' }),
};
fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 1) + '\n');
console.log(JSON.stringify({ coverage: sources.coverage, registrationCheck: { ...sources.registrationCheck, perPhoto: undefined } }, null, 1));
