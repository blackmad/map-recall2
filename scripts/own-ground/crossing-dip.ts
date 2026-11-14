// Lane f1b-jagged 2026-11-14: how far a road's riding surface dips under the straight line between a crossing's bank
// tops (probe-crossing-dips.ts city-wide; bridge-feedback-pins.ts BANK_DIPS pins). The bank tops: from each bank on
// along the way while the relief climbs away from the water faster than BANK_CLIMB_GRADE (at most BANK_CLIMB_MAX_M),
// then 1 m on. Samples every metre of the way; water runs of 2-60 m.
import type { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { BANK_CLIMB_GRADE, BANK_CLIMB_MAX_M } from '../../src/canalRecall/ownGround/wayDecks.ts';
type Vec2 = [number, number];
export interface CrossingDip { at: Vec2; lenM: number; dip: number }
export function crossingDips(st: GroundStore, pts: readonly Vec2[], wet: (x: number, y: number) => boolean): CrossingDip[] {
  const line: Vec2[] = [];
  for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay))); for (let j = i ? 1 : 0; j <= n; j++) line.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]); }
  const wa = line.map(([x, y]) => wet(x, y)), out: CrossingDip[] = [];
  const g = (k: number) => st.surface.ground(line[k][0], line[k][1]), z = (k: number) => st.surface.height(line[k][0], line[k][1]);
  for (let i = 0; i < line.length; i++) {
    if (!wa[i]) continue;
    let j = i; while (j + 1 < line.length && wa[j + 1]) j++;
    const len = j - i + 1;
    let a = i - 1, b = j + 1;
    while (a - 1 >= 0 && i - a < BANK_CLIMB_MAX_M && g(a - 1) - g(a) > BANK_CLIMB_GRADE) a--;
    while (b + 1 < line.length && b - j < BANK_CLIMB_MAX_M && g(b + 1) - g(b) > BANK_CLIMB_GRADE) b++;
    a--; b++;
    if (len >= 2 && len <= 60 && a >= 0 && b < line.length) {
      const za = z(a), zb = z(b);
      let dip = 0, at = i;
      for (let k = a + 1; k < b; k++) { const d = za + (zb - za) * (k - a) / (b - a) - z(k); if (d > dip) { dip = d; at = k; } }
      out.push({ at: line[at], lenM: len, dip });
    }
    i = j;
  }
  return out;
}
