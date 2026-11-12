import fs from 'node:fs'; import sharp from 'sharp';
import { accentSet } from '/Users/blackmad/Code/map-recall2-worktrees/facade-f3-measure-20261112/scripts/house-crops/f3/handset.mjs';
import { detectBands } from '/Users/blackmad/Code/map-recall2-worktrees/facade-f3-measure-20261112/src/canalRecall/facade/whiteAccents.ts';
const set = accentSet(); const out=[]; 
for (const s of set) { const {data,info}=await sharp(s.file).removeAlpha().raw().toBuffer({resolveWithObject:true}); const ppm=JSON.parse(fs.readFileSync(`/Users/blackmad/Code/map-recall2-source-data-h5h/pand-crops/${s.id}/front.json`)).crop.pixelsPerMetre; const d=detectBands({width:info.width,height:info.height,rgb:new Uint8Array(data),ppm}); out.push({s,d,info}); }
const pick = out.filter(o=>!o.s.bands&&o.d.present).slice(0,8);
const items=[]; for (const [i,o] of pick.entries()){ const lines=o.d.bands.map(b=>`<rect x="0" y="${b.y0M*50}" width="${o.info.width}" height="${Math.max(2,(b.y1M-b.y0M)*50)}" fill="red" fill-opacity="0.5"/>`).join(''); const f=`${process.env.TMPDIR}/ov${i}.png`; await sharp(o.s.file).composite([{input:Buffer.from(`<svg width="${o.info.width}" height="${o.info.height}">${lines}</svg>`)}]).png().toFile(f); items.push({key:o.s.id,file:f}); }
fs.writeFileSync(process.env.TMPDIR+'/ov.json',JSON.stringify(items));
