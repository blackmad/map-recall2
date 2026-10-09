import * as T from 'three';
/** An explicit aperture in native vertical walls; roofs and other planes remain intact. */
export interface NativeFacadeAperture {leftM:number;bottomM:number;widthM:number;heightM:number;depthM:number}
type Vertex={local:T.Vector3;attributes:Record<string,number[]>};
export function cutNativeFacadeAperture(geometry:T.BufferGeometry,nativeToFacade:T.Matrix4,a:NativeFacadeAperture):{geometry:T.BufferGeometry;removedAreaM2:number}{
 if(!Object.values(a).every(Number.isFinite)||a.widthM<=0||a.heightM<=0||a.depthM<=0||a.depthM>2)throw Error('Invalid native facade aperture');
 const position=geometry.getAttribute('position'),names=Object.keys(geometry.attributes),out:Record<string,number[]>={},index=geometry.index;
 for(const name of names)out[name]=[];
 const vertex=(i:number):Vertex=>({local:new T.Vector3(position.getX(i),position.getY(i),position.getZ(i)).applyMatrix4(nativeToFacade),attributes:Object.fromEntries(names.map(name=>{const attr=geometry.getAttribute(name);return[name,Array.from({length:attr.itemSize},(_,j)=>attr.getComponent(i,j))]}))});
 const lerp=(p:Vertex,q:Vertex,t:number):Vertex=>({local:p.local.clone().lerp(q.local,t),attributes:Object.fromEntries(names.map(name=>[name,p.attributes[name].map((v,j)=>v+(q.attributes[name][j]-v)*t)]))});
 const clip=(polygon:Vertex[],axis:'x'|'y'|'z',bound:number,inside:boolean,greater:boolean)=>{
  const result:Vertex[]=[];
  for(let i=0;i<polygon.length;i++){
   const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=(p.local[axis]-bound)*(greater?1:-1),dq=(q.local[axis]-bound)*(greater?1:-1),pi=inside?dp>=0:dp<0,qi=inside?dq>=0:dq<0;
   if(pi)result.push(p);if(pi!==qi)result.push(lerp(p,q,dp/(dp-dq)));
  }return result;
 };
 const area=(p:Vertex,q:Vertex,r:Vertex)=>q.local.clone().sub(p.local).cross(r.local.clone().sub(p.local)).length()/2;
 const emit=(polygon:Vertex[])=>{for(let i=1;i+1<polygon.length;i++){if(area(polygon[0],polygon[i],polygon[i+1])<1e-10)continue;for(const v of [polygon[0],polygon[i],polygon[i+1]])for(const name of names)out[name].push(...v.attributes[name]);}};
 const planes:[ 'x'|'y'|'z',number,boolean][]=[['x',a.leftM,true],['x',a.leftM+a.widthM,false],['y',a.bottomM,true],['y',a.bottomM+a.heightM,false],['z',-a.depthM,true],['z',.05,false]];
 let removedAreaM2=0;
 for(let i=0;i<(index?.count??position.count);i+=3){
  const triangle=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j)),normal=triangle[1].local.clone().sub(triangle[0].local).cross(triangle[2].local.clone().sub(triangle[0].local)).normalize();
  if(Math.abs(normal.z)<.98){emit(triangle);continue;}
  let remaining=triangle;
  for(const [axis,bound,greater]of planes){emit(clip(remaining,axis,bound,false,greater));remaining=clip(remaining,axis,bound,true,greater);if(!remaining.length)break;}
  for(let j=1;j+1<remaining.length;j++)removedAreaM2+=area(remaining[0],remaining[j],remaining[j+1]);
 }
 if(removedAreaM2<1e-8)return {geometry,removedAreaM2:0};
 const result=new T.BufferGeometry();for(const name of names){const attr=geometry.getAttribute(name);result.setAttribute(name,new T.Float32BufferAttribute(out[name],attr.itemSize,attr.normalized));}
 result.computeBoundingBox();result.computeBoundingSphere();return {geometry:result,removedAreaM2};
}
