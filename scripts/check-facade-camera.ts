/**
 * Pin the panorama camera model against evidence that needs no building.
 *
 * This check replaces `check-facade-yaw.ts`, and the replacement is the point.
 * That check asked whether Amsterdam was `centre` or `edge` and asserted the
 * answer — but the question presumes the equirectangular frame turns with the
 * survey van, and it does not. Both answers were wrong by the van's heading.
 * Worse, the old check could not have caught it: every assertion in it was
 * either synthetic (the two conventions differ by half a frame — true, and
 * irrelevant) or a restatement of the belief being tested.
 *
 * So this one measures instead. Two of its checks are real experiments run
 * against the cached pose fleet, and neither looks at a façade:
 *
 *   - **Heading against travel.** The bearing from each panorama to the next
 *     frame of its own track is the direction the van was moving. If `heading`
 *     is the van's attitude it must track that bearing; if it were a property of
 *     the image it would have no reason to. It tracks it, at +180°, in 96% of
 *     114,560 consecutive pairs.
 *   - **Opposed pairs.** Cameras standing within 1.5 m of each other with
 *     headings 180° apart exist in the thousands — the same spot, driven the
 *     other way on another day. Under a body-aligned frame their raw images
 *     would differ by half a frame. The image half of that experiment needs
 *     pixels and lives in `scripts/facade-twin/pose-experiments.ts`; what is
 *     asserted here is that the pairs exist to run it on.
 *
 * The rest is structure: a model must be stated, required, and world-aligned.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../src/canalRecall/facade/areas.ts';
import { bodyAlignedFrame, worldAlignedFrame, type CameraPose } from '../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_CAMERA, GEOID_SEPARATION_M, hasUsablePose } from '../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import type { PanoramaView } from '../src/canalRecall/facade/sources.ts';

let checks = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  checks++;
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};

const CACHE = path.resolve('.cache/facade-twin');
const views = JSON.parse(readFileSync(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[];

// ---- the model itself, synthetically -------------------------------------

const image = { width: 8000, height: 4000 };
const still: CameraPose = { x: 0, y: 0, z: 0, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };
const turned: CameraPose = { ...still, headingDeg: 90, pitchDeg: 2, rollDeg: -3 };
const px = (d: readonly [number, number, number], pose = still) => AMSTERDAM_CAMERA.project(d, pose, image);

check('north lands at the centre of the frame', Math.abs(px([0, 1, 0])[0] - image.width / 2) < 1,
  `u=${px([0, 1, 0])[0].toFixed(0)} of ${image.width}`);
check('east lands three quarters across', Math.abs(px([1, 0, 0])[0] - image.width * 0.75) < 1,
  `u=${px([1, 0, 0])[0].toFixed(0)}`);
check('west lands one quarter across', Math.abs(px([-1, 0, 0])[0] - image.width * 0.25) < 1,
  `u=${px([-1, 0, 0])[0].toFixed(0)}`);
check('south lands at the seam', (() => { const u = px([0, -1, 0])[0]; return u < 1 || u > image.width - 1; })(),
  `u=${px([0, -1, 0])[0].toFixed(0)}`);
check('the horizon is the middle row', Math.abs(px([0, 1, 0])[1] - image.height / 2) < 1);
check('up is the top of the frame', px([0, 0.001, 1])[1] < image.height * 0.02);
check('azimuth increases clockwise', px([1, 1, 0])[0] > px([0, 1, 0])[0] && px([-1, 1, 0])[0] < px([0, 1, 0])[0]);

/**
 * The load-bearing property: the van's attitude does not move the picture.
 *
 * If this ever fails, every derived façade is suspect, because it is exactly
 * the mistake that was made — a projection rotated by a field that describes
 * the vehicle rather than the frame.
 */
const [uStill] = px([3, 20, 0]);
const [uTurned] = px([3, 20, 0], turned);
check('a world-aligned frame ignores the vehicle attitude', Math.abs(uStill - uTurned) < 1e-6,
  `heading 0 gives u=${uStill.toFixed(1)}, heading 90 gives u=${uTurned.toFixed(1)}`);
const body = bodyAlignedFrame('test-body', 0);
check('a body-aligned frame does not ignore it',
  Math.abs(body.project([3, 20, 0], still, image)[0] - body.project([3, 20, 0], turned, image)[0]) > 100,
  'the two model kinds must be distinguishable, or the distinction is not being tested');
check('the adapter states a world-aligned model', AMSTERDAM_CAMERA.id === worldAlignedFrame(AMSTERDAM_CAMERA.id, 0.5).id
  && Math.abs(AMSTERDAM_CAMERA.project([0, 1, 0], turned, image)[0] - image.width / 2) < 1,
  `adapter says '${AMSTERDAM_CAMERA.id}'`);

/** No call site may fall back to a default: the model is a required argument. */
const rectifySource = readFileSync(path.resolve('src/canalRecall/facade/rectify.ts'), 'utf8');
check('the rectifier has no camera default', !/camera\s*=\s*options\.camera\s*\?\?/.test(rectifySource)
  && !/camera\?\:\s*CameraModel/.test(rectifySource), 'a default would let a caller inherit the wrong publisher');
check('rectify options are required', !/options:\s*RectifyOptions\s*=\s*\{\}/.test(rectifySource));
check('no yaw convention survives anywhere', !/YawConvention/.test(rectifySource),
  'the centre/edge question was the wrong question and must not come back');

// ---- heading is the van, measured from the van's own track ---------------

/**
 * Consecutive frames of one track, and the bearing between their published
 * positions. Frame numbers increase with time (122,647 pairs agree, 0 disagree),
 * so this bearing is the direction of travel.
 */
const tracks = new Map<string, Array<{ view: PanoramaView; n: number }>>();
for (const view of views) {
  const m = view.panoramaId.match(/^(.*)_(\d{6})$/);
  if (!m) continue;
  const list = tracks.get(m[1]) ?? [];
  list.push({ view, n: Number(m[2]) });
  tracks.set(m[1], list);
}
const M_PER_DEG_LAT = 111_320;
const midLat = views.length ? views[Math.floor(views.length / 2)].lngLat[1] : 52.37;
const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
const wrap180 = (d: number) => ((d % 360) + 540) % 360 - 180;

let straightPairs = 0, reversed = 0, forwards = 0;
for (const list of tracks.values()) {
  list.sort((a, b) => a.n - b.n);
  for (let i = 0; i + 1 < list.length; i++) {
    if (list[i + 1].n - list[i].n !== 1) continue;
    const a = list[i].view, b = list[i + 1].view;
    if (!hasUsablePose(a) || !hasUsablePose(b)) continue;
    const dx = (b.lngLat[0] - a.lngLat[0]) * mPerDegLon, dy = (b.lngLat[1] - a.lngLat[1]) * M_PER_DEG_LAT;
    const distance = Math.hypot(dx, dy);
    if (distance < 3 || distance > 8) continue;
    const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    const offset = Math.abs(wrap180(a.headingDeg - bearing));
    straightPairs++;
    if (offset > 160) reversed++;
    else if (offset < 20) forwards++;
  }
}
const reversedShare = reversed / Math.max(1, straightPairs);
check('there are enough consecutive track pairs to measure heading', straightPairs > 10_000, `${straightPairs} pairs`);
check('heading tracks the direction of travel', (reversed + forwards) / Math.max(1, straightPairs) > 0.9,
  `${Math.round(100 * (reversed + forwards) / Math.max(1, straightPairs))}% of ${straightPairs} pairs are within 20° of the travel axis`);
check('heading is the van, published against the reverse sense', reversedShare > 0.9,
  `${(100 * reversedShare).toFixed(1)}% sit at travel+180°; a value that is a property of the image would not track travel at all`);

// ---- the opposed pairs the image experiment needs ------------------------

const usable = views.filter(hasUsablePose);
const cellOf = (v: PanoramaView) => `${Math.floor(v.lngLat[0] * mPerDegLon / 2)}:${Math.floor(v.lngLat[1] * M_PER_DEG_LAT / 2)}`;
const cells = new Map<string, PanoramaView[]>();
for (const v of usable) {
  const list = cells.get(cellOf(v)) ?? [];
  list.push(v);
  cells.set(cellOf(v), list);
}
let opposed = 0;
for (const list of cells.values()) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const dx = (b.lngLat[0] - a.lngLat[0]) * mPerDegLon, dy = (b.lngLat[1] - a.lngLat[1]) * M_PER_DEG_LAT;
    if (Math.hypot(dx, dy) > 1.5) continue;
    if (Math.abs(wrap180(b.headingDeg - a.headingDeg)) > 160) opposed++;
  }
}
check('opposed same-spot pairs exist for the image experiment', opposed > 1000,
  `${opposed} pairs within 1.5 m with headings 180° apart`);

// ---- pose sanity, unchanged ---------------------------------------------

const zeroHeight = views.filter(v => !(v.cameraHeight > 0));
const zeroPose = views.filter(v => v.headingDeg === 0 && v.pitchDeg === 0 && v.rollDeg === 0);
check('a zero camera height is rejected, not made arithmetic',
  zeroHeight.length > 0 && zeroHeight.every(v => !hasUsablePose(v)),
  `${zeroHeight.length} of ${views.length} publish height 0`);
check('an all-zero orientation is rejected',
  zeroPose.length > 0 && zeroPose.every(v => !hasUsablePose(v)),
  `${zeroPose.length} publish heading=pitch=roll=0`);
check('the usable fleet is most of the fleet', usable.length > views.length * 0.8,
  `${usable.length} of ${views.length} usable`);
check('the usable fleet has a plausible lens height', (() => {
  const heights = usable.map(v => v.cameraHeight).sort((a, b) => a - b);
  if (!heights.length) return false;
  const median = heights[Math.floor(heights.length / 2)] - GEOID_SEPARATION_M;
  return median > 1.5 && median < 5;
})(), 'median lens height after the geoid separation');

console.log(`Camera model '${AMSTERDAM_CAMERA.id}': north at the frame centre, vehicle attitude ignored.`);
console.log(`  ${straightPairs} consecutive track pairs — ${(100 * reversedShare).toFixed(1)}% put heading at travel+180°.`);
console.log(`  ${opposed} opposed same-spot pairs available for the image experiment.`);
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} camera checks failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`All ${checks} camera checks passed.`);
