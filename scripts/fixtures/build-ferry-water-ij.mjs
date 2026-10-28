// Builds scripts/fixtures/ferry-water-ij.json: OSM water polygons clipped to
// small boxes around the IJ ferry piers the 2026-10-25 feedback named
// (NDSM-werf, Buiksloterweg, the north shore at f80d47da), for the ferry
// regressions in scripts/check-canal-car.ts. Land is everything not water,
// as the game's rendered water mask treats it.
//
// Source: the local Geofabrik/OSM Amsterdam extract (open data, ODbL).
//   node scripts/fixtures/build-ferry-water-ij.mjs [path/to/Amsterdam.osm.pbf]
// Needs `osmium` on PATH.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const pbf = process.argv[2] || path.join(process.env.HOME, 'Code/map-recall2/.cache/osm-source/Amsterdam.osm.pbf');
// One box over the western IJ: Centraal F2-F4, Buiksloterweg, IJplein,
// NDSM-werf, Pontsteiger, Distelweg and the north shore at f80d47da.
const areas = {
  'IJ west': { centre: [52.3905, 4.8960], radius: 1700 },
};
const dir = mkdtempSync(path.join(tmpdir(), 'ferry-water-'));
const box = Object.values(areas).reduce((b, { centre: [lat, lon], radius }) => {
  const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
  return [Math.min(b[0], lon - dLon), Math.min(b[1], lat - dLat), Math.max(b[2], lon + dLon), Math.max(b[3], lat + dLat)];
}, [Infinity, Infinity, -Infinity, -Infinity]);
const run = (...args) => execFileSync('osmium', args, { stdio: ['ignore', 'ignore', 'inherit'] });
run('extract', '-b', box.join(','), pbf, '-o', path.join(dir, 'a.osm.pbf'), '-s', 'smart', '--overwrite');
run('tags-filter', path.join(dir, 'a.osm.pbf'), 'nwr/natural=water', 'nwr/waterway=riverbank', 'nwr/landuse=basin', '-o', path.join(dir, 'w.osm.pbf'), '--overwrite');
run('export', path.join(dir, 'w.osm.pbf'), '-f', 'geojsonseq', '-o', path.join(dir, 'w.geojsonseq'), '-a', 'type,id', '--overwrite');

const features = readFileSync(path.join(dir, 'w.geojsonseq'), 'utf8').split('\n')
  .map(line => line.replace(/^\x1e/, '')).filter(Boolean).map(line => JSON.parse(line))
  .filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');

// Sutherland-Hodgman against an axis-aligned box. Each polygon keeps its outer
// ring first and its holes after it: a point is water when it is inside some
// polygon's outer ring and none of that polygon's holes.
function clip(ring, [w, s, e, n]) {
  const edges = [[p => p[0] >= w, (a, b) => [w, a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= e, (a, b) => [e, a[1] + (b[1] - a[1]) * (e - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= s, (a, b) => [a[0] + (b[0] - a[0]) * (s - a[1]) / (b[1] - a[1]), s]],
    [p => p[1] <= n, (a, b) => [a[0] + (b[0] - a[0]) * (n - a[1]) / (b[1] - a[1]), n]]];
  let out = ring;
  for (const [inside, cut] of edges) {
    const input = out; out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cut(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

const result = { source: 'OpenStreetMap (ODbL), natural=water / waterway=riverbank / landuse=basin', built: new Date().toISOString().slice(0, 10), areas: {} };
for (const [name, { centre: [lat, lon], radius }] of Object.entries(areas)) {
  const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
  const polygons = [];
  for (const f of features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      const rings = poly.map(ring => clip(ring.slice(0, -1), bbox));
      if (rings[0].length < 3) continue;
      polygons.push({ osm: `${f.properties['@type']}/${f.properties['@id']}`,
        rings: rings.filter(r => r.length >= 3).map(r => r.map(([x, y]) => [+y.toFixed(7), +x.toFixed(7)])) });
    }
  }
  result.areas[name] = { centre: [lat, lon], radius, polygons };
}
writeFileSync(new URL('./ferry-water-ij.json', import.meta.url), JSON.stringify(result) + '\n');
console.log(Object.entries(result.areas).map(([k, v]) => `${k}: ${v.polygons.length} polygons`).join(', '));
