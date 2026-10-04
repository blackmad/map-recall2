import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bridgeHeightAtLocal, insideBridgeOutline, bridgeLngLat, bridgeProfileAt, bridgeStationAt, bridgeSurfaceAt, bridgeVehiclePoseAt,
  validateBridgeSurfaceFile, type BridgeSurfaceFile } from '../src/canalRecall/bridgeSurface.ts';
import { buildBridgeGeometry, type BridgeBatch } from '../src/canalRecall/bridgeGeometry.ts';
import { bridgeRoadSections } from '../src/canalRecall/bridgeSurface.ts';
import { ShapeUtils, Vector2, Vector3, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Raycaster } from 'three';

const data: BridgeSurfaceFile = JSON.parse(readFileSync('public/data/extracts/amsterdam/bridge-surfaces.json','utf8'));
const report=JSON.parse(readFileSync('public/data/extracts/amsterdam/bridge-surface-review.json','utf8'));
const built=new WeakMap<object,BridgeBatch[]>();
const geometryFor=(bridge:any)=>{let value=built.get(bridge);if(!value){value=buildBridgeGeometry(bridge,ring=>ShapeUtils.triangulateShape(ring.map(p=>new Vector2(...p)),[]));built.set(bridge,value);}return value;};

test('publication and Jordaan matching evidence agree',()=>{
  assert.deepEqual(report.entries.filter((e:any)=>e.status==='ready').map((e:any)=>e.id).sort(),data.bridges.map(b=>b.id).sort());
  for(const id of ['BRU0102','BRU0130','BRU0155']){
    const entry=report.entries.find((e:any)=>e.id===id);assert.notEqual(entry.status,'unmatched',`${id}: original source omission returned`);assert.ok(entry.roadIds.length);
  }
  assert.ok(report.entries.find((e:any)=>e.id==='BRU0130').reasons.some((r:string)=>r.includes('Stair')));
  assert.ok(report.entries.find((e:any)=>e.id==='BRU0155').reasons.some((r:string)=>r.includes('Movable')));
});

test('city bridge profiles bind real identities, raster evidence and sane profiles',()=>{
  validateBridgeSurfaceFile(data);
  assert.deepEqual(data.bridges.slice(0,3).map(b=>b.id),['BRU0057','BRU0059','BRU0065']);
  assert.ok(data.bridges.length>50,'regional coverage must expand beyond the pilot');
  for(const b of data.bridges){
    assert.ok(b.widthM>=2 && b.widthM<=45);
    assert.equal(b.provenance.elevation.heightDatum,'NAP');
    assert.ok(b.provenance.elevation.rasters.every((r:any)=>/^[a-f0-9]{64}$/.test(r.sha256)));
    for(let i=0;i<b.samples.length-1;i++){
      const a=b.samples[i],c=b.samples[i+1];
      for(let t=0;t<=1;t+=.05){const p=bridgeProfileAt(b,a.s+(c.s-a.s)*t);
        assert.ok(p.heightM>=Math.min(a.heightM,c.heightM)-1e-6 && p.heightM<=Math.max(a.heightM,c.heightM)+1e-6);
        assert.ok(Math.abs(p.grade)<.3,`${b.name}: excessive grade`);
      }
    }
    assert.equal(bridgeProfileAt(b,-1).heightM,0);
    assert.equal(bridgeProfileAt(b,b.samples.at(-1)!.s+1).grade,0);
  }
});

test('rider climbs and descends the measured surface in both directions',()=>{
  for(const b of data.bridges.slice(0,3)){
    const station=b.samples.find(p=>p.s>b.roadwayRangeM[0]+2)!;
    const hit=bridgeStationAt(b,station.point),angle=Math.atan2(-hit.tangent[1],hit.tangent[0]);
    const ll=bridgeLngLat(b,station.point),forward=bridgeSurfaceAt([b],ll,angle),reverse=bridgeSurfaceAt([b],ll,angle+Math.PI);
    assert.ok(forward.heightM>.5);
    assert.ok(forward.pitch>.015);
    assert.ok(Math.abs(forward.pitch+reverse.pitch)<1e-6);
    assert.ok(Math.abs(forward.heightM-bridgeHeightAtLocal(b,station.point))<1e-6);
    assert.equal(bridgeSurfaceAt([b],[b.origin[0]+.01,b.origin[1]+.01]).heightM,0);
    assert.equal(bridgeSurfaceAt([],ll).heightM,0);
  }
});

test('deck geometry agrees with the rider surface and remains bounded',()=>{
  for(const b of data.bridges){
    const batches=geometryFor(b);
    assert.ok(batches.some(batch=>batch.kind==='soffit'));
    assert.ok(batches.some(batch=>batch.kind==='approach-sides'));
    assert.ok(batches.reduce((sum,b)=>sum+b.indices.length/3,0)<=40000);
    for(const batch of batches){
      assert.ok(batch.positions.every(Number.isFinite));
      assert.ok(batch.indices.every(i=>i>=0&&i<batch.positions.length/3));
      if(batch.kind==='deck'||batch.kind==='soffit')for(let i=0;i<batch.indices.length;i+=3){const [a,c,d]=batch.indices.slice(i,i+3).map(j=>batch.positions.slice(j*3,j*3+3));
        assert.ok(Math.abs((c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]))>=1e-5,`${b.id}: lifted planar sliver`);}
      if(batch.kind==='approach-sides')for(let i=0;i<batch.positions.length;i+=3){const s=24+batch.positions[i]*b.deckAxis[0]+batch.positions[i+1]*b.deckAxis[1],span=b.deckRangeM[1]-b.deckRangeM[0];
        assert.ok(s<=b.deckRangeM[0]+span*.15+.001||s>=b.deckRangeM[1]-span*.15-.001,`${b.id}: retaining wall intrudes into the underpass`);}
      if(batch.kind==='deck')for(let i=0;i<batch.positions.length;i+=3){
        const h=bridgeHeightAtLocal(b,[batch.positions[i],batch.positions[i+1]]);
        assert.ok(Math.abs(batch.positions[i+2]-h-.035)<.002,`${b.name}: deck/rider mismatch at ${batch.positions.slice(i,i+3)}`);
      }
    }
  }
});

test('steel abutments stay inside the survey and beneath the deck and approach',()=>{
  for(const b of data.bridges.filter(b=>b.family!=='masonry-arch')) {
    const supports=geometryFor(b)
      .find(batch=>batch.kind==='abutments')!;
    assert.ok(supports.indices.length>0);
    for(let i=0;i<supports.positions.length;i+=3) {
      const p:[number,number]=[supports.positions[i],supports.positions[i+1]];
      assert.ok(insideBridgeOutline(p,b.outline),'support protrudes into the approach');
      const deck=bridgeProfileAt(b,24+p[0]*b.deckAxis[0]+p[1]*b.deckAxis[1]).heightM+.035;
      assert.ok(supports.positions[i+2]<=deck-.37,'support intersects deck fascia');
    }
  }
});

test('invalid profiles are rejected rather than moving the rider into corrupt geometry',()=>{
  const clone=()=>JSON.parse(JSON.stringify(data));
  for(const corrupt of [(d:any)=>d.bridges[0].samples[2].heightM=null,
    (d:any)=>d.bridges[0].samples[2].s=d.bridges[0].samples[1].s,
    (d:any)=>d.bridges[0].samples[0].heightM=1,
    (d:any)=>d.bridges.push(d.bridges[0])]){
    const d=clone();corrupt(d);assert.throws(()=>validateBridgeSurfaceFile(d));
  }
});

test('an exaggerated bicycle rests on both wheels at the crest and on the slope',()=>{
  for(const b of data.bridges)for(const station of [b.samples.reduce((a,c)=>a.heightM>c.heightM?a:c),b.samples.find(p=>p.s>b.roadwayRangeM[0]+3)!]){
    const ll=bridgeLngLat(b,station.point),axis=bridgeStationAt(b,station.point).tangent,angle=Math.atan2(-axis[1],axis[0]);
    const contacts:[number,number]=[-4,4];
    const pose=bridgeVehiclePoseAt([b],ll,angle,contacts);
    for(const offset of contacts){
      const p:[number,number]=[station.point[0]+axis[0]*offset*Math.cos(pose.pitch),station.point[1]+axis[1]*offset*Math.cos(pose.pitch)];
      assert.ok(Math.abs(pose.heightM+offset*Math.sin(pose.pitch)-bridgeHeightAtLocal(b,p))<.003);
    }
  }
});

test('the rendered road has no gaps at surveyed deck and approach joins',()=>{
  for(const b of data.bridges){
    const deck=geometryFor(b).find(batch=>batch.kind==='deck')!;
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(deck.positions,3));geometry.setIndex(deck.indices);
    const material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material);
    const ray=new Raycaster();
    for(let i=0;i<b.samples.length-1;i++)for(const t of [.1,.5,.9]){
      const a=b.samples[i],c=b.samples[i+1],p:[number,number]=[a.point[0]+(c.point[0]-a.point[0])*t,a.point[1]+(c.point[1]-a.point[1])*t];
      // Float32 raster geometry can place the exact mathematical centerline on
      // either side of a shared triangle edge. Probe a sub-millimetre neighbor
      // too; a genuine missing deck/approach wedge fails both rays.
      ray.set(new Vector3(...p,10),new Vector3(0,0,-1));
      let hit=ray.intersectObject(mesh)[0];
      if(!hit){ray.set(new Vector3(p[0]+.0005,p[1]+.0005,10),new Vector3(0,0,-1));hit=ray.intersectObject(mesh)[0];}
      assert.ok(hit,`${b.name}: missing surface at station ${a.s}`);
      assert.ok(Math.abs(hit.point.z-bridgeHeightAtLocal(b,p)-.035)<.035,`${b.name}: rider/mesh separation at ${a.s}`);
    }
    const sections=bridgeRoadSections(b);
    for(let i=1;i<sections.length;i++)for(const t of [.2,.8])for(const across of [.15,.85]){
      const a=sections[i-1],c=sections[i],edge=(key:'left'|'right')=>[a[key][0]+(c[key][0]-a[key][0])*t,a[key][1]+(c[key][1]-a[key][1])*t];
      const left=edge('left'),right=edge('right'),p:[number,number]=[left[0]+(right[0]-left[0])*across,left[1]+(right[1]-left[1])*across],h=bridgeHeightAtLocal(b,p);
      if(h<.01)continue;ray.set(new Vector3(...p,10),new Vector3(0,0,-1));const hit=ray.intersectObject(mesh)[0];
      assert.ok(hit&&Math.abs(hit.point.z-h-.035)<.035,`${b.id}: road shoulder continuity`);
    }
    geometry.dispose();material.dispose();
  }
});

test('arch tunnels follow the same curve across their whole width',()=>{
  for(const b of data.bridges.filter(b=>b.family==='masonry-arch')){
    const soffit=geometryFor(b).find(batch=>batch.kind==='soffit')!;
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(soffit.positions,3));geometry.setIndex(soffit.indices);
    const material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material),ray=new Raycaster();
    const [start,end]=b.deckRangeM,center=(start+end)/2,radius=(end-start)*.35;
    for(const u of [-.8,-.4,0,.4,.8])for(const width of [.15,.5,.85]){
      const s=center+radius*u,t=b.deckAcrossM[0]+(b.deckAcrossM[1]-b.deckAcrossM[0])*width;
      const p:[number,number]=[b.deckAxis[0]*(s-24)-b.deckAxis[1]*t,b.deckAxis[1]*(s-24)+b.deckAxis[0]*t];
      if(!insideBridgeOutline(p,b.outline))continue;
      const top=bridgeProfileAt(b,s).heightM+.035,expected=Math.min(top-.35,-.75+(top+.4)*Math.sqrt(1-u*u));
      ray.set(new Vector3(...p,-2),new Vector3(0,0,1));const hit=ray.intersectObject(mesh)[0];
      assert.ok(hit&&Math.abs(hit.point.z-expected)<.025,`${b.id}: sagging or missing arch tunnel at ${u}, ${width}`);
    }
    geometry.dispose();material.dispose();
  }
});
