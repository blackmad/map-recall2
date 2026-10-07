import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './bookshops-station-specs.json';
import sources from './bookshops-station-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Independent original bookshop and railway-station facades within exact current BAG parents. */
export function buildBookshopsStationLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {box,add,sign}=b,s=specs.find(v=>v.id===id)!,source=sources.find(v=>v.id===id)!,a=s.surveyed.anchor,h=(90+s.surveyed.northOffsetDegrees)*Math.PI/180;
 const rings=source.parts[0].polygons[0].map(r=>r.map(([lng,lat])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));}));
 const clip=(r:T.Vector2[],axis:'x'|'y',v:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pi=more?p[axis]>=v:p[axis]<=v,qi=more?q[axis]>=v:q[axis]<=v;if(pi)out.push(p.clone());if(pi!==qi)out.push(p.clone().lerp(q,(v-p[axis])/(q[axis]-p[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(rings[0],'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const shape=(rs:T.Vector2[][])=>{const sh=new T.Shape(rs[0]);for(const r of rs.slice(1))sh.holes.push(new T.Path(r));return sh;};
 const body=(rs:T.Vector2[][],hh:number,c:C='brick')=>{if(rs[0].length<3)return;const g=new T.ExtrudeGeometry(shape(rs),{depth:hh,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,hh,0);add(g,c);};
 const plane=(rs:T.Vector2[][],y:number,c:C='slate')=>{if(rs[0].length<3)return;const g=new T.ShapeGeometry(shape(rs));g.rotateX(-Math.PI/2);g.scale(1,1,-1);const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c,0,y,0);};
 const sash=(x:number,y:number,z:number,w:number,hh:number,angle=0)=>{box(x,y,z,w+.18,hh+.18,.13,'white',angle);const dx=Math.sin(angle),dz=Math.cos(angle);box(x+dx*.1,y+.09,z+dz*.1,w,hh,.07,'glass',angle);box(x+dx*.15,y+.09,z+dz*.15,.05,hh,.05,'frame',angle);for(const yy of [y+.8,y+hh*.72])box(x+dx*.15,yy,z+dz*.15,w,.05,.05,'frame',angle);box(x,y+hh+.2,z,w+.36,.15,.25,'stone',angle);};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C,angle=0)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(angle);add(g,c,x,y,z);};
 const tri=(x:number,y:number,z:number,w:number,rise:number,c:C,angle=0)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));g.computeVertexNormals();g.rotateY(angle);add(g,c,x,y,z);};
 const ownClock=(x:number,y:number,z:number,angle=0)=>{const g=new T.CircleGeometry(.94,16);g.rotateY(angle);add(g,'stone',x,y,z);const dx=Math.sin(angle),dz=Math.cos(angle),ux=Math.cos(angle),uz=-Math.sin(angle);for(let i=0;i<12;i++){const aa=i*Math.PI/6,gg=new T.CircleGeometry(.055,6);gg.rotateY(angle);add(gg,'dark',x+ux*Math.sin(aa)*.72+dx*.05,y+Math.cos(aa)*.72,z+uz*Math.sin(aa)*.72+dz*.05);}box(x+dx*.08,y,z+dz*.08,.045,.63,.045,'dark',angle);box(x+ux*.18+dx*.08,y-.03,z+uz*.18+dz*.08,.42,.05,.045,'dark',angle);};
 const gable=(x:number,y:number,z:number,w:number,hh:number,c:C='stone',angle=0)=>{const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,hh);sh.closePath();const gg=new T.ShapeGeometry(sh);gg.rotateY(angle);add(gg,c,x,y,z);};
 // Four trapezoid roof planes join surveyed lower and upper rectangular eaves.
 const taper=(x:number,z:number,y:number,w:number,d:number,tw:number,td:number,hh:number)=>{const pts=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2],[-tw/2,hh,-td/2],[tw/2,hh,-td/2],[tw/2,hh,td/2],[-tw/2,hh,td/2]];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts.flat(),3));g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,7,6,4,6,5]);g.computeVertexNormals();add(g,'slate',x,y,z);};
 const stripAwning=(x:number,y:number,z:number,w:number,d:number,angle=0,c:C='red')=>{for(let i=0;i<8;i++){const g=new T.BoxGeometry(w/8,.055,d);g.rotateX(.3);g.rotateY(angle);add(g,c==='blue'?'blue':i%2?'white':c,x+(i-3.5)*w/8,y,z);}};
 if(id==='athenaeum'){
  // Lower attached news-shop and taller pale corner; both are parts of the same BAG parent.
  const western=region(-14,-3.15,-13,4);body([western],13.9);plane([western],13.93);const corner=region(-3.15,7,-13,4);body([corner],17.15,'stone');plane([corner],17.18);
  taper(-7.1,-4.1,13.9,12.0,15.0,10.2,9.1,3.0);
  taper(1.7,-1.7,17.15,9.9,11.0,8.0,5.1,2.1);
  // Cream horizontal stone courses and the distinctive paired pointed front / side gables.
  for(const yy of [3.6,6.8,10.1,13.4,16.9]){box(1.6,yy,3.95,10.0,.25,.27,'white');box(6.7,yy,-1.7,.28,.25,11.5,'white');}
  gable(.8,16.96,4.04,5.5,3.25);gable(6.9,16.96,-2.45,5.7,3.25,'stone',Math.PI/2);
  box(.8,20.2,4.05,.11,.65,.11,'dark');box(6.9,20.2,-2.45,.11,.65,.11,'dark');
  // Cylindrical corner oriel is above the shop glass; six facets keep its curved silhouette light.
  add(new T.CylinderGeometry(1.35,1.35,13.35,12),'white',5.39,10.18,2.82);
  for(const yy of [3.8,7.0,10.3,13.6]){arch(5.5,yy,4.22,1.72,2.55,'stone');arch(5.5,yy+.1,4.29,1.49,2.35,'glass');box(5.5,yy+.2,4.33,.06,2.18,.04,'frame');}
  add(new T.CylinderGeometry(1.25,1.25,2.05,12),'white',5.39,18.18,2.82);arch(5.5,17.38,4.16,1.36,1.7,'glass');add(new T.CylinderGeometry(1.45,1.45,.15,12),'white',5.39,19.25,2.82);
  for(const x of [-1.55,1.55])for(const yy of [3.8,7.0,10.3,13.6]){arch(x,yy,3.99,1.45,2.4,'white');arch(x,yy+.12,4.04,1.21,2.18,'glass');box(x,yy+.2,4.08,.05,2.1,.045,'frame');}
  for(const z of [-5.5,-2.4,.5])for(const yy of [3.8,7.0,10.3,13.6]){arch(6.84,yy,z,1.6,2.45,'white',Math.PI/2);arch(6.9,yy+.12,z,1.36,2.22,'glass',Math.PI/2);}
  for(const x of [-11,-7.4,-3.8])for(const yy of [3.9,7.1,10.2])sash(x,yy,3.94,2.0,2.25);
  // Two real shop fronts: red/white awnings, dark corner band, books behind panes.
  box(-3.25,.25,3.95,18.0,2.9,.11,'glass');box(-3.25,3.2,4.02,18.3,.32,.35,'dark');
  // Archived principal-front photo: dark ATHENAEUM / BOEKHANDEL letters on a
  // narrow white fascia, below the first window tier and above the awning.
  // Panel dimensions are photo-relative, not surveyed. Keep the dark corner
  // band exposed; omit the unverified news-shop words and projecting boards.
  box(.35,3.2,4.215,6.5,.32,.04,'white');
  sign('ATHENAEUM BOEKHANDEL',.35,3.245,4.246,.035,'dark',5.8,.012);
  for(const x of [-11.5,-8,-4.5,-1,2.5])box(x,.2,4.05,.12,3.0,.12,'gold');
  stripAwning(-8.0,2.7,4.83,8.6,1.75);stripAwning(1.0,2.7,4.83,8.0,1.75);
  box(6.83,.2,-1.4,.11,3.0,9.0,'glass');box(6.9,3.2,-1.4,.35,.32,9.5,'dark');
  for(let z=-5.5;z<2;z+=2.1)box(6.95,.2,z,.12,3.0,.12,'gold');
  for(let x=-12;x<4;x+=.85)box(x,.55,4.12,.53,.65,.04,x%2?'blue':'gold');
 }else if(id==='scheltema'){
  body(rings,20.9);plane(rings,20.94);
  // BAG follows the recessed ground-floor entrance; upper facade bridges above it in the current photo.
  box(-1.0,3.9,1.47,23.6,17.0,1.45,'brick');taper(-1.0,-11.0,20.9,23.7,25.2,22.0,17.0,3.4);
  // Four broad bays with two unequal stone gables, rather than generic narrow canal houses.
  for(const x of [-9.65,-3.9,1.95,7.7]){
   for(const yy of [4.2,8.4,12.6,16.8]){for(const dx of [-1.2,0,1.2])sash(x+dx,yy,2.24,.98,2.8);box(x,yy+2.95,2.22,4.45,.25,.36,'stone');}
   if(x!==1.95)box(x,.2,2.22,4.8,3.55,.12,'glass');
   else{
    // The photo shows narrow side apertures flanking an exposed recessed
    // arched entrance, not one continuous pane over the whole central bay.
    // Keep the full existing 2.7m arch sightline clear; dimensions of these
    // flanking openings/jambs are photo-relative, not surveyed measurements.
    for(const dx of [-2.0,2.0])box(x+dx,.2,2.22,.7,3.05,.12,'glass');
    for(const dx of [-1.55,1.55])box(x+dx,.12,1.47,.25,3.35,1.5,'stone');
   }
  }
  for(const x of [-12.25,-6.75,-.7,5.5,10.4]){box(x,3.8,2.18,.55,17.25,.4,'stone');box(x,18.4,2.28,1.15,.38,.5,'stone');}
  for(const x of [-9.65,1.95]){box(x,16.5,2.22,5.8,3.4,.07,'stone');gable(x,19.65,2.37,5.8,4.65);box(x,23.95,2.36,.64,.55,.45,'stone');arch(x,19.8,2.43,2.7,2.65,'white');arch(x,19.94,2.47,2.4,2.35,'glass');}
  box(-1.0,3.63,2.35,23.6,.35,.65,'stone');
  // The photographed entrance arch ends beneath the cornice/header, rather
  // than behind its lip. Preserve the neighboring lip at its existing height;
  // the central header elevation is a bounded photo-relative reconstruction.
  // Its y3.5 base clears the unchanged arch crown y3.47 and meets the upper
  // course at y3.63, beneath the existing fascia. Bay endpoints follow fascia.
  box(-6.5375,3.28,2.76,12.525,.15,.85,'stone');
  box(7.4875,3.28,2.76,6.625,.15,.85,'stone');
  box(1.95,3.5,2.76,4.45,.15,.85,'stone');
  arch(1.95,.12,.72,2.7,3.35,'stone');arch(1.95,.26,.8,2.38,3.1,'dark');box(1.95,.3,.88,.08,2.7,.1,'gold');
  // Archived Rokin 9–15 photo: the fixed white name belongs to the narrow central
  // dark fascia, above the entrance cornice. Dimensions are photo-relative;
  // keep this shallow panel below the first window tier and within its stone bay.
  box(1.95,3.64,2.645,4.45,.55,.1,'dark');
  sign('SCHELTEMA',1.95,3.695,2.706,.064,'white',3.5,.012);
  // Blue shop awnings occupy the northern bays, neighboring retail bay remains separate.
  stripAwning(-9.65,2.8,3.25,4.7,1.9,0,'blue');stripAwning(-3.9,2.8,3.25,4.7,1.9,0,'blue');
  for(let z=-21;z<0;z+=3.7)for(const yy of [4.2,8.4,12.6,16.8])sash(-13.15,yy,z,2.2,2.8,-Math.PI/2);
  for(let z=-22;z<0;z+=4.2)for(const yy of [4.2,8.4,12.6,16.8])sash(10.99,yy,z,2.2,2.8,Math.PI/2);
 }else if(id==='haarlemmermeerstation'){
  // Exact irregular lower outline and the separately clipped tall central station block.
  body(rings,3.9);plane(rings,3.93);const main=region(-5.72,17.4,-9.7,6.1);body([main],7.35);plane([main],7.38);
  taper(5.8,-.85,7.35,23.2,12.4,20.0,7.0,3.55);taper(5.8,-.85,10.9,20.0,7.0,14.2,.12,3.7);
  taper(-10.75,-1.6,3.9,10.1,11.1,8.2,5.7,3.8);
  // Pale masonry bands, round-topped door openings and paired sash windows.
  for(const yy of [.5,1.5,6.5,6.95])box(5.8,yy,4.65,23.1,.18,.26,'stone');
  for(const x of [-3.8,.65,5.75,10.8,15.3]){const ff=(x===.65||x===10.8)?6.14:x===5.75?5.55:4.65;arch(x,.65,ff,1.55,2.65,'stone');arch(x,.75,ff+.07,1.31,2.45,'dark');for(const dx of [-.65,.65])sash(x+dx,4.2,ff+.06,.92,1.95);}
  // Main entrance and its long thin canopy; real front projections receive matching dormers.
  box(5.75,3.45,6.28,3.65,.18,2.2,'dark');box(5.75,3.1,6.4,3.55,.09,2.3,'stone');
  for(const x of [.75,5.75,10.8]){const ff=x===5.75?5.55:6.14;box(x,7.15,ff-1.25,2.4,3.25,2.4,'dark');for(const dx of [-.53,.53])sash(x+dx,7.55,ff,.72,2.5);gable(x,10.4,ff+.02,2.9,.95,'white');b.gableRoof(x,10.4,ff-1.2,2.9,2.6,.95,'slate');}
  for(const x of [-3.8,15.4]){box(x,7.8,4.22,1.55,1.25,.9,'stone');sash(x,7.88,4.77,1.1,.82);gable(x,9.08,4.79,1.65,.48,'white');}
  for(const x of [1.5,10.4]){box(x,11.28,1.42,1.55,1.6,1.1,'stone');arch(x,11.35,2.03,1.13,1.36,'glass');gable(x,12.8,2.08,1.72,.63,'white');}
  for(const x of [-13.8,-10.7,-7.7])sash(x,.65,4.04,1.65,2.25);for(const x of [-12.5,-8.9]){box(x,4.25,2.1,1.7,2.5,1.4,'dark');sash(x,4.44,2.86,1.15,1.8);gable(x,6.75,2.89,2.1,.65,'white');}
  for(const z of [-5.9,-1.8,2.2])for(const yy of [.7,4.2]){sash(17.47,yy,z,1.2,2.0,Math.PI/2);box(17.42,yy-.1,z,.22,.15,2.1,'stone');}
  // Rear platform face and lower service appendage retain the original mapped setbacks.
  for(const x of [-2,3,8,13])for(const yy of [.7,4.2])sash(x,yy,-6.2,1.25,2.0,Math.PI);
  // Keep the thin entrance canopy; cached operator photos do not establish
  // a defining name panel here. Identification belongs to the map label.
 }else throw new Error(`No bookshop/station builder for ${id}`);
}
