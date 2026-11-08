import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideToast, newestNote, noteKey, parseSeen } from './whatsNewToast';

const notes = [
  { date: '2026-11-09', title: 'The ground no longer depends on loading order' },
  { date: '2026-11-08', title: 'Older note' },
];

test('a returning rider sees the newest note once', () => {
  const first = decideToast({ notes, seen: null, returning: true, build: 'abc123' });
  assert.equal(first.show, true);
  assert.deepEqual(first.record, { note: noteKey(notes[0]), build: 'abc123' });
  const again = decideToast({ notes, seen: first.record, returning: true, build: 'def456' });
  assert.equal(again.show, false, 'a new build with no new note stays quiet');
});

test('a new note after the one seen shows again', () => {
  const seen = { note: noteKey(notes[0]) };
  const next = decideToast({ notes: [{ date: '2026-11-10', title: 'Tours are back' }, ...notes], seen, returning: true });
  assert.equal(next.show, true);
  assert.equal(next.show && next.note.title, 'Tours are back');
});

test('a first visit records the current note without showing it', () => {
  const decision = decideToast({ notes, seen: null, returning: false });
  assert.equal(decision.show, false);
  assert.deepEqual(decision.record, { note: noteKey(notes[0]), build: null });
});

test('no notes, or broken notes, never show', () => {
  assert.deepEqual(decideToast({ notes: null, seen: null, returning: true }), { show: false, record: null });
  assert.equal(newestNote([{ date: '2026-11-09', title: '  ' }] as never), null);
});

test('parseSeen tolerates junk', () => {
  assert.equal(parseSeen('not json'), null);
  assert.equal(parseSeen('{"x":1}'), null);
  assert.deepEqual(parseSeen('{"note":"a|b","build":"x"}'), { note: 'a|b', build: 'x' });
});
