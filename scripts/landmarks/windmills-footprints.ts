/**
 * Writes scripts/landmarks/{de-bloem,de-otter,d-admiraal}-footprints.json: the exact BAG ring of each mill pand
 * (building-tiles extract, RD New -> WGS84 with the repo's rdNew) in local east/south metres around the anchor, which is
 * the OSM man_made=windmill node (mill axis) where the mill stands inside a larger pand, else the ring vertex mean.
 * Builders read these files; the anchor and ring are the spec's surveyed anchor and buildingFootprint.
 *   node --import tsx scripts/landmarks/windmills-footprints.ts
 */
import fs from 'node:fs';
import {findPands, rdToLngLat} from '../pand-reference/core.ts';

const MILLS = [
  {id: 'de-bloem', pand: '0363100012165350', osm: 'w276264373', poi: 'n418044454', axis: null},
  {id: 'de-otter', pand: '0363100012096312', osm: 'w276340032', poi: 'w276340032', axis: null},
  // D'Admiraal stands on its shed: the pand is the L-shaped shed plus wing, the mill axis is the OSM node.
  {id: 'd-admiraal', pand: '0363100012161029', osm: 'w280661893', poi: 'n31101329', axis: [4.9235, 52.40256] as [number, number]},
];
const found = await findPands(MILLS.map(m => `NL.IMBAG.Pand.${m.pand}`));
for (const m of MILLS) {
  const fp = found.get(`NL.IMBAG.Pand.${m.pand}`);
  if (!fp) throw new Error(`${m.id}: pand ${m.pand} not in building tiles`);
  let ring = fp.ring.map(p => rdToLngLat(p) as [number, number]);
  if (ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]) ring = ring.slice(0, -1);
  const anchor = m.axis ?? [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length] as [number, number];
  const kx = 111320 * Math.cos(anchor[1] * Math.PI / 180), ky = 111250;
  const local = ring.map(([lng, lat]) => [+((lng - anchor[0]) * kx).toFixed(3), +(-(lat - anchor[1]) * ky).toFixed(3)]);
  const out = {
    id: m.id, anchor: anchor.map(v => +v.toFixed(8)), northOffsetDegrees: 0,
    frame: 'model +X = east, +Z = south (glTF), metres, origin at anchor',
    bagPand: `NL.IMBAG.Pand.${m.pand}`, osmBuilding: m.osm, osmPoi: m.poi,
    ringLocal: local,
    buildingFootprint: {type: 'Polygon', coordinates: [[...ring, ring[0]].map(p => [+p[0].toFixed(7), +p[1].toFixed(7)])]},
    source: 'BAG pand ring from public/data/extracts/amsterdam/building-tiles (PDOK BAG, CC0), RD New -> WGS84 via src/canalRecall/facade/rdNew.ts',
  };
  fs.writeFileSync(`scripts/landmarks/${m.id}-footprints.json`, JSON.stringify(out, null, 1) + '\n');
  console.log(m.id, anchor, local.map(p => p.join(',')).join(' '));
}
