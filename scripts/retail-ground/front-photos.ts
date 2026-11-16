/**
 * Shopfront photo samples (lane retail-look round 6): for each OSM node named, its template pand's street wall cut from
 * the nearest facing open-data Amsterdam panorama (data.amsterdam.nl, CC BY 4.0; the house line's pand-reference cache
 * and selection), aimed at the wall's ground storey, written as <out>/<node>-<pano>.jpg with a receipts JSON. Used to
 * spot-check a template rule (bike shop classes) and to sample real fronts for new templates. A node with no template
 * pand is hosted on the footprint it stands in, else the nearest within 8 m (sampling shops no template draws yet).
 *
 * The aim (round 6b; the first pass missed about half its shops): the shop's own stretch of its wall, AIM.halfM either
 * side of the node's foot on it (not the whole frontage, which on a block-long new build is somewhere else), the
 * ground storey and fascia only (AIM.heightM); the wall a street-facing one near the node (the nearest edge of a deep
 * pand can be its back); panoramas ranked against that stretch, near ones first (AIM.window); up to AIM.tries cuts,
 * skipping one whose ground band reads as a vehicle (retailPuiPaint.ts vehicleBand, as measure-pui.ts) or barely
 * covers the stretch. Panoramas this run
 * downloads are purged afterwards; the 15 GB disk floor and --max-mb stop it.
 *   node --import tsx scripts/retail-ground/front-photos.ts --nodes=<id,id> --out=<dir> [--per=1] [--max-mb=60] [--offline] [--whole-wall] [--aim-height=<m>] [--outline]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { CACHE_DIR, findPands, http, lngLatToRd, neighbourhood, nearestOnSeg, panoTracker, purgeFiles, type Footprint } from '../pand-reference/core.ts';
import { listPanos, pickWall, rankPanos } from '../pand-reference/select.ts';
import { aimPose, frameFor, gridConvergenceDeg, projectRd, type WallQuad } from '../house-frames/pose.ts';
import { cutPerspective, loadEquirect, rectifyFromFrame } from '../house-frames/photo.ts';
import { PUI_BAND, vehicleBand } from '../../src/canalRecall/retailPuiPaint.ts';
import type { RankWindow, Wall } from '../pand-reference/select.ts';

export const AIM = { halfM: 3.5, minM: 5, heightM: 4.6, window: { minD: 3.5, maxD: 25, strict: [4, 15], maxObliquityDeg: 50 } as RankWindow, tries: 6, minValid: 0.6 } as const;
/** The stretch of `wall` around the node's foot: AIM.halfM either side, at least AIM.minM, inside the wall. */
export function shopStretch(wall: Wall, node: { x: number; y: number }): Wall {
  const ux = (wall.b.x - wall.a.x) / wall.len, uy = (wall.b.y - wall.a.y) / wall.len;
  const t = Math.max(0, Math.min(wall.len, (node.x - wall.a.x) * ux + (node.y - wall.a.y) * uy));
  const half = Math.min(wall.len, Math.max(AIM.minM, 2 * AIM.halfM)) / 2, t0 = Math.max(0, Math.min(wall.len - 2 * half, t - half)), t1 = t0 + 2 * half;
  const a = { x: wall.a.x + ux * t0, y: wall.a.y + uy * t0 }, b = { x: wall.a.x + ux * t1, y: wall.a.y + uy * t1 };
  return { ...wall, a, b, len: t1 - t0, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}

http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
if (process.argv.includes('--offline')) http.offline = true;
const WHOLE = process.argv.includes('--whole-wall'), OUTLINE = process.argv.includes('--outline'), AIM_H = Number(arg('aim-height') ?? AIM.heightM);
const OUT = arg('out')!, PER = Number(arg('per') ?? 1), MAX_MB = Number(arg('max-mb') ?? 60);
const nodes = (arg('nodes') ?? '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const freeGb = () => { try { return Number(execSync("df -k / | tail -1 | awk '{print $4}'").toString().trim()) / 1048576; } catch { return 99; } };

const ov = JSON.parse(fs.readFileSync('.cache/retail-ground/overpass.json', 'utf8')) as { elements: Array<{ id: number; lat?: number; lon?: number; tags?: Record<string, string> }> };
const staged = JSON.parse(fs.readFileSync('data/retail-ground/shop-templates.json', 'utf8')) as { templates: string[]; buildings: Record<string, [number, number, number]> };
const byAt = new Map(Object.entries(staged.buildings).map(([id, r]) => [`${r[1]},${r[2]}`, id]));
// Lane retail-real round 5 (`--hosts=<json>`): node -> { pand, at } from an assignment trace, so the cut aims at the
// pand the extract hosts the node on (and at its staged front point) rather than the one its point falls in.
const hosts = (arg('hosts') ? JSON.parse(fs.readFileSync(arg('hosts')!, 'utf8')) : {}) as Record<string, { pand: string; at?: [number, number] }>;
// A node OSM lacks (a second source's add, negative id) is cut from its hosts entry's `at`.
const byId = new Map(ov.elements.map(e => [String(e.id), e]));
const want = nodes.map(n => byId.get(n) ?? (hosts[n]?.at ? { id: Number(n), lon: hosts[n].at![0], lat: hosts[n].at![1], tags: {} } : undefined)).filter(Boolean) as Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }>;
const hostId = (e: { id: number }) => hosts[e.id] ? Object.keys(staged.buildings).find(k => k.endsWith(hosts[e.id].pand)) ?? `NL.IMBAG.Pand.${hosts[e.id].pand}` : undefined;
const ids = want.map(e => hostId(e) ?? byAt.get(`${Math.round(e.lon * 1e6) / 1e6},${Math.round(e.lat * 1e6) / 1e6}`)).filter(Boolean) as string[];
const fps = await findPands(ids);
const before = new Set(fs.existsSync(CACHE_DIR) ? fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.jpg')) : []);
panoTracker.touched = new Set();
const receipts: Record<string, unknown> = {};
for (const e of want) {
  if (freeGb() < 15) { console.log('under 15 GB free: stopping'); break; }
  if (http.bytes > MAX_MB * 1024 ** 2) { console.log(`${MAX_MB} MB downloaded: stopping`); break; }
  const node = lngLatToRd(hosts[e.id]?.at ?? [e.lon, e.lat]);
  let id = hostId(e) ?? byAt.get(`${Math.round(e.lon * 1e6) / 1e6},${Math.round(e.lat * 1e6) / 1e6}`), fp = id ? fps.get(id) : undefined;
  const others: Footprint[] = await neighbourhood(node);
  if (!fp) {
    const ringDist = (f: Footprint) => inside(node, f.ring) ? 0 : Math.min(...f.ring.slice(1).map((p, i) => nearestOnSeg(node, { a: f.ring[i], b: p }).d));
    const best = others.map(f => ({ f, d: ringDist(f) })).sort((a, b) => a.d - b.d)[0];
    if (best && best.d <= 8) { fp = best.f; id = best.f.id; }
  }
  if (!id || !fp) { receipts[e.id] = { skip: 'no pand within 8 m' }; continue; }
  // A street-facing wall near the node: distance to the node plus half its distance to the road.
  // pickWall annotates each exposed wall with its road distance and how squarely it faces the road.
  const picked = await pickWall(fp, others), walls = picked.others ?? (picked.wall ? [picked.wall] : []);
  const score = (w: Wall, d: number) => d + 0.5 * Math.min(w.roadDistM, 30) + (w.facing > 0.5 ? 0 : 10);
  const near = walls.map(w => ({ w, d: nearestOnSeg(node, { a: w.a, b: w.b }).d })).filter(x => x.d <= 8);
  const wall = near.sort((p, q) => score(p.w, p.d) - score(q.w, q.d))[0]?.w;
  if (!wall) { receipts[e.id] = { skip: 'no exposed wall within 8 m' }; continue; }
  // Lane ground-floor (`--whole-wall`, `--aim-height=<m>`): the pand's whole street wall and more of its height, for the
  // ground-floor read (piers, arches and plinth across the front, the sign above it).
  const shop = WHOLE ? wall : shopStretch(wall, node), quad: WallQuad = { a: shop.a, b: shop.b, heightM: AIM_H };
  let done = 0; const tried: string[] = [];
  try {
    // `--newest` (lane retail-real round 5): the latest capture first, so a shop check is not judged on a 2019 front.
    const ranked = rankPanos(shop, await listPanos(shop.mid, 30), AIM.window);
    if (process.argv.includes('--newest')) ranked.sort((p, q) => String(q.timestamp).slice(0, 7).localeCompare(String(p.timestamp).slice(0, 7)));
    for (const pick of ranked.slice(0, AIM.tries)) {
      if (done >= PER) break;
      const img = await loadEquirect(pick.record, 'small'); if (!img) continue;
      const ll: [number, number] = [pick.record.geometry.coordinates[0], pick.record.geometry.coordinates[1]], published = Number(pick.record.geometry.coordinates[2]);
      const pose = aimPose({ lngLat: ll, cameraNap: published > 0 ? published - 43.5 : null }, quad, { width: 900, height: 560 }), frame = frameFor(pose);
      const cut = cutPerspective(img, frame, gridConvergenceDeg(ll));
      // The ground band rectified onto the stretch: how much of it the cut covers, and whether a vehicle hides it.
      const topM = PUI_BAND.z1 + 0.2, rect = rectifyFromFrame(cut, frame, pose, quad, PUI_BAND.ppm, topM);
      const luma: number[] = []; let rows = 0, valid = 0, n = 0;
      for (let j = 0; j < rect.height; j++) {
        const z = topM - (j + 0.5) / rect.ppm; if (z < PUI_BAND.z0 || z > PUI_BAND.z1) continue; rows++;
        for (let i = 0; i < rect.width; i++) { const k = j * rect.width + i, q = k * 3; n++; if (rect.valid[k]) valid++; luma.push(0.299 * rect.rgb[q] + 0.587 * rect.rgb[q + 1] + 0.114 * rect.rgb[q + 2]); }
      }
      const v = vehicleBand(luma, rect.width, rows), cover = n ? valid / n : 0;
      if (v.vehicle || cover < AIM.minValid) { tried.push(`${pick.panoId}: ${v.vehicle ? `vehicle (${v.vehicle})` : `covers ${(100 * cover).toFixed(0)} %`}`); continue; }
      // `--outline`: the wall's two ends as thin cyan uprights, so a reader can tell the pand's own front from its neighbours'.
      if (OUTLINE) for (const end of [shop.a, shop.b]) {
        const p0 = projectRd(frame, pose, end, 0), p1 = projectRd(frame, pose, end, AIM_H);
        for (let y = Math.max(0, Math.round(Math.min(p0.y, p1.y))); y < Math.min(cut.height, Math.round(Math.max(p0.y, p1.y))); y++) {
          const t = (y - p0.y) / ((p1.y - p0.y) || 1), x0 = Math.round(p0.x + (p1.x - p0.x) * t);
          for (let x = x0 - 1; x <= x0; x++) if (x >= 0 && x < cut.width) { const q = (y * cut.width + x) * 3; cut.data[q] = 0; cut.data[q + 1] = 230; cut.data[q + 2] = 255; }
        }
      }
      const file = path.join(OUT, `${e.id}-${pick.panoId}.jpg`);
      await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: 3 } }).jpeg({ quality: 85 }).toFile(file);
      receipts[e.id] = { pand: id, name: e.tags?.name ?? '', pano: pick.panoId, date: String(pick.timestamp).slice(0, 10), distM: +pick.distM.toFixed(1), obliquityDeg: +pick.obliquityDeg.toFixed(1), stretchM: +shop.len.toFixed(1), cover: +cover.toFixed(2), ...(tried.length ? { skipped: tried } : {}), file };
      done++;
    }
    if (!done) receipts[e.id] = { pand: id, name: e.tags?.name ?? '', skip: tried.length ? 'every candidate blocked or off the cut' : 'no panorama facing the stretch', skipped: tried };
  } catch (err) { receipts[e.id] = { skip: (err as Error).message }; }
  const mine = [...panoTracker.touched].filter(f => !before.has(path.basename(f))); panoTracker.touched.clear(); await purgeFiles(mine);
  fs.writeFileSync(path.join(OUT, 'receipts.json'), JSON.stringify(receipts, null, 1)); // per front, so a stopped run keeps its receipts
}
function inside(p: { x: number; y: number }, ring: ReadonlyArray<{ x: number; y: number }>): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i].y > p.y) !== (ring[j].y > p.y) && p.x < (ring[j].x - ring[i].x) * (p.y - ring[i].y) / (ring[j].y - ring[i].y) + ring[i].x) c = !c;
  return c;
}
fs.writeFileSync(path.join(OUT, 'receipts.json'), JSON.stringify(receipts, null, 1));
console.log(`${Object.keys(receipts).length} fronts -> ${OUT}; ${http.requests} requests, ${(http.bytes / 1048576).toFixed(1)} MB (purged)`);
