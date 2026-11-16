/**
 * Buurt generator sheet (docs/handoffs/buurt-generators-20261115.md): one generated row as photo | before | after, all
 * three at one scale on the row's front line, from a cached municipal panorama. Node only; nothing is fetched.
 *
 *   node --import tsx scripts/buurt-generators/sheet.ts --district=rivierenbuurt --row=<row id> \
 *        --pano=<pano id> --pano-search=<cached panorama search .json> [--ppm=40] [--out=<file.jpg>]
 *
 * photo   the panorama rectified onto the line from the first member's left front corner to the last member's right
 *         one (scripts/pand-reference/rectify.ts; the equirectangular_full link is dropped so only the cached medium
 *         image is read)
 * before  house:preview per member as the game draws it today (no row flags)
 * after   house:preview per member with ROW_FRONT=1, ROW_FRONT_RECORDS=<the district's staged row-front.json> and
 *         BUURT_KIT=1 (the generator's kit additions, bayLook.ts PLAN_ZUID_CASEMENT)
 * Each render is fitted to its member's span on the line and to its measured top, over a 3 m grid.
 * Renders are cached per band under a key of the band's input files and options (renderCache.ts), so a regenerated
 * row-front never reuses an older render; --fresh drops the row's cache first. Children get no stdin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { loadPano, rectifyWall } from '../pand-reference/rectify.ts';
import type { PanoPick, Wall } from '../pand-reference/select.ts';
import { renderCacheKey } from './renderCache.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const district = arg('district') ?? 'rivierenbuurt', rowId = arg('row'), panoId = arg('pano'), search = arg('pano-search');
if (!rowId || !panoId || !search) { console.error('sheet --district=<d> --row=<row id> --pano=<pano id> --pano-search=<cached search json> [--ppm=40] [--out=file]'); process.exit(2); }
const ppm = Number(arg('ppm') ?? 40);
const stage = `artifacts/buurt-generators/${district}`;
const out = arg('out') ?? path.join(stage, 'sheets', rowId, 'sheet.jpg');
const work = path.join(path.dirname(out), 'renders');

const row = (JSON.parse(fs.readFileSync(path.join(stage, 'rows.json'), 'utf8')).rows as any[]).find(r => r.id === rowId);
if (!row) throw new Error(`no row ${rowId} in ${stage}/rows.json`);
const fronts = JSON.parse(fs.readFileSync(path.join(stage, 'fronts.json'), 'utf8')).fronts as Record<string, { a: [number, number]; b: [number, number] }>;
// Each member is framed on its record's front line (buurtKit.frontLine), before and after alike, so a jogged front is
// drawn whole and both bands show the same span.
const kitLine = new Map<string, [[number, number], [number, number]]>((JSON.parse(fs.readFileSync(path.join(stage, 'row-front.json'), 'utf8')).records as any[]).filter(r => r.buurtKit?.frontLine).map(r => [r.pandId, r.buurtKit.frontLine]));
const lineOf = (id: string) => kitLine.get(id) ?? [fronts[id].a, fronts[id].b];
const record = (JSON.parse(fs.readFileSync(search, 'utf8'))._embedded?.panoramas ?? []).find((p: any) => p.pano_id === panoId);
if (!record) throw new Error(`no panorama ${panoId} in ${search}`);
delete record._links.equirectangular_full; // read the cached medium image only: no download

// The row's front line in RD, members projected onto it.
const ids: string[] = row.members.map((m: any) => m.pandId);
const A = lngLatToRd(lineOf(ids[0])[0]), B = lngLatToRd(lineOf(ids[ids.length - 1])[1]);
const len = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
const along = (p: { x: number; y: number }) => (p.x - A.x) * ux + (p.y - A.y) * uy;
const spans = ids.map(id => ({ id, x0: along(lngLatToRd(lineOf(id)[0])), x1: along(lngLatToRd(lineOf(id)[1])) }));
const lineM = Math.max(...row.series.map((s: any) => s.design.corniceTopM.value as number));
const wall: Wall = { a: A, b: B, len, nx: uy, ny: -ux, mid: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, roadDistM: 0, facing: 0 };
const pick: PanoPick = { panoId, timestamp: record.timestamp, missionYear: Number(record.mission_year), missionType: record.mission_type ?? '', surface: record.surface_type ?? '', distM: 0, obliquityDeg: 0, relaxed: false, record };

const pano = await loadPano(pick);
if (!pano) throw new Error(`panorama ${panoId} is not cached (${record._links.equirectangular_medium?.href})`);
const crop = rectifyWall(pano.img, pick, wall, lineM + 2, ppm);
if (!crop) throw new Error('rectification failed (no camera pose)');
const W = Math.round(len * crop.ppm), H = crop.height, s = crop.ppm;
console.log(`photo ${crop.width}x${H} at ${s.toFixed(1)} px/m, line ${len.toFixed(1)} m, missing ${(crop.missingFraction * 100).toFixed(0)} %, ground ${crop.groundSource}`);

if (process.argv.includes('--fresh')) fs.rmSync(work, { recursive: true, force: true });
async function band(env: Record<string, string>, tag: string, inputs: readonly string[]): Promise<{ img: Buffer; labels: string[] }> {
  const comps: sharp.OverlayOptions[] = [], labels: string[] = [];
  const key = renderCacheKey(inputs, [String(Math.round(s)), JSON.stringify(Object.entries(env).sort())]);
  for (const sp of spans) {
    const dir = path.join(work, `${tag}-${key}`, sp.id);
    if (!fs.existsSync(path.join(dir, 'front.png')) || !fs.existsSync(path.join(dir, 'measure.json'))) {
      const r = spawnSync('node', ['--import', 'tsx', 'scripts/house-preview/preview.ts', sp.id, '--wall', `line:${lineOf(sp.id).flat().join(',')}`, '--ppm', String(Math.round(s)), '--out', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
      if (r.status !== 0) { console.error(`${tag} ${sp.id}: preview failed\n${(r.stderr || r.stdout).slice(-600)}`); continue; }
    }
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'measure.json'), 'utf8')) as { heights?: { topM: number; eavesM: number }; layout?: { storeys?: number } };
    const topM = m.heights?.topM ?? lineM;
    const left = Math.round(Math.min(sp.x0, sp.x1) * s), w = Math.max(1, Math.round(Math.abs(sp.x1 - sp.x0) * s)), h = Math.min(H, Math.max(1, Math.round(topM * s)));
    comps.push({ input: await sharp(path.join(dir, 'front.png')).resize(w, h, { fit: 'fill' }).png().toBuffer(), left: Math.max(0, Math.min(W - w, left)), top: H - h });
    labels.push(`<text x="${left + 3}" y="15" font-size="12" fill="#ddd" font-family="Helvetica">${sp.id.slice(-6)} ${m.layout?.storeys ?? '?'}st ${(m.heights?.eavesM ?? 0).toFixed(1)}m</text>`);
  }
  return { img: await sharp({ create: { width: W, height: H, channels: 3, background: { r: 160, g: 180, b: 200 } } }).composite(comps).png().toBuffer(), labels };
}
const restore = Object.fromEntries(Object.keys(process.env).filter(k => /^(ROW_|BUURT_KIT|HOUSE_SPEC)/.test(k)).map(k => [k, '']));
// `before` is the game today: keyed on the published row-front records (a proxy for a publish since the last sheet).
const before = await band({ ...restore }, 'before', ['public/data/front-records/row-front.json']);
const after = await band({ ...restore, ROW_FRONT: '1', ROW_FRONT_RECORDS: path.join(stage, 'row-front.json'), BUURT_KIT: '1' }, 'after', [path.join(stage, 'row-front.json')]);

// The photo is rectified member by member, each on its own front line, and set at its span on the row line (lane D round
// 13: a bent row rectified on one chord misplaced its houses; Keizersgracht 169442, whose 55 m row turns ~20 degrees, drew
// its stone block a house to the right from a camera 4.4 m from the first front but 8.4 m from the chord). --chord keeps
// the single-chord rectification.
const chord = process.argv.includes('--chord');
const photoComps: sharp.OverlayOptions[] = [];
if (chord) photoComps.push({ input: await sharp(crop.jpeg).extract({ left: 0, top: 0, width: Math.min(W, crop.width), height: H }).png().toBuffer(), left: 0, top: 0 });
else for (const sp of spans) {
  const [a, b] = lineOf(sp.id).map(p => lngLatToRd(p)), l = Math.hypot(b.x - a.x, b.y - a.y);
  if (l < 0.5) continue;
  const mw: Wall = { a, b, len: l, nx: (b.y - a.y) / l, ny: -(b.x - a.x) / l, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, roadDistM: 0, facing: 0 };
  const mc = rectifyWall(pano.img, pick, mw, lineM + 2, s);
  if (!mc) continue;
  const left = Math.round(Math.min(sp.x0, sp.x1) * s), w = Math.max(1, Math.round(Math.abs(sp.x1 - sp.x0) * s));
  photoComps.push({ input: await sharp(mc.jpeg).resize(w, H, { fit: 'fill' }).png().toBuffer(), left: Math.max(0, Math.min(W - w, left)), top: 0 });
}
const photo = await sharp({ create: { width: W, height: H, channels: 3, background: '#333' } }).composite(photoComps).png().toBuffer();
const svg = (w: number, h: number, body: string) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
const grid = svg(W, H, Array.from({ length: Math.floor(H / s / 3) }, (_, i) => { const y = H - (i + 1) * 3 * s; return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#ff3355" stroke-opacity="0.4"/><text x="2" y="${y - 2}" font-size="11" fill="#ff3355" font-family="Helvetica">${(i + 1) * 3} m</text>`; }).join('')
  + spans.map(sp => `<line x1="${Math.round(Math.min(sp.x0, sp.x1) * s)}" x2="${Math.round(Math.min(sp.x0, sp.x1) * s)}" y1="0" y2="${H}" stroke="#ffcc00" stroke-opacity="0.5"/>`).join(''));
const head = 26, lab = 20, gap = 6;
const title = (t: string) => svg(W, head, `<text x="6" y="18" font-size="15" fill="#eee" font-family="Helvetica">${t.replace(/&/g, '&amp;')}</text>`);
const series = row.series.map((x: any) => `${x.type} ${x.fronts.length} pands, line ${x.design.corniceTopM.value} m, ${x.design.storeys.value} st, ${x.design.bays.value} bays`).join('; ');
const blocks: Array<[string, Buffer, string[]]> = [
  [`photo: ${panoId} (${String(record.timestamp).slice(0, 10)}), rectified ${chord ? 'on the row line' : 'per member front'}, ${s.toFixed(0)} px/m`, photo, []],
  ['before: the game today', before.img, before.labels],
  [`after: buurt generator ${district} (ROW_FRONT=1, BUURT_KIT=1): ${series}`, after.img, after.labels],
];
const comps: sharp.OverlayOptions[] = [];
let y = 0;
comps.push({ input: svg(W, head, `<text x="6" y="18" font-size="16" fill="#fff" font-family="Helvetica">${row.street}: ${rowId}, ${ids.length} members, ${len.toFixed(1)} m</text>`), left: 0, top: y }); y += head;
for (const [t, img, labels] of blocks) {
  comps.push({ input: title(t), left: 0, top: y }); y += head;
  comps.push({ input: img, left: 0, top: y }, { input: grid, left: 0, top: y }); y += H;
  if (labels.length) comps.push({ input: svg(W, lab, labels.join('')), left: 0, top: y });
  y += lab + gap;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, await sharp({ create: { width: W, height: y, channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 84 }).toBuffer());
fs.writeFileSync(out.replace(/\.jpg$/, '.json'), JSON.stringify({ district, row: rowId, street: row.street, members: ids, lineM: +len.toFixed(2), pano: panoId, timestamp: record.timestamp, ppm: +s.toFixed(2), missing: +crop.missingFraction.toFixed(3), series }, null, 1));
console.log(`sheet ${out}`);
