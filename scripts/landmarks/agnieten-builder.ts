import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './agnieten-footprint.json';

/** Original chapel, restored Gothic windows and Renaissance courtyard gate. */
export function buildAgnietenkapel(_w:number,_d:number,b:BuildingTools){
  type Colour=Parameters<BuildingTools['add']>[1];
  const [lng,lat]=source.anchor,lon=111320*Math.cos(lat*Math.PI/180);
  const point=(p:number[])=>new T.Vector2((p[0]-lng)*lon,-(p[1]-lat)*110540);
  const ring=source.parent.ring.slice(0,-1).map(point);
  const angle=(90-source.axisHeadingDegrees)*Math.PI/180;
  const axis=new T.Vector2(Math.cos(angle),-Math.sin(angle));
  const side=new T.Vector2(Math.sin(angle),Math.cos(angle));
  const cross=(p:T.Vector2)=>p.dot(side);
  const peak=source.heightMetres,eave=10.8;
  const roofHeight=(p:T.Vector2)=>Math.max(eave,peak-Math.abs(cross(p)-.1)*1.45);
  function surface(vertices:number[],c:Colour){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();b.add(g,c);}
  const body=new T.ExtrudeGeometry(new T.Shape(ring),{depth:eave,bevelEnabled:false});body.rotateX(Math.PI/2);body.translate(0,eave,0);b.add(body,'brick');
  // Split each plan triangle at slope changes, giving a straight continuous
  // ridge without triangulation-dependent jagged roof faces.
  const geometry=new T.ShapeGeometry(new T.Shape(ring)),p=geometry.getAttribute('position'),idx=geometry.getIndex()!;
  function clip(poly:T.Vector2[],limit:number,greater:boolean){const out:T.Vector2[]=[];for(let i=0;i<poly.length;i++){
    const a=poly[i],q=poly[(i+1)%poly.length],da=cross(a)-limit,dq=cross(q)-limit;
    const inside=greater?da>=-1e-8:da<=1e-8,next=greater?dq>=-1e-8:dq<=1e-8;
    if(inside)out.push(a);if(inside!==next)out.push(a.clone().lerp(q,da/(da-dq)));
  }return out;}
  const roofs:number[]=[];
  for(let k=0;k<idx.count;k+=3){let polys=[Array.from({length:3},(_,j)=>new T.Vector2(p.getX(idx.getX(k+j)),p.getY(idx.getX(k+j))))];
    for(const limit of [.1-(peak-eave)/1.45,.1,.1+(peak-eave)/1.45])polys=polys.flatMap(poly=>[clip(poly,limit,false),clip(poly,limit,true)].filter(q=>q.length>=3));
    for(const poly of polys)for(let j=1;j<poly.length-1;j++)roofs.push(...[poly[0],poly[j],poly[j+1]].flatMap(q=>[q.x,roofHeight(q),q.y]));
  }surface(roofs,'slate');
  // Close the real perimeter up to the pitched roof, retaining its small notches.
  for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],v=q.clone().sub(a);const cuts=[0,1];
    for(const limit of [.1-(peak-eave)/1.45,.1,.1+(peak-eave)/1.45]){const t=(limit-cross(a))/(cross(q)-cross(a));if(t>0&&t<1)cuts.push(t);}
    cuts.sort((a,c)=>a-c);for(let j=0;j<cuts.length-1;j++){const u=a.clone().addScaledVector(v,cuts[j]),z=a.clone().addScaledVector(v,cuts[j+1]);surface([u.x,eave,u.y,z.x,eave,z.y,z.x,roofHeight(z),z.y,u.x,eave,u.y,z.x,roofHeight(z),z.y,u.x,roofHeight(u),u.y],'brick');}
  }
  function offset(q:T.Vector2,a:number,forward:number,u=0){return new T.Vector2(q.x+Math.sin(a)*forward+Math.cos(a)*u,q.y+Math.cos(a)*forward-Math.sin(a)*u);}
  function panel(q:T.Vector2,y:number,w:number,h:number,a:number,c:Colour,pointed=false){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);
    if(pointed){s.lineTo(w/2,h-w*.65);s.quadraticCurveTo(w*.30,h,0,h);s.quadraticCurveTo(-w*.30,h,-w/2,h-w*.65);}else{s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);}s.closePath();
    b.add(new T.ExtrudeGeometry(s,{depth:.12,bevelEnabled:false,curveSegments:6}),c,q.x,y,q.y,a);
  }
  function window(q:T.Vector2,y:number,w:number,h:number,a:number,pointed=false){panel(q,y,w+.24,h+.24,a,'stone',pointed);panel(offset(q,a,.13),y+.12,w,h,a,'glass',pointed);
    const z=offset(q,a,.28);b.box(z.x,y+.18,z.y,.07,h-w*.6,.08,'dark',a);
    for(let v=1;v<h-w*.55;v+=1.05)b.box(z.x,y+v,z.y,w,.07,.08,'dark',a);
  }
  // Canal fronts: the chapel's west courtyard gable and east street gable
  // have different fenestration; neither receives an invented church tower.
  const west=point([4.894868,52.3699481]),east=ring[1].clone().add(ring[2]).multiplyScalar(.5);
  const endEdge=ring[2].clone().sub(ring[1]);
  const westFace=angle-Math.PI/2,eastFace=Math.atan2(endEdge.y,-endEdge.x);
  for(const u of [-1.3,1.3])window(offset(west,westFace,.10,u),5.0,1.9,7.0,westFace,true);
  const rose=offset(west,westFace,.28);for(const [r,c] of [[.98,'stone'],[.82,'glass']] as [number,Colour][]){const g=new T.CylinderGeometry(r,r,.12,16);g.rotateX(Math.PI/2);b.add(g,c,rose.x,13.25,rose.y,westFace);}
  const door=offset(west,westFace,.20);b.box(door.x,0,door.y,1.8,3.0,.2,'dark',westFace);
  for(const u of [-1.08,1.08])window(offset(east,eastFace,.1,u),3.7,1.75,6.0,eastFace);
  window(offset(east,eastFace,.1),11.1,3.9,4.0,eastFace);
  const endDoor=offset(east,eastFace,.1);b.box(endDoor.x,0,endDoor.y,1.7,2.65,.2,'stone',eastFace);const inset=offset(east,eastFace,.26);b.box(inset.x,.08,inset.y,1.4,2.3,.18,'dark',eastFace);
  // Shallow roof dormers identify the long hall without altering the outline.
  for(const t of [-5,2,7]){const q=axis.clone().multiplyScalar(t).addScaledVector(side,-2.55);b.box(q.x,14.9,q.y,1.45,1.5,.8,'brick',angle);const face=offset(q,angle+Math.PI,.45);b.box(face.x,15.0,face.y,1.05,1.1,.12,'glass',angle+Math.PI);}
  // Actual mapped courtyard wall, cut around the entrance rather than placing
  // a solid block behind an ornamental arch.
  const wall=source.courtyardWall.ring.map(point),gate=wall[1],wa=wall[2].clone().sub(wall[0]).normalize();
  const face=-Math.atan2(wa.y,wa.x);
  const portalWidth=2.7,spring=2.05,radius=portalWidth/2,wallHeight=3.8;
  for(const end of [wall[0],wall[2]]){const length=end.distanceTo(gate)-portalWidth/2,mid=gate.clone().lerp(end,(portalWidth/2+length/2)/gate.distanceTo(end));b.box(mid.x,0,mid.y,length,wallHeight,.38,'brick',face);b.box(mid.x,wallHeight,mid.y,length,.14,.52,'stone',face);}
  const arch=new T.Shape();arch.absarc(0,spring,radius+.32,0,Math.PI,false);arch.lineTo(-radius,spring);arch.absarc(0,spring,radius,Math.PI,0,true);arch.closePath();b.add(new T.ExtrudeGeometry(arch,{depth:.45,bevelEnabled:false,curveSegments:12}),'stone',gate.x,0,gate.y,face);
  for(const u of [-radius-.22,radius+.22]){const q=offset(gate,face,0,u);b.box(q.x,0,q.y,.45,spring,.5,'stone',face);b.box(q.x,2.9,q.y,.55,1.4,.5,'stone',face);for(const y of [.3,1.3,2.15,3.7])b.box(q.x,y,q.y,.65,.15,.62,'stone',face);b.add(new T.SphereGeometry(.23,6,4),'stone',q.x,4.45,q.y);b.add(new T.ConeGeometry(.16,.35,6),'stone',q.x,4.81,q.y);}
  const top=offset(gate,face,.06);b.box(top.x,3.55,top.y,3.6,.25,.5,'stone',face);
  b.box(top.x,3.8,top.y,1.9,.45,.5,'stone',face);b.box(top.x,4.15,top.y,1.35,1.3,.42,'stone',face);
  const shield=offset(gate,face,.33);b.box(shield.x,4.32,shield.y,.62,.95,.12,'red',face);
  for(const y of [4.52,4.80,5.08])for(const a of [-Math.PI/4,Math.PI/4]){const g=new T.BoxGeometry(.36,.065,.06);g.rotateZ(a);b.add(g,'white',shield.x,y,shield.y+.08,face);}
  for(const u of [-1.12,1.12]){const q=offset(gate,face,.06,u);b.add(new T.TorusGeometry(.36,.09,4,10,Math.PI*1.65),'stone',q.x,4.3,q.y,face);}
  b.add(new T.SphereGeometry(.23,8,5),'stone',top.x,5.63,top.y);
  // The wrought-iron gate leaves keep the opening visually transparent.
  for(let u=-1.15;u<=1.15;u+=.23){const q=offset(gate,face,.13,u);b.box(q.x,0,q.y,.055,spring+Math.sqrt(Math.max(0,radius*radius-u*u)),.07,'dark',face);}
  for(const y of [1.0,2.02]){const q=offset(gate,face,.14);b.box(q.x,y,q.y,portalWidth,.06,.08,'dark',face);}
}
