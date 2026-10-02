// Gallery data: built specs + the businesses still without a storefront (run after gallery-tiles.mjs).
import fs from 'node:fs';
import sharp from 'sharp';
const A = 'tmp/storefronts/artifact', R = 'tmp/storefronts/refs';
const cand = Object.fromEntries(fs.readFileSync('tmp/storefronts/candidates.tsv', 'utf8').trim().split('\n').map(l => l.split('\t')).map(([slug, name, kind, lng, lat]) => [slug, { name, kind, lng: +lng, lat: +lat }]));
const specs = JSON.parse(fs.readFileSync('tmp/storefronts/gallery-specs.json', 'utf8'));
const src = fs.readFileSync('src/canalRecall/storefrontSpecs.ts', 'utf8');
const nulls = [...src.matchAll(/^  '([^']+)': null/gm)].map(m => m[1]);
const built = specs.map(s => ({ ...s, ...(cand[s.slug] ? { kind: cand[s.slug].kind, lng: cand[s.slug].lng, lat: cand[s.slug].lat, osmName: cand[s.slug].name } : {}) }));
const skipped = [];
for (const slug of Object.keys(cand)) {
  if (specs.some(s => s.slug === slug)) continue;
  const c = cand[slug], metaPath = `${R}/${slug}.json`;
  let meta = null; try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  let reason, image = null;
  if (!meta || !(meta.width > 20)) reason = 'nopano';
  else {
    reason = meta.wall.lengthM > 30 ? 'long' : 'unreadable';
    await sharp(`${R}/${meta.image}`).resize({ width: 720, height: 340, fit: 'inside' }).jpeg({ quality: 72 }).toFile(`${A}/skipped/${slug}.jpg`);
    image = `skipped/${slug}.jpg`;
  }
  skipped.push({ slug, name: c.name, kind: c.kind, lng: c.lng, lat: c.lat, reason, image, wallM: meta?.wall?.lengthM ?? null, pinAt: meta && meta.nearAlongM != null ? meta.nearAlongM / meta.wall.lengthM : null, wasNull: nulls.includes(slug) });
}
skipped.forEach((s, i) => s.id = `S${String(i + 1).padStart(2, '0')}`);
fs.writeFileSync(`${A}/data.json`, JSON.stringify({ built, skipped }));
console.log(built.length, skipped.length, skipped.filter(s => s.reason === 'nopano').length, 'nopano', skipped.filter(s => s.reason === 'long').length, 'long');
