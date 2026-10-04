import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './sloterdijk-specs.json';
import sources from './sloterdijk-footprints.json';

/** Raised, open transport hall and a separate white pronged office building. */
export function buildSloterdijkLandmark(id:string,_width:number,_depth:number,b:BuildingTools):void{
 type P=[number,number];type C=Parameters<BuildingTools['add']>[1];
 const spec=specs.find(s=>s.id===id),source=sources.find(s=>s.id===id);if(!spec||!source)throw Error('Unknown Sloterdijk asset '+id);
 const [lng,lat]=spec.surveyed.anchor;
 const local=([x,y]:number[]):P=>[(x-lng)*111320*Math.cos(lat*Math.PI/180),-(y-lat)*110540];
 const r=source.geometry.coordinates[0].map(local);r.pop();
 // Remove only centimetric redundant survey vertices, preserving the real
 // concave wing bays and the curved office entrance.
 let changed=true;while(changed&&r.length>4){changed=false;for(let i=0;i<r.length;i++){const a=r[(i+r.length-1)%r.length],p=r[i],q=r[(i+1)%r.length],l=Math.hypot(q[0]-a[0],q[1]-a[1]);if(l&&Math.abs((p[0]-a[0])*(q[1]-a[1])-(p[1]-a[1])*(q[0]-a[0]))/l<.075&&Math.hypot(p[0]-a[0],p[1]-a[1])+Math.hypot(p[0]-q[0],p[1]-q[1])<l+.075){r.splice(i,1);changed=true;break}}}
 const shape=new T.Shape(r.map(p=>new T.Vector2(...p)));
 function layer(base:number,top:number,c:C){const g=new T.ExtrudeGeometry(shape,{depth:top-base,bevelEnabled:false});g.rotateX(Math.PI/2);b.add(g,c,0,top,0)}
 function strut(a:number[],q:number[],radius:number,c:C='white'){const v=new T.Vector3(...q).sub(new T.Vector3(...a)),g=new T.CylinderGeometry(radius,radius,v.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));b.add(g,c,(a[0]+q[0])/2,(a[1]+q[1])/2,(a[2]+q[2])/2)}
 function barrel(x:number,z:number,w:number,d:number,y:number,rise:number){
  const count=8,points=Array.from({length:count+1},(_,i)=>[-w/2+w*i/count,rise*Math.sin(Math.PI*i/count)]);
  for(let i=0;i<count;i++){const a=points[i],q=points[i+1],position=[x+a[0],y+a[1],z-d/2,x+q[0],y+q[1],z-d/2,x+q[0],y+q[1],z+d/2,x+a[0],y+a[1],z+d/2];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setIndex([0,3,2,0,2,1]);g.computeVertexNormals();b.add(g,'glass');}
  for(let zz=z-d/2;zz<=z+d/2+.1;zz+=8.0)for(let i=0;i<count;i++)strut([x+points[i][0],y+points[i][1],zz],[x+points[i+1][0],y+points[i+1][1],zz],.11,'blue');
  for(const side of[-1,1]){b.box(x+side*w/2,y-3.5,z,.11,3.5,d,'glass');b.box(x+side*w/2,y-3.5,z,.18,.18,d,'white');}
 }
 if(id==='sloterdijk-station'){
  // Exact footprint is a raised concourse, not a solid box down to the tracks.
  layer(8,8.25,'stone');
  for(const x of[-43,-23,-3])for(const z of[-28,26])b.box(x,0,z,.6,8,.6,'stone');
  const hx=-34.2,hz=-3.0,hw=33.2,hd=43.0;
  b.box(hx,19.05,hz,hw,.18,hd,'slate');
  const entranceZ=-4.5,entranceWidth=9.0,west=hx-hw/2;
  for(const side of[-1,1]){
   const x=hx+side*hw/2;
   if(side===-1){
    // Main access is on Orlyplein's WEST face, not the south glass wall.
    const start=hz-hd/2,end=hz+hd/2,left=entranceZ-entranceWidth/2,right=entranceZ+entranceWidth/2;
    b.box(x,8.25,(start+left)/2,.11,10.8,left-start,'glass');
    b.box(x,8.25,(right+end)/2,.11,10.8,end-right,'glass');
    b.box(x,12.45,entranceZ,.11,6.6,entranceWidth,'glass');
   }else b.box(x,8.25,hz,.11,10.8,hd,'glass');
   b.box(hx,8.25,hz+side*hd/2,hw,10.8,.11,'glass');
   for(let z=hz-hd/2;z<=hz+hd/2+.01;z+=3.5){const portal=side===-1&&Math.abs(z-entranceZ)<entranceWidth/2;b.box(x,portal?12.45:8.25,z,.13,portal?6.6:10.8,.13,'frame')}
   for(let xx=hx-hw/2;xx<=hx+hw/2+.01;xx+=3.7)b.box(xx,8.25,hz+side*hd/2,.13,10.8,.13,'frame');
   for(const y of[8.3,12.4,15.9,19.0]){
    if(side===-1&&y<12.4){for(const[z,d]of[[(hz-hd/2+entranceZ-entranceWidth/2)/2,entranceZ-entranceWidth/2-(hz-hd/2)],[(entranceZ+entranceWidth/2+hz+hd/2)/2,hz+hd/2-(entranceZ+entranceWidth/2)]])b.box(x,y,z,.14,.14,d,'frame')}
    else b.box(x,y,hz,.14,.14,hd,'frame');
    b.box(hx,y,hz+side*hd/2,hw,.14,.14,'frame');
   }
  }
  // Original white table-space truss: open four-metre lattice legs and beams.
  const x0=-52.0,x1=-6.0,z0=-35,z1=30,lower=19.2,upper=23.4;
  for(const z of[z0,z1])for(const y of[lower,upper])strut([x0,y,z],[x1,y,z],.18);
  for(const x of[x0,x1])for(const y of[lower,upper])strut([x,y,z0],[x,y,z1],.18);
  function truss(a:P,q:P){const len=Math.hypot(q[0]-a[0],q[1]-a[1]),n=Math.ceil(len/4.2);for(let i=0;i<n;i++){const t=i/n,u=(i+1)/n,p:[number,number]=[a[0]+(q[0]-a[0])*t,a[1]+(q[1]-a[1])*t],v:[number,number]=[a[0]+(q[0]-a[0])*u,a[1]+(q[1]-a[1])*u];strut([p[0],lower,p[1]],[p[0],upper,p[1]],.12);strut([p[0],lower,p[1]],[v[0],upper,v[1]],.11);strut([p[0],upper,p[1]],[v[0],lower,v[1]],.11)}}
  truss([x0,z0],[x1,z0]);truss([x0,z1],[x1,z1]);truss([x0,z0],[x0,z1]);truss([x1,z0],[x1,z1]);
  for(const x of[x0,x1])for(const z of[z0,z1]){const foot=[x,8.25,z];for(const dx of[-1,1])for(const dz of[-1,1])strut(foot,[x+dx*2.1,lower,z+dz*2.1],.18);for(const yy of[10.4,14.8,19.2])for(const side of[-1,1]){strut([x-2.1,yy,z+side*2.1],[x+2.1,yy+4.4,z+side*2.1],.12);strut([x+2.1,yy,z+side*2.1],[x-2.1,yy+4.4,z+side*2.1],.12)}}
  // The mapped parent includes two upper platform/connecting roofs; separate
  // canopies outside it keep their original mapped identities and geometry.
  b.box(-8.5,11.0,0,13.0,.35,77,'stone');barrel(-8.5,0,13,77,16.48,1.65);
  b.box(22.5,9.3,-3,46.0,.18,9,'white');
  for(const side of[-1,1])b.box(22.5,8.25,-3+side*4.5,46,1.1,.11,'glass');
  b.box(48.0,11.0,-4.3,10.7,.35,41.3,'stone');barrel(48,-4.3,10.7,41.3,16.2,1.7);
  // Blue frames and red crash bars match the west entrance photograph.
  for(const z of[entranceZ-3,entranceZ,entranceZ+3]){
   for(const dz of[-1.12,1.12])b.box(west-.18,8.25,z+dz,.13,3.2,.14,'blue');
   b.box(west-.18,11.3,z,.13,.15,2.4,'blue');
   b.box(west-.32,9.5,z,.16,.20,2.2,'red');
  }
  b.box(west-.2,11.85,entranceZ,.35,.35,24,'white');
  // Original repo-style pixel lettering, turned to the west-facing plane.
  const glyphs:Record<string,string[]>={S:['01111','10000','10000','01110','00001','00001','11110'],L:['10000','10000','10000','10000','10000','10000','11111'],O:['01110','10001','10001','10001','10001','10001','01110'],T:['11111','00100','00100','00100','00100','00100','00100'],E:['11111','10000','10000','11110','10000','10000','11111'],R:['11110','10001','10001','11110','10100','10010','10001'],D:['11110','10001','10001','10001','10001','10001','11110'],I:['111','010','010','010','010','010','111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001']};
  const text='SLOTERDIJK',pixel=.24,total=[...text].reduce((n,ch)=>n+glyphs[ch][0].length+1,0)-1;let u=-total*pixel/2;
  for(const ch of text){const rows=glyphs[ch];for(let j=0;j<rows.length;j++)for(let k=0;k<rows[j].length;k++)if(rows[j][k]==='1')b.box(west-.4,12.3+(6-j)*pixel,entranceZ+u+k*pixel,.08,pixel*.85,pixel*.85,'white');u+=(rows[0].length+1)*pixel}

 }else{
  layer(0,36.66,'white');layer(36.66,36.85,'slate');
  const area=r.reduce((s,p,i)=>s+p[0]*r[(i+1)%r.length][1]-r[(i+1)%r.length][0]*p[1],0);
  for(let i=0;i<r.length;i++){
   const a=r[i],q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz);if(l<.9)continue;const nx=(area>0?dz:-dz)/l,nz=(area>0?-dx:dx)/l,angle=-Math.atan2(dz,dx),count=Math.max(1,Math.floor(l/3.15));
   for(let floor=0;floor<8;floor++){const y=floor?5.0+(floor-1)*4.45:1.1;for(let j=0;j<count;j++){const t=(j+.5)/count,x=a[0]+dx*t+nx*.08,z=a[1]+dz*t+nz*.08;b.box(x,y,z,1.9,floor===7?3.4:1.85,.13,'frame',angle);b.box(x+nx*.08,y+.09,z+nz*.08,1.7,floor===7?3.18:1.62,.08,'glass',angle)}}
  }
  // The measured tall central plant follows a narrow spine. It is not a
  // ninth floor across all three white wings.
  b.box(1.6,36.85,-5.2,9.0,5.25,38.0,'white');b.box(1.6,42.1,-5.2,9.4,.46,38.4,'slate');
  for(const x of[0,5.5])b.box(x,36.85,-28.0,4.4,2.75,3.0,'slate');
  // Exterior stairs are thin open flights and landing rails, not new blocks.
  for(const[x,z,angle]of[[20.6,-27.4,Math.PI/2],[-20.6,1.7,-1.268],[-14.4,29.3,-.969]]){
   const place=(dx:number,dz:number):P=>[x+dx*Math.cos(angle)+dz*Math.sin(angle),z-dx*Math.sin(angle)+dz*Math.cos(angle)];
   for(let floor=1;floor<=7;floor++){const y=5.0+(floor-1)*4.45;b.box(x,y,z,2.7,.16,3.0,'frame',angle);for(const side of[-1,1]){const p=place(side*1.28,0);b.box(p[0],y+.16,p[1],.075,1.0,3.0,'frame',angle)}const a=place(-1.1,-1.35),q=place(1.1,1.35);strut([a[0],y,a[1]],[q[0],y+4.45,q[1]],.08,'frame');for(let j=0;j<9;j++){const p=place(-1.1+2.2*j/9,-1.35+2.7*j/9);b.box(p[0],y+4.45*j/9,p[1],1.2,.11,.37,'frame',angle)}}
  }
  b.box(17.7,3.75,-6,7.0,.24,4.5,'white');b.sign('HNK',17.7,4.15,-3.65,.32,'dark');
 }
}
