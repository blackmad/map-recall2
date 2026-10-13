/** Add candidates to a gallery manifest without changing game admissions. */
import fs from 'node:fs/promises';
const option=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const basePath=option('base','public/canal-drive/models/canalhouse-recipes/pilot.json');
const additionPaths=option('addition','public/canal-drive/models/canalhouse-next/pilot.json,public/canal-drive/models/canalhouse-transfer/pilot.json,public/canal-drive/models/canalhouse-rough/pilot.json').split(',');
const output=option('output','public/canal-drive/models/canalhouse-recipes/with-next.json');
const [base,...additions]=await Promise.all([basePath,...additionPaths].map(async file=>JSON.parse(await fs.readFile(file,'utf8'))));
const entries=[...base.entries,...additions.flatMap(p=>p.entries)].filter(entry=>entry.reviewStatus!=='failed-source-match'),ids=new Set<string>();
for(const entry of entries){if(!entry.id||ids.has(entry.id))throw Error('Duplicate or missing gallery candidate');ids.add(entry.id);}
const rowIds=new Set<string>(),reviewRows=[base,...additions].flatMap(p=>p.reviewRows??[]);
for(const row of reviewRows){if(!row.id||rowIds.has(row.id)||row.houseIds.some((id:string)=>!ids.has(id)))throw Error('Duplicate or unavailable gallery review row');rowIds.add(row.id);}
await fs.writeFile(output,JSON.stringify({...base,id:'canalhouse-gallery-with-candidates',title:'Source-based canalhouse row and exploratory candidates',generatedAt:new Date().toISOString(),status:'gallery-candidates-not-new-game-admissions',acceptance:{individual:false,row:false,heldouts:false,independent:false,game:false,performance:false},reviewRows,entries},null,2)+'\n');
console.log(JSON.stringify({output,houses:entries.length,additionalCandidates:additions.flatMap(p=>p.entries.map((e:{id:string})=>e.id))}));
