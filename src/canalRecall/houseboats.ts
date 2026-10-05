// Low-poly houseboats from OSM footprints.
//
// Amsterdam has ~3,000 houseboats mapped as `building=houseboat`, and they line the
// canals the player rides along, yet the building tiles carried almost none of them.
// Two kinds cover nearly all of them:
//   - an ark (woonark): a box-shaped floating house on a concrete pontoon, mapped as a
//     rectangle; a grey pontoon, a painted timber cabin with white-framed windows, a flat,
//     gabled or barrel roof, a stove pipe, and an open deck with potted plants at one end;
//   - a converted barge (woonschip): a long hull mapped by tracing its outline (bow curve
//     included); a dark hull with a pale gunwale stripe and a raised bow, a low cabin
//     amidships with plants on its roof, a wheelhouse aft and a Dutch flag at the stern.
// Real Amsterdam houseboats are cheerful: cream, sky blue, sage, ochre and barn red
// cabins, green roofs, bright doors. Dark hulls stay on the barges, where they are true.
// Everything is derived from the footprint and a hash of the id, so a boat keeps its
// look between sessions. Flat colours only, recoloured per Building look by the caller.

import earcut from 'earcut';
import { fitRect } from './roofMesh.js';
import type { KitPartGeometry, KitTri } from './landmarkKits.js';

export type Houseboat = { id: string; ring: [number, number][]; levels?: number; roof?: string; name?: string; kind?: string };
type V3 = [number, number, number];

/** Concrete pontoons, a few painted. */
const ARK_HULLS = ['#9a9b96', '#a8a49a', '#8d9494', '#a3abae', '#6f8090'];
/** Barge steel: black-blue, bottle green, slate, oxblood, navy. */
const BARGE_HULLS = ['#2c3a4a', '#25443a', '#3a4148', '#6a2f29', '#24456b'];
const ARK_CABINS = ['#f3efe4', '#efe0b8', '#9fc4dc', '#a9c5a2', '#c4e1d2', '#f2cf73', '#dba24a', '#cf6f4f', '#b8473c', '#3f6f57', '#c99c6a', '#5f88b3', '#e9b7b0'];
/** Varnished timber, or painted green, blue, white and red. */
const BARGE_CABINS = ['#a8743f', '#c08a52', '#2f6b55', '#2f6696', '#f0ebde', '#9a3530', '#477a45'];
/** Bitumen and zinc, and the sedum roofs many arks carry. */
const ROOFS = ['#6a6e72', '#8a857c', '#9aa1a6', '#7c9a5e', '#8fae6a', '#a35d45', '#7d8a94'];
const DOORS = ['#c0392b', '#2f6e4f', '#2d5d8c', '#efc24a', '#3d3d3d', '#7b4a8c'];
const FLOWERS = ['#e0475a', '#f08a3c', '#e86fa8', '#f4d54a', '#ffffff'];
const DECK = '#b08a5c', GLASS = '#4d687d', FRAME = '#f7f3ea', GUNWALE = '#f1ece0', LEAF = '#4f8a3c', POT = '#b8643c', PIPE = '#2f2f2f';
const FLAG = ['#ae1c28', '#ffffff', '#21468b'];
/** Water level is the map's ground plane; the hull's waterline sits just below it. */
const WATERLINE = -0.1;

function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
const pick = <T>(list: readonly T[], id: string, salt: string) => list[Math.floor(hash(`${id}:${salt}`) * list.length) % list.length];

class Sink {
  readonly tris: KitTri[] = [];
  tri(a: V3, b: V3, c: V3, hex: string, hint: V3) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) { [b, c] = [c, b]; n = [-n[0], -n[1], -n[2]]; }
    const l = Math.hypot(...n);
    if (l < 1e-9) return;
    this.tris.push({ p: [a, b, c], uv: [[0, 0], [1, 0], [1, 1]], layer: 'flat', hex, n: [n[0] / l, n[1] / l, n[2] / l] });
  }
  quad(a: V3, b: V3, c: V3, d: V3, hex: string, hint: V3) { this.tri(a, b, c, hex, hint); this.tri(a, c, d, hex, hint); }
}

/** Footprint evidence, independent of tracing density. A detailed rectangular
 * pontoon is still an ark; a barge requires an elongated body and a tapered end.
 * Ambiguous outlines keep the simpler residential form instead of guessed rigging. */
export function classifyHouseboatHull(points: readonly (readonly [number,number])[], length:number, width:number): 'ark'|'barge' {
 if(points.length<3||length<=0||width<=0)return 'ark';
 let area=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];area+=p[0]*q[1]-q[0]*p[1];}
 const occupancy=Math.abs(area)/2/(length*width);
 const section=(a:number)=>{const hits:number[]=[];for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];if((p[0]<=a&&q[0]>a)||(q[0]<=a&&p[0]>a))hits.push(p[1]+(q[1]-p[1])*(a-p[0])/(q[0]-p[0]));}return hits.length>=2?Math.max(...hits)-Math.min(...hits):0;};
 const body=Math.max(section(-length*.15),section(0),section(length*.15));
 const endWidth=Math.min(section(-length*.46),section(length*.46));
 return length/width>=2.3&&occupancy<.96&&body>0&&endWidth/body<.86?'barge':'ark';
}

/** One boat's triangles in local metres from `origin` (x east, y north, z up). */
export function houseboatGeometry(boat: Houseboat, origin: { lng: number; lat: number }): KitPartGeometry | null {
  const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
  let pts = boat.ring.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * ky] as [number, number]);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
  if (pts.length < 3) return null;
  const rect = fitRect([...pts, pts[0]], 64);
  if (!rect) return null;
  // Boat frame: u along the length, v across, centred on the fitted rectangle.
  let ux = rect.ux, uy = rect.uy, L = rect.len, W = rect.wid;
  if (W > L) { [ux, uy] = [-uy, ux]; [L, W] = [W, L]; }
  const vx = -uy, vy = ux, cx = rect.cx, cy = rect.cy;
  const at = (a: number, b: number, z: number): V3 => [cx + ux * a + vx * b, cy + uy * a + vy * b, z];
  const dir = (a: number, b: number, z: number): V3 => [ux * a + vx * b, uy * a + vy * b, z];
  const sink = new Sink(), id = boat.id;
  /** An axis-aligned box in the boat frame; `hex` colours the lid (none when null), `side` the walls. */
  const box = (a0: number, a1: number, b0: number, b1: number, z0: number, z1: number, hex: string | null, bottom = false, side = hex ?? PIPE) => {
    if (hex) sink.quad(at(a0, b0, z1), at(a1, b0, z1), at(a1, b1, z1), at(a0, b1, z1), hex, [0, 0, 1]);
    sink.quad(at(a0, b0, z0), at(a1, b0, z0), at(a1, b0, z1), at(a0, b0, z1), side, dir(0, -1, 0));
    sink.quad(at(a0, b1, z0), at(a1, b1, z0), at(a1, b1, z1), at(a0, b1, z1), side, dir(0, 1, 0));
    sink.quad(at(a0, b0, z0), at(a0, b1, z0), at(a0, b1, z1), at(a0, b0, z1), side, dir(-1, 0, 0));
    sink.quad(at(a1, b0, z0), at(a1, b1, z0), at(a1, b1, z1), at(a1, b0, z1), side, dir(1, 0, 0));
    if (bottom) sink.quad(at(a0, b0, z0), at(a1, b0, z0), at(a1, b1, z0), at(a0, b1, z0), side, [0, 0, -1]);
  };
  /** Windows as panes just proud of a side wall (b < 0 or b > 0 picks the side). */
  const sideWindows = (a0: number, a1: number, b: number, z0: number, z1: number, every: number, width: number) => {
    const n = Math.max(1, Math.floor((a1 - a0) / every)), step = (a1 - a0) / n, out = Math.sign(b) * 0.04;
    for (let k = 0; k < n; k++) {
      const m = a0 + step * (k + 0.5);
      sink.quad(at(m - width / 2 - 0.1, b + out * 0.5, z0 - 0.1), at(m + width / 2 + 0.1, b + out * 0.5, z0 - 0.1), at(m + width / 2 + 0.1, b + out * 0.5, z1 + 0.1), at(m - width / 2 - 0.1, b + out * 0.5, z1 + 0.1), FRAME, dir(0, Math.sign(b), 0));
      sink.quad(at(m - width / 2, b + out, z0), at(m + width / 2, b + out, z0), at(m + width / 2, b + out, z1), at(m - width / 2, b + out, z1), GLASS, dir(0, Math.sign(b), 0));
    }
  };
  /** A terracotta pot with a shrub, or a flowering one, standing at (a, b) on a surface at z. */
  const plant = (a: number, b: number, z: number, salt: string) => {
    const r = 0.22 + hash(`${id}:${salt}:r`) * 0.08, h = 0.45 + hash(`${id}:${salt}:h`) * 0.35;
    box(a - r, a + r, b - r, b + r, z, z + 0.35, null, false, POT);
    const top = hash(`${id}:${salt}:f`) < 0.5 ? pick(FLOWERS, id, `${salt}:c`) : LEAF;
    box(a - r - 0.08, a + r + 0.08, b - r - 0.08, b + r + 0.08, z + 0.35, z + 0.35 + h, top, false, LEAF);
  };
  /** A stove pipe with a little cap. */
  const pipe = (a: number, b: number, z: number) => {
    box(a - 0.09, a + 0.09, b - 0.09, b + 0.09, z, z + 0.9, null);
    box(a - 0.16, a + 0.16, b - 0.16, b + 0.16, z + 0.9, z + 1.0, PIPE);
  };
  /** Preserve the mapped pontoon perimeter, including notches. */
  const pontoon=(ring: [number,number][],base:number,top:number,hex:string)=>{
    const index=earcut(ring.flat());
    for(let i=0;i<index.length;i+=3)sink.tri(...index.slice(i,i+3).map(k=>[ring[k][0],ring[k][1],top] as V3) as [V3,V3,V3],hex,[0,0,1]);
    const area=ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-q[0]*p[1];},0);
    for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];sink.quad([p[0],p[1],base],[q[0],q[1],base],[q[0],q[1],top],[p[0],p[1],top],hex,area>0?[q[1]-p[1],p[0]-q[0],0]:[p[1]-q[1],q[0]-p[0],0]);}
  };
  const roofHex = pick(ROOFS, id, 'roof'), doorHex = pick(DOORS, id, 'door');
  const form=classifyHouseboatHull(pts.map(([x,y])=>[(x-cx)*ux+(y-cy)*uy,(x-cx)*vx+(y-cy)*vy]),L,W);
  const traced=form==='barge';

  if (!traced) {
    // An ark: pontoon, cabin over most of it, an open deck at one end.
    const cabinHex = pick(ARK_CABINS, id, 'cabin'), hullHex = pick(ARK_HULLS, id, 'hull');
    const hullTop = 0.5;
    pontoon(pts,WATERLINE,hullTop,hullHex);
    const deckLen = Math.min(3.5, Math.max(1.4, L * 0.14)), deckAtStart = hash(`${id}:deck`) < 0.5;
    const a0 = deckAtStart ? -L / 2 + deckLen : -L / 2 + 0.3, a1 = deckAtStart ? L / 2 - 0.3 : L / 2 - deckLen;
    const half = Math.max(1, W / 2 - 0.3), levels = Math.max(1,Math.min(3,boat.levels??1));
    const height = levels * 2.5 + hash(`${id}:height`) * 0.3, top = hullTop + height;
    // Clip the timber deck to the source outline as well; a rectangle would
    // refill the very pontoon notch retained by the hull below it.
    const clip=(poly:[number,number][],axis:0|1,value:number,above:boolean)=>{const out:[number,number][]=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],inside=above?p[axis]>=value:p[axis]<=value,next=above?q[axis]>=value:q[axis]<=value;if(inside)out.push(p);if(inside!==next){const t=(value-p[axis])/(q[axis]-p[axis]);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}return out;};
    let deck=pts.map(([x,y])=>[(x-cx)*ux+(y-cy)*uy,(x-cx)*vx+(y-cy)*vy] as [number,number]);
    deck=clip(clip(clip(clip(deck,0,deckAtStart?-L/2:a1,true),0,deckAtStart?a0:L/2,false),1,-W/2+.05,true),1,W/2-.05,false);
    if(deck.length>=3)pontoon(deck.map(([a,b])=>{const p=at(a,b,0);return [p[0],p[1]];}),hullTop,hullTop+.08,DECK);
    box(a0, a1, -half, half, hullTop, top, cabinHex);
    for (let level = 0; level < levels; level++) {
      const z0 = hullTop + level * 2.5 + 0.8, z1 = z0 + 1.2;
      sideWindows(a0 + 0.4, a1 - 0.4, -half, z0, z1, 2.3, 1.4);
      sideWindows(a0 + 0.4, a1 - 0.4, half, z0, z1, 2.3, 1.4);
    }
    // A bright door and a window on the deck end, and pots on the deck.
    const endA = deckAtStart ? a0 - 0.04 : a1 + 0.04, endDir = dir(deckAtStart ? -1 : 1, 0, 0), deckZ = hullTop + 0.08;
    sink.quad(at(endA - Math.sign(endDir[0] * ux + endDir[1] * uy) * 0.01, -0.55, hullTop + 0.02), at(endA, 0.55, hullTop + 0.02), at(endA, 0.55, hullTop + 2.15), at(endA, -0.55, hullTop + 2.15), FRAME, endDir);
    const doorA = endA + (deckAtStart ? -0.02 : 0.02);
    sink.quad(at(doorA, -0.45, hullTop + 0.05), at(doorA, 0.45, hullTop + 0.05), at(doorA, 0.45, hullTop + 2.05), at(doorA, -0.45, hullTop + 2.05), doorHex, endDir);
    if (half > 1.6) sink.quad(at(doorA, 0.8, hullTop + 0.9), at(doorA, Math.min(half - 0.3, 2.2), hullTop + 0.9), at(doorA, Math.min(half - 0.3, 2.2), hullTop + 1.9), at(doorA, 0.8, hullTop + 1.9), GLASS, endDir);
    const deckMid = deckAtStart ? -L / 2 + deckLen * 0.5 : L / 2 - deckLen * 0.5;
    if (W > 2.6) plant(deckMid, -W / 2 + 0.55, deckZ, 'p1');
    if (W > 4 && hash(`${id}:p2`) < 0.7) plant(deckMid, W / 2 - 0.55, deckZ, 'p2');
    const roofKind = boat.roof === 'gabled' || boat.roof === 'hipped' ? 'gable' : boat.roof === 'round' ? 'barrel' : boat.roof === 'flat' ? 'flat'
      : (r => r < 0.22 ? 'gable' : r < 0.45 ? 'barrel' : 'flat')(hash(`${id}:pitch`));
    // The stove pipe stands at the far end from the deck.
    const pipeA = deckAtStart ? a1 - 1.0 : a0 + 1.0, pipeB = half * 0.45;
    if (roofKind === 'gable') {
      // A low gabled roof along the length, with gable triangles in the cabin colour.
      const o = 0.2, rise = Math.min(1.6, half * 0.55), ridge = top + rise;
      sink.quad(at(a0 - o, -half - o, top), at(a1 + o, -half - o, top), at(a1 + o, 0, ridge), at(a0 - o, 0, ridge), roofHex, dir(0, -1, 1.5));
      sink.quad(at(a0 - o, half + o, top), at(a1 + o, half + o, top), at(a1 + o, 0, ridge), at(a0 - o, 0, ridge), roofHex, dir(0, 1, 1.5));
      sink.tri(at(a0, -half, top), at(a0, half, top), at(a0, 0, ridge), cabinHex, dir(-1, 0, 0));
      sink.tri(at(a1, -half, top), at(a1, half, top), at(a1, 0, ridge), cabinHex, dir(1, 0, 0));
      pipe(pipeA, pipeB, top + rise * (1 - pipeB / half) - 0.1);
    } else if (roofKind === 'barrel') {
      // A shallow barrel roof, the arched woonark roof, with white end arches.
      const rise = Math.min(1.1, half * 0.45), segs = 5;
      const arc = (k: number) => { const t = Math.PI * k / segs; return [-Math.cos(t) * (half + 0.1), top + Math.sin(t) * rise] as const; };
      for (let k = 0; k < segs; k++) {
        const [b0, z0] = arc(k), [b1, z1] = arc(k + 1), mid = (k + 0.5) / segs * Math.PI;
        sink.quad(at(a0 - 0.1, b0, z0), at(a1 + 0.1, b0, z0), at(a1 + 0.1, b1, z1), at(a0 - 0.1, b1, z1), roofHex, dir(0, -Math.cos(mid), Math.sin(mid)));
        sink.tri(at(a0 - 0.1, 0, top), at(a0 - 0.1, b0, z0), at(a0 - 0.1, b1, z1), FRAME, dir(-1, 0, 0));
        sink.tri(at(a1 + 0.1, 0, top), at(a1 + 0.1, b0, z0), at(a1 + 0.1, b1, z1), FRAME, dir(1, 0, 0));
      }
      pipe(pipeA, pipeB, top + rise * Math.sqrt(Math.max(0, 1 - (pipeB / half) ** 2)) - 0.1);
    } else {
      // Flat roof: a thin slab with a white fascia, often green.
      box(a0 - 0.15, a1 + 0.15, -half - 0.15, half + 0.15, top, top + 0.2, roofHex, true, FRAME);
      pipe(pipeA, pipeB, top + 0.2);
    }
  } else {
    // A barge: the traced outline is the hull; a low cabin amidships and a wheelhouse at the
    // squarer (stern) end, since the bow is the pointed one. The deck sweeps up towards the bow.
    const cabinHex = pick(BARGE_CABINS, id, 'cabin'), hullHex = pick(BARGE_HULLS, id, 'hull');
    const hullTop = 0.9, stripe = 0.16;
    const widthAt = (a: number) => {
      let w = 0;
      for (const [x, y] of pts) { const pa = (x - cx) * ux + (y - cy) * uy; if (Math.abs(pa - a) < L * 0.08) w = Math.max(w, Math.abs((x - cx) * vx + (y - cy) * vy)); }
      return w;
    };
    const stern = widthAt(L * 0.42) >= widthAt(-L * 0.42) ? 1 : -1;
    const sheer = (x: number, y: number) => {
      const f = Math.max(0, Math.min(1, (-stern * ((x - cx) * ux + (y - cy) * uy) / (L / 2) - 0.55) / 0.45));
      return hullTop + 0.55 * f * f;
    };
    const flat = pts.flat(), index = earcut(flat);
    for (let i = 0; i < index.length; i += 3) {
      const [a, b, c] = [index[i], index[i + 1], index[i + 2]].map(k => [pts[k][0], pts[k][1], sheer(pts[k][0], pts[k][1])] as V3);
      sink.tri(a, b, c, DECK, [0, 0, 1]);
    }
    let area2 = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], t0 = sheer(x0, y0), t1 = sheer(x1, y1);
      // Outward is right of travel on a counter-clockwise ring.
      const nx = area2 > 0 ? y1 - y0 : y0 - y1, ny = area2 > 0 ? x0 - x1 : x1 - x0;
      sink.quad([x0, y0, WATERLINE], [x1, y1, WATERLINE], [x1, y1, t1 - stripe], [x0, y0, t0 - stripe], hullHex, [nx, ny, 0]);
      sink.quad([x0, y0, t0 - stripe], [x1, y1, t1 - stripe], [x1, y1, t1], [x0, y0, t0], GUNWALE, [nx, ny, 0]);
    }
    const half = Math.max(0.8, W / 2 - 0.6);
    const c0 = Math.min(-0.34 * L * stern, 0.28 * L * stern), c1 = Math.max(-0.34 * L * stern, 0.28 * L * stern), cabinTop = hullTop + 1.9;
    box(c0, c1, -half, half, hullTop, cabinTop, cabinHex);
    box(c0 - 0.15, c1 + 0.15, -half - 0.15, half + 0.15, cabinTop, cabinTop + 0.12, roofHex, true, FRAME);
    sideWindows(c0 + 0.4, c1 - 0.4, -half, hullTop + 0.55, hullTop + 1.5, 2.1, 1.1);
    sideWindows(c0 + 0.4, c1 - 0.4, half, hullTop + 0.55, hullTop + 1.5, 2.1, 1.1);
    // Pots along the cabin roof, the barge dweller's garden, and the stove pipe.
    const roofZ = cabinTop + 0.12, pots = Math.min(2, Math.floor((c1 - c0) / 5));
    for (let k = 0; k < pots; k++) if (hash(`${id}:roofpot${k}`) < 0.75) plant(c0 + (c1 - c0) * (k + 0.5) / (pots + 0.5), (k % 2 ? 1 : -1) * half * 0.5, roofZ, `roofpot${k}`);
    pipe(stern > 0 ? c1 - 0.8 : c0 + 0.8, half * 0.5, roofZ);
    const w0 = Math.min(0.33 * L * stern, (0.33 * L + 2.2) * stern), w1 = Math.max(0.33 * L * stern, (0.33 * L + 2.2) * stern);
    const wh = Math.max(0.7, Math.min(half, 1.2)), whTop = hullTop + 2.4;
    box(w0, w1, -wh, wh, hullTop, whTop, cabinHex);
    box(w0 - 0.15, w1 + 0.15, -wh - 0.15, wh + 0.15, whTop, whTop + 0.12, roofHex, true, FRAME);
    sideWindows(w0 + 0.2, w1 - 0.2, -wh, hullTop + 1.25, hullTop + 2.1, 2.2, 1.6);
    sideWindows(w0 + 0.2, w1 - 0.2, wh, hullTop + 1.25, hullTop + 2.1, 2.2, 1.6);
    // A Dutch flag on a staff at the stern, flying aft.
    const staffA = stern * (L / 2 - 0.6);
    if (Math.abs(staffA) > Math.max(Math.abs(w0), Math.abs(w1)) + 0.4 && widthAt(staffA) > 0.4) {
      const z = sheer(cx + ux * staffA, cy + uy * staffA), poleTop = z + 2.4;
      box(staffA - 0.05, staffA + 0.05, -0.05, 0.05, z, poleTop, FRAME);
      for (let k = 0; k < 3; k++) {
        const zt = poleTop - 0.05 - k * 0.22, zb = zt - 0.22, a1 = staffA + stern * 1.0;
        for (const s of [-1, 1]) sink.quad(at(staffA, 0, zb), at(a1, 0, zb), at(a1, 0, zt), at(staffA, 0, zt), FLAG[k], dir(0, s, 0));
      }
    }
  }
  return { id, tris: sink.tris };
}

/** Group boats by the z14 tile of their first vertex, the building layer's chunk key. */
export function houseboatsByTile(boats: readonly Houseboat[]): Map<string, Houseboat[]> {
  const out = new Map<string, Houseboat[]>();
  for (const boat of boats) {
    const [lng, lat] = boat.ring[0];
    const n = 2 ** 14, rad = lat * Math.PI / 180;
    const key = `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)}`;
    let list = out.get(key);
    if (!list) out.set(key, list = []);
    list.push(boat);
  }
  return out;
}

/** Landmark types that can be aboard a boat. A crane, statue or memorial on
 *  the quay beside a moored boat is not the boat (Kraan 2868 stands 4 m from
 *  one). */
const ABOARD_TYPES = new Set(['museum', 'hotel', 'restaurant', 'cafe', 'bar', 'gallery', 'theatre', 'attraction']);
/** m — a landmark point this close to a hull's outline is on that boat. The
 *  Houseboat Museum's OSM node sits 1.8 m outside the Hendrika Maria's traced
 *  outline; the nearest quay-side landmark is 3.9 m from its boat. */
export const ABOARD_TOLERANCE_M = 3;

/**
 * The houseboat a landmark is, for a landmark with no building of its own:
 * the Houseboat Museum is a barge, so `landmark-buildings.json` (a join on
 * building ways) has nothing for it and the card lit nothing (user report
 * 2026-10-03, "houseboat museum doesn't light up yellow"). The point must lie
 * inside a boat's outline or within `ABOARD_TOLERANCE_M` of it, and the
 * landmark must be a kind of place a boat can be.
 */
export function boatForLandmark(boats: readonly Houseboat[], lngLat: readonly [number, number], type: string | undefined): string | null {
  if (!type || !ABOARD_TYPES.has(type)) return null;
  const [lng, lat] = lngLat;
  const mx = 111320 * Math.cos(lat * Math.PI / 180), my = 110540;
  let best: string | null = null, bestDistance = ABOARD_TOLERANCE_M;
  for (const boat of boats) {
    const ring = boat.ring;
    if (Math.abs((ring[0][0] - lng) * mx) > 200 || Math.abs((ring[0][1] - lat) * my) > 200) continue;
    let inside = false, nearest = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - lng) * mx, ay = (ring[j][1] - lat) * my;
      const bx = (ring[i][0] - lng) * mx, by = (ring[i][1] - lat) * my;
      if ((ay > 0) !== (by > 0) && 0 < ax + (bx - ax) * (0 - ay) / (by - ay)) inside = !inside;
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
    }
    if (inside) return boat.id;
    if (nearest <= bestDistance) { best = boat.id; bestDistance = nearest; }
  }
  return best;
}
