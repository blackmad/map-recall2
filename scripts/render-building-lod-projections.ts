/** GPU-free orthographic projections for architectural LOD inspection.
 * Flat triangle lighting and painter ordering; not a substitute for WebGL review.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {NodeIO, type Document} from '@gltf-transform/core';
import * as THREE from 'three';
import sharp from 'sharp';
const rootIndex=process.argv.indexOf('--root'),root=rootIndex<0?'artifacts/building-lod/semantic-pilot':process.argv[rootIndex+1];
if(!root||root.startsWith('--'))throw new Error('Missing --root');
const sourceIndex=process.argv.indexOf('--source-root'),sourceRoot=sourceIndex<0?'public/canal-drive/models/building-library':process.argv[sourceIndex+1];
if(!sourceRoot||sourceRoot.startsWith('--'))throw new Error('Missing --source-root');
const levels=process.argv.includes('--detail-only')?['detail']:['detail','facade','massing'];
const ids=JSON.parse(fs.readFileSync(root+'/detail/assets/manifest.json','utf8')).models.map((m:any)=>m.id);
const io=new NodeIO(),out=root+'/projections';fs.mkdirSync(out,{recursive:true});
const incremental=process.argv.includes('--incremental'),cacheFile=out+'/cache.json';
const hash=(value:Buffer|string)=>crypto.createHash('sha256').update(value).digest('hex');
const fileHash=(file:string)=>hash(fs.readFileSync(file));
const rendererHash=fileHash(fileURLToPath(import.meta.url));
let previous:Record<string,any>={};
if(incremental&&fs.existsSync(cacheFile)){try{previous=JSON.parse(fs.readFileSync(cacheFile,'utf8')).entries||{};}catch{previous={};}}
const cache:Record<string,any>={};let rendered=0,cached=0;

function triangles(doc:Document){
 const result:any[]=[],bounds=new THREE.Box3();
 for(const node of doc.getRoot().listNodes()){
  const mesh=node.getMesh();if(!mesh)continue;const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for(const primitive of mesh.listPrimitives()){
   const position=primitive.getAttribute('POSITION')!.getArray()!,indices=primitive.getIndices()!.getArray()!,color=primitive.getMaterial()!.getBaseColorFactor();
   for(let i=0;i<indices.length;i+=3){const points=Array.from(indices.slice(i,i+3)).map(j=>new THREE.Vector3(position[j*3],position[j*3+1],position[j*3+2]).applyMatrix4(matrix));points.forEach(p=>bounds.expandByPoint(p));result.push({points,color});}
  }
 }
 return {result,bounds};
}
async function render(data:ReturnType<typeof triangles>,reference:THREE.Box3,view:string,label:string,filename:string){
 const center=reference.getCenter(new THREE.Vector3()),size=reference.getSize(new THREE.Vector3()),distance=size.length()*3;
 const direction=view==='front'?new THREE.Vector3(0,0,1):view==='quarter'?new THREE.Vector3(-.7,.2,1):view==='rear'?new THREE.Vector3(0,0,-1):new THREE.Vector3(1,.2,.6);
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,distance*3);camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));camera.lookAt(center);camera.updateMatrixWorld();
 const project=(p:THREE.Vector3)=>p.clone().applyMatrix4(camera.matrixWorldInverse);
 const corners=[];for(const x of [reference.min.x,reference.max.x])for(const y of [reference.min.y,reference.max.y])for(const z of [reference.min.z,reference.max.z])corners.push(project(new THREE.Vector3(x,y,z)));
 const minX=Math.min(...corners.map(p=>p.x)),maxX=Math.max(...corners.map(p=>p.x)),minY=Math.min(...corners.map(p=>p.y)),maxY=Math.max(...corners.map(p=>p.y));
 const width=440,height=700,scale=Math.min((width-35)/(maxX-minX),(height-65)/(maxY-minY)),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
 const light=new THREE.Vector3(-.4,.8,1).normalize();
 const shapes=data.result.map(({points,color})=>{
  const normal=new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0])).normalize();
  const midpoint=points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3);
  if(normal.dot(camera.position.clone().sub(midpoint))<=0)return null;
  const projected=points.map(project),shade=.68+.32*Math.max(0,normal.dot(light));
  const rgb=new THREE.Color(color[0]*shade,color[1]*shade,color[2]*shade).convertLinearToSRGB();
  const fill='#'+rgb.getHexString(THREE.LinearSRGBColorSpace);
  const screen=projected.map((p:THREE.Vector3)=>new THREE.Vector3((p.x-cx)*scale+width/2,-(p.y-cy)*scale+height/2+12,p.z));
  return {screen,rgb:[rgb.r,rgb.g,rgb.b].map(n=>Math.round(n*255)),depth:projected.reduce((n:number,p:THREE.Vector3)=>n+p.z,0)/3,shape:`<polygon points="${screen.map((p:THREE.Vector3)=>`${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="0.25"/>`};
 }).filter(Boolean).sort((a:any,b:any)=>a.depth-b.depth);
 // A per-pixel depth buffer avoids painter errors through recessed apertures.
 const rasterWidth=width*2,rasterHeight=height*2,pixels=new Uint8Array(rasterWidth*rasterHeight*3),depths=new Float64Array(rasterWidth*rasterHeight).fill(-Infinity);
 for(let i=0;i<pixels.length;i+=3)pixels.set([183,185,186],i);
 for(const shape of shapes as any[]){
  const [a,b,c]=shape.screen.map((p:THREE.Vector3)=>new THREE.Vector3(p.x*2,p.y*2,p.z));
  const determinant=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(determinant)<1e-8)continue;
  const x0=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),x1=Math.min(rasterWidth-1,Math.ceil(Math.max(a.x,b.x,c.x))),y0=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),y1=Math.min(rasterHeight-1,Math.ceil(Math.max(a.y,b.y,c.y)));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const u=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/determinant,v=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/determinant,w=1-u-v;
   if(u<0||v<0||w<0)continue;const depth=u*a.z+v*b.z+w*c.z,index=y*rasterWidth+x;
   if(depth>depths[index]){depths[index]=depth;pixels.set(shape.rgb,index*3);}
  }
 }
 const banner=Buffer.from(`<svg width="${width}" height="35"><text x="12" y="22" font-family="Arial" font-size="14">${label}</text></svg>`);
 await sharp(pixels,{raw:{width:rasterWidth,height:rasterHeight,channels:3}}).resize(width,height).composite([{input:banner,left:0,top:0}]).png().toFile(filename);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#b7b9ba"/><text x="12" y="22" font-family="Arial" font-size="14">${label}</text>${shapes.map((s:any)=>s.shape).join('')}</svg>`;
}
for(const id of ids){
 const detailPath=sourceRoot+'/'+id+'.glb',detailHash=fileHash(detailPath);
 let detail:ReturnType<typeof triangles>|undefined;
 for(const level of levels){
  const assetPath=level==='detail'?detailPath:`${root}/${level}/assets/${id}.glb`;
  const fingerprint=hash(rendererHash+detailHash+(level==='detail'?detailHash:fileHash(assetPath)));
  const key=id+'/'+level,old=previous[key];
  const outputs=['front','quarter','rear','side'].flatMap(view=>['svg','png'].map(extension=>`${id}-${view}-${level}.${extension}`));
  if(incremental&&old?.fingerprint===fingerprint&&outputs.every(name=>fs.existsSync(out+'/'+name)&&old.outputs?.[name]===fileHash(out+'/'+name))){
   cache[key]=old;cached+=4;continue;
  }
  detail??=triangles(await io.read(detailPath));
  const data=level==='detail'?detail:triangles(await io.read(assetPath));
  for(const view of ['front','quarter','rear','side'])fs.writeFileSync(`${out}/${id}-${view}-${level}.svg`,await render(data,detail.bounds,view,`${id} / ${level}`,`${out}/${id}-${view}-${level}.png`));
  cache[key]={fingerprint,outputs:Object.fromEntries(outputs.map(name=>[name,fileHash(out+'/'+name)]))};rendered+=4;
 }
}
if(incremental)fs.writeFileSync(cacheFile,JSON.stringify({version:1,entries:cache},null,2)+'\n');
fs.writeFileSync(out+'/render-report.json',JSON.stringify({rendered,cached,total:ids.length*levels.length*4,incremental,gpuAccepted:false},null,2)+'\n');
console.log(`Rendered ${rendered}; reused ${cached} orthographic SVG and depth-buffered PNG projections; GPU rendering still pending.`);
