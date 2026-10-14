import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates, LARGE_BUDGET_TRIANGLES} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';
import {dissolveFaces} from '../blockBuilding/dissolve.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const LARGE = ['politie-van-leijenberghlaan', 'leidsestraat-67-large', 'de-balie-large', 'social-history-large', 'kattenburg-wings-164938', 'heinekenplein-130580', 'kattenburgerstraat-164930', 'beursplein-5-165051', 'damrak-77-165746', 'warmoesstraat-garage-165687', 'engelsesteeg-165098', 'oz-achterburgwal-233-180196', 'westerdok-186086', 'nieuwe-achtergracht-253754', 'aambeeldstraat-202176', 'oude-turfmarkt-168172'];

async function gatesOf(intent: LargeBuildingIntent, f: BuildingFacts) {
  const built = compileBuilding(intent, f);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  return {built, tris, gates: evaluateLargeGates(tris, built).gates};
}

test('large intent schema: coordinates, unknown keys, duplicate surfaces and component prerequisites are rejected', () => {
  const base = raw('politie-van-leijenberghlaan');
  assert.equal(validateLargeIntent(base).id, 'politie-van-leijenberghlaan');
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], widthM: 40}]}), /coordinate\/metric|widthM/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], gable: 'neck'}]}), /gable/);
  assert.throws(() => validateLargeIntent({...base, walls: [base.walls[0], {...base.walls[2], wallSurfaces: [57]}]}), /57/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], police: {lamp: true}}]}), /lamp/);
  assert.throws(() => validateLargeIntent({...base, walls: [base.walls[0], {...base.walls[2], alignWith: 0, storeys: 3}]}), /alignWith/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], alignWith: 0}]}), /alignWith/);
});

test('fitLarge is deterministic and keeps coplanar surfaces of different wall groups in separate panels', () => {
  for (const id of LARGE) {
    const intent = validateLargeIntent(raw(id)), f = facts(id);
    const a = fitLarge(intent, f), b = fitLarge(intent, f);
    assert.equal(JSON.stringify(a), JSON.stringify(b), id);
    assert.deepEqual(a.report.warnings, [], id);
  }
  // Leidsestraat 67: surfaces 15 (ribbon front), 28 (stair tower) and 48 (brick part) are one 3DBAG plane, three groups.
  const {recipe} = fitLarge(validateLargeIntent(raw('leidsestraat-67-large')), facts('leidsestraat-67-large'));
  assert.deepEqual(recipe.groups.slice(0, 3).map(g => g.panels.length), [1, 1, 1]);
  assert.deepEqual(recipe.groups.slice(0, 3).map(g => g.system), ['ribbon-windows', 'brick-bay-grid', 'brick-bay-grid']);
  // De Balie: the wings share the centre block's storey lines (alignWith).
  const balie = fitLarge(validateLargeIntent(raw('de-balie-large')), facts('de-balie-large')).recipe;
  assert.equal(balie.groups[1].storeyHeightsM[0], balie.groups[0].storeyHeightsM[0]);
});

test('large customers pass the large-tier gates within the 12k budget', async () => {
  for (const id of LARGE) {
    const {gates, tris} = await gatesOf(validateLargeIntent(raw(id)), facts(id));
    assert.ok(tris.length <= LARGE_BUDGET_TRIANGLES, `${id}: ${tris.length}`);
    assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), [], id);
  }
});

test('police signature components build and stay attached (stripe, blue lamp, canopy, garage doors, roof plant)', async () => {
  const base = validateLargeIntent(raw('politie-van-leijenberghlaan'));
  // The east wing (ribbons down to the ground) gets the full police kit: canopied entrance, striped band, lamp, two garage doors (bays wide enough for 3 m doors).
  const walls = base.walls.map((w, i) => i === 2 ? {...w, baysPerStorey: 5, entrance: {bay: 1, canopy: true}, garageDoors: 2, police: {stripe: true, lamp: true}} : w);
  const intent = validateLargeIntent({...base, walls, roofPlant: true});
  const {built, gates} = await gatesOf(intent, facts('politie-van-leijenberghlaan'));
  const c = built.components;
  assert.ok(c.policeStripes >= 1 && c.lamps === 1 && c.canopies === 1 && c.garageDoors === 2, JSON.stringify(c));
  assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), []);
});

test("St Andrew's crosses: validated, placed on the main panel, closed solids that pass every gate; absent = identical mesh", async () => {
  const base = validateLargeIntent(raw('politie-van-leijenberghlaan'));
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], crosses: {count: 0}}]}), /crosses/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], crosses: {count: 3, sizeM: 2}}]}), /crosses|coordinate/);
  const plain = await gatesOf(base, facts('politie-van-leijenberghlaan'));
  const walls = base.walls.map((w, i) => i === 0 ? {...w, crosses: {count: 3, size: 'medium' as const, colour: '#e58a86'}} : w);
  const withCrosses = await gatesOf(validateLargeIntent({...base, walls}), facts('politie-van-leijenberghlaan'));
  assert.equal(withCrosses.built.components.letters - plain.built.components.letters, 72);
  assert.equal(withCrosses.tris.length - plain.tris.length, 72);
  assert.deepEqual(withCrosses.gates.filter(g => !g.pass).map(g => g.id), []);
});

test('dissolveFaces merges two coplanar strips into one face and keeps the original vertices', () => {
  // Two 1 x 2 m strips side by side plus a T-junction vertex on the shared edge.
  const to3 = (u: number, v: number): [number, number, number] => [u, v, 0];
  const a = [[0, 0], [1, 0], [1, 1], [1, 2], [0, 2]].map(([u, v]) => to3(u, v));
  const b = [[1, 0], [2, 0], [2, 2], [1, 2]].map(([u, v]) => to3(u, v));
  const poly = (r: [number, number, number][]) => ({outer: r.map(p => [p[0], p[1]] as [number, number]), holes: []});
  const faces = dissolveFaces([{rings: [a], poly: poly(a)}, {rings: [b], poly: poly(b)}], p => [p[0], p[1]]);
  assert.ok(faces);
  assert.equal(faces.length, 1);
  const us = faces[0].poly.outer.map(p => p[0]).sort((x, y) => x - y);
  assert.equal(us[0], 0); assert.equal(us[us.length - 1], 2);
  assert.ok(!faces[0].poly.outer.some(p => p[0] === 1 && p[1] === 1), 'the T-junction vertex on the cancelled edge is dropped');
});

test('windows: low draws wide low windows set high in the storey (1990s office blocks)', async () => {
  const {largeSystem} = await import('../blockBuilding/systems.ts');
  const fit = {pitchM: 1.6, lines: [0, 4, 7.5, 11], ground: 'system' as const, slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'}};
  const plain = largeSystem('brick-bay-grid', fit).typical.win!, low = largeSystem('brick-bay-grid', {...fit, windows: 'low'}).typical.win!;
  assert.ok(low.h! < plain.h! && low.sill! > plain.sill!, 'lower and higher than the plain window');
});

test('large-tier compile seals tiny 3DBAG wall slivers and closes wall-mounted boxes (courtyard complex, no open shell edge)', async () => {
  const intent = validateLargeIntent(raw('kattenburg-wings-164938'));
  const {gates} = await gatesOf(intent, facts('kattenburg-wings-164938'));
  const open = gates.find(g => g.id === 'open-edges')!;
  assert.ok(open.pass, JSON.stringify(open.value));
  assert.ok(gates.find(g => g.id === 'footprint-vs-bag')!.pass, 'courtyard holes are part of the BAG footprint');
});

test('barOffsetM (opt-in hook): glazing bars stand clear of the glass as closed boxes, skipCell leaves cells to the builder', async () => {
  const {compileLargeBuilding} = await import('./largeCompile.ts');
  const {topology} = await import('./gates.ts');
  const intent = validateLargeIntent(raw('politie-van-leijenberghlaan')), f = facts('politie-van-leijenberghlaan');
  const trisOf = (b: ReturnType<typeof compileLargeBuilding>) => {
    const out: {a: number[]; b: number[]; c: number[]; surface: string; metallic: number}[] = [];
    b.group.traverse(o => {
      const m = o as unknown as {isMesh?: boolean; name: string; geometry: {getAttribute(n: string): {array: ArrayLike<number>}}};
      if (!m.isMesh) return;
      const a = m.geometry.getAttribute('position').array;
      for (let i = 0; i < a.length; i += 9) out.push({a: [a[i], a[i + 1], a[i + 2]], b: [a[i + 3], a[i + 4], a[i + 5]], c: [a[i + 6], a[i + 7], a[i + 8]], surface: m.name, metallic: 0});
    });
    return out;
  };
  const plain = compileLargeBuilding(intent, f), clear = compileLargeBuilding(intent, f, {barOffsetM: 0.04});
  // more triangles (each bar is a box), but no new open edges: the boxes stand on the glass
  assert.ok(clear.stats.triangles > plain.stats.triangles);
  assert.equal(topology(trisOf(clear)).openEdges, topology(trisOf(plain)).openEdges);
  // skipping every ground-floor cell removes openings
  const skipped = compileLargeBuilding(intent, f, {skipCell: (_p, floor) => floor === 0});
  assert.ok(skipped.stats.recessed < plain.stats.recessed);
});

test('deepBars: glazing bars stand 3.5 cm proud only when asked (ribbon and punched rows); default unchanged', async () => {
  const {largeSystem} = await import('../blockBuilding/systems.ts');
  const fit = {pitchM: 2.7, lines: [0, 3.3, 6.6, 9.9], ground: 'system' as const, slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'}};
  for (const system of ['ribbon-windows', 'brick-bay-grid'] as const) {
    assert.equal(largeSystem(system, fit).typical.win!.barD, undefined, `${system} default`);
    assert.equal(largeSystem(system, {...fit, deepBars: true}).typical.win!.barD, 0.035, `${system} deepBars`);
  }
  const base = raw('kattenburg-wings-164938');
  assert.equal(validateLargeIntent({...base, walls: [{...base.walls[0], deepBars: true}, base.walls[1]]}).walls[0].deepBars, true);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], deepBars: 'yes'}, base.walls[1]]}), /deepBars/);
});

test('deepBars reaches the entrance (closed 3.5 cm frame, no open edge) and the footprint gate takes LoD2.2 courtyards when LoD0 has none', async () => {
  const bp = validateLargeIntent(raw('beursplein-5-165051')), f = facts('beursplein-5-165051');
  const {built, gates} = await gatesOf(bp, f);
  assert.equal(built.components.entrances, 1);
  assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), []);
  // Westerdok 536: LoD0 is the courtyard-less outer ring, LoD2.2 ground has the courtyards.
  const wd = facts('westerdok-186086');
  assert.equal(wd.bagFootprintRD.length, 1);
  const {gates: wg} = await gatesOf(validateLargeIntent(raw('westerdok-186086')), wd);
  const fp = wg.find(g => g.id === 'footprint-vs-bag')!;
  assert.ok(fp.pass && (fp.value as {courtyardsFromLod22: number}).courtyardsFromLod22 > 0, JSON.stringify(fp.value));
});

test('curve: linked 3DBAG facets carry one bay rhythm along the arc (Westerdok east front); default unchanged', async () => {
  const {compileLargeBuilding} = await import('./largeCompile.ts');
  const base = raw('westerdok-186086'), f = facts('westerdok-186086');
  const flat = fitLarge(validateLargeIntent({...base, walls: base.walls.map((w: object, i: number) => (i === 3 ? {...w, curve: undefined} : w))}), f).recipe;
  assert.equal(flat.panelSystem, undefined, 'no curve, no per-panel systems');
  const intent = validateLargeIntent({...base, walls: base.walls.map((w: object, i: number) => (i === 3 ? {...w, curve: true} : w))});
  const {recipe} = fitLarge(intent, f), g = recipe.groups[3];
  assert.ok(g.curve && g.curve.length === 1, JSON.stringify(g.curve));
  const run = g.curve![0];
  assert.ok(run.panels.length >= 8 && Math.abs(run.turnDeg) >= 10, JSON.stringify(run));
  // Bay axes measured along the arc: every gap is the run pitch, except where an axis was nudged inside its facet.
  const panels = compileLargeBuilding(intent, f).panels, pitch = run.lengthM / run.bays;
  let s0 = 0;
  const arc: number[] = [];
  for (const pi of run.panels) {
    const sys = recipe.spec.systems[recipe.panelSystem![pi]];
    assert.equal(sys.bays!.centres!.length, sys.bays!.count);
    for (const u of sys.bays!.centres!) arc.push(s0 + u);
    s0 += panels[pi].uMax - panels[pi].uMin;
  }
  assert.ok(arc.length >= run.bays - 2, `${arc.length} of ${run.bays} axes placed`);
  const gaps = arc.slice(1).map((a, k) => a - arc[k]);
  assert.ok(gaps.every(d => d > pitch * 0.4 && d < pitch * 2.1), JSON.stringify(gaps));
  assert.ok(gaps.filter(d => Math.abs(d - pitch) < 0.01).length >= gaps.length / 2, `rhythm kept: ${JSON.stringify(gaps)}`);
  const {gates} = await gatesOf(intent, f);
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
});

test('wallMaterial per group: render, stucco and stone groups export their own material slot; the house slot stays brick', async () => {
  const {largeMaterialSlot} = await import('./largeCompile.ts');
  const base = raw('oude-turfmarkt-168172'), f = facts('oude-turfmarkt-168172');
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], wallMaterial: 'marble'}, base.walls[1]]}), /wallMaterial/);
  const plain = fitLarge(validateLargeIntent({...base, walls: base.walls.map((w: object) => ({...w, wallMaterial: undefined}))}), f).recipe;
  assert.equal(plain.slotMaterial, undefined);
  const {palette: _p, ...rest} = base.walls[1];
  const intent = validateLargeIntent({...base, walls: [{...base.walls[0], wallMaterial: 'stone'}, {...rest, wallMaterial: 'render'}]});
  const {recipe} = fitLarge(intent, f), [g0, g1] = recipe.groups;
  assert.equal(largeMaterialSlot(g0.slots.wall, recipe).materialSlot, 'stone');
  assert.equal(largeMaterialSlot(g1.slots.wall, recipe).materialSlot, 'stucco');
  assert.equal(recipe.spec.palette[g1.slots.wall], '#f1eee6', 'render without a group colour is white');
  assert.equal(largeMaterialSlot('wall', recipe).materialSlot, 'brick');
  const {built, gates} = await gatesOf(intent, f);
  const slots = new Map<string, string>();
  built.group.traverse(o => { if (o.userData.materialSlot) slots.set(o.name, o.userData.materialSlot); });
  assert.equal(slots.get(`wall/${g1.slots.wall}`), 'stucco');
  assert.equal(slots.get(`wall/${g0.slots.wall}`), 'stone');
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
});

/** Decoded GLB triangles and the large gates' topology (open edges) for an intent. */
async function topoOf(intent: LargeBuildingIntent, f: BuildingFacts) {
  const built = compileBuilding(intent, f);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes), ev = evaluateLargeGates(tris, built);
  return {built, tris, gates: ev.gates, topology: ev.topology};
}

test('tiltedBays: box frames (closed solids leaning out to the sill) on the chosen bays and storeys; no new open edges', async () => {
  const {largeSystem, TILT_FRAME} = await import('../blockBuilding/systems.ts');
  const base = raw('engelsesteeg-165098'), f = facts('engelsesteeg-165098');
  const walls = (t: unknown) => base.walls.map((w: object, i: number) => (i === 0 ? {...w, tiltedBays: t} : w));
  assert.throws(() => validateLargeIntent({...base, walls: walls({every: 2, hoist: 1})}), /tiltedBays/);
  assert.throws(() => validateLargeIntent({...base, walls: walls([{bays: [0], storeys: [1]}, {bays: [1], storeys: [1, 2]}])}), /storey 1 in two/);
  assert.throws(() => validateLargeIntent({...base, walls: walls([{bays: [0]}])}), /names its storeys/);
  // largeSystem: storey 2 cycles the box row on bays 1 and 3 of 4; storey 1 keeps the plain row; the box has no sill.
  const fit = {pitchM: 3, lines: [0, 4, 7, 10, 13], ground: 'system' as const, bays: 4, slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'}};
  const sys = largeSystem('brick-bay-grid', {...fit, tilted: [{bays: [1, 3], storeys: [2]}]});
  assert.equal(sys.rowOverrides?.['1'], undefined);
  const cyc = sys.rowOverrides!['2'].cycle!;
  assert.deepEqual(cyc.map(r => !!r.win?.tilt), [false, true, false, true]);
  assert.deepEqual(cyc[1].win!.tilt, {slot: 'stone', ...TILT_FRAME});
  assert.equal(cyc[1].win!.sillSlot, null);
  assert.ok(TILT_FRAME.outBottom > TILT_FRAME.outTop && TILT_FRAME.outTop >= 0.09, 'leans out to the sill, clear of the sheet layers');
  const plain = await topoOf(validateLargeIntent({...base, walls: walls(undefined)}), f);
  const tilted = await topoOf(validateLargeIntent({...base, walls: walls([{bays: [0, 2, 4], storeys: [1]}, {every: 2, first: 1, storeys: [2, 3]}])}), f);
  // four closed solids of 12 triangles per framed window, replacing its closed sill box (12)
  const extra = tilted.tris.length - plain.tris.length;
  assert.ok(extra > 0 && extra % 36 === 0, `${extra} triangles`);
  assert.equal(tilted.topology.openEdges, plain.topology.openEdges);
  assert.deepEqual(tilted.gates.filter(x => !x.pass).map(x => x.id), []);
});

test('screen: perforated-brick lattice (posts and rails as closed boxes on the 9/13.5 cm layers) and scattered glass blocks', async () => {
  const {largeSystem} = await import('../blockBuilding/systems.ts');
  const {SCREEN} = await import('../blockBuilding/components.ts');
  const {SHEET_PITCH} = await import('../blockBuilding/compose.ts');
  const base = raw('warmoesstraat-garage-165687'), f = facts('warmoesstraat-garage-165687');
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], system: 'ribbon-windows', screen: true}, ...base.walls.slice(1)]}), /screen/);
  assert.deepEqual([SCREEN.railOut, SCREEN.postOut], [2 * SHEET_PITCH, 3 * SHEET_PITCH]);
  const fit = {pitchM: 1.5, lines: [0, 3, 6, 9], ground: 'system' as const, slots: {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame'}};
  const typical = largeSystem('brick-bay-grid', {...fit, screen: true}).typical;
  assert.equal(typical.cycle!.filter(r => r.kind === 'punched').length, 1, 'one bay in three is a perforation');
  assert.equal(typical.cycle![0].win!.barD, 0.035, 'glass-block bars clear the glass');
  const off = await topoOf(validateLargeIntent({...base, walls: base.walls.map((w: object) => ({...w, screen: undefined}))}), f);
  const on = await topoOf(validateLargeIntent({...base, walls: base.walls.map((w: object, i: number) => (i < 3 ? {...w, screen: true, windows: undefined} : w))}), f);
  assert.ok((on.built.components.screens ?? 0) >= 3, JSON.stringify(on.built.components));
  assert.equal(off.built.components.screens, undefined);
  assert.ok(on.topology.openEdges <= off.topology.openEdges, `${on.topology.openEdges} vs ${off.topology.openEdges}`);
  assert.deepEqual(on.gates.filter(x => !x.pass).map(x => x.id), []);
});

test('portal: carved stone surround, pediment and crest round an entrance, lettered on its frieze; closed solids only', async () => {
  const {PORTAL} = await import('../blockBuilding/components.ts');
  const base = raw('beursplein-5-165051'), f = facts('beursplein-5-165051');
  const withEntrance = (e: object) => ({...base, walls: base.walls.map((w: object, i: number) => (i === 2 ? {...w, entrance: e, signage: {text: 'BEURSPLEIN 5', colour: '#d8c48a'}} : w))});
  assert.throws(() => validateLargeIntent(withEntrance({bay: 0, canopy: true, portal: true})), /portal/);
  assert.throws(() => validateLargeIntent(withEntrance({bay: 0, storeys: 2, portal: true})), /portal/);
  const plain = await topoOf(validateLargeIntent(withEntrance({bay: 0})), f);
  const carved = await topoOf(validateLargeIntent(withEntrance({bay: 0, portal: true})), f);
  assert.equal(carved.built.components.portals, 1);
  assert.equal(plain.built.components.portals, undefined);
  assert.ok(PORTAL.out >= 0.09, 'the portal stands on the 9 cm layer');
  const crest = carved.built.group.children.find(m => m.name.includes('crest@g2'));
  assert.ok(crest, 'the crest has its own darker stone slot');
  assert.equal(crest!.userData.materialSlot, 'stone');
  assert.ok(carved.built.components.letters > 0, 'lettering moves to the frieze');
  assert.equal(carved.topology.openEdges, plain.topology.openEdges);
  assert.deepEqual(carved.gates.filter(x => !x.pass).map(x => x.id), []);
});

test('signage mount cornice: the name lettered on the cornice face of the widest panel (Universiteit van Amsterdam)', async () => {
  const base = raw('oude-turfmarkt-168172'), f = facts('oude-turfmarkt-168172');
  const intent = validateLargeIntent({...base, walls: [{...base.walls[0], signage: {text: 'UNIVERSITEIT VAN AMSTERDAM', colour: '#3a3430', mount: 'cornice'}}, base.walls[1]]});
  const {built, gates, topology: t} = await topoOf(intent, f);
  assert.equal(built.components.nameBands, 1);
  assert.ok(built.components.letters > 100, `${built.components.letters} lettering triangles`);
  assert.equal(t.openEdgeLengthM <= 2, true);
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
});

test('stone storeys and banded pilasters (Beursplein 5 street run): facing on the 9 cm layer, pilasters 4.5 cm over it, no z-fight planes', async () => {
  const {FACING_OUT} = await import('../blockBuilding/components.ts');
  const {SHEET_PITCH} = await import('../blockBuilding/compose.ts');
  assert.equal(FACING_OUT, 2 * SHEET_PITCH);
  const base = raw('beursplein-5-165051'), f = facts('beursplein-5-165051');
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], stoneStoreys: [0], stringCourses: true}, ...base.walls.slice(1)]}), /stoneStoreys/);
  const intent = validateLargeIntent({...base, closedBands: true, walls: base.walls.map((w: object, i: number) => (i === 0 ? {...w, stoneStoreys: [0, 3], pilasters: true} : w))});
  const {built, gates} = await topoOf(intent, f);
  assert.ok((built.components.stoneStoreys ?? 0) >= 2 && (built.components.pilasters ?? 0) >= 2, JSON.stringify(built.components));
  assert.ok(built.recipe.spec.palette['band@g0'], 'pilaster courses in a darker stone');
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
});

test('lantern: a closed glazed lantern seated on the highest roof point behind the panel; deterministic, attached', async () => {
  const {placeLantern, LANTERN} = await import('./fitLarge.ts');
  const base = raw('beursplein-5-165051'), f = facts('beursplein-5-165051');
  const intent = validateLargeIntent({...base, walls: base.walls.map((w: object, i: number) => (i === 0 ? {...w, lantern: true} : {...w, lantern: undefined}))});
  const a = fitLarge(intent, f).recipe, b = fitLarge(intent, f).recipe;
  assert.equal(a.lanterns?.length, 1);
  assert.deepEqual(a.lanterns, b.lanterns);
  const l = a.lanterns![0];
  assert.ok(l.topY - l.baseY >= LANTERN.riseM && l.size === LANTERN.sizeM, JSON.stringify(l));
  const {built, gates} = await topoOf(intent, f);
  assert.equal(built.components.lanterns, 1);
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
  // the ridge gate still reads the 3DBAG roof (the lantern is not roof surface)
  assert.ok(gates.find(x => x.id === 'ridge-vs-3dbag')!.pass);
  void placeLantern;
});

test('closed bands: Beursplein cornices and Damrak string-course ends leave no open edge of their own', async () => {
  const {topology} = await import('./gates.ts');
  const stoneOnly = (tris: Awaited<ReturnType<typeof topoOf>>['tris']) => tris.filter(t => /stone/.test(t.surface));
  const bp = raw('beursplein-5-165051'), bf = facts('beursplein-5-165051');
  const open = await topoOf(validateLargeIntent({...bp, closedBands: undefined}), bf), closed = await topoOf(validateLargeIntent({...bp, closedBands: true}), bf);
  assert.ok(topology(stoneOnly(open.tris)).openEdges > 0, 'open cornices have open back edges');
  assert.equal(topology(stoneOnly(closed.tris)).openEdges, 0, 'closed cornices are watertight on their own');
  // Damrak 77: string courses stop at the Beurspassage arch; without closed ends they left 2 m of open edge.
  const dm = raw('damrak-77-165746'), df = facts('damrak-77-165746');
  const sc = {...dm, walls: [{...dm.walls[0], stringCourses: true}, ...dm.walls.slice(1)]};
  const before = await topoOf(validateLargeIntent({...sc, closedBands: undefined}), df), after = await topoOf(validateLargeIntent({...sc, closedBands: true}), df);
  assert.ok(before.topology.openEdges > 0);
  assert.equal(after.topology.openEdges, 0);
  assert.deepEqual(after.gates.filter(x => !x.pass).map(x => x.id), []);
});

test('arches.storeys and balconies.bays: round heads only on the listed storeys, a balcony only over the listed bay (Barlaeus front)', async () => {
  const base = raw('barlaeus'), f = facts('barlaeus');
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], arches: {windows: 'round', storeys: []}}, ...base.walls.slice(1)]}), /arches.storeys/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], balconies: {storeys: [1], bays: [7]}}, ...base.walls.slice(1)]}), /balconies.bays/);
  const intent = validateLargeIntent(base);
  const sys = Object.values(fitLarge(intent, f).recipe.spec.systems)[0];
  assert.equal(sys.typical.win?.arch, undefined, 'the default storey is square-headed');
  assert.ok(sys.rowOverrides?.['2']?.win?.arch, 'storey 2 is round-headed');
  const bal = sys.rowOverrides?.['1'];
  assert.ok(bal?.cycle?.[1]?.kind === 'balcony' && bal.cycle[0]?.kind !== 'balcony' && bal.cycle[0]?.win?.arch, 'bay 1 holds the balcony, the others the arched window');
  // without storeys the arches are on every storey and the typical row carries them (default compose unchanged)
  const all = validateLargeIntent({...base, walls: [{...base.walls[0], arches: {windows: 'round', band: 'voussoir'}, balconies: undefined}, ...base.walls.slice(1)]});
  assert.ok(Object.values(fitLarge(all, f).recipe.spec.systems)[0].typical.win?.arch);
  const {gates} = await gatesOf(intent, f);
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
});

test('windows: wide draws a four-light window with a transom two thirds of the bay (school classrooms); others unchanged', async () => {
  const {largeSystem, LARGE_WINDOWS} = await import('../blockBuilding/systems.ts');
  assert.ok(LARGE_WINDOWS.includes('wide'));
  const slots = {frame: 'f', stone: 's', glass: 'g', door: 'd', curtain: 'c'};
  const wide = largeSystem('brick-bay-grid', {pitchM: 8, lines: [0, 5, 10], ground: 'system', windows: 'wide', slots} as never).typical.win!;
  assert.equal(wide.mull, 3); assert.ok(wide.w! > 0.6 && wide.w! < 0.75 && wide.transom);
  const plain = largeSystem('brick-bay-grid', {pitchM: 8, lines: [0, 5, 10], ground: 'system', slots} as never).typical.win!;
  assert.equal(plain.mull, undefined);
});

test('gateways: arched carriage openings (92 % of a bay) in the listed ground bays, plain wall between, deterministic; validated (Amsterdams Lyceum)', async () => {
  const base = raw('amsterdams-lyceum'), f = facts('amsterdams-lyceum');
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], gateways: {bays: [9]}}, ...base.walls.slice(1)]}), /gateways.bays/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], gateways: {bays: [2], arch: 'ogee'}}, ...base.walls.slice(1)]}), /gateways.arch/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], entrance: true}, ...base.walls.slice(1)]}), /gateways/);
  const intent = validateLargeIntent(base);
  const g = Object.values(fitLarge(intent, f).recipe.spec.systems)[0].ground;
  assert.deepEqual(g.cycle?.map(r => r.kind), ['wall', 'punched', 'punched', 'wall']);
  assert.ok(g.cycle![1].win?.arch && g.cycle![1].win!.w! > 0.9);
  const {gates} = await gatesOf(intent, f);
  assert.deepEqual(gates.filter(x => !x.pass).map(x => x.id), []);
  // without gateways the ground row is the system's own (default compose unchanged)
  const plain = validateLargeIntent({...base, walls: [{...base.walls[0], gateways: undefined}, ...base.walls.slice(1)]});
  assert.equal(Object.values(fitLarge(plain, f).recipe.spec.systems)[0].ground.cycle, undefined);
});

// ---------------------------------------------------------------------------------------------------------------
// Layered kit (intent `layeredKit`): garage doors, portals/arches with frames, curtain walls and stacked balconies on a
// synthetic 12 x 9 m wall (two 3DBAG strips), measured with the geometry audit's coplanar metric (zfight + tight m2).

async function layeredWall() {
  const {compose} = await import('../blockBuilding/compose.ts');
  const {auditZFight} = await import('../landmarks/geometryAudit.ts');
  type P3 = [number, number, number];
  const W = (rings: P3[][], surface: number) => ({rings, onFootprintEdge: true, surface});
  const set = {
    pandId: '0000000000000000', anchor: [0, 0] as [number, number], groundNap: 0, heightMax: 9, constructionYear: 1900,
    walls: [
      W([[[-6, 0, 4], [0, 0, 4], [0, 9, 4], [-6, 9, 4]]], 0), W([[[0, 0, 4], [6, 0, 4], [6, 9, 4], [0, 9, 4]]], 1),
      W([[[6, 0, -4], [-6, 0, -4], [-6, 9, -4], [6, 9, -4]]], 2), W([[[6, 0, 4], [6, 0, -4], [6, 9, -4], [6, 9, 4]]], 3), W([[[-6, 0, -4], [-6, 0, 4], [-6, 9, 4], [-6, 9, -4]]], 4),
    ],
    roofs: [{rings: [[[-6, 9, 4], [0, 9, 4], [6, 9, 4], [6, 9, -4], [-6, 9, -4]]] as P3[][], slopeDeg: 0}],
    ground: [{rings: [[[-6, 0, 4], [6, 0, 4], [6, 0, -4], [-6, 0, -4]]] as P3[][]}],
    neighbours: [],
  };
  const palette = {wall: '#7a4a3a', arch: '#6a3a2a', roof: '#555555', frame: '#eeeeee', glass: '#223344', door: '#222222', stone: '#dddddd', rail: '#333333'};
  /** Compose the south wall with the given system (and an optional panel hook), legacy or layered; coplanar m2 and triangles. */
  return (system: import('../blockBuilding/spec.ts').System, layered: boolean, opts: Partial<import('../blockBuilding/compose.ts').ComposeOptions> = {}) => {
    const spec = {id: 'layered-test', pandId: '0000000000000000', name: 'layered', palette, levels: {groundM: 3.4, storeyM: 2.8, lines: [0, 3.4, 6.2, 9]}, systems: {s: system}, default: 's'};
    const {mesh} = compose(set, spec, {recessM: 0.18, closedBoxes: true, sealSlivers: true, layered, systemFor: p => (p.n[2] > 0.9 ? 's' : null), ...opts});
    const positions: number[] = [], triMaterial: number[] = [], names = [...mesh.slots.keys()];
    names.forEach((slot, k) => { const v = mesh.slots.get(slot)!.positions; for (let i = 0; i < v.length; i += 9) { positions.push(...v.slice(i, i + 9)); triMaterial.push(k); } });
    const soup = {positions, indices: Array.from({length: positions.length / 3}, (_, i) => i), triMaterial, materials: names.map(name => ({name, rgb: [0.5, 0.5, 0.5] as [number, number, number]}))};
    const z = auditZFight(soup);
    return {m2: +(z.area + z.tightArea).toFixed(2), tris: mesh.triangles};
  };
}

test('layered kit: garage doors (leaf, ribs and frame on their own sheet layers) leave no coplanar overlap; legacy ribs do', async () => {
  const wall = await layeredWall(), {drawGarageDoor} = await import('../blockBuilding/components.ts');
  const sys = {pitch: 4, lines: [0, 3.9, 6.5, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const}};
  let drawn = 0;
  const panelHook = (c: Parameters<typeof drawGarageDoor>[0], info: {cells: Parameters<typeof drawGarageDoor>[1][]}) => { for (const cell of info.cells) if (cell.floor === 0 && drawGarageDoor(c, cell, {door: 'door', frame: 'frame'})) drawn++; };
  const legacy = wall(sys, false, {panelHook}), layered = wall(sys, true, {panelHook});
  assert.equal(drawn, 6, 'three doors per compose');
  assert.ok(legacy.m2 > 0.5, `legacy ribs 1.5 cm off the leaf: ${legacy.m2} m2`);
  assert.equal(layered.m2, 0);
});

test('layered kit: arched portals and framed arched windows with a flush brick band leave no coplanar overlap', async () => {
  const wall = await layeredWall();
  const arch = {kind: 'segmental' as const, band: {slot: 'arch', t: 0.22, out: 0, imposts: 'stone'}};
  const win = {w: 0.6, h: 0.6, sill: 0.85, mull: 1, transom: 0.7, frame: 'frame', glass: 'glass', frameW: 0.07, arch};
  const portal = {w: 0.5, h: 0.78, sill: 0.06, mull: 1, frameW: 0, frame: 'frame', glass: 'door', arch: {...arch, kind: 'round' as const}};
  const sys = {pitch: 2, ground: {kind: 'punched' as const, win: portal}, typical: {kind: 'punched' as const, win}};
  const legacy = wall(sys, false), layered = wall(sys, true);
  assert.ok(legacy.m2 > 1, `legacy: band 1.2 cm on the wall, bars 1.5 cm on the glass: ${legacy.m2} m2`);
  assert.equal(layered.m2, 0);
});

test('layered kit: a curtain wall is a glass skin with a closed mullion grid standing off it (round a cut entrance)', async () => {
  const wall = await layeredWall(), {drawCurtainGrid, drawEntrance} = await import('../blockBuilding/components.ts');
  const sys = {pitch: 1.5, lines: [0, 3.4, 6.2, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const}};
  const hook = (grid: boolean) => (c: Parameters<typeof drawCurtainGrid>[0], info: {levels: number[]; cells: Parameters<typeof drawCurtainGrid>[1]}) => {
    const mid = info.cells.filter(x => x.floor === 0 && x.bay === 3);
    if (mid.length) drawEntrance(c, {u0: mid[0].u0 - 0.5, u1: mid[0].u1 + 0.5, v0: mid[0].v0, v1: mid[0].v1}, info.levels, {frame: 'frame', glass: 'glass', door: 'door', stone: 'stone'}, false);
    if (grid) drawCurtainGrid(c, info.cells, info.levels, 'frame', 8.95);
  };
  const skin = {wallSlotFor: () => 'glass'};
  const legacy = wall(sys, false, {...skin, panelHook: hook(false)}), layered = wall(sys, true, {...skin, panelHook: hook(true)}), bare = wall(sys, true, {...skin, panelHook: hook(false)});
  assert.ok(legacy.m2 > 0.1, `legacy entrance bars 1.5 cm off the glass: ${legacy.m2} m2`);
  assert.ok(layered.tris > bare.tris + 100, 'the grid is drawn');
  assert.equal(layered.m2, 0);
});

test('layered kit: balconies on three storeys share one slab and rail per storey run, cost a fraction, and never z-fight', async () => {
  const wall = await layeredWall(), {MAX_RAIL_RODS} = await import('../blockBuilding/compose.ts');
  const balcony = (kind: 'bars' | 'rods') => ({kind: 'balcony' as const, balcony: {depth: 1.2, slab: {h: 0.18, slot: 'stone'}, rail: {kind, h: 1.0, slot: 'rail', top: 'frame'}, back: {w: 0.7, h: 0.72, sill: 0.25, frame: 'frame', glass: 'glass', mull: 1}}});
  for (const kind of ['bars', 'rods'] as const) {
    const sys = {pitch: 1.5, lines: [0, 2.6, 5.2, 7.8, 9], ground: balcony(kind), typical: balcony(kind)};
    const legacy = wall(sys, false), layered = wall(sys, true);
    assert.ok(legacy.m2 > 1, `${kind}: legacy ${legacy.m2} m2`);
    assert.equal(layered.m2, 0, kind);
    assert.ok(layered.tris < legacy.tris * 0.75, `${kind}: ${layered.tris} vs ${legacy.tris} triangles`);
  }
  assert.ok(MAX_RAIL_RODS <= 48);
});
