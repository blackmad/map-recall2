/**
 * Re-read the wall pixels of the transfer frames (tests/e2e/palette-level.spec.ts, PALETTE_LEVEL=transfer) offline.
 *
 *   node --import tsx scripts/look/palette-level-transfer.mts [--dir=artifacts/palette-level]
 *
 * A wall pixel is one that goes black with the #000000 tint (blackLuma < 6) and answers to the tint (grey frame luma
 * > 25): glass, frames, ground and sky do not. The sun side and the shade side split at Otsu on the white frame.
 * Writes <dir>/transfer.json (rows: tint -> {sun, shade} median sRGB, with the pixel counts).
 */
import fs from 'node:fs';
import sharp from 'sharp';
const dir = process.argv.find(a => a.startsWith('--dir='))?.slice(6) ?? 'artifacts/palette-level';
const tints = Object.keys(JSON.parse(fs.readFileSync(`${dir}/transfer.json`, 'utf8')).rows);
const fr: Record<string, { d: Buffer; w: number; h: number; c: number }> = {};
for (const t of tints) { const { data, info } = await sharp(`${dir}/transfer-${t.slice(1)}.png`).raw().toBuffer({ resolveWithObject: true }); fr[t] = { d: data, w: info.width, h: info.height, c: info.channels }; }
const W = fr['#858687'], B = fr['#000000'], n = W.w * W.h, c = W.c; // a mid grey tint does not clip, so its luma tells sun from shade
const lum = (f: typeof W, i: number) => 0.2126 * f.d[i * c] + 0.7152 * f.d[i * c + 1] + 0.0722 * f.d[i * c + 2];
const idx: number[] = []; for (let i = 0; i < n; i++) if (lum(B, i) < 6 && lum(W, i) > 25) idx.push(i);
// Sun and shade by orientation, not by texel brightness: the left and right halves of the frame are the two street
// faces; the half whose wall pixels are brighter in the grey frame is the sun side (a luma split would only sort texels).
const half = (k: 0 | 1) => idx.filter(i => (i % W.w < W.w / 2) === (k === 0));
const L0 = half(0), L1 = half(1), meanL = (v: number[]) => v.reduce((s, i) => s + lum(W, i), 0) / Math.max(1, v.length);
const [sun, shade] = meanL(L0) > meanL(L1) ? [L0, L1] : [L1, L0];
const thr = 0;
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
const rows: Record<string, unknown> = {};
for (const t of tints) rows[t] = { sun: [0, 1, 2].map(k => med(sun.map(i => fr[t].d[i * c + k]))), shadePixels: shade.length };
const old = JSON.parse(fs.readFileSync(`${dir}/transfer.json`, 'utf8'));
fs.writeFileSync(`${dir}/transfer.json`, JSON.stringify({ ...old, thr, wallPixels: idx.length, sunPixels: sun.length, shadePixels: shade.length, mask: 'black<6 & grey858687>25', rows }, null, 1));
console.log({ thr, wall: idx.length, sun: sun.length, shade: shade.length });
for (const t of tints) console.log(t, JSON.stringify((rows[t] as any).sun));
