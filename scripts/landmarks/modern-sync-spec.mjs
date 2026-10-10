// Usage: node scripts/landmarks/modern-sync-spec.mjs <id> [w123,w456,...]
// Re-reads scripts/landmarks/<id>-spec.json and replaces that model's block in manualCatalogue.json textually
// (entries appended by modern-install.mjs sit at column 0), so the rest of the file keeps its formatting.
// Optional OSM way ids are put in front of the pand id in the spec's suppressOsmIds first.
import fs from 'node:fs';
const [id, ways] = process.argv.slice(2);
const specPath = `scripts/landmarks/${id}-spec.json`;
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
if (ways) {
  const pand = spec.suppressOsmIds.filter(x => x.startsWith('NL.IMBAG.'));
  spec.suppressOsmIds = [...ways.split(','), ...pand];
}
fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
const catPath = 'src/canalRecall/landmarks/manualCatalogue.json';
const text = fs.readFileSync(catPath, 'utf8');
const start = text.indexOf(`\n{\n  "id": "${id}",`);
if (start < 0) throw Error('not installed at column 0: ' + id);
const end = text.indexOf('\n}', start + 3) + 2;
const next = '\n' + JSON.stringify(spec, null, 2);
fs.writeFileSync(catPath, text.slice(0, start) + next + text.slice(end));
JSON.parse(fs.readFileSync(catPath, 'utf8'));
console.log('synced', id, spec.suppressOsmIds.length, 'suppress ids');
