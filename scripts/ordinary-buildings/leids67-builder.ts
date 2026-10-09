import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {upwardRoofPlane} from '../landmarks/house-geometry';
import {nativeRoofEnvelope,roofStepSupport} from './roof-step-support.mjs';
import spec from './leids67-spec.json';
import lettering from './leids67-lettering.json';
export const probes:any[]=[];
export function buildLeids67(_w:number,_d:number,b:BuildingTools){
 probes.length=0;
 const add=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const regions=spec.roofs.map(r=>({sourceRegionIndex:r.surface,ring:r.ring.map(([x,z])=>[x,r.plane[0]*x+r.plane[1]*z+r.plane[2],z])}));
 for(const r of spec.roofs){const s=new T.Shape(r.ring.map(p=>new T.Vector2(...p as[number,number]))),g=upwardRoofPlane(s),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,r.plane[0]*p.getX(i)+r.plane[1]*p.getZ(i)+r.plane[2]);g.computeVertexNormals();g.userData.roof=r.surface;add(g,'roof');}
 const envelope=nativeRoofEnvelope(regions,spec.nativeRing,spec.nativeRing.map((_,i)=>i),'brick',{boundedHeights:true});for(const p of envelope.groups)add(p.geometry,p.color);
 const steps=roofStepSupport(regions,spec.nativeRing,{intervalMetres:1,adjacencyToleranceMetres:.15,color:'brick'});for(const p of steps.groups)add(p.geometry,p.color);
 // Quantized installed native edges can lie outside strict survey rings.
 // Close only uncovered perimeter intervals using their closest bounded
 // survey boundary ownership; never extrude a parcel or cap a notch.
 const ownership:any[]=[];
 const closest=(r:typeof spec.roofs[number],pt:number[])=>{let best={distance:Infinity,height:0};for(let i=0;i<r.ring.length;i++){const a=r.ring[i],q=r.ring[(i+1)%r.ring.length],dx=q[0]-a[0],dz=q[1]-a[1],f=Math.max(0,Math.min(1,((pt[0]-a[0])*dx+(pt[1]-a[1])*dz)/(dx*dx+dz*dz))),distance=Math.hypot(pt[0]-a[0]-f*dx,pt[1]-a[1]-f*dz);if(distance<best.distance)best={distance,height:r.surveyHeights[i]+f*(r.surveyHeights[(i+1)%r.ring.length]-r.surveyHeights[i])};}return best;};
 for(let edge=0;edge<spec.nativeRing.length;edge++){const a=spec.nativeRing[edge],q=spec.nativeRing[(edge+1)%spec.nativeRing.length],dx=q[0]-a[0],dz=q[1]-a[1],L=Math.hypot(dx,dz),t=[dx/L,dz/L],n=[-t[1],t[0]],coverage=envelope.report.filter(r=>r.nativeEdge===edge).map(r=>r.planInterval.map(p=>(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1]));const intervals=Math.ceil(L/.2);for(let i=0;i<intervals;i++){const u0=L*i/intervals,u1=L*(i+1)/intervals,mid=(u0+u1)/2;if(coverage.some(c=>mid>=Math.min(...c)-.001&&mid<=Math.max(...c)+.001))continue;const pt=[a[0]+t[0]*mid,a[1]+t[1]*mid],near=spec.roofs.map(r=>({r,...closest(r,pt)})).sort((a,b)=>a.distance-b.distance),nearest=near[0];if(nearest.distance>1.0)throw Error('Unresolved native boundary ownership edge'+edge+' at'+mid);const owner=near.filter(r=>r.distance<=nearest.distance+.035).sort((a,b)=>b.height-a.height)[0],p0=[a[0]+t[0]*u0,a[1]+t[1]*u0],p1=[a[0]+t[0]*u1,a[1]+t[1]*u1],h0=closest(owner.r,p0).height,h1=closest(owner.r,p1).height,points=[[p0[0]+n[0]*.018,0,p0[1]+n[1]*.018],[p1[0]+n[0]*.018,0,p1[1]+n[1]*.018],[p1[0]+n[0]*.018,h1,p1[1]+n[1]*.018],[p0[0]+n[0]*.018,h0,p0[1]+n[1]*.018]],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>points[i]),3));g.computeVertexNormals();g.userData.boundaryClosure={edge,sourceOwner:owner.r.surface,sourceDistance:owner.distance,heightRange:[h0,h1]};add(g,'brick');ownership.push(g.userData.boundaryClosure);}}
 const area=spec.nativeRing.reduce((s,p,i)=>s+p[0]*spec.nativeRing[(i+1)%spec.nativeRing.length][1]-p[1]*spec.nativeRing[(i+1)%spec.nativeRing.length][0],0);
 function facade(start:number,end:number){const a=spec.nativeRing[start],q=spec.nativeRing[end],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L],sign=area>0?1:-1,n=[sign*t[1],-sign*t[0]],angle=Math.atan2(-t[1],t[0]);
  const point=(u:number,y:number,d:number)=>[a[0]+t[0]*u+n[0]*d,y,a[1]+t[1]*u+n[1]*d];
  const box=(u:number,y:number,w:number,h:number,c:string,d=.1,depth=.09)=>{add(new T.BoxGeometry(w,h,depth),c,...point(u,y+h/2,d) as[number,number,number],angle);};
  const panel=(u:number,y:number,w:number,h:number,c:string,d=.12)=>box(u,y,w,h,c,d,.024);
  const probe=(label:string,u:number,y:number,d:number,c='glass')=>probes.push({label,point:point(u,y,d),normal:[n[0],0,n[1]],colour:c});
  function window(label:string,u:number,y:number,w:number,h:number,rows=2,cols=2,d=.15){panel(u,y,w+.13,h+.13,'white',d);panel(u,y+.065,w,h,'glass',d+.022);for(let i=1;i<cols;i++)panel(u-w/2+w*i/cols,y+.065,.045,h,'white',d+.05);for(let i=1;i<rows;i++)panel(u,y+.065+h*(label.startsWith('leids-broad')?([.56,.81][i-1]):i/rows),w,.047,'white',d+.05);probe(label,u-w*.33,y+h*.37,d+.04);}
  function quad(points:number[][],c:string,d=.12){const ids=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(...p as[number,number])),[]),xyz=points.map(p=>point(p[0],p[1],d));const vals=ids.flatMap(tr=>{const v=tr.map(i=>new T.Vector3(...xyz[i] as[number,number,number]));if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).dot(new T.Vector3(n[0],0,n[1]))<0)tr.reverse();return tr.flatMap(i=>xyz[i]);});const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vals,3));g.computeVertexNormals();add(g,c);}
  return{L,panel,box,window,quad,point,probe};
 }
 const l=facade(9,0),pier=3.05,wide=l.L-pier;
 // Actual current solid street assembly, independent of survey quantization.
 l.quad([[0,0],[wide,0],[wide,20.68],[0,20.68]],'brick',.065);
 l.quad([[wide,0],[l.L,0],[l.L,23.40],[wide,23.40]],'brick',.065);
 for(const u of[.16,wide/2,wide-.12])for(const y of[7.4,13.25,19.85])l.probe('leids-masonry-'+u+'-'+y,u,y,.07,'brick');
 for(const y of[6.8,10.2,15.6,20.0,23.1])l.probe('leids-pier-masonry-'+y,wide+pier/2,y,.07,'brick');
 // Present broad Roobol-derived front: two horizontal glazing tiers; the
 // lost pointed 1926 entrance and historic lettering are not reinstated.
 l.panel(l.L/2,.04,l.L,6.40,'dark',.09);
 // Current closed shutter: original metal grid/slats, not copied pixels.
 const shutterW=wide-.62,u=wide/2;
 l.panel(u,.48,shutterW+.19,5.02,'stone',.16);l.panel(u,.56,shutterW,4.85,'glass',.19);
 l.panel(u,3.25,shutterW,2.16,'stone',.225);
 for(let y=.59;y<3.24;y+=.145)l.box(u,y,shutterW,.050,'stone',.235,.034);
 for(let j=1;j<25;j++)l.box(u-shutterW/2+shutterW*j/25,.56,.050,2.69,'stone',.235,.034);
 for(let y=3.36;y<5.41;y+=.145)l.box(u,y,shutterW,.027,'grey',.244,.024);
 l.probe('leids-shop-shutter-grille',u-shutterW/2+shutterW*2.5/25,1.265,.20);
 l.panel(wide*.60,5.62,wide*.74,.72,'dark',.18);
 l.window('leids-stair-entry',wide+pier*.5,.12,1.75,3.75,1,1,.19);
 for(const y of[8.45,14.3]){l.window('leids-broad-'+y,wide/2,y,wide-.60,4.15,3,6,.18);l.box(wide/2,y-.14,wide-.35,.17,'dark',.20,.30);}
 for(const y of[7.2,11.9,17.2,21.0])l.window('leids-stair-'+y,wide+pier*.50,y,1.43,1.85,1,2,.18);
 l.box(wide/2,20.60,wide,.17,'stone',.15,.22);
 // Kerkstraat surviving joined front: two neck gables, six axes on each
 // of two upper tiers, plus the pale seven-group multipane lower assembly.
 const k=facade(6,7),pitch=k.L/6;
 k.quad([[0,0],[k.L,0],[k.L,12.82],[0,12.82]],'brick',.065);
 for(let i=0;i<6;i++)for(const y of[7.25,10.10,12.66])k.probe('kerk-masonry-'+i+'-'+y,(i+.5)*pitch,y,.07,'brick');
 for(let i=1;i<6;i++)for(const y of[8.6,11.5])k.probe('kerk-masonry-interaxis-'+i+'-'+y,i*pitch,y,.07,'brick');
 k.panel(k.L/2,.04,k.L,3.25,'grey',.08);
 k.window('kerk-ground-display',k.L*.27,.48,k.L*.49,2.1,1,2,.16);
 k.panel(k.L*.68,.15,1.33,2.85,'grey',.17);
 k.panel(k.L*.68,.20,1.11,2.60,'dark',.21);
 k.probe('kerk-club-door',k.L*.68,1.1,.225,'dark');
 k.panel(k.L-.62,.16,1.03,2.75,'dark',.17);k.box(k.L-.62,2.65,1.1,.09,'grey',.21);
 const lowerPitch=k.L/7;for(let i=0;i<7;i++){const u=(i+.5)*lowerPitch;k.window('kerk-lower-'+i,u,3.75,lowerPitch-.15,2.9,4,2,.18);if([1,4].includes(i)){k.panel(u,5.54,lowerPitch-.15,1.11,'dark',.24);k.box(u,5.49,lowerPitch-.07,.055,'white',.27);}}
 for(let i=0;i<6;i++)for(const y of[7.8,10.55])k.window('kerk-upper-'+i+'-'+y,(i+.5)*pitch,y,.95,1.87,2,2,.14);
 for(const y of[3.26,6.86]){k.box(k.L/2,y,k.L,.16,'white',.23,.23);k.box(k.L/2,y+.19,k.L,.11,'stone',.20,.32);}
 // Two continuous original sculpted profiles on the observed wall plane.
 for(const centre of[k.L*.25,k.L*.75]){const w=k.L*.5-.07,y=12.8,top=15.55;
  const outline=[[centre-w/2,y],[centre+w/2,y],[centre+w/2,y+.28],[centre+w*.36,y+.36],[centre+w*.23,y+.82],[centre+w*.18,14.6],[centre+w*.12,15.17],[centre+w*.12,top],[centre-w*.12,top],[centre-w*.12,15.17],[centre-w*.18,14.6],[centre-w*.23,y+.82],[centre-w*.36,y+.36],[centre-w/2,y+.28]];
  k.quad(outline,'brick',.07);
  // Pale shoulder caps and crown outline follow the neck profile.
  for(const [u,yy,ww]of[[centre-w*.43,13.02,w*.16],[centre+w*.43,13.02,w*.16],[centre,15.50,w*.30]])k.box(u,yy,ww,.14,'stone',.17,.20);
  k.window('kerk-gable-'+centre,centre,13.30,.64,.9,1,1,.19);
  k.box(centre,14.85,.15,.18,'dark',.48,.85);k.box(centre,14.35,.14,.63,'dark',.14,.15);
 }
 // Real source-supported horizontal CHURCH blade sign; font outline holes
 // and curves retained, two wall-perpendicular faces. No other name words.
 const ka=spec.nativeRing[6],kq=spec.nativeRing[7],kt=[(kq[0]-ka[0])/k.L,(kq[1]-ka[1])/k.L],kn=[-kt[1],kt[0]],su=k.L-.18,sd=.86,sy=3.73;
 k.box(su,sy,.105,.85,'dark',sd,1.48);
 for(const yy of[sy+.1,sy+.72])k.box(su,yy,.12,.045,'dark',.28,.48);
 const text=lettering.text,glyphs=lettering.glyphs as Record<string,{advance:number;commands:any[]}>,gap=35,total=[...text].reduce((v,c)=>v+glyphs[c].advance+gap,0)-gap;
 for(const side of[-1,1]){let cursor=0;for(const ch of text){const path=new T.ShapePath();for(const c of glyphs[ch].commands){if(c.type==='M')path.moveTo(c.x,c.y);else if(c.type==='L')path.lineTo(c.x,c.y);else if(c.type==='Q')path.quadraticCurveTo(c.x1,c.y1,c.x,c.y);else if(c.type==='C')path.bezierCurveTo(c.x1,c.y1,c.x2,c.y2,c.x,c.y);else path.currentPath.closePath();}
  const g=new T.ShapeGeometry(path.toShapes(false),4),v=g.getAttribute('position');g.computeBoundingBox();const bb=g.boundingBox!,cap=bb.max.y;
  for(let i=0;i<v.count;i++){const d=sd+side*((cursor+v.getX(i))/total*1.19-.595),y=sy+.21+v.getY(i)/cap*.43;v.setXYZ(i,ka[0]+kt[0]*(su+side*.065)+kn[0]*d,y,ka[1]+kt[1]*(su+side*.065)+kn[1]*d);}
  const ix=g.index!;g.computeVertexNormals();const want=new T.Vector3(kt[0]*side,0,kt[1]*side);if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(want)<0){for(let i=0;i<ix.count;i+=3){const j=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,j);}g.computeVertexNormals();}g.userData.signLetter={letter:ch,side};add(g,'white');const centroid=new T.Vector3();for(let j=0;j<3;j++)centroid.add(new T.Vector3().fromBufferAttribute(v,ix.getX(j)));centroid.divideScalar(3);probes.push({label:'CHURCH-blade-'+ch+'-'+cursor+'-'+side,point:centroid.toArray(),normal:want.toArray(),colour:'white'});
  cursor+=glyphs[ch].advance+gap;
 }}

}
