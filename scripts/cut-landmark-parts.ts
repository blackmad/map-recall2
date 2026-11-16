/**
 * Split the pands that a landmark only partly stands on (src/canalRecall/landmarks/pandParts.ts).
 * Each catalogue entry with `pandParts` turns its pand's tile feature into two:
 * - `landmark-part:<model>:<pand>`, which the model hides;
 * - the rest, under the pand's own id, which stays drawn (rows line, house specs).
 *
 *   node --import tsx scripts/cut-landmark-parts.ts           # report what would be cut (staging only)
 *   node --import tsx scripts/cut-landmark-parts.ts --write   # rewrite the features in bag-tiles and building-tiles
 *   node --import tsx scripts/cut-landmark-parts.ts --check   # exit 1 unless the tiles hold exactly the declared cuts
 *
 * Writes keep each pand's uncut feature in scripts/data/landmark-parts/originals-<dir>.geojson, so a moved ring
 * re-cuts the original and a removed declaration restores it. Re-run --write after a full tile rebuild (as
 * cut-building-passages.ts). Without any `pandParts` in the catalogue, --write changes no tile.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { applyPandParts, fullPand, isPartFeatureId, partFeatureId, splitPandOwners, type PandPartsEntry, type TileFeature } from '../src/canalRecall/landmarks/pandParts';

const write = process.argv.includes('--write'), check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const STAGE = path.join('scripts', 'data', 'landmark-parts');
const DIRS = ['bag-tiles', 'building-tiles'] as const;
const CATALOGUE = path.join('src', 'canalRecall', 'landmarks', 'manualCatalogue.json');

const readTile = (file: string): { features: TileFeature[] } => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const writeTile = (file: string, features: TileFeature[]) => fs.writeFileSync(file, zlib.gzipSync(`{"type":"FeatureCollection","features":[\n${features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`));
const originalsFile = (dir: string) => path.join(STAGE, `originals-${dir}.geojson`);
const readOriginals = (dir: string): Map<string, TileFeature> => {
  const file = originalsFile(dir);
  if (!fs.existsSync(file)) return new Map();
  return new Map((JSON.parse(fs.readFileSync(file, 'utf8')) as { features: TileFeature[] }).features.map(f => [String(f.properties.id), f]));
};

const entries = (JSON.parse(fs.readFileSync(CATALOGUE, 'utf8')) as PandPartsEntry[]).filter(e => e.pandParts?.length);
splitPandOwners(entries); // throws on a pand split by two models
const declared = new Map(entries.flatMap(e => (e.pandParts ?? []).map(p => [fullPand(p.pand), e.id] as const)));
console.log(`pandParts: ${entries.length} model(s), ${declared.size} pand(s)${entries.length ? `: ${entries.map(e => `${e.id} (${(e.pandParts ?? []).map(p => fullPand(p.pand).slice(14)).join(', ')})`).join('; ')}` : ''}`);

const problems: string[] = [];
const report: Record<string, unknown>[] = [];
for (const dir of DIRS) {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'index-z14.json'), 'utf8')) as { tileList: string[] };
  const originals = readOriginals(dir);
  const found = new Set<string>();
  let delta = 0, tiles = 0;
  const keepOriginals = new Map<string, TileFeature>();
  for (const key of index.tileList) {
    const file = path.join(ROOT, dir, `${key}.geojson.gz`);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file);
    const text = zlib.gunzipSync(raw).toString();
    // Cheap skip: only tiles that mention a declared pand, a part, or a pand whose declaration went away.
    if (![...declared.keys(), ...originals.keys()].some(id => text.includes(id)) && !text.includes('landmark-part:')) continue;
    const tile = JSON.parse(text) as { features: TileFeature[] };
    const { features, split } = applyPandParts(tile.features, entries, originals);
    for (const s of split) {
      found.add(s.pand); keepOriginals.set(s.pand, s.original);
      if (dir === 'bag-tiles') report.push({ model: s.model, pand: s.pand, tile: key, partM2: Math.round(s.partM2), restM2: Math.round(s.restM2) });
      if (s.partM2 < 1) problems.push(`${dir} ${key}: ${s.model}'s ring misses ${s.pand}`);
    }
    if (check) {
      // The tile must already be what --write would make.
      const want = JSON.stringify(features), have = JSON.stringify(tile.features);
      if (want !== have) problems.push(`${dir} ${key}: not cut as declared (run --write)`);
      continue;
    }
    if (JSON.stringify(features) === JSON.stringify(tile.features)) continue;
    delta += features.length - tile.features.length; tiles++;
    if (write) writeTile(file, features);
  }
  for (const [pand, model] of declared) if (!found.has(pand)) problems.push(`${dir}: ${model} declares ${pand}, which no tile holds`);
  if (write) {
    fs.mkdirSync(STAGE, { recursive: true });
    if (keepOriginals.size) fs.writeFileSync(originalsFile(dir), `{"type":"FeatureCollection","features":[\n${[...keepOriginals.values()].map(f => JSON.stringify(f)).join(',\n')}\n]}\n`);
    else if (fs.existsSync(originalsFile(dir))) fs.rmSync(originalsFile(dir));
    if (delta) {
      const indexFile = path.join(ROOT, dir, 'index-z14.json');
      fs.writeFileSync(indexFile, fs.readFileSync(indexFile, 'utf8').replace(/"features": (\d+),/, (_, n) => `"features": ${Number(n) + delta},`));
    }
  }
  if (!check) console.log(`${dir}: ${tiles} tile(s) ${write ? 'rewritten' : 'to rewrite'}, ${delta >= 0 ? '+' : ''}${delta} features`);
}
for (const r of report) console.log(`  ${r.model}: ${r.pand} in ${r.tile}: part ${r.partM2} m2 (${partFeatureId(String(r.model), String(r.pand))}), rest ${r.restM2} m2`);
if (write || !fs.existsSync(path.join(STAGE, 'report.json')) || report.length) {
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(path.join(STAGE, 'report.json'), `${JSON.stringify(report, null, 1)}\n`);
}

// Each split model must hide its part and never the whole pand (that would hide the rest as well).
for (const e of entries) {
  const spec = e as PandPartsEntry & { suppressOsmIds?: string[] };
  for (const p of e.pandParts ?? []) {
    const pand = fullPand(p.pand), part = partFeatureId(e.id, pand);
    if (!(spec.suppressOsmIds ?? []).includes(part)) problems.push(`${e.id}: suppressOsmIds must list ${part}`);
    if ((spec.suppressOsmIds ?? []).includes(pand)) problems.push(`${e.id}: suppressOsmIds lists the whole pand ${pand}; list ${part} instead`);
  }
  if (!(spec.suppressOsmIds ?? []).every(id => !isPartFeatureId(id) || declared.has(`NL.IMBAG.Pand.${id.slice(-16)}`))) problems.push(`${e.id}: suppresses a landmark-part of an undeclared pand`);
}

if (problems.length) { for (const p of problems) console.error(`FAIL ${p}`); process.exit(1); }
if (check) console.log(`landmark parts: ${declared.size} declared pand(s) cut in both tile sets`);
