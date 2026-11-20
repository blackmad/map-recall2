/**
 * Het Pentagon (Theo Bosch, 1983): one model over its two BAG panden, so the whole ring round the courtyard is drawn.
 *
 *   node --import tsx scripts/landmarks/pentagon-prepare.ts
 *
 * Runs bag-shell-prepare.ts for each pand (BAG PDOK WFS CC0, 3DBAG LoD2.2 CC BY 4.0; cached in .cache/pand-reference) and
 * merges them into scripts/landmarks/pentagon-footprints.json in the frame of the main pand (0363100012171628, Sint
 * Antoniesbreestraat / Zuiderkerkhof / Zwanenburgwal / Raamgracht 43-45): x east, z south, y above each pand's own 3DBAG
 * ground (the two grounds differ by 0.6 m: 1.42 m NAP on the Sint Antoniesbreestraat side, 0.82 m NAP on the Raamgracht
 * / Moddermolenstraat side; each part stands on its own street). `nativeRings` holds the BAG ring of each pand and
 * `exposed` one flag per edge of it: false where the edge is the party wall between the two panden or abuts a neighbour
 * (outward probe at 20/50/80 % of the edge, 0.6 m out, inside another footprint of the building tiles, as
 * pand-reference/select.ts exposedWalls decides). `facadeRings` / `facadeExposed`: the same for the simplified rings (corners
 * of the stepped plan, where the balcony stacks stand).
 * The third pand on the Zuiderkerkhof (0363100012171627, Zuiderkerkhof 2-6, BAG 1982) is a separate block north of the
 * square and is not part of the Pentagon ring.
 */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {findPands, neighbourhood, pointInRing, type Footprint} from '../pand-reference/core.ts';

const PANDS = ['0363100012171628', '0363100012178153'] as const;
const OUT = 'scripts/landmarks/pentagon-footprints.json';
type Src = {bagId: string; anchorRD: number[]; anchor: number[]; groundNAP: number; attributes: Record<string, number | null>; sources: Record<string, string>; nativeRing: number[][]; facadeRing: number[][]; surfaces: {type: string; rings: number[][][]}[]};
const parts: Src[] = PANDS.map(p => {
  const tmp = `.cache/pentagon-${p}.json`;
  execFileSync('node', ['--import', 'tsx', 'scripts/landmarks/bag-shell-prepare.ts', 'pentagon', p, tmp], {stdio: 'inherit'});
  return JSON.parse(fs.readFileSync(tmp, 'utf8')) as Src;
});
const [A] = parts;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
// Re-express every part in A's frame (x east = RD x - ax, z south = -(RD y - ay)); y stays on its own ground.
const moved = parts.map(s => {
  const dx = s.anchorRD[0] - A.anchorRD[0], dz = -(s.anchorRD[1] - A.anchorRD[1]);
  const mv = (p: number[]) => [r3(p[0] + dx), r3(p[1] + dz)];
  return {
    ...s,
    nativeRing: s.nativeRing.map(mv),
    facadeRing: s.facadeRing.map(mv),
    surfaces: s.surfaces.map(f => ({type: f.type, rings: f.rings.map(r => r.map(p => [r3(p[0] + dx), p[1], r3(p[2] + dz)]))})),
  };
});
// Exposure per ring edge, in RD (z south = -y).
const fps = await findPands(PANDS.map(p => `NL.IMBAG.Pand.${p}`));
const others: Footprint[] = await neighbourhood({x: A.anchorRD[0], y: A.anchorRD[1]});
const toRd = (p: number[]) => ({x: A.anchorRD[0] + p[0], y: A.anchorRD[1] - p[1]});
const exposure = (ring: number[][], k: number) => ring.map((a, i) => {
  const c = ring[(i + 1) % ring.length];
  const pa = toRd(a), pc = toRd(c), dx = pc.x - pa.x, dy = pc.y - pa.y, len = Math.hypot(dx, dy);
  // outward normal: the side not inside this pand's own ring
  let nx = dy / len, ny = -dx / len;
  const own = moved[k].nativeRing.map(toRd);
  const mid = {x: pa.x + dx / 2 + nx * 0.3, y: pa.y + dy / 2 + ny * 0.3};
  if (pointInRing(mid, own)) { nx = -nx; ny = -ny; }
  const free = [0.2, 0.5, 0.8].filter(t => {
    const p = {x: pa.x + dx * t + nx * 0.6, y: pa.y + dy * t + ny * 0.6};
    return !others.some(o => o.id !== `NL.IMBAG.Pand.${PANDS[k]}` && pointInRing(p, o.ring));
  }).length;
  return free >= 2;
});
const exposed = moved.map((s, k) => exposure(s.nativeRing, k));
const facadeExposed = moved.map((s, k) => exposure(s.facadeRing, k));
const out = {
  id: 'pentagon', bagId: PANDS[0], extraBagIds: [PANDS[1]],
  anchorRD: A.anchorRD, anchor: A.anchor, groundNAP: A.groundNAP,
  groundsNAP: parts.map(s => s.groundNAP),
  coordinateConvention: 'native east/south metres from the anchor of pand 0363100012171628; y above the 3DBAG ground of the pand each surface belongs to',
  sources: Object.fromEntries(parts.flatMap(s => Object.entries(s.sources).map(([k, v]) => [`${k}-${s.bagId}`, v]))),
  attributes: Object.fromEntries(parts.map(s => [s.bagId, s.attributes])),
  nativeRing: moved[0].nativeRing,
  nativeRings: moved.map(s => s.nativeRing),
  facadeRings: moved.map(s => s.facadeRing),
  exposed,
  facadeExposed,
  footprintsFound: [...fps.keys()],
  surfaces: moved.flatMap(s => s.surfaces),
  surfacePand: moved.flatMap((s, k) => s.surfaces.map(() => k)),
};
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
console.log(OUT, 'surfaces', out.surfaces.length, 'exposed edges', exposed.map(e => `${e.filter(Boolean).length}/${e.length}`).join(' '));
