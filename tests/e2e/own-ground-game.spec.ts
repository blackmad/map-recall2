import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Own ground in the game (`?ownGround=1`, docs/research/own-ground-20261009.md).
// Opt-in, needs the GPU and the network basemap:
//   OWN_GROUND=1 PW_PORT=4417 npx playwright test own-ground-game --project=desktop
//   OWN_GROUND=1 PW_PORT=4417 npx playwright test own-ground-game --project=iphone
// Named regressions BRU0166 (Nassaukade, Bilderdijkgracht mouth) and BRU0044
// (Leidsegracht, Abel Weetnietbrug) in the game, and a chase ride over three
// bridges with screenshots into artifacts/own-ground-game/.
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-game';

type Place = { lng: number; lat: number; bearing: number };
// Nassaukade (way 1194778589), heading up the kade toward bridge way 7373504 (BRU0166).
const NASSAUKADE: Place = { lng: 4.87445, lat: 52.37286, bearing: 40 };
// Leidsegracht toward the Abel Weetnietbrug (BRU0044, masonry arch over the Herengracht crossing).
const LEIDSEGRACHT: Place = { lng: 4.88557, lat: 52.36728, bearing: 240 };

async function boot(page: Page, ownGround: boolean): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript((on: boolean) => { (window as any).__canalRecallOwnGround = on; }, ownGround);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

/** Put the player at a place, frozen (no input), facing `bearing`. */
async function teleport(page: Page, p: Place): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

const status = (page: Page) => page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());

async function settle(page: Page, ms = 6000): Promise<Record<string, any>> {
  // The rider's cell at LOD 0 and nothing queued.
  await expect.poll(async () => {
    const s = await status(page);
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(ms);
  return status(page);
}

/** A measured deck's centre (lng/lat) and its heading, from the ground's own placed profile. */
async function deckCentre(page: Page, id: string): Promise<{ lng: number; lat: number; bearing: number; crown: number; ends: number[] } | null> {
  return page.evaluate((deckId) => {
    const vm = (window as any).canalRecallGame.vectorMap, api = (window as any).CanalRecallOwnGround;
    const deck = vm._ownGround?.store.surface.decks.find((d: any) => d.profile.id === deckId);
    if (!deck) return null;
    const p = deck.profile, mid = Math.floor(p.x.length / 2);
    let crown = -Infinity; for (let i = 0; i < p.x.length; i++) crown = Math.max(crown, vm._ownGround.store.surface.height(p.x[i], p.y[i]));
    const [lng, lat] = api.fromLocal(p.x[mid], p.y[mid]);
    const dx = p.x[mid + 1] - p.x[mid - 1], dy = p.y[mid + 1] - p.y[mid - 1];
    return { lng, lat, bearing: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, crown, ends: deck.ends };
  }, id);
}

test('named regressions in game: BRU0166 Nassaukade and BRU0044 Leidsegracht', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page, true);
  const report: Record<string, unknown> = {};
  for (const [id, place] of [['BRU0166', NASSAUKADE], ['BRU0044', LEIDSEGRACHT]] as const) {
    await teleport(page, place);
    const s = await settle(page);
    expect(s.errors, JSON.stringify(s.errors)).toEqual([]);
    expect(s.basemapHidden).toBe(true);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${id}-approach.png` });
    const deck = await deckCentre(page, id);
    expect(deck, `${id} placed`).not.toBeNull();
    // On the crown: the bike rides the deck profile (vector-map eases the surface; give it frames).
    await teleport(page, { lng: deck!.lng, lat: deck!.lat, bearing: deck!.bearing });
    await page.waitForTimeout(2500);
    const rider = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._riderSurfaceM);
    expect(rider, `${id}: rider surface ${rider} vs crown ${deck!.crown}`).toBeGreaterThan(Math.max(...deck!.ends) + 0.3);
    expect(Math.abs(rider - deck!.crown)).toBeLessThan(0.6);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${id}-on-deck.png` });
    report[id] = { deck, riderSurfaceM: rider, status: await status(page) };
  }
  writeFileSync(`${OUT}/${info.project.name}-regressions.json`, JSON.stringify(report, null, 2));
  expect(errors).toEqual([]);
});
