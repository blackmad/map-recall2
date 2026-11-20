/**
 * Postwar housing kit, step 1: panorama photos for a stratified sample of the ordinary backlog's post-1965 housing
 * clusters (docs/reports/ordinary-backlog-20261120.json): C1 1985-2004 mid-rise blocks, C2 2005+ mid-rise blocks,
 * C4 1965-1984 blocks, C5 1985-2004 towers.
 *
 *   PAND_REFERENCE_CACHE=~/Code/map-recall2/.cache/pand-reference node --import tsx scripts/postwar-kit/sample-photos.ts
 *
 * Per member (by payoff, core and outer top 200): the backlog's wall rule (longest road-facing wall), house:crops' ray
 * check, the best clear panorama; straight (≤ 35°) ones get an aimed thumbnail (Gemeente Amsterdam, CC BY 4.0).
 * Writes artifacts/postwar-kit/photos/<pand>.jpg and artifacts/postwar-kit/sample.json.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PAND_REFERENCE_CACHE ??= path.join(os.homedir(), 'Code/map-recall2/.cache/pand-reference');
const core = await import('../pand-reference/core.ts');
const select = await import('../pand-reference/select.ts');
const { aimedThumbnail } = await import('../pand-reference/rectify.ts');
const { rayBlocked } = await import('../house-crops/flags.ts');
core.http.userAgent = 'MapRecall-PostwarKit/1.0 (+https://github.com/blackmad/map-recall2)';
core.http.minGapMs = 400;

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/postwar-kit');
fs.mkdirSync(path.join(OUT, 'photos'), { recursive: true });
export const CLUSTERS: Record<string, string> = {
  '1985-2004 · housing · block · mid · generic': 'C1',
  '2005+ · housing · block · mid · generic': 'C2',
  '1965-1984 · housing · block · mid · generic': 'C4',
  '1985-2004 · housing · tower · high · generic': 'C5',
};
const WANT: Record<string, number> = { C1: 30, C2: 18, C4: 18, C5: 9 };
const backlog = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/reports/ordinary-backlog-20261120.json'), 'utf8'));
const members = [...backlog.core, ...backlog.outer].filter((r: any) => CLUSTERS[r.cluster]).sort((a: any, b: any) => b.payoffRaw - a.payoffRaw);
const SAMPLE = path.join(OUT, 'sample.json');
const out: Record<string, any> = fs.existsSync(SAMPLE) ? JSON.parse(fs.readFileSync(SAMPLE, 'utf8')) : {};
const got: Record<string, number> = {};
for (const r of Object.values(out)) if (r.photo) got[r.cluster] = (got[r.cluster] ?? 0) + 1;
for (const r of members) {
  const c = CLUSTERS[r.cluster];
  if ((got[c] ?? 0) >= WANT[c] || out[r.id]) continue;
  try {
    const fp = (await core.findPands([r.id])).get(core.normId(r.id));
    if (!fp) { out[r.id] = { cluster: c, skip: 'not in tiles' }; continue; }
    const centre = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
    const others = await core.neighbourhood(centre);
    const picked = await select.pickWall(fp, others);
    const wall = [picked.wall, ...(picked.others ?? [])].filter((w): w is NonNullable<typeof w> => !!w && w.facing > 0.5 && w.roadDistM < 45).sort((p, q) => q.len - p.len)[0] ?? picked.wall;
    if (!wall) { out[r.id] = { cluster: c, skip: 'no wall' }; continue; }
    const ranked = select.rankPanos(wall, await select.listPanos(wall.mid));
    const rings = others.filter(o => o.id !== fp.id && Math.hypot(o.ring[0].x - wall.mid.x, o.ring[0].y - wall.mid.y) < 120).map(o => o.ring);
    const camRd = (rec: any) => core.lngLatToRd([rec.geometry.coordinates[0], rec.geometry.coordinates[1]]);
    const pick = ranked.find(p => !rayBlocked(camRd(p.record), wall.mid, [wall.nx, wall.ny], rings));
    const base = { cluster: c, address: r.address, year: r.year, heightM: r.heightM, footprintM2: r.footprintM2, centroid: r.centroid, payoffRaw: r.payoffRaw, today: r.today.facade,
      bearingDeg: Math.round((Math.atan2(wall.nx, wall.ny) * 180 / Math.PI + 360) % 360), wallM: Math.round(wall.len) };
    if (!pick || pick.obliquityDeg > 35) { out[r.id] = { ...base, skip: pick ? `oblique ${Math.round(pick.obliquityDeg)}` : 'no clear panorama' }; continue; }
    const thumb = await aimedThumbnail(pick, wall, r.heightM, 40);
    if (!thumb) { out[r.id] = { ...base, skip: 'thumbnail failed' }; continue; }
    fs.writeFileSync(path.join(OUT, 'photos', `${r.id}.jpg`), thumb.jpeg);
    const cam = pick.record.geometry.coordinates;
    out[r.id] = { ...base, photo: `photos/${r.id}.jpg`, panoId: pick.panoId, panoDate: pick.timestamp?.slice(0, 10), obliquityDeg: Math.round(pick.obliquityDeg), distM: Math.round(pick.distM),
      camera: [cam[0], cam[1]], headingDeg: thumb.headingDeg, fovDeg: thumb.fovDeg, wallMid: (await import('../../src/canalRecall/facade/rdNew.ts')).rdToLngLat(wall.mid) };
    got[c] = (got[c] ?? 0) + 1;
    console.log(`${c} ${got[c]}/${WANT[c]} ${r.id} ${r.address}`);
  } catch (e) { out[r.id] = { cluster: c, skip: String((e as Error).message).slice(0, 120) }; }
  fs.writeFileSync(SAMPLE, JSON.stringify(out, null, 1));
}
fs.writeFileSync(SAMPLE, JSON.stringify(out, null, 1));
console.log(got, 'requests', core.http.requests);
