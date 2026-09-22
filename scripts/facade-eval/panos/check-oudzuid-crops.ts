/**
 * Verifier for task 2 (Oud-Zuid façade crops).
 *
 * Checks that every well-scanned wall in the published point-cloud manifests is
 * accounted for exactly once, that every crop exists with the sha256 recorded in
 * the manifest, and that every crop's panorama bytes still hash to the recorded
 * sha256. Exits non-zero on any failure so it can sit in a gate later.
 *
 * Run: npx tsx scripts/facade-eval/panos/check-oudzuid-crops.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const OUT = path.resolve(process.argv.find((v) => v.startsWith('--out='))?.slice(6) ?? '.cache/facade-eval/oudzuid');
const TILES = [
  { id: 'museumkwartier', manifest: 'public/data/pointcloud-facades/v1/museumkwartier/manifest.json' },
  { id: 'willemspark', manifest: 'public/data/pointcloud-facades/v1/willemspark/manifest.json' },
] as const;

const sha256 = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (!ok) failures.push(message);
};

const expected = new Set<string>();
for (const tile of TILES) {
  const manifest = await readJson(path.resolve(tile.manifest));
  for (const wall of manifest.walls) expected.add(`${tile.id}:${wall.surfaceId}`);
}

const output = await readJson(path.join(OUT, 'manifest.json'));
const pixelsPerMetre = output.render?.pixelsPerMetre ?? 45;
const maxPixels = output.render?.maxPixels ?? 1_400_000;
const seen = new Map<string, 'crop' | 'omitted'>();
for (const record of output.walls) {
  const id = `${record.tile}:${record.surfaceId}`;
  check(!seen.has(id), `duplicate record for ${id}`);
  seen.set(id, 'crop');
  for (const field of ['buildingId', 'wallWidthM', 'wallHeightM', 'panoramaId', 'panoramaDate', 'panoUrl', 'panoSha256', 'pose', 'plane', 'publishedFrame', 'standoff', 'obliquity', 'pixelsPerMetre', 'crop', 'sourceDimensions'] as const) {
    check(record[field] !== undefined && record[field] !== null, `${id}: missing ${field}`);
  }
  const { origin, u, baseUp, wallTop } = record.publishedFrame ?? {};
  const half = record.wallWidthM / 2;
  const close = (a: number, b: number) => Math.abs(a - b) < 5e-3;
  check(Boolean(origin && u), `${id}: publishedFrame origin/u missing`);
  if (origin && u) {
    check(close(record.plane.start.x, origin[0] + u[0] * -half) && close(record.plane.start.y, origin[1] + u[1] * -half), `${id}: plane.start is not origin + u*(-width/2)`);
    check(close(record.plane.end.x, origin[0] + u[0] * half) && close(record.plane.end.y, origin[1] + u[1] * half), `${id}: plane.end is not origin + u*(+width/2)`);
    check(close(record.plane.baseZ, origin[2] + baseUp), `${id}: baseZ is not origin.z + baseUp`);
    check(close(record.plane.topZ, origin[2] + wallTop), `${id}: topZ is not origin.z + wallTop`);
  }
  const scale = Math.min(pixelsPerMetre, Math.sqrt(maxPixels / (record.wallWidthM * record.wallHeightM)));
  check(Math.abs(record.crop.width - Math.round(record.wallWidthM * scale)) <= 1, `${id}: crop width does not match wallWidthM * px/m`);
  check(Math.abs(record.crop.height - Math.round(record.wallHeightM * scale)) <= 1, `${id}: crop height does not match wallHeightM * px/m`);
  check(record.pose?.headingDeg === 0 && record.pose?.pitchDeg === 0 && record.pose?.rollDeg === 0, `${id}: pose must be world-aligned (heading/pitch/roll = 0)`);
  check(record.sourceDimensions?.[0] === 8000 && record.sourceDimensions?.[1] === 4000, `${id}: sourceDimensions not 8000x4000`);
  const cropPath = path.join(OUT, record.crop.file);
  try {
    const bytes = await fs.readFile(cropPath);
    check(sha256(bytes) === record.crop.sha256, `${id}: crop sha256 mismatch`);
    check(bytes.length > 0, `${id}: crop empty`);
  } catch {
    failures.push(`${id}: crop file missing ${record.crop.file}`);
  }
  const panoFile = path.join(OUT, 'panoramas', `${record.panoramaId}.jpg`);
  const sidecar = await readJson(path.join(OUT, 'panoramas', `${record.panoramaId}.json`));
  try {
    check(sha256(await fs.readFile(panoFile)) === record.panoSha256, `${id}: cached panorama sha256 mismatch`);
  } catch {
    failures.push(`${id}: cached panorama missing ${record.panoramaId}.jpg`);
  }
  check(sidecar.url === record.panoUrl, `${id}: panorama sidecar url mismatch`);
  check(sidecar.sha256 === record.panoSha256, `${id}: panorama sidecar sha256 mismatch`);
}
for (const record of output.omitted) {
  const id = `${record.tile}:${record.surfaceId}`;
  check(!seen.has(id), `duplicate record for ${id}`);
  seen.set(id, 'omitted');
  check(typeof record.reason === 'string' && record.reason.length > 0, `${id}: omission needs a reason`);
}
for (const id of expected) check(seen.has(id), `well-scanned wall not accounted for: ${id}`);
for (const id of seen.keys()) check(expected.has(id), `record for a wall that is not in the published walls[]: ${id}`);

const cropped = output.walls.length;
const omitted = output.omitted.length;
const reasons = (output.omitted as any[]).reduce<Record<string, number>>((counts: Record<string, number>, record: any) => {
  const reason = String(record.reason).split(':')[0];
  counts[reason] = (counts[reason] ?? 0) + 1;
  return counts;
}, {});

console.log(`expected ${expected.size} well-scanned walls; manifest has ${cropped} crops + ${omitted} omissions`);
if (omitted) console.log(`omission reasons: ${JSON.stringify(reasons)}`);
if (output.summary) console.log(`panorama date range: ${JSON.stringify(output.summary.panoramaDateRange)}`);
if (failures.length) {
  console.error(`FAIL (${failures.length}):\n${failures.map((entry) => `  - ${entry}`).join('\n')}`);
  process.exit(1);
}
console.log('OK: every well-scanned wall is cropped or has a recorded omission, and every hash matches');
