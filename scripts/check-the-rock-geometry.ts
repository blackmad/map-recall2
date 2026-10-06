import assert from 'node:assert/strict';import * as T from 'three';
import {buildTheRock} from './landmarks/the-rock-builder';import source from './landmarks/the-rock-footprints.json';
const group=new T.Group();let triangles=0;
const add=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.name=c;group.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3};const no=()=>{throw Error('unexpected primitive')};
buildTheRock(0,0,{add,box:(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a),prism:no,gableRoof:no,hip:no,window:no,clock:no,sign:no});group.updateMatrixWorld(true);
let rayGroup=group;const exportPath=process.argv[2];
if(exportPath&&exportPath!=='--authored'){
 const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions'),{MeshoptDecoder}=await import('meshoptimizer');await MeshoptDecoder.ready;
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(exportPath);rayGroup=new T.Group();let decodedTriangles=0;
 for(const node of doc.getRoot().listNodes())for(const p of node.getMesh()?.listPrimitives()??[]){const position=p.getAttribute('POSITION')!,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:position.getCount()},(_,i)=>position.getElement(i,[])).flat(),3));if(p.getIndices())g.setIndex(new T.BufferAttribute(p.getIndices()!.getArray()!,1));g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.name=p.getMaterial()!.getName();rayGroup.add(m);decodedTriangles+=(g.index?.count??position.getCount())/3;for(const v of position.getArray()!)assert(Number.isFinite(v),'finite decoded positions');}
 for(const m of rayGroup.children as T.Mesh[]){if(m.name!=='slate')continue;const p=m.geometry.getAttribute('position'),ix=m.geometry.index;for(let i=0;i<(ix?.count??p.count);i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j)),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(n.length()<1e-6)continue;assert(n.y>0,`decoded roof winding triangle ${i/3}: area=${n.length()/2} vertices=${JSON.stringify(v.map(q=>q.toArray()))}`);}}
 assert(decodedTriangles<40000,'decoded budget');rayGroup.updateMatrixWorld(true);console.log({exportPath,decodedTriangles});
}
const bounds=new T.Box3().setFromObject(rayGroup);assert(triangles<40000);assert(bounds.min.y>=-.001);assert(bounds.max.y<90.5&&bounds.max.y>89);assert(bounds.max.x-bounds.min.x<52&&bounds.max.z-bounds.min.z<57);
let upperCurtainSamples=0,majorFrameArea=0,majorSoffitArea=0;const outerCrownRegions:Record<string,number>={};const crownRegions:Record<string,number>={};let upward=0,panes=0,deepChannels=0,diagonalChannels=0,lowerPalePanels=0,lowerPanelSamples=0;const cantileverBottoms=new Set<number>();let occlusions:{index:number,hit:string|undefined}[]=[];
for(const [index,m]of (group.children as T.Mesh[]).entries()){
 const p=m.geometry.getAttribute('position');for(const x of p.array)assert(Number.isFinite(x));
 if(m.geometry.userData.role==='supported-roof'||m.geometry.userData.role==='crown-top'){
 const ix=m.geometry.index;for(let i=0;i<(ix?.count??p.count);i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j)),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(n.length()<1e-6)continue;assert(n.y>0,'upward roof winding');upward++}
 }
 if(['major-horizontal-frame','major-frame-soffit'].includes(m.geometry.userData.role)){
  for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),q=new T.Vector3().fromBufferAttribute(p,i+1),v=new T.Vector3().fromBufferAttribute(p,i+2),area=q.sub(a).cross(v.sub(a)).length()/2;if(m.geometry.userData.role==='major-horizontal-frame')majorFrameArea+=area;else majorSoffitArea+=area;}
 }
 // The previous rejected export had no lower pale fields and a regular shallow crown.
 // Check those assemblies independently from small crown window visibility.
 if(m.geometry.userData.role==='heavy-cantilever-beam')cantileverBottoms.add(Math.round(new T.Box3().setFromBufferAttribute(p).min.y*10)/10);
 if(m.geometry.userData.role==='printed-glass-strip'){
  const box=new T.Box3().setFromBufferAttribute(p);if(box.min.y<10&&box.max.y-box.min.y>10){
   lowerPalePanels++;const a=new T.Vector3().fromBufferAttribute(p,0),q=new T.Vector3().fromBufferAttribute(p,1),v=new T.Vector3().fromBufferAttribute(p,2),normal=q.clone().sub(a).cross(v.clone().sub(a)).normalize(),target=box.getCenter(new T.Vector3());
   const hit=new T.Raycaster(target.clone().addScaledVector(normal,1),normal.clone().negate(),0,1.2).intersectObjects(rayGroup.children)[0];
   if(rayGroup===group?hit?.object!==m:hit?.object.name!==m.name)occlusions.push({index,hit:hit?.object.name,role:'lower-pale-panel'} as any);else lowerPanelSamples++;
  }
 }
 if(m.geometry.userData.role==='deep-zigzag-glass'){
  const box=new T.Box3().setFromBufferAttribute(p),mid=box.getCenter(new T.Vector3());if(mid.y<65)continue;
  const a=new T.Vector3().fromBufferAttribute(p,0),q=new T.Vector3().fromBufferAttribute(p,1),v=new T.Vector3().fromBufferAttribute(p,2),n=q.clone().sub(a).cross(v.clone().sub(a)).normalize();
  const channelBox=new T.Box3().setFromBufferAttribute(p);
  const atHeight=(y:number)=>{const points=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i)).filter(v=>Math.abs(v.y-y)<1e-4);return new T.Vector3((Math.min(...points.map(v=>v.x))+Math.max(...points.map(v=>v.x)))/2,y,(Math.min(...points.map(v=>v.z))+Math.max(...points.map(v=>v.z)))/2)};
  const bottomCenter=atHeight(channelBox.min.y),topCenter=atHeight(channelBox.max.y);if(Math.hypot(topCenter.x-bottomCenter.x,topCenter.z-bottomCenter.z)>.3)diagonalChannels++;
  const target=a.clone().add(q).add(v).multiplyScalar(1/3),hit=new T.Raycaster(target.clone().addScaledVector(n,3.5),n.clone().negate(),0,4).intersectObjects(rayGroup.children)[0];
  if(rayGroup===group?hit?.object!==m:hit?.object.name!=='glass')occlusions.push({index,hit:hit?.object.name,role:'deep-channel'} as any);else deepChannels++;
 }
 if((m.geometry.userData.role==='crown-glazing'||m.geometry.userData.role==='outer-crown-glazing')||m.geometry.userData.role==='upper-curtain-glazing'){
  const a=new T.Vector3().fromBufferAttribute(p,0),q=new T.Vector3().fromBufferAttribute(p,1),v=new T.Vector3().fromBufferAttribute(p,2),n=q.clone().sub(a).cross(v.clone().sub(a)).normalize();const box=new T.Box3().setFromBufferAttribute(p),mid=box.getCenter(new T.Vector3());
  // Fractional face samples include edges and several heights, with single-sided raycasts.
  const bottomVertices=Array.from({length:p.count},(_,i)=>new T.Vector3().fromBufferAttribute(p,i)).filter(v=>Math.abs(v.y-box.min.y)<1e-4),left=bottomVertices[0],right=bottomVertices.reduce((best,v)=>v.distanceToSquared(left)>best.distanceToSquared(left)?v:best,left);
  const tangent=right.clone().sub(left).normalize();const width=right.distanceTo(left),height=box.max.y-box.min.y;
  for(const f of [.12,.5,.88])for(const y of [.15,.5,.85]){const target=mid.clone().addScaledVector(tangent,(f-.5)*width);target.y=box.min.y+y*height;const hit=new T.Raycaster(target.clone().addScaledVector(n,2),n.clone().negate(),0,2.3).intersectObjects(rayGroup.children)[0];if(rayGroup===group?hit?.object!==m:hit?.object.name!=='glass')occlusions.push({index,hit:hit?.object.name,role:hit?.object.geometry.userData.role,point:hit?.point.toArray(),target:target.toArray(),normal:n.toArray(),pane:Array.from(p.array)} as any);else if(m.geometry.userData.role==='upper-curtain-glazing')upperCurtainSamples++;else{panes++;const region=Math.abs(n.x)>Math.abs(n.z)?(n.x>0?'east':'west'):(n.z>0?'south':'north');crownRegions[region]=(crownRegions[region]??0)+1;if(m.geometry.userData.role==='outer-crown-glazing')outerCrownRegions[region]=(outerCrownRegions[region]??0)+1}}
 }
}
assert(upward>40);assert(majorFrameArea>40&&majorSoffitArea>30,'large horizontal frame faces and bounded return surfaces exist');for(const region of ['north','south','east','west'])assert(outerCrownRegions[region]>100,`first-hit glazing across previously blank ${region} end regions`);assert(upperCurtainSamples>400,'exposed articulated glazing continues into tall crown notches');for(const region of ['north','south','east','west'])assert(crownRegions[region]>250,`exposed crown aperture fields in ${region}`);assert(cantileverBottoms.size>=4,'unequal major crown bottom heights survive');assert(diagonalChannels>=3,'broad diagonal channel traces survive');assert(lowerPalePanels>40&&lowerPanelSamples>40,'long pale lower-facade fields are exposed');assert(deepChannels>=3,'deep macro channels have exposed glass');assert(panes>500,'many independently sampled exposed crown panes');
// Native frontage gap beside the southwestern indentation must stay empty.
const outside=new T.Raycaster(new T.Vector3(-26,20,0),new T.Vector3(0,-1,0),0,20).intersectObjects(rayGroup.children);assert(outside.length===0,'retain adjacent footprint gap');
console.log(JSON.stringify({triangles,bounds:[bounds.min.toArray(),bounds.max.toArray()],upward,panes,crownRegions,outerCrownRegions,majorFrameArea,majorSoffitArea,upperCurtainSamples,deepChannels,diagonalChannels,lowerPalePanels,lowerPanelSamples,cantileverBottomHeights:[...cantileverBottoms].sort((a,b)=>a-b),crownOcclusions:occlusions.length,failedRoles:occlusions.reduce((counts,o)=>{const key=(o as any).role??o.hit??"unknown";counts[key]=(counts[key]??0)+1;return counts},{} as Record<string,number>),failedSample:occlusions.slice(0,2),scope:exportPath??'authored',status:occlusions.length?'FAILED crown first-hit exposure: preserve evidence; do not accept':(rayGroup===group?'authored geometry passes; decoded/gallery/live/POI/performance pending':'decoded geometry passes; gallery/live/POI/performance pending'),sourceBag:source.bagId},null,2));
if(occlusions.length)process.exitCode=1;
