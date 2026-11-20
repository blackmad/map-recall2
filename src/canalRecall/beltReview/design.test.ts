/** Belt review render adapter: description + edits + links -> the drawn design (links through HouseSpec basedOn). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fieldsToDesign, pandDesign } from './design.ts';
import { initialDocs, type DescriptionFile, type FaceFile } from './types.ts';

const A = '0363100012174415', B = '0363100012174416', C = '0363100012174417';
const face: FaceFile = { faceId: 't', street: 'Herengracht', side: 'even', pands: [A, B, C].map((pandId, order) => ({ pandId, address: `H ${order}`, order })) };
const f = (value: unknown, source = 'own-read') => ({ value, source, confidence: 0.6, ref: 'test' });
const description: DescriptionFile = { pands: [
  { pandId: A, fields: { storeys: f(4), bays: f(3), crown: f('bell'), wallColour: f('red'), eavesM: f(14, 'survey') } },
  { pandId: B, fields: { storeys: f(5), bays: f(2), crown: f('step'), eavesM: f(12, 'survey') } },
  { pandId: C, fields: { storeys: f(3), crown: f('neck') } },
] };
const edits = () => initialDocs.edits('t'), grouping = () => initialDocs.grouping('t');

describe('fieldsToDesign', () => {
  it('maps fields onto the HouseSpec vocabulary', () => {
    const d = fieldsToDesign({ storeys: { value: 4, source: 'x' }, crown: { value: 'bell', source: 'x' }, heads: { value: 'segmental', source: 'x' }, wallColour: { value: 'red', source: 'x' }, whiteFrames: { value: true, source: 'x' }, door: { value: { bay: 1, surround: true }, source: 'x' }, ground: { value: 'shopfront', source: 'x' } });
    assert.equal(d.fronts[0].gable, 'bell'); assert.deepEqual(d.fronts[0].windowHead, { kind: 'segmental' });
    assert.equal(d.fronts[0].doorBay, 1); assert.equal(d.fronts[0].readDoorSurround, true); assert.deepEqual(d.fronts[0].shopfront, {});
    assert.match(String(d.palette.brick), /^#[0-9a-f]{6}$/); assert.ok(d.palette.frame);
  });
});

describe('pandDesign', () => {
  it('an edit wins over the description', () => {
    const e = edits(); e.edits[B] = { revision: 1, at: '', by: 'david', fields: { crown: { value: 'neck' } } };
    const d = pandDesign(face, B, description, e, grouping());
    assert.equal(d.design.fronts[0].gable, 'neck'); assert.equal(d.fields.crown?.source, 'edit');
  });
  it('sameAs draws the target, keeping its own edits and eaves', () => {
    const g = grouping(); g.links.push({ pandId: B, kind: 'sameAs', target: A, by: 'david', at: '' });
    const e = edits(); e.edits[B] = { revision: 1, at: '', by: 'david', fields: { bays: { value: 4 } } };
    const d = pandDesign(face, B, description, e, g);
    assert.equal(d.design.fronts[0].gable, 'bell'); assert.equal(d.design.fronts[0].storeys, 4); assert.equal(d.design.fronts[0].bays, 4);
    assert.equal(d.fields.eavesM?.value, 12); assert.deepEqual(d.chain, [`sameAs:${A}`]);
  });
  it('basedOn applies the overrides over the target, through a chain', () => {
    const g = grouping();
    g.links.push({ pandId: C, kind: 'basedOn', target: B, overrides: { storeys: 6 }, by: 'david', at: '' });
    g.links.push({ pandId: B, kind: 'sameAs', target: A, by: 'david', at: '' });
    const d = pandDesign(face, C, description, edits(), g);
    assert.equal(d.design.fronts[0].gable, 'bell'); assert.equal(d.design.fronts[0].storeys, 6);
    assert.deepEqual(d.chain, [`basedOn:${B}`, `sameAs:${A}`]);
  });
  it('a cycle is refused and the pand draws its own fields', () => {
    const g = grouping();
    g.links.push({ pandId: A, kind: 'sameAs', target: B, by: 'david', at: '' }, { pandId: B, kind: 'sameAs', target: A, by: 'david', at: '' });
    const d = pandDesign(face, A, description, edits(), g);
    assert.ok(d.notes.some(n => /cycle/.test(n)), d.notes.join('; '));
    assert.equal(d.design.fronts[0].gable, 'bell');
  });
});
