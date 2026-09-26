/**
 * Shared R0/R1 crop preparation for the façade model evaluation lanes.
 *
 * The lanes must not each invent their own crop generation: `evalCrop.ts` fixes
 * the R0/R1 scale and the tile geometry, and this runner turns a selection into
 * the images and `frame.json` files both Python adapters read. It is pure
 * bookkeeping plus JPEG I/O — every geometric decision comes from `evalCrop.ts`.
 *
 * Run with:
 *   npx tsx scripts/facade-eval/prepare-crops.ts --selection=<file> [options]
 *
 * See `--help` for the selection shape and the output layout.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import {
  planTiles,
  renderR1,
  resolveR0,
  type CropFrame,
  type FacadeWallEvidence,
  type Tile,
  type TileGrid,
} from '../../src/canalRecall/facade/evalCrop.ts';
import type { EquirectangularImage } from '../../src/canalRecall/facade/rectify.ts';

const DEFAULT_OUT = '.cache/facade-eval/crops/v1';
const DEFAULT_TILE_SIZE = 768;
const DEFAULT_OVERLAP = 0.15;
const DEFAULT_QUALITY = 90;
/** Decoded 8000×4000 panoramas are ~128 MB each; keep only a small reuse window. */
const PANO_CACHE_LIMIT = 3;

interface SelectionRecord {
  buildingId: string;
  elevationId: string;
  evidenceDir?: string;
  sourcePanorama?: string;
  images?: { full?: FacadeWallEvidence };
  full?: FacadeWallEvidence;
}

interface FrameTile extends Tile {
  /** Path to the tile image, relative to the output root. */
  cropFile: string;
}

interface FrameJson {
  buildingId: string;
  elevationId: string;
  setting: 'R0' | 'R1';
  cropFile: string;
  widthPx: number;
  heightPx: number;
  pixelsPerMetre: number;
  wallWidthM: number;
  wallHeightM: number;
  baseZ: number;
  topZ: number;
  tileGrid?: Omit<TileGrid, 'tiles'> & { tiles: FrameTile[] };
}

interface Omission {
  elevationId: string;
  setting: 'R0' | 'R1';
  reason: string;
}

const arg = (name: string, fallback: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

const flag = (name: string) => process.argv.includes(`--${name}`);

function printHelp(): void {
  process.stdout.write(`prepare-crops — shared R0/R1 crop generation for the façade model lanes.

Usage:
  npx tsx scripts/facade-eval/prepare-crops.ts --selection=<file> [options]

Options:
  --selection=<file>    Required. JSON selection file, shape below.
  --out=<dir>           Output root. Default ${DEFAULT_OUT}
  --evidence-dir=<dir>  Fallback for records without their own evidenceDir.
  --pano-dir=<dir>      Fallback dir holding <panoramaId>.jpg.
  --tile-size=<px>      R1 tile edge. Default ${DEFAULT_TILE_SIZE}
  --overlap=<frac>      R1 tile overlap, 0 <= f < 1. Default ${DEFAULT_OVERLAP}
  --quality=<1-100>     JPEG quality. Default ${DEFAULT_QUALITY}
  --force               Rewrite outputs that already exist.
  -h, --help            Show this help.

Selection shape (a JSON array; a { "records": [...] } wrapper is accepted too):
[
  {
    "buildingId": "0363100012154954",
    "elevationId": "0363100012154954:e:1v5ffeu",
    "evidenceDir": "/abs/path/to/.../evidence",   // optional
    "sourcePanorama": "/abs/path/<pano>.jpg",      // optional override
    "images": { "full": { ...manifest images.full... } }
  }
]
Each images.full must carry: file, width, height, pose, plane, standoff,
obliquity, panoramaId (sourceDimensions is used for documentation only). A bare
"full" key is accepted instead of "images.full". R0 needs file/width/height/
plane; R1 needs pose/plane/standoff/obliquity and a reachable panoramaId.

Output layout:
  <out>/R0/<elevationKey>-full.jpg           cached 45 px/m strip (copied)
  <out>/R0/<elevationKey>.frame.json
  <out>/R1/<elevationKey>-full.jpg           R1 re-render from the panorama
  <out>/R1/<elevationKey>.frame.json
  <out>/R1/tiles/<elevationKey>-r<rrr>-c<ccc>.jpg

elevationKey = elevationId with ':' replaced by '_'. frame.json is written last
and its presence marks that setting complete, so a rerun skips it unless
--force. R0 is never tiled; R1's frame.json carries the tileGrid (the planTiles
output, with each tile's cropFile).`);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function fullOf(record: SelectionRecord): FacadeWallEvidence | undefined {
  return record.images?.full ?? record.full;
}

function tilePixels(
  frame: CropFrame,
  data: Uint8Array | Uint8ClampedArray,
  tile: Tile,
): { width: number; height: number; data: Buffer } {
  const out = Buffer.allocUnsafe(tile.width * tile.height * 4);
  for (let y = 0; y < tile.height; y++) {
    const start = ((tile.y + y) * frame.width + tile.x) * 4;
    out.set(data.subarray(start, start + tile.width * 4), y * tile.width * 4);
  }
  return { width: tile.width, height: tile.height, data: out };
}

function encodeJpeg(width: number, height: number, data: Uint8Array | Uint8ClampedArray, quality: number): Buffer {
  return Buffer.from(jpeg.encode({ width, height, data: Buffer.from(data) }, quality).data);
}

async function main(): Promise<void> {
  if (flag('help')) {
    printHelp();
    return;
  }

  const selectionPath = arg('selection', '');
  if (!selectionPath) {
    console.error('prepare-crops: --selection=<file> is required. Use --help for the shape.');
    process.exitCode = 1;
    return;
  }

  const outRoot = arg('out', DEFAULT_OUT);
  const defaultEvidenceDir = arg('evidence-dir', '');
  const defaultPanoDir = arg('pano-dir', '');
  const tileSize = Number(arg('tile-size', String(DEFAULT_TILE_SIZE)));
  const overlap = Number(arg('overlap', String(DEFAULT_OVERLAP)));
  const quality = Number(arg('quality', String(DEFAULT_QUALITY)));
  const force = flag('force');
  if (!Number.isFinite(tileSize) || tileSize < 1) throw new Error(`--tile-size must be >= 1, got ${tileSize}`);
  if (!Number.isFinite(overlap) || overlap < 0 || overlap >= 1) throw new Error(`--overlap must be in [0, 1), got ${overlap}`);
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error(`--quality must be 1..100, got ${quality}`);

  const raw = JSON.parse(await fs.readFile(selectionPath, 'utf8'));
  const records: SelectionRecord[] = Array.isArray(raw) ? raw : raw.records ?? [];
  if (!Array.isArray(records)) throw new Error('selection must be an array, or an object with a "records" array');

  const panoCache = new Map<string, EquirectangularImage>();
  const loadPano = async (filePath: string): Promise<EquirectangularImage> => {
    const cached = panoCache.get(filePath);
    if (cached) return cached;
    const bytes = await fs.readFile(filePath);
    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true }) as EquirectangularImage;
    panoCache.set(filePath, image);
    if (panoCache.size > PANO_CACHE_LIMIT) panoCache.delete(panoCache.keys().next().value as string);
    return image;
  };

  const resolvePanoPath = (record: SelectionRecord, full: FacadeWallEvidence): string | null => {
    if (record.sourcePanorama) return record.sourcePanorama;
    const evidenceDir = record.evidenceDir ?? defaultEvidenceDir;
    if (evidenceDir && full.panoramaId) return path.join(evidenceDir, 'panoramas', `${full.panoramaId}.jpg`);
    if (defaultPanoDir && full.panoramaId) return path.join(defaultPanoDir, `${full.panoramaId}.jpg`);
    return null;
  };

  const omissions: Omission[] = [];
  const counts = { r0Write: 0, r0Skip: 0, r1Write: 0, r1Skip: 0, tiles: 0 };

  for (const record of records) {
    const full = fullOf(record);
    const key = record.elevationId.replaceAll(':', '_');
    if (!record.buildingId || !record.elevationId || !full) {
      omissions.push({ elevationId: record.elevationId ?? '<missing>', setting: 'R0', reason: 'record missing buildingId/elevationId/images.full' });
      continue;
    }
    const evidenceDir = record.evidenceDir ?? defaultEvidenceDir;

    // R0 — copy the cached strip. No tiling.
    try {
      const framePath = path.join(outRoot, 'R0', `${key}.frame.json`);
      if (!force && (await exists(framePath))) {
        counts.r0Skip += 1;
      } else {
        const cached = resolveR0(evidenceDir, full);
        const source = cached.path;
        if (!(await exists(source))) throw new Error(`cached strip not found: ${source}`);
        const dir = path.join(outRoot, 'R0');
        await fs.mkdir(dir, { recursive: true });
        const cropFile = `R0/${key}-full.jpg`;
        await fs.copyFile(source, path.join(outRoot, cropFile));
        const frame = cached.frame;
        const payload: FrameJson = {
          buildingId: record.buildingId,
          elevationId: record.elevationId,
          setting: 'R0',
          cropFile,
          widthPx: frame.width,
          heightPx: frame.height,
          pixelsPerMetre: frame.pixelsPerMetre,
          wallWidthM: frame.wallWidthM,
          wallHeightM: frame.wallHeightM,
          baseZ: frame.baseZ,
          topZ: frame.topZ,
        };
        await fs.writeFile(framePath, `${JSON.stringify(payload, null, 2)}\n`);
        counts.r0Write += 1;
      }
    } catch (error) {
      omissions.push({ elevationId: record.elevationId, setting: 'R0', reason: String(error instanceof Error ? error.message : error) });
    }

    // R1 — re-render from the source panorama, then tile.
    try {
      const framePath = path.join(outRoot, 'R1', `${key}.frame.json`);
      if (!force && (await exists(framePath))) {
        counts.r1Skip += 1;
      } else {
        const panoPath = resolvePanoPath(record, full);
        if (!panoPath) throw new Error('no panorama path: set sourcePanorama, evidenceDir or --pano-dir');
        if (!(await exists(panoPath))) throw new Error(`panorama not found: ${panoPath}`);
        const source = await loadPano(panoPath);
        const rendered = renderR1(source, full);
        const frame = rendered.frame;
        const dir = path.join(outRoot, 'R1');
        const tileDir = path.join(dir, 'tiles');
        await fs.mkdir(tileDir, { recursive: true });

        const cropFile = `R1/${key}-full.jpg`;
        await fs.writeFile(path.join(outRoot, cropFile), encodeJpeg(frame.width, frame.height, rendered.image.data, quality));

        const grid = planTiles(frame, { tileSize, overlap });
        const tiles: FrameTile[] = grid.tiles.map((tile) => {
          const file = `R1/tiles/${key}-r${String(tile.row).padStart(3, '0')}-c${String(tile.column).padStart(3, '0')}.jpg`;
          return { ...tile, cropFile: file };
        });
        for (let i = 0; i < grid.tiles.length; i++) {
          const crop = tilePixels(frame, rendered.image.data, grid.tiles[i]);
          await fs.writeFile(path.join(outRoot, tiles[i].cropFile), encodeJpeg(crop.width, crop.height, crop.data, quality));
        }
        counts.tiles += tiles.length;

        const payload: FrameJson = {
          buildingId: record.buildingId,
          elevationId: record.elevationId,
          setting: 'R1',
          cropFile,
          widthPx: frame.width,
          heightPx: frame.height,
          pixelsPerMetre: rendered.pixelsPerMetre,
          wallWidthM: frame.wallWidthM,
          wallHeightM: frame.wallHeightM,
          baseZ: frame.baseZ,
          topZ: frame.topZ,
          tileGrid: { tileSize: grid.tileSize, overlap: grid.overlap, stride: grid.stride, columns: grid.columns, rows: grid.rows, tiles },
        };
        await fs.writeFile(framePath, `${JSON.stringify(payload, null, 2)}\n`);
        counts.r1Write += 1;
      }
    } catch (error) {
      omissions.push({ elevationId: record.elevationId, setting: 'R1', reason: String(error instanceof Error ? error.message : error) });
    }
  }

  for (const omission of omissions) console.error(`omit ${omission.elevationId} ${omission.setting}: ${omission.reason}`);
  process.stdout.write(
    `prepare-crops: walls=${records.length} R0(write=${counts.r0Write} skip=${counts.r0Skip}) ` +
      `R1(write=${counts.r1Write} skip=${counts.r1Skip}) tiles=${counts.tiles} omitted=${omissions.length} -> ${outRoot}\n`,
  );
}

main().catch((error) => {
  console.error(`prepare-crops: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
