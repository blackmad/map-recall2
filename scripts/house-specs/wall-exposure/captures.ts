/**
 * Lane WC (#384): the same front in other captures. For each row of a describe-cut cuts.json (the pinned capture, its wall
 * and its `w1` sample), the other winter-or-any captures rankCandidates finds within 30 deg / 40 m whose medium panorama
 * is already cached (no fetch), each sampled as `w1` is (aimPose + frameFor, cutPerspective, wallLab) with the exposure
 * references (analyse.ts wallExposureRef). Writes { rows: [{ pandId, captures: [{ panoId, captured, distM, obliquityDeg,
 * w1, ref }] }] }; the pinned capture comes first. A cross-capture pair (same wall, two days) tests an exposure rule:
 * a rule that removes the capture's exposure brings the two samples together.
 *
 *   node --import tsx scripts/house-specs/wall-exposure/captures.ts --cuts <cuts.json> --out <file> [--max-per 3]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, findPands, normId } from '../../pand-reference/core.ts';
import { rankCandidates, type Args } from '../../house-frames/frames.ts';
import { aimPose, frameFor, gridConvergenceDeg } from '../../house-frames/pose.ts';
import { cutPerspective, loadEquirect } from '../../house-frames/photo.ts';
import { wallExposureRef, wallLab } from '../../house-frames/analyse.ts';

const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const cutsFile = opt('cuts'), out = opt('out'), maxPer = Number(opt('max-per') ?? 3);
if (!cutsFile || !out) { console.error('captures.ts --cuts <cuts.json> --out <file> [--max-per 3]'); process.exit(2); }
const ARGS: Args = { pands: [], season: 'any', preferObliquityDeg: 30, maxDistM: 40, query: '', label: 'run', out: '', panoSize: 'medium', max: Infinity, reopenEvery: 40, prepOnly: true, postOnly: false, reusePhotos: false, inputName: 'wall-exposure' };
const cached = (href?: string) => !!href && fs.existsSync(path.join(CACHE_DIR, crypto.createHash('sha1').update(href).digest('hex') + '.jpg'));

const rows = (JSON.parse(fs.readFileSync(cutsFile, 'utf8')).rows ?? []) as any[];
const fps = await findPands(rows.map(r => r.pandId));
const result: any[] = [];
let pairs = 0;
for (const r of rows) {
  const caps: any[] = [];
  if (r.w1) caps.push({ panoId: r.panoId, captured: r.captured, distM: r.distM, obliquityDeg: r.obliquityDeg, pinned: true, w1: { hex: r.w1.hex, L: r.w1.L, C: r.w1.C, h: r.w1.h }, ref: r.w1.ref ?? null });
  const c = await rankCandidates({ id: normId(r.pandId) }, fps.get(normId(r.pandId)), ARGS);
  if (!('skip' in c)) {
    const day = (t: string) => String(t).slice(0, 10);
    const seen = new Set([day(r.captured)]);
    for (const p of c.ranked) {
      if (caps.length > maxPer) break;
      if (p.obliquityDeg > 30 || p.distM > 40 || seen.has(day(p.timestamp))) continue;
      const href = p.record._links?.equirectangular_medium?.href;
      if (!cached(href)) continue;
      const ll: [number, number] = [p.record.geometry.coordinates[0], p.record.geometry.coordinates[1]];
      const z = Number(p.record.geometry.coordinates[2]), cameraNap = z > 0 ? z - 43.5 : null;
      const pose = aimPose({ lngLat: ll, cameraNap }, r.wall), frame = frameFor(pose);
      const img = await loadEquirect(p.record, 'medium');
      if (!img) continue;
      const cut = cutPerspective(img, frame, gridConvergenceDeg(ll)), lab = wallLab(cut, frame, pose, r.wall);
      if (!lab) continue;
      seen.add(day(p.timestamp));
      caps.push({ panoId: p.panoId, captured: p.timestamp, distM: +p.distM.toFixed(1), obliquityDeg: +p.obliquityDeg.toFixed(1), w1: { hex: lab.hex, L: lab.L, C: lab.C, h: lab.h }, ref: wallExposureRef(cut, frame, pose, r.wall) });
    }
  }
  if (caps.length > 1) pairs += caps.length - 1;
  result.push({ pandId: r.pandId, captures: caps });
}
fs.writeFileSync(out, JSON.stringify({ rows: result }, null, 1));
console.log(`captures: ${result.length} pands, ${result.filter(x => x.captures.length > 1).length} with a second capture, ${pairs} extra captures -> ${out}`);
