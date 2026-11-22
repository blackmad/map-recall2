import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, type Frame} from './nearbar-kit';
import {lipFromHead, stripedAwning, type AwningPolygon, type StripedAwningOpts, type TO} from '../../src/canalRecall/landmarks/stripedAwning';

/**
 * Builder adapter for src/canalRecall/landmarks/stripedAwning.ts: a striped fabric canopy (markies) on a wall frame
 * (nearbar-kit Frame: t along the wall, y up, o out of the wall). `head` is the canopy's head line in (t, o); the lip is
 * `proj` out from it (`lipFromHead`). Stripe 0 is drawn in `colours[0]`, stripe 1 in `colours[1]` (pass the same name
 * twice for a plain canopy). One geometry per colour.
 */
export function stripedAwningOn(b: BuildingTools, f: Frame, o: Omit<StripedAwningOpts, 'lip'> & {proj: number; endProj?: number; colours: [string, string]}) {
  const lip = lipFromHead(o.head, o.proj, o.endProj);
  const r = stripedAwning({...o, lip});
  const polys = [...r.cloth, ...r.valance, ...r.cheeks];
  const byColour = new Map<string, number[]>();
  for (const p of polys) {
    const c = o.colours[p.stripe];
    const arr = byColour.get(c) ?? [];
    fan(p, arr);
    byColour.set(c, arr);
  }
  for (const [c, pos] of byColour) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    put(b, f, g, 0, 0, 0, c);
  }
  return r;
}

/** Fan-triangulate a convex polygon in (t, y, o) into local (x = t, y, z = o) positions. */
function fan(p: AwningPolygon, out: number[]) {
  const q = p.pts;
  for (let i = 1; i + 1 < q.length; i++) for (const v of [q[0], q[i], q[i + 1]]) out.push(v[0], v[1], v[2]);
}

/** Canted-bay head line: a front `front` wide, `depth` out, its cants reaching the wall at c +- half. */
export function cantedHead(c: number, half: number, front: number, depth: number, oBase = 0): TO[] {
  return [[c - half, oBase], [c - front / 2, oBase + depth], [c + front / 2, oBase + depth], [c + half, oBase]];
}
