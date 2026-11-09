import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLandingModel, dueMinutes, isReturningPlayer, landingCardsEnabled } from './landingModel';
import { dueLine, landingCardsHtml, landingHeaderText } from './landingView';
import { landingFixtureStorage, LANDING_FIXTURE_NOW } from './landingFixtures';

test('a first-time visitor keeps the static landing', () => {
  const storage = landingFixtureStorage('first-time');
  assert.equal(isReturningPlayer(storage), false);
  const model = buildLandingModel(storage, LANDING_FIXTURE_NOW);
  assert.equal(model.returning, false);
  assert.equal(landingCardsHtml(model, { ride: '/ride' }), '');
});

test('having opened the ride once makes a returning player', () => {
  assert.equal(isReturningPlayer(landingFixtureStorage('opened-once')), true);
});

test('a returning player gets three cards, the due nudge and the header figures', () => {
  const model = buildLandingModel(landingFixtureStorage('returning'), LANDING_FIXTURE_NOW);
  assert.equal(model.returning, true);
  assert.equal(model.due.names, 7);
  assert.equal(model.due.minutes, 12);
  assert.equal(dueLine(model), '7 names due · 12 min');
  assert.equal(model.header.stamps, 4);
  assert.equal(model.header.streakDays, 3);
  assert.equal(landingHeaderText(model), 'Streak · 3 days   Passport · 4 stamps');
  assert.ok(model.daily.pair);
  assert.equal(model.daily.board.length, 3);
  assert.equal(model.daily.today, null);
  const html = landingCardsHtml(model, { ride: '/ride' });
  for (const id of ['daily', 'review', 'free']) assert.match(html, new RegExp(`data-landing-card="${id}"`));
  assert.match(html, /href="\/ride\?ride=daily"/);
  assert.match(html, /href="\/ride\?ride=review"/);
  assert.match(html, /href="\/ride\?ride=free"/);
  assert.doesNotMatch(html, /!/);
});

test('nothing due says when the next name falls due', () => {
  const model = buildLandingModel(landingFixtureStorage('nothing-due'), LANDING_FIXTURE_NOW);
  assert.equal(model.due.names, 0);
  assert.equal(model.due.nextDueDays, 2);
  assert.match(landingCardsHtml(model, { ride: './' }), /Next name due in 2 days/);
});

test('names are escaped', () => {
  const model = buildLandingModel(landingFixtureStorage('returning'), LANDING_FIXTURE_NOW);
  model.daily.pair!.from = { ...model.daily.pair!.from, name: '<b>x</b>' };
  assert.match(landingCardsHtml(model, { ride: '/ride' }), /&lt;b&gt;x&lt;\/b&gt;/);
});

test('due minutes are bounded and ?landing=0 restores the static page', () => {
  assert.equal(dueMinutes(0), 0);
  assert.equal(dueMinutes(1), 5);
  assert.equal(dueMinutes(100), 30);
  assert.equal(landingCardsEnabled('?landing=0'), false);
  assert.equal(landingCardsEnabled(''), true);
});

test('blocked storage reads as a first-time visitor', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(buildLandingModel(blocked, LANDING_FIXTURE_NOW).returning, false);
});

test('the daily card prints the route length without "about" on a buurt-pool day (#279)', () => {
  const model = buildLandingModel(landingFixtureStorage('returning'), LANDING_FIXTURE_NOW);
  assert.ok(model.daily.pair?.routed, 'a pool day after the cutover');
  const html = landingCardsHtml(model, { ride: './' });
  assert.match(html, new RegExp(`${model.daily.pair!.km.toFixed(1).replace('.', '\\.')} km · the same route for everyone today`));
  assert.doesNotMatch(html, /about \d/);
});
