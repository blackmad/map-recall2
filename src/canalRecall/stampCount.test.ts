// One stamp count on every surface (#283): the landing, the arrival card and
// the album all read stampAlbum.ts stampCount/stampList. Seeds are the three
// states of the ride review (#280): the landing fixture (4 quiz stamps), the
// knowledge-map spec seed (2 quiz + 1 Free Ride; the landing said 2, the album
// 3 / 89) and a 24-name seed with junk names (the landing said 11, the album
// 12 / 101).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLandingModel } from './landing/landingModel.ts';
import { landingFixtureEntries } from './landing/landingFixtures.ts';
import { FREE_RIDE_COLLECTION_KEY, stampCount, stampList } from './stampAlbum.ts';
import { AMSTERDAM_STAMP_BUURTS } from './stampCatalogue.ts';
import { stampCaption } from './stampCaption.ts';
import { PASSPORT_STORAGE_KEY } from './game/neighborhoodPassport.ts';
import { NEIGHBORHOOD_KIND_RANKS } from './game/landmarkData.ts';

const memory = (entries: Record<string, string>) => ({ getItem: (key: string) => entries[key] ?? null, setItem: () => {}, removeItem: () => {} });

export const STAMP_SEEDS: Record<string, { entries: Record<string, string>; earned: number }> = {
  landing: { entries: {}, earned: 4 },
  spec: {
    entries: {
      [PASSPORT_STORAGE_KEY]: JSON.stringify({ stamped: ['Grachtengordel', 'Oude Pijp'], dates: { Grachtengordel: '2026-11-07' } }),
      [FREE_RIDE_COLLECTION_KEY]: JSON.stringify({ opened: [], stamps: [{ hood: 'Marineterrein', at: '2026-11-08' }] }),
    },
    earned: 3,
  },
  junk: {
    entries: {
      [PASSPORT_STORAGE_KEY]: JSON.stringify({ stamped: ['Jordaan', 'De Pijp', 'Plantage', 'Grachtengordel', 'Oude Pijp', 'Buitenveldert', 'Weesp', 'Portugese Synagoge', 'Amsterdam', 'Grachtengordel-West', 'Street lm-1'] }),
      [FREE_RIDE_COLLECTION_KEY]: JSON.stringify({ opened: [], stamps: [{ hood: 'Marineterrein', at: '2026-11-08' }, { hood: 'Jordaan', at: '2026-11-08' }] }),
    },
    earned: 8,
  },
};

test('the catalogue is the extract\'s ranked buurts, 89 names', () => {
  const boundaries = JSON.parse(readFileSync(new URL('../../public/data/extracts/amsterdam/boundaries.json', import.meta.url), 'utf8')) as Array<{ name?: string; kind?: string; geometry?: unknown }>;
  const names = [...new Set(boundaries.filter(b => b.name && b.geometry && NEIGHBORHOOD_KIND_RANKS[b.kind || '']).map(b => b.name!))].sort();
  assert.deepEqual([...AMSTERDAM_STAMP_BUURTS].sort(), names);
  assert.equal(AMSTERDAM_STAMP_BUURTS.length, 89);
});

for (const [seed, { entries, earned }] of Object.entries(STAMP_SEEDS)) {
  test(`seed ${seed}: landing, arrival and album count ${earned} of 89`, () => {
    const now = Date.UTC(2026, 10, 9, 10);
    const store = memory(seed === 'landing' ? landingFixtureEntries('returning', now) : entries);
    const count = stampCount(store);
    assert.deepEqual(count, { earned, total: 89 });
    assert.equal(stampList(store).earned, earned);
    assert.equal(buildLandingModel(store, now).header.stamps, earned);
  });
}

test('a destination or junk name is never a stamp and never moves the total', () => {
  const album = stampList(memory(STAMP_SEEDS.junk.entries));
  assert.equal(album.total, 89);
  assert.ok(!album.stamps.some(stamp => stamp.name === 'Portugese Synagoge' || stamp.name === 'Amsterdam'));
});

test('captions break at a Dutch seam instead of truncating', () => {
  assert.equal(stampCaption('Grachtengordel'), 'Grachten­gordel');
  assert.equal(stampCaption('Hoofddorppleinbuurt'), 'Hoofddorp­pleinbuurt');
  assert.equal(stampCaption('Jordaan'), 'Jordaan');
  assert.equal(stampCaption('Buitenveldert-West'), 'Buitenveldert-West');
});
