// Remove stale suppressOsmIds (ids that match no BAG tile feature and no pand alias) from the catalogue sources.
//   node scripts/prune-stale-suppress.mjs <stale.txt> [--write]
// stale.txt = the `stale` block of `npm run check:covers -- --verbose` ("<spec> <id>" per line). Dry run by default.
// Only deletes quoted ids from the `suppressOsmIds` array that follows the spec's own `id` key; prints what it did.
import fs from 'node:fs';
const [file, ...rest] = process.argv.slice(2);
const write = rest.includes('--write');
const rows = fs.readFileSync(file, 'utf8').split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length >= 2 && p[0] !== 'building-types' && !p[0].endsWith(':') && !/^stale/.test(p[0]));
const SOURCES = ['src/canalRecall/landmarks/manualModels.ts', 'src/canalRecall/landmarks/manualCatalogue.json', 'src/canalRecall/landmarks/signatureModels.ts',
  'src/canalRecall/landmarks/surveyedLandmarks.json', 'src/canalRecall/landmarks/ordinaryModels.ts', 'src/canalRecall/landmarks/ordinaryChunks.ts',
  'src/canalRecall/game/manualPoiCatalog.ts', 'src/canalRecall/streetChunks/manifest.ts'];
const text = Object.fromEntries(SOURCES.filter(f => fs.existsSync(f)).map(f => [f, fs.readFileSync(f, 'utf8')]));
const removed = [], missed = [];
for (const [spec, id] of rows) {
  let done = false;
  for (const f of Object.keys(text)) {
    const re = new RegExp(`(["']?id["']?\\s*:\\s*["']${spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])`, 'g');
    let m;
    while ((m = re.exec(text[f]))) {
      const arr = /(["']?suppressOsmIds["']?\s*:\s*)\[([^\]]*)\]/g;
      arr.lastIndex = m.index;
      const a = arr.exec(text[f]);
      if (!a) continue;
      // The array must belong to this spec: no other spec id key between the id and the array.
      const between = text[f].slice(m.index + m[0].length, a.index);
      if (/["']?\bid["']?\s*:\s*["']/.test(between)) continue;
      // Keep the original formatting: delete the quoted id with its trailing comma/space (or the preceding comma when last).
      const body = a[2];
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m2 = new RegExp(`(["'])${esc}\\1(,[ \\t]*)?`).exec(body);
      if (!m2) continue;
      let nb = body.slice(0, m2.index) + body.slice(m2.index + m2[0].length);
      nb = nb.replace(/\n[ \t]+(?=\n)/g, ''); if (!m2[2]) nb = nb.replace(/,(\s*)$/, '$1');
      text[f] = text[f].slice(0, a.index) + a[1] + '[' + nb + ']' + text[f].slice(a.index + a[0].length);
      removed.push(`${spec} ${id}  (${f})`); done = true; break;
    }
    if (done) break;
  }
  if (!done) missed.push(`${spec} ${id}`);
}
console.log(`removed ${removed.length}, not found in the catalogue sources ${missed.length}`);
for (const m of missed) console.log('  MISSED', m);
if (write) for (const [f, t] of Object.entries(text)) fs.writeFileSync(f, t);
