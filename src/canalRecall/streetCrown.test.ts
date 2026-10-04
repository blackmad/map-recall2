import assert from 'node:assert/strict';
import test from 'node:test';
import { streetCrown, type StreetCrownFront } from './streetCrown.js';
import type { RoofTri } from './roofMesh.js';
const face:RoofTri={p:[[0,0,10],[6,0,10],[3,0,14]],uv:[[0,0],[1,0],[.5,1]],part:'plate',n:[0,-1,0]};
const front:StreetCrownFront={start:[0,0],end:[6,0],normal:[0,-1],tint:[70,62,55],plainLayer:17,frameHex:'#e6e1d4',glassHex:'#35464f',recipe:{family:'masonry',period:'canal',confidence:.8,atticWindows:true}};

test('crown follows the actual front tint while roof vertices, rear faces and sourced colours stay intact',()=>{
  const rear:RoofTri={...face,p:face.p.map(([x,y,z])=>[x,y+8,z]) as RoofTri['p'],n:[0,1,0]};
  const sourced:RoofTri={...face,hex:'#abcdef'},slope:RoofTri={...face,part:'slope',n:[0,-.5,.5]};
  const roof=[face,rear,sourced,slope],before=JSON.stringify(roof),result=streetCrown(roof,[front],10,false);
  assert.deepEqual(result[0].facadeTint,front.tint);assert.equal(result[0].facadeLayer,17);
  assert.equal(result[0].p,face.p);assert.equal(result[0].uv,face.uv);
  assert.equal(result[1],rear);assert.equal(result[2],sourced);assert.equal(result[3],slope);
  assert.equal(JSON.stringify(roof),before);
});
test('attic glazing tapers to fit the real crown without changing its silhouette',()=>{
  const result=streetCrown([face],[front],10,true),windows=result.slice(1);
  assert.equal(windows.length,18,'two lower attic windows and one smaller upper window');
  for(const t of windows)for(const [x,y,z]of t.p){
    assert.equal(t.part,'decal');assert.ok(y<0&&y>-.04);
    const lo=(z-10)*.75,hi=6-lo;assert.ok(x>=lo&&x<=hi,'every glazing/frame corner fits existing triangle');
    assert.ok(z>10&&z<14);
  }
});
test('a narrowing step cannot intersect a window and short or incompatible roofs get no invented attic',()=>{
  const lower:RoofTri[]=[{...face,p:[[0,0,10],[6,0,10],[6,0,11]]},{...face,p:[[0,0,10],[6,0,11],[0,0,11]]}];
  const upper:RoofTri[]=[{...face,p:[[2,0,11],[4,0,11],[4,0,14]]},{...face,p:[[2,0,11],[4,0,14],[2,0,14]]}];
  const result=streetCrown([...lower,...upper],[front],10,true);
  for(const t of result.slice(4))for(const [x,,z]of t.p)if(z>=11)assert.ok(x>=2&&x<=4);
  const short={...face,p:face.p.map(([x,y,z])=>[x,y,10+(z-10)*.3]) as RoofTri['p']};
  assert.equal(streetCrown([short],[front],10,true).length,1);
  assert.equal(streetCrown([face],[{...front,recipe:{...front.recipe,period:'modern'}}],10,true).length,1);
  assert.equal(streetCrown([face],[front],10,false).length,1);
  assert.deepEqual(streetCrown([face],[],10,true),[face]);
});
