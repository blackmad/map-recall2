import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deniedImages, notesInWindow, planNote, removedMatch, repoPath, splitPairs, splitRole, validateHints, validateNotes, validateRemoved,
  type ImageEntry, type Note, type RemovedImage,
} from './whatsNewImageHints.ts';

const note = (date: string, images: Array<ImageEntry | string> = [], title = `note ${date}`): Note => ({ date, title, images });

test('hints: valid shapes pass', () => {
  assert.deepEqual(validateHints({}), []);
  assert.deepEqual(validateHints({ kind: 'single' }), []);
  assert.deepEqual(validateHints({ kind: 'single', reason: 'after only' }), []);
  assert.deepEqual(validateHints({ kind: 'grid', reason: 'four sides' }), []);
  assert.deepEqual(validateHints({ panels: 3, gutter: 0, vertical: true, pair: [1, 2], target: [0, 0, 0.67, 0.68], frame: [0, 0.1, 1, 0.8] }), []);
  assert.deepEqual(validateHints({ after: 'whats-new/x-on.jpg' }), []);
});

test('hints: bad shapes are named', () => {
  const one = (g: unknown) => validateHints(g).join(' | ');
  assert.match(one({ kind: 'grid' }), /needs a reason/);
  assert.match(one({ kind: 'collage' }), /must be pair, single or grid/);
  assert.match(one({ panels: 1 }), /2\.\.12/);
  assert.match(one({ gutter: 4 }), /needs guard\.panels/);
  assert.match(one({ panels: 2, pair: [1, 2] }), /past guard\.panels/);
  assert.match(one({ pair: [1, 1] }), /two different/);
  assert.match(one({ target: [0.5, 0, 0.6, 1] }), /inside 0\.\.1/);
  assert.match(one({ target: [0, 0, 1] }), /\[x, y, w, h\]/);
  assert.match(one({ kind: 'single', target: [0, 0, 0.5, 0.5] }), /only applies to kind "pair"/);
  assert.match(one({ treshold: 0.01 }), /not a known hint/);
  assert.match(one({ reason: '' }), /non-empty/);
  assert.match(one('single'), /must be an object/);
});

test('notes: schema problems name the note and image', () => {
  const file = { notes: [note('2026-11-23', [{ src: 'whats-new/a.jpg', alt: 'a', guard: { kind: 'grid' } } as ImageEntry, { src: 'whats-new/b.jpg', colour: 'red' } as unknown as ImageEntry]), { date: '23 Nov', title: 't' }] };
  const p = validateNotes(file);
  assert.deepEqual(p.map(x => [x.note, x.src]), [['2026-11-23 "note 2026-11-23"', 'whats-new/a.jpg'], ['2026-11-23 "note 2026-11-23"', 'whats-new/b.jpg'], ['23 Nov "t"', null]]);
  assert.match(p[1].message, /unknown image field "colour"/);
  assert.deepEqual(validateNotes({ notes: [note('2026-11-01', ['https://example.org/legacy.jpg'])] }), [], 'legacy bare strings are tolerated');
  assert.equal(validateNotes({}).length, 1);
});

test('window: 14 days back from the newest note, inclusive, not the clock', () => {
  const notes = ['2026-11-23', '2026-11-22', '2026-11-10', '2026-11-09', '2026-10-01'].map(d => note(d));
  assert.deepEqual(notesInWindow(notes).map(n => n.date), ['2026-11-23', '2026-11-22', '2026-11-10']);
  assert.deepEqual(notesInWindow(notes, 1).map(n => n.date), ['2026-11-23']);
  assert.deepEqual(notesInWindow(notes, 14, '2026-11-20').map(n => n.date), ['2026-11-23', '2026-11-22']);
  // Order-independent: the newest date decides, wherever it sits.
  assert.deepEqual(notesInWindow([note('2026-11-09'), note('2026-11-23')]).map(n => n.date), ['2026-11-23']);
  assert.deepEqual(notesInWindow([]), []);
});

test('repo paths: relative srcs and the repo raw URL map to one path; other hosts do not', () => {
  assert.equal(repoPath('whats-new/a.jpg'), 'whats-new/a.jpg');
  assert.equal(repoPath('https://raw.githubusercontent.com/blackmad/map-recall2-screenshots/main/ui/x%20y.jpg'), 'ui/x y.jpg');
  assert.equal(repoPath('https://example.org/a.jpg'), null);
});

test('denylist: exact names and globs, over every note, raw URLs included', () => {
  const removed: RemovedImage[] = [
    { src: 'whats-new/2026-11-23-huis-fuld.jpg', date: '2026-11-23', why: 'underlay before' },
    { src: 'whats-new/2026-11-22-pc-hooftstraat-brick*', date: '2026-11-22', why: 'barely differs' },
  ];
  assert.equal(removedMatch('whats-new/2026-11-23-huis-fuld.jpg', removed)?.why, 'underlay before');
  assert.equal(removedMatch('whats-new/2026-11-23-huis-fuld-v2.jpg', removed), null, 'a re-shoot under a new name is allowed');
  assert.equal(removedMatch('whats-new/2026-11-22-pc-hooftstraat-brick-2.jpg', removed)?.date, '2026-11-22');
  assert.equal(removedMatch(`https://raw.githubusercontent.com/blackmad/map-recall2-screenshots/main/whats-new/2026-11-22-pc-hooftstraat-brick.jpg`, removed)?.date, '2026-11-22');
  const old = note('2025-01-01', [{ src: 'whats-new/2026-11-23-huis-fuld.jpg' }], 'old');
  const p = deniedImages([note('2026-11-23'), old], removed);
  assert.equal(p.length, 1);
  assert.match(p[0].message, /removed on 2026-11-23.*underlay before/);
  assert.deepEqual(validateRemoved(removed), []);
  assert.match(validateRemoved([{ src: 'a.jpg', date: 'today', why: '' }]).join(' '), /date.*why/);
});

test('split pairs: before/after names, a bare stem with -after, and an explicit guard.after', () => {
  assert.deepEqual(splitRole('ui/x/before-zoom-1.jpg'), { stem: 'ui/x/-zoom-1', role: 'before' });
  assert.deepEqual(splitRole('ui/x/after-zoom-1.jpg'), { stem: 'ui/x/-zoom-1', role: 'after' });
  assert.deepEqual(splitRole('whats-new/kinker-row-before-106.jpg'), { stem: 'whats-new/kinker-row-106', role: 'before' });
  assert.equal(splitRole('whats-new/beforehand.jpg').role, 'plain');
  const imgs: ImageEntry[] = [
    { src: 'w/a-before.jpg' }, { src: 'w/a-after.jpg' },
    { src: 'w/febo.png' }, { src: 'w/febo-after.jpg' },
    { src: 'w/glass-off.jpg', guard: { after: 'w/glass-on.jpg' } }, { src: 'w/glass-on.jpg' },
    { src: 'w/lonely-after.jpg' },
  ];
  const pairs = splitPairs(imgs);
  assert.deepEqual([...pairs].map(([b, a]) => [b, a.src]), [['w/glass-off.jpg', 'w/glass-on.jpg'], ['w/a-before.jpg', 'w/a-after.jpg'], ['w/febo.png', 'w/febo-after.jpg']]);
  const plan = planNote(note('2026-11-23', imgs));
  assert.deepEqual(plan.map(p => p.kind), ['split', 'covered', 'split', 'covered', 'split', 'covered', 'composite']);
});

test('plan: single and grid hints are not measured; a pair hint on a composite reaches the plan', () => {
  const plan = planNote(note('2026-11-23', [
    { src: 'w/shot.jpg', guard: { kind: 'single', reason: 'after only' } },
    { src: 'w/sheet.jpg', guard: { kind: 'grid', reason: 'four sides' } },
    { src: 'w/pair.jpg', guard: { panels: 3, target: [0, 0, 0.5, 0.5] } },
    'https://example.org/legacy.jpg',
  ]));
  assert.deepEqual(plan.map(p => p.kind), ['single', 'grid', 'composite']);
  assert.equal(plan[0].kind === 'single' && plan[0].reason, 'after only');
  assert.deepEqual(plan[2].kind === 'composite' && plan[2].hints, { panels: 3, target: [0, 0, 0.5, 0.5] });
});
