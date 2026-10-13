/**
 * The appearance resolver's decisions, checked without downloading a city.
 *
 * The rule under test is the one that keeps this honest: a measurement always
 * beats a prior, and a prior never gets to call itself a measurement.
 */
import assert from 'node:assert/strict';
import {
  eraForYear, isMeasured, measuredHeight, resolveAppearance,
} from '../src/canalRecall/buildingAppearance.ts';
import { PERIOD_PRIORS, PERIODS } from '../src/canalRecall/look/palette.ts';

let checks = 0;
const check = (label: string, run: () => void) => { run(); checks++; void label; };

// --- Eras ------------------------------------------------------------------
// The eras are the renderer's periods (look/palette.ts, 1860 / 1915 / 1945): one scheme.
check('a year lands in the era that was building then', () => {
  assert.equal(eraForYear(1650)?.period, 'canal');
  assert.equal(eraForYear(1875)?.period, 'c19');
  assert.equal(eraForYear(1921)?.period, 'school');
  assert.equal(eraForYear(1960)?.period, 'modern');
  assert.equal(eraForYear(2019)?.period, 'modern');
});

check('an era boundary belongs to the era it opens', () => {
  assert.equal(eraForYear(1859)?.period, 'canal');
  assert.equal(eraForYear(1860)?.period, 'c19');
  assert.equal(eraForYear(1914)?.period, 'c19');
  assert.equal(eraForYear(1915)?.period, 'school');
  assert.equal(eraForYear(1944)?.period, 'school');
  assert.equal(eraForYear(1945)?.period, 'modern');
});

check('a year the register cannot mean is refused', () => {
  // BAG carries placeholder years for buildings older than the register, and
  // an unparsed field arrives as undefined. Neither is a date.
  assert.equal(eraForYear(1005), undefined);
  assert.equal(eraForYear(0), undefined);
  assert.equal(eraForYear(undefined), undefined);
  assert.equal(eraForYear(null), undefined);
  assert.equal(eraForYear(Number.NaN), undefined);
  assert.equal(eraForYear(3000), undefined, 'a year in the future is a data error');
});

check('every era has a distinct colour pair', () => {
  const eras = PERIODS.map((period) => PERIOD_PRIORS[period]);
  const walls = new Set(eras.map((era) => era.wall));
  assert.equal(walls.size, eras.length, 'two eras painting the same colour teach nothing');
  for (const era of eras) {
    assert.match(era.wall, /^#[0-9A-Fa-f]{6}$/, `${era.label} wall`);
    assert.match(era.roof, /^#[0-9A-Fa-f]{6}$/, `${era.label} roof`);
  }
});

// --- Evidence order --------------------------------------------------------
check('an OSM colour tag beats everything', () => {
  const resolved = resolveAppearance({
    osmColour: '#123456', osmMaterial: 'brick', constructionYear: 1650,
  });
  assert.equal(resolved.wallColour, '#123456');
  assert.equal(resolved.wallSource, 'osm-tag');
  assert.ok(isMeasured(resolved.wallSource));
});

check('a material tag beats the era prior', () => {
  const resolved = resolveAppearance({ osmMaterial: 'glass', constructionYear: 1650 });
  assert.equal(resolved.wallSource, 'material-tag');
  assert.notEqual(resolved.wallColour, PERIOD_PRIORS.canal.wall);
  assert.equal(isMeasured(resolved.wallSource), false, 'a material is a tag about a surface, not a colour reading');
});

check('an unknown material falls through to the era rather than to grey', () => {
  const resolved = resolveAppearance({ osmMaterial: 'unobtainium', constructionYear: 1921 });
  assert.equal(resolved.wallSource, 'era-prior');
  assert.equal(resolved.wallColour, PERIOD_PRIORS.school.wall);
});

check('a measured roof wins, and does not colour the wall with it', () => {
  // The aerial sampler sees roofs from straight above and cannot observe a
  // wall at all. Copying a roof reading onto the wall is the exact mistake
  // `vector-map.js` grew separate surfaces to stop making.
  const resolved = resolveAppearance({ measuredRoofColour: '#334455', constructionYear: 1650 });
  assert.equal(resolved.roofColour, '#334455');
  assert.equal(resolved.roofSource, 'measured-aerial');
  assert.equal(resolved.wallColour, PERIOD_PRIORS.canal.wall);
  assert.equal(resolved.wallSource, 'era-prior');
});

check('walls and roofs report their own provenance', () => {
  const resolved = resolveAppearance({ osmColour: '#abcdef', measuredRoofColour: '#123123' });
  assert.equal(resolved.wallSource, 'osm-tag');
  assert.equal(resolved.roofSource, 'measured-aerial');
  assert.equal(resolved.era, undefined, 'no year, so no era claim');
});

check('a building with nothing known says so instead of inventing an era', () => {
  const resolved = resolveAppearance({});
  assert.equal(resolved.wallSource, 'none');
  assert.equal(resolved.roofSource, 'none');
  assert.equal(isMeasured(resolved.wallSource), false);
  assert.match(resolved.wallColour, /^#[0-9A-Fa-f]{6}$/, 'it still has to paint something');
});

check('an era prior is never reported as a measurement', () => {
  const resolved = resolveAppearance({ constructionYear: 1921 });
  assert.equal(resolved.wallSource, 'era-prior');
  assert.equal(isMeasured('era-prior'), false);
  assert.equal(isMeasured('material-tag'), false);
  assert.equal(isMeasured('none'), false);
  assert.ok(isMeasured('osm-tag') && isMeasured('measured-aerial'));
  assert.equal(resolved.era, PERIOD_PRIORS.school.label);
});

// --- Height ----------------------------------------------------------------
check('height is the measured roof above the measured ground', () => {
  assert.equal(measuredHeight(12.5, 2.1), 10.4);
  assert.equal(measuredHeight(9.0019, 2.1219), 6.9);
});

check('a reconstruction that failed does not become a 9 m guess', () => {
  // This is the failure mode being replaced: `levels * 3` or a flat 9 m makes
  // a broken reconstruction indistinguishable from a measured low building.
  assert.equal(measuredHeight(2.0, 2.1), undefined, 'a roof below the ground');
  assert.equal(measuredHeight(2.6, 2.1), undefined, 'half a metre is not a building');
  assert.equal(measuredHeight(500, 2.1), undefined, 'taller than anything in the country');
  assert.equal(measuredHeight(undefined, 2.1), undefined);
  assert.equal(measuredHeight(12.5, undefined), undefined);
  assert.equal(measuredHeight(Number.NaN, 2.1), undefined);
});

process.stdout.write(`Building appearance checks passed (${checks} checks).\n`);
