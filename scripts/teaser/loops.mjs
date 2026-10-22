#!/usr/bin/env node
// Short silent landing-page loops from the raw captures (capture.mjs shots
// lride, lboat, phone). No 90s styling: clean gameplay, end crossfaded into
// the start so it loops without a jump. Writes H.264 MP4, VP9 WebM and a
// poster JPG per loop to public/canal-drive/media/loops/.
//
//   node scripts/teaser/loops.mjs
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const RAW = process.env.TEASER_RAW || 'artifacts/teaser/raw';
const OUT = 'public/canal-drive/media/loops';
mkdirSync(OUT, { recursive: true });

const mark = (clip, re) => {
  const m = JSON.parse(readFileSync(`${RAW}/${clip}.json`, 'utf8')).marks.find(m => re.test(m.label));
  if (!m) throw new Error(`no mark ${re} in ${clip}`);
  return m.t;
};

// 16:10 loops match the hero's .desk image (1200/750); the phone matches .phone (390/844).
const LOOPS = [
  { name: 'ride-question', clip: 'lride', start: mark('lride', /^question:/) - 1.3, dur: 7.0, w: 1280, h: 800, crf: 27, vp9: 40 },
  { name: 'boat-bridge', clip: 'lboat', start: mark('lboat', /^racing$/) + 4.6, dur: 6.0, w: 1280, h: 800, crf: 27, vp9: 40 },
  { name: 'intro-flight', clip: 'lride', start: mark('lride', /^intro$/) + 0.1, dur: 5.6, w: 1280, h: 800, crf: 27, vp9: 40 },
  { name: 'phone-ride', clip: 'phone', start: mark('phone', /^question:route/) - 1.6, dur: 6.5, w: 720, h: 1558, crf: 27, vp9: 40 },
];
const X = 0.6; // crossfade length

for (const l of LOOPS) {
  const graph = `[0:v]fps=30,scale=${l.w}:${l.h}:flags=lanczos,setsar=1,split[a][b];`
    + `[a]trim=${X}:${l.dur + X},setpts=PTS-STARTPTS[main];[b]trim=0:${X},setpts=PTS-STARTPTS[head];`
    + `[main][head]xfade=transition=fade:duration=${X}:offset=${l.dur - X},format=yuv420p[v]`;
  const input = ['-ss', l.start.toFixed(3), '-t', (l.dur + X + 0.2).toFixed(3), '-i', `${RAW}/${l.clip}.mp4`];
  const base = `${OUT}/${l.name}`;
  // Budget: ~1.3 MB per loop (the landing page asks for under 1.5 MB).
  const kbps = Math.floor(1300 * 8 / l.dur);
  const ff = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'ignore', 'inherit'] });
  ff([...input, '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.15)}k`, '-bufsize', `${kbps * 2}k`, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${base}.mp4`]);
  ff([...input, '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libvpx-vp9', '-crf', String(l.vp9), '-b:v', `${Math.round(kbps * 0.75)}k`, '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', `${base}.webm`]);
  ff(['-i', `${base}.mp4`, '-frames:v', '1', '-q:v', '3', `${base}.jpg`]);
  const kb = (f) => (statSync(f).size / 1024).toFixed(0);
  console.log(`${l.name}: ${l.w}x${l.h} ${l.dur}s  mp4 ${kb(`${base}.mp4`)} KB  webm ${kb(`${base}.webm`)} KB  jpg ${kb(`${base}.jpg`)} KB`);
}
