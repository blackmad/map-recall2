import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addStop,
  chainBonus,
  endRun,
  isIdle,
  pauseRun,
  resumeRun,
  runTransition,
  withNextLeg,
  LAST_RUN_STORAGE_KEY,
  loadRun,
  newRun,
  pickNextStop,
  RUN_IDLE_MS,
  RUN_STORAGE_KEY,
  runLine,
  runsEnabled,
  runStory,
  scoreRun,
  scoreStop,
  saveRun,
  touchRun,
  type ArrivalInput,
  type RunStorage,
} from './chainedRun';
import { kmBetween, type RoutePoi } from './routeSelection';

const arrival = (name: string, points: number, names: string[] = [], bestStreak = 0): ArrivalInput => ({
  id: name.toLowerCase(), name, fromName: 'Westerkerk', points, bestStreak, names,
});

class MemoryStorage implements RunStorage {
  map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

test('chain bonus: +5 % per stop after the first, capped at +25 %', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(chainBonus), [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.25, 0.25]);
  assert.equal(chainBonus(0), 0);
  assert.equal(chainBonus(Number.NaN), 0);
});

test('a three-stop run totals points with the chain bonus, names and best streak', () => {
  let run = addStop(null, arrival('Artis', 100, ['Prinsengracht'], 2), 1000).run;
  assert.equal(run.stopCount, 1);
  assert.equal(run.totalPoints, 100);
  assert.equal(run.startName, 'Westerkerk');
  const second = addStop(run, arrival('Hortus', 200, ['Prinsengracht', 'Plantage Middenlaan'], 4), 2000);
  assert.equal(second.stop.points, 210);
  assert.equal(second.stop.bonus, 0.05);
  run = addStop(second.run, arrival('Waag', 100, ['Kloveniersburgwal'], 1), 3000).run;
  assert.equal(run.stopCount, 3);
  assert.equal(run.totalPoints, 100 + 210 + 110);
  assert.equal(run.bestStreak, 4);
  assert.deepEqual(run.names, ['Prinsengracht', 'Plantage Middenlaan', 'Kloveniersburgwal']);
  assert.equal(run.lastActiveAt, 3000);
});

test('an idle run is replaced by a new one on the next arrival', () => {
  const run = addStop(null, arrival('Artis', 100), 0).run;
  assert.equal(isIdle(run, RUN_IDLE_MS - 1), false);
  assert.equal(isIdle(run, RUN_IDLE_MS), true);
  const next = addStop(run, arrival('Hortus', 100), RUN_IDLE_MS + 5).run;
  assert.equal(next.stopCount, 1);
  assert.equal(next.totalPoints, 100);
  assert.equal(touchRun(run, 50).lastActiveAt, 50);
  assert.equal(touchRun(touchRun(run, 50), 10).lastActiveAt, 50);
});

test('run line: stops, names, points and this stop\'s bonus; calm mode shows neither points nor bonus', () => {
  const one = addStop(null, arrival('Artis', 1240, ['A', 'B']), 0).run;
  // Stop 1 earns no bonus, so the line promises none (#282: it used to show the next stop's +5 %).
  assert.equal(runLine(one, { calm: false }), '1 stop  ·  2 names  ·  1,240 points');
  assert.equal(runLine(one, { calm: true }), '1 stop  ·  2 names');
  let run = one;
  for (let i = 0; i < 6; i += 1) run = addStop(run, arrival(`S${i}`, 0), i + 1).run;
  assert.match(runLine(run, { calm: false }), /chain \+25 %$/);
  for (const line of [runLine(run, { calm: false }), runStory(run)]) assert.doesNotMatch(line, /!/);
});

test('scoring (#282): the review\'s seeded 130 / 240 / 90 — each stop carries the bonus it earned', () => {
  assert.deepEqual(scoreRun([130, 240, 90]), [
    { basePoints: 130, bonus: 0, points: 130, total: 130 },
    { basePoints: 240, bonus: 0.05, points: 252, total: 382 },
    { basePoints: 90, bonus: 0.1, points: 99, total: 481 },
  ]);
  // The run the runtime builds is the same numbers: stops, total and the run line at each arrival.
  const lines: string[] = [];
  let run = null as ReturnType<typeof addStop>['run'] | null;
  for (const [i, pts] of [130, 240, 90].entries()) {
    run = addStop(run, arrival(`S${i}`, pts, [`N${i}`]), i).run;
    lines.push(runLine(run, { calm: false }));
  }
  assert.deepEqual(run!.stops.map(s => [s.basePoints, s.bonus, s.points]), [[130, 0, 130], [240, 0.05, 252], [90, 0.1, 99]]);
  assert.equal(run!.totalPoints, 481);
  assert.deepEqual(lines, [
    '1 stop  ·  1 name  ·  130 points',
    '2 stops  ·  2 names  ·  382 points  ·  chain +5 %',
    '3 stops  ·  3 names  ·  481 points  ·  chain +10 %',
  ]);
});

test('scoring: the bonus caps at +25 % from stop 6; calm mode carries none; bad input scores 0', () => {
  const scores = scoreRun(Array(8).fill(100));
  assert.deepEqual(scores.map(s => s.bonus), [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.25, 0.25]);
  assert.deepEqual(scores.map(s => s.points), [100, 105, 110, 115, 120, 125, 125, 125]);
  assert.equal(scores[7].total, 925);
  assert.deepEqual(scoreRun([130, 240, 90], { calm: true }).map(s => [s.bonus, s.points, s.total]), [[0, 130, 130], [0, 240, 370], [0, 90, 460]]);
  const calm = addStop(addStop(null, { ...arrival('A', 130), calm: true }, 0).run, { ...arrival('B', 240), calm: true }, 1).run;
  assert.equal(calm.totalPoints, 370);
  assert.deepEqual(scoreStop(2, Number.NaN, 10), { basePoints: 0, bonus: 0.05, points: 0, total: 10 });
  assert.equal(scoreStop(3, -5, 0).points, 0);
});

test('run story: one sentence, from the first start to the last stop', () => {
  let run = addStop(null, arrival('Artis', 0, ['A']), 0).run;
  run = addStop(run, arrival('Hortus', 0, ['B', 'C']), 1).run;
  run = addStop(run, arrival('Waag', 0), 2).run;
  assert.equal(runStory(run), 'Three stops from Westerkerk to Waag, 3 names on the map.');
  assert.equal(runStory(newRun(0, '')), 'No stops.');
});

test('persistence: a reload within ten minutes continues the run; an idle one is closed once', () => {
  const storage = new MemoryStorage();
  const run = addStop(null, arrival('Artis', 100), 1000).run;
  saveRun(storage, run);
  assert.deepEqual(loadRun(storage, 1000 + 60_000), { run: { ...run, pausedAt: null }, ended: null });
  const late = loadRun(storage, 1000 + RUN_IDLE_MS);
  assert.equal(late.run, null);
  assert.equal(late.ended?.stopCount, 1);
  assert.equal(storage.getItem(RUN_STORAGE_KEY), null);
  assert.ok(storage.getItem(LAST_RUN_STORAGE_KEY));
  assert.deepEqual(loadRun(storage, 1000 + RUN_IDLE_MS), { run: null, ended: null });
  storage.setItem(RUN_STORAGE_KEY, '{not json');
  assert.deepEqual(loadRun(storage, 0), { run: null, ended: null });
  assert.deepEqual(loadRun(null, 0), { run: null, ended: null });
  saveRun(storage, run);
  endRun(storage, run);
  assert.equal(storage.getItem(RUN_STORAGE_KEY), null);
});

test('?run=0 turns chained stops off', () => {
  assert.equal(runsEnabled(''), true);
  assert.equal(runsEnabled('?run=1'), true);
  assert.equal(runsEnabled('?route=x&run=0'), false);
});

test('next stop: 1–3 km away, not a stop already reached, biased to the unknown', () => {
  const from = { id: 'dam', lat: 52.373, lng: 4.893 };
  const at = (id: string, dLatKm: number): RoutePoi => ({ id, name: id, lat: from.lat + dLatKm / 111.32, lng: from.lng });
  const pois = [at('near', 0.3), at('known', 1.5), at('fresh', 2.8), at('far', 5), at('visited', 2.5), from as RoutePoi];
  const samples = [{ lat: at('known', 1.5).lat, lng: from.lng, mastery: 1 }];
  const counts = new Map<string, number>();
  for (let i = 0; i < 200; i += 1) {
    const pick = pickNextStop(pois, from, { samples, excludeIds: ['visited'], chooseUnit: () => i / 200 });
    assert.ok(pick);
    const km = kmBetween(pick, from);
    assert.ok(km >= 1 && km <= 3, `${pick.id} at ${km.toFixed(2)} km`);
    counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1);
  }
  assert.equal(counts.get('visited'), undefined);
  assert.ok((counts.get('fresh') ?? 0) > (counts.get('known') ?? 0) * 2, JSON.stringify([...counts]));
  // Nothing in the band: the surprise picker's range instead.
  const fallback = pickNextStop([at('far', 5)], from, { chooseUnit: () => 0.5 });
  assert.equal(fallback?.id, 'far');
});

test('route setup from the arrival card closes the run without a card; pause and resume are transitions', () => {
  assert.equal(runTransition('finished', 'menu'), 'close');
  assert.equal(runTransition('finished', 'racing'), null);
  assert.equal(runTransition('racing', 'menu'), null);
  assert.equal(runTransition('racing', 'paused'), 'pause');
  assert.equal(runTransition('paused', 'racing'), 'resume');
  assert.equal(runTransition('paused', 'menu'), 'resume');
  assert.equal(runTransition('finished', 'finished'), null);
});

test('pause stops the idle clock; resume credits the paused span', () => {
  const run = addStop(null, arrival('Artis', 100), 0).run;
  const paused = pauseRun(run, 60_000);
  assert.equal(pauseRun(paused, 90_000).pausedAt, 60_000);
  assert.equal(isIdle(paused, 60_000 + RUN_IDLE_MS * 5), false);
  const resumed = resumeRun(paused, 60_000 + 3_600_000);
  assert.equal(resumed.pausedAt, null);
  assert.equal(resumed.lastActiveAt, 3_600_000);
  assert.equal(isIdle(resumed, 3_600_000 + RUN_IDLE_MS - 1), false);
  assert.equal(isIdle(resumed, 3_600_000 + RUN_IDLE_MS), true);
  assert.equal(resumeRun(run, 5).lastActiveAt, 0);
  // A run saved mid-pause and reloaded an hour later is still open.
  const storage = new MemoryStorage();
  saveRun(storage, paused);
  assert.equal(loadRun(storage, 60_000 + 3_600_000).run?.stopCount, 1);
});

test('the dealt leg is kept for a reload and cleared on arrival', () => {
  const leg = { from: { id: 'a', name: 'Artis', lat: 52.36, lng: 4.91 }, to: { id: 'h', name: 'Hortus', lat: 52.367, lng: 4.908 } };
  const run = withNextLeg(addStop(null, arrival('Artis', 100), 0).run, leg);
  const storage = new MemoryStorage();
  saveRun(storage, run);
  assert.deepEqual(loadRun(storage, 1000).run?.nextLeg, leg);
  assert.equal(addStop(run, arrival('Hortus', 100), 2000).run.nextLeg, null);
});
