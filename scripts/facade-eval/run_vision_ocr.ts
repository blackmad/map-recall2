/**
 * R-ocr: Apple Vision (via the vendored `bytefer/macos-vision-ocr`) on a
 * rectified façade crop, emitting `SignObservation[]` in wall metres.
 *
 * Vision returns text *lines* with a normalised quad each. This adapter maps the
 * quad onto the wall plane (`quadToWallMetres`), groups lines into signs
 * (`mergeLinesIntoSigns`), and samples the sign's foreground and background
 * colours from the crop, because Vision reports text but never colour.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/run_vision_ocr.ts \
 *     --manifest=<evidence manifest> --setting=R0 --out=<json> \
 *     [--bin=<path>] [--rec-langs="nl-NL,en-US"] [--limit=N]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import {
  mainSignLine,
  mergeLinesIntoSigns,
  normaliseSignText,
  quadToWallMetres,
  type ImageQuad,
  type SignFontClass,
  type SignObservation,
  type SignType,
  type WallRect,
} from '../../src/canalRecall/facade/signObservation.ts';

const run = promisify(execFile);
const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const manifestPath = path.resolve(argument('manifest') || '');
if (!manifestPath) throw new Error('usage: --manifest=<path> --out=<path>');
const outPath = path.resolve(argument('out') || '.cache/facade-eval/vision-ocr.json');
const bin = path.resolve(argument('bin') || 'scripts/facade-eval/vision-ocr/.build/out/Products/Release/macos-vision-ocr');
const recLangs = argument('rec-langs') || 'nl-NL,en-US';
// Signage is at street level, so the ground tier is the default: it is rendered
// at 110 px/m over a 4.9 m band, where the full tier is 45 px/m over the whole
// façade and leaves a fascia about 12 px tall.
const tier = (argument('tier') || 'ground') as 'ground' | 'full' | 'context';
const limit = Number(argument('limit') || 0);

interface Full { file: string; width: number; height: number; plane: { start: { x: number; y: number }; end: { x: number; y: number }; baseZ: number; topZ: number } }
interface Record_ { id?: string; buildingId?: string; elevationId?: string; images?: Record<string, Full | undefined> }

const planeLength = (plane: Full['plane']) => Math.hypot(plane.end.x - plane.start.x, plane.end.y - plane.start.y);

/** Modal colour of a region (background), and the colour furthest from it (lettering). */
export async function sampleSignColours(file: string, boxPx: { left: number; top: number; width: number; height: number }) {
  const left = Math.max(0, Math.round(boxPx.left));
  const top = Math.max(0, Math.round(boxPx.top));
  const width = Math.max(1, Math.round(boxPx.width));
  const height = Math.max(1, Math.round(boxPx.height));
  const { data, info } = await sharp(file).extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const quantise = (value: number) => Math.round(value / 16) * 16;
  const histogram = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let index = 0; index < data.length; index += channels) {
    const r = data[index], g = data[index + 1], b = data[index + 2];
    const key = (quantise(r) << 16) | (quantise(g) << 8) | quantise(b);
    const bin = histogram.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bin.count += 1; bin.r += r; bin.g += g; bin.b += b;
    histogram.set(key, bin);
  }
  if (!histogram.size) return { fg: undefined, bg: undefined };
  const bins = [...histogram.values()].map((bin) => ({ count: bin.count, r: bin.r / bin.count, g: bin.g / bin.count, b: bin.b / bin.count }));
  bins.sort((a, b) => b.count - a.count);
  const background = bins[0];
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  const hex = (c: { r: number; g: number; b: number }) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  let foreground: { r: number; g: number; b: number; count: number } | null = null;
  let bestDistance = -1;
  for (const bin of bins.slice(1)) {
    if (bin.count / total < 0.02) continue;
    const distance = Math.hypot(bin.r - background.r, bin.g - background.g, bin.b - background.b);
    if (distance > bestDistance) { bestDistance = distance; foreground = bin; }
  }
  return { fg: foreground ? hex(foreground) : undefined, bg: hex(background) };
}

/** Classify the lettering case from the text itself. */
const textCaseOf = (text: string): 'upper' | 'lower' | 'mixed' => {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letters) return 'mixed';
  if (letters === letters.toUpperCase()) return 'upper';
  if (letters === letters.toLowerCase()) return 'lower';
  return 'mixed';
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { records: Record_[] };
const imagesDir = path.join(path.dirname(manifestPath), 'images');
const records = [];
let cropsRun = 0;
let signCount = 0;
const started = Date.now();
const errors: Array<{ elevationId?: string; error: string }> = [];

for (const record of manifest.records ?? []) {
  if (limit && cropsRun >= limit) break;
  const full = record.images?.[tier];
  if (!full) continue;
  const cropPath = path.join(imagesDir, full.file);
  const wallWidthM = planeLength(full.plane);
  const wallHeightM = full.plane.topZ - full.plane.baseZ;
  const entry = {
    buildingId: record.buildingId,
    elevationId: record.elevationId,
    surfaceId: record.id ?? record.elevationId,
    wallWidthM,
    wallHeightM,
    tier,
    cropFile: cropPath,
    cropWidthPx: full.width,
    cropHeightPx: full.height,
    pixelsPerMetre: wallWidthM ? full.width / wallWidthM : null,
    signs: [] as SignObservation[],
  };
  try {
    const { stdout } = await run(bin, ['--img', cropPath, '--rec-langs', recLangs], { maxBuffer: 32 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as { observations?: Array<{ text: string; confidence: number; quad: ImageQuad }> };
    const lines = (parsed.observations ?? []).map((observation) => {
      const mapped = quadToWallMetres(observation.quad, wallWidthM, wallHeightM);
      return { text: observation.text, confidence: observation.confidence, ...mapped };
    });
    const groups = mergeLinesIntoSigns(lines);
    for (const group of groups) {
      const text = group.lines
        .map((line) => line.text.trim())
        .filter(Boolean)
        .join(' / ');
      if (!normaliseSignText(text)) continue;
      const box: WallRect = group.boxWallM;
      const colours = await sampleSignColours(cropPath, {
        left: (box.along / wallWidthM) * full.width,
        top: (1 - (box.up + box.height) / wallHeightM) * full.height,
        width: (box.width / wallWidthM) * full.width,
        height: (box.height / wallHeightM) * full.height,
      });
      entry.signs.push({
        text,
        type: 'fascia' as SignType,
        boxWallM: box,
        fg: colours.fg,
        bg: colours.bg,
        textCase: textCaseOf(text),
        fontClass: 'unknown' as SignFontClass,
        confidence: group.lines.reduce((sum, line) => sum + line.confidence, 0) / group.lines.length,
        reader: 'apple-vision',
      });
      signCount += 1;
    }
    cropsRun += 1;
  } catch (error) {
    errors.push({ elevationId: entry.elevationId, error: (error as Error).message.slice(0, 200) });
  }
  records.push(entry);
  if (entry.signs.length) process.stdout.write(`[${cropsRun}] ${entry.elevationId} signs=${entry.signs.length} main="${mainSignLine(entry.signs.map((s) => ({ text: s.text }))) ?? ''}"\n`);
}

const payload = {
  schemaVersion: 1,
  lane: 'vision-ocr',
  reader: 'apple-vision',
  model: 'bytefer/macos-vision-ocr (Apple Vision, VNRecognizeTextRequest revision 3)',
  setting: argument('setting') || 'R0',
  tier,
  recognitionLanguages: recLangs,
  frame: 'along = metres from plane.start; up = metres above plane.baseZ',
  note: 'Vision returns text lines; lines are grouped into signs by proximity. fg/bg are sampled from the crop. fontClass is unknown.',
  totals: { cropsRun, signs: signCount, errors: errors.length, secondsTotal: Math.round((Date.now() - started) / 1000) },
  errors,
  records,
};
await writeFile(outPath, `${JSON.stringify(payload, null, 1)}\n`);
process.stdout.write(`vision-ocr: ${cropsRun} crops, ${signCount} signs, ${errors.length} errors -> ${outPath}\n`);
