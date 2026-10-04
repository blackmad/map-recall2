import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './canal-museum-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];

/** Original canal museums, with surveyed houses, light courts and public alley. */
export function buildCanalMuseumLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box,sign}=b,s=data.sites.find(s=>s.id===id)!,heading=s.authorHeadingDegrees*Math.PI/180;
 const point=(p:number[])=>{const e=(p[0]-s.anchor[0])*111320*Math.cos(s.anchor[1]*Math.PI/180),n=(p[1]-s.anchor[1])*110540;return new T.Vector2(e*Math.sin(heading)+n*Math.cos(heading),e*Math.cos(heading)-n*Math.sin(heading));};
 const polygons=s.buildings.map(f=>f.geometry.coordinates.map(p=>p.map(r=>r.slice(0,-1).map(point))));
 function geometry(v:number[],c:Colour){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,c);}
 function pane(x:number,y:number,z:number,w:number,h:number,a=0,c:Colour='white',modern=false){const nx=Math.sin(a),nz=Math.cos(a);add(new T.PlaneGeometry(w+.2,h+.2),modern?'dark':c,x,y+h/2,z,a);add(new T.PlaneGeometry(w,h),'glass',x+nx*.035,y+h/2,z+nz*.035,a);if(!modern){for(let u of [-w/2,0,w/2])box(x+u*Math.cos(a)+nx*.08,y,z-u*Math.sin(a)+nz*.08,.08,h,.1,c,a);for(let v=.7;v<h;v+=.85)box(x+nx*.08,y+v,z+nz*.08,w,.065,.1,c,a);}}
 function arch(x:number,y:number,z:number,w:number,h:number,a=0){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.closePath();add(new T.ShapeGeometry(sh,12),'glass',x,y,z,a);add(new T.TorusGeometry(w/2+.12,.15,4,12,Math.PI),'stone',x,y+h-w/2,z,a);for(let side of [-1,1])box(x+side*(w/2+.12)*Math.cos(a),y,z-side*(w/2+.12)*Math.sin(a),.3,h-w/2,.25,'stone',a);}
 function shell(poly:T.Vector2[][],h:number,c:Colour){const sh=new T.Shape(poly[0]);sh.holes=poly.slice(1).map(r=>new T.Path(r));const g=new T.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,h,0);add(g,c);}
 function roof(poly:T.Vector2[][],h:number,rise:number,flat=false){
  const sh=new T.Shape(poly[0]);sh.holes=poly.slice(1).map(r=>new T.Path(r));const g=new T.ShapeGeometry(sh),pos=g.getAttribute('position'),ix=g.index!,vertices:number[]=[];
  const xs=poly[0].map(p=>p.x),lo=Math.min(...xs),hi=Math.max(...xs),cx=(lo+hi)/2,half=(hi-lo)/2,attic=id==='ons-lieve-heer-op-solder'&&!flat;
  // Split each exact footprint triangle at real straight ridge lines. This
  // avoids irregular sampled peaks and retains every courtyard opening.
  const height=(x:number)=>h+.03+(flat?0:attic?Math.max(0,5.8-Math.abs(x+2.2)*1.81,4.2-Math.abs(x+8.1)*1.65):Math.max(0,Math.min(rise,(half-Math.abs(x-cx))*1.25)));
  const cuts=[lo,...(flat?[]:attic?[-10.65,-8.1,-5.55,-5.4,-2.2,1.0]:[cx-half+rise/1.25,cx,cx+half-rise/1.25]),hi].filter(x=>x>=lo&&x<=hi).sort((a,c)=>a-c);
  function clip(r:T.Vector2[],cut:number,left:boolean){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],ain=left?a.x<=cut:a.x>=cut,cin=left?c.x<=cut:c.x>=cut;if(ain)out.push(a);if(ain!==cin)out.push(new T.Vector2(cut,a.y+(c.y-a.y)*(cut-a.x)/(c.x-a.x)));}return out;}
  for(let i=0;i<ix.count;i+=3){const q=[0,1,2].map(k=>new T.Vector2(pos.getX(ix.getX(i+k)),pos.getY(ix.getX(i+k))));for(let k=1;k<cuts.length;k++){const part=clip(clip(q,cuts[k-1],false),cuts[k],true);for(let n=1;n<part.length-1;n++)for(const p of [part[0],part[n],part[n+1]])vertices.push(p.x,height(p.x),p.y);}}
  geometry(vertices,'slate');
  // Close the surveyed end gables and lightwell reveals up to the roof
  // profile; no open triangular faces are left on the rear elevations.
  const walls:number[]=[];for(const r of poly)for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],ts=[0,1,...cuts.filter(x=>x>Math.min(a.x,c.x)&&x<Math.max(a.x,c.x)).map(x=>(x-a.x)/(c.x-a.x))].sort((a,c)=>a-c);for(let k=1;k<ts.length;k++){const p=a.clone().lerp(c,ts[k-1]),q=a.clone().lerp(c,ts[k]);walls.push(p.x,h,p.y,q.x,h,q.y,q.x,height(q.x),q.y,p.x,h,p.y,q.x,height(q.x),q.y,p.x,height(p.x),p.y);}}
  geometry(walls,id==='foam'&&h===17.7?'stone':'brick');
 }
 function rearWindows(poly:T.Vector2[][],h:number){for(let ri=0;ri<poly.length;ri++){const r=poly[ri];let area=0;for(let i=0;i<r.length;i++)area+=r[i].x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*r[i].y;for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],v=c.clone().sub(a),l=v.length();if(l<3.0)continue;v.normalize();const n=new T.Vector2(v.y,-v.x).multiplyScalar((area>0?1:-1)*(ri?-1:1)),angle=Math.atan2(n.x,n.y);if(!ri&&n.y>.8)continue;const count=Math.max(1,Math.round(l/3.6));for(let k=0;k<count;k++){const q=a.clone().addScaledVector(v,l*(k+.5)/count).addScaledVector(n,.05);for(let y=1.6;y<h-1.5;y+=3.6)pane(q.x,y,q.y,1.35,2.35,angle);}}}}
 function stair(x:number,z:number,height:number,width=1.7,side=1){const count=10;for(let k=0;k<count;k++)box(x+side*(count-k)*.25,k*height/count,z,width,.25,.45,'stone');for(let k=0;k<count;k+=2)box(x+side*(count-k)*.25,k*height/count+.3,z+.21,.07,.85,.07,'dark');box(x,height,z,width,.25,.65,'stone');}
 function neck(x:number,y:number,z:number,width:number,h:number,colour:Colour='brick',style='round'){
  const sh=new T.Shape();sh.moveTo(-width/2,0);sh.lineTo(width/2,0);if(style==='triangle'){sh.lineTo(0,h);sh.lineTo(-width/2,0);}else{sh.lineTo(width/2,.25);sh.quadraticCurveTo(width*.22,.55,width*.23,h-.75);sh.quadraticCurveTo(0,h+.35,-width*.23,h-.75);sh.quadraticCurveTo(-width*.22,.55,-width/2,.25);}sh.closePath();add(new T.ExtrudeGeometry(sh,{depth:.28,bevelEnabled:false,curveSegments:8}),colour,x,y,z);const pts=sh.getPoints(24);for(let i=1;i<pts.length;i++){const a=pts[i-1],c=pts[i],v=new T.Vector3(c.x-a.x,c.y-a.y,0),g=new T.CylinderGeometry(.09,.09,v.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));add(g,'stone',x+(a.x+c.x)/2,y+(a.y+c.y)/2,z+.3);}}
 if(id==='foam'){
  for(let i=0;i<polygons.length;i++)for(const p of polygons[i]){const h=i?16.5:17.7;shell(p,h,i?'brick':'stone');roof(p,h,i?4.1:2.9);rearWindows(p,h);if(i)for(const r of p.slice(1)){const sh=new T.Shape(r),g=new T.ShapeGeometry(sh);g.rotateX(Math.PI/2);add(g,'glass',0,10.3,0);}}
  const x=-7.55,z=14.98;
  // Outshoorn's eclectic Fodor frontage has three bays, rustication, a
  // monumental round-headed portal, balcony and open top balustrade.
  for(let y of [.45,4.95,10.2,16.7,17.7])box(x,y,z,7.8,.28,.45,'stone');for(let y=1.1;y<17;y+=.62)box(x,y,z,7.5,.04,.045,'frame');
  for(let yy of [5.5,11.0])for(let u of [-2.55,0,2.55]){pane(x+u,yy,z+.08,1.65,4.1,0,'stone');box(x+u,yy+4.12,z+.12,2.0,.21,.28,'stone');add(new T.IcosahedronGeometry(.23,0),'stone',x+u,yy+4.6,z+.22);}
  arch(x,.15,z+.15,2.65,4.55);for(let u of [-2.65,2.65])pane(x+u,.6,z+.09,1.6,2.7,0,'stone');sign('FOAM',x,1.25,z+.25,.10,'red');
  for(let side of [-1,1]){box(x+side*1.0,5.5,z+.2,.23,4.45,.3,'stone');box(x+side*1.0,9.9,z+.2,.48,.28,.4,'stone');}arch(x,10.45,z+.2,2.35,1.6);box(x,10.35,z+.25,2.7,.3,.45,'stone');
  box(x,5.1,z+.35,2.7,.24,.95,'stone');for(let u=-1.2;u<=1.2;u+=.35)box(x+u,5.3,z+.76,.14,.9,.15,'stone');box(x,6.2,z+.75,2.8,.12,.2,'stone');
  for(let u=-3.3;u<=3.3;u+=.55)box(x+u,18,z+.1,.17,.9,.22,'stone');box(x,18.9,z+.1,7.8,.2,.55,'stone');box(x,18.1,13.6,2.35,2.25,2.3,'stone');arch(x,18.4,14.82,1.25,1.6);box(x,20.4,13.6,2.5,.25,2.6,'slate');add(new T.ConeGeometry(.48,1.15,6),'dark',x,21.25,13.6);box(x,21.8,13.6,.04,1.6,.04,'dark');
  for(let i=1;i<=2;i++){const cx=i===1?0:7.4;for(let y of [2.7,6.6,10.4,14.1])for(let u of [-2.3,0,2.3])pane(cx+u,y,14.45,1.6,y===14.1?1.9:2.9);neck(cx,16.5,14.4,7.3,5.4,'brick');pane(cx,18.0,14.74,2.25,2.15);box(cx,20.7,14.8,.4,.6,.85,'stone');stair(cx-2.65,15.3,2.4,1.5,1);box(cx,1.1,14.53,7.3,.4,.4,'stone');}
 }else if(id==='huis-marseille'){
  for(let i=0;i<polygons.length;i++)for(const p of polygons[i]){const h=i?12.8:13.0;shell(p,h,'brick');roof(p,h,3.5);rearWindows(p,h);}
  // Two distinct classicist neck facades. The courtyard rings above stay
  // genuine holes through both walls and clipped pitched roofs.
  for(const [cx,width,h,top]of [[2.7,7.4,13.0,6.3],[-3.85,5.65,12.8,5.2]]){const z=15.88;box(cx,0,z,width,h,.25,'stone');for(let u of [-width/2+.22,width/2-.22,-1.25,1.25]){box(cx+u,2.5,z+.2,.2,h-2.4,.22,'stone');for(let yy of [5.75,9.3,12.65])box(cx+u,yy,z+.25,.45,.2,.36,'stone');}for(let y of [3.0,6.3,9.85])for(let u of [-width*.31,0,width*.31])pane(cx+u,y,z+.24,width*.22,y===9.85?2.45:2.85,0,'stone');for(let y of [2.5,5.85,9.4,12.95])box(cx,y,z+.2,width+.18,.22,.38,'stone');neck(cx,h,z+.12,width,top,'stone');pane(cx,h+1.25,z+.47,1.5,1.7,0,'stone');box(cx,h+4.1,z+.6,.36,.55,.95,'stone');box(cx+width*.31,2.8,z+.4,1.4,2.75,.2,'dark');stair(cx+width*.31,16.6,2.75,1.55,-1);}
  box(2.7,5.92,16.16,2.85,.85,.17,'stone');sign('MARSEILLE',2.7,6.07,16.32,.064,'gold');const tablet=new T.Shape();tablet.moveTo(-1.3,0);tablet.lineTo(1.3,0);tablet.quadraticCurveTo(.85,.62,0,.7);tablet.quadraticCurveTo(-.85,.62,-1.3,0);add(new T.ShapeGeometry(tablet),'frame',2.7,6.45,16.34);for(let u of [-.75,-.3,.15,.6])box(2.7+u,6.55,16.38,.22,.13,.025,'stone');
 }else{
  for(let i=0;i<polygons.length;i++)for(const p of polygons[i]){shell(p,i?14.8:14.0,'brick');roof(p,i?14.8:14,i?0:5.2,!!i);rearWindows(p,i?14.8:14);}
  // The clandestine church has the exterior of a merchant's house. The
  // modern entrance opposite it is separated by the untouched public alley.
  const cx=-2.2,z=11.7;
  for(let y of [3.4,6.85,10.25])for(let u of [-2.3,-.77,.77,2.3]){pane(cx+u,y,z+.05,1.0,2.55);box(cx+u,y+2.63,z+.14,1.32,.14,.23,'stone');}
  box(cx,1.65,z+.11,6.4,3.0,.22,'white');for(let u of [-1.3,.45,2.2])pane(cx+u,1.85,z+.27,1.3,2.6);box(cx-2.4,1.65,z+.28,1.1,2.8,.18,'dark');for(let y of [1.4,4.75,13.75])box(cx,y,z+.15,6.5,.26,.4,'stone');neck(cx,14,z+.1,6.4,5.8,'brick','triangle');pane(cx-1.15,14.4,z+.44,1.15,1.65);pane(cx+1.15,14.4,z+.44,1.15,1.65);pane(cx,16.75,z+.44,.8,1.2);box(cx,19.8,z+.2,1.1,.25,.65,'stone');box(cx,19.9,z-.1,.25,1.3,1.0,'dark');stair(cx-2.4,12.6,1.6,1.45,1);
  const modernX=7.1;for(let y of [4.1,7.65,11.1])for(let u of [-2.2,0,2.2]){pane(modernX+u,y,11.94,1.65,2.65,0,'dark',true);box(modernX+u,y+2.75,12,1.95,.23,.2,'red');}box(modernX,.1,11.92,5.7,3.2,.18,'glass');for(let u of [-2.85,0,2.85])box(modernX+u,.1,12.07,.12,3.2,.15,'dark');box(modernX,3.1,12.0,6.65,.7,.3,'red');sign('MUSEUM',modernX,3.35,12.2,.085,'gold');box(modernX,14.7,11.9,6.7,.25,.4,'red');box(6.8,14.9,-2.0,2.2,2.1,2.4,'glass');box(6.8,17,-2,2.35,.14,2.55,'frame');
  // A small red hanging sign identifies the actual entrance without turning
  // an unobtrusive historic house into an invented exterior church.
  box(3.7,4.3,12.15,.12,2.0,.7,'red');
 }
}
