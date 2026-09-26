/**
 * Repair landmark name form in the published extracts: lowercase names get a
 * capital, half-translated names take their Dutch Wikipedia title. See
 * `src/canalRecall/landmarkNames.ts` for the rules.
 *
 * Dry run (default) prints the renames and any mixed names it could not fix.
 * `--write` applies them to every top-level JSON file in each city extract:
 * the landmark's own `name` (keeping the old one as `osmName`), the matching
 * `facts.json` entry, and every `distractors` list that quoted the old name.
 *
 * Usage: npx tsx scripts/normalise-landmark-names.ts [--write] [--city=amsterdam]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMixedLanguageName, landmarkRename, type LandmarkRename } from '../src/canalRecall/landmarkNames.ts';

const root = path.resolve('public/data/extracts');
const write = process.argv.includes('--write');
const onlyCity = process.argv.find((value) => value.startsWith('--city='))?.slice(7);

type Json = Record<string, unknown>;

function renameEverywhere(value: unknown, byId: Map<string, LandmarkRename>, byName: Map<string, string>): number {
  let changes = 0;
  if (Array.isArray(value)) {
    for (const item of value) changes += renameEverywhere(item, byId, byName);
    return changes;
  }
  if (!value || typeof value !== 'object') return 0;
  const record = value as Json;
  const rename = typeof record.id === 'string' ? byId.get(record.id) : undefined;
  if (rename && record.name === rename.from) {
    record.name = rename.to;
    changes++;
  }
  if (Array.isArray(record.distractors)) {
    record.distractors = record.distractors.map((entry) => {
      const next = typeof entry === 'string' ? byName.get(entry) : undefined;
      if (next) changes++;
      return next ?? entry;
    });
  }
  for (const [key, child] of Object.entries(record)) {
    if (key !== 'distractors' && child && typeof child === 'object') changes += renameEverywhere(child, byId, byName);
  }
  return changes;
}

async function city(dir: string): Promise<void> {
  const landmarksFile = path.join(dir, 'landmarks.json');
  let landmarks: Json[];
  try {
    landmarks = JSON.parse(await readFile(landmarksFile, 'utf8')) as Json[];
  } catch {
    return;
  }
  const byId = new Map<string, LandmarkRename>();
  const unresolved: string[] = [];
  for (const feature of landmarks) {
    const name = String(feature.name || '');
    const rename = landmarkRename({ name, wikipedia: feature.wikipedia as string | undefined });
    if (rename) byId.set(String(feature.id), rename);
    else if (isMixedLanguageName(name)) unresolved.push(name);
  }
  const byName = new Map([...byId.values()].map((rename) => [rename.from, rename.to]));
  process.stdout.write(`${path.basename(dir)}: ${byId.size} renames\n`);
  for (const rename of byId.values()) process.stdout.write(`  ${rename.reason.padEnd(14)} ${rename.from} → ${rename.to}\n`);
  for (const name of unresolved) process.stdout.write(`  unresolved     ${name} (mixed, no Dutch Wikipedia title)\n`);
  if (!write || byId.size === 0) return;

  for (const feature of landmarks) {
    const rename = byId.get(String(feature.id));
    if (rename && !feature.osmName) feature.osmName = rename.from;
  }
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json'));
  for (const file of files) {
    const target = path.join(dir, file);
    const data = file === 'landmarks.json' ? landmarks : JSON.parse(await readFile(target, 'utf8'));
    const changes = renameEverywhere(data, byId, byName);
    if (changes === 0 && file !== 'landmarks.json') continue;
    const original = await readFile(target, 'utf8');
    const compact = !original.startsWith('[\n') && !original.startsWith('{\n');
    await writeFile(target, (compact ? JSON.stringify(data) : JSON.stringify(data, null, 2)) + (original.endsWith('\n') ? '\n' : ''));
    process.stdout.write(`  wrote ${file} (${changes} name references)\n`);
  }
}

const cities = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && (!onlyCity || entry.name === onlyCity))
  .map((entry) => path.join(root, entry.name));
for (const dir of cities) await city(dir);
