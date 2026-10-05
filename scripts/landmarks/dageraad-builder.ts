import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import { upwardRoofPlane } from './house-geometry';
import data from './dageraad-footprints.json';
type Colour = Parameters<BuildingTools['add']>[1];
/** Museum corner parent only. Adjacent residential wings retain their genuine models. */
export function buildDageraad(_id: string, _w: number, _d: number, b: BuildingTools) {
  const ring = data.ring.map(p => new T.Vector2(p[0], p[1]));
  const tx=.678, tz=.735, nx=.735, nz=-.678, cx=4.558, cz=-2.474;
  const uv=(p:T.Vector2)=>new T.Vector2((p.x-cx)*tx+(p.y-cz)*tz,(p.x-cx)*nx+(p.y-cz)*nz);
  const xy=(u:number,v:number)=>new T.Vector2(cx+u*tx+v*nx,cz+u*tz+v*nz);
  const local=ring.map(uv);
  const volumes:{poly:T.Vector2[],height:number,colour:Colour,smooth:boolean}[]=[];
  function body(poly:T.Vector2[],height:number,colour:Colour='ochre',cap:Colour='slate',smooth=false) {
    if(poly.length<3)return;const shape=new T.Shape(poly);
    volumes.push({poly,height,colour,smooth});
    const roof=upwardRoofPlane(shape,height),idx=roof.index!,pos=roof.getAttribute('position');
    for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),d=idx.getX(i+1),c=idx.getX(i+2);
      const up=(pos.getZ(d)-pos.getZ(a))*(pos.getX(c)-pos.getX(a))-(pos.getX(d)-pos.getX(a))*(pos.getZ(c)-pos.getZ(a));
      if(up<0){idx.setX(i+1,c);idx.setX(i+2,d);}
    }roof.computeVertexNormals();b.add(roof,cap);
  }
  function clip(poly:T.Vector2[],axis:'x'|'y',value:number,above:boolean) {
    const out:T.Vector2[]=[];for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],a=above?p[axis]>=value:p[axis]<=value,c=above?q[axis]>=value:q[axis]<=value;
      if(a)out.push(p.clone());if(a!==c)out.push(p.clone().lerp(q,(value-p[axis])/(q[axis]-p[axis])));
    }return out;
  }
  // Low former-shop podium, with supported main roof and narrow tower rising independently.
  body(ring,5.12,'ochre','stone',true);
  const main=data.roofZones[8].plan.map(p=>uv(new T.Vector2(p[0],p[1])));
  // The fitted main roof is behind the sculptural rounds, not an opaque backing at their street plane.
  body(clip(main,'y',-1.35,false).map(p=>xy(p.x,p.y)),17.56);
  const tower=data.roofZones[4].plan.map(p=>new T.Vector2(p[0],p[1]));
  // The blank tower has a gently scalloped outer face, rather than a rectangle with painted identity.
  const towerUv=tower.map(uv),umin=Math.min(...towerUv.map(p=>p.x)),umax=Math.max(...towerUv.map(p=>p.x));
  const towerFront=(f:number)=>.11+.34*Math.sin(f*Math.PI)**2*(1+.5*Math.cos(f*Math.PI*4));
  const front:T.Vector2[]=[];
  for(let i=0;i<=32;i++){const u=umin+(umax-umin)*i/32;front.push(xy(u,towerFront(i/32)));}
  const back=clip(towerUv,'y',-.2,false).map(p=>xy(p.x,p.y));
  // Convex rear rectangle plus a curved front strip share only their vertical boundary.
  body(back,21.34);
  body([...front,xy(umax,-.2),xy(umin,-.2)],21.34,'ochre','stone',true);
  function frontAt(u:number) {
    const hits:number[]=[];for(let i=0;i<local.length;i++){const p=local[i],q=local[(i+1)%local.length];if(Math.abs(p.x-q.x)>1e-6&&u>=Math.min(p.x,q.x)&&u<=Math.max(p.x,q.x))hits.push(p.y+(q.y-p.y)*(u-p.x)/(q.x-p.x));}
    return Math.max(...hits);
  }
  // Rounded caps visibly recede at each storey. Their upper silhouette is photographic,
  // and each circle is clipped against the surveyed street perimeter, never expanded into neighbors.
  const tiers=[{height:8.35,centre:2.35,radius:1.60,depth:-.48},{height:12.02,centre:2.55,radius:1.26,depth:-.67},{height:15.03,centre:2.70,radius:.92,depth:-.48}];
  const tierFront=(u:number,tier:typeof tiers[number],side:number)=>Math.min(frontAt(u),tier.depth+Math.sqrt(Math.max(0,tier.radius**2-(u-side*tier.centre)**2)));
  for(const side of [-1,1])for(const tier of tiers){
    const out:T.Vector2[]=[];
    for(let i=0;i<=40;i++){
      const u=side*tier.centre-tier.radius+2*tier.radius*i/40;
      out.push(xy(u,tierFront(u,tier,side)));
    }
    const u0=side*tier.centre-tier.radius,u1=side*tier.centre+tier.radius;
    out.push(xy(u1,-1.50),xy(u0,-1.50));body(out,tier.height,'ochre','stone',true);
  }
  // Emit the boundary of the volume UNION in each height band. Internal/coincident
  // walls are not geometry: offsetting them would only disguise the depth fighting.
  const inside=(p:T.Vector2,poly:T.Vector2[])=>{
    let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],d=poly[j];if((a.y>p.y)!==(d.y>p.y)&&p.x<(d.x-a.x)*(p.y-a.y)/(d.y-a.y)+a.x)yes=!yes;
    }return yes;
  };
  const cross=(a:T.Vector2,d:T.Vector2)=>a.x*d.y-a.y*d.x;
  const levels=[0,...new Set(volumes.map(v=>v.height))].sort((a,d)=>a-d),emitted=new Set<string>();
  for(const volume of volumes){
    const positions:number[]=[];
    for(let i=0;i<volume.poly.length;i++){
      const p=volume.poly[i],q=volume.poly[(i+1)%volume.poly.length],delta=q.clone().sub(p),length=delta.length();if(length<1e-6)continue;
      const cuts=[0,1];
      for(const other of volumes)for(let j=0;j<other.poly.length;j++){
        const a=other.poly[j],d=other.poly[(j+1)%other.poly.length],edge=d.clone().sub(a),offset=a.clone().sub(p),den=cross(delta,edge);
        if(Math.abs(den)>1e-9){const t=cross(offset,edge)/den,u=cross(offset,delta)/den;if(t>1e-7&&t<1-1e-7&&u>=-1e-7&&u<=1+1e-7)cuts.push(t);}
        else if(Math.abs(cross(offset,delta))<1e-6){for(const v of [a,d]){const t=v.clone().sub(p).dot(delta)/delta.lengthSq();if(t>1e-7&&t<1-1e-7)cuts.push(t);}}
      }
      const sorted=[...new Set(cuts.map(t=>+t.toFixed(8)))].sort((a,d)=>a-d);
      const normal=new T.Vector2(delta.y,-delta.x).normalize();
      for(let j=0;j<sorted.length-1;j++){
        const a=p.clone().addScaledVector(delta,sorted[j]),d=p.clone().addScaledVector(delta,sorted[j+1]);if(a.distanceTo(d)<1e-6)continue;
        const mid=a.clone().add(d).multiplyScalar(.5),left=mid.clone().addScaledVector(normal,1e-4),right=mid.clone().addScaledVector(normal,-1e-4);
        for(let k=0;k<levels.length-1&&levels[k]<volume.height-1e-6;k++){
          const bottom=levels[k],top=levels[k+1],height=(bottom+top)/2;
          const solid=(sample:T.Vector2)=>volumes.some(v=>v.height>height&&inside(sample,v.poly));
          const l=solid(left),r=solid(right);if(l===r)continue;
          const keys=[a,d].map(v=>`${v.x.toFixed(5)},${v.y.toFixed(5)}`).sort();const key=`${keys.join('|')}/${bottom}/${top}`;if(emitted.has(key))continue;emitted.add(key);
          const corners=[[a.x,bottom,a.y],[d.x,bottom,d.y],[d.x,top,d.y],[a.x,top,a.y]];
          // Normal points toward the empty side, independent of source polygon winding.
          const order=l?[0,1,2,0,2,3]:[0,3,2,0,2,1];order.forEach(index=>positions.push(...corners[index]));
        }
      }
    }
    if(!positions.length)continue;
    const shell=new T.BufferGeometry();shell.setAttribute('position',new T.Float32BufferAttribute(positions,3));shell.computeVertexNormals();
    if(volume.smooth){const p=shell.getAttribute('position'),n=shell.getAttribute('normal'),sums=new Map<string,T.Vector3>();
      const key=(i:number)=>`${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
      for(let i=0;i<p.count;i++){const k=key(i),v=sums.get(k)??new T.Vector3();v.add(new T.Vector3(n.getX(i),0,n.getZ(i)));sums.set(k,v);}
      for(let i=0;i<p.count;i++){const v=sums.get(key(i))!.clone().normalize();n.setXYZ(i,v.x,0,v.z);}
    }b.add(shell,volume.colour);
  }
  const angle=Math.atan2(nx,nz);
  function pane(u:number,y:number,v:number,w:number,h:number,c:Colour){const p=xy(u,v);b.add(new T.PlaneGeometry(w,h),c,p.x,y+h/2,p.y,angle);}
  function window(u:number,y:number,v:number,w:number,h:number){
    pane(u,y-.08,v,w+.18,h+.16,'white');pane(u,y,v+.035,w,h,'glass');
    for(let i=1;i<8;i++){const p=xy(u,v+.075);b.box(p.x,y+h*i/8,p.y,w,.045,.055,'white',angle);}
    const p=xy(u,v+.077);b.box(p.x,y,p.y,.045,h,.06,'white',angle);
  }
  // Narrow gridded openings in the cylinder edges; the central tower remains intentionally blank.
  for(const side of [-1,1])for(const [i,y] of [5.38,8.72,12.45].entries()){
    const u=side*2.50;window(u,y,tierFront(u,tiers[i],side)+.10,.48,1.13);
  }
  for(const side of [-1,1]){
    const u=side*2.64,v=frontAt(u)+.12;pane(u,.20,v,.88,2.70,'green');pane(u,.44,v+.025,.66,2.34,'glass');
    const p=xy(u,v+.07);b.box(p.x,.2,p.y,.055,2.7,.07,'green',angle);
  }
  // Pale ceramic crown follows each wave; small relief figure is source-supported, without inscription lettering.
  for(let i=0;i<=25;i++){
    const u=umin+(umax-umin)*i/25,v=towerFront(i/25),p=xy(u,v);
    const tooth=new T.ConeGeometry(.13,.54,4);tooth.rotateY(Math.PI/4);b.add(tooth,'stone',p.x,21.63,p.y);
  }
  const relief=xy(0,.10);b.box(relief.x,4.05,relief.y,.75,.20,.45,'stone',angle);
  b.box(relief.x,4.25,relief.y,.48,1.03,.31,'stone',angle);
  b.add(new T.SphereGeometry(.26,8,6),'stone',relief.x,5.56,relief.y+.06);
  // Broad pale curved cap strips follow the exposed round tops, rather than isolated floating ledges.
  for(const side of [-1,1])for(const tier of tiers){
    for(let i=0;i<24;i++){
      const u0=side*tier.centre-tier.radius+2*tier.radius*i/24,u1=u0+2*tier.radius/24;
      const p=xy(u0,tierFront(u0,tier,side)),q=xy(u1,tierFront(u1,tier,side));
      const dx=q.x-p.x,dz=q.y-p.y,len=Math.hypot(dx,dz);
      b.box((p.x+q.x)/2,tier.height+.015,(p.y+q.y)/2,len,.07,.09,'stone',Math.atan2(-dz,dx));
    }
  }
}
