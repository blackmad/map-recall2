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

test('owner isolation constrains only the selected building and restores game layers after pan',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/canal-drive/material-demo.html');
 await page.waitForFunction(()=>Boolean((window as any).wallMaterialDemo?.ready),{},{timeout:120000});
 await page.waitForFunction(()=>{
  const v=(window as any).wallMaterialDemo?.vectorMap;
  const groups=v&&[v._studyRoofAreas,v._studyFacadeAreas,v._studyTreeAreas,v._studyPublicRealmAreas];
  return Boolean(groups?.every((g:any[])=>g?.length&&g.some(l=>l.ready)));
 },{},{timeout:90000});

 const result=await page.evaluate(async()=>{
  const d=(window as any).wallMaterialDemo,m=d.map,v=d.vectorMap;
  const buildingLayers=['osm-colored-buildings','osm-colored-building-ground-floors','osm-colored-building-roofs'];
  const trialLayers=['wall-material-trial','wall-material-trial-caps'];
  const groupNames=['roofs','facades','trees','publicRealm'];
  const groupValues=[v._studyRoofAreas,v._studyFacadeAreas,v._studyTreeAreas,v._studyPublicRealmAreas];
  const ownerId=(index:number)=>`NL.IMBAG.Pand.${d.data.entries[index].buildingId}`;
  const eligibleIds=d.data.entries.filter((e:any)=>d.data.gate.includes(e.index)&&e.materialId!=='unknownneutral').map((e:any)=>`NL.IMBAG.Pand.${e.buildingId}`);
  const filters=(layers:string[])=>Object.fromEntries(layers.map(id=>[id,m.getFilter(id)??null]));
  const camera=()=>({center:m.getCenter().toArray(),zoom:m.getZoom(),pitch:m.getPitch(),bearing:m.getBearing()});
  const groups=()=>Object.fromEntries(groupNames.map((name,i)=>[name,{
   enabled:groupValues[i].filter((layer:any)=>layer.enabled).length,
   total:groupValues[i].length,
   resident:groupValues[i].reduce((sum:number,layer:any)=>sum+(layer.debugResident??0),0),
   resourceKeys:groupValues[i].flatMap((layer:any)=>[...(layer.resources?.keys?.()??[])]).sort()
  }]));
  const filterHas=(value:any,wanted:any):boolean=>JSON.stringify(value)===JSON.stringify(wanted)||Array.isArray(value)&&value.some(part=>filterHas(part,wanted));
  const ownerFilter=(value:any,id:string)=>filterHas(value,['==',['get','id'],id]);
  const exclusion=(value:any)=>filterHas(value,['!',['in',['get','id'],['literal',eligibleIds]]]);
  const settle=()=>new Promise(resolve=>setTimeout(resolve,450));

  // Capture the ordinary index-11/oblique/preview state for exact filter and
  // renderer restoration checks after isolation has been exited.
  await d.show(11,true);await d.setMode('preview');await settle();
  const ordinary11={filters:filters([...buildingLayers,...trialLayers]),groups:groups(),renderMaterial:d.data.entries[11].renderMaterialId??d.data.entries[11].materialId};

  await d.show(17,false);await d.setMode('current');
  const before17={camera:camera(),light:m.getLight(),filters:filters([...buildingLayers,...trialLayers]),renderMaterial:d.data.entries[17].renderMaterialId??d.data.entries[17].materialId};
  await d.setIsolation(true);await settle();
  const isolated17={state:d.state(),camera:camera(),light:m.getLight(),filters:filters([...buildingLayers,...trialLayers]),groups:groups()};
  await d.setMode('preview');await settle();
  const preview17={state:d.state(),trialVisible:m.getLayoutProperty('wall-material-trial','visibility'),filters:filters([...buildingLayers,...trialLayers]),groups:groups(),light:m.getLight(),demoLight:d.light};

  // An admitted unknown and a non-gate building must never acquire a trial
  // wall/cap. They still retain their original owner extrusion in isolation.
  const withheldResult=await d.show(10,false);await settle();
  const withheld10={state:d.state(),rendered:withheldResult.rendered,trial:filters(trialLayers),base:filters(buildingLayers)};
  const nonGateResult=await d.show(12,false);await settle();
  const nonGate12={state:d.state(),rendered:nonGateResult.rendered,trial:filters(trialLayers),base:filters(buildingLayers)};

  await d.show(11,true);await d.setMode('current');await d.setMode('preview');await settle();
  const beforePan=camera();
  const moved=new Promise(resolve=>m.once('moveend',resolve));m.panBy([12,-8],{duration:0});await moved;await settle();
  const afterPan={camera:camera(),state:d.state(),filters:filters([...buildingLayers,...trialLayers]),groups:groups()};
  await d.setIsolation(false);await settle();
  // Let the ordinary detail streams repopulate after setEnabled(false) cleared
  // their resident geometry. A tiny pan remains inside the same map area.
  await new Promise<void>(resolve=>{
   const deadline=Date.now()+20000;
   const poll=()=>{
    const restored=groups();
    const ready=Object.entries(ordinary11.groups).every(([name,before]:any)=>{
     const now=(restored as any)[name];
     return now.enabled===before.enabled&&((now.resident>0)===(before.resident>0))&&before.resourceKeys.every((key:string)=>now.resourceKeys.includes(key));
    });
    if(ready||Date.now()>deadline)resolve();else setTimeout(poll,200);
   };poll();
  });
  return{owner17:ownerId(17),owner10:ownerId(10),owner12:ownerId(12),eligibleIds,before17,isolated17,preview17,withheld10,nonGate12,beforePan,afterPan,restored:{state:d.state(),camera:camera(),light:m.getLight(),filters:filters([...buildingLayers,...trialLayers]),groups:groups()},ordinary11};
 });

 const exactOwner=(filter:any,id:string)=>JSON.stringify(filter).includes(JSON.stringify(['==',['get','id'],id]));
 const hasEligibleGate=(filter:any)=>JSON.stringify(filter).includes(JSON.stringify(['in',['get','id'],['literal',result.eligibleIds]]));
 expect(result.before17.camera).toEqual(result.isolated17.camera);
 expect(result.before17.light).toEqual(result.isolated17.light);
 expect(result.before17.renderMaterial).toBe('palecreamrender');
 expect(result.ordinary11.renderMaterial).toBe('creamrender');
 expect(result.isolated17.state).toMatchObject({selected:17,mode:'current',isolated:true});
 for(const layer of ['osm-colored-buildings','osm-colored-building-ground-floors','osm-colored-building-roofs'])
  expect(exactOwner(result.isolated17.filters[layer],result.owner17),`${layer} is restricted to owner 17`).toBe(true);
 for(const layer of ['wall-material-trial','wall-material-trial-caps']){
  expect(exactOwner(result.isolated17.filters[layer],result.owner17)).toBe(true);
  expect(hasEligibleGate(result.isolated17.filters[layer])).toBe(true);
 }
 for(const group of Object.values(result.isolated17.groups) as any[]){expect(group.enabled).toBe(0);}

 expect(result.preview17.state).toMatchObject({selected:17,mode:'preview',isolated:true});
 expect(result.preview17.trialVisible).toBe('visible');
 expect(result.preview17.light).toEqual(result.preview17.demoLight);
 for(const layer of ['osm-colored-buildings','osm-colored-building-ground-floors','osm-colored-building-roofs'])
  expect(JSON.stringify(result.preview17.filters[layer])).toContain(JSON.stringify(['!',['in',['get','id'],['literal',result.eligibleIds]]]));
 for(const group of Object.values(result.preview17.groups) as any[]){expect(group.enabled).toBe(0);}

 expect(result.withheld10.state).toMatchObject({selected:10,isolated:true});
 expect(result.withheld10.rendered).toBe(false);
 for(const layer of ['wall-material-trial','wall-material-trial-caps']){
  expect(exactOwner(result.withheld10.trial[layer],result.owner10)).toBe(true);
  expect(hasEligibleGate(result.withheld10.trial[layer])).toBe(true);
 }
 for(const layer of ['osm-colored-buildings','osm-colored-building-ground-floors','osm-colored-building-roofs'])
  expect(exactOwner(result.withheld10.base[layer],result.owner10)).toBe(true);
 expect(result.nonGate12.state).toMatchObject({selected:12,isolated:true});
 expect(result.nonGate12.rendered).toBe(false);
 for(const layer of ['wall-material-trial','wall-material-trial-caps']){
  expect(exactOwner(result.nonGate12.trial[layer],result.owner12)).toBe(true);
  expect(hasEligibleGate(result.nonGate12.trial[layer])).toBe(true);
 }
 expect(result.afterPan.state).toMatchObject({selected:11,mode:'preview',oblique:true,isolated:true});
 expect(result.afterPan.camera.center).not.toEqual(result.beforePan.center);
 for(const group of Object.values(result.afterPan.groups) as any[]){expect(group.enabled).toBe(0);}

 expect(result.restored.state).toMatchObject({selected:11,mode:'preview',oblique:true,isolated:false});
 expect(result.restored.camera).toEqual(result.afterPan.camera);
 expect(result.restored.filters).toEqual(result.ordinary11.filters);
 for(const [name,before] of Object.entries(result.ordinary11.groups) as any){
  const after=result.restored.groups[name];
  expect(after.enabled,`${name} enabled renderer count`).toBe(before.enabled);
  expect((after.resident>0),`${name} residency returned`).toBe(before.resident>0);
  for(const key of before.resourceKeys)expect(after.resourceKeys,`${name} restored resource ${key}`).toContain(key);
 }
 expect(errors).toEqual([]);
});
