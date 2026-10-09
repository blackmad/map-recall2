// Usage: node scripts/landmarks/worship-prepare.mjs <id> <bagPandId> <3dbag.json>
// Writes scripts/landmarks/<id>-footprints.json: BAG ring + 3DBAG LoD2.2 roof/wall surfaces in native
// east/south metres from the BAG centroid, heights above local ground (b3_h_maaiveld).
import fs from 'node:fs';
const [id, bag, file] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(file, 'utf8')), f = j.feature, tr = f.transform ?? j.metadata.transform;
const rdll = (x, y) => {
  const dx = (x - 155000) * 1e-5, dy = (y - 463000) * 1e-5;
  const s = (t) => t.reduce((a, [p, q, c]) => a + c * dx ** p * dy ** q, 0) / 3600;
  return [5.38720621 + s([[1, 0, 5260.52916], [1, 1, 105.94684], [1, 2, 2.45656], [3, 0, -.81885], [1, 3, .05594], [3, 1, -.05607], [0, 1, .01199], [3, 2, -.00256], [1, 4, .00128], [0, 2, .00022], [2, 0, -.00022], [5, 0, .00026]]),
    52.15517440 + s([[0, 1, 3235.65389], [2, 0, -32.58297], [0, 2, -.2475], [2, 1, -.84978], [0, 3, -.0655], [2, 2, -.01709], [1, 0, -.00738], [4, 0, .0053], [2, 3, -.00039], [4, 1, .00033], [1, 1, -.00012]])];
};
const pand = (await (await fetch(`https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?identificatie=${bag}&f=json`)).json()).features[0];
const ringLL = pand.geometry.coordinates[0];
const anchor = [ringLL.reduce((s, p) => s + p[0], 0) / ringLL.length, ringLL.reduce((s, p) => s + p[1], 0) / ringLL.length];
const loc = ([lo, la]) => [(lo - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), (anchor[1] - la) * 111320];
const co = f.CityObjects[`NL.IMBAG.Pand.${bag}`];
const attrs = co.attributes, ground = attrs.b3_h_maaiveld;
const verts = f.vertices.map(v => { const x = v[0] * tr.scale[0] + tr.translate[0], y = v[1] * tr.scale[1] + tr.translate[1], z = v[2] * tr.scale[2] + tr.translate[2]; const [e, s] = loc(rdll(x, y)); return [e, z - ground, s]; });
const part = f.CityObjects[`NL.IMBAG.Pand.${bag}-0`];
const g = part.geometry.find(q => q.lod === '2.2') ?? part.geometry.at(-1);
const surfaces = [];
g.boundaries[0].forEach((b, i) => {
  const type = g.semantics.surfaces[g.semantics.values[0][i]].type;
  surfaces.push({type, rings: b.map(r => r.map(v => verts[v].map(n => +n.toFixed(3))))});
});
const out = {id, bagId: bag, anchor, groundNAP: ground, coordinateConvention: 'native east/south metres from anchor; y above local ground', attributes: {roofMaxNAP: attrs.b3_h_dak_max, roofMinNAP: attrs.b3_h_dak_min, ridgeNAP: attrs.b3_h_nok, floors: attrs.b3_bouwlagen}, nativeRing: ringLL.map(loc).map(p => p.map(n => +n.toFixed(3))), buildingFootprint: {type: 'Polygon', coordinates: [ringLL]}, surfaces};
fs.writeFileSync(`scripts/landmarks/${id}-footprints.json`, JSON.stringify(out, null, 1) + '\n');
for (const [i, s] of surfaces.entries()) { const p = s.rings[0]; if (s.type !== 'WallSurface' && s.type !== 'GroundSurface') console.log(i, s.type, 'h', (p.reduce((a, v) => a + v[1], 0) / p.length).toFixed(1), 'x', Math.min(...p.map(v => v[0])).toFixed(1), Math.max(...p.map(v => v[0])).toFixed(1), 'z', Math.min(...p.map(v => v[2])).toFixed(1), Math.max(...p.map(v => v[2])).toFixed(1)); }
console.log('ring', out.nativeRing.length, 'anchor', anchor, 'ground', ground);
