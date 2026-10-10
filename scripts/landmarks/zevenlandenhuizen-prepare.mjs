// Usage: node scripts/landmarks/zevenlandenhuizen-prepare.mjs <dir-with-3d-<pand>.json>
// Merges the seven 3DBAG LoD2.2 panden of Roemer Visscherstraat 20-30a into one shared native frame
// (east/south metres from the row's BAG centroid; y above each pand's local ground).
import fs from 'node:fs';
const dir = process.argv[2];
const order = [['20', '0363100012137523'], ['22', '0363100012164367'], ['24', '0363100012152737'], ['26', '0363100012158859'], ['28', '0363100012166749'], ['30', '0363100012237158'], ['30a', '0363100012236664']];
const rdll = (x, y) => {
  const dx = (x - 155000) * 1e-5, dy = (y - 463000) * 1e-5;
  const s = (t) => t.reduce((a, [p, q, c]) => a + c * dx ** p * dy ** q, 0) / 3600;
  return [5.38720621 + s([[1, 0, 5260.52916], [1, 1, 105.94684], [1, 2, 2.45656], [3, 0, -.81885], [1, 3, .05594], [3, 1, -.05607], [0, 1, .01199], [3, 2, -.00256], [1, 4, .00128], [0, 2, .00022], [2, 0, -.00022], [5, 0, .00026]]),
    52.15517440 + s([[0, 1, 3235.65389], [2, 0, -32.58297], [0, 2, -.2475], [2, 1, -.84978], [0, 3, -.0655], [2, 2, -.01709], [1, 0, -.00738], [4, 0, .0053], [2, 3, -.00039], [4, 1, .00033], [1, 1, -.00012]])];
};
const rings = {};
for (const [, bag] of order) {
  const pand = (await (await fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=${bag}&f=json`)).json()).features[0];
  rings[bag] = {ll: pand.geometry.coordinates[0], year: pand.properties.bouwjaar};
}
const all = Object.values(rings).flatMap(r => r.ll);
const anchor = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
const loc = ([lo, la]) => [(lo - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), (anchor[1] - la) * 111320];
const houses = [];
for (const [num, bag] of order) {
  const j = JSON.parse(fs.readFileSync(`${dir}/3d-${bag}.json`, 'utf8')), f = j.feature, tr = f.transform ?? j.metadata.transform;
  const co = f.CityObjects[`NL.IMBAG.Pand.${bag}`], attrs = co.attributes, ground = attrs.b3_h_maaiveld;
  const verts = f.vertices.map(v => { const x = v[0] * tr.scale[0] + tr.translate[0], y = v[1] * tr.scale[1] + tr.translate[1], z = v[2] * tr.scale[2] + tr.translate[2]; const [e, s] = loc(rdll(x, y)); return [e, z - ground, s]; });
  const part = f.CityObjects[`NL.IMBAG.Pand.${bag}-0`];
  const g = part.geometry.find(q => q.lod === '2.2') ?? part.geometry.at(-1);
  const surfaces = [];
  g.boundaries[0].forEach((b, i) => { const type = g.semantics.surfaces[g.semantics.values[0][i]].type; surfaces.push({type, rings: b.map(r => r.map(v => verts[v].map(n => +n.toFixed(3))))}); });
  houses.push({house: num, bagId: bag, bouwjaar: rings[bag].year, groundNAP: ground, roofMaxNAP: attrs.b3_h_dak_max, roofMinNAP: attrs.b3_h_dak_min, ridgeNAP: attrs.b3_h_nok, floors: attrs.b3_bouwlagen, nativeRing: rings[bag].ll.map(loc).map(p => p.map(n => +n.toFixed(3))), buildingFootprint: {type: 'Polygon', coordinates: [rings[bag].ll]}, surfaces});
}
// Keep the earlier source-hold record (RCE monument ids, countries) that lived in this file before the build.
const file = 'scripts/landmarks/zevenlandenhuizen-footprints.json';
const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const prior = prev.priorSourceHold ?? (prev.status ? prev : undefined);
for (const h of houses) { const old = prev.houses?.find(x => x.bagId === h.bagId) ?? prior?.buildings?.find(x => x.bagPandId === h.bagId); if (old) Object.assign(h, {country: old.country, rceMonumentId: old.rceMonumentId, address: old.address}); }
const out = {id: 'zevenlandenhuizen', anchor, coordinateConvention: 'native east/south metres from anchor; y above each pand local ground', rceComplexId: prev.rceComplexId ?? prior?.rceComplexId, priorSourceHold: prior, houses};
fs.writeFileSync('scripts/landmarks/zevenlandenhuizen-footprints.json', JSON.stringify(out) + '\n');
for (const h of houses) console.log(h.house, h.bagId, 'floors', h.floors, 'roof', (h.roofMinNAP - h.groundNAP).toFixed(1), (h.roofMaxNAP - h.groundNAP).toFixed(1), 'ring', h.nativeRing.length, 'surf', h.surfaces.length, JSON.stringify(h.nativeRing.map(p => p.map(n => +n.toFixed(1)))));
console.log(anchor);
