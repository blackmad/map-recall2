// HouseSpec record, merge and recipe route (house line H1, docs/house-line.md §1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOURCE_STRENGTH, isStrongerSource } from '../facade/evidence.ts';
import { validateIntent, type CanalHouseIntent } from '../buildingRecipe/intent.ts';
import { emptySpec, frontBays, provenanceOf, specFields, specProblems, specStrength, validateSpec, type HouseSpec, type Prov } from './spec.ts';
import { fieldSources, resolveSpecs } from './resolve.ts';
import { toRecipe, withRoute } from './toRecipe.ts';
import { fromRecipeIntent } from './adapters.ts';

const P = '0363100012182857';
const prov = (source: Prov['source'], confidence = 0.8, at: string | null = '2024-01-01', ref: string = source): Prov => ({ source, confidence, ref, at });
const part = (fields: Record<string, unknown>, p: Prov): HouseSpec => {
  const s = emptySpec(P);
  s.design = {};
  for (const [path, v] of Object.entries(fields)) {
    const [h, a, b] = path.split('/');
    if (h === 'fronts') { (s.design.fronts ??= []); while (s.design.fronts.length <= Number(a)) s.design.fronts.push({}); (s.design.fronts[Number(a)] as any)[b] = v; }
    else if (h === 'facts') { s.facts ??= {}; (s.facts as any)[a] = v; }
    else { ((s.design as any)[h] ??= {})[a] = v; }
  }
  s.provenance[''] = p;
  return s;
};

test('vision-judge sits between pdok-ortho and bag; author ranks as reviewed', () => {
  const i = (s: string) => SOURCE_STRENGTH.indexOf(s as any);
  assert.equal(i('vision-judge'), i('pdok-ortho') + 1);
  assert.equal(i('bag'), i('vision-judge') + 1);
  assert.ok(isStrongerSource('bag', 'vision-judge') && isStrongerSource('vision-judge', 'pdok-ortho'));
  assert.equal(specStrength('author'), specStrength('reviewed'));
  // The relative order of the sources that existed before is unchanged.
  assert.deepEqual(SOURCE_STRENGTH.filter(s => s !== 'vision-judge'), ['default', 'osm', '3dbag', 'ahn', 'pdok-ortho', 'bag', 'monument-text', 'streetlevel-measured', 'reviewed']);
});

test('field paths: one key of a front, the roof, the palette, facts; ancestors cover descendants', () => {
  const s = part({ 'fronts/0/gable': 'step', 'fronts/1/bays': [2, 3], 'palette/brick': '#7a4a3a', 'roof/material': 'slate', 'facts/facadeYear': 1605 }, prov('monument-text'));
  assert.deepEqual(specFields(s).map(([p]) => p), ['fronts/0/gable', 'fronts/1/bays', 'roof/material', 'palette/brick', 'facts/facadeYear']);
  assert.equal(provenanceOf(s, 'fronts/1/bays')?.source, 'monument-text');
  s.provenance['fronts/0'] = prov('reviewed');
  assert.equal(provenanceOf(s, 'fronts/0/gable')?.source, 'reviewed');
  assert.equal(provenanceOf(s, 'fronts/1/bays')?.source, 'monument-text');
  assert.equal(frontBays({ bays: [2, 3, 3] }), 3);
  assert.equal(frontBays({ bays: 4, axisGrid: 5 }), 5);
  assert.equal(frontBays({}), undefined);
});

test('resolveSpecs: strongest source per field, then confidence, then newer evidence; nothing invented', () => {
  const register = part({ 'fronts/0/gable': 'bell', 'facts/facadeYear': 1750, 'palette/wallMaterial': 'stucco' }, prov('monument-text', 0.8, null, 'rce:1'));
  const jev = part({ 'fronts/0/gable': 'neck', 'fronts/0/bays': 3, 'palette/wallMaterial': 'brick' }, prov('vision-judge', 0.95, '2023-05-01', 'crop'));
  const strip = part({ 'fronts/0/gable': 'step', 'fronts/0/storeys': 4 }, prov('streetlevel-measured', 0.6, '2022-01-01', 'strip'));
  const out = resolveSpecs([register, jev, strip]);
  assert.equal(out.design.fronts?.[0]?.gable, 'step', 'street-level measured beats the register and the judge');
  assert.equal(out.design.fronts?.[0]?.bays, 3, 'only the judge states bays');
  assert.equal(out.design.palette?.wallMaterial, 'stucco', 'monument-text outranks vision-judge');
  assert.equal(out.facts?.facadeYear, 1750);
  assert.equal(out.design.roof, undefined, 'no part states a roof: none invented');
  assert.deepEqual(fieldSources(out), { 'fronts/0/gable': 'streetlevel-measured', 'fronts/0/bays': 'vision-judge', 'fronts/0/storeys': 'streetlevel-measured', 'palette/wallMaterial': 'monument-text', 'facts/facadeYear': 'monument-text' });
  // Same source: higher confidence wins; then the newer evidence; a full tie keeps the first part.
  const a = part({ 'fronts/0/bays': 2 }, prov('vision-judge', 0.7, '2024-01-01', 'a'));
  const b = part({ 'fronts/0/bays': 4 }, prov('vision-judge', 0.9, '2020-01-01', 'b'));
  const c = part({ 'fronts/0/bays': 5 }, prov('vision-judge', 0.9, '2021-01-01', 'c'));
  assert.equal(resolveSpecs([a, b]).design.fronts?.[0]?.bays, 4);
  assert.equal(resolveSpecs([b, c]).design.fronts?.[0]?.bays, 5);
  assert.equal(resolveSpecs([c, { ...c, design: { fronts: [{ bays: 6 }] } }]).design.fronts?.[0]?.bays, 5);
  // author = reviewed: a later author edit with the same confidence and a newer date wins over a review.
  const rev = part({ 'fronts/0/gable': 'bell' }, prov('reviewed', 1, '2024-01-01'));
  const auth = part({ 'fronts/0/gable': 'neck' }, prov('author', 1, '2025-01-01'));
  assert.equal(resolveSpecs([rev, auth]).design.fronts?.[0]?.gable, 'neck');
  assert.throws(() => resolveSpecs([a, { ...a, pandId: '0363100012000000' }]), /parts of/);
  // Each output field carries its own receipt and the output validates.
  assert.equal(out.provenance['fronts/0/bays'].ref, 'crop');
  assert.doesNotThrow(() => validateSpec(out));
  // schemaLimits are the union of the parts'.
  const gx = { component: 'gable', what: 'x' }, oy = { component: 'oriel', what: 'y' };
  assert.deepEqual(resolveSpecs([{ ...a, schemaLimits: [gx] }, { ...b, schemaLimits: [{ ...gx }, oy] }]).schemaLimits, [gx, oy]);
});

test('validateSpec: receipts, enums and limits', () => {
  const s = part({ 'fronts/0/gable': 'trap' }, prov('monument-text'));
  assert.match(specProblems(s).join('\n'), /fronts\/0\/gable: "trap" not in/);
  const bare = part({ 'fronts/0/gable': 'step' }, prov('monument-text'));
  bare.provenance = {};
  assert.match(specProblems(bare).join('\n'), /no provenance covers/);
  assert.match(specProblems({ ...bare, pandId: 'NL.IMBAG.Pand.1' }).join('\n'), /16 digits/);
  assert.match(specProblems({ ...part({}, prov('osm')), schemaLimits: ['gable: a string' as any] }).join('\n'), /must be \{component, what\}/);
  assert.match(specProblems({ ...part({}, prov('osm')), schemaLimits: [{ component: '', what: 'x' }] }).join('\n'), /must be \{component, what\}/);
  assert.match(specProblems(part({ 'palette/brick': 'mauve' }, prov('osm'))).join('\n'), /palette\/brick/);
});

test('toRecipe round-trips a complete spec to an intent validateIntent accepts', () => {
  const intent = validateIntent(JSON.parse(readFileSync('scripts/building-recipes/houses/bilder-079721/intent.json', 'utf8'))) as CanalHouseIntent;
  const spec = fromRecipeIntent(intent)!;
  assert.equal(spec.provenance[''].source, 'streetlevel-measured');
  const back = toRecipe(spec)!;
  assert.ok(back, 'a complete spec is recipe-eligible');
  assert.doesNotThrow(() => validateIntent(back));
  const { schemaVersion: _a, kind: _b, id: _c, pandId: _d, address: _e, sources: _f, ...design } = intent;
  const { schemaVersion: _g, kind: _h, id: _i, pandId: _j, address: _k, sources, ...again } = back;
  assert.deepEqual(again, design, 'the design survives the round trip');
  assert.equal(back.pandId, intent.pandId);
  assert.equal(sources[0].kind, 'street-panorama');
  assert.equal(sources[0].capturedAt, intent.sources[0].capturedAt);
  assert.equal(withRoute(spec).route, 'recipe');
  // Incomplete: a register-only spec is the generic route.
  assert.equal(withRoute(part({ 'fronts/0/gable': 'step' }, prov('monument-text', 0.8, null, 'rce:3856'))).route, 'generic');
});
