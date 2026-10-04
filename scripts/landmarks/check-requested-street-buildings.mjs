import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source=JSON.parse(await fs.readFile('scripts/landmarks/requested-streets/haparandaweg-source.json','utf8'));
const site=JSON.parse(await fs.readFile('public/canal-drive/requested-street-buildings.json','utf8')).requestedStreets.find(s=>s.street==='Haparandaweg');
const objects=new Map(source.objects.map(f=>[f.properties.identificatie,f])),parents=new Map(source.parents.map(f=>[f.properties.identificatie,f])),addressIds=new Set();
assert.equal(source.addresses.length,source.addressPages[0].numFound);assert.equal(new Set(source.addresses.map(d=>d.nummeraanduiding_id)).size,source.addresses.length);
assert.equal(site.addressCount,source.addresses.length);assert.equal(site.buildingCount,parents.size);assert.equal(site.unresolved.length,0);
for(const b of site.buildings){const original=parents.get(b.bagId);assert(original);assert.deepEqual(b.geometry,original.geometry,'exact official polygon and interior holes retained');assert.equal(b.bagStatus,original.properties.status);assert.equal(b.addressCount,b.addresses.length);if(b.bagStatus==='Bouwvergunning verleend')assert.equal(b.status,'deferred-permit-only','permit polygon must not become a claimed completed building');
 for(const a of b.addresses){addressIds.add(a.addressId);const adr=source.addresses.find(d=>d.nummeraanduiding_id===a.addressId),vbo=objects.get(a.objectId);assert(adr&&vbo);assert.equal(adr.adresseerbaarobject_id,a.objectId);assert.equal(adr.weergavenaam,a.address);assert(vbo.properties['pand.href'].includes(original.sourceUrl.replace('?f=json','')),'ownership follows explicit official object-to-pand relation');}
 const polygons=b.geometry.type==='Polygon'?[b.geometry.coordinates]:b.geometry.coordinates;for(const polygon of polygons)for(const ring of polygon){assert.deepEqual(ring[0],ring.at(-1));for(const p of ring)assert(p.every(Number.isFinite));}
}
assert.equal(addressIds.size,site.addressCount,'every official address delivered at least once');
for(const adr of source.addresses){const vbo=objects.get(adr.adresseerbaarobject_id),expected=vbo.properties['pand.href'];const actual=site.buildings.filter(b=>b.addresses.some(a=>a.addressId===adr.nummeraanduiding_id)).map(b=>parents.get(b.bagId).sourceUrl.replace('?f=json',''));assert.deepEqual(actual.sort(),[...new Set(expected)].sort(),'all linked parents retained, including any multi-pand objects');}
console.log({addresses:site.addressCount,parents:site.buildingCount,inUse:site.buildings.filter(b=>b.bagStatus==='Pand in gebruik').length,permitOnly:site.buildings.filter(b=>b.status==='deferred-permit-only').length,unresolved:site.unresolved.length});
