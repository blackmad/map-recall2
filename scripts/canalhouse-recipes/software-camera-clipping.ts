import {PerspectiveCamera,Vector3} from 'three';
/** Reference stage only: retain source geometry but hide surfaces below the
 * same flat street plane used by the gallery. */
export function clipTriangleAtStreetGrade(points:readonly Vector3[],gradeM=-.05):Vector3[][] {
 if(!Number.isFinite(gradeM))throw Error('Invalid diagnostic street grade');
 const polygon:Vector3[]=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],insideA=a.y>=gradeM,insideB=b.y>=gradeM;
  if(insideA)polygon.push(a.clone());
  if(insideA!==insideB)polygon.push(a.clone().lerp(b,(gradeM-a.y)/(b.y-a.y)));
 }
 return polygon.slice(1,-1).map((p,i)=>[polygon[0],p,polygon[i+2]]);
}
/** Clip in world space before perspective division. Behind-eye vertices must
 * never wrap onto the diagnostic screen as enormous foreground triangles. */
export function clipTriangleToCameraDepth(points:readonly Vector3[],camera:PerspectiveCamera):Vector3[][] {
 let polygon=points.map(p=>p.clone());
 const depth=(p:Vector3)=>-p.clone().applyMatrix4(camera.matrixWorldInverse).z;
 for(const [bound,direction] of [[camera.near,1],[camera.far,-1]] as const){
  const output:Vector3[]=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length],da=depth(a),db=depth(b);
   const insideA=(da-bound)*direction>=0,insideB=(db-bound)*direction>=0;
   if(insideA)output.push(a);
   if(insideA!==insideB)output.push(a.clone().lerp(b,(bound-da)/(db-da)));
  }
  polygon=output;
 }
 return polygon.slice(1,-1).map((p,i)=>[polygon[0],p,polygon[i+2]]);
}
