/** Belt review stage 1 facade spans and split houses: parsing old picks, expanding the face, divider rules, crop spans. */
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { dividerFits, expandDescription, expandFace, houseLabels, housesFromDividers } from './houses.ts';
import { cropSpanPx, parseCandidates, parsePicks } from './logic.ts';
import type { FaceFile } from './types.ts';

const P = '0363100012169272', Q = '0363100012169273';
const face: FaceFile = { faceId: 'f', street: 'Herengracht', side: 'even', pands: [{ pandId: P, address: 'Herengracht 50–52', order: 0, numbers: [50, 52] }, { pandId: Q, address: 'Herengracht 54', order: 1 }] };

it('parsePicks reads an older picks.json without facade spans or houses unchanged', () => {
  const old = { schemaVersion: 1, faceId: 'f', revision: 3, updatedAt: '2026-11-20T09:00:00Z', picks: { [P]: { candidateId: 'a', autoPick: 'a', revision: 1, at: 'x', by: 'david' }, [Q]: { candidateId: null, autoPick: 'b', revision: 2, at: 'x', by: 'david' } } };
  const p = parsePicks(old, 'f');
  assert.deepEqual(p, old);
  assert.deepEqual(parsePicks(null, 'f').picks, {});
});
it('parsePicks drops a malformed span or split instead of failing', () => {
  const p = parsePicks({ revision: 1, picks: { [P]: { candidateId: 'a', autoPick: 'a', facadeSpanPx: [5, 1], facadeSpanM: [0, 1], houses: [{ fromM: 0, toM: 3 }] }, [Q]: { candidateId: 7 } } }, 'f');
  assert.equal(p.picks[P].facadeSpanPx, undefined); assert.equal(p.picks[P].houses, undefined); assert.equal(p.picks[Q], undefined);
});
it('parseCandidates maps lane B fields (flags object, ppm, width) and keeps pandSpanPx', () => {
  const c = parseCandidates({ pands: [{ pandId: P, autoPick: 'a', candidates: [{ id: 'a', file: 'a.jpg', year: 2021, flags: { foliage: 0.1 }, reasons: ['oblique'], ppm: 50, width: 323, height: 900, pano: { id: 'x', date: '2021-01-01' }, pandSpanPx: [75, 248], marginM: 1.5 }] }] })!;
  const k = c.pands[0].candidates[0];
  assert.deepEqual(k.flags, ['oblique']); assert.equal(k.pxPerM, 50); assert.equal(k.widthPx, 323); assert.deepEqual(k.pandSpanPx, [75, 248]); assert.equal(k.month, null);
});
it('cropSpanPx: the facade span from metres, else the BAG span, else the whole image', () => {
  const c = { pandSpanPx: [75, 248] as [number, number], pxPerM: 50 };
  assert.deepEqual(cropSpanPx(c, { facadeSpanM: [-0.5, 4.5] }), [50, 300]);
  assert.deepEqual(cropSpanPx(c, null), [75, 248]);
  assert.equal(cropSpanPx({ pxPerM: 50 }, null), null);
});
it('expandFace splits a pand into houses labelled by its numbers; the description follows', () => {
  const picks = parsePicks({ revision: 1, picks: { [P]: { candidateId: 'a', autoPick: 'a', revision: 1, houses: [{ fromM: 0, toM: 6, label: '50' }, { fromM: 6, toM: 9.5, label: '52' }] } } }, 'f');
  const hf = expandFace(face, picks);
  assert.deepEqual(hf.pands.map(p => [p.pandId, p.address, p.order, p.widthM]), [[`${P}#1`, 'Herengracht 50', 0, 6], [`${P}#2`, 'Herengracht 52', 1, 3.5], [Q, 'Herengracht 54', 2, undefined]]);
  const d = expandDescription({ pands: [{ pandId: P, fields: { storeys: { value: 4, source: 'own-read', confidence: 1, ref: '' } }, group: { unit: { id: 'du:1', source: 'ordekaart' } } }] }, hf)!;
  assert.deepEqual(d.pands.map(p => [p.pandId, p.group?.unit?.id]), [[`${P}#1`, 'du:1'], [`${P}#2`, 'du:1']]);
});
it('labels, dividers', () => {
  assert.deepEqual(houseLabels(face.pands[0], 2), ['50', '52']);
  assert.deepEqual(houseLabels(face.pands[0], 3), [undefined, undefined, undefined]);
  assert.deepEqual(housesFromDividers([-0.5, 9], [6], ['50', undefined]), [{ fromM: -0.5, toM: 6, label: '50' }, { fromM: 6, toM: 9 }]);
  assert.equal(dividerFits([0, 9], [6], 5.5), false); assert.equal(dividerFits([0, 9], [], 0.5), false); assert.equal(dividerFits([0, 9], [6], 3), true);
});

import { markGaps, validateMark } from './logic.ts';
import { markState, reviewOrder } from './stages.ts';
import { initialDocs, type FaceBundle } from './types.ts';

it('marks: validate, history across passes, gaps against the current hashes', () => {
  const m1 = validateMark(face, P, { mark: 'wrong', note: 'roof', hash: 'aaaaaaaa' }, undefined, 0, 't0');
  const m2 = validateMark(face, P, { mark: 'good', hash: 'bbbbbbbb' }, { ...m1, revision: 1, at: 't0', by: 'david' }, 1, 't1');
  assert.deepEqual(m2.history.map(h => [h.pass, h.mark]), [[0, 'wrong'], [1, 'good']]);
  assert.throws(() => validateMark(face, 'x', { mark: 'good' }, undefined, 0, 't'));
  const marks = { ...initialDocs.marks('f'), marks: { [P]: { ...m2, revision: 2, at: 't1', by: 'david' as const } } };
  const r = { face, picks: initialDocs.picks('f'), pins: initialDocs.pins('f'), marks };
  assert.deepEqual(markGaps({ ...r, hashes: { [P]: 'bbbbbbbb', [Q]: 'c' } }), { unmarked: [Q], changed: [] });
  assert.deepEqual(markGaps({ ...r, hashes: { [P]: 'cccccccc', [Q]: 'c' } }), { unmarked: [Q], changed: [P] });
});
it('review order: worst first by likeness, else by weak fields; markState sees a changed render', () => {
  const b = { face, marks: { ...initialDocs.marks('f'), marks: { [P]: { mark: 'good', hash: 'old', pass: 0, history: [], revision: 1, at: '', by: 'david' } } } } as unknown as FaceBundle;
  const der = (a: object, z: object) => ({ ppm: 50, pands: { [P]: { hash: 'new', ...a }, [Q]: { hash: 'q', ...z } } }) as never;
  assert.deepEqual(reviewOrder(b, der({ weak: ['a'] }, { weak: ['a', 'b', 'c'] }), 'worst'), [Q, P]);
  assert.deepEqual(reviewOrder(b, der({ weak: [], likeness: 0.2 }, { weak: ['a'], likeness: 0.9 }), 'worst'), [P, Q]);
  assert.deepEqual(reviewOrder(b, null, 'street'), [P, Q]);
  assert.equal(markState(b, der({}, {}), P), 'changed');
  assert.equal(markState(b, null, P), 'good');
  assert.equal(markState(b, null, Q), null);
});
