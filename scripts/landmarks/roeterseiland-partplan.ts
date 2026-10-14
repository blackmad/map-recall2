import sharp from 'sharp';
import {loadFacts, panelRows, PART_IDS} from './roeterseiland-parts';
const {rows, panels} = panelRows(loadFacts());
const colours: Record<string, string> = {tower: '#d33', podium: '#f90', bridge: '#27c', 'bridge-city-room': '#0aa', 'se-brick-wing': '#852', 'se-tall-block': '#a3c', 'west-beige': '#cb6', 'north-grey': '#777', 'north-mid': '#3a3', 'canal-low': '#0c8', other: '#000'};
const S = 7, ox = 60, oz = 90, W = 170 * S, H = 230 * S;
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>`];
for (const p of panels) {
  const r = rows[p.index];
  const a = [p.o[0] + p.r[0] * p.uMin, p.o[2] + p.r[2] * p.uMin], b = [p.o[0] + p.r[0] * p.uMax, p.o[2] + p.r[2] * p.uMax];
  svg.push(`<line x1="${(a[0] + ox) * S}" y1="${(a[1] + oz) * S}" x2="${(b[0] + ox) * S}" y2="${(b[1] + oz) * S}" stroke="${colours[r.part]}" stroke-width="${r.width > 3 ? 4 : 2}"/>`);
  if (r.width > 9) svg.push(`<text x="${(r.at[0] + ox) * S + p.n[0] * 8}" y="${(r.at[1] + oz) * S + p.n[2] * 8}" font-size="10">${r.index}</text>`);
}
let y = 14; for (const k of PART_IDS) { svg.push(`<text x="10" y="${y}" font-size="13" fill="${colours[k]}">${k} (${rows.filter(r => r.part === k).length})</text>`); y += 16; }
svg.push('</svg>');
await sharp(Buffer.from(svg.join(''))).png().toFile('artifacts/building-recipes/roeterseiland-rec-a/part-plan.png');
for (const k of PART_IDS) { const rs = rows.filter(r => r.part === k && r.width >= 3); console.log(k, rs.length, 'top', Math.min(...rs.map(r => r.top)).toFixed(1), Math.max(...rs.map(r => r.top)).toFixed(1)); }
