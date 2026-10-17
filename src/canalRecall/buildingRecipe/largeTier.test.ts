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
  // the legacy kit (the layered kit's bars are closed boxes on the 4.5 cm layer whatever barOffsetM says)
  const intent = validateLargeIntent({...raw('politie-van-leijenberghlaan'), layeredKit: false}), f = facts('politie-van-leijenberghlaan');
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
  // the legacy kit: the layered kit leaves the back face off a box laid on a followed wall profile (its back edges are
  // seams on the wall), so its stone is not watertight on its own; the whole model's open-edge gate still passes (below)
  const bp = {...raw('beursplein-5-165051'), layeredKit: false}, bf = facts('beursplein-5-165051');
  const open = await topoOf(validateLargeIntent({...bp, closedBands: undefined}), bf), closed = await topoOf(validateLargeIntent({...bp, closedBands: true}), bf);
  assert.ok(topology(stoneOnly(open.tris)).openEdges > 0, 'open cornices have open back edges');
  assert.equal(topology(stoneOnly(closed.tris)).openEdges, 0, 'closed cornices are watertight on their own');
  const layered = await topoOf(validateLargeIntent({...raw('beursplein-5-165051'), closedBands: true}), bf);
  assert.deepEqual(layered.gates.filter(x => !x.pass).map(x => x.id), []);
  // Damrak 77: string courses stop at the Beurspassage arch; without closed ends they left 2 m of open edge.
  const dm = {...raw('damrak-77-165746'), layeredKit: false}, df = facts('damrak-77-165746');
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

test('hallDoors: glazed square-headed hall doors in the listed ground bays, side windows kept; validated (De Hallen gables)', async () => {
  const {largeSystem, HALL_DOOR} = await import('../blockBuilding/systems.ts');
  const slots = {frame: 'f', stone: 's', glass: 'g', door: 'd', curtain: 'c'};
  const fit = {pitchM: 1.94, lines: [0, 5.04, 10.1], ground: 'system', bays: 5, deepBars: true, shape: {w: 0.45, h: 0.5, sillM: 1.5}, slots};
  const sys = largeSystem('brick-bay-grid', {...fit, hallDoors: {bays: [1, 2, 3], h: 0.82}} as never);
  assert.deepEqual(sys.ground.cycle?.map(r => r.win?.w), [0.45, HALL_DOOR.w, HALL_DOOR.w, HALL_DOOR.w, 0.45]);
  const door = sys.ground.cycle![1].win!;
  assert.equal(door.h, 0.82); assert.equal(door.glass, 'g'); assert.equal(door.mull, 1); assert.equal(door.rows, 4); assert.equal(door.arch, undefined); assert.equal(door.sillSlot, null);
  const arched = largeSystem('brick-bay-grid', {...fit, arches: {band: 'stone'}, hallDoors: {bays: [0], arch: 'round', lights: 3}} as never).ground.cycle![0].win!;
  assert.equal(arched.arch?.kind, 'round'); assert.equal(arched.mull, 2); assert.equal(arched.sill, HALL_DOOR.archedSill); assert.equal(arched.arch?.band?.slot, 's');
  // without hallDoors the ground row is untouched (default byte-identical)
  assert.equal(largeSystem('brick-bay-grid', fit as never).ground.cycle, undefined);
  // validation
  const base = raw('amsterdams-lyceum'), w0 = {...base.walls[0], gateways: undefined};
  const v = (hd: unknown, extra: object = {}) => validateLargeIntent({...base, walls: [{...w0, hallDoors: hd, ...extra}, ...base.walls.slice(1)]});
  assert.ok(v({bays: [1], h: 0.7, lights: 2, rows: 4}));
  assert.throws(() => v({bays: [99]}), /hallDoors.bays/);
  assert.throws(() => v({bays: [1], h: 1.2}), /hallDoors.h/);
  assert.throws(() => v({bays: [1], lights: 9}), /hallDoors.lights/);
  assert.throws(() => v({bays: [1], spare: 1}), /hallDoors.spare/);
  assert.throws(() => v({bays: [1]}, {entrance: true}), /hallDoors: not with/);
});

test('groundClamp: De Hallen\'s sunken ramp is lifted to the ground, faces on the ground dropped; default unchanged', async () => {
  const {largeSurfaceSet} = await import('./fitLarge.ts');
  const f = facts('de-hallen-236693');
  const minY = (set: {walls: {rings: number[][][]}[]; roofs: {rings: number[][][]}[]}) => Math.min(...[...set.walls, ...set.roofs].flatMap(s => s.rings.flat().map(p => p[1])));
  const plain = largeSurfaceSet(f).set, clamped = largeSurfaceSet(f, {groundClamp: true}).set;
  assert.ok(minY(plain) < -0.8);
  assert.equal(minY(clamped), 0);
  assert.ok(clamped.roofs.length < plain.roofs.length && clamped.roofs.length >= plain.roofs.length - 3);
  assert.ok(clamped.walls.length <= plain.walls.length);
  assert.deepEqual(largeSurfaceSet(f, {}).set, plain);
  assert.throws(() => validateLargeIntent({...raw('de-hallen-236693'), groundClamp: 'yes'}), /groundClamp/);
});

test('glazedStoreys: listed upper storeys take the glazed shop row, the others keep theirs; validated (Kinkerstraat 32-54 mezzanine)', async () => {
  const {largeSystem} = await import('../blockBuilding/systems.ts');
  const slots = {frame: 'f', stone: 's', glass: 'g', door: 'd', curtain: 'c'};
  const fit = {pitchM: 1.7, lines: [0, 3.4, 6.1, 8.8, 11.5], ground: 'glazed', deepBars: true, slots};
  const plain = largeSystem('brick-bay-grid', fit as never), sys = largeSystem('brick-bay-grid', {...fit, glazedStoreys: [1]} as never);
  assert.equal(plain.rowOverrides, undefined);
  assert.deepEqual(Object.keys(sys.rowOverrides!), ['1']);
  assert.deepEqual(sys.rowOverrides!['1'], sys.ground);
  assert.equal(sys.rowOverrides!['1'].kind, 'glazed');
  assert.deepEqual(sys.typical, plain.typical);
  const base = raw('amsterdams-lyceum'), w0 = base.walls[0];
  const v = (extra: object) => validateLargeIntent({...base, walls: [{...w0, ...extra}, ...base.walls.slice(1)]});
  assert.ok(v({glazedStoreys: [1]}));
  assert.throws(() => v({glazedStoreys: [0]}), /glazedStoreys/);
  assert.throws(() => v({glazedStoreys: [1], blankStoreys: [1]}), /not both blank and glazed/);
});

// ---------------------------------------------------------------------------------------------------------------
// Layered kit (intent `layeredKit`): garage doors, portals/arches with frames, curtain walls and stacked balconies on a
// synthetic 12 x 9 m wall (two 3DBAG strips), measured with the geometry audit's coplanar metric (zfight + tight m2).

async function layeredWall(bend = 0) {
  const {compose} = await import('../blockBuilding/compose.ts');
  const {auditZFight} = await import('../landmarks/geometryAudit.ts');
  type P3 = [number, number, number];
  const W = (rings: P3[][], surface: number) => ({rings, onFootprintEdge: true, surface});
  // `bend`: the south wall's east strip leans out to z = 4 + bend at its far end (a 3DBAG front bent within the merge
  // tolerance, so both strips still make one panel whose reference plane the east strip leaves)
  const e = 4 + bend;
  const set = {
    pandId: '0000000000000000', anchor: [0, 0] as [number, number], groundNap: 0, heightMax: 9, constructionYear: 1900,
    walls: [
      W([[[-6, 0, 4], [0, 0, 4], [0, 9, 4], [-6, 9, 4]]], 0), W([[[0, 0, 4], [6, 0, e], [6, 9, e], [0, 9, 4]]], 1),
      W([[[6, 0, -4], [-6, 0, -4], [-6, 9, -4], [6, 9, -4]]], 2), W([[[6, 0, e], [6, 0, -4], [6, 9, -4], [6, 9, e]]], 3), W([[[-6, 0, -4], [-6, 0, 4], [-6, 9, 4], [-6, 9, -4]]], 4),
    ],
    roofs: [{rings: [[[-6, 9, 4], [0, 9, 4], [6, 9, e], [6, 9, -4], [-6, 9, -4]]] as P3[][], slopeDeg: 0}],
    ground: [{rings: [[[-6, 0, 4], [6, 0, e], [6, 0, -4], [-6, 0, -4]]] as P3[][]}],
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
    return {m2: +(z.area + z.tightArea).toFixed(2), tris: mesh.triangles, mesh};
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

// ---------------------------------------------------------------------------------------------------------------
// The residue after the layered re-installs (2026-10-14): parts laid off a panel's reference plane where the 3DBAG wall
// leans or bends off it (Berlage Lyceum, Montessori Van Ostade, Stadsloket West), a 3 cm stone arch ring and 1.2 cm
// wall lettering (Amsterdams Lyceum). One synthetic case per pair.

test('layered kit: piers and string courses follow a wall that leans off its panel plane (pier/brick, course/brick)', async () => {
  const flat = await layeredWall(), bent = await layeredWall(0.09);
  const sys = (piers: boolean, bands: boolean) => ({pitch: 2, lines: [0, 3.4, 6.2, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const},
    piers: piers ? {w: 0.36, out: 0.1, slot: 'stone', segments: 3} : null, ...(bands ? {bands: [{slot: 'stone', h: 0.16, out: 0.05, skipGround: false}]} : {})});
  for (const [piers, bands] of [[true, false], [false, true]] as const) {
    assert.equal(flat(sys(piers, bands), false).m2, 0, 'on a flat wall the legacy kit is clean');
    const legacy = bent(sys(piers, bands), false), layered = bent(sys(piers, bands), true);
    assert.ok(legacy.m2 > 0.2, `${piers ? 'piers' : 'string course'} on the panel plane meet the leaning brick: ${legacy.m2} m2`);
    assert.equal(layered.m2, 0, piers ? 'piers' : 'string course');
  }
});

test('layered kit: sills follow a leaning wall (sill top/reveal floor)', async () => {
  const bent = await layeredWall(0.09);
  const win = {w: 0.5, h: 0.6, sill: 0.85, frame: 'frame', glass: 'glass', frameW: 0.07, sillSlot: 'stone', sillH: 0.08, sillOut: 0.1};
  const sys = {pitch: 2, lines: [0, 3.4, 6.2, 9], ground: {kind: 'punched' as const, win}, typical: {kind: 'punched' as const, win}};
  assert.ok(bent(sys, false).m2 > 0.02, 'the sill top on the panel plane shares the reveal floor behind the leaning face');
  assert.equal(bent(sys, true).m2, 0);
});

test('layered kit: a curtain grid over a bent glass skin, emitted per facet, and a mesh plinth panel (grid/glass, plinth/glass)', async () => {
  const bent = await layeredWall(0.1), {drawCurtainGrid} = await import('../blockBuilding/components.ts');
  const {profileAt, kinksIn} = await import('../blockBuilding/compose.ts');
  type Profile = NonNullable<Parameters<typeof drawCurtainGrid>[0]['profile']>;
  const sys = {pitch: 1.5, lines: [0, 3.4, 6.2, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const}};
  let profile: Profile | null = null, plinth = 0, members = 0;
  const hook = (withPlinth: boolean) => (c: Parameters<typeof drawCurtainGrid>[0], info: {levels: number[]; cells: Parameters<typeof drawCurtainGrid>[1]}) => {
    if (c.p.n[2] < 0.9) return;
    profile = c.profile; members = c.p.members?.length ?? 0;
    const cells = withPlinth ? info.cells.filter(x => x.floor > 0) : info.cells;
    if (withPlinth) { c.box('door', c.p.uMin, c.p.uMax, 0, info.levels[1], 0, 0.09, c.part()); plinth++; }
    drawCurtainGrid(c, cells, info.levels, 'frame', 8.95);
  };
  const skin = {wallSlotFor: () => 'glass'};
  const r = bent(sys, true, {...skin, panelHook: hook(false)});
  const prof = profile as Profile | null;
  assert.ok(prof && kinksIn(prof, -100, 100).length === 1, 'the south panel bends once');
  assert.equal(members, 1, 'both strips dissolve into one bent member (earcut would span the bend)');
  assert.equal(r.m2, 0, 'mullions on the 13.5 cm layer never meet the bent skin');
  // every south glass triangle lies on one facet of the bent skin (no earcut triangle spans the bend)
  const g = r.mesh.slots.get('glass')!.positions, u0 = Math.min(...prof!.u);
  let worst = 0, n = 0;
  for (let i = 0; i < g.length; i += 9) {
    const cx = (g[i] + g[i + 3] + g[i + 6]) / 3, cz = (g[i + 2] + g[i + 5] + g[i + 8]) / 3;
    if (cz < 3.9) continue;
    n++; worst = Math.max(worst, Math.abs((cz - 4) - profileAt(prof!, u0 + cx + 6)));
  }
  assert.ok(n > 0 && worst < 0.01, `glass skin off the bent profile by ${worst} m`);
  const withPlinth = bent(sys, true, {...skin, panelHook: hook(true)});
  assert.ok(plinth > 0);
  assert.equal(withPlinth.m2, 0, 'the plinth panel (9 cm) shares no plane with the skin or the grid above it');
});

test('layered kit: a thin stone arch ring (3 cm) stands a full sheet layer off the wall (ring/brick)', async () => {
  const wall = await layeredWall();
  // Amsterdams Lyceum's gateway rings (archFor 'stone', 3 cm) measured 3.0 cm off a brick face a few mm proud of the panel
  const gate = {w: 0.92, h: 0.86, sill: 0.06, mull: 0, frameW: 0, frame: 'frame', glass: 'door', arch: {kind: 'round' as const, band: {slot: 'stone', t: 0.2, out: 0.025}}};
  const sys = {pitch: 3, lines: [0, 3.4, 6.2, 9], ground: {kind: 'punched' as const, win: gate}, typical: {kind: 'wall' as const}};
  assert.ok(wall(sys, false).m2 > 0.1, "a 3 cm ring is in the audit's tight band");
  assert.equal(wall(sys, true).m2, 0);
});

test('layered kit: wall lettering is closed strokes a sheet layer off the brick, not a 1.2 cm sheet (letters/brick)', async () => {
  const wall = await layeredWall(), {drawLettering} = await import('../blockBuilding/components.ts');
  const sys = {pitch: 3, lines: [0, 3.4, 6.2, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const}};
  let n = 0;
  const panelHook = (c: Parameters<typeof drawLettering>[0]) => { if (c.p.n[2] > 0.9) n += drawLettering(c, 'HET AMSTERDAMS LYCEUM', 0, 5, 0.012, 0.6, 9, 'stone', (u, v, d) => c.onWallAt(u, v, d)); };
  const legacy = wall(sys, false, {panelHook}), layered = wall(sys, true, {panelHook});
  assert.ok(legacy.m2 > 0.03, `legacy letters 1.2 cm off the brick: ${legacy.m2} m2`);
  assert.equal(layered.m2, 0);
  // closed: every stroke edge is shared, except the back edges standing on the wall (z = 4)
  const pos = layered.mesh.slots.get('stone')!.positions, count = new Map<string, number>(), key = (i: number) => [pos[i], pos[i + 1], pos[i + 2]].map(x => x.toFixed(4)).join(',');
  for (let i = 0; i < pos.length; i += 9) for (const [a, b] of [[0, 3], [3, 6], [6, 0]]) { const k = [key(i + a), key(i + b)].sort().join('|'); count.set(k, (count.get(k) ?? 0) + 1); }
  const open = [...count.entries()].filter(([, c]) => c === 1).map(([k]) => k.split('|').map(q => q.split(',').map(Number)));
  assert.ok(n > 0 && open.every(([a, b]) => Math.abs(a[2] - 4) < 0.001 && Math.abs(b[2] - 4) < 0.001), 'only back edges (on the wall plane) are single');
});

test('layeredKit is the default for kind: large (false keeps the legacy kit); mesh-plinth only under a layered curtain wall', async () => {
  const {compileLargeBuilding} = await import('./largeCompile.ts');
  const {createHash} = await import('node:crypto');
  const meshHash = (intent: LargeBuildingIntent, f: BuildingFacts) => {
    const h = createHash('sha256');
    for (const m of [...compileLargeBuilding(intent, f, {budget: 1e9}).group.children].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      h.update(m.name); h.update(Buffer.from(new Float32Array(Array.from((m as unknown as {geometry: {getAttribute(n: string): {array: ArrayLike<number>}}}).geometry.getAttribute('position').array)).buffer));
    }
    return h.digest('hex');
  };
  const base = raw('politie-zuid-de-pijp'), f = facts('politie-zuid-de-pijp');
  assert.equal(base.layeredKit, undefined);
  const dflt = meshHash(validateLargeIntent(base), f);
  assert.equal(dflt, meshHash(validateLargeIntent({...base, layeredKit: true}), f));
  assert.notEqual(dflt, meshHash(validateLargeIntent({...base, layeredKit: false}), f));
  const sw = raw('stadsloket-west');
  assert.deepEqual(sw.walls.map((w: {ground?: string}) => w.ground).filter((g: string | undefined) => g === 'mesh-plinth').length, 2);
  assert.throws(() => validateLargeIntent({...sw, layeredKit: false}), /mesh-plinth/);
  assert.throws(() => validateLargeIntent({...sw, walls: [{...sw.walls[0], ground: 'mesh-plinth'}, ...sw.walls.slice(1)]}), /mesh-plinth/);
  assert.throws(() => validateLargeIntent({...sw, walls: [sw.walls[0], sw.walls[1], {...sw.walls[2], ground: 'blank'}, ...sw.walls.slice(3)]}), /glass skin/);
  const built = compileLargeBuilding(validateLargeIntent(sw), facts('stadsloket-west'));
  assert.equal(built.components.plinths, 2);
  assert.equal(built.components.curtainGrids, 2);
});

// ---------------------------------------------------------------------------------------------------------------
// Kit vocabulary for the rejected pilots (2026-10-14): Apollohal's glazed hall, Houthavenkade 26's glass balcony
// columns, Waagdragerhof's French windows over storey ledges, arch ring colour, and openings trimmed into a stepped wall.

test('glazed hall: the wall is the glass skin, a brick base facing, sill, mullion grid and structural posts on it; no coplanar overlap (Apollohal)', async () => {
  const wall = await layeredWall(), {drawGlazedHall} = await import('../blockBuilding/components.ts');
  const sys = {pitch: 6, lines: [0, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const}};
  let boxes = 0;
  const hook = (c: Parameters<typeof drawGlazedHall>[0], info: {cells: Parameters<typeof drawGlazedHall>[1]}) => { boxes += drawGlazedHall(c, info.cells, 3.6, 8.95, 10, 4, {wall: 'wall', frame: 'frame', stone: 'stone'}); };
  const skin = {wallSlotFor: () => 'glass'}, bare = wall(sys, true, skin), hall = wall(sys, true, {...skin, panelHook: hook});
  assert.ok(boxes > 20, `${boxes} boxes`);
  assert.ok(hall.tris > bare.tris + 200 && hall.tris < bare.tris + 1500, `${hall.tris - bare.tris} triangles for a 12 m hall front`);
  assert.equal(hall.m2, 0);
  assert.ok(hall.mesh.slots.get('glass')!.positions.length > 0);
});

test('glazed columns: enclosed glass bays with edge posts and a slab per storey line over the listed bays, no coplanar overlap', async () => {
  const wall = await layeredWall(), {drawGlazedColumns} = await import('../blockBuilding/components.ts');
  const win = {w: 0.5, h: 0.6, sill: 0.8, frame: 'frame', glass: 'glass', frameW: 0.06};
  const sys = {pitch: 1.5, lines: [0, 3, 6, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const, cycle: [{kind: 'punched' as const, win}, {kind: 'wall' as const}, {kind: 'wall' as const}, {kind: 'punched' as const, win}]}};
  for (const slabs of [true, false]) {
    let stripes = 0;
    const hook = (c: Parameters<typeof drawGlazedColumns>[0], info: {levels: number[]; cells: Parameters<typeof drawGlazedColumns>[1]}) => { stripes += drawGlazedColumns(c, info.cells, info.levels, b => b % 4 === 1 || b % 4 === 2, 1, 0.95, slabs, 8.8, {glass: 'glass', frame: 'frame', stone: 'stone'}); };
    const r = wall(sys, true, {panelHook: hook});
    assert.equal(stripes, 2, 'two runs of two adjacent column bays on the 12 m front');
    assert.equal(r.m2, 0, slabs ? 'balcony bays' : 'flush bands');
  }
});

test('french-window-ledge: tall windows over a continuous ledge under every sill, optional segmental heads; no coplanar overlap', async () => {
  const {largeSystem, FRENCH_WINDOW} = await import('../blockBuilding/systems.ts');
  const slots = {frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame', arch: 'arch'};
  const fit = {pitchM: 2, lines: [0, 3, 6, 9], ground: 'system' as const, slots, layered: true, deepBars: true};
  const sys = largeSystem('french-window-ledge', fit), win = sys.typical.win!, band = sys.bands!.at(-1)!;
  assert.equal(win.h, FRENCH_WINDOW.h);
  assert.ok(band.lift! + band.h / 2 <= win.sill! - 0.01, 'ledge top under the sill');
  assert.equal(largeSystem('french-window-ledge', {...fit, shape: {w: 0.5, h: 0.78, sillM: 0.05}}).typical.win!.sill, FRENCH_WINDOW.ledgeH + 0.02, 'a measured sill never sinks into the ledge');
  const wall = await layeredWall();
  assert.equal(wall(sys, true).m2, 0);
  const arched = largeSystem('french-window-ledge', {...fit, arches: {windows: 'segmental'}});
  assert.equal(arched.typical.win!.arch?.kind, 'segmental');
  assert.equal(wall(arched, true).m2, 0);
});

test('kit vocabulary in intents: hall/columns validated, palette.arch colours the arch ring, the systems fit and compile', () => {
  const base = raw('waagdragerhof-198-118320'), w = base.walls;
  assert.throws(() => validateLargeIntent({...base, walls: [{...w[0], system: 'glazed-hall', hall: undefined}, ...w.slice(1)]}), /hall/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...w[0], system: 'glazed-hall', hall: {base: 0.4, lights: 10, rows: 3, pitchM: 1}}, ...w.slice(1)]}), /pitchM/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...w[0], system: 'glazed-columns', columns: {bays: [99]}}, ...w.slice(1)]}), /columns.bays/);
  assert.throws(() => validateLargeIntent({...base, walls: [{...w[0], hall: {base: 0.4, lights: 10, rows: 3}}, ...w.slice(1)]}), /only system glazed-hall/);
  const {recipe} = fitLarge(validateLargeIntent(base), facts('waagdragerhof-198-118320'));
  assert.equal(recipe.spec.palette['arch@g3'], '#8a4c40');
  assert.deepEqual(recipe.groups.map(g => g.system), ['french-window-ledge', 'french-window-ledge', 'brick-bay-grid', 'brick-bay-grid']);
  const apollo = fitLarge(validateLargeIntent(raw('apollolaan-4-134507')), facts('apollolaan-4-134507')).recipe.groups[0];
  assert.deepEqual([apollo.system, apollo.hall?.lights, apollo.hall?.rows], ['glazed-hall', 26, 6]);
  assert.ok(Math.abs(apollo.hall!.baseM - 0.4 * apollo.eavesM) < 0.01);
  const hk = fitLarge(validateLargeIntent(raw('houthavenkade-26-247232')), facts('houthavenkade-26-247232')).recipe.groups;
  assert.deepEqual(hk.slice(0, 2).map(g => [g.system, g.columns?.slabs, g.slots.wall]), [['glazed-columns', true, 'wall@g0'], ['glazed-columns', true, 'wall@g1']]);
});

// Houthavenkade 26: reflective grey balcony-column glass beside dark punched panes on the same front.
test('columns.glass: validated; the glass columns draw in their own glass slot, the punched windows keep the group glass; absent = one glass slot', async () => {
  const {compileLargeBuilding} = await import('./largeCompile.ts');
  const base = raw('houthavenkade-26-247232'), w0 = base.walls[0], f = facts('houthavenkade-26-247232');
  assert.throws(() => validateLargeIntent({...base, walls: [{...w0, columns: {...w0.columns, glass: 'silvery'}}, ...base.walls.slice(1)]}), /columns.glass/);
  const noCol = {...w0, columns: {...w0.columns}}; delete noCol.columns.glass;
  const plain = compileLargeBuilding(validateLargeIntent({...base, walls: [noCol, ...base.walls.slice(1)]}), f);
  const split = compileLargeBuilding(validateLargeIntent({...base, walls: [{...noCol, columns: {...noCol.columns, glass: '#8e9ea4'}}, ...base.walls.slice(1)]}), f);
  assert.equal(split.recipe.groups[0].columns?.glass, 'glass@g0c');
  assert.equal(split.recipe.spec.palette['glass@g0c'], '#8e9ea4');
  const tris = (c: typeof plain, name: string) => { const m = c.group.children.find(x => x.name === name) as any; return m ? m.geometry.attributes.position.count / 3 : 0; };
  const glass0 = plain.recipe.groups[0].slots.glass;
  assert.equal(tris(plain, 'glass/glass@g0c'), 0);
  assert.ok(tris(split, 'glass/glass@g0c') > 0);
  assert.equal(tris(split, 'glass/glass@g0c') + tris(split, `glass/${glass0}`), tris(plain, `glass/${glass0}`), 'the same glass, two slots');
  assert.ok(tris(split, `glass/${glass0}`) > 0, 'the punched windows keep the group glass');
});

test('the three re-fitted pilots pass the large-tier gates within the 12k budget', async () => {
  for (const id of ['apollolaan-4-134507', 'houthavenkade-26-247232', 'waagdragerhof-198-118320']) {
    const {gates, tris, built} = await gatesOf(validateLargeIntent(raw(id)), facts(id));
    assert.ok(tris.length <= LARGE_BUDGET_TRIANGLES, `${id}: ${tris.length}`);
    assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), [], id);
    assert.equal(built.stats.proud ?? 0, 0, id);
  }
});

test('Singel 457 Kalverstraat front at 6 storeys: the head that stood 3 mm into the stepped 3DBAG outline is trimmed and cut, not laid proud', () => {
  const id = 'singel-457-165086', intent = raw(id);
  intent.walls[3].storeys = 6;
  const built = compileBuilding(validateLargeIntent(intent), facts(id)) as import('./largeCompile.ts').CompiledLargeBuilding;
  assert.equal(built.stats.proud, 0);
  assert.equal(built.stats.trimmed, 1);
  // installed (5 storeys) nothing is trimmed: the stat is absent and the mesh unchanged (large-mesh-hashes)
  assert.equal((compileBuilding(validateLargeIntent(raw(id)), facts(id)) as import('./largeCompile.ts').CompiledLargeBuilding).stats.trimmed, undefined);
});

test('garageBays puts garage doors in exactly the listed bays; absent = identical to garageDoors from the right', async () => {
  const base = validateLargeIntent(raw('politie-van-leijenberghlaan'));
  const at = (g: Partial<LargeBuildingIntent['walls'][number]>) => validateLargeIntent({...base, walls: base.walls.map((w, i) => i === 2 ? {...w, baysPerStorey: 5, ...g} : w)});
  const f = facts('politie-van-leijenberghlaan');
  const fitBays = (g: Partial<LargeBuildingIntent['walls'][number]>) => fitLarge(at(g), f).recipe.groups[2].garage?.bays;
  assert.deepEqual(fitBays({garageBays: [0, 2]}), [0, 2]);
  assert.deepEqual(fitBays({garageDoors: 2}), [3, 4]);
  assert.throws(() => at({garageBays: [1], garageDoors: 1}), /alternatives/);
  assert.throws(() => validateLargeIntent({...base, walls: base.walls.map((w, i) => i === 2 ? {...w, garageBays: [1]} : w)}), /baysPerStorey/);
  const {built, gates} = await gatesOf(at({garageBays: [0, 2]}), f);
  assert.equal(built.components.garageDoors, 2);
  assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), []);
});

test('measured groups export their wall, arch-ring and own glass slots with tintSource measured; houses without a measured record do not', () => {
  const tinted = (id: string) => {
    const g = (compileBuilding(validateLargeIntent(raw(id)), facts(id)) as import('./largeCompile.ts').CompiledLargeBuilding).group, out: string[] = [];
    g.traverse(o => { const m = (o as {material?: {userData?: {tintSource?: string}}}).material; if (m?.userData?.tintSource === 'measured') out.push(o.name); });
    return out.sort();
  };
  // Houthavenkade: the balcony columns' own reflective glass (columns.glass) is measured; the punched windows keep the kit glass (the photo's pane glass reads no darker than the brick).
  assert.deepEqual(tinted('houthavenkade-26-247232'), ['glass/glass@g0c', 'glass/glass@g1c', 'wall/wall@g0', 'wall/wall@g1', 'wall/wall@g3', 'wall/wall@g4']);
  // The glazed hall's measured dark grey-blue glass reaches the look (look/palette.ts `cityMeasuredGlassTint`); the kit glass of unmeasured groups does not. Its white membrane roof is measured from the orthophoto (roof.flatHex).
  assert.deepEqual(tinted('apollolaan-4-134507'), ['glass/glass@g0', 'roof/flat', 'wall/wall@g0', 'wall/wall@g1']);
  assert.ok(tinted('waagdragerhof-198-118320').includes('wall/arch@g3'));
  assert.deepEqual(tinted('politie-west-overtoomsesluis'), []);
});

test('roof.flatHex: a measured flat roof is exported as measured and drawn as is; absent = identical mesh (Kinkerstraat 89-105 slab, 2026-10-16)', async () => {
  const {cityTint, FLAT_ROOF_GREYS} = await import('../look/palette.ts');
  const base = validateLargeIntent(raw('kinkerstraat-89-092013')), f = facts('kinkerstraat-89-092013');
  assert.throws(() => validateLargeIntent({...base, roof: {material: 'slate', flatHex: 'grey'}}), /roof\.flatHex/);
  assert.throws(() => validateLargeIntent({...base, roof: {material: 'slate', tone: 1}}), /roof\.tone/);
  const flatOf = (group: any) => { let m: any = null; group.traverse((o: any) => { if (o.isMesh && o.name === 'roof/flat') m = o.material; }); return m; };
  const {flatHex: _drop, ...roofWithout} = base.roof ?? {material: 'slate' as const};
  const plain = compileBuilding({...base, roof: roofWithout}, f), measured = compileBuilding(validateLargeIntent({...base, roof: {...roofWithout, flatHex: '#87898D'}}), f);
  const before = flatOf(plain.group), after = flatOf(measured.group);
  assert.ok(before && after, 'the block has flat roofs');
  assert.notEqual(before.userData.tintSource, 'measured');
  assert.equal(after.userData.tintSource, 'measured');
  assert.equal('#' + after.color.getHexString(), '#87898d');
  // Only the flat roof's colour changes: same meshes, same vertex counts, same other colours.
  const sig = (g: any) => { const out: string[] = []; g.traverse((o: any) => { if (o.isMesh) out.push(`${o.name}|${o.name === 'roof/flat' ? '' : o.material.color.getHexString()}|${o.geometry.attributes.position.count}`); }); return out.join(';'); };
  assert.equal(sig(measured.group), sig(plain.group));
  // The look: the kit's flat grey lands on a flat-roof prior (buff gravel for #6a6c6c, the slab); the measured colour is kept.
  assert.ok(FLAT_ROOF_GREYS.includes(cityTint('bitumen', '#' + before.color.getHexString())));
  assert.equal(cityTint('bitumen', '#87898d', 'measured'), '#87898d');
});

test('roof.flatHex composes with roof.flat and roof.surfaces (Entrepotdok): one measured flat mesh, regions keep their material', async () => {
  const base = validateLargeIntent(raw('entrepotdok-164981')), f = facts('entrepotdok-164981');
  assert.ok(base.roof?.flat || base.roof?.surfaces, 'Entrepotdok re-materials its roof');
  assert.equal(base.roof?.flatHex, undefined);
  const tris = (g: any) => { const out = new Map<string, number>(); g.traverse((o: any) => { if (o.isMesh && o.name.startsWith('roof/')) out.set(o.name, o.geometry.attributes.position.count / 3); }); return out; };
  const plain = tris(compileBuilding(base, f).group);
  const measuredGroup = compileBuilding(validateLargeIntent({...base, roof: {...base.roof!, flatHex: '#56585e'}}), f).group, measured = tris(measuredGroup);
  // every flat triangle that took `material` or `flat` moves into the one measured `roof/flat`; steep/low and other meshes keep their counts
  const flatOutside = [...plain].filter(([n]) => n === 'roof/flat' || n === `roof/flat/${base.roof!.flat}`).reduce((s, [, c]) => s + c, 0);
  assert.equal(measured.get('roof/flat'), flatOutside);
  if (base.roof!.flat && base.roof!.flat !== base.roof!.material) assert.equal(measured.has(`roof/flat/${base.roof!.flat}`), false);
  for (const [n, c] of plain) if (!n.startsWith('roof/flat')) assert.equal(measured.get(n), c, n);
  let mat: any = null; measuredGroup.traverse((o: any) => { if (o.isMesh && o.name === 'roof/flat') mat = o.material; });
  assert.equal(mat.userData.tintSource, 'measured');
});

// ---------------------------------------------------------------------------------------------------------------
// Rietveld building (1967): a curtain wall of square modules where every storey is a clear vision band between frosted
// spandrel bands, over a low dark plinth (lane public-large-20261017).

test('curtain-wall spandrels: panels on the 9 cm layer, the grid one layer out with rails at the panel edges; no coplanar overlap', async () => {
  const wall = await layeredWall(), {drawSpandrels, drawCurtainGrid, CURTAIN_GRID_OVER_SPANDRELS, CURTAIN_GRID} = await import('../blockBuilding/components.ts');
  const sys = {pitch: 2, lines: [0, 1.4, 5.2, 9], ground: {kind: 'wall' as const}, typical: {kind: 'wall' as const}};
  let panels = 0, rails: number[] = [], gridLevels: number[] = [];
  const hook = (c: Parameters<typeof drawSpandrels>[0], info: {levels: number[]; cells: Parameters<typeof drawSpandrels>[1]}) => {
    if (c.p.n[2] < 0.9) return;
    const cells = info.cells.filter(x => x.floor > 0), sp = drawSpandrels(c, cells, info.levels, {sill: 0.25, head: 0.25, slot: 'stone'}, 8.95);
    panels += sp.panels; rails = sp.rails;
    gridLevels = sp.gridLevels;
    drawCurtainGrid(c, cells, sp.gridLevels, 'frame', 8.95, CURTAIN_GRID_OVER_SPANDRELS);
  };
  const r = wall(sys, true, {wallSlotFor: () => 'glass', panelHook: hook});
  // storeys 1.4-5.2 and 5.2-8.95 (unit 3.8): sill 1.4-2.35, head+sill 4.25-6.15 (one panel across the floor line), top head 8.0-8.905 (under the top rail centre)
  assert.equal(panels, 3, 'three bands on the 12 m front, the two meeting at 5.2 m merged');
  assert.deepEqual(rails, [2.35, 4.25, 6.15, 8], 'transoms at the vision band edges');
  assert.deepEqual(gridLevels, [0, 1.4, 2.35, 4.25, 6.15, 8, 9], 'the 5.2 m floor line inside the merged panel takes no transom');
  assert.equal(r.m2, 0, 'spandrels (9 cm), transoms (13.5 cm) and mullions (18 cm) never share a plane');
  assert.ok(r.mesh.slots.get('stone')!.positions.length > 0);
  // the plain grid keeps its layers: the default argument is the old one
  assert.deepEqual({...CURTAIN_GRID_OVER_SPANDRELS, postOut: CURTAIN_GRID.postOut, railOut: CURTAIN_GRID.railOut}, CURTAIN_GRID);
});

test('spandrels, groundFactor and palette.plinth: validated, fitted (no parapet allowance, low plinth storey) and compiled within the gates (Rietveld building)', async () => {
  const id = 'rietveld-gebouw-077325', base = raw(id), w0 = base.walls[0];
  const intent = validateLargeIntent(base), f = facts(id);
  const bad = (patch: object, re: RegExp) => assert.throws(() => validateLargeIntent({...base, walls: [{...w0, ...patch}, ...base.walls.slice(1)]}), re);
  bad({spandrels: {sill: 0.5, head: 0.5}}, /vision band/);
  bad({spandrels: {sill: 0.25, top: 0.2}}, /top/);
  bad({system: 'brick-bay-grid', ground: 'system', spandrels: {sill: 0.25}}, /layered curtain-wall/);
  bad({groundFactor: 0.1}, /groundFactor/);
  bad({ground: 'system', palette: {...w0.palette, plinth: '#888888'}}, /plinth/);
  assert.throws(() => validateLargeIntent({...base, layeredKit: false}), /spandrels/);
  const {recipe} = fitLarge(intent, f), g0 = recipe.groups[0];
  assert.ok(g0.spandrels && g0.spandrels.sill === 0.25 && g0.spandrels.head === 0.25);
  assert.equal(recipe.spec.palette[g0.spandrels!.slot], w0.spandrels.colour);
  assert.ok(recipe.measuredSlots?.includes(g0.spandrels!.slot), 'a measured group draws its spandrel colour as measured');
  // 5 storeys, ground 0.4 of an upper storey, lines up to the eaves (no 0.5 m parapet)
  const h = g0.storeyHeightsM;
  assert.ok(Math.abs(h[0] / h[1] - 0.4) < 0.01 && Math.abs(g0.lines[5] - g0.eavesM) < 0.01, JSON.stringify(g0.lines));
  // walls[1]'s plinth (groundFactor 1.4) ends on walls[0]'s second floor line, in its own matte slot
  const g1 = recipe.groups[1];
  assert.ok(Math.abs(g1.lines[1] - g0.lines[2]) < 0.2, `${g1.lines[1]} vs ${g0.lines[2]}`);
  assert.equal(recipe.spec.palette[g1.plinthSlot!], base.walls[1].palette.plinth);
  const {gates, tris, built} = await gatesOf(intent, f);
  assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), []);
  assert.ok(tris.length <= LARGE_BUDGET_TRIANGLES, `${tris.length}`);
  assert.ok((built.components as {spandrels?: number}).spandrels! > 20);
  // without the new fields the group is a plain layered curtain wall: no spandrel slot, the parapet allowance back
  const {spandrels: _s, groundFactor: _g, hand: _h, ...plainW0} = w0;
  const plain = fitLarge(validateLargeIntent({...base, measured: undefined, walls: [plainW0, base.walls[4]]}), f).recipe;
  assert.equal(plain.groups[0].spandrels, undefined);
  assert.equal(Object.keys(plain.spec.palette).some(k => k.startsWith('spandrel@')), false);
  assert.ok(plain.groups[0].lines[5] < plain.groups[0].eavesM - 0.4, 'the plain grid keeps the 0.5 m parapet');
});

test('storey-height gate: a mesh plinth under a curtain wall may be a low raised plinth; any other ground keeps 2.3 m', async () => {
  const {LARGE_MIN_PLINTH_M} = await import('./largeGates.ts');
  assert.equal(LARGE_MIN_PLINTH_M, 1.2);
  const id = 'rietveld-gebouw-077325', base = raw(id);
  const {spandrels: _s, ...w0} = base.walls[0];
  const glazedGround = {...base, walls: [{...w0, system: 'brick-bay-grid', ground: 'glazed'}, ...base.walls.slice(1)]};
  const {gates} = await gatesOf(validateLargeIntent(glazedGround), facts(id));
  assert.equal(gates.find(g => g.id === 'storey-height/walls[0]')?.pass, false, 'a 1.7 m glazed ground storey is still refused');
});

// ---------------------------------------------------------------------------------------------------------------
// Gerrit Rietveld Academie 2006 (pand 0363100012091838): two 3DBAG shells numbered from 1 each, a dimpled-metal tower with
// ribbon windows over part of its width, a low block with a white expanded-metal screen storey (lane public-large-20261017).

test('walls[].shell: a surface index claims only its own shell; without shell it claims every shell (as before)', () => {
  const id = 'rietveld-academie-091838', base = raw(id), f = facts(id);
  const {recipe, report} = fitLarge(validateLargeIntent(base), f);
  // surface 7 is the tower's south front in shell 2 and a 4 m lightwell wall in shell 1; surface 8 the low block's south front in shell 1
  const panelsOf = (gi: number) => report.panels.filter(p => p.group === gi);
  assert.deepEqual(panelsOf(0).map(p => Math.round(p.widthM)), [40]);
  assert.deepEqual(panelsOf(2).map(p => Math.round(p.widthM)), [29]);
  assert.equal(recipe.groups[0].mainPanel, panelsOf(0)[0].index);
  // the lightwell's surface 7 (shell 1) is left to otherWalls
  assert.ok(report.panels.some(p => p.group === -1 && p.surfaces.includes(7)));
  // without shell, walls[0] also takes the shell-1 surface 7 (the old behaviour)
  const strip = (w: {shell?: number}) => { const {shell: _x, ...rest} = w; return rest; };
  const noShell = fitLarge(validateLargeIntent({...base, measured: undefined, walls: [strip(base.walls[0]), strip(base.walls[1])]}), f).report;
  assert.ok(noShell.panels.filter(p => p.group === 0).length > 1);
  // validation: shell-qualified duplicates clash only within a shell; an unqualified surface clashes with every shell
  assert.throws(() => validateLargeIntent({...base, walls: [...base.walls, {...base.walls[3], wallSurfaces: [7], shell: 2}]}), /surface 7 is already/);
  assert.doesNotThrow(() => validateLargeIntent({...base, walls: [...base.walls, {...base.walls[3], wallSurfaces: [7], shell: 1}]}));
  assert.throws(() => validateLargeIntent({...base, walls: [...base.walls, strip({...base.walls[3], wallSurfaces: [7]})]}), /surface 7 is already/);
  assert.throws(() => fitLarge(validateLargeIntent({...base, walls: [{...base.walls[0], wallSurfaces: [22]}, ...base.walls.slice(1)]}), f), /shell 2/);
});

test('openBays: windows only in the listed bays of the listed storeys, plain wall in the rest; absent = every bay', async () => {
  const id = 'rietveld-academie-091838', base = raw(id);
  const {largeSystem} = await import('../blockBuilding/systems.ts');
  const fit = {pitchM: 1.7, lines: [0, 3.7, 7.2, 10.7, 14.2], ground: 'glazed' as const, bays: 6, shape: {w: 0.93, h: 0.36, sillM: 0.56}, slots: {frame: 'f', stone: 's', glass: 'g', door: 'd', curtain: 'c'}};
  const plain = largeSystem('ribbon-windows', fit), open = largeSystem('ribbon-windows', {...fit, openBays: [{storeys: [1, 3], bays: [1, 2]}]});
  for (const st of ['1', '3']) {
    const row = open.rowOverrides![st];
    assert.equal(row.kind, 'wall');
    assert.deepEqual(row.cycle!.map(r => r.kind), ['wall', 'ribbon', 'ribbon', 'wall', 'wall', 'wall']);
    assert.deepEqual(row.cycle![1], plain.typical);
  }
  assert.equal(open.rowOverrides!['2'], undefined);
  assert.deepEqual({...open, rowOverrides: undefined}, {...plain, rowOverrides: undefined});
  // validated: needs a windowed system, bays in range, no clash with blank storeys, each storey once
  const bad = (patch: object, re: RegExp) => assert.throws(() => validateLargeIntent({...base, walls: [{...base.walls[0], ...patch}, ...base.walls.slice(1)]}), re);
  bad({openBays: [{storeys: [1], bays: [23]}]}, /openBays\[0\]\.bays/);
  bad({openBays: [{storeys: [2], bays: [1]}]}, /blank storey/);
  bad({openBays: [{storeys: [1], bays: [1]}, {storeys: [1], bays: [2]}]}, /listed twice/);
  bad({system: 'curtain-wall', openBays: [{storeys: [1], bays: [1]}]}, /openBays: needs windows/);
});

test('meshScreen: one closed pale panel per bay on the listed storeys, open where a window is cut, within the gates; absent = no screen', async () => {
  const id = 'rietveld-academie-091838', base = raw(id), f = facts(id);
  const intent = validateLargeIntent(base);
  const {gates, tris, built} = await gatesOf(intent, f);
  assert.deepEqual(gates.filter(g => !g.pass).map(g => g.id), []);
  assert.ok(tris.length <= LARGE_BUDGET_TRIANGLES, `${tris.length}`);
  // the south front: 11 bays less the window bay; the low block's other walls one per bay
  const screens = (built.components as {meshScreens?: number}).meshScreens!;
  assert.ok(screens >= 10 + 13, `${screens}`);
  const {recipe} = fitLarge(intent, f), g2 = recipe.groups[2];
  assert.deepEqual({...g2.meshScreen!, slot: ''}, {storeys: [1], from: 0.15, to: 0.88, joint: 0.06, slot: ''});
  assert.ok(recipe.measuredSlots?.includes(g2.meshScreen!.slot));
  const bad = (patch: object, re: RegExp) => assert.throws(() => validateLargeIntent({...base, walls: [base.walls[0], base.walls[1], {...base.walls[2], ...patch}, base.walls[3]]}), re);
  bad({meshScreen: {storeys: [1], colour: '#ffffff', from: 0.5, to: 0.6}}, /meshScreen: 0 <= from/);
  bad({meshScreen: {storeys: [1], colour: '#ffffff', joint: 1}}, /joint/);
  bad({meshScreen: {storeys: [1]}}, /colour/);
  // without meshScreen: no screen slot, no screen panels
  const {meshScreen: _m, ...w2} = base.walls[2], {meshScreen: _n, ...w3} = base.walls[3];
  const plain = validateLargeIntent({...base, walls: [base.walls[0], base.walls[1], w2, w3]});
  assert.equal(Object.keys(fitLarge(plain, f).recipe.spec.palette).some(k => k.startsWith('screen@')), false);
  assert.equal((compileBuilding(plain, f).components as {meshScreens?: number}).meshScreens, undefined);
});
