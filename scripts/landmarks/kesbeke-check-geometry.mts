import * as T from 'three';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildKesbeke,buildKesbekeShop} from './kesbeke-builder.ts';
const results:Record<string,unknown>={date:'2026-10-06',builderSha256:crypto.createHash('sha256').update(fs.readFileSync('scripts/landmarks/kesbeke-builder.ts')).digest('hex'),sourceEvidence:'Private raw2024panoramas, frozen source cropplan and beforebuilder in models/kesbeke/processed/2024-11-21',scope:'Uncompressed generated geometry. Fractional pane samples retain all mullion/signboard/door overlaps; no WebGL/game or source-visual acceptance.'};
for(const[id,build]of[['factory',buildKesbeke],['shop',buildKesbekeShop]] as const){
 const group=new T.Group();const b={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,angle=0){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.y=angle;m.userData.colour=c;group.add(m)},box(){},prism(){},window(){},gableRoof(){},hip(){},clock(){},sign(){}};
 build(1,1,b);group.updateMatrixWorld(true);let triangles=0,roofDown=0,maxResidual=0,nonfinite=0;const panes:unknown[]=[];
 group.traverse(node=>{if(!(node instanceof T.Mesh))return;const g=node.geometry as T.BufferGeometry,p=g.getAttribute('position');triangles+=(g.index?.count??p.count)/3;for(const value of p.array)if(!Number.isFinite(value))nonfinite++;
  if(g.userData.role==='survey-roof'){maxResidual=Math.max(maxResidual,g.userData.residual);const ix=g.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(i)),q=new T.Vector3().fromBufferAttribute(p,ix.getX(i+1)),r=new T.Vector3().fromBufferAttribute(p,ix.getX(i+2));if(q.sub(a).cross(r.sub(a)).y<-1e-8)roofDown++;}}
  if(node.userData.colour!=='glass')return;
  const n=new T.Vector3(g.userData.normal[0],0,g.userData.normal[1]),t=new T.Vector3(n.z,0,-n.x);g.computeBoundingBox();const center=g.boundingBox!.getCenter(new T.Vector3());let lo=Infinity,hi=-Infinity;for(let i=0;i<p.count;i++){const u=new T.Vector3().fromBufferAttribute(p,i).dot(t);lo=Math.min(lo,u);hi=Math.max(hi,u);}const h=g.boundingBox!.max.y-g.boundingBox!.min.y;let clear=0;const occlusions:Record<string,number>={};
  for(const fu of [.1,.3,.5,.7,.9])for(const fv of [.1,.3,.5,.7,.9]){const point=center.clone().addScaledVector(t,(fu-.5)*(hi-lo));point.y=g.boundingBox!.min.y+fv*h;const ray=new T.Raycaster(point.clone().addScaledVector(n,2),n.clone().negate(),0,2.2),hits=ray.intersectObjects(group.children,false);if(hits[0]?.object===node)clear++;else{const colour=hits[0]?.object.userData.colour??'no-hit';occlusions[colour]=(occlusions[colour]??0)+1;}}
  panes.push({center:center.toArray(),normal:n.toArray(),clearOf25:clear,occlusions});
 });
 const bounds=new T.Box3().setFromObject(group);results[id]={triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},downwardRoofTriangles:roofDown,maxPlanarResidualM:maxResidual,nonfinite,paneFractionalSamples:panes};if(triangles>40000||roofDown||nonfinite)throw Error(`Kesbeke geometry preflight failed ${id}`);
 console.log(id,JSON.stringify({triangles,roofDown,maxResidual,nonfinite,paneCount:panes.length,partlyOccluded:panes.filter((p)=>((p as{clearOf25:number}).clearOf25<25)).length}));
}
fs.writeFileSync('docs/references/kesbeke/geometry-preflight-2024-correction.json',JSON.stringify(results,null,2)+'\n');
