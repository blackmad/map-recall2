/** Contact sheets of the queued houses: crop | spec text | reader text (lane BX). node --import tsx sheet.ts --out <dir> */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const argv = process.argv.slice(2);
const OUT = argv[argv.indexOf('--out') + 1];
const DIR = path.join(ROOT, 'artifacts/belt-crosscheck');
const q = JSON.parse(fs.readFileSync(path.join(DIR, 'queue.json'), 'utf8')).queue as any[];
const specs = JSON.parse(fs.readFileSync(path.join(DIR, 'installed.json'), 'utf8'));
const by = new Map<string, any[]>(); for (const r of q) by.set(r.pand, [...(by.get(r.pand) ?? []), r]);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const wrap = (s: string, n: number) => { const o: string[] = []; let l = ''; for (const w of s.split(' ')) { if ((l + ' ' + w).length > n) { o.push(l); l = w; } else l = l ? l + ' ' + w : w; } if (l) o.push(l); return o; };
const H = 360, CW = 480, TW = 380, W = CW + TW * 2 + 40, PER = 6;
fs.mkdirSync(OUT, { recursive: true });
const ids = [...by.keys()].sort();
(async () => {
  const pages = Math.ceil(ids.length / PER);
  for (let p = 0; p < pages; p++) {
    const slice = ids.slice(p * PER, (p + 1) * PER);
    const comps: sharp.OverlayOptions[] = [];
    const text: string[] = [];
    for (let i = 0; i < slice.length; i++) {
      const id = slice[i], rows = by.get(id)!, y = i * (H + 10) + 10;
      const img = await sharp(path.join(ROOT, rows[0].crop)).resize(CW, H, { fit: 'contain', background: '#222' }).jpeg({ quality: 80 }).toBuffer();
      comps.push({ input: img, left: 10, top: y });
      const fr = specs[id].d.fronts[0], ans = JSON.parse(fs.readFileSync(path.join(DIR, 'answers', `${id}.json`), 'utf8'));
      const sx = CW + 20, rx = CW + 30 + TW;
      const sl = [`${rows[0].address}  (${id.slice(-6)})`, `SPEC: crown ${fr.gable}, rows ${fr.storeys}, bays ${fr.bays}`, `windows ${fr.windows ?? '-'}, ${specs[id].r}`];
      const rl = [`READER ${rows[0].readerModel}`, `crown ${ans.crown}${ans.cornice && ans.cornice !== 'none' ? '/' + ans.cornice : ''}, rows ${ans.storeyParts?.full}${ans.storeyParts?.roof && ans.storeyParts.roof !== 'none' ? ' + ' + ans.storeyParts.roof : ''}${ans.storeyParts?.souterrain === true ? ' + souterrain' : ''}, bays ${ans.bays}`,
        `columns ${JSON.stringify(ans.columns ?? [])}, low ${JSON.stringify(ans.low ?? [])}`, `dormers ${ans.dormers?.count ?? '-'} ${ans.dormers?.kind ?? ''}`];
      for (const r of rows) sl.push(`QUEUED ${r.field}: spec ${r.spec} / reader ${r.reader} (${r.confidence})`);
      if (ans.notes) rl.push(...wrap('note: ' + ans.notes, 52));
      for (const g of (ans.gaps ?? []).slice(0, 3)) rl.push(...wrap(`gap ${g.component}: ${g.what}`, 52));
      const mk = (lines: string[], x: number, hl = false) => lines.slice(0, 18).map((t, k) => `<text x="${x}" y="${y + 20 + k * 19}" font-size="14" font-family="Helvetica, Arial" fill="${t.startsWith('QUEUED') ? '#ff9b6b' : '#eee'}" font-weight="${k === 0 ? 700 : 400}">${esc(t)}</text>`).join('');
      text.push(mk(sl.flatMap(t => wrap(t, 46)), sx), mk(rl, rx));
    }
    const h = slice.length * (H + 10) + 10;
    const svg = Buffer.from(`<svg width="${W}" height="${h}" xmlns="http://www.w3.org/2000/svg">${text.join('')}</svg>`);
    await sharp({ create: { width: W, height: h, channels: 3, background: '#222' } }).composite([...comps, { input: svg, left: 0, top: 0 }]).jpeg({ quality: 82 }).toFile(path.join(OUT, `sheet-${String(p + 1).padStart(2, '0')}.jpg`));
  }
  console.log(`${ids.length} houses, ${pages} sheets`);
})();
