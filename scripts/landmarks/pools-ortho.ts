/**
 * Orthophoto crops of the pool sites with the OSM basin and BAG pand outlines drawn over them, to confirm the basins.
 *
 *   node --import tsx scripts/landmarks/pools-ortho.ts [--only=<name substring>] [--pad=25] [--cmpp=10]
 *
 * Reads docs/reports/pools-20261115.json and artifacts/pools/pools.geojsonseq (both written by pools-inventory.ts);
 * fetches PDOK luchtfoto (Actueel_orthoHR, Beeldmateriaal Nederland, CC BY 4.0) in RD for the site box and writes
 * artifacts/pools/ortho/<slug>.jpg (plain) and <slug>-overlay.jpg (OSM basins cyan, BAG panden yellow). Cached.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {cachedBytes, cachedJson, http} from '../pand-reference/core.ts';
import {lngLatToRd} from '../../src/canalRecall/rdCoordinates.ts';

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const ONLY = arg('only', ''), PAD = Number(arg('pad', '25')), CMPP = Number(arg('cmpp', '10'));
const OUTDIR = 'artifacts/pools/ortho';
fs.mkdirSync(OUTDIR, {recursive: true});
export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const inv = JSON.parse(fs.readFileSync('docs/reports/pools-20261115.json', 'utf8'));
const feats = new Map<string, any>();
for (const l of fs.readFileSync('artifacts/pools/pools.geojsonseq', 'utf8').split('\n')) if (l.trim()) { const f = JSON.parse(l.replace(/^\x1e/, '')); feats.set(f.id, f); }
const outer = (g: any): number[][][] => g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p: number[][][]) => p[0]) : [];

for (const pool of inv.pools) {
  if (pool.name === '(unnamed)' || pool.modelled || (ONLY && !pool.name.toLowerCase().includes(ONLY.toLowerCase()))) continue;
  const rd: number[][][] = [];
  for (const id of pool.osm) { const f = feats.get(id); if (f) rd.push(...outer(f.geometry).map(r => r.map(([lng, lat]) => lngLatToRd(lng, lat)))); }
  const basins = pool.basins.map((b: any) => feats.get(b.osm)).filter(Boolean).flatMap((f: any) => outer(f.geometry).map(r => r.map(([lng, lat]: number[]) => lngLatToRd(lng, lat))));
  const pands: number[][][] = [];
  for (const p of pool.pands) {
    const j: any = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p.id}</Literal></PropertyIsEqualTo></Filter>`)}`);
    const g = j.features[0]?.geometry; if (g) pands.push(...outer(g));
  }
  const all = [...rd, ...basins, ...pands].flat();
  if (!all.length) { const [x, y] = lngLatToRd(pool.centre[0], pool.centre[1]); all.push([x - 40, y - 40], [x + 40, y + 40]); }
  let x0 = Math.min(...all.map(p => p[0])) - PAD, x1 = Math.max(...all.map(p => p[0])) + PAD, y0 = Math.min(...all.map(p => p[1])) - PAD, y1 = Math.max(...all.map(p => p[1])) + PAD;
  // Fetched as 64 m tiles of 512 px (12.5 cm/px) and stitched: whole-site requests over ~1,000 px came back blank white at
  // random (2026-11-15), small ones never did. A blank tile is retried a pixel smaller (a new URL, so a new cache entry).
  const TILE_M = 64, TILE_PX = 512, cmpp = (TILE_M * 100) / TILE_PX;
  x0 = Math.floor(x0); y0 = Math.floor(y0);
  const nx = Math.ceil((x1 - x0) / TILE_M), ny = Math.ceil((y1 - y0) / TILE_M);
  x1 = x0 + nx * TILE_M; y1 = y0 + ny * TILE_M;
  const W = nx * TILE_PX, H = ny * TILE_PX, tiles: sharp.OverlayOptions[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const tx0 = Math.round(x0 + i * TILE_M), ty1 = Math.round(y1 - j * TILE_M);
    let tile: Buffer | null = null;
    for (let k = 0; k < 4 && !tile; k++) {
      const px = TILE_PX - k;
      const bytes = await cachedBytes(`https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Actueel_orthoHR&STYLES=&CRS=EPSG:28992&BBOX=${tx0},${ty1 - TILE_M},${tx0 + TILE_M},${ty1}&WIDTH=${px}&HEIGHT=${px}&FORMAT=image/jpeg`, '.jpg');
      if (bytes[0] !== 0xff) throw new Error(`WMS error for ${pool.name}: ${bytes.toString('utf8').slice(0, 300)}`);
      if ((await sharp(bytes).stats()).channels[0].mean < 245) tile = await sharp(bytes).resize(TILE_PX, TILE_PX).toBuffer();
    }
    if (tile) tiles.push({input: tile, left: i * TILE_PX, top: j * TILE_PX});
    else console.log(`  ${pool.name}: tile ${i},${j} blank after 4 tries`);
  }
  const jpg = await sharp({create: {width: W, height: H, channels: 3, background: '#808080'}}).composite(tiles).jpeg({quality: 88}).toBuffer();
  const px = (p: number[]) => `${(((p[0] - x0) / (x1 - x0)) * W).toFixed(1)},${(((y1 - p[1]) / (y1 - y0)) * H).toFixed(1)}`;
  const poly = (r: number[][], c: string, w: number) => `<polygon points="${r.map(px).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  // 10 m scale bar, bottom left
  const bar = `<rect x="20" y="${H - 30}" width="${(1000 / cmpp).toFixed(0)}" height="8" fill="white"/><text x="20" y="${H - 36}" fill="white" font-size="18" font-family="sans-serif">10 m</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${pands.map(r => poly(r, '#ffd400', 3)).join('')}${basins.map((r: number[][]) => poly(r, '#00e5ff', 3)).join('')}${rd.map(r => poly(r, '#ff4fd8', 2)).join('')}${bar}</svg>`;
  const s = slug(pool.name);
  fs.writeFileSync(path.join(OUTDIR, `${s}.jpg`), jpg);
  await sharp(jpg).composite([{input: Buffer.from(svg)}]).jpeg({quality: 85}).toFile(path.join(OUTDIR, `${s}-overlay.jpg`));
  console.log(s, `${W}x${H} @ ${cmpp.toFixed(1)} cm/px`, `RD ${x0.toFixed(0)},${y0.toFixed(0)} - ${x1.toFixed(0)},${y1.toFixed(0)}`, 'basins', basins.length, 'pands', pands.length);
}
