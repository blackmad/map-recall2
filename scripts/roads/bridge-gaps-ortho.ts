// Bridge road gaps against the photo (lane road-bridge-gaps 2026-11-01, issue #178): per spot, PDOK 8 cm orthophoto |
// own ground top-down with the bridge-gap fix off | on (game palette, roads-v1, LOD 0), one JPEG per spot and a strip.
//
//   ORTHO_CACHE=~/Code/map-recall2/.cache/pdok-ortho-8cm npx tsx scripts/roads/bridge-gaps-ortho.ts [--out=artifacts/roads/bridge-gaps/ortho] [--half=45] name:lng,lat[,halfM] ...
//   … --top=5 --label=before    the five worst street ways of artifacts/roads/bridge-gaps/<label>/summary.json
//   … --now                     orthophoto | own ground as built now (two panels: the measurement's evidence)
//   … --step3                   before = steps 1-2 (dryWayDecks off), after = with the dry way decks (step 3)
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { rasterTopDown } from '../own-ground/render-topdown.ts';
import { paletteColours } from '../own-ground/road-look-v2.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from '../own-ground/ortho.ts';

const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const read = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

interface Spot { name: string; lng: number; lat: number; half: number }
const half0 = Number(flag('half') ?? 45);
const spots: Spot[] = process.argv.slice(2).filter(a => !a.startsWith('--')).map(a => {
  const [name, rest] = a.split(':'), [lng, lat, h] = rest.split(',').map(Number);
  return { name, lng, lat, half: h || half0 };
});
if (flag('top')) {
  const s = JSON.parse(readFileSync(`artifacts/roads/bridge-gaps/${flag('label') ?? 'before'}/summary.json`, 'utf8')) as { top20: { id: number; name: string; lng: number; lat: number }[] };
  for (const r of s.top20.slice(0, Number(flag('top')))) spots.push({ name: `${r.id}-${r.name.replace(/[^A-Za-z0-9]+/g, '-')}`, lng: r.lng, lat: r.lat, half: half0 });
}
const out = flag('out') ?? 'artifacts/roads/bridge-gaps/ortho';
mkdirSync(out, { recursive: true });

const now = process.argv.includes('--now');
const step3 = process.argv.includes('--step3');
const stores = step3
  ? { off: new GroundStore(read, { roads: true, dryWayDecks: false }), on: new GroundStore(read, { roads: true, dryWayDecks: true }) }
  : { off: new GroundStore(read, { roads: true, bridgeGaps: false }), on: new GroundStore(read, { roads: true, dryWayDecks: false }) };
await stores.on.init(); if (!now) await stores.off.init();
const colours = paletteColours() as Partial<Record<GroundLayer, readonly number[]>>;
const ortho = new OrthoTiles();
const res = 0.1, tile = 520, gap = 4, head = 26, foot = 22;
const rows: Buffer[] = [];
for (const s of spots) {
  const [x, y] = toLocal(s.lng, s.lat), w = Math.round(2 * s.half / res), x0 = x - s.half, y0 = y - s.half;
  const tops: Uint8Array[] = [];
  for (const store of now ? [stores.on] : [stores.off, stores.on]) {
    const keys = new Set<string>();
    for (const k of GroundStore.neighbours(store.cellAt(x, y))) keys.add(k);
    const cells: BuiltCell[] = [];
    for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
    tops.push(rasterTopDown(cells, x0, y0, w, w, res, colours));
  }
  const img = (b: Uint8Array) => sharp(Buffer.from(b), { raw: { width: w, height: w, channels: 3 } }).resize(tile, tile).png().toBuffer();
  const panels = now ? 2 : 3, W = panels * tile + (panels - 1) * gap;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const titles: [string, number][] = now ? [[`${s.name}: PDOK 8 cm orthophoto`, tile / 2], ['own ground now (top-down)', tile + gap + tile / 2]] : [[`${s.name}: PDOK 8 cm orthophoto`, tile / 2], [step3 ? 'steps 1-2' : 'before (?bridgeGaps=0)', tile + gap + tile / 2], [step3 ? 'with step 3 (dry way decks)' : 'after (steps 1-2)', 2 * (tile + gap) + tile / 2]];
  const header = `<svg width="${W}" height="${head}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/>${titles.map(([t, cx]) => `<text x="${cx}" y="18" font-family="Helvetica" font-size="14" fill="#fff" text-anchor="middle">${esc(t)}</text>`).join('')}</svg>`;
  const footer = `<svg width="${W}" height="${foot}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="15" font-family="Helvetica" font-size="12" fill="#ddd">${esc(`${s.lng},${s.lat} · ${2 * s.half} m, north up · top-down own ground, game palette · ${ORTHO_ATTRIBUTION}`)}</text></svg>`;
  const row = await sharp({ create: { width: W, height: head + tile + foot, channels: 3, background: '#222' } }).composite([
    { input: Buffer.from(header), left: 0, top: 0 },
    { input: await img(await ortho.crop(x0, y0, w, w, res)), left: 0, top: head },
    ...await Promise.all(tops.map(async (t, i) => ({ input: await img(t), left: (i + 1) * (tile + gap), top: head }))),
    { input: Buffer.from(footer), left: 0, top: head + tile },
  ]).png().toBuffer();
  await sharp(row).jpeg({ quality: 85 }).toFile(join(out, `${s.name}.jpg`));
  rows.push(row);
  console.log(join(out, `${s.name}.jpg`));
}
if (rows.length > 1) {
  const meta = await sharp(rows[0]).metadata();
  await sharp({ create: { width: meta.width!, height: meta.height! * rows.length, channels: 3, background: '#222' } })
    .composite(rows.map((r, i) => ({ input: r, left: 0, top: i * meta.height! }))).jpeg({ quality: 82 }).toFile(join(out, 'strip.jpg'));
  console.log(join(out, 'strip.jpg'), existsSync(join(out, 'strip.jpg')));
}
