// node --import tsx --test src/canalRecall/look/sunny.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_WALL_GAIN, SUNLIT_WHITE_LUMA, WALL_WHITE_POINTS } from './measuredWhitePoints.ts';
import { SCENE_LOOK_DEFAULT, SKY, SUNNY_EXPOSURE, SUNNY_SHADE_RATIO, litFacadeWallGain, SUNNY_LIGHT, WALL_GAIN_RANGE, groundTokens, mapLibreSky, measuredWallGain, rigIrradiance, sceneLookFrom, sunnyBase, sceneSlotHex, sceneTokens, srgbToLinear, sunlitMeasuredWall } from './sunny.ts';
import { LEGACY_LIGHT_RIG, SUNNY_LIGHT_RIG, activeLightRig, lightRigFor } from '../rendererShared/lightRig.ts';
import { hexToRgb, rgbToHsl } from './palette.ts';
import { groundPalette } from '../ownGround/groundLook.ts';
import { basemapGroundPatches } from '../ownGround/basemapPalette.ts';
import { groundKind, maskClass, regionOfMask, regionStats, REGIONS } from './frameRegions.ts';

const hsl = (hex: string) => rgbToHsl(hexToRgb(hex));
const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('sunny is the default look; ?look=legacy opts out to the 2026-10-14 rig', () => {
  assert.equal(SCENE_LOOK_DEFAULT, 'sunny');
  assert.equal(sceneLookFrom(''), 'sunny');
  assert.equal(sceneLookFrom('?look=legacy'), 'legacy');
  assert.equal(sceneLookFrom('?ownGround=1&look=sunny'), 'sunny');
  assert.equal(sceneLookFrom('?look=nonsense'), 'sunny');
  assert.equal(activeLightRig(''), SUNNY_LIGHT_RIG);
  assert.equal(activeLightRig('?look=legacy'), LEGACY_LIGHT_RIG);
  assert.equal(lightRigFor('legacy').sunColour, '#ffe9cc', 'legacy rig untouched');
  // Direction and shadows are the legacy rig's: only colour and intensity move.
  for (const k of ['sunAzimuthDeg', 'sunElevationDeg', 'shadows', 'shadowMapSize', 'shadowIntensity'] as const) assert.equal(SUNNY_LIGHT_RIG[k], LEGACY_LIGHT_RIG[k]);
});

test('sunny rig: warmer key, sky-blue fill, exposure solved so a sun-facing wall draws its albedo', () => {
  const sun = hsl(SUNNY_LIGHT.sunColour), legacySun = hsl(LEGACY_LIGHT_RIG.sunColour);
  assert.ok(sun[0] < legacySun[0] + 1e-9 && sun[1] >= legacySun[1], `warmer key ${SUNNY_LIGHT.sunColour}`);
  const [r, g, b] = hexToRgb(SUNNY_LIGHT.skyColour);
  // A stronger fill (SUNNY_SHADE_RATIO 0.55) needs more white to keep level ground neutral: still sky blue, paler.
  assert.ok(b > g && g > r && b - r >= 25, `fill is sky blue ${SUNNY_LIGHT.skyColour}`);
  // The fill is the measured clear sky mixed toward white until level ground receives neutral light (white balance).
  const base = sunnyBase(), [hr, hg, hb] = hexToRgb(SKY.horizon);
  assert.ok(base.whiteMix > 0 && base.whiteMix < 0.6, `white mix ${base.whiteMix}`);
  hexToRgb(SUNNY_LIGHT.skyColour).forEach((v, i) => assert.ok(Math.abs(v - ([hr, hg, hb][i] + (255 - [hr, hg, hb][i]) * base.whiteMix)) <= 1, `fill channel ${i}`));
  const lin = (h: string) => hexToRgb(h).map(v => srgbToLinear(v)), el = (40 * Math.PI) / 180;
  const flat = [0, 2].map(i => lin(SUNNY_LIGHT.sunColour)[i] * SUNNY_LIGHT.sunIntensity * Math.sin(el) + lin(SUNNY_LIGHT.skyColour)[i] * SUNNY_LIGHT.skyIntensity);
  assert.ok(Math.abs(flat[0] / flat[1] - 1) < 0.01, `level ground light r/b ${flat[0] / flat[1]}`);
  const sunWall = [0, 2].map(i => lin(SUNNY_LIGHT.sunColour)[i] * SUNNY_LIGHT.sunIntensity * Math.cos(el) + (lin(SUNNY_LIGHT.skyColour)[i] + lin(SUNNY_LIGHT.groundColour)[i]) / 2 * SUNNY_LIGHT.skyIntensity);
  assert.ok(sunWall[0] / sunWall[1] > 1.2, 'the sun side reads warm');
  const sunny = rigIrradiance(SUNNY_LIGHT_RIG), legacy = rigIrradiance(LEGACY_LIGHT_RIG);
  assert.ok(Math.abs(sunny.sunWall - 1) < 1e-3, `sun wall ${sunny.sunWall}`);
  assert.ok(Math.abs(legacy.sunWall - 0.742) < 0.005 && Math.abs(legacy.shadeWall - 0.302) < 0.005, 'legacy: 0.74 / 0.30');
  // Shade sides at SUNNY_SHADE_RATIO of a sun side (was the legacy 0.41; docs/one-material-20261016.md).
  assert.ok(Math.abs(legacy.shadeWall / legacy.sunWall - 0.407) < 0.005, 'legacy ratio 0.41');
  assert.ok(Math.abs(sunny.shadeWall / sunny.sunWall - SUNNY_SHADE_RATIO) < 1e-3, `shade ratio ${sunny.shadeWall / sunny.sunWall}`);
  // Exposure 1.081 since the 0.55 shade ratio (1.423 at 0.41: the stronger sky fill carries more of the sun wall).
  assert.ok(Math.abs(SUNNY_EXPOSURE - 1.0809) < 0.001, `exposure ${SUNNY_EXPOSURE}`);
  // Level surfaces get the stronger sky too: flat roofs draw ~12 % over their albedo in linear light (~5 % sRGB); the
  // ground divides it out (ownGround/groundLight.ts FLAT_GROUND_GAIN).
  assert.ok(sunny.flat > 1 && sunny.flat < 1.15, `level ground and flat roofs draw about their albedo: ${sunny.flat}`);
});

test('one wall pipeline: lit facades take the measured walls\' fallback exposure in the sunny look only', () => {
  // The shader linearises the sRGB gain with pow 2.2, so the facade wall moves by FALLBACK_WALL_GAIN in linear light.
  assert.ok(Math.abs(litFacadeWallGain(1, 'sunny') ** 2.2 - 1.106) < 1e-9);
  assert.equal(litFacadeWallGain(255 / 225, 'legacy'), 255 / 225);
  assert.ok(Math.abs(litFacadeWallGain(255 / 225, 'sunny') / (255 / 225) - 1.106 ** (1 / 2.2)) < 1e-12);
});

test('measured sky: blue, the horizon no darker than the upper sky, and it reaches MapLibre only in the sunny look', () => {
  for (const hex of [SKY.zenith, SKY.horizon]) { const [r, g, b] = hexToRgb(hex); assert.ok(b > g && g > r, hex); }
  assert.deepEqual(hexToRgb(SKY.zenith), [158, 195, 237]);
  assert.ok(luma(hexToRgb(SKY.horizon)) >= luma(hexToRgb(SKY.zenith)));
  assert.equal(mapLibreSky('legacy'), null);
  assert.equal(mapLibreSky('sunny')!['sky-color'], SKY.zenith);
});

test('measured wall normalisation: divided by the recorded white, multiplied by the sunlit white; hue and saturation held', () => {
  // A wall recorded under a white at the sunlit white is unchanged.
  const atSunlit = [SUNLIT_WHITE_LUMA, SUNLIT_WHITE_LUMA, SUNLIT_WHITE_LUMA];
  assert.equal(sunlitMeasuredWall('#6d5543', atSunlit), '#6d5543');
  // The normalised 215 white (measureFacade.ts) -> linear gain lin(219)/lin(215).
  const g215 = measuredWallGain([215, 215, 215]);
  assert.ok(Math.abs(g215 - srgbToLinear(SUNLIT_WHITE_LUMA) / srgbToLinear(215)) < 1e-9 && g215 > 1);
  // Exactly the linear scalar on every channel.
  const out = hexToRgb(sunlitMeasuredWall('#6d5543', [215, 215, 215])), inn = hexToRgb('#6d5543');
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(srgbToLinear(out[i]) / srgbToLinear(inn[i]) - g215) < 0.03, `channel ${i}`);
  // Hue within 2°, saturation within 0.03, lighter.
  for (const hex of ['#6d5543', '#4a302b', '#8a3e2e', '#585955', '#3a2a28']) {
    const a = hsl(hex), b = hsl(sunlitMeasuredWall(hex));
    assert.ok(Math.abs(((a[0] - b[0] + 540) % 360) - 180) < 2.5 || a[1] < 0.02, `${hex} hue ${a[0]} -> ${b[0]}`);
    assert.ok(Math.abs(a[1] - b[1]) < 0.04, `${hex} sat`);
    assert.ok(b[2] >= a[2], `${hex} lighter`);
  }
  // No recorded white: the median correction measured over the crops with one.
  assert.equal(measuredWallGain(null), FALLBACK_WALL_GAIN);
  assert.ok(FALLBACK_WALL_GAIN > 1 && FALLBACK_WALL_GAIN < 1.3);
  // A table hex uses its own white; the gain is bounded.
  const [hex, white] = Object.entries(WALL_WHITE_POINTS)[0];
  assert.equal(sunlitMeasuredWall(hex), sunlitMeasuredWall(hex, white));
  assert.equal(measuredWallGain([30, 30, 30]), WALL_GAIN_RANGE[1]);
  assert.equal(measuredWallGain([255, 255, 255]), Math.max(WALL_GAIN_RANGE[0], srgbToLinear(SUNLIT_WHITE_LUMA)));
  // Past white the colour scales down as a whole (hue held), never clips one channel.
  const pale = sunlitMeasuredWall('#f0e8e0', [120, 120, 120]);
  assert.ok(Math.max(...hexToRgb(pale)) <= 255 && Math.abs(hsl(pale)[0] - hsl('#f0e8e0')[0]) < 3);
});

test('sceneSlotHex: only measured walls move, only in the sunny look; painted stone and glass keep their rules', () => {
  assert.equal(sceneSlotHex('brick', '#6d5543', 'measured', 'sunny'), sunlitMeasuredWall('#6d5543'));
  assert.equal(sceneSlotHex('accent', '#6d5543', 'measured', 'sunny'), sunlitMeasuredWall('#6d5543'));
  assert.equal(sceneSlotHex('brick', '#6d5543', 'measured', 'legacy'), '#6d5543');
  assert.equal(sceneSlotHex('brick', '#6d5543', null, 'sunny'), '#6d5543');
  assert.equal(sceneSlotHex('stone', '#eae7dc', 'measured', 'sunny'), '#eae7dc');
  assert.equal(sceneSlotHex('glass', '#46545c', 'measured', 'sunny'), '#46545c');
});

test('tokens: the flat overview basemap and the 3D ground read the same values', () => {
  for (const look of ['bright', 'default'] as const) {
    const t = groundTokens(groundPalette(look));
    const by = Object.fromEntries(basemapGroundPatches([
      { id: 'background', type: 'background' }, { id: 'water', type: 'fill', 'source-layer': 'water' }, { id: 'park', type: 'fill', 'source-layer': 'park' },
      { id: 'road_minor', type: 'line', 'source-layer': 'transportation' }, { id: 'road_path_pedestrian', type: 'line', 'source-layer': 'transportation' },
    ], groundPalette(look)).map(p => [`${p.id}:${p.property}`, p.value]));
    assert.equal(by['background:background-color'], t.land);
    assert.equal(by['water:fill-color'], t.water);
    assert.equal(by['park:fill-color'], t.park);
    assert.equal(by['road_minor:line-color'], t.road);
    assert.equal(by['road_path_pedestrian:line-color'], t.pavement);
  }
  const s = sceneTokens('sunny', 'bright'), l = sceneTokens('legacy', 'bright');
  assert.equal(s.sky, SKY.zenith);
  assert.equal(l.sky, l.land, 'legacy: the land showed above the horizon');
  assert.ok(luma(hexToRgb(s.facade)) > luma(hexToRgb(l.facade)), 'the sunny facade token is the measured median at sunlit exposure');
});

test('frame regions (scripts/look/sunny-frames.ts): mask classes, the ground split, edges dropped', () => {
  assert.equal(maskClass(0, 0, 0), 'sky');
  assert.equal(maskClass(255, 0, 0), 'ground');
  assert.equal(maskClass(0, 255, 0), 'tree');
  assert.equal(maskClass(255, 255, 0), 'other');
  assert.equal(maskClass(128, 128, 255), 'building-roof');
  assert.equal(maskClass(255, 128, 128), 'building-wall');
  assert.equal(maskClass(40, 220, 128), 'building-wall');
  assert.equal(maskClass(128, 128, 128), null, 'not a unit normal: a blend');
  assert.equal(groundKind(132, 130, 124), 'road');
  assert.equal(groundKind(204, 107, 106), 'cycle');
  assert.equal(groundKind(183, 174, 161), 'pavement');
  assert.equal(groundKind(79, 134, 163), 'water', 'the bright look canal is water, not park');
  assert.equal(groundKind(104, 122, 114), 'water', 'the old grey-green canal still reads as water');
  assert.equal(groundKind(96, 140, 70), 'park');
  // 4 x 3 frame: left half wall, right half ground; only the interior pixels whose neighbours agree count.
  const W = 6, H = 3, mask = new Uint8Array(W * H * 3), clean = new Uint8Array(W * H * 3).fill(120);
  for (let i = 0; i < W * H; i++) { const x = i % W; mask.set(x < 3 ? [255, 128, 128] : [255, 0, 0], i * 3); }
  const reg = regionOfMask(mask, clean, W, H);
  assert.equal(REGIONS[reg[1 * W + 1]], 'wall');
  assert.equal(reg[1 * W + 2], 255, 'edge pixel dropped');
  const st = regionStats(new Uint8Array(400 * 3).fill(100), new Uint8Array(400).fill(REGIONS.indexOf('road')));
  assert.equal(st.road!.luma, 100); assert.equal(st.paved!.n, 400); assert.equal(st.wall, null);
});
