/** One shared PDOK orthophoto tile; per-building crops with footprint overlays. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import crypto from 'node:crypto';
const root='.cache/da-costa-neighbourhood';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const manifest=JSON.parse(await fs.readFile(root+'/manifest.json'));
const [x0,z0,x1,z1]=block.bounds,scale=8,width=Math.round((x1-x0)*scale),height=Math.round((z1-z0)*scale);
const bbox=[block.origin.x+x0,block.origin.y-z1,block.origin.x+x1,block.origin.y-z0];
const base='https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0';
const cap=await fetch(base+'?SERVICE=WMS&REQUEST=GetCapabilities',{signal:AbortSignal.timeout(30000)});
if(!cap.ok)throw Error('PDOK capabilities unavailable');
const xml=await cap.text();
const layers=[...xml.matchAll(/<Name>([^<]+)<\/Name>/g)].map(m=>m[1]);
const layer=layers.includes('2025_orthoHR')?'2025_orthoHR':layers.includes('Actueel_orthoHR')?'Actueel_orthoHR':null;
if(!layer)throw Error('No expected aerial layer');
const url=base+'?'+new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:layer,STYLES:'',CRS:'EPSG:28992',BBOX:bbox.join(','),WIDTH:String(width),HEIGHT:String(height),FORMAT:'image/jpeg'});
const tileFile=root+'/aerial-tile-'+sha(url).slice(0,16)+'.jpg';
let bytes;
try{bytes=await fs.readFile(tileFile);}catch(e){
  if(e.code!=='ENOENT')throw e;
  // Reuse the legacy tile only when its recorded request exactly matches.
  let previous;try{previous=JSON.parse(await fs.readFile(root+'/aerial.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(previous?.source.url===url){try{bytes=await fs.readFile(root+'/aerial-tile.jpg');}catch(e){if(e.code!=='ENOENT')throw e;}}
  if(!bytes){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('PDOK aerial HTTP '+r.status);bytes=Buffer.from(await r.arrayBuffer());}
  await sharp(bytes).metadata();await fs.writeFile(tileFile,bytes);
}
const dimensions=await sharp(bytes).metadata();if(dimensions.width!==width||dimensions.height!==height)throw Error('Unexpected aerial source dimensions');
const raw=await sharp(bytes).removeAlpha().raw().toBuffer();
const inside=(p,ring)=>{let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const records=[];
for(const id of new Set(manifest.records.map(r=>r.buildingId))){
  const b=block.buildings.find(b=>b.id===id),ring=b.footprint.coordinates[0][0];
  const minX=Math.min(...ring.map(p=>p[0]))-3,maxX=Math.max(...ring.map(p=>p[0]))+3,minZ=Math.min(...ring.map(p=>p[1]))-3,maxZ=Math.max(...ring.map(p=>p[1]))+3;
  const left=Math.max(0,Math.floor((minX-x0)*scale)),top=Math.max(0,Math.floor((minZ-z0)*scale));
  const w=Math.min(width-left,Math.ceil((maxX-minX)*scale)),h=Math.min(height-top,Math.ceil((maxZ-minZ)*scale));if(w<=0||h<=0)continue;
  const points=ring.map(p=>`${((p[0]-x0)*scale-left).toFixed(1)},${((p[1]-z0)*scale-top).toFixed(1)}`).join(' ');
  const overlay=Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><polygon points="${points}" stroke="#ffdc48" stroke-width="2" fill="none"/></svg>`);
  const crop=await sharp(bytes).extract({left,top,width:w,height:h}).composite([{input:overlay}]).jpeg({quality:92}).toBuffer();
  const samples=[[],[],[]];
  for(let y=top;y<top+h;y+=3)for(let x=left;x<left+w;x+=3){
    if(!inside([x/scale+x0,y/scale+z0],ring))continue;
    const offset=(y*width+x)*3,r=raw[offset],g=raw[offset+1],b=raw[offset+2];
    if(Math.max(r,g,b)<30||Math.min(r,g,b)>225||g>r*1.2&&g>b*1.1)continue;
    samples[0].push(r);samples[1].push(g);samples[2].push(b);
  }
  const median=s=>s.sort((a,b)=>a-b)[Math.floor(s.length/2)];
  const coverageComplete=ring.every(p=>p[0]>=x0&&p[0]<=x1&&p[1]>=z0&&p[1]<=z1);
  const roofColour=coverageComplete&&samples[0].length>25?'#'+samples.map(s=>Math.max(50,Math.min(165,Math.round(median(s)*.75+110*.25))).toString(16).padStart(2,'0')).join(''):null;
  const file=id+'-aerial.jpg';await fs.writeFile(root+'/images/'+file,crop);
  const contextLeft=Math.max(0,left-120),contextTop=Math.max(0,top-120),contextWidth=Math.min(width-contextLeft,w+240),contextHeight=Math.min(height-contextTop,h+240);
  const contextPoints=ring.map(p=>`${((p[0]-x0)*scale-contextLeft).toFixed(1)},${((p[1]-z0)*scale-contextTop).toFixed(1)}`).join(' ');
  const contextOverlay=Buffer.from(`<svg width="${contextWidth}" height="${contextHeight}" xmlns="http://www.w3.org/2000/svg"><polygon points="${contextPoints}" stroke="#ffdc48" stroke-width="2" fill="none"/></svg>`);
  const contextBytes=await sharp(bytes).extract({left:contextLeft,top:contextTop,width:contextWidth,height:contextHeight}).composite([{input:contextOverlay}]).jpeg({quality:92}).toBuffer();
  const contextFile=id+'-aerial-context.jpg';await fs.writeFile(root+'/images/'+contextFile,contextBytes);
  records.push({buildingId:id,file,sha256:sha(crop),context:{file:contextFile,sha256:sha(contextBytes)},url,layer,date:layer==='2025_orthoHR'?'2025 (layer year; capture day unavailable)':'current mosaic; capture date unavailable',sourceSha256:sha(bytes),crop:{left,top,width:w,height:h},coverageComplete,roofColour,colourSamples:samples[0].length,colourPolicy:'Median aerial pixels inside footprint, rejecting deep shadow/highlights/green canopy; blended 25% toward neutral for the scene. Incomplete footprints fall back to neutral. Approximate, not material truth.',note:'Yellow footprint marks target; orthophoto alignment is not independently surveyed.'});
}
await fs.writeFile(root+'/aerial.json',JSON.stringify({source:{url,layer,bbox,width,height,sha256:sha(bytes)},records},null,2));
console.log(JSON.stringify({layer,buildings:records.length,bytes:bytes.length}));
