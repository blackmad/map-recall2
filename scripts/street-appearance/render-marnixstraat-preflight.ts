/** Production geometry + production atlas CPU comparison. Not a GPU/game acceptance. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createCanvas} from '@napi-rs/canvas';
import {runtimePhotoAtlas} from './runtime-photo-atlas.js';
import {buildFeatureChunk,ORIGIN} from '../../src/canalRecall/threeBuildingFeatures.js';
import {contextFeatures,rowFeatures,rowIds,parents,profiles,streets,xy,catalog} from './marnixstraat-pilot.js';

const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'artifacts/marnixstraat-review/cycle-1';
if(fs.existsSync(`${output}/report.json`))throw Error('Choose a new cycle; preserve existing evidence');
fs.mkdirSync(output,{recursive:true});
const atlas=await runtimePhotoAtlas();
const front=parents[0].marnixstraatFrontage,normal=front.outwardNormalEastNorth,along=[-normal[1],normal[0]];
const ends=[xy(parents[0].marnixstraatFrontage.vertices[0]),xy(parents.at(-1)!.marnixstraatFrontage.vertices[1])];
const centre=ends[0].map((v,i)=>(v+ends[1][i])/2);
const report:any={generatedAt:new Date().toISOString(),scope:'Eight exact Marnixstraat 124–138 BAG parents; retained opposite/rear geometry. CPU runtime diagnostic only.',acceptance:'pending independent review; live game/GPU blocked by restricted Chrome launch',ids:rowIds,retainedIds:contextFeatures.filter(f=>!rowIds.includes(String(f.properties.id))).map(f=>f.properties.id),catalogSha256:createHash('sha256').update(JSON.stringify(catalog)).digest('hex'),views:[],performance:[]};
const phases=['before','after'] as const;
const chunks=new Map();
for(const phase of phases){
 const selected=phase==='after'?profiles:[];
 const build=()=>['walls','extras'].map(mode=>buildFeatureChunk(contextFeatures,'photo',mode as 'walls'|'extras',streets,selected,contextFeatures));
 const result=build();chunks.set(phase,result);
 const times=[];for(let i=0;i<10;i++){const t=performance.now();build();times.push(performance.now()-t);}times.sort((a,b)=>a-b);
 report.performance.push({phase,buildCpuMedianMs:times[5],triangles:result.reduce((s,c)=>s+c.indices.length/3,0),vertices:result.reduce((s,c)=>s+c.vertexCount,0),nativeRowTriangles:buildFeatureChunk(rowFeatures,'photo','walls',streets,selected).indices.length/3,limits:'CPU build measurements include bounded context; no live-game frame time or GPU assertion'});
}
for(const view of ['front','oblique','near','heldout','roof'] as const)for(const phase of phases){
 const near=view==='near'||view==='heldout',sample=near?parents[view==='near'?0:5]:undefined;
 const points=sample?.marnixstraatFrontage.vertices.map(xy),cx=points?(points[0][0]+points[1][0])/2:centre[0],cy=points?(points[0][1]+points[1][1])/2:centre[1];
 const W=near?900:1500,H=near?1000:520,canvas=createCanvas(W,H),ctx=canvas.getContext('2d'),image=ctx.createImageData(W,H),depth=new Float64Array(W*H).fill(-Infinity);
 for(let i=0;i<W*H;i++)image.data.set([229,234,230,255],i*4);
 const skew=view==='oblique'?.65:near?.12:0,elevation=view==='roof'?.9:near?.10:.12;
 const norm=(v:number[])=>{const n=Math.hypot(...v);return v.map(x=>x/n);},dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
 const E=norm([normal[0]+along[0]*skew,normal[1]+along[1]*skew,elevation]),R=norm([along[0]-normal[0]*skew,along[1]-normal[1]*skew,0]);
 const U=norm([R[1]*E[2],-R[0]*E[2],R[0]*E[1]-R[1]*E[0]]),scale=near?55:13,zCentre=near?7.5:7.2;
 // +R follows the street northwards; +U must project world up to image up.
 if(U[2]<0)for(let i=0;i<3;i++)U[i]*=-1;
 for(const chunk of chunks.get(phase))for(let k=0;k<chunk.indices.length;k+=3){
  const ids=Array.from(chunk.indices.slice(k,k+3)) as number[],points=ids.map(i=>[chunk.positions[i*3]-cx,chunk.positions[i*3+1]-cy,chunk.positions[i*3+2]-zCentre]);
  const a0=points[0],ab=points[1].map((v,i)=>v-a0[i]),ac=points[2].map((v,i)=>v-a0[i]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  // The camera is on the street. Opposite-side buildings behind that camera
  // must not occlude the target, as they would in an infinite orthographic view.
  if(dot(n,E)<=0||points.every(p=>p[0]*normal[0]+p[1]*normal[1]>8))continue;
  const q=points.map(p=>[W/2+dot(p,R)*scale,H/2-dot(p,U)*scale,dot(p,E)]),[a,b,c]=q,area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<1e-8)continue;
  const layer=chunk.layers[ids[0]],tint=Array.from(chunk.tints.slice(ids[0]*4,ids[0]*4+4)) as number[],accent=Array.from(chunk.accents.slice(ids[0]*4,ids[0]*4+4)) as number[];
  for(let y=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1]))));y<=Math.min(H-1,Math.ceil(Math.max(...q.map(p=>p[1]))));y++)for(let x=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0]))));x<=Math.min(W-1,Math.ceil(Math.max(...q.map(p=>p[0]))));x++){
   const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,w=1-u-v;if(Math.min(u,v,w)<0)continue;
   const z=u*a[2]+v*b[2]+w*c[2],j=y*W+x;if(z<=depth[j]+1e-7)continue;depth[j]=z;
   const uv=[0,1].map(axis=>u*chunk.uvs[ids[0]*2+axis]+v*chunk.uvs[ids[1]*2+axis]+w*chunk.uvs[ids[2]*2+axis]);
   const texel=layer*atlas.size*atlas.size+Math.floor(((uv[1]%1+1)%1)*atlas.size)*atlas.size+Math.floor(((uv[0]%1+1)%1)*atlas.size),wall=atlas.mask[texel*2]/255,acc=atlas.mask[texel*2+1]/255;
   for(let d=0;d<3;d++)image.data[j*4+d]=atlas.colour[texel*4+d]*((1-wall)+wall*tint[d]/255)*((1-acc)+acc*accent[d]/255)*tint[3]/255;image.data[j*4+3]=255;
  }
 }
 ctx.putImageData(image,0,0);const file=`${output}/${phase}-${view}.png`;fs.writeFileSync(file,canvas.toBuffer('image/png'));report.views.push({phase,view,file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
}
report.rendererSourceHashes=Object.fromEntries(['src/canalRecall/repeatedTerraceFrontage.ts','src/canalRecall/repeatedTerraceRoof.ts','src/canalRecall/threeBuildingMesh.ts','src/canalRecall/sourceVisualRoof.ts'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,views:report.views.length,performance:report.performance}));
