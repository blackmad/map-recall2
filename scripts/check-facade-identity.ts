import assert from 'node:assert/strict';
import { buildBagIdentities, formatBagAddress, type BagFeature } from '../src/canalRecall/facade/bagIdentity.ts';

const pand: BagFeature = {
  id: 'pand-item', properties: { identificatie: '0363100012345678', bouwjaar: 1005, status: 'Pand in gebruik' },
  geometry: { type: 'Polygon', coordinates: [[[4.8, 52.3], [4.81, 52.3], [4.81, 52.31], [4.8, 52.3]]] },
};
const vbo: BagFeature = {
  id: 'vbo-item', properties: {
    identificatie: 'vbo-1', status: 'Verblijfsobject in gebruik', gebruiksdoel: 'woonfunctie,kantoorfunctie', oppervlakte: 95,
    hoofdadres_identificatie: 'address-main', 'pand.href': ['https://example.test/collections/pand/items/pand-item'],
  },
};
const addresses: BagFeature[] = [
  { id: 'a1', properties: { identificatie: 'address-main', adresseerbaar_object_identificatie: 'vbo-1', openbare_ruimte_identificatie: 'space-canal', openbare_ruimte_naam: 'Herengracht', huisnummer: '270', postcode: '1016BV', woonplaats_identificatie: '3594', woonplaats_naam: 'Amsterdam', status: 'Naamgeving uitgegeven' } },
  { id: 'a2', properties: { identificatie: 'address-secondary', adresseerbaar_object_identificatie: 'vbo-1', openbare_ruimte_identificatie: 'space-side', openbare_ruimte_naam: 'Side Street', huisnummer: '1', huisletter: 'A', toevoeging: 'hs', status: 'Naamgeving uitgegeven' } },
];

const identities = buildBagIdentities([pand], [vbo], addresses, '2026-09-04T00:00:00Z');
assert.equal(identities.length, 1);
const identity = identities[0];
assert.equal(identity.pandId, '0363100012345678');
assert.equal(identity.constructionYear, null, 'BAG unknown-year sentinel is not a construction date');
assert.equal(identity.vbos.length, 1);
assert.deepEqual(identity.vbos[0].uses, ['woonfunctie', 'kantoorfunctie']);
assert.equal(identity.addresses.length, 2, 'secondary addresses survive the VBO join');
assert.equal(identity.addresses.find(address => address.addressId === 'address-main')?.primary, true);
assert.equal(identity.addresses.find(address => address.addressId === 'address-secondary')?.primary, false);
assert.equal(formatBagAddress(identity.addresses[0]), 'Herengracht 270, 1016BV Amsterdam');

const foreignVbo = { ...vbo, id: 'foreign-vbo', properties: { ...vbo.properties, identificatie: 'vbo-2', 'pand.href': ['https://example.test/collections/pand/items/other-pand'] } };
assert.equal(buildBagIdentities([pand], [foreignVbo], addresses, '2026-09-04T00:00:00Z')[0].vbos.length, 0, 'VBOs never join by proximity');

console.log('Façade BAG identity checks passed (pand → VBO → every address, strict item-link join).');
