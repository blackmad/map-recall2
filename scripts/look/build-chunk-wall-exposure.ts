// The exposure every installed street chunk's walls were matched under, for the sunny look (look/chunkWallExposure.ts).
//   npx tsx scripts/look/build-chunk-wall-exposure.ts [--write] [--archive=<map-recall2-source-data>/models]
//
// Why (docs/chunk-brightness-20261016.md): a block face's wall colours are matched to its rectified panorama strip
// (scripts/block-face/review.ts renders the chunk head-on beside the strip; the wall-colour check compares the two), so
// what a chunk drew facing the light was the strip's colour at the strip's own, mostly overcast, exposure. Per-house
// measured walls carry the white of their crop and the sunny look brings them to a sunlit white (WALL_WHITE_POINTS);
// chunk walls carried no exposure record, so they drew at the overcast reading, and on a shade side (0.41 of the sun
// side in linear light) at 0.56-0.73 of the photo.
//
// For every chunk in public/canal-drive/ordinary-buildings-data/chunks.json named `face-<id>` whose strip is on disk
// (strip.json `image`, staging/block-face/<id>/strip.jpg, else the source-data archive's models/<id>/files/strip.jpg),
// per pand (blockFace/stripPalette.ts):
//   white          the raw light-trim white (`frame`, the median of the white frames); the face takes the per-channel
//                  median over its pands;
//   stripOverDrawn lin(strip wall) / lin(the wall the chunk draws head-on: cityTint(palette.brick) x brick cell mean),
//                  median over the brick pands whose strip body is at least 30 % wall: how far the authored colour sits
//                  from its photo (1 = matched; Bilderdijkstraat 135-153 was lifted 1.44x in sRGB over its strip); only
//                  with a white (a strip without one has an unknown exposure).
// Writes src/canalRecall/look/chunkWallExposure.ts. Chunks without a strip (the post-hoc house chunks) are not listed and
// take FALLBACK_WALL_GAIN, like a measured wall with no recorded white.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {measureStripPalette} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {houseIntents, validateBlockFace} from '../../src/canalRecall/blockFace/intent.ts';
import {swatch} from '../../src/canalRecall/buildingRecipe/intent.ts';
import {hexToRgb} from '../../src/canalRecall/look/palette.ts';
import {drawnWallLuma} from '../../src/canalRecall/look/drawnWall.ts';
import {srgbToLinear} from '../../src/canalRecall/look/sunny.ts';
import {chunkWallGain} from '../../src/canalRecall/look/chunkWallExposure.ts';
import {CHUNK_WALL_EXPOSURE_DATA} from '../../src/canalRecall/look/chunkWallExposureData.ts';

const FACES = 'scripts/block-face/faces', OUT = 'src/canalRecall/look/chunkWallExposureData.ts';
const MANIFEST = 'public/canal-drive/ordinary-buildings-data/chunks.json';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
// The archive sits beside the main checkout (worktrees live under <main>/.claude/worktrees/<name> or
// <main>-worktrees/<name>).
const ARCHIVE = arg('archive') ?? path.resolve(process.cwd().replace(/\/\.claude\/worktrees\/[^/]+$/, '').replace(/-worktrees\/[^/]+$/, ''), '../map-recall2-source-data/models');
type RGB = [number, number, number];
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const med = (a: number[]) => { const s = a.filter(Number.isFinite).sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const stripFile = (face: string, strip: {image?: string}) => [strip.image, `staging/block-face/${face}/strip.jpg`, path.join(ARCHIVE, face, 'files', 'strip.jpg')].find(f => f && fs.existsSync(f));

const entries: Record<string, {white: RGB | null; stripOverDrawn: number | null}> = {}, rows: string[] = [];
for (const chunk of JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).chunks as {name: string}[]) {
  const face = chunk.name.replace(/^face-/, ''), dir = path.join(FACES, face);
  if (!chunk.name.startsWith('face-') || !fs.existsSync(path.join(dir, 'strip.json'))) { rows.push(`${chunk.name}: no strip (fallback gain ${chunkWallGain(undefined).toFixed(3)})`); continue; }
  const strip = JSON.parse(fs.readFileSync(path.join(dir, 'strip.json'), 'utf8')), file = stripFile(face, strip);
  // A face whose strip is in neither staging nor the archive keeps the entry it was published with (2026-10-24: some
  // older faces' strips were never archived, which used to stop every later face from being re-measured).
  if (!file) {
    const kept = (CHUNK_WALL_EXPOSURE_DATA as Record<string, {white: RGB | null; stripOverDrawn: number | null}>)[chunk.name];
    if (kept) entries[chunk.name] = kept;
    rows.push(`${chunk.name}: strip image missing (staging or ${ARCHIVE}); ${kept ? 'kept the published entry' : 'fallback gain'}`);
    continue;
  }
  const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const rgb = new Uint8Array(data.buffer, data.byteOffset, data.length);
  const intents = houseIntents(validateBlockFace(JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members));
  const pands = strip.spans.map((s: any) => {
    const facts = path.join(dir, 'pands', s.pandId, 'facts.json'), h = fs.existsSync(facts) ? JSON.parse(fs.readFileSync(facts, 'utf8')).heights : null;
    const p = measureStripPalette({rgb, width: info.width, height: info.height, x0: s.px[0], x1: s.px[1], pixelsPerMetre: strip.pixelsPerMetre, eavesM: h?.eavesM ?? h?.dak70pM ?? 14});
    const intent = intents.find(i => i.pandId === s.pandId), brick = !!intent && (intent.palette.wallMaterial ?? 'brick') !== 'stucco';
    const drawn = intent ? drawnWallLuma({...intent.palette, brick: swatch(intent.palette.brick)}) : NaN;
    const wall = p.wall && !p.stucco && brick && p.shares.wall >= 0.3 ? luma(hexToRgb(p.wall)) : NaN;
    return {frame: p.frame ? hexToRgb(p.frame) : null, ratio: srgbToLinear(wall) / srgbToLinear(drawn)};
  });
  const frames = pands.map((p: any) => p.frame).filter(Boolean) as RGB[];
  const white = frames.length ? [0, 1, 2].map(i => Math.round(med(frames.map(f => f[i])))) as RGB : null;
  // Without a light trim the strip's exposure is unknown (a dark capture reads its trims as wall), so its wall reading is
  // not a reference either: such a chunk takes the fallback gain alone.
  const ratio = med(pands.map((p: any) => p.ratio)), entry = {white, stripOverDrawn: white && Number.isFinite(ratio) ? +ratio.toFixed(3) : null};
  entries[chunk.name] = entry;
  rows.push(`${chunk.name}: white ${white ? `${white.join(',')} (luma ${Math.round(luma(white))}, ${frames.length}/${pands.length} pands)` : 'none'} | strip/drawn ${entry.stripOverDrawn ?? '-'} (linear) | gain ${chunkWallGain(entry).toFixed(3)} | ${path.relative(process.cwd(), file)}`);
}
rows.forEach(r => console.log(r));
const src = `// Generated by scripts/look/build-chunk-wall-exposure.ts from the block faces' strips; do not edit.
// ${Object.keys(entries).length} chunks measured on their strips.

/**
 * Chunk name (chunks.json \`name\`) -> what its walls were matched under: \`white\`, the raw light-trim white of the strip
 * (sRGB, per-channel median of the pands' white frames; null when the strip shows none), and \`stripOverDrawn\`, the strip
 * wall over the wall the chunk draws head-on, in linear light (median over the brick pands; null when none measured).
 * Read by chunkWallExposure.ts \`chunkWallExposure\`.
 */
export const CHUNK_WALL_EXPOSURE_DATA: Readonly<Record<string, {readonly white: readonly [number, number, number] | null; readonly stripOverDrawn: number | null}>> = {
${Object.entries(entries).map(([k, v]) => `  '${k}': {white: ${v.white ? `[${v.white.join(', ')}]` : 'null'}, stripOverDrawn: ${v.stripOverDrawn}},`).join('\n')}
};
`;
if (process.argv.includes('--write')) { fs.writeFileSync(OUT, src); console.log('wrote', OUT); }
