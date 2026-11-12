import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('whats-new landing page shows counts, a drawn 3D card, and fits the viewport', async ({ page }) => {
  await page.goto('/canal-drive/whats-new.html');
  await page.waitForFunction(() => (window as any).whatsNew?.ready === true, undefined, { timeout: 30_000 });

  for (const key of ['landmarks', 'ordinary', 'tris', 'week']) {
    const text = (await page.locator(`[data-k="${key}"]`).textContent()) ?? '';
    expect(text, key).toMatch(/\d/);
  }
  expect(Number((await page.locator('[data-k="landmarks"]').textContent())!.replace(/,/g, ''))).toBeGreaterThan(100);

  const cards = page.locator('#feed article.card');
  expect(await cards.count()).toBeGreaterThan(5);
  await expect(page.locator('#wip .wip').first()).toBeAttached();

  // Cards load their model lazily when scrolled near; the feed now starts below the fold.
  await cards.first().scrollIntoViewIfNeeded();
  await expect(cards.first().locator('.ph')).toHaveClass(/hide/, { timeout: 60_000 });
  const painted = await cards.first().locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(500);

  await page.getByRole('button', { name: 'Ordinary' }).click();
  const kinds = await page.locator('#feed .badge').allTextContents();
  expect(kinds.every(k => k !== 'Landmark')).toBe(true);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.locator('#q').fill('zzzz-no-such-building');
  await expect(page.locator('#feed .empty')).toBeVisible();
  // The two Kinderbrug groups, held after the 2026-10-17 review, are back as photo reconstructions.
  await page.locator('#q').fill('Kinderbrug');
  await expect(page.locator('#feed .empty')).toBeHidden();
  await page.locator('#q').fill('');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('whats-new plan view: #plan deep link, ordered phases, In progress from coverage-plan.json', async ({ page }) => {
  const plan = JSON.parse(readFileSync(join(process.cwd(), 'public/canal-drive/coverage-plan.json'), 'utf8'));
  const queueRequests: string[] = [];
  page.on('request', r => { if (r.url().includes('poi-work-queue')) queueRequests.push(r.url()); });

  await page.goto('/canal-drive/whats-new.html#plan');
  await page.waitForFunction(() => (window as any).whatsNew?.ready === true, undefined, { timeout: 30_000 });

  await expect(page.locator('#plan-sec')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#feed article.card')).toHaveCount(0);
  await expect(page.locator('#changes-sec')).toBeHidden();
  await expect(page.locator('#plan-updated')).toHaveText(/^Updated \d{1,2} [A-Z][a-z]+ \d{4}$/);
  await expect(page.locator('#plan-intro')).toHaveText(plan.intro);
  await expect(page.locator('#plan-principles li')).toHaveCount(plan.principles.length);

  const phases = page.locator('#plan-phases > li.phase');
  await expect(phases).toHaveCount(plan.phases.length);
  const orders = await phases.evaluateAll(els => els.map(e => Number((e as HTMLElement).dataset.order)));
  expect(orders).toEqual([...orders].sort((a, b) => a - b));
  const first = [...plan.phases].sort((a: any, b: any) => a.order - b.order)[0];
  await expect(phases.first().locator('h3')).toHaveText(first.title);
  await expect(phases.first().locator('.pri')).toHaveText(first.priority);
  await expect(phases.first().locator('.pst')).toHaveText('In progress');
  for (const status of ['Next', 'Ongoing', 'Later']) await expect(page.locator('#plan-phases .pst', { hasText: status }).first()).toBeVisible();
  await expect(phases.first().locator('ul li')).toHaveCount(first.items.length);

  // In progress now comes from coverage-plan.json, linked to GitHub issues where one exists.
  const wip = page.locator('#wip .wip');
  await expect(wip).toHaveCount(plan.inProgress.length);
  const withIssue = plan.inProgress.find((t: any) => t.issue);
  await expect(page.locator(`#wip a[href="https://github.com/blackmad/map-recall2/issues/${withIssue.issue}"]`)).toContainText(withIssue.name);
  await expect(page.locator('#wip a')).toHaveCount(plan.inProgress.filter((t: any) => t.issue).length);
  await expect(page.locator('#foot')).toHaveText(`${plan.inProgress.length} items in progress.`);
  expect(queueRequests).toEqual([]);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Leaving the plan drops the hash and brings the model feed back; the Plan tab restores it.
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('#plan-sec')).toBeHidden();
  await expect(page.locator('#feed article.card').first()).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await page.getByRole('button', { name: 'Plan' }).click();
  await expect(page.locator('#plan-sec')).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#plan');
});
