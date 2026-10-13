// Writes public/canal-drive/models/model-first-added.json: the commit date on
// which each runtime GLB first entered the repository.
//
// model-dates.json records the latest asset rebuild, which every re-export
// touches, so it cannot answer "what is new". The What's new page reads this
// file for first-installed dates. Run after installing models:
//   node --import tsx scripts/build-model-first-added.ts
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

const ROOT = 'public/canal-drive/';
const log = execFileSync('git', ['log', '--diff-filter=A', '--name-only', '--format=@%aI', '--reverse', '--', `${ROOT}models`], {
  encoding: 'utf8', maxBuffer: 1 << 28,
});
const firstAdded: Record<string, string> = {};
let date = '';
for (const line of log.split('\n')) {
  if (line.startsWith('@')) { date = line.slice(1); continue; }
  if (!line.endsWith('.glb') || !line.startsWith(ROOT)) continue;
  const path = line.slice(ROOT.length);
  // --reverse lists oldest first; a file re-added after deletion keeps its first date.
  if (!(path in firstAdded) && existsSync(line)) firstAdded[path] = date;
}
const sorted = Object.fromEntries(Object.entries(firstAdded).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(`${ROOT}models/model-first-added.json`, `${JSON.stringify({
  version: 1, generatedBy: 'scripts/build-model-first-added.ts',
  note: 'First commit date of each runtime GLB, keyed by path relative to /canal-drive/.',
  models: sorted,
}, null, 2)}\n`);
console.log(`${Object.keys(sorted).length} models dated`);
