// Frontal review cameras and photos for the register-recipes verdict (2026-11-10). For each spot (frontal-spots.ts)
// the camera stands where the Gemeente Amsterdam panorama (CC BY 4.0) stands, aimed at the street wall's middle; the
// panorama thumbnail is cut at the same heading and vertical field of view (1280 x 800). The ride renders come from tests/e2e/register-frontal-strip.spec.ts.
//   npx tsx scripts/register-facts/frontal-photos.ts <spots.json> <outDir>   -> <outDir>/<slug>-photo.jpg, <outDir>/cams.json
import fs from 'node:fs';
import path from 'node:path';
import { cachedBytes, lngLatToRd } from '../pand-reference/core.ts';

const [spotsFile, outDir] = process.argv.slice(2);
// The ride camera (maplibre-style, maxPitch 85) cannot look up, so it stands RENDER_EYE m up, 2 deg down, with a 70 deg
// vertical field; the photo (2.5 m up) pitches up to the same aim point. Narrow streets still crop the crown.
const W = 1280, H = 800, VFOV = Number(process.env.VFOV ?? 70), EYE_Z = 2.5, RENDER_EYE = Number(process.env.RENDER_EYE ?? 6), RENDER_PITCH = -2;
const spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8')) as any[];
fs.mkdirSync(outDir, { recursive: true });
const deg = (r: number) => r * 180 / Math.PI, rad = (d: number) => d * Math.PI / 180;
const cams: any[] = [];
for (const s of spots) {
  const aim: [number, number] = s.aim ?? s.wall.mid;
  const p = lngLatToRd([s.pano.lng, s.pano.lat]), m = lngLatToRd(aim);
  const dist = Math.hypot(m.x - p.x, m.y - p.y);
  const heading = (deg(Math.atan2(m.x - p.x, m.y - p.y)) + 360) % 360;
    // The photo looks at the point the raised render camera looks at (RENDER_EYE m up, RENDER_PITCH deg).
  const aimZ = RENDER_EYE + dist * Math.tan(rad(RENDER_PITCH)), pitch = deg(Math.atan2(aimZ - EYE_Z, dist));
  const hfov = deg(2 * Math.atan(Math.tan(rad(VFOV / 2)) * W / H));
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${s.pano.id}/?width=${W}&aspect=${(W / H).toFixed(2)}&fov=${Math.round(hfov)}&heading=${Math.round(heading)}&pitch=${Math.round(pitch)}`;
  fs.writeFileSync(path.join(outDir, `${s.slug}-photo.jpg`), await cachedBytes(url, '.jpg'));
  cams.push({ slug: s.slug, ids: String(s.id).split(','), eye: [s.pano.lng, s.pano.lat], eyeAlt: RENDER_EYE, target: aim, targetAlt: aimZ, vfov: VFOV, heading: Math.round(heading), pitch: Math.round(pitch), distM: Math.round(dist), pano: s.pano, photoUrl: url, facts: s.facts });
  console.log(s.slug, `${dist.toFixed(1)} m heading ${heading.toFixed(0)} pitch ${pitch.toFixed(0)}`);
}
fs.writeFileSync(path.join(outDir, 'cams.json'), JSON.stringify(cams, null, 1));
