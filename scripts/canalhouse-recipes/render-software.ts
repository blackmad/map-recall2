/** Depth-buffered mesh diagnostic. This is not gallery, game or GPU acceptance. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import zlib from 'node:zlib';
import * as T from 'three';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
import {frameCanalhouseRowFromStreet} from '../../src/canalRecall/canalhousePreviewFraming.ts';
import {canalhouseReferenceCamera} from '../../src/canalRecall/canalhouseReferenceCamera.ts';
import {clipTriangleToCameraDepth,clipTriangleAtStreetGrade} from './software-camera-clipping.ts';

const option=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
for(const arg of process.argv.slice(2))if(!['--diagnostic-light','--street-ground'].includes(arg)&&!/^--(house|input|output|focus|projection|aspect)=/.test(arg))throw Error(`Unsupported diagnostic argument: ${arg}`);
const id=option('house','herengracht-417'),output=option('output','artifacts/canalhouse-recipes/software-diagnostic');
const assemblyFocus=option('focus','whole');if(!['whole','cornice'].includes(assemblyFocus))throw Error('Unsupported diagnostic focus');
const shaded=process.argv.includes('--diagnostic-light');
const streetGround=process.argv.includes('--street-ground');
const bytes=await fs.readFile(option('input','docs/references/canalhouse-recipes/recipes.json'));
const pack=JSON.parse(bytes.toString()),section=pack.reviewRows?.find((r:any)=>r.id===id);
const entries=section?section.houseIds.map((key:string)=>pack.entries.find((e:any)=>e.recipe.id===key)):pack.entries;
if(entries.some((e:any)=>!e))throw Error('Missing recipe in review section');
const row=id==='row'||!!section;
const projection=option('projection','orthographic');if(!['orthographic','street','reference'].includes(projection)||projection!=='orthographic'&&!row)throw Error('Perspective diagnostic currently requires row');
const aspect=Number(option('aspect','2.444444'));if(!Number.isFinite(aspect)||aspect<=0||aspect>4)throw Error('Invalid diagnostic aspect');
if(row&&assemblyFocus!=='whole')throw Error('Row review requires whole facades');
const origin=entries[0]?.anchorRD;
const targets=row?entries.map((e:any)=>new T.Vector3(e.frontTarget[0]+e.anchorRD[0]-origin[0],e.frontTarget[1],e.frontTarget[2]+origin[1]-e.anchorRD[1])):[];
const rowCenter=targets.reduce((v:T.Vector3,p:T.Vector3)=>v.add(p),new T.Vector3()).multiplyScalar(1/Math.max(1,targets.length));
const entry=row?{...entries[0],frontTarget:rowCenter.toArray()}:entries.find((e:any)=>e.recipe.id===id);
if(!entry)throw Error(`Unknown house ${id}`);
await fs.mkdir(output,{recursive:true});
try{await fs.access(`${output}/${id}-report.json`);throw Error('Diagnostic already exists; preserve it and select a new output.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const built=compileCanalHouseRecipe(entry.recipe);
if(row){
 built.group.position.set(entry.anchorRD[0]-origin[0],0,origin[1]-entry.anchorRD[1]);
 const cohort=new T.Group();cohort.add(built.group);
 for(const e of entries.slice(1)){
  const house=compileCanalHouseRecipe(e.recipe);
  if(JSON.stringify(house.componentVersions)!==JSON.stringify(built.componentVersions))throw Error('Mixed compiler versions in row');
  house.group.position.set(e.anchorRD[0]-origin[0],0,origin[1]-e.anchorRD[1]);cohort.add(house.group);
 }
 built.group=cohort;
}
built.group.updateMatrixWorld(true);
const triangles:{points:T.Vector3[];color:T.Color;doubleSided:boolean}[]=[];
built.group.traverse(o=>{
 if(!(o instanceof T.Mesh))return;
 if(Array.isArray(o.material))throw Error('Expected single material');
 const material=o.material as T.MeshStandardMaterial,positions=o.geometry.getAttribute('position'),index=o.geometry.index;
 for(let i=0;i<(index?.count??positions.count);i+=3){
  const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(positions,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld));
  if(o.matrixWorld.determinant()<0)[points[1],points[2]]=[points[2],points[1]];
  triangles.push({points,color:material.color,doubleSided:material.side===T.DoubleSide});
 }
});
const displayTriangles=streetGround?triangles.flatMap(t=>clipTriangleAtStreetGrade(t.points).map(points=>({...t,points}))):triangles;
const W=row?Math.round(900*aspect):1100,H=900;
function crc(bytes:Buffer){let n=0xffffffff;for(const b of bytes){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function chunk(type:string,data:Buffer){const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;}
async function png(file:string,rgba:Uint8Array){const header=Buffer.alloc(13);header.writeUInt32BE(W);header.writeUInt32BE(H,4);header[8]=8;header[9]=6;const scan=Buffer.alloc(H*(W*4+1));for(let y=0;y<H;y++)Buffer.from(rgba.buffer,y*W*4,W*4).copy(scan,y*(W*4+1)+1);await fs.writeFile(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]));}
const normal=new T.Vector3(entry.frontNormal[0],0,entry.frontNormal[1]);
const facadeRight=new T.Vector3(-normal.z,0,normal.x);
const center=new T.Vector3(...entry.frontTarget);
const bounds=new T.Box3().setFromObject(built.group),displayMinY=streetGround?Math.max(-.05,bounds.min.y):bounds.min.y,height=bounds.max.y-displayMinY;
const cornice=entry.recipe.elevations.find((e:any)=>e.cornice)?.cornice.value;
if(assemblyFocus==='cornice'&&!cornice)throw Error('No observed cornice to focus');
const results=[];
const views:readonly(readonly[string,number,boolean])[]=row?[['front',0,false],['left',-.25,false],['right',.25,false]]:assemblyFocus==='cornice'?[['cornice',0,false],['cornice-left',-.35,false],['cornice-right',.35,false]]:[['basement',0,true],['basement-left',-.35,true],['basement-right',.35,true],['front',0,false],['left',-.35,false],['right',.35,false]];
for(const [name,turn,lower] of views){
 if(projection==='reference'&&turn!==0)continue;
 const eye=normal.clone().addScaledVector(facadeRight,turn).add(new T.Vector3(0,turn? .25:0,0)).normalize();
 const right=new T.Vector3(0,1,0).cross(eye).normalize(),up=eye.clone().cross(right).normalize();
 const focus=center.clone();focus.y=assemblyFocus==='cornice'?cornice.bottomM+cornice.heightM/2:lower?2.3:(displayMinY+bounds.max.y)/2;
 const project=(p:T.Vector3)=>{const q=p.clone().sub(focus);return[q.dot(right),q.dot(up),q.dot(eye)];};
 const rowExtents=row?displayTriangles.flatMap(t=>t.points.map(project)):[];
 const rowSpan=row?1.08*Math.max(...rowExtents.map(p=>Math.max(Math.abs(p[1])*2,Math.abs(p[0])*2*H/W))):0;
 const span=row?rowSpan:assemblyFocus==='cornice'?Math.max(2.5,entry.frontWidthM*.24):lower?Math.max(entry.frontWidthM*1.1,5.5):Math.max(height*1.12,entry.frontWidthM*1.35*H/W);
 const scale=H/span,rgba=new Uint8Array(W*H*4),depth=new Float64Array(W*H).fill(-Infinity);
 const perspective=new T.PerspectiveCamera(45,W/H,.1,2000);
 if(projection==='street'){
  const fitted=frameCanalhouseRowFromStreet(bounds,eye,45,W/H);perspective.position.copy(fitted.position);perspective.lookAt(fitted.target);perspective.updateMatrixWorld();
 }
 if(projection==='reference'){
  const source=entries.find((e:any)=>e.recipe.id===section?.referenceHouseId)?.panorama;
  if(!source?.cameraRD)throw Error('Reference row needs recorded panorama station');
  const fitted=canalhouseReferenceCamera({...source,fovDeg:section.panoramaFovDeg},origin,W/H);
  perspective.fov=fitted.fovDeg;perspective.updateProjectionMatrix();perspective.position.copy(fitted.position);perspective.lookAt(fitted.target);perspective.updateMatrixWorld();
 }
 for(let i=0;i<W*H;i++)rgba.set([211,225,230,255],i*4);
 for(const triangle of displayTriangles){
  const n=triangle.points[1].clone().sub(triangle.points[0]).cross(triangle.points[2].clone().sub(triangle.points[0])).normalize();
  const sight=projection!=='orthographic'?perspective.position.clone().sub(triangle.points[0]).normalize():eye;
  if(n.dot(sight)<=0&&!triangle.doubleSided)continue;
  for(const points of projection!=='orthographic'?clipTriangleToCameraDepth(triangle.points,perspective):[triangle.points]){
  const q=projection!=='orthographic'?points.map(p=>{const v=p.clone().project(perspective);return[(v.x+1)*W/2,(1-v.y)*H/2,-v.z];}):points.map(project).map(p=>[W/2+p[0]*scale,H/2-p[1]*scale,p[2]]),[a,b,c]=q;
  const area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<1e-9)continue;
  const x0=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0])))),x1=Math.min(W-1,Math.ceil(Math.max(...q.map(p=>p[0]))));
  const y0=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1])))),y1=Math.min(H-1,Math.ceil(Math.max(...q.map(p=>p[1]))));
  const shade=shaded?.55+.45*Math.max(0,n.dot(normal.clone().addScaledVector(facadeRight,-.6).add(new T.Vector3(0,2,0)).normalize())):1;
  const color=triangle.color.clone().multiplyScalar(shade).convertLinearToSRGB().toArray().map(v=>Math.round(v*255));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,w=1-u-v;
   if(u<0||v<0||w<0)continue;const z=u*a[2]+v*b[2]+w*c[2],j=y*W+x;
   if(z>depth[j]+1e-8){depth[j]=z;rgba.set([...color,255],j*4);}
  }
  }
 }
 const file=`${id}-${name}.png`;await png(`${output}/${file}`,rgba);results.push({file,projection,facadeNormal:normal.toArray(),eyeDirection:eye.toArray(),turn,...(projection!=='orthographic'?{cameraPosition:perspective.position.toArray(),fovDeg:perspective.fov,aspect:W/H}:{spanM:span,focus:focus.toArray()})});
}
await fs.writeFile(`${output}/${id}-report.json`,JSON.stringify({id,...(row?{houseIds:entries.map((e:any)=>e.recipe.id),placement:'Native RD anchors, same axis conversion as gallery; no frontage widths or gaps adjusted'}:{}),recipePackSha256:createHash('sha256').update(bytes).digest('hex'),componentVersions:built.componentVersions,triangles:triangles.length,...(streetGround?{streetGradeM:-.05,displayTriangles:displayTriangles.length}:{}),results,acceptance:'diagnostic-only',limits:[`Exact compiled mesh with depth buffer and source palette; ${projection==='reference'?'perspective at recorded horizontal source station (2.5m eye approximation)':projection==='street'?'perspective at 2.5m street eye':'orthographic'} software rendering with ${shaded?'approximate diagnostic diffuse light':'no lighting'}.`,...(streetGround?['Diagnostic hides source surfaces below the gallery street plane at−0.05m; source/export geometry is unchanged.']:[]),'No municipal photo texture pixels enter geometry.','No WebGL, game, neighborhood or performance acceptance.']},null,2)+'\n');
built.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
console.log(JSON.stringify({id,output,views:results.length,acceptance:'diagnostic-only'}));
