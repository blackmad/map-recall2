/** Remove redundant drawing vertices without moving the polygon boundary. */
export function compactContour(points:readonly [number,number][]):[number,number][]{
 let p=points.filter((v,i)=>i===0||Math.hypot(v[0]-points[i-1][0],v[1]-points[i-1][1])>1e-10).map(v=>[...v] as [number,number]);
 if(p.length>1&&Math.hypot(p[0][0]-p.at(-1)![0],p[0][1]-p.at(-1)![1])<1e-10)p.pop();
 let changed=true;
 while(changed&&p.length>3){changed=false;p=p.filter((b,i)=>{
  const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];
  if(Math.abs(u[0]*v[1]-u[1]*v[0])<1e-10&&u[0]*v[0]+u[1]*v[1]>=0){changed=true;return false;}return true;
 });}
 return p;
}
