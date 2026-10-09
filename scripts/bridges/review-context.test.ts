import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide, Raycaster, ShapeUtils, Vector2, Vector3 } from 'three';
import { buildBridgeReviewContext } from '../../src/canalRecall/bridgeReviewContext.ts';
import { buildBridgeGeometry } from '../../src/canalRecall/bridgeGeometry.ts';
import { insideBridgeOutline, type BridgeSurface } from '../../src/canalRecall/bridgeSurface.ts';
const bridges:BridgeSurface[]=JSON.parse(readFileSync('public/data/extracts/amsterdam/bridge-surfaces.json','utf8')).bridges;
test('gallery quays leave the canal open beneath every generated bridge',()=>{
  const material=new MeshBasicMaterial({side:DoubleSide});
  for(const b of bridges){
    const quay=buildBridgeReviewContext(b).find(batch=>batch.kind==='review-quay')!;
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(quay.positions,3));geometry.setIndex(quay.indices);
    const mesh=new Mesh(geometry,material),axis=b.deckAxis,s=(b.deckRangeM[0]+b.deckRangeM[1])/2-24;
    const point=new Vector3(axis[0]*s,axis[1]*s,-.4);
    for(const sign of [-1,1]){
      const direction=new Vector3(quay.positions[3]-quay.positions[0],quay.positions[4]-quay.positions[1],0).normalize().multiplyScalar(sign);
      const ray=new Raycaster(point,direction,0,30);
      assert.equal(ray.intersectObject(mesh).length,0,`${b.id}: gallery quay blocks the underpass`);
    }
    geometry.dispose();
  }
  material.dispose();
});
test('ramp shoulders meet ground and keep the bridge opening clear',()=>{
  const chosen=new Map<string,BridgeSurface>();
  for(const b of bridges)if(!chosen.has(b.family))chosen.set(b.family,b);
  for(const b of [...bridges.slice(0,3),...chosen.values()]){
    const batch=buildBridgeGeometry(b,ring=>ShapeUtils.triangulateShape(ring.map(p=>new Vector2(...p)),[]))
      .find(batch=>batch.kind==='approach-sides')!;
    assert.ok(batch.indices.length);
    let ground=0;
    for(let i=0;i<batch.positions.length;i+=3){
      const [x,y,z]=batch.positions.slice(i,i+3),station=24+x*b.deckAxis[0]+y*b.deckAxis[1];
      assert.ok(z>=0,`${b.id}: approach extends below ground`);if(z===0)ground++;
      assert.ok(station<=b.deckRangeM[0]+.02||station>=b.deckRangeM[1]-.02,`${b.id}: shoulder enters the arch`);
      if(z===0)assert.ok(!insideBridgeOutline([x,y],b.outline)||station<=b.deckRangeM[0]+.02||station>=b.deckRangeM[1]-.02);
    }
    assert.ok(ground>0);
  }
});
