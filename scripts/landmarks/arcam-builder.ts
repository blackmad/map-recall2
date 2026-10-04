import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './arcam-footprint.json';
import spec from './arcam-spec.json';

/** Original faceted interpretation of the folded aluminium pavilion. */
export function buildArcam(_w:number,_d:number,b:BuildingTools){
  const [lng0,lat0]=spec.surveyed.anchor,angle=(spec.surveyed.northOffsetDegrees+90)*Math.PI/180;
  const ring=source.ring.slice(0,-1).map(([lng,lat])=>{
    const e=(lng-lng0)*111320*Math.cos(lat0*Math.PI/180),n=(lat-lat0)*110540;
    return new T.Vector2(e*Math.sin(angle)+n*Math.cos(angle),e*Math.cos(angle)-n*Math.sin(angle));
  });
  const xmin=Math.min(...ring.map(p=>p.x)),xmax=Math.max(...ring.map(p=>p.x));
  function depthAt(x:number){const z:number[]=[];for(let i=0;i<ring.length;i++){
    const a=ring[i],q=ring[(i+1)%ring.length];
    if(x>=Math.min(a.x,q.x)-1e-5&&x<=Math.max(a.x,q.x)+1e-5&&Math.abs(q.x-a.x)>1e-8)
      z.push(a.y+(q.y-a.y)*(x-a.x)/(q.x-a.x));
  }return [Math.min(...z),Math.max(...z)];}
  const profile=[[xmin,9.2],[-10,9.5],[-5,10.5],[0,12.5],[5,14.1],[8,14.5],[10.2,13.9],[xmax,11.8]];
  function frontHeight(x:number){for(let i=1;i<profile.length;i++)if(x<=profile[i][0]){
    const a=profile[i-1],q=profile[i],t=(x-a[0])/(q[0]-a[0]);return a[1]+(q[1]-a[1])*(t*t*(3-2*t));
  }return profile.at(-1)![1];}
  function height(x:number,z:number){const [back,front]=depthAt(x),t=T.MathUtils.clamp((z-back)/(front-back||1),0,1);return 9.25+(frontHeight(x)-9.25)*t**1.3;}
  function mesh(vertices:number[],colour:Parameters<BuildingTools['add']>[1]){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();b.add(g,colour);
  }
  const foot=new T.Shape(ring),base=new T.ExtrudeGeometry(foot,{depth:.2,bevelEnabled:false});
  base.rotateX(Math.PI/2);base.translate(0,.2,0);b.add(base,'slate');
  // Subdivide the actual plan's roof triangles to carry the asymmetric curved crown.
  const roof=new T.ShapeGeometry(foot),p=roof.getAttribute('position'),indices=roof.getIndex()!;
  const surface:number[]=[];
  for(let k=0;k<indices.count;k+=3){const corners=[0,1,2].map(i=>new T.Vector2(p.getX(indices.getX(k+i)),p.getY(indices.getX(k+i))));
    const point=(i:number,j:number)=>corners[0].clone().addScaledVector(corners[1].clone().sub(corners[0]),i/10).addScaledVector(corners[2].clone().sub(corners[0]),j/10);
    const emit=(points:T.Vector2[])=>surface.push(...points.flatMap(q=>[q.x,height(q.x,q.y),q.y]));
    for(let i=0;i<10;i++)for(let j=0;j<10-i;j++){
      emit([point(i,j),point(i+1,j),point(i,j+1)]);
      if(i+j<9)emit([point(i+1,j),point(i+1,j+1),point(i,j+1)]);
    }
  }mesh(surface,'frame');
  // Waterfront glass follows the real long rear edge; other walls retain the metal skin.
  for(let i=0;i<ring.length;i++){
    if([1,2,3].includes(i))continue;
    const a=ring[i],q=ring[(i+1)%ring.length],rear=i===5,colour=rear?'glass':'frame';
    for(let j=0;j<20;j++){
      const u=a.clone().lerp(q,j/20),v=a.clone().lerp(q,(j+1)/20),hu=height(u.x,u.y),hv=height(v.x,v.y);
      mesh([u.x,0,u.y,v.x,0,v.y,v.x,hv,v.y,u.x,0,u.y,v.x,hv,v.y,u.x,hu,u.y],colour);
    }
    if(rear){const normal=new T.Vector2(q.y-a.y,a.x-q.x).normalize().multiplyScalar(.055);
      for(let t=0;t<=1;t+=.125){const u=a.clone().lerp(q,t).add(normal);b.box(u.x,0,u.y,.075,height(u.x,u.y),.075,'dark');}
      for(const y of [3.15,6.30]){const centre=a.clone().add(q).multiplyScalar(.5).add(normal);b.box(centre.x,y,centre.y,a.distanceTo(q),.1,.1,'dark',-Math.atan2(q.y-a.y,q.x-a.x));}
    }
  }
  // Street-side S-shaped glazing: an original simplified contour, no reference pixels.
  const opening=[new T.Vector2(9,.04),new T.Vector2(10.8,.04),new T.Vector2(11.6,11.6),new T.Vector2(10.5,13.2),new T.Vector2(8,13.9),new T.Vector2(5,13.6),new T.Vector2(1,12.6),new T.Vector2(-2.8,10.4),new T.Vector2(-3.2,9),new T.Vector2(-1.8,7.4),new T.Vector2(2,6.6),new T.Vector2(5,5),new T.Vector2(7.5,2.7)];
  // Cut the street skin around the glazing; an overlay alone lets the bent
  // cadastral wall poke through the pane triangulation.
  const outer=[new T.Vector2(xmin,0),new T.Vector2(xmax,0)];
  for(let x=xmax;x>xmin;x-=.6)outer.push(new T.Vector2(x,frontHeight(x)));
  outer.push(new T.Vector2(xmin,frontHeight(xmin)));
  const street=new T.Shape(outer);street.holes.push(new T.Path(opening));
  const skin=new T.ShapeGeometry(street),sp=skin.getAttribute('position');
  for(let i=0;i<sp.count;i++)sp.setZ(i,depthAt(sp.getX(i))[1]);
  skin.computeVertexNormals();b.add(skin,'frame');
  const glazing=new T.ShapeGeometry(new T.Shape(opening));
  const gp=glazing.getAttribute('position');for(let i=0;i<gp.count;i++)gp.setZ(i,depthAt(gp.getX(i))[1]+.15);
  glazing.computeVertexNormals();b.add(glazing,'glass');
  function intersections(value:number,horizontal:boolean){const hits:number[]=[];for(let i=0;i<opening.length;i++){
    const a=opening[i],q=opening[(i+1)%opening.length],av=horizontal?a.y:a.x,qv=horizontal?q.y:q.x;
    if((av<=value&&qv>value)||(qv<=value&&av>value))hits.push((horizontal?a.x:a.y)+((horizontal?q.x:q.y)-(horizontal?a.x:a.y))*(value-av)/(qv-av));
  }return hits.sort((a,c)=>a-c);}
  for(let x=xmin+.5;x<xmax-.2;x+=.85){
    const hits=intersections(x,false),limits=[0,...hits,frontHeight(x)];
    for(let j=0;j<limits.length-1;j+=2){const lo=limits[j],hi=limits[j+1],z=depthAt(x)[1]+.025;
      mesh([x-.018,lo,z,x+.018,lo,z,x+.018,hi,z,x-.018,lo,z,x+.018,hi,z,x-.018,hi,z],'slate');
    }
  }
  for(let x=-2;x<12;x+=2.35){const ys=intersections(x,false);for(let j=0;j<ys.length-1;j+=2)b.box(x,ys[j],depthAt(x)[1]+.21,.08,ys[j+1]-ys[j],.08,'dark');}
  for(const y of [3.2,6.4,9.6,12.8]){const xs=intersections(y,true);for(let j=0;j<xs.length-1;j+=2)for(let x=xs[j];x<xs[j+1];x+=.7){const q=Math.min(x+.7,xs[j+1]),a=depthAt(x)[1]+.21,z=depthAt(q)[1]+.21;mesh([x,y-.04,a,q,y-.04,z,q,y+.04,z,x,y-.04,a,q,y+.04,z,x,y+.04,a],'dark');}}
  // Coarse standing seams carry the folded roof to the waterfront side.
  for(let x=xmin+.5;x<xmax-.2;x+=.85){const [back,front]=depthAt(x);for(let j=0;j<10;j++){
    const a=back+(front-back)*j/10,q=back+(front-back)*(j+1)/10;
    mesh([x-.018,height(x,a)+.025,a,x+.018,height(x,a)+.025,a,x+.018,height(x,q)+.025,q,x-.018,height(x,a)+.025,a,x+.018,height(x,q)+.025,q,x-.018,height(x,q)+.025,q],'slate');
  }}
}
