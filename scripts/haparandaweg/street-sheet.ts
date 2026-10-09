/** Street sheet: desktop (top row) and iphone (bottom row) shots from artifacts/haparandaweg/ingame. */
import fs from 'node:fs';
import sharp from 'sharp';
const names = ['street-west-end', 'street-mid-west', 'street-mid-east', 'street-east-end'];
const dir = 'artifacts/haparandaweg/ingame';
const cells: { input: Buffer; left: number; top: number }[] = [];
const W = 720, DH = 450, PH = 720;
for (let i = 0; i < names.length; i++) {
  const d = `${dir}/${names[i]}-desktop.png`, p = `${dir}/${names[i]}-iphone.png`;
  if (fs.existsSync(d)) cells.push({ input: await sharp(d).resize(W, DH, { fit: 'cover' }).png().toBuffer(), left: i * W, top: 0 });
  if (fs.existsSync(p)) cells.push({ input: await sharp(p).resize(W, PH, { fit: 'cover', position: 'centre' }).png().toBuffer(), left: i * W, top: DH });
}
await sharp({ create: { width: W * names.length, height: DH + PH, channels: 3, background: '#111' } }).composite(cells).png().toFile('artifacts/haparandaweg/street-sheet.png');
console.log('artifacts/haparandaweg/street-sheet.png');
