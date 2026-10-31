import test from 'node:test';
import assert from 'node:assert/strict';
import { hashStamp, stampHtml } from './stamp-canal-assets.ts';

const files: Record<string, string> = { 'js/a.js': 'alert(1)', 'css/x.css': 'body{}' };
const read = (p: string) => (p in files ? new TextEncoder().encode(files[p]) : null);

test('every local ?v= stamp becomes the file hash; remote and rooted urls are left alone', () => {
  const html = '<script src="js/a.js?v=20261030-old"></script><link href="css/x.css?v=1"><script src="https://unpkg.com/x.js?v=3"></script><script src="/quiz/y.js?v=4"></script>';
  const r = stampHtml(html, read);
  assert.equal(r.missing.length, 0);
  assert.deepEqual(r.changed.map(c => c.asset), ['js/a.js', 'css/x.css']);
  assert.ok(r.html.includes(`js/a.js?v=${hashStamp(new TextEncoder().encode('alert(1)'))}`));
  assert.ok(r.html.includes('https://unpkg.com/x.js?v=3') && r.html.includes('/quiz/y.js?v=4'));
});

test('an unchanged file keeps its stamp and is not reported', () => {
  const h = hashStamp(new TextEncoder().encode('alert(1)'));
  const r = stampHtml(`<script src="js/a.js?v=${h}"></script>`, read);
  assert.equal(r.changed.length, 0);
});

test('a missing asset is reported and its tag untouched', () => {
  const r = stampHtml('<script src="js/gone.js?v=1"></script>', read);
  assert.deepEqual(r.missing, ['js/gone.js']);
  assert.ok(r.html.includes('js/gone.js?v=1'));
});
