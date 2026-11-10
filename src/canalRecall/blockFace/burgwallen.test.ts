/**
 * Named regressions of the Burgwallen buurt lane (Kalverdriehoek AD08, BG-terrein e.o. AE05), 2026-11-10.
 *   node --import tsx --test src/canalRecall/blockFace/burgwallen.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {planStrip, withoutDays} from './strip.ts';

test('Kloveniersburgwal 48-50: a listed but unpublished capture day (2023-04-17, image 404) is never planned', () => {
  const span = {pandId: 'p', a: [0, 0] as [number, number], b: [6, 0] as [number, number], normal: [0, -1] as [number, number]};
  const panos = [
    {panoId: 'apr', timestamp: '2023-04-17T05:54:35Z', rd: [3, -6] as [number, number], record: {}},
    {panoId: 'jan', timestamp: '2025-01-08T10:00:00Z', rd: [3, -12] as [number, number], record: {}},
  ];
  assert.equal(planStrip([span], panos).date, '2025-01-08', 'both cover the span: the newest leaf-off day wins');
  // The April day wins once it is the only full cover; dropping it hands the plan to the published day.
  const only = [{...panos[0]}, {...panos[1], rd: [3, -80] as [number, number]}];
  assert.equal(planStrip([span], only).date, '2023-04-17');
  assert.equal(planStrip([span], withoutDays(only, ['2023-04-17'])).spans[0].panos.every(p => p.panoId === 'jan'), true);
  assert.equal(withoutDays(panos, []), panos, 'no days: the same array (byte-identical)');
});
