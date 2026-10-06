import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
import source from './keith-haring-mural-footprints.json';
import spec from './keith-haring-mural-spec.json';

export function haringLocalPoint(lng: number, lat: number): T.Vector2 {
  const [lng0, lat0] = spec.surveyed.anchor;
  return new T.Vector2((lng-lng0)*111320*Math.cos(lat0*Math.PI/180), -(lat-lat0)*110540);
}
/** Original native-scale Koelhuis: its own surveyed Pand, never the adjacent Markthal. */
export function buildKeithHaringMural(_w: number, _d: number, b: BuildingTools) {
  const ring = source.ring.slice(0,-1).map(([lng,lat])=>haringLocalPoint(lng,lat));
  const shape = new T.Shape(ring);
  b.add(openTopPrism(shape,0,17.4),'brick');
  b.add(upwardRoofPlane(shape,17.4),'slate');
  // Current north facade (BAG39→38), to the LEFT of the mural in the2023
  // west/north reference. The broad grey scar records the removed north addition;
  // only its surviving wall treatment is rebuilt, not the demolished volume.
  const northWest=ring[39],northEast=ring[38];
  const northTangent=northEast.clone().sub(northWest).normalize();
  const northNormal=new T.Vector2(northTangent.y,-northTangent.x);
  const northLength=northWest.distanceTo(northEast);
  function northPanel(u:number,y:number,w:number,h:number,c:Parameters<BuildingTools['add']>[1],offset=.06) {
    const point=(v:number,alt:number)=>new T.Vector3(northWest.x+northTangent.x*v+northNormal.x*offset,alt,northWest.y+northTangent.y*v+northNormal.y*offset);
    const p=[point(u-w/2,y),point(u+w/2,y),point(u+w/2,y+h),point(u-w/2,y+h)];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>p[i].toArray()),3));g.computeVertexNormals();b.add(g,c);
  }
  northPanel(northLength*.46,4.4,northLength*.86,7.2,'greyBrick');
  // Sparse former beam pockets along the scar's top, and a few irregular surviving
  // apertures: deliberately restrained facade assemblies, not simulated photo noise.
  for(const u of [.09,.21,.34,.49,.64,.79])northPanel(northLength*u,11.05,.72,.42,'dark',.09);
  for(const [u,y,w,h] of [[.13,7.7,.7,.36],[.18,7.85,.9,.32],[.34,9.8,.65,.48],[.58,8.8,.7,.38],[.82,10.35,.55,.55]])northPanel(northLength*u,y,w,h,'dark',.09);
  // Boarded vertical slots survive at the two edges and above the gray panel.
  for(const [u,y,h] of [[.965,4.8,1.5],[.965,8.4,1.55],[.06,5.5,1.5],[.06,9.3,1.55],[.23,13.45,.75],[.23,15.85,.75],[.68,13.4,.6],[.68,16,.6],[.9,15.8,.65]]) {
    northPanel(northLength*u,y,.52,h,'dark',.075);
    northPanel(northLength*u,y+.07,.38,h-.14,'stone',.10);
  }
  // Southern goods-lift towers, followed by the two external octagonal stair turrets.
  function raisedPart(indices: number[], top: number, glazed: boolean) {
    const points=indices.map(i=>ring[i]);
    const outline=new T.Shape(points);
    b.add(openTopPrism(outline,17.4,glazed?22.35:top),'brick');
    if (glazed) {
      b.add(openTopPrism(outline,22.35,top-.3),'glass');
      for(let i=0;i<points.length;i++) {
        const a=points[i],q=points[(i+1)%points.length],length=a.distanceTo(q);
        for(let t=0;t<=1;t+=1/Math.max(1,Math.round(length/1.1))) {
          const p=a.clone().lerp(q,t);b.box(p.x,22.35,p.y,.13,top-22.35,.13,'frame');
        }
        const p=a.clone().add(q).multiplyScalar(.5),angle=-Math.atan2(q.y-a.y,q.x-a.x);
        for(const y of [22.4,23.25,24.1])b.box(p.x,y,p.y,length,.12,.13,'dark',angle);
      }
    }
    if(glazed)b.add(openTopPrism(outline,top-.3,top),'frame');
    b.add(upwardRoofPlane(outline,top),'slate');
  }
  // Source polygon explicitly records the original towers, including their bevels.
  raisedPart([17,18,19,20],24.4,true);
  raisedPart([23,24,25,26],24.4,true);
  raisedPart([6,7,8,9,10,11,12,13,14,15],21.6,false);
  raisedPart([29,30,31,32,33,34,35,36],21.6,false);
  // West wall tangent follows BAG, left-to-right in the reference = north-to-south.
  const north=ring[0],south=ring[1],tangent=south.clone().sub(north).normalize();
  const outward=new T.Vector2(-tangent.y,tangent.x);
  const length=north.distanceTo(south),centre=north.clone().lerp(south,.5);
  const wall=(u:number,y:number,offset=.035)=>new T.Vector3(centre.x+tangent.x*u+outward.x*offset,y,centre.y+tangent.y*u+outward.y*offset);
  function wallQuad(u:number,y:number,w:number,h:number,c:Parameters<BuildingTools['add']>[1],offset=.05) {
    const p=[wall(u-w/2,y,offset),wall(u+w/2,y,offset),wall(u+w/2,y+h,offset),wall(u-w/2,y+h,offset)];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>p[i].toArray()),3));g.computeVertexNormals();b.add(g,c);
  }
  // Lower loading-platform infill and thin surviving canopy, not an invented solid annex.
  wallQuad(0,0,length*.96,4.05,'greyBrick');
  wallQuad(0,4.05,length*.96,.28,'concrete',.38);
  {const p=[wall(-length*.48,4.33,.02),wall(length*.48,4.33,.02),wall(length*.48,4.33,.38),wall(-length*.48,4.33,.38)];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>p[i].toArray()),3));g.computeVertexNormals();b.add(g,'concrete');}
  for(const u of [-5,-1,3]) {wallQuad(u,1.0,2.4,1.6,'ochre',.075);wallQuad(u,2.62,2.55,.12,'stone',.09);}
  wallQuad(6.5,0,1.6,3.6,'frame',.09);
  // Narrow, exposed stair-turret slots; main refrigerated mass stays largely windowless.
  for(const inds of [[10,11],[32,33]]) {
    const a=ring[inds[0]],q=ring[inds[1]],p=a.clone().lerp(q,.5);
    const normal=new T.Vector2(q.y-a.y,a.x-q.x).normalize().multiplyScalar(.04);
    for(const y of [2,6.5,11,15.5]) b.box(p.x+normal.x,y,p.y+normal.y,.24,1.65,.24,'dark');
  }
  // Hand-authored planar paint ribbons: no texture, photo pixels or downloaded paths.
  // Artwork bounds15m wide×12m high. Coordinates below are original simplified
  // interpretive contours, y downward, preserving creature/rider/crosses composition.
  function stroke(points:number[][],width=.12,smooth=true) {
    const coords=points.map(([x,y])=>new T.Vector2(T.MathUtils.clamp(x,.10,14.9)-7.5,16.5-y));
    const curve=new T.CatmullRomCurve3(coords.map(p=>new T.Vector3(p.x,p.y,0)),false,'centripetal');
    const ps=smooth?curve.getPoints(Math.max(12,points.length*5)).map(p=>new T.Vector2(p.x,p.y)):coords;
    const vertices:number[]=[];
    for(let i=0;i<ps.length-1;i++) {
      const a=ps[i],q=ps[i+1],v=q.clone().sub(a);if(v.length()<1e-6)continue;
      const n=new T.Vector2(-v.y,v.x).normalize().multiplyScalar(width/2);
      const r=[a.clone().add(n),q.clone().add(n),q.clone().sub(n),a.clone().sub(n)];
      vertices.push(...[0,2,1,0,3,2].flatMap(j=>wall(T.MathUtils.clamp(r[j].x,-7.45,7.45),r[j].y,.075).toArray()));
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();b.add(g,'white');
  }
  function circle(x:number,y:number,r:number) {stroke(Array.from({length:33},(_,i)=>[x+r*Math.cos(i/32*Math.PI*2),y+r*Math.sin(i/32*Math.PI*2)]));}
  stroke([[2.2,1.5],[3.1,1.55],[3.6,1.1],[4.55,.8],[4.8,1.05],[4.1,1.5],[4.2,2.25],[4.65,2.9],[4.4,3.1],[3.75,2.75],[3.35,2.2],[2.55,2.2],[2.45,3.6],[2.25,4.5],[1.95,4.8],[2.05,5.35],[2.65,6.9],[3.3,7.8],[3.1,8.6],[2.75,9],[3.2,9.45],[3.55,9.1],[3.5,8.75],[3.3,8.4],[3.65,8.1],[4.2,8],[4.6,8.2],[5.15,8.05],[5.65,8.4]]);
  stroke([[2.2,1.5],[1.5,1.8],[1.2,2.3],[1.2,3.5],[.7,4.7],[.55,5.8],[.95,7.25],[1.85,9.2],[3.5,11.4],[5.2,11.85],[5.95,11.6],[6.2,11.05],[6.85,11.2],[7.5,10.9],[7.15,10.3]]);
  stroke([[5.65,8.4],[5.7,7.55],[6.25,6.75],[6.9,6.1],[6.75,5.25],[6.7,3.65],[6.7,1.6],[6.95,.25],[7.4,.2],[8.15,1.85],[8.45,1.1],[8.8,.25],[9.15,.3],[9.75,1.85],[11.55,1.8],[13.85,1.65],[13.95,2.85],[12.1,2.9],[10.15,3.6],[11.8,3.65],[14,3.65],[14.05,4.6],[11.7,4.95],[9.4,5.7],[9.6,6.4],[10.25,7.55],[10.95,8.5],[12.1,7.8],[13.15,7],[13.3,6.35],[13.7,6.2],[14,6.45],[13.9,6.95],[12.3,8.6],[11.1,9.15],[10.1,8.65],[9.45,7.6],[9.2,8.45],[9.5,9.8],[8.8,10.65],[7.6,10.85],[7.15,10.3]]);
  circle(8.05,3.4,.67);circle(8.05,3.4,.42);circle(7.9,5.1,.6);circle(7.9,5.1,.36);
  stroke([[9.6,6.2],[11.55,6.3],[12.1,7.3]]);stroke([[12.4,8.1],[13.2,9],[13.7,8.95],[13.8,8.55],[13.45,8.4],[13,7.6]]);
  // Rider: round head, outstretched arms, bent legs and one St Andrew's cross.
  stroke([[3.85,7.8],[4.2,7],[4.25,6.6],[3.9,6.25],[3.9,5.8],[4.15,5.35],[4.65,5.2],[5.15,5.45],[5.35,5.95],[5.15,6.4],[4.9,6.6],[4.75,7.9]]);
  stroke([[4.1,6.35],[2.75,6.35],[2.4,5.35],[2.1,5.1],[1.9,5.3],[2.3,6.65],[3.75,6.65]]);
  stroke([[5.2,6.4],[6.55,6.4],[6.9,6.25],[6.95,6.0],[6.65,5.8],[6.55,6.0],[5.3,6.0]]);
  stroke([[3.9,7.6],[4.4,7.8],[4.8,8.3]]);stroke([[4.15,6.8],[4.55,7.25]],.12,false);stroke([[4.55,6.8],[4.15,7.25]],.12,false);
  for(let i=0;i<10;i++){const a=Math.PI+i*Math.PI/9;stroke([[4.6+.85*Math.cos(a),5.8+.85*Math.sin(a)],[4.6+1.02*Math.cos(a),5.8+1.02*Math.sin(a)]],.075,false);}
  // Short motion marks around tail, jaw and fin.
  for(const path of [[[3.1,.55],[3.35,.3],[3.8,.3]],[[3,.25],[3.35,0],[3.7,0]],[[.6,3.15],[.35,3.75]],[[.35,3],[.1,3.55]],[[.2,5.35],[.15,6]],[[2.8,3.55],[2.75,4.15]],[[3.05,3.5],[3,4.05]],[[3.35,2.6],[3.7,3.1],[4.15,3.2]],[[3.55,2.55],[3.8,2.9],[4.1,3]],[[.9,9],[1.3,9.8]],[[1.15,8.85],[1.45,9.4]],[[9,10.1],[8.65,10.65]],[[9.25,10.2],[8.9,10.8]],[[13.2,5.95],[13.55,5.75],[13.9,5.8]],[[13.2,5.7],[13.6,5.5],[14,5.6]],[[13.3,9.35],[13.7,9.55],[14,9.5]],[[13.2,9.6],[13.6,9.85],[14,9.8]]])stroke(path,.075);
  for(const [a,q] of [[[14.25,2.75],[14.65,2.2]],[[14.3,3],[14.95,2.7]],[[14.35,3.3],[15,3.2]],[[14.3,3.55],[14.9,3.8]],[[14.2,3.8],[14.65,4.2]]])stroke([a,q],.09,false);
  for(const y of [10.5,11.05,11.6]){stroke([[12.9,y-.18],[13.2,y+.18]],.09,false);stroke([[13.2,y-.18],[12.9,y+.18]],.09,false);}
  // The actual small KH86 mark is authentic artwork signage, fitted under the mural.
  // Keep it as hand-authored strokes, avoiding a large invented building-name label.
  for(const p of [[[13.45,11.15],[13.45,11.8]],[[13.85,11.15],[13.45,11.45],[13.85,11.8]],[[14,11.15],[14,11.8]],[[14.35,11.15],[14.35,11.8]],[[14,11.45],[14.35,11.45]]])stroke(p,.07,false);
  circle(14.65,11.35,.15);circle(14.65,11.65,.15);stroke([[15,11.2],[14.88,11.4],[14.88,11.7],[15.1,11.8],[15.2,11.6],[15.1,11.45],[14.88,11.45]],.07);
}
