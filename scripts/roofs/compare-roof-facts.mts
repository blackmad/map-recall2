/**
 * Compare a staged roof-facts tree with the published sidecar (or any two trees) and write compare.json beside
 * the staged tree, plus drift-ids.json (roofs gaining/losing a fact at ≥ --drift-floor, by cause).
 *
 *   tsx scripts/roofs/compare-roof-facts.mts --staged=artifacts/roof-facts-staging/mc-0.2
 *     [--published=public/data/extracts/amsterdam/roof-facts] [--drift-floor=0.4] [--furniture-floor=0.35]
 *     [--tiles-before=<bag-tiles/14 of the published build>] [--tiles-after=public/data/extracts/amsterdam/bag-tiles/14]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodeRoofFactTile, type RoofFact, type RoofFactTile } from '../../src/canalRecall/roofs/roofSlots.ts';
import { compareRoofFacts, type PandInput } from './compareRoofFacts.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const STAGED = path.resolve(arg('staged') ?? 'artifacts/roof-facts-staging/mc-0.2');
const PUBLISHED = path.resolve(arg('published') ?? 'public/data/extracts/amsterdam/roof-facts');

function readTree(dir: string): Map<string, RoofFact> {
  const out = new Map<string, RoofFact>();
  for (const x of fs.readdirSync(path.join(dir, '14')).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(dir, '14', x)).filter(n => n.endsWith('.json.gz'))) {
    const tile = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, '14', x, f))).toString('utf8')) as RoofFactTile;
    for (const [id, fact] of decodeRoofFactTile(tile)) out.set(id, fact);
  }
  return out;
}

function readInputs(tilesDir: string): Map<string, PandInput> {
  const out = new Map<string, PandInput>();
  for (const x of fs.readdirSync(tilesDir).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(tilesDir, x)).filter(n => n.endsWith('.geojson.gz'))) {
    const tile = `${x}/${file.replace('.geojson.gz', '')}`;
    for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tilesDir, x, file))).toString('utf8')).features) {
      const id = String(f.properties?.id ?? '');
      if (!id.startsWith('NL.IMBAG.Pand.')) continue;
      out.set(id.slice(14), { tile, roof: Number(f.properties.roof) || 0, outline: crypto.createHash('sha1').update(JSON.stringify(f.geometry?.coordinates ?? null)).digest('hex').slice(0, 12) });
    }
  }
  return out;
}

const before = arg('tiles-before'), after = arg('tiles-after') ?? path.resolve('public/data/extracts/amsterdam/bag-tiles/14');
const { gainedAboveFloorIds, lostAboveFloorIds, ...summary } = compareRoofFacts(readTree(PUBLISHED), readTree(STAGED), {
  driftFloor: Number(arg('drift-floor') ?? 0.4),
  furnitureFloor: Number(arg('furniture-floor') ?? 0.35),
  inputsBefore: before ? readInputs(path.resolve(before)) : undefined,
  inputsAfter: before ? readInputs(after) : undefined,
});
const result = { published: path.relative(process.cwd(), PUBLISHED), staged: path.relative(process.cwd(), STAGED), ...summary };
fs.writeFileSync(path.join(STAGED, 'compare.json'), JSON.stringify(result, null, 1));
fs.writeFileSync(path.join(STAGED, 'drift-ids.json'), JSON.stringify({ gained: Object.fromEntries(gainedAboveFloorIds), lost: Object.fromEntries(lostAboveFloorIds) }));
console.log(JSON.stringify(result, null, 1));
