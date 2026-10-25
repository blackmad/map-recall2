// Building-design gallery (GitHub #84): public/canal-drive/designs.html from the
// design specs, the placed houses, the municipal buurt outlines and the pictures
// that scripts/build-designs-images.ts made. Logic in src/canalRecall/designsPage/.
//
//   node --import tsx scripts/build-designs-page.ts           # write designs.html
//   node --import tsx scripts/build-designs-page.ts --check   # exit 1 if designs.html is stale (also checks images.json)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDesigns, totals, type BuurtFeatureInput, type DesignImagesInput, type DesignInstanceInput, type DesignSpecInput } from '../src/canalRecall/designsPage/data';
import { renderDesignsPage } from '../src/canalRecall/designsPage/template';
import type { BoundaryInput } from '../src/canalRecall/buurtPages/data';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANAL = path.join(ROOT, 'public/canal-drive');
const OUT = path.join(CANAL, 'designs.html');
const readJson = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;
const check = process.argv.includes('--check');

const typesDir = path.join(ROOT, 'src/canalRecall/buildingTypes/types');
const specs = readdirSync(typesDir).filter(f => f.endsWith('.json')).sort().map(f => readJson<DesignSpecInput>(path.join(typesDir, f)));
const instances = readJson<DesignInstanceInput[]>(path.join(CANAL, 'building-types/instances.json'));
const buurten = readJson<{ features: BuurtFeatureInput[] }>(path.join(ROOT, 'public/data/extracts/amsterdam/coverage-v1/buurten.json')).features;
const boundaries = readJson<BoundaryInput[]>(path.join(ROOT, 'public/data/extracts/amsterdam/boundaries.json'));
const imagesFile = path.join(CANAL, 'designs/images.json');
const images = existsSync(imagesFile) ? readJson<{ designs: Record<string, DesignImagesInput> }>(imagesFile).designs : {};
const pageSlugs = new Set(readdirSync(path.join(CANAL, 'buurt')).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, '')));

// Pictures must be on disk to be linked.
for (const [id, d] of Object.entries(images)) {
  for (const k of ['photo', 'render'] as const) if (d[k] && !existsSync(path.join(CANAL, d[k]!))) { console.error(`${id}: ${d[k]} missing`); process.exit(1); }
}

const designs = buildDesigns({ specs, instances, buurten, boundaries, images, pageSlugs });
const t = totals(designs);
const html = renderDesignsPage(designs, t);

if (check) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== html) { console.error('designs.html is stale; run: node --import tsx scripts/build-designs-page.ts'); process.exit(1); }
  const noPics = designs.filter(d => !d.images.photo || !d.images.render).map(d => d.id);
  if (noPics.length) console.warn(`designs without pictures (run scripts/build-designs-images.ts): ${noPics.join(', ')}`);
  console.log(`designs.html up to date (${t.designs} designs, ${t.houses} houses)`);
} else {
  writeFileSync(OUT, html);
  const unplaced = designs.filter(d => !d.count).map(d => d.id);
  const unlocated = designs.reduce((s, d) => s + d.count - d.buurten.reduce((a, b) => a + b.count, 0), 0);
  const imgBytes = Object.values(images).flatMap(d => [d.photo, d.render]).filter(Boolean).reduce((s, f) => s + readFileSync(path.join(CANAL, f!)).length, 0);
  console.log(`wrote designs.html: ${t.designs} designs, ${t.houses} houses, ${t.buurten} buurten; html ${(html.length / 1024).toFixed(0)} KB, pictures ${(imgBytes / 1e6).toFixed(2)} MB`);
  if (unplaced.length) console.log(`not placed: ${unplaced.join(', ')}`);
  if (unlocated) console.log(`${unlocated} houses fall outside every buurt outline`);
}
