#!/usr/bin/env node
// Per-frame motion check of a finished cut: in each window, the per-frame
// difference (mean abs luma change, 0-255, of the footage area), runs of
// frozen frames and isolated spikes (> 3x both neighbours' mean).
//
//   node scripts/teaser/verify.mjs <file.mp4> <from-to> [<from-to> …] [--crop w:h:x:y] [--print]
import { videoDiffs } from './clean.mjs';

const args = process.argv.slice(2);
const file = args[0];
const ci = args.indexOf('--crop');
const crop = ci > 0 ? args[ci + 1] : null;
const print = args.includes('--print');
const windows = args.slice(1).filter((a, i, all) => /^\d+(\.\d+)?-\d+(\.\d+)?$/.test(a) && all[i] !== crop);
for (const w of windows) {
  const [a, b] = w.split('-').map(Number);
  const d = videoDiffs(file, a, b - a, crop);
  let run = 0, longest = 0, longestAt = null, frozen = 0;
  const spikes = [];
  d.forEach((v, i) => {
    if (v < 0.05) { frozen++; run++; if (run > longest) { longest = run; longestAt = a + (i - run + 1) / 30; } } else run = 0;
    if (i > 0 && i < d.length - 1) {
      const nb = (d[i - 1] + d[i + 1]) / 2;
      if (v > 1 && v > 3 * Math.max(nb, 0.05)) spikes.push(`${(a + i / 30).toFixed(2)}s:${v.toFixed(1)}/${nb.toFixed(1)}`);
    }
  });
  console.log(`${file} ${w}s: ${d.length} frames, frozen ${frozen}, longest frozen run ${longest}${longestAt != null && longest ? ` @${longestAt.toFixed(2)}s` : ''}, spikes>3x ${spikes.length}${spikes.length ? ` [${spikes.join(' ')}]` : ''}`);
  if (print) console.log(d.map(v => v.toFixed(2)).join(' '));
}
