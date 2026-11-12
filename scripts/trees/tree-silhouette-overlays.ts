#!/usr/bin/env tsx
/**
 * Review overlays for tree-silhouette-survey.ts: each measured panorama view with the foliage mask tinted, the crown
 * top/base lines, the widest run and the game's silhouette (before / after) drawn on the same trunk plane.
 *
 *   npx tsx scripts/trees/tree-silhouette-overlays.ts --survey=docs/reports/trees-silhouette-20261110/survey.json --out=DIR [--species=a,b] [--sheet]
 *
 * Views come from the survey's cache (.cache/tree-silhouettes); nothing is fetched. --sheet also writes one contact
 * sheet per species group (sheet-NN.jpg) at gallery size.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { foliageMask, rowOfHeight, columnOfLateral, type ViewGeometry } from '../../src/canalRecall/trees/silhouetteMeasure';

const args = process.argv.slice(2);
const opt = (n: string, d: string) => args.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ROOT = path.resolve(import.meta.dirname, '../..');
const survey = JSON.parse(fs.readFileSync(path.resolve(ROOT, opt('survey', 'docs/reports/trees-silhouette-20261110/survey.json')), 'utf8'));
const OUT = path.resolve(opt('out', '.cache/tree-silhouette-overlays')); fs.mkdirSync(OUT, { recursive: true });
const only = opt('species', '') ? opt('species', '').split(',') : null;
const CACHE = path.join(ROOT, '.cache/tree-silhouettes');

const params = (url: string) => Object.fromEntries(new URL(url).searchParams);
function polyline(g: ViewGeometry, profile: number[], base: number, top: number): string {
  // Profile widths every 10 % of crown height → a symmetric outline around the axis.
  const pts: Array<[number, number]> = [];
  const hs = profile.map((_, k) => base + (top - base) * ((k + 0.5) / 10));
  const left = hs.map((h, k) => [-profile[k] / 2, h]), right = hs.map((h, k) => [profile[k] / 2, h]).reverse();
  for (const [x, h] of [[0, base], ...left, [0, top], ...right, [0, base]] as Array<[number, number]>) { const v = rowOfHeight(g, h); pts.push([columnOfLateral(g, x, v), v]); }
  return pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
}

const made: Array<{ species: string; file: string }> = [];
for (const r of survey.records) {
  if (only && !only.includes(r.species)) continue;
  const file = path.join(CACHE, crypto.createHash('sha1').update(r.view).digest('hex') + '.jpg');
  if (!fs.existsSync(file)) continue;
  const p = params(r.view);
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const g: ViewGeometry = { width: info.width, height: info.height, fovDeg: +p.fov, pitchDeg: +p.pitch, cameraHeight: survey.cameraHeight, distance: r.distance };
  const mask = foliageMask(data, info.width, info.height, info.channels);
  const tint = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < mask.length; i++) if (mask[i]) { tint[i * 4] = 255; tint[i * 4 + 1] = 0; tint[i * 4 + 2] = 255; tint[i * 4 + 3] = 70; }
  const sum = survey.summary.find((s: any) => s.species === r.species);
  const line = (h: number, c: string) => { const v = rowOfHeight(g, h).toFixed(1); return `<line x1="0" x2="${info.width}" y1="${v}" y2="${v}" stroke="${c}" stroke-width="2"/>`; };
  const tree = survey.games?.[r.id];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">
    ${line(r.top, '#ffeb3b')}${line(r.base, r.baseCensored ? '#ff9800' : '#ffeb3b')}
    <line x1="${columnOfLateral(g, -r.width / 2, rowOfHeight(g, r.widestAt)).toFixed(1)}" x2="${columnOfLateral(g, r.width / 2, rowOfHeight(g, r.widestAt)).toFixed(1)}" y1="${rowOfHeight(g, r.widestAt).toFixed(1)}" y2="${rowOfHeight(g, r.widestAt).toFixed(1)}" stroke="#ffeb3b" stroke-width="3"/>
    ${tree?.before ? `<polyline points="${polyline(g, tree.before.profile, tree.before.base, tree.before.top)}" fill="none" stroke="#ff1744" stroke-width="2" stroke-dasharray="6 4"/>` : ''}
    ${tree?.after ? `<polyline points="${polyline(g, tree.after.profile, tree.after.base, tree.after.top)}" fill="none" stroke="#00e5ff" stroke-width="2"/>` : ''}
    <rect x="0" y="0" width="${info.width}" height="44" fill="rgba(0,0,0,.6)"/>
    <text x="8" y="18" font-family="Helvetica" font-size="15" fill="#fff">${r.species} · ${r.heightClass} · ${r.date} · ${r.distance} m</text>
    <text x="8" y="37" font-family="Helvetica" font-size="13" fill="#fff">photo W/H ${r.widthRatio} base ${r.base}${r.baseCensored ? '≤' : ''} m ${r.outline}${r.widthCapped ? ' (capped)' : ''} · game ${sum?.before?.archetype ?? ''} red=before cyan=after</text>
  </svg>`;
  const out = path.join(OUT, `${r.species.replace(/[^a-z0-9]+/g, '-')}-${r.id}.jpg`);
  await sharp(file).composite([{ input: tint, raw: { width: info.width, height: info.height, channels: 4 } }, { input: Buffer.from(svg) }]).jpeg({ quality: 78 }).toFile(out);
  made.push({ species: r.species, file: out });
}
console.log(`${made.length} overlays in ${OUT}`);
if (args.includes('--sheet')) {
  // One row per species, up to four views at 300 px.
  const species = [...new Set(made.map(m => m.species))];
  const T = 300, perSheet = 8;
  for (let s = 0; s < species.length; s += perSheet) {
    const group = species.slice(s, s + perSheet), comps: sharp.OverlayOptions[] = [];
    for (const [row, sp] of group.entries()) {
      const files = made.filter(m => m.species === sp).slice(0, 4);
      for (const [col, m] of files.entries()) comps.push({ input: await sharp(m.file).resize(T, T).toBuffer(), left: col * T, top: row * T });
    }
    const out = path.join(OUT, `sheet-${String(s / perSheet + 1).padStart(2, '0')}.jpg`);
    await sharp({ create: { width: 4 * T, height: group.length * T, channels: 3, background: '#222' } }).composite(comps).jpeg({ quality: 78 }).toFile(out);
    console.log('sheet', out);
  }
}
