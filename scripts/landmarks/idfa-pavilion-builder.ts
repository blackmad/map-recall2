import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import spec from './idfa-pavilion-spec.json';
import source from './idfa-pavilion-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
export function idfaLocal([lng,lat]:number[]):P{const a=spec.surveyed.anchor,h=116.4*Math.PI/180,e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return[e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h)]}
/** Original plastered Italian Renaissance pavilion with genuinely open arcades. */
export function buildIdfaPavilion(_w:number,_d:number,b:BuildingTools):void{
 const footprint=new T.Shape(source.geometry.coordinates[0].map(p=>new T.Vector2(...idfaLocal(p))));
 b.add(openTopPrism(footprint,0,3),'brick');b.add(upwardRoofPlane(footprint,3),'stone');
 function shell(x:number,z:number,w:number,d:number,lo:number,hi:number,c:C='stone'){const s=new T.Shape([new T.Vector2(x-w/2,z-d/2),new T.Vector2(x+w/2,z-d/2),new T.Vector2(x+w/2,z+d/2),new T.Vector2(x-w/2,z+d/2)]);b.add(openTopPrism(s,lo,hi),c)}
 // Distinct stepped bodies, with loggia front recessed behind free columns.
 shell(-.6,-2.9,11.2,18.6,3,11.1);shell(-.6,-2.9,11.2,18.6,11.1,16.35,'brick');shell(-11.1,-.7,10.2,11.1,3,11.1);shell(10.45,-.65,10.5,11.0,3,11.1);
 for(const x of[-15.8,15.2]){shell(x,3.5,4.6,5.6,3,11.1);shell(x,3.5,4.6,5.6,11.1,15.2,'brick');}
 shell(-11.8,-9.25,10.7,4.3,3,6.7);shell(.5,-14.1,14,6.1,3,7.35);shell(16.2,-8.8,10.8,3.1,3,8.8);shell(10.2,-13.1,6.2,7.9,3,6.3);
 // Surveyed patches include equipment/dormer fits and disconnected slivers.
 // Use their eave/crest envelopes to author closed, supported roof assemblies;
 // never project every fitted fragment directly into the visible silhouette.
 type V=[number,number,number];
 function roofFaces(id:string,faces:V[][]){const values:number[]=[];for(const face of faces)for(let i=1;i<face.length-1;i++){const a=face[0],q=face[i],r=face[i+1],n=new T.Vector3().subVectors(new T.Vector3(...q),new T.Vector3(...a)).cross(new T.Vector3().subVectors(new T.Vector3(...r),new T.Vector3(...a)));values.push(...a,...(n.y>=0?q:r),...(n.y>=0?r:q));}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.roofAssembly=id;b.add(g,'slate');}
 function hip(id:string,x:number,z:number,w:number,d:number,eave:number,top:number,upperW:number,upperD:number){const lower:V[]=[[-w/2,eave,-d/2],[w/2,eave,-d/2],[w/2,eave,d/2],[-w/2,eave,d/2]].map(p=>[p[0]+x,p[1],p[2]+z] as V),upper:V[]=[[-upperW/2,top,-upperD/2],[upperW/2,top,-upperD/2],[upperW/2,top,upperD/2],[-upperW/2,top,upperD/2]].map(p=>[p[0]+x,p[1],p[2]+z] as V),faces:V[][]=[];for(let i=0;i<4;i++){const j=(i+1)%4;faces.push([lower[i],lower[j],upper[j],upper[i]])}faces.push(upper);roofFaces(id,faces);}
 // RCE describes a slate hipped central roof. AHN5 gives16.35m eaves
 // and21.72m crest; photographs show a compact top rather than projecting fins.
 hip('central',-.6,-2.9,11.2,18.6,16.35,21.72,2.4,11.6);
 hip('west-wing',-11.1,-.7,10.2,11.1,11.1,13.45,7.4,2.0);
 hip('east-wing',10.45,-.65,10.5,11.0,11.1,13.45,7.6,2.0);
 // Four-sided domes on square pavilions, with rounded slope in elevation,
 // grounded on the15.2m tower cornice; slim existing helms crown18.5m caps.
 for(const [id,x] of [['west-dome',-15.8],['east-dome',15.2]] as const){const rings:V[][]=[];for(let j=0;j<=8;j++){const t=j/8*Math.PI/2,k=Math.cos(t),y=15.2+3.3*Math.sin(t),rx=Math.max(.12,2.3*k),rz=Math.max(.12,2.8*k);rings.push([[-rx,y,-rz],[rx,y,-rz],[rx,y,rz],[-rx,y,rz]].map(p=>[p[0]+x,p[1],p[2]+3.5] as V))}const faces:V[][]=[];for(let j=0;j<8;j++)for(let i=0;i<4;i++){const q=(i+1)%4;faces.push([rings[j][i],rings[j][q],rings[j+1][q],rings[j+1][i]])}faces.push(rings[8]);roofFaces(id,faces);}
 hip('west-rear',-11.8,-9.25,10.7,4.3,6.7,6.8,10.1,3.7);
 hip('central-rear',.5,-14.1,14,6.1,7.35,7.45,13.4,5.5);
 hip('east-rear',16.2,-8.8,10.8,3.1,8.8,9.95,8.6,.6);
 hip('east-low-rear',10.2,-13.1,6.2,7.9,6.3,6.45,5.8,7.5);
 function archPane(x:number,y:number,z:number,w:number,h:number,angle=0){const r=w/2,s=new T.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,h-r);s.absarc(0,h-r,r,0,Math.PI,false);s.lineTo(-r,0);b.add(new T.ShapeGeometry(s),'glass',x,y,z,angle);const nx=Math.sin(angle),nz=Math.cos(angle);b.box(x+nx*.05,y,z+nz*.05,.1,h,.1,'frame',angle);b.box(x+nx*.05,y+h-r-.12,z+nz*.05,w,.1,.1,'frame',angle);b.box(x+nx*.08,y+.15,z+nz*.08,w+.25,.18,.15,'stone',angle)}
 function archRing(x:number,y:number,z:number,w:number,rise:number){const s=new T.Shape(),r=w/2,th=.28;s.absarc(0,0,r+th,0,Math.PI,false);s.lineTo(-r,0);s.absarc(0,0,r,Math.PI,0,true);s.closePath();b.add(new T.ExtrudeGeometry(s,{depth:.36,bevelEnabled:false}),'stone',x,y+rise,z-.18)}
 function column(x:number,z:number,y=3.2,h=6.2,r=.22){b.add(new T.CylinderGeometry(r,r*1.12,h,10),'stone',x,y+h/2,z);b.box(x,y,z,.7,.26,.65,'stone');b.box(x,y+h-.15,z,.76,.34,.7,'stone');for(const side of[-1,1])b.add(new T.TorusGeometry(.14,.05,5,8),'stone',x+side*.24,y+h-.05,z+.08)}
 // Three open bays in each side loggia. The full parent shell ends3m lower.
 for(const [left,right] of [[-13.45,-5.85],[5.1,13.0]]){const step=(right-left)/3;for(let i=0;i<=3;i++)column(left+i*step,6.2);for(let i=0;i<3;i++){const x=left+(i+.5)*step;archRing(x,3.2,6.2,step-.44,6.1);archPane(x,3.4,6.14,step-.75,5.7)}b.box((left+right)/2,10.0,6.2,right-left+.4,1.1,.65,'stone');}
 // Central three large arched openings on both principal storeys.
 for(const x of[-4.1,-.6,2.9]){archPane(x,3.6,6.45,2.25,5.85);archRing(x,3.6,6.5,2.25,4.72);archPane(x,11.65,6.45,2.1,3.3);archRing(x,11.65,6.5,2.1,2.25)}
 for(const x of[-6.1,-2.35,1.15,4.95]){column(x,6.55,3.15,6.65,.22);column(x,6.55,11.55,3.7,.16)}
 for(const y of[3.05,9.95,11.1,15.7,16.2])b.box(-.6,y,6.6,12,.28,.65,'stone');
 function balustrade(x:number,z:number,w:number,y:number){b.box(x,y,z,w,.16,.3,'stone');b.box(x,y+1.05,z,w,.16,.4,'stone');for(let xx=x-w/2;xx<=x+w/2+.02;xx+=.46){b.add(new T.CylinderGeometry(.09,.13,.82,6),'stone',xx,y+.57,z);b.box(xx,y+.14,z,.2,.12,.2,'stone')}for(const xx of[x-w/2,x+w/2])b.box(xx,y,z,.35,1.25,.4,'stone')}
 for(const [x,w] of [[-10.1,10],[-.6,11.6],[9.85,9.6]])balustrade(x,6.75,w,11.1);balustrade(-.6,6.75,11.8,16.4);
 // Terrace front has the current2014 broad central stair, with source-visible side stairs.
 for(const [x,z,w] of [[-15.75,10.6,12.5],[14.8,10.55,12.3]])balustrade(x,z,w,3.05);
 for(let i=0;i<12;i++)b.box(-.6,.25*i,12.8+(11-i)*.32,8.0,.25,.45,'stone');
 for(const side of[-1,1]){for(let i=0;i<12;i++)b.box(-.6+side*4.2,.25*i,12.8+(11-i)*.32,.28,.9,.45,'stone');}
 for(const x of[-8.5,8.2])for(let i=0;i<12;i++)b.box(x,.25*i,13.1+(11-i)*.3,2.35,.25,.45,'stone');
 // Exposed brick basement doors and rustication; no invented name lettering.
 for(const x of[-20,-16,-12,-8,-4,0,4,8,12,16,20]){const z=Math.abs(x)<8?12.64:10.65;archPane(x,.2,z,1.35,2.2);b.box(x+.92,0,z,.25,3,.2,'stone')}
 // Corner towers have paired upper arches and a real small domed crest.
 for(const x of[-15.8,15.2]){for(const xx of[x-.9,x+.9]){archPane(xx,3.6,6.36,1.35,5.7);archPane(xx,11.8,6.36,1.15,2.55)}for(const y of[9.95,11.1,15.2])b.box(x,y,6.4,4.95,.32,.55,'stone');balustrade(x,6.45,4.7,15.3);for(const xx of[x-2.1,x+2.1])b.box(xx,11.1,6.4,.38,4.1,.3,'stone');b.add(new T.ConeGeometry(.2,.9,6),'slate',x,19.15,4.05);b.box(x,19.45,4.05,.07,.65,.07,'dark')}
 // Central crest: freestanding simplified sculptural group below roof apex.
 b.box(-.6,16.65,6.8,2.8,.6,.38,'stone');b.add(new T.IcosahedronGeometry(.64,0),'stone',-.6,17.65,6.75);for(const x of[-2.2,1]){b.box(x,16.7,6.65,.4,1.05,.42,'stone');b.add(new T.IcosahedronGeometry(.23,0),'stone',x,18.0,6.65)}
 // East side: six actual arched main-storey bays facing the wraparound terrace.
 for(const z of[4.35,1.55,-1.25,-4.05,-6.85,-9.65]){const x=z>1?17.54:z<-7.25?21.66:15.77;archPane(x,3.55,z,1.8,5.7,Math.PI/2);for(const dz of[-1.15,1.15])b.box(x+.07,3.15,z+dz,.27,6.65,.25,'stone');b.box(x+.08,9.95,z,.35,.24,2.8,'stone');}
 // Rear/window rhythm stays on its physical wall planes.
 for(const [x,z,w] of [[-.6,-12.25,10.9],[-11.8,-11.44,10.6],[.5,-17.18,13.8],[16.2,-10.4,10.7]]){for(let xx=x-w/2+1.3;xx<x+w/2-1;xx+=2.8){b.box(xx,3.8,z-.06,1.5,2.5,.12,'glass');b.box(xx,3.8,z-.15,.09,2.5,.1,'frame')}b.box(x,6.65,z,w,.23,.3,'stone')}
}
