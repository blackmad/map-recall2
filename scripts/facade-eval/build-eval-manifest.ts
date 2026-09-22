/**
 * Emit an evidence-shaped manifest over the Oud-Zuid gold walls so the model
 * lanes can consume them.
 *
 * The model adapters read `<manifestDir>/images/<file>` and take pose/plane from
 * `records[].images.full`. Lane P produced the crops in its own manifest shape,
 * so this projects it into the shape the adapters expect and copies the crops
 * alongside. The gold set is the source of truth for which walls are in scope.
 *
 * Usage: npx tsx scripts/facade-eval/build-eval-manifest.ts [--out=<dir>]
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Vec3 = readonly [number, number, number];
interface PanoWall {
  buildingId: string; surfaceId: string; group: string;
  wallWidthM: number; wallHeightM: number;
  plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number };
  crop: { file: string; sha256: string; width: number; height: number };
  pixelsPerMetre: number; standoff: number; obliquity: number;
  panoramaId: string; panoramaDate: string; panoUrl: string;
  pose: { x: number; y: number; z: number; headingDeg: number; pitchDeg: number; rollDeg: number };
  sourceDimensions: readonly [number, number];
}
interface GoldWall { group: string }

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const panoDir = path.resolve(argument('panos') || '.cache/facade-eval/oudzuid');
const goldPath = path.resolve(argument('gold') || 'review-data/facade-model-gold/v1/measured.json');
const outDir = path.resolve(argument('out') || '.cache/facade-eval/oudzuid-eval');

const pano = JSON.parse(await readFile(path.join(panoDir, 'manifest.json'), 'utf8')) as { walls: PanoWall[] };
const gold = JSON.parse(await readFile(goldPath, 'utf8')) as { walls: GoldWall[] };
const inScope = new Set(gold.walls.map((wall) => wall.group));

await mkdir(path.join(outDir, 'images'), { recursive: true });
const records = [];
for (const wall of pano.walls) {
  if (!inScope.has(wall.group)) continue;
  const file = `${wall.group}.jpg`;
  await copyFile(path.join(panoDir, wall.crop.file), path.join(outDir, 'images', file));
  records.push({
    id: wall.group,
    buildingId: wall.buildingId,
    elevationId: wall.surfaceId,
    wallWidthM: wall.wallWidthM,
    height: wall.wallHeightM,
    images: {
      full: {
        file,
        sha256: wall.crop.sha256,
        width: wall.crop.width,
        height: wall.crop.height,
        pose: wall.pose,
        plane: wall.plane,
        standoff: wall.standoff,
        obliquity: wall.obliquity,
        panoramaId: wall.panoramaId,
        date: wall.panoramaDate,
        url: wall.panoUrl,
        sourceDimensions: wall.sourceDimensions,
      },
    },
  });
}

const manifest = {
  version: 'facade-model-eval/1',
  generatedAt: new Date().toISOString(),
  note: 'Oud-Zuid gold walls, evidence-shaped for the model adapters; source is the point-cloud-measured gold set',
  camera: { id: 'amsterdam-world-aligned/v1', usesOrientation: false, yaw: 'centre' },
  records,
  omitted: [],
};
await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`eval manifest: ${records.length} walls -> ${path.join(outDir, 'manifest.json')}\n`);
