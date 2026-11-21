/**
 * Belt kit, cornice lane (2026-11-21, Herengracht 2-90): the deep cornice from measured parts, where the cornice zone
 * stands (on the survey eaves or inside it), the cornice centre's body, shoulders, stepped cap and arc, and that nothing
 * moves without them: the stock timber cornices draw byte for byte as on the base (aab21bc485).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { corniceOnTop, corniceReadParts, entablatureBands, ENTABLATURE, pieceCentres, pieceWidth, profileOf, type CorniceProfile } from './entablature.ts';
import { beltPlotFacts } from '../beltReview/plotRead.ts';
import { soloCorniceBandM, soloDressAtDepth, SOLO_CORNICE_DRESS } from '../designUnits/draw.ts';
import { ORNAMENT_COMPONENTS, ROW_DOORCASE } from '../facadeOrnaments.ts';
import { ExtraSink } from '../facadeExtraCore.ts';
import type { ExtraContext } from '../facadeExtras.ts';
import type { RowCorniceDress } from '../houseSpec/row/types.ts';

/** Herengracht 10 as measured on the crop: corona, 19 modillions, a dentil bed, frieze and architrave. */
const H10: Omit<CorniceProfile, 'depthM'> = { corona: 0.25, course: 0.3, carry: 'modillions', count: 19, bed: 0.2, dentils: true, frieze: 0.17, architrave: 0.08 };

test('entablatureBands: the shares top down over the depth, normalised; a sliver dropped; no corona or depth: none', () => {
  const b = entablatureBands({ depthM: 4, ...H10 });
  assert.deepEqual(b.map(x => x.part), ['corona', 'course', 'bed', 'frieze', 'architrave']);
  assert.equal(b[0].z0, 0);
  assert.ok(Math.abs(b[b.length - 1].z1 - 4) < 1e-3, 'the bands fill the depth');
  for (let i = 1; i < b.length; i++) assert.ok(Math.abs(b[i].z0 - b[i - 1].z1) < 1e-3, 'contiguous');
  // Shares that do not sum to 1 are normalised (Herengracht 40's sum 1.0, 30's sum 1.0, a read summing 2 the same bands).
  assert.deepEqual(entablatureBands({ depthM: 2, corona: 1, bed: 1 }).map(x => [x.part, x.z1]), [['corona', 1], ['bed', 2]]);
  assert.deepEqual(entablatureBands({ depthM: 2, corona: 0.5, bed: 0.01 }).map(x => x.part), ['corona'], 'a 4 cm band is not drawn');
  assert.deepEqual(entablatureBands({ depthM: 0, corona: 0.5 }), []);
  assert.deepEqual(entablatureBands({ depthM: 3, attic: 0.36, corona: 0.1, frieze: 0.46, architrave: 0.08 }).map(x => x.part), ['attic', 'corona', 'frieze', 'architrave']);
});

test('pieceCentres / pieceWidth: the counted pieces evenly, else the stock pitch; a piece never wider than its kind', () => {
  const xs = pieceCentres(8.59, { count: 19 });
  assert.equal(xs.length, 19);
  assert.ok(Math.abs(xs[0] - 8.59 / 38) < 1e-3 && Math.abs(xs[18] - (8.59 - 8.59 / 38)) < 1e-3);
  assert.equal(pieceCentres(11, {}).length, Math.round(11 / ENTABLATURE.pitchM));
  assert.equal(pieceCentres(1, {}).length, 3);
  assert.deepEqual(pieceCentres(0, {}), []);
  assert.equal(pieceWidth(0.45, 'modillions'), +(0.45 * ENTABLATURE.pieceShare.modillions).toFixed(4));
  // Herengracht 54: 11 modillions on 14 m stand 0.3 m wide, not 0.53 m.
  assert.equal(pieceWidth(14 / 11, 'modillions'), ENTABLATURE.pieceMaxM.modillions);
});

test('corniceOnTop: the photo wall decides (Herengracht 10 on the eaves; 40, 42, 60 inside it); unmeasured: inside', () => {
  assert.equal(corniceOnTop(15.58, 3.21, 14.78), true, '10: the survey eaves is the wall top, the zone stands on it');
  assert.equal(corniceOnTop(18.66, 3.66, 17.12), true, '48');
  assert.equal(corniceOnTop(21.36, 4.14, 18.14), false, '40: the survey eaves is the cornice top');
  assert.equal(corniceOnTop(15.33, 2.93, 13.42), false, '42');
  assert.equal(corniceOnTop(16.74, 2.85, 14.96), false, '60');
  assert.equal(corniceOnTop(15.58, 3.21, NaN), false);
  assert.equal(corniceOnTop(15.58, 0, 14.78), false);
});

test('profileOf / corniceReadParts: the read validated; paint, centre body, shoulders, arc and cap mapped; none removes', () => {
  assert.equal(profileOf({ course: 0.5 }, 3), null, 'no corona');
  assert.equal(profileOf(H10, 0), null, 'no depth');
  assert.deepEqual(profileOf({ ...H10, carry: 'spikes', count: 400, friezeBody: 'glass' }, 3.2), { depthM: 3.2, corona: 0.25, course: 0.3, bed: 0.2, frieze: 0.17, architrave: 0.08, dentils: true });
  const p = corniceReadParts({ corniceProfile: H10, cornicePaint: '#857F76', centreDress: { centre: 'attic', body: 'paint', shoulders: 'scrolls', cap: 'stepped', riseM: 2, share: 0.47, light: 'none', arc: { tympanum: 'wall', springM: 0.67 } } }, 3.2);
  assert.deepEqual(p, { profile: { depthM: 3.2, ...H10 }, paint: '#857f76', centre: 'attic', centreBody: 'paint', centreShoulders: 'scrolls', centreArc: { tympanum: 'wall', springM: 0.67 }, centreCap: 'stepped', centreRiseM: 2, centreShare: 0.47, centreLight: undefined });
  assert.equal((corniceReadParts({ corniceProfile: H10 }, undefined).profile as CorniceProfile).depthM, 0, 'unmeasured: filled by soloDressAtDepth');
  assert.deepEqual(corniceReadParts({}, 3), {});
});

const H10_FIELDS = { storeys: 4, bays: 4, crown: 'cornice', cornice: 'heavy', roofStorey: 'none', eavesM: 15.58, ground: 'dwelling' };
const H10_CROWN = { kind: 'cornice', centre: 'none', centreLight: 'none', consoles: 'dense', frieze: 'plain', cap: 'none', claws: 'none', px: { ground: 1165, foot: 340, apex: 70, left: 0, right: 501, w: 501, h: 1200, ppm: 58.031 } };

test('beltPlotFacts: Herengracht 10 stands its cornice on the 15.58 m wall (the uppers keep 3 m); 40 inside; the profile reaches the cornice form', () => {
  const read = { corniceRatio: 0.206, photoWallM: 14.78, corniceProfile: H10, crownForm: H10_CROWN } as never;
  const p = beltPlotFacts(H10_FIELDS, read, { widthM: 8.59 })!;
  // The zone is 0.206 of the pavement-to-cornice-top height: 4.04 m on the 15.58 m wall, the top at 19.62 m.
  assert.equal(p.facts.corniceDepthM, 4.04);
  assert.equal(p.eavesM, 19.62);
  assert.equal(+(p.eavesM! - p.facts.corniceDepthM!).toFixed(2), 15.58, 'the wall keeps the survey eaves');
  assert.deepEqual(p.facts.corniceForm?.profile, { depthM: 4.04, ...H10 });
  // Without the photo wall: inside the eaves, as before.
  const inside = beltPlotFacts(H10_FIELDS, { corniceRatio: 0.206, crownForm: H10_CROWN } as never, { widthM: 8.59 })!;
  assert.equal(inside.eavesM, 15.58);
  assert.equal(inside.facts.corniceDepthM, 3.21);
  assert.equal(inside.facts.corniceForm?.profile, undefined);
  // An unusable survey eaves (Herengracht 14, 54: 3DBAG 2.4 m): the measured share of the drawn top.
  const low = beltPlotFacts({ ...H10_FIELDS, eavesM: 2.4 }, read, { widthM: 8.59 })!;
  assert.equal(low.eavesM, null);
  assert.equal(low.facts.corniceShare, 0.206);
  assert.equal(beltPlotFacts({ ...H10_FIELDS, eavesM: 2.4 }, { corniceRatio: 0.206, crownForm: H10_CROWN } as never)!.facts.corniceShare, undefined, 'only with a measured profile');
});

test('beltPlotFacts: a lone dormer over a cornice whose crown read stands an attic on the centre is that attic (Herengracht 90)', () => {
  const fields = { storeys: 4, bays: 3, crown: 'cornice', cornice: 'simple', roofStorey: 'dormers', dormers: { count: 1, kind: 'plain' }, eavesM: 14.95, ground: 'shop' };
  const crown = { ...H10_CROWN, centre: 'attic', cap: 'rounded', centreLight: 'square', consoles: 'none' };
  assert.equal(beltPlotFacts(fields, { roofMaterial: 'not-visible', crownForm: crown } as never)!.facts.roof, 'flat');
  assert.equal(beltPlotFacts(fields, { roofMaterial: 'slate', crownForm: crown } as never)!.facts.roof, 'dormers', 'a covering in view keeps the roof');
  assert.equal(beltPlotFacts({ ...fields, dormers: { count: 2 } }, { roofMaterial: 'not-visible', crownForm: crown } as never)!.facts.roof, 'dormers');
  assert.equal(beltPlotFacts(fields, { roofMaterial: 'not-visible', crownForm: { ...crown, centre: 'none' } } as never)!.facts.roof, 'dormers');
});

test('soloDressAtDepth / soloCorniceBandM: a profile is drawn at the measured depth, else the timber band; no profile: as before', () => {
  const heavy = SOLO_CORNICE_DRESS.heavy;
  assert.equal(soloDressAtDepth(heavy, undefined), heavy);
  const d = soloDressAtDepth({ ...heavy, profile: { depthM: 0, ...H10 } }, 4.04);
  assert.equal(d.profile!.depthM, 4.04);
  assert.equal(soloCorniceBandM(d), 4.04);
  assert.equal(d.scale, soloDressAtDepth(heavy, 4.04).scale, 'the centre mouldings keep the depth scale');
  const unmeasured = soloDressAtDepth({ ...heavy, profile: { depthM: 0, ...H10 } }, undefined);
  assert.equal(unmeasured.profile!.depthM, soloCorniceBandM(heavy));
});

// The row-cornice component on a 10 m wall, 16 m top (rowStoop.test.ts's harness).
const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-cornice')!;
const wall = (rowDress: unknown): ExtraContext => ({ id: 'h130', style: 'canal', period: 'canal', wallKey: 'front', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 10 }, base: 0, top: 16,
  layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 4, storeyM: 3.0, doorBays: [0] }, wallHex: '#6b4a3c', accentHex: '#ffffff', groundLevel: true, streetSide: true,
  openings: { upper: { axes: [0.5], width: 0.45, sill: 0.25, head: 0.85 }, ground: { axes: [0.5], width: 0.45, sill: 0.3, head: 0.8 }, doorWindow: null, door: { axis: 0.5, width: 0.4, bottom: 0, top: 0.8, fanlight: false } }, rowDress } as unknown as ExtraContext);
type Tri = { hex?: string; p: number[][] };
const run = (corniceDress?: RowCorniceDress): Tri[] => { const s = new ExtraSink(100000); comp.build(wall({ cornice: 'heavy', ...(corniceDress ? { corniceDress } : {}) }), s, 0); return s.tris as Tri[]; };
const zs = (ts: Tri[]) => ts.flatMap(t => t.p.map(p => p[2]));
const h12 = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);

test('row-cornice without the lane parts: byte-identical to the base (aab21bc485) for every stock timber dress', () => {
  // Hashes of the component's triangles taken on the base commit with this harness.
  const BASE: Record<string, [RowCorniceDress | undefined, string]> = {
    heavy: [undefined, '987465af0d83'],
    lights: [{ paint: 'cream', frieze: 'attic-lights', supports: 'modillions' }, '022e1214d94d'],
    consolesEnds: [{ frieze: 'panels', supports: 'consoles', supportsAt: 'ends', scale: 1.6 }, '6184ca3960b0'],
    oculi: [{ frieze: 'oculi', supports: 'dentils' }, '89d3660c684b'],
    ped: [{ frieze: 'plain', centre: 'pediment', centreLight: 'oculus', centreRiseM: 1.2 }, '0d5b495bdc92'],
    seg: [{ frieze: 'plain', centre: 'segmental', centreShare: 0.4, centreRiseM: 1.5 }, '820f817523b2'],
    attic: [{ supports: 'consoles', centre: 'attic', centreCap: 'segmental', centreLight: 'round', centreRiseM: 1.6 }, 'af15e7727404'],
    atticPed: [{ centre: 'attic', centreCap: 'pediment', centreLight: 'square' }, '36e7f6f3cdd0'],
    bal: [{ centre: 'balustrade', scale: 1.4 }, 'afcbccee913a'],
  };
  for (const [k, [d, hash]] of Object.entries(BASE)) assert.equal(h12(run(d)), hash, k);
});

test('row-cornice with a profile: the measured bands from the top down, the counted modillions, dentils; deterministic', () => {
  const dress: RowCorniceDress = { profile: { depthM: 4, ...H10 } };
  const tris = run(dress);
  assert.deepEqual(run(dress), tris);
  assert.ok(Math.max(...zs(tris)) <= 16 + 1e-6 && Math.min(...zs(tris)) >= 12 - 0.07, 'inside the 4 m zone (the architrave shadow 6 cm under it)');
  const stock = run({ supports: 'modillions', frieze: 'plain', scale: 1.6 });
  assert.notEqual(h12(tris), h12(stock));
  // More pieces than the stock: 19 modillions plus 77 dentils (10 m at 0.13 m).
  assert.ok(tris.length > stock.length * 2, `${tris.length} vs ${stock.length}`);
  // A brick attic frieze with a light on the centre (42): glass, and no paint over the frieze band.
  const att = run({ profile: { depthM: 3, corona: 0.25, bed: 0.1, frieze: 0.65, friezeBody: 'wall', friezeLights: 'centre' } });
  assert.ok(att.some(t => t.hex === ROW_DOORCASE.glass));
});

test('cornice centre: a stucco attic in the paint with scrolls and a stepped cap (8, 90); an arched centre over brick (42)', () => {
  const plain = run({ centre: 'attic', centreRiseM: 2, centreShare: 0.47 });
  const stucco = run({ centre: 'attic', centreRiseM: 2, centreShare: 0.47, centreBody: 'paint' });
  assert.ok(plain.some(t => t.hex === '#6b4a3c') && !stucco.some(t => t.hex === '#6b4a3c'), 'the attic body leaves the wall colour');
  const stepped = run({ centre: 'attic', centreRiseM: 2, centreShare: 0.47, centreBody: 'paint', centreCap: 'stepped' });
  assert.ok(Math.max(...zs(stepped)) > 17.9 && Math.max(...zs(stepped)) <= 18.01, 'the stepped cap tops out at the measured rise');
  const scrolls = run({ centre: 'attic', centreRiseM: 1.3, centreShare: 0.46, centreBody: 'paint', centreShoulders: 'scrolls' });
  const xs = (ts: Tri[]) => ts.filter(t => t.p.some(p => p[2] > 16.05)).flatMap(t => t.p.map(p => p[0]));
  assert.ok(Math.min(...xs(scrolls)) < Math.min(...xs(run({ centre: 'attic', centreRiseM: 1.3, centreShare: 0.46, centreBody: 'paint' }))) - 0.1, 'the scrolls stand out either side');
  const steps = run({ centre: 'attic', centreRiseM: 1.9, centreShare: 0.43, centreShoulders: 'steps' });
  assert.ok(steps.filter(t => t.hex === '#6b4a3c').length > plain.filter(t => t.hex === '#6b4a3c').length, 'brick shoulders');
  // The arc: its band bent up to the measured rise over a brick tympanum; the stock segmental cap has no wall in it.
  const arc = run({ centre: 'segmental', centreRiseM: 0.6, centreShare: 0.37, centreArc: { tympanum: 'wall', springM: 0.67 } });
  const seg = run({ centre: 'segmental', centreRiseM: 0.6, centreShare: 0.37 });
  assert.ok(arc.some(t => t.hex === '#6b4a3c') && !seg.some(t => t.hex === '#6b4a3c'));
  assert.ok(Math.max(...zs(arc)) > 16.1 && Math.max(...zs(arc)) < 16.6, 'its top: the spring 0.67 m down, 0.6 m rise, the band over it');
});
