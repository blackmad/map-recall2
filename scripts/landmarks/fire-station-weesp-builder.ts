import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import src from './fire-station-weesp-footprints.json';
import lettering from './fire-station-weesp-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
export function buildFireStationWeesp(_w:number,_d:number,b:BuildingTools){
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,a=0)=>b.box(x,y,z,w,h,d,c,a);
 function face(ps:number[][],c:C,tag='shell') {const shape=ps.map(p=>new T.Vector2(p[0],p[2]));const tris=T.ShapeUtils.triangulateShape(shape,[]);const arr=tris.flatMap(t=>t.flatMap(i=>ps[i]));const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();if(tag==='roof'){const a=g.getAttribute('position');for(let i=0;i<a.count;i+=3){const u=new T.Vector3().fromBufferAttribute(a,i),v=new T.Vector3().fromBufferAttribute(a,i+1),w=new T.Vector3().fromBufferAttribute(a,i+2);if(v.clone().sub(u).cross(w.clone().sub(u)).y<0){a.setXYZ(i+1,w.x,w.y,w.z);a.setXYZ(i+2,v.x,v.y,v.z);}}g.computeVertexNormals();}g.userData={tag};b.add(g,c);}
 // Each surveyed roof boundary owns its surface; wall tops follow original survey vertices.
 for(const r of src.surveyRoofParts){const ps=r.rings[0];for(let i=0;i<ps.length;i++){const p0=ps[i],q0=ps[(i+1)%ps.length],replaceUpper=r.index===47&&[0,1,20].includes(i),p=[p0[0],replaceUpper?4.13:p0[1],p0[2]],q=[q0[0],replaceUpper?4.13:q0[1],q0[2]];const arr=[p[0],0,p[2],q[0],0,q[2],q[0],q[1],q[2],p[0],0,p[2],q[0],q[1],q[2],p[0],p[1],p[2]];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();b.add(g,r.index===44?'stone':'brick');}face(ps.slice().reverse(),r.index===44?'stone':'slate','roof');}
 function facade(p:number[],q:number[],y:number,h:number,w:number,c:C,tag='pane',offset=.095){const dx=q[0]-p[0],dz=q[1]-p[1],l=Math.hypot(dx,dz),a=Math.atan2(-dz,dx),nx=-dz/l,nz=dx/l;const x=(p[0]+q[0])/2+nx*offset,z=(p[1]+q[1])/2+nz*offset;const g=new T.BoxGeometry(w,h,.045);g.rotateY(a);g.translate(x,y+h/2,z);g.userData={tag,probe:{x,z,y,h,w,a}};b.add(g,c);return {x,z,a,l,nx,nz,dx:dx/l,dz:dz/l};}
 function framed(p:number[],q:number[],y:number,h:number,w:number,sections=3){const f=facade(p,q,y,h,w,'glass');for(let i=0;i<=sections;i++){const d=-w/2+w*i/sections;box(f.x+f.dx*d+f.nx*.04,y,f.z+f.dz*d+f.nz*.04,.085,h,.10,'white',f.a);}for(let i=0;i<=5;i++)box(f.x+f.nx*.04,y+h*i/5,f.z+f.nz*.04,w,.075,.10,'white',f.a);return f;}
 // Four photographed glazed appliance doors follow the segmented curved BAG frontage.
 const front=[[-20.74,11.41],[-15.44,12.71],[-10.49,13.58],[-4.63,14.16],[.76,14.30]];
 for(let i=0;i<4;i++){const p=front[i],q=front[i+1],l=Math.hypot(q[0]-p[0],q[1]-p[1]);const f=framed(p,q,.10,4.72,l-.86);box(f.x,.10,f.z,l-.86,.55,.10,'white',f.a);for(const d of[-l*.35,0,l*.35])box(f.x+f.dx*d+f.nx*.5,5.20,f.z+f.dz*d+f.nz*.5,.06,.06,1.35,'white',f.a);}
 // Continuous solid white canopy covers all four source-observed garage bays.
 // The curved perimeter is shared between strips, so no gaps occur at door joints.
 const canopyFront:number[][]=[],canopyRear:number[][]=[];
 for(let i=0;i<front.length;i++){const prev=front[Math.max(0,i-1)],next=front[Math.min(front.length-1,i+1)],dx=next[0]-prev[0],dz=next[1]-prev[1],l=Math.hypot(dx,dz),nx=-dz/l,nz=dx/l;canopyRear.push([front[i][0]+nx*.08,5.75,front[i][1]+nz*.08]);canopyFront.push([front[i][0]+nx*1.58,5.42,front[i][1]+nz*1.58]);}
 function quad(ps:number[][],c:C,tag:string,expectedY=0){const arr=[...ps[0],...ps[1],...ps[2],...ps[0],...ps[2],...ps[3]];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));if(expectedY){const a=g.getAttribute('position');for(let i=0;i<6;i+=3){const u=new T.Vector3().fromBufferAttribute(a,i),v=new T.Vector3().fromBufferAttribute(a,i+1),w=new T.Vector3().fromBufferAttribute(a,i+2);if(v.clone().sub(u).cross(w.clone().sub(u)).y*expectedY<0){a.setXYZ(i+1,w.x,w.y,w.z);a.setXYZ(i+2,v.x,v.y,v.z);}}}g.computeVertexNormals();g.userData={tag};b.add(g,c);}
 for(let i=0;i<4;i++){const top=[canopyRear[i],canopyRear[i+1],canopyFront[i+1],canopyFront[i]],bottom=top.map(v=>[v[0],v[1]-.11,v[2]]);quad(top,'white','canopy-top',1);quad(bottom,'white','canopy-soffit',-1);quad([top[3],top[2],bottom[2],bottom[3]],'white','canopy-fascia');if(i===0)quad([top[0],top[3],bottom[3],bottom[0]],'white','canopy-end');if(i===3)quad([top[2],top[1],bottom[1],bottom[2]],'white','canopy-end');}
 // Two timber side panels surround a true recessed trapezoid opening.
 // Source profile has a raised left shoulder clipped down to the glazing head.
 const p=[.84,15.99],q=[16.73,14.13],dx=q[0]-p[0],dz=q[1]-p[1],l=Math.hypot(dx,dz),f={x:(p[0]+q[0])/2-dz/l*.65,z:(p[1]+q[1])/2+dx/l*.65,a:Math.atan2(-dz,dx),dx:dx/l,dz:dz/l,nx:-dz/l,nz:dx/l};
 const map=(d:number,y:number,depth=0)=>[f.x+f.dx*d+f.nx*depth,y,f.z+f.dz*d+f.nz*depth];
 function verticalPolygon(ps:number[][],c:C,tag:string,depth=0){const tris=T.ShapeUtils.triangulateShape(ps.map(v=>new T.Vector2(v[0],v[1])),[]),arr=tris.flatMap(t=>t.flatMap(i=>map(ps[i][0],ps[i][1],depth)));const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();g.userData={tag};b.add(g,c);}
 const left=[[-8,4.13],[-3.8,4.13],[-3.8,4.2],[-6.3,8.73],[-8,9.65]],right=[[-.6,4.13],[8,4.13],[8,8.73],[1.3,8.73],[-.6,4.2]];
 verticalPolygon(left,'copper','timber-left');verticalPolygon(right,'copper','timber-right');
 // Vertical timber seams are clipped to each side panel; none crosses the aperture.
 for(let d=-7.95;d<=7.95;d+=.25){let top=8.73,bottom=4.14;if(d<-6.3)top=8.73+(-6.3-d)/1.7*.92;else if(d<-3.8)top=4.2+(-3.8-d)/2.5*4.53;else if(d<-.6)continue;else if(d<1.3)top=4.2+(d+.6)/1.9*4.53;box(f.x+f.dx*d+f.nx*.023,bottom,f.z+f.dz*d+f.nz*.023,.026,Math.max(0,top-bottom),.027,'stone',f.a);}
 const paneDepth=-.24,ps=[[-6.3,8.69],[-3.8,4.20],[-.6,4.20],[1.3,8.69]].map(([d,y])=>map(d,y,paneDepth));
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...ps[0],...ps[1],...ps[2],...ps[0],...ps[2],...ps[3]],3));g.computeVertexNormals();g.userData={tag:'trapezoid-pane',polyProbe:{x:f.x+f.nx*paneDepth,z:f.z+f.nz*paneDepth,a:f.a,bottomCenter:-2.2,topCenter:-2.5,bottomWidth:3.2,topWidth:7.6},recessMetres:.24};b.add(g,'glass');
 // Four real reveal planes preserve the recess instead of painting glass onto wood.
 const aperture=[[-6.3,8.73],[-3.8,4.2],[-.6,4.2],[1.3,8.73]];
 for(let i=0;i<4;i++){const a=aperture[i],b0=aperture[(i+1)%4];quad([map(a[0],a[1],0),map(b0[0],b0[1],0),map(b0[0],b0[1],paneDepth),map(a[0],a[1],paneDepth)],'frame','trapezoid-reveal');}
 for(const d of[-3.2,-2,-.8])box(f.x+f.dx*d+f.nx*(paneDepth+.055),4.22,f.z+f.dz*d+f.nz*(paneDepth+.055),.085,4.45,.08,'frame',f.a);
 for(const y of[4.2,5.45,6.65,7.85,8.69]){const t=(y-4.2)/4.49,w=3.2+t*4.4,centre=-2.2-t*.3;box(f.x+f.dx*centre+f.nx*(paneDepth+.055),y,f.z+f.dz*centre+f.nz*(paneDepth+.055),w,.07,.08,'frame',f.a);}
 // Close the raised shoulder against the surveyed roof with a supported shallow cap.
 quad([map(-8,9.65),map(-6.3,8.73),map(-6.3,8.76,-.65),map(-8,8.80,-.65)],'slate','shoulder-roof',1);
 quad([map(-8,4.13),map(-8,9.65),map(-8,8.80,-.65),map(-8,4.13,-.65)],'copper','shoulder-return');
 framed([.84,15.99],[5.90,15.78],.12,3.45,3.6,2);
 const e=facade([5.9,15.78],[10.85,15.23],.08,2.95,.97,'glass','entrance-pane');for(const d of[-.5,.5])box(e.x+e.dx*d+e.nx*.04,.08,e.z+e.dz*d+e.nz*.04,.06,2.95,.08,'frame',e.a);
 framed([10.85,15.23],[16.73,14.13],1.24,1.06,4.95,3);
 framed([17.01,12.05],[22.52,10.75],.12,3.3,3.3,2);
 // Exposed side window groups are visible in the municipal context views; rear is simplified.
 framed([-17.69,-.6],[-21.23,11.31],1.1,1.65,6.5,4);
 framed([22.52,10.76],[18.81,-1.05],1.0,1.6,5.8,3);
 framed([9.82,-16.42],[.28,-16.38],4.45,1.55,7.3,4);
 // Observed red freestanding BRANDWEER roof lettering, approximate Arial Bold curves.
 const path=new T.ShapePath();for(const v of lettering.commands as any[]){if(v.type==='M')path.moveTo(v.x,-v.y);else if(v.type==='L')path.lineTo(v.x,-v.y);else if(v.type==='Q')path.quadraticCurveTo(v.x1,-v.y1,v.x,-v.y);else if(v.type==='C')path.bezierCurveTo(v.x1,-v.y1,v.x2,-v.y2,v.x,-v.y);else if(v.type==='Z')path.currentPath?.closePath();}
 const letters=new T.ExtrudeGeometry(path.toShapes(),{depth:.028,bevelEnabled:false,curveSegments:3});letters.scale(.006,.006,1);letters.rotateY(-.17);letters.translate(-17.1,6.23,12.49);b.add(letters,'greyBrick');

}
