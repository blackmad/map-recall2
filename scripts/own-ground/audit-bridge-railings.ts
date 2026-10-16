// Bridge railings that stand across the road (user 2026-10-16, "why do the gates dip into the road?"): a parapet line
// must run along a deck's water-side edges only and stop at the abutments, never across a carriageway, cycle lane or
// footway that continues onto the bridge. Builds every streamed cell with bridges (LOD 0, roads-v1 on, as the game
// does) and measures each drawn parapet line (bridgeKit parapetTrace, railingRuns parapetCrossings):
//   turn    a stretch running across the deck (the "gate"): lateral step > TURN_M, steeper than 45°
//   inside  parapet line deeper than INSIDE_M inside a carriageway or cycle-lane polygon (roads-v1 cells only), metres
//
//   npx tsx scripts/own-ground/audit-bridge-railings.ts                 # citywide table + totals
//   npx tsx scripts/own-ground/audit-bridge-railings.ts --ids=BRU0063   # these bridges, with their lines
//   … --json=out.json
//   … --max-inside=N                     fail above N metres inside traffic city-wide (default INSIDE_CAP_M)
//   … --before                           the parapet over the whole deck span, as drawn before the clip (railingRuns RAIL_CLIP)
//   … --ids=… --plot=dir [--tag=before]   per bridge, <dir>/<id>-<tag>.png: the PDOK orthophoto with the parapet lines
//                                          (red) beside the roads-v1 polygons (carriage grey, cycle red, foot light) and water
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { GroundStore, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell } from '../../src/canalRecall/ownGround/groundCell.ts';
import { parapetTrace } from '../../src/canalRecall/ownGround/bridgeKit.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { parapetCrossings, RAIL_CLIP, type ParapetPoint } from '../../src/canalRecall/ownGround/railingRuns.ts';
import { decodeRoadLine, type RoadCell } from '../../src/canalRecall/ownGround/roadCells.ts';
import type { CellInput } from '../../src/canalRecall/ownGround/groundCell.ts';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';

const ROOT = 'public/data/extracts/amsterdam';
/** check:bridge-railings fails when the parapet runs more than this many metres inside carriageways and cycle lanes city-wide (--max-inside=N). */
export const INSIDE_CAP_M = 1650;
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const only = flag('ids')?.split(',');
const store = new GroundStore(async path => {
  const file = join(ROOT, path);
  if (!existsSync(file)) throw new Error(`${path}: missing`);
  const bytes = readFileSync(file);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
}, { roads: true });

type Row = { id: string; cell: string; lng: number; lat: number; turns: number; turnM: number; insideM: number; parapetM: number };

async function main(): Promise<void> {
  // --before: the parapet over the whole deck span, as drawn before the railing clip (railingRuns.ts railRuns).
  if (process.argv.includes('--before')) RAIL_CLIP.enabled = false;
  await store.init();
  const rows = new Map<string, Row>(), plots = new Map<string, { input: CellInput; lines: ParapetPoint[][] }>();
  // --ids: only the cells around the measured decks asked for (all cells when one of them is a flat footprint).
  const near = only?.map(id => store.surface.decks.find(d => d.profile.id === id)).map(d => (d ? GroundStore.neighbours(store.cellAt(d.profile.x[d.profile.x.length >> 1], d.profile.y[d.profile.y.length >> 1])) : null));
  const keys = [...store.osmCells].filter(k => store.covers(k) && (!near || near.some(n => !n) || near.some(n => n!.includes(k)))).sort();
  let n = 0;
  for (const k of keys) {
    await store.prepareCell(k);
    const ids = [...store.decks(k).map(d => d.profile.id), ...store.flatDeckMeta(k).map(f => f.id)];
    if (!ids.length || (only && !ids.some(id => only.includes(id)))) continue;
    const input = await store.cellInput(k, 0);
    // Per bridge and side, the pieces of the last (highest) coarsening level buildKit tried: the one it drew.
    const traced = new Map<string, { level: number; pieces: ParapetPoint[][] }>();
    let flat = 0;
    parapetTrace.fn = (id, side, line, at) => {
      if (!id && at.piece === 0 && side === 1) flat++;
      const key = `${id || `flat#${flat}`}|${side}`, t = traced.get(key);
      if (!t || at.level > t.level || (at.level === t.level && at.piece === 0)) traced.set(key, { level: at.level, pieces: [line] });
      else if (at.level === t.level) t.pieces.push(line);
    };
    buildCell(input);
    parapetTrace.fn = null;
    const index = new RoadIndex([input.roads ?? null, ...(input.roadsAround ?? [])]);
    const traffic = (x: number, y: number) => { const c = index.classAt(x, y, true); return c === 'carriage' || c === 'cycle'; };
    for (const [key, { pieces }] of traced) for (const line of pieces) {
      const id = key.startsWith('flat#') ? `flat@${k}:${key.split('|')[0].slice(5)}` : key.split('|')[0];
      if (only && !only.includes(id)) continue;
      const m = parapetCrossings(line, traffic);
      const [lng, lat] = fromLocal(line[0].p[0], line[0].p[1]);
      const r = rows.get(id) ?? { id, cell: k, lng: +lng.toFixed(6), lat: +lat.toFixed(6), turns: 0, turnM: 0, insideM: 0, parapetM: 0 };
      r.turns += m.turns; r.turnM += m.turnM; r.insideM += m.insideM; r.parapetM += m.lengthM;
      rows.set(id, r);
      if (only && flag('plot')) { const l = plots.get(id) ?? { input, lines: [] }; l.lines.push(line); plots.set(id, l); }
      if (only) console.log(key, JSON.stringify({ ...m, line: line.map(q => [+q.s.toFixed(2), +q.p[0].toFixed(2), +q.p[1].toFixed(2)]) }));
    }
    if (++n % 20 === 0) console.error(`${n} cells, ${rows.size} bridges`);
  }
  const all = [...rows.values()].map(r => ({ ...r, turnM: +r.turnM.toFixed(1), insideM: +r.insideM.toFixed(1), parapetM: +r.parapetM.toFixed(1) }));
  const bad = all.filter(r => r.turns > 0 || r.insideM >= 1).sort((a, b) => b.turnM + b.insideM - a.turnM - a.insideM);
  for (const r of bad.slice(0, 40)) console.log(JSON.stringify(r));
  console.log(JSON.stringify({ bridges: all.length, withTurn: all.filter(r => r.turns > 0).length, turnM: +all.reduce((s, r) => s + r.turnM, 0).toFixed(1), withInside1m: all.filter(r => r.insideM >= 1).length, insideM: +all.reduce((s, r) => s + r.insideM, 0).toFixed(1), parapetM: +all.reduce((s, r) => s + r.parapetM, 0).toFixed(0) }));
  // The gate (coordinator 2026-10-16): parapet metres inside traffic city-wide stay under INSIDE_CAP_M (main 4,512 m with
  // the way decks at the OSM way's half-width; 1,543 m with them at the road surfaces' edges, wayDecks.ts roadEdgeSides).
  const insideM = all.reduce((s, r) => s + r.insideM, 0), cap = Number(flag('max-inside') ?? INSIDE_CAP_M);
  if (!only && !process.argv.includes('--before') && insideM > cap) { console.log(`FAIL parapet inside traffic ${insideM.toFixed(0)} m > ${cap} m`); process.exitCode = 1; }
  const dir = flag('plot');
  if (dir) { mkdirSync(dir, { recursive: true }); for (const [id, p] of plots) await plot(`${dir}/${id}-${flag('tag') ?? 'after'}.png`, id, p.input, p.lines); }
  const out = flag('json');
  if (out) writeFileSync(out, JSON.stringify(all, null, 1));
}
const ROAD_FILL: Record<string, string> = { carriage: '#5a5c60', cycle: '#b8473e', foot: '#d8d2c6', pedestrian: '#cfc4b0', parking: '#44464a', driveway: '#77797d' };
async function plot(file: string, id: string, input: CellInput, lines: ParapetPoint[][]): Promise<void> {
  const pts = lines.flat().map(q => q.p), pad = 14, PX = 8;
  const x0 = Math.min(...pts.map(p => p[0])) - pad, x1 = Math.max(...pts.map(p => p[0])) + pad, y0 = Math.min(...pts.map(p => p[1])) - pad, y1 = Math.max(...pts.map(p => p[1])) + pad;
  const W = Math.round((x1 - x0) * PX), H = Math.round((y1 - y0) * PX);
  const X = (x: number) => ((x - x0) * PX).toFixed(1), Y = (y: number) => ((y1 - y) * PX).toFixed(1);
  const path = (ring: readonly (readonly number[])[], close = true) => ring.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])},${Y(p[1])}`).join('') + (close ? 'Z' : '');
  const a = lngLatToRd(fromLocal(x0, y0)), b = lngLatToRd(fromLocal(x1, y1));
  // The WMS answers a blank image unless the bbox's aspect matches the size's exactly: the RD box at PX px/m.
  const WR = Math.round((b.x - a.x) * PX), HR = Math.round((b.y - a.y) * PX);
  const url = `https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?service=WMS&version=1.3.0&request=GetMap&layers=Actueel_orthoHR&styles=&crs=EPSG:28992&bbox=${a.x},${a.y},${a.x + WR / PX},${a.y + HR / PX}&width=${WR}&height=${HR}&format=image/jpeg`;
  const res = await fetch(url);
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) console.warn(`orthophoto: ${res.status} ${res.headers.get('content-type')} ${url}`);
  const ortho = await sharp(Buffer.from(await res.arrayBuffer())).resize(W, H, { fit: 'fill' }).png().toBuffer();
  const rails = lines.map(l => `<path d="${path(l.map(q => q.p), false)}" fill="none" stroke="#ff2a2a" stroke-width="3"/>` + l.map(q => `<circle cx="${X(q.p[0])}" cy="${Y(q.p[1])}" r="2.5" fill="#ffe000"/>`).join('')).join('');
  const roads = [input.roads ?? null, ...(input.roadsAround ?? [])].filter((r): r is RoadCell => !!r).flatMap(r => r.surfaces)
    .map(s => `<path d="${s.r.map(e => path(decodeRoadLine(e))).join('')}" fill="${ROAD_FILL[s.c] ?? '#888'}" fill-rule="evenodd" stroke="${s.h >= 1 ? '#000' : 'none'}" stroke-width="${s.h >= 1 ? 1.5 : 0}"/>`).join('');
  const water = [input.water, ...input.waterAround].flatMap(w => w?.polygons ?? []).map(poly => `<path d="${poly.map(r => path(r)).join('')}" fill="#3a6f8a" fill-rule="evenodd"/>`).join('');
  const label = (t: string) => `<text x="8" y="22" font-family="Helvetica" font-size="18" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${t}</text>`;
  // Left: the orthophoto under the parapet lines (composited: librsvg drops large embedded images); right: the survey.
  const left = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rails}${label(`${id} PDOK luchtfoto + parapet lines`)}</svg>`;
  const right = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#9a9184"/>${water}${roads}${rails}${label(`${id} roads-v1 (decks outlined), water + parapet`)}</svg>`;
  await sharp({ create: { width: 2 * W + 10, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: ortho, left: 0, top: 0 }, { input: Buffer.from(left), left: 0, top: 0 }, { input: await sharp(Buffer.from(right)).png().toBuffer(), left: W + 10, top: 0 }])
    .png().toFile(file);
  console.log(`wrote ${file}`);
}
main().catch(e => { console.error(e); process.exit(1); });
