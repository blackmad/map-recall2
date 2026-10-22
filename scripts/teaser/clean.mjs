// Clean a stretch of raw capture into smooth 30 fps footage.
//
// The raw frames (JPEG + capture timestamps, from lib.mjs) are what the
// browser showed, so they carry the game's hitches and the capture's own
// unevenness: repeated frames (screenshot grabs of an unchanged screen),
// gaps (screencast frames only come when something changes, and slow frames
// arrive late), short freezes mid-motion and one-frame camera snaps. Here:
//   1. measure the difference of each frame to the one before;
//   2. drop repeated frames; close up short freezes (gaps of more than ~3
//      frames that are shorter than HOLD_KEEP; longer holds are real beats,
//      such as a question waiting, and stay); optionally trim a still lead-in;
//   3. motion-interpolate the even, retimed frames to 30 fps;
//   4. cover single-frame snaps (a difference spike > 3x its neighbours) with
//      a short dissolve.
// Times in the source (event marks) map to times in the output via `map`.
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const FPS = 30;
const DUP = 0.3;         // mean abs luma difference (0-255, per 1/60 s) below which a frame is a repeat or a freeze
const HOLD_KEEP = 0.6;   // gaps at least this long are deliberate beats, not hitches...
const HOLD_CUT = 3;      // ...unless the motion stops dead mid-move and then moves on: up to this long is a hitch
const SNAP_RATIO = 3;    // spike vs neighbourhood median
const SNAP_MIN = 1.2;    // and at least this big
const DISSOLVE = 5 / FPS;
const SLOW = 1.0;        // per-frame difference under which motion is a lull

const ff = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'pipe', 'inherit'] });

/** Frame list of a capture: [{ file, t }] with t from the first frame. */
export function framesOf(raw, clip) {
  const list = readFileSync(join(raw, `${clip}-frames`, 'list.txt'), 'utf8').split('\n');
  const out = []; let t = 0, file = null;
  for (const line of list) {
    const f = /^file '(.*)'$/.exec(line), d = /^duration (.*)$/.exec(line);
    if (f) file = f[1];
    if (d && file) { out.push({ file, t }); t += Number(d[1]); file = null; }
  }
  return out;
}

/** Mean absolute luma difference of each frame to the previous one (d[0] = 0). */
export function diffsOf(frames, work, tag, crop = null) {
  const list = join(work, `${tag}-diff-list.txt`);
  writeFileSync(list, frames.map(f => `file '${f.file}'\nduration 0.05`).join('\n'));
  const out = join(work, `${tag}-diff.txt`);
  // Stamp frames by index: the concat demuxer's JPEG timebase (1/25 s) would merge or split them.
  const vf = `settb=AVTB,setpts=N/(20*TB),${crop ? `crop=${crop},` : ''}scale=320:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${out}`;
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-fps_mode', 'passthrough', '-f', 'null', '-']);
  const vals = readFileSync(out, 'utf8').split('\n').filter(l => l.includes('YAVG')).map(l => Number(l.split('=')[1]));
  if (Math.abs(vals.length + 1 - frames.length) > 1) throw new Error(`diffs: ${vals.length + 1} values for ${frames.length} frames`);
  return [0, ...vals].slice(0, frames.length);
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/**
 * Clean [start, start + dur) of a capture (source seconds) into `out`, exactly
 * `dur` seconds of 30 fps footage scaled to w x h. Returns { map, report }.
 */
export function cleanSegment({ raw, work, clip, start, dur, out, w, h, trimStill = false, maxHold = Infinity, dup = DUP }) {
  mkdirSync(work, { recursive: true });
  const tag = out.replace(/[^a-z0-9]+/gi, '_').slice(-60);
  const all = framesOf(raw, clip);
  // Take generously: closing freezes and dissolves shorten the stretch.
  // (UI shots with their waits cut short need more.)
  let sel = all.filter(f => f.t >= start - 0.05 && f.t <= start + dur * (maxHold < Infinity ? 3 : 1.25) + 1.2);
  if (sel.length < 4) throw new Error(`${clip}: too few frames at ${start}`);
  const d = diffsOf(sel, work, tag);
  // 1-2: drop repeats, optionally a still lead-in
  const m0 = Math.max(1 / 60, Math.min(1 / 15, median(sel.slice(1).map((f, i) => f.t - sel[i].t))));
  let keep = sel.map((f, i) => ({ ...f, d: d[i] })).filter((f, i) => i === 0 || f.d >= dup * m0 * 60);
  if (trimStill) {
    // Start where motion begins and keeps going (a flicker before a hold is not a start).
    const run = (i) => keep.slice(i, i + 6);
    const moving = (i) => run(i).length === 6 && run(i).every((f, k) => f.d >= 0.6 * m0 * 60 && (k === 0 || f.t - run(i)[k - 1].t < HOLD_KEEP));
    const firstMove = keep.findIndex((f, i) => i > 0 && moving(i));
    if (firstMove > 0) keep = keep.slice(firstMove);
  }
  const gaps = keep.slice(1).map((f, i) => f.t - keep[i].t);
  const m = Math.max(1 / 60, Math.min(1 / 15, median(gaps)));
  // Motion that sags to a crawl between moving stretches (the ride eases off
  // while a question waits) plays at 3x: keep every third frame of the lull.
  let sped = 0; const slow = SLOW * m * 60; // diffs grow with the frame interval
  {
    const out = [];
    for (let i = 0; i < keep.length;) {
      let j = i;
      while (j < keep.length && keep[j].d < slow) j++;
      const len = j - i;
      const win = Math.round(1 / m), peak = (a, b) => Math.max(0, ...keep.slice(Math.max(0, a), b).map(f => f.d));
      const bounded = i > 0 && j < keep.length && peak(i - win, i) >= 2 * slow && peak(j, j + win) >= 2 * slow;
      if (len && bounded && len * m >= 0.25 && len * m <= 2.5) {
        for (let k = i; k < j; k++) if ((k - i) % 3 === 0) out.push(keep[k]); else sped++;
        i = j;
      } else { out.push(keep[i]); i++; }
    }
    keep = out;
  }
  // Even rate: every kept frame lasts one interval. Gaps are arrival jitter,
  // dropped frames or freezes and close up; only holds of HOLD_KEEP or more
  // (a static screen on purpose) keep their length.
  // A freeze between moving stretches (the flight stopping dead before the
  // ride takes over, the bike parked under a question) is cut up to HOLD_CUT.
  const isHold = (i) => {
    const raw = keep[i + 1] ? keep[i + 1].t - keep[i].t : 0;
    if (raw < HOLD_KEEP) return false;
    const before = Math.max(0, ...keep.slice(Math.max(0, i - Math.round(1 / m)), i + 1).map(f => f.d));
    return !(raw < HOLD_CUT && before >= 2 * slow && keep[i + 1].d >= slow);
  };
  const reps = keep.map((f, i) => {
    const next = keep[i + 1];
    // A still screen at the end (an arrival card) lasts to the end of the window.
    if (i === 0 && trimStill) return 1; // no still lead-in
    const cap = Math.ceil(Math.min(dur, maxHold) / m) + 1;
    if (!next) return Math.max(1, Math.min(Math.round((sel[sel.length - 1].t - f.t) / m), cap));
    const raw = next.t - f.t;
    return isHold(i) ? Math.max(1, Math.min(Math.round(raw / m), cap)) : 1;
  });
  let T = 0, closed = 0; const timeline = [];
  keep.forEach((f, i) => {
    timeline.push({ src: f.t, out: T });
    const raw = keep[i + 1] ? keep[i + 1].t - f.t : m;
    if (raw > 3 * m && !isHold(i)) closed += raw - m;
    T += reps[i] * m;
  });
  const rate = 1 / m;
  // 4: snaps (on kept frames), not in the first/last few frames
  const snaps = [];
  for (let i = 4; i < keep.length; i++) {
    const around = [...keep.slice(i - 4, i), ...keep.slice(i + 1, i + 5)].map(f => f.d);
    const med = median(around);
    if (keep[i].d > SNAP_MIN && keep[i].d > SNAP_RATIO * Math.max(med, 0.3)) snaps.push(timeline[i].out);
  }
  // 3: list the frames (holds repeated) and stamp them at the even rate; the
  // concat demuxer's own JPEG timestamps are too coarse (1/25 s) to trust.
  const list = join(work, `${tag}-clean-list.txt`);
  const lines = [];
  keep.forEach((f, i) => { for (let r = 0; r < reps[i]; r++) lines.push(`file '${f.file}'`, 'duration 0.04'); });
  writeFileSync(list, lines.join('\n'));
  // Dissolves over snaps, each shortening the stretch by DISSOLVE.
  const usable = snaps.filter((s, i) => s > DISSOLVE * 2 && s < dur + DISSOLVE * snaps.length - DISSOLVE && (i === 0 || s - snaps[i - 1] > DISSOLVE * 3));
  // A clean ~60 fps (or ~30 fps) run only needs resampling; anything else is
  // motion-interpolated.
  const at60 = Math.abs(rate - 2 * FPS) < 3, at30 = Math.abs(rate - FPS) < 1.5, clean = at60 || at30;
  const to30 = at60 ? `select=not(mod(n\\,2)),setpts=N/(${FPS}*TB)` : at30 ? `setpts=N/(${FPS}*TB)` : `minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none`;
  let graph = `[0:v]settb=AVTB,setpts=N/(${rate.toFixed(4)}*TB),scale=${w}:${h}:flags=lanczos,setsar=1,${to30},tpad=stop_mode=clone:stop_duration=${dur.toFixed(2)},format=yuv420p`;
  if (!usable.length) graph += '[v]';
  else {
    graph += `,split=${usable.length + 1}${usable.map((_, i) => `[p${i}]`).join('')}[p${usable.length}];`;
    let prev = null, shift = 0, edges = [0, ...usable];
    for (let i = 0; i <= usable.length; i++) {
      const a = edges[i], b = i < usable.length ? usable[i] : null;
      graph += `[p${i}]trim=start=${a.toFixed(4)}${b != null ? `:end=${b.toFixed(4)}` : ''},setpts=PTS-STARTPTS[s${i}];`;
    }
    let acc = `s0`, len = usable[0];
    for (let i = 1; i <= usable.length; i++) {
      const segLen = i < usable.length ? usable[i] - usable[i - 1] : null;
      const label = i === usable.length ? 'v' : `x${i}`;
      graph += `[${acc}][s${i}]xfade=transition=dissolve:duration=${DISSOLVE.toFixed(4)}:offset=${(len - DISSOLVE).toFixed(4)}[${label}]${i === usable.length ? '' : ';'}`;
      acc = label; len = len - DISSOLVE + (segLen ?? 0);
    }
  }
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-filter_complex', graph, '-map', '[v]', '-t', dur.toFixed(3), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', out]);
  // source time -> output time
  const map = (t) => {
    let o;
    if (t <= timeline[0].src) o = 0;
    else {
      o = timeline[timeline.length - 1].out;
      for (let i = 1; i < timeline.length; i++) if (t <= timeline[i].src) {
        const a = timeline[i - 1], b = timeline[i];
        o = a.out + (b.out - a.out) * (t - a.src) / ((b.src - a.src) || 1); break;
      }
    }
    return o - usable.filter(s => s < o).length * DISSOLVE;
  };
  const report = { clip, start, rate: +rate.toFixed(1), interpolated: !clean, dropped: sel.length - keep.length, closedSeconds: +closed.toFixed(2), spedFrames: sped, snaps: usable.map(s => +s.toFixed(2)) };
  return { map, report };
}

/** Per-frame difference of a finished video in a window (for verification). */
export function videoDiffs(file, from, len, crop) {
  const outTxt = `/tmp/teaser-vdiff-${process.pid}.txt`;
  ff(['-ss', String(from), '-t', String(len), '-i', file, '-vf', `${crop ? `crop=${crop},` : ''}scale=320:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=${outTxt}`, '-f', 'null', '-']);
  return readFileSync(outTxt, 'utf8').split('\n').filter(l => l.includes('YAVG')).map(l => Number(l.split('=')[1]));
}
