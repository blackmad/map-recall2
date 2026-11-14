// Terrace acceptance frames (lane terraces-20261114): the photo side and the shooting job.
//
//   npx tsx scripts/terraces/frames.ts prep        # pick panoramas, cut the photo at the game pose, write the job
//   PW_PORT=4442 BUNDLES_DIR=artifacts/terraces/bundles TERRACE_FRAMES_JOB=artifacts/terraces/frames/job.json \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/terrace-frames.spec.ts --project=desktop --workers=1
//   npx tsx scripts/terraces/frames.ts sheet       # photo | today | with terraces, one row per pose
//
// Rule 10 (docs/START-HERE-buildings.md §3a): first person, 72 deg vertical FOV, 1440 x 900 at dpr 2, the panorama
// cut to the same pose (scripts/house-frames/pose.ts, photo.ts); plus one as-played chase frame.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import { cachedJson } from '../pand-reference/core.ts';
import { cutPerspective, loadEquirect } from '../house-frames/photo.ts';
import { fpsFor, frameFor, gridConvergenceDeg, PANO_EYE_HEIGHT_M, type FramePose } from '../house-frames/pose.ts';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';
import { FPS_FOV_DEG } from '../../src/canalRecall/engine/fpsCamera.ts';

export const OUT = 'artifacts/terraces/frames';
const W = 1440, H = 900;

/** Acceptance poses: where the terraces are (target) and, optionally, the panorama to use. */
export const TERRACE_POSES: { key: string; label: string; target: [number, number]; lookDownDeg?: number; pano?: string; minM?: number; maxM?: number }[] = [
  // Targets are the placed units' weighted centre or the biggest terrace of each cluster (data/terraces/terraces-v1).
  { key: 'leidseplein', label: 'Leidseplein (square)', target: [4.88263, 52.36457] },
  { key: 'rembrandtplein', label: 'Rembrandtplein north side (square)', target: [4.89711, 52.36638] },
  { key: 'prinsengracht', label: 'Prinsengracht 114, canal-side café row', target: [4.88433, 52.37633] },
  { key: 'gerard-douplein', label: 'Gerard Douplein, De Pijp', target: [4.89306, 52.35583], minM: 8 },
  { key: 'smalle-corner', label: "Café 't Smalle, Egelantiersgracht corner (brown café)", target: [4.88422, 52.37666], minM: 7, maxM: 20 },
];

type Pano = { pano_id: string; timestamp: string; geometry: { coordinates: [number, number, number] }; tags?: string[]; _links: any };
const M = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/**
 * Street panoramas 6-25 m from the target. The terraces must be out: warm months (April-September) in the daytime
 * (09:00 UTC and later; the 2025 missions drove at 03:00-06:00 UTC with every terrace stacked), never the lockdowns
 * (2020-03 to 2021-05, terraces shut); then the newest year and nearest to 12 m.
 */
async function pickPanos(t: (typeof TERRACE_POSES)[number]): Promise<{ rec: Pano; d: number; heading: number }[]> {
  const [lng, lat] = t.target;
  const j = await cachedJson(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng.toFixed(6)},${lat.toFixed(6)}&radius=${t.maxM ?? 25}&srid=4326&page_size=200`);
  const all: { rec: Pano; d: number; heading: number }[] = [];
  for (const p of (j._embedded?.panoramas ?? []) as Pano[]) {
    if ((p.tags ?? []).includes('surface-water')) continue;
    const [plng, plat] = p.geometry.coordinates, dx = (lng - plng) * M(lat), dy = (lat - plat) * 110_540, d = Math.hypot(dx, dy);
    if (d < (t.minM ?? 6) || d > (t.maxM ?? 25)) continue;
    all.push({ rec: p, d, heading: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360 });
  }
  if (t.pano) return all.filter(a => a.rec.pano_id === t.pano);
  const score = (p: Pano) => {
    const m = +p.timestamp.slice(5, 7), h = +p.timestamp.slice(11, 13), ym = p.timestamp.slice(0, 7);
    return (m >= 4 && m <= 9 ? 2 : 0) + (h >= 9 ? 2 : h >= 8 ? 1 : 0) - (ym >= '2020-03' && ym <= '2021-05' ? 4 : 0);
  };
  all.sort((a, b) => score(b.rec) - score(a.rec) || b.rec.timestamp.slice(0, 4).localeCompare(a.rec.timestamp.slice(0, 4)) || Math.abs(a.d - 12) - Math.abs(b.d - 12));
  return all;
}

async function prep(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const poses: unknown[] = [];
  for (const t of TERRACE_POSES) {
    let pick: Awaited<ReturnType<typeof pickPanos>>[number] | null = null, img = null;
    const badMissions = new Set<string>(), mission = (id: string) => id.replace(/_pano_.*$/, '');
    for (const cand of (await pickPanos(t)).slice(0, 30)) {
      if (badMissions.has(mission(cand.rec.pano_id))) continue;
      img = await loadEquirect(cand.rec, 'full'); if (img) { pick = cand; break; }
      badMissions.add(mission(cand.rec.pano_id)); console.log(`${t.key}: ${cand.rec.pano_id} image unavailable, skipping its mission`);
    }
    if (!pick || !img) { console.log(`${t.key}: no panorama`); continue; }
    const [plng, plat] = pick.rec.geometry.coordinates;
    const rd = lngLatToRd(plng, plat);
    const pose: FramePose = { rd: { x: rd[0], y: rd[1] }, lngLat: [plng, plat], eyeHeightM: PANO_EYE_HEIGHT_M, cameraNap: null, headingDeg: pick.heading, lookDownDeg: t.lookDownDeg ?? 10, vfovDeg: FPS_FOV_DEG, width: W, height: H, clipped: [] };
    const cut = cutPerspective(img, frameFor(pose), gridConvergenceDeg(pose.lngLat));
    await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: 3 } }).png().toFile(`${OUT}/${t.key}-photo.png`);
    poses.push({ key: t.key, label: t.label, lngLat: pose.lngLat, headingDeg: pose.headingDeg, fps: fpsFor(pose), pano: pick.rec.pano_id, panoTime: pick.rec.timestamp, distanceM: +pick.d.toFixed(1) });
    console.log(`${t.key}: pano ${pick.rec.pano_id} ${pick.rec.timestamp.slice(0, 10)} at ${pick.d.toFixed(1)} m, heading ${pick.heading.toFixed(0)}`);
  }
  writeFileSync(`${OUT}/job.json`, JSON.stringify({ out: OUT, width: W, height: H, dpr: 2, poses, asPlayed: { key: 'leidseplein', lngLat: [4.88250, 52.36385], headingDeg: 40 } }, null, 1));
}

async function label(file: string, text: string, w: number, h: number): Promise<Buffer> {
  const svg = Buffer.from(`<svg width="${w}" height="30"><rect width="${w}" height="30" fill="black" opacity="0.72"/><text x="10" y="21" font-size="15" font-family="Helvetica" fill="white">${text.replace(/&/g, '&amp;')}</text></svg>`);
  return sharp(file).resize(w, h).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 86 }).toBuffer();
}

async function sheet(): Promise<void> {
  const job = JSON.parse(readFileSync(`${OUT}/job.json`, 'utf8'));
  const pw = 720, ph = 450, gap = 6, rows: Buffer[] = [];
  for (const p of job.poses) {
    const files = [`${OUT}/${p.key}-photo.png`, `${OUT}/${p.key}-today.png`, `${OUT}/${p.key}-terraces.png`];
    if (!files.every(existsSync)) { console.log(`${p.key}: missing frames`); continue; }
    const caps = [`panorama ${p.pano} ${p.panoTime.slice(0, 10)} (CC BY 4.0) | ${p.label}`, 'today: own engine, first person 72 deg, dpr 2', 'with terraces: ?terraces=1, same pose'];
    const panels = await Promise.all(files.map((f, i) => label(f, caps[i], pw, ph)));
    const row = await sharp({ create: { width: pw * 3 + gap * 2, height: ph, channels: 3, background: '#111' } }).composite(panels.map((input, i) => ({ input, left: i * (pw + gap), top: 0 }))).jpeg({ quality: 86 }).toBuffer();
    writeFileSync(`${OUT}/row-${p.key}.jpg`, row);
    rows.push(row);
  }
  const total = rows.length * ph + (rows.length - 1) * gap;
  await sharp({ create: { width: pw * 3 + gap * 2, height: total, channels: 3, background: '#111' } }).composite(rows.map((input, i) => ({ input, left: 0, top: i * (ph + gap) }))).jpeg({ quality: 84 }).toFile(`${OUT}/sheet.jpg`);
  console.log(`wrote ${OUT}/sheet.jpg (${rows.length} rows)`);
}

const cmd = process.argv[2];
if (cmd === 'prep') await prep(); else if (cmd === 'sheet') await sheet(); else console.log('usage: frames.ts prep | sheet');
