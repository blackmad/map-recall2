/**
 * Extract real wall texture from the rectified façades.
 *
 * Colour alone is not appearance. A canal house wall is brick with a bond, a
 * joint and four centuries of weathering, and a flat fill of its median colour
 * reads as cardboard however carefully that colour was measured. The material
 * vocabulary has carried texture *slots* since it was written; this fills them
 * from the buildings themselves rather than from a stock library.
 *
 * The trick is that the hard part is already done. A rectified elevation is
 * orthographic and at a known pixels-per-metre, so a crop of it is a
 * plane-parallel, correctly-scaled sample of the wall — which is exactly what a
 * texture is. No photogrammetry, no perspective correction, no guessing at
 * scale: crop between the openings and the sample is already a tile.
 *
 * Tiles are grouped by measured material rather than kept per building. One
 * building's wall is a texture of that building; twenty buildings' walls that
 * all measured as the same brick, medianed together, is a texture of the
 * *material*, with the sun and the downpipes averaged out of it.
 *
 * Usage: npx tsx scripts/facade-twin/build-textures.ts --per-material=40
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { STRIP_BASE_BELOW_GROUND_M } from '../../src/canalRecall/facade/measure.ts';
import jpeg from 'jpeg-js';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { MATERIALS, nearestMaterial, wallFamily, type MaterialId } from '../../src/canalRecall/facade/materials.ts';
import { rectifyFacade } from '../../src/canalRecall/facade/rectify.ts';
import { AMSTERDAM_YAW_CONVENTION, GEOID_SEPARATION_M } from '../../src/canalRecall/facade/sources/amsterdamPanorama.ts';
import { RD_NEW } from '../../src/canalRecall/facade/sources/netherlands.ts';
import type { MassingRecord, PanoramaView } from '../../src/canalRecall/facade/sources.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const CACHE = path.resolve('.cache/facade-twin');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);
const OUT = path.resolve('public/canal-drive/facade-textures');
const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const PER_MATERIAL = Number(arg('per-material') ?? 40);

/**
 * A tile is 0.63 m square at 128 px — three brick stretchers wide.
 *
 * The module has to be a whole number of bricks or the bond breaks at the seam,
 * and 3 x 0.21 m is the smallest that still carries enough wall to look like
 * wall. At 128 px that is 45 px per stretcher and 10 px per course, which is
 * where a bond starts reading as brick rather than as blocks — the first
 * version used a 1 m tile at 96 px, giving 20 px per stretcher, and the result
 * looked like concrete masonry units the size of a door.
 *
 * 203 px/m is above what the closest panoramas resolve, so the photographic
 * half is upsampled a little. That is the right trade: the colour survives
 * upsampling and the bond is drawn, not sampled.
 */
const TILE_PX = 128;
const TILE_M = 0.63;   // three stretchers plus joints, so the tile seams on a perpend

interface Measured {
  pandId: string; panoramaId: string; standoffM: number; obliquityDeg: number;
  wall: [number, number, number, number]; wallWidthM: number;
  wallRgb: [number, number, number] | null;
  openings: Array<{ xM: number; yM: number; widthM: number; heightM: number }>;
}

const store = JSON.parse(await readFile(path.join(STAGING, 'measured-facades.json'), 'utf8')) as { facades: Record<string, Measured> };
const views = new Map((JSON.parse(await readFile(path.join(CACHE, `${AREA.areaId}-panoramas.json`), 'utf8')).data as PanoramaView[]).map(v => [v.panoramaId, v]));
const recon = JSON.parse(await readFile(path.join(STAGING, 'recon.json'), 'utf8'));
const massing = new Map<string, MassingRecord>(recon.massing.map((m: MassingRecord) => [m.buildingId, m]));

// Only façades sharp enough to carry texture: a wall at 40 m resolves ~30 px/m,
// which is a third of a tile's resolution and would blur the bond away.
const usable = Object.values(store.facades).filter(f =>
  f.wallRgb && f.obliquityDeg <= 10 && f.standoffM <= 26 && f.openings.length >= 2
  && massing.get(f.pandId)?.groundLevel != null && massing.get(f.pandId)?.eavesHeight != null);
console.log(`${Object.keys(store.facades).length} measured façades, ${usable.length} close and square enough for texture`);

const byMaterial = new Map<MaterialId, Measured[]>();
for (const f of usable) {
  const id = nearestMaterial(f.wallRgb!, wallFamily(f.wallRgb!)).material.id;
  (byMaterial.get(id) ?? byMaterial.set(id, []).get(id)!).push(f);
}
for (const [, list] of byMaterial) list.sort((a, b) => a.obliquityDeg - b.obliquityDeg);

const images = new Map<string, { width: number; height: number; data: Uint8ClampedArray }>();
async function panorama(view: PanoramaView) {
  if (images.has(view.panoramaId)) return images.get(view.panoramaId)!;
  if (images.size > 24) images.clear();                       // bounded, these are 32 MB each decoded
  const bytes = await readFile(path.join(CACHE, 'panoramas', `${view.panoramaId}.jpg`));
  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  const image = { width: decoded.width, height: decoded.height, data: decoded.data };
  images.set(view.panoramaId, image);
  return image;
}

/** Wall patches from one façade: square metres that contain no opening. */
function patches(rect: { width: number; height: number; data: Uint8ClampedArray },
                 ppm: number, openings: Measured['openings'], baseOffsetM: number): Uint8ClampedArray[] {
  const found: Uint8ClampedArray[] = [];
  const side = Math.round(TILE_M * ppm);
  const blocked = (xM: number, yM: number) => openings.some(o =>
    // A third of a metre of clearance, so a sill, lintel or reveal shadow does
    // not end up tiled across the whole wall.
    xM + TILE_M > o.xM - 0.33 && xM < o.xM + o.widthM + 0.33 &&
    yM + TILE_M > o.yM - baseOffsetM - 0.33 && yM < o.yM - baseOffsetM + o.heightM + 0.33);

  for (let yM = 0.5; (yM + TILE_M) * ppm < rect.height; yM += TILE_M) {
    for (let xM = 0.2; (xM + TILE_M) * ppm < rect.width; xM += TILE_M) {
      if (blocked(xM, rect.height / ppm - yM - TILE_M)) continue;
      const x0 = Math.round(xM * ppm), y0 = Math.round(rect.height - (yM + TILE_M) * ppm);
      const patch = new Uint8ClampedArray(side * side * 4);
      let dark = 0;
      for (let y = 0; y < side; y++) {
        for (let x = 0; x < side; x++) {
          const src = ((y0 + y) * rect.width + x0 + x) * 4, dst = (y * side + x) * 4;
          patch[dst] = rect.data[src]; patch[dst + 1] = rect.data[src + 1];
          patch[dst + 2] = rect.data[src + 2]; patch[dst + 3] = 255;
          if (rect.data[src] + rect.data[src + 1] + rect.data[src + 2] < 90) dark++;
        }
      }
      // Deep shadow or a missing ray is not brick.
      if (dark > side * side * 0.1) continue;
      found.push(patch);
    }
  }
  return found;
}

/** Resample one patch to the tile size. */
function resample(patch: Uint8ClampedArray): Uint8ClampedArray {
  const side = Math.round(Math.sqrt(patch.length / 4));
  const out = new Uint8ClampedArray(TILE_PX * TILE_PX * 4);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const sx = Math.min(side - 1, Math.floor((x / TILE_PX) * side));
      const sy = Math.min(side - 1, Math.floor((y / TILE_PX) * side));
      const src = (sy * side + sx) * 4, dst = (y * TILE_PX + x) * 4;
      out[dst] = patch[src]; out[dst + 1] = patch[src + 1]; out[dst + 2] = patch[src + 2]; out[dst + 3] = 255;
    }
  }
  return out;
}

/**
 * Median across buildings, then lay the bond in at real brick dimensions.
 *
 * Two attempts at getting the bond photographically both failed, and the
 * failures are worth stating because the second looked like progress.
 *
 * Medianing every building's patches together washes the courses out: brick
 * beds sit at different heights and phases on each house, so averaging twenty
 * walls cancels exactly the signal wanted and leaves a colour swatch. Selecting
 * instead the single building whose tile showed the most horizontal structure
 * was worse — a cornice, a balcony rail and a window's glazing bars all carry
 * far more horizontal energy than a mortar bed, so the selector reliably chose
 * the least brick-like patch available.
 *
 * So the two properties are taken from where each is actually reliable. Colour
 * and weathering come from the photographs, medianed across buildings, which is
 * what that median is good at: it removes downpipes, shadows and passing vans
 * and keeps what the material looks like. The *geometry* comes from the brick
 * itself — a waalformaat brick is 210 × 50 mm and a bed joint about 10 mm, which
 * is not in dispute and does not need measuring off a 40-pixel-per-metre
 * photograph.
 *
 * The result is honest about which half is which: the manifest records the
 * colour as measured and the bond as constructed.
 */
const BRICK_LENGTH_M = 0.21, BRICK_HEIGHT_M = 0.05, JOINT_M = 0.012;

function medianTile(patches: Uint8ClampedArray[]): Uint8ClampedArray {
  const scaled = patches.map(resample);
  const tile = new Uint8ClampedArray(TILE_PX * TILE_PX * 4).fill(255);
  const values: number[] = [];
  for (let i = 0; i < TILE_PX * TILE_PX; i++) {
    for (let c = 0; c < 3; c++) {
      values.length = 0;
      for (const s of scaled) values.push(s[i * 4 + c]);
      values.sort((a, b) => a - b);
      tile[i * 4 + c] = values[values.length >> 1];
    }
    tile[i * 4 + 3] = 255;
  }
  return tile;
}

/**
 * How large this material's tile is in the world.
 *
 * Brick has a module and the tile has to respect it: 0.63 m is three
 * stretchers, so the bond seams on a perpend rather than mid-brick.
 *
 * Paint and render have no module, and giving them a brick's tile was actively
 * wrong — it repeated the same 63 cm of wall up a four-storey elevation, which
 * turns any residual structure in the tile into obvious banding at a spacing
 * the eye locks onto immediately. They get a tile three times as wide, which
 * pushes the repeat past the size of a window and makes it stop reading as a
 * pattern. Nothing is resampled to do it: the same 128 px covers more wall.
 */
function tileMetresFor(family: string): number {
  if (family === 'brick') return TILE_M;
  return family === 'stone' ? TILE_M * 2 : TILE_M * 3;
}

/**
 * Take the horizontal trend out of a tile that should not have one.
 *
 * The median across buildings is supposed to keep what every wall of a material
 * has in common and discard what is particular to one. For brick that works —
 * the courses line up. For paint and render it manufactures structure that is
 * not there: string courses, storey shadows and window heads sit at similar
 * heights on every canal house, so they survive the median as horizontal bands
 * on a surface that in life is flat. Measured colour is the thing worth
 * keeping; the banding is an artefact of how it was measured.
 *
 * So each row is pulled back to the tile's mean, leaving the grain that varies
 * within a row and removing the trend between rows.
 */
function flattenCourses(tile: Uint8ClampedArray): void {
  for (let c = 0; c < 3; c++) {
    let total = 0;
    for (let i = 0; i < TILE_PX * TILE_PX; i++) total += tile[i * 4 + c];
    const mean = total / (TILE_PX * TILE_PX);
    for (let y = 0; y < TILE_PX; y++) {
      let row = 0;
      for (let x = 0; x < TILE_PX; x++) row += tile[(y * TILE_PX + x) * 4 + c];
      const bias = row / TILE_PX - mean;
      for (let x = 0; x < TILE_PX; x++) {
        const i = (y * TILE_PX + x) * 4 + c;
        tile[i] = Math.max(0, Math.min(255, tile[i] - bias));
      }
    }
  }
}

/** Lay a stretcher bond over a measured colour field, in real brick sizes. */
function applyBond(tile: Uint8ClampedArray): void {
  const px = TILE_PX / TILE_M;
  const course = BRICK_HEIGHT_M * px, stretcher = BRICK_LENGTH_M * px, joint = Math.max(1, JOINT_M * px);
  const shade = (i: number, factor: number) => {
    for (let c = 0; c < 3; c++) tile[i * 4 + c] = Math.max(0, Math.min(255, tile[i * 4 + c] * factor));
  };
  for (let y = 0; y < TILE_PX; y++) {
    const row = Math.floor(y / course);
    const inBed = y % course < joint;
    // Half-brick offset on alternate courses — the bond that makes it read as
    // masonry rather than tiling.
    const offset = (row % 2) * (stretcher / 2);
    for (let x = 0; x < TILE_PX; x++) {
      const i = y * TILE_PX + x;
      const inPerp = (x + offset) % stretcher < joint;
      if (inBed || inPerp) { shade(i, 1.14); continue; }        // mortar is paler than brick
      // Gentle per-brick variation so a wall is not forty identical bricks.
      const brick = Math.floor((x + offset) / stretcher) * 31 + row * 17;
      shade(i, 0.94 + ((brick * 2654435761) % 1000) / 1000 * 0.12);
    }
  }
}

await mkdir(OUT, { recursive: true });
const manifest = [];
for (const [materialId, facades] of [...byMaterial.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const byBuilding = new Map<string, Uint8ClampedArray[]>();
  for (const f of facades.slice(0, PER_MATERIAL)) {
    const view = views.get(f.panoramaId);
    const mass = massing.get(f.pandId)!;
    if (!view) continue;
    const point = RD_NEW.fromLngLat(view.lngLat);
    const image = await panorama(view);
    const ppm = Math.min(96, Math.max(40, 1250 / f.standoffM));
    const baseZ = mass.groundLevel! - STRIP_BASE_BELOW_GROUND_M;
    const rect = rectifyFacade(image, {
      x: point.x, y: point.y, z: view.cameraHeight - GEOID_SEPARATION_M,
      headingDeg: view.headingDeg, pitchDeg: view.pitchDeg, rollDeg: view.rollDeg,
    }, { start: { x: f.wall[0], y: f.wall[1] }, end: { x: f.wall[2], y: f.wall[3] }, baseZ, topZ: mass.eavesHeight! + 0.3 },
      { pixelsPerMetre: ppm, yaw: AMSTERDAM_YAW_CONVENTION });
    const got = patches(rect, rect.pixelsPerMetre, f.openings, STRIP_BASE_BELOW_GROUND_M);
    if (got.length >= 3) byBuilding.set(f.pandId, got);
  }
  // Four buildings minimum: fewer and the "material" is one house, which is how
  // a window stood in for purple-brown brick on the first run.
  if (byBuilding.size < 4) {
    console.log(`  ${materialId.padEnd(19)} only ${byBuilding.size} usable buildings — skipped`);
    continue;
  }
  const collected = [...byBuilding.values()].flat();
  const buildings = byBuilding.size;
  const tile = medianTile(collected);
  const family = MATERIALS[materialId].family;
  const isBrick = family === 'brick';
  if (isBrick) applyBond(tile); else flattenCourses(tile);
  const tileM = tileMetresFor(family);
  const file = `${materialId}.jpg`;
  await writeFile(path.join(OUT, file), jpeg.encode({ width: TILE_PX, height: TILE_PX, data: Buffer.from(tile) }, 92).data);
  const material = MATERIALS[materialId];
  manifest.push({
    materialId, file, buildings, patches: collected.length,
    colour: 'measured', bond: isBrick ? 'constructed at 210x50 mm' : 'none, courses flattened',
    tileMetres: tileM, tileM: [tileM, tileM], pixels: TILE_PX,
    fallbackColour: material.colour, name: material.name,
  });
  console.log(`  ${materialId.padEnd(19)} ${String(collected.length).padStart(4)} patches, ${String(buildings).padStart(3)} buildings`
    + `${isBrick ? ', bond laid in' : ', courses flattened'}, tiling at ${tileM.toFixed(2)} m → ${file}`);
}

await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/build-textures.ts',
    attribution: '© Gemeente Amsterdam, Kernregistratie Panoramabeelden (CC BY 4.0)',
    method: `One-metre wall patches cropped from rectified orthographic façades between the measured openings, `
      + `resampled to ${TILE_PX} px and medianed per material across buildings.`,
    // Per-material now; this is the brick module and the fallback for a reader
    // that does not look at the per-texture value.
    tileMetres: TILE_M, tilePixels: TILE_PX,
  },
  textures: manifest,
}, null, 2));
console.log(`\n${manifest.length} material textures → ${path.relative(process.cwd(), OUT)}`);
