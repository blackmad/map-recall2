import assert from 'node:assert/strict';
import * as T from 'three';
import {buildBetaBoulders} from './landmarks/beta-boulders-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import data from './landmarks/beta-boulders-footprints.json';
const meshes:T.Mesh[]=[];const mat=new T.MeshBasicMaterial({side:T.DoubleSide});
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=c;meshes.push(new T.Mesh(g,mat))};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);const unused=()=>{throw Error('unexpected primitive')};
buildBetaBoulders(0,0,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bb=new T.Box3();for(const m of meshes){const g=m.geometry,p=g.getAttribute('position');triangles+=(g.index?.count??p.count)/3;for(const v of p.array)assert(Number.isFinite(v));g.computeBoundingBox();bb.union(g.boundingBox!);if(g.userData.roofAssembly){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0,'upward roof normals')}}assert(triangles<40000);assert(bb.max.y<20,'equipment maxima not whole-building heights');assert(bb.max.x-bb.min.x>60);assert(bb.max.z-bb.min.z>79);
// Actual exposed facade probes at fractions inside clear panes, three heights.
let probes=0;const r=data.facadePerimeter;for(const i of r.slice(0,-1).map((_,i)=>i).filter(i=>(i<1||i>=30)&&Math.hypot(r[i+1][0]-r[i][0],r[i+1][1]-r[i][1])>8)){const p=new T.Vector2(...r[i] as [number,number]),q=new T.Vector2(...r[i+1] as [number,number]),normal=new T.Vector2(-(q.y-p.y),q.x-p.x).normalize();for(const fraction of Array.from({length:Math.max(1,Math.round(p.distanceTo(q)/13))},(_,k)=>[.25,.5,.75].map(f=>(k+f)/Math.max(1,Math.round(p.distanceTo(q)/13)))).flat())for(const y of[2.2,7.7,12.3]){const point=p.clone().lerp(q,fraction),hit=new T.Raycaster(new T.Vector3(point.x+normal.x*12,y,point.y+normal.y*12),new T.Vector3(-normal.x,0,-normal.y)).intersectObjects(meshes)[0];assert(hit);assert(['glass','frame'].includes(hit.object.geometry.userData.palette),`buried pane wall${i} fraction${fraction} y${y}: ${hit.object.geometry.userData.palette}`);if(hit.object.geometry.userData.palette==='glass')probes++}}
// Source-backed principal facade: probe opening fractions on the real edge,
// avoiding intentionally solid central pier and dark portal frame.
const se=new T.Vector2(...r[1] as [number,number]),ne=new T.Vector2(...r[30] as [number,number]),axis=ne.clone().sub(se),length=axis.length();axis.normalize();
function facadeRay(f:number,y:number){for(let i=1;i<30;i++){const p=new T.Vector2(...r[i] as [number,number]),q=new T.Vector2(...r[i+1] as [number,number]),a=p.clone().sub(se).dot(axis)/length,d=q.clone().sub(p).dot(axis)/length;if(Math.abs(d)<.00001)continue;const t=(f-a)/d;if(t<0||t>1)continue;const n=new T.Vector2(-(q.y-p.y),q.x-p.x).normalize(),point=p.clone().lerp(q,t),h=new T.Raycaster(new T.Vector3(point.x+n.x*10,y,point.y+n.y*10),new T.Vector3(-n.x,0,-n.y)).intersectObjects(meshes)[0];assert(h);return {hit:h,projection:(h.point.x-point.x)*n.x+(h.point.z-point.y)*n.y}}throw Error('no actual facade edge at '+f)}
for(const [lo,hi] of [[.015,.38],[.46,.985]])for(const f of [.08,.23,.47,.71,.92])for(const y of [7.4,8.85,12.15,13.9]){const {hit}=facadeRay(T.MathUtils.lerp(lo,hi,f),y);assert(['glass','frame'].includes(hit.object.geometry.userData.palette),'upper broad pane exposed');if(hit.object.geometry.userData.palette==='glass')probes++}
for(const y of [7.7,12.3])assert.equal(facadeRay(.42,y).hit.object.geometry.userData.palette,'white','one source-supported central white pier');
for(const f of [.055,.12,.25,.32])assert.equal(facadeRay(f,4.78).hit.object.geometry.userData.palette,'dark','broad charcoal entrance head');
for(const f of [.018,.378])assert.equal(facadeRay(f,2).hit.object.geometry.userData.palette,'dark','charcoal portal jambs');
const front=facadeRay(.12,4.78),glass=facadeRay(.12,2.2);assert(['glass','frame'].includes(glass.hit.object.geometry.userData.palette));assert(front.projection-glass.projection>.45,'glazing reads recessed within projecting portal');
console.log(JSON.stringify({id:data.id,triangles,bounds:{min:bb.min.toArray(),max:bb.max.toArray()},exposedPaneProbes:probes,status:'geometry only; gallery/native game acceptance pending'}));
