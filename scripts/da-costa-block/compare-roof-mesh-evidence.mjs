/** Read-only comparison of frozen visual hypotheses with source-bound roof geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {roofGeometry} from './roof-geometry.mjs';
const root=path.resolve('.cache/da-costa-neighbourhood'),out=path.join(root,'roof-mesh-experiment-2026-09-09');
await fs.mkdir(out,{recursive:true});
const blockBytes=await fs.readFile('public/data/da-costa-block/block.json'),block=JSON.parse(blockBytes);
const frozenBytes=await fs.readFile(path.join(root,'self-review-2026-09-09/roof-findings.json')),frozen=JSON.parse(frozenBytes);
const packets=JSON.parse(await fs.readFile(path.join(root,'self-review-2026-09-09/roof-sources.json')));
const expandedBytes=await fs.readFile(path.join(root,'aerial-expanded-2026-09-09/roof-findings.json')),expanded=JSON.parse(expandedBytes);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const round=x=>Math.round(x*1000)/1000;
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function ringArea(r){let n=[0,0,0];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];n[0]+=(p[1]-q[1])*(p[2]+q[2]);n[1]+=(p[2]-q[2])*(p[0]+q[0]);n[2]+=(p[0]-q[0])*(p[1]+q[1]);}const mag=Math.hypot(...n);return {area:mag/2,normal:mag?n.map(x=>x/mag*(n[1]<0?-1:1)):[0,1,0]};}
function area2(r){let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
function inside(p,r){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const inPoly=(p,r)=>inside(p,r[0])&&!r.slice(1).some(h=>inside(p,h));
const records=[];
for(const imageFinding of frozen.records){
  const b=block.buildings.find(b=>b.id===imageFinding.buildingId),packet=packets.records.find(p=>p.id===imageFinding.id);
  const polys=b.footprint.type==='MultiPolygon'?b.footprint.coordinates:[b.footprint.coordinates];
  const points=polys.flat(2),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
  const bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
  const footprintArea=polys.reduce((sum,p)=>sum+area2(p[0])-p.slice(1).reduce((n,r)=>n+area2(r),0),0);
  const faces=b.surfaces.flatMap((s,i)=>{if(s.type!=='roof')return[];const n=ringArea(s.rings[0]),holes=s.rings.slice(1).reduce((a,r)=>a+ringArea(r).area,0),area=n.area-holes;
    const vertices=s.rings.flat(),heights=vertices.map(p=>p[1]),rings=s.rings.map(r=>r.map(p=>[p[0],p[2]])),projectedArea=Math.max(0,area2(rings[0])-rings.slice(1).reduce((a,r)=>a+area2(r),0));
    return[{surfaceIndex:i,area,projectedArea,normal:n.normal,slopeDeg:Math.acos(Math.min(1,Math.max(-1,n.normal[1])))*180/Math.PI,azimuthLocalDeg:(Math.atan2(n.normal[0],n.normal[2])*180/Math.PI+360)%360,minHeight:Math.min(...heights),maxHeight:Math.max(...heights),meanVertexHeight:heights.reduce((a,h)=>a+h,0)/heights.length,rings}];});
  const roofArea=faces.reduce((a,f)=>a+f.area,0),projectedArea=faces.reduce((a,f)=>a+f.projectedArea,0);
  const bins=[[0,5],[5,12],[12,30],[30,60],[60,90.001]].map(([lo,hi])=>({minSlope:lo,maxSlope:hi,areaM2:round(faces.filter(f=>f.slopeDeg>=lo&&f.slopeDeg<hi).reduce((a,f)=>a+f.area,0))}));
  const heightBands={};for(const f of faces){const k=Math.floor(f.meanVertexHeight/2)*2;heightBands[k]=(heightBands[k]||0)+f.area;}
  let total=0,covered=0,overlap=0,exterior=0;const step=.25;
  for(let x=bounds[0]+step/2;x<bounds[2];x+=step)for(let z=bounds[1]+step/2;z<bounds[3];z+=step){const p=[x,z],target=polys.some(r=>inPoly(p,r)),n=faces.filter(f=>inPoly(p,f.rings)).length;if(target){total++;if(n)covered++;if(n>1)overlap++;}else if(n)exterior++;}
  const later=expanded.records.find(r=>r.buildingId===b.id),visual=later||imageFinding;
  for(const im of visual.images){const file=im.absolutePath||path.join(root,'images',im.file);assert.equal(sha(await fs.readFile(file)),im.sha256,'Frozen visual source changed: '+file);}
  assert.ok(roofArea>0&&footprintArea>0);assert.ok(faces.every(f=>f.area>=0&&Number.isFinite(f.slopeDeg)));
  const largest=[...faces].sort((a,b)=>b.area-a.area).slice(0,12);
  const record={buildingId:b.id,id:imageFinding.id,address:imageFinding.address,index:packet.index,source:{blockSha256:sha(blockBytes),buildingSurfacesSha256:sha(JSON.stringify(b.surfaces)),footprintSha256:sha(JSON.stringify(b.footprint)),visualFindingsSha256:sha(frozenBytes),expandedFindingsSha256:later?sha(expandedBytes):null},visual:{streetAerialProposal:imageFinding.proposal,expandedProposal:later?.proposal,fieldEligibility:visual.fieldEligibility,images:visual.images},existingHeuristic:roofGeometry(b),stats:{roofFaces:faces.length,tinyFacesUnderHalfM2:faces.filter(f=>f.area<.5).length,roofAreaM2:round(roofArea),projectedRoofAreaM2:round(projectedArea),footprintAreaM2:round(footprintArea),projectedSumToFootprintRatio:round(projectedArea/footprintArea),slopeBins:bins.map(b=>({...b,areaFraction:round(b.areaM2/roofArea)})),heightBandsByFaceMeanVertexM:Object.entries(heightBands).map(([lo,area])=>({minHeight:Number(lo),maxHeight:Number(lo)+2,areaM2:round(area),areaFraction:round(area/roofArea)})),minRoofVertexHeight:round(Math.min(...faces.map(f=>f.minHeight))),maxRoofVertexHeight:round(Math.max(...faces.map(f=>f.maxHeight))),sampledProjectedCoverage:{gridStepM:step,footprintSamples:total,coveredFraction:round(covered/total),multiplyCoveredFraction:round(overlap/total),uncoveredApproxM2:round((total-covered)*step*step),roofOutsideFootprintWithinBboxApproxM2:round(exterior*step*step),caveat:'Raster diagnostic, not watertightness proof. Rooftop elevations may overlap in projection. Exterior count excludes anything outside the footprint bbox.'}},largestFaces:largest.map(({rings,...f})=>f),faces};
  if([11,12,28,45,73,90].includes(packet.index)){
    const aerialImage=visual.images.find(i=>i.kind==='aerial-context'),aerialPath=aerialImage.absolutePath||path.join(root,'images',aerialImage.file),airBytes=await fs.readFile(aerialPath);assert.equal(sha(airBytes),aerialImage.sha256);
    const W=1440,H=650,pad=40,box=440,scale=Math.min((box-2*pad)/(bounds[2]-bounds[0]),(550-2*pad)/(bounds[3]-bounds[1])),project=(p,left)=>[left+pad+(p[0]-bounds[0])*scale,85+pad+(p[1]-bounds[1])*scale];
    const colors=['#3b82f6','#22c55e','#eab308','#f97316','#dc2626'],slopeColor=f=>colors[f.slopeDeg<5?0:f.slopeDeg<12?1:f.slopeDeg<30?2:f.slopeDeg<60?3:4];
    const heightColor=f=>`hsl(${240-220*(f.meanVertexHeight-record.stats.minRoofVertexHeight)/Math.max(1,record.stats.maxRoofVertexHeight-record.stats.minRoofVertexHeight)} 75% 55%)`;
    const diagrams=[{left:480,color:slopeColor,title:'Roof slope: blue <5°, green <12°, yellow <30°, orange <60°'},{left:960,color:heightColor,title:'Roof height: blue low → red high (local mesh Y)'}].map(d=>`<text x="${d.left+8}" y="67" font-size="12">${xml(d.title)}</text>${faces.map(f=>`<path d="${f.rings.map(r=>r.map((p,i)=>{const q=project(p,d.left);return(i?'L':'M')+q.join(',');}).join(' ')+' Z').join(' ')}" fill="${d.color(f)}" fill-rule="evenodd" stroke="#222" stroke-width=".5"/>`).join('')}${polys.map(p=>`<polyline points="${p[0].map(v=>project(v,d.left).join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="1.2"/>`).join('')}${largest.slice(0,8).map(f=>{const r=f.rings[0],p=r.reduce((p,v)=>[p[0]+v[0]/r.length,p[1]+v[1]/r.length],[0,0]),q=project(p,d.left);return `<text x="${q[0]}" y="${q[1]}" font-size="11" fill="#111" stroke="white" stroke-width="2" paint-order="stroke">${f.surfaceIndex}</text>`;}).join('')}`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif"><text x="16" y="25" font-size="18">${packet.index}: ${b.id} — visual ${visual.proposal.roofShape}; mesh heuristic ${record.existingHeuristic.shape}</text><text x="16" y="47" font-size="13">Mesh evidence, not surveyed truth. North up; face numbers reference source surface index. Full coverage can still hide missing detail.</text><image x="5" y="83" width="470" height="540" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/jpeg;base64,${airBytes.toString('base64')}"/>${diagrams}<text x="485" y="630" font-size="13">Flat &lt;12° area ${(record.existingHeuristic.flatFraction*100).toFixed(1)}%; sampled coverage ${(record.stats.sampledProjectedCoverage.coveredFraction*100).toFixed(1)}%; height ${record.stats.minRoofVertexHeight}–${record.stats.maxRoofVertexHeight} m</text></g></svg>`;
    const file=String(packet.index).padStart(3,'0')+'-mesh-comparison.svg';await fs.writeFile(path.join(out,file),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,file.replace('.svg','.png')));record.diagram={file,sha256:sha(svg)};
  }
  records.push(record);
}
const report={version:1,createdAt:new Date().toISOString(),origin:'mesh-image-evidence-comparison',humanReviewed:false,metricEligible:false,costUsd:0,method:'Newell face normals/areas with interior-ring subtraction; slope statistics weighted by 3D surface area; height bands weighted by face area at mean vertex height (not a vertical volume integral); 0.25 m projected coverage sampling. Existing heuristic reproduced separately. Frozen image-only proposals are comparison evidence, not gold labels. No classification or geometry updates.',records};
await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(records.map(r=>({index:r.index,id:r.buildingId,visual:r.visual.expandedProposal?.roofShape||r.visual.streetAerialProposal.roofShape,mesh:r.existingHeuristic.shape,flat:r.existingHeuristic.flatFraction,coverage:r.stats.sampledProjectedCoverage.coveredFraction,bands:r.stats.heightBandsByFaceMeanVertexM})),null,2));
