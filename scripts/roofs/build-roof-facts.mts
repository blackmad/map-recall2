/**
 * The roof-facts sidecar: per pand, the roof slot and measured colour from the PDOK orthophoto
 * (Beeldmateriaal Nederland, CC BY 4.0), solar share, terrace flag and instanced roof furniture.
 * Same z14 grid as bag-facts. Writes to a staging dir with a report; `--publish` copies the
 * reviewed staging set to `public/data/extracts/amsterdam/roof-facts/`.
 *
 *   tsx scripts/roofs/build-roof-facts.mts [--out=artifacts/roofs/roof-facts] [--tiles=14/8414/5385,...] [--fresh]
 *   tsx scripts/roofs/build-roof-facts.mts --report        (histograms from the staged tiles)
 *   tsx scripts/roofs/build-roof-facts.mts --merge-3dbag  (after bag3d-roof-attributes.mts: dormer flags, glass roofs)
 *   tsx scripts/roofs/build-roof-facts.mts --publish
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { LUCHTFOTO_LICENCE, OrthoMosaic, prefetch, tilesForBoxes } from './orthoTiles.ts';
import { readPands, roofPixels, type Pand } from './roofPixels.ts';
import { detectFurniture, roofRaster } from './detectFurniture.ts';
import { classifyRoof, decodeRoofFactTile, encodeRoofFactTile, MIN_CONFIDENCE, ROOF_SLOTS, type RoofFact, type RoofFactTile } from '../../src/canalRecall/roofs/roofSlots.ts';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const OUT = path.resolve(arg('out') ?? 'artifacts/roofs/roof-facts');
const TILES = path.resolve('public/data/extracts/amsterdam/bag-tiles/14');
const PUBLISHED = path.resolve('public/data/extracts/amsterdam/roof-facts');
const LAYER = 'Actueel_ortho25', LEVEL = 14;
const IMAGERY = `PDOK luchtfotorgb ${LAYER} EPSG:28992 level ${LEVEL} (0.21 m), fetched 2026-10-13`;
/** Furniture only where it is worth drawing and cheap to detect: roofs up to this area (m²). */
const FURNITURE_MAX_AREA = 4000;

/** Kinkerbuurt (Oud-West), the user's viewpoint: Kinkerstraat / Ten Katestraat / Bilderdijkstraat. */
const KINKERBUURT = (() => { const a = lngLatToRd(4.862, 52.362), b = lngLatToRd(4.877, 52.370); return [a[0], a[1], b[0], b[1]] as const; })();
const inKinker = (p: Pand) => { const x = (p.bbox[0] + p.bbox[2]) / 2, y = (p.bbox[1] + p.bbox[3]) / 2; return x >= KINKERBUURT[0] && x <= KINKERBUURT[2] && y >= KINKERBUURT[1] && y <= KINKERBUURT[3]; };

function report() {
  const city: Record<string, number> = {}, kinker: Record<string, number> = {}, furniture: Record<string, number> = {}, kinds = ['chimney', 'vent', 'skylight', 'hvac', 'overrun', 'solar', 'railing'];
  let pands = 0, confident = 0, bytes = 0, terraces = 0, withFurniture = 0;
  const kinkerIds = fs.existsSync(path.join(OUT, 'kinkerbuurt-ids.json')) ? new Set<string>(JSON.parse(fs.readFileSync(path.join(OUT, 'kinkerbuurt-ids.json'), 'utf8'))) : new Set<string>();
  for (const x of fs.readdirSync(path.join(OUT, '14')).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(OUT, '14', x)).filter(n => n.endsWith('.json.gz'))) {
    const buf = fs.readFileSync(path.join(OUT, '14', x, f)); bytes += buf.length;
    const tile = JSON.parse(zlib.gunzipSync(buf).toString('utf8')) as RoofFactTile, facts = decodeRoofFactTile(tile);
    pands += tile.read;
    for (const [id, fact] of facts) {
      if (fact.confidence < MIN_CONFIDENCE) continue;
      confident++;
      city[fact.slot] = (city[fact.slot] ?? 0) + 1;
      if (kinkerIds.has(id)) kinker[fact.slot] = (kinker[fact.slot] ?? 0) + 1;
      if (fact.terrace) terraces++;
      if (fact.furniture.length) withFurniture++;
      for (const it of fact.furniture) furniture[it.kind] = (furniture[it.kind] ?? 0) + 1;
    }
  }
  const pct = (h: Record<string, number>) => { const t = Object.values(h).reduce((a, b) => a + b, 0); return Object.fromEntries(ROOF_SLOTS.filter(s => h[s]).map(s => [s, `${h[s]} (${(100 * h[s] / t).toFixed(1)} %)`])); };
  const out = { pands, confident, sidecarBytes: bytes, terraces, withFurniture, furniture: Object.fromEntries(kinds.filter(k => furniture[k]).map(k => [k, furniture[k]])), city: pct(city), kinkerbuurt: pct(kinker), kinkerbuurtPands: kinkerIds.size };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

async function build() {
  const only = arg('tiles')?.split(',').map(t => t.replace(/^14\//, ''));
  const byTile = new Map<string, Pand[]>();
  for (const p of readPands(TILES, only ? t => only.includes(t) : undefined)) (byTile.get(p.tile) ?? byTile.set(p.tile, []).get(p.tile)!).push(p);
  const kinkerIds: string[] = [];
  for (const list of byTile.values()) for (const p of list) if (inKinker(p)) kinkerIds.push(p.id);
  fs.mkdirSync(OUT, { recursive: true });
  if (!only) fs.writeFileSync(path.join(OUT, 'kinkerbuurt-ids.json'), JSON.stringify(kinkerIds));
  // Nearest the Dam first, so a partial run covers the centre.
  const dam = lngLatToRd(4.8936, 52.3728);
  const order = [...byTile.entries()].sort(([, a], [, b]) => {
    const d = (l: Pand[]) => Math.hypot((l[0].bbox[0] - dam[0]), (l[0].bbox[1] - dam[1]));
    return d(a) - d(b);
  });
  let done = 0;
  const t0 = Date.now();
  for (const [tile, pands] of order) {
    const file = path.join(OUT, '14', `${tile}.json.gz`);
    done++;
    if (fs.existsSync(file) && !process.argv.includes('--fresh')) continue;
    const t1 = Date.now();
    const tiles = tilesForBoxes(pands.map(p => p.bbox), LEVEL);
    const [fetched, missing] = await prefetch(LAYER, LEVEL, tiles, 32);
    const mosaic = new OrthoMosaic(LAYER, LEVEL);
    const entries: Array<[string, RoofFact]> = [];
    // Row-major over the tile so decoded ortho tiles are reused before being dropped.
    pands.sort((a, b) => Math.floor(b.bbox[3] / 50) - Math.floor(a.bbox[3] / 50) || a.bbox[0] - b.bbox[0]);
    for (const p of pands) {
      const [a, b, c, d] = p.bbox;
      await mosaic.load(a, b, c, d, 4);
      const px = roofPixels(p, mosaic);
      const reading = classifyRoof(px.rgb, px.n, p.roof);
      if (!reading) continue;
      let furniture: RoofFact['furniture'] = [];
      if (p.roof !== 3 && p.areaM2 <= FURNITURE_MAX_AREA && reading.confidence >= MIN_CONFIDENCE) {
        const raster = roofRaster(p, mosaic);
        if (raster) furniture = detectFurniture(p, raster);
      }
      entries.push([p.id, { slot: reading.slot, rgb: reading.rgb, confidence: reading.confidence, solarShare: reading.solarShare, terrace: reading.terrace, furniture }]);
      if (mosaic.size > 2500) mosaic.clear();
    }
    const encoded = encodeRoofFactTile(entries, LUCHTFOTO_LICENCE, IMAGERY);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(encoded), { level: 9 }));
    console.log(`${done}/${order.length} ${tile}: ${pands.length} pands, ${entries.length} read, ortho ${tiles.length} (${fetched} new, ${missing} missing), ${((Date.now() - t1) / 1000).toFixed(0)} s, total ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
}

/**
 * Fold 3DBAG roof attributes into the staged tiles (`bag3d-roof-attributes.mts`): the dormer flag on every
 * stored pand (true or false, so the runtime stops guessing), and a glass roof (b3_is_glas_dak) as the glass slot.
 */
function merge3dbag() {
  const attrs = JSON.parse(fs.readFileSync(path.resolve('artifacts/roofs/bag3d-roof-attributes.json'), 'utf8')) as Record<string, [number, number]>;
  let dormers = 0, glass = 0, relabelled = 0;
  // Tiles staged before the flat-brown rule (classifyRoof: brown on a flat roof is felt or a deck) get it here.
  const pitched = new Set<string>();
  for (const p of readPands(TILES)) if (p.roof === 3) pitched.add(p.id);
  for (const x of fs.readdirSync(path.join(OUT, '14')).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(OUT, '14', x)).filter(n => n.endsWith('.json.gz'))) {
    const file = path.join(OUT, '14', x, f), tile = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as RoofFactTile;
    const facts = decodeRoofFactTile(tile);
    for (const [id, fact] of facts) {
      const a = attrs[id];
      fact.dormer = a?.[0] === 1;
      if (fact.dormer) dormers++;
      if (fact.slot === 'pantile-dark' && !pitched.has(id)) { fact.slot = fact.terrace ? 'terrace' : 'bitumen-dark'; relabelled++; }
      if (a?.[1] === 1) { fact.slot = 'glass'; glass++; }
    }
    const encoded = encodeRoofFactTile([...facts.entries()], tile.licence, tile.imagery, 0);
    encoded.read = tile.read;
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(encoded), { level: 9 }));
  }
  console.log(`merged 3DBAG attributes: ${dormers} stored pands with dormers, ${glass} glass roofs; ${relabelled} flat pantile-dark relabelled`);
}

function publish() {
  fs.rmSync(PUBLISHED, { recursive: true, force: true });
  fs.cpSync(path.join(OUT, '14'), path.join(PUBLISHED, '14'), { recursive: true });
  fs.writeFileSync(path.join(PUBLISHED, 'README.md'), `# roof-facts\n\nPer BAG pand: roof slot, measured colour, confidence, solar share, terrace flag, roof furniture.\nBuilt by \`scripts/roofs/build-roof-facts.mts\` (format: \`src/canalRecall/roofs/roofSlots.ts\`).\n\nImagery: ${IMAGERY}.\nLicence: ${LUCHTFOTO_LICENCE}.\n`);
  console.log('published to', PUBLISHED);
}

if (process.argv.includes('--publish')) publish();
else if (process.argv.includes('--report')) report();
else if (process.argv.includes('--merge-3dbag')) { merge3dbag(); report(); }
else { await build(); report(); }
