import type { BridgePoint as Point } from './bridgeSurface.ts';
export function polygonArea(p:Point[]){return p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0];},0)/2;}
export function cleanPolygon(p:Point[]) {
  const points=p.filter((a,i)=>!i||Math.hypot(a[0]-p[i-1][0],a[1]-p[i-1][1])>1e-7);
  if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)![0],points[0][1]-points.at(-1)![1])<1e-7)points.pop();
  return points.length>=3&&Math.abs(polygonArea(points))>1e-8?points:[];
}
export function splitPolygon(polygon:Point[],a:Point,b:Point,sign:number) {
  const inside:Point[]=[],outside:Point[]=[];
  const side=(p:Point)=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
  for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],d=side(p),e=side(q);
    if(d>=-1e-9)inside.push(p);if(d<=1e-9)outside.push(p);
    if(d*e<0){const t=d/(d-e),point:Point=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];inside.push(point);outside.push(point);}
  }return{inside:cleanPolygon(inside),outside:cleanPolygon(outside)};
}
export function subtractTriangle(polygon:Point[],tri:Point[]) {
  const sign=Math.sign(polygonArea(tri)),pieces:Point[][]=[];let remainder=polygon;
  for(let i=0;i<3&&remainder.length;i++){const parts=splitPolygon(remainder,tri[i],tri[(i+1)%3],sign);if(parts.outside.length)pieces.push(parts.outside);remainder=parts.inside;}
  return pieces;
}
/** Share area-weighted normals between coincident vertices of one surface. */
export function smoothBridgeNormals(positions:number[],indices:number[]) {
  const keys:string[]=[],sums=new Map<string,number[]>();
  for(let i=0;i<positions.length;i+=3){const key=positions.slice(i,i+3).map(v=>Math.round(v*1e5)).join(',');keys.push(key);if(!sums.has(key))sums.set(key,[0,0,0]);}
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(j=>j*3),u=positions.slice(b,b+3).map((v,k)=>v-positions[a+k]),v=positions.slice(c,c+3).map((n,k)=>n-positions[a+k]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for(const j of [a,b,c]){const sum=sums.get(keys[j/3])!;for(let k=0;k<3;k++)sum[k]+=normal[k];}
  }
  return keys.flatMap(key=>{const n=sums.get(key)!,l=Math.hypot(...n)||1;return n.map(v=>v/l);});
}
