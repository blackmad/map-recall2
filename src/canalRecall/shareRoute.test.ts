import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRouteShare, formatRaceHash, metresBetween, neutralStandIn, parseRaceHash, privatePlacesFromHomeCache,
  shareOrCopy, shareRecordUrl, shareToastText, travelParam,
} from './shareRoute.ts';
import { createRideRecord, rideAgainHref } from './routeHistory.ts';

const WESTERKERK = { id: 'westerkerk', name: 'Westerkerk', lat: 52.3747, lng: 4.8838 };
const DAM = { id: 'dam', name: 'Dam Square', lat: 52.3731, lng: 4.8926 };
const REMBRANDTPLEIN = { id: 'rembrandtplein', name: 'Rembrandtplein', lat: 52.3663, lng: 4.8964 };
const POIS = [WESTERKERK, DAM, REMBRANDTPLEIN];
// A made-up home address in the Jordaan, ~250 m from the Westerkerk.
const HOME = { id: 'home', name: 'Home', lat: 52.3768, lng: 4.8829 };
const BASE = { origin: 'https://canalrecall.app', pathname: '/ride' };

const race = (start: { lat: number; lng: number }, finish: { lat: number; lng: number }) => ({
  centre: { lat: (start.lat + finish.lat) / 2, lng: (start.lng + finish.lng) / 2 }, start, finish,
});

test('race hashes round-trip at the ride\'s 4-decimal precision', () => {
  const hash = '#race=52.3739,4.8882,52.3747,4.8838,52.3731,4.8926';
  const parsed = parseRaceHash(`https://x/ride${hash}`);
  assert.ok(parsed);
  assert.equal(formatRaceHash(parsed), hash);
  assert.equal(parseRaceHash('https://x/ride#race=1,2,3'), null);
  assert.equal(parseRaceHash('https://x/ride#race=1,2,3,4,5,nope'), null);
  assert.equal(parseRaceHash(null), null);
  assert.equal(travelParam('bike'), 'car');
  assert.equal(travelParam(undefined), 'car');
  assert.equal(travelParam('boat'), 'boat');
  assert.equal(travelParam('transit'), 'transit');
});

test('a public route shares its own start, finish, centre and mode', () => {
  const r = race(WESTERKERK, DAM);
  const share = buildRouteShare({ ...BASE, travelMode: 'boat', race: r, from: WESTERKERK, to: DAM, publicPois: POIS });
  assert.ok(share);
  assert.equal(share.url, `https://canalrecall.app/ride?travel=boat${formatRaceHash(r)}`);
  assert.equal(share.neutralised, false);
  assert.match(share.text, /from Westerkerk to Dam Square by boat/);
});

test('a Home start never leaves the device: it shares from the nearest public destination', () => {
  const r = race(HOME, REMBRANDTPLEIN);
  const share = buildRouteShare({ ...BASE, travelMode: 'car', race: r, from: HOME, to: REMBRANDTPLEIN, publicPois: POIS });
  assert.ok(share);
  const shared = parseRaceHash(share.url)!;
  assert.deepEqual(shared.start, { lat: WESTERKERK.lat, lng: WESTERKERK.lng }, 'nearest public stand-in');
  assert.deepEqual(shared.finish, { lat: REMBRANDTPLEIN.lat, lng: REMBRANDTPLEIN.lng });
  assert.ok(metresBetween(shared.start, HOME) > 100);
  // The centre is recomputed, so start = 2·centre − finish cannot recover home.
  const solved = { lat: 2 * shared.centre.lat - shared.finish.lat, lng: 2 * shared.centre.lng - shared.finish.lng };
  assert.ok(metresBetween(solved, HOME) > 100, 'centre does not encode the home start');
  assert.equal(share.neutralised, true);
  assert.ok(!share.url.includes(HOME.lat.toFixed(4)), 'no home coordinate in the URL');
  assert.ok(!/home/i.test(share.url));
  assert.match(share.text, /from Westerkerk to Rembrandtplein/);
});

test('a start near a saved home counts as private even when the POI looks public (stale routeFrom on a link boot)', () => {
  const nextDoor = { lat: HOME.lat + 0.0005, lng: HOME.lng };
  const share = buildRouteShare({
    ...BASE, race: race(nextDoor, DAM), from: DAM /* stale */, to: DAM, publicPois: POIS, privatePlaces: [{ lat: HOME.lat, lng: HOME.lng }],
  });
  assert.ok(share);
  assert.deepEqual(parseRaceHash(share.url)!.start, { lat: WESTERKERK.lat, lng: WESTERKERK.lng });
  assert.equal(share.text.includes('Dam Square to'), false, 'a stale routeFrom name is not trusted');
});

test('a GPS "Here" start or a private finish is neutralised; with no stand-in nearby it is not shareable', () => {
  const here = { id: 'here', name: 'Here', lat: 52.3660, lng: 4.8970 };
  const share = buildRouteShare({ ...BASE, race: race(here, WESTERKERK), from: here, to: WESTERKERK, publicPois: POIS });
  assert.ok(share);
  // Rembrandtplein is nearest to the fix.
  assert.deepEqual(parseRaceHash(share.url)!.start, { lat: REMBRANDTPLEIN.lat, lng: REMBRANDTPLEIN.lng });
  const toHome = buildRouteShare({ ...BASE, race: race(DAM, HOME), from: DAM, to: HOME, publicPois: POIS });
  assert.deepEqual(parseRaceHash(toHome!.url)!.finish, { lat: WESTERKERK.lat, lng: WESTERKERK.lng });
  assert.equal(buildRouteShare({ ...BASE, race: race(HOME, DAM), from: HOME, to: DAM, publicPois: [] }), null, 'no catalogue: not shareable');
  const far = { id: 'far', name: 'Zaandam', lat: 52.44, lng: 4.83 };
  assert.equal(buildRouteShare({ ...BASE, race: race(HOME, DAM), from: HOME, to: DAM, publicPois: [far] }), null, 'stand-in too far');
  assert.equal(buildRouteShare({ ...BASE, race: null }), null);
});

test('the stand-in is never the finish itself, nor another private POI', () => {
  assert.equal(neutralStandIn(HOME, [HOME, WESTERKERK])?.id, 'westerkerk');
  assert.equal(neutralStandIn(HOME, [WESTERKERK, DAM], { avoid: WESTERKERK })?.id, 'dam');
  const share = buildRouteShare({ ...BASE, race: race(HOME, WESTERKERK), from: HOME, to: WESTERKERK, publicPois: POIS });
  assert.equal(parseRaceHash(share!.url)!.start.lat, DAM.lat);
});

test('a tour shares as ?tour=<id>', () => {
  const share = buildRouteShare({ ...BASE, tourId: 'golden bend', race: race(HOME, DAM), from: HOME });
  assert.equal(share?.url, 'https://canalrecall.app/ride?tour=golden%20bend');
});

test('home geocode cache entries become private points; junk is ignored', () => {
  const raw = JSON.stringify({ 'prinsengracht 1': { id: 'home', lat: 52.37, lng: 4.88, label: 'x' }, bad: { lat: 'x' } });
  assert.deepEqual(privatePlacesFromHomeCache(raw), [{ lat: 52.37, lng: 4.88 }]);
  assert.deepEqual(privatePlacesFromHomeCache('{nope'), []);
  assert.deepEqual(privatePlacesFromHomeCache(null), []);
});

const record = (from: { name: string; lat: number; lng: number }, to = DAM, travelMode = 'car') => createRideRecord({
  id: 'r', endedAt: 2_000_000, startedAt: 1_000_000, travelMode, from, to,
  shareUrl: `https://x/ride${formatRaceHash(race(from, to))}`,
});

test('My progress shares public rides as-is and refuses Home and Here rides', () => {
  const pub = record(WESTERKERK, DAM, 'transit');
  assert.equal(shareRecordUrl(pub, 'https://canalrecall.app', '/ride'), `https://canalrecall.app/ride?travel=transit${pub.raceHash}`);
  assert.equal(shareRecordUrl(record(HOME), 'https://canalrecall.app', '/ride'), null);
  assert.equal(shareRecordUrl(record({ name: 'Here', lat: 52.36, lng: 4.9 }), 'https://canalrecall.app', '/ride'), null);
  // A ride whose start was renamed (a replay booted from a link) but sits on a saved home.
  const disguised = record({ name: 'Dam Square', lat: HOME.lat, lng: HOME.lng });
  assert.equal(shareRecordUrl(disguised, 'https://canalrecall.app', '/ride', [HOME]), null);
  assert.equal(shareRecordUrl({ ...pub, raceHash: '' }, 'https://canalrecall.app', '/ride'), null);
});

test('Ride again marks a private origin so the replay stays private', () => {
  const home = record(HOME);
  assert.equal(rideAgainHref(home, '/ride'), `/ride?travel=car&start=home${home.raceHash}`);
  const here = record({ name: 'Here', lat: 52.36, lng: 4.9 });
  assert.match(rideAgainHref(here, '/ride')!, /\?travel=car&start=here#race=/);
  assert.equal(rideAgainHref(record(WESTERKERK), '/ride'), `/ride?travel=car${record(WESTERKERK).raceHash}`);
});

test('shareOrCopy prefers the share sheet, respects a cancel, and falls back to the clipboard', async () => {
  const payload = { url: 'https://canalrecall.app/ride?tour=a', title: 't', text: 'x' };
  const shared: unknown[] = [];
  assert.equal(await shareOrCopy(payload, { share: async d => { shared.push(d); } }), 'shared');
  assert.deepEqual(shared, [payload]);
  const copied: string[] = [];
  const clipboard = { writeText: async (t: string) => { copied.push(t); } };
  const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
  assert.equal(await shareOrCopy(payload, { share: async () => { throw abort; }, clipboard }), 'cancelled');
  assert.deepEqual(copied, [], 'a cancelled sheet does not copy');
  const denied = Object.assign(new Error('no activation'), { name: 'NotAllowedError' });
  assert.equal(await shareOrCopy(payload, { share: async () => { throw denied; }, clipboard }), 'copied');
  assert.equal(await shareOrCopy(payload, { share: async () => {}, canShare: () => false, clipboard }), 'copied');
  assert.equal(await shareOrCopy(payload, { clipboard }), 'copied');
  assert.deepEqual(copied, [payload.url, payload.url, payload.url]);
  assert.equal(await shareOrCopy(payload, { clipboard: { writeText: async () => { throw new Error('blocked'); } } }), 'failed');
  assert.equal(await shareOrCopy(payload, {}), 'failed');
  assert.equal(shareToastText('copied'), 'Link copied');
  assert.equal(shareToastText('shared'), '');
  assert.equal(shareToastText('failed'), 'Could not copy the link');
});
