// Lane 1 steps a and b (rowFront.ts): flag off is the same object; a cornice record draws its wall to the measured top
// with a flat lid; a gabled record puts the planner's eaves on the measured foot. Named regressions: Haarlemmerdijk 16
// (0363100012167816, cornice top 11.6 m against 3DBAG 8.7 m) and Haarlemmerdijk 20 (0363100012167818, neck foot 10.2 m).
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetRowFront, setRowFrontRecords, withRowFront, type RowFrontRecord } from './rowFront.ts';

const ring = (w: number, d: number) => [[[0, 0], [w / 111320 / 0.61, 0], [w / 111320 / 0.61, d / 111320], [0, d / 111320], [0, 0]].map(([x, y]) => [4.888 + x, 52.381 + y])];
const feature = (id: string, height: number, extra: Record<string, unknown> = {}) => ({ type: 'Feature', properties: <Record<string, unknown>>{ id: `NL.IMBAG.Pand.${id}`, height, minHeight: 0, facade: 'canal', facadeStyle: 'canal', constructionYear: 1700, ...extra }, geometry: { type: 'Polygon', coordinates: ring(4, 14) } });
const rec = (pandId: string, eavesM: number, topM: number, family: RowFrontRecord['crown']['family']): RowFrontRecord => ({ pandId, eavesM, topM, crown: { family }, confidence: 0.85, sources: {} });

test('row front: flag off returns the same object', () => {
  const env = process.env.ROW_FRONT;
  try {
    delete process.env.ROW_FRONT; resetRowFront();
    setRowFrontRecords([rec('0363100012167816', 11.6, 11.6, 'cornice')]);
    const f = feature('0363100012167816', 10.29, { roofEavesHeightM: 8.7, roofPlanned: true, roofShape: 'gable', monumentGable: 'neck' });
    assert.equal(withRowFront(f), f);
  } finally { if (env === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = env; resetRowFront(); }
});

test('row front: Haarlemmerdijk 16 cornice front rises to its measured 11.6 m top, flat lid, register gable held', () => {
  const env = process.env.ROW_FRONT;
  try {
    process.env.ROW_FRONT = '1'; resetRowFront();
    setRowFrontRecords([rec('0363100012167816', 11.6, 11.6, 'cornice')]);
    const out = withRowFront(feature('0363100012167816', 10.29, { roofEavesHeightM: 8.7, roofPlanned: true, roofShape: 'gable', monumentGable: 'neck', specRecipe: { storeys: 3, eavesM: 7.5 } }));
    const p = out.properties;
    assert.equal(p.height, 11.6); assert.equal(p.roofEavesHeightM, 11.6); assert.equal(p.roofPlanned, false); assert.equal(p.roofShape, 'flat');
    assert.equal(p.monumentGable, undefined); assert.equal(p.historicGable, 'neck');
    assert.deepEqual(p.specRecipe, { storeys: 3, eavesM: 11.6, corniceCrown: true });
    // A pand without a record is untouched.
    const other = feature('0363100012000001', 10);
    assert.equal(withRowFront(other), other);
  } finally { if (env === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = env; resetRowFront(); }
});

test('row front: Haarlemmerdijk 20 neck front keeps its gable with the saddle eaves on the measured 10.2 m foot', () => {
  const env = process.env.ROW_FRONT;
  try {
    process.env.ROW_FRONT = '1'; resetRowFront();
    setRowFrontRecords([rec('0363100012167818', 10.2, 11.4, 'neck')]);
    const p = withRowFront(feature('0363100012167818', 9.29, { roofEavesHeightM: 7.7, roofPlanned: true, roofShape: 'gable' })).properties;
    assert.equal(p.monumentGable, 'neck'); assert.equal(p.roofPlanned, true);
    assert.ok(Math.abs(Number(p.roofEavesHeightM) - 10.2) < 0.02, `eaves ${p.roofEavesHeightM}`);
    assert.ok(Number(p.height) > 10.2);
  } finally { if (env === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = env; resetRowFront(); }
});
