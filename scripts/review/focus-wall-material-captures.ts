/** Crop the exact visible target bound by a temporary magenta identity render.
 * Preserves game RGB values. Measurements diagnose review errors, never auto-accept.
 */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const run=process.argv[2]??'pass-3';if(!/^[a-z0-9-]+$/.test(run))throw Error('Invalid run');
const root=`.cache/wall-material-demo/${run}`;
const manifest=JSON.parse(await fs.readFile(`${root}/captures.json`,'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
for(const c of manifest.results){const identityBytes=await fs.readFile(`${root}/${c.captures.identity.file}`),normal=await fs.readFile(`${root}/${c.captures['preview-front'].file}`);if(sha(identityBytes)!==c.captures.identity.sha256||sha(normal)!==c.captures['preview-front'].sha256)throw Error('Capture hash mismatch');const a=await sharp(identityBytes).removeAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(normal).removeAlpha().raw().toBuffer();let x0=a.info.width,y0=a.info.height,x1=0,y1=0;const channels:number[][]=[[],[],[]];
for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){const k=(y*a.info.width+x)*3;if(a.data[k]>100&&a.data[k+2]>100&&a.data[k+1]<50){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);for(let j=0;j<3;j++)channels[j].push(b[k+j]);}}
if(channels[0].length<100)throw Error(`Visible owner insufficient for focused capture: ${c.index}`);
const bounds={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1},prefix=String(c.index).padStart(3,'0'),bytes=await sharp(normal).extract(bounds).png().toBuffer();await fs.writeFile(`${root}/${prefix}-focused-front.png`,bytes);
await fs.writeFile(`${root}/${prefix}-focus.json`,JSON.stringify({index:c.index,buildingId:c.buildingId,identitySha256:c.captures.identity.sha256,normalSha256:c.captures['preview-front'].sha256,bounds,visibleWallPixels:channels[0].length,medianGameRGB:channels.map(v=>v.sort((a,b)=>a-b)[v.length>>1]),focusedFile:`${prefix}-focused-front.png`,focusedSha256:sha(bytes),policy:'Identity-bound crop with original screenshot RGB, including contextual occluders within bounds; diagnostic only, not automatic acceptance'},null,2));}
console.log(`Focused ${manifest.results.length} owners for ${run}`);
