import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './klimmuur-centraal-footprints.json';
import {upwardRoofPlane} from './house-geometry';
type P=[number,number,number];
/** Original narrow sans strokes, transformed into a surveyed facade frame. No font/photo textures. */
function facadeLettering(text:string,p:P,q:P,b:BuildingTools):void{
 const length=Math.hypot(q[0]-p[0],q[1]-p[1]),tx=(q[0]-p[0])/length,tz=(q[1]-p[1])/length,nx=-tz,nz=tx,slope=(q[2]-p[2])/length;
 // Photo-derived dimensions, not a surveyed sign: 90% of frontage, 1.8m tall,
 // with the top 0.8m below the descending crown. Stems remain vertical.
 const height=1.8,clearance=.8,width=length*.90,start=length*.05;
 type V=[number,number];
 const arc=(cx:number,cy:number,rx:number,ry:number,a:number,z:number):V[]=>Array.from({length:13},(_,i)=>{const t=a+(z-a)*i/12;return[cx+rx*Math.cos(t),cy+ry*Math.sin(t)]});
 const glyphs:Record<string,V[][]>={
  K:[[[0,0],[0,1]],[[1,1],[0,.48],[1,0]]],L:[[[0,1],[0,0],[1,0]]],I:[[[.5,0],[.5,1]]],
  M:[[[0,0],[0,1],[.5,.53],[1,1],[1,0]]],
  U:[[[0,1],[0,.25]],arc(.5,.25,.5,.25,Math.PI,2*Math.PI),[[1,.25],[1,1]]],
  R:[[[0,0],[0,1],[.48,1]],arc(.48,.75,.52,.25,Math.PI/2,-Math.PI/2),[[.48,.5],[0,.5]],[[.45,.5],[1,0]]],
  C:[arc(.5,.5,.5,.5,Math.PI*.24,Math.PI*1.76)],E:[[[1,1],[0,1],[0,0],[1,0]],[[0,.5],[.82,.5]]],
  N:[[[0,0],[0,1],[1,0],[1,1]]],T:[[[0,1],[1,1]],[[.5,1],[.5,0]]],
  A:[[[0,0],[.5,1],[1,0]],[[.22,.43],[.78,.43]]]
 };
 const advance=(ch:string)=>ch===' '?1.0:1.06,total=[...text].reduce((n,ch)=>n+advance(ch),0)-.36,unit=width/total,glyphWidth=unit*.70,stroke=.18;
 let cursor=0,index=0;
 for(const ch of text){if(ch===' '){cursor+=advance(ch)*unit;continue;}
  const paths=glyphs[ch];if(!paths)throw Error(`Unsupported facade glyph ${ch}`);
  for(const path of paths)for(let i=0;i<path.length-1;i++){
   const a=new T.Vector2(path[i][0]*glyphWidth,path[i][1]*height),c=new T.Vector2(path[i+1][0]*glyphWidth,path[i+1][1]*height),normal=new T.Vector2(-(c.y-a.y),c.x-a.x).normalize().multiplyScalar(stroke/2);
   const shape=new T.Shape([a.clone().add(normal),c.clone().add(normal),c.clone().sub(normal),a.clone().sub(normal)]);
   const g=new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:false,steps:1});
   const positions=g.getAttribute('position');
   for(let j=0;j<positions.count;j++){
    const u=start+cursor+positions.getX(j),v=positions.getY(j),depth=.062+positions.getZ(j);
    positions.setXYZ(j,p[0]+tx*u+nx*depth,p[2]+slope*u-clearance-height+v,p[1]+tz*u+nz*depth);
   }
   g.computeVertexNormals();g.userData.part='south-real-lettering';g.userData.glyph=ch;g.userData.glyphIndex=index;g.userData.text=text;b.add(g,'dark');
  }
  cursor+=advance(ch)*unit;index++;
 }
}
/** Original surveyed wedge, native RD east/south. Sources are measurements, never asset mesh imports. */
export function buildKlimmuurCentraal(_w:number,_d:number,b:BuildingTools):void{
 const all=data.roofs.map(r=>({surface:r.surface,ring:r.rings[0] as P[]}));
 function clipGround(r:P[]):P[]{const out:P[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];if(p[2]>=0)out.push(p);if((p[2]<0)!==(q[2]<0)){const f=-p[2]/(q[2]-p[2]);out.push([p[0]+f*(q[0]-p[0]),p[1]+f*(q[1]-p[1]),0])}}return out}
 const roofs=all.map(r=>({...r,ring:clipGround(r.ring)}));
 function fit(r:P[]){const cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y}const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,d=(zy*xx-xy*xz)/det;return(x:number,z:number)=>cy+a*(x-cx)+d*(z-cz)}
 const equal=(p:P,q:P)=>Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])<.025;
 const shared=(p:P,q:P)=>roofs.reduce((n,r)=>n+r.ring.filter((a,i)=>(equal(a,q)&&equal(r.ring[(i+1)%r.ring.length],p))||(equal(a,p)&&equal(r.ring[(i+1)%r.ring.length],q))).length,0)>1;
 function quad(p:P,q:P,lowP:number,lowQ:number,highP:number,highQ:number,c:Parameters<BuildingTools['add']>[1],offset=0){const len=Math.hypot(q[0]-p[0],q[1]-p[1]),nx=-(q[1]-p[1])/len,nz=(q[0]-p[0])/len,x=p[0]+nx*offset,z=p[1]+nz*offset,u=q[0]+nx*offset,v=q[1]+nz*offset;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x,lowP,z,u,lowQ,v,u,highQ,v,x,lowP,z,u,highQ,v,x,highP,z],3));g.computeVertexNormals();g.userData.part='facade';b.add(g,c)}
 for(const roof of roofs){const shape=new T.Shape(roof.ring.map(p=>new T.Vector2(p[0],p[1]))),height=fit(roof.ring),g=upwardRoofPlane(shape),pos=g.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));g.computeVertexNormals();g.userData.part='roof';g.userData.surface=roof.surface;b.add(g,roof.surface===3?'greyBrick':'slate');
  if(roof.surface===3){const low:P[]=[];const level=9.7;for(let i=0;i<roof.ring.length;i++){const p=roof.ring[i],q=roof.ring[(i+1)%roof.ring.length];if(p[2]<=level)low.push(p);if((p[2]<level)!==(q[2]<level)){const t=(level-p[2])/(q[2]-p[2]);low.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1]),level])}}const panel=upwardRoofPlane(new T.Shape(low.map(p=>new T.Vector2(p[0],p[1])))),a=panel.getAttribute('position');for(let i=0;i<a.count;i++)a.setY(i,height(a.getX(i),a.getZ(i))+.035);panel.computeVertexNormals();panel.userData.part='steep-silver';b.add(panel,'white');
   // The current west upper end is dark weathered corrugated cladding.
   // Model shallow ribs on the actual inclined plane; fine weathering/patches remain simplified.
   const first=roof.ring[0],last=roof.ring.at(-1)!,next=roof.ring[1],previous=roof.ring.at(-2)!;
   const atHeight=(a:P,c:P,y:number):P=>{const t=(y-a[2])/(c[2]-a[2]);return[a[0]+t*(c[0]-a[0]),a[1]+t*(c[1]-a[1]),y]};
   const bottomA=atHeight(first,next,level),bottomB=atHeight(last,previous,level);
   const point=(a:P,c:P,t:number)=>new T.Vector3(a[0]+t*(c[0]-a[0]),a[2]+t*(c[2]-a[2]),a[1]+t*(c[1]-a[1]));
   const normal=new T.Vector3().crossVectors(point(first,last,1).sub(point(first,last,0)),point(first,bottomA,1).sub(point(first,last,0))).normalize();if(normal.x>0)normal.negate();
   const width=Math.hypot(last[0]-first[0],last[1]-first[1]),count=Math.ceil(width/.32);
   for(let k=1;k<count;k++){
    const centre=k/count,half=.012/width,vertices=[point(first,last,centre-half),point(bottomA,bottomB,centre-half),point(bottomA,bottomB,centre+half),point(first,last,centre+half)];
    for(const v of vertices)v.addScaledVector(normal,.04);
    const rib=new T.BufferGeometry();rib.setAttribute('position',new T.Float32BufferAttribute(vertices.flatMap(v=>v.toArray()),3));rib.setIndex([0,1,2,0,2,3]);rib.computeVertexNormals();rib.userData.part='west-upper-corrugation';b.add(rib,'dark');
   }
  }
  for(let i=0;i<roof.ring.length;i++){const p=roof.ring[i],q=roof.ring[(i+1)%roof.ring.length];if(shared(p,q)||Math.max(p[2],q[2])<.03)continue;const topP=height(p[0],p[1]),topQ=height(q[0],q[1]);quad(p,q,0,0,topP,topQ,'concrete');
   // Broad photographic silver lower and warm pale upper bands; unrelated graffiti omitted.
   if(roof.surface===5&&Math.hypot(p[0]-q[0],p[1]-q[1])>12){quad(p,q,0,0,topP*.61,topQ*.61,'white',.025);quad(p,q,topP*.61,topQ*.61,topP,topQ,'stone',.025);
    // Restrained corrugation running vertically on the actual long side planes.
    const n=Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/.52);for(let k=1;k<n;k++){const f=k/n,pa:P=[p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f,0],pb:P=[pa[0]+(q[0]-p[0])*.0018,pa[1]+(q[1]-p[1])*.0018,0],h=topP+(topQ-topP)*f;quad(pa,pb,0,0,h,h,'concrete',.055)}
   }
  }
 }
 // South terrace frontage corresponds to AHN main roof edge west crown→east low.
 const main=roofs.find(r=>r.surface===5)!,p=main.ring[5],q=main.ring[6];
 // Source2016 5.113×4.864m folding glass assembly; latest2023 observed fully closed shutter.
 facadeLettering('KLIM MUUR CENTRAAL',p,q,b);
 const length=Math.hypot(q[0]-p[0],q[1]-p[1]),fraction=.57,span=5.113/length;
 const point=(f:number):P=>[p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f,0];const a=point(fraction-span/2),d=point(fraction+span/2);
 quad(a,d,.05,.05,4.914,4.914,'frame',.105);const innerA=point(fraction-span/2+.025/length),innerD=point(fraction+span/2-.025/length);quad(innerA,innerD,.12,.12,4.86,4.86,'concrete',.125);
 for(let y=.28;y<4.86;y+=.23)quad(innerA,innerD,y,y,y+.025,y+.025,'white',.14);
}
