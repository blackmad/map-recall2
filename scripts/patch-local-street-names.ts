// Name-only patch: give a published Amsterdam extract the local OSM names that
// `build-amsterdam-extract.ts` now produces for streets, squares, waterways,
// bridges and the routing graph (lib/extractNaming.ts), without a full
// refresh. A refresh also discards curation the committed extract carries
// (issue #147: 47,259 -> 45,620 routing ways, 343 -> 500 streets), so this
// script changes names and nothing else.
//
// Evidence comes from the archived OSM snapshot: every object whose `name:en`
// differs from its local name. A published record is renamed only when
//   - its name is that object's `name:en`,
//   - its category takes the local name (never landmarks or parks; routing
//     ways always do),
//   - and it lies within MATCH_METRES of the object's geometry,
// and only when every matching object agrees on the new name.
//
// Ids are kept. They are name hashes, but `facts.json`, `street-knowledge.json`
// and `bridge-crossings.json` join on them, so a renamed record keeps its id
// and the next full refresh re-derives ids for everything together.
// Distractor strings naming a renamed record in the same category follow it,
// and `place-photos.json` (keyed by feature name) moves its key.
//
// Usage:
//   node --import tsx scripts/patch-local-street-names.ts [--features=<geojson>] [--publish]
// Without --features the script cuts the `name:en` objects out of
// .cache/osm-source/Amsterdam.osm.pbf with osmium. Without --publish it writes
// the patched files to a staging directory and prints the rename table. A
// second run on a patched extract reports 0 changes.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FeatureCategory } from '../src/types.ts';
import { classify, englishName, LOCAL_NAME_CATEGORIES, localName, type OsmTags } from './lib/extractNaming.ts';

type LatLon = [number, number];
interface OsmFeature { geometry: { type: string; coordinates: unknown } | null; properties: OsmTags }
interface ExtractRecord {
  id?: string;
  name?: string;
  type?: string;
  collection?: string;
  center?: LatLon;
  path?: LatLon[];
  paths?: LatLon[][];
  distractors?: string[];
  [key: string]: unknown;
}

const MATCH_METRES = 150;
const extractDir = path.resolve(process.env.EXTRACT_DIR || 'public/data/extracts/amsterdam');
const pbf = path.resolve('.cache/osm-source/Amsterdam.osm.pbf');
const args = process.argv.slice(2);
const publish = args.includes('--publish');
const featuresArg = args.find((arg) => arg.startsWith('--features='))?.slice('--features='.length);
const stagingDir = path.resolve(args.find((arg) => arg.startsWith('--staging='))?.slice('--staging='.length)
  || path.join(os.tmpdir(), 'local-street-names-staging'));

// Files whose `name` is an extract feature name. facts and street-knowledge
// carry no geometry and follow the geometric files by id.
const GEOMETRIC_FILES = ['streets-routing.json', 'streets.json', 'squares.json', 'bridges.json', 'all.json'];
const BY_ID_FILES = ['street-knowledge.json', 'facts.json'];

function loadFeatures(): OsmFeature[] {
  let file = featuresArg;
  if (!file) {
    if (!existsSync(pbf)) throw new Error(`No --features and no archived snapshot at ${pbf}`);
    const work = mkdtempSync(path.join(os.tmpdir(), 'local-street-names-'));
    execFileSync('osmium', ['tags-filter', pbf, 'nwr/name:en', '-o', path.join(work, 'name-en.osm.pbf'), '--overwrite']);
    file = path.join(work, 'name-en.geojson');
    execFileSync('osmium', ['export', path.join(work, 'name-en.osm.pbf'), '-o', file, '--overwrite']);
  }
  return (JSON.parse(readFileSync(file, 'utf8')) as { features: OsmFeature[] }).features;
}

function osmVertices(geometry: OsmFeature['geometry']): LatLon[] {
  const out: LatLon[] = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number') out.push([value[1] as number, value[0] as number]);
    else value.forEach(walk);
  };
  walk(geometry?.coordinates);
  return out;
}

function recordPoints(record: ExtractRecord): LatLon[] {
  const points: LatLon[] = [];
  if (record.center) points.push(record.center);
  for (const line of [record.path ?? [], ...(record.paths ?? [])]) points.push(...line);
  return points;
}

function metres([lat0, lon0]: LatLon, [lat1, lon1]: LatLon): number {
  const lonScale = 111_320 * Math.cos(((lat0 + lat1) / 2) * Math.PI / 180);
  return Math.hypot((lat1 - lat0) * 110_540, (lon1 - lon0) * lonScale);
}

function nearestMetres(a: LatLon[], b: LatLon[]): number {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, metres(p, q));
  return best;
}

/** Category of a published record: `extract_<category>_…`, `routing_…`, or the facts `collection`. */
function recordCategory(file: string, record: ExtractRecord): FeatureCategory | 'routing' | undefined {
  if (file === 'streets-routing.json') return 'routing';
  const match = /^extract_([a-z]+)_/.exec(record.id ?? '');
  return (match?.[1] ?? record.collection) as FeatureCategory | undefined;
}

interface Evidence { english: string; local: string; category: FeatureCategory | undefined; highway: boolean; vertices: LatLon[] }

const evidence: Evidence[] = loadFeatures()
  .filter(({ properties: tags }) => tags['name:en'] && localName(tags) !== englishName(tags))
  .map(({ properties: tags, geometry }) => ({
    english: englishName(tags),
    local: localName(tags),
    category: classify(tags)?.category,
    highway: Boolean(tags.highway),
    vertices: osmVertices(geometry),
  }))
  .filter(({ vertices }) => vertices.length > 0);
const byEnglish = new Map<string, Evidence[]>();
for (const item of evidence) byEnglish.set(item.english, [...(byEnglish.get(item.english) ?? []), item]);

const readJson = (file: string) => JSON.parse(readFileSync(path.join(extractDir, file), 'utf8'));
const records = (data: unknown): ExtractRecord[] => (Array.isArray(data) ? data : (data as { features: ExtractRecord[] }).features);

interface Rename { file: string; id: string; category: string; from: string; to: string; metres: number }
const renames: Rename[] = [];
const skipped: string[] = [];
const renamedById = new Map<string, { from: string; to: string }>();
const output = new Map<string, unknown>();

for (const file of GEOMETRIC_FILES) {
  const data = readJson(file);
  for (const record of records(data)) {
    const candidates = record.name ? byEnglish.get(record.name) : undefined;
    if (!candidates) continue;
    const category = recordCategory(file, record);
    if (category !== 'routing' && (!category || !LOCAL_NAME_CATEGORIES.has(category))) continue;
    const points = recordPoints(record);
    const matches = candidates
      .filter((item) => (category === 'routing' ? item.highway : item.category === category))
      .map((item) => ({ item, metres: nearestMetres(points, item.vertices) }))
      .filter(({ metres: distance }) => distance <= MATCH_METRES);
    const targets = new Set(matches.map(({ item }) => item.local));
    if (targets.size !== 1) {
      if (targets.size > 1) skipped.push(`${file} ${record.id} "${record.name}": ambiguous (${[...targets].join(' / ')})`);
      else skipped.push(`${file} ${record.id} "${record.name}": no ${category} OSM object within ${MATCH_METRES} m`);
      continue;
    }
    const to = [...targets][0];
    const distance = Math.min(...matches.map(({ metres: m }) => m));
    renames.push({ file, id: record.id ?? '', category, from: record.name!, to, metres: Math.round(distance) });
    if (record.id && category !== 'routing') renamedById.set(record.id, { from: record.name!, to });
    record.name = to;
  }
  output.set(file, data);
}

// Distractors and id-joined files follow the geometric renames.
const renamedInCategory = new Map<string, Map<string, string>>();
for (const { category, from, to } of renames) {
  if (category === 'routing') continue;
  const map = renamedInCategory.get(category) ?? new Map<string, string>();
  if (map.has(from) && map.get(from) !== to) throw new Error(`"${from}" renamed two ways in ${category}`);
  map.set(from, to);
  renamedInCategory.set(category, map);
}
let distractorEdits = 0;
for (const file of [...GEOMETRIC_FILES, ...BY_ID_FILES]) {
  const data = output.get(file) ?? readJson(file);
  for (const record of records(data)) {
    if (BY_ID_FILES.includes(file) && record.id && renamedById.has(record.id)) {
      const { from, to } = renamedById.get(record.id)!;
      if (record.name === from) {
        renames.push({ file, id: record.id, category: recordCategory(file, record) ?? '', from, to, metres: 0 });
        record.name = to;
      }
    }
    const map = renamedInCategory.get(recordCategory(file, record) ?? '');
    if (map && Array.isArray(record.distractors)) {
      record.distractors = record.distractors.map((name) => {
        const to = map.get(name);
        if (!to) return name;
        distractorEdits++;
        return to;
      });
    }
  }
  output.set(file, data);
}

// place-photos.json is keyed by feature name (featureProvider.ts looks photos
// up by `place.name`), so a renamed square keeps its photo only if the key moves.
const photoFile = 'place-photos.json';
const photoData = readJson(photoFile) as { places: Record<string, unknown> };
const photoMoves: string[] = [];
for (const map of renamedInCategory.values()) {
  for (const [from, to] of map) {
    if (!(from in photoData.places)) continue;
    if (to in photoData.places) { skipped.push(`${photoFile}: "${to}" already has a photo; "${from}" left`); continue; }
    photoData.places = Object.fromEntries(Object.entries(photoData.places).map(([key, value]) => [key === from ? to : key, value]));
    photoMoves.push(`${from} -> ${to}`);
  }
}
if (photoMoves.length) output.set(photoFile, photoData);

// Report.
const table = new Map<string, { to: string; categories: Set<string>; files: Map<string, number> }>();
for (const { file, from, to, category } of renames) {
  const key = `${from}\u0000${to}`;
  const row = table.get(key) ?? { to, categories: new Set<string>(), files: new Map<string, number>() };
  if (category) row.categories.add(category);
  row.files.set(file, (row.files.get(file) ?? 0) + 1);
  table.set(key, row);
}
console.log(`Rename table (${table.size} names, ${renames.length} records):`);
for (const [key, row] of table) {
  const from = key.split('\u0000')[0];
  console.log(`  ${from} -> ${row.to}  [${[...row.categories].join(', ')}]  ${[...row.files].map(([file, count]) => `${file} x${count}`).join(', ')}`);
}
const perFile = new Map<string, number>();
for (const { file } of renames) perFile.set(file, (perFile.get(file) ?? 0) + 1);
console.log('Per file:', Object.fromEntries(perFile));
console.log(`Distractor strings renamed: ${distractorEdits}`);
console.log(`place-photos keys moved: ${photoMoves.length ? photoMoves.join('; ') : 0}`);
if (skipped.length) console.log(`Not renamed (${skipped.length}):\n  ${skipped.join('\n  ')}`);

const changed = renames.length + distractorEdits + photoMoves.length;
if (!changed) {
  console.log('0 changes: the extract already carries the local names.');
  process.exit(0);
}

// Files keep their published encoding (one JSON line, or place-photos'
// two-space indent). A file that does not round-trip byte for byte through
// JSON.parse/stringify is refused rather than reformatted.
function encode(before: string, data: unknown): string {
  const indent = /^[[{]\n( +)/.exec(before)?.[1].length ?? 0;
  const newline = before.endsWith('\n') ? '\n' : '';
  if (JSON.stringify(JSON.parse(before), null, indent) + newline !== before) {
    throw new Error('file does not round-trip through JSON; refusing to rewrite it');
  }
  return JSON.stringify(data, null, indent) + newline;
}
const target = publish ? extractDir : stagingDir;
mkdirSync(target, { recursive: true });
const changedFiles = new Set([...renames.map(({ file }) => file), ...(photoMoves.length ? [photoFile] : [])]);
if (distractorEdits) for (const file of [...GEOMETRIC_FILES, ...BY_ID_FILES]) changedFiles.add(file);
for (const file of changedFiles) {
  const before = readFileSync(path.join(extractDir, file), 'utf8');
  const after = encode(before, output.get(file));
  if (after === before) continue;
  writeFileSync(path.join(target, file), after);
  const bytes = statSync(path.join(target, file)).size - Buffer.byteLength(before);
  console.log(`${publish ? 'Published' : 'Staged'} ${path.join(target, file)} (${bytes >= 0 ? '+' : ''}${bytes} bytes)`);
}
if (!publish) console.log('Review the table, then rerun with --publish.');
