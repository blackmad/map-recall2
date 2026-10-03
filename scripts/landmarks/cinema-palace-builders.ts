import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import footprints from './cinema-palace-footprints.json';
import specs from './cinema-palace-specs.json';
import {TUSCHINSKI} from '../../src/canalRecall/landmarkFrontData';
import {frontKitGeometry} from '../../src/canalRecall/landmarkFronts';
/** Original cinema architecture; measured Tuschinski facade is reused in metres. */
export function buildCinemaPalaceLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box,sign,hip}=b;type C=Parameters<BuildingTools['add']>[1];
 if(id==='tuschinski'){
  const s=specs.find(s=>s.id===id)!,source=footprints.find(f=>f.id===id)!,anchor=s.footprint.centre;
  const coord=([lng,lat]:number[])=>new T.Vector2((lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),-(lat-anchor[1])*110540);
  const shape=new T.Shape(source.ring.map(coord)),walls=new T.ExtrudeGeometry(shape,{depth:19,bevelEnabled:false});walls.rotateX(Math.PI/2);walls.translate(0,19,0);add(walls,'stone');let roof=new T.ShapeGeometry(shape);roof.rotateX(Math.PI/2);add(roof,'slate',0,19.04,0);
  // Vetted original roof masses from museumKits: auditorium, foyer, rear stage.
  for(const [lng,lat,len,wid] of [[4.894505,52.366213,30,26],[4.894657,52.36646,16,14]]){const p=coord([lng,lat]),v=[[-len/2,0,-wid/2],[len/2,0,-wid/2],[len/2,0,wid/2],[-len/2,0,wid/2],[0,3,0]],f=[0,1,4,1,2,4,2,3,4,3,0,4],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(f.flatMap(i=>v[i]),3));g.computeVertexNormals();g.rotateY(26.6*Math.PI/180);add(g,'slate',p.x,19,p.y);}
  const stage=coord([4.894405,52.366062]);box(stage.x,19,stage.y,26,5.2,10,'stone',-63.4*Math.PI/180);box(stage.x,24.2,stage.y,26,.8,10,'slate',-63.4*Math.PI/180);
  const kit=frontKitGeometry(TUSCHINSKI,{lng:anchor[0],lat:anchor[1]},'untextured');
  const colours:Record<string,C>={'#8a8188':'stone','#5f5961':'slate','#b08a4a':'gold','#4f6f73':'glass','#3b3f46':'dark','#7a2c2a':'brick'};
  for(const tri of kit.tris){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(tri.p.flatMap(p=>[p[0],p[2],-p[1]]),3));g.computeVertexNormals();add(g,colours[tri.hex]??'stone');}
  const start=coord(TUSCHINSKI.start),end=coord(TUSCHINSKI.end),u=end.clone().sub(start).normalize(),normal=new T.Vector2(-u.y,u.x),angle=-Math.atan2(u.y,u.x);
  const front=(x:number,z:number,out=0)=>({x:start.x+u.x*x+normal.x*out,y:z,z:start.y+u.y*x+normal.y*out});
  const fb=(x:number,y:number,out:number,a:number,h:number,c:number,colour:C)=>{const p=front(x,y,out);box(p.x,p.y,p.z,a,h,c,colour,angle);};
  // Two oxidised copper domes with glazed lanterns and finials behind the crowns.
  for(const x of [2.4,12]){const p=front(x,26.8,-1.2);let dome=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);dome.scale(1.85,4.1,1.85);add(dome,'glass',p.x,p.y,p.z);box(p.x,30.9,p.z,1.1,1.5,1.1,'dark');hip(p.x,32.4,p.z,1.3,1.3,1.2,'glass');box(p.x,33.6,p.z,.1,1.1,.1,'gold');}
  // Curved projecting stained-glass oriel, horizontal balcony and ribbed reliefs.
  for(const [x,y] of [[2.4,7.4],[12,7.4],[2.4,13.6],[12,13.6]]){fb(x,y,.9,2.35,4,.75,'stone');for(const dx of [-.65,.65]){fb(x+dx,y+.25,1.31,.85,3.4,.08,'glass');fb(x+dx-.49,y+.15,1.38,.09,3.6,.07,'gold');}}
  for(const y of [17.1,18.15,19.2])for(let x=4.4;x<10.2;x+=.47){const p=front(x,y,.43);add(new T.IcosahedronGeometry(.2,0),'gold',p.x,p.y,p.z);}
  for(const x of [.5,4.1,10.25,13.9])for(let y=1;y<23;y+=.55)fb(x,y,.7,.26,.28,.24,'slate');
  fb(7.3,4.25,1.2,7.1,.45,2.2,'glass');fb(7.3,4.7,1.2,7.2,.27,2.3,'gold');
  // Letter meshes share the facade frame by transforming emitted pixel geometry.
  const letters:Record<string,string[]>={T:['111','010','010','010','010'],U:['101','101','101','101','111'],S:['111','100','111','001','111'],C:['111','100','100','100','111'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],N:['1001','1101','1011','1001','1001'],K:['101','110','100','110','101']};let x=4.3;for(const ch of 'TUSCHINSKI'){const rows=letters[ch];for(let j=0;j<5;j++)for(let k=0;k<rows[j].length;k++)if(rows[j][k]==='1')fb(x+k*.15,5.05+(4-j)*.15,1.7,.12,.12,.1,'gold');x+=(rows[0].length+1)*.15;}
  for(const x of [.3,14.2]){const p=front(x,0,.7);box(p.x,0,p.z,.08,37,.08,'gold');}
 }else if(id==='pathe-city'){
  const front=d/2;box(0,0,0,w*.97,17.8,d*.97,'stone');box(0,17.8,0,w*.98,.3,d*.98,'slate');box(-w*.08,18.1,-d*.17,w*.64,5.3,d*.5,'stone');box(-w*.08,23.4,-d*.17,w*.65,.35,d*.51,'slate');
  // Asymmetric tall theatre tower, vertical light strips and glazed spiral stair.
  const tx=w*.36;box(tx,0,front-4.1,w*.16,31.1,7.3,'stone');box(tx,31.1,front-4.1,w*.17,.4,7.5,'slate');for(let x=tx-w*.065;x<=tx+w*.07;x+=w*.033)box(x,5.5,front-.35,.22,23,.16,'white');
  add(new T.CylinderGeometry(1.45,1.45,25.1,16),'glass',tx+w*.075,17.05,front-.3);for(let y=5.2;y<=29.5;y+=1.7){add(new T.CylinderGeometry(1.5,1.5,.13,16),'frame',tx+w*.075,y,front-.3);}for(let i=0;i<12;i++){let a=i*Math.PI/6;box(tx+w*.075+1.48*Math.sin(a),4.5,front-.3+1.48*Math.cos(a),.08,25.1,.08,'frame');}
  // Left glazed lightwell and horizontal foyer strip frame the broad blank sign wall.
  box(-w*.3,1,front+.04,w*.14,16.2,.2,'glass');for(let x=-w*.36;x<-w*.23;x+=.6)box(x,1,front+.18,.08,16.2,.08,'frame');for(let y=2;y<17;y+=1.8)box(-w*.3,y,front+.18,w*.14,.08,.08,'frame');
  const sx=w*.015,sw=w*.45;box(sx,0,front+.04,sw,3.3,.22,'glass');for(let x=sx-sw/2;x<=sx+sw/2;x+=2.4)box(x,0,front+.2,.12,3.3,.08,'frame');
  sign('CITY',sx,13.8,front+.16,.62,'dark');sign('THEATER',sx,12.15,front+.16,.23,'dark');box(sx,6.3,front+.2,sw*.95,4.4,.28,'slate');box(sx,6.6,front+.38,sw*.9,3.8,.1,'glass');box(sx,3.6,front+.65,sw+.8,.35,1.45,'slate');sign('PATHE',sx,3.95,front+1.43,.27,'gold');
  for(const x of [-w*.43,-w*.15])for(const y of [4.2,8.5,12.8])box(x,y,front+.13,w*.1,2,.15,'glass');
 }else throw new Error(`No cinema palace builder for ${id}`);
}
