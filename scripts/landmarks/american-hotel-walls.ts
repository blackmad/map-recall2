/**
 * Which ring edges of the American Hotel footprint make up each photographed wall of the brief (the wall tags of
 * american-hotel-brief.md), and where a crop's along-wall coordinate s lands on a ring edge's frame t (ringFrame of
 * nearbar-kit, t from the frame origin). The rectified crops start at the wall's viewer-left corner (`Wall.a`), so
 * t = s - s0 on the edge listed. Same method as hoofdbureau-elandsgracht-walls.ts.
 *
 *   node --import tsx scripts/landmarks/american-hotel-walls.ts
 */
import {findPands, lngLatToRd, neighbourhood, normId} from '../pand-reference/core.ts';
import {exposedWalls} from '../pand-reference/select.ts';
import {ringFrame} from './nearbar-kit.ts';
import source from './american-hotel-footprints.json' with {type: 'json'};

const [lng, lat] = source.anchor as [number, number];
const A = lngLatToRd([lng, lat]) as unknown as {x: number; y: number};
const id = normId('0363100012168734');
const fp = (await findPands([id])).get(id)!;
const centre = {x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length};
const walls = exposedWalls(fp, await neighbourhood(centre)).sort((a, b) => b.len - a.len).filter(w => w.len >= 4).slice(0, 30);
const bearingOf = (nx: number, ny: number) => Math.round((Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360);
const loc = (p: {x: number; y: number}): [number, number] => [p.x - A.x, A.y - p.y];
const ring = (source.nativeRing as number[][]).slice(0, -1);
walls.forEach((w, i) => {
  const tag = `w${String(i + 1).padStart(2, '0')}-${bearingOf(w.nx, w.ny)}`;
  const a = loc(w.a), b = loc(w.b), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
  console.log(`${tag} ${w.len.toFixed(1)} m a ${a.map(x => x.toFixed(2))} b ${b.map(x => x.toFixed(2))}`);
  for (let e = 0; e < ring.length; e++) {
    const {f, len: el} = ringFrame(ring, e);
    if (el < 0.3) continue;
    if (f.tangent[0] * tx + f.tangent[1] * tz < 0.9) continue;
    const s0 = (f.origin[0] - a[0]) * tx + (f.origin[1] - a[1]) * tz;
    const off = (f.origin[0] - a[0]) * -tz + (f.origin[1] - a[1]) * tx;
    if (Math.abs(off) > 1.5 || s0 > len + 0.2 || s0 + el < -0.2) continue;
    console.log(`   edge ${e} len ${el.toFixed(2)} s ${s0.toFixed(2)}..${(s0 + el).toFixed(2)} (t = s - ${s0.toFixed(2)}) offset ${off.toFixed(2)}`);
  }
});
