/**
 * Which 3DBAG panels and intent wall groups make up each photographed wall of the Tropenmuseum (the brief's wall tags), and
 * where a crop's along-wall coordinate s lands in a panel's u: the rectified crops start at the wall's viewer-left corner
 * (`Wall.a` of pand-reference), so u = s + sOffset on the panel listed.
 *
 *   node --import tsx scripts/landmarks/tropenmuseum-walls.ts
 */
import {cachedJson, findPands, neighbourhood, normId} from '../pand-reference/core.ts';
import {exposedWalls} from '../pand-reference/select.ts';
import {compileTropenmuseum} from './tropenmuseum-builder.ts';

const {built} = compileTropenmuseum();
const [ax, ay] = built.anchorRD;
let fp = (await findPands([normId('0363100012237251')])).get(normId('0363100012237251'));
if (!fp) {
  const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent('<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>0363100012237251</Literal></PropertyIsEqualTo></Filter>')}`);
  const g = wfs.features[0].geometry;
  fp = {id: normId('0363100012237251'), ring: (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((q: number[]) => ({x: q[0], y: q[1]})), height: 20} as any;
}
const centre = {x: fp!.ring.reduce((s, p) => s + p.x, 0) / fp!.ring.length, y: fp!.ring.reduce((s, p) => s + p.y, 0) / fp!.ring.length};
const walls = exposedWalls(fp!, await neighbourhood(centre)).sort((a, b) => b.len - a.len).filter(w => w.len >= 4).slice(0, 60);
const bearingOf = (nx: number, ny: number) => Math.round((Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360);
const loc = (p: {x: number; y: number}) => [p.x - ax, ay - p.y];
const groupOfPanel = (i: number) => built.recipe.panelGroup[i];
walls.forEach((w, i) => {
  const tag = `w${String(i + 1).padStart(2, '0')}-${bearingOf(w.nx, w.ny)}`;
  const A = loc(w.a), B = loc(w.b);
  // Panels facing the same way whose plane passes within 1.5 m of the wall line and overlap it along the wall.
  const n = [w.nx, -w.ny];   // local frame: z = -y
  const hits: string[] = [];
  for (const p of built.panels) {
    if (p.n[0] * n[0] + p.n[2] * n[1] < 0.97) continue;
    const off = (A[0] - p.o[0]) * p.n[0] + (A[1] - p.o[2]) * p.n[2];
    if (Math.abs(off) > 1.5) continue;
    const ua = (A[0] - p.o[0]) * p.r[0] + (A[1] - p.o[2]) * p.r[2], ub = (B[0] - p.o[0]) * p.r[0] + (B[1] - p.o[2]) * p.r[2];
    const lo = Math.min(ua, ub), hi = Math.max(ua, ub);
    if (p.uMax < lo + 0.2 || p.uMin > hi - 0.2) continue;
    const sets = p.walls.map(k => built.recipe.set.walls[k]?.surface ?? k);
    hits.push(`panel ${p.index} group ${groupOfPanel(p.index)} surfaces [${sets.join(',')}] u ${p.uMin.toFixed(2)}..${p.uMax.toFixed(2)} v ${p.vMin.toFixed(2)}..${p.vMax.toFixed(2)} off ${off.toFixed(2)} sOffset(u=s+k) ${ua.toFixed(2)}${ua > ub ? ' (reversed!)' : ''}`);
  }
  console.log(`${tag} ${w.len.toFixed(1)} m a ${A.map(x => x.toFixed(2))} b ${B.map(x => x.toFixed(2))}`);
  for (const h of hits) console.log(`   ${h}`);
});
