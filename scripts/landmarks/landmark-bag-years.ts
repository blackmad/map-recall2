/**
 * BAG construction year per installed model, for the city look's era-dependent
 * slot layers (`?cityLook=1`, look/cityLook.ts `slotLayerOf(slot, { year })`:
 * the 20th-century brick from PERIOD_FROM.school on).
 *
 * Join: `covers.json` (model -> the pands it stands on) against the BAG-keyed
 * base tiles (`bag-tiles/14/x/y.geojson.gz`, property `year`). A model on
 * several pands takes the year of the largest one (a church keeps its own
 * year, not its 1990s annex). Output is staging; the integrator publishes the
 * years into the placement catalogue as `bagYear` (signature-landmarks-source.js
 * passes `spec.bagYear` to the city look; without it the model keeps the
 * canal-era brick, which is what every model drew before).
 *
 * Usage: tsx scripts/landmarks/landmark-bag-years.ts [--out=artifacts/citylook-review/landmark-bag-years.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { periodForYear } from '../../src/canalRecall/look/palette';

const ROOT = path.resolve(import.meta.dirname, '../..');
const flag = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const tilesDir = flag('tiles') ?? path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
const coversFile = flag('covers') ?? path.join(ROOT, 'public/canal-drive/models/covers.json');
const outFile = path.resolve(ROOT, flag('out') ?? 'artifacts/citylook-review/landmark-bag-years.json');

type Ring = [number, number][];
/** Planar ring area in square metres (local equirectangular). */
function ringArea(ring: Ring): number {
  const lat = ring[0]?.[1] ?? 52.37, kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
  return Math.abs(a) / 2;
}

/**
 * BAG's `oorspronkelijkBouwjaar` records a rebuild or renovation year for some
 * monuments (gallery review 2026-10-13: the Westerkerk pand says 1990, the
 * Rijksmuseum 2013). Corrections only from a sourced construction year; a model
 * listed here takes this year instead of the BAG one. Suspects without a source
 * are listed by the review (TODO), not guessed.
 */
const SOURCED_YEARS: Record<string, { year: number; source: string }> = {
  westerkerk: { year: 1631, source: 'https://en.wikipedia.org/wiki/Westerkerk' },
  rijksmuseum: { year: 1885, source: 'https://en.wikipedia.org/wiki/Rijksmuseum' },
  'hollandsche-schouwburg': { year: 1892, source: 'https://en.wikipedia.org/wiki/Hollandsche_Schouwburg' },
};

const pands = new Map<string, { year: number | null; area: number }>();
for (const x of fs.readdirSync(tilesDir).filter(n => /^\d+$/.test(n))) {
  for (const file of fs.readdirSync(path.join(tilesDir, x)).filter(n => n.endsWith('.geojson.gz'))) {
    const collection = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tilesDir, x, file))).toString('utf8'));
    for (const f of collection.features) {
      const id = String(f.properties?.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.')) continue;
      const g = f.geometry;
      const polys: Ring[][] = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
      const area = polys.reduce((s, p) => s + ringArea(p[0] ?? []), 0);
      const year = Number.isFinite(f.properties.year) ? f.properties.year : null;
      const prior = pands.get(id);
      pands.set(id, { year: prior?.year ?? year, area: (prior?.area ?? 0) + area });
    }
  }
}

const covers = JSON.parse(fs.readFileSync(coversFile, 'utf8')) as { models: Record<string, { p?: string[]; o?: string[] }> };
const models: Record<string, { year: number; pand: string; pands: number; bagYear?: number; source?: string }> = {};
const missing: string[] = [];
const eras: Record<string, number> = {};
for (const [id, entry] of Object.entries(covers.models)) {
  const ids = [...(entry.p ?? []).map(p => `NL.IMBAG.Pand.${p}`), ...(entry.o ?? []).filter(o => o.startsWith('NL.IMBAG.Pand.'))];
  let best: { id: string; year: number; area: number } | null = null;
  for (const pid of ids) {
    const pand = pands.get(pid);
    if (!pand || pand.year === null || pand.year < 1000) continue;
    if (!best || pand.area > best.area) best = { id: pid, year: pand.year, area: pand.area };
  }
  if (!best) { missing.push(id); continue; }
  const fix = SOURCED_YEARS[id];
  models[id] = { year: fix?.year ?? best.year, pand: best.id.replace('NL.IMBAG.Pand.', ''), pands: ids.length, ...(fix ? { bagYear: best.year, source: fix.source } : {}) };
  const era = periodForYear(models[id].year);
  eras[era] = (eras[era] ?? 0) + 1;
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ generatedBy: 'scripts/landmarks/landmark-bag-years.ts', rule: 'year of the largest covered pand', models }, null, 1) + '\n');
console.log(`pands indexed: ${pands.size}`);
console.log(`models in covers: ${Object.keys(covers.models).length}; with a BAG year: ${Object.keys(models).length}; without: ${missing.length}`);
console.log(`eras: ${JSON.stringify(eras)}`);
if (missing.length) console.log(`no year: ${missing.join(', ')}`);
console.log(`wrote ${path.relative(ROOT, outFile)}`);
