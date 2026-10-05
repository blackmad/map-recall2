import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BAY_LAYER_COUNT, bayLookFor, bayVariant, BAY_ENTRIES } from './bayLook.js';
import { bayVariantOpenings, recipeBayOpenings, bayLookOpenings } from './facadeOpenings.js';
import { archetypeFor, bayTextures, variantKey, type BayVariant } from './bayTextures.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';

const recipe = (over: Partial<ArchitecturalRecipe> = {}): ArchitecturalRecipe => ({ family: 'masonry', period: 'c19', confidence: .8, ...over });
test('year does not force ribbon glazing; observed families remain distinct', () => {
  for (const look of ['photo', 'storybook', 'cartoon'] as const) {
    for (let i = 0; i < 50; i++) assert.equal(bayLookFor(`modern${i}`, 1965, 15, look).variant.family, 'punched');
    for (const family of ['punched', 'ribbon', 'curtain'] as const) {
      const chosen = bayLookFor('x', 1900, 12, look, 'quiet', recipe({ family }));
      assert.equal(chosen.variant.family, family);
      assert.equal(!!recipeBayOpenings('x', recipe({ family }), look).ribbon, family !== 'punched');
    }
  }
  assert.ok(BAY_LAYER_COUNT + 64 <= 256, 'combined procedural and bay texture layers fit Uint8 indices');
});
test('unsupported construction period does not invent a different family per building', () => {
  for (let i = 0; i < 50; i++) {
    assert.equal(archetypeFor(`unknown${i}`, null, 15), 'c19');
    assert.equal(archetypeFor(`unknown${i}`, null, 35), 'modern');
  }
});
test('observed wall colours retain rendering-mode palette treatment', () => {
  const observed = recipe({ wallHex: '#b05a40' });
  assert.equal(bayLookFor('colour', 1900, 12, 'photo', 'quiet', observed).wallHex, '#b05a40');
  assert.notEqual(bayLookFor('colour', 1900, 12, 'storybook', 'quiet', observed).wallHex, '#b05a40');
  assert.notEqual(bayLookFor('colour', 1900, 12, 'cartoon', 'quiet', observed).wallHex, '#b05a40');
});
test('recipes select local masonry details without arching the glazing', () => {
  const pale = recipe({ paleAccents: true, lintel: 'arch', windowProportions: 'tall', wallHex: '#b05a40' });
  const chosen = bayLookFor('overtoom', 1965, 16, 'photo', 'quiet', pale);
  assert.equal(chosen.variant.paleAccents, true);
  assert.equal(chosen.variant.lintel, 'arch');
  assert.equal(chosen.variant.shape, 'rect');
  assert.equal(chosen.wallHex, '#b05a40');
  assert.equal(recipeBayOpenings('overtoom', pale).upper.arch, false);
  assert.deepEqual(chosen, bayLookFor('overtoom', 1965, 16, 'photo', 'quiet', pale));
  assert.equal(bayLookOpenings('x', 'c19').upper.arch, false);
  assert.equal(bayLookFor('wallen', 1700, 15, 'photo', 'quiet', recipe({ period: 'canal', frameColor: 'dark' })).variant.frameTone, 'dark');
});
test('every bounded variant has contained openings and look-specific widths', () => {
  for (const entry of BAY_ENTRIES) {
    const v = bayVariant(entry), o = bayVariantOpenings(v);
    assert.ok(o.upper.width > 0 && o.upper.width <= 1);
    assert.ok(o.upper.sill >= 0 && o.upper.head <= 1 && o.upper.head > o.upper.sill);
    if (!o.ribbon && v.archetype !== 'school' && !v.openingOccupancy) assert.ok(bayVariantOpenings(v, 'cartoon').upper.width > o.upper.width);
  }
});
test('street recipes use source-supported sparse sash and normalized occupancy', () => {
  const v = bayLookFor('street', 1890, 15, 'photo', 'quiet', recipe({ windowWidth: .55, windowHeight: .73 })).variant;
  assert.equal(v.sash, 'transom');
  assert.equal(v.trimDensity, 'restrained');
  const o = recipeBayOpenings('street', recipe({ windowWidth: .55, windowHeight: .73 }));
  assert.equal(o.upper.axes.length * o.upper.width, .55);
  assert.ok(Math.abs(o.upper.head - o.upper.sill - .70) < 1e-9);
});
test('cache key includes decorative and opening recipe settings', () => {
  const v: BayVariant = { archetype: 'c19', kind: 'upper', windows: 2, shape: 'rect', shutters: false, paintedFrames: false };
  for (const change of [{ family: 'ribbon' }, { proportions: 'wide' }, { frameTone: 'dark' }, { lintel: 'arch' }, { paleAccents: true }] as Partial<BayVariant>[]) assert.notEqual(variantKey(v, 'photo'), variantKey({ ...v, ...change }, 'photo'));
});
test('painter draws alternating pale blocks and a masonry arch outside rectangular glazing', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }) }, { get(target, key) {
    if (key in target) return target[key as keyof typeof target];
    return (...args: unknown[]) => calls.push({ method: String(key), args });
  }, set: () => true });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  try {
    const v = { ...bayLookFor('paint', 1890, 12, 'photo', 'quiet', recipe({ paleAccents: true, lintel: 'arch' })).variant, kind: 'upper' as const };
    bayTextures(v, {} as CanvasImageSource, 'photo');
    assert.ok(calls.some(c => c.method === 'ellipse'), 'arched masonry head');
    assert.ok(calls.some(c => c.method === 'fillRect' && c.args[2] === 10 && c.args[3] === 12), 'pale alternating jamb accents');
    assert.ok(!calls.some(c => c.method === 'arc'), 'no arched glazing');
  } finally { globalThis.document = previous; }
});

test('restrained relief adds thin frames and headers without keystones', async () => {
  const { ExtraSink, WALL_COMPONENTS } = await import('./facadeExtras.js');
  const local = recipe({ trimDensity: 'restrained' });
  const c = { id: 'thin', style: 'c19' as const, wallKey: 'front', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 5 }, base: 0, top: 10,
    layout: { bays: 1, bayWidthM: 5, groundM: 3.4, storeys: 2, storeyM: 3.1, doorBays: [] }, wallHex: '#815c49', accentHex: '#eee8de', groundLevel: true,
    openings: recipeBayOpenings('thin', local), recipe: local };
  for (const id of ['white-window-frames', 'white-lintels']) {
    const sink = new ExtraSink(1000);
    WALL_COMPONENTS.find(comp => comp.id === id)!.build(c, sink, .2);
    assert.ok(sink.tris.length > 0);
    assert.ok(Math.max(...sink.tris.flatMap(t => t.p.map(p => -p[1]))) <= .026, 'relief projects at most 2.5cm');
    if (id === 'white-lintels') assert.ok(sink.tris.every(t => Math.max(...t.p.map(p => p[2])) - Math.min(...t.p.map(p => p[2])) <= .051), 'header is 5cm high without keystone');
  }
});

test('modern material is independent of family and entries never overlap adjacent windows', () => {
  const r = recipe({ family: 'punched', period: 'modern', wallMaterial: 'brick' });
  const chosen = bayLookFor('communal', 1985, 18, 'photo', 'quiet', r);
  assert.equal(chosen.variant.family, 'punched');
  assert.equal(chosen.variant.wallMaterial, 'brick');
  const o = recipeBayOpenings('communal', r);
  assert.equal(o.door.fanlight, false);
  const d = o.door.axis + o.door.width / 2;
  const w = o.doorWindow!.axes[0] - o.doorWindow!.width / 2;
  assert.ok(d < w, 'door and neighbor window have a masonry pier between them');
});

test('profile shops use a separate quiet atlas set without painted terrace props', () => {
  const local = recipe({ sash: 'transom' });
  const quiet = bayLookFor('shop', 1900, 15, 'photo', 'shopCafe', local);
  const generic = bayLookFor('shop', 1900, 15, 'photo', 'shopCafe');
  assert.notEqual(quiet.layers.ground, generic.layers.ground);
  const v = bayVariant(BAY_ENTRIES[quiet.layers.ground]);
  assert.equal(v.trimDensity, 'restrained');
  const calls: string[] = [];
  const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }) }, { get(target, key) {
    if (key in target) return target[key as keyof typeof target];
    return () => calls.push(String(key));
  }, set: () => true });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) } as unknown as Document;
  try {
    bayTextures(v, {} as CanvasImageSource, 'photo');
    assert.ok(!calls.includes('arc') && !calls.includes('ellipse'), 'no scallops, tables, painted flowers or wheels');
  } finally { globalThis.document = previous; }
});

test('connected pale entry stays aligned, contained and affordable before upper trim', async () => {
  const { ExtraSink, wallExtras } = await import('./facadeExtras.js');
  const { restrainedDoorSurround, doorSpan } = await import('./facadeOrnaments.js');
  const r = recipe({ trimDensity: 'restrained', trim: { frames: 1, lintels: 1, cornice: 0, courses: 0, quoins: 0, arches: .3 } });
  const c = { id: 'entry', style: 'c19' as const, period: 'c19' as const, wallKey: 'front', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 5 }, base: 0, top: 15,
    layout: { bays: 1, bayWidthM: 5, groundM: 3.4, storeys: 3, storeyM: 3.1, doorBays: [0] }, wallHex: '#815c49', accentHex: '#eee8de', groundLevel: true,
    openings: recipeBayOpenings('entry', r), recipe: r, streetSide: true };
  const s = new ExtraSink(230);
  restrainedDoorSurround(c, s, .5);
  const d = doorSpan(c)!;
  assert.ok(s.tris.length > 0 && s.tris.length <= 20);
  for (const t of s.tris) for (const p of t.p) {
    assert.ok(p[0] >= d.x - d.hw - .13 && p[0] <= d.x + d.hw + .13);
    assert.ok(-p[1] <= .061 && p[2] < c.layout.groundM);
  }
  const shops = new ExtraSink(230);
  restrainedDoorSurround({ ...c, shopfront: true }, shops, .2);
  assert.equal(shops.tris.length, 0, 'no invented entry surround on a mapped shopfront');
  const budget = new ExtraSink(230), used = wallExtras(c, budget);
  assert.equal(used[0], 'door-surround', 'connected entry gets priority within wall budget');
  assert.ok(budget.tris.length <= 230);
});

test('supported balcony assembly selects grouped tall glazing and residential ground instead of random shops', () => {
  const r = recipe({family:'punched',period:'modern',facadeAssembly:'stacked-open-balcony',sash:'paired-transom'});
  for (let i=0;i<20;i++) {
    const b=bayLookFor(`infill${i}`,1992,12,'photo',undefined,r);
    assert.equal(b.variant.windows,3);assert.equal(b.variant.sash,'paired-transom');
    assert.equal(b.variant.facadeAssembly,'stacked-open-balcony');
    assert.equal(b.groundHex,undefined);
    const o=recipeBayOpenings(`infill${i}`,r);
    assert.equal(o.upper.axes.length,3);assert.ok(o.upper.head-o.upper.sill>.65);
  }
  assert.ok(BAY_LAYER_COUNT+64<=256,'all modes fit the common texture array');
});

test('paired transom glazing draws a vertical divider as well as the upper transom', () => {
  const rects:number[][]=[];
  const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get(target,key){if(key in target)return target[key as keyof typeof target];return (...a:number[])=>{if(key==='fillRect')rects.push(a)}},set:()=>true});
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;
  try {
    const b=bayLookFor('paired',1992,12,'photo',undefined,recipe({family:'punched',period:'modern',facadeAssembly:'stacked-open-balcony',sash:'paired-transom'}));
    bayTextures({...b.variant,kind:'upper'},{} as CanvasImageSource,'photo');
    assert.ok(rects.some(r=>r[2]===4&&r[3]>150),'tall central glazing bar');
    assert.ok(rects.some(r=>r[3]===4&&r[2]>70),'upper transom');
  } finally {globalThis.document=previous;}
});

test('joint infill keeps mapped generic shop identity but uses grouped ground glazing and a centered access leaf', () => {
  const r=recipe({family:'punched',period:'modern',facadeAssembly:'stacked-open-balcony',sash:'paired-transom',groundWallHex:'#787b76'});
  const generic=bayLookFor('grouped',1992,12,'photo','shopWindow',r), residential=bayLookFor('grouped',1992,12,'photo','quiet',r);
  assert.equal(generic.layers.ground,residential.layers.ground,'display designation does not force the generic fascia template');
  assert.equal(generic.groundHex,'#787b76');
  const o=recipeBayOpenings('grouped',r);
  assert.equal(o.door.axis,.5);assert.deepEqual(o.doorWindow!.axes,[.17,.83]);
  assert.ok(o.doorWindow!.axes[0]+o.doorWindow!.width/2<o.door.axis-o.door.width/2);
  assert.ok(o.doorWindow!.axes[1]-o.doorWindow!.width/2>o.door.axis+o.door.width/2);
  assert.ok(o.ground!.head-o.ground!.sill>.65);
  const cafe=bayLookFor('grouped',1992,12,'photo','shopCafe',r);
  assert.notEqual(cafe.layers.ground,residential.layers.ground,'specific mapped cafe front remains distinct');
});

test('segmental glazing, casing and mask share shallow curves, while flat heads stay rectangular',()=>{
 const calls:Array<{method:string;args:unknown[]}> = [];
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get(target,key){if(key in target)return target[key as keyof typeof target];return (...args:unknown[])=>calls.push({method:String(key),args});},set:()=>true});
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>ctx})} as unknown as Document;
 try {
  const r:ArchitecturalRecipe={family:'masonry',period:'canal',confidence:.9,openingGroup:'canal-two',groundAssembly:'tall-commercial',windowHead:'segmental',sash:'paired-transom',trimDensity:'restrained'};
  const v={...bayLookFor('bow',1700,14,'photo',undefined,r).variant,kind:'upper' as const};
  bayTextures(v,{} as CanvasImageSource,'photo');
  assert.ok(calls.filter(c=>c.method==='quadraticCurveTo').length>=12,'both colour and mask retain curved casing and glazing');
  assert.ok(!calls.some(c=>c.method==='arc'),'no semicircular window arch');
  calls.length=0;bayTextures({...v,shape:'rect'},{} as CanvasImageSource,'photo');
  assert.ok(!calls.some(c=>c.method==='quadraticCurveTo'),'flat head remains an independent choice');
 } finally {globalThis.document=previous;}
});
