import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import data from './holocaust-namenmonument-footprints.json';
type Pt=number[];
function shape(outer:Pt[],holes:Pt[][]=[]){const s=new T.Shape();outer.forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));s.closePath();for(const ring of holes){const p=new T.Path();ring.forEach(([x,z],i)=>i?p.lineTo(x,z):p.moveTo(x,z));p.closePath();s.holes.push(p);}return s;}
/** Original surveyed east/south memorial geometry; no downloaded mesh/photo pixels. */
export function buildHolocaustNamenmonument(_w:number,_d:number,b:BuildingTools){
 // A thin, native site skin; never a solid parcel block. Public interiors remain open.
 const pavement=shape(data.site);b.add(openTopPrism(pavement,0,.04),'stone');b.add(upwardRoofPlane(pavement,.04),'stone');
 function wall(a:Pt,c:Pt,width:number,height:number){
  const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),angle=Math.atan2(-dz,dx),cx=(a[0]+c[0])/2,cz=(a[1]+c[1])/2;
  b.box(cx,.04,cz,length,height,width,'ochre',angle);
  // Native geometric joints preserve the stacked memorial-brick rhythm; no invented inscriptions.
  const strip=(u:number,y:number,w:number,h:number)=>{for(const side of [-1,1]){const nx=-dz/length,nz=dx/length;const x=a[0]+dx*(u/length)+nx*side*(width/2+.002),z=a[1]+dz*(u/length)+nz*side*(width/2+.002);b.add(new T.PlaneGeometry(w,h),'brick',x,y+h/2,z,angle+(side<0?Math.PI:0));}};
  for(let y=.11;y<height;y+=.07)strip(length/2,y,length,.008);
  for(let u=.22;u<length-.03;u+=.22)strip(u,.04,.008,height);
  b.box(cx,height+.04,cz,length,.035,width+.018,'dark',angle);
 }

 function beam(a:number[],c:number[],radius=.035){const from=new T.Vector3(...a),to=new T.Vector3(...c),v=to.clone().sub(from),g=new T.CylinderGeometry(radius,radius,v.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));const mid=from.add(to).multiplyScalar(.5);b.add(g,'dark',mid.x,mid.y,mid.z);}
 function panel(a:Pt,c:Pt,ha:number,hc:number,width=.22){const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length*width/2,nz=dx/length*width/2,vs=[[a[0]-nx,.04,a[1]-nz],[c[0]-nx,.04,c[1]-nz],[c[0]+nx,.04,c[1]+nz],[a[0]+nx,.04,a[1]+nz],[a[0]-nx,ha,a[1]-nz],[c[0]-nx,hc,c[1]-nz],[c[0]+nx,hc,c[1]+nz],[a[0]+nx,ha,a[1]+nz]],faces=[0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,7,6,4,6,5,0,1,2,0,2,3],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(faces.flatMap(i=>vs[i]),3));g.computeVertexNormals();g.userData={assembly:'corten-edge-panel'};b.add(g,'bronze');}
 function ramp(a:Pt,c:Pt,width:number,outerHeight:number){const dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz),nx=-dz/length*width/2,nz=dx/length*width/2,ps=[[a[0]-nx,outerHeight,a[1]-nz],[a[0]+nx,outerHeight,a[1]+nz],[c[0]+nx,.04,c[1]+nz],[c[0]-nx,.04,c[1]-nz]],g=new T.BufferGeometry();const values:number[]=[];for(const face of [[0,1,2],[0,2,3]]){const vs=face.map(i=>new T.Vector3(...ps[i]));if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).y<0)face.reverse();for(const i of face)values.push(...ps[i]);}g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData={assembly:'accessible-approach'};b.add(g,'stone');const sides:number[]=[];for(let i=0;i<4;i++){const k=(i+1)%4,aa=ps[i],cc=ps[k],bottomA=[aa[0],.04,aa[2]],bottomC=[cc[0],.04,cc[2]];sides.push(...bottomA,...aa,...cc,...bottomA,...cc,...bottomC);}const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(sides,3));skirt.computeVertexNormals();b.add(skirt,'stone');}
 // Source principalentry: independent low step flight and open accessible approach.
 const entryA=data.site[9],entryB=data.site[8],entry=(t:number)=>entryA.map((v,i)=>v+(entryB[i]-v)*t),approach=(p:Pt)=>[p[0],p[1]-4.5];
 const rampA=entry(.11);ramp(rampA,approach(rampA),2.5,.34);
 panel(entry(.24),entry(.70),1.45,1.48,.32);
 const stairA=entry(.85),stairWidth=3.2;
 for(let i=0;i<2;i++)b.box(stairA[0],.04,stairA[1]-.42*i,stairWidth,.30-.15*i,.42,'stone');
 beam([stairA[0]-.7,.34,stairA[1]+.16],[stairA[0]-.7,1.24,stairA[1]+.16]);beam([stairA[0]-.7,.04,stairA[1]-1.00],[stairA[0]-.7,.94,stairA[1]-1.00]);beam([stairA[0]-.7,1.24,stairA[1]+.16],[stairA[0]-.7,.94,stairA[1]-1.00]);
 // Streetcurbpanel followsnativeboundary; avoids bothpublicend mouths.
 const curbA=data.site[4],curbB=data.site[5],curb=(t:number)=>curbA.map((v,i)=>v+(curbB[i]-v)*t);panel(curb(.04),curb(.96),1.15,1.45,.22);panel(data.site[5],data.site[6],1.45,1.55,.22);panel(data.site[6],data.site[7],1.55,1.55,.22);panel(data.site[7],data.site[8],1.55,1.45,.22);
 // Source Hoftuin mouth is centered on site[10]; keep the full2mflight plus0.25mlandingmargin open.
 const westStart=data.site[10],westEnd=data.site[9],westLength=Math.hypot(westEnd[0]-westStart[0],westEnd[1]-westStart[1]),mouthTrim=1.4,westAfterMouth=westStart.map((v,i)=>v+(westEnd[i]-v)*mouthTrim/westLength);
 panel(westAfterMouth,westEnd,1.15-(.05*mouthTrim/westLength),1.1,.18);
 // Hoftuin six-step sideapproach usesactualmappedstep-axis, independentlyofaccessibleends.
 const hA=data.entrances[2].a!,hB=data.entrances[2].b!,hdx=hB[0]-hA[0],hdz=hB[1]-hA[1],hLength=Math.hypot(hdx,hdz),hAngle=Math.atan2(-hdz,hdx);
 for(let i=0;i<6;i++){const t=(i+.5)/6;b.box(hA[0]+hdx*t,.04,hA[1]+hdz*t,hLength/6,.15*(i+1),2.0,'stone',hAngle);}
 for(const side of [-1,1]){const nx=-hdz/hLength,nz=hdx/hLength;beam([hA[0]+nx*side,.94,hA[1]+nz*side],[hB[0]+nx*side,1.84,hB[1]+nz*side]);for(const t of [0,1])beam([hA[0]+hdx*t+nx*side,.04+.9*t,hA[1]+hdz*t+nz*side],[hA[0]+hdx*t+nx*side,.94+.9*t,hA[1]+hdz*t+nz*side]);}
 const northA=data.site[1],northB=[northA[0]+1.5,northA[1]+4.5];ramp(northA,northB,data.entranceNotes.northWidthRepair.adoptedMetres,.34);
 for(const letter of data.letters){
  for(const w of letter.walls)wall(w.a,w.b,w.width,w.height);
  for(const support of letter.supports)b.box(support.point[0],2.505,support.point[1],.08,.095,.08,'frame');
  const s=shape(letter.outer,[letter.inner]);
  const base=2.6;
  // Source engineering elevations determine taper direction; numerical heights bounded by built max6.6m.
  const zmin=Math.min(...letter.outer.map(p=>p[1])),zmax=Math.max(...letter.outer.map(p=>p[1]));
  
  const height=(z:number,x=0)=>{
   if('steelHeightStations' in letter){const stations=letter.steelHeightStations as number[];let best=Infinity,result=base;for(let e=0;e<letter.outer.length;e++){const a=letter.outer[e],c=letter.outer[(e+1)%letter.outer.length],dx=c[0]-a[0],dz=c[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),dist=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(dist<best){best=dist;result=stations[e]+(stations[(e+1)%stations.length]-stations[e])*t;}}return result;}
   return base+4*(letter.name==='south'?(z-zmin)/(zmax-zmin):(zmax-z)/(zmax-zmin));
  };
  const shell=openTopPrism(s,base,base+1);const p=shell.getAttribute('position');
  for(let i=0;i<p.count;i++){if(p.getY(i)>base+.5)p.setY(i,height(p.getZ(i),p.getX(i)));}
  shell.computeVertexNormals();shell.userData={assembly:'steel-letter-sides',letter:letter.name};b.add(shell,'frame');
  const roof=upwardRoofPlane(s,0),rp=roof.getAttribute('position');for(let i=0;i<rp.count;i++)rp.setY(i,height(rp.getZ(i),rp.getX(i)));roof.computeVertexNormals();roof.userData={assembly:'steel-letter-top',letter:letter.name};b.add(roof,'frame');

 }
}
