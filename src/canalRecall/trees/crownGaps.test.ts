import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectCrownGaps, patchCrownGaps } from './crownGaps.ts';

const VS = 'void main() {\n#include <begin_vertex>\n}';
const FS = 'void main() {\n#include <clipping_planes_fragment>\n#include <color_fragment>\n}';

test('crown gaps cut fragments by lobe-space noise and shade the inside', () => {
  const s = injectCrownGaps(VS, FS);
  assert.match(s.vertexShader, /vCrownGapP = position \+ instanceMatrix\[3\]\.xyz/);
  assert.match(s.fragmentShader, /discard;/);
  assert.match(s.fragmentShader, /!gl_FrontFacing/);
  assert.ok(s.fragmentShader.indexOf('discard') > s.fragmentShader.indexOf('#include <clipping_planes_fragment>'));
});

test('crown gaps leave shaders without the chunks untouched', () => {
  assert.deepEqual(injectCrownGaps('void main(){}', FS), { vertexShader: 'void main(){}', fragmentShader: FS });
});

test('patchCrownGaps chains an earlier onBeforeCompile and cache key, once', () => {
  const calls: string[] = [];
  const m: any = { userData: {}, side: 0, needsUpdate: false, onBeforeCompile: () => calls.push('fade'), customProgramCacheKey() { return 'fade'; } };
  patchCrownGaps(m, 2); patchCrownGaps(m, 2);
  const shader = { vertexShader: VS, fragmentShader: FS };
  m.onBeforeCompile(shader);
  assert.deepEqual(calls, ['fade']);
  assert.equal(m.side, 2);
  assert.equal(m.customProgramCacheKey(), 'fade|crownGaps');
  assert.match(shader.fragmentShader, /discard;/);
});
