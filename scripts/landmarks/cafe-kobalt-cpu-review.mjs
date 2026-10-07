/** Indexed, textured orthographic preflight. Does not establish gallery/game acceptance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;

const [modelPath,outputDir,bearingText='0']=process.argv.slice(2);
if(!modelPath||!outputDir)throw Error('Usage: node scripts/review/ordinary-model-cpu.mjs MODEL.glb OUTPUT_DIR [source-bearing-degrees]');
await fs.mkdir(outputDir,{recursive:true});
const document=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(modelPath),textures=new Map(),triangles=[],bounds=new T.Box3();
for(const texture of document.getRoot().listTextures()){
 const decoded=await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const levels=[decoded];
 for(let width=Math.floor(decoded.info.width/2),height=Math.floor(decoded.info.height/2);width>=1&&height>=1;width=Math.floor(width/2),height=Math.floor(height/2)){
  levels.push(await sharp(decoded.data,{raw:{width:decoded.info.width,height:decoded.info.height,channels:4}}).resize(width,height).raw().toBuffer({resolveWithObject:true}));
 }
 textures.set(texture,levels);
}
for(const node of document.getRoot().listNodes()){
 const mesh=node.getMesh();if(!mesh)continue;
 const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());
 for(const primitive of mesh.listPrimitives()){
  if(primitive.getMode()!==4)throw Error('Only triangle primitives supported');
  const positions=primitive.getAttribute('POSITION'),indices=primitive.getIndices()?.getArray();
  const uv=primitive.getAttribute('TEXCOORD_0'),colors=primitive.getAttribute('COLOR_0'),material=primitive.getMaterial();
  const count=indices?.length??positions.getCount();
  for(let i=0;i<count;i+=3){
   const index=[0,1,2].map(k=>indices?indices[i+k]:i+k);
   const points=index.map(j=>new T.Vector3(...positions.getElement(j,[])).applyMatrix4(matrix));
   points.forEach(p=>bounds.expandByPoint(p));
   triangles.push({points,uv:uv?index.map(j=>uv.getElement(j,[])):null,colors:colors?index.map(j=>colors.getElement(j,[])):null,color:material.getBaseColorFactor(),texture:material.getBaseColorTexture(),doubleSided:material.getDoubleSided()});
  }
 }
}
const width=1000,height=740,center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
const bearing=Number(bearingText)*Math.PI/180,source=Math.PI-bearing,views=[];
const srgb=value=>Math.max(0,Math.min(255,Math.round(255*(value<=.0031308?12.92*value:1.055*Math.pow(value,1/2.4)-.055))));
for(const [name,angle,elevation,wide] of [['source-front-low',source,-.15,false],['source-corner-low',source+.6,-.12,false],['front',source,.16,false],['corner',source+.6,.4,false],['opposite',source+Math.PI,.25,false],['other-side',source-Math.PI/2,.25,false],['roof',source,2.8,false],['wide',source,.25,true]]){
 const eye=new T.Vector3(Math.sin(angle),elevation,Math.cos(angle)).normalize();
 const right=new T.Vector3(0,1,0).cross(eye).normalize(),up=eye.clone().cross(right).normalize();
 const projected=triangles.map(t=>({...t,projected:t.points.map(p=>{const q=p.clone().sub(center);return[q.dot(right),q.dot(up),q.dot(eye)];})}));
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const t of projected)for(const p of t.projected){minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}
 if(wide){const span=Math.max(120,size.length()*2);minX=minY=-span/2;maxX=maxY=span/2;}
 const scale=.88*Math.min(width/(maxX-minX),height/(maxY-minY));
 const pixels=Buffer.alloc(width*height*4),depth=new Float64Array(width*height).fill(-Infinity);
 for(let i=0;i<width*height;i++)pixels.set([234,238,234,255],i*4);
 for(const t of projected){
  const normal=t.points[1].clone().sub(t.points[0]).cross(t.points[2].clone().sub(t.points[0])).normalize();
  if(!t.doubleSided&&normal.dot(eye)<=0)continue;
  const shade=.72+.28*Math.max(0,normal.dot(new T.Vector3(-.5,.9,.6).normalize()));
  const v=t.projected.map(p=>[width/2+(p[0]-(minX+maxX)/2)*scale,height/2-(p[1]-(minY+maxY)/2)*scale,p[2]]),[a,b,c]=v;
  const area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<1e-9)continue;
  const x0=Math.max(0,Math.floor(Math.min(...v.map(p=>p[0])))),x1=Math.min(width-1,Math.ceil(Math.max(...v.map(p=>p[0]))));
  const y0=Math.max(0,Math.floor(Math.min(...v.map(p=>p[1])))),y1=Math.min(height-1,Math.ceil(Math.max(...v.map(p=>p[1]))));
  let image=null;
  if(t.texture&&t.uv){const levels=textures.get(t.texture),du=Math.max(...t.uv.map(p=>p[0]))-Math.min(...t.uv.map(p=>p[0])),dv=Math.max(...t.uv.map(p=>p[1]))-Math.min(...t.uv.map(p=>p[1]));const ratio=Math.max(du*levels[0].info.width/Math.max(1,x1-x0),dv*levels[0].info.height/Math.max(1,y1-y0));image=levels[Math.min(levels.length-1,Math.max(0,Math.floor(Math.log2(Math.max(1,ratio)))))];}
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,vv=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,w=1-u-vv;
   if(u<0||vv<0||w<0)continue;const z=u*a[2]+vv*b[2]+w*c[2],j=y*width+x;if(z<=depth[j])continue;depth[j]=z;
   const weights=[u,vv,w];let color=t.color.slice(0,3);
   if(t.colors)color=color.map((factor,k)=>factor*weights.reduce((sum,weight,i)=>sum+weight*t.colors[i][k],0));
   let rgb=color.map(value=>srgb(value*shade));
   if(image){const tu=weights.reduce((s,weight,i)=>s+weight*t.uv[i][0],0),tv=weights.reduce((s,weight,i)=>s+weight*t.uv[i][1],0),tx=Math.min(image.info.width-1,Math.max(0,Math.floor(tu*image.info.width))),ty=Math.min(image.info.height-1,Math.max(0,Math.floor(tv*image.info.height))),offset=(ty*image.info.width+tx)*4;rgb=[0,1,2].map(k=>Math.round(image.data[offset+k]*color[k]*Math.pow(shade,1/2.2)));}
   pixels.set([...rgb,255],j*4);
  }
 }
 const file=path.join(outputDir,`${name}.png`);await sharp(pixels,{raw:{width,height,channels:4}}).png().toFile(file);views.push({name,file});
}
const report={modelPath,triangles:triangles.length,sourceBearingDegrees:Number(bearingText),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},views,scope:'CPU orthographic texture/geometry preflight only; no GPU, gameplay, performance or publication acceptance'};
await fs.writeFile(path.join(outputDir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
