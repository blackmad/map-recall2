import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// The router and the road guard must agree: every edge the routing graph can
// plan across has to be rideable. A graph edge with a stretch outside every
// road corridor is a place where the bike follows its route onto the shoulder
// and hovers there, pulled back, throttle open (user report 2026-09-30, "my
// bike is entirely stuck on this bridge, can't move at all").
//
// Samples every edge every 4 px and asks the live road guard's contact whether
// the point is inside the corridor it picks (dist ≤ width).
//
// Graph edges that dip onto the soft shoulder (≤ CAR_ROAD_EDGE_TOLERANCE, 4 px)
// are rideable. Past it the guard rolls the bike back. Two long unnamed or
// side-street spans are known to cross it by < 1 px on some loads (the
// loaded network varies slightly between runs); anything else is a
// regression.
//
//   COVERAGE_OUT=path   write every uncovered edge as JSON

const ROLLBACK_LINE = 4;
const KNOWN_PAST_ROLLBACK: Array<[number, number]> = [];

test('every routing-graph edge lies on a rideable road surface', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'pure geometry; one project is enough');
  test.setTimeout(900_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north', playerTimeoutMs: 90_000 });
  const report = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const track = game.track;
    const loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const toLatLng = (x: number, y: number): [number, number] => [
      +(loader._lastCenterLat - (y - loader._lastOffsetY) / perLat).toFixed(6),
      +(loader._lastCenterLng + (x - loader._lastOffsetX) / perLng).toFixed(6),
    ];
    const { allNodes } = track._routingGraph();
    const seen = new Set<string>();
    const uncovered: any[] = [];
    const kinds: Record<string, number> = {};
    let edges = 0;
    for (const node of allNodes) {
      for (const edge of node.edges) {
        const pair = node.key < edge.node.key ? `${node.key}|${edge.node.key}` : `${edge.node.key}|${node.key}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        // IJ ferry crossings are sailed, not ridden: no road surface by design.
        if (edge.segmentMetadata.some((m: any) => m?.ferryId)) continue;
        edges++;
        const steps = Math.max(1, Math.ceil(edge.distance / 4));
        const heading = Math.atan2(edge.node.y - node.y, edge.node.x - node.x);
        let worst = 0, worstAt: [number, number] | null = null, worstXY: any = null;
        for (let i = 0; i <= steps; i++) {
          const x = node.x + (edge.node.x - node.x) * i / steps;
          const y = node.y + (edge.node.y - node.y) * i / steps;
          track.clearFrameCache();
          const g = track.getGuardRoad(x, y, heading);
          const excess = g ? g.dist - g.width : Infinity;
          if (excess > worst) { worst = excess; worstAt = toLatLng(x, y); worstXY = { x, y, heading }; }
        }
        if (worst > 0.5) {
          kinds[edge.kind] = (kinds[edge.kind] || 0) + 1;
          // What the guard saw at the worst point (diagnostics for a failure).
          const S = (window as any).CanalRecallRoadSurface;
          const contacts = worst > 4 && worstXY ? S.contactsAt(S.roadsNear(track.roadIndex, worstXY.x, worstXY.y, 2), worstXY.x, worstXY.y)
            .filter((c: any) => c.dist < c.width + 20)
            .map((c: any) => `${c.segIdx}/${c.ptIdx} ${track.segments[c.segIdx]?.name || '-'} d${c.dist.toFixed(1)} w${c.width} a${c.angle.toFixed(2)}`) : undefined;
          uncovered.push({ kind: edge.kind, excess: +worst.toFixed(1), at: worstAt, lengthPx: +edge.distance.toFixed(1),
            names: [...new Set(edge.segmentMetadata.map((m: any) => m?.name).filter(Boolean))],
            segments: edge.segmentIndexes, heading: worstXY && +worstXY.heading.toFixed(2), contacts: contacts && [...new Set(contacts)] });
        }
      }
    }
    uncovered.sort((a, b) => b.excess - a.excess);
    return { edges, uncovered: uncovered.length, kinds, worst: uncovered };
  });
  if (process.env.COVERAGE_OUT) writeFileSync(process.env.COVERAGE_OUT, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ edges: report.edges, uncovered: report.uncovered, kinds: report.kinds, top: report.worst.slice(0, 5) }));
  const near = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) < 2e-4 && Math.abs(a[1] - b[1]) < 3e-4;
  const pastRollback = report.worst.filter((edge: any) => edge.excess > ROLLBACK_LINE
    && !KNOWN_PAST_ROLLBACK.some(known => edge.at && near(edge.at, known)));
  expect(pastRollback).toEqual([]);
});
