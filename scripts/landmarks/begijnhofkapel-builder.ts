import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './begijnhofkapel-source.json';

/** Two bent house facades and an open portal: the concealed church has no spire. */
export function buildBegijnhofkapel(_w:number,_d:number,b:BuildingTools){
  const lon=111320*Math.cos(source.anchor[1]*Math.PI/180);
  const point=(p:number[])=>new T.Vector2((p[0]-source.anchor[0])*lon,-(p[1]-source.anchor[1])*110540);
  const ring=source.ring.slice(0,-1).map(point),north=point([0,52.369360]).y,south=point([0,52.369215]).y;
  function clip(poly:T.Vector2[],distance:(p:T.Vector2)=>number){const out:T.Vector2[]=[];
    for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=distance(p),z=distance(q);if(a>=-1e-8)out.push(p);if((a>=-1e-8)!==(z>=-1e-8))out.push(p.clone().lerp(q,a/(a-z)));}return out;}
  function mesh(v:number[],colour:Parameters<BuildingTools['add']>[1]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();b.add(g,colour);}
  const geometry=new T.ShapeGeometry(new T.Shape(ring)),ps=geometry.getAttribute('position'),indices=geometry.getIndex()!;
  for(let k=0;k<indices.count;k+=3){const triangle=Array.from({length:3},(_,i)=>new T.Vector2(ps.getX(indices.getX(k+i)),ps.getY(indices.getX(k+i))));
    for(const [lo,hi,eave,rise] of [[-Infinity,north,9.5,2.5],[north,south,13.0,source.heightMetres-13.0],[south,Infinity,8.7,2.8]]){
      let polygon=clip(clip(triangle,p=>p.y-lo),p=>hi-p.y);if(polygon.length<3)continue;
      const walls=new T.ExtrudeGeometry(new T.Shape(polygon),{depth:eave,bevelEnabled:false});walls.rotateX(Math.PI/2);walls.translate(0,eave,0);b.add(walls,'brick');
      // Split at the authored straight ridge instead of following triangle edges.
      const ridge=point([4.889554,source.anchor[1]]).x;
      const height=(p:T.Vector2)=>eave+rise*Math.max(0,1-Math.abs(p.x-ridge)/8.5);
      for(const roof of [clip(polygon,p=>p.x-ridge),clip(polygon,p=>ridge-p.x)]){
        const vertices:number[]=[];for(let i=1;i<roof.length-1;i++)vertices.push(...[roof[0],roof[i],roof[i+1]].flatMap(p=>[p.x,height(p),p.y]));if(vertices.length)mesh(vertices,'slate');
      }
      for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],parts=[p];if((p.x-ridge)*(q.x-ridge)<0)parts.push(p.clone().lerp(q,(ridge-p.x)/(q.x-p.x)));parts.push(q);
        for(let j=0;j<parts.length-1;j++){const a=parts[j],z=parts[j+1];mesh([a.x,eave,a.y,z.x,eave,z.y,z.x,height(z),z.y,a.x,eave,a.y,z.x,height(z),z.y,a.x,height(a),a.y],'brick');}}
    }
  }
  function arch(q:T.Vector2,y:number,w:number,h:number,a:number,colour:Parameters<BuildingTools['add']>[1]){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();b.add(new T.ExtrudeGeometry(s,{depth:.10,bevelEnabled:false,curveSegments:6}),colour,q.x,y,q.y,a);}
  function outward(p:T.Vector2,a:number,d:number,u=0){return new T.Vector2(p.x+Math.sin(a)*d+Math.cos(a)*u,p.y+Math.cos(a)*d-Math.sin(a)*u);}
  function window(p:T.Vector2,y:number,w:number,h:number,a:number){arch(p,y,w+.18,h+.15,a,'white');const inner=outward(p,a,.12);arch(inner,y+.07,w,h,a,'dark');
    for(const u of [-w*.25,0,w*.25]){const q=outward(p,a,.25,u);b.box(q.x,y+.12,q.y,.05,h-w*.5,.07,'white',a);}
    for(let v=.55;v<h-w*.4;v+=.65){const q=outward(p,a,.25);b.box(q.x,y+v,q.y,w,.05,.07,'white',a);}
    const q=outward(p,a,.25);b.add(new T.TorusGeometry(w*.2,.035,4,10),'white',q.x,y+h-w*.47,q.y,a);
  }
  // Ordinary service/residential elevations within this shared BAG parent:
  // approximate sash rhythm, separate from the photographed chapel windows.
  const signed=ring.reduce((s,p,i)=>s+p.x*ring[(i+1)%ring.length].y-ring[(i+1)%ring.length].x*p.y,0);
  for(let i=0;i<ring.length;i++){if(i===0||i===1)continue;const p=ring[i],v=ring[(i+1)%ring.length].clone().sub(p),length=v.length();if(length<3.5)continue;v.normalize();const n=new T.Vector2(v.y,-v.x).multiplyScalar(signed>0?1:-1),a=Math.atan2(n.x,n.y),count=Math.max(1,Math.floor(length/3.4));
    for(let j=0;j<count;j++){const q=p.clone().addScaledVector(v,length*(j+.5)/count).addScaledVector(n,.09),eave=q.y>=north&&q.y<=south?13.0:q.y<north?9.5:8.7,w=Math.min(1.7,length/count*.58);
      for(let y=1.5;y+1.7<eave;y+=3.0){const face=outward(q,a,.11);b.box(q.x,y,q.y,w+.16,1.85,.08,'white',a);b.box(face.x,y+.08,face.y,w,1.7,.08,'dark',a);const frame=outward(q,a,.17);b.box(frame.x,y+.08,frame.y,.06,1.7,.08,'white',a);b.box(frame.x,y+.88,frame.y,w,.06,.08,'white',a);}
    }
  }
  // The actual two east-facing edges bend at the downpipe; three bays each.
  for(const [i,j,portal] of [[0,1,2],[1,2,-1]]){const p=point(source.ring[i]),q=point(source.ring[j]),v=q.clone().sub(p),length=v.length();v.normalize();const normal=new T.Vector2(v.y,-v.x),a=Math.atan2(normal.x,normal.y),width=length/3*.62;
    for(let bay=0;bay<3;bay++){const c=p.clone().addScaledVector(v,length*(bay+.5)/3).addScaledVector(normal,.06);
      if(bay!==portal){if(i===1&&bay===2){arch(c,0,width,4.2,a,'white');arch(outward(c,a,.12),.1,width-.16,4.0,a,'dark');}else window(c,1.5,width,4.4,a);}
      window(c,6.6,width,3.3,a);window(c,10.45,width,2.0,a);
    }
    const mid=p.clone().lerp(q,.5).addScaledVector(normal,.07);
    for(const [y,h,d] of [[12.72,.22,.4],[13.0,.28,.6]])b.box(mid.x,y,mid.y,length+.1,h,d,'white',a);
    if(portal>=0){const door=p.clone().addScaledVector(v,length*(portal+.5)/3).addScaledVector(normal,.12);arch(door,.05,1.5,3.5,a,'dark');const c=p.clone().addScaledVector(v,length*(portal+.5)/3).addScaledVector(normal,.7);
      // Freestanding pillars and lintel keep the doorway truly open.
      const w=1.8;for(const s of [-1,1]){const side=outward(c,a,0,s*w/2);b.box(side.x,0,side.y,.28,3.6,.95,'stone',a);for(const y of [.15,2.5,3.35])b.box(side.x,y,side.y,.40,.17,1.05,'white',a);}
      b.box(c.x,3.6,c.y,2.2,.24,1.05,'white',a);b.box(c.x,3.92,c.y,2.05,.20,1.05,'stone',a);
      for(const s of [-1,1]){const side=outward(c,a,0,s*.9);b.box(side.x,4.12,side.y,.16,.48,.8,'white',a);}
      b.box(c.x,4.58,c.y,2.0,.13,.9,'white',a);
      for(let u=-.65;u<=.65;u+=.22){const pole=outward(c,a,.4,u);b.add(new T.CylinderGeometry(.035,.06,.38,6),'white',pole.x,4.35,pole.y);}
      b.add(new T.ConeGeometry(.72,1.15,4),'slate',c.x,4.77,c.y);b.box(c.x,5.345,c.y,.06,.38,.06,'gold');b.box(c.x,5.59,c.y,.29,.055,.055,'gold');
    }
  }
}
