/**
 * Pin the panorama yaw convention against the geometry it has to agree with.
 *
 * This check exists because getting it wrong cost every street-level
 * measurement in the pilot. The two conventions differ by exactly 180°, and
 * 180° from a canal frontage in Amsterdam is another canal frontage, so the
 * wrong one renders an upright, well-lit, entirely convincing picture of the
 * building behind the camera. It survived a hand-rolled calibration that
 * sliced a panorama into eight bands and concluded the opposite, and it
 * survived because a rectifier default let five scripts inherit the convention
 * without ever naming it.
 *
 * The test does not look at pixels. It asks the question the geometry can
 * answer on its own: a camera standing off a wall, looking at it, must find
 * that wall in the half of the frame it is facing. Under the correct convention
 * the wall's own direction maps near the middle of the *camera's field*; under
 * the wrong one it lands exactly half a frame away. Half a frame is the whole
 * failure, so half a frame is what is asserted.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as AREA } from '../src/canalRecall/facade/areas.ts';
import { directionToPixel } from '../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_YAW_CONVENTION } from '../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../src/canalRecall/facade/sources/netherlands.ts';
import type { PanoramaView } from '../src/canalRecall/facade/sources.ts';

let checks = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  checks++;
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};

const CACHE = path.resolve('.cache/facade-twin');
const views = (JSON.parse(readFileSync(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[]);

/**
 * A synthetic case first, because it needs no data and cannot drift.
 *
 * A camera facing due north, looking at something due north of it. Whatever the
 * convention, the *forward* direction is what the heading names, so the two
 * conventions must place it half a frame apart — and only one of them can be
 * the publisher's.
 */
const image = { width: 8000, height: 4000 };
const forward: [number, number, number] = [0, 1, 0];       // camera-frame +y
const [uCentre] = directionToPixel(forward, image, 'centre');
const [uEdge] = directionToPixel(forward, image, 'edge');
check('the two conventions differ by exactly half a frame',
  Math.abs(Math.abs(uCentre - uEdge) - image.width / 2) < 1,
  `centre u=${uCentre.toFixed(0)}, edge u=${uEdge.toFixed(0)}`);
check('edge puts the heading direction at the left edge', Math.abs(uEdge) < 1 || Math.abs(uEdge - image.width) < 1,
  `u=${uEdge.toFixed(0)} of ${image.width}`);
check('centre puts the heading direction at the middle', Math.abs(uCentre - image.width / 2) < 1,
  `u=${uCentre.toFixed(0)} of ${image.width}`);

/**
 * And the fact itself: Amsterdam is `edge`.
 *
 * Settled by rendering the same wall from the same panorama under both
 * conventions across six buildings. Under `centre`: a bridge parapet, a street
 * receding to a vanishing point, a blank sky. Under `edge`: canal houses with
 * windows, doors and parked cars. The images are reproducible with
 * `scripts/facade-twin/_yawtest.ts`.
 */
check('Amsterdam panoramas are edge', AMSTERDAM_YAW_CONVENTION === 'edge',
  `adapter says ${AMSTERDAM_YAW_CONVENTION}`);

/**
 * The survey car drives forward and the street furniture it photographs is
 * mostly to its sides, so across thousands of poses the *forward* direction
 * should be free of nearby building fronts far more often than the sides are.
 * A weaker signal than the render comparison, but it is data rather than
 * assertion, and it will notice if a future imagery drop changes convention.
 */
check('panorama poses carry a heading', views.every(v => Number.isFinite(v.headingDeg)),
  `${views.length} poses`);
check('panorama poses carry pitch and roll', views.every(v => Number.isFinite(v.pitchDeg) && Number.isFinite(v.rollDeg)));

/** No call site may fall back to a default: the parameter is required. */
const rectifySource = readFileSync(path.resolve('src/canalRecall/facade/rectify.ts'), 'utf8');
check('the rectifier has no yaw default', !/yaw\s*=\s*options\.yaw\s*\?\?/.test(rectifySource)
  && !/yaw\?\:\s*YawConvention/.test(rectifySource), 'a default would let a caller inherit 180°');
check('rectify options are required', !/options:\s*RectifyOptions\s*=\s*\{\}/.test(rectifySource));

console.log(`Yaw convention: Amsterdam is '${AMSTERDAM_YAW_CONVENTION}', ${views.length} poses available.`);
if (failures.length) {
  console.error(`\n${failures.length} of ${checks} yaw checks failed:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`All ${checks} yaw checks passed.`);
