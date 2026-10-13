/**
 * Rectified straight-on elevation of ANY 3DBAG wall of a large building (pand-reference only handles the single "front" wall).
 *   node --import tsx scripts/landmarks/big-rectify.ts <id> <wallIndex> <t0> <t1> <heightM> <out.jpg> [ppm=40] [pickIndex=0] [minYear=2019]
 * t0..t1 are tangent offsets (m) along the wall as in big-kit rawWall (viewer's right when facing the wall from outside).
 * Prints the chosen panorama so it can be listed in <id>-research.json.
 */
import fs from 'node:fs';
import {rawWall} from './big-kit';
import {lngLatToRd} from '../pand-reference/core.ts';
import {listPanos, rankPanos} from '../pand-reference/select.ts';
import {loadPano, rectifyWall} from '../pand-reference/rectify.ts';

const [id, wallIdx, t0s, t1s, hs, out, ppms = '40', pickIdx = '0', minYear = '2019'] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(`scripts/landmarks/${id}-footprints.json`, 'utf8'));
const w = rawWall(src, +wallIdx), t0 = +t0s, t1 = +t1s;
const anchor: [number, number] = src.anchor;
const toLL = (x: number, z: number): [number, number] => [anchor[0] + x / (111320 * Math.cos(anchor[1] * Math.PI / 180)), anchor[1] - z / 111320];
const at = (t: number): [number, number] => [w.f.origin[0] + w.f.tangent[0] * t, w.f.origin[1] + w.f.tangent[1] * t];
const a = lngLatToRd(toLL(...at(t0))), b = lngLatToRd(toLL(...at(t1)));
const len = Math.hypot(b.x - a.x, b.y - a.y);
const mid = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
const wall = {a, b, len, nx: w.f.n[0], ny: -w.f.n[1], mid, roadDistM: 0, facing: 1};
const panos = await listPanos(mid, +(process.env.RADIUS ?? 45));
const ranked = rankPanos(wall, panos).filter(p => p.missionYear >= +minYear);
if (!ranked.length) { console.error('no panorama candidates'); process.exit(1); }
console.log(ranked.slice(0, 5).map((p, i) => `${i}: ${p.panoId} ${p.timestamp.slice(0, 10)} d ${p.distM.toFixed(1)} obl ${p.obliquityDeg.toFixed(0)}`).join('\n'));
const pick = ranked[+pickIdx];
const pano = await loadPano(pick);
if (!pano) { console.error('pano unavailable'); process.exit(1); }
const crop = rectifyWall(pano.img, pick, wall as never, +hs - 1.5, +ppms);
if (!crop) { console.error('rectify failed'); process.exit(1); }
fs.writeFileSync(out, crop.jpeg);
console.log(JSON.stringify({chosen: pick.panoId, ts: pick.timestamp, camDist: pick.distM, wallWidthM: crop.wallWidthM, wallHeightM: crop.wallHeightM, w: crop.width, h: crop.height, ppm: crop.ppm, ground: crop.baseZ, missing: crop.missingFraction}));
