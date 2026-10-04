import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './houten-huys-source.json';

/** Narrow timber gables at the ends of the surveyed corner-house footprint. */
export function buildHoutenHuys(_w:number,_d:number,b:BuildingTools){
  const point=(p:number[])=>new T.Vector2((p[0]-source.anchor[0])*111320*Math.cos(source.anchor[1]*Math.PI/180),-(p[1]-source.anchor[1])*110540);
  const ring=source.ring.slice(0,-1).map(point),front=ring[4].clone().lerp(ring[1],.5);
  const edge=ring[1].clone().sub(ring[4]),frontWidth=edge.length(),n=new T.Vector2(edge.y,-edge.x).normalize();
  const a=Math.atan2(n.x,n.y),u=new T.Vector2(Math.cos(a),-Math.sin(a)),eave=8.0,rise=source.heightMetres-eave;
  const at=(x:number,z:number)=>front.clone().addScaledVector(u,x).addScaledVector(n,z);
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Parameters<BuildingTools['add']>[1]){const q=at(x,z);b.box(q.x,y,q.y,w,h,d,c,a);}
  function mesh(vertices:number[],c:Parameters<BuildingTools['add']>[1]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();b.add(g,c);}
  const body=new T.ExtrudeGeometry(new T.Shape(ring),{depth:eave,bevelEnabled:false});body.rotateX(Math.PI/2);body.translate(0,eave,0);b.add(body,'brick');
  const back=ring[2].clone().lerp(ring[3],.5);
  // Two tapered slopes over the irregular five-point plan; both end ridges
  // use the measured highest elevation. The slope divisions are authored.
  const roofPoint=(p:T.Vector2,peak=false)=>[p.x,peak?source.heightMetres:eave,p.y];
  const left=[roofPoint(ring[4]),roofPoint(ring[3]),roofPoint(back,true),roofPoint(front,true)];
  const right=[roofPoint(front,true),roofPoint(back,true),roofPoint(ring[2]),roofPoint(ring[1])];
  for(const points of [left,right]){const vertices:number[]=[];for(let i=1;i<points.length-1;i++)vertices.push(...points[0],...points[i],...points[i+1]);mesh(vertices,'slate');}
  for(const [p,q,peak] of [[ring[4],ring[1],front],[ring[2],ring[3],back]])mesh([...roofPoint(p),...roofPoint(q),...roofPoint(peak,true)],'dark');
  // Photographed ground floor and five-window upper storey, below the overhang.
  box(0,0,.045,frontWidth,2.12,.12,'white');box(0,2.12,.08,frontWidth,5.88,.14,'dark');
  function lattice(x:number,y:number,z:number,w:number,h:number){box(x,y,z,w+.10,h+.10,.075,'white');box(x,y+.045,z+.047,w,h,.055,'glass');for(let xx=-w/2+w/3;xx<w/2-.03;xx+=w/3)box(x+xx,y+.045,z+.083,.035,h,.045,'white');for(let yy=.22;yy<h;yy+=.31)box(x,y+yy,z+.085,w,.035,.045,'white');}
  box(-frontWidth*.33,.05,.14,.72,1.95,.1,'dark');box(-frontWidth*.33,1.72,.20,.72,.28,.08,'glass');
  for(let i=0;i<4;i++)lattice(-1.08+i*1.05,3.15,.18,.82,1.63);
  for(let i=0;i<5;i++)lattice(-2.10+i*1.05,5.15,.18,.82,1.63);
  // Upper triangular facade visibly projects beyond the wall below it.
  const gable=new T.Shape();gable.moveTo(-frontWidth/2,0);gable.lineTo(frontWidth/2,0);gable.lineTo(0,rise);gable.closePath();
  const g=new T.ExtrudeGeometry(gable,{depth:.17,bevelEnabled:false}),q=at(0,.27);b.add(g,'dark',q.x,eave,q.y,a);
  box(0,7.86,.26,frontWidth+.10,.18,.45,'dark');
  for(let i=0;i<2;i++)lattice(-.47+i*.94,8.43,.47,.76,1.30);
  for(let i=0;i<3;i++)lattice(-.86+i*.86,10.05,.47,.72,1.15);
  lattice(0,11.90,.47,.38,.90);
  // Fine shallow strips suggest boards without adding textures or extra materials.
  for(let x=-frontWidth/2+.12;x<frontWidth/2;x+=.21){box(x,2.12,.16,.022,5.72,.025,'slate');const h=rise*(1-Math.abs(x)/(frontWidth/2));if(h>.1)box(x,8.0,.46,.019,h,.025,'slate');}
  // RCE records a second timber gable at the rear; its fenestration is approximate.
  const p=ring[2],r=ring[3],v=r.clone().sub(p),width=v.length(),normal=new T.Vector2(v.y,-v.x).normalize(),angle=Math.atan2(normal.x,normal.y),mid=p.clone().lerp(r,.5);
  b.box(mid.x+normal.x*.06,0,mid.y+normal.y*.06,width,2.12,.12,'white',angle);b.box(mid.x+normal.x*.08,2.12,mid.y+normal.y*.08,width,5.88,.16,'dark',angle);
  for(const y of [3.15,5.15])for(const t of [.22,.5,.78]){const c=p.clone().lerp(r,t).addScaledVector(normal,.18);b.box(c.x,y,c.y,.75,1.55,.08,'white',angle);b.box(c.x+normal.x*.06,y+.06,c.y+normal.y*.06,.63,1.43,.06,'glass',angle);}
}
