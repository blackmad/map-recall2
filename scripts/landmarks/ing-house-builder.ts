import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './ing-house-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type P=[number,number,number];
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native surveyed glass-and-aluminium wedge. No photo pixels or source meshes. */
export function buildIngHouse(_w:number,_d:number,b:BuildingTools):void{
 const ring=source.localRing as [number,number][];
 const profile:[number,number][]=[[-70,23.5],[-58,25.0],[-18.4,36.74],[-5.12,40.17],[3.06,48.46],[68.3,48.3]];
 const top=(x:number)=>{for(let i=1;i<profile.length;i++)if(x<=profile[i][0]){const [a,y]=profile[i-1],[q,v]=profile[i];return y+(v-y)*(x-a)/(q-a)}return 48.3};
 function face(p:P[],c:Colour,role:string){const vs:number[]=[];for(let i=1;i<p.length-1;i++)vs.push(...p[0],...p[i],...p[i+1]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.computeVertexNormals();g.userData.role=role;b.add(g,c)}
 function beam(a:P,q:P,w:number,d:number,c:Colour,role='mullion'){const va=new T.Vector3(...a),v=new T.Vector3(...q).sub(va),g=new T.BoxGeometry(w,v.length(),d);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize()));g.userData.role=role;const m=va.add(new T.Vector3(...q)).multiplyScalar(.5);b.add(g,c,m.x,m.y,m.z)}
 // Curved/faceted belly tapers inward below the glazed outer skin. The centre
 // stays in the air: no parcel slab, no fake solid plinth filling the undercroft.
 const shape=new T.Shape(ring.slice(0,-1).map(([x,z])=>new T.Vector2(x*.965,z*.74)));
 const bellyBottom=upwardRoofPlane(shape,10.8);bellyBottom.scale(1,-1,1);bellyBottom.translate(0,21.6,0);bellyBottom.userData.role='belly-underside';b.add(bellyBottom,'frame');
 for(let i=0;i<ring.length-1;i++){
  const [ax,az]=ring[i],[qx,qz]=ring[i+1];
  // Four bounded rings approximate the rounded aluminium corner visible in
  // MVSA's west/south principal view. The surveyed outermost ring is unchanged.
  const bevel=[[10.8,.965,.74],[11.25,.981,.85],[12.5,.994,.95],[14.6,1,1]];
  for(let k=1;k<bevel.length;k++){
   const [y0,x0,z0]=bevel[k-1],[y1,x1,z1]=bevel[k];
   face([[ax*x0,y0,az*z0],[qx*x0,y0,qz*z0],[qx*x1,y1,qz*z1],[ax*x1,y1,az*z1]],Math.max(ax,qx)<-49?'white':'frame','silver-belly');
  }
  const len=Math.hypot(qx-ax,qz-az),n=Math.ceil(len/1.65),nx=-(qz-az)/len,nz=(qx-ax)/len;
  // All glass is the exposed first-hit shell, not buried decorative panes.
  for(let j=0;j<n;j++){
   const t=j/n,u=(j+1)/n,x=ax+(qx-ax)*t,z=az+(qz-az)*t,xx=ax+(qx-ax)*u,zz=az+(qz-az)*u;
   const nose=x<-49&&xx<-49,panoramic=x<-60&&xx<-60;
   face([[x,14.6,z],[xx,14.6,zz],[xx,top(xx),zz],[x,top(x),z]],nose?'white':'glass',nose?'nose-panel':'outer-facade');
   if(panoramic){face([[x+nx*.055,16.5,z+nz*.055],[xx+nx*.055,16.5,zz+nz*.055],[xx+nx*.055,Math.min(22,top(xx)-2.1),zz+nz*.055],[x+nx*.055,Math.min(22,top(x)-2.1),z+nz*.055]],'glass','nose-glazing');}
   beam([x+nx*.09,14.6,z+nz*.09],[x+nx*.09,top(x),z+nz*.09],nose?.045:.11,nose?.045:.11,'frame');
   // Actual floor bands terminate at the wedge roof, including its rising end.
   for(let y=17.9;y<48;y+=3.65){if(y>Math.max(top(x),top(xx))-.3)continue;const endTop=top(xx),startTop=top(x);let a:P=[x+nx*.12,y,z+nz*.12],q:P=[xx+nx*.12,y,zz+nz*.12];if(y>startTop){const k=(y-startTop)/(endTop-startTop);a=[a[0]+(q[0]-a[0])*k,y,a[2]+(q[2]-a[2])*k]}if(y>endTop){const k=(y-startTop)/(endTop-startTop);q=[a[0]+(q[0]-a[0])*k,y,a[2]+(q[2]-a[2])*k]}beam(a,q,nose?.05:.14,nose?.08:.19,'frame',nose?'panel-seam':'floor-band')}
   beam([x+nx*.10,top(x),z+nz*.10],[xx+nx*.10,top(xx),zz+nz*.10],.20,.22,nose?'white':'frame','roof-edge');
  }
 }
 // Sixteen inclined bridge-like steel columns in two rows of eight.
 for(let i=0;i<8;i++)for(const side of[-1,1]){
  const x=-49+i*15,z=side*9.9;
  const footing=new T.CylinderGeometry(1.05,1.2,.5,8);footing.userData.role='individual-footing';b.add(footing,'stone',x+3.6,.25,z+side*.8);
  // Photo-informed tapered steel plate proportions: broad at the belly,
  // narrow at the bridge-like pin bearing. Widths are approximation, not survey.
  const foot=new T.Vector3(x+3.6,.5,z+side*.8),head=new T.Vector3(x,10.9,z),axis=head.clone().sub(foot),length=axis.length();
  const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis.clone().normalize());
  const local:P[]=[[-.35,0,-.5],[.35,0,-.5],[.35,0,.5],[-.35,0,.5],[-1.65,length,-.75],[1.65,length,-.75],[1.65,length,.75],[-1.65,length,.75]];
  const points=local.map(v=>new T.Vector3(...v).applyQuaternion(rotation).add(foot).toArray() as P),indices=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],positions:number[]=[];
  for(const f of indices)for(let j=1;j<f.length-1;j++)positions.push(...points[f[0]],...points[f[j]],...points[f[j+1]]);
  const leg=new T.BufferGeometry();leg.setAttribute('position',new T.Float32BufferAttribute(positions,3));leg.computeVertexNormals();leg.userData.role='inclined-support';b.add(leg,'white');
  // A slender exposed stiffener follows the sloping outer face of each plate.
  const offset=(v:P)=>new T.Vector3(...v).applyQuaternion(rotation).add(foot).toArray() as P;
  beam(offset([0,0,side*.535]),offset([0,length,side*.785]),.12,.08,'frame','support-web');
 }
 // Tall glass eastern entrance lobby reaches the raised belly, per the 2005
 // archive entrance photograph. Its height is photo-derived approximation;
 // mapped entrance fixes its location. The outside covered lane remains open.
 const lobbyShape=new T.Shape([new T.Vector2(42,-2),new T.Vector2(64,-2),new T.Vector2(64,6.5),new T.Vector2(42,6.5)]);
 b.add(openTopPrism(lobbyShape,0,10.8),'glass'); // belly underside owns the ceiling; no coplanar lobby cap
 for(let x=42;x<=64;x+=3){b.box(x,0,6.58,.14,10.8,.15,'frame');b.box(x,0,-2.08,.14,10.8,.15,'frame')}
 for(const y of[3.5,7]){b.box(53,y,6.58,22,.13,.15,'frame');b.box(53,y,-2.08,22,.13,.15,'frame');for(const x of[41.92,64.08])b.box(x,y,2.25,.15,.13,8.5,'frame')}
 b.box(45,0,1.5,3.5,10.8,3.8,'dark');b.box(56.5,0,6.66,3.6,3,.14,'glass');b.box(56.5,0,6.75,.11,3,.16,'frame');
 // Roof owns its surface. The documented roof garden patio is open above a
 // lower garden deck; the surrounding roof is supported by the surveyed skin.
 function clip(poly:[number,number][],edge:number,greater:boolean):[number,number][]{const out:[number,number][]=[];for(let i=0;i<poly.length;i++){const a=poly[i],q=poly[(i+1)%poly.length],aa=greater?a[0]>=edge:a[0]<=edge,qq=greater?q[0]>=edge:q[0]<=edge;if(aa)out.push(a);if(aa!==qq){const t=(edge-a[0])/(q[0]-a[0]);out.push([edge,a[1]+t*(q[1]-a[1])])}}return out}
 for(let i=1;i<profile.length;i++){
  const poly=clip(clip(ring.slice(0,-1),profile[i-1][0],true),profile[i][0],false);
  if(poly.length<3)continue;const roofShape=new T.Shape(poly.map(([x,z])=>new T.Vector2(x,z)));
  if(profile[i-1][0]<=12&&profile[i][0]>=27)roofShape.holes.push(new T.Path([new T.Vector2(12,-4.5),new T.Vector2(12,5),new T.Vector2(27,5),new T.Vector2(27,-4.5)]));
  const roof=upwardRoofPlane(roofShape),pos=roof.getAttribute('position');for(let j=0;j<pos.count;j++)pos.setY(j,top(pos.getX(j)));roof.computeVertexNormals();roof.userData.role='roof';b.add(roof,'slate');
 }
 b.box(19.5,43.1,.25,15,.2,9.5,'stone');for(const z of[-4.5,5])b.box(19.5,43.3,z,15,5,.16,'glass');for(const x of[12,27])b.box(x,43.3,.25,.16,5,9.5,'glass');
 for(const x of[15.5,22.5]){b.box(x,43.3,.3,1.7,.8,1.7,'stone');b.box(x,44.1,.3,.15,1.5,.15,'bronze');b.add(new T.ConeGeometry(1.05,2.3,6),'green',x,46,.3)}
 // South-side solar shade projects only a small distance from the facade.
 for(let x=-48;x<64;x+=3.3){const z=14.42;for(let y=18;y<top(x)-1;y+=3.65)b.box(x,y,z,2.9,.10,.48,'frame')}
}
