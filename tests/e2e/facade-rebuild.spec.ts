import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildElevations } from '../../src/canalRecall/facade/elevations.ts';
import type { RegistrationGoldFixture } from '../../src/canalRecall/facade/registrationGold.ts';

function syntheticFixture(): RegistrationGoldFixture {
  const pandId = '0363100012164989';
  const footprintRd = [{ x: 120000, y: 480000 }, { x: 120008, y: 480000 }, { x: 120008, y: 480020 }, { x: 120000, y: 480020 }];
  const elevations = buildElevations(footprintRd, { pandId });
  return {
    fixtureId: 'browser-synthetic', label: 'Synthetic review mechanics fixture', pandId, status: 'candidate', rationale: '', intendedCoverage: [],
    footprintRd, elevations, addresses: [], selectedElevationId: elevations[0].elevationId, elevationSelectionBasis: null,
    sourceQuad: null, rectifiedPreviewUrl: null, anchors: [], reviewPasses: [], identityVersion: 'synthetic/v1',
    sourceVersion: { sha256: 'a'.repeat(64), width: 8000, height: 4000, schema: 'synthetic/v1' }, cameraModelVersion: null,
    panorama: { panoramaId: 'synthetic', lngLat: [4.88, 52.37], cameraRd: { x: 120004, y: 479980 }, cameraHeight: 2,
      headingDeg: 0, pitchDeg: 0, rollDeg: 0, capturedAt: '2026-09-04T00:00:00Z', imageUrl: 'https://example.invalid/pano',
      previewUrl: null, missionYear: 'synthetic', mission: 'synthetic', localImageUrl: 'local/synthetic.svg' },
  };
}

test('identity review revokes on rejection, wall/source changes and stale imports', async ({ page }) => {
  const fixture = syntheticFixture();
  await page.route('**/facade-registration-review/local/fixtures.json', route => route.fulfill({ json: { schemaVersion: 2, fixtures: [fixture] } }));
  await page.route('**/local/synthetic.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="4000"><rect width="8000" height="4000" fill="#234"/></svg>' }));
  await page.goto('/canal-drive/facade-registration-review/index.html');
  const counter = page.locator('#counter');
  await expect(counter).toContainText('0/1 REVIEWED');
  const save = async () => {
    await page.locator('#reviewer').fill('Synthetic browser test');
    await page.locator('#identity-verdict').selectOption('accepted');
    await page.locator('#elevation-verdict').selectOption('accepted');
    await page.locator('#save-pass').click();
    await expect(counter).toContainText('1/1 REVIEWED');
  };
  await save();
  const download = page.waitForEvent('download');
  await page.locator('#export-review').click();
  const acceptedExport = readFileSync((await (await download).path())!);
  await page.locator('#reviewer').fill('Synthetic browser test');
  await page.locator('#reject-fixture').click();
  await expect(counter).toContainText('0/1 REVIEWED');
  await page.reload();
  await expect(counter).toContainText('0/1 REVIEWED');
  await page.locator('#import-review').setInputFiles({ name: 'older-accepted.json', mimeType: 'application/json', buffer: acceptedExport });
  await expect(counter).toContainText('0/1 REVIEWED');
  await save();
  await page.locator('input[name="elevation"]').nth(1).check();
  await expect(counter).toContainText('0/1 REVIEWED');
  await save();
  fixture.sourceVersion!.sha256 = 'b'.repeat(64);
  await page.reload();
  await expect(counter).toContainText('0/1 REVIEWED');
  await page.locator('#import-review').setInputFiles({ name: 'stale-source.json', mimeType: 'application/json', buffer: acceptedExport });
  await expect(counter).toContainText('0/1 REVIEWED');
  expect(await page.evaluate(() => {
    const drafts = Object.keys(localStorage).filter(key => key.includes('browser-synthetic'));
    return drafts.map(key => JSON.parse(localStorage.getItem(key)!)).at(-1)?.sourceVersion.sha256;
  })).toBe('b'.repeat(64));
});

test('the comparison starts streaming without a camera gesture', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/canal-drive/building-compare.html');
  const note = page.locator('#right-note');
  await expect.poll(async () => Number(await note.getAttribute('data-tiles')), { timeout: 60000 }).toBeGreaterThan(0);
  expect(Number(await note.getAttribute('data-features'))).toBeGreaterThan(500);
});
