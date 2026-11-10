// Hand set v1 (lane H5h, #351): the pands of the set and the archived images a reader looks at, per pand.
//   ab07     60 AB07 pands from select.ts; crops in map-recall2-source-data pand-crops/<id>/ (the describe crop first, then the
//            manifest front and the best-of-years crops)
//   easy     13 of H9's easy-houses-20261110 set (the brief list less the two shopfront-only pands 171851 and 171854); crops from
//            scripts/pand-reference, archived as source-data pand-reference-easy-houses/<id>/front.jpg and front-alt.jpg
//   nassau   the 7 pands of block face nassau-145-152 (the brief said 8; the face has 7 houses), cut from source-data
//            block-face-strips/nassau-145-152/strip.jpg by the face's span pixels, 1 m margin each side
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
export const ARCHIVE = process.env.HOUSE_CROPS_ARCHIVE ?? path.join(os.homedir(), 'Code/map-recall2-source-data-h5h');
/** A read-only checkout of source-data main (block-face-strips are not in the lane's sparse worktree). */
export const SOURCE_MAIN = process.env.SOURCE_DATA_MAIN ?? path.join(os.homedir(), 'Code/map-recall2-source-data');

export const EASY_IDS = ['0363100012175320', '0363100012175318', '0363100012168136', '0363100012182857', '0363100012182849', '0363100012182848', '0363100012176312', '0363100012176346', '0363100012169116', '0363100012168578', '0363100012180181', '0363100012167483', '0363100012171023'];
export const NASSAU_FACE = 'nassau-145-152';

export type Image = { ref: string; sha256: string; file: string; ppm: number; label: string; /** pixel span to cut (strip) */ px?: [number, number] };
export type SetPand = { pandId: string; group: 'ab07' | 'easy' | 'nassau'; images: Image[] };

export const sha = (f: string) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

export function ab07Ids(): { pandId: string; crop: string }[] {
  const sel = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.selection.json'), 'utf8'));
  return sel.picks.map((p: any) => ({ pandId: p.pandId, crop: p.crop }));
}

export function setPands(): SetPand[] {
  const out: SetPand[] = [];
  for (const { pandId, crop } of ab07Ids()) {
    const dir = path.join(ARCHIVE, 'pand-crops', pandId);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'front.json'), 'utf8'));
    const ppm = meta.crop?.pixelsPerMetre ?? (meta.method === 'strip' ? 40 : 50);
    const first = crop.replace(`source-data://pand-crops/${pandId}/`, '');
    const files = [first, 'front.jpg', ...(fs.existsSync(path.join(dir, 'years')) ? fs.readdirSync(path.join(dir, 'years')).sort().reverse().map(f => `years/${f}`) : [])];
    const seen = new Set<string>(), images: Image[] = [];
    for (const f of files) {
      const abs = path.join(dir, f); if (!fs.existsSync(abs)) continue;
      const h = sha(abs); if (seen.has(h)) continue; seen.add(h);
      images.push({ ref: `source-data://pand-crops/${pandId}/${f}`, sha256: h, file: abs, ppm, label: f === first ? `${f} (describe crop)` : f });
    }
    out.push({ pandId, group: 'ab07', images });
  }
  for (const pandId of EASY_IDS) {
    const images: Image[] = [];
    for (const n of ['front', 'front-alt']) {
      const abs = path.join(ARCHIVE, 'pand-reference-easy-houses', pandId, `${n}.jpg`); if (!fs.existsSync(abs)) continue;
      images.push({ ref: `source-data://pand-reference-easy-houses/${pandId}/${n}.jpg`, sha256: sha(abs), file: abs, ppm: 50, label: `${n}.jpg` });
    }
    out.push({ pandId, group: 'easy', images });
  }
  const strip = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/block-face/faces', NASSAU_FACE, 'strip.json'), 'utf8'));
  const stripFile = path.join(SOURCE_MAIN, 'block-face-strips', NASSAU_FACE, 'strip.jpg'); const stripSha = sha(stripFile);
  for (const s of strip.spans) {
    const m = strip.pixelsPerMetre; const px: [number, number] = [Math.max(0, s.px[0] - m), Math.min(strip.width, s.px[1] + m)];
    out.push({ pandId: s.pandId, group: 'nassau', images: [{ ref: `source-data://block-face-strips/${NASSAU_FACE}/strip.jpg#px=${px[0]}-${px[1]}`, sha256: stripSha, file: stripFile, ppm: m, px, label: `strip ${strip.date} px ${px[0]}-${px[1]} (1 m margin)` }] });
  }
  return out;
}
