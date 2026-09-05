/**
 * The two image experiments that establish the camera model, run from source.
 *
 * `check-facade-camera.ts` asserts the model and checks the *metadata* around
 * it — that heading tracks the van's travel, that opposed pairs exist. It does
 * not open a single photograph, and a review of this branch fairly pointed out
 * that counting 25,031 candidate pairs is not measuring 25,031 image pairs.
 * This is the half that measures pixels. It is separate because it downloads
 * imagery and takes minutes, which is not what a pre-commit gate should do.
 *
 * Neither experiment uses a building, a footprint, a detector or a rectified
 * strip. That is deliberate: every previous attempt to settle this question
 * went through a façade, and in Amsterdam a façade answers "yes" to whatever
 * you point at.
 *
 *   --opposed [--pairs=8]
 *     Cameras standing within 1.5 m of each other with headings 180° apart:
 *     the same spot, driven the other way on another day. Measure the circular
 *     horizontal offset between the two raw frames. A body-aligned frame puts
 *     them half a frame apart; a world-aligned one puts them at zero.
 *
 *   --flow [--tracks=16]
 *     Consecutive frames of one track. For a camera translating by a baseline,
 *     a world point at angular distance ψ from the direction of motion slides
 *     by (b/d)·sin ψ — away from the point being driven towards. So the
 *     horizontal flow is a sinusoid whose ascending zero is the direction of
 *     travel, and travel is known exactly from the two published positions.
 *     Comparing the two gives the frame's azimuth reference and its handedness.
 *
 * Usage:
 *   npx tsx scripts/facade-twin/pose-experiments.ts --opposed --flow
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../../src/canalRecall/facade/areas.ts';
import { AMSTERDAM_CAMERA, hasUsablePose } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import type { PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const CACHE = path.resolve('.cache/facade-twin');
const PREVIEWS = path.join(CACHE, 'pose-experiments');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const has = (n: string) => process.argv.includes(`--${n}`);

const views = (JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[])
  .filter(hasUsablePose);
const M_PER_DEG_LAT = 111_320;
const mPerDegLon = M_PER_DEG_LAT * Math.cos((views[0].lngLat[1] * Math.PI) / 180);
const wrap180 = (d: number) => ((d % 360) + 540) % 360 - 180;
const metres = (a: PanoramaView, b: PanoramaView) =>
  [(b.lngLat[0] - a.lngLat[0]) * mPerDegLon, (b.lngLat[1] - a.lngLat[1]) * M_PER_DEG_LAT] as const;

/**
 * The equirectangular preview, as a horizon band of column feature vectors.
 *
 * Only the band from 0.34 to 0.62 of frame height is read: sky above carries no
 * horizontal structure and the van's own bonnet is below. Each column is
 * mean-removed and normalised so seasonal light and exposure drop out.
 */
const BAND_ROWS = 64;
async function band(view: PanoramaView): Promise<{ cols: Float32Array[]; width: number } | null> {
  await mkdir(PREVIEWS, { recursive: true });
  const file = path.join(PREVIEWS, `${view.panoramaId}.jpg`);
  if (!existsSync(file)) {
    if (!view.previewUrl) return null;
    const response = await fetch(view.previewUrl, { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 2048) return null;              // an error page, not a panorama
    await writeFile(file, bytes);
  }
  let image;
  try { image = jpeg.decode(await readFile(file), { useTArray: true, formatAsRGBA: true }); } catch { return null; }
  const y0 = Math.round(image.height * 0.34), y1 = Math.round(image.height * 0.62);
  const cols: Float32Array[] = [];
  for (let x = 0; x < image.width; x++) {
    const v = new Float32Array(BAND_ROWS);
    let sum = 0;
    for (let i = 0; i < BAND_ROWS; i++) {
      const y = y0 + Math.round((i / BAND_ROWS) * (y1 - y0));
      const s = (y * image.width + x) * 4;
      const g = 0.299 * image.data[s] + 0.587 * image.data[s + 1] + 0.114 * image.data[s + 2];
      v[i] = g; sum += g;
    }
    const mean = sum / BAND_ROWS;
    let norm = 0;
    for (let i = 0; i < BAND_ROWS; i++) { v[i] -= mean; norm += v[i] * v[i]; }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < BAND_ROWS; i++) v[i] /= norm;
    cols.push(v);
  }
  return { cols, width: image.width };
}

const dot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---- experiment 1: opposed pairs -----------------------------------------

if (has('opposed')) {
  const wanted = Number(arg('pairs') ?? 8);
  const cell = new Map<string, PanoramaView[]>();
  for (const v of views) {
    const k = `${Math.floor(v.lngLat[0] * mPerDegLon / 2)}:${Math.floor(v.lngLat[1] * M_PER_DEG_LAT / 2)}`;
    (cell.get(k) ?? cell.set(k, []).get(k)!).push(v);
  }
  const pairs: Array<[PanoramaView, PanoramaView, number]> = [];
  for (const list of cell.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [dx, dy] = metres(list[i], list[j]);
      const distance = Math.hypot(dx, dy);
      if (distance > 1.5) continue;
      if (Math.abs(wrap180(list[j].headingDeg - list[i].headingDeg)) < 160) continue;
      pairs.push([list[i], list[j], distance]);
    }
  }
  pairs.sort((a, b) => a[2] - b[2]);

  console.log(`\nOpposed pairs — same spot, driven the other way. ${pairs.length} candidates.\n`);
  console.log(`${'apart'.padStart(7)}${'Δheading'.padStart(10)}${'measured roll'.padStart(15)}${'peak'.padStart(7)}  dates`);
  const rolls: number[] = [];
  for (const [a, b, distance] of pairs) {
    if (rolls.length >= wanted) break;
    const [A, B] = [await band(a), await band(b)];
    if (!A || !B || A.width !== B.width) continue;
    let best = { score: -2, shift: 0 };
    for (let k = 0; k < A.width; k++) {
      let s = 0;
      for (let x = 0; x < A.width; x += 2) s += dot(A.cols[x], B.cols[(x + k) % B.width]);
      s /= A.width / 2;
      if (s > best.score) best = { score: s, shift: k };
    }
    const roll = wrap180((best.shift / A.width) * 360);
    rolls.push(roll);
    console.log(`${distance.toFixed(2).padStart(6)}m${wrap180(b.headingDeg - a.headingDeg).toFixed(0).padStart(9)}°`
      + `${roll.toFixed(1).padStart(14)}°${best.score.toFixed(3).padStart(7)}  ${a.capturedAt.slice(0, 10)} / ${b.capturedAt.slice(0, 10)}`);
  }
  if (rolls.length) {
    const median = [...rolls].sort((m, n) => m - n)[Math.floor(rolls.length / 2)];
    const worst = Math.max(...rolls.map(Math.abs));
    console.log(`\n  n = ${rolls.length}   median roll ${median.toFixed(2)}°   worst ${worst.toFixed(2)}°`);
    console.log(`  world-aligned predicts 0°; body-aligned predicts ±180°.`);
    console.log(`  → ${worst < 5 ? 'world-aligned' : worst > 175 ? 'body-aligned' : 'NEITHER — investigate'}`);
  }
}

// ---- experiment 2: optical flow ------------------------------------------

if (has('flow')) {
  const wanted = Number(arg('tracks') ?? 16);
  const tracks = new Map<string, Array<{ view: PanoramaView; n: number }>>();
  for (const view of views) {
    const m = view.panoramaId.match(/^(.*)_(\d{6})$/);
    if (!m) continue;
    (tracks.get(m[1]) ?? tracks.set(m[1], []).get(m[1])!).push({ view, n: Number(m[2]) });
  }
  const candidates: Array<[PanoramaView, PanoramaView, number]> = [];
  for (const list of tracks.values()) {
    list.sort((p, q) => p.n - q.n);
    for (let i = 0; i + 1 < list.length; i++) {
      if (list[i + 1].n - list[i].n !== 1) continue;
      const [a, b] = [list[i].view, list[i + 1].view];
      const [dx, dy] = metres(a, b);
      const distance = Math.hypot(dx, dy);
      if (distance < 3 || distance > 8) continue;
      if (Math.abs(wrap180(b.headingDeg - a.headingDeg)) > 4) continue;   // straight run only
      candidates.push([a, b, (Math.atan2(dx, dy) * 180) / Math.PI]);
    }
  }
  // Spread over bearings and years, so the answer cannot be one street's quirk.
  const picked: typeof candidates = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const key = `${Math.floor(((c[2] + 360) % 360) / 30)}|${c[0].capturedAt.slice(0, 4)}`;
    if (seen.has(key)) continue;
    seen.add(key); picked.push(c);
    if (picked.length >= wanted * 2) break;
  }

  const BLOCK = 64, STEP = 8, MAXSHIFT = 170;
  console.log(`\nOptical flow — the expansion centre is the direction of travel.\n`);
  console.log(`${'date'.padStart(11)}${'bearing'.padStart(9)}${'image azimuth'.padStart(15)}${'offset'.padStart(9)}${'agree'.padStart(7)}  n`);
  const offsets: number[] = [];
  const mirrored: number[] = [];
  const agreements: number[] = [];
  for (const [a, b, bearing] of picked) {
    if (offsets.length >= wanted) break;
    const [A, B] = [await band(a), await band(b)];
    if (!A || !B || A.width !== B.width) continue;
    const W = A.width;
    const us: number[] = [], dus: number[] = [], conf: number[] = [];
    for (let u0 = 0; u0 < W; u0 += STEP) {
      let best = -2, bestK = 0, rival = -2;
      const scores: number[] = [];
      for (let k = -MAXSHIFT; k <= MAXSHIFT; k++) {
        let s = 0;
        for (let x = 0; x < BLOCK; x += 2) s += dot(A.cols[(u0 + x) % W], B.cols[(u0 + x + k + W * 2) % W]);
        s /= BLOCK / 2;
        scores.push(s);
        if (s > best) { best = s; bestK = k; }
      }
      for (let i = 0; i < scores.length; i++) if (Math.abs(i - MAXSHIFT - bestK) > 15 && scores[i] > rival) rival = scores[i];
      // A repetitive façade correlates everywhere; require a distinct peak.
      if (best < 0.55 || best - rival < 0.04 || Math.abs(bestK) >= MAXSHIFT - 1) continue;
      us.push(u0 + BLOCK / 2); dus.push(bestK); conf.push(best - rival);
    }
    if (us.length < 40) continue;
    /** du(u) = K·sin(ψ(u) − θ) with K > 0, so the sign alone locates θ. */
    const solve = (sign: number) => {
      let best = { score: -Infinity, theta: 0, agree: 0 };
      for (let d = 0; d < 360; d += 0.25) {
        const th = (d * Math.PI) / 180;
        let score = 0, agree = 0, weight = 0;
        for (let i = 0; i < us.length; i++) {
          const psi = sign * 2 * Math.PI * us[i] / W;
          const predicted = Math.sin(psi - th);
          score += conf[i] * Math.abs(dus[i]) * Math.sign(dus[i]) * Math.sign(predicted);
          if (Math.sign(dus[i]) === Math.sign(predicted)) agree += conf[i];
          weight += conf[i];
        }
        if (score > best.score) best = { score, theta: d, agree: agree / weight };
      }
      return best;
    };
    const forward = solve(+1), backward = solve(-1);
    offsets.push(((forward.theta - bearing) % 360 + 360) % 360);
    mirrored.push(((backward.theta - bearing) % 360 + 360) % 360);
    agreements.push(forward.agree);
    console.log(`${a.capturedAt.slice(0, 10).padStart(11)}${bearing.toFixed(1).padStart(9)}`
      + `${forward.theta.toFixed(1).padStart(15)}${wrap180(forward.theta - bearing).toFixed(1).padStart(9)}`
      + `${forward.agree.toFixed(2).padStart(7)}  ${us.length}`);
  }
  /**
   * Circular mean, concentration, and a circular *median*.
   *
   * The median is the one to quote. A track with a weak flow field can score a
   * high sign-agreement and still return a badly determined angle - agreement
   * measures whether the signs match, not whether the angle is sharp - and two
   * such tracks are enough to drag a mean of fourteen by ten degrees, which at
   * a canal's width is four metres of façade.
   */
  const circular = (ds: number[]) => {
    const r = ds.map(d => (d * Math.PI) / 180);
    const sin = r.reduce((s, v) => s + Math.sin(v), 0) / r.length;
    const cos = r.reduce((s, v) => s + Math.cos(v), 0) / r.length;
    let median = ds[0], bestCost = Infinity;
    for (const candidate of ds) {
      const cost = ds.reduce((s, d) => s + Math.abs(wrap180(d - candidate)), 0);
      if (cost < bestCost) { bestCost = cost; median = candidate; }
    }
    const spread = ds.map(d => Math.abs(wrap180(d - median))).sort((a, b) => a - b);
    return {
      mean: ((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360,
      R: Math.hypot(sin, cos),
      median: ((median % 360) + 360) % 360,
      mad: spread[Math.floor(spread.length / 2)],
    };
  };
  if (offsets.length) {
    const cw = circular(offsets), ccw = circular(mirrored);
    console.log(`\n  n = ${offsets.length}   image azimuth of travel, minus its world bearing:`);
    console.log(`    u increases clockwise      median ${cw.median.toFixed(2)}°  (mad ${cw.mad.toFixed(2)}°)  mean ${cw.mean.toFixed(2)}°  R = ${cw.R.toFixed(3)}`);
    console.log(`    u increases anticlockwise  median ${ccw.median.toFixed(2)}°  (mad ${ccw.mad.toFixed(2)}°)  mean ${ccw.mean.toFixed(2)}°  R = ${ccw.R.toFixed(3)}`);
    // A track whose flow field is weak - a canal on one side, a blank wall on
    // the other - gives a poorly determined angle, and says so in `agree`.
    // Reporting both keeps the weak tracks visible instead of averaged away.
    const strong = offsets.filter((_, i) => agreements[i] >= 0.8);
    if (strong.length >= 3) {
      const st = circular(strong);
      console.log(`    of those, the ${strong.length} with sign-agreement ≥ 0.8: median ${st.median.toFixed(2)}°  (mad ${st.mad.toFixed(2)}°)`);
    }
    const northAtU = ((circular(strong.length >= 3 ? strong : offsets).median / 360) % 1 + 1) % 1;
    console.log(`  → north sits at u = ${northAtU.toFixed(3)}·W; the adapter says ${AMSTERDAM_CAMERA.id}`);
    console.log(`    handedness: ${cw.R > ccw.R + 0.3 ? 'clockwise, decisively' : 'NOT RESOLVED — investigate'}`);
  }
}

if (!has('opposed') && !has('flow')) console.log('Nothing to do. Pass --opposed and/or --flow.');
