/** Second stage only: frozen image decisions remain separate from mesh evidence. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {roofFrontageComponents} from './roof-components.mjs';
const root=path.resolve('.cache/da-costa-storefront-roofs-2026-09-09'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const packetBytes=await fs.readFile(path.join(root,'sources.json')),packets=JSON.parse(packetBytes),frozenBytes=await fs.readFile(path.join(root,'frozen-image-findings.json')),frozen=JSON.parse(frozenBytes),blockBytes=await fs.readFile('public/data/da-costa-block/block.json'),block=JSON.parse(blockBytes);
assert.equal(frozen.meshInspectedBeforeFreeze,false);assert.equal(frozen.priorRoofModelOutputsRead,false);
const records=[];
for(const packet of packets.records){
  const finding=frozen.records.find(r=>r.id===packet.id);assert.ok(finding);for(const image of finding.images)assert.equal(sha(await fs.readFile(image.absolutePath)),image.sha256);
  const building=block.buildings.find(b=>b.id===packet.buildingId),diagnostic=roofFrontageComponents(building,packet.frontage);
  const vertices=building.surfaces.flatMap(s=>s.rings.flat()).map(p=>[p[0],p[2]]),xs=vertices.map(p=>p[0]),zs=vertices.map(p=>p[1]),bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)],scale=Math.min(500/(bounds[2]-bounds[0]),450/(bounds[3]-bounds[1]));
  const xy=p=>[55+(p[0]-bounds[0])*scale,75+(p[1]-bounds[1])*scale];
  const pathFor=rings=>rings.map(r=>r.map((p,i)=>(i?'L':'M')+xy([p[0],p[2]]).join(',')).join(' ')+' Z').join(' ');
  const linked=new Set(diagnostic.facts.frontageLinkedPitchFaceIndices),pitch=new Set(diagnostic.pitchedFaces.map(f=>f.surfaceIndex)),deck=new Set(diagnostic.mainDeckCandidate?.sourceFaceIndices||[]);
  const shapes=building.surfaces.map((s,i)=>{if(s.type!=='roof')return'';const ring=s.rings[0],center=ring.reduce((c,p)=>[c[0]+p[0]/ring.length,c[1]+p[2]/ring.length],[0,0]),q=xy(center);return `<path d="${pathFor(s.rings)}" fill="${linked.has(i)?'#ef4444':pitch.has(i)?'#fb923c':deck.has(i)?'#2563eb':'#a5c9f5'}" fill-rule="evenodd" stroke="#334155" stroke-width="1"/><text x="${q[0]}" y="${q[1]}" text-anchor="middle" font-size="11" stroke="white" stroke-width="2" paint-order="stroke">${i}</text>`;}).join('');
  const a=xy(packet.frontage.localStart),b=xy(packet.frontage.localEnd);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="620" height="610"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif"><text x="15" y="23" font-size="17">${packet.index}: ${packet.address} — mesh-only component plan</text><text x="15" y="46" font-size="12">N ↑; source surface IDs. Separate from frozen image-only finding.</text>${shapes}<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#16a34a" stroke-width="5"/><text x="15" y="558" font-size="12">Blue: provisional reference deck; pale blue: other flat-family faces</text><text x="15" y="578" font-size="12">Red: projected frontage-linked pitch; orange: other pitch; green: selected wall</text><text x="15" y="599" font-size="12">Plan contact does not prove 3D attachment. No mesh pitch ≠ no visible pitch.</text></g></svg>`;
  const file=String(packet.index).padStart(2,'0')+'-mesh.svg',png=file.replace('.svg','.png');await fs.writeFile(path.join(root,file),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(root,png));
  records.push({id:packet.id,buildingId:packet.buildingId,address:packet.address,stage:'mesh-assisted comparison after image-only freeze',frozenImageProposal:finding.proposal,diagnostic,source:{buildingSurfacesSha256:sha(JSON.stringify(building.surfaces)),frontageSha256:sha(JSON.stringify(packet.frontage))},diagram:{file,png,sha256:sha(svg)}});
}
await fs.writeFile(path.join(root,'mesh-comparison.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),origin:'post-freeze-mesh-comparison',humanReviewed:false,metricEligible:false,costUsd:0,source:{packetSha256:sha(packetBytes),frozenFindingsSha256:sha(frozenBytes),blockSha256:sha(blockBytes)},policy:'No edits to frozen image-only fields or existing proposals. Mesh only supplies component hypotheses, never missing-pitch negatives.',records},null,2));
console.log(JSON.stringify(records.map(r=>({id:r.id,image:r.frozenImageProposal,facts:r.diagnostic.facts,deck:r.diagnostic.mainDeckCandidate,pitched:r.diagnostic.pitchedFaces.map(f=>({i:f.surfaceIndex,area:f.areaM2,tilt:f.slopeDeg,h:f.heightRange,frontage:f.frontage.association}))})),null,2));
