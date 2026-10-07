import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import { openTopPrism } from './house-geometry';
import source from './straat-museum-footprints.json';
/** Original, texture-free Lasloods host. Native surveyed walls/roof; never includes adjacent Scheepsbouwloods. */
export function buildStraatMuseum(_w: number, _d: number, b: BuildingTools) {
 const [lng0,lat0]=source.anchor;
 const ring=source.bag.geometry.coordinates[0].slice(0,-1).map(([lng,lat])=>new T.Vector2((lng-lng0)*111320*Math.cos(lat0*Math.PI/180),-(lat-lat0)*110540));
 const main=ring.slice(6,20),office=[ring[19],...ring.slice(0,7)];
 // Operator exterior and current municipal panoramas show grey-brown brick;
 // the shared red-brick palette made this industrial hall read as terracotta.
 b.add(openTopPrism(new T.Shape(main),0,22.58),'greyBrick');
 b.add(openTopPrism(new T.Shape(office),0,11.85),'greyBrick');
 const emit=(vertices:number[][],colour:Parameters<BuildingTools['add']>[1])=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));g.computeVertexNormals();b.add(g,colour);};
 const beam=(a:number[],q:number[],width:number,colour:Parameters<BuildingTools['add']>[1])=>{const start=new T.Vector3(...a as [number,number,number]),end=new T.Vector3(...q as [number,number,number]),delta=end.clone().sub(start),g=new T.BoxGeometry(width,width,delta.length());g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),delta.clone().normalize()));const mid=start.add(end).multiplyScalar(.5);b.add(g,colour,mid.x,mid.y,mid.z);};
 // Triangulate source outer/holes without extrapolating fitted planes. Four roof lights own their slopes.
 for(const roof of source.roofPlanes){const flat=roof.rings.flat(),outer=roof.rings[0].map(p=>new T.Vector2(p[0],p[2])),holes=roof.rings.slice(1).map(r=>r.map(p=>new T.Vector2(p[0],p[2]))),sloped=roof.semantic.b3_hellingshoek>30;
  for(const tri of T.ShapeUtils.triangulateShape(outer,holes)){let pts=tri.map(i=>flat[i]);const normal=new T.Vector3(...pts[1] as[number,number,number]).sub(new T.Vector3(...pts[0] as[number,number,number])).cross(new T.Vector3(...pts[2] as[number,number,number]).sub(new T.Vector3(...pts[0] as[number,number,number])));if(normal.y<0)pts=[pts[0],pts[2],pts[1]];emit(pts,sloped?'glass':'slate');}
  if(sloped){for(const r of roof.rings)for(let i=0;i<r.length;i++)beam(r[i],r[(i+1)%r.length],.14,'frame');
   // Regular narrow steel glazing bars interpolate between measured low/high long edges.
   const r=roof.rings[0],edges=r.map((p,i)=>({a:p,q:r[(i+1)%r.length],length:Math.hypot(r[(i+1)%r.length][0]-p[0],r[(i+1)%r.length][2]-p[2])})).sort((a,q)=>q.length-a.length);const lo=edges[0],hi=edges[1];if(lo&&hi&&lo.length>20&&hi.length>20){let ha=hi.a,hq=hi.q;if(Math.hypot(lo.a[0]-ha[0],lo.a[2]-ha[2])>Math.hypot(lo.a[0]-hq[0],lo.a[2]-hq[2]))[ha,hq]=[hq,ha];const count=Math.round(Math.min(lo.length,hi.length)/2.8);for(let i=1;i<count;i++){const u=i/count;beam(lo.a.map((v,k)=>v+(lo.q[k]-v)*u),ha.map((v,k)=>v+(hq[k]-v)*u),.085,'frame');}}}
 }
 // Measured roof-light end profiles close each raised strip; no unsupported floating crest.
 for(const end of source.roofEndWalls){const r=end.rings[0],a=new T.Vector3(...r[0] as[number,number,number]);let tangent=new T.Vector2();for(const p of r){tangent.set(p[0]-a.x,p[2]-a.z);if(tangent.length()>.01)break;}tangent.normalize();const xy=r.map(p=>new T.Vector2((p[0]-a.x)*tangent.x+(p[2]-a.z)*tangent.y,p[1]));for(const tri of T.ShapeUtils.triangulateShape(xy,[])){const v=tri.map(i=>r[i]);emit(v,'slate');emit([v[0],v[2],v[1]],'slate');}}
 // Derive all facade tangents from actual perimeter; glazing projects 0.1m beyond opaque brick.
 const area=ring.reduce((v,p,i)=>{const q=ring[(i+1)%ring.length];return v+p.x*q.y-q.x*p.y;},0),sign=Math.sign(area);
 function facade(a:T.Vector2,q:T.Vector2){const delta=q.clone().sub(a),length=delta.length(),t=delta.clone().normalize(),n=new T.Vector2(t.y,-t.x).multiplyScalar(sign),angle=-Math.atan2(t.y,t.x);return {length,point:(u:number,offset=.14)=>a.clone().addScaledVector(t,u).addScaledVector(n,offset),box:(u:number,y:number,w:number,h:number,c:Parameters<BuildingTools['box']>[6],offset=.14,d=.16)=>{const p=a.clone().addScaledVector(t,u).addScaledVector(n,offset);b.box(p.x,y,p.y,w,h,d,c,angle);}};}
 const front=facade(ring[18],ring[9]),rear=facade(ring[10],ring[14]),of=facade(ring[2],ring[3]);
 const glazing=(f:ReturnType<typeof facade>,y:number,h:number,spacing:number)=>{f.box(f.length/2,y,f.length-.3,h,'glass');for(const level of [y,y+h])f.box(f.length/2,level,f.length+.1,.18,'stone',.23,.2);const count=Math.round(f.length/spacing);for(let i=0;i<=count;i++)f.box(f.length*i/count,y,.11,h,'stone',.25,.2);};
 for(const f of [front,rear]){glazing(f,18.35,4.0,1.45);f.box(f.length/2,22.45,f.length+.35,.22,'stone',.18,.36);for(let u=3;u<f.length-2;u+=6.7){f.box(u,13.5,2.2,2.6,'dark');for(let yy=13.7;yy<16;yy+=.22)f.box(u,yy,2.15,.065,'frame',.25,.12);}}
 for(const y of [4.8,8.2])glazing(of,y,2.75,1.8);for(const y of [4.35,7.6])of.box(of.length/2,y,of.length,.55,'blue',.21,.18);of.box(of.length/2,11.7,of.length+.35,.3,'stone',.2,.45);
 // Blue original office ground-level door banks; no invented building-name lettering.
 for(let u=3;u<of.length-1;u+=2.55){of.box(u,.15,2.35,3.85,'blue');of.box(u,3.4,2.1,.48,'glass',.25,.1);for(const du of [-1.2,1.2])of.box(u+du,.1,.08,4.05,'frame',.3,.1);}
 const entry=facade(ring[0],ring[2]);entry.box(entry.length*.6,0,1.7,3.0,'blue');entry.box(entry.length*.6,2.6,1.7,.3,'stone',.24,.1);
 // Operator-share exterior shows a narrow glazed group on each office floor
 // above its short-side entrance. Aperture dimensions are photo estimates,
 // not surveyed pane coordinates; preserve these visible groups beside mural.
 const sideWindow=entry.length*.6;
 for(const y of [4.8,8.2]){entry.box(sideWindow,y,2.1,2.75,'glass',.25,.12);for(const du of [-1.1,0,1.1])entry.box(sideWindow+du,y-.05,.1,2.85,'stone',.34,.12);for(const level of [y-.05,y+1.37,y+2.8])entry.box(sideWindow,level,2.3,.1,'stone',.34,.12);}
 // Long blank industrial sides retain sparse square cross windows and blue loading portals.
 for(const [a,q] of [[ring[14],ring[18]],[ring[9],ring[10]]] as [T.Vector2,T.Vector2][]){const f=facade(a,q);for(let u=8;u<f.length-4;u+=9.6){f.box(u,4.1,2.4,2.65,'glass');for(const du of [-1.27,0,1.27])f.box(u+du,4.02,.13,2.85,'white',.27,.2);for(const y of [4.02,5.35,6.8])f.box(u,y,2.66,.13,'white',.27,.2);}const door=f.length*.62;f.box(door,0,8.1,10.8,'blue');for(const du of [-4.15,0,4.15])f.box(door+du,0,.15,11,'frame',.26,.15);for(let u=0;u<f.length;u+=17.5)f.box(u,0,.14,22.6,'frame',.14,.16);}
 // Restrained original flat-color interpretation of the source mural: colored facets, hair, eyes and smile.
 // No photograph pixels, downloaded artwork geometry or invented painted name words.
 const mf=front,centre=8.0,width=10.3,bottom=4.2,height=18.15;
 mf.box(centre,bottom,width,height,'pink',.34,.10);
 const patch=(points:number[][],c:Parameters<BuildingTools['add']>[1],depth=.43)=>{const xy=points.map(p=>new T.Vector2(p[0],p[1]));const flat=T.ShapeUtils.triangulateShape(xy,[]);for(const tri of flat){const v=tri.map(i=>{const p=mf.point(centre+points[i][0],depth);return[p.x,bottom+points[i][1],p.y]});emit(v,c);emit([v[0],v[2],v[1]],c);}};
 patch([[-4.7,0],[-4,7],[0,9],[4,6],[4.9,0]],'red');patch([[-3.5,5],[-3.7,12],[-2.5,15.2],[1.7,15.4],[3.4,12.4],[3.1,7.5],[.5,3.9]],'stone');
 const colours:Parameters<BuildingTools['add']>[1][]=['blue','gold','green','pink','ochre'];for(let i=0;i<5;i++){const x=-3.45+i*1.3;patch([[x,7],[x+.9,6.0],[x+1.25,13.5],[x+.1,14.5]],colours[i],.46);}patch([[-4,11.4],[-4.5,14.3],[-3.4,16.3],[-.8,17.5],[2.8,16.5],[4.0,13.9],[3.4,11.5],[2.2,14],[-2.0,14.8]],'dark',.50);
 for(const x of [-1.9,1.9]){patch([[x-1,11.2],[x,11.75],[x+1,11.2],[x,10.75]],'white',.53);patch([[x-.38,11.15],[x,11.6],[x+.38,11.15],[x,10.9]],'dark',.56);patch([[x-.8,12.1],[x+.5,12.5],[x+1,12.05],[x-.9,11.8]],'dark',.54);}
 patch([[-1.8,8.2],[-.8,7.5],[1,7.3],[2,8.1],[1,6.5],[-.2,6.2],[-1.3,6.8]],'dark',.56);patch([[-1.3,7.9],[1.6,7.8],[.9,7.1],[-.7,7.2]],'white',.59);
 // The mural's pale original ground portal is attached to its own panel and physically exposed.
 mf.box(centre,0,width,4.15,'glass',.38,.12);for(const u of [centre-width/2,centre,centre+width/2])mf.box(u,0,.15,4.25,'frame',.50,.15);mf.box(centre,4.1,width,.15,'frame',.50,.15);
}
