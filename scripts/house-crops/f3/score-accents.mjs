// Scores the white-band and white-surround pixel detectors on the J2 hand set (48 AB07 crops). Even-indexed crops tune, odd-indexed are held out.
//   node --import tsx scripts/house-crops/f3/score-accents.mjs [--tune] [--json out.json]
import fs from 'node:fs';
import sharp from 'sharp';
import { accentSet } from './handset.mjs';
import { measureCrop } from '../../../src/canalRecall/houseSpec/writers/pixel.ts';
import { isOpeningCell } from '../../../src/canalRecall/buildingRecipe/measureFacade.ts';
import { detectBands, detectSurrounds, detectSurroundsFromMask, ACCENT_DEFAULTS } from '../../../src/canalRecall/facade/whiteAccents.ts';

const set = accentSet(), ppmOf = id => JSON.parse(fs.readFileSync(`${process.env.HOUSE_CROPS_ARCHIVE ?? '/Users/blackmad/Code/map-recall2-source-data-h5h'}/pand-crops/${id}/front.json`, 'utf8')).crop.pixelsPerMetre;
const crops = [];
for (const s of set) { const { data, info } = await sharp(s.file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); crops.push({ ...s, c: { width: info.width, height: info.height, rgb: new Uint8Array(data), ppm: ppmOf(s.id) } }); }
const confusion = (rows, key, f) => { let tp = 0, fp = 0, fn = 0, tn = 0; for (const r of rows) { const t = !!r[key], d = f(r); if (t && d) tp++; else if (!t && d) fp++; else if (t && !d) fn++; else tn++; } const n = rows.length; return { n, tp, fp, fn, tn, acc: +((tp + tn) / n).toFixed(3), recall: tp + fn ? +(tp / (tp + fn)).toFixed(3) : null, precision: tp + fp ? +(tp / (tp + fp)).toFixed(3) : null, baseline: +(Math.max(tp + fn, fp + tn) / n).toFixed(3) }; };
const mf = crops.map(r => { const mc = measureCrop({ pandId: r.id, image: r.c, tier: 'good', wallTopM: null, ref: '', at: null }), m = mc?.m; const o = m?.openings; const sm = m ? detectSurroundsFromMask(r.c, { cols: m.cols, rows: m.rows, cell: m.cell, u0: m.box.u0, topM: r.c.height / r.c.ppm, v1: m.box.v1, isOpening: isOpeningCell, data: m.mask }) : null; return { maskSur: sm, openings: o?.count ?? 0, bands: o?.bands ?? 0, surrounds: o?.surrounds ?? 0, abstain: o?.abstain ?? null }; });
const run = (params) => crops.map((r, i) => ({ ...r, mf: mf[i], bandsDet: detectBands(r.c, params), surDet: detectSurrounds(r.c, params) }));
const report = (rows, label) => { for (const [q, key, f] of [['bands (pixel)', 'bands', r => r.bandsDet.present], ['surrounds (pixel)', 'surround', r => r.surDet.present], ['surrounds (mask rings)', 'surround', r => !!r.mf.maskSur?.present], ['bands (measureFacade openings.bands>=1)', 'bands', r => r.mf.bands >= 1], ['bands (measureFacade >=2)', 'bands', r => r.mf.bands >= 2], ['surrounds (measureFacade share>=0.5)', 'surround', r => r.mf.openings >= 2 && r.mf.surrounds / r.mf.openings >= 0.5], ['surrounds (measureFacade any)', 'surround', r => r.mf.surrounds >= 1]]) console.log(label, q, JSON.stringify(confusion(rows, key, f))); };
if (process.argv.includes('--tune')) {
  const tr = crops.filter((_, i) => i % 2 === 0), score = (rows, key, f) => { const c = confusion(rows, key, f); return c.acc + 0.0 * (c.recall ?? 0); };
  let best = null;
  for (const rowShare of [0.3, 0.4, 0.5, 0.6]) for (const contrast of [0.5, 0.7, 0.85]) for (const lightDelta of [28, 38, 50]) for (const maxM of [0.45, 0.7]) {
    const rows = tr.map(r => ({ ...r, d: detectBands(r.c, { rowShare, contrast, lightDelta, maxM }) })), a = score(rows, 'bands', r => r.d.present);
    if (!best || a > best.a) best = { a, rowShare, contrast, lightDelta, maxM };
  }
  console.log('bands best on the tuning half', JSON.stringify(best));
  let bs = null;
  for (const stripShare of [0.3, 0.4, 0.5, 0.65]) for (const sides of [2, 3]) for (const openingShare of [0.3, 0.5, 0.7]) for (const innerM of [0, 0.1, 0.2]) {
    const rows = tr.map(r => ({ ...r, d: detectSurrounds(r.c, { stripShare, sides, openingShare, innerM }) })), a = score(rows, 'surround', r => r.d.present);
    if (!bs || a > bs.a) bs = { a, stripShare, sides, openingShare, innerM };
  }
  console.log('surrounds best on the tuning half', JSON.stringify(bs));
}
const rows = run({});
report(rows, 'all 48 (defaults)'); report(rows.filter((_, i) => i % 2 === 0), 'even 24'); report(rows.filter((_, i) => i % 2 === 1), 'odd 24 (held out)');
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(rows.map(r => ({ id: r.id, bands: r.bands, bandsDet: r.bandsDet, surround: r.surround, surDet: r.surDet })), null, 1));
