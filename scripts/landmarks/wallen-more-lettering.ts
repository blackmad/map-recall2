/**
 * Font outlines for the De Wallen landmarks of lane lm-wallen-more-20261121 (The Bulldog The First, In 't Aepjen, Erotic
 * Museum, Red Light Secrets, Condomerie, Banana Bar).
 *
 *   node --import tsx scripts/landmarks/wallen-more-lettering.ts <DMSerifDisplay-Regular.ttf>
 *
 * Writes scripts/landmarks/wallen-more-lettering.json: the path commands of each sign line at 100 units, so the builders
 * need no font file at build time. All fonts are SIL OFL 1.1:
 *  - DM Serif Display (https://github.com/google/fonts/raw/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf, sha256
 *    below): the red serif "Red Light Secrets" sign, an approximation.
 *  - Archivo Black (public/canal-drive/fonts/ArchivoBlack-Regular.ttf): the heavy capitals of CONDOMERIE, BANANENBAR and the
 *    Bulldog's door number.
 *  - Pacifico (public/canal-drive/fonts/Pacifico-Regular.ttf): the neon script "Erotic Museum" and the gilt "In 't Aepjen".
 * The real typefaces are not known; these are the nearest open fonts by eye from the 2025 panoramas.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import opentype from 'opentype.js';

const dmPath = process.argv[2];
if (!dmPath) throw new Error('usage: wallen-more-lettering.ts <DMSerifDisplay-Regular.ttf>');
const load = (p: string) => { const b = fs.readFileSync(p); return {font: opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), sha256: crypto.createHash('sha256').update(b).digest('hex')}; };
const fonts = {
  dmserif: load(dmPath),
  archivo: load('public/canal-drive/fonts/ArchivoBlack-Regular.ttf'),
  pacifico: load('public/canal-drive/fonts/Pacifico-Regular.ttf'),
};
const r1 = (v: number) => Math.round(v * 10) / 10;
const cmds = (font: opentype.Font, text: string) => font.getPath(text, 0, 0, 100, {kerning: true}).commands.map(c => {
  const o: Record<string, unknown> = {type: c.type};
  for (const k of ['x1', 'y1', 'x2', 'y2', 'x', 'y'] as const) if (k in c) o[k] = r1((c as unknown as Record<string, number>)[k]);
  return o;
});
const LINES: [string, keyof typeof fonts][] = [
  ['Red Light Secrets', 'dmserif'],
  ['CONDOMERIE', 'archivo'],
  ['BANANENBAR', 'archivo'],
  ['90', 'archivo'],
  ['Erotic Museum', 'pacifico'],
  ["In 't Aepjen", 'pacifico'],
];
const lines = Object.fromEntries(LINES.map(([t, f]) => [t, {font: f, commands: cmds(fonts[f].font, t)}]));
const out = {
  fonts: {
    dmserif: {name: 'DM Serif Display Regular', license: 'SIL OFL 1.1', source: 'https://github.com/google/fonts/raw/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf', sha256: fonts.dmserif.sha256},
    archivo: {name: 'Archivo Black Regular', license: 'SIL OFL 1.1', source: 'public/canal-drive/fonts/ArchivoBlack-Regular.ttf (google/fonts)', sha256: fonts.archivo.sha256},
    pacifico: {name: 'Pacifico Regular', license: 'SIL OFL 1.1', source: 'public/canal-drive/fonts/Pacifico-Regular.ttf (google/fonts)', sha256: fonts.pacifico.sha256},
  },
  approximation: 'Typeface approximations of the observed signs (Gemeente Amsterdam panoramas 2025, CC BY 4.0). Exact typefaces unknown.',
  lines,
};
fs.writeFileSync('scripts/landmarks/wallen-more-lettering.json', JSON.stringify(out) + '\n');
console.log(Object.entries(lines).map(([k, v]) => `${k}: ${v.commands.length}`).join(', '));
