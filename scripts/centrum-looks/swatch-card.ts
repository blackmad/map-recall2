/**
 * The colour reader's reference card (Centrum looks round 5: grey-brown fronts read red-brown). One brick patch per
 * family, each shown in winter shade, in flat light and in sun, so the reader names the brick and not the exposure.
 *
 *   node --import tsx scripts/centrum-looks/swatch-card.ts <out.png>
 */
import sharp from 'sharp';

export const SWATCHES: ReadonlyArray<{ family: string; hex: string; note: string }> = [
  { family: 'dark-grey-brick', hex: '#423d3a', note: 'near-black / dark grey' },
  { family: 'purple-brown-brick', hex: '#5c4146', note: 'dark, a purple cast' },
  { family: 'brown-brick', hex: '#76604f', note: 'dull grey-brown, no red' },
  { family: 'red-brown-brick', hex: '#94452f', note: 'clearly red, flower-pot' },
  { family: 'orange-red-brick', hex: '#bb5a3a', note: 'bright orange-red' },
  { family: 'buff-brick', hex: '#c8b086', note: 'yellow / buff' },
];
const LIGHTS = [{ name: 'winter shade', k: 0.62 }, { name: 'flat light', k: 1 }, { name: 'sun', k: 1.3 }];
const scale = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');

function brick(x: number, y: number, w: number, h: number, hex: string, mortar: string): string {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${mortar}"/>`;
  for (let r = 0, yy = y + 2; yy < y + h - 2; r++, yy += 14) for (let xx = x + 2 - (r % 2 ? 18 : 0); xx < x + w - 2; xx += 36) {
    const x0 = Math.max(x + 2, xx), x1 = Math.min(x + w - 2, xx + 33);
    if (x1 > x0) s += `<rect x="${x0}" y="${yy}" width="${x1 - x0}" height="11" fill="${hex}"/>`;
  }
  return s;
}

export async function card(out: string): Promise<void> {
  const cw = 200, ch = 120, lw = 230, top = 40, W = lw + LIGHTS.length * (cw + 10), H = top + SWATCHES.length * (ch + 10);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  LIGHTS.forEach((l, j) => { svg += `<text x="${lw + j * (cw + 10) + 10}" y="26" font-family="Helvetica" font-size="20">${l.name}</text>`; });
  SWATCHES.forEach((s, i) => {
    const y = top + i * (ch + 10);
    svg += `<text x="8" y="${y + 50}" font-family="Helvetica" font-size="19" font-weight="bold">${s.family}</text><text x="8" y="${y + 76}" font-family="Helvetica" font-size="16">${s.note}</text>`;
    LIGHTS.forEach((l, j) => { svg += brick(lw + j * (cw + 10), y, cw, ch, scale(s.hex, l.k), scale('#b8b2a8', l.k)); });
  });
  await sharp(Buffer.from(svg + '</svg>')).png().toFile(out);
}

if (process.argv[1]?.endsWith('swatch-card.ts')) await card(process.argv[2] ?? 'swatch-card.png');
