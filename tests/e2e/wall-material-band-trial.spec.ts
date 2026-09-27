import {expect,test} from '@playwright/test';

test('material base band is source-bound, owner-scoped, opt-in and reversible',async({page})=>{
 test.setTimeout(300_000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));

 await page.goto('/canal-drive/material-demo.html?owner=17&isolated=1');
 await page.waitForFunction(()=>(window as any).wallMaterialDemo?.ready,{},{timeout:150_000});
 expect(await page.evaluate(()=>({
  band:(window as any).wallMaterialDemo.bandTrial,
  layer:(window as any).wallMaterialDemo.map.getLayer('wall-material-trial-base')??null,
 }))).toEqual({band:null,layer:null});

 await page.goto('/canal-drive/material-demo.html?bands=1&owner=17&isolated=1');
 await page.waitForFunction(()=>(window as any).wallMaterialDemo?.ready,{},{timeout:150_000});
 const initial=await page.evaluate(()=>{
  const d=(window as any).wallMaterialDemo,m=d.map,band=d.bandTrial,entry=d.data.entries[17];
  return{
   state:d.state(),sourceMatches:band.sourceSha256===entry.sourceSha256,
   ownerMatches:band.buildingId===entry.buildingId,
   revisionMatches:band.geometryRevision===entry.geometryRevision,
   featureId:band.featureId,heightM:band.heightM,
   upperBase:m.getPaintProperty('wall-material-trial','fill-extrusion-base'),
   lowerBase:m.getPaintProperty('wall-material-trial-base','fill-extrusion-base'),
   lowerHeight:m.getPaintProperty('wall-material-trial-base','fill-extrusion-height'),
   lowerPattern:m.getPaintProperty('wall-material-trial-base','fill-extrusion-pattern'),
   lowerFilter:m.getFilter('wall-material-trial-base'),
   lowerVisibility:m.getLayoutProperty('wall-material-trial-base','visibility'),
  };
 });
 expect(initial.state).toMatchObject({selected:17,mode:'preview',isolated:true,bandTrial:17});
 expect(initial.sourceMatches&&initial.ownerMatches&&initial.revisionMatches).toBe(true);
 expect(initial.featureId).toBe('NL.IMBAG.Pand.0363100012094649');
 expect(initial.heightM).toBeGreaterThan(2.85);expect(initial.heightM).toBeLessThan(3);
 expect(initial.upperBase).toEqual(['case',['==',['get','id'],initial.featureId],initial.lowerHeight,initial.lowerBase]);
 expect(initial.lowerPattern).toBe('wall-trial-redbrick');
 expect(JSON.stringify(initial.lowerFilter)).toContain(initial.featureId);
 expect(initial.lowerVisibility).toBe('visible');

 const other=await page.evaluate(async()=>{
  const d=(window as any).wallMaterialDemo;await d.show(0,false);
  return{state:d.state(),filter:d.map.getFilter('wall-material-trial-base')};
 });
 expect(other.state).toMatchObject({selected:0,isolated:true,bandTrial:17});
 expect(JSON.stringify(other.filter)).toContain(initial.featureId);
 expect(JSON.stringify(other.filter)).toContain(`NL.IMBAG.Pand.${await page.evaluate(()=>(window as any).wallMaterialDemo.data.entries[0].buildingId)}`);

 await page.evaluate(async()=>{const d=(window as any).wallMaterialDemo;await d.show(17,false);await d.setMode('current');});
 const current=await page.evaluate(()=>{
  const d=(window as any).wallMaterialDemo,m=d.map;
  return{state:d.state(),upper:m.getLayoutProperty('wall-material-trial','visibility'),lower:m.getLayoutProperty('wall-material-trial-base','visibility'),originalFilter:m.getFilter('osm-colored-buildings')};
 });
 expect(current.state).toMatchObject({selected:17,mode:'current',isolated:true});
 expect(current.upper).toBe('none');expect(current.lower).toBe('none');
 expect(JSON.stringify(current.originalFilter)).toContain(initial.featureId);

 const restored=await page.evaluate(async()=>{
  const d=(window as any).wallMaterialDemo;await d.setIsolation(false);await d.setMode('preview');
  return{state:d.state(),filter:d.map.getFilter('osm-colored-buildings'),lower:d.map.getLayoutProperty('wall-material-trial-base','visibility')};
 });
 expect(restored.state).toMatchObject({selected:17,mode:'preview',isolated:false});
 expect(JSON.stringify(restored.filter)).not.toContain(JSON.stringify(['==',['get','id'],initial.featureId]));
 expect(restored.lower).toBe('visible');
 expect(errors).toEqual([]);
});
