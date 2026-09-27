/** Local edge-patch displacement diagnostic. Does not authorize texture replacement. */
import fs from 'node:fs/promises';import sharp from 'sharp';
const root='.cache/facade-assessment/block-assemblies-v1';
async function edges(path:string){const {data,info}=await sharp(path).resize({width:1024}).greyscale().raw().toBuffer({resolveWithObject:true});const e=new Float32Array(data.length);for(let y=1;y<info.height-1;y++)for(let x=1;x<1023;x++){const i=y*1024+x;e[i]=Math.hypot(data[i+1]-data[i-1],data[i+1024]-data[i-1024]);}return {e,h:info.height};}
const a=await edges('.cache/facade-assessment/banana-head-on-v1/strip1.png');const b=await edges(root+'/banana-clean.png');
const ext=JSON.parse(await fs.readFile('.cache/facade-assessment/banana-head-on-v1/auto-components-strip1/components.json','utf8'));
const anchors=[];
for(const f of ext.features.filter((f:any)=>f.kind==='window'&&f.bounds[3]<.75)){
 const [l,t,r]=f.bounds;const cx=Math.round((l+r)*512),cy=Math.round(t*a.h);if(cx<30||cx>994||cy<30||cy>a.h-30)continue;
 let best={score:-Infinity,dx:0,dy:0};
 for(let dy=-16;dy<=16;dy++)for(let dx=-16;dx<=16;dx++){
  let dot=0,aa=0,bb=0;
  for(let y=-8;y<=12;y+=2)for(let x=-12;x<=12;x+=2){const av=a.e[(cy+y)*1024+cx+x],bv=b.e[(cy+y+dy)*1024+cx+x+dx];dot+=av*bv;aa+=av*av;bb+=bv*bv;}
  const score=dot/Math.sqrt(aa*bb||1);if(score>best.score)best={score,dx,dy};
 }anchors.push({id:f.id,...best,displacement:Math.hypot(best.dx,best.dy)});
}
const reliable=anchors.filter(a=>a.score>.65&&Math.abs(a.dx)<16&&Math.abs(a.dy)<16);
const rms=Math.sqrt(reliable.reduce((s,a)=>s+a.displacement**2,0)/Math.max(1,reliable.length)),max=Math.max(0,...reliable.map(a=>a.displacement));
const report={method:'local edge NCC on upper opening patches at 1024 width; diagnostic only, repetitive features may alias',anchors,reliable:reliable.length,rmsPixels:rms,maxPixels:max,thresholds:{rms:3,max:8},geometricGate:reliable.length>=20&&rms<=3&&max<=8,acceptedForTexture:false,reason:'Requires source-detail preservation and independent visual review in addition to alignment; current review rejects replacement'};
await fs.writeFile(root+'/layer-alignment.json',JSON.stringify(report,null,2));console.log({reliable:reliable.length,rms,max,geometricGate:report.geometricGate});
