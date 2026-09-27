/** Heuristic components from a generated flat elevation, never measured geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

type Box = {x0:number;y0:number;x1:number;y1:number;pixels:number};
const sha = (bytes:Buffer) => createHash('sha256').update(bytes).digest('hex');
const overlap = (a:number,b:number,c:number,d:number) => Math.max(0,Math.min(b,d)-Math.max(a,c));
const norm = (b:Box,w:number,h:number) => [b.x0/w,b.y0/h,b.x1/w,b.y1/h].map(v=>+v.toFixed(5));

export function components(mask:Uint8Array,w:number,h:number):Box[] {
  if(mask.length!==w*h) throw Error('Mask dimensions mismatch');
  const seen=new Uint8Array(mask.length), queue=new Int32Array(mask.length), out:Box[]=[];
  for(let s=0;s<mask.length;s++) {
    if(!mask[s]||seen[s]) continue;
    let head=0,tail=1,x0=w,y0=h,x1=0,y1=0; queue[0]=s;seen[s]=1;
    while(head<tail) {
      const p=queue[head++],x=p%w,y=(p/w)|0;
      x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);
      for(const q of [x?p-1:-1,x+1<w?p+1:-1,y?p-w:-1,y+1<h?p+w:-1])
        if(q>=0&&mask[q]&&!seen[q]) {seen[q]=1;queue[tail++]=q;}
    }
    if(tail>=16) out.push({x0,y0,x1,y1,pixels:tail});
  }
  return out;
}

export function groupPanes(input:Box[],w:number,h:number):Box[] {
  const boxes=input.filter(b=>b.x1-b.x0>=5&&b.y1-b.y0>=10).map(b=>({...b}));
  // Only short mullion-sized gaps with strong vertical/horizontal alignment join.
  let changed=true;
  while(changed) {
    changed=false;
    outer:for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const a=boxes[i],b=boxes[j],xgap=Math.max(0,a.x0-b.x1,b.x0-a.x1),
        ygap=Math.max(0,a.y0-b.y1,b.y0-a.y1),
        yo=overlap(a.y0,a.y1,b.y0,b.y1),xo=overlap(a.x0,a.x1,b.x0,b.x1);
      const horizontal=xgap<=Math.max(7,w*.009)&&yo>=.72*Math.min(a.y1-a.y0,b.y1-b.y0);
      const vertical=ygap<=Math.max(6,h*.011)&&xo>=.72*Math.min(a.x1-a.x0,b.x1-b.x0);
      const merged={x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1),pixels:a.pixels+b.pixels};
      if(!(horizontal||vertical)||merged.x1-merged.x0>w*.11||merged.y1-merged.y0>h*.22) continue;
      boxes[i]=merged;boxes.splice(j,1);changed=true;break outer;
    }
  }
  return boxes.filter(b=>{
    const bw=b.x1-b.x0,bh=b.y1-b.y0,fill=b.pixels/(bw*bh);
    return bw>=w*.008&&bh>=h*.025&&bw<=w*.11&&bh<=h*.22&&fill>=.19&&
      b.y0>=h*.08&&b.y1<=h*.985&&bh/bw>=.75;
  }).sort((a,b)=>a.y0-b.y0||a.x0-b.x0);
}

export function classifyRgb(data:Buffer,w:number,h:number) {
  if(data.length!==w*h*3) throw Error('Expected RGB pixels');
  const glass=new Uint8Array(w*h), wall=new Uint8Array(w*h), dark=new Uint8Array(w*h);
  const palette=new Map<string,number>();
  for(let i=0;i<w*h;i++) {
    const r=data[i*3],g=data[i*3+1],b=data[i*3+2],lum=(54*r+183*g+19*b)/256;
    glass[i]=lum>=62&&lum<=192&&Math.abs(r-g)<19&&Math.abs(g-b)<25&&b>=r?1:0;
    dark[i]=lum<85?1:0;
    // Coarse masonry mask: warm, medium-light, and chromatic enough to exclude
    // glass/white sky. It cannot distinguish one adjacent owner from another.
    wall[i]=r>80&&r<215&&r>g*1.08&&g>=b*.87&&lum>=65&&lum<190&&!glass[i]?1:0;
    if(wall[i]) {
      const key=[r,g,b].map(v=>Math.min(240,Math.round(v/16)*16).toString(16).padStart(2,'0')).join('');
      palette.set(key,(palette.get(key)||0)+1);
    }
  }
  return {glass,wall,dark,palette:[...palette].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([hex,pixels])=>({hex:'#'+hex,pixels}))};
}

export function railEvidence(box:Box,dark:Uint8Array,w:number,h:number,nextOpeningY=h) {
  const bw=box.x1-box.x0,bh=box.y1-box.y0;
  const x0=Math.max(0,Math.floor(box.x0-bw*.36)),x1=Math.min(w,Math.ceil(box.x1+bw*.36));
  const y0=Math.max(0,Math.floor(box.y0+bh*.64)),y1=Math.min(h,Math.ceil(box.y1+bh*.35));
  let lines=0,pixels=0;
  for(let y=y0;y<y1;y++) {let row=0;for(let x=x0;x<x1;x++) row+=dark[y*w+x];pixels+=row;if(row/(x1-x0)>.55) lines++;}
  let lower=0,lowerCount=0;
  for(let y=Math.floor(box.y0+bh*.55);y<box.y1;y++)for(let x=box.x0;x<box.x1;x++)
    {lower+=dark[y*w+x];lowerCount++;}
  // The glazed component ends at the rail. The projection continues below it:
  // scan for its last broad dark rail/slab row, stopping before the next floor.
  const railTop=Math.max(0,box.y1-2),limit=Math.min(h,nextOpeningY-4,Math.ceil(box.y1+bh*1.5));
  let last=railTop;
  for(let y=railTop;y<limit;y++) {
    let count=0;for(let x=x0;x<x1;x++)count+=dark[y*w+x];
    if(count/(x1-x0)>.43)last=y;
  }
  return {fraction:pixels/((x1-x0)*(y1-y0)||1),lines,lowerDarkFraction:lower/(lowerCount||1),
    box:{x0,y0:railTop,x1,y1:Math.min(limit,Math.max(railTop+4,last+2)),pixels}};
}

export function localWallColour(box:Box,data:Buffer,wall:Uint8Array,w:number,h:number) {
  const bw=box.x1-box.x0,bh=box.y1-box.y0;
  const x0=Math.max(0,Math.floor(box.x0-bw*.55)),x1=Math.min(w,Math.ceil(box.x1+bw*.55));
  const y0=Math.max(0,Math.floor(box.y0-bh*.3)),y1=Math.min(h,Math.ceil(box.y1+bh*.3));
  const values:[number[],number[],number[]]=[[],[],[]];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++) {
    if(x>=box.x0-2&&x<box.x1+2&&y>=box.y0-2&&y<box.y1+2) continue;
    const i=y*w+x;if(!wall[i]) continue;
    for(let c=0;c<3;c++)values[c].push(data[i*3+c]);
  }
  if(values[0].length<40) return {wallColour:null,colourSamplePixels:values[0].length};
  const channels=values.map(v=>{v.sort((a,b)=>a-b);return v[Math.floor(v.length/2)];});
  return {wallColour:'#'+channels.map(v=>v.toString(16).padStart(2,'0')).join(''),
    colourSamplePixels:values[0].length};
}

function args() {
  const map=new Map(process.argv.slice(2).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
  const input=map.get('--input'),receipt=map.get('--receipt'),out=map.get('--out');
  if(!input||!receipt||!out) throw Error('Usage: --input=strip1.png --receipt=strip1.json --out=directory');
  return {input,receipt,out};
}

export async function run(inputPath:string,receiptPath:string,outDir:string) {
  const image=await fs.readFile(inputPath),receiptBytes=await fs.readFile(receiptPath),receipt=JSON.parse(receiptBytes.toString());
  const meta=await sharp(image).metadata();
  if(receipt.status!=='ok'||receipt.pngSha256!==sha(image)||receipt.width!==meta.width||receipt.height!==meta.height)
    throw Error('Generated image/receipt hash or dimensions mismatch');
  const {data,info}=await sharp(image).resize({width:1024,withoutEnlargement:true}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.channels!==3) throw Error('Expected RGB analysis');
  const {glass,wall,dark,palette}=classifyRgb(data,info.width,info.height);
  const boxes=groupPanes(components(glass,info.width,info.height),info.width,info.height);
  const features:object[]=[];const balconyMask=new Uint8Array(info.width*info.height),doorMask=new Uint8Array(info.width*info.height);
  boxes.forEach((b,i)=>{
    const nextOpeningY=Math.min(info.height,...boxes.filter(other=>other.y0>b.y1+5&&
      overlap(other.x0,other.x1,b.x0,b.x1)>.5*(b.x1-b.x0)).map(other=>other.y0));
    const rel=railEvidence(b,dark,info.width,info.height,nextOpeningY),bounds=norm(b,info.width,info.height);
    const nearBase=b.y1>info.height*.83;
    const balcony=!nearBase&&b.y0>info.height*.32&&rel.lowerDarkFraction>.22&&rel.lines>=2;
    const colour=localWallColour(b,data,wall,info.width,info.height);
    features.push({id:`opening-${i+1}`,kind:'window',bounds,
      confidence:+Math.min(.8,.35+b.pixels/((b.x1-b.x0)*(b.y1-b.y0))*.3).toFixed(2),
      inferredDepthM:nearBase?.12:.18,status:'generated-image-heuristic',
      ...colour,note:nearBase?'Ground opening role unresolved; may be shopfront glazing or a door':undefined});
    if(balcony) {
      const rb=rel.box;
      features.push({id:`balcony-${i+1}`,kind:'balcony',bounds:norm(rb,info.width,info.height),
        confidence:+Math.min(.7,.3+rel.fraction).toFixed(2),inferredDepthM:.55,
        linkedOpeningId:`opening-${i+1}`,status:'generated-image-heuristic',...colour});
      for(let y=rb.y0;y<rb.y1;y++)for(let x=rb.x0;x<rb.x1;x++) if(dark[y*info.width+x]) balconyMask[y*info.width+x]=255;
    }
  });
  // Only tall, narrow, dark components reaching the base receive a tentative
  // door label. Other ground glazing stays window with an unresolved role.
  const doors=components(dark,info.width,info.height).filter(b=>{
    const bw=b.x1-b.x0,bh=b.y1-b.y0;
    return b.y0>info.height*.77&&b.y1>info.height*.96&&bh>info.height*.14&&
      bw>=info.width*.012&&bw<info.width*.04&&bh/bw>3;
  });
  doors.forEach((b,i)=>{
    const colour=localWallColour(b,data,wall,info.width,info.height);
    features.push({id:`door-${i+1}`,kind:'door',bounds:norm(b,info.width,info.height),
      confidence:.42,inferredDepthM:.12,status:'generated-image-heuristic',...colour,
      note:'Dark base component; door role and exact aperture unverified'});
    for(let y=b.y0;y<b.y1;y++)for(let x=b.x0;x<b.x1;x++)if(dark[y*info.width+x]) doorMask[y*info.width+x]=255;
  });
  await fs.mkdir(outDir,{recursive:true});
  const masks:Record<string,{path:string;sha256:string}>={};
  for(const [name,mask] of Object.entries({glass,wall,balcony:balconyMask,door:doorMask})) {
    const binary=Buffer.from(mask.map(v=>v?255:0)),bytes=await sharp(binary,{raw:{width:info.width,height:info.height,channels:1}}).png().toBuffer();
    const dest=path.join(outDir,`${name}-mask.png`);await fs.writeFile(dest,bytes);masks[name]={path:dest,sha256:sha(bytes)};
  }
  const overlaySvg=`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">${features.map((f:any)=>{
    const [x0,y0,x1,y1]=f.bounds;const colour=f.kind==='balcony'?'#00efb8':f.kind==='door'?'#ffb000':'#04cfff';
    return `<rect x="${x0*info.width}" y="${y0*info.height}" width="${(x1-x0)*info.width}" height="${(y1-y0)*info.height}" fill="none" stroke="${colour}" stroke-width="2"/>`;
  }).join('')}</svg>`;
  const overlayBytes=await sharp(image).resize({width:info.width}).composite([{input:Buffer.from(overlaySvg)}]).png().toBuffer();
  const overlayPath=path.join(outDir,'candidate-overlay.png');await fs.writeFile(overlayPath,overlayBytes);
  const output={version:1,policy:'Generated-image CV proposals only; source-photo identity, openings, facade boundaries and metric depths unverified.',
    source:{imagePath:path.resolve(inputPath),imageSha256:sha(image),receiptPath:path.resolve(receiptPath),receiptSha256:sha(receiptBytes),
      width:meta.width,height:meta.height,inputSha256:receipt.inputSha256},
    analysis:{width:info.width,height:info.height,coordinateFrame:'full generated image x-right/y-down, normalized 0..1',
      method:'near-neutral dark-glass components, short-gap pane grouping, dark-rail heuristic, warm-wall colour bins',
      inferredDepthsNotMeasured:true},facadeBoundaries:null,wallColourCandidates:palette,masks,
    overlay:{path:overlayPath,sha256:sha(overlayBytes),legend:{window:'#04cfff',balcony:'#00efb8',door:'#ffb000'}},features};
  await fs.writeFile(path.join(outDir,'components.json'),JSON.stringify(output,null,2)+'\n');
  return output;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) {
  const a=args();run(a.input,a.receipt,a.out).then(o=>console.log(JSON.stringify({out:a.out,features:o.features.length,palette:o.wallColourCandidates}))).catch(e=>{console.error(e);process.exitCode=1;});
}
