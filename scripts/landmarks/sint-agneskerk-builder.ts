import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './sint-agneskerk-footprints.json';
type P=T.Vector2; type C=Parameters<BuildingTools['add']>[1];
/** Native surveyed BAG shells. Author axes are baked back into east/south metres. */
export function buildSintAgneskerk(_w:number,_d:number,tools:BuildingTools){
 const angle=source.localRotationDegrees*Math.PI/180,rot=new T.Matrix4().makeRotationY(angle);
 const b:BuildingTools={...tools,add(g,c,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);g.applyMatrix4(rot);tools.add(g,c);},box(x,y,z,w,h,d,c,a=0){this.add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);}};
 const clip=(poly:P[],f:(q:P)=>number)=>{const out:P[]=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=f(p),v=f(q);if(u>=-1e-8)out.push(p);if((u>=-1e-8)!==(v>=-1e-8))out.push(p.clone().lerp(q,u/(u-v)));}return out;};
 function surface(poly:P[],height:(p:P)=>number,c:C){if(poly.length<3)return;const g=upwardRoofPlane(new T.Shape(poly));const v=g.getAttribute('position');for(let i=0;i<v.count;i++)v.setY(i,height(new T.Vector2(v.getX(i),v.getZ(i))));g.computeVertexNormals();b.add(g,c);}
 function wedge(p:P,q:P,h:(v:P)=>number,base:number){const vs=[p.x,base,p.y,q.x,base,q.y,q.x,h(q),q.y,p.x,base,p.y,q.x,h(q),q.y,p.x,h(p),p.y];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.computeVertexNormals();b.add(g,'brick');}
 const ring=source.parts[0].localRing.slice(0,-1).map(q=>new T.Vector2(...q as [number,number]));
 // Split current irregular Pand at observed nave/transept/apse boundaries. The
 // parts stay within the source polygon; no opaque parcel rectangle or cap.
 function edgeX(z:number,side:number){const hits:number[]=[];for(let k=0;k<ring.length;k++){const a=ring[k],c=ring[(k+1)%ring.length];if((a.y<=z&&c.y>=z)||(c.y<=z&&a.y>=z)){if(Math.abs(c.y-a.y)<1e-7)continue;hits.push(a.x+(c.x-a.x)*(z-a.y)/(c.y-a.y));}}return side<0?Math.min(...hits):Math.max(...hits);}
 const xs=[-Infinity,-6,6,Infinity],zs=[-Infinity,-22,-13,-3,25,Infinity];
 for(let i=0;i<3;i++)for(let j=0;j<5;j++){
  const poly=clip(clip(clip(clip(ring,p=>p.x-xs[i]),p=>xs[i+1]-p.x),p=>p.y-zs[j]),p=>zs[j+1]-p.y);if(poly.length<3)continue;
  const nave=i===1&&j>=1&&j<=3,transept=j===2,apse=j===0,porch=j===4;
  const base=transept?17.6:nave?16.8:apse?(i===1?13:8.2):porch?5.8:8.2;
  b.add(openTopPrism(new T.Shape(poly),0,base),'brick');
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const pp=clip(clip(poly,p=>p.x*sx),p=>(p.y+8)*sz);if(pp.length<3)continue;
   const hn=(p:P)=>16.8+4.6*Math.max(0,1-sx*p.x/6),ht=(p:P)=>17.6+3.9*Math.max(0,1-sz*(p.y+8)/5);
   const ha=(p:P)=>i===1?13+4.5*Math.max(0,1-Math.max(Math.abs(p.x)/6,(-22-p.y)/6)):8.2+2.6*Math.max(0,1-(-22-p.y)/6);
   const hl=(p:P)=>porch?5.8+2.8*Math.max(0,1-Math.abs(p.x)/4):8.2+3.2*Math.max(0,1-(Math.abs(p.x)-6)/8);
   const candidates=nave&&transept?[[clip(pp,p=>hn(p)-ht(p)),hn],[clip(pp,p=>ht(p)-hn(p)),ht]] as const:[[pp,transept?ht:nave?hn:apse?ha:hl]] as const;
   for(const [roof,h] of candidates){if(roof.length<3)continue;surface(roof,h,'red');for(let k=0;k<roof.length;k++)wedge(roof[k],roof[(k+1)%roof.length],h,base);}
  }
 }
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:C){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();b.add(new T.ExtrudeGeometry(s,{depth:.08,bevelEnabled:false,curveSegments:10}),c,x,y,z,a);}
 function q(x:number,z:number,a:number,d:number,u=0){return [x+Math.sin(a)*d+Math.cos(a)*u,z+Math.cos(a)*d-Math.sin(a)*u];}
 function win(x:number,y:number,z:number,w:number,h:number,a=0){arch(x,y,z,w+.22,h+.17,a,'stone');const p=q(x,z,a,.1);arch(p[0],y+.07,p[1],w,h,a,'dark');const f=q(x,z,a,.20);b.box(f[0],y+.12,f[1],.07,h-w*.5,.07,'stone',a);for(let k=.9;k<h-w*.45;k+=.85)b.box(f[0],y+k,f[1],w,.06,.07,'stone',a);}
 function bar(a:T.Vector3,z:T.Vector3,r:number,c:C){const d=z.clone().sub(a),g=new T.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));const m=a.clone().add(z).multiplyScalar(.5);b.add(g,c,m.x,m.y,m.z);}
 // Upper clerestory and five lower bays on each aisle, all beyond parent walls.
 for(const side of [-1,1]){const a=side*Math.PI/2;for(const z of [1,6.2,11.4,16.6,21.8]){win(side*6.12,12,z,2.0,3.8,a);win(edgeX(z,side)+side*.09,2.5,z,2.3,4.3,a);}
  for(const z of [-11.2,-8,-4.8])win(edgeX(z,side)+side*.09,7.7,z,z===-8?2.35:1.8,z===-8?7.5:5.8,a);
  const tx=side*(side<0?12.82:14.15);b.box(tx,17.1,-8,10,.18,.18,'stone',a);b.add(new T.CircleGeometry(.92,20),'brick',tx,19.0,-8,a);b.add(new T.TorusGeometry(.99,.09,4,20),'stone',tx+side*.07,19.0,-8,a);
  for(let z=-12.3;z<-3.5;z+=.65){const g=new T.ConeGeometry(.16,.27,3);g.rotateZ(Math.PI);b.add(g,'stone',tx,16.88,z);}
  // Small diamond/frieze geometry follows the referenced south facade bands.
  for(let z=-20;z<24;z+=1.6){const x=side*6.10;const diamond=new T.BoxGeometry(.58,.58,.09);diamond.rotateZ(Math.PI/4);b.add(diamond,'stone',x,16.0,z,a);}
 }
 // West rose and original star tracery. Front wall is z24.9, above porch.
 b.add(new T.CircleGeometry(2.8,32),'dark',0,12.8,25.08);
 b.add(new T.TorusGeometry(2.9,.18,5,32),'stone',0,12.8,25.15);
 for(const phase of [Math.PI/2,-Math.PI/2]){const vs=Array.from({length:3},(_,i)=>new T.Vector3(2.5*Math.cos(phase+i*2*Math.PI/3),12.8+2.5*Math.sin(phase+i*2*Math.PI/3),25.25));for(let i=0;i<3;i++)bar(vs[i],vs[(i+1)%3],.11,'stone');}
 // Three entry doors, exposed projecting central columns, mosaic abstracted as
 // original colored tessera blocks without painted name lettering.
 for(const x of [-6.1,0,6.1]){const z=x===0?28.6:25.18;const w=x===0?2.65:1.6,h=x===0?3.4:2.6; b.box(x,.2,z,w+.38,h+.3,.16,'stone');b.box(x,.3,z+.12,w,h,.10,'dark');for(const k of [-.25,.25])b.box(x+k*w,.6,z+.20,w*.4,h-.7,.03,'frame');}
 for(const x of [-1.9,1.9]){b.add(new T.CylinderGeometry(.25,.33,4.8,10),'stone',x,2.7,28.95);b.box(x,.1,28.95,.75,.32,.7,'stone');b.box(x,4.8,28.95,.65,.32,.7,'stone');}
 arch(0,3.7,28.68,3.1,2.9,0,'gold');arch(0,3.9,28.80,2.5,2.45,0,'blue');b.add(new T.CircleGeometry(.36,12),'gold',0,5.25,28.92);b.box(0,4.0,28.91,.67,1.0,.05,'bronze');
 for(const x of [-10.5,8.5])win(x,2.3,25.13,1.9,3.6);
 // Rear apse arc windows: follow the actual surveyed perimeter rather than a
 // guessed cylinder. Only external edges, never a courtyard roof rectangle.
 for(let k=0;k<ring.length;k++){const p=ring[k],r=ring[(k+1)%ring.length],d=r.clone().sub(p),l=d.length();if(p.y>-22||r.y>-22||l<1.1)continue;const n=new T.Vector2(d.y,-d.x),mid=p.clone().lerp(r,.5);if(n.dot(mid)<0)n.negate();n.normalize();const a=Math.atan2(n.x,n.y);mid.addScaledVector(n,.1);win(mid.x,8.7,mid.y,Math.min(1.1,l*.55),2.7,a);}
 // Exact separate tower ground plan; preserve gap to church and neighbors.
 const tr=source.parts[1].localRing.slice(0,-1).map(v=>new T.Vector2(...v as [number,number]));const cx=tr.reduce((s,p)=>s+p.x,0)/tr.length,cz=tr.reduce((s,p)=>s+p.y,0)/tr.length;
 b.add(openTopPrism(new T.Shape(tr),0,31.5),'brick');surface(tr,()=>31.5,'brick');
 const tw=5.15;
 for(let face=0;face<4;face++){
  const a=face*Math.PI/2,p=q(cx,cz,a,2.78);
  for(const y of [7.8,16,23.5])win(p[0],y,p[1],.36,1.75,a);
  for(const u of [-1.5,0,1.5]){const g=q(p[0],p[1],a,0,u);win(g[0],.9,g[1],.40,1.9,a);}
  const balcony=q(cx,cz,a,3.0);b.box(balcony[0],26.0,balcony[1],1.9,.22,.8,'stone',a);b.box(balcony[0],26.65,balcony[1],1.9,.45,.2,'stone',a);
  for(const u of [-.63,0,.63]){const v=q(balcony[0],balcony[1],a,.16,u);bar(new T.Vector3(v[0]-.16*Math.cos(a),26.7,v[1]+.16*Math.sin(a)),new T.Vector3(v[0]+.16*Math.cos(a),27.0,v[1]-.16*Math.sin(a)),.025,'dark');}
  const c=q(cx,cz,a,2.86);b.add(new T.CircleGeometry(1.25,32),'dark',c[0],29.3,c[1],a);b.add(new T.TorusGeometry(1.3,.07,4,32),'stone',c[0],29.3,c[1],a);
  for(let hour=0;hour<12;hour++){const ph=hour*Math.PI/6,loc=q(c[0],c[1],a,.09,Math.sin(ph)*1.04);b.box(loc[0],29.3+Math.cos(ph)*1.04-.11,loc[1],.12,.23,.03,'gold',a);}
  const hand=q(c[0],c[1],a,.14);b.box(hand[0],29.3,hand[1],.06,.85,.04,'gold',a);const h2=q(hand[0],hand[1],a,0,.25);b.box(h2[0],29.29,h2[1],.56,.06,.04,'gold',a);
  // Three truly open arcade bays, two columns and corner piers. Arch spandrels
  // have holes; no solid parent cube behind the belfry openings.
  const bp=q(cx,cz,a,tw/2);b.box(bp[0],31.5,bp[1],tw,.28,.45,'stone',a);b.box(bp[0],35.25,bp[1],tw,.35,.42,'brick',a);
  for(const u of [-tw/2+.2,tw/2-.2]){const c=q(bp[0],bp[1],a,0,u);b.box(c[0],31.78,c[1],.42,3.47,.42,'brick',a);}
  for(const u of [-.8,.8]){const c=q(bp[0],bp[1],a,0,u);b.add(new T.CylinderGeometry(.14,.18,2.7,8),'stone',c[0],33.13,c[1]);b.box(c[0],34.45,c[1],.37,.18,.40,'stone',a);}
  for(const u of [-1.6,0,1.6]){const s=new T.Shape();s.moveTo(-.76,0);s.absarc(0,0,.76,Math.PI,0,true);s.lineTo(.76,.98);s.lineTo(-.76,.98);s.closePath();const c=q(bp[0],bp[1],a,0,u);b.add(new T.ExtrudeGeometry(s,{depth:.36,bevelEnabled:false,curveSegments:10}),'brick',c[0],34.45,c[1]-.18*Math.cos(a),a);}
 }
 const roof=[new T.Vector2(cx-2.93,cz-2.93),new T.Vector2(cx+2.93,cz-2.93),new T.Vector2(cx+2.93,cz+2.93),new T.Vector2(cx-2.93,cz+2.93)];for(let k=0;k<4;k++)surface([roof[k],roof[(k+1)%4],new T.Vector2(cx,cz)],p=>35.56+3.13*(1-Math.max(Math.abs(p.x-cx),Math.abs(p.y-cz))/2.93),'slate');
 b.add(new T.SphereGeometry(.16,8,6),'gold',cx,38.92,cz);b.box(cx,39.05,cz,.065,1.30,.065,'dark');b.box(cx,39.83,cz,.73,.065,.065,'dark');
}
