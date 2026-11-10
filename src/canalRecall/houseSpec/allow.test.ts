import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, pandIdsIn, parseAllow, partitionChanged } from './allow.ts';

test('parseAllow: both spellings, repeatable, absent is null, empty is an empty list', () => {
  assert.equal(parseAllow(['--write']), null);
  assert.deepEqual([...parseAllow(['--allow=a,b', '--allow', 'c,,d ', '--x'])!], ['a', 'b', 'c', 'd']);
  assert.deepEqual([...parseAllow(['--allow='])!], []);
  assert.deepEqual([...parseAllow(['--allow'])!], []);
});

test('isAllowed: exact key or a whole word of it, never a substring', () => {
  const allow = new Set(['nassaukade-506', '0363100012164843']);
  assert.ok(isAllowed('nassaukade-506', allow));
  assert.ok(isAllowed('nassau-145-152 0363100012164843 (survey)', allow));
  assert.ok(!isAllowed('nassaukade-5061', allow));
  assert.ok(!isAllowed('x-nassaukade-506', allow));
});

test('partitionChanged: no allow-list means nothing may change', () => {
  assert.deepEqual(partitionChanged(['a', 'b'], new Set(['a'])), { allowed: ['a'], outside: ['b'] });
  assert.deepEqual(partitionChanged(['a'], null), { allowed: [], outside: ['a'] });
  assert.deepEqual(partitionChanged(['a'], new Set()), { allowed: [], outside: ['a'] });
});

test('pandIdsIn lists each pand once', () => {
  assert.deepEqual(pandIdsIn(['f 0363100012164843 (x)', 'g 0363100012164843', 'h']), ['0363100012164843']);
});
