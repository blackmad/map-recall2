/** Exact native runtime geometry/atlas CPU diagnostic; not a gameplay/performance acceptance. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {runtimePhotoAtlas} from '../jan-evertsen-pilot/runtime-materials.ts';
import {buildFeatureChunk,ORIGIN,type Feature} from '../../src/canalRecall/threeBuildingFeatures.ts';
import {compoundFeature,compoundProfile as profile,compoundStreets as streets,compoundFront as front} from '../../src/canalRecall/compoundNativeFrontage.fixture.ts';
const output='artifacts/street-appearance/compound-native';fs.mkdirSync(output,{recursive:true});
const features=[compoundFeature],context:Feature[]=[],atlas=await runtimePhotoAtlas();
const W=1000,H=1000,canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
const cx=front.x+front.ux*front.lengthM/2,cy=front.y+front.uy*front.lengthM/2;
const report:any={scope:'Unmeasured compound capability fixture on native official87/89 geometry; actual production photo atlas; NOT source-fit, scene/GPU, roof or heldout acceptance',ids:profile.buildingIds,factualYear:1650,roofEnvelope:'Original22.99maggregate preserved; source~19.3mstreet eave separately unresolved',views:[]};
for(const [view,oblique] of [['front',0],['oblique',.5]] as const)for(const phase of ['before','after'] as const){
 const profiles=phase==='after'?[profile]:[],chunks=['walls','extras'].map(mode=>buildFeatureChunk(features,'photo',mode as 'walls'|'extras',streets,profiles,context));
 const image=ctx.createImageData(W,H),depth=new Float64Array(W*H).fill(-Infinity);for(let i=0;i<W*H;i++)image.data.set([235,232,222,255],i*4);
 const eye=[front.nx+front.ux*oblique,front.ny+front.uy*oblique,.06],right=[front.ux-front.nx*oblique,front.uy-front.ny*oblique,0],up=[-.06*eye[0],-.06*eye[1],1+oblique*oblique],norm=(v:number[])=>{const n=Math.hypot(...v);return v.map(x=>x/n);},E=norm(eye),R=norm(right),U=norm(up),dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0),scale=35;
 for(const chunk of chunks)for(let k=0;k<chunk.indices.length;k+=3){
  const ids=Array.from(chunk.indices.slice(k,k+3)),points=ids.map(i=>[chunk.positions[i*3]-cx,chunk.positions[i*3+1]-cy,chunk.positions[i*3+2]-11]);
  const a0=points[0],ab=points[1].map((v,i)=>v-a0[i]),ac=points[2].map((v,i)=>v-a0[i]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  if(dot(n,E)<=0)continue;
  const q=points.map(p=>[W/2+dot(p,R)*scale,H/2-dot(p,U)*scale,dot(p,E)]),[a,b,c]=q,area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<1e-8)continue;
  const layer=chunk.layers[ids[0]],tint=Array.from(chunk.tints.slice(ids[0]*4,ids[0]*4+4)),accent=Array.from(chunk.accents.slice(ids[0]*4,ids[0]*4+4));
  for(let y=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1]))));y<=Math.min(H-1,Math.ceil(Math.max(...q.map(p=>p[1]))));y++)for(let x=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0]))));x<=Math.min(W-1,Math.ceil(Math.max(...q.map(p=>p[0]))));x++){
   const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,w=1-u-v;if(Math.min(u,v,w)<0)continue;
   const z=u*a[2]+v*b[2]+w*c[2],j=y*W+x;if(z<=depth[j]+1e-7)continue;depth[j]=z;
   const uv=[0,1].map(axis=>u*chunk.uvs[ids[0]*2+axis]+v*chunk.uvs[ids[1]*2+axis]+w*chunk.uvs[ids[2]*2+axis]);
   const texel=layer*atlas.size*atlas.size+Math.floor(((uv[1]%1+1)%1)*atlas.size)*atlas.size+Math.floor(((uv[0]%1+1)%1)*atlas.size),wall=atlas.mask[texel*2]/255,acc=atlas.mask[texel*2+1]/255;
   for(let d=0;d<3;d++)image.data[j*4+d]=atlas.colour[texel*4+d]*((1-wall)+wall*tint[d]/255)*((1-acc)+acc*accent[d]/255)*tint[3]/255;image.data[j*4+3]=255;
  }
 }
 ctx.putImageData(image,0,0);const file=`${output}/${phase}-${view}.png`;fs.writeFileSync(file,canvas.toBuffer('image/png'));report.views.push({phase,view,file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),triangles:chunks.reduce((n,c)=>n+c.indices.length/3,0)});
}
fs.writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
