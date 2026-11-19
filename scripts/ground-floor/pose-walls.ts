/**
 * Ground-floor blind poses (lane ground-floor-20261116): for each pand of a frames list, the wall the game draws its shop
 * front on (threeBuildingMesh.retailFrontOn: the exposed wall nearest the template's point) and the wall the photo read
 * was cut from (the read's capture, seen from the front of which exposed wall). Writes a house:frames list whose entry
 * faces the front's wall (`at` on it, `bearing` its outward normal) and, when the read's capture stands in front of that
 * wall, uses that capture (`pano`), so the blind pair shows the wall the record describes.
 *   node --import tsx scripts/ground-floor/pose-walls.ts --in=<list.json> --out=<list.json> [--reads=data/ground-floor/reads-pilot.json]
 */
import fs from 'node:fs';
import { findPands, lngLatToRd, nearestOnSeg, neighbourhood, rdToLngLat, type Rd } from '../pand-reference/core.ts';
import { exposedWalls, listPanos, type Wall } from '../pand-reference/select.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
type Entry = { pandId: string; key: string; at?: [number, number]; bearing?: number; pano?: string; notPanos?: string[]; note?: string };
const list = JSON.parse(fs.readFileSync(arg('in')!, 'utf8')) as Entry[];
const templates = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/shop-templates.json', 'utf8')) as { templates: string[]; buildings: Record<string, [number, number, number, string?, number?]> };
const reads = new Map((JSON.parse(fs.readFileSync(arg('reads') ?? 'data/ground-floor/reads-pilot.json', 'utf8')) as { reads: Array<{ pandId: string; image: { pano?: string }; spanM?: number }> }).reads.map(r => [r.pandId, r]));
const fps = await findPands(list.map(e => e.pandId));
const bearingOf = (w: Wall) => (Math.atan2(w.nx, w.ny) * 180 / Math.PI + 360) % 360;
const out: Entry[] = [];
for (const e of list) {
  const id = `NL.IMBAG.Pand.${e.pandId}`, fp = fps.get(id), row = templates.buildings[id], read = reads.get(e.pandId);
  if (!fp || !row) { console.log(`${e.key}: ${fp ? 'no template row' : 'not in the tiles'}`); out.push(e); continue; }
  const p = lngLatToRd([row[1], row[2]]), walls = exposedWalls(fp, await neighbourhood(p));
  const dist = (w: Wall) => nearestOnSeg(p, { a: w.a, b: w.b }).d;
  const front = [...walls].sort((a, b) => dist(a) - dist(b))[0];
  if (!front) { console.log(`${e.key}: no exposed wall`); out.push(e); continue; }
  const q = nearestOnSeg(p, { a: front.a, b: front.b }).q, at = rdToLngLat(q).map(v => +v.toFixed(7)) as [number, number];
  // The read's capture: in front of which wall (positive standoff, nearest by angle)?
  let readWall: Wall | undefined, panoAt: Rd | undefined;
  if (read?.image.pano) {
    const pano = (await listPanos(q, 60)).find(x => x.pano_id === read.image.pano);
    if (pano) {
      panoAt = lngLatToRd([pano.geometry.coordinates[0], pano.geometry.coordinates[1]]);
      readWall = walls.map(w => ({ w, s: (panoAt!.x - w.mid.x) * w.nx + (panoAt!.y - w.mid.y) * w.ny, d: Math.hypot(panoAt!.x - w.mid.x, panoAt!.y - w.mid.y) }))
        .filter(c => c.s > 1).sort((a, b) => a.s / a.d > b.s / b.d ? -1 : 1)[0]?.w;
    }
  }
  const same = readWall === front;
  const entry: Entry = { ...e, at, bearing: Math.round(bearingOf(front)), ...(same && read?.image.pano ? { pano: read.image.pano } : {}) };
  entry.note = `front wall ${front.len.toFixed(1)} m facing ${Math.round(bearingOf(front))} (${dist(front).toFixed(1)} m from the shop point; ${walls.length} exposed walls)`
    + (read ? `; read ${read.image.pano ?? '?'} spanM ${read.spanM ?? '?'} ${readWall ? (same ? 'of the same wall' : `of another wall (${readWall.len.toFixed(1)} m facing ${Math.round(bearingOf(readWall))})`) : panoAt ? 'not in front of any exposed wall' : 'capture not found'}` : '; no read');
  console.log(`${e.key}: ${entry.note}`);
  out.push(entry);
}
fs.writeFileSync(arg('out')!, JSON.stringify(out, null, 1) + '\n');
