/**
 * Freeze the measured half of the façade-model gold set.
 *
 * The point cloud measures openings as geometry: recesses behind the wall
 * plane, in metres, with no perspective. Lane P rectified a photograph of every
 * well-scanned wall onto the same 3DBAG wall plane, so the two live in one
 * wall-metric frame. This joins them and writes the frozen gold set the model
 * scorer reads.
 *
 * Wall metres: `along` is metres from the wall's `plane.start` end; `up` is
 * metres above `plane.baseZ`. That is the frame the rectified crops use and the
 * frame lanes A and B emit their boxes in.
 *
 * Usage: npx tsx scripts/facade-eval/build-gold-set.ts [--out=<dir>]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

type Vec3 = readonly [number, number, number];

interface Plane {
  start: { x: number; y: number };
  end: { x: number; y: number };
  baseZ: number;
  topZ: number;
}

interface PanoWall {
  tile: string;
  buildingId: string;
  surfaceId: string;
  group: string;
  wallWidthM: number;
  wallHeightM: number;
  plane: Plane;
  crop: string;
  pixelsPerMetre: number;
  standoff: number;
  obliquity: number;
  panoramaId: string;
  panoramaDate: string;
}

interface PublishedWall {
  group: string;
  buildingId: string;
  width: number;
  height: number;
  frame: { origin: Vec3; u: Vec3; v: Vec3; n: Vec3; baseUp: number; wallTop: number };
  openingRects: Array<{ along: number; up: number; width: number; height: number }>;
}

export interface GoldOpening {
  along: number;
  up: number;
  width: number;
  height: number;
}

export interface GoldWall {
  tile: string;
  buildingId: string;
  surfaceId: string;
  group: string;
  wallWidthM: number;
  wallHeightM: number;
  plane: Plane;
  crop: string;
  pixelsPerMetre: number;
  standoff: number;
  obliquity: number;
  panoramaId: string;
  panoramaDate: string;
  openings: GoldOpening[];
  /** Filled in by the human spot-check; walls marked false are dropped. */
  spotCheck: 'pending' | 'accepted' | 'rejected';
}

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outDir = path.resolve(argument('out') || 'review-data/facade-model-gold/v1');
const panoManifestPath = path.resolve(argument('panos') || '.cache/facade-eval/oudzuid/manifest.json');
const publishedRoot = path.resolve(argument('published') || 'public/data/pointcloud-facades/v1');

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

const pano = JSON.parse(await readFile(panoManifestPath, 'utf8')) as { walls: PanoWall[] };
const published: PublishedWall[] = [];
for (const tile of ['museumkwartier', 'willemspark']) {
  const manifest = JSON.parse(await readFile(path.join(publishedRoot, tile, 'manifest.json'), 'utf8')) as { walls: PublishedWall[] };
  published.push(...manifest.walls);
}
const byGroup = new Map(published.map((wall) => [wall.group, wall]));

const walls: GoldWall[] = [];
const dropped: Array<{ group: string; reason: string }> = [];
for (const wall of pano.walls) {
  const source = byGroup.get(wall.group);
  if (!source) { dropped.push({ group: wall.group, reason: 'no published wall with this group' }); continue; }
  // Convert the measured openings from the published raster frame into the crop
  // frame. The crop's horizontal axis runs plane.start -> plane.end, which is
  // mirrored relative to the published +u for some walls, so project the opening
  // corners onto the crop axis rather than assuming an orientation.
  const u = source.frame.u;
  const origin = source.frame.origin;
  const cropLengthM = Math.hypot(wall.plane.end.x - wall.plane.start.x, wall.plane.end.y - wall.plane.start.y) || 1;
  const cropU: Vec3 = [(wall.plane.end.x - wall.plane.start.x) / cropLengthM, (wall.plane.end.y - wall.plane.start.y) / cropLengthM, 0];
  const openings: GoldOpening[] = [];
  for (const rect of source.openingRects) {
    // The published rect is centroid-relative along +u (`along` can be negative);
    // project both corners onto the crop axis so a mirrored crop is handled.
    const cornerA: Vec3 = [origin[0] + u[0] * rect.along, origin[1] + u[1] * rect.along, origin[2] + rect.up];
    const cornerB: Vec3 = [origin[0] + u[0] * (rect.along + rect.width), origin[1] + u[1] * (rect.along + rect.width), origin[2] + rect.up];
    const alongA = dot(sub(cornerA, [wall.plane.start.x, wall.plane.start.y, 0]), cropU);
    const alongB = dot(sub(cornerB, [wall.plane.start.x, wall.plane.start.y, 0]), cropU);
    const along = Math.min(alongA, alongB);
    const up = cornerA[2] - wall.plane.baseZ;
    openings.push({ along, up, width: Math.abs(alongB - alongA), height: rect.height });
  }
  // Drop anything that does not land inside the crop; a box outside the frame
  // cannot be scored against a model that never saw it.
  const inside = openings.filter((o) => o.along >= -0.05 && o.up >= -0.05 && o.along + o.width <= wall.wallWidthM + 0.05 && o.up + o.height <= wall.wallHeightM + 0.05);
  const outside = openings.length - inside.length;
  walls.push({
    tile: wall.tile,
    buildingId: wall.buildingId,
    surfaceId: wall.surfaceId,
    group: wall.group,
    wallWidthM: wall.wallWidthM,
    wallHeightM: wall.wallHeightM,
    plane: wall.plane,
    crop: wall.crop,
    pixelsPerMetre: wall.pixelsPerMetre,
    standoff: wall.standoff,
    obliquity: wall.obliquity,
    panoramaId: wall.panoramaId,
    panoramaDate: wall.panoramaDate,
    openings: inside,
    spotCheck: 'pending',
  });
  if (outside) dropped.push({ group: wall.group, reason: `${outside} opening(s) fell outside the crop frame` });
}

const totalOpenings = walls.reduce((sum, wall) => sum + wall.openings.length, 0);
const payload = {
  schemaVersion: 1,
  kind: 'facade-model-gold/measured',
  generatedAt: new Date().toISOString(),
  frame: 'along = metres from plane.start; up = metres above plane.baseZ',
  source: {
    crops: panoManifestPath,
    openings: `${publishedRoot}/*/manifest.json walls[].openingRects`,
    note: 'openings are point-cloud measurements (recesses behind the wall plane), not model predictions',
  },
  counts: { walls: walls.length, openings: totalOpenings, dropped: dropped.length },
  walls,
  dropped,
};
const text = `${JSON.stringify(payload, null, 2)}\n`;
const sha256 = createHash('sha256').update(text).digest('hex');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'measured.json'), text);
await writeFile(path.join(outDir, 'measured.sha256'), `${sha256}\n`);

process.stdout.write([
  `gold set (measured): ${walls.length} walls, ${totalOpenings} measured openings`,
  `dropped ${dropped.length}: ${dropped.slice(0, 4).map((d) => d.reason).join('; ') || 'none'}`,
  `sha256 ${sha256}`,
  `wrote ${path.join(outDir, 'measured.json')}`,
].join('\n') + '\n');
