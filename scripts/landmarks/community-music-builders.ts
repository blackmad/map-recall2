import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './community-music-specs.json';
import sources from './community-music-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Surveyed community cinemas and music venue; shared physical school wings remain distinct from neighboring homes. */
export function buildCommunityMusicLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {box,add,sign}=b,s=specs.find(v=>v.id===id)!,source=sources.find(v=>v.id===id)!,a=s.surveyed.anchor,h=(90+s.surveyed.northOffsetDegrees)*Math.PI/180;
 const allRings=source.parts.map(p=>p.polygons[0].map(r=>r.map(([lng,lat])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));}))),rings=allRings[0];
 const clip=(r:T.Vector2[],axis:'x'|'y',v:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pi=more?p[axis]>=v:p[axis]<=v,qi=more?q[axis]>=v:q[axis]<=v;if(pi)out.push(p.clone());if(pi!==qi)out.push(p.clone().lerp(q,(v-p[axis])/(q[axis]-p[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(rings[0],'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const shape=(rs:T.Vector2[][])=>{const sh=new T.Shape(rs[0]);for(const r of rs.slice(1))sh.holes.push(new T.Path(r));return sh;};
 const body=(rs:T.Vector2[][],hh:number,c:C='brick')=>{if(rs[0].length<3)return;const g=new T.ExtrudeGeometry(shape(rs),{depth:hh,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,hh,0);add(g,c);};
 const plane=(rs:T.Vector2[][],y:number,c:C='slate')=>{if(rs[0].length<3)return;const g=new T.ShapeGeometry(shape(rs));g.rotateX(-Math.PI/2);g.scale(1,1,-1);const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c,0,y,0);};
 const sash=(x:number,y:number,z:number,w:number,hh:number,angle=0)=>{box(x,y,z,w+.18,hh+.18,.13,'white',angle);const dx=Math.sin(angle),dz=Math.cos(angle);box(x+dx*.1,y+.09,z+dz*.1,w,hh,.07,'glass',angle);box(x+dx*.15,y+.09,z+dz*.15,.05,hh,.05,'frame',angle);for(const yy of [y+.8,y+hh*.72])box(x+dx*.15,yy,z+dz*.15,w,.05,.05,'frame',angle);box(x,y+hh+.2,z,w+.36,.15,.25,'stone',angle);};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C,angle=0)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(angle);add(g,c,x,y,z);};
 const tri=(x:number,y:number,z:number,w:number,rise:number,c:C,angle=0)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));g.computeVertexNormals();g.rotateY(angle);add(g,c,x,y,z);};
 const ownClock=(x:number,y:number,z:number,angle=0)=>{const g=new T.CircleGeometry(.94,16);g.rotateY(angle);add(g,'stone',x,y,z);const dx=Math.sin(angle),dz=Math.cos(angle),ux=Math.cos(angle),uz=-Math.sin(angle);for(let i=0;i<12;i++){const aa=i*Math.PI/6,gg=new T.CircleGeometry(.055,6);gg.rotateY(angle);add(gg,'dark',x+ux*Math.sin(aa)*.72+dx*.05,y+Math.cos(aa)*.72,z+uz*Math.sin(aa)*.72+dz*.05);}box(x+dx*.08,y,z+dz*.08,.045,.63,.045,'dark',angle);box(x+ux*.18+dx*.08,y-.03,z+uz*.18+dz*.08,.42,.05,.045,'dark',angle);};
 const gable=(x:number,y:number,z:number,w:number,hh:number,c:C='brick',angle=0)=>{const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,hh);sh.closePath();const gg=new T.ShapeGeometry(sh);gg.rotateY(angle);add(gg,c,x,y,z);};
 const crop=(r:T.Vector2[],x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(r,'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 if(id==='ot301'){
  // Individual AHN roof surfaces substantiate these unequal heights; seven mapped levels are not applied uniformly.
  body(rings,4.4);plane(rings,4.43);const tall=region(-20,-.3,-7,11),entry=region(-.3,5.96,-1.25,11),side=region(5.96,11,-2.45,11);
  body([tall],21.3);plane([tall],21.33);body([entry],14.4);plane([entry],14.43);body([side],13.0);plane([side],13.03);
  const back=region(5.96,11,-3.8,-2.45);body([back],10.4);plane([back],10.43);
  // Rooftop service room is visible in the primary current height data; modest flat parapets preserve the silhouette.
  box(-9.7,21.3,.3,4.0,2.95,9.1,'brick');box(-9.7,24.25,.3,4.15,.13,9.25,'stone');
  for(let x=-18;x<-.7;x+=2.4)for(const yy of [1.0,5.0,9.0,13.0,17.0])sash(x,yy,10.46,1.65,2.65);
  box(-9.6,20.96,10.48,19.0,.35,.34,'stone');
  // Real older three-window entrance: huge301 on timber double doors and a stone surround.
  for(const x of [.8,2.8,4.8])for(const yy of [4.6,8.0,11.25])sash(x,yy,10.62,1.3,2.3);
  box(3.0,.1,10.6,3.35,4.3,.2,'stone');box(3.0,.25,10.73,2.35,3.4,.12,'dark');box(3.0,.25,10.81,.065,3.4,.05,'stone');sign('301',3.0,2.24,10.84,.13,'white');sign('FILMACADEMIE',3.0,3.86,10.74,.035,'dark');
  box(.35,.55,10.67,1.7,1.7,.15,'dark');box(.35,.72,10.77,1.4,1.34,.03,'white');sign('OT301',.35,1.8,10.83,.047,'dark');
  for(const x of [7.1,9.0])for(const yy of [1.0,4.8,8.6])sash(x,yy,10.62,1.45,2.35);
  for(let z=-4;z<10;z+=3.4)for(const yy of [1.1,5.1,9.1,13.1,17.1])sash(-19.25,yy,z,1.6,2.65,-Math.PI/2);
  for(let z=-1.5;z<10;z+=3.4)for(const yy of [1.1,4.9,8.7])sash(10.58,yy,z,1.5,2.6,Math.PI/2);
  for(let x=-17;x< -1;x+=3.7)for(const yy of [1.1,5.1,9.1,13.1,17.1])sash(x,yy,-5.89,1.65,2.65,Math.PI);
  // Low irregular rear recess remains a separate volume, rather than a filled24m box.
 }else if(id==='cavia'){
  // Registered1913 twin schools and shared gym/service wing, all three actual BAG parents.
  body(allRings[0],13.55);plane(allRings[0],13.58);body(allRings[1],14.92);plane(allRings[1],14.95);body(allRings[2],10.12);plane(allRings[2],10.15);
  // Higher narrow classroom wings flank mapped rear recesses; original courtyards stay unbuilt.
  for(const rr of [crop(allRings[2][0],-33,-23,-31,-5),crop(allRings[2][0],4.3,14,-31,-5)]){body([rr],13.65);plane([rr],13.68);}
  // Public Works1913 elevation: tall paired classroom sashes and central door piers.
  const fronts=[{min:-30.6,max:-13.6,top:14.92},{min:-11.7,max:12.7,top:13.55}];
  for(const f of fronts){for(let x=f.min+.9;x<f.max;x+=3.4)for(const yy of [.75,4.95,9.05])sash(x,yy,11.68,2.2,3.15);box((f.min+f.max)/2,f.top-.28,11.65,f.max-f.min+1.9,.23,.42,'white');for(let x=f.min;x<f.max;x+=2.45)box(x,f.top-.72,11.67,.12,.35,.38,'stone');}
  // Current Cavia frontage has a white-painted lower wall, retained separately from the brick school beside it.
  box(.47,.1,11.61,25.85,4.55,.14,'white');
  for(const x of [-10.4,-7.0,-3.6,-.2,3.2,6.6,10.0])sash(x,.75,11.74,2.05,2.7);
  for(const x of [-20.0,8.35]){box(x,.05,11.81,2.0,3.22,.15,'dark');box(x,3.35,11.8,3.1,.24,.5,'stone');for(const dx of [-1.14,1.14])box(x+dx,.0,11.74,.17,3.35,.3,'stone');for(const dx of [-.84,-.28,.28,.84])sash(x+dx,3.85,11.75,.38,.83);}
  box(8.35,5.65,11.84,5.6,.92,.1,'dark');sign('FILMHUIS CAVIA',8.35,6.19,11.92,.057,'white');
  // Rear classroom façades face the second court; exact mapped notches prevent covering its open passage.
  for(let x=-29;x<10;x+=3.5)for(const yy of (x< -23||x>4.3)?[.8,4.7,8.55]:[.8,4.7])sash(x,yy,-30.77,2.1,2.75,Math.PI);
  for(let z=-29;z< -17;z+=3.5)for(const yy of [.8,4.7,8.55]){sash(-31.35,yy,z,2.0,2.8,-Math.PI/2);sash(11.31,yy,z,2.0,2.8,Math.PI/2);}
  for(const x of [-28.4,-15.2,10.3]){box(x,13.55,-1.5,.62,1.72,.7,'brick');box(x,15.27,-1.5,.78,.13,.86,'stone');}
  box(-28.4,14.93,7.0,.75,1.36,.86,'brick');box(-28.4,16.29,7.0,.95,.14,1.0,'stone');
 }else if(id==='orgelpark'){
  // As-built stepped periphery includes the sexton's house; the original central square church sits behind its recessed front.
  body(rings,8.65);plane(rings,8.68);const main=region(-9.94,15.57,-15.4,12.26);body([main],12.3);
  const house=region(11.1,16,12.24,17.3);body([house],11.5);plane([house],11.53);const hr=new T.BufferGeometry();hr.setAttribute('position',new T.Float32BufferAttribute([11,11.5,12.21,15.8,11.5,12.21,15.8,11.5,17.31,11,11.5,17.31,13.4,15.6,12.21,13.4,15.6,17.31],3));hr.setIndex([0,3,5,0,5,4,1,4,5,1,5,2,0,4,1,3,2,5]);hr.computeVertexNormals();add(hr,'slate');gable(13.4,11.5,17.4,4.8,4.1,'brick');
  // The steep main roof and detached slender spire are verified by detailed LoD2.2 vertices, not the misleading global max-height summary.
  const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute([-9.94,12.3,-15.55,15.7,12.3,-15.55,15.7,12.3,12.46,-9.94,12.3,12.46,4.1,26.85,-1.7],3));gg.setIndex([0,4,1,1,4,2,2,4,3,3,4,0]);gg.computeVertexNormals();add(gg,'slate');
  add(new T.CylinderGeometry(1.15,1.65,1.2,8),'slate',4.1,27.45,-1.7);add(new T.CylinderGeometry(1.13,1.13,2.15,8),'dark',4.1,29.10,-1.7);
  for(let i=0;i<8;i++){const aa=i*Math.PI/4;box(4.1+Math.sin(aa)*1.13,28.0,-1.7+Math.cos(aa)*1.13,.12,2.25,.12,'white');}
  add(new T.CylinderGeometry(1.5,1.16,.45,8),'stone',4.1,30.4,-1.7);const bulb=new T.SphereGeometry(1.38,8,5);bulb.scale(1,.67,1);add(bulb,'slate',4.1,30.92,-1.7);add(new T.ConeGeometry(.95,4.15,8),'slate',4.1,33.73,-1.7);box(4.1,35.8,-1.7,.08,.2,.08,'dark');
  // Triple central round arches, lower side arches and brick gable with stepped ornamental trim.
  gable(4.0,12.3,12.4,13.2,5.45,'brick');for(const x of [1.6,4.0,6.4]){arch(x,6.0,12.48,1.95,9.0,'stone');arch(x,6.14,12.53,1.68,8.7,'glass');for(const yy of [7.5,9.5,11.5,13.5])box(x,yy,12.59,1.7,.07,.06,'frame');box(x,6.14,12.59,.055,8.2,.055,'frame');}
  for(const x of [-1.65,9.65]){arch(x,3.25,12.43,2.05,7.95,'stone');arch(x,3.4,12.49,1.78,7.6,'glass');}
  for(const x of [-4.8,13.0])for(const yy of x<0?[1.0,4.5]:[1.0,4.5,8.0])sash(x,yy,17.35,1.65,2.25);
  for(const x of [-6.7]){const r=new T.CircleGeometry(.87,12);add(r,'stone',x,5.85,17.42);const c=new T.CircleGeometry(.67,12);add(c,'glass',x,5.85,17.46);box(x,5.2,17.5,.06,1.3,.04,'frame');box(x,5.84,17.5,1.3,.06,.04,'frame');}
  // Raised historic portal is flanked by current street-level foyer entrances; stairs stay in its5m mapped recess.
  box(4.0,2.5,12.56,3.5,3.25,.15,'stone');box(4.0,2.68,12.66,3.16,2.88,.1,'dark');
  for(let i=0;i<7;i++)box(4.0,i*.35,16.87-i*.58,4.4,.35,.65,'stone');
  for(const x of [1.6,6.4]){box(x,2.3,12.86,.57,.72,.57,'stone');add(new T.SphereGeometry(.32,8,5),'dark',x,3.23,12.86);}
  for(const x of [-.1,8.1]){box(x,.05,12.63,1.45,2.25,.1,'glass');box(x,.05,12.71,.06,2.25,.04,'gold');}sign('ORGELPARK',8.1,2.72,12.76,.047,'white');
  for(let z=-13;z<10;z+=4.2)for(const yy of [1.0,5.0,8.9])sash(15.69,yy,z,1.65,2.45,Math.PI/2);
  for(let z=-13;z<10;z+=4.2)for(const yy of [1.0,5.0,8.9])sash(-9.99,yy,z,1.65,2.45,-Math.PI/2);
 }else throw new Error(`No community music builder for ${id}`);
}
