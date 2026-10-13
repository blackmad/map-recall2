import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// User report 2026-10-13: "boat needs to be able to do a stopped turn when up
// against a wall faster, it's annoying when it gets stuck". Nosed into a quay
// the boat has no way on, and the helm at rest was floored at 28% of the boat's
// turn rate: ~0.48 rad/s, ~6.5 s to swing half round. The quay guard rolls back
// position only, never heading, so the standstill steering floor is the whole
// story. BOAT_MIN_STEER_FACTOR=0.8 gives ~1.37 rad/s, a half-turn in ~2.3 s.
test('a stopped boat swings round promptly on held steering', async ({ page }) => {
  test.setTimeout(150_000);
  await openRoute(page, { travelMode: 'boat', viewMode: 'chase', seedRandom: false });
  const turned = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const player = game.player;
    // A fresh hull with the player's tuning, so the running game is untouched.
    const Car = (window as any).eval('Car'); // a script-scope class, not a window property
    const boat = new Car(player.x, player.y, player.angle);
    boat.isBoat = true;
    boat.turnRate = player.turnRate;
    const start = boat.angle;
    for (let frame = 0; frame < 60; frame++) {
      boat.throttle = 0; boat.brake = 0; boat.steerInput = 1;
      boat.speed = 0; boat.vx = 0; boat.vy = 0; // held against the quay
      boat.update(1 / 60, game.track);
    }
    return { isBoat: player.isBoat, turned: Math.abs(boat.angle - start) };
  });
  expect(turned.isBoat).toBe(true);
  // One second of full lock at rest: at least ~70° (the old floor gave ~27°).
  expect(turned.turned, JSON.stringify(turned)).toBeGreaterThan(1.2);
});
