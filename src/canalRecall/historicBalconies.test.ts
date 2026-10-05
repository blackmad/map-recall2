import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bayLookFor, BAY_LAYER_COUNT, BAY_ENTRIES } from './bayLook.js';
import { recipeBayOpenings } from './facadeOpenings.js';
import { ExtraSink, openBalconyStack, wallExtras, type ExtraContext } from './facadeExtras.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';

const recipe: ArchitecturalRecipe={family:'masonry',period:'c19',confidence:.8,facadeAssembly:'stacked-iron-balcony',sash:'paired-transom',frameHex:'#ece7db',trimDensity:'restrained'};
const context=():ExtraContext=>({id:'historic-stack',style:'c19',period:'c19',wallKey:'front',
 f:{x0:0,y0:0,ux:1,uy:0,nx:0,ny:-1,len:6},base:0,top:19,
 layout:{bays:2,bayWidthM:3,groundM:3.4,storeys:5,storeyM:3.1,doorBays:[0]},
 wallHex:'#a46c56',accentHex:'#30362e',groundLevel:true,streetSide:true,recipe,
 openings:recipeBayOpenings('historic-stack',recipe)});

test('explicit historic access compiles one paired opening while mapped shops and generic families survive',()=>{
 assert.ok(BAY_LAYER_COUNT+64<=256,'bounded cells fit byte-indexed atlas');
 for(const period of ['c19','canal'] as const)for(const look of ['photo','storybook','cartoon'] as const){
  const r={...recipe,period}, b=bayLookFor('historic',1880,19,look,'shopCafe',r), o=recipeBayOpenings('historic',r,look);
  for(const layer of [...Object.values(b.layers),b.plain])assert.ok(Number.isInteger(layer)&&layer>=0&&layer+64<256,'actual dispatched layer fits procedural atlas');
  assert.equal(b.variant.facadeAssembly,'stacked-iron-balcony');assert.equal(b.variant.windows,1);
  assert.deepEqual(o.upper.axes,[.5]);assert.equal(o.upper.width,.32);assert.equal(b.variant.sash,'paired-transom');
  assert.equal(BAY_ENTRIES[b.layers.ground].kind,'shopCafe','genuine mapped cafe retains its shared shop cell');
  assert.ok(b.groundHex,'genuine cafe ground paint survives');
  assert.equal(bayLookFor('generic',1880,19,look,'quiet').variant.facadeAssembly,undefined);
 }
});

test('historic stack has three complete black open rails on an actual central upper axis, independent of shop/door axis',()=>{
 const c=context();c.shopfront=true;
 const s=new ExtraSink(180);openBalconyStack(c,s,.5);
 assert.equal(s.tris.length,162,'three divided access levels without modern structural bands');
 const decks=s.tris.filter(t=>t.hex==='#b9b5ac');assert.equal(decks.length,30);
 const axis=1.5; // two central opening candidates tie; stable first selection, not left ground leaf axis
 assert.notEqual(axis,c.openings!.door.axis*c.layout.bayWidthM);
 for(let k=0;k<3;k++){
  const p=decks.slice(k*10,(k+1)*10).flatMap(t=>t.p);
  assert.ok(Math.abs((Math.min(...p.map(v=>v[0]))+Math.max(...p.map(v=>v[0])))/2-axis)<1e-8);
  assert.ok(Math.abs(Math.max(...p.map(v=>v[2]))-(3.44+k*3.1))<1e-8);
 }
 const rails=s.tris.filter(t=>t.hex==='#26282b');assert.ok(rails.length>0);
 for(const t of rails){const xs=t.p.map(p=>p[0]),zs=t.p.map(p=>p[2]);assert.ok(Math.max(...xs)-Math.min(...xs)<.05||Math.max(...zs)-Math.min(...zs)<.05);}
 assert.ok(!s.tris.some(t=>Math.max(...t.p.map(p=>p[2]))-Math.min(...t.p.map(p=>p[2]))>4),'no full-height modern bands');
 for(const t of s.tris)for(const p of t.p)assert.ok(p.every(Number.isFinite)&&p[0]>=0&&p[0]<=6&&-p[1]<=.51&&p[2]<=c.top);
});

test('historic assembly priority is explicit and budgets retain complete levels only',()=>{
 const c=context();
 for(const budget of [0,20,55,56,111,112,180,230]){
  const s=new ExtraSink(budget);openBalconyStack(c,s,.5);
  assert.ok(s.tris.length<=budget);assert.equal(s.tris.length%54,0);assert.ok(s.tris.length<=162);
 }
 for(let i=0;i<12;i++){
  const s=new ExtraSink(230),used=wallExtras({...c,id:`historic${i}`,shopfront:true},s);
  assert.equal(used[0],'historic-balcony-stack');
  assert.ok(!used.some(v=>['iron-balconies','glass-balconies','balcony-slabs','gallery-walkway'].includes(v)));
  assert.ok(s.tris.length<=180);
 }
 const s=new ExtraSink(230),used=wallExtras({...c,recipe:{...recipe,facadeAssembly:undefined}},s);
 assert.ok(!used.includes('historic-balcony-stack'),'ordinary historic fronts retain probabilistic original balconies');
});
