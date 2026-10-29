import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_STATE, RideTracker, entryOf, presentedMode, type GameLike } from './rideTracker';
import { deviceClass, perfTier } from './device';
import { validateEvent, type AnalyticsEvent } from './schema';

function setup(buurtAt?: (lng: number, lat: number) => string | null) {
  const events: AnalyticsEvent[] = [];
  let clock = 0;
  const tracker = new RideTracker({
    emit: e => { assert.ok(validateEvent(e), `emitted an allow-listed event: ${JSON.stringify(e)}`); events.push(e); },
    device: 'phone',
    now: () => clock,
    buurtAt,
  });
  // One game pixel = 1 m north-south, near the Westerkerk.
  const game: GameLike & { player: { x: number; y: number } } = {
    state: GAME_STATE.LOADING, travelMode: 'car', cityId: 'amsterdam', routePattern: 'surprise',
    player: { x: 0, y: 0 },
    track: { getRaceProgress: (_x, y) => Math.min(1, y / 1000) },
    _toLatLon: (_x, y) => [52.3744 + y / 111195, 4.8837],
    routeOptions: { answerMode: 'typing' },
    quizPromptSubject: 'street', quizPromptKind: 'route',
    vectorMap: { _renderGovernor: { steps: [], pixelRatio: 2 } },
  };
  return { events, tracker, game, advance: (s: number) => { clock += s; } };
}

test('a finished ride: start, buurten once each, answers, end, length, perf', () => {
  const { events, tracker, game, advance } = setup((_lng, lat) => (lat < 52.3780 ? 'AA01' : 'AA02'));
  tracker.rideStart(game);
  tracker.sample(game);
  game.state = GAME_STATE.RACING;
  game._intro = { elapsed: 0 };
  tracker.sample(game);
  game._intro = null;
  for (let y = 0; y <= 600; y += 100) { game.player.y = y; advance(30); tracker.sample(game); }
  tracker.answer(game, true);
  tracker.answer(game, false, true);
  game.state = GAME_STATE.FINISHED;
  tracker.rideFinish(game);
  tracker.sample(game); // nothing left to report
  assert.deepEqual(events, [
    { t: 'ride_start', mode: 'bike', entry: 'surprise', city: 'amsterdam', seq: '1' },
    { t: 'buurt', mode: 'bike', code: 'AA01' },
    { t: 'buurt', mode: 'bike', code: 'AA02' },
    { t: 'answer', mode: 'bike', kind: 'street', prompt: 'route', input: 'typing', outcome: 'correct' },
    { t: 'answer', mode: 'bike', kind: 'street', prompt: 'route', input: 'typing', outcome: 'no-idea' },
    { t: 'ride_end', mode: 'bike', outcome: 'finished', step: 'finished', progress: '75-100', answered: '1-2' },
    // 3 minutes since riding began (loading and intro do not count); 600 m sampled.
    { t: 'ride_length', mode: 'bike', outcome: 'finished', minutes: '3-5min', distance: '500m-1km' },
    { t: 'perf', device: 'phone', tier: 'smooth' },
  ]);
  assert.equal(tracker.active, false);
});

test('abandoned at loading: no length or perf, step loading', () => {
  const { events, tracker, game } = setup();
  tracker.rideStart(game);
  tracker.sample(game);
  game.state = GAME_STATE.MENU;
  tracker.sample(game);
  assert.deepEqual(events.slice(1), [{ t: 'ride_end', mode: 'bike', outcome: 'abandoned', step: 'loading', progress: '0-25', answered: '0' }]);
});

test('abandoned while paused on tab close, and a new ride ends the old one', () => {
  const { events, tracker, game } = setup();
  game.travelMode = 'boat';
  tracker.rideStart(game);
  game.state = GAME_STATE.RACING;
  game.player.y = 400;
  tracker.sample(game);
  game.state = GAME_STATE.PAUSED;
  tracker.sample(game);
  tracker.pageHide();
  const end = events.find(e => e.t === 'ride_end');
  assert.deepEqual(end, { t: 'ride_end', mode: 'boat', outcome: 'abandoned', step: 'paused', progress: '25-50', answered: '0' });

  events.length = 0;
  game.state = GAME_STATE.LOADING;
  tracker.rideStart(game);
  game.state = GAME_STATE.RACING;
  tracker.sample(game);
  game.state = GAME_STATE.LOADING;
  tracker.rideStart(game); // route setup → new route, without passing through MENU in a sample
  assert.deepEqual(events.map(e => e.t), ['ride_start', 'ride_end', 'ride_length', 'perf', 'ride_start']);
  assert.equal((events[0] as { seq: string }).seq, '2');
  assert.equal((events[4] as { seq: string }).seq, '3');
});

test('teleports (ferries, transit legs) do not add distance; free ride has no progress', () => {
  const { events, tracker, game } = setup();
  game.routePattern = 'free';
  tracker.rideStart(game);
  game.state = GAME_STATE.RACING;
  tracker.sample(game);
  game.player.y = 5000;
  tracker.sample(game);
  game.player.y = 5100;
  tracker.sample(game);
  tracker.pageHide();
  assert.deepEqual(events.find(e => e.t === 'ride_start'), { t: 'ride_start', mode: 'bike', entry: 'free', city: 'amsterdam', seq: '1' });
  assert.equal((events.find(e => e.t === 'ride_end') as { progress: string }).progress, 'none');
  assert.equal((events.find(e => e.t === 'ride_length') as { distance: string }).distance, 'lt500m');
});

test('answers outside a ride, and unknown game values, never produce off-list events', () => {
  const { events, tracker, game } = setup();
  tracker.answer(game, true);
  assert.equal(events.length, 0);
  game.cityId = 'paris';
  game.routePattern = 'weird';
  game.quizPromptSubject = 'Prinsengracht';
  game.quizPromptKind = null;
  game.routeOptions = null;
  tracker.rideStart(game);
  tracker.answer(game, false);
  assert.deepEqual(events, [
    { t: 'ride_start', mode: 'bike', entry: 'surprise', city: 'amsterdam', seq: '1' },
    { t: 'answer', mode: 'bike', kind: 'street', prompt: 'route', input: 'multiple', outcome: 'wrong' },
  ]);
});

test('entry, mode, device and perf helpers', () => {
  assert.equal(presentedMode('car'), 'bike');
  assert.equal(presentedMode('boat'), 'boat');
  assert.equal(presentedMode('transit'), 'transit');
  assert.equal(entryOf({ state: 0, routePattern: 'home', _tour: {} }), 'tour');
  assert.equal(entryOf({ state: 0, routePattern: 'surprise', _reviewRoute: {} }), 'review');
  assert.equal(entryOf({ state: 0, routePattern: 'here' }), 'here');
  assert.equal(entryOf({ state: 0, freeRide: true }), 'free');

  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const androidTablet = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const pixel = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  assert.equal(deviceClass({ userAgent: iphone }), 'phone');
  assert.equal(deviceClass({ userAgent: ipad, maxTouchPoints: 5 }), 'tablet');
  assert.equal(deviceClass({ userAgent: ipad, maxTouchPoints: 0 }), 'desktop');
  assert.equal(deviceClass({ userAgent: androidTablet }), 'tablet');
  assert.equal(deviceClass({ userAgent: pixel }), 'phone');
  assert.equal(deviceClass({ userAgent: 'x', mobile: true }), 'phone');
  assert.equal(deviceClass({ userAgent: '' }), 'desktop');

  assert.equal(perfTier(null), 'unknown');
  assert.equal(perfTier({ steps: [], pixelRatio: 2 }), 'smooth');
  assert.equal(perfTier({ steps: [{ kind: 'shadows' }], pixelRatio: 1 }), 'reduced');
  assert.equal(perfTier({ steps: [{ kind: 'pixelRatio' }], pixelRatio: 0.75 }), 'floor');
});
