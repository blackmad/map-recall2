/**
 * Round 5: other captures of a shaded front (wallPatch.ts isShadedRaw), so measure-walls.ts can measure it in sunlight.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference node --import tsx scripts/postwar-kit/fetch-alternates.ts
 *
 * For every pand in artifacts/postwar-kit/measured-walls.json flagged `shaded`, the same wall sample-photos.ts aimed at
 * (pickWall, the longest street-facing edge), every Gemeente Amsterdam panorama (CC BY 4.0) in the facade window that is
 * not blocked and at most 35 deg oblique, from a different capture day than the primary, up to MAX_ALTERNATES, newest
 * first. Writes artifacts/postwar-kit/sample-alt.json ({ pand: [row like sample-all.json] }) and photos/alt/.
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

export const MAX_ALTERNATES = 4;
core.http.userAgent = 'MapRecall-PostwarKit/1.0 (+https://github.com/blackmad/map-recall2)';
core.http.minGapMs = 400;
const OUT = path.resolve(import.meta.dirname, '../../artifacts/postwar-kit');
fs.mkdirSync(path.join(OUT, 'photos/alt'), { recursive: true });
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample-all.json'), 'utf8')) as Record<string, any>;
const rows = JSON.parse(fs.readFileSync(path.join(OUT, 'measured-walls.json'), 'utf8')).rows as Record<string, any>;
const ALT = path.join(OUT, 'sample-alt.json');
const out: Record<string, any[]> = fs.existsSync(ALT) ? JSON.parse(fs.readFileSync(ALT, 'utf8')) : {};
const ids = Object.keys(rows).filter(id => rows[id].shaded && !out[id]);
console.log(`${ids.length} shaded fronts`);
for (const id of ids) {
  const s = sample[id];
  try {
    const fp = (await core.findPands([id])).get(core.normId(id));
    if (!fp) { out[id] = []; continue; }
    const centre = { x: fp.ring.reduce((a, p) => a + p.x, 0) / fp.ring.length, y: fp.ring.reduce((a, p) => a + p.y, 0) / fp.ring.length };
    const others = await core.neighbourhood(centre);
    const picked = await select.pickWall(fp, others);
    const wall = [picked.wall, ...(picked.others ?? [])].filter((w): w is NonNullable<typeof w> => !!w && w.facing > 0.5 && w.roadDistM < 45).sort((p, q) => q.len - p.len)[0] ?? picked.wall;
    if (!wall) { out[id] = []; continue; }
    const rings = others.filter(o => o.id !== fp.id && Math.hypot(o.ring[0].x - wall.mid.x, o.ring[0].y - wall.mid.y) < 120).map(o => o.ring);
    const camRd = (rec: any) => core.lngLatToRd([rec.geometry.coordinates[0], rec.geometry.coordinates[1]]);
    const days = new Set([s.panoDate]);
    const alts: any[] = [];
    for (const pick of select.rankPanos(wall, await select.listPanos(wall.mid)).sort((p, q) => (q.timestamp ?? '').localeCompare(p.timestamp ?? ''))) {
      const day = pick.timestamp?.slice(0, 10);
      if (alts.length >= MAX_ALTERNATES || days.has(day) || pick.obliquityDeg > 35 || rayBlocked(camRd(pick.record), wall.mid, [wall.nx, wall.ny], rings)) continue;
      const thumb = await aimedThumbnail(pick, wall, s.heightM, 40);
      if (!thumb) continue;
      days.add(day);
      const file = `photos/alt/${id}-${alts.length}.jpg`;
      fs.writeFileSync(path.join(OUT, file), thumb.jpeg);
      const cam = pick.record.geometry.coordinates;
      alts.push({ ...s, photo: file, panoId: pick.panoId, panoDate: day, obliquityDeg: Math.round(pick.obliquityDeg), distM: Math.round(pick.distM), camera: [cam[0], cam[1]],
        headingDeg: thumb.headingDeg, fovDeg: thumb.fovDeg, pitchDeg: Math.round(Math.atan((wallHeight(s.heightM, 40) / 2 - 2.4) / Math.max(pick.distM, 4)) * 180 / Math.PI),
        wallEnds: [rdToLngLat(wall.a), rdToLngLat(wall.b)], wallMid: rdToLngLat(wall.mid) });
    }
    out[id] = alts;
    console.log(`${id} ${s.address}: ${alts.length} alternates`);
  } catch (e) { out[id] = []; console.log(`${id}: ${String((e as Error).message).slice(0, 100)}`); }
  fs.writeFileSync(ALT, JSON.stringify(out, null, 1));
}
fs.writeFileSync(ALT, JSON.stringify(out, null, 1));
console.log('requests', core.http.requests);
