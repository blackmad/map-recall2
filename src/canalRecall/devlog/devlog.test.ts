import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryRest, entryTitle, issueUrl, toEntries, validateDevlog, type DevlogFile } from './data';
import { renderInline, renderMarkdown, safeHref } from './markdown';

test('markdown escapes HTML everywhere, including inside emphasis, code and link labels', () => {
  const html = renderMarkdown('**<b>x</b>** `<script>` [<img src=x onerror=1>](https://a.example) <i>raw</i>');
  assert.ok(!/<(b|script|img|i)[ >]/.test(html), html);
  assert.match(html, /<strong>&lt;b&gt;x&lt;\/b&gt;<\/strong>/);
  assert.match(html, /<code>&lt;script&gt;<\/code>/);
  assert.match(html, /<a href="https:\/\/a\.example" rel="noopener">&lt;img/);
});

test('only web links survive', () => {
  assert.equal(safeHref('javascript:alert(1)'), undefined);
  assert.equal(safeHref('data:text/html,x'), undefined);
  assert.equal(safeHref('//evil.example'), undefined);
  assert.equal(safeHref('https://github.com/x'), 'https://github.com/x');
  assert.ok(!renderInline('[click](javascript:alert(1))').includes('href'));
  assert.ok(!renderInline('[x](https://a.example" onmouseover="y)').includes('onmouseover="'));
});

test('bold, italics, code, bare URLs and issue references', () => {
  const html = renderInline('**bold** and *it* and `a_b_c` see https://x.example/a. Lane #72, not &#39;', { issueUrl });
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>it<\/em>/);
  assert.match(html, /<code>a_b_c<\/code>/);
  assert.match(html, /<a href="https:\/\/x\.example\/a" rel="noopener">https:\/\/x\.example\/a<\/a>\./);
  assert.match(html, /<a href="https:\/\/github\.com\/blackmad\/map-recall2\/issues\/72" rel="noopener">#72<\/a>/);
  assert.match(renderInline('**[link](https://a.example)**'), /<strong><a href="https:\/\/a\.example" rel="noopener">link<\/a><\/strong>/);
});

test('headings shift, nested lists nest, indented lines continue an item', () => {
  const html = renderMarkdown('## Status\n\n**Landed**\n- one\n  - nested a\n  - nested b\n- two\n  continued here\n\n1. first\n2. second\n\n---\n> quoted', { headingShift: 1 });
  assert.match(html, /^<h3>Status<\/h3>/);
  assert.match(html, /<p><strong>Landed<\/strong><\/p>/);
  assert.match(html, /<ul><li>one<ul><li>nested a<\/li><li>nested b<\/li><\/ul><\/li><li>two<span class="cont">continued here<\/span><\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<hr>/);
  assert.match(html, /<blockquote><p>quoted<\/p><\/blockquote>/);
});

test('comments become entries, newest first, maintainers only, empty ones dropped', () => {
  const c = (t: string, body: string, login = 'blackmad') => ({ created_at: t, updated_at: t, body, html_url: `https://github.com/blackmad/map-recall2/issues/68#issuecomment-${t.slice(11, 13)}`, user: { login } });
  const entries = toEntries([c('2026-10-25T07:00:00Z', 'a'), c('2026-10-25T09:00:00Z', 'b'), c('2026-10-25T08:00:00Z', '  '), c('2026-10-25T10:00:00Z', 'spam', 'someone')], new Set(['blackmad']));
  assert.deepEqual(entries.map(e => e.body), ['b', 'a']);
  const file: DevlogFile = { issue: 'https://github.com/blackmad/map-recall2/issues/68', title: 'Dev log', entries };
  assert.deepEqual(validateDevlog(file), []);
  assert.ok(validateDevlog({ ...file, entries: [...entries].reverse() }).some(e => /newest first/.test(e)));
  assert.ok(validateDevlog({ ...file, entries: [{ ...entries[0], url: 'javascript:1' }] }).length);
  assert.ok(validateDevlog({ issue: 'x', entries: 3 }).length >= 2);
});

test('an entry title comes from its first heading or bold line', () => {
  assert.equal(entryTitle('## 2026-10-25: status\n\nbody'), '2026-10-25: status');
  assert.equal(entryTitle('**Dev log, 25 Oct (round 7)**\n\n- x'), 'Dev log, 25 Oct (round 7)');
  assert.equal(entryTitle('Plain prose.'), '');
  assert.equal(entryRest('**T**\n\n- x'), '- x');
});
