import {test,expect} from '@playwright/test';
test('material trial keeps experimental geometry exclusive and restores the game',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/canal-drive/material-demo.html');
 await page.waitForFunction(()=>Boolean((window as any).wallMaterialDemo?.ready),{},{timeout:120000});
 const before=await page.evaluate(async()=>{const d=(window as any).wallMaterialDemo;await d.show(0,false);return{state:d.state(),filter:d.map.getFilter('osm-colored-buildings'),trial:d.map.getFilter('wall-material-trial'),light:d.map.getLight()};});
 expect(before.state.eligible).toBe(9);expect(JSON.stringify(before.filter)).toContain('NL.IMBAG.Pand.0363100012166570');
 expect(JSON.stringify(before.trial)).toContain('NL.IMBAG.Pand.0363100012166570');
 await page.evaluate(()=>{const d=(window as any).wallMaterialDemo;d.vectorMap._refreshColoredBuildingFilter();});
 const filtered=await page.evaluate(()=>JSON.stringify((window as any).wallMaterialDemo.map.getFilter('osm-colored-buildings')));expect(filtered).toBe(JSON.stringify(before.filter));
 await page.locator('#current').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).wallMaterialDemo.map.getLayoutProperty('wall-material-trial','visibility'))).toBe('none');
 expect(await page.evaluate(()=>JSON.stringify((window as any).wallMaterialDemo.map.getFilter('osm-colored-buildings')??null))).not.toContain('NL.IMBAG.Pand.0363100012166570');
 await page.locator('#preview').click();await expect.poll(()=>page.evaluate(()=>(window as any).wallMaterialDemo.map.getLayoutProperty('wall-material-trial-caps','visibility'))).toBe('visible');
 await page.evaluate(async()=>{const d=(window as any).wallMaterialDemo;await d.show(10,false);});
 await expect(page.locator('#badge')).toContainText('unresolved');
 await page.locator('#gallery').click();await expect(page.locator('#swatches canvas')).toHaveCount(12);
 expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test('visual report exposes checked evidence and unresolved cases',async({page})=>{
 await page.goto('/canal-drive/material-report.html');
 await expect(page.locator('#summary')).toContainText('100 buildings assessed');
 await expect(page.locator('#summary')).toContainText('4 remain unresolved');
 await expect(page.locator('article')).toHaveCount(10);
 await expect(page.locator('article').first().locator('h2')).toContainText('Da Costakade 13');
 await expect.poll(()=>page.locator('article img').first().evaluate((image:HTMLImageElement)=>image.naturalWidth)).toBeGreaterThan(0);
 const href=await page.locator('article').first().getByText('Isolated target crop',{exact:true}).getAttribute('href');
 expect(href).toMatch(/^\/data\/wall-materials\/review-images\/[a-f0-9]{64}\.png$/);
});
