// Round 11: the named rows (ROWS=a|b|...) through heldout2's panorama pick, no draw (recovering round 10's list).
// Held-out pick (round 8): one row per street on streets no library names (no street note, no row note, no evidence
// text), at least 4 members, streets drawn without replacement weighted by routable km (streets-routing.json; there are
// no local ride logs), seeded. For each, the nearest recent panorama facing the row (5-25 m off the front, foot within
// it) is listed and its medium image cached (data.amsterdam.nl, the repo UA). Prints the sheet commands' inputs as JSON.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { lngLatToRd } from '../../../src/canalRecall/facade/rdNew.ts';
import { http, cachedBytes } from '../../../scripts/pand-reference/core.ts';
import { listPanos } from '../../../scripts/pand-reference/select.ts';
http.userAgent = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)'; http.minGapMs = 500;
const [n, seed] = [Number(process.argv[2] ?? 7), process.argv[3] ?? 'r8-heldout'];
// Round 9: streets already used as a held-out (round 8) are excluded too.
const EXCLUDE = new Set((process.env.EXCLUDE ?? '').split('|').filter(Boolean));
const ROWS = new Set((process.env.ROWS ?? '').split('|').filter(Boolean));
const km = new Map<string, number>();
for (const w of JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[]) {
  if (!w.name) continue;
  for (const p of (w.paths ?? [w.path]).filter(Boolean)) for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1], p[i]]; km.set(w.name, (km.get(w.name) ?? 0) + Math.hypot((a[1] - b[1]) * 111320 * Math.cos(a[0] * Math.PI / 180), (a[0] - b[0]) * 110540) / 1000);
  }
}
type Cand = { district: string; row: any; street: string; A: { x: number; y: number }; B: { x: number; y: number }; len: number; km: number };
const best = new Map<string, Cand>();
for (const district of ['rivierenbuurt', 'apollo-stadion']) {
  const libText = fs.readFileSync(`src/canalRecall/buurtGenerator/districts/${district}.json`, 'utf8');
  const stage = `artifacts/buurt-generators/${district}`;
  const kit = new Map((JSON.parse(fs.readFileSync(`${stage}/row-front.json`, 'utf8')).records as any[]).filter(r => r.buurtKit).map(r => [r.pandId, r.buurtKit]));
  for (const row of JSON.parse(fs.readFileSync(`${stage}/rows.json`, 'utf8')).rows as any[]) {
    if (!ROWS.has(row.id)) continue;
    const k0 = kit.get(row.members[0].pandId), k1 = kit.get(row.members[row.members.length - 1].pandId); if (!k0 || !k1) continue;
    const A = lngLatToRd(k0.frontLine[0]), B = lngLatToRd(k1.frontLine[1]), len = Math.hypot(B.x - A.x, B.y - A.y);
    const key = `${district}|${row.street}`, c = best.get(key);
    if (!c) best.set(key, { district, row, street: row.street, A, B, len, km: km.get(row.street) ?? 0 });
  }
}
const pool = [...best.values()].sort((a, b) => (a.district + a.street < b.district + b.street ? -1 : 1));
let st = crypto.createHash('sha1').update(seed).digest().readUInt32LE(0);
const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const out: any[] = [];
while (pool.length && out.length < n) {
  const c = pool.shift()!;
  const ux = (c.B.x - c.A.x) / c.len, uy = (c.B.y - c.A.y) / c.len, nx = uy, ny = -ux;
  const mid = { x: (c.A.x + c.B.x) / 2 + nx * 12, y: (c.A.y + c.B.y) / 2 + ny * 12 };
  const panos = (await listPanos(mid as any, Math.max(25, c.len / 2 + 10))).flatMap((p: any) => {
    const q = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]), t = (q.x - c.A.x) * ux + (q.y - c.A.y) * uy, d = (q.x - c.A.x) * nx + (q.y - c.A.y) * ny;
    return t > c.len * 0.2 && t < c.len * 0.8 && d >= 5 && d <= 25 && p._links?.equirectangular_medium?.href ? [{ p, t, d }] : [];
  }).sort((a: any, b: any) => (b.p.timestamp > a.p.timestamp ? 1 : -1) || Math.abs(a.t - c.len / 2) - Math.abs(b.t - c.len / 2));
  if (!panos.length) { console.error('no facing panorama', c.street); continue; }
  // The search file the sheet reads: a cached listing that holds the pick.
  const pick = panos[0].p;
  await cachedBytes(pick._links.equirectangular_medium.href, '.jpg');
  const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${pick.geometry.coordinates[0].toFixed(6)},${pick.geometry.coordinates[1].toFixed(6)}&radius=5&srid=4326&page_size=500`;
  await cachedBytes(url, '.json');
  const search = path.resolve('.cache/pand-reference', crypto.createHash('sha1').update(url).digest('hex') + '.json');
  out.push({ district: c.district, row: c.row.id, street: c.street, members: c.row.members.length, lenM: +c.len.toFixed(0), km: +c.km.toFixed(2), pano: pick.pano_id, ts: pick.timestamp, d: +panos[0].d.toFixed(1), search });
}
console.log(JSON.stringify({ seed, candidates: best.size, requests: http.requests, bytes: http.bytes, picked: out }, null, 1));
