import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user reports 2026-09-28, "crazy multiple blue lines when
// a street is highlighted", Prins Hendrikkade by the IJ). The name is 262
// connected OSM ways: two one-way carriageways, named cycle tracks and service
// roads side by side. The highlight now draws one corridor
// (`collapseParallelFragments`); this measures how much highlighted length
// still has another highlighted line running alongside it within 20 m.
test('a highlighted street is one line, not its carriageways and cycle tracks', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'data check; one project is enough');
  test.setTimeout(120000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north' });
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame, track = game.track, streets = (window as any).CanalRecallStreets;
    const seedIndex = track.segments.findIndex((segment: any) => segment.name === 'Prins Hendrikkade');
    const connected = track.getConnectedNamedSegments(seedIndex);
    const doubled = (paths: Array<Array<{ x: number; y: number }>>) => {
      // Sample every path every ~3 m; a sample is doubled when another path
      // has a point within 20 m (60 units) heading the same way.
      const samples: Array<{ path: number; x: number; y: number; dx: number; dy: number }> = [];
      paths.forEach((points, path) => {
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i];
          const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 9));
          for (let s = 0; s < steps; s++) samples.push({ path, x: a.x + (b.x - a.x) * s / steps, y: a.y + (b.y - a.y) * s / steps, dx: b.x - a.x, dy: b.y - a.y });
        }
      });
      const grid = new Map<string, typeof samples>();
      for (const sample of samples) {
        const key = `${Math.floor(sample.x / 60)},${Math.floor(sample.y / 60)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(sample);
      }
      let hits = 0;
      for (const sample of samples) {
        const gx = Math.floor(sample.x / 60), gy = Math.floor(sample.y / 60);
        let found = false;
        for (let x = gx - 1; x <= gx + 1 && !found; x++) for (let y = gy - 1; y <= gy + 1 && !found; y++) {
          for (const other of grid.get(`${x},${y}`) ?? []) {
            if (other.path === sample.path || Math.hypot(other.x - sample.x, other.y - sample.y) > 60) continue;
            const cos = (other.dx * sample.dx + other.dy * sample.dy) / (Math.hypot(other.dx, other.dy) * Math.hypot(sample.dx, sample.dy) || 1);
            if (Math.abs(cos) > 0.9 && Math.hypot(other.x - sample.x, other.y - sample.y) > 3) { found = true; break; }
          }
        }
        if (found) hits++;
      }
      return samples.length ? hits / samples.length : 0;
    };
    const before = streets.stitchOverlayPaths(connected.map((segment: any) => segment.points));
    const after = streets.stitchOverlayPaths(streets.collapseParallelFragments(connected, track.segments[seedIndex]));
    return { fragments: connected.length, before: doubled(before), after: doubled(after) };
  });
  expect(result.fragments, 'the name is still many ways').toBeGreaterThan(100);
  expect(result.before, JSON.stringify(result)).toBeGreaterThan(0.3);
  expect(result.after, JSON.stringify(result)).toBeLessThan(0.12);
});
