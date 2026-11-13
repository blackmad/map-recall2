/**
 * Panorama crops and a contact sheet for the top discovery nominations (discovery-front.ts), for the photo verdicts.
 * Open data only: Gemeente Amsterdam panoramas (CC BY 4.0) through the public thumbnail endpoint, disk-cached
 * (scripts/pand-reference/core.ts, PAND_REFERENCE_CACHE).
 *
 *   node --import tsx scripts/landmarks/discovery-front-sheet.ts --in=artifacts/landmarks/discovery-2026-11-13.json
 *        [--top=40] [--dir=artifacts/landmarks/discovery-2026-11-13] [--verdicts=scripts/landmarks/discovery-front-verdicts.json [--set=verdicts|v1]]
 *
 * Per nomination two views of the front run that carried it (the curved run when there is one, else the longest):
 * a frontal view from the panorama nearest a point 18 m out along the outward normal (fov 90), and an oblique view
 * from a panorama ~35 m along the street (fov 60), both aimed at the run's midpoint. Writes <dir>/<rank>-<pand>-{front,oblique}.jpg,
 * <dir>/sheet-<page>.jpg (8 per page) and <dir>/sheet.jpg (all), labels with rank, name, reasons, measures and the
 * verdict when the verdicts file has one.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {cachedBytes, cachedJson} from '../pand-reference/core.ts';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const M_LAT = 111320;
const mLng = (lat: number) => 111320 * Math.cos(lat * Math.PI / 180);

type Pano = {id: string; lng: number; lat: number; year: number};
async function panosNear(lng: number, lat: number, radius: number): Promise<Pano[]> {
  const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng.toFixed(6)},${lat.toFixed(6)}&srid=4326&radius=${radius}&page_size=60&newest_in_range=true`;
  const j = await cachedJson<any>(url);
  return (j._embedded?.panoramas ?? []).map((p: any) => ({id: p.pano_id, lng: p.geometry.coordinates[0], lat: p.geometry.coordinates[1], year: p.mission_year}));
}
const offset = ([lng, lat]: [number, number], east: number, north: number): [number, number] => [lng + east / mLng(lat), lat + north / M_LAT];
const bearingTo = (from: [number, number], to: [number, number]) => (Math.atan2((to[0] - from[0]) * mLng(to[1]), (to[1] - from[1]) * M_LAT) * 180 / Math.PI + 360) % 360;
const dist = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * mLng(a[1]), (a[1] - b[1]) * M_LAT);

/** The panorama nearest `want` whose view of `target` is on the front's outer side. */
async function pick(target: [number, number], want: [number, number], outBearing: number): Promise<Pano | null> {
  const list = await panosNear(want[0], want[1], 25);
  const ok = list.filter(p => { const b = bearingTo([p.lng, p.lat], target); const off = Math.abs(((b - (outBearing + 180)) % 360 + 540) % 360 - 180); return off < 75 && dist([p.lng, p.lat], target) > 6; });
  return ok.sort((a, b) => dist([a.lng, a.lat], want) - dist([b.lng, b.lat], want))[0] ?? null;
}
async function shot(p: Pano, target: [number, number], fov: number, file: string) {
  const heading = bearingTo([p.lng, p.lat], target);
  const url = `https://api.data.amsterdam.nl/panorama/thumbnail/${p.id}/?width=900&fov=${fov}&heading=${heading.toFixed(0)}&pitch=8&aspect=1.33`;
  fs.writeFileSync(file, await cachedBytes(url, '.jpg'));
  return {pano: p.id, year: p.year, heading: +heading.toFixed(0), distM: +dist([p.lng, p.lat], target).toFixed(0), url};
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function tile(files: string[], label: string[], colour: string): Promise<Buffer> {
  const H = 300, W = 400;
  const parts = await Promise.all(files.map(async f => fs.existsSync(f) ? sharp(f).resize(W, H, {fit: 'cover'}).jpeg().toBuffer() : sharp({create: {width: W, height: H, channels: 3, background: '#bbb'}}).jpeg().toBuffer()));
  const text = `<svg width="${W * 2}" height="70" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${colour}"/>${label.map((l, i) => `<text x="8" y="${20 + i * 21}" font-family="Helvetica" font-size="${i ? 15 : 17}" font-weight="${i ? 400 : 700}" fill="#fff">${esc(l)}</text>`).join('')}</svg>`;
  return sharp({create: {width: W * 2, height: H + 70, channels: 3, background: '#fff'}}).composite([{input: parts[0], left: 0, top: 0}, {input: parts[1], left: W, top: 0}, {input: Buffer.from(text), left: 0, top: H}]).jpeg({quality: 82}).toBuffer();
}
async function grid(tiles: Buffer[], cols: number, file: string) {
  const w = 800, h = 370, rows = Math.ceil(tiles.length / cols);
  await sharp({create: {width: cols * w + (cols - 1) * 6, height: rows * h + (rows - 1) * 6, channels: 3, background: '#fff'}})
    .composite(tiles.map((t, i) => ({input: t, left: (i % cols) * (w + 6), top: Math.floor(i / cols) * (h + 6)}))).jpeg({quality: 80}).toFile(file);
}

if (process.argv[1]?.endsWith('landmarks/discovery-front-sheet.ts')) {
  const inFile = arg('in'), top = Number(arg('top', '40'));
  const doc = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  const dir = arg('dir', inFile.replace(/\.json$/, ''));
  const verdicts: Record<string, {verdict: string; note?: string}> = arg('verdicts') && fs.existsSync(arg('verdicts')) ? (d => d[arg('set', 'verdicts')] ?? {})(JSON.parse(fs.readFileSync(arg('verdicts'), 'utf8'))) : {};
  fs.mkdirSync(dir, {recursive: true});
  const tiles: Buffer[] = [], shots: Record<string, unknown> = {};
  for (const n of doc.nominations.slice(0, top)) {
    const base = path.join(dir, `${String(n.rank).padStart(2, '0')}-${n.pand}`);
    const files = [`${base}-front.jpg`, `${base}-oblique.jpg`];
    if (n.aim) {
      const target = n.aim.lngLat as [number, number];
      const outBearing = (90 - n.aim.normalDeg + 360) % 360; // RD angle (x east, y north) to compass bearing
      const ob = outBearing * Math.PI / 180, along = (outBearing + 90) * Math.PI / 180;
      const rec: Record<string, unknown> = {};
      try {
        const p = await pick(target, offset(target, Math.sin(ob) * 18, Math.cos(ob) * 18), outBearing);
        if (p) rec.front = await shot(p, target, 90, files[0]);
        const along1 = Math.min(35, n.aim.runM / 2 + 10);
        for (const sgn of [1, -1]) {
          const q = await pick(target, offset(target, Math.sin(ob) * 10 + sgn * Math.sin(along) * along1, Math.cos(ob) * 10 + sgn * Math.cos(along) * along1), outBearing);
          if (q && q.id !== p?.id) { rec.oblique = await shot(q, target, 60, files[1]); break; }
        }
      } catch (e) { rec.error = String(e); }
      shots[n.pand] = rec;
    }
    const v = verdicts[n.pand];
    const colour = !v ? '#333' : v.verdict === 'landmark' ? '#1d6b3a' : v.verdict === 'false-positive' ? '#8a1f1f' : '#7a5a00';
    const m = n.measures;
    tiles.push(await tile(files, [
      `#${n.rank} ${n.name ?? n.pand}`.slice(0, 80),
      `${n.reasons.join(' + ')} · front ${m.frontM} m · curve ${m.curveDeg}° · orn ${m.ornament.join('/') || '-'} · score ${n.score}`.slice(0, 96),
      v ? `${v.verdict.toUpperCase()}: ${v.note ?? ''}`.slice(0, 96) : `${n.key} · ${n.gebied ?? '-'} · pand ${n.pand}`,
    ], colour));
    console.log(`#${n.rank} ${n.pand} ${JSON.stringify(shots[n.pand] ?? {}).slice(0, 160)}`);
  }
  for (let i = 0; i < tiles.length; i += 8) await grid(tiles.slice(i, i + 8), 2, path.join(dir, `sheet-${String(i / 8 + 1).padStart(2, '0')}.jpg`));
  await grid(tiles, 4, path.join(dir, 'sheet.jpg'));
  fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify({source: 'Gemeente Amsterdam panoramas, CC BY 4.0 (https://api.data.amsterdam.nl/panorama/)', shots}, null, 1));
  console.log(`wrote ${dir}/sheet.jpg and ${Math.ceil(tiles.length / 8)} pages`);
}
