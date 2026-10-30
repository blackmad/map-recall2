// De Roos (P.C. Hooftstraat 183): 3DBAG LoD2.2 + BAG ring -> scripts/landmarks/de-roos-footprints.json (native x east, z south, y above ground).
//   curl -s https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012236970 -o artifacts/de-roos-src/3dbag.json
//   curl -s "https://api.data.amsterdam.nl/v1/bag/panden/0363100012236970/?_format=json" -o artifacts/de-roos-src/bag-pand-0363100012236970.json
//   node scripts/landmarks/de-roos-prepare.mjs
import fs from 'node:fs'; import proj4 from 'proj4';
proj4.defs('RD', '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.4171,50.3319,465.5524,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs');
const PAND = '0363100012236970', out = 'scripts/landmarks/de-roos-footprints.json';
const raw = JSON.parse(fs.readFileSync('artifacts/de-roos-src/3dbag.json')), f = raw.feature, tr = raw.metadata.transform;
const bag = JSON.parse(fs.readFileSync(`artifacts/de-roos-src/bag-pand-${PAND}.json`));
const obj = f.CityObjects[`NL.IMBAG.Pand.${PAND}`], ground = obj.attributes.b3_h_maaiveld;
const ringRD = bag.geometrie.coordinates[0];
const cx = ringRD.slice(0, -1).reduce((s, p) => s + p[0], 0) / (ringRD.length - 1), cy = ringRD.slice(0, -1).reduce((s, p) => s + p[1], 0) / (ringRD.length - 1);
const anchor = proj4('RD', 'EPSG:4326', [cx, cy]).map(v => +v.toFixed(7));
const kx = 111320 * Math.cos(anchor[1] * Math.PI / 180), kz = 110540;
const ll = p => proj4('RD', 'EPSG:4326', [p[0], p[1]]);
const local = p => { const q = ll(p); return [+((q[0] - anchor[0]) * kx).toFixed(3), +(-(q[1] - anchor[1]) * kz).toFixed(3)]; };
const vs = f.vertices.map(p => p.map((x, i) => x * tr.scale[i] + tr.translate[i])).map(p => { const [x, z] = local(p); return [x, +(p[2] - ground).toFixed(3), z]; });
const g = f.CityObjects[obj.children[0]].geometry.find(g => g.lod === '2.2');
const surfaces = g.boundaries[0].map((s, i) => { const sem = g.semantics.surfaces[g.semantics.values[0][i]]; return {type: sem.type, rings: s.map(r => r.map(k => vs[k]))}; });
const nativeRing = ringRD.slice(0, -1).map(local);
const lonlat = ringRD.map(p => ll(p).map(v => +v.toFixed(7)));
fs.writeFileSync(out, JSON.stringify({
  id: 'de-roos', bagId: PAND, anchor, groundNAP: +ground.toFixed(3),
  coordinateConvention: 'native x east, z south metres from anchor (lon scale 111320 cos(lat), lat scale 110540); y above local ground',
  sources: [
    `BAG pand ${PAND} (CC0), https://api.data.amsterdam.nl/v1/bag/panden/${PAND}/ retrieved 2026-10-30; bouwjaar 1880; verblijfsobject 0363010011118218 (P.C. Hooftstraat 183) lies in this pand`,
    `3DBAG LoD2.2 (CC BY 4.0), https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND} retrieved 2026-10-30; ground ${ground.toFixed(2)} m NAP`,
  ],
  attributes: Object.fromEntries(Object.entries(obj.attributes).filter(([k]) => k.startsWith('b3_h') || k === 'b3_dak_type' || k === 'oorspronkelijkbouwjaar')),
  nativeRing, buildingFootprint: {type: 'Polygon', coordinates: [lonlat]}, surfaces,
}, null, 1));
console.log('anchor', anchor, 'ring', nativeRing.length, 'surfaces', surfaces.length, 'roofs', surfaces.filter(s => s.type === 'RoofSurface').length);
