/**
 * J2 family 7: likeness triples from ARCHIVED house:preview renders only (no new render, no panorama).
 * Per pand: photo, TODAY (the "before" render = today's game path), SPEC (the "after" render with the H1b bays/spec fix), DECOY (another pand's spec render, nearest aspect).
 * Positions of the three renders are shuffled with a fixed seed; the answer key is written apart from the sheet.
 *   node scripts/jev/j2/build-triples.mjs   -> <cache>/triples.json, <cache>/triples-sheet-N.jpg (10 triples each)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {CACHE, prepImage} from './lib.mjs';
const W = '/Users/blackmad/Code/map-recall2-worktrees';
const B24 = `${W}/house-bays24-20261110/artifacts/house-preview`, GATE = `${W}/_pruned-sheets/house-h2c-measure-20261110/artifacts/house-preview`;
const src = [];
for (const p of await fs.readdir(`${B24}/bays24-before`)) src.push({pand: p, photo: `${B24}/bays24-after/${p}/photo.png`, today: `${B24}/bays24-before/${p}/front.png`, spec: `${B24}/bays24-after/${p}/front.png`, set: 'bays24'});
for (const p of (await fs.readdir(`${GATE}/gate-before`)).filter(x => /^\d{16}$/.test(x))) src.push({pand: p, photo: `${GATE}/gate-after/${p}/photo.png`, today: `${GATE}/gate-before/${p}/front.png`, spec: `${GATE}/gate-after/${p}/front.png`, set: 'gate'});
const ok = [];
for (const s of src) { try { for (const k of ['photo', 'today', 'spec']) await fs.access(s[k]); const m = await sharp(s.spec).metadata(); ok.push({...s, ar: m.width / m.height}); } catch { /* skip */ } }
let seed = 20261110; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
const triples = [];
for (const [i, s] of ok.slice(0, 30).entries()) {
  const others = ok.filter(o => o.pand !== s.pand).sort((a, b) => Math.abs(a.ar - s.ar) - Math.abs(b.ar - s.ar));
  const decoy = others[Math.floor(rnd() * 3)];
  const order = [['today', s.today], ['spec', s.spec], ['decoy', decoy.spec]].map(x => [rnd(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  const files = {};
  files.photo = await prepImage(s.photo, path.join(CACHE, 'triples', `${i}-photo.jpg`));
  for (const [k, [kind, f]] of order.entries()) files[`r${k + 1}`] = await prepImage(f, path.join(CACHE, 'triples', `${i}-r${k + 1}.jpg`));
  triples.push({id: `t${String(i).padStart(2, '0')}`, pand: s.pand, set: s.set, decoyPand: decoy.pand, key: order.map(o => o[0]), srcFiles: Object.fromEntries(order.map(([kind, f], k) => [`r${k + 1}`, f])), photoSrc: s.photo, files});
}
await fs.writeFile(path.join(CACHE, 'triples.json'), JSON.stringify(triples, null, 1));
// answer-key-free sheets: 10 rows, each row photo | R1 | R2 | R3, captions "t00 PHOTO", "R1".."R3"
const CH = 360;
for (let s = 0; s * 10 < triples.length; s++) {
  const part = triples.slice(s * 10, s * 10 + 10), comps = [];
  for (const [r, t] of part.entries()) for (const [c, k] of ['photo', 'r1', 'r2', 'r3'].entries()) {
    const buf = await sharp(t.files[k]).resize(300, CH - 28, {fit: 'inside', background: '#222'}).toBuffer();
    comps.push({input: buf, left: c * 310 + 5, top: r * CH + 28}, {input: Buffer.from(`<svg width="310" height="26"><text x="5" y="20" font-size="18" font-family="Helvetica" fill="#fff">${k === 'photo' ? `${t.id} PHOTO` : k.toUpperCase()}</text></svg>`), left: c * 310, top: r * CH});
  }
  await sharp({create: {width: 1240, height: CH * part.length, channels: 3, background: '#222'}}).composite(comps).jpeg({quality: 80}).toFile(path.join(CACHE, `triples-sheet-${s + 1}.jpg`));
}
console.log(triples.length, 'triples');
