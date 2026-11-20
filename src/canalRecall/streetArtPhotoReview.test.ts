import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { StreetArtPoint } from './streetArt.ts';
import { applyPhotosToPoints, openLicence, photoProblems, publishReviewedPhotos, type PhotoReview, type StreetArtPhoto } from './streetArtPhotoReview.ts';

const photo = (id: string, extra: Partial<StreetArtPhoto> = {}): StreetArtPhoto => ({
  id, name: `Work ${id}`, file: `File:${id}.jpg`, page: `https://commons.wikimedia.org/wiki/File:${id}.jpg`,
  thumb: `https://upload.wikimedia.org/${id}.jpg`, licence: 'CC BY-SA 4.0', author: 'Someone', by: 'wikidata-p18', ...extra,
});
const review = (entries: PhotoReview['entries']): PhotoReview => ({ reviewed: '2026-11-20', entries });

test('open licences pass, NC/ND and unknown do not', () => {
  for (const ok of ['CC0', 'CC BY 2.0', 'CC BY-SA 3.0', 'CC BY 2.5 nl', 'Public domain', 'CC BY 4.0']) assert.ok(openLicence(ok), ok);
  for (const no of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', '', 'All rights reserved', 'GFDL']) assert.ok(!openLicence(no), no);
});

test('missing credit is a problem', () => {
  assert.deepEqual(photoProblems(photo('a')), []);
  assert.deepEqual(photoProblems(photo('a', { author: ' ' })), ['no author']);
  assert.deepEqual(photoProblems(photo('a', { page: '' })), ['no source page']);
});

test('accept keeps, reject drops, replace swaps the file but keeps the id and name', () => {
  const staged = { images: [photo('a'), photo('b'), photo('c')] };
  const out = publishReviewedPhotos(staged, review([
    { id: 'a', name: 'Work a', decision: 'accept', reason: 'the work' },
    { id: 'b', name: 'Work b', decision: 'reject', reason: 'a speck' },
    { id: 'c', name: 'Work c', decision: 'replace', reason: 'was the plaque', replacement: { file: 'File:C2.jpg', page: 'https://commons.wikimedia.org/wiki/File:C2.jpg', thumb: 'https://upload.wikimedia.org/C2.jpg', licence: 'CC0', author: 'Other' } },
  ]));
  assert.deepEqual(out.map(p => p.id), ['a', 'c']);
  assert.deepEqual(out[0], photo('a'));
  assert.equal(out[1].name, 'Work c');
  assert.equal(out[1].file, 'File:C2.jpg');
  assert.equal(out[1].author, 'Other');
  assert.equal(out[1].by, 'reviewed-replacement');
});

test('a half-reviewed or inconsistent review cannot publish', () => {
  const staged = { images: [photo('a'), photo('b')] };
  const a = { id: 'a', name: 'Work a', decision: 'accept' as const, reason: 'ok' };
  assert.throws(() => publishReviewedPhotos(staged, review([a])), /b \(Work b\) is staged but not reviewed/);
  assert.throws(() => publishReviewedPhotos(staged, review([a, a])), /reviewed twice/);
  assert.throws(() => publishReviewedPhotos(staged, review([a, { ...a, id: 'b' }, { ...a, id: 'z' }])), /z reviewed but not staged/);
  assert.throws(() => publishReviewedPhotos(staged, review([a, { id: 'b', name: 'Work b', decision: 'replace', reason: 'x' }])), /replace without a replacement/);
  assert.throws(() => publishReviewedPhotos({ images: [photo('a', { licence: 'CC BY-NC 2.0' })] }, review([a])), /not open/);
});

test('photos fill only points without an image', () => {
  const points: StreetArtPoint[] = [
    { id: 'a', name: 'A', lng: 4.9, lat: 52.37, k: 'statue' },
    { id: 'b', name: 'B', lng: 4.9, lat: 52.37, k: 'statue', i: 'https://upload.wikimedia.org/article.jpg' },
    { id: 'c', name: 'C', lng: 4.9, lat: 52.37, k: 'statue' },
  ];
  const { points: out, applied } = applyPhotosToPoints(points, [photo('a'), photo('b')]);
  assert.deepEqual(applied, ['a']);
  assert.equal(out[0].i, 'https://upload.wikimedia.org/a.jpg');
  assert.equal(out[1], points[1]);
  assert.equal(out[2], points[2]);
  assert.equal(points[0].i, undefined, 'input not mutated');
});

test('the checked-in review covers the staged file and publishes only open, credited photos', () => {
  const staged = JSON.parse(readFileSync('public/data/extracts/amsterdam/staging/street-art-commons.json', 'utf8'));
  const checked = JSON.parse(readFileSync('scripts/data/street-art-photo-review.json', 'utf8')) as PhotoReview;
  const published = publishReviewedPhotos(staged, checked);
  const rejected = checked.entries.filter(e => e.decision === 'reject').length;
  assert.equal(published.length, staged.images.length - rejected);
  // Named regressions: the staged files for these were a plaque, a sign or a crowd, not the work.
  for (const [id, bad] of [['n9199244050', 'Bordje'], ['n4771454407', 'Info Brettensuite'], ['n3130956442', 'Onthulling']]) {
    const p = published.find(x => x.id === id);
    assert.ok(p && !p.file.includes(bad), `${id} publishes the work, not "${bad}"`);
  }
  assert.ok(!published.some(p => p.id === 'n7288634672'), 'Cirkels (a speck in a meadow) is not published');
});
