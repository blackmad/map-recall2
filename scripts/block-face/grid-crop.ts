/** Gridded 1 m crop of a face strip for measuring: node --import tsx scripts/block-face/grid-crop.ts <face> <x0px> <x1px> <out.png> [scale] */
import sharp from 'sharp';
import fs from 'node:fs';

const [face, x0, x1, out, sc = "2"] = process.argv.slice(2);
const s=JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/strip.json`,'utf8'));
const ppm=s.pixelsPerMetre, S=+sc, W=+x1-+x0, H=s.height;
const lines=[];
for(let m=0;m*ppm<H;m++){const y=(H-m*ppm)*S;lines.push(`<line x1="0" x2="${W*S}" y1="${y}" y2="${y}" stroke="${m%5==0?'#f0f':'#0ff'}" stroke-width="${m%5==0?1.5:0.6}" opacity=".7"/><text x="2" y="${y-2}" font-size="13" fill="#f0f">${m}</text>`);}
const xm0=s.x0M+ +x0/ppm;
for(let m=Math.ceil(xm0);(m-s.x0M)*ppm<+x1;m++){const x=((m-s.x0M)*ppm-+x0)*S;lines.push(`<line y1="0" y2="${H*S}" x1="${x}" x2="${x}" stroke="#0f0" stroke-width="0.5" opacity=".6"/>${m%2==0?`<text x="${x+2}" y="12" font-size="12" fill="#0a0">${(m-s.x0M).toFixed(0)}</text>`:''}`);}
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W*S}" height="${H*S}">${lines.join('')}</svg>`);
await sharp(`staging/block-face/${face}/strip.jpg`).extract({left:+x0,top:0,width:W,height:H}).resize(W*S,H*S).composite([{input:svg}]).png().toFile(out);
