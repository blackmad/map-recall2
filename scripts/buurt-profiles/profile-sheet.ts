/**
 * Before/after sheet for the buurt profiles: per spot the panorama, then what the generic generator would draw there
 * with the BEFORE set and the AFTER set (profile level own / wijk / city, the era the nearest pand takes, its wall
 * swatches by weight, the traits and the storey height). The baked world cells are the runtime now, so the swatch card
 * is the sheet until the integrator has compiled and published cells (then ride frames can replace the cards).
 *
 *   node --import tsx scripts/buurt-profiles/profile-sheet.ts --spots=a.json,b.json --panos=<dir with <slug>.jpg> \
 *     --before=<buurt-profiles.json> --after=<buurt-profiles.json> --out=<sheet.jpg> [--per=2]
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { BuurtProfileIndex, type BuurtProfileSet, type EraProfile } from '../../src/canalRecall/buurtProfiles/profiles.ts';
import { archetypeFor } from '../../src/canalRecall/bayTextures.ts';
import { PERIOD_WALLS } from '../../src/canalRecall/look/palette.ts';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
type Spot = { name: string; slug: string; lng: number; lat: number; bearing: number; new?: boolean };
const spots: Spot[] = (arg('spots')!.split(',')).flatMap((f, i) => (JSON.parse(fs.readFileSync(f, 'utf8')) as Spot[]).map(s => ({ ...s, new: i > 0 })));
const load = (f: string) => new BuurtProfileIndex(JSON.parse(fs.readFileSync(f, 'utf8')) as BuurtProfileSet);
const before = load(arg('before')!), after = load(arg('after')!);
const panos = arg('panos')!, PER = Number(arg('per') ?? 2);

const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, s = Math.sin(lat * Math.PI / 180); return { x: Math.floor((lng + 180) / 360 * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) }; };
function nearestPand(lng: number, lat: number): { year: number | null; height: number } {
  const t = tileOf(lng, lat); let best = { d: 1e9, year: null as number | null, height: 12 };
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    const f = `public/data/extracts/amsterdam/bag-tiles/14/${t.x + dx}/${t.y + dy}.geojson.gz`;
    if (!fs.existsSync(f)) continue;
    for (const feat of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features ?? []) {
      const ring = feat.geometry?.type === 'Polygon' ? feat.geometry.coordinates[0] : null; if (!ring) continue;
      const y = Number(feat.properties.year);
      if (!(y > 1500 && y < 1945)) continue;
      const d = Math.hypot((ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length - lng) * 67.9, (ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length - lat) * 111);
      if (d < best.d) best = { d, year: y, height: Number(feat.properties.height) || 12 };
    }
  }
  return best;
}

const W = 420, H = 262, CW = 300, LH = 26;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function card(idx: BuurtProfileIndex, s: Spot, era: string): Buffer {
  const p = idx.at(s.lng, s.lat), e: EraProfile | undefined = p?.eras[era as keyof typeof p.eras];
  const level = !p ? 'city default' : p.level === 'buurt' ? `own: ${p.name} (n ${p.n})` : `wijk fallback: ${p.name} (n ${p.n})`;
  const walls: readonly (readonly [string, number])[] = e?.walls ?? (PERIOD_WALLS.photo[era as 'c19'] ?? []).map(h => [h, 1] as const);
  const total = walls.reduce((a, [, w]) => a + w, 0) || 1;
  let x = 0; const bars = walls.map(([h, w]) => { const bw = w / total * (CW - 20), r = `<rect x="${10 + x}" y="64" width="${bw.toFixed(1)}" height="60" fill="${h}"/>`; x += bw; return r; }).join('');
  const pct = (v?: number) => v === undefined ? '-' : `${Math.round(v * 100)}%`;
  const rows = [`era ${era}${e ? ` (n ${e.n})` : ' (no profile era)'}`, `painted ${pct(e?.paintedShare)}  pale ${pct(e?.paleAccentShare)}  arch ${pct(e?.archShare)}`, `tall ${pct(e?.tallShare)}  dark frames ${pct(e?.darkFrameShare)}`, `storey ${e?.storeyHeightM ? e.storeyHeightM.toFixed(2) + ' m' : 'nominal'}  shops ${pct(p?.shopfrontShare ?? p?.shopShare)}`];
  const svg = `<svg width="${CW}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1a1a1a"/><text x="10" y="24" font-family="Helvetica" font-size="14" fill="#fff">${esc(level)}</text><text x="10" y="46" font-family="Helvetica" font-size="12" fill="#bbb">wall swatches by weight</text>${bars}${rows.map((r, i) => `<text x="10" y="${150 + i * 22}" font-family="Helvetica" font-size="13" fill="#ddd">${esc(r)}</text>`).join('')}</svg>`;
  return Buffer.from(svg);
}

const cellW = W + 2 * CW, rows = Math.ceil(spots.length / PER), comps: sharp.OverlayOptions[] = [];
for (const [i, s] of spots.entries()) {
  const x0 = (i % PER) * (cellW + 10), y0 = Math.floor(i / PER) * (H + LH);
  const pand = nearestPand(s.lng, s.lat), era = archetypeFor(s.slug, pand.year, pand.height);
  const file = `${panos}/${s.slug}.jpg`;
  const photo = fs.existsSync(file) ? await sharp(file).resize(W, H, { fit: 'cover' }).jpeg().toBuffer() : await sharp({ create: { width: W, height: H, channels: 3, background: '#444' } }).jpeg().toBuffer();
  comps.push({ input: photo, left: x0, top: y0 }, { input: await sharp(card(before, s, era)).png().toBuffer(), left: x0 + W, top: y0 }, { input: await sharp(card(after, s, era)).png().toBuffer(), left: x0 + W + CW, top: y0 });
  comps.push({ input: Buffer.from(`<svg width="${cellW}" height="${LH}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="18" font-family="Helvetica" font-size="14" fill="#fff">${i + 1}${s.new ? ' NEW' : ''}. ${esc(s.name)} - photo | before | after</text></svg>`), left: x0, top: y0 + H });
}
await sharp({ create: { width: PER * cellW + (PER - 1) * 10, height: rows * (H + LH), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 84 }).toFile(arg('out')!);
console.log(arg('out'));
