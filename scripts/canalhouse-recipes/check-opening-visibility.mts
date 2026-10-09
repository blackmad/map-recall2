/** First-hit checks against each actual native owner, without WebGL or neighbors. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {compileCanalHouseRecipe,type CanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
import {sourceOccludingFlights,acknowledgedFlightHit,sourceOccludingRails,acknowledgedRailHit} from './opening-occlusion.ts';
const option=(key:string)=>process.argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3);
const input=option('input'),output=option('output'),houses=option('houses')?.split(',');
const selectedOpenings=option('openings')?.split(','),upperPanes=process.argv.includes('--upper-panes');
if(upperPanes&&!selectedOpenings?.length)throw Error('Upper-pane checks require explicit --openings=id1,id2');
if(!input||!houses?.length)throw Error('Use --input=expanded-recipes.json --houses=id1,id2 [--output=report.json]');
const book=JSON.parse(await fs.readFile(input,'utf8')),checks:{houseId:string;id:string;firstName:string|null;surface:string|null;passed:boolean;sourceAcknowledgedOcclusion?:boolean}[]=[];
for(const id of houses){
 const entries=book.entries.filter((e:{recipe:CanalHouseRecipe})=>e.recipe.id===id);assert.equal(entries.length,1,'Missing/ambiguous selected owner');
 const recipe=entries[0].recipe as CanalHouseRecipe,{group}=compileCanalHouseRecipe(recipe);
 const found=new Set<string>();
 for(const elevation of recipe.elevations){
  const facade=group.children.find(g=>g.name===`elevation/${elevation.id}`)!;assert(facade);
  const normal=new T.Vector3(0,0,1).transformDirection(facade.matrixWorld);
  const probe=(id:string,x:number,y:number,z:number,prefix:string)=>{
   const target=new T.Vector3(x,y,z).applyMatrix4(facade.matrixWorld),hit=new T.Raycaster(target.clone().addScaledVector(normal,10),normal.clone().negate()).intersectObject(group,true)[0];
   const check:(typeof checks)[number]={houseId:recipe.id,id,firstName:hit?.object.name??null,surface:hit?.object.userData.surface??null,passed:hit?.object.name.startsWith(prefix)??false};checks.push(check);return check;
  };
  for(const o of elevation.openings.value){
   if(selectedOpenings&&!selectedOpenings.includes(o.id))continue;
   found.add(o.id);
   if(upperPanes){
    assert.equal(o.kind,'window','Upper-pane checks require windows');
    for(const x of [.24,.76])for(const y of [.70,.85]){
     const check=probe(`${o.id}/upper-${x}-${y}`,o.leftM+o.widthM*x,o.bottomM+o.heightM*y,0,`opening/${o.id}/pane`);
     check.passed=check.passed&&check.surface==='glass';
    }
    continue;
   }
   const primary=probe(o.id,o.leftM+o.widthM*.24,o.bottomM+o.heightM*.2,0,`opening/${o.id}/`),flights=sourceOccludingFlights(elevation,o.id),rails=sourceOccludingRails(elevation,o.id);
   const acknowledged=(name:string|null)=>acknowledgedFlightHit(name,flights)||acknowledgedRailHit(name,rails);
   if(!primary.passed&&acknowledged(primary.firstName)){
    const exposed=[.24,.76].map(x=>probe(o.id+'/exposed-'+x,o.leftM+o.widthM*x,o.bottomM+o.heightM*.85,0,`opening/${o.id}/`));
    // Retain the blocked probe as evidence. At least one higher point must hit
    // this opening's actual pane; source acknowledgement never permits a blank wall.
    const visible=exposed.some(c=>c.passed&&(c.surface==='glass'||c.surface==='door'));
    primary.sourceAcknowledgedOcclusion=visible;
    if(visible)for(const c of exposed)if(!c.passed)c.sourceAcknowledgedOcclusion=acknowledged(c.firstName);
   }
  }
  if(!selectedOpenings)for(const d of elevation.dormers?.value??[])probe(`dormer/${d.id}`,d.leftM+d.widthM*.24,d.bottomM+d.heightM*.2,-(d.setbackM??0),`dormer/${d.id}/`);
 }
 for(const opening of selectedOpenings??[])assert(found.has(opening),`Missing selected opening ${opening} on ${id}`);
}
assert(checks.length>0,'No actual opening checks');
const failures=checks.filter(c=>!c.passed&&!c.sourceAcknowledgedOcclusion),occluded=checks.filter(c=>c.sourceAcknowledgedOcclusion);
const report={status:failures.length?'first-hit-checks-failed':occluded.length?'first-hit-checks-pass-with-source-occlusions':'first-hit-checks-pass',scope:upperPanes?'Four upper-pane points per explicitly selected window; own glass must be first hit, without source occlusion exceptions. Not full aperture, neighbors or gameplay acceptance':'Representative points against isolated native owners; explicitly observed flight/rail occlusion additionally requires exposed glazing. Not full aperture, neighbors or gameplay acceptance',generatedAt:new Date().toISOString(),checks};
if(output)await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.length,sourceAcknowledgedOcclusions:occluded,failures}));if(report.status==='first-hit-checks-failed')process.exitCode=1;
