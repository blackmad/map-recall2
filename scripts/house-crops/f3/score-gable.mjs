// Scores the skyline gable classifier against hand reads: H5h hand-set-v1 (readable fronts with a gable value) on the archived crops, and the J1 truth on its wall crops.
//   node --import tsx scripts/house-crops/f3/score-gable.mjs [--json out.json]
import fs from 'node:fs';
import sharp from 'sharp';
import { classifySkyline } from '../../../src/canalRecall/facade/skylineGable.ts';

const argv = n => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const ARCH = argv('archive') ?? process.env.HOUSE_CROPS_ARCHIVE ?? '/Users/blackmad/Code/map-recall2-source-data-h5h';
const FRESH = !!argv('archive'); // --archive <dir>: score the crops a new run made (e.g. with --headroom) for the pands it holds, instead of the H5h crops
const MAP = { cornice: 'cornice', flat: 'cornice', point: 'plain', plain: 'plain', step: 'step', neck: 'neck', bell: 'bell', spout: 'neck' };
const items = [];
for (const p of JSON.parse(fs.readFileSync('data/house-line/hand-set-v1.json', 'utf8')).pands) {
  const g = p.fields?.gable?.value; if (!p.readable || !g || !MAP[g]) continue;
  const f = `${ARCH}/pand-crops/${p.pandId}/front.jpg`; if (!fs.existsSync(f)) continue;
  items.push({ set: 'hand-set-v1', id: p.pandId, file: f, truth: MAP[g], ppm: JSON.parse(fs.readFileSync(`${ARCH}/pand-crops/${p.pandId}/front.json`, 'utf8')).crop.pixelsPerMetre });
}
for (const j of JSON.parse(fs.readFileSync('/Users/blackmad/Code/map-recall2/.cache/jev-facades/set.json', 'utf8'))) {
  if (FRESH) { const g = j.truth?.gable, f = `${ARCH}/pand-crops/${j.pandId}/front.jpg`; if (g && MAP[g] && fs.existsSync(f) && !items.some(i => i.id === j.pandId)) items.push({ set: 'j1', id: j.pandId, file: f, truth: MAP[g], ppm: JSON.parse(fs.readFileSync(`${ARCH}/pand-crops/${j.pandId}/front.json`, 'utf8')).crop.pixelsPerMetre }); continue; }
  const g = j.truth?.gable; if (!g || !MAP[g] || !fs.existsSync(j.image) || items.some(i => i.id === j.pandId)) continue;
  items.push({ set: 'j1', id: j.pandId, file: j.image, truth: MAP[g], ppm: j.widthPx / j.wallWidthM, register: j.registerGable ?? null });
}
const rows = [];
for (const it of items) { const { data, info } = await sharp(it.file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); const r = classifySkyline({ width: info.width, height: info.height, rgb: new Uint8Array(data), ppm: it.ppm }); rows.push({ ...it, pred: r.cls, why: r.why }); }
const summarise = (rs, label) => { const read = rs.filter(r => r.pred), ok = read.filter(r => r.pred === r.truth).length, cnt = {}; for (const r of rs) cnt[r.truth] = (cnt[r.truth] ?? 0) + 1;
  const base = Math.max(...Object.values(cnt)) / rs.length; const cm = {}; for (const r of read) { const k = `${r.truth}>${r.pred}`; cm[k] = (cm[k] ?? 0) + 1; }
  console.log(label, JSON.stringify({ n: rs.length, read: read.length, correctOfRead: ok, accOfRead: read.length ? +(ok / read.length).toFixed(3) : null, accOverAll: +(ok / rs.length).toFixed(3), baseline: +base.toFixed(3), counts: cnt }), '\n  confusion truth>pred', JSON.stringify(cm)); };
summarise(rows, 'all'); summarise(rows.filter(r => r.set === 'hand-set-v1'), 'hand-set-v1'); summarise(rows.filter(r => r.set === 'j1'), 'j1');
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(rows.map(({ file, ...r }) => r), null, 1));
