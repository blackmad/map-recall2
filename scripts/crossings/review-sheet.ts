// Review sheets for crossing records (lane G3): the PDOK orthophoto under the record's plan, beside the nearest city
// panoramas aimed at the crossing, one JPEG per record (≤ 400 kB, for the screenshots repo).
//
//   npx tsx scripts/crossings/review-sheet.ts --file artifacts/crossings/drafts/named.json [--only id,id] [--out dir] [--game]
//   npx tsx scripts/crossings/review-sheet.ts --file data/crossings/named.json …
//
// Overlay: the zone (yellow, dashed), decks (cyan; magenta where they carry rail), tunnel parts (orange), piers
// (white), listed portals (red arrows), OSM ways bound over (blue) and under (green). --game adds what the game infers
// before the register: tunnels.ts cuts (red outline, dark-mouth portals as red dots) and railSpans.ts spans (thick red).
// Sources: Luchtfoto Beeldmateriaal Nederland (PDOK, CC BY 4.0); panoramas Gemeente Amsterdam (CC BY 4.0).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { OrthoTiles, ORTHO_ATTRIBUTION } from '../own-ground/ortho.ts';
import { fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import type { CrossingFile, CrossingRecord } from '../../src/canalRecall/ownGround/crossings.ts';
import { overpassWays, panoramas, panoramaImage, type LngLat, type PanoRef } from './sources.ts';

export const HELP = `crossings:review — orthophoto + panorama sheets for crossing records.

  npx tsx scripts/crossings/review-sheet.ts --file <register or draft json> [--only id,id] [--out dir] [--game] [--size m]

Writes <out>/<record id>.jpg (default artifacts/crossings/review) and <out>/<record id>.json (the panorama ids and
ortho crop used, to paste into the record's evidence).`;

const args = process.argv.slice(2);
const argOf = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const W = 820, PANO_W = 600, PANO_H = 400;

function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function sheet(r: CrossingRecord, ortho: OrthoTiles, outDir: string, game: GameOverlay | null, sizeM: number): Promise<void> {
  const [cx, cy] = toLocal(r.at[0], r.at[1]), res = sizeM / W, x0 = cx - sizeM / 2, y0 = cy - sizeM / 2;
  const rgb = await ortho.crop(x0, y0, W, W, res);
  const px = (p: LngLat): [number, number] => { const [x, y] = toLocal(p[0], p[1]); return [(x - x0) / res, W - (y - y0) / res]; };
  const pts = (ring: LngLat[]) => ring.map(p => px(p).map(v => v.toFixed(1)).join(',')).join(' ');
  const svg: string[] = [];
  svg.push(`<polygon points="${pts(r.zone)}" fill="none" stroke="#ffd400" stroke-width="2" stroke-dasharray="8 6"/>`);
  for (const d of r.plan.decks) svg.push(`<polygon points="${pts(d.ring)}" fill="${['rail', 'metro', 'tram'].includes(d.carries) ? '#ff40ff' : '#00e5ff'}" fill-opacity="0.12" stroke="${['rail', 'metro', 'tram'].includes(d.carries) ? '#ff40ff' : '#00e5ff'}" stroke-width="2"/>`);
  for (const t of r.plan.tunnels ?? []) svg.push(`<polygon points="${pts(t.ring)}" fill="#ff8c00" fill-opacity="0.15" stroke="#ff8c00" stroke-width="2"/>`);
  for (const p of r.plan.piers ?? []) svg.push(`<polygon points="${pts(p.ring)}" fill="#fff" fill-opacity="0.6" stroke="#000" stroke-width="1"/>`);
  const ways = await waysFor(r);
  for (const w of ways) {
    const colour = r.binds.over.includes(w.id) ? '#3d7bff' : '#33dd55';
    svg.push(`<polyline points="${pts(w.g)}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-opacity="0.9"/>`);
  }
  if (game) {
    for (const c of game.cuts) svg.push(`<polygon points="${pts(c.ring)}" fill="none" stroke="#ff2020" stroke-width="2"/>` + c.mouths.map(m => { const [a, b] = px(m); return `<circle cx="${a}" cy="${b}" r="7" fill="#ff2020"/>`; }).join(''));
    for (const s of game.spans) svg.push(`<polyline points="${pts(s)}" fill="none" stroke="#ff2020" stroke-width="7" stroke-opacity="0.7"/>`);
  }
  for (const p of r.plan.portals ?? []) {
    const [a, b] = px(p.at), t = (p.headingDeg * Math.PI) / 180, dx = Math.sin(t) * 22, dy = -Math.cos(t) * 22;
    svg.push(`<line x1="${a}" y1="${b}" x2="${a + dx}" y2="${b + dy}" stroke="#ff2020" stroke-width="4"/><circle cx="${a}" cy="${b}" r="5" fill="${p.open ? '#fff' : '#000'}" stroke="#ff2020" stroke-width="2"/>`);
  }
  const panos = await panoramas(r.at, 60, 6);
  // Two views: the nearest panorama, and another from a different spot (≥ 15 m away) if there is one.
  const KX = 111320 * Math.cos((52.37 * Math.PI) / 180), KY = 110540;
  const picks: PanoRef[] = [];
  for (const p of panos) if (!picks.length || picks.every(q => Math.hypot((q.at[0] - p.at[0]) * KX, (q.at[1] - p.at[1]) * KY) >= 15)) picks.push(p);
  for (const p of picks.slice(0, 2)) { const [a, b] = px(p.at); svg.push(`<circle cx="${a}" cy="${b}" r="6" fill="#ffd400" stroke="#000"/><text x="${a + 8}" y="${b - 6}" font-size="14" fill="#ffd400" stroke="#000" stroke-width="0.6" font-family="Helvetica">${picks.indexOf(p) + 1}</text>`); }
  const h = r.heights;
  const title = `${r.id} · ${r.kind}${r.reviewed ? ` · reviewed ${r.reviewed.on}` : ' · DRAFT'}`;
  const hl = `street ${h.streetUnder ?? '-'} · deck ${h.deckTop ?? '-'} · soffit ${h.soffit ?? '-'}${h.soffitEstimated ? ' (est)' : ''} NAP · ${sizeM} m square`;
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}">${svg.join('')}<rect x="0" y="0" width="${W}" height="44" fill="#000" fill-opacity="0.6"/><text x="8" y="18" font-size="15" fill="#fff" font-family="Helvetica">${esc(title)}</text><text x="8" y="37" font-size="13" fill="#ddd" font-family="Helvetica">${esc(hl)}</text><text x="8" y="${W - 8}" font-size="11" fill="#fff" font-family="Helvetica">${esc(ORTHO_ATTRIBUTION)}</text></svg>`);
  const left = await sharp(Buffer.from(rgb), { raw: { width: W, height: W, channels: 3 } }).composite([{ input: overlay }]).png().toBuffer();
  const tiles: sharp.OverlayOptions[] = [{ input: left, left: 0, top: 0 }];
  for (const [k, p] of picks.slice(0, 2).entries()) {
    try {
      const img = await sharp(await panoramaImage(p)).resize(PANO_W, PANO_H, { fit: 'cover' }).toBuffer();
      const cap = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PANO_W}" height="24"><rect width="${PANO_W}" height="24" fill="#000" fill-opacity="0.6"/><text x="6" y="17" font-size="13" fill="#fff" font-family="Helvetica">${k + 1}: ${esc(p.id)} · ${p.taken} · heading ${p.heading}° · CC BY 4.0 Gemeente Amsterdam</text></svg>`);
      tiles.push({ input: img, left: W, top: k * (PANO_H + 10) }, { input: cap, left: W, top: k * (PANO_H + 10) });
    } catch (e) { console.log(`  ${r.id}: panorama ${p.id} failed: ${String(e).slice(0, 80)}`); }
  }
  const outW = W + PANO_W, outH = Math.max(W, 2 * PANO_H + 10);
  let q = 80, jpg: Buffer;
  for (;;) {
    jpg = await sharp({ create: { width: outW, height: outH, channels: 3, background: '#202020' } }).composite(tiles).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (jpg.length <= 400_000 || q <= 50) break;
    q -= 8;
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${r.id}.jpg`), jpg);
  writeFileSync(join(outDir, `${r.id}.json`), JSON.stringify({ id: r.id, ortho: `PDOK Actueel_orthoHR ${sizeM} m crop at ${r.at.join(',')} (scripts/crossings/review-sheet.ts ${r.id}.jpg)`, panoramas: picks.slice(0, 2).map(p => `${p.id} (${p.taken}, heading ${p.heading})`) }, null, 1));
  console.log(`  ${r.id}: ${(jpg.length / 1024).toFixed(0)} kB, panoramas ${picks.slice(0, 2).map(p => p.id).join(', ') || 'none'}`);
}

const OSM_ROOT = 'public/data/extracts/amsterdam/own-ground-osm-v1';
const osmCells = new Map<string, { id: number; tags: Record<string, string>; g: LngLat[] }[]>();
async function waysFor(r: CrossingRecord): Promise<{ id: number; tags: Record<string, string>; g: LngLat[] }[]> {
  const want = new Set([...r.binds.over, ...r.binds.under]);
  if (!want.size) return [];
  const [x, y] = toLocal(r.at[0], r.at[1]), size = 1000, out = new Map<number, { id: number; tags: Record<string, string>; g: LngLat[] }>();
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const k = `${Math.floor(x / size) + i}_${Math.floor(y / size) + j}`;
    if (!osmCells.has(k)) { try { osmCells.set(k, JSON.parse(gunzipSync(readFileSync(join(OSM_ROOT, 'cells', `${k}.json.gz`))).toString()).ways); } catch { osmCells.set(k, []); } }
    for (const w of osmCells.get(k)!) if (want.has(w.id)) out.set(w.id, w);
  }
  const KX = 111320 * Math.cos((52.37 * Math.PI) / 180), KY = 110540, d = 200;
  for (const w of await overpassWays([r.at[0] - d / KX, r.at[1] - d / KY, r.at[0] + d / KX, r.at[1] + d / KY])) if (want.has(w.id)) out.set(w.id, w);
  return [...out.values()];
}

interface GameOverlay { cuts: { ring: LngLat[]; mouths: LngLat[] }[]; spans: LngLat[][] }
async function gameOverlay(records: CrossingRecord[]): Promise<Map<string, GameOverlay>> {
  const { GroundStore } = await import('../../src/canalRecall/ownGround/groundStore.ts');
  const { buildCell } = await import('../../src/canalRecall/ownGround/groundCell.ts');
  const { cutRing } = await import('../../src/canalRecall/ownGround/tunnels.ts');
  const ROOT = 'public/data/extracts/amsterdam';
  const fetchBytes = async (p: string) => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
  const on = args.includes('--with-register');
  const store = new GroundStore(fetchBytes, { crossings: on } as never);
  await store.init();
  const out = new Map<string, GameOverlay>();
  const ll = (x: number, y: number): LngLat => fromLocal(x, y) as LngLat;
  for (const r of records) {
    const [x, y] = toLocal(r.at[0], r.at[1]), k = store.cellAt(x, y);
    await store.prepareCell(k);
    const cell = buildCell(await store.cellInput(k, 0));
    const cuts = store.surface.cuts.filter(c => c.x.some((cx, i) => Math.hypot(cx - x, c.y[i] - y) < 200));
    out.set(r.id, {
      cuts: cuts.map(c => ({ ring: cutRing(c).map(p => ll(p[0], p[1])), mouths: c.portals.filter(p => !p.open).map(p => ll(c.x[p.at], c.y[p.at])) })),
      spans: (cell.stats.rails?.spanList ?? []).filter(s => Math.hypot(s.at[0] - x, s.at[1] - y) < 200).map(s => [ll(s.at[0] - 2, s.at[1] - 2), ll(s.at[0] + 2, s.at[1] + 2)]),
    });
  }
  return out;
}

async function main(): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) { console.log(HELP); return; }
  const file = argOf('--file') ?? 'artifacts/crossings/drafts/named.json', outDir = argOf('--out') ?? 'artifacts/crossings/review';
  const only = argOf('--only')?.split(','), sizeM = Number(argOf('--size') ?? 160);
  const f = JSON.parse(readFileSync(file, 'utf8')) as CrossingFile;
  const records = f.records.filter(r => !only || only.includes(r.id));
  const ortho = new OrthoTiles();
  const game = args.includes('--game') ? await gameOverlay(records) : null;
  for (const r of records) await sheet(r, ortho, outDir, game?.get(r.id) ?? null, sizeM);
}

if (process.argv[1]?.endsWith('review-sheet.ts')) await main();
