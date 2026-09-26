import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

test.skip(!existsSync('public/canal-drive/facade-photo-review/local/dino-fit-05/manifest.json'), 'Ignored local DINO fitting run unavailable');

test('recovered ground-floor window renders with inspectable support and stale-edit handling', async ({page}) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/canal-drive/facade-photo-lab.html?run=dino-fit-05');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  const status=()=>page.evaluate(()=>(window as any).canalRecallPhotoLab.status());
  expect((await status()).openings).toHaveLength(9);
  expect((await status()).openings).toContain('dino-10');
  await page.locator('#opening').selectOption('dino-10');
  await expect(page.locator('#selected-fit')).toContainText('0.241');
  await expect(page.locator('#selected-fit')).toContainText('supported recovery');
  await expect(page.locator('#selected-fit')).toContainText('1 row peers, 2 column peers');
  await page.locator('#show-raw').check();
  await expect(page.locator('#overlay rect[stroke-dasharray]')).toHaveCount(11);
  expect(await page.evaluate(()=>(window as any).canalRecallPhotoLab.recipe().elevations[0].openings.basis)).toBe('inferred');
  await page.locator('#x0').fill('177');await page.locator('#apply').click();
  await expect(page.locator('#window-evidence')).toContainText('stale');
  await page.getByText('Original extracted fields for this opening and wall',{exact:true}).click();
  await expect(page.locator('#ontology-fields')).toContainText('stale after box edit');
  const recipe=await page.evaluate(()=>(window as any).canalRecallPhotoLab.recipe());
  expect(recipe.elevations[0].openings.value.find((o:any)=>o.id==='dino-10').appearance).toBeUndefined();
  expect(recipe.aliases).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('construction-hoarding candidate remains reviewable and absent from the mesh',async({page})=>{
  test.skip(!existsSync('public/canal-drive/facade-photo-review/local/dino-expansion-fit-02/manifest.json'));
  await page.goto('/canal-drive/facade-photo-lab.html?run=dino-expansion-fit-02');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  await page.locator('#source').selectOption('1');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab.status().ready);
  const status=await page.evaluate(()=>(window as any).canalRecallPhotoLab.status());
  expect(status.openings).toHaveLength(12);
  expect(status.openings).not.toContain('dino-1');
  expect(status.omitted.find((o:any)=>o.id==='dino-1').reason).toContain('semantic disagreement');
  const record=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  expect(record.featureOntology.building['roof.colour'].value).toBeNull();
  expect(record.featureOntology.building['roof.colour'].basis).toBe('unknown');
  expect(status.error).toBe('');
});

test('Base selector preserves the source and inferred size keeps measured sampling separate',async({page})=>{
  test.skip(!existsSync('public/canal-drive/facade-photo-review/local/dino-base-pilot-study-02/manifest.json'));
  await page.goto('/canal-drive/facade-photo-lab.html?run=dino-fit-05');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  await page.locator('#pipeline').selectOption('dino-base-pilot-fit-01');
  await page.waitForURL(/run=dino-base-pilot-fit-01/);
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  expect(await page.evaluate(()=>(window as any).canalRecallPhotoLab.record().source.address)).toBe('Keizersgracht 136');
  await page.locator('#pipeline').selectOption('dino-base-pilot-study-02');
  await page.waitForURL(/run=dino-base-pilot-study-02/);
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  const r=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  const middle=r.openings.find((o:any)=>o.id==='dino-9');
  expect(middle.box[3]).toBe(422);
  expect(middle.reconstruction.measuredBox[3]).toBe(396);
  expect(middle.appearance.sampleBox[3]).toBe(396);
  expect(middle.appearance.boundBox[3]).toBe(422);
  await page.locator('#opening').selectOption('dino-9');
  await expect(page.locator('#selected-fit')).toContainText('INFERRED reconstruction');
  await expect(page.locator('#pipeline-note')).toContainText('Source-image extent');
  await page.locator('#source').selectOption('1');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab.status().ready);
  const column=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  expect(column.openings.filter((o:any)=>o.state==='proposed')).toHaveLength(6);
  expect(column.openings.some((o:any)=>o.state==='proposed' && o.identityWarnings?.length)).toBe(true);
  expect(await page.evaluate(()=>(window as any).canalRecallPhotoLab.recipe().aliases)).toEqual([]);
});

test('day-two evidence restores the garage, preserves window families and exposes partial coverage',async({page})=>{
  test.skip(!existsSync('public/canal-drive/facade-photo-review/local/dino-base-pilot-day2-03/manifest.json'));
  await page.goto('/canal-drive/facade-photo-lab.html?run=dino-base-pilot-day2-03');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  await page.locator('#source').selectOption('1');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab.record().source.address==='Herengracht 219');
  const h219=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  expect(h219.openings.find((o:any)=>o.id==='dino-1').contextCheck.weakObservedPeerIds).toEqual(['dino-12']);
  expect((await page.evaluate(()=>(window as any).canalRecallPhotoLab.status())).openings).toContain('dino-1');

  await page.locator('#source').selectOption('0');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab.record().source.address==='Herengracht 242');
  const h242=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  expect(h242.openings.find((o:any)=>o.id==='dino-1').visibility).toMatchObject({state:'partial',sourceBoundaries:['bottom']});
  await page.locator('#opening').selectOption('dino-1');
  await expect(page.locator('#selected-fit')).toContainText('Partial source observation');
  await expect(page.locator('#overlay rect[stroke="#9d6bff"]')).toHaveCount(3);

  await page.locator('#pipeline').selectOption('dino-base-expansion-day2-03');
  await page.waitForURL(/run=dino-base-expansion-day2-03/);
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  const bloem=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  expect(bloem.fitting.sillGroups).not.toEqual(bloem.fitting.rows);
  expect(bloem.openings.find((o:any)=>o.id==='dino-19').secondaryCheck.edgePassed).toBe(true);
  expect((await page.evaluate(()=>(window as any).canalRecallPhotoLab.status())).openings).toContain('dino-19');
  expect((await page.evaluate(()=>(window as any).canalRecallPhotoLab.status())).openings).not.toContain('dino-22');
});

test('bounded grid and roof context recover the two reviewed inference gaps',async({page})=>{
  test.skip(!existsSync('public/canal-drive/facade-photo-review/local/dino-base-expansion-grid-03/manifest.json'));
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/canal-drive/facade-photo-lab.html?run=dino-base-expansion-grid-03');
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab?.status().ready);
  const bloem=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  const grid=bloem.openings.find((opening:any)=>opening.id==='grid-1');
  expect(grid).toMatchObject({state:'proposed',basis:'inferred'});
  expect(grid.reconstruction).toMatchObject({method:'grid-crossing',measuredBox:null,edgePassed:true});
  expect((await page.evaluate(()=>(window as any).canalRecallPhotoLab.status())).openings).toContain('grid-1');
  await page.locator('#opening').selectOption('grid-1');
  await expect(page.locator('#selected-fit')).toContainText('INFERRED reconstruction');
  await expect(page.locator('#fit-summary')).toContainText('explicit amber inferred cells');

  const herenIndex=await page.locator('#source option').evaluateAll(options=>options.findIndex(option=>option.textContent?.includes('Herenstraat 40')));
  expect(herenIndex).toBeGreaterThanOrEqual(0);
  await page.locator('#source').selectOption(String(herenIndex));
  await page.waitForFunction(()=>(window as any).canalRecallPhotoLab.record().source.address==='Herenstraat 40');
  const heren=await page.evaluate(()=>(window as any).canalRecallPhotoLab.record());
  expect(heren.openings.find((opening:any)=>opening.id==='dino-7').secondaryCheck).toMatchObject({
    passed:true,supportMode:'roof-context',aboveFacadeOpenings:true,
  });
  const status=await page.evaluate(()=>(window as any).canalRecallPhotoLab.status());
  expect(status.openings).toContain('dino-7');
  expect(status.openings).not.toContain('dino-1');
  await page.locator('#opening').selectOption('dino-7');
  await expect(page.locator('#selected-fit')).toContainText('via roof-context');
  expect(errors).toEqual([]);
});
