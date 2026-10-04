import { ShapeUtils, Vector2, Vector3, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Raycaster } from 'three';
import { buildBridgeGeometry } from '../../src/canalRecall/bridgeGeometry.ts';
import { bridgeHeightAtLocal, bridgeRoadSections, bridgeStationAt, bridgeLngLat, bridgeVehiclePoseAt, type BridgeSurface } from '../../src/canalRecall/bridgeSurface.ts';

/** Reject broken geometry before it can replace a working flat crossing. */
export function preflightBridge(bridge:BridgeSurface) {
  for(const station of [bridge.samples.reduce((a,c)=>a.heightM>c.heightM?a:c),bridge.samples.find(p=>p.s>bridge.roadwayRangeM[0]+3)!]){
    const axis=bridgeStationAt(bridge,station.point).tangent,angle=Math.atan2(-axis[1],axis[0]),pose=bridgeVehiclePoseAt([bridge],bridgeLngLat(bridge,station.point),angle,[-4,4]);
    for(const offset of [-4,4]){const p:[number,number]=[station.point[0]+axis[0]*offset*Math.cos(pose.pitch),station.point[1]+axis[1]*offset*Math.cos(pose.pitch)];
      if(Math.abs(pose.heightM+offset*Math.sin(pose.pitch)-bridgeHeightAtLocal(bridge,p))>.003)throw Error('Exaggerated bicycle cannot maintain both wheel contacts');}
  }
  const batches=buildBridgeGeometry(bridge,ring=>ShapeUtils.triangulateShape(ring.map(p=>new Vector2(...p)),[]));
  const triangles=batches.reduce((sum,b)=>sum+b.indices.length/3,0);
  if(triangles>40000||batches.some(b=>b.positions.some(p=>!Number.isFinite(p))))throw Error('Geometry exceeds the per-bridge budget');
  const deck=batches.find(b=>b.kind==='deck')!;
  for(let i=0;i<deck.positions.length;i+=3)if(Math.abs(deck.positions[i+2]-bridgeHeightAtLocal(bridge,[deck.positions[i],deck.positions[i+1]])-.035)>.002)
    throw Error('Surveyed deck edge disagrees with the shared road surface');
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(deck.positions,3));geometry.setIndex(deck.indices);
  const material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material),ray=new Raycaster();
  try {
    for(let i=1;i<bridge.samples.length;i++)for(const t of [.1,.5,.9]) {
      const a=bridge.samples[i-1].point,b=bridge.samples[i].point,p:[number,number]=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      const expected=bridgeHeightAtLocal(bridge,p)+.035;
      ray.set(new Vector3(...p,10),new Vector3(0,0,-1));let hit=ray.intersectObject(mesh)[0];
      if(!hit){ray.set(new Vector3(p[0]+.0005,p[1]+.0005,10),new Vector3(0,0,-1));hit=ray.intersectObject(mesh)[0];}
      if(!hit||Math.abs(hit.point.z-expected)>.035)throw Error(`Deck/approach join fails road continuity checks at station ${bridge.samples[i-1].s.toFixed(2)} (${hit?`height error ${(hit.point.z-expected).toFixed(3)}m`:'missing triangle'})`);
    }
    const sections=bridgeRoadSections(bridge);
    for(let i=1;i<sections.length;i++)for(const t of [.2,.8])for(const across of [.15,.85]){
      const a=sections[i-1],b=sections[i],edge=(key:'left'|'right')=>[a[key][0]+(b[key][0]-a[key][0])*t,a[key][1]+(b[key][1]-a[key][1])*t];
      const left=edge('left'),right=edge('right'),p:[number,number]=[left[0]+(right[0]-left[0])*across,left[1]+(right[1]-left[1])*across];
      const h=bridgeHeightAtLocal(bridge,p);if(h<.01)continue;
      ray.set(new Vector3(...p,10),new Vector3(0,0,-1));const hit=ray.intersectObject(mesh)[0];
      if(!hit||Math.abs(hit.point.z-h-.035)>.035)throw Error(`Road shoulder fails full-width continuity checks (${p.map(n=>n.toFixed(2)).join(',')}; ${hit?`height error ${(hit.point.z-h-.035).toFixed(3)}m`:'missing triangle'})`);
    }
  }finally{geometry.dispose();material.dispose();}
  return{triangles,checks:'finite-geometry-budget-centerline-and-full-width-continuity'};
}
