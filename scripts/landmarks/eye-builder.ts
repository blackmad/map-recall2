import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './eye-footprint.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original rounded roof control points, not triangles from either reference model. */
export function buildEye(_w:number,_d:number,b:BuildingTools){
 const local=(p:number[])=>new T.Vector2((p[0]-data.anchor[0])*111320*Math.cos(data.anchor[1]*Math.PI/180),-(p[1]-data.anchor[1])*110540);
 function face(p:number[][],colour:Colour){const v:number[]=[];const normal=new T.Vector3().crossVectors(new T.Vector3(...p[1] as [number,number,number]).sub(new T.Vector3(...p[0] as [number,number,number])),new T.Vector3(...p[2] as [number,number,number]).sub(new T.Vector3(...p[0] as [number,number,number])));const axis=Math.abs(normal.y)>Math.abs(normal.z)?'y':'z';const points=p.map(q=>new T.Vector2(q[0],q[axis==='y'?2:1]));const tris=T.ShapeUtils.triangulateShape(points,[]);for(const tri of tris)for(const i of tri)v.push(...p[i]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();b.add(g,colour);}
 function beam(a:number[],q:number[],width:number,colour:Colour){const p=new T.Vector3(...a as [number,number,number]),end=new T.Vector3(...q as [number,number,number]),d=end.clone().sub(p),g=new T.CylinderGeometry(width,width,d.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));g.translate(...p.add(end).multiplyScalar(.5).toArray() as [number,number,number]);b.add(g,colour);}
 const A=[-54,13,-40],B=[-24,14,-42],C=[-2,17.5,-16],D=[24,24.4,-4],E=[55,24.1,13],F=[55,24.1,30],G=[25,24.4,28],H=[12,21.5,26],I=[-15,14.4,24],J=[-35,12,18],K=[-40,11.7,16],L=[-47,15,-20],M=[-5,19,3],N=[15,24.4,10],Q=[6,22,8];
 // Folded roof: western low wing, rising middle and nearly level eastern prow.
 for(const p of [[A,B,C,M,L],[L,M,J,K],[C,D,N,M],[D,E,F,G,N],[M,N,Q],[Q,N,G],[M,Q,G,H,J],[J,H,I],[K,J,I]])face(p,'white');
 // Ground-floor plan is inset from the overhanging shell, leaving the east prow open below.
 const lower=data.osmBuildings.find(f=>f.properties['@id']===1206726812)!;
 const ring=lower.geometry.coordinates[0][0].slice(0,-1).map(local);let area=0;for(let i=0;i<ring.length;i++)area+=ring[i].x*ring[(i+1)%ring.length].y-ring[(i+1)%ring.length].x*ring[i].y;
 for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],d=q.clone().sub(a),length=d.length();if(length<.2)continue;const n=new T.Vector2(d.y,-d.x).normalize().multiplyScalar(area>0?1:-1),isFront=n.y>.15;
  face([[a.x,.2,a.y],[q.x,.2,q.y],[q.x,4,q.y],[a.x,4,a.y]],isFront?'glass':'white');
  for(const y of [.15,3.9])beam([a.x,y,a.y],[q.x,y,q.y],.13,'white');
  if(isFront){for(let t=0;t<=1;t+=1/Math.max(1,Math.ceil(length/2.5))){const m=a.clone().lerp(q,t).addScaledVector(n,.04);b.box(m.x,.2,m.y,.1,3.7,.1,'frame');}}
 }
 const plan=new T.Shape(ring);const floor=new T.ShapeGeometry(plan);floor.rotateX(Math.PI/2);floor.translate(0,.15,0);b.add(floor,'slate');
 // Exterior shell below each roof edge; eastern edge is a suspended white beam.
 const outer=[A,B,C,D,E,F,G,H,I,J,K,L],base=[8,8,9,18,21,21,18,10,4.3,6,6,6];
 for(let i=0;i<outer.length;i++){const a=outer[i],q=outer[(i+1)%outer.length],lo=base[i],hi=base[(i+1)%outer.length];
  if(i>=5&&i<=9){const topA=a[1]-2.4,topQ=q[1]-2.4;
   face([a,q,[q[0],topQ,q[2]],[a[0],topA,a[2]]],'white');
   const glassA=Math.min(topA,lo+.5),glassQ=Math.min(topQ,hi+.5);
   if(i!==5){face([[a[0],glassA,a[2]],[q[0],glassQ,q[2]],[q[0],topQ,q[2]],[a[0],topA,a[2]]],'glass');
    const length=Math.hypot(q[0]-a[0],q[2]-a[2]),count=Math.max(1,Math.ceil(length/2.6));for(let j=0;j<=count;j++){const t=j/count,x=T.MathUtils.lerp(a[0],q[0],t),z=T.MathUtils.lerp(a[2],q[2],t),y=T.MathUtils.lerp(glassA,glassQ,t),top=T.MathUtils.lerp(topA,topQ,t);beam([x,y,z+.06],[x,top,z+.06],.055,'frame');}
   }
   face([[a[0],lo,a[2]],[q[0],hi,q[2]],[q[0],glassQ,q[2]],[a[0],glassA,a[2]]],'white');
   if(i>=6)face([[a[0],4.15,a[2]],[q[0],4.15,q[2]],[q[0],hi,q[2]],[a[0],lo,a[2]]],'white');
  }else face([a,q,[q[0],hi,q[2]],[a[0],lo,a[2]]],'white');
  // Opaque return panels end at the inset core; never fill the eastern undercroft.
  if(i<3||i===10||i===11)face([[a[0],lo,a[2]],[q[0],hi,q[2]],[q[0],.2,q[2]],[a[0],.2,a[2]]],'white');
 }
 // Clear east undercroft soffit rather than a full-height white block.
 face([[24,18,-4],[55,21,13],[55,21,30],[25,18,28]],'white');
 // The narrow inclined glazed slit in the raised prow is geometric, without an image texture.
 face([[25.4,22.6,28.09],[27.8,22.58,28.32],[29.1,24.36,28.42],[26.7,24.38,28.19]],'glass');
 // Original simplified entrance steps follow the separately mapped stair footprint.
 const stair=data.osmBuildings.find(f=>f.properties['@id']===1207014127)!;
 const sr=stair.geometry.coordinates[0][0].slice(0,-1).map(local),direction=new T.Vector2(.66,.75),depths=sr.map(p=>p.dot(direction)),lo=Math.min(...depths),hi=Math.max(...depths);
 const clip=(p:T.Vector2[],v:number,less:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<p.length;i++){const a=p[i],q=p[(i+1)%p.length],av=a.dot(direction),qv=q.dot(direction),ain=less?av<=v:av>=v,qin=less?qv<=v:qv>=v;if(ain)out.push(a);if(ain!==qin)out.push(a.clone().lerp(q,(v-av)/(qv-av)));}return out;};
 for(let i=0;i<18;i++){const p=clip(clip(sr,lo+(hi-lo)*i/18,false),lo+(hi-lo)*(i+1)/18,true);if(p.length<3)continue;const h=.15+(18-i)*.21;face(p.map(q=>[q.x,h,q.y]),'stone');for(let k=0;k<p.length;k++){const a=p[k],q=p[(k+1)%p.length];face([[a.x,0,a.y],[q.x,0,q.y],[q.x,h,q.y],[a.x,h,a.y]],'stone');}}
}
