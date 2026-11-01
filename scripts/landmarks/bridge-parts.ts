// Bridge parts for bespoke bridge builders (lane landmarks-bridges-20261101, #175): every part is authored in
// the bridge's own frame (src/canalRecall/landmarks/bridgeFrame.ts: along the axis, y = scene z, right of the
// bearing) and handed to BuildingTools in the exporter's native frame. Used by blauwbrug-builder.ts and
// magere-brug-builder.ts; no other builder imports it, so other exports are unchanged.
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {basisMatrix,bridgeBasis} from '../../src/canalRecall/landmarks/bridgeFrame';

export type C=Parameters<BuildingTools['add']>[1];
export type P2=[number,number];
export type P3=[number,number,number];

export interface BridgeParts{
 /** Hand a geometry authored in [along, y, right] to the exporter. */
 put(g:T.BufferGeometry,c:C):void;
 /** Box: centre `a` along, bottom `y0`, centre `r` right; sizes along/height/right; yaw about up (radians). */
 box(a:number,y0:number,r:number,la:number,h:number,lr:number,c:C,yaw?:number):void;
 /** A polygon in the (along, y) plane extruded across from `r0` to `r1`. */
 wall(points:P2[],r0:number,r1:number,c:C):void;
 /** A plan polygon (along, right) extruded from y0 up to y1. */
 plan(points:P2[],y0:number,y1:number,c:C):void;
 /** The underside of an arch: a barrel strip under `arc` from r0 to r1, faces turned to the opening. */
 soffit(arc:P2[],r0:number,r1:number,c:C):void;
 /** A rectangular bar swept along stations: top(a) is its top, `depth` below it, r0..r1 across. */
 sweep(a0:number,a1:number,r0:number,r1:number,top:(a:number)=>number,depth:number,c:C,step?:number):void;
 /** A lathe (radius, height) profile about a vertical axis at (a, r), from y0. */
 lathe(profile:P2[],a:number,y0:number,r:number,segments:number,c:C):void;
 /** A square bar between two points. */
 beam(p:P3,q:P3,half:number,c:C):void;
 /** A torus ring in the plane facing `right` (normal across the bridge). */
 ring(a:number,y:number,r:number,radius:number,tube:number,c:C,facing?:'right'|'along'):void;
 /** An ellipsoid (sx, sy, sr half-axes). */
 blob(a:number,y:number,r:number,sx:number,sy:number,sr:number,c:C,w?:number,h?:number):void;
}

/** Drop zero-area triangles (a lathe's axis points, coincident sweep stations): the export audit counts them. */
function dropDegenerate(g:T.BufferGeometry):T.BufferGeometry{
 const src=(g.index?g.toNonIndexed():g).getAttribute('position').array as ArrayLike<number>,keep:number[]=[];
 let dropped=0;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<src.length;i+=9){a.set(src[i],src[i+1],src[i+2]);b.set(src[i+3],src[i+4],src[i+5]);c.set(src[i+6],src[i+7],src[i+8]);
  if(b.clone().sub(a).cross(c.clone().sub(a)).length()>1e-7)for(let k=0;k<9;k++)keep.push(src[i+k]);else dropped++;}
 if(!dropped)return g;
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(keep,3));return out;
}

/**
 * `lift` raises everything so the model's lowest point (the pier feet under the water) is the GLB's y = 0, the
 * ground the export audit and the runtime stand a model on; the catalogue's groundAltitudeMetres takes it back.
 */
export function bridgeParts(b:BuildingTools,bearingDegrees:number,lift=0):BridgeParts{
 const M=new T.Matrix4().makeTranslation(0,lift,0).multiply(new T.Matrix4().set(...(basisMatrix(bridgeBasis(bearingDegrees)) as [number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number])));
 const put=(g:T.BufferGeometry,c:C)=>{g.applyMatrix4(M);const clean=dropDegenerate(g);clean.computeVertexNormals();b.add(clean,c);};
 const fromQuads=(pos:number[])=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));return g;};
 const quad=(out:number[],p:P3,q:P3,r:P3,s:P3)=>{out.push(...p,...q,...r,...p,...r,...s);};
 return{
  put,
  box(a,y0,r,la,h,lr,c,yaw=0){const g=new T.BoxGeometry(la,h,lr);if(yaw)g.rotateY(yaw);g.translate(a,y0+h/2,r);put(g,c);},
  wall(points,r0,r1,c){const s=new T.Shape(points.map(([a,y])=>new T.Vector2(a,y)));const g=new T.ExtrudeGeometry(s,{depth:r1-r0,bevelEnabled:false,curveSegments:1});g.translate(0,0,r0);put(g,c);},
  plan(points,y0,y1,c){
   // Shape x = along, shape y = −right, extruded along +z then turned so +z is up: (a, −r, z) → (a, z, r).
   const s=new T.Shape(points.map(([a,r])=>new T.Vector2(a,-r)));const g=new T.ExtrudeGeometry(s,{depth:y1-y0,bevelEnabled:false,curveSegments:1});
   g.rotateX(-Math.PI/2);g.translate(0,y0,0);put(g,c);},
  soffit(arc,r0,r1,c){const pos:number[]=[];for(let i=1;i<arc.length;i++){const [a0,y0]=arc[i-1],[a1,y1]=arc[i];quad(pos,[a0,y0,r0],[a0,y0,r1],[a1,y1,r1],[a1,y1,r0]);}put(fromQuads(pos),c);},
  sweep(a0,a1,r0,r1,top,depth,c,step=1){
   const st:number[]=[];for(let a=a0;a<a1-1e-6;a+=step)st.push(a);st.push(a1);
   const pos:number[]=[];
   for(let i=1;i<st.length;i++){const p=st[i-1],q=st[i],tp=top(p),tq=top(q);
    quad(pos,[p,tp,r0],[p,tp,r1],[q,tq,r1],[q,tq,r0]);
    quad(pos,[p,tp-depth,r0],[q,tq-depth,r0],[q,tq-depth,r1],[p,tp-depth,r1]);
    quad(pos,[p,tp-depth,r1],[q,tq-depth,r1],[q,tq,r1],[p,tp,r1]);
    quad(pos,[p,tp-depth,r0],[p,tp,r0],[q,tq,r0],[q,tq-depth,r0]);}
   for(const [a,sgn] of [[st[0],-1],[st[st.length-1],1]] as P2[]){const t=top(a);if(sgn<0)quad(pos,[a,t-depth,r0],[a,t-depth,r1],[a,t,r1],[a,t,r0]);else quad(pos,[a,t-depth,r0],[a,t,r0],[a,t,r1],[a,t-depth,r1]);}
   put(fromQuads(pos),c);},
  lathe(profile,a,y0,r,segments,c){const g=new T.LatheGeometry(profile.map(([rad,y])=>new T.Vector2(rad,y)),segments);g.translate(a,y0,r);put(g,c);},
  beam(p,q,half,c){const s=new T.Vector3(...p),e=new T.Vector3(...q),v=e.clone().sub(s),g=new T.BoxGeometry(half*2,v.length(),half*2);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...(s.add(e).multiplyScalar(.5).toArray() as P3));put(g,c);},
  ring(a,y,r,radius,tube,c,facing='right'){const g=new T.TorusGeometry(radius,tube,5,10);if(facing==='along')g.rotateY(Math.PI/2);g.translate(a,y,r);put(g,c);},
  blob(a,y,r,sx,sy,sr,c,w=8,h=5){const g=new T.SphereGeometry(1,w,h);g.scale(sx,sy,sr);g.translate(a,y,r);put(g,c);},
 };
}
