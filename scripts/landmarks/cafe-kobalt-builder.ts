import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './cafe-kobalt-footprints.json';
/** Reconstructed original after temporary checkout loss; all geometry is native scale. */
export function buildCafeKobalt(_w:number,_d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];const ring=source.localRing.map(p=>new T.Vector2(...p)),a=ring[2],c=ring[6],u=c.clone().sub(a).normalize(),n=new T.Vector2(-u.y,u.x),mid=a.clone().lerp(c,.5),w=a.distanceTo(c);
 const chain=ring.slice(2,7),project=(p:T.Vector2)=>p.clone().sub(mid).dot(u);
 const point=(x:number,z:number)=>{let found:T.Vector2|undefined,exposed=-Infinity;for(let i=0;i<chain.length-1;i++){const p=chain[i],q=chain[i+1],lo=project(p),hi=project(q);if(x<Math.min(lo,hi)-1e-7||x>Math.max(lo,hi)+1e-7)continue;const r=p.clone().lerp(q,(x-lo)/(hi-lo)),out=r.dot(n);if(out>exposed){found=r;exposed=out;}}return(found??(x<0?a:c).clone()).addScaledVector(n,z);};
 const local=(p:T.Vector2)=>[p.clone().sub(mid).dot(u),p.clone().sub(mid).dot(n)];
 b.add(openTopPrism(new T.Shape(ring),0,9.75),'brick');
 function add(g:T.BufferGeometry,col:C,x=0,y=0,z=0){g.computeBoundingBox();if(col==='glass'){const size=g.boundingBox!.getSize(new T.Vector3());g.userData.facadeFacing=(size.x<size.z?u:n).toArray();}const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const q=point(x+p.getX(i),z+p.getZ(i));p.setXYZ(i,q.x,y+p.getY(i),q.y);}g.computeVertexNormals();b.add(g,col);}
 function box(x:number,y:number,z:number,ww:number,h:number,d:number,col:C){add(new T.BoxGeometry(ww,h,d),col,x,y+h/2,z);}
 function outline(points:number[][],col:C,z:number,depth:number){add(new T.ExtrudeGeometry(new T.Shape(points.map(p=>new T.Vector2(...p))),{depth,bevelEnabled:false}),col,0,0,z);}
 const profile:number[][]=[[-w/2,0],[w/2,0],[w/2,10.7]],step=w/20;
 for(let i=0;i<10;i++)profile.push([w/2-i*step,10.7+i*.81],[w/2-(i+1)*step,10.7+i*.81],[w/2-(i+1)*step,10.7+(i+1)*.81]);
 for(let i=9;i>=0;i--)profile.push([-w/2+(i+1)*step,10.7+(i+1)*.81],[-w/2+(i+1)*step,10.7+i*.81],[-w/2+i*step,10.7+i*.81]);
 outline(profile,'brick',.025,.16);for(const s of [-1,1])for(let i=0;i<10;i++)box(s*(w/2-(i+.5)*step),10.7+i*.81,.04,step+.05,.10,.24,'stone');
 const support=(id:number)=>source.surveyRoofSupport.find(p=>p.index===id)!.native;
 const ridgeRear=new T.Vector2(support(29)[0],support(29)[2]),ridgeFront=new T.Vector2(support(33)[0],support(33)[2]),axis=ridgeFront.clone().sub(ridgeRear);
 function intersect(p:T.Vector2,q:T.Vector2){const e=q.clone().sub(p),t=p.clone().sub(ridgeRear).cross(e)/axis.cross(e);return ridgeRear.clone().addScaledVector(axis,t);}
 let frontRidge:T.Vector2|undefined,frontSegment=0;for(let i=2;i<6;i++){const q=intersect(ring[i],ring[i+1]),e=ring[i+1].clone().sub(ring[i]),t=q.clone().sub(ring[i]).dot(e)/e.lengthSq();if(t>=0&&t<=1){frontRidge=q;frontSegment=i;break;}}
 if(!frontRidge)throw Error('Survey ridge does not reach Singel perimeter');const rearRidge=intersect(ring[0],ring[1]);
 function plane(ids:number[]){const [p,q,r]=ids.map(support),dx=q[0]-p[0],dz=q[2]-p[2],ex=r[0]-p[0],ez=r[2]-p[2],det=dx*ez-ex*dz,A=((q[1]-p[1])*ez-(r[1]-p[1])*dz)/det,B=(dx*(r[1]-p[1])-ex*(q[1]-p[1]))/det;return(v:T.Vector2)=>p[1]+A*(v.x-p[0])+B*(v.y-p[2]);}
 const heights=[plane([29,33,27]),plane([29,33,31])];
 const roofPolygons=[[frontRidge,...ring.slice(2,frontSegment+1).reverse(),ring[1],rearRidge],[frontRidge,...ring.slice(frontSegment+1),ring[0],rearRidge]];
 for(let side=0;side<2;side++){
  const boundary=roofPolygons[side],centre=boundary.reduce((s,p)=>s.add(p),new T.Vector2()).multiplyScalar(1/boundary.length),vertices=[centre,...boundary],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(p=>[p.x,heights[side](p),p.y]),3));const ix:number[]=[];
  for(let i=0;i<boundary.length;i++){const j=1+i,k=1+(i+1)%boundary.length,cross=boundary[i].clone().sub(centre).cross(boundary[(i+1)%boundary.length].clone().sub(centre));ix.push(...(cross<0?[0,j,k]:[0,k,j]));}g.setIndex(ix);g.computeVertexNormals();g.userData.role='roof';g.userData.side=side;b.add(g,'bronze');
  // Uncapped perimeter skirts follow measured roof planes; no wall-colored roof caps.
  for(let i=0;i<boundary.length;i++){const p=boundary[i],q=boundary[(i+1)%boundary.length];if((p===frontRidge&&q===rearRidge)||(p===rearRidge&&q===frontRidge))continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([p.x,9.75,p.y,q.x,9.75,q.y,q.x,heights[side](q),q.y,p.x,9.75,p.y,q.x,heights[side](q),q.y,p.x,heights[side](p),p.y],3));if(side===0)g.setIndex([2,1,0,5,4,3]);g.computeVertexNormals();const white=side===1&&[[6,7],[7,8],[8,9],[9,0]].some(([a,c])=>p===ring[a]&&q===ring[c]);g.userData.role='roof-wall-skirt';g.userData.sourcePart=p===rearRidge||q===rearRidge?'rear-partywall':white?'Droogbak-flank':'Singel-or-southwest';b.add(g,white?'white':'brick');}
 }
 function win(x:number,y:number,ww:number,h:number,z=.13,cols=2,rows=3){box(x,y,z,ww+.18,h+.18,.12,'white');box(x,y+.09,z+.09,ww,h,.10,'glass');for(let i=1;i<cols;i++)box(x-ww/2+i*ww/cols,y+.09,z+.16,.045,h,.04,'white');for(let j=1;j<rows;j++)box(x,y+.09+j*h/rows,z+.16,ww,.045,.04,'white');}
 function arch(x:number,y:number,ww:number,h:number,ry=.25){const r=ww/2,pts:number[][]=[];for(let i=0;i<=16;i++){const t=Math.PI*i/16;pts.push([x+r*Math.cos(t),y+h+ry*Math.sin(t)]);}for(let i=16;i>=0;i--){const t=Math.PI*i/16;pts.push([x+(r+.13)*Math.cos(t),y+h+(ry+.06)*Math.sin(t)]);}outline(pts,'stone',.22,.045);}
 for(const y of [4.35,7.35])for(const x of [-4.55,-2.65,2.65,4.55]){const paired=Math.abs(x)===2.65;win(x,y,paired?1.5:1.15,1.85,.13,paired?4:2,3);if(paired)box(x,y+.09,.32,.10,1.85,.055,'white');arch(x,y,1.5,2.05);}
 for(const x of [-3.35,3.35]){win(x,10.25,2,1.45,.13,4,2);arch(x,10.25,2.1,1.65);}for(const x of [-1.95,1.95]){win(x,13.10,.85,1.35);arch(x,13.10,1,1.5);}
 for(const y of [4.35,7.35]){box(0,y,.16,1.75,2.45,.15,'white');box(0,y+.10,.26,1.52,2.25,.08,'dark');for(let x=-.65;x<.7;x+=.22)box(x,y+.13,.315,.02,2.17,.03,'dark');}
 function shutter(x:number,y:number,h:number){const g=new T.BoxGeometry(.65,h,.12);g.userData.role='shutter';add(g,'red',x,y+h/2,.25);}
 for(const x of [-.92,.92])box(x,3.96,.20,.14,11.50,.10,'white');
 for(const y of [10.25,13.10,15.6]){win(0,y,1.5,y===15.6?1.6:2.15,.17,2,2);for(const s of [-1,1]){shutter(s*1.13,y,y===15.6?1.9:2.15);for(let j=1;j<8;j++)box(s*1.13,y+j*.25,.318,.63,.012,.018,'brick');}}
 arch(0,15.6,1.55,1.45,.65);box(0,18.05,.52,.85,.20,1.05,'stone');box(0,17.98,.70,.12,.10,1.75,'dark');
 box(0,0,.13,w,3.95,.12,'white');for(let i=0;i<16;i++){const x=-w/2+.38+i*(w-.76)/15;win(x,2.25,.48,1.30,.22,1,3);if(Math.abs(x)>1)win(x,.45,.55,1.3,.22,1,2);}box(0,0,.31,.90,2.2,.13,'dark');
 for(const s of [-1,1]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-w*.24,2.2,.38,w*.24,2.2,.38,w*.24,1.78,1.42,-w*.24,1.78,1.42],3));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();add(g,'brick',s*w*.25);box(s*w*.25,1.63,1.42,w*.47,.18,.10,'stone');}
 // Real narrow facade panel; continuous thin native sans strokes approximate its lettering.
 const actualSignPanel=new T.BoxGeometry(2.8,.28,.13);actualSignPanel.userData.role='real-sign-panel';add(actualSignPanel,'white',0,3.96,.32);const glyphs:Record<string,number[][][]>={A:[[[0,0],[.5,1],[1,0]],[[.23,.45],[.77,.45]]],F:[[[0,0],[0,1],[1,1]],[[0,.53],[.75,.53]]],E:[[[1,0],[0,0],[0,1],[1,1]],[[0,.53],[.75,.53]]],K:[[[0,0],[0,1]],[[1,1],[0,.48],[1,0]]],L:[[[0,1],[0,0],[1,0]]],T:[[[0,1],[1,1]],[[.5,1],[.5,0]]]};const oval=Array.from({length:21},(_,i)=>{const t=2*Math.PI*i/20;return[.5+.5*Math.cos(t),.5+.5*Math.sin(t)];});glyphs.O=[oval];glyphs.C=[oval.slice(3,18)];glyphs.B=[[[0,0],[0,1]],[[0,1],[.7,1],[1,.85],[1,.65],[.7,.52],[0,.52]],[[0,.52],[.8,.52],[1,.35],[1,.15],[.7,0],[0,0]]];let cursor=-1.23;for(const ch of 'CAFE KOBALT'){if(ch===' '){cursor+=.15;continue;}for(const line of glyphs[ch])for(let i=0;i<line.length-1;i++){const a=line[i],q=line[i+1],dx=(q[0]-a[0])*.14,dy=(q[1]-a[1])*.14,g=new T.BoxGeometry(Math.hypot(dx,dy),.012,.012);g.rotateZ(Math.atan2(dy,dx));g.userData.role='real-sign-letter';add(g,'red',cursor+(a[0]+q[0])*.07,3.90+(a[1]+q[1])*.07,.40);}cursor+=.24;}
 box(0,6.95,.32,.98,.45,.13,'stone');box(-.05,7.08,.42,.55,.07,.06,'dark');box(.20,7.06,.42,.06,.18,.06,'dark');add(new T.CylinderGeometry(.09,.09,.04,12).rotateX(Math.PI/2),'dark',-.26,7.04,.47);
 const sideStart=ring[6],end=ring[0],su=end.clone().sub(sideStart).normalize(),sn=new T.Vector2(-su.y,su.x),length=sideStart.distanceTo(end);
 function sideBox(t:number,y:number,ww:number,h:number,d:number,col:C){const g=new T.BoxGeometry(ww,h,d),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const q=sideStart.clone().addScaledVector(su,t+p.getX(i)).addScaledVector(sn,.035+p.getZ(i));p.setXYZ(i,q.x,y+h/2+p.getY(i),q.y);}g.computeVertexNormals();if(col==='glass')g.userData.facadeFacing=sn.toArray();b.add(g,col);}
 sideBox(length/2,0,length,9.75,.08,'white');const openings=[[1.05,.70,.95,2.55],[1.05,4.65,.95,1.95],[1.05,7.95,.72,1.25],[3.70,4.70,.85,1.60],[6,1.35,.95,2.75],[6,4.50,.92,1.75],[6,7.15,.90,1.90],[7.8,1.35,.80,2.55],[7.8,4.50,.70,1.65],[7.8,7.10,.82,1.75],[9.5,1.35,.65,2.55],[9.5,4.50,.65,1.65],[9.5,7.15,.55,1.30]];
 for(const [t,y,ww,h] of openings){sideBox(t,y,ww+.16,h+.16,.15,'stone');sideBox(t,y+.08,ww,h,.24,'glass');sideBox(t,y+.08,.045,h,.30,'white');sideBox(t,y+.08+h*.52,ww,.07,.30,'white');}
 sideBox(4.62,.20,.93,2.60,.15,'stone');sideBox(4.62,.28,.73,2.36,.25,'dark');sideBox(4.62,2.88,.86,.69,.15,'stone');sideBox(4.62,2.96,.65,.49,.25,'glass');sideBox(4.62,0,1.12,.12,.65,'slate');sideBox(4.62,.12,1.02,.12,.45,'slate');
 const depth=-local(rearRidge)[1];
 const chimney=point(w/2-.85,-depth*.38);box(w/2-.85,heights[1](chimney)-.25,-depth*.38,.50,4.1,.55,'brick');
 for(const z of [-depth*.38,-depth*.73]){const front=point(w*.31+.57,z),base=heights[1](front)+.12;box(w*.31,base-.15,z,1.1,1.65,1.35,'white');box(w*.31+.57,base,z,.08,1.15,.95,'glass');box(w*.31,base+1.50,z,1.25,.12,1.5,'slate');}
}
