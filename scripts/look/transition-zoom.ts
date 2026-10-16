/**
 * The overview → city transition, recorded: a scripted zoom from the flat overview down into a street, frames
 * every 100 ms of flight time, with the discontinuity measured per frame and between adjacent frames.
 *
 *   PORT=4546 node --import tsx scripts/look/transition-zoom.ts --out=artifacts/transition/before [--qs=?transition=0]
 *     [--places=jordaan,oudwest] [--width=1280 --height=800] [--jpg=docs/images/look/transition-before.jpg] [--label=before]
 *
 * The zoom follows the start flight's shape (src/canalRecall/game/introFlight.ts): log-space zoom from 0.15× the
 * driving zoom to the driving zoom over 1.9 s, eased in-out, with `camera.introOverview` 1 → 0 (flat plan view to
 * the chase pitch). Each step is held until drawn (two animation frames + 150 ms) before its screenshot, so a
 * frame is the state at that flight time, not whatever the encoder caught. Eight steps follow the landing.
 * Writes <out>/<place>-NN.png, <out>/metrics.json and (with --jpg) a contact strip, one row per place.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium, type Page } from 'playwright';
import { frameStats, jump, jumps, worstIndex, zoomWarp, GROUND_REGION, VIEW_REGION, type Frame, type JumpStats } from '../../src/canalRecall/overviewTransition/frameMetrics.ts';

const arg = (n: string, d?: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = arg('out', 'artifacts/transition/run')!, qs = arg('qs', '')!, label = arg('label', path.basename(out))!;
const W = Number(arg('width', '1280')), H = Number(arg('height', '800'));
const port = process.env.PORT || '4546';
fs.mkdirSync(out, { recursive: true });

/** Named places: a street in the Jordaan and one in Oud-West, with the heading the rider faces. */
export const PLACES: Record<string, { lng: number; lat: number; bearing: number; label: string }> = {
  jordaan: { lng: 4.88262, lat: 52.37713, bearing: 95, label: 'Westerstraat, Jordaan' },
  oudwest: { lng: 4.87070, lat: 52.36640, bearing: 60, label: 'Kinkerstraat, Oud-West' },
};
const places = arg('places', 'jordaan,oudwest')!.split(',');
const FLIGHT_S = 1.9, STEP_S = 0.1, AFTER_STEPS = 8, FROM_FRACTION = 0.15;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Flight steps: zoom factor of the driving zoom and the overview weight. */
function steps(): { t: number; zoomK: number; overview: number }[] {
  const out: { t: number; zoomK: number; overview: number }[] = [];
  const n = Math.round(FLIGHT_S / STEP_S);
  for (let i = 0; i <= n + AFTER_STEPS; i++) {
    const t = Math.min(1, (i * STEP_S) / FLIGHT_S), e = ease(t);
    out.push({ t: i * STEP_S, zoomK: Math.exp(Math.log(FROM_FRACTION) * (1 - e)), overview: 1 - e });
  }
  return out;
}

async function boot(page: Page) {
  // tsx names arrow functions with an `__name` helper the page does not have.
  await page.addInitScript({ content: "globalThis.__name = f => f;" });
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.goto(`http://127.0.0.1:${port}/canal-drive/${qs}`);
  await page.waitForFunction(() => (window as any).canalRecallGame?.routePois?.length, null, { timeout: 120_000 });
  await page.locator('#travel-mode').selectOption('car', { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.player?.x && g.camera.introOverview === 0; }, null, { timeout: 180_000 });
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
  await page.addStyleTag({ content: 'body > *:not(#vector-map):not(#gameCanvas), body > *:not(#vector-map):not(#gameCanvas) * { visibility: hidden !important; }' });
}

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }) {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), b = bearing * Math.PI / 180;
    const pose = {
      x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm,
      y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm,
      angle: Math.atan2(-Math.cos(b), Math.sin(b)),
    };
    const w = window as any;
    if (w.__holdPose) cancelAnimationFrame(w.__holdPose);
    // Hold the pose and the scripted camera every frame (physics and the route steer would drift them).
    const hold = () => {
      Object.assign(g.player, pose, { speed: 0, vx: 0, vy: 0 });
      if (w.__tz) { g.camera.zoom = w.__tz.zoom; g.camera.introOverview = w.__tz.overview; }
      w.__holdPose = requestAnimationFrame(hold);
    };
    w.__tz = null;
    hold();
  }, p);
  await page.waitForTimeout(1500);
  await settleGround(page);
  await page.waitForTimeout(3000);
}

async function settleGround(page: Page) {
  await page.waitForFunction(() => {
    const og = (window as any).canalRecallGame.vectorMap._ownGround;
    if (!og) return true;
    const s = og.status();
    return s.ready && !s.queued && !Object.keys(s.pending).length;
  }, null, { timeout: 120_000 }).catch(() => {});
}

const frames2 = (page: Page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function grab(page: Page): Promise<{ png: Buffer; frame: Frame }> {
  const png = await page.screenshot();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { png, frame: { data, width: info.width, height: info.height, channels: 3 } };
}

export const SWEEP_FROM = 13.8, SWEEP_TO = 16.2, SWEEP_STEP = 0.1;
async function sweepSwitch(page: Page, name: string, playZoom: number) {
  const camAt = async (mapZoom: number) => {
    // In plan view (`introOverview` 1) the map zoom is log2 of the camera zoom plus a constant.
    const z0 = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getZoom() as number);
    const c0 = await page.evaluate(() => (window as any).canalRecallGame.camera.zoom as number);
    return c0 * 2 ** (mapZoom - z0);
  };
  await page.evaluate(v => { (window as any).__tz = v; }, { zoom: playZoom * FROM_FRACTION, overview: 1 });
  await page.waitForTimeout(500);
  await page.evaluate(v => { (window as any).__tz = v; }, { zoom: await camAt(SWEEP_FROM), overview: 1 });
  await page.waitForTimeout(2500);
  const frames: { z: number; blend: number | null; frame: Frame }[] = [];
  for (let z = SWEEP_FROM; z <= SWEEP_TO + 1e-9; z += SWEEP_STEP) {
    const cam = await camAt(z);
    await page.evaluate(v => { (window as any).__tz = v; }, { zoom: cam, overview: 1 });
    await frames2(page);
    await page.waitForTimeout(250);
    await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap.map.areTilesLoaded(), null, { timeout: 5000 }).catch(() => {});
    const st = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, m = vm.map, c = m.project(m.getCenter()), og = vm._ownGround;
      return { z: m.getZoom() as number, cx: c.x as number, cy: c.y as number, blend: og && og.status().transition ? og.blend.value as number : null };
    });
    const { png, frame } = await grab(page);
    fs.writeFileSync(path.join(out, `${name}-sweep-${st.z.toFixed(1)}.png`), png);
    frames.push({ z: st.z, blend: st.blend, frame });
    (frames as any).centre = [st.cx, st.cy];
  }
  const [cx, cy] = (frames as any).centre as [number, number];
  const steps: { from: number; to: number; blend: [number | null, number | null]; raw: JumpStats; compensated: JumpStats; ground: JumpStats }[] = [];
  for (let i = 0; i + 1 < frames.length; i++) {
    const a = frames[i], b = frames[i + 1], warped = zoomWarp(a.frame, 2 ** (b.z - a.z), cx, cy);
    steps.push({ from: +a.z.toFixed(2), to: +b.z.toFixed(2), blend: [a.blend, b.blend], raw: jump(a.frame, b.frame, VIEW_REGION), compensated: jump(warped, b.frame, VIEW_REGION), ground: jump(warped, b.frame, GROUND_REGION) });
  }
  let w = 0;
  for (let i = 1; i < steps.length; i++) if (steps[i].compensated.overDE > steps[w].compensated.overDE) w = i;
  const sorted = steps.map(s => s.compensated.overDE).sort((p, q) => p - q);
  return { from: SWEEP_FROM, to: SWEEP_TO, step: SWEEP_STEP, steps, worst: steps[w], medianCompensatedOverDE: sorted[sorted.length >> 1] };
}

// --strip-only: rebuild the contact strip from <out>/metrics.json and the saved frames.
const stripOnly = process.argv.includes('--strip-only');
let report: Record<string, unknown> = { qs, viewport: [W, H], groundRegion: GROUND_REGION, viewRegion: VIEW_REGION, flightS: FLIGHT_S, stepS: STEP_S, fromFraction: FROM_FRACTION, places: {} };
const rows: { place: string; pngs: Buffer[] }[] = [];
if (stripOnly) {
  report = JSON.parse(fs.readFileSync(path.join(out, 'metrics.json'), 'utf8'));
  for (const name of Object.keys(report.places as object)) {
    const n = ((report.places as Record<string, any>)[name].frames as unknown[]).length;
    rows.push({ place: name, pngs: Array.from({ length: n }, (_, i) => fs.readFileSync(path.join(out, `${name}-${String(i).padStart(2, '0')}.png`))) });
  }
} else {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  const plan = steps();
  for (const name of places) {
    const place = PLACES[name];
    await teleport(page, place);
    const playZoom = await page.evaluate(() => (window as any).canalRecallGame.camera.zoom as number);
    // The overview: held long enough for its tiles, as the start flight's 1.6 s hold.
    await page.evaluate(z => { (window as any).__tz = { zoom: z, overview: 1 }; }, playZoom * FROM_FRACTION);
    await page.waitForTimeout(2500);
    const frames: Frame[] = [], pngs: Buffer[] = [], perFrame: unknown[] = [];
    for (const [i, s] of plan.entries()) {
      await page.evaluate(v => { (window as any).__tz = v; }, { zoom: playZoom * s.zoomK, overview: s.overview });
      await frames2(page);
      await page.waitForTimeout(150);
      const state = await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap, m = vm.map;
        return { mapZoom: +m.getZoom().toFixed(3), pitch: +m.getPitch().toFixed(1), blend: vm._ownGround && vm._ownGround.status().transition ? +vm._ownGround.blend.value.toFixed(3) : null };
      });
      const { png, frame } = await grab(page);
      fs.writeFileSync(path.join(out, `${name}-${String(i).padStart(2, '0')}.png`), png);
      frames.push(frame); pngs.push(png);
      perFrame.push({ i, t: +s.t.toFixed(2), ...state, whole: frameStats(frame, VIEW_REGION), ground: frameStats(frame, GROUND_REGION) });
    }
    const whole = jumps(frames, VIEW_REGION), ground = jumps(frames, GROUND_REGION), worst = worstIndex(whole);
    (report.places as Record<string, unknown>)[name] = {
      ...place, playZoom, frames: perFrame,
      jumps: whole.map((j, i) => ({ i, whole: j, ground: ground[i] })),
      worst: { from: worst, to: worst + 1, whole: whole[worst], ground: ground[worst] },
      maxGroundOverDE: Math.max(...ground.map(j => j.overDE)),
    };
    // The switch without the camera's motion: a plan-view sweep in 0.1 zoom steps through the blend window, each
    // frame compared with the previous one magnified about the map centre (zoomWarp), so what is left is the change
    // the transition made, plus resampling error on hard edges.
    const sweep = await sweepSwitch(page, name, playZoom);
    ((report.places as Record<string, any>)[name]).sweep = sweep;
    rows.push({ place: name, pngs });
    await page.evaluate(() => { (window as any).__tz = null; });
    console.log(name, 'sweep worst', JSON.stringify(sweep.worst));
    console.log(name, 'worst', worst, '→', worst + 1, JSON.stringify(whole[worst]), 'ground', JSON.stringify(ground[worst]));
  }
  report.errors = errors;
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(report, null, 1));
  await browser.close();
}

const jpg = arg('jpg');
if (jpg) {
  // Contact strip: per place a row of the frames from 6 before the switch to 6 after (the whole flight is in <out>).
  const TW = 240, TH = Math.round(TW * H / W), HEAD = 22, GAP = 4, TITLE = 30;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const parts: sharp.OverlayOptions[] = [];
  const pr = report.places as Record<string, any>;
  const perRow = 12;
  const total = TITLE + rows.length * (HEAD + 2 * (TH + 16) + GAP * 3);
  const width = (perRow / 2) * (TW + GAP);
  parts.push({ input: Buffer.from(`<svg width="${width}" height="${TITLE}"><text x="6" y="21" font-family="Helvetica, Arial" font-size="16" font-weight="bold" fill="#1f2328">${esc(`Overview to city, ${label}: scripted zoom, a frame per 100 ms of flight (1280x800, chase)`)}</text></svg>`), top: 0, left: 0 });
  let top = TITLE;
  for (const row of rows) {
    const p = pr[row.place], w = p.worst, sw = p.sweep?.worst;
    // From two frames before the city starts (map zoom 14), so before and after strips show the same flight frames.
    const enter = p.frames.findIndex((f: any) => f.mapZoom >= 14);
    const start = Math.max(0, Math.min(row.pngs.length - perRow, (enter < 0 ? w.from : enter) - 2));
    parts.push({ input: Buffer.from(`<svg width="${width}" height="${HEAD}"><rect width="100%" height="${HEAD}" fill="#1f2328"/><text x="6" y="15" font-family="Helvetica, Arial" font-size="12" fill="#fff">${esc(`${p.label}. Flight, worst step ${w.from}→${w.to} (camera motion alone moves ~40 %): ΔL ${w.whole.dLuma.toFixed(1)}, Δchroma ${w.whole.dChroma.toFixed(1)}, ΔE>20 on ${(100 * w.whole.overDE).toFixed(1)} %.${sw ? ` Plan-view sweep, motion cancelled: worst ΔE>20 ${(100 * sw.compensated.overDE).toFixed(1)} % at z${sw.from}→${sw.to}, ΔL ${sw.compensated.dLuma.toFixed(1)}` : ''}`)}</text></svg>`), top, left: 0 });
    top += HEAD + GAP;
    for (let k = 0; k < perRow; k++) {
      const i = start + k, f = p.frames[i];
      const thumb = await sharp(row.pngs[i]).resize(TW, TH).png().toBuffer();
      const r = Math.floor(k / (perRow / 2)), c = k % (perRow / 2);
      const x = c * (TW + GAP), y = top + r * (TH + 16 + GAP);
      const hot = i === w.from || i === w.to;
      parts.push({ input: Buffer.from(`<svg width="${TW}" height="16"><text x="2" y="12" font-family="Helvetica, Arial" font-size="11" fill="${hot ? '#c0392b' : '#1f2328'}">${esc(`#${i} t=${f.t.toFixed(1)}s z${f.mapZoom} p${f.pitch}${f.blend != null ? ` b${f.blend}` : ''}`)}</text></svg>`), top: y, left: x });
      parts.push({ input: thumb, top: y + 16, left: x });
    }
    top += 2 * (TH + 16 + GAP) + GAP;
  }
  const png = await sharp({ create: { width, height: total, channels: 3, background: '#f4f4f2' } }).composite(parts).png().toBuffer();
  let q = 82, buf = await sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer();
  while (buf.length > 380_000 && q > 30) { q -= 6; buf = await sharp(png).jpeg({ quality: q, mozjpeg: true }).toBuffer(); }
  fs.mkdirSync(path.dirname(jpg), { recursive: true });
  fs.writeFileSync(jpg, buf);
  console.log(jpg, buf.length, 'bytes, q', q);
}
