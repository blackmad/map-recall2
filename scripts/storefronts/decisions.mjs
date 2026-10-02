// Per-business decision log for the evidence branch: status (measured / first-pass / null) and why.
//   node scripts/storefronts/decisions.mjs <notes.json> > decisions.tsv
import fs from 'node:fs';
const src = fs.readFileSync('src/canalRecall/storefrontSpecs.ts', 'utf8');
const notes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const measured = new Set(fs.readFileSync('tmp/storefronts/measured.txt', 'utf8').trim().split('\n'));
const cand = fs.readFileSync('tmp/storefronts/candidates.tsv', 'utf8').trim().split('\n').map(l => l.split('\t'));
console.log(['slug', 'name', 'kind', 'lng', 'lat', 'status', 'note'].join('\t'));
for (const [slug, name, kind, lng, lat] of cand) {
  const m = src.match(new RegExp(`^  '${slug}': (.*)$`, 'm'));
  const status = !m ? 'no-reference' : m[1].startsWith('null') ? 'null' : measured.has(slug) ? 'measured' : 'first-pass';
  console.log([slug, name, kind, lng, lat, status, notes[slug] ?? ''].join('\t'));
}
