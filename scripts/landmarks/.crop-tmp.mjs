import sharp from 'sharp';
const [,, inp, out, x, y, w, h, s='2', grid='0'] = process.argv;
let img = sharp(inp).extract({left:+x, top:+y, width:+w, height:+h}).resize({width: Math.round(+w*+s)});
if (+grid) { const W=Math.round(+w*+s), H=Math.round(+h*+s); const ppm=+grid*+s; let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (let m=0; m*ppm<W; m++) svg+=`<line x1="${m*ppm}" y1="0" x2="${m*ppm}" y2="${H}" stroke="${m%5?'#0ff':'#f00'}" stroke-opacity="0.5"/>`;
  svg+='</svg>'; img = sharp(await img.png().toBuffer()).composite([{input: Buffer.from(svg)}]); }
await img.jpeg({quality:85}).toFile(out);
