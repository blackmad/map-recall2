// Lane C2 (#368): BAG addresses on building cards. Free Ride says the address; a quiz mode withholds the street while
// any question is open and says it again after the answer. The street under question must never reach a card.
//
//   PW_PORT=4461 /tmp/canal-pw.sh npx playwright test tests/e2e/card-address.spec.ts --project=desktop --workers=1
import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

/** Herengracht canal house with a register entry; the address is injected as the published tile would carry it. */
const HOUSE = { id: 'NL.IMBAG.Pand.0363100012182945', center: [4.90017, 52.36263] as [number, number] };
const STREET = 'Herengracht';

async function boot(page: Page) {
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await page.waitForFunction(() => (window as any).canalRecallGame?._buildingFacts, null, { timeout: 120_000 });
  await page.evaluate(({ id, street }) => {
    const store = (window as any).canalRecallGame._buildingFacts;
    store.addresses.set(id.replace('NL.IMBAG.Pand.', 'P'), [[street, '502–504'], ['Leliegracht', '2']]);
  }, { id: HOUSE.id, street: STREET });
}

/** The card the game would open for a click on HOUSE, under a given question state. */
async function cardUnder(page: Page, state: { freeRide: boolean; quizPromptName?: string; quizCandidateName?: string; silent?: string }) {
  return page.evaluate(({ id, center, state }) => {
    const g = (window as any).canalRecallGame;
    const saved = { freeRide: g.freeRide, p: g.quizPromptName, c: g.quizCandidateName, s: g._silentPass };
    g.freeRide = state.freeRide; g.quizPromptName = state.quizPromptName ?? ''; g.quizCandidateName = state.quizCandidateName ?? '';
    g._silentPass = state.silent ? { name: state.silent } : null;
    try {
      const card = g._cardForClickedBuilding({ id, name: '', lngLat: center, featureTarget: null });
      return JSON.stringify({ name: card.name, detail: card.detail, longDetail: card.longDetail ?? '', factTexts: card.factTexts ?? [] });
    } finally {
      g.freeRide = saved.freeRide; g.quizPromptName = saved.p; g.quizCandidateName = saved.c; g._silentPass = saved.s;
    }
  }, { id: HOUSE.id, center: HOUSE.center, state });
}

test('Free Ride says the address; a quiz says it only between questions', async ({ page }) => {
  await boot(page);
  const free = await cardUnder(page, { freeRide: true });
  expect(free).toContain(`Address: ${STREET} 502–504 / Leliegracht 2.`);
  expect(await cardUnder(page, { freeRide: false })).toContain(`Address: ${STREET} 502–504 / Leliegracht 2.`);
  // Even in Free Ride a stale question name would be harmless: Free Ride has no questions.
  expect(await cardUnder(page, { freeRide: true, quizPromptName: STREET })).toContain(STREET);
});

test('no question state lets the street reach a card before the answer', async ({ page }) => {
  await boot(page);
  for (const state of [
    { freeRide: false, quizPromptName: STREET },
    { freeRide: false, quizCandidateName: STREET },
    { freeRide: false, silent: STREET },
    // the street on the card need not be the asked one: the rider's street is unknown to the card, so all are withheld
    { freeRide: false, quizPromptName: 'Keizersgracht' },
  ]) {
    const card = await cardUnder(page, state);
    expect(card, JSON.stringify(state)).not.toContain(STREET);
    expect(card, JSON.stringify(state)).not.toContain('Leliegracht');
    expect(card, JSON.stringify(state)).toContain('shown after you answer');
  }
  // After the answer the address returns.
  expect(await cardUnder(page, { freeRide: false, quizPromptName: '' })).toContain(STREET);
});

test('a click while a question is open opens no card', async ({ page }) => {
  await boot(page);
  const opened = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._clearLandmarkNotice(); g.quizPromptName = 'Herengracht';
    try { g._inspectBuildingAt(400, 300); return !!g._landmarkNotice; } finally { g.quizPromptName = ''; }
  });
  expect(opened).toBe(false);
});
