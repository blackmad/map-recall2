import { bridgeHeightAtLocal, bridgeApronBanks, bridgeProfileAt, bridgeRoadSections, insideBridgeOutline, type BridgePoint as Point, type BridgeSurface } from './bridgeSurface.ts';
import { splitPolygon as split, polygonArea, smoothBridgeNormals } from './bridgeMeshMath.ts';
export type BridgeBatch={positions:number[];indices:number[];colour:string;kind:string;normals?:number[]};
type Point3=[number,number,number];
type Triangulate=(ring:Point[])=>number[][];
/** Conforming station grid: every arch section runs across the full deck. */
export function buildBridgeGeometry(bridge:BridgeSurface,triangulate:Triangulate):BridgeBatch[] {
  const batches=new Map<string,BridgeBatch>();
  const batch=(kind:string,colour:string)=>{const b={kind,colour,positions:[],indices:[]} as BridgeBatch;batches.set(kind,b);return b;};
  const timber=bridge.family==='wooden-deck',masonry=bridge.family==='masonry-arch';
  const deck=batch('deck',timber?'#8b785c':'#817b70'),stone=batch('coping',timber?'#9b8564':'#b7ad99');
  const colour=masonry?'#785142':timber?'#79634a':bridge.family==='concrete-deck'?'#979385':'#435a50';
  const body=batch('structure',colour),soffit=batch('soffit',colour),iron=batch('railings',timber?'#695840':'#273f35'),approaches=batch('approach-sides','#c8d1bc');
  const triangle=(out:BridgeBatch,a:Point3,b:Point3,c:Point3)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    // Polygon clipping can leave virtually collinear triangles. Lifting those
    // onto a curved profile turns invisible planar slivers into vertical fins.
    if((out.kind==='deck'||out.kind==='soffit')&&Math.abs(u[0]*v[1]-u[1]*v[0])<1e-5)return;
    if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-8)return;
    const i=out.positions.length/3;out.positions.push(...a,...b,...c);out.indices.push(i,i+1,i+2);};
  const quad=(out:BridgeBatch,a:Point3,b:Point3,c:Point3,d:Point3)=>{triangle(out,a,b,c);triangle(out,a,c,d);};
  const height=(p:Point)=>bridgeProfileAt(bridge,along(p)).heightM+.035;
  const along=(p:Point)=>24+p[0]*bridge.deckAxis[0]+p[1]*bridge.deckAxis[1];
  const across=(p:Point)=>-p[0]*bridge.deckAxis[1]+p[1]*bridge.deckAxis[0];
  const [start,end]=bridge.deckRangeM,center=(start+end)/2,radius=(end-start)*.35;
  const underside=(p:Point)=>{if(!masonry)return height(p)-.35;const s=along(p),u=(s-center)/radius,top=bridgeProfileAt(bridge,s).heightM+.035;
    return Math.abs(u)>=1?-.75:Math.min(top-.35,-.75+(top+.4)*Math.sqrt(1-u*u));};
  const gate=(s:number):[Point,Point]=>{const a=bridge.deckAxis;const point=(t:number):Point=>[a[0]*(s-24)-a[1]*t,a[1]*(s-24)+a[0]*t];return[point(-100),point(100)];};
  const crossGate=(t:number):[Point,Point]=>{const a=bridge.deckAxis;const point=(s:number):Point=>[a[0]*(s-24)-a[1]*t,a[1]*(s-24)+a[0]*t];return[point(-100),point(200)];};
  const stations=[start,end];for(let s=start+.5;s<end;s+=.5)stations.push(s);
  if(masonry)for(let i=0;i<=40;i++)stations.push(center+radius*Math.cos(i*Math.PI/40));
  const cuts=[...new Set(stations.map(s=>Math.round(s*1e7)/1e7))].sort((a,b)=>a-b);
  const [left,right]=bridge.deckAcrossM,crossCuts=[left,right];for(let t=left+1;t<right;t+=1)crossCuts.push(t);crossCuts.sort((a,b)=>a-b);
  const deckTriangles=triangulate(bridge.outline).map(indices=>indices.map(i=>bridge.outline[i]));
  // Shared station cuts replace arbitrary chords through the curved tunnel.
  for(const source of deckTriangles)for(let i=1;i<cuts.length;i++) {
    let strip=split(source,...gate(cuts[i-1]),-1).inside;strip=split(strip,...gate(cuts[i]),1).inside;if(!strip.length)continue;
    for(let j=1;j<crossCuts.length;j++){
      let cell=split(strip,...crossGate(crossCuts[j-1]),1).inside;cell=split(cell,...crossGate(crossCuts[j]),-1).inside;if(!cell.length)continue;
      for(const[a,b,c]of triangulate(cell)){const points=[cell[a],cell[b],cell[c]];if(polygonArea(points)<0)points.reverse();
        triangle(deck,[...points[0],height(points[0])],[...points[1],height(points[1])],[...points[2],height(points[2])]);
        triangle(soffit,[...points[2],underside(points[2])],[...points[1],underside(points[1])],[...points[0],underside(points[0])]);}
    }
  }
  const beam=(out:BridgeBatch,a:Point3,b:Point3,width:number,depth:number)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,n=[-dy/l*width/2,dx/l*width/2];
    const points:Point3[]=[a,b].flatMap(p=>[[p[0]+n[0],p[1]+n[1],p[2]-depth/2],[p[0]-n[0],p[1]-n[1],p[2]-depth/2],[p[0]-n[0],p[1]-n[1],p[2]+depth/2],[p[0]+n[0],p[1]+n[1],p[2]+depth/2]] as Point3[]);
    for(let i=0;i<4;i++)quad(out,points[i],points[(i+1)%4],points[4+(i+1)%4],points[4+i]);quad(out,points[3],points[2],points[1],points[0]);quad(out,points[4],points[5],points[6],points[7]);};
  const post=(p:Point)=>{const r=.045,z=height(p),ring:Point[]=[[p[0]-r,p[1]-r],[p[0]+r,p[1]-r],[p[0]+r,p[1]+r],[p[0]-r,p[1]+r]];
    for(let i=0;i<4;i++)quad(iron,[...ring[i],z+.1],[...ring[(i+1)%4],z+.1],[...ring[(i+1)%4],z+.98],[...ring[i],z+.98]);quad(iron,[...ring[0],z+.98],[...ring[1],z+.98],[...ring[2],z+.98],[...ring[3],z+.98]);};
  for(let i=0;i<bridge.outline.length;i++){
    const a=bridge.outline[i],b=bridge.outline[(i+1)%bridge.outline.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const longitudinal=Math.abs(along(b)-along(a))/length>.55,ts=[0,1];
    for(const [values,project]of [[cuts,along],[crossCuts,across]] as const){const p=project(a),q=project(b);if(Math.abs(q-p)>1e-8)for(const c of values){const t=(c-p)/(q-p);if(t>1e-7&&t<1-1e-7)ts.push(t);}}
    const steps=Math.ceil(length/.5);for(let j=1;j<steps;j++)ts.push(j/steps);ts.sort((a,b)=>a-b);
    for(let j=1;j<ts.length;j++){const point=(t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],p=point(ts[j-1]),q=point(ts[j]);
      quad(body,[...p,height(p)],[...q,height(q)],[...q,underside(q)],[...p,underside(p)]);
      if(longitudinal){beam(stone,[...p,height(p)+.07],[...q,height(q)+.07],.28,.14);beam(iron,[...p,height(p)+.5],[...q,height(q)+.5],.055,.055);beam(iron,[...p,height(p)+.95],[...q,height(q)+.95],.065,.065);if(masonry)beam(stone,[...p,underside(p)+.07],[...q,underside(q)+.07],.15,.14);}
    }
    if(longitudinal)for(let j=0;j<=Math.ceil(length/1.3);j++){const t=j/Math.ceil(length/1.3);post([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  if(!masonry){const supports=batch('abutments',colour);for(const station of [start+.8,end-.8]){
    const pieces=deckTriangles.map(p=>split(p,...gate(station-.8),-1).inside).map(p=>split(p,...gate(station+.8),1).inside).filter(p=>p.length),top=Math.min(...pieces.flat().map(underside))-.03;
    for(const piece of pieces){for(const[a,b,c]of triangulate(piece)){triangle(supports,[...piece[a],top],[...piece[b],top],[...piece[c],top]);triangle(supports,[...piece[c],-.75],[...piece[b],-.75],[...piece[a],-.75]);}for(let i=0;i<piece.length;i++){const p=piece[i],q=piece[(i+1)%piece.length];quad(supports,[...p,-.75],[...q,-.75],[...q,top],[...p,top]);}}
  }}
  for(const b of [deck,soffit])b.normals=smoothBridgeNormals(b.positions,b.indices);
  return[...batches.values()].filter(b=>b.indices.length);
}
