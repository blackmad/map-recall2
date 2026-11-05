// GC_TRACE=1 (lane E7, #220): every V8 garbage collection of the page's main thread with its kind, duration and heap
// before/after, from a Chrome trace, aligned to performance.now() through a user-timing mark. Each GC lands in the
// ride-start stall that overlaps it, and the result lists all of them as `gcs`.
const CATS = ['devtools.timeline', 'disabled-by-default-v8.gc', 'blink.user_timing', 'v8'];
export async function startGcTrace(cdp) {
  const events = [];
  const keep = e => e.name === 'MajorGC' || e.name === 'MinorGC' || e.name === 'lsTraceSync' || /^V8\.GC(Scavenger|Compactor|FinalizeMC|IncrementalMarkingStart|IncrementalMarking|MarkCompactor|MC_BACKGROUND_MARKING|MinorMS|_MC_INCREMENTAL_START|_MC_INCREMENTAL_FINALIZE|_HEAP_EXTERNAL_PROLOGUE|Finalize)/.test(e.name)
    || (e.cat?.includes('disabled-by-default-v8.gc') && e.dur > 5000);
  cdp.on('Tracing.dataCollected', d => { for (const e of d.value) if (keep(e)) events.push(e); });
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: CATS, recordMode: 'recordContinuously' }, transferMode: 'ReportEvents', bufferUsageReportingInterval: 1000 });
  return {
    async stop(page) {
      const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
      await cdp.send('Tracing.end'); await done;
      const sync = events.find(e => e.name === 'lsTraceSync');
      const syncAt = await page.evaluate(() => window.__lsTraceSyncAt ?? null).catch(() => null);
      if (!sync || syncAt == null) return { error: 'no sync mark', n: events.length };
      // The page's main thread: the thread that recorded the sync mark.
      const at = ts => +(syncAt + (ts - sync.ts) / 1000).toFixed(1);
      const main = events.filter(e => e.pid === sync.pid && e.tid === sync.tid);
      const gcs = main.filter(e => (e.name === 'MajorGC' || e.name === 'MinorGC') && e.ph === 'X').map(e => ({
        at: at(e.ts), ms: +((e.dur ?? 0) / 1000).toFixed(1), kind: e.name, type: e.args?.type,
        beforeMB: e.args?.usedHeapSizeBefore != null ? +(e.args.usedHeapSizeBefore / 1048576).toFixed(1) : null,
        afterMB: e.args?.usedHeapSizeAfter != null ? +(e.args.usedHeapSizeAfter / 1048576).toFixed(1) : null }));
      const v8 = main.filter(e => e.name.startsWith('V8.') && (e.dur ?? 0) > 2000).map(e => ({ at: at(e.ts), ms: +(e.dur / 1000).toFixed(1), name: e.name, args: e.args && Object.keys(e.args).length ? e.args : undefined }));
      return { gcs, v8: v8.slice(0, 400) };
    },
  };
}
