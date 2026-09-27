/** Source-bound, deliberately provisional entrance proposals for flat facade strips.
 * No reviewed opening coordinates or per-building templates enter this detector. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {classifyRgb,components,groupPanes,localWallColour} from './extract-facade-components.ts';

type Box={x0:number;y0:number;x1:number;y1:number;pixels:number};
type Seed={box:Box;source:string;core?:'cream'|'green'|'glass'};
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const lum=(r:number,g:number,b:number)=>(54*r+183*g+19*b)/256;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const med=(a:number[])=>a.length?a.sort((x,y)=>x-y)[Math.floor(a.length/2)]:null;
const boxNorm=(b:Box,w:number,h:number)=>[b.x0/w,b.y0/h,b.x1/w,b.y1/h].map(v=>+v.toFixed(6));
const xOverlap=(a:Box,b:Box)=>Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0));

/** Runs of light filled pixels expose narrow cream doors; thin trim runs are rejected. */
export function creamRuns(rgb:Buffer,w:number,h:number,groundTop:number):Seed[] {
  const columns:Array<{x:number;y0:number;y1:number}>=[];
  for(let x=0;x<w;x++) {
    let start=-1,best={y0:0,y1:0};
    for(let y=groundTop;y<=Math.min(h-1,Math.ceil(h*.985));y++) {
      const i=(y*w+x)*3,r=rgb[i],g=rgb[i+1],b=rgb[i+2];
      const light=r>=180&&g>=170&&b>=145&&r-g<30&&g-b<42;
      if(light&&start<0)start=y;
      if((!light||y===h-1)&&start>=0) {const end=light?y+1:y;if(end-start>best.y1-best.y0)best={y0:start,y1:end};start=-1;}
    }
    if(best.y1-best.y0>=h*.052&&best.y1>=h*.91)columns.push({x,...best});
  }
  const out:Seed[]=[];let group=columns.slice(0,1);
  const flush=()=>{if(group.length>=Math.max(5,w*.006)) {
    const x0=group[0].x,x1=group.at(-1)!.x+1,y0=Math.min(...group.map(c=>c.y0)),y1=Math.max(...group.map(c=>c.y1));
    out.push({box:{x0,y0,x1,y1,pixels:group.length*(y1-y0)},source:'cream-vertical-run',core:'cream'});
  }};
  for(let i=1;i<columns.length;i++) {if(columns[i].x>group.at(-1)!.x+1){flush();group=[];}group.push(columns[i]);}
  if(group.length)flush();
  return out.filter(s=>s.box.x1-s.box.x0<=w*.07);
}

export function detectSeeds(rgb:Buffer,w:number,h:number) {
  const groundTop=Math.floor(h*.78),cream=creamRuns(rgb,w,h,groundTop);
  const green=new Uint8Array(w*h),red=new Uint8Array(w*h);
  for(let y=groundTop;y<h;y++)for(let x=0;x<w;x++) {
    const i=y*w+x,p=i*3,r=rgb[p],g=rgb[p+1],b=rgb[p+2];
    green[i]=r<87&&g<92&&b<88&&g>=r*.7&&b<g*1.25?1:0;
    red[i]=r>95&&r>g*1.45&&r>b*1.35?1:0;
  }
  const greenSeeds=components(green,w,h).filter(b=>b.y1>=h*.94&&b.y1-b.y0>=h*.085&&
    b.x1-b.x0>=w*.008&&b.x1-b.x0<w*.105).map(box=>({box,source:'dark-green-component',core:'green' as const}));
  const {glass,wall}=classifyRgb(rgb,w,h);
  const glassSeeds=groupPanes(components(glass,w,h),w,h).filter(b=>b.y0>=groundTop&&b.y1>h*.89&&
    b.y1-b.y0>=h*.05).map(box=>({box,source:'ground-glazing-component',core:'glass' as const}));
  return {seeds:[...cream,...greenSeeds,...glassSeeds],green,red,wall,groundTop};
}

/** Merge nested fill/glazing pieces, without joining adjacent street-front openings. */
export function mergeSeeds(seeds:Seed[],w:number,h:number):Array<{box:Box;sources:string[];cores:string[]}> {
  const groups=seeds.map(s=>({box:{...s.box},sources:[s.source],cores:[s.core!]}));
  let changed=true;
  while(changed){changed=false;
    outer:for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const a=groups[i].box,b=groups[j].box,over=xOverlap(a,b),small=Math.min(a.x1-a.x0,b.x1-b.x0),
        yover=Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
      if(over<small*.48||yover<Math.min(a.y1-a.y0,b.y1-b.y0)*.25)continue;
      const merged={x0:Math.min(a.x0,b.x0),x1:Math.max(a.x1,b.x1),y0:Math.min(a.y0,b.y0),y1:Math.max(a.y1,b.y1),pixels:a.pixels+b.pixels};
      if(merged.x1-merged.x0>w*.12||merged.y1-merged.y0>h*.27)continue;
      groups[i]={box:merged,sources:[...new Set([...groups[i].sources,...groups[j].sources])],
        cores:[...new Set([...groups[i].cores,...groups[j].cores])]};groups.splice(j,1);changed=true;break outer;
    }
  }
  return groups.sort((a,b)=>a.box.x0-b.box.x0);
}

/** Trace dark arch pixels locally; if no convex edge survives, retain an explicit fallback. */
export function fitOuterArch(box:Box,rgb:Buffer,w:number,h:number,groundTop:number,groundBottom:number,globalDarkRows?:Float32Array) {
  const bw=box.x1-box.x0,bh=box.y1-box.y0;
  const x0=clamp(Math.floor(box.x0-Math.max(3,bw*.12)),0,w-2),x1=clamp(Math.ceil(box.x1+Math.max(3,bw*.12)),x0+2,w);
  const searchTop=Math.max(groundTop,Math.floor(box.y0-Math.min(h*.09,bh*.75)));
  const searchEnd=Math.min(h-1,Math.ceil(box.y0+Math.max(4,bh*.12)));
  const points:Array<{x:number;y:number}>=[];
  for(let k=0;k<13;k++) {
    const x=Math.round(x0+(x1-x0)*k/12),hits:number[]=[];
    for(let y=searchTop;y<searchEnd;y++) {
      const p=(y*w+x)*3;if((!globalDarkRows||globalDarkRows[y]<.24)&&lum(rgb[p],rgb[p+1],rgb[p+2])<70) hits.push(y);
    }
    // First near-black edge above the panel; a continuous horizontal plinth
    // line across the whole image is filtered by the narrow search band.
    if(hits.length)points.push({x,y:hits[0]});
  }
  const center=med(points.filter(p=>p.x>x0+(x1-x0)*.35&&p.x<x0+(x1-x0)*.65).map(p=>p.y));
  const sides=med(points.filter(p=>p.x<x0+(x1-x0)*.2||p.x>x0+(x1-x0)*.8).map(p=>p.y));
  const edgeFit=center!==null&&sides!==null&&sides>=center&&sides-center<=h*.09;
  const vertexY=edgeFit?center!:Math.max(groundTop,box.y0-Math.max(5,bh*.16));
  const sideY=edgeFit?Math.max(sides!,vertexY+1):box.y0;
  const bottomY=clamp(Math.max(box.y1+3,groundBottom-3),sideY+5,Math.min(h-1,groundBottom+1));
  const outline:Array<[number,number]>=[];
  for(let k=0;k<=16;k++) {
    const t=k/16,z=2*t-1;
    outline.push([+(x0+(x1-x0)*t)/w,+((vertexY+(sideY-vertexY)*z*z)/h).toFixed(6)]);
  }
  outline.push([x1/w,bottomY/h],[x0/w,bottomY/h]);
  return {outline:outline.map(([x,y])=>[+x.toFixed(6),+y.toFixed(6)]),
    bbox:boxNorm({x0,y0:vertexY,x1,y1:bottomY,pixels:0},w,h),edgeFit,
    edgeSamples:points.length,fitReason:edgeFit?'dark-convex-edge':'symmetric-arch-fallback'};
}

function redFraction(red:Uint8Array,b:Box,w:number,h:number) {
  const x0=clamp(b.x0-2,0,w-1),x1=clamp(b.x1+2,x0+1,w);
  const y0=clamp(Math.floor(Math.max(b.y0+b.y1*.0,h*.86)),0,h-1),y1=clamp(Math.ceil(Math.max(b.y1,h*.975)),y0+1,h);
  let n=0,t=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){n+=red[y*w+x];t++;}
  return n/(t||1);
}

export async function run(inputPath:string,receiptPath:string,outDir:string) {
  const image=await fs.readFile(inputPath),receiptBytes=await fs.readFile(receiptPath),receipt=JSON.parse(receiptBytes.toString());
  const meta=await sharp(image).metadata();
  if(receipt.status!=='ok'||receipt.pngSha256!==sha(image)||receipt.width!==meta.width||receipt.height!==meta.height)
    throw Error('Generated image/receipt hash or dimensions mismatch');
  const {data,info}=await sharp(image).resize({width:1024,withoutEnlargement:true}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.channels!==3)throw Error('Expected RGB strip');
  const w=info.width,h=info.height,{seeds,green,red,wall,groundTop}=detectSeeds(data,w,h);
  let groundBottom=h-1;
  for(let y=h-1;y>=groundTop;y--) {let nonwhite=0;for(let x=0;x<w;x++){
    const p=(y*w+x)*3;if(data[p]<240||data[p+1]<240||data[p+2]<240)nonwhite++;
  }if(nonwhite>w*.28){groundBottom=y;break;}}
  const globalDarkRows=new Float32Array(h);
  for(let y=groundTop;y<h;y++){let dark=0;for(let x=0;x<w;x++){
    const p=(y*w+x)*3;if(lum(data[p],data[p+1],data[p+2])<70)dark++;
  }globalDarkRows[y]=dark/w;}
  const merged=mergeSeeds(seeds,w,h);const candidates=merged.map((item,i)=>{
    const b=item.box,arch=fitOuterArch(b,data,w,h,groundTop,groundBottom,globalDarkRows),colour=localWallColour(b,data,wall,w,h);
    const redBelow=redFraction(red,b,w,h),wide=(b.x1-b.x0)>w*.058;
    let role:'entrance'|'shopfront'|'uncertain'='uncertain',confidence=.4;
    const reasons=[...item.sources,arch.fitReason];
    if(redBelow>.035){role='shopfront';confidence=.7;reasons.push('red-lower-panel');}
    else if(wide&&item.cores.includes('glass')){role='shopfront';confidence=.56;reasons.push('wide-ground-glazing');}
    else if(item.cores.includes('cream')&&(b.x1-b.x0)<w*.035&&b.y0>h*.84&&b.y1>h*.95){
      role='entrance';confidence=.72;reasons.push('tall-filled-cream-core');}
    else if(item.cores.includes('green')&&(b.y1-b.y0)>h*.085&&(b.x1-b.x0)>w*.023&&(b.x1-b.x0)<w*.07){
      role='entrance';confidence=.62;reasons.push('tall-dark-green-core');}
    else if(item.cores.includes('glass')&&b.y1>h*.95&&!wide){
      role='entrance';confidence=.53;reasons.push('glazed-opening-reaches-ground');}
    else if(item.cores.includes('glass')&&!wide){reasons.push('ground-glazing-role-unresolved');}
    if(!arch.edgeFit)confidence=Math.min(confidence,.5);
    const geometryReady=role==='entrance'&&arch.edgeFit&&confidence>=.53;
    if(role==='entrance'&&!geometryReady)reasons.push('geometry-withheld-unverified-outer-edge');
    return {id:`ground-${String(i+1).padStart(3,'0')}`,role,confidence:+confidence.toFixed(2),reasons,
      outline:arch.outline,bbox:arch.bbox,seedBounds:boxNorm(b,w,h),sourceKinds:item.sources,
      colours:{surroundingWall:colour.wallColour,wallSamplePixels:colour.colourSamplePixels},
      edge:{fit:arch.edgeFit,samples:arch.edgeSamples},geometryReady,status:'generated-image-heuristic'};
  });
  // Tall foreground components without an overlapping proposal remain visible
  // in the report instead of silently disappearing from the denominator.
  const coverageGaps=components(green,w,h).filter(b=>b.y1>h*.94&&b.y1-b.y0>h*.065&&b.x1-b.x0>=w*.005&&
    !merged.some(m=>xOverlap(m.box,b)>.5*Math.min(m.box.x1-m.box.x0,b.x1-b.x0)))
    .map(b=>({bounds:boxNorm(b,w,h),reason:'dark-ground-component-not-merged; classification withheld'}));
  await fs.mkdir(outDir,{recursive:true});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${candidates.map(c=>{
    const colour=c.role==='entrance'?'#00ed75':c.role==='shopfront'?'#ff7045':'#00c8ff';
    const pts=c.outline.map(([x,y])=>`${(x*w).toFixed(1)},${(y*h).toFixed(1)}`).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="${colour}" stroke-width="2"/><text x="${c.bbox[0]*w}" y="${c.bbox[1]*h-3}" font-size="11" font-weight="bold" fill="${colour}" stroke="#111" stroke-width=".25">${c.id}</text>`;
  }).join('')}</svg>`;
  const overlay=await sharp(image).resize({width:w}).composite([{input:Buffer.from(svg)}]).png().toBuffer();
  const overlayPath=path.join(outDir,'entrances-overlay.png');await fs.writeFile(overlayPath,overlay);
  const output={version:1,policy:'Generated-image heuristic proposals only. Full owner identity, outer-mouth geometry and depths are not accepted.',
    sourceHash:sha(image),imageSize:[meta.width,meta.height],source:{imagePath:path.resolve(inputPath),
      receiptPath:path.resolve(receiptPath),receiptSha256:sha(receiptBytes),inputSha256:receipt.inputSha256},
    analysis:{width:w,height:h,groundBandTop:groundTop/h,groundBottom:groundBottom/h,coordinateFrame:'full image normalized x-right/y-down',
      noReviewedOpeningCoordinates:true},candidates,coverageGaps,
    counts:{seeds:seeds.length,candidates:candidates.length,entrance:candidates.filter(c=>c.role==='entrance').length,
      shopfront:candidates.filter(c=>c.role==='shopfront').length,uncertain:candidates.filter(c=>c.role==='uncertain').length,
      geometryReady:candidates.filter(c=>c.geometryReady).length,gaps:coverageGaps.length},
    overlay:{path:path.resolve(overlayPath),sha256:sha(overlay)}};
  await fs.writeFile(path.join(outDir,'entrances.json'),JSON.stringify(output,null,2)+'\n');return output;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) {
  const values=new Map(process.argv.slice(2).map(arg=>{const i=arg.indexOf('=');return [arg.slice(0,i),arg.slice(i+1)];}));
  const input=values.get('--input'),receipt=values.get('--receipt'),out=values.get('--out');
  if(!input||!receipt||!out)throw Error('Usage: --input=strip.png --receipt=strip.json --out=directory');
  run(input,receipt,out).then(r=>console.log(JSON.stringify(r.counts))).catch(e=>{console.error(e);process.exitCode=1;});
}
