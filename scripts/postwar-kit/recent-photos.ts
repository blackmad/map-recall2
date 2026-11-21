/**
 * Round 2 (lane postwar-kit-r2-20261121): 2024-2025 captures only. For every pand with a published feature read or a
 * corrected wall whose sample capture predates 2024, an aimed thumbnail from the newest 2024-2025 Gemeente Amsterdam
 * panorama (CC BY 4.0) of the same wall, so each read can be confirmed on a current capture
 * (artifacts/postwar-kit/photos/recent/<pand>.jpg, sample-recent.json).
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference node --import tsx scripts/postwar-kit/recent-photos.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PAND_REFERENCE_CACHE ??= path.join(os.homedir(), 'Code/map-recall2/.cache/pand-reference');
const core = await import('../pand-reference/core.ts');
const select = await import('../pand-reference/select.ts');
const { aimedThumbnail, wallHeight } = await import('../pand-reference/rectify.ts');
const { rayBlocked } = await import('../house-crops/flags.ts');
const { rdToLngLat } = await import('../../src/canalRecall/facade/rdNew.ts');
core.http.userAgent = 'MapRecall-PostwarKit/1.0 (+https://github.com/blackmad/map-recall2)';
core.http.minGapMs = 400;
const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/postwar-kit');
fs.mkdirSync(path.join(OUT, 'photos/recent'), { recursive: true });
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample-all.json'), 'utf8')) as Record<string, any>;
const FEAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/feature-reads.json'), 'utf8')).features as Record<string, any>;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const ids = (ONLY ? [...ONLY] : Object.keys(FEAT)).filter(id => sample[id] && (sample[id].panoDate ?? '') < '2024');
const FILE = path.join(OUT, 'sample-recent.json');
const out: Record<string, any> = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
console.log(ids.length, 'pands with a pre-2024 capture');
for (const id of ids) {
  if (out[id]) continue;
  const s = sample[id];
  try {
    const fp = (await core.findPands([id])).get(core.normId(id));
    if (!fp) { out[id] = { skip: 'not in tiles' }; continue; }
    const centre = { x: fp.ring.reduce((a, p) => a + p.x, 0) / fp.ring.length, y: fp.ring.reduce((a, p) => a + p.y, 0) / fp.ring.length };
    const others = await core.neighbourhood(centre);
    const picked = await select.pickWall(fp, others);
    const wall = [picked.wall, ...(picked.others ?? [])].filter((w): w is NonNullable<typeof w> => !!w && w.facing > 0.5 && w.roadDistM < 45).sort((p, q) => q.len - p.len)[0] ?? picked.wall;
    if (!wall) { out[id] = { skip: 'no wall' }; continue; }
    const rings = others.filter(o => o.id !== fp.id && Math.hypot(o.ring[0].x - wall.mid.x, o.ring[0].y - wall.mid.y) < 120).map(o => o.ring);
    const camRd = (rec: any) => core.lngLatToRd([rec.geometry.coordinates[0], rec.geometry.coordinates[1]]);
    const pick = select.rankPanos(wall, await select.listPanos(wall.mid)).filter(p => (p.timestamp ?? '') >= '2024')
      .find(p => p.obliquityDeg <= 45 && !rayBlocked(camRd(p.record), wall.mid, [wall.nx, wall.ny], rings));
    if (!pick) { out[id] = { skip: 'no clear 2024-2025 capture' }; continue; }
    const thumb = await aimedThumbnail(pick, wall, s.heightM, 40);
    if (!thumb) { out[id] = { skip: 'thumbnail failed' }; continue; }
    fs.writeFileSync(path.join(OUT, 'photos/recent', `${id}.jpg`), thumb.jpeg);
    const cam = pick.record.geometry.coordinates;
    out[id] = { ...s, photo: `photos/recent/${id}.jpg`, panoId: pick.panoId, panoDate: pick.timestamp?.slice(0, 10), obliquityDeg: Math.round(pick.obliquityDeg), distM: Math.round(pick.distM), camera: [cam[0], cam[1]],
      headingDeg: thumb.headingDeg, fovDeg: thumb.fovDeg, pitchDeg: Math.round(Math.atan((wallHeight(s.heightM, 40) / 2 - 2.4) / Math.max(pick.distM, 4)) * 180 / Math.PI),
      wallEnds: [rdToLngLat(wall.a), rdToLngLat(wall.b)], wallMid: rdToLngLat(wall.mid) };
    console.log(id, s.address, out[id].panoDate);
  } catch (e) { out[id] = { skip: String((e as Error).message).slice(0, 120) }; }
  fs.writeFileSync(FILE, JSON.stringify(out, null, 1));
}
fs.writeFileSync(FILE, JSON.stringify(out, null, 1));
