#!/usr/bin/env node
// Cut the teaser from the raw captures (scripts/teaser/capture.mjs).
//
//   node scripts/teaser/edit.mjs [h|v …] [--no-music|--music-only] [--no-boot|--boot-only] [--no-crt|--crt-only]
//
// h = 1920x1080 (teaser-1080p*.mp4), v = 1080x1920 (teaser-vertical*.mp4).
// By default every cut is exported eight ways: with and without the opening
// CD-ROM boot screen (-noboot opens on the logo) x with the synthesised
// soundtrack and with a silent track (-nomusic) x with and without the CRT
// treatment (-nocrt: no scanlines, chroma split or vignette). The flags pick
// a subset. The picture is encoded once per boot/CRT pair and the two audio
// tracks are muxed onto it. Footage is cleaned first (clean.mjs): repeated
// and frozen frames dropped, re-timed, interpolated to 30 fps, one-frame
// camera snaps dissolved. Title cards come from cards.html rendered by Playwright; footage
// segments are picked by the event marks the capture wrote, so a re-capture
// re-cuts itself. Output: artifacts/teaser/out/ (TEASER_OUT); the videos are
// published as release assets, not committed.
import { mkdirSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as T from './lib.mjs';
import { renderMusic } from './music.mjs';
import { cleanSegment } from './clean.mjs';

const RAW = process.env.TEASER_RAW || 'artifacts/teaser/raw';
const WORK = process.env.TEASER_WORK || 'artifacts/teaser/work';
const OUT = process.env.TEASER_OUT || 'artifacts/teaser/out';
const FPS = 30;
const args = process.argv.slice(2);
const layouts = args.filter(a => a === 'h' || a === 'v');
const withMusic = !args.includes('--no-music');
const withoutMusic = !args.includes('--music-only');
const withBoot = !args.includes('--no-boot');
const withoutBoot = !args.includes('--boot-only');
const withCrt = !args.includes('--no-crt');
const withoutCrt = !args.includes('--crt-only');
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

const LAYOUT = {
  h: { W: 1920, H: 1080, win: { x: 188, y: 14, w: 1544, h: 926 }, footage: { x: 192, y: 72, w: 1536, h: 864 }, cap: { x: 188, y: 948, w: 1544, h: 124 }, phone: { x: 761, y: 44, w: 398, h: 862 } },
  v: { W: 1080, H: 1920, win: { x: 40, y: 262, w: 1000, h: 1642 }, footage: { x: 44, y: 320, w: 992, h: 1580 }, cap: { x: 24, y: 30, w: 1032, h: 210 } },
};

// The shot list. `at` finds the clip start from a capture mark.
const PLAN = {
  h: [
    { card: 'boot', dur: 3.4, tr: ['fadewhite', 0.3] },
    { card: 'logo', dur: 4.0, tr: ['star', 0.7] },
    { clip: 'ride', at: [/^intro$/, 0.2], trimStill: true, dur: 5.0, title: 'RIDE AMSTERDAM — Start of the ride', word: 'EXPLORE!', sub: 'A whole city to ride, <b>built from open data</b>', tr: ['circleopen', 0.5] },
    // LEARN!: the question must match what the bike is doing on screen
    // (here: "Which street?" as it turns into the Utrechtsestraat).
    { clip: 'learn', at: [/^question:route:Utrechtsestraat/, -2.0], dur: 6.2, title: 'RIDE AMSTERDAM — By bike', word: 'LEARN!', sub: 'Every canal and street you pass <b>is a question</b>', ding: /^answered:/, tr: ['pixelize', 0.5] },
    { clip: 'ride', at: [/^question:route/, -0.9], dur: 4.6, title: 'RIDE AMSTERDAM — By bike', word: 'REMEMBER!', sub: 'Get it right and the name is <b>painted on the street</b>', ding: /^answered:/, tr: ['wipeleft', 0.5] },
    { clip: 'boat', at: [/^racing$/, 4.6], dur: 5.0, title: 'RIDE AMSTERDAM — Amstel by boat', word: 'SAIL!', sub: 'Swap the bike for a boat and <b>cruise the Amstel</b>', tr: ['circleclose', 0.5] },
    { clip: 'herengracht', at: [/^arrived$/, -1.8], dur: 4.8, title: 'RIDE AMSTERDAM — Herengracht', word: 'DISCOVER!', sub: 'Every stop has <b>a story to tell</b>', tr: ['star', 0.7] },
    { clip: 'quiz', at: [/^quiz-question:/, -0.8], maxHold: 0.6, dur: 4.6, title: 'MAP QUEST — Canals &amp; Water', word: 'QUIZ!', sub: '<b>Map Quest</b> drills every canal on the map', ding: /^quiz-answered:/, tr: ['pixelize', 0.5] },
    { clip: 'explore', at: [/^opened$/, -1.6], maxHold: 0.3, dup: 0.02, dur: 4.2, title: 'THE MODELLED CITY — Explorer', word: 'LOOK!', sub: 'Spin the city’s buildings <b>in 3D</b>', tr: ['wipeup', 0.5] },
    { clip: 'phone', device: 'phone', at: [/^question:route/, -1.0], dur: 4.6, word: 'POCKET IT!', sub: 'Plays on <b>your phone</b>, too', ding: /^answered:/, tr: ['circleopen', 0.5] },
    { clip: 'ride', at: [/^arrived$/, 0.4], dur: 3.6, title: 'RIDE AMSTERDAM — Arrived!', word: 'WIN!', sub: 'Earn ribbons, <b>collect neighbourhoods</b>', tr: ['fadewhite', 0.5] },
    { card: 'end', dur: 4.4 },
  ],
  v: [
    { card: 'boot', dur: 3.4, tr: ['fadewhite', 0.3] },
    { card: 'logo', dur: 4.0, tr: ['star', 0.7] },
    { clip: 'vride', at: [/^intro$/, 0.1], trimStill: true, dur: 5.0, title: 'RIDE AMSTERDAM', word: 'EXPLORE!', sub: 'A whole city to ride, <b>built from open data</b>', tr: ['circleopen', 0.5] },
    { clip: 'vlearn', at: [/^question:route:Utrechtsestraat/, -2.0], dur: 6.0, title: 'RIDE AMSTERDAM', word: 'LEARN!', sub: 'Every canal and street you pass <b>is a question</b>', ding: /^answered:/, tr: ['pixelize', 0.5] },
    { clip: 'vride', at: [/^question:route/, -0.9], dur: 4.8, title: 'RIDE AMSTERDAM', word: 'REMEMBER!', sub: 'Get it right and the name is <b>painted on the street</b>', ding: /^answered:/, tr: ['wipeleft', 0.5] },
    { clip: 'vboat', at: [/^racing$/, 3.5], dur: 5.4, title: 'RIDE AMSTERDAM', word: 'SAIL!', sub: 'Swap the bike for a boat and <b>cruise the Amstel</b>', tr: ['star', 0.7] },
    { clip: 'vquiz', at: [/^quiz-question:/, -1.6], maxHold: 0.6, dur: 5.0, title: 'MAP QUEST', word: 'QUIZ!', sub: '<b>Map Quest</b> drills every canal on the map', ding: /^quiz-answered:/, tr: ['pixelize', 0.5] },
    { clip: 'vexplore', at: [/^opened$/, -1.4], maxHold: 0.3, dup: 0.02, dur: 4.4, title: 'THE MODELLED CITY', word: 'LOOK!', sub: 'Spin the city’s buildings <b>in 3D</b>', tr: ['wipeup', 0.5] },
    { clip: 'vride', at: [/^arrived$/, 0.4], dur: 4.0, title: 'RIDE AMSTERDAM', word: 'WIN!', sub: 'Earn ribbons, <b>collect neighbourhoods</b>', tr: ['fadewhite', 0.5] },
    { card: 'end', dur: 4.6 },
  ],
};

// A five-point star wipe, as an xfade expression (P runs 1 -> 0).
const STAR = "if(lt(hypot(X-W/2,Y-H/2),(1-P)*1.25*max(W,H)*(0.42+0.58*abs(2*mod((atan2(Y-H/2,X-W/2)+PI/2+(1-P)*1.2)*5/(2*PI)+100,1)-1))),B,A)";

const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'ignore', 'inherit'] });
const ff = (a) => run('ffmpeg', ['-y', '-loglevel', 'error', ...a]);

function marksOf(clip) {
  const j = JSON.parse(readFileSync(`${RAW}/${clip}.json`, 'utf8'));
  return j;
}
function findMark(clip, re, after = 0) {
  const m = marksOf(clip).marks.find(m => re.test(m.label) && m.t >= after);
  if (!m) throw new Error(`no mark ${re} in ${clip}`);
  return m.t;
}

async function renderCards(lay) {
  const L = LAYOUT[lay], plan = PLAN[lay];
  const browser = await T.launch();
  const page = await browser.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve('scripts/teaser/cards.html')).href);
  const shoot = async (cfg, file, transparent = false) => {
    await page.evaluate(c => window.setup(c), { W: L.W, H: L.H, layout: lay, ...L, ...cfg });
    await page.evaluate(() => window.renderAt(0));
    await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: L.W, height: L.H } });
  };
  for (const [i, s] of plan.entries()) {
    const dir = `${WORK}/${lay}-${i}`;
    mkdirSync(dir, { recursive: true });
    if (s.card) {
      await page.evaluate(c => window.setup(c), { W: L.W, H: L.H, layout: lay, ...L, card: s.card, dur: s.dur });
      const n = Math.round(s.dur * FPS);
      for (let f = 0; f < n; f++) {
        await page.evaluate(t => window.renderAt(t), f / FPS);
        await page.screenshot({ path: `${dir}/c${String(f).padStart(4, '0')}.png` });
      }
    } else {
      const footage = s.device === 'phone' ? L.phone : L.footage;
      await shoot({ card: 'frame', title: s.title, device: s.device, footage }, `${dir}/bg.png`);
      await shoot({ card: 'caption', word: s.word, sub: s.sub }, `${dir}/cap.png`, true);
    }
  }
  await browser.close();
}

const cleanReports = [];
function buildSegments(lay) {
  const L = LAYOUT[lay], plan = PLAN[lay];
  const segs = [];
  for (const [i, s] of plan.entries()) {
    const dir = `${WORK}/${lay}-${i}`, out = `${dir}/seg.mp4`;
    const enc = ['-r', String(FPS), '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', '-an'];
    if (s.card) {
      ff(['-framerate', String(FPS), '-i', `${dir}/c%04d.png`, '-t', String(s.dur), ...enc, out]);
      segs.push({ ...s, file: out });
      continue;
    }
    const start = Math.max(0, findMark(s.clip, s.at[0]) + s.at[1]);
    const f = s.device === 'phone' ? L.phone : L.footage;
    const foot = `${dir}/foot.mp4`;
    const { map, report } = cleanSegment({ raw: RAW, work: `${WORK}/clean`, clip: s.clip, start, dur: s.dur, out: foot, w: f.w, h: f.h, trimStill: s.trimStill, maxHold: s.maxHold, dup: s.dup });
    console.log(`   ${s.word}: ${JSON.stringify(report)}`);
    cleanReports.push({ lay, word: s.word, ...report });
    // The caption PNG is full-frame; it slides in from the nearest edge.
    const slide = `${lay === 'v' ? -280 : 220}*pow(1-min(1\\,max(0\\,(t-0.3)/0.35))\\,2)`;
    const fc2 = `[1:v]setsar=1[f];[0:v][f]overlay=${f.x}:${f.y}[a];[a][2:v]overlay=x=0:y='${slide}':eval=frame[o]`;
    ff(['-loop', '1', '-framerate', String(FPS), '-i', `${dir}/bg.png`, '-i', foot, '-loop', '1', '-framerate', String(FPS), '-i', `${dir}/cap.png`,
      '-filter_complex', fc2, '-map', '[o]', '-t', String(s.dur), ...enc, out]);
    const dings = [];
    if (s.ding) for (const m of marksOf(s.clip).marks) {
      if (!s.ding.test(m.label) || m.t < start) continue;
      const t = map(m.t);
      if (t < s.dur) dings.push(t);
    }
    segs.push({ ...s, file: out, dings });
  }
  return segs;
}

function assemble(lay, segs, tag, crt) {
  const L = LAYOUT[lay];
  // xfade chain
  const inputs = segs.flatMap(s => ['-i', s.file]);
  let chain = '', acc = segs[0].dur, prev = '0:v';
  const starts = [0], whooshes = [];
  for (let i = 1; i < segs.length; i++) {
    const [kind, d] = segs[i - 1].tr;
    const offset = acc - d;
    starts.push(offset);
    whooshes.push(offset);
    const tr = kind === 'star' ? `transition=custom:expr='${STAR}'` : `transition=${kind}`;
    const label = i === segs.length - 1 ? 'x' : `x${i}`;
    chain += `[${prev}][${i}:v]xfade=${tr}:duration=${d}:offset=${offset.toFixed(3)}[${label}];`;
    prev = label;
    acc = offset + segs[i].dur;
  }
  const total = acc;
  // CRT/VGA finish: faint scanlines, a pixel of chroma split, soft vignette.
  const scan = `${WORK}/scan-${lay}.png`;
  ff(['-f', 'lavfi', '-i', `color=c=black:s=${L.W}x${L.H},format=rgba,geq=r=0:g=0:b=0:a='if(eq(mod(Y\\,3)\\,0)\\,34\\,0)'`, '-frames:v', '1', scan]);
  chain += crt ? `[x]rgbashift=rh=-1:bh=1,vignette=angle=PI/6[c];[c][${segs.length}:v]overlay=0:0,format=yuv420p[v]` : `[x]format=yuv420p[v]`;
  const video = `${WORK}/${lay}${tag}-video.mp4`;
  writeFileSync(`${WORK}/${lay}${tag}-graph.txt`, chain);
  ff([...inputs, ...(crt ? ['-loop', '1', '-i', scan] : []), '-/filter_complex', `${WORK}/${lay}${tag}-graph.txt`, '-map', '[v]', '-t', total.toFixed(3), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', video]);
  const dings = segs.flatMap((s, i) => (s.dings || []).map(d => starts[i] + d + 0.05));
  const boot = segs[0].card === 'boot';
  const musicStart = (boot ? starts[1] : 0) + 0.05;
  const endStart = starts[starts.length - 1];
  return { video, total, dings, whooshes, musicStart, endStart, starts, boot };
}

/** Two-pass picture encode, once per boot/CRT pair (no audio). */
function encodePicture(video, out, kbps) {
  const pass = `${WORK}/x264pass`;
  const common = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-passlogfile', pass, '-pix_fmt', 'yuv420p'];
  ff(['-i', video, ...common, '-pass', '1', '-an', '-f', 'mp4', '/dev/null']);
  ff(['-i', video, ...common, '-pass', '2', '-profile:v', 'high', '-an', out]);
}
/** Mux a soundtrack (or a silent track) onto the encoded picture. */
function mux(picture, audio, out, total) {
  const a = audio ? ['-i', audio] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'];
  ff(['-i', picture, ...a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(3), out]);
  console.log(`${out}: ${(statSync(out).size / 1e6).toFixed(1)} MB`);
}

for (const lay of layouts.length ? layouts : ['h', 'v']) {
  console.log(`== ${lay}: cards`);
  await renderCards(lay);
  console.log(`== ${lay}: segments`);
  const segs = buildSegments(lay);
  for (const boot of [...(withBoot ? [true] : []), ...(withoutBoot ? [false] : [])]) {
    const use = boot ? segs : segs.filter(x => x.card !== 'boot');
    for (const crt of [...(withCrt ? [true] : []), ...(withoutCrt ? [false] : [])]) {
      const tag = (boot ? '' : '-noboot');
      const ctag = crt ? '' : '-nocrt';
      console.log(`== ${lay}${tag}${ctag}: assemble`);
      const a = assemble(lay, use, tag + ctag, crt);
      writeFileSync(`${WORK}/${lay}${tag}-timeline.json`, JSON.stringify({ total: a.total, starts: a.starts, shots: use.map((x, i) => ({ at: +a.starts[i].toFixed(2), card: x.card, clip: x.clip, word: x.word })) }, null, 2));
      const name = (lay === 'h' ? 'teaser-1080p' : 'teaser-vertical') + tag;
      const picture = `${WORK}/${lay}${tag}${ctag}-picture.mp4`;
      encodePicture(a.video, picture, 3400); // keeps every file under 24 MB
      if (withMusic) {
        const wav = `${WORK}/${lay}${tag}-music.wav`;
        // Re-time the track so the final chord lands on the end card.
        const bars = Math.max(1, Math.round((a.endStart - a.musicStart) / 1.875));
        const bpm = 240 * bars / (a.endStart - a.musicStart);
        renderMusic({ out: wav, duration: a.total, musicStart: a.musicStart, bpm, endAt: a.endStart + 0.02, dings: a.dings, whooshes: a.whooshes,
          ...(a.boot ? {} : { bootBeep: null, discAt: null }) });
        mux(picture, wav, `${OUT}/${name}${ctag}.mp4`, a.total);
      }
      if (withoutMusic) mux(picture, null, `${OUT}/${name}-nomusic${ctag}.mp4`, a.total);
      if (crt) {
        // Poster: the logo card at rest.
        const logo = use.findIndex(x => x.card === 'logo');
        ff(['-ss', (a.starts[logo + 1] - 0.9).toFixed(2), '-i', a.video, '-frames:v', '1', '-q:v', '3', `${OUT}/${lay === 'h' ? 'teaser' : 'teaser-vertical'}-poster.jpg`]);
      }
    }
  }
}
writeFileSync(`${WORK}/clean-report.json`, JSON.stringify(cleanReports, null, 2));
