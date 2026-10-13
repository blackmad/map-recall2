/**
 * Removes photographs that are not views of their place (src/mapRecall/photoBlacklist.ts) from
 * `public/data/extracts/<city>/area-photos.json`. Order and the file's 1-space JSON layout are kept.
 *
 *   node --import tsx scripts/prune-area-photos.ts --city all --check
 *   node --import tsx scripts/prune-area-photos.ts --city all --write
 *   node --import tsx scripts/prune-area-photos.ts --city amsterdam --check
 *
 * --check lists what would go and exits 1 when anything would; --write removes it in place.
 * Areas keep their key, so an area can end with fewer photos (the summary reports which).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unsuitableAreaPhotoReason } from '../src/mapRecall/photoBlacklist.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CITIES = ['amsterdam', 'utrecht', 'rotterdam', 'den-haag'];

function usage(message?: string): never {
  if (message) console.error(message);
  console.error('usage: prune-area-photos.ts --city <amsterdam|utrecht|rotterdam|den-haag|all> (--check | --write)');
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const cityArg = flag('--city');
const write = args.includes('--write');
const check = args.includes('--check');
if (!cityArg || write === check) usage('pick one mode: --check or --write, and a --city');
const cities = cityArg === 'all' ? CITIES : [cityArg];
for (const city of cities) {
  if (!CITIES.includes(city)) usage(`unknown city: ${city}`);
}

interface PhotoEntry { title: string; imageAttribution?: string; [key: string]: unknown }
interface AreaPhotosFile { version?: number; generatedAt?: string; areas: Record<string, PhotoEntry[]> }

const pathFor = (city: string) => join(ROOT, 'public', 'data', 'extracts', city, 'area-photos.json');
let pendingTotal = 0;

for (const city of cities) {
  const path = pathFor(city);
  if (!existsSync(path)) {
    console.log(`${city}: no area-photos.json, skipped`);
    continue;
  }
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw) as AreaPhotosFile;
  const removed: string[] = [];
  const reasons = new Map<string, number>();
  for (const [area, photos] of Object.entries(data.areas)) {
    data.areas[area] = photos.filter((photo) => {
      const reason = unsuitableAreaPhotoReason({ title: photo.title, description: photo.imageAttribution });
      if (!reason) return true;
      removed.push(`${area} | ${photo.title} | ${reason}`);
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      return false;
    });
  }
  pendingTotal += removed.length;
  const summary = [...reasons].map(([reason, n]) => `${reason} ${n}`).join(', ') || 'none';
  console.log(`${city}: ${removed.length} photo(s) not views of the place (${summary})`);
  for (const line of removed) console.log(`  removed: ${line}`);
  if (write && removed.length) {
    writeFileSync(path, `${JSON.stringify(data, null, 1)}\n`);
    console.log(`  wrote ${path}`);
  }
}

if (check && pendingTotal) {
  console.error(`${pendingTotal} photo(s) pending removal; run with --write to apply.`);
  process.exit(1);
}
