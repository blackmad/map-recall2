/** Explicit reviewed source class. No photographed building IDs are recipe inputs. */
import fs from 'node:fs/promises';
import { sha256 } from './pipeline.ts';
import { validateStreetAppearanceCatalog, type StreetAppearanceProfile } from '../../src/canalRecall/streetAppearance.ts';
const source=JSON.parse(await fs.readFile('artifacts/street-appearance/retry/7/source/manifest.json','utf8'));
const ids=['TMX7316010203-000227_pano_0000_000671','TMX7316010203-000709_pano_0000_001508'];
const evidence=[];
for(const id of ids){
  const e=source.evidence.find((item:any)=>item.id===id);if(!e)throw Error(`Missing admitted source ${id}`);
  if(sha256(await fs.readFile(e.cropFile))!==e.cropSha256||sha256(await fs.readFile(e.sourceFile))!==e.sourceSha256)throw Error(`Source hash mismatch ${id}`);
  evidence.push({id,kind:'municipal-panorama' as const,captureDate:e.captureDate,sha256:e.cropSha256,url:e.sourceUrl,panoramaId:id,inference:'agent-visual-review' as const,quality:.92,notes:'Brown narrow historical-looking pair beside pale modern modules; neck and point crown, pale framed tall subdivided glazing. Appearance observation preserves 1992 BAG fact. Source: retry12/source-plan.md; exact registration and counts secondary.'});
}
const a=[4.89819,52.371758],b=[4.898948,52.371522];
const length=Math.hypot((b[0]-a[0])*111320*Math.cos(a[1]*Math.PI/180),(b[1]-a[1])*110540);
const at=(m:number):[number,number]=>[a[0]+(b[0]-a[0])*m/length,a[1]+(b[1]-a[1])*m/length];
const profile:StreetAppearanceProfile={id:'bethanienstraat-observed-historic-pair',streetName:'Bethaniënstraat',revision:'',segment:[at(10),at(27)],side:-1,reachM:12,confidence:.92,assemblyM:6,status:'reviewed',visualClass:{kind:'historic-frontage',constructionYearPolicy:'source-visual',sourceEvidenceIds:ids},evidence,recipes:['neck','plain'].map((crownShape,index)=>({weight:1,heightMin:8,heightMax:14,frontageMin:4,frontageMax:6.5,recipe:{family:'masonry',period:'canal',balconyPolicy:'assembly-only',detailPolicy:'architectural',crownShape:crownShape as 'neck'|'plain',wallHex:index?'#765044':'#704b3e',frameHex:'#dfd8c6',groundWallHex:'#c9c4b4',windowWidth:.64,windowHeight:.72,windowProportions:'tall',frameColor:'pale',lintel:'flat',paleAccents:false,sash:'six-over-six',bayScale:1,storeyScale:1,groundScale:1,trimDensity:'restrained',wallMaterial:'brick',atticWindows:true,trim:{frames:.9,lintels:.3,cornice:.6,courses:.1,quoins:0,arches:0},confidence:.9}}))};
profile.revision=sha256(JSON.stringify(profile)).slice(0,16);
validateStreetAppearanceCatalog({schemaVersion:1,revision:profile.revision,profiles:[profile]});
await fs.writeFile('public/data/street-appearance/source-visual-profiles.json',JSON.stringify({schemaVersion:1,profiles:[profile],sourceManifest:'artifacts/street-appearance/retry/7/source/manifest.json',sourceManifestSha256:sha256(JSON.stringify(source,null,2)+'\n')},null,2)+'\n');
console.log(`Compiled source visual class ${profile.id}; ${profile.revision}`);
