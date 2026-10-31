// Heap sample of a page and its dedicated workers, after a forced GC in each (CDP). Used by motion-stutter.mjs for the
// ride-start and end-of-ride rows of the L4 heap gate (issue #136): main-thread JS heap, ArrayBuffer backing stores and
// each worker's heap. MB, rounded.
const MB = b => b == null ? null : Math.round(b / 1048576);

/** Main thread: GC, then V8 heap usage. `backingStorageSize` (ArrayBuffers) is reported by recent Chrome only. */
export async function mainHeap(cdp) {
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const u = await cdp.send('Runtime.getHeapUsage');
  return { usedMB: MB(u.usedSize), totalMB: MB(u.totalSize), embedderMB: MB(u.embedderHeapUsedSize), backingMB: MB(u.backingStorageSize) };
}

/** Each dedicated worker the page started: GC, then heap usage, through the page session's auto-attach. */
export async function workerHeaps(cdp) {
  const sessions = [];
  const onAttach = e => { if (e.targetInfo.type === 'worker') sessions.push(e.sessionId); };
  cdp.on('Target.attachedToTarget', onAttach);
  let seq = 1; const waiting = new Map();
  const onMsg = e => { const m = JSON.parse(e.message); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m.result ?? null); } };
  cdp.on('Target.receivedMessageFromTarget', onMsg);
  await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: false });
  await new Promise(r => setTimeout(r, 300));
  const call = (sessionId, method, params = {}) => new Promise(resolve => {
    const id = seq++; waiting.set(id, resolve); setTimeout(() => { if (waiting.delete(id)) resolve(null); }, 5000);
    cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(() => { waiting.delete(id); resolve(null); });
  });
  const out = [];
  for (const s of sessions) {
    await call(s, 'HeapProfiler.enable'); await call(s, 'HeapProfiler.collectGarbage');
    const u = await call(s, 'Runtime.getHeapUsage');
    if (u) out.push({ usedMB: MB(u.usedSize), backingMB: MB(u.backingStorageSize) });
  }
  await cdp.send('Target.setAutoAttach', { autoAttach: false, waitForDebuggerOnStart: false, flatten: false }).catch(() => {});
  for (const s of sessions) await cdp.send('Target.detachFromTarget', { sessionId: s }).catch(() => {});
  cdp.off('Target.attachedToTarget', onAttach); cdp.off('Target.receivedMessageFromTarget', onMsg);
  return out;
}

export async function heapSample(cdp) {
  const main = await mainHeap(cdp), workers = await workerHeaps(cdp);
  return { main, workers, workersUsedMB: workers.reduce((a, w) => a + (w.usedMB || 0), 0) };
}

/** Live-heap attribution: start V8's sampling heap profiler (before navigation), then `heapOwners` after a GC. */
export async function startHeapSampling(cdp, intervalBytes = 65536) {
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: intervalBytes });
}

const LIB = /^(three\.bundle\.js|maplibre-gl\.js|maplibre-gl-csp\.js)$/;
/** Live sampled bytes by owner (innermost app frame: file:line fn) and by script, MB, after a GC. */
export async function heapOwners(cdp, top = 30) {
  await cdp.send('HeapProfiler.collectGarbage');
  const { profile } = await cdp.send('HeapProfiler.getSamplingProfile');
  const owners = new Map(), scripts = new Map(), stacks = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  const walk = (node, appFrames) => {
    const f = node.callFrame, url = f.url ? f.url.split('/').pop().split('?')[0] : '';
    const here = url && !LIB.test(url) ? [`${f.functionName || '(anon)'} ${url}:${f.lineNumber + 1}`, ...appFrames].slice(0, 3) : appFrames;
    if (node.selfSize) {
      add(owners, here[0] ?? `${f.functionName || '(native)'} ${url}`, node.selfSize);
      add(scripts, (here[0] ?? url ?? '(native)').split(' ')[1]?.split(':')[0] ?? '(native)', node.selfSize);
      add(stacks, here.join(' < ') || '(native)', node.selfSize);
    }
    for (const c of node.children || []) walk(c, here);
  };
  walk(profile.head, []);
  const sorted = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, mb: Math.round(v / 1048576 * 10) / 10 }));
  const total = [...owners.values()].reduce((a, b) => a + b, 0);
  return { sampledMB: Math.round(total / 1048576), scripts: sorted(scripts, 15), owners: sorted(owners, top), stacks: sorted(stacks, top) };
}
