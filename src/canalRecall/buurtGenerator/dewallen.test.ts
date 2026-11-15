import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buurtKitOf } from './kit/frontKit.ts';
import { buurtRoofKitFor, kitDrawsFront } from './kit/roofKit.ts';
import { stage, storeysFor, type DeWallenAudit } from '../../../scripts/buurt-generators/dewallen-window-fronts.ts';

const DIR = 'data/buurt-generators/dewallen';

test('De Wallen (round 17): every audited window front is staged and draws its window front from the pavement', () => {
  const audit = JSON.parse(fs.readFileSync(`${DIR}/audit.json`, 'utf8')) as DeWallenAudit;
  const staged = JSON.parse(fs.readFileSync(`${DIR}/row-front.json`, 'utf8')) as { held: unknown[]; records: Array<Record<string, any>> };
  const c = audit.counts;
  assert.equal(c.tagged, c.windowRows + c.readNotDrawn + c.closedOrNotWindow + c.noView, 'every tagged pand has one verdict');
  assert.equal(c.windowRows, audit.fronts.length);
  assert.ok(audit.fronts.every(f => f.crown), 'every front has its crown read');
  // The staged copy is what the script makes from the audit (no hand edits); gabled houses are held, not flattened.
  const want = stage(audit);
  assert.deepEqual(staged.records, want.records);
  assert.deepEqual(staged.held, want.held);
  assert.equal(staged.records.length + staged.held.length, audit.fronts.length);
  assert.equal(staged.records.length, audit.fronts.filter(f => f.crown !== 'gable').length);
  for (const r of staged.records) {
    const kit = buurtKitOf(r.buurtKit);
    assert.ok(kit?.windowFronts?.length === 1, `${r.pandId}: one window front`);
    const roof = buurtRoofKitFor(kit!, r.topM, r.storeys, 3.4)!;
    assert.ok(roof && kitDrawsFront(roof) && roof.footZ === -r.topM, `${r.pandId}: drawn from the pavement`);
  }
  assert.equal(storeysFor(9.33), 3);
  assert.equal(storeysFor(2.9), 2, 'never fewer than two (a lower annex is held in the audit)');
});
