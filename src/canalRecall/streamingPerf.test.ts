// Motion-stutter fixes (docs/perf-motion-stutter-20261016.md): each keeps what is drawn identical.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decorateRoof, roofPlanForFeature } from './roofMesh.js';
import { sameStyledFeature } from './buildingTilesBrowser.js';
import { boundingSphereOf } from './geometryBounds.js';

const LAT = 52.372, KX = 111_320 * Math.cos(LAT * Math.PI / 180), KY = 110_540;
const ring = (pts: [number, number][]) => [...pts, pts[0]].map(([x, y]) => [4.88 + x / KX, LAT + y / KY]);
const feature = (id: string, pts: [number, number][], props: Record<string, unknown> = {}) => ({
  type: 'Feature' as const,
  properties: { id, facade: 'canal', facadeStyle: 'canal', height: 14, minHeight: 0, constructionYear: 1700, ...props } as Record<string, unknown>,
  geometry: { type: 'Polygon', coordinates: [ring(pts)] },
});
const shapes: Record<string, [number, number][]> = {
  rect: [[0, 0], [8, 0], [8, 18], [0, 18]],
  ell: [[0, 0], [20, 0], [20, 8], [8, 8], [8, 22], [0, 22]],
  skew: [[0, 0], [9, 1], [10, 16], [-1, 15]],
  tee: [[0, 0], [24, 0], [24, 7], [15, 7], [15, 20], [9, 20], [9, 7], [0, 7]],
};

test('decorateRoof memo returns what an unmemoised plan gives, and follows changed inputs', () => {
  for (const [name, pts] of Object.entries(shapes)) {
    for (const style of ['canal', 'c19', 'school']) {
      for (const height of [9, 14, 21]) {
        const f = feature(`w${name}`, pts, { facadeStyle: style, height });
        const plan = roofPlanForFeature(f);
        const first = decorateRoof(f), again = decorateRoof({ ...f, properties: { ...f.properties } });
        assert.deepEqual(again, first, `${name} ${style} ${height}: second call differs`);
        assert.equal(first.properties.roofShape, plan ? plan.kind : f.properties.roofShape, `${name} ${style} ${height}: kind`);
        if (plan) assert.equal(first.properties.roofEavesHeightM, height - plan.riseM);
      }
    }
    // Same geometry object, different height: a fresh plan, not the cached one.
    const f = feature(`w${name}`, pts, { height: 12 });
    const taller = { ...f, properties: { ...f.properties, height: 24 } as Record<string, unknown> };
    const plan = roofPlanForFeature(taller);
    decorateRoof(f);
    const out = decorateRoof(taller);
    if (plan) assert.equal(out.properties.roofEavesHeightM, 24 - plan.riseM);
  }
});

test('sameStyledFeature: same geometry and shallow-equal properties only', () => {
  const f = feature('a', shapes.rect, { tags: [1, 2] });
  assert.ok(sameStyledFeature(f as any, { ...f, properties: { ...f.properties, tags: [1, 2] } } as any));
  assert.ok(!sameStyledFeature(f as any, { ...f, properties: { ...f.properties, height: 15 } } as any));
  assert.ok(!sameStyledFeature(f as any, { ...f, properties: { ...f.properties, extra: true } } as any));
  assert.ok(!sameStyledFeature(f as any, { ...f, geometry: JSON.parse(JSON.stringify(f.geometry)) } as any));
});

test('boundingSphereOf matches three.js computeBoundingSphere exactly', async () => {
  const THREE = await import('three');
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (const n of [3, 10, 1000, 20000]) {
    const positions = new Float32Array(n * 3).map(() => (rnd() - 0.3) * 1500);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    const ours = boundingSphereOf(positions);
    assert.deepEqual(ours.center, geometry.boundingSphere!.center.toArray());
    assert.equal(ours.radius, geometry.boundingSphere!.radius);
  }
});

