/**
 * Window cluster sheet: every traced upper-storey opening of the front records, clustered by kind, pane layout, head
 * and proportion, each cluster mapped to the kit's window kind (buildingRecipe/intent.ts WINDOWS) or listed as unmatched.
 *
 *   node --import tsx scripts/front-records/window-clusters.ts --strips <dir of <face>-strip.jpg> [--sheet <out.jpg>] [--json <out.json>]
 *
 * Prints the clusters by count, how many cover 90 % of the windows, and the clusters with no kit kind. The sheet shows
 * each cluster's count, its kit kind and three sample crops (the opening plus 0.25 m, from the strip at the face's
 * registration; fronts mapped from their photo party walls may sit up to ~0.5 m off in these crops).
 * Shop and door openings are left out: the shop band is its own system.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {FrontRecordTable, Opening} from '../../src/canalRecall/houseLine/frontRecord.ts';
import {WINDOWS, type WindowKind} from '../../src/canalRecall/buildingRecipe/intent.ts';
import {tracedFronts} from '../../src/canalRecall/houseLine/windowCorrespondence.ts';
import {shiftFor} from './strip-shift.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/front-records/haarlemmerdijk-block.json'), 'utf8')) as FrontRecordTable;

/** Pane layout words reduced to a few families. */
export function paneFamily(o: Opening): string {
  const p = (o.panes ?? '').toLowerCase();
  if (/loggia/.test(p)) return 'loggia';
  if (/ribbon/.test(p)) return 'ribbon';
  if (/diamond/.test(p)) return 'diamond';
  if (/shutter|panel/.test(p)) return 'shuttered';
  if (/balcon/.test(p) && o.kind !== 'french-door') return 'balconette';
  if (/6\/6|6 lights|8 lights|small/.test(p)) return 'small-panes';
  if (/2\/2/.test(p)) return 'two-over-two';
  if (/transom\+3|5 lights|4 lights|3 lights/.test(p)) return 'multi-light';
  if (/transom\+2|^2$|transom\+1|side light/.test(p)) return p.includes('transom') || p.includes('side') ? 'toplight' : 'two-pane';
  return p === '1' || p === '' ? 'single-pane' : 'other';
}
const prop = (o: Opening) => { const r = o.h / o.w; return r < 0.9 ? 'wide' : r < 1.5 ? 'squarish' : r < 2.2 ? 'tall' : 'very-tall'; };

/** The kit kind a cluster maps to, or null when the kit cannot say it. */
export function kitKind(kind: Opening['kind'], panes: string, head: string, shape: string): WindowKind | null {
  if (kind === 'oriel' || kind === 'french-door' || ['loggia', 'ribbon', 'diamond', 'shuttered', 'balconette'].includes(panes)) return null;
  if (head === 'round' || head === 'pointed') return 'arched';
  if (kind === 'attic') return panes === 'small-panes' ? 'six-pane' : 'plain';
  if (panes === 'two-over-two') return 'sash';
  if (panes === 'small-panes') return kind === 'two-light' ? 'casement-small-panes' : shape === 'wide' ? 'six-pane' : 'sash-6-over-6';
  if (panes === 'toplight') return kind === 'two-light' ? 'casement-transom' : 'casement-toplight';
  if (panes === 'multi-light') return shape === 'wide' ? 'casement-triple' : 'casement-sidelights-toplight';
  if (panes === 'two-pane') return kind === 'two-light' ? 'casement-pair' : 'sash-1-over-1';
  if (panes === 'single-pane') return 'plain';
  return null;
}

interface Item {face: string; key: string; address: string | null; o: Opening; spanPx: [number, number]; x0: number}
const items: Item[] = [];
for (const face of [...new Set(table.records.map(r => r.face))]) {
  const strip = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json'), 'utf8'));
  for (const t of tracedFronts(table, face)) {
    const sp = strip.spans.find((s: {pandId: string}) => s.pandId.endsWith(t.record.pandId));
    if (!sp) continue;
    for (const o of t.front.trace!.storeys.slice(1).flat()) if (o.kind !== 'shop' && o.kind !== 'door') items.push({face, key: t.key, address: t.record.address, o, spanPx: sp.px, x0: 0});
  }
}
const clusters = new Map<string, Item[]>();
for (const it of items) {
  const k = [it.o.kind, paneFamily(it.o), it.o.head ?? 'flat', prop(it.o)].join(' | ');
  clusters.set(k, [...(clusters.get(k) ?? []), it]);
}
const sorted = [...clusters].sort((a, b) => b[1].length - a[1].length);
let acc = 0, n90 = 0;
for (const [, v] of sorted) { if (acc / items.length < 0.9) { acc += v.length; n90++; } }
console.log(`${items.length} traced windows on ${new Set(items.map(i => i.key)).size} fronts, ${sorted.length} clusters; ${n90} clusters cover 90 %`);
const rows = sorted.map(([k, v]) => { const [kind, panes, head, shape] = k.split(' | '); return {cluster: k, count: v.length, kit: kitKind(kind as Opening['kind'], panes, head, shape), v}; });
for (const r of rows) console.log(`${String(r.count).padStart(4)}  ${r.cluster.padEnd(52)} -> ${r.kit ?? 'NO KIT KIND'}`);
const unmatched = rows.filter(r => !r.kit);
console.log(`unmatched: ${unmatched.length} clusters, ${unmatched.reduce((s, r) => s + r.count, 0)} windows`);
const byKit = new Map<string, number>();
for (const r of rows) byKit.set(r.kit ?? 'NO KIT KIND', (byKit.get(r.kit ?? 'NO KIT KIND') ?? 0) + r.count);
console.log('by kit kind:', [...byKit].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
if (!rows.every(r => !r.kit || (WINDOWS as readonly string[]).includes(r.kit))) throw Error('kit kind outside WINDOWS');
if (arg('json')) fs.writeFileSync(arg('json')!, JSON.stringify({windows: items.length, clusters: rows.map(({v, ...r}) => ({...r, samples: v.slice(0, 3).map(i => `${i.address} ${i.o.kind} x ${i.o.x} y ${i.o.y}`)})), cover90: n90}, null, 1) + '\n');

const sheet = arg('sheet'), stripsDir = arg('strips');
if (sheet && stripsDir) {
  const CW = 150, CH = 190, rowH = CH + 10, labelW = 520;
  const comps: sharp.OverlayOptions[] = [];
  const bufs = new Map<string, Buffer>();
  const metas = new Map<string, sharp.Metadata>();
  for (const [i, r] of rows.entries()) {
    const y = 10 + i * rowH;
    comps.push({input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${labelW}" height="${CH}"><text x="8" y="30" font-size="20" fill="#fff" font-family="Helvetica">${r.count} × ${r.cluster.replace(/&/g, '&amp;')}</text><text x="8" y="62" font-size="20" fill="${r.kit ? '#8f8' : '#f88'}" font-family="Helvetica">${r.kit ? `kit: ${r.kit}` : 'no kit kind'}</text></svg>`), left: 0, top: y});
    for (const [j, it] of r.v.slice(0, 3).entries()) {
      const img = path.join(stripsDir, `${it.face}-strip.jpg`);
      if (!bufs.has(img)) { bufs.set(img, fs.readFileSync(img)); metas.set(img, await sharp(img).metadata()); }
      const m = metas.get(img)!, ppm = 40, sh = shiftFor(it.face, it.key.split('#')[0]) * ppm, pad = 0.25 * ppm;
      const left = Math.max(0, Math.round(it.spanPx[0] + sh + it.o.x * ppm - pad)), right = Math.min(m.width!, Math.round(it.spanPx[0] + sh + (it.o.x + it.o.w) * ppm + pad));
      const top = Math.max(0, Math.round(m.height! - (it.o.y + it.o.h) * ppm - pad)), bot = Math.min(m.height!, Math.round(m.height! - it.o.y * ppm + pad));
      if (right - left < 4 || bot - top < 4) continue;
      const crop = await sharp(bufs.get(img)!).extract({left, top, width: right - left, height: bot - top}).resize(CW, CH, {fit: 'contain', background: '#222'}).png().toBuffer();
      comps.push({input: crop, left: labelW + j * (CW + 8), top: y});
    }
  }
  await sharp({create: {width: labelW + 3 * (CW + 8), height: 20 + rows.length * rowH, channels: 3, background: '#111'}}).composite(comps).jpeg({quality: 82}).toFile(sheet);
  console.log(sheet);
}
