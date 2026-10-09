/** Isolated image-space prototype. Mask geometry is not registered BAG geometry. */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {components,groupPanes} from './extract-facade-components';
import {applyFacadeComponents,type MeshData,type FacadeComponent} from '../../src/canalRecall/facade/componentGeometry';
const input='.cache/facade-assessment/chatgpt-budget-v1';
const out='public/data/facade-review-galleries/chatgpt-mask-3d-v1';
await fs.mkdir(out,{recursive:true});
const image=await fs.readFile(input+'/strip1.png');
const {data:rgb,info}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true});
const w=info.width,h=info.height;
const masks:Record<string,Uint8Array>={};
for(const name of ['wall','glazing','door','balcony','trim','signage']) {
 const {data}=await sharp(input+'/model-masks/'+name+'.png').greyscale().raw().toBuffer({resolveWithObject:true});
 if(data.length!==w*h)throw Error('Mask size mismatch');
 masks[name]=Uint8Array.from(data,v=>v>127?1:0);
}
// Closing bridges thin mullions. It does not synthesize facade coordinates.
function filter(mask:Uint8Array,r:number,dilate:boolean){
 const stride=w+1,integral=new Int32Array((w+1)*(h+1));
 for(let y=0;y<h;y++){let sum=0;for(let x=0;x<w;x++){sum+=mask[y*w+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+sum;}}
 const result=new Uint8Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const x0=Math.max(0,x-r),x1=Math.min(w,x+r+1),y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);
  const sum=integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0];
  result[y*w+x]=dilate?+(sum>0):+(sum===(x1-x0)*(y1-y0));
 }return result;
}
const openingMask=Uint8Array.from(masks.glazing,(v,i)=>v||masks.door[i]?1:0);
const closed=filter(filter(openingMask,5,true),5,false);
const boxes=groupPanes(components(closed,w,h),w,h).filter(b=>b.y1<h*.975);
const features:FacadeComponent[]=boxes.map((b,i)=>{
 let doors=0,glass=0;for(let y=b.y0;y<b.y1;y++)for(let x=b.x0;x<b.x1;x++){doors+=masks.door[y*w+x];glass+=masks.glazing[y*w+x];}
 return {id:'opening-'+i,kind:doors>glass?'door':'window',bbox:[b.x0/w,b.y0/h,b.x1/w,b.y1/h],depth:doors>glass?.25:.16,colour:'#ccc5ac'};
});
const rejected:any[]=[];
for(const [i,b] of components(filter(masks.balcony,2,true),w,h).entries()){
 if(b.y0<h*.32||b.y1>h*.75||b.x1-b.x0<w*.022||b.y1-b.y0<h*.028){rejected.push({kind:'balcony',bounds:b,reason:'Not a substantial mid-facade balcony assembly'});continue;}
 features.push({id:'balcony-'+i,kind:'balcony',bbox:[b.x0/w,b.y0/h,b.x1/w,b.y1/h],depth:.65,colour:'#aaa28c'});
}
// The rail occludes the lower opening. Complete only an already observed,
// uniquely aligned window, and retain its original measured mask bounds.
const inferredCompletions:any[]=[];
for(const balcony of features.filter(f=>f.kind==='balcony')){
 const [l,t,r,b]=balcony.bbox,cx=(l+r)/2;
 const matches=features.filter(f=>f.kind==='window'&&f.bbox[0]<cx&&f.bbox[2]>cx&&f.bbox[1]<t&&f.bbox[3]>t-.015&&f.bbox[3]<b&&b-f.bbox[3]<.055);
 if(matches.length!==1)continue;
 const opening=matches[0],originalBounds=[...opening.bbox];
 opening.bbox=[opening.bbox[0],opening.bbox[1],opening.bbox[2],b-.006];
 inferredCompletions.push({openingId:opening.id,balconyId:balcony.id,originalBounds,completedBounds:opening.bbox,status:'inferred continuation behind rail; not newly observed glazing'});
}
const span=38,scale=span/w,ground=.971*h,depth=3;
const point=(x:number,y:number,z=0)=>[(x-w/2)*scale,(ground-y)*scale,z];
const front:MeshData={id:'image-space-front',kind:'wall',positions:[],indices:[],uvs:[],textured:true};
const shell:MeshData={id:'inferred-shell',kind:'roof',positions:[],indices:[],textured:false,colour:'#847968'};
function quad(mesh:MeshData,ps:number[][]){const n=mesh.positions.length/3;ps.forEach(p=>mesh.positions.push(...p));mesh.indices.push(n,n+1,n+2,n,n+2,n+3);}
const skyline:number[][]=[];
const step=6;
const support=new Int32Array((w+1)*h);
for(let y=0;y<h;y++)for(let x=0;x<w;x++)support[y*(w+1)+x+1]=support[y*(w+1)+x]+(masks.wall[y*w+x]||masks.trim[y*w+x]?1:0);
for(let x=0;x<=w;x+=step){const px=Math.min(w-1,x);let y=h*.35;
 for(let sy=0;sy<ground;sy++){
  const l=Math.max(0,px-12),r=Math.min(w,px+13),sum=support[sy*(w+1)+r]-support[sy*(w+1)+l];
  if((masks.wall[sy*w+px]||masks.trim[sy*w+px])&&sum>=(r-l)*.74){y=sy;break;}
 }skyline.push([px,y]);}
if(skyline.at(-1)![0]!==w-1)skyline.push([w-1,skyline.at(-1)![1]]);
for(let i=0;i<skyline.length-1;i++){
 const [x0,y0]=skyline[i],[x1,y1]=skyline[i+1],n=front.positions.length/3;
 quad(front,[point(x0,ground),point(x1,ground),point(x1,y1),point(x0,y0)]);
 front.uvs!.push(x0/w,1-ground/h,x1/w,1-ground/h,x1/w,1-y1/h,x0/w,1-y0/h);
 quad(shell,[point(x0,y0),point(x1,y1),point(x1,y1,-depth),point(x0,y0,-depth)]);
 quad(shell,[point(x1,ground,-depth),point(x0,ground,-depth),point(x0,y0,-depth),point(x1,y1,-depth)]);
}
for(const [x,y]of [skyline[0],skyline.at(-1)!])quad(shell,[point(x,ground),point(x,y),point(x,y,-depth),point(x,ground,-depth)]);
const result=applyFacadeComponents([front,shell],features);
// Reintroduce a shallow central mullion where the painted rail cleanup removed
// the window frame. The extension below observed bounds is explicitly inferred.
for(const completion of inferredCompletions){
 const f=features.find(f=>f.id===completion.openingId)!;
 if(!result.stats.accepted.includes(f.id))continue;
 const balcony=features.find(f=>f.id===completion.balconyId)!;
 const cx=(f.bbox[0]+f.bbox[2])/2*w;
 const y0=Math.max(balcony.bbox[1]*h,f.bbox[1]*h),y1=f.bbox[3]*h;
 const bar:MeshData={id:'inferred:'+f.id+':mullion',kind:'wall',positions:[],indices:[],textured:false,colour:'#ccc5ac'};
 const a=point(cx-1.5,y1,-.11),b=point(cx+1.5,y1,-.11),c=point(cx+1.5,y0,-.11),d=point(cx-1.5,y0,-.11);
 quad(bar,[a,b,c,d]);quad(bar,[point(cx-1.5,y1,-.16),a,d,point(cx-1.5,y0,-.16)]);quad(bar,[b,point(cx+1.5,y1,-.16),point(cx+1.5,y0,-.16),c]);
 result.meshes.push(bar);
}
// Fit procedural rail height to the mask's assembly extent instead of keeping
// the compiler's generic 0.95 m height at this illustrative image scale.
for(const f of features.filter(f=>f.kind==='balcony')){
 const baseY=(ground-f.bbox[3]*h)*scale,railHeight=Math.max(.55,(f.bbox[3]-f.bbox[1])*h*scale-.16);
 for(const m of result.meshes)if(m.id.startsWith('component:'+f.id+':')&&(m.id.includes('top-rail')||m.id.includes(':post:')))
  for(let i=1;i<m.positions.length;i+=3)m.positions[i]=baseY+(m.positions[i]-baseY)*railHeight/.95;
}
// Replace only detected balcony paint; geometry now supplies the projection.
const cleaned=Buffer.from(rgb);const accepted=new Set(result.stats.accepted);
const cleanupMask=new Uint8Array(w*h);
for(const f of features.filter(f=>f.kind==='balcony'&&accepted.has(f.id)))
 for(let y=Math.max(0,Math.floor(f.bbox[1]*h)-3);y<Math.min(h,Math.ceil(f.bbox[3]*h)+3);y++)
  for(let x=Math.max(0,Math.floor(f.bbox[0]*w)-3);x<Math.min(w,Math.ceil(f.bbox[2]*w)+3);x++)cleanupMask[y*w+x]=1;
const fillColours=features.filter(f=>f.kind==='balcony'&&accepted.has(f.id)).map(f=>{
 const [l,t,r,b]=f.bbox.map((v,i)=>Math.round(v*(i%2?h:w))),values:number[][]=[[],[],[]];
 for(let y=Math.max(0,t-20);y<Math.min(h,b+20);y++)for(let x=Math.max(0,l-30);x<Math.min(w,r+30);x++){
  const p=y*w+x;if(!masks.wall[p]||cleanupMask[p])continue;
  for(let c=0;c<3;c++)values[c].push(rgb[p*3+c]);
 }
 return {bbox:f.bbox,colour:values.map(v=>{v.sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:130;})};
});
for(let p=0;p<w*h;p++)if(cleanupMask[p]){
 const x=p%w,y=Math.floor(p/w);
 const opening=features.find(f=>f.kind!=='balcony'&&accepted.has(f.id)&&x/w>=f.bbox[0]&&x/w<=f.bbox[2]&&y/h>=f.bbox[1]&&y/h<=f.bbox[3]);
 let colour=[85,111,125];
 if(!opening){const fill=fillColours.find(f=>x/w>=f.bbox[0]-.003&&x/w<=f.bbox[2]+.003&&y/h>=f.bbox[1]-.004&&y/h<=f.bbox[3]+.004);if(fill)colour=fill.colour;}
 colour.forEach((v,c)=>cleaned[p*3+c]=v);
}
await sharp(cleaned,{raw:{width:w,height:h,channels:3}}).png().toFile(out+'/texture.png');
await fs.copyFile(input+'/strip1.png',out+'/original-texture.png');await fs.copyFile(input+'/source.png',out+'/source.png');await fs.copyFile(input+'/segmentation.png',out+'/segmentation.png');
let paintedDirk=false;
try{await fs.copyFile(input+'/dirk-painted-sign.png',out+'/dirk-painted-sign.png');paintedDirk=true;}catch(error:any){if(error.code!=='ENOENT')throw error;}
const texts=[
 {id:'left-inscription',text:'ASSUMPTIO',pixels:[101,734,273,761],tentative:true,colour:'#7b7564'},
 {id:'cooperative',text:'COOPERATIEVE',pixels:[372,709,632,738],tentative:false,colour:'#8a8069'},
 {id:'association',text:'VEREENIGING',pixels:[708,709,958,738],tentative:false,colour:'#8a8069'},
 {id:'right-inscription',text:'ASSUMPTIO',pixels:[1040,709,1268,738],tentative:true,colour:'#8a8069'},
 {id:'shop',text:'Dirk van den Broek',pixels:[1311,782,1520,808],tentative:false,readingUnverified:true,colour:'#ffdb68',...(paintedDirk?{texture:'dirk-painted-sign.png',method:'image-model painted fascia asset'}:{})},
 {id:'window',text:'Dirk',pixels:[800,850,826,868],tentative:false,colour:'#ffffff'},
];
const scene={version:1,coordinateSystem:'image-space illustrative metres; not BAG registered',widthM:span,inferredShellDepthM:depth,textureDimensions:[w,h],groundPixel:ground,scale,
 meshes:result.meshes,baseline:[front,shell],features,texts,stats:result.stats,rejected,inferredCompletions,
 provenance:{imageSha256:createHash('sha256').update(image).digest('hex'),maskManifest:JSON.parse(await fs.readFile(input+'/mask-manifest.json','utf8')),textReadings:JSON.parse(await fs.readFile(input+'/image-model-text.json','utf8'))},
 limitations:['Width 38 m and shell depth 3 m are display assumptions, not measurements.','Rectangular aperture approximations; arches and round windows remain imperfect.','Balcony railing depth and bar spacing are procedural defaults.','Text locations manually transferred to generated artwork; tentative readings toggle separately.','Roof beams remain painted; unseen roof/building depth is not recovered.','Mask errors and generated-image/source-photo differences persist.']};
for(const m of scene.meshes){if(m.positions.some(v=>!Number.isFinite(v))||m.indices.some(v=>v<0||v>=m.positions.length/3))throw Error('Invalid compiled mesh');}
await fs.writeFile(out+'/scene.json',JSON.stringify(scene));
await fs.writeFile(out+'/report.json',JSON.stringify({...scene,meshes:undefined,baseline:undefined,provenance:undefined},null,2));
console.log(JSON.stringify({features:features.length,stats:result.stats,meshes:result.meshes.length,rejected:rejected.length}));
