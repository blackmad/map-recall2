import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStampAlbum, FREE_RIDE_COLLECTION_KEY, readStampSources, stampDateLabel } from './stampAlbum.ts';
import { PASSPORT_STORAGE_KEY, readPassport, stampNewNeighborhoods, emptyPassport } from './game/neighborhoodPassport.ts';
import { emptyExploration } from './game/progressStore.ts';

const memory = (entries: Record<string, string>) => ({ getItem: (key: string) => entries[key] ?? null });

test('stamps come from the quiz passport and the Free Ride collection; earliest date wins', () => {
  const sources = readStampSources(memory({
    [PASSPORT_STORAGE_KEY]: JSON.stringify({ stamped: ['Jordaan', 'De Pijp'], dates: { Jordaan: '2026-11-07', 'De Pijp': 'nope' } }),
    [FREE_RIDE_COLLECTION_KEY]: JSON.stringify({ opened: [], stamps: [{ hood: 'Marineterrein', at: '2026-11-08' }, { hood: 'Jordaan', at: '2026-11-01' }, { at: 'x' }] }),
  }));
  assert.deepEqual(sources.stamped, ['De Pijp', 'Jordaan', 'Marineterrein']);
  assert.deepEqual(sources.dates, { Jordaan: '2026-11-01', Marineterrein: '2026-11-08' });
});

test('corrupt or absent storage reads as an empty album, not an error', () => {
  assert.deepEqual(readStampSources(memory({ [PASSPORT_STORAGE_KEY]: '{bad', [FREE_RIDE_COLLECTION_KEY]: 'null' })), { stamped: [], dates: {} });
  assert.deepEqual(readStampSources(null), { stamped: [], dates: {} });
});

test('album order: earned newest first, undated after, then unearned alphabetically', () => {
  const album = buildStampAlbum(['Zuidas', 'Jordaan', 'De Pijp', 'Apollobuurt', 'Jordaan'], {
    stamped: ['Jordaan', 'De Pijp', 'Weesp'],
    dates: { Jordaan: '2026-11-01', Weesp: '2026-11-05' },
  });
  assert.deepEqual(album.stamps.map(s => s.name), ['Weesp', 'Jordaan', 'De Pijp', 'Apollobuurt', 'Zuidas']);
  assert.equal(album.earned, 3);
  assert.equal(album.total, 5);
  assert.equal(album.stamps[2].date, null);
  assert.equal(album.stamps[3].earned, false);
});

test('a fresh passport stamp records the day it was earned', () => {
  const exploration = { ...emptyExploration(), learnedStreets: Array.from({ length: 10 }, (_, i) => `S${i}`), visitedNeighborhoods: ['Jordaan'] };
  const { passport, fresh } = stampNewNeighborhoods(exploration, ['Jordaan'], emptyPassport(), 8, '2026-11-09');
  assert.deepEqual(fresh, ['Jordaan']);
  assert.deepEqual(passport.dates, { Jordaan: '2026-11-09' });
  const stored = memory({ [PASSPORT_STORAGE_KEY]: JSON.stringify(passport) });
  assert.deepEqual(readPassport(stored), passport);
  assert.equal(readStampSources(stored).dates.Jordaan, '2026-11-09');
  // Nothing new: the prior passport comes back untouched.
  const again = stampNewNeighborhoods(exploration, ['Jordaan'], passport, 8, '2026-11-10');
  assert.equal(again.passport, passport);
});

test('date label in plaque voice', () => {
  assert.equal(stampDateLabel('2026-11-09'), '9 Nov 2026');
  assert.equal(stampDateLabel(null), '');
});
