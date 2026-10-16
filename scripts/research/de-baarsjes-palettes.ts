/**
 * Research tool (De Baarsjes type library, 2026-10-14): per-type palette medians for the Jan Evertsenstraat types, from
 * the per-pand strip palettes (`scripts/block-face/palette-from-strip.ts --street=jan-evertsenstraat`, which writes
 * staging/street-types/jan-evertsenstraat/palette.json) plus zone samples the generic palette does not take:
 *   - `pier`: wall-class pixels inside a type's window rows (the brick between the windows; two-tone on 9-33);
 *   - `spandrel`: wall-class pixels in the rows between a storey's head band and the next sill band;
 *   - `glassBlock`: every non-void pixel of the glass-block band rows over the canopy;
 * each the median over the type's pands (house numbers from docs/jan-evertsenstraat-survey-20261014.md's sketch).
 *
 *   node --import tsx scripts/research/de-baarsjes-palettes.ts
 */
import fs from 'node:fs';
import sharp from 'sharp';
import {classifyPixel} from '../../src/canalRecall/blockFace/stripPalette.ts';
import {toHex, type Rgb} from '../../src/canalRecall/blockFace/wallColour.ts';

const range = (a: number, b: number) => Array.from({length: (b - a) / 2 + 1}, (_, k) => a + 2 * k);
/** Type -> house numbers, and the zones (metres above the strip ground) measured on its exemplar strips. */
const TYPES: Record<string, {numbers: number[]; pier?: [number, number]; spandrel?: [number, number]; glassBlock?: [number, number]}> = {
  'evertsen-1926-lintel-band': {numbers: [...range(9, 33), ...range(24, 38)], pier: [7.95, 8.9], spandrel: [9.55, 10.35]},
  'evertsen-1926-hood-lisene': {numbers: [...range(93, 129), ...range(96, 140)], glassBlock: [3.6, 4.3]},
  'evertsen-1926-balcony-slot': {numbers: range(59, 87), glassBlock: [3.4, 4.2]},
  'evertsen-1926-ladder-plain': {numbers: [...range(45, 53), ...range(52, 64), ...range(68, 90)], glassBlock: [3.6, 4.3]},
  'evertsen-1927-white-attic-tile-roof': {numbers: [...range(139, 149), ...range(146, 156)]},
};
const index = JSON.parse(fs.readFileSync('scripts/street-surveys/streets/jan-evertsenstraat.json', 'utf8'));
const palettes: any[] = JSON.parse(fs.readFileSync('staging/street-types/jan-evertsenstraat/palette.json', 'utf8'));
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const medHex = (px: Rgb[]) => px.length < 20 ? null : toHex([0, 1, 2].map(c => median(px.map(p => p[c]))) as Rgb);
const strips = new Map<string, {rgb: Uint8Array; w: number; h: number; ppm: number; spans: any[]}>();
async function stripOf(face: string) {
  if (!strips.has(face)) {
    const s = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/strip.json`, 'utf8'));
    const {data, info} = await sharp(s.image ?? `staging/block-face/${face}/strip.jpg`).removeAlpha().raw().toBuffer({resolveWithObject: true});
    strips.set(face, {rgb: new Uint8Array(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height, ppm: s.pixelsPerMetre, spans: s.spans});
  }
  return strips.get(face)!;
}
async function zone(face: string, pandId: string, [m0, m1]: [number, number], keep: (c: string) => boolean): Promise<Rgb[]> {
  const s = await stripOf(face), span = s.spans.find(x => x.pandId === pandId);
  if (!span) return [];
  const pad = Math.round((span.px[1] - span.px[0]) * 0.05), out: Rgb[] = [];
  for (let y = Math.round(s.h - m1 * s.ppm); y < Math.round(s.h - m0 * s.ppm); y++) for (let x = span.px[0] + pad; x < span.px[1] - pad; x++) {
    const i = (y * s.w + x) * 3, p: Rgb = [s.rgb[i], s.rgb[i + 1], s.rgb[i + 2]];
    if (keep(classifyPixel(p))) out.push(p);
  }
  return out;
}
const keys = ['wall', 'accent', 'frame', 'band', 'cornice', 'fascia'] as const;
for (const [type, t] of Object.entries(TYPES)) {
  const members = index.pands.filter((p: any) => p.face && (p.numbers ?? []).some((n: string) => t.numbers.includes(parseInt(n, 10))) && p.buildYear >= 1920 && p.buildYear < 1930);
  const rows = members.map((m: any) => palettes.find(p => p.pandId === m.pandId)).filter((p: any) => p && p.pixels > 0 && !(p.wallHsl?.[2] > 0.6));
  const med = Object.fromEntries(keys.map(k => {
    const v = rows.map((r: any) => r[k]).filter(Boolean).map((h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb);
    return [k, v.length ? `${medHex(v.length >= 20 ? v : [...Array(20)].flatMap(() => v))} (n=${v.length})` : '-'];
  }));
  const zones: Record<string, string | null> = {};
  for (const [name, z, keep] of [['pier', t.pier, (c: string) => c === 'wall'], ['spandrel', t.spandrel, (c: string) => c === 'wall'], ['glassBlock', t.glassBlock, (c: string) => c !== 'void']] as const) {
    if (!z) continue;
    const per: Rgb[] = [];
    for (const m of members) { const px = await zone(m.face, m.pandId, z as [number, number], keep); const h = medHex(px); if (h) per.push([1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb); }
    zones[name] = per.length ? `${medHex([...Array(20)].flatMap(() => per))} (n=${per.length})` : null;
  }
  console.log(`${type}: ${members.length} pands (${rows.length} with a usable strip palette)`);
  console.log(`  ${keys.map(k => `${k} ${med[k]}`).join(' | ')}`);
  if (Object.keys(zones).length) console.log(`  ${Object.entries(zones).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
}
