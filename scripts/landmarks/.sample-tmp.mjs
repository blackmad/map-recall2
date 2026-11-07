import sharp from 'sharp';
const [,, inp, ...boxes] = process.argv;
const {data, info} = await sharp(inp).raw().toBuffer({resolveWithObject: true});
for (const b of boxes) { const [name, x0, y0, x1, y1] = b.split(':'); let r=0,g=0,bl=0,n=0; const vals=[];
  for (let y=+y0; y<+y1; y++) for (let x=+x0; x<+x1; x++) { const i=(y*info.width+x)*info.channels; vals.push([data[i],data[i+1],data[i+2]]); }
  vals.sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2])); const mid=vals.slice(Math.floor(vals.length*.25), Math.floor(vals.length*.75));
  for (const v of mid){r+=v[0];g+=v[1];bl+=v[2];n++;}
  const hex='#'+[r/n,g/n,bl/n].map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''); console.log(name, hex); }
