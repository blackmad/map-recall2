/** The picture gate end to end on tiny synthetic PNGs (sharp), with an in-memory image source: no clone, no network. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { checkNotes, defaultSource, type ImageSource } from './check-images.ts';
import type { ImageEntry, NotesFile, RemovedImage } from '../../src/canalRecall/whatsNewImageHints.ts';

const W = 120, H = 80, GUTTER = 6;
type RGB = [number, number, number];
/** A street frame: ground below, a wall with a window grid above; `lot` (x0..x1 px) left as bare ground. */
function streetPixels(wall: RGB, lot: [number, number] | null = null): Buffer {
  const d = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bare = y >= H / 2 || (lot && x >= lot[0] && x < lot[1] && y > 8);
    // Paving: a faint diagonal pattern (no strong edges, but no flat rows that read as a gutter); pilasters every 30 px.
    const ground: RGB = (x + y) % 7 === 0 ? [185, 175, 155] : [200, 190, 170];
    const px: RGB = bare ? ground : x % 10 < 4 && y % 10 < 5 ? [20, 30, 40] : x % 30 === 7 ? [60, 40, 30] : wall;
    d.set(px, (y * W + x) * 3);
  }
  return d;
}
const png = (raw: Buffer, w = W, h = H) => sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
/** Frames side by side with white gutters (or stacked when vertical). */
async function sheet(frames: Buffer[], vertical = false): Promise<Buffer> {
  const n = frames.length, w = vertical ? W : n * W + (n - 1) * GUTTER, h = vertical ? n * H + (n - 1) * GUTTER : H;
  const d = Buffer.alloc(w * h * 3, 255);
  frames.forEach((f, k) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tx = vertical ? x : k * (W + GUTTER) + x, ty = vertical ? k * (H + GUTTER) + y : y;
      f.copy(d, (ty * w + tx) * 3, (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
  });
  return png(d, w, h);
}

const RED: RGB = [180, 90, 60], GREY: RGB = [70, 70, 75], RED2: RGB = [178, 92, 60];
function memSource(files: Record<string, Buffer>): ImageSource {
  return { offline: false, clone: null, async get(p) { return files[p] ?? 'missing'; } };
}
const notesOf = (images: ImageEntry[], date = '2026-11-23'): NotesFile => ({ notes: [{ date, title: 't', images }] });
const problemSrcs = (r: Awaited<ReturnType<typeof checkNotes>>) => r.problems.map(p => p.src);

test('a clear composite passes; a near-identical one is refused with the guard numbers', async () => {
  const files = {
    'whats-new/good.png': await sheet([streetPixels(RED), streetPixels(GREY)]),
    'whats-new/weak.png': await sheet([streetPixels(RED), streetPixels(RED2)]),
  };
  const r = await checkNotes(notesOf([{ src: 'whats-new/good.png' }, { src: 'whats-new/weak.png' }]), [], memSource(files));
  assert.deepEqual(r.results.map(x => x.status), ['ok', 'refused']);
  assert.deepEqual(problemSrcs(r), ['whats-new/weak.png']);
  assert.match(r.problems[0].message, /^refused \(target mean diff \d+\.\d% \(bar 3\.0%\).*too-similar/);
  assert.match(r.problems[0].note, /^2026-11-23 "t"$/);
});

test('photo, before, after: the last two panels are compared by default; guard.pair picks others', async () => {
  const photo = streetPixels([90, 140, 200]);
  const files = { 'w/three.png': await sheet([photo, streetPixels(RED), streetPixels(RED2)]) };
  let r = await checkNotes(notesOf([{ src: 'w/three.png' }]), [], memSource(files));
  assert.equal(r.results[0].status, 'refused');
  assert.equal(r.results[0].panels, 3);
  r = await checkNotes(notesOf([{ src: 'w/three.png', guard: { pair: [0, 2] } }]), [], memSource(files));
  assert.equal(r.results[0].status, 'ok', JSON.stringify(r.results[0]));
});

test('guard.panels with gutter 0 and vertical stacks reach the splitter', async () => {
  const stacked = await sheet([streetPixels(RED), streetPixels(GREY)], true);
  let r = await checkNotes(notesOf([{ src: 'w/v.png' }]), [], memSource({ 'w/v.png': stacked }));
  assert.equal(r.results[0].status, 'refused', 'side-by-side detection finds one panel in a vertical stack');
  r = await checkNotes(notesOf([{ src: 'w/v.png', guard: { vertical: true } }]), [], memSource({ 'w/v.png': stacked }));
  assert.equal(r.results[0].status, 'ok');
  // No gutter at all: detection sees one panel; an explicit split works.
  const raw = Buffer.concat([streetPixels(RED), streetPixels(GREY)]); // two frames stacked, 0 px apart
  const flush = await png(raw, W, 2 * H);
  r = await checkNotes(notesOf([{ src: 'w/f.png', guard: { panels: 2, gutter: 0, vertical: true } }]), [], memSource({ 'w/f.png': flush }));
  assert.equal(r.results[0].status, 'ok');
});

test('guard.target: a change confined to a small box is diluted over the whole frame but passes inside its box', async () => {
  const before = streetPixels(RED), after = Buffer.from(before);
  for (let y = 4; y < 36; y++) for (let x = 44; x < 76; x++) after.set([40, 160, 60], (y * W + x) * 3);
  const files = { 'w/box.png': await sheet([before, after]) };
  let r = await checkNotes(notesOf([{ src: 'w/box.png' }]), [], memSource(files));
  assert.equal(r.results[0].status, 'refused', 'over the whole frame the change averages out under the bar');
  r = await checkNotes(notesOf([{ src: 'w/box.png', guard: { target: [0.36, 0.05, 0.27, 0.4] } }]), [], memSource(files));
  assert.equal(r.results[0].status, 'ok');
  assert.ok((r.results[0].metrics?.targetMeanDiff ?? 0) > 0.15);
  assert.equal(r.results[0].metrics?.contextChanged, 0);
});

test('an empty-lot before (missing buildings) is refused when a target box turns on the context checks', async () => {
  const files = { 'w/lot.png': await sheet([streetPixels(RED, [0, 120]), streetPixels(GREY)]) };
  const r = await checkNotes(notesOf([{ src: 'w/lot.png', guard: { target: [0.4, 0.1, 0.2, 0.4] } }]), [], memSource(files));
  assert.deepEqual(r.results[0].refusals?.map(x => x.code).sort(), ['context-changed', 'missing-buildings']);
});

test('split before/after files pair by name; single and grid are only checked for existence', async () => {
  const files = {
    'w/x-before.png': await png(streetPixels(RED)), 'w/x-after.png': await png(streetPixels(GREY)),
    'w/shot.png': await png(streetPixels(RED)),
  };
  const r = await checkNotes(notesOf([
    { src: 'w/x-before.png' }, { src: 'w/x-after.png' },
    { src: 'w/shot.png', guard: { kind: 'single', reason: 'after only' } },
    { src: 'w/gone.png', guard: { kind: 'grid', reason: 'four sides' } },
  ]), [], memSource(files));
  assert.deepEqual(r.results.map(x => `${x.how}:${x.status}`), ['split:ok', 'covered:skipped', 'single:skipped', 'grid:missing']);
  assert.deepEqual(problemSrcs(r), ['w/gone.png']);
  assert.match(r.problems[0].message, /no such file/);
});

test('one frame with no hint is refused and told how to hint it', async () => {
  const r = await checkNotes(notesOf([{ src: 'w/one.png' }]), [], memSource({ 'w/one.png': await png(streetPixels(RED)) }));
  assert.equal(r.results[0].status, 'refused');
  assert.match(r.problems[0].message, /found 1 panel.*guard\.kind "single"/);
});

test('the denylist fails every note; the window and --from limit only the pixel guard', async () => {
  const removed: RemovedImage[] = [{ src: 'w/bad*', date: '2026-11-22', why: 'underlay before' }];
  const file: NotesFile = { notes: [
    { date: '2026-11-23', title: 'new', images: [{ src: 'w/one.png' }] },
    { date: '2025-01-01', title: 'old', images: [{ src: 'w/bad-1.png' }, { src: 'w/one.png' }] },
  ] };
  const src = memSource({ 'w/one.png': await png(streetPixels(RED)), 'w/bad-1.png': await png(streetPixels(RED)) });
  let r = await checkNotes(file, removed, src);
  assert.deepEqual(r.problems.map(p => `${p.note} ${p.src}`), ['2025-01-01 "old" w/bad-1.png', '2026-11-23 "new" w/one.png']);
  r = await checkNotes(file, removed, src, { from: '2026-11-24' });
  assert.deepEqual(r.results, []);
  assert.deepEqual(r.problems.map(p => p.src), ['w/bad-1.png']);
});

test('schema errors stop the run before any picture is read', async () => {
  let reads = 0;
  const src: ImageSource = { offline: false, clone: null, async get() { reads++; return 'missing'; } };
  const r = await checkNotes(notesOf([{ src: 'w/a.png', guard: { kind: 'grid' } }]), [], src);
  assert.equal(reads, 0);
  assert.match(r.problems[0].message, /needs a reason/);
});

test('offline: no clone and no network marks pictures unavailable, not failed; a 404 is missing', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'wn-cache-'));
  try {
    const offline = defaultSource({ clone: null, cacheDir, fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch });
    let r = await checkNotes(notesOf([{ src: 'w/a.png' }, { src: 'w/b.png' }]), [], offline);
    assert.deepEqual(r.results.map(x => x.status), ['unavailable', 'unavailable']);
    assert.deepEqual(r.problems, []);
    assert.equal(r.unavailable, 2);
    assert.equal(offline.offline, true);
    const seen: string[] = [];
    const notFound = defaultSource({ clone: null, cacheDir, fetchImpl: (async (url: string, init: RequestInit) => {
      seen.push(`${url} ${(init.headers as Record<string, string>)['User-Agent']}`);
      return new Response('nope', { status: 404 });
    }) as unknown as typeof fetch });
    r = await checkNotes(notesOf([{ src: 'w/a.png' }]), [], notFound);
    assert.equal(r.results[0].status, 'missing');
    assert.match(seen[0], /^https:\/\/raw\.githubusercontent\.com\/blackmad\/map-recall2-screenshots\/main\/w\/a\.png map-recall2-whats-new-check \(\+https:\/\/github\.com\/blackmad\/map-recall2\)$/);
    assert.doesNotMatch(seen[0], /@/);
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('fetched pictures are cached: the second run does not touch the network', async () => {
  const cacheDir = mkdtempSync(join(tmpdir(), 'wn-cache-'));
  try {
    const bytes = await sheet([streetPixels(RED), streetPixels(GREY)]);
    let calls = 0;
    const fetchImpl = (async () => { calls++; return new Response(bytes, { status: 200 }); }) as unknown as typeof fetch;
    for (let k = 0; k < 2; k++) {
      const r = await checkNotes(notesOf([{ src: 'w/a.png' }]), [], defaultSource({ clone: null, cacheDir, fetchImpl }));
      assert.equal(r.results[0].status, 'ok');
    }
    assert.equal(calls, 1);
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});
