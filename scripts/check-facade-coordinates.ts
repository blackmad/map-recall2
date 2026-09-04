/**
 * Pin the RD New ↔ WGS84 transform the façade twin measures in.
 *
 * Control points are authoritative RD/WGS84 pairs from PDOK's Locatieserver,
 * committed under src/canalRecall/facade/fixtures so this check is offline and
 * deterministic. Sixteen sit inside the pilot boundary; eight are spread across
 * the Netherlands so a correction fitted to Amsterdam alone cannot pass.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fromLocalMetres, lngLatToRd, PILOT_LOCAL_ORIGIN, rdToLngLat, toLocalMetres,
  CANAL_WATER_LEVEL_NAP_M, type LngLat, type RdPoint,
} from '../src/canalRecall/facade/rdNew.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(here, '../src/canalRecall/facade/fixtures/rd-control-points.json'), 'utf8')) as {
  source: string;
  points: Array<{ name: string; rd: RdPoint; lngLat: LngLat }>;
};

const failures: string[] = [];
let checks = 0;
const check = (label: string, condition: boolean, detail: string) => {
  checks++;
  if (!condition) failures.push(`${label}: ${detail}`);
  if (!condition || process.env.VERBOSE) console.log(`${condition ? 'ok  ' : 'FAIL'} ${label} — ${detail}`);
};

const METRES_PER_DEGREE_LATITUDE = 111_320;
const metresPerDegreeLongitude = (latitude: number) => METRES_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180);

/**
 * Two tolerances, because the residual has a shape: once the datum offset is
 * removed, what is left is a polynomial fit centred near Amersfoort, so it is
 * smallest in the middle of the country and largest at its edges. The pilot
 * sits 25 km from the fit centre and holds to a few millimetres; Vlissingen and
 * Maastricht do not, and demanding that they would be pinning noise.
 *
 * The tight one is the number façade measurement actually depends on — a
 * pipeline that measures from 12.5 cm orthophoto pixels cannot afford more than
 * a small fraction of a pixel of transform error inside the boundary.
 */
const PILOT_TOLERANCE_M = 0.005;
const NATIONAL_TOLERANCE_M = 0.015;
/** The pilot boundary's bounding box in RD, with a kilometre of slack. */
const inPilotArea = ({ x, y }: RdPoint) => x > 119_500 && x < 122_500 && y > 486_000 && y < 489_000;

const errors: number[] = [];
const pilotErrors: number[] = [];
for (const point of fixture.points) {
  const pilot = inPilotArea(point.rd);
  const tolerance = pilot ? PILOT_TOLERANCE_M : NATIONAL_TOLERANCE_M;
  const scope = pilot ? 'pilot' : 'national';

  const [lng, lat] = rdToLngLat(point.rd);
  const forward = Math.hypot(
    (lng - point.lngLat[0]) * metresPerDegreeLongitude(point.lngLat[1]),
    (lat - point.lngLat[1]) * METRES_PER_DEGREE_LATITUDE,
  );
  const rd = lngLatToRd(point.lngLat);
  const inverse = Math.hypot(rd.x - point.rd.x, rd.y - point.rd.y);
  errors.push(forward, inverse);
  if (pilot) pilotErrors.push(forward, inverse);

  check(`rd→wgs84 ${point.name} [${scope}]`, forward <= tolerance, `${(forward * 1000).toFixed(1)} mm from PDOK (tolerance ${tolerance * 1000} mm)`);
  check(`wgs84→rd ${point.name} [${scope}]`, inverse <= tolerance, `${(inverse * 1000).toFixed(1)} mm from PDOK (tolerance ${tolerance * 1000} mm)`);
}

// Round-tripping must not drift: the pipeline reprojects at its edges repeatedly.
let worstRoundTrip = 0;
for (let x = 118_000; x <= 124_000; x += 250) {
  for (let y = 485_000; y <= 490_000; y += 250) {
    const back = lngLatToRd(rdToLngLat({ x, y }));
    worstRoundTrip = Math.max(worstRoundTrip, Math.hypot(back.x - x, back.y - y));
  }
}
check('round trip over the pilot area', worstRoundTrip <= 0.01, `worst drift ${(worstRoundTrip * 1000).toFixed(2)} mm`);

// Relative geometry is what façade measurement actually depends on: a 5.40 m
// canal-house plot must still be 5.40 m wide after a trip through WGS84.
let worstScale = 0;
for (let x = 119_500; x <= 122_500; x += 250) {
  for (let y = 486_000; y <= 489_000; y += 250) {
    for (const [dx, dy] of [[5.4, 0], [0, 5.4], [3.8, 3.8]] as const) {
      const a = lngLatToRd(rdToLngLat({ x, y }));
      const b = lngLatToRd(rdToLngLat({ x: x + dx, y: y + dy }));
      worstScale = Math.max(worstScale, Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - Math.hypot(dx, dy)));
    }
  }
}
check('plot-width scale preservation', worstScale <= 0.001, `worst error ${(worstScale * 1000).toFixed(3)} mm on a 5.4 m span`);

const local = toLocalMetres({ x: PILOT_LOCAL_ORIGIN.x + 12.5, y: PILOT_LOCAL_ORIGIN.y - 7.25 });
check('local origin translation', local.x === 12.5 && local.y === -7.25, `(${local.x}, ${local.y})`);
const restored = fromLocalMetres(local);
check('local origin inverse', restored.x === PILOT_LOCAL_ORIGIN.x + 12.5 && restored.y === PILOT_LOCAL_ORIGIN.y - 7.25, `(${restored.x}, ${restored.y})`);

// The fixed local origin must sit on the Westermarkt, inside the pilot boundary.
const [originLng, originLat] = rdToLngLat(PILOT_LOCAL_ORIGIN);
const westerkerk = Math.hypot(
  (originLng - 4.88379) * metresPerDegreeLongitude(52.3747),
  (originLat - 52.37466) * METRES_PER_DEGREE_LATITUDE,
);
check('local origin sits on the Westermarkt', westerkerk < 120, `${westerkerk.toFixed(0)} m from the Westerkerk tower`);

check('canal water level is below NAP', CANAL_WATER_LEVEL_NAP_M < 0 && CANAL_WATER_LEVEL_NAP_M > -1, `${CANAL_WATER_LEVEL_NAP_M} m NAP`);

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
console.log(`Control points: ${fixture.points.length} (${fixture.source.split('(')[0].trim()}), ${pilotErrors.length / 2} inside the pilot boundary`);
console.log(`Residual against PDOK — pilot: mean ${(mean(pilotErrors) * 1000).toFixed(1)} mm, worst ${(Math.max(...pilotErrors) * 1000).toFixed(1)} mm`);
console.log(`Residual against PDOK — national: mean ${(mean(errors) * 1000).toFixed(1)} mm, worst ${(Math.max(...errors) * 1000).toFixed(1)} mm`);

if (failures.length) {
  console.error(`\n${failures.length} of ${checks} coordinate checks failed`);
  process.exit(1);
}
console.log(`All ${checks} coordinate checks passed.`);
