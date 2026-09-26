import assert from 'node:assert/strict';
import { registeredFrontageWallSurface, type WallRingSurface } from './registeredFrontage.ts';

const wall = (bottom: number, top: number): WallRingSurface => ({
  type: 'wall',
  rings: [[[0, bottom, 0], [5, bottom, 0], [5, top, 0], [0, top, 0]]],
});

// 1. A registered frontage becomes a rectangle spanning its own line and the
//    building's wall extent, with the frontage direction preserved.
{
  const surface = registeredFrontageWallSurface([2, 3], [6, 5], [wall(0.85, 19.65)]);
  assert.ok(surface, 'frontage surface must build');
  assert.equal(surface.type, 'wall');
  assert.deepEqual(surface.rings, [
    [
      [2, 0.85, 3],
      [6, 0.85, 5],
      [6, 19.65, 5],
      [2, 19.65, 3],
    ],
  ]);
}

// 2. The height comes from every wall surface, not just the first, so a tall
//    gable or side wall still establishes the building extent.
{
  const surface = registeredFrontageWallSurface([0, 0], [4.8, 0], [wall(0.85, 6), wall(3, 19.65)]);
  assert.ok(surface);
  assert.equal(surface.rings[0][0][1], 0.85);
  assert.equal(surface.rings[0][2][1], 19.65);
}

// 3. Degenerate input abstains rather than inventing a facade.
{
  assert.equal(registeredFrontageWallSurface([0, 0], [1, 0], [wall(0, 10)]), null, 'short frontage must abstain');
  assert.equal(registeredFrontageWallSurface([0, 0], [5, 0], []), null, 'no walls must abstain');
  assert.equal(registeredFrontageWallSurface([0, 0], [5, 0], [wall(0, 2)]), null, 'low wall must abstain');
}

console.log('Registered frontage fallback builds a measured rectangle or abstains; no position or height is invented.');
