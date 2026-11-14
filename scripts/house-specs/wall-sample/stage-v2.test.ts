// Wall sample v2 in the D1 staging (stage.ts stageOne): off (WALL_SAMPLE unset or 1) stages exactly what it did before; on,
// the v2 brick and its receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stageOne, wallBrickFromSample } from '../describer-d1/stage.ts';
import { resetWallSampleMode, isWallSampleFact } from '../../../src/canalRecall/houseSpec/wallSample.ts';
import { specProblems } from '../../../src/canalRecall/houseSpec/spec.ts';

const answer = JSON.parse(fs.readFileSync(new URL('../../../artifacts/describer-d1/answers-ah07/0363100012165003.json', import.meta.url), 'utf8'));
const ref = { white: 0.94, p80: 0.2, scene: 0.05, n: 700 };
const withEnv = <T>(v: string | undefined, f: () => T): T => {
  const was = process.env.WALL_SAMPLE;
  if (v === undefined) delete process.env.WALL_SAMPLE; else process.env.WALL_SAMPLE = v;
  resetWallSampleMode();
  try { return f(); } finally { if (was === undefined) delete process.env.WALL_SAMPLE; else process.env.WALL_SAMPLE = was; resetWallSampleMode(); }
};

test('off: unset and WALL_SAMPLE=1 stage the same spec, with the legacy brick and no receipt', () => {
  const a = withEnv(undefined, () => stageOne(answer, '#463a34', '2026-11-14', null, ref));
  const b = withEnv('1', () => stageOne(answer, '#463a34', '2026-11-14', null, ref, [{ hex: '#5d5249', refs: null }]));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.design.palette?.brick, wallBrickFromSample('#463a34').brick);
  assert.equal(a.facts?.wallSample, undefined);
});

test('on: the v2 brick with its receipt, valid, lighter than the legacy floor brick', () => {
  const s = withEnv('2', () => stageOne(answer, '#463a34', '2026-11-14', null, ref));
  assert.ok(isWallSampleFact(s.facts?.wallSample));
  assert.equal(s.design.palette?.brick, s.facts!.wallSample!.brick);
  assert.equal(s.facts!.wallSample!.raw, '#463a34');
  assert.equal(s.facts?.wallExposure, undefined);
  assert.deepEqual(specProblems(s), []);
  assert.notEqual(s.design.palette?.brick, wallBrickFromSample('#463a34').brick);
});
