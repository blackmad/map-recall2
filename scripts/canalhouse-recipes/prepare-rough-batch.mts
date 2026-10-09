/** Offline batch preparation: cached originals are preserved; no downloading or shared generator edits. */
import fs from 'node:fs/promises';
import {extractRoofPlanes,extractFacadeWallPlanes} from '../../src/canalRecall/building/facadePointCloud.ts';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
const option=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const P=option('stage'),stationsFile=option('stations');
const houses=option('houses')?.split(',').map(Number),suffixes=option('camera-suffixes')?.split(',');
if(!P||!stationsFile||!houses?.length||houses.some(n=>!Number.isInteger(n))||suffixes?.length!==houses.length)throw Error('Use --stage=<cached-directory> --houses=453,455,457 --stations=<cached-stations.json> --camera-suffixes=00518,00516,00515');
const stations=JSON.parse(await fs.readFile(stationsFile,'utf8'))._embedded.panoramas;
// Explicit source-selected endpoints support bends and separate fronts under
// one Pand. The legacy southwest heuristic is only a discovery candidate.
const frontsFile=option('fronts');
const selectedFronts=frontsFile?JSON.parse(await fs.readFile(frontsFile,'utf8')):{};
for(const [index,n] of houses.entries()) {
 const station=suffixes[index];const camera=stations.find((c:any)=>c.pano_id.endsWith(station));
 if(!camera)throw Error(`No cached panorama station ${station} for ${n}`);
 const cr=lngLatToRd(camera.geometry.coordinates);
 const raw=JSON.parse(await fs.readFile(`${P}/${n}-3dbag.json`,'utf8'));const vbo=JSON.parse(await fs.readFile(`${P}/${n}-vbo.json`,'utf8'));
 const pandIds=[...new Set<string>((vbo._links?.ligtInPanden??[]).map((p:any)=>p.identificatie))];
 if(pandIds.length!==1)throw Error(`Herengracht ${n} belongs to ${pandIds.length} physical Panden; select a supported physical scope before preparing a recipe`);
 const id=pandIds[0],canonicalId=`NL.IMBAG.Pand.${id}`;
 if(!Object.keys(raw.feature.CityObjects).some(key=>key===canonicalId||key.startsWith(canonicalId+'-')))throw Error(`Foreign 3DBAG survey for Herengracht ${n}`);
 const t=raw.metadata.transform;const verts=raw.feature.vertices.map((p:number[])=>p.map((x,i)=>x*t.scale[i]+t.translate[i]));let polys:any[]=[];
 const roofs=extractRoofPlanes(raw),walls=extractFacadeWallPlanes(raw);
 for(const o of Object.values(raw.feature.CityObjects) as any[])for(const g of o.geometry??[])if(String(g.lod)==='2.2')for(let si=0;si<g.boundaries.length;si++)for(let j=0;j<g.boundaries[si].length;j++){
  const sem=g.semantics.surfaces[g.semantics.values[si][j]],rings=g.boundaries[si][j].map((r:number[])=>r.map(i=>verts[i]));
  if(sem.type==='GroundSurface')polys.push(rings.map((r:number[][])=>r.map(p=>p.slice(0,2))));
  if(sem.type==='RoofSurface'){const match=roofs.find(r=>r.surfaceId.endsWith(`roof:${j}`));if(match)(match as any).ringsRD=rings;}
 }
 const edges=polys.flatMap((poly,i)=>poly[0].map((a:number[],j:number)=>{const b=poly[0][(j+1)%poly[0].length];return {a,b,i,j,len:Math.hypot(b[0]-a[0],b[1]-a[1]),score:(a[0]+b[0]+a[1]+b[1])/2}})).filter((e:any)=>e.len>2&&Math.abs((e.b[0]-e.a[0])+(e.b[1]-e.a[1]))<1);
 edges.sort((a:any,b:any)=>a.score-b.score);
 const selected=selectedFronts[String(n)];
 if(selected&&(!Array.isArray(selected)||selected.length!==2||selected.some((p:any)=>!Array.isArray(p)||p.length!==2||p.some((v:any)=>!Number.isFinite(v)))))throw Error(`Invalid source-selected frontage for ${n}`);
 const front=selected?{a:selected[0],b:selected[1],len:Math.hypot(selected[1][0]-selected[0][0],selected[1][1]-selected[0][1]),selection:'explicit source endpoints'}:edges[0];
 if(!front)throw Error(`No supported southwest frontage for Herengracht ${n}; source selection required`);
 if(selected){
  if(front.len<=0||selected.some((p:number[])=>!polys.some(poly=>poly[0].some((v:number[])=>Math.hypot(v[0]-p[0],v[1]-p[1])<1e-5))))throw Error(`Frontage endpoints for ${n} must be original surveyed vertices`);
 }else if(front.a[0]>front.b[0])[front.a,front.b]=[front.b,front.a];
 const mx=(front.a[0]+front.b[0])/2,my=(front.a[1]+front.b[1])/2,heading=(Math.atan2(mx-cr.x,my-cr.y)*180/Math.PI+360)%360;
 const attrs=(Object.values(raw.feature.CityObjects) as any[])[0].attributes;
 const survey={id:`herengracht-${n}`,bagId:id,attributes:attrs,roofsRD:roofs,facadeWallsRD:walls,surveyFootprintPolygonsRD:polys};await fs.writeFile(`docs/references/canalhouse-recipes/herengracht-${n}-survey.json`,JSON.stringify(survey,null,2));await fs.writeFile(`${P}/${n}-front.json`,JSON.stringify({front,camera,heading},null,2));
 await fs.writeFile(`${P}/${n}-front.jpg`,perspectiveCrop(await fs.readFile(`${P}/${n}-current.jpg`),heading,1100,1500,75,27));
 console.log(JSON.stringify({house:n,pandId:id,front,groundNapM:attrs.b3_h_maaiveld,roofSurfaces:roofs.length,wallSurfaces:walls.length,acceptance:'none-source-preparation-only'}));
}
