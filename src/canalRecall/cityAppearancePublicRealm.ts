/** Scale-safe display geometry derived from source BGT polygons.
 * Canonical coordinates stay untouched; releases record this tolerance and
 * remain bound to the hash of the unsimplified context snapshot.
 */
export const PUBLIC_REALM_SIMPLIFICATION_TOLERANCE_M=.08;
export type PublicRealmFeature={geometry:{type:'Polygon'|'MultiPolygon'|'LineString'|'MultiLineString';coordinates:any};[key:string]:unknown};
type Point=number[];

export function pointSegmentDistance([x,y]:Point,[ax,ay]:Point,[bx,by]:Point){
  const dx=bx-ax,dy=by-ay,denominator=dx*dx+dy*dy;
  const t=denominator?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/denominator)):0;
  return Math.hypot(x-(ax+t*dx),y-(ay+t*dy));
}

function simplifyOpen(points:Point[],tolerance:number):Point[]{
  if(points.length<=2)return points;
  let farthest=0,index=0;
  for(let i=1;i<points.length-1;i++){const distance=pointSegmentDistance(points[i],points[0],points.at(-1)!);if(distance>farthest){farthest=distance;index=i;}}
  if(farthest<=tolerance)return[points[0],points.at(-1)!];
  return[...simplifyOpen(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyOpen(points.slice(index),tolerance)];
}

export function simplifyPublicRealmLine(points:Point[],tolerance=PUBLIC_REALM_SIMPLIFICATION_TOLERANCE_M):Point[]{
  if(!(tolerance>0&&Number.isFinite(tolerance)))throw Error('Invalid public-realm display tolerance');
  if(!Array.isArray(points)||points.length<2||points.some(point=>!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite)))throw Error('Invalid public-realm line');
  return simplifyOpen(points,tolerance).map(point=>[...point]);
}

/** Closed-ring Douglas–Peucker split across a stable far-side vertex. */
export function simplifyPublicRealmRing(ring:Point[],tolerance=PUBLIC_REALM_SIMPLIFICATION_TOLERANCE_M):Point[]{
  if(!(tolerance>0&&Number.isFinite(tolerance)))throw Error('Invalid public-realm display tolerance');
  if(!Array.isArray(ring)||ring.some(point=>!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite)))throw Error('Invalid public-realm ring');
  const points=ring.length>2&&ring[0][0]===ring.at(-1)?.[0]&&ring[0][1]===ring.at(-1)?.[1]?ring.slice(0,-1):ring;
  if(points.length<4)return ring.map(point=>[...point]);
  let opposite=1,distance=0;
  for(let i=1;i<points.length;i++){const next=(points[i][0]-points[0][0])**2+(points[i][1]-points[0][1])**2;if(next>distance){distance=next;opposite=i;}}
  const a=simplifyOpen(points.slice(0,opposite+1),tolerance),b=simplifyOpen([...points.slice(opposite),points[0]],tolerance),result=[...a.slice(0,-1),...b.slice(0,-1)];
  return(result.length>=3?[...result,result[0]]:ring).map(point=>[...point]);
}

export function simplifyPublicRealmFeature<T extends PublicRealmFeature>(feature:T,tolerance=PUBLIC_REALM_SIMPLIFICATION_TOLERANCE_M):T{
  const {geometry}=feature,type=geometry?.type;
  if(type==='LineString')return{...feature,geometry:{...geometry,coordinates:simplifyPublicRealmLine(geometry.coordinates,tolerance)}};
  if(type==='MultiLineString')return{...feature,geometry:{...geometry,coordinates:geometry.coordinates.map((line:Point[])=>simplifyPublicRealmLine(line,tolerance))}};
  if(!['Polygon','MultiPolygon'].includes(type))throw Error('Unsupported public-realm geometry');
  const polygons=type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const simplified=polygons.map((polygon:Point[][])=>polygon.map(ring=>simplifyPublicRealmRing(ring,tolerance)));
  return{...feature,geometry:{...geometry,coordinates:type==='Polygon'?simplified[0]:simplified}};
}

export function publicRealmVertexCount(feature:PublicRealmFeature){return feature.geometry.coordinates.flat(Infinity).length/2;}
