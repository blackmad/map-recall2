import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import data from './luther-museum-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native-metre Wittenberg parent. Surveyed roof domains are measurement
 * inputs for parametric open-top shells, not an imported source mesh. Aperture
 * proportions/trim depths are bounded photo reconstructions, not surveyed detail. */
export function buildLutherMuseum(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b;
 const outline=data.outline.map(r=>r.slice(0,-1));
 function simplify(ring:number[][]){const r=ring.map(p=>p.slice());let changed=true;while(changed&&r.length>3){changed=false;for(let i=0;i<r.length;i++){const a=r[(i+r.length-1)%r.length],p=r[i],c=r[(i+1)%r.length],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),u=((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(len*len),distance=Math.abs(dx*(p[1]-a[1])-dz*(p[0]-a[0]))/len;if(u>=0&&u<=1&&distance<.012){r.splice(i,1);changed=true;break;}}}return r;}
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 // Each measured planar roof independently owns its top. Reconstructed shells
 // share its full boundary and plane; no wall-coloured cap or blanket crest.
 for(const [i,r] of data.roofs.entries()){
  const all=r.rings.flat(),n=all.length,cx=all.reduce((s,p)=>s+p[0],0)/n,cy=all.reduce((s,p)=>s+p[1],0)/n,cz=all.reduce((s,p)=>s+p[2],0)/n;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of all){const x=p[0]-cx,z=p[2]-cz,y=p[1]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,c=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>cy+a*(x-cx)+c*(z-cz),s=shape(r.rings.map(r=>simplify(r.map(p=>[p[0],p[2]]))));
  if(i===0)add(openTopPrism(s,0,13.10),'brick');
  const wall=openTopPrism(s,i===0?13.10:0,cy),wp=wall.getAttribute('position');for(let j=0;j<wp.count;j++)if(wp.getY(j)>cy-.001)wp.setY(j,height(wp.getX(j),wp.getZ(j)));// Domain 30's ring[5]→ring[6] (duplicated by domain 2) is an internal
  // roof seam, not masonry.
  // Official LoD2.2 WallSurfaces support none of 41 edge/height samples.
  // Retain all other measured boundary walls, including court/chimney steps.
  if(i===30||i===2){const edge=[data.roofs[30].rings[0][5],data.roofs[30].rings[0][6]],values:number[]=[];let removed=0;
   const atEnd=(j:number)=>edge.some(e=>Math.hypot(wp.getX(j)-e[0],wp.getZ(j)-e[2])<.001);
   for(let j=0;j<wp.count;j+=3){if([0,1,2].every(k=>atEnd(j+k))){removed++;continue;}for(let k=0;k<3;k++)values.push(wp.getX(j+k),wp.getY(j+k),wp.getZ(j+k));}
   if(removed!==2)throw Error('Expected exactly two artificial internal seam triangles');wall.setAttribute('position',new T.Float32BufferAttribute(values,3));
  }
  wall.computeVertexNormals();wall.userData={role:'survey-domain-wall',roof:i};add(wall,i===0?'white':'brick');
  const roof=upwardRoofPlane(s),p=roof.getAttribute('position');for(let j=0;j<p.count;j++)p.setY(j,height(p.getX(j),p.getZ(j)));roof.computeVertexNormals();roof.userData={role:'roof',roof:i};add(roof,[5,6,30,35].includes(i)?'copper':'slate');
 }
 // Exact BAG ground outline (including both holes), below surveyed eaves. The
 // source roof-domain shells above retain all lower annex and chimney steps.
 const baseShell=openTopPrism(shape(outline),0,2.0);baseShell.userData={role:'bag-base'};add(baseShell,'brick');
 function facade(a:number[],c:number[],normalSign:number=1){const dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz),tx=dx/L,tz=dz/L,nx=normalSign*tz,nz=-normalSign*tx,angle=Math.atan2(nx,nz);
  function panel(u:number,y:number,w:number,h:number,d:number,colour:Colour,out=.12){const g=new T.BoxGeometry(w,h,d),ix=Array.from(g.index!.array);/* drop the faces pressed against the wall (-z) , the downward face (-y) and slivers under 0.05 m2: invisible at game range */const keep=[h*d>=.05,h*d>=.05,w*d>=.05,false,true,false];g.setIndex(ix.filter((_,k)=>keep[Math.floor(k/6)]));add(g,colour,a[0]+tx*u+nx*out,y+h/2,a[1]+tz*u+nz*out,angle);}
  function glazed(u:number,y:number,w:number,h:number,rows:number=4,cols:number=3){
   // Thin exposed glass lies in front of masonry. Surrounding frames do not
   //cover fractional pane probes; muntins are tested separately from masonry.
   const g=new T.PlaneGeometry(w,h);g.userData={role:'pane',normal:[nx,0,nz],tangent:[tx,0,tz],width:w,height:h};add(g,'glass',a[0]+tx*u+nx*.23,y+h/2,a[1]+tz*u+nz*.23,angle);
   for(const s of [-1,1]){panel(u+s*(w/2+.045),y-.08,.09,h+.16,.07,'white',.27);panel(u,y+(s===1?h:-.08),w+.18,.08,.07,'white',.27);}
   function muntin(uu:number,yy:number,ww:number,hh:number){add(new T.PlaneGeometry(ww,hh),'white',a[0]+tx*uu+nx*.30,yy+hh/2,a[1]+tz*uu+nz*.30,angle);}
   for(let k=1;k<cols;k++)muntin(u-w/2+w*k/cols,y,.042,h);
   for(let k=1;k<rows;k++)muntin(u,y+h*k/rows-.02,w,.04);
   panel(u,y-.15,w+.3,.10,.33,'stone',.22);
  }
  function door(u:number){panel(u,1.6,2.05,3.30,.1,'dark',.24);for(const s of [-1,1])panel(u+s*1.29,1.38,.40,5.0,.40,'stone',.32);panel(u,5.9,2.99,.34,.46,'stone',.34);panel(u,6.24,3.20,.22,.52,'stone',.35);glazed(u,5.0,1.93,.78,2,4);panel(u,1.6,.075,3.4,.09,'frame',.33);for(const s of [-1,1])for(const y of [1.85,3.40]){panel(u+s*.52,y,.69,1.28,.035,'bronze',.31);}
   //Six visible current stone steps, bounded to entrance approach.
   for(let k=0;k<6;k++)panel(u,k*.23,2.55+(5-k)*.12,.23,.34,'stone',.7+(5-k)*.30);
   for(const s of [-1,1]){for(const o of [.8,2.1]){const x=a[0]+tx*(u+s*1.43)+nx*o,z=a[1]+tz*(u+s*1.43)+nz*o;box(x,.1, z,.055,1.65,.055,'dark');}panel(u+s*1.43,1.7,.06,.06,1.7,'dark',1.42);panel(u+s*1.92,4.12,.17,.12,.42,'dark',.50);panel(u+s*1.92,4.28,.46,.64,.40,'white',.68);panel(u+s*1.92,4.88,.59,.10,.52,'dark',.68);panel(u+s*1.92,4.20,.56,.09,.49,'dark',.68);for(const off of [-.2,.2])panel(u+s*1.92+off,4.26,.035,.62,.43,'dark',.68);}
  }
  function cornice(y:number){panel(L/2,y,L,.22,.34,'stone',.18);panel(L/2,y+.22,L+.16,.15,.50,'white',.22);}
  return{L,tx,tz,nx,nz,panel,glazed,door,cornice,point:(u:number,out=0)=>[a[0]+tx*u+nx*out,a[1]+tz*u+nz*out]};
 }
 const f=outline[0];
 //Canal front:3+3+5+3+3bays follow actual surveyed risalits and recesses.
 const frontParts:[[number,number],number,boolean][]=[[[34,33],0,false],[[33,25],3,true],[[24,23],3,false],[[22,21],5,false],[[20,19],3,false],[[18,10],3,true],[[10,9],0,false]];
 for(const [[ia,ib],count,doors] of frontParts){const v=facade(f[ia],f[ib]);v.cornice(15.14);if(!count)continue;
  for(let k=0;k<count;k++){const u=v.L*(k+.5)/count;if(!(doors&&k===1))v.glazed(u,.48,1.55,1.07,2,4);if(doors&&k===1)v.door(u);else v.glazed(u,3.10,1.58,3.20,5,3);v.glazed(u,8.04,1.58,2.38,4,3);v.glazed(u,12.07,1.58,1.84,3,3);}
  if(doors)for(const u of [.16,v.L-.16])v.panel(u,.20,.35,14.90,.18,'brick',.21);
 }
 //Actual centre fronton with a clock; no fabricated identification lettering.
 const centre=facade(f[22],f[21]),mid=centre.L/2,base=15.50,peak=19.50,half=centre.L/2;
 const ped=new T.Shape();ped.moveTo(-half,0);ped.lineTo(half,0);ped.lineTo(0,peak-base);ped.closePath();const pos=centre.point(mid,.14);add(new T.ExtrudeGeometry(ped,{depth:.14,bevelEnabled:false}),'brick',pos[0],base,pos[1],Math.atan2(centre.nx,centre.nz));
 function beam(a:T.Vector3,c:T.Vector3,r:number,colour:Colour){const v=c.clone().sub(a),g=new T.CylinderGeometry(r,r,v.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));const mid=a.clone().add(c).multiplyScalar(.5);add(g,colour,mid.x,mid.y,mid.z);}
 for(const s of [-1,1]){const end=centre.point(mid+s*half,.30),tip=centre.point(mid,.30);beam(new T.Vector3(end[0],base,end[1]),new T.Vector3(tip[0],peak,tip[1]),.14,'stone');}
 centre.panel(mid,base-.10,centre.L+.35,.20,.45,'stone',.28);
 const cp=centre.point(mid,.37),clockY=17.25,clockR=.77,rot=Math.atan2(centre.nx,centre.nz);add(new T.CircleGeometry(clockR,24),'white',cp[0],clockY,cp[1],rot);add(new T.TorusGeometry(clockR+.04,.055,5,24),'stone',cp[0]+centre.nx*.03,clockY,cp[1]+centre.nz*.03,rot);for(let k=0;k<12;k++){const a=k*Math.PI/6;centre.panel(mid+Math.sin(a)*.60,clockY+Math.cos(a)*.60-.035,.045,.075,.045,'dark',.43);}centre.panel(mid,clockY-.04,.045,.57,.055,'dark',.45);centre.panel(mid+.17,clockY-.045,.36,.055,.055,'dark',.45);
 //Two clearly visible current canal-roof dormers: a bounded visible minimum,
 //not the historical photo's full attic count. Original pale timber boxes
 //have exposed faces and a separate upward slab owning the roof.
 const tx=.872,tz=.488,nx=.488,nz=-.872;for(const t of [-9.3,20.6]){const x=tx*t+nx*4.2,z=tz*t+nz*4.2,a=Math.atan2(nx,nz);box(x,17.25,z,1.52,2.30,1.80,'white',a);const front=[tx*t+nx*5.1,tz*t+nz*5.1],v=facade([front[0]-tx*.76,front[1]-tz*.76],[front[0]+tx*.76,front[1]+tz*.76]);v.glazed(v.L/2,17.60,.91,1.55,3,2);const ring=[[-.84,-.97],[.84,-.97],[.84,.97],[-.84,.97]].map(([xx,zz])=>new T.Vector2(x+Math.cos(a)*xx+Math.sin(a)*zz,z-Math.sin(a)*xx+Math.cos(a)*zz));add(upwardRoofPlane(new T.Shape(ring),19.55),'slate');}
 //Garden elevation and both free end walls; masonry and windows attach to
 //native edge tangents. Adjacent independent street houses are retained.
 for(const [ia,ib,n]of [[41,46,6],[47,52,5],[53,58,6],[36,41,6],[58,59,2]] as const){const v=facade(f[ia],f[ib],-1);v.cornice(15.05);for(let k=0;k<n;k++){const u=v.L*(k+.5)/n;for(const[y,h,rows]of [[.48,1.0,2],[3.1,3.2,5],[8.04,2.38,4],[12.07,1.84,3]])v.glazed(u,y,1.55,h,rows,3);}}
 //Fill remaining unobstructed end-wall runs with their observed tall rhythm.
 const east=facade(f[9],f[4],1);east.cornice(15.05);for(let k=0;k<2;k++)for(const[y,h]of [[3.1,3.2],[8.04,2.38],[12.07,1.84]])east.glazed(east.L*(k+.5)/2,y,1.52,h,4,3);
 //Inside courtyard elevations. Only clear long walls carry the restrained
 //source window rhythm; court holes remain entirely unbuilt at ground.
 for(const r of outline.slice(1))for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(L<6)continue;const v=facade(a,c,-1),n=Math.max(2,Math.round(L/3.5));for(let k=0;k<n;k++)for(const[y,h]of [[3.1,3.2],[8.04,2.38],[12.07,1.84]])v.glazed(v.L*(k+.5)/n,y,1.45,h,4,3);}
 //Later wing:three storeys, short multi-pitch roof and rounded corner tower.
 //Street-side windows: current renovation photo; no speculative party windows.
 for(const[ia,ib,n]of [[109,107,3],[106,104,3],[103,102,1],[62,68,2],[68,69,2],[75,79,3]] as const){const v=facade(f[ia],f[ib],ia<100?-1:1);v.cornice(12.85);for(let k=0;k<n;k++)for(const[y,h]of [[1.0,2.35],[5.10,2.45],[9.48,1.90]])v.glazed(v.L*(k+.5)/n,y,1.40,h,4,3);}
 //Native rounded corner of the19Cwing; photo-supported shallow pale cupola.
 const r=data.roofs[0].rings[0],centreX=73.55,centreZ=34.65;for(const y of [1.1,5.1,9.48]){const v=facade(f[91],f[89]);v.glazed(v.L*.50,y,.88,2.25,4,3);}const upperFront=facade([r[1][0],r[1][2]],[r[0][0],r[0][2]]);upperFront.glazed(upperFront.L*.5,14.02,.82,1.90,3,2);const upperWest=facade([r[1][0],r[1][2]],[r[2][0],r[2][2]],-1);upperWest.glazed(upperWest.L*.50,14.02,.82,1.90,3,2);const upperEast=facade(f[91],f[89]);upperEast.glazed(upperEast.L*.50,14.02,.78,1.90,3,2);const cap=new T.ConeGeometry(1.10,.62,4);cap.rotateY(Math.PI/4);add(cap,'copper',centreX,17.15,centreZ);
}
