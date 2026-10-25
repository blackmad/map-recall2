/**
 * Re-read measured large-recipe walls from a sunlit crop of the same pand (issue #73; buildingRecipe/sunlitWall.ts).
 *
 *   MAP_RECALL_SOURCE_DATA=<checkout> node --import tsx scripts/building-recipes/sunlit-walls.ts [--house=<id>,...] [--write] [--json=<file>]
 *
 * For every installed `kind: large` house (or the listed ones), every measured group (`measured.groups`) with its own
 * `palette.brick` and no hand colour: reads the brick of the crop the group was measured from (measured.json) and of
 * the other archived captures of the same wall (pand-reference-walls `wNN-*`, washed-out share <= 0.5, taken May-September:
 * `sunlitSeason`), takes the
 * brightest reading of the same warm material as the measured colour, and proposes `sunlitWallProposal`. Prints one line per group and a
 * city-wide summary (drawn luma before/after). `--write` puts the colour into `walls[g].palette.brick`, adds
 * `palette.brick` to the group's `hand` (so measure.ts --write keeps it) and a note with the evidence. Material-only:
 * re-export with reexport-large.ts, then rebuild covers.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {brickReading, drawnLuma, sameWarmMaterial, sunlitSeason, sunlitWallProposal, type BrickReading} from '../../src/canalRecall/buildingRecipe/sunlitWall.ts';
import {WALL_WHITE_POINTS} from '../../src/canalRecall/look/measuredWhitePoints.ts';
import {hexToRgb} from '../../src/canalRecall/look/palette.ts';
import {pandWallsDir, requireSourceData, SOURCE_DATA_PREFIX} from './sourceData.ts';

const resolveSourceRef = (ref: string) => path.join(requireSourceData(), ref.slice(SOURCE_DATA_PREFIX.length));

const HOUSES = 'scripts/building-recipes/houses', CATALOGUE = 'public/canal-drive/ordinary-buildings-data/catalogue.json';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const write = process.argv.includes('--write');
const installed = new Set<string>(JSON.parse(fs.readFileSync(CATALOGUE, 'utf8')).models.map((m: {modelUrl?: string}) => /recipe-large-(.*)\.glb$/.exec(m.modelUrl ?? '')?.[1]).filter(Boolean));
const ids = arg('house')?.split(',').filter(Boolean) ?? [...installed].sort();

const readings = new Map<string, BrickReading | null>();
async function readCrop(file: string): Promise<BrickReading | null> {
  if (!readings.has(file)) {
    if (!fs.existsSync(file)) readings.set(file, null);
    else { const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true}); readings.set(file, brickReading(data, info.width * info.height)); }
  }
  return readings.get(file)!;
}

const rows: Record<string, unknown>[] = [];
for (const id of ids) {
  const dir = path.join(HOUSES, id), intentFile = path.join(dir, 'intent.json'), text = fs.readFileSync(intentFile, 'utf8'), intent = JSON.parse(text);
  if (intent.kind !== 'large' || !intent.measured?.groups?.length || !fs.existsSync(path.join(dir, 'measured.json'))) continue;
  const indent = /^\{\n( +)"/.exec(text)?.[1].length ?? 1;
  const evidence = JSON.parse(fs.readFileSync(path.join(dir, 'measured.json'), 'utf8'));
  const pand = String(intent.pandId).slice(-16), wallsDir = pandWallsDir(pand), meta = path.join(wallsDir, 'walls.json');
  const crops: {tag: string; date: string; reading: BrickReading | null}[] = [];
  if (fs.existsSync(meta)) for (const w of JSON.parse(fs.readFileSync(meta, 'utf8')).walls) {
    if ((w.washedOut ?? 0) > 0.5) continue;
    crops.push({tag: w.tag, date: w.capturedAt, reading: await readCrop(path.join(wallsDir, `${w.tag}.jpg`))});
  }
  let changed = false;
  for (const gi of intent.measured.groups as number[]) {
    const w = intent.walls?.[gi], hex: string | undefined = w?.palette?.brick, g = evidence.groups?.find((e: {group: number}) => e.group === gi);
    if (!w || typeof hex !== 'string' || !hex.startsWith('#') || !g?.crop?.ref) continue;
    const row: Record<string, unknown> = {id, group: gi, old: hex};
    const hand = new Set<string>(w.hand ?? []);
    if (hand.has('palette') || hand.has('palette.brick')) { rows.push({...row, skip: 'hand colour'}); continue; }
    // only a brick wall: a render (stucco) is drawn by cityStuccoTint, not as a measured brick, and is not this tool's
    if ((w.wallMaterial ?? intent.palette?.wallMaterial ?? 'brick') !== 'brick') { rows.push({...row, skip: 'not a brick wall'}); continue; }
    const used = await readCrop(resolveSourceRef(g.crop.ref)), white = WALL_WHITE_POINTS[hex.toLowerCase()] ?? null;
    // Only another capture of the same wall (w01-168 and w01-168L): a brighter crop of another wall of the pand is often
    // another brick (OBA Olympisch Kwartier: its dark red-brown fronts are not the orange brick of its sunlit west wall).
    const wallOf = (tag: string) => /^w\d+/.exec(tag)?.[0], usedTag = path.basename(g.crop.ref, '.jpg');
    const matches = crops.filter(c => c.reading && wallOf(c.tag) === wallOf(usedTag) && sunlitSeason(c.date) && sameWarmMaterial(hexToRgb(hex) as [number, number, number], c.reading.rgb)).sort((a, b) => b.reading!.luma - a.reading!.luma);
    const best = matches[0], p = sunlitWallProposal(hex, white, used, best?.reading ?? null);
    Object.assign(row, {usedTag, usedLuma: used?.luma ?? null, sunTag: best?.tag ?? null, sunDate: best?.date ?? null, sunLuma: best?.reading?.luma ?? null, drawnBefore: Math.round(drawnLuma(hex, white)), ...p});
    rows.push(row);
    console.log(`${id} g${gi} ${hex}: ${'skip' in p ? `skip (${p.skip})` : `-> ${p.hex}, drawn ${p.drawnBefore} -> ${p.drawnAfter} (brick ${used?.luma} in ${row.usedTag}, ${best!.reading!.luma} in sunlit ${best!.tag} ${best!.date})`}`);
    if (!write || 'skip' in p) continue;
    w.palette.brick = p.hex;
    w.hand = [...hand, 'palette.brick'];
    intent.notes = [...(typeof intent.notes === 'string' ? [intent.notes] : intent.notes ?? []), `walls[${gi}].palette.brick ${hex} -> ${p.hex} (sunlit-walls.ts, issue #73): measured from ${row.usedTag} in shade (brick luma ${used!.luma}); the same brick reads ${best!.reading!.luma} in the sunlit crop ${best!.tag} (${best!.date}); hue kept, drawn ${p.drawnBefore} -> ${p.drawnAfter}.`];
    changed = true;
  }
  if (changed) fs.writeFileSync(intentFile, JSON.stringify(intent, null, indent) + '\n');
}
const out = rows.filter(r => !('skip' in r)), med = (a: number[]) => a.slice().sort((p, q) => p - q)[a.length >> 1];
const groups = rows.filter(r => typeof r.drawnBefore === 'number');
console.log(`${rows.length} measured groups; ${out.length} re-read${write ? ' (written)' : ''}; skipped: ${Object.entries(rows.filter(r => 'skip' in r).reduce((m: Record<string, number>, r) => { const k = String(r.skip).replace(/ \(.*$/, '').replace(/ at \d+.*$/, ''); m[k] = (m[k] ?? 0) + 1; return m; }, {})).map(([k, v]) => `${v} ${k}`).join(', ')}`);
if (out.length) console.log(`drawn luma, re-read groups: median ${med(out.map(r => r.drawnBefore as number))} -> ${med(out.map(r => r.drawnAfter as number))}; all measured groups: median ${med(groups.map(r => r.drawnBefore as number))} -> ${med(groups.map(r => (r.drawnAfter ?? r.drawnBefore) as number))}`);
const json = arg('json');
if (json) fs.writeFileSync(json, JSON.stringify(rows, null, 1) + '\n');
