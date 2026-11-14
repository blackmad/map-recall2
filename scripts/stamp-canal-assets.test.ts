import test from 'node:test';
import assert from 'node:assert/strict';
import { hashStamp, hashedName, plainName, stampHtml, stampScript } from './stamp-canal-assets.ts';

const files: Record<string, string> = { 'js/a.js': 'alert(1)', 'css/x.css': 'body{}', 'js/own-ground-game.bundle.js': 'og()', 'js/w.bundle.js': 'w()' };
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

const h = (text: string) => hashStamp(new TextEncoder().encode(text));

test('immutable names keep the directory and the .bundle.js ending, and strip back to the plain name', () => {
  assert.equal(hashedName('js/engine.bundle.js', '0123456789'), 'js/engine-h0123456789.bundle.js');
  assert.equal(hashedName('js/game.js', '0123456789'), 'js/game-h0123456789.js');
  assert.equal(hashedName('css/x.css', '0123456789'), 'css/x-h0123456789.css');
  assert.equal(plainName('js/engine-h0123456789.bundle.js'), 'js/engine.bundle.js');
  assert.equal(plainName('js/engine.bundle.js'), 'js/engine.bundle.js');
  // workerPool.ts poolWorkerUrl finds the sibling worker from a renamed bundle's src
  assert.match('https://x/js/three-buildings-h0123456789.bundle.js?v=0123456789', /[\w-]+\.bundle\.js(\?.*)?$/);
});

test('--rename points js/ and css/ at their immutable copy, keeps ?v=, and a re-run changes nothing', () => {
  const html = '<script src="js/a.js?v=old"></script><link href="css/x.css?v=1"><img src="img/p.png?v=2">';
  const reads = { ...files, 'img/p.png': 'png' } as Record<string, string>;
  const readAll = (p: string) => (p in reads ? new TextEncoder().encode(reads[p]) : null);
  const r = stampHtml(html, readAll, { rename: true });
  assert.ok(r.html.includes(`js/a-h${h('alert(1)')}.js?v=${h('alert(1)')}`));
  assert.ok(r.html.includes(`css/x-h${h('body{}')}.css?v=${h('body{}')}`));
  assert.ok(r.html.includes(`img/p.png?v=${h('png')}`), 'outside js/ and css/ only the stamp moves');
  assert.deepEqual(r.copies.map(c => c.from), ['js/a.js', 'css/x.css']);
  const again = stampHtml(r.html, readAll, { rename: true });
  assert.equal(again.html, r.html);
  assert.equal(again.changed.length, 0);
  assert.equal(again.copies.length, 2, 'the copies are still asked for (written from the plain file)');
});

test('without --rename the page keeps plain names (the gate check and local pages)', () => {
  const r = stampHtml('<script src="js/a.js?v=old"></script>', read);
  assert.equal(r.copies.length, 0);
  assert.ok(r.html.includes(`js/a.js?v=${h('alert(1)')}`));
});

test('a stamped script URL built in JS is stamped (own-ground bundles in ownWorldView.ts / vector-map.js)', () => {
  const js = `const A='js/own-ground-game.bundle.js?v=20261030-rails-tunnels',B="js/w.bundle.js?v=x",C='js/a.js',D='js/gone.js?v=1';`;
  const r = stampScript(js, read);
  assert.ok(r.html.includes(`'js/own-ground-game.bundle.js?v=${h('og()')}'`));
  assert.ok(r.html.includes(`"js/w.bundle.js?v=${h('w()')}"`));
  assert.ok(r.html.includes(`C='js/a.js'`), 'an unstamped URL stays unstamped');
  assert.deepEqual(r.missing, ['js/gone.js']);
  const renamed = stampScript(js.replace(",D='js/gone.js?v=1'", ''), read, { rename: true });
  assert.ok(renamed.html.includes(`'js/own-ground-game-h${h('og()')}.bundle.js?v=${h('og()')}'`));
  assert.equal(stampScript(renamed.html, read, { rename: true }).html, renamed.html);
});

test('--rename also stamps and renames a js/ or css/ reference that had no stamp; without it such tags stay', () => {
  const html = '<script src="js/a.js"></script><link rel="stylesheet" href="css/x.css"><script src="js/gone.js"></script>';
  const r = stampHtml(html, read, { rename: true });
  assert.ok(r.html.includes(`src="js/a-h${h('alert(1)')}.js?v=${h('alert(1)')}"`));
  assert.ok(r.html.includes(`href="css/x-h${h('body{}')}.css?v=${h('body{}')}"`));
  assert.deepEqual(r.missing, [], 'an unstamped missing file is left alone, as before');
  assert.ok(r.html.includes('src="js/gone.js"'));
  assert.equal(stampHtml(r.html, read, { rename: true }).html, r.html);
  assert.equal(stampHtml(html, read).html, html);
});
