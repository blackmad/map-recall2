import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bayLookFor, BAY_LAYER_COUNT } from './bayLook.js';
import { recipeBayOpenings } from './facadeOpenings.js';
import { bayTextures, STOREY_PX, type BayKind } from './bayTextures.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';

const recipe: ArchitecturalRecipe = { family: 'masonry', period: 'c19', confidence: .8,
  entranceAssembly: 'raised-plain', sash: 'transom', frameColor: 'dark', trimDensity: 'restrained', lintel: 'flat', paleAccents: false };
const near = (a: number, b: number) => Math.abs(a-b)<1e-8;

test('quiet raised family coordinates three upper columns with paired glazing and a right entrance', () => {
  for(const look of ['photo','storybook','cartoon'] as const){
    const v=bayLookFor('quiet-training',1890,14,look,'quiet',recipe).variant;
    const o=recipeBayOpenings('quiet-training',recipe,look);
    assert.equal(v.entranceAssembly,'raised-plain');
    assert.deepEqual(o.upper.axes,[.20,.47,.80]);
    assert.ok(o.ground);
    assert.deepEqual(o.ground.axes,o.upper.axes);
    assert.deepEqual(o.doorWindow!.axes,[.20,.47]);
    assert.ok(near(o.door.axis,o.upper.axes[2]));
    assert.equal(o.door.bottom,70/340);
    assert.equal(o.doorWindow!.sill,96/340);
    assert.ok(o.doorWindow!.sill>o.door.bottom);
    assert.equal(o.door.fanlight,false);
    assert.ok(o.door.axis+o.door.width/2<1);
    assert.ok(o.doorWindow!.axes[1]+o.doorWindow!.width/2<o.door.axis-o.door.width/2);
    assert.equal(v.lintel,'flat'); assert.equal(v.paleAccents,false);
    assert.equal(bayLookFor('quiet-training',1890,14,look,'quiet',{...recipe,entranceAssembly:undefined}).variant.entranceAssembly,undefined);
  }
  assert.ok(BAY_LAYER_COUNT+64<=256,'all combined procedural atlas indices fit Uint8');
});

test('painted reveals and quiet leaf match opening metadata; basement lights stay below landing', () => {
  const previous=globalThis.document;
  try{
    for(const look of ['photo','storybook','cartoon'] as const)for(const kind of ['upper','ground','groundDoor'] as BayKind[]){
      const calls:Array<{method:string;args:number[];fill:unknown}>=[];
      const values:Record<string,unknown>={createLinearGradient:()=>({addColorStop(){}})};
      const ctx=new Proxy(values,{get(t,key){if(key in t)return t[String(key)];return (...args:number[])=>calls.push({method:String(key),args,fill:t.fillStyle});},set(t,key,value){t[String(key)]=value;return true;}});
      globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;
      const v={...bayLookFor('quiet-paint-contract',1890,14,look,'quiet',recipe).variant,kind};
      bayTextures(v,{} as CanvasImageSource,look);
      const o=recipeBayOpenings('quiet-paint-contract',recipe,look), H=kind==='upper'?STOREY_PX:340;
      const row=kind==='upper'?o.upper:kind==='groundDoor'?o.doorWindow!:o.ground;
      assert.ok(row);
      for(const axis of row.axes){
        const expected=[520*(axis-row.width/2)-4,H*(1-row.head)-4,520*row.width+8,H*(row.head-row.sill)+8];
        assert.ok(calls.some(c=>c.method==='fillRect'&&c.args.every((n,i)=>near(n,expected[i]))),`${look} ${kind} reveal matches opening at ${axis}`);
      }
      assert.ok(!calls.some(c=>c.method==='ellipse'||c.method==='arc'),'quiet entry never invents arched heads');
      if(kind==='groundDoor'){
        const leaf=[520*(o.door.axis-o.door.width/2),340*(1-o.door.top),520*o.door.width,340*(o.door.top-o.door.bottom)];
        assert.ok(calls.some(c=>c.method==='fillRect'&&c.args.every((n,i)=>near(n,leaf[i]))&&c.fill==='#30342f'),'contained dark leaf follows shared door span');
      }
      if(kind!=='upper')for(const axis of [.20,.47]){
        assert.ok(calls.some(c=>c.method==='arcTo'&&near(c.args[0],520*(axis+.075))&&near(c.args[1],298)&&near(c.args[2],520*(axis+.075))&&near(c.args[3],326)), 'low basement glazing fits in the base');
        assert.ok(340-298 < o.door.bottom*340,'basement glazing remains beneath the landing');
      }
    }
  }finally{globalThis.document=previous;}
});
