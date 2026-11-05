import assert from 'node:assert/strict';
import test from 'node:test';
import { HEARTBEAT_KEY, type HeartbeatSample, PeerTabs, RideHeartbeat, phaseName, readStamp, unendedReport } from './rideHeartbeat';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m };
}

function harness(storage = memory(), sample: () => HeartbeatSample = () => ({ engine: 'own', tier: 'high', phase: 'racing', heapMB: 300 }), t0 = 1_000_000) {
  let t = t0, tick: (() => void) | null = null, cleared = 0;
  const hb = new RideHeartbeat({ storage, sample, now: () => t, intervalMs: 5000, setInterval: fn => { tick = fn; return 1; }, clearInterval: () => { cleared++; } });
  return { hb, storage, advance: (ms: number) => { t += ms; tick?.(); }, now: () => t, cleared: () => cleared };
}

test('a page that crashed mid-ride is reported by the next load, once', () => {
  const storage = memory();
  const a = harness(storage);
  assert.equal(a.hb.start(), null, 'no previous page');
  a.advance(5000); a.advance(5000);
  const s = readStamp(storage)!;
  assert.deepEqual([s.seq, s.engine, s.tier, s.phase, s.ended, s.at - s.startedAt], [3, 'own', 'high', 'racing', false, 10_000]);
  // The renderer dies here: no end(). The same tab reloads.
  const b = harness(storage, undefined, a.now() + 20_000);
  const previous = b.hb.start();
  const report = unendedReport(previous, b.now());
  assert.equal(report?.message, 'previous ride ended without unload');
  assert.deepEqual(report?.tags, { heartbeat: 'unended', previousVisible: 'true', engine: 'own', tier: 'high', phase: 'racing' });
  assert.equal(report?.extra.uptimeS, 10);
  assert.equal(report?.extra.peakHeapMB, 300);
  // The new page's own stamp replaced it: a third load finds a live (unended) stamp of the second page only.
  assert.equal(readStamp(storage)!.seq, 1);
});

test('a normal unload is not reported, a resumed bfcache page beats again', () => {
  const storage = memory();
  const a = harness(storage);
  a.hb.start(); a.advance(5000); a.hb.end();
  assert.equal(a.cleared(), 1);
  assert.equal(readStamp(storage)!.ended, true);
  assert.equal(unendedReport(readStamp(storage), a.now() + 1000), null);
  a.hb.resume();
  assert.equal(readStamp(storage)!.ended, false);
});

test('stale, future, missing and malformed stamps are not reported', () => {
  const storage = memory();
  const a = harness(storage);
  a.hb.start();
  const s = readStamp(storage)!;
  assert.equal(unendedReport(s, s.at + 7 * 3600_000), null, 'too old');
  assert.equal(unendedReport(s, s.at - 1), null, 'clock went back');
  assert.equal(unendedReport(null, 0), null);
  storage.setItem(HEARTBEAT_KEY, '{nope');
  assert.equal(readStamp(storage), null);
  storage.setItem(HEARTBEAT_KEY, JSON.stringify({ v: 2, at: 1, startedAt: 1 }));
  assert.equal(readStamp(storage), null);
});

test('visibility and peak heap ride along; a throwing sample or storage never breaks the page', () => {
  let heap = 200;
  const a = harness(memory(), () => ({ heapMB: heap }));
  a.hb.start();
  heap = 900; a.advance(5000); heap = 400; a.advance(5000);
  a.hb.setVisible(false);
  const s = a.hb.current()!;
  assert.deepEqual([s.heapMB, s.peakHeapMB, s.visible], [400, 900, false]);
  assert.equal(unendedReport(s, a.now())?.tags.previousVisible, 'false');
  const broken = new RideHeartbeat({ storage: { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('quota'); } }, sample: () => { throw new Error('torn'); }, setInterval: () => 1 });
  assert.equal(broken.start(), null);
  broken.beat(); broken.end();
});

test('phase names', () => {
  assert.equal(phaseName(4), 'racing');
  assert.equal(phaseName(2), 'loading');
  assert.equal(phaseName(9), '9');
  assert.equal(phaseName(undefined), undefined);
});

test('peer tabs: ids heard recently, this page included, stale ones dropped', () => {
  const t = new PeerTabs('me', 15_000);
  assert.equal(t.count(0), 1);
  t.heard('a', 1000); t.heard('b', 2000); t.heard('me', 2000);
  assert.equal(t.count(10_000), 3);
  assert.equal(t.count(16_500), 2, 'a went quiet');
});
