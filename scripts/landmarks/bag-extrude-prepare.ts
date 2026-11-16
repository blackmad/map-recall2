/**
 * A landmark shell source for a pand the 3DBAG does not serve (2026-11-16; bag-shell-prepare.ts gets a 404, e.g. the
 * Wilhelminatoren 0363100012072252): the BAG outline (PDOK BAG WFS, RD, CC0) extruded to a measured height, in the same
 * native frame and ShellSource format (x east, z south, y up from the ground, metres, origin = vertex average of the ring).
 *
 *   node --import tsx scripts/landmarks/bag-extrude-prepare.ts <id> <16-digit pand> <heightM> [heightSource] [out.json] [--ring-from=w123]
 *
 * `--ring-from=<OSM id>`: the outline of that building-tiles feature instead of the whole pand (a tower that is one part of
 * a large pand; pair it with the spec's `pandPart`). The anchor is then that ring's vertex average.
 *
 * Surfaces: one GroundSurface, one vertical WallSurface quad per ring edge, one flat RoofSurface at `heightM`. The builder
 * shapes anything that is not a flat-topped prism (setbacks, crowns) itself and says so.
 */
import fs from 'node:fs';
import {cachedJson, findPands} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const ringFrom = process.argv.find(a => a.startsWith('--ring-from='))?.slice(12);
const [ID, PAND, H, HSRC = 'given', OUT0] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!ID || !PAND || !H) { console.error('usage: bag-extrude-prepare.ts <id> <pand> <heightM> [heightSource] [out.json]'); process.exit(2); }
const OUT = OUT0 ?? `scripts/landmarks/${ID}-footprints.json`, height = Number(H);
const wfs = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`;
const bag = (await cachedJson(wfs)).features[0];
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const part = ringFrom ? (await findPands([ringFrom])).get(ringFrom) : undefined;
if (ringFrom && !part) throw new Error(`no building-tiles feature ${ringFrom}`);
const ringRD: number[][] = open(part ? (part.ring as unknown as number[][]).map(p => Array.isArray(p) ? p : [(p as {x: number}).x, (p as {y: number}).y]) : bag.geometry.coordinates[0]);
const ax = ringRD.reduce((s, p) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s, p) => s + p[1], 0) / ringRD.length;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const ring = ringRD.map(p => [r3(p[0] - ax), r3(-(p[1] - ay))]);
const surfaces = [
  {type: 'GroundSurface', rings: [ring.map(([x, z]) => [x, 0, z])]},
  ...ring.map((a, i) => { const b = ring[(i + 1) % ring.length]; return {type: 'WallSurface', rings: [[[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], height, b[1]], [a[0], height, a[1]]]]}; }),
  {type: 'RoofSurface', rings: [ring.map(([x, z]) => [x, height, z]).reverse()]},
];
const out = {
  id: ID, bagId: PAND, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)), groundNAP: null,
  coordinateConvention: 'native east/south metres from anchor; y above local ground',
  sources: {bag: `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${PAND} (BAG, CC0, fetched 2026-11-16)`, shell: `BAG ring extruded to ${height} m (${HSRC}); the 3DBAG serves no shell for this pand (404, 2026-11-16)`},
  attributes: {bouwjaar: bag.properties.bouwjaar, extrudedHeightM: height, ...(ringFrom ? {ringFrom, pandPartRing: ringRD.map(p => rdToLngLat(p[0], p[1]).map(v => +v.toFixed(7)))} : {})},
  nativeRing: ring,
  facadeRing: ring,
  surfaces,
};
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
console.log(out.anchor, 'ring', ring.length, 'surfaces', surfaces.length);
