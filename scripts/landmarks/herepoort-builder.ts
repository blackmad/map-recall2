import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './herepoort-source.json';

/** Two documented gate facades joined around one open garden passage. */
export function buildHerepoort(_w:number,_d:number,b:BuildingTools){
  const angle=source.authorAngleRadians,n=new T.Vector2(Math.sin(angle),Math.cos(angle)),u=new T.Vector2(Math.cos(angle),-Math.sin(angle));
  const centre=u.clone().multiplyScalar(source.localCentre[0]).addScaledVector(n,source.localCentre[1]);
  const at=(x:number,z:number)=>centre.clone().addScaledVector(u,x).addScaledVector(n,z);
  type Colour=Parameters<BuildingTools['add']>[1];
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour){const q=at(x,z);b.box(q.x,y,q.y,w,h,d,c,angle);}
  function add(g:T.BufferGeometry,c:Colour,x:number,y:number,z:number){const q=at(x,z);b.add(g,c,q.x,y,q.y,angle);}
  function wall(width:number,height:number,z:number,depth:number,c:Colour){const s=new T.Shape();
    // A concave outline makes a ground-level passage, with no thin floor cap.
    s.moveTo(-width/2,0);s.lineTo(-1.8,0);s.lineTo(-1.8,2.45);s.absarc(0,2.45,1.8,Math.PI,0,true);s.lineTo(1.8,0);s.lineTo(width/2,0);s.lineTo(width/2,height);s.lineTo(-width/2,height);s.closePath();
    add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:12}),c,0,0,z);}
  wall(8.82,6.12,-1.40,2.80,'brick');wall(9,source.frontHeightMetres,1.41,.22,'stone');wall(9,7.75,-1.65,.24,'brick');
  // Voussoirs form a separate arch rim, leaving the full passage open.
  function rim(z:number,reversed=false){for(let i=0;i<13;i++){const lo=i*Math.PI/13+.016,hi=(i+1)*Math.PI/13-.016,r0=1.83,r1=2.19;
      const s=new T.Shape();s.moveTo(r0*Math.cos(lo),2.45+r0*Math.sin(lo));s.lineTo(r1*Math.cos(lo),2.45+r1*Math.sin(lo));s.lineTo(r1*Math.cos(hi),2.45+r1*Math.sin(hi));s.lineTo(r0*Math.cos(hi),2.45+r0*Math.sin(hi));s.closePath();add(new T.ExtrudeGeometry(s,{depth:.10,bevelEnabled:false}),'stone',0,0,z);
    }for(const x of [-1.96,1.96]){box(x,0,z,.32,2.48,.12,'stone');box(x,2.36,z,.68,.22,.35,'white');}if(reversed)box(0,4.18,z,.45,.50,.15,'stone');}
  rim(1.65);rim(-1.78,true);
  // Paired free-standing columns and shallow shell niches on the sandstone face.
  for(const side of [-1,1]){
    const x=side*3.12;box(x,.04,1.53,1.95,.24,.55,'stone');box(x,5.65,1.53,2.02,.22,.55,'white');
    for(const dx of [-.57,.57]){const cx=x+dx;add(new T.CylinderGeometry(.19,.25,2.25,8),'stone',cx,1.42,1.58);add(new T.CylinderGeometry(.19,.20,2.7,8),'stone',cx,3.82,1.58);for(const y of [.27,2.46,5.18,5.44])add(new T.CylinderGeometry(.28,.28,.14,8),'white',cx,y,1.58);}
    // A muted recessed niche, with a scalloped half-dome, avoids black openings.
    box(x,2.45,1.646,.63,2.07,.055,'frame');
    const shell=new T.SphereGeometry(.39,8,4,0,Math.PI,0,Math.PI/2);shell.scale(1,.65,.42);add(shell,'stone',x,4.53,1.68);
    for(let y=.5;y<5.5;y+=.62){box(side*4.07,y,1.65,.62,.033,.018,'slate');box(x,y,1.65,1.1,.027,.018,'slate');}
  }
  for(const [y,h,d] of [[5.68,.16,.25],[6.04,.13,.36],[6.29,.20,.45],[6.61,.09,.27]])box(0,y,1.41,9.12,h,d,'white');
  // Frieze ornaments and three simplified lion masks, authored as faceted reliefs.
  for(const x of [-1.95,0,1.95]){const t=Math.asin(Math.max(-1,Math.min(1,x/2.05)));const y=2.45+2.05*Math.cos(t);box(x,y-.18,1.73,.48,.48,.12,'white');add(new T.IcosahedronGeometry(.16,0),'stone',x,y,1.88);}
  for(const x of [-2.98,-1.43,1.43,2.98])add(new T.TorusGeometry(.17,.045,4,8),'stone',x,5.89,1.69);
  box(0,5.72,1.66,1.07,.34,.08,'stone');
  // Taller reverse: brick bands, shallow pilasters and a broad heraldic frieze.
  for(let y=.54;y<6.35;y+=.50){const gap=y<2.50?1.83:y<4.30?Math.sqrt(Math.max(0,1.83**2-(y-2.45)**2)):0;if(gap>0)for(const side of [-1,1])box(side*(4.475+gap)/2,y,-1.72,4.475-gap,.11,.10,'stone');else box(0,y,-1.72,8.95,.11,.10,'stone');}
  for(const x of [-3.28,3.28]){box(x,.15,-1.77,.56,6.20,.18,'stone');box(x,6.34,-1.73,1.15,.20,.29,'white');}
  // The band above the arch is solid; its eagle/shield is a simple relief.
  box(0,6.46,-1.75,8.95,.20,.26,'stone');box(0,7.46,-1.74,9.12,.23,.32,'stone');
  for(const x of [-2.42,-1.25,1.25,2.42])add(new T.IcosahedronGeometry(.26,0),'stone',x,6.93,-1.82);
  const shield=new T.Shape();shield.moveTo(-.42,.48);shield.lineTo(.42,.48);shield.lineTo(.36,-.12);shield.lineTo(0,-.48);shield.lineTo(-.36,-.12);shield.closePath();add(new T.ExtrudeGeometry(shield,{depth:.1,bevelEnabled:false}),'stone',0,6.98,-1.88);
  // Low roof over the taller rear face, never an invented gate tower.
  const q=at(0,-.98),roof=new T.BufferGeometry();const v=[[-4.5,0,-.68],[4.5,0,-.68],[4.5,0,.68],[-4.5,0,.68],[0,.66,0]];
  roof.setAttribute('position',new T.Float32BufferAttribute([0,1,4,1,2,4,2,3,4,3,0,4,0,3,2,0,2,1].flatMap(i=>v[i]),3));roof.computeVertexNormals();b.add(roof,'slate',q.x,7.84,q.y,angle);
}
