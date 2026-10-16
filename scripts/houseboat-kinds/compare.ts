// Side-by-side per quay: orthophoto with drawn kinds | in-game before | in-game after.
//   npx tsx scripts/houseboat-kinds/compare.ts -> artifacts/houseboat-kinds/compare/<quay>.png
import fs from 'node:fs';
import sharp from 'sharp';
const D = 'artifacts/houseboat-kinds';
const QUAYS: Record<string, string> = { 'prinsengracht-noordermarkt': 'prinsen-noord', 'prinsengracht-westermarkt': 'prinsen-westermarkt', 'prinsengracht-amstelveld': 'prinsen-amstel' };
fs.mkdirSync(`${D}/compare`, { recursive: true });
const H = 640;
const label = (text: string, w: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="28"><rect width="100%" height="100%" fill="#111"/><text x="8" y="20" font-family="Helvetica" font-size="17" fill="#fff">${text}</text></svg>`);
for (const [shot, quay] of Object.entries(QUAYS)) {
  const parts = [
    { file: `${D}/quays/${quay}-after.png`, text: `${shot}: PDOK orthophoto; red barge, yellow hullbox, cyan ark (drawn)` },
    { file: `${D}/shots/before/${shot}.png`, text: 'in game, before' },
    { file: `${D}/shots/after/${shot}.png`, text: 'in game, after' },
  ];
  const imgs = await Promise.all(parts.map(async p => { const b = await sharp(p.file).resize({ height: H }).png().toBuffer(); const m = await sharp(b).metadata(); return { b, w: m.width!, text: p.text }; }));
  let x = 0;
  const comps: sharp.OverlayOptions[] = [];
  for (const im of imgs) { comps.push({ input: label(im.text, im.w), left: x, top: 0 }, { input: im.b, left: x, top: 28 }); x += im.w + 6; }
  await sharp({ create: { width: x, height: H + 28, channels: 3, background: '#111' } }).composite(comps).png().toFile(`${D}/compare/${shot}.png`);
}
console.log(`${D}/compare`);
