/**
 * Regression (user screenshot 2026-10-16, "does noorderkerk really have these sort of infill building sides?"): the three 1623 service
 * houses in the angles of the Noorderkerk cross (BAG 0363100012177303 NE, 0363100012176942 SE, 0363100012176956 NW) were drawn as generic
 * flat-roofed 14 m OSM blocks with kit facades butting the church. They are now part of the Noorderkerk landmark. This pins:
 *  1. the catalogue entry suppresses the three BAG pands and the ten OSM building ways that drew them;
 *  2. no tile building lies >= 50 % inside a corner-house ring without being suppressed (the plain extrusion cannot come back);
 *  3. the landmark's buildingFootprint carries the three rings (check:osm-under-models and the overlays read it);
 *  4. the builder covers each ring: a ray down at the ring's interior points hits roof slate (pitched/deck) or a flat slate top at the
 *     modelled heights, and the north-east house's diagonal front is brick with the portal at street level.
 *  5. the two Noordermarkt sheds (0363100012177300 / 177301, white panelled market stores, 3.4 m) stay with the city tiles.
 *
 *   node --import tsx scripts/check-noorderkerk-corner-houses.ts
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import catalogue from '../src/canalRecall/landmarks/manualCatalogue.json';
import spec from './landmarks/noorderkerk-spec.json';
import source from './landmarks/noorderkerk-footprints.json';
import {buildNoorderkerk, type NoorderkerkStats} from './landmarks/noorderkerk-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import {buildingsIn} from './lib/placedFootprints';
import {nativeRingToLngLat, unsuppressedUnder, type LngLat} from '../src/canalRecall/landmarks/osmUnderModels';

const CORNER_PANDS = ['0363100012177303', '0363100012176942', '0363100012176956'];
const CORNER_WAYS = ['w749871260', 'w749871261', 'w749871264', 'w749871265', 'w749871266', 'w749871269', 'w749871270', 'w749871273', 'w749871274', 'w749871275'];
const SHEDS = ['NL.IMBAG.Pand.0363100012177300', 'NL.IMBAG.Pand.0363100012177301'];

const entry = (catalogue as {id: string; suppressOsmIds: string[]; buildingFootprint: {type: string; coordinates: number[][][][]}}[]).find(e => e.id === 'noorderkerk')!;
assert.deepEqual(entry.suppressOsmIds, spec.suppressOsmIds, 'catalogue entry in step with noorderkerk-spec.json (upsert-catalogue-entry.ts)');
for (const id of [...CORNER_PANDS.map(p => `NL.IMBAG.Pand.${p}`), ...CORNER_WAYS]) assert(entry.suppressOsmIds.includes(id), `noorderkerk must suppress ${id}`);
for (const id of SHEDS) assert(!entry.suppressOsmIds.includes(id), `${id} (Noordermarkt shed) stays a city building`);

const houses = source.cornerHouses;
assert.deepEqual(houses.map(h => h.bagId), CORNER_PANDS);
assert.equal(entry.buildingFootprint.type, 'MultiPolygon');
assert.equal(entry.buildingFootprint.coordinates.length, 4, 'church + three corner houses');

const suppressed = new Set(entry.suppressOsmIds);
for (const h of houses) {
  const ring = nativeRingToLngLat(h.nativeRing as [number, number][], source.anchor as LngLat);
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const near = buildingsIn({w: Math.min(...xs) - 0.0003, e: Math.max(...xs) + 0.0003, s: Math.min(...ys) - 0.0003, n: Math.max(...ys) + 0.0003});
  const hits = unsuppressedUnder([ring], near, suppressed);
  assert.equal(hits.length, 0, `${h.tag} house ${h.bagId}: unsuppressed tile buildings ${hits.map(x => x.id).join(', ')}`);
  assert(entry.buildingFootprint.coordinates.some(poly => Math.abs(poly[0][0][0] - h.ringLngLat[0][0]) < 1e-9 && Math.abs(poly[0][0][1] - h.ringLngLat[0][1]) < 1e-9), `${h.tag}: ring in buildingFootprint`);
}

// Builder coverage.
const group = new T.Group();
const add = (g: T.BufferGeometry, c: string, x = 0, y = 0, z = 0, angle = 0) => { g.rotateY(angle); g.translate(x, y, z); group.add(new T.Mesh(g, new T.MeshBasicMaterial({name: c, side: T.DoubleSide}))); };
const b = {add, box: (x: number, y: number, z: number, w: number, h: number, d: number, c: string, angle = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, angle)} as unknown as BuildingTools;
const stats: NoorderkerkStats = {arms: 0, windows: 0, roundels: 0, turret: false};
buildNoorderkerk(1, 1, b, stats);
group.updateMatrixWorld(true);
assert.equal(stats.cornerHouses, 3); assert.equal(stats.dormers, 3);
const down = (x: number, z: number) => new T.Raycaster(new T.Vector3(x, 60, z), new T.Vector3(0, -1, 0)).intersectObjects(group.children)[0];
const name = (h: T.Intersection | undefined) => ((h?.object as T.Mesh | undefined)?.material as T.Material | undefined)?.name;
const inside = (r: [number, number][], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > z) !== (r[j][1] > z) && x < (r[j][0] - r[i][0]) * (z - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
};
for (const h of houses) {
  const ring = h.nativeRing as [number, number][];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  let covered = 0, n = 0;
  for (const [x, z] of ring.slice(0, -1)) for (const f of [0.35, 0.7]) {
    const px = cx + (x - cx) * f, pz = cz + (z - cz) * f;
    if (!inside(ring, px, pz)) continue; // concave rings (the SE house's U between its wings)
    const hit = down(px, pz); n++;
    if (hit && hit.point.y > 3.5) covered++;
  }
  assert(n >= 8 && covered / n > 0.85, `${h.tag}: builder covers the BAG ring (${covered}/${n} probes hit a roof above 3.5 m)`);
  const top = down(cx, cz);
  assert(top && ['slate', 'white', 'stone'].includes(name(top)!) && top.point.y < 16, `${h.tag}: centre under a slate roof below the church eave (${name(top)} at ${top?.point.y.toFixed(1)})`);
}
// North-east front (panorama b_20241216_0911_Track34_Sphere_00017): brick between the bays, the portal at the door, eave 8.5 m.
const B = 346 * Math.PI / 180, E1 = [Math.sin(B), -Math.cos(B)], E2 = [-E1[1], E1[0]];
const xz = (u: number, v: number) => [u * E1[0] + v * E2[0], u * E1[1] + v * E2[1]];
const dir = [25.54 - 16.64, 10.74 - 19.59], L = Math.hypot(dir[0], dir[1]);
const at = (t: number) => { const u = 16.64 + dir[0] / L * t, v = 19.59 + dir[1] / L * t, [x0, z0] = xz(u, v), [x1, z1] = xz(u + 3 / Math.SQRT2, v + 3 / Math.SQRT2); return {o: new T.Vector3(x1, 0, z1), d: new T.Vector3(x0 - x1, 0, z0 - z1).normalize()}; };
const side = (t: number, y: number) => { const {o, d} = at(t); o.y = y; return name(new T.Raycaster(o, d).intersectObjects(group.children)[0]); };
assert.equal(side(2.5, 3.0), 'brick', 'NE front: brick pier between window and portal');
assert(['dark', 'stone', 'bronze'].includes(side(4.1, 2.0)!), 'NE front: portal at the door');
assert(['glass', 'white'].includes(side(7.5, 6.8)!), 'NE front: first-floor sash');
assert.equal(side(2.5, 9.2), 'slate', 'NE front: roof above the 8.5 m eave');
console.log(`noorderkerk corner houses: ${CORNER_PANDS.length} pands + ${CORNER_WAYS.length} OSM ways suppressed, rings covered by the builder (${stats.cornerWindows} sashes, ${stats.dormers} dormers), sheds left to the city.`);
