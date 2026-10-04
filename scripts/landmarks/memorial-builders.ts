import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sources from './memorial-footprints.json';
import specs from './memorial-specs.json';

/** Ground-level landmarks: only stonework, never a replacement building box. */
export function buildMemorialLandmark(id:string,_w:number,_d:number,b:BuildingTools){
  if(id!=='homomonument')throw new Error(`Unknown memorial ${id}`);
  const source=sources.find(s=>s.id===id)!,spec=specs.find(s=>s.id===id)!,anchor=spec.surveyed.anchor;
  const points=source.corners.map(([lng,lat])=>new T.Vector2(
    (lng-anchor[0])*111320*Math.cos(anchor[1]*Math.PI/180),(anchor[1]-lat)*111320));
  function slab(ring:T.Vector2[],top:number,depth:number){
    const shape=new T.Shape(ring);
    const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
    g.rotateX(Math.PI/2);g.translate(0,top,0);b.add(g,'pink');
  }
  const triangles=points.map((tip,i)=>[tip,
    tip.clone().lerp(points[(i+1)%3],10/tip.distanceTo(points[(i+1)%3])),
    tip.clone().lerp(points[(i+2)%3],10/tip.distanceTo(points[(i+2)%3]))]);
  // Northern platform, waterside descent, and flush southern inscription stone.
  slab(triangles[0],.60,.60);
  slab(triangles[2],.06,.06);
  const [tip,left,right]=triangles[1];
  const limits=[0,.40,.60,.80,1],heights=[.04,.18,.32,.46];
  for(let i=0;i<4;i++){
    const lo=limits[i],hi=limits[i+1];
    const ring=lo===0?[tip,tip.clone().lerp(left,hi),tip.clone().lerp(right,hi)]:[
      tip.clone().lerp(left,lo),tip.clone().lerp(left,hi),
      tip.clone().lerp(right,hi),tip.clone().lerp(right,lo)];
    slab(ring,heights[i],heights[i]);
  }
  // Thin granite strips join the three corners; the intervening plaza stays open.
  for(let i=0;i<3;i++){
    const a=points[i],q=points[(i+1)%3],distance=a.distanceTo(q);
    const start=a.clone().lerp(q,10/distance),end=q.clone().lerp(a,10/distance);
    const delta=end.clone().sub(start),normal=new T.Vector2(-delta.y,delta.x).normalize().multiplyScalar(.09);
    slab([start.clone().add(normal),end.clone().add(normal),end.clone().sub(normal),start.clone().sub(normal)],.055,.055);
  }
}
