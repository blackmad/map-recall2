import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function validateDistrictRelease(manifest){
  const ids=new Set(),contextIds=new Set(),observations=[],buildings=[];
  for(const group of [manifest.tiles,manifest.contextTiles.tiles,manifest.studyRoofs.tiles,manifest.studyFacades.tiles,manifest.studyTrees.tiles,manifest.studyPublicRealm.tiles]){
    for(const tile of group){const bytes=await fs.readFile(`public${tile.url}`);if(bytes.length!==tile.bytes||sha256(bytes)!==tile.sha256)throw Error(`Corrupt release tile ${tile.url}`);const content=gunzipSync(bytes);if(sha256(content)!==tile.contentSha256)throw Error('Invalid decompressed tile');const payload=JSON.parse(content);if(payload.key!==tile.key)throw Error('Wrong tile identity');
      if(group===manifest.tiles)for(const owner of payload.owners){if(ids.has(owner.id))throw Error(`Duplicate district owner ${owner.id}`);ids.add(owner.id);buildings.push(owner.geometry.building);for(const observation of owner.observations){if(observation.buildingId!==owner.id||observation.geometryRevision!==owner.geometryRevision||observation.payload.evidenceKey!==observation.evidenceKey)throw Error('Stale observation binding');observations.push(observation.payload);}}
      if(group===manifest.contextTiles.tiles)for(const owner of payload.owners){if(contextIds.has(owner.id))throw Error('Duplicate context owner');contextIds.add(owner.id);}
      if(group===manifest.studyFacades.tiles)for(const sign of payload.signs??[]){if(!sign.text.trim()||sign.position.length!==3||sign.position.some(v=>!Number.isFinite(v))||sign.width<=0||sign.height<=0||!sign.captureDate||!/^[a-f0-9]{64}$/.test(sign.sourceSha256))throw Error('Invalid literal sign transport');}
    }
  }
  if(ids.size!==manifest.buildings||observations.length!==manifest.observations)throw Error('Release coverage mismatch');
  for(const field of ['context','maplibreAppearance']){const item=manifest[field],bytes=await fs.readFile(`public${item.url}`);if(sha256(bytes)!==item.sha256)throw Error(`Corrupt ${field}`);const value=JSON.parse(bytes);if(field==='maplibreAppearance'&&(value.releaseId!==manifest.releaseId||value.buildings.length!==ids.size))throw Error('Massing appearance coverage mismatch');}
  const checked=new Set();for(const record of observations)for(const kind of ['full','ground']){const image=record.images?.[kind];if(!image?.publicUrl)throw Error('Comparison source missing public URL');if(!checked.has(image.sha256)){if(sha256(await fs.readFile(`public${image.publicUrl}`))!==image.sha256)throw Error('Comparison source bytes changed');checked.add(image.sha256);}}
  return {buildings:ids.size,contextFeatures:contextIds.size,observations:observations.length,comparisonImages:checked.size,integrity:'passed'};
}
