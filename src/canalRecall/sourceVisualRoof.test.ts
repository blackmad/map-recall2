import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decorateFacade } from './genericFacades.ts';
import { decorateRoof, roofTriangles, roofTrianglesForOutline, roofPlanForFeature } from './roofMesh.ts';
import { streetCrown } from './streetCrown.ts';
import { sourceVisualRoof } from './sourceVisualRoof.ts';
import { meshBuildingFor, type Feature } from './threeBuildingFeatures.ts';
import type { StreetAppearanceProfile } from './streetAppearance.ts';
import type { MeshBuilding } from './threeBuildingMesh.ts';
const native=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8414/5384.geojson.gz')).toString());
function surveyedFront(f:Feature){
 const ring=(f.geometry as any).coordinates[0] as number[][],kx=111320*Math.cos(ring[0][1]*Math.PI/180);
 const edges=ring.slice(0,-1).map((a,i)=>({start:a as [number,number],end:ring[i+1] as [number,number],widthM:Math.hypot((ring[i+1][0]-a[0])*kx,(ring[i+1][1]-a[1])*110540)})).filter(e=>e.widthM>=3.6).sort((a,b)=>a.widthM-b.widthM);
 return edges[0];
}
const data={features:native.features.map((f:Feature)=>decorateRoof(decorateFacade({...f,properties:{...f.properties,constructionYear:1992,appearanceStyleSource:'citywide-identity-palette-v3-not-measured'}})))};
const profile:StreetAppearanceProfile={id:'reviewed-pair',streetName:'Bethaniënstraat',revision:'test',segment:[[4.8983,52.37172],[4.8986,52.37162]],side:-1,reachM:12,confidence:.9,assemblyM:6,status:'reviewed',visualClass:{kind:'historic-frontage',constructionYearPolicy:'source-visual',sourceEvidenceIds:['view']},evidence:[{id:'view',kind:'municipal-panorama',sha256:'a'.repeat(64),captureDate:'2018-01-01',panoramaId:'station',url:'https://t1.data.amsterdam.nl/panorama/view.jpg',quality:.9,inference:'agent-visual-review',notes:'Independent observed historical fronts.'}],recipes:['neck','plain'].map(shape=>({weight:1,heightMin:8,heightMax:14,frontageMin:4,frontageMax:6.5,recipe:{family:'masonry',period:'canal',crownShape:shape as 'neck'|'plain',confidence:.9}})),frontages:['2178531','2178209'].map((suffix,recipeIndex)=>({buildingId:'NL.IMBAG.Pand.036310001'+suffix,recipeIndex,frontage:{...surveyedFront(native.features.find((f:Feature)=>String(f.properties.id).endsWith(suffix))),widthM:recipeIndex?5.87:4.65}}))};
test('native retained-front crowns share coherent eaves and preserve factual source/total height in every look',()=>{
 for(const front of profile.frontages!){
  const f:Feature=data.features.find((f:Feature)=>f.properties.id===front.buildingId),original=JSON.stringify(f);
  const result=sourceVisualRoof(f,[profile]);assert.ok(result);
  assert.equal(result.plan.gable,profile.recipes[front.recipeIndex].recipe.crownShape);
  assert.equal(result.feature.properties.constructionYear,1992);assert.equal(result.feature.properties.height,f.properties.height);assert.deepEqual(result.feature.geometry,f.geometry);
  assert.equal(Number(result.feature.properties.roofEavesHeightM)+result.plan.riseM,f.properties.height);
  for(const look of ['photo','procedural','cartoon','storybook','untextured'] as const){const building:MeshBuilding=meshBuildingFor(result.feature,look,false,result.plan)!;assert.equal(building.roof!.plan,result.plan);assert.equal(building.heightM,Number(f.properties.height)-result.plan.riseM);}
  assert.equal(JSON.stringify(f),original);
 }
});
test('source roof prior preserves measured/tagged/curated geometry and modern neighbors',()=>{
 const f:Feature=data.features.find((f:Feature)=>f.properties.id===profile.frontages![0].buildingId);
 for(const props of [{roofPlanned:false,roofEavesHeightM:8},{roofShapeTag:'hipped'},{kitWall:true},{frontCarrier:true},{facadeMappedColour:'#123456'},{height:35}])assert.equal(sourceVisualRoof({...f,properties:{...f.properties,...props}},[profile]),undefined);
 const hole={...f,geometry:{...(f.geometry as object),coordinates:[...(f.geometry as any).coordinates,(f.geometry as any).coordinates[0]]}};assert.equal(sourceVisualRoof(hole,[profile]),undefined);
 const modern:Feature=data.features.find((f:Feature)=>String(f.properties.id).endsWith('2178208'));assert.equal(sourceVisualRoof(modern,[profile]),undefined);
 assert.equal(sourceVisualRoof(f,[{...profile,visualClass:{...profile.visualClass!,sourceEvidenceIds:['missing']}}]),undefined);
});

test('Oudezijds native row crowns fit source heights and keep explicit register families across roof shapes',()=>{
  for(const suffix of ['2177980','2177977','2178004','2177990'])for(const shape of ['neck','bell','cornice','plain'] as const){
    const raw:Feature=native.features.find((f:Feature)=>String(f.properties.id).endsWith(suffix));
    const f:Feature={...raw,properties:{...raw.properties,facade:true,facadeStyle:'canal',constructionYear:1992}};
    const rowProfile:StreetAppearanceProfile={...profile,recipes:[{weight:1,recipe:{family:'masonry',period:'canal',crownShape:shape,crownTrim:true,frameHex:'#e6e1d4',confidence:.9}}],frontages:[{buildingId:String(f.properties.id),recipeIndex:0,frontage:surveyedFront(f)}]};
    const result=sourceVisualRoof(f,[rowProfile]);assert.ok(result);assert.equal(result.plan.gable,shape);
    for(const piece of result.plan.pieces!){
      const triangles=roofTriangles(piece.rect,piece.plan,Number(result.feature.properties.roofEavesHeightM),{bayM:2,storeyM:3,cellM:1});
      assert.ok(triangles.length);for(const t of triangles)for(const v of t.p)assert.ok(v[2]<=Number(f.properties.height)+1e-7,'actual plates/trim/roof must stay within native source total');
      const plates=triangles.filter(t=>t.part==='plate');assert.ok(plates.some(t=>t.p.some(v=>Math.abs(v[2]-Number(result.feature.properties.roofEavesHeightM))<1e-7)),'masonry crown meets wall eaves');
    }
    assert.equal(result.feature.geometry,raw.geometry);assert.equal(result.feature.properties.constructionYear,1992);
    const registered=sourceVisualRoof({...f,properties:{...f.properties,monumentGable:'clock'}},[rowProfile]);assert.equal(registered?.plan.gable,'clock');
  }
});

test('native source crowns preserve rotated/reversed surveyed rings and every emitted normal',()=>{
 const raw:Feature=native.features.find((f:Feature)=>String(f.properties.id).endsWith('2177980'));
 const ring=(raw.geometry as any).coordinates[0] as number[][],[lng0,lat0]=ring[0],kx=111320*Math.cos(lat0*Math.PI/180),ky=110540;
 for(const angle of [.71,2.1])for(const reverse of [false,true]){
  const transformed=ring.map(([lng,lat])=>{const x=(lng-lng0)*kx,y=(lat-lat0)*ky;return [lng0+(x*Math.cos(angle)-y*Math.sin(angle))/kx,lat0+(x*Math.sin(angle)+y*Math.cos(angle))/ky];});
  if(reverse)transformed.reverse();
  const f:Feature={...raw,properties:{...raw.properties,facade:true,facadeStyle:'canal'},geometry:{type:'Polygon',coordinates:[transformed]}};
  const rowProfile:StreetAppearanceProfile={...profile,recipes:[{weight:1,recipe:{family:'masonry',period:'canal',crownShape:'bell',crownTrim:true,confidence:.9}}],frontages:[{buildingId:String(f.properties.id),recipeIndex:0,frontage:surveyedFront(f)}]};
  const result=sourceVisualRoof(f,[rowProfile]);assert.ok(result);assert.deepEqual(result.feature.geometry,f.geometry);
  for(const {rect,plan}of result.plan.pieces!){
   const triangles=roofTriangles(rect,plan,Number(result.feature.properties.roofEavesHeightM),{bayM:2,storeyM:3,cellM:1});
   for(const t of triangles){const [a,b,c]=t.p,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    assert.ok(cross.reduce((sum,v,i)=>sum+v*t.n[i],0)>0,'transformed normal agrees with winding');
    for(const v of t.p)assert.ok(v[2]<=Number(f.properties.height)+1e-7);
   }
  }
 }
});

test('concave native roof crowns stand on the admitted source wall despite unsupported inscribed ends',()=>{
 const raw:Feature=native.features.find((f:Feature)=>String(f.properties.id).endsWith('2172010'));
 const f:Feature={...raw,properties:{...raw.properties,facade:true,facadeStyle:'canal',monumentGable:'cornice'}};
 const ring=(f.geometry as any).coordinates[0] as [number,number][],kx=111320*Math.cos(ring[0][1]*Math.PI/180);
 const front={start:ring[3],end:ring[4],widthM:Math.hypot((ring[4][0]-ring[3][0])*kx,(ring[4][1]-ring[3][1])*110540)};
 const row:StreetAppearanceProfile={...profile,recipes:[{weight:1,recipe:{family:'masonry',period:'canal',crownShape:'cornice',crownWindows:'paired-oculi',crownTrim:true,confidence:.9}}],frontages:[{buildingId:String(f.properties.id),recipeIndex:0,frontage:front}],registerCrowns:[{buildingId:String(f.properties.id),shape:'bell',sourceUrl:'https://monumentenregister.cultureelerfgoed.nl/monumenten/1',sourceSnapshotSha256:'a'.repeat(64)}]};
 const result=sourceVisualRoof(f,[row]);assert.ok(result);assert.equal(result.plan.gable,'bell','explicit source register corrects legacy family');
 const wallTop=Number(result.feature.properties.roofEavesHeightM),triangles=roofTrianglesForOutline(ring,{lng:ring[0][0],lat:ring[0][1]},result.plan,wallTop,{bayM:2,storeyM:3,cellM:1},kx);
 const nativeXY=ring.map(([lng,lat])=>[(lng-ring[0][0])*kx,(lat-ring[0][1])*110540]);
 const inside=([x,y]:number[])=>{let hit=false;for(let i=0,j=nativeXY.length-1;i<nativeXY.length;j=i++){const a=nativeXY[j],b=nativeXY[i],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;if(length2){const fraction=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length2));if(Math.hypot(x-a[0]-fraction*dx,y-a[1]-fraction*dy)<1e-6)return true;}if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 for(const t of triangles){
   if(t.part==='slope')for(const vertex of t.p)assert.ok(inside(vertex),'generated slopes remain inside actual concave surveyed footprint');
   const [a,b,c]=t.p,ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
   assert.ok(cross.reduce((sum,v,i)=>sum+v*t.n[i],0)>1e-9,`clipped ${t.part} dot=${cross.reduce((sum,v,i)=>sum+v*t.n[i],0)} normal=${t.n} vertices=${JSON.stringify(t.p)}`);
 }
 const plates=triangles.filter(t=>t.part==='plate'&&t.sourceCrownShape==='bell');assert.ok(plates.length,'source front remains decorated when inscribed gableEnds are false');
 const start=[(front.start[0]-ring[0][0])*kx,(front.start[1]-ring[0][1])*110540],end=[(front.end[0]-ring[0][0])*kx,(front.end[1]-ring[0][1])*110540];
 const dx=end[0]-start[0],dy=end[1]-start[1],w=Math.hypot(dx,dy),normal=result.plan.sourceCrownFront!.normal;
 for(const t of triangles)for(const v of t.p)assert.ok(v[2]<=Number(f.properties.height)+1e-7);
 for(const t of plates)for(const [x,y,z]of t.p){const along=((x-start[0])*dx+(y-start[1])*dy)/w,depth=(x-start[0])*normal[0]+(y-start[1])*normal[1];assert.ok(along>=-1e-7&&along<=w+1e-7);assert.ok(depth<=1e-7&&depth>=-.33);assert.ok(z>=wallTop-1e-7);}
 assert.ok(plates.some(t=>t.p.some(p=>Math.abs(p[2]-wallTop)<1e-7)),'entire front assembly grows from wall eaves');
 const crowned=streetCrown(triangles,[{start:start as [number,number],end:end as [number,number],normal,tint:[50,45,40],frameHex:'#e6e1d4',glassHex:'#334455',recipe:row.recipes[0].recipe}],wallTop,true);
 assert.equal(crowned.length-triangles.length,80,'paired bell eyes survive underlying plain roof closures');
});

test('a concave cohort average recovers its actual street-facing native front instead of withholding the crown',()=>{
 const raw:Feature=native.features.find((f:Feature)=>String(f.properties.id).endsWith('2177981'));
 const f:Feature={...raw,properties:{...raw.properties,facade:true,facadeStyle:'canal',constructionYear:1988}};
 const row:StreetAppearanceProfile={...profile,segment:[[4.89949,52.3746],[4.898626,52.373866]],side:1,reachM:20,recipes:[{weight:1,recipe:{family:'masonry',period:'canal',crownShape:'cornice',crownTrim:true,confidence:.9}}],frontages:[{buildingId:String(f.properties.id),recipeIndex:0,frontage:{start:[4.899575822199,52.374504264461],end:[4.899533834053,52.374468593975],widthM:4.878185}}]};
 const result=sourceVisualRoof(f,[row]);assert.ok(result,'synthetic cohort average is not a reason to discard a valid native street wall');
 const ring=(f.geometry as any).coordinates[0] as [number,number][],kx=111320*Math.cos(ring[0][1]*Math.PI/180),carrier=result.plan.sourceCrownFront!;
 assert.deepEqual(carrier.start,[0,0]);
 assert.ok(Math.hypot(carrier.end[0]-(ring[1][0]-ring[0][0])*kx,carrier.end[1]-(ring[1][1]-ring[0][1])*110540)<1e-7,'carrier owns an actual source edge, not the averaged interior line');
 const wallTop=Number(result.feature.properties.roofEavesHeightM),triangles=roofTrianglesForOutline(ring,{lng:ring[0][0],lat:ring[0][1]},result.plan,wallTop,{bayM:2,storeyM:3,cellM:1},kx),front=triangles.filter(t=>t.sourceCrownShape==='cornice'&&t.part==='plate');
 assert.ok(front.length);assert.ok(front.some(t=>t.p.some(v=>Math.abs(v[2]-wallTop)<1e-7)),'solid cornice front connects directly to native facade eaves');
 for(const t of triangles)for(const v of t.p)assert.ok(v[2]<=Number(f.properties.height)+1e-7);
 assert.deepEqual(result.feature.geometry,f.geometry);assert.equal(result.feature.properties.constructionYear,1988);
 const other={...row,segment:[[4.901,52.3746],[4.901,52.3738]] as [[number,number],[number,number]],reachM:2};assert.equal(sourceVisualRoof(f,[other]),undefined,'recovery cannot move to an unobserved rear wall beyond admitted street reach');
});

test('ordinary cornice end plates stand on actual trapezoid walls while roof heights and details remain unchanged',()=>{
 const raw:Feature=native.features.find((f:Feature)=>String(f.properties.id).endsWith('2177996'));
 const f:Feature={...raw,properties:{...raw.properties,facade:true,facadeStyle:'canal',monumentGable:'cornice'}};
 const plan=roofPlanForFeature(f)!;assert.ok(plan);assert.equal(plan.gable,'cornice');
 const ring=(f.geometry as any).coordinates[0] as [number,number][],kx=111320*Math.cos(ring[0][1]*Math.PI/180),h0=Number(f.properties.height)-plan.riseM,dims={bayM:2,storeyM:3,cellM:1};
 const triangles=roofTrianglesForOutline(ring,{lng:ring[0][0],lat:ring[0][1]},plan,h0,dims,kx);
 const original=plan.pieces!.flatMap(p=>roofTriangles(p.rect,p.plan,h0,dims));
 assert.equal(triangles.length,original.length,'existing trim and roof detail are retained');assert.deepEqual(triangles.map(t=>t.p.map(p=>p[2])),original.map(t=>t.p.map(p=>p[2])),'survey total/eaves and all existing detail elevations unchanged');
 const a=[(ring[1][0]-ring[0][0])*kx,(ring[1][1]-ring[0][1])*110540],b=[(ring[2][0]-ring[0][0])*kx,(ring[2][1]-ring[0][1])*110540],dx=b[0]-a[0],dy=b[1]-a[1],width=Math.hypot(dx,dy),normal=[dy/width,-dx/width];
 const fronts=triangles.filter(t=>t.part==='plate'&&t.n[0]*normal[0]+t.n[1]*normal[1]>.9&&t.p.every(p=>Math.abs((p[0]-a[0])*normal[0]+(p[1]-a[1])*normal[1])<.01));
 assert.ok(fronts.length,'continuous front masonry is on the surveyed wall plane');
 for(const t of fronts)for(const [x,y,z]of t.p){const along=((x-a[0])*dx+(y-a[1])*dy)/width;assert.ok(along>=-1e-6&&along<=width+1e-6);assert.ok(z>=h0-1e-7);}
 assert.ok(fronts.some(t=>t.p.some(p=>Math.abs(p[2]-h0)<1e-7)),'cornice assembly connects to wall eaves');
 assert.deepEqual(f.geometry,raw.geometry);
});
