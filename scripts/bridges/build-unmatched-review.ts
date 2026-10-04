import { readFile,writeFile } from 'node:fs/promises';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';
import { insideBridgeOutline } from '../../src/canalRecall/bridgeSurface.ts';
const root='public/data/extracts/amsterdam/';
const read=async(file:string)=>JSON.parse(await readFile(file,'utf8'));
const [report,register,roads,catalog,pedestrian]=await Promise.all([read(root+'bridge-surface-review.json'),read('scripts/data/amsterdam-bridge-register.json'),read(root+'streets-routing.json'),read(root+'bridges.json'),read('scripts/data/amsterdam-bridge-paths.json')]);
const box=[4.865,52.367,4.891,52.385];
const near=(p:number[])=>p[0]>box[0]-.002&&p[0]<box[2]+.002&&p[1]>box[1]-.002&&p[1]<box[3]+.002;
const closed=(p:number[][])=>Math.hypot((p[0][0]-p.at(-1)![0])*68000,(p[0][1]-p.at(-1)![1])*111320)<.2;
function distance(point:number[],line:number[][]){const c=lngLatToRd(point[0],point[1]);let best=Infinity;
  for(let i=1;i<line.length;i++){const a=lngLatToRd(...line[i-1] as [number,number]),b=lngLatToRd(...line[i] as [number,number]);const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((c[0]-a[0])*dx+(c[1]-a[1])*dy)/l)):0;best=Math.min(best,Math.hypot(c[0]-a[0]-dx*t,c[1]-a[1]-dy*t));}return best;}
const paths=(rows:any[])=>rows.flatMap(r=>(r.paths||[r.path]).map((p:number[][])=>({row:r,line:p.map(([lat,lng])=>[lng,lat])})));
const routePaths=paths(roads).filter(p=>p.line.some(near)),catalogPaths=paths(catalog).filter(p=>p.line.some(near)),pedestrianPaths=paths(pedestrian.paths).filter(p=>p.line.some(near));
function overlaps(line:number[][],ring:[number,number][]){
  const points=line.map(ll=>lngLatToRd(...ll as [number,number]));
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2);
    for(let j=0;j<steps;j++)if(insideBridgeOutline([a[0]+(b[0]-a[0])*(j+.5)/steps,a[1]+(b[1]-a[1])*(j+.5)/steps],ring))return true;
  }return false;
}
const retained=['BRU0130','BRU0102','BRU0155','BRU0002','BRU0132','BRU0148','BRU0151','BRU1902','BRU2241','BRU2242'];
const examples=report.entries.filter((e:any)=>(e.status==='unmatched'||retained.includes(e.id))&&e.center[0]>box[0]&&e.center[0]<box[2]&&e.center[1]>box[1]&&e.center[1]<box[3]).map((entry:any)=>{
  const row=register.bridges.find((r:any)=>r[0]===entry.id),ring=row[7].map((p:[number,number])=>lngLatToRd(...p));
  const hits=catalogPaths.filter(p=>distance(entry.center,p.line)<30&&overlaps(p.line,ring));
  const lines=hits.filter(p=>!closed(p.line));
  const crossingRoutes=routePaths.filter(p=>!closed(p.line)&&distance(entry.center,p.line)<30&&overlaps(p.line,ring));
  const recovered=pedestrianPaths.filter(p=>p.row.bridge&&!closed(p.line)&&distance(entry.center,p.line)<30&&overlaps(p.line,ring));
  const nearest=routePaths.map(p=>({id:p.row.id,name:p.row.name,bridge:!!p.row.bridge,highway:p.row.highway,distanceM:Math.round(distance(entry.center,p.line)*10)/10})).sort((a,b)=>a.distanceM-b.distanceM).filter((p,i,all)=>all.findIndex(q=>q.id===p.id)===i).slice(0,3);
  const names=[...new Set(hits.map(p=>p.row.name))],label=names[0]||(row[6]&&entry.name.startsWith('Bridge ')?`${entry.name} · ${row[6]}`:entry.name);
  return{...entry,label,outline:row[7],material:row[3],type:row[2],street:row[6],modality:row[5],nearest,catalogMatches:names,catalogLines:lines.length,recoveredLines:recovered.length,
    routingCrossings:[...new Set(crossingRoutes.map(p=>p.row.id))],
    diagnosis:entry.status==='ready'?'Previously unmatched; now matched and rendered using the recovered crossing geometry.':entry.status!=='unmatched'?`Crossing geometry is now matched. Remaining review: ${entry.reasons.join('; ')}.`:recovered.length?'A bridge path exists in the recovered OSM source, but its alignment still needs review.':lines.length?'A crossing path exists in the separate bridge catalogue, but its alignment still needs review.':crossingRoutes.length?'Cycling-routing geometry intersects the municipal footprint, but a canal crossing could not be verified.':hits.length?'The separate bridge catalogue has an outline here, but no usable crossing centreline.':'No usable crossing path overlaps this footprint in the available OSM sources.',
    reference:hits[0]?.row.wikipediaUrl||(entry.id==='BRU0102'?'https://jordaan.info/jordaan.nl/STBRUG01.HTM':null),photo:hits[0]?.row.wikipediaImageUrl||null};
});
const preferred=['BRU0130','BRU0102','BRU0155'];examples.sort((a:any,b:any)=>(preferred.indexOf(a.id)<0?99:preferred.indexOf(a.id))-(preferred.indexOf(b.id)<0?99:preferred.indexOf(b.id)));
const features=(ps:typeof routePaths)=>({type:'FeatureCollection',features:ps.filter(p=>p.line.some(near)).map(p=>({type:'Feature',properties:{id:p.row.id,name:p.row.name,bridge:!!p.row.bridge,closed:closed(p.line)},geometry:{type:'LineString',coordinates:p.line}}))});
await writeFile(root+'unmatched-jordaan.json',JSON.stringify({version:2,unmatchedTotal:report.summary.unmatched,summary:report.summary,examples,routes:features(routePaths),catalog:features(catalogPaths),recovered:features(pedestrianPaths)},null,2)+'\n');
console.log(examples.map((e:any)=>`${e.id}: ${e.label}; catalogue centreline=${e.catalogLines}; nearest routing=${e.nearest[0]?.distanceM}m`).join('\n'));
