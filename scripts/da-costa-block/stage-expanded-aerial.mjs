/** Fetch only previously clipped building footprints into an isolated staging directory. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const active=path.resolve('.cache/da-costa-neighbourhood');
const stage=path.join(active,'aerial-expanded-2026-09-09');
assert.notEqual(stage,active,'Never overwrite the active aerial cache');
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const original=JSON.parse(await fs.readFile(path.join(active,'aerial.json')));
const manifest=JSON.parse(await fs.readFile(path.join(active,'manifest.json')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),scale=8,pad=18,tightPad=3;
const endpoint='https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0',layer='2025_orthoHR';
const oldActiveHash=sha(await fs.readFile(path.join(active,'aerial.json')));
const missing=original.records.filter(r=>r.coverageComplete===false);
assert.ok(missing.length>0&&missing.length<=10,'Bounded partial-coverage repair only');
await fs.mkdir(path.join(stage,'images'),{recursive:true});await fs.mkdir(path.join(stage,'tiles'),{recursive:true});
const cap=await fetch(endpoint+'?SERVICE=WMS&REQUEST=GetCapabilities',{signal:AbortSignal.timeout(30000)});
if(!cap.ok)throw Error('PDOK capabilities HTTP '+cap.status);
const capabilities=await cap.text();assert.ok(capabilities.includes('<Name>'+layer+'</Name>'),'Exact 2025 layer required; do not silently use current mosaic');
await fs.writeFile(path.join(stage,'capabilities.xml'),capabilities);
const records=[];
for(const before of missing){
  const b=block.buildings.find(b=>b.id===before.buildingId);assert.ok(b,'Missing building geometry');
  const polygons=b.footprint.type==='MultiPolygon'?b.footprint.coordinates:[b.footprint.coordinates];
  const rings=polygons.map(p=>p[0].map(([x,z])=>[block.origin.x+x,block.origin.y-z]));
  const pts=rings.flat(),minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
  const bbox=[Math.floor((minX-pad)*scale)/scale,Math.floor((minY-pad)*scale)/scale,Math.ceil((maxX+pad)*scale)/scale,Math.ceil((maxY+pad)*scale)/scale];
  const width=Math.round((bbox[2]-bbox[0])*scale),height=Math.round((bbox[3]-bbox[1])*scale);
  assert.ok(width>0&&height>0&&width<=4096&&height<=4096,'Bounded tile dimensions exceeded');
  const url=endpoint+'?'+new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:layer,STYLES:'',CRS:'EPSG:28992',BBOX:bbox.join(','),WIDTH:String(width),HEIGHT:String(height),FORMAT:'image/jpeg'});
  const tileFile=path.join(stage,'tiles',sha(url)+'.jpg');let bytes,downloaded=false;
  try{bytes=await fs.readFile(tileFile);}catch(e){if(e.code!=='ENOENT')throw e;const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('PDOK map HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());downloaded=true;}
  const info=await sharp(bytes).metadata();assert.equal(info.width,width);assert.equal(info.height,height);if(downloaded)await fs.writeFile(tileFile,bytes);
  const pixel=([x,y])=>[(x-bbox[0])*scale,(bbox[3]-y)*scale];
  for(const p of pts){const [x,y]=pixel(p);assert.ok(x>=pad*scale-1e-6&&y>=pad*scale-1e-6&&x<=width-pad*scale+1e-6&&y<=height-pad*scale+1e-6,'Every vertex must retain full context margin');const rd=[x/scale+bbox[0],bbox[3]-y/scale];assert.ok(Math.abs(rd[0]-p[0])<1e-8&&Math.abs(rd[1]-p[1])<1e-8,'Georeference must round-trip exactly');}
  const bounds={left:Math.floor((minX-tightPad-bbox[0])*scale),top:Math.floor((bbox[3]-maxY-tightPad)*scale)};
  bounds.width=Math.ceil((maxX+tightPad-bbox[0])*scale)-bounds.left;bounds.height=Math.ceil((bbox[3]-minY+tightPad)*scale)-bounds.top;
  assert.ok(bounds.left>=0&&bounds.top>=0&&bounds.left+bounds.width<=width&&bounds.top+bounds.height<=height);
  const overlay=(w,h,left=0,top=0)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${rings.map(r=>`<polygon points="${r.map(p=>{const q=pixel(p);return(q[0]-left).toFixed(2)+','+(q[1]-top).toFixed(2);}).join(' ')}" fill="none" stroke="#ffdc48" stroke-width="2"/>`).join('')}</svg>`);
  const tight=await sharp(bytes).extract(bounds).composite([{input:overlay(bounds.width,bounds.height,bounds.left,bounds.top)}]).jpeg({quality:94}).toBuffer();
  const context=await sharp(bytes).composite([{input:overlay(width,height)}]).jpeg({quality:94}).toBuffer();
  const file=b.id+'-expanded-aerial.jpg',contextFile=b.id+'-expanded-aerial-context.jpg';
  await fs.writeFile(path.join(stage,'images',file),tight);await fs.writeFile(path.join(stage,'images',contextFile),context);
  records.push({buildingId:b.id,file,sha256:sha(tight),context:{file:contextFile,sha256:sha(context),width,height},url,layer,date:'2025 (layer year; capture day unavailable)',sourceSha256:sha(bytes),sourceFile:tileFile,bbox,scalePxPerM:scale,sourceWidth:width,sourceHeight:height,crop:bounds,coverageComplete:true,contextCoverageComplete:true,contextMarginM:pad,extraContextBeyondTightCropM:pad-tightPad,footprintSha256:sha(JSON.stringify(b.footprint)),before:{coverageComplete:before.coverageComplete,sourceSha256:before.sourceSha256,file:before.file,sha256:before.sha256,crop:before.crop},affectedFrontages:manifest.records.filter(r=>r.buildingId===b.id).map(r=>r.id),roofColour:null,colourPolicy:'No staged roof painting or material inference. Pixels and footprint are evidence, not verified roof truth.',note:'Expanded georeferenced PDOK tile. XY footprint outline remains unsurveyed relative to elevated roof edges; relief displacement and shadow remain possible.'});
  console.log(JSON.stringify({buildingId:b.id,downloaded,width,height,bytes:bytes.length,coverageBefore:false,coverageAfter:true,contextMarginM:pad}));
}
const output={version:1,stagedAt:new Date().toISOString(),activeManifestSha256:oldActiveHash,origin:'public-source-coverage-experiment',source:{layer,scalePxPerM:scale,crs:'EPSG:28992',capabilitiesSha256:sha(capabilities),tileCount:records.length},summary:{buildingsBeforeClipped:missing.length,buildingsAfterClipped:records.filter(r=>!r.coverageComplete).length,affectedFrontages:records.reduce((n,r)=>n+r.affectedFrontages.length,0),paidApiCostUsd:0},records};
await fs.writeFile(path.join(stage,'aerial.json'),JSON.stringify(output,null,2));
assert.equal(sha(await fs.readFile(path.join(active,'aerial.json'))),oldActiveHash,'Active aerial manifest was not changed');
console.log(JSON.stringify({stage,...output.summary}));
