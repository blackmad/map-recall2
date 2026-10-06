import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
/** Native current BAG-sized office: +Z landward, +X east; moved structure, not old pier. */
export function buildNacoHouse(_w:number,_d:number,b:BuildingTools):void {
 type C=Parameters<BuildingTools['add']>[1]; type P=[number,number,number];
 const half=3.65, end=9.5, floor=3.15,eaves=7.05;
 function beam(a:P,q:P,width:number,c:C){const delta=new T.Vector3(...q).sub(new T.Vector3(...a));const g=new T.BoxGeometry(width,delta.length(),width);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const p=new T.Vector3(...a).add(new T.Vector3(...q)).multiplyScalar(.5);b.add(g,c,p.x,p.y,p.z)}
 function surface(points:P[],c:C,role:string,up=false){const values:number[]=[];for(let i=1;i<points.length-1;i++){let a=points[0],q=points[i],r=points[i+1];if(up&&new T.Vector3(...q).sub(new T.Vector3(...a)).cross(new T.Vector3(...r).sub(new T.Vector3(...a))).y<0)[q,r]=[r,q];values.push(...a,...q,...r)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.role=role;b.add(g,c)}
 const shape=new T.Shape([new T.Vector2(-half,-end),new T.Vector2(half,-end),new T.Vector2(half,end),new T.Vector2(-half,end)]);
 b.add(openTopPrism(shape,floor,eaves),'dark');b.box(0,floor-.22,0,7.5,.22,19.2,'white');
 // Five tapered west-side concrete piers, with projecting heads; east strip leaves passage open.
 for(const z of[-8.6,-4.3,0,4.3,8.6]){const g=new T.CylinderGeometry(.47,.31,2.92,4);g.rotateY(Math.PI/4);g.userData.role='pier';b.add(g,'concrete',-3.0,1.46,z);b.box(-3,2.92,z,1.12,.23,1.05,'concrete');}
 b.box(2.65,0,0,1.7,2.93,18.6,'dark');
 for(let z=-8.8;z<9;z+=.35)b.box(3.52,.1,z,.065,2.7,.025,'slate');
 b.box(2.65,.18,9.34,1.25,2.25,.08,'glass');b.box(2.65,2.44,9.40,1.65,.15,.15,'white');
 for(const x of[1.96,3.34])b.box(x,.1,9.42,.13,2.55,.12,'white');
 // Shallow siding relief and real corner interlocking white end grain.
 for(let y=floor+.2;y<eaves;y+=.24)for(const side of[-1,1])b.box(side*(half+.025),y,0,.045,.042,18.96,'slate');
 for(let y=floor+.2;y<eaves;y+=.24)for(const x of[-half,half])for(const z of[-end,end])b.box(x,y,z,.17,.10,.28,'white');
 function window(u:number,v:number,z:number,width:number,height:number,angle=0){
  const cx=u,cy=v,cz=z;
  function local(x:number,y:number,w:number,h:number,c:C,depth:number){const geo=new T.BoxGeometry(w,h,depth);geo.translate(x,y+h/2,0);geo.rotateY(angle);geo.translate(cx,cy,cz);geo.userData.role=c==='glass'?'glazing':'window-trim';b.add(geo,c)}
  local(0,0,width,height,'glass',.075);
  for(const x of[-width/2,width/2])local(x,-.07,.10,height+.14,'white',.13);
  for(const y of[-.08,height])local(0,y,width+.18,.10,'white',.15);
  for(let x=-width/2+.63;x<width/2-.25;x+=.63)local(x,0,.065,height,'white',.12);
 }
 // Irregular groups on the long elevations: isolated rear group, linked middle, front pair.
 for(const side of[-1,1])for(const [z,width] of[[-6.9,2.4],[-1.25,2.0],[1.0,2.0],[3.1,2.0],[7.0,2.5]])window(side*(half+.10),4.35,z,width,1.75,side*Math.PI/2);
 window(0,4.42,end+.1,2.6,1.70);window(0,4.42,-end-.1,3.0,1.70,Math.PI);
 // Orange restored roof: rear hip, two slopes with a curved, projecting landward crest.
 const stations=[[-end, eaves],[-6.3,10.10],[5.6,10.10],[7.5,10.20],[9.1,10.30],[10.65,10.38]];
 for(let i=1;i<stations.length-1;i++){const [za,ya]=stations[i],[zq,yq]=stations[i+1];for(const s of[-1,1])surface([[s*3.9,eaves,za],[s*3.9,eaves,zq],[0,yq,zq],[0,ya,za]],'red','roof',true);}
 for(const s of[-1,1])surface([[s*3.9,eaves,-end],[s*3.9,eaves,-6.3],[0,10.10,-6.3]],'red','roof',true);
 surface([[-3.9,eaves,-end],[3.9,eaves,-end],[0,10.10,-6.3]],'red','roof',true);
 // Leaning triangular gable and white sawtooth bargeboards, following the actual roof plane.
 surface([[-3.65,eaves,end],[3.65,eaves,end],[0,10.38,10.65]],'dark','landward-gable');
 for(const s of[-1,1]){beam([s*3.85,eaves+.03,end],[0,10.42,10.67],.15,'white');for(let t=.05;t<1;t+=.065){const x=s*3.8*(1-t),y=eaves+(10.38-eaves)*t,z=end+1.15*t;surface([[x-.075,y,z+.06],[x+.075,y,z+.06],[x,y-.26,z+.11]],'white','sawtooth');}beam([s*3.65,eaves+.03,end],[s*3.65,eaves-.35,end+.3],.12,'white');}
 beam([0,eaves,end+.08],[0,10.38,10.74],.10,'white');
 // Timber chevrons in the gable; ornament simplified to explicit fin profile.
 for(let y=eaves+.35;y<10.1;y+=.32){const t=(y-eaves)/(10.38-eaves),width=3.5*(1-t),z=end+1.15*t+.035;for(const s of[-1,1])beam([0,y,z],[s*width,y-.22,z-.06],.035,'slate');}
 for(const s of[-1,1])for(let y=floor+.15;y<floor+.9;y+=.22){const z=end+.20;surface([[s*3.65,y,z],[s*4.12,y+.12,z],[s*3.65,y+.2,z]],'white','console');}
 // Historic panel is retained as architecture; no name lettering invented.
 for(const s of[-1,1])b.box(s*(half+.09),6.40,3.0,.08,.42,11.0,'white');
 beam([0,10.5,10.50],[0,13.50,11.85],.065,'frame');
}
