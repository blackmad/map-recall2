// PDOK 8 cm orthophoto crop per sampled boat, rotated into the boat frame (length
// horizontal) with the OSM outline overlaid, and contact sheets of 12 for labelling.
//   npx tsx scripts/houseboat-kinds/crops.ts [ids.json] -> artifacts/houseboat-kinds/crops/*.png, sheets/*.png
import fs from 'node:fs';
import proj4 from 'proj4';
import sharp from 'sharp';
import { houseboatFrame, type Houseboat } from '../../src/canalRecall/houseboats.ts';

const RD = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';
const OUT = 'artifacts/houseboat-kinds', SET = process.env.SET ?? 'sheets';
// Blind order for labelling: shuffled by a hash of the id, never grouped by classifier output.
const hashId = (t: string) => { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const ids: string[] = (JSON.parse(fs.readFileSync(process.argv[2] ?? `${OUT}/sample.json`, 'utf8')) as string[]).sort((a, b) => hashId(a) - hashId(b));
fs.writeFileSync(`${OUT}/${SET}-order.json`, JSON.stringify(ids));
const { boats }: { boats: Houseboat[] } = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/houseboats.json', 'utf8'));
const byId = new Map(boats.map(b => [b.id, b]));
// Captions (truth / before / after) only for the review sheets, never while labelling.
const labels: Record<string, string> = process.env.CAPTIONS ? JSON.parse(fs.readFileSync(process.env.CAPTIONS, 'utf8')) : {};
fs.mkdirSync(`${OUT}/crops`, { recursive: true });
fs.mkdirSync(`${OUT}/${SET}`, { recursive: true });
const PX = 0.08, PAD = 5, CW = 560, CH = 260;

async function crop(id: string) {
  const file = `${OUT}/crops/${id}.png`;
  const boat = byId.get(id)!;
  const rd = boat.ring.map(([lng, lat]) => proj4('EPSG:4326', RD, [lng, lat]) as [number, number]);
  const cxr = rd.reduce((a, p) => a + p[0], 0) / rd.length, cyr = rd.reduce((a, p) => a + p[1], 0) / rd.length;
  const fr = houseboatFrame(boat)!;
  const ang = Math.atan2(fr.uy, fr.ux); // long axis, east-north frame (same as RD up to <1 deg)
  const half = Math.hypot(fr.length, fr.width) / 2 + PAD;
  const bbox = [cxr - half, cyr - half, cxr + half, cyr + half];
  const size = Math.round(2 * half / PX);
  const cacheFile = `${OUT}/crops/${id}.jpg`;
  if (!fs.existsSync(cacheFile)) {
    const url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
    url.search = new URLSearchParams({ service: 'WMS', version: '1.3.0', request: 'GetMap', layers: 'Actueel_orthoHR', styles: '', crs: 'EPSG:28992', bbox: bbox.join(','), width: String(size), height: String(size), format: 'image/jpeg' }).toString();
    const res = await fetch(url);
    if (!res.ok) throw Error(`${id}: ${res.status}`);
    fs.writeFileSync(cacheFile, Buffer.from(await res.arrayBuffer()));
  }
  const toPx = ([x, y]: [number, number]) => [(x - bbox[0]) / PX, (bbox[3] - y) / PX];
  const poly = rd.map(p => toPx(p).map(v => v.toFixed(1)).join(',')).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><polygon points="${poly}" fill="none" stroke="#00e5ff" stroke-width="1.2" stroke-opacity="0.75"/></svg>`;
  // Rotate so the long axis is horizontal (sharp rotates clockwise in image space).
  const overlaid = await sharp(cacheFile).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  const rot = await sharp(overlaid).rotate(ang * 180 / Math.PI, { background: '#000' }).png().toBuffer();
  const meta = await sharp(rot).metadata();
  const wPx = Math.min(meta.width!, Math.round((fr.length + 2 * PAD) / PX)), hPx = Math.min(meta.height!, Math.round((fr.width + 2 * PAD) / PX));
  const ex = await sharp(rot).extract({ left: Math.round((meta.width! - wPx) / 2), top: Math.round((meta.height! - hPx) / 2), width: wPx, height: hPx }).png().toBuffer();
  // Raw (no outline) strip too, so the overlay never hides a bow.
  const raw = await sharp(await sharp(cacheFile).rotate(ang * 180 / Math.PI, { background: '#000' }).png().toBuffer()).extract({ left: Math.round((meta.width! - wPx) / 2), top: Math.round((meta.height! - hPx) / 2), width: wPx, height: hPx }).png().toBuffer();
  const scale = Math.min(CW / wPx, (CH / 2 - 2) / hPx);
  const a = await sharp(ex).resize(Math.round(wPx * scale), Math.round(hPx * scale)).png().toBuffer();
  const b = await sharp(raw).resize(Math.round(wPx * scale), Math.round(hPx * scale)).png().toBuffer();
  await sharp({ create: { width: CW, height: CH, channels: 3, background: '#222' } })
    .composite([{ input: b, left: 0, top: 0 }, { input: a, left: 0, top: Math.round(CH / 2) }]).png().toFile(file);
  return { file, L: fr.length, W: fr.width };
}

const done: { id: string; file: string; L: number; W: number }[] = [];
for (let i = 0; i < ids.length; i += 6) {
  const batch = await Promise.all(ids.slice(i, i + 6).map(async id => ({ id, ...(await crop(id)) })));
  done.push(...batch);
}
const COLS = 3, ROWS = 4, TITLE = 22;
for (let s = 0; s * COLS * ROWS < done.length; s++) {
  const items = done.slice(s * COLS * ROWS, (s + 1) * COLS * ROWS);
  const comps = [] as sharp.OverlayOptions[];
  items.forEach((it, k) => {
    const x = (k % COLS) * (CW + 8), y = Math.floor(k / COLS) * (CH + TITLE + 8);
    const caption = `${s * COLS * ROWS + k + 1}. ${it.id}  ${it.L.toFixed(1)}x${it.W.toFixed(1)}m  ${labels[it.id] ?? ''}`;
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${TITLE}"><text x="4" y="16" font-family="Helvetica" font-size="15" fill="#fff">${caption.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`), left: x, top: y });
    comps.push({ input: it.file, left: x, top: y + TITLE });
  });
  await sharp({ create: { width: COLS * (CW + 8), height: ROWS * (CH + TITLE + 8), channels: 3, background: '#111' } }).composite(comps).png().toFile(`${OUT}/${SET}/sheet-${String(s + 1).padStart(2, '0')}.png`);
}
console.log(`crops ${done.length}, sheets ${Math.ceil(done.length / 12)}`);
