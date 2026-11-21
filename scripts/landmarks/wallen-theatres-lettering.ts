/**
 * Font outlines for the De Wallen theatre signs (Casa Rosso, Moulin Rouge; lane lm-wallen-theatres-20261121).
 *
 *   node --import tsx scripts/landmarks/wallen-theatres-lettering.ts <Cinzel[wght].ttf>
 *
 * Writes scripts/landmarks/wallen-theatres-lettering.json: the path commands of each sign line at 100 units, so the
 * builders need no font file at build time. Both fonts are SIL OFL 1.1 from google/fonts:
 *  - Cinzel (https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf, default instance, sha256 below):
 *    the wide inscriptional serif capitals of THEATRE CASA ROSSO and MOULIN ROUGE, an approximation; the real typefaces
 *    are not known.
 *  - Pacifico (public/canal-drive/fonts/Pacifico-Regular.ttf): the brush script "Rouge" of the hanging sign.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import opentype from 'opentype.js';

const cinzelPath = process.argv[2];
if (!cinzelPath) throw new Error('usage: wallen-theatres-lettering.ts <Cinzel[wght].ttf>');
const load = (p: string) => { const b = fs.readFileSync(p); return {font: opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), sha256: crypto.createHash('sha256').update(b).digest('hex')}; };
const cinzel = load(cinzelPath), pacifico = load('public/canal-drive/fonts/Pacifico-Regular.ttf');
const r1 = (v: number) => Math.round(v * 10) / 10;
const cmds = (font: opentype.Font, text: string) => font.getPath(text, 0, 0, 100, {kerning: true}).commands.map(c => {
  const o: Record<string, unknown> = {type: c.type};
  for (const k of ['x1', 'y1', 'x2', 'y2', 'x', 'y'] as const) if (k in c) o[k] = r1((c as unknown as Record<string, number>)[k]);
  return o;
});
const lines = {
  'THEATRE CASA ROSSO': {font: 'cinzel', commands: cmds(cinzel.font, 'THEATRE CASA ROSSO')},
  'MOULIN ROUGE': {font: 'cinzel', commands: cmds(cinzel.font, 'MOULIN ROUGE')},
  'MOULIN': {font: 'cinzel', commands: cmds(cinzel.font, 'MOULIN')},
  'Rouge': {font: 'pacifico', commands: cmds(pacifico.font, 'Rouge')},
};
const out = {
  fonts: {
    cinzel: {name: 'Cinzel (variable, default instance)', license: 'SIL OFL 1.1', source: 'https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf', sha256: cinzel.sha256},
    pacifico: {name: 'Pacifico Regular', license: 'SIL OFL 1.1', source: 'public/canal-drive/fonts/Pacifico-Regular.ttf (google/fonts)', sha256: pacifico.sha256},
  },
  approximation: 'Typeface approximations of the observed signs (Gemeente Amsterdam panoramas 2025, CC BY 4.0): wide serif capitals for the gilt THEATRE CASA ROSSO fascia letters and the red MOULIN ROUGE letters, a brush script for "Rouge" on the hanging sign. Exact typefaces unknown.',
  lines,
};
fs.writeFileSync('scripts/landmarks/wallen-theatres-lettering.json', JSON.stringify(out) + '\n');
console.log(Object.entries(lines).map(([k, v]) => `${k}: ${v.commands.length}`).join(', '));
