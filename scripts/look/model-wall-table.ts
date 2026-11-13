/**
 * Lane WC follow-up: the same spec wall colour on the two live paths, for every live ordinary model (catalogue.json).
 * Per model: the GLB's brick slot tint (and tintSource), the tint the city look gives it on the model path
 * (cityLook.ts cityLookTint, `?modelWallFloor=` as set), and the colour the generic path would draw for the same hex
 * (houseSpec/decorate.ts specWallColour on a brick front: trim rule, lift, the 0.34 floor). OKLab L of each. With
 * --frames <generic dir> <model dir> (house:frames runs of the same list at the same poses) the pixel L of both is added.
 *
 *   node --import tsx scripts/look/model-wall-table.ts [--frames <generic> <model>] [--json out] [--md out]
 */
process.env.SPEC_WALLS ??= '1';
import fs from 'node:fs';
import path from 'node:path';
import { cityLookTint } from '../../src/canalRecall/look/cityLook.ts';
import { hexToOklab } from '../../src/canalRecall/houseSpec/wallColour.ts';
import { specWallColour } from '../../src/canalRecall/houseSpec/decorate.ts';

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const fi = argv.indexOf('--frames'), frames = fi >= 0 ? [argv[fi + 1], argv[fi + 2]] : null;
const CAT = 'public/canal-drive/ordinary-buildings-data/catalogue.json';
const models = JSON.parse(fs.readFileSync(CAT, 'utf8')).models as any[];
const glbJson = (file: string) => { const b = fs.readFileSync(file), l = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + l).toString('utf8')); };
const pixel = (dir: string | undefined, id: string) => {
  if (!dir) return null;
  for (const k of [id, id.slice(-6)]) { const f = path.join(dir, k, 'pose.json'); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')).lab?.game?.L ?? null; }
  return null;
};
const rows: any[] = [];
for (const m of models) {
  if (!m.modelUrl || !String(m.id).startsWith('ordinary-')) continue;
  const file = path.join('public/canal-drive', m.modelUrl.replace(/^\.\//, ''));
  if (!fs.existsSync(file)) continue;
  const brick = (glbJson(file).materials ?? []).find((x: any) => x.extras?.materialSlot === 'brick');
  if (!brick?.extras?.tint) continue;
  const hex = String(brick.extras.tint).toLowerCase(), src = brick.extras.tintSource ?? null;
  const modelTint = cityLookTint('brick', hex, src, undefined, null, false, true);
  const generic = specWallColour({ wallHex: hex, wallMaterial: 'brick', src: { wallHex: 'streetlevel-measured' } }, { id: m.buildingId }) ?? hex;
  const pandId = String(m.buildingId ?? '').replace(/^NL\.IMBAG\.Pand\./, '');
  rows.push({ pandId, id: m.id, hex, tintSource: src, specL: +hexToOklab(hex)[0].toFixed(3), genericTint: generic, genericTintL: +hexToOklab(generic)[0].toFixed(3), modelTint, modelTintL: +hexToOklab(modelTint)[0].toFixed(3),
    ...(frames ? { genericPx: pixel(frames[0], pandId), modelPx: pixel(frames[1], pandId) } : {}) });
}
rows.sort((a, b) => a.specL - b.specL);
const band = (lo: number, hi: number) => rows.filter(r => r.specL >= lo && r.specL < hi);
const mean = (xs: number[]) => xs.length ? +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3) : null;
const bands = [[0, 0.35], [0.35, 0.42], [0.42, 0.5], [0.5, 0.6], [0.6, 1.01]].map(([lo, hi]) => { const r = band(lo, hi); return { band: `${lo}-${hi}`, n: r.length, specL: mean(r.map(x => x.specL)), genericTintL: mean(r.map(x => x.genericTintL)), modelTintL: mean(r.map(x => x.modelTintL)), measured: r.filter(x => x.tintSource === 'measured').length }; });
console.log(`${rows.length} live ordinary models with a brick slot (${rows.filter(r => r.tintSource === 'measured').length} measured)`);
console.table(bands);
if (frames) console.table(rows.filter(r => r.genericPx != null && r.modelPx != null).map(r => ({ pand: r.pandId.slice(-6), hex: r.hex, specL: r.specL, genericTintL: r.genericTintL, modelTintL: r.modelTintL, genericPx: r.genericPx, modelPx: r.modelPx })));
if (opt('json')) fs.writeFileSync(opt('json')!, JSON.stringify({ bands, rows }, null, 1));
