import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
for (const entry of [
  'facade-twin/measure-facades.ts', 'facade-twin/build-block.ts', 'build-facade-distillation-dataset.ts',
  'extract-facade-grammar-openrouter.ts', 'build-facade-block-demo.ts', 'measure-facade-grammar-agreement.ts',
]) {
  // A nonexistent alternate root must not turn quarantine into a path-name check.
  const result = spawnSync(process.execPath, ['--import', 'tsx', `scripts/${entry}`, '--root=/tmp/untrusted-copied-crops'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, entry);
  assert.match(result.stderr, /QUARANTINED_STREET_INPUT/, `${entry} stops before any input/model/output work`);
}
console.log('Legacy street measurement/export entrypoints reject unversioned inputs before side effects.');
