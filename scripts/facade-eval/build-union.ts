/**
 * Build the union opening set (decision D1) from the photo lanes.
 *
 * Reads the RF-DETR and YOLO26x-seg lane JSONs, merges them per wall with
 * `mergeOpenings` — union of windows, doors win over overlapping windows — and
 * writes one lane JSON in the same contract the scorer and the comparison page
 * already read.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/build-union.ts \
 *     --rfdetr=.cache/facade-eval/rfdetr-oudzuid-R0.json \
 *     --rsjek=.cache/facade-eval/rsjek-oudzuid-R0.json \
 *     --out=.cache/facade-eval/union-oudzuid-R0.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mergeOpenings, type MergeBox, type OpeningKind } from '../../src/canalRecall/facade/openingMerge.ts';

interface PredBox { kind?: string; score?: number; along: number; up: number; widthM?: number; width?: number; heightM?: number; height?: number }
interface PredRecord { buildingId?: string; elevationId?: string; surfaceId?: string; wallWidthM?: number; wallHeightM?: number; cropFile?: string; cropWidthPx?: number; cropHeightPx?: number; pixelsPerMetre?: number; tiles?: number; boxes?: PredBox[] }
interface PredFile { model?: string; setting?: string; records: PredRecord[] }

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const rfdetrPath = argument('rfdetr') || '.cache/facade-eval/rfdetr-oudzuid-R0.json';
const rsjekPath = argument('rsjek') || '.cache/facade-eval/rsjek-oudzuid-R0.json';
const outPath = argument('out') || '.cache/facade-eval/union-oudzuid-R0.json';

const toBox = (box: PredBox): MergeBox | null => {
  const width = box.width ?? box.widthM;
  const height = box.height ?? box.heightM;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return null;
  const kind: OpeningKind = box.kind === 'door' ? 'door' : box.kind === 'window' ? 'window' : 'other';
  return { along: box.along, up: box.up, width, height, kind, score: box.score };
};

const rfdetr = JSON.parse(await readFile(path.resolve(rfdetrPath), 'utf8')) as PredFile;
const rsjek = JSON.parse(await readFile(path.resolve(rsjekPath), 'utf8')) as PredFile;
const byElevation = (file: PredFile) => new Map(file.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));
const rfdetrBy = byElevation(rfdetr);
const rsjekBy = byElevation(rsjek);

const keys = [...new Set([...rfdetrBy.keys(), ...rsjekBy.keys()])];
const records = [];
const totals = { windows: 0, doors: 0, other: 0 };
for (const key of keys) {
  const a = rfdetrBy.get(key);
  const b = rsjekBy.get(key);
  const template = a ?? b!;
  const lanes = [
    { name: 'rfdetr', boxes: (a?.boxes ?? []).map(toBox).filter((box): box is MergeBox => box !== null) },
    { name: 'rsjek', boxes: (b?.boxes ?? []).map(toBox).filter((box): box is MergeBox => box !== null) },
  ];
  const merged = mergeOpenings(lanes);
  for (const box of merged) totals[box.kind === 'door' ? 'doors' : box.kind === 'window' ? 'windows' : 'other'] += 1;
  records.push({
    buildingId: template.buildingId,
    elevationId: template.elevationId,
    surfaceId: template.surfaceId ?? template.elevationId,
    wallWidthM: template.wallWidthM,
    wallHeightM: template.wallHeightM,
    cropFile: template.cropFile,
    cropWidthPx: template.cropWidthPx,
    cropHeightPx: template.cropHeightPx,
    pixelsPerMetre: template.pixelsPerMetre,
    tiles: template.tiles ?? 1,
    boxes: merged.map((box) => ({
      kind: box.kind,
      score: box.score,
      along: box.along,
      up: box.up,
      widthM: box.width,
      heightM: box.height,
      sources: box.sources,
    })),
  });
}

const payload = {
  schemaVersion: 1,
  lane: 'union',
  model: 'union(RF-DETR-seg-2XL, YOLO26x-seg) — doors win over windows (D1)',
  setting: rfdetr.setting ?? 'R0',
  boxConvention: 'along = metres from plane.start; up = metres above plane.baseZ (min edge)',
  mergeRule: 'union of windows; doors from facade-rsjek entrance; a window a door overlaps or mostly covers is dropped',
  totals,
  records,
};
await writeFile(path.resolve(outPath), `${JSON.stringify(payload, null, 1)}\n`);
process.stdout.write(`union: ${records.length} walls, ${totals.windows} windows, ${totals.doors} doors, ${totals.other} other -> ${outPath}\n`);
