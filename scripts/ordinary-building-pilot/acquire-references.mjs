import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const pack=path.resolve(process.argv[2] ?? '../map-recall2-source-data/experiments/large-ordinary-fast-pass');
fs.mkdirSync(pack+'/raw',{recursive:true});
const requests=[];
function get(url,file){const out=path.join(pack,'raw',file);const at=new Date().toISOString();if(!fs.existsSync(out))execFileSync('curl',['--silent','--show-error','--fail','--retry','2','--max-time','60',url,'-o',out]);requests.push({url,file:'raw/'+file,checkedAt:at,sha256:createHash('sha256').update(fs.readFileSync(out)).digest('hex')});return out;}
const api='https://api.data.amsterdam.nl/panorama/panoramas/?near=4.927738,52.3757945&radius=85&srid=4326&page_size=100';
let url=api,items=[],page=1;
while(url&&page<=5){const d=JSON.parse(fs.readFileSync(get(url,`kattenburg-history-page-${page}.json`)));items.push(...d._embedded.panoramas);url=d._links.next?.href;page++;}
console.log('history',items.length,'complete',!url,'years',[...new Set(items.map(i=>i.mission_year))].sort());
const fixtures=[{id:'0363100012118320',target:[4.92779,52.3759],cameraTarget:[4.92794,52.37612]},{id:'0363100012139498',target:[4.92638,52.376],cameraTarget:[4.92665,52.37628]}];
const picks=[];
for(const f of fixtures){fs.copyFileSync(`public/canal-drive/ordinary-building-pilot-data/NL.IMBAG.Pand.${f.id}.json`,`${pack}/raw/building-${f.id}.json`);for(const year of ['2025','2020']){const all=items.filter(i=>String(i.mission_year)===year);all.sort((a,b)=>dist(a.geometry.coordinates,f.cameraTarget)-dist(b.geometry.coordinates,f.cameraTarget));if(!all[0])continue;const p=all[0];const u=p._links.equirectangular_full.href;get(u,p.pano_id+'.jpg');picks.push({...f,year,panorama:p,file:'raw/'+p.pano_id+'.jpg'});console.log(f.id,year,p.pano_id,p.geometry.coordinates);}}
function dist(a,b){return Math.hypot((a[0]-b[0])*68000,(a[1]-b[1])*111320);}
fs.writeFileSync(pack+'/selected-views.json',JSON.stringify(picks,null,2));
fs.writeFileSync(pack+'/acquisition.json',JSON.stringify({checkedAt:new Date().toISOString(),api,historyComplete:!url,count:items.length,years:[...new Set(items.map(i=>i.mission_year))].sort(),requests,license:'Municipal source attribution; confirm current catalogue licensing before distributing original imagery.'},null,2));
