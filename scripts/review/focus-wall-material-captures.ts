/** Identity-bound crops preserve screenshot RGB. Diagnostics never auto-accept. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const run=process.argv[2]??'pass-3';if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run');
const root=`.cache/wall-material-demo/${run}`;
const manifest=JSON.parse(await fs.readFile(`${root}/captures.json`,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
for(const c of manifest.results)for(const angle of ['front','oblique']){
 const identityCapture=c.captures[angle==='front'?'identity':'identity-oblique'];
 if(!identityCapture){if(manifest.version>=2)throw Error(`Missing ${angle} identity: ${c.index}`);continue;}
 const normalCapture=c.captures[`preview-${angle}`];
 const identityBytes=await fs.readFile(`${root}/${identityCapture.file}`),normal=await fs.readFile(`${root}/${normalCapture.file}`);
 if(sha(identityBytes)!==identityCapture.sha256||sha(normal)!==normalCapture.sha256)throw Error('Capture hash mismatch');
 const a=await sharp(identityBytes).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(normal).removeAlpha().raw().toBuffer({resolveWithObject:true});
 if(a.info.width!==b.info.width||a.info.height!==b.info.height)throw Error('Identity and normal dimensions differ');
 let x0=a.info.width,y0=a.info.height,x1=0,y1=0;const channels:number[][]=[[],[],[]];
 for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
  const k=(y*a.info.width+x)*3;
  if(a.data[k]>100&&a.data[k+2]>100&&a.data[k+1]<50){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);for(let j=0;j<3;j++)channels[j].push(b.data[k+j]);}
 }
 const visibleWallPixels=channels[0].length,prefix=String(c.index).padStart(3,'0');
 const result:any={index:c.index,buildingId:c.buildingId,angle,isolated:manifest.isolated??false,identitySha256:identityCapture.sha256,normalSha256:normalCapture.sha256,visibleWallPixels,policy:'Identity-bound crop with original screenshot RGB; contextual occluders can remain within bounds. Isolated views hide context, not alter material or light. Diagnostic only, never automatic acceptance.'};
 if(visibleWallPixels<100){result.status='insufficient-visible-wall';await fs.rm(`${root}/${prefix}-focused-${angle}.png`,{force:true});}
 else{
  const bounds={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1},bytes=await sharp(normal).extract(bounds).png().toBuffer();
  Object.assign(result,{status:'measured',bounds,medianGameRGB:channels.map(v=>v.sort((a,b)=>a-b)[v.length>>1]),percentile10RGB:channels.map(v=>v[Math.floor(v.length*.1)]),percentile90RGB:channels.map(v=>v[Math.floor(v.length*.9)]),focusedFile:`${prefix}-focused-${angle}.png`,focusedSha256:sha(bytes)});
  await fs.writeFile(`${root}/${result.focusedFile}`,bytes);
 }
 await fs.writeFile(`${root}/${prefix}-${angle==='front'?'focus':'focus-oblique'}.json`,JSON.stringify(result,null,2));
}
console.log(`Focused available angles for ${manifest.results.length} owners in ${run}`);
