import assert from 'node:assert/strict';
import {
  cropFrame,
  cropPixelToWallMetre,
  planTiles,
  r1NativePixelsPerMetre,
  r1PixelsPerMetre,
  nativeCeilingPixelsPerMetre,
  tilePixelToWallMetre,
  wallMetreToCropPixel,
  wallMetreToTilePixel,
  DEFAULT_TILE_OVERLAP,
  DEFAULT_TILE_SIZE_PX,
  FULL_TIER_PIXELS_PER_METRE,
  R1_MAX_PIXELS_PER_METRE,
  type FacadeWallEvidence,
} from './evalCrop.ts';
import type { FacadePlane } from './rectify.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

const plane = (widthM: number, heightM: number): FacadePlane => ({
  start: { x: 0, y: 0 },
  end: { x: widthM, y: 0 },
  baseZ: 0.5,
  topZ: 0.5 + heightM,
});

// 1. A box round-trips tile pixels → wall metres → tile pixels within 1 px, and
//    the metric box width matches pixels / pixelsPerMetre.
{
  const frame = cropFrame(plane(12, 10), { width: 540, height: 450 });
  check(frame.pixelsPerMetre === FULL_TIER_PIXELS_PER_METRE, `frame is 45 px/m, got ${frame.pixelsPerMetre}`);

  const grid = planTiles({ width: frame.width, height: frame.height }, { tileSize: 200, overlap: 0.15 });
  const tile = grid.tiles[4];
  const box = { x0: 10.25, y0: 20.5, x1: 150.75, y1: 180.25 };

  const metres = {
    x0: tilePixelToWallMetre(frame, tile, box.x0, box.y0),
    x1: tilePixelToWallMetre(frame, tile, box.x1, box.y1),
  };
  const back = {
    x0: wallMetreToTilePixel(frame, tile, metres.x0),
    x1: wallMetreToTilePixel(frame, tile, metres.x1),
  };

  check(Math.abs(back.x0.x - box.x0) < 1, `round-trip x0 x, got ${back.x0.x}`);
  check(Math.abs(back.x0.y - box.y0) < 1, `round-trip x0 y, got ${back.x0.y}`);
  check(Math.abs(back.x1.x - box.x1) < 1, `round-trip x1 x, got ${back.x1.x}`);
  check(Math.abs(back.x1.y - box.y1) < 1, `round-trip x1 y, got ${back.x1.y}`);

  const alongM = metres.x1.along - metres.x0.along;
  check(Math.abs(alongM - (box.x1 - box.x0) / FULL_TIER_PIXELS_PER_METRE) < 1e-9, 'metric box width');
  check(metres.x0.up > metres.x1.up, 'screen y grows downward, wall up grows upward');

  // Inverse at frame level too: wall metres → crop pixels → wall metres.
  const cropRoundTrip = wallMetreToCropPixel(frame, metres.x0);
  const recovered = cropPixelToWallMetre(frame, cropRoundTrip.x, cropRoundTrip.y);
  check(Math.abs(recovered.along - metres.x0.along) < 1e-9 && Math.abs(recovered.up - metres.x0.up) < 1e-9, 'frame round-trip');
}

// 2. When the native ceiling cannot support the cached 45 px/m, R1 resolves to
//    R0 rather than downsampling; otherwise it follows min(150, 0.9 × native).
{
  const below: Pick<FacadeWallEvidence, 'standoff' | 'obliquity'> = { standoff: 40, obliquity: 0 };
  const belowNative = nativeCeilingPixelsPerMetre(below);
  check(belowNative < FULL_TIER_PIXELS_PER_METRE, `native ${belowNative} must sit below R0`);
  check(r1PixelsPerMetre(below) === FULL_TIER_PIXELS_PER_METRE, 'R1 falls back to R0 below the native ceiling');
  check(
    r1NativePixelsPerMetre(below) === Math.min(R1_MAX_PIXELS_PER_METRE, 0.9 * belowNative),
    'raw R1 formula is min(150, 0.9 × native)',
  );

  const straightOn: Pick<FacadeWallEvidence, 'standoff' | 'obliquity'> = { standoff: 5, obliquity: 0 };
  check(nativeCeilingPixelsPerMetre(straightOn) > 250, 'native ceiling is high at 5 m straight on');
  check(r1PixelsPerMetre(straightOn) === R1_MAX_PIXELS_PER_METRE, 'R1 caps at 150 px/m');

  // The first apollobuurt record: 12.24 m standoff at 45.03°.
  const measured: Pick<FacadeWallEvidence, 'standoff' | 'obliquity'> = {
    standoff: 12.238279589586268,
    obliquity: 45.02868352753619,
  };
  const expected = Math.max(
    FULL_TIER_PIXELS_PER_METRE,
    Math.min(R1_MAX_PIXELS_PER_METRE, 0.9 * nativeCeilingPixelsPerMetre(measured)),
  );
  check(r1PixelsPerMetre(measured) === expected, `R1 uses the native formula mid-range, got ${r1PixelsPerMetre(measured)}`);
  check(r1PixelsPerMetre(measured) > FULL_TIER_PIXELS_PER_METRE, 'R1 beats R0 at the measured standoff');
}

// 3. Tiling covers the whole crop with at least the declared overlap, clips the
//    final tile to the edge, and is deterministic.
{
  const width = 1600, height = 1000;
  const grid = planTiles({ width, height });
  check(grid.tileSize === DEFAULT_TILE_SIZE_PX && grid.overlap === DEFAULT_TILE_OVERLAP, 'defaults applied');
  check(grid.stride === Math.floor(DEFAULT_TILE_SIZE_PX * (1 - DEFAULT_TILE_OVERLAP)), `stride ${grid.stride}`);
  check(grid.columns === 3 && grid.rows === 2 && grid.tiles.length === 6, 'grid shape');

  const again = planTiles({ width, height });
  assert.deepEqual(again, grid, 'tiling is deterministic');

  const minOverlapPx = DEFAULT_TILE_SIZE_PX * DEFAULT_TILE_OVERLAP;
  grid.tiles.forEach((tile, i) => {
    check(tile.index === i, `tile ${i} index`);
    check(tile.index === tile.row * tile.columns + tile.column, `tile ${i} row-major index`);
  });

  for (let row = 0; row < grid.rows; row++) {
    const strip = grid.tiles.filter((tile) => tile.row === row);
    check(strip[0].x === 0, `row ${row} starts at 0`);
    check(strip[strip.length - 1].x + strip[strip.length - 1].width === width, `row ${row} reaches ${width}`);
    for (let i = 1; i < strip.length; i++) {
      const gap = strip[i - 1].x + strip[i - 1].width - strip[i].x;
      check(gap >= minOverlapPx - 1e-9, `row ${row} overlap ${gap} ≥ ${minOverlapPx}`);
    }
  }
  for (let column = 0; column < grid.columns; column++) {
    const strip = grid.tiles.filter((tile) => tile.column === column);
    check(strip[0].y === 0, `column ${column} starts at 0`);
    check(strip[strip.length - 1].y + strip[strip.length - 1].height === height, `column ${column} reaches ${height}`);
    for (let i = 1; i < strip.length; i++) {
      const gap = strip[i - 1].y + strip[i - 1].height - strip[i].y;
      check(gap >= minOverlapPx - 1e-9, `column ${column} overlap ${gap} ≥ ${minOverlapPx}`);
    }
  }

  const covers = (length: number, extent: 'width' | 'height') => {
    for (let p = 0; p < length; p++) {
      const inside = grid.tiles.some((tile) => {
        const origin = extent === 'width' ? tile.x : tile.y;
        const span = extent === 'width' ? tile.width : tile.height;
        return p >= origin && p < origin + span;
      });
      if (!inside) return p;
    }
    return -1;
  };
  check(covers(width, 'width') === -1, 'every column is covered by some tile');
  check(covers(height, 'height') === -1, 'every row is covered by some tile');

  const clipped = grid.tiles[grid.tiles.length - 1];
  check(clipped.x === 1304 && clipped.width === 296 && clipped.height === 348, 'final tile clips to the edge');

  const single = planTiles({ width: 300, height: 200 });
  check(single.tiles.length === 1 && single.tiles[0].width === 300 && single.tiles[0].height === 200, 'crop smaller than a tile yields one clipped tile');
}

// 4. A zero-width or zero-height wall is rejected rather than tiled.
{
  assert.throws(() => cropFrame(plane(0, 10), { width: 1, height: 1 }), RangeError);
  assert.throws(() => cropFrame(plane(10, 0), { width: 1, height: 1 }), RangeError);
  assert.throws(() => planTiles({ width: 100, height: 100 }, { overlap: 1 }), RangeError);
}

process.stdout.write(`facade evalCrop checks passed (${checks} assertions).\n`);
