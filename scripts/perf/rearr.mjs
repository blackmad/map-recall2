// Landmark re-arrivals from a pop-colour.mjs run (lane landmark-residency, 2026-11-27; stands in for the pop-in lane's
// rearr.py, which was never committed): an id given back (residency:landmark-leave) and loaded again
// (residency:landmark-arrive) inside the measured window, first arrivals, the leave -> re-arrive gap, whether it was on
// screen when it came back, and the frame-diff px pop-colour charged to landmark arrivals.
//   node scripts/perf/rearr.mjs <pop-colour.json> [...more]
import fs from 'node:fs';

const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1) : null; };
for (const file of process.argv.slice(2)) {
  const { summary, events } = JSON.parse(fs.readFileSync(file, 'utf8'));
  const res = events.filter(e => e.changes.some(c => /^residency:landmark-(arrive|leave)$/.test(c)));
  const t0 = events.length ? events[0].t : 0, t1 = events.length ? events[events.length - 1].t : 0, mins = Math.max(1e-9, (t1 - t0) / 60);
  const leftAt = new Map(), seen = new Set(), gaps = [];
  let firsts = 0, re = 0, reOnScreen = 0, leaves = 0;
  for (const e of res) {
    const id = e.label;
    if (e.changes.includes('residency:landmark-leave')) { leftAt.set(id, e.t); leaves++; continue; }
    if (leftAt.has(id)) { re++; gaps.push(e.t - leftAt.get(id)); if (e.onScreen) reOnScreen++; leftAt.delete(id); } else if (!seen.has(id)) firsts++;
    seen.add(id);
  }
  const px = summary.diffPx?.byCause?.['residency:landmark-arrive'] ?? 0;
  console.log(JSON.stringify({ file: file.split('/').pop(), qs: summary.qs, route: summary.route, minutes: +mins.toFixed(2), firstArrivals: firsts, reArrivals: re, reArrivalsPerMin: +(re / mins).toFixed(1), leaves, gapP10P50P90: [q(gaps, 0.1), q(gaps, 0.5), q(gaps, 0.9)], reOnScreen, landmarkArrivePx: px, diffTotalPx: summary.diffPx?.total ?? null }));
}
