import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';
import { EVENT_FIELDS, SESSION_ID, parseBatch, validateEvent } from '../../src/canalRecall/analytics/schema.ts';

// Consent-free analytics (#115): ride briefly with an analytics endpoint
// configured, and check (1) every beacon is exactly the allow-listed shape and
// (2) the analytics bundle never writes a cookie, localStorage, sessionStorage
// or IndexedDB, and the session id appears in none of them.

const ENDPOINT = '/__analytics-beacon-test';

async function instrument(page: Page): Promise<string[]> {
  const beacons: string[] = [];
  await page.route('**/js/runtime-config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.CANAL_RUNTIME_CONFIG = { sentryDsn: '', release: '', appCheckSiteKey: '', analyticsEndpoint: '${ENDPOINT}' };`,
  }));
  await page.route(`**${ENDPOINT}`, async route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    expect(request.headers().cookie, 'beacon carries no cookie').toBeUndefined();
    beacons.push(request.postData() ?? '');
    await route.fulfill({ status: 204, body: '' });
  });
  // Record every storage write with its stack, so writes from analytics.bundle.js can be told apart
  // from the game's own preferences and caches.
  await page.addInitScript(() => {
    const log: Array<{ kind: string; key: string; stack: string }> = [];
    (window as unknown as { __storageWrites: typeof log }).__storageWrites = log;
    const note = (kind: string, key: string) => log.push({ kind, key, stack: new Error().stack ?? '' });
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      note(this === window.sessionStorage ? 'sessionStorage' : 'localStorage', key);
      return setItem.call(this, key, value);
    };
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      note('remove', key);
      return removeItem.call(this, key);
    };
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    Object.defineProperty(Document.prototype, 'cookie', {
      configurable: true,
      get() { return cookie.get!.call(this); },
      set(value: string) { note('cookie', String(value).split('=')[0]); cookie.set!.call(this, value); },
    });
    if (window.indexedDB) {
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (name: string, version?: number) {
        note('indexedDB', name);
        return version === undefined ? open.call(this, name) : open.call(this, name, version);
      };
    }
  });
  return beacons;
}

test('analytics beacons carry only allow-listed fields and leave no storage trace', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one device is enough for the payload check');
  const beacons = await instrument(page);
  await openRoute(page, { travelMode: 'car' });
  await expect.poll(() => page.evaluate(() => Boolean(window.CanalRecallAnalytics?.enabled))).toBe(true);
  const cookiesBefore = await page.evaluate(() => document.cookie);

  // Ride a few sampling periods so the buurt index loads and the rider's buurt is counted.
  type G = { state: number; player: { x: number; y: number }; track: { finishPoint: { x: number; y: number } }; quizPromptName: string; _submitCanalAnswer(a: string | null, noIdea?: boolean): void };
  await page.waitForTimeout(7000);
  // Answer a question if one is open (the hook in recallRuntime.ts), then arrive (the hook in game.js).
  await page.evaluate(() => {
    const g = (window as unknown as { canalRecallGame: G }).canalRecallGame;
    if (g.quizPromptName) g._submitCanalAnswer(null, true);
  });
  await page.evaluate(() => {
    const g = (window as unknown as { canalRecallGame: G }).canalRecallGame;
    g.player.x = g.track.finishPoint.x;
    g.player.y = g.track.finishPoint.y;
  });
  await expect.poll(() => page.evaluate(() => window.canalRecallGame.state), { timeout: 15_000 }).toBe(5);
  await expect.poll(() => beacons.length, { timeout: 10_000 }).toBeGreaterThan(0);
  // And the tab going away flushes whatever is left.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

  const events: Array<Record<string, string>> = [];
  const sids = new Set<string>();
  for (const body of beacons) {
    const raw = JSON.parse(body) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['events', 'n', 'sid', 'v']);
    expect(raw.sid).toMatch(SESSION_ID);
    sids.add(raw.sid as string);
    const parsed = parseBatch(body);
    expect(parsed, body).not.toBeNull();
    expect(parsed!.dropped, `no off-list events in ${body}`).toBe(0);
    for (const event of raw.events as Array<Record<string, string>>) {
      expect(validateEvent(event), JSON.stringify(event)).toEqual(event);
      expect(Object.keys(event).sort()).toEqual(['t', ...Object.keys(EVENT_FIELDS[event.t as keyof typeof EVENT_FIELDS])].sort());
      events.push(event);
    }
  }
  expect(sids.size, 'one session id per tab').toBe(1);
  const types = events.map(e => e.t);
  expect(types).toContain('session');
  expect(events).toContainEqual(expect.objectContaining({ t: 'ride_start', mode: 'bike', city: 'amsterdam', seq: '1' }));
  expect(events).toContainEqual(expect.objectContaining({ t: 'ride_end', outcome: 'finished', step: 'finished' }));
  expect(types).toContain('ride_length');
  expect(types).toContain('perf');
  expect(events.some(e => e.t === 'buurt' && /^[A-Z][A-Z0-9][0-9]{2}$/.test(e.code)), JSON.stringify(events)).toBe(true);
  // Nothing in a beacon looks like a coordinate, a street name or a timestamp.
  for (const body of beacons) expect(body).not.toMatch(/\d+\.\d{3,}|gracht|straat|\d{10,}/i);

  const [sid] = [...sids];
  const trace = await page.evaluate(() => ({
    writes: (window as unknown as { __storageWrites: Array<{ kind: string; key: string; stack: string }> }).__storageWrites,
    cookie: document.cookie,
    local: Object.entries(localStorage).map(([k, v]) => `${k}=${v}`).join('\n'),
    session: Object.entries(sessionStorage).map(([k, v]) => `${k}=${v}`).join('\n'),
  }));
  const fromAnalytics = trace.writes.filter(w => /analytics\.bundle\.js/.test(w.stack));
  expect(fromAnalytics, JSON.stringify(fromAnalytics)).toEqual([]);
  expect(trace.cookie).toBe(cookiesBefore);
  for (const where of [trace.cookie, trace.local, trace.session]) expect(where.includes(sid)).toBe(false);
});

test('no endpoint configured: the analytics bundle never loads and nothing is sent', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop only');
  const scripts: string[] = [];
  page.on('request', request => { if (/analytics/.test(request.url())) scripts.push(request.url()); });
  await openRoute(page, { travelMode: 'boat' });
  await page.waitForTimeout(2000);
  expect(scripts).toEqual([]);
  expect(await page.evaluate(() => window.CanalRecallAnalytics)).toBeUndefined();
});
