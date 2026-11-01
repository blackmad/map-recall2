/**
 * Orthophoto contact sheet for garden-room candidates (lane #169): one PDOK crop per pand from the survey JSON
 * (scripts/survey-garden-rooms.ts --json), footprint outlined, so a rule can be checked against the real roofs.
 * Open data: Beeldmateriaal Nederland / PDOK luchtfoto, CC BY 4.0.
 *
 *   tsx scripts/garden-room-ortho-sheet.mts <survey.json> <filter: rule=..|slot=..|year<..> <n> <out.png>
 *   tsx scripts/garden-room-ortho-sheet.mts --at <lng> <lat> <halfM> <out.png>     (one courtyard crop)
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { OrthoMosaic } from './roofs/orthoTiles.ts';
import { lngLatToRd } from '../src/canalRecall/rdCoordinates.ts';

const LAYER = 'Actueel_ortho25', LEVEL = 14;

async function crop(lng: number, lat: number, half: number): Promise<{ png: Buffer; n: number; x0: number; y1: number; res: number }> {
  const [x, y] = lngLatToRd(lng, lat), m = new OrthoMosaic(LAYER, LEVEL);
  await m.load(x - half, y - half, x + half, y + half);
  const n = Math.round(2 * half / m.res), buf = Buffer.alloc(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const p = m.pixel(x - half + (i + .5) * m.res, y + half - (j + .5) * m.res); if (p) buf.set(p, (j * n + i) * 3); }
  return { png: await sharp(buf, { raw: { width: n, height: n, channels: 3 } }).png().toBuffer(), n, x0: x - half, y1: y + half, res: m.res };
}

if (process.argv[2] === '--at') {
  const [lng, lat, half, out] = [Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5]), process.argv[6]];
  const c = await crop(lng, lat, half);
  await sharp(c.png).toFile(out);
  console.log(out, c.n);
} else {
  const [file, filter, count, out] = [process.argv[2], process.argv[3], Number(process.argv[4]), process.argv[5]];
  const survey = JSON.parse(fs.readFileSync(file, 'utf8'));
  const [k, v] = filter.split(/=|</);
  const rooms = (survey.candidates ?? survey.rooms).filter((r: any) => filter.includes('<') ? r[k] !== null && r[k] < Number(v) : String(r[k]) === v).slice(0, count);
  // Footprints from the building tiles.
  const rings = new Map<string, number[][]>();
  const want = new Set(rooms.map((r: any) => r.id));
  const tiles = new Set(rooms.map((r: any) => `${Math.floor((r.lng + 180) / 360 * 2 ** 14)}/${Math.floor((1 - Math.log(Math.tan(r.lat * Math.PI / 180) + 1 / Math.cos(r.lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** 14)}`));
  for (const t of tiles) for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(`public/data/extracts/amsterdam/building-tiles/14/${t}.geojson.gz`)).toString()).features) if (want.has(String(f.properties.id))) rings.set(String(f.properties.id), f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]);
  const S = 160, cols = 6, half = 8, tiles2: sharp.OverlayOptions[] = [];
  for (const [i, r] of rooms.entries()) {
    const c = await crop(r.lng, r.lat, half), sc = S / c.n;
    const pts = (rings.get(r.id) ?? []).map(([lng, lat]) => { const [x, y] = lngLatToRd(lng, lat); return `${((x - c.x0) / c.res * sc).toFixed(1)},${((c.y1 - y) / c.res * sc).toFixed(1)}`; }).join(' ');
    const svg = Buffer.from(`<svg width="${S}" height="${S + 18}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="none" stroke="#ff2bd6" stroke-width="1.5"/><rect y="${S}" width="${S}" height="18" fill="#111"/><text x="4" y="${S + 13}" font-size="11" font-family="Helvetica" fill="#fff">${r.year ?? '----'} ${r.slot ?? 'unread'} ${r.areaM2}m2</text></svg>`);
    const img = await sharp({ create: { width: S, height: S + 18, channels: 3, background: '#111' } }).composite([{ input: await sharp(c.png).resize(S, S).toBuffer(), top: 0, left: 0 }, { input: svg, top: 0, left: 0 }]).png().toBuffer();
    tiles2.push({ input: img, left: (i % cols) * (S + 4), top: Math.floor(i / cols) * (S + 22) });
  }
  const rows = Math.ceil(rooms.length / cols);
  await sharp({ create: { width: cols * (S + 4), height: rows * (S + 22), channels: 3, background: '#222' } }).composite(tiles2).png().toFile(out);
  console.log(out, rooms.length);
}
