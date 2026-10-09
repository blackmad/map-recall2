import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { SceneFrame, cellsNear, lngLatToLocal, localToLngLat, mercator, metreInMercator, validateIndex, type BridgeExtract, type ElevationIndex, type MeasuredBridge, type WaterCell } from './elevationData';
import { quayWalls, shoreLength, waterSurface } from './canalGeometry';
import { DeckIndex, decodeFallback, decodeProfile, fallbackDeckTop, fallbackDeckUnderside, measuredDeckMesh, pointInRing, surfacePose } from './bridgeDeck';
import type { MeshData } from './meshBuilder';

const frameIndex = { origin: [4.9, 52.37] as [number, number], metresPerDegree: [111320 * Math.cos(52.37 * Math.PI / 180), 111320] as [number, number] };

function faceNormals(mesh: MeshData): [number, number, number, number, number, number][] {
  const out: [number, number, number, number, number, number][] = [];
  const p = mesh.positions;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]].map(k => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    out.push([n[0], n[1], n[2], (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
  }
  return out;
}

function meshArea(mesh: MeshData): number {
  return faceNormals(mesh).reduce((sum, n) => sum + Math.hypot(n[0], n[1], n[2]) / 2, 0);
}

test('storage frame round-trips and scene metres follow MapLibre mercator', () => {
  const [lng, lat] = localToLngLat(frameIndex, 1234.5, -987.6);
  const [x, y] = lngLatToLocal(frameIndex, lng, lat);
  assert.ok(Math.abs(x - 1234.5) < 1e-6 && Math.abs(y + 987.6) < 1e-6);
  const frame = new SceneFrame(frameIndex);
  const [ex, ey] = frame.fromLocal(1000, 0);
  // Storage metres use 111,320 m/deg; MapLibre's sphere 111,195: within 0.2%.
  assert.ok(Math.abs(ex - 1000) < 2 && Math.abs(ey) < 1e-6, `east ${ex},${ey}`);
  const [nx, ny] = frame.fromLocal(0, 1000);
  assert.ok(Math.abs(nx) < 1e-6 && Math.abs(ny - 1000) < 3, `north ${nx},${ny}`);
  const [mx] = mercator(4.9, 52.37);
  assert.ok(Math.abs(mx - (180 + 4.9) / 360) < 1e-12);
  assert.ok(Math.abs(metreInMercator(52.37) * 2 * Math.PI * 6371008.8 * Math.cos(52.37 * Math.PI / 180) - 1) < 1e-12);
});

test('cellsNear picks only cells within the radius', () => {
  const index = { cellSizeM: 1000, cells: [[0, 0, 1, 1], [1, 0, 1, 1], [5, 5, 1, 1]] as [number, number, number, number][] };
  assert.deepEqual(cellsNear(index, 900, 500, 200).sort(), ['0_0', '1_0']);
  assert.deepEqual(cellsNear(index, 500, 500, 100), ['0_0']);
});

// A 20 m × 100 m canal (decimetres, CCW) whose long sides are quays.
const canal: WaterCell = {
  cell: [0, 0],
  water: [[[100, 100, 300, 100, 300, 1100, 100, 1100]]],
  shore: [[300, 100, 300, 1100], [100, 1100, 100, 100]],
};

test('water surface triangulates the polygon at the requested depth', () => {
  const surface = waterSurface(canal, 1000, 0.1, -1.77, [1, 1, 1]);
  assert.ok(Math.abs(meshArea(surface) - 2000) < 1e-6);
  for (let i = 2; i < surface.positions.length; i += 3) assert.equal(surface.positions[i], Math.fround(-1.77));
});

test('quay walls face into the water and reach below the water plane', () => {
  const walls = quayWalls(canal, 1000, 0.1, 1.77);
  const normals = faceNormals(walls);
  assert.ok(normals.length >= 12);
  for (const [nx, ny, nz, cx, cy] of normals) {
    assert.ok(Math.abs(nz) < 1e-9, 'walls are vertical');
    const toCentre = [20 - cx, 60 - cy];
    assert.ok(nx * toCentre[0] + ny * toCentre[1] > 0, 'wall faces the canal');
  }
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 2; i < walls.positions.length; i += 3) { minZ = Math.min(minZ, walls.positions[i]); maxZ = Math.max(maxZ, walls.positions[i]); }
  assert.equal(maxZ, 0);
  assert.ok(minZ < -1.77);
  assert.ok(Math.abs(shoreLength(canal, 0.1) - 200) < 1e-9);
});

// A synthetic 30 m hump bridge along +x, 6 m wide, over water from s = 10 to 20.
function humpBridge(family = 'masonry-arch', water: [number, number] | null = [10, 20]): MeasuredBridge {
  const p: number[] = [];
  for (let s = 0; s <= 30; s += 1.5) {
    const h = Math.max(0, 1.6 * Math.cos(((s - 15) / 15) * Math.PI / 2));
    p.push(Math.round(s * 10), 0, Math.round(s * 100), Math.round(h * 100));
  }
  return { id: 'T1', name: 'Test', roadIds: [], family, width: 6, approachHalfWidth: 3, deck: [8, 22], water, outline: [], endpointNAP: [1, 1], p };
}

test('measured profile resamples, smooths and indexes deck heights', () => {
  const profile = decodeProfile(humpBridge(), 0.1);
  assert.ok(profile.s.length > 40);
  const index = new DeckIndex([profile]);
  const top = index.heightAt(15, 0);
  assert.ok(top && top.height > 1.5 && top.height <= 1.6, `crown ${top?.height}`);
  assert.ok((index.heightAt(15, 2.9)?.height ?? 0) > 1.5, 'inside the deck width');
  assert.equal(index.heightAt(15, 4), null, 'beside the bridge');
  assert.ok((index.heightAt(4, 0)?.height ?? 0) < (index.heightAt(10, 0)?.height ?? 0), 'ramp rises toward the crown');
});

test('a viaduct lifts only a rider heading along it', () => {
  const index = new DeckIndex([decodeProfile(humpBridge('concrete-deck', null), 0.1)]);
  assert.ok((index.heightAt(15, 0, [1, 0])?.height ?? 0) > 1.5);
  assert.equal(index.heightAt(15, 0, [0, 1]), null, 'a street crossing underneath stays on the ground');
  const water = new DeckIndex([decodeProfile(humpBridge('concrete-deck'), 0.1)]);
  assert.ok((water.heightAt(15, 0, [0, 1])?.height ?? 0) > 1.5, 'over water, any heading is on the deck');
});

test('deck meshes stay finite, above the water, and arch down to it', () => {
  const freeboard = 1.77;
  for (const family of ['masonry-arch', 'steel-deck', 'wooden-deck', 'concrete-deck', 'unknown']) {
    const mesh = measuredDeckMesh(decodeProfile(humpBridge(family), 0.1), freeboard);
    assert.ok(mesh.indices.length > 300, family);
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < mesh.positions.length; i++) assert.ok(Number.isFinite(mesh.positions[i]));
    for (let i = 2; i < mesh.positions.length; i += 3) { minZ = Math.min(minZ, mesh.positions[i]); maxZ = Math.max(maxZ, mesh.positions[i]); }
    assert.ok(maxZ > 1.5 && maxZ < 2.3, `${family} top ${maxZ}`);
    assert.ok(minZ >= -freeboard - 1e-6, `${family} bottom ${minZ}`);
    if (family === 'masonry-arch') assert.ok(minZ <= -freeboard + 1e-6, 'abutments reach the water');
  }
});

test('surfacePose pitches the nose up a ramp', () => {
  const pose = surfacePose((x) => Math.max(0, x * 0.1), 5, 0, [1, 0], [-0.6, 0.6]);
  assert.ok(Math.abs(pose.height - 0.5) < 1e-9);
  assert.ok(Math.abs(pose.pitch - Math.atan2(0.12, 1.2)) < 1e-9);
  assert.ok(surfacePose((x) => Math.max(0, x * 0.1), 5, 0, [-1, 0]).pitch < 0, 'down the ramp');
});

test('fallback footprint deck: flat top at street level, fascia below it', () => {
  const deck = decodeFallback({ id: 'F', name: 'Flat', type: 'Vaste brug', ring: [0, 0, 100, 0, 100, 60, 0, 60] }, 0.1);
  assert.ok(pointInRing(deck.ring, 5, 3) && !pointInRing(deck.ring, 11, 3));
  const top = fallbackDeckTop(deck);
  assert.ok(Math.abs(meshArea(top) - 60) < 1e-6);
  const under = fallbackDeckUnderside(deck);
  for (const [nx, ny, nz, cx, cy, cz] of faceNormals(under)) {
    if (Math.abs(nz) > 1e-9) { assert.ok(nz < 0 && cz < 0, 'soffit faces down'); continue; }
    assert.ok(nx * (cx - 5) + ny * (cy - 3) > 0, 'fascia faces out');
  }
});

// Named regression locations against the published extract.
const EXTRACT = 'public/data/extracts/amsterdam/elevation-v1';
test('published extract: freeboard, named bridges and canal-belt shores', { skip: !existsSync(`${EXTRACT}/index.json`) }, () => {
  const index: ElevationIndex = validateIndex(JSON.parse(readFileSync(`${EXTRACT}/index.json`, 'utf8')));
  assert.ok(index.quayFreeboardM > 1.2 && index.quayFreeboardM < 2.3, `freeboard ${index.quayFreeboardM}`);
  const bridges: BridgeExtract = JSON.parse(readFileSync(`${EXTRACT}/bridges.json`, 'utf8'));
  const frame = new SceneFrame(index);
  const toScene = (x: number, y: number) => frame.fromLocal(x, y);
  const named = (id: string) => bridges.measured.find(b => b.id === id)!;
  // Papiermolensluis (Singel/Brouwersgracht): masonry hump, ~1.8 m crown.
  const papier = decodeProfile(named('BRU0057'), index.quantization.xy, toScene);
  assert.equal(papier.family, 'masonry-arch');
  assert.ok(Math.max(...papier.h) > 1.4, 'Papiermolensluis hump');
  assert.ok(papier.water, 'Papiermolensluis crosses water');
  // Frans Hendriksz. Oetgensbrug (Reguliersgracht): the extract's highest canal-belt crown.
  assert.ok(Math.max(...decodeProfile(named('BRU0076'), index.quantization.xy, toScene).h) > 1.9);
  // Hoofdbrug: a flat modern deck.
  assert.ok(Math.max(...decodeProfile(named('BRU0299'), index.quantization.xy, toScene).h) < 0.4);
  // The Magere Brug is movable and unmeasured: a flat footprint fallback.
  assert.ok(bridges.fallback.some(b => b.id === 'BRU0242' && b.name === 'Magere Brug'));
  // Every published profile is finite and non-negative.
  for (const b of bridges.measured) for (let i = 3; i < b.p.length; i += 4) assert.ok(b.p[i] >= 0 && Number.isFinite(b.p[i]));
  // The Herengracht at the Lekkeresluis cell has quay walls.
  const [x, y] = toScene(0, 0);
  assert.ok(Number.isFinite(x + y));
  const herengracht = lngLatToLocal(index, 4.8882, 52.3804);
  const key = `${Math.floor(herengracht[0] / index.cellSizeM)}_${Math.floor(herengracht[1] / index.cellSizeM)}`;
  const cell: WaterCell = JSON.parse(readFileSync(`${EXTRACT}/cells/${key}.json`, 'utf8'));
  assert.ok(shoreLength(cell, index.quantization.xy) > 5000, 'canal-belt cell has kilometres of quay');
});
